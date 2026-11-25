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
func canMakeTen(_ nums: [Int], ops: [String] = basicOps) -> Bool {
    func go(_ xs: [Frac]) -> Bool {
        if xs.count == 1 { return xs[0] == Frac(10) }
        for a in 0..<xs.count {
            for b in 0..<xs.count where a != b {
                let rest = xs.indices.filter { $0 != a && $0 != b }.map { xs[$0] }
                for o in ops {
                    if let r = apply(xs[a], o, xs[b]), go(rest + [r]) { return true }
                }
            }
        }
        return false
    }
    return go(nums.map { Frac($0) })
}

// 10 になる式を1つ返す(CPU の答え表示用)。なければ nil
func solveTen(_ nums: [Int]) -> String? {
    func go(_ xs: [(Frac, String)]) -> String? {
        if xs.count == 1 { return xs[0].0 == Frac(10) ? xs[0].1 : nil }
        for a in 0..<xs.count {
            for b in 0..<xs.count where a != b {
                let rest = xs.indices.filter { $0 != a && $0 != b }.map { xs[$0] }
                let (x, xt) = xs[a], (y, yt) = xs[b]
                var results = [(x + y, "(\(xt) + \(yt))"), (x - y, "(\(xt) − \(yt))"), (x * y, "(\(xt) × \(yt))")]
                if let q = x.divided(by: y) { results.append((q, "(\(xt) ÷ \(yt))")) }
                for r in results { if let s = go(rest + [r]) { return s } }
            }
        }
        return nil
    }
    guard var s = go(nums.map { (Frac($0), "\($0)") }) else { return nil }
    if s.hasPrefix("(") { s.removeFirst(); s.removeLast() }     // いちばん外のかっこは外す
    return s
}

// CPU が答えを出すまでの秒数(調整はここだけ)
let cpuSeconds = 30

// 解ける4つ組をランダムに出す(1〜9)
func newProblem(level: Level = .basic) -> [Int] {
    while true {
        let c = (0..<4).map { _ in Int.random(in: 1...9) }
        if canMakeTen(c, ops: level.ops) { return c }
    }
}
