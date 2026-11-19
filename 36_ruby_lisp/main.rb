#!/usr/bin/env ruby
# 使い方:
#   ruby main.rb        レッスンを Enter で1つずつ進める
#   ruby main.rb all    全レッスンを一気に表示(Lisp と Ruby の結果が違えば終了コード 1)
#   ruby main.rb repl   小さな Lisp を触る
#   ruby main.rb game   コイン集めゲームの Lisp 版と Ruby 版を並べて比べる
require_relative "lisp"
require_relative "lessons"
require_relative "ui"
require_relative "game_tour"

# Lisp は自作インタプリタで、Ruby は本物の Ruby で実行する
def run_lisp(code)
  Lisp.show(Lisp.run(code, Lisp.new_env))
rescue StandardError, SyntaxError => e
  "エラー: #{e.message}"
end

def run_ruby(code)
  Lisp.show(Object.new.instance_eval(code))
rescue StandardError, SyntaxError => e
  "エラー: #{e.message}"
end

def show_lesson(lesson, index, total)
  puts "\n#{BOLD}━━ #{index}/#{total}  #{lesson[:title]} ━━#{OFF}\n\n"
  puts "  #{lesson[:point]}\n\n"
  lisp_result = run_lisp(lesson[:lisp])
  ruby_result = run_ruby(lesson[:ruby])

  puts "  #{LISP_COLOR}Lisp#{OFF}"
  puts indent(lesson[:lisp])
  puts "    #{LISP_COLOR}→ #{lisp_result}#{OFF}\n\n"
  puts "  #{RUBY_COLOR}Ruby#{OFF}"
  puts indent(lesson[:ruby])
  puts "    #{RUBY_COLOR}→ #{ruby_result}#{OFF}\n\n"

  same = lisp_result == ruby_result
  puts(same ? "  ✔ 同じ結果" : "  ✘ 結果が違う")
  puts "  #{DIM}Ruby メモ: #{lesson[:note]}#{OFF}"
  same
end

def tour(pause:)
  total = LESSONS.size
  puts "#{BOLD}Ruby の中の Lisp#{OFF}  (Lisp は自作の小さなインタプリタ、Ruby は本物で実行しています)"
  results = LESSONS.each_with_index.map do |lesson, i|
    same = show_lesson(lesson, i + 1, total)
    if pause && i < total - 1
      print "\n  #{DIM}[Enter で次へ / q で終了]#{OFF} "
      break nil if ($stdin.gets || "q").strip == "q"
    end
    same
  end
  return true unless results

  puts "\n#{BOLD}おしまい。#{OFF} `ruby main.rb repl` で Lisp を自分で書いて触れます。"
  results.all?
end

def balanced?(src)
  src.count("(") <= src.count(")")
end

def repl
  puts "小さな Lisp。:q で終了。例: (define (sq x) (* x x))  (map sq '(1 2 3))"
  env = Lisp.new_env
  buf = +""
  loop do
    print(buf.empty? ? "#{LISP_COLOR}λ> #{OFF}" : "   ")
    line = $stdin.gets or break
    break if buf.empty? && line.strip == ":q"

    buf << line
    next unless balanced?(buf)

    begin
      tokens = Lisp.tokenize(buf)
      until tokens.empty?
        form = Lisp.parse(tokens)
        puts "#{DIM}  Ruby から見ると: #{form.inspect}#{OFF}"
        puts Lisp.show(Lisp.evaluate(form, env))
      end
    rescue StandardError, SyntaxError => e
      puts "エラー: #{e.message}"
    end
    buf = +""
  end
end

case ARGV[0]
when "repl" then repl
when "game" then exit(game_tour(pause: $stdin.tty?) ? 0 : 1)
when "all" then exit(tour(pause: false) ? 0 : 1)
else tour(pause: $stdin.tty?)
end
