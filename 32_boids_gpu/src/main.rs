//! Boids: 単一スレッド / 並列(rayon) / GPU × 総当たり / グリッド を1つの画面で切り替えて比べる。
//!   cargo run --release              画面
//!   cargo run --release -- --bench   CPU と GPU を測って bench.md に書く
//!   cargo run --release -- --check   GPU の1ステップ目を CPU と突き合わせる
//! 画面は eframe(egui + wgpu)。どの方式で計算しても、描画は GPU のバッファから同じ描き方で行う。

mod bench;
mod cpu;
mod gpu;

use cpu::*;
use eframe::egui;
use eframe::egui_wgpu;
use eframe::wgpu;
use gpu::*;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Instant;

const PANEL_W: f32 = 360.0; // 右のパネルの幅
const HIST: usize = 240; // グラフに残す更新時間の履歴(フレーム数)

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Single,
    Parallel,
    Gpu,
}

impl Mode {
    fn next(self) -> Mode {
        match self {
            Mode::Single => Mode::Parallel,
            Mode::Parallel => Mode::Gpu,
            Mode::Gpu => Mode::Single,
        }
    }
    fn name(self) -> &'static str {
        match self {
            Mode::Single => "単一スレッド",
            Mode::Parallel => "並列 (rayon)",
            Mode::Gpu => "GPU (compute shader)",
        }
    }
}

/// 方式ごとの N の上限。1ステップがおよそ 100ms を超えないところで止める
/// (bench.md の実測より。これを超えると画面が固まったようになる)
fn max_n(mode: Mode, grid: bool) -> usize {
    match (mode, grid) {
        (Mode::Single, false) => 8000,
        (Mode::Parallel, false) => 16000,
        (Mode::Single, true) => 16000,
        (Mode::Parallel, true) => 32000,
        (Mode::Gpu, false) => 64000,
        (Mode::Gpu, true) => 128000,
    }
}

/// グラフ・表示の色。6通りの組み合わせを見分ける
fn mode_color(mode: Mode, grid: bool) -> egui::Color32 {
    let (r, g, b) = match (mode, grid) {
        (Mode::Single, false) => (240, 220, 80),
        (Mode::Parallel, false) => (110, 190, 255),
        (Mode::Gpu, false) => (230, 120, 230),
        (Mode::Single, true) => (255, 160, 60),
        (Mode::Parallel, true) => (120, 220, 120),
        (Mode::Gpu, true) => (255, 110, 120),
    };
    egui::Color32::from_rgb(r, g, b)
}

pub fn cpu_label() -> String {
    let sh = bench::sh;
    format!("{}(Pコア {} / Eコア {})",
        sh("sysctl", &["-n", "machdep.cpu.brand_string"]),
        sh("sysctl", &["-n", "hw.perflevel0.physicalcpu"]),
        sh("sysctl", &["-n", "hw.perflevel1.physicalcpu"]))
}

/// GPU のコア数(Mac は system_profiler から読む)
fn gpu_cores() -> Option<u32> {
    bench::sh("system_profiler", &["SPDisplaysDataType"])
        .lines()
        .find_map(|l| l.trim().strip_prefix("Total Number of Cores:").and_then(|s| s.trim().parse().ok()))
}

pub fn gpu_label(adapter: &wgpu::Adapter) -> String {
    let info = adapter.get_info();
    match gpu_cores() {
        Some(c) => format!("{}({c}コア GPU、{:?})", info.name, info.backend),
        None => format!("{}({:?})", info.name, info.backend),
    }
}

struct DrawCb {
    pipe: wgpu::RenderPipeline,
    bind: wgpu::BindGroup,
    n: u32,
}

impl egui_wgpu::CallbackTrait for DrawCb {
    fn paint(&self, _info: egui::PaintCallbackInfo, pass: &mut wgpu::RenderPass<'static>, _res: &egui_wgpu::CallbackResources) {
        pass.set_pipeline(&self.pipe);
        pass.set_bind_group(0, &self.bind, &[]);
        pass.draw(0..6, 0..self.n);
    }
}

