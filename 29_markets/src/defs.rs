//! マーケットの中身。どのマーケットも同じ形のデータで、動かし方は main.rs で共通。
//! 新しいマーケットを足すときは、ここに MarketDef を1つ書いて MARKETS に並べるだけ。

use bevy::prelude::Color;

pub struct ItemDef {
    pub name: &'static str,
    pub color: Color,
    /// 市場での売値。0 は売れない。原料は余りを片づけられるよう安値(2円)で売れる。
    pub price: u32,
}

/// 原料を生む建物
pub struct SourceDef {
    pub name: &'static str,
    pub color: Color,
    pub out: usize,
    pub cost: u32,
    /// このクエスト番号に着いたら建てられる
    pub unlock: usize,
}

/// 加工所: a + b → out。手でアイテムを重ねたときの合成レシピも兼ねる。
pub struct PlantDef {
    pub name: &'static str,
    pub color: Color,
    pub a: usize,
    pub b: usize,
    pub out: usize,
    pub cost: u32,
    pub unlock: usize,
}

/// 川の隣に置く係と、取れる物
#[derive(Clone, Copy)]
pub struct RiverDef {
    pub worker: &'static str,
    /// マップ上の1文字表示
    pub short: &'static str,
    pub out: usize,
    pub cost: u32,
}

pub struct MarketDef {
    pub name: &'static str,
    pub ground: Color,
    pub items: &'static [ItemDef],
    pub sources: &'static [SourceDef],
    pub plants: &'static [PlantDef],
    pub river: Option<RiverDef>,
    /// (売る品, 個数)
    pub quests: &'static [(usize, u32)],
    /// クエストクリアで広がった土地に置かれる品
    pub reward: (usize, u32),
    pub road_cost: u32,
    /// 作業員(原料の建物に置くと自動で生産)
    pub farmer_cost: u32,
    pub carrier_cost: u32,
}

impl MarketDef {
    pub fn price(&self, k: usize) -> Option<u32> {
        let p = self.items[k].price;
        (p > 0).then_some(p)
    }

    pub fn recipe(&self, a: usize, b: usize) -> Option<usize> {
        self.plants
            .iter()
            .find(|p| (p.a == a && p.b == b) || (p.a == b && p.b == a))
            .map(|p| p.out)
    }
}

pub static MARKETS: &[&MarketDef] = &[&food::DEF, &metal::DEF, &chip::DEF, &auto::DEF];

const fn rgb(r: f32, g: f32, b: f32) -> Color {
    Color::srgb(r, g, b)
}

const fn item(name: &'static str, color: Color, price: u32) -> ItemDef {
    ItemDef { name, color, price }
}

const fn src(name: &'static str, color: Color, out: usize, cost: u32, unlock: usize) -> SourceDef {
    SourceDef { name, color, out, cost, unlock }
}

const fn plant(name: &'static str, color: Color, a: usize, b: usize, out: usize, cost: u32, unlock: usize) -> PlantDef {
    PlantDef { name, color, a, b, out, cost, unlock }
}

// ---------------------------------------------------------------- 食糧生産(14_farm の中身)

pub mod food {
    use super::*;
    pub const WHEAT: usize = 0;
    pub const APPLE: usize = 1;
    pub const EGG: usize = 2;
    pub const MILK: usize = 3;
    pub const CANE: usize = 4;
    pub const FISH: usize = 5;
    pub const BREAD: usize = 6;
    pub const CANDY_APPLE: usize = 7;
    pub const DISH: usize = 8;

