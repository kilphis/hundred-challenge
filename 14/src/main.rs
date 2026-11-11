use bevy::prelude::*;
use bevy::window::PrimaryWindow;
use std::collections::{HashMap, VecDeque};
use std::f32::consts::{PI, TAU};

const CELL: f32 = 72.0;
const ROWS: i32 = 6;
const START_COLS: i32 = 6;
const EXPAND_COLS: i32 = 2;
const COOLDOWN: f32 = 1.5;
const MAX_USES: u32 = 5;
const START_MONEY: u32 = 50;
const PRESS_T: f32 = 0.18;
const FARMER_INTERVAL: f32 = 3.0;
const FISHER_INTERVAL: f32 = 4.0;
const CARRIER_SPEED: f32 = 3.0; // マス/秒
const DIRS: [(i32, i32); 4] = [(1, 0), (-1, 0), (0, 1), (0, -1)];

type Cell = (i32, i32);

// ---------------------------------------------------------------- データ定義

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
    Wheat,
    Apple,
    Egg,
    Milk,
    Cane,
    Fish,
    Bread,
    CandyApple,
    Dish,
}

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Kind::Wheat => "小麦",
            Kind::Apple => "りんご",
            Kind::Egg => "卵",
            Kind::Milk => "牛乳",
            Kind::Cane => "サトウキビ",
            Kind::Fish => "魚",
            Kind::Bread => "パン",
            Kind::CandyApple => "りんご飴",
            Kind::Dish => "料理",
        }
    }
    fn color(self) -> Color {
        match self {
            Kind::Wheat => Color::srgb(0.90, 0.78, 0.30),
            Kind::Apple => Color::srgb(0.85, 0.15, 0.15),
            Kind::Egg => Color::srgb(0.96, 0.94, 0.86),
            Kind::Milk => Color::srgb(0.92, 0.95, 1.0),
            Kind::Cane => Color::srgb(0.45, 0.75, 0.40),
            Kind::Fish => Color::srgb(0.40, 0.65, 0.85),
            Kind::Bread => Color::srgb(0.72, 0.48, 0.22),
            Kind::CandyApple => Color::srgb(0.95, 0.30, 0.45),
            Kind::Dish => Color::srgb(0.95, 0.65, 0.25),
        }
    }
    /// 市場での売値。None は売れない。
    fn price(self) -> Option<u32> {
        match self {
            Kind::Apple => Some(10),
            Kind::Bread => Some(40),
            Kind::CandyApple => Some(50),
            Kind::Dish => Some(80),
            _ => None,
        }
    }
}

/// 合成レシピ(順不同)。
const RECIPES: &[(Kind, Kind, Kind)] = &[
    (Kind::Wheat, Kind::Milk, Kind::Bread),
    (Kind::Apple, Kind::Cane, Kind::CandyApple),
    (Kind::Fish, Kind::Egg, Kind::Dish),
];

fn recipe(a: Kind, b: Kind) -> Option<Kind> {
    RECIPES.iter().find_map(|&(x, y, r)| {
        if (x == a && y == b) || (x == b && y == a) {
            Some(r)
        } else {
            None
        }
    })
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum BKind {
    Market,
    WheatField,
    AppleTree,
    CaneField,
    Dairy,
    Henhouse,
}

impl BKind {
    fn name(self) -> &'static str {
        match self {
            BKind::Market => "市場",
            BKind::WheatField => "小麦畑",
            BKind::AppleTree => "りんごの木",
            BKind::CaneField => "サトウキビ畑",
            BKind::Dairy => "酪農場",
            BKind::Henhouse => "養鶏場",
        }
    }
    fn color(self) -> Color {
        match self {
            BKind::Market => Color::srgb(0.55, 0.35, 0.20),
            BKind::WheatField => Color::srgb(0.55, 0.50, 0.15),
            BKind::AppleTree => Color::srgb(0.20, 0.45, 0.20),
            BKind::CaneField => Color::srgb(0.25, 0.55, 0.30),
            BKind::Dairy => Color::srgb(0.35, 0.45, 0.60),
            BKind::Henhouse => Color::srgb(0.65, 0.50, 0.35),
        }
    }
    fn produces(self) -> Option<Kind> {
        match self {
            BKind::Market => None,
            BKind::WheatField => Some(Kind::Wheat),
            BKind::AppleTree => Some(Kind::Apple),
            BKind::CaneField => Some(Kind::Cane),
            BKind::Dairy => Some(Kind::Milk),
            BKind::Henhouse => Some(Kind::Egg),
        }
    }
}

/// 建築メニューの道具
#[derive(Clone, Copy, PartialEq, Eq)]
enum Tool {
    Build(BKind),
    Road,
    Farmer,
    Fisher,
    Carrier,
}

