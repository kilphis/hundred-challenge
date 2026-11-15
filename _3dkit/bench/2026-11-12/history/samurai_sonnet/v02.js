// 剣を構えて走る侍 (Three.js r128) -- window.MODELS.samurai
(function () {
  window.MODELS = window.MODELS || {};

  let seed = 7;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  function mkTex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 4;
    return t;
  }
  function weave(x, w, h, base, a1, a2) {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 2) { x.fillStyle = 'rgba(255,255,255,' + (a1 || 0.04) + ')'; x.fillRect(i, 0, 1, h); }
    for (let j = 0; j < h; j += 2) { x.fillStyle = 'rgba(0,0,0,' + (a2 || 0.09) + ')'; x.fillRect(0, j, w, 1); }
    for (let k = 0; k < w * h / 18; k++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1);
    }
  }
  const T = {};
  T.kosode = mkTex(256, 256, (x, w, h) => {
    weave(x, w, h, '#25334d');
    x.fillStyle = 'rgba(190,202,220,0.20)';
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      x.beginPath(); x.arc(i * 16 + (j % 2 ? 8 : 0) + 4, j * 16 + 4, 1.3, 0, 7); x.fill();
    }
    for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(10,15,30,0.08)'; x.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 40, 2); }
  }, 2, 2);
  T.hakama = mkTex(512, 256, (x, w, h) => {
    weave(x, w, h, '#3b3a44', 0.05, 0.08);
    for (let i = 0; i < w; i += 16) {
      x.fillStyle = (i / 16) % 3 === 0 ? 'rgba(20,20,28,0.30)' : 'rgba(80,80,95,0.10)';
      x.fillRect(i, 0, 5, h);
    }
    for (let p = 0; p < 8; p++) {
      const g = x.createLinearGradient(p * 64, 0, p * 64 + 40, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(p * 64, 0, 40, h);
      const g2 = x.createLinearGradient(p * 64 + 40, 0, p * 64 + 64, 0);
      g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(1, 'rgba(255,255,255,0.08)');
      x.fillStyle = g2; x.fillRect(p * 64 + 40, 0, 24, h);
    }
  }, 2, 1);
  T.obi = mkTex(256, 128, (x, w, h) => {
    weave(x, w, h, '#2b2320', 0.06, 0.10);
    x.strokeStyle = 'rgba(150,120,90,0.12)'; x.lineWidth = 1;
    for (let i = -h; i < w; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); }
  }, 3, 1);
  T.gaiter = mkTex(128, 128, (x, w, h) => weave(x, w, h, '#7a8294', 0.05, 0.10), 2, 2);
  T.straw = mkTex(128, 128, (x, w, h) => {
    x.fillStyle = '#a68a52'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < h; i += 3) {
      x.fillStyle = (i / 3) % 2 ? 'rgba(60,40,10,0.35)' : 'rgba(255,230,160,0.18)'; x.fillRect(0, i, w, 2);
    }
    for (let k = 0; k < 500; k++) { x.fillStyle = 'rgba(70,50,20,0.25)'; x.fillRect(rnd() * w, rnd() * h, 6, 1); }
  }, 1, 2);
  T.hair = mkTex(256, 256, (x, w, h) => {
    x.fillStyle = '#17120f'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      x.strokeStyle = 'rgba(' + (60 + rnd() * 60) + ',' + (50 + rnd() * 40) + ',' + (45 + rnd() * 30) + ',0.25)';
      const px = rnd() * w; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (rnd() - 0.5) * 6, h); x.stroke();
    }
  }, 1, 1);
  T.ito = mkTex(128, 128, (x, w, h) => {
    x.fillStyle = '#e8e2d2'; x.fillRect(0, 0, w, h);          // 鮫皮(白)
    for (let k = 0; k < 400; k++) { x.fillStyle = 'rgba(120,110,90,0.35)'; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
    const band = (dx, dy, col) => {
      x.strokeStyle = col; x.lineWidth = 46;
      x.beginPath(); x.moveTo(dx - 140, dy - 140); x.lineTo(dx + 140, dy + 140); x.stroke();
    };
    for (const o of [0, 128, -128]) band(o, 0, '#1c1c26');
    x.save();
    for (const o of [0, 128, 256]) { x.strokeStyle = '#23232f'; x.lineWidth = 46; x.beginPath(); x.moveTo(o + 140, -140); x.lineTo(o - 140, 140); x.stroke(); }
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,0.10)'; x.lineWidth = 1;
    for (let i = -h; i < w * 2; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); }
  }, 3, 9);

  const M = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, o || {}));
  const mat = {
    kosode: M(0xffffff, { map: T.kosode, roughness: 0.9 }),
    hakama: M(0xffffff, { map: T.hakama, roughness: 0.9 }),
    obi: M(0xffffff, { map: T.obi, roughness: 0.85 }),
    gaiter: M(0xffffff, { map: T.gaiter, roughness: 0.9 }),
    straw: M(0xffffff, { map: T.straw, roughness: 1 }),
    hair: M(0xffffff, { map: T.hair, roughness: 0.55 }),
    skin: M(0xd6a27a, { roughness: 0.6 }),
    white: M(0xece6d6, { roughness: 0.9 }),
    tabi: M(0xe9e4d6, { roughness: 0.9 }),
    red: M(0x9c2b27, { roughness: 0.7 }),
    dark: M(0x24201e, { roughness: 0.7 }),
    tekko: M(0x2e2c33, { roughness: 0.55, metalness: 0.2 }),
    brass: M(0x9a8142, { roughness: 0.35, metalness: 0.55 }),
    iron: M(0x2c2825, { roughness: 0.4, metalness: 0.5 }),
    lacquer: new THREE.MeshPhysicalMaterial({ color: 0x15110f, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.15 }),
    horn: M(0x4a3a2a, { roughness: 0.4 }),
    steel: M(0xaab1b9, { roughness: 0.25, metalness: 0.35 }),
    edge: M(0xf2f5f7, { roughness: 0.12, metalness: 0.3 }),
    ito: M(0xffffff, { map: T.ito, roughness: 0.75 }),
  };

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Yax = V(0, 1, 0), Zax = V(0, 0, 1);

  function add(parent, geo, m, pos) {
    const me = new THREE.Mesh(geo, m); me.castShadow = true; me.receiveShadow = true;
    if (pos) me.position.copy(pos); parent.add(me); return me;
  }
  function limb(parent, a, b, r1, r2, m, seg) {
    const d = a.clone().sub(b), len = d.length();
    const me = add(parent, new THREE.CylinderGeometry(r1, r2, len, seg || 16, 1), m);
    me.position.copy(a).add(b).multiplyScalar(0.5);
    me.quaternion.setFromUnitVectors(Yax, d.normalize()); return me;
  }
  function ball(parent, r, m, p, sc) {
    const me = add(parent, new THREE.SphereGeometry(r, 20, 14), m, p);
    if (sc) me.scale.set(sc[0], sc[1], sc[2]); return me;
  }
  function bar(parent, a, b, w, t, m, n) {
    const y = b.clone().sub(a), len = y.length(); y.normalize();
    let z = (n || Zax).clone(); z.sub(y.clone().multiplyScalar(z.dot(y)));
    if (z.lengthSq() < 1e-6) z = V(1, 0, 0); z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const me = add(parent, new THREE.BoxGeometry(w, len, t), m);
    me.position.copy(a).add(b).multiplyScalar(0.5);
    me.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); return me;
  }
  function ik(s, h, l1, l2, hint) {
    const d = h.clone().sub(s); let dist = Math.min(d.length(), l1 + l2 - 0.1);
    const dn = d.clone().normalize();
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    const hh = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
    const p = hint.clone(); p.sub(dn.clone().multiplyScalar(p.dot(dn))).normalize();
    return s.clone().add(dn.clone().multiplyScalar(a)).add(p.multiplyScalar(hh));
  }

  window.MODELS.samurai = function () {
    const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
    const L = 0.22;                       // 前傾(rad)
    const H = V(0, 92, 0);

    // ---------- 脚(ワールド側) ----------
    const legs = new THREE.Group(); root.add(legs);
    function leg(sx, knee, ankle, fdir) {
      const hip = V(sx, 92, 0);
      ball(legs, 12.2, mat.hakama, hip);
      limb(legs, hip, knee, 12.4, 11.2, mat.hakama, 20);
      ball(legs, 11.2, mat.hakama, knee);
      const hem = knee.clone().lerp(ankle, 0.66);
      limb(legs, knee, hem, 11.2, 9.8, mat.hakama, 20);
      const hem2 = hem.clone().add(hem.clone().sub(knee).normalize().multiplyScalar(1.2));
      limb(legs, hem, hem2, 9.9, 9.9, mat.dark, 20);          // 裾の縁
      limb(legs, hem, ankle, 4.9, 3.7, mat.gaiter, 12);        // 脚絆
      for (let i = 1; i < 4; i++) {                             // 脚絆の巻き紐
        const p = hem.clone().lerp(ankle, i / 4);
        const t = add(legs, new THREE.TorusGeometry(4.3 - i * 0.2, 0.3, 6, 14), mat.white, p);
        t.quaternion.setFromUnitVectors(Zax, ankle.clone().sub(hem).normalize());
      }
      // 足
      const f = new THREE.Group(); f.position.copy(ankle); legs.add(f);
      f.quaternion.setFromUnitVectors(Zax, fdir.clone().normalize());
      limb(f, V(0, 2, 0), V(0, -5, 0), 3.8, 3.8, mat.tabi, 12);
      ball(f, 1, mat.tabi, V(0, -3.6, 8), [4.2, 3.3, 11.5]);
      ball(f, 1, mat.tabi, V(0, -3.4, 15.5), [3.8, 2.8, 6]);
      add(f, new THREE.BoxGeometry(9.4, 1.3, 25), mat.straw, V(0, -7.1, 8.6));
      add(f, new THREE.BoxGeometry(6, 1.2, 5), mat.straw, V(0, -6.9, -4.2));
      bar(f, V(3.9, -6.4, 4.5), V(0.6, -1.6, 0.5), 0.9, 0.5, mat.red, V(0, 1, 0));
      bar(f, V(-3.9, -6.4, 4.5), V(-0.6, -1.6, 0.5), 0.9, 0.5, mat.red, V(0, 1, 0));
      const ring = add(f, new THREE.TorusGeometry(4, 0.45, 6, 14), mat.red, V(0, -0.8, 0)); ring.rotation.x = Math.PI / 2;
    }
    leg(9, V(9, 68, 35.7), V(9, 28.4, 23), V(0, -0.1, 1));        // 前脚(右)
    leg(-9, V(-9, 51.6, -14.7), V(-9, 34.8, -53.3), V(0, -0.8, 0.6)); // 後脚(左・蹴り出し)

    // ---------- 胴 ----------
    const torso = new THREE.Group(); torso.position.copy(H); torso.rotation.x = L; root.add(torso);
    const sz = y => 0.62 * (14.5 + (y + 4) / 56 * 3);
    const body = add(torso, new THREE.CylinderGeometry(17.5, 14.5, 56, 28), mat.kosode, V(0, 24, 0)); body.scale.z = 0.62;
    const chest = ball(torso, 1, mat.kosode, V(0, 50, 0), [17.4, 5, 10.6]);
    const pel = add(torso, new THREE.CylinderGeometry(15.8, 17.2, 15, 28), mat.hakama, V(0, -8, 0)); pel.scale.z = 0.72;
    const obi = add(torso, new THREE.CylinderGeometry(15.4, 15.4, 11, 28), mat.obi, V(0, 4.5, 0)); obi.scale.z = 0.66;
    add(torso, new THREE.BoxGeometry(12, 7, 4.5), mat.obi, V(0, 5, -10.8));          // 帯の結び
    add(torso, new THREE.BoxGeometry(14, 13, 1.6), mat.hakama, V(0, -2, -11.4)).rotation.x = -0.12; // 腰板
    bar(torso, V(2, 5, -12.5), V(7, -9, -19), 3.2, 0.7, mat.obi, V(0, 1, 0));        // 帯の端
    bar(torso, V(-2, 5, -12.5), V(-8, -6, -21), 3.2, 0.7, mat.obi, V(0, 1, 0));
    // 襟(合わせ)
    const cz = y => sz(y) + 0.35;
    bar(torso, V(5.5, 54, cz(54)), V(0.5, 34, cz(34)), 3.6, 0.7, mat.white);
    bar(torso, V(-5.5, 54, cz(54) + 0.1), V(7, 8, cz(8) + 0.1), 3.6, 0.7, mat.white);
    // 襷(前後のX)
    const cord = (a, b, n) => bar(torso, a, b, 1.6, 0.6, mat.red, n);
    const fN = V(0, 0, 1), bN = V(0, 0, -1);
    cord(V(16, 49, cz(49)), V(-11, 8, cz(8) + 0.2), fN);
    cord(V(-16, 49, cz(49)), V(11, 8, cz(8)), fN);
    cord(V(16, 49, -cz(49)), V(-11, 8, -cz(8) - 0.2), bN);
    cord(V(-16, 49, -cz(49)), V(11, 8, -cz(8)), bN);
    // 首・頭
    limb(torso, V(0, 50, 1), V(0, 60, 2.2), 5.0, 4.6, mat.skin, 14);
    const head = new THREE.Group(); head.position.set(0, 66, 2.8); head.rotation.x = -L * 0.85; torso.add(head);
    ball(head, 1, mat.skin, V(0, 0, 0), [9.5, 10.9, 10]);
    ball(head, 1, mat.skin, V(0, -5.2, 2.2), [7.3, 6, 7.4]);                  // 顎
    ball(head, 1.7, mat.skin, V(9.2, -0.5, 0), [0.6, 1.3, 0.9]);
    ball(head, 1.7, mat.skin, V(-9.2, -0.5, 0), [0.6, 1.3, 0.9]);
    for (const s of [1, -1]) {
      add(head, new THREE.BoxGeometry(2.6, 0.75, 0.8), mat.dark, V(s * 3.6, 0.7, 9.0));          // 目
      const br = add(head, new THREE.BoxGeometry(4, 0.95, 0.9), mat.hair, V(s * 3.9, 2.7, 9.1));  // 眉(つり気味)
      br.rotation.z = s * -0.28;
    }
    add(head, new THREE.BoxGeometry(1.8, 4.2, 1.8), mat.skin, V(0, -1.4, 9.4)).rotation.x = -0.25;
    add(head, new THREE.BoxGeometry(3.8, 0.45, 0.6), mat.dark, V(0, -6.3, 8.9));                 // 口
    // 髪: 頭頂 + 後ろ・横(前頭部は月代)
    const hairTop = add(head, new THREE.SphereGeometry(1, 26, 14, 0, Math.PI * 2, 0, 0.95), mat.hair); hairTop.scale.set(10.3, 11.8, 10.9);
    hairTop.position.y = -0.2;
    const hairBack = add(head, new THREE.SphereGeometry(1, 26, 16, Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, 0, 2.1), mat.hair); hairBack.scale.set(10.3, 11.8, 10.9);
    hairBack.position.y = -0.2;
    const hb = add(head, new THREE.TorusGeometry(1, 0.11, 8, 30), mat.white, V(0, 3.4, 0)); // 鉢巻
    hb.rotation.x = Math.PI / 2; hb.scale.set(9.9, 10.5, 10.5);
    hb.geometry = new THREE.TorusGeometry(1, 0.1, 8, 30);
    bar(head, V(0, 3.4, -10.4), V(2.5, -7, -15), 2.6, 0.5, mat.white, V(0, 0, 1));          // 鉢巻の端
    bar(head, V(0, 3.4, -10.4), V(-3.2, -4, -16.5), 2.6, 0.5, mat.white, V(0, 0, 1));
    // 髷
    limb(head, V(0, 8, -6), V(0, 14, -2.5), 1.8, 2.0, mat.hair, 10);
    limb(head, V(0, 14, -2.5), V(0, 14.8, 4.5), 2.0, 1.4, mat.hair, 10);
    add(head, new THREE.TorusGeometry(2.0, 0.35, 6, 12), mat.white, V(0, 12.7, -3.6)).rotation.x = 0.9;

    // ---------- 腕と刀 ----------
    const d = V(2, 4, 18).normalize();                       // 刀の向き(胴座標)
    const swordQ = new THREE.Quaternion().setFromUnitVectors(Zax, d);
    const Rpos = V(-1, 15, 16), Fpos = Rpos.clone().add(d.clone().multiplyScalar(19.8));
    const sword = new THREE.Group(); sword.position.copy(Rpos); sword.quaternion.copy(swordQ); torso.add(sword);

    function arm(s, hand, hint) {
      const e = ik(s, hand, 30, 27, hint);
      ball(torso, 5.8, mat.kosode, s);
      limb(torso, s, e, 5.0, 5.4, mat.kosode, 14);           // 襷でたくし上げた袖
      ball(torso, 5.0, mat.kosode, e);
      const t = add(torso, new THREE.TorusGeometry(5.0, 0.55, 6, 16), mat.red, s.clone().lerp(e, 0.28));
      t.quaternion.setFromUnitVectors(Zax, e.clone().sub(s).normalize());
      const dir = hand.clone().sub(e).normalize();
      const wrist = hand.clone().sub(dir.clone().multiplyScalar(2.8));
      limb(torso, e.clone().add(dir.clone().multiplyScalar(2)), wrist, 4.3, 3.0, mat.skin, 12);
      const tk0 = wrist.clone().sub(dir.clone().multiplyScalar(9));
      limb(torso, tk0, wrist.clone().add(dir.clone().multiplyScalar(1)), 3.9, 3.5, mat.tekko, 12);  // 籠手
      bar(torso, tk0.clone().add(dir.clone().multiplyScalar(4.5)), tk0.clone().add(dir.clone().multiplyScalar(4.5)).add(V(0, 0.01, 0)), 0.1, 0.1, mat.dark);
    }
    arm(V(-17.5, 48, 0), Rpos, V(-0.7, -1, -0.2));
    arm(V(17.5, 48, 0), Fpos, V(0.7, -1, -0.2));

    // 刀(抜き身): z=柄尻側, 手は z=0 と z=19.8
    const tsuka = add(sword, new THREE.CylinderGeometry(1.7, 1.7, 27, 14).rotateX(Math.PI / 2), mat.ito, V(0, 0, 8.5));
    tsuka.scale.set(0.82, 1.25, 1);
    add(sword, new THREE.CylinderGeometry(1.9, 1.9, 0.9, 12).rotateX(Math.PI / 2), mat.brass, V(0, 0, -5.2)).scale.set(0.85, 1.25, 1);
    add(sword, new THREE.CylinderGeometry(1.95, 1.95, 1.4, 12).rotateX(Math.PI / 2), mat.brass, V(0, 0, 22.3)).scale.set(0.85, 1.25, 1);
    const tsuba = add(sword, new THREE.CylinderGeometry(4.3, 4.3, 0.55, 28).rotateX(Math.PI / 2), mat.iron, V(0, 0, 23.5));
    add(sword, new THREE.TorusGeometry(4.25, 0.35, 8, 28), mat.iron, V(0, 0, 23.5));
    add(sword, new THREE.CylinderGeometry(2.2, 2.2, 0.35, 16).rotateX(Math.PI / 2), mat.brass, V(0, 0, 23.0)).scale.set(0.8, 1.2, 1);
    add(sword, new THREE.BoxGeometry(1.1, 3.4, 2.6), mat.brass, V(0, 0, 25.4));
    // 刃
    const BL = 67, c = s => 1.7 * (s / BL) * (s / BL), w = s => 1 - 0.25 * s / BL;
    const top = s => c(s) + 1.2 * w(s), bot = s => c(s) - 1.8 * w(s);
    function bladeGeo(low, high, depth) {
      const sh = new THREE.Shape(); const N = 24, kS = 0.93 * BL;
      sh.moveTo(0, low(0));
      for (let i = 0; i <= N; i++) { const s = kS * i / N; if (i === 0) sh.lineTo(s, high(0)); else sh.lineTo(s, high(s)); }
      sh.lineTo(BL, c(BL) + 0.2);
      for (let i = N; i >= 0; i--) { const s = kS * i / N; sh.lineTo(s, low(s)); }
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
      geo.rotateY(-Math.PI / 2); geo.translate(depth / 2, 0, 26.5); return geo;
    }
    add(sword, bladeGeo(bot, top, 0.7), mat.steel);
    // 刃文(刃側の明るい帯): 切先まで
    {
      const sh = new THREE.Shape(); const N = 24, kS = 0.93 * BL;
      const hi = s => bot(s) + 1.1 * w(s);
      sh.moveTo(0, bot(0));
      for (let i = 0; i <= N; i++) { const s = kS * i / N; sh.lineTo(s, hi(s) + 0.25 * Math.sin(s * 0.9)); }
      sh.lineTo(BL, c(BL) + 0.2);
      for (let i = N; i >= 0; i--) { const s = kS * i / N; sh.lineTo(s, bot(s)); }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.76, bevelEnabled: false });
      geo.rotateY(-Math.PI / 2); geo.translate(0.38, 0, 26.5);
      add(sword, geo, mat.edge);
    }
    // 鎬(棟寄りの線)
    {
      const sh = new THREE.Shape(); const N = 24, kS = 0.93 * BL;
      sh.moveTo(0, top(0) - 0.25);
      for (let i = 0; i <= N; i++) { const s = kS * i / N; sh.lineTo(s, top(s) - 0.25); }
      for (let i = N; i >= 0; i--) { const s = kS * i / N; sh.lineTo(s, top(s) - 0.5 * w(s)); }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false });
      geo.rotateY(-Math.PI / 2); geo.translate(0.4, 0, 26.5);
      add(sword, geo, M(0x7e858e, { roughness: 0.3, metalness: 0.3 }));
    }
    // 手(柄を握る)
    for (const z of [0, 19.8]) {
      const hnd = new THREE.Group(); hnd.position.set(0, 0, z); sword.add(hnd);
      ball(hnd, 1, mat.skin, V(0, 0, 0), [3.7, 3.5, 4.2]);
      for (let i = 0; i < 4; i++) ball(hnd, 1.15, mat.skin, V(2.6, 1.8 - i * 1.3, 0).setZ(-3 + i * 0), [0.9, 1, 1]);
      ball(hnd, 1.2, mat.skin, V(-2.6, 2.5, 1.5), [1, 1, 1.4]);
    }

    // 鞘(空・左腰、後方へ振られる)
    const sa = V(-17, 6, 11), sb = V(-23, -8, -60);
    const sd = sb.clone().sub(sa).normalize();
    limb(torso, sa, sb, 2.3, 1.7, mat.lacquer, 14).scale.x = 0.8;
    limb(torso, sa, sa.clone().add(sd.clone().multiplyScalar(2.6)), 2.7, 2.7, mat.horn, 14).scale.x = 0.85;
    ball(torso, 1.75, mat.horn, sb);
    const K = sa.clone().add(sd.clone().multiplyScalar(9)).add(V(1.6, 1.6, 0));
    ball(torso, 1.2, mat.horn, K, [0.8, 1.2, 1.8]);
    const sag = new THREE.CatmullRomCurve3([V(0, 0, 0), V(-1, -5, -2), V(-2, -9, -8), V(-3, -11, -16), V(-2, -10, -23)].map(p => p.add(K)));
    add(torso, new THREE.TubeGeometry(sag, 16, 0.4, 5), mat.red);

    // ---------- 地面合わせ ----------
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root), lb = new THREE.Box3().setFromObject(legs);
    root.position.set(0, -bb.min.y, -(lb.min.z + lb.max.z) / 2);
    return g;
  };
})();
