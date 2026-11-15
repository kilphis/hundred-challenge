// 多将戦 — 大将ごとに1スレッドで考える、将棋と戦争の間
mod ai;
mod game;

use ai::{Job, Plan, Pool, now_ms, plan};
use game::{Game, H, Kind, W};
use macroquad::prelude::*;
use std::sync::Arc;

const CELL: f32 = 44.0;
const BX: f32 = 24.0;
const BY: f32 = 72.0;
const PX: f32 = 760.0;
const LANES: usize = 6;
const TL_MS: f64 = 4000.0;

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Par,  // 大将ごとに1スレッド
    Ser,  // 1スレッドで順番に
    Main, // 描画と同じスレッドで(画面が固まる)
}

struct Span {
    lane: usize,
    t0: f64,
    t1: f64,
    color: Color,
}

struct App {
    game: Game,
    pool: Pool,
    mode: Mode,
    k: usize,
    interval: f64, // ms
    running: bool,
    round: u64,
    pending: Option<(usize, Vec<Plan>)>, // 残りの返事の数, 集まった計画
    tick_start: f64,
    next_tick: f64,
    cmd: Vec<Option<(i32, i32)>>, // 大将 id → 指示(None = 自動)
    auto_target: Vec<(i32, i32)>,
    selected: Option<usize>,
    spans: Vec<Span>,
    ticks: Vec<(f64, f64)>,
    last_wall: f64,
    last_cpu: f64,
    hist: Vec<(f64, f64)>,
    seed: u64,
    font: Font,
    drag: Option<u8>,
}

fn hex(c: u32) -> Color {
    Color::from_rgba((c >> 16) as u8, (c >> 8) as u8, c as u8, 255)
}

fn side_col(s: u8) -> Color {
    if s == 0 { hex(0x1f4e8c) } else { hex(0xa3321f) }
}

fn gen_col(side: u8, slot: usize) -> Color {
    let c = [[0x3a7bd5, 0x1fa39e, 0x7b5bd6], [0xd9534f, 0xe8912d, 0xc2477f]];
    hex(c[side as usize][slot])
}

fn lane_of(u: &game::Unit) -> usize {
    u.side as usize * 3 + u.slot
}

impl App {
    fn new(font: Font) -> App {
        let game = Game::new();
        let n = game.units.len();
        App {
            game,
            pool: Pool::new(LANES),
            mode: Mode::Par,
            k: 100_000,
            interval: 500.0,
            running: false,
            round: 0,
            pending: None,
            tick_start: 0.0,
            next_tick: 0.0,
            cmd: vec![None; n],
            auto_target: vec![(0, 0); n],
            selected: None,
            spans: Vec::new(),
            ticks: Vec::new(),
            last_wall: 0.0,
            last_cpu: 0.0,
            hist: Vec::new(),
            seed: 0x9e3779b97f4a7c15,
            font,
            drag: None,
        }
    }

    fn reset(&mut self) {
        self.game = Game::new();
        self.round += 1; // 走っている計算の返事は捨てる
        self.pending = None;
        self.cmd = vec![None; self.game.units.len()];
        self.selected = None;
        self.running = false;
        self.hist.clear();
    }

    fn jobs(&mut self) -> Vec<Job> {
        let snap = Arc::new(self.game.units.clone());
        self.game
            .generals()
            .into_iter()
            .map(|g| {
                self.seed = self.seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                let target = if self.game.units[g].side == 0 { self.cmd[g] } else { None };
                Job { round: self.round, units: snap.clone(), general: g, target, k: self.k, seed: self.seed }
            })
            .collect()
    }

    fn start_tick(&mut self) {
        self.tick_start = now_ms();
        let jobs = self.jobs();
        match self.mode {
            Mode::Par => {
                let n = jobs.len();
                for j in jobs {
                    let lane = lane_of(&self.game.units[j.general]);
                    self.pool.send(lane, vec![j]);
                }
                self.pending = Some((n, Vec::new()));
            }
            Mode::Ser => {
                self.pool.send(0, jobs);
                self.pending = Some((1, Vec::new()));
            }
            Mode::Main => {
                let plans: Vec<Plan> = jobs.iter().map(|j| plan(j, 0)).collect();
                self.finish_tick(plans);
            }
        }
    }

