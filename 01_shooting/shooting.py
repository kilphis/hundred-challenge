"""縦スクロール弾幕シューティング(ターミナル・ハーフブロックのドット絵)。
操作: 矢印/wasd で移動、q で終了、r でやり直し(ゲームオーバー/クリア後)。弾は自動で出る。
実行: uv run shooting.py   (端末が 128列 x 61行 より小さければ、ピクセルを縮めて収める)
"""
import math
import os
import random
import select
import shutil
import sys
import termios
import time
import tty

W, H = 128, 120          # フィールド(ピクセル)。フル表示は 128列 x 60行(旧 64x60 の 2^2 = 4倍の面積)
SX = W / 64              # 旧フィールド基準の座標(出現位置・揺れ幅)に掛ける倍率
FPS = 30
DT = 1 / FPS

# 長押しチャージ → 突進(アーマー)。キーを離した瞬間は端末では取れないので、
# 長押し = 「1回押す → 初回リピート待ち(INITIAL_MIN〜INITIAL_MAX)→ 一定間隔の速いリピート」。
# 連打はこの並びにならないので長押しと区別できる。リピートが RELEASE_GAP 途切れたら「離した」。
INITIAL_MIN = 0.2    # 1回目と2回目の間隔がこれ以上 → 初回リピート待ちとみなす
INITIAL_MAX = 1.0
FAST_MAX = 0.15      # 以降のリピート間隔の上限
RELEASE_GAP = 0.16   # これ以上間が空いたら長押し終了(突進発動)
SWITCH_WAIT = 0.65   # チャージ中に別の方向キーを押した後、その初回リピートを待つ上限
AXIS_WINDOW = 0.45   # 離した時点でこの秒数以内に押された縦/横キーを突進方向に合成(斜め)
ARMOR_GRACE = 0.2    # 突進が終わってからもアーマーが残る秒数
MIN_CHARGE = 0.4     # この秒数以上の長押しで突進が出る
MAX_CHARGE = 1.4     # チャージ上限(秒)
DASH_SPEED = 150.0   # 突進の速さ(px/秒)
DASH_DIST_MAX = 75.0               # 最大チャージ(MAX_CHARGE 到達)で離したときの距離(px)
DASH_DIST_MIN = DASH_DIST_MAX / 2  # MIN_CHARGE 以上 MAX_CHARGE 未満で離したときの距離(最大の半分)
DASH_RECOVERY = 0.3  # 突進が終わってから動けない硬直(秒)

# ---------- ドット絵データ ----------
PAL = {
    "k": (10, 10, 20), "w": (240, 240, 245), "c": (90, 200, 240), "b": (50, 100, 220),
    "r": (230, 60, 60), "R": (140, 30, 40), "y": (250, 215, 70), "g": (90, 200, 90),
    "G": (40, 120, 60), "p": (190, 90, 220), "P": (110, 50, 140), "o": (240, 150, 50),
    "h": (170, 170, 185), "H": (90, 90, 110),
}
PLAYER = ["...w...", "..cwc..", "..cwc..", ".bcwcb.", "bbcccbb", "bb.c.bb", "o.....o"]


def mirror(half):
    """左半分(中心列を含む)から左右対称のドット絵を作る。"""
    return [r + r[-2::-1] for r in half]


