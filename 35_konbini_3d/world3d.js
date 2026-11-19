// world3d: 3Dの静的な店(床・壁・什器・棚と在庫の見た目)。1タイル=1、モデルは cm なので CM を掛ける。Gは読むだけ
const CM = 0.01;
const GLW = W * TS, GLH = H * TS;
const R3 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R3.setPixelRatio(RES); R3.setSize(GLW, GLH); R3.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x15181a);
const cam3 = new THREE.PerspectiveCamera(32, GLW / GLH, 0.5, 200);
const VIEWS = [{ pitch: 64, dist: 36 }, { pitch: 70, dist: 35 }, { pitch: 38, dist: 30 }];   // C キーで切替(真上寄り / 斜め)
let viewIdx = 0;
function placeCam() {
  const v = VIEWS[viewIdx], a = v.pitch * Math.PI / 180;
  cam3.position.set(13, Math.sin(a) * v.dist, 10.4 + Math.cos(a) * v.dist); cam3.lookAt(13, 0, 10.4); cam3.updateMatrixWorld();
}
placeCam();
scene.add(new THREE.HemisphereLight(0xfff6e8, 0x4a4038, 0.4));
const sun = new THREE.DirectionalLight(0xfff1dc, 0.6);
sun.position.set(6, 30, 24); sun.target.position.set(13, 0, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 16, bottom: -16, near: 1, far: 80 });
scene.add(sun, sun.target);

// ---- 小道具 ----
const matCache = {};
const mat = (c, o = {}) => matCache[c + JSON.stringify(o)] || (matCache[c + JSON.stringify(o)] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o)));
function box(parent, w, h, d, c, x, y, z, o) {   // 底面 y の位置に置く箱(タイル単位)
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)); m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function put3(parent, name, args, x, y, z, rotY, s) {   // モデルを cm→タイル に縮めて置く。s=[sx,sy,sz] でモデル軸方向に伸縮
  const w = new THREE.Group(); w.add(MODELS[name].apply(null, args || []));
  w.scale.set(CM * (s ? s[0] : 1), CM * (s ? s[1] : 1), CM * (s ? s[2] : 1)); w.position.set(x, y, z); w.rotation.y = rotY || 0;
  parent.add(w); return w;
}
// Polyfork の GLB は非同期で中身が入る。読み込めたらクローンを holder に入れる
const protos = {}, pendings = [];
function lazyGLB(holder, name, setup) { pendings.push({ holder, name, setup }); }
function flushGLB() {
  for (let i = pendings.length - 1; i >= 0; i--) {
    const p = pendings[i], pr = protos[p.name] || (protos[p.name] = MODELS[p.name]());
    if (!pr.userData.ready) continue;
    const c = pr.clone(); if (p.setup) p.setup(c); p.holder.add(c); pendings.splice(i, 1);
  }
}

// ---- 床 ----
(function buildFloor() {
  const c = document.createElement('canvas'), P = 32; c.width = W * P; c.height = H * P;
  const g = c.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (x + y) % 2;
    g.fillStyle = inBackyard(x, y) ? (o ? COL.back : COL.back2) : inAlley(x, y) ? (o ? COL.alley : COL.alley2) : (o ? COL.floor1 : COL.floor2);
    g.fillRect(x * P, y * P, P, P);
    const t = tile(x, y);
    if (t == 'd' || t == 'b') { g.fillStyle = '#7c6a52'; g.fillRect(x * P, y * P, P, P); }
  }
  const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2; m.position.set(W / 2, 0, H / 2); m.receiveShadow = true; scene.add(m);
})();

// ---- 壁(シャッターで変わるので作り直せる) ----
const wallGroup = new THREE.Group(); scene.add(wallGroup);
let wallSig = '';
function buildWalls() {
  wallSig = grid[6][SHUT_X];
  while (wallGroup.children.length) wallGroup.remove(wallGroup.children[0]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tile(x, y);
    if (c == '#') {
      const sh = x == SHUT_X && y >= 6 && y <= 18;
      box(wallGroup, 1, 0.8, 1, sh ? '#8a8f94' : COL.wall, x + 0.5, 0, y + 0.5);
    } else if (c == 'E') box(wallGroup, 1, 0.8, 0.12, '#9cc8d8', x + 0.5, 0, y + 0.94, { transparent: true, opacity: 0.45 });
  }
}

