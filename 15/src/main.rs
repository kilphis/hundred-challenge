use macroquad::prelude::*;
use macroquad::rand::gen_range;

// 画面(論理座標)。実際のウィンドウサイズに合わせて拡大縮小する
const W: f32 = 960.0;
const H: f32 = 640.0;
// 競技場
const FIELD: Rect = Rect { x: 40.0, y: 70.0, w: 880.0, h: 540.0 };

const RADIUS: f32 = 22.0; // 騎馬1組の当たり判定
const REACH: f32 = 52.0; // ハチマキに手が届く距離(中心間)
// 移動速度は全体にこの倍率をかける
const SPEED_SCALE: f32 = 0.7;
const PLAYER_SPEED: f32 = 150.0 * SPEED_SCALE;
const AI_SPEED: f32 = 120.0 * SPEED_SCALE;
const PLAYER_COOLDOWN: f32 = 0.5;
const TEAM_SIZE: usize = 7; // 1チームの騎馬の数
const READY_TIME: f32 = 1.0; // 開始前に止まって待つ時間

// 正面の範囲(向きから左右60°)。この範囲から手を出すと組み合いになる
const FRONT_COS: f32 = 0.5;
// 組み合い中の2騎の中心間距離
const GRAPPLE_GAP: f32 = 40.0;
// 組み合いの押し合い: プレイヤーはスペースを押している間、毎秒これだけ押す(1.0で押し勝ち)
const PLAYER_POWER: f32 = 0.2;
// 組み合い中に移動キーで動くときの速さ(相手ごと引きずる)
const GRAPPLE_SPEED: f32 = 70.0 * SPEED_SCALE * 1.2;
// 取られた騎馬が、ぶつかる判定だけ残している時間
const DOWN_SOLID_TIME: f32 = 2.0;
// AIの押す力(毎秒)。騎馬ごとに乱数で決める
const AI_POWER: (f32, f32) = (0.15, 0.25);

#[derive(Clone, Copy, PartialEq)]
enum Team {
    Red,
    White,
}

struct Rider {
    pos: Vec2,
    vel: Vec2,
    facing: f32,
    team: Team,
    alive: bool,
    is_player: bool,
    cooldown: f32,
    grapple: Option<usize>, // 組み合っている相手
    tug: f32,               // 押し合いの優勢度(-1..1、+1で自分の勝ち)
    power: f32,             // AIの押す力
    solid: f32,             // 取られた後、ぶつかる判定が残る残り時間
}

// 手を出したときに何が起きるか
#[derive(Clone, Copy, PartialEq)]
enum Grab {
    Take,    // 横・後ろから → 取れる
    Grapple, // 正面から → 組み合う
    Blocked, // 正面から、でも相手は既に組み合い中 → 何も起きない
}

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Solo,  // 一人プレイ(紅組の1騎を操作)
    Watch, // 全員AIの試合を観る
}

const MODES: [(Mode, &str); 2] = [(Mode::Solo, "一人で遊ぶ"), (Mode::Watch, "AIの試合を観る")];

enum Scene {
    Title,
    Play,
    Result(Team),
}

struct Game {
    riders: Vec<Rider>,
    scene: Scene,
    font: Option<Font>,
    popups: Vec<Popup>,
    mode: Mode,
    menu: usize, // タイトルで選んでいる項目
    ready: f32,  // 開始前の残り待ち時間
}

// 一定時間だけ浮かんで消える文字
struct Popup {
    pos: Vec2,
    text: String,
    color: Color,
    t: f32,
}

const POPUP_TIME: f32 = 0.9;

fn team_color(t: Team) -> Color {
    match t {
        Team::Red => Color::from_rgba(220, 40, 50, 255),
        Team::White => Color::from_rgba(250, 250, 250, 255),
    }
}

fn move_input() -> Vec2 {
    let mut dir = Vec2::ZERO;
    if is_key_down(KeyCode::Left) || is_key_down(KeyCode::A) { dir.x -= 1.0; }
    if is_key_down(KeyCode::Right) || is_key_down(KeyCode::D) { dir.x += 1.0; }
    if is_key_down(KeyCode::Up) || is_key_down(KeyCode::W) { dir.y -= 1.0; }
    if is_key_down(KeyCode::Down) || is_key_down(KeyCode::S) { dir.y += 1.0; }
    dir
}