    fn poll(&mut self) {
        while let Ok(v) = self.pool.rx.try_recv() {
            if v.first().is_some_and(|p| p.round != self.round) {
                continue;
            }
            if let Some((left, got)) = self.pending.as_mut() {
                *left -= 1;
                got.extend(v);
            }
        }
        if self.pending.as_ref().is_some_and(|(l, _)| *l == 0) {
            let (_, plans) = self.pending.take().unwrap();
            self.finish_tick(plans);
        }
    }

    fn finish_tick(&mut self, plans: Vec<Plan>) {
        let end = plans.iter().map(|p| p.t1).fold(if self.mode == Mode::Main { now_ms() } else { 0.0 }, f64::max);
        self.last_wall = end - self.tick_start;
        self.last_cpu = plans.iter().map(|p| p.t1 - p.t0).sum();
        self.hist.push((self.last_wall, self.last_cpu));
        if self.hist.len() > 20 {
            self.hist.remove(0);
        }
        self.ticks.push((self.tick_start, end));
        for p in &plans {
            let g = &self.game.units[p.general];
            self.spans.push(Span { lane: p.lane, t0: p.t0, t1: p.t1, color: gen_col(g.side, g.slot) });
            self.auto_target[p.general] = p.target;
        }
        let cut = end - TL_MS - 500.0;
        self.spans.retain(|s| s.t1 > cut);
        self.ticks.retain(|t| t.1 > cut);
        self.game.apply(&plans, get_time());
        self.next_tick = (self.tick_start + self.interval).max(end);
        if self.game.over.is_some() {
            self.running = false;
        }
    }

    fn update(&mut self) {
        self.poll();
        if self.running && self.pending.is_none() && self.game.over.is_none() && now_ms() >= self.next_tick {
            self.start_tick();
        }
    }

    // ---- 入力 ----

    fn cell_at(&self, m: Vec2) -> Option<(i32, i32)> {
        let (x, y) = (((m.x - BX) / CELL).floor() as i32, ((m.y - BY) / CELL).floor() as i32);
        (x >= 0 && x < W && y >= 0 && y < H).then_some((x, y))
    }

    fn input(&mut self) {
        let m: Vec2 = mouse_position().into();
        if is_key_pressed(KeyCode::Space) {
            self.toggle_run();
        }
        if is_key_pressed(KeyCode::R) {
            self.reset();
        }
        for (key, mode) in [(KeyCode::Key1, Mode::Par), (KeyCode::Key2, Mode::Ser), (KeyCode::Key3, Mode::Main)] {
            if is_key_pressed(key) {
                self.mode = mode;
            }
        }
        if is_key_pressed(KeyCode::Escape) {
            self.selected = None;
        }
        if is_mouse_button_pressed(MouseButton::Right) {
            if let Some(g) = self.selected {
                self.cmd[g] = None;
            }
        }
        if !is_mouse_button_down(MouseButton::Left) {
            self.drag = None;
        }
        if is_mouse_button_pressed(MouseButton::Left) {
            if let Some((x, y)) = self.cell_at(m) {
                let mine = self.game.units.iter().find(|u| u.alive && u.side == 0 && u.kind == Kind::G && u.x == x && u.y == y);
                if let Some(g) = mine {
                    self.selected = Some(g.id);
                } else if let Some(g) = self.selected {
                    self.cmd[g] = Some((x, y));
                }
            }
        }
        if let Some(g) = self.selected {
            if !self.game.units[g].alive {
                self.selected = None;
            }
        }
    }

    fn toggle_run(&mut self) {
        if self.game.over.is_some() {
            self.reset();
        }
        self.running = !self.running;
    }

