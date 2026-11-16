//! Bevy に依存しない1ステップの更新。生産・売却・加工所への投入・手で置く(drop_item)・運び人の経路探索と動き。
//! `step_market` が1マーケットを dt 秒進める入口で、ゲーム本体(main.rs の tick)とシミュレーター(sim.rs)の両方が呼ぶ。
//! 依存: state.rs の型、main.rs の定数。

use bevy::prelude::{Color, Vec2};
use std::collections::{HashMap, VecDeque};
use std::f32::consts::TAU;

use crate::state::*;
use crate::{CARRIER_SPEED, COOLDOWN, DIRS, FARMER_INTERVAL, PRESS_T, PROCESS_T, RIVER_INTERVAL, ROWS};

// ---------------------------------------------------------------- エフェクト

pub fn burst(m: &mut Market, pos: Vec2, color: Color, n: usize) {
    for i in 0..n {
        let ang = i as f32 / n as f32 * TAU + m.rnd() * 0.6;
        let speed = 90.0 + m.rnd() * 140.0;
        let life = 0.4 + m.rnd() * 0.25;
        m.fx.push(Fx {
            kind: FxKind::Spark,
            pos,
            vel: Vec2::new(ang.cos(), ang.sin()) * speed + Vec2::new(0.0, 60.0),
            age: 0.0,
            life,
            color,
        });
    }
}

pub fn ring(m: &mut Market, pos: Vec2) {
    m.fx.push(Fx { kind: FxKind::Ring, pos, vel: Vec2::ZERO, age: 0.0, life: 0.35, color: Color::WHITE });
}

pub fn pop_text(m: &mut Market, pos: Vec2, text: String, color: Color) {
    m.fx.push(Fx { kind: FxKind::Text(text), pos, vel: Vec2::new(0.0, 45.0), age: 0.0, life: 0.9, color });
}

// ---------------------------------------------------------------- ゲーム操作

/// エフェクトを出す位置: 建物のマスならその建物の中心、ほかは1マスの中心。
fn fx_pos(m: &Market, cell: Cell) -> Vec2 {
    match m.building_at(cell) {
        Some(bi) => building_center(m.cols(), m.buildings[bi].cell),
        None => cell_center(m.cols(), cell),
    }
}

/// src のマス(建物なら左下)付近にアイテムを発生させる。
fn produce(m: &mut Market, src: Cell, kind: Kind, prefer_road: bool) -> bool {
    let Some(free) = m.nearest_free(src, prefer_road) else { return false };
    m.items.push(Item::new(kind, free));
    let p = fx_pos(m, src);
    burst(m, p, m.def.items[kind].color, 10);
    pop_text(m, p + Vec2::new(0.0, 36.0), format!("+{}", m.def.items[kind].name), Color::WHITE);
    true
}

/// 市場でアイテムを売る。
fn sell(m: &mut Market, money: &mut u32, kind: Kind, at: Vec2) -> bool {
    let Some(price) = m.def.price(kind) else { return false };
    *money += price;
    if !m.quest_done() && m.def.quests[m.quest].0 == kind {
        m.sold += 1;
    }
    let gold = Color::srgb(1.0, 0.85, 0.2);
    burst(m, at, gold, 12);
    pop_text(m, at + Vec2::new(0.0, 36.0), format!("+{}円", price), gold);
    true
}

/// 加工所に材料を入れる。
fn feed(m: &mut Market, bi: usize, kind: Kind) -> bool {
    let Some(s) = m.buildings[bi].slot(m.def, kind) else { return false };
    m.buildings[bi].stock[s] = true;
    m.buildings[bi].press = PRESS_T;
    let p = building_center(m.cols(), m.buildings[bi].cell);
    burst(m, p, m.def.items[kind].color, 8);
    true
}

/// from から道だけを通って行けるマスと、その (1つ前のマス, 距離)。from 自身は道でなくても含む(立っている場所)。
fn road_tree(m: &Market, from: Cell) -> HashMap<Cell, (Cell, u32)> {
    let mut tree = HashMap::new();
    tree.insert(from, (from, 0));
    let mut q = VecDeque::from([from]);
    while let Some(c) = q.pop_front() {
        let d = tree[&c].1;
        for (dx, dy) in DIRS {
            let n = (c.0 + dx, c.1 + dy);
            if m.passable(n) && !tree.contains_key(&n) {
                tree.insert(n, (c, d + 1));
                q.push_back(n);
            }
        }
    }
    tree
}

