#!/bin/bash
# 歩く灯籠の撮影(ウィンドウを開かない)。使い方: ./shot.sh <名前> "<クエリ>"  例: ./shot.sh walk "t=1.3&bend=1&ik=1"
D="$(cd "$(dirname "$0")" && pwd)"; mkdir -p "$D/shots"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
  --hide-scrollbars --user-data-dir="$(mktemp -d)" --window-size=1400,850 --virtual-time-budget=12000 \
  --enable-logging=stderr --v=0 --screenshot="$D/shots/$1.png" "file://$D/index.html?shot&$2" >/dev/null 2>&1
echo "$D/shots/$1.png"
