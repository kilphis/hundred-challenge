#!/bin/sh
# コードの見取り図: ファイルごとの行数と、型・関数・定数の定義行だけを出す。全文を読む前にこれを見る。
# 使い方: ./outline.sh <dayのフォルダ> [拡張子の正規表現(既定: rs|js|ts|py|c|cs)]
dir=${1:-.}; ext=${2:-'rs|js|ts|py|c|cs'}
find "$dir" -type f | grep -E "\.($ext)$" | grep -vE '/(target|node_modules|web|shots|\.venv)/' | sort | while read -r f; do
  echo "== $f ($(wc -l < "$f") 行)"
  grep -nE '^\s*(pub(\([a-z]+\))? )?(async )?(fn|struct|enum|trait|impl|const|static|mod|type) |^\s*(export )?(async )?(function|class) |^\s*(const|let) [A-Za-z_]+ = (\(|function|async)|^\s*def |^\s*class ' "$f" \
    | sed -E 's/\s*\{\s*$//' | cut -c1-110
done
