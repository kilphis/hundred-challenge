#!/bin/bash
# ./shot.sh <name> [課題id]   例: ./shot.sh seg seg
cd "$(dirname "$0")"; mkdir -p shots
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --user-data-dir="$(mktemp -d)" --window-size=1400,${H:-1000} --virtual-time-budget=8000 \
  --screenshot="$PWD/shots/$1.png" "file://$PWD/index.html#$2" >/dev/null 2>&1; echo shots/$1.png
