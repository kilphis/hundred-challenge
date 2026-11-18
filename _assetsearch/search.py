# /// script
# dependencies = ["httpx"]
# ///
"""キー不要の公開 API だけで CC0 素材を横断検索する(MCP を使わない版)。
使い方: uv run search.py "tree" [--kind model|texture|audio] [--n 5] [--json]
"""
import argparse, json, sys, time
import httpx

UA = {"User-Agent": "kilphy-assetsearch/0.1 (personal game prototyping)"}


def polyhaven(q, kind, n):
    t = {"model": "models", "texture": "textures"}.get(kind)
    if not t:
        return []
    assets = httpx.get(f"https://api.polyhaven.com/assets?t={t}", headers=UA, timeout=30).json()
    words = q.lower().split()
    hits = [
        (k, v) for k, v in assets.items()
        if all(any(w in s.lower() for s in [k, v["name"], *v.get("tags", []), *v.get("categories", [])]) for w in words)
    ]
    hits.sort(key=lambda kv: -kv[1].get("download_count", 0))
    return [{
        "src": "polyhaven", "id": k, "title": v["name"], "license": "CC0",
        "page": f"https://polyhaven.com/a/{k}",
        "thumb": f"https://cdn.polyhaven.com/asset_img/thumbs/{k}.png?width=256",
    } for k, v in hits[:n]]


def ambientcg(q, kind, n):
    if kind not in ("texture", "model"):
        return []
    typ = {"texture": "Material", "model": "3DModel"}[kind]
    r = httpx.get("https://ambientcg.com/api/v2/full_json", headers=UA, timeout=30,
                  params={"q": q, "type": typ, "limit": n, "include": "imageData"}).json()
    return [{
        "src": "ambientcg", "id": a["assetId"], "title": a.get("displayName", a["assetId"]), "license": "CC0",
        "page": f"https://ambientcg.com/a/{a['assetId']}",
        "thumb": (a.get("previewImage") or {}).get("256-PNG") or (a.get("previewImage") or {}).get("128-PNG"),
    } for a in r.get("foundAssets", [])]


def openverse_audio(q, kind, n):
    if kind != "audio":
        return []
    r = httpx.get("https://api.openverse.org/v1/audio/", headers=UA, timeout=30,
                  params={"q": q, "license": "cc0,pdm", "page_size": n}).json()
    return [{
        "src": f"openverse/{a.get('source')}", "id": a["id"], "title": a["title"],
        "license": a["license"].upper(), "page": a["foreign_landing_url"], "file": a.get("url"),
        "duration_s": round((a.get("duration") or 0) / 1000, 1), "creator": a.get("creator"),
    } for a in r.get("results", [])]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("query"); p.add_argument("--kind", default="model", choices=["model", "texture", "audio"])
    p.add_argument("--n", type=int, default=5); p.add_argument("--json", action="store_true")
    a = p.parse_args()
    out = {}
    for f in (polyhaven, ambientcg, openverse_audio):
        t0 = time.time()
        try:
            res = f(a.query, a.kind, a.n)
            if res or f.__name__ in ("polyhaven", "ambientcg") and a.kind != "audio" or f.__name__ == "openverse_audio" and a.kind == "audio":
                out[f.__name__] = {"sec": round(time.time() - t0, 1), "results": res}
        except Exception as e:
            out[f.__name__] = {"error": repr(e)[:200]}
    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=1)); return
    for name, v in out.items():
        print(f"## {name} ({v.get('sec', '-')}s) {v.get('error', '')}")
        for r in v.get("results", []):
            extra = f" {r['duration_s']}s" if "duration_s" in r else ""
            print(f"  - [{r['license']}] {r['title'][:50]}{extra}  {r['page']}")


if __name__ == "__main__":
    sys.exit(main())
