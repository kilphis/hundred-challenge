# day39 メイクテン 2人対戦(別々の端末)の計画

状態: 計画のみ(未着手)。いまの CPU 対戦(`ContentView.swift` の `cpuThinks`)は、1台の中で「あなた vs 時間切れ」を競うもの。ここでは「人と人」を別々の端末でやるならどうするか、を整理する。

## 前提: 今のコードで使い回せるもの

| 部品 | 場所 | 使い回し |
|---|---|---|
| 分数計算 `Frac` と `apply` | `Logic.swift` / `Ops.swift` | そのまま。サーバ側の判定にも使う |
| 解ける問題を出す `newProblem()` | `Logic.swift` | サーバが1回だけ呼び、2人に同じ問題を配る |
| 式を作る `solveTen()` | `Logic.swift` | 時間切れのときに答えを見せる |
| 画面 `MergeView` / `NotationView` | SwiftUI | iOS にも持っていける(AppKit に依存していない) |
| `AppDelegate` の最前面処理 | `App.swift` | macOS 専用。iOS では不要 |

対戦にするとき一番変わるのは、**「誰が問題を決め、誰が正解と判定するか」が画面の外に出る**こと。いまは `ContentView` が全部持っている。

## 共通の第1歩: ロジックを部品にする(どちらの道でも必要)

1. `Package.swift` を `MakeTenCore`(ライブラリ: `Frac` `apply` `newProblem` `solveTen` `Tok` `stack`)と `MakeTen`(macOS アプリ)に分ける。
2. 通信用の型を `MakeTenCore` に置く(`Codable`)。サーバとクライアントが同じ型を共有できる。これが「Swift 前提」にする最大の利点。

```swift
// クライアント → サーバ
enum ClientMsg: Codable {
    case join(room: String, name: String)
    case answer(steps: [Step])        // 合体の記録(下の「判定」参照)
    case giveUp
}
// サーバ → クライアント
enum ServerMsg: Codable {
    case waiting                       // 相手待ち
    case round(id: Int, numbers: [Int], seconds: Int)
    case roundEnd(winner: Int?, solution: String?, scores: [Int])  // winner: 0/1/nil(時間切れ)
    case opponentLeft
}
struct Step: Codable { let a: Int; let op: String; let b: Int }  // 手元の数の何番目と何番目か
```

## 判定をどこでやるか(あなたが決めること)

- **サーバが判定する**(安全): クライアントは「合体の記録」`[Step]` を送る。サーバが同じ4つの数から `apply` で再生して、最後が 10 かを確かめる。ずるができない。
- **クライアントが「できた」と送る**(簡単): 友達同士で遊ぶだけなら足りる。ただし嘘が通る。

おすすめは前者。`MergeView.combine` が持っている履歴(`history`)から `[Step]` を作れるので、追加は小さい。

## 道A: Swift のサーバ + WebSocket

```
 iPhone/Mac/ブラウザ  ←WebSocket→  Swift サーバ(部屋・問題・判定・得点)  ←WebSocket→  相手
```

- サーバ: Hummingbird または Vapor(どちらも SwiftPM 1行で入る。どちらも使ったことがないので新しい技術になる。バージョンと WebSocket の書き方は着手時に公式を確認する)。
- 部屋: 4文字の部屋コードを入力して入る。2人そろったら `round` を配る。
- 時間管理はサーバ(各ラウンド `cpuSeconds` と同じ値を使う)。端末の時計に頼らない。
- 先に正しい `answer` が届いたほうが勝ち。同時に届いたらサーバに先に着いたほうを勝ちにする。
- クライアントの選択肢:
  1. **今の macOS アプリを2つ起動**(最短。通信の確認だけならこれで足りる)
  2. **ブラウザ用の画面**を HTML/JS で書く(スマホで一番手軽。ただしここは Swift ではなくなる)
  3. **SwiftWasm** で画面も Swift にする(筋は通るが、環境づくりが重い。1日では賭けになる)
- 公開: 同じ Wi-Fi なら `swift run` したサーバの IP を伝えるだけ。外から入るなら tailscale か cloudflared のトンネルを使う(ポート開放はしない)。

向いている点: 端末を選ばない/判定が一か所/観戦や再接続を足しやすい。
弱い点: サーバを立てる手間と、ブラウザ画面が Swift でなくなる問題。

## 道B: iPhone アプリ(SwiftUI)+ 端末どうしの直接通信

```
 iPhone A  ←MultipeerConnectivity→  iPhone B   (片方が「親」になって問題と判定を持つ)
```

- 通信: MultipeerConnectivity(同じ Wi-Fi か Bluetooth の近くにいる端末を見つける。サーバ不要)。親の端末が `newProblem()` と時間管理と判定を持ち、子は `ClientMsg`/`ServerMsg` で話す。つまり道Aのサーバが「親の端末の中」に入る形。
- 画面: `MergeView` `NotationView` を iOS でも使う(macOS と共通のターゲットにする)。
- 必要なもの:
  - Xcode のプロジェクト(`swift run` だけでは iOS アプリは作れない。XcodeGen などで `project.yml` から作るのが記録に残って楽)
  - 実機に入れるなら Apple ID(無料でも可、7日で期限切れ)
  - シミュレータ2台でもつながることが多いが、不安定。実機2台が確実
- 別案: GameKit(Game Center)なら遠くの相手ともつながるが、Apple Developer Program(有料)が要る。今回は見送る。

向いている点: サーバ不要/画面もすべて Swift/アプリらしい体験。
弱い点: 実機と署名の準備が重い/同じ場所にいないと遊べない(Multipeer のとき)/Android や PC は不可。

## 比べると

| | 道A サーバ | 道B iPhone 直接 |
|---|---|---|
| Swift 率 | サーバと型は Swift、画面はクライアント次第 | 全部 Swift |
| 準備の重さ | 軽い(`swift run` と URL) | 重い(Xcode プロジェクト・実機・署名) |
| 遠くの人と | 可(トンネルが要る) | 不可(Multipeer のとき) |
| 判定の安全性 | サーバが持つので高い | 親端末が持つ。親がずるできる |
| 1日で終わるか | 終わる(macOS 2窓で確認) | iPhone 実機まで行くと厳しい |

## 進め方の案(道A を先にする場合)

1. `MakeTenCore` を切り出す。`swift build` が通ることを確認。
2. `MakeTenServer`(新ターゲット)で WebSocket の部屋を作る。`websocat` で手打ちして「2人そろう → `round` が届く」まで。
3. macOS アプリに「対戦(通信)」を足す。部屋コード入力、`round` で盤面を作り直す、解けたら `answer`。CPU 対戦のスイッチと並べる(CPU は「通信なしの相手」として残る)。
4. 2窓で対戦して、勝ち・時間切れ・相手の切断を確かめる。
5. 余力があれば、スマホ用に別クライアントを足す(ブラウザ or iOS)。

道B を先にする場合は、2 のサーバを「親端末の中のクラス」に置き換え、3 の通信を Multipeer にするだけで、残りは同じ。型を `MakeTenCore` に置いておけば、道A から道B へ移るのも難しくない。

## あなたが決めること

- 判定: サーバ(または親)が `[Step]` を再生して確かめるか、「できた」の自己申告か。
- 勝ち負け: 先に 10 を作ったほうが勝ち(いまの CPU 対戦と同じ)か、別のルールか。
- ラウンド数・終わりの条件: 何問先取か、いつまでか。
- 遊ぶ場所: 同じ部屋にいる二人か、離れた二人か(道の選択に直結する)。
- 相手が切れたとき: 待つか、CPU に代わるか、負けにするか。