/// 木をたどって to までの経路(出発マスは含まない)。
fn trace(tree: &HashMap<Cell, (Cell, u32)>, to: Cell) -> VecDeque<Cell> {
    let mut path = VecDeque::new();
    let mut cur = to;
    while let Some(&(prev, d)) = tree.get(&cur) {
        if d == 0 {
            break;
        }
        path.push_front(cur);
        cur = prev;
    }
    path
}

/// target(1マス)の4近傍のうち、道で行ける一番近いマスと距離。
fn nearest_adj(tree: &HashMap<Cell, (Cell, u32)>, target: Cell) -> Option<(Cell, u32)> {
    DIRS.iter()
        .filter_map(|&(dx, dy)| {
            let n = (target.0 + dx, target.1 + dy);
            tree.get(&n).map(|&(_, d)| (n, d))
        })
        .min_by_key(|&(_, d)| d)
}

/// 建物(左下 `bcell`)の外周のうち、道で行ける一番近いマスと距離。
fn nearest_adj_building(tree: &HashMap<Cell, (Cell, u32)>, bcell: Cell) -> Option<(Cell, u32)> {
    building_adj(bcell).filter_map(|n| tree.get(&n).map(|&(_, d)| (n, d))).min_by_key(|&(_, d)| d)
}

/// 他の運び人が、この加工所にこの材料をすでに運んでいる(運ぶ予定)か。
fn incoming(m: &Market, except: usize, plant: Cell, kind: Kind) -> bool {
    m.carriers.iter().enumerate().any(|(j, o)| {
        j != except
            && match o.goal {
                Goal::Pickup { kind: k, dest: Dest::Plant(p), .. } => p == plant && k == kind,
                Goal::Deliver(Dest::Plant(p)) => p == plant && o.carry == Some(kind),
                _ => false,
            }
    })
}

pub fn drop_item(m: &mut Market, money: &mut u32, i: usize, cell: Cell) {
    if !m.in_field(cell) || m.is_river(cell) || m.is_road(cell) || m.worker_at(cell).is_some() {
        return;
    }
    let kind = m.items[i].kind;
    let p = fx_pos(m, cell);

    // 市場: 売却 / 加工所: 材料を入れる
    if let Some(bi) = m.building_at(cell) {
        let done = match m.buildings[bi].kind {
            BKind::Market => sell(m, money, kind, p),
            BKind::Plant(_) => feed(m, bi, kind),
            BKind::Source(_) => false,
        };
        if done {
            m.buildings[bi].press = PRESS_T;
            m.items.remove(i);
        }
        return;
    }

    // 他のアイテム: 合成
    if let Some(j) = m.item_at(cell, Some(i)) {
        let other = m.items[j].kind;
        if let Some(result) = m.def.recipe(kind, other) {
            let (hi, lo) = if i > j { (i, j) } else { (j, i) };
            m.items.remove(hi);
            m.items.remove(lo);
            m.items.push(Item::new(result, cell));
            burst(m, p, m.def.items[result].color, 14);
            pop_text(m, p + Vec2::new(0.0, 36.0), format!("{}!", m.def.items[result].name), Color::WHITE);
        }
        return;
    }

    // 空きマス: 移動
    m.items[i].cell = cell;
    m.items[i].age = 0.0;
}

/// 原料の建物をクリック: 冷却が済んでいればアイテムが出る。使い切ると建物は消える。
pub fn click_source(m: &mut Market, bi: usize) {
    let def = m.def;
    let (kind, cell, ready) = {
        let b = &m.buildings[bi];
        (b.kind, b.cell, b.cooldown <= 0.0)
    };
    let Some(item) = kind.produces(def) else { return };
    m.buildings[bi].press = PRESS_T;
    if ready && produce(m, cell, item, false) {
        m.buildings[bi].cooldown = COOLDOWN;
        m.buildings[bi].uses_left -= 1;
        if m.buildings[bi].uses_left == 0 {
            let c = building_center(m.cols(), cell);
            burst(m, c, kind.color(def), 14);
            m.buildings.remove(bi);
        }
    }
}

// ---------------------------------------------------------------- 毎フレームの更新

