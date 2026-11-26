// 多脚の彫刻 案D「巻貝」 — 対数らせんの殻(自作BufferGeometry)を、腹側のブロンズの環から出る8本の骨の脚で支える。
// 1 = 1cm / Y上 / +Z が殻口の向き / 原点 = 足先の円の中心の地面。
(function () {
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wrapPi = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

  // ---- 殻の質感(周期的に描く: x = 巻き方向 1周分, y = 管の断面の周) ----
    const K = 0.15, TR = 0.7, CR = 0.78, CU = 0.78, TURNS = 3.5, TH = TURNS * 2 * Math.PI, TILT = 0.42;
  const PHI_SUTURE = Math.atan2((1 - Math.exp(-2 * Math.PI * K)) * TR / CU, -(1 - Math.exp(-2 * Math.PI * K)) / CR);   // 縫合線が来る断面角(1つ前の巻きに接する側)
  function shellTextures() {
    const W = 1024, H = 512, R = rng(41);
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const col = mk(W, H), bmp = mk(512, 256), rgh = mk(512, 256);
    const cx = col.getContext('2d'), bx = bmp.getContext('2d'), rx = rgh.getContext('2d');
    cx.fillStyle = '#6e4a22'; cx.fillRect(0, 0, W, H);
    bx.fillStyle = '#808080'; bx.fillRect(0, 0, 512, 256);
    rx.fillStyle = '#8a8a8a'; rx.fillRect(0, 0, 512, 256);
    // 周期つきの塗り(端をまたぐ円)
    function blob(ctx, w, h, x, y, rx_, ry_, rgb, a) {
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const X = x + ox * w, Y = y + oy * h;
        if (X + rx_ < 0 || X - rx_ > w || Y + ry_ < 0 || Y - ry_ > h) continue;
        ctx.save(); ctx.translate(X, Y); ctx.scale(1, ry_ / rx_);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx_);
        g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx_, 0, 7); ctx.fill(); ctx.restore();
      }
    }
    // 金の磨かれた部分 / 暗い磨き残し / 緑青
    for (let i = 0; i < 46; i++) { const x = R() * W, y = R() * H, r = 40 + R() * 120; blob(cx, W, H, x, y, r, r * (0.35 + R() * 0.5), '226,178,84', 0.7); blob(rx, 512, 256, x / 2, y / 2, r / 2, r / 2 * 0.5, '70,70,70', 0.9); }
    for (let i = 0; i < 70; i++) { const x = R() * W, y = R() * H, r = 25 + R() * 90; blob(cx, W, H, x, y, r, r * (0.4 + R() * 0.6), '34,20,10', 0.5); blob(rx, 512, 256, x / 2, y / 2, r / 2, r / 2 * 0.6, '230,230,230', 0.8); }
    for (let i = 0; i < 16; i++) { const x = R() * W, y = R() * H, r = 20 + R() * 55; blob(cx, W, H, x, y, r, r * 0.6, '92,98,52', 0.4); }
    for (let i = 0; i < 9000; i++) { cx.fillStyle = R() < 0.5 ? 'rgba(20,10,4,0.22)' : 'rgba(230,190,100,0.16)'; cx.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2); }
    // 成長線(巻き方向に直交する細いすじ。不規則な間隔)
    let x = 0;
    while (x < W) {
      x += 5 + R() * 13; const dark = R() < 0.3 ? 0.42 : 0.2;
      cx.fillStyle = `rgba(22,12,5,${dark})`; cx.fillRect(x, 0, 1.2, H);
      cx.fillStyle = 'rgba(235,195,110,0.16)'; cx.fillRect(x + 1.6, 0, 1, H);
      bx.fillStyle = `rgba(0,0,0,${0.35 + R() * 0.25})`; bx.fillRect(x / 2, 0, 1.4, 256);
      bx.fillStyle = 'rgba(255,255,255,0.25)'; bx.fillRect(x / 2 + 1.4, 0, 1, 256);
    }
    // らせんの畝(断面の周方向に一定のすじ)
    for (let k = 0; k < 28; k++) {
      const y = (k + R() * 0.5) * (H / 28), t = 1 + R() * 2.2;
      cx.fillStyle = 'rgba(20,10,4,0.3)'; cx.fillRect(0, y, W, t);
      cx.fillStyle = 'rgba(240,200,110,0.18)'; cx.fillRect(0, y + t, W, 1.2);
      bx.fillStyle = 'rgba(255,255,255,0.32)'; bx.fillRect(0, y / 2, 512, t / 2 + 0.8);
    }
    // 縫合線
    const ys = (PHI_SUTURE / (2 * Math.PI)) * H;
    cx.fillStyle = 'rgba(14,7,3,0.9)'; cx.fillRect(0, ys - 4, W, 8);
    cx.fillStyle = 'rgba(230,190,100,0.35)'; cx.fillRect(0, ys + 5, W, 3); cx.fillRect(0, ys - 9, W, 2);
    bx.fillStyle = 'rgba(0,0,0,0.8)'; bx.fillRect(0, ys / 2 - 3, 512, 6);
    const mkT = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
    return { map: mkT(col), bump: mkT(bmp), rough: mkT(rgh) };
  }
  function pearlTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d'), R = rng(7);
    const g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, '#f6e6e0'); g.addColorStop(0.3, '#fbefe8'); g.addColorStop(0.55, '#f2d0cf'); g.addColorStop(0.8, '#f7ddd2'); g.addColorStop(1, '#f6e6e0');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) { const y = R() * 256; x.fillStyle = `rgba(${R() < 0.5 ? '210,236,240' : '250,210,200'},0.18)`; x.fillRect(0, y, 256, 2 + R() * 6); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  // ---- 殻本体: 対数らせんに沿って、楕円の断面を並べる ----
  function shellPoint(th, ph, thEnd, out) {
    const rho = Math.exp(K * th);
    const f = smooth(0, 1.3, th);                                    // 先端を閉じる
    const lf = smooth(thEnd - 1.1, thEnd, th);                        // 殻口の縁へ向けて広がる
    const outer = Math.max(0, Math.cos(ph - 0.2));                   // 外唇側ほど大きく反る
    const flare = 1 + (0.20 + 0.22 * outer) * lf * lf;
    const grow = 1 + 0.18 * smooth(TH - 4.4, TH - 0.5, th);          // 体層をふくらませる
    const kn = Math.exp(-Math.pow(wrapPi(ph - (PHI_SUTURE - 0.75)) / 0.32, 2)) * (0.5 + 0.5 * Math.cos(8 * th)) * smooth(2.0, 7.5, th) * (1 - 0.7 * lf);
    const m = (1 + 0.09 * Math.cos(ph - 0.6) + 0.13 * kn) * flare * grow * f;
    const aR = CR * rho * m, aU = CU * rho * m * (1 + 0.08 * Math.sin(ph * 2 + th * 0.5));
    const Rr = rho + aR * Math.cos(ph);
    out[0] = Rr * Math.cos(th); out[1] = -TR * rho + aU * Math.sin(ph); out[2] = Rr * Math.sin(th);
  }
  const SHELL_FIT = {};
  function buildShell() {
    const NT = 380, NP = 56;
    const pos = [], uv = [], idx = [], P = [0, 0, 0];
    const thEnds = [];
    for (let i = 0; i < NP; i++) { const ph = (i / NP) * 2 * Math.PI; thEnds.push(TH + 0.30 * (0.5 + 0.5 * Math.cos(ph - 0.5)) + 0.05 * Math.sin(3 * ph)); }
    for (let j = 0; j <= NT; j++) {
      for (let i = 0; i <= NP; i++) {
        const ii = i % NP, ph = (i / NP) * 2 * Math.PI, te = thEnds[ii];
        const th = te * Math.pow(j / NT, 1);
        shellPoint(th, ph, te, P); pos.push(P[0], P[1], P[2]); uv.push(th / (2 * Math.PI), i / NP);
      }
    }
    for (let j = 0; j < NT; j++) for (let i = 0; i < NP; i++) {
      const a = j * (NP + 1) + i, b = a + 1, c = a + NP + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    // 向きを変換(殻口 +Z、螺塔が後ろ上)
    const ex = -Math.sin(TH), ez = Math.cos(TH), psi = Math.atan2(-ex, ez), tilt = TILT;
    const cp = Math.cos(psi), sp = Math.sin(psi), ct = Math.cos(tilt), st = Math.sin(tilt);
    const rot = (x, y, z) => { const x1 = x * cp + z * sp, z1 = -x * sp + z * cp; return [x1, y * ct + z1 * st, z1 * ct - y * st]; };
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let n = 0; n < pos.length; n += 3) {
      const r = rot(pos[n], pos[n + 1], pos[n + 2]); pos[n] = r[0]; pos[n + 1] = r[1]; pos[n + 2] = r[2];
      for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], r[a]); mx[a] = Math.max(mx[a], r[a]); }
    }
    const s = 600 / (mx[2] - mn[2]);                       // 長さ(Z) 約600
    const sx = Math.min(1, Math.max(0.5, 500 / ((mx[0] - mn[0]) * s)));  // 幅は約500(前後に長い殻にするため横を潰す)
    const sy = Math.min(1.25, Math.max(0.5, 380 / ((mx[1] - mn[1]) * s)));   // 高さ約380
    SHELL_FIT.raw = [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]]; SHELL_FIT.s = s; SHELL_FIT.sx = sx; SHELL_FIT.sy = sy;
    const cxm = (mx[0] + mn[0]) / 2, czm = (mx[2] + mn[2]) / 2;
    const rotP = (p) => { const r = rot(p[0], p[1], p[2]); return [(r[0] - cxm) * s * sx, (r[1] - mn[1]) * s * sy + 350, (r[2] - czm) * s]; };
    for (let n = 0; n < pos.length; n += 3) {
      pos[n] = (pos[n] - cxm) * s * sx; pos[n + 1] = (pos[n + 1] - mn[1]) * s * sy + 350; pos[n + 2] = (pos[n + 2] - czm) * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    // 外向きか確認(断面の中心から見て)。逆なら反転
    {
      const n0 = (Math.floor(NT * 0.6)) * (NP + 1) + 0;                     // φ=0: 外側(+半径方向)
      const q = [0, 0, 0]; shellPoint(TH * 0.6, 0, TH, q); const cen = [0, 0, 0]; const rho = Math.exp(K * TH * 0.6); cen[0] = rho * Math.cos(TH * 0.6); cen[1] = -TR * rho; cen[2] = rho * Math.sin(TH * 0.6);
      const dir = rot(q[0] - cen[0], q[1] - cen[1], q[2] - cen[2]);
      const nm = geo.attributes.normal, d = nm.getX(n0) * dir[0] + nm.getY(n0) * dir[1] + nm.getZ(n0) * dir[2];
      if (d < 0) { const ia = geo.index.array; for (let n = 0; n < ia.length; n += 3) { const t = ia[n + 1]; ia[n + 1] = ia[n + 2]; ia[n + 2] = t; } geo.computeVertexNormals(); }
    }
    // 殻口の縁の点列
    const nEnd = rot(...[0,1,2].map(a => { const q1 = [0,0,0], q2 = [0,0,0]; shellPoint(TH + 0.01, 1.2, TH + 1, q1); shellPoint(TH - 0.01, 1.2, TH + 1, q2); return q1[a] - q2[a]; }));
    SHELL_FIT.nEnd = nEnd;
    const rim = [];
    for (let i = 0; i < NP; i += 1) { const ph = (i / NP) * 2 * Math.PI; shellPoint(thEnds[i], ph, thEnds[i], P); const r = rotP(P); rim.push(new THREE.Vector3(r[0], r[1], r[2])); }
    return { geo, rim, pos, scale: s * (1) };
  }

  // 殻の下部の面積から、環の位置を決める
  function bellyStats(pos, yMax) {
    let sx = 0, sz = 0, n = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] < yMax) { sx += pos[i]; sz += pos[i + 2]; n++; x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); z0 = Math.min(z0, pos[i + 2]); z1 = Math.max(z1, pos[i + 2]); }
    return { cx: sx / n, cz: sz / n, x0, x1, z0, z1, n };
  }

  // ---- 脚の逆運動学(SPEC のとおり) ----
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

  function boneGeo(rEnd, rRoot, L, seg) { const g = new THREE.CylinderGeometry(rEnd, rRoot, L, 18, seg || 6); g.rotateX(Math.PI / 2); g.translate(0, 0, L / 2); return g; }
  function collarGeo() {      // 付け根のカラー: つば + 円錐 + 帯。+Z 方向へ
    const pts = [[0, 0], [30, 0], [31, 3], [27, 6], [22, 14], [17.5, 38], [16.5, 52], [20, 54], [20.5, 60], [16, 63], [13.4, 66], [0, 66]].map(p => new THREE.Vector2(p[0], p[1]));
    const g = new THREE.LatheGeometry(pts, 28); g.rotateX(Math.PI / 2); return g;
  }

  window.MODELS = window.MODELS || {};
  window.MODELS.sculpt_d = function () {
    const g = new THREE.Group(); g.name = 'sculpt_d';
    const body = new THREE.Group(); g.add(body); g.userData.body = body;
    const add = (parent, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

    // 材質
    const tx = shellTextures();
    const shellMat = new THREE.MeshStandardMaterial({ map: tx.map, bumpMap: tx.bump, bumpScale: 2.2, roughnessMap: tx.rough, roughness: 0.7, metalness: 0.3, color: 0xffffff, emissive: 0x2b1a0b, emissiveIntensity: 1.0, side: THREE.FrontSide });
    const pearlMat = new THREE.MeshPhysicalMaterial({ map: pearlTexture(), color: 0xe6bdb4, roughness: 0.3, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.1, side: THREE.BackSide });
    const lipMat = new THREE.MeshPhysicalMaterial({ color: 0xe9cdb4, roughness: 0.32, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.15, emissive: 0x2a1a14, emissiveIntensity: 0.3 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x6a4521, roughness: 0.48, metalness: 0.4 });
    const legMat2 = new THREE.MeshStandardMaterial({ color: 0x7d5326, roughness: 0.4, metalness: 0.45 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0xa9792f, roughness: 0.3, metalness: 0.5 });

    // 殻
    const sh = buildShell();
    const shell = add(body, sh.geo, shellMat); shell.name = 'shell';
    const inner = add(body, sh.geo, pearlMat); inner.name = 'shell_inner';
    // 殻口の縁(巻いた縁)
    const rimCurve = new THREE.CatmullRomCurve3(sh.rim, true, 'centripetal');
    add(body, new THREE.TubeGeometry(rimCurve, 160, 4.6, 10, true), lipMat).name = 'lip';

    // 環(殻の腹側に隠す)
    const st = bellyStats(sh.pos, 420);
    const ring = Object.assign({ cx: 0, cz: -60, ax: 165, az: 185, y: 395 }, (typeof window !== 'undefined' && window.__RING) || {});
    g.userData.debug = { st, ring, fit: SHELL_FIT };
    const ellipse = (ax, az, y, n) => { const a = []; for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI; a.push(new THREE.Vector3(ring.cx + ax * Math.sin(t), y, ring.cz + az * Math.cos(t))); } return new THREE.CatmullRomCurve3(a, true); };
    const ringM = add(body, new THREE.TubeGeometry(ellipse(ring.ax, ring.az, ring.y, 96), 160, 9, 10, true), legMat2); ringM.name = 'ring';
    add(body, new THREE.TubeGeometry(ellipse(ring.ax + 4, ring.az + 4, ring.y + 17, 96), 160, 3.6, 8, true), jointMat).name = 'rib_up';
    add(body, new THREE.TubeGeometry(ellipse(ring.ax + 4, ring.az + 4, ring.y - 17, 96), 160, 3.6, 8, true), jointMat).name = 'rib_low';
    add(body, new THREE.TubeGeometry(ellipse(ring.ax - 8, ring.az - 8, ring.y, 96), 160, 4.2, 8, true), jointMat).name = 'rib_in';

    // 脚
    const FX = 475, FZ = 600, KNEE_Y = 695;
    const legs = [], feet = [];
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) * Math.PI / 4;
      const hipPos = new THREE.Vector3(ring.cx + ring.ax * Math.sin(t), ring.y, ring.cz + ring.az * Math.cos(t));
      const foot = new THREE.Vector3(FX * Math.sin(t), 0, 15 + FZ * Math.cos(t));
      const d = Math.hypot(foot.x - hipPos.x, foot.z - hipPos.z);
      const kx = 0.62 * d + 40, ky = KNEE_Y - hipPos.y;
      const L1 = Math.hypot(kx, ky), L2 = Math.hypot(d - kx, KNEE_Y);
      const hip = new THREE.Object3D(); hip.position.copy(hipPos); body.add(hip);
      const femur = new THREE.Object3D(); hip.add(femur);
      const knee = new THREE.Object3D(); knee.position.set(0, 0, L1); femur.add(knee);
      const m1 = add(femur, boneGeo(6.5, 13, L1, 8), legMat); m1.userData.seg = 1; m1.userData.leg = i;
      const m2 = add(knee, boneGeo(2.5, 6.5, L2, 10), legMat); m2.userData.seg = 2; m2.userData.leg = i;
      add(hip, new THREE.SphereGeometry(18, 16, 12), jointMat);
      add(femur, collarGeo(), legMat2);
      add(knee, new THREE.SphereGeometry(8.6, 16, 12), jointMat);
      const fb = add(knee, new THREE.SphereGeometry(3.1, 12, 10), jointMat); fb.position.set(0, 0, L2 - 3.4);
      legs.push({ hip, femur, knee, L1, L2, foot }); feet.push(foot);
    }
    g.updateMatrixWorld(true);
    for (const L of legs) solveLeg(L, L.foot);
    // 足先の最下点が y=0 になるよう、立ち姿勢の目標をわずかに持ち上げて解き直す
    {
      const v = new THREE.Vector3(); let low = 1e9;
      g.updateMatrixWorld(true);
      for (const L of legs) L.knee.children.forEach(m => { if (!m.isMesh || m.userData.seg !== 2 && m.geometry.type !== 'SphereGeometry') return; const a = m.geometry.attributes.position; for (let q = 0; q < a.count; q++) { v.fromBufferAttribute(a, q).applyMatrix4(m.matrixWorld); if (v.y < low) low = v.y; } });
      for (const L of legs) { const tg = L.foot.clone(); tg.y = -low; solveLeg(L, tg); }
    }
    g.userData.legs = legs;
    g.userData.info = { name: 'sculpt_d 巻貝', ring, kneeY: KNEE_Y };
    g.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
    return g;
  };
})();