fn dir_of(angle: f32) -> Vec2 {
    vec2(angle.cos(), angle.sin())
}

fn new_riders(with_player: bool) -> Vec<Rider> {
    let mut v: Vec<Rider> = Vec::new();
    for i in 0..TEAM_SIZE {
        for team in [Team::Red, Team::White] {
            let red = team == Team::Red;
            // 開始位置: 自陣(紅は左半分、白は右半分)のランダムな場所。他の騎馬と近すぎたら引き直す
            let (x0, x1) = if red {
                (FIELD.x + 40.0, FIELD.x + FIELD.w / 2.0 - 80.0)
            } else {
                (FIELD.x + FIELD.w / 2.0 + 80.0, FIELD.x + FIELD.w - 40.0)
            };
            let mut pos = Vec2::ZERO;
            for _ in 0..100 {
                pos = vec2(gen_range(x0, x1), gen_range(FIELD.y + 40.0, FIELD.y + FIELD.h - 40.0));
                if v.iter().all(|r| r.pos.distance(pos) > 90.0) {
                    break;
                }
            }
            v.push(Rider {
                pos,
                vel: Vec2::ZERO,
                facing: if red { 0.0 } else { std::f32::consts::PI },
                team,
                alive: true,
                is_player: with_player && red && i == 1,
                cooldown: if red { 0.0 } else { gen_range(0.5, 1.5) },
                grapple: None,
                tug: 0.0,
                power: gen_range(AI_POWER.0, AI_POWER.1),
                solid: 0.0,
            });
        }
    }
    v
}

// AIの1フレーム分の意思
struct Intent {
    dir: Vec2,
    face: Option<Vec2>, // 移動方向ではなくこちらを向く
    attempt: Option<usize>,
}

impl Game {
    fn text(&self, s: &str, x: f32, y: f32, size: u16, color: Color) {
        draw_text_ex(
            s,
            x,
            y,
            TextParams { font: self.font.as_ref(), font_size: size, color, ..Default::default() },
        );
    }

    fn text_center(&self, s: &str, y: f32, size: u16, color: Color) {
        let d = measure_text(s, self.font.as_ref(), size, 1.0);
        self.text(s, (W - d.width) / 2.0, y, size, color);
    }

    fn start(&mut self) {
        self.riders = new_riders(self.mode == Mode::Solo);
        self.popups.clear();
        self.scene = Scene::Play;
        self.ready = READY_TIME;
    }

    fn to_title(&mut self) {
        self.riders = new_riders(true);
        self.popups.clear();
        self.scene = Scene::Title;
    }

    fn popup(&mut self, pos: Vec2, text: &str, color: Color) {
        self.popups.push(Popup { pos, text: text.to_owned(), color, t: POPUP_TIME });
    }

    fn count(&self, t: Team) -> usize {
        self.riders.iter().filter(|r| r.alive && r.team == t).count()
    }

    fn player(&self) -> Option<&Rider> {
        self.riders.iter().find(|r| r.is_player && r.alive)
    }

    // a が b に手を出したら何が起きるか(b の向きに対して a がどこにいるか)
    fn grab_kind(&self, a: usize, b: usize) -> Grab {
        let (ra, rb) = (&self.riders[a], &self.riders[b]);
        let to_a = (ra.pos - rb.pos).normalize_or_zero();
        let front = dir_of(rb.facing).dot(to_a) > FRONT_COS;
        if !front {
            Grab::Take
        } else if ra.grapple.is_none() && rb.grapple.is_none() {
            Grab::Grapple
        } else {
            Grab::Blocked
        }
    }

    // 自分の手が届いている一番近い相手
    fn player_target(&self) -> Option<usize> {
        let me = self.player()?;
        if me.grapple.is_some() {
            return None;
        }
        self.riders
            .iter()
            .enumerate()
            .filter(|(_, r)| r.alive && r.team != me.team && r.pos.distance(me.pos) <= REACH)
            .min_by(|a, b| a.1.pos.distance(me.pos).partial_cmp(&b.1.pos.distance(me.pos)).unwrap())
            .map(|(j, _)| j)
    }

