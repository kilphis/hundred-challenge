import SwiftUI

// 数の玉が浮かぶ位置(魔法使いの頭を中心にした相対座標)
let orbOffsets: [(dx: CGFloat, dy: CGFloat)] = [(-95, -25), (-50, -105), (45, -115), (100, -35)]
private let shakeTime = 0.5, burstTime = 0.6

// 背景 + 魔法使い + 浮かぶ数 + 飛ぶ10 + 入力欄 + HP。900×560。
struct DuelScene: View {
    let theme: Theme
    let game: DuelGame

    var body: some View {
        ZStack {
            SceneBackground(theme: theme)
            ActorsLayer(theme: theme, game: game)
            BottomPanel(theme: theme, game: game)
            Hud(theme: theme, game: game)
            if case .over(let w) = game.phase { Result(theme: theme, win: w == .me) { game.startMatch() } }
        }
        .frame(width: sceneW, height: sceneH)
        .clipped()
    }
}

private struct Result: View {
    let theme: Theme
    let win: Bool
    let again: () -> Void
    var body: some View {
        let look = theme.look
        VStack(spacing: 14) {
            Text(win ? look.win : look.lose).font(theme.font(46)).foregroundColor(look.accent)
            Button("もう一度", action: again).controlSize(.large).keyboardShortcut(.defaultAction)
        }
        .padding(.horizontal, 48).padding(.vertical, 28)
        .background(RoundedRectangle(cornerRadius: 16).fill(theme == .neon || theme == .night ? Color.black.opacity(0.75) : Color(hex: 0xf6efe0, opacity: 0.92)))
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }
}

// HP とラベル(上の左右)
private struct Hud: View {
    let theme: Theme
    let game: DuelGame
    var body: some View {
        let look = theme.look
        ZStack {
            VStack(alignment: .leading, spacing: 8) {
                Text(look.youLabel).font(theme.font(16)).foregroundColor(look.label)
                HPPips(theme: theme, side: .me, hp: game.hpMe)
            }
            .frame(width: sceneW - 80, height: sceneH, alignment: .topLeading).padding(.top, 20)
            VStack(alignment: .trailing, spacing: 8) {
                Text(look.foeLabel).font(theme.font(16)).foregroundColor(look.label)
                HPPips(theme: theme, side: .foe, hp: game.hpFoe)
                Text(look.thinking).font(theme.font(14, .regular)).foregroundColor(look.foe)
                    .opacity(game.phase == .playing ? 1 : 0)
            }
            .frame(width: sceneW - 80, height: sceneH, alignment: .topTrailing).padding(.top, 20)
        }
        .allowsHitTesting(false)
    }
}

// 毎フレーム動くもの: 魔法使い・ふわふわ浮く玉・飛ぶ10・命中の光・命中時の揺れ
private struct ActorsLayer: View {
    let theme: Theme
    let game: DuelGame

    var body: some View {
        TimelineView(.animation) { tl in
            let now = tl.date
            let t = now.timeIntervalSinceReferenceDate
            ZStack {
                WizardView(theme: theme, style: theme.wizard(.me), cx: LX, flip: 1).offset(x: shake(.me, now))
                WizardView(theme: theme, style: theme.wizard(.foe), cx: RX, flip: -1).offset(x: shake(.foe, now))
                ForEach(game.hand.items) { item in
                    let o = orbOffsets[item.slot]
                    Button { game.hand.tapItem(item.id) } label: {
                        OrbArt(theme: theme, side: .me, text: item.text, selected: item.selected)
                            .opacity(item.dimmed ? 0.25 : 1)
                    }
                    .buttonStyle(.plain)
                    .position(x: LX + o.dx + shake(.me, now), y: headY + o.dy + CGFloat(item.slot % 2) * 6 + bob(t, item.slot))
                    .animation(.spring(duration: 0.4), value: item.slot)
                    .transition(.scale.combined(with: .opacity))
                }
                .opacity(game.attacker == .me ? 0.25 : 1)
                ForEach(0..<4, id: \.self) { i in
                    let o = orbOffsets[i]
                    OrbArt(theme: theme, side: .foe, text: "\(game.foeNums[i])")
                        .position(x: RX - o.dx + shake(.foe, now), y: headY + o.dy + CGFloat(i % 2) * 6 + bob(t, i + 4))
                        .id("\(game.round)-\(i)")
                        .transition(.scale.combined(with: .opacity))
                }
                .opacity(game.attacker == .foe ? 0.25 : 1)
                effects(now)
            }
            .frame(width: sceneW, height: sceneH)
        }
    }

