#!/bin/sh
# Mata et al. 2015 (Pattern Recognition Letters 62) の公開画像と検証資料を data/ に取る。
# サーバーが同じ URL へ 302 を返してクッキーを要求するので、クッキーを保持して取る。
set -e
cd "$(dirname "$0")/data"
base=https://www.unirioja.es/cu/gamata/files
for f in images_experiment1.zip images_experiment2.zip NeuronZigzagJvalidation.pdf; do
  [ -f "$f" ] || curl -sL -c .cj -b .cj --max-time 900 -o "$f" "$base/$f"
done
for z in images_experiment1.zip images_experiment2.zip; do unzip -oq "$z"; done
rm -f .cj
