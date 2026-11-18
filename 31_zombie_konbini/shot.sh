#!/bin/bash
# ./shot.sh <name> "<query>"   例: ./shot.sh rush "shift=2&ff=90&px=10.5&py=10.5"
cd "$(dirname "$0")"; mkdir -p shots
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --user-data-dir="$(mktemp -d)" --window-size=1000,800 --virtual-time-budget=${VT:-500} \
  --screenshot="$PWD/shots/$1.png" "file://$PWD/index.html?$2" >/dev/null 2>&1; echo shots/$1.png
