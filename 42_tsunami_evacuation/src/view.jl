# 画面: 背景の画像・色・表示の補助（GLMakie）

function setup_theme!()
    f = "Hiragino Sans"      # タイトルは bold を使うので4種とも同じ日本語フォントにする
    set_theme!(fonts = (; regular = f, bold = f, italic = f, bold_italic = f), fontsize = 14)
end

lerp(c1, c2, f) = RGBAf((1 - f) * c1.r + f * c2.r, (1 - f) * c1.g + f * c2.g, (1 - f) * c1.b + f * c2.b, 1)

# 背景（静止）の色。低い陸 = 薄い黄緑、高い陸 = 濃い緑、道 = 灰、街区 = 暗い灰、海 = 紺、高台 = 明るい緑、避難ビル = 薄い灰
function background_colors(model)
    low, high = RGBAf(0.85, 0.92, 0.55), RGBAf(0.12, 0.45, 0.2)
    img = fill(RGBAf(0, 0, 0, 1), W, H)
    for y in 1:H, x in 1:W
        e = model.elev[x, y]
        sid = model.shelter_id[x, y]
        img[x, y] =
            y <= SEA_Y ? RGBAf(0.04, 0.14, 0.38, 1) :
            sid > 0 && model.shelters[sid].kind === :hill ? lerp(RGBAf(0.55, 0.9, 0.45), RGBAf(0.3, 0.75, 0.3), clamp((e - 20) / 12, 0, 1)) :
            sid > 0 ? RGBAf(0.93, 0.93, 0.93, 1) :
            model.road[x, y] ? RGBAf(0.62, 0.62, 0.64, 1) :
            y in TOWN_Y ? RGBAf(0.27, 0.27, 0.3, 1) :
            y in BEACH_Y ? RGBAf(0.93, 0.87, 0.65, 1) :
            lerp(low, high, clamp(e / 25, 0, 1))
    end
    return img
end

# 浸水深の行列。浸水していないマスは NaN（透明）
water_matrix(m) = [d > 0 ? d : NaN for d in m.depth]

# 背景・水・ラベルを描く（abmplot の preplot!。水の上に人が描かれる）
function draw_town!(ax, abmobs)
    model = abmobs.model[]
    hidedecorations!(ax)
    image!(ax, 0.5 .. W + 0.5, 0.5 .. H + 0.5, background_colors(model); interpolate = false)
    for s in model.shelters                        # 避難ビルの白枠
        if s.kind === :building
            xs, ys = extrema(first.(s.cells)), extrema(last.(s.cells))
            poly!(ax, Rect(xs[1] - 0.5, ys[1] - 0.5, xs[2] - xs[1] + 1, ys[2] - ys[1] + 1);
                  color = :transparent, strokecolor = :white, strokewidth = 2)
        end
    end
    water = lift(m -> water_matrix(m), abmobs.model)
    heatmap!(ax, 1:W, 1:H, water; colorrange = (0, 6), nan_color = :transparent,
             colormap = [RGBAf(0.5, 0.85, 1, 0.5), RGBAf(0.0, 0.3, 0.9, 0.85)],
             highclip = RGBAf(0.0, 0.1, 0.6, 0.9))
    for h in HILLS
        text!(ax, h.center...; text = h.name, align = (:center, :center), color = (:black, 0.7), fontsize = 16)
    end
    for b in BUILDINGS
        text!(ax, b.x0 + 1, b.y0 + 4.5; text = "避難ビル", align = (:center, :center), color = :white, fontsize = 11)
    end
    text!(ax, W - 6, 2.5; text = "海", align = (:center, :center), color = (:white, 0.6), fontsize = 14)
    # 凡例（海の帯に）
    for (x, str, col) in [(4, "● 待っている", COLOR_WAITING), (24, "● 逃げている", COLOR_MOVING),
                          (44, "● 高齢者", COLOR_ELDERLY), (62, "× 流された", "#ff6b6b")]
        text!(ax, x, 2.5; text = str, align = (:left, :center), color = col, fontsize = 13)
    end
    on(abmobs.model; update = true) do m
        ax.title[] = title_text(m)
    end
    return
end

title_text(m) = "地震から $(clock(m.t)) ／ 津波到達 $(clock(T_ARRIVE))　　" *
                "助かった $(m.n_safe)　流された $(m.n_caught)　まだ逃げている $(n_active(m))　" *
                "（平均の遅れ $(round(Int, m.delay_min)) 分・1マス $(m.cell_cap) 人まで）"