struct App {
    device: wgpu::Device,
    queue: wgpu::Queue,
    format: wgpu::TextureFormat,
    gpu_name: String,
    gpu_cores: String,
    cpu_cores: usize,
    pe: (String, String), // Pコア数, Eコア数
    sim: Option<Sim>,     // GPU 側。CPU で計算するときも描画に使う
    a: Vec<Boid>,         // CPU 側のダブルバッファ: aを読み、bに書く
    b: Vec<Boid>,
    grid: Grid,
    n: usize,
    mode: Mode,
    use_grid: bool,
    show_grid: bool,
    paused: bool,
    reset: bool,
    seed: u64,
    note: String, // N を上限に下げたときの知らせ
    ms_avg: f32,
    build_avg: f32,
    hist: Vec<(f32, Mode, bool)>, // (更新時間ms, 方式, グリッドか)
}

impl App {
    fn new(cc: &eframe::CreationContext) -> App {
        let rs = cc.wgpu_render_state.as_ref().expect("wgpu で起動していません");
        let mut fonts = egui::FontDefinitions::default();
        fonts.font_data.insert("jp".into(), Arc::new(egui::FontData::from_static(include_bytes!("../assets/font.ttf"))));
        for fam in [egui::FontFamily::Proportional, egui::FontFamily::Monospace] {
            fonts.families.get_mut(&fam).unwrap().push("jp".into());
        }
        cc.egui_ctx.set_fonts(fonts);
        let info = rs.adapter.get_info();
        App {
            device: rs.device.clone(),
            queue: rs.queue.clone(),
            format: rs.target_format,
            gpu_name: format!("{}({:?})", info.name, info.backend),
            gpu_cores: gpu_cores().map_or("-".into(), |c| format!("{c}")),
            cpu_cores: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
            pe: (bench::sh("sysctl", &["-n", "hw.perflevel0.physicalcpu"]), bench::sh("sysctl", &["-n", "hw.perflevel1.physicalcpu"])),
            sim: None,
            a: Vec::new(),
            b: Vec::new(),
            grid: Grid::new(),
            n: 2000,
            mode: Mode::Single,
            use_grid: false,
            show_grid: false,
            paused: false,
            reset: true,
            seed: 1,
            note: String::new(),
            ms_avg: 0.0,
            build_avg: 0.0,
            hist: Vec::new(),
        }
    }

    fn push_hist(&mut self, ms: f32) {
        self.ms_avg = if self.ms_avg == 0.0 { ms } else { self.ms_avg * 0.95 + ms * 0.05 }; // 揺れを均す
        self.hist.push((ms, self.mode, self.use_grid));
        if self.hist.len() > HIST {
            self.hist.remove(0);
        }
    }

    /// 方式・探索を変えたとき、N が上限を超えていたら下げる
    fn fit_n(&mut self) {
        let cap = max_n(self.mode, self.use_grid);
        if self.n > cap {
            while self.n > cap {
                self.n /= 2;
            }
            self.note = format!("この方式の上限に合わせて N を {} にしました", self.n);
            self.reset = true;
        }
    }

    /// 方式を切り替える。計算の途中の状態を、CPU と GPU のあいだで受け渡す
    fn set_mode(&mut self, mode: Mode) {
        let Some(sim) = self.sim.as_ref() else { return };
        if self.mode == Mode::Gpu && mode != Mode::Gpu {
            self.a = sim.read_boids();
            self.b = self.a.clone();
        }
        self.mode = mode;
        self.ms_avg = 0.0;
        self.fit_n();
    }

    /// 1ステップ進める
    fn step(&mut self) {
        let Some(sim) = self.sim.as_mut() else { return };
        // GPU のタイムスタンプは待たずに、読み戻しが済んだフレームで受け取る
        let _ = self.device.poll(wgpu::PollType::Poll);
        let mut got = None;
        if let Some(t) = sim.ts.as_mut() {
            if t.busy && t.ready.swap(false, Ordering::AcqRel) {
                got = Some(ts_to_ms(&t.read.get_mapped_range(..16), t.period)[0]);
                t.read.unmap();
                t.busy = false;
            }
        }
        if self.paused {
            return;
        }
        if self.mode == Mode::Gpu {
            if let Some(ms) = got {
                self.push_hist(ms);
            }
            let sim = self.sim.as_mut().unwrap();
            let measure = sim.ts.as_ref().is_some_and(|t| !t.busy);
            let mut enc = self.device.create_command_encoder(&Default::default());
            sim.encode_step(&mut enc, self.use_grid, measure.then_some(0));
            if measure {
                let t = sim.ts.as_ref().unwrap();
                enc.resolve_query_set(&t.set, 0..2, &t.resolve, 0);
                enc.copy_buffer_to_buffer(&t.resolve, 0, &t.read, 0, 16);
            }
            self.queue.submit([enc.finish()]);
            if measure {
                let t = sim.ts.as_mut().unwrap();
                t.busy = true;
                let ready = t.ready.clone();
                t.read.map_async(wgpu::MapMode::Read, ..16, move |r| ready.store(r.is_ok(), Ordering::Release));
            }
        } else {
            // CPU で計算(ここだけ計測する。グリッド版は格子づくりも含む)
            let bounds = sim.bounds;
            let t = Instant::now();
            let build_ms = update(&self.a, &mut self.b, &mut self.grid, bounds, self.mode == Mode::Parallel, self.use_grid);
            let ms = t.elapsed().as_secs_f32() * 1000.0;
            std::mem::swap(&mut self.a, &mut self.b);
            if self.use_grid {
                self.build_avg = self.build_avg * 0.95 + build_ms * 0.05;
            }
            self.sim.as_ref().unwrap().upload(&self.a); // 描画用に GPU へ送る
            self.push_hist(ms);
        }
    }
}

