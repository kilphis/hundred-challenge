#!/bin/bash
# 使い方: ./shot.sh [状態番号...]  → shots/s<N>.png (2000x1500)
cd "$(dirname "$0")"; mkdir -p shots
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for s in ${@:-1 2 3 4 5}; do
  perl -e 'alarm 150; exec @ARGV' "$CH" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
    --user-data-dir="$(mktemp -d)" --window-size=2000,1500 --virtual-time-budget=6000 \
    --screenshot="$PWD/shots/s$s.png" "file://$PWD/index.html?s=$s" >/dev/null 2>&1 &
done; wait; ls -la shots/s?.png
