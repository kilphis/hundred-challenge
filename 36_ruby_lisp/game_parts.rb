# コイン集めゲームの対訳表。コードは coin-game.lisp / coin-game.rb から名前で抜き出す。
# lisp: / ruby: は定義名(複数可)。note は違いの説明。
GAME_PARTS = [
  {
    title: "ゲームの状態",
    lisp: %w[game],
    ruby: %w[Game],
    point: "状態は「プレイヤー・コイン・敵」の3つ。位置は Lisp が (x . y) のペア、Ruby が [x, y] の配列。",
    note: "Lisp の defstruct は読み書きできるレコード、Ruby の Data は作ったら書き換えられない値。どちらも `game-player` / `g.player` のように中身を取り出す。",
  },
  {
    title: "盤の中か調べる",
    lisp: %w[inside-p],
    ruby: %w[inside?],
    point: "Lisp は関数名が先頭の前置記法で、`(<= 0 x w)` は「0 ≦ x ≦ w」を1式で書ける。Ruby は値のほうにメソッドを付ける `x.between?(0, w)`。",
    note: "Lisp は `-p`(predicate)、Ruby は `?` を名前の最後に付けて「真偽を返す」と示す慣習。",
  },
  {
    title: "キーで動く",
    lisp: %w[move-player],
    ruby: %w[move_player],
    point: "case(場合分け)が値を返すので、結果をそのまま new に入れている。形はほぼ同じ。",
    note: "Lisp の文字は `#\\w`、Ruby は文字列 \"w\"。Lisp の `let` は一時的な変数 new を作る式で、Ruby は普通の代入(`new = ...`)で済む。",
  },
  {
    title: "敵が1歩近づく",
    lisp: %w[step-toward],
    ruby: %w[step_toward],
    point: "x と y のどちらか遠い軸を1歩進める。向きの -1 / 0 / 1 は、Lisp は signum、Ruby は比較演算子 `<=>` で出す。",
    note: "`(if 条件 A B)` も `if ... else ... end` も値を返す式なので、結果を返すだけでよい(return 不要)。",
  },
  {
    title: "1手進める",
    lisp: %w[next-state],
    ruby: %w[next_state],
    point: "プレイヤーを動かし、コインを拾い、(偶数ターンなら)敵を動かして、新しい状態を作って返す。元の状態は書き換えない。",
    note: "mapcar + lambda は map + ブロック、`remove` は配列の引き算 `-`、`evenp` は `.even?`。`let*` は「上から順に変数を作る」let で、Ruby の代入を並べるのと同じ。やっていることは同じで、Ruby のほうがメソッドを後ろにつなぐ書き方。",
  },
  {
    title: "盤を描く",
    lisp: %w[cell-char draw],
    ruby: %w[cell_char draw],
    point: "各マスに何があるかを順に調べて、最初に当てはまった記号を返す。",
    note: "Lisp の cond は Ruby の if / elsif。dotimes は `N.times do |i| ... end`(ブロックの形)。",
  },
  {
    title: "コインをばらまく",
    lisp: %w[random-coins],
    ruby: %w[random_coins],
    point: "Lisp 版は「ランダムな位置を引いて、空いていれば採用」を数が揃うまで繰り返す。Ruby 版は「空きマスの一覧を作って、そこから n 個選ぶ」。",
    note: "Ruby の `product`(総当たりの組)と `sample` は標準で用意されている。Lisp でも書けるが、ここでは素朴にループで書いた。",
  },
  {
    title: "ゲームのループ",
    lisp: %w[play],
    ruby: %w[play],
    point: "一番大きな違い。Lisp 版は `play` が自分自身を呼ぶ再帰で、状態を書き換えず新しい状態を次に渡す。Ruby 版は `loop` で回し、変数 g と turn を更新していく。",
    note: "Ruby でも再帰で書けるし、Lisp にも `loop` がある。どちらが「普通」かという言語の流儀の違い。",
  },
].freeze

# 同じ配置・同じキー入力で両方を動かして、画面が一致するか見る。
# coins は [x, y]。プレイヤー(0,0)と敵の初期位置(8,0)(8,6)(0,6)は避ける。
SCENARIOS = [
  { title: "全部集めてクリア", coins: [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], keys: %w[d d d d d] },
  { title: "動かずに敵につかまる", coins: [[4, 3], [5, 3], [6, 3], [4, 4], [5, 4]], keys: ["x"] * 14 },
  { title: "途中でやめる", coins: [[1, 1], [2, 2], [3, 3], [7, 3], [6, 5]], keys: %w[d s d q] },
].freeze