/// 大きい数を「万・億」で
fn big(v: f64) -> String {
    if v >= 1e8 {
        format!("{:.1}億", v / 1e8)
    } else if v >= 1e4 {
        format!("{:.0}万", v / 1e4)
    } else {
        format!("{v:.0}")
    }
}

impl eframe::App for App {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        // ---- 操作 ----
        let keys = ui.input(|i| {
            [egui::Key::Space, egui::Key::G, egui::Key::V, egui::Key::P, egui::Key::R, egui::Key::ArrowUp, egui::Key::ArrowDown]
                .map(|k| i.key_pressed(k))
        });
        let [space, g, v, p, r, up, down] = keys;
        if space {
            self.set_mode(self.mode.next());
        }
        if g {
            self.use_grid = !self.use_grid;
            self.ms_avg = 0.0;
            self.fit_n();
        }
        if v {
            self.show_grid = !self.show_grid;
        }
        if p {
            self.paused = !self.paused;
        }
        if r {
            self.reset = true;
        }
        if up {
            let cap = max_n(self.mode, self.use_grid);
            if self.n * 2 <= cap {
                self.n *= 2;
                self.reset = true;
                self.note.clear();
            } else {
                self.note = format!("この方式の N の上限は {cap} です");
            }
        }
        if down {
            self.n = (self.n / 2).max(125);
            self.reset = true;
            self.note.clear();
        }

        let head = egui::Color32::from_rgb(130, 170, 255);
        let label = egui::Color32::from_rgb(150, 155, 170);
        let fps = 1.0 / ui.input(|i| i.stable_dt).max(1e-4);
        let (cols, rows) = self.sim.as_ref().map_or((1, 1), |s| (s.cols, s.rows));

