// 川の形・数値・岩の配置。調整はこのファイルだけで済ませる。
// 座標は「川座標」: s = 上流からの距離(m)、d = 川の中心線からの横位置(m、右が +)
use bevy::math::Vec3;

pub const LENGTH: f32 = 1800.0; // ゴールの s
pub const END: f32 = LENGTH + 80.0; // 川メッシュの終わり
pub const MAX_HP: i32 = 5;
pub const RAFT_L: f32 = 8.4; // 筏の長さ(進行方向 m)
pub const RAFT_W: f32 = 5.6; // 筏の幅(m)
pub const HIT_A: f32 = 3.0; // 当たり判定の半長(進行方向)。岩の半径に足して楕円にする
pub const HIT_B: f32 = 2.4; // 当たり判定の半幅(横)
pub const INVULN: f32 = 1.2; // 被弾後の無敵秒

// 操作・流れ
pub const FLOW_BASE: f32 = 11.0; // ふつうの流れの速さ m/s
pub const FLOW_RAPID: f32 = 7.0; // 急流で足される速さ
pub const PADDLE_FWD: f32 = 6.0; // 前に漕いだときの上乗せ
pub const PADDLE_BACK: f32 = 5.0;
pub const STEER_ACC: f32 = 22.0; // 左右の加速度
pub const SIDE_DRAG: f32 = 1.8;

pub const ROCK_GAP: f32 = 1.7; // 岩の間隔の倍率

// 歩き・視点
pub const WALK_SPEED: f32 = 3.8; // 筏の上を歩く速さ m/s
pub const EYE_H: f32 = 1.7; // 甲板から目まで
pub const DECK_H: f32 = 0.32; // 筏の底(水面)から甲板まで
pub const MOUSE_SENS: f32 = 0.0025;

// 川の乱高下(水面の波。大きいうねり・小さい波・ゆっくり大きな上下の3つを足す)
pub const WAVE_BASE: f32 = 0.55; // ふだんのうねりの高さ m
pub const WAVE_RAPID: f32 = 0.95; // 急流で足されるうねり
pub const WAVE_SPEED: f32 = 3.5; // うねりが流れ下る速さ m/s(筏はこれより速いので波に乗り越える)

// 急流の区間 (開始 s, 終了 s)
pub const RAPIDS: [(f32, f32); 3] = [(380.0, 520.0), (900.0, 1060.0), (1400.0, 1560.0)];

pub fn cx(s: f32) -> f32 {
    18.0 * (s / 60.0).sin() + 9.0 * (s / 23.0 + 1.0).sin()
}
pub fn dcx(s: f32) -> f32 {
    0.3 * (s / 60.0).cos() + (9.0 / 23.0) * (s / 23.0 + 1.0).cos()
}
pub fn ddcx(s: f32) -> f32 {
    -(0.3 / 60.0) * (s / 60.0).sin() - (9.0 / 529.0) * (s / 23.0 + 1.0).sin()
}

pub fn half_w(s: f32) -> f32 {
    9.5 + 2.5 * (s / 70.0).sin() + 1.2 * (s / 31.0 + 2.0).sin() - 1.5 * rapidness(s)
}

/// 急流の度合い 0..1(区間の前後 40m でなめらかに変わる)
pub fn rapidness(s: f32) -> f32 {
    let mut m = 0.0f32;
    for (a, b) in RAPIDS {
        let t = ((s - a) / 40.0).min((b - s) / 40.0).min(1.0);
        if t > 0.0 {
            m = m.max(t * t * (3.0 - 2.0 * t));
        }
    }
    m
}
pub fn flow(s: f32) -> f32 {
    FLOW_BASE + FLOW_RAPID * rapidness(s)
}

/// 水面の高さ(川座標 s, d と時刻 t から)。岸に近いほどおだやか。
pub fn water_h(s: f32, d: f32, t: f32) -> f32 {
    let rap = rapidness(s);
    let e = (d / (half_w(s) + 1.2)).abs().min(1.0);
    let taper = 1.0 - e * e;
    let a1 = (WAVE_BASE + WAVE_RAPID * rap) * (0.7 + 0.3 * (s / 37.0).sin());
    let a2 = 0.12 + 0.3 * rap;
    let a3 = 0.45;
    let (k1, k2, k3) = (0.24f32, 0.57f32, 0.09f32);
    taper
        * (a1 * (k1 * (s - WAVE_SPEED * t) + 0.18 * d).sin()
            + a2 * (k2 * (s - WAVE_SPEED * 1.4 * t) + 1.7 - 0.25 * d).sin()
            + a3 * (k3 * (s - WAVE_SPEED * 0.6 * t)).sin())
}

/// 岸の高さ(e = 岸の縁からの距離)
pub fn bank_h(s: f32, e: f32, side: f32) -> f32 {
    let k = (e / 10.0).min(1.0);
    let k2 = (e / 14.0).min(1.0);
    0.35 + e * 0.1 + 1.6 * k * (s / 17.0 + e / 9.0 + side * 2.0).sin() + 1.2 * k2 * (s / 7.3 + e / 5.0).sin()
}

/// 川座標 → 世界座標(y=0)と進行方向(rotation.y。モデルは -z が前)
pub fn frame(s: f32, d: f32) -> (Vec3, f32) {
    let dc = dcx(s);
    let n = (1.0 + dc * dc).sqrt();
    (Vec3::new(cx(s) + d / n, 0.0, -s + d * dc / n), (-dc).atan2(1.0))
}

#[derive(Clone, Copy)]
pub struct Rock {
    pub s: f32,
    pub d: f32,
    pub r: f32,
    pub seed: f32,
}

/// 決まった並びで岩を置く(毎回同じ川)
pub fn make_rocks() -> Vec<Rock> {
    let mut a: u32 = 20260122;
    let mut rnd = move || {
        a = a.wrapping_add(0x6D2B79F5);
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) as f64 / 4294967296.0) as f32
    };
    let mut rocks = Vec::new();
    let (mut s, mut side) = (70.0f32, 1.0f32);
    while s < LENGTH - 50.0 {
        let rap = rapidness(s);
        let hw = half_w(s);
        if rnd() < 0.7 {
            side = -side; // 左右に振りやすくする
        }
        let r = 0.9 + rnd() * 1.1 + rap * 0.3;
        let d = side * (rnd() * (hw - r - 2.5));
        rocks.push(Rock { s, d, r, seed: rnd() });
        if rap > 0.5 && rnd() < 0.35 {
            // 急流では2つ並べる(反対側に置くので間は通れる)
            let sign = if d >= 0.0 { 1.0 } else { -1.0 };
            let d2 = -sign * (hw - 2.5).min(d.abs() + 5.0 + r);
            rocks.push(Rock { s: s + 2.0 + rnd() * 3.0, d: d2, r: 0.9 + rnd() * 0.8, seed: rnd() });
        }
        s += (16.0 - rap * 4.0 + rnd() * 9.0) * ROCK_GAP; // 流れが速いぶん間をあける
    }
    rocks
}