    fn ai_intent(&self, i: usize) -> Intent {
        let r = &self.riders[i];
        // 組み合い中の相手を優先して狙う(横から取れるので)
        let target = self
            .riders
            .iter()
            .enumerate()
            .filter(|(_, e)| e.alive && e.team != r.team)
            .map(|(j, e)| {
                let busy = e.grapple.is_some_and(|p| p != i);
                (j, e.pos.distance(r.pos) - if busy { 250.0 } else { 0.0 })
            })
            .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .map(|(j, _)| j);
        let Some(j) = target else {
            return Intent { dir: Vec2::ZERO, face: None, attempt: None };
        };
        let t = &self.riders[j];
        let dist = t.pos.distance(r.pos);

        // 組み合い中の相手には横へ回り込む。そうでなければ真っすぐ向かう
        let goal = if t.grapple.is_some() {
            let f = dir_of(t.facing);
            let side = vec2(-f.y, f.x);
            let s = if side.dot(r.pos - t.pos) >= 0.0 { side } else { -side };
            t.pos + s * REACH * 0.75
        } else {
            t.pos
        };
        let mut dir = goal - r.pos;
        if t.grapple.is_none() && dist <= REACH {
            dir *= 0.3; // 手が届く距離では詰め寄りすぎない
        } else if dir.length() < 4.0 {
            dir = Vec2::ZERO;
        }

        let attempt = (dist <= REACH && r.cooldown <= 0.0 && self.grab_kind(i, j) != Grab::Blocked).then_some(j);
        let face = (dist <= REACH * 1.3).then_some(t.pos - r.pos);
        Intent { dir, face, attempt }
    }

    // a が b のハチマキを取る
    fn take(&mut self, a: usize, b: usize) {
        self.riders[b].alive = false;
        self.riders[b].solid = DOWN_SOLID_TIME;
        self.riders[b].vel = Vec2::ZERO;
        if let Some(p) = self.riders[b].grapple.take() {
            let partner = &mut self.riders[p];
            partner.grapple = None;
            partner.tug = 0.0;
            partner.cooldown = if partner.is_player { 0.0 } else { gen_range(0.4, 0.8) };
        }
        let text = if self.riders[a].is_player {
            "ハチマキを取った!"
        } else if self.riders[b].is_player {
            "取られた!"
        } else {
            "取った!"
        };
        let color = if self.riders[a].team == Team::Red { Color::from_rgba(255, 90, 90, 255) } else { WHITE };
        self.popup(self.riders[b].pos, text, color);
    }

