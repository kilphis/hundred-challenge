// 多脚の彫刻 案C: 鋳鉄の灯籠 (Three.js r128)
// 縦長の鋳鉄の灯籠が6本の細く長い脚で立つ。胴体の中心 y=600、膝の頂点 y=900、足先の円 半径600。
(function () {
  const PI = Math.PI;

  // ---------- 乱数・テクスチャ ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const RUST = ['112,46,22', '132,58,24', '146,74,32', '84,32,15', '120,52,24'];
  function flower(x, R, cx, cy, sc, size) {
    for (const off of [-size, 0, size]) {
      const X = cx + off;
      const rad = 46 * sc;
      let g = x.createRadialGradient(X, cy, 0, X, cy, rad);
      g.addColorStop(0, 'rgba(78,34,16,0.38)'); g.addColorStop(1, 'rgba(78,34,16,0)');
      x.fillStyle = g; x.fillRect(X - rad, cy - rad, rad * 2, rad * 2);
    }
    const n = 14 + Math.floor(R() * 22);
    for (let k = 0; k < n; k++) {
      const a = R() * PI * 2, d = Math.abs((R() + R() + R() - 1.5)) * 22 * sc, rr = (1 + R() * 4) * sc;
      const col = RUST[Math.floor(R() * RUST.length)], al = 0.3 + R() * 0.4;
      for (const off of [-size, 0, size]) {
        x.fillStyle = 'rgba(' + col + ',' + al + ')';
        x.beginPath(); x.ellipse(cx + off + Math.cos(a) * d, cy + Math.sin(a) * d, rr, rr * (0.6 + R() * 0.5), R() * PI, 0, PI * 2); x.fill();
      }
    }
    if (R() < 0.55) {
      const len = (40 + R() * 110) * sc, w = (2 + R() * 3) * sc;
      for (const off of [-size, 0, size]) {
        const g = x.createLinearGradient(0, cy, 0, cy + len);
        g.addColorStop(0, 'rgba(110,48,20,0.45)'); g.addColorStop(1, 'rgba(110,48,20,0)');
        x.fillStyle = g; x.fillRect(cx + off - w / 2, cy, w, len);
      }
    }
  }
  function paintIron(size, o) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), R = rng(o.seed), S = size / 1024;
    x.fillStyle = o.base || '#1f1c1a'; x.fillRect(0, 0, size, size);
    for (let k = 0; k < o.mottle; k++) {
      const cx = R() * size, cy = R() * size, rad = (30 + R() * 140) * S, dark = R() < 0.5;
      const col = dark ? '8,7,6' : '62,52,46', al = 0.22 + R() * 0.25;
      for (const dx of [-size, 0, size]) {
        const g = x.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, rad);
        g.addColorStop(0, 'rgba(' + col + ',' + al + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
        x.fillStyle = g; x.fillRect(cx + dx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    if (o.ribs) { // リブの頂は磨れて明るく、脇に錆がたまる
      for (let k = 0; k < o.ribs; k++) {
        const xk = k / o.ribs * size;
        let g = x.createLinearGradient(xk - 8 * S, 0, xk + 8 * S, 0);
        g.addColorStop(0, 'rgba(120,108,98,0)'); g.addColorStop(0.5, 'rgba(150,136,124,0.4)'); g.addColorStop(1, 'rgba(120,108,98,0)');
        x.fillStyle = g; x.fillRect(xk - 8 * S, 0, 16 * S, size);
        for (const sgn of [-1, 1]) {
          const xs = xk + sgn * 11 * S;
          g = x.createLinearGradient(xs - 5 * S, 0, xs + 5 * S, 0);
          g.addColorStop(0, 'rgba(96,42,18,0)'); g.addColorStop(0.5, 'rgba(110,46,20,0.3)'); g.addColorStop(1, 'rgba(96,42,18,0)');
          x.fillStyle = g; x.fillRect(xs - 5 * S, 0, 10 * S, size);
        }
      }
    }
    for (let k = 0; k < o.flowers; k++) {
      const cy = (o.y0 !== undefined ? o.y0 + R() * (o.y1 - o.y0) : R()) * size;
      flower(x, R, R() * size, cy, (0.5 + R() * 1.1) * S * (o.fs || 1), size);
    }
    const img = x.getImageData(0, 0, size, size), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (R() - 0.5) * 16;
      d[i] += n; d[i + 1] += n * 0.9; d[i + 2] += n * 0.8;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // ---------- 窓(胴体の下のふくらみ) ----------
  const RIBS = 18;
  const WIN = { y0: 8, y1: 122, hw: 3.6, depth: 9, pitch: 360 / RIBS, phase: 180 / RIBS };
  function winG(thDeg, y) {
    const s = (y - WIN.y0) / (WIN.y1 - WIN.y0);
    if (s <= 0 || s >= 1) return 0;
    let d = ((thDeg - WIN.phase) % WIN.pitch + WIN.pitch) % WIN.pitch;
    if (d > WIN.pitch / 2) d = WIN.pitch - d;
    const a = d / WIN.hw;
    const e = Math.min(s / 0.1, (1 - s) / 0.2);
    const w = e >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)));
    return Math.min(1, Math.max(0, (w - a) * 4));
  }
  function paintEmissive(prof) {
    const W = 1024, H = 1024, P = prof.length;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    for (let py = 0; py < H; py++) {
      const jf = (1 - (py + 0.5) / H) * (P - 1), j = Math.min(P - 2, Math.floor(jf)), f = jf - j;
      const y = prof[j][1] * (1 - f) + prof[j + 1][1] * f;
      if (y < WIN.y0 - 1 || y > WIN.y1 + 1) continue;
      const s = Math.min(1, Math.max(0, (y - WIN.y0) / (WIN.y1 - WIN.y0)));
      for (let px = 0; px < W; px++) {
        const g = winG((px + 0.5) / W * 360, y);
        if (g <= 0.6) continue;
        const k = (g - 0.6) / 0.4;
        const bri = (0.5 + 0.5 * Math.pow(Math.sin(PI * s), 0.6)) * k * k;
        const i = (py * W + px) * 4;
        d[i] = 255 * bri; d[i + 1] = 140 * bri; d[i + 2] = 40 * bri * bri;
      }
    }
    x.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  }

  // ---------- 断面(輪郭)の作成 ----------
  function cr3(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [0, 1, 2].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3));
  }
  function crPts(P, step) {
    const out = [], n = P.length;
    for (let k = 0; k < n - 1; k++) {
      const p0 = P[Math.max(k - 1, 0)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(k + 2, n - 1)];
      const m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let s = 0; s < m; s++) out.push(cr3(p0, p1, p2, p3, s / m));
    }
    out.push(P[n - 1].slice());
    return out;
  }
  function polyPts(P, step) {
    const out = [], n = P.length;
    for (let k = 0; k < n - 1; k++) {
      const a = P[k], b = P[k + 1];
      const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let s = 0; s < m; s++) { const t = s / m; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    }
    out.push(P[n - 1].slice());
    return out;
  }
  // [r, y, リブの高さ]。下のふくらみ(直径約380) → くびれ → 棚 → 上のふくらみ(直径約200) → 宝珠
  function bodyProfile() {
    const A = crPts([
      [0, -222, 0], [36, -216, 0], [90, -199, 2], [142, -168, 6], [170, -125, 8], [181, -65, 8], [182, 0, 8],
      [177, 60, 8], [162, 100, 8], [135, 134, 6], [100, 152, 2], [64, 160, 0], [52, 164, 0], [50, 168, 0],
      [58, 171, 0], [50, 174, 0], [50, 177, 0]], 3.5);
    const L = polyPts([[50, 177, 0], [112, 177, 0], [118, 181, 0], [118, 185, 0], [110, 189, 0]], 3.5);
    const U = crPts([
      [104, 189, 0], [97, 199, 3], [98, 216, 5], [100, 240, 5], [95, 262, 5], [78, 282, 3], [54, 297, 0],
      [32, 306, 0], [16, 311, 0]], 3.5);
    const T1 = polyPts([[16, 311, 0], [14, 315, 0], [14, 319, 0], [24, 319, 0], [24, 323, 0], [14, 326, 0]], 3.5);
    const T2 = crPts([[14, 326, 0], [22, 333, 0], [27, 345, 0], [21, 358, 0], [9, 369, 0], [0, 377, 0]], 3);
    return [].concat(A, L, U, T1, T2).map(p => [Math.max(0, p[0]), p[1], Math.max(0, p[2])]);
  }

  // ---------- ジオメトリの結合(同じ素材のものを1メッシュに) ----------
  function mergeGeos(list) {
    const arr = list.map(g => g.index ? g.toNonIndexed() : g);
    let n = 0; arr.forEach(g => n += g.attributes.position.count);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    arr.forEach(g => {
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return m;
  }

  // 脚の付け根の受け金具: 受けブロック + 厚い板2枚(骨r=40を内幅43ではさむ) + ピン頭 + リベット
  function bracketGeo() {
    const list = [];
    const saddle = new THREE.BoxGeometry(124, 84, 64); saddle.translate(0, 0, -68); list.push(saddle);
    const sh = new THREE.Shape();
    sh.moveTo(-100, -62); sh.lineTo(0, -62); sh.absarc(0, 0, 62, -PI / 2, PI / 2, false); sh.lineTo(-100, 62); sh.lineTo(-100, -62);
    for (const sgn of [-1, 1]) {
      const p = new THREE.ExtrudeGeometry(sh, { depth: 17, bevelEnabled: false, curveSegments: 28 });
      p.rotateY(-PI / 2); p.translate(sgn > 0 ? 60 : -43, 0, 0); list.push(p);
      const head = new THREE.CylinderGeometry(21, 21, 5, 18); head.rotateZ(PI / 2); head.translate(sgn * 62.5, 0, 0); list.push(head);
      for (const [rz, ry] of [[-45, 42], [-45, -42], [-82, 42], [-82, -42], [38, 32], [38, -32]]) {
        const rv = new THREE.SphereGeometry(6.5, 8, 6); rv.translate(sgn * 60, ry, rz); list.push(rv);
      }
    }
    return mergeGeos(list);
  }
  // 膝の関節金具(ナックル)
  function knuckleGeo() {
    const list = [];
    const cyl = new THREE.CylinderGeometry(12, 12, 32, 24); cyl.rotateZ(PI / 2); list.push(cyl);
    for (const sgn of [-1, 1]) {
      const h = new THREE.CylinderGeometry(8.5, 8.5, 4, 6); h.rotateZ(PI / 2); h.translate(sgn * 18, 0, 0); list.push(h);
    }
    list.push(new THREE.SphereGeometry(10.5, 16, 12));
    const m = mergeGeos(list); m.scale(2.0, 2.0, 2.0); return m;
  }
  // 足先: 沓リング → 首 → 玉足(先端が z=0)。s 倍
  function footGeo(s) {
    const pts = [[3.2, -54], [3.4, -50], [6.5, -46], [6.9, -40], [6.5, -34], [3.9, -30], [3.2, -24], [3.3, -14], [3.5, -9]];
    for (let a = 125; a >= 0; a -= 12.5) { const ar = a * PI / 180; pts.push([4.5 * Math.sin(ar), -4.5 + 4.5 * Math.cos(ar)]); }
    const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0] * s, p[1] * s)), 18); g.rotateX(PI / 2); return g;
  }

  // ---------- 太い脚の骨(3案) ----------
  function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function capFactor(z, L, c0, c1) {
    let f = 1;
    if (z < c0) f *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - z / c0, 2)));
    if (z > L - c1) f *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - (L - z) / c1, 2)));
    return f;
  }
  // rows x (N+1) の格子。posFn(i,j) -> [x,y,z]。+z 方向・θ(sin→x, cos→y)の向きで外向き
  function gridGeo(rows, N, posFn) {
    const C = N + 1, pos = new Float32Array(rows * C * 3), uv = new Float32Array(rows * C * 2), idx = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < C; j++) {
      const p = posFn(i, j), o = i * C + j;
      pos[o * 3] = p[0]; pos[o * 3 + 1] = p[1]; pos[o * 3 + 2] = p[2];
      uv[o * 2] = j / N; uv[o * 2 + 1] = i / (rows - 1);
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < N; j++) {
      const a = i * C + j, b = (i + 1) * C + j, c = a + 1, d = b + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nor = g.attributes.normal;
    for (let i = 0; i < rows; i++) {
      const a = i * C, b = i * C + N;
      const nx = nor.getX(a) + nor.getX(b), ny = nor.getY(a) + nor.getY(b), nz = nor.getZ(a) + nor.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
      nor.setXYZ(a, nx / l, ny / l, nz / l); nor.setXYZ(b, nx / l, ny / l, nz / l);
    }
    for (let j = 0; j < C; j++) { nor.setXYZ(j, 0, 0, -1); nor.setXYZ((rows - 1) * C + j, 0, 0, 1); }
    return g;
  }
  // 軸まわりの管。radFn(θ,z) = その位置の半径(端の丸めは中でかける)
  function tubeGeo(L, nz, N, radFn, c0, c1) {
    return gridGeo(nz + 1, N, (i, j) => {
      const z = L * i / nz, th = 2 * PI * j / N, r = radFn(th, z) * capFactor(z, L, c0, c1);
      return [r * Math.sin(th), r * Math.cos(th), z];
    });
  }
  const TW = 2 * PI / 450;
  // 1. 撚り: 太い筋4本 + 芯。付け根でほどけて少し広がる
  function strandBone(L, rFn, zOff, nz) {
    const list = [], K = 4;
    for (let k = 0; k < K; k++) {
      const ph0 = 2 * PI * k / K + 0.4;
      list.push(gridGeo(nz + 1, 12, (i, j) => {
        const z = L * i / nz, a = 2 * PI * j / 12, R = rFn(z);
        const splay = zOff === 0 ? 11 * Math.pow(Math.max(0, 1 - z / 80), 2) : 0;
        const cd = 0.6 * R + splay, ph = ph0 + TW * (zOff + z) - (zOff === 0 ? 0.5 * Math.pow(Math.max(0, 1 - z / 80), 2) : 0);
        const rs = 0.41 * R * capFactor(z, L, 0.41 * rFn(0), 0.41 * rFn(L));
        return [cd * Math.sin(ph) + rs * Math.sin(a), cd * Math.cos(ph) + rs * Math.cos(a), z];
      }));
    }
    list.push(tubeGeo(L, Math.ceil(nz / 2), 12, (th, z) => 0.5 * rFn(z), 10, 5));
    return mergeGeos(list);
  }
  // 2. 浮き出た脈: 太い芯に枝分かれする脈(2段階で割れる)
  const VEINS = (function () {
    const R = rng(77), list = [], M = 8;
    for (let m = 0; m < M; m++) {
      const zs1 = 80 + R() * 330;
      list.push({ base: 2 * PI * m / M + 0.2, zs1, zs2: zs1 + 160 + R() * 360, ph1: R() * 6.28, ph2: R() * 6.28, ph3: R() * 6.28, m });
    }
    return list;
  })();
  function angd(a, b) { let d = (a - b) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; return d; }
  // 戻り値 [h: 脈の高さ 0..1, g: 光る芯 0..1]
  function veinField(th, zg) {
    let h = 0, g = 0;
    for (const v of VEINS) {
      const c = v.base + 0.0016 * zg + 0.32 * Math.sin(zg * 0.011 + v.ph1) + 0.18 * Math.sin(zg * 0.029 + v.ph2);
      const s1 = smooth(v.zs1, v.zs1 + 160, zg), s2 = smooth(v.zs2, v.zs2 + 160, zg);
      const ch = [[c - 0.3 * s1, 1.0], [c + 0.3 * s1 - 0.22 * s2, 0.92], [c + 0.3 * s1 + 0.22 * s2, 0.88]];
      for (let q = 0; q < 3; q++) {
        const w = 0.15 - 0.045 * s1 - 0.02 * s2, d = angd(th, ch[q][0]);
        const e = Math.exp(-(d / w) * (d / w)) * ch[q][1];
        if (e > h) h = e;
        if (q > 0 || v.m % 3 === 0) {
          const gl = Math.exp(-(d / (w * 0.3)) * (d / (w * 0.3))) * ch[q][1] * (0.35 + 0.65 * s1) * (0.55 + 0.45 * Math.sin(zg * 0.04 + v.ph3));
          if (gl > g) g = gl;
        }
      }
    }
    return [h, g];
  }
  const veinRad = (rFn, zOff) => (th, z) => rFn(z) * (0.86 + 0.17 * veinField(th, zOff + z)[0]);
  function paintVein(W, H, L, zOff, seed) {
    const R = rng(seed);
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); return [c, x, x.createImageData(W, H)]; };
    const [c1, x1, i1] = mk(), [c2, x2, i2] = mk();
    for (let py = 0; py < H; py++) {
      const v = 1 - (py + 0.5) / H, z = v * L;
      for (let px = 0; px < W; px++) {
        const u = (px + 0.5) / W, f = veinField(u * 2 * PI, zOff + z), o = (py * W + px) * 4;
        const mot = 0.5 + 0.25 * Math.sin(u * 37 + v * 11) + 0.25 * Math.sin(u * 13 - v * 29 + 1.3), n = (R() - 0.5) * 12;
        const rust = Math.max(0, Math.sin(u * 17 + v * 9) * Math.sin(u * 5 - v * 23) - 0.5) * 60;
        i1.data[o] = 30 + mot * 16 + f[0] * 46 + rust + n; i1.data[o + 1] = 27 + mot * 13 + f[0] * 38 + rust * 0.45 + n; i1.data[o + 2] = 24 + mot * 11 + f[0] * 32 + rust * 0.2 + n; i1.data[o + 3] = 255;
        const g = f[1];
        i2.data[o] = 255 * g; i2.data[o + 1] = 125 * g; i2.data[o + 2] = 30 * g * g; i2.data[o + 3] = 255;
      }
    }
    x1.putImageData(i1, 0, 0); x2.putImageData(i2, 0, 0);
    return [new THREE.CanvasTexture(c1), new THREE.CanvasTexture(c2)];
  }
  // 3. 筋の束: 縦の畝(フルート)ごとに膨らみとくびれ。ゆるくねじれる
  const NF = 10, MW = 0.0011;
  const hsh = (k, s) => { const t = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return t - Math.floor(t); };
  function muscleRad(rFn, L, zOff, seed) {
    return (th, z) => {
      const R = rFn(z) * (1 + 0.1 * Math.exp(-Math.pow((z - 0.22 * L) / (0.2 * L), 2)));
      const tp = th + MW * (zOff + z) * 2 * PI * 0.9;
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(NF * tp), 0.85);
      const k = ((Math.round(NF * tp / (2 * PI)) % NF) + NF) % NF;
      const zc = L * (0.1 + 0.55 * hsh(k, seed)), hw = L * (0.2 + 0.2 * hsh(k, seed + 5));
      const belly = 0.4 + 0.6 * Math.exp(-Math.pow((z - zc) / hw, 2));
      return R * (0.64 + 0.37 * ridge * belly);
    };
  }

  // 立ち姿勢のIK(SPEC どおり)
  function solveLeg(leg, targetWorld) {
    const p = leg.hip.parent.worldToLocal(targetWorld.clone()).sub(leg.hip.position);
    leg.hip.rotation.set(0, Math.atan2(p.x, p.z), 0);
    leg.hip.updateMatrixWorld(true);
    const t = leg.hip.worldToLocal(targetWorld.clone());
    const L1 = leg.L1, L2 = leg.L2;
    const r = Math.min(Math.max(Math.hypot(t.y, t.z), Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-3);
    const phi = Math.atan2(-t.y, t.z);
    const alpha = Math.acos((L1 * L1 + r * r - L2 * L2) / (2 * L1 * r));
    const beta = Math.acos((L1 * L1 + L2 * L2 - r * r) / (2 * L1 * L2));
    leg.femur.rotation.x = phi - alpha;
    leg.knee.rotation.x = PI - beta;
  }

  window.MODELS = window.MODELS || {};
  function buildLantern(kind) {
    const g = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 600; g.add(body); g.userData.body = body;
    const addMesh = (parent, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

    // --- 胴体(旋盤形 + リブ + 窓の凹み) ---
    const prof = bodyProfile(), P = prof.length, N = RIBS * 20;
    const geo = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), N);
    const pos = geo.attributes.position;
    for (let i = 0; i <= N; i++) {
      const th = 2 * PI * i / N, thDeg = 360 * i / N;
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(RIBS * th), 8);
      for (let j = 0; j < P; j++) {
        const r0 = prof[j][0]; if (r0 <= 0.01) continue;
        const y = prof[j][1];
        const r = r0 + prof[j][2] * ridge - WIN.depth * winG(thDeg, y);
        pos.setXYZ(i * P + j, r * Math.sin(th), y, r * Math.cos(th));
      }
    }
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    for (let j = 0; j < P; j++) {
      const a = j, b = N * P + j;
      const nx = nor.getX(a) + nor.getX(b), ny = nor.getY(a) + nor.getY(b), nz = nor.getZ(a) + nor.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
      nor.setXYZ(a, nx / l, ny / l, nz / l); nor.setXYZ(b, nx / l, ny / l, nz / l);
    }
    for (let i = 0; i <= N; i++) { nor.setXYZ(i * P, 0, -1, 0); nor.setXYZ(i * P + P - 1, 0, 1, 0); }

    const bodyTex = paintIron(1024, { seed: 41, mottle: 150, ribs: RIBS, flowers: 120, y0: 0.3, y1: 0.97, base: '#2d2926' });
    const bodyMat = new THREE.MeshStandardMaterial({
      map: bodyTex, bumpMap: bodyTex, bumpScale: 1.6, roughness: 0.6, metalness: 0.25,
      emissive: 0xffffff, emissiveMap: paintEmissive(prof), emissiveIntensity: 1.5
    });
    addMesh(body, geo, bodyMat);

    // --- 鋳鉄のリング(帯) ---
    const R0 = y => { for (let j = 0; j < P - 1; j++) if (prof[j][1] <= y && prof[j + 1][1] > y) { const f = (y - prof[j][1]) / (prof[j + 1][1] - prof[j][1]); return prof[j][0] + (prof[j + 1][0] - prof[j][0]) * f; } return 0; };
    const rO = y => R0(y) + 8 + 8; // リブの頂より8外
    const BY0 = -62, BY1 = -8;
    const bandPts = [[BY0, -12]];
    [[-62, 0.5], [-60.5, 3], [-56, 3.5], [-54, 3], [-52, 0.5], [-50, 0], [-20, 0], [-18, 0.5], [-16, 3], [-12, 3.5], [-9.5, 3], [-8, 0.5]]
      .forEach(([y, e]) => bandPts.push([y, e]));
    bandPts.push([BY1, -12]);
    const bandProf = bandPts.map(([y, e], k) => new THREE.Vector2(rO(y) + e, y));
    const bandGeo = new THREE.LatheGeometry(bandProf, 96);
    const ironTex = paintIron(512, { seed: 7, mottle: 80, flowers: 14, base: '#26231f' });
    const ironMat = new THREE.MeshStandardMaterial({ map: ironTex, bumpMap: ironTex, bumpScale: 1.2, roughness: 0.55, metalness: 0.5 });
    addMesh(body, bandGeo, ironMat);

    const lowPts = [[-172, -3], [-170, 3], [-166, 4.5], [-162, 3], [-160, -3]].map(([y, e]) => new THREE.Vector2(R0(y) + 8 * 0.4 + 2 + e + 3, y));
    addMesh(body, new THREE.LatheGeometry(lowPts, 96), ironMat);

    // リベット(1メッシュのインスタンス)
    const hipAng = [0, 1, 2, 3, 4, 5].map(i => (30 + 60 * i) * PI / 180);
    const rivPos = [];
    for (const ry of [-43, -27]) {
      const n = 48;
      for (let k = 0; k < n; k++) {
        const ph = 2 * PI * (k + 0.5) / n;
        if (hipAng.some(h => Math.abs(Math.atan2(Math.sin(ph - h), Math.cos(ph - h))) < 22 * PI / 180)) continue;
        rivPos.push([ph, ry]);
      }
    }
    const rivGeo = new THREE.SphereGeometry(3.4, 10, 6, 0, 2 * PI, 0, PI / 2);
    const riv = new THREE.InstancedMesh(rivGeo, ironMat, rivPos.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    rivPos.forEach(([ph, y], k) => {
      const dir = new THREE.Vector3(Math.sin(ph), 0, Math.cos(ph));
      q.setFromUnitVectors(up, dir);
      mtx.compose(dir.clone().multiplyScalar(rO(y)).setY(y), q, one);
      riv.setMatrixAt(k, mtx);
    });
    riv.castShadow = riv.receiveShadow = true; body.add(riv);

    // --- 脚(太い3案) ---
    const rhoH = 275, hipY = -35;
    const knee0 = new THREE.Vector2(500, 900), hip0 = new THREE.Vector2(rhoH, 600 + hipY), foot0 = new THREE.Vector2(600, 0);
    const L1 = knee0.distanceTo(hip0), L2 = foot0.distanceTo(knee0);
    const rFem = z => 22 + 18 * Math.pow(1 - z / L1, 1.2);
    const rTib = z => 7 + 15 * Math.pow(1 - z / L2, 1.1);

    const legTex = paintIron(512, { seed: 99, mottle: 70, flowers: 5, fs: 0.7, base: '#2b2724' });
    legTex.repeat.set(1, 3);
    let legMatF = new THREE.MeshStandardMaterial({ map: legTex, bumpMap: legTex, bumpScale: 1.5, roughness: 0.42, metalness: 0.3 });
    let legMatT = legMatF, femurGeo, tibiaGeo;
    if (kind === 'strand') {
      femurGeo = strandBone(L1, rFem, 0, 140); tibiaGeo = strandBone(L2, rTib, L1, 240);
    } else if (kind === 'vein') {
      femurGeo = tubeGeo(L1, 140, 96, veinRad(rFem, 0), 30, 18);
      tibiaGeo = tubeGeo(L2, 300, 96, veinRad(rTib, L1), 18, 6);
      const [cf, ef] = paintVein(256, 512, L1, 0, 5), [ct, et] = paintVein(256, 1024, L2, L1, 6);
      const mm = (m, e) => new THREE.MeshStandardMaterial({ map: m, roughness: 0.5, metalness: 0.5, emissive: 0xffffff, emissiveMap: e, emissiveIntensity: 0.8 });
      legMatF = mm(cf, ef); legMatT = mm(ct, et);
    } else {
      femurGeo = tubeGeo(L1, 150, 120, muscleRad(rFem, L1, 0, 3), 30, 18);
      tibiaGeo = tubeGeo(L2, 300, 120, muscleRad(rTib, L2, L1, 9), 18, 6);
    }
    const brkGeo = bracketGeo(), knkGeo = knuckleGeo(), ftGeo = footGeo(2.2);

    g.userData.legs = [];
    for (let i = 0; i < 6; i++) {
      const ph = hipAng[i];
      const hip = new THREE.Object3D(); hip.position.set(rhoH * Math.sin(ph), hipY, rhoH * Math.cos(ph)); body.add(hip);
      addMesh(hip, brkGeo, ironMat);
      const femur = new THREE.Object3D(); hip.add(femur);
      const fm = addMesh(femur, femurGeo, legMatF); fm.userData.seg = 1; fm.userData.leg = i;
      const knee = new THREE.Object3D(); knee.position.set(0, 0, L1); femur.add(knee);
      addMesh(knee, knkGeo, ironMat);
      const tm = addMesh(knee, tibiaGeo, legMatT); tm.userData.seg = 2; tm.userData.leg = i;
      const ft = addMesh(knee, ftGeo, ironMat); ft.position.z = L2;
      g.userData.legs.push({ hip, femur, knee, L1, L2, foot: new THREE.Vector3(600 * Math.sin(ph), 0, 600 * Math.cos(ph)) });
    }
    g.updateMatrixWorld(true);
    g.userData.legs.forEach(l => solveLeg(l, l.foot));
    g.updateMatrixWorld(true);
    g.userData.info = { name: '鋳鉄の灯籠', legStyle: kind, L1, L2, ribs: RIBS, windows: RIBS };
    return g;
  }
  window.MODELS.sculpt_c_strand = function () { return buildLantern('strand'); };
  window.MODELS.sculpt_c_vein = function () { return buildLantern('vein'); };
  window.MODELS.sculpt_c_muscle = function () { return buildLantern('muscle'); };
  window.MODELS.sculpt_c = function () { return window.MODELS.sculpt_c_vein(); };
})();
