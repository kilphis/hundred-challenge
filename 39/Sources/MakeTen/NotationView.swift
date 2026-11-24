import SwiftUI

// 逆ポーランド(後置) の入力画面
struct NotationView: View {
    let start: [Int]
    var ops = basicOps
    var onSolved: () -> Void

    @State private var toks: [Tok] = []
    @State private var message = ""

    private var items: [Frac] { stack(toks, values: start) ?? [] }
    private var used: Set<Int> { Set(toks.compactMap { if case .num(let i) = $0 { return i } else { return nil } }) }
    private var opCount: Int { toks.count - used.count }
    private var finished: Bool { used.count == 4 && opCount == 3 }

    private var canPlaceOp: Bool { !finished && opCount < 3 && items.count >= 2 }
    private func canPlaceNumber(_ i: Int) -> Bool { !finished && !used.contains(i) }

    var body: some View {
        VStack(spacing: 18) {
            HStack(spacing: 12) {
                ForEach(0..<4, id: \.self) { i in
                    Button { push(.num(i)) } label: {
                        Text("\(start[i])")
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .frame(width: 80, height: 100)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!canPlaceNumber(i))
                }
            }

            OpRow(ops: ops, enabled: canPlaceOp) { push(.op($0)) }

            // いまの積み
            HStack(spacing: 10) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, v in
                    Text(v.text)
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(.tint.opacity(0.25), in: RoundedRectangle(cornerRadius: 8))
                }
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))

            HStack(spacing: 10) {
                Button("1つ戻す") { toks.removeLast(); message = "" }.disabled(toks.isEmpty)
                Button("最初から") { toks = []; message = "" }.disabled(toks.isEmpty)
            }

            Text(message).frame(minHeight: 22)
        }
    }

    private func push(_ t: Tok) {
        guard stack(toks + [t], values: start) != nil else {
            message = "その組み合わせは計算できません"; return
        }
        toks.append(t)
        message = ""
        if finished, let v = items.first {
            if v == Frac(10) { onSolved(); message = "正解! 10 になった" }
            else { message = "最後は \(v.text) でした" }
        }
    }
}
