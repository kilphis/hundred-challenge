use bevy::input::keyboard::{Key, KeyboardInput};
use bevy::prelude::*;
use bevy::sprite::Anchor;

const MAX_HP: i32 = 100;
const BAR_W: f32 = 300.0;
const CPU_INTERVAL: f32 = 1.5;
const LUNGE_TIME: f32 = 0.2;
const LUNGE_DIST: f32 = 120.0;

// (入力する単語, ダメージ)
const COMMANDS: [(&str, i32); 3] = [("punch", 10), ("kick", 7), ("fireball", 25)];

#[derive(Component, Clone, Copy, PartialEq)]
enum Side {
    Player,
    Cpu,
}

#[derive(Component)]
struct Hp(i32);

#[derive(Component)]
struct HomeX(f32);

#[derive(Component, Default)]
struct Lunge(f32); // 残り秒数。0 なら攻撃モーションなし

#[derive(Component)]
struct HpBar(Side);

#[derive(Component)]
struct TypedText;

#[derive(Component)]
struct HelpText;

#[derive(Component)]
struct ResultText;

#[derive(Resource, Default)]
struct TypeBuffer(String);

#[derive(Resource)]
struct CpuTimer {
    timer: Timer,
    count: usize,
}

#[derive(Resource, Default)]
struct GameOver(bool);

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "day13".into(),
                resolution: (960, 540).into(),
                ..default()
            }),
            ..default()
        }))
        .insert_resource(TypeBuffer::default())
        .insert_resource(GameOver::default())
        .insert_resource(CpuTimer {
            timer: Timer::from_seconds(CPU_INTERVAL, TimerMode::Repeating),
            count: 0,
        })
        .add_systems(Startup, setup)
        .add_systems(
            Update,
            (
                type_input,
                cpu_attack,
                lunge_motion,
                update_hud,
                check_gameover,
                restart,
            )
                .chain(),
        )
        .run();
}

fn setup(mut commands: Commands) {
    commands.spawn(Camera2d);

    // 床
    commands.spawn((
        Sprite::from_color(Color::srgb(0.25, 0.25, 0.3), Vec2::new(960.0, 80.0)),
        Transform::from_xyz(0.0, -200.0, 0.0),
    ));

    // 選手
    for (side, x, color) in [
        (Side::Player, -250.0, Color::srgb(0.3, 0.5, 0.95)),
        (Side::Cpu, 250.0, Color::srgb(0.9, 0.35, 0.3)),
    ] {
        commands.spawn((
            side,
            Hp(MAX_HP),
            HomeX(x),
            Lunge::default(),
            Sprite::from_color(color, Vec2::new(70.0, 150.0)),
            Transform::from_xyz(x, -85.0, 1.0),
        ));
    }

    // HPバー(背景 + 本体)
    for (side, x, anchor) in [
        (Side::Player, -420.0, Anchor::CENTER_LEFT),
        (Side::Cpu, 420.0, Anchor::CENTER_RIGHT),
    ] {
        commands.spawn((
            Sprite::from_color(Color::srgb(0.2, 0.2, 0.2), Vec2::new(BAR_W, 24.0)),
            anchor,
            Transform::from_xyz(x, 230.0, 0.0),
        ));
        commands.spawn((
            HpBar(side),
            Sprite::from_color(Color::srgb(0.2, 0.85, 0.3), Vec2::new(BAR_W, 24.0)),
            anchor,
            Transform::from_xyz(x, 230.0, 0.1),
        ));
    }

    // 入力中の文字
    commands.spawn((
        TypedText,
        Text2d::new(""),
        TextFont {
            font_size: 40.0,
            ..default()
        },
        TextColor(Color::WHITE),
        Transform::from_xyz(0.0, -200.0, 2.0),
    ));

    // コマンド一覧
    let help = COMMANDS
        .iter()
        .map(|(w, d)| format!("{w} ({d})"))
        .collect::<Vec<_>>()
        .join("    ");
    commands.spawn((
        HelpText,
        Text2d::new(help),
        TextFont {
            font_size: 22.0,
            ..default()
        },
        TextColor(Color::srgb(0.8, 0.8, 0.8)),
        Transform::from_xyz(0.0, -250.0, 2.0),
    ));

    // 結果表示
    commands.spawn((
        ResultText,
        Text2d::new(""),
        TextFont {
            font_size: 64.0,
            ..default()
        },
        TextColor(Color::srgb(1.0, 0.9, 0.3)),
        Transform::from_xyz(0.0, 60.0, 3.0),
    ));
}

