import SwiftUI

// 通常 / 上級者(選んだものは UserDefaults に残す)
enum Level: String, CaseIterable, Identifiable {
    case basic, advanced
    var id: String { rawValue }
    var label: String { self == .basic ? "通常" : "上級者" }
    var ops: [String] { self == .basic ? basicOps : basicOps + advancedOps }
}
let levelKey = "level"

let basicOps = ["+", "−", "×", "÷"]
// 高校数学の演算子。結果が整数か分数(有理数)になるときだけ使える。
// 左(1つ目)・右(2つ目)の順に意味が決まる。
let advancedOps = ["^", "log", "C", "P", "‖‖", "|−|"]
let advancedHelp = "^ 累乗 a^b ・ log 対数 log_a b(底が1つ目) ・ C 組合せ aCb ・ P 順列 aPb ・ ‖‖ ベクトル(a,b)の大きさ √(a²+b²) ・ |−| 数直線上の距離 |a−b|"

// 大きすぎる数は扱わない(整数のオーバーフローを避けるため)
private let limit = 1_000_000
private func fits(_ f: Frac) -> Bool { abs(f.n) <= limit && f.d <= limit }
private func isInt(_ f: Frac) -> Bool { f.d == 1 }

// 整数 k 乗
private func power(_ a: Frac, _ k: Int) -> Frac? {
    guard abs(k) <= 12, !(a.n == 0 && k <= 0) else { return nil }
    var r = Frac(1)
    for _ in 0..<abs(k) {
        r = r * a
        guard fits(r) else { return nil }
    }
    return k >= 0 ? r : Frac(1).divided(by: r)
}

// 有理数の平方根(分子も分母も平方数のときだけ)
private func sqrtExact(_ f: Frac) -> Frac? {
    func isqrt(_ x: Int) -> Int? {
        var r = Int(Double(x).squareRoot())
        while r * r > x { r -= 1 }
        while (r + 1) * (r + 1) <= x { r += 1 }
        return r * r == x ? r : nil
    }
    guard f.n >= 0, let n = isqrt(f.n), let d = isqrt(f.d) else { return nil }
    return Frac(n, d)
}

// 2つの数を1つにする。できないとき(0 で割る・有理数にならない・大きすぎる)は nil
func apply(_ a: Frac, _ o: String, _ b: Frac) -> Frac? {
    let r: Frac?
    switch o {
    case "+": r = a + b
    case "−": r = a - b
    case "×": r = a * b
    case "÷": r = a.divided(by: b)
    case "^":
        r = isInt(b) ? power(a, b.n) : nil
    case "log":
        // log_a(b) = k となる整数 k を探す(a>0, a≠1, b>0)
        guard a.n > 0, a != Frac(1), b.n > 0 else { return nil }
        r = (-12...12).first { power(a, $0) == b }.map { Frac($0) }
    case "C", "P":
        guard isInt(a), isInt(b), b.n >= 0, b.n <= a.n, a.n <= 20 else { return nil }
        var v = 1
        for i in 0..<b.n {
            v *= a.n - i
            if o == "C" { v /= i + 1 }     // 途中でも常に割り切れる
            guard v <= limit else { return nil }
        }
        r = Frac(v)
    case "‖‖": r = sqrtExact(a * a + b * b)
    case "|−|": r = Frac(abs((a - b).n), (a - b).d)
    default: r = nil
    }
    guard let r, fits(r) else { return nil }
    return r
}

// 演算子ボタンの列(通常の4つ + 上級者の演算子は2段目)
struct OpRow: View {
    let ops: [String]
    var selected: String? = nil
    let enabled: Bool
    let action: (String) -> Void

    var body: some View {
        VStack(spacing: 8) {
            ForEach([ops.filter { basicOps.contains($0) }, ops.filter { !basicOps.contains($0) }], id: \.self) { row in
                if !row.isEmpty {
                    HStack(spacing: 10) {
                        ForEach(row, id: \.self) { o in
                            Button(o) { action(o) }
                                .tint(o == selected ? .orange : nil)
                                .disabled(!enabled)
                        }
                    }
                }
            }
        }
        .font(.title2)
        .controlSize(.large)
    }
}
