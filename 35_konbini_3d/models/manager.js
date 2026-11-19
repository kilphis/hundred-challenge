// 店長ゾンビ(身長約230cm、肩幅約130cm)。体格を一から組む。原点=足元中心、+Z が正面。
(function () {
  window.MODELS = window.MODELS || {};

  function rngMaker(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function tex(c) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // 肌 #7a9a62: 色ムラ・血管・あざ・毛穴
  function skinTex() {
    const R = rngMaker(11), c = canvas(512, 512), x = c.getContext('2d');
    x.fillStyle = '#7a9a62'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1400; i++) {
      const l = R() < 0.5;
      x.fillStyle = l ? 'rgba(170,200,130,0.07)' : 'rgba(40,70,40,0.08)';
      x.beginPath(); x.arc(R() * 512, R() * 512, 2 + R() * 14, 0, 7); x.fill();
    }
    for (let i = 0; i < 9; i++) {
      x.fillStyle = 'rgba(90,70,120,0.16)';
      x.beginPath(); x.ellipse(R() * 512, R() * 512, 10 + R() * 22, 6 + R() * 12, R() * 3, 0, 7); x.fill();
    }
    x.strokeStyle = 'rgba(60,95,70,0.4)'; x.lineWidth = 1.6;
    for (let i = 0; i < 40; i++) {
      let px = R() * 512, py = R() * 512;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 40; py += (R() - 0.3) * 30; x.lineTo(px, py); }
      x.stroke();
    }
    for (let i = 0; i < 4000; i++) {
      x.fillStyle = 'rgba(30,50,30,0.12)'; x.fillRect(R() * 512, R() * 512, 1, 1);
    }
    return tex(c);
  }

  // 青い制服 #2b5fa8: 織り目・汚れ。body=true で中央の合わせ目とボタン、はち切れ皺
  function uniformTex(body) {
    const R = rngMaker(body ? 21 : 22), c = canvas(512, 512), x = c.getContext('2d');
    x.fillStyle = '#2b5fa8'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 700; i++) {
      x.fillStyle = R() < 0.5 ? 'rgba(120,170,230,0.06)' : 'rgba(10,30,70,0.08)';
      x.beginPath(); x.arc(R() * 512, R() * 512, 3 + R() * 16, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(0,20,60,0.07)';
    for (let y = 0; y < 512; y += 3) x.fillRect(0, y, 512, 1);
    for (let xx = 0; xx < 512; xx += 3) x.fillRect(xx, 0, 1, 1.5);
    for (let i = 0; i < 6; i++) { // 汚れ
      x.fillStyle = 'rgba(70,60,30,0.14)';
      x.beginPath(); x.ellipse(R() * 512, R() * 512, 8 + R() * 18, 5 + R() * 10, R() * 3, 0, 7); x.fill();
    }
    if (body) {
      const cx = 128; // u=0.25 が正面
      x.fillStyle = 'rgba(0,20,60,0.35)'; x.fillRect(cx - 1, 0, 3, 512);
      for (let y = 40; y < 512; y += 48) {
        x.fillStyle = '#dfe6ee'; x.beginPath(); x.arc(cx, y, 4.5, 0, 7); x.fill();
        x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 1; x.stroke();
        // ボタンに向かう引っ張り皺
        for (let k = -3; k <= 3; k++) {
          if (!k) continue;
          x.strokeStyle = k % 2 ? 'rgba(160,200,245,0.22)' : 'rgba(0,15,50,0.3)';
          x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(cx + 5, y + k * 2);
          x.lineTo(cx + 5 + 38, y + k * 7);
          x.moveTo(cx - 5, y + k * 2); x.lineTo(cx - 5 - 38, y + k * 7); x.stroke();
        }
      }
    }
    return tex(c);
  }

  function pantsTex() {
    const R = rngMaker(31), c = canvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#222d44'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 300; i++) {
      x.fillStyle = R() < 0.5 ? 'rgba(120,140,190,0.06)' : 'rgba(0,0,10,0.1)';
      x.beginPath(); x.arc(R() * 256, R() * 256, 3 + R() * 10, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(0,0,10,0.08)';
    for (let y = 0; y < 256; y += 3) x.fillRect(0, y, 256, 1);
    x.strokeStyle = 'rgba(0,0,10,0.3)'; x.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const yy = 20 + R() * 220; x.beginPath(); x.moveTo(0, yy); x.lineTo(256, yy + (R() - 0.5) * 20); x.stroke(); }
    return tex(c);
  }

  function tagTex() {
    const c = canvas(256, 112), x = c.getContext('2d');
    x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 256, 112);
    x.strokeStyle = '#555'; x.lineWidth = 4; x.strokeRect(3, 3, 250, 106);
    x.fillStyle = '#2b5fa8'; x.fillRect(8, 8, 240, 14);
    x.fillStyle = '#111'; x.font = 'bold 66px "Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('店長', 128, 66);
    x.fillStyle = 'rgba(80,60,20,0.15)'; x.beginPath(); x.ellipse(200, 90, 30, 12, 0.4, 0, 7); x.fill();
    return new THREE.CanvasTexture(c);
  }

  window.MODELS.manager = function () {
    const g = new THREE.Group(); let cur = g;
    const Y = new THREE.Vector3(0, 1, 0);

    const skinT = skinTex(), uniB = uniformTex(true), uniP = uniformTex(false), pantT = pantsTex();
    const skin = new THREE.MeshStandardMaterial({ map: skinT, roughness: 0.78, metalness: 0 });
    const uni = new THREE.MeshStandardMaterial({ map: uniB, roughness: 0.85, metalness: 0 });
    const uniPlain = new THREE.MeshStandardMaterial({ map: uniP, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    const pants = new THREE.MeshStandardMaterial({ map: pantT, roughness: 0.9, metalness: 0 });
    const shoeM = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.6, metalness: 0.05 });
    const beltM = new THREE.MeshStandardMaterial({ color: 0x15110e, roughness: 0.55, metalness: 0.1 });
    const darkSkin = new THREE.MeshStandardMaterial({ color: 0x46613a, roughness: 0.9 });
    const mouthM = new THREE.MeshStandardMaterial({ color: 0x2a0d10, roughness: 0.9 });
    const toothM = new THREE.MeshStandardMaterial({ color: 0xd9d2a8, roughness: 0.5 });
    const socketM = new THREE.MeshStandardMaterial({ color: 0x1d2a1c, roughness: 0.95 });
    const eyeM = new THREE.MeshStandardMaterial({ color: 0xcfd2a6, roughness: 0.35, emissive: 0x2a2c10, emissiveIntensity: 0.5 });
    const pupilM = new THREE.MeshStandardMaterial({ color: 0x20231a, roughness: 0.4 });
    const tagMat = new THREE.MeshStandardMaterial({ map: tagTex(), roughness: 0.55, metalness: 0 });

    function put(mesh, parent, x, y, z) {
      mesh.position.set(x, y, z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      (parent || cur).add(mesh);
      return mesh;
    }
    function ell(mat, cx, cy, cz, rx, ry, rz, parent) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), mat);
      m.scale.set(rx, ry, rz);
      return put(m, parent, cx, cy, cz);
    }
    function box(mat, w, h, d, x, y, z, parent) {
      return put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent, x, y, z);
    }
    // 楕円体表面 E の (x,y) の点に、外向き法線へ向けて貼る
    function placeOn(mesh, E, x, y, off) {
      const nx = (x - E.cx) / (E.rx * E.rx), ny = (y - E.cy) / (E.ry * E.ry);
      const t = 1 - Math.pow((x - E.cx) / E.rx, 2) - Math.pow((y - E.cy) / E.ry, 2);
      const z = E.cz + E.rz * Math.sqrt(Math.max(0, t));
      const nz = (z - E.cz) / (E.rz * E.rz);
      const n = new THREE.Vector3(nx, ny, nz).normalize();
      mesh.position.set(x, y, z).addScaledVector(n, off);
      mesh.lookAt(mesh.position.clone().add(n));
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    }

    // ---- 脚(短く太い) ----
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(18.5, 15, 92, 20), pants);
      put(leg, g, s * 21, 54, 0);
      ell(pants, s * 21, 99, 0, 18.5, 5, 18.5); // 脚の付け根を丸める
      box(shoeM, 25, 12, 44, s * 21, 6, 9);
      ell(shoeM, s * 21, 8, 29, 12.5, 7, 10); // つま先
    }

    // ---- 胴 ----
    ell(pants, 0, 101, 0, 42, 14, 27); // 骨盤
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5, 28), beltM);
    belt.scale.set(41.5, 1, 27.5); put(belt, g, 0, 103, 0);
    ell(uni, 0, 128, 5, 46, 32, 34);            // 樽のような腹
    const chestE = { cx: 0, cy: 165, cz: 0, rx: 48, ry: 28, rz: 30 };
    ell(uni, chestE.cx, chestE.cy, chestE.cz, chestE.rx, chestE.ry, chestE.rz); // 広い胸板

    // 胸の名札「店長」
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), tagMat);
    placeOn(tag, chestE, 15, 173, 1.2);

    // ---- 僧帽筋・肩・首 ----
    for (const s of [-1, 1]) {
      const trap = ell(uni, s * 24, 189, -3, 30, 13, 19);
      trap.rotation.z = -s * 0.3;
      ell(uni, s * 49, 186, -1, 17, 17, 17); // 肩(三角筋)
      const collar = box(uni, 13, 6, 2.5, s * 9, 193, 14);
      collar.rotation.set(0.35, -s * 0.5, -s * 0.5);
    }
    put(new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 18, 18), skin), g, 0, 195, -1); // 太い首

    // ---- 頭 ----
    const skullE = { cx: 0, cy: 217, cz: 0, rx: 17, ry: 13, rz: 17 };
    ell(skin, 0, 217, 0, 17, 13, 17);
    box(skin, 38, 18, 28, 0, 205, 3);        // 四角い下顎
    box(skin, 28, 7, 5, 0, 198.5, 18.5);     // 張り出した顎先
    for (const s of [-1, 1]) {
      box(skin, 6, 13, 20, s * 18.5, 202, 2);  // えら
      ell(skin, s * 17.5, 214, -1, 2.5, 4, 3); // 耳
    }
    // 口と歯
    box(mouthM, 22, 4.2, 1, 0, 204.5, 17.2);
    const tG = new THREE.BoxGeometry(2.4, 3.2, 1.2);
    for (let i = 0; i < 8; i++) put(new THREE.Mesh(tG, toothM), g, -9.8 + i * 2.8, 206.2, 17.6).rotation.z = (i % 3 - 1) * 0.06;
    for (let i = 0; i < 6; i++) put(new THREE.Mesh(tG, toothM), g, -7 + i * 2.8, 202.9, 17.6).rotation.z = (i % 2 - 0.5) * 0.1;
    box(skin, 6, 9, 5, 0, 211, 17.5);        // 鼻
    // 目(うつろ)
    for (const s of [-1, 1]) {
      ell(socketM, s * 7.5, 216, 12, 4.8, 4.2, 4.2);
      ell(eyeM, s * 7.5, 215.8, 13.2, 3.3, 3.3, 3.3);
      ell(pupilM, s * 7.5, 215.6, 16.2, 1.2, 1.2, 0.7);
      const brow = box(skin, 18, 4.5, 6, s * 9.5, 221.5, 14);
      brow.rotation.z = s * 0.18;
    }
    // 額の深いしわ
    const wG = new THREE.BoxGeometry(8, 0.9, 0.8);
    [223.5, 225.8, 228].forEach(function (yy, row) {
      [-9, 0, 9].forEach(function (xx) {
        if (row === 2 && Math.abs(xx) > 8) return;
        placeOn(new THREE.Mesh(wG, darkSkin), skullE, xx, yy, 0.1);
      });
    });
    // 眉間のしわ
    box(darkSkin, 1, 5, 1, 0, 219.5, 16.3);

    // ---- 腕(丸太、軽く前に構える) ----
    for (const s of [-1, 1]) {
      const S = new THREE.Vector3(s * 50, 186, -2);
      const pivot = new THREE.Group(); pivot.position.copy(S); g.add(pivot);   // 肩を軸に腕ごと動かす(振る舞い用)
      cur = new THREE.Group(); cur.position.copy(S).negate(); pivot.add(cur);
      g.userData[s < 0 ? 'armL' : 'armR'] = pivot;
      const E = new THREE.Vector3(s * 57, 149, 14);
      const W = new THREE.Vector3(s * 47, 141, 50);

      function limb(a, b) {
        const lg = new THREE.Group();
        lg.position.copy(a);
        const d = b.clone().sub(a); const len = d.length();
        lg.quaternion.setFromUnitVectors(Y, d.normalize());
        cur.add(lg);
        return { lg: lg, len: len };
      }
      // 上腕(肌)+ 肘上で裂けた袖
      const up = limb(S, E);
      put(new THREE.Mesh(new THREE.CylinderGeometry(10.5, 12.5, up.len, 16), skin), up.lg, 0, up.len / 2, 0);
      const sl = up.len * 0.68;
      put(new THREE.Mesh(new THREE.CylinderGeometry(13.6, 15, sl, 18, 1, true), uniPlain), up.lg, 0, sl / 2, 0);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2, hh = 3 + ((i * 37) % 5);
        const t = new THREE.Mesh(new THREE.ConeGeometry(2.6, hh, 4), uniPlain);
        t.scale.z = 0.3;
        put(t, up.lg, Math.cos(a) * 13.6, sl + hh / 2 - 1, Math.sin(a) * 13.6);
        t.rotation.y = -a;
      }
      ell(skin, E.x, E.y, E.z, 10.5, 10.5, 10.5); // 肘
      // 前腕
      const fo = limb(E, W);
      put(new THREE.Mesh(new THREE.CylinderGeometry(8.6, 10.5, fo.len, 16), skin), fo.lg, 0, fo.len / 2, 0);
      // 大きな拳
      box(skin, 14, 13, 15, s * 47, 139.5, 57);
      box(skin, 4, 4.5, 9, s * 39.5, 141, 58);   // 親指
      for (let k = 0; k < 4; k++) ell(skin, s * 47 + (k - 1.5) * 3.3, 142.5, 64.5, 1.8, 2.2, 2);
    }

    cur = g;
    g.userData.colliders = [[-52, 0, -34, 52, 200, 42]];
    return g;
  };
})();
