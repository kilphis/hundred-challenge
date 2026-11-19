// day35 set1: clerk / zombie / manager / gondola / crate / register_counter  (Three.js r128, 1=1cm)
(function () {
  window.MODELS = window.MODELS || {};

  // ---------- helpers ----------
  let seed = 12345;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function shade(hex, d) { return new THREE.Color(hex).offsetHSL(0, 0, d).getStyle(); }
  function ctex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rx) t.repeat.set(rx, ry || rx);
    t.anisotropy = 4;
    return t;
  }
  function fabric(color, stripe) {
    return ctex(128, 128, (x, w, h) => {
      x.fillStyle = color; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
        x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1);
      }
      x.strokeStyle = 'rgba(0,0,0,0.07)';
      for (let i = 0; i < h; i += 4) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
      if (stripe) { x.fillStyle = stripe; x.fillRect(0, 60, w, 8); }
    }, 2, 2);
  }
  function skinTex(color) {
    return ctex(64, 64, (x, w, h) => {
      x.fillStyle = color; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 200; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(60,30,0,0.06)'; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
    });
  }
  function M(map, o) {
    o = o || {};
    const p = { roughness: o.r === undefined ? 0.8 : o.r, metalness: o.m || 0 };
    if (typeof map === 'string' || typeof map === 'number') p.color = map; else { p.map = map; p.color = 0xffffff; }
    if (o.e) { p.emissive = o.e; p.emissiveIntensity = o.ei || 1; if (o.emap) p.emissiveMap = o.emap; }
    if (o.t) { p.transparent = true; p.opacity = o.t; }
    return new THREE.MeshStandardMaterial(p);
  }
  function add(g, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  }
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const S = (r, ws, hs) => new THREE.SphereGeometry(r, ws || 14, hs || 10);
  function limb(g, a, b, r1, r2, mat) {
    const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    const d = vb.clone().sub(va), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 10), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = m.receiveShadow = true; g.add(m); return m;
  }

  // ---------- person ----------
  function person(o) {
    const g = new THREE.Group();
    const up = new THREE.Group(), inner = new THREE.Group();
    up.position.y = 80; inner.position.y = -80; up.add(inner); g.add(up);
    const shirtM = M(fabric(o.shirt, o.stripe)), pantsM = M(fabric(o.pants)), skinM = M(skinTex(o.skin), { r: 0.7 });
    const shoeM = M(o.shoe || '#222222', { r: 0.5 }), dark = M('#1a1a1a'), white = M('#f4f4ee', { r: 0.4 });
    const Z = !!o.zombie;
    const rig = g.userData.rig = { legs: {}, arms: {}, up };   // 歩きモーション用の関節(render3d.js が回す)
    if (Z) up.rotation.x = 0.3;

    // legs & shoes
    for (const s of [-1, 1]) {
      const torn = Z && s === 1;
      if (torn) {
        limb(g, [s * 9, 40, 0], [s * 9, 80, 0], 6.5, 7.5, pantsM);
        limb(g, [s * 9, 8, 1], [s * 9, 40, 0], 4.3, 5, skinM);
        add(g, B(11, 3, 26), skinM, s * 9, 2, 4);
        for (let i = 0; i < 4; i++) add(g, B(1.8, 6, 1.5), pantsM, s * 9 - 4 + i * 2.7, 38, 5.2);
      } else {
        const lp = new THREE.Group(); lp.position.set(s * 9, 80, 0); g.add(lp); rig.legs[s] = lp;   // 股関節で回す
        limb(lp, [0, -72, 0], [0, 0, 0], 6, 7.5, pantsM);
        add(lp, B(11, 7, 26), shoeM, 0, -76.5, 4);
      }
    }
    // torso
    add(inner, B(38, 56, 22), shirtM, 0, 108, 0);
    add(inner, S(7.5), shirtM, -21, 134, 0); add(inner, S(7.5), shirtM, 21, 134, 0);
    add(inner, B(40, 6, 24), M(fabric(o.pants)), 0, 81, 0);
    if (o.belly) { const b = add(inner, S(17, 16, 12), shirtM, 0, 98, 6); b.scale.set(1.25, 1, 0.9); }
    limbN(inner, [0, 138, 0], [0, 147, 0], 5, 5, skinM);
    function limbN(gr, a, b, r1, r2, m) { return limb(gr, a, b, r1, r2, m); }

    // clerk details
    if (o.uniform) {
      add(inner, B(9, 9, 0.8), M(shade(o.shirt, -0.05)), -9, 124, 11.2);
      add(inner, B(6, 3, 0.6), white, 9, 126, 11.3);
      add(inner, B(40, 3, 23), M('#222a3a'), 0, 83.5, 0);
      add(inner, B(5, 3.4, 0.8), M('#c8b45a', { m: 0.6, r: 0.4 }), 0, 83.5, 11.4);
      const cl = add(inner, B(12, 4, 12), shirtM, 0, 139, 0); cl.scale.set(1.4, 1, 1.05);
    }
    if (o.tag) {
      const tt = ctex(128, 48, (x, w, h) => {
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.strokeStyle = '#335'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4);
        x.fillStyle = '#111'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('店長', w / 2, h / 2 + 2);
      });
      tt.repeat.set(1, 1);
      const tg = add(inner, new THREE.PlaneGeometry(11, 4.2), M(tt, { r: 0.4 }), -9, 126, 11.6);
      tg.castShadow = false;
    }
    if (Z && !o.uniform) { // ragged hem + holes
      for (let i = 0; i < 8; i++) {
        const hh = 4 + rnd() * 7;
        add(inner, B(4, hh, 0.8), shirtM, -17 + i * 4.8, 80 + 2 - hh / 2 + 3, 11.4);
        add(inner, B(4, 3 + rnd() * 5, 0.8), shirtM, -17 + i * 4.8, 82 - (3 + rnd() * 5) / 2 + 2, -11.4);
      }
      add(inner, B(8, 7, 0.4), skinM, -6, 100, 11.1); add(inner, B(6, 5, 0.4), skinM, 9, 118, 11.1);
      add(inner, B(9, 6, 0.3), M('#3a2a20'), 8, 104, 11.15);
    }

    // arms
    for (const s of [-1, 1]) {
      const sh = [s * 21, 134, 0];
      if (o.pose === 'zombie') {
        const el = [s * 22, 132, 20], hd = [s * 21, 126, 42];
        limb(inner, sh, el, 6, 5, shirtM);
        const fa = (s === 1) ? skinM : shirtM;
        limb(inner, el, hd, 5, 3.8, fa);
        if (s === -1) add(inner, B(9, 9, 9), skinM, s * 21.5, 127, 40).visible = false;
        add(inner, S(4.2), skinM, hd[0], hd[1], hd[2]);
        for (let i = 0; i < 4; i++) limb(inner, [hd[0] - 3 + i * 2, hd[1] - 0.5, hd[2] + 2], [hd[0] - 3.4 + i * 2.2, hd[1] - 3.5, hd[2] + 8], 1.1, 0.8, skinM);
      } else {
        const el = [s * 25, 112, 4], hd = [s * 7, 104, 21];
        const ap = new THREE.Group(); ap.position.set(sh[0], sh[1], sh[2]); inner.add(ap); rig.arms[s] = ap;   // 肩で回す
        const rel = v => [v[0] - sh[0], v[1] - sh[1], v[2] - sh[2]];
        limb(ap, [0, 0, 0], rel(el), 5.8, 5, shirtM);
        limb(ap, rel(el), rel(hd), 4.8, 4, shirtM);
        const h = add(ap, S(4.3), skinM, hd[0] - sh[0], hd[1] - sh[1], hd[2] - sh[2]); h.scale.set(1, 0.9, 1.2);
      }
    }
    if (o.pose !== 'zombie') add(inner, B(10, 6, 8), skinM, 0, 103, 22); // clasped hands

    // head
    const head = new THREE.Group(); head.position.set(0, 146, Z ? 3 : 0); inner.add(head);
    if (Z) { head.rotation.x = 0.4; head.rotation.z = 0.12; }
    const sk = add(head, S(11, 18, 14), skinM, 0, 10, 1); sk.scale.set(1, 1.08, 1.02);
    add(head, S(2.4, 8, 6), skinM, -11, 10, 0); add(head, S(2.4, 8, 6), skinM, 11, 10, 0);
    add(head, B(2.4, 3.4, 2.4), skinM, 0, 8.5, 11.3);
    if (!Z) {
      for (const s of [-1, 1]) {
        add(head, S(2, 8, 6), white, s * 4.2, 11.5, 9.6).scale.set(1, 1.1, 0.6);
        add(head, S(1.1, 6, 5), dark, s * 4.2, 11.4, 10.6);
        add(head, B(4.6, 0.9, 0.8), M('#2a1f18'), s * 4.2, 14.6, 9.7);
      }
      add(head, B(6, 1, 0.8), M('#9a4a40'), 0, 3.6, 10.2);
    } else {
      const eyeC = ['#e9e6b0', '#d8dca0'];
      for (const s of [-1, 1]) {
        const so = add(head, S(3.5, 10, 8), M('#33473a'), s * 4.2, 11.5, 8.9); so.scale.set(1, 1, 0.6);
        const e = add(head, S(s === 1 ? 2.6 : 2.0, 8, 6), M(eyeC[s === 1 ? 0 : 1], { r: 0.3 }), s * 4.2, 11.5, 10.1); e.scale.z = 0.6;
        add(head, S(0.7, 6, 5), dark, s * 4.2 + s * 0.6, 11.2, 11.2);
        add(head, B(4.4, 0.9, 0.8), dark, s * 4.2, 15.2 - s * 0.6, 9.8).rotation.z = s * -0.25;
      }
      add(head, B(6.5, 2.8, 1), M('#2a0e12'), 0, 3.6, 10.3);
      for (let i = 0; i < 3; i++) add(head, B(1.3, 1.2, 0.6), white, -2 + i * 2, 4.6, 10.9);
      for (let i = 0; i < 6; i++) { const t = add(head, S(2.4 + rnd(), 6, 5), M(['#3a2a22', '#4a3626'][i % 2]), -7 + i * 2.8, 20.5 - Math.abs(i - 2.5) * 0.8, -1 + rnd() * 4); }
    }
    if (o.cap) {
      const capM = M(fabric(o.cap));
      const ct = add(head, new THREE.SphereGeometry(11.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), capM, 0, 11.5, 0.5);
      ct.scale.set(1, 0.95, 1.05);
      const br = add(head, new THREE.CylinderGeometry(10.5, 11.5, 1.2, 14, 1, false, -Math.PI / 2 - 1.1, 2.2), capM, 0, 11.5, 2); br.scale.set(1, 1, 1.45); br.rotation.x = 0.12;
      add(head, B(5, 3.5, 0.5), white, 0, 17, 11.6).visible = true;
      add(head, B(25, 1, 2), M(shade(o.cap, 0.08)), 0, 12, 0).visible = false;
    } else if (o.hair) {
      for (let i = 0; i < 5; i++) add(head, S(3.5, 6, 5), M(o.hair), -7 + i * 3.5, 20.5, -1 + (i % 2) * 2);
    }
    // collapse hidden helper meshes
    const kill = []; g.traverse(m => { if (m.isMesh && m.visible === false) kill.push(m); });
    kill.forEach(m => m.parent.remove(m));
    return g;
  }

  // ---------- 1 clerk ----------
  window.MODELS.clerk = function () {
    return person({ skin: '#f2d2b0', shirt: '#2b5fa8', stripe: '#e8e8e8', pants: '#1c2a44', shoe: '#1a1a1a', cap: '#1f3f70', uniform: true, pose: 'front' });
  };

  // ---------- 2 zombie ----------
  window.MODELS.zombie = function (opts) {
    opts = opts || {};
    return person({ skin: opts.skin || '#7fa36a', shirt: opts.shirt || '#7a4b8c', pants: '#4b4b5a', shoe: '#5a3d2a', zombie: true, pose: 'zombie', hair: '#3a2a22' });
  };

  // ---------- 3 manager ----------
  window.MODELS.manager = function () {
    const p = person({ skin: '#7a9a62', shirt: '#2b5fa8', stripe: '#e8e8e8', pants: '#1c2a44', shoe: '#1a1a1a', zombie: true, pose: 'front', uniform: true, belly: true, tag: true, hair: '#2a2a2a' });
    const w = new THREE.Group(); w.add(p);
    p.scale.set(1.5, 210 / 170, 1.4);
    return w;
  };

  // ---------- 4 gondola ----------
  window.MODELS.gondola = function () {
    const g = new THREE.Group(); seed = 777;
    const steel = M(ctex(128, 128, (x, w, h) => {
      x.fillStyle = '#c4c9ce'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'; x.fillRect(0, rnd() * h, w, 1); }
    }), { r: 0.45, m: 0.5 });
    const shelfM = M('#e6e8ea', { r: 0.5, m: 0.3 });
    const peg = M(ctex(128, 128, (x, w, h) => {
      x.fillStyle = '#b8bec4'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(40,45,50,0.65)';
      for (let i = 4; i < w; i += 8) for (let j = 4; j < h; j += 8) { x.beginPath(); x.arc(i, j, 1.3, 0, 7); x.fill(); }
    }, 22, 19), { r: 0.5, m: 0.4 });
    add(g, B(180, 10, 50), M('#8f979e', { r: 0.5, m: 0.5 }), 0, 5, 0);
    add(g, B(2, 140, 50), steel, -89, 80, 0); add(g, B(2, 140, 50), steel, 89, 80, 0);
    add(g, B(176, 138, 2), peg, 0, 79, 0);
    add(g, B(180, 4, 50), steel, 0, 148, 0);
    add(g, B(176, 8, 2.2), M('#2b5fa8', { r: 0.5 }), 0, 140, 0).visible = true;
    const tagTex = ctex(512, 24, (x, w, h) => {
      x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) { x.fillStyle = ['#e9c46a', '#fff', '#8fc1e3', '#f4a261'][i % 4]; x.fillRect(8 + i * 42, 4, 34, 16); x.fillStyle = '#333'; x.fillRect(12 + i * 42, 8, 18, 2); x.fillRect(12 + i * 42, 13, 10, 2); }
    });
    const rail = M(tagTex, { r: 0.4 });
    const levels = [16, 50, 84, 118];
    for (const s of [-1, 1]) for (const y of levels) {
      add(g, B(176, 1.5, 23), shelfM, 0, y, s * 12.5);
      add(g, B(176, 4, 1.2), rail, 0, y - 0.8 + 2.5 - 2.5, s * 24.2);
      add(g, B(176, 2, 4), steel, 0, y - 2, s * 22);
    }
    const items = ['#d94f4f', '#e9c46a', '#5aa469', '#4f8fd9'];
    for (let i = 0; i < 8; i++) {
      const s = i % 2 ? 1 : -1, y = levels[i % 4];
      add(g, B(8 + rnd() * 6, 10 + rnd() * 6, 6), M(items[i % 4], { r: 0.6 }), -70 + rnd() * 140, y + 6.5, s * (8 + rnd() * 8));
    }
    for (const x of [-60, 0, 60]) add(g, B(1.5, 130, 1.5), steel, x, 78, 0).visible = false;
    const kill = []; g.traverse(m => { if (m.isMesh && m.visible === false) kill.push(m); }); kill.forEach(m => m.parent.remove(m));
    g.userData.colliders = [[-90, 0, -25, 90, 150, 25]];
    return g;
  };

  // ---------- 5 crate ----------
  window.MODELS.crate = function (color) {
    color = color || '#e8b04b';
    const g = new THREE.Group(); seed = 4242;
    const resin = M(ctex(128, 128, (x, w, h) => {
      x.fillStyle = '#d9dcde'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(80,90,100,0.12)'; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
    }), { r: 0.55 });
    const dk = M('#8a9096', { r: 0.6 });
    const band = M(color, { r: 0.5 });
    const W = 50, D = 35, H = 25, t = 2;
    add(g, B(W, t, D), resin, 0, t / 2, 0);
    for (const s of [-1, 1]) {
      add(g, B(W, H - t, t), resin, 0, t + (H - t) / 2, s * (D / 2 - t / 2));
      add(g, B(t, H - t, D - 2 * t), resin, s * (W / 2 - t / 2), t + (H - t) / 2, 0);
      add(g, B(W + 1, 2.5, 2.6), resin, 0, H - 1.2, s * (D / 2 - 0.5));
      add(g, B(2.6, 2.5, D - 1), resin, s * (W / 2 - 0.5), H - 1.2, 0);
      add(g, B(W - 1, 6, 0.5), band, 0, 15, s * (D / 2 + 0.25));
      const lb = ctex(128, 48, (x, w, h) => {
        x.fillStyle = '#fafafa'; x.fillRect(0, 0, w, h); x.fillStyle = color; x.fillRect(0, 0, w, 12);
        x.fillStyle = '#333'; for (let i = 0; i < 5; i++) x.fillRect(10, 20 + i * 5, 50 + (i % 2) * 30, 2);
        for (let i = 0; i < 18; i++) x.fillRect(86 + i * 2, 22, 1 + (i % 3), 20);
      });
      lb.repeat.set(1, 1);
      add(g, new THREE.PlaneGeometry(18, 7), M(lb, { r: 0.4 }), 12 * s, 9, s * (D / 2 + 0.6)).rotation.y = s === 1 ? 0 : Math.PI;
      add(g, B(10, 3, 1), dk, 0, 19.5, s * (D / 2 + 0.4)); // handle slot
      add(g, B(1, 3, 10), dk, s * (W / 2 + 0.4), 19.5, 0);
      add(g, B(0.8, H - 6, 1.6), resin, s * 18, 12, D / 2 + 0.3);
      add(g, B(0.8, H - 6, 1.6), resin, s * 18, 12, -D / 2 - 0.3);
      add(g, B(0.6, 1.2, D - 4), dk, s * (W / 2 + 0.3), 8, 0);
    }
    const ic = ['#d94f4f', '#f2f2f2', '#5aa469', '#e9c46a', '#4f8fd9', '#c77dba'];
    for (let i = 0; i < 6; i++) {
      const x = -16 + (i % 3) * 16, z = -8 + Math.floor(i / 3) * 14;
      if (i % 3 === 1) add(g, new THREE.CylinderGeometry(3.2, 3.6, 13, 10), M(ic[i], { r: 0.4 }), x, 8, z);
      else add(g, B(9, 12 + (i % 2) * 3, 7), M(ic[i], { r: 0.6 }), x, 8, z);
    }
    return g;
  };

  // ---------- 6 register_counter ----------
  window.MODELS.register_counter = function () {
    const g = new THREE.Group(); seed = 99;
    const lam = M(ctex(128, 128, (x, w, h) => {
      x.fillStyle = '#eceae4'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#2b5fa8'; x.fillRect(0, 88, w, 14);
      for (let i = 0; i < 200; i++) { x.fillStyle = 'rgba(0,0,0,0.04)'; x.fillRect(rnd() * w, rnd() * h, 2, 1); }
    }, 6, 1), { r: 0.5 });
    const top = M(ctex(128, 128, (x, w, h) => {
      x.fillStyle = '#4a4540'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'; x.fillRect(rnd() * w, rnd() * h, 3, 1); }
    }, 3, 1), { r: 0.35 });
    const plastic = M('#2d3035', { r: 0.4 }), grey = M('#6b7078', { r: 0.4, m: 0.3 });
    add(g, B(180, 8, 60), M('#3a3f46'), 0, 4, 0);
    add(g, B(180, 82, 62), lam, 0, 49, 0);
    add(g, B(184, 5, 70), top, 0, 92.5, 0);
    add(g, B(184, 1.5, 1.5), M('#2b5fa8'), 0, 90.4, 34.5);
    // POS body (operator side is -Z)
    add(g, B(36, 12, 38), plastic, -35, 101, -6);
    add(g, B(34, 5, 1), grey, -35, 97, 13.3);
    const keys = ctex(128, 128, (x, w, h) => {
      x.fillStyle = '#20232a'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) { x.fillStyle = ['#cfd3d8', '#e9c46a', '#8fc1e3'][(i + j) % 3]; x.fillRect(6 + i * 20, 8 + j * 23, 16, 17); }
    });
    keys.repeat.set(1, 1);
    const kb = add(g, B(30, 1, 22), M(keys, { r: 0.5 }), -35, 107.2, -9); kb.rotation.x = 0.12;
    add(g, new THREE.CylinderGeometry(2.5, 3.5, 12, 10), grey, -35, 112, -22);
    const scr = ctex(128, 80, (x, w, h) => {
      x.fillStyle = '#0b1c30'; x.fillRect(0, 0, w, h); x.fillStyle = '#2b9fd8'; x.fillRect(0, 0, w, 10);
      x.fillStyle = '#e8f4ff'; for (let i = 0; i < 6; i++) x.fillRect(6, 16 + i * 10, 60 + (i % 3) * 14, 4);
      x.fillStyle = '#5ae08a'; x.fillRect(92, 50, 30, 24);
    });
    scr.repeat.set(1, 1);
    const mon = new THREE.Group(); mon.position.set(-35, 126, -24); mon.rotation.x = -0.12; g.add(mon);
    add(mon, B(32, 21, 2.5), plastic, 0, 0, 0);
    const sp = add(mon, new THREE.PlaneGeometry(29, 18), M(scr, { e: 0xffffff, emap: scr, ei: 0.8, r: 0.2 }), 0, 0, -1.3); sp.rotation.y = Math.PI; sp.castShadow = false;
    // customer display
    add(g, new THREE.CylinderGeometry(1.5, 2, 18, 8), grey, -10, 104, 2);
    const cd = add(g, B(16, 9, 2), plastic, -10, 116, 2);
    add(g, new THREE.PlaneGeometry(13, 6), M('#14395a', { e: 0x2b8fd0, ei: 0.7 }), -10, 116, 3.1).castShadow = false;
    // receipt printer
    add(g, B(16, 12, 20), M('#e2e2de', { r: 0.4 }), -66, 101, -14);
    add(g, B(10, 0.6, 7), M('#fff'), -66, 107.3, -22);
    // scanner
    add(g, B(8, 7, 7), plastic, 8, 96, -20);
    add(g, B(6, 1, 1), M('#ff3030', { e: 0xff2020 }), 8, 98.5, -16.4);
    // card reader
    add(g, B(10, 4, 14), plastic, 22, 94.5, 14).rotation.x = -0.2;
    add(g, B(8, 0.4, 6), M('#6fa0d8', { e: 0x335577, ei: 0.5 }), 22, 96.9, 14.5);
    // change tray
    const tray = M('#1f3f70', { r: 0.4 });
    add(g, B(26, 1, 17), tray, 40, 95.5, 8);
    add(g, B(26, 2.5, 1), tray, 40, 96.8, 16.5); add(g, B(26, 2.5, 1), tray, 40, 96.8, -0.5);
    add(g, B(1, 2.5, 17), tray, 27, 96.8, 8); add(g, B(1, 2.5, 17), tray, 53, 96.8, 8);
    for (let i = 0; i < 5; i++) add(g, new THREE.CylinderGeometry(1.2, 1.2, 0.3, 10), M(i % 2 ? '#d4a84a' : '#c8c8c8', { m: 0.7, r: 0.3 }), 34 + i * 3.5, 96.2, 6 + (i % 3) * 2.5);
    // bag holder & basket mat
    add(g, B(3, 12, 10), grey, 80, 101, -24); add(g, B(14, 1, 10), M('#e6e6e0'), 80, 107.5, -24);
    add(g, B(34, 0.4, 24), M('#2b5fa8', { r: 0.9 }), 62, 95.2, -10);
    g.userData.colliders = [[-92, 0, -35, 92, 95, 35]];
    return g;
  };
})();
