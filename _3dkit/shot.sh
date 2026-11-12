#!/bin/bash
# 使い方: ./shot.sh <model.js> <関数名>                      → 5方向(persp,front,side,top,close)
#         ./shot.sh <model.js> <関数名> <名前> "<追加クエリ>"  → 1枚(例 "cam=0,20,80&look=0,10,0")
# 出力: <model.js と同じフォルダ>/shots/<jsの名前>_<view>.png
KIT="$(cd "$(dirname "$0")" && pwd)"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
js="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; fn=$2
out="$(dirname "$js")/shots"; base="$(basename "$js" .js)"; mkdir -p "$out"
snap(){ "$CH" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --user-data-dir="$(mktemp -d)" --window-size=1000,750 --virtual-time-budget=8000 \
  --screenshot="$out/${base}_$1.png" "file://$KIT/preview.html?src=file://$js&f=$fn&$2" >/dev/null 2>&1
  echo "$out/${base}_$1.png"; }
if [ -n "$3" ]; then snap "$3" "$4"; else
  for v in persp front side top close; do snap $v "view=$v" & done; wait; fi
