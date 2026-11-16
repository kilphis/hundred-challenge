//! 入口。モジュールの宣言、ゲーム全体の定数、Bevy の App 組み立てと毎フレームの tick だけ。
//! 中身は state.rs(型)→ logic.rs(更新)→ input.rs / render.rs(Bevy)の順に依存する。地図は ../CLAUDE.md。

use bevy::prelude::*;

mod defs;
mod input;
mod logic;
mod render;
mod save;
mod sim;
mod state;
#[cfg(test)]
mod tests;
mod tuning;

use state::World;

/// 細かいマス1つの大きさ(px)。建物はこの 2×2 を占める(BSIZE)。
pub const CELL: f32 = 36.0;
pub const ROWS: i32 = 12;
pub const START_COLS: i32 = 12;
pub const EXPAND_COLS: i32 = 4;
/// 建物の一辺(マス数)。市場・原料の建物・加工所はすべて BSIZE×BSIZE。
pub const BSIZE: i32 = 2;
/// 川の段数(一番下から)。
pub const RIVER_ROWS: i32 = 2;
pub const COOLDOWN: f32 = 1.5;
pub const MAX_USES: u32 = 5;
pub const START_MONEY: u32 = 50;
pub const PRESS_T: f32 = 0.18;
pub const FARMER_INTERVAL: f32 = 3.0;
pub const RIVER_INTERVAL: f32 = 4.0;
pub const PROCESS_T: f32 = 2.5;
/// 運び人の速さ(マス/秒)。踏み跡のない地面と、踏み固められた道。マスごとに wear で補間する(state.rs の speed)。
pub const OFFROAD_SPEED: f32 = 1.4;
pub const ROAD_SPEED: f32 = 3.2;
/// 運び人がマスの中心に着くたびに増える踏み固め度(0〜1)。減衰はしない。
pub const WEAR_STEP: f32 = 0.12;
/// この踏み固め度以上を「道」とみなす(is_road)。
pub const ROAD_WEAR: f32 = 0.5;
pub const DIRS: [(i32, i32); 4] = [(1, 0), (-1, 0), (0, 1), (0, -1)];

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let opt = |name: &str| args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned();
    if let Some(path) = opt("--dump-defs") {
        match tuning::write_defs(&path) {
            Ok(()) => println!("{path} に書き出した"),
            Err(e) => eprintln!("書き出し失敗: {e}"),
        }
        return;
    }
    if let Some(path) = opt("--tuning") {
        if let Err(e) = tuning::load(&path) {
            eprintln!("tuning 読み込み失敗: {e}");
            std::process::exit(1);
        }
    }
    if args.iter().any(|a| a == "--sim") {
        sim::run(opt("--json").as_deref());
        return;
    }
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "markets".into(),
                resolution: (1280, 720).into(),
                ..default()
            }),
            ..default()
        }))
        .insert_resource(ClearColor(Color::srgb(0.55, 0.78, 0.45)))
        .insert_resource(start_world())
        .add_systems(Startup, render::setup)
        .add_systems(Update, (tick, input::input, render::render).chain())
        .run();
}

/// `--load パス` があればその状態から始める。
fn start_world() -> World {
    let args: Vec<String> = std::env::args().collect();
    if let Some(path) = args.iter().position(|a| a == "--load").and_then(|i| args.get(i + 1)) {
        match save::load(path) {
            Ok(w) => return w,
            Err(e) => eprintln!("読み込み失敗: {e}"),
        }
    }
    World::new()
}

/// 開いているマーケットは、表示していなくても動き続ける。
fn tick(mut world: ResMut<World>, time: Res<Time>) {
    let dt = time.delta_secs();
    let w = &mut *world;
    for m in w.markets.iter_mut().filter(|m| m.opened) {
        logic::step_market(m, &mut w.money, dt);
    }
}
