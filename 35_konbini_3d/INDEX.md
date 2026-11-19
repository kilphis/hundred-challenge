# 35 見取り図(自動生成: ./index_gen.sh)

読み込み順は index.html の script。層: 定義(defs) → 地図(map) → 状態と進行(sim/action/zombie/tasks/deliver/staff) → 描画(hud/world3d/render3d/labels3d) → 入力(bot/main)

- `defs.js` (160行) — defs: 数値・部門・棚・シフトの定義。調整で変わるものはここに集める(ロジックは書かない)
- `map.js` (84行) — map: マップ・歩ける判定・経路探索(bfs)・視線(los)。状態Gは触らない
- `sim.js` (196行) — sim: 状態Gとシフト進行・update・クレーム/終了の集計。作業は action.js。描画もDOMも触らない(結果画面は main.js の showResult)
- `action.js` (106行) — action: プレイヤーの作業(E長押しで何をするか)。actionAt=タイルごとの作業、currentAction=いま実行できる1つ。状態Gを読み、run() で変える
- `zombie.js` (227行) — zombie: ゾンビの生成・目的地・視界・移動・行動(updateZombie)。描画しない
- `staff.js` (143行) — staff: 店員ゾンビの仕事。動きはCPU(bot.js)と同じ「目的地まで歩く → その場で作業する」の繰り返し。
- `tasks.js` (151行) — tasks: 研修ステップ・任されるタスク(整頓/期限切れ撤去/床掃除)・床の荷物と店長の動き・全面開放。描画しない
- `deliver.js` (28行) — deliver: 納品(裏路地に箱が届く)・検品(検品台で伝票と照合)。トイレ掃除は tasks.js の任されるタスクと同じ仕組み
- `hud.js` (81行) — hud: 2D canvas(上帯・下帯・オーバーレイ)の準備とHUD描画。3Dの上に重ねる。状態Gは読むだけ
- `world3d.js` (178行) — world3d: 3Dの静的な店(床・壁・什器・棚と在庫の見た目)。1タイル=1、モデルは cm なので CM を掛ける。Gは読むだけ
- `render3d.js` (164行) — render3d: 動くもの(店員・ゾンビ・店長・荷物・視界)を3Dで描く(updateDyn)と、毎フレームの draw。文字・輪は labels3d.js
- `labels3d.js` (130行) — labels3d: 3D の上に2Dで重ねる文字・輪(棚の名札・在庫・長押しゲージ・研修の案内)。状態Gを読むだけ
- `bot.js` (104行) — bot: 開発用のCPUプレイ(Bで切替)。プレイヤー入力の代わりに移動方向と長押しを返すだけ。状態Gは update 側が動かす
- `main.js` (110行) — main: 入力・画面遷移(タイトル/シフト開始)・メインループ・撮影用クエリ

関数・型の定義行は `../outline.sh 35` で見る。数値の調整は defs.js だけ読めばよい。