        // ---- 右 = パネル ----
        egui::Panel::right("panel")
            .exact_size(PANEL_W)
            .resizable(false)
            .frame(egui::Frame::NONE.fill(egui::Color32::from_rgb(24, 26, 32)).inner_margin(16.0))
            .show(ui, |ui| {
                ui.set_max_width(PANEL_W - 32.0);
                let row = |ui: &mut egui::Ui, k: &str, v: String, c: egui::Color32| {
                    ui.horizontal(|ui| {
                        ui.add_sized([130.0, 20.0], egui::Label::new(egui::RichText::new(k).color(label).size(14.0)));
                        ui.label(egui::RichText::new(v).color(c).size(14.0));
                    });
                };
                let title = |ui: &mut egui::Ui, s: &str| {
                    ui.add_space(8.0);
                    ui.label(egui::RichText::new(s).color(head).size(18.0));
                    ui.add_space(2.0);
                };
                let note = |ui: &mut egui::Ui, s: &str| {
                    ui.label(egui::RichText::new(s).color(label).size(12.5));
                };
                let col = mode_color(self.mode, self.use_grid);
                let white = egui::Color32::WHITE;
                let n = self.n as f64;
                let gpu = self.mode == Mode::Gpu;

                title(ui, "計測");
                row(ui, "Boid数 N", format!("{}(上限 {})", self.n, max_n(self.mode, self.use_grid)), white);
                row(ui, "実行", self.mode.name().into(), col);
                row(ui, "近傍探索", if self.use_grid { "グリッド (9マス)" } else { "総当たり" }.into(), col);
                let (pc, ec) = &self.pe;
                let cores = match self.mode {
                    Mode::Single => format!("CPU 1 / {}(P{pc} + E{ec})", self.cpu_cores),
                    Mode::Parallel => format!("CPU {} / {}(P{pc} + E{ec})", rayon::current_num_threads(), self.cpu_cores),
                    Mode::Gpu => format!("GPU {}コア({})", self.gpu_cores, self.gpu_name),
                };
                row(ui, "使用コア", cores, white);
                if gpu {
                    row(ui, " スレッド", format!("{} 本 = {} グループ × {WG}", self.n, self.n.div_ceil(WG as usize)), white);
                }
                let has_ts = self.sim.as_ref().is_some_and(|s| s.ts.is_some());
                let t = if gpu && !has_ts { "測れません".into() } else if self.ms_avg > 0.0 { format!("{:.3} ms", self.ms_avg) } else { "-".into() };
                row(ui, if gpu { "更新時間(GPU計算)" } else { "更新時間(平均)" }, t, white);
                let build = if self.use_grid && !gpu { format!("{:.3} ms", self.build_avg) } else { "-".into() };
                row(ui, " うち格子づくり", build, white);
                row(ui, "FPS", format!("{fps:.0}"), white);
                if !self.note.is_empty() {
                    ui.label(egui::RichText::new(&self.note).color(egui::Color32::from_rgb(255, 170, 60)).size(13.0));
                }

                title(ui, "計算量のオーダー");
                let p = match self.mode {
                    Mode::Single => None,
                    Mode::Parallel => Some(format!("{}", rayon::current_num_threads())),
                    Mode::Gpu => Some("同時に動く数".into()),
                };
                if self.use_grid {
                    let c = (cols * rows) as f64;
                    let k = 9.0 * n / c;
                    let f = match &p {
                        None => "O(N + C) + O(N·k)".to_string(),
                        Some(_) => "O(N + C) + O(N·k / p)".to_string(),
                    };
                    row(ui, "式", f, col);
                    row(ui, "マス数 C", format!("{cols}×{rows} = {}", cols * rows), white);
                    row(ui, "候補数 k", format!("≈ 9N/C = {k:.0}"), white);
                    row(ui, "距離計算/ステップ", format!("約 {}", big(n * k)), white);
                    note(ui, "画面の広さが固定なので k は N に比例する。\n実質 O(N²) のまま、係数が約 9/C になる。");
                } else {
                    row(ui, "式", if p.is_some() { "O(N² / p)" } else { "O(N²)" }.into(), col);
                    row(ui, "距離計算/ステップ", big(n * (n - 1.0)), white);
                }
                match self.mode {
                    Mode::Single => note(ui, "1コアが全員分を順に計算する。"),
                    Mode::Parallel => note(ui, &format!("p = {} スレッドで手分けする。総量は同じで、\n1コアあたりの量が 1/p になる。", p.unwrap())),
                    Mode::Gpu => note(ui, "1匹 = 1スレッドで全員を同時に投げる。\n総量は同じで、同時に動く数が桁違い。"),
                }

                // 更新時間の推移グラフ(色 = 実行 × 近傍探索 の組み合わせ)
                title(ui, "更新時間の推移");
                let gmax = self.hist.iter().map(|h| h.0).fold(0.01f32, f32::max) * 1.1;
                note(ui, &format!("上端 {gmax:.3} ms(GPU は計算時間、CPU は壁時計)"));
                let (rect, _) = ui.allocate_exact_size(egui::vec2(PANEL_W - 32.0, 100.0), egui::Sense::hover());
                let painter = ui.painter();
                painter.rect_filled(rect, 0.0, egui::Color32::from_rgb(14, 15, 19));
                let bw = rect.width() / HIST as f32;
                for (i, &(ms, m, gr)) in self.hist.iter().enumerate() {
                    let h = rect.height() * (ms / gmax).min(1.0);
                    let x = rect.left() + bw * i as f32;
                    painter.rect_filled(egui::Rect::from_min_max(egui::pos2(x, rect.bottom() - h), egui::pos2(x + bw + 0.5, rect.bottom())), 0.0, mode_color(m, gr));
                }
                for gr in [false, true] {
                    ui.horizontal(|ui| {
                        for m in [Mode::Single, Mode::Parallel, Mode::Gpu] {
                            let s = match m { Mode::Single => "単一", Mode::Parallel => "並列", Mode::Gpu => "GPU" };
                            let t = if gr { "グリッド" } else { "総当たり" };
                            ui.label(egui::RichText::new(format!("■ {s}・{t}")).color(mode_color(m, gr)).size(12.5));
                        }
                    });
                }

                title(ui, "操作");
                for (k, d) in [
                    ("Space", "単一 → 並列 → GPU"),
                    ("G", "総当たり / グリッド"),
                    ("V", "マス目の表示 オン / オフ"),
                    ("↑ / ↓", "N を2倍 / 半分(方式ごとに上限)"),
                    ("R", "同じ N で配置をやり直す"),
                    ("P", "一時停止 / 再開"),
                ] {
                    ui.horizontal(|ui| {
                        ui.add_sized([50.0, 18.0], egui::Label::new(egui::RichText::new(k).color(white).size(13.5)));
                        ui.label(egui::RichText::new(d).color(label).size(13.5));
                    });
                }
            });

