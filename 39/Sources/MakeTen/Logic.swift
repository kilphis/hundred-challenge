import Foundation

// 分数(割り算で端数が出ても誤差なしで 10 かどうか判定するため)
struct Frac: Equatable {
    let n: Int
    let d: Int
    init(_ n: Int, _ d: Int = 1) {
        let g = Frac.gcd(abs(n), abs(d))
        let s = d < 0 ? -1 : 1
        self.n = s * n / g
        self.d = s * d / g
    }
    static func gcd(_ a: Int, _ b: Int) -> Int { b == 0 ? max(a, 1) : gcd(b, a % b) }
    static func + (a: Frac, b: Frac) -> Frac { Frac(a.n * b.d + b.n * a.d, a.d * b.d) }
    static func - (a: Frac, b: Frac) -> Frac { Frac(a.n * b.d - b.n * a.d, a.d * b.d) }
    static func * (a: Frac, b: Frac) -> Frac { Frac(a.n * b.n, a.d * b.d) }
    func divided(by b: Frac) -> Frac? { b.n == 0 ? nil : Frac(n * b.d, d * b.n) }
    var text: String { d == 1 ? "\(n)" : "\(n)/\(d)" }
}

// 2つの数を1つにする。0 で割るときは nil
func apply(_ a: Frac, _ o: String, _ b: Frac) -> Frac? {
    switch o {
    case "+": return a + b
    case "−": return a - b
    case "×": return a * b
    default: return a.divided(by: b)
    }
}

// 入力のしかた(選んだものは UserDefaults に残す)
enum Mode: String, CaseIterable, Identifiable {
    case merge, prefix, postfix
    var id: String { rawValue }
    var label: String {
        switch self {
        case .merge: return "合体"
        case .prefix: return "ポーランド"
        case .postfix: return "逆ポーランド"
        }
    }
    var help: String {
        switch self {
        case .merge: return "数・演算子・数 の順に選ぶと、2つが1つの数になる"
        case .prefix: return "演算子・数・数 の順に選ぶと、2つが1つの数になる。その数も次に使える"
        case .postfix: return "数・数・演算子 の順(例: 3 7 + 1 × 1 ×)。演算子が直前の2つを1つにする"
        }
    }
}
let modeKey = "inputMode"

// 逆ポーランドの入力列。num は「何番目のカードか」
enum Tok: Equatable {
    case num(Int)
    case op(String)
}

// 入力列を左から読んだ「積み」(数だけ)を返す。演算子は直前の2つを1つにする。
// 0 で割る・数が足りないときは nil
func stack(_ toks: [Tok], values: [Int]) -> [Frac]? {
    var st: [Frac] = []
    for t in toks {
        switch t {
        case .num(let i): st.append(Frac(values[i]))
        case .op(let o):
            guard st.count >= 2, let r = apply(st[st.count - 2], o, st[st.count - 1]) else { return nil }
            st.removeLast(2)
            st.append(r)
        }
    }
    return st
}

// 4つの数で 10 が作れるか(総当たり: 2つ選んで計算→1つに置き換え、を繰り返す)
func canMakeTen(_ nums: [Int]) -> Bool {
    func go(_ xs: [Frac]) -> Bool {
        if xs.count == 1 { return xs[0] == Frac(10) }
        for a in 0..<xs.count {
            for b in 0..<xs.count where a != b {
                let rest = xs.indices.filter { $0 != a && $0 != b }.map { xs[$0] }
                var results = [xs[a] + xs[b], xs[a] - xs[b], xs[a] * xs[b]]
                if let q = xs[a].divided(by: xs[b]) { results.append(q) }
                for r in results where go(rest + [r]) { return true }
            }
        }
        return false
    }
    return go(nums.map { Frac($0) })
}

// 解ける4つ組をランダムに出す(1〜9)
func newProblem() -> [Int] {
    while true {
        let c = (0..<4).map { _ in Int.random(in: 1...9) }
        if canMakeTen(c) { return c }
    }
}
