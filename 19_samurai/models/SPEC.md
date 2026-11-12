# day19 侍のモデル(モーション差分つき)

共通仕様は `../../_3dkit/SPEC.md`。以下はこの日の追加分。

## 決まっていること(ユーザー)
- 明日、侍が戦い合うゲームを作る。そのための侍モデルと、移動・攻撃のモーション差分。

## 骨組み(Claude が仮決め・差し替え可)
- 関節ごとに THREE.Group を入れ子にする: hips → spine → chest → neck → head / 左右 shoulder → elbow → wrist(刀は右手の wrist の子、柄に左手も添える) / 左右 hip → knee → ankle。
- 関節の Group は `group.userData.joints = { hips, spine, ... }` で外から触れるようにする。
- 原点 = 両足の間の地面、正面 +Z、身長 約170cm。

## モーション(Claude が仮決め・差し替え可)
- `group.userData.setPose(name, t)` … name のモーションの位相 t(0..1)の姿勢にする。t はループするモーションでは1周、1回きりのモーションでは開始→終了。
- `group.userData.motions` … `{ name: { duration: 秒, loop: true/false } }` の一覧。
- 用意するもの:
  - `idle` 構えて待つ(中段の構え、呼吸程度の揺れ)。loop。
  - `walk` 構えたまま前へすり足で歩く。loop。
  - `run` 刀を構えて走る。loop。
  - `attack` 上段から振り下ろす斬り。予備動作→斬り→戻り。1回きり。
- ゲーム側は毎フレーム `setPose(name, (経過秒/duration) % 1)` を呼ぶだけでよい作りにする。

## できたもの(2026-11-12、Sonnet サブエージェント)
- `models/samurai.js`(メッシュ70)。確認ページ `motion_check.html`、一覧画像 `models/motion_sheet.png`。
- 左 = +X、右 = -X(キャラ基準)。刀は右手、構えでは左手が常に柄に付く(IK)。joints に `sword` もある。
- `userData.motions[name] = {duration, loop, speed}`:

| モーション | duration | loop | 備考 |
|---|---|---|---|
| idle | 2.4秒 | あり | 中段、右足前 |
| walk | 0.8秒 | あり | すり足。足が滑らない前進速度 55cm/秒 |
| run | 0.66秒 | あり | 右手で刀を前、左腕を振る。前進速度 260cm/秒 |
| attack | 1.1秒 | なし | 振りかぶり 0–0.26 / 溜め 0.26–0.34 / 斬り 0.34–0.48(右足踏み込み) / 残心 0.48–0.60 / 戻り 0.60–1.0 |

- 既知の欠点: 走りで膝を上げると袴がめり込む。刃は平板。足裏が曲がらずかかとを上げると約2cm沈む。鉢巻の垂れは揺れない。motion_check.html の「床を流す」は向き未確認。
