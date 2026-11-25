"""金のフレーズ CSV(30_Areas/toiecFrase) から data.js を作る。CSV を直したら `uv run build.py`。"""
import csv, json
from pathlib import Path
src = Path(__file__).resolve().parents[2] / "30_Areas/toiecFrase/金のフレーズ730.csv"
keys = ["no", "word", "pron", "pos", "meaning", "ja", "en_full", "note"]
rows = [{k: r[k] for k in keys} for r in csv.DictReader(open(src, encoding="utf-8-sig"))]
(Path(__file__).parent / "data.js").write_text("const WORDS = " + json.dumps(rows, ensure_ascii=False) + ";\n")
print(len(rows), "words -> data.js")
