// 画面: 場面・カメラ・操作・右の表示(付け根の曲げの棒 / 上から見た支え)
(function () {
  const D = window.DEFS;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Q = new URLSearchParams(location.search);
  const shot = Q.has('shot');                        // 撮影用: ?shot&t=秒&bend=1&ik=1

  const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(innerWidth, innerHeight);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('view').appendChild(R.domElement);
  const S = new THREE.Scene(); S.background = new THREE.Color(D.sky); S.fog = new THREE.Fog(D.sky, 4000, 14000);

  S.add(new THREE.HemisphereLight(0xfff6e8, 0x4a4038, 0.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -1300, right: 1300, top: 1300, bottom: -1300, near: 10, far: 6000 });
  sun.shadow.bias = -0.0005; S.add(sun, sun.target);
  const fill = new THREE.PointLight(0xffe2b8, 0.3, 8000); S.add(fill);

  // 地面: 石畳(手続き的テクスチャ)
  (function ground() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    const base = new THREE.Color(D.ground);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const k = 0.9 + 0.2 * Math.random();
      x.fillStyle = `rgb(${base.r * 255 * k | 0},${base.g * 255 * k | 0},${base.b * 255 * k | 0})`;
      x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
    x.globalAlpha = 0.06;
    for (let k = 0; k < 4000; k++) { x.fillStyle = Math.random() < 0.5 ? '#000' : '#fff'; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60);
    t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.position.set(D.pathRadius, 0, 0); m.receiveShadow = true; S.add(m);
  })();

  const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 10, 30000);
  const oc = new THREE.OrbitControls(cam, R.domElement);
  oc.maxPolarAngle = Math.PI * 0.495; oc.enableDamping = true;

  // --- 彫刻(脚の種類を切り替えられる) ---
  const variants = Object.keys(window.MODELS).filter(k => k.startsWith('sculpt_c_'));
  let vi = Math.max(0, variants.indexOf(Q.get('model') || D.model));
  if (!variants.length) variants.push(D.model);
  let model, walker, bend, ikLines = null, showIK = Q.get('ik') === '1';

  function load(name) {
    const wasOn = bend ? bend.on : Q.get('bend') === '1';
    if (model) { S.remove(model); if (ikLines) S.remove(ikLines); }
    model = window.MODELS[name](); CURVE.curveLegs(model); S.add(model);
    walker = GAIT.createWalker(model);
    bend = BEND.createBend(walker); bend.setOn(wasOn);
    buildIK();
    document.getElementById('variant').textContent = name.replace('sculpt_c_', '') + `(V で切替 ${variants.length}種)`;
    document.getElementById('gait').textContent = `${walker.n}本 / ${walker.gait.name}`;
    buildBars();
  }

  // IK の三角形(付け根・膝・足先)を線で見せる
  function buildIK() {
    ikLines = new THREE.Group(); ikLines.visible = showIK; S.add(ikLines);
    for (const L of walker.legs) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(28, 36, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, depthTest: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; line.renderOrder = ring.renderOrder = 10;
      ikLines.add(line, ring); L.vis = { line, ring };
    }
  }
  const tmp = V(0, 0, 0);
  function updateIK() {
    if (!showIK) return;
    for (const L of walker.legs) {
      const p = L.vis.line.geometry.attributes.position;
      const hip = L.leg.hip.getWorldPosition(tmp).clone(), knee = L.leg.knee.getWorldPosition(V(0, 0, 0));
      [hip, knee, L.foot, hip].forEach((v, k) => p.setXYZ(k, v.x, v.y, v.z)); p.needsUpdate = true;
      L.vis.ring.visible = !L.stance; L.vis.ring.position.set(L.to.x, 2, L.to.z);
    }
  }

  // --- 右の表示 ---
  const bars = document.getElementById('bars');
  function buildBars() {
    bars.innerHTML = walker.legs.map((L, i) => `<div class="bar"><span>脚${i + 1}</span><i><b id="b${i}"></b></i><em id="v${i}"></em></div>`).join('');
    const g = document.getElementById('legend'), c = [0, 0.5, 1].map(t => { const o = [0, 0, 0]; bend.ramp(t, o, 0); return `rgb(${o.map(v => v * 255 | 0)})`; });
    g.style.background = `linear-gradient(90deg,${c.join(',')})`;
    document.getElementById('mref').textContent = `${Math.round(bend.Mref)} kN·m`;
    document.getElementById('mass').textContent = `${D.massTon} t(${Math.round(bend.Wt)} kN)`;
  }
  const rgb = [0, 0, 0];
  function updateBars() {
    let smax = 0;
    walker.legs.forEach((L, i) => {
      const M = bend.Mroot[i] || 0; bend.ramp(M / bend.Mref, rgb, 0);
      const b = document.getElementById('b' + i);
      b.style.width = Math.min(100, M / bend.Mref * 100) + '%'; b.style.background = `rgb(${rgb.map(v => v * 255 | 0)})`;
      document.getElementById('v' + i).textContent = L.stance ? `${Math.round(M)} kN·m` : '浮き';
      smax = Math.max(smax, bend.sigma[i] || 0);
    });
    const r = bend.legs[0].rRoot;
    document.getElementById('sigma').textContent = `${smax.toFixed(1)} MPa(付け根 半径 ${Math.round(r)} cm の丸棒とみなす)`;
  }

  // 上から見た支え: 接地した足先の多角形と重心。正面が上
  const mm = document.getElementById('mini'), mx = mm.getContext('2d');
  function updateMini() {
    const W = mm.width, H = mm.height, sc = W / 1700, yaw = model.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
    const com = bend.com, to2 = p => { const dx = p.x - com.x, dz = p.z - com.z; return [W / 2 - (dx * c - dz * s) * sc, H / 2 - (dx * s + dz * c) * sc]; };
    mx.clearRect(0, 0, W, H);
    const pts = walker.legs.map(L => ({ p: to2(L.foot), L }));
    const st = pts.filter(o => o.L.stance && o.L.load > 0.01).map(o => o.p);
    const hull = convexHull(st);
    if (hull.length > 2) {
      mx.beginPath(); hull.forEach((p, k) => k ? mx.lineTo(...p) : mx.moveTo(...p)); mx.closePath();
      mx.fillStyle = 'rgba(232,170,80,.18)'; mx.fill(); mx.strokeStyle = 'rgba(232,170,80,.8)'; mx.lineWidth = 2; mx.stroke();
    }
    pts.forEach(({ p, L }, i) => {
      mx.beginPath(); mx.arc(p[0], p[1], 11, 0, 7);
      if (L.stance) { mx.fillStyle = '#e8aa50'; mx.fill(); } else { mx.strokeStyle = '#9a958c'; mx.lineWidth = 2; mx.stroke(); }
      mx.fillStyle = '#d9d4ca'; mx.font = '20px sans-serif'; mx.fillText(i + 1, p[0] + 14, p[1] + 7);
    });
    mx.fillStyle = '#fff'; mx.beginPath(); mx.arc(W / 2, H / 2, 7, 0, 7); mx.fill();
    const m = hull.length > 2 ? margin(hull, [W / 2, H / 2]) / sc : 0;
    document.getElementById('margin').textContent = `重心から支えの縁まで ${Math.round(m)} cm`;
  }
  function convexHull(P) {
    if (P.length < 3) return P;
    const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function margin(h, c) {   // 多角形の辺までの最短距離(外なら負)
    let m = Infinity;
    for (let k = 0; k < h.length; k++) {
      const a = h[k], b = h[(k + 1) % h.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey);
      m = Math.min(m, ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / l * -1);
    }
    return m;
  }

  // --- 操作 ---
  addEventListener('keydown', e => {
    if (e.code === 'Space') { walker.paused = !walker.paused; e.preventDefault(); }
    if (e.key === 'm' || e.key === 'M') bend.setOn(!bend.on);
    if (e.key === 'i' || e.key === 'I') { showIK = !showIK; ikLines.visible = showIK; }
    if (e.key === 'v' || e.key === 'V') { vi = (vi + 1) % variants.length; load(variants[vi]); }
    if (e.key === 'ArrowUp') walker.speed = Math.min(120, walker.speed + 10);
    if (e.key === 'ArrowDown') walker.speed = Math.max(0, walker.speed - 10);
  });
  addEventListener('resize', () => { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });

  load(variants[vi]);
  const center = V(0, 0, 0), last = V(0, 0, 0);
  function frame(dt) {
    walker.update(dt); bend.update(); updateIK();
    model.getWorldPosition(center); center.y = 450;
    cam.position.add(tmp.copy(center).sub(last)); oc.target.copy(center); last.copy(center);
    sun.position.set(center.x + 1400, 2600, center.z + 900); sun.target.position.copy(center);
    fill.position.set(center.x - 1400, 800, center.z + 1400);
  }
  // 初期カメラ
  frame(0); cam.position.set(center.x + 1500, 1500, center.z + 1900); oc.update();
  if (Q.get('cam')) { const c = Q.get('cam').split(',').map(Number); cam.position.set(center.x + c[0], c[1], center.z + c[2]); oc.update(); }
  if (shot) { const T = Number(Q.get('t') || 1.3); for (let k = 0; k < 60; k++) frame(T / 60); oc.update(); }
  let prev = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, ((now || prev) - prev) / 1000); prev = now || prev;
    if (!shot) frame(dt);
    oc.update(); updateBars(); updateMini(); R.render(S, cam); requestAnimationFrame(loop);
  })();
})();
