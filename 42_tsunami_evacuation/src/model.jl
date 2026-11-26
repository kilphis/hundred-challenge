# Person 型・モデルの初期化・model_step!・集計

@agent struct Person(GridAgent{2})
    state::Symbol      # :waiting / :evacuating / :caught
    u::Float64         # 0〜1 の一様乱数。避難を始める時刻 = u * 2 * 遅れ
    speed::Float64     # マス/ステップ
    progress::Float64  # 速さの端数をためる
    target::Int        # 目指す避難所の番号
    elderly::Bool
end

# モデルのプロパティ（スライダーで変えるのは delay_min と cell_cap）
mutable struct Sim
    t::Int
    delay_min::Float64
    cell_cap::Int
    n_people::Int
    elev::Matrix{Float64}
    walkable::BitMatrix
    road::BitMatrix
    shelter_id::Matrix{Int}
    dist::Vector{Matrix{Int}}
    shelters::Vector{Shelter}
    flooded::BitMatrix
    depth::Matrix{Float64}
    occ::Matrix{Int}           # 各マスにいる人数（:caught は数えない）
    n_safe::Int
    n_caught::Int
    wait_total::Int            # 詰まりで待った延べ人数（人・ステップ）
end

function model_step!(model)
    model.t += 1
    advance_tsunami!(model.flooded, model.depth, model.elev, model.t)
    return
end

function make_model(; seed = 1, delay_min = DELAY_MIN, cell_cap = CELL_CAP, n_people = N_PEOPLE,
                    city = build_city())
    rng = Random.Xoshiro(seed)
    props = Sim(0, Float64(delay_min), cell_cap, n_people, city.elev, city.walkable, city.road,
                city.shelter_id, city.dist, make_shelters(), init_flooded(), zeros(W, H),
                zeros(Int, W, H), 0, 0, 0)
    model = StandardABM(Person, GridSpace((W, H); periodic = false, metric = :chebyshev);
                        properties = props, agent_step! = person_step!, model_step! = model_step!,
                        scheduler = Schedulers.Randomly(), rng = rng, agents_first = false)
    spawn = [(x, y) for x in 1:W for y in SPAWN_Y if city.road[x, y]]
    for _ in 1:n_people
        pos = rand(rng, spawn)
        elderly = rand(rng) < ELDERLY_RATE
        speed = elderly ? SPEED_ELDERLY : SPEED_RANGE[1] + rand(rng) * (SPEED_RANGE[2] - SPEED_RANGE[1])
        target = nearest_open_shelter(model, pos)
        add_agent!(pos, Person, model; state = :waiting, u = rand(rng), speed = speed,
                   progress = 0.0, target = target, elderly = elderly)
        props.occ[pos[1], pos[2]] += 1
    end
    return model
end

# 集計
n_active(m) = m.n_people - m.n_safe - m.n_caught          # まだ逃げている（:waiting + :evacuating）
n_waiting(m) = count(a -> a.state === :waiting, allagents(m))
n_safe(m) = m.n_safe
n_caught(m) = m.n_caught

# 時刻 "mm:ss"
clock(t) = @sprintf("%02d:%02d", (t * 10) ÷ 60, (t * 10) % 60)