// ---- ゴミ箱の中身(G.trash 個の袋が2つの口に積まれ、満杯であふれる)。単位は cm(ゴミ箱モデルの座標) ----
const trashBags = [];
let trashSpill = null, trashWarn = null;
function buildTrashFill(bin) {
  const cols = ['#e9e6da', '#4f86bd', '#d9d2b8', '#6aa06a', '#e9e6da', '#4f86bd'];
  const spots = [[-8, 51, 0], [8, 51, 0], [0, 58, 0]];   // 口の中での位置 x(口の中心から)・y・z
  for (let i = 0; i < TRASH_MAX; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), sp = spots[k];
    const m = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 9), mat(cols[i], { roughness: 0.35 }));
    m.scale.set(1.15, 0.8, 0.95); m.position.set(side * 22.5 + sp[0] * (k == 2 ? 1 : 0.9), sp[1] - (k == 2 ? 0 : 1), sp[2]);
    m.rotation.y = i * 0.9; m.castShadow = true; m.visible = false; bin.add(m); trashBags.push(m);
  }
  trashSpill = new THREE.Group(); trashSpill.visible = false; bin.add(trashSpill);
  trashWarn = new THREE.Mesh(new THREE.CircleGeometry(75, 32), new THREE.MeshBasicMaterial({ color: 0xff3322, transparent: true, opacity: 0.3, depthWrite: false }));
  trashWarn.rotation.x = -Math.PI / 2; trashWarn.position.set(0, 0.5, 20); trashWarn.visible = false; bin.add(trashWarn);   // 満杯の警告(足もとの赤い輪)   // あふれた袋(前の床に落ちる)
  [[-30, 8, 34, '#e9e6da'], [-10, 7, 42, '#4f86bd'], [14, 8, 38, '#d9d2b8']].forEach(([x, y, z, c], j) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 9), mat(c, { roughness: 0.35 }));
    m.scale.set(1.2, 0.75, 1); m.position.set(x, y, z); m.rotation.y = j; m.castShadow = true; trashSpill.add(m);
  });
}
function updateTrash() {
  const n = G.trash, full = n >= TRASH_MAX;
  trashBags.forEach((m, i) => {
    m.visible = i < n;
    m.scale.y = full ? 0.95 : 0.8;   // 満杯は袋がぱんぱんに盛り上がる
  });
  if (trashSpill) trashSpill.visible = full;
  if (trashWarn) { trashWarn.visible = full; trashWarn.material.opacity = 0.2 + 0.15 * Math.sin(G.t * 5); }
}

// ---- 什器 ----
(function buildFixtures() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tile(x, y), cx0 = x + 0.5, cz0 = y + 0.5;
    if (DEPTS[c]) {
      put3(scene, 'stock_rack', null, cx0, 0, y + 0.32, 0);
      put3(scene, 'crate', [DEPTS[c].color], cx0, 1.8, y + 0.32, 0);
    } else if (c == 'F') put3(scene, 'freezer', null, cx0, 0, y + 0.4, 0);
    else if (c == 'C') put3(scene, 'container', ['#f2c230'], cx0, 0, cz0, 0, [1.5, 1.5, 1.5]);
    else if (c == 'T') buildTrashFill(put3(scene, 'trash_bin', null, cx0, 0, cz0 - 0.1, Math.PI));
  }
  box(scene, 2, 0.9, 0.8, '#2f5a3a', 24, 0, 1.5);
  box(scene, 1, 0.9, 0.9, '#c9b48a', 11.5, 0, 3.5);   // 検品台
  box(scene, 0.8, 0.5, 0.8, '#f2f2f2', 24.5, 0, 17.5); box(scene, 0.8, 1.0, 0.25, '#f2f2f2', 24.5, 0, 17.9);   // トイレ   // ゴミ集積所
  // レジ側のカウンター(客側 +x に向ける)
  put3(scene, 'register_counter', null, 2.5, 0, 10.0, Math.PI / 2, [200 / 184, 1, 1.35]);
  put3(scene, 'register_counter', null, 2.5, 0, 13.0, Math.PI / 2, [200 / 184, 1, 1.35]);
  box(scene, 1, 0.85, 1, '#a8a39a', 2.5, 0, 8.5);   // フライヤー台
  put3(scene, 'fryer', null, 2.5, 0.85, 8.5, Math.PI / 2);
  box(scene, 1, 0.85, 1, '#a8a39a', 2.5, 0, 11.5);   // ホットケース台
  put3(scene, 'hot_case', null, 2.5, 0.85, 11.5, Math.PI / 2, [1.0, 1, 1.5]);
})();

