import SwiftUI

// 対戦の調整値(ここだけ触れば勝負の速さ・長さが変わる)
let startHP = 3
let foeSeconds: ClosedRange<Double> = 14...28    // 相手(CPU)が10を作るまでの秒数(上級者は1.5倍)
let flightTime = 0.85                            // 10 が飛ぶ時間
let hitTime = 0.75                               // 命中してから次の勝負までの時間

// 勝負の進行。早く10を作った側の10が相手に飛び、HP が1減り、互いに新しい4つの数が配られる。
// 10 が確定した瞬間に phase が .attack になり、アニメーションが終わるまで入力は止まる。
@MainActor @Observable
final class DuelGame {
    enum Phase: Equatable { case playing, attack, over(Side) }    // over の中身は勝った側

    let hand: Hand
    var level: Level
    private(set) var foeNums = [1, 1, 1, 1]
    private(set) var hpMe = startHP
    private(set) var hpFoe = startHP
    private(set) var phase = Phase.playing
    private(set) var round = 0
    private(set) var attacker: Side?
    private(set) var attackStart: Date?
    private(set) var hitStart: Date?
    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private var foeTask: Task<Void, Never>?

    init(mode: Mode, level: Level) {
        self.level = level
        hand = Hand(mode: mode, ops: level.ops)
        hand.onSolved = { [weak self] in self?.score(.me) }
    }

    func startMatch() {
        task?.cancel(); foeTask?.cancel()
        hand.ops = level.ops
        hpMe = startHP; hpFoe = startHP
        attacker = nil; attackStart = nil; hitStart = nil
        round += 1; phase = .playing
        deal(); startFoe()
    }

    func setMode(_ m: Mode) { hand.mode = m; hand.reset() }
    func setLevel(_ l: Level) { level = l; startMatch() }

    private func deal() {
        hand.reset(start: newProblem(level: level))
        foeNums = newProblem(level: level)
    }

    private func startFoe() {
        foeTask?.cancel()
        let k = level == .advanced ? 1.5 : 1.0
        let sec = Double.random(in: foeSeconds) * k
        foeTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(sec))
            guard !Task.isCancelled else { return }
            self?.score(.foe)
        }
    }

    // side が10を作った。入力を止めて、飛ばして、HP を減らし、次の勝負へ
    func score(_ side: Side) {
        guard phase == .playing else { return }
        phase = .attack
        attacker = side; attackStart = Date(); hitStart = nil
        hand.locked = true
        foeTask?.cancel()
        task = Task { [weak self] in
            try? await Task.sleep(for: .seconds(flightTime))
            guard !Task.isCancelled, let self else { return }
            self.hit(side)
            try? await Task.sleep(for: .seconds(hitTime))
            guard !Task.isCancelled else { return }
            self.finishRound(side)
        }
    }

    private func hit(_ side: Side) {
        withAnimation(.easeOut(duration: 0.3)) {
            if side == .me { hpFoe -= 1 } else { hpMe -= 1 }
        }
        hitStart = Date()
    }

    private func finishRound(_ side: Side) {
        if hpMe <= 0 || hpFoe <= 0 { phase = .over(side); return }
        withAnimation(.spring(duration: 0.5)) {
            round += 1; attacker = nil; attackStart = nil
            deal()
        }
        phase = .playing
        startFoe()
    }

    // 画面の確認用: 自分の10が飛んでいる途中の盤面(foe の HP は 2)
    static func demo() -> DuelGame {
        let g = DuelGame(mode: .merge, level: .basic)
        g.hand.reset(start: [4, 7, 2, 9]); g.foeNums = [6, 3, 8, 1]
        g.hpFoe = startHP - 1
        g.phase = .attack; g.attacker = .me; g.attackStart = Date().addingTimeInterval(-0.55)
        return g
    }
}
