"""Mata et al. 2015 の再現用: データ読み込み・前処理・人の数えた値。"""
import glob, os, sys
import numpy as np
import tifffile
from scipy import ndimage as ndi
from skimage import measure, morphology, transform

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from zz import zigzag_h0_fast  # noqa: E402
from skimage import filters

D = os.path.join(os.path.dirname(__file__), "data")

# --- 検証資料 NeuronZigzagJvalidation.pdf の表を手で写したもの ---
# 実験1 (Figure 1): ファイル名 -> (スライス数, 人が数えた主な成分の数)
EXP1 = {
    "Actin01": (4, 1), "Actin02": (6, 1), "Actin03": (4, 2), "Actin04": (5, 1),
    "Actin05": (8, 1), "Actin06": (4, 2), "Actin07": (4, 1), "Actin08": (5, 1),
    "Actin09": (3, 1), "Actin10": (5, 1), "Actin11": (5, 1), "Actin12": (5, 2),
    "R3N2S2C3": (26, 2), "R3N2S2C5": (26, 2), "R3PbR1N1C3": (40, 3), "R3pBR1N1C4": (59, 3),
    "R3PbR1N1C5": (59, 3), "R3PbR1N1C6": (59, 1), "R3PbR1N1C7": (59, 2), "R3PbR1N1C8": (59, 4),
    "R1S8C5": (44, 2), "R1S8C2": (40, 1), "R1S8C4": (44, 2),
}
# 実験2 (Figures 4-6): 観察者ごとに {画像: (元画像で数えた樹状突起数, プラグイン出力で数えた数)}
_o1 = dict(DiI01=(2, 2), DiI02=(2, 2), DiI04=(5, 3), DiI05=(4, 3), DiI06=(3, 3), DiI07=(4, 5), DiI08=(10, 8),
           DiI09=(2, 2), DiI10=(2, 2), DiI12=(1, 1), DiI13=(2, 2), DiI14=(18, 10), DiI16=(2, 2), DiI17=(1, 1),
           GFP01=(2, 2), GFP03=(1, 1), GFP04=(2, 2), GFP05=(3, 1), GFP06=(1, 1), GFP07=(1, 1), GFP09=(1, 2),
           GFP10=(2, 2), GFP12=(1, 2), GFP14=(2, 2), GFP16=(2, 1), GFP17=(1, 1), GFP18=(2, 1), GFP19=(2, 2), GFP20=(1, 1))
_o2 = dict(DiI01=(2, 2), DiI05=(2, 4), DiI07=(3, 3), DiI08=(4, 6), DiI10=(2, 2), DiI13=(2, 2), DiI17=(2, 2),
           DiI18=(3, 2), DiI19=(1, 1), DiI20=(2, 2), DiI21=(2, 2), DiI23=(1, 2),
           GFP01=(2, 2), GFP04=(2, 2), GFP06=(1, 1), GFP08=(1, 1), GFP09=(1, 1), GFP11=(1, 1), GFP13=(2, 2),
           GFP14=(2, 2), GFP15=(2, 2), GFP16=(2, 2), GFP19=(1, 1), GFP21=(1, 1), GFP23=(2, 2), GFP26=(1, 2),
           GFP28=(2, 2), GFP29=(3, 3), GFP30=(1, 1))
_o3 = dict(DiI01=(3, 3), DiI02=(2, 2), DiI03=(3, 3), DiI10=(2, 2), DiI11=(1, 1), DiI12=(1, 2), DiI15=(1, 1),
           DiI22=(2, 2), DiI24=(2, 2), DiI25=(1, 1), DiI26=(4, 5), DiI27=(2, 2), DiI28=(2, 3), DiI29=(2, 2), DiI30=(2, 3),
           GFP02=(3, 3), GFP05=(3, 3), GFP06=(1, 1), GFP07=(3, 3), GFP09=(1, 2), GFP10=(2, 2), GFP14=(2, 2),
           GFP16=(3, 3), GFP17=(2, 1), GFP19=(1, 1), GFP22=(1, 1), GFP24=(2, 2), GFP25=(1, 1), GFP27=(1, 1), GFP29=(3, 3))
