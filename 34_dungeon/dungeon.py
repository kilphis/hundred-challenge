import random
import sys            # Enterなし入力: 標準入力の判定・読み取りに使う
import termios        # Enterなし入力: 端末の設定を保存・復元する
import tty            # Enterなし入力: 1文字ずつ受け取るモード(setcbreak)
from collections import deque

W, H = 20, 10
D = {"w": (0, -1), "s": (0, 1), "a": (-1, 0), "d": (1, 0)}
PRICES = {"薬": 30, "鎧": 40}                      # ハッシュ: 商人の品書き
KEYS = {"紫": 129, "橙": 208}                      # ハッシュ: 鍵・扉の色


# ---------- データ構造 ----------
class Node:                                        # 木
    def __init__(self, value, kids=()):
        self.value, self.kids = value, list(kids)

    def total(self):
        return self.value + sum(k.total() for k in self.kids)

    def count(self):
        return 1 + sum(k.count() for k in self.kids)


def make_tree(depth):
    kids = [make_tree(depth - 1) for _ in range(random.randint(0, 2))] if depth else []
    return Node(random.randint(5, 15), kids)


class Graph:                                       # グラフ(隣接リスト)
    def __init__(self):
        self.adj = {}

    def link(self, a, b):
        self.adj.setdefault(a, []).append(b)
        self.adj.setdefault(b, []).append(a)


class Player:
    def __init__(self):
        self.hp, self.gold, self.armor, self.pos = 20, 0, 0, (-1, -1)
        self.keys = {}                             # ハッシュ: 色 -> 本数
        self.poison = deque()                      # キュー: 毒ダメージの順番待ち


# ---------- オブジェクト ----------
# on_step の返り値: True=消えて進む / False=残して進む / None=進めない
class Obj:
    color, glyph = 255, "  "

    def on_step(self, g):
        return True

    def tick(self, g):
        pass


class Gold(Obj):
    color = 220

    def on_step(self, g):
        g.p.gold += 10
        return True


class Heal(Obj):
    color = 46

    def on_step(self, g):
        g.p.hp = min(20, g.p.hp + 8)
        return True


class Stairs(Obj):
    def on_step(self, g):
        g.depth += 1
        g.new_floor()
        g.msgs.append(f"B{g.depth}F へ降りた")
        return False


class Monster(Obj):
    color, dmg = 196, (1, 5)

    def on_step(self, g):
        g.hurt(random.randint(*self.dmg))
        g.msgs.append("敵を倒した")
        return True


class Gate(Obj):                                   # グラフ1: つながった先の門へ飛ぶ
    color = 51

    def on_step(self, g):
        g.p.pos = random.choice(g.graph.adj[self]).pos
        g.msgs.append("ワープした")
        return False


class Slime(Monster):                              # グラフ2: マス目グラフを幅優先で追ってくる
    color, dmg = 118, (2, 2)

    def tick(self, g):
        step = g.chase(self.pos)
        if step == g.p.pos:
            g.hurt(2)
            g.msgs.append("スライムに体当たりされた")
            g.remove(self)
        elif step:
            g.move(self, step)


class Chest(Obj):                                  # 木1: 入れ子の宝箱を全部開ける
    color = 130

    def __init__(self):
        self.tree = make_tree(2)

    def on_step(self, g):
        g.p.gold += self.tree.total()
        g.msgs.append(f"箱を開けた! {self.tree.count()}個入っていて {self.tree.total()}G")
        return True


class Goblin(Monster):                             # 木2: 倒すと子ノードの数だけ分裂
    def __init__(self, node):
        self.node = node
        self.color = 160 if node.kids else 174

    def on_step(self, g):
        super().on_step(g)
        for kid in self.node.kids:
            cells = g.near_free(self.pos)
            if cells:
                g.add(Goblin(kid), random.choice(cells))
        return True


class Swamp(Obj):                                  # キュー1: 踏むと3ターン毒の列に並ぶ
    color = 22

    def on_step(self, g):
        g.p.poison.extend([1, 1, 1])
        g.msgs.append("毒の沼! 3ターン痛む")
        return False


class Nest(Obj):                                   # キュー2: 待機中の敵を4ターンごとに1匹ずつ出す
    color = 90

    def __init__(self):
        self.waiting = deque([Monster, Monster, Monster])

    def tick(self, g):
        cells = g.near_free(self.pos)
        if g.turn % 4 == 0 and self.waiting and cells:
            g.add(self.waiting.popleft()(), random.choice(cells))

    def on_step(self, g):
        g.msgs.append("巣を壊した")
        return True


class Key(Obj):                                    # ハッシュ1: 鍵(色ごとに本数を数える)
    def __init__(self, name):
        self.name, self.color, self.glyph = name, KEYS[name], "k "

    def on_step(self, g):
        g.p.keys[self.name] = g.p.keys.get(self.name, 0) + 1
        return True


class Door(Obj):
    def __init__(self, name):
        self.name, self.color = name, KEYS[name]

    def on_step(self, g):
        if g.p.keys.get(self.name):
            g.p.keys[self.name] -= 1
            return True
        g.msgs.append(f"{self.name}の鍵が要る")
        return None


