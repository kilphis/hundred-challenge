// 魔法: 左ボタン長押しで足元の土を集めて溜め(足場が削れる)、離すとドリルにして撃つ
use crate::boss::{BossHp, BossState};
use crate::defs::*;
use crate::player::{Look, Player};
use crate::terrain::Terrain;
use bevy::prelude::*;
use bevy::window::{CursorGrabMode, CursorOptions, PrimaryWindow};
use std::f32::consts::{FRAC_PI_2, TAU};

#[derive(Resource, Default)]
pub struct Charge {
    pub amount: f32, // 0..1
    pub active: bool,
    pub demo_hold: bool, // 確認用(--shot)の疑似ボタン押下
    preview: Option<Entity>,
}

#[derive(Resource)]
pub struct DrillAssets {
    cone: Handle<Mesh>,
    chunk: Handle<Mesh>,
    body: Handle<StandardMaterial>,
    chunk_mat: Handle<StandardMaterial>,
}

#[derive(Component)]
pub struct DrillPreview;
#[derive(Component)]
pub struct Spin;
#[derive(Component)]
pub struct Drill {
    start: Vec3,
    vel: Vec3,
    power: f32,
    age: f32,
}

pub fn setup_attack(mut commands: Commands, mut meshes: ResMut<Assets<Mesh>>, mut mats: ResMut<Assets<StandardMaterial>>) {
    let mat = |c: Color| StandardMaterial { base_color: c, perceptual_roughness: 1.0, ..default() };
    commands.insert_resource(DrillAssets {
        cone: meshes.add(Cone { radius: 1.0, height: 1.0 }),
        chunk: meshes.add(Cuboid::new(0.3, 0.3, 0.3)),
        body: mats.add(mat(DRILL_COLOR)),
        chunk_mat: mats.add(mat(CHUNK_COLOR)),
    });
    commands.insert_resource(Charge::default());
}

fn lerp2(r: (f32, f32), t: f32) -> f32 {
    r.0 + (r.1 - r.0) * t
}

/// ドリル1本。単位サイズ(半径1・長さ1、先端が -Z)で作り、root の scale で太さと長さを決める。
/// 土の塊を螺旋状に並べた spinner を Z 軸まわりに回して、ドリルらしく見せる。
fn spawn_drill(commands: &mut Commands, a: &DrillAssets, tf: Transform) -> Entity {
    let root = commands.spawn((tf, Visibility::default())).id();
    commands.entity(root).with_children(|p| {
        p.spawn((Transform::default(), Visibility::default(), Spin)).with_children(|q| {
            q.spawn((
                Mesh3d(a.cone.clone()),
                MeshMaterial3d(a.body.clone()),
                Transform::from_rotation(Quat::from_rotation_x(-FRAC_PI_2)),
            ));
            const N: usize = 20;
            for k in 0..N {
                let t = k as f32 / N as f32; // 0 = 根元、1 = 先端
                let ang = t * 3.0 * TAU;
                let r = (1.0 - t) * 1.0;
                q.spawn((
                    Mesh3d(a.chunk.clone()),
                    MeshMaterial3d(a.chunk_mat.clone()),
                    Transform::from_xyz(r * ang.cos(), r * ang.sin(), 0.5 - t)
                        .with_scale(Vec3::splat(1.0 - 0.6 * t))
                        .with_rotation(Quat::from_rotation_z(ang)),
                ));
            }
        });
    });
    root
}

pub fn spin_drills(time: Res<Time>, mut spinners: Query<&mut Transform, With<Spin>>) {
    for mut tf in &mut spinners {
        tf.rotate_z(time.delta_secs() * 14.0);
    }
}

