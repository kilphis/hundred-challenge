// 大将の思考: 自分の部隊(大将 + 歩兵)の動かし方を候補 k 通り試して一番よいものを選ぶ。
// 各大将は今の盤面しか見ない(味方の他の大将が何をするかは知らない)。
use crate::game::{CMD_R, H, Kind, Unit, W};
use std::sync::mpsc::{Receiver, Sender, channel};
use std::sync::{Arc, OnceLock};
use std::thread;
use std::time::Instant;

pub struct Job {
    pub round: u64,
    pub units: Arc<Vec<Unit>>,
    pub general: usize,
    pub target: Option<(i32, i32)>,
    pub k: usize,
    pub seed: u64,
}

pub struct Plan {
    pub round: u64,
    pub general: usize,
    pub moves: Vec<(usize, i32, i32)>,
    pub target: (i32, i32),
    pub t0: f64, // ms(プロセス開始から)
    pub t1: f64,
    pub lane: usize,
}

static EPOCH: OnceLock<Instant> = OnceLock::new();
pub fn now_ms() -> f64 {
    EPOCH.get_or_init(Instant::now).elapsed().as_secs_f64() * 1000.0
}

const MV: [(i32, i32); 9] = [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)];
const N: usize = (W * H) as usize;

fn cheb(ax: i32, ay: i32, bx: i32, by: i32) -> i32 {
    (ax - bx).abs().max((ay - by).abs())
}

fn kill_value(k: Kind) -> f32 {
    match k {
        Kind::K => 100.0,
        Kind::G => 15.0,
        Kind::P => 6.0,
    }
}

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
    fn unit(&mut self) -> f32 {
        (self.next() >> 40) as f32 / (1u64 << 24) as f32
    }
}

