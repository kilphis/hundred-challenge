# main.rb と game_tour.rb が共有する画面の道具
LISP_COLOR = "\e[36m"
RUBY_COLOR = "\e[31m"
DIM = "\e[2m"
BOLD = "\e[1m"
OFF = "\e[0m"

def indent(code)
  code.lines.map { |l| "    #{l}" }.join
end
