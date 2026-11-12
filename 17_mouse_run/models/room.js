// room.js — リビングの部屋そのもの(床・壁・天井・窓・ドア)。ワールド座標そのまま。1 = 1cm。
window.MODELS = window.MODELS || {};
window.MODELS.room = function () {
  const V3 = THREE.Vector3;
  const g = new THREE.Group();
  const colliders = [];

  // ---------- 乱数・ノイズ ----------
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function pnoise(seed) { // 周期つき value noise(ハッシュ式)
    const S = Math.imul(seed, 0x9E3779B1);
    const H = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + S) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    return (x, y, px, py) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
      const a = H(x0, y0), b = H(x1, y0), c = H(x0, y1), d = H(x1, y1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  function fbm(n, x, y, px, py, oct) {
    let s = 0, a = 0.5, f = 1, nm = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f, px * f, py * f); nm += a; a *= 0.5; f *= 2; }
    return s / nm;
  }
  function ctex(w, h, fn, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (rep) t.repeat.set(rep[0], rep[1]);
    return t;
  }
  function pix(ctx, w, h, f) { // f(i,j) -> [r,g,b,(a)]
    const im = ctx.createImageData(w, h), d = im.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const c = f(i, j), k = (j * w + i) * 4;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = c.length > 3 ? c[3] : 255;
    }
    ctx.putImageData(im, 0, 0);
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------- ジオメトリ補助 ----------
  function nonIdx(geo) { return geo.index ? geo.toNonIndexed() : geo; }
  function merge(list) {
    const out = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const arrs = list.map(x => nonIdx(x).getAttribute(name));
      const size = arrs[0].itemSize;
      let n = 0; arrs.forEach(a => n += a.array.length);
      const buf = new Float32Array(n); let o = 0;
      arrs.forEach(a => { buf.set(a.array, o); o += a.array.length; });
      out.setAttribute(name, new THREE.BufferAttribute(buf, size));
    }
    return out;
  }
  function boxG(x0, y0, z0, x1, y1, z1) {
    return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed().translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }
  function mk(geo, mat, cast = true, recv = true) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; g.add(m); return m;
  }
  // 凸な断面 prof [[d,h],..] を、o から t 方向に L だけ掃引。n = 壁から室内向き
  function sweep(prof, o, t, n, L) {
    const up = new V3(0, 1, 0);
    const P = (s, d, h) => o.clone().addScaledVector(t, s).addScaledVector(n, d).addScaledVector(up, h);
    let ad = 0, ah = 0; prof.forEach(p => { ad += p[0]; ah += p[1]; }); ad /= prof.length; ah /= prof.length;
    const cen = P(L / 2, ad, ah);
    const pos = [], uv = [];
    const tri = (a, b, c, ua, ub, uc) => {
      const nr = b.clone().sub(a).cross(c.clone().sub(a));
      const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      if (nr.dot(mid.sub(cen)) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; }
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); uv.push(...ua, ...ub, ...uc);
    };
    let acc = 0;
    for (let i = 0; i < prof.length; i++) {
      const a = prof[i], b = prof[(i + 1) % prof.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const A = P(0, a[0], a[1]), B = P(L, a[0], a[1]), C = P(L, b[0], b[1]), D = P(0, b[0], b[1]);
      const v0 = acc / 10, v1 = (acc + len) / 10; acc += len;
      tri(A, B, C, [0, v0], [L / 10, v0], [L / 10, v1]); tri(A, C, D, [0, v0], [L / 10, v1], [0, v1]);
    }
    for (const s of [0, L]) for (let i = 1; i < prof.length - 1; i++) {
      const a = prof[0], b = prof[i], c = prof[i + 1];
      tri(P(s, a[0], a[1]), P(s, b[0], b[1]), P(s, c[0], c[1]), [a[0] / 10, a[1] / 10], [b[0] / 10, b[1] / 10], [c[0] / 10, c[1] / 10]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }
  // 穴付き板。mats = [z=0 側の面, z=depth 側の面, 側面(断面)]
  function slab(outline, holes, depth, mats, matrix) {
    const sh = new THREE.Shape(outline.map(p => new THREE.Vector2(p[0], p[1])));
    for (const h of holes) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 });
    const lid = geo.groups[0], side = geo.groups[1];
    geo.clearGroups(); const half = lid.count / 2;
    geo.addGroup(lid.start, half, 0); geo.addGroup(lid.start + half, half, 1); geo.addGroup(side.start, side.count, 2);
    geo.applyMatrix4(matrix);
    return mk(geo, mats);
  }
  const rotY = (a, x, y, z) => new THREE.Matrix4().makeRotationY(a).setPosition(x, y, z);

  // =====================================================================
  // テクスチャ
  // =====================================================================
  // --- フローリング: 160cm(u) × 120cm(v) に幅15cmの帯が8本。帯ごとに色・木目・つやが違う ---
  const FW = 1024, FH = 1024, STRIPS = 8, SPX = FH / STRIPS;
  const nW = pnoise(11), nP = pnoise(12), nB = pnoise(13);
  const R = rng(7);
  const strip = [];
  for (let s = 0; s < STRIPS; s++) {
    const k = 0.86 + R() * 0.24, warm = R();
    strip.push({
      base: [168 * k + warm * 10, 130 * k + warm * 4, 92 * k - warm * 6],
      dark: [118 * k, 82 * k, 52 * k],
      rings: 7 + R() * 9, phase: R() * 10, warp: 1.5 + R() * 2.5,
      rough: 0.42 + R() * 0.3,
    });
  }
  const knots = [];
  for (let i = 0; i < 6; i++) knots.push({ x: R() * FW, y: (Math.floor(R() * STRIPS) + 0.3 + R() * 0.4) * SPX, rx: 18 + R() * 20, ry: 7 + R() * 6 });
  const woodF = new Float32Array(FW * FH), poreF = new Float32Array(FW * FH);
  for (let j = 0; j < FH; j++) {
    const s = Math.floor(j / SPX), st = strip[s], vl = (j % SPX) / SPX;
    for (let i = 0; i < FW; i++) {
      const x = i / FW;
      let t = vl * st.rings + st.phase + fbm(nW, x * 6, j / FH * 24, 6, 24, 4) * st.warp + fbm(nW, x * 2 + 9, j / FH * 6, 2, 6, 2) * 1.2;
      let kn = 0;
      for (const k of knots) {
        if (Math.floor(k.y / SPX) !== s) continue;
        let dx = i - k.x; if (dx > FW / 2) dx -= FW; if (dx < -FW / 2) dx += FW;
        const dy = j - k.y, e = (dx * dx) / (k.rx * k.rx * 4) + (dy * dy) / (k.ry * k.ry * 4);
        t += 2.2 * Math.exp(-e * 0.6); kn = Math.max(kn, Math.exp(-e * 6));
      }
      const ring = Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI * 2), 8);
      const pore = nP(x * 180, j * 0.8, 180, 100000);
      woodF[j * FW + i] = clamp(ring * 0.6 + kn * 0.9, 0, 1);
      poreF[j * FW + i] = pore;
    }
  }
  const floorMap = ctex(FW, FH, (c, w, h) => {
    pix(c, w, h, (i, j) => {
      const st = strip[Math.floor(j / SPX)], k = j * FW + i;
      const big = fbm(nB, i / FW * 3, j / FH * 12, 3, 12, 3);
      const m = clamp(woodF[k] * 0.75 + poreF[k] * 0.18 + (big - 0.5) * 0.25, 0, 1);
      return [0, 1, 2].map(q => st.base[q] + (st.dark[q] - st.base[q]) * m);
    });
    const r = rng(21);
    for (let i = 0; i < 260; i++) { // 細かい傷(明るい)
      const x = r() * w, y = r() * h, a = (r() - 0.5) * (r() < 0.8 ? 0.4 : 3), l = 6 + r() * 40;
      c.strokeStyle = `rgba(232,200,160,${0.12 + r() * 0.2})`; c.lineWidth = 0.5 + r() * 0.8;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    for (let i = 0; i < 70; i++) { // 打痕・汚れ
      c.fillStyle = `rgba(60,36,18,${0.08 + r() * 0.15})`;
      c.beginPath(); c.arc(r() * w, r() * h, 0.6 + r() * 1.6, 0, 7); c.fill();
    }
  });
  const floorRough = ctex(FW, FH, (c, w, h) => {
    pix(c, w, h, (i, j) => {
      const st = strip[Math.floor(j / SPX)], k = j * FW + i;
      const v = clamp(st.rough + woodF[k] * 0.12 + poreF[k] * 0.1 + (fbm(nB, i / FW * 5 + 3, j / FH * 5, 5, 5, 3) - 0.5) * 0.15, 0, 1) * 255;
      return [v, v, v];
    });
    const r = rng(21); // 傷は同じ位置をつや消しに
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, a = (r() - 0.5) * (r() < 0.8 ? 0.4 : 3), l = 6 + r() * 40;
      c.strokeStyle = `rgba(255,255,255,${0.3 + r() * 0.3})`; c.lineWidth = 0.5 + r() * 0.8; r();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
  });
  const floorBump = ctex(FW, FH, (c, w, h) => {
    pix(c, w, h, (i, j) => { const k = j * FW + i, v = 150 - woodF[k] * 40 - poreF[k] * 60; return [v, v, v]; });
    const r = rng(21);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, a = (r() - 0.5) * (r() < 0.8 ? 0.4 : 3), l = 6 + r() * 40;
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.5 + r() * 0.8; r();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
  });
  // 床全体(ワールド座標・uv2)の大きなムラ → aoMap として 2枚目を重ねる
  const floorAO = ctex(512, 512, (c, w, h) => {
    const n = pnoise(31);
    pix(c, w, h, (i, j) => { const v = 200 + 55 * fbm(n, i / w * 7, j / h * 6, 7, 6, 4); return [v, v, v]; });
  });

  // --- 壁紙: 92cm × 46cm。細かい凹凸、u=0 に継ぎ目 ---
  const nWP = pnoise(41);
  const wpField = new Float32Array(1024 * 512);
  for (let j = 0; j < 512; j++) for (let i = 0; i < 1024; i++)
    wpField[j * 1024 + i] = fbm(nWP, i / 1024 * 160, j / 512 * 80, 160, 80, 3) * 0.7 + fbm(nWP, i / 1024 * 22 + 5, j / 512 * 11, 22, 11, 2) * 0.3;
  const wpMap = ctex(1024, 512, (c, w, h) => {
    pix(c, w, h, (i, j) => {
      const f = wpField[j * w + i], v = (f - 0.5) * 16;
      const seam = (i < 2 || i > w - 2) ? -10 : (i < 4 || i > w - 4) ? 5 : 0;
      return [236 + v + seam, 231 + v + seam, 221 + v + seam];
    });
  }, [1 / 92, 1 / 46]);
  const wpBump = ctex(1024, 512, (c, w, h) => {
    pix(c, w, h, (i, j) => { const v = wpField[j * w + i] * 255; const s = (i < 2 || i > w - 2) ? -60 : 0; return [v + s, v + s, v + s]; });
  }, [1 / 92, 1 / 46]);

  // --- 石膏ボード裏: 91cm角。灰色がかった紙・印字・ビスの頭・継ぎ目 ---
  const gbMap = ctex(1024, 1024, (c, w, h) => {
    const n = pnoise(51);
    pix(c, w, h, (i, j) => { const v = (fbm(n, i / w * 90, j / h * 90, 90, 90, 2) - 0.5) * 18 + (fbm(n, i / w * 4, j / h * 4, 4, 4, 3) - 0.5) * 14; return [178 + v, 176 + v, 168 + v]; });
    c.fillStyle = 'rgba(70,70,64,0.5)'; c.fillRect(0, 0, 3, h); // 突き付けの継ぎ目
    c.fillStyle = 'rgba(40,60,110,0.55)'; c.font = 'bold 22px sans-serif';
    for (const y of [180, 520, 860]) {
      c.save(); c.translate(80, y);
      c.fillText('せっこうボード  JIS A 6901  GB-R  12.5mm × 910 × 1820', 0, 0);
      c.font = '16px sans-serif'; c.fillText('不燃材料 NM-8619   ロット 26-1104-B   この面を裏面とする', 0, 26);
      c.restore(); c.font = 'bold 22px sans-serif';
    }
    c.strokeStyle = 'rgba(40,60,110,0.35)'; c.lineWidth = 2;
    for (let y = 60; y < h; y += 120) { c.beginPath(); c.moveTo(w / 2 - 14, y); c.lineTo(w / 2 + 14, y); c.stroke(); } // 墨出しの目印
    const px = w / 91;
    for (const u of [1.6, 45.5, 89.4]) for (const v of [8, 38, 68]) { // ビスの頭
      const x = u * px, y = v * px + (u === 45.5 ? 15 * px : 0);
      const gr = c.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5.5);
      gr.addColorStop(0, '#d8d8d4'); gr.addColorStop(0.6, '#8a8a86'); gr.addColorStop(1, '#4a4a46');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fill();
      c.strokeStyle = '#3a3a36'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(x - 3.2, y); c.lineTo(x + 3.2, y); c.moveTo(x, y - 3.2); c.lineTo(x, y + 3.2); c.stroke();
      c.strokeStyle = 'rgba(80,76,66,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 7, 0, 7); c.stroke(); // めり込みの輪
    }
  }, [1 / 91, 1 / 91]);
  const gbBump = ctex(256, 256, (c, w, h) => {
    const n = pnoise(52);
    pix(c, w, h, (i, j) => { const v = fbm(n, i / w * 40, j / h * 40, 40, 40, 2) * 255; return [v, v, v]; });
  }, [1 / 20, 1 / 20]);
  // 石膏の芯(断面)
  const coreMap = ctex(256, 256, (c, w, h) => {
    const r = rng(61);
    pix(c, w, h, () => { const v = 222 + (r() - 0.5) * 30; return [v, v - 2, v - 8]; });
  }, [1 / 6, 1 / 6]);

  // --- コンセント・スイッチ ---
  function plateBase(c, w, h) {
    c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.06, 'rgba(0,0,0,0)'); gr.addColorStop(0.94, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2; c.strokeRect(10, 14, w - 20, h - 28);
  }
  const outletMap = ctex(128, 256, (c, w, h) => {
    plateBase(c, w, h);
    for (const cy of [92, 164]) {
      c.fillStyle = '#e8e4da'; c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect ? c.roundRect(30, cy - 26, 68, 52, 8) : c.rect(30, cy - 26, 68, 52); c.fill(); c.stroke();
      c.fillStyle = '#1c1a18'; c.fillRect(44, cy - 13, 7, 22); c.fillRect(77, cy - 13, 7, 26);
      c.fillStyle = '#1c1a18'; c.beginPath(); c.arc(64, cy + 16, 4, 0, Math.PI); c.fill();
    }
  });
  const switchMap = ctex(128, 256, (c, w, h) => {
    plateBase(c, w, h);
    c.fillStyle = '#fbf9f4'; c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
    c.fillRect(30, 60, 68, 136); c.strokeRect(30, 60, 68, 136);
    const gr = c.createLinearGradient(0, 60, 0, 196); gr.addColorStop(0, 'rgba(0,0,0,0.0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.fillStyle = gr; c.fillRect(31, 128, 66, 67);
    c.fillStyle = '#7fbf6a'; c.fillRect(60, 74, 8, 4);
  });

  // --- ドア(明るい木目+框・鏡板の溝) ---
  const doorMap = ctex(512, 1024, (c, w, h) => {
    const n = pnoise(71);
    pix(c, w, h, (i, j) => {
      const t = i / w * 40 + fbm(n, i / w * 4, j / h * 6, 4, 6, 3) * 1.2 + fbm(n, i / w * 40, j / h * 2, 40, 2, 2) * 0.4;
      const r = Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI * 2), 6);
      const p = fbm(n, i / w * 200 + 7, j / h * 8, 200, 8, 1);
      return [222 - r * 22 - p * 10, 198 - r * 22 - p * 10, 164 - r * 20 - p * 8];
    });
    const groove = (x, y, ww, hh) => {
      c.strokeStyle = 'rgba(70,45,20,0.55)'; c.lineWidth = 5; c.strokeRect(x, y, ww, hh);
      c.strokeStyle = 'rgba(255,240,215,0.35)'; c.lineWidth = 2; c.strokeRect(x + 4, y + 4, ww - 8, hh - 8);
    };
    groove(70, 80, w - 140, 380); groove(70, 540, w - 140, 400);
  });
  const doorBump = ctex(512, 1024, (c, w, h) => {
    c.fillStyle = '#888'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#000'; c.lineWidth = 6; c.strokeRect(70, 80, w - 140, 380); c.strokeRect(70, 540, w - 140, 400);
  });
  const frameWood = ctex(256, 256, (c, w, h) => {
    const n = pnoise(72);
    pix(c, w, h, (i, j) => {
      const t = j / h * 14 + fbm(n, i / w * 8, j / h * 3, 8, 3, 3) * 2.5;
      const r = Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI * 2), 4);
      return [208 - r * 28, 182 - r * 28, 146 - r * 26];
    });
  });

  // --- カーテン生地 ---
  const curtainMap = ctex(256, 256, (c, w, h) => {
    const n = pnoise(81);
    pix(c, w, h, (i, j) => {
      const weave = ((i % 4 < 2) !== (j % 4 < 2)) ? 6 : -6;
      const v = (fbm(n, i / w * 8, j / h * 64, 8, 64, 2) - 0.5) * 18 + weave;
      return [206 + v, 199 + v, 182 + v];
    });
  }, [1 / 12, 1 / 12]);
  const skyMap = ctex(16, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#9fcdf2'); gr.addColorStop(0.75, '#d7ecfa'); gr.addColorStop(1, '#eef6fb');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const gradTex = ctex(4, 64, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.5, '#555'); gr.addColorStop(1, '#fff');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  gradTex.wrapS = gradTex.wrapT = THREE.ClampToEdgeWrapping;

  // =====================================================================
  // マテリアル
  // =====================================================================
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: floorMap, roughnessMap: floorRough, bumpMap: floorBump, bumpScale: 0.006, aoMap: floorAO, aoMapIntensity: 1, vertexColors: true, roughness: 1, metalness: 0 }),
    underlay: new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({ map: wpMap, bumpMap: wpBump, bumpScale: 0.02, roughness: 0.92 }),
    gbBack: new THREE.MeshStandardMaterial({ map: gbMap, bumpMap: gbBump, bumpScale: 0.02, roughness: 0.95 }),
    core: new THREE.MeshStandardMaterial({ map: coreMap, roughness: 1 }),
    outside: new THREE.MeshStandardMaterial({ color: 0xbab5ab, roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.45 }),
    paperFace: new THREE.MeshStandardMaterial({ color: 0xd9cfb8, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    peel: new THREE.MeshStandardMaterial({ color: 0xe2dccf, roughness: 0.95, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.4, metalness: 0.25 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xe4f2f7, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false }),
    sky: new THREE.MeshBasicMaterial({ map: skyMap }),
    curtain: new THREE.MeshStandardMaterial({ map: curtainMap, roughness: 0.95, side: THREE.DoubleSide }),
    door: new THREE.MeshStandardMaterial({ map: doorMap, bumpMap: doorBump, bumpScale: 0.04, roughness: 0.6 }),
    frame: new THREE.MeshStandardMaterial({ map: frameWood, roughness: 0.55 }),
    hall: new THREE.MeshBasicMaterial({ color: 0x2c2724 }),
    ceiling: new THREE.MeshStandardMaterial({ roughness: 0.95, color: 0xf6f3ec, emissive: 0x3a3631 }), // 反射光の代わりにわずかに持ち上げる
    lampBase: new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.6 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dd, emissiveIntensity: 1, roughness: 0.4 }),
    outlet: new THREE.MeshStandardMaterial({ map: outletMap, roughness: 0.4 }),
    switch: new THREE.MeshStandardMaterial({ map: switchMap, roughness: 0.4 }),
    screw: new THREE.MeshStandardMaterial({ color: 0xc8c6c0, roughness: 0.3, metalness: 0.8 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, alphaMap: gradTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  };
  // 空洞側から見ると左右が逆になる面用(印字が鏡文字にならないように)
  const gbMapM = gbMap.clone(); gbMapM.needsUpdate = true; gbMapM.repeat.set(-1 / 91, 1 / 91);
  M.gbBackM = new THREE.MeshStandardMaterial({ map: gbMapM, bumpMap: gbBump, bumpScale: 0.02, roughness: 0.95 });
  const ceilTex = wpMap.clone(); ceilTex.needsUpdate = true; ceilTex.repeat.set(623.4 / 92, 523.4 / 46);
  M.ceiling.map = ceilTex;

  // =====================================================================
  // 床(フローリング 1メッシュ)
  // =====================================================================
  {
    const X0 = -301.2, X1 = 312, Z0 = -251.2, Z1 = 262, W = 15, E = 0.12, D = 0.08;
    const pos = [], nor = [], uv = [], uv2 = [], col = [];
    const r = rng(101);
    for (let za = Z0; za < Z1 - 0.01; za += W) {
      const zb = Math.min(za + W, Z1);
      let xa = X0, first = true;
      while (xa < X1 - 0.01) {
        const len = first ? 20 + r() * 160 : 60 + r() * 120; first = false;
        const xb = Math.min(xa + len, X1);
        const s = Math.floor(r() * STRIPS), uOff = r(), flip = r() < 0.5 ? -1 : 1, k = 0.88 + r() * 0.2;
        const tint = [k * (0.98 + r() * 0.04), k, k * (0.94 + r() * 0.08)];
        const m = 3 / FH, vLo = 1 - (s + 1) / STRIPS + m, vHi = 1 - s / STRIPS - m;
        const vtx = (x, y, z) => {
          pos.push(x, y, z);
          uv.push(uOff + flip * (x - xa) / 160, vLo + (z - za) / W * (vHi - vLo));
          uv2.push((x - X0) / (X1 - X0), (z - Z0) / (Z1 - Z0));
          col.push(...tint);
        };
        const quad = (a, b, c, d) => {
          const A = new V3(...a), B = new V3(...b), C = new V3(...c);
          let n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
          let q = [a, b, c, d];
          if (n.y < 0) { q = [a, d, c, b]; n.negate(); }
          for (const t of [q[0], q[1], q[2], q[0], q[2], q[3]]) { vtx(...t); nor.push(n.x, n.y, n.z); }
        };
        const ix0 = xa + E, ix1 = xb - E, iz0 = za + E, iz1 = zb - E;
        quad([ix0, 0, iz0], [ix1, 0, iz0], [ix1, 0, iz1], [ix0, 0, iz1]);
        quad([xa, -D, za], [xb, -D, za], [ix1, 0, iz0], [ix0, 0, iz0]);
        quad([ix0, 0, iz1], [ix1, 0, iz1], [xb, -D, zb], [xa, -D, zb]);
        quad([xa, -D, za], [ix0, 0, iz0], [ix0, 0, iz1], [xa, -D, zb]);
        quad([ix1, 0, iz0], [xb, -D, za], [xb, -D, zb], [ix1, 0, iz1]);
        xa = xb;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uv2, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    mk(geo, M.floor, false, true);
    const ul = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0).rotateX(-Math.PI / 2).translate((X0 + X1) / 2, -0.3, (Z0 + Z1) / 2);
    mk(ul, M.underlay, false, true);
    colliders.push([-311.4, -2, -261.4, 312, 0, 262]);
  }

  // =====================================================================
  // ネズミ穴の輪郭(穴の中心下端を原点、u = 壁沿い、y = 上)
  // =====================================================================
  function holeProfile(seed, extraMin, extraMax) {
    const r = rng(seed), pts = [];
    // 低周波のギザギザ
    const jag = () => extraMin + r() * (extraMax - extraMin);
    const side = [0, 1.2, 2.4];
    side.forEach(y => pts.push([-4.5 - jag(), y]));
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI - Math.PI * i / N, rr = 4.5 + jag();
      pts.push([Math.cos(a) * rr, 3.5 + Math.sin(a) * rr]);
    }
    side.slice().reverse().forEach(y => pts.push([4.5 + jag(), y]));
    return pts;
  }
  const holes = [
    { c: new V3(150, 0, -250), u: new V3(1, 0, 0), w: new V3(0, 0, 1), seed: 201 },   // 奥の壁
    { c: new V3(-300, 0, 120), u: new V3(0, 0, -1), w: new V3(1, 0, 0), seed: 301 },  // 左の壁
  ];
  holes.forEach(h => {
    h.inner = holeProfile(h.seed, 0, 0.55);
    h.outer = holeProfile(h.seed + 50, 0.7, 2.2);
    h.mat = new THREE.Matrix4().makeBasis(h.u, new V3(0, 1, 0), h.w).setPosition(h.c);
  });

  // =====================================================================
  // 壁
  // =====================================================================
  const notch = (h, off) => h.inner.map(p => [p[0] + off, p[1]]);
  // 奥・室内側ボード z∈[-251.2,-250]
  slab([[-301.2, 0], ...notch(holes[0], 150), [300, 0], [300, 240], [-301.2, 240]], [], 1.2,
    [M.gbBackM, M.wall, M.core], rotY(0, 0, 0, -251.2));
  // 奥・外側ボード z∈[-261.4,-260.2]
  slab([[-311.4, 0], [300, 0], [300, 240], [-311.4, 240]], [], 1.2, [M.outside, M.gbBack, M.core], rotY(0, 0, 0, -261.4));
  // 左・室内側ボード x∈[-301.2,-300](ローカル x = -world z)
  slab([[-250, 0], ...notch(holes[1], -120), [250, 0], [250, 240], [-250, 240]], [], 1.2,
    [M.gbBackM, M.wall, M.core], rotY(Math.PI / 2, -301.2, 0, 0));
  // 左・外側ボード x∈[-311.4,-310.2]
  slab([[-250, 0], [260.2, 0], [260.2, 240], [-250, 240]], [], 1.2, [M.outside, M.gbBack, M.core], rotY(Math.PI / 2, -311.4, 0, 0));
  // 右の壁 x∈[300,312] 窓あき(ローカル x = world z)
  slab([[-261.4, 0], [262, 0], [262, 240], [-261.4, 240]], [[[-120, 80], [40, 80], [40, 210], [-120, 210]]], 12,
    [M.outside, M.wall, M.wall], rotY(-Math.PI / 2, 312, 0, 0));
  // 手前の壁 z∈[250,262] ドアあき(ローカル x = -world x)
  slab([[-300, 0], [-265, 0], [-265, 205], [-180, 205], [-180, 0], [311.4, 0], [311.4, 240], [-300, 240]], [], 12,
    [M.outside, M.wall, M.wall], rotY(Math.PI, 0, 0, 262));

  colliders.push(
    // 奥・室内側ボード(穴の部分をあける)
    [-301.2, 0, -251.2, 145.5, 240, -250], [154.5, 0, -251.2, 300, 240, -250], [145.5, 8, -251.2, 154.5, 240, -250],
    [-311.4, 0, -261.4, 300, 240, -260.2],
    // 左・室内側ボード
    [-301.2, 0, -250, -300, 240, 115.5], [-301.2, 0, 124.5, -300, 240, 250], [-301.2, 8, 115.5, -300, 240, 124.5],
    [-311.4, 0, -260.2, -310.2, 240, 250],
    // 右の壁(窓の開口を除く)
    [300, 0, -261.4, 312, 80, 262], [300, 210, -261.4, 312, 240, 262], [300, 80, -261.4, 312, 210, -120], [300, 80, 40, 312, 210, 262],
    // 手前の壁(ドアの開口を除く)
    [-311.4, 0, 250, 180, 240, 262], [265, 0, 250, 300, 240, 262], [180, 205, 250, 265, 240, 262],
    // 天井
    [-311.4, 240, -261.4, 312, 242, 262],
  );

  // --- 穴まわり: 壁紙がはがれて石膏ボードの表紙が見える帯 + めくれた壁紙 ---
  {
    const bands = [], flaps = [];
    holes.forEach(h => {
      const outline = [...h.outer, ...h.inner.slice().reverse()];
      const sg = new THREE.ShapeGeometry(new THREE.Shape(outline.map(p => new THREE.Vector2(p[0], p[1]))));
      sg.translate(0, 0, 0.03).applyMatrix4(h.mat);
      bands.push(sg);
      const r = rng(h.seed + 7);
      for (const a of [2.6, 1.7, 0.9, 0.35]) { // めくれ(アーチ上の角度)
        const wid = 1.0 + r() * 0.9, len = 1.4 + r() * 1.4, curl = 0.5 + r() * 0.6;
        const rr0 = 4.5 + 1.0 + r() * 0.5, dir = new V3(Math.cos(a), Math.sin(a), 0), tan = new V3(-Math.sin(a), Math.cos(a), 0);
        const base = new V3(0, 3.5, 0).addScaledVector(dir, rr0);
        const pos = [], uvs = [], NS = 6;
        for (let i = 0; i < NS; i++) {
          const t0 = i / NS, t1 = (i + 1) / NS;
          const P = (t, side) => {
            const ang = t * Math.PI * 0.9 * curl;
            // 壁から剥がれ、穴の方へ折り返すように反る
            // 根元は壁紙側(帯の外周)、先は穴の方へ向かいながら壁から浮く
            const p = base.clone().addScaledVector(dir, -t * len * 0.85);
            p.z = 0.06 + t * t * len * 0.7 * curl;
            const wnar = wid * (1 - t * 0.55);
            return p.addScaledVector(tan, side * wnar / 2 + (r() - 0.5) * 0.08);
          };
          const a0 = P(t0, -1), b0 = P(t0, 1), a1 = P(t1, -1), b1 = P(t1, 1);
          pos.push(...a0.toArray(), ...b0.toArray(), ...b1.toArray(), ...a0.toArray(), ...b1.toArray(), ...a1.toArray());
          for (let q = 0; q < 6; q++) uvs.push(r() * 3, r() * 3);
        }
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        fg.computeVertexNormals(); fg.applyMatrix4(h.mat);
        flaps.push(fg);
      }
    });
    mk(merge(bands), M.paperFace, false, true);
    mk(merge(flaps), M.peel, true, true);
  }

  // =====================================================================
  // 巾木・廻り縁・窓まわり・ドア枠(白い造作は 1メッシュ)
  // =====================================================================
  const trimG = [], frameG = [], metalG = [];
  const BB = [[0, 0.12], [0.95, 0.12], [1.2, 0.4], [1.2, 5.3], [0.75, 6.0], [0, 6.0]];
  const CR = [[0, -7], [0.6, -7], [1.3, -5], [3.0, -1.4], [3.6, 0], [0, 0]];
  const X = new V3(1, 0, 0), Z = new V3(0, 0, 1), nX = new V3(-1, 0, 0), nZ = new V3(0, 0, -1);
  const bbRuns = [
    // [始点, 方向, 室内向き, 長さ]
    [new V3(-300, 0, -250), X, Z, 145.5 - -300], [new V3(154.5, 0, -250), X, Z, 300 - 154.5],
    [new V3(-300, 0, -250), Z, X, 115.5 - -250], [new V3(-300, 0, 124.5), Z, X, 250 - 124.5],
    [new V3(300, 0, -250), Z, nX, 500],
    [new V3(-300, 0, 250), X, nZ, 174 - -300], [new V3(271, 0, 250), X, nZ, 300 - 271],
  ];
  const shadowG = [];
  for (const [o, t, n, L] of bbRuns) {
    trimG.push(sweep(BB, o, t, n, L));
    // 巾木の足元の影(床に貼る帯)
    const P = (s, d) => o.clone().addScaledVector(t, s).addScaledVector(n, d).setY(0.04);
    const a = P(0, 1.2), b = P(L, 1.2), c = P(L, 4.5), d = P(0, 4.5);
    const sg = new THREE.BufferGeometry();
    const up = b.clone().sub(a).cross(d.clone().sub(a)).y > 0;
    const tris = up ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    const uvm = new Map([[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [d, [0, 1]]]);
    sg.setAttribute('position', new THREE.Float32BufferAttribute(tris.flatMap(v => v.toArray()), 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(tris.flatMap(v => uvm.get(v)), 2));
    sg.setAttribute('normal', new THREE.Float32BufferAttribute(tris.flatMap(() => [0, 1, 0]), 3));
    shadowG.push(sg);
  }
  colliders.push(
    [-300, 0, -250, 145.5, 6, -248.8], [154.5, 0, -250, 300, 6, -248.8],
    [-300, 0, -250, -298.8, 6, 115.5], [-300, 0, 124.5, -298.8, 6, 250],
    [298.8, 0, -250, 300, 6, 250],
    [-300, 0, 248.8, 174, 6, 250], [271, 0, 248.8, 300, 6, 250],
  );
  for (const [o, t, n, L] of [[new V3(-300, 240, -250), X, Z, 600], [new V3(-300, 240, -250), Z, X, 500], [new V3(300, 240, -250), Z, nX, 500], [new V3(-300, 240, 250), X, nZ, 600]])
    trimG.push(sweep(CR, o, t, n, L));

  // --- 窓 (右の壁 x=300, z∈[-120,40], y∈[80,210]) ---
  trimG.push(
    boxG(298.8, 210, -126, 300, 216, 46), boxG(298.8, 82, -126, 300, 210, -120), boxG(298.8, 82, 40, 300, 210, 46), // 額縁
    boxG(298.8, 72, -126, 300, 78, 46),   // 窓台の下の見切り
    boxG(296, 78, -124, 306, 82, 44),     // 窓台
    boxG(300, 82, -120, 304, 210, -119.4), boxG(300, 82, 39.4, 304, 210, 40), boxG(300, 209.4, -120, 304, 210, 40), // 内側の枠
  );
  colliders.push([296, 78, -124, 306, 82, 44], [298.8, 72, -126, 300, 78, 46], [304, 82, -120, 312, 210, 40]);
  {
    // アルミサッシ枠
    metalG.push(
      boxG(304, 206, -120, 310, 210, 40), boxG(304, 82, -120, 310, 85.5, 40),
      boxG(304, 82, -120, 310, 210, -117), boxG(304, 82, 37, 310, 210, 40),
    );
    // 障子2枚(内・外)
    const sash = (x0, x1, z0, z1) => {
      const f = 2.6;
      metalG.push(boxG(x0, 85.5, z0, x1, 85.5 + f, z1), boxG(x0, 206 - f, z0, x1, 206, z1), boxG(x0, 85.5, z0, x1, 206, z0 + f), boxG(x0, 85.5, z1 - f, x1, 206, z1));
      return new THREE.PlaneGeometry(z1 - z0 - 2 * f, 206 - 85.5 - 2 * f).rotateY(Math.PI / 2).translate((x0 + x1) / 2, (85.5 + 206) / 2, (z0 + z1) / 2);
    };
    const gl1 = sash(305, 306.8, -117, -36), gl2 = sash(307.6, 309.4, -44, 37);
    mk(merge([gl1, gl2]), M.glass, false, false);
    // 外の空
    const sky = new THREE.PlaneGeometry(500, 360).rotateY(-Math.PI / 2).translate(360, 150, -40);
    mk(sky, M.sky, false, false);
    // カーテンレールと受け金具
    metalG.push(boxG(290.2, 222, -156, 292.6, 224.5, 76));
    for (const z of [-146, -40, 66]) metalG.push(boxG(291, 222.5, z - 1, 300, 224, z + 1));
    // カーテン(ひだ)
    const panel = (z0, z1, waves, seed) => {
      const r = rng(seed), segU = Math.round(waves * 8), segV = 24;
      const pg = new THREE.PlaneGeometry(z1 - z0, 150, segU, segV); // ローカル x=沿い, y=高さ
      const p = pg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = (p.getX(i) + (z1 - z0) / 2) / (z1 - z0), y = p.getY(i), tdown = (75 - y) / 150;
        const amp = 2.2 + tdown * 1.2 + Math.sin(u * 13 + seed) * 0.3;
        const off = Math.sin(u * waves * Math.PI * 2) * amp;
        p.setZ(i, off);
        p.setY(i, y + Math.sin(u * 40 + seed) * 0.4 * tdown + (r() - 0.5) * 0.05);
      }
      pg.computeVertexNormals();
      // ローカル x → world z、ローカル z → world x
      const m4 = new THREE.Matrix4().makeBasis(new V3(0, 0, 1), new V3(0, 1, 0), new V3(1, 0, 0)).setPosition(288.5, 146, (z0 + z1) / 2);
      pg.applyMatrix4(m4);
      // 生地の uv をワールド cm 基準に
      const uvA = pg.attributes.uv;
      for (let i = 0; i < uvA.count; i++) uvA.setXY(i, pg.attributes.position.getZ(i), pg.attributes.position.getY(i));
      return pg;
    };
    mk(merge([panel(-152, -98, 6.5, 1), panel(16, 72, 7, 2)]), M.curtain, true, true);
  }

  // --- ドア (手前の壁 z=250, x∈[180,265], y∈[0,205]) ---
  frameG.push(
    boxG(180, 0, 250, 183, 205, 262), boxG(262, 0, 250, 265, 205, 262), boxG(183, 202, 250, 262, 205, 262), // 枠
    boxG(183, 0.4, 257.6, 184.5, 202, 259), boxG(260.5, 0.4, 257.6, 262, 202, 259), boxG(183, 200.5, 257.6, 262, 202, 259), // 戸当たり
    boxG(174, 0, 248.8, 180, 211, 250), boxG(265, 0, 248.8, 271, 211, 250), boxG(174, 205, 248.8, 271, 211, 250), // 額縁
  );
  colliders.push([180, 0, 250, 183, 205, 262], [262, 0, 250, 265, 205, 262], [174, 0, 248.8, 180, 211, 250], [265, 0, 248.8, 271, 211, 250],
    [183, 1.0, 254, 262, 202, 257.6]); // 閉じたドア(下に 1cm のすき間)
  mk(boxG(183.3, 1.0, 254, 261.7, 201.7, 257.6), M.door);
  {
    // レバーハンドル(取っ手は戸先側 x≈254)
    const hx = 254.5, hy = 92;
    const ros = new THREE.CylinderGeometry(2.7, 2.9, 0.9, 28).rotateX(Math.PI / 2).translate(hx, hy, 253.55);
    const neck = new THREE.CylinderGeometry(0.85, 0.95, 3.6, 16).rotateX(Math.PI / 2).translate(hx, hy, 251.4);
    const lever = new THREE.CylinderGeometry(0.8, 0.9, 11, 16).rotateZ(Math.PI / 2).translate(hx - 5, hy, 249.9);
    const tip = new THREE.SphereGeometry(0.9, 12, 8).translate(hx - 10.5, hy, 249.9);
    const esc = new THREE.CylinderGeometry(1.6, 1.7, 0.6, 20).rotateX(Math.PI / 2).translate(hx, hy - 12, 253.7); // 鍵座
    metalG.push(ros, neck, lever, tip, esc);
    // 廊下側(すき間の向こう)
    mk(new THREE.PlaneGeometry(100, 215).rotateY(Math.PI).translate(222.5, 107.5, 262.2), M.hall, false, false);
  }

  mk(merge(trimG), M.trim);
  mk(merge(frameG), M.frame);
  mk(merge(metalG), M.metal);
  mk(merge(shadowG), M.shadow, false, false);

  // =====================================================================
  // 天井と照明
  // =====================================================================
  mk(new THREE.PlaneGeometry(623.4, 523.4).rotateX(Math.PI / 2).translate(0.3, 240, 0.3), M.ceiling, false, true);
  mk(new THREE.CylinderGeometry(25, 25, 2, 48).translate(0, 239, 0), M.lampBase, false, false);
  mk(new THREE.CylinderGeometry(22, 24, 4.5, 48).translate(0, 235.75, 0), M.lamp, false, false);

  // =====================================================================
  // コンセント・スイッチ(ネジ付き)
  // =====================================================================
  {
    const plates = [ // [中心, 室内向き, 種類]
      [new V3(-120, 25, -250), Z, 'o'], [new V3(-300, 25, -60), X, 'o'], [new V3(300, 25, 150), nX, 'o'],
      [new V3(-180, 25, 250), nZ, 'o'], [new V3(160, 120, 250), nZ, 's'],
    ];
    const pg = new THREE.BoxGeometry(7, 12, 0.5);
    const oM = plates.filter(p => p[2] === 'o'), sM = plates.filter(p => p[2] === 's');
    const io = new THREE.InstancedMesh(pg, M.outlet, oM.length), is = new THREE.InstancedMesh(pg, M.switch, sM.length);
    const sc = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.32, 0.18, 12).rotateX(Math.PI / 2), M.screw, plates.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    let io_i = 0, is_i = 0, sc_i = 0;
    for (const [c, n, kind] of plates) {
      q.setFromUnitVectors(new V3(0, 0, 1), n);
      m4.compose(c.clone().addScaledVector(n, 0.25), q, new V3(1, 1, 1));
      if (kind === 'o') io.setMatrixAt(io_i++, m4); else is.setMatrixAt(is_i++, m4);
      for (const dy of [-4.9, 4.9]) {
        m4.compose(c.clone().addScaledVector(n, 0.55).add(new V3(0, dy, 0)), q, new V3(1, 1, 1));
        sc.setMatrixAt(sc_i++, m4);
      }
      const t = new V3(0, 1, 0).cross(n).normalize();
      const a = c.clone().addScaledVector(t, 3.5), b = c.clone().addScaledVector(t, -3.5), f = c.clone().addScaledVector(n, 0.5);
      colliders.push([Math.min(a.x, b.x, f.x, c.x), c.y - 6, Math.min(a.z, b.z, f.z, c.z), Math.max(a.x, b.x, f.x, c.x), c.y + 6, Math.max(a.z, b.z, f.z, c.z)]);
    }
    for (const im of [io, is, sc]) { im.castShadow = im.receiveShadow = true; g.add(im); }
  }

  g.userData.colliders = colliders;
  return g;
};
