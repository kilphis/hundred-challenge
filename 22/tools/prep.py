# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "scipy", "pooch", "ripser"]
# ///
"""実データ → data.js(点群) と tools/ref.json(ripserによる正解バーコード)を作る。
uv run tools/prep.py
"""
import json, pathlib
import numpy as np
from scipy import datasets
from ripser import ripser

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"


def fps(X, n, seed=0):
    """farthest point sampling: 形を保ったまま点を n 個に間引く"""
    idx = [seed]
    d = np.linalg.norm(X - X[seed], axis=1)
    for _ in range(n - 1):
        i = int(d.argmax())
        idx.append(i)
        d = np.minimum(d, np.linalg.norm(X - X[i], axis=1))
    return X[idx]


def circle(n, noise, seed):
    """チュートリアル用の円(半径1, z=0)。noise は半径方向・接線方向まとめた標準偏差"""
    rng = np.random.default_rng(seed)
    t = 2 * np.pi * (np.arange(n) / n if noise == 0 else rng.random(n))
    X = np.stack([np.cos(t), np.sin(t), np.zeros(n)], 1)
    X[:, :2] += rng.normal(0, noise, (n, 2))
    return X


def ecg():
    # MIT-BIH Arrhythmia Database record 208 の一部(360Hz)。scipy 同梱
    s = datasets.electrocardiogram()
    seg = s[int(360 * 60):int(360 * 64.4)]  # 60秒目から4.4秒
    tau = 30  # 83ms の遅れ
    X = np.stack([seg[:-2 * tau], seg[tau:-tau], seg[2 * tau:]], 1)
    return fps(X, 170), seg, tau


def bunny():
    lines = (RAW / "bunny/reconstruction/bun_zipper_res2.ply").read_text().splitlines()
    n = int(next(l for l in lines if l.startswith("element vertex")).split()[-1])
    st = lines.index("end_header") + 1
    X = np.array([[float(v) for v in l.split()[:3]] for l in lines[st:st + n]])
    return fps(X, 180) * 100  # m → cm


def ubiquitin():
    X = [[float(l[30:38]), float(l[38:46]), float(l[46:54])]
         for l in (RAW / "1UBQ.pdb").read_text().splitlines()
         if l.startswith("ATOM") and l[12:16].strip() == "CA"]
    return np.array(X)


def iris():
    rows = [l.split(",") for l in (RAW / "iris.data").read_text().splitlines() if l.strip()]
    # がく片の長さ・花弁の長さ・花弁の幅 (cm)
    return np.array([[float(r[0]), float(r[2]), float(r[3])] for r in rows]), [r[4].replace("Iris-", "") for r in rows]


SETS = []
SETS.append(dict(id="circle", name="円(きれいな16点)", unit="", note="半径1の円周に等間隔で16点。チュートリアル用の人工データ。",
    src="tools/prep.py で生成", X=circle(16, 0, 0)))
SETS.append(dict(id="noisy", name="ノイズ入りの円(80点)", unit="", note="半径1の円周にランダムに80点を置き、標準偏差0.15の正規ノイズを足した人工データ(seed 0)。",
    src="tools/prep.py で生成", X=circle(80, 0.15, 0)))
X, seg, tau = ecg()
SETS.append(dict(id="ecg", name="心電図(遅れ座標埋め込み)", unit="mV",
    note="MIT-BIH Arrhythmia DB #208 の60〜64.4秒(360Hz)を τ=83ms で (x(t), x(t+τ), x(t+2τ)) に埋め込み、FPSで170点。拍動の繰り返しが『輪』になる。",
    src="scipy.datasets.electrocardiogram()", X=X,
    signal=np.round(seg, 3).tolist(), fs=360, tau=tau))
X = bunny()
SETS.append(dict(id="bunny", name="スタンフォード・バニー(3Dスキャン)", unit="cm",
    note="Stanford 3D Scanning Repository の bun_zipper_res2(レンジスキャナ実測)から FPS で180点。",
    src="graphics.stanford.edu/data/3Dscanrep", X=X))
X = ubiquitin()
SETS.append(dict(id="ubq", name="ユビキチン Cα 原子", unit="Å",
    note="PDB 1UBQ(X線結晶構造, 1.8Å)の主鎖 Cα 76個。主鎖の折り畳み(βシート・αヘリックス)が輪を作る。",
    src="rcsb.org/structure/1UBQ", X=X))
X, lab = iris()
SETS.append(dict(id="iris", name="アヤメ(Fisher 1936)", unit="cm",
    note="UCI Iris 150株。軸 = がく片の長さ・花弁の長さ・花弁の幅。setosa だけ離れた塊になる(H0)。",
    src="archive.ics.uci.edu/dataset/53/iris", X=X, labels=lab))

out, ref = [], {}
for d in SETS:
    X = d.pop("X")
    c = X.mean(0)
    s = np.abs(X - c).max()  # 表示用に [-1,1] へ。scale で元の単位に戻す
    d["scale"] = float(s)
    d["center"] = np.round(c, 5).tolist()
    d["points"] = np.round((X - c) / s, 5).flatten().tolist()
    out.append(d)
    Y = np.array(d["points"]).reshape(-1, 3)
    D = np.linalg.norm(Y[:, None] - Y[None], axis=2)
    r = ripser(D, distance_matrix=True, maxdim=1)
    ref[d["id"]] = [[[a, None if np.isinf(b) else b] for a, b in dg.tolist()] for dg in r["dgms"]]
    print(d["id"], len(Y), "H1 bars:", len(r["dgms"][1]),
          "top H1:", sorted((float(b - a) for a, b in r["dgms"][1]), reverse=True)[:3])

(ROOT / "data.js").write_text("// tools/prep.py が生成(実データ)\nwindow.DATASETS=" + json.dumps(out, ensure_ascii=False) + ";\n")
(ROOT / "tools/ref.json").write_text(json.dumps(ref))
