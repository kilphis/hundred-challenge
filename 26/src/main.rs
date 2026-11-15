use macroquad::prelude::*;
use rayon::prelude::*;
use std::time::Instant;

// ---- 調整用パラメータ ----
const VISION: f32 = 50.0; // この距離以内の仲間だけを見る
const SEP_DIST: f32 = 15.0; // これより近いと離れようとする
const MIN_SPEED: f32 = 60.0;
const MAX_SPEED: f32 = 200.0;
const DT: f32 = 1.0 / 60.0; // 固定の時間刻み(実フレーム時間に依存させない)

#[derive(Clone, Copy)]
struct Boid {
    pos: Vec2,
    vel: Vec2,
}

fn make_boids(n: usize, bounds: Vec2) -> Vec<Boid> {
    (0..n)
        .map(|_| Boid {
            pos: vec2(rand::gen_range(0.0, bounds.x), rand::gen_range(0.0, bounds.y)),
            vel: Vec2::from_angle(rand::gen_range(0.0, std::f32::consts::TAU)) * 100.0,
        })
        .collect()
}

/// i番目のBoidの「次の状態」を計算する。
/// old(前フレームの全員)を読むだけで、何も書き換えない → 各iが完全に独立 → 並列化できる。
/// near: 調べる相手の番号。総当たりなら 0..N、グリッドなら近くの9マスにいる分だけ。
fn step(i: usize, old: &[Boid], bounds: Vec2, near: impl Iterator<Item = usize>) -> Boid {
    let me = old[i];
    let mut sep = Vec2::ZERO; // 離れる
    let mut align_sum = Vec2::ZERO; // 揃える
    let mut center_sum = Vec2::ZERO; // 寄る
    let mut count = 0u32;

    for j in near {
        if j == i {
            continue;
        }
        let other = old[j];
        let d = other.pos - me.pos;
        let dist2 = d.length_squared();
        if dist2 < VISION * VISION {
            count += 1;
            align_sum += other.vel;
            center_sum += other.pos;
            if dist2 < SEP_DIST * SEP_DIST {
                sep -= d;
            }
        }
    }

    let mut vel = me.vel;
    if count > 0 {
        let n = count as f32;
        let align = align_sum / n - me.vel; // 平均速度との差
        let cohesion = center_sum / n - me.pos; // 仲間の重心への向き
        vel += (align * 2.0 + cohesion * 0.5 + sep * 20.0) * DT;
    }
    let speed = vel.length().clamp(MIN_SPEED, MAX_SPEED);
    vel = vel.normalize_or_zero() * speed;

    // 画面の端はつながっている(トーラス)ことにする
    let mut pos = me.pos + vel * DT;
    pos.x = pos.x.rem_euclid(bounds.x);
    pos.y = pos.y.rem_euclid(bounds.y);

    Boid { pos, vel }
}

/// 空間グリッド: 画面を一辺 VISION のマスに区切り、各マスにいるBoidの番号をまとめて持つ。
/// idx を「マス番号順」に並べ、start[c]..start[c+1] がマス c の範囲(数え上げソート)。
struct Grid {
    cols: usize,
    rows: usize,
    start: Vec<usize>,
    idx: Vec<usize>,
    cell: Vec<usize>, // 各Boidのマス番号(作業用)
}

impl Grid {
    fn new() -> Grid {
        Grid { cols: 1, rows: 1, start: Vec::new(), idx: Vec::new(), cell: Vec::new() }
    }

    fn cell_xy(&self, p: Vec2) -> (usize, usize) {
        let cx = ((p.x / VISION) as usize).min(self.cols - 1);
        let cy = ((p.y / VISION) as usize).min(self.rows - 1);
        (cx, cy)
    }

