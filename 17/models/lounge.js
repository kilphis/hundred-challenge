// lounge.js — リビングのくつろぎ空間: sofa / coffeeTable / rug
// 1 = 1cm, Y up, 正面 +Z, 原点 = 足元中心
(function () {
  window.MODELS = window.MODELS || {};

  // ---------- 乱数・ノイズ ----------
  function hsh(i, j, s) {
    let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vn(x, y, px, py, s) { // 周期つき value noise
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const w = (a, p) => ((a % p) + p) % p;
    const x0 = w(xi, px), x1 = w(xi + 1, px), y0 = w(yi, py), y1 = w(yi + 1, py);
    const a = hsh(x0, y0, s), b = hsh(x1, y0, s), c = hsh(x0, y1, s), d = hsh(x1, y1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, px, py, oct, s) {
    let t = 0, amp = 0.5, n = 0;
    for (let o = 0; o < oct; o++) { t += amp * vn(x, y, px, py, s + o * 17); n += amp; x *= 2; y *= 2; px *= 2; py *= 2; amp *= 0.5; }
    return t / n;
  }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const sm = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------- テクスチャ生成 ----------
  // fn(x,y,o) が o.r,o.g,o.b,(o.a),o.h(高さ0..1) を書く
  function genTex(w, h, fn, opt) {
    opt = opt || {};
    const cc = document.createElement('canvas'); cc.width = w; cc.height = h;
    const cb = document.createElement('canvas'); cb.width = w; cb.height = h;
    const ic = cc.getContext('2d').createImageData(w, h), ib = cb.getContext('2d').createImageData(w, h);
    const o = {};
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      o.r = o.g = o.b = 0; o.a = 255; o.h = 0.5; fn(x, y, o);
      const k = (y * w + x) * 4;
      ic.data[k] = cl(o.r, 0, 255); ic.data[k + 1] = cl(o.g, 0, 255); ic.data[k + 2] = cl(o.b, 0, 255); ic.data[k + 3] = cl(o.a, 0, 255);
      const hv = cl(o.h * 255, 0, 255); ib.data[k] = ib.data[k + 1] = ib.data[k + 2] = hv; ib.data[k + 3] = 255;
    }
    cc.getContext('2d').putImageData(ic, 0, 0); cb.getContext('2d').putImageData(ib, 0, 0);
    const mk = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = opt.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.anisotropy = 8; return t; };
    return { map: mk(cc), bump: mk(cb), canvas: cc };
  }
  function cloneTex(t, rx, ry, rot) { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); if (rot) c.rotation = rot; return c; }

  // ---------- ジオメトリ補助 ----------
  // 角丸＋ふくらみ付きの箱。UV は面ごとの箱投影（T cm で1タイル）
  function rbox(w, h, d, r, opt) {
    opt = opt || {};
    const a = w / 2, b = h / 2, c = d / 2, m = opt.m || 4, res = opt.res || 5, T = opt.T || 12;
    const segs = (half) => 2 * m + Math.max(2, Math.round((2 * half - 2 * r) / res));
    const nx = segs(a), ny = segs(b), nz = segs(c);
    const g = new THREE.BoxGeometry(2, 2, 2, nx, ny, nz);
    const gm = (s, half, n) => { const e = 2 * m / n, as = Math.abs(s); const u = as > 1 - e ? half - r * (1 - as) / e : as / (1 - e) * (half - r); return Math.sign(s) * u; };
    const bx = opt.bx || 0, by = opt.by || 0, bz = opt.bz || 0, byTop = opt.byTop, wr = opt.wr || 0, seed = opt.seed || 1;
    function deform(sx, sy, sz, out) {
      const ux = gm(sx, a, nx), uy = gm(sy, b, ny), uz = gm(sz, c, nz);
      const qx = cl(ux, -(a - r), a - r), qy = cl(uy, -(b - r), b - r), qz = cl(uz, -(c - r), c - r);
      let dx = ux - qx, dy = uy - qy, dz = uz - qz; const L = Math.hypot(dx, dy, dz);
      let px = ux, py = uy, pz = uz;
      if (L > 1e-6) { px = qx + dx / L * r; py = qy + dy / L * r; pz = qz + dz / L * r; }
      const fx = Math.max(0, 1 - (px / a) ** 2), fy = Math.max(0, 1 - (py / b) ** 2), fz = Math.max(0, 1 - (pz / c) ** 2);
      const byy = (py > 0 && byTop !== undefined) ? byTop : by;
      let ox = px + (px / a) * bx * fy * fz, oy = py + (py / b) * byy * fx * fz, oz = pz + (pz / c) * bz * fx * fy;
      if (wr) { // 布のゆるいしわ
        const n = fbm(px / 9 + 3, pz / 9 + py / 9, 64, 64, 3, seed) - 0.5;
        const k = fx * fz; oy += (py > 0 ? 1 : 0) * wr * n * k * 2;
        oz += (pz > 0 ? 1 : 0) * wr * 0.6 * n * fx * fy;
      }
      // UV 用: 角丸の帯は面からの沈み込みぶんだけ外へ延ばす（テクスチャを伸ばさない）
      const ex = Math.abs(ux) > a - r ? Math.sign(ux) : 0, ey = Math.abs(uy) > b - r ? Math.sign(uy) : 0, ez = Math.abs(uz) > c - r ? Math.sign(uz) : 0;
      out.set(ox, oy, oz);
      out.ux = px + ex * ((Math.abs(sy) > 0.999 ? b - Math.abs(py) : 0) + (Math.abs(sz) > 0.999 ? c - Math.abs(pz) : 0));
      out.uy = py + ey * ((Math.abs(sx) > 0.999 ? a - Math.abs(px) : 0) + (Math.abs(sz) > 0.999 ? c - Math.abs(pz) : 0));
      out.uz = pz + ez * ((Math.abs(sx) > 0.999 ? a - Math.abs(px) : 0) + (Math.abs(sy) > 0.999 ? b - Math.abs(py) : 0));
      return out;
    }
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, v = new THREE.Vector3();
    const gy = opt.grain === 'y';
    for (let i = 0; i < pos.count; i++) {
      deform(pos.getX(i), pos.getY(i), pos.getZ(i), v);
      const nX = Math.abs(nor.getX(i)) > 0.5, nY = Math.abs(nor.getY(i)) > 0.5;
      let U, V;
      if (nX) { U = gy ? v.uy : v.uz; V = gy ? v.uz : v.uy; }
      else if (nY) { U = v.ux; V = v.uz; }
      else { U = gy ? v.uy : v.ux; V = gy ? v.ux : v.uy; }
      uv.setXY(i, U / T + (opt.uo || 0), V / T);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); smoothSeams(g);
    g.userData.deform = (sx, sy, sz) => deform(sx, sy, sz, new THREE.Vector3());
    return g;
  }
  function smoothSeams(g) {
    const pos = g.attributes.position, nor = g.attributes.normal, map = new Map();
    for (let i = 0; i < pos.count; i++) {
      const k = Math.round(pos.getX(i) * 100) + ',' + Math.round(pos.getY(i) * 100) + ',' + Math.round(pos.getZ(i) * 100);
      let e = map.get(k); if (!e) { e = [0, 0, 0, []]; map.set(k, e); }
      e[0] += nor.getX(i); e[1] += nor.getY(i); e[2] += nor.getZ(i); e[3].push(i);
    }
    for (const e of map.values()) { if (e[3].length < 2) continue; const L = Math.hypot(e[0], e[1], e[2]) || 1; for (const i of e[3]) nor.setXYZ(i, e[0] / L, e[1] / L, e[2] / L); }
  }
  // 箱のフチ（正規化座標）をなぞるパイピング
  function edgeLoop(g, axis, sgn, rad, n) {
    const d = g.userData.deform, pts = [], N = n || 40;
    const side = (t) => { // 正方形の周囲 t∈[0,4)
      const k = Math.floor(t), f = t - k, s = -1 + 2 * f;
      return k === 0 ? [s, -1] : k === 1 ? [1, s] : k === 2 ? [-s, 1] : [-1, -s];
    };
    for (let i = 0; i < 4 * N; i++) {
      const [p, q] = side(i / N);
      const P = axis === 'y' ? d(p, sgn, q) : axis === 'z' ? d(p, q, sgn) : d(sgn, p, q);
      pts.push(P);
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    return new THREE.TubeGeometry(curve, 4 * N * 2, rad, 6, true);
  }
  // 複数ジオメトリを1つに（position/normal/uv）
  function merge(list) {
    let n = 0; const arr = list.map(([geo, mat]) => { let g = geo.index ? geo.toNonIndexed() : geo.clone(); if (mat) g.applyMatrix4(mat); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); n += g.attributes.position.count; return g; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const g of arr) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
    const r = new THREE.BufferGeometry();
    r.setAttribute('position', new THREE.BufferAttribute(P, 3)); r.setAttribute('normal', new THREE.BufferAttribute(N, 3)); r.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    return r;
  }
  const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
  function mesh(geo, mat, parent, shadow) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = shadow !== false; m.receiveShadow = true; if (parent) parent.add(m); return m;
  }

  // ---------- 共有マテリアル（遅延生成・キャッシュ） ----------
  const C = {};
  function fabricTex() {
    if (C.fabric) return C.fabric;
    // 平織り＋スラブ糸のメランジ。512px / 4px ピッチ = 128 本
    const base = [150, 137, 120];
    C.fabric = genTex(512, 512, (x, y, o) => {
      const cx = x / 4, cy = y / 4, i = Math.floor(cx), j = Math.floor(cy), fx = cx - i, fy = cy - j;
      const warpOver = ((i + j) & 1) === 0;
      const pw = Math.sin(Math.PI * fx), pf = Math.sin(Math.PI * fy);
      const hgt = warpOver ? 0.25 + 0.75 * pw * (0.75 + 0.25 * Math.sin(Math.PI * fy)) : 0.25 + 0.75 * pf * (0.75 + 0.25 * Math.sin(Math.PI * fx));
      const slubW = vn(y / 32, i, 16, 128, 3), slubF = vn(x / 32, j, 16, 128, 5);
      const tone = warpOver ? 1.03 + 0.12 * (hsh(i, 0, 1) - 0.5) + 0.18 * (slubW - 0.5) : 0.95 + 0.12 * (hsh(j, 0, 2) - 0.5) + 0.18 * (slubF - 0.5);
      const mott = 0.93 + 0.12 * fbm(x / 64, y / 64, 8, 8, 3, 9);
      const fuzz = 1 + 0.05 * (hsh(x, y, 7) - 0.5);
      const k = (0.8 + 0.26 * hgt) * tone * mott * fuzz;
      o.r = base[0] * k; o.g = base[1] * k; o.b = base[2] * k * (warpOver ? 0.98 : 1.02);
      o.h = hgt * (0.85 + 0.3 * (warpOver ? slubW : slubF));
    });
    return C.fabric;
  }
  function fabricMat(tint, rx, ry) {
    const t = fabricTex();
    return new THREE.MeshStandardMaterial({ color: tint || 0xffffff, map: rx ? cloneTex(t.map, rx, ry) : t.map, bumpMap: rx ? cloneTex(t.bump, rx, ry) : t.bump, bumpScale: 0.22, roughness: 0.96, metalness: 0 });
  }
  function woodTex() {
    if (C.wood) return C.wood;
    // ウォールナット。横方向が木目。1024x256 = 100cm x 25cm 相当
    C.wood = genTex(1024, 256, (x, y, o) => {
      const warp = fbm(x / 128, y / 32, 8, 8, 4, 21);
      const v = y / 256 * 18 + warp * 1.6 + 0.25 * fbm(x / 32, y / 16, 32, 16, 2, 22);
      const ring = v - Math.floor(v);
      const late = sm(0.6, 0.9, ring) * (1 - sm(0.9, 1.0, ring));
      const fig = fbm(x / 256, y / 64, 4, 4, 3, 23), streak = vn(x / 64, y / 1.5, 16, 170, 26);
      const k = 1 + 0.25 * (fig - 0.5) + 0.12 * (streak - 0.5);
      let r = (104 - 26 * late) * k, g = (70 - 19 * late) * k, b = (48 - 12 * late) * k;
      const pore = vn(x / 6, y / 1.5, 1024 / 8 * 1.333 | 0, 256 / 1.5 | 0, 24);
      let hh = 0.6 - 0.25 * late;
      if (pore > 0.82) { const p = (pore - 0.82) / 0.18; r -= 35 * p; g -= 26 * p; b -= 18 * p; hh -= 0.4 * p; }
      const n = 1 + 0.04 * (hsh(x, y, 25) - 0.5); o.r = r * n; o.g = g * n; o.b = b * n; o.h = hh;
    });
    return C.wood;
  }
  function woodMat(rx, ry, rot, rough, tint) {
    const t = woodTex();
    return new THREE.MeshPhysicalMaterial({ color: tint || 0xffffff, map: cloneTex(t.map, rx, ry, rot), bumpMap: cloneTex(t.bump, rx, ry, rot), bumpScale: 0.12, roughness: rough || 0.5, clearcoat: rough ? 0 : 0.35, clearcoatRoughness: 0.45 });
  }

  // =====================================================================
  // ソファ
  // =====================================================================
  window.MODELS.sofa = function () {
    const g = new THREE.Group();
    const LEG = 11;              // 床から本体底面まで（ネズミが潜れる）
    const fab = fabricMat();
    const fabSeam = fabricMat(0xc9bdb0, 60, 0.12);   // パイピング：同じ布をやや暗く（tint）

    // --- 下台（座面の土台） x -82..82, y 11..38, z -45..45
    const baseG = rbox(164, 27, 90, 2.5, { T: 12, by: 0.2 });
    mesh(baseG, fab, g).position.set(0, LEG + 13.5, 0);
    const baseWelt = mesh(edgeLoop(baseG, 'y', -1, 0.5, 50), fabSeam, g); baseWelt.position.copy(g.children[0].position);

    // --- ひじ掛け x ±(82..100), y 11..62
    for (const sx of [-1, 1]) {
      const ag = rbox(18, 51, 90, 6, { T: 12, bx: 0.8, bz: 0.6, by: 0.4, seed: 4 + sx });
      const am = mesh(ag, fab, g); am.position.set(sx * 91, LEG + 25.5, 0);
      const front = mesh(edgeLoop(ag, 'z', 1, 0.5, 30), fabSeam, g); front.position.copy(am.position);
      const back = mesh(edgeLoop(ag, 'z', -1, 0.5, 30), fabSeam, g); back.position.copy(am.position);
    }
    // --- 背もたれフレーム x -82..82, y 38..78, z -45..-32
    const bpG = rbox(164, 40, 13, 4, { T: 12, bz: 0.5, by: 0.3 });
    const bp = mesh(bpG, fab, g); bp.position.set(0, 58, -38.5);
    mesh(edgeLoop(bpG, 'z', -1, 0.5, 50), fabSeam, g).position.copy(bp.position);

    // --- 座クッション 3つ
    const cw = 164 / 3 - 0.4;
    for (let i = 0; i < 3; i++) {
      const cg = rbox(cw, 12, 77, 3.5, { T: 12, by: 0.6, byTop: 1.9, bx: 0.7, bz: 0.9, wr: 0.45, seed: 30 + i, uo: i * 0.37 });
      const cm = mesh(cg, fab, g); cm.position.set(-164 / 3 + i * (164 / 3), 38 + 6.2, 6.5);
      cm.rotation.y = (i - 1) * 0.004; cm.rotation.x = -0.012;
      for (const s of [-1, 1]) { const p = mesh(edgeLoop(cg, 'y', s, 0.45, 40), fabSeam, cm); }
    }
    // --- 背クッション 3つ（後ろに少し倒す）
    for (let i = 0; i < 3; i++) {
      const bg = rbox(cw, 27, 17, 4.5, { T: 12, bz: 2.4, bx: 0.8, by: 0.6, wr: 0.5, seed: 40 + i, uo: i * 0.21 + 0.5 });
      const piv = new THREE.Group(); piv.position.set(-164 / 3 + i * (164 / 3), 50.6, -23); piv.rotation.x = -0.17; piv.rotation.z = (i - 1) * 0.006; g.add(piv);
      const bm = mesh(bg, fab, piv); bm.position.set(0, 13.5, 0);
      for (const s of [-1, 1]) mesh(edgeLoop(bg, 'z', s, 0.45, 40), fabSeam, bm);
    }

    // --- 底面: 黒い不織布の裏地（少したるむ）
    const dust = genTex(512, 256, (x, y, o) => { // スパンボンドの繊維模様
      let f = 0; for (let k = 0; k < 3; k++) f += vn((x + y * (0.5 - k * 0.4)) / (3 + k), (y - x * 0.3 * k) / 18, 512, 256, 60 + k);
      const dots = vn(x / 8, y / 8, 64, 32, 63) > 0.7 ? 1 : 0; // 熱圧着点
      const v = 175 + 45 * (f / 3) + 12 * dots + 6 * (hsh(x, y, 61) - 0.5) + 12 * fbm(x / 64, y / 64, 8, 4, 2, 62);
      o.r = v; o.g = v; o.b = v + 2; o.h = f / 3 * 0.8 + dots * 0.2;
    });
    const dcGeo = new THREE.PlaneGeometry(194, 83, 48, 20); dcGeo.rotateX(Math.PI / 2);
    { const p = dcGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i);
        const fx = Math.max(0, 1 - (x / 97) ** 2), fz = Math.max(0, 1 - (z / 41.5) ** 2);
        const bay = Math.abs(Math.sin(x / 190 * Math.PI * 2)); // 中央の桟で区切られたたるみ
        p.setY(i, -fx * fz * (0.25 + 0.45 * bay) - 0.25 * (fbm(x / 20 + 5, z / 20 + 5, 64, 64, 2, 64) - 0.5) * fz * fx); } dcGeo.computeVertexNormals(); }
    const dcMat = new THREE.MeshStandardMaterial({ map: cloneTex(dust.map, 6, 3), bumpMap: cloneTex(dust.bump, 6, 3), bumpScale: 0.25, roughness: 1, side: THREE.DoubleSide });
    mesh(dcGeo, dcMat, g).position.y = LEG - 1.05;
    // 木の枠（裏から見える縁）
    const frameMat = woodMat(2, 0.4, 0, 0.85, 0xd8c09a);
    const fr = [];
    for (const z of [-40, 40]) fr.push([new THREE.BoxGeometry(192, 1.2, 3), M4(0, LEG - 0.4, z)]);
    for (const x of [-95, 0, 95]) fr.push([new THREE.BoxGeometry(3, 1.2, 77), M4(x, LEG - 0.4, 0)]);
    mesh(merge(fr), frameMat, g);
    // タッカー（ホチキス）
    const stG = new THREE.BoxGeometry(1.1, 0.12, 0.12), stM = new THREE.MeshStandardMaterial({ color: 0xb8b8b4, metalness: 0.9, roughness: 0.35 });
    const stP = []; const r0 = rng(7);
    for (let x = -92; x <= 92; x += 5) for (const z of [-40.6, 40.6]) stP.push([x + r0() * 1.5, z + (r0() - 0.5) * 0.4, (r0() - 0.5) * 0.4]);
    for (let z = -37; z <= 37; z += 5) for (const x of [-95.6, 95.6]) stP.push([x + (r0() - 0.5) * 0.4, z + r0() * 1.5, Math.PI / 2 + (r0() - 0.5) * 0.4]);
    const st = new THREE.InstancedMesh(stG, stM, stP.length); st.castShadow = false; st.receiveShadow = true;
    stP.forEach((s, i) => st.setMatrixAt(i, M4(s[0], LEG - 1.12, s[1], 0, s[2], 0))); g.add(st);
    // 品質表示タグ（前の桟から垂れ下がる）
    const tag = genTex(128, 256, (x, y, o) => {
      let v = 236 + 8 * (hsh(x, y, 70) - 0.5);
      const row = Math.floor(y / 14), inRow = (y % 14) > 4 && (y % 14) < 9;
      if (y > 40 && y < 230 && inRow && x > 14 && x < 114 - (hsh(row, 0, 71) * 50) && vn(x / 3, row, 64, 32, 72) > 0.35) v = 70;
      if (y < 30 && y > 8 && x > 14 && x < 114) v = (y > 12 && y < 26 && x > 20 && x < 108 && vn(x / 4, y / 4, 32, 64, 73) > 0.45) ? 60 : v;
      o.r = v; o.g = v; o.b = v - 4; o.h = v / 255;
    }, { clamp: true });
    const tagGeo = new THREE.PlaneGeometry(5, 10, 1, 8); { const p = tagGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, 0.25 * Math.sin((y + 5) / 10 * Math.PI)); } tagGeo.computeVertexNormals(); }
    const tagM = mesh(tagGeo, new THREE.MeshStandardMaterial({ map: tag.map, roughness: 0.8, side: THREE.DoubleSide }), g, true);
    tagM.position.set(-58, LEG - 6.2, 40.2); tagM.rotation.set(0.25, 0.15, 0.04);

    // --- 脚 6本（テーパーした木脚＋金属プレート＋フェルト）
    const legPos = [[-92, -38], [92, -38], [-92, 38], [92, 38], [0, -36], [0, 36]];
    const lg = [], pl = [], fe = [];
    const legGeo = new THREE.CylinderGeometry(2.3, 1.6, LEG - 1.8, 20, 4);
    { const u = legGeo.attributes.uv; for (let i = 0; i < u.count; i++) { const cu = u.getX(i), cv = u.getY(i); u.setXY(i, cv * 0.11, cu * 0.5); } }
    for (const [x, z] of legPos) {
      lg.push([legGeo, M4(x, 0.5 + (LEG - 1.8) / 2, z)]);
      pl.push([new THREE.BoxGeometry(7, 0.25, 7), M4(x, LEG - 1.2, z)]);
      for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) pl.push([new THREE.CylinderGeometry(0.45, 0.45, 0.18, 10), M4(x + dx, LEG - 1.36, z + dz)]);
      fe.push([new THREE.CylinderGeometry(1.55, 1.6, 0.5, 18), M4(x, 0.25, z)]);
    }
    mesh(merge(lg), woodMat(1, 1, 0, 0.5), g);
    mesh(merge(pl), new THREE.MeshStandardMaterial({ color: 0x3c3c3e, metalness: 0.7, roughness: 0.45 }), g);
    const felt = genTex(64, 64, (x, y, o) => { const v = 120 + 40 * fbm(x / 8, y / 8, 8, 8, 3, 80) + 20 * (hsh(x, y, 81) - 0.5); o.r = v; o.g = v * 0.96; o.b = v * 0.9; o.h = v / 255; });
    mesh(merge(fe), new THREE.MeshStandardMaterial({ map: felt.map, roughness: 1 }), g);

    // --- ソファの下に落ちているもの
    addUnderSofa(g);

    // --- 当たり判定
    const col = [];
    for (const [x, z] of legPos) col.push([x - 2.3, 0, z - 2.3, x + 2.3, LEG, z + 2.3]);
    col.push([-82, LEG - 2, -45, 82, 38, 45]);        // 下台
    col.push([-82, 38, -32, 82, 50.5, 45]);       // 座クッション（上面に乗れる）
    col.push([-100, LEG, -45, -82, 62, 45]);      // 左ひじ掛け
    col.push([82, LEG, -45, 100, 62, 45]);        // 右ひじ掛け
    col.push([-82, 38, -45, 82, 78, -32]);        // 背フレーム
    col.push([-82, 50.5, -32, 82, 79, -16]);      // 背クッション
    g.userData.colliders = col;
    return g;
  };

  function addUnderSofa(g) {
    const R = rng(1234);
    // うっすら積もったほこりの膜（周囲ほど薄い）
    const film = genTex(512, 256, (x, y, o) => {
      const u = x / 512, v = y / 256;
      const edge = sm(0, 0.12, u) * sm(0, 0.12, 1 - u) * sm(0, 0.2, v) * sm(0, 0.2, 1 - v);
      const n = fbm(x / 32, y / 32, 16, 8, 4, 90), sp = hsh(x, y, 91) > 0.985 ? 1 : 0;
      o.r = 170 + 20 * n; o.g = 164 + 20 * n; o.b = 156 + 18 * n;
      o.a = 255 * cl(edge * (0.22 + 0.35 * (n - 0.35)) + sp * 0.5 * edge, 0, 0.6);
    }, { clamp: true });
    const fm = mesh(new THREE.PlaneGeometry(190, 82), new THREE.MeshStandardMaterial({ map: film.map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), g, false);
    fm.rotation.x = -Math.PI / 2; fm.position.y = 0.04;

    // ほこりの玉（毛玉）: 芯＋アルファの外殻2枚＋はみ出した繊維
    // 繊維を描いたアルファテクスチャ（細い曲線をたくさん）
    const fc = document.createElement('canvas'); fc.width = fc.height = 256; const fx2 = fc.getContext('2d');
    fx2.fillStyle = 'rgba(0,0,0,0)'; fx2.clearRect(0, 0, 256, 256);
    const Rf = rng(555);
    for (let k = 0; k < 1400; k++) {
      let x = Rf() * 256, y = Rf() * 256, a = Rf() * 6.283; const L = 6 + Rf() * 26, v = 150 + Rf() * 90 | 0;
      fx2.strokeStyle = `rgba(${v},${v - 6},${v - 14},1)`; fx2.lineWidth = 0.6 + Rf() * 0.9; fx2.beginPath();
      for (let ox = -256; ox <= 256; ox += 256) for (let oy = -256; oy <= 256; oy += 256) { // タイル化
        let xx = x + ox, yy = y + oy, aa = a; fx2.moveTo(xx, yy);
        for (let t = 0; t < L; t += 2) { aa += (hsh(k, t, 556) - 0.5) * 0.7; xx += Math.cos(aa) * 2; yy += Math.sin(aa) * 2; fx2.lineTo(xx, yy); }
      }
      fx2.stroke();
    }
    const fuzzT = new THREE.CanvasTexture(fc); fuzzT.wrapS = fuzzT.wrapT = THREE.RepeatWrapping;
    const bunnies = [[-60, 10, 3.2], [-20, -22, 2.2], [30, 5, 4.0], [70, -30, 2.6], [8, 30, 1.6], [-85, -25, 1.8]];
    const layers = [[], [], [], [], []], fib = [];
    for (const [bx, bz, s] of bunnies) {
      for (let k = 0; k < 3; k++) {
        const ox = (R() - 0.5) * s * 0.9, oz = (R() - 0.5) * s * 0.9, sc = s * (0.45 + R() * 0.35);
        const geo = new THREE.IcosahedronGeometry(1, 3); const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const d = 1 + 0.25 * (fbm(x * 2 + bx + 9, y * 2 + z * 2 + bz + 9, 64, 64, 3, 97 + k) - 0.5) * 2; p.setXYZ(i, x * d, y * d, z * d); }
        geo.computeVertexNormals();
        { const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 3 * sc / 2, u.getY(i) * 1.5 * sc / 2); }
        const fl = 0.55 + R() * 0.2, ry = R() * 6;
        layers.forEach((L, li) => { const f = 0.7 + li * 0.17; L.push([geo, M4(bx + ox, sc * fl * 0.75, bz + oz, 0, ry + li * 0.9, 0, sc * f, sc * fl * f, sc * f)]); });
      }
      for (let k = 0; k < 40; k++) { // はみ出す繊維・髪の毛
        const a = R() * 6.283, el = (R() - 0.3) * 0.8, r1 = s * (0.3 + R() * 0.4), r2 = r1 + s * (0.4 + R() * 1.1);
        const y0 = s * 0.4;
        fib.push(bx + Math.cos(a) * r1, y0 + Math.sin(el) * r1 * 0.5, bz + Math.sin(a) * r1,
          bx + Math.cos(a + (R() - 0.5) * 0.6) * r2, Math.max(0.05, y0 + Math.sin(el) * r2 * 0.4), bz + Math.sin(a + (R() - 0.5) * 0.6) * r2);
      }
    }
    const flat = (geo) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.03) p.setY(i, 0.03 + 0.02 * p.getY(i) / 10); return geo; };
    layers.forEach((L, li) => {
      const m = li === 0 ? new THREE.MeshStandardMaterial({ color: 0x98928a, roughness: 1 })
        : new THREE.MeshStandardMaterial({ color: new THREE.Color(0x9e9890).multiplyScalar(1 + li * 0.08), alphaMap: fuzzT, map: fuzzT, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide });
      if (li) { m.map = null; m.alphaMap = cloneTex(fuzzT, 1 + li * 0.3, 1 + li * 0.3); }
      mesh(flat(merge(L)), m, g, li === 0);
    });
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fib, 3));
    g.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0x7a746c })));
    // 長い髪の毛 1本
    const hp = []; let hx = -35, hz = 18, ha = 0.4; for (let i = 0; i < 30; i++) { hp.push(new THREE.Vector3(hx, 0.06 + 0.05 * Math.sin(i), hz)); ha += (R() - 0.5) * 0.5; hx += Math.cos(ha) * 1.1; hz += Math.sin(ha) * 1.1; }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 120, 0.035, 4), new THREE.MeshStandardMaterial({ color: 0x1c1612, roughness: 0.4 }), g, false);

    // パンくず（インスタンス）
    const crG = new THREE.DodecahedronGeometry(0.35, 0), crM = new THREE.MeshStandardMaterial({ color: 0xc89a5c, roughness: 0.9 });
    const crumbs = new THREE.InstancedMesh(crG, crM, 22); crumbs.castShadow = crumbs.receiveShadow = true;
    const cc = new THREE.Color();
    for (let i = 0; i < 22; i++) { const x = 25 + (R() - 0.5) * 30, z = 25 + (R() - 0.5) * 18, s = 0.4 + R() * 0.9; crumbs.setMatrixAt(i, M4(x, s * 0.25, z, R() * 3, R() * 3, R() * 3, s, s * 0.6, s * (0.7 + R() * 0.5))); cc.setHSL(0.08 + R() * 0.03, 0.5, 0.35 + R() * 0.25); crumbs.setColorAt(i, cc); }
    g.add(crumbs);

    // 硬貨
    const coinT = genTex(128, 128, (x, y, o) => {
      const dx = x - 64, dy = y - 64, rr = Math.hypot(dx, dy);
      let h = 0.5; if (rr > 56 && rr < 60) h = 0.85; if (rr > 30 && rr < 33) h = 0.7;
      if (Math.abs(dx) < 3 && dy > -18 && dy < 18) h = 0.85; if (Math.abs(dy) < 3 && Math.abs(dx) < 14 && Math.abs(dy - 10) < 3) h = 0.85;
      const tarn = fbm(x / 16, y / 16, 8, 8, 3, 85);
      o.r = 170 - 50 * tarn; o.g = 110 - 40 * tarn; o.b = 70 - 30 * tarn; o.h = h;
    }, { clamp: true });
    const coinMat = new THREE.MeshStandardMaterial({ map: coinT.map, bumpMap: coinT.bump, bumpScale: 0.6, metalness: 0.85, roughness: 0.45 });
    const coin = mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.15, 32), [new THREE.MeshStandardMaterial({ color: 0x8a5a38, metalness: 0.85, roughness: 0.5 }), coinMat, coinMat], g);
    coin.position.set(-40, 0.08, -8); coin.rotation.y = 0.7;
    // 髪ゴム
    const ht = mesh(new THREE.TorusGeometry(1.0, 0.16, 8, 32), new THREE.MeshStandardMaterial({ color: 0x2a2226, roughness: 0.8 }), g); ht.rotation.x = -Math.PI / 2 + 0.05; ht.position.set(55, 0.16, 20); ht.scale.set(1, 0.85, 1);
    // 丸まった紙くず（レシートの切れ端）
    const pg = new THREE.PlaneGeometry(3, 6, 6, 12); { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, 0.7 * Math.sin(y * 0.6) * Math.cos(x * 0.7) + 0.3 * (hsh(i, 0, 99) - 0.5)); } pg.computeVertexNormals(); }
    const paper = mesh(pg, new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.9, side: THREE.DoubleSide }), g);
    paper.rotation.set(-Math.PI / 2 + 0.15, 0, 1.1); paper.position.set(-10, 0.75, -30);
  }

  // =====================================================================
  // ローテーブル 100 x 50, 高さ 40, 下段に棚板
  // =====================================================================
  window.MODELS.coffeeTable = function () {
    const g = new THREE.Group();
    const top = woodMat(1, 0.5);
    const raw = woodMat(1, 0.5, 0, 0.85, 0xe8d6bc);   // 裏面・見えない所は無塗装寄り
    const T = mesh(rbox(100, 3, 50, 0.7, { T: 100, m: 3, res: 2.5 }), top, g); T.position.y = 38.5;
    // 天板裏（無塗装）
    const under = mesh(new THREE.PlaneGeometry(98.6, 48.6), raw, g, false); under.rotation.x = Math.PI / 2; under.position.y = 36.98;
    // 脚 4本（木目を縦に）
    const legs = [], ap = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push([rbox(4, 37, 4, 0.35, { T: 100, m: 2, res: 8, grain: 'y', uo: (sx + sz) * 0.13 }), M4(sx * 46, 18.5, sz * 21)]);
    mesh(merge(legs), woodMat(1, 0.5, 0, 0.5), g);
    // 幕板
    for (const sz of [-1, 1]) ap.push([rbox(88, 7, 2, 0.25, { T: 100, m: 2, res: 2.5 }), M4(0, 33.5, sz * 21)]);
    for (const sx of [-1, 1]) ap.push([rbox(2, 7, 38, 0.25, { T: 100, m: 2, res: 2.5 }), M4(sx * 46, 33.5, 0)]);
    mesh(merge(ap), top, g);
    // 下段の棚板（脚の間、床から 10cm）
    const sh = mesh(rbox(88, 1.8, 38, 0.4, { T: 100, m: 2, res: 2.5, uo: 0.4 }), top, g); sh.position.y = 10.9;
    // 棚受けの桟
    const rails = [];
    for (const sz of [-1, 1]) rails.push([new THREE.BoxGeometry(88, 2.5, 1.6), M4(0, 8.75, sz * 18.6)]);
    mesh(merge(rails), raw, g);
    // コーナー金具＋ネジ（天板裏）
    const br = [], sc = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 41, z = sz * 16;
      const b = new THREE.BoxGeometry(9, 4, 0.3); br.push([b, M4(sx * 42.2, 33.8, sz * 17.2, 0, sx * sz * Math.PI / 4, 0)]);
      for (const k of [-1, 1]) sc.push([new THREE.CylinderGeometry(0.45, 0.45, 0.25, 10), M4(sx * 42.2 + k * 2.4 * Math.cos(sx * sz * Math.PI / 4), 36.85, sz * 17.2 - k * 2.4 * Math.sin(sx * sz * Math.PI / 4))]);
      sc.push([new THREE.CylinderGeometry(0.6, 0.6, 0.3, 6), M4(x - sx * 1.0, 33.8, z - sz * 1.0, Math.PI / 2, sx * sz * Math.PI / 4, 0)]);
    }
    mesh(merge(br), new THREE.MeshStandardMaterial({ color: 0x55575a, metalness: 0.8, roughness: 0.4 }), g);
    mesh(merge(sc), new THREE.MeshStandardMaterial({ color: 0xa8a8a2, metalness: 0.9, roughness: 0.3 }), g, false);
    // フェルト
    const fe = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) fe.push([new THREE.BoxGeometry(3.6, 0.3, 3.6), M4(sx * 46, 0.15, sz * 21)]);
    mesh(merge(fe), new THREE.MeshStandardMaterial({ color: 0x8c8478, roughness: 1 }), g);
    // 当たり判定
    const col = [[-50, 37, -25, 50, 40, 25], [-48, 10, -19, 48, 11.8, 19]];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) col.push([sx * 46 - 2, 0, sz * 21 - 2, sx * 46 + 2, 37, sz * 21 + 2]);
    col.push([-44, 30, -22, 44, 37, -20], [-44, 30, 20, 44, 37, 22], [-47, 30, -19, -45, 37, 19], [45, 30, -19, 47, 37, 19]);
    col.push([-44, 7.5, -19.4, 44, 10, -17.8], [-44, 7.5, 17.8, 44, 10, 19.4]);
    g.userData.colliders = col;
    return g;
  };

  // =====================================================================
  // ラグ 200 x 140, 厚み 1cm。毛足はシェル（積層アルファ）で表現
  // =====================================================================
  window.MODELS.rug = function () {
    const g = new THREE.Group();
    const W = 200, D = 140, BASE = 0.35, PILE = 0.65, NS = 12;
    // 模様（全面1枚、1024 x 717）
    const PW = 1024, PH = 717;
    const cols = { field: [116, 72, 60], border: [206, 196, 174], navy: [54, 62, 76], ochre: [164, 132, 86], sage: [122, 128, 108] };
    const pat = genTex(PW, PH, (x, y, o) => {
      const u = x / PW * W - W / 2, v = y / PH * D - D / 2; // cm
      const ex = W / 2 - Math.abs(u), ey = D / 2 - Math.abs(v), e = Math.min(ex, ey);
      let c = cols.field;
      if (e < 2.5) c = cols.navy;
      else if (e < 10) { // 外ボーダー: 菱形の連続
        const t = (ex < ey ? v : u) / 6, s = e - 2.5; const tri = Math.abs((t - Math.floor(t)) - 0.5) * 7.5;
        c = Math.abs(s - 3.75) < tri * 0.5 ? cols.navy : cols.border;
        if (Math.abs(s - 3.75) < 0.6) c = cols.ochre;
      } else if (e < 12) c = cols.navy;
      else if (e < 13.5) c = cols.ochre;
      else if (e < 15) c = cols.navy;
      else {
        // 中央の菱形メダリオン＋格子
        const md = Math.abs(u) / 55 + Math.abs(v) / 40;
        const gx = (u + 1000) / 18, gy = (v + 1000) / 18; const gl = Math.abs(((gx + gy) % 1) - 0.5) < 0.04 || Math.abs(((gx - gy + 100) % 1) - 0.5) < 0.04;
        if (md < 1) {
          c = md > 0.94 ? cols.navy : md > 0.86 ? cols.border : md > 0.8 ? cols.navy : md > 0.45 ? cols.sage : md > 0.39 ? cols.border : md > 0.18 ? cols.navy : cols.ochre;
          if (md > 0.45 && md < 0.8 && gl) c = cols.border;
        } else if (gl) c = [100, 60, 50];
        // 四隅の三角
        const cd = (Math.abs(u) - (W / 2 - 15)) / 30 + (Math.abs(v) - (D / 2 - 15)) / 24;
        if (cd > -1 && md >= 1) c = cd > -0.88 ? cols.navy : cols.border;
      }
      const ab = 0.9 + 0.18 * fbm(x / 128, y / 128, 8, 6, 4, 140); // 退色・ムラ
      const abrash = 0.96 + 0.08 * vn(0.5, y / 6, 2, 120, 141);   // 糸ロットの横縞
      const n = 1 + 0.06 * (hsh(x, y, 142) - 0.5);
      const k = ab * abrash * n; o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; o.h = 0.5;
    }, { clamp: true });
    // 毛足のタフト（タイル 10cm）
    const tuft = genTex(256, 256, (x, y, o) => {
      // 32x32 の房、ジッター付き。近いタフト中心までの距離で高さ
      const cs = 8; const ci = Math.floor(x / cs), cj = Math.floor(y / cs); let best = 9;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = ci + di, jj = cj + dj, wi = ((ii % 32) + 32) % 32, wj = ((jj % 32) + 32) % 32;
        const cx = (ii + 0.5 + (hsh(wi, wj, 150) - 0.5) * 0.7) * cs, cy = (jj + 0.5 + (hsh(wi, wj, 151) - 0.5) * 0.7) * cs;
        const d = Math.hypot(x - cx, y - cy) / (cs * (0.55 + 0.25 * hsh(wi, wj, 152))); if (d < best) best = d;
      }
      const strand = vn(x / 1.3, y / 1.3, 197, 197, 153);
      const h = cl(1 - best, 0, 1) * (0.75 + 0.45 * strand);
      o.r = o.g = o.b = 255 * cl(h, 0, 1); o.h = h;
    });
    const tuftTex = tuft.map;
    const REP = new THREE.Vector2(W / 8, D / 8);

    // 裏地＋側面（下地）
    const sideTex = genTex(256, 32, (x, y, o) => { const t = vn(x / 2, y / 3, 128, 11, 160); const v = 150 + 60 * t; o.r = v; o.g = v * 0.93; o.b = v * 0.82; o.h = t; });
    const baseMats = [];
    const sideM = new THREE.MeshStandardMaterial({ color: 0xd8c8b0, map: cloneTex(sideTex.map, 8, 1), bumpMap: cloneTex(sideTex.bump, 8, 1), bumpScale: 0.3, roughness: 1 });
    const topM = new THREE.MeshStandardMaterial({ map: pat.map, color: 0x9a9a9a, roughness: 1 });
    const botM = new THREE.MeshStandardMaterial({ color: 0x4a443c, roughness: 1 });
    const baseBox = mesh(new THREE.BoxGeometry(W, BASE, D), [sideM, sideM, topM, botM, sideM, sideM], g);
    baseBox.position.y = BASE / 2;

    // シェル
    for (let i = 1; i <= NS; i++) {
      const hgt = i / NS;
      const m = new THREE.MeshStandardMaterial({ map: pat.map, roughness: 1, transparent: false, alphaTest: 0.5 });
      const shade = 0.55 + 0.5 * hgt;
      m.color.setRGB(shade, shade, shade);
      m.onBeforeCompile = (sh) => {
        sh.uniforms.tuft = { value: tuftTex }; sh.uniforms.lvl = { value: hgt * 0.92 }; sh.uniforms.rep = { value: REP };
        sh.fragmentShader = 'uniform sampler2D tuft; uniform float lvl; uniform vec2 rep;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>',
          'vec2 tu = vUv * rep + lvl * vec2(0.018, 0.011);\n float tf = texture2D(tuft, tu).r - 0.32 * texture2D(tuft, tu * 4.37 + 0.31).g * (0.4 + lvl);\n float edgeU = min(vUv.x, 1.0 - vUv.x) * ' + W.toFixed(1) + ', edgeV = min(vUv.y, 1.0 - vUv.y) * ' + D.toFixed(1) + ';\n' +
          ' float lv = lvl + (1.0 - smoothstep(0.0, 1.2, min(edgeU, edgeV))) * 0.35;\n if (tf < lv) discard;');
      };
      m.customProgramCacheKey = () => 'rugshell';
      const sg = new THREE.PlaneGeometry(W, D); sg.rotateX(-Math.PI / 2);
      const s = mesh(sg, m, g, false); s.position.y = BASE + PILE * hgt;
    }
    // 長辺のかがり縫い（巻いた糸）
    const wrapT = genTex(64, 64, (x, y, o) => { const t = ((x + y * 0.8) / 8) % 1; const h = Math.sin(t * Math.PI); const v = 160 + 70 * h + 10 * (hsh(x, y, 170) - 0.5); o.r = v * 0.98; o.g = v * 0.9; o.b = v * 0.78; o.h = h; });
    const binds = [];
    for (const sz of [-1, 1]) { const cg = new THREE.CylinderGeometry(0.55, 0.55, W, 12, 1); cg.rotateZ(Math.PI / 2); binds.push([cg, M4(0, 0.5, sz * (D / 2 + 0.1))]); }
    mesh(merge(binds), new THREE.MeshStandardMaterial({ map: cloneTex(wrapT.map, 1, W / 1.2), bumpMap: cloneTex(wrapT.bump, 1, W / 1.2), bumpScale: 0.5, roughness: 1 }), g);
    // 短辺のフリンジ（結び目＋房）
    const R = rng(77);
    const strandG = new THREE.CylinderGeometry(0.075, 0.09, 1, 5, 1); strandG.rotateZ(Math.PI / 2); strandG.translate(0.5, 0, 0);
    const wrapT2 = genTex(64, 64, (x, y, o) => { const t = ((x * 2 + y) / 16) % 1; const h = Math.sin(t * Math.PI); const v = 200 + 50 * h + 12 * (hsh(x, y, 171) - 0.5); o.r = v; o.g = v * 0.96; o.b = v * 0.88; o.h = h; });
    const strandM = new THREE.MeshStandardMaterial({ color: 0xe6dcc8, map: cloneTex(wrapT2.map, 1, 6), roughness: 1 });
    const knotG = new THREE.SphereGeometry(0.36, 10, 6);
    const nb = Math.floor(D / 1.4), per = 7;
    const strands = new THREE.InstancedMesh(strandG, strandM, nb * 2 * per), knots = new THREE.InstancedMesh(knotG, strandM, nb * 2);
    strands.castShadow = strands.receiveShadow = knots.castShadow = knots.receiveShadow = true;
    const col = new THREE.Color(); let si = 0, ki = 0;
    for (const sx of [-1, 1]) for (let b = 0; b < nb; b++) {
      const z = -D / 2 + 1.4 * (b + 0.5) + (R() - 0.5) * 0.2, kx = sx * (W / 2 + 0.9);
      knots.setMatrixAt(ki, M4(kx, 0.3, z, 0, (R() - 0.5) * 0.4, 0, 1.7, 0.75, 1.15)); col.setRGB(0.95, 0.93, 0.88).multiplyScalar(0.85 + R() * 0.15); knots.setColorAt(ki++, col);
      const ang = (R() - 0.5) * 0.14;
      for (let k = 0; k < per; k++) {
        const L = 5.6 + R() * 1.0, a = ang + (k - 3) * 0.018 + (R() - 0.5) * 0.04;
        const yaw = sx > 0 ? -a : Math.PI - a;
        strands.setMatrixAt(si, M4(kx - sx * 0.2, 0.09 + (k % 2) * 0.1 + R() * 0.04, z + (k - 3) * 0.1, 0, yaw, -0.022, L, 1, 1));
        col.setRGB(0.93, 0.9, 0.84).multiplyScalar(0.8 + R() * 0.2); strands.setColorAt(si++, col);
      }
    }
    g.add(strands, knots);
    g.userData.colliders = [[-W / 2, 0, -D / 2, W / 2, 1, D / 2]];
    return g;
  };
})();
