// render3d: 動くもの(店員・ゾンビ・店長・荷物・視界)を3Dで描く(updateDyn)と、毎フレームの draw。文字・輪は labels3d.js
const dyn = new THREE.Group(); scene.add(dyn);
const facing = a => Math.PI / 2 - a;              // 2Dの向き角 → モデルの回転(モデルの正面は +Z)
function holder() { const g = new THREE.Group(); g.scale.setScalar(CM); dyn.add(g); return g; }

// ---- モップ(上端を -Z に傾ける。手持ちは前に、立てかけは壁側に向ける) ----
function mopObj() {
  const g = new THREE.Group();
  const st = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 120, 6), mat('#8a6a3a')); st.position.set(0, 60, -13.7); st.rotation.x = -0.23; g.add(st);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(100, 5, 16), mat('#9fc3e0')); hd.position.y = 2.5; hd.castShadow = true; g.add(hd);
  return g;
}
const mopG = holder(); mopG.add(mopObj());
const dirtGeo = new THREE.PlaneGeometry(0.92, 0.92), dirtMat = new THREE.MeshBasicMaterial({ color: 0x5a7fa8, transparent: true, opacity: 0.55 });

// ---- 荷物 ----
function carryObj(c) {
  const g = new THREE.Group();
  if (c.kind == 'crate') { const m = c.cart ? MODELS.container('#f2c230') : MODELS.crate(DEPTS[c.dept].color); if (c.cart) m.scale.setScalar(1.5); g.add(m); }
  else if (c.kind == 'bag') lazyGLB(g, 'trash_bag', o => o.scale.multiplyScalar(1.1));
  else if (c.kind == 'mop') g.add(mopObj());
  else if (c.kind == 'delivery') { const m = new THREE.Mesh(new THREE.BoxGeometry(36, 26, 28), mat('#b88c52'));
    m.position.y = 13;
    m.castShadow = true;
    g.add(m);
    }
  else {
    const m = new THREE.Mesh(new THREE.BoxGeometry(26, 18, 18), mat(c.kind == 'frozen' ? '#cfe6f5' : '#e0a030'));
    m.position.y = 9; m.castShadow = true; g.add(m);
  }
  return g;
}

