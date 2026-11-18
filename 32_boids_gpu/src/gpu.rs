//! GPU 版の計算(wgpu + WGSL の compute shader。Mac では Metal で動く)。
//! 計算は cpu.rs の step と同じ式を src/shaders/boids.wgsl に移したもの。
//! macroquad は OpenGL で、Mac の OpenGL(4.1)には compute shader が無いので、wgpu で GPU を使う。

use crate::cpu::*;
use eframe::wgpu;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

pub const WG: u32 = 256; // ワークグループの大きさ(シェーダーの @workgroup_size と合わせる)
const MAX_CELLS: u32 = 128 * 128; // グリッドのマス数の上限(6400px 四方まで)

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct Params {
    n: u32,
    cols: u32,
    rows: u32,
    ncells: u32,
    bounds: [f32; 2],
    vision: f32,
    sep_dist: f32,
    min_speed: f32,
    max_speed: f32,
    dt: f32,
    _pad: f32,
}

fn grid_size_u32(bounds: [f32; 2]) -> (u32, u32) {
    let (cols, rows) = grid_size(bounds);
    (cols as u32, rows as u32)
}

// ---- GPU 側のシミュレーション ----

pub struct Timestamps {
    pub set: wgpu::QuerySet,
    pub resolve: wgpu::Buffer,
    pub read: wgpu::Buffer,
    pub period: f32,       // 1目盛りの ns
    pub busy: bool,        // 画面版: 読み戻しの最中
    pub ready: Arc<AtomicBool>,
}

pub struct Sim {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub n: u32,
    pub bounds: [f32; 2],
    pub cols: u32,
    pub rows: u32,
    params: wgpu::Buffer,
    pub bufs: [wgpu::Buffer; 2],
    binds: [wgpu::BindGroup; 2], // binds[k]: bufs[k] を読み、bufs[1-k] に書く
    pub cur: usize,                  // 今の状態が入っているほう
    brute: wgpu::ComputePipeline,
    clear: wgpu::ComputePipeline,
    count: wgpu::ComputePipeline,
    scan: wgpu::ComputePipeline,
    scatter: wgpu::ComputePipeline,
    grid: wgpu::ComputePipeline,
    pub draw: Option<(wgpu::RenderPipeline, [wgpu::BindGroup; 2])>,
    pub ts: Option<Timestamps>,
}

fn storage_entry(binding: u32, read_only: bool, vis: wgpu::ShaderStages) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: vis,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Storage { read_only },
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}

fn uniform_entry(vis: wgpu::ShaderStages) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding: 0,
        visibility: vis,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Uniform,
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}

