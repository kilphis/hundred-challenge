#!/bin/bash
# Stop: このセッションが編集したファイルだけを commit する。
# 他セッションの未コミット変更や、すでに stage 済みの他ファイルは含めない(pathspec 指定で commit)。
in=$(cat)
sid=$(jq -r '.session_id // empty' <<<"$in")
d="$HOME/.claude/autocommit"
list="$d/$sid.list"
[ -n "$sid" ] && [ -s "$list" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

# マージ・リベース途中は触らない
gd=$(git rev-parse --git-dir)
for m in MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD; do [ -e "$gd/$m" ] && exit 0; done
[ -d "$gd/rebase-merge" ] || [ -d "$gd/rebase-apply" ] && exit 0

files=()
while IFS= read -r f; do
  case "$f" in "$root"/*) rel="${f#"$root"/}" ;; /*) continue ;; *) rel="$f" ;; esac
  git check-ignore -q -- "$rel" && continue
  [ -n "$(git status --porcelain -- "$rel")" ] && files+=("$rel")
done < <(sort -u "$list")

if [ ${#files[@]} -gt 0 ]; then
  git add -A -- "${files[@]}" >/dev/null 2>&1
  names=$(for f in "${files[@]:0:3}"; do basename "$f"; done | paste -sd, -)
  more=""; [ ${#files[@]} -gt 3 ] && more=" +$(( ${#files[@]} - 3 ))"
  top=$(dirname "${files[0]}" | cut -d/ -f1)
  git commit -q -m "auto($top): $names$more" \
    -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" \
    -- "${files[@]}" >/dev/null 2>&1 \
    && echo "{\"systemMessage\":\"auto-commit: ${#files[@]} files ($names$more)\"}"
fi
: > "$list"
exit 0
