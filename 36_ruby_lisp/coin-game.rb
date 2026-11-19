# コイン集めゲーム (Ruby)。coin-game.lisp と同じ動き。
# 実行:  ruby coin-game.rb
# 操作:  w a s d + Enter で移動、q でやめる

WIDTH = 9
HEIGHT = 7
COIN_COUNT = 5

# ゲームの状態。位置は [x, y] の配列。Data は作ったあと書き換えられない。
Game = Data.define(:player, :coins, :enemies)

def inside?(p)
  p[0].between?(0, WIDTH - 1) && p[1].between?(0, HEIGHT - 1)
end

# --- 動き ---

def move_player(p, key)
  x, y = p
  new = case key
        when "w" then [x, y - 1]
        when "s" then [x, y + 1]
        when "a" then [x - 1, y]
        when "d" then [x + 1, y]
        else p
        end
  inside?(new) ? new : p
end

def step_toward(from, to)
  dx = to[0] - from[0]
  dy = to[1] - from[1]
  if dx.abs >= dy.abs
    [from[0] + (dx <=> 0), from[1]]
  else
    [from[0], from[1] + (dy <=> 0)]
  end
end

def next_state(g, key, turn)
  player = move_player(g.player, key)
  coins = g.coins - [player]
  enemies = turn.even? ? g.enemies.map { |e| step_toward(e, player) } : g.enemies
  Game.new(player:, coins:, enemies:)
end

# --- 表示 ---

def cell_char(g, p)
  if g.enemies.include?(p) then "X "
  elsif p == g.player then "@ "
  elsif g.coins.include?(p) then "$ "
  else ". "
  end
end

def draw(g)
  HEIGHT.times do |y|
    puts((0...WIDTH).map { |x| cell_char(g, [x, y]) }.join)
  end
end

# --- 初期状態 ---

def random_coins(n, taken)
  cells = (0...WIDTH).to_a.product((0...HEIGHT).to_a) - taken
  cells.sample(n)
end

# テスト用: 環境変数 COINS="3,1 5,2" でコインの位置を固定できる
def coins_from_env
  ENV["COINS"]&.split&.map { |s| s.split(",").map(&:to_i) }
end

def new_game
  player = [0, 0]
  enemies = [[WIDTH - 1, HEIGHT - 1], [WIDTH - 1, 0], [0, HEIGHT - 1]]
  coins = coins_from_env || random_coins(COIN_COUNT, [player, *enemies])
  Game.new(player:, coins:, enemies:)
end

# --- ゲームループ ---

def read_key
  line = $stdin.gets
  return "q" if line.nil?

  line.chomp.empty? ? " " : line[0].downcase
end

def play(g)
  turn = 0
  loop do
    puts "\nコイン残り #{g.coins.size}   (w a s d + Enter で移動, q でやめる)"
    draw(g)
    if g.enemies.include?(g.player)
      puts "\nX につかまった。ゲームオーバー (#{turn}手)"
      break
    elsif g.coins.empty?
      puts "\n全部集めた! クリア (#{turn}手)"
      break
    end

    print "> "
    $stdout.flush
    key = read_key
    if key == "q"
      puts "\nやめました。"
      break
    end
    turn += 1
    g = next_state(g, key, turn)
  end
end

play(new_game)
