// Boids の GPU 版。CPU 版 (src/main.rs の step) と同じ計算を、1スレッド = 1匹で行う。
// Boid は vec4f = (pos.x, pos.y, vel.x, vel.y)。src(今)を読んで dst(次)に書き、毎ステップ入れ替える。

struct Params {
    n: u32,
    cols: u32,
    rows: u32,
    ncells: u32,
    bounds: vec2f,
    vision: f32,
    sep_dist: f32,
    min_speed: f32,
    max_speed: f32,
    dt: f32,
    _pad: f32,
}

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec4f>;
// 空間グリッド(数え上げソート)用
@group(0) @binding(3) var<storage, read_write> counts: array<atomic<u32>>; // マスごとの人数
@group(0) @binding(4) var<storage, read_write> start: array<u32>;          // マスの開始位置(ncells+1 個)
@group(0) @binding(5) var<storage, read_write> cell_of: array<u32>;        // 各匹のマス番号
@group(0) @binding(6) var<storage, read_write> rank: array<u32>;           // マスの中で何番目に入ったか
@group(0) @binding(7) var<storage, read_write> idx: array<u32>;            // マス番号順に並べた匹の番号

const WG: u32 = 256u;

// 近くの仲間の集計
struct Acc {
    sep: vec2f,
    align_sum: vec2f,
    center_sum: vec2f,
    count: u32,
}

fn look(acc: ptr<function, Acc>, me: vec4f, other: vec4f) {
    let d = other.xy - me.xy;
    let dist2 = dot(d, d);
    if (dist2 < P.vision * P.vision) {
        (*acc).count += 1u;
        (*acc).align_sum += other.zw;
        (*acc).center_sum += other.xy;
        if (dist2 < P.sep_dist * P.sep_dist) {
            (*acc).sep -= d;
        }
    }
}

// 集計から次の状態を作る(CPU 版 step の後半と同じ)
fn finish(me: vec4f, acc: Acc) -> vec4f {
    var vel = me.zw;
    if (acc.count > 0u) {
        let n = f32(acc.count);
        let align = acc.align_sum / n - me.zw;
        let cohesion = acc.center_sum / n - me.xy;
        vel += (align * 2.0 + cohesion * 0.5 + acc.sep * 20.0) * P.dt;
    }
    let len = length(vel);
    let speed = clamp(len, P.min_speed, P.max_speed);
    if (len > 0.0) {
        vel = vel / len * speed;
    } else {
        vel = vec2f(0.0);
    }
    // 画面の端はつながっている(トーラス)
    var pos = me.xy + vel * P.dt;
    pos = pos - P.bounds * floor(pos / P.bounds);
    return vec4f(pos, vel);
}

fn cell_xy(p: vec2f) -> vec2u {
    let cx = min(u32(max(p.x, 0.0) / P.vision), P.cols - 1u);
    let cy = min(u32(max(p.y, 0.0) / P.vision), P.rows - 1u);
    return vec2u(cx, cy);
}

// ---- 総当たり: 256匹ずつ共有メモリに読み込んで、ワークグループ全員で使い回す ----

var<workgroup> tile: array<vec4f, 256>;

@compute @workgroup_size(256)
fn step_brute(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) li: u32) {
    let i = gid.x;
    let n = P.n;
    let valid = i < n;
    var me = vec4f(0.0);
    if (valid) {
        me = src[i];
    }
    var acc = Acc(vec2f(0.0), vec2f(0.0), vec2f(0.0), 0u);
    for (var base = 0u; base < n; base += WG) {
        let j = base + li;
        if (j < n) {
            tile[li] = src[j];
        }
        workgroupBarrier();
        let m = min(WG, n - base);
        for (var t = 0u; t < m; t++) {
            if (base + t != i) {
                look(&acc, me, tile[t]);
            }
        }
        workgroupBarrier();
    }
    if (valid) {
        dst[i] = finish(me, acc);
    }
}

// ---- グリッド: ① 人数を0に → ② 数える → ③ 累積和 → ④ 詰める → ⑤ 9マス探索 ----

@compute @workgroup_size(256)
fn grid_clear(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x < P.ncells) {
        atomicStore(&counts[gid.x], 0u);
    }
}

@compute @workgroup_size(256)
fn grid_count(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= P.n) {
        return;
    }
    let c = cell_xy(src[i].xy);
    let cell = c.y * P.cols + c.x;
    cell_of[i] = cell;
    rank[i] = atomicAdd(&counts[cell], 1u);
}

// 累積和は1ワークグループ(256スレッド)で行う。マスを256等分し、各スレッドが自分の区間を足す →
// 区間の合計どうしを共有メモリで累積和 → 各スレッドが自分の区間に開始位置を書く。
var<workgroup> sums: array<u32, 256>;

@compute @workgroup_size(256)
fn grid_scan(@builtin(local_invocation_index) li: u32) {
    let nc = P.ncells;
    let chunk = (nc + WG - 1u) / WG;
    let lo = li * chunk;
    let hi = min(lo + chunk, nc);
    var s = 0u;
    for (var c = lo; c < hi; c++) {
        s += atomicLoad(&counts[c]);
    }
    sums[li] = s;
    workgroupBarrier();
    for (var off = 1u; off < WG; off *= 2u) {
        var v = 0u;
        if (li >= off) {
            v = sums[li - off];
        }
        workgroupBarrier();
        sums[li] += v;
        workgroupBarrier();
    }
    var run = sums[li] - s; // 自分の区間より前の合計
    for (var c = lo; c < hi; c++) {
        start[c] = run;
        run += atomicLoad(&counts[c]);
    }
    if (li == WG - 1u) {
        start[nc] = sums[li];
    }
}

@compute @workgroup_size(256)
fn grid_scatter(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= P.n) {
        return;
    }
    idx[start[cell_of[i]] + rank[i]] = i;
}

@compute @workgroup_size(256)
fn step_grid(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= P.n) {
        return;
    }
    let me = src[i];
    let c = cell_xy(me.xy);
    // CPU 版と同じく、画面端をまたいだ先のマスは見ない
    let x0 = select(c.x - 1u, 0u, c.x == 0u);
    let x1 = min(c.x + 1u, P.cols - 1u);
    let y0 = select(c.y - 1u, 0u, c.y == 0u);
    let y1 = min(c.y + 1u, P.rows - 1u);
    var acc = Acc(vec2f(0.0), vec2f(0.0), vec2f(0.0), 0u);
    for (var y = y0; y <= y1; y++) {
        // 横に並んだ3マスは idx 上で連続している
        let a = start[y * P.cols + x0];
        let b = start[y * P.cols + x1 + 1u];
        for (var k = a; k < b; k++) {
            let j = idx[k];
            if (j != i) {
                look(&acc, me, src[j]);
            }
        }
    }
    dst[i] = finish(me, acc);
}