EXP2_OBS = {"観察者1": _o1, "観察者2": _o2, "観察者3": _o3}


def load_exp1(name):
    f = glob.glob(f"{D}/images_experiment1/*/{name}.tif")[0]
    return tifffile.imread(f)


def load_exp2(name):
    """name: 'DiI01' など。(スタック, 最大値投影, プラグイン出力 or None) を返す。
    フォルダによってファイル名が違う。Substack (a-b).tif があればそれ(作者が範囲を切り出したもの)を使う。
    最大値投影が無ければ自分で作る。"""
    kind, num = name[:-2], name[-2:]
    d = f"{D}/images_experiment2/{kind}/{kind}_{num}"
    tifs = [os.path.basename(f) for f in glob.glob(f"{d}/*.tif")]
    body = [t for t in tifs if not t.startswith("MAX_") and t != "Result_Image.tif"]
    sub = [t for t in body if t.startswith("Substack")]
    f = sub[0] if sub else (f"{kind}_{num}.tif" if f"{kind}_{num}.tif" in body else body[0])
    st = tifffile.imread(f"{d}/{f}")
    res = tifffile.imread(f"{d}/Result_Image.tif") if "Result_Image.tif" in tifs else None
    return st, st.max(0), res


def huang(img):
    """Huang の fuzzy 閾値(ImageJ の Huang と同じ考え方)。8bit 画像の閾値を返す"""
    h = np.bincount(img.ravel(), minlength=256).astype(float)
    nz = np.nonzero(h)[0]
    first, last = nz[0], nz[-1]
    if first == last:
        return first
    g = np.arange(256, dtype=float)
    C = 1.0 / (last - first)
    best, th = np.inf, first
    for t in range(first, last):
        lo, hi = h[first:t + 1], h[t + 1:last + 1]
        if lo.sum() == 0 or hi.sum() == 0:
            continue
        m0 = (g[first:t + 1] * lo).sum() / lo.sum()
        m1 = (g[t + 1:last + 1] * hi).sum() / hi.sum()
        mu0 = 1 / (1 + C * np.abs(g[first:t + 1] - m0))
        mu1 = 1 / (1 + C * np.abs(g[t + 1:last + 1] - m1))
        ent = lambda mu: -(mu * np.log(mu) + (1 - mu) * np.log(np.clip(1 - mu, 1e-12, None)))
        e = (lo * ent(mu0)).sum() + (hi * ent(mu1)).sum()
        if e < best:
            best, th = e, t
    return th


THRESH = {"huang": huang, "li": filters.threshold_li, "otsu": filters.threshold_otsu}


def preprocess(stack, max_side=512, median=3, min_area=20, thr="huang"):
    """縮小 → スライスごとのメディアン → スタック全体で1つの閾値 → 小さい塊を除く。
    min_area は縮小後のピクセル数。"""
    if stack.dtype != np.uint8:  # 16bit のスタックは最大値で 8bit に揃える
        stack = np.round(stack / stack.max() * 255).astype(np.uint8)
    f = max(1, int(np.ceil(max(stack.shape[1:]) / max_side)))
    s = transform.downscale_local_mean(stack.astype(float), (1, f, f)).round().astype(np.uint8) if f > 1 else stack
    s = np.stack([ndi.median_filter(x, size=median) for x in s])
    th = THRESH[thr](s)
    B = s > th
    B = np.stack([morphology.remove_small_objects(b, max_size=min_area, connectivity=2) for b in B])
    return B, s, th, f


def n_long(bars, min_len):
    """min_len 枚以上続くバーの本数(長さは「生きていたスライスの枚数」)"""
    return sum(1 for a, e in bars if (e // 2 - (a + 1) // 2 + 1) >= min_len)


def z_extents_3d(B):
    """比較用: 3D 連結成分(26 近傍)ごとの z 方向の枚数"""
    L = measure.label(B, connectivity=3)
    return [int(r.bbox[3] - r.bbox[0]) for r in measure.regionprops(L)]
