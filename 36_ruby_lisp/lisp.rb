# 小さな Lisp(Ruby で書いた)。
#   Lisp のリスト   = Ruby の Array
#   Lisp のシンボル = Ruby の Symbol
#   Lisp の関数     = Ruby の lambda(そのまま Ruby の map に渡せる)
module Lisp
  Macro = Struct.new(:fn)

  class Env
    attr_reader :vars

    def initialize(vars = {}, outer = nil)
      @vars = vars
      @outer = outer
    end

    # name を持っている一番内側の環境を探す
    def lookup(name)
      return self if @vars.key?(name)
      raise NameError, "未定義: #{name}" unless @outer

      @outer.lookup(name)
    end

    def [](name)
      lookup(name).vars[name]
    end

    def []=(name, value)
      @vars[name] = value
    end
  end

  def self.tokenize(src)
    src.scan(/"(?:\\.|[^"\\])*"|;[^\n]*|[()']|[^\s()';]+/).reject { |t| t.start_with?(";") }
  end

  # トークン列 → 入れ子の Array。Lisp のコードがそのまま Ruby のデータになる
  def self.parse(tokens)
    t = tokens.shift
    case t
    when nil then raise SyntaxError, "式が途中で終わっている(カッコが足りない)"
    when ")" then raise SyntaxError, "余分な )"
    when "(" # 閉じカッコまでを1つの配列にする
      list = []
      raise SyntaxError, "カッコが足りない" if tokens.empty?
      list << parse(tokens) until tokens.first == ")"
      tokens.shift
      list
    when "'" then [:quote, parse(tokens)]
    when "#t" then true
    when "#f" then false
    when /\A-?\d+\z/ then t.to_i
    when /\A-?\d+\.\d+\z/ then t.to_f
    when /\A"(.*)"\z/m then Regexp.last_match(1)
    else t.to_sym
    end
  end

  def self.make_lambda(params, body, env)
    lambda do |*args|
      unless args.size == params.size
        raise ArgumentError, "引数は #{params.size} 個必要(#{args.size} 個渡された)"
      end

      local = Env.new(params.zip(args).to_h, env)
      body.reduce(nil) { |_, form| evaluate(form, local) }
    end
  end

  def self.evaluate(x, env)
    case x
    in Symbol then env[x]
    in [] then []
    in [:quote, v] then v
    in [:if, c, a, *rest]
      if evaluate(c, env)
        evaluate(a, env)
      elsif rest.any?
        evaluate(rest[0], env)
      end
    in [:define, [Symbol => name, *params], *body]
      env[name] = make_lambda(params, body, env)
    in [:define, Symbol => name, v]
      env[name] = evaluate(v, env)
    in [:set!, Symbol => name, v]
      env.lookup(name).vars[name] = evaluate(v, env)
    in [:lambda, params, *body]
      make_lambda(params, body, env)
    in [:defmacro, Symbol => name, params, *body]
      env[name] = Macro.new(make_lambda(params, body, env))
    in [:begin, *body]
      body.reduce(nil) { |_, form| evaluate(form, env) }
    in [f, *args]
      fn = evaluate(f, env)
      if fn.is_a?(Macro)
        evaluate(fn.fn.call(*args), env) # マクロ: 引数を評価せず渡し、返ってきたコードを評価する
      else
        fn.call(*args.map { |a| evaluate(a, env) })
      end
    else x
    end
  end

  def self.show(v)
    case v
    when true then "#t"
    when false then "#f"
    when nil then "nil"
    when Symbol then v.to_s
    when String then v.inspect
    when Array then "(#{v.map { |e| show(e) }.join(' ')})"
    when Proc then "#<lambda>"
    when Macro then "#<macro>"
    else v.to_s
    end
  end

  BUILTINS = {
    :+ => ->(*a) { a.sum },
    :- => ->(a, *r) { r.empty? ? -a : r.reduce(a, :-) },
    :* => ->(*a) { a.reduce(1, :*) },
    :/ => ->(a, b) { (a % b).zero? ? a / b : a.fdiv(b) },
    :mod => ->(a, b) { a % b },
    :< => ->(a, b) { a < b },
    :> => ->(a, b) { a > b },
    :<= => ->(a, b) { a <= b },
    :>= => ->(a, b) { a >= b },
    :"=" => ->(a, b) { a == b },
    :"eq?" => ->(a, b) { a.equal?(b) },
    :not => ->(a) { !a },
    :car => ->(l) { l.first },
    :cdr => ->(l) { l.drop(1) },
    :cons => ->(x, l) { [x, *l] },
    :list => ->(*a) { a },
    :"null?" => ->(l) { l.empty? },
    :length => ->(l) { l.size },
    :range => ->(n) { (0...n).to_a },
    :map => ->(f, l) { l.map { |e| f.call(e) } },
    :filter => ->(f, l) { l.select { |e| f.call(e) } },
    :reduce => ->(f, init, l) { l.reduce(init) { |acc, e| f.call(acc, e) } },
  }.freeze

  def self.new_env
    env = Env.new(BUILTINS.dup)
    env[:eval] = ->(code) { evaluate(code, env) }
    env
  end

  GLOBAL = new_env

  # ソース全体(複数の式)を順に評価して、最後の値を返す
  def self.run(src, env = GLOBAL)
    tokens = tokenize(src)
    result = nil
    result = evaluate(parse(tokens), env) until tokens.empty?
    result
  end
end
