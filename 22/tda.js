// ヴィートリス・リップス複体のフィルトレーションと持続ホモロジー(H0, H1, 係数 Z/2)
// ブラウザでは window.TDA、node では module.exports
(function (root) {
  // P: Float32Array/Array [x0,y0,z0,x1,...]、T: 半径(辺の長さ)の上限
  function build(P, T) {
    const n = P.length / 3;
    const D = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
      D[i * n + j] = D[j * n + i] = Math.hypot(dx, dy, dz);
    }
    // 包含半径: これより先は1点からの錐になり可縮(すべての輪が消える)
    let enc = Infinity;
    for (let i = 0; i < n; i++) { let m = 0; for (let j = 0; j < n; j++) m = Math.max(m, D[i * n + j]); enc = Math.min(enc, m); }
    if (T === undefined) T = enc;

    // ---- 辺(1単体): 長さ順 ----
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (D[i * n + j] <= T) pairs.push(i * n + j);
    pairs.sort((a, b) => D[a] - D[b] || a - b);
    const m = pairs.length;
    const ea = new Int32Array(m), eb = new Int32Array(m), ev = new Float64Array(m);
    const eid = new Int32Array(n * n).fill(-1);
    pairs.forEach((p, k) => { const i = (p / n) | 0, j = p % n; ea[k] = i; eb[k] = j; ev[k] = D[p]; eid[i * n + j] = eid[j * n + i] = k; });

    // ---- 三角形(2単体): 値 = 最長辺。順序は(最長辺, 次, 最短)の辺番号 ----
    const tl = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = eid[i * n + j]; if (a < 0) continue;
      for (let k = j + 1; k < n; k++) {
        const b = eid[i * n + k], c = eid[j * n + k]; if (b < 0 || c < 0) continue;
        let x = a, y = b, z = c, t;
        if (x < y) { t = x; x = y; y = t; } if (y < z) { t = y; y = z; z = t; } if (x < y) { t = x; x = y; y = t; }
        tl.push(x, y, z, i, j, k);
      }
    }
    const nt = tl.length / 6;
    const ord = new Int32Array(nt); for (let i = 0; i < nt; i++) ord[i] = i;
    ord.sort((p, q) => tl[6 * p] - tl[6 * q] || tl[6 * p + 1] - tl[6 * q + 1] || tl[6 * p + 2] - tl[6 * q + 2]);
    const te = new Int32Array(nt * 3), tv = new Int32Array(nt * 3), tval = new Float64Array(nt);
    for (let r = 0; r < nt; r++) {
      const s = 6 * ord[r];
      te[3 * r] = tl[s]; te[3 * r + 1] = tl[s + 1]; te[3 * r + 2] = tl[s + 2];
      tv[3 * r] = tl[s + 3]; tv[3 * r + 1] = tl[s + 4]; tv[3 * r + 2] = tl[s + 5];
      tval[r] = ev[tl[s]];
    }

    // ---- H0: Union-Find(若い成分が古い成分に吸収される) ----
    const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const h0 = [], negEdge = new Uint8Array(m);
    for (let k = 0; k < m; k++) {
      const a = find(ea[k]), b = find(eb[k]); if (a === b) continue;
      negEdge[k] = 1; const hi = Math.max(a, b), lo = Math.min(a, b); par[hi] = lo;
      h0.push({ birth: 0, death: ev[k], edge: k, a: ea[k], b: eb[k] });
    }
    h0.push({ birth: 0, death: Infinity, edge: -1 });

    // ---- H1: 境界行列の列簡約。列は辺番号の降順配列 ----
    const pivot = new Int32Array(m).fill(-1); // 辺 → その辺を low に持つ簡約済み列(三角形番号)
    const cols = new Map();                   // 三角形番号 → 簡約済み列
    const h1 = [];
    for (let r = 0; r < nt; r++) {
      let col = [te[3 * r], te[3 * r + 1], te[3 * r + 2]];
      while (col.length && pivot[col[0]] >= 0) {
        const o = cols.get(pivot[col[0]]), out = [];
        let i = 0, j = 0;
        while (i < col.length && j < o.length) {
          if (col[i] > o[j]) out.push(col[i++]); else if (col[i] < o[j]) out.push(o[j++]); else { i++; j++; }
        }
        while (i < col.length) out.push(col[i++]); while (j < o.length) out.push(o[j++]);
        col = out;
      }
      if (!col.length) continue; // 正の三角形(H2 を作る)。ここでは追わない
      pivot[col[0]] = r; cols.set(r, col);
      const b = ev[col[0]], d = tval[r];
      if (d > b) h1.push({ birth: b, death: d, edge: col[0], tri: r, cycle: col });
    }
    // 三角形で埋まらなかった輪(T で打ち切ったとき)
    for (let k = 0; k < m; k++) if (!negEdge[k] && pivot[k] < 0) h1.push({ birth: ev[k], death: Infinity, edge: k, tri: -1, cycle: null });

    return { n, T, enc, D, m, ea, eb, ev, nt, te, tv, tval, h0, h1 };
  }

  const api = { build };
  if (typeof module !== "undefined") module.exports = api; else root.TDA = api;
})(this);