    // ---- 描画 ----

    fn text(&self, s: &str, x: f32, y: f32, size: u16, color: Color) {
        draw_text_ex(s, x, y, TextParams { font: Some(&self.font), font_size: size, color, ..Default::default() });
    }

    fn text_c(&self, s: &str, cx: f32, cy: f32, size: u16, color: Color, rot: f32) {
        let d = measure_text(s, Some(&self.font), size, 1.0);
        let (ox, oy) = (-d.width / 2.0, d.offset_y / 2.0);
        let (c, sn) = (rot.cos(), rot.sin());
        let (x, y) = (cx + ox * c - oy * sn, cy + ox * sn + oy * c);
        draw_text_ex(s, x, y, TextParams { font: Some(&self.font), font_size: size, color, rotation: rot, ..Default::default() });
    }

    fn button(&self, label: &str, x: f32, y: f32, w: f32, h: f32, on: bool) -> bool {
        let m: Vec2 = mouse_position().into();
        let hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
        let bg = if on { hex(0x2d2a26) } else if hover { hex(0xe6dccb) } else { hex(0xf4eee3) };
        draw_rectangle(x, y, w, h, bg);
        draw_rectangle_lines(x, y, w, h, 1.5, hex(0x2d2a26));
        self.text_c(label, x + w / 2.0, y + h / 2.0, 17, if on { WHITE } else { hex(0x2d2a26) }, 0.0);
        hover && is_mouse_button_pressed(MouseButton::Left)
    }

    /// 0..1 を返すスライダー
    fn slider(&mut self, id: u8, x: f32, y: f32, w: f32, t: f32) -> f32 {
        let m: Vec2 = mouse_position().into();
        if is_mouse_button_pressed(MouseButton::Left) && m.x >= x - 8.0 && m.x <= x + w + 8.0 && (m.y - y).abs() < 12.0 {
            self.drag = Some(id);
        }
        let t = if self.drag == Some(id) { ((m.x - x) / w).clamp(0.0, 1.0) } else { t };
        draw_rectangle(x, y - 2.0, w, 4.0, hex(0xc9bea9));
        draw_rectangle(x, y - 2.0, w * t, 4.0, hex(0x2d2a26));
        draw_circle(x + w * t, y, 8.0, hex(0x2d2a26));
        t
    }

