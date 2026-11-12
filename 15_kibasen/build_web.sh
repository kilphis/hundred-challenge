#!/bin/sh
# WASM をビルドして web/ に置く。遊ぶときは web/ を HTTP で配信する
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/kibasen.wasm web/
echo "→ cd web && uv run python -m http.server 8015  →  http://localhost:8015"
