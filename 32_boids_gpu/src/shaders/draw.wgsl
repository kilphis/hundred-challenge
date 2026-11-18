// 描画: 計算したバッファを CPU に読み戻さず、そのまま 2px の四角として描く

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

@group(0) @binding(0) var<uniform> D: Params;
@group(0) @binding(1) var<storage, read> boids: array<vec4f>;

@vertex
fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
    var corner = array<vec2f, 6>(
        vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
        vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
    );
    let p = boids[ii].xy + corner[vi] * 2.0;
    let ndc = p / D.bounds * 2.0 - 1.0;
    return vec4f(ndc.x, -ndc.y, 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
    return vec4f(1.0, 1.0, 1.0, 1.0);
}
