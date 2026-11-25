import SwiftUI

// 浮かんでいる玉1つぶん。slot は魔法使いの周りのどの位置に浮かぶか
struct HandItem: Identifiable {
    let id: String
    let text: String
    let slot: Int
    let selected: Bool
    let dimmed: Bool            // 逆ポーランドで使用済み
}

// 自分の手元の4つの数と、入力の途中状態。画面(玉・式・ボタン)は何も持たず、ここを見る。
// 入力のしかたは MergeView / NotationView と同じ規則(合体・ポーランド・逆ポーランド)。
@MainActor @Observable
final class Hand {
    var mode: Mode
    var ops: [String]
    private(set) var start = [1, 1, 1, 1]
    private var cards: [Card] = []
    private var history: [[Card]] = []
    private var first: Card.ID?
    private(set) var op: String?
    private var toks: [Tok] = []
    private(set) var message = ""
    private(set) var solved = false
    var locked = false                      // 勝負がついたら入力を受け付けない
    @ObservationIgnored var onSolved: (@MainActor () -> Void)?
    private var serial = 0

    init(mode: Mode, ops: [String]) { self.mode = mode; self.ops = ops }

    private var prefix: Bool { mode == .prefix }
    private var hint: String {
        switch mode {
        case .merge: return "数を選び、演算子を選び、もう1つ数を選ぶと、1つの数になる"
        case .prefix: return "演算子を選び、数を2つ選ぶと、1つの数になる"
        case .postfix: return "数・数・演算子 の順。演算子が直前の2つを1つにする"
        }
    }

    func reset(start s: [Int]? = nil) {
        if let s { start = s; serial += 1 }
        cards = start.map { Card(value: Frac($0)) }
        history = []; first = nil; op = nil; toks = []
        solved = false; locked = false; message = hint
    }

    // MARK: 見せるもの
    var items: [HandItem] {
        if mode == .postfix {
            let used = usedIndices
            return start.indices.map { HandItem(id: "p\(serial)-\($0)", text: "\(start[$0])", slot: $0, selected: false, dimmed: used.contains($0)) }
        }
        return cards.enumerated().map { HandItem(id: $1.id.uuidString, text: $1.value.text, slot: $0, selected: $1.id == first, dimmed: false) }
    }

    // 選んでいる途中の式
    var formula: String {
        if mode == .postfix {
            return toks.map { t -> String in
                switch t { case .num(let i): return "\(start[i])"; case .op(let o): return o }
            }.joined(separator: " ")
        }
        let f = cards.first(where: { $0.id == first })?.value.text
        if prefix {
            guard let o = op else { return "" }
            return f.map { "\(o) \($0)" } ?? o
        }
        guard let f else { return "" }
        return "\(f) \(op ?? "?")"
    }

    var opEnabled: Bool {
        guard !locked, !solved else { return false }
        return mode == .postfix ? canPlaceOp : (cards.count > 1 && (prefix || first != nil))
    }
    var canUndo: Bool { !locked && !solved && (mode == .postfix ? !toks.isEmpty : !history.isEmpty) }
    var canClear: Bool { !locked && !solved && (canUndo || first != nil || op != nil) }

    // MARK: 操作
    func tapItem(_ id: String) {
        guard !locked, !solved else { return }
        if mode == .postfix {
            guard let i = start.indices.first(where: { "p\(serial)-\($0)" == id }), canPlaceNumber(i) else { return }
            push(.num(i)); return
        }
        guard let c = cards.first(where: { $0.id.uuidString == id }) else { return }
        tapCard(c)
    }

    func tapOp(_ o: String) {
        guard opEnabled else { return }
        if mode == .postfix { push(.op(o)) } else { op = o }
    }

    func undo() {
        guard canUndo else { return }
        if mode == .postfix { toks.removeLast(); message = ""; return }
        guard let prev = history.popLast() else { return }
        cards = prev; first = nil; op = nil; message = hint
    }

    func clear() { guard canClear else { return }; reset() }

    // MARK: 合体 / ポーランド
    private func tapCard(_ c: Card) {
        if prefix {
            guard op != nil else { return }
            guard let f = first else { first = c.id; return }
            if f == c.id { first = nil; return }
            combine(f, c); return
        }
        guard let f = first else { first = c.id; return }
        if f == c.id { first = nil; op = nil; return }
        guard op != nil else { first = c.id; return }
        combine(f, c)
    }

    private func combine(_ f: Card.ID, _ c: Card) {
        guard let o = op, let a = cards.first(where: { $0.id == f }), let r = apply(a.value, o, c.value) else {
            message = "その組み合わせは計算できません"; return
        }
        history.append(cards)
        cards.removeAll { $0.id == f || $0.id == c.id }
        cards.append(Card(value: r))
        first = nil; op = nil
        if cards.count == 1 {
            if r == Frac(10) { solved = true; message = ""; onSolved?() }
            else { message = "最後は \(r.text) でした" }
        } else { message = hint }
    }

    // MARK: 逆ポーランド
    private var usedIndices: Set<Int> { Set(toks.compactMap { if case .num(let i) = $0 { return i } else { return nil } }) }
    private var opCount: Int { toks.count - usedIndices.count }
    private var stackItems: [Frac] { stack(toks, values: start) ?? [] }
    private var finished: Bool { usedIndices.count == 4 && opCount == 3 }
    private var canPlaceOp: Bool { !finished && opCount < 3 && stackItems.count >= 2 }
    private func canPlaceNumber(_ i: Int) -> Bool { !finished && !usedIndices.contains(i) }

    private func push(_ t: Tok) {
        guard stack(toks + [t], values: start) != nil else { message = "その組み合わせは計算できません"; return }
        toks.append(t); message = ""
        if finished, let v = stackItems.first {
            if v == Frac(10) { solved = true; onSolved?() }
            else { message = "最後は \(v.text) でした" }
        }
    }
}
