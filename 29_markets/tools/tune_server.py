"""数値調整 GUI のローカルサーバ(標準ライブラリだけ)。

    uv run tools/tune_server.py        # → http://localhost:8765

- GET  /              tools/tune.html
- GET  /api/defs      defs.rs の今の数値(`--dump-defs`)
- GET  /api/tuning    保存済みの tuning.json(無ければ defs と同じ)
- GET  /api/last      前回のシミュレーション結果(無ければ null)
- POST /api/run       本文の JSON を tuning.json に保存し、ボットを走らせて結果を返す

ボットは tools/run/ の中で動かす(balance.md と states/ はそこに出るので、29/balance.md は上書きしない)。
"""

import json
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8765
TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent  # 29/
RUN = TOOLS / "run"
TUNING = ROOT / "tuning.json"
BIN = ROOT / "target" / "release" / ("markets.exe" if sys.platform == "win32" else "markets")
lock = threading.Lock()


def build():
    """release ビルド(変更が無ければすぐ終わる)。失敗したらエラーの文字列を返す。"""
    p = subprocess.run(["cargo", "build", "--release", "-q"], cwd=ROOT, capture_output=True, text=True)
    return None if p.returncode == 0 else p.stderr[-4000:]


def dump_defs():
    RUN.mkdir(exist_ok=True)
    out = RUN / "defs.json"
    err = build()
    if err:
        raise RuntimeError(err)
    p = subprocess.run([str(BIN), "--dump-defs", str(out)], cwd=RUN, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr)
    return json.loads(out.read_text())


def run_sim(tuning):
    RUN.mkdir(exist_ok=True)
    TUNING.write_text(json.dumps(tuning, ensure_ascii=False, indent=2))
    err = build()
    if err:
        return {"error": "ビルド失敗\n" + err}
    out = RUN / "result.json"
    out.unlink(missing_ok=True)
    t0 = time.time()
    p = subprocess.run(
        [str(BIN), "--sim", "--tuning", str(TUNING), "--json", str(out)],
        cwd=RUN, capture_output=True, text=True,
    )
    if p.returncode != 0 or not out.exists():
        return {"error": "シミュレーション失敗\n" + p.stderr[-4000:]}
    res = json.loads(out.read_text())
    res["warnings"] = [l for l in p.stderr.splitlines() if l.startswith("tuning:")]
    res["elapsed"] = round(time.time() - t0, 2)
    res["balance_md"] = (RUN / "balance.md").read_text()
    res["tuning"] = tuning
    last = RUN / "last.json"
    if last.exists():
        (RUN / "prev.json").write_text(last.read_text())
    last.write_text(json.dumps(res, ensure_ascii=False))
    return res


class Handler(BaseHTTPRequestHandler):
    def send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        try:
            if path in ("/", "/tune.html"):
                self.send(200, (TOOLS / "tune.html").read_bytes(), "text/html; charset=utf-8")
            elif path == "/api/defs":
                with lock:
                    self.send(200, dump_defs())
            elif path == "/api/tuning":
                if TUNING.exists():
                    self.send(200, json.loads(TUNING.read_text()))
                else:
                    with lock:
                        self.send(200, dump_defs())
            elif path == "/api/last":
                f = RUN / "last.json"
                g = RUN / "prev.json"
                self.send(200, {
                    "last": json.loads(f.read_text()) if f.exists() else None,
                    "prev": json.loads(g.read_text()) if g.exists() else None,
                })
            else:
                self.send(404, {"error": "not found"})
        except Exception as e:  # noqa: BLE001
            self.send(500, {"error": str(e)})

    def do_POST(self):
        if self.path.split("?")[0] != "/api/run":
            return self.send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            tuning = json.loads(self.rfile.read(n) or b"{}")
            with lock:
                res = run_sim(tuning)
            self.send(200 if "error" not in res else 500, res)
        except Exception as e:  # noqa: BLE001
            self.send(500, {"error": str(e)})

    def log_message(self, fmt, *args):
        sys.stderr.write("[tune] " + (fmt % args) + "\n")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    print(f"数値調整: http://localhost:{port}  (初回は release ビルドに数分かかる)")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