class Merchant(Obj):                               # ハッシュ2: 品書き(品名 -> 値段)
    color = 213

    def on_step(self, g):
        items = list(PRICES)
        print("商人: " + " ".join(f"{i + 1}:{n}{PRICES[n]}G" for i, n in enumerate(items)))
        c = input("買う番号(他でやめる) > ").strip()
        if c.isdigit() and 1 <= int(c) <= len(items):
            name = items[int(c) - 1]
            if g.p.gold >= PRICES[name]:
                g.p.gold -= PRICES[name]
                if name == "薬":
                    g.p.hp = min(20, g.p.hp + 10)
                else:
                    g.p.armor += 1
                g.msgs.append(f"{name}を買った")
            else:
                g.msgs.append("お金が足りない")
        return None


# ---------- ゲーム本体 ----------
class Game:
    def __init__(self):
        self.p, self.depth, self.turn, self.msgs = Player(), 1, 0, []
        self.new_floor()

    def new_floor(self):
        self.wall = {(x, y) for x in range(W) for y in range(H) if random.random() < 0.2}
        self.objs, self.p.pos = {}, (-1, -1)       # ハッシュ: 座標 -> オブジェクト
        self.p.pos = self.free()
        n = self.depth
        for o in [Stairs(), Heal(), Chest(), Slime(), Nest(), Merchant(), Goblin(Node(2, [Node(1), Node(1)]))]:
            self.add(o)
        for o in [Gold() for _ in range(3)] + [Monster() for _ in range(2 + n)] + [Swamp(), Swamp()]:
            self.add(o)
        for name in KEYS:
            self.add(Key(name))
            self.add(Door(name))
        gates = [self.add(Gate()) for _ in range(4)]
        self.graph = Graph()
        for a, b in [(0, 1), (1, 2), (2, 3), (1, 3)]:
            self.graph.link(gates[a], gates[b])

    def is_open(self, c):
        return 0 <= c[0] < W and 0 <= c[1] < H and c not in self.wall

    def free(self):
        while True:
            c = (random.randrange(W), random.randrange(H))
            if self.is_open(c) and c not in self.objs and c != self.p.pos:
                return c

    def near_free(self, pos):
        cs = [(pos[0] + dx, pos[1] + dy) for dx, dy in D.values()]
        return [c for c in cs if self.is_open(c) and c not in self.objs and c != self.p.pos]

    def add(self, obj, pos=None):
        obj.pos = pos or self.free()
        self.objs[obj.pos] = obj
        return obj

    def remove(self, obj):
        if self.objs.get(obj.pos) is obj:
            del self.objs[obj.pos]

    def move(self, obj, pos):
        self.remove(obj)
        self.add(obj, pos)

    def hurt(self, n):
        self.p.hp -= max(1, n - self.p.armor)

    def chase(self, start):                        # 幅優先探索: 自分への最短経路の1歩目
        goal, prev, q = self.p.pos, {start: None}, deque([start])
        while q and goal not in prev:
            c = q.popleft()
            for dx, dy in D.values():
                n = (c[0] + dx, c[1] + dy)
                if n not in prev and (n == goal or (self.is_open(n) and n not in self.objs)):
                    prev[n] = c
                    q.append(n)
        if goal not in prev:
            return None
        while prev[goal] != start:
            goal = prev[goal]
        return goal

    def step(self, dx, dy):
        old, t = self.p.pos, (self.p.pos[0] + dx, self.p.pos[1] + dy)
        if not self.is_open(t):
            return
        obj = self.objs.get(t)
        self.p.pos = t
        r = obj.on_step(self) if obj else False
        if r is None:
            self.p.pos = old
            return
        if r:
            self.remove(obj)
        self.turn += 1
        if self.p.poison:
            self.p.hp -= self.p.poison.popleft()
        for o in list(self.objs.values()):
            if self.objs.get(o.pos) is o:
                o.tick(self)


def block(color, glyph="  "):
    return f"\033[48;5;{color}m\033[38;5;16m{glyph}\033[0m"


def show(g):
    for y in range(H):
        row = ""
        for x in range(W):
            if (x, y) == g.p.pos:
                row += block(39)
            elif (x, y) in g.objs:
                row += block(g.objs[x, y].color, g.objs[x, y].glyph)
            else:
                row += block(244 if (x, y) in g.wall else 236)
        print(row)
    print("青=自分 白=階段 黄=金貨 赤=敵 緑=回復 水=ワープ門 黄緑=スライム 茶=宝箱 濃赤/桃赤=分裂敵 暗緑=毒沼 暗紫=巣 桃=商人 k=鍵(同色の四角=扉)")
    print(f"B{g.depth}F  HP:{g.p.hp}  Gold:{g.p.gold}  鎧:{g.p.armor}  鍵:{g.p.keys}  毒:{len(g.p.poison)}")
    print("\n".join(g.msgs))
    g.msgs.clear()


def getkey():                                      # Enter なしで1キー読む(端末のときだけ)
    if not sys.stdin.isatty():
        return input().strip().lower()[:1]
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setcbreak(fd)
        return sys.stdin.read(1).lower()
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


def main():
    g = Game()
    while g.p.hp > 0:
        show(g)
        print("(wasd/q) > ", end="", flush=True)
        k = getkey()   # Enterなし入力: ここで1キー読む
        print()
        if k == "q":
            break
        if k in D:
            g.step(*D[k])
    print(f"ゲーム終了  B{g.depth}F 到達 / Gold {g.p.gold}")


if __name__ == "__main__":
    main()
