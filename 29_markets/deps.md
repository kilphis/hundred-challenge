# 29 markets — コードの依存関係

`src/*.rs` の `use crate::…` と `モジュール::関数` の呼び出しから作った図(2026-11-17 時点)。
矢印は「A → B = A が B を使う」。ラベルは主に使っている関数・型。
ブラウザ版の詳しい図は [[70_hundred_challenge/29_markets/deps.html|deps.html]]。

## モジュールの依存

```mermaid
flowchart TD
    main["main.rs<br/>定数・App組み立て・tick"]
    defs["defs.rs<br/>マーケットの中身(データ)"]
    tuning["tuning.rs<br/>調整値の上書き(作業途中)"]
    state["state.rs<br/>型・マス判定"]
    logic["logic.rs<br/>1ステップ更新"]
    input["input.rs<br/>クリック・キー"]
    render["render.rs<br/>描画・レイアウト"]
    save["save.rs<br/>JSON 保存/読込"]
    sim["sim.rs<br/>バランス確認ボット"]
    tests["tests.rs<br/>テスト"]

    tuning -->|"MARKETS, MarketDef"| defs
    state -->|MarketDef| defs
    state -->|"tuning::markets"| tuning
    logic --> state
    save -->|MarketDef| defs
    save --> state
    input --> state
    input -->|"click_source, drop_item, burst…"| logic
    input -->|"hit, menu_rect, tab_rect"| render
    input -->|"save, load"| save
    render --> state
    render -->|cursor_world| input
    sim -->|MarketDef| defs
    sim --> state
    sim -->|"step_market, click_source, drop_item"| logic
    sim -->|save| save
    tests -->|"MARKETS, food"| defs
    tests --> state
    tests -->|step_market| logic
    tests -->|MENU_PER_ROW| render
    tests -->|"apply, dump_defs"| tuning

    main -->|"step_market(tick)"| logic
    main -->|"input"| input
    main -->|"setup, render"| render
    main -->|"load(--load)"| save
    main -->|"run(--sim)"| sim
    main -->|"load(--tuning), write_defs(--dump-defs)"| tuning
    main -->|"World::new"| state
```

- `input` と `render` は互いに使い合う(循環)。それ以外は `defs → state → logic → 画面/ボット` の一方向。
- 図に入れていないが、`main.rs` の定数(`CELL`, `ROWS`, `PROCESS_T`, `DIRS` …)は state / logic / input / render / save / sim / tests が読んでいる。

## 定数の読み手

```mermaid
flowchart LR
    C["main.rs の定数"]
    C --> state["state<br/>BSIZE CELL ROWS ROAD_SPEED WEAR_STEP START_MONEY…"]
    C --> logic["logic<br/>COOLDOWN DIRS PRESS_T PROCESS_T ROWS…"]
    C --> input["input<br/>DIRS FARMER/RIVER_INTERVAL"]
    C --> render["render<br/>BSIZE CELL COOLDOWN PRESS_T PROCESS_T ROWS"]
    C --> save["save<br/>FARMER/RIVER_INTERVAL"]
    C --> sim["sim<br/>BSIZE PROCESS_T ROAD/OFFROAD_SPEED…"]
    C --> tests["tests<br/>START_MONEY"]
```

## 起動の分かれ道

```mermaid
flowchart TD
    A["cargo run -- 引数"] --> B{"--dump-defs?"}
    B -->|yes| B1["tuning::write_defs → 終了"]
    B -->|no| T{"--tuning?"}
    T -->|yes| T1["tuning::load で値を上書き"] --> S
    T -->|no| S{"--sim?"}
    S -->|yes| S1["sim::run → balance.md → 終了"]
    S -->|no| G["Bevy App 起動"]
    G --> W{"--load?"}
    W -->|yes| W1["save::load(パス)"]
    W -->|no| W2["World::new()"]
```

## 1フレームの流れ

```mermaid
sequenceDiagram
    participant Bevy
    participant main as main::tick
    participant logic
    participant input as input::input
    participant render as render::render
    Bevy->>main: Update(dt)
    loop 開いているマーケットごと(非表示でも)
        main->>logic: step_market(m, money, dt)
    end
    Bevy->>input: クリック・ドラッグ・キー
    input->>logic: click_source / drop_item
    input->>render: hit / menu_rect(当たり判定)
    Bevy->>render: 毎フレーム描き直し
    render->>input: cursor_world
```