    pub static DEF: MarketDef = MarketDef {
        name: "食糧生産",
        ground: rgb(0.35, 0.70, 0.30),
        items: &[
            item("小麦", rgb(0.90, 0.78, 0.30), 2),
            item("りんご", rgb(0.85, 0.15, 0.15), 10),
            item("卵", rgb(0.96, 0.94, 0.86), 2),
            item("牛乳", rgb(0.92, 0.95, 1.0), 2),
            item("サトウキビ", rgb(0.45, 0.75, 0.40), 2),
            item("魚", rgb(0.40, 0.65, 0.85), 2),
            item("パン", rgb(0.72, 0.48, 0.22), 40),
            item("りんご飴", rgb(0.95, 0.30, 0.45), 50),
            item("料理", rgb(0.95, 0.65, 0.25), 80),
        ],
        sources: &[
            src("りんごの木", rgb(0.20, 0.45, 0.20), APPLE, 20, 0),
            src("小麦畑", rgb(0.55, 0.50, 0.15), WHEAT, 30, 0),
            src("サトウキビ畑", rgb(0.25, 0.55, 0.30), CANE, 30, 1),
            src("酪農場", rgb(0.35, 0.45, 0.60), MILK, 60, 2),
            src("養鶏場", rgb(0.65, 0.50, 0.35), EGG, 60, 3),
        ],
        plants: &[
            plant("飴工房", rgb(0.75, 0.25, 0.40), APPLE, CANE, CANDY_APPLE, 80, 1),
            plant("パン工房", rgb(0.60, 0.40, 0.20), WHEAT, MILK, BREAD, 80, 2),
            plant("調理場", rgb(0.80, 0.50, 0.15), FISH, EGG, DISH, 100, 3),
        ],
        river: Some(RiverDef { worker: "釣り人", short: "釣", out: FISH, cost: 40 }),
        quests: &[(APPLE, 3), (CANDY_APPLE, 2), (BREAD, 2), (BREAD, 3), (DISH, 2)],
        reward: (APPLE, 3),
        road_cost: 5,
        farmer_cost: 40,
        carrier_cost: 40,
    };
}

// ---------------------------------------------------------------- 金属加工

pub mod metal {
    use super::*;
    const ORE: usize = 0;
    const COAL: usize = 1;
    const COPPER_ORE: usize = 2;
    const PLATE: usize = 3;
    const WIRE: usize = 4;
    const STEEL: usize = 5;

    pub static DEF: MarketDef = MarketDef {
        name: "金属加工",
        ground: rgb(0.55, 0.50, 0.42),
        items: &[
            item("鉄鉱石", rgb(0.55, 0.30, 0.25), 10),
            item("石炭", rgb(0.20, 0.20, 0.22), 2),
            item("銅鉱石", rgb(0.30, 0.65, 0.55), 2),
            item("鉄板", rgb(0.70, 0.72, 0.76), 40),
            item("銅線", rgb(0.85, 0.50, 0.25), 50),
            item("鋼材", rgb(0.45, 0.55, 0.70), 90),
        ],
        sources: &[
            src("鉄鉱山", rgb(0.45, 0.25, 0.20), ORE, 20, 0),
            src("炭鉱", rgb(0.25, 0.25, 0.28), COAL, 30, 0),
            src("銅山", rgb(0.25, 0.50, 0.45), COPPER_ORE, 40, 2),
        ],
        plants: &[
            plant("製鉄所", rgb(0.50, 0.30, 0.30), ORE, COAL, PLATE, 100, 1),
            plant("精錬所", rgb(0.65, 0.40, 0.20), COPPER_ORE, COAL, WIRE, 120, 2),
            plant("製鋼所", rgb(0.30, 0.40, 0.55), PLATE, COAL, STEEL, 150, 3),
        ],
        river: None,
        quests: &[(ORE, 3), (PLATE, 2), (WIRE, 2), (STEEL, 2), (STEEL, 3)],
        reward: (ORE, 3),
        road_cost: 5,
        farmer_cost: 40,
        carrier_cost: 40,
    };
}

// ---------------------------------------------------------------- 半導体・電子機器

pub mod chip {
    use super::*;
    const QUARTZ: usize = 0;
    const CHEM: usize = 1;
    const COPPER: usize = 2;
    const RESIN: usize = 3;
    const SILICON: usize = 4;
    const BOARD: usize = 5;
    const CHIP: usize = 6;
    const PHONE: usize = 7;

