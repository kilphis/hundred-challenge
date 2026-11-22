// 画面更新: 筏の傾き・水面・岩と泡・HUD。カメラ(一人称)は fps.rs。
use crate::defs::*;
use crate::sim::{Game, Mode};
use crate::world::{Floater, Foam, Raft, Water, WATER_COLS, WATER_STEP};
use bevy::math::Affine2;
use bevy::mesh::VertexAttributeValues;
use bevy::prelude::*;

#[derive(Component)]
pub struct HpText;
#[derive(Component)]
pub struct TimeText;
#[derive(Component)]
pub struct DistText;
#[derive(Component)]
pub struct Bar;
#[derive(Component)]
pub struct Flash;
#[derive(Component)]
pub struct OverlayBg;
#[derive(Component)]
pub struct OverlayText;

fn corner(left: Option<f32>, right: Option<f32>, top: Option<f32>, bottom: Option<f32>) -> Node {
    let px = |v: Option<f32>| v.map(Val::Px).unwrap_or(Val::Auto);
    Node { position_type: PositionType::Absolute, left: px(left), right: px(right), top: px(top), bottom: px(bottom),
           padding: UiRect::axes(Val::Px(10.0), Val::Px(4.0)), ..default() }
}

pub fn spawn_hud(mut commands: Commands) {
    let shade = BackgroundColor(Color::srgba(0.0, 0.0, 0.0, 0.35));
    let font = |size| TextFont { font_size: size, ..default() };
    commands.spawn((Text::new(""), font(28.0), corner(Some(14.0), None, Some(12.0), None), shade, HpText));
    commands.spawn((Text::new(""), font(28.0), corner(None, Some(14.0), Some(12.0), None), shade, TimeText));
    commands.spawn((Text::new(""), font(22.0), corner(None, Some(14.0), None, Some(34.0)), shade, DistText));
    commands.spawn((Node { position_type: PositionType::Absolute, left: Val::Px(14.0), right: Val::Px(14.0), bottom: Val::Px(14.0), height: Val::Px(10.0), ..default() },
        BackgroundColor(Color::srgba(0.0, 0.0, 0.0, 0.4)))).with_children(|p| {
        p.spawn((Node { width: Val::Percent(0.0), height: Val::Percent(100.0), ..default() }, BackgroundColor(Color::srgb(1.0, 0.83, 0.35)), Bar));
    });
    commands.spawn((Node { position_type: PositionType::Absolute, width: Val::Percent(100.0), height: Val::Percent(100.0), ..default() },
        BackgroundColor(Color::srgba(0.85, 0.1, 0.05, 0.0)), Flash));
    commands.spawn((Node { position_type: PositionType::Absolute, width: Val::Percent(100.0), height: Val::Percent(100.0),
                           justify_content: JustifyContent::Center, align_items: AlignItems::Center, ..default() },
        BackgroundColor(Color::srgba(0.05, 0.15, 0.25, 0.5)), OverlayBg)).with_children(|p| {
        p.spawn((Text::new(""), font(40.0), TextLayout::new_with_justify(Justify::Center), OverlayText));
    });
}

/// 筏は水面の4点の高さに合わせて上下・傾く(前後ろ=ピッチ、左右=ロール)
pub fn raft_view(g: Res<Game>, mut raft: Single<&mut Transform, With<Raft>>) {
    let (p, heading) = frame(g.s, g.d);
    let (hl, hw) = (RAFT_L * 0.5, RAFT_W * 0.5);
    let h = |ds: f32, dd: f32| water_h(g.s + ds, g.d + dd, g.clock);
    let (hf, hb, hr, hlf) = (h(hl, 0.0), h(-hl, 0.0), h(0.0, hw), h(0.0, -hw));
    let pitch = ((hf - hb) / RAFT_L).atan();
    let roll = ((hr - hlf) / RAFT_W).atan();
    raft.translation = Vec3::new(p.x, (hf + hb + hr + hlf) * 0.25 + 0.05, p.z);
    raft.rotation = Quat::from_euler(EulerRot::YXZ, heading + g.yaw + g.kick * 0.15, pitch, roll);
}

