# 各レッスンの中身。Lisp と Ruby のコードは、表示されたものがそのまま実行される。
LESSONS = [
  {
    title: "if も値を返す(全部が式)",
    point: "Lisp には「文」がなく、if も値を返す式。Ruby も同じ。if や case が値を返すし、メソッドは最後に評価した式が返り値になる(return 不要)。",
    lisp: <<~LISP,
      (if (> 3 2) "大きい" "小さい")
    LISP
    ruby: <<~RUBY,
      if 3 > 2 then "大きい" else "小さい" end
    RUBY
    note: "Ruby では `x = if ... end` のように、if の結果をそのまま変数に入れられる。",
  },
  {
    title: "リストと再帰",
    point: "Lisp は car(先頭)と cdr(残り)で再帰する。Ruby は `first, *rest = xs` で配列を「先頭と残り」に分けられる。",
    lisp: <<~LISP,
      (define (total xs)
        (if (null? xs)
            0
            (+ (car xs) (total (cdr xs)))))
      (total '(1 2 3 4))
    LISP
    ruby: <<~RUBY,
      def total(xs)
        if xs.empty?
          0
        else
          first, *rest = xs
          first + total(rest)
        end
      end
      total([1, 2, 3, 4])
    RUBY
    note: "`def ... end` がメソッド定義。`*rest` は「残りを全部集める」印。`[1, 2, 3]` が Lisp の '(1 2 3) にあたる。",
  },
  {
    title: "シンボル",
    point: "シンボルは「名前そのもの」。同じ名前は必ず同じ1個のオブジェクトになる(文字列は書くたびに別物)。Ruby の `:apple` は Lisp の 'apple に相当する。",
    lisp: <<~LISP,
      (list (eq? 'apple 'apple) (eq? "apple" "apple"))
    LISP
    ruby: <<~RUBY,
      [:apple.equal?(:apple), "apple".equal?("apple")]
    RUBY
    note: "Ruby ではハッシュのキー(`{ name: \"taro\" }`)やメソッド名をデータとして渡すときにシンボルを使う。8番目の「関数名をデータとして扱う」でも出てくる。",
  },
  {
    title: "無名関数(lambda)",
    point: "関数は値。名前なしで作って、変数に入れたり、他の関数に渡したりできる。",
    lisp: <<~LISP,
      ((lambda (x) (* x 2)) 21)
    LISP
    ruby: <<~RUBY,
      double = ->(x) { x * 2 }
      double.call(21)
    RUBY
    note: "`->(x) { ... }` が lambda。呼ぶときは `.call(21)`(`.(21)` や `[21]` とも書ける)。",
  },
  {
    title: "クロージャ",
    point: "関数は、作られた場所の変数を覚えたまま持ち歩く。make-counter が返した関数は、自分専用の n をずっと持っている。",
    lisp: <<~LISP,
      (define (make-counter)
        (define n 0)
        (lambda () (set! n (+ n 1)) n))
      (define c (make-counter))
      (c)
      (c)
      (c)
    LISP
    ruby: <<~RUBY,
      make_counter = -> {
        n = 0
        -> { n += 1 }
      }
      c = make_counter.call
      c.call
      c.call
      c.call
    RUBY
    note: "`n += 1` は `n = n + 1` の略。最後の `c.call` の値(3)が結果になる。",
  },
  {
    title: "高階関数(map / filter / reduce)",
    point: "関数を引数に取る関数。ループを書かずに「2より大きいものを選ぶ → 2乗 → 合計」と部品をつなぐ。",
    lisp: <<~LISP,
      (reduce + 0
        (map (lambda (x) (* x x))
          (filter (lambda (x) (> x 2)) '(1 2 3 4 5))))
    LISP
    ruby: <<~RUBY,
      [1, 2, 3, 4, 5]
        .select { |x| x > 2 }
        .map { |x| x * x }
        .inject(0, :+)
    RUBY
    note: "Ruby では filter が `select`、reduce が `inject`(どちらも別名あり)。`{ |x| ... }` は次の「ブロック」。`:+` は + というメソッド名のシンボル。",
  },
  {
    title: "ブロック",
    point: "Ruby 独自の書きやすい形。メソッド呼び出しの後ろに `{ |i| ... }` を付けると、それが関数として渡る。Lisp なら lambda を引数に書くところ。",
    lisp: <<~LISP,
      (define (repeat n f) (map f (range n)))
      (repeat 3 (lambda (i) (* i 10)))
    LISP
    ruby: <<~RUBY,
      def repeat(n)
        (0...n).map { |i| yield(i) }
      end
      repeat(3) { |i| i * 10 }
    RUBY
    note: "メソッド側は `yield(i)` で渡されたブロックを呼ぶ。引数に f を書かなくていい。(Ruby のブロックは Smalltalk の影響も強いと言われる)",
  },
  {
    title: "関数名をデータとして扱う",
    point: "Lisp ではコードがリストなので、プログラムでコードを組み立てて eval できる。Ruby のコードは配列ではないが、メソッド名をシンボルに入れて `send` で呼べば近いことができる。",
    lisp: <<~LISP,
      (eval (list '* 6 7))
    LISP
    ruby: <<~RUBY,
      op = :*
      6.send(op, 7)
    RUBY
    note: "Ruby では `6 * 7` の `*` は演算子ではなく、数 6 のメソッド `6.*(7)`。だから名前(シンボル)で呼べる。文字列から実行する `eval(\"6 * 7\")` もある。",
  },
  {
    title: "マクロと、評価を遅らせる",
    point: "Lisp のマクロは「評価する前のコード」を受け取って別のコードに書き換える。下の my-unless は条件が偽のときだけ本体を評価する。Ruby にマクロはないが、ブロックは yield されるまで実行されないので、評価を遅らせることができる。",
    lisp: <<~LISP,
      (defmacro my-unless (c body) (list 'if c #f body))
      (my-unless (> 1 2) "実行された")
    LISP
    ruby: <<~RUBY,
      def my_unless(c)
        yield unless c
      end
      my_unless(1 > 2) { "実行された" }
    RUBY
    note: "Ruby の `unless` は最初から言語に入っている(`\"実行された\" unless 1 > 2`)。ここでは仕組みを見るために自作した。",
  },
].freeze
