import SwiftUI

// 場面は 900×560 の座標で描く(各テーマの下絵は mockups.html)
let sceneW: CGFloat = 900, sceneH: CGFloat = 560
let LX: CGFloat = 200, RX: CGFloat = 700        // 魔法使いの中心 x
let footY: CGFloat = 400                         // 足元
let headY: CGFloat = 230                         // 数の玉が浮かぶ高さの基準

private func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p }
private func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: y) }

// MARK: 背景
struct SceneBackground: View {
    let theme: Theme
    var body: some View {
        Canvas { ctx, _ in
            let full = Path(CGRect(x: 0, y: 0, width: sceneW, height: sceneH))
            switch theme {
            case .night: night(&ctx, full)
            case .paper: paper(&ctx, full)
            case .neon: neon(&ctx, full)
            case .ink: ink(&ctx, full)
            }
        }
        .frame(width: sceneW, height: sceneH)
    }

    private func ellipse(_ ctx: inout GraphicsContext, _ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat, _ c: Color) {
        ctx.fill(Path(ellipseIn: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2)), with: .color(c))
    }
    private func circle(_ ctx: inout GraphicsContext, _ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, _ c: Color) {
        ellipse(&ctx, cx, cy, r, r, c)
    }

    private func night(_ ctx: inout GraphicsContext, _ full: Path) {
        ctx.fill(full, with: .linearGradient(Gradient(stops: [.init(color: Color(hex: 0x070b24), location: 0), .init(color: Color(hex: 0x26185e), location: 0.6), .init(color: Color(hex: 0x5a2a7a), location: 1)]),
                                              startPoint: pt(0, 0), endPoint: pt(0, sceneH)))
        var seed = 7.0
        func rnd() -> CGFloat { seed = (seed * 9301 + 49297).truncatingRemainder(dividingBy: 233280); return CGFloat(seed / 233280) }
        for _ in 0..<70 { circle(&ctx, rnd() * sceneW, rnd() * 330, 0.6 + rnd() * 1.6, .white.opacity(0.3 + Double(rnd()) * 0.7)) }
        circle(&ctx, 450, 90, 38, Color(hex: 0xf4efd0, opacity: 0.9))
        circle(&ctx, 465, 82, 34, Color(hex: 0x26185e))
        for x in [LX, RX] {
            ellipse(&ctx, x, footY + 14, 130, 22, Color(hex: 0x3a3460))
            ellipse(&ctx, x, footY + 8, 130, 20, Color(hex: 0x5b5490))
        }
    }

    private func paper(_ ctx: inout GraphicsContext, _ full: Path) {
        ctx.fill(full, with: .color(Color(hex: 0xf6e7c4)))
        func shadowed(_ draw: (inout GraphicsContext) -> Void) {
            ctx.drawLayer { l in
                l.addFilter(.shadow(color: Color(hex: 0x5a3a1a, opacity: 0.35), radius: 3, x: 0, y: 4))
                draw(&l)
            }
        }
        shadowed { circle(&$0, 450, 150, 90, Color(hex: 0xfbd27a)) }
        shadowed { l in
            l.fill(P { p in
                p.move(to: pt(0, 330)); p.addQuadCurve(to: pt(300, 320), control: pt(150, 250))
                p.addQuadCurve(to: pt(600, 300), control: pt(450, 390)); p.addQuadCurve(to: pt(900, 320), control: pt(750, 210))
                p.addLine(to: pt(900, 560)); p.addLine(to: pt(0, 560)); p.closeSubpath()
            }, with: .color(Color(hex: 0xcfd9a0)))
        }
        shadowed { l in
            l.fill(P { p in
                p.move(to: pt(0, 400)); p.addQuadCurve(to: pt(400, 395), control: pt(200, 340))
                p.addQuadCurve(to: pt(900, 380), control: pt(600, 450))
                p.addLine(to: pt(900, 560)); p.addLine(to: pt(0, 560)); p.closeSubpath()
            }, with: .color(Color(hex: 0x9fc18a)))
        }
        for x in [LX, RX] { shadowed { ellipse(&$0, x, footY + 12, 105, 16, Color(hex: 0x6e9a6a)) } }
    }

    private func neon(_ ctx: inout GraphicsContext, _ full: Path) {
        ctx.fill(full, with: .color(Color(hex: 0x07070f)))
        let grid = P { p in
            for x in stride(from: CGFloat(0), through: sceneW, by: 45) { p.move(to: pt(x, 0)); p.addLine(to: pt(x, sceneH)) }
            for y in stride(from: CGFloat(0), through: sceneH, by: 45) { p.move(to: pt(0, y)); p.addLine(to: pt(sceneW, y)) }
        }
        ctx.stroke(grid, with: .color(Color(hex: 0x1a1a3a)), lineWidth: 1)
        ctx.stroke(P { $0.move(to: pt(0, footY + 12)); $0.addLine(to: pt(sceneW, footY + 12)) }, with: .color(Color(hex: 0x2a2a5a)), lineWidth: 1.5)
        ctx.stroke(P { $0.move(to: pt(450, 60)); $0.addLine(to: pt(450, footY + 12)) }, with: .color(Color(hex: 0x2a2a5a)),
                   style: StrokeStyle(lineWidth: 1, dash: [4, 8]))
    }

    private func ink(_ ctx: inout GraphicsContext, _ full: Path) {
        ctx.fill(full, with: .linearGradient(Gradient(colors: [Color(hex: 0xf3ecdc), Color(hex: 0xe4dac4)]), startPoint: pt(0, 0), endPoint: pt(0, sceneH)))
        circle(&ctx, 450, 170, 75, Color(hex: 0xc8352b, opacity: 0.85))
        let far = P { p in
            p.move(to: pt(0, 360)); p.addQuadCurve(to: pt(240, 330), control: pt(120, 230)); p.addQuadCurve(to: pt(420, 340), control: pt(330, 270))
            p.addQuadCurve(to: pt(660, 330), control: pt(540, 230)); p.addQuadCurve(to: pt(900, 340), control: pt(780, 260))
            p.addLine(to: pt(900, 470)); p.addLine(to: pt(0, 470)); p.closeSubpath()
        }
        ctx.fill(far, with: .linearGradient(Gradient(colors: [Color(hex: 0x1d1b1a, opacity: 0.35), Color(hex: 0x1d1b1a, opacity: 0)]), startPoint: pt(0, 250), endPoint: pt(0, 470)))
        ctx.fill(P { p in
            p.move(to: pt(0, 400)); p.addQuadCurve(to: pt(380, 400), control: pt(200, 340)); p.addQuadCurve(to: pt(900, 400), control: pt(600, 330))
            p.addLine(to: pt(900, 470)); p.addLine(to: pt(0, 470)); p.closeSubpath()
        }, with: .color(Color(hex: 0x1d1b1a, opacity: 0.12)))
    }
}

