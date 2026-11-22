// ボス: 立つ → 潜る → 地中をプレイヤーへ追う → 予兆 → 足元から突き上げ → 空中 → 落下
use crate::defs::*;
use crate::figure::{Arm, spawn_figure};
use crate::hud::Hp;
use crate::player::Player;
use crate::terrain::Terrain;
use bevy::prelude::*;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Phase {
    Idle,
    Dive,
    Burrow,
    Telegraph,
    Rise,
    Hang,
    Fall,
}

#[derive(Resource)]
pub struct BossState {
    pub phase: Phase,
    pub t: f32,       // 現フェーズの経過秒
    pub pos: Vec2,    // 水平位置(x, z)
    pub y: f32,       // 足元の高さ(地中は負)
    pub yaw: f32,
    pub raise: f32,   // 腕の上げ具合 0..1
    hit_done: bool,   // この突き上げで既に当てたか
}

impl Default for BossState {
    fn default() -> Self {
        BossState { phase: Phase::Idle, t: 0.0, pos: Vec2::ZERO, y: 0.0, yaw: std::f32::consts::PI, raise: 0.0, hit_done: false }
    }
}

impl BossState {
    /// 足が地面近くにあるときだけ、プレイヤーは足元に入れない
    pub fn blocks(&self) -> bool {
        self.y > -3.0 && self.y < 2.0
    }
    fn go(&mut self, p: Phase) {
        self.phase = p;
        self.t = 0.0;
    }
}

#[derive(Resource)]
pub struct BossHp {
    pub cur: f32,
}

impl Default for BossHp {
    fn default() -> Self {
        BossHp { cur: BOSS_HP_MAX }
    }
}

#[derive(Resource)]
pub struct BossParts {
    root: Entity,
    mound: Entity,
    warn: Entity,
}

pub fn spawn_boss(commands: &mut Commands, meshes: &mut Assets<Mesh>, mats: &mut Assets<StandardMaterial>) {
    let body = mats.add(StandardMaterial { base_color: BOSS_COLOR, perceptual_roughness: 1.0, ..default() });
    let root = spawn_figure(
        commands,
        meshes,
        body,
        Transform::from_scale(Vec3::splat(BOSS_SCALE)).with_rotation(Quat::from_rotation_y(std::f32::consts::PI)),
        false,
    );
    let mound = commands
        .spawn((
            Mesh3d(meshes.add(Sphere::new(MOUND_RADIUS))),
            MeshMaterial3d(mats.add(StandardMaterial { base_color: MOUND_COLOR, perceptual_roughness: 1.0, ..default() })),
            Transform::from_scale(Vec3::new(1.0, 0.4, 1.0)),
            Visibility::Hidden,
        ))
        .id();
    let warn = commands
        .spawn((
            Mesh3d(meshes.add(Circle::new(STRIKE_RADIUS).mesh().resolution(64))),
            MeshMaterial3d(mats.add(StandardMaterial {
                base_color: WARN_COLOR,
                alpha_mode: AlphaMode::Blend,
                unlit: true,
                ..default()
            })),
            Transform::from_xyz(0.0, 0.02, 0.0).with_rotation(Quat::from_rotation_x(-std::f32::consts::FRAC_PI_2)),
            Visibility::Hidden,
        ))
        .id();
    commands.insert_resource(BossParts { root, mound, warn });
}

fn ease_out(k: f32) -> f32 {
    1.0 - (1.0 - k) * (1.0 - k)
}

