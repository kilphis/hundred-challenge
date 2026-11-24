import SwiftUI

struct ContentView: View {
    @AppStorage(modeKey) private var modeRaw = Mode.merge.rawValue
    @State private var start = newProblem()
    @State private var problemID = UUID()
    @State private var solved = 0

    private var mode: Mode { Mode(rawValue: modeRaw) ?? .merge }

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                Text("メイクテン").font(.title.bold())
                Spacer()
                Text("正解 \(solved)").font(.title3.monospacedDigit())
            }

            Picker("入力", selection: $modeRaw) {
                ForEach(Mode.allCases) { Text($0.label).tag($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            Text(mode.help).font(.callout).foregroundStyle(.secondary)

            Group {
                switch mode {
                case .merge, .prefix:
                    MergeView(start: start, prefix: mode == .prefix) { solved += 1 }
                case .postfix:
                    NotationView(start: start) { solved += 1 }
                }
            }
            .id("\(problemID)-\(modeRaw)")      // 問題か入力方法が変わったら作り直す

            Button("別の問題") { start = newProblem(); problemID = UUID() }
        }
        .padding(24)
        .frame(width: 460)
    }
}
