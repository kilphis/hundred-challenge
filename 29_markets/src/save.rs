//! デバッグ用: ゲームの状態を JSON に書き出し、読み込んで続きから遊ぶ。
//! 品物・建物は添字ではなく名前で書くので、defs.rs の並びを変えても読める(名前を変えたら消える)。
//!
//! - ゲーム中: F5 で `state.json` に保存、F9 で読み込み
//! - 起動時: `cargo run -- --load states/金属加工.json`
//! - シミュレーター: 各マーケットの開始時・打ち切り時に `states/` へ書き出す

use crate::defs::MarketDef;
use crate::state::*;
use crate::{FARMER_INTERVAL, RIVER_INTERVAL};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Snapshot {
    pub money: u32,
    pub active: usize,
    pub markets: Vec<MarketSnap>,
}

#[derive(Serialize, Deserialize)]
pub struct MarketSnap {
    pub name: String,
    pub opened: bool,
    pub quest: usize,
    pub sold: u32,
    pub buildings: Vec<BuildingSnap>,
    pub items: Vec<(String, Cell)>,
    /// (マス, 踏み固め度)。マス順に並べる
    #[serde(default)]
    pub wear: Vec<(Cell, f32)>,
    /// (作業員 or 川の係, マス)
    pub workers: Vec<(String, Cell)>,
    pub carriers: usize,
}

#[derive(Serialize, Deserialize)]
pub struct BuildingSnap {
    pub name: String,
    /// 建物の左下マス
    pub cell: Cell,
    pub uses_left: u32,
    pub stock: [bool; 2],
}

fn kind_by_name(def: &MarketDef, name: &str) -> Option<Kind> {
    def.items.iter().position(|i| i.name == name)
}

fn bkind_by_name(def: &MarketDef, name: &str) -> Option<BKind> {
    if name == "市場" {
        return Some(BKind::Market);
    }
    def.sources
        .iter()
        .position(|s| s.name == name)
        .map(BKind::Source)
        .or_else(|| def.plants.iter().position(|p| p.name == name).map(BKind::Plant))
}

impl Snapshot {
    pub fn of(w: &World) -> Self {
        Snapshot {
            money: w.money,
            active: w.active,
            markets: w
                .markets
                .iter()
                .map(|m| MarketSnap {
                    name: m.def.name.into(),
                    opened: m.opened,
                    quest: m.quest,
                    sold: m.sold,
                    buildings: m
                        .buildings
                        .iter()
                        .map(|b| BuildingSnap {
                            name: b.kind.name(m.def).into(),
                            cell: b.cell,
                            uses_left: b.uses_left,
                            stock: b.stock,
                        })
                        .collect(),
                    items: m.items.iter().map(|i| (m.def.items[i.kind].name.into(), i.cell)).collect(),
                    wear: {
                        let mut v: Vec<(Cell, f32)> = m.wear.iter().map(|(c, w)| (*c, *w)).collect();
                        v.sort_by_key(|(c, _)| *c);
                        v
                    },
                    workers: m
                        .workers
                        .iter()
                        .map(|w| {
                            let n = match w.kind {
                                WKind::Farmer => "作業員",
                                WKind::River => m.def.river.map_or("川の係", |r| r.worker),
                            };
                            (n.into(), w.cell)
                        })
                        .collect(),
                    carriers: m.carriers.len(),
                })
                .collect(),
        }
    }

    /// 状態を World に戻す。運び人は市場に立った状態から、加工の途中経過は 0 から。
    pub fn restore(&self) -> World {
        let mut w = World::new();
        w.money = self.money;
        w.active = self.active.min(w.markets.len() - 1);
        for s in &self.markets {
            let Some(m) = w.markets.iter_mut().find(|m| m.def.name == s.name) else { continue };
            let def = m.def;
            m.opened = s.opened;
            m.quest = s.quest.min(def.quests.len());
            m.sold = s.sold;
            m.buildings = s
                .buildings
                .iter()
                .filter_map(|b| {
                    let mut nb = Building::new(bkind_by_name(def, &b.name)?, b.cell);
                    nb.uses_left = b.uses_left;
                    nb.stock = b.stock;
                    nb.press = 0.0;
                    Some(nb)
                })
                .collect();
            m.items = s.items.iter().filter_map(|(n, c)| Some(Item::new(kind_by_name(def, n)?, *c))).collect();
            m.wear = s.wear.iter().copied().collect();
            m.workers = s
                .workers
                .iter()
                .map(|(n, c)| {
                    let kind = if n == "作業員" { WKind::Farmer } else { WKind::River };
                    let timer = if kind == WKind::Farmer { FARMER_INTERVAL } else { RIVER_INTERVAL };
                    Worker { kind, cell: *c, timer }
                })
                .collect();
            let start = m.carrier_start();
            m.carriers = (0..s.carriers).map(|_| Carrier::at(start)).collect();
        }
        w
    }
}

pub fn save(w: &World, path: &str) -> std::io::Result<()> {
    if let Some(dir) = std::path::Path::new(path).parent() {
        std::fs::create_dir_all(dir)?;
    }
    let json = serde_json::to_string_pretty(&Snapshot::of(w)).expect("JSON にできない");
    std::fs::write(path, json)
}

pub fn load(path: &str) -> Result<World, String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    let snap: Snapshot = serde_json::from_str(&text).map_err(|e| format!("{path}: {e}"))?;
    Ok(snap.restore())
}