ENEMY_A = mirror([       # 13x13
    "rr.....",
    "rRr....",
    "rRRr...",
    "rRRRrr.",
    ".rRRRrr",
    ".rRRRRr",
    ".rRwRRr",
    "..rwwrr",
    "..rrwrr",
    "...rRrr",
    "....rRr",
    ".....rr",
    "......r",
])
ENEMY_B = mirror([       # 21x15
    "gg........",
    "gGg.......",
    "gGGg......",
    "gGGGgg....",
    ".gGGGGggg.",
    ".gGGGGGGgg",
    "..gGGwwGGg",
    "..gGwwwwGg",
    "..ggGwwGGg",
    "...ggGGGGg",
    "....ggGGGg",
    ".....ggGGg",
    "......gGGg",
    ".......ggg",
    "........gg",
])
def make_boss():
    """43x25。輪郭プロファイルから胴を作り、角・目・口・コアを重ねる。"""
    w, h, cx = 43, 25, 21
    prof = [3, 5, 7, 9, 13, 16, 19, 20, 21, 21, 21, 21, 21, 21, 21, 20, 19, 17, 15, 13, 10, 8, 6, 4, 2]
    g = [["."] * w for _ in range(h)]
    for y, hw in enumerate(prof):
        for x in range(cx - hw, cx + hw + 1):
            edge = x in (cx - hw, cx + hw) or x in (cx - hw + 1, cx + hw - 1) or y in (0, h - 1)
            g[y][x] = "p" if edge else "P"
    for k in (-1, 1):
        for y in range(0, 4):                      # 角
            for x in (cx + k * 13, cx + k * 14):
                g[y][x] = "p" if y < 3 else "P"
        for dy in range(-1, 2):                    # 目
            for dx in range(-2, 3):
                g[9 + dy][cx + k * 9 + dx] = "y"
        g[9][cx + k * 9] = "r"
        g[8][cx + k * 9] = "r"
    for y in range(12, 17):                        # コア
        for x in range(cx - 3, cx + 4):
            if abs(x - cx) + abs(y - 14) <= 3:
                g[y][x] = "h" if (x, y) != (cx, 14) else "w"
    for x in range(cx - 7, cx + 8):                # 口と歯
        g[19][x] = "R"
        g[20][x] = "w" if (x - cx) % 3 == 0 else "R"
    return ["".join(r) for r in g]


BOSS = make_boss()

for name, sp in (("PLAYER", PLAYER), ("A", ENEMY_A), ("B", ENEMY_B), ("BOSS", BOSS)):
    assert len({len(r) for r in sp}) == 1, f"{name} の行の長さが不揃い"

# ---------- 描画 ----------
BG = (6, 6, 22)


# ---------- 背景: 海の上を飛ぶ ----------
TH = 240             # 背景テクスチャの高さ(縦に繰り返す)
SCROLL = 10.0        # 海が下へ流れる速さ(px/秒)
# 弾や敵が埋もれないよう、全体に暗めの青にしてある
SEA = [(12, 30, 66), (17, 42, 88), (23, 55, 108)]   # 深い / 中間 / 浅い(うねりの3段階)
CREST = (70, 110, 160)                                # 波頭の細い線


def make_background():
    """W x TH の海。うねり(縦方向に継ぎ目なく繰り返す)を3段階に塗り分け、波頭の線をまばらに置く。位置は固定(seed)。"""
    rnd = random.Random(11)
    tau = 2 * math.pi
    g = [[SEA[0]] * W for _ in range(TH)]
    for y in range(TH):
        for x in range(W):
            v = (math.sin(tau * 3 * y / TH + x * 0.09)
                 + 0.6 * math.sin(tau * 7 * y / TH - x * 0.21 + 1.3)
                 + 0.4 * math.sin(tau * 13 * y / TH + x * 0.37 + 2.1))
            g[y][x] = SEA[0] if v < -0.35 else SEA[1] if v < 0.55 else SEA[2]
    for _ in range(70):                                # 波頭
        x, y, n = rnd.randrange(W), rnd.randrange(TH), rnd.randint(3, 7)
        for i in range(n):
            if x + i < W:
                g[y][x + i] = CREST
    return g


BACKGROUND = make_background()


def background_view(t):
    """時刻 t の背景(H 行)。下へ流れる = 見る位置が上へ進む。"""
    off = int(t * SCROLL)
    return [BACKGROUND[(y - off) % TH] for y in range(H)]


