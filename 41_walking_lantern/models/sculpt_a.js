// 多脚の彫刻 案A「岩を担ぐ十脚」 — Three.js r128 / 1 = 1cm / 原点 = 胴体の真下の地面 / +Z が正面
// 巨大な花崗岩を、鏡面ステンレスの帯(サドル板)が下から抱え、帯の外周から10本の細い脚が出る。
(function () {
  'use strict';
  window.MODELS = window.MODELS || {};

  // ---------- 小道具 ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash3(i, j, k, s) {
    const h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + s * 19.19) * 43758.5453;
    return h - Math.floor(h);
  }
  function vnoise(x, y, z, s) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let xf = x - xi, yf = y - yi, zf = z - zi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
    return l(l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
             l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
  }
  function fbm(x, y, z, s, oct) {
    let a = 0, amp = 0.5, f = 1, tot = 0;
    for (let o = 0; o < oct; o++) { a += amp * (vnoise(x * f, y * f, z * f, s + o) * 2 - 1); tot += amp; amp *= 0.5; f *= 2.03; }
    return a / tot;
  }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function mergeGeo(list) {
    const P = [], N = [], U = [];
    for (const g0 of list) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array);
      if (g.attributes.uv) U.push(...g.attributes.uv.array); else for (let i = 0; i < g.attributes.position.count; i++) U.push(0, 0);
    }
    const o = new THREE.BufferGeometry();
    o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    o.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    o.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    return o;
  }

  // ---------- テクスチャ ----------
  function graniteTex() {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const x = c.getContext('2d'), R = rng(11);
    x.fillStyle = '#aaa3a1'; x.fillRect(0, 0, 1024, 1024);
    const mott = ['#c4a9a2', '#9b9594', '#bdb2ae', '#a8918c', '#8f8d8f'];
    for (let i = 0; i < 320; i++) {
      x.globalAlpha = 0.10 + R() * 0.10; x.fillStyle = mott[(R() * mott.length) | 0];
      x.beginPath(); x.ellipse(R() * 1024, R() * 1024, 18 + R() * 60, 14 + R() * 45, R() * 3, 0, 6.283); x.fill();
    }
    const cols = [['#141417', 0.20], ['#f1ede7', 0.22], ['#d3aaa0', 0.28], ['#8a8687', 0.30]];
    for (let i = 0; i < 38000; i++) {
      let r = R(), col = cols[3][0];
      for (const cc of cols) { if (r < cc[1]) { col = cc[0]; break; } r -= cc[1]; }
      const big = R() < 0.08 ? 1.8 : 1;
      x.globalAlpha = 0.55 + R() * 0.4; x.fillStyle = col;
      x.beginPath(); x.ellipse(R() * 1024, R() * 1024, (1.4 + R() * 3.6) * big, (1.0 + R() * 2.8) * big, R() * 3, 0, 6.283); x.fill();
    }
    x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  function envTex() {
    const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.26, '#e2e9f2'); g.addColorStop(0.48, '#b8c3d0');
    g.addColorStop(0.5, '#2b2723'); g.addColorStop(0.6, '#85755f'); g.addColorStop(1, '#171512');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const box = (u, v, w, h, col) => {
      for (let k = 0; k < 6; k++) {
        const e = (6 - k) * 4; x.globalAlpha = 0.22; x.fillStyle = col;
        x.fillRect(u * W - w / 2 - e, v * H - h / 2 - e, w + 2 * e, h + 2 * e);
      }
      x.globalAlpha = 1; x.fillStyle = col; x.fillRect(u * W - w / 2, v * H - h / 2, w, h);
    };
    box(0.10, 0.22, 120, 70, '#ffffff'); box(0.40, 0.30, 100, 60, '#ffffff'); box(0.66, 0.17, 170, 80, '#ffffff');
    box(0.88, 0.30, 90, 56, '#fff4e4'); box(0.27, 0.34, 14, 130, '#ffffff'); box(0.78, 0.38, 12, 100, '#ffffff');
    box(0.52, 0.27, 90, 56, '#12161d'); box(0.00, 0.34, 70, 40, '#14181f'); box(0.20, 0.10, 60, 30, '#ffffff');
    const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }

  // ---------- 岩 ----------
  function buildRock() {
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const pos = geo.attributes.position.array, nV = pos.length / 3;
    const AX = [210, 150, 190], R = rng(7);
    for (let i = 0; i < nV; i++) {
      const ux = pos[i * 3], uy = pos[i * 3 + 1], uz = pos[i * 3 + 2];
      let m = 1 + 0.22 * fbm(ux * 1.2, uy * 1.2, uz * 1.2, 3, 3) + 0.075 * fbm(ux * 3.3, uy * 3.3, uz * 3.3, 9, 3) + 0.016 * fbm(ux * 8, uy * 8, uz * 8, 20, 2);
      const rg = 1 - Math.abs(fbm(ux * 2.2 + 5, uy * 2.2, uz * 2.2, 31, 2)); // 筋(割れ目)
      m -= 0.05 * smooth(0.86, 0.97, rg);
      pos[i * 3] = ux * AX[0] * m; pos[i * 3 + 1] = uy * AX[1] * m; pos[i * 3 + 2] = uz * AX[2] * m;
    }
    // 割れ面(平面で削る)。上面・側面・下の肩に数枚
    const planes = [[0.25, 1, 0.12], [-0.85, 0.30, 0.2], [0.9, 0.2, -0.45], [0.2, 0.35, 1], [-0.3, -0.25, -1], [0.7, -0.55, 0.3], [-0.6, 0.85, -0.3], [0.55, 0.8, 0.5], [-0.5, -0.7, 0.6], [0.1, 0.5, -1], [1, -0.1, 0.5]];
    const cutK = [0.80, 0.78, 0.80, 0.82, 0.80, 0.84, 0.82, 0.82, 0.84, 0.80, 0.84];
    planes.forEach((pl, k) => {
      const l = Math.hypot(...pl), n = pl.map(v => v / l);
      const h = Math.hypot(AX[0] * n[0], AX[1] * n[1], AX[2] * n[2]) * cutK[k];
      for (let i = 0; i < nV; i++) {
        const d = pos[i * 3] * n[0] + pos[i * 3 + 1] * n[1] + pos[i * 3 + 2] * n[2] - h;
        if (d > 0) { pos[i * 3] -= d * n[0]; pos[i * 3 + 1] -= d * n[1]; pos[i * 3 + 2] -= d * n[2]; }
      }
    });
    // 寸法を 420 x 300 x 380 に合わせて中心を原点へ
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i * 3 + a]); mx[a] = Math.max(mx[a], pos[i * 3 + a]); }
    const want = [420, 300, 380];
    for (let i = 0; i < nV; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = (pos[i * 3 + a] - (mn[a] + mx[a]) / 2) * want[a] / (mx[a] - mn[a]);

    // 角を保った滑らか法線
    const nF = nV / 3, fn = new Float32Array(nF * 3), fu = new Float32Array(nF * 3), map = new Map();
    const key = (i) => Math.round(pos[i * 3] * 10) + ',' + Math.round(pos[i * 3 + 1] * 10) + ',' + Math.round(pos[i * 3 + 2] * 10);
    for (let f = 0; f < nF; f++) {
      const a = f * 9;
      const e1 = [pos[a + 3] - pos[a], pos[a + 4] - pos[a + 1], pos[a + 5] - pos[a + 2]];
      const e2 = [pos[a + 6] - pos[a], pos[a + 7] - pos[a + 1], pos[a + 8] - pos[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(...n) || 1;
      for (let k = 0; k < 3; k++) { fn[f * 3 + k] = n[k]; fu[f * 3 + k] = n[k] / l; }
      for (let c = 0; c < 3; c++) { const kk = key(f * 3 + c); (map.get(kk) || map.set(kk, []).get(kk)).push(f); }
    }
    const nor = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), col = new Float32Array(nV * 3);
    const cosT = Math.cos(28 * Math.PI / 180), S = 150;
    for (let f = 0; f < nF; f++) for (let c = 0; c < 3; c++) {
      const vi = f * 3 + c, list = map.get(key(vi));
      let nx = 0, ny = 0, nz = 0;
      for (const g of list) {
        if (fu[g * 3] * fu[f * 3] + fu[g * 3 + 1] * fu[f * 3 + 1] + fu[g * 3 + 2] * fu[f * 3 + 2] > cosT) { nx += fn[g * 3]; ny += fn[g * 3 + 1]; nz += fn[g * 3 + 2]; }
      }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      nor[vi * 3] = nx; nor[vi * 3 + 1] = ny; nor[vi * 3 + 2] = nz;
      const px = pos[vi * 3], py = pos[vi * 3 + 1], pz = pos[vi * 3 + 2];
      // 箱型UV(面の向きで投影)
      const ax = Math.abs(fu[f * 3]), ay = Math.abs(fu[f * 3 + 1]), az = Math.abs(fu[f * 3 + 2]);
      if (ay >= ax && ay >= az) { uv[vi * 2] = px / S; uv[vi * 2 + 1] = pz / S; }
      else if (ax >= az) { uv[vi * 2] = pz / S + 0.37; uv[vi * 2 + 1] = py / S; }
      else { uv[vi * 2] = px / S + 0.71; uv[vi * 2 + 1] = py / S + 0.5; }
      // 頂点色: 灰〜薄桃のムラ、くぼみの暗さ、上向き面の地衣類
      const tone = fbm(px / 60, py / 60, pz / 60, 51, 3), warm = 0.5 + 0.5 * tone;
      let r = 0.92 + 0.08 * warm, gg = 0.93 - 0.01 * warm, b = 0.94 - 0.04 * warm;
      const crev = fbm(px / 25, py / 25, pz / 25, 77, 2);
      const dk = 0.86 + 0.14 * smooth(-0.5, 0.3, crev); r *= dk; gg *= dk; b *= dk;
      const lm = smooth(0.10, 0.34, fbm(px / 48 + 3, py / 48, pz / 48, 91, 3) + 0.30 * fbm(px / 13, py / 13, pz / 13, 95, 2))
               * (0.25 + 0.75 * Math.max(0, ny)) * (0.55 + 0.45 * smooth(-0.4, 0.2, py / 150 + 0.1));
      r = r + (0.86 - r) * lm * 0.8; gg = gg + (1.10 - gg) * lm * 0.8; b = b + (0.78 - b) * lm * 0.8;
      col[vi * 3] = r; col[vi * 3 + 1] = gg; col[vi * 3 + 2] = b;
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    og.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    og.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    og.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tex = graniteTex();
    const mat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 1.4, vertexColors: true, roughness: 0.88, metalness: 0 });
    return new THREE.Mesh(og, mat);
  }

  // ---------- 掃引(帯・ストラップ) ----------
  function rrect(w, h, r, seg) {
    const cs = [[w / 2 - r, h - r, 0], [-w / 2 + r, h - r, Math.PI / 2], [-w / 2 + r, r, Math.PI], [w / 2 - r, r, 1.5 * Math.PI]], pts = [];
    for (const c of cs) for (let k = 0; k <= seg; k++) { const a = c[2] + k / seg * Math.PI / 2; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    return pts;
  }
  function sweep(frames, prof, closed) {
    const nF = frames.length, nP = prof.length, P = [], U = [], I = [];
    for (let i = 0; i < nF; i++) { const f = frames[i]; for (let j = 0; j < nP; j++) {
      const a = prof[j][0], b = prof[j][1];
      P.push(f.p.x + f.s.x * a + f.n.x * b, f.p.y + f.s.y * a + f.n.y * b, f.p.z + f.s.z * a + f.n.z * b);
      U.push(i / (nF - 1), j / nP);
    } }
    const segF = closed ? nF : nF - 1;
    for (let i = 0; i < segF; i++) { const i1 = (i + 1) % nF; for (let j = 0; j < nP; j++) { const j1 = (j + 1) % nP;
      const a = i * nP + j, b = i1 * nP + j, c = i1 * nP + j1, d = i * nP + j1; I.push(a, b, d, b, c, d); } }
    // 向きの確認(最初の四角が外を向くか)
    let ca = 0, cb = 0; for (const q of prof) { ca += q[0] / nP; cb += q[1] / nP; }
    const f0 = frames[0], cen = new THREE.Vector3(f0.p.x + f0.s.x * ca + f0.n.x * cb, f0.p.y + f0.s.y * ca + f0.n.y * cb, f0.p.z + f0.s.z * ca + f0.n.z * cb);
    const v = (k) => new THREE.Vector3(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
    const A = v(I[0]), B = v(I[1]), D = v(I[2]);
    const nn = B.clone().sub(A).cross(D.clone().sub(A));
    if (nn.dot(A.clone().sub(cen)) < 0) for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I); g.computeVertexNormals();
    return g;
  }
  function blurCirc(arr, k, pass) {
    const n = arr.length; let a = Float32Array.from(arr);
    for (let p = 0; p < pass; p++) { const b = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0; for (let d = -k; d <= k; d++) s += a[(i + d + n) % n]; b[i] = s / (2 * k + 1); } a = b; }
    return a;
  }
  function maxCirc(arr, k) {
    const n = arr.length, b = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = -1e9; for (let d = -k; d <= k; d++) m = Math.max(m, arr[(i + d + n) % n]); b[i] = m; }
    return b;
  }

  // ---------- IK(仕様どおり) ----------
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
    leg.knee.rotation.x = Math.PI - beta;
  }

  // ---------- 本体 ----------
  window.MODELS.sculpt_a = function () {
    const g = new THREE.Group(), body = new THREE.Group();
    const BODY_Y = 520, YB = -75, HALF_H = 38, T_BAND = 9, NLEG = 10;
    const KNEE_R = 470, KNEE_H = 750, FOOT_R = 620;
    body.position.y = BODY_Y; g.add(body); g.userData.body = body;

    const env = envTex();
    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.15, envMap: env, envMapIntensity: 1.25, side: THREE.DoubleSide });

    const rock = buildRock(); body.add(rock); rock.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();

    // 帯の半径 R(θ): 岩の腹の外形を放射状に測って滑らかにつなぐ
    const NB = 360, Rraw = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      const th = i / NB * Math.PI * 2, dx = Math.sin(th), dz = Math.cos(th); let best = 0;
      for (let l = 0; l <= 6; l++) {
        const yy = YB - HALF_H + l * (HALF_H * 2 / 6);
        rc.set(new THREE.Vector3(dx * 700, yy, dz * 700), new THREE.Vector3(-dx, 0, -dz));
        const h = rc.intersectObject(rock)[0];
        if (h) best = Math.max(best, Math.hypot(h.point.x, h.point.z));
      }
      Rraw[i] = best || 190;
    }
    const Rs = blurCirc(maxCirc(Rraw, 7), 9, 3);
    const Rat = (th) => { const f = ((th / (Math.PI * 2)) % 1 + 1) % 1 * NB, i = Math.floor(f), t = f - i; return Rs[i % NB] * (1 - t) + Rs[(i + 1) % NB] * t + 4; };

    // 帯本体
    const ringFrames = [];
    for (let i = 0; i < NB; i++) {
      const th = i / NB * Math.PI * 2, e = 0.01;
      const P = (t) => new THREE.Vector3(Rat(t) * Math.sin(t), YB, Rat(t) * Math.cos(t));
      const T = P(th + e).sub(P(th - e)).normalize(), s = new THREE.Vector3(0, 1, 0);
      ringFrames.push({ p: P(th), s, n: new THREE.Vector3().crossVectors(T, s).normalize() });
    }
    const prof = rrect(HALF_H * 2, T_BAND, 3.6, 5).map(q => [q[0], q[1]]);
    const ring = new THREE.Mesh(sweep(ringFrames, prof, true), steel); body.add(ring);

    // 下から抱えるストラップ(2本)。岩の下面を上向きの光線でなぞる
    const strapGeos = [], rivetMats = [];
    const strapAngles = [0, 108];
    strapAngles.forEach((deg, si) => {
      const ph = deg * Math.PI / 180, d = new THREE.Vector3(Math.sin(ph), 0, Math.cos(ph)), side = new THREE.Vector3(Math.cos(ph), 0, -Math.sin(ph));
      const s0 = -Rat(ph + Math.PI), s1 = Rat(ph), NS = 64;
      const ys = [], hit = [];
      for (let i = 0; i <= NS; i++) {
        const s = s0 + (s1 - s0) * i / NS;
        rc.set(new THREE.Vector3(d.x * s, -500, d.z * s), new THREE.Vector3(0, 1, 0));
        const h = rc.intersectObject(rock)[0]; hit.push(h ? h.point.y : null);
      }
      let last = null; for (let i = 0; i <= NS; i++) { if (hit[i] !== null) { last = hit[i]; } else if (last !== null) hit[i] = last; }
      last = null; for (let i = NS; i >= 0; i--) { if (hit[i] !== null) { last = hit[i]; } else if (last !== null) hit[i] = last; }
      for (let i = 0; i <= NS; i++) {
        const u = Math.abs(i / NS * 2 - 1), w = smooth(0.80, 1.0, u);
        ys.push(hit[i] * (1 - w) + (YB - 26) * w - 0.8);
      }
      let sm = Float32Array.from(ys);
      for (let p = 0; p < 4; p++) { const b = Float32Array.from(sm); for (let i = 1; i < NS; i++) b[i] = (sm[i - 1] + 2 * sm[i] + sm[i + 1]) / 4; sm = b; }
      for (let i = 0; i <= NS; i++) { const u = Math.abs(i / NS * 2 - 1); if (u < 0.8 && hit[i] - 0.8 < sm[i]) sm[i] = hit[i] - 0.8; }
      const pts = []; for (let i = 0; i <= NS; i++) { const s = s0 + (s1 - s0) * i / NS; pts.push(new THREE.Vector3(d.x * s, sm[i] - si * 2.2, d.z * s)); }
      const frames = pts.map((p, i) => {
        const T = pts[Math.min(NS, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
        let n = new THREE.Vector3().crossVectors(T, side).normalize();
        if (n.y > 0) n.negate();
        // 半径方向の端では外向き(下向き)に統一
        return { p, s: side, n };
      });
      strapGeos.push(sweep(frames, rrect(46, 7, 2.6, 4), false));
      // ストラップ中心線のリベット
      for (let i = 4; i < NS - 3; i += 3) {
        const f = frames[i], q = f.p.clone().add(f.n.clone().multiplyScalar(7));
        const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.n));
        for (const sd of [-15, 15]) { const mm = m.clone(); mm.setPosition(q.x + side.x * sd, q.y, q.z + side.z * sd); rivetMats.push(mm); }
      }
    });
    const straps = new THREE.Mesh(mergeGeo(strapGeos), steel); body.add(straps);

    // 帯の継ぎ目(突き合わせ板)と脚の取り付け位置
    const plateShape = new THREE.Shape(); rrect(26, 66, 4.5, 4).forEach((q, i) => { const px = q[0], py = q[1] - 33; i ? plateShape.lineTo(px, py) : plateShape.moveTo(px, py); });
    const plateBase = new THREE.ExtrudeGeometry(plateShape, { depth: 2.2, bevelEnabled: true, bevelSize: 0.9, bevelThickness: 0.9, bevelSegments: 2, curveSegments: 4 });
    plateBase.translate(0, 0, 0);
    const plates = [];
    const yawM = (th, x, y, z) => new THREE.Vector3(x * Math.cos(th) + z * Math.sin(th), y, -x * Math.sin(th) + z * Math.cos(th));
    for (let k = 0; k < NLEG; k++) {
      const th = k * Math.PI * 2 / NLEG, Rr = Rat(th) + T_BAND;
      const pg = plateBase.clone(); pg.rotateY(th); const o = yawM(th, 0, 0, Rr); pg.translate(o.x, YB, o.z); plates.push(pg);
      for (const cx of [-8.5, 8.5]) for (const cy of [-24, -8, 8, 24]) {
        const q = yawM(th, cx, cy, Rr + 3.2), m = new THREE.Matrix4().makeRotationY(th); m.setPosition(q.x, YB + q.y, q.z); rivetMats.push(m);
      }
    }
    body.add(new THREE.Mesh(mergeGeo(plates), steel));

    // 帯の縁のリベット列
    for (let i = 0; i < 100; i++) {
      const th = i / 100 * Math.PI * 2, ph = ((th / (Math.PI * 2 / NLEG)) % 1 + 1) % 1; // 0 = 継ぎ目
      const hipD = Math.abs(ph - 0.5), seamD = Math.min(ph, 1 - ph);
      if (hipD < 0.2 || seamD < 0.09) continue;
      for (const dy of [-31, 31]) {
        const q = yawM(th, 0, dy, Rat(th) + T_BAND), m = new THREE.Matrix4().makeRotationY(th); m.setPosition(q.x, YB + q.y, q.z); rivetMats.push(m);
      }
    }

    // ---------- 脚 ----------
    const legs = [], legMeshes = [];
    for (let i = 0; i < NLEG; i++) {
      const th = (i * 36 + 18) * Math.PI / 180;
      const Rh = Rat(th) + T_BAND;
      const hx = Rh * Math.sin(th), hz = Rh * Math.cos(th);
      const H = new THREE.Vector3(hx, BODY_Y + YB, hz), K = new THREE.Vector3(KNEE_R * Math.sin(th), KNEE_H, KNEE_R * Math.cos(th)), F = new THREE.Vector3(FOOT_R * Math.sin(th), 0, FOOT_R * Math.cos(th));
      const L1 = K.distanceTo(H), L2 = F.distanceTo(K), ang = Math.atan2(K.y - H.y, KNEE_R - Rh);

      const hip = new THREE.Object3D(); hip.position.set(hx, YB, hz); body.add(hip);
      const femur = new THREE.Object3D(); hip.add(femur);
      const knee = new THREE.Object3D(); knee.position.set(0, 0, L1); femur.add(knee);

      const taper = (r1, r0, L) => { const q = new THREE.CylinderGeometry(r1, r0, L, 20, 6); q.rotateX(Math.PI / 2); q.translate(0, 0, L / 2); return q; };
      const m1 = new THREE.Mesh(taper(7, 14, L1), steel); m1.userData.seg = 1; m1.userData.leg = i; femur.add(m1);
      const m2 = new THREE.Mesh(taper(7 - 4.5 * (L2 - 5.5) / L2, 7, L2 - 5.5), steel); m2.userData.seg = 2; m2.userData.leg = i; knee.add(m2);

      // カラー(上の骨を包む筒+先端の玉縁)
      const sp = [[16.8, -4], [17.8, 6], [17.3, 30], [16.4, 70], [15.4, 98], [15.8, 103], [17.8, 106], [17.8, 113], [15.8, 116], [13.4, 118.5], [12.1, 121]];
      const sleeve = new THREE.LatheGeometry(sp.map(q => new THREE.Vector2(q[0], q[1])), 28); sleeve.rotateX(Math.PI / 2);
      femur.add(new THREE.Mesh(sleeve, steel));

      // 取り付け座(円盤)+ ガセット板2枚(帯に固定。脚が動いても動かない)
      const bp = [[0, -4], [31, -4], [34, -1.5], [34, 2.5], [31.5, 5.5], [24, 6.6], [15, 6.6]];
      const boss = new THREE.LatheGeometry(bp.map(q => new THREE.Vector2(q[0], q[1])), 40); boss.rotateX(Math.PI / 2);
      const Dg = 132, sh = new THREE.Shape();
      sh.moveTo(3, -32); sh.lineTo(Dg * Math.cos(ang), Dg * Math.sin(ang)); sh.lineTo(3, 36); sh.lineTo(3, -32);
      const gus0 = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: true, bevelSize: 0.9, bevelThickness: 0.9, bevelSegments: 2 });
      gus0.translate(0, 0, -1.5); gus0.rotateY(-Math.PI / 2);
      const gl = gus0.clone().translate(13.5, 0, 0), gr = gus0.clone().translate(-13.5, 0, 0);
      hip.add(new THREE.Mesh(mergeGeo([boss, gl, gr]), steel));
      // ボルト(座の外周)
      for (let b = 0; b < 8; b++) {
        const a = b / 8 * Math.PI * 2 + 0.2, q = yawM(th, Math.cos(a) * 28.6, Math.sin(a) * 28.6, Rh + 5.4), m = new THREE.Matrix4().makeRotationY(th); m.setPosition(q.x, YB + q.y, q.z); rivetMats.push(m);
      }

      // 膝(蝶番): 軸+両側の円盤
      const sp1 = new THREE.CylinderGeometry(10.5, 10.5, 20, 24); sp1.rotateZ(Math.PI / 2);
      const dsc = new THREE.CylinderGeometry(14, 14, 3, 28); dsc.rotateZ(Math.PI / 2);
      const cap = new THREE.CylinderGeometry(5, 5, 3, 16); cap.rotateZ(Math.PI / 2);
      knee.add(new THREE.Mesh(mergeGeo([sp1, dsc.clone().translate(11.5, 0, 0), dsc.clone().translate(-11.5, 0, 0), cap.clone().translate(14, 0, 0), cap.clone().translate(-14, 0, 0)]), steel));

      // 足先(玉縁+尖り)。先端が z=L2 で、y=0 に着く
      const fp = [[2.5, -34], [3.5, -30], [4.8, -23], [4.9, -17], [3.6, -11], [3.0, -8], [2.7, -5.5], [1.6, -2.6], [0.6, -0.6], [0, 0]];
      const foot = new THREE.LatheGeometry(fp.map(q => new THREE.Vector2(q[0], q[1])), 20); foot.rotateX(Math.PI / 2); foot.translate(0, 0, L2);
      knee.add(new THREE.Mesh(foot, steel));

      legs.push({ hip, femur, knee, L1, L2, foot: F.clone() });
    }

    // リベット(InstancedMesh 1つ)
    const rg = new THREE.SphereGeometry(2.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); rg.rotateX(Math.PI / 2);
    const rivets = new THREE.InstancedMesh(rg, steel, rivetMats.length);
    rivetMats.forEach((m, i) => rivets.setMatrixAt(i, m)); body.add(rivets);

    g.userData.legs = legs; g.updateMatrixWorld(true);
    for (const leg of legs) solveLeg(leg, leg.foot);
    g.updateMatrixWorld(true);

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.info = { name: '岩を担ぐ十脚', legs: NLEG, bodySize: [420, 300, 380], kneeHeight: KNEE_H, footRadius: FOOT_R };
    return g;
  };
})();
