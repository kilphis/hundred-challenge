#!/bin/sh
# ビルドして P コア・E コアの両方で測る。表は result_P.txt / result_E.txt、生データは data.csv
#   ./run.sh      … 時間から予測ミスを推定(パスワード不要、誤差大)
#   ./run.sh pmc  … sudo でハードウェアカウンタを使い、予測ミスを実数で数える
cd "$(dirname "$0")"
clang -O2 -Wall -o bp bp.c || exit 1
SUDO=""
[ "$1" = pmc ] && SUDO="sudo" && sudo -v
$SUDO ./bp         2> data_P.csv | tee result_P.txt
$SUDO ./bp --ecore 2> data_E.csv | tee result_E.txt
{ cat data_P.csv; tail -n +2 data_E.csv; } > data.csv && rm data_P.csv data_E.csv
