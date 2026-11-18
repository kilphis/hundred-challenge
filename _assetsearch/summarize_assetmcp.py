import json, glob, sys
for f in sorted(glob.glob("results/assetmcp_search_*.json")):
    raw = open(f).read(); body = raw[raw.index("{"):]
    d = json.loads(body)
    print("#####", d["query"])
    for src, v in d["by_source"].items():
        rs = v.get("results", [])
        err = v.get("error") or v.get("errors") or v.get("warning") or ""
        ex = "; ".join(f'{r.get("title","")[:40]} [{r.get("license") or r.get("license_name") or (r.get("license_decision") or {}).get("status","?")}]' for r in rs[:2])
        print(f"  {src:12} {len(rs)}件 {str(err)[:80]} | {ex}")
    print("  keys:", list(d.keys()))