    fn draw_board(&self) {
        let now = get_time();
        draw_rectangle(BX - 8.0, BY - 8.0, CELL * W as f32 + 16.0, CELL * H as f32 + 16.0, hex(0xb98d4f));
        draw_rectangle(BX, BY, CELL * W as f32, CELL * H as f32, hex(0xe7c98e));
        for i in 0..=W {
            let x = BX + i as f32 * CELL;
            draw_line(x, BY, x, BY + CELL * H as f32, 1.0, hex(0x6b4f2a));
        }
        for i in 0..=H {
            let y = BY + i as f32 * CELL;
            draw_line(BX, y, BX + CELL * W as f32, y, 1.0, hex(0x6b4f2a));
        }
        let center = |x: f32, y: f32| vec2(BX + (x + 0.5) * CELL, BY + (y + 0.5) * CELL);

        // 選んだ大将の指揮範囲
        if let Some(g) = self.selected {
            let u = &self.game.units[g];
            let r = game::CMD_R as f32;
            let (x0, y0) = ((u.x as f32 - r).max(0.0), (u.y as f32 - r).max(0.0));
            let (x1, y1) = ((u.x as f32 + r + 1.0).min(W as f32), (u.y as f32 + r + 1.0).min(H as f32));
            let c = gen_col(u.side, u.slot);
            draw_rectangle(BX + x0 * CELL, BY + y0 * CELL, (x1 - x0) * CELL, (y1 - y0) * CELL, Color { a: 0.12, ..c });
            draw_rectangle_lines(BX + x0 * CELL, BY + y0 * CELL, (x1 - x0) * CELL, (y1 - y0) * CELL, 2.0, Color { a: 0.6, ..c });
        }
        // 自軍の大将の狙い
        for u in self.game.units.iter().filter(|u| u.alive && u.kind == Kind::G && u.side == 0) {
            let c = gen_col(u.side, u.slot);
            let from = center(u.x as f32, u.y as f32);
            if let Some((tx, ty)) = self.cmd[u.id] {
                let to = center(tx as f32, ty as f32);
                draw_line(from.x, from.y, to.x, to.y, 2.5, Color { a: 0.7, ..c });
                draw_circle_lines(to.x, to.y, CELL * 0.35, 3.0, c);
                draw_line(to.x - 8.0, to.y, to.x + 8.0, to.y, 3.0, c);
                draw_line(to.x, to.y - 8.0, to.x, to.y + 8.0, 3.0, c);
            } else if self.selected == Some(u.id) && self.game.tick > 0 {
                let (tx, ty) = self.auto_target[u.id];
                let to = center(tx as f32, ty as f32);
                draw_line(from.x, from.y, to.x, to.y, 1.5, Color { a: 0.4, ..c });
            }
        }

        let anim = ((now_ms() - self.ticks.last().map_or(0.0, |t| t.1)) / (self.interval * 0.7).clamp(60.0, 250.0)).clamp(0.0, 1.0) as f32;
        let ease = 1.0 - (1.0 - anim) * (1.0 - anim);
        for u in &self.game.units {
            let fade = if u.alive { 1.0 } else { 1.0 - ((now - u.die_t) / 0.6) as f32 };
            if fade <= 0.0 {
                continue;
            }
            let p = center(u.ax as f32 + (u.x - u.ax) as f32 * ease, u.ay as f32 + (u.y - u.ay) as f32 * ease);
            self.draw_piece(u, p, fade, now);
        }
        if let Some(g) = self.selected {
            let u = &self.game.units[g];
            let p = center(u.x as f32, u.y as f32);
            draw_circle_lines(p.x, p.y, CELL * 0.62, 3.0, hex(0xffffff));
        }

        if let Some(w) = self.game.over {
            draw_rectangle(BX, BY + CELL * 6.5, CELL * W as f32, CELL * 3.0, Color::new(0.1, 0.08, 0.06, 0.82));
            let msg = match w {
                0 => "勝ち — 赤の王将を討ち取った",
                1 => "負け — 青の王将が討たれた",
                _ if self.game.quiet >= game::STALL => "引き分け — 60 tick 動きがなかった",
                _ => "引き分け — 両方の王将が同時に倒れた",
            };
            let cx = BX + CELL * W as f32 / 2.0;
            self.text_c(msg, cx, BY + CELL * 7.6, 34, WHITE, 0.0);
            self.text_c(&format!("{} tick で決着。Space か R でもう一度", self.game.tick), cx, BY + CELL * 8.6, 18, hex(0xe0d6c4), 0.0);
        }
    }

