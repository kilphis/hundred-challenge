# /// script
# dependencies = ["httpx"]
# ///
"""search.py --json の結果から先頭の音源を img/ に落とす(報告用)。"""
import json, httpx, pathlib
for name, f in [("coin","results/api_coin_audio.json"),("dungeon","results/api_dungeon_music_audio.json"),("explosion","results/api_explosion_audio.json")]:
    r = json.load(open(f))["openverse_audio"]["results"][0]
    resp = httpx.get(r["file"], follow_redirects=True, timeout=60, headers={"User-Agent":"kilphy-assetsearch/0.1"})
    ext = r["file"].rsplit(".",1)[-1][:4]
    p = pathlib.Path(f"img/{name}.{ext}"); p.write_bytes(resp.content)
    print(name, resp.status_code, resp.headers.get("content-type"), len(resp.content), "|", r["title"], "|", r["creator"], "|", r["page"], "|", r["file"])
