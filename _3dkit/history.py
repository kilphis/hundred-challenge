"""サブエージェントの作業記録(JSONL)から、モデルjsの途中版と作業の経過を取り出す。

使い方: uv run --no-project _3dkit/history.py <出力先> <名前>=<jsonl>:<対象jsの絶対パス>:<関数名>[:<pose>] ...
出力: <出力先>/<名前>/vNN.js(途中版) と <出力先>/history.json・history.js(経過)。見るのは viewer.html
Write/Edit と Bash を一時フォルダで記録順に再実行する(shot.sh は何もしない代わりに差し替える)。
"""
import json, os, shlex, shutil, subprocess, sys, tempfile
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))


def load(path):
    return [json.loads(l) for l in open(path) if l.strip()]


def short(s, n=160):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


ROOT = "/Users/nakaharawataruakira/obVault/70_hundred_challenge"


def sandbox_run(box, cwd, cmd):
    """記録の Bash コマンドを、パスを一時フォルダに差し替えて実行する。実行後の cwd を返す。"""
    cmd = cmd.replace(ROOT, box)
    script = f"cd {shlex.quote(cwd)} 2>/dev/null; {cmd}\npwd > {box}/.cwd"
    subprocess.run(["bash", "-c", script], cwd=box, capture_output=True, timeout=60)
    try:
        return open(f"{box}/.cwd").read().strip()
    except OSError:
        return cwd


def replay(jsonl, target):
    """Write/Edit と Bash(cat >, sed, python 等)を一時フォルダで順に再実行し、対象jsが変わるたびに版を取る。"""
    rows = load(jsonl)
    errors = set()
    for r in rows:
        c = r.get("message", {}).get("content")
        if isinstance(c, list):
            for b in c:
                if b.get("type") == "tool_result" and b.get("is_error"):
                    errors.add(b.get("tool_use_id"))
    box = tempfile.mkdtemp()
    for d in ["_3dkit/bench/2026-11-12", "19/models"]:
        os.makedirs(f"{box}/{d}", exist_ok=True)
    stub = f"{box}/_3dkit/shot.sh"
    open(stub, "w").write("#!/bin/bash\nexit 0\n"); os.chmod(stub, 0o755)
    tgt = target.replace(ROOT, box)
    cwd = box
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
            fp = os.path.abspath(inp.get("file_path", "")) if inp.get("file_path") else ""
            if name == "Write" and fp and not failed:
                p = fp.replace(ROOT, box); os.makedirs(os.path.dirname(p), exist_ok=True)
                open(p, "w").write(inp["content"])
            elif name == "Edit" and fp and not failed and os.path.exists(fp.replace(ROOT, box)):
                p = fp.replace(ROOT, box); s = open(p).read()
                s = s.replace(inp["old_string"], inp["new_string"]) if inp.get("replace_all") \
                    else s.replace(inp["old_string"], inp["new_string"], 1)
                open(p, "w").write(s)
            elif name == "Bash" and not failed:
                cwd = sandbox_run(box, cwd, inp.get("command", ""))
            # 経過の記録
            cmd = inp.get("command", "")
            if name in ("Write", "Edit") and fp == target:
                kind, desc = ("error", f"{name} 失敗") if failed else ("tool", "Write で全体を書く" if name == "Write" else
                             f"Edit: {short(inp['new_string'].strip().splitlines()[0] if inp['new_string'].strip() else '(削除)', 90)}")
            elif name == "Bash":
                kind = "error" if failed else ("shot" if "shot.sh" in cmd and "cat >" not in cmd else "bash")
                desc = short(cmd.replace(ROOT + "/", ""), 200)
            elif name == "Read":
                kind, desc = ("look" if fp.endswith(".png") else "read"), os.path.basename(fp)
            elif name == "SubagentHandback":
                kind, desc = "done", "完了報告"
            else:
                kind, desc = "other", name
            new = open(tgt).read() if os.path.exists(tgt) else None
            if new is not None and new != text:
                d = (new.count("\n") - text.count("\n")) if text else new.count("\n") + 1
                versions.append(new); text = new
                events.append({**ev, "kind": "edit", "version": len(versions), "lines": new.count("\n") + 1,
                               "text": f"v{len(versions):02d}({'全体' if len(versions) == 1 else f'{d:+d}行'}) ← {desc}"})
            else:
                events.append({**ev, "kind": kind, "text": desc})
    shutil.rmtree(box, ignore_errors=True)
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
    # file:// のページから読めるよう js でも出す(viewer.html が読む)
    open(os.path.join(out, "history.js"), "w").write("window.HISTORY = " + json.dumps(result, ensure_ascii=False) + ";\n")


if __name__ == "__main__":
    main()
