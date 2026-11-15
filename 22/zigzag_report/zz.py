"""シリアル画像(2D スライスの列)のジグザグ持続ホモロジー。

S_0 → S_0∪S_1 ← S_1 → S_1∪S_2 ← ... を時刻 0,1,2,... に並べる(偶数=スライス, 奇数=和集合)。
各スライスは前景ピクセルの 8 近傍クリーク複体(2x2 ブロックは四面体まで埋める)。
"""
import itertools
import numpy as np
import dionysus as d

def presence(stack):
    """時刻 t(0..2n-2) にピクセルが存在するか: shape (2n-1, H, W)"""
    n = len(stack)
    P = np.zeros((2 * n - 1,) + stack.shape[1:], bool)
    P[0::2] = stack
    P[1::2] = stack[:-1] | stack[1:]
    return P

def cliques(H, W):
    """格子の 8 近傍クリーク複体の全単体(頂点 = y*W+x)。"""
    idx = lambda y, x: y * W + x
    out = set()
    for y in range(H):
        for x in range(W):
            out.add((idx(y, x),))
    for y in range(H - 1):
        for x in range(W - 1):
            blk = [idx(y, x), idx(y, x + 1), idx(y + 1, x), idx(y + 1, x + 1)]
            for k in (2, 3, 4):
                for c in itertools.combinations(blk, k):
                    out.add(tuple(sorted(c)))
    return out

def intervals(mask_t):
    """bool 列 → [(開始, 終了)] (両端含む)"""
    m = np.concatenate([[False], mask_t, [False]]).astype(int)
    dm = np.diff(m)
    return list(zip(np.where(dm == 1)[0], np.where(dm == -1)[0] - 1))

def zigzag(stack):
    """stack: (n, H, W) bool。戻り値: {次元: [(birth_t, death_t)]}(t は上の時刻、death は最後に生きていた時刻)"""
    P = presence(stack)
    T, H, W = P.shape
    flat = P.reshape(T, -1)
    alive = flat.any(0)
    simplices, times = [], []
    for s in sorted(cliques(H, W), key=lambda s: (len(s), s)):
        if not alive[list(s)].all():
            continue
        m = flat[:, list(s)].all(1)
        iv = intervals(m)
        if not iv:
            continue
        k = len(s) - 1
        ts = []
        for a, b in iv:  # 面→余面の順に入れ、余面→面の順に抜く
            ts += [a + 0.001 * k, b + 0.5 - 0.001 * k]
        simplices.append(list(s))
        times.append(ts)
    f = d.Filtration(simplices)
    # Filtration は内部でソートし得るので times を単体で引き直す
    tmap = {tuple(s): t for s, t in zip(simplices, times)}
    times = [tmap[tuple(sorted(sx))] for sx in f]
    _, dgms, _ = d.zigzag_homology_persistence(f, times)
    res = {}
    for dim, dg in enumerate(dgms):
        bars = []
        for p in dg:
            # 挿入は整数時刻の直後、削除は半整数の直前に置いたので、
            # 「最初/最後に存在した整数時刻」に丸める。どの整数時刻にも存在しないものは捨てる
            b = int(np.ceil(p.birth - 0.01))
            dd = T - 1 if np.isinf(p.death) else int(np.floor(p.death - 0.01))
            if b <= dd:
                bars.append((b, dd))
        res[dim] = bars
    return res, T