# 人の見た目
person_color(a) = a.state === :caught ? CAUGHT_COLOR :
                  a.state === :waiting ? COLOR_WAITING :
                  a.elderly ? COLOR_ELDERLY : COLOR_MOVING
person_size(a) = a.state === :caught ? SIZE_CAUGHT : a.elderly ? SIZE_ELDERLY : SIZE_PERSON
person_marker(a) = a.state === :caught ? :xcross : :circle
# 同じマスの人が重ならないよう、id から決めた小さなずらし
person_offset(a) = (((a.id * 7919) % 100) / 100 - 0.5) * 0.8, (((a.id * 104729) % 100) / 100 - 0.5) * 0.8

# abmplot / abmexploration に共通のキーワード
function view_kwargs(; figsize = (1500, 950))
    (; agent_color = person_color, agent_size = person_size, agent_marker = person_marker,
       offset = person_offset, preplot! = draw_town!,
       figure = (size = figsize,), axis = (titlesize = 17, limits = (0.5, W + 0.5, 0.5, H + 0.5)))
end

# 画面なしで1枚保存する（batch.jl 用）
function snapshot(model, path; figsize = (1500, 1000))
    fig, ax, abmobs = abmplot(model; view_kwargs(; figsize)...)
    save(path, fig)
    return path
end

# ---- 説明タブ（中身は explain.jl の EXPLAIN_TABS） ----
# 地図の上にタブの列を足す。「地図」以外を選ぶと、地図の上に説明の板を重ねる（シミュレーションは裏で動き続ける）。
const TAB_ON = RGBf(0.16, 0.38, 0.62)
const TAB_OFF = RGBf(0.90, 0.90, 0.90)
const PANEL_COLOR = RGBf(0.99, 0.99, 0.97)
const EXPLAIN_HEAD = RGBf(0.02, 0.22, 0.45)
const EXPLAIN_FORMULA = RGBf(0.50, 0.10, 0.02)
const EXPLAIN_TEXT = RGBf(0.0, 0.0, 0.0)

function explain_text(tab)
    parts = Any[]
    for (i, (kind, s)) in enumerate(tab.lines)
        i > 1 && push!(parts, kind === :h ? "\n\n" : "\n")
        push!(parts, kind === :h ? rich(s; color = EXPLAIN_HEAD, fontsize = 15) :
                     kind === :f ? rich(s; color = EXPLAIN_FORMULA) : rich(s; color = EXPLAIN_TEXT))
    end
    return rich(parts...)
end

# 戻り値は select!(k)。k = 0 で地図、k ≥ 1 で EXPLAIN_TABS[k] を出す
function add_explain_tabs!(fig)
    ax = first(c for c in fig.content if c isa Axis)                 # 最初に作られた Axis が地図
    gl = ax.layoutobservables.gridcontent[].parent
    bar = gl[0, 1] = GridLayout(tellwidth = false, halign = :left)    # 地図の上に1行足す
    rowsize!(gl, 2, Aspect(1, H / W))   # 地図の行の高さを幅から決める（決めないと余った高さがタブの行に回る）
    names = ["地図"; [t.name for t in EXPLAIN_TABS]]
    btns = [Button(bar[1, i]; label = n, fontsize = 14, cornerradius = 4,
                   buttoncolor_hover = RGBf(0.80, 0.85, 0.92)) for (i, n) in enumerate(names)]
    panel = Box(fig; bbox = ax.scene.viewport, color = PANEL_COLOR, strokecolor = :gray60, z = 100)
    lab = Label(fig; bbox = ax.scene.viewport, text = "", fontsize = 13, lineheight = 1.15,
                halign = :left, valign = :top, justification = :left, padding = (28, 28, 20, 22))
    translate!(lab.blockscene, 0, 0, 101)
    function select!(k)
        for (i, b) in enumerate(btns)
            b.buttoncolor[] = i - 1 == k ? TAB_ON : TAB_OFF
            b.labelcolor[] = i - 1 == k ? :white : :black
        end
        panel.visible[] = k > 0
        lab.visible[] = k > 0
        k > 0 && (lab.text[] = explain_text(EXPLAIN_TABS[k]))
        return k
    end
    for (i, b) in enumerate(btns)
        on(_ -> select!(i - 1), b.clicks)
    end
    select!(0)
    return select!, lab, ax, bar
end
