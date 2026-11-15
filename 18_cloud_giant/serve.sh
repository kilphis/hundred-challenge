#!/bin/bash
# 顔追跡を使うときの起動(カメラはファイル直開きだと許可されないことがあるため、ローカルサーバーで開く)
cd "$(dirname "$0")"
open "http://localhost:8765/index.html?cam=1"
uv run --no-project python -m http.server 8765