fn update_workers(m: &mut Market, dt: f32) {
    let def = m.def;
    let mut i = 0;
    while i < m.workers.len() {
        let mut w = m.workers[i];
        if w.kind == WKind::Farmer && m.building_at(w.cell).is_none() {
            m.workers.remove(i);
            continue;
        }
        w.timer -= dt;
        if w.timer <= 0.0 {
            match w.kind {
                WKind::Farmer => {
                    w.timer = FARMER_INTERVAL;
                    let bi = m.building_at(w.cell).unwrap();
                    if let Some(k) = m.buildings[bi].kind.produces(def) {
                        if produce(m, w.cell, k, false) {
                            m.buildings[bi].press = PRESS_T;
                        }
                    }
                }
                WKind::River => {
                    w.timer = RIVER_INTERVAL;
                    if let Some(r) = def.river {
                        produce(m, w.cell, r.out, false);
                    }
                }
            }
        }
        m.workers[i] = w;
        i += 1;
    }
}

/// 加工所: 材料が2つそろったら加工し、製品を道に面したマスに出す。
fn update_plants(m: &mut Market, dt: f32) {
    for bi in 0..m.buildings.len() {
        let BKind::Plant(p) = m.buildings[bi].kind else { continue };
        if !(m.buildings[bi].stock[0] && m.buildings[bi].stock[1]) {
            continue;
        }
        m.buildings[bi].work += dt;
        if m.buildings[bi].work >= PROCESS_T {
            let (cell, out) = (m.buildings[bi].cell, m.def.plants[p].out);
            let b = &mut m.buildings[bi];
            b.work = PROCESS_T;
            if produce(m, cell, out, true) {
                let b = &mut m.buildings[bi];
                b.stock = [false; 2];
                b.work = 0.0;
                b.press = PRESS_T;
            }
        }
    }
}

/// 持っている物を足元近くに置いて手ぶらに戻る。
fn put_down(m: &mut Market, c: &mut Carrier) {
    if let Some(k) = c.carry.take() {
        if let Some(free) = m.nearest_free(c.cell(), true) {
            m.items.push(Item::new(k, free));
        }
    }
    c.goal = Goal::Idle;
    c.path.clear();
}

/// 届け先へ向かう経路を引く。行けなければ false。
fn route_to(m: &Market, c: &mut Carrier, dest: Dest) -> bool {
    let tree = road_tree(m, c.cell());
    let target = match dest {
        Dest::Market => nearest_adj_building(&tree, m.market_cell()).map(|(n, _)| n),
        Dest::Plant(pc) => nearest_adj_building(&tree, pc).map(|(n, _)| n),
    };
    let Some(t) = target else { return false };
    c.path = trace(&tree, t);
    c.goal = Goal::Deliver(dest);
    true
}

