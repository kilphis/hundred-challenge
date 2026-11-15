// lab.js — 計算とデータ生成(DOMに触らない。node からも読める)
(function (G) {
const L = {};

// ---------- 乱数 ----------
L.rng = function (seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
L.gauss = function (r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
L.poisson = function (r, lam) {
  if (lam < 30) { const e = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r(); } while (p > e); return k - 1; }
  return Math.max(0, Math.round(lam + Math.sqrt(lam) * L.gauss(r)));
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
L.clamp = clamp;

// ---------- 2D 画像処理 ----------
function conv1(src, w, h, k, horiz) {
  const r = (k.length - 1) >> 1, out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -r; i <= r; i++) {
      const xx = horiz ? clamp(x + i, 0, w - 1) : x, yy = horiz ? y : clamp(y + i, 0, h - 1);
      a += src[yy * w + xx] * k[i + r];
    }
    out[y * w + x] = a;
  }
  return out;
}
L.gaussBlur = function (src, w, h, s) {
  if (s <= 0) return Float32Array.from(src);
  const r = Math.ceil(s * 3), k = new Float32Array(2 * r + 1); let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * s * s)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return conv1(conv1(src, w, h, k, true), w, h, k, false);
};
L.boxBlur = function (src, w, h, size) {
  const k = new Float32Array(size).fill(1 / size);
  return conv1(conv1(src, w, h, k, true), w, h, k, false);
};
L.median = function (src, w, h, size) {
  const r = size >> 1, out = new Float32Array(w * h), buf = new Float32Array(size * size);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) buf[n++] = src[clamp(y + j, 0, h - 1) * w + clamp(x + i, 0, w - 1)];
    const s = buf.subarray(0, n).sort(); out[y * w + x] = s[n >> 1];
  }
  return out;
};
L.conv = function (src, w, h, ker, k) {
  const r = k >> 1, out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0, n = 0;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) a += ker[n++] * src[clamp(y + j, 0, h - 1) * w + clamp(x + i, 0, w - 1)];
    out[y * w + x] = a;
  }
  return out;
};
L.psnr = function (a, b) {
  let m = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; m += d * d; }
  m /= a.length; return 10 * Math.log10(1 / m);
};
L.solve = function (A, b, n) { // ガウスの消去法(部分ピボット)。A は n*n の配列(破壊する)
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r;
    if (p !== c) { for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; } const t = b[c]; b[c] = b[p]; b[p] = t; }
    const d = A[c * n + c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / d; if (!f) continue;
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r * n + k] * x[k]; x[r] = s / (A[r * n + r] || 1e-12); }
  return x;
};
// Noise2Noise(線形 k×k フィルタ): 1枚目のノイズ画像の近傍から、2枚目のノイズ画像の画素を当てる最小二乗
L.n2nTrain = function (n1, n2, w, h, k) {
  const r = k >> 1, m = k * k, A = new Float64Array(m * m), b = new Float64Array(m), p = new Float64Array(m);
  for (let y = r; y < h - r; y++) for (let x = r; x < w - r; x++) {
    let n = 0;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) p[n++] = n1[(y + j) * w + x + i];
    const t = n2[y * w + x];
    for (let a = 0; a < m; a++) { const pa = p[a]; b[a] += pa * t; for (let c = a; c < m; c++) A[a * m + c] += pa * p[c]; }
  }
  for (let a = 0; a < m; a++) for (let c = 0; c < a; c++) A[a * m + c] = A[c * m + a];
  for (let a = 0; a < m; a++) A[a * m + a] *= 1.0001;
  return Float32Array.from(L.solve(Array.from(A), Array.from(b), m));
};
L.gradMag = function (src, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = src[y * w + clamp(x + 1, 0, w - 1)] - src[y * w + clamp(x - 1, 0, w - 1)];
    const gy = src[clamp(y + 1, 0, h - 1) * w + x] - src[clamp(y - 1, 0, h - 1) * w + x];
    out[y * w + x] = Math.hypot(gx, gy) / 2;
  }
  return out;
};

