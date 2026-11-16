//! Bevy の入力システム。クリック・ドラッグ・キーを読んで、建築や logic.rs の操作(drop_item / click_source)を呼ぶ。
//! 依存: state.rs、logic.rs、render.rs のボタン配置(menu_rect / tab_rect / hit)、save.rs(F5/F9)。

use bevy::prelude::*;
use bevy::window::PrimaryWindow;

use crate::logic::{burst, click_source, drop_item, pop_text, ring};
use crate::render::{hit, menu_rect, tab_rect};
use crate::state::*;
use crate::state::World; // bevy::prelude::World と区別する
use crate::{DIRS, FARMER_INTERVAL, RIVER_INTERVAL, save};

pub fn cursor_world(window: &Window, camera: &Camera, cam_tf: &GlobalTransform) -> Option<Vec2> {
    let pos = window.cursor_position()?;
    camera.viewport_to_world_2d(cam_tf, pos).ok()
}

pub fn input(
    mut world: ResMut<World>,
    mouse: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    windows: Query<&Window, With<PrimaryWindow>>,
    cameras: Query<(&Camera, &GlobalTransform)>,
) {
    let w = &mut *world;
    // デバッグ: F5 で保存、F9 で読み込み
    if keys.just_pressed(KeyCode::F5) {
        let msg = match save::save(w, "state.json") {
            Ok(()) => "state.json に保存".to_string(),
            Err(e) => format!("保存失敗: {e}"),
        };
        let m = &mut w.markets[w.active];
        pop_text(m, Vec2::new(0.0, 200.0), msg, Color::WHITE);
    }
    if keys.just_pressed(KeyCode::F9) {
        match save::load("state.json") {
            Ok(nw) => *w = nw,
            Err(e) => eprintln!("読み込み失敗: {e}"),
        }
    }
    for (i, key) in [KeyCode::Digit1, KeyCode::Digit2, KeyCode::Digit3, KeyCode::Digit4].into_iter().enumerate() {
        if keys.just_pressed(key) {
            w.select(i);
        }
    }
    let Ok(window) = windows.single() else { return };
    let Ok((camera, cam_tf)) = cameras.single() else { return };
    let Some(p) = cursor_world(window, camera, cam_tf) else { return };
    let pressed_now = mouse.just_pressed(MouseButton::Left);

    // マーケットのタブ
    if pressed_now {
        if let Some(i) = (0..w.markets.len()).find(|&i| hit(p, tab_rect(i))) {
            w.select(i);
            return;
        }
    }

    let money = &mut w.money;
    let m = &mut w.markets[w.active];
    let def = m.def;
    let menu = menu(def);
    let cols = m.cols();
    let cell = world_to_cell(cols, p);

    if mouse.just_pressed(MouseButton::Right) {
        m.build = None;
    }

    if pressed_now {
        ring(m, p);
        // メニュー
        for (i, &(tool, cost, unlock)) in menu.iter().enumerate() {
            let r = menu_rect(i);
            if hit(p, r) {
                if unlock <= m.quest && *money >= cost {
                    if tool == Tool::Carrier {
                        // 運び人はその場で雇って市場から出発
                        *money -= cost;
                        let start = m.carrier_start();
                        m.carriers.push(Carrier::at(start));
                        burst(m, r.0, tool.color(def), 10);
                    } else {
                        m.build = Some(i);
                    }
                }
                return;
            }
        }
    }

    // 建築モード
    if let Some(mi) = m.build {
        let (tool, cost, _) = menu[mi];
        let trigger = if tool == Tool::Road { mouse.pressed(MouseButton::Left) } else { pressed_now };
        if trigger && m.in_field(cell) && *money >= cost {
            let mut center = cell_center(cols, cell);
            let ok = match tool {
                Tool::Build(bk) => {
                    // クリックしたマスを左下にして 2×2 を置く
                    let ok = m.can_place_building(cell);
                    if ok {
                        m.buildings.push(Building::new(bk, cell));
                        center = building_center(cols, cell);
                    }
                    ok
                }
                Tool::Road => {
                    let ok = m.is_free(cell);
                    if ok {
                        m.roads.push(cell);
                    }
                    ok
                }
                Tool::Farmer => {
                    // 建物の 4 マスのどこをクリックしてもその建物に乗せる(1建物に1人)
                    let target = m
                        .building_at(cell)
                        .filter(|&bi| m.buildings[bi].kind.produces(def).is_some() && m.worker_at(cell).is_none())
                        .map(|bi| m.buildings[bi].cell);
                    if let Some(bc) = target {
                        m.workers.push(Worker { kind: WKind::Farmer, cell: bc, timer: FARMER_INTERVAL });
                        center = building_center(cols, bc);
                    }
                    target.is_some()
                }
                Tool::River => {
                    let ok = m.is_free(cell) && DIRS.iter().any(|&(dx, dy)| m.is_river((cell.0 + dx, cell.1 + dy)));
                    if ok {
                        m.workers.push(Worker { kind: WKind::River, cell, timer: RIVER_INTERVAL });
                    }
                    ok
                }
                Tool::Carrier => false,
            };
            if ok {
                *money -= cost;
                burst(m, center, tool.color(def), 8);
                if tool != Tool::Road {
                    m.build = None;
                }
            }
        }
        if tool == Tool::Road && *money < cost {
            m.build = None;
        }
        return;
    }

    if pressed_now && m.in_field(cell) {
        if let Some(i) = m.item_at(cell, None) {
            m.drag = Some(i);
        } else if let Some(bi) = m.building_at(cell) {
            click_source(m, bi);
        }
    }

    if mouse.just_released(MouseButton::Left) {
        if let Some(i) = m.drag.take() {
            drop_item(m, money, i, cell);
        }
    }
}