// ---- 店員・店長 ----
// 店長の振る舞いごとの体の動き(跳ねる・傾く・揺れる)。毎フレーム上書きするので、動かない振る舞いは0に戻す
function mgrAnim(m, t) {
  const a = m.act, k = m.actT, u = mgrG.children[0].userData, L = u.armL, R = u.armR; let y = 0, rx = 0, rz = mgrG.rotation.z, hand = [0, 0, 0, 0];   // 手: [左x, 左z, 右x, 右z]の肩の回転
  if (a == 'hop') { const s = Math.abs(Math.sin(t * 8)); y = s * 0.3; hand = [-2.6, 0.3, -2.6, -0.3]; rx = -0.1 * s; }              // 両手を上げて跳ねる
  else if (a == 'dance') { rz = Math.sin(t * 5) * 0.2; y = Math.abs(Math.sin(t * 5)) * 0.1; const w = Math.sin(t * 5); hand = [-2.4 + w * 0.5, 0.5, -2.4 - w * 0.5, -0.5]; }   // 腕を振って揺れる
  else if (a == 'nap') { rx = 0.45 + Math.sin(t * 1.4) * 0.1; rz = Math.sin(t * 0.8) * 0.06; hand = [0.4, 0, 0.4, 0]; if (k < 0.6) { rx = 0; y = 0.08; } }   // うなだれ→はっと起きる
  else if (a == 'count') { rx = 0.3; const f = Math.sin(t * 9) * 0.3; hand = [-0.9 + f, 0.2, -0.9 - f, -0.2]; }   // 手元でお札をめくる
  else if (a == 'stretch') { const e = Math.sin(Math.min(1, (3 - Math.min(3, k)) / 2.5) * Math.PI); y = e * 0.08; rx = -0.35 * e; hand = [-3 * e, 0.4 * e, -3 * e, -0.4 * e]; }   // 両腕を高く伸ばす
  else if (a == 'startle') { const e = Math.min(1, k / 1.2); y = e > 0.8 ? 0.25 : 0; rx = -0.3 * e; hand = [-1.8 * e, 0.8 * e, -1.8 * e, -0.8 * e]; }   // 跳ねて両手を広げる
  else if (a == 'wipe') { rz = Math.sin(t * 8) * 0.05; rx = 0.25; hand = [-1.2 + Math.sin(t * 8) * 0.4, 0, 0, 0]; }   // 片手でカウンターを拭く
  else if (a == 'hum') { rz = Math.sin(t * 3) * 0.14; hand = [Math.sin(t * 3) * 0.5, 0.2, -Math.sin(t * 3) * 0.5, -0.2]; }   // ゆらゆら腕を振る
  else if (a == 'spin') { y = 0.08; hand = [-1.6, 1.2, -1.6, -1.2]; }   // 手を広げてくるくる
  else if (a == 'yawn') { rx = -0.3; hand = [-2.8 * Math.min(1, (4 - Math.min(4, k)) / 0.6), 0, 0, 0]; }   // のけぞって片手を上げる
  else if (a == 'look') hand = [-1.7 + Math.sin(t * 3) * 0.1, 0, 0, 0];   // 手をかざして遠くを見る
  mgrG.position.y = y; mgrG.rotation.x = rx; mgrG.rotation.z = rz;
  if (L) { L.rotation.x = hand[0]; L.rotation.z = -hand[1]; R.rotation.x = hand[2]; R.rotation.z = -hand[3]; }
}
const player = holder(); const clerk = MODELS.clerk(); player.add(clerk);
// 歩きモーション: 進んだ距離で脚と腕を振り、止まると ease で直立に戻る。荷物を持つと腕は構えたまま
const STRIDE = 1.3 / 0.42, walk = { ph: 0, amp: 0 };      // 1周期で進むタイル数
function animateClerk(dist, dt, carrying) {
  const r = clerk.userData.rig, v = dist / Math.max(dt, 1e-3);
  walk.ph += dist / STRIDE * Math.PI * 2;
  walk.amp += ((dist > 0.002 ? Math.min(1, 0.5 + v / 5) : 0) - walk.amp) * Math.min(1, dt * 14);
  const s = Math.sin(walk.ph) * walk.amp;
  r.legs[-1].rotation.x = s * 0.7; r.legs[1].rotation.x = -s * 0.7;
  const k = carrying ? 0 : 0.55;
  r.arms[-1].rotation.x = -s * k; r.arms[1].rotation.x = s * k;
  r.up.rotation.x = walk.amp * 0.08; r.up.rotation.z = Math.cos(walk.ph) * walk.amp * 0.03;
  return Math.abs(Math.cos(walk.ph)) * walk.amp * 0.025;       // 着地ごとの上下
}
let carryG = null, carryOf = null, lastP = { x: 0, y: 0 }, lastT = 0;
const mgrG = holder(); mgrG.add(MODELS.manager());
const broom = new THREE.Group(); {
  const st = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 110, 6), mat('#8a6a3a')); st.position.y = 55; st.rotation.x = 0.35; broom.add(st);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(34, 4, 10), mat('#c9a04a')); hd.position.set(0, 3, 22); broom.add(hd);
  broom.position.set(30, 0, 50); broom.visible = false; mgrG.add(broom);
}

// ---- ゾンビ・視界・床の荷物・汚れ ----
let zMap = new Map(), dropMap = new Map(), spillMap = new Map(), delMap = new Map(), builtFor = null;
function makeCone() {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
  geo.setIndex([...Array(16).keys()].flatMap(i => [0, i + 1, i + 2]));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff096, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; scene.add(m); return m;
}
function sync(map, items, make) {   // items に無くなったものを消し、新しいものを作る
  for (const [k, v] of map) if (!items.includes(k)) { (v.parent || scene).remove(v); if (v.cone) scene.remove(v.cone); map.delete(k); }
  for (const k of items) if (!map.has(k)) map.set(k, make(k));
}
function resetWorld() {
  for (const m of [zMap, dropMap, spillMap, delMap]) { for (const v of m.values()) { (v.parent || scene).remove(v);
    if (v.cone) scene.remove(v.cone);
    } m.clear();
    }
  builtFor = G; wallSig = ''; carryG = null; carryOf = null;
}
function updateCone(m, z) {
  const p = m.geometry.attributes.position, n = 16;
  p.setXYZ(0, z.x, 0.04, z.y);
  for (let i = 0; i <= n; i++) {
    const a = z.dir - z.va + 2 * z.va * i / n, l = rayLen(z.x, z.y, a, z.vd);
    p.setXYZ(i + 1, z.x + Math.cos(a) * l, 0.04, z.y + Math.sin(a) * l);
  }
  p.needsUpdate = true;
  const c = z.state == 'chase' ? [0xff3c28, 0.26] : z.sus > 0.05 ? [0xffa03c, 0.18 + z.sus * 0.12] : [0xfff096, 0.16];
  m.material.color.set(c[0]); m.material.opacity = c[1];
}

