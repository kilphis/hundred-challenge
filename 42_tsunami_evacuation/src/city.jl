# 町: 標高・道・避難所・歩けるマス・距離の場

mutable struct Shelter
    name::String
    kind::Symbol                      # :hill / :building
    cells::Vector{Tuple{Int,Int}}
    cap::Int
    used::Int                         # 逃げ込んだ人数
    height::Float64                   # 避難ビルの高さ (m)。高台は Inf
end

# モデルごとに作り直す（used が変わるため）
function make_shelters()
    sh = Shelter[]
    for h in HILLS
        push!(sh, Shelter(h.name, :hill, [(x, y) for x in h.xs for y in h.ys], h.cap, 0, Inf))
    end
    for b in BUILDINGS
        cells = [(b.x0 + i, b.y0 + j) for i in 0:BUILDING_SIZE-1 for j in 0:BUILDING_SIZE-1]
        push!(sh, Shelter(b.name, :building, cells, BUILDING_CAP, 0, BUILDING_HEIGHT))
    end
    return sh
end

# 標高 elev[x, y] (m)
function make_elev()
    elev = zeros(W, H)
    for x in 1:W, y in 1:H
        elev[x, y] = y <= SEA_Y ? SEA_ELEV : SLOPE * (y - SEA_Y)
        for h in HILLS
            r2 = (x - h.center[1])^2 + (y - h.center[2])^2
            elev[x, y] += HILL_PEAK * exp(-r2 / (2 * HILL_SIGMA^2))
        end
    end
    for h in HILLS, x in h.xs, y in h.ys          # 高台の範囲は HILL_MIN_ELEV 以上にそろえる
        elev[x, y] = max(elev[x, y], HILL_MIN_ELEV)
    end
    # 海の上は丘の裾の影響を受けないよう元に戻す
    for x in 1:W, y in 1:SEA_Y
        elev[x, y] = SEA_ELEV
    end
    return elev
end

# 道のマス（高台・避難ビルは含まない）
function make_road()
    road = falses(W, H)
    for (y, x0, x1) in H_ROADS, x in x0:x1
        road[x, y] = true
    end
    for (x, y0, y1) in V_ROADS, y in y0:y1
        road[x, y] = true
    end
    x0, x1, y0, y1 = AVENUE
    road[x0:x1, y0:y1] .= true
    return road
end

# 歩けるマス = 道 ∪ 高台 ∪ 避難ビル。shelter_id[x,y] はそのマスの避難所番号（無ければ 0）
function make_walkable(road, shelters)
    walkable = copy(road)
    shelter_id = zeros(Int, W, H)
    for (k, s) in enumerate(shelters), (x, y) in s.cells
        walkable[x, y] = true
        shelter_id[x, y] = k
    end
    return walkable, shelter_id
end

const NEIGHBORS8 = [(dx, dy) for dx in -1:1 for dy in -1:1 if !(dx == 0 && dy == 0)]

# 避難所 k のマスから、歩けるマスの上で8近傍の幅優先探索。届かないマスは typemax(Int)
function bfs_dist(walkable, cells)
    dist = fill(typemax(Int), W, H)
    queue = Tuple{Int,Int}[]
    for (x, y) in cells
        dist[x, y] = 0
        push!(queue, (x, y))
    end
    head = 1
    while head <= length(queue)
        x, y = queue[head]; head += 1
        for (dx, dy) in NEIGHBORS8
            nx, ny = x + dx, y + dy
            (1 <= nx <= W && 1 <= ny <= H) || continue
            walkable[nx, ny] || continue
            dist[nx, ny] == typemax(Int) || continue
            dist[nx, ny] = dist[x, y] + 1
            push!(queue, (nx, ny))
        end
    end
    return dist
end

# 町の静的な部分をまとめて作る
function build_city()
    elev = make_elev()
    road = make_road()
    shelters = make_shelters()
    walkable, shelter_id = make_walkable(road, shelters)
    dist = [bfs_dist(walkable, s.cells) for s in shelters]
    return (; elev, road, walkable, shelter_id, dist)
end
