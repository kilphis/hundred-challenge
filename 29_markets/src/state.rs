//! ゲームの状態の型(Market / World / Building / Carrier …)と、マス判定・空きマス探索などの小さなメソッド。
//! 建築メニューの中身(menu)とマス⇔座標の変換もここ。依存: defs.rs(tuning.rs 経由)と main.rs の定数だけ(Bevy は Vec2/Color/Resource のみ)。

use bevy::prelude::{Color, Resource, Vec2};
use std::collections::VecDeque;

use crate::defs::MarketDef;
use crate::{BSIZE, CELL, DIRS, EXPAND_COLS, MAX_USES, PRESS_T, RIVER_ROWS, ROWS, START_COLS, START_MONEY};

pub type Cell = (i32, i32);
/// アイテムの種類。各マーケットの `items` の添字。
pub type Kind = usize;

// ---------------------------------------------------------------- 建物の足場(2×2)

/// 建物(左下 `cell`)が占める BSIZE×BSIZE のマス。
pub fn building_cells(cell: Cell) -> impl Iterator<Item = Cell> {
    (0..BSIZE).flat_map(move |dy| (0..BSIZE).map(move |dx| (cell.0 + dx, cell.1 + dy)))
}

/// 建物(左下 `cell`)の外周のマス(角は除く)。運び人が「隣接」とみなす場所。
pub fn building_adj(cell: Cell) -> impl Iterator<Item = Cell> {
    (0..BSIZE).flat_map(move |i| {
        [
            (cell.0 - 1, cell.1 + i),
            (cell.0 + BSIZE, cell.1 + i),
            (cell.0 + i, cell.1 - 1),
            (cell.0 + i, cell.1 + BSIZE),
        ]
    })
}

/// `c` が建物(左下 `cell`)の外周に立っているか。
pub fn adjacent_to_building(c: Cell, cell: Cell) -> bool {
    building_adj(cell).any(|a| a == c)
}

/// `c` が建物(左下 `cell`)の中か。
pub fn in_building(c: Cell, cell: Cell) -> bool {
    c.0 >= cell.0 && c.0 < cell.0 + BSIZE && c.1 >= cell.1 && c.1 < cell.1 + BSIZE
}

// ---------------------------------------------------------------- 建物・道具

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BKind {
    Market,
    /// 原料を生む建物(def.sources の添字)
    Source(usize),
    /// 加工所(def.plants の添字)。材料2つを受け取り、製品を1つ出す。
    Plant(usize),
}

impl BKind {
    pub fn name(self, def: &MarketDef) -> &'static str {
        match self {
            BKind::Market => "市場",
            BKind::Source(i) => def.sources[i].name,
            BKind::Plant(i) => def.plants[i].name,
        }
    }
    pub fn color(self, def: &MarketDef) -> Color {
        match self {
            BKind::Market => Color::srgb(0.55, 0.35, 0.20),
            BKind::Source(i) => def.sources[i].color,
            BKind::Plant(i) => def.plants[i].color,
        }
    }
    pub fn produces(self, def: &MarketDef) -> Option<Kind> {
        match self {
            BKind::Source(i) => Some(def.sources[i].out),
            _ => None,
        }
    }
}

/// 建築メニューの道具
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tool {
    Build(BKind),
    Road,
    Farmer,
    River,
    Carrier,
}

impl Tool {
    pub fn name(self, def: &MarketDef) -> &'static str {
        match self {
            Tool::Build(b) => b.name(def),
            Tool::Road => "道",
            Tool::Farmer => "作業員",
            Tool::River => def.river.map_or("", |r| r.worker),
            Tool::Carrier => "運び人",
        }
    }
    pub fn desc(self, def: &MarketDef) -> String {
        match self {
            Tool::Build(BKind::Plant(i)) => {
                let p = &def.plants[i];
                format!("{}+{}→{}", def.items[p.a].name, def.items[p.b].name, def.items[p.out].name)
            }
            Tool::Build(_) => "2×2の空きマスに建築".into(),
            Tool::Road => "空きマスにドラッグで敷く".into(),
            Tool::Farmer => "原料の建物の上に配置".into(),
            Tool::River => "川の隣のマスに配置".into(),
            Tool::Carrier => "市場から出発".into(),
        }
    }
    pub fn color(self, def: &MarketDef) -> Color {
        match self {
            Tool::Build(b) => b.color(def),
            Tool::Road => ROAD_COLOR,
            Tool::Farmer => Color::srgb(0.90, 0.55, 0.20),
            Tool::River => Color::srgb(0.30, 0.55, 0.85),
            Tool::Carrier => Color::srgb(0.55, 0.40, 0.85),
        }
    }
}