class Canvas:
    """px = 前景(BG は透明)、bg = 背景。縮小や出力のときに重ねる。"""

    def __init__(self, bg=None):
        self.px = [[BG] * W for _ in range(H)]
        self.bg = bg or [[BG] * W for _ in range(H)]

    def flat(self):
        """前景を背景に重ねた H x W の色の列。"""
        return [[f if f != BG else b for f, b in zip(fr, br)] for fr, br in zip(self.px, self.bg)]

    def put(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H:
            self.px[y][x] = c

    def blit(self, sp, cx, cy, tint=None):
        h, w = len(sp), len(sp[0])
        x0, y0 = int(cx - w / 2), int(cy - h / 2)
        for j, row in enumerate(sp):
            for i, ch in enumerate(row):
                if ch != ".":
                    self.put(x0 + i, y0 + j, tint or PAL[ch])

    def disc(self, cx, cy, r, c, core=None):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r + 1:
                    self.put(cx + dx, cy + dy, c)
        if core:
            self.put(cx, cy, core)

    def scaled(self, cols, rows):
        """端末に収まるよう縮小したピクセル列を返す。小さい弾が消えないよう、
        ブロック内に背景以外があればその色を採る。"""
        k = min(1.0, cols / W, (rows - 1) * 2 / H)
        ow, oh = max(2, int(W * k)), max(2, int(H * k) // 2 * 2)
        if (ow, oh) == (W, H):
            return self.flat()
        out = []
        for oy in range(oh):
            ys = range(oy * H // oh, max(oy * H // oh + 1, (oy + 1) * H // oh))
            row = []
            for ox in range(ow):
                xs = range(ox * W // ow, max(ox * W // ow + 1, (ox + 1) * W // ow))
                c = None
                for y in ys:
                    for x in xs:
                        if self.px[y][x] != BG:
                            c = self.px[y][x]
                if c is None:                          # 前景が無ければ背景の平均色
                    cells = [self.bg[y][x] for y in ys for x in xs]
                    c = tuple(sum(v[i] for v in cells) // len(cells) for i in range(3))
                row.append(c)
            out.append(row)
        return out

    def render(self, hud, cols, rows):
        px = self.scaled(cols, rows)
        oh, ow = len(px), len(px[0])
        out = ["\x1b[H"]
        last = None
        for y in range(0, oh, 2):
            for x in range(ow):
                top, bot = px[y][x], px[y + 1][x]
                if (top, bot) != last:
                    out.append("\x1b[38;2;%d;%d;%dm\x1b[48;2;%d;%d;%dm" % (*top, *bot))
                    last = (top, bot)
                out.append("▀")
            out.append("\x1b[0m\n")
            last = None
        out.append(hud.ljust(ow)[:cols] + "\x1b[0m")
        sys.stdout.write("".join(out))
        sys.stdout.flush()


# ---------- ゲーム ----------
class Bullet:
    def __init__(self, x, y, vx, vy, r=1, color=(255, 90, 140)):
        self.x, self.y, self.vx, self.vy, self.r, self.color = x, y, vx, vy, r, color


class Enemy:
    def __init__(self, kind, x):
        self.kind, self.x, self.y0, self.x0 = kind, x, -6.0, x
        self.y = self.y0
        self.t = 0.0
        self.hp = {"A": 3, "B": 7, "BOSS": 200}[kind]
        self.max_hp = self.hp
        self.sprite = {"A": ENEMY_A, "B": ENEMY_B, "BOSS": BOSS}[kind]
        self.cool = random.uniform(0.5, 1.5)
        self.flash = 0.0
        self.spin = 0.0

    @property
    def hw(self):
        return len(self.sprite[0]) / 2

    @property
    def hh(self):
        return len(self.sprite) / 2


def aim(src_x, src_y, dst_x, dst_y, speed):
    a = math.atan2(dst_y - src_y, dst_x - src_x)
    return math.cos(a) * speed, math.sin(a) * speed


class Dash:
    """突進の実行側。始動・直進・アーマー・硬直だけを持ち、入力のことは知らない。
    距離で管理する(最後の1フレームは残り距離ぶんだけ進むので、距離がフレームでずれない)。"""

    def __init__(self):
        self.left = 0.0              # 突進の残り距離(px)
        self.armor = 0.0             # >0 の間アーマー(突進中+余韻)
        self.recover = 0.0           # 突進後の硬直の残り時間
        self.u = (0.0, 0.0)          # 進む向き(単位ベクトル)

    t = property(lambda self: self.left / DASH_SPEED)                  # 残り時間(読み取り用)
    v = property(lambda self: (self.u[0] * DASH_SPEED, self.u[1] * DASH_SPEED))

    @property
    def active(self):
        return self.left > 1e-9

    @property
    def locked(self):
        """突進中または硬直中。入力(移動・チャージ)を受けない。"""
        return self.active or self.recover > 0

    def start(self, direction, ratio):
        """direction: 単位ベクトル、ratio: チャージ量 0..1。満タンなら最大距離、それ未満は半分(2段階)。"""
        self.left = DASH_DIST_MAX if ratio >= 1.0 else DASH_DIST_MIN
        self.armor = self.left / DASH_SPEED + ARMOR_GRACE
        self.u = direction

    def step(self, x, y):
        """直進して、移動後の座標を返す。"""
        d = min(DASH_SPEED * DT, self.left)
        self.left -= d
        if not self.active:
            self.left = 0.0
            self.recover = DASH_RECOVERY
        return min(W - 4, max(4, x + self.u[0] * d)), min(H - 4, max(4, y + self.u[1] * d))

    def tick(self):
        self.armor = max(0.0, self.armor - DT)
        if not self.active:
            self.recover = max(0.0, self.recover - DT)


class Charge:
    """チャージ入力の共通の形。Game はこの4つだけを呼ぶ。
    charge(t)    : 0..1。チャージ確定中だけ値を持つ(移動を遅くする判定に使う)
    gauge(t)     : 0..1。表示用
    direction(t) : いま離したときの突進方向(単位ベクトル)
    poll(t)      : 離されて突進が出るとき (方向, チャージ量) を1度だけ返す。それ以外は None
    """

    def key(self, idx, t):
        pass

    def charge(self, t):
        return 0.0

    def gauge(self, t):
        return self.charge(t)

    def direction(self, t):
        return 0.0, -1.0

    def poll(self, t):
        return None


class RepeatCharge(Charge):
    """端末用。キーの押下/解放が取れないので、キーリピートの並びから長押しを推測する。"""

    def __init__(self):
        self.last_dir = None    # 直前の方向キー
        self.last_key_t = -9.0
        self.stage = 0          # 0 なし / 1 押下 / 2 長押し確定(チャージ中)
        self.switched = False   # チャージ中に方向キーを切り替え、新しいキーの初回リピート待ち
        self.ax = [0, 0]        # 直近の 横(-1/+1)・縦(-1/+1) の入力
        self.axt = [-9.0, -9.0]  # それぞれを最後に受けた時刻
        self.ref_gap = None     # 長押しのリピート間隔(最初の1つを基準にする)
        self.streak = 0.0       # 長押しの秒数 = チャージ

    def key(self, idx, t):
        gap = t - self.last_key_t
        if idx == self.last_dir and gap < 0.02:   # 同じフレームに複数届いた分は数えない
            return
        axis, sign = {0: (0, -1), 1: (0, 1), 2: (1, -1), 3: (1, 1)}[idx]
        self.ax[axis], self.axt[axis] = sign, t
        if idx != self.last_dir:
            if self.stage == 2 and gap <= self.release_gap():   # チャージ中の切り替え: チャージは持ち越す
                self.switched = True
                self.streak = min(MAX_CHARGE, self.streak + gap)
                self.ref_gap = None
            else:
                self.press()
        elif self.stage == 1:                      # 2回目: 初回リピート待ちの間隔か
            if INITIAL_MIN <= gap <= INITIAL_MAX:
                self.stage, self.ref_gap, self.streak = 2, None, gap
            else:                                  # 速すぎ(連打)/遅すぎ → 押し直し
                self.press()
        elif self.switched:                        # 切り替え後の初回リピート
            if INITIAL_MIN <= gap <= INITIAL_MAX:
                self.switched, self.ref_gap = False, None
                self.streak = min(MAX_CHARGE, self.streak + gap)
            else:
                self.press()
        elif self.stage == 2:                      # リピート: 一定の速い間隔だけ長押し扱い
            if self.ref_gap is None and gap <= FAST_MAX:
                self.ref_gap = gap
            if self.ref_gap and gap <= FAST_MAX and 0.4 * self.ref_gap <= gap <= 2.0 * self.ref_gap:
                self.streak = min(MAX_CHARGE, self.streak + gap)
            else:
                self.press()
        self.last_dir, self.last_key_t = idx, t

    def press(self):
        self.stage, self.ref_gap, self.streak, self.switched = 1, None, 0.0, False

    def reset(self):
        self.press()
        self.stage, self.last_dir = 0, None

    def release_gap(self):
        return SWITCH_WAIT if self.switched else RELEASE_GAP

    def charge(self, t):
        """長押しが確定している間だけ値を持つ(連打では 0)。"""
        if self.stage != 2 or t - self.last_key_t > self.release_gap():
            return 0.0
        return min(1.0, self.streak / MAX_CHARGE)

    def direction(self, t):
        """直近 AXIS_WINDOW 秒に押された縦・横を合成(斜めあり)。"""
        v = [self.ax[i] if self.last_key_t - self.axt[i] <= AXIS_WINDOW else 0 for i in (0, 1)]
        if v == [0, 0]:
            v = [self.ax[0], 0] if self.last_dir in (0, 1) else [0, self.ax[1]]
        n = math.hypot(*v)
        return v[0] / n, v[1] / n

    def poll(self, t):
        if self.stage == 2 and t - self.last_key_t > self.release_gap():   # 長押しをやめた
            out = (self.direction(t), min(1.0, self.streak / MAX_CHARGE)) if self.streak >= MIN_CHARGE else None
            self.reset()
            return out
        return None


class Game:
    def __init__(self, charge=None):
        self.t = 0.0
        self.px, self.py = W / 2, H - 8.0
        self.vx = self.vy = 0.0
        self.hold = [0.0, 0.0, 0.0, 0.0]   # 左 右 上 下 の入力保持時間
        self.lives = 3
        self.inv = 0.0
        self.score = 0
        self.shot_cool = 0.0
        self.my = []            # 自弾 [x, y]
        self.enemies = []
        self.bullets = []
        self.spawned = set()
        self.boss = None
        self.state = "play"     # play / over / clear
        self.dash = Dash()
        self.charge_in = charge or RepeatCharge()

    # --- 出現スケジュール(秒) ---
    def schedule(self):
        plan = []
        for i in range(8):                       # 序盤: A が上から
            plan.append((2 + i * 1.6, "A", 10 + (i * 17) % 44))
        for i in range(6):                       # 中盤: B が蛇行して降りる
            plan.append((16 + i * 2.5, "B", 12 + (i * 23) % 40))
        for i in range(6):                       # 混成
            plan.append((32 + i * 1.5, "A", 8 + (i * 11) % 48))
            plan.append((33 + i * 1.5, "B", 56 - (i * 9) % 44))
        return plan

    def spawn(self):
        for i, (t, kind, x) in enumerate(self.schedule()):
            if self.t >= t and i not in self.spawned:
                self.spawned.add(i)
                self.enemies.append(Enemy(kind, x * SX))
        if self.t >= 48 and self.boss is None:
            self.boss = Enemy("BOSS", W / 2)
            self.enemies.append(self.boss)

    # --- 入力 ---
    def key(self, k):
        """端末版: 1キー入力を受ける。移動は hold、チャージ判定は charge_in へ。"""
        idx = {"a": 0, "d": 1, "w": 2, "s": 3}.get(k)
        if idx is None or self.dash.locked:     # 突進中・硬直中は入力を受けない
            return
        self.hold[idx] = 0.14
        self.charge_in.key(idx, self.t)

    # 突進まわりの値(テスト・描画用の読み取り口)
    dash_t = property(lambda self: self.dash.t)
    dash_v = property(lambda self: self.dash.v)
    armor = property(lambda self: self.dash.armor)
    charge = property(lambda self: self.charge_in.charge(self.t))   # >0 の間は移動が 0.1 倍
    gauge = property(lambda self: self.charge_in.gauge(self.t))     # 表示用

    def update(self):
        self.t += DT
        for i in range(4):
            self.hold[i] = max(0.0, self.hold[i] - DT)
        dx = (self.hold[1] > 0) - (self.hold[0] > 0)
        dy = (self.hold[3] > 0) - (self.hold[2] > 0)
        sp = 42.0 * (0.1 if self.charge > 0 else 1.0)   # チャージ中は移動 0.1 倍
        if self.dash.active:                   # 突進中は入力を受けず直進
            self.px, self.py = self.dash.step(self.px, self.py)
        elif self.dash.recover > 0:            # 硬直: 動けない
            pass
        else:
            self.px = min(W - 4, max(4, self.px + dx * sp * DT))
            self.py = min(H - 4, max(4, self.py + dy * sp * DT))
            released = self.charge_in.poll(self.t)
            if released:                       # 長押しをやめた → 突進
                self.dash.start(*released)
        self.dash.tick()
        self.inv = max(0.0, self.inv - DT)

        # 自弾(自動連射)
        self.shot_cool -= DT
        if self.shot_cool <= 0:
            self.shot_cool = 0.12
            self.my.append([self.px - 2, self.py - 4])
            self.my.append([self.px + 2, self.py - 4])
        for b in self.my:
            b[1] -= 90 * DT
        self.my = [b for b in self.my if b[1] > -3]

        self.spawn()
        for e in self.enemies:
            self.step_enemy(e)
        self.enemies = [e for e in self.enemies if e.hp > 0 and e.y < H + 8]

        for b in self.bullets:
            b.x += b.vx * DT
            b.y += b.vy * DT
        self.bullets = [b for b in self.bullets if -4 < b.x < W + 4 and -4 < b.y < H + 4]

        # 自弾 → 敵
        for b in self.my[:]:
            for e in self.enemies:
                if abs(b[0] - e.x) < e.hw and abs(b[1] - e.y) < e.hh and e.y > -2:
                    e.hp -= 1
                    e.flash = 0.06
                    self.score += 10
                    if b in self.my:
                        self.my.remove(b)
                    break
        for e in self.enemies:
            if e.hp <= 0:
                self.score += {"A": 100, "B": 300, "BOSS": 5000}[e.kind]
                if e.kind == "BOSS":
                    self.bullets.clear()
                    self.state = "clear"

        # アーマー中は触れた弾を消す(被弾しない)
        if self.armor > 0:
            self.bullets = [b for b in self.bullets
                            if (b.x - self.px) ** 2 + (b.y - self.py) ** 2 >= (b.r + 5) ** 2]

        # 被弾
        if self.inv <= 0 and self.armor <= 0 and self.state == "play":
            for b in self.bullets:
                if (b.x - self.px) ** 2 + (b.y - self.py) ** 2 < (b.r + 1.2) ** 2:
                    self.hit()
                    break
            else:
                for e in self.enemies:
                    if e.kind != "BOSS" and abs(e.x - self.px) < e.hw and abs(e.y - self.py) < e.hh:
                        self.hit()
                        break

    def hit(self):
        self.lives -= 1
        self.inv = 2.0
        self.bullets.clear()
        if self.lives <= 0:
            self.state = "over"

    # --- 敵の動きと弾幕 ---
    def step_enemy(self, e):
        e.t += DT
        e.flash = max(0.0, e.flash - DT)
        e.cool -= DT
        if e.kind == "A":                      # まっすぐ降りて、自機狙い弾
            e.y = e.y0 + e.t * 14
            if e.cool <= 0 and 4 < e.y < H - 20:
                e.cool = 1.4
                vx, vy = aim(e.x, e.y, self.px, self.py, 32)
                self.bullets.append(Bullet(e.x, e.y + e.hh, vx, vy, 1, (255, 120, 90)))
        elif e.kind == "B":                    # 蛇行して降りて、3方向弾
            e.y = e.y0 + e.t * 10
            e.x = e.x0 + math.sin(e.t * 1.8) * 12 * SX
            if e.cool <= 0 and 4 < e.y < H - 20:
                e.cool = 1.8
                for da in (-0.35, 0, 0.35):
                    a = math.pi / 2 + da
                    self.bullets.append(Bullet(e.x, e.y + e.hh, math.cos(a) * 28, math.sin(a) * 28, 1, (140, 255, 120)))
        else:
            self.step_boss(e)

    def step_boss(self, e):
        if e.y < 14:                           # 登場
            e.y += 12 * DT
            e.cool = 1.0
            return
        e.x = W / 2 + math.sin(e.t * 0.7) * 18 * SX
        ratio = e.hp / e.max_hp
        phase = 0 if ratio > 0.75 else 1 if ratio > 0.5 else 2 if ratio > 0.25 else 3
        if e.cool > 0:
            return
        if phase == 0:                         # 全方位リング
            e.cool = 1.3
            n = 20
            off = random.random()
            for i in range(n):
                a = 2 * math.pi * i / n + off
                self.bullets.append(Bullet(e.x, e.y, math.cos(a) * 24, math.sin(a) * 24, 1, (255, 90, 140)))
        elif phase == 1:                       # 回転スパイラル
            e.cool = 0.07
            e.spin += 0.45
            for k in range(2):
                a = e.spin + k * math.pi
                self.bullets.append(Bullet(e.x, e.y, math.cos(a) * 26, math.sin(a) * 26, 1, (255, 200, 80)))
        elif phase == 2:                       # 自機狙いの扇(5way)を連続
            e.cool = 0.5
            base = math.atan2(self.py - e.y, self.px - e.x)
            for da in (-0.4, -0.2, 0, 0.2, 0.4):
                a = base + da
                self.bullets.append(Bullet(e.x, e.y + e.hh * 0.6, math.cos(a) * 36, math.sin(a) * 36, 1, (120, 200, 255)))
        else:                                  # 上から降る雨 + 低速リング
            e.cool = 0.14
            e.spin += 1
            self.bullets.append(Bullet(random.uniform(2, W - 2), -2, 0, 30, 1, (200, 140, 255)))
            if int(e.spin) % 9 == 0:
                for i in range(12):
                    a = 2 * math.pi * i / 12 + e.spin * 0.1
                    self.bullets.append(Bullet(e.x, e.y, math.cos(a) * 16, math.sin(a) * 16, 2, (255, 90, 140)))

    # --- 描画 ---
    def compose(self):
        """画面を Canvas と HUD 文字列にして返す(端末版・pygame 版で共用)。"""
        cv = Canvas(background_view(self.t))
        for e in self.enemies:
            cv.blit(e.sprite, e.x, e.y, (255, 255, 255) if e.flash > 0 else None)
        for x, y in self.my:
            for j in range(3):
                cv.put(x, y + j, PAL["y"])
        if self.state != "over" and (self.inv <= 0 or int(self.t * 12) % 2 == 0):
            ch = self.gauge
            tint = (255, 255, 255) if self.dash_t > 0 else None
            if self.armor > 0:                     # アーマー: 周りに白い輪
                for k in range(32):
                    a = 2 * math.pi * k / 32
                    cv.put(self.px + math.cos(a) * 8, self.py + math.sin(a) * 8, (200, 240, 255))
            elif ch > 0:                           # チャージ: 輪が MAX_CHARGE 秒で一周する
                ready = MIN_CHARGE / MAX_CHARGE    # 突進が出る境目(輪の上の白い目印)
                if ch >= 1.0:
                    col = (255, 255, 255) if int(self.t * 10) % 2 == 0 else (255, 120, 60)
                elif ch >= ready:
                    col = (255, 220, 90)
                else:
                    col = (120, 140, 200)
                steps = 48
                for k in range(int(steps * ch + 0.999)):
                    a = 2 * math.pi * k / steps - math.pi / 2
                    for r in (8, 9):
                        cv.put(self.px + math.cos(a) * r, self.py + math.sin(a) * r, col)
                a = 2 * math.pi * ready - math.pi / 2
                for r in (10, 11):
                    cv.put(self.px + math.cos(a) * r, self.py + math.sin(a) * r, (255, 255, 255))
                ux, uy = self.charge_in.direction(self.t)   # 離したときの突進方向の目印
                for r in (13, 15, 17):
                    cv.put(self.px + ux * r, self.py + uy * r, col)
            cv.blit(PLAYER, self.px, self.py, tint)
            cv.put(self.px, self.py, (255, 60, 60))   # 当たり判定の位置
        for b in self.bullets:
            cv.disc(int(b.x), int(b.y), b.r, b.color, (255, 255, 255))
        if self.boss and self.boss.hp > 0:        # ボスHPバー
            n = int((W - 4) * self.boss.hp / self.boss.max_hp)
            for x in range(n):
                cv.put(2 + x, 1, PAL["r"])
        hud = f" SCORE {self.score:6d}   LIFE {'♥' * self.lives:<3}"
        if self.state == "over":
            hud += "   GAME OVER  (r: retry, q: quit)"
        elif self.state == "clear":
            hud += "   CLEAR!  (r: retry, q: quit)"
        return cv, hud

    def draw(self):
        cv, hud = self.compose()
        cols, rows = shutil.get_terminal_size()
        if (cols, rows) != getattr(self, "_size", None):   # 端末サイズが変わったら画面を消す
            self._size = (cols, rows)
            sys.stdout.write("\x1b[2J")
        cv.render(hud, cols, rows)


def main():
    cols, rows = shutil.get_terminal_size()
    if cols < 20 or rows < 8:
        sys.exit(f"端末が小さすぎます(今は {cols}x{rows})。20列 x 8行 以上にしてください")
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    sys.stdout.write("\x1b[?1049h\x1b[?25l\x1b[2J")
    try:
        tty.setcbreak(fd)
        g = Game()
        nxt = time.time()
        while True:
            while select.select([fd], [], [], 0)[0]:
                data = os.read(fd, 64).decode(errors="ignore")
                i = 0
                while i < len(data):
                    ch = data[i]
                    if data[i:i + 3] in ("\x1b[A", "\x1b[B", "\x1b[C", "\x1b[D"):
                        ch = {"A": "w", "B": "s", "C": "d", "D": "a"}[data[i + 2]]
                        i += 2
                    i += 1
                    ch = ch.lower()
                    if ch == "q":
                        return
                    if ch == "r" and g.state != "play":
                        g = Game()
                    else:
                        g.key(ch)
            if g.state == "play":
                g.update()
            g.draw()
            nxt += DT
            time.sleep(max(0.0, nxt - time.time()))
            if time.time() - nxt > 0.5:
                nxt = time.time()
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
        sys.stdout.write("\x1b[?25h\x1b[?1049l")


if __name__ == "__main__":
    main()
