mod defs;
mod fps;
mod sim;
mod view;
mod world;

use bevy::app::ScheduleRunnerPlugin;
use bevy::camera::RenderTarget;
use bevy::pbr::{DistanceFog, FogFalloff};
use bevy::prelude::*;
use bevy::render::render_resource::{TextureFormat, TextureUsages};
use bevy::render::view::screenshot::{Screenshot, save_to_disk};
use bevy::ui::IsDefaultUiCamera;
use bevy::window::ExitCondition;
use bevy::winit::WinitPlugin;
use defs::*;
use sim::{Game, Input, Mode, step};

const SKY: Color = Color::srgb(0.75, 0.88, 0.94);
const BEST_FILE: &str = "best.txt";

#[derive(Resource)]
struct Rocks(Vec<Rock>);

/// `--shot` のときカメラの描画先になる画像(ウィンドウは開かない)
#[derive(Resource)]
struct ShotImage(Handle<Image>);

/// `--shot 出力.png s d 撮る秒` でウィンドウを開かずに1枚撮って終了する(確認用)。s d は川座標の開始位置
#[derive(Resource)]
struct Shot {
    path: String,
    at: f32,
    frame: u32,
    taken: Option<u32>,
}

fn load_best() -> f32 {
    std::fs::read_to_string(BEST_FILE).ok().and_then(|s| s.trim().parse().ok()).unwrap_or(0.0)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let shot_at = args.iter().position(|a| a == "--shot");
    let mut app = App::new();
    if shot_at.is_some() {
        // 画面に出さず、画像へ描画する(作業中のウィンドウを邪魔しない)
        app.add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: None, exit_condition: ExitCondition::DontExit, close_when_requested: false, ..default()
        }).disable::<WinitPlugin>())
        .add_plugins(ScheduleRunnerPlugin::run_loop(std::time::Duration::from_secs_f64(1.0 / 60.0)));
    } else {
        app.add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window { title: "raft river".into(), resolution: (1280, 800).into(), ..default() }), ..default()
        }));
    }
    let mut game = Game::new(0.0, 0.0, load_best());
    if let Some(i) = shot_at {
        let num = |k: usize| args.get(i + k).and_then(|s| s.parse::<f32>().ok());
        game = Game::new(num(2).unwrap_or(0.0), num(3).unwrap_or(0.0), 0.0);
        game.mode = Mode::Run;
        app.insert_resource(Shot { path: args[i + 1].clone(), at: num(4).unwrap_or(1.0), frame: 0, taken: None })
            .add_systems(Update, shot_driver.after(fps::camera_view));
    }
    app.insert_resource(ClearColor(SKY))
        .insert_resource(game)
        .insert_resource(Rocks(make_rocks()))
        .init_resource::<fps::Player>()
        .add_systems(Startup, (setup, view::spawn_hud))
        .add_systems(Update, (play, fps::look, fps::walk, fps::cursor,
            (view::raft_view, fps::camera_view, view::water_update, view::floaters, view::hud_update)).chain())
        .run();
}

fn setup(mut commands: Commands, mut meshes: ResMut<Assets<Mesh>>, mut mats: ResMut<Assets<StandardMaterial>>,
         mut images: ResMut<Assets<Image>>, rocks: Res<Rocks>, shot: Option<Res<Shot>>) {
    world::spawn_world(&mut commands, &mut meshes, &mut mats, &mut images, &rocks.0);
    commands.spawn((DirectionalLight { illuminance: 11000.0, shadows_enabled: false, ..default() },
        Transform::from_xyz(-40.0, 60.0, 30.0).looking_at(Vec3::ZERO, Vec3::Y)));
    commands.insert_resource(AmbientLight { color: Color::WHITE, brightness: 450.0, ..default() });

    let mut cam = commands.spawn((
        Camera3d::default(),
        Projection::Perspective(PerspectiveProjection { fov: 60f32.to_radians(), far: 500.0, ..default() }),
        DistanceFog { color: SKY, falloff: FogFalloff::Linear { start: 90.0, end: 260.0 }, ..default() },
        Transform::default(),
    ));
    if shot.is_some() {
        let mut img = Image::new_target_texture(1200, 750, TextureFormat::Rgba8UnormSrgb);
        img.texture_descriptor.usage |= TextureUsages::COPY_SRC;
        let handle = images.add(img);
        cam.insert((Camera { target: RenderTarget::from(handle.clone()), ..default() }, IsDefaultUiCamera));
        commands.insert_resource(ShotImage(handle));
    }
}

/// 入力を読み、筏を1歩進める
fn play(keys: Res<ButtonInput<KeyCode>>, time: Res<Time>, rocks: Res<Rocks>, mut g: ResMut<Game>, mut pl: ResMut<fps::Player>) {
    let axis = |pos: &[KeyCode], neg: &[KeyCode]| keys.any_pressed(pos.iter().copied()) as i8 as f32 - keys.any_pressed(neg.iter().copied()) as i8 as f32;
    let inp = Input {
        fwd: keys.pressed(KeyCode::ArrowUp),
        back: keys.pressed(KeyCode::ArrowDown),
        steer: axis(&[KeyCode::ArrowRight, KeyCode::KeyE], &[KeyCode::ArrowLeft, KeyCode::KeyQ]),
    };
    match g.mode {
        Mode::Ready if keys.just_pressed(KeyCode::Space) => g.mode = Mode::Run,
        Mode::Dead | Mode::Goal if keys.just_pressed(KeyCode::KeyR) => {
            let best = load_best();
            *g = Game::new(0.0, 0.0, best);
            g.mode = Mode::Run;
            *pl = fps::Player::default();
        }
        _ => {}
    }
    let before = g.mode;
    step(&mut g, &rocks.0, inp, time.delta_secs().min(1.0 / 30.0));
    if before == Mode::Run && g.mode == Mode::Goal && g.new_record {
        let _ = std::fs::write(BEST_FILE, format!("{:.2}", g.time));
    }
    // 見た目用の向き: 横に流れている向きへ筏の頭を振る(なめらかに追従)
    let target = -g.vd.atan2(g.vs.max(1.0)) * 0.9;
    g.yaw += (target - g.yaw) * 0.12;
    g.kick -= g.kick * (3.0 * time.delta_secs()).min(1.0);
}

/// 確認用: ゲーム内 at 秒で1枚撮って終了
fn shot_driver(mut commands: Commands, time: Res<Time>, mut shot: ResMut<Shot>, image: Res<ShotImage>) {
    shot.frame += 1;
    if shot.taken.is_none() && time.elapsed_secs() >= shot.at {
        commands.spawn(Screenshot::image(image.0.clone())).observe(save_to_disk(shot.path.clone()));
        shot.taken = Some(shot.frame);
    }
    if shot.taken.is_some_and(|f| shot.frame > f + 20) {
        std::process::exit(0);
    }
}