function updateDyn() {
  if (G !== builtFor) resetWorld();
  if (!G) { mgrG.position.set(MANAGER.x, 0, MANAGER.y); mgrG.rotation.y = facing(0); return; }
  if (wallSig !== grid[6][SHUT_X]) buildWalls();
  updateStock();
  const p = G.p, t = G.t, dist = Math.hypot(p.x - lastP.x, p.y - lastP.y), dt = t - lastT; lastP = { x: p.x, y: p.y }; lastT = t;
  const bob = dt > 0 && dist < 1 ? animateClerk(dist, dt, !!p.carry) : 0;
  player.position.set(p.x, bob, p.y); player.rotation.y = facing(p.dir);
  if (carryOf !== p.carry) {
    if (carryG) player.remove(carryG);
    carryG = p.carry ? carryObj(p.carry) : null; carryOf = p.carry;
    if (carryG) { carryG.position.set(0, p.carry.kind == 'mop' ? 0 : 90, p.carry.kind == 'mop' ? 60 : 42); player.add(carryG); }
  }
  const m = G.mgr;
  mgrG.position.set(m.x, 0, m.y); mgrG.rotation.y = facing(m.dir); mgrG.rotation.z = Math.sin((m.phase || t * 0.5) * 4) * 0.03; mgrAnim(m, t);
  broom.visible = m.act == 'sweep' && m.mode == 'idle'; broom.position.x = 30 + Math.sin(t * 6) * 12;
  sync(zMap, G.zs, z => {
    const g = holder(); g.add(MODELS.zombie({ skin: z.skin, shirt: z.shirt })); g.cone = makeCone(); return g;
  });
  for (const [z, g] of zMap) {
    g.position.set(z.x, Math.abs(Math.sin(z.t * 4 + z.wobble)) * 0.015, z.y);
      g.rotation.y = facing(z.dir);
      g.rotation.z = Math.sin(z.t * 3 + z.wobble) * 0.05;
      if (z.sc > 1) g.scale.set(CM * z.sc * 2.5, CM * z.sc, CM * z.sc * 1.6);;
    updateCone(g.cone, z);
  }
  sync(dropMap, G.drops, d => { const g = holder(); g.add(carryObj(d.carry)); return g; });
  for (const [d, g] of dropMap) g.position.set(d.x, 0, d.y);
  sync(delMap, G.dels, d => { const g = holder(); g.add(carryObj({ kind: 'delivery' })); return g; });
  for (const [d, g] of delMap) g.position.set(d.x, 0, d.y);
  sync(spillMap, G.jobs.filter(j => j.kind == 'spill').flatMap(j => [...j.dirty.values()]), v => {
    const s = new THREE.Mesh(dirtGeo, dirtMat); s.rotation.x = -Math.PI / 2; s.position.set(v.x, 0.03, v.y); scene.add(s); return s;
  });
  const mp = G.mop, stf = G.zs.find(z => z.kind == 'staff');
  mopG.visible = mp.st == 'lean' || (mp.st == 'staff' && !!stf);
  if (mp.st == 'staff' && stf) { mopG.position.set(stf.x + Math.cos(stf.dir) * 0.6, 0, stf.y + Math.sin(stf.dir) * 0.6); mopG.rotation.y = facing(stf.dir); }
  else if (mopG.visible) { mopG.position.set(mp.x + 0.5 + mp.sx * 0.78, 0, mp.y + 0.5 + mp.sy * 0.78); mopG.rotation.y = Math.atan2(mp.sx, mp.sy); }
}

function draw() {
  updateDyn(); flushGLB();
  R3.render(scene, cam3);
  cx.setTransform(RES, 0, 0, RES, 0, 0);   // 以降は論理サイズ(CW×CH)で描く
  cx.fillStyle = '#111'; cx.fillRect(0, 0, CW, CH);
  cx.drawImage(R3.domElement, 0, HUD, GLW, GLH);
  overlays();
  if (!G) return;
  const chased = G.zs.some(z => z.state == 'chase');
  if (chased || G.flash > 0) {
    const a = G.flash > 0 ? G.flash * 0.6 : 0.25 + 0.15 * Math.sin(G.t * 10);
    const gr = cx.createRadialGradient(CW / 2, HUD + GLH / 2, GLH * 0.35, CW / 2, HUD + GLH / 2, GLW * 0.62);
    gr.addColorStop(0, 'rgba(200,0,0,0)'); gr.addColorStop(1, `rgba(200,0,0,${a})`);
    cx.fillStyle = gr; cx.fillRect(0, HUD, GLW, GLH);
  }
  drawTut(); drawHUD(); drawToasts();
  if (mode == 'pause') {
    cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(0, 0, CW, CH);
    cx.fillStyle = '#fff'; cx.font = 'bold 32px sans-serif'; cx.textAlign = 'center'; cx.fillText('一時停止 (P)', CW / 2, CH / 2);
  }
}
