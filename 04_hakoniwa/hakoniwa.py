# /// script
# requires-python = ">=3.10"
# dependencies = ["pygame-ce"]
# ///
"""箱庭ゲーム。敵を倒す → 鍵を拾う → 鍵付きの扉を開ける → ゴールの部屋へ。
鍵は分岐先の部屋にいる、鍵を持って逃げる敵が持っている。
設計は oot_design.md に従う:
  - 行き先は扉が持たず、表(EXITS → ENTRANCES)が持つ
  - 扉を開ける主導権はプレイヤー側。扉は表示と当たり判定だけ
  - 施錠は「永続フラグ」(FLAGS)で持ち、扉の見た目は毎フレーム FLAGS から決める
  - 遷移は「予約 → フェードアウト → 実行 → フェードイン」
実行: uv run hakoniwa.py
操作: 矢印/wasd 移動、Space 攻撃、E 鍵を拾う・スイッチを押す、r やり直し、Esc 終了
"""
import math
import sys

import pygame

W, H = 640, 480
TS = 32

# ---- データ表 -------------------------------------------------------------
# 5部屋とも同じ大きさ。扉は左右の壁。
ROOM_RECT = pygame.Rect(64, 64, 512, 352)
L, R_ = 96, 544  # 左右の扉のx


def door(id_, x, y, kind="normal"):
    return {"id": id_, "pos": (x, y), "kind": kind}


# enemies: (種類, 位置)
#   "melee"(追いかけて体当たり) / "ranged"(動かず弾を撃つ) / "thief"(鍵を持っていて逃げる。倒すと鍵を落とす)
# rivers: 通れない水。bridges: 川の上に架かる橋。switch の番号のスイッチを押すと使える
ROOMS = {
    "start": {
        "doors": [door(0, R_, 208)],
        "enemies": [("melee", (300, 150)), ("melee", (300, 330))],
    },
    "river": {
        "doors": [door(0, L, 208), door(1, R_, 208)],
        "enemies": [("melee", (210, 330)), ("melee", (230, 150)), ("ranged", (480, 330)), ("ranged", (480, 100))],
        "rivers": [pygame.Rect(290, 64, 60, 352)],
        "bridges": [{"rect": pygame.Rect(290, 180, 60, 70), "switch": 0}],
        "switches": [{"id": 0, "pos": (130, 110)}],
    },
    # 分岐の部屋: 右上の扉 → river2(ゴール側)、右下の扉 → vault(鍵の部屋)
    "mid": {
        "doors": [door(0, L, 208), door(1, R_, 120), door(2, R_, 350)],
        "enemies": [("melee", (300, 120)), ("melee", (300, 340)), ("ranged", (430, 215)), ("ranged", (210, 340))],
    },
    "vault": {
        "doors": [door(0, L, 208)],
        "enemies": [("thief", (420, 208))],
    },
    "river2": {
        "doors": [door(0, L, 120), door(1, R_, 350, "locked")],
        "enemies": [("melee", (420, 130)), ("ranged", (200, 360)), ("melee", (460, 330)), ("ranged", (500, 100))],
        "rivers": [pygame.Rect(64, 210, 512, 50)],
        "bridges": [{"rect": pygame.Rect(300, 200, 64, 70), "switch": 0}],
        "switches": [{"id": 0, "pos": (200, 110)}],
    },
    "goal": {
        "doors": [door(0, L, 208)],
        "enemies": [],
    },
}
for _r in ROOMS.values():
    _r["rect"] = ROOM_RECT
    _r.setdefault("rivers", [])
    _r.setdefault("bridges", [])
    _r.setdefault("switches", [])

# 出口表: (部屋, 扉id) → 入口番号
# 地図:  start ─ river ─ mid ─┬─ river2 ─(鍵付き扉)─ goal
#                             └─ vault(鍵を持った逃げる敵)
EXITS = {
    ("start", 0): 1,
    ("river", 0): 2, ("river", 1): 3,
    ("mid", 0): 4, ("mid", 1): 5, ("mid", 2): 6,
    ("vault", 0): 8,
    ("river2", 0): 7, ("river2", 1): 9,
    ("goal", 0): 10,
}
# 入口表: 入口番号 → (部屋, プレイヤーの出現位置)
ENTRANCES = {
    0: ("start", (120, 240)),
    1: ("river", (150, 208)),
    2: ("start", (490, 208)),
    3: ("mid", (150, 208)),
    4: ("river", (490, 208)),
    5: ("river2", (150, 120)),
    6: ("vault", (150, 208)),
    7: ("mid", (490, 120)),
    8: ("mid", (490, 350)),
    9: ("goal", (150, 208)),
    10: ("river2", (490, 350)),
}
GOAL_POS = (440, 240)

# 永続フラグ(部屋を出入りしても残る)
FLAGS = set()
KEYPOS = {}  # 部屋 → 落ちた鍵の位置