    /// 毎フレーム作り直す。
    /// マス番号を求める部分は各Boidで独立なので並列にできる。
    /// マスへの振り分けは全員が同じ配列に書くので、ここでは単一スレッドで行う。
    fn build(&mut self, boids: &[Boid], bounds: Vec2, parallel: bool) {
        self.cols = (bounds.x / VISION).ceil().max(1.0) as usize;
        self.rows = (bounds.y / VISION).ceil().max(1.0) as usize;
        let (cols, rows) = (self.cols, self.rows);
        let cell_of = |b: &Boid| {
            let cx = ((b.pos.x / VISION) as usize).min(cols - 1);
            let cy = ((b.pos.y / VISION) as usize).min(rows - 1);
            cy * cols + cx
        };
        self.cell.resize(boids.len(), 0);
        if parallel {
            self.cell.par_iter_mut().zip(boids.par_iter()).for_each(|(c, b)| *c = cell_of(b));
        } else {
            self.cell.iter_mut().zip(boids.iter()).for_each(|(c, b)| *c = cell_of(b));
        }

        // 数え上げソート: 各マスの人数 → 累積和で開始位置 → 番号を詰める
        self.start.clear();
        self.start.resize(cols * rows + 1, 0);
        for &c in &self.cell {
            self.start[c + 1] += 1;
        }
        for k in 0..cols * rows {
            self.start[k + 1] += self.start[k];
        }
        let mut fill = self.start.clone();
        self.idx.resize(boids.len(), 0);
        for (i, &c) in self.cell.iter().enumerate() {
            self.idx[fill[c]] = i;
            fill[c] += 1;
        }
    }

    /// 位置pのマスと周り8マスにいるBoidの番号。
    /// 総当たり版も画面端をまたいだ距離は見ていないので、ここでも端は折り返さない(結果をそろえるため)。
    fn near(&self, p: Vec2) -> impl Iterator<Item = usize> + '_ {
        let (cx, cy) = self.cell_xy(p);
        let x0 = cx.saturating_sub(1);
        let x1 = (cx + 1).min(self.cols - 1);
        let y0 = cy.saturating_sub(1);
        let y1 = (cy + 1).min(self.rows - 1);
        (y0..=y1).flat_map(move |y| {
            // 横に並んだ3マスは idx 上で連続しているので、1つの範囲として取れる
            let a = self.start[y * self.cols + x0];
            let b = self.start[y * self.cols + x1 + 1];
            self.idx[a..b].iter().copied()
        })
    }
}

const PANEL_W: f32 = 360.0; // 右のパネルの幅
const HIST: usize = 240; // グラフに残す更新時間の履歴(フレーム数)

fn window_conf() -> Conf {
    Conf {
        window_title: "boids".to_owned(),
        window_width: 1280,
        window_height: 780,
        window_resizable: true,
        ..Default::default()
    }
}

/// 左のシミュレーション画面の大きさ(= Boidが動ける範囲)
fn sim_bounds() -> Vec2 {
    vec2((screen_width() - PANEL_W).max(100.0), screen_height())
}

fn text(font: &Font, s: &str, x: f32, y: f32, size: u16, color: Color) {
    draw_text_ex(s, x, y, TextParams { font: Some(font), font_size: size, color, ..Default::default() });
}

/// グラフ・表示の色。4通りの組み合わせを見分ける
fn mode_color(parallel: bool, grid: bool) -> Color {
    match (parallel, grid) {
        (false, false) => YELLOW,
        (true, false) => SKYBLUE,
        (false, true) => ORANGE,
        (true, true) => GREEN,
    }
}

/// 1ステップ進める: a(今)を読んで b(次)に書く。
/// 戻り値はグリッド版の格子づくりにかかった時間(ms)。総当たり版は 0。
fn update(a: &[Boid], b: &mut [Boid], grid: &mut Grid, bounds: Vec2, parallel: bool, use_grid: bool) -> f32 {
    if use_grid {
        let t = Instant::now();
        grid.build(a, bounds, parallel);
        let build_ms = t.elapsed().as_secs_f32() * 1000.0;
        let g = &*grid;
        let f = |(i, nb): (usize, &mut Boid)| *nb = step(i, a, bounds, g.near(a[i].pos));
        if parallel {
            b.par_iter_mut().enumerate().for_each(f);
        } else {
            b.iter_mut().enumerate().for_each(f);
        }
        build_ms
    } else {
        let f = |(i, nb): (usize, &mut Boid)| *nb = step(i, a, bounds, 0..a.len());
        if parallel {
            // 並列版: bの各要素を、複数スレッドが手分けして計算する
            b.par_iter_mut().enumerate().for_each(f);
        } else {
            // 単一スレッド版
            b.iter_mut().enumerate().for_each(f);
        }
        0.0
    }
}

// ---- 計測モード(cargo run --release -- --bench) ----

const BENCH_NS: [usize; 5] = [1000, 2000, 4000, 8000, 16000];
const BENCH_THREADS: [usize; 6] = [1, 2, 4, 6, 8, 10];
const BENCH_BOUNDS: Vec2 = Vec2::new(920.0, 780.0); // 既定のウィンドウでの左の画面の大きさ

