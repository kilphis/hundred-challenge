# 一括実行（画面なし）: julia --project=. batch.jl
#   遅れ 0,5,10,15,20 分 × 乱数の種 × 60分 → results.md と shots/ の PNG 2枚
using Agents, Random, Statistics, Printf, GLMakie
const ROOT = @__DIR__
for f in ("defs", "city", "tsunami", "rules", "model", "view")
    include(joinpath(ROOT, "src", "$f.jl"))
end
GLMakie.activate!(visible = false)
setup_theme!()

const DELAYS = [0, 5, 10, 15, 20]
const SEEDS = 1:5
const CAPS = [2, 4, 6, 8]            # 付録: cell_cap を変えたときの比較

city = build_city()                   # 町は全実行で共有（読むだけ）

function run_one(; delay_min, seed, cell_cap = CELL_CAP)
    m = make_model(; seed, delay_min, cell_cap, city)
    step!(m, N_STEPS)
    return (safe = m.n_safe, caught = m.n_caught, active = n_active(m),
            used = [s.used for s in m.shelters], wait = m.wait_total)
end

t0 = time()
rows = map(DELAYS) do d
    rs = [run_one(delay_min = d, seed = s) for s in SEEDS]
    n = N_PEOPLE
    (delay = d, safe = mean(r.safe for r in rs) / n, caught = mean(r.caught for r in rs) / n,
     active = mean(r.active for r in rs) / n, used = mean(r.used for r in rs),
     wait = mean(r.wait for r in rs))
end
cap_rows = [(cap = c, caught = [mean(run_one(delay_min = d, seed = s, cell_cap = c).caught for s in SEEDS) / N_PEOPLE
                                for d in DELAYS]) for c in CAPS]

pct(x) = @sprintf("%.1f%%", 100x)
names = [s.name for s in make_shelters()]
open(joinpath(ROOT, "results.md"), "w") do io
    println(io, "# day42 津波避難シミュレータ: 一括実行の結果\n")
    println(io, "人数 $(N_PEOPLE)、cell_cap = $(CELL_CAP)、乱数の種 $(length(SEEDS)) 個（$(first(SEEDS))〜$(last(SEEDS))）の平均、$(N_STEPS) ステップ（60分）。津波は $(T_ARRIVE ÷ STEPS_PER_MIN) 分後に到達。\n")
    println(io, "| 平均の遅れ（分） | 助かった割合 | 流された割合 | 60分時点で逃げ切れていない割合 | 詰まりで待った延べ（人・ステップ） | 避難所ごとの利用数（平均）: ", join(names, " / "), " |")
    println(io, "|---:|---:|---:|---:|---:|---|")
    for r in rows
        println(io, "| $(r.delay) | $(pct(r.safe)) | $(pct(r.caught)) | $(pct(r.active)) | $(round(Int, r.wait)) | ",
                join((@sprintf("%.0f", u) for u in r.used), " / "), " |")
    end
    println(io, "\n## 付録: cell_cap を変えたときの流された割合（同じ種）\n")
    println(io, "| cell_cap | ", join(("遅れ $d 分" for d in DELAYS), " | "), " |")
    println(io, "|---:|", join(fill("---:", length(DELAYS)), "|"), "|")
    for r in cap_rows
        println(io, "| $(r.cap) | ", join(pct.(r.caught), " | "), " |")
    end
end

# 画像: delay_min = 10, 種 1 の 15分時点と 25分時点
mkpath(joinpath(ROOT, "shots"))
m = make_model(; seed = 1, delay_min = 10, city)
step!(m, 15 * STEPS_PER_MIN)
snapshot(m, joinpath(ROOT, "shots", "delay10_t15min.png"))
step!(m, 10 * STEPS_PER_MIN)
snapshot(m, joinpath(ROOT, "shots", "delay10_t25min.png"))

println("経過 ", round(time() - t0, digits = 1), " 秒")
for r in rows
    @printf("遅れ%2d分: 助かった %5.1f%% 流された %5.1f%% 逃げ中 %4.1f%% 待った延べ %d\n",
            r.delay, 100r.safe, 100r.caught, 100r.active, round(Int, r.wait))
end
println(read(joinpath(ROOT, "results.md"), String))
