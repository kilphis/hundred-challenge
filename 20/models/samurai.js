// 侍(関節つき・モーション差分つき)  Three.js r128 / 1 = 1cm / 原点=足元中央 / 正面 +Z / 身長 約170cm
// 登録: window.MODELS.samurai
// 左右はキャラクター基準: 左 = +X, 右 = -X(刀は右手持ち)
(function () {
  'use strict';
  window.MODELS = window.MODELS || {};
  const T = THREE, PI = Math.PI, D2R = PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sstep = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const AX = V3(1, 0, 0), AY = V3(0, 1, 0), DOWN = V3(0, -1, 0);
  function mkRand(seed) { let s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function toTex(c, rx, ry) { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 4; return t; }

  // ------------------------------------------------------------------ 質感(CanvasTexture)
  // 藍の絣(かすり)木綿: 縦横の糸目 + 格子状にかすれた十字
  function kasuriCanvas() {
    const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(7);
    g.fillStyle = '#1b2a4a'; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.08;
    for (let y = 0; y < H; y += 2) { g.fillStyle = (y / 2) % 2 ? '#000' : '#9ab'; g.fillRect(0, y, W, 1); }
    for (let x = 0; x < W; x += 2) { g.fillStyle = (x / 2) % 2 ? '#000' : '#9ab'; g.fillRect(x, 0, 1, H); }
    g.globalAlpha = 1;
    for (let i = 0; i < 40; i++) { // 染めムラ
      g.globalAlpha = 0.05 + r() * 0.05; g.fillStyle = r() < 0.5 ? '#0c1630' : '#2c4272';
      g.fillRect(r() * W, 0, 6 + r() * 30, H);
    }
    g.globalAlpha = 1; g.lineCap = 'round';
    const step = 32;
    for (let gy = 0; gy < H / step; gy++) for (let gx = 0; gx < W / step; gx++) {
      const cx = gx * step + step / 2 + (gy % 2 ? step / 2 : 0) + (r() - 0.5) * 2, cy = gy * step + step / 2 + (r() - 0.5) * 2;
      const s = 3.6 + r() * 1.6; g.strokeStyle = '#6c88bd'; g.lineWidth = 2.2;
      for (const ox of [0, -W]) for (const oy of [0, -H]) {
        g.globalAlpha = 0.5 + r() * 0.3;
        g.beginPath(); g.moveTo(cx + ox - s, cy + oy); g.lineTo(cx + ox + s, cy + oy); g.moveTo(cx + ox, cy + oy - s); g.lineTo(cx + ox, cy + oy + s); g.stroke();
      }
    }
    g.globalAlpha = 1; return c;
  }
  // 前腕: 上は同じ布、下は革の手甲(縫い目と留め紐)
  function forearmCanvas() {
    const base = kasuriCanvas(), W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(11);
    g.drawImage(base, 0, 0);
    const y0 = H * 0.66;
    g.fillStyle = '#3a2a20'; g.fillRect(0, y0, W, H - y0);
    for (let i = 0; i < 900; i++) { g.globalAlpha = 0.18; g.fillStyle = r() < 0.5 ? '#1c130d' : '#6a4d3a'; g.fillRect(r() * W, y0 + r() * (H - y0), 2 + r() * 8, 1); }
    g.globalAlpha = 1; g.strokeStyle = '#d8cdb8'; g.lineWidth = 3; g.setLineDash([9, 6]);
    g.beginPath(); g.moveTo(0, y0 + 12); g.lineTo(W, y0 + 12); g.moveTo(0, H - 14); g.lineTo(W, H - 14); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#c9a24a'; for (let x = 16; x < W; x += 64) { g.beginPath(); g.arc(x, y0 + 50, 5, 0, 7); g.fill(); }
    g.fillStyle = '#e8e0d0'; g.fillRect(0, y0 - 4, W, 8); // 袖口の縁
    return c;
  }
  // 袴: 細い縞 + 襞(ひだ)の陰影
  function hakamaCanvas() {
    const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(3);
    g.fillStyle = '#50535e'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) { g.fillStyle = '#2f3139'; g.fillRect(x, 0, 3, H); g.fillStyle = '#6a6e79'; g.fillRect(x + 8, 0, 2, H); }
    for (let x = 0; x < W; x += 64) {
      const gr = g.createLinearGradient(x, 0, x + 64, 0);
      gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(0.14, 'rgba(0,0,0,0)'); gr.addColorStop(0.82, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.34)');
      g.fillStyle = gr; g.fillRect(x, 0, 64, H);
    }
    for (let i = 0; i < 1500; i++) { g.globalAlpha = 0.07; g.fillStyle = r() < 0.5 ? '#000' : '#fff'; g.fillRect(r() * W, r() * H, 1, 3 + r() * 8); }
    g.globalAlpha = 1; return c;
  }
  function obiCanvas() {
    const W = 256, H = 64, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(5);
    g.fillStyle = '#4b2e22'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) { g.globalAlpha = 0.18; g.fillStyle = y % 4 ? '#2a170f' : '#7a5238'; g.fillRect(0, y, W, 1); }
    g.globalAlpha = 1; g.fillStyle = '#b8923f'; g.fillRect(0, 6, W, 2); g.fillRect(0, H - 8, W, 2);
    for (let i = 0; i < 300; i++) { g.globalAlpha = 0.12; g.fillStyle = '#d8b878'; g.fillRect(r() * W, r() * H, 1 + r() * 6, 1); }
    g.globalAlpha = 1; return c;
  }
  function clothWhiteCanvas() {
    const W = 128, H = 128, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(9);
    g.fillStyle = '#efe9db'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { g.globalAlpha = 0.08; g.fillStyle = r() < 0.5 ? '#9a8e78' : '#fff'; g.fillRect(r() * W, r() * H, 1, 2 + r() * 6); }
    g.globalAlpha = 1; return c;
  }
  function strawCanvas() {
    const W = 128, H = 128, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(13);
    g.fillStyle = '#b79556'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) {
      g.fillStyle = ((x + y) / 8) % 2 ? '#a07f42' : '#c8a868'; g.fillRect(x, y, 8, 4); g.fillStyle = ((x + y) / 8) % 2 ? '#c8a868' : '#a07f42'; g.fillRect(x, y + 4, 8, 4);
    }
    for (let i = 0; i < 300; i++) { g.globalAlpha = 0.1; g.fillStyle = '#3a2a10'; g.fillRect(r() * W, r() * H, 3, 1); }
    g.globalAlpha = 1; return c;
  }
  function tsukaCanvas() { // 柄巻(菱巻)
    const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(17);
    g.fillStyle = '#e4ddcc'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { g.globalAlpha = 0.25; g.fillStyle = '#b8ae98'; g.beginPath(); g.arc(r() * W, r() * H, 1.2, 0, 7); g.fill(); }
    g.globalAlpha = 1; g.lineCap = 'butt';
    const sp = 128;
    for (const dir of [1, -1]) for (let k = -4; k <= 8; k++) {
      g.strokeStyle = dir > 0 ? '#1a2036' : '#222a44'; g.lineWidth = 34;
      g.beginPath();
      if (dir > 0) { g.moveTo(k * sp - 600, -600 + 0); g.lineTo(k * sp + 600, 600); g.moveTo(k * sp - 600 + 0, -600 + H); g.lineTo(k * sp + 600, 600 + H); }
      else { g.moveTo(k * sp + 600, -600); g.lineTo(k * sp - 600, 600); g.moveTo(k * sp + 600, -600 + H); g.lineTo(k * sp - 600, 600 + H); }
      g.stroke();
      g.strokeStyle = 'rgba(120,140,190,.25)'; g.lineWidth = 3; g.stroke();
    }
    return c;
  }
  function bladeCanvas() { // 鋼 + 刃文(はもん) + 鎬筋
    const W = 1024, H = 128, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(21);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#7e868f'); gr.addColorStop(0.5, '#a3abb4'); gr.addColorStop(0.72, '#c9cfd6'); gr.addColorStop(1, '#eef1f4');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { g.globalAlpha = 0.09; g.fillStyle = r() < 0.5 ? '#444c56' : '#fff'; g.fillRect(r() * W, r() * H * 0.78, 40 + r() * 260, 1); }
    g.globalAlpha = 1;
    // 刃文: 刃(下側 v小)は白く、境は波打つ
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) { const y = H * 0.68 - 6 - 5 * Math.sin(x / 23) - 4 * Math.sin(x / 9 + 1) - 3 * Math.sin(x / 61); g.lineTo(x, y); }
    g.lineTo(W, H); g.closePath();
    const hg = g.createLinearGradient(0, H * 0.55, 0, H); hg.addColorStop(0, 'rgba(255,255,255,.95)'); hg.addColorStop(1, '#fbfdff');
    g.fillStyle = hg; g.fill();
    for (let i = 0; i < 700; i++) { g.globalAlpha = 0.5; g.fillStyle = '#fff'; g.fillRect(r() * W, H * (0.5 + r() * 0.2), 1.5, 1.5); } // 匂・沸
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(40,46,54,.55)'; g.fillRect(0, H * 0.34, W, 2.5); // 鎬筋
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(0, H * 0.34 + 3, W, 2);
    g.fillStyle = 'rgba(30,36,44,.5)'; g.fillRect(0, H * 0.04, W, 4); // 棟
    return c;
  }
  function faceCanvas() {
    const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(31);
    g.fillStyle = '#d8a47e'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1800; i++) { g.globalAlpha = 0.03; g.fillStyle = r() < 0.5 ? '#a8714f' : '#f0c8a0'; g.fillRect(r() * W, r() * H, 2 + r() * 5, 2 + r() * 5); }
    g.globalAlpha = 1;
    const Y = l => 256 - l * 2.844;
    // 頬と眼窩の陰影
    for (const s of [-1, 1]) {
      let gg = g.createRadialGradient(256 + s * 80, Y(-8), 4, 256 + s * 80, Y(-8), 60); gg.addColorStop(0, 'rgba(200,110,90,.10)'); gg.addColorStop(1, 'rgba(200,110,90,0)'); g.fillStyle = gg; g.fillRect(150, 200, 220, 160);
      gg = g.createRadialGradient(256 + s * 62, Y(3), 3, 256 + s * 62, Y(3), 44); gg.addColorStop(0, 'rgba(110,60,40,.12)'); gg.addColorStop(1, 'rgba(110,60,40,0)'); g.fillStyle = gg; g.fillRect(150, 180, 220, 140);
    }
    for (const s of [-1, 1]) {
      const cx = 256 + s * 64, cy = Y(2);
      // 眉(内側が低い、太い)
      g.fillStyle = '#17110e'; g.beginPath();
      g.moveTo(cx - s * 26, cy - 15); g.quadraticCurveTo(cx + s * 6, cy - 33, cx + s * 52, cy - 33);
      g.quadraticCurveTo(cx + s * 8, cy - 26, cx - s * 26, cy - 6); g.closePath(); g.fill();
      g.save(); g.translate(cx, cy); g.rotate(-s * 0.13);
      g.beginPath(); g.ellipse(0, 0, 22, 7.5, 0, 0, 2 * PI); g.save(); g.clip();
      g.fillStyle = '#ece2d6'; g.fillRect(-30, -12, 60, 24);
      g.fillStyle = '#2b1b13'; g.beginPath(); g.arc(s * -1, 0, 7.2, 0, 7); g.fill();
      g.fillStyle = '#0a0605'; g.beginPath(); g.arc(s * -1, 0, 3.4, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(s * -1 + 2.4, -2.4, 1.5, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = '#120c0a'; g.lineWidth = 3.6; g.beginPath(); g.ellipse(0, 1, 22.5, 7.8, 0, PI * 1.02, PI * 1.98); g.stroke();
      g.strokeStyle = 'rgba(110,70,50,.6)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 0, 22, 8.4, 0, 0.1, PI - 0.1); g.stroke();
      g.restore();
    }
    const my = Y(-21);
    g.strokeStyle = '#6a3a30'; g.lineCap = 'round'; g.lineWidth = 4.2;
    g.beginPath(); g.moveTo(256 - 36, my - 1); g.quadraticCurveTo(256, my + 6, 256 + 36, my - 1); g.stroke();
    g.strokeStyle = 'rgba(120,70,55,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(256 - 24, my + 9); g.quadraticCurveTo(256, my + 14, 256 + 24, my + 9); g.stroke();
    return c;
  }
  function hairCanvas() { // 部分球(上から115度)。v=0..1 が 緯度90..-25
    const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'), r = mkRand(41);
    g.fillStyle = '#0d0d10'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.5; g.strokeStyle = r() < 0.5 ? '#25252c' : '#050507'; g.lineWidth = 1; const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + 12 + r() * 30); g.stroke(); }
    g.globalAlpha = 1;
    const X = d => 256 + d * 2.844, Y = l => (90 - l) * (512 / 115);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    g.beginPath(); g.moveTo(X(-58), Y(-40)); g.lineTo(X(-58), Y(34)); g.quadraticCurveTo(X(-52), Y(54), X(-30), Y(62)); g.lineTo(X(30), Y(62)); g.quadraticCurveTo(X(52), Y(54), X(58), Y(34)); g.lineTo(X(58), Y(-40)); g.closePath(); g.fill();
    g.fillRect(0, 0, W, Y(62)); // 月代(さかやき)の頭頂
    g.fillRect(X(-100), Y(14), X(100) - X(-100), H); // こめかみ・耳まわりは地肌
    g.globalCompositeOperation = 'source-over'; return c;
  }
  function monCanvas() {
    const S = 256, c = canvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#f2eee4'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
    g.fillStyle = '#14161c'; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.fill();
    g.fillStyle = '#f2eee4';
    for (let k = 0; k < 3; k++) { g.save(); g.translate(128, 128); g.rotate(k * 2 * PI / 3); g.beginPath(); g.moveTo(0, -8); g.bezierCurveTo(46, -50, 46, -92, 0, -96); g.bezierCurveTo(-46, -92, -46, -50, 0, -8); g.fill(); g.restore(); }
    g.beginPath(); g.arc(128, 128, 12, 0, 7); g.fill();
    return c;
  }

  // ------------------------------------------------------------------ 2関節IK (S:付け根, T:目標, pole:曲がる向きのヒント, sgn: -1=腕(前へ曲がる) +1=脚(後ろへ曲がる))
  function solve2(S, Tg, l1, l2, pole, sgn) {
    const d = Tg.clone().sub(S); let D = d.length(); const u = d.clone().normalize();
    D = clamp(D, Math.abs(l1 - l2) + 0.3, l1 + l2 - 0.05);
    const a = (l1 * l1 - l2 * l2 + D * D) / (2 * D), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
    const p = pole.clone().addScaledVector(u, -pole.dot(u)); if (p.lengthSq() < 1e-8) p.set(0, 0, 1); p.normalize();
    const E = S.clone().addScaledVector(u, a).addScaledVector(p, h);
    const T2 = S.clone().addScaledVector(u, D);
    const dir1 = E.clone().sub(S).normalize(), dir2 = T2.clone().sub(E).normalize();
    const qs = new T.Quaternion().setFromUnitVectors(DOWN, dir1);
    const dl = dir2.clone().applyQuaternion(qs.clone().invert());
    const beta = ph => Math.atan2(-(dl.x * Math.sin(ph) + dl.z * Math.cos(ph)), -dl.y);
    let phi = Math.atan2(dl.x, dl.z), b = beta(phi);
    if (b * sgn < 0) { phi += PI; b = beta(phi); }
    const q1 = qs.multiply(new T.Quaternion().setFromAxisAngle(AY, phi));
    return { q1, beta: b };
  }
  const qx = a => new T.Quaternion().setFromAxisAngle(AX, a);

  // ------------------------------------------------------------------ 本体
  window.MODELS.samurai = function () {
    const root = new T.Group(); root.name = 'samurai';
    const M = o => new T.MeshStandardMaterial(o);
    function add(parent, geo, mat, x, y, z) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
    function grp(parent, x, y, z) { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; }
    function rod(parent, p1, p2, r, mat) {
      const a = V3(...p1), b = V3(...p2), d = b.clone().sub(a), m = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 6), mat);
      m.position.copy(a.clone().add(b).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(AY, d.normalize()); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    }

    // --- 素材
    const kasC = kasuriCanvas(), foreC = forearmCanvas();
    const cloth = (rx, ry) => M({ map: toTex(kasC, rx, ry), roughness: 0.92, metalness: 0 });
    const clothD = (rx, ry) => M({ map: toTex(kasC, rx, ry), roughness: 0.92, metalness: 0, side: T.DoubleSide });
    const matFore = M({ map: toTex(foreC, 1, 1), roughness: 0.9 });
    const hakC = hakamaCanvas();
    const hak = (rx, ry) => M({ map: toTex(hakC, rx, ry), roughness: 0.95 });
    const hakD = (rx, ry) => M({ map: toTex(hakC, rx, ry), roughness: 0.95, side: T.DoubleSide });
    const matHemRing = M({ color: 0x23242b, roughness: 0.9 });
    const matObi = M({ map: toTex(obiCanvas(), 3, 1), roughness: 0.7 });
    const matWhite = M({ map: toTex(clothWhiteCanvas(), 2, 2), roughness: 0.95, side: T.DoubleSide });
    const matSkin = M({ color: 0xd8a47e, roughness: 0.65 });
    const matSkinD = M({ color: 0xd8a47e, roughness: 0.65, side: T.DoubleSide });
    const matStraw = M({ map: toTex(strawCanvas(), 1, 2), roughness: 0.95 });
    const matStrap = M({ color: 0x6a2018, roughness: 0.8 });
    const matTabi = M({ color: 0xece6d8, roughness: 0.9 });

    // --- 関節
    const J = {};
    const hips = J.hips = grp(root, 0, 93, 0);
    const spine = J.spine = grp(hips, 0, 6, 0);
    const chest = J.chest = grp(spine, 0, 16, 0);
    const neck = J.neck = grp(chest, 0, 25, 0);
    const head = J.head = grp(neck, 0, 7, 0);

    // --- 腰: 袴の腰板まわり + 帯 + 帯の結び + 脇差
    const pelvis = add(hips, new T.LatheGeometry([[8.5, -13], [12.5, -9], [14.8, -4], [15.4, 0], [15.4, 4.2]].map(p => new T.Vector2(p[0], p[1])), 40), hakD(2, 1), 0, 0, 0);
    pelvis.scale.set(1.08, 1, 0.7);
    const obi = add(hips, new T.CylinderGeometry(15.1, 15.1, 9, 40, 1, true), matObi, 0, 8.5, 0); obi.scale.set(1.08, 1, 0.68); obi.material.side = T.DoubleSide;
    add(hips, new T.BoxGeometry(11, 6.5, 3.5), matObi, 0, 8.5, -11.6);
    add(hips, new T.BoxGeometry(3.2, 9, 2.4), matObi, -2.5, 3.5, -11.8).rotation.z = 0.15;
    add(hips, new T.BoxGeometry(3.2, 9, 2.4), matObi, 2.5, 3.5, -11.8).rotation.z = -0.15;
    // 脇差(帯に差す・左腰)
    const waki = grp(hips, 16, 9, 1); waki.rotation.x = 0.1; waki.rotation.y = 0.06;
    const matSaya = M({ color: 0x14100e, roughness: 0.22, metalness: 0.15 }), matGold = M({ color: 0xc9a24a, roughness: 0.35, metalness: 0.7, emissive: 0x2a2008 });
    const sayaG = new T.CylinderGeometry(1.5, 1.3, 28, 12); sayaG.rotateX(PI / 2);
    const sayaM = add(waki, sayaG, matSaya, 0, 0, -12); sayaM.scale.set(0.8, 1, 1);
    const wTsukaG = new T.CylinderGeometry(1.3, 1.3, 13, 12); wTsukaG.rotateX(PI / 2);
    add(waki, wTsukaG, M({ map: toTex(tsukaCanvas(), 1, 1.4), roughness: 0.7 }), 0, 0, 8.5).scale.set(0.8, 1, 1);
    const wTsubaG = new T.CylinderGeometry(2.7, 2.7, 0.5, 20); wTsubaG.rotateX(PI / 2);
    add(waki, wTsubaG, M({ color: 0x1b1b1e, roughness: 0.5, metalness: 0.5 }), 0, 0, 2.0);
    const wCapG = new T.SphereGeometry(1.45, 10, 8); add(waki, wCapG, matGold, 0, 0, -26).scale.set(0.8, 1, 0.6);

    // --- 腹(spine)と胸(chest)
    add(spine, new T.LatheGeometry([[13.0, -3], [13.6, 3], [14.0, 10], [14.0, 17]].map(p => new T.Vector2(p[0], p[1])), 48), clothD(3, 1), 0, 0, 0).scale.set(1, 1, 0.62);
    const spl = new T.SplineCurve([[14.0, 0], [14.6, 5], [15.8, 12], [16.6, 19], [15.0, 24], [8.5, 26.5], [5.2, 27.5]].map(p => new T.Vector2(p[0], p[1])));
    const chestPts = spl.getPoints(28);
    const rAt = y => { for (let i = 0; i < chestPts.length - 1; i++) { const a = chestPts[i], b = chestPts[i + 1]; if (y >= a.y && y <= b.y) return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y || 1); } return chestPts[chestPts.length - 1].x; };
    const zAt = (x, y) => 0.62 * Math.sqrt(Math.max(rAt(y) * rAt(y) - x * x, 0));
    add(chest, new T.LatheGeometry(chestPts, 64), clothD(3, 1), 0, 0, 0).scale.set(1, 1, 0.62);
    // 襟元のV(肌) と 襟(左前)
    {
      const rows = 8, cols = 6, pos = [], idx = [];
      for (let j = 0; j <= rows; j++) { const y = 26.4 - (26.4 - 9) * j / rows, w = 0.6 + 5.4 * (y - 9) / 17.4; for (let i = 0; i <= cols; i++) { const x = w * (2 * i / cols - 1); pos.push(x, y, zAt(x, y) + 0.12); } }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      add(chest, g, matSkinD, 0, 0, 0);
    }
    function ribbon(path, hw, zo, mat) {
      const pos = [], uv = [], idx = [], n = path.length;
      for (let i = 0; i < n; i++) {
        const p = path[i], q0 = path[Math.max(i - 1, 0)], q1 = path[Math.min(i + 1, n - 1)];
        let tx = q1[0] - q0[0], ty = q1[1] - q0[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
        const nx = -ty * hw, ny = tx * hw;
        for (const s of [-1, 1]) { const x = p[0] + nx * s, y = p[1] + ny * s; pos.push(x, y, zAt(x, y) + zo); uv.push(s < 0 ? 0 : 1, i / (n - 1) * 4); }
      }
      for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return add(chest, g, mat, 0, 0, 0);
    }
    ribbon([[-4.6, 26.6], [-3.9, 21], [-3.0, 15], [-2.4, 9], [-2.0, 4], [-1.6, 0.5]], 1.3, 0.4, matWhite);   // 右前(下)
    ribbon([[4.6, 26.6], [3.2, 21], [1.2, 15], [-1.0, 9], [-3.6, 4], [-6.2, 0.5]], 1.4, 0.8, matWhite);       // 左前(上)
    const collar = add(chest, new T.CylinderGeometry(5.5, 5.8, 2.8, 24, 1, true), matWhite, 0, 26.6, -0.3); collar.scale.z = 0.95;
    // 背紋
    const monG = new T.CircleGeometry(4.6, 32), monM = M({ map: toTex(monCanvas(), 1, 1), roughness: 0.8, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); monM.map.wrapS = monM.map.wrapT = T.ClampToEdgeWrapping;
    const mon = add(chest, monG, monM, 0, 15, -zAt(0, 15) - 0.15); mon.rotation.y = PI;

    // --- 首・頭
    add(neck, new T.CylinderGeometry(4.2, 4.6, 10, 18), matSkin, 0, 3, 0);
    add(head, new T.CylinderGeometry(3.6, 4.0, 3, 14), matSkin, 0, 0.8, 0);
    const skullG = new T.SphereGeometry(1, 48, 32), skull = add(head, skullG, M({ map: toTex(faceCanvas(), 1, 1), roughness: 0.62 }), 0, 9, 0);
    skull.material.map.wrapS = T.RepeatWrapping; skull.scale.set(8.2, 10.2, 9.0);
    add(head, new T.SphereGeometry(1, 24, 16), matSkin, 0, 2.6, 1.4).scale.set(6.0, 4.4, 5.6);          // あご
    add(head, new T.SphereGeometry(1, 14, 10), matSkin, 0, 7.3, 8.9).scale.set(0.85, 1.6, 1.1);          // 鼻
    add(head, new T.SphereGeometry(1, 12, 10), matSkin, 0, 6.3, 9.0).scale.set(1.4, 0.6, 0.7);
    for (const s of [-1, 1]) add(head, new T.SphereGeometry(1, 12, 10), matSkin, s * 8.0, 8.6, -0.4).scale.set(0.9, 2.5, 1.7); // 耳
    const hairG = new T.SphereGeometry(1, 48, 28, 0, 2 * PI, 0, 115 * D2R);
    const hairM = M({ map: toTex(hairCanvas(), 1, 1), roughness: 0.5, metalness: 0.05, alphaTest: 0.5, side: T.DoubleSide }); hairM.map.wrapS = hairM.map.wrapT = T.ClampToEdgeWrapping; hairM.map.wrapS = T.RepeatWrapping;
    add(head, hairG, hairM, 0, 9, 0).scale.set(8.5, 10.5, 9.3);
    const matHair = M({ color: 0x0f0f12, roughness: 0.45, metalness: 0.05 });
    const knot = new T.CatmullRomCurve3([V3(0, 15.2, -6.6), V3(0, 18.6, -7.0), V3(0, 21.3, -5.3), V3(0, 22.4, -1.6), V3(0, 22.0, 1.6)]);
    add(head, new T.TubeGeometry(knot, 24, 1.55, 10, false), matHair);
    add(head, new T.SphereGeometry(1.5, 10, 8), matHair, 0, 22.0, 1.7);
    const tie = add(head, new T.TorusGeometry(1.75, 0.35, 6, 14), matWhite, 0, 17.4, -6.95); tie.rotation.x = PI / 2 - 0.25;
    const band = add(head, new T.CylinderGeometry(7.4, 8.6, 2.8, 40, 1, true), matWhite, 0, 13.8, 0); band.scale.z = 1.098;
    for (const s of [-1, 1]) { const tail = add(head, new T.PlaneGeometry(2.2, 14, 1, 4), matWhite, s * 1.6, 7.2, -10.2); tail.rotation.x = -0.28; tail.rotation.z = s * 0.12; }

    // --- 腕(s=+1 左 / s=-1 右)
    function makeArm(s) {
      const sh = grp(chest, s * 17.5, 22, 0);
      add(sh, new T.SphereGeometry(6.0, 20, 14), cloth(1, 1), 0, 0, 0);
      add(sh, new T.CylinderGeometry(5.5, 4.9, 28, 24, 1), cloth(1.3, 1), 0, -14, 0);
      const el = grp(sh, 0, -28, 0);
      add(el, new T.SphereGeometry(4.9, 18, 12), cloth(1, 1), 0, 0, 0);
      add(el, new T.CylinderGeometry(4.8, 4.0, 26, 24, 1), matFore, 0, -13, 0);
      const wr = grp(el, 0, -26, 0);
      const fG = new T.SphereGeometry(1, 20, 14); fG.rotateX(PI / 2);
      const fistC = canvas(128, 128), fg = fistC.getContext('2d'); fg.fillStyle = '#d8a47e'; fg.fillRect(0, 0, 128, 128); fg.fillStyle = 'rgba(90,50,35,.65)';
      for (const v of [0.33, 0.45, 0.56, 0.67]) fg.fillRect(0, v * 128 - 1, 128, 2.4);
      const fist = add(wr, fG, M({ map: toTex(fistC, 1, 1), roughness: 0.65 }), 0, 0, 3.5); fist.scale.set(3.7, 3.7, 4.7); fist.material.map.wrapS = fist.material.map.wrapT = T.ClampToEdgeWrapping; fist.material.map.wrapS = T.RepeatWrapping;
      return { sh, el, wr };
    }
    const L = makeArm(1), R = makeArm(-1);
    J.lShoulder = L.sh; J.lElbow = L.el; J.lWrist = L.wr; J.rShoulder = R.sh; J.rElbow = R.el; J.rWrist = R.wr;

    // --- 刀(右手首の子。右手首が原点、+Z が切先)
    const sword = grp(R.wr, 0, 0, 0); J.sword = sword;
    const matSteel = (() => { const t = toTex(bladeCanvas(), 1, 1); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return M({ map: t, emissiveMap: t, emissive: 0x3a3e44, color: 0xffffff, roughness: 0.28, metalness: 0.5 }); })();
    {
      const Ll = 70, W = 3.0, N = 20, e = Ll - 4.5, sh = new T.Shape(); sh.moveTo(0, 0);
      for (let i = 1; i <= N; i++) sh.lineTo(e * i / N, 0);
      sh.quadraticCurveTo(Ll - 1.0, 0, Ll, W * 0.8); sh.lineTo(Ll - 1.3, W);
      for (let i = N - 1; i >= 0; i--) sh.lineTo((Ll - 1.3) * i / N, W);
      const g = new T.ExtrudeGeometry(sh, { depth: 0.75, bevelEnabled: false, curveSegments: 6 });
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const ox = p.getX(i), oy = p.getY(i), oz = p.getZ(i);
        uv.setXY(i, clamp(ox / Ll, 0, 1), clamp(oy / W, 0, 1));
        p.setXYZ(i, -oz + 0.375, oy - 1.2 - 0.00042 * ox * ox, ox + 10);
      }
      g.computeVertexNormals(); add(sword, g, matSteel);
    }
    add(sword, new T.BoxGeometry(1.5, 3.4, 2.6), matGold, 0, 0.2, 11.9);
    const tsubaG = new T.CylinderGeometry(3.7, 3.7, 0.6, 28); tsubaG.rotateX(PI / 2);
    add(sword, tsubaG, M({ color: 0x1a1a1d, roughness: 0.45, metalness: 0.55, emissive: 0x08080a }), 0, 0, 10.0);
    const tRing = add(sword, new T.TorusGeometry(3.6, 0.28, 6, 28), matGold, 0, 0, 10.0);
    const tsukaG = new T.CylinderGeometry(1.5, 1.6, 22, 20); tsukaG.rotateX(PI / 2);
    add(sword, tsukaG, M({ map: toTex(tsukaCanvas(), 1, 2.4), roughness: 0.75 }), 0, 0, -2).scale.set(0.8, 1, 1);
    const fuG = new T.CylinderGeometry(1.7, 1.7, 1.4, 14); fuG.rotateX(PI / 2); add(sword, fuG, matGold, 0, 0, 8.8).scale.set(0.85, 1, 1);
    const kaG = new T.SphereGeometry(1.6, 12, 8); add(sword, kaG, matGold, 0, 0, -13).scale.set(0.8, 1, 0.55);

    // --- 脚(s=+1 左 / s=-1 右)
    function makeLeg(s) {
      const hip = grp(hips, s * 9, -3, 0);
      add(hip, new T.SphereGeometry(10.2, 20, 14), hak(1, 1), 0, 0, 0);
      add(hip, new T.CylinderGeometry(10.2, 11.2, 44, 24, 1), hak(1, 1), 0, -22, 0);
      const knee = grp(hip, 0, -44, 0);
      add(knee, new T.SphereGeometry(11.0, 20, 14), hak(1, 1), 0, 0, 0);
      add(knee, new T.CylinderGeometry(11.0, 8.8, 37, 24, 1), hak(1, 1), 0, -18.5, 0);
      add(knee, new T.CylinderGeometry(8.95, 8.95, 3.2, 24, 1), matHemRing, 0, -35.4, 0);
      const ankle = grp(knee, 0, -37, 0);
      add(ankle, new T.CylinderGeometry(3.3, 3.6, 6.2, 14), matTabi, 0, -2.3, 0);
      add(ankle, new T.SphereGeometry(1, 18, 12), matTabi, 0, -5.4, 5.5).scale.set(4.1, 2.5, 11);
      add(ankle, new T.BoxGeometry(9.4, 1.5, 24), matStraw, 0, -8.25, 6.5);
      add(ankle, new T.SphereGeometry(1, 14, 8), matStraw, 0, -8.25, 18.5).scale.set(4.7, 0.75, 2.0);
      rod(ankle, [0, -3.4, 12], [s * 4.3, -7.6, 3.5], 0.38, matStrap); rod(ankle, [0, -3.4, 12], [-s * 4.3, -7.6, 3.5], 0.38, matStrap);
      return { hip, knee, ankle };
    }
    const LL = makeLeg(1), RL = makeLeg(-1);
    J.lHip = LL.hip; J.lKnee = LL.knee; J.lAnkle = LL.ankle; J.rHip = RL.hip; J.rKnee = RL.knee; J.rAnkle = RL.ankle;

    // ------------------------------------------------------------------ ポーズ適用
    function legIK(leg, f, s) {
      const qf = new T.Quaternion().setFromAxisAngle(AY, f.yaw || 0).multiply(qx(f.psi || 0));
      const ank = V3(f.x, 0, f.z).add(V3(0, 9, -18).applyQuaternion(qf)); ank.y += f.lift || 0;
      const hqi = hips.quaternion.clone().invert();
      const loc = ank.sub(hips.position).applyQuaternion(hqi);
      const r = solve2(leg.hip.position, loc, 44, 37, V3(s * 0.1, 0.05, 1), 1);
      leg.hip.quaternion.copy(r.q1); leg.knee.rotation.set(r.beta, 0, 0);
      const legQ = r.q1.clone().multiply(qx(r.beta));
      leg.ankle.quaternion.copy(legQ.invert().multiply(hqi).multiply(qf));
    }
    function applyPose(P) {
      hips.position.set(P.hx || 0, P.hy, P.hz || 0);
      hips.rotation.set(P.hp || 0, P.hyaw || 0, P.hr || 0, 'YXZ');
      spine.rotation.set(P.sp || 0, P.sy || 0, P.sr || 0, 'YXZ');
      chest.rotation.set(P.cp || 0, P.cy || 0, P.cr || 0, 'YXZ');
      const lean = (P.hp || 0) + (P.sp || 0) + (P.cp || 0), yaw = (P.hyaw || 0) + (P.sy || 0) + (P.cy || 0);
      neck.rotation.set(-lean * 0.5, -yaw * 0.5, 0); head.rotation.set(-lean * 0.5, -yaw * 0.5, 0);
      legIK(RL, P.fR, -1); legIK(LL, P.fL, 1);
      // 刀の向き(胸ローカル): alpha=水平から上向きの角度、by=胸Y軸まわりの向き
      const a = P.alpha + lean, ca = Math.cos(a), sa = Math.sin(a), qy = new T.Quaternion().setFromAxisAngle(AY, P.by || 0);
      const dz = V3(0, sa, ca).applyQuaternion(qy), ny = V3(0, ca, -sa).applyQuaternion(qy), nx = ny.clone().cross(dz);
      const Qs = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(nx, ny, dz));
      const eo = P.eo === undefined ? 0.35 : P.eo, ed = P.ed === undefined ? 1 : P.ed;
      const TR = V3(P.wr[0], P.wr[1], P.wr[2]);
      let r = solve2(R.sh.position, TR, 28, 26, V3(-eo, -ed, -0.2), -1);
      R.sh.quaternion.copy(r.q1); R.el.rotation.set(r.beta, 0, 0);
      R.wr.quaternion.copy(r.q1.clone().multiply(qx(r.beta)).invert().multiply(Qs));
      if (P.grip !== false) {
        const TL = TR.clone().addScaledVector(dz, -10);
        r = solve2(L.sh.position, TL, 28, 26, V3(eo, -ed, -0.2), -1);
        L.sh.quaternion.copy(r.q1); L.el.rotation.set(r.beta, 0, 0);
        L.wr.quaternion.copy(r.q1.clone().multiply(qx(r.beta)).invert().multiply(Qs));
      } else {
        const f = P.lf; L.sh.rotation.set(f.x, 0, f.z, 'XYZ'); L.el.rotation.set(f.el, 0, 0); L.wr.rotation.set(f.wr, 0, 0);
      }
    }

    // ------------------------------------------------------------------ モーション
    const ease = (k, u) => k === 'in' ? u * u : k === 'out' ? 1 - (1 - u) * (1 - u) : k === 'lin' ? u : u * u * (3 - 2 * u);
    function seq(t, tk, vs, es) {
      if (t <= tk[0]) return vs[0];
      for (let i = 0; i < tk.length - 1; i++) if (t <= tk[i + 1]) { const u = (t - tk[i]) / (tk[i + 1] - tk[i]); return vs[i] + (vs[i + 1] - vs[i]) * ease((es && es[i]) || 'io', u); }
      return vs[vs.length - 1];
    }
    function gait(ph, f) { // ph=0 で遊脚の始め。s=-1(後ろ)..+1(前)
      if (ph < 1 - f) { const u = ph / (1 - f); return { s: -1 + 2 * sstep(u), sw: u, st: -1 }; }
      const u2 = (ph - (1 - f)) / f; return { s: 1 - 2 * u2, sw: -1, st: u2 };
    }
    const S2 = 2 * PI;

    function poseIdle(t) {
      const b = Math.sin(S2 * t);
      return { hy: 87 + 0.5 * b, hz: 4, hx: 0.3 * Math.sin(S2 * t + 0.5), hp: 0.04, sp: 0.04, cp: 0.02 + 0.012 * b,
        wr: [-1, -3 + 0.5 * b, 31], alpha: (12 + 1.2 * Math.sin(S2 * t + 1)) * D2R, eo: 0.35, ed: 1,
        fR: { x: -9, z: 26, psi: 0, yaw: -0.08 }, fL: { x: 9, z: -8, psi: 0.25, yaw: 0.08 } };
    }
    function poseWalk(t) {
      const f = 0.62, half = 13.6, gR = gait(t % 1, f), gL = gait((t + 0.5) % 1, f);
      const foot = (g, x, cz, base, yaw) => ({ x, yaw, z: cz + half * g.s,
        lift: g.sw >= 0 ? 2.2 * Math.sin(PI * g.sw) : 0,
        psi: base + (g.st >= 0 ? 0.42 * sstep((g.st - 0.7) / 0.3) : 0.42 * (1 - sstep(g.sw / 0.3))) });
      return { hy: 86.8 - 0.7 * Math.cos(2 * S2 * (t - 0.44)), hz: 4 + 1.2 * Math.sin(S2 * t), hx: 1.5 * Math.sin(S2 * t),
        hyaw: 0.05 * Math.cos(S2 * (t - 0.6)), hp: 0.05, sp: 0.04, cp: 0.02, cy: -0.03 * Math.cos(S2 * (t - 0.6)),
        wr: [-1, -3 + 0.5 * Math.cos(2 * S2 * t), 31], alpha: (12 + 1.5 * Math.sin(S2 * t)) * D2R, eo: 0.35, ed: 1,
        fR: foot(gR, -9, 26, 0, -0.08), fL: foot(gL, 9, -8, 0.28, 0.08) };
    }
    function poseRun(t) {
      const f = 0.4, half = 34.4, cz = 6, gR = gait(t % 1, f), gL = gait((t + 0.5) % 1, f);
      const foot = (g, x, yaw) => {
        let lift = 0, psi;
        if (g.sw >= 0) { lift = 27 * Math.sin(PI * g.sw); psi = 0.9 * (1 - sstep(g.sw * 1.25)); }
        else psi = 0.9 * sstep((g.st - 0.5) / 0.5);
        return { x, yaw, z: cz + half * g.s, lift, psi };
      };
      const c = Math.cos(S2 * (t - 0.6));
      return { hy: 80.5 + 7 * (0.5 - 0.5 * Math.cos(2 * S2 * (t - 0.8))), hz: 0, hp: 0.10, sp: 0.08, cp: 0.04,
        hyaw: 0.14 * c, sy: -0.03 * c, cy: -0.12 * c,
        wr: [-23, -10 + 1.2 * Math.cos(2 * S2 * (t - 0.8)), 24], alpha: 14 * D2R, by: 0.08, eo: 0.7, ed: 1, grip: false,
        lf: { x: -0.95 * c, z: 0.22, el: -(1.35 + 0.25 * c), wr: 1.2 },
        fR: foot(gR, -9, -0.05), fL: foot(gL, 9, 0.05) };
    }
    function poseAttack(t) {
      const tk = [0, 0.26, 0.34, 0.48, 0.60, 1], es = ['io', 'io', 'in', 'out', 'io'], S = v => seq(t, tk, v, es);
      const u1 = clamp((t - 0.34) / 0.14, 0, 1), u2 = clamp((t - 0.60) / 0.40, 0, 1);
      return { hy: S([87, 90, 91, 85, 85, 87]), hz: S([4, -2, -4, 16, 16, 4]), hp: S([0.04, -0.06, -0.10, 0.14, 0.14, 0.04]),
        sp: S([0.04, -0.14, -0.20, 0.22, 0.22, 0.04]), cp: S([0.02, -0.10, -0.14, 0.14, 0.14, 0.02]),
        wr: [S([-1, -2, -2, -1, -1, -1]), S([-3, 56, 58, -8, -8, -3]), S([31, 16, 14, 36, 36, 31])],
        alpha: S([12, 140, 148, -10, -10, 12]) * D2R, eo: S([0.35, 0.9, 0.9, 0.5, 0.5, 0.35]), ed: S([1, 0.5, 0.5, 1, 1, 1]),
        fR: { x: -9, yaw: -0.08, psi: 0, z: S([26, 26, 26, 64, 64, 26]), lift: 7 * Math.sin(PI * u1) + 2 * Math.sin(PI * u2) },
        fL: { x: 9, yaw: 0.08, z: -8, psi: S([0.25, 0.3, 0.3, 0.6, 0.6, 0.25]) } };
    }
    const motions = {
      idle: { duration: 2.4, loop: true, fn: poseIdle },
      walk: { duration: 0.8, loop: true, fn: poseWalk, speed: 55 },   // 前進速度 cm/s(足が滑らない値)
      run: { duration: 0.66, loop: true, fn: poseRun, speed: 260 },
      attack: { duration: 1.1, loop: false, fn: poseAttack }
    };
    root.userData.joints = J;
    root.userData.motions = {}; for (const k in motions) root.userData.motions[k] = { duration: motions[k].duration, loop: motions[k].loop, speed: motions[k].speed || 0 };
    root.userData.setPose = function (name, t) {
      const m = motions[name] || motions.idle; t = Number(t) || 0;
      t = m.loop ? ((t % 1) + 1) % 1 : clamp(t, 0, 1);
      applyPose(m.fn(t));
    };
    root.userData.setPose('idle', 0);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return root;
  };
})();
