(function () {
  window.MODELS = window.MODELS || {};

  // ---------- helpers ----------
  function cv(w, h, fn, rx, ry) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rx) t.repeat.set(rx, ry || rx);
    t.anisotropy = 4;
    return t;
  }
  function speckle(x, w, h, n, a, cols) {
    for (let i = 0; i < n; i++) {
      x.fillStyle = cols[i % cols.length].replace('A', a * Math.random());
      x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  const steelTex = () => cv(256, 256, (x, w, h) => {
    x.fillStyle = '#b9bcc0'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const g = 150 + Math.random() * 90 | 0;
      x.fillStyle = 'rgba(' + g + ',' + g + ',' + (g + 4) + ',0.35)';
      x.fillRect(0, Math.random() * h, w, 1 + Math.random() * 1.5);
    }
    speckle(x, w, h, 120, 0.12, ['rgba(60,60,60,A)']);
  }, 1, 1);
  function mat(color, o) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.6, metalness: 0 }, o || {}));
  }
  function add(g, geo, m, x, y, z) {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x || 0, y || 0, z || 0);
    me.castShadow = me.receiveShadow = true;
    g.add(me);
    return me;
  }
  function box(g, w, h, d, m, x, y, z) { return add(g, new THREE.BoxGeometry(w, h, d), m, x, y, z); }
  function cyl(g, rt, rb, h, m, x, y, z, seg) { return add(g, new THREE.CylinderGeometry(rt, rb, h, seg || 20), m, x, y, z); }
  function finish(me) { me.castShadow = me.receiveShadow = true; return me; }
  function rnd(a) { return a[Math.random() * a.length | 0]; }
  // 決定的な乱数(毎回同じ見た目)
  let seed = 12345;
  function R() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  // =========================================================
  // 1 wall_drink: 壁沿い飲料ウォークイン冷蔵ケース 180x200x60
  // =========================================================
  window.MODELS.wall_drink = function () {
    seed = 101;
    const g = new THREE.Group();
    const W = 180, H = 200, D = 60;
    const white = mat(0xe8eaec, { roughness: 0.45 });
    const dark = mat(0x2b2e31, { roughness: 0.5, metalness: 0.4 });
    const steel = mat(0xffffff, { map: steelTex(), roughness: 0.35, metalness: 0.7 });
    const inner = mat(0xdfe6ea, { roughness: 0.6 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false });
    const lamp = mat(0xffffff, { emissive: 0xeaf6ff, emissiveIntensity: 1.6 });
    const glow = mat(0xf2f8fb, { emissive: 0xcfe6f0, emissiveIntensity: 0.35, roughness: 0.8 });

    // 本体
    box(g, W, 10, D, dark, 0, 5, 0);                       // 台座(蹴込み)
    box(g, W, 6, D - 2, steel, 0, 13, 0);                  // 底板
    box(g, 4, H - 10, D, white, -W / 2 + 2, 10 + (H - 10) / 2, 0);
    box(g, 4, H - 10, D, white, W / 2 - 2, 10 + (H - 10) / 2, 0);
    box(g, W - 8, H - 10, 3, glow, 0, 10 + (H - 10) / 2, -D / 2 + 1.5); // 背板(淡く光る)
    box(g, W, 24, D, white, 0, H - 12, 0);                 // 上部看板ボックス
    box(g, W - 12, 14, 1, mat(0x1f5aa6, { roughness: 0.5 }), 0, H - 12, D / 2 + 0.2); // 青い帯(ロゴ無し)
    // 庫内灯(天井と縦枠内側)
    box(g, W - 12, 1.5, 6, lamp, 0, H - 24.5, 6);
    box(g, W - 12, 1.5, 6, lamp, 0, H - 24.5, -14);
    for (let i = 0; i < 2; i++) box(g, 1.5, H - 50, 3, lamp, (i ? 1 : -1) * (W / 2 - 5), 100, -D / 2 + 5);

    // 段棚 5段
    const shelfY = [16, 56, 96, 136, 176];
    shelfY.forEach((y, i) => {
      if (i) box(g, W - 8, 1.5, D - 8, steel, 0, y, -2);
      box(g, W - 8, 4, 1.5, dark, 0, y + 1, D / 2 - 7); // 前の値札レール
    });

    // ボトル(InstancedMesh)
    const bodyGeo = new THREE.CylinderGeometry(3.3, 3.3, 20, 12);
    const capGeo = new THREE.CylinderGeometry(1.6, 1.6, 2.5, 8);
    const rows = [-14, -3, 8]; // 奥行き方向
    const per = 25;
    const list = [];
    shelfY.forEach((y, si) => {
      if (si === 4 && false) return;
      const h = si === 4 ? 12 : 20;
      rows.forEach(z => {
        for (let k = 0; k < per; k++) {
          if (R() < 0.08) continue;
          list.push({ x: -W / 2 + 10 + k * ((W - 20) / (per - 1)), y: y + 0.75 + h / 2, z: z, s: h / 20, c: si });
        }
      });
    });
    // 最上段は低い缶を除外せず小さめ
    const bodyM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyM, list.length);
    const caps = new THREE.InstancedMesh(capGeo, mat(0xffffff, { roughness: 0.5 }), list.length);
    bodies.castShadow = bodies.receiveShadow = caps.castShadow = true;
    const pal = [0x2e86c1, 0x27ae60, 0xe67e22, 0xc0392b, 0xf1c40f, 0x8e44ad, 0xecf0f1, 0x16a085, 0x6e4a2b];
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach((b, i) => {
      m4.makeScale(1, b.s, 1).setPosition(b.x, b.y, b.z);
      bodies.setMatrixAt(i, m4);
      bodies.setColorAt(i, c.setHex(pal[(Math.floor(b.x / 22) + b.c * 3 + (b.z > 0 ? 1 : 0)) % pal.length]));
      m4.makeTranslation(b.x, b.y + b.s * 10 + 1.2, b.z);
      caps.setMatrixAt(i, m4);
      caps.setColorAt(i, c.setHex(R() < 0.5 ? 0xffffff : 0x222222));
    });
    g.add(bodies); g.add(caps);

    // ガラス扉 3枚
    const dw = (W - 8) / 3;
    for (let i = 0; i < 3; i++) {
      const cx = -W / 2 + 4 + dw * (i + 0.5);
      const zf = D / 2 + 1;
      const fh = H - 10 - 24;
      const cy = 10 + fh / 2;
      box(g, dw - 1, fh, 0.6, glass, cx, cy, zf).castShadow = false;
      box(g, dw - 1, 2.5, 3, dark, cx, 10 + 1.25, zf);
      box(g, dw - 1, 2.5, 3, dark, cx, H - 24 - 1.25, zf);
      box(g, 2.5, fh, 3, dark, cx - dw / 2 + 0.75, cy, zf);
      box(g, 2.5, fh, 3, dark, cx + dw / 2 - 0.75, cy, zf);
      // 取っ手(縦バー)
      const hx = cx + (i === 1 ? -1 : 1) * (dw / 2 - 5);
      box(g, 2, 50, 2, steel, hx, cy, zf + 6);
      box(g, 2, 2, 5, steel, hx, cy + 22, zf + 3.5);
      box(g, 2, 2, 5, steel, hx, cy - 22, zf + 3.5);
    }
    g.userData.colliders = [[-W / 2, 0, -D / 2, W / 2, H, D / 2]];
    return g;
  };

  // =========================================================
  // 2 stock_rack: バックヤード在庫棚 90x60x180
  // =========================================================
  window.MODELS.stock_rack = function () {
    seed = 202;
    const g = new THREE.Group();
    const W = 90, D = 60, H = 180;
    const brownTex = cv(128, 128, (x, w, h) => {
      x.fillStyle = '#7a5a3c'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(' + (60 + Math.random() * 40 | 0) + ',40,20,0.18)'; x.fillRect(0, Math.random() * h, w, 1); }
      speckle(x, w, h, 150, 0.2, ['rgba(20,10,0,A)', 'rgba(200,170,130,A)']);
    }, 1, 1);
    const post = mat(0x6b4a2e, { map: brownTex, roughness: 0.55, metalness: 0.5 });
    const shelfM = mat(0x7d5a3a, { map: brownTex, roughness: 0.6, metalness: 0.4 });
    // 支柱(アングル風: 2枚板)
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => {
      const px = p[0] * (W / 2 - 2), pz = p[1] * (D / 2 - 2);
      box(g, 4, H, 1.2, post, px, H / 2, pz + p[1] * 1.4 * -0.0);
      box(g, 1.2, H, 4, post, px + p[0] * -0.0, H / 2, pz);
    });
    // 棚板 4段 + 補強
    const ys = [15, 62, 109, 156];
    ys.forEach(y => {
      box(g, W - 2, 2, D - 2, shelfM, 0, y, 0);
      box(g, W - 2, 4, 1, post, 0, y - 2, D / 2 - 1);
      box(g, W - 2, 4, 1, post, 0, y - 2, -D / 2 + 1);
    });
    // 背面ブレース(X字)
    const len = Math.hypot(W - 6, 47);
    const ang = Math.atan2(47, W - 6);
    [[ang, 38], [-ang, 86]].forEach(a => {
      const b = box(g, len, 1.5, 0.8, post, 0, a[1] + 0, -D / 2 + 0.6);
      b.rotation.z = a[0];
    });
    // 段ボール
    const cardTex = cv(128, 128, (x, w, h) => {
      x.fillStyle = '#c59a62'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(120,80,30,0.12)'; x.fillRect(0, i * 3.2, w, 1); }
      x.fillStyle = 'rgba(80,50,20,0.9)'; x.fillRect(0, 0, w, 1); x.fillRect(0, h - 2, w, 2);
      x.fillStyle = 'rgba(70,40,15,0.55)'; x.font = 'bold 14px sans-serif'; x.fillText('FRAGILE', 10, 95);
      x.fillRect(12, 105, 60, 3); x.fillRect(12, 112, 40, 3);
      speckle(x, w, h, 200, 0.2, ['rgba(60,40,10,A)']);
    }, 1, 1);
    const tapeM = mat(0xd9c28f, { roughness: 0.3 });
    const specs = [
      [0, [[-22, 36, 26, 28], [10, 26, 24, 22], [30, 22, 26, 26]]],
      [1, [[-26, 30, 40, 28], [8, 36, 30, 34], [32, 20, 22, 20]]],
      [2, [[-28, 24, 24, 30], [-2, 30, 28, 24], [28, 26, 32, 36]]],
      [3, [[-20, 34, 36, 22], [18, 30, 26, 18]]]
    ];
    specs.forEach(s => {
      const y0 = ys[s[0]] + 1;
      s[1].forEach(b => {
        const bw = b[1], bd = b[2], bh = b[3];
        const m = mat(0xffffff, { map: cardTex, roughness: 0.85 });
        const rz = (R() - 0.5) * 0.05;
        const bx = box(g, bw, bh, bd, m, b[0], y0 + bh / 2, 0 + (R() - 0.5) * 6);
        bx.rotation.y = rz;
        box(g, bw + 0.2, 0.15, 5, tapeM, b[0], y0 + bh + 0.1, bx.position.z).rotation.y = rz;
        if (s[0] < 3 && R() < 0.5 && bh < 26) {
          const m2 = mat(0xffffff, { map: cardTex, roughness: 0.85 });
          box(g, bw - 6, 14, bd - 6, m2, b[0], y0 + bh + 7, bx.position.z);
        }
      });
    });
    g.userData.colliders = [[-W / 2, 0, -D / 2, W / 2, H, D / 2]];
    return g;
  };

  // =========================================================
  // 3 freezer: 業務用縦型冷凍庫 90x75x190
  // =========================================================
  window.MODELS.freezer = function () {
    const g = new THREE.Group();
    const W = 90, D = 75, H = 190;
    const steel = mat(0xffffff, { map: steelTex(), roughness: 0.32, metalness: 0.75 });
    const dark = mat(0x26292c, { roughness: 0.5, metalness: 0.3 });
    const rubber = mat(0x151515, { roughness: 0.9 });
    const disp = mat(0x0a1a12, { emissive: 0x33ff88, emissiveIntensity: 1.2 });
    const dispTex = cv(128, 64, (x, w, h) => {
      x.fillStyle = '#031a0c'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#5cff9c'; x.font = 'bold 40px monospace'; x.fillText('-20', 14, 46);
      x.font = 'bold 20px monospace'; x.fillText('C', 92, 28);
    });
    const dispM = mat(0x000000, { emissive: 0xffffff, emissiveMap: dispTex, emissiveIntensity: 1.1, map: dispTex });
    // 脚
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => cyl(g, 3, 3.5, 10, dark, p[0] * (W / 2 - 8), 5, p[1] * (D / 2 - 8), 12));
    box(g, W, H - 10, D - 4, steel, 0, 10 + (H - 10) / 2, -2);                 // 本体
    box(g, W - 6, H - 30, 3, steel, 0, 10 + (H - 30) / 2 + 2, D / 2 - 2);      // 扉
    box(g, W - 4, 2, 2, rubber, 0, 12, D / 2 - 0.4);                           // パッキン
    box(g, 2, H - 24, 2, rubber, -W / 2 + 3, 10 + (H - 24) / 2 + 2, D / 2 - 0.4);
    box(g, 2, H - 24, 2, rubber, W / 2 - 3, 10 + (H - 24) / 2 + 2, D / 2 - 0.4);
    box(g, W - 6, 2, 2, rubber, 0, H - 24, D / 2 - 0.4);
    // 上部コントロールパネル
    box(g, W - 2, 18, 3, dark, 0, H - 11, D / 2 - 2);
    box(g, 26, 10, 0.6, dispM, -12, H - 11, D / 2 - 0.3);
    cyl(g, 3, 3, 1.5, steel, 20, H - 11, D / 2 - 0.5).rotation.x = Math.PI / 2;
    cyl(g, 1.3, 1.3, 1, mat(0xff4444, { emissive: 0xff2222, emissiveIntensity: 0.9 }), 31, H - 11, D / 2 - 0.4).rotation.x = Math.PI / 2;
    // 取っ手(縦)
    const hx = W / 2 - 12;
    box(g, 3, 70, 3, steel, hx, 100, D / 2 + 6);
    box(g, 3, 3, 6, steel, hx, 132, D / 2 + 3);
    box(g, 3, 3, 6, steel, hx, 68, D / 2 + 3);
    // 側面の通気スリット
    for (let i = 0; i < 6; i++) box(g, 1, 1.2, 30, dark, W / 2 + 0.1, 40 + i * 3, -2);
    // 上面
    box(g, W - 4, 1.5, D - 6, steel, 0, H + 0.2, -2);
    // 結露・霜の筋
    box(g, W - 10, 1.5, 0.4, mat(0xe8f4ff, { transparent: true, opacity: 0.5 }), 0, 140, D / 2 + 0.6);
    g.userData.colliders = [[-W / 2, 0, -D / 2, W / 2, H, D / 2]];
    return g;
  };

  // =========================================================
  // 4 fryer: 電気フライヤー(卓上) 幅40 x 奥行き50 x 高さ約34
  // =========================================================
  window.MODELS.fryer = function () {
    const g = new THREE.Group();
    const W = 40, D = 50, H = 30;
    const steel = mat(0xffffff, { map: steelTex(), roughness: 0.3, metalness: 0.8 });
    const dark = mat(0x1b1b1b, { roughness: 0.6 });
    const oil = mat(0xd9a21b, { roughness: 0.1, metalness: 0.1, emissive: 0x3a2400, emissiveIntensity: 0.4 });
    const wire = mat(0x9aa0a6, { roughness: 0.3, metalness: 0.9 });
    // 脚
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => cyl(g, 1.5, 2, 3, dark, p[0] * (W / 2 - 4), 1.5, p[1] * (D / 2 - 4), 10));
    // 本体
    box(g, W, H - 3, D - 18, steel, 0, 3 + (H - 3) / 2, -9);    // 後ろ(油槽側)
    box(g, W, 16, 18, steel, 0, 3 + 8, D / 2 - 9);               // 前のコントロール部
    // 油槽(上面の開口を4枚で囲む+油面)
    const tz = -9;
    const ox = W - 8, oz = D - 24;
    box(g, ox, 0.6, oz, oil, 0, H - 4, tz);
    box(g, ox + 2, 4, 1, steel, 0, H - 2, tz - oz / 2 - 0.5);
    box(g, ox + 2, 4, 1, steel, 0, H - 2, tz + oz / 2 + 0.5);
    box(g, 1, 4, oz, steel, -ox / 2 - 0.5, H - 2, tz);
    box(g, 1, 4, oz, steel, ox / 2 + 0.5, H - 2, tz);
    // ヒーター管(油中)
    const hm = mat(0xc4c8cc, { metalness: 0.9, roughness: 0.3 });
    [-6, 6].forEach(x => {
      const c = cyl(g, 0.7, 0.7, oz - 4, hm, x, H - 8, tz, 8); c.rotation.x = Math.PI / 2;
    });
    // バスケット(浮かせて縁に引っ掛け)
    const bw = ox - 4, bd = oz - 4, bh = 9, by = H - 4 + 1;
    const bk = new THREE.Group();
    box(bk, bw, 0.6, bd, wire, 0, 0, 0);
    for (let i = 0; i <= 6; i++) {
      box(bk, 0.4, bh, bd, wire, -bw / 2 + i * bw / 6, bh / 2, 0);
    }
    for (let j = 0; j <= 8; j++) {
      box(bk, bw, 0.4, 0.4, wire, 0, bh * (j % 3 + 1) / 3, -bd / 2 + j * bd / 8).visible = false;
    }
    [-1, 1].forEach(s => {
      box(bk, bw, 0.6, 0.6, wire, 0, bh, s * bd / 2);
      box(bk, 0.6, 0.6, bd, wire, s * bw / 2, bh, 0);
    });
    // 揚げ物ちょっと入れる
    // 取っ手(前に伸びる黒グリップ)
    box(bk, 1, 1, 12, wire, 0, bh - 1, bd / 2 + 6);
    cyl(bk, 1.6, 1.6, 14, dark, 0, bh - 1, bd / 2 + 17, 12).rotation.x = Math.PI / 2;
    bk.position.set(0, by, tz);
    bk.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    g.add(bk);
    // コントロールパネル(前面)
    box(g, W - 4, 12, 1, dark, 0, 11, D / 2 + 0.2);
    [-10, 0, 10].forEach(x => {
      cyl(g, 2.6, 2.6, 2.5, steel, x, 11, D / 2 + 1.8, 16).rotation.x = Math.PI / 2;
      box(g, 0.6, 3, 0.5, dark, x, 12, D / 2 + 3.2);
    });
    box(g, 4, 2, 1, mat(0xff3a2a, { emissive: 0xff2010, emissiveIntensity: 1 }), 14, 15, D / 2 + 0.8);
    // 背面の排気グリル
    for (let i = 0; i < 4; i++) box(g, W - 12, 0.8, 0.8, dark, 0, 10 + i * 4, -D / 2 + 0.2);
    // 電源コード
    cyl(g, 0.5, 0.5, 18, dark, 14, 6, -D / 2 - 9, 6).rotation.x = Math.PI / 2;
    return g;
  };

  // =========================================================
  // 5 hot_case: ホットスナック保温ガラスケース 90x45x60
  // =========================================================
  window.MODELS.hot_case = function () {
    seed = 505;
    const g = new THREE.Group();
    const W = 90, D = 45, H = 60;
    const steel = mat(0xffffff, { map: steelTex(), roughness: 0.32, metalness: 0.7 });
    const dark = mat(0x222426, { roughness: 0.5, metalness: 0.3 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f4, transparent: true, opacity: 0.14, roughness: 0.05, depthWrite: false });
    const lamp = mat(0xffffff, { emissive: 0xffc27a, emissiveIntensity: 1.8 });
    const tray = mat(0xcfd2d6, { roughness: 0.3, metalness: 0.8 });
    // 基部
    box(g, W, 14, D, steel, 0, 7, 0);
    box(g, 22, 8, 0.8, dark, -W / 2 + 14, 7, D / 2 + 0.3);
    box(g, 6, 3, 0.5, mat(0xff8a2a, { emissive: 0xff7a10, emissiveIntensity: 1 }), W / 2 - 12, 7, D / 2 + 0.6);
    // フレーム(四隅)
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => box(g, 2, H - 14, 2, dark, p[0] * (W / 2 - 1), 14 + (H - 14) / 2, p[1] * (D / 2 - 1)));
    // 天板
    box(g, W, 3, D, steel, 0, H - 1.5, 0);
    box(g, W - 4, 1, D - 4, lamp, 0, H - 3.5, 0);
    // ガラス(前・左右・後ろ)
    box(g, W - 4, H - 18, 0.5, glass, 0, 14 + (H - 14) / 2 - 2, D / 2 - 0.5).castShadow = false;
    box(g, W - 4, H - 18, 0.5, glass, 0, 14 + (H - 14) / 2 - 2, -D / 2 + 0.5).castShadow = false;
    [-1, 1].forEach(s => box(g, 0.5, H - 18, D - 4, glass, s * (W / 2 - 0.5), 14 + (H - 14) / 2 - 2, 0).castShadow = false);
    // 2段(トレイ+ランプ)
    const ys = [14, 36];
    ys.forEach((y, i) => {
      box(g, W - 4, 1, D - 4, tray, 0, y + 0.5, 0);
      box(g, W - 4, 1.5, 1, dark, 0, y + 1.5, D / 2 - 3);  // 手前の仕切り
      if (i) box(g, W - 8, 1, 4, lamp, 0, y - 1.5, 0);
      // 仕切り板
      [-30, 0, 30].forEach(x => box(g, 0.6, 10, D - 8, tray, x, y + 6, 0));
    });
    // 揚げ物
    const brown = [0xb8741f, 0xa4621a, 0xc98a2e];
    const sph = new THREE.SphereGeometry(3.4, 10, 8);
    const cro = new THREE.CylinderGeometry(2.6, 2.6, 9, 10);
    const sticks = new THREE.CylinderGeometry(1.8, 1.8, 14, 8);
    const fm = (n) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    const spheres = [], cros = [], stk = [];
    ys.forEach((y, yi) => {
      [-45 + 2, -30, 0, 30].forEach((x0, ci) => { /* 4列の区画 */ });
      const cells = [[-37.5, 'sph'], [-15, 'cro'], [15, 'stk'], [37.5, yi ? 'sph' : 'cro']];
      cells.forEach(c => {
        for (let k = 0; k < 4; k++) {
          const px = c[0] + (R() - 0.5) * 8, pz = -12 + k * 8 + (R() - 0.5) * 2;
          if (c[1] === 'sph') spheres.push([px + (k % 2 ? 4 : -4) * 0.5, y + 1 + 3.2, pz]);
          else if (c[1] === 'cro') cros.push([px, y + 1 + 2.6, pz, R() * Math.PI]);
          else stk.push([px, y + 1 + 1.8, pz, (R() - 0.5) * 0.4]);
        }
      });
    });
    function inst(geo, arr, rotX) {
      const im = new THREE.InstancedMesh(geo, fm(), arr.length);
      im.castShadow = im.receiveShadow = true;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      arr.forEach((a, i) => {
        e.set(rotX ? Math.PI / 2 : 0, a[3] || 0, rotX ? 0 : 0);
        if (rotX) { q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, a[3] || 0, 'YXZ')); }
        else q.setFromEuler(e);
        m4.compose(new THREE.Vector3(a[0], a[1], a[2]), q, new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m4);
        im.setColorAt(i, c.setHex(rnd(brown)));
      });
      g.add(im);
    }
    inst(sph, spheres, false);
    inst(cro, cros, true);
    inst(sticks, stk, true);
    // 前面の値札
    [-30, 0, 30].forEach(x => box(g, 12, 3, 0.5, mat(0xfff3c4, { roughness: 0.9 }), x, 17.5, D / 2 - 2.5));
    g.userData.colliders = [[-W / 2, 0, -D / 2, W / 2, H, D / 2]];
    return g;
  };

  // =========================================================
  // 6 trash_bin: 店内ゴミ箱(分別2口) 幅90 x 高さ50 x 奥行き40
  // =========================================================
  window.MODELS.trash_bin = function () {
    seed = 606;
    const g = new THREE.Group();
    const W = 90, H = 50, D = 40;
    const greyTex = cv(128, 128, (x, w, h) => {
      x.fillStyle = '#8f9498'; x.fillRect(0, 0, w, h);
      speckle(x, w, h, 500, 0.18, ['rgba(40,40,40,A)', 'rgba(230,230,230,A)']);
      x.fillStyle = 'rgba(50,50,50,0.15)'; for (let i = 0; i < 4; i++) x.fillRect(0, 10 + i * 34, w, 2);
    }, 2, 2);
    const grey = mat(0xffffff, { map: greyTex, roughness: 0.55 });
    const dkg = mat(0x6f7478, { roughness: 0.5 });
    const bag = mat(0x0c0c0e, { roughness: 0.25, metalness: 0.05 });
    const bagDull = mat(0x18181b, { roughness: 0.4 });
    const labelTex = (txt, col) => cv(128, 64, (x, w, h) => {
      x.fillStyle = col; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(txt, w / 2, 42);
    });
    const half = W / 2;
    // 本体
    box(g, W, H - 6, D, grey, 0, (H - 6) / 2, 0);
    box(g, W + 1, 3, D + 1, dkg, 0, 1.5, 0);          // 足元の縁
    box(g, 2, H - 6, D + 0.5, dkg, 0, (H - 6) / 2, 0); // 中央の分割
    // 天板(開口 2つ: 各 34 x 22)
    const ow = 34, od = 22, ty = H - 3;
    const zb = 0;
    box(g, W, 6, (D - od) / 2, grey, 0, ty, -(od / 2 + (D - od) / 4));  // 奥
    box(g, W, 6, (D - od) / 2, grey, 0, ty, (od / 2 + (D - od) / 4));   // 手前
    const sideW = (half - ow - 1) ; // 端と中央の幅
    [-1, 1].forEach(s => {
      box(g, (W / 2 - ow) / 2 - 0.5, 6, od, grey, s * (half - ((W / 2 - ow) / 2 - 0.5) / 2 - 0.0), ty, zb);
    });
    // 開口の間の仕切り
    box(g, 2 * ((W / 2 - ow) / 2) - 0, 6, od, grey, 0, ty, zb);
    // 開口の縁リング(少し立ち上げ)
    [-1, 1].forEach(s => {
      const cx = s * W / 4;
      box(g, ow + 4, 1.5, 1.5, dkg, cx, H + 0.2, od / 2 + 0.2);
      box(g, ow + 4, 1.5, 1.5, dkg, cx, H + 0.2, -od / 2 - 0.2);
      box(g, 1.5, 1.5, od + 3, dkg, cx - ow / 2 - 0.5, H + 0.2, 0);
      box(g, 1.5, 1.5, od + 3, dkg, cx + ow / 2 + 0.5, H + 0.2, 0);
      // 中のゴミ袋(開口に黒い袋の中身と、縁に折り返し)
      box(g, ow - 2, 14, od - 2, bag, cx, H - 8, 0);
      // 縁の折り返し(開口まわり4枚)
      box(g, ow + 3, 1, 3, bagDull, cx, H + 0.9, od / 2 + 0.6);
      box(g, ow + 3, 1, 3, bagDull, cx, H + 0.9, -od / 2 - 0.6);
      box(g, 3, 1, od + 3, bagDull, cx - ow / 2 - 0.3, H + 0.9, 0);
      box(g, 3, 1, od + 3, bagDull, cx + ow / 2 + 0.3, H + 0.9, 0);
      // 袋の垂れ下がり(前後面の黒い面)
      box(g, ow, 12, 0.6, bag, cx, H - 5, od / 2 + 1.4);
      box(g, ow, 12, 0.6, bag, cx, H - 5, -od / 2 - 1.4);
      // 中身のふくらみ
      for (let k = 0; k < 3; k++) {
        const sp = add(g, new THREE.SphereGeometry(5 + R() * 2, 10, 8), bag, cx - 9 + k * 9 + (R() - 0.5) * 3, H - 1 + R() * 1.5, (R() - 0.5) * 6);
        sp.scale.y = 0.6;
      }
      // 結び目の耳
      cyl(g, 0.7, 1.3, 4, bagDull, cx + (s > 0 ? 1 : -1) * 12, H + 2.5, -od / 2 + 3, 6).rotation.z = 0.3 * s;
    });
    // 投入口の見分け用ラベル(前面)
    [[-1, 'もえる', '#c0392b'], [1, 'ペット', '#1f6fb2']].forEach(a => {
      const lm = mat(0xffffff, { map: labelTex(a[1], a[2]), roughness: 0.6 });
      box(g, 30, 12, 0.5, lm, a[0] * W / 4, H - 22, D / 2 + 0.3);
    });
    // 前面の取っ手くぼみ
    [-1, 1].forEach(s => box(g, 18, 3, 0.8, dkg, s * W / 4, 12, D / 2 + 0.2));
    g.userData.colliders = [[-half, 0, -D / 2, half, H, D / 2]];
    return g;
  };
})();