    fn update(&mut self, dt: f32) {
        let n = self.riders.len();
        let mut attempts: Vec<(usize, usize)> = Vec::new(); // (手を出す側, 相手)
        let mut push = vec![0.0f32; n];

        // 1. 意思決定
        for i in 0..n {
            if !self.riders[i].alive {
                self.riders[i].solid = (self.riders[i].solid - dt).max(0.0);
                continue;
            }
            self.riders[i].cooldown = (self.riders[i].cooldown - dt).max(0.0);

            if self.riders[i].grapple.is_some() {
                // 組み合い中: スペース長押しで押す。移動キーで相手ごと動ける
                let r = &mut self.riders[i];
                if r.is_player {
                    push[i] = if is_key_down(KeyCode::Space) { PLAYER_POWER * dt } else { 0.0 };
                    let dir = move_input();
                    r.vel = if dir.length() > 0.0 { dir.normalize() * GRAPPLE_SPEED } else { Vec2::ZERO };
                } else {
                    push[i] = r.power * dt * gen_range(0.5, 1.5);
                    r.vel = Vec2::ZERO;
                }
                continue;
            }

            let (dir, face, speed) = if self.riders[i].is_player {
                let dir = move_input();
                if is_key_pressed(KeyCode::Space) && self.riders[i].cooldown <= 0.0 {
                    match self.player_target() {
                        Some(j) => attempts.push((i, j)),
                        None => self.popup(self.riders[i].pos, "届かない", LIGHTGRAY),
                    }
                }
                (dir, None, PLAYER_SPEED)
            } else {
                let it = self.ai_intent(i);
                if let Some(j) = it.attempt {
                    attempts.push((i, j));
                }
                (it.dir, it.face, AI_SPEED)
            };

            let r = &mut self.riders[i];
            if dir.length() > 0.0 {
                let d = dir.normalize();
                r.facing = d.y.atan2(d.x);
                r.vel = r.vel.lerp(d * speed, (8.0 * dt).min(1.0));
            } else {
                r.vel = r.vel.lerp(Vec2::ZERO, (8.0 * dt).min(1.0));
            }
            if let Some(f) = face {
                r.facing = f.y.atan2(f.x);
            }
        }

        // 2. 手を出した結果
        for (a, b) in attempts {
            if !self.riders[a].alive || !self.riders[b].alive || self.riders[a].grapple.is_some() {
                continue;
            }
            let kind = self.grab_kind(a, b);
            match kind {
                Grab::Take => self.take(a, b),
                Grab::Grapple => {
                    self.riders[a].grapple = Some(b);
                    self.riders[b].grapple = Some(a);
                    self.riders[a].tug = 0.0;
                    self.riders[b].tug = 0.0;
                    let mid = (self.riders[a].pos + self.riders[b].pos) / 2.0;
                    self.popup(mid, "組み合った!", ORANGE);
                }
                Grab::Blocked => {
                    if self.riders[a].is_player {
                        self.popup(self.riders[a].pos, "正面からは取れない", LIGHTGRAY);
                    }
                }
            }
            let r = &mut self.riders[a];
            r.cooldown = if r.is_player {
                if kind == Grab::Blocked { 0.0 } else { PLAYER_COOLDOWN }
            } else {
                gen_range(0.6, 1.4)
            };
        }

        // 3. 押し合い
        for i in 0..n {
            let Some(j) = self.riders[i].grapple else { continue };
            if i > j || !self.riders[i].alive {
                continue;
            }
            let t = (self.riders[i].tug + push[i] - push[j]).clamp(-1.0, 1.0);
            self.riders[i].tug = t;
            self.riders[j].tug = -t;
            if t >= 1.0 {
                self.take(i, j);
            } else if t <= -1.0 {
                self.take(j, i);
            }
        }

        // 4. 位置更新と押し合い(体のぶつかり)
        for r in self.riders.iter_mut().filter(|r| r.alive) {
            r.pos += r.vel * dt;
        }
        for i in 0..n {
            for j in (i + 1)..n {
                let blocks = |r: &Rider| r.alive || r.solid > 0.0;
                if !blocks(&self.riders[i]) || !blocks(&self.riders[j]) || self.riders[i].grapple == Some(j) {
                    continue;
                }
                let d = self.riders[j].pos - self.riders[i].pos;
                let dist = d.length();
                if dist < RADIUS * 2.0 && dist > 0.001 {
                    let push = d / dist * (RADIUS * 2.0 - dist) / 2.0;
                    self.riders[i].pos -= push;
                    self.riders[j].pos += push;
                }
            }
        }
        // 組み合い中の2騎は、それぞれ動いたあとで距離を GRAPPLE_GAP に戻して向かい合わせる
        // (片方だけ動くと、中点が半分だけ動き、2騎を結ぶ向きも回る)
        for i in 0..n {
            let Some(j) = self.riders[i].grapple else { continue };
            if i > j {
                continue;
            }
            let (pi, pj) = (self.riders[i].pos, self.riders[j].pos);
            let u = (pj - pi).normalize_or(dir_of(self.riders[i].facing));
            let mid = (pi + pj) / 2.0;
            self.riders[i].pos = mid - u * GRAPPLE_GAP / 2.0;
            self.riders[j].pos = mid + u * GRAPPLE_GAP / 2.0;
            self.riders[i].facing = u.y.atan2(u.x);
            self.riders[j].facing = (-u).y.atan2(-u.x);
        }
        for r in self.riders.iter_mut() {
            r.pos.x = r.pos.x.clamp(FIELD.x + RADIUS, FIELD.x + FIELD.w - RADIUS);
            r.pos.y = r.pos.y.clamp(FIELD.y + RADIUS, FIELD.y + FIELD.h - RADIUS);
        }

        // AIは相手が手の届く距離に入った瞬間には手を出さない(反応時間)
        for i in 0..n {
            let r = &self.riders[i];
            if r.is_player || r.cooldown > 0.0 || r.grapple.is_some() {
                continue;
            }
            let near = self.riders.iter().any(|e| e.alive && e.team != r.team && e.pos.distance(r.pos) <= REACH);
            if !near {
                self.riders[i].cooldown = gen_range(0.3, 0.8);
            }
        }

        for pp in self.popups.iter_mut() {
            pp.t -= dt;
        }
        self.popups.retain(|pp| pp.t > 0.0);

        // 5. 勝敗
        if self.count(Team::White) == 0 {
            self.scene = Scene::Result(Team::Red);
        } else if self.count(Team::Red) == 0 {
            self.scene = Scene::Result(Team::White);
        }
    }

