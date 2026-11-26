# /// script
# requires-python = ">=3.10"
# dependencies = ["pygame-ce"]
# ///
"""pygame 版。ゲーム本体は shooting.py の Game を使い、入力と描画だけ差し替える。
実行: uv run shooting_pg.py
録画: uv run shooting_pg.py --rec [保存先.mov]   (ゲームのウィンドウだけを録る。終了で保存。録画中はウィンドウを動かさない)
操作: 矢印/wasd で移動(同時押しで斜め)、長押しでチャージ→離すと突進。q / Esc で終了、r でやり直し。
端末版と違いキーの押下/解放を直接読めるので、リピート判定は使わない。
"""
import math
import os
import signal
import subprocess
import sys
import time

import pygame

import shooting as sh
from shooting import DT, FPS, H, MIN_CHARGE, W, MAX_CHARGE, Charge, Game

SCALE = 6            # 1ドット = 6px
HUD_H = 28
DIAG_GRACE = 0.2     # 2キーを離すタイミングのずれを許す秒数(斜め突進の合成窓)

KEYS = {   # 方向 index: 0 左 1 右 2 上 3 下
    0: (pygame.K_a, pygame.K_LEFT), 1: (pygame.K_d, pygame.K_RIGHT),
    2: (pygame.K_w, pygame.K_UP), 3: (pygame.K_s, pygame.K_DOWN),
}


class HeldCharge(Charge):
    """pygame 用。キーの押下状態を毎フレーム読めるので、リピート判定は要らない。"""

    def __init__(self):
        self.held_time = 0.0
        self.held = False
        self.ratio = 0.0            # 離した瞬間に渡すチャージ量(held_time は離すと 0 に戻るため)
        self.stage = 0              # 0 なし / 1 押下中 / 2 チャージ確定(MIN_CHARGE 以上)
        self.last_dir = None
        self.seen = [-9.0] * 4      # 各方向を最後に押していた時刻

    def read(self, held, t, dashing):
        """held: 今フレームに押されている方向 index の集合。Game.update() の前に呼ぶ。"""
        for i in held:
            self.seen[i] = t
        self.held = bool(held) and not dashing
        if self.held:
            self.held_time += DT
            self.ratio = min(1.0, self.held_time / MAX_CHARGE)
            self.last_dir = min(held)
            self.stage = 2 if self.held_time >= MIN_CHARGE else 1
        else:
            self.held_time = 0.0
            if self.stage == 1:
                self.stage = 0

    def charge(self, t):
        if self.stage != 2 or not self.held:
            return 0.0
        return min(1.0, self.held_time / MAX_CHARGE)

    def gauge(self, t):
        return min(1.0, self.held_time / MAX_CHARGE)

    def direction(self, t):
        """離す直前(DIAG_GRACE 秒以内)に押していた方向を合成。左右・上下は打ち消し合う。"""
        near = [t - s <= DIAG_GRACE for s in self.seen]
        vx = near[1] - near[0]
        vy = near[3] - near[2]
        if vx == 0 and vy == 0:
            vx, vy = {0: (-1, 0), 1: (1, 0), 2: (0, -1), 3: (0, 1)}.get(self.last_dir, (0, -1))
        n = math.hypot(vx, vy)
        return vx / n, vy / n

    def poll(self, t):
        if self.stage == 2 and not self.held:   # チャージ確定のあと離された
            out = (self.direction(t), self.ratio)
            self.stage = 0
            return out
        return None


class PGGame(Game):
    def __init__(self):
        super().__init__(charge=HeldCharge())

    def read_keys(self, held):
        if self.dash.locked:                    # 突進中・硬直中は入力を受けない
            held = set()
        for i in range(4):
            self.hold[i] = 0.14 if i in held else 0.0
        self.charge_in.read(held, self.t, dashing=self.dash.locked)


def pressed_dirs(state):
    return {i for i, ks in KEYS.items() if any(state[k] for k in ks)}


def start_recording(size, path):
    """ウィンドウの位置と大きさを取り、その範囲だけを screencapture で録画し始める。"""
    for _ in range(10):                      # ウィンドウが画面に出て位置が確定するまで待つ
        pygame.event.pump()
        time.sleep(0.05)
    x, y = pygame.display.get_window_position()
    path = os.path.expanduser(path or time.strftime("~/Movies/shooting_%Y%m%d_%H%M%S.mov"))
    proc = subprocess.Popen(["screencapture", "-v", "-x", "-R", f"{x},{y},{size[0]},{size[1]}", path])
    time.sleep(1.0)                          # 録画が始まってからゲームを動かす
    print(f"録画中: {path}", file=sys.stderr)
    return proc


def stop_recording(proc):
    proc.send_signal(signal.SIGINT)          # Ctrl-C と同じ。動画を保存して終わる
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()


def main():
    rec = None
    if "--rec" in sys.argv:
        i = sys.argv.index("--rec")
        rec = (sys.argv[i + 1] if i + 1 < len(sys.argv) else "") or None
        rec = rec or ""
    pygame.init()
    scale = SCALE
    try:
        dh = pygame.display.get_desktop_sizes()[0][1]
        scale = max(2, min(SCALE, (dh - 120 - HUD_H) // H))
    except Exception:
        pass
    screen = pygame.display.set_mode((W * scale, H * scale + HUD_H))
    pygame.display.set_caption("shooting")
    font = pygame.font.Font(None, 24)
    clock = pygame.time.Clock()
    proc = start_recording(screen.get_size(), rec) if rec is not None else None
    g = PGGame()
    while True:
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT or (ev.type == pygame.KEYDOWN and ev.key in (pygame.K_q, pygame.K_ESCAPE)):
                pygame.quit()
                if proc:
                    stop_recording(proc)
                return
            if ev.type == pygame.KEYDOWN and ev.key == pygame.K_r and g.state != "play":
                g = PGGame()
        if g.state == "play":
            g.read_keys(pressed_dirs(pygame.key.get_pressed()))
            g.update()
        cv, hud = g.compose()
        buf = bytes(c for row in cv.flat() for px in row for c in px)
        surf = pygame.image.frombuffer(buf, (W, H), "RGB")
        screen.blit(pygame.transform.scale(surf, (W * scale, H * scale)), (0, 0))
        pygame.draw.rect(screen, (6, 6, 22), (0, H * scale, W * scale, HUD_H))
        text = hud.replace("♥", "<3")
        screen.blit(font.render(text, True, (230, 230, 240)), (8, H * scale + 6))
        pygame.display.flip()
        clock.tick(FPS)


if __name__ == "__main__":
    main()