        // ---- 左 = シミュレーション ----
        egui::CentralPanel::default()
            .frame(egui::Frame::NONE.fill(egui::Color32::BLACK))
            .show(ui, |ui| {
                let rect = ui.max_rect();
                let bounds = [rect.width().max(100.0), rect.height().max(100.0)];
                if self.reset || self.sim.is_none() {
                    self.seed += 1;
                    self.a = make_boids(self.n, bounds, self.seed);
                    self.b = self.a.clone();
                    self.sim = Some(Sim::new(&self.device, &self.queue, &self.a, bounds, Some(self.format), 1));
                    self.reset = false;
                    self.hist.clear();
                    self.ms_avg = 0.0;
                } else if let Some(sim) = self.sim.as_mut() {
                    if sim.bounds != bounds {
                        sim.set_bounds(bounds);
                    }
                }
                self.step();
                let sim = self.sim.as_ref().unwrap();
                let painter = ui.painter_at(rect);
                if self.show_grid {
                    let line = egui::Stroke::new(1.0, egui::Color32::from_rgb(40, 44, 56));
                    for c in 0..cols {
                        let x = rect.left() + c as f32 * VISION;
                        painter.line_segment([egui::pos2(x, rect.top()), egui::pos2(x, rect.bottom())], line);
                    }
                    for r in 0..rows {
                        let y = rect.top() + r as f32 * VISION;
                        painter.line_segment([egui::pos2(rect.left(), y), egui::pos2(rect.right(), y)], line);
                    }
                }
                let (pipe, binds) = sim.draw.as_ref().unwrap();
                painter.add(egui_wgpu::Callback::new_paint_callback(
                    rect,
                    DrawCb { pipe: pipe.clone(), bind: binds[sim.cur].clone(), n: sim.n },
                ));
                if self.paused {
                    painter.text(rect.left_top() + egui::vec2(12.0, 12.0), egui::Align2::LEFT_TOP, "一時停止中",
                        egui::FontId::proportional(20.0), egui::Color32::from_rgb(255, 160, 0));
                }
            });
        ui.ctx().request_repaint();
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--bench") {
        bench::bench();
        return;
    }
    if args.iter().any(|a| a == "--check") {
        let (adapter, device, queue) = headless();
        println!("GPU: {}", gpu_label(&adapter));
        for (name, dp, dv) in check(&device, &queue) {
            println!("{name}: 位置の最大ずれ {dp:.2e} px / 速度の最大ずれ {dv:.2e} px/s");
        }
        return;
    }

    // GPU が対応していればタイムスタンプを使えるようにして起動する
    let mut setup = egui_wgpu::WgpuSetupCreateNew::without_display_handle();
    let base = setup.device_descriptor.clone();
    setup.device_descriptor = Arc::new(move |adapter| {
        let mut d = base(adapter);
        d.required_features |= adapter.features() & wgpu::Features::TIMESTAMP_QUERY;
        d
    });
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default().with_inner_size([1280.0, 780.0]).with_title("boids"),
        renderer: eframe::Renderer::Wgpu,
        wgpu_options: egui_wgpu::WgpuConfiguration {
            wgpu_setup: egui_wgpu::WgpuSetup::CreateNew(setup),
            ..Default::default()
        },
        ..Default::default()
    };
    eframe::run_native("boids", options, Box::new(|cc| Ok(Box::new(App::new(cc))))).unwrap();
}