pub fn boss_ai(
    time: Res<Time>,
    mut b: ResMut<BossState>,
    mut hp: ResMut<Hp>,
    boss_hp: Res<BossHp>,
    player: Single<(&Transform, &mut Player)>,
) {
    let dt = time.delta_secs();
    let (ptf, mut pl) = player.into_inner();
    let ppos = Vec2::new(ptf.translation.x, ptf.translation.z);
    b.t += dt;
    let k = |dur: f32, t: f32| (t / dur).min(1.0);

    // 構えに入るまではプレイヤーのほうを向く(モデルの正面は -Z)
    if matches!(b.phase, Phase::Idle | Phase::Dive | Phase::Burrow | Phase::Telegraph) {
        let d = ppos - b.pos;
        if d.length() > 0.1 {
            b.yaw = (-d.x).atan2(-d.y);
        }
    }

    match b.phase {
        Phase::Idle => {
            b.y = 0.0;
            b.raise = 0.0;
            if b.t >= BOSS_IDLE && boss_hp.cur > 0.0 {
                b.go(Phase::Dive);
            }
        }
        Phase::Dive => {
            b.y = -BOSS_HIDE_DEPTH * ease_out(k(BOSS_DIVE, b.t));
            if b.t >= BOSS_DIVE {
                b.go(Phase::Burrow);
            }
        }
        Phase::Burrow => {
            b.y = -BOSS_HIDE_DEPTH;
            let d = ppos - b.pos;
            let step = BOSS_CHASE_SPEED * dt;
            b.pos = if d.length() > step { b.pos + d.normalize() * step } else { ppos };
            if b.t >= BOSS_BURROW {
                b.go(Phase::Telegraph);
            }
        }
        Phase::Telegraph => {
            if b.t >= BOSS_TELEGRAPH {
                b.hit_done = false;
                b.go(Phase::Rise);
            }
        }
        Phase::Rise => {
            let r = ease_out(k(BOSS_RISE, b.t));
            b.y = -BOSS_HIDE_DEPTH + (BOSS_RISE_HEIGHT + BOSS_HIDE_DEPTH) * r;
            b.raise = r;
            if !b.hit_done && ppos.distance(b.pos) < STRIKE_RADIUS {
                b.hit_done = true;
                hp.cur -= 1;
                hp.flash = 1.0;
                pl.vy = HIT_LAUNCH;
                if hp.cur <= 0 {
                    hp.cur = MAX_HP; // 仮: 0 になったら全回復(ゲームオーバーは未実装)
                }
            }
            if b.t >= BOSS_RISE {
                b.go(Phase::Hang);
            }
        }
        Phase::Hang => {
            b.y = BOSS_RISE_HEIGHT;
            if b.t >= BOSS_HANG {
                b.go(Phase::Fall);
            }
        }
        Phase::Fall => {
            let f = k(BOSS_FALL, b.t);
            b.y = BOSS_RISE_HEIGHT * (1.0 - f * f);
            b.raise = 1.0 - f;
            if b.t >= BOSS_FALL {
                b.go(Phase::Idle);
            }
        }
    }
}

pub fn boss_view(
    b: Res<BossState>,
    parts: Res<BossParts>,
    terrain: Res<Terrain>,
    time: Res<Time>,
    mut tfs: Query<&mut Transform>,
    mut vis: Query<&mut Visibility>,
) {
    if let Ok(mut t) = tfs.get_mut(parts.root) {
        t.translation = Vec3::new(b.pos.x, b.y, b.pos.y);
        t.rotation = Quat::from_rotation_y(b.yaw);
    }
    if let Ok(mut t) = tfs.get_mut(parts.mound) {
        let w = 1.0 + 0.08 * (time.elapsed_secs() * 30.0).sin(); // 土が震える
        t.translation = Vec3::new(b.pos.x, terrain.height_at(b.pos), b.pos.y);
        t.scale = Vec3::new(w, 0.4 * w, w);
    }
    if let Ok(mut t) = tfs.get_mut(parts.warn) {
        t.translation = Vec3::new(b.pos.x, terrain.height_at(b.pos) + 0.05, b.pos.y);
    }
    let show = |on: bool| if on { Visibility::Visible } else { Visibility::Hidden };
    if let Ok(mut v) = vis.get_mut(parts.mound) {
        *v = show(matches!(b.phase, Phase::Burrow | Phase::Telegraph));
    }
    if let Ok(mut v) = vis.get_mut(parts.warn) {
        *v = show(b.phase == Phase::Telegraph);
    }
}

/// 突き上げの構え: 片腕を真上へ、もう片腕は少し引く
pub fn boss_arms(b: Res<BossState>, mut arms: Query<(&Arm, &mut Transform)>) {
    for (arm, mut tf) in &mut arms {
        let ang = if arm.side > 0.0 { b.raise * 3.05 } else { -0.5 * b.raise };
        tf.rotation = Quat::from_rotation_x(ang);
    }
}
