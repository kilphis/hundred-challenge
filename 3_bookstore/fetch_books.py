"""books.js の isbn から書誌情報(openBD)と表紙(Open Library)を取得し、fetched.js に書く。
実行: uv run fetch_books.py   ※ fetched.js は gitignore(表紙は data URL で埋め込む)"""
import base64, json, re, urllib.request
from pathlib import Path

here = Path(__file__).parent
isbns = re.findall(r"isbn:'(\d{13})'", (here / "books.js").read_text())

def get(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return r.read()

meta = {x["summary"]["isbn"]: x for x in json.loads(get("https://api.openbd.jp/v1/get?isbn=" + ",".join(isbns))) if x}

out = {}
for isbn in isbns:
    d = {}
    x = meta.get(isbn)
    if x:
        s, o = x["summary"], x["onix"]
        d["publisher"] = s["publisher"]
        if s["pubdate"][:4].isdigit(): d["year"] = int(s["pubdate"][:4])
        try: d["price"] = int(o["ProductSupply"]["SupplyDetail"]["Price"][0]["PriceAmount"])
        except (KeyError, IndexError, TypeError): pass
        try: d["pages"] = int(o["DescriptiveDetail"]["Extent"][0]["ExtentValue"])
        except (KeyError, IndexError, TypeError, ValueError): pass
        texts = {t["TextType"]: t["Text"] for t in o.get("CollateralDetail", {}).get("TextContent", [])}
        if texts: d["summary"] = texts.get("03") or texts.get("02") or texts.get("04")
        if s["cover"]:
            d["cover"] = s["cover"]
    try:
        img = get(f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false")
        d["cover"] = "data:image/jpeg;base64," + base64.b64encode(img).decode()
    except Exception as e:
        print(f"{isbn}: 表紙なし ({e})")
    out[isbn] = d
    print(isbn, "ok" if "cover" in d else "no-cover", d.get("publisher"), d.get("price"))

(here / "fetched.js").write_text("const FETCHED = " + json.dumps(out, ensure_ascii=False) + ";\n")
print("wrote fetched.js")