def zigzag_h0(stack):
    """H0 だけのジグザグ(頂点 + 8 近傍の辺だけを使う。H0 は 1 骨格で決まる)。
    戻り値: [(birth_t, death_t)](zigzag と同じ時刻の数え方)"""
    P = presence(stack)
    T, H, W = P.shape
    flat = P.reshape(T, -1)
    idx = np.arange(H * W).reshape(H, W)
    pairs = [(idx[:, :-1], idx[:, 1:]), (idx[:-1, :], idx[1:, :]),
             (idx[:-1, :-1], idx[1:, 1:]), (idx[:-1, 1:], idx[1:, :-1])]
    E = np.concatenate([np.stack([a.ravel(), b.ravel()], 1) for a, b in pairs])
    E.sort(1)
    V = np.where(flat.any(0))[0]
    E = E[flat[:, E[:, 0]].any(0) & flat[:, E[:, 1]].any(0)]
    Pe = flat[:, E[:, 0]] & flat[:, E[:, 1]]
    E, Pe = E[Pe.any(0)], Pe[:, Pe.any(0)]
    simplices, times = [], []
    for k, (items, pres) in enumerate([(V[:, None], flat[:, V]), (E, Pe)]):
        pad = np.zeros((1, pres.shape[1]), np.int8)
        dm = np.diff(np.concatenate([pad, pres.astype(np.int8), pad]), axis=0)
        for j in range(len(items)):
            a = np.where(dm[:, j] == 1)[0]
            b = np.where(dm[:, j] == -1)[0] - 1
            ts = np.empty(2 * len(a))
            ts[0::2] = a + 0.001 * k
            ts[1::2] = b + 0.5 - 0.001 * k
            simplices.append(items[j].tolist())
            times.append(ts.tolist())
    f = d.Filtration(simplices)
    tmap = {tuple(s): t for s, t in zip(simplices, times)}
    times = [tmap[tuple(sorted(sx))] for sx in f]
    _, dgms, _ = d.zigzag_homology_persistence(f, times)
    bars = []
    for p in dgms[0]:
        b = int(np.ceil(p.birth - 0.01))
        dd = T - 1 if np.isinf(p.death) else int(np.floor(p.death - 0.01))
        if b <= dd:
            bars.append((b, dd))
    return bars


def zigzag_h0_fast(stack):
    """zigzag_h0 と同じバーを、塊を1点に縮めた小さなグラフで求める。
    奇数時刻 2i+1 では、和集合の同じ連結成分に入る S_i・S_{i+1} の塊どうしを鎖でつなぐ。
    H0 は「どの塊がどの塊に入るか」だけで決まるので、バーコードは変わらない。"""
    from skimage import measure
    n = len(stack)
    labs = [measure.label(s, connectivity=2) for s in stack]
    offs = np.cumsum([0] + [l.max() for l in labs])  # 塊 (i, k) の頂点番号 = offs[i] + k - 1
    T = 2 * n - 1
    simplices, times = [], []
    for i in range(n):  # 塊の頂点: 時刻 2i-1 .. 2i+1 に存在
        a, b = max(2 * i - 1, 0), min(2 * i + 1, T - 1)
        for k in range(labs[i].max()):
            simplices.append([int(offs[i] + k)])
            times.append([a, b + 0.5])
    edges = {}
    for i in range(n - 1):
        U = measure.label(stack[i] | stack[i + 1], connectivity=2)
        groups = {}
        for j in (i, i + 1):
            L = labs[j]
            ks = np.unique(L[L > 0])
            for k in ks:
                u = U[L == k][0]
                groups.setdefault(u, []).append(int(offs[j] + k - 1))
        for g in groups.values():
            for p, q in zip(g, g[1:]):
                # 同じ辺が別の i でも出るので、時刻を1つの単体にまとめる
                edges.setdefault((min(p, q), max(p, q)), []).extend(
                    [2 * i + 1 + 0.001, 2 * i + 1 + 0.5 - 0.001])
    for e, ts in edges.items():
        simplices.append(list(e))
        times.append(ts)
    if not simplices:
        return []
    f = d.Filtration(simplices)
    tmap = {tuple(s): t for s, t in zip(simplices, times)}
    times = [tmap[tuple(sorted(sx))] for sx in f]
    _, dgms, _ = d.zigzag_homology_persistence(f, times)
    bars = []
    for p in dgms[0]:
        b = int(np.ceil(p.birth - 0.01))
        dd = T - 1 if np.isinf(p.death) else int(np.floor(p.death - 0.01))
        if b <= dd:
            bars.append((b, dd))
    return bars
