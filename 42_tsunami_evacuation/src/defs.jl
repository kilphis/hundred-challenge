# 数値の定義だけを集めたファイル。調整はここだけ見ればよい。
# 単位: 1マス = 10 m、1ステップ = 10 秒、60分 = 360ステップ。

# --- 時間 ---
const STEPS_PER_MIN = 6           # 1分 = 6ステップ
const N_STEPS = 360               # 60分

# --- 格子（y=1 が南の海側、y=80 が北の山側） ---
const W = 120
const H = 80
const SEA_Y = 5                   # y ≤ 5 は海
const BEACH_Y = 6:7               # 砂浜（歩けない）
const TOWN_Y = 8:66               # 街区（家）の範囲。道以外は歩けない

# --- 道 ---
# 横の道: (y, x0, x1)
const H_ROADS = [(8, 4, 112), (18, 4, 112), (28, 4, 112), (38, 4, 112),
                 (50, 4, 112), (62, 4, 112), (66, 16, 100)]
# 縦の道: (x, y0, y1)。16・28・100 は丘のふもと (y=70) まで延びる
const V_ROADS = [(4, 8, 62), (16, 8, 70), (28, 8, 70), (40, 8, 62), (52, 8, 62),
                 (76, 8, 62), (88, 8, 62), (100, 8, 70), (112, 8, 62)]
# 大通り: x = 63〜65、y = 8〜66
const AVENUE = (63, 65, 8, 66)

# --- 避難所 ---
# 高台: x・y の範囲、定員、丘の中心
const HILLS = [(name = "高台A", xs = 12:34, ys = 70:78, cap = 1500, center = (23, 75)),
               (name = "高台B", xs = 94:110, ys = 70:78, cap = 1500, center = (102, 75))]
# 津波避難ビル: 左下の角
const BUILDINGS = [(name = "避難ビル1", x0 = 41, y0 = 19),
                   (name = "避難ビル2", x0 = 77, y0 = 19),
                   (name = "避難ビル3", x0 = 101, y0 = 29)]
const BUILDING_SIZE = 3           # 3×3 マス
const BUILDING_CAP = 120
const BUILDING_HEIGHT = 15.0      # m。day42 では浸水深がこれを超えないので常に安全

# --- 標高 (m) ---
const SEA_ELEV = -5.0
const SLOPE = 0.12                # 陸は SLOPE * (y - SEA_Y)
const HILL_PEAK = 18.0            # 丘のガウス型の高さ
const HILL_SIGMA = 8.0            # 丘の幅（マス）
const HILL_MIN_ELEV = 20.0        # 高台の範囲はこれ以上にそろえる

# --- 津波 ---
const T_ARRIVE = 20 * STEPS_PER_MIN   # 到達時刻（ステップ）
const T_RISE = 5 * STEPS_PER_MIN      # 到達から最大の高さになるまで
const H_MAX = 8.0                     # 海岸での最大の高さ (m)
const DECAY = 0.02                    # 陸に1マス進むごとに水位が下がる量 (m)
const FRONT_SPEED = 2                 # 浸水の先端が1ステップに進むマス数
const CAUGHT_DEPTH = 0.5              # この浸水深で「流された」(m)

# --- 人 ---
const N_PEOPLE = 3000
const SPAWN_Y = 8:62                  # 最初に道のマスへ置く範囲
const ELDERLY_RATE = 0.25
const SPEED_ELDERLY = 0.5             # マス/ステップ
const SPEED_RANGE = (1.0, 1.3)
const DELAY_MIN = 10.0                # 避難を始めるまでの平均の遅れ（分）
const CELL_CAP = 6                    # 1マスに入れる人数（SPEC は 4。詰まりが強すぎるので 6 にした。SPEC.md 実装メモ参照）
const PROGRESS_CLIP = 0.999           # 詰まったとき progress をこの値以下に切り詰める

# --- 画面 ---
const CAUGHT_COLOR = :red
const COLOR_WAITING = "#ff9800"
const COLOR_MOVING = "#ffffff"
const COLOR_ELDERLY = "#c7b6ff"
const SIZE_PERSON = 6
const SIZE_ELDERLY = 5
const SIZE_CAUGHT = 8
