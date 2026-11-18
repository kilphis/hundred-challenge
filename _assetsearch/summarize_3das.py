import json, glob, collections
for f in sorted(glob.glob("results/3das_search_*.txt")):
    raw=open(f).read(); d=json.loads(raw[raw.index("{"):])
    rs=d["results"]; c=collections.Counter(r["source"] for r in rs)
    free=sum(1 for r in rs if r.get("free")); lic=sum(1 for r in rs if r.get("license")); dl=sum(1 for r in rs if r.get("downloadable"))
    print(f'## {d["query"]}: {len(rs)}件 free={free} license記載={lic} DL可={dl}')
    print("   ", dict(c))
    for r in rs[:6]: print(f'    - [{r["source"]}] {r["title"][:50]} | {r.get("type")} | free={r.get("free")} lic={r.get("license")} dl={r.get("downloadable")}')
    extra={k:str(v)[:200] for k,v in d.items() if k not in("query","results")}
    if extra: print("   extra:",extra)
