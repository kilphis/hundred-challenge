import SwiftUI

struct Card: Identifiable, Equatable {
    let id = UUID()
    let value: Frac
}

struct MergeView: View {
    let start: [Int]
    var prefix = false                      // true: 演算子 → 数 → 数 の順 / false: 数 → 演算子 → 数
    @State private var cards: [Card] = []
    @State private var history: [[Card]] = []
    @State private var first: Card.ID?      // 1つ目に選んだ数
    @State private var op: String?          // 選んだ演算子
    @State private var message = ""
    var onSolved: () -> Void

    private var hint: String {
        prefix ? "演算子を選び、数を2つ選ぶと、1つの数になる" : "数を選び、演算子を選び、もう1つ数を選ぶと、1つの数になる"
    }

    var body: some View {
        VStack(spacing: 18) {
            HStack(spacing: 12) {
                ForEach(cards) { c in
                    Button { tap(c) } label: {
                        Text(c.value.text)
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .minimumScaleFactor(0.5)
                            .frame(width: 80, height: 100)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(c.id == first ? .orange : .accentColor)
                    .disabled(cards.count == 1 || (prefix && op == nil))
                }
            }
            .frame(minHeight: 100)

            Text(formula)
                .font(.system(size: 28, design: .monospaced))
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))

            HStack(spacing: 10) {
                ForEach(["+", "−", "×", "÷"], id: \.self) { o in
                    Button(o) { op = o }
                        .tint(o == op ? .orange : nil)
                        .disabled(cards.count == 1 || (!prefix && first == nil))
                }
            }
            .font(.title2)
            .controlSize(.large)

            HStack(spacing: 10) {
                Button("1つ戻す") { undo() }.disabled(history.isEmpty)
                Button("最初から") { reset() }.disabled(history.isEmpty && first == nil && op == nil)
            }

            Text(message).frame(minHeight: 22)
        }
        .onAppear { reset() }
    }

    // 選んでいる途中の式 ("3 + " や "+ 3 " など)
    private var formula: String {
        let f = cards.first(where: { $0.id == first })?.value.text
        if prefix {
            guard let o = op else { return " " }
            return f.map { "\(o) \($0)" } ?? o
        }
        guard let f else { return " " }
        return "\(f) \(op ?? "?")"
    }

    private func tap(_ c: Card) {
        if prefix {
            guard op != nil else { return }
            guard let f = first else { first = c.id; return }
            if f == c.id { first = nil; return }            // もう一度押すと選択を外す
            combine(f, c)
            return
        }
        guard let f = first else { first = c.id; return }
        if f == c.id { first = nil; op = nil; return }      // もう一度押すと選択を外す
        guard op != nil else { first = c.id; return }       // 演算子の前なら1つ目の選び直し
        combine(f, c)
    }

    // 1つ目(f)と2つ目(c)を、選んでいる演算子で1つの数にする
    private func combine(_ f: Card.ID, _ c: Card) {
        guard let o = op,
              let a = cards.first(where: { $0.id == f }),
              let r = apply(a.value, o, c.value) else {
            message = "0 では割れません"; return
        }
        history.append(cards)
        cards.removeAll { $0.id == f || $0.id == c.id }
        cards.append(Card(value: r))
        first = nil; op = nil
        if cards.count == 1 {
            if r == Frac(10) { onSolved(); message = "正解! 10 になった" }
            else { message = "最後は \(r.text) でした" }
        } else { message = hint }
    }

    private func undo() {
        guard let prev = history.popLast() else { return }
        cards = prev; first = nil; op = nil; message = hint
    }

    private func reset() {
        cards = start.map { Card(value: Frac($0)) }
        history = []; first = nil; op = nil; message = hint
    }
}
