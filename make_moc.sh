#!/bin/bash
# MOC.md を作り直す: 各日の okimochi.md への Obsidian リンク一覧。
# 内容欄は README の表から取る(表に無い日はディレクトリ名)。/hundred-tidy の改名後に呼ぶ。
cd "$(dirname "$0")"
{
  echo "---"
  echo "tags: [100日チャレンジ]"
  echo "---"
  echo "# 100日チャレンジ MOC"
  echo
  echo "各日の okimochi(作った気持ち)へのリンク。書いた日は [x]、未記入(ファイルなし・中身が空)は [ ]。リンクは未記入でも張る(クリックで作れる)。\`./make_moc.sh\` で作り直す(手で編集しない)。"
  echo
  for d in $(ls -d [0-9]* 2>/dev/null | sort -n); do
    [ -d "$d" ] || continue
    n=${d%%_*}
    what=$(awk -F'|' -v n="$n" '$2 ~ "^ *"n" *$" {gsub(/^ +| +$/,"",$3); print $3; exit}' README.md)
    [ -n "$what" ] || what=$d
    if [ -f "$d/okimochi.md" ] && grep -q '[^[:space:]]' "$d/okimochi.md"; then
      box="[x]"
    else
      box="[ ]"
    fi
    echo "- $box Day $n [[70_hundred_challenge/$d/okimochi|$d]] — $what"
  done
} > MOC.md
echo "MOC.md: $(grep -c '\[\[' MOC.md) 件のリンク"
