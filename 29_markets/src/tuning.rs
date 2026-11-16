//! 数値の調整用。defs.rs の数値を名前つき JSON に書き出し(`--dump-defs out.json`)、
//! 起動時に JSON で上書きする(`--tuning tuning.json`、ゲーム本体も sim も)。
//! defs.rs は触らず、上書き版の MarketDef を作って 'static に置き、`markets()` が MARKETS の代わりに返す。
//! 照合は名前(マーケット・品・建物)、クエストだけは並び順。JSON に無い項目は defs のまま。
//! 画面から回す道具は `tools/tune_server.py` + `tools/tune.html`。

use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

use crate::defs::{ItemDef, MARKETS, MarketDef, PlantDef, RiverDef, SourceDef};

#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
pub struct Tuning {
    pub markets: Vec<MarketT>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
pub struct MarketT {
    pub name: String,
    pub items: Vec<ItemT>,
    pub sources: Vec<BuildT>,
    pub plants: Vec<BuildT>,
    pub river: Option<RiverT>,
    pub quests: Vec<QuestT>,
    pub road_cost: Option<u32>,
    pub farmer_cost: Option<u32>,
    pub carrier_cost: Option<u32>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
pub struct ItemT {
    pub name: String,
    pub price: Option<u32>,
}

/// 原料の建物・加工所。`info` は書き出し時の説明(何を作るか)で、読み込みでは使わない。
#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
pub struct BuildT {
    pub name: String,
    pub cost: Option<u32>,
    pub unlock: Option<usize>,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub info: String,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
pub struct RiverT {
    pub worker: String,
    pub cost: Option<u32>,
}

/// クエスト(並び順で照合)。item は品名で、知らない名前なら defs のまま。
#[derive(Serialize, Deserialize, Default)]
#[serde(default)]
pub struct QuestT {
    pub item: String,
    pub count: Option<u32>,
}

static TUNED: OnceLock<Vec<&'static MarketDef>> = OnceLock::new();

/// 今使うマーケットの定義。`--tuning` が読まれていれば上書き版、無ければ defs の MARKETS。
pub fn markets() -> &'static [&'static MarketDef] {
    TUNED.get().map(|v| v.as_slice()).unwrap_or(MARKETS)
}

/// defs の今の数値を Tuning にする。
pub fn dump_defs() -> Tuning {
    let markets = MARKETS
        .iter()
        .map(|d| MarketT {
            name: d.name.into(),
            items: d.items.iter().map(|i| ItemT { name: i.name.into(), price: Some(i.price) }).collect(),
            sources: d
                .sources
                .iter()
                .map(|s| BuildT {
                    name: s.name.into(),
                    cost: Some(s.cost),
                    unlock: Some(s.unlock),
                    info: format!("→{}", d.items[s.out].name),
                })
                .collect(),
            plants: d
                .plants
                .iter()
                .map(|p| BuildT {
                    name: p.name.into(),
                    cost: Some(p.cost),
                    unlock: Some(p.unlock),
                    info: format!("{}+{}→{}", d.items[p.a].name, d.items[p.b].name, d.items[p.out].name),
                })
                .collect(),
            river: d.river.map(|r| RiverT { worker: r.worker.into(), cost: Some(r.cost) }),
            quests: d.quests.iter().map(|&(k, n)| QuestT { item: d.items[k].name.into(), count: Some(n) }).collect(),
            road_cost: Some(d.road_cost),
            farmer_cost: Some(d.farmer_cost),
            carrier_cost: Some(d.carrier_cost),
        })
        .collect();
    Tuning { markets }
}

pub fn write_defs(path: &str) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&dump_defs()).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| format!("{path}: {e}"))
}