    fn draw_piece(&self, u: &game::Unit, p: Vec2, fade: f32, now: f64) {
        let s = match u.kind {
            Kind::K => 0.92,
            Kind::G => 0.84,
            Kind::P => 0.72,
        } * CELL;
        let dir = if u.side == 0 { 1.0 } else { -1.0 };
        let shape = [(0.0, -0.5), (0.36, -0.3), (0.44, 0.48), (-0.44, 0.48), (-0.36, -0.3)];
        let pts: Vec<Vec2> = shape.iter().map(|&(x, y)| vec2(p.x + x * s, p.y + y * s * dir)).collect();
        let flash = (1.0 - ((now - u.hit_t) / 0.35) as f32).clamp(0.0, 1.0);
        let wood = Color { a: fade, ..hex(0xf6e2b6) };
        let fill = Color {
            r: wood.r + (0.95 - wood.r) * flash,
            g: wood.g * (1.0 - 0.7 * flash),
            b: wood.b * (1.0 - 0.7 * flash),
            a: fade,
        };
        for i in 1..4 {
            draw_triangle(pts[0], pts[i], pts[i + 1], fill);
        }
        let edge = if u.kind == Kind::K { side_col(u.side) } else { gen_col(u.side, u.slot) };
        let edge = Color { a: fade, ..edge };
        let thick = if u.kind == Kind::P { 2.5 } else { 3.5 };
        for i in 0..5 {
            let (a, b) = (pts[i], pts[(i + 1) % 5]);
            draw_line(a.x, a.y, b.x, b.y, thick, edge);
        }
        let label = match u.kind {
            Kind::K => "王",
            Kind::G => "将",
            Kind::P => "歩",
        };
        let size = (s * 0.5) as u16;
        let rot = if u.side == 0 { 0.0 } else { std::f32::consts::PI };
        self.text_c(label, p.x, p.y + s * 0.06 * dir, size, Color { a: fade, ..side_col(u.side) }, rot);
        // 体力
        if u.alive {
            let n = u.maxhp;
            let w = 6.0;
            let x0 = p.x - (n as f32 * w) / 2.0;
            let y = p.y + s * 0.62 * dir - 2.0;
            for i in 0..n {
                let c = if i < u.hp { hex(0x3c8d3c) } else { hex(0x8a7d68) };
                draw_rectangle(x0 + i as f32 * w + 0.5, y, w - 1.0, 3.5, c);
            }
        }
    }

