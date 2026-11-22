// 筏の動き(Bevy 非依存。テストで自動操縦を走らせられる)
use crate::defs::*;
use bevy::ecs::resource::Resource;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Mode {
    Ready,
    Run,
    Dead,
    Goal,
}

#[derive(Clone, Copy, Default)]
pub struct Input {
    pub fwd: bool,
    pub back: bool,
    pub steer: f32, // 右 +1 / 左 -1
}

#[derive(Resource, Clone)]
pub struct Game {
    pub mode: Mode,
    pub s: f32,
    pub d: f32,
    pub vs: f32,
    pub vd: f32,
    pub yaw: f32,
    pub kick: f32,
    pub hp: i32,
    pub inv: f32,
    pub hit: f32,
    pub time: f32,
    pub clock: f32,
    pub stroke: f32,
    pub best: f32,
    pub new_record: bool,
}

impl Game {
    pub fn new(s: f32, d: f32, best: f32) -> Self {
        Game {
            mode: Mode::Ready, s, d, vs: FLOW_BASE, vd: 0.0, yaw: 0.0, kick: 0.0, hp: MAX_HP, inv: 0.0, hit: 0.0,
            time: 0.0, clock: 0.0, stroke: 0.0, best, new_record: false,
        }
    }
}

pub fn step(g: &mut Game, rocks: &[Rock], inp: Input, dt: f32) {
    g.clock += dt;
    let running = g.mode == Mode::Run;
    let (fwd, back, steer) = if running { (inp.fwd, inp.back, inp.steer) } else { (false, false, 0.0) };

    let hw = half_w(g.s);
    let u = flow(g.s) * (1.0 - 0.45 * (g.d / hw).powi(2)); // 中央ほど速い
    let mut target = u + if fwd { PADDLE_FWD } else { 0.0 } - if back { PADDLE_BACK } else { 0.0 };
    if g.mode == Mode::Goal {
        target = 0.0;
    }
    g.vs += (target - g.vs) * (dt * if g.mode == Mode::Goal { 0.8 } else { 1.6 }).min(1.0);
    g.vd += steer * STEER_ACC * dt;
    g.vd -= g.vd * SIDE_DRAG * dt;
    g.vd -= ddcx(g.s) * g.vs * g.vs * 1.0 * dt; // カーブで外側へ流される
    g.s += g.vs * dt;
    g.d += g.vd * dt;

    // 岸
    let lim = half_w(g.s) - HIT_B * 0.8;
    if g.d.abs() > lim {
        let sg = g.d.signum();
        g.d = sg * lim;
        if g.vd * sg > 0.0 {
            g.vd = -g.vd * 0.25;
        }
        g.vs *= 1.0 - 0.9 * dt;
    }

    // 岩
    g.inv = (g.inv - dt).max(0.0);
    g.hit = (g.hit - dt).max(0.0);
    if running {
        for r in rocks {
            if (r.s - g.s).abs() > HIT_A + r.r + 1.0 {
                continue;
            }
            // 筏を楕円とみなす(半長 a・半幅 b)。楕円の外へ押し出す
            let (a, b) = (HIT_A + r.r, HIT_B + r.r);
            let (dx, dy) = (g.s - r.s, g.d - r.d);
            let q = (dx / a).hypot(dy / b);
            if q >= 1.0 {
                continue;
            }
            let (px, py) = if q < 0.001 { (0.0, 1.0) } else { (dx / q, dy / q) };
            g.s = r.s + px;
            g.d = r.d + py;
            let (gx, gy) = (px / (a * a), py / (b * b)); // 楕円の境界での法線
            let gl = gx.hypot(gy).max(0.0001);
            let (nx, ny) = (gx / gl, gy / gl);
            let vn = g.vs * nx + g.vd * ny;
            if vn < 0.0 {
                g.vs -= 1.5 * vn * nx;
                g.vd -= 1.5 * vn * ny;
            }
            if g.inv <= 0.0 {
                g.hp -= 1;
                g.inv = INVULN;
                g.hit = 0.5;
                g.vs *= 0.4;
                g.kick = if ny >= 0.0 { 2.5 } else { -2.5 };
                if g.hp <= 0 {
                    g.mode = Mode::Dead;
                }
            }
        }
    }
    if g.mode == Mode::Run {
        g.time += dt;
        if g.s >= LENGTH {
            g.mode = Mode::Goal;
            g.new_record = g.best <= 0.0 || g.time < g.best;
        }
    }
    g.s = g.s.min(LENGTH + 50.0);
    let lim2 = half_w(g.s) - 1.2;
    g.d = g.d.clamp(-lim2, lim2);
    g.stroke += dt * (if fwd { 5.0 } else { 0.0 } + steer.abs() * 4.0);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 3通りの操作を先読みして、被弾の少ないものを選ぶ(通れる川かどうかの確認用)
    fn autopilot(g: &Game, rocks: &[Rock]) -> Input {
        // 候補: (向き, 切る長さ, 逆に切って止める長さ) を試し、最初の1手だけ使う
        let mut cands = vec![(0.0f32, 0usize, 0usize)];
        for a in [-1.0f32, 1.0] {
            for n in [6usize, 12, 20, 30] {
                for m in [0, n / 2, n] {
                    cands.push((a, n, m));
                }
            }
        }
        let mut best = (f32::MAX, 0.0f32);
        for (a, n, m) in cands {
            let mut h = g.clone();
            let mut bank = 0.0;
            for k in 0..150 {
                let st = if k < n { a } else if k < n + m { -a } else { 0.0 };
                step(&mut h, rocks, Input { fwd: false, back: false, steer: st }, 1.0 / 30.0);
                if h.d.abs() > half_w(h.s) - HIT_B * 0.8 - 0.05 {
                    bank += 1.0;
                }
            }
            let score = (g.hp - h.hp) as f32 * 100.0 + bank + h.d.abs() * 0.05 + n as f32 * 0.002;
            if score < best.0 {
                best = (score, if n > 0 { a } else { 0.0 });
            }
        }
        if g.vs < 1.0 {
            // 岩に張り付いたら、岩の反対側へ漕いで抜ける
            if let Some(r) = rocks.iter().find(|r| (r.s - g.s).abs() < HIT_A + r.r + 1.0 && (r.d - g.d).abs() < HIT_B + r.r + 1.0) {
                return Input { fwd: false, back: false, steer: if g.d >= r.d { 1.0 } else { -1.0 } };
            }
        }
        Input { fwd: false, back: false, steer: best.1 }
    }

    #[test]
    fn autopilot_reaches_goal() {
        let rocks = make_rocks();
        let mut g = Game::new(0.0, 0.0, 0.0);
        g.mode = Mode::Run;
        let mut t = 0.0;
        while g.mode == Mode::Run && t < 600.0 {
            let inp = autopilot(&g, &rocks);
            let hp0 = g.hp;
            step(&mut g, &rocks, inp, 1.0 / 60.0);
            if g.hp < hp0 {
                println!("hit at s={:.0} d={:.1} vs={:.1} vd={:.1}", g.s, g.d, g.vs, g.vd);
            }
            t += 1.0 / 60.0;
        }
        println!("mode={:?} time={:.1} hp={} rocks={}", g.mode, g.time, g.hp, rocks.len());
        assert_eq!(g.mode, Mode::Goal);
    }
}