/// def を t で上書きした新しい定義(リークして 'static にする。起動時に1回だけなので気にしない)。
pub fn tuned(def: &MarketDef, t: &MarketT, warn: &mut Vec<String>) -> &'static MarketDef {
    for i in &t.items {
        if !def.items.iter().any(|d| d.name == i.name) {
            warn.push(format!("{}: 品 {} が無い", def.name, i.name));
        }
    }
    for b in t.sources.iter().chain(&t.plants) {
        if !def.sources.iter().any(|d| d.name == b.name) && !def.plants.iter().any(|d| d.name == b.name) {
            warn.push(format!("{}: 建物 {} が無い", def.name, b.name));
        }
    }
    let items: Vec<ItemDef> = def
        .items
        .iter()
        .map(|i| {
            let price = t.items.iter().find(|x| x.name == i.name).and_then(|x| x.price).unwrap_or(i.price);
            ItemDef { name: i.name, color: i.color, price }
        })
        .collect();
    let sources: Vec<SourceDef> = def
        .sources
        .iter()
        .map(|s| {
            let o = t.sources.iter().find(|x| x.name == s.name);
            SourceDef {
                name: s.name,
                color: s.color,
                out: s.out,
                cost: o.and_then(|x| x.cost).unwrap_or(s.cost),
                unlock: o.and_then(|x| x.unlock).unwrap_or(s.unlock),
            }
        })
        .collect();
    let plants: Vec<PlantDef> = def
        .plants
        .iter()
        .map(|p| {
            let o = t.plants.iter().find(|x| x.name == p.name);
            PlantDef {
                name: p.name,
                color: p.color,
                a: p.a,
                b: p.b,
                out: p.out,
                cost: o.and_then(|x| x.cost).unwrap_or(p.cost),
                unlock: o.and_then(|x| x.unlock).unwrap_or(p.unlock),
            }
        })
        .collect();
    let river = def.river.map(|r| RiverDef { cost: t.river.as_ref().and_then(|x| x.cost).unwrap_or(r.cost), ..r });
    let quests: Vec<(usize, u32)> = def
        .quests
        .iter()
        .enumerate()
        .map(|(qi, &(k, n))| {
            let Some(o) = t.quests.get(qi) else { return (k, n) };
            let k2 = def.items.iter().position(|i| i.name == o.item).unwrap_or_else(|| {
                if !o.item.is_empty() {
                    warn.push(format!("{}: クエスト{}の品 {} が無い", def.name, qi + 1, o.item));
                }
                k
            });
            (k2, o.count.unwrap_or(n))
        })
        .collect();
    Box::leak(Box::new(MarketDef {
        name: def.name,
        ground: def.ground,
        items: Box::leak(items.into_boxed_slice()),
        sources: Box::leak(sources.into_boxed_slice()),
        plants: Box::leak(plants.into_boxed_slice()),
        river,
        quests: Box::leak(quests.into_boxed_slice()),
        reward: def.reward,
        road_cost: t.road_cost.unwrap_or(def.road_cost),
        farmer_cost: t.farmer_cost.unwrap_or(def.farmer_cost),
        carrier_cost: t.carrier_cost.unwrap_or(def.carrier_cost),
    }))
}

/// Tuning を当てたマーケット一覧(JSON に無いマーケットは defs のまま)。
pub fn apply(t: &Tuning, warn: &mut Vec<String>) -> Vec<&'static MarketDef> {
    for mt in &t.markets {
        if !MARKETS.iter().any(|d| d.name == mt.name) {
            warn.push(format!("マーケット {} が無い", mt.name));
        }
    }
    MARKETS
        .iter()
        .map(|&d| match t.markets.iter().find(|m| m.name == d.name) {
            Some(mt) => tuned(d, mt, warn),
            None => d,
        })
        .collect()
}

/// `--tuning path` の JSON を読み、以後 `markets()` が上書き版を返すようにする。
pub fn load(path: &str) -> Result<(), String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    let t: Tuning = serde_json::from_str(&text).map_err(|e| format!("{path}: {e}"))?;
    let mut warn = vec![];
    let defs = apply(&t, &mut warn);
    for w in warn {
        eprintln!("tuning: {w}");
    }
    TUNED.set(defs).map_err(|_| "tuning は1回しか読めない".to_string())
}