// ---------- β細胞の3D-EM ファントム ----------
function hash3(x, y, z, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  let v = 0;
  for (let c = 0; c < 8; c++) {
    const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
    v += hash3(xi + dx, yi + dy, zi + dz, s) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
  }
  return v - 0.5;
}
L.makePhantom = function (seed, W, H, D) {
  const r = L.rng(seed), mitos = [], grans = [];
  for (let i = 0; i < Math.round(W * H / 4000); i++)
    mitos.push({ x: 12 + r() * (W - 24), y: 12 + r() * (H - 24), z: r() * D, a: 15 + r() * 10, b: 7 + r() * 3, c: 9 + r() * 6, t: r() * Math.PI });
  const inMito = (x, y, z, pad) => mitos.some(m => {
    const dx = x - m.x, dy = y - m.y, ct = Math.cos(m.t), st = Math.sin(m.t);
    const u = dx * ct + dy * st, v = -dx * st + dy * ct, dz = z - m.z;
    return (u / (m.a + pad)) ** 2 + (v / (m.b + pad)) ** 2 + (dz / (m.c + pad)) ** 2 < 1;
  });
  const want = Math.round(W * H / 1100);
  for (let t = 0; t < want * 40 && grans.length < want; t++) {
    const R = 3.5 + r() * 2.5, x = R + r() * (W - 2 * R), y = R + r() * (H - 2 * R), z = r() * D;
    if (inMito(x, y, z, R + 2)) continue;
    if (grans.some(g => Math.hypot(g.x - x, g.y - y, g.z - z) < g.R + R + 2)) continue;
    grans.push({ x, y, z, R });
  }
  return { W, H, D, mitos, grans, seed };
};
// スライス z を (ox,oy) から w×h で切り出す。mask: 1=ミトコンドリア 2=分泌顆粒
L.renderSlice = function (ph, z, ox, oy, w, h, noise, nseed) {
  const img = new Float32Array(w * h), mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    img[y * w + x] = 0.63 + 0.12 * vnoise((x + ox) / 7, (y + oy) / 7, z / 7, ph.seed) + 0.025 * vnoise((x + ox) / 2.5, (y + oy) / 2.5, z / 6, ph.seed + 1);
  for (const m of ph.mitos) {
    const dz = (z - m.z) / m.c; if (Math.abs(dz) >= 1) continue;
    const s = Math.sqrt(1 - dz * dz), a = m.a * s, b = m.b * s, ct = Math.cos(m.t), st = Math.sin(m.t);
    if (b < 1.5) continue;
    const x0 = Math.max(0, Math.floor(m.x - ox - a - 1)), x1 = Math.min(w - 1, Math.ceil(m.x - ox + a + 1));
    const y0 = Math.max(0, Math.floor(m.y - oy - a - 1)), y1 = Math.min(h - 1, Math.ceil(m.y - oy + a + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + ox - m.x, dy = y + oy - m.y, u = dx * ct + dy * st, v = -dx * st + dy * ct;
      const q = Math.sqrt((u / a) ** 2 + (v / b) ** 2); if (q >= 1) continue;
      const d = (1 - q) * b, i = y * w + x;
      mask[i] = 1;
      if (d < 1.4) img[i] = 0.24;
      else img[i] = (d > 2.2 && Math.cos(u * 0.85) > 0.55) ? 0.3 : 0.5;
    }
  }
  for (const g of ph.grans) {
    const dz = z - g.z; if (Math.abs(dz) >= g.R) continue;
    const rr = Math.sqrt(g.R * g.R - dz * dz);
    const x0 = Math.max(0, Math.floor(g.x - ox - rr - 1)), x1 = Math.min(w - 1, Math.ceil(g.x - ox + rr + 1));
    const y0 = Math.max(0, Math.floor(g.y - oy - rr - 1)), y1 = Math.min(h - 1, Math.ceil(g.y - oy + rr + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = Math.hypot(x + ox - g.x, y + oy - g.y); if (p >= rr) continue;
      const i = y * w + x; mask[i] = 2;
      img[i] = p < rr * 0.55 ? 0.12 : p > rr - 1.1 ? 0.32 : 0.88;
    }
  }
  const sm = L.gaussBlur(img, w, h, 0.7);
  if (noise > 0) { const r = L.rng(nseed); for (let i = 0; i < sm.length; i++) sm[i] += noise * L.gauss(r); }
  return { img: sm, mask };
};
// 正規化相互相関マップ(±R)。b を (dx,dy) ずらしたとき a とどれだけ似るか
L.nccMap = function (a, b, w, h, R) {
  const n = 2 * R + 1, out = new Float32Array(n * n);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, c = 0;
    for (let y = R; y < h - R; y += 2) for (let x = R; x < w - R; x += 2) {
      const va = a[y * w + x], vb = b[(y - dy) * w + (x - dx)];
      sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb; c++;
    }
    const cov = sab / c - sa / c * sb / c, va = saa / c - (sa / c) ** 2, vb = sbb / c - (sb / c) ** 2;
    out[(dy + R) * n + dx + R] = cov / Math.sqrt(va * vb + 1e-12);
  }
  return out;
};

// ---------- セグメンテーション(ロジスティック回帰) ----------
L.FEATURES = [
  { id: 'raw', name: '輝度そのもの' },
  { id: 'g1', name: 'ぼかし σ=1' },
  { id: 'g3', name: 'ぼかし σ=3' },
  { id: 'g6', name: 'ぼかし σ=6' },
  { id: 'grad', name: '勾配の強さ(σ=1)' },
  { id: 'var', name: '局所のばらつき(σ=3)' },
  { id: 'dog', name: 'DoG(σ1 − σ3)' },
];
L.featureMaps = function (img, w, h) {
  const g1 = L.gaussBlur(img, w, h, 1), g3 = L.gaussBlur(img, w, h, 3), g6 = L.gaussBlur(img, w, h, 6);
  const sq = img.map(v => v * v), e2 = L.gaussBlur(sq, w, h, 3), vr = new Float32Array(w * h), dog = new Float32Array(w * h);
  for (let i = 0; i < vr.length; i++) { vr[i] = Math.sqrt(Math.max(0, e2[i] - g3[i] * g3[i])); dog[i] = g1[i] - g3[i]; }
  const grad = L.gaussBlur(L.gradMag(g1, w, h), w, h, 1);
  return { raw: img, g1, g3, g6, grad, var: vr, dog };
};
L.trainLogistic = function (maps, ids, idx, ys) {
  const f = ids.length, mu = new Float64Array(f), sd = new Float64Array(f);
  ids.forEach((id, k) => {
    const m = maps[id]; let s = 0, s2 = 0;
    for (let i = 0; i < m.length; i++) { s += m[i]; s2 += m[i] * m[i]; }
    mu[k] = s / m.length; sd[k] = Math.sqrt(Math.max(1e-12, s2 / m.length - mu[k] * mu[k]));
  });
  const n = idx.length, X = new Float64Array(n * f);
  for (let j = 0; j < n; j++) ids.forEach((id, k) => { X[j * f + k] = (maps[id][idx[j]] - mu[k]) / sd[k]; });
  let pos = 0; for (const y of ys) pos += y;
  const wPos = n / (2 * Math.max(1, pos)), wNeg = n / (2 * Math.max(1, n - pos));
  const wt = new Float64Array(f + 1), g = new Float64Array(f + 1);
  for (let it = 0; it < 400; it++) {
    g.fill(0);
    for (let j = 0; j < n; j++) {
      let z = wt[f]; for (let k = 0; k < f; k++) z += wt[k] * X[j * f + k];
      const p = 1 / (1 + Math.exp(-z)), e = (p - ys[j]) * (ys[j] ? wPos : wNeg);
      for (let k = 0; k < f; k++) g[k] += e * X[j * f + k];
      g[f] += e;
    }
    for (let k = 0; k <= f; k++) wt[k] -= 0.5 * (g[k] / n + (k < f ? 0.001 * wt[k] : 0));
  }
  return { ids, mu, sd, wt };
};
L.predict = function (model, maps, N) {
  const { ids, mu, sd, wt } = model, f = ids.length, out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let z = wt[f]; for (let k = 0; k < f; k++) z += wt[k] * (maps[ids[k]][i] - mu[k]) / sd[k];
    out[i] = 1 / (1 + Math.exp(-z));
  }
  return out;
};
L.dice = function (pred, gt) { let a = 0, b = 0, c = 0; for (let i = 0; i < gt.length; i++) { a += pred[i] && gt[i]; b += pred[i] ? 1 : 0; c += gt[i] ? 1 : 0; } return 2 * a / Math.max(1, b + c); };