/// 1条件の更新時間(ms/ステップ)。
/// 他のアプリやOSのスレッド割り当て(Pコア/Eコア)で揺れるので、3回測って一番速い中央値を採る。
fn bench_one(n: usize, threads: Option<usize>, use_grid: bool) -> f32 {
    (0..3).map(|_| bench_median(n, threads, use_grid)).fold(f32::MAX, f32::min)
}

/// 1回分の計測: 更新時間(ms/ステップ)の中央値。
/// threads = None は rayon を使わない単一スレッド版。Some(t) は t スレッドの rayon プールで並列版。
fn bench_median(n: usize, threads: Option<usize>, use_grid: bool) -> f32 {
    rand::srand(n as u64); // 条件ごとに同じ初期配置
    let mut a = make_boids(n, BENCH_BOUNDS);
    let mut b = a.clone();
    let mut grid = Grid::new();
    let pool = threads.map(|t| rayon::ThreadPoolBuilder::new().num_threads(t).build().unwrap());
    let mut run = |a: &mut Vec<Boid>, b: &mut Vec<Boid>| -> f32 {
        let t = Instant::now();
        match &pool {
            Some(p) => p.install(|| update(a, b, &mut grid, BENCH_BOUNDS, true, use_grid)),
            None => update(a, b, &mut grid, BENCH_BOUNDS, false, use_grid),
        };
        std::mem::swap(a, b);
        t.elapsed().as_secs_f32() * 1000.0
    };
    for _ in 0..3 {
        run(&mut a, &mut b); // 慣らし(キャッシュ・スレッド起動)
    }
    // 合計 0.2 秒 かつ 5 回 以上になるまで測る(最大 200 回)
    let mut ms = Vec::new();
    let mut total = 0.0;
    while (total < 200.0 || ms.len() < 5) && ms.len() < 200 {
        let m = run(&mut a, &mut b);
        total += m;
        ms.push(m);
    }
    ms.sort_by(|x, y| x.partial_cmp(y).unwrap());
    ms[ms.len() / 2]
}