// ---- 売り場の棚(区画ごと): ゴンドラ + 在庫 ----
// 棚の上に立てる大きな商品アイコン(GLB の倍率は元の大きさ→約150cm になる値)
// 名前 -> [モデル, 倍率, 向き(90度単位)]
const ITEM_GLB = { 'パン': ['bread', 3.6, 1], 'チョコ': ['chocolate', 9, 1], 'ヨーグルト': ['cup_takeaway', 10, 0], 'コーヒー': ['cup_coffee', 8.4, 0], '洗剤': ['bottle_potion', 4.2, 0] };
const SHELF_H = 1.4, TOP = 148 * SHELF_H + 2;   // 頭(約170cm)より高い棚。天板の高さ(cm)
const secViews = SECTIONS.map(s => {
  const len = s.tiles.length, L = len * 100, t0 = s.tiles[0], cy = (t0[1] + t0[1] + len) / 2;
  const sg = new THREE.Group(); sg.scale.setScalar(CM); sg.position.set(t0[0] + 0.5, 0, cy); sg.rotation.y = s.face < 0 ? -Math.PI / 2 : Math.PI / 2;
  scene.add(sg);
  const n = Math.max(1, Math.round(L / 180)), seg = L / n;
  for (let k = 0; k < n; k++) {
    const w = new THREE.Group(); w.add(MODELS.gondola()); w.scale.set(seg / 180, SHELF_H, 1.9); w.position.x = -L / 2 + seg * (k + 0.5); sg.add(w);
  }
  const empty = mat('#3a3027'), full = mat(s.color, { emissive: s.color, emissiveIntensity: 0.25 });
  // ブロックごとに在庫の帯(TILE_MAX 個)。色あり=在庫あり。空いた所がそのまま「補充する隙間」になる
  const blocks = s.tiles.map(([bx, by], t) => {
    const li = s.face < 0 ? t : len - 1 - t, slots = [];   // 棚グループの x 軸は、向きによって y と逆向きになる
    for (let c = 0; c < TILE_MAX; c++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(100 / TILE_MAX - 6, 8, 94), full);
      m.position.set(-L / 2 + li * 100 + (c + 0.5) * 100 / TILE_MAX, TOP + 4, 0); sg.add(m); slots.push(m);
    }
    const hi = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.1, 0.96), new THREE.MeshBasicMaterial({ color: 0xff3322, transparent: true, opacity: 0, depthWrite: false }));
    hi.position.set(bx + 0.5, 1.05, by + 0.5); scene.add(hi);
    return { k: by * W + bx, slots, hi };
  });
  const ic = new THREE.Group(); ic.position.set(0, TOP + 70, 0); sg.add(ic);
  const g = ITEM_GLB[s.name];
  if (g) lazyGLB(ic, g[0], o => { o.scale.multiplyScalar(g[1]); o.rotation.y += g[2] * Math.PI / 2; });
  else { const m = new THREE.Mesh(new THREE.BoxGeometry(90, 110, 60), mat(s.color)); m.position.y = 55; m.castShadow = true; ic.add(m); }
  return { blocks, full, empty, cx: t0[0] + 0.5, cz: cy };
});
function updateStock() {
  updateTrash();
  SECTIONS.forEach((s, i) => {
    const v = secViews[i], carrying = G.p.carry && G.p.carry.kind == 'crate' && G.p.carry.items[i], on = secOn(i);
    v.blocks.forEach(b => {
      const n = G.ts[b.k];
      b.slots.forEach((h, c) => h.material = c < n ? v.full : v.empty);
      const want = carrying && n < TILE_MAX, hole = n == 0 && on;   // 光るのは、いま補充できるブロックと、空のブロックだけ
      b.hi.visible = !!(want || hole);
      b.hi.material.color.set(want ? 0x33ff66 : 0xff3322);
      b.hi.material.opacity = want ? 0.22 : 0.16 + 0.12 * Math.sin(G.t * 5);
    });
  });
}

// ---- 画面座標への投影(2Dの文字・マーカー用) ----
const _v = new THREE.Vector3();
function proj(x, z, h) { _v.set(x, h || 0, z).project(cam3); return { x: (_v.x * 0.5 + 0.5) * GLW, y: HUD + (-_v.y * 0.5 + 0.5) * GLH }; }
addEventListener('keydown', e => { if (e.code == 'KeyC') { viewIdx = (viewIdx + 1) % VIEWS.length; placeCam(); } });
{ const qv = new URLSearchParams(location.search).get('view'); if (qv) { viewIdx = +qv; placeCam(); } }