    fn draw_panel(&mut self) {
        let ink = hex(0x2d2a26);
        let sub = hex(0x6d6457);
        self.text("考える場所", PX, 92.0, 18, ink);
        let modes = [(Mode::Par, "並列 (大将ごと)"), (Mode::Ser, "直列 (1本で順番)"), (Mode::Main, "描画と同じ")];
        for (i, (m, label)) in modes.into_iter().enumerate() {
            if self.button(label, PX + i as f32 * 150.0, 102.0, 142.0, 34.0, self.mode == m) {
                self.mode = m;
            }
        }

        // 思考量: 100 .. 1,000,000 を対数で
        let (lo, hi) = (100f32.ln(), 1_000_000f32.ln());
        self.text(&format!("思考量  1tickで試す候補の数(大将1人あたり): {}", sep(self.k)), PX, 168.0, 17, ink);
        let t = self.slider(0, PX + 8.0, 188.0, 420.0, ((self.k as f32).ln() - lo) / (hi - lo));
        self.k = (lo + t * (hi - lo)).exp().round() as usize;

        self.text(&format!("tick の間隔: {} ms", self.interval as i32), PX, 226.0, 17, ink);
        let t = self.slider(1, PX + 8.0, 246.0, 420.0, ((self.interval - 100.0) / 1400.0) as f32);
        self.interval = 100.0 + t as f64 * 1400.0;

        let run_label = if self.running { "一時停止 (Space)" } else { "開始 (Space)" };
        if self.button(run_label, PX, 270.0, 210.0, 38.0, self.running) {
            self.toggle_run();
        }
        if self.button("やり直し (R)", PX + 222.0, 270.0, 210.0, 38.0, false) {
            self.reset();
        }

        // 数字
        let cores = std::thread::available_parallelism().map_or(0, |n| n.get());
        let n = self.hist.len().max(1) as f64;
        let (aw, ac) = self.hist.iter().fold((0.0, 0.0), |a, h| (a.0 + h.0, a.1 + h.1));
        let (aw, ac) = (aw / n, ac / n);
        let par = if aw > 0.0 { ac / aw } else { 0.0 };
        let mut y = 340.0;
        for (label, val) in [
            ("この Mac のコア数", format!("{}", cores)),
            ("tick", format!("{}", self.game.tick)),
            ("思考にかかった実時間", format!("{:.1} ms  (直近平均 {:.1})", self.last_wall, aw)),
            ("各大将の思考時間の合計", format!("{:.1} ms  (直近平均 {:.1})", self.last_cpu, ac)),
            ("並列度  合計 ÷ 実時間", format!("{:.2} 倍", par)),
        ] {
            self.text(label, PX, y, 16, sub);
            self.text(&val, PX + 210.0, y, 16, ink);
            y += 24.0;
        }

        // スレッドの稼働
        let ty = 482.0;
        self.text(&format!("スレッドの稼働 (直近{}秒) — 色は大将", TL_MS / 1000.0), PX, ty, 17, ink);
        let (gx, gw, lh) = (PX + 52.0, 400.0, 22.0);
        let gy = ty + 12.0;
        let now = now_ms();
        let t0 = now - TL_MS;
        let xof = |t: f64| gx + (((t - t0) / TL_MS) as f32).clamp(0.0, 1.0) * gw;
        draw_rectangle(gx, gy, gw, lh * LANES as f32, hex(0xfbf8f2));
        for &(a, b) in &self.ticks {
            draw_rectangle(xof(a), gy, (xof(b) - xof(a)).max(1.0), lh * LANES as f32, Color::new(0.3, 0.25, 0.2, 0.07));
            draw_line(xof(b), gy, xof(b), gy + lh * LANES as f32, 1.0, Color::new(0.3, 0.25, 0.2, 0.35));
        }
        if let Some((_, _)) = &self.pending {
            draw_rectangle(xof(self.tick_start), gy, xof(now) - xof(self.tick_start), lh * LANES as f32, Color::new(0.3, 0.25, 0.2, 0.07));
        }
        let used = match self.mode {
            Mode::Par => LANES,
            _ => 1,
        };
        for l in 0..LANES {
            let y = gy + l as f32 * lh;
            let name = if self.mode == Mode::Main && l == 0 { "描画".to_string() } else { format!("T{}", l + 1) };
            self.text(&name, PX, y + 16.0, 15, if l < used { ink } else { hex(0xb5ab9a) });
            draw_line(gx, y + lh, gx + gw, y + lh, 1.0, hex(0xe6dccb));
        }
        for s in &self.spans {
            let (a, b) = (xof(s.t0), xof(s.t1));
            if b <= gx {
                continue;
            }
            draw_rectangle(a, gy + s.lane as f32 * lh + 3.0, (b - a).max(1.5), lh - 6.0, s.color);
        }
        draw_rectangle_lines(gx, gy, gw, lh * LANES as f32, 1.0, hex(0xc9bea9));

        // 大将の色
        let mut x = PX;
        let ly = gy + lh * LANES as f32 + 22.0;
        for side in 0..2u8 {
            for slot in 0..3 {
                draw_rectangle(x, ly - 10.0, 12.0, 12.0, gen_col(side, slot));
                self.text(&format!("{}{}", game::side_name(side), slot + 1), x + 16.0, ly, 14, sub);
                x += 72.0;
            }
        }

        // 記録
        let mut y = ly + 34.0;
        for line in self.game.log.iter().rev().take(4) {
            self.text(line, PX, y, 15, ink);
            y += 20.0;
        }

        let help = "青の大将をクリック → マスをクリックでそこへ向かわせる / 右クリックで自動に戻す / 1・2・3 で考える場所";
        self.text(help, BX, BY + CELL * H as f32 + 26.0, 15, sub);
    }
}

fn sep(n: usize) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    out
}