    private func bob(_ t: Double, _ i: Int) -> CGFloat { CGFloat(sin(t * 1.6 + Double(i) * 1.3)) * 5 }

    // 命中した側は揺れる
    private func shake(_ side: Side, _ now: Date) -> CGFloat {
        guard let a = game.attacker, a != side, let h = game.hitStart else { return 0 }
        let p = now.timeIntervalSince(h) / shakeTime
        return p < 0 || p >= 1 ? 0 : CGFloat(sin(p * 28) * 10 * (1 - p))
    }

    // 飛ぶ10の位置(山なりに飛ぶ)
    private func flightPoint(_ a: Side, _ t: Double) -> CGPoint {
        let from = a == .me ? CGPoint(x: LX + 71, y: 190) : CGPoint(x: RX - 71, y: 190)
        let to = a == .me ? CGPoint(x: RX, y: 275) : CGPoint(x: LX, y: 275)
        return CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - 60 * sin(.pi * t))
    }

    @ViewBuilder private func effects(_ now: Date) -> some View {
        let look = theme.look
        if let a = game.attacker, let st = game.attackStart {
            let t = min(1, max(0, now.timeIntervalSince(st) / flightTime))
            if t < 1 {
                let c = a == .me ? look.me : look.foe
                ForEach(1...6, id: \.self) { k in
                    let tk = max(0, t - Double(k) * 0.05)
                    Circle().fill(c.opacity(0.4 - Double(k) * 0.055)).frame(width: 30 - CGFloat(k) * 3, height: 30 - CGFloat(k) * 3)
                        .position(flightPoint(a, tk))
                }
                OrbArt(theme: theme, side: a, text: "10").scaleEffect(1.25 * min(1, 0.4 + t * 3))
                    .position(flightPoint(a, t))
            }
            if let h = game.hitStart {
                let p = now.timeIntervalSince(h) / burstTime
                if p >= 0 && p < 1 {
                    let to = flightPoint(a, 1)
                    Circle().stroke(look.accent, lineWidth: 8 * (1 - p)).frame(width: 40, height: 40)
                        .scaleEffect(1 + p * 4).opacity(1 - p).position(to)
                    Circle().fill(look.accent.opacity(0.5 * (1 - p))).frame(width: 60, height: 60)
                        .scaleEffect(1 + p).position(to)
                }
            }
        }
    }
}

// 対戦の画面(ツールバーで テーマ・入力のしかた・難易度 を切り替える)
struct DuelScreen: View {
    @AppStorage(themeKey) private var themeRaw = defaultTheme.rawValue
    @AppStorage(modeKey) private var modeRaw = Mode.merge.rawValue
    @AppStorage(levelKey) private var levelRaw = Level.basic.rawValue
    @State private var game = DuelGame(mode: Mode(rawValue: UserDefaults.standard.string(forKey: modeKey) ?? "") ?? .merge,
                                       level: Level(rawValue: UserDefaults.standard.string(forKey: levelKey) ?? "") ?? .basic)

    private var theme: Theme { Theme(rawValue: themeRaw) ?? defaultTheme }

    var body: some View {
        DuelScene(theme: theme, game: game)
            .animation(.easeInOut(duration: 0.3), value: themeRaw)
            .task { game.startMatch() }
            .onChange(of: modeRaw) { _ in game.setMode(Mode(rawValue: modeRaw) ?? .merge) }
            .onChange(of: levelRaw) { _ in game.setLevel(Level(rawValue: levelRaw) ?? .basic) }
            .toolbar {
                ToolbarItem {
                    Picker("テーマ", selection: $themeRaw) { ForEach(Theme.allCases) { Text($0.label).tag($0.rawValue) } }
                        .pickerStyle(.menu)
                }
                ToolbarItem {
                    Picker("入力", selection: $modeRaw) { ForEach(Mode.allCases) { Text($0.label).tag($0.rawValue) } }
                        .pickerStyle(.menu)
                }
                ToolbarItem {
                    Picker("難易度", selection: $levelRaw) { ForEach(Level.allCases) { Text($0.label).tag($0.rawValue) } }
                        .pickerStyle(.segmented)
                }
            }
    }
}

// 起動したときの画面。対戦と、これまでの1人用(練習)を切り替える
struct RootView: View {
    @State private var screen = 0
    var body: some View {
        Group {
            if screen == 0 { DuelScreen() } else { ContentView() }
        }
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Picker("画面", selection: $screen) { Text("対戦").tag(0); Text("練習").tag(1) }.pickerStyle(.segmented)
            }
        }
    }
}