/// 水面の高さを毎フレーム更新し、流れの筋を下流へ動かす
pub fn water_update(
    g: Res<Game>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut mats: ResMut<Assets<StandardMaterial>>,
    q: Query<(&Mesh3d, &MeshMaterial3d<StandardMaterial>), With<Water>>,
) {
    for (m, mm) in &q {
        if let Some(mesh) = meshes.get_mut(&m.0) {
            if let Some(VertexAttributeValues::Float32x3(pos)) = mesh.attribute_mut(Mesh::ATTRIBUTE_POSITION) {
                for (i, v) in pos.iter_mut().enumerate() {
                    let (row, col) = (i / (WATER_COLS + 1), i % (WATER_COLS + 1));
                    let s = row as f32 * WATER_STEP;
                    let d = (col as f32 / WATER_COLS as f32 * 2.0 - 1.0) * (half_w(s) + 1.2);
                    v[1] = water_h(s, d, g.clock);
                }
            }
            mesh.compute_smooth_normals();
        }
        if let Some(mat) = mats.get_mut(&mm.0) {
            mat.uv_transform = Affine2::from_translation(Vec2::new(0.0, -g.clock * FLOW_BASE / 32.0));
        }
    }
}

/// 岩と泡は水面といっしょに上下する(泡は少し脈打つ)
pub fn floaters(g: Res<Game>, mut q: Query<(&Floater, Option<&Foam>, &mut Transform)>) {
    for (f, foam, mut tf) in &mut q {
        tf.translation.y = water_h(f.s, f.d, g.clock) + f.dy;
        if let Some(foam) = foam {
            tf.scale = Vec3::splat(foam.r * (1.0 + (g.clock * 3.0 + foam.seed * 9.0).sin() * 0.06));
        }
    }
}

pub fn hud_update(
    g: Res<Game>,
    mut hp: Single<&mut Text, (With<HpText>, Without<TimeText>, Without<DistText>, Without<OverlayText>)>,
    mut time: Single<&mut Text, (With<TimeText>, Without<HpText>, Without<DistText>, Without<OverlayText>)>,
    mut dist: Single<&mut Text, (With<DistText>, Without<HpText>, Without<TimeText>, Without<OverlayText>)>,
    mut bar: Single<&mut Node, With<Bar>>,
    mut flash: Single<&mut BackgroundColor, (With<Flash>, Without<OverlayBg>)>,
    mut ov_bg: Single<&mut BackgroundColor, (With<OverlayBg>, Without<Flash>)>,
    mut ov: Single<&mut Text, (With<OverlayText>, Without<HpText>, Without<TimeText>, Without<DistText>)>,
) {
    hp.0 = format!("RAFT {}/{}", g.hp, MAX_HP);
    time.0 = format!("{:.1} s", g.time);
    dist.0 = format!("{} m", (LENGTH - g.s).max(0.0).round() as i32);
    bar.width = Val::Percent((g.s / LENGTH * 100.0).min(100.0));
    flash.0 = Color::srgba(0.85, 0.1, 0.05, g.hit.min(0.5) * 0.5);
    let (text, show) = match g.mode {
        Mode::Ready => ("RAFT RIVER\n\nMouse: look   WASD: walk on the raft\nLEFT/RIGHT (Q/E): steer the raft\nUP: paddle   DOWN: brake\nHit rocks and the raft breaks.\n\nSPACE to start".to_string(), true),
        Mode::Run => (String::new(), false),
        Mode::Dead => ("RAFT BROKEN\n\nR to retry".to_string(), true),
        Mode::Goal => (format!("GOAL!  {:.1} s\n{}\nRAFT {}/{}\n\nR to retry", g.time,
            if g.new_record { "NEW BEST".to_string() } else { format!("best {:.1} s", g.best) }, g.hp, MAX_HP), true),
    };
    ov.0 = text;
    ov_bg.0 = Color::srgba(0.05, 0.15, 0.25, if show { 0.5 } else { 0.0 });
}
