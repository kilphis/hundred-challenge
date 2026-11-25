#!/bin/bash
# PostToolUse(Write|Edit|NotebookEdit): このセッションが触ったファイルを記録する。
# 自動commitは記録されたファイルだけを対象にする(同時開発で他セッションの変更を巻き込まない)。
in=$(cat)
sid=$(jq -r '.session_id // empty' <<<"$in")
f=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$in")
[ -z "$sid" ] || [ -z "$f" ] && exit 0
d="$HOME/.claude/autocommit"
mkdir -p "$d"
echo "$f" >> "$d/$sid.list"
exit 0
