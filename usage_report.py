"""百チャレのセッション記録(~/.claude/projects/*hundred-challenge*)から、日ごとの消費を集計する。
uv run --no-project usage_report.py
"""
import collections, glob, json, os, re

base = os.path.expanduser("~/.claude/projects")
dirs = [d for d in os.listdir(base) if "hundred-challenge" in d.lower()]

def day(d):
    m = re.search(r"challenge-?(?:day)?(\d+)", d)
    return int(m.group(1)) if m else 0

print("day | 開始 | 往復 | 平均文脈 | 最大文脈 | 画像Read | サブ数 | 出力k | キャッシュ読込M | モデル")
total = 0
for d in sorted(dirs, key=day):
    first = None; msgs = 0; ctx = []; out = cr = 0; img = 0; agents = 0
    models = collections.Counter()
    for f in glob.glob(f"{base}/{d}/**/*.jsonl", recursive=True):
        seen = set()
        for line in open(f, errors="ignore"):
            try: o = json.loads(line)
            except json.JSONDecodeError: continue
            ts = o.get("timestamp")
            if ts and (first is None or ts < first): first = ts
            if o.get("type") != "assistant": continue
            m = o["message"]
            for x in m.get("content") or []:
                if isinstance(x, dict) and x.get("type") == "tool_use":
                    if x["name"] == "Read" and re.search(r"\.(png|jpe?g|webp)$", x["input"].get("file_path", "")): img += 1
                    if x["name"] == "Agent": agents += 1
            if m.get("id") in seen: continue
            seen.add(m.get("id")); msgs += 1
            u = m.get("usage") or {}
            ctx.append(u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0))
            out += u.get("output_tokens", 0); cr += u.get("cache_read_input_tokens", 0)
            models[(m.get("model") or "?").replace("claude-", "")] += 1
    total += cr
    name = d.split("challenge")[-1].lstrip("-") or "root"
    avg = sum(ctx) // max(1, len(ctx))
    print(f"{name} | {str(first)[:10]} | {msgs} | {avg//1000}k | {max(ctx, default=0)//1000}k | {img} | {agents} | {out//1000} | {cr/1e6:.1f} | {dict(models.most_common(2))}")
print(f"合計キャッシュ読込 {total/1e6:.1f}M")