    fn draw_rider(&self, r: &Rider) {
        let f = dir_of(r.facing);
        let side = vec2(-f.y, f.x);
        let body = if r.alive { Color::from_rgba(240, 200, 160, 255) } else { Color::from_rgba(200, 180, 160, 140) };
        let shirt = if r.alive { Color::from_rgba(250, 250, 250, 255) } else { Color::from_rgba(230, 230, 230, 140) };

        // 馬(3人):前1人+後ろ2人
        for p in [r.pos + f * 14.0, r.pos - f * 10.0 + side * 13.0, r.pos - f * 10.0 - side * 13.0] {
            draw_circle(p.x, p.y, 10.0, shirt);
            draw_circle_lines(p.x, p.y, 10.0, 1.5, DARKGRAY);
            draw_circle(p.x, p.y, 5.0, Color::from_rgba(40, 30, 30, if r.alive { 255 } else { 140 }));
        }
        // 騎手
        draw_circle(r.pos.x, r.pos.y, 12.0, body);
        draw_circle_lines(r.pos.x, r.pos.y, 12.0, 1.5, DARKGRAY);
        if r.alive {
            // ハチマキ
            draw_circle_lines(r.pos.x, r.pos.y, 9.0, 4.0, team_color(r.team));
            let tail = r.pos - f * 12.0;
            draw_line(tail.x, tail.y, tail.x - f.x * 10.0 + side.x * 4.0, tail.y - f.y * 10.0 + side.y * 4.0, 3.0, team_color(r.team));
            if r.team == Team::White {
                draw_circle_lines(r.pos.x, r.pos.y, 11.0, 1.0, GRAY);
            }
        }
        if r.is_player && r.alive {
            draw_triangle(
                vec2(r.pos.x, r.pos.y - 34.0),
                vec2(r.pos.x - 7.0, r.pos.y - 46.0),
                vec2(r.pos.x + 7.0, r.pos.y - 46.0),
                YELLOW,
            );
        }
    }

    // 組み合いの表示: 2騎のあいだの印と、押し合いのゲージ(紅が左)
    fn draw_grapples(&self) {
        for (i, r) in self.riders.iter().enumerate() {
            let Some(j) = r.grapple else { continue };
            if i > j || !r.alive {
                continue;
            }
            let o = &self.riders[j];
            let mid = (r.pos + o.pos) / 2.0;
            let shake = (get_time() as f32 * 40.0).sin() * 2.0;
            draw_circle_lines(mid.x, mid.y, 8.0 + shake, 3.0, ORANGE);

            let red_tug = if r.team == Team::Red { r.tug } else { o.tug };
            let (bw, bh) = (80.0, 8.0);
            let (bx, by) = (mid.x - bw / 2.0, mid.y - 52.0);
            let red_w = bw * (1.0 + red_tug) / 2.0;
            draw_rectangle(bx - 2.0, by - 2.0, bw + 4.0, bh + 4.0, Color::from_rgba(0, 0, 0, 180));
            draw_rectangle(bx, by, red_w, bh, team_color(Team::Red));
            draw_rectangle(bx + red_w, by, bw - red_w, bh, team_color(Team::White));
            draw_line(mid.x, by - 3.0, mid.x, by + bh + 3.0, 2.0, BLACK);
        }
    }