pub fn charge_update(
    mut commands: Commands,
    time: Res<Time>,
    mouse: Res<ButtonInput<MouseButton>>,
    cursor: Option<Single<&CursorOptions, With<PrimaryWindow>>>,
    look: Res<Look>,
    boss_hp: Res<BossHp>,
    assets: Res<DrillAssets>,
    mut charge: ResMut<Charge>,
    mut terrain: ResMut<Terrain>,
    player: Single<&Transform, (With<Player>, Without<DrillPreview>)>,
    mut previews: Query<&mut Transform, With<DrillPreview>>,
) {
    let dt = time.delta_secs();
    // マウスを掴む最初のクリックでは溜めない(cursor_grab より前に動くので、掴む前の状態が見える)
    let grabbed = cursor.is_some_and(|c| c.grab_mode != CursorGrabMode::None);
    let hold = (grabbed && mouse.pressed(MouseButton::Left)) || charge.demo_hold;
    let defeated = boss_hp.cur <= 0.0;

    if !charge.active && hold && !defeated && (mouse.just_pressed(MouseButton::Left) || charge.demo_hold) {
        charge.active = true;
        charge.amount = 0.0;
    }
    if !charge.active {
        terrain.refill(dt);
        return;
    }

    let rot = Quat::from_rotation_y(look.yaw) * Quat::from_rotation_x(look.pitch);
    let eye = player.translation + Vec3::Y * EYE_HEIGHT;
    let aim = rot * Vec3::NEG_Z;
    let (len, rad) = (lerp2(DRILL_LEN, charge.amount), lerp2(DRILL_RADIUS, charge.amount));
    let muzzle = eye + aim * (0.6 + len * 0.5) + rot * Vec3::X * (0.55 + rad) - rot * Vec3::Y * 0.1;
    let tf = Transform::from_translation(muzzle).looking_to(aim, Vec3::Y).with_scale(Vec3::new(rad, rad, len));

    if hold {
        charge.amount = (charge.amount + dt / CHARGE_TIME).min(1.0);
        let c = charge.amount;
        terrain.carve(
            Vec2::new(player.translation.x, player.translation.z),
            lerp2((DIG_RADIUS_MIN, DIG_RADIUS_MAX), c),
            DIG_DEPTH_MAX * c,
        );
        match charge.preview {
            Some(e) => {
                if let Ok(mut t) = previews.get_mut(e) {
                    *t = tf;
                }
            }
            None => {
                let e = spawn_drill(&mut commands, &assets, tf);
                commands.entity(e).insert(DrillPreview);
                charge.preview = Some(e);
            }
        }
    } else {
        // 離した: 溜めた分のドリルを撃つ
        if let Some(e) = charge.preview.take() {
            commands.entity(e).despawn();
        }
        let e = spawn_drill(&mut commands, &assets, tf);
        commands.entity(e).insert(Drill { start: muzzle, vel: aim * DRILL_SPEED, power: charge.amount, age: 0.0 });
        charge.active = false;
        charge.amount = 0.0;
    }
}

/// ドリルの飛行。0.5m刻みで進めて、地面・アリーナの外・ボスの胴との当たりを見る
pub fn drill_flight(
    mut commands: Commands,
    time: Res<Time>,
    terrain: Res<Terrain>,
    boss: Res<BossState>,
    mut boss_hp: ResMut<BossHp>,
    mut drills: Query<(Entity, &mut Transform, &mut Drill)>,
) {
    let dt = time.delta_secs();
    for (e, mut tf, mut d) in &mut drills {
        d.age += dt;
        let step = d.vel * dt;
        let n = (step.length() / 0.5).ceil().max(1.0) as usize;
        let mut gone = d.age > 6.0;
        for _ in 0..n {
            if gone {
                break;
            }
            tf.translation += step / n as f32;
            let p = tf.translation;
            let flat = Vec2::new(p.x, p.z);
            let body_top = boss.y + PLAYER_HEIGHT * BOSS_SCALE;
            // 自分が掘った穴の壁は掘り抜ける(穴の範囲を出てから地面に当たる)
            let in_pit = p.distance(d.start) < DIG_RADIUS_MAX;
            if (!in_pit && p.y < terrain.height_at(flat)) || flat.length() > ARENA_RADIUS {
                gone = true;
            } else if boss_hp.cur > 0.0
                && flat.distance(boss.pos) < BOSS_BODY_RADIUS
                && p.y > boss.y
                && p.y < body_top
            {
                let dmg = lerp2(DRILL_DAMAGE, d.power);
                boss_hp.cur -= dmg;
                info!("drill hit: power {:.2} damage {:.1} boss hp {:.1}", d.power, dmg, boss_hp.cur);
                gone = true;
            }
        }
        if gone {
            commands.entity(e).despawn();
        }
    }
}
