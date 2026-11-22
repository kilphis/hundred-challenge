// プレイヤー: 視点・移動・手足の振り・カメラ。
use crate::attack::Charge;
use crate::boss::BossState;
use crate::defs::*;
use crate::figure::Limb;
use crate::terrain::Terrain;
use bevy::input::mouse::AccumulatedMouseMotion;
use bevy::prelude::*;
use bevy::window::{CursorGrabMode, CursorOptions, PrimaryWindow};

#[derive(Component, Default)]
pub struct Player {
    pub vy: f32, // 上下方向の速度(打ち上げ・落下)
}

#[derive(Resource, Default)]
pub struct Look {
    pub yaw: f32,
    pub pitch: f32,
    pub third: bool, // V で三人称(棒人間を見る用)
}

#[derive(Resource, Default)]
pub struct Run {
    pub speed: f32,
    pub phase: f32,
}

/// クリックでマウスを掴む、Esc で離す
pub fn cursor_grab(
    mouse: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    mut cursor: Single<&mut CursorOptions, With<PrimaryWindow>>,
) {
    if mouse.just_pressed(MouseButton::Left) {
        cursor.grab_mode = CursorGrabMode::Locked;
        cursor.visible = false;
    }
    if keys.just_pressed(KeyCode::Escape) {
        cursor.grab_mode = CursorGrabMode::None;
        cursor.visible = true;
    }
}

pub fn look_and_move(
    keys: Res<ButtonInput<KeyCode>>,
    mouse: Res<AccumulatedMouseMotion>,
    time: Res<Time>,
    cursor: Option<Single<&CursorOptions, With<PrimaryWindow>>>,
    boss: Res<BossState>,
    terrain: Res<Terrain>,
    charge: Res<Charge>,
    mut look: ResMut<Look>,
    mut run: ResMut<Run>,
    mut player: Single<(&mut Transform, &mut Visibility, &mut Player)>,
) {
    if cursor.is_some_and(|c| c.grab_mode != CursorGrabMode::None) {
        look.yaw -= mouse.delta.x * MOUSE_SENS;
        look.pitch = (look.pitch - mouse.delta.y * MOUSE_SENS).clamp(-1.4, 1.4);
    }
    if keys.just_pressed(KeyCode::KeyV) {
        look.third = !look.third;
    }

    let axis = |pos: KeyCode, neg: KeyCode| keys.pressed(pos) as i8 as f32 - keys.pressed(neg) as i8 as f32;
    let (fwd, side) = (axis(KeyCode::KeyW, KeyCode::KeyS), axis(KeyCode::KeyD, KeyCode::KeyA));
    let yaw = Quat::from_rotation_y(look.yaw);
    let wish = yaw * (Vec3::NEG_Z * fwd + Vec3::X * side);
    let wish = Vec2::new(wish.x, wish.z).normalize_or_zero();

    let (tf, vis, pl) = &mut *player;
    let dt = time.delta_secs();
    let cur = Vec2::new(tf.translation.x, tf.translation.z);
    let speed = PLAYER_SPEED * if charge.active { CHARGE_MOVE } else { 1.0 };
    let mut step = wish * speed * dt;
    // 上り坂は遅い(削れた穴から出にくい)
    if step.length() > 1e-5 {
        let uphill = ((terrain.height_at(cur + step) - terrain.height_at(cur)) / step.length()).max(0.0);
        step *= (1.0 - UPHILL_PENALTY * uphill).clamp(MIN_SLOPE_SPEED, 1.0);
    }
    let mut flat = cur + step;
    // ボスの足元には入れない(ボスが地中にいる間は素通り)、アリーナの外にも出られない
    if boss.blocks() {
        let off = flat - boss.pos;
        let min = BOSS_FOOT_RADIUS + PLAYER_RADIUS;
        if off.length() < min {
            flat = boss.pos + off.normalize_or(Vec2::Y) * min;
        }
    }
    if flat.length() > ARENA_RADIUS - PLAYER_RADIUS {
        flat = flat.normalize() * (ARENA_RADIUS - PLAYER_RADIUS);
    }
    // 重力。地面(削れていれば穴の底)に着いたら止まる
    pl.vy -= GRAVITY * dt;
    let mut y = tf.translation.y + pl.vy * dt;
    let ground = terrain.height_at(flat);
    if y <= ground {
        y = ground;
        pl.vy = 0.0;
    }
    run.speed = flat.distance(cur) / dt.max(1e-4);
    tf.translation = Vec3::new(flat.x, y, flat.y);
    tf.rotation = yaw;
    // 一人称では自分の体を隠す
    **vis = if look.third { Visibility::Visible } else { Visibility::Hidden };
}

pub fn animate_limbs(time: Res<Time>, mut run: ResMut<Run>, mut limbs: Query<(&Limb, &mut Transform)>) {
    let moving = run.speed > 0.5;
    run.phase += time.delta_secs() * RUN_FREQ * (run.speed / PLAYER_SPEED).min(1.0);
    let amp = if moving { RUN_SWING } else { 0.0 };
    for (limb, mut tf) in &mut limbs {
        tf.rotation = Quat::from_rotation_x(run.phase.sin() * amp * limb.side);
    }
}

pub fn camera_follow(
    look: Res<Look>,
    player: Single<&Transform, (With<Player>, Without<Camera3d>)>,
    mut cam: Single<&mut Transform, With<Camera3d>>,
) {
    let rot = Quat::from_rotation_y(look.yaw) * Quat::from_rotation_x(look.pitch);
    if look.third {
        let target = player.translation + Vec3::Y * 1.3;
        cam.translation = target + rot * Vec3::Z * THIRD_DIST;
        cam.look_at(target, Vec3::Y);
    } else {
        cam.translation = player.translation + Vec3::Y * EYE_HEIGHT;
        cam.rotation = rot;
    }
}
