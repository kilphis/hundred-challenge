# 津波避難シミュレータ（対話画面）
#   julia --project=. run.jl
#   SMOKE=1 julia --project=. run.jl   # 画面なしで30ステップ進めて shots/run_smoke.png に保存
#                                       （説明タブの「何のシミュレーションか」を開いた画面も shots/run_explain.png に保存）
using Agents, Random, Statistics, Printf, GLMakie
const ROOT = @__DIR__
for f in ("defs", "city", "tsunami", "rules", "model", "explain", "view")
    include(joinpath(ROOT, "src", "$f.jl"))
end

const SMOKE = get(ENV, "SMOKE", "") == "1"
SMOKE && GLMakie.activate!(visible = false)
setup_theme!()

model = make_model()
fig, abmobs = abmexploration(model;
    view_kwargs()...,
    params = Dict(:delay_min => 0:1:30, :cell_cap => 1:8),
    mdata = [n_safe, n_caught, n_active],
    mlabels = ["助かった", "流された", "まだ逃げている"],
    dt = 1:30)
select_tab!, explain_label, map_ax, tab_bar = add_explain_tabs!(fig)     # 地図の上の「説明」タブ

if SMOKE
    Agents.step!(abmobs, 30)
    mkpath(joinpath(ROOT, "shots"))
    save(joinpath(ROOT, "shots", "run_smoke.png"), fig)
    println("SMOKE ok: t = ", abmobs.model[].t, ", 助かった ", abmobs.model[].n_safe)
    # 説明タブ: 文字が地図の枠からはみ出していないかを数で確かめ、いちばん長いタブを1枚保存する
    vp = map_ax.scene.viewport[].widths
    gap = tab_bar.layoutobservables.computedbbox[].origin[2] - sum(map_ax.scene.viewport[].origin[2] + vp[2])
    @printf("タブの列の下端と地図の上端の間: %.0f（題字の高さを含む）\n", gap)
    for k in eachindex(EXPLAIN_TABS)
        select_tab!(k)
        w, h = explain_label.layoutobservables.autosize[]
        @printf("タブ%d %s: 文字の高さ %.0f / 地図 %.0f、幅 %s / %.0f\n", k, EXPLAIN_TABS[k].name, h, vp[2],
                w === nothing ? "-" : @sprintf("%.0f", w), vp[1])
    end
    select_tab!(1)
    save(joinpath(ROOT, "shots", "run_explain.png"), fig)
else
    screen = display(fig)
    wait(screen)
end
