//! バランス確認用のシミュレーター。`cargo run -- --sim` で、ボットが全マーケットを順に遊び、
//! クエストごとの所要時間を表にして `balance.md` に書き出す。
//!
//! ボットは「人が1秒に1回操作する」想定: 原料をクリックする・アイテムを重ねる・市場や加工所へ運ぶ。
//! 買い物は、今のクエストの品を作るのに要る物(原料の建物 → 作業員 → 運び人 → 加工所)を順に買う。

use crate::defs::MarketDef;
use crate::logic::{click_source, drop_item, step_market};
use crate::state::*;
use crate::{BSIZE, FARMER_INTERVAL, OFFROAD_SPEED, PROCESS_T, RIVER_INTERVAL, RIVER_ROWS, ROAD_SPEED, ROWS, save};

const DT: f32 = 0.05;
/// 人の手で1回操作する間隔(秒)
const HAND_T: f32 = 1.0;
/// 1マーケットの打ち切り(秒)
const LIMIT: f32 = 3600.0;

/// クエストの品を作るのに要る原料と加工所(解放済みのものだけ)。原料は使われる回数だけ並ぶ。
fn chain(def: &MarketDef, quest: usize, k: Kind, raws: &mut Vec<Kind>, plants: &mut Vec<usize>) {
    if let Some(p) = def.plants.iter().position(|p| p.out == k && p.unlock <= quest) {
        if !plants.contains(&p) {
            let (a, b) = (def.plants[p].a, def.plants[p].b);
            chain(def, quest, a, raws, plants);
            chain(def, quest, b, raws, plants);
            plants.push(p);
        }
    } else {
        raws.push(k);
    }
}

/// 建物(2×2)を置ける場所(左下のマス)を、市場に近い順に探す。
fn spot(m: &Market) -> Option<Cell> {
    let mc = m.market_cell();
    let mut best: Option<(Cell, i32)> = None;
    for x in 0..m.cols() {
        for y in 0..ROWS {
            let c = (x, y);
            // 右隣の2マスを空けておく(そこにアイテムが出る)
            let right_free =
                (0..BSIZE).all(|i| m.is_free((x + BSIZE, y + i)) || !m.in_field((x + BSIZE, y + i)));
            // 市場の右隣の段(運び人が出発する高さ)は塞がない
            let on_main_road = building_cells(c).any(|cc| cc.1 == mc.1);
            if m.can_place_building(c) && right_free && !on_main_road {
                let d = (x - mc.0).abs() + (y - mc.1).abs();
                if best.map_or(true, |(_, bd)| d < bd) {
                    best = Some((c, d));
                }
            }
        }
    }
    best.map(|(c, _)| c)
}

/// 空きマス(1×1。川の係用)を、市場に近い順に探す。
fn spot1(m: &Market, ok: impl Fn(Cell) -> bool) -> Option<Cell> {
    let mc = m.market_cell();
    let mut best: Option<(Cell, i32)> = None;
    for x in 0..m.cols() {
        for y in 0..ROWS {
            let c = (x, y);
            let right_free = m.is_free((x + 1, y)) || !m.in_field((x + 1, y));
            if m.is_free(c) && right_free && ok(c) {
                let d = (x - mc.0).abs() + (y - mc.1).abs();
                if best.map_or(true, |(_, bd)| d < bd) {
                    best = Some((c, d));
                }
            }
        }
    }
    best.map(|(c, _)| c)
}

#[derive(Default)]
struct Bot {
    hand: f32,
    shop: f32,
}

impl Bot {
    fn step(&mut self, m: &mut Market, money: &mut u32) {
        self.shop -= DT;
        if self.shop <= 0.0 {
            self.shop = 0.5;
            self.buy(m, money);
        }
        self.hand -= DT;
        if self.hand <= 0.0 && self.hand_act(m, money) {
            self.hand = HAND_T;
        }
    }

