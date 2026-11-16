#!/bin/bash
# カメラ・マイクは file:// だと許可されないことがあるので、ローカルサーバーで配る
cd "$(dirname "$0")"
echo "ブラウザで http://localhost:8766/ を開く(止めるのは Ctrl+C)"
uv run --no-project python -m http.server 8766
