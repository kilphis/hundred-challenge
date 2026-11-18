//! CPU 版の計算(day26 の step / Grid / update をそのまま移したもの)。
//! day26 は macroquad の Vec2 を使っていたが、GPU と同じ形で持つため Boid = [pos.x, pos.y, vel.x, vel.y] にした。

use rayon::prelude::*;
use std::time::Instant;

// ---- 調整用パラメータ ----
pub const VISION: f32 = 50.0; // この距離以内の仲間だけを見る
pub const SEP_DIST: f32 = 15.0; // これより近いと離れようとする
pub const MIN_SPEED: f32 = 60.0;
pub const MAX_SPEED: f32 = 200.0;
pub const DT: f32 = 1.0 / 60.0; // 固定の時間刻み(実フレーム時間に依存させない)

/// Boid = [pos.x, pos.y, vel.x, vel.y](GPU のバッファと同じ並び)
pub type Boid = [f32; 4];

/// 条件ごとに同じ初期配置にするための簡単な乱数(xorshift)
pub fn make_boids(n: usize, bounds: [f32; 2], seed: u64) -> Vec<Boid> {
    let mut s = seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1;
    let mut rnd = || {
        s ^= s << 13;
        s ^= s >> 7;
        s ^= s << 17;
        (s >> 40) as f32 / (1u64 << 24) as f32
    };
    (0..n)
        .map(|_| {
            let (x, y) = (rnd() * bounds[0], rnd() * bounds[1]);
            let a = rnd() * std::f32::consts::TAU;
            [x, y, a.cos() * 100.0, a.sin() * 100.0]
        })
        .collect()
}

/// i番目のBoidの「次の状態」を計算する。
/// old(前フレームの全員)を読むだけで、何も書き換えない → 各iが完全に独立 → 並列化できる。
/// near: 調べる相手の番号。総当たりなら 0..N、グリッドなら近くの9マスにいる分だけ。
pub fn step(i: usize, old: &[Boid], bounds: [f32; 2], near: impl Iterator<Item = usize>) -> Boid {
    let me = old[i];
    let (mut sx, mut sy) = (0.0f32, 0.0f32); // 離れる
    let (mut ax, mut ay) = (0.0f32, 0.0f32); // 揃える
    let (mut cx, mut cy) = (0.0f32, 0.0f32); // 寄る
    let mut count = 0u32;

    for j in near {
        if j == i {
            continue;
        }
        let o = old[j];
        let (dx, dy) = (o[0] - me[0], o[1] - me[1]);
        let dist2 = dx * dx + dy * dy;
        if dist2 < VISION * VISION {
            count += 1;
            ax += o[2];
            ay += o[3];
            cx += o[0];
            cy += o[1];
            if dist2 < SEP_DIST * SEP_DIST {
                sx -= dx;
                sy -= dy;
            }
        }
    }

    let (mut vx, mut vy) = (me[2], me[3]);
    if count > 0 {
        let n = count as f32;
        let (alx, aly) = (ax / n - me[2], ay / n - me[3]); // 平均速度との差
        let (cox, coy) = (cx / n - me[0], cy / n - me[1]); // 仲間の重心への向き
        vx += (alx * 2.0 + cox * 0.5 + sx * 20.0) * DT;
        vy += (aly * 2.0 + coy * 0.5 + sy * 20.0) * DT;
    }
    let len = (vx * vx + vy * vy).sqrt();
    let speed = len.clamp(MIN_SPEED, MAX_SPEED);
    if len > 0.0 {
        (vx, vy) = (vx / len * speed, vy / len * speed);
    }

    // 画面の端はつながっている(トーラス)ことにする
    let px = (me[0] + vx * DT).rem_euclid(bounds[0]);
    let py = (me[1] + vy * DT).rem_euclid(bounds[1]);
    [px, py, vx, vy]
}

pub fn grid_size(bounds: [f32; 2]) -> (usize, usize) {
    let cols = (bounds[0] / VISION).ceil().max(1.0) as usize;
    let rows = (bounds[1] / VISION).ceil().max(1.0) as usize;
    (cols, rows)
}

/// 空間グリッド: 画面を一辺 VISION のマスに区切り、各マスにいるBoidの番号をまとめて持つ。
/// idx を「マス番号順」に並べ、start[c]..start[c+1] がマス c の範囲(数え上げソート)。
pub struct Grid {
    cols: usize,
    rows: usize,
    start: Vec<usize>,
    idx: Vec<usize>,
    cell: Vec<usize>, // 各Boidのマス番号(作業用)
}

impl Grid {
    pub fn new() -> Grid {
        Grid { cols: 1, rows: 1, start: Vec::new(), idx: Vec::new(), cell: Vec::new() }
    }

    fn cell_xy(&self, p: &Boid) -> (usize, usize) {
        let cx = ((p[0] / VISION) as usize).min(self.cols - 1);
        let cy = ((p[1] / VISION) as usize).min(self.rows - 1);
        (cx, cy)
    }

    /// 毎フレーム作り直す。
    /// マス番号を求める部分は各Boidで独立なので並列にできる。
    /// マスへの振り分けは全員が同じ配列に書くので、ここでは単一スレッドで行う。
    pub fn build(&mut self, boids: &[Boid], bounds: [f32; 2], parallel: bool) {
        (self.cols, self.rows) = grid_size(bounds);
        let (cols, rows) = (self.cols, self.rows);
        let cell_of = |b: &Boid| {
            let cx = ((b[0] / VISION) as usize).min(cols - 1);
            let cy = ((b[1] / VISION) as usize).min(rows - 1);
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
    pub fn near(&self, p: &Boid) -> impl Iterator<Item = usize> + '_ {
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

/// 1ステップ進める: a(今)を読んで b(次)に書く。
/// 戻り値はグリッド版の格子づくりにかかった時間(ms)。総当たり版は 0。
pub fn update(a: &[Boid], b: &mut [Boid], grid: &mut Grid, bounds: [f32; 2], parallel: bool, use_grid: bool) -> f32 {
    if use_grid {
        let t = Instant::now();
        grid.build(a, bounds, parallel);
        let build_ms = t.elapsed().as_secs_f32() * 1000.0;
        let g = &*grid;
        let f = |(i, nb): (usize, &mut Boid)| *nb = step(i, a, bounds, g.near(&a[i]));
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

#[cfg(test)]
mod tests {
    use super::*;

    /// グリッド版は総当たり版と同じ相手を見ている → 次の状態が(足し算の順番による誤差を除いて)一致する
    #[test]
    fn grid_matches_brute_force() {
        let bounds = [923.0, 781.0]; // マス幅で割り切れない大きさも試す
        let boids = make_boids(5000, bounds, 7);
        let mut grid = Grid::new();
        grid.build(&boids, bounds, true);
        for i in 0..boids.len() {
            let x = step(i, &boids, bounds, 0..boids.len());
            let y = step(i, &boids, bounds, grid.near(&boids[i]));
            assert!((x[0] - y[0]).hypot(x[1] - y[1]) < 1e-3, "i={i}");
            assert!((x[2] - y[2]).hypot(x[3] - y[3]) < 1e-2, "i={i}");
        }
    }
}
