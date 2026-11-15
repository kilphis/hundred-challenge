// 盤面のルール: 配置・同時移動の解決・戦闘・勝敗
use crate::ai::Plan;

pub const W: i32 = 16;
pub const H: i32 = 16;
pub const CMD_R: i32 = 4; // 歩兵が大将から離れない距離
pub const STALL: u32 = 60; // この tick 数だれも傷つかなければ引き分け

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Kind {
    K, // 王将
    G, // 大将
    P, // 歩兵
}

#[derive(Clone)]
pub struct Unit {
    pub id: usize,
    pub side: u8, // 0 = 自軍(下・青), 1 = CPU(上・赤)
    pub kind: Kind,
    pub general: usize,  // 所属する大将の id(大将は自分、王将は usize::MAX)
    pub slot: usize, // 大将の番号 0..3(色分け用)
    pub x: i32,
    pub y: i32,
    pub hp: i32,
    pub maxhp: i32,
    pub alive: bool,
    // 描画用
    pub ax: i32,
    pub ay: i32,
    pub hit_t: f64,
    pub die_t: f64,
}

pub struct Game {
    pub units: Vec<Unit>,
    pub tick: u32,
    pub over: Option<i8>, // Some(0|1) = 勝った側, Some(-1) = 引き分け
    pub log: Vec<String>,
    pub quiet: u32, // 誰も傷つかなかった tick が続いた数
}

pub fn side_name(s: u8) -> &'static str {
    if s == 0 { "青" } else { "赤" }
}

pub fn kind_name(k: Kind) -> &'static str {
    match k {
        Kind::K => "王将",
        Kind::G => "大将",
        Kind::P => "歩兵",
    }
}

impl Game {
    pub fn new() -> Game {
        let mut units = Vec::new();
        for side in 0..2u8 {
            let pos = |x: i32, y: i32| if side == 0 { (x, y) } else { (W - 1 - x, H - 1 - y) };
            let mut push = |kind: Kind, general: usize, slot: usize, x: i32, y: i32, hp: i32| {
                let id = units.len();
                let (x, y) = pos(x, y);
                let general = if kind == Kind::G { id } else { general };
                units.push(Unit {
                    id, side, kind, general, slot, x, y, hp, maxhp: hp, alive: true,
                    ax: x, ay: y, hit_t: -9.0, die_t: -9.0,
                });
                id
            };
            push(Kind::K, usize::MAX, 0, 8, 15, 8);
            for (slot, gx) in [3, 8, 13].into_iter().enumerate() {
                let g = push(Kind::G, 0, slot, gx, 13, 4);
                for row in [12, 11] {
                    for dx in -1..=1 {
                        push(Kind::P, g, slot, gx + dx, row, 2);
                    }
                }
            }
        }
        Game { units, tick: 0, over: None, log: Vec::new(), quiet: 0 }
    }

    pub fn generals(&self) -> Vec<usize> {
        self.units.iter().filter(|u| u.alive && u.kind == Kind::G).map(|u| u.id).collect()
    }

    /// 全大将の計画を同時に適用して1tick進める
    pub fn apply(&mut self, plans: &[Plan], now: f64) {
        let n = self.units.len();
        let cur: Vec<(i32, i32)> = self.units.iter().map(|u| (u.x, u.y)).collect();
        let mut dest = cur.clone();
        let mut moving = vec![false; n];
        for p in plans {
            for &(id, dx, dy) in &p.moves {
                let u = &self.units[id];
                if !u.alive || u.kind == Kind::K {
                    continue;
                }
                let (nx, ny) = (u.x + dx, u.y + dy);
                if nx >= 0 && nx < W && ny >= 0 && ny < H {
                    dest[id] = (nx, ny);
                    moving[id] = true;
                }
            }
        }
        // 同じマスへの移動・すれ違いは、どちらも止める(止めた結果また衝突したら繰り返す)
        let cell = |p: (i32, i32)| (p.1 * W + p.0) as usize;
        loop {
            let mut changed = false;
            let mut count = [0u8; (W * H) as usize];
            let mut at = [usize::MAX; (W * H) as usize];
            for u in self.units.iter().filter(|u| u.alive) {
                count[cell(dest[u.id])] += 1;
                at[cell(cur[u.id])] = u.id;
            }
            for i in 0..n {
                if !self.units[i].alive || !moving[i] {
                    continue;
                }
                let c = cell(dest[i]);
                let j = at[c];
                let swap = j != usize::MAX && j != i && moving[j] && dest[j] == cur[i];
                if count[c] > 1 || swap {
                    dest[i] = cur[i];
                    moving[i] = false;
                    changed = true;
                }
            }
            if !changed {
                break;
            }
        }
        for u in self.units.iter_mut() {
            u.ax = u.x;
            u.ay = u.y;
            if u.alive {
                (u.x, u.y) = dest[u.id];
            }
        }
        // 戦闘: 隣の敵に全員同時に1ダメージ。狙いは 王将 > 大将 > 歩兵、同じなら体力の少ない方
        let mut dmg = vec![0; n];
        for a in self.units.iter().filter(|u| u.alive) {
            let best = self
                .units
                .iter()
                .filter(|b| b.alive && b.side != a.side && (b.x - a.x).abs() <= 1 && (b.y - a.y).abs() <= 1)
                .min_by_key(|b| (b.kind as i32, b.hp));
            if let Some(b) = best {
                dmg[b.id] += 1;
            }
        }
        for u in self.units.iter_mut() {
            if dmg[u.id] > 0 {
                u.hp -= dmg[u.id];
                u.hit_t = now;
                if u.hp <= 0 {
                    u.alive = false;
                    u.die_t = now;
                    if u.kind != Kind::P {
                        let who = side_name(1 - u.side);
                        let msg = format!("{}tick: {}が{}の{}を討ち取った", self.tick + 1, who, side_name(u.side), kind_name(u.kind));
                        self.log.push(msg);
                    }
                }
            }
        }
        if dmg.iter().any(|&d| d > 0) { self.quiet = 0 } else { self.quiet += 1 }
        self.tick += 1;
        let king = |s: u8| self.units.iter().any(|u| u.alive && u.kind == Kind::K && u.side == s);
        self.over = match (king(0), king(1)) {
            (true, true) =>  if self.quiet >= STALL { Some(-1) } else { None },
            (true, false) => Some(0),
            (false, true) => Some(1),
            (false, false) => Some(-1),
        };
    }
}