impl Sim {
    /// target: 描画先の色の形式(画面版のみ)。ts_cap: タイムスタンプを置くステップ数(0 なら使わない)
    pub fn new(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        boids: &[Boid],
        bounds: [f32; 2],
        target: Option<wgpu::TextureFormat>,
        ts_cap: u32,
    ) -> Sim {
        let n = boids.len() as u32;
        let cs = wgpu::ShaderStages::COMPUTE;
        let buf = |label: &str, size: u64, usage: wgpu::BufferUsages| {
            device.create_buffer(&wgpu::BufferDescriptor { label: Some(label), size: size.max(16), usage, mapped_at_creation: false })
        };
        let st = wgpu::BufferUsages::STORAGE;
        let boid_usage = st | wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::COPY_SRC;
        let bufs = [buf("boids a", n as u64 * 16, boid_usage), buf("boids b", n as u64 * 16, boid_usage)];
        queue.write_buffer(&bufs[0], 0, bytemuck::cast_slice(boids));
        let params = buf("params", std::mem::size_of::<Params>() as u64, wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST);
        let counts = buf("counts", MAX_CELLS as u64 * 4, st);
        let start = buf("start", (MAX_CELLS as u64 + 1) * 4, st);
        let cell_of = buf("cell_of", n as u64 * 4, st);
        let rank = buf("rank", n as u64 * 4, st);
        let idx = buf("idx", n as u64 * 4, st);

        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("compute"),
            entries: &[
                uniform_entry(cs),
                storage_entry(1, true, cs),
                storage_entry(2, false, cs),
                storage_entry(3, false, cs),
                storage_entry(4, false, cs),
                storage_entry(5, false, cs),
                storage_entry(6, false, cs),
                storage_entry(7, false, cs),
            ],
        });
        let bind = |src: &wgpu::Buffer, dst: &wgpu::Buffer| {
            let list = [&params, src, dst, &counts, &start, &cell_of, &rank, &idx];
            let entries: Vec<wgpu::BindGroupEntry> = list
                .iter()
                .enumerate()
                .map(|(i, b)| wgpu::BindGroupEntry { binding: i as u32, resource: b.as_entire_binding() })
                .collect();
            device.create_bind_group(&wgpu::BindGroupDescriptor { label: None, layout: &layout, entries: &entries })
        };
        let binds = [bind(&bufs[0], &bufs[1]), bind(&bufs[1], &bufs[0])];

        let module = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("boids.wgsl"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/boids.wgsl").into()),
        });
        let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: None,
            bind_group_layouts: &[Some(&layout)],
            immediate_size: 0,
        });
        let pipe = |entry: &str| {
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                label: Some(entry),
                layout: Some(&pl),
                module: &module,
                entry_point: Some(entry),
                compilation_options: Default::default(),
                cache: None,
            })
        };

        let draw = target.map(|format| {
            let vs = wgpu::ShaderStages::VERTEX;
            let dl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("draw"),
                entries: &[uniform_entry(vs), storage_entry(1, true, vs)],
            });
            let dmod = device.create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some("draw.wgsl"),
                source: wgpu::ShaderSource::Wgsl(include_str!("shaders/draw.wgsl").into()),
            });
            let dpl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: None,
                bind_group_layouts: &[Some(&dl)],
                immediate_size: 0,
            });
            let rp = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("draw"),
                layout: Some(&dpl),
                vertex: wgpu::VertexState {
                    module: &dmod,
                    entry_point: Some("vs_main"),
                    compilation_options: Default::default(),
                    buffers: &[],
                },
                primitive: Default::default(),
                depth_stencil: None,
                multisample: Default::default(),
                fragment: Some(wgpu::FragmentState {
                    module: &dmod,
                    entry_point: Some("fs_main"),
                    compilation_options: Default::default(),
                    targets: &[Some(format.into())],
                }),
                multiview_mask: None,
                cache: None,
            });
            let dbind = |b: &wgpu::Buffer| {
                device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: None,
                    layout: &dl,
                    entries: &[
                        wgpu::BindGroupEntry { binding: 0, resource: params.as_entire_binding() },
                        wgpu::BindGroupEntry { binding: 1, resource: b.as_entire_binding() },
                    ],
                })
            };
            (rp, [dbind(&bufs[0]), dbind(&bufs[1])])
        });

        let ts = (ts_cap > 0 && device.features().contains(wgpu::Features::TIMESTAMP_QUERY)).then(|| {
            let count = ts_cap * 2;
            Timestamps {
                set: device.create_query_set(&wgpu::QuerySetDescriptor { label: None, ty: wgpu::QueryType::Timestamp, count }),
                resolve: buf("ts resolve", count as u64 * 8, wgpu::BufferUsages::QUERY_RESOLVE | wgpu::BufferUsages::COPY_SRC),
                read: buf("ts read", count as u64 * 8, wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST),
                period: queue.get_timestamp_period(),
                busy: false,
                ready: Arc::new(AtomicBool::new(false)),
            }
        });

        let mut sim = Sim {
            device: device.clone(),
            queue: queue.clone(),
            n,
            bounds,
            cols: 1,
            rows: 1,
            params,
            bufs,
            binds,
            cur: 0,
            brute: pipe("step_brute"),
            clear: pipe("grid_clear"),
            count: pipe("grid_count"),
            scan: pipe("grid_scan"),
            scatter: pipe("grid_scatter"),
            grid: pipe("step_grid"),
            draw,
            ts,
        };
        sim.set_bounds(bounds);
        sim
    }

    pub fn ncells(&self) -> u32 {
        self.cols * self.rows
    }

    pub fn set_bounds(&mut self, bounds: [f32; 2]) {
        self.bounds = bounds;
        let (cols, rows) = grid_size_u32(bounds);
        assert!(cols * rows <= MAX_CELLS, "画面が広すぎます({cols}×{rows} マス)");
        (self.cols, self.rows) = (cols, rows);
        let p = Params {
            n: self.n,
            cols,
            rows,
            ncells: cols * rows,
            bounds,
            vision: VISION,
            sep_dist: SEP_DIST,
            min_speed: MIN_SPEED,
            max_speed: MAX_SPEED,
            dt: DT,
            _pad: 0.0,
        };
        self.queue.write_buffer(&self.params, 0, bytemuck::bytes_of(&p));
    }

    /// 1ステップ分の計算を encoder に積む。ts_slot を渡すと、このパスの始めと終わりの時刻を記録する。
    /// グリッド版の5つのカーネルは同じパスに積む(各 dispatch の書き込みは次の dispatch から見える)。
    pub fn encode_step(&mut self, enc: &mut wgpu::CommandEncoder, use_grid: bool, ts_slot: Option<u32>) {
        let tw = match (&self.ts, ts_slot) {
            (Some(t), Some(k)) => Some(wgpu::ComputePassTimestampWrites {
                query_set: &t.set,
                beginning_of_pass_write_index: Some(2 * k),
                end_of_pass_write_index: Some(2 * k + 1),
            }),
            _ => None,
        };
        let mut pass = enc.begin_compute_pass(&wgpu::ComputePassDescriptor { label: None, timestamp_writes: tw });
        pass.set_bind_group(0, &self.binds[self.cur], &[]);
        let groups = self.n.div_ceil(WG);
        if use_grid {
            pass.set_pipeline(&self.clear);
            pass.dispatch_workgroups(self.ncells().div_ceil(WG), 1, 1);
            pass.set_pipeline(&self.count);
            pass.dispatch_workgroups(groups, 1, 1);
            pass.set_pipeline(&self.scan);
            pass.dispatch_workgroups(1, 1, 1);
            pass.set_pipeline(&self.scatter);
            pass.dispatch_workgroups(groups, 1, 1);
            pass.set_pipeline(&self.grid);
            pass.dispatch_workgroups(groups, 1, 1);
        } else {
            pass.set_pipeline(&self.brute);
            pass.dispatch_workgroups(groups, 1, 1);
        }
        drop(pass);
        self.cur ^= 1;
    }

    /// CPU で計算した状態を、描画用に今のバッファへ送る
    pub fn upload(&self, boids: &[Boid]) {
        self.queue.write_buffer(&self.bufs[self.cur], 0, bytemuck::cast_slice(boids));
    }

    /// 1ステップを送って、終わるまで待つ
    pub fn step_wait(&mut self, use_grid: bool) {
        let mut enc = self.device.create_command_encoder(&Default::default());
        self.encode_step(&mut enc, use_grid, None);
        self.queue.submit([enc.finish()]);
        self.device.poll(wgpu::PollType::wait_indefinitely()).unwrap();
    }

    /// 0..k 番のタイムスタンプを読み戻して、各ステップの計算時間(ms)にする(待つ版)
    pub fn read_ts_blocking(&self, k: u32) -> Vec<f32> {
        let t = self.ts.as_ref().unwrap();
        let mut enc = self.device.create_command_encoder(&Default::default());
        enc.resolve_query_set(&t.set, 0..2 * k, &t.resolve, 0);
        enc.copy_buffer_to_buffer(&t.resolve, 0, &t.read, 0, k as u64 * 16);
        self.queue.submit([enc.finish()]);
        t.read.map_async(wgpu::MapMode::Read, .., |_| {});
        self.device.poll(wgpu::PollType::wait_indefinitely()).unwrap();
        let v = ts_to_ms(&t.read.get_mapped_range(..k as u64 * 16), t.period);
        t.read.unmap();
        v
    }

    /// 今の状態を CPU に読み戻す(突き合わせ用)
    pub fn read_boids(&self) -> Vec<Boid> {
        let size = self.n as u64 * 16;
        let rb = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let mut enc = self.device.create_command_encoder(&Default::default());
        enc.copy_buffer_to_buffer(&self.bufs[self.cur], 0, &rb, 0, size);
        self.queue.submit([enc.finish()]);
        rb.map_async(wgpu::MapMode::Read, .., |_| {});
        self.device.poll(wgpu::PollType::wait_indefinitely()).unwrap();
        let v = bytemuck::cast_slice::<u8, Boid>(&rb.get_mapped_range(..)).to_vec();
        v
    }
}