    pub static DEF: MarketDef = MarketDef {
        name: "半導体・電子機器",
        ground: rgb(0.45, 0.55, 0.62),
        items: &[
            item("ケイ石", rgb(0.85, 0.85, 0.80), 10),
            item("薬品", rgb(0.60, 0.85, 0.35), 2),
            item("銅", rgb(0.85, 0.50, 0.25), 2),
            item("樹脂", rgb(0.95, 0.80, 0.45), 2),
            item("シリコン", rgb(0.55, 0.60, 0.75), 40),
            item("基板", rgb(0.20, 0.55, 0.30), 40),
            item("チップ", rgb(0.30, 0.30, 0.35), 90),
            item("スマホ", rgb(0.15, 0.20, 0.30), 220),
        ],
        sources: &[
            src("採石場", rgb(0.60, 0.58, 0.52), QUARTZ, 30, 0),
            src("化学工場", rgb(0.35, 0.55, 0.30), CHEM, 40, 0),
            src("銅山", rgb(0.65, 0.40, 0.20), COPPER, 40, 1),
            src("樹脂工場", rgb(0.70, 0.55, 0.30), RESIN, 50, 2),
        ],
        plants: &[
            plant("精製所", rgb(0.40, 0.45, 0.60), QUARTZ, CHEM, SILICON, 120, 1),
            plant("基板工場", rgb(0.15, 0.40, 0.25), RESIN, COPPER, BOARD, 150, 2),
            plant("チップ工場", rgb(0.25, 0.25, 0.35), SILICON, COPPER, CHIP, 200, 3),
            plant("組立工場", rgb(0.20, 0.25, 0.40), CHIP, BOARD, PHONE, 250, 4),
        ],
        river: None,
        quests: &[(QUARTZ, 3), (SILICON, 2), (BOARD, 2), (CHIP, 2), (PHONE, 2)],
        reward: (QUARTZ, 3),
        road_cost: 5,
        farmer_cost: 40,
        carrier_cost: 40,
    };
}

// ---------------------------------------------------------------- 自動車

pub mod auto {
    use super::*;
    const SHEET: usize = 0;
    const RUBBER: usize = 1;
    const GLASS: usize = 2;
    const ELEC: usize = 3;
    const TIRE: usize = 4;
    const BODY: usize = 5;
    const CHASSIS: usize = 6;
    const CAR: usize = 7;

    pub static DEF: MarketDef = MarketDef {
        name: "自動車",
        ground: rgb(0.50, 0.50, 0.52),
        items: &[
            item("鋼板", rgb(0.65, 0.68, 0.72), 10),
            item("ゴム", rgb(0.25, 0.22, 0.20), 2),
            item("ガラス", rgb(0.70, 0.88, 0.95), 2),
            item("電装品", rgb(0.95, 0.85, 0.30), 2),
            item("タイヤ", rgb(0.30, 0.30, 0.30), 40),
            item("車体", rgb(0.80, 0.25, 0.25), 50),
            item("車台", rgb(0.60, 0.35, 0.35), 120),
            item("自動車", rgb(0.90, 0.20, 0.20), 260),
        ],
        sources: &[
            src("鋼板倉庫", rgb(0.45, 0.48, 0.55), SHEET, 30, 0),
            src("ゴム園", rgb(0.25, 0.45, 0.25), RUBBER, 40, 0),
            src("ガラス炉", rgb(0.40, 0.60, 0.70), GLASS, 50, 2),
            src("電装倉庫", rgb(0.65, 0.55, 0.20), ELEC, 60, 4),
        ],
        plants: &[
            plant("タイヤ工場", rgb(0.30, 0.30, 0.32), RUBBER, SHEET, TIRE, 150, 1),
            plant("プレス工場", rgb(0.55, 0.25, 0.25), SHEET, GLASS, BODY, 200, 2),
            plant("組立ライン", rgb(0.45, 0.30, 0.30), BODY, TIRE, CHASSIS, 250, 3),
            plant("仕上げ工場", rgb(0.70, 0.20, 0.20), CHASSIS, ELEC, CAR, 300, 4),
        ],
        river: None,
        quests: &[(SHEET, 3), (TIRE, 2), (BODY, 2), (CHASSIS, 2), (CAR, 2)],
        reward: (SHEET, 3),
        road_cost: 5,
        farmer_cost: 40,
        carrier_cost: 40,
    };
}
