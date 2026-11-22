// 数値・色の定義。調整のときはここだけ読めばよい。
use bevy::prelude::*;

pub const ARENA_RADIUS: f32 = 60.0;
pub const RING_EVERY: usize = 10; // 距離の目安になる同心円の間隔(地面メッシュの何リングごとか。1リング=1m)
pub const TERRAIN_RINGS: usize = 60; // 地面メッシュの半径方向の分割(1m刻み)
pub const TERRAIN_SECTORS: usize = 360; // 地面メッシュの周方向の分割
pub const ROCK_Y: f32 = -5.0; // アリーナの外の岩の高さ(掘れる深さより下)

pub const PLAYER_HEIGHT: f32 = 1.8; // 棒人間の身長(足元〜頭頂)
pub const EYE_HEIGHT: f32 = 1.65;
pub const PLAYER_SPEED: f32 = 7.0;
pub const PLAYER_RADIUS: f32 = 0.4;
pub const GRAVITY: f32 = 30.0;
pub const MAX_HP: i32 = 5;
pub const PLAYER_START: Vec3 = Vec3::new(0.0, 0.0, 30.0);

pub const BOSS_SCALE: f32 = 6.0; // プレイヤーの6倍
pub const BOSS_FOOT_RADIUS: f32 = 0.45 * BOSS_SCALE; // ボスの足元に入れない半径

// ボスの潜り→突き上げ(1サイクル: 立つ→潜る→地中を追う→予兆→突き上げ→空中→落下)
pub const BOSS_IDLE: f32 = 1.5;
pub const BOSS_DIVE: f32 = 0.7;
pub const BOSS_BURROW: f32 = 3.0;
pub const BOSS_TELEGRAPH: f32 = 1.2; // 予兆の間に STRIKE_RADIUS の外へ出れば避けられる
pub const BOSS_RISE: f32 = 0.25;
pub const BOSS_HANG: f32 = 0.5;
pub const BOSS_FALL: f32 = 0.6;
pub const BOSS_HIDE_DEPTH: f32 = 12.0; // 地中での沈み量(体高より深く)
pub const BOSS_RISE_HEIGHT: f32 = 9.0; // 突き上げで足が浮く高さ
pub const BOSS_CHASE_SPEED: f32 = 16.0; // 地中を追う速さ(プレイヤーより速い)
pub const STRIKE_RADIUS: f32 = 4.5; // 突き上げの当たり半径
pub const HIT_LAUNCH: f32 = 18.0; // 当たったときの打ち上げ速度
pub const MOUND_RADIUS: f32 = 2.5; // 地中を進むときの土の盛り上がり

// 魔法: 足元の土を集めてドリルにして撃つ。溜めるほど足場が削れる
pub const CHARGE_TIME: f32 = 2.5; // 満タンまでの秒
pub const CHARGE_MOVE: f32 = 0.6; // 溜め中の移動速度の倍率
pub const DIG_DEPTH_MAX: f32 = 3.0; // 満タンで削れる深さ
pub const DIG_RADIUS_MIN: f32 = 3.0;
pub const DIG_RADIUS_MAX: f32 = 7.5; // 満タンで削れる範囲の半径
pub const REFILL_RATE: f32 = 0.5; // 溜めていないとき、砂が穴を埋め戻す速さ(m/s)
pub const UPHILL_PENALTY: f32 = 0.9; // 上り坂の傾き1あたりの減速
pub const MIN_SLOPE_SPEED: f32 = 0.3; // 上り坂でも落ちない最低の速度倍率
pub const DRILL_SPEED: f32 = 45.0;
pub const DRILL_LEN: (f32, f32) = (1.2, 4.5); // 長さ(溜め0 → 満タン)
pub const DRILL_RADIUS: (f32, f32) = (0.25, 1.0); // 太さ(溜め0 → 満タン)
pub const DRILL_DAMAGE: (f32, f32) = (4.0, 40.0); // ボスへのダメージ(溜め0 → 満タン)
pub const BOSS_HP_MAX: f32 = 200.0;
pub const BOSS_BODY_RADIUS: f32 = 1.5; // ドリルが当たるボスの胴の太さ

pub const MOUSE_SENS: f32 = 0.0025;
pub const THIRD_DIST: f32 = 5.0; // Vキーの三人称カメラ距離

pub const RUN_SWING: f32 = 0.9; // 手足の振り(rad)
pub const RUN_FREQ: f32 = 11.0; // 走るときの手足の振りの速さ

pub const SAND: Color = Color::srgb(0.86, 0.74, 0.48);
pub const SAND_RING: Color = Color::srgb(0.70, 0.57, 0.33);
pub const ROCK: Color = Color::srgb(0.30, 0.27, 0.24);
pub const SKY: Color = Color::srgb(0.62, 0.80, 0.95);
pub const PLAYER_COLOR: Color = Color::srgb(0.10, 0.10, 0.12);
pub const BOSS_COLOR: Color = Color::srgb(0.30, 0.04, 0.04);
pub const MOUND_COLOR: Color = Color::srgb(0.68, 0.53, 0.30);
pub const WARN_COLOR: Color = Color::srgba(0.55, 0.12, 0.05, 0.55);
pub const SOIL_DARK: Color = Color::srgb(0.42, 0.30, 0.18); // 深く掘った土の色
pub const DRILL_COLOR: Color = Color::srgb(0.55, 0.38, 0.20);
pub const CHUNK_COLOR: Color = Color::srgb(0.36, 0.24, 0.12);
pub const HAT_COLOR: Color = Color::srgb(0.18, 0.10, 0.40);