fn step_carrier(m: &mut Market, money: &mut u32, ci: usize, c: &mut Carrier, dt: f32) {
    if let Some(&next) = c.path.front() {
        let target = Vec2::new(next.0 as f32, next.1 as f32);
        let d = target - c.pos;
        let step = CARRIER_SPEED * dt;
        if d.length() <= step {
            c.pos = target;
            c.path.pop_front();
        } else {
            c.pos += d / d.length() * step;
        }
        return;
    }
    let cur = c.cell();
    let def = m.def;
    match c.goal {
        Goal::Pickup { at, kind, dest } => {
            let idx = m
                .items
                .iter()
                .enumerate()
                .position(|(i, it)| it.cell == at && it.kind == kind && m.drag != Some(i));
            c.goal = Goal::Idle;
            if let Some(i) = idx {
                c.carry = Some(kind);
                m.items.remove(i);
                if let Some(d) = m.drag {
                    if d > i {
                        m.drag = Some(d - 1);
                    }
                }
                if !route_to(m, c, dest) {
                    put_down(m, c);
                }
            }
        }
        Goal::Deliver(Dest::Market) => {
            let mc = m.market_cell();
            if adjacent_to_building(cur, mc) {
                if let Some(k) = c.carry.take() {
                    let at = building_center(m.cols(), mc);
                    sell(m, money, k, at);
                }
                c.goal = Goal::Idle;
                c.think = 0.0;
            } else if !route_to(m, c, Dest::Market) || c.path.is_empty() {
                put_down(m, c);
            }
        }
        Goal::Deliver(Dest::Plant(pc)) => {
            let adjacent = adjacent_to_building(cur, pc);
            let bi = m.building_at(pc);
            if adjacent {
                let k = c.carry.unwrap_or(0);
                if c.carry.is_some() && bi.is_some_and(|bi| feed(m, bi, k)) {
                    c.carry = None;
                    c.goal = Goal::Idle;
                    c.think = 0.0;
                } else if c.carry.is_some_and(|k| def.price(k).is_some()) {
                    // 加工所が受け取れなかった: 売れる物なら市場へ
                    if !route_to(m, c, Dest::Market) {
                        put_down(m, c);
                    }
                } else {
                    put_down(m, c);
                }
            } else if !route_to(m, c, Dest::Plant(pc)) || c.path.is_empty() {
                put_down(m, c);
            }
        }
        Goal::Idle => {
            c.think -= dt;
            if c.think > 0.0 {
                return;
            }
            c.think = 0.4;
            // 道の上にいなければ(雇った時に道が無かった等)、市場のそばの道に立ち直す
            if !m.passable(cur) {
                let start = m.carrier_start();
                if start != cur {
                    *c = Carrier::at(start);
                    return;
                }
            }
            let tree = road_tree(m, cur);
            let claimed: Vec<Cell> = m
                .carriers
                .iter()
                .enumerate()
                .filter(|(j, _)| *j != ci)
                .filter_map(|(_, o)| if let Goal::Pickup { at, .. } = o.goal { Some(at) } else { None })
                .collect();
            let market_ok = nearest_adj_building(&tree, m.market_cell()).is_some();
            // (優先度, 拾うマスの隣, アイテムのマス, 種類, 届け先)。加工所行きを市場行きより先に、近い順に。
            let mut best: Option<(u32, Cell, Cell, Kind, Dest)> = None;
            for (i, it) in m.items.iter().enumerate() {
                if m.drag == Some(i) || claimed.contains(&it.cell) {
                    continue;
                }
                let Some((adj, d)) = nearest_adj(&tree, it.cell) else { continue };
                // 材料を待っている加工所が先、なければ売れる物は市場へ
                let plant = m
                    .buildings
                    .iter()
                    .filter(|b| b.slot(def, it.kind).is_some() && !incoming(m, ci, b.cell, it.kind))
                    .filter_map(|b| nearest_adj_building(&tree, b.cell).map(|(_, pd)| (b.cell, pd)))
                    .min_by_key(|&(_, pd)| pd);
                let dest = if let Some((pc, _)) = plant {
                    Dest::Plant(pc)
                } else if market_ok && def.price(it.kind).is_some() {
                    Dest::Market
                } else {
                    continue;
                };
                let score = d + if dest == Dest::Market { 1000 } else { 0 };
                if best.is_some_and(|b| b.0 <= score) {
                    continue;
                }
                best = Some((score, adj, it.cell, it.kind, dest));
            }
            if let Some((_, adj, at, kind, dest)) = best {
                c.path = trace(&tree, adj);
                c.goal = Goal::Pickup { at, kind, dest };
            }
        }
    }
}

pub fn step_market(m: &mut Market, money: &mut u32, dt: f32) {
    m.time += dt;
    for b in m.buildings.iter_mut() {
        b.cooldown = (b.cooldown - dt).max(0.0);
        b.press = (b.press - dt).max(0.0);
    }
    for it in m.items.iter_mut() {
        it.age += dt;
    }
    for f in m.fx.iter_mut() {
        f.age += dt;
        f.pos += f.vel * dt;
        if matches!(f.kind, FxKind::Spark) {
            f.vel.y -= 420.0 * dt;
        }
    }
    m.fx.retain(|f| f.age < f.life);

    update_workers(m, dt);
    update_plants(m, dt);
    for ci in 0..m.carriers.len() {
        let mut c = m.carriers[ci].clone();
        step_carrier(m, money, ci, &mut c, dt);
        m.carriers[ci] = c;
    }
    quest_check(m);
}

fn quest_check(m: &mut Market) {
    if m.quest_done() {
        return;
    }
    if m.sold >= m.def.quests[m.quest].1 {
        let old_cols = m.cols();
        let (kind, n) = m.def.reward;
        m.quest += 1;
        m.sold = 0;
        // 広がった列の空きマスにご褒美アイテムを置く
        let mut left = n;
        for x in old_cols..m.cols() {
            for y in 0..ROWS {
                if left > 0 && m.is_free((x, y)) {
                    m.items.push(Item::new(kind, (x, y)));
                    left -= 1;
                }
            }
        }
    }
}