impl Tool {
    fn name(self) -> &'static str {
        match self {
            Tool::Build(b) => b.name(),
            Tool::Road => "道",
            Tool::Farmer => "農夫",
            Tool::Fisher => "釣り人",
            Tool::Carrier => "運び人",
        }
    }
    fn desc(self) -> &'static str {
        match self {
            Tool::Build(_) => "空きマスに建築",
            Tool::Road => "空きマスにドラッグで敷く",
            Tool::Farmer => "建物の上に配置",
            Tool::Fisher => "川の隣のマスに配置",
            Tool::Carrier => "市場から出発",
        }
    }
    fn color(self) -> Color {
        match self {
            Tool::Build(b) => b.color(),
            Tool::Road => ROAD_COLOR,
            Tool::Farmer => Color::srgb(0.90, 0.55, 0.20),
            Tool::Fisher => Color::srgb(0.30, 0.55, 0.85),
            Tool::Carrier => Color::srgb(0.55, 0.40, 0.85),
        }
    }
}

const ROAD_COLOR: Color = Color::srgb(0.74, 0.64, 0.45);

/// 建築メニュー: (道具, 費用, このクエスト番号をクリアすると解放)
const MENU: &[(Tool, u32, usize)] = &[
    (Tool::Build(BKind::AppleTree), 20, 0),
    (Tool::Build(BKind::WheatField), 30, 0),
    (Tool::Build(BKind::CaneField), 30, 1),
    (Tool::Build(BKind::Dairy), 60, 2),
    (Tool::Build(BKind::Henhouse), 60, 3),
    (Tool::Road, 5, 0),
    (Tool::Farmer, 40, 0),
    (Tool::Fisher, 40, 0),
    (Tool::Carrier, 40, 0),
];
const BTN_W: f32 = 150.0;
const BTN_H: f32 = 52.0;

fn menu_rect(i: usize) -> (Vec2, Vec2) {
    let (row, col) = ((i / 5) as f32, (i % 5) as f32);
    (Vec2::new(-330.0 + col * (BTN_W + 10.0), -255.0 - row * 60.0), Vec2::new(BTN_W, BTN_H))
}

struct Building {
    kind: BKind,
    cell: Cell,
    cooldown: f32,
    /// 残り使用回数(0 で消える)。市場は対象外。
    uses_left: u32,
    /// クリックで凹むアニメーションの残り時間
    press: f32,
}

struct Quest {
    kind: Kind,
    count: u32,
}

const QUESTS: &[Quest] = &[
    Quest { kind: Kind::Apple, count: 3 },
    Quest { kind: Kind::CandyApple, count: 2 },
    Quest { kind: Kind::Bread, count: 2 },
    Quest { kind: Kind::Bread, count: 3 },
    Quest { kind: Kind::Dish, count: 2 },
];

/// クエストクリア時に、広がったフィールドへ置かれるアイテム(QUESTS と同じ順)。
const REWARDS: &[(Kind, u32)] = &[
    (Kind::Apple, 3),
    (Kind::Apple, 3),
    (Kind::Apple, 3),
    (Kind::Apple, 3),
    (Kind::Apple, 3),
];

struct Item {
    kind: Kind,
    cell: Cell,
    age: f32,
}

