#!/bin/bash
# 撮影: ./shot.sh 名前 "クエリ" ...  → shots/名前.png  (例: ./shot.sh front "" turn "yaw=0.4")
cd "$(dirname "$0")"; mkdir -p shots
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
while [ $# -ge 2 ]; do
  perl -e 'alarm 90; exec @ARGV' "$CH" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
    --user-data-dir="$(mktemp -d)" --window-size=1100,800 --virtual-time-budget=8000 \
    --screenshot="$PWD/shots/$1.png" "file://$PWD/${PAGE:-index.html}?shot=1&$2" >/dev/null 2>&1 &
  shift 2
done; wait; ls shots
