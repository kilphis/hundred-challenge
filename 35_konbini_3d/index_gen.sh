#!/bin/bash
# ./index_gen.sh  INDEX.md(ファイルの役割と定義行の見取り図)を作り直す。ファイルを足したら実行
cd "$(dirname "$0")"
{ echo "# 35 見取り図(自動生成: ./index_gen.sh)"; echo
  echo "読み込み順は index.html の script。層: 定義(defs) → 地図(map) → 状態と進行(sim/action/zombie/tasks/deliver/staff) → 描画(hud/world3d/render3d/labels3d) → 入力(bot/main)"; echo
  for f in $(grep -o 'src="[^"]*\.js"' index.html | sed 's/src="//; s/"//' | grep -v -e '^models/' -e '^http'); do
    echo "- \`$f\` ($(wc -l < $f | tr -d ' ')行) — $(head -1 $f | sed 's#^// ##')"; done
  echo; echo "関数・型の定義行は \`../outline.sh 35\` で見る。数値の調整は defs.js だけ読めばよい。"
} > INDEX.md