    /// 次に買う物を1つ買う。お金が足りなければ貯める(他の物に浮気しない)。
    fn buy(&mut self, m: &mut Market, money: &mut u32) {
        if m.quest_done() {
            return;
        }
        let def = m.def;
        let (mut raws, mut plants) = (vec![], vec![]);
        chain(def, m.quest, def.quests[m.quest].0, &mut raws, &mut plants);
        let menu = menu(def);
        let cost = |t: Tool| menu.iter().find(|e| e.0 == t).map(|e| e.1).unwrap();

        // 1段目: 原料の建物を全種そろえる(安いので先)
        for &r in &raws {
            let Some(si) = def.sources.iter().position(|s| s.out == r && s.unlock <= m.quest) else { continue };
            let need = raws.iter().filter(|&&x| x == r).count();
            if m.buildings.iter().filter(|b| b.kind == BKind::Source(si)).count() >= need {
                continue;
            }
            let c = def.sources[si].cost;
            if *money < c {
                return;
            }
            let Some(cell) = spot(m) else { return };
            *money -= c;
            m.place_building(BKind::Source(si), cell);
            return;
        }
        // 2段目: 作業員・川の係を置いて自動化
        for &r in &raws {
            if def.river.is_some_and(|rv| rv.out == r) {
                if m.workers.iter().any(|w| w.kind == WKind::River) {
                    continue;
                }
                let c = cost(Tool::River);
                if *money < c {
                    return;
                }
                let Some(cell) = spot1(m, |c| m.is_river((c.0, c.1 - 1))).or_else(|| {
                    (0..m.cols()).map(|x| (x, RIVER_ROWS)).find(|&c| m.is_free(c))
                }) else {
                    return;
                };
                *money -= c;
                m.workers.push(Worker { kind: WKind::River, cell, timer: RIVER_INTERVAL });
                return;
            }
            let Some(si) = def.sources.iter().position(|s| s.out == r && s.unlock <= m.quest) else { continue };
            let Some(bi) = (0..m.buildings.len())
                .find(|&bi| m.buildings[bi].kind == BKind::Source(si) && m.worker_at(m.buildings[bi].cell).is_none())
            else {
                continue;
            };
            let c = cost(Tool::Farmer);
            if *money < c {
                return;
            }
            *money -= c;
            let cell = m.buildings[bi].cell;
            m.workers.push(Worker { kind: WKind::Farmer, cell, timer: FARMER_INTERVAL });
            return;
        }
        let want_carriers = 1 + plants.len();
        if m.carriers.is_empty() {
            return self.hire(m, money, cost(Tool::Carrier));
        }
        for &p in &plants {
            if m.buildings.iter().any(|b| b.kind == BKind::Plant(p)) {
                continue;
            }
            let c = def.plants[p].cost;
            if *money < c {
                return;
            }
            let Some(cell) = spot(m) else { return };
            *money -= c;
            m.place_building(BKind::Plant(p), cell);
            return;
        }
        if m.carriers.len() < want_carriers {
            self.hire(m, money, cost(Tool::Carrier));
        }
    }

    fn hire(&mut self, m: &mut Market, money: &mut u32, c: u32) {
        if *money >= c {
            *money -= c;
            let start = m.carrier_start();
            m.carriers.push(Carrier::at(start));
        }
    }

    /// 人の手で1回操作する。何かしたら true。
    fn hand_act(&mut self, m: &mut Market, money: &mut u32) -> bool {
        let def = m.def;
        let mc = m.market_cell();
        let claimed: Vec<Cell> = m
            .carriers
            .iter()
            .filter_map(|c| if let Goal::Pickup { at, .. } = c.goal { Some(at) } else { None })
            .collect();
        let free_items: Vec<usize> = (0..m.items.len()).filter(|&i| !claimed.contains(&m.items[i].cell)).collect();
        // 1. 加工所が待っている材料を入れる
        for &i in &free_items {
            let k = m.items[i].kind;
            if let Some(bi) = m.buildings.iter().position(|b| b.slot(def, k).is_some()) {
                let cell = m.buildings[bi].cell;
                drop_item(m, money, i, cell);
                return true;
            }
        }
        // 2. 加工所がまだ無いレシピは手で重ねる
        for &i in &free_items {
            for &j in &free_items {
                let (a, b) = (m.items[i].kind, m.items[j].kind);
                if i == j {
                    continue;
                }
                let Some(p) = def.plants.iter().position(|p| (p.a, p.b) == (a, b) || (p.a, p.b) == (b, a)) else { continue };
                if def.plants[p].unlock <= m.quest && !m.buildings.iter().any(|b| b.kind == BKind::Plant(p)) {
                    let cell = m.items[j].cell;
                    drop_item(m, money, i, cell);
                    return true;
                }
            }
        }
        // 3. 運び人がいない間は、売れる物を手で市場へ(材料にもなる物は2個まで残し、余りは売る。残しすぎるとお金が尽きて詰まる)
        if m.carriers.is_empty() {
            let is_material = |k: Kind| def.plants.iter().any(|p| p.unlock <= m.quest && (p.a == k || p.b == k));
            let count = |k: Kind| m.items.iter().filter(|it| it.kind == k).count();
            let quest_k = def.quests.get(m.quest).map(|q| q.0);
            if let Some(&i) = free_items
                .iter()
                .filter(|&&i| def.price(m.items[i].kind).is_some())
                .find(|&&i| {
                    let k = m.items[i].kind;
                    Some(k) == quest_k || !is_material(k) || count(k) > 2
                })
            {
                drop_item(m, money, i, mc);
                return true;
            }
        }
        // 4. 作業員のいない原料の建物をクリック(最後の1回は残す)
        let target = m
            .buildings
            .iter()
            .position(|b| matches!(b.kind, BKind::Source(_)) && b.cooldown <= 0.0 && b.uses_left > 1 && m.worker_at(b.cell).is_none());
        if let Some(bi) = target {
            click_source(m, bi);
            return true;
        }
        false
    }
}

