// 一人称: 筏の上を歩く・マウスで見回す・波でカメラがブレる。動きの数値は defs.rs
use crate::defs::*;
use crate::sim::{Game, Mode};
use crate::world::Raft;
use bevy::input::mouse::AccumulatedMouseMotion;
use bevy::prelude::*;
use bevy::window::{CursorGrabMode, CursorOptions, PrimaryWindow};

#[derive(Resource)]
pub struct Player {
    pub x: f32, // 筏の上の位置(筏の中心から。右が +)
    pub z: f32, // 後ろが +(前は -z)
    pub yaw: f32,
    pub pitch: f32,
    pub shake: f32, // 視界のブレの強さ 0..1.2
    y_prev: f32,
    vy: f32,
    ay: f32,
}

impl Default for Player {
    fn default() -> Self {
        Player { x: 0.0, z: 0.5, yaw: 0.0, pitch: -0.05, shake: 0.0, y_prev: f32::NAN, vy: 0.0, ay: 0.0 }
    }
}

/// マウスで見回す(走行中だけ)
pub fn look(mouse: Res<AccumulatedMouseMotion>, g: Res<Game>, mut p: ResMut<Player>) {
    if g.mode != Mode::Run {
        return;
    }
    p.yaw -= mouse.delta.x * MOUSE_SENS;
    p.pitch = (p.pitch - mouse.delta.y * MOUSE_SENS).clamp(-1.4, 1.4);
}

/// WASD で筏の上を歩く。見ている向きが前
pub fn walk(keys: Res<ButtonInput<KeyCode>>, time: Res<Time>, g: Res<Game>, mut p: ResMut<Player>) {
    if g.mode != Mode::Run {
        return;
    }
    let ax = |pos: KeyCode, neg: KeyCode| keys.pressed(pos) as i8 as f32 - keys.pressed(neg) as i8 as f32;
    let (f, r) = (ax(KeyCode::KeyW, KeyCode::KeyS), ax(KeyCode::KeyD, KeyCode::KeyA));
    let (sn, cs) = p.yaw.sin_cos();
    let v = Vec2::new(-sn * f + cs * r, -cs * f - sn * r).normalize_or_zero() * WALK_SPEED * time.delta_secs().min(1.0 / 30.0);
    p.x = (p.x + v.x).clamp(-(RAFT_W * 0.5 - 0.3), RAFT_W * 0.5 - 0.3);
    p.z = (p.z + v.y).clamp(-(RAFT_L * 0.5 - 0.3), RAFT_L * 0.5 - 0.3);
}

/// 走行中はカーソルを固定して隠す
pub fn cursor(g: Res<Game>, mut windows: Query<&mut CursorOptions, With<PrimaryWindow>>) {
    let grab = g.mode == Mode::Run;
    for mut c in &mut windows {
        c.grab_mode = if grab { CursorGrabMode::Locked } else { CursorGrabMode::None };
        c.visible = !grab;
    }
}

/// 筏の上の目の位置にカメラを置く。筏の傾きがそのまま視界の傾きになり、上下の勢いでさらにブレる
pub fn camera_view(
    g: Res<Game>,
    time: Res<Time>,
    raft: Single<&Transform, (With<Raft>, Without<Camera3d>)>,
    mut p: ResMut<Player>,
    mut cam: Single<(&mut Transform, &mut Projection), With<Camera3d>>,
) {
    let dt = time.delta_secs().clamp(0.004, 1.0 / 20.0);
    let y = raft.translation.y;
    if p.y_prev.is_nan() {
        p.y_prev = y;
    }
    let vy = ((y - p.y_prev) / dt).clamp(-8.0, 8.0);
    let ay = ((vy - p.vy) / dt).clamp(-40.0, 40.0);
    p.y_prev = y;
    p.vy = vy;
    p.ay += (ay - p.ay) * (1.0 - (-10.0 * dt).exp());
    let target = (vy.abs() / 3.5) * 0.6 + (p.ay.abs() / 8.0) * 0.4 + 0.15 * rapidness(g.s) + g.hit * 0.8;
    p.shake += (target.min(1.2) - p.shake) * (1.0 - (-6.0 * dt).exp());

    let (t, k) = (g.clock, p.shake);
    let n = |f: f32, ph: f32| (t * f + ph).sin() + 0.5 * (t * f * 2.3 + ph * 1.7).sin();
    let noise = Quat::from_euler(EulerRot::YXZ, 0.025 * k * n(11.0, 0.3), 0.035 * k * n(13.0, 1.1), 0.05 * k * n(9.0, 2.0));
    let jitter = Vec3::new(0.03 * n(15.0, 0.5), 0.07 * n(17.0, 2.4), 0.03 * n(12.0, 4.0)) * k;

    let eye = Vec3::new(p.x, DECK_H + EYE_H, p.z) + jitter;
    cam.0.translation = raft.translation + raft.rotation * eye;
    cam.0.rotation = raft.rotation * Quat::from_euler(EulerRot::YXZ, p.yaw, p.pitch, 0.0) * noise;
    if let Projection::Perspective(pp) = &mut *cam.1 {
        pp.fov = (72.0 + (g.vs - FLOW_BASE) * 0.7).to_radians();
    }
}