fn sh(cmd: &str, args: &[&str]) -> String {
    std::process::Command::new(cmd)
        .args(args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}

fn bench() {
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    let threads: Vec<usize> = BENCH_THREADS.iter().copied().filter(|&t| t <= cores).collect();
    let mut md = String::new();
    md += "# Boids 計測結果\n\n";
    md += &format!("- 日時: {}\n", sh("date", &["+%Y-%m-%d %H:%M"]));
    md += &format!("- CPU: {}(Pコア {} / Eコア {})\n",
        sh("sysctl", &["-n", "machdep.cpu.brand_string"]),
        sh("sysctl", &["-n", "hw.perflevel0.physicalcpu"]),
        sh("sysctl", &["-n", "hw.perflevel1.physicalcpu"]));
    md += &format!("- 画面(動ける範囲): {}×{} px、マス幅 {} px\n", BENCH_BOUNDS.x, BENCH_BOUNDS.y, VISION);
    md += "- 値: 1ステップの更新時間(ms)。各条件を3回測り、中央値が一番速かった回を採用。グリッド版は格子づくりを含む\n";
    md += "- 「単一」= rayon を使わない版。数字の列 = rayon のスレッド数\n";

    // res[g][ni] = (単一, [各スレッド数])
    let mut res: Vec<Vec<(f32, Vec<f32>)>> = Vec::new();
    for use_grid in [false, true] {
        let name = if use_grid { "グリッド" } else { "総当たり" };
        let mut rows = Vec::new();
        for &n in &BENCH_NS {
            let single = bench_one(n, None, use_grid);
            let par: Vec<f32> = threads.iter().map(|&t| bench_one(n, Some(t), use_grid)).collect();
            let line: Vec<String> = par.iter().map(|m| format!("{m:.2}")).collect();
            println!("{name} N={n:>5}  単一 {single:>8.2} ms  | {}", line.join("  "));
            rows.push((single, par));
        }
        res.push(rows);
    }

    let head = |first: &str| {
        let mut h = format!("| {first} | 単一 |");
        let mut sep = String::from("|---:|---:|");
        for t in &threads {
            h += &format!(" {t} |");
            sep += "---:|";
        }
        format!("{h}\n{sep}\n")
    };
    for (g, name) in ["総当たり", "グリッド"].iter().enumerate() {
        md += &format!("\n## {name}: 更新時間 (ms)\n\n");
        md += &head("N");
        for (ni, (single, par)) in res[g].iter().enumerate() {
            md += &format!("| {} | {single:.2} |", BENCH_NS[ni]);
            for m in par {
                md += &format!(" {m:.2} |");
            }
            md += "\n";
        }
        md += &format!("\n## {name}: 速度向上率(単一 ÷ 各列)\n\n");
        md += &head("N");
        for (ni, (single, par)) in res[g].iter().enumerate() {
            md += &format!("| {} | 1.00 |", BENCH_NS[ni]);
            for m in par {
                md += &format!(" {:.2} |", single / m);
            }
            md += "\n";
        }
    }
    md += "\n## グリッド化の効果(総当たり ÷ グリッド、同じ実行方式どうし)\n\n";
    md += &head("N");
    for ni in 0..BENCH_NS.len() {
        let (bs, bp) = &res[0][ni];
        let (gs, gp) = &res[1][ni];
        md += &format!("| {} | {:.1} |", BENCH_NS[ni], bs / gs);
        for (x, y) in bp.iter().zip(gp) {
            md += &format!(" {:.1} |", x / y);
        }
        md += "\n";
    }

    std::fs::write("bench.md", &md).unwrap();
    println!("\nbench.md に保存しました");
}

fn main() {
    if std::env::args().any(|a| a == "--bench") {
        bench();
        return;
    }
    macroquad::Window::from_config(window_conf(), app());
}

async fn app() {
    let font = load_ttf_font_from_bytes(include_bytes!("../assets/font.ttf")).unwrap();
    let mut n: usize = 2000;
    let mut bounds = sim_bounds();
    // ダブルバッファ: aを読み、bに書く。終わったら入れ替える
    let mut a = make_boids(n, bounds);
    let mut b = a.clone();
    let mut parallel = false;
    let mut use_grid = false;
    let mut show_grid = false;
    let mut paused = false;
    let mut grid = Grid::new();
    let mut ms_avg = 0.0f32;
    let mut build_avg = 0.0f32;
    let mut hist: Vec<(f32, bool, bool)> = Vec::new(); // (更新時間ms, 並列か, グリッドか)

    loop {
        bounds = sim_bounds();

        // ---- 操作 ----
        if is_key_pressed(KeyCode::Space) {
            parallel = !parallel;
        }
        if is_key_pressed(KeyCode::G) {
            use_grid = !use_grid;
        }
        if is_key_pressed(KeyCode::V) {
            show_grid = !show_grid;
        }
        if is_key_pressed(KeyCode::P) {
            paused = !paused;
        }
        let mut changed = is_key_pressed(KeyCode::R);
        if is_key_pressed(KeyCode::Up) {
            n = (n * 2).min(100_000);
            changed = true;
        }
        if is_key_pressed(KeyCode::Down) {
            n = (n / 2).max(100);
            changed = true;
        }
        if changed {
            a = make_boids(n, bounds);
            b = a.clone();
            hist.clear();
        }

        // ---- 更新(ここだけ計測する。グリッド版は格子づくりも含む) ----
        if !paused {
            let t = Instant::now();
            let build_ms = update(&a, &mut b, &mut grid, bounds, parallel, use_grid);
            if use_grid {
                build_avg = build_avg * 0.95 + build_ms * 0.05;
            }
            let ms = t.elapsed().as_secs_f32() * 1000.0;
            ms_avg = ms_avg * 0.95 + ms * 0.05; // 揺れを均す
            std::mem::swap(&mut a, &mut b);
            hist.push((ms, parallel, use_grid));
            if hist.len() > HIST {
                hist.remove(0);
            }
        }

        // ---- 描画: 左 = シミュレーション ----
        clear_background(BLACK);
        if show_grid {
            let line = Color::from_rgba(40, 44, 56, 255);
            let mut gx = 0.0;
            while gx < bounds.x {
                draw_line(gx, 0.0, gx, bounds.y, 1.0, line);
                gx += VISION;
            }
            let mut gy = 0.0;
            while gy < bounds.y {
                draw_line(0.0, gy, bounds.x, gy, 1.0, line);
                gy += VISION;
            }
        }
        for boid in &a {
            draw_rectangle(boid.pos.x, boid.pos.y, 2.0, 2.0, WHITE);
        }
        if paused {
            text(&font, "一時停止中", 12.0, 30.0, 22, ORANGE);
        }

        // ---- 描画: 右 = パネル ----
        let px = bounds.x;
        let sh = screen_height();
        draw_rectangle(px, 0.0, PANEL_W, sh, Color::from_rgba(24, 26, 32, 255));
        draw_line(px, 0.0, px, sh, 2.0, Color::from_rgba(70, 74, 86, 255));
        let x = px + 18.0;
        let mut y = 36.0;
        let head = Color::from_rgba(130, 170, 255, 255);
        let label = Color::from_rgba(150, 155, 170, 255);

        text(&font, "計測", x, y, 22, head);
        y += 32.0;
        let mode = if parallel { "並列 (rayon)" } else { "単一スレッド" };
        let search = if use_grid { "グリッド (9マス)" } else { "総当たり" };
        let col = mode_color(parallel, use_grid);
        let build = if use_grid { format!("{build_avg:.2} ms") } else { "-".to_string() };
        let rows: [(&str, String, Color); 7] = [
            ("Boid数 N", format!("{n}"), WHITE),
            ("実行", mode.to_string(), col),
            ("近傍探索", search.to_string(), col),
            ("スレッド数", format!("{}", rayon::current_num_threads()), WHITE),
            ("更新時間(平均)", format!("{ms_avg:.2} ms"), WHITE),
            (" うち格子づくり", build, WHITE),
            ("FPS", format!("{}", get_fps()), WHITE),
        ];
        for (k, v, c) in rows {
            text(&font, k, x, y, 18, label);
            text(&font, &v, x + 160.0, y, 18, c);
            y += 28.0;
        }

        // 更新時間の推移グラフ(色 = 実行 × 近傍探索 の組み合わせ)
        y += 16.0;
        text(&font, "更新時間の推移", x, y, 22, head);
        let gmax = hist.iter().map(|h| h.0).fold(1.0f32, f32::max) * 1.1;
        text(&font, &format!("上端 {gmax:.1} ms"), x + 200.0, y, 16, label);
        y += 14.0;
        let gw = PANEL_W - 36.0;
        let gh = 140.0;
        draw_rectangle(x, y, gw, gh, Color::from_rgba(14, 15, 19, 255));
        for (i, &(ms, par, gr)) in hist.iter().enumerate() {
            let bx = x + gw * i as f32 / HIST as f32;
            let bh = gh * (ms / gmax).min(1.0);
            draw_rectangle(bx, y + gh - bh, gw / HIST as f32 + 0.5, bh, mode_color(par, gr));
        }
        y += gh + 24.0;
        text(&font, "■ 単一・総当たり", x, y, 16, mode_color(false, false));
        text(&font, "■ 並列・総当たり", x + 160.0, y, 16, mode_color(true, false));
        y += 22.0;
        text(&font, "■ 単一・グリッド", x, y, 16, mode_color(false, true));
        text(&font, "■ 並列・グリッド", x + 160.0, y, 16, mode_color(true, true));

        // 操作一覧
        y += 40.0;
        text(&font, "操作", x, y, 22, head);
        y += 32.0;
        let keys = [
            ("Space", "単一 / 並列 切り替え"),
            ("G", "総当たり / グリッド"),
            ("V", "マス目の表示 オン / オフ"),
            ("↑", "N を2倍 (最大 100000)"),
            ("↓", "N を半分 (最小 100)"),
            ("R", "同じ N で配置をやり直す"),
            ("P", "一時停止 / 再開"),
        ];
        for (k, d) in keys {
            text(&font, k, x, y, 18, WHITE);
            text(&font, d, x + 80.0, y, 18, label);
            y += 28.0;
        }

        next_frame().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// グリッド版は総当たり版と同じ相手を見ている → 次の状態が(足し算の順番による誤差を除いて)一致する
    #[test]
    fn grid_matches_brute_force() {
        let bounds = vec2(923.0, 781.0); // マス幅で割り切れない大きさも試す
        let boids = make_boids(5000, bounds);
        let mut grid = Grid::new();
        grid.build(&boids, bounds, true);
        for i in 0..boids.len() {
            let x = step(i, &boids, bounds, 0..boids.len());
            let y = step(i, &boids, bounds, grid.near(boids[i].pos));
            assert!((x.pos - y.pos).length() < 1e-3, "i={i}");
            assert!((x.vel - y.vel).length() < 1e-2, "i={i}");
        }
    }
}
