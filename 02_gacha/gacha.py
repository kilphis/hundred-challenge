"""ガチャ。Enter で1回引く。q で終了。端末のANSIエフェクト(24bit色)。
実行: uv run gacha.py
"""
import colorsys
import math
import random
import shutil
import sys
import time

FPS = 30
# (レア度, 排出率%, 基調色, 粒数, 演出秒数, 画面揺れ)
RARITIES = [
    ("N",   60, (170, 170, 170),  25, 1.6, 0),
    ("R",   30, (80, 160, 255),   70, 2.2, 1),
    ("SR",   9, (255, 200, 40),  170, 3.0, 2),
    ("SSR",  1, None,            420, 4.5, 3),   # None = 虹色
]
ITEMS = {r[0]: [f"{r[0]}-{i}" for i in (1, 2, 3)] for r in RARITIES}  # 景品は仮
CHARS = "*+·✦✧★☆◆●"
ESC = "\x1b"


def rainbow(t):
    r, g, b = colorsys.hsv_to_rgb(t % 1.0, 0.85, 1.0)
    return int(r * 255), int(g * 255), int(b * 255)


def fg(c):
    return f"{ESC}[38;2;{c[0]};{c[1]};{c[2]}m"


def bg(c):
    return f"{ESC}[48;2;{c[0]};{c[1]};{c[2]}m"


class Screen:
    def __init__(self):
        self.w, self.h = shutil.get_terminal_size()
        self.h -= 1
        self.clear((0, 0, 0))

    def clear(self, color):
        self.cells = [[(" ", None, color)] * self.w for _ in range(self.h)]

    def put(self, x, y, ch, color, bgc=None):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.cells[y][x] = (ch, color, bgc if bgc else self.cells[y][x][2])

    def text(self, cx, y, s, colorfn, bgc=None):
        x0 = cx - len(s) // 2
        for i, ch in enumerate(s):
            if ch != " ":
                self.put(x0 + i, y, ch, colorfn(i), bgc)

    def render(self, shake=0):
        out = [f"{ESC}[H"]
        dx = random.randint(-shake, shake) if shake else 0
        dy = random.randint(-shake // 2, shake // 2) if shake else 0
        for y in range(self.h):
            row = self.cells[(y + dy) % self.h]
            line, last = [], None
            for x in range(self.w):
                ch, f, b = row[(x + dx) % self.w]
                if (f, b) != last:
                    line.append(bg(b) + (fg(f) if f else ""))
                    last = (f, b)
                line.append(ch)
            out.append("".join(line) + f"{ESC}[0m\n")
        sys.stdout.write("".join(out))
        sys.stdout.flush()


class Particle:
    def __init__(self, x, y, color, fast):
        a = random.uniform(0, math.tau)
        v = random.uniform(2, 30 if fast else 18)
        self.x, self.y = x, y
        self.vx, self.vy = math.cos(a) * v * 2, math.sin(a) * v   # 横は2倍(文字のアスペクト比)
        self.life = random.uniform(0.8, 2.2)
        self.color = color
        self.ch = random.choice(CHARS)

    def step(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.vy += 14 * dt
        self.life -= dt


def pull():
    rarity = random.choices(RARITIES, weights=[r[1] for r in RARITIES])[0]
    return rarity, random.choice(ITEMS[rarity[0]])


def play(rarity, item):
    name, _, base, n, dur, shake = rarity
    scr = Screen()
    cx, cy = scr.w // 2, scr.h // 2
    color_of = (lambda t: rainbow(t)) if base is None else (lambda t: base)
    parts = []
    charge = dur * 0.35
    t0 = time.time()
    burst = False
    sys.stdout.write(f"{ESC}[?25l{ESC}[2J")
    while (t := time.time() - t0) < dur:
        scr.clear((0, 0, 0))
        if t < charge:                                    # 溜め: 画面が明滅、中央に光が集まる
            k = t / charge
            flash = int(60 * k * (1 + math.sin(t * 40)) / 2)
            scr.clear((flash, flash, flash))
            for _ in range(int(3 + 20 * k)):
                a = random.uniform(0, math.tau)
                r = (1 - k) * scr.h
                scr.put(cx + math.cos(a) * r * 2, cy + math.sin(a) * r, "·", color_of(a / math.tau + t))
            scr.text(cx, cy, "◆ ◆ ◆", lambda i: color_of(t * 2 + i / 5))
            scr.render(shake=int(k * 2))
        else:
            if not burst:                                 # 爆発: 全画面ホワイトアウト + 粒を放射
                burst = True
                parts = [Particle(cx, cy, color_of(random.random()), shake >= 2) for _ in range(n)]
                scr.clear((255, 255, 255))
                scr.render(shake=shake * 3)
                time.sleep(0.06)
                continue
            since = t - charge
            if shake >= 2 and int(since * 12) % 2 == 0 and since < 1.5:   # 余韻の色フラッシュ
                c = color_of(since)
                scr.clear((c[0] // 5, c[1] // 5, c[2] // 5))
            if shake >= 3 and random.random() < 0.5:      # SSR: 上から降り注ぐ
                parts += [Particle(random.uniform(0, scr.w), 0, rainbow(random.random()), False)
                          for _ in range(6)]
            for p in parts:
                p.step(1 / FPS)
                col = tuple(int(v * min(1, p.life)) for v in p.color)
                scr.put(p.x, p.y, p.ch, col)
            parts = [p for p in parts if p.life > 0]
            for r in range(-2, 3):                        # 放射リング
                ring = since * 40
                for i in range(0, 360, 12):
                    a = math.radians(i)
                    scr.put(cx + math.cos(a) * (ring + r) * 2, cy + math.sin(a) * (ring + r) * 0.5,
                            "o", color_of(i / 360 + since)) if ring < scr.h else None
            if since > 0.3:
                grow = min(1, (since - 0.3) / 0.4)
                label = f"★ {name} ★" if name != "N" else name
                box = f" {label}  {item} "
                width = len(box) + 2
                for yy in (cy - 2, cy + 2):
                    scr.text(cx, yy, "═" * int(width * grow), lambda i: color_of(t * 2 + i / 20), (0, 0, 0))
                scr.text(cx, cy, box if grow >= 1 else box[: int(len(box) * grow)],
                         lambda i: color_of(t * 3 + i / 12), (0, 0, 0))
            scr.render(shake=shake if since < 0.8 else 0)
        time.sleep(1 / FPS)
    sys.stdout.write(f"{ESC}[0m{ESC}[2J{ESC}[H{ESC}[?25h")
    sys.stdout.flush()


def main():
    count = 0
    while input("Enterで引く (q で終了) > ").strip().lower() != "q":
        count += 1
        rarity, item = pull()
        try:
            play(rarity, item)
        finally:
            sys.stdout.write(f"{ESC}[0m{ESC}[?25h")
        c = rainbow(time.time()) if rarity[2] is None else rarity[2]
        print(f"{fg(c)}[{count}回目] {rarity[0]}: {item}{ESC}[0m")


if __name__ == "__main__":
    main()
