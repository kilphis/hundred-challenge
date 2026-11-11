"""day1 のドット絵データを sprites.js に書き出す(ギャラリー用)。実行: uv run build_sprites.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "day1"))
import shooting as s  # noqa: E402  (main ガードあり。import だけでは起動しない)

data = {
    "PAL": {k: list(v) for k, v in s.PAL.items()},
    "sprites": {"PLAYER": s.PLAYER, "ENEMY_A": s.ENEMY_A, "ENEMY_B": s.ENEMY_B, "BOSS": s.BOSS},
}
out = Path(__file__).with_name("sprites.js")
out.write_text("const DAY1 = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
print("wrote", out)