/// 窓を出さずに、並列と直列の思考時間を測る
fn bench() {
    let pool = Pool::new(LANES);
    println!("コア数 {}", std::thread::available_parallelism().map_or(0, |n| n.get()));
    println!("{:>9} | {:>10} | {:>10} | {:>6}", "思考量", "直列 ms", "並列 ms", "倍率");
    for k in [2_000, 20_000, 200_000] {
        let mut res = [0.0; 2];
        for (mi, par) in [false, true].into_iter().enumerate() {
            let mut g = Game::new();
            let mut total = 0.0;
            let mut seed = 12345u64;
            for _ in 0..20 {
                let snap = Arc::new(g.units.clone());
                let jobs: Vec<Job> = g
                    .generals()
                    .into_iter()
                    .map(|general| {
                        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
                        Job { round: 0, units: snap.clone(), general, target: None, k, seed }
                    })
                    .collect();
                let t = now_ms();
                let msgs = if par {
                    let n = jobs.len();
                    for (i, j) in jobs.into_iter().enumerate() {
                        pool.send(i, vec![j]);
                    }
                    n
                } else {
                    pool.send(0, jobs);
                    1
                };
                let mut plans = Vec::new();
                for _ in 0..msgs {
                    plans.extend(pool.rx.recv().unwrap());
                }
                total += now_ms() - t;
                g.apply(&plans, 0.0);
                if g.over.is_some() {
                    break;
                }
            }
            res[mi] = total / g.tick as f64;
        }
        println!("{:>9} | {:>10.2} | {:>10.2} | {:>5.2}x", sep(k), res[0], res[1], res[0] / res[1]);
    }
}

/// 窓を出さずに CPU 同士で何局か戦わせ、決着までの tick と勝敗を出す
fn sim() {
    let pool = Pool::new(LANES);
    let mut seed = 3931u64;
    for game_no in 0..20 {
        let mut g = Game::new();
        while g.over.is_none() && g.tick < 2000 {
            let snap = Arc::new(g.units.clone());
            let gens = g.generals();
            let n = gens.len();
            for (i, general) in gens.into_iter().enumerate() {
                seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
                pool.send(i, vec![Job { round: 0, units: snap.clone(), general, target: None, k: 20_000, seed }]);
            }
            let mut plans = Vec::new();
            for _ in 0..n {
                plans.extend(pool.rx.recv().unwrap());
            }
            g.apply(&plans, 0.0);
        }
        let alive = |s: u8| g.units.iter().filter(|u| u.alive && u.side == s).count();
        println!("{:>2}: {:?} {} tick  残り 青{} 赤{}  {}", game_no, g.over, g.tick, alive(0), alive(1), g.log.join(" / "));
    }
}

fn window_conf() -> Conf {
    Conf {
        window_title: "多将戦".to_owned(),
        window_width: 1240,
        window_height: 820,
        window_resizable: false,
        ..Default::default()
    }
}

#[macroquad::main(window_conf)]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--bench") {
        bench();
        std::process::exit(0);
    }
    if args.iter().any(|a| a == "--sim") {
        sim();
        std::process::exit(0);
    }
    // --shot <png> <tick数> : 自動で進めて、その tick で画面を保存して終わる(確認用)
    let shot = args.iter().position(|a| a == "--shot").map(|i| (args[i + 1].clone(), args[i + 2].parse::<u32>().unwrap()));

    let font = load_ttf_font_from_bytes(include_bytes!("../assets/font.ttf")).unwrap();
    let mut app = App::new(font);
    if let Some((_, _)) = &shot {
        app.interval = 100.0;
        if args.iter().any(|a| a == "--ser") {
            app.mode = Mode::Ser;
        }
        app.running = true;
        app.selected = app.game.generals().into_iter().find(|&g| app.game.units[g].side == 0);
        if let Some(g) = app.selected {
            app.cmd[g] = Some((4, 3));
        }
    }
    loop {
        app.input();
        app.update();
        clear_background(hex(0xf4eee3));
        app.text("多将戦", BX, 44.0, 30, hex(0x2d2a26));
        app.text("大将ひとりにつき1スレッドで考える、将棋と戦争の間", BX + 104.0, 44.0, 17, hex(0x6d6457));
        app.draw_board();
        app.draw_panel();
        if let Some((path, at)) = &shot {
            if app.game.tick >= *at || app.game.over.is_some() {
                get_screen_data().export_png(path);
                std::process::exit(0);
            }
        }
        next_frame().await;
    }
}
