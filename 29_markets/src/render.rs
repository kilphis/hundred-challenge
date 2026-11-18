//! Bevy の描画。毎フレーム全部消して描き直す(Drawn の付いたスプライトと文字)。レイアウト定数とボタンの位置もここ。
//! 依存: state.rs(読むだけ)、input.rs の cursor_world。見た目を変えるときはこのファイルだけ触ればよい。

use bevy::prelude::*;
use bevy::window::PrimaryWindow;
use std::f32::consts::PI;

use crate::input::cursor_world;
use crate::state::*;
use crate::state::World; // bevy::prelude::World と区別する
use crate::{BSIZE, CELL, COOLDOWN, PRESS_T, PROCESS_T, ROWS};

/// 建物(2×2)の描画サイズ(px)。
const BUILDING_PX: f32 = BSIZE as f32 * CELL - 6.0;

// ---------------------------------------------------------------- レイアウト

pub const MENU_PER_ROW: usize = 6;
const BTN_W: f32 = 185.0;
const BTN_H: f32 = 52.0;

pub fn menu_rect(i: usize) -> (Vec2, Vec2) {
    let (row, col) = ((i / MENU_PER_ROW) as f32, (i % MENU_PER_ROW) as f32);
    let x0 = -(MENU_PER_ROW as f32 * (BTN_W + 10.0) - 10.0) / 2.0 + BTN_W / 2.0;
    (Vec2::new(x0 + col * (BTN_W + 10.0), -255.0 - row * 60.0), Vec2::new(BTN_W, BTN_H))
}

const TAB_W: f32 = 275.0;
const TAB_H: f32 = 32.0;

pub fn tab_rect(i: usize) -> (Vec2, Vec2) {
    (Vec2::new(-427.5 + i as f32 * (TAB_W + 10.0), 340.0), Vec2::new(TAB_W, TAB_H))
}

pub fn hit(p: Vec2, (c, size): (Vec2, Vec2)) -> bool {
    (p.x - c.x).abs() < size.x / 2.0 && (p.y - c.y).abs() < size.y / 2.0
}

#[derive(Component)]
pub struct Drawn;

#[derive(Resource)]
pub struct FontHandle(Handle<Font>);

pub fn setup(mut commands: Commands, assets: Res<AssetServer>) {
    commands.spawn(Camera2d);
    commands.insert_resource(FontHandle(assets.load("font.ttf")));
}

// ---------------------------------------------------------------- 描画

fn ease_out_back(t: f32) -> f32 {
    let (c1, c3) = (1.70158, 2.70158);
    1.0 + c3 * (t - 1.0).powi(3) + c1 * (t - 1.0).powi(2)
}

fn rgb_scale(c: Color, k: f32) -> Color {
    let s = c.to_srgba();
    Color::srgb(s.red * k, s.green * k, s.blue * k)
}

fn mix(a: Color, b: Color, t: f32) -> Color {
    let (a, b) = (a.to_srgba(), b.to_srgba());
    Color::srgb(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t)
}

/// 踏み固め度 → 道の色の混ぜ具合。3段階(ほぼ地面 / 薄い踏み跡 / しっかり道 = is_road)に見せる。
fn trail_mix(m: &Market, cell: Cell) -> f32 {
    if m.is_road(cell) {
        1.0
    } else if m.wear_at(cell) >= 0.15 {
        0.45
    } else {
        0.0
    }
}

