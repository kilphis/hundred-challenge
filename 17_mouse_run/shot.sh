#!/bin/bash
# 使い方: ./shot.sh <file> <fn>              → 5方向
#         ./shot.sh <file> <fn> <name> "<追加クエリ>"  → 1枚
cd "$(dirname "$0")"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
file=$1; fn=$2; mkdir -p shots
snap(){ "$CH" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --user-data-dir="$(mktemp -d)" --window-size=1000,750 --virtual-time-budget=8000 \
  --screenshot="$PWD/shots/${fn}_$1.png" "file://$PWD/preview.html?m=$file&f=$fn&$2" >/dev/null 2>&1
  echo "shots/${fn}_$1.png"; }
if [ -n "$3" ]; then snap "$3" "$4"; else
  for v in persp front side top close; do snap $v "view=$v" & done; wait; fi
