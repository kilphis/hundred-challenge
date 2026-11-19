# /// script
# dependencies = ["mcp>=1.20,<2"]
# ///
"""商品・ゴミ袋の3D候補を Polyfork(threenative-asset-mcp)から集め、選ぶ用の tools/candidates.json を作る(画面は tools/render_candidates.py)。
使い方: uv run tools/search_candidates.py   (35/ で実行)"""
import asyncio, json, os, html
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# 日本語名: 検索語(英語)の候補
WANT = {
 'ゴミ袋': ['garbage bag', 'trash bag'], 'おにぎり': ['rice ball', 'onigiri'], 'サンドイッチ': ['sandwich'],
 '弁当': ['bento', 'lunch box'], 'パン': ['bread', 'bun'], 'ヨーグルト': ['yogurt', 'cup'],
 'カップ麺': ['cup noodle', 'instant noodle'], 'スナック袋': ['chips bag', 'snack bag'], 'チョコ': ['chocolate bar', 'chocolate'],
 '洗剤': ['detergent', 'bottle'], 'ティッシュ': ['tissue box', 'tissue'], '電池': ['battery'], '歯ブラシ': ['toothbrush'],
 'お茶/水(ペットボトル)': ['plastic bottle', 'water bottle'], '缶コーヒー': ['can', 'soda can'], 'ジュース': ['juice', 'carton'],
 '(参考)商品棚の小物': ['grocery', 'convenience store', 'food package'],
}

async def main():
    params = StdioServerParameters(command='npx', args=['-y', 'threenative-asset-mcp'], env={**os.environ})
    out = {}
    async with stdio_client(params, errlog=open(os.devnull, 'w')) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            for jp, qs in WANT.items():
                seen = {}
                for q in qs:
                    res = await s.call_tool('polyfork_search_models', {'query': q})
                    try: items = json.loads(''.join(c.text for c in res.content if hasattr(c, 'text')))['items']
                    except Exception: items = []
                    for it in items:
                        if it['id'] not in seen and it.get('canDownloadNow'): seen[it['id']] = it
                out[jp] = list(seen.values())[:8]
                print(jp, len(out[jp]))
    json.dump(out, open('tools/candidates.json', 'w'), ensure_ascii=False, indent=1)

asyncio.run(main())