pub fn ts_to_ms(bytes: &[u8], period: f32) -> Vec<f32> {
    bytemuck::cast_slice::<u8, u64>(bytes)
        .chunks(2)
        .map(|p| p[1].saturating_sub(p[0]) as f32 * period / 1e6)
        .collect()
}

// ---- 画面なしの GPU(計測・突き合わせ用) ----

pub fn headless() -> (wgpu::Adapter, wgpu::Device, wgpu::Queue) {
    let instance = wgpu::Instance::default();
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        ..Default::default()
    }))
    .expect("GPU が見つかりません");
    let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
        label: None,
        required_features: adapter.features() & wgpu::Features::TIMESTAMP_QUERY,
        ..Default::default()
    }))
    .expect("GPU の初期化に失敗しました");
    (adapter, device, queue)
}

/// 1ステップ目を CPU と突き合わせる。戻り値: (方式, 位置の最大ずれ, 速度の最大ずれ)
pub fn check(device: &wgpu::Device, queue: &wgpu::Queue) -> Vec<(&'static str, f32, f32)> {
    let bounds = [923.0, 781.0]; // マス幅で割り切れない大きさも試す
    let boids = make_boids(5000, bounds, 1);
    let want: Vec<Boid> = (0..boids.len()).map(|i| step(i, &boids, bounds, 0..boids.len())).collect();
    let mut out = Vec::new();
    for (name, use_grid) in [("総当たり", false), ("グリッド", true)] {
        let mut sim = Sim::new(device, queue, &boids, bounds, None, 0);
        sim.step_wait(use_grid);
        let got = sim.read_boids();
        let (mut dp, mut dv) = (0.0f32, 0.0f32);
        for (g, w) in got.iter().zip(&want) {
            // 画面端で折り返した側と折り返していない側に分かれた場合は、端からの距離で比べる
            let wrap = |a: f32, b: f32, m: f32| {
                let d = (a - b).abs();
                d.min(m - d)
            };
            dp = dp.max(wrap(g[0], w[0], bounds[0]).hypot(wrap(g[1], w[1], bounds[1])));
            dv = dv.max((g[2] - w[2]).hypot(g[3] - w[3]));
        }
        out.push((name, dp, dv));
    }
    out
}

