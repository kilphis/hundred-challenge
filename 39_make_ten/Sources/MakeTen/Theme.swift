import SwiftUI

// 対戦画面のテーマ。色・文言・書体の違いはここに集める(見た目の調整はこのファイルだけ読めばよい)。
// 描き方の違い(背景・玉・HP・ボタン)は Scene*.swift が theme で分岐する。
enum Side { case me, foe }

enum Theme: String, CaseIterable, Identifiable {
    case ink, night, paper, neon
    var id: String { rawValue }
    var label: String {
        switch self {
        case .ink: return "墨と和紙"
        case .night: return "星空と金"
        case .paper: return "切り絵の紙"
        case .neon: return "ネオンの幾何"
        }
    }
}
let themeKey = "theme"
let defaultTheme = Theme.ink

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255,
                  blue: Double(hex & 255) / 255, opacity: opacity)
    }
}

// 魔法使い1人ぶんの色
struct WizardStyle {
    var robe, hat, trim, skin, beard, staff, orb, eye: Color
    var stroke: Color? = nil
    var sw: CGFloat = 0
    var noFill = false          // 線だけで描く(ネオン)
}

struct Look {
    var me: Color, foe: Color           // 玉・HP・飛ぶ10の色
    var ink: Color                      // 式・ボタンの文字
    var accent: Color                   // 選択中・命中の光
    var label: Color                    // HP のラベル
    var panelFill: Color, panelLine: Color
    var youLabel: String, foeLabel: String, thinking: String
    var win: String, lose: String
}

extension Theme {
    var look: Look {
        switch self {
        case .night:
            return Look(me: Color(hex: 0xffd35a), foe: Color(hex: 0x8be8dc), ink: Color(hex: 0xffe28a), accent: Color(hex: 0xfff2b0),
                        label: Color(hex: 0xe8e6ff), panelFill: Color(hex: 0x1a1f52), panelLine: Color(hex: 0xe8c96a),
                        youLabel: "あなた", foeLabel: "相手", thinking: "相手は考え中…", win: "あなたの勝ち", lose: "あなたの負け")
        case .paper:
            return Look(me: Color(hex: 0xe8734a), foe: Color(hex: 0x3f8f8b), ink: Color(hex: 0x5a3a1a), accent: Color(hex: 0xe8493a),
                        label: Color(hex: 0x5a3a1a), panelFill: Color(hex: 0xf6e7c4), panelLine: .clear,
                        youLabel: "あなた", foeLabel: "あいて", thinking: "あいては考え中…", win: "あなたの勝ち", lose: "あなたの負け")
        case .neon:
            return Look(me: Color(hex: 0xff5fb0), foe: Color(hex: 0x4de8ff), ink: Color(hex: 0xff5fb0), accent: .white,
                        label: Color(hex: 0xaaaaaa), panelFill: .clear, panelLine: Color(hex: 0xff5fb0),
                        youLabel: "YOU", foeLabel: "FOE", thinking: "FOE THINKING…", win: "YOU WIN", lose: "YOU LOSE")
        case .ink:
            return Look(me: Color(hex: 0x1d1b1a), foe: Color(hex: 0x5a5550), ink: Color(hex: 0x1d1b1a), accent: Color(hex: 0xc8352b),
                        label: Color(hex: 0x1d1b1a), panelFill: Color(hex: 0xf6efe0), panelLine: Color(hex: 0x1d1b1a),
                        youLabel: "己", foeLabel: "敵", thinking: "敵は思案中…", win: "勝ち", lose: "負け")
        }
    }

    func font(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        switch self {
        case .night: return .system(size: size, weight: weight, design: .serif)
        case .paper: return .system(size: size, weight: weight, design: .rounded)
        case .neon: return .system(size: size, weight: weight, design: .monospaced)
        case .ink: return .custom("Hiragino Mincho ProN", size: size).weight(weight)
        }
    }

    func wizard(_ side: Side) -> WizardStyle {
        let me = side == .me
        switch self {
        case .night:
            return me
                ? WizardStyle(robe: Color(hex: 0x2b3a8c), hat: Color(hex: 0x3b2a8f), trim: Color(hex: 0xe8c96a), skin: Color(hex: 0xf2d2b4), beard: Color(hex: 0xe9e9f2), staff: Color(hex: 0xa8793a), orb: Color(hex: 0xffe28a), eye: Color(hex: 0x222222), stroke: Color(hex: 0x141a4a), sw: 2)
                : WizardStyle(robe: Color(hex: 0x7a2a6c), hat: Color(hex: 0x5a1f6a), trim: Color(hex: 0x7fe0d4), skin: Color(hex: 0xe9c4a6), beard: Color(hex: 0xcfcfdc), staff: Color(hex: 0x8a6a3a), orb: Color(hex: 0x9ff0e6), eye: Color(hex: 0x222222), stroke: Color(hex: 0x2a0f3a), sw: 2)
        case .paper:
            return me
                ? WizardStyle(robe: Color(hex: 0xe8734a), hat: Color(hex: 0xd9573a), trim: Color(hex: 0xfbe3a1), skin: Color(hex: 0xfde0c8), beard: .white, staff: Color(hex: 0x8b5a2b), orb: Color(hex: 0xfbe3a1), eye: Color(hex: 0x4a2a1a))
                : WizardStyle(robe: Color(hex: 0x3f8f8b), hat: Color(hex: 0x2e6f78), trim: Color(hex: 0xfbe3a1), skin: Color(hex: 0xfde0c8), beard: Color(hex: 0xf4f4f4), staff: Color(hex: 0x8b5a2b), orb: Color(hex: 0xfbe3a1), eye: Color(hex: 0x4a2a1a))
        case .neon:
            let c = me ? Color(hex: 0xff5fb0) : Color(hex: 0x4de8ff)
            return WizardStyle(robe: c, hat: c, trim: c, skin: c, beard: c, staff: c, orb: c, eye: c, stroke: c, sw: 2.5, noFill: true)
        case .ink:
            let robe = me ? Color(hex: 0x1d1b1a) : Color(hex: 0x5a5550)
            return WizardStyle(robe: robe, hat: robe, trim: Color(hex: 0xc8352b), skin: Color(hex: 0xf6efe0), beard: Color(hex: 0xf6efe0),
                               staff: me ? Color(hex: 0x3a2c20) : Color(hex: 0x5a4a3a), orb: Color(hex: 0xc8352b), eye: Color(hex: 0x1d1b1a),
                               stroke: me ? Color(hex: 0x1d1b1a) : Color(hex: 0x3a3632), sw: 1.5)
        }
    }
}