// ---------- 3D: 分泌顆粒の2値ボリューム ----------
L.makeGranVol = function (seed) {
  const r = L.rng(seed), W = 96, H = 96, D = 48, vol = new Uint8Array(W * H * D), sp = [];
  const want = 18 + Math.floor(r() * 10);
  for (let t = 0; t < 5000 && sp.length < want; t++) {
    const R = 3.5 + r() * 4, x = R + 1 + r() * (W - 2 * R - 2), y = R + 1 + r() * (H - 2 * R - 2), z = R + 1 + r() * (D - 2 * R - 2);
    if (sp.some(s => Math.hypot(s.x - x, s.y - y, s.z - z) < s.R + R + 3)) continue;
    sp.push({ x, y, z, R });
  }
  for (const s of sp) {
    for (let z = Math.floor(s.z - s.R); z <= Math.ceil(s.z + s.R); z++)
      for (let y = Math.floor(s.y - s.R); y <= Math.ceil(s.y + s.R); y++)
        for (let x = Math.floor(s.x - s.R); x <= Math.ceil(s.x + s.R); x++) {
          if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) continue;
          const d = Math.hypot(x - s.x, y - s.y, z - s.z);
          if (d <= s.R && !(d < s.R - 1.5 && r() < 0.03)) vol[(z * H + y) * W + x] = 1;
        }
  }
  const far = (x, y, z) => sp.every(s => Math.hypot(s.x - x, s.y - y, s.z - z) > s.R + 3);
  for (let c = 0; c < 260; c++) {
    let x = Math.floor(r() * W), y = Math.floor(r() * H), z = Math.floor(r() * D);
    const len = 1 + Math.floor(r() * 12);
    for (let k = 0; k < len; k++) {
      if (far(x, y, z)) vol[(z * H + y) * W + x] = 1;
      const d = Math.floor(r() * 6);
      if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
      x = clamp(x, 0, W - 1); y = clamp(y, 0, H - 1); z = clamp(z, 0, D - 1);
    }
  }
  return { W, H, D, vol, spheres: sp, voxel: 20 };
};
L.label3d = function (vol, W, H, D, conn) {
  const lab = new Int32Array(vol.length), sizes = [0], q = new Int32Array(vol.length);
  const nb = [];
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const m = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
    if (m === 0) continue; if (conn === 6 && m > 1) continue;
    nb.push([dx, dy, dz]);
  }
  let L2 = 0;
  for (let i = 0; i < vol.length; i++) {
    if (!vol[i] || lab[i]) continue;
    L2++; let head = 0, tail = 0, n = 0; q[tail++] = i; lab[i] = L2;
    while (head < tail) {
      const c = q[head++]; n++;
      const x = c % W, y = ((c / W) | 0) % H, z = (c / (W * H)) | 0;
      for (const [dx, dy, dz] of nb) {
        const xx = x + dx, yy = y + dy, zz = z + dz;
        if (xx < 0 || yy < 0 || zz < 0 || xx >= W || yy >= H || zz >= D) continue;
        const j = (zz * H + yy) * W + xx;
        if (vol[j] && !lab[j]) { lab[j] = L2; q[tail++] = j; }
      }
    }
    sizes.push(n);
  }
  return { lab, sizes, n: L2 };
};
L.count2d = function (vol, W, H, D) { // 各スライスで2D連結成分(8近傍)を数えて合計
  let total = 0;
  for (let z = 0; z < D; z++) {
    const sl = vol.subarray(z * W * H, (z + 1) * W * H), r = L.label3d(sl, W, H, 1, 26);
    total += r.n;
  }
  return total;
};