impl Item {
    fn new(kind: Kind, cell: Cell) -> Self {
        Item { kind, cell, age: 0.0 }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum WKind {
    Farmer,
    Fisher,
}

#[derive(Clone, Copy)]
struct Worker {
    kind: WKind,
    cell: Cell,
    timer: f32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Goal {
    Idle,
    Pickup(Cell),
    Deliver,
}

#[derive(Clone)]
struct Carrier {
    /// マス座標(中心が整数)
    pos: Vec2,
    path: VecDeque<Cell>,
    carry: Option<Kind>,
    goal: Goal,
    think: f32,
}

enum FxKind {
    Ring,
    Spark,
    Text(String),
}

struct Fx {
    kind: FxKind,
    pos: Vec2,
    vel: Vec2,
    age: f32,
    life: f32,
    color: Color,
}

#[derive(Resource)]
struct Game {
    money: u32,
    quest: usize,
    sold: u32,
    buildings: Vec<Building>,
    items: Vec<Item>,
    roads: Vec<Cell>,
    workers: Vec<Worker>,
    carriers: Vec<Carrier>,
    fx: Vec<Fx>,
    /// ドラッグ中のアイテム(items の添字)
    drag: Option<usize>,
    /// 建築モード中の MENU の添字
    build: Option<usize>,
    time: f32,
    seed: u32,
}

impl Game {
    fn new() -> Self {
        Game {
            money: START_MONEY,
            quest: 0,
            sold: 0,
            buildings: vec![Building {
                kind: BKind::Market,
                cell: (0, 3),
                cooldown: 0.0,
                uses_left: 0,
                press: 0.0,
            }],
            items: vec![],
            roads: vec![],
            workers: vec![],
            carriers: vec![],
            fx: vec![],
            drag: None,
            build: None,
            time: 0.0,
            seed: 12345,
        }
    }

    fn rnd(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.seed >> 8) as f32 / 16777216.0
    }

    fn cols(&self) -> i32 {
        START_COLS + EXPAND_COLS * self.quest as i32
    }

    fn market_cell(&self) -> Cell {
        self.buildings.iter().find(|b| b.kind == BKind::Market).map(|b| b.cell).unwrap_or((0, 3))
    }

    /// 川は一番下の段。物は置けない。
    fn is_river(&self, cell: Cell) -> bool {
        cell.1 == 0
    }

    fn is_road(&self, cell: Cell) -> bool {
        self.roads.contains(&cell)
    }

    fn building_at(&self, cell: Cell) -> Option<usize> {
        self.buildings.iter().position(|b| b.cell == cell)
    }

    fn worker_at(&self, cell: Cell) -> Option<usize> {
        self.workers.iter().position(|w| w.cell == cell)
    }

    fn item_at(&self, cell: Cell, except: Option<usize>) -> Option<usize> {
        self.items
            .iter()
            .enumerate()
            .position(|(i, it)| it.cell == cell && Some(i) != except)
    }

    fn in_field(&self, cell: Cell) -> bool {
        cell.0 >= 0 && cell.0 < self.cols() && cell.1 >= 0 && cell.1 < ROWS
    }

    fn is_free(&self, cell: Cell) -> bool {
        self.in_field(cell)
            && !self.is_river(cell)
            && !self.is_road(cell)
            && self.building_at(cell).is_none()
            && self.worker_at(cell).is_none()
            && self.item_at(cell, None).is_none()
    }

    /// from に最も近い空きマス。
    fn nearest_free(&self, from: Cell) -> Option<Cell> {
        let mut best: Option<(Cell, i32)> = None;
        for x in 0..self.cols() {
            for y in 0..ROWS {
                if self.is_free((x, y)) {
                    let d = (x - from.0).abs() + (y - from.1).abs();
                    if best.map_or(true, |(_, bd)| d < bd) {
                        best = Some(((x, y), d));
                    }
                }
            }
        }
        best.map(|(c, _)| c)
    }

    fn quest_done(&self) -> bool {
        self.quest >= QUESTS.len()
    }
}

// ---------------------------------------------------------------- 座標変換

fn grid_origin(cols: i32) -> Vec2 {
    // 左下マスの左下角
    Vec2::new(-(cols as f32) * CELL / 2.0, -(ROWS as f32) * CELL / 2.0)
}

fn cell_center_f(cols: i32, c: Vec2) -> Vec2 {
    grid_origin(cols) + Vec2::new((c.x + 0.5) * CELL, (c.y + 0.5) * CELL)
}

fn cell_center(cols: i32, cell: Cell) -> Vec2 {
    cell_center_f(cols, Vec2::new(cell.0 as f32, cell.1 as f32))
}

fn world_to_cell(cols: i32, p: Vec2) -> Cell {
    let q = (p - grid_origin(cols)) / CELL;
    (q.x.floor() as i32, q.y.floor() as i32)
}

// ---------------------------------------------------------------- エフェクト

fn burst(game: &mut Game, pos: Vec2, color: Color, n: usize) {
    for i in 0..n {
        let ang = i as f32 / n as f32 * TAU + game.rnd() * 0.6;
        let speed = 90.0 + game.rnd() * 140.0;
        let life = 0.4 + game.rnd() * 0.25;
        game.fx.push(Fx {
            kind: FxKind::Spark,
            pos,
            vel: Vec2::new(ang.cos(), ang.sin()) * speed + Vec2::new(0.0, 60.0),
            age: 0.0,
            life,
            color,
        });
    }
}

fn ring(game: &mut Game, pos: Vec2) {
    game.fx.push(Fx { kind: FxKind::Ring, pos, vel: Vec2::ZERO, age: 0.0, life: 0.35, color: Color::WHITE });
}

fn pop_text(game: &mut Game, pos: Vec2, text: String, color: Color) {
    game.fx.push(Fx { kind: FxKind::Text(text), pos, vel: Vec2::new(0.0, 45.0), age: 0.0, life: 0.9, color });
}

// ---------------------------------------------------------------- ゲーム操作

/// src のマス付近にアイテムを発生させる。
fn produce(game: &mut Game, src: Cell, kind: Kind) -> bool {
    let Some(free) = game.nearest_free(src) else { return false };
    game.items.push(Item::new(kind, free));
    let p = cell_center(game.cols(), src);
    burst(game, p, kind.color(), 10);
    pop_text(game, p + Vec2::new(0.0, 36.0), format!("+{}", kind.name()), Color::WHITE);
    true
}

/// 市場でアイテムを売る。
fn sell(game: &mut Game, kind: Kind, at: Vec2) -> bool {
    let Some(price) = kind.price() else { return false };
    game.money += price;
    if !game.quest_done() && QUESTS[game.quest].kind == kind {
        game.sold += 1;
    }
    let gold = Color::srgb(1.0, 0.85, 0.2);
    burst(game, at, gold, 12);
    pop_text(game, at + Vec2::new(0.0, 36.0), format!("+{}円", price), gold);
    true
}

/// 道(と市場)だけを通る最短経路。from, to を含む。
fn road_path(game: &Game, from: Cell, to: Cell) -> Option<Vec<Cell>> {
    let market = game.market_cell();
    let pass = |c: Cell| c == market || game.roads.contains(&c);
    if !pass(from) || !pass(to) {
        return None;
    }
    let mut prev: HashMap<Cell, Cell> = HashMap::new();
    let mut q = VecDeque::from([from]);
    prev.insert(from, from);
    while let Some(c) = q.pop_front() {
        if c == to {
            let mut path = vec![to];
            let mut cur = to;
            while cur != from {
                cur = prev[&cur];
                path.push(cur);
            }
            path.reverse();
            return Some(path);
        }
        for (dx, dy) in DIRS {
            let n = (c.0 + dx, c.1 + dy);
            if pass(n) && !prev.contains_key(&n) {
                prev.insert(n, c);
                q.push_back(n);
            }
        }
    }
    None
}

fn drop_item(game: &mut Game, i: usize, cell: Cell) {
    if !game.in_field(cell) || game.is_river(cell) || game.is_road(cell) || game.worker_at(cell).is_some() {
        return;
    }
    let kind = game.items[i].kind;
    let p = cell_center(game.cols(), cell);

    // 市場: 売却
    if let Some(bi) = game.building_at(cell) {
        if game.buildings[bi].kind == BKind::Market && sell(game, kind, p) {
            game.buildings[bi].press = PRESS_T;
            game.items.remove(i);
        }
        return;
    }

    // 他のアイテム: 合成
    if let Some(j) = game.item_at(cell, Some(i)) {
        let other = game.items[j].kind;
        if let Some(result) = recipe(kind, other) {
            let (hi, lo) = if i > j { (i, j) } else { (j, i) };
            game.items.remove(hi);
            game.items.remove(lo);
            game.items.push(Item::new(result, cell));
            burst(game, p, result.color(), 14);
            pop_text(game, p + Vec2::new(0.0, 36.0), format!("{}!", result.name()), Color::WHITE);
        }
        return;
    }

    // 空きマス: 移動
    game.items[i].cell = cell;
    game.items[i].age = 0.0;
}

// ---------------------------------------------------------------- 毎フレームの更新

fn update_workers(game: &mut Game, dt: f32) {
    let mut i = 0;
    while i < game.workers.len() {
        let mut w = game.workers[i];
        if w.kind == WKind::Farmer && game.building_at(w.cell).is_none() {
            game.workers.remove(i);
            continue;
        }
        w.timer -= dt;
        if w.timer <= 0.0 {
            match w.kind {
                WKind::Farmer => {
                    w.timer = FARMER_INTERVAL;
                    let bi = game.building_at(w.cell).unwrap();
                    if let Some(k) = game.buildings[bi].kind.produces() {
                        if produce(game, w.cell, k) {
                            game.buildings[bi].press = PRESS_T;
                        }
                    }
                }
                WKind::Fisher => {
                    w.timer = FISHER_INTERVAL;
                    produce(game, w.cell, Kind::Fish);
                }
            }
        }
        game.workers[i] = w;
        i += 1;
    }
}

fn step_carrier(game: &mut Game, ci: usize, c: &mut Carrier, dt: f32) {
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
    let cur = (c.pos.x.round() as i32, c.pos.y.round() as i32);
    let market = game.market_cell();
    let to_market = |game: &Game| -> VecDeque<Cell> {
        road_path(game, cur, market).map(|p| p.into_iter().skip(1).collect()).unwrap_or_default()
    };
    match c.goal {
        Goal::Pickup(ic) => {
            let idx = game
                .items
                .iter()
                .enumerate()
                .position(|(i, it)| it.cell == ic && game.drag != Some(i) && it.kind.price().is_some());
            if let Some(i) = idx {
                c.carry = Some(game.items[i].kind);
                game.items.remove(i);
                if let Some(d) = game.drag {
                    if d > i {
                        game.drag = Some(d - 1);
                    }
                }
            }
            c.path = to_market(game);
            c.goal = Goal::Deliver;
        }
        Goal::Deliver => {
            if cur != market {
                let p = to_market(game);
                if p.is_empty() {
                    c.pos = Vec2::new(market.0 as f32, market.1 as f32);
                }
                c.path = p;
            } else {
                if let Some(k) = c.carry.take() {
                    let at = cell_center(game.cols(), market);
                    sell(game, k, at);
                }
                c.goal = Goal::Idle;
                c.think = 0.0;
            }
        }
        Goal::Idle => {
            c.think -= dt;
            if c.think > 0.0 {
                return;
            }
            c.think = 0.4;
            let claimed: Vec<Cell> = game
                .carriers
                .iter()
                .enumerate()
                .filter(|(j, _)| *j != ci)
                .filter_map(|(_, o)| if let Goal::Pickup(p) = o.goal { Some(p) } else { None })
                .collect();
            let mut best: Option<(Vec<Cell>, Cell)> = None;
            for (i, it) in game.items.iter().enumerate() {
                if game.drag == Some(i) || it.kind.price().is_none() || claimed.contains(&it.cell) {
                    continue;
                }
                for (dx, dy) in DIRS {
                    let n = (it.cell.0 + dx, it.cell.1 + dy);
                    if let Some(p) = road_path(game, market, n) {
                        if best.as_ref().map_or(true, |(bp, _)| p.len() < bp.len()) {
                            best = Some((p, it.cell));
                        }
                    }
                }
            }
            if let Some((p, ic)) = best {
                c.path = p.into_iter().skip(1).collect();
                c.goal = Goal::Pickup(ic);
            }
        }
    }
}

fn tick(mut game: ResMut<Game>, time: Res<Time>) {
    let dt = time.delta_secs();
    let game = &mut *game;
    game.time += dt;
    for b in game.buildings.iter_mut() {
        b.cooldown = (b.cooldown - dt).max(0.0);
        b.press = (b.press - dt).max(0.0);
    }
    for it in game.items.iter_mut() {
        it.age += dt;
    }
    for f in game.fx.iter_mut() {
        f.age += dt;
        f.pos += f.vel * dt;
        if matches!(f.kind, FxKind::Spark) {
            f.vel.y -= 420.0 * dt;
        }
    }
    game.fx.retain(|f| f.age < f.life);

    update_workers(game, dt);
    for ci in 0..game.carriers.len() {
        let mut c = game.carriers[ci].clone();
        step_carrier(game, ci, &mut c, dt);
        game.carriers[ci] = c;
    }
}

// ---------------------------------------------------------------- Bevy

#[derive(Component)]
struct Drawn;

#[derive(Resource)]
struct FontHandle(Handle<Font>);

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "farm".into(),
                resolution: (1280, 720).into(),
                ..default()
            }),
            ..default()
        }))
        .insert_resource(ClearColor(Color::srgb(0.55, 0.78, 0.45)))
        .insert_resource(Game::new())
        .add_systems(Startup, setup)
        .add_systems(Update, (tick, input, quest_check, render).chain())
        .run();
}

