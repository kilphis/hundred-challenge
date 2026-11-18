//! 計測モード(cargo run --release -- --bench)。CPU(単一・rayon)と GPU を同じ条件で測り、bench.md に書く。

use crate::cpu::*;
use crate::gpu::*;
use eframe::wgpu;
use std::time::Instant;

const CPU_NS: [usize; 5] = [1000, 2000, 4000, 8000, 16000];
// GPU は 64000 まで延ばす。それより大きいと1ステップが数百 ms を超え、画面ごと固まることがある
const GPU_NS: [usize; 6] = [1000, 2000, 4000, 8000, 16000, 64000];
const BENCH_THREADS: [usize; 6] = [1, 2, 4, 6, 8, 10];
const BENCH_BOUNDS: [f32; 2] = [920.0, 780.0]; // 既定のウィンドウでの左の画面の大きさ

fn median(mut v: Vec<f32>) -> f32 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

/// CPU 1条件の更新時間(ms/ステップ)。
/// 他のアプリやOSのスレッド割り当て(Pコア/Eコア)で揺れるので、3回測って一番速い中央値を採る。
fn cpu_one(n: usize, threads: Option<usize>, use_grid: bool) -> f32 {
    (0..3).map(|_| cpu_median(n, threads, use_grid)).fold(f32::MAX, f32::min)
}

/// 1回分の計測: 更新時間(ms/ステップ)の中央値。
/// threads = None は rayon を使わない単一スレッド版。Some(t) は t スレッドの rayon プールで並列版。
fn cpu_median(n: usize, threads: Option<usize>, use_grid: bool) -> f32 {
    let mut a = make_boids(n, BENCH_BOUNDS, n as u64); // 条件ごとに同じ初期配置
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
    median(ms)
}

/// GPU 1条件の計測。戻り値: (GPU の計算時間 ms, CPU から見た待ち時間 ms)。どちらも中央値。
fn gpu_one(device: &wgpu::Device, queue: &wgpu::Queue, n: usize, use_grid: bool) -> (Option<f32>, f32) {
    let boids = make_boids(n, BENCH_BOUNDS, n as u64);
    let mut best: (Option<f32>, f32) = (None, f32::MAX);
    for _ in 0..3 {
        let mut sim = Sim::new(device, queue, &boids, BENCH_BOUNDS, None, 64);
        for _ in 0..3 {
            sim.step_wait(use_grid); // 慣らし
        }
        // CPU から見た待ち時間: 積む → 送る → 終わるまで待つ、を1ステップずつ
        let mut wall = Vec::new();
        let mut total = 0.0;
        while (total < 200.0 || wall.len() < 5) && wall.len() < 200 {
            let t = Instant::now();
            sim.step_wait(use_grid);
            let ms = t.elapsed().as_secs_f32() * 1000.0;
            total += ms;
            wall.push(ms);
        }
        let k = wall.len().min(64) as u32;
        let wall = median(wall);
        // GPU の計算時間: k ステップをまとめて送り、各パスの始めと終わりの時刻差を取る
        let gpu = sim.ts.is_some().then(|| {
            let mut enc = device.create_command_encoder(&Default::default());
            for s in 0..k {
                sim.encode_step(&mut enc, use_grid, Some(s));
            }
            queue.submit([enc.finish()]);
            median(sim.read_ts_blocking(k))
        });
        if wall < best.1 {
            best = (gpu, wall);
        }
    }
    best
}