pub fn plan(job: &Job, lane: usize) -> Plan {
    let t0 = now_ms();
    let units = &job.units;
    let me = &units[job.general];
    let side = me.side;
    let in_team = |u: &Unit| u.alive && u.side == side && (u.id == job.general || (u.kind == Kind::P && u.general == job.general));
    let mut team: Vec<&Unit> = vec![me];
    team.extend(units.iter().filter(|u| u.id != job.general && in_team(u)));
    let enemies: Vec<&Unit> = units.iter().filter(|u| u.alive && u.side != side).collect();

    let mut blocked = [false; N];
    for u in units.iter().filter(|u| u.alive && !in_team(u)) {
        blocked[(u.y * W + u.x) as usize] = true;
    }
    let mut adj1 = [0f32; N]; // 隣にいる敵の数
    let mut adj2 = [0f32; N]; // 2マス先にいる敵の数
    let mut enemy_at = [-1i16; N];
    for (i, e) in enemies.iter().enumerate() {
        enemy_at[(e.y * W + e.x) as usize] = i as i16;
        for dy in -2..=2 {
            for dx in -2..=2 {
                let (x, y) = (e.x + dx, e.y + dy);
                if x < 0 || x >= W || y < 0 || y >= H || (dx == 0 && dy == 0) {
                    continue;
                }
                let c = (y * W + x) as usize;
                if cheb(0, 0, dx, dy) == 1 { adj1[c] += 1.0 } else { adj2[c] += 1.0 }
            }
        }
    }

    // 狙い: 指示があればそのマス、なければ敵の王将・大将から価値と近さで選ぶ
    let (tx, ty) = job.target.unwrap_or_else(|| {
        let mut best = (me.x, me.y);
        let mut bs = f32::MIN;
        for e in &enemies {
            let v = match e.kind {
                Kind::K => 4.0,
                Kind::G => 1.5,
                Kind::P => 0.3,
            };
            let s = v / (1.0 + cheb(me.x, me.y, e.x, e.y) as f32);
            if s > bs {
                bs = s;
                best = (e.x, e.y);
            }
        }
        best
    });

    // 各駒の動ける先と、狙いに近づく動き
    let opts: Vec<(Vec<u8>, Vec<u8>)> = team
        .iter()
        .map(|u| {
            let d0 = cheb(u.x, u.y, tx, ty);
            let (mut valid, mut greedy) = (Vec::new(), Vec::new());
            for (m, &(dx, dy)) in MV.iter().enumerate() {
                let (x, y) = (u.x + dx, u.y + dy);
                if x < 0 || x >= W || y < 0 || y >= H || blocked[(y * W + x) as usize] {
                    continue;
                }
                valid.push(m as u8);
                if cheb(x, y, tx, ty) < d0 {
                    greedy.push(m as u8);
                }
            }
            (valid, greedy)
        })
        .collect();

    let n = team.len();
    let mut rng = Rng(job.seed | 1);
    let mut stamp = [0u32; N];
    let mut hits = vec![0f32; enemies.len()];
    let mut choice = vec![0u8; n];
    let mut best = vec![0u8; n];
    let mut best_s = f32::MIN;
    let mut px = vec![0i32; n];
    let mut py = vec![0i32; n];

    for k in 0..job.k.max(2) {
        for i in 0..n {
            let (valid, greedy) = &opts[i];
            choice[i] = if k == 0 {
                0
            } else if k == 1 {
                *greedy.first().unwrap_or(&0)
            } else {
                let r = rng.unit();
                if r < 0.5 && !greedy.is_empty() {
                    greedy[rng.below(greedy.len())]
                } else if r < 0.7 {
                    0
                } else {
                    valid[rng.below(valid.len())]
                }
            };
        }
        // 同じマスに2人入る候補は捨てる
        let mark = k as u32 + 1;
        let mut ok = true;
        for i in 0..n {
            let (dx, dy) = MV[choice[i] as usize];
            px[i] = team[i].x + dx;
            py[i] = team[i].y + dy;
            let c = (py[i] * W + px[i]) as usize;
            if stamp[c] == mark {
                ok = false;
                break;
            }
            stamp[c] = mark;
        }
        if !ok {
            continue;
        }

        // 評価
        let mut s = 0f32;
        hits.iter_mut().for_each(|h| *h = 0.0);
        let (gx, gy) = (px[0], py[0]);
        let (mut sum_d, mut ns) = (0f32, 0f32);
        for i in 0..n {
            let (x, y) = (px[i], py[i]);
            let c = (y * W + x) as usize;
            let is_g = i == 0;
            let d = cheb(x, y, tx, ty) as f32;
            if is_g {
                s -= 0.5 * d;
                // 歩兵がいるうちは前に出ない。ひとりになったら自分で戦う
                let shy = if n > 1 { 3.0 } else { 1.0 };
                s -= shy * (1.6 * adj1[c] + 0.35 * adj2[c]);
            } else {
                s -= d;
                let frail = if team[i].hp <= 1 { 1.5 } else { 1.0 };
                s -= frail * (1.6 * adj1[c] + 0.35 * adj2[c]);
                let dg = cheb(x, y, gx, gy);
                if dg > CMD_R {
                    s -= (dg - CMD_R) as f32 * 4.0;
                }
                sum_d += d;
                ns += 1.0;
            }
            for &(dx, dy) in &MV[1..] {
                let (ex, ey) = (x + dx, y + dy);
                if ex < 0 || ex >= W || ey < 0 || ey >= H {
                    continue;
                }
                let e = enemy_at[(ey * W + ex) as usize];
                if e >= 0 {
                    hits[e as usize] += 1.0;
                }
            }
        }
        for (e, &h) in hits.iter().enumerate() {
            if h > 0.0 {
                let en = enemies[e];
                s += if h >= en.hp as f32 {
                    kill_value(en.kind)
                } else {
                    1.5 * h * if en.kind == Kind::K { 4.0 } else { 1.0 }
                };
            }
        }
        // 大将は歩兵より後ろにいたい
        if ns > 0.0 {
            let avg = sum_d / ns;
            let dg = cheb(gx, gy, tx, ty) as f32;
            if dg < avg + 1.0 {
                s -= avg + 1.0 - dg;
            }
        }
        if s > best_s {
            best_s = s;
            best.copy_from_slice(&choice);
        }
    }

    let moves = team
        .iter()
        .zip(&best)
        .filter(|(_, m)| **m != 0)
        .map(|(u, &m)| (u.id, MV[m as usize].0, MV[m as usize].1))
        .collect();
    Plan { round: job.round, general: job.general, moves, target: (tx, ty), t0, t1: now_ms(), lane }
}

/// スレッドの束。lane ごとに1本のスレッドがいて、渡された仕事を順番に片付ける
pub struct Pool {
    txs: Vec<Sender<Vec<Job>>>,
    pub rx: Receiver<Vec<Plan>>,
}

impl Pool {
    pub fn new(lanes: usize) -> Pool {
        let (rtx, rx) = channel();
        let txs = (0..lanes)
            .map(|lane| {
                let (tx, jrx) = channel::<Vec<Job>>();
                let rtx = rtx.clone();
                thread::spawn(move || {
                    for jobs in jrx {
                        let out: Vec<Plan> = jobs.iter().map(|j| plan(j, lane)).collect();
                        if rtx.send(out).is_err() {
                            break;
                        }
                    }
                });
                tx
            })
            .collect();
        Pool { txs, rx }
    }

    pub fn send(&self, lane: usize, jobs: Vec<Job>) {
        self.txs[lane].send(jobs).unwrap();
    }
}