pub fn render(
    mut commands: Commands,
    old: Query<Entity, With<Drawn>>,
    world: Res<World>,
    mut clear: ResMut<ClearColor>,
    font: Res<FontHandle>,
    windows: Query<&Window, With<PrimaryWindow>>,
    cameras: Query<(&Camera, &GlobalTransform)>,
) {
    for e in &old {
        commands.entity(e).despawn();
    }
    let m = &world.markets[world.active];
    let def = m.def;
    let menu = menu(def);
    let cols = m.cols();
    clear.0 = rgb_scale(def.ground, 1.25);

    let label = |commands: &mut Commands, s: &str, size: f32, color: Color, pos: Vec3| {
        commands.spawn((
            Drawn,
            Text2d::new(s),
            TextFont { font: font.0.clone(), font_size: size, ..default() },
            TextColor(color),
            Transform::from_translation(pos),
        ));
    };
    let rect = |commands: &mut Commands, color: Color, size: Vec2, pos: Vec3| {
        commands.spawn((Drawn, Sprite::from_color(color, size), Transform::from_translation(pos)));
    };

    // マス(川・地面)。地面は踏み固め度に応じて道の色へ寄せる
    for x in 0..cols {
        for y in 0..ROWS {
            let c = cell_center(cols, (x, y));
            let color = if m.is_river((x, y)) {
                let w = 0.03 * (m.time * 2.0 + x as f32).sin();
                Color::srgb(0.20 + w, 0.45 + w, 0.80)
            } else {
                let ground = rgb_scale(def.ground, if (x + y) % 2 == 0 { 1.0 } else { 0.94 });
                mix(ground, ROAD_COLOR, trail_mix(m, (x, y)))
            };
            rect(&mut commands, color, Vec2::splat(CELL - 2.0), Vec3::new(c.x, c.y, 0.0));
        }
    }

    // 建物(2×2 マス、左下が b.cell)
    for b in m.buildings.iter() {
        let c = building_center(cols, b.cell);
        let u = 1.0 - b.press / PRESS_T;
        let scale = if b.press > 0.0 { 1.0 - 0.2 * (u * PI).sin() } else { 1.0 };
        commands.spawn((
            Drawn,
            Sprite::from_color(b.kind.color(def), Vec2::splat(BUILDING_PX)),
            Transform::from_xyz(c.x, c.y, 1.0).with_scale(Vec3::splat(scale)),
        ));
        let dy = -(1.0 - scale) * 20.0;
        match b.kind {
            BKind::Market => {
                label(&mut commands, "市場", 13.0, Color::WHITE, Vec3::new(c.x, c.y + dy, 2.0));
            }
            BKind::Source(_) => {
                label(&mut commands, b.kind.name(def), 13.0, Color::WHITE, Vec3::new(c.x, c.y + 6.0 + dy, 2.0));
                label(&mut commands, &format!("残り{}回", b.uses_left), 12.0, Color::WHITE, Vec3::new(c.x, c.y - 12.0 + dy, 2.0));
            }
            BKind::Plant(p) => {
                let pd = &def.plants[p];
                label(&mut commands, pd.name, 13.0, Color::WHITE, Vec3::new(c.x, c.y + 14.0 + dy, 2.0));
                // 材料の枠: 入っていれば濃く、空なら薄く
                for (s, k) in [pd.a, pd.b].into_iter().enumerate() {
                    let x = c.x + if s == 0 { -13.0 } else { 13.0 };
                    let alpha = if b.stock[s] { 1.0 } else { 0.25 };
                    rect(&mut commands, Color::srgba(0.0, 0.0, 0.0, 0.35), Vec2::splat(22.0), Vec3::new(x, c.y - 8.0 + dy, 1.8));
                    rect(&mut commands, def.items[k].color.with_alpha(alpha), Vec2::splat(18.0), Vec3::new(x, c.y - 8.0 + dy, 1.9));
                }
                if b.work > 0.0 {
                    let bar_w = BUILDING_PX - 8.0;
                    let wbar = bar_w * (b.work / PROCESS_T).min(1.0);
                    let y = c.y - 27.0;
                    rect(&mut commands, Color::srgba(0.0, 0.0, 0.0, 0.4), Vec2::new(bar_w, 5.0), Vec3::new(c.x, y, 1.9));
                    rect(&mut commands, Color::WHITE, Vec2::new(wbar, 5.0), Vec3::new(c.x - (bar_w - wbar) / 2.0, y, 2.0));
                }
            }
        }
        if b.cooldown > 0.0 {
            let h = BUILDING_PX * b.cooldown / COOLDOWN;
            rect(
                &mut commands,
                Color::srgba(0.0, 0.0, 0.0, 0.45),
                Vec2::new(BUILDING_PX, h),
                Vec3::new(c.x, c.y - BUILDING_PX / 2.0 + h / 2.0, 1.5),
            );
        }
    }

    // 人(作業員・川の係)
    for w in m.workers.iter() {
        let bob = (m.time * 6.0 + w.cell.0 as f32).sin() * 2.0;
        let (c, tool, name) = match w.kind {
            WKind::Farmer => (building_center(cols, w.cell) + Vec2::new(22.0, 22.0), Tool::Farmer, "作"),
            WKind::River => (cell_center(cols, w.cell), Tool::River, def.river.map_or("", |r| r.short)),
        };
        rect(&mut commands, tool.color(def), Vec2::splat(26.0), Vec3::new(c.x, c.y + bob, 2.5));
        label(&mut commands, name, 14.0, Color::WHITE, Vec3::new(c.x, c.y + bob, 2.6));
    }

    // アイテム
    let cursor = (|| {
        let window = windows.single().ok()?;
        let (camera, cam_tf) = cameras.single().ok()?;
        cursor_world(window, camera, cam_tf)
    })();
    for (i, it) in m.items.iter().enumerate() {
        let dragging = m.drag == Some(i);
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
            Sprite::from_color(def.items[it.kind].color, Vec2::splat(CELL - 6.0)),
            Transform::from_xyz(c.x, c.y, z).with_scale(Vec3::splat(s)),
        ));
        label(&mut commands, def.items[it.kind].name, 10.0 * s, Color::BLACK, Vec3::new(c.x, c.y, z + 0.1));
    }

    // 運び人
    for c in m.carriers.iter() {
        let w = cell_center_f(cols, c.pos);
        rect(&mut commands, Tool::Carrier.color(def), Vec2::splat(24.0), Vec3::new(w.x, w.y, 3.5));
        label(&mut commands, "運", 13.0, Color::WHITE, Vec3::new(w.x, w.y, 3.6));
        if let Some(k) = c.carry {
            rect(&mut commands, def.items[k].color, Vec2::splat(16.0), Vec3::new(w.x, w.y + 20.0, 3.7));
        }
    }

    // エフェクト
    for f in m.fx.iter() {
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

    // 建築モードの予告表示(建物はカーソルのマスを左下にした 2×2 の位置に)
    if let (Some(mi), Some(p)) = (m.build, cursor) {
        let tool = menu[mi].0;
        let (q, size) = match tool {
            Tool::Build(_) => {
                let cell = world_to_cell(cols, p);
                if m.in_field(cell) { (building_center(cols, cell), BUILDING_PX) } else { (p, BUILDING_PX) }
            }
            _ => (p, CELL - 6.0),
        };
        rect(&mut commands, tool.color(def).with_alpha(0.6), Vec2::splat(size), Vec3::new(q.x, q.y, 9.0));
        label(&mut commands, tool.name(def), 13.0, Color::WHITE, Vec3::new(q.x, q.y, 9.1));
    }

    // 建築メニュー
    for (i, &(tool, cost, unlock)) in menu.iter().enumerate() {
        let (c, size) = menu_rect(i);
        let unlocked = unlock <= m.quest;
        let ok = unlocked && world.money >= cost;
        let selected = m.build == Some(i);
        let bg = if selected {
            Color::srgb(0.95, 0.85, 0.30)
        } else if ok {
            Color::srgb(0.25, 0.25, 0.30)
        } else {
            Color::srgb(0.15, 0.15, 0.15)
        };
        rect(&mut commands, bg, size, Vec3::new(c.x, c.y, 5.0));
        let fg = if selected {
            Color::BLACK
        } else if ok {
            Color::WHITE
        } else {
            Color::srgb(0.5, 0.5, 0.5)
        };
        if unlocked {
            label(&mut commands, &format!("{}  {}円", tool.name(def), cost), 16.0, fg, Vec3::new(c.x, c.y + 9.0, 5.1));
            label(&mut commands, &tool.desc(def), 11.0, fg, Vec3::new(c.x, c.y - 12.0, 5.1));
        } else {
            label(&mut commands, "？？？(未解放)", 16.0, fg, Vec3::new(c.x, c.y, 5.1));
        }
    }

    // マーケットのタブ
    for (i, mk) in world.markets.iter().enumerate() {
        let (c, size) = tab_rect(i);
        let active = i == world.active;
        let bg = if active {
            Color::srgb(0.95, 0.85, 0.30)
        } else if mk.opened {
            Color::srgb(0.25, 0.25, 0.30)
        } else {
            Color::srgb(0.15, 0.15, 0.15)
        };
        rect(&mut commands, bg, size, Vec3::new(c.x, c.y, 5.0));
        let (text, fg) = if mk.opened {
            let fg = if active { Color::BLACK } else { Color::WHITE };
            (format!("{} {}  ({}/{})", i + 1, mk.def.name, mk.quest, mk.def.quests.len()), fg)
        } else {
            if world.can_open(i) {
                (format!("{} {}  開放できます", i + 1, mk.def.name), Color::WHITE)
            } else {
                (format!("{} {}  前をクリアで開放", i + 1, mk.def.name), Color::srgb(0.5, 0.5, 0.5))
            }
        };
        label(&mut commands, &text, 14.0, fg, Vec3::new(c.x, c.y, 5.1));
    }

    // HUD
    label(&mut commands, &format!("お金: {}円", world.money), 28.0, Color::WHITE, Vec3::new(-470.0, 290.0, 5.0));
    label(&mut commands, "右クリックで取消 / 1〜4でマーケット切替 / F5保存 F9読込", 13.0, Color::WHITE, Vec3::new(-440.0, 258.0, 5.0));

    // クエスト表示
    let (qx, qy) = (230.0, 285.0);
    rect(&mut commands, Color::srgba(0.0, 0.0, 0.0, 0.55), Vec2::new(560.0, 64.0), Vec3::new(qx, qy, 4.0));
    if m.quest_done() {
        label(&mut commands, &format!("{}: クエスト全クリア", def.name), 24.0, Color::WHITE, Vec3::new(qx, qy, 5.0));
    } else {
        let (k, n) = def.quests[m.quest];
        label(
            &mut commands,
            &format!("{} クエスト{} 達成条件", def.name, m.quest + 1),
            15.0,
            Color::srgb(1.0, 0.9, 0.4),
            Vec3::new(qx, qy + 16.0, 5.0),
        );
        label(
            &mut commands,
            &format!("{}を{}個 市場で売る  ({}/{})", def.items[k].name, n, m.sold, n),
            22.0,
            Color::WHITE,
            Vec3::new(qx, qy - 10.0, 5.0),
        );
    }
}