    // top=false: 騎馬の下に手の届く範囲 / top=true: 騎馬の上に案内
    fn draw_reach(&self, top: bool) {
        let Some(me) = self.player() else { return };
        if me.grapple.is_some() {
            return;
        }
        let target = self.player_target();
        let pi = self.riders.iter().position(|r| r.is_player).unwrap();
        let kind = target.map(|j| self.grab_kind(pi, j));
        let ready = me.cooldown <= 0.0;
        let col = match (kind, ready) {
            (Some(Grab::Take), true) => Color::from_rgba(255, 230, 0, 230),
            (Some(Grab::Grapple), true) => Color::from_rgba(255, 150, 30, 230),
            _ => Color::from_rgba(255, 255, 255, 110),
        };
        if !top {
            draw_circle(me.pos.x, me.pos.y, REACH, Color::new(col.r, col.g, col.b, 0.12));
            draw_circle_lines(me.pos.x, me.pos.y, REACH, 2.0, col);
            return;
        }
        if !ready {
            // 次に手を出せるまでの残り時間を円弧で
            let frac = me.cooldown / PLAYER_COOLDOWN;
            draw_arc(me.pos.x, me.pos.y, 24, REACH, -90.0, 3.0, 360.0 * frac, Color::from_rgba(255, 255, 255, 200));
            return;
        }
        let (Some(j), Some(kind)) = (target, kind) else { return };
        let t = &self.riders[j];
        let (label, c) = match kind {
            Grab::Take => ("スペース: 取れる!", YELLOW),
            Grab::Grapple => ("スペース: 組み合う", ORANGE),
            Grab::Blocked => ("正面からは取れない", LIGHTGRAY),
        };
        if kind != Grab::Blocked {
            let pulse = 26.0 + (get_time() as f32 * 10.0).sin() * 3.0;
            draw_circle_lines(t.pos.x, t.pos.y, pulse, 3.0, c);
        }
        let d = measure_text(label, self.font.as_ref(), 20, 1.0);
        let y = if t.grapple.is_some() { t.pos.y + 44.0 } else { t.pos.y - 40.0 };
        draw_rectangle(t.pos.x - d.width / 2.0 - 6.0, y - 20.0, d.width + 12.0, 26.0, Color::from_rgba(0, 0, 0, 170));
        self.text(label, t.pos.x - d.width / 2.0, y, 20, c);
    }

    fn draw(&self) {
        clear_background(Color::from_rgba(30, 40, 30, 255));
        draw_rectangle(FIELD.x, FIELD.y, FIELD.w, FIELD.h, Color::from_rgba(214, 188, 140, 255));
        draw_rectangle_lines(FIELD.x, FIELD.y, FIELD.w, FIELD.h, 4.0, WHITE);
        draw_line(W / 2.0, FIELD.y, W / 2.0, FIELD.y + FIELD.h, 2.0, Color::from_rgba(255, 255, 255, 120));

        let playing = matches!(self.scene, Scene::Play);
        // 倒れた騎馬を先に、残っている騎馬を上に
        for r in self.riders.iter().filter(|r| !r.alive) {
            self.draw_rider(r);
        }
        if playing {
            self.draw_reach(false);
        }
        for r in self.riders.iter().filter(|r| r.alive) {
            self.draw_rider(r);
        }
        self.draw_grapples();
        if playing {
            self.draw_reach(true);
        }
        for pp in &self.popups {
            let k = pp.t / POPUP_TIME;
            let y = pp.pos.y - 30.0 - (1.0 - k) * 30.0;
            let d = measure_text(&pp.text, self.font.as_ref(), 24, 1.0);
            let c = Color::new(pp.color.r, pp.color.g, pp.color.b, k.min(1.0));
            self.text(&pp.text, pp.pos.x - d.width / 2.0 + 1.5, y + 1.5, 24, Color::new(0.0, 0.0, 0.0, k * 0.8));
            self.text(&pp.text, pp.pos.x - d.width / 2.0, y, 24, c);
        }

        let red = format!("紅組 残り {}", self.count(Team::Red));
        let white = format!("白組 残り {}", self.count(Team::White));
        self.text(&red, 50.0, 48.0, 28, team_color(Team::Red));
        let d = measure_text(&white, self.font.as_ref(), 28, 1.0);
        self.text(&white, W - 50.0 - d.width, 48.0, 28, team_color(Team::White));

        match self.scene {
            Scene::Title => {
                draw_rectangle(0.0, 0.0, W, H, Color::from_rgba(0, 0, 0, 160));
                self.text_center("騎馬戦", 220.0, 80, WHITE);
                self.text_center("移動: 矢印キー / WASD", 290.0, 24, WHITE);
                self.text_center("横・後ろから近づいてスペース → ハチマキを取れる", 330.0, 24, YELLOW);
                self.text_center("正面からスペース → 組み合い。長押しで押し込む", 362.0, 24, ORANGE);
                self.text_center("組み合っている相手は、横から回り込めば取れる", 394.0, 24, WHITE);
                self.text_center("あなたは紅組(黄色の矢印)。白組のハチマキを全部取れば勝ち", 436.0, 22, WHITE);
                for (k, (_, name)) in MODES.iter().enumerate() {
                    let y = 492.0 + k as f32 * 40.0;
                    if k == self.menu {
                        self.text_center(&format!("▶ {name} ◀"), y, 30, YELLOW);
                    } else {
                        self.text_center(name, y, 30, GRAY);
                    }
                }
                self.text_center("↑↓ で選んで スペース / Enter で開始", 600.0, 20, LIGHTGRAY);
            }
            Scene::Play => {
                self.text_center("Esc: タイトルへ", 46.0, 18, LIGHTGRAY);
                let hint = match self.player() {
                    None if self.mode == Mode::Watch => "AIの試合を観戦中",
                    None => "ハチマキを取られた… 味方を見守ろう",
                    Some(me) if me.grapple.is_some() => "組み合い中! スペース長押しで押し込む / 移動キーで相手ごと動ける",
                    Some(_) => "横・後ろからなら一発で取れる / 正面だと組み合いになる",
                };
                self.text_center(hint, 632.0, 22, WHITE);
                if self.ready > 0.0 {
                    self.text_center("Ready", 350.0, 72, YELLOW);
                }
            }
            Scene::Result(t) => {
                draw_rectangle(0.0, 0.0, W, H, Color::from_rgba(0, 0, 0, 150));
                let msg = match (t, self.mode) {
                    (Team::Red, _) => "紅組の勝ち!",
                    (Team::White, Mode::Watch) => "白組の勝ち!",
                    (Team::White, Mode::Solo) => "白組の勝ち…",
                };
                self.text_center(msg, 300.0, 64, team_color(t));
                self.text_center("スペースでもう一回", 380.0, 28, YELLOW);
                self.text_center("Esc でタイトルへ", 420.0, 22, LIGHTGRAY);
            }
        }
    }
}