pub fn sh(cmd: &str, args: &[&str]) -> String {
    std::process::Command::new(cmd)
        .args(args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}

fn fmt_ms(v: Option<f32>) -> String {
    match v {
        Some(m) if m < 0.1 => format!("{m:.3}"),
        Some(m) => format!("{m:.2}"),
        None => "-".into(),
    }
}

pub fn bench() {
    let (adapter, device, queue) = headless();
    let gpu = crate::gpu_label(&adapter);
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    let threads: Vec<usize> = BENCH_THREADS.iter().copied().filter(|&t| t <= cores).collect();
    let mut md = String::new();
    md += "# Boids 計測結果\n\n";
    md += &format!("- 日時: {}\n", sh("date", &["+%Y-%m-%d %H:%M"]));
    md += &format!("- CPU: {}\n", crate::cpu_label());
    md += &format!("- GPU: {gpu}\n");
    md += &format!("- 画面(動ける範囲): {}×{} px、マス幅 {} px\n", BENCH_BOUNDS[0], BENCH_BOUNDS[1], VISION);
    md += "- CPU の値: 1ステップの更新時間(ms)。各条件を3回測り、中央値が一番速かった回を採用。グリッド版は格子づくりを含む\n";
    md += "- 「単一」= rayon を使わない版。数字の列 = rayon のスレッド数\n";
    md += "- GPU の「計算」= GPU のタイムスタンプで測った計算パスの始めから終わりまで。「待ち込み」= CPU から見て、送ってから終わるのを待つまで\n";

    // ---- CPU ----
    // res[g][ni] = (単一, [各スレッド数])
    let mut res: Vec<Vec<(f32, Vec<f32>)>> = Vec::new();
    for use_grid in [false, true] {
        let name = if use_grid { "グリッド" } else { "総当たり" };
        let mut rows = Vec::new();
        for &n in &CPU_NS {
            let single = cpu_one(n, None, use_grid);
            let par: Vec<f32> = threads.iter().map(|&t| cpu_one(n, Some(t), use_grid)).collect();
            let line: Vec<String> = par.iter().map(|m| format!("{m:.2}")).collect();
            println!("CPU {name} N={n:>5}  単一 {single:>8.2} ms  | {}", line.join("  "));
            rows.push((single, par));
        }
        res.push(rows);
    }

    // ---- GPU ----
    let checks = check(&device, &queue);
    let mut gres = Vec::new(); // (N, 総当たり, グリッド)
    for &n in &GPU_NS {
        let b = gpu_one(&device, &queue, n, false);
        let g = gpu_one(&device, &queue, n, true);
        println!("GPU N={n:>6}  総当たり 計算 {} / 待ち込み {:.2} ms  | グリッド 計算 {} / 待ち込み {:.2} ms",
            fmt_ms(b.0), b.1, fmt_ms(g.0), g.1);
        gres.push((n, b, g));
    }

    // ---- 表 ----
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
        md += &format!("\n## CPU {name}: 更新時間 (ms)\n\n");
        md += &head("N");
        for (ni, (single, par)) in res[g].iter().enumerate() {
            md += &format!("| {} | {single:.2} |", CPU_NS[ni]);
            for m in par {
                md += &format!(" {m:.2} |");
            }
            md += "\n";
        }
        md += &format!("\n## CPU {name}: 速度向上率(単一 ÷ 各列)\n\n");
        md += &head("N");
        for (ni, (single, par)) in res[g].iter().enumerate() {
            md += &format!("| {} | 1.00 |", CPU_NS[ni]);
            for m in par {
                md += &format!(" {:.2} |", single / m);
            }
            md += "\n";
        }
    }
    md += "\n## CPU グリッド化の効果(総当たり ÷ グリッド、同じ実行方式どうし)\n\n";
    md += &head("N");
    for ni in 0..CPU_NS.len() {
        let (bs, bp) = &res[0][ni];
        let (gs, gp) = &res[1][ni];
        md += &format!("| {} | {:.1} |", CPU_NS[ni], bs / gs);
        for (x, y) in bp.iter().zip(gp) {
            md += &format!(" {:.1} |", x / y);
        }
        md += "\n";
    }

    md += "\n## GPU: 更新時間 (ms)\n\n";
    md += "| N | 総当たり 計算 | 総当たり 待ち込み | グリッド 計算 | グリッド 待ち込み |\n|---:|---:|---:|---:|---:|\n";
    for (n, b, g) in &gres {
        md += &format!("| {n} | {} | {} | {} | {} |\n", fmt_ms(b.0), fmt_ms(Some(b.1)), fmt_ms(g.0), fmt_ms(Some(g.1)));
    }

    for (gi, name) in ["総当たり", "グリッド"].iter().enumerate() {
        md += &format!("\n## CPU と GPU の比較: {name} (ms、倍率 = CPU 並列の最速 ÷ GPU 待ち込み)\n\n");
        md += "| N | CPU 単一 | CPU 並列の最速 | GPU 計算 | GPU 待ち込み | 倍率 |\n|---:|---:|---:|---:|---:|---:|\n";
        for (n, b, g) in &gres {
            let r = if gi == 0 { b } else { g };
            match CPU_NS.iter().position(|c| c == n) {
                Some(ni) => {
                    let (s, par) = &res[gi][ni];
                    let p = par.iter().copied().fold(f32::MAX, f32::min);
                    md += &format!("| {n} | {s:.2} | {p:.2} | {} | {} | {:.1} |\n", fmt_ms(r.0), fmt_ms(Some(r.1)), p / r.1);
                }
                None => md += &format!("| {n} | - | - | {} | {} | - |\n", fmt_ms(r.0), fmt_ms(Some(r.1))),
            }
        }
    }

    md += "\n## GPU の1ステップ目を CPU と突き合わせ(N=5000、923×781 px、最大のずれ)\n\n";
    md += "| 方式 | 位置 (px) | 速度 (px/s) |\n|---|---:|---:|\n";
    for (name, dp, dv) in &checks {
        md += &format!("| {name} | {dp:.2e} | {dv:.2e} |\n");
    }

    std::fs::write("bench.md", &md).unwrap();
    println!("\nbench.md に保存しました");
}
