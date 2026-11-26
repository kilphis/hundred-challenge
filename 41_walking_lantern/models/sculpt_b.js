// 多脚の彫刻 案B「伏せた舟」 — 竜骨を上にして伏せた木の舟の胴体 + 12本のブロンズの脚
// 1 = 1cm / Y上 / 舳先 +Z / 原点 = 胴体の真下の地面。Three.js r128、外部画像なし。
(function () {
  'use strict';
  window.MODELS = window.MODELS || {};

  // ---------- 寸法 ----------
  const HL = 430;            // 船体の半長(舳先〜艫 860 + 柱)
  const HW = 130;            // 最大半幅(幅 260)
  const D0 = 170;            // 最大の深さ
  const GY0 = 380;           // 舷縁の最低の高さ(両端)
  const SHEER = 24;          // 中央で舷縁が持ち上がる量
  const P = 1.7;             // 断面の丸み
  const NPL = 9;             // 片側の外板の枚数
  const LAP = 3.2;           // 外板の重なりの段差
  const WALL = 7;            // 板厚
  const L1 = 320, L2 = 620;  // 上の骨 / 下の骨
  const FOOT_X = 450;        // 足先の x(中心線から)
  const LEG_Z = [-375, -225, -75, 75, 225, 375];

  const clamp = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // 平面形・深さ・舷縁の高さ(q = z/HL, -1 艫 〜 +1 舳)
  function halfW(q) {
    const a = Math.abs(clamp(q, -1, 1));
    return q >= 0 ? HW * Math.pow(Math.max(0, 1 - Math.pow(a, 2.2)), 0.72)
                  : HW * Math.pow(Math.max(0, 1 - Math.pow(a, 2.8)), 0.68);
  }
  function depth(q) { const a = Math.abs(clamp(q, -1, 1)); return 40 + (D0 - 40) * (1 - Math.pow(a, 2.4)); }
  function gy(q) { const c = clamp(q, -1, 1); return GY0 + SHEER * (1 - c * c); }

  // 断面上の点。v: 0=竜骨 〜 1=舷縁、off: 法線方向のずらし(+外)
  function secPt(q, v, off, sx) {
    const hw = halfW(q), d = depth(q), yg = gy(q);
    let x = hw * v, y = yg + d * (1 - Math.pow(v, P));
    if (off !== 0) {
      const nx = d * P * Math.pow(v, P - 1), ny = hw, l = Math.hypot(nx, ny) || 1;
      const f = Math.min(1, hw / 22);
      x += off * f * nx / l; y += off * f * ny / l;
    }
    return [sx * x, y, q * HL];
  }

  // 外板の境界 v_k(中央断面の弧長で等分)
  const VB = (function () {
    const N = 300, acc = [0]; let px = 0, py = D0;
    for (let i = 1; i <= N; i++) {
      const v = i / N, x = HW * v, y = D0 * (1 - Math.pow(v, P));
      acc.push(acc[i - 1] + Math.hypot(x - px, y - py)); px = x; py = y;
    }
    const out = [0];
    for (let k = 1; k < NPL; k++) {
      const target = acc[N] * k / NPL; let i = 0; while (acc[i] < target) i++;
      out.push(i / N);
    }
    out.push(1); return out;
  })();

  // ---------- ジオメトリ組み立て ----------
  class Builder {
    constructor() { this.p = []; this.u = []; this.idx = []; this.n = 0; }
    // fn(i,j) -> [x,y,z,u,v]; ex(x,y,z) -> 期待する法線(向きの自動判定に使う)
    grid(nr, nc, fn, ex) {
      const base = this.n, W = nc + 1, P0 = [];
      for (let i = 0; i <= nr; i++) for (let j = 0; j <= nc; j++) {
        const a = fn(i, j); P0.push(a); this.p.push(a[0], a[1], a[2]); this.u.push(a[3], a[4]);
      }
      this.n += (nr + 1) * W;
      let acc = 0;
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        const a = P0[i * W + j], b = P0[i * W + j + 1], c = P0[(i + 1) * W + j];
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const e = ex(a[0], a[1], a[2]); acc += n[0] * e[0] + n[1] * e[1] + n[2] * e[2];
      }
      const flip = acc < 0;
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        const a = base + i * W + j, b = a + 1, c = a + W, d = c + 1;
        if (!flip) this.idx.push(a, b, c, b, d, c); else this.idx.push(a, c, b, b, c, d);
      }
    }
    // 輪郭 pts(3D の点列, 閉)を扇状に塞ぐ
    cap(pts, dir) {
      const base = this.n; let cx = 0, cy = 0, cz = 0;
      pts.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
      cx /= pts.length; cy /= pts.length; cz /= pts.length;
      this.p.push(cx, cy, cz); this.u.push(0.5, 0.5);
      pts.forEach((p, k) => { this.p.push(p[0], p[1], p[2]); this.u.push(0.5 + 0.4 * Math.cos(k), 0.5 + 0.4 * Math.sin(k)); });
      this.n += pts.length + 1;
      const a = pts[0], b = pts[1], c = [cx, cy, cz];
      const e1 = [b[0] - c[0], b[1] - c[1], b[2] - c[2]], e2 = [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
      const nz = e1[0] * e2[1] - e1[1] * e2[0], nn = [0, 0, nz];
      const flip = (nn[2] * dir) < 0;
      for (let k = 0; k < pts.length; k++) {
        const i0 = base, i1 = base + 1 + k, i2 = base + 1 + ((k + 1) % pts.length);
        if (!flip) this.idx.push(i0, i2, i1); else this.idx.push(i0, i1, i2);
      }
    }
    // 断面 sec(z)(xy の閉じた多角形)を z 方向に押し出す。端は塞ぐ
    sweep(zs, sec, uvScale) {
      const ns = sec(zs[0]).length, nz = zs.length - 1;
      for (let e = 0; e < ns; e++) {
        this.grid(nz, 1, (i, j) => {
          const s = sec(zs[i]), p = s[(e + j) % ns];
          return [p[0], p[1], zs[i], zs[i] / uvScale, (e + j) / ns];
        }, (x, y, z) => {
          const s = sec(z); let cx = 0, cy = 0; s.forEach(p => { cx += p[0]; cy += p[1]; });
          return [x - cx / ns, y - cy / ns, 0];
        });
      }
      [[zs[0], -1], [zs[nz], 1]].forEach(([z, dir]) => this.cap(sec(z).map(p => [p[0], p[1], z]), dir));
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.setIndex(this.idx); g.computeVertexNormals(); return g;
    }
  }

  // ---------- テクスチャ ----------
  function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function wobbleLine(ctx, x0, x1, y, amp, freq, ph, step) {
    ctx.beginPath(); ctx.moveTo(x0, y + Math.sin(x0 * freq + ph) * amp);
    for (let x = x0 + step; x <= x1; x += step) ctx.lineTo(x, y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.3 + ph * 2) * amp * 0.3);
    ctx.stroke();
  }
  // タール塗りの風化した板 1 枚(幅 w, 高さ h, y0 から)
  function paintPlank(ctx, w, y0, h, R, butt) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, y0, w, h); ctx.clip();
    const t = R() - 0.5;
    ctx.fillStyle = `rgb(${33 + t * 12 | 0},${25 + t * 9 | 0},${19 + t * 7 | 0})`; ctx.fillRect(0, y0, w, h);
    // 大きな色ムラ(塩と日焼けの灰褐色 / 湿った黒)
    for (let i = 0; i < 9; i++) {
      const cx = R() * w, cy = y0 + R() * h, rx = 60 + R() * 260, ry = 8 + R() * h * 0.7;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(rx, ry);
      const gr = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1);
      const dark = R() < 0.5, c = dark ? '16,11,8' : '98,82,62';
      gr.addColorStop(0, `rgba(${c},${dark ? 0.5 : 0.2})`); gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill(); ctx.restore();
    }
    // タールのはげ(素の木が見える)
    const nw = 3 + (R() * 4 | 0);
    for (let i = 0; i < nw; i++) {
      const cx = R() * w, cy = y0 + R() * h, rx = 14 + R() * 120, ry = 3 + R() * h * 0.28;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(rx, ry);
      const gr = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
      const wood = R() < 0.5 ? '142,104,66' : '112,84,56';
      gr.addColorStop(0, `rgba(${wood},0.7)`); gr.addColorStop(0.55, `rgba(${wood},0.32)`); gr.addColorStop(1, `rgba(${wood},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill(); ctx.restore();
    }
    // 木目
    for (let i = 0; i < 70; i++) {
      const y = y0 + R() * h, light = R() < 0.45;
      ctx.strokeStyle = light ? `rgba(150,112,74,${0.05 + R() * 0.12})` : `rgba(8,5,3,${0.15 + R() * 0.3})`;
      ctx.lineWidth = 0.5 + R() * 1.7;
      wobbleLine(ctx, 0, w, y, 0.4 + R() * 2.2, 0.004 + R() * 0.01, R() * 6, 14);
    }
    // 重なり縁の擦れ(上端)
    const eg = ctx.createLinearGradient(0, y0, 0, y0 + 11);
    eg.addColorStop(0, 'rgba(150,112,72,0.55)'); eg.addColorStop(1, 'rgba(150,112,72,0)');
    ctx.fillStyle = eg; ctx.fillRect(0, y0, w, 11);
    const eg2 = ctx.createLinearGradient(0, y0 + h - 8, 0, y0 + h);
    eg2.addColorStop(0, 'rgba(6,4,3,0)'); eg2.addColorStop(1, 'rgba(6,4,3,0.55)');
    ctx.fillStyle = eg2; ctx.fillRect(0, y0 + h - 8, w, 8);
    // 板の継ぎ目(突き合わせ)とひび
    if (butt) for (let i = 0; i < 1 + (R() * 2 | 0); i++) {
      const x = R() * w; ctx.fillStyle = 'rgba(5,3,2,0.85)'; ctx.fillRect(x, y0, 3, h);
      ctx.fillStyle = 'rgba(150,112,72,0.25)'; ctx.fillRect(x + 3, y0, 1.2, h);
    }
    for (let i = 0; i < 6; i++) {
      const x = R() * w, y = y0 + R() * h * 0.8; ctx.strokeStyle = 'rgba(6,4,2,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - 0.5) * 12, y + 6 + R() * 18); ctx.stroke();
    }
    ctx.restore();
  }
  function woodHullTex() {
    const W = 1024, H = 1024, c = cvs(W, H), ctx = c.getContext('2d'), R = rng(7);
    for (let k = 0; k < NPL; k++) paintPlank(ctx, W, Math.round(k * H / NPL), Math.ceil(H / NPL), R, true);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function woodTrimTex() {
    const c = cvs(512, 256), ctx = c.getContext('2d'); paintPlank(ctx, 512, 0, 256, rng(21), false);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function woodInnerTex() { // 内側: タールが薄く、乾いた暗い木
    const c = cvs(512, 256), ctx = c.getContext('2d'), R = rng(33);
    ctx.fillStyle = '#3b2a1c'; ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 8; i++) {
      const cx = R() * 512, cy = R() * 256, rx = 40 + R() * 160, ry = 10 + R() * 60;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(rx, ry);
      const gr = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1), dk = R() < 0.5;
      gr.addColorStop(0, dk ? 'rgba(14,9,6,0.55)' : 'rgba(120,90,58,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill(); ctx.restore();
    }
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = R() < 0.5 ? `rgba(120,88,58,${0.1 + R() * 0.2})` : `rgba(8,5,3,${0.2 + R() * 0.3})`;
      ctx.lineWidth = 0.5 + R() * 1.6; wobbleLine(ctx, 0, 512, R() * 256, 0.5 + R() * 2, 0.006 + R() * 0.01, R() * 6, 12);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function bronzeTex() { // 暗い緑がかったブロンズ、緑青のムラ
    const S = 512, c = cvs(S, S), ctx = c.getContext('2d'), R = rng(5);
    ctx.fillStyle = '#6c6a42'; ctx.fillRect(0, 0, S, S);
    const blob = (n, cols, rmin, rmax, sy) => {
      for (let i = 0; i < n; i++) {
        const cx = R() * S, cy = R() * S, r = rmin + R() * (rmax - rmin), col = cols[R() * cols.length | 0];
        for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
          ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.scale(1, sy);
          const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          gr.addColorStop(0, col + '0.55)'); gr.addColorStop(1, col + '0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.restore();
        }
      }
    };
    blob(26, ['rgba(40,30,16,'], 30, 90, 1);                    // 黒ずみ
    blob(38, ['rgba(92,150,118,', 'rgba(70,128,110,', 'rgba(108,160,128,'], 20, 80, 1.5); // 緑青
    blob(40, ['rgba(130,102,52,'], 10, 40, 1);                   // 地金の見えるところ
    for (let i = 0; i < 70; i++) { // 縦に流れる緑青
      const x = R() * S, y = R() * S, len = 40 + R() * 160;
      const gr = ctx.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, 'rgba(96,156,124,0.5)'); gr.addColorStop(1, 'rgba(96,156,124,0)');
      ctx.fillStyle = gr; ctx.fillRect(x, y, 1.5 + R() * 4, len);
    }
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = R() < 0.5 ? 'rgba(20,16,8,0.25)' : 'rgba(150,196,160,0.2)'; ctx.fillRect(R() * S, R() * S, 1.5, 1.5);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }

  // ---------- 脚 ----------
  function bone(L, rRoot, rEnd, mat, seg, leg) {
    const geo = new THREE.CylinderGeometry(1, 1, L, 18, 16, true);
    geo.rotateX(Math.PI / 2); geo.translate(0, 0, L / 2);
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getZ(i) / L, ux = pos.getX(i), uy = pos.getY(i), l = Math.hypot(ux, uy) || 1;
      const s = Math.pow(1 - t, 1.35), r = rEnd + (rRoot - rEnd) * s;
      const drdz = -1.35 * (rRoot - rEnd) * Math.pow(1 - t, 0.35) / L;
      pos.setXYZ(i, ux / l * r, uy / l * r, pos.getZ(i));
      const nl = Math.hypot(1, drdz);
      nor.setXYZ(i, ux / l / nl, uy / l / nl, -drdz / nl);
      uv.setXY(i, uv.getX(i) * 1.2, uv.getY(i) * L / 110);
    }
    const m = new THREE.Mesh(geo, mat); m.userData.seg = seg; m.userData.leg = leg; return m;
  }
  function latheZ(pts, seg) { // pts: [r, z] の列(z 昇順)。軸 = +Z
    const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 24);
    g.rotateX(Math.PI / 2); return g;
  }
  function bossGeo() { // 付け根の補強: 丸い座 + 二重のカラー(帯)
    return latheZ([[0.01, -17], [9, -15.5], [15.5, -9], [19, 1], [20, 9], [17.5, 16], [15.5, 21],
      [18, 24], [18.5, 29], [15, 33], [13.6, 38], [13.4, 44], [16.2, 47], [16.4, 52], [13, 56],
      [12.6, 62], [13.6, 65], [13.8, 69], [10.2, 72]]);
  }
  function footGeo() { // 足先: 小さな玉 + 首 + 輪。先端が z=L2
    // 先端は尖り(傾いても最下点になる)。少し上に玉と輪
    const pts = [[0.01, L2], [1.5, L2 - 3], [2.6, L2 - 8], [3.6, L2 - 14]];
    const rb = 5.2, zc = L2 - 20;
    for (let k = 0; k <= 8; k++) { const a = Math.PI * (0.2 + 0.7 * k / 8); pts.push([rb * Math.sin(a), zc + rb * Math.cos(a)]); }
    pts.push([2.6, L2 - 29], [2.6, L2 - 36], [4.6, L2 - 38], [4.8, L2 - 43], [2.9, L2 - 45]);
    pts.sort((a, b) => a[1] - b[1]); return latheZ(pts, 16);
  }

  function solveLeg(leg, targetWorld) {
    const p = leg.hip.parent.worldToLocal(targetWorld.clone()).sub(leg.hip.position);
    leg.hip.rotation.set(0, Math.atan2(p.x, p.z), 0);
    leg.hip.updateMatrixWorld(true);
    const t = leg.hip.worldToLocal(targetWorld.clone());
    const l1 = leg.L1, l2 = leg.L2;
    const r = Math.min(Math.max(Math.hypot(t.y, t.z), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
    const phi = Math.atan2(-t.y, t.z);
    const alpha = Math.acos((l1 * l1 + r * r - l2 * l2) / (2 * l1 * r));
    const beta = Math.acos((l1 * l1 + l2 * l2 - r * r) / (2 * l1 * l2));
    leg.femur.rotation.x = phi - alpha;
    leg.knee.rotation.x = Math.PI - beta;
  }

  // ---------- 本体 ----------
  window.MODELS.sculpt_b = function () {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.userData.body = body;

    const hullTex = woodHullTex(), trimTex = woodTrimTex(), innerTex = woodInnerTex(), brzTex = bronzeTex();
    const mHull = new THREE.MeshStandardMaterial({ map: hullTex, bumpMap: hullTex, bumpScale: 1.6, roughness: 0.92, metalness: 0 });
    const mTrim = new THREE.MeshStandardMaterial({ map: trimTex, bumpMap: trimTex, bumpScale: 1.2, roughness: 0.9, metalness: 0 });
    const mInner = new THREE.MeshStandardMaterial({ map: innerTex, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    const mBrz = new THREE.MeshStandardMaterial({ map: brzTex, bumpMap: brzTex, bumpScale: 0.8, roughness: 0.55, metalness: 0.4 });
    const mBrzDS = mBrz.clone(); mBrzDS.side = THREE.DoubleSide;
    const mIron = new THREE.MeshStandardMaterial({ color: 0x34302a, roughness: 0.6, metalness: 0.5 });
    const add = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); (parent || body).add(m); return m; };

    // 外板(よろい張り)
    const KC = 64, cq = j => -Math.cos(Math.PI * j / KC);
    const rowDef = [[0, 0.3], [0, 1.0], [0.12, 0.95], [0.55, 0.6], [1, 0.3]];
    const outEx = (x, y, z) => [x, y - (gy(z / HL) + 20), 0];
    const hb = new Builder();
    for (const sx of [1, -1]) {
      hb.grid(NPL * 5 - 1, KC, (i, j) => {
        const k = Math.floor(i / 5), rw = rowDef[i % 5], q = cq(j);
        const v = VB[k] + rw[0] * (VB[k + 1] - VB[k]), p = secPt(q, v, rw[1] * LAP, sx);
        const u = (p[2] + 450) / 900;
        return [p[0], p[1], p[2], sx > 0 ? u : 1 - u, 1 - (k + rw[0]) / NPL];
      }, outEx);
    }
    add(hb.geometry(), mHull);

    // 内側の殻
    const ib = new Builder();
    ib.grid(32, KC, (i, j) => {
      const s = -1 + 2 * i / 32, q = cq(j), p = secPt(q, Math.abs(s), -WALL, s < 0 ? -1 : 1);
      return [p[0], p[1], p[2], p[2] / 130, s * 0.5 + 0.5];
    }, (x, y, z) => { const e = outEx(x, y, z); return [-e[0], -e[1], 0]; });
    add(ib.geometry(), mInner);

    // 肋材(内側のあばら)11 本
    for (let n = 0; n < 11; n++) {
      const z0 = -360 + n * 72, rb = new Builder(), inEx = (x, y, z) => { const e = outEx(x, y, z); return [-e[0], -e[1], 0]; };
      const sg = i => { const s = -1 + 2 * i / 32; return [Math.abs(s), s < 0 ? -1 : 1]; };
      rb.grid(32, 1, (i, j) => { const [v, sx] = sg(i), p = secPt((z0 + (j ? 4.5 : -4.5)) / HL, v, -WALL - 7, sx); return [p[0], p[1], p[2], p[2] / 40, i / 32]; }, inEx);
      for (const sz of [-1, 1]) {
        rb.grid(32, 1, (i, j) => { const [v, sx] = sg(i), p = secPt((z0 + sz * 4.5) / HL, v, -WALL - 7 * j, sx); return [p[0], p[1], p[2], j, i / 32]; }, () => [0, 0, sz]);
      }
      add(rb.geometry(), mTrim);
    }

    // 竜骨(背骨のように上を通る)
    const kb = new Builder(), kz = []; for (let i = 0; i <= 56; i++) kz.push(-438 + 876 * i / 56);
    kb.sweep(kz, z => { const q = clamp(z / HL, -1, 1), yk = gy(q) + depth(q);
      return [[-10, yk - 10], [10, yk - 10], [10, yk + 5], [6, yk + 11], [-6, yk + 11], [-10, yk + 5]]; }, 90);
    add(kb.geometry(), mTrim);

    // 舷縁の縁材(ガンネル)
    const rz = []; for (let i = 0; i <= 48; i++) rz.push(-412 + 824 * i / 48);
    const gb = new Builder();
    for (const sx of [1, -1]) gb.sweep(rz, z => { const q = z / HL, hw = halfW(q), yg = gy(q);
      return [[sx * (hw - 14), yg], [sx * (hw + 3), yg], [sx * (hw + 3), yg + 14], [sx * (hw - 14), yg + 14]]; }, 90);
    add(gb.geometry(), mTrim);

    // ブロンズの梁(ストリンガー)
    const sz = []; for (let i = 0; i <= 48; i++) sz.push(-408 + 816 * i / 48);
    const sb = new Builder();
    for (const sx of [1, -1]) sb.sweep(sz, z => { const q = z / HL, hw = halfW(q), yg = gy(q);
      return [[sx * (hw - 2), yg - 24], [sx * (hw + 30), yg - 24], [sx * (hw + 30), yg + 2], [sx * (hw - 2), yg + 2]]; }, 110);
    add(sb.geometry(), mBrz);

    // 舳先・艫の柱(渦巻き)
    function post(sgn, cz, cy, R0, th0, turns, rEnd, r0, r1) {
      const pts = [new THREE.Vector3(0, 421, sgn * 420)];
      for (let k = 0; k <= 26; k++) {
        const t = k / 26, th = th0 - turns * t, r = R0 * (1 - t) + rEnd * t;
        pts.push(new THREE.Vector3(0, cy + r * Math.sin(th), sgn * (cz + r * Math.cos(th))));
      }
      const curve = new THREE.CatmullRomCurve3(pts), TS = 90, RS = 12;
      const geo = new THREE.TubeGeometry(curve, TS, 1, RS, false);
      const pos = geo.attributes.position;
      for (let i = 0; i <= TS; i++) {
        const c = curve.getPointAt(i / TS), rr = r0 + (r1 - r0) * Math.pow(i / TS, 0.8);
        for (let j = 0; j <= RS; j++) {
          const id = i * (RS + 1) + j;
          pos.setXYZ(id, c.x + (pos.getX(id) - c.x) * rr, c.y + (pos.getY(id) - c.y) * rr, c.z + (pos.getZ(id) - c.z) * rr);
        }
      }
      geo.computeVertexNormals(); return add(geo, mTrim);
    }
    post(1, 438, 400, 28, 1.95, 6.9, 5, 11, 5);       // 舳先: 大きく巻く
    post(-1, 436, 403, 25, 2.0, 4.4, 9, 10, 5.5);     // 艫: ゆるい巻き

    // 横木(スウォート)3 枚
    [-170, 40, 250].forEach(z => {
      const q = z / HL, w = 2 * (halfW(q) - 12), m = add(new THREE.BoxGeometry(w, 8, 26), mTrim);
      m.position.set(0, gy(q) + 24, z);
    });

    // 外板の鋲(よろいの重なり線に沿って)
    const rivets = [];
    for (const sx of [1, -1]) for (let k = 1; k < NPL; k++) for (let z = -392; z <= 392; z += 20) {
      const q = z / HL; if (halfW(q) < 34) continue;
      const v = VB[k] + 0.17 * (VB[k + 1] - VB[k]); rivets.push(secPt(q, v, LAP * 0.9 + 0.9, sx));
    }
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1.7, 8, 5), mIron, rivets.length);
    const dm = new THREE.Object3D(); inst.frustumCulled = false;
    rivets.forEach((p, i) => { dm.position.set(p[0], p[1], p[2]); dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix); });
    body.add(inst);

    // 脚
    const legs = [];
    let li = 0;
    for (const sx of [1, -1]) LEG_Z.forEach(z => {
      const q = z / HL, hw = halfW(q), yg = gy(q);
      const hip = new THREE.Object3D(); hip.position.set(sx * (hw + 22), yg - 11, z); body.add(hip);
      const femur = new THREE.Object3D(); hip.add(femur);
      const knee = new THREE.Object3D(); knee.position.set(0, 0, L1); femur.add(knee);
      femur.add(bone(L1, 12, 6, mBrz, 1, li));
      knee.add(bone(L2, 6, 2, mBrz, 2, li));
      add(bossGeo(), mBrzDS, femur);
      add(new THREE.SphereGeometry(9.5, 18, 12), mBrz, knee);
      const f = add(footGeo(), mBrzDS, knee);
      // 肘板(三角の補強)を脚の両側に
      for (const dz of [-15, 15]) {
        const sh = new THREE.Shape();
        sh.moveTo(sx * (hw + 3), yg + 2); sh.lineTo(sx * (hw + 34), yg + 2); sh.lineTo(sx * (hw - 13), yg + 42); sh.closePath();
        const hole = new THREE.Path(); hole.absarc(sx * (hw + 7), yg + 14, 5, 0, Math.PI * 2, true); sh.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 6, bevelEnabled: false, curveSegments: 12 });
        geo.translate(0, 0, -3); const m = add(geo, mBrzDS); m.position.z = z + dz;
      }
      legs.push({ hip, femur, knee, L1, L2, foot: new THREE.Vector3(sx * FOOT_X, 0, z) });
      li++;
    });
    g.userData.legs = legs;
    g.updateMatrixWorld(true);
    legs.forEach(l => solveLeg(l, l.foot));
    g.updateMatrixWorld(true);

    g.userData.info = { name: 'sculpt_b 伏せた舟', length: 900, beam: 260, depth: D0, gunwale: GY0, legs: 12, L1, L2 };
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };
})();