pub const ROAD_COLOR: Color = Color::srgb(0.74, 0.64, 0.45);
/// 市場の左下マス(旧 1×1 マス系の (0,3) にあたる)
pub const MARKET_CELL: Cell = (0, 6);

/// 建築メニュー: (道具, 費用, このクエスト番号をクリアすると解放)。マーケットの定義から組み立てる。
pub fn menu(def: &MarketDef) -> Vec<(Tool, u32, usize)> {
    let mut v = vec![];
    for (i, s) in def.sources.iter().enumerate() {
        v.push((Tool::Build(BKind::Source(i)), s.cost, s.unlock));
    }
    for (i, p) in def.plants.iter().enumerate() {
        v.push((Tool::Build(BKind::Plant(i)), p.cost, p.unlock));
    }
    v.push((Tool::Road, def.road_cost, 0));
    v.push((Tool::Farmer, def.farmer_cost, 0));
    if let Some(r) = def.river {
        v.push((Tool::River, r.cost, 0));
    }
    v.push((Tool::Carrier, def.carrier_cost, 0));
    v
}

pub struct Building {
    pub kind: BKind,
    /// 占める BSIZE×BSIZE マスの左下
    pub cell: Cell,
    pub cooldown: f32,
    /// 残り使用回数(0 で消える)。原料の建物だけ。
    pub uses_left: u32,
    /// クリックで凹むアニメーションの残り時間
    pub press: f32,
    /// 加工所: 材料 a, b が入っているか
    pub stock: [bool; 2],
    /// 加工所: 加工の進み(秒)
    pub work: f32,
}

impl Building {
    pub fn new(kind: BKind, cell: Cell) -> Self {
        Building { kind, cell, cooldown: 0.0, uses_left: MAX_USES, press: PRESS_T, stock: [false; 2], work: 0.0 }
    }

    /// 加工所がこの材料を受け取れるなら、その枠の番号。
    pub fn slot(&self, def: &MarketDef, kind: Kind) -> Option<usize> {
        let BKind::Plant(p) = self.kind else { return None };
        let pd = &def.plants[p];
        if pd.a == kind && !self.stock[0] {
            Some(0)
        } else if pd.b == kind && !self.stock[1] {
            Some(1)
        } else {
            None
        }
    }
}

pub struct Item {
    pub kind: Kind,
    pub cell: Cell,
    pub age: f32,
}

