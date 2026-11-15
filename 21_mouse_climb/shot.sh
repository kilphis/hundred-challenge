#!/bin/bash
# ./shot.sh <name> "x=..&y=..&face=.."
cd "$(dirname "$0")"; mkdir -p shots
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --user-data-dir="$(mktemp -d)" --window-size=1200,750 --virtual-time-budget=4000 \
  --screenshot="$PWD/shots/$1.png" "file://$PWD/index.html?$2" >/dev/null 2>&1; echo shots/$1.png
