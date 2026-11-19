// 店長ゾンビ 可愛い案(比較用)。MODELS.manager_cute(kind) kind = 'A'|'B'|'C'|'D'。原点=足元中心、+Z が正面、単位cm
(function () {
  window.MODELS = window.MODELS || {};
  const M = (c, r) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.8 : r });

  // 案ごとの違い: 頭の大きさ・体型・目・口・小物
  const KINDS = {
    A: { head: 46, body: [34, 38], legH: 22, eye: 'big', mouth: 'smile', hat: null, cheek: true, tie: false, fang: false },   // ちび(大きな丸頭)
    B: { head: 36, body: [48, 52], legH: 18, eye: 'dot', mouth: 'smile', hat: null, cheek: true, tie: true, fang: false },    // おまんじゅう体型+ネクタイ
    C: { head: 40, body: [38, 42], legH: 22, eye: 'big', mouth: 'fang', hat: 'cap', cheek: true, tie: false, fang: true },    // キャップ+ちょこん牙
    D: { head: 52, body: [32, 34], legH: 18, eye: 'button', mouth: 'stitch', hat: null, cheek: false, tie: false, fang: false }, // ぬいぐるみ風(縫い目・ボタン目)
  };

  window.MODELS.manager_cute = function (kind) {
    const K = KINDS[kind || 'A'];
    const g = new THREE.Group();
    const skin = M(0x9bbf7e, 0.7), uni = M(0x2b5fa8, 0.85), pants = M(0x222d44, 0.9), shoe = M(0x181818, 0.6);
    const white = M(0xf4f4f0, 0.4), black = M(0x14181a, 0.5), pink = M(0xe88a8a, 0.8), mouthM = M(0x3a1216, 0.9);
    const ell = (mat, x, y, z, rx, ry, rz) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), mat); m.scale.set(rx, ry, rz);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
    };
    const box = (mat, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true; g.add(m); return m;
    };

    const [bw, bh] = K.body, legH = K.legH;
    // 脚(ちょん)
    for (const s of [-1, 1]) {
      ell(pants, s * bw * 0.4, legH * 0.55, 0, 11, legH * 0.55, 11);
      ell(shoe, s * bw * 0.4, 5, 5, 11, 6, 15);
    }
    // 胴(丸い制服)
    const by = legH + bh * 0.8;
    ell(uni, 0, by, 0, bw, bh, bw * 0.8);
    box(M(0x15110e), bw * 1.7, 4, bw * 1.5, 0, legH + bh * 0.35, 0).scale.set(1, 1, 0.9); // ベルト
    // 名札
    box(white, 15, 6.5, 1.2, bw * 0.45, by + bh * 0.35, bw * 0.8 * 0.85).rotation.y = 0.35;
    box(M(0x2b5fa8), 15, 1.6, 1.4, bw * 0.45, by + bh * 0.35 + 2.4, bw * 0.8 * 0.86).rotation.y = 0.35;
    if (K.tie) {
      box(M(0xc03030), 7, 20, 2, 0, by + bh * 0.2, bw * 0.8 * 0.98);
      box(M(0xc03030), 9, 7, 2.4, 0, by + bh * 0.85, bw * 0.8 * 0.9);
    }
    // 腕(ちょこんと出す)
    for (const s of [-1, 1]) {
      const a = ell(uni, s * (bw + 6), by + bh * 0.1, 4, 10, 15, 10); a.rotation.z = -s * 0.5;
      ell(skin, s * (bw + 13), by - bh * 0.35, 8, 9, 9, 9);
    }

    // 頭
    const hr = K.head, hy = by + bh + hr * 0.62;
    ell(skin, 0, hy, 0, hr, hr * 0.88, hr * 0.92);
    for (const s of [-1, 1]) ell(skin, s * hr * 0.95, hy + 2, 0, 5, 8, 5); // 耳
    const ez = hr * 0.88, ex = hr * 0.38, ey = hy + hr * 0.08;
    for (const s of [-1, 1]) {
      if (K.eye == 'big') {
        ell(white, s * ex, ey, ez * 0.88, 9.5, 11, 4);
        ell(black, s * ex, ey - 1, ez * 0.88 + 3, 6, 7.5, 3);
        ell(white, s * ex + 2, ey + 3, ez * 0.88 + 5.5, 2.2, 2.2, 1.5);
      } else if (K.eye == 'dot') {
        ell(black, s * ex * 0.9, ey, ez * 0.93, 3.6, 4.6, 2.5);
        ell(white, s * ex * 0.9 + 1, ey + 1.5, ez * 0.93 + 2, 1.2, 1.2, 1);
      } else { // button
        ell(white, s * ex, ey, ez * 0.9, 8, 8, 3);
        ell(black, s * ex, ey, ez * 0.9 + 2.5, 5.5, 5.5, 2);
        box(black, 1.2, 8, 0.8, s * ex, ey, ez * 0.9 + 4.5); box(black, 8, 1.2, 0.8, s * ex, ey, ez * 0.9 + 4.5);
      }
      if (K.cheek) ell(pink, s * hr * 0.62, hy - hr * 0.22, ez * 0.78, 6.5, 4, 2.5);
      // まゆ(困り眉で気弱そうに)
      if (K.eye != 'button') { const b = box(M(0x46613a), 10, 2, 2, s * ex, ey + 14, ez * 0.84); b.rotation.z = s * 0.22; }
    }
    // 口
    const my = hy - hr * 0.42, mz = ez * 0.9;
    if (K.mouth == 'smile') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(7, 1.3, 8, 20, Math.PI), mouthM);
      m.position.set(0, my + 5, mz); m.rotation.z = Math.PI; g.add(m);
    } else if (K.mouth == 'fang') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(8, 1.3, 8, 20, Math.PI), mouthM);
      m.position.set(0, my + 5, mz); m.rotation.z = Math.PI; g.add(m);
      for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.5, 8), white); f.position.set(s * 4.5, my - 1.2, mz + 0.5); f.rotation.x = Math.PI; g.add(f); }
    } else { // stitch(縫い口)
      box(black, 22, 1.6, 1, 0, my, mz);
      for (let i = -4; i <= 4; i++) box(black, 1.4, 7, 1, i * 2.7, my, mz + 0.3);
    }
    // 鼻(ちょん)
    ell(M(0x86aa6a), 0, hy - hr * 0.1, ez * 0.97, 3.5, 3, 3);
    // 帽子
    if (K.hat == 'cap') {
      const cap = ell(uni, 0, hy + hr * 0.55, -2, hr * 0.98, hr * 0.5, hr * 0.95);
      box(uni, hr * 1.5, 3, hr * 0.9, 0, hy + hr * 0.42, hr * 0.85);
      box(white, 12, 8, 1, 0, hy + hr * 0.62, hr * 0.92);
    }
    // 髪の毛1本(ゾンビらしさを残す)
    if (!K.hat) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 6), M(0x333a28)); h.position.set(0, hy + hr * 0.95 + 5, 0); h.rotation.z = 0.3; g.add(h); }

    g.userData.colliders = [[-bw - 15, 0, -bw, bw + 15, hy + hr, bw]];
    return g;
  };
})();
