// dining.js — ダイニングテーブル + 椅子(1 = 1cm, 原点 = 足元中心, 正面 +Z)
(function () {
  window.MODELS = window.MODELS || {};
  const TAU = Math.PI * 2;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------- テクスチャ ----------------
  function woodCanvas(W, H, base, seed) {
    const r = rng(seed), c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    const P = []; for (let i = 0; i < 10; i++) P.push(r() * TAU);
    const rowN = new Float32Array(H); for (let j = 0; j < H; j++) rowN[j] = r();
    const colN = new Float32Array(W); { let a = 0; for (let i = 0; i < W; i++) { a += (r() - 0.5) * 0.3; a *= 0.97; colN[i] = a; } }
    for (let j = 0; j < H; j++) {
      const v = j / H;
      for (let i = 0; i < W; i++) {
        const u = i / W;
        const warp = (0.025 * Math.sin(TAU * u + P[0]) + 0.012 * Math.sin(TAU * 3 * u + P[1]) + 0.004 * Math.sin(TAU * 9 * u + P[2]))
          * (1 + 0.6 * Math.sin(TAU * 2 * v + P[3]));
        let vv = v + warp; vv -= Math.floor(vv);
        const s = 0.5 + 0.5 * Math.sin(TAU * 9 * vv + 1.6 * Math.sin(TAU * 2 * vv + P[4]));
        const late = Math.pow(s, 7);
        const fine = rowN[Math.floor(vv * H) % H];
        const longv = 0.05 * Math.sin(TAU * 2 * u + P[6]) + 0.03 * Math.sin(TAU * 3 * v + P[7]);
        let k = 1 - 0.16 * late - 0.08 * Math.pow(fine, 4) + longv + colN[i] * 0.05 + (r() - 0.5) * 0.035;
        const o = (j * W + i) * 4;
        d[o] = base[0] * k; d[o + 1] = base[1] * (k * 0.98 + 0.02 - late * 0.03); d[o + 2] = base[2] * (k * 0.95 + 0.05 - late * 0.05); d[o + 3] = 255;
      }
    }
    // 導管(短い暗い線)
    for (let n = 0; n < 4000; n++) {
      const x0 = Math.floor(r() * W), y0 = Math.floor(r() * H), len = 6 + Math.floor(r() * 26), a = 0.04 + r() * 0.08;
      for (let t = 0; t < len; t++) {
        const o = (y0 * W + ((x0 + t) % W)) * 4;
        d[o] *= 1 - a; d[o + 1] *= 1 - a; d[o + 2] *= 1 - a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function endCanvas(base, seed) {
    const r = rng(seed), S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
    const cx = -S * 0.4, cy = S * 1.3;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const dist = Math.hypot(i - cx, j - cy) + 4 * Math.sin(Math.atan2(j - cy, i - cx) * 9);
      const ring = Math.pow(0.5 + 0.5 * Math.sin(dist * 0.32), 6);
      const k = 0.78 - 0.18 * ring + (r() - 0.5) * 0.08;
      const o = (j * S + i) * 4;
      d[o] = base[0] * k; d[o + 1] = base[1] * k; d[o + 2] = base[2] * k * 0.95; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function noiseCanvas(S, base, amp, seed, fib) {
    const r = rng(seed), c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
    for (let i = 0; i < S * S; i++) {
      const k = 1 + (r() - 0.5) * amp;
      d[i * 4] = base[0] * k; d[i * 4 + 1] = base[1] * k; d[i * 4 + 2] = base[2] * k; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (fib) { // フェルトの毛羽
      ctx.lineWidth = 1;
      for (let n = 0; n < 900; n++) {
        const x = r() * S, y = r() * S, a = r() * TAU, l = 2 + r() * 6, g = r() < 0.5 ? 255 : 0;
        ctx.strokeStyle = `rgba(${g},${g},${g},0.035)`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
    }
    return c;
  }
  function fabricCanvas(base, seed) {
    const r = rng(seed), S = 512, T = 4, c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
    const nT = S / T, rowK = [], colK = [];
    for (let i = 0; i < nT; i++) { rowK.push(1 + (r() - 0.5) * (r() < 0.12 ? 0.22 : 0.08)); colK.push(1 + (r() - 0.5) * (r() < 0.12 ? 0.22 : 0.08)); }
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const ci = Math.floor(i / T), cj = Math.floor(j / T), over = (ci + cj) & 1;
      const f = over ? ((j % T) - (T - 1) / 2) / (T / 2) : ((i % T) - (T - 1) / 2) / (T / 2);
      let k = (1 - 0.2 * f * f) * (over ? rowK[cj] : colK[ci]) * (over ? 1.02 : 0.96) + (r() - 0.5) * 0.06;
      const o = (j * S + i) * 4;
      d[o] = base[0] * k; d[o + 1] = base[1] * k; d[o + 2] = base[2] * k; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function labelCanvas() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#efe9da'; x.fillRect(0, 0, 256, 160);
    x.fillStyle = 'rgba(120,100,60,0.12)'; x.fillRect(0, 120, 256, 40);
    x.fillStyle = '#2a2622'; x.font = 'bold 22px sans-serif'; x.fillText('DINING TABLE', 14, 32);
    x.font = '15px sans-serif';
    x.fillText('MODEL  DT-1408  OAK', 14, 56); x.fillText('W1400 D800 H720', 14, 76); x.fillText('LOT 0417   2026.10', 14, 96);
    for (let i = 0; i < 46; i++) { const w = (i * 7919) % 3 + 1; x.fillRect(14 + i * 4.6, 108, w, 38); }
    x.strokeStyle = '#2a2622'; x.lineWidth = 2; x.strokeRect(4, 4, 248, 152);
    return c;
  }

  let TEX = null;
  function textures() {
    if (TEX) return TEX;
    const ct = (cv, rep) => { const t = new THREE.CanvasTexture(cv); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t; };
    const wood = ct(woodCanvas(1024, 512, [182, 146, 110], 11), true);
    const end = ct(endCanvas([182, 142, 100], 5), true);
    const felt = ct(noiseCanvas(128, [128, 122, 112], 0.14, 3, true), true);
    const fabric = ct(fabricCanvas([196, 184, 160], 9), true);
    const label = ct(labelCanvas(), false);
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
    TEX = {
      wood: std({ map: wood, bumpMap: wood, bumpScale: 0.1, roughness: 0.52, metalness: 0 }),
      end: std({ map: end, bumpMap: end, bumpScale: 0.3, roughness: 0.75 }),
      metal: std({ color: 0xc9ccd0, metalness: 0.1, roughness: 0.35 }),
      dark: std({ color: 0x2c2a27, metalness: 0.3, roughness: 0.6 }),
      felt: std({ map: felt, bumpMap: felt, bumpScale: 0.2, roughness: 1 }),
      fabric: std({ map: fabric, bumpMap: fabric, bumpScale: 0.5, roughness: 0.95 }),
      pipe: std({ map: fabric, bumpMap: fabric, bumpScale: 0.5, roughness: 0.95, color: 0xb8ab94 }),
      stitch: std({ color: 0x8c7d64, roughness: 0.9 }),
      label: std({ map: label, roughness: 0.85 }),
    };
    return TEX;
  }

  // ---------------- ジオメトリ道具 ----------------
  // rings: [y, w(x), d(z), chamfer, cx, cz]  y方向に伸びる面取り角柱
  function prism(rings) {
    const pts = rings.map(([y, w, d, c, cx = 0, cz = 0]) => {
      const a = w / 2, b = d / 2;
      return [[-a + c, -b], [a - c, -b], [a, -b + c], [a, b - c], [a - c, b], [-a + c, b], [-a, b - c], [-a, -b + c]]
        .map(([x, z]) => [cx + x, y, cz + z]);
    });
    const P = [], push = (...vs) => vs.forEach((v) => P.push(v[0], v[1], v[2]));
    for (let r = 0; r < pts.length - 1; r++) {
      const L = pts[r], U = pts[r + 1];
      for (let k = 0; k < 8; k++) { const k1 = (k + 1) % 8; push(L[k], U[k1], L[k1]); push(L[k], U[k], U[k1]); }
    }
    const B = pts[0], T = pts[pts.length - 1];
    for (let k = 1; k < 7; k++) { push(T[0], T[k + 1], T[k]); push(B[0], B[k], B[k + 1]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.computeVertexNormals();
    return g;
  }
  // 軸方向の角材。h=縦寸法(y軸材ならx寸法), t=厚み。端も小さく面取り
  function bar(axis, len, h, t, c, e) {
    c = c == null ? 0.25 : c; e = e == null ? 0.15 : e;
    const L = len / 2;
    let w, d, rot;
    if (axis === 'x') { w = h; d = t; rot = [0, 0, -Math.PI / 2]; }
    else if (axis === 'z') { w = t; d = h; rot = [Math.PI / 2, 0, 0]; }
    else { w = h; d = t; rot = [0, 0, 0]; }
    const rings = e > 0
      ? [[-L, w - 2 * e, d - 2 * e, Math.max(c - e, 0.02)], [-L + e, w, d, c], [L - e, w, d, c], [L, w - 2 * e, d - 2 * e, Math.max(c - e, 0.02)]]
      : [[-L, w, d, c], [L, w, d, c]];
    return { geo: prism(rings), rot };
  }
  function boxUV(g, a, uo, vo, su, sv, es) {
    const p = g.attributes.position.array, n = g.attributes.normal.array, cnt = p.length / 3, uv = new Float32Array(cnt * 2);
    const b = (a + 1) % 3, c = (a + 2) % 3;
    for (let i = 0; i < cnt; i++) {
      const na = Math.abs(n[i * 3 + a]), nb = Math.abs(n[i * 3 + b]), nc = Math.abs(n[i * 3 + c]);
      if (na > nb && na > nc) { uv[i * 2] = p[i * 3 + b] / es + uo; uv[i * 2 + 1] = p[i * 3 + c] / es + vo; }
      else { uv[i * 2] = p[i * 3 + a] / su + uo; uv[i * 2 + 1] = (nb > nc ? p[i * 3 + c] : p[i * 3 + b]) / sv + vo; }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  function M(x, y, z, rx, ry, rz) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(1, 1, 1));
  }
  function Mq(pos, dir) { // ローカル+Y を dir に向ける
    return new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), new THREE.Vector3(1, 1, 1));
  }

  // 材質ごとにまとめて1メッシュにする
  class Builder {
    constructor() { this.b = {}; }
    bucket(k) { return this.b[k] || (this.b[k] = { p: [], n: [], u: [], c: [] }); }
    add(key, geo, mat, o) {
      o = o || {};
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      if (o.grain !== undefined) boxUV(g, o.grain, o.uo || 0, o.vo || 0, o.su || 90, o.sv || 45, o.es || 14);
      if (o.uvMul && g.attributes.uv) { const a = g.attributes.uv.array; for (let i = 0; i < a.length; i += 2) { a[i] *= o.uvMul[0]; a[i + 1] *= o.uvMul[1]; } }
      const cnt = g.attributes.position.count, nl = g.attributes.normal.array;
      const flags = [];
      for (let t = 0; t < cnt; t += 3) flags.push(o.end && o.grain !== undefined && Math.abs(nl[t * 3 + o.grain]) > 0.7);
      if (mat) g.applyMatrix4(mat);
      const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv ? g.attributes.uv.array : null;
      const tint0 = o.tint || [1, 1, 1], tintU = tint0.map((v) => v * (o.under || 1));
      for (let t = 0; t < cnt; t += 3) {
        const B = this.bucket(flags[t / 3] ? o.end : key);
        const tint = n[t * 3 + 1] < -0.6 ? tintU : tint0;
        for (let v = t; v < t + 3; v++) {
          B.p.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); B.n.push(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]);
          B.u.push(uv ? uv[v * 2] : 0, uv ? uv[v * 2 + 1] : 0); B.c.push(tint[0], tint[1], tint[2]);
        }
      }
    }
    build(group, mats) {
      for (const k in this.b) {
        const B = this.b[k], g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mats[k]); m.name = k;
        m.castShadow = k !== 'stitch' && k !== 'label'; m.receiveShadow = true;
        group.add(m);
      }
    }
  }

  // ネジ: pos は頭の座面、dir は頭が向く方向
  function screw(b, pos, dir, r) {
    r = r || 0.42;
    const d = dir.clone().normalize();
    const head = new THREE.CylinderGeometry(r * 0.75, r, r * 0.4, 14);
    head.translate(0, r * 0.2, 0);
    b.add('metal', head, Mq(pos, d));
    const s1 = new THREE.BoxGeometry(r * 1.5, 0.06, r * 0.22); s1.translate(0, r * 0.4 + 0.005, 0);
    const s2 = new THREE.BoxGeometry(r * 0.22, 0.06, r * 1.5); s2.translate(0, r * 0.4 + 0.005, 0);
    b.add('dark', s1, Mq(pos, d)); b.add('dark', s2, Mq(pos, d));
  }
  function felt(b, x, z, r) {
    const g = new THREE.CylinderGeometry(r, r * 1.03, 0.35, 22);
    b.add('felt', g, M(x, 0.175, z), { uvMul: [1, 0.25] });
  }
  // 曲げ(正面+Z側に凹)。BoxGeometry を x方向に曲げる
  function bentBoard(len, h, t, R, seg, grainOff) {
    const g = new THREE.BoxGeometry(len, h, t, seg, 1, 1);
    boxUV(g, 0, grainOff[0], grainOff[1], 90, 45, 14);
    const p = g.attributes.position, half = len / 2, shift = R * (1 - Math.cos(half / R));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), th = x / R, rr = R - z;
      p.setXYZ(i, rr * Math.sin(th), p.getY(i), R - rr * Math.cos(th) - shift);
    }
    g.computeVertexNormals();
    return { g, shift };
  }

  // =============== テーブル ===============
  window.MODELS.diningTable = function () {
    const mats = textures(), b = new Builder(), R = rng(1408), grp = new THREE.Group();
    const tint = () => { const k = 0.9 + R() * 0.13; return [k, k * (0.98 + R() * 0.03), k * (0.95 + R() * 0.06)]; };
    const W = 140, D = 80, TH = 3.2, TOPY = 72 - TH; // 天板下面 68.8
    const wo = (o) => Object.assign({ under: 1.8, grain: 1, end: 'end', uo: R() * 7, vo: R() * 7, tint: tint() }, o || {});

    // 天板: 4枚はぎ
    const NP = 4, PW = D / NP;
    for (let i = 0; i < NP; i++) {
      const L = W / 2, e = 0.3, c = 0.3;
      const g = prism([[-L, TH - 2 * e, PW - 0.04 - 2 * e, 0.05], [-L + e, TH, PW - 0.04, c], [L - e, TH, PW - 0.04, c], [L, TH - 2 * e, PW - 0.04 - 2 * e, 0.05]]);
      b.add('wood', g, M(0, TOPY + TH / 2, -D / 2 + PW * (i + 0.5), 0, 0, -Math.PI / 2), wo());
    }
    // 脚: 先細りの角脚
    const LX = 62, LZ = 32, AH = 9, AT = 2;
    const legs = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * LX, z = sz * LZ; legs.push([x, z, sx, sz]);
      const g = prism([[0.35, 4.0, 4.0, 0.3], [0.75, 4.4, 4.4, 0.4], [TOPY - 0.02, 6, 6, 0.45]]);
      b.add('wood', g, M(x, 0, z), wo());
      felt(b, x, z, 2.0);
    }
    // 幕板
    const ay = TOPY - AH / 2;
    for (const sz of [-1, 1]) {
      const { geo, rot } = bar('x', 2 * (LX - 3) + 1, AH, AT, 0.3, 0);
      b.add('wood', geo, M(0, ay, sz * (LZ + 3 - 0.8 - AT / 2), ...rot), wo());
    }
    for (const sx of [-1, 1]) {
      const { geo, rot } = bar('z', 2 * (LZ - 3) + 1, AH, AT, 0.3, 0);
      b.add('wood', geo, M(sx * (LX + 3 - 0.8 - AT / 2), ay, 0, ...rot), wo());
    }
    const ainZ = LZ + 3 - 0.8 - AT, ainX = LX + 3 - 0.8 - AT; // 幕板の内面 32.2 / 62.2
    // 反り止めの桟(天板裏)
    for (const x of [-32, 0, 32]) {
      const { geo, rot } = bar('z', 2 * ainZ - 0.4, 2.4, 4.5, 0.3, 0.25);
      b.add('wood', geo, M(x, TOPY - 1.2, 0, ...rot), wo());
      for (const z of [-22, -8, 8, 22]) screw(b, new THREE.Vector3(x + (z % 16 === 0 ? 0.8 : -0.8), TOPY - 2.4, z), new THREE.Vector3(0, -1, 0), 0.45);
    }
    // 隅金具 + 吊りボルト + 蝶ナット
    const down = new THREE.Vector3(0, -1, 0);
    for (const [x, z, sx, sz] of legs) {
      const p1 = new THREE.Vector3(sx * ainX, ay, sz * (LZ - 3 - 6.5));
      const p2 = new THREE.Vector3(sx * (LX - 3 - 6.5), ay, sz * ainZ);
      const mid = p1.clone().add(p2).multiplyScalar(0.5), dir = p2.clone().sub(p1), len = dir.length();
      const ry = -Math.atan2(dir.z, dir.x);
      const nrm = new THREE.Vector3(-sx, 0, -sz).normalize(); // 内向き
      const plate = new THREE.BoxGeometry(len + 1.2, 5.5, 0.3);
      b.add('metal', plate, M(mid.x, mid.y, mid.z, 0, ry, 0));
      // 縁の折り返しリブ
      for (const dy of [-2.6, 2.6]) {
        const rib = new THREE.BoxGeometry(len - 1, 0.3, 1.0);
        rib.translate(0, 0, 0.5);
        b.add('metal', rib, M(mid.x, mid.y + dy, mid.z, 0, ry + (sx * sz > 0 ? Math.PI : 0), 0));
      }
      // 金具を幕板に留めるネジ
      for (const t of [0.18, 0.82]) {
        const sp = p1.clone().lerp(p2, t).add(nrm.clone().multiplyScalar(0.15));
        screw(b, sp, nrm, 0.4);
      }
      // ボルト(脚の内角から)
      const legC = new THREE.Vector3(x - sx * 3, ay, z - sz * 3);
      const boltEnd = mid.clone().add(nrm.clone().multiplyScalar(1.8));
      const bv = boltEnd.clone().sub(legC), bl = bv.length();
      const bolt = new THREE.CylinderGeometry(0.42, 0.42, bl, 10); bolt.translate(0, bl / 2, 0);
      b.add('metal', bolt, Mq(legC, bv));
      const wpos = mid.clone().add(nrm.clone().multiplyScalar(0.15));
      const washer = new THREE.CylinderGeometry(1.25, 1.25, 0.16, 18); washer.translate(0, 0.08, 0);
      b.add('metal', washer, Mq(wpos, nrm));
      const nut = new THREE.CylinderGeometry(0.9, 0.9, 0.75, 6); nut.translate(0, 0.16 + 0.35, 0);
      b.add('metal', nut, Mq(wpos, nrm));
    }
    // 天板留め金具(Z金具)
    const clip = (px, pz, inX, inZ) => {
      // inX/inZ: 金具の伸びる方向(幕板の溝へ)
      const g = new THREE.BoxGeometry(inX ? 3.2 : 2.2, 0.22, inZ ? 3.2 : 2.2);
      b.add('metal', g, M(px + inX * 1.0, TOPY - 0.11, pz + inZ * 1.0));
      const g2 = new THREE.BoxGeometry(inX ? 0.22 : 2.2, 0.9, inZ ? 0.22 : 2.2);
      b.add('metal', g2, M(px - inX * 0.5, TOPY - 0.45, pz - inZ * 0.5));
      screw(b, new THREE.Vector3(px + inX * 0.3, TOPY - 0.22, pz + inZ * 0.3), down, 0.38);
    };
    for (const sz of [-1, 1]) for (const x of [-48, -16, 16, 48]) clip(x, sz * (ainZ - 1.2), 0, sz);
    for (const sx of [-1, 1]) for (const z of [-14, 14]) clip(sx * (ainX - 1.2), z, sx, 0);
    // 製品ラベル
    const lab = new THREE.PlaneGeometry(9, 5.6);
    b.add('label', lab, M(16, TOPY - 0.03, -12, Math.PI / 2, 0, 0));

    b.build(grp, mats);
    const C = [[-W / 2, TOPY, -D / 2, W / 2, 72, D / 2]];
    for (const [x, z] of legs) C.push([x - 3, 0, z - 3, x + 3, TOPY, z + 3]);
    for (const sz of [-1, 1]) C.push([-(LX - 3), TOPY - AH, sz > 0 ? ainZ : -(ainZ + AT), LX - 3, TOPY, sz > 0 ? ainZ + AT : -ainZ]);
    for (const sx of [-1, 1]) C.push([sx > 0 ? ainX : -(ainX + AT), TOPY - AH, -(LZ - 3), sx > 0 ? ainX + AT : -ainX, TOPY, LZ - 3]);
    for (const x of [-32, 0, 32]) C.push([x - 2.25, TOPY - 2.4, -ainZ, x + 2.25, TOPY, ainZ]);
    grp.userData.colliders = C;
    return grp;
  };

  // =============== 椅子 ===============
  window.MODELS.diningChair = function () {
    const mats = textures(), b = new Builder(), R = rng(4401), grp = new THREE.Group();
    const tint = () => { const k = 0.9 + R() * 0.13; return [k, k * (0.98 + R() * 0.03), k * (0.95 + R() * 0.06)]; };
    const wo = (o) => Object.assign({ under: 1.8, grain: 1, end: 'end', uo: R() * 7, vo: R() * 7, tint: tint() }, o || {});
    const LX = 18.5, FZ = 17.5;
    const backZ = (y) => y <= 40 ? -20 + 2.5 * (y / 40) : -17.5 - 6 * (y - 40) / 46;
    const TILT = Math.atan2(6, 46);
    const SEAT = 39; // 座板下面

    // 脚
    for (const sx of [-1, 1]) {
      const x = sx * LX;
      b.add('wood', prism([[0.35, 3.0, 3.0, 0.25], [0.75, 3.4, 3.4, 0.3], [SEAT, 4, 4, 0.35]]), M(x, 0, FZ), wo());
      felt(b, x, FZ, 1.6);
      const ys = [0.35, 0.75, 20, 40, 60, 86, 86.9];
      const sz = [[3.0, 3.2], [3.4, 3.6], [3.7, 3.8], [4, 4], [3.8, 3.7], [3.6, 3.2], [2.4, 2.0]];
      b.add('wood', prism(ys.map((y, i) => [y, sz[i][0], sz[i][1], i === 6 ? 0.25 : 0.33, x, backZ(y)])), null, wo());
      felt(b, x, backZ(0.2), 1.6);
    }
    // 座枠
    const RY = 35.5, RH = 7, RT = 2;
    { const { geo, rot } = bar('x', 2 * (LX - 2) + 1, RH, RT, 0.3, 0); b.add('wood', geo, M(0, RY, FZ + 2 - 0.6 - RT / 2, ...rot), wo()); }
    { const { geo, rot } = bar('x', 2 * (LX - 2) + 1, RH, RT, 0.3, 0); b.add('wood', geo, M(0, RY, backZ(RY) - 0.3, ...rot), wo()); }
    const sideZ0 = backZ(RY) + 2, sideZ1 = FZ - 2;
    for (const sx of [-1, 1]) {
      const { geo, rot } = bar('z', sideZ1 - sideZ0 + 1, RH, RT, 0.3, 0);
      b.add('wood', geo, M(sx * (LX + 2 - 0.6 - RT / 2), RY, (sideZ0 + sideZ1) / 2, ...rot), wo());
    }
    // 隅木 + ネジ
    const inX = LX + 2 - 0.6 - RT, inFZ = FZ + 2 - 0.6 - RT, inBZ = backZ(RY) - 0.3 + RT / 2;
    for (const sx of [-1, 1]) for (const [zc, sz] of [[inFZ, 1], [inBZ, -1]]) {
      const g = new THREE.BoxGeometry(6.5, 4.5, 2.4);
      const px = sx * (inX - 1.9), pz = zc - sz * 1.9;
      b.add('wood', g, M(px, SEAT - 2.5, pz, 0, sx * sz * Math.PI / 4, 0), wo({ grain: 0 }));
      screw(b, new THREE.Vector3(px, SEAT - 4.75, pz), new THREE.Vector3(0, -1, 0), 0.4);
    }
    // 座板
    const PZ0 = backZ(40) + 2, PZ1 = 21.5;
    { const { geo, rot } = bar('x', 42, 1.5, PZ1 - PZ0, 0.45, 0.3); b.add('wood', geo, M(0, SEAT + 0.75, (PZ0 + PZ1) / 2, ...rot), wo()); }
    { const { geo, rot } = bar('x', 2 * (LX - 2), 1.5, 3.6, 0.3, 0.1); b.add('wood', geo, M(0, SEAT + 0.75, PZ0 - 1.8, ...rot), wo()); }
    // 座面を留めるネジ(座枠の内側から斜め)… 下から見える位置に
    for (const sx of [-1, 1]) for (const z of [-6, 6]) screw(b, new THREE.Vector3(sx * (inX - 0.1), SEAT - 1.6, z), new THREE.Vector3(-sx, -0.6, 0), 0.38);

    // 貫(H型 + 後ろ)
    const SY = 11.5;
    for (const sx of [-1, 1]) {
      const z0 = backZ(SY), z1 = FZ;
      const { geo, rot } = bar('z', z1 - z0, 2.8, 2.0, 0.3, 0);
      b.add('wood', geo, M(sx * LX, SY, (z0 + z1) / 2, ...rot), wo());
    }
    { const { geo, rot } = bar('x', 2 * LX - 1.6, 2.4, 2.2, 0.3, 0); b.add('wood', geo, M(0, SY + 0.1, (backZ(SY) + FZ) / 2, ...rot), wo()); }
    { const { geo, rot } = bar('x', 2 * LX - 2.4, 2.6, 2.0, 0.3, 0); b.add('wood', geo, M(0, 19.5, backZ(19.5), ...rot), wo()); }

    // 背もたれ
    const BR = 90;
    const rail = (yc, h, t) => {
      const { g, shift } = bentBoard(2 * LX - 2.2, h, t, BR, 16, [R() * 7, R() * 7]);
      b.add('wood', g, M(0, yc, backZ(yc), -TILT, 0, 0), { tint: tint() });
      return shift;
    };
    const shift = rail(80, 8, 2.2);
    rail(54, 4, 2.0);
    const slats = [-9.5, 0, 9.5];
    for (const x of slats) {
      const yc = 66, th = x / BR, dz = BR * (1 - Math.cos(th)) - shift;
      const { geo, rot } = bar('y', 20.5, 3.4, 1.3, 0.3, 0);
      b.add('wood', geo, M(x, yc, backZ(yc) + dz, -TILT, -th, 0), wo());
    }

    // クッション
    const CW = 40, CD = 36, CH = 4, CZ = (PZ0 + 0.3 + 20.8) / 2, CY0 = SEAT + 1.5;
    const cd = 20.8 - (PZ0 + 0.3);
    const rc = 3, hw = CW / 2, hd = cd / 2;
    const bulge = (x, z) => { const nx = x / hw, nz = z / hd; return 1.5 * Math.pow(Math.max(0, 1 - nx * nx), 1.2) * Math.pow(Math.max(0, 1 - nz * nz), 1.2); };
    {
      const g = new THREE.BoxGeometry(CW, CH, cd, 28, 4, 26), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const cx = Math.max(-(hw - rc), Math.min(hw - rc, x)), cz = Math.max(-(hd - rc), Math.min(hd - rc, z));
        let dx = x - cx, dz = z - cz; const l = Math.hypot(dx, dz);
        if (l > 1e-6) { const m = Math.max(Math.abs(dx), Math.abs(dz)) / l; dx *= m; dz *= m; }
        x = cx + dx; z = cz + dz;
        const ny = y / (CH / 2), s = 1 - 0.045 * ny * ny;
        const bx = x, bz = z;
        x *= s; z *= s;
        y += bulge(bx, bz) * Math.max(0, ny) + (ny > -1 ? 0 : 0);
        p.setXYZ(i, x, y, z);
      }
      g.computeVertexNormals();
      boxUV(g, 1, 0, 0, 12, 12, 12);
      // boxUV(grain=y) は上面を end 扱い → (z,x)/20 で貼られる
      b.add('fabric', g, M(0, CY0 + CH / 2, CZ));
    }
    // パイピング(上下の縁)と縫い目
    const rrect = (ax, az, r, n) => {
      const pts = [], per = 4 * (ax - r) + 4 * (az - r) + TAU * r;
      const segs = [[ax - r, az - r, 0], [-(ax - r), az - r, Math.PI / 2], [-(ax - r), -(az - r), Math.PI], [ax - r, -(az - r), Math.PI * 1.5]];
      for (let i = 0; i < n; i++) {
        // 角丸長方形を弧長パラメータで
        let t = (i / n) * per; const sides = [2 * (az - r), 2 * (ax - r), 2 * (az - r), 2 * (ax - r)];
        let x = ax, z = -(az - r);
        const walk = [];
        // 右辺(+x)を -z→+z、角、上辺 +x→-x、…
        const path = [
          { len: sides[0], f: (s) => [ax, -(az - r) + s] },
          { len: TAU * r / 4, f: (s) => [ax - r + r * Math.cos(s / r), az - r + r * Math.sin(s / r)] },
          { len: sides[1], f: (s) => [ax - r - s, az] },
          { len: TAU * r / 4, f: (s) => [-(ax - r) - r * Math.sin(s / r), az - r + r * Math.cos(s / r)] },
          { len: sides[2], f: (s) => [-ax, az - r - s] },
          { len: TAU * r / 4, f: (s) => [-(ax - r) - r * Math.cos(s / r), -(az - r) - r * Math.sin(s / r)] },
          { len: sides[3], f: (s) => [-(ax - r) + s, -az] },
          { len: TAU * r / 4, f: (s) => [ax - r + r * Math.sin(s / r), -(az - r) - r * Math.cos(s / r)] },
        ];
        for (const seg of path) { if (t <= seg.len) { [x, z] = seg.f(t); break; } t -= seg.len; }
        pts.push([x, z]);
      }
      return { pts, per };
    };
    const sTop = 1 - 0.045;
    for (const [yy, sc] of [[CY0 + CH, sTop], [CY0, sTop]]) {
      const { pts, per } = rrect(hw * sc, hd * sc, rc * sc, 160);
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, yy, z + CZ)), true);
      const tube = new THREE.TubeGeometry(curve, 320, 0.38, 7, true);
      b.add('pipe', tube, null, { uvMul: [per / 2, 0.4] });
    }
    // 上面の縫い目(パイピング内側 1.3cm)
    {
      const ins = 1.3, { pts } = rrect(hw * sTop - ins, hd * sTop - ins, Math.max(0.5, rc * sTop - ins), 210);
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
        const yv = CY0 + CH + bulge(x / sTop, z / sTop) + 0.02;
        const g = new THREE.BoxGeometry(0.42, 0.09, 0.09);
        b.add('stitch', g, M(x, yv, z + CZ, 0, -Math.atan2(z2 - z, x2 - x), 0));
      }
    }

    b.build(grp, mats);
    // 当たり判定
    const C = [];
    for (const sx of [-1, 1]) {
      const x = sx * LX;
      C.push([x - 2, 0, FZ - 2, x + 2, SEAT, FZ + 2]);
      C.push([x - 2, 0, -21.2, x + 2, SEAT, backZ(SEAT) + 2]);
      C.push([x - 2, SEAT, backZ(64) - 2, x + 2, 64, backZ(SEAT) + 2]);
      C.push([x - 1.8, 64, backZ(87) - 1.6, x + 1.8, 87, backZ(64) + 1.9]);
      C.push([x - 1, SY - 1.4, backZ(SY) + 2, x + 1, SY + 1.4, FZ - 2]);
    }
    C.push([-LX + 1, SY - 1.1, -1.1 + (backZ(SY) + FZ) / 2, LX - 1, SY + 1.3, 1.1 + (backZ(SY) + FZ) / 2]);
    C.push([-LX + 2, 18.2, backZ(19.5) - 1, LX - 2, 20.8, backZ(19.5) + 1]);
    C.push([-21, RY - RH / 2, PZ0 - 3.6, 21, SEAT + 1.5, PZ1]);
    C.push([-hw, CY0, CZ - hd, hw, CY0 + CH + 0.8, CZ + hd]);
    C.push([-LX + 2, 76, backZ(84) - 1.8, LX - 2, 84, backZ(76) + 1.2]);
    C.push([-LX + 2, 52, backZ(56) - 1.5, LX - 2, 56, backZ(52) + 1.2]);
    for (const x of slats) C.push([x - 1.7, 56, backZ(76) - 1.2, x + 1.7, 76, backZ(56) + 1.2]);
    grp.userData.colliders = C;
    return grp;
  };
})();