fn setup(mut commands: Commands, assets: Res<AssetServer>) {
    commands.spawn(Camera2d);
    commands.insert_resource(FontHandle(assets.load("font.ttf")));
}

fn cursor_world(window: &Window, camera: &Camera, cam_tf: &GlobalTransform) -> Option<Vec2> {
    let pos = window.cursor_position()?;
    camera.viewport_to_world_2d(cam_tf, pos).ok()
}

fn input(
    mut game: ResMut<Game>,
    mouse: Res<ButtonInput<MouseButton>>,
    windows: Query<&Window, With<PrimaryWindow>>,
    cameras: Query<(&Camera, &GlobalTransform)>,
) {
    let game = &mut *game;
    let Ok(window) = windows.single() else { return };
    let Ok((camera, cam_tf)) = cameras.single() else { return };
    let Some(p) = cursor_world(window, camera, cam_tf) else { return };
    let cols = game.cols();
    let cell = world_to_cell(cols, p);
    let pressed_now = mouse.just_pressed(MouseButton::Left);

    if mouse.just_pressed(MouseButton::Right) {
        game.build = None;
    }

    if pressed_now {
        ring(game, p);
        // メニュー
        for (i, &(tool, cost, unlock)) in MENU.iter().enumerate() {
            let (c, size) = menu_rect(i);
            if (p.x - c.x).abs() < size.x / 2.0 && (p.y - c.y).abs() < size.y / 2.0 {
                if unlock <= game.quest && game.money >= cost {
                    if tool == Tool::Carrier {
                        // 運び人はその場で雇って市場から出発
                        game.money -= cost;
                        let m = game.market_cell();
                        game.carriers.push(Carrier {
                            pos: Vec2::new(m.0 as f32, m.1 as f32),
                            path: VecDeque::new(),
                            carry: None,
                            goal: Goal::Idle,
                            think: 0.0,
                        });
                        burst(game, c, tool.color(), 10);
                    } else {
                        game.build = Some(i);
                    }
                }
                return;
            }
        }
    }

    // 建築モード
    if let Some(mi) = game.build {
        let (tool, cost, _) = MENU[mi];
        let trigger = if tool == Tool::Road { mouse.pressed(MouseButton::Left) } else { pressed_now };
        if trigger && game.in_field(cell) && game.money >= cost {
            let center = cell_center(cols, cell);
            let ok = match tool {
                Tool::Build(bk) => {
                    let ok = game.is_free(cell);
                    if ok {
                        game.buildings.push(Building {
                            kind: bk,
                            cell,
                            cooldown: 0.0,
                            uses_left: MAX_USES,
                            press: PRESS_T,
                        });
                    }
                    ok
                }
                Tool::Road => {
                    let ok = game.is_free(cell);
                    if ok {
                        game.roads.push(cell);
                    }
                    ok
                }
                Tool::Farmer => {
                    let ok = game
                        .building_at(cell)
                        .is_some_and(|bi| game.buildings[bi].kind.produces().is_some())
                        && game.worker_at(cell).is_none();
                    if ok {
                        game.workers.push(Worker { kind: WKind::Farmer, cell, timer: FARMER_INTERVAL });
                    }
                    ok
                }
                Tool::Fisher => {
                    let ok = game.is_free(cell)
                        && DIRS.iter().any(|&(dx, dy)| game.is_river((cell.0 + dx, cell.1 + dy)));
                    if ok {
                        game.workers.push(Worker { kind: WKind::Fisher, cell, timer: FISHER_INTERVAL });
                    }
                    ok
                }
                Tool::Carrier => false,
            };
            if ok {
                game.money -= cost;
                burst(game, center, tool.color(), 8);
                if tool != Tool::Road {
                    game.build = None;
                }
            }
        }
        if tool == Tool::Road && game.money < cost {
            game.build = None;
        }
        return;
    }

    if pressed_now && game.in_field(cell) {
        if let Some(i) = game.item_at(cell, None) {
            game.drag = Some(i);
        } else if let Some(bi) = game.building_at(cell) {
            // 建物クリックでアイテム発生
            let (kind, ready) = {
                let b = &game.buildings[bi];
                (b.kind, b.cooldown <= 0.0)
            };
            if let Some(item) = kind.produces() {
                game.buildings[bi].press = PRESS_T;
                if ready && produce(game, cell, item) {
                    game.buildings[bi].cooldown = COOLDOWN;
                    game.buildings[bi].uses_left -= 1;
                    if game.buildings[bi].uses_left == 0 {
                        let c = cell_center(cols, cell);
                        burst(game, c, kind.color(), 14);
                        game.buildings.remove(bi);
                    }
                }
            }
        }
    }

    if mouse.just_released(MouseButton::Left) {
        if let Some(i) = game.drag.take() {
            drop_item(game, i, cell);
        }
    }
}