/// 文字入力を溜め、コマンド単語が完成したら攻撃を実行する
fn type_input(
    mut events: MessageReader<KeyboardInput>,
    mut buffer: ResMut<TypeBuffer>,
    over: Res<GameOver>,
    mut fighters: Query<(&Side, &mut Hp, &mut Lunge)>,
) {
    for ev in events.read() {
        if !ev.state.is_pressed() || over.0 {
            continue;
        }
        if ev.logical_key == Key::Backspace {
            buffer.0.clear();
            continue;
        }
        let Key::Character(s) = &ev.logical_key else {
            continue;
        };
        for c in s.chars().filter(|c| c.is_ascii_alphabetic()) {
            buffer.0.push(c.to_ascii_lowercase());
            // どのコマンドの先頭にもならなければ、今の1文字だけ残して再判定
            if !is_prefix(&buffer.0) {
                buffer.0.clear();
                buffer.0.push(c.to_ascii_lowercase());
                if !is_prefix(&buffer.0) {
                    buffer.0.clear();
                }
            }
            if let Some((_, dmg)) = COMMANDS.iter().find(|(w, _)| *w == buffer.0) {
                attack(Side::Player, *dmg, &mut fighters);
                buffer.0.clear();
            }
        }
    }
}

fn is_prefix(s: &str) -> bool {
    COMMANDS.iter().any(|(w, _)| w.starts_with(s))
}

fn attack(attacker: Side, dmg: i32, fighters: &mut Query<(&Side, &mut Hp, &mut Lunge)>) {
    for (side, mut hp, mut lunge) in fighters.iter_mut() {
        if *side == attacker {
            lunge.0 = LUNGE_TIME;
        } else {
            hp.0 = (hp.0 - dmg).max(0);
        }
    }
}

/// CPU は一定間隔で技を順番に出す
fn cpu_attack(
    time: Res<Time>,
    over: Res<GameOver>,
    mut cpu: ResMut<CpuTimer>,
    mut fighters: Query<(&Side, &mut Hp, &mut Lunge)>,
) {
    if over.0 {
        return;
    }
    if cpu.timer.tick(time.delta()).just_finished() {
        let (_, dmg) = COMMANDS[cpu.count % COMMANDS.len()];
        cpu.count += 1;
        attack(Side::Cpu, dmg, &mut fighters);
    }
}

/// 攻撃中は相手側へ踏み込む
fn lunge_motion(time: Res<Time>, mut q: Query<(&Side, &HomeX, &mut Lunge, &mut Transform)>) {
    for (side, home, mut lunge, mut tf) in q.iter_mut() {
        lunge.0 = (lunge.0 - time.delta_secs()).max(0.0);
        let t = lunge.0 / LUNGE_TIME;
        // 0→1→0 の山形
        let phase = 1.0 - (2.0 * t - 1.0).abs();
        let dir = if *side == Side::Player { 1.0 } else { -1.0 };
        tf.translation.x = home.0 + dir * LUNGE_DIST * phase;
    }
}

fn update_hud(
    buffer: Res<TypeBuffer>,
    fighters: Query<(&Side, &Hp)>,
    mut bars: Query<(&HpBar, &mut Sprite)>,
    mut typed: Query<&mut Text2d, With<TypedText>>,
) {
    for (bar, mut sprite) in bars.iter_mut() {
        if let Some((_, hp)) = fighters.iter().find(|(s, _)| **s == bar.0) {
            sprite.custom_size = Some(Vec2::new(BAR_W * hp.0 as f32 / MAX_HP as f32, 24.0));
        }
    }
    for mut t in typed.iter_mut() {
        t.0 = buffer.0.clone();
    }
}

fn check_gameover(
    fighters: Query<(&Side, &Hp)>,
    mut over: ResMut<GameOver>,
    mut result: Query<&mut Text2d, With<ResultText>>,
) {
    if over.0 {
        return;
    }
    let player_dead = fighters.iter().any(|(s, h)| *s == Side::Player && h.0 == 0);
    let cpu_dead = fighters.iter().any(|(s, h)| *s == Side::Cpu && h.0 == 0);
    if player_dead || cpu_dead {
        over.0 = true;
        let msg = match (player_dead, cpu_dead) {
            (true, true) => "DRAW",
            (false, true) => "YOU WIN",
            _ => "YOU LOSE",
        };
        for mut t in result.iter_mut() {
            t.0 = format!("{msg}\nPress Enter");
        }
    }
}

fn restart(
    keys: Res<ButtonInput<KeyCode>>,
    mut over: ResMut<GameOver>,
    mut buffer: ResMut<TypeBuffer>,
    mut cpu: ResMut<CpuTimer>,
    mut hps: Query<&mut Hp>,
    mut result: Query<&mut Text2d, With<ResultText>>,
) {
    if over.0 && keys.just_pressed(KeyCode::Enter) {
        over.0 = false;
        buffer.0.clear();
        cpu.timer.reset();
        cpu.count = 0;
        for mut hp in hps.iter_mut() {
            hp.0 = MAX_HP;
        }
        for mut t in result.iter_mut() {
            t.0.clear();
        }
    }
}
