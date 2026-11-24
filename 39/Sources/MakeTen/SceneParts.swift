import SwiftUI

// 数の玉(80×80 の枠)
struct OrbArt: View {
    let theme: Theme
    let side: Side
    let text: String
    var selected = false

    var body: some View {
        let look = theme.look
        let c = side == .me ? look.me : look.foe
        let me = side == .me
        ZStack {
            switch theme {
            case .night:
                Circle().fill(c.opacity(0.25)).frame(width: 72, height: 72)
                Circle().fill(RadialGradient(colors: me ? [Color(hex: 0xfff6c8), Color(hex: 0xffd35a), Color(hex: 0xe0a020)] : [Color(hex: 0xe6fffb), Color(hex: 0x8be8dc), Color(hex: 0x3fb5a8)],
                                             center: .center, startRadius: 0, endRadius: 27))
                    .frame(width: 54, height: 54)
                    .overlay(Circle().stroke(me ? Color(hex: 0xfff2b0) : Color(hex: 0xe6fffb), lineWidth: 2))
                Text(text).font(theme.font(32)).foregroundColor(Color(hex: 0x2a1d00))
            case .paper:
                Circle().fill(c).frame(width: 62, height: 62)
                Circle().fill(Color(hex: 0xfff8e6)).frame(width: 48, height: 48)
                Text(text).font(theme.font(36, .black)).foregroundColor(Color(hex: 0x4a2a1a))
            case .neon:
                Circle().stroke(c, lineWidth: 2.5).frame(width: 58, height: 58)
                Circle().stroke(c.opacity(0.7), style: StrokeStyle(lineWidth: 1, dash: [3, 7])).frame(width: 70, height: 70)
                Text(text).font(theme.font(32)).foregroundColor(c)
            case .ink:
                Circle().fill(Color(hex: 0xf6efe0, opacity: 0.85)).frame(width: 60, height: 60)
                Ensou(width: 5).frame(width: 60, height: 60)
                Text(text).font(theme.font(34, .heavy)).foregroundColor(me ? Color(hex: 0x1d1b1a) : Color(hex: 0x5a5550))
            }
            if selected { Circle().stroke(look.accent, lineWidth: 3).frame(width: 78, height: 78) }
        }
        .frame(width: 80, height: 80)
        .scaleEffect(selected ? 1.12 : 1)
        .shadow(color: theme == .paper ? .black.opacity(0.3) : theme == .neon ? c : .clear, radius: theme == .paper ? 3 : 5, y: theme == .paper ? 4 : 0)
        .animation(.easeOut(duration: 0.15), value: selected)
    }
}

// 円相(筆で描いた、少し開いた輪)
struct Ensou: View {
    var width: CGFloat = 5
    var color = Color(hex: 0x1d1b1a, opacity: 0.88)
    var body: some View {
        Circle().trim(from: 0.04, to: 0.93)
            .stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round))
            .rotationEffect(.degrees(-90))
    }
}

// HP 3つぶん。自分は左から、相手は右から埋まる
struct HPPips: View {
    let theme: Theme
    let side: Side
    let hp: Int

    var body: some View {
        HStack(spacing: theme == .neon ? 8 : 10) {
            ForEach(0..<3, id: \.self) { i in pip(on: (side == .me ? i : 2 - i) < hp) }
        }
        .animation(.easeOut(duration: 0.3), value: hp)
    }

    @ViewBuilder private func pip(on: Bool) -> some View {
        let c = side == .me ? theme.look.me : theme.look.foe
        switch theme {
        case .night:
            Image(systemName: on ? "heart.fill" : "heart").font(.system(size: 24))
                .foregroundColor(on ? Color(hex: 0xff6b8a) : Color(hex: 0xffb3c4)).frame(width: 26, height: 26)
        case .paper:
            RoundedRectangle(cornerRadius: 8).fill(on ? Color(hex: 0xe8493a) : Color(hex: 0xd8c9a8)).frame(width: 26, height: 26)
                .shadow(color: .black.opacity(on ? 0.3 : 0), radius: 3, y: 3)
        case .neon:
            Rectangle().fill(on ? c : .clear).overlay(Rectangle().stroke(c, lineWidth: 1.5)).frame(width: 44, height: 9)
                .opacity(on ? 1 : 0.5).shadow(color: on ? c : .clear, radius: 4)
        case .ink:
            ZStack {
                RoundedRectangle(cornerRadius: 3).fill(on ? Color(hex: 0xc8352b) : .clear)
                RoundedRectangle(cornerRadius: 3).stroke(Color(hex: 0xc8352b), lineWidth: 2)
                if on { Image(systemName: "plus").font(.system(size: 14, weight: .heavy)).foregroundColor(Color(hex: 0xf6efe0)) }
            }
            .frame(width: 26, height: 26).opacity(on ? 1 : 0.3)
        }
    }
}

