"""サブエージェントの作業記録(JSONL)から、モデルjsの途中版と作業の経過を取り出す。

使い方: uv run --no-project _3dkit/history.py <出力先> <名前>=<jsonl>:<対象jsの絶対パス>:<関数名>[:<pose>] ...
出力: <出力先>/<名前>/vNN.js(途中版) と <出力先>/history.json(経過)
Write/Edit だけを再生する。Bash の sed 等での書き換えは拾えない(経過に「Bash」として残る)。
"""
import json, os, sys
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))


def load(path):
    return [json.loads(l) for l in open(path) if l.strip()]


def short(s, n=160):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


def replay(jsonl, target):
    rows = load(jsonl)
    errors = set()
    for r in rows:
        c = r.get("message", {}).get("content")
        if isinstance(c, list):
            for b in c:
                if b.get("type") == "tool_result" and b.get("is_error"):
                    errors.add(b.get("tool_use_id"))
    t0 = None
    text, versions, events = None, [], []
    for r in rows:
        if r.get("type") != "assistant":
            continue
        ts = datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00")).astimezone(JST)
        t0 = t0 or ts
        for b in r["message"].get("content", []):
            ev = {"time": ts.strftime("%H:%M:%S"), "elapsed": int((ts - t0).total_seconds())}
            if b.get("type") == "text" and b["text"].strip():
                events.append({**ev, "kind": "note", "text": short(b["text"], 300)})
            if b.get("type") != "tool_use":
                continue
            name, inp = b["name"], b["input"]
            failed = b["id"] in errors
            fp = inp.get("file_path", "")
            if name in ("Write", "Edit") and os.path.abspath(fp) == target:
                if failed:
                    events.append({**ev, "kind": "error", "text": f"{name} 失敗"})
                    continue
                before = text
                if name == "Write":
                    text = inp["content"]
                    desc = f"全体を書く({text.count(chr(10)) + 1}行)"
                else:
                    if text is None or inp["old_string"] not in text:
                        events.append({**ev, "kind": "error", "text": "Edit を再生できない(元の文字列なし)"})
                        continue
                    text = text.replace(inp["old_string"], inp["new_string"]) if inp.get("replace_all") \
                        else text.replace(inp["old_string"], inp["new_string"], 1)
                    d = inp["new_string"].count("\n") - inp["old_string"].count("\n")
                    desc = f"一部を書き換え({d:+d}行): {short(inp['new_string'].strip().splitlines()[0] if inp['new_string'].strip() else '(削除)', 90)}"
                versions.append(text)
                events.append({**ev, "kind": "edit", "version": len(versions), "text": desc,
                               "lines": text.count("\n") + 1, "first": before is None})
            elif name == "Bash":
                cmd = inp.get("command", "")
                kind = "shot" if "shot.sh" in cmd else "bash"
                events.append({**ev, "kind": kind, "text": short(cmd, 200)})
            elif name == "Read":
                kind = "look" if fp.endswith(".png") else "read"
                events.append({**ev, "kind": kind, "text": os.path.basename(fp)})
            elif name == "SubagentHandback":
                events.append({**ev, "kind": "done", "text": "完了報告"})
            else:
                events.append({**ev, "kind": "other", "text": name})
    return versions, events


def main():
    out = sys.argv[1]
    result = {}
    for spec in sys.argv[2:]:
        name, rest = spec.split("=", 1)
        parts = rest.split(":")
        jsonl, target, fn = parts[0], os.path.abspath(parts[1]), parts[2]
        pose = parts[3] if len(parts) > 3 else ""
        versions, events = replay(jsonl, target)
        d = os.path.join(out, name)
        os.makedirs(d, exist_ok=True)
        for i, v in enumerate(versions, 1):
            open(os.path.join(d, f"v{i:02d}.js"), "w").write(v)
        result[name] = {"fn": fn, "pose": pose, "versions": len(versions), "events": events}
        print(name, len(versions), "versions", len(events), "events")
    json.dump(result, open(os.path.join(out, "history.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
