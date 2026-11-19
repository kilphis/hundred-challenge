# コイン集めゲームを題材にした Lisp と Ruby の対訳(ruby main.rb game)
require "open3"
require_relative "ui"
require_relative "game_parts"

LISP_FILE = File.join(__dir__, "coin-game.lisp")
RUBY_FILE = File.join(__dir__, "coin-game.rb")

# (defun 名前 ...) / (defstruct 名前 ...) を、カッコが閉じるところまで抜き出す
def lisp_form(src, name)
  lines = src.lines
  start = lines.index { |l| l.match?(/\A\(def\w+ #{Regexp.escape(name)}[\s)]/) } or raise "Lisp に #{name} がない"
  depth = 0
  lines[start..].each_with_object([]) do |l, out|
    out << l
    code = l.gsub(/"(?:\\.|[^"\\])*"/, "").sub(/;.*/, "")
    depth += code.count("(") - code.count(")")
    break out if depth <= 0
  end.join
end

# def 名前 ... end(同じ深さの end まで) か、`名前 = ...` の1行を抜き出す
def ruby_form(src, name)
  lines = src.lines
  start = lines.index { |l| l.match?(/\A(def #{Regexp.escape(name)}(?=[(\s])|#{Regexp.escape(name)} = )/) } or raise "Ruby に #{name} がない"
  return lines[start] unless lines[start].start_with?("def ")

  stop = (start...lines.size).find { |i| lines[i] == "end\n" } or raise "end が見つからない"
  lines[start..stop].join
end

def forms(src, names, extractor)
  names.map { |n| send(extractor, src, n) }.join("\n")
end

# 画面の比較用: 空行と行末の空白は無視する(Lisp と Ruby で改行の出し方が少し違うため)
def normalize(out)
  out.lines.map(&:rstrip).reject(&:empty?)
end

def run_program(cmd, coins_env, keys)
  out, = Open3.capture2({ "COINS" => coins_env }, *cmd, stdin_data: keys.join("\n") + "\n", chdir: __dir__)
  normalize(out)
end

def show_part(part, index, total, lisp_src, ruby_src)
  puts "\n#{BOLD}━━ #{index}/#{total}  #{part[:title]} ━━#{OFF}\n\n"
  puts "  #{part[:point]}\n\n"
  puts "  #{LISP_COLOR}Lisp#{OFF}"
  puts indent(forms(lisp_src, part[:lisp], :lisp_form)), ""
  puts "  #{RUBY_COLOR}Ruby#{OFF}"
  puts indent(forms(ruby_src, part[:ruby], :ruby_form)), ""
  puts "  #{DIM}違い: #{part[:note]}#{OFF}"
end

def run_scenarios
  puts "\n#{BOLD}━━ 実行して比べる ━━#{OFF}\n\n"
  puts "  同じコイン配置・同じキー入力で、本物の sbcl と ruby の両方を動かして画面を突き合わせます。"
  unless system("which sbcl > /dev/null 2>&1")
    puts "\n  sbcl が見つからないので省略します(brew install sbcl)。"
    return true
  end

  SCENARIOS.map do |s|
    lisp_out = run_program(["sbcl", "--script", LISP_FILE], "(#{s[:coins].map { |x, y| "(#{x} . #{y})" }.join(' ')})", s[:keys])
    ruby_out = run_program(["ruby", RUBY_FILE], s[:coins].map { |c| c.join(",") }.join(" "), s[:keys])
    screens = lisp_out.count { |l| l.start_with?("コイン残り") }
    same = lisp_out == ruby_out
    puts "\n  ■ #{s[:title]}  (入力: #{s[:keys].join(' ')})"
    puts "    最後の画面:"
    puts indent(lisp_out.last(9).map { |l| "#{l}\n" }.join).gsub(/^/, "  ")
    puts(same ? "    ✔ 全 #{screens} 画面が一致" : "    ✘ 画面が違う: #{(lisp_out - ruby_out).first(2).inspect} / #{(ruby_out - lisp_out).first(2).inspect}")
    same
  end.all?
end

def game_tour(pause:)
  lisp_src = File.read(LISP_FILE)
  ruby_src = File.read(RUBY_FILE)
  total = GAME_PARTS.size
  puts "#{BOLD}コイン集めゲームで比べる Lisp と Ruby#{OFF}  (コードは coin-game.lisp / coin-game.rb から抜き出しています)"
  GAME_PARTS.each_with_index do |part, i|
    show_part(part, i + 1, total, lisp_src, ruby_src)
    next unless pause

    print "\n  #{DIM}[Enter で次へ / q で終了]#{OFF} "
    return true if ($stdin.gets || "q").strip == "q"
  end
  ok = run_scenarios
  puts "\n#{BOLD}おしまい。#{OFF} 遊ぶなら `sbcl --script coin-game.lisp` / `ruby coin-game.rb`"
  ok
end