// 演算子ボタン(戻す・最初からも同じ形)
struct Chip: View {
    let theme: Theme
    let label: String
    var selected = false
    var enabled = true
    var diameter: CGFloat = 40
    let action: () -> Void

    var body: some View {
        let long = label.count > 1
        let size: CGFloat = long ? 15 : 22
        let gold = Color(hex: 0xe8c96a), pink = Color(hex: 0xff5fb0), ink = Color(hex: 0x1d1b1a), paper = Color(hex: 0xf6efe0)
        Button(action: action) {
            ZStack {
                switch theme {
                case .night:
                    Circle().fill(selected ? gold : Color(hex: 0x2b3a8c)).overlay(Circle().stroke(gold, lineWidth: 1.5))
                case .paper:
                    Circle().fill(selected ? Color(hex: 0xe8493a) : Color(hex: 0xe8734a)).shadow(color: .black.opacity(0.3), radius: 3, y: 3)
                case .neon:
                    Rectangle().fill(selected ? pink.opacity(0.35) : .clear).overlay(Rectangle().stroke(pink, lineWidth: 1.5)).shadow(color: pink, radius: 4)
                case .ink:
                    Circle().fill(selected ? Color(hex: 0xc8352b) : paper)
                    Ensou(width: 3, color: ink)
                }
                Text(label).font(theme.font(size))
                    .foregroundColor(textColor)
            }
            .frame(width: diameter, height: diameter)
        }
        .buttonStyle(.plain)
        .opacity(enabled ? 1 : 0.35)
        .disabled(!enabled)
    }

    private var textColor: Color {
        switch theme {
        case .night: return selected ? Color(hex: 0x2a1d00) : Color(hex: 0xffe28a)
        case .paper: return .white
        case .neon: return Color(hex: 0xff5fb0)
        case .ink: return selected ? Color(hex: 0xf6efe0) : Color(hex: 0x1d1b1a)
        }
    }
}

// 下の入力欄(式・戻す・最初から・演算子)
struct BottomPanel: View {
    let theme: Theme
    let game: DuelGame

    var body: some View {
        let hand = game.hand
        let look = theme.look
        let r: CGFloat = theme == .night ? 10 : theme == .paper ? 12 : 0
        ZStack {
            background
            Text(hand.message).font(.system(size: 14)).foregroundColor(look.label.opacity(0.85)).position(x: 450, y: 454)
            ZStack {
                RoundedRectangle(cornerRadius: r).fill(look.panelFill)
                RoundedRectangle(cornerRadius: r).stroke(look.panelLine, lineWidth: 1.5)
                Text(hand.formula.isEmpty ? " " : hand.formula).font(theme == .ink ? theme.font(22) : .system(size: 22, design: .monospaced))
                    .foregroundColor(look.ink).lineLimit(1).minimumScaleFactor(0.6).padding(.horizontal, 8)
            }
            .frame(width: 200, height: 44).position(x: 140, y: 510)
            Chip(theme: theme, label: "↩", enabled: hand.canUndo, diameter: 36) { hand.undo() }.position(x: 282, y: 510)
            Chip(theme: theme, label: "⟲", enabled: hand.canClear, diameter: 36) { hand.clear() }.position(x: 326, y: 510)
            ForEach(Array(hand.ops.enumerated()), id: \.element) { i, o in
                Chip(theme: theme, label: o, selected: hand.op == o, enabled: hand.opEnabled) { hand.tapOp(o) }
                    .position(x: 384 + CGFloat(i) * 46, y: 510)
            }
        }
        .frame(width: sceneW, height: sceneH)
    }

    @ViewBuilder private var background: some View {
        switch theme {
        case .night:
            Rectangle().fill(Color(hex: 0x0a0d2a, opacity: 0.78)).frame(width: sceneW, height: 90).position(x: 450, y: 515)
        case .paper:
            RoundedRectangle(cornerRadius: 18).fill(Color(hex: 0xfff8e6)).frame(width: 840, height: 64)
                .shadow(color: Color(hex: 0x5a3a1a, opacity: 0.35), radius: 3, y: 4).position(x: 450, y: 512)
        case .neon:
            Rectangle().fill(Color(hex: 0x2a2a5a)).frame(width: 820, height: 1).position(x: 450, y: 474)
        case .ink:
            Rectangle().fill(Color(hex: 0x1d1b1a, opacity: 0.06)).frame(width: sceneW, height: 90).position(x: 450, y: 515)
            Rectangle().fill(Color(hex: 0x1d1b1a)).frame(width: 840, height: 1.5).position(x: 450, y: 472)
        }
    }
}