/// 所持金の推移を記録する間隔(ステップ数。DT×100 = 5秒)
const MONEY_EVERY: u64 = 100;

/// `json` があれば、クエストの達成時刻と所持金の推移を機械可読でも書き出す(tools/tune.html が読む)。
pub fn run(json: Option<&str>) {
    let mut w = World::new();
    let _ = std::fs::remove_dir_all("states");
    let mut t = 0.0f32;
    let mut steps: u64 = 0;
    let mut j_markets: Vec<serde_json::Value> = vec![];
    let mut j_money: Vec<serde_json::Value> = vec![];
    let mut out = String::new();
    out += "# バランス表(`cargo run -- --sim` が自動生成)\n\n";
    out += &format!(
        "ボットが人の手(1操作/{}秒)+ 自動化で遊んだときの所要時間。運び人 {}〜{} マス/秒(踏み跡で速くなる)、作業員 {} 秒ごと、加工 {} 秒。\n\n",
        HAND_T, OFFROAD_SPEED, ROAD_SPEED, FARMER_INTERVAL, PROCESS_T
    );
    let mut summary = String::from("| マーケット | 所要 | 終了時刻 | 終了時の所持金 |\n|---|---|---|---|\n");
    for mi in 0..w.markets.len() {
        w.select(mi);
        if !w.markets[mi].opened {
            break;
        }
        let def = w.markets[mi].def;
        let _ = save::save(&w, &format!("states/{}.json", def.name));
        out += &format!("## {}\n\n| クエスト | 品 | 所要 | 累計 |\n|---|---|---|---|\n", def.name);
        let mut bot = Bot::default();
        let start = t;
        let mut q_start = t;
        let mut q = 0;
        let mut j_quests: Vec<serde_json::Value> = vec![];
        j_money.push(serde_json::json!({ "t": t, "money": w.money, "market": mi }));
        while !w.markets[mi].quest_done() && t - start < LIMIT {
            let World { markets, money, .. } = &mut w;
            for m in markets.iter_mut().filter(|m| m.opened) {
                step_market(m, money, DT);
            }
            bot.step(&mut markets[mi], money);
            t += DT;
            steps += 1;
            if steps % MONEY_EVERY == 0 {
                j_money.push(serde_json::json!({ "t": t, "money": w.money, "market": mi }));
            }
            let m = &w.markets[mi];
            if m.quest > q {
                let (k, n) = def.quests[q];
                out += &format!("| {} | {}×{} | {} | {} |\n", q + 1, def.items[k].name, n, mmss(t - q_start), mmss(t - start));
                j_quests.push(serde_json::json!({
                    "n": q + 1, "item": def.items[k].name, "count": n,
                    "dur": t - q_start, "since_start": t - start, "t": t, "money": w.money,
                }));
                q = m.quest;
                q_start = t;
            }
        }
        let done = w.markets[mi].quest_done();
        if !done {
            out += &format!("| {} | (打ち切り) | | |\n", q + 1);
            let _ = save::save(&w, &format!("states/{}_打ち切り.json", def.name));
        }
        out += "\n";
        summary += &format!("| {} | {} | {} | {}円 |\n", def.name, mmss(t - start), mmss(t), w.money);
        j_money.push(serde_json::json!({ "t": t, "money": w.money, "market": mi }));
        j_markets.push(serde_json::json!({
            "name": def.name, "start": start, "end": t, "dur": t - start,
            "done": done, "money_end": w.money, "quests": j_quests,
        }));
    }
    if let Some(path) = json {
        let v = serde_json::json!({
            "total": t, "markets": j_markets, "money": j_money,
            "money_every": MONEY_EVERY as f32 * DT,
        });
        std::fs::write(path, serde_json::to_string_pretty(&v).unwrap()).expect("--json の先に書けない");
    }
    out += "## まとめ\n\n";
    out += &summary;
    print!("{out}");
    std::fs::write("balance.md", out).expect("balance.md に書けない");
}

fn mmss(s: f32) -> String {
    format!("{}:{:02}", (s / 60.0) as u32, (s % 60.0) as u32)
}
