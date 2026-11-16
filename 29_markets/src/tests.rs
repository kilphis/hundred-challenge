//! テスト(`cargo test`)。運び人・加工所の動きを step_market で数秒回して確かめる。
//! 依存: state.rs、logic.rs、defs.rs、tuning.rs。

use crate::START_MONEY;
use crate::defs::{MARKETS, food};
use crate::logic::step_market;
use crate::render::MENU_PER_ROW;
use crate::state::*;

fn run(m: &mut Market, money: &mut u32, secs: f32) {
    let dt = 0.016;
    for _ in 0..(secs / dt) as usize {
        step_market(m, money, dt);
    }
}

#[test]
fn carrier_sells_item_via_road() {
    let mut m = Market::new(MARKETS[0], true);
    let mut money = START_MONEY;
    // 市場は (0,6) 左下の 2×2。その右隣の段 y=6 に道 (2,6),(3,6),(4,6) を敷き、(4,7) にりんごを置く
    m.roads = vec![(2, 6), (3, 6), (4, 6)];
    m.items.push(Item::new(food::APPLE, (4, 7)));
    m.carriers.push(Carrier::at((2, 6)));
    run(&mut m, &mut money, 10.0);
    assert!(m.items.is_empty());
    assert_eq!(money, START_MONEY + 10);
}

#[test]
fn unconnected_item_is_ignored() {
    let mut m = Market::new(MARKETS[0], true);
    let mut money = START_MONEY;
    m.roads = vec![(2, 6)];
    m.items.push(Item::new(food::APPLE, (8, 8)));
    m.carriers.push(Carrier::at((2, 6)));
    run(&mut m, &mut money, 5.0);
    assert_eq!(m.items.len(), 1);
}

#[test]
fn plant_turns_apple_and_cane_into_candy_apple() {
    let mut m = Market::new(MARKETS[0], true);
    let mut money = START_MONEY;
    // 道 (2,6)-(8,6)。りんごとサトウキビは道の上側、飴工房(2×2、左下 (8,4))は道の下側。
    m.roads = (2..9).map(|x| (x, 6)).collect();
    m.items.push(Item::new(food::APPLE, (2, 7)));
    m.items.push(Item::new(food::CANE, (4, 7)));
    let plant = food::DEF.plants.iter().position(|p| p.out == food::CANDY_APPLE).unwrap();
    m.buildings.push(Building::new(BKind::Plant(plant), (8, 4)));
    m.carriers.push(Carrier::at((2, 6)));
    run(&mut m, &mut money, 25.0);
    // りんごは単体で売られず、りんご飴になって売れる
    assert!(m.items.is_empty());
    assert_eq!(money, START_MONEY + food::DEF.items[food::CANDY_APPLE].price);
}

#[test]
fn plant_chain_feeds_next_plant() {
    // 金属加工: 鉄鉱石+石炭→鉄板、鉄板+石炭→鋼材 の2段
    let def = MARKETS[1];
    let mut m = Market::new(def, true);
    let mut money = 0;
    let kind = |name: &str| def.items.iter().position(|i| i.name == name).unwrap();
    let plant = |out: &str| def.plants.iter().position(|p| p.out == kind(out)).unwrap();
    m.quest = 4;
    m.roads = (2..16).map(|x| (x, 6)).collect();
    m.items.push(Item::new(kind("鉄鉱石"), (2, 7)));
    m.items.push(Item::new(kind("石炭"), (4, 7)));
    m.items.push(Item::new(kind("石炭"), (6, 7)));
    m.buildings.push(Building::new(BKind::Plant(plant("鉄板")), (10, 4)));
    m.buildings.push(Building::new(BKind::Plant(plant("鋼材")), (14, 4)));
    m.carriers.push(Carrier::at((2, 6)));
    m.carriers.push(Carrier::at((2, 6)));
    run(&mut m, &mut money, 40.0);
    assert!(m.items.is_empty());
    assert_eq!(money, def.items[kind("鋼材")].price);
}

/// どのマーケットも、クエストの品は売れて、解放済みの手段で作れる。
#[test]
fn every_market_is_playable() {
    for def in MARKETS {
        let n = def.items.len();
        for s in def.sources {
            assert!(s.out < n, "{}", def.name);
        }
        for p in def.plants {
            assert!(p.a < n && p.b < n && p.out < n, "{}", def.name);
        }
        assert!(menu(def).len() <= 2 * MENU_PER_ROW, "{} のメニューが2段に収まらない", def.name);
        // クエスト q の時点で作れる品
        for (q, &(k, _)) in def.quests.iter().enumerate() {
            assert!(def.price(k).is_some(), "{}: {} が売れない", def.name, def.items[k].name);
            let mut can: Vec<Kind> = def.sources.iter().filter(|s| s.unlock <= q).map(|s| s.out).collect();
            can.extend(def.river.map(|r| r.out));
            loop {
                let before = can.len();
                for p in def.plants.iter().filter(|p| p.unlock <= q) {
                    if can.contains(&p.a) && can.contains(&p.b) && !can.contains(&p.out) {
                        can.push(p.out);
                    }
                }
                if can.len() == before {
                    break;
                }
            }
            assert!(can.contains(&k), "{}: クエスト{}の {} が作れない", def.name, q + 1, def.items[k].name);
        }
    }
}

/// tuning: defs をそのまま当てると同じ数値、名前で指した欄だけ変わる。
#[test]
fn tuning_overrides_by_name() {
    use crate::tuning::{apply, dump_defs};
    let mut t = dump_defs();
    let mut warn = vec![];
    let same = apply(&t, &mut warn);
    assert!(warn.is_empty());
    for (a, b) in same.iter().zip(MARKETS) {
        assert_eq!(a.quests, b.quests);
        assert!(a.items.iter().zip(b.items).all(|(x, y)| x.price == y.price));
    }
    let food_t = &mut t.markets[0];
    food_t.items.iter_mut().find(|i| i.name == "パン").unwrap().price = Some(99);
    food_t.quests[0].count = Some(7);
    food_t.sources.retain(|s| s.name != "小麦畑");
    let tuned = apply(&t, &mut warn);
    assert_eq!(tuned[0].items[food::BREAD].price, 99);
    assert_eq!(tuned[0].quests[0], (food::APPLE, 7));
    assert_eq!(tuned[0].sources[1].cost, food::DEF.sources[1].cost);
}
