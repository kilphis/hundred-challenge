// 壁の中の空洞(奥の壁・左の壁)の中身。ワールド座標そのまま。1 = 1cm。
// 土台 / 間柱(下部に欠き込み+かじり跡) / 頭つなぎ / グラスウール / VVF / コンセントボックス裏 / 銅管 / ほこり・木くず・石膏粉 / 蜘蛛の巣
window.MODELS = window.MODELS || {};
window.MODELS.wallInside = function () {
  const g = new THREE.Group();
  const colliders = [];
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- 乱数・ノイズ ----------
  let seed = 917;
  function rnd() { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const R = (a, b) => a + (b - a) * rnd();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function h3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => h3(xi + i, yi + j, zi + k);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy),
      L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
  }
  const fbm = (x, y, z) => (vnoise(x, y, z) * 0.5 + vnoise(x * 2.03, y * 2.03, z * 2.03) * 0.25 + vnoise(x * 4.1, y * 4.1, z * 4.1) * 0.125) / 0.875;

  // ---------- 寸法 ----------
  const BZ0 = -260.2, BZ1 = -251.2;   // 奥の壁の空洞 z
  const LX0 = -310.2, LX1 = -301.2;   // 左の壁の空洞 x
  const XMAX = 300, ZMAX = 250, TOP = 240, PLATE = 4;
  const NOTCH_H = 10, STUB = 3;       // 欠き込み: 高さ10、外側に3cm残す
  const SP = 45.5, SW = 4.5;
  const backStuds = [], leftStuds = [];
  for (let k = 0; k <= 13; k++) backStuds.push({ c: 297.75 - SP * k, end: k === 0 });
  for (let k = 0; k <= 10; k++) leftStuds.push({ c: 247.75 - SP * k, end: k === 0 });
  const HOLE_A = 36, HOLE_C = 18, CABLE_D = 7.5;
  backStuds.forEach(s => { s.holes = []; if (s.c <= 116) s.holes.push(HOLE_A); if (s.c > 20 && s.c < 116) s.holes.push(HOLE_C); });
  leftStuds.forEach(s => { s.holes = []; if (s.c < 200) s.holes.push(HOLE_A); });
  // 世界座標 <-> (壁沿い a, 高さ y, 外側ボードからの深さ d)
  const W = {
    back: { P: (a, y, d) => V3(a, y, BZ0 + d) },
    left: { P: (a, y, d) => V3(LX0 + d, y, a) },
  };

  // ---------- テクスチャ ----------
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, rep) { const t = new THREE.CanvasTexture(c); if (rep !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }

  function texWoodSide() { // 幅256=12cm, 高さ1024=100cm。縦が木目方向
    const c = cv(256, 1024), x = c.getContext('2d');
    x.fillStyle = '#9a6e42'; x.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 22; i++) {
      const px = R(0, 256), w = R(5, 40);
      x.fillStyle = rnd() < 0.5 ? `rgba(200,160,108,${R(.08, .22)})` : `rgba(70,42,20,${R(.08, .22)})`;
      x.fillRect(px, 0, w, 1024); x.fillRect(px - 256, 0, w, 1024);
    }
    for (let i = 0; i < 170; i++) {
      const px0 = R(0, 256), A = R(1, 7), n = 1 + Math.floor(R(0, 3)), ph = R(0, 6.28), A2 = R(0, 2), n2 = 3 + Math.floor(R(0, 6));
      const dark = rnd() < 0.72;
      x.strokeStyle = dark ? `rgba(58,34,16,${R(.15, .55)})` : `rgba(214,178,128,${R(.1, .3)})`;
      x.lineWidth = R(0.5, 2.6);
      for (const off of [-256, 0, 256]) {
        x.beginPath();
        for (let y = 0; y <= 1024; y += 8) {
          const px = px0 + off + A * Math.sin(2 * Math.PI * n * y / 1024 + ph) + A2 * Math.sin(2 * Math.PI * n2 * y / 1024 + ph * 2);
          y ? x.lineTo(px, y) : x.moveTo(px, y);
        }
        x.stroke();
      }
    }
    for (let k = 0; k < 2; k++) { // 節
      const cx = R(50, 206), cy = R(160, 860);
      for (let r = 16; r > 1; r -= 1.6) {
        x.strokeStyle = `rgba(60,32,14,${0.25 + 0.04 * (16 - r)})`; x.lineWidth = 1.2;
        x.beginPath(); x.ellipse(cx, cy, r * 0.75, r * 2.4, 0, 0, Math.PI * 2); x.stroke();
      }
      x.fillStyle = 'rgba(48,26,10,0.9)'; x.beginPath(); x.ellipse(cx, cy, 5, 9, 0, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 3500; i++) { x.fillStyle = `rgba(40,22,8,${R(.05, .22)})`; x.fillRect(R(0, 256), R(0, 1024), R(.5, 1.4), R(1, 5)); }
    for (let i = 0; i < 60; i++) { // 汚れ・しみ
      const cx = R(0, 256), cy = R(0, 1024), r = R(8, 50);
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, `rgba(50,40,32,${R(.05, .15)})`); gr.addColorStop(1, 'rgba(50,40,32,0)');
      x.fillStyle = gr; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    return tex(c);
  }
  function texWoodEnd() { // 木口 256=12cm
    const c = cv(256, 256), x = c.getContext('2d');
    x.fillStyle = '#a07448'; x.fillRect(0, 0, 256, 256);
    const cx = R(-220, -120), cy = R(320, 420);
    for (let r = 4; r < 900; r += R(4, 10)) {
      x.strokeStyle = `rgba(70,40,18,${R(.3, .7)})`; x.lineWidth = R(1, 3.5);
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    }
    for (let i = 0; i < 3; i++) { // 割れ
      const a = -0.9 + R(-0.4, 0.4); const r0 = R(250, 420), r1 = r0 + R(60, 200);
      x.strokeStyle = 'rgba(30,16,6,0.85)'; x.lineWidth = R(1, 2.5);
      x.beginPath(); x.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)); x.lineTo(cx + r1 * Math.cos(a + 0.02), cy + r1 * Math.sin(a + 0.02)); x.stroke();
    }
    for (let y = 0; y < 256; y += 3) { x.strokeStyle = `rgba(255,230,190,${R(.02, .07)})`; x.lineWidth = 1; x.beginPath(); x.moveTo(0, y); x.lineTo(256, y + 18); x.stroke(); }
    for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(35,18,6,${R(.08, .3)})`; x.fillRect(R(0, 256), R(0, 256), 1, 1); }
    return tex(c);
  }
  function texFiber(base, tint) { // グラスウール 512=30cm
    const c = cv(512, 512), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 512, 512);
    function blob(cx, cy, r, col) {
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
        const gr = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
        gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
        x.fillStyle = gr; x.fillRect(cx + ox - r, cy + oy - r, 2 * r, 2 * r);
      }
    }
    for (let i = 0; i < 40; i++) blob(R(0, 512), R(0, 512), R(30, 110), tint[i % tint.length]);
    for (let i = 0; i < 220; i++) blob(R(0, 512), R(0, 512), R(4, 22), `rgba(80,50,25,${R(.12, .3)})`);
    for (let i = 0; i < 160; i++) blob(R(0, 512), R(0, 512), R(4, 16), `rgba(255,240,200,${R(.12, .3)})`);
    const cols = ['rgba(255,244,200,A)', 'rgba(150,100,45,A)', 'rgba(245,175,165,A)', 'rgba(255,255,235,A)', 'rgba(120,80,40,A)'];
    for (let i = 0; i < 14000; i++) {
      const px = R(0, 512), py = R(0, 512), a = R(0, Math.PI * 2), L = R(8, 60);
      const col = cols[Math.floor(rnd() * cols.length)].replace('A', R(.1, .4).toFixed(2));
      x.strokeStyle = col; x.lineWidth = R(0.3, 0.8);
      const ex = px + Math.cos(a) * L, ey = py + Math.sin(a) * L, mx = (px + ex) / 2 + R(-4, 4), my = (py + ey) / 2 + R(-4, 4);
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
        if ((ox && Math.min(px, ex) > 50 && Math.max(px, ex) < 462) || (oy && Math.min(py, ey) > 50 && Math.max(py, ey) < 462)) continue;
        x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(mx + ox, my + oy, ex + ox, ey + oy); x.stroke();
      }
    }
    return tex(c);
  }
  function texDust() { // 1024=60cm(壁沿い) x 128=9cm(深さ)
    const c = cv(1024, 128), x = c.getContext('2d');
    for (let v = 0; v < 128; v++) {
      const e = Math.min(v, 127 - v) / 64; // 0=端
      x.fillStyle = `rgba(120,112,100,${0.18 + 0.45 * Math.pow(1 - e, 2.5)})`; x.fillRect(0, v, 1024, 1);
    }
    for (let i = 0; i < 60; i++) { // むら
      const cx = R(60, 964), cy = R(0, 128), r = R(15, 70);
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, `rgba(135,125,110,${R(.1, .3)})`); gr.addColorStop(1, 'rgba(135,125,110,0)');
      x.fillStyle = gr; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    for (let i = 0; i < 9000; i++) {
      const t = rnd(); x.fillStyle = t < 0.5 ? `rgba(90,80,70,${R(.2, .7)})` : t < 0.8 ? `rgba(225,220,210,${R(.2, .6)})` : `rgba(140,100,60,${R(.3, .7)})`;
      const s = R(0.6, 2.2); x.fillRect(R(0, 1024), R(0, 128), s, s);
    }
    for (let i = 0; i < 220; i++) { // 毛・糸くず
      x.strokeStyle = rnd() < 0.5 ? `rgba(60,55,50,${R(.3, .7)})` : `rgba(200,195,185,${R(.3, .6)})`; x.lineWidth = R(.5, 1);
      const px = R(10, 1014), py = R(0, 128), a = R(0, 6.28), L = R(6, 30);
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + R(-10, 10), py + R(-10, 10), px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke();
    }
    return tex(c);
  }
  function texPowder() { // 石膏粉(穴の下に扇状)256x128。v=1 側が室内側ボード
    const c = cv(256, 128), x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 130);
    gr.addColorStop(0, 'rgba(240,236,226,0.95)'); gr.addColorStop(0.45, 'rgba(232,228,218,0.6)'); gr.addColorStop(1, 'rgba(232,228,218,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 2500; i++) {
      const a = R(Math.PI, Math.PI * 2), r = Math.pow(rnd(), 0.7) * 125;
      x.fillStyle = `rgba(${rnd() < 0.8 ? '245,242,232' : '170,160,145'},${R(.3, .9)})`;
      const s = R(0.8, 3); x.fillRect(128 + Math.cos(a) * r * 1.0, 128 + Math.sin(a) * r, s, s);
    }
    return tex(c, false);
  }
  function texWeb() { // 2x2 のアトラス
    const c = cv(1024, 1024), x = c.getContext('2d');
    for (let k = 0; k < 4; k++) {
      const ox = (k % 2) * 512, oy = Math.floor(k / 2) * 512;
      x.save(); x.beginPath(); x.rect(ox + 2, oy + 2, 508, 508); x.clip();
      const cx = ox + (k === 0 ? 40 : R(150, 360)), cy = oy + (k === 0 ? 40 : R(150, 360));
      const ns = 11 + Math.floor(R(0, 7)), spokes = [];
      for (let i = 0; i < ns; i++) spokes.push(i / ns * Math.PI * 2 + R(-0.15, 0.15));
      x.strokeStyle = 'rgba(235,235,228,0.75)'; x.lineWidth = 1.3;
      for (const a of spokes) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * 760, cy + Math.sin(a) * 760); x.stroke(); }
      x.strokeStyle = 'rgba(235,235,228,0.6)'; x.lineWidth = 1;
      for (let r = 14; r < 700; r += R(9, 17)) {
        x.beginPath(); let on = false;
        for (let i = 0; i <= ns; i++) {
          const a = spokes[i % ns] + (i === ns ? Math.PI * 2 : 0), rr = r * (1 + 0.05 * Math.sin(i * 3.1));
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (rnd() < 0.12) { on = false; continue; } // 切れ目
          if (!on) { x.moveTo(px, py); on = true; } else x.quadraticCurveTo(cx + Math.cos(a - Math.PI / ns) * rr * 0.93, cy + Math.sin(a - Math.PI / ns) * rr * 0.93, px, py);
        }
        x.stroke();
      }
      for (let i = 0; i < 6; i++) { // 垂れた糸
        x.strokeStyle = 'rgba(230,230,222,0.5)'; x.beginPath(); const px = ox + R(0, 512), py = oy + R(0, 512);
        x.moveTo(px, py); x.quadraticCurveTo(px + R(-80, 80), py + R(40, 160), px + R(-150, 150), py + R(-60, 60)); x.stroke();
      }
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '200,195,185' : '90,80,70'},${R(.4, .9)})`; const s = R(1, 3.5); x.fillRect(ox + R(0, 512), oy + R(0, 512), s, s); }
      x.restore();
    }
    return tex(c, false);
  }
  function texCopper() {
    const c = cv(64, 512), x = c.getContext('2d');
    x.fillStyle = '#a8653a'; x.fillRect(0, 0, 64, 512);
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(60,30,15,${R(.1, .35)})`; x.fillRect(R(0, 64), R(0, 512), R(2, 12), R(10, 80)); }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(70,120,100,${R(.15, .5)})`; x.beginPath(); x.arc(R(0, 64), R(0, 512), R(1, 5), 0, 7); x.fill(); }
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(220,200,180,${R(.05, .2)})`; x.fillRect(R(0, 64), R(0, 512), 1, 1); }
    return tex(c);
  }

  const tWoodS = texWoodSide(), tWoodE = texWoodEnd();
  const tFiber = texFiber('#d8b45e', ['rgba(232,150,140,0.45)', 'rgba(245,215,120,0.4)', 'rgba(225,140,150,0.35)']);
  const matWoodS = new THREE.MeshStandardMaterial({ map: tWoodS, bumpMap: tWoodS, bumpScale: 0.35, roughness: 0.88, vertexColors: true });
  const matWoodE = new THREE.MeshStandardMaterial({ map: tWoodE, bumpMap: tWoodE, bumpScale: 0.5, roughness: 0.92, vertexColors: true });
  const matInsul = new THREE.MeshStandardMaterial({ map: tFiber, roughness: 1 });
  const matCable = new THREE.MeshStandardMaterial({ color: 0xbfbfb8, roughness: 0.5 });
  const matResin = new THREE.MeshStandardMaterial({ color: 0x3c6aa0, roughness: 0.45 });
  const tCu = texCopper();
  const matCopper = new THREE.MeshStandardMaterial({ map: tCu, metalness: 0.3, roughness: 0.4, color: 0xffd0b0 });
  const matGalv = new THREE.MeshStandardMaterial({ color: 0xb4b8ba, metalness: 0.35, roughness: 0.4 });
  const matNail = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.55 });
  const matGyp = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const matDust = new THREE.MeshStandardMaterial({ map: texDust(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const matPowder = new THREE.MeshStandardMaterial({ map: texPowder(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const matWeb = new THREE.MeshStandardMaterial({ map: texWeb(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, emissive: 0x2a2a28, opacity: 0.7 });
  const matChip = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

  function add(mesh, cast = true) { mesh.castShadow = cast; mesh.receiveShadow = true; g.add(mesh); return mesh; }

  // ---------- 汎用マージ ----------
  function mergeGeos(list) {
    const idx = list.every(q => q.index);
    if (!idx) list = list.map(q => q.index ? q.toNonIndexed() : q);
    let nv = 0, ni = 0;
    list.forEach(q => { if (!q.attributes.normal) q.computeVertexNormals(); nv += q.attributes.position.count; if (idx) ni += q.index.count; });
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = idx ? new Uint32Array(ni) : null;
    let ov = 0, oi = 0;
    list.forEach(q => {
      const c = q.attributes.position.count;
      P.set(q.attributes.position.array, ov * 3); N.set(q.attributes.normal.array, ov * 3);
      if (q.attributes.uv) U.set(q.attributes.uv.array, ov * 2);
      if (idx) { const a = q.index.array; for (let i = 0; i < a.length; i++) I[oi + i] = a[i] + ov; oi += a.length; }
      ov += c;
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(P, 3));
    m.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    m.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    if (idx) m.setIndex(new THREE.BufferAttribute(I, 1));
    return m;
  }

  // ---------- 木材(木目方向で側面/木口を振り分け、UV はワールド座標) ----------
  const wood = { s: { p: [], n: [], uv: [], c: [] }, e: { p: [], n: [], uv: [], c: [] } };
  function smoothNormals(geo, deg) { // 非インデックス形状で、角度 deg 以内の隣接面の法線を平均
    const P = geo.attributes.position.array, n = P.length / 9, F = [], map = new Map(), ct = Math.cos(deg * Math.PI / 180);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < n; t++) {
      a.fromArray(P, t * 9); b.fromArray(P, t * 9 + 3); c.fromArray(P, t * 9 + 6);
      const fn = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)); F.push(fn.clone().normalize().multiplyScalar(Math.min(fn.length(), 1)));
      for (let k = 0; k < 3; k++) { const i = t * 9 + k * 3, key = P[i].toFixed(3) + ',' + P[i + 1].toFixed(3) + ',' + P[i + 2].toFixed(3); let l = map.get(key); if (!l) map.set(key, l = []); l.push(t); }
    }
    const N = new Float32Array(P.length), s = new THREE.Vector3();
    for (let t = 0; t < n; t++) {
      const fu = F[t].clone().normalize();
      for (let k = 0; k < 3; k++) {
        const i = t * 9 + k * 3, key = P[i].toFixed(3) + ',' + P[i + 1].toFixed(3) + ',' + P[i + 2].toFixed(3);
        s.set(0, 0, 0);
        for (const o of map.get(key)) { const fo = F[o]; if (fo.clone().normalize().dot(fu) > ct) s.add(fo); }
        if (s.lengthSq() < 1e-12) s.copy(fu); s.normalize(); N[i] = s.x; N[i + 1] = s.y; N[i + 2] = s.z;
      }
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  }
  function addWood(geo, grain, uoff, tint, smoothDeg) {
    if (geo.index) geo = geo.toNonIndexed();
    if (smoothDeg) smoothNormals(geo, smoothDeg); else geo.computeVertexNormals();
    const P = geo.attributes.position.array, Nn = geo.attributes.normal.array;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
    for (let t = 0; t < P.length; t += 9) {
      a.fromArray(P, t); b.fromArray(P, t + 3); c.fromArray(P, t + 6);
      fn.subVectors(c, b).cross(b.clone().sub(a)).normalize(); // 向きは問わない(絶対値で判定)
      const f = [Math.abs(fn.x), Math.abs(fn.y), Math.abs(fn.z)];
      const end = f[grain] > 0.86;
      const T = end ? wood.e : wood.s;
      let o1, o2, dom;
      if (end) { const o = [0, 1, 2].filter(i => i !== grain); o1 = o[0]; o2 = o[1]; }
      else { const o = [0, 1, 2].filter(i => i !== grain); dom = f[o[0]] > f[o[1]] ? o[0] : o[1]; o1 = 3 - grain - dom; }
      for (let k = 0; k < 3; k++) {
        const i = t + k * 3, p = [P[i], P[i + 1], P[i + 2]];
        T.p.push(p[0], p[1], p[2]); T.n.push(Nn[i], Nn[i + 1], Nn[i + 2]);
        if (end) T.uv.push(p[o1] / 12 + uoff, p[o2] / 12);
        else T.uv.push(p[o1] / 12 + uoff, p[grain] / 100 + uoff * 3.7);
        const col = tint(p, f); T.c.push(col[0], col[1], col[2]);
      }
    }
  }
  function buildWood() {
    const geo = new THREE.BufferGeometry();
    const p = wood.s.p.concat(wood.e.p), n = wood.s.n.concat(wood.e.n), uv = wood.s.uv.concat(wood.e.uv), c = wood.s.c.concat(wood.e.c);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const ns = wood.s.p.length / 3, ne = wood.e.p.length / 3;
    geo.addGroup(0, ns, 0); geo.addGroup(ns, ne, 1);
    add(new THREE.Mesh(geo, [matWoodS, matWoodE]));
  }
  // 箱(ワールド範囲)を木材として追加
  function woodBox(x0, y0, z0, x1, y1, z1, grain, uoff, tint) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    addWood(geo, grain, uoff, tint);
  }
  const tintOf = (k) => { const v = 0.78 + 0.18 * k; return () => [v, v * 0.98, v * 0.95]; };

  // ---------- 土台 ----------
  // 奥: x=10 で継いである(隙間0.35 で木口が覗く)
  woodBox(-310.2, -4, BZ0, 9.8, 0, BZ1, 0, 0.13, (p) => { const v = 0.72 - 0.05 * fbm(p[0] * 0.05, 0, 0); return [v, v * 0.97, v * 0.93]; });
  woodBox(10.15, -4, BZ0, XMAX, 0, BZ1, 0, 0.61, (p) => { const v = 0.8 - 0.05 * fbm(p[0] * 0.05, 1, 0); return [v, v * 0.97, v * 0.93]; });
  woodBox(LX0, -4, BZ1, LX1, 0, ZMAX, 2, 0.37, (p) => { const v = 0.75 - 0.05 * fbm(p[2] * 0.05, 2, 0); return [v, v * 0.97, v * 0.93]; });
  colliders.push([-310.2, -4, BZ0, XMAX, 0, BZ1], [LX0, -4, BZ1, LX1, 0, ZMAX]);
  // 頭つなぎ
  woodBox(-310.2, TOP - PLATE, BZ0, XMAX, TOP, BZ1, 0, 0.27, tintOf(0.6));
  woodBox(LX0, TOP - PLATE, BZ1, LX1, TOP, ZMAX, 2, 0.83, tintOf(0.5));

  // ---------- 間柱 ----------
  // プロファイル (d, y) を壁沿い方向へ 4.5 押し出し。下部は欠き込み(かじり跡のギザギザ)
  function lowerShape() {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(STUB, 0);
    const ns = R(0, 100);
    for (let y = 0.3; y < NOTCH_H - 0.2; y += 0.3) {
      const bite = 0.22 * vnoise(y * 0.9 + ns, ns, 0) + 0.05 * vnoise(y * 4 + ns, 1, 0) + (y > 5.5 ? 0.5 * Math.pow((y - 5.5) / 4.5, 2) : 0);
      s.lineTo(STUB - bite, y);
    }
    s.lineTo(STUB - R(0.3, 0.6), NOTCH_H + 0.15);
    for (let d = STUB + 0.25; d < 7.3; d += 0.25) {
      const bite = 0.3 * vnoise(d * 0.8 + ns, 7, 0) + 0.06 * vnoise(d * 5 + ns, 3, 0);
      s.lineTo(d, NOTCH_H + bite);
    }
    const rr = R(1.4, 1.9), cy = NOTCH_H + rr;
    for (let i = 0; i <= 10; i++) { // 角をかじって丸くなっている
      const a = i / 10 * Math.PI / 2, r = rr + R(-0.12, 0.12) * (i > 0 && i < 10 ? 1 : 0);
      s.lineTo(9 - rr + r * Math.sin(a), cy - r * Math.cos(a));
    }
    s.lineTo(9, 14); s.lineTo(0, 14); s.closePath();
    return s;
  }
  function upperShape(holes) {
    const s = new THREE.Shape();
    s.moveTo(0, 14); s.lineTo(9, 14); s.lineTo(9, TOP - PLATE); s.lineTo(0, TOP - PLATE); s.closePath();
    for (const hy of holes) { const h = new THREE.Path(); h.absarc(CABLE_D, hy, 0.78, 0, Math.PI * 2, true); s.holes.push(h); }
    return s;
  }
  function studMatrix(wall, c) {
    const m = new THREE.Matrix4();
    // shape(x=d, y=y, z=e) → back: (c+2.25-e, y, BZ0+d) / left: (LX0+d, y, c-2.25+e)  どちらも det=+1
    if (wall === 'back') m.set(0, 0, -1, c + SW / 2, 0, 1, 0, 0, 1, 0, 0, BZ0, 0, 0, 0, 1);
    else m.set(1, 0, 0, LX0, 0, 1, 0, 0, 0, 0, 1, c - SW / 2, 0, 0, 0, 1);
    return m;
  }
  const notchFresh = [1.22, 1.08, 0.88];
  function makeStud(wall, s, idx) {
    const grain = 1, uoff = R(0, 10), base = 0.78 + 0.16 * rnd();
    const plain = () => [base, base * 0.98, base * 0.94];
    const lo = wall === 'back' ? s.c - SW / 2 : s.c - SW / 2, hi = s.c + SW / 2;
    if (s.end) { // 端の柱(閉じる)
      if (wall === 'back') { woodBox(lo, 0, BZ0, hi, TOP - PLATE, BZ1, 1, uoff, plain); colliders.push([lo, 0, BZ0, hi, TOP, BZ1]); }
      else { woodBox(LX0, 0, lo, LX1, TOP - PLATE, hi, 1, uoff, plain); colliders.push([LX0, 0, lo, LX1, TOP, hi]); }
      return;
    }
    const M = studMatrix(wall, s.c);
    const gl = new THREE.ExtrudeGeometry(lowerShape(), { depth: SW, bevelEnabled: false, curveSegments: 6 });
    gl.applyMatrix4(M);
    const dOf = (p) => wall === 'back' ? p[2] - BZ0 : p[0] - LX0;
    const capAxis = wall === 'back' ? 0 : 2;
    addWood(gl, grain, uoff, (p, f) => {
      const d = dOf(p), y = p[1];
      if (f[capAxis] < 0.9 && y < 13.9 && d > 2.0) return notchFresh;
      return plain();
    }, 50);
    const gu = new THREE.ExtrudeGeometry(upperShape(s.holes), { depth: SW, bevelEnabled: false, curveSegments: 14 });
    gu.applyMatrix4(M);
    addWood(gu, grain, uoff, plain);
    if (wall === 'back') {
      colliders.push([lo, 0, BZ0, hi, NOTCH_H, BZ0 + STUB]);
      colliders.push([lo, NOTCH_H, BZ0, hi, TOP, BZ1]);
    } else {
      colliders.push([LX0, 0, lo, LX0 + STUB, NOTCH_H, hi]);
      colliders.push([LX0, NOTCH_H, lo, LX1, TOP, hi]);
    }
  }
  backStuds.forEach((s, i) => makeStud('back', s, i));
  leftStuds.forEach((s, i) => makeStud('left', s, i));
  buildWood();

  // ---------- 断熱材(グラスウール) ----------
  function bays(studs, start) {
    const cs = studs.map(s => s.c).sort((a, b) => a - b), out = [];
    let prev = start;
    for (const c of cs) { if (c - SW / 2 - prev > 1) out.push([prev, c - SW / 2]); prev = c + SW / 2; }
    return out;
  }
  const insulGeos = [], fringe = [];
  function insulBay(wall, a0, a1, wid) {
    const edge = [];
    const w = a1 - a0, y0 = 20, y1 = TOP - PLATE, dmax = 6.6;
    const geo = new THREE.BoxGeometry(w, y1 - y0, dmax, Math.max(2, Math.ceil(w / 1.2)), Math.ceil((y1 - y0) / 2.4), 3);
    geo.translate(w / 2, (y0 + y1) / 2, dmax / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u0 = p.getX(i), yo = p.getY(i), d0 = p.getZ(i);
      const A = a0 + u0, t = u0 / w;
      const tB = clamp((yo - y0) / 9, 0, 1);
      let droop = 1.2 + 3.6 * fbm(A * 0.11 + wid * 13.1, 3.3, 0.5) + 7.0 * Math.max(0, fbm(A * 0.22 + wid, 1.7, d0 * 0.2) - 0.5);
      droop = Math.min(droop, 4.5);
      const dj = fbm(A * 0.45 + wid * 7, yo * 0.45, d0 * 0.45) - 0.5;
      let y = yo - droop * Math.pow(1 - tB, 1.3);
      if (yo < y1 - 0.01) y += dj * 1.1 * tB;
      const front = dmax + 1.0 * Math.pow(Math.sin(Math.PI * t), 0.6) + 3.0 * (fbm(A * 0.16, yo * 0.16, 5 + wid) - 0.5) + 1.6 * (fbm(A * 0.05, yo * 0.05, 9 + wid) - 0.5) - 1.8 * Math.pow(1 - tB, 2);
      let d;
      if (d0 > dmax - 1e-3) d = front + dj * 1.6;
      else if (d0 < 1e-3) d = 0.05;
      else d = d0 / dmax * front * (1 + dj * 0.12);
      let u = u0;
      if (u0 > 1e-3 && u0 < w - 1e-3) u += dj * 0.7;
      // 逃げ: 柱際・電線の帯・コンセントボックス
      if (Math.min(u0, w - u0) < 1.8) d = Math.min(d, 7.5);
      if (yo > 31 && yo < 41) d = Math.min(d, 7.05);
      if (wall === 'back' && A > 116 && A < 126 && yo < 35) d = Math.min(d, 4.3);
      d = clamp(d, 0.05, 8.6);
      const P = wall === 'back' ? W.back.P(a0 + u, y, d) : W.left.P(a1 - u, y, d);
      p.setXYZ(i, P.x, P.y, P.z);
      if (yo < y0 + 0.01 && d0 > dmax - 1e-3) edge.push({ u: u0, y, d, a: wall === 'back' ? a0 + u : a1 - u });
      uv.setXY(i, A * 0.045 + d * 0.04, y * 0.045 + (yo < y0 + 0.01 ? d * 0.045 : 0));
    }
    geo.computeVertexNormals();
    insulGeos.push(geo);
    // 下端の毛羽(繊維のほつれを描いた透明板を垂らす)
    edge.sort((p, q) => p.u - q.u);
    const WPp = (a, y, d) => wall === 'back' ? W.back.P(a, y, d) : W.left.P(a, y, d);
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i + 2 < edge.length; i += 2) {
      const e0 = edge[i], e1 = edge[Math.min(edge.length - 1, i + 3)];
      const k = layer ? 0.55 : 0.93, h0 = R(1.8, 4.2), h1 = R(1.8, 4.2);
      const b0 = Math.max(12.8, e0.y - h0), b1 = Math.max(12.8, e1.y - h1);
      const uo = R(0, 0.75);
      fringe.push([WPp(e0.a, e0.y + 1.4, e0.d * k), WPp(e1.a, e1.y + 1.4, e1.d * k), WPp(e1.a, b1, e1.d * k - 0.2), WPp(e0.a, b0, e0.d * k - 0.2), uo]);
    }
  }
  bays(backStuds, -310.2).forEach((b, i) => insulBay('back', b[0], b[1], i));
  bays(leftStuds, -253.5).forEach((b, i) => insulBay('left', b[0], b[1], 40 + i));
  // left は a1-u で鏡映しているので面の向きを合わせる: x->d, z->a1-u は det=+1 になる配置 (d,y,-u)
  add(new THREE.Mesh(mergeGeos(insulGeos), matInsul));
  {
    const c = cv(512, 128), x = c.getContext('2d');
    const cols = ['232,200,120', '240,170,160', '250,235,190', '200,160,90'];
    for (let i = 0; i < 1400; i++) {
      const px = R(0, 512), py = R(0, 40), L = R(10, 110), col = cols[Math.floor(rnd() * cols.length)];
      x.strokeStyle = `rgba(${col},${R(.25, .7) * (1 - L / 160)})`; x.lineWidth = R(0.4, 1.4);
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + R(-14, 14), py + L * 0.5, px + R(-25, 25), Math.min(126, py + L)); x.stroke();
    }
    const gr = x.createLinearGradient(0, 0, 0, 30); gr.addColorStop(0, 'rgba(225,185,110,0.9)'); gr.addColorStop(1, 'rgba(225,185,110,0)');
    x.globalCompositeOperation = 'destination-over'; x.fillStyle = gr; x.fillRect(0, 0, 512, 30);
    const mf = new THREE.MeshStandardMaterial({ map: tex(c, false), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, alphaTest: 0.02 });
    const pos = [], uvs = [], nor = [];
    for (const [p0, p1, p2, p3, uo] of fringe) {
      const P = [p0, p1, p2, p3], U = [[uo, 1], [uo + 0.25, 1], [uo + 0.25, 0], [uo, 0]];
      const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0)).normalize();
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(P[k].x, P[k].y, P[k].z); uvs.push(U[k][0], U[k][1]); nor.push(n.x, n.y, n.z); }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const fm = new THREE.Mesh(fg, mf); fm.renderOrder = 1; add(fm, false);
  }
  colliders.push([-310.2, 15, BZ0, XMAX, TOP, BZ1], [LX0, 15, BZ1, LX1, TOP, ZMAX]);

  // ---------- 電線(VVF 平形) ----------
  function sweepFlat(pts, Wd, Ht, hintFn) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength(), n = Math.max(8, Math.ceil(L / 0.6));
    const P = curve.getSpacedPoints(n);
    const hw = Wd / 2, hh = Ht / 2, prof = [];
    for (let j = 0; j <= 4; j++) { const a = -Math.PI / 2 + Math.PI * j / 4; prof.push([hw - hh + hh * Math.cos(a), hh * Math.sin(a), Math.cos(a), Math.sin(a)]); }
    prof.push([0, hh * 0.86, 0, 1]);
    for (let j = 0; j <= 4; j++) { const a = Math.PI / 2 + Math.PI * j / 4; prof.push([-(hw - hh) + hh * Math.cos(a), hh * Math.sin(a), Math.cos(a), Math.sin(a)]); }
    prof.push([0, -hh * 0.86, 0, -1]);
    const m = prof.length, pos = [], nor = [], uvs = [], ind = [];
    let prevN = null;
    for (let i = 0; i <= n; i++) {
      const T = P[Math.min(n, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize();
      let h = hintFn(P[i], T);
      if (prevN && h.dot(prevN) < 0) h.negate();
      const N = h.clone().sub(T.clone().multiplyScalar(T.dot(h))).normalize();
      prevN = N;
      const B = new THREE.Vector3().crossVectors(T, N);
      for (let j = 0; j < m; j++) {
        const [a, b, na, nb] = prof[j];
        pos.push(P[i].x + B.x * a + N.x * b, P[i].y + B.y * a + N.y * b, P[i].z + B.z * a + N.z * b);
        const nn = B.clone().multiplyScalar(na).add(N.clone().multiplyScalar(nb)).normalize();
        nor.push(nn.x, nn.y, nn.z); uvs.push(i / n * L / 2, j / m);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const j1 = (j + 1) % m, a = i * m + j, b = i * m + j1, c = (i + 1) * m + j, d = (i + 1) * m + j1;
      ind.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(ind);
    return { geo, curve };
  }
  const hint = (vert) => (p, T) => {
    const hz = new THREE.Vector3(-T.z, 0, T.x); const lz = hz.length();
    const a = smooth(0.35, 0.85, Math.abs(T.y));
    const v = vert(p).clone().multiplyScalar(a);
    if (lz > 1e-4) v.add(hz.multiplyScalar((1 - a) / lz));
    return v.lengthSq() > 1e-8 ? v.normalize() : vert(p).clone();
  };
  const BOX = { x0: 118.05, x1: 123.65, y0: 21, y1: 31, z0: -255.6, z1: -251.2 };
  const BOXC = { x: (BOX.x0 + BOX.x1) / 2, z: (BOX.z0 + BOX.z1) / 2 };
  const cz = BZ0 + CABLE_D, cx = LX0 + CABLE_D;
  // A: 天井から左の壁の柱沿いに降り、y=36 で柱の穴を抜けて角を回り、奥の壁のコンセントボックス上面へ
  const ptsA = [V3(LX0 + 8.2, TOP + 1, 199.75), V3(LX0 + 8.2, 150, 199.75), V3(LX0 + 8.2, 60, 199.75), V3(LX0 + 8.2, 41, 199.75), V3(LX0 + 7.9, 37.3, 198.5), V3(cx, 36, 195)];
  for (const s of leftStuds.slice().sort((a, b) => b.c - a.c)) { if (s.c > 190) continue; ptsA.push(V3(cx, 36, s.c)); ptsA.push(V3(cx, 35.4 - 0.4 * rnd(), s.c - SP / 2)); }
  ptsA.pop();
  ptsA.push(V3(cx, 36, -243), V3(cx + 0.3, 36, -249.8), V3(cx + 2.0, 36, cz - 0.3 + 0.3), V3(-296, 36, cz));
  for (const s of backStuds.slice().sort((a, b) => a.c - b.c)) { if (s.c > 116) continue; if (s.c - SP / 2 > -296) ptsA.push(V3(s.c - SP / 2, 35.4 - 0.4 * rnd(), cz)); ptsA.push(V3(s.c, 36, cz)); }
  ptsA.push(V3(119.2, 35.9, cz), V3(BOXC.x - 0.2, 34.6, cz - 0.3), V3(BOXC.x, 32.6, BOXC.z), V3(BOXC.x, 30.5, BOXC.z));
  const vA = (p) => V3(0, 0, 1);
  const cabA = sweepFlat(ptsA, 1.0, 0.5, hint(vA));
  // C: ボックス下面から出て柱の穴(y=18)を抜け、途中で大きく垂れ、柱沿いに上がる
  const ptsC = [V3(BOXC.x, 21.5, BOXC.z), V3(BOXC.x, 19.6, BOXC.z + 0.3), V3(119.3, 18.2, cz), V3(116, 18, cz), V3(113.2, 18, cz),
  V3(108, 15.6, cz), V3(102, 10.5, cz + 0.2), V3(96, 6.6, cz + 0.3), V3(91, 5.6, cz + 0.2), V3(85.5, 6.9, cz), V3(79.5, 11.4, cz), V3(74.5, 16.6, cz), V3(72.5, 18, cz),
  V3(68, 18, cz), V3(62, 17.2, cz), V3(52, 14.9, cz), V3(42, 15.2, cz), V3(32, 17.1, cz), V3(27, 18, cz), V3(22.5, 18, cz),
  V3(21.2, 18.6, cz + 0.2), V3(22.05, 21, BZ0 + 8.2), V3(22.25, 25, BZ0 + 8.2), V3(22.25, 80, BZ0 + 8.2), V3(22.25, 160, BZ0 + 8.2), V3(22.25, TOP + 1, BZ0 + 8.2)];
  const vC = (p) => p.x < 60 ? V3(1, 0, 0) : V3(0, 0, 1);
  const cabC = sweepFlat(ptsC, 1.0, 0.5, hint(vC));
  add(new THREE.Mesh(mergeGeos([cabA.geo, cabC.geo]), matCable));
  { // 低く垂れた部分の当たり判定
    const pts = cabC.curve.getSpacedPoints(400).filter(p => p.y < 15 && p.x > 60 && p.x < 116);
    for (let i = 0; i < pts.length;) {
      let j = i, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      while (j < pts.length && Math.abs(pts[j].x - pts[i].x) < 4) { const q = pts[j]; x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); j++; }
      colliders.push([x0 - 0.3, y0 - 0.55, cz - 0.45, x1 + 0.3, Math.max(y1 + 0.55, y0 + 1.1), cz + 0.45]);
      i = j;
    }
  }
  // ステープル
  {
    const parts = [new THREE.BoxGeometry(1.6, 0.14, 0.12).translate(0, 0, -0.62),
    new THREE.BoxGeometry(0.12, 0.14, 0.72).translate(-0.74, 0, -0.27), new THREE.BoxGeometry(0.12, 0.14, 0.72).translate(0.74, 0, -0.27)];
    const sg = mergeGeos(parts);
    const list = [];
    for (const y of [55, 95, 135, 175, 215]) list.push([LX0 + 8.2, y, 200, 0]);
    for (const y of [45, 85, 125, 170, 215]) list.push([22.5, y, BZ0 + 8.2, Math.PI / 2]);
    const im = new THREE.InstancedMesh(sg, matGalv, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach((s, i) => { q.setFromAxisAngle(V3(0, 1, 0), s[3]); m.compose(V3(s[0], s[1], s[2]), q, V3(1, 1, 1)); im.setMatrixAt(i, m); });
    add(im);
  }

  // ---------- コンセントボックス(裏側) ----------
  {
    const parts = [];
    const bx = (w, h, d, x, y, z) => parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
    bx(BOX.x1 - BOX.x0, BOX.y1 - BOX.y0, BOX.z1 - BOX.z0 - 0.35, BOXC.x, (BOX.y0 + BOX.y1) / 2, BOXC.z - 0.175);
    bx(6.4, 11.8, 0.35, BOX.x0 + 3.2, (BOX.y0 + BOX.y1) / 2, BOX.z1 - 0.175);             // 前のつば(ボードに当たる)
    bx(0.3, 2.4, 2.6, BOX.x0 + 0.15, BOX.y1 + 1.2, -253.0); bx(1.4, 0.3, 2.6, BOX.x0 + 0.7, BOX.y1 + 0.15, -253.0); // 耳(柱に釘留め)
    bx(0.3, 2.4, 2.6, BOX.x0 + 0.15, BOX.y0 - 1.2, -253.0); bx(1.4, 0.3, 2.6, BOX.x0 + 0.7, BOX.y0 - 0.15, -253.0);
    bx(0.25, 9.2, 0.22, BOX.x0 + 0.5, 26, BOX.z0 - 0.1); bx(0.25, 9.2, 0.22, BOX.x1 - 0.5, 26, BOX.z0 - 0.1);        // 背面リブ
    bx(0.22, 0.25, 3.8, BOX.x1 + 0.1, 23.2, BOXC.z); bx(0.22, 0.25, 3.8, BOX.x1 + 0.1, 28.8, BOXC.z);
    for (const y of [23.6, 28.4]) { // ノックアウト
      parts.push(new THREE.TorusGeometry(1.05, 0.1, 6, 22).translate(BOXC.x, y, BOX.z0 - 0.02));
      parts.push(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 22).rotateX(Math.PI / 2).translate(BOXC.x, y, BOX.z0 + 0.05));
    }
    parts.push(new THREE.TorusGeometry(0.85, 0.08, 6, 18).rotateY(Math.PI / 2).translate(BOX.x1 + 0.02, 26, BOXC.z));
    parts.push(new THREE.CylinderGeometry(0.95, 1.05, 0.4, 18).translate(BOXC.x, BOX.y1 + 0.2, BOXC.z)); // ゴムブッシング位置
    parts.push(new THREE.CylinderGeometry(1.05, 0.95, 0.4, 18).translate(BOXC.x, BOX.y0 - 0.2, BOXC.z));
    add(new THREE.Mesh(mergeGeos(parts), matResin));
    colliders.push([BOX.x0, BOX.y0 - 1.5, BOX.z0, BOX.x1 + 0.3, BOX.y1 + 1.5, BOX.z1]);
  }

  // ---------- 配管(銅管2本) ----------
  const pipes = [[-151.6, -258.7, 0.8], [-147.6, -259.0, 0.62]];
  {
    const pg = pipes.map(([x, z, r]) => new THREE.CylinderGeometry(r, r, TOP + 4, 18, 1, true).translate(x, TOP / 2 - 2, z));
    pg.forEach(q => { const uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * 4); });
    add(new THREE.Mesh(mergeGeos(pg), matCopper));
    const cl = [];
    for (const [x, z, r] of pipes) {
      colliders.push([x - r, 0, z - r, x + r, TOP, z + r]);
      for (const y of [7, 95, 180]) {
        cl.push(new THREE.TorusGeometry(r + 0.08, 0.07, 6, 14, Math.PI).rotateX(Math.PI / 2).translate(x, y, z));
        for (const sx of [-1, 1]) {
          cl.push(new THREE.BoxGeometry(0.07, 0.5, z - BZ0).translate(x + sx * (r + 0.08), y, (z + BZ0) / 2));
          cl.push(new THREE.BoxGeometry(0.9, 0.5, 0.07).translate(x + sx * (r + 0.5), y, BZ0 + 0.04));
        }
      }
    }
    add(new THREE.Mesh(mergeGeos(cl), matGalv));
  }

  // ---------- 釘(インスタンス) ----------
  {
    const head = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10).translate(0, 0.05, 0);
    const shank = new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6).translate(0, -0.7, 0);
    const ng = mergeGeos([head, shank]);
    const L = []; // [pos, dirIntoWood, color]
    const down = V3(0, -1, 0);
    const rust = () => new THREE.Color().setRGB(R(0.3, 0.5), R(0.25, 0.32), R(0.2, 0.25));
    for (const s of backStuds) {
      const lo = s.c - SW / 2, hi = s.c + SW / 2, dd = s.end ? 4.5 : 1.5;
      L.push([V3(hi + 0.12, 2.6, BZ0 + dd), V3(-0.6, -0.8, 0)], [V3(lo - 0.12, 2.6, BZ0 + dd), V3(0.6, -0.8, 0)]);
      L.push([V3(R(lo - 15, lo - 6), 0.03, BZ0 + R(1.5, 7.5)), down]);
    }
    for (const s of leftStuds) {
      const lo = s.c - SW / 2, hi = s.c + SW / 2, dd = s.end ? 4.5 : 1.5;
      L.push([V3(LX0 + dd, 2.6, hi + 0.12), V3(0, -0.8, -0.6)], [V3(LX0 + dd, 2.6, lo - 0.12), V3(0, -0.8, 0.6)]);
      if (lo - 15 > -251) L.push([V3(LX0 + R(1.5, 7.5), 0.03, R(lo - 15, lo - 6)), down]);
    }
    L.push([V3(BOX.x0 + 0.35, BOX.y1 + 1.4, -253.0), V3(-1, 0, 0)], [V3(BOX.x0 + 0.35, BOX.y0 - 1.4, -253.0), V3(-1, 0, 0)]);
    const im = new THREE.InstancedMesh(ng, matNail, L.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    L.forEach(([p, d], i) => {
      q.setFromUnitVectors(V3(0, -1, 0), d.clone().normalize());
      m.compose(p, q, V3(1, 1, 1)); im.setMatrixAt(i, m);
      im.setColorAt(i, rnd() < 0.5 ? rust() : new THREE.Color(0x5a5856));
    });
    add(im);
  }

  // ---------- ほこり・石膏粉(床に敷く透明板) ----------
  {
    const dq = [];
    const strip = (wall, a0, a1) => {
      const geo = new THREE.PlaneGeometry(a1 - a0, 9, 1, 1).rotateX(-Math.PI / 2);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const a = (p.getX(i) + (a1 - a0) / 2) + a0, d = p.getZ(i) + 4.5;
        const P = wall === 'back' ? W.back.P(a, 0.04, d) : W.left.P(a, 0.04, 9 - d);
        p.setXYZ(i, P.x, P.y, P.z); uv.setXY(i, a / 60, 1 - d / 9);
      }
      geo.computeVertexNormals(); dq.push(geo);
    };
    strip('back', -310.2, XMAX); strip('left', BZ1, ZMAX);
    const dm = add(new THREE.Mesh(mergeGeos(dq), matDust), false);
    // 穴の下の石膏粉
    const pq = [];
    pq.push(new THREE.PlaneGeometry(20, 9).rotateX(-Math.PI / 2).translate(150, 0.07, (BZ0 + BZ1) / 2));
    pq.push(new THREE.PlaneGeometry(20, 9).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2).translate((LX0 + LX1) / 2, 0.07, 120));
    add(new THREE.Mesh(mergeGeos(pq), matPowder), false);
  }

  // ---------- 木くず・石膏のかけら・綿ぼこり ----------
  function inStud(wall, a, d) {
    const studs = wall === 'back' ? backStuds : leftStuds;
    for (const s of studs) if (Math.abs(a - s.c) < SW / 2 + 0.3) { if (s.end || d < STUB + 0.3) return true; }
    if (wall === 'back') for (const [x, z, r] of pipes) if (Math.abs(a - x) < r + 0.4 && d - (z - BZ0) < r + 0.4) return true;
    return false;
  }
  function floorPoint(wall, a, d) { return wall === 'back' ? W.back.P(a, 0, d) : W.left.P(a, 0, d); }
  function randFloor(bias) {
    for (let k = 0; k < 50; k++) {
      const wall = rnd() < 0.55 ? 'back' : 'left';
      const a = wall === 'back' ? R(-309.5, 299) : R(-250.5, 249);
      let d = rnd() < bias ? (rnd() < 0.5 ? R(0.15, 1.6) : R(7.4, 8.85)) : R(0.2, 8.8);
      if (!inStud(wall, a, d)) return { wall, a, d };
    }
    return { wall: 'back', a: 0, d: 5 };
  }
  {
    const chips = [];
    // かじり屑: 各欠き込みの下に集まる
    for (const [wall, studs] of [['back', backStuds], ['left', leftStuds]]) for (const s of studs) {
      if (s.end) continue;
      const n = 6 + Math.floor(R(0, 8));
      for (let i = 0; i < n; i++) { const a = s.c + R(-5, 5), d = R(STUB + 0.3, 8.8); if (!inStud(wall, a, d)) chips.push([wall, a, d, true]); }
    }
    for (let i = 0; i < 180; i++) { const f = randFloor(0.5); chips.push([f.wall, f.a, f.d, false]); }
    const cg = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(cg, matChip, chips.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    chips.forEach(([wall, a, d, fresh], i) => {
      const sx = fresh ? R(0.15, 0.55) : R(0.2, 0.9), sy = R(0.04, 0.12), sz = R(0.1, 0.35);
      const p = floorPoint(wall, a, d); p.y = sy / 2 + 0.02;
      e.set(R(-0.25, 0.25), R(0, 6.28), R(-0.25, 0.25)); q.setFromEuler(e);
      m.compose(p, q, V3(sx, sy, sz)); im.setMatrixAt(i, m);
      const c = fresh ? new THREE.Color().setRGB(R(0.8, 0.92), R(0.66, 0.76), R(0.48, 0.56)) : new THREE.Color().setRGB(R(0.45, 0.62), R(0.36, 0.48), R(0.26, 0.34));
      im.setColorAt(i, c);
    });
    add(im);
  }
  {
    const crumbs = [];
    for (const [wall, a] of [['back', 150], ['left', 120]]) for (let i = 0; i < 90; i++) {
      const r = Math.pow(rnd(), 1.4) * 9, ang = R(0, Math.PI);
      const aa = a + Math.cos(ang) * r, d = 9 - Math.sin(ang) * r * 0.75 - 0.2;
      if (d > 0.3 && !inStud(wall, aa, d)) crumbs.push([wall, aa, d, rnd() < 0.85]);
    }
    for (let i = 0; i < 160; i++) { const f = randFloor(0.75); crumbs.push([f.wall, f.a, f.d, rnd() < 0.6]); }
    const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), matGyp, crumbs.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    crumbs.forEach(([wall, a, d, white], i) => {
      const s = R(0.05, 0.26), p = floorPoint(wall, a, d); p.y = s * 0.3;
      e.set(R(0, 6), R(0, 6), R(0, 6)); q.setFromEuler(e);
      m.compose(p, q, V3(s * R(0.7, 1.3), s * R(0.4, 0.8), s * R(0.7, 1.3))); im.setMatrixAt(i, m);
      { const v = white ? R(0.82, 0.95) : R(0.32, 0.45); im.setColorAt(i, new THREE.Color().setRGB(v, v * 0.98, v * 0.94)); }
    });
    add(im);
  }
  { // 綿ぼこり: 毛の絡まりを描いた板を3枚交差
    const c = cv(256, 256), x = c.getContext('2d');
    for (let i = 0; i < 900; i++) {
      const r = Math.pow(rnd(), 0.6) * 95, a = R(0, 6.28), px = 128 + Math.cos(a) * r, py = 128 + Math.sin(a) * r * 0.8;
      const b = R(.2, 1); x.strokeStyle = `rgba(${Math.round(120 + 100 * b)},${Math.round(115 + 95 * b)},${Math.round(105 + 90 * b)},${R(.25, .7) * (1 - r / 120)})`;
      x.lineWidth = R(0.4, 1.2); const L = R(10, 50), aa = R(0, 6.28);
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + R(-20, 20), py + R(-20, 20), px + Math.cos(aa) * L, py + Math.sin(aa) * L); x.stroke();
    }
    const mb = new THREE.MeshStandardMaterial({ map: tex(c, false), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1 });
    const pl = [];
    for (let k = 0; k < 3; k++) pl.push(new THREE.PlaneGeometry(2, 2).rotateY(k * Math.PI / 3));
    pl.push(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2).scale(1, 1, 1));
    const bg = mergeGeos(pl);
    const L = [];
    for (let i = 0; i < 50; i++) L.push(randFloor(0.85));
    for (let i = 0; i < 6; i++) L.push({ wall: 'back', a: R(-309, -302), d: R(0.5, 8.5) }, { wall: 'back', a: R(290, 295), d: R(1, 8.5) }, { wall: 'left', a: R(238, 245), d: R(1, 8.5) });
    const im = new THREE.InstancedMesh(bg, mb, L.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    L.forEach((f, i) => {
      const s = R(0.5, 1.6), P = floorPoint(f.wall, f.a, clamp(f.d, s * 0.8, 9 - s * 0.8)); P.y = s * 0.42;
      q.setFromAxisAngle(V3(0, 1, 0), R(0, 6.28)); m.compose(P, q, V3(s * R(0.9, 1.4), s * 0.45, s)); im.setMatrixAt(i, m);
    });
    im.renderOrder = 1;
    add(im, false);
  }

  // ---------- 蜘蛛の巣 ----------
  {
    const pos = [], uv = [], nor = [];
    function quad(p0, p1, p2, p3, cell, flip) { // p0 が巣の中心(アトラスの角)寄り
      const u0 = (cell % 2) * 0.5, v0 = Math.floor(cell / 2) * 0.5;
      const uvq = [[u0, 1 - v0], [u0 + 0.5, 1 - v0], [u0 + 0.5, 0.5 - v0], [u0, 0.5 - v0]];
      const P = [p0, p1, p2, p3];
      const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0)).normalize();
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(P[k].x, P[k].y, P[k].z); uv.push(uvq[k][0], uvq[k][1]); nor.push(n.x, n.y, n.z); }
    }
    const WP = (wall, a, y, d) => wall === 'back' ? W.back.P(a, y, d) : W.left.P(a, y, d);
    for (const [wall, studs] of [['back', backStuds], ['left', leftStuds]]) {
      studs.forEach((s, i) => {
        const r = rnd();
        // 床の隅(柱の脇と外側ボードの角): 斜めに張る
        if (r < 0.6) {
          const sgn = rnd() < 0.5 ? 1 : -1, af = s.c + sgn * SW / 2, w = R(3, 5.5), h = R(6, 13);
          if (!(wall === 'back' && af + sgn * w < -310) && !(wall === 'left' && af + sgn * w < -251))
            quad(WP(wall, af, 0.2, s.end ? R(4, 7) : 0.2 + STUB * 0.0), WP(wall, af + sgn * w, 0.2, 0.05), WP(wall, af + sgn * w, h, 0.05), WP(wall, af, h, s.end ? 7 : STUB), 0);
        }
        // 頭つなぎの下、柱の前面の角
        if (r > 0.35) {
          const sgn = rnd() < 0.5 ? 1 : -1, af = s.c + sgn * SW / 2, w = R(6, 12), h = R(5, 10);
          quad(WP(wall, af, TOP - PLATE - 0.05, 8.9), WP(wall, af + sgn * w, TOP - PLATE - 0.05, 8.9), WP(wall, af + sgn * w, TOP - PLATE - h, 8.9), WP(wall, af, TOP - PLATE - h, 8.9), 1 + Math.floor(rnd() * 3));
        }
      });
    }
    // 角と行き止まりの大きめの巣
    quad(V3(-310.1, 0.3, -260.1), V3(-303, 0.3, -260.1), V3(-303, 14, -260.1), V3(-310.1, 14, -260.1), 0);
    quad(V3(-310.1, 0.3, -260.1), V3(-310.1, 0.3, -253), V3(-310.1, 13, -253), V3(-310.1, 13, -260.1), 0);
    quad(V3(295.4, 0.3, -251.3), V3(289, 0.3, -251.3), V3(289, 12, -258), V3(295.4, 12, -258), 2);
    quad(V3(-301.3, 0.3, 245.4), V3(-301.3, 0.3, 239), V3(-308, 11, 239), V3(-308, 11, 245.4), 3);
    quad(V3(-305.7, TOP - PLATE - 0.1, -251.3), V3(-296, TOP - PLATE - 0.1, -251.3), V3(-296, 222, -251.3), V3(-305.7, 222, -251.3), 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const wm = new THREE.Mesh(geo, matWeb); wm.renderOrder = 2; add(wm, false);
  }

  g.userData.colliders = colliders;
  return g;
};