def reset_flags():
    FLAGS.clear()
    KEYPOS.clear()


def water_at(room, x, y):
    data = ROOMS[room]
    if not any(r.collidepoint(x, y) for r in data["rivers"]):
        return False
    for b in data["bridges"]:
        if ("switch", room, b["switch"]) in FLAGS and b["rect"].collidepoint(x, y):
            return False
    return True


def walkable(room, x, y, r):
    pts = [(x, y)] + [(x + r * math.cos(a * math.pi / 4), y + r * math.sin(a * math.pi / 4)) for a in range(8)]
    return not any(water_at(room, px, py) for px, py in pts)


def move(room, obj, dx, dy):
    """軸ごとに動かして、水と部屋の外に入らない"""
    rect = ROOM_RECT
    nx = min(max(obj.x + dx, rect.left + obj.R), rect.right - obj.R)
    if walkable(room, nx, obj.y, obj.R):
        obj.x = nx
    ny = min(max(obj.y + dy, rect.top + obj.R), rect.bottom - obj.R)
    if walkable(room, obj.x, ny, obj.R):
        obj.y = ny


# ---- ゲームオブジェクト ---------------------------------------------------
class Player:
    SPEED = 3
    R = 12

    def __init__(self, pos):
        self.x, self.y = pos
        self.face = (1, 0)
        self.hp = 3
        self.has_key = False
        self.atk_t = 0       # 攻撃の残りフレーム
        self.inv_t = 0       # 無敵の残りフレーム

    def attack_box(self):
        fx, fy = self.face
        cx, cy = self.x + fx * 26, self.y + fy * 26
        return pygame.Rect(cx - 16, cy - 16, 32, 32)


class Enemy:
    R = 12

    def __init__(self, idx, kind, pos):
        self.idx, self.kind = idx, kind
        self.x, self.y = pos
        self.hp = 3 if kind == "melee" else 2
        self.hit_t = 0
        self.ang = 0.0
        self.plan_t = 0
        self.shot_t = 60 + idx * 25  # 次の発射までのフレーム


THIEF_SPEED = 2.6


THIEF_SPEED = 2.7  # プレイヤー(3.0)より少し遅い。壁際に追い詰めないと捕まらない


def flee_angle(room, e, p):
    """逃げる向きを選ぶ。16方向それぞれに15フレーム動いてみて(プレイヤーはまっすぐ追う)、
    その時点で「自分の方が先に着ける場所」がどれだけ残っているか(陣地の広さ)で採点する。
    角や壁際は陣地が狭くなるので避け、広い側へ回り込む。4フレームに1回だけ選び直す。"""
    if e.plan_t > 0:
        e.plan_t -= 1
        return e.ang
    e.plan_t = 3
    rect = ROOM_RECT
    lo_x, hi_x = rect.left + e.R, rect.right - e.R
    lo_y, hi_y = rect.top + e.R, rect.bottom - e.R
    grid = [(lo_x + (hi_x - lo_x) * i / 13, lo_y + (hi_y - lo_y) * j / 9) for i in range(14) for j in range(10)]
    grid = [g for g in grid if not water_at(room, g[0], g[1])]
    wet = bool(ROOMS[room]["rivers"])
    best, best_s = e.ang, -1e9
    for i in range(16):
        a = i * math.pi / 8
        ca, sa = math.cos(a) * THIEF_SPEED, math.sin(a) * THIEF_SPEED
        x, y, qx, qy = e.x, e.y, p.x, p.y
        for _ in range(15):
            nx = min(max(x + ca, lo_x), hi_x)
            ny = min(max(y + sa, lo_y), hi_y)
            if not wet or walkable(room, nx, ny, e.R):
                x, y = nx, ny
            d = math.hypot(x - qx, y - qy) or 1
            qx += (x - qx) / d * p.SPEED
            qy += (y - qy) / d * p.SPEED
        area = sum(1 for gx, gy in grid
                   if math.hypot(gx - x, gy - y) / THIEF_SPEED + 8 < math.hypot(gx - qx, gy - qy) / p.SPEED)
        sc = area * 10 + math.hypot(x - qx, y - qy) * 0.2
        if abs((a - e.ang + math.pi) % (2 * math.pi) - math.pi) < 0.5:
            sc += 5
        if sc > best_s:
            best, best_s = a, sc
    return best


class Shot:
    R = 5
    SPEED = 3.5

    def __init__(self, x, y, tx, ty):
        d = math.hypot(tx - x, ty - y) or 1
        self.x, self.y = x, y
        self.vx, self.vy = (tx - x) / d * self.SPEED, (ty - y) / d * self.SPEED


class KeyItem:
    def __init__(self, pos):
        self.x, self.y = pos


