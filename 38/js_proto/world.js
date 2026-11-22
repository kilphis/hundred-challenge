// 見た目の組み立て(川・岸・木・岩・筏・ゴール)。動きは game.js。
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe0f0);
scene.fog = new THREE.Fog(0xbfe0f0, 60, 190);
scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x4a5a3a, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d8, 0.9);
sun.position.set(-40, 60, 30);
scene.add(sun);

const tmp = {};
const STEP = 4, END = D.LENGTH + 80;
const rows = Math.ceil(END / STEP) + 1;

function strip(cols, vertexFn, colorFn, uvFn, flip) {
  const pos = [], col = [], uv = [], idx = [];
  for (let i = 0; i < rows; i++) {
    const s = i * STEP;
    for (let j = 0; j <= cols; j++) {
      const v = vertexFn(s, j / cols); pos.push(v[0], v[1], v[2]);
      const c = colorFn(s, j / cols); col.push(c[0], c[1], c[2]);
      const t = uvFn ? uvFn(s, j / cols) : [0, 0]; uv.push(t[0], t[1]);
      if (i < rows - 1 && j < cols) { const a = i * (cols + 1) + j, b = a + cols + 1; if (flip) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// --- 水面(流れが見えるよう筋模様をスクロールさせる) ---
function waterTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 256);
  let a = 7; const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 128, y = rnd() * 256, l = 20 + rnd() * 50;
    g.strokeStyle = `rgba(120,170,190,${0.35 + rnd() * 0.4})`; g.lineWidth = 2 + rnd() * 3;
    for (const oy of [0, -256, 256]) { g.beginPath(); g.moveTo(x, y + oy); g.lineTo(x + (rnd() - .5) * 6, y + oy + l); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const waterTex = waterTexture();
const waterGeo = strip(10,
  (s, u) => { const hw = D.halfW(s) + 1.2; D.frame(s, (u * 2 - 1) * hw, tmp); return [tmp.x, 0, tmp.z]; },
  (s, u) => {
    const edge = Math.abs(u * 2 - 1), r = D.rapidness(s);
    const k = Math.pow(edge, 3), w = 0.35 * r;
    return [0.1 + 0.3 * k + w, 0.34 + 0.25 * k + w, 0.5 + 0.12 * k + w * 0.8];
  },
  (s, u) => [u * 2, s / 24]);
scene.add(new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({ map: waterTex, vertexColors: true, color: 0xb4c8d4 })));

// --- 岸 ---
function bank(side) {
  const COLS = 12, E = 60;
  return strip(COLS,
    (s, u) => { const e = u * E, hw = D.halfW(s) + 1.0; D.frame(s, side * (hw + e), tmp); return [tmp.x, D.bankH(s, e, side), tmp.z]; },
    (s, u) => {
      const e = u * E;
      if (e < 2.5) return [0.78, 0.7, 0.5];
      const m = Math.min(1, (e - 2.5) / 8);
      return [0.78 + (0.3 - 0.78) * m, 0.7 + (0.5 - 0.7) * m, 0.5 + (0.22 - 0.5) * m];
    }, null, side > 0);
}
const bankMat = new THREE.MeshLambertMaterial({ vertexColors: true });
scene.add(new THREE.Mesh(bank(-1), bankMat), new THREE.Mesh(bank(1), bankMat));

// --- 木 ---
(function () {
  let a = 99; const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  const N = 900;
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 6, 7), new THREE.MeshLambertMaterial({ color: 0x2f6a3a }), N);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), new THREE.MeshLambertMaterial({ color: 0x5b4130 }), N);
  const m = new THREE.Matrix4();
  for (let i = 0; i < N; i++) {
    const s = rnd() * END, side = rnd() < 0.5 ? -1 : 1, e = 4 + rnd() * 50;
    D.frame(s, side * (D.halfW(s) + 1.0 + e), tmp);
    const y = D.bankH(s, e, side), k = 0.7 + rnd() * 0.9;
    m.makeScale(k, k, k).setPosition(tmp.x, y + 1.6 * k + 3 * k, tmp.z); crown.setMatrixAt(i, m);
    m.makeScale(k, k, k).setPosition(tmp.x, y + 0.8 * k, tmp.z); trunk.setMatrixAt(i, m);
  }
  scene.add(crown, trunk);
})();

// --- 岩と泡 ---
const foams = [];
(function () {
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a8c90, flatShading: true });
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  for (const r of D.rocks) {
    D.frame(r.s, r.d, tmp);
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r.r, 0), mat);
    m.scale.set(1, 0.8 + r.seed * 0.5, 1); m.position.set(tmp.x, r.r * 0.25, tmp.z); m.rotation.y = r.seed * 6;
    scene.add(m);
    const f = new THREE.Mesh(new THREE.RingGeometry(r.r * 1.0, r.r * 1.5, 20), foamMat);
    f.rotation.x = -Math.PI / 2; f.position.set(tmp.x, 0.04, tmp.z); f.userData.r = r;
    scene.add(f); foams.push(f);
  }
})();

// --- ゴール(上流から見て手前に門、先に桟橋) ---
(function () {
  const s = D.LENGTH, hw = D.halfW(s) + 1.2;
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a5a36 });
  const banner = new THREE.MeshLambertMaterial({ color: 0xd9402f });
  for (const side of [-1, 1]) {
    D.frame(s, side * hw, tmp);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7, 0.8), wood); p.position.set(tmp.x, 3.4, tmp.z); scene.add(p);
  }
  D.frame(s, 0, tmp);
  const b = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 1.2, 0.3), banner);
  b.position.set(tmp.x, 6.4, tmp.z); b.rotation.y = tmp.heading; scene.add(b);
})();

// --- 筏 ---
const raft = new THREE.Group();
const paddle = new THREE.Group();
(function () {
  const logMat = new THREE.MeshLambertMaterial({ color: 0xa9784a });
  const rope = new THREE.MeshLambertMaterial({ color: 0x5a4630 });
  for (let i = -3; i <= 3; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 4.6, 8), logMat);
    l.rotation.x = Math.PI / 2; l.position.set(i * 0.4, 0.05, 0); raft.add(l);
  }
  for (const z of [-1.4, 1.4]) { const r = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.25), rope); r.position.set(0, 0.34, z); raft.add(r); }
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0x3b6fb0 }));
  body.position.set(0, 0.95, 0.5); raft.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf0c9a0 }));
  head.position.set(0, 1.78, 0.5); raft.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 10), new THREE.MeshLambertMaterial({ color: 0xe0b84a }));
  hat.position.set(0, 2.1, 0.5); raft.add(hat);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), wood0());
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.06), wood0()); blade.position.y = -1.3;
  paddle.add(shaft, blade); paddle.position.set(0.5, 1.2, 0.5); raft.add(paddle);
  function wood0() { return new THREE.MeshLambertMaterial({ color: 0x6b4a2b }); }
})();
scene.add(raft);
