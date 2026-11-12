// storage.js — リビング壁際の家具・小物: tvStand / bookshelf / floorLamp / plant
// 1 = 1cm, Y上, 原点 = 足元中心, 正面 +Z。Three.js r128 グローバル THREE。
(function () {
  const T = THREE;
  const TAU = Math.PI * 2;
  window.MODELS = window.MODELS || {};

  // ---------------------------------------------------------------- utils
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rr = (R, a, b) => a + (b - a) * R();

  function makeNoise(seed) {
    const r = rng(seed), t = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) t[i] = r();
    return function (x, y, px, py) {
      const xi = Math.floor(x), yi = Math.floor(y);
      let xf = x - xi, yf = y - yi;
      xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
      const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
      const a = t[(y0 & 255) * 256 + (x0 & 255)], b = t[(y0 & 255) * 256 + (x1 & 255)];
      const c = t[(y1 & 255) * 256 + (x0 & 255)], d = t[(y1 & 255) * 256 + (x1 & 255)];
      return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
    };
  }
  function fbm(n, x, y, px, py, oct) {
    let s = 0, a = 0.5, f = 1, tot = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f, px * f, py * f); tot += a; a *= 0.5; f *= 2; }
    return s / tot;
  }
  const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  function mix3(a, b, t, o) { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; }

  function texFrom(c) {
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
    return t;
  }
  function pixTex(w, h, fn, post) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data, o = [0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      fn(x / w, y / h, o, x, y);
      const i = (y * w + x) * 4; d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (post) post(ctx, w, h);
    return texFrom(c);
  }
  function drawTex(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    return texFrom(c);
  }
  const cache = {};
  const cached = (k, f) => cache[k] || (cache[k] = f());

  // ---------------------------------------------------------------- textures
  function woodTex(seed, light, dark, stripes) {
    const n1 = makeNoise(seed), n2 = makeNoise(seed + 7), L = hex(light), D = hex(dark), r = rng(seed + 3);
    return pixTex(512, 512, (u, v, o) => {
      const warp = fbm(n1, u * 2, v * 3, 2, 3, 3);
      const ring = 0.5 + 0.5 * Math.sin(TAU * (v * stripes + warp * 0.9 + fbm(n2, u * 1, v * 24, 1, 24, 2) * 0.35));
      const late = Math.pow(ring, 4);
      const pore = fbm(n2, u * 8, v * 160, 8, 160, 2);
      const mott = fbm(n2, u * 4, v * 4, 4, 4, 3);
      mix3(L, D, clamp(0.2 + late * 0.4 + (pore - 0.5) * 0.9 + (mott - 0.5) * 0.3, 0, 1), o);
    }, (c, w, h) => {
      c.fillStyle = 'rgba(25,14,6,0.22)';
      for (let i = 0; i < 1400; i++) c.fillRect(r() * w, r() * h, 2 + r() * 10, 1);
    });
  }
  function linenTex(seed, base) {
    const n = makeNoise(seed), B = hex(base);
    return pixTex(256, 256, (u, v, o, x, y) => {
      const wx = 0.5 + 0.5 * Math.sin(TAU * x / 4), wy = 0.5 + 0.5 * Math.sin(TAU * y / 4);
      const over = ((Math.floor(x / 4) + Math.floor(y / 4)) & 1) ? wx : wy;
      const sh = fbm(n, u * 2, v * 64, 2, 64, 2), sv = fbm(n, u * 64, v * 2, 64, 2, 2);
      const k = 0.8 + over * 0.14 + (sh - 0.5) * 0.3 + (sv - 0.5) * 0.22;
      o[0] = B[0] * k; o[1] = B[1] * k; o[2] = B[2] * k;
    });
  }
  function speckleTex(seed, base, w, h, dots, extra) {
    const n = makeNoise(seed), B = hex(base), r = rng(seed + 1);
    return pixTex(w, h, (u, v, o) => {
      const m = fbm(n, u * 6, v * 6, 6, 6, 4);
      const k = 0.88 + (m - 0.5) * 0.28;
      o[0] = B[0] * k; o[1] = B[1] * k; o[2] = B[2] * k;
    }, (c, W, H) => {
      for (let i = 0; i < dots; i++) {
        const s = r();
        c.fillStyle = s < 0.7 ? `rgba(70,50,35,${0.3 + r() * 0.5})` : `rgba(255,250,240,${0.3 + r() * 0.4})`;
        c.beginPath(); c.arc(r() * W, r() * H, 0.4 + r() * r() * 1.4, 0, TAU); c.fill();
      }
      if (extra) extra(c, W, H, r);
    });
  }
  function brushedTex(seed, base) {
    const n = makeNoise(seed), B = hex(base);
    return pixTex(256, 256, (u, v, o) => {
      const k = 0.85 + (fbm(n, u * 2, v * 128, 2, 128, 3) - 0.5) * 0.5;
      o[0] = B[0] * k; o[1] = B[1] * k; o[2] = B[2] * k;
    });
  }

  // ---------------------------------------------------------------- geometry helpers
  const std = (o) => new T.MeshStandardMaterial(o);
  function colorize(g, h) {
    const c = new T.Color(h), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(a, 3));
    return g;
  }
  // 世界スケールUVの箱(木目が長い方向に流れる)
  function boxW(w, h, d, s, R) {
    const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const ou = R ? R() * 5 : 0, ov = R ? R() * 5 : 0;
    for (let f = 0; f < 6; f++) {
      const a = dims[f][0], b = dims[f][1], swap = b > a;
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k; let u = uv.getX(i) * a / s, v = uv.getY(i) * b / s;
        if (swap) { const t = u; u = v; v = t; }
        uv.setXY(i, u + ou, v + ov);
      }
    }
    return g;
  }
  function rrShape(w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  // 角丸+面取りの箱 (w:x, h:y, d:z)
  function rbox(w, h, d, r, bev) {
    bev = bev || 0;
    const g = new T.ExtrudeGeometry(rrShape(w - 2 * bev, h - 2 * bev, Math.max(0.02, r - bev)), {
      depth: d - 2 * bev, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 5,
    });
    g.translate(0, 0, -(d - 2 * bev) / 2);
    return g;
  }
  const V = (p) => new T.Vector3(p[0], p[1], p[2]);
  function tube(pts, r, seg, rad) {
    return new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(V)), seg || pts.length * 8, r, rad || 6, false);
  }
  const lathe = (pts, seg) => new T.LatheGeometry(pts.map((p) => new T.Vector2(p[0], p[1])), seg || 32);
  const cyl = (rt, rb, h, s) => new T.CylinderGeometry(rt, rb, h, s || 16);

  function merge(list) {
    const gs = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.normal) n.computeVertexNormals(); return n; });
    let n = 0; for (const x of gs) n += x.attributes.position.count;
    const hasC = gs.some((x) => x.attributes.color);
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = hasC ? new Float32Array(n * 3) : null;
    let o = 0;
    for (const x of gs) {
      const c = x.attributes.position.count;
      P.set(x.attributes.position.array, o * 3); N.set(x.attributes.normal.array, o * 3);
      if (x.attributes.uv) U.set(x.attributes.uv.array, o * 2);
      if (C) { if (x.attributes.color) C.set(x.attributes.color.array, o * 3); else C.fill(1, o * 3, (o + c) * 3); }
      o += c;
    }
    const m = new T.BufferGeometry();
    m.setAttribute('position', new T.BufferAttribute(P, 3));
    m.setAttribute('normal', new T.BufferAttribute(N, 3));
    m.setAttribute('uv', new T.BufferAttribute(U, 2));
    if (C) m.setAttribute('color', new T.BufferAttribute(C, 3));
    m.computeBoundingSphere();
    return m;
  }
  // マテリアルごとにジオメトリを集めて1メッシュに結合する
  class Bld {
    constructor() { this.m = new Map(); this.o = new T.Object3D(); }
    put(mat, geo, p, r, s) {
      const o = this.o;
      o.position.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
      o.rotation.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
      o.scale.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1);
      o.updateMatrix(); geo.applyMatrix4(o.matrix);
      if (!this.m.has(mat)) this.m.set(mat, []);
      this.m.get(mat).push(geo);
      return geo;
    }
    putM(mat, geo, mtx) { geo.applyMatrix4(mtx); if (!this.m.has(mat)) this.m.set(mat, []); this.m.get(mat).push(geo); }
    build(group, noShadow) {
      for (const [mat, list] of this.m) {
        const mesh = new T.Mesh(merge(list), mat);
        mesh.castShadow = !(noShadow && noShadow.has(mat)); mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
  }
  // 方向ベクトル(xz)へ向けるY回転
  const yaw = (dx, dz) => Math.atan2(-dz, dx);

  // 床を這うコード等で使う: プラグ(平刃2本)
  function addPlug(B, body, prong, p, ry, col) {
    const m = new T.Matrix4().makeRotationY(ry); m.setPosition(p[0], p[1], p[2]);
    const g = colorize(rbox(3.4, 1.9, 2.6, 0.5, 0.3), col || 0xeeeeea);
    g.rotateY(Math.PI / 2); B.putM(body, g, m);
    for (const s of [-0.65, 0.65]) {
      const pr = new T.BoxGeometry(1.6, 0.18, 0.65); pr.translate(2.4, 0, s);
      B.putM(prong, pr, m);
    }
  }

  // ================================================================ tvStand
  window.MODELS.tvStand = function () {
    const g = new T.Group(), B = new Bld(), R = rng(17);
    const wood = std({ map: cached('walnut', () => woodTex(11, 0x7c5a3e, 0x4a3221, 11)), roughness: 0.55 });
    const dark = std({ color: 0x140d08, roughness: 1 });
    const brass = std({ color: 0xa88a58, metalness: 0.65, roughness: 0.32 });
    const felt = std({ color: 0xcfc3aa, roughness: 1 });
    const steel = std({ color: 0x3a3a3c, metalness: 0.6, roughness: 0.45 });
    const plastic = std({ vertexColors: true, roughness: 0.45 });
    const matte = std({ color: 0x1d1d1f, roughness: 0.6 });
    const rubber = std({ color: 0x18181a, roughness: 0.55 });
    const portM = std({ color: 0xb9bcc0, metalness: 0.8, roughness: 0.3 });
    const blackHole = std({ color: 0x030303, roughness: 1 });
    const standM = std({ map: cached('brushDark', () => brushedTex(5, 0x48484c)), metalness: 0.7, roughness: 0.38 });
    const glow = std({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.4 });

    const W = 160, D = 40, H = 45, LH = 9, TT = 2.4, ST = 1.8;
    const iy0 = LH + ST, iy1 = H - TT, ih = iy1 - iy0;           // 10.8 .. 42.6
    // ---- 箱体
    B.put(wood, boxW(W, TT, D, 60, R), [0, H - TT / 2, 0]);
    for (const s of [-1, 1]) B.put(wood, boxW(ST, H - TT - LH, D, 60, R), [s * (W / 2 - ST / 2), LH + (H - TT - LH) / 2, 0]);
    B.put(wood, boxW(W - 2 * ST, ST, D - 0.6, 60, R), [0, LH + ST / 2, 0.3]);
    B.put(wood, boxW(W - 2 * ST, ih, 0.6, 60, R), [0, iy0 + ih / 2, -19.7]);
    for (const s of [-1, 1]) B.put(wood, boxW(1.8, ih, D - 0.6, 60, R), [s * 39, iy0 + ih / 2, 0.3]);
    B.put(wood, boxW(76.2, 1.8, D - 0.6, 60, R), [0, 24.9, 0.3]);          // 中央の棚板(ニッチ/引き出し)
    // 天板の前縁に細い面取り(明るい線)
    B.put(wood, boxW(W, 0.25, 0.25, 60, R), [0, H - 0.05, D / 2 + 0.02], [Math.PI / 4, 0, 0]);
    // ---- 扉・引き出し(隙間の奥は暗く)
    const gap = 0.25, fz = D / 2 - 0.9;
    const doors = [[-78.2, -39.9], [39.9, 78.2]];
    for (const [a, b] of doors) {
      B.put(dark, new T.BoxGeometry(b - a, ih, 0.2), [(a + b) / 2, iy0 + ih / 2, 17.9]);
      B.put(wood, boxW(b - a - 2 * gap, ih - 2 * gap, 1.8, 60, R), [(a + b) / 2, iy0 + ih / 2, fz]);
    }
    B.put(dark, new T.BoxGeometry(76.2, 13.2, 0.2), [0, 17.4, 17.9]);
    B.put(wood, boxW(76.2 - 2 * gap, 13.2 - 2 * gap, 1.8, 60, R), [0, 17.4, fz]);
    // ---- 取っ手(バー+脚)
    const bar = (x, y, vert, len) => {
      const zz = D / 2 + 2.1;
      B.put(brass, cyl(0.45, 0.45, len, 12), [x, y, zz], vert ? null : [0, 0, Math.PI / 2]);
      for (const s of [-1, 1]) {
        const off = (len / 2 - 2) * s;
        B.put(brass, cyl(0.32, 0.38, 2.2, 10), vert ? [x, y + off, zz - 1.0] : [x + off, y, zz - 1.0], [Math.PI / 2, 0, 0]);
        B.put(brass, cyl(0.7, 0.7, 0.15, 14), vert ? [x, y + off, D / 2 + 0.07] : [x + off, y, D / 2 + 0.07], [Math.PI / 2, 0, 0]);
      }
    };
    bar(-43.6, 32, true, 13); bar(43.6, 32, true, 13); bar(0, 17.4, false, 20);
    // ---- 脚(テーパー)+金具+フェルト
    for (const x of [-72, 72]) for (const z of [-14, 14]) {
      B.put(wood, cyl(1.9, 1.3, LH - 0.7, 16), [x, 0.4 + (LH - 0.7) / 2, z]);
      B.put(steel, new T.BoxGeometry(6, 0.3, 6), [x, LH - 0.15, z]);
      for (const a of [-2.2, 2.2]) for (const b of [-2.2, 2.2]) B.put(steel, cyl(0.35, 0.35, 0.18, 8), [x + a, LH - 0.38, z + b]);
      B.put(felt, cyl(1.5, 1.5, 0.4, 16), [x, 0.2, z]);
    }
    // ---- ニッチの中: セットトップボックス + ディスクケース
    B.put(plastic, colorize(rbox(30, 4.5, 22, 0.8, 0.4), 0x252628), [-14, 25.8 + 0.4 + 2.25, -6]);
    for (const x of [-26, -2]) for (const z of [-14, 2]) B.put(rubber, cyl(0.9, 0.9, 0.4, 10), [x, 26.0, z]);
    B.put(glow, colorize(new T.BoxGeometry(0.5, 0.5, 0.1), 0x66ccff), [-3, 28.8, 5.05]);
    B.put(plastic, colorize(new T.BoxGeometry(22, 0.3, 0.1), 0x111111), [-18, 27.0, 5.03]);  // 前面の溝
    const caseCols = [0x1f3c6e, 0x2a2a2c, 0x1f3c6e, 0x6b1d1d, 0x1f3c6e, 0x2a2a2c];
    caseCols.forEach((c, i) => {
      B.put(plastic, colorize(rbox(1.4, 17.2, 13.6, 0.25), c), [12 + i * 1.5, 25.8 + 8.6, -9 + rr(R, -0.4, 0.4)]);
    });
    B.put(plastic, colorize(rbox(1.4, 17.2, 13.6, 0.25), 0xc9c9c9), [23, 25.8 + 8.6, -9], [0, 0, 0.32]);
    // 配線穴(グロメット)
    B.put(blackHole, cyl(1.9, 1.9, 1.0, 20), [3, 35, -19.7], [Math.PI / 2, 0, 0]);
    for (const z of [-20.1, -19.3]) B.put(rubber, new T.TorusGeometry(2.0, 0.3, 8, 24), [3, 35, z]);
    // ---- リモコン(天板の上)
    {
      const m = new T.Matrix4().makeRotationY(0.35); m.setPosition(34, H, 9);
      const body = colorize(rbox(4.6, 1.4, 17, 1.2, 0.5), 0x202022); body.translate(0, 0.7, 0); B.putM(plastic, body, m);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        const b = colorize(cyl(0.38, 0.42, 0.35, 10), 0x6a6a6e); b.translate((j - 1) * 1.3, 1.45, -1 + i * 1.4); B.putM(plastic, b, m);
      }
      const pw = colorize(cyl(0.45, 0.5, 0.35, 12), 0xb02020); pw.translate(1.3, 1.45, -6.5); B.putM(plastic, pw, m);
      const dp = colorize(cyl(1.4, 1.4, 0.3, 20), 0x3a3a3e); dp.translate(0, 1.45, 5); B.putM(plastic, dp, m);
    }

    // ---- テレビ(55型、消灯)
    const tvW = 122.8, tvH = 71.2, ty0 = 52.5, tzf = 3;
    const bezel = std({ color: 0x141416, roughness: 0.45, metalness: 0.2 });
    const reflTex = cached('tvRefl', () => drawTex(256, 256, (c, w, h) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      const gr = c.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.35)');
      gr.addColorStop(0.42, 'rgba(255,255,255,0.08)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)');
      gr.addColorStop(1, 'rgba(255,255,255,0.0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const g2 = c.createLinearGradient(0, h, 0, 0); g2.addColorStop(0, 'rgba(180,150,120,0.35)'); g2.addColorStop(0.35, 'rgba(0,0,0,0)');
      c.fillStyle = g2; c.fillRect(0, 0, w, h);
    }));
    const screen = new T.MeshPhysicalMaterial({
      color: 0x060708, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, reflectivity: 0.6,
      emissive: 0x2b3036, emissiveMap: reflTex,
    });
    B.put(bezel, rbox(tvW, tvH, 1.0, 0.5, 0.2), [0, ty0 + tvH / 2, tzf - 0.5]);
    B.put(screen, new T.PlaneGeometry(121.6, 69.4), [0, ty0 + 1.2 + 34.7, tzf + 0.012]);
    B.put(portM, new T.BoxGeometry(4.2, 0.45, 0.05), [0, ty0 + 0.6, tzf + 0.02]);  // ロゴ
    B.put(glow, colorize(new T.BoxGeometry(0.35, 0.22, 0.05), 0x551010), [52, ty0 + 0.55, tzf + 0.02]); // 待機ランプ
    // 背面ボディ
    const rz = tzf - 1 - 2.0;   // 背面ボディ中心z (奥行 4.0)
    const ry0 = ty0 + 4, rH = 40;
    B.put(matte, rbox(96, rH, 4.0, 3, 0.5), [0, ry0 + rH / 2, rz]);
    const rBack = rz - 2.0;
    // 通気スリット
    const vent = std({
      map: cached('vent', () => drawTex(256, 64, (c, w, h) => {
        c.fillStyle = '#26262a'; c.fillRect(0, 0, w, h); c.fillStyle = '#050505';
        for (let x = 6; x < w - 6; x += 8) c.fillRect(x, 8, 4, h - 16);
      })), roughness: 0.7,
    });
    for (const s of [-1, 1]) B.put(vent, new T.PlaneGeometry(30, 6), [s * 24, ry0 + rH - 5, rBack - 0.01], [0, Math.PI, 0]);
    // VESAねじ穴
    for (const x of [-10, 10]) for (const y of [14, 34]) B.put(blackHole, cyl(0.5, 0.5, 0.2, 12), [x, ty0 + y, rBack - 0.05], [Math.PI / 2, 0, 0]);
    // 側面端子(-x向き)
    const px = -48.0, pys = [14, 18, 22, 26.5, 30.5];
    pys.forEach((y, i) => {
      const lan = i === 4, usb = i === 3;
      const hh = lan ? 1.25 : usb ? 0.55 : 0.55, ww = lan ? 1.4 : usb ? 1.25 : 1.5;
      B.put(portM, new T.BoxGeometry(0.3, hh, ww), [px - 0.1, ty0 + y, rz]);
      B.put(blackHole, new T.BoxGeometry(0.32, hh - 0.2, ww - 0.25), [px - 0.12, ty0 + y + (usb ? 0.06 : 0), rz]);
    });
    const label = std({
      roughness: 0.6,
      map: cached('tvLabel', () => drawTex(64, 512, (c, w, h) => {
        c.fillStyle = '#1d1d1f'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#d8d8d8'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
        const names = ['HDMI 1', 'HDMI 2', 'HDMI 3', 'USB', 'LAN'];
        // 平面は y: ty0+8..ty0+34 (26cm) → 512px
        pys.forEach((y, i) => { const py = 512 - ((y + 1.25 - 8) / 26) * 512; c.fillText(names[i], w / 2, py + 4); });
      })),
    });
    B.put(label, new T.PlaneGeometry(3.0, 26), [px - 0.02, ty0 + 21, rz], [0, -Math.PI / 2, 0]);
    // 電源インレット(下向き)+プラグ
    B.put(blackHole, new T.BoxGeometry(2.4, 0.2, 1.4), [38, ry0 - 0.05, rz]);
    B.put(plastic, colorize(rbox(2.2, 2.2, 1.3, 0.3, 0.2), 0x1a1a1a), [38, ry0 - 1.15, rz]);
    // スタンド
    B.put(standM, rbox(40, 22, 0.9, 4, 0.3), [0, H + 0.45, -1], [-Math.PI / 2, 0, 0]);
    B.put(standM, rbox(7, 15, 2.4, 1, 0.3), [0, H + 0.9 + 7.5, rBack - 1.15]);
    B.put(rubber, new T.BoxGeometry(36, 0.15, 18), [0, H + 0.02, -1]);
    // ---- 電源タップ(床、ボード背面の下)
    const sx0 = 50, sx1 = 86, sz = -23, sh = 3.4;
    B.put(plastic, colorize(rbox(sx1 - sx0, sh, 5.2, 1.2, 0.5), 0xefefea), [(sx0 + sx1) / 2, sh / 2, sz], [0, 0, 0]);
    const sockets = [54, 61, 68, 75];
    for (const x of sockets) {
      B.put(plastic, colorize(cyl(1.5, 1.5, 0.15, 20), 0xdadad4), [x, sh + 0.02, sz]);
      for (const s of [-0.6, 0.6]) B.put(blackHole, new T.BoxGeometry(0.2, 0.2, 0.75), [x + s, sh + 0.08, sz]);
    }
    B.put(glow, colorize(rbox(2.2, 1.4, 0.6, 0.2), 0xff6a10), [82.5, sh + 0.1, sz], [-Math.PI / 2, 0, 0]);
    // ---- ケーブル
    const cab = [];
    // HDMI: テレビ側面 → 天板の上 → 背面へ垂れて → グロメット → STB背面
    cab.push([tube([[-48.4, ty0 + 14, rz], [-50.5, ty0 + 13.6, rz - 0.3], [-52.6, ty0 + 10, rz - 1.4], [-52, 49.5, -5.5],
      [-50.5, H + 0.4, -13], [-48.6, H + 0.4, -19.6], [-47.8, 42.5, -20.9], [-44, 37.5, -21.3], [-24, 34.2, -21.4],
      [-4, 34.8, -20.9], [2, 35, -20.3], [3, 35, -19.2], [0, 33.2, -18.0], [-4, 30.0, -17.6], [-6, 28.6, -17.15]], 0.42, 180, 8), rubber]);
    // HDMIの端子ヘッド
    B.put(matte, new T.BoxGeometry(2.8, 1.0, 2.0), [-49.8, ty0 + 14, rz]);
    B.put(matte, new T.BoxGeometry(2.0, 1.0, 2.6), [-6.2, 28.6, -18.2]);
    // テレビ電源: 天板を伝って背面に垂れ → 床 → タップ
    cab.push([tube([[38, ry0 - 2.2, rz], [38.4, 51.5, rz - 0.3], [38.9, H + 1.6, -4.5], [39.4, H + 0.35, -11], [39.9, H + 0.35, -19.6],
      [40.4, 43.4, -20.7], [40.7, 30, -21.1], [41.2, 12, -21.3], [42.6, 3, -22.6], [45, 0.35, -26], [50, 0.35, -28.4],
      [53, 0.9, -28.2], [54, 2.8, -27], [54, 4.6, -25.2]], 0.35, 200, 6), rubber]);
    // STB電源: STB背面 → グロメット → 床 → タップ
    cab.push([tube([[-20, 27.6, -17.1], [-12, 27.6, -18.6], [2, 34, -19.2], [4, 34.4, -20.4], [5, 32, -21.6], [6.5, 18, -22],
      [8, 5, -22.5], [11, 0.35, -25.2], [25, 0.35, -27.5], [50, 0.35, -29.2], [59.6, 0.8, -28.6], [61, 2.8, -27], [61, 4.6, -25.2]], 0.32, 220, 6), rubber]);
    // タップ自身のコード
    cab.push([tube([[sx1 + 0.2, 1.4, sz], [sx1 + 2.5, 0.35, sz - 0.5], [96, 0.35, -26], [108, 0.35, -27.5], [112.5, 0.9, -27.5]], 0.38, 80, 6), plastic]);
    colorize(cab[cab.length - 1][0], 0xe8e8e2);
    for (const [geo, m] of cab) B.put(m, geo);
    // タップに刺さったプラグ(コードは背面へ)
    for (const x of [54, 61]) {
      B.put(plastic, colorize(rbox(3.2, 2.6, 2.4, 0.4, 0.3), 0x1c1c1c), [x, sh + 1.3, sz - 0.4]);
      B.put(rubber, cyl(0.55, 0.55, 1.4, 10), [x, sh + 1.2, sz - 2.0], [Math.PI / 2, 0, 0]);
    }
    addPlug(B, plastic, portM, [114.3, 0.95, -27.5], 0, 0xe8e8e2);
    // 結束バンド
    B.put(rubber, new T.TorusGeometry(0.75, 0.15, 6, 12), [41.5, 20, -21.2], [Math.PI / 2, 0, 0]);

    B.build(g);
    g.userData.colliders = [
      [-74, 0, -16, -70, LH, -12], [70, 0, -16, 74, LH, -12], [-74, 0, 12, -70, LH, 16], [70, 0, 12, 74, LH, 16],
      [-80, LH, -20, -38.1, H, 20], [38.1, LH, -20, 80, H, 20],
      [-38.1, LH, -20, 38.1, 25.8, 20], [-38.1, H - TT, -20, 38.1, H, 20], [-38.1, 25.8, -20, 38.1, H, -19.4],
      [-29, 25.8, -17, 1, 30.7, 5], [11, 25.8, -16, 25, 43, -2],
      [-20, H, -12, 20, H + 0.9, 10], [-3.5, H, rBack - 2.4, 3.5, ry0 + 4, rBack],
      [-tvW / 2, ty0, tzf - 1, tvW / 2, ty0 + tvH, tzf], [-48, ry0, rBack, 48, ry0 + rH, tzf - 1],
      [sx0, 0, sz - 2.6, sx1, sh, sz + 2.6], [52, sh, sz - 1.6, 63, sh + 2.6, sz + 0.8],
      [30, H, 0, 39, H + 1.6, 18],
    ];
    return g;
  };

  // ================================================================ bookshelf
  function bookGeos() {
    return cached('bookGeos', () => {
      const b = new T.BoxGeometry(1, 1, 1), uv = b.attributes.uv;
      for (let i = 0; i < 24; i++) {
        const f = Math.floor(i / 4);
        if (f === 4) uv.setX(i, uv.getX(i) * 0.5);
        else uv.setX(i, 0.5 + uv.getX(i) * 0.5);
      }
      const idx = [];
      for (const gi of [0, 1, 4]) { const gr = b.groups[gi]; for (let k = 0; k < gr.count; k++) idx.push(b.index.getX(gr.start + k)); }
      const cover = new T.BufferGeometry();
      cover.setAttribute('position', b.attributes.position); cover.setAttribute('normal', b.attributes.normal); cover.setAttribute('uv', uv);
      cover.setIndex(idx);
      const pages = new T.BoxGeometry(0.86, 0.965, 0.97); pages.translate(0, 0, -0.015);
      return { cover, pages };
    });
  }
  const KANJI = '春夏秋冬山川海空星月花鳥風雪森林光影時間夜明旅路記録物語詩集辞典歴史数学猫庭';
  function spineTex(variant) {
    return cached('spine' + variant, () => drawTex(256, 512, (c, w, h) => {
      const r = rng(100 + variant * 13), sw = 128;
      c.fillStyle = 'rgb(222,222,222)'; c.fillRect(0, 0, w, h);
      // 表紙側(右半分): うっすらした紙の質感
      for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${r() < 0.5 ? 255 : 160},${r() < 0.5 ? 255 : 160},${r() < 0.5 ? 255 : 160},0.12)`; c.fillRect(sw + r() * sw, r() * h, 2, 2); }
      const text = (x, y0, n, size, col) => {
        c.fillStyle = col; c.font = `bold ${size}px serif`; c.textAlign = 'center';
        for (let i = 0; i < n; i++) c.fillText(KANJI[Math.floor(r() * KANJI.length)], x, y0 + i * size * 1.05);
      };
      if (variant === 0) {
        c.fillStyle = '#ffffff'; c.fillRect(0, 26, sw, 7); c.fillRect(0, 40, sw, 3); c.fillRect(0, h - 33, sw, 7); c.fillRect(0, h - 43, sw, 3);
        c.fillStyle = 'rgb(70,70,70)'; c.fillRect(14, 90, sw - 28, 240);
        text(sw / 2, 140, 4, 52, '#f2f2f2'); text(sw / 2, 380, 3, 30, '#3a3a3a');
      } else if (variant === 1) {
        c.fillStyle = 'rgb(110,110,110)'; c.fillRect(0, 0, sw, 130);
        text(sw / 2, 60, 1, 50, '#ffffff'); text(sw / 2, 190, 5, 46, '#2a2a2a');
        c.fillStyle = '#2a2a2a'; c.fillRect(30, h - 60, sw - 60, 22);
      } else if (variant === 2) {
        c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.strokeRect(12, 14, sw - 24, h - 28); c.lineWidth = 2; c.strokeRect(20, 22, sw - 40, h - 44);
        text(sw / 2, 110, 4, 50, '#ffffff');
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(sw / 2, h - 70, 18, 0, TAU); c.fill();
      } else {
        for (let y = 0; y < 120; y += 20) { c.fillStyle = y % 40 ? 'rgb(150,150,150)' : '#ffffff'; c.fillRect(0, y, sw, 10); }
        c.fillStyle = '#f6f2e6'; c.fillRect(16, 170, sw - 32, 190);
        text(sw / 2, 225, 3, 44, '#222');
        c.fillStyle = '#ffffff'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText(String(1 + Math.floor(r() * 9)), sw / 2, h - 40);
      }
    }));
  }

  window.MODELS.bookshelf = function () {
    const g = new T.Group(), B = new Bld(), R = rng(29);
    const wood = std({ map: cached('oak', () => woodTex(23, 0xc6a57c, 0x9a7650, 13)), roughness: 0.6 });
    const backM = std({ map: cached('oak', () => woodTex(23, 0xc6a57c, 0x9a7650, 13)), color: 0xd8d0c4, roughness: 0.7 });
    const brass = std({ color: 0xb09060, metalness: 0.7, roughness: 0.3 });
    const holeM = std({ color: 0x1b140d, roughness: 1 });
    const W = 90, D = 30, H = 180, t = 1.8, ix = W / 2 - t;
    // ---- 箱体
    for (const s of [-1, 1]) B.put(wood, boxW(t, H - t, D, 60, R), [s * (W / 2 - t / 2), (H - t) / 2, 0]);
    B.put(wood, boxW(W, t, D, 60, R), [0, H - t / 2, 0]);
    B.put(backM, boxW(W - 2 * t, H - t, 0.6, 60, R), [0, (H - t) / 2, -D / 2 + 0.3]);
    B.put(wood, boxW(W - 2 * t, 7.5, 1.8, 60, R), [0, 4.0, -13.5]);                // 背面側の幕板
    const shelfY = [8, 44, 80, 114, 146];
    const sz0 = -14.4, sz1 = 14.6;
    for (const y of shelfY) B.put(wood, boxW(W - 2 * t, t, sz1 - sz0, 60, R), [0, y + t / 2, (sz0 + sz1) / 2]);
    // 棚ダボ穴(32mmピッチ)とダボ
    for (const s of [-1, 1]) for (const z of [-11, 11]) {
      for (let y = 18; y < 170; y += 3.2) {
        if (shelfY.some((sy) => y > sy - 0.8 && y < sy + t + 0.8)) continue;
        B.put(holeM, cyl(0.25, 0.25, 0.1, 8), [s * (ix - 0.03), y, z], [0, 0, Math.PI / 2]);
      }
    }
    for (const y of shelfY.slice(1)) for (const s of [-1, 1]) for (const z of [-11, 11]) {
      B.put(brass, cyl(0.28, 0.28, 1.2, 8), [s * (ix - 0.5), y - 0.3, z], [0, 0, Math.PI / 2]);
    }
    // 転倒防止金具(天板下、背面)
    B.put(brass, new T.BoxGeometry(5, 0.3, 3), [0, H - t - 0.15, -12.9]);
    B.put(brass, new T.BoxGeometry(5, 3, 0.3), [0, H - t - 1.5, -14.25]);
    for (const x of [-1.5, 1.5]) B.put(holeM, cyl(0.35, 0.35, 0.1, 8), [x, H - t - 1.8, -14.08], [Math.PI / 2, 0, 0]);
    // 床に接するアジャスター
    for (const s of [-1, 1]) for (const z of [-12, 12]) B.put(holeM, cyl(1.2, 1.2, 0.3, 12), [s * (W / 2 - 0.9), 0.15, z]);

    // ---- 本
    const books = [];
    const pal = [0x7a2e2a, 0x2f4a3a, 0x2b3d5c, 0xc9b48a, 0xe6dcc6, 0x5a5048, 0x8a5a2b, 0x3d3d3d, 0x9a6a5a, 0x4f6f7a, 0xb88a3a, 0x6a7a4a, 0x2a2f45, 0xa8a090];
    const colsByShelf = [];
    const addBook = (b) => { b.c = b.c != null ? b.c : pal[Math.floor(R() * pal.length)]; b.v = Math.floor(R() * 4); books.push(b); return b; };
    // 立てた本の列。x0から右へ詰め、xEndを超える手前で止める。
    function row(x0, xEnd, y0, hMin, hMax, dMin, dMax) {
      let x = x0, last = null;
      while (true) {
        const w = R() < 0.15 ? rr(R, 4, 5.5) : rr(R, 1.4, 3.6);
        if (x + w > xEnd) break;
        const h = rr(R, hMin, hMax), d = rr(R, dMin, dMax);
        const zb = sz0 + 0.2 + rr(R, 0, 1.5);
        last = addBook({ w, h, d, x: x + w / 2, y: y0 + h / 2, z: zb + d / 2, rz: 0, ry: 0, x0: x, x1: x + w, top: y0 + h });
        x += w + rr(R, 0, 0.12);
      }
      return { x, last };
    }
    // 左へ寄りかかる本: x0 = 左隣の右端
    function leanL(x0, y0, prevH, th, h, d) {
      const w = rr(R, 1.6, 3.2), c = Math.cos(th), s = Math.sin(th);
      const px = x0 + Math.min(h * s, prevH * 0.95 * Math.tan(th));
      const zb = sz0 + 0.5;
      return addBook({ w, h, d, x: px + (w / 2) * c - (h / 2) * s, y: y0 + (w / 2) * s + (h / 2) * c, z: zb + d / 2, rz: th, ry: 0,
        x0: px - h * s, x1: px + w * c, top: y0 + w * s + h * c });
    }
    function leanR(x1, y0, prevH, th, h, d) {
      const w = rr(R, 1.6, 3.2), c = Math.cos(th), s = Math.sin(th);
      const qx = x1 - Math.min(h * s, prevH * 0.95 * Math.tan(th));
      const zb = sz0 + 0.5;
      return addBook({ w, h, d, x: qx - (w / 2) * c + (h / 2) * s, y: y0 + (w / 2) * s + (h / 2) * c, z: zb + d / 2, rz: -th, ry: 0,
        x0: qx - w * c, x1: qx + h * s, top: y0 + w * s + h * c });
    }
    // 平積み: 本の高さ方向がx、厚みが上
    function stack(xc, y0, n, hMin, hMax, dMin, dMax) {
      let y = y0, xs = [];
      for (let i = 0; i < n; i++) {
        const w = rr(R, 1.8, 3.8), h = rr(R, hMin, hMax), d = rr(R, dMin, dMax), cx = xc + rr(R, -0.8, 0.8);
        addBook({ w, h, d, x: cx, y: y + w / 2, z: sz1 - 2 - d / 2 + rr(R, -0.8, 0), rz: Math.PI / 2, ry: rr(R, -0.06, 0.06), x0: cx - h / 2, x1: cx + h / 2, top: y + w });
        xs.push(h); y += w;
      }
      return y;
    }
    const shelfTop = shelfY.map((y) => y + t);
    // S0 (底段 9.8〜44): 大判本 + マガジンファイル + 平積み
    let r0 = row(-ix + 0.2, 4, shelfTop[0], 24, 31.5, 19, 25);
    const st0 = stack(31.5, shelfTop[0], 3, 21, 22.5, 15, 18);
    // S1 (45.8〜80): 本の列 + 寄りかかる2冊 + 花器
    let r1 = row(-ix + 0.2, 10, shelfTop[1], 19, 29, 14, 21);
    const l1 = leanL(r1.x, shelfTop[1], r1.last.h, 0.22, 25, 17);
    // S2 (81.8〜114): 平積み + 写真立て + ブックエンド付きの列
    const st2 = stack(-31.5, shelfTop[2], 4, 18, 21, 13, 16);
    let r2 = row(19.6, ix - 0.2, shelfTop[2], 17, 27, 13, 19);
    // S3 (115.8〜146): 右寄せの列 + 右へ寄りかかる1冊
    let r3s = row(2, ix - 0.2, shelfTop[3], 18, 27, 13, 19);
    const firstR3 = books.find((b) => Math.abs(b.y - b.h / 2 - shelfTop[3]) < 0.01 && b.x0 >= 1.99);
    leanR(firstR3.x0 - 0.1, shelfTop[3], firstR3.h, 0.28, 24, 16);
    // S4 (147.8〜178.2): 文庫本
    let r4 = row(-ix + 0.2, -16, shelfTop[4], 14.8, 15.4, 10.5, 11.2);
    stack(-2, shelfTop[4], 2, 14.8, 15.2, 10.5, 11);

    // InstancedMesh: 表紙(4種の背表紙)+ ページ
    const { cover, pages } = bookGeos();
    const pageMat = std({
      color: 0xf1ead6, roughness: 0.9,
      map: cached('pages', () => drawTex(128, 16, (c, w, h) => {
        c.fillStyle = '#f4eedc'; c.fillRect(0, 0, w, h);
        const r = rng(4); for (let x = 0; x < w; x++) { c.fillStyle = `rgba(120,100,70,${r() * 0.35})`; c.fillRect(x, 0, 1, h); }
      })),
    });
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), col = new T.Color();
    const setM = (b) => { e.set(0, b.ry, b.rz); q.setFromEuler(e); m4.compose(new T.Vector3(b.x, b.y, b.z), q, new T.Vector3(b.w, b.h, b.d)); return m4; };
    for (let v = 0; v < 4; v++) {
      const list = books.filter((b) => b.v === v);
      if (!list.length) continue;
      const mat = std({ map: spineTex(v), roughness: 0.7, side: T.DoubleSide });
      const im = new T.InstancedMesh(cover, mat, list.length);
      list.forEach((b, i) => { im.setMatrixAt(i, setM(b)); col.setHex(b.c); im.setColorAt(i, col); });
      im.castShadow = im.receiveShadow = true; g.add(im);
    }
    const pim = new T.InstancedMesh(pages, pageMat, books.length);
    books.forEach((b, i) => pim.setMatrixAt(i, setM(b)));
    pim.castShadow = pim.receiveShadow = true; g.add(pim);

    // ---- 小物
    const glaze = new T.MeshPhysicalMaterial({ map: cached('glazeSage', () => speckleTex(41, 0x8fa59a, 256, 256, 500)), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3 });
    const misc = std({ vertexColors: true, roughness: 0.6 });
    const twig = std({ color: 0x5a4030, roughness: 0.9 });
    const walnut = std({ map: cached('walnut', () => woodTex(11, 0x7c5a3e, 0x4a3221, 11)), roughness: 0.5 });
    const kraft = std({ map: cached('kraft', () => speckleTex(43, 0xb38d5d, 256, 256, 900)), roughness: 0.85 });
    const metalBlack = std({ color: 0x222222, metalness: 0.5, roughness: 0.45 });
    // 花器と枝 (S1)
    const vx = 33, vy = shelfTop[1];
    B.put(glaze, lathe([[0, 0], [3.2, 0], [3.6, 0.4], [4.8, 4], [5.0, 7], [3.6, 11], [1.6, 13.6], [1.5, 15.5], [1.9, 16], [1.6, 16.2], [1.1, 15.4], [1.1, 12]], 32), [vx, vy, -3]);
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4, hh = 26 + i * 3;
      const pts = [[vx, vy + 10, -3], [vx + Math.cos(a) * 1.2, vy + 17, -3 + Math.sin(a) * 1.2], [vx + Math.cos(a) * 4, vy + hh * 0.85, -3 + Math.sin(a) * 3], [vx + Math.cos(a) * 6.5, vy + hh, -3 + Math.sin(a) * 4.5]];
      B.put(twig, tube(pts, 0.22 - i * 0.03, 30, 5));
      B.put(twig, tube([pts[2], [pts[2][0] + 2.5, pts[2][1] + 3, pts[2][2] - 1]], 0.12, 6, 4));
    }
    // マガジンファイル (S0)
    {
      const s = new T.Shape(); s.moveTo(-11, 0); s.lineTo(11, 0); s.lineTo(11, 13); s.lineTo(-2, 30); s.lineTo(-11, 30); s.lineTo(-11, 0);
      const mg = new T.ExtrudeGeometry(s, { depth: 9, bevelEnabled: false }); mg.rotateY(-Math.PI / 2); mg.translate(4.5, 0, 0);
      B.put(kraft, mg, [12.5, shelfTop[0], -1]);
      // 中の雑誌
      for (let i = 0; i < 3; i++) B.put(misc, colorize(new T.BoxGeometry(0.6, 27, 20), [0xd8d2c4, 0x6f8fa0, 0xc4a070][i]), [9.5 + i * 2.2, shelfTop[0] + 14 + i * 0.4, -2.5]);
      B.put(misc, colorize(new T.PlaneGeometry(5, 7), 0xf6f1e6), [12.5, shelfTop[0] + 6, 10.02]);
    }
    // 写真立て (S2) — 少し後ろに傾けて立てる
    {
      const m = new T.Matrix4().makeRotationFromEuler(new T.Euler(-0.18, 0.15, 0)); m.setPosition(-5, shelfTop[2], 2);
      const fr = new T.Shape(); fr.moveTo(-7, 0); fr.lineTo(7, 0); fr.lineTo(7, 18); fr.lineTo(-7, 18); fr.lineTo(-7, 0);
      const hole = new T.Path(); hole.moveTo(-5.5, 1.5); hole.lineTo(-5.5, 16.5); hole.lineTo(5.5, 16.5); hole.lineTo(5.5, 1.5); hole.lineTo(-5.5, 1.5);
      fr.holes.push(hole);
      const fg = new T.ExtrudeGeometry(fr, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1 });
      B.putM(walnut, fg, m);
      const photo = std({
        roughness: 0.35,
        map: cached('photo', () => drawTex(128, 192, (c, w, h) => {
          const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#8fb3cf'); sky.addColorStop(0.55, '#e9d7b8'); sky.addColorStop(1, '#6d8a5a');
          c.fillStyle = sky; c.fillRect(0, 0, w, h);
          c.fillStyle = '#5c7654'; c.beginPath(); c.moveTo(0, 120); c.quadraticCurveTo(40, 85, 80, 112); c.quadraticCurveTo(105, 100, 128, 118); c.lineTo(128, 192); c.lineTo(0, 192); c.fill();
          c.fillStyle = '#3f5a3a'; c.beginPath(); c.moveTo(0, 150); c.quadraticCurveTo(64, 128, 128, 160); c.lineTo(128, 192); c.lineTo(0, 192); c.fill();
          c.fillStyle = '#f7e9c4'; c.beginPath(); c.arc(92, 70, 9, 0, TAU); c.fill();
          c.fillStyle = '#33302c'; c.fillRect(40, 132, 6, 18); c.fillRect(52, 136, 5, 14);
        })),
      });
      const pg = new T.PlaneGeometry(11.2, 15.2); pg.translate(0, 9, 0.6); B.putM(photo, pg, m);
      const bk = colorize(new T.BoxGeometry(12, 16, 0.3), 0x4a3a2c); bk.translate(0, 9, -0.05); B.putM(misc, bk, m);
      const leg = colorize(new T.BoxGeometry(3, 12, 0.3), 0x4a3a2c); leg.rotateX(-0.45); leg.translate(0, 5.5, -2.6); B.putM(misc, leg, m);
    }
    // ブックエンド (S2 列の左)
    B.put(metalBlack, new T.BoxGeometry(0.3, 15, 12), [19.3, shelfTop[2] + 7.5, -6]);
    B.put(metalBlack, new T.BoxGeometry(10, 0.25, 12), [24.3, shelfTop[2] + 0.12, -6]);
    // 木箱 + キャンドル (S3 左)
    B.put(walnut, boxW(13, 6.5, 9, 30, R), [-30, shelfTop[3] + 3.25, -2]);
    B.put(walnut, boxW(13.4, 1.2, 9.4, 30, R), [-30, shelfTop[3] + 7.1, -2]);
    B.put(brass, cyl(0.6, 0.6, 0.6, 12), [-30, shelfTop[3] + 6.6, 2.75], [Math.PI / 2, 0, 0]);
    const glass = new T.MeshPhysicalMaterial({ color: 0xd8e2e0, roughness: 0.08, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false });
    B.put(glass, cyl(3.3, 3.1, 8.5, 28), [-14, shelfTop[3] + 4.25, 4]);
    B.put(misc, colorize(cyl(3.0, 3.0, 5.5, 28), 0xeee6d2), [-14, shelfTop[3] + 2.9, 4]);
    B.put(misc, colorize(cyl(0.08, 0.08, 1.2, 6), 0x222222), [-14, shelfTop[3] + 6.2, 4]);
    // 小鉢 (S4)
    B.put(glaze, lathe([[0, 0], [2.5, 0], [3, 0.4], [4.6, 2.4], [5.8, 4.6], [5.6, 4.8], [4.3, 2.8], [0, 1.0]], 32), [26, shelfTop[4], 0]);
    B.build(g, new Set([glass]));

    // ---- 当たり判定
    const C = [
      [-W / 2, 0, -D / 2, -ix, H, D / 2], [ix, 0, -D / 2, W / 2, H, D / 2], [-W / 2, H - t, -D / 2, W / 2, H, D / 2],
      [-ix, 0, -D / 2, ix, H - t, -D / 2 + 0.6], [-ix, 0, -14.4, ix, 7.75, -12.6],
    ];
    for (const y of shelfY) C.push([-ix, y, sz0, ix, y + t, sz1]);
    // 本: 棚ごと・連続する本をまとめて1箱
    const sorted = books.map((b) => ({ x0: b.x0, x1: b.x1, top: b.top, z0: b.z - b.d / 2, z1: b.z + b.d / 2, sh: shelfTop.findIndex((s, i) => b.y > s && (i === 4 || b.y < shelfTop[i + 1])) }))
      .sort((a, b) => a.sh - b.sh || a.x0 - b.x0);
    let cur = null;
    for (const b of sorted) {
      if (cur && cur.sh === b.sh && b.x0 <= cur.x1 + 0.6) {
        cur.x1 = Math.max(cur.x1, b.x1); cur.top = Math.max(cur.top, b.top); cur.z0 = Math.min(cur.z0, b.z0); cur.z1 = Math.max(cur.z1, b.z1);
      } else { if (cur) C.push([cur.x0, shelfTop[cur.sh], cur.z0, cur.x1, cur.top, cur.z1]); cur = Object.assign({}, b); }
    }
    if (cur) C.push([cur.x0, shelfTop[cur.sh], cur.z0, cur.x1, cur.top, cur.z1]);
    C.push([vx - 5, vy, -8, vx + 5, vy + 16.2, 2]);                 // 花器
    C.push([8, shelfTop[0], -12, 17, shelfTop[0] + 30, 10]);          // マガジンファイル
    C.push([-12, shelfTop[2], -3, 2, shelfTop[2] + 18, 4]);          // 写真立て
    C.push([19.1, shelfTop[2], -12, 19.5, shelfTop[2] + 15, 0]);      // ブックエンド
    C.push([-36.7, shelfTop[3], -6.7, -23.3, shelfTop[3] + 7.7, 2.7]);// 木箱
    C.push([-17.3, shelfTop[3], 0.7, -10.7, shelfTop[3] + 8.5, 7.3]); // キャンドル
    C.push([20.2, shelfTop[4], -5.8, 31.8, shelfTop[4] + 4.8, 5.8]);  // 小鉢
    g.userData.colliders = C.map((a) => a.map((v) => Math.round(v * 100) / 100));
    return g;
  };

  // ================================================================ floorLamp
  window.MODELS.floorLamp = function () {
    const g = new T.Group(), B = new Bld();
    const bronze = std({ color: 0x2e2a25, metalness: 0.55, roughness: 0.42 });
    const brass = std({ color: 0xb48f55, metalness: 0.75, roughness: 0.28 });
    const felt = std({ color: 0x3b4a3a, roughness: 1 });
    const cord = std({ color: 0x232222, roughness: 0.7 });
    const plastic = std({ vertexColors: true, roughness: 0.4 });
    const prong = std({ color: 0xc8c8c8, metalness: 0.8, roughness: 0.3 });
    const linen = cached('linen', () => linenTex(61, 0xebe2cf));
    const shadeOut = std({ map: linen, color: 0xffffff, emissive: 0xffd6a0, emissiveMap: linen, emissiveIntensity: 0.38, roughness: 0.95, side: T.FrontSide });
    const shadeIn = std({ map: linen, color: 0xfff4e0, emissive: 0xffd9a8, emissiveMap: linen, emissiveIntensity: 0.85, roughness: 0.95, side: T.BackSide });
    const band = std({ color: 0xd9ccb2, roughness: 0.9, emissive: 0x6a5434, emissiveIntensity: 0.35 });
    const bulb = std({ color: 0xffffff, emissive: 0xfff0cc, emissiveIntensity: 1.0, roughness: 0.3 });
    // ---- 台座(鋳物、裏にフェルト)
    B.put(felt, cyl(13.2, 13.2, 0.5, 40), [0, 0.25, 0]);
    B.put(bronze, lathe([[0, 0.5], [13.6, 0.5], [14.6, 0.8], [15.1, 1.6], [14.9, 2.6], [14.2, 3.3], [11, 3.8], [4.2, 4.4], [2.6, 4.6], [0, 4.6]], 64));
    B.put(bronze, new T.TorusGeometry(14.6, 0.12, 6, 64), [0, 2.2, 0], [Math.PI / 2, 0, 0]);   // 縁の段差線
    B.put(brass, lathe([[0, 4.4], [2.6, 4.4], [2.4, 5.2], [1.6, 7.6], [1.6, 8.4], [0, 8.4]], 24));  // カラー
    // ---- ポール(継ぎ目あり)
    B.put(bronze, cyl(1.0, 1.0, 120, 20), [0, 68, 0]);
    for (const y of [48, 88]) {
      B.put(brass, cyl(1.25, 1.25, 1.6, 20), [0, y, 0]);
      B.put(brass, new T.TorusGeometry(1.25, 0.12, 6, 20), [0, y + 0.8, 0], [Math.PI / 2, 0, 0]);
      B.put(brass, new T.TorusGeometry(1.25, 0.12, 6, 20), [0, y - 0.8, 0], [Math.PI / 2, 0, 0]);
    }
    // ---- ソケット+電球
    B.put(brass, cyl(1.7, 1.4, 2, 20), [0, 129, 0]);
    B.put(brass, cyl(2.0, 2.0, 6.5, 24), [0, 133.2, 0]);
    for (const y of [130.6, 133.5, 135.8]) B.put(brass, new T.TorusGeometry(2.03, 0.13, 6, 24), [0, y, 0], [Math.PI / 2, 0, 0]);
    B.put(brass, cyl(0.35, 0.35, 1.6, 10), [2.7, 132, 0], [0, 0, Math.PI / 2]);
    B.put(brass, new T.BoxGeometry(0.4, 1.6, 0.9), [3.6, 132, 0]);
    B.put(bulb, lathe([[0, 136.4], [1.3, 136.4], [1.4, 137.6], [2.6, 140], [3.1, 142.5], [2.9, 144.6], [2.0, 146.2], [0, 146.8]], 28));
    // ---- ハープ + フィニアル
    for (const s of [-1, 1]) B.put(brass, tube([[s * 2.1, 129.5, 0], [s * 7, 137, 0], [s * 7.5, 147, 0], [s * 3, 155, 0], [s * 0.4, 157, 0]], 0.18, 40, 5));
    B.put(brass, cyl(1.4, 1.4, 0.35, 20), [0, 157.2, 0]);
    B.put(brass, lathe([[0, 157.3], [0.7, 157.3], [0.5, 158], [1.1, 158.8], [0.9, 159.7], [0, 160]], 16));
    // スパイダー(3本の腕で上リングへ)
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + 0.3;
      B.put(brass, tube([[Math.cos(a) * 1.3, 156.9, Math.sin(a) * 1.3], [Math.cos(a) * 16.4, 156.7, Math.sin(a) * 16.4]], 0.15, 2, 4));
    }
    // ---- シェード(布、内側が明るい)
    const shadeGeo = () => lathe([[23, 129], [21.4, 135], [19.8, 141], [18.2, 147], [16.5, 153], [16.2, 157]], 72);
    const sOut = shadeGeo(); sOut.attributes.uv.array.forEach((v, i, arr) => { arr[i] = i % 2 ? v * 4.5 : v * 22; });
    const sIn = shadeGeo(); sIn.attributes.uv.array.forEach((v, i, arr) => { arr[i] = i % 2 ? v * 4.5 : v * 22; });
    B.put(shadeOut, sOut); B.put(shadeIn, sIn);
    B.put(band, lathe([[23.2, 128.9], [23.15, 130.1]], 72)); B.put(band, lathe([[16.35, 155.9], [16.3, 157.1]], 72));
    B.put(band, new T.TorusGeometry(23.1, 0.18, 6, 72), [0, 128.95, 0], [Math.PI / 2, 0, 0]);
    B.put(band, new T.TorusGeometry(16.3, 0.18, 6, 72), [0, 157.05, 0], [Math.PI / 2, 0, 0]);
    // ---- コード(台座の後ろから床を這う)+ フットスイッチ + プラグ
    const S = [-23, 0, -50], dir = new T.Vector3(-6, 0, -5).normalize(), ry = yaw(dir.x, dir.z);
    const a = [S[0] - dir.x * 4.3, 0.75, S[2] - dir.z * 4.3], b = [S[0] + dir.x * 4.3, 0.75, S[2] + dir.z * 4.3];
    B.put(cord, tube([[0, 1.5, -14.6], [0, 0.9, -16.3], [-0.6, 0.3, -19], [-3, 0.3, -27], [-9, 0.3, -36], [a[0] + dir.x * -3, 0.3, a[2] + dir.z * -3], a], 0.3, 70, 6));
    B.put(cord, tube([b, [b[0] + dir.x * 3, 0.3, b[2] + dir.z * 3], [-35, 0.3, -58], [-48, 0.3, -63], [-60, 0.3, -64], [-66.5, 0.95, -64]], 0.3, 60, 6));
    B.put(plastic, colorize(cyl(0.9, 0.9, 1.6, 12), 0x2a2a2a), [0, 1.6, -14.6], [Math.PI / 2, 0, 0]);   // 台座のブッシュ
    {
      const m = new T.Matrix4().makeRotationY(ry); m.setPosition(S[0], 0, S[2]);
      const body = colorize(rbox(7.6, 2.4, 4.4, 1.6, 0.6), 0x2b2b2b); body.translate(0, 1.2, 0); B.putM(plastic, body, m);
      const btn = colorize(cyl(1.5, 1.6, 0.5, 24), 0xd9d6cf); btn.translate(0.6, 2.55, 0); B.putM(plastic, btn, m);
      const led = colorize(cyl(0.25, 0.25, 0.1, 8), 0xff8a2a); led.translate(-2.6, 2.42, 0); B.putM(plastic, led, m);
      for (const s of [-1, 1]) { const sr = colorize(cyl(0.5, 0.42, 1.2, 10), 0x2b2b2b); sr.rotateZ(Math.PI / 2); sr.translate(s * 4.1, 0.75, 0); B.putM(plastic, sr, m); }
    }
    addPlug(B, plastic, prong, [-68.2, 0.95, -64], Math.PI, 0x2b2b2b);
    B.build(g, new Set([shadeIn]));
    g.userData.colliders = [
      [-15, 0, -10.6, 15, 4.6, 10.6], [-10.6, 0, -15, 10.6, 4.6, 15], [-2.6, 4.6, -2.6, 2.6, 8.4, 2.6],
      [-1.3, 8.4, -1.3, 1.3, 129, 1.3], [-23, 129, -23, 23, 157, 23],
      [S[0] - 3.8, 0, S[2] - 3.4, S[0] + 3.8, 2.8, S[2] + 3.4], [-70, 0, -65.5, -64.5, 1.9, -62.5],
    ];
    return g;
  };

  // ================================================================ plant
  function leafGeo(L, Wd, R, opt) {
    const nu = 14, nv = 7, pos = [], uv = [], idx = [];
    const droop = opt.droop, fold = opt.fold, wave = opt.wave, ph = R() * TAU;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, x = u * L;
      const half = (Wd / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.85);
      for (let j = 0; j < nv; j++) {
        const v = (j / (nv - 1)) * 2 - 1, z = v * half;
        let y = -droop * u * u * L + fold * Math.abs(z) * 0.45 + wave * Math.sin(u * Math.PI * 3 + ph) * v * v * half * 0.12;
        y += opt.curl * v * v * half * 0.15 * (1 - u);
        pos.push(x, y, z); uv.push(u, (v + 1) / 2);
      }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv - 1; j++) {
      const a = i * nv + j, b = a + nv;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const gg = new T.BufferGeometry();
    gg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    gg.setIndex(idx); gg.computeVertexNormals();
    return gg;
  }
  function leafTex() {
    return cached('leaf', () => drawTex(512, 256, (c, w, h) => {
      const r = rng(77);
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#3c6a2a'); gr.addColorStop(0.5, '#4b7c34'); gr.addColorStop(1, '#3f6e2b');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '90,140,60' : '30,60,20'},0.08)`; c.beginPath(); c.arc(r() * w, r() * h, 6 + r() * 20, 0, TAU); c.fill(); }
      const g2 = c.createLinearGradient(0, 0, 0, h);
      g2.addColorStop(0, 'rgba(25,45,12,0.55)'); g2.addColorStop(0.22, 'rgba(25,45,12,0)'); g2.addColorStop(0.78, 'rgba(25,45,12,0)'); g2.addColorStop(1, 'rgba(25,45,12,0.55)');
      c.fillStyle = g2; c.fillRect(0, 0, w, h);
      // 細かい網状脈
      c.strokeStyle = 'rgba(160,200,120,0.18)'; c.lineWidth = 1;
      for (let i = 0; i < 500; i++) { const x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rr(r, -8, 8), y + rr(r, -8, 8)); c.stroke(); }
      // 側脈
      c.strokeStyle = 'rgba(185,215,135,0.6)'; c.lineWidth = 2.2;
      for (let i = 0; i < 15; i++) {
        const x0 = 22 + i * (w - 70) / 15;
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x0, h / 2); c.quadraticCurveTo(x0 + 20, h / 2 + s * h * 0.22, x0 + 55, h / 2 + s * h * 0.47); c.stroke(); }
      }
      // 主脈(先へ細く)
      c.fillStyle = 'rgba(205,228,160,0.95)';
      c.beginPath(); c.moveTo(0, h / 2 - 6); c.lineTo(w, h / 2 - 0.6); c.lineTo(w, h / 2 + 0.6); c.lineTo(0, h / 2 + 6); c.fill();
    }));
  }

  window.MODELS.plant = function () {
    const g = new T.Group(), B = new Bld(), R = rng(53);
    const glaze = new T.MeshPhysicalMaterial({
      map: cached('glazeCream', () => (() => { const t = speckleTex(51, 0xf2e9d6, 256, 256, 260); t.repeat.set(4, 3); return t; })()),
      roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25, side: T.DoubleSide, shadowSide: T.BackSide,
    });
    const clay = std({ map: cached('clay', () => speckleTex(52, 0x9a6a50, 256, 64, 300)), roughness: 0.9, side: T.DoubleSide, shadowSide: T.BackSide });
    const saucerM = std({ map: cached('clay', () => speckleTex(52, 0x9a6a50, 256, 64, 300)), roughness: 0.85, side: T.DoubleSide, shadowSide: T.BackSide });
    // ---- 受け皿・鉢
    B.put(saucerM, lathe([[0, 0.05], [12.6, 0.05], [13.2, 0.4], [15.4, 2.4], [15.3, 2.75], [14.7, 2.55], [12.8, 0.9], [0, 0.9]], 56));
    B.put(clay, lathe([[0, 0.9], [10.2, 0.9], [10.8, 1.2], [11.2, 3.2]], 56));
    B.put(glaze, lathe([[11.2, 3.2], [11.6, 6], [12.5, 12], [13.4, 18], [14.2, 23], [15.0, 27.5], [15.9, 28.6], [16.2, 29.8], [15.8, 30.6], [15.1, 30.5], [14.6, 29.5], [14.3, 27], [12.8, 16], [10.6, 5], [0, 5]], 56));
    // ---- 土
    const soilY = 27.2;
    const soilTex = cached('soil', () => {
      const r = rng(9), n = makeNoise(9);
      return pixTex(256, 256, (u, v, o) => { const k = 0.7 + fbm(n, u * 16, v * 16, 16, 16, 3) * 0.5; o[0] = 74 * k; o[1] = 54 * k; o[2] = 38 * k; }, (c, w, h) => {
        for (let i = 0; i < 2600; i++) {
          const t = r(); c.fillStyle = t < 0.08 ? 'rgba(235,232,222,0.9)' : t < 0.5 ? `rgba(30,20,12,${0.4 + r() * 0.4})` : `rgba(120,90,60,${0.3 + r() * 0.4})`;
          c.beginPath(); c.arc(r() * w, r() * h, 0.6 + r() * 1.8, 0, TAU); c.fill();
        }
      });
    });
    soilTex.repeat.set(3, 3);
    const soilM = std({ map: soilTex, roughness: 1 });
    {
      const sg = new T.RingGeometry(0.01, 14.4, 64, 12), p = sg.attributes.position, n = makeNoise(19);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), rad = Math.hypot(x, y);
        p.setZ(i, (fbm(n, x * 0.25 + 50, y * 0.25 + 50, 256, 256, 3) - 0.5) * 1.3 + Math.pow(rad / 14.4, 4) * 0.9);
      }
      sg.computeVertexNormals(); sg.rotateX(-Math.PI / 2);
      B.put(soilM, sg, [0, soilY, 0]);
    }
    // ---- 茎と葉
    const stemM = std({
      roughness: 0.6,
      map: cached('stem', () => drawTex(256, 16, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#6b5238'); gr.addColorStop(0.3, '#5e6a3a'); gr.addColorStop(0.6, '#4f7a35'); gr.addColorStop(1, '#5d8c3c');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        const r = rng(3); c.fillStyle = 'rgba(40,30,20,0.3)'; for (let i = 0; i < 60; i++) c.fillRect(r() * w * 0.45, r() * h, 1, 2 + r() * 4);
      })),
    });
    const leafM = std({ map: leafTex(), vertexColors: true, roughness: 0.45, side: T.DoubleSide, emissive: 0xc8e0a0, emissiveMap: leafTex(), emissiveIntensity: 0.2 });
    // 葉の裏から見ても表と同じ法線で照らす(薄い葉の透過っぽさ)
    leafM.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
        T.ShaderChunk.normal_fragment_begin.replace(/normal = normal \* [^;]+;/g, ''));
    };
    const stems = [
      { top: 99, ang: 0.4, lean: 7, r: 0.75 }, { top: 86, ang: 2.4, lean: 10, r: 0.68 },
      { top: 74, ang: 4.3, lean: 12, r: 0.6 }, { top: 62, ang: 5.6, lean: 9, r: 0.55 },
    ];
    let phi = 0;
    const stemCol = [];
    for (const st of stems) {
      const bx = Math.cos(st.ang) * 2.8, bz = Math.sin(st.ang) * 2.8, dx = Math.cos(st.ang), dz = Math.sin(st.ang);
      const Hs = st.top - soilY - 6;
      const pts = [[bx, soilY - 1, bz], [bx + dx * st.lean * 0.1, soilY + Hs * 0.25, bz + dz * st.lean * 0.1],
        [bx + dx * st.lean * 0.35 + dz * 1.5, soilY + Hs * 0.55, bz + dz * st.lean * 0.35 - dx * 1.5],
        [bx + dx * st.lean * 0.75, soilY + Hs * 0.82, bz + dz * st.lean * 0.75], [bx + dx * st.lean, soilY + Hs, bz + dz * st.lean]];
      const curve = new T.CatmullRomCurve3(pts.map(V));
      B.put(stemM, new T.TubeGeometry(curve, 48, st.r, 7, false));
      stemCol.push([bx, bz]);
      // 茎の節
      const L0 = curve.getLength(), nLeaf = Math.max(4, Math.round(L0 * 0.62 / 7.5));
      for (let k = 0; k < nLeaf; k++) {
        const tt = 0.38 + (k / (nLeaf - 1)) * 0.6, P = curve.getPointAt(tt);
        phi += 2.4;
        const young = tt > 0.9, lenL = (young ? 11 : lerp(25, 15, (tt - 0.38) / 0.6)) + rr(R, -2, 2);
        const ch = new T.Vector3(Math.cos(phi), 0, -Math.sin(phi));
        const pb = [P.x + ch.x * 3, P.y + 1.8, P.z + ch.z * 3];
        const pet = tube([[P.x, P.y, P.z], [P.x + ch.x * 1.4, P.y + 1.3, P.z + ch.z * 1.4], pb], 0.22, 8, 5);
        const puv = pet.attributes.uv; for (let i = 0; i < puv.count; i++) puv.setX(i, 0.9);
        B.put(stemM, pet);
        B.put(stemM, new T.SphereGeometry(st.r * 1.3, 8, 6), [P.x, P.y, P.z]);
        const elev = young ? rr(R, 0.9, 1.15) : rr(R, 0.25, 0.65);
        const lg = leafGeo(lenL, lenL * (young ? 0.32 : rr(R, 0.42, 0.5)), R, { droop: young ? 0.02 : rr(R, 0.12, 0.28), fold: young ? 1.4 : rr(R, 0.3, 0.6), wave: rr(R, 0.5, 1.5), curl: young ? 2 : 0 });
        const m = new T.Matrix4().makeTranslation(pb[0], pb[1], pb[2])
          .multiply(new T.Matrix4().makeRotationY(phi)).multiply(new T.Matrix4().makeRotationZ(elev)).multiply(new T.Matrix4().makeRotationX(rr(R, -0.25, 0.25)));
        const c = new T.Color(young ? 0x9fd06a : 0xffffff).multiplyScalar(young ? 1 : rr(R, 0.72, 1.0));
        colorize(lg, c.getHex()); B.putM(leafM, lg, m);
      }
      // 先端の巻いた新芽
      const tip = curve.getPointAt(1);
      B.put(stemM, new T.ConeGeometry(st.r * 0.9, 4, 7), [tip.x, tip.y + 2, tip.z]);
    }
    B.build(g);
    // 小石・バーク (InstancedMesh)
    {
      const n = 110, im = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), std({ roughness: 0.85 }), n);
      const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), cc = new T.Color();
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, rad = Math.sqrt(R()) * 13.4, bark = R() < 0.35;
        const s = bark ? new T.Vector3(rr(R, 0.8, 1.4), 0.2, rr(R, 0.4, 0.8)) : new T.Vector3().setScalar(rr(R, 0.25, 0.6)).multiply(new T.Vector3(1, rr(R, 0.6, 1), rr(R, 0.7, 1.2)));
        e.set(bark ? rr(R, -0.2, 0.2) : R() * 6, R() * 6, bark ? rr(R, -0.2, 0.2) : R() * 6); q.setFromEuler(e);
        m.compose(new T.Vector3(Math.cos(a) * rad, soilY + 0.25 + Math.pow(rad / 14.4, 4) * 0.8, Math.sin(a) * rad), q, s);
        im.setMatrixAt(i, m);
        cc.setHex(bark ? 0x5a4030 : [0x9a958c, 0x7d776e, 0xb5aea2, 0x6e665c][Math.floor(R() * 4)]); im.setColorAt(i, cc);
      }
      im.castShadow = im.receiveShadow = true; g.add(im);
    }
    const C = [
      [-15.4, 0, -15.4, 15.4, 2.75, 15.4],
      [-14.3, 2.75, -10, 14.3, soilY, 10], [-10, 2.75, -14.3, 10, soilY, 14.3],
      [-16.2, soilY, 13.6, 16.2, 30.6, 16.2], [-16.2, soilY, -16.2, 16.2, 30.6, -13.6],
      [-16.2, soilY, -13.6, -13.6, 30.6, 13.6], [13.6, soilY, -13.6, 16.2, 30.6, 13.6],
    ];
    for (const [x, z] of stemCol) C.push([x - 1, soilY, z - 1, x + 1, soilY + 22, z + 1]);
    g.userData.colliders = C.map((a) => a.map((v) => Math.round(v * 100) / 100));
    return g;
  };
})();