impl Item {
    pub fn new(kind: Kind, cell: Cell) -> Self {
        Item { kind, cell, age: 0.0 }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum WKind {
    Farmer,
    River,
}

#[derive(Clone, Copy)]
pub struct Worker {
    pub kind: WKind,
    /// Farmer は乗っている建物の左下、River は立っている1マス
    pub cell: Cell,
    pub timer: f32,
}

/// 運び人の届け先
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Dest {
    Market,
    Plant(Cell),
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Goal {
    Idle,
    Pickup { at: Cell, kind: Kind, dest: Dest },
    Deliver(Dest),
}

#[derive(Clone)]
pub struct Carrier {
    /// マス座標(中心が整数)
    pub pos: Vec2,
    pub path: VecDeque<Cell>,
    pub carry: Option<Kind>,
    pub goal: Goal,
    pub think: f32,
}

impl Carrier {
    pub fn at(cell: Cell) -> Self {
        Carrier {
            pos: Vec2::new(cell.0 as f32, cell.1 as f32),
            path: VecDeque::new(),
            carry: None,
            goal: Goal::Idle,
            think: 0.0,
        }
    }
    pub fn cell(&self) -> Cell {
        (self.pos.x.round() as i32, self.pos.y.round() as i32)
    }
}

pub enum FxKind {
    Ring,
    Spark,
    Text(String),
}

pub struct Fx {
    pub kind: FxKind,
    pub pos: Vec2,
    pub vel: Vec2,
    pub age: f32,
    pub life: f32,
    pub color: Color,
}

/// マーケット1つ分の状態。中身(何を作って何を売るか)は def が決め、動かし方はどのマーケットも同じ。
pub struct Market {
    pub def: &'static MarketDef,
    pub opened: bool,
    pub quest: usize,
    pub sold: u32,
    pub buildings: Vec<Building>,
    pub items: Vec<Item>,
    pub roads: Vec<Cell>,
    pub workers: Vec<Worker>,
    pub carriers: Vec<Carrier>,
    pub fx: Vec<Fx>,
    /// ドラッグ中のアイテム(items の添字)
    pub drag: Option<usize>,
    /// 建築モード中のメニューの添字
    pub build: Option<usize>,
    pub time: f32,
    pub seed: u32,
}

impl Market {
    pub fn new(def: &'static MarketDef, opened: bool) -> Self {
        let mut m = Market {
            def,
            opened,
            quest: 0,
            sold: 0,
            buildings: vec![],
            items: vec![],
            roads: vec![],
            workers: vec![],
            carriers: vec![],
            fx: vec![],
            drag: None,
            build: None,
            time: 0.0,
            seed: 12345,
        };
        let mut market = Building::new(BKind::Market, MARKET_CELL);
        market.press = 0.0;
        m.buildings.push(market);
        m
    }

    pub fn rnd(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.seed >> 8) as f32 / 16777216.0
    }

    pub fn cols(&self) -> i32 {
        START_COLS + EXPAND_COLS * self.quest as i32
    }

    /// 市場の左下マス
    pub fn market_cell(&self) -> Cell {
        self.buildings.iter().find(|b| b.kind == BKind::Market).map(|b| b.cell).unwrap_or(MARKET_CELL)
    }

    /// 運び人を雇ったときに立つマス: 市場の右隣(下段)。そこが道でなければ市場の外周の道、それも無ければ右隣。
    pub fn carrier_start(&self) -> Cell {
        let mc = self.market_cell();
        let right = (mc.0 + BSIZE, mc.1);
        if self.is_road(right) {
            return right;
        }
        building_adj(mc).find(|&c| self.is_road(c)).unwrap_or(right)
    }

    /// 川は一番下の RIVER_ROWS 段(川のあるマーケットだけ)。物は置けない。
    pub fn is_river(&self, cell: Cell) -> bool {
        self.def.river.is_some() && cell.1 < RIVER_ROWS
    }

    pub fn is_road(&self, cell: Cell) -> bool {
        self.roads.contains(&cell)
    }

    /// 運び人が歩けるマス(道)。市場には入らず、外周の道から売る。
    pub fn passable(&self, cell: Cell) -> bool {
        self.is_road(cell)
    }

    pub fn touches_road(&self, cell: Cell) -> bool {
        DIRS.iter().any(|&(dx, dy)| self.passable((cell.0 + dx, cell.1 + dy)))
    }

    /// このマスを含む建物(2×2 のどのマスでも当たる)
    pub fn building_at(&self, cell: Cell) -> Option<usize> {
        self.buildings.iter().position(|b| in_building(cell, b.cell))
    }

    /// このマスにいる人。作業員は乗っている建物のどのマスでも当たる。
    pub fn worker_at(&self, cell: Cell) -> Option<usize> {
        self.workers.iter().position(|w| match w.kind {
            WKind::Farmer => in_building(cell, w.cell),
            WKind::River => w.cell == cell,
        })
    }

    /// 左下を `cell` にして建物を置けるか(4マス全部が空き)。
    pub fn can_place_building(&self, cell: Cell) -> bool {
        building_cells(cell).all(|c| self.is_free(c))
    }

    pub fn item_at(&self, cell: Cell, except: Option<usize>) -> Option<usize> {
        self.items
            .iter()
            .enumerate()
            .position(|(i, it)| it.cell == cell && Some(i) != except)
    }

    pub fn in_field(&self, cell: Cell) -> bool {
        cell.0 >= 0 && cell.0 < self.cols() && cell.1 >= 0 && cell.1 < ROWS
    }

    pub fn is_free(&self, cell: Cell) -> bool {
        self.in_field(cell)
            && !self.is_river(cell)
            && !self.is_road(cell)
            && self.building_at(cell).is_none()
            && self.worker_at(cell).is_none()
            && self.item_at(cell, None).is_none()
    }

    /// from に最も近い空きマス。同じ近さなら右→上下→左の順。prefer_road なら道に面したマスを優先する。
    /// from が建物のマスなら、その建物の 2×2 全体からの距離で測る。
    pub fn nearest_free(&self, from: Cell, prefer_road: bool) -> Option<Cell> {
        // 足場の範囲 [x0, x1] × [y0, y1]
        let (x0, y0, x1, y1) = match self.building_at(from) {
            Some(bi) => {
                let b = self.buildings[bi].cell;
                (b.0, b.1, b.0 + BSIZE - 1, b.1 + BSIZE - 1)
            }
            None => (from.0, from.1, from.0, from.1),
        };
        let gap = |v: i32, lo: i32, hi: i32| if v < lo { lo - v } else if v > hi { v - hi } else { 0 };
        let mut best: Option<(Cell, i32)> = None;
        for x in 0..self.cols() {
            for y in 0..ROWS {
                if self.is_free((x, y)) {
                    let side = if x > x1 {
                        0
                    } else if x >= x0 {
                        1
                    } else {
                        2
                    };
                    let mut d = (gap(x, x0, x1) + gap(y, y0, y1)) * 3 + side;
                    if prefer_road && !self.touches_road((x, y)) {
                        d += 9;
                    }
                    if best.map_or(true, |(_, bd)| d < bd) {
                        best = Some(((x, y), d));
                    }
                }
            }
        }
        best.map(|(c, _)| c)
    }

    pub fn quest_done(&self) -> bool {
        self.quest >= self.def.quests.len()
    }
}

/// マーケットの集まり。これ自体も「1つの経済」として、お金を共有する。
#[derive(Resource)]
pub struct World {
    pub markets: Vec<Market>,
    pub active: usize,
    pub money: u32,
}

impl World {
    pub fn new() -> Self {
        World {
            markets: crate::tuning::markets().iter().enumerate().map(|(i, d)| Market::new(*d, i == 0)).collect(),
            active: 0,
            money: START_MONEY,
        }
    }

    /// 1つ前のマーケットのクエストを全部クリアしていれば開ける。
    pub fn can_open(&self, i: usize) -> bool {
        i == 0 || self.markets[i - 1].quest_done()
    }

    /// タブを押した: 開放済みなら切り替え、開けられるなら開く。
    pub fn select(&mut self, i: usize) {
        if i >= self.markets.len() {
            return;
        }
        if !self.markets[i].opened {
            if !self.can_open(i) {
                return;
            }
            self.markets[i].opened = true;
        }
        let cur = &mut self.markets[self.active];
        cur.drag = None;
        cur.build = None;
        self.active = i;
    }
}

// ---------------------------------------------------------------- 座標変換

pub fn grid_origin(cols: i32) -> Vec2 {
    // 左下マスの左下角
    Vec2::new(-(cols as f32) * CELL / 2.0, -(ROWS as f32) * CELL / 2.0)
}

pub fn cell_center_f(cols: i32, c: Vec2) -> Vec2 {
    grid_origin(cols) + Vec2::new((c.x + 0.5) * CELL, (c.y + 0.5) * CELL)
}

pub fn cell_center(cols: i32, cell: Cell) -> Vec2 {
    cell_center_f(cols, Vec2::new(cell.0 as f32, cell.1 as f32))
}

/// 建物(左下 `cell`)の中心の座標
pub fn building_center(cols: i32, cell: Cell) -> Vec2 {
    cell_center_f(cols, Vec2::new(cell.0 as f32, cell.1 as f32) + Vec2::splat((BSIZE as f32 - 1.0) / 2.0))
}

pub fn world_to_cell(cols: i32, p: Vec2) -> Cell {
    let q = (p - grid_origin(cols)) / CELL;
    (q.x.floor() as i32, q.y.floor() as i32)
}