// ---------- 肺組織: 血管と細胞 ----------
L.makeLung = function (seed) {
  const r = L.rng(seed), S = 600, vessels = [];
  for (let v = 0; v < 5; v++) {
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2; const pts = [[x, y]];
    for (let k = 0; k < 90; k++) {
      a += (r() - 0.5) * 0.5; x += 6 * Math.cos(a); y += 6 * Math.sin(a);
      if (x < -20 || y < -20 || x > S + 20 || y > S + 20) break;
      pts.push([x, y]);
    }
    vessels.push(pts);
  }
  const G = 2, n = S / G, dist = new Float32Array(n * n);
  const segs = []; for (const p of vessels) for (let k = 1; k < p.length; k++) segs.push([p[k - 1], p[k]]);
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const px = (gx + 0.5) * G, py = (gy + 0.5) * G; let m = 1e9;
    for (const [a, b] of segs) {
      const vx = b[0] - a[0], vy = b[1] - a[1], t = clamp(((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy), 0, 1);
      const d = Math.hypot(px - a[0] - t * vx, py - a[1] - t * vy); if (d < m) m = d;
    }
    dist[gy * n + gx] = m;
  }
  const dAt = (x, y) => dist[clamp(Math.floor(y / G), 0, n - 1) * n + clamp(Math.floor(x / G), 0, n - 1)];
  // 模擬データの正解: 各細胞種の血管との関係(名前と正解の組合せは種ごとに入れ替える)
  const kinds = ['near', 'random', 'avoid'];
  for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const types = [
    { name: '線維芽細胞', color: '#f0883e', n: 160 },
    { name: 'マクロファージ', color: '#a371f7', n: 140 },
    { name: '上皮細胞', color: '#3fb950', n: 170 },
  ];
  types.forEach((t, k) => {
    t.truth = kinds[k]; t.pts = [];
    while (t.pts.length < t.n) {
      const x = r() * S, y = r() * S, d = dAt(x, y);
      const acc = t.truth === 'near' ? Math.exp(-d / 22) : t.truth === 'avoid' ? 1 - Math.exp(-d / 35) : 1;
      if (r() < acc) t.pts.push([x, y]);
    }
  });
  return { S, vessels, types, dAt };
};