fn window_conf() -> Conf {
    Conf {
        window_title: "騎馬戦".to_owned(),
        window_width: W as i32,
        window_height: H as i32,
        ..Default::default()
    }
}

#[macroquad::main(window_conf)]
async fn main() {
    rand::srand((macroquad::miniquad::date::now() * 1000.0) as u64);

    let font_path = if cfg!(target_arch = "wasm32") { "font.ttf" } else { "web/font.ttf" };
    let font = load_ttf_font(font_path).await.ok();

    let mut game = Game {
        riders: new_riders(true),
        scene: Scene::Title,
        font,
        popups: Vec::new(),
        mode: Mode::Solo,
        menu: 0,
        ready: 0.0,
    };

    loop {
        // 論理座標 W×H を画面いっぱいに(縦横比は維持)
        let scale = (screen_width() / W).min(screen_height() / H);
        let vw = W * scale;
        let vh = H * scale;
        let mut cam = Camera2D::from_display_rect(Rect::new(0.0, 0.0, W, H));
        cam.zoom.y = -cam.zoom.y;
        cam.viewport = Some((
            ((screen_width() - vw) / 2.0) as i32,
            ((screen_height() - vh) / 2.0) as i32,
            vw as i32,
            vh as i32,
        ));
        clear_background(BLACK);
        set_camera(&cam);

        let dt = get_frame_time().min(1.0 / 30.0);
        match game.scene {
            Scene::Title => {
                if is_key_pressed(KeyCode::Up) || is_key_pressed(KeyCode::W) {
                    game.menu = (game.menu + MODES.len() - 1) % MODES.len();
                }
                if is_key_pressed(KeyCode::Down) || is_key_pressed(KeyCode::S) {
                    game.menu = (game.menu + 1) % MODES.len();
                }
                if is_key_pressed(KeyCode::Space) || is_key_pressed(KeyCode::Enter) {
                    game.mode = MODES[game.menu].0;
                    game.start();
                }
            }
            Scene::Play => {
                if is_key_pressed(KeyCode::Escape) {
                    game.to_title();
                } else if game.ready > 0.0 {
                    game.ready -= dt;
                } else {
                    game.update(dt);
                }
            }
            Scene::Result(_) => {
                if is_key_pressed(KeyCode::Space) {
                    game.start();
                } else if is_key_pressed(KeyCode::Escape) {
                    game.to_title();
                }
            }
        }
        game.draw();

        set_default_camera();
        next_frame().await;
    }
}
