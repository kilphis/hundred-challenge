mod attack;
mod boss;
mod defs;
mod figure;
mod hud;
mod player;
mod terrain;

use attack::{Charge, charge_update, drill_flight, setup_attack, spin_drills};
use bevy::app::ScheduleRunnerPlugin;
use bevy::camera::RenderTarget;
use bevy::prelude::*;
use bevy::render::render_resource::{TextureFormat, TextureUsages};
use bevy::render::view::screenshot::{Screenshot, save_to_disk};
use bevy::ui::IsDefaultUiCamera;
use bevy::window::ExitCondition;
use bevy::winit::WinitPlugin;
use boss::{BossHp, BossState, boss_ai, boss_arms, boss_view, spawn_boss};
use defs::*;
use figure::{add_wizard_hat, spawn_figure};
use hud::{Hp, spawn_hud, update_hud};
use player::{Look, Player, Run, animate_limbs, camera_follow, cursor_grab, look_and_move};
use terrain::{spawn_terrain, update_terrain};

/// `--shot` のときカメラの描画先になる画像(ウィンドウは開かない)
#[derive(Resource)]
struct ShotImage(Handle<Image>);

/// `--shot 出力.png fp|side 撮る秒 [溜め開始秒 離す秒]` でウィンドウを開かずに1枚撮って終了する(確認用)
#[derive(Resource)]
struct Shot {
    path: String,
    side: bool,
    at: f32,                    // ゲーム内の何秒で撮るか
    charge: Option<(f32, f32)>, // 疑似的に左ボタンを押す区間(秒)
    frame: u32,
    taken: Option<u32>, // 撮ったフレーム
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut app = App::new();
    if args.iter().any(|a| a == "--shot") {
        // 画面に出さず、画像へ描画する(作業中のウィンドウを邪魔しない)
        app.add_plugins(
            DefaultPlugins
                .set(WindowPlugin {
                    primary_window: None,
                    exit_condition: ExitCondition::DontExit,
                    close_when_requested: false,
                    ..default()
                })
                .disable::<WinitPlugin>(),
        )
        .add_plugins(ScheduleRunnerPlugin::run_loop(std::time::Duration::from_secs_f64(1.0 / 60.0)));
    } else {
        app.add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window { title: "sand boss".into(), ..default() }),
            ..default()
        }));
    }
    app.insert_resource(ClearColor(SKY))
        .insert_resource(Look::default())
        .insert_resource(Run::default())
        .insert_resource(BossState::default())
        .insert_resource(BossHp::default())
        .insert_resource(Hp::default())
        .add_systems(Startup, (setup, spawn_hud, setup_attack))
        .add_systems(
            Update,
            (
                charge_update, // マウスを掴む前の状態を見るため cursor_grab より先
                cursor_grab,
                boss_ai,
                look_and_move,
                animate_limbs,
                camera_follow,
                spin_drills,
                drill_flight,
                boss_view,
                boss_arms,
                update_terrain,
                update_hud,
            )
                .chain(),
        );
    if let Some(i) = args.iter().position(|a| a == "--shot") {
        let num = |k: usize| args.get(i + k).and_then(|s| s.parse::<f32>().ok());
        app.insert_resource(Shot {
            path: args[i + 1].clone(),
            side: args.get(i + 2).is_some_and(|s| s == "side"),
            at: num(3).unwrap_or(1.0),
            charge: num(4).zip(num(5)),
            frame: 0,
            taken: None,
        })
        .add_systems(Update, shot_driver.after(camera_follow));
    }
    app.run();
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut mats: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
    shot: Option<Res<Shot>>,
) {
    let mat = |c: Color| StandardMaterial { base_color: c, perceptual_roughness: 1.0, ..default() };
    // 地面: 砂の円盤(高さマップ) + 外側の岩
    spawn_terrain(&mut commands, &mut meshes, &mut mats);
    commands.spawn((
        Mesh3d(meshes.add(Plane3d::default().mesh().size(3000.0, 3000.0))),
        MeshMaterial3d(mats.add(mat(ROCK))),
        Transform::from_xyz(0.0, ROCK_Y, 0.0),
    ));

    // 光
    commands.spawn((
        DirectionalLight { illuminance: 12000.0, shadows_enabled: true, ..default() },
        Transform::from_xyz(40.0, 80.0, 30.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));
    commands.insert_resource(AmbientLight { color: Color::WHITE, brightness: 400.0, ..default() });

    // プレイヤー(魔法使い)とボス
    let pmat = mats.add(mat(PLAYER_COLOR));
    let player = spawn_figure(&mut commands, &mut meshes, pmat, Transform::from_translation(PLAYER_START), true);
    commands.entity(player).insert(Player::default());
    add_wizard_hat(&mut commands, &mut meshes, &mut mats, player);
    spawn_boss(&mut commands, &mut meshes, &mut mats);

    let mut cam = commands.spawn((
        Camera3d::default(),
        Projection::Perspective(PerspectiveProjection { fov: 80f32.to_radians(), far: 4000.0, ..default() }),
        Transform::from_translation(PLAYER_START + Vec3::Y * EYE_HEIGHT),
    ));
    if shot.is_some() {
        let mut img = Image::new_target_texture(1920, 1080, TextureFormat::Rgba8UnormSrgb);
        img.texture_descriptor.usage |= TextureUsages::COPY_SRC;
        let handle = images.add(img);
        cam.insert((Camera { target: RenderTarget::from(handle.clone()), ..default() }, IsDefaultUiCamera));
        commands.insert_resource(ShotImage(handle));
    }
}

/// 確認用: ゲーム内 at 秒で1枚撮って終了。side は横から見る固定カメラ(プレイヤーは立ったまま)
fn shot_driver(
    mut commands: Commands,
    time: Res<Time>,
    mut shot: ResMut<Shot>,
    mut run: ResMut<Run>,
    mut look: ResMut<Look>,
    mut charge: ResMut<Charge>,
    mut cam: Single<&mut Transform, With<Camera3d>>,
    mut player: Single<&mut Visibility, With<Player>>,
    image: Res<ShotImage>,
) {
    shot.frame += 1;
    let t = time.elapsed_secs();
    charge.demo_hold = shot.charge.is_some_and(|(from, to)| t >= from && t < to);
    if shot.side {
        look.third = true;
        look.pitch = 0.15; // 少し上向きに撃つ
        **player = Visibility::Visible;
        run.speed = 0.0;
        cam.translation = Vec3::new(16.0, 6.0, 44.0);
        cam.look_at(Vec3::new(0.0, 4.0, 28.0), Vec3::Y);
    }
    if shot.taken.is_none() && t >= shot.at {
        commands.spawn(Screenshot::image(image.0.clone())).observe(save_to_disk(shot.path.clone()));
        shot.taken = Some(shot.frame);
    }
    if shot.taken.is_some_and(|f| shot.frame > f + 20) {
        std::process::exit(0);
    }
}