// ---------- β細胞: ミトコンドリアとERの接触 ----------
function segDist(px, py, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], t = clamp(((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - a[0] - t * vx, py - a[1] - t * vy);
}
L.erDist = function (cell, x, y) { let m = 1e9; for (const p of cell.er) for (let k = 1; k < p.length; k++) { const d = segDist(x, y, p[k - 1], p[k]); if (d < m) m = d; } return m; };
L.makeContactStudy = function (seed) {
  const r = L.rng(seed), S = 3000, groups = [
    { name: '通常(5.5 mM)', contact: 0.40, near: 0.25, cells: [] },
    { name: '高グルコース(25 mM)', contact: 0.22, near: 0.43, cells: [] },
  ];
  for (const g of groups) for (let c = 0; c < 8; c++) {
    const er = [];
    for (let k = 0; k < 7; k++) {
      let x = 300 + r() * (S - 600), y = 300 + r() * (S - 600), a = r() * Math.PI * 2; const p = [[x, y]];
      for (let s = 0; s < 40; s++) { a += (r() - 0.5) * 0.7; x = clamp(x + 50 * Math.cos(a), 50, S - 50); y = clamp(y + 50 * Math.sin(a), 50, S - 50); p.push([x, y]); }
      er.push(p);
    }
    const cell = { er, mitos: [] };
    const pc = clamp(g.contact + 0.06 * L.gauss(r), 0.05, 0.9), pn = clamp(g.near + 0.06 * L.gauss(r), 0.05, 0.9);
    const nm = 20 + Math.floor(r() * 11);
    for (let i = 0; i < nm; i++) {
      const u = r(), cat = u < pc ? 'c' : u < pc + pn ? 'n' : 'f';
      const band = cat === 'c' ? [4, 27] : cat === 'n' ? [36, 95] : [110, 1e9];
      for (let t = 0; t < 400; t++) {
        const R = 110 + r() * 110; let x, y;
        if (cat === 'f') { x = R + r() * (S - 2 * R); y = R + r() * (S - 2 * R); }
        else {
          const p = er[Math.floor(r() * er.length)], k = 1 + Math.floor(r() * (p.length - 1));
          const tx = p[k][0] - p[k - 1][0], ty = p[k][1] - p[k - 1][1], l = Math.hypot(tx, ty) || 1, sgn = r() < 0.5 ? 1 : -1;
          const gap = band[0] + r() * (band[1] - band[0]);
          x = p[k][0] + sgn * (-ty / l) * (R + gap); y = p[k][1] + sgn * (tx / l) * (R + gap);
        }
        if (x < R || y < R || x > S - R || y > S - R) continue;
        const gap = L.erDist(cell, x, y) - R;
        if (gap < band[0] || gap > band[1]) continue;
        if (cell.mitos.some(m => Math.hypot(m.x - x, m.y - y) < m.R + R + 30)) continue;
        cell.mitos.push({ x, y, R, gap }); break;
      }
    }
    g.cells.push(cell);
  }
  return { S, groups };
};
L.contactFrac = function (cell, d) { let c = 0; for (const m of cell.mitos) if (m.gap <= d) c++; return c / cell.mitos.length; };
L.permTest = function (a, b) { // 平均の差の両側・正確な並べ替え検定
  const all = a.concat(b), n = all.length, k = a.length, mean = v => v.reduce((s, x) => s + x, 0) / v.length;
  const obs = Math.abs(mean(a) - mean(b)), tot = all.reduce((s, x) => s + x, 0);
  let cnt = 0, N = 0;
  const rec = (start, left, sum) => {
    if (left === 0) { N++; const ma = sum / k, mb = (tot - sum) / (n - k); if (Math.abs(ma - mb) >= obs - 1e-12) cnt++; return; }
    for (let i = start; i <= n - left; i++) rec(i + 1, left - 1, sum + all[i]);
  };
  rec(0, k, 0);
  return { p: cnt / N, N, diff: mean(a) - mean(b) };
};

// ---------- 超解像(1分子局在化) ----------
L.makeSMLM = function (seed) {
  const r = L.rng(seed), px = 100, F = 32, frames = 800, sig = 1.1, bg = 8;
  const gap = Math.round(60 + r() * 60), cx = 1600 + (r() - 0.5) * 200;
  const em = [];
  for (const side of [-1, 1]) for (let i = 0; i < 300; i++) em.push({ x: cx + side * gap / 2 + 8 * L.gauss(r), y: 500 + r() * 2200 });
  const stack = [];
  for (let f = 0; f < frames; f++) {
    const fr = new Float32Array(F * F).fill(bg);
    for (const e of em) {
      if (r() > 0.0015) continue;
      const N = 600 + r() * 700, ex = e.x / px - 0.5, ey = e.y / px - 0.5;
      for (let y = Math.max(0, Math.floor(ey - 5)); y <= Math.min(F - 1, Math.ceil(ey + 5)); y++)
        for (let x = Math.max(0, Math.floor(ex - 5)); x <= Math.min(F - 1, Math.ceil(ex + 5)); x++)
          fr[y * F + x] += N / (2 * Math.PI * sig * sig) * Math.exp(-((x - ex) ** 2 + (y - ey) ** 2) / (2 * sig * sig));
    }
    for (let i = 0; i < fr.length; i++) fr[i] = L.poisson(r, fr[i]);
    stack.push(fr);
  }
  return { px, F, frames, sig, bg, stack, gap };
};
L.localize = function (sm, thr, method) {
  const { F, sig, px } = sm, out = [], R = 3;
  for (let f = 0; f < sm.stack.length; f++) {
    const fr = sm.stack[f], s = Array.from(fr).sort((a, b) => a - b), bg = s[s.length >> 1];
    for (let y = R; y < F - R; y++) for (let x = R; x < F - R; x++) {
      const v = fr[y * F + x]; if (v - bg < thr) continue;
      let peak = true;
      for (let j = -1; j <= 1 && peak; j++) for (let i = -1; i <= 1; i++) if ((i || j) && fr[(y + j) * F + x + i] >= v && !(fr[(y + j) * F + x + i] === v && (j < 0 || (j === 0 && i < 0)))) { peak = false; break; }
      if (!peak) continue;
      let sx = 0, sy = 0, sw = 0;
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const w = Math.max(0, fr[(y + j) * F + x + i] - bg); sx += w * (x + i); sy += w * (y + j); sw += w; }
      let p = [sx / sw, sy / sw, v - bg, bg];
      if (method === 'fit') {
        for (let it = 0; it < 12; it++) {
          const A = new Array(16).fill(0), b = [0, 0, 0, 0];
          for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
            const X = x + i, Y = y + j, e = Math.exp(-((X - p[0]) ** 2 + (Y - p[1]) ** 2) / (2 * sig * sig));
            const m = p[2] * e + p[3], res = fr[Y * F + X] - m;
            const J = [p[2] * e * (X - p[0]) / (sig * sig), p[2] * e * (Y - p[1]) / (sig * sig), e, 1];
            for (let a = 0; a < 4; a++) { b[a] += J[a] * res; for (let c = 0; c < 4; c++) A[a * 4 + c] += J[a] * J[c]; }
          }
          for (let a = 0; a < 4; a++) A[a * 5] *= 1.05;
          const d = L.solve(A, b, 4);
          p = p.map((v, k) => v + clamp(d[k], -1, 1) * (k < 2 ? 1 : 1));
          if (Math.abs(p[0] - x) > R || Math.abs(p[1] - y) > R) break;
        }
        if (Math.abs(p[0] - x) > R || Math.abs(p[1] - y) > R || p[2] <= 0) continue;
      }
      out.push({ x: (p[0] + 0.5) * px, y: (p[1] + 0.5) * px, f });
    }
  }
  return out;
};

G.Lab = L;
})(typeof window !== 'undefined' ? window : globalThis);
