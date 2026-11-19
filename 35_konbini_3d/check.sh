#!/bin/bash
# ./check.sh  構造の点検: 構文 / 関数名の重複 / 層違反(描画・DOM) / 長い行 / 先頭コメント / index.html の script 漏れ
cd "$(dirname "$0")"; ng=0
say() { echo "NG: $*"; ng=1; }
LOGIC="map sim action zombie tasks deliver staff bot"      # ゲーム状態の層。描画・DOM に触らない
for f in *.js; do node --check "$f" 2>/dev/null || say "構文エラー $f"; done
d=$(grep -ohE "^function [A-Za-z0-9_]+" *.js | sort | uniq -d); [ -n "$d" ] && say "関数名の重複: $d"
for f in $LOGIC; do [ -f $f.js ] && grep -nE "THREE|\bcx\.|\bcv\b|document\.|innerHTML" $f.js | sed "s/^/  層違反 $f.js:/" | grep . && ng=1; done
awk 'length>200 && FILENAME!="defs.js"{print "  長い行 "FILENAME":"FNR" ("length"字)"}' *.js
for f in *.js; do head -1 "$f" | grep -q '^// ' || say "先頭コメントなし $f"; done
for f in *.js; do grep -q "src=\"$f\"" index.html || grep -q "src=\"models/" <<<"$f" || say "index.html に無い $f"; done
for f in models/*.js; do grep -q "src=\"$f\"" index.html || echo "  index 未読込(models.html 専用?) $f"; done
[ $ng = 0 ] && echo "OK" || exit 1
