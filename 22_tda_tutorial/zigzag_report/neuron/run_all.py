"""全スタック × 全パラメータでバーを計算し results.json に保存する(レポートはこれを読む)。
uv run --project ~/lab python run_all.py"""
import json, time, warnings
warnings.filterwarnings("ignore")
from neuro import *

THRS = ["huang", "li", "otsu"]
AREAS = [25, 50, 100, 200, 400, 800, 1600]


def stacks():
    for name, (ns, hum) in EXP1.items():
        yield dict(exp=1, name=name, stain="GFP" if name.startswith("Actin") else "DiI", human=hum), load_exp1(name)
    names = sorted({k for o in EXP2_OBS.values() for k in o})
    for name in names:
        st, _, _ = load_exp2(name)
        obs = {o: v[name] for o, v in EXP2_OBS.items() if name in v}
        yield dict(exp=2, name=name, stain=name[:-2], observers=obs), st


out = []
t0 = time.time()
for meta, st in stacks():
    meta["n"] = int(len(st))
    meta["shape"] = list(st.shape)
    meta["runs"] = {}
    for thr in THRS:
        for ma in AREAS:
            B, s, th, f = preprocess(st, min_area=ma, thr=thr)
            meta["runs"][f"{thr}/{ma}"] = dict(th=float(th), fg=float(B.mean()),
                                              bars=zigzag_h0_fast(B), z3d=z_extents_3d(B))
    meta["scale"] = int(f)
    out.append(meta)
    print(f"{meta['name']:12s} {st.shape} {time.time() - t0:.0f}s", flush=True)
json.dump(out, open("results.json", "w"))