fn quest_check(mut game: ResMut<Game>) {
    if game.quest_done() {
        return;
    }
    if game.sold >= QUESTS[game.quest].count {
        let old_cols = game.cols();
        let (kind, n) = REWARDS[game.quest];
        game.quest += 1;
        game.sold = 0;
        // 広がった列の空きマスにご褒美アイテムを置く
        let mut left = n;
        for x in old_cols..game.cols() {
            for y in 0..ROWS {
                if left > 0 && game.is_free((x, y)) {
                    game.items.push(Item::new(kind, (x, y)));
                    left -= 1;
                }
            }
        }
    }
}

// ---------------------------------------------------------------- 描画

fn ease_out_back(t: f32) -> f32 {
    let (c1, c3) = (1.70158, 2.70158);
    1.0 + c3 * (t - 1.0).powi(3) + c1 * (t - 1.0).powi(2)
}

fn render(
    mut commands: Commands,
    old: Query<Entity, With<Drawn>>,
    game: Res<Game>,
    font: Res<FontHandle>,
    windows: Query<&Window, With<PrimaryWindow>>,
    cameras: Query<(&Camera, &GlobalTransform)>,
) {
    for e in &old {
        commands.entity(e).despawn();
    }
    let cols = game.cols();

    let label = |commands: &mut Commands, s: &str, size: f32, color: Color, pos: Vec3| {
        commands.spawn((
            Drawn,
            Text2d::new(s),
            TextFont { font: font.0.clone(), font_size: size, ..default() },
            TextColor(color),
            Transform::from_translation(pos),
        ));
    };

    // マス(川・草地)と道
    for x in 0..cols {
        for y in 0..ROWS {
            let c = cell_center(cols, (x, y));
            let color = if game.is_river((x, y)) {
                let w = 0.03 * (game.time * 2.0 + x as f32).sin();
                Color::srgb(0.20 + w, 0.45 + w, 0.80)
            } else {
                let shade = if (x + y) % 2 == 0 { 0.70 } else { 0.66 };
                Color::srgb(0.35, shade, 0.30)
            };
            commands.spawn((Drawn, Sprite::from_color(color, Vec2::splat(CELL - 2.0)), Transform::from_xyz(c.x, c.y, 0.0)));
        }
    }
    for &r in &game.roads {
        let c = cell_center(cols, r);
        commands.spawn((Drawn, Sprite::from_color(ROAD_COLOR, Vec2::splat(CELL - 2.0)), Transform::from_xyz(c.x, c.y, 0.5)));
    }

    // 建物
    for b in game.buildings.iter() {
        let c = cell_center(cols, b.cell);
        let u = 1.0 - b.press / PRESS_T;
        let scale = if b.press > 0.0 { 1.0 - 0.2 * (u * PI).sin() } else { 1.0 };
        commands.spawn((
            Drawn,
            Sprite::from_color(b.kind.color(), Vec2::splat(CELL - 6.0)),
            Transform::from_xyz(c.x, c.y, 1.0).with_scale(Vec3::splat(scale)),
        ));
        let dy = -(1.0 - scale) * 20.0;
        label(&mut commands, b.kind.name(), 13.0, Color::WHITE, Vec3::new(c.x, c.y + 6.0 + dy, 2.0));
        if b.kind != BKind::Market {
            label(&mut commands, &format!("残り{}回", b.uses_left), 12.0, Color::WHITE, Vec3::new(c.x, c.y - 12.0 + dy, 2.0));
        }
        if b.cooldown > 0.0 {
            let h = (CELL - 6.0) * b.cooldown / COOLDOWN;
            commands.spawn((
                Drawn,
                Sprite::from_color(Color::srgba(0.0, 0.0, 0.0, 0.45), Vec2::new(CELL - 6.0, h)),
                Transform::from_xyz(c.x, c.y - (CELL - 6.0) / 2.0 + h / 2.0, 1.5),
            ));
        }
    }

    // 人(農夫・釣り人)
    for w in game.workers.iter() {
        let bob = (game.time * 6.0 + w.cell.0 as f32).sin() * 2.0;
        let (c, tool, name) = match w.kind {
            WKind::Farmer => (cell_center(cols, w.cell) + Vec2::new(22.0, 22.0), Tool::Farmer, "農"),
            WKind::Fisher => (cell_center(cols, w.cell), Tool::Fisher, "釣"),
        };
        commands.spawn((
            Drawn,
            Sprite::from_color(tool.color(), Vec2::splat(26.0)),
            Transform::from_xyz(c.x, c.y + bob, 2.5),
        ));
        label(&mut commands, name, 14.0, Color::WHITE, Vec3::new(c.x, c.y + bob, 2.6));
    }

    // アイテム
    let cursor = (|| {
        let window = windows.single().ok()?;
        let (camera, cam_tf) = cameras.single().ok()?;
        cursor_world(window, camera, cam_tf)
    })();
    for (i, it) in game.items.iter().enumerate() {
        let dragging = game.drag == Some(i);
        let c = match (dragging, cursor) {
            (true, Some(p)) => p,
            _ => cell_center(cols, it.cell),
        };
        let z = if dragging { 10.0 } else { 3.0 };
        let mut s = if it.age < 0.3 { ease_out_back(it.age / 0.3) } else { 1.0 };
        if dragging {
            s = 1.2;
        }
        commands.spawn((
            Drawn,
            Sprite::from_color(it.kind.color(), Vec2::splat(CELL - 22.0)),
            Transform::from_xyz(c.x, c.y, z).with_scale(Vec3::splat(s)),
        ));
        label(&mut commands, it.kind.name(), 12.0 * s, Color::BLACK, Vec3::new(c.x, c.y, z + 0.1));
    }

    // 運び人
    for c in game.carriers.iter() {
        let w = cell_center_f(cols, c.pos);
        commands.spawn((Drawn, Sprite::from_color(Tool::Carrier.color(), Vec2::splat(24.0)), Transform::from_xyz(w.x, w.y, 3.5)));
        label(&mut commands, "運", 13.0, Color::WHITE, Vec3::new(w.x, w.y, 3.6));
        if let Some(k) = c.carry {
            commands.spawn((Drawn, Sprite::from_color(k.color(), Vec2::splat(16.0)), Transform::from_xyz(w.x, w.y + 20.0, 3.7)));
        }
    }

    // エフェクト
    for f in game.fx.iter() {
        let t = f.age / f.life;
        match &f.kind {
            FxKind::Ring => {
                commands.spawn((
                    Drawn,
                    Sprite::from_color(f.color.with_alpha(0.5 * (1.0 - t)), Vec2::splat(12.0 + 56.0 * t)),
                    Transform::from_xyz(f.pos.x, f.pos.y, 8.0).with_rotation(Quat::from_rotation_z(PI / 4.0)),
                ));
            }
            FxKind::Spark => {
                commands.spawn((
                    Drawn,
                    Sprite::from_color(f.color.with_alpha(1.0 - t), Vec2::splat(9.0 * (1.0 - t) + 2.0)),
                    Transform::from_xyz(f.pos.x, f.pos.y, 8.1).with_rotation(Quat::from_rotation_z(f.age * 8.0)),
                ));
            }
            FxKind::Text(s) => {
                let pop = if t < 0.2 { 1.0 + 0.5 * (1.0 - t / 0.2) } else { 1.0 };
                label(&mut commands, s, 20.0 * pop, f.color.with_alpha(1.0 - t * t), Vec3::new(f.pos.x, f.pos.y, 8.2));
            }
        }
    }

    // 建築モードの予告表示
    if let (Some(mi), Some(p)) = (game.build, cursor) {
        let tool = MENU[mi].0;
        commands.spawn((
            Drawn,
            Sprite::from_color(tool.color().with_alpha(0.6), Vec2::splat(CELL - 6.0)),
            Transform::from_xyz(p.x, p.y, 9.0),
        ));
        label(&mut commands, tool.name(), 13.0, Color::WHITE, Vec3::new(p.x, p.y, 9.1));
    }

    // 建築メニュー
    for (i, &(tool, cost, unlock)) in MENU.iter().enumerate() {
        let (c, size) = menu_rect(i);
        let unlocked = unlock <= game.quest;
        let ok = unlocked && game.money >= cost;
        let selected = game.build == Some(i);
        let bg = if selected {
            Color::srgb(0.95, 0.85, 0.30)
        } else if ok {
            Color::srgb(0.25, 0.25, 0.30)
        } else {
            Color::srgb(0.15, 0.15, 0.15)
        };
        commands.spawn((Drawn, Sprite::from_color(bg, size), Transform::from_xyz(c.x, c.y, 5.0)));
        let fg = if selected {
            Color::BLACK
        } else if ok {
            Color::WHITE
        } else {
            Color::srgb(0.5, 0.5, 0.5)
        };
        if unlocked {
            label(&mut commands, &format!("{}  {}円", tool.name(), cost), 16.0, fg, Vec3::new(c.x, c.y + 9.0, 5.1));
            label(&mut commands, tool.desc(), 11.0, fg, Vec3::new(c.x, c.y - 12.0, 5.1));
        } else {
            label(&mut commands, "？？？(未解放)", 16.0, fg, Vec3::new(c.x, c.y, 5.1));
        }
    }
    label(&mut commands, "右クリックで取消", 14.0, Color::WHITE, Vec3::new(510.0, -255.0, 5.0));

    // HUD
    let top = 300.0;
    label(&mut commands, &format!("お金: {}円", game.money), 28.0, Color::WHITE, Vec3::new(-450.0, top, 5.0));

    // クエスト表示
    commands.spawn((
        Drawn,
        Sprite::from_color(Color::srgba(0.0, 0.0, 0.0, 0.55), Vec2::new(520.0, 80.0)),
        Transform::from_xyz(150.0, top - 10.0, 4.0),
    ));
    if game.quest_done() {
        label(&mut commands, "クエスト: 全クリア", 24.0, Color::WHITE, Vec3::new(150.0, top - 10.0, 5.0));
    } else {
        let q = &QUESTS[game.quest];
        label(
            &mut commands,
            &format!("クエスト{} 達成条件", game.quest + 1),
            16.0,
            Color::srgb(1.0, 0.9, 0.4),
            Vec3::new(150.0, top + 15.0, 5.0),
        );
        label(
            &mut commands,
            &format!("{}を{}個 市場で売る  ({}/{})", q.kind.name(), q.count, game.sold, q.count),
            24.0,
            Color::WHITE,
            Vec3::new(150.0, top - 15.0, 5.0),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn carrier_sells_item_via_road() {
        let mut g = Game::new();
        // 市場(0,3) から道を (1,3),(2,3) に敷き、(2,4) にりんごを置く
        g.roads = vec![(1, 3), (2, 3)];
        g.items.push(Item::new(Kind::Apple, (2, 4)));
        g.carriers.push(Carrier { pos: Vec2::new(0.0, 3.0), path: VecDeque::new(), carry: None, goal: Goal::Idle, think: 0.0 });
        for _ in 0..600 {
            update_workers(&mut g, 0.016);
            for ci in 0..g.carriers.len() {
                let mut c = g.carriers[ci].clone();
                step_carrier(&mut g, ci, &mut c, 0.016);
                g.carriers[ci] = c;
            }
        }
        assert!(g.items.is_empty());
        assert_eq!(g.money, START_MONEY + 10);
    }

    #[test]
    fn unconnected_item_is_ignored() {
        let mut g = Game::new();
        g.roads = vec![(1, 3)];
        g.items.push(Item::new(Kind::Apple, (4, 4)));
        g.carriers.push(Carrier { pos: Vec2::new(0.0, 3.0), path: VecDeque::new(), carry: None, goal: Goal::Idle, think: 0.0 });
        for _ in 0..300 {
            let mut c = g.carriers[0].clone();
            step_carrier(&mut g, 0, &mut c, 0.016);
            g.carriers[0] = c;
        }
        assert_eq!(g.items.len(), 1);
    }
}
