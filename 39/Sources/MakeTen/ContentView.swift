import SwiftUI

struct ContentView: View {
    @AppStorage(modeKey) private var modeRaw = Mode.merge.rawValue
    @AppStorage("cpuBattle") private var cpuBattle = false
    @State private var start = newProblem()
    @State private var problemID = UUID()
    @State private var solved = 0
    @State private var cpuScore = 0
    @State private var over = false             // この問題の勝負がついた(CPU 対戦のとき)
    @State private var remaining = cpuSeconds
    @State private var cpuAnswer = ""

    private var mode: Mode { Mode(rawValue: modeRaw) ?? .merge }

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                Text("メイクテン").font(.title.bold())
                Spacer()
                Text(cpuBattle ? "あなた \(solved) − \(cpuScore) CPU" : "正解 \(solved)")
                    .font(.title3.monospacedDigit())
            }

            Picker("入力", selection: $modeRaw) {
                ForEach(Mode.allCases) { Text($0.label).tag($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            Text(mode.help).font(.callout).foregroundStyle(.secondary)

            Toggle("CPU と対戦(\(cpuSeconds)秒以内に解く)", isOn: $cpuBattle)
                .onChange(of: cpuBattle) { _ in nextProblem() }

            if cpuBattle {
                Text(over ? cpuAnswer : "CPU が考え中… 残り \(remaining) 秒")
                    .font(.callout.monospacedDigit())
                    .frame(minHeight: 22)
            }

            Group {
                switch mode {
                case .merge, .prefix:
                    MergeView(start: start, prefix: mode == .prefix) { solvedByYou() }
                case .postfix:
                    NotationView(start: start) { solvedByYou() }
                }
            }
            .id("\(problemID)-\(modeRaw)")      // 問題か入力方法が変わったら作り直す
            .disabled(over)

            Button(over ? "次の問題" : "別の問題") { nextProblem() }
        }
        .padding(24)
        .frame(width: 460)
        .task(id: "\(problemID)-\(cpuBattle)") { await cpuThinks() }
    }

    private func solvedByYou() {
        solved += 1
        if cpuBattle { over = true; cpuAnswer = "あなたの勝ち" }
    }

    private func nextProblem() {
        start = newProblem(); problemID = UUID()
        over = false; remaining = cpuSeconds; cpuAnswer = ""
    }

    // 1秒ずつ数えて、先に 10 を作られなければ CPU の勝ち
    private func cpuThinks() async {
        guard cpuBattle else { return }
        while remaining > 0 {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            if Task.isCancelled || over { return }
            remaining -= 1
        }
        over = true
        cpuScore += 1
        cpuAnswer = "CPU の勝ち: \(solveTen(start) ?? "?") = 10"
    }
}
