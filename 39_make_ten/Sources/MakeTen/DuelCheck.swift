import SwiftUI

// --check: 手元の入力と対戦の進行を確かめる(結果を標準出力に出す)
@MainActor func duelCheck() {
    func tap(_ h: Hand, _ i: Int) { h.tapItem(h.items[i].id) }
    // 合体: 3+7=10, 1×1=1, 10×1=10
    let g = DuelGame(mode: .merge, level: .basic)
    let h = g.hand
    h.reset(start: [3, 7, 1, 1])
    tap(h, 0); h.tapOp("+"); tap(h, 1)
    tap(h, 1); h.tapOp("×"); tap(h, 2)     // 残りは [1, 10, 1]? 順序が変わるので下で確かめる
    print("合体の途中:", h.items.map(\.text), "solved:", h.solved)
    if let a = h.items.firstIndex(where: { $0.text == "10" }), let b = h.items.firstIndex(where: { $0.text == "1" }), !h.solved {
        tap(h, a); h.tapOp("×"); tap(h, b)
    }
    print("合体で 10:", h.solved, "phase:", g.phase, "attacker:", String(describing: g.attacker), "入力ロック:", h.locked)
    tap(h, 0)   // ロック中は何も起きない
    // 逆ポーランド: 3 7 + 1 × 1 ×
    let g2 = DuelGame(mode: .postfix, level: .basic)
    let p = g2.hand
    p.reset(start: [3, 7, 1, 1])
    tap(p, 0); tap(p, 1); p.tapOp("+"); tap(p, 2); p.tapOp("×"); tap(p, 3); p.tapOp("×")
    print("逆ポーランドで 10:", p.solved, "式:", p.formula, "attacker:", String(describing: g2.attacker))
    // 上級者は演算子が10個
    print("上級者の演算子:", Level.advanced.ops.count)
}

// --shot out.png: 4テーマを並べた1枚を書き出す(ウィンドウは開かない)
@MainActor func shot(_ path: String) {
    let games = Theme.allCases.map { _ in DuelGame.demo() }
    let grid = VStack(spacing: 0) {
        HStack(spacing: 0) { DuelScene(theme: .ink, game: games[0]); DuelScene(theme: .night, game: games[1]) }
        HStack(spacing: 0) { DuelScene(theme: .paper, game: games[2]); DuelScene(theme: .neon, game: games[3]) }
    }
    let r = ImageRenderer(content: grid)
    r.scale = 1
    guard let cg = r.cgImage else { print("描画に失敗"); return }
    let rep = NSBitmapImageRep(cgImage: cg)
    try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
    print("書き出し:", path)
}
