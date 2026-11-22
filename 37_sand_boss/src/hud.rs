// HP 表示と被弾の赤フラッシュ
use crate::attack::Charge;
use crate::boss::BossHp;
use crate::defs::*;
use bevy::prelude::*;

#[derive(Resource)]
pub struct Hp {
    pub cur: i32,
    pub flash: f32, // 1.0 で被弾直後、0 に向けて薄れる
}

impl Default for Hp {
    fn default() -> Self {
        Hp { cur: MAX_HP, flash: 0.0 }
    }
}

#[derive(Component)]
pub struct HpText;
#[derive(Component)]
pub struct Flash;
#[derive(Component)]
pub struct ChargeFill;

pub fn spawn_hud(mut commands: Commands) {
    commands.spawn((
        Text::new(""),
        TextFont { font_size: 30.0, ..default() },
        TextColor(Color::srgb(0.1, 0.1, 0.1)),
        Node { position_type: PositionType::Absolute, left: Val::Px(16.0), top: Val::Px(12.0), ..default() },
        HpText,
    ));
    commands.spawn((
        Node {
            position_type: PositionType::Absolute,
            width: Val::Percent(100.0),
            height: Val::Percent(100.0),
            ..default()
        },
        BackgroundColor(Color::srgba(0.8, 0.0, 0.0, 0.0)),
        Flash,
    ));
    // 溜めゲージ(画面下中央)
    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: Val::Percent(50.0),
                margin: UiRect::left(Val::Px(-150.0)),
                bottom: Val::Px(40.0),
                width: Val::Px(300.0),
                height: Val::Px(14.0),
                ..default()
            },
            BackgroundColor(Color::srgba(0.0, 0.0, 0.0, 0.35)),
        ))
        .with_children(|p| {
            p.spawn((
                Node { width: Val::Percent(0.0), height: Val::Percent(100.0), ..default() },
                BackgroundColor(Color::srgb(0.85, 0.45, 0.10)),
                ChargeFill,
            ));
        });
}

pub fn update_hud(
    time: Res<Time>,
    mut hp: ResMut<Hp>,
    boss_hp: Res<BossHp>,
    charge: Res<Charge>,
    mut text: Single<&mut Text, With<HpText>>,
    mut flash: Single<&mut BackgroundColor, With<Flash>>,
    mut fill: Single<&mut Node, With<ChargeFill>>,
) {
    hp.flash = (hp.flash - time.delta_secs() * 2.5).max(0.0);
    let down = if boss_hp.cur <= 0.0 { "  DOWN" } else { "" };
    text.0 = format!("HP {}\nBOSS {:.0}{}", hp.cur, boss_hp.cur.max(0.0), down);
    fill.width = Val::Percent(if charge.active { charge.amount * 100.0 } else { 0.0 });
    flash.0 = Color::srgba(0.8, 0.0, 0.0, hp.flash * 0.5);
}
