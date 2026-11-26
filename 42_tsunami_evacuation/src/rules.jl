# 人の1ステップ。ここを書き換えると人の振る舞いが変わる。
# 使うもの: model.t, model.depth, model.dist, model.walkable, model.occ, model.shelters, model.shelter_id

# 避難を始めるステップ。delay_min を動かすと、まだ動いていない人の開始時刻もその場で変わる
start_step(a, model) = a.u * 2 * model.delay_min * STEPS_PER_MIN

has_room(model, k) = k > 0 && model.shelters[k].used < model.shelters[k].cap

# いまのマスから最も近い、空きのある避難所の番号（無ければ 0）
function nearest_open_shelter(model, pos)
    best, bestd = 0, typemax(Int)
    for k in eachindex(model.shelters)
        has_room(model, k) || continue
        d = model.dist[k][pos[1], pos[2]]
        if d < bestd
            best, bestd = k, d
        end
    end
    return best
end

# 動き先を選ぶ: 目標への距離がいまより小さく、人数が cell_cap 未満のマスのうち距離が最小のもの
# （同点はランダム）。無ければ nothing。満員の避難所のマスには入れない。
function choose_next(a, model)
    dist = model.dist[a.target]
    x, y = a.pos
    here = dist[x, y]
    best, bestd, ties = nothing, typemax(Int), 0
    for (dx, dy) in NEIGHBORS8
        nx, ny = x + dx, y + dy
        (1 <= nx <= W && 1 <= ny <= H) || continue
        model.walkable[nx, ny] || continue
        d = dist[nx, ny]
        d < here || continue
        model.occ[nx, ny] < model.cell_cap || continue
        sid = model.shelter_id[nx, ny]
        (sid == 0 || has_room(model, sid)) || continue
        if d < bestd
            best, bestd, ties = (nx, ny), d, 1
        elseif d == bestd
            ties += 1
            rand(abmrng(model)) < 1 / ties && (best = (nx, ny))
        end
    end
    return best
end

function person_step!(a, model)
    a.state === :caught && return
    x, y = a.pos
    if model.depth[x, y] >= CAUGHT_DEPTH                       # 流された
        a.state = :caught
        model.occ[x, y] -= 1
        model.n_caught += 1
        return
    end
    model.t < start_step(a, model) && return                   # まだ動かない
    a.state = :evacuating
    a.progress += a.speed
    while a.progress >= 1
        has_room(model, a.target) || (a.target = nearest_open_shelter(model, a.pos))
        nxt = a.target == 0 ? nothing : choose_next(a, model)
        if nxt === nothing                                     # 詰まり: その場で待つ
            model.wait_total += 1
            a.progress = min(a.progress, PROGRESS_CLIP)
            return
        end
        model.occ[x, y] -= 1
        a.progress -= 1
        sid = model.shelter_id[nxt[1], nxt[2]]
        if sid > 0                                             # 避難所に着いた
            model.shelters[sid].used += 1
            model.n_safe += 1
            remove_agent!(a, model)
            return
        end
        move_agent!(a, nxt, model)
        x, y = nxt
        model.occ[x, y] += 1
    end
    return
end