class Game:
    def __init__(self):
        reset_flags()
        self.player = Player((0, 0))
        self.enter(0)
        self.fade = 0.0           # 0=透明 1=真っ黒
        self.pending = None       # 予約された入口番号
        self.phase = "play"       # play / out / in
        self.cleared = False

    # 部屋に入る
    def enter(self, entrance):
        self.room, spawn = ENTRANCES[entrance]
        self.player.x, self.player.y = spawn
        data = ROOMS[self.room]
        self.shots = []
        self.enemies = [
            Enemy(i, k, pos) for i, (k, pos) in enumerate(data["enemies"])
            if ("dead", self.room, i) not in FLAGS
        ]
        self.key = None
        if self.room in KEYPOS and "key_taken" not in FLAGS:
            self.key = KeyItem(KEYPOS[self.room])

    # 遷移の予約(誰が呼んでもよい)
    def request_transition(self, entrance):
        if self.phase == "play":
            self.pending = entrance
            self.phase = "out"

    def door_rect(self, d):
        return pygame.Rect(d["pos"][0] - 16, d["pos"][1] - 32, 32, 64)

    def update(self, keys):
        # 遷移の進行(予約されたものをフェード後に実行)
        if self.phase == "out":
            self.fade += 0.05
            if self.fade >= 1:
                self.fade = 1
                self.enter(self.pending)
                self.pending = None
                self.phase = "in"
            return
        if self.phase == "in":
            self.fade -= 0.05
            if self.fade <= 0:
                self.fade = 0
                self.phase = "play"
            return

        p = self.player
        data = ROOMS[self.room]

        # 移動
        dx = (keys[pygame.K_RIGHT] or keys[pygame.K_d]) - (keys[pygame.K_LEFT] or keys[pygame.K_a])
        dy = (keys[pygame.K_DOWN] or keys[pygame.K_s]) - (keys[pygame.K_UP] or keys[pygame.K_w])
        if dx or dy:
            n = math.hypot(dx, dy)
            p.face = (dx / n, dy / n)
            move(self.room, p, dx / n * p.SPEED, dy / n * p.SPEED)

        if p.atk_t > 0:
            p.atk_t -= 1
        if p.inv_t > 0:
            p.inv_t -= 1

        def hurt():
            p.hp -= 1
            p.inv_t = 60
            if p.hp <= 0:
                self.__init__()
                return True
            return False

        # 敵
        for e in list(self.enemies):
            vx, vy = p.x - e.x, p.y - e.y
            dist = math.hypot(vx, vy) or 1
            if e.kind == "thief":
                ang = flee_angle(self.room, e, p)
                e.ang = ang
                move(self.room, e, math.cos(ang) * THIEF_SPEED, math.sin(ang) * THIEF_SPEED)
            if e.hit_t > 0:
                e.hit_t -= 1
                if e.kind == "melee":
                    move(self.room, e, -vx / dist * 4, -vy / dist * 4)  # ノックバック
            elif e.kind == "melee":
                move(self.room, e, vx / dist * 1.2, vy / dist * 1.2)
            elif e.kind == "ranged":
                e.shot_t -= 1
                if e.shot_t <= 0:
                    e.shot_t = 100
                    self.shots.append(Shot(e.x, e.y, p.x, p.y))
            # 攻撃が当たる
            if p.atk_t > 0 and e.hit_t == 0 and p.attack_box().colliderect(
                pygame.Rect(e.x - e.R, e.y - e.R, e.R * 2, e.R * 2)
            ):
                e.hp -= 1
                e.hit_t = 10
                if e.hp <= 0:
                    self.enemies.remove(e)
                    FLAGS.add(("dead", self.room, e.idx))
                    if e.kind == "thief":
                        KEYPOS[self.room] = (e.x, e.y)
                        self.key = KeyItem((e.x, e.y))
            # 体当たり(近接のみ)
            elif e.kind == "melee" and dist < p.R + e.R and p.inv_t == 0:
                if hurt():
                    return

        # 飛び道具
        for s in list(self.shots):
            s.x += s.vx
            s.y += s.vy
            if not ROOM_RECT.collidepoint(s.x, s.y):
                self.shots.remove(s)
            elif p.inv_t == 0 and math.hypot(p.x - s.x, p.y - s.y) < p.R + s.R:
                self.shots.remove(s)
                if hurt():
                    return

        # 扉: 主導権はプレイヤー側。扉の範囲に触れ、鍵を持っていれば開けて遷移を予約する
        prect = pygame.Rect(p.x - p.R, p.y - p.R, p.R * 2, p.R * 2)
        for d in data["doors"]:
            if prect.colliderect(self.door_rect(d).inflate(8, 8)):
                flag = ("unlocked", self.room, d["id"])
                if d["kind"] == "locked" and flag not in FLAGS and p.has_key:
                    FLAGS.add(flag)
                    p.has_key = False
                if flag in FLAGS or d["kind"] != "locked":
                    self.request_transition(EXITS[(self.room, d["id"])])

        # ゴール
        if self.room == "goal" and math.hypot(p.x - GOAL_POS[0], p.y - GOAL_POS[1]) < 24:
            self.cleared = True

    def on_key(self, key):
        p = self.player
        if self.phase != "play":
            return
        if key == pygame.K_SPACE and p.atk_t == 0:
            p.atk_t = 10
        elif key == pygame.K_e:
            if self.key and math.hypot(p.x - self.key.x, p.y - self.key.y) < 40:
                p.has_key = True
                FLAGS.add("key_taken")
                self.key = None
                return
            for sw in ROOMS[self.room]["switches"]:
                if math.hypot(p.x - sw["pos"][0], p.y - sw["pos"][1]) < 40:
                    FLAGS.add(("switch", self.room, sw["id"]))

    # ---- 描画 ----
    def draw(self, scr, font):
        scr.fill((20, 20, 28))
        data = ROOMS[self.room]
        room = ROOM_RECT
        pygame.draw.rect(scr, (60, 60, 80), room.inflate(16, 16))
        pygame.draw.rect(scr, (110, 100, 80), room)

        for r in data["rivers"]:
            pygame.draw.rect(scr, (50, 110, 200), r)
        for b in data["bridges"]:
            if ("switch", self.room, b["switch"]) in FLAGS:
                pygame.draw.rect(scr, (150, 100, 50), b["rect"])
                for x in range(b["rect"].left + 6, b["rect"].right, 12):
                    pygame.draw.line(scr, (100, 65, 30), (x, b["rect"].top), (x, b["rect"].bottom), 2)
        for sw in data["switches"]:
            on = ("switch", self.room, sw["id"]) in FLAGS
            pygame.draw.rect(scr, (90, 200, 120) if on else (220, 70, 70),
                             (sw["pos"][0] - 10, sw["pos"][1] - 10, 20, 20))

        for d in data["doors"]:
            opened = ("unlocked", self.room, d["id"]) in FLAGS
            col = (90, 200, 120) if (opened or d["kind"] != "locked") else (160, 90, 40)
            pygame.draw.rect(scr, col, self.door_rect(d))
        if self.room == "goal":
            pygame.draw.circle(scr, (255, 220, 80), GOAL_POS, 16)

        if self.key:
            pygame.draw.circle(scr, (255, 220, 40), (int(self.key.x), int(self.key.y)), 8)
        for e in self.enemies:
            if e.hit_t:
                col = (255, 255, 255)
            else:
                col = {"melee": (200, 60, 60), "ranged": (170, 60, 200), "thief": (60, 190, 120)}[e.kind]
            pygame.draw.circle(scr, col, (int(e.x), int(e.y)), e.R)
            if e.kind == "thief":  # 鍵を持っている印
                pygame.draw.circle(scr, (255, 220, 40), (int(e.x), int(e.y)), 5)
        for s in self.shots:
            pygame.draw.circle(scr, (255, 140, 60), (int(s.x), int(s.y)), s.R)

        p = self.player
        if p.inv_t % 6 < 3:
            pygame.draw.circle(scr, (80, 160, 255), (int(p.x), int(p.y)), p.R)
        if p.atk_t > 0:
            pygame.draw.rect(scr, (255, 255, 255), p.attack_box(), 2)

        hud = f"HP {p.hp}   {'KEY' if p.has_key else ''}"
        scr.blit(font.render(hud, True, (255, 255, 255)), (12, 10))

        if self.fade > 0:
            s = pygame.Surface((W, H))
            s.set_alpha(int(self.fade * 255))
            scr.blit(s, (0, 0))
        if self.cleared:
            t = font.render("GOAL!  r でやり直し", True, (255, 255, 255))
            scr.blit(t, t.get_rect(center=(W // 2, H // 2)))



# SysFont は macOS で存在しないパスを探して落ちるので、ファイルを直接開く
FONT_PATHS = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
]


def load_font(size):
    for path in FONT_PATHS:
        try:
            return pygame.font.Font(path, size)
        except (FileNotFoundError, OSError):
            continue
    return pygame.font.Font(None, size)


def main():
    pygame.init()
    scr = pygame.display.set_mode((W, H))
    pygame.display.set_caption("hakoniwa")
    font = load_font(22)
    clock = pygame.time.Clock()
    g = Game()
    while True:
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT or (ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE):
                return
            if ev.type == pygame.KEYDOWN:
                if ev.key == pygame.K_r:
                    g = Game()
                else:
                    g.on_key(ev.key)
        if not g.cleared:
            g.update(pygame.key.get_pressed())
        g.draw(scr, font)
        pygame.display.flip()
        clock.tick(60)


if __name__ == "__main__":
    sys.exit(main())