// MARK: 魔法使い(右向きの形を描いて、flip=-1 で左右反転)
struct WizardView: View {
    let theme: Theme
    let style: WizardStyle
    let cx: CGFloat
    let flip: CGFloat

    var body: some View {
        Canvas { ctx, _ in
            ctx.translateBy(x: cx, y: 0)
            ctx.scaleBy(x: flip, y: 1)
            let s = style
            let line = StrokeStyle(lineWidth: s.sw, lineCap: .round, lineJoin: .round)
            func paint(_ path: Path, _ fill: Color) {
                if !s.noFill { ctx.fill(path, with: .color(fill)) }
                if let st = s.stroke { ctx.stroke(path, with: .color(st), style: line) }
            }
            func seg(_ a: CGPoint, _ b: CGPoint, _ c: Color, _ w: CGFloat) {
                ctx.stroke(P { $0.move(to: a); $0.addLine(to: b) }, with: .color(c), style: StrokeStyle(lineWidth: w, lineCap: .round))
            }
            paint(P { p in
                p.move(to: pt(-58, footY)); p.addLine(to: pt(-34, 262)); p.addQuadCurve(to: pt(34, 262), control: pt(0, 244))
                p.addLine(to: pt(58, footY)); p.addQuadCurve(to: pt(-58, footY), control: pt(0, footY + 12)); p.closeSubpath()
            }, s.robe)
            paint(P { p in
                p.move(to: pt(-34, 262)); p.addQuadCurve(to: pt(34, 262), control: pt(0, 244))
                p.addLine(to: pt(30, 276)); p.addQuadCurve(to: pt(-30, 276), control: pt(0, 262)); p.closeSubpath()
            }, s.trim)
            ctx.stroke(P { p in p.move(to: pt(-16, 246)); p.addQuadCurve(to: pt(6, footY - 20), control: pt(0, 330)) },
                       with: .color(s.trim.opacity(0.7)), lineWidth: s.noFill ? 1.5 : 3)
            paint(P { p in
                p.move(to: pt(-16, 244)); p.addQuadCurve(to: pt(0, 318), control: pt(-4, 300))
                p.addQuadCurve(to: pt(16, 244), control: pt(4, 300)); p.closeSubpath()
            }, s.beard)
            paint(Path(ellipseIn: CGRect(x: -19, y: 209, width: 38, height: 38)), s.skin)
            for x in [6, 14] as [CGFloat] { ctx.fill(Path(ellipseIn: CGRect(x: x - 1.8, y: 224.2, width: 3.6, height: 3.6)), with: .color(s.eye)) }
            paint(Path(ellipseIn: CGRect(x: -46, y: 205, width: 92, height: 18)), s.hat)
            paint(P { p in
                p.move(to: pt(-27, 212)); p.addQuadCurve(to: pt(14, 116), control: pt(-12, 160)); p.addQuadCurve(to: pt(20, 150), control: pt(24, 130))
                p.addQuadCurve(to: pt(27, 212), control: pt(27, 180)); p.closeSubpath()
            }, s.hat)
            ctx.stroke(P { p in p.move(to: pt(-27, 206)); p.addQuadCurve(to: pt(27, 206), control: pt(0, 214)) },
                       with: .color(s.trim), lineWidth: s.noFill ? 1.5 : 4)
            seg(pt(28, 276), pt(72, 248), s.stroke ?? s.robe, s.noFill ? 2 : 9)
            seg(pt(72, 196), pt(80, footY + 4), s.staff, s.noFill ? 2.5 : 5)
            let tip = Path(ellipseIn: CGRect(x: 62, y: 181, width: 18, height: 18))
            if s.noFill { ctx.stroke(tip, with: .color(s.orb), lineWidth: 2.5) } else { ctx.fill(tip, with: .color(s.orb)) }
        }
        .frame(width: sceneW, height: sceneH)
        .shadow(color: theme == .neon ? style.orb.opacity(0.9) : theme == .paper ? .black.opacity(0.3) : .clear,
                radius: theme == .neon ? 5 : 3, y: theme == .paper ? 4 : 0)
    }
}
