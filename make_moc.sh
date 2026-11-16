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
  echo "各日の okimochi(作った気持ち)へのリンク。\`./make_moc.sh\` で作り直す(手で編集しない)。"
  echo
  echo "| Day | 内容 | okimochi |"
  echo "|---|---|---|"
  for d in $(ls -d [0-9]* 2>/dev/null | sort -n); do
    [ -d "$d" ] || continue
    n=${d%%_*}
    what=$(awk -F'|' -v n="$n" '$2 ~ "^ *"n" *$" {gsub(/^ +| +$/,"",$3); print $3; exit}' README.md)
    [ -n "$what" ] || what=$d
    if [ -f "$d/okimochi.md" ]; then
      link="[[70_hundred_challenge/$d/okimochi\\|$d]]"
    else
      link="—"
    fi
    echo "| $n | $what | $link |"
  done
} > MOC.md
echo "MOC.md: $(grep -c '\[\[' MOC.md) 件のリンク"
