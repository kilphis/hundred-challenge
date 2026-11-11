"""day5 用の小さなサーバ。 uv run serve.py → http://localhost:8765/game.html
静的ファイルを配り、/news で NHK のRSSを取得してJSONで返す(10分キャッシュ)。"""
import http.server, json, time, urllib.request, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

PORT = 8777
CATS = {"main": 0, "culture": 2, "science": 3, "economy": 5, "world": 6, "sports": 7}
cache = {"t": 0, "data": None}

def fetch(cat):
    url = f"https://www.nhk.or.jp/rss/news/cat{cat}.xml"
    with urllib.request.urlopen(url, timeout=6) as r:
        root = ET.fromstring(r.read())
    return [{"title": i.findtext("title") or "", "desc": i.findtext("description") or ""}
            for i in root.iter("item")][:15]

def news():
    if cache["data"] and time.time() - cache["t"] < 600:
        return cache["data"]
    def one(kv):
        try: return kv[0], fetch(kv[1])
        except Exception: return kv[0], []
    with ThreadPoolExecutor() as ex:
        data = dict(ex.map(one, CATS.items()))
    cache.update(t=time.time(), data=data)
    return data

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/news"):
            body = json.dumps(news(), ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers(); self.wfile.write(body)
        else:
            super().do_GET()

if __name__ == "__main__":
    import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"http://localhost:{PORT}/game.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
