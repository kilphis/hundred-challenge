// day17 プレイヤー: 家ネズミ (1 = 1cm, 鼻が +Z, 原点 = 体の下の地面中心)
window.MODELS = window.MODELS || {};
window.MODELS.mouse = function () {
  const T = THREE;
  const root = new T.Group();
  root.name = 'mouse';

  // ---------- 色 ----------
  const C_BACK = new T.Color(0x726559);   // 背中 茶灰
  const C_SIDE = new T.Color(0x9a8b7f);   // 脇腹
  const C_BELLY = new T.Color(0xd8cdbf);  // お腹
  const C_PINK = 0xe2a6a2, C_NOSE = 0xd9868c, C_TAIL = 0xc9a39b;

  // ---------- テクスチャ ----------
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function furTexture() {
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const x = cv.getContext('2d');
    x.fillStyle = '#e2e2e2'; x.fillRect(0, 0, S, S);
    // 色ムラ
    for (let i = 0; i < 70; i++) {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      const px = rnd(0, S), py = rnd(0, S), r = rnd(20, 70), l = Math.round(rnd(175, 235));
      x.save(); x.translate(px, py); x.scale(r, r);
      g.addColorStop(0, `rgba(${l},${l},${l},0.35)`); g.addColorStop(1, `rgba(${l},${l},${l},0)`);
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore();
    }
    // 毛筋(v方向 = 体の前後方向)
    x.lineCap = 'round';
    for (let i = 0; i < 9000; i++) {
      const px = rnd(-10, S + 10), py = rnd(-20, S + 20), len = rnd(6, 16), ang = rnd(-0.25, 0.25);
      const l = Math.random() < 0.4 ? Math.round(rnd(120, 175)) : Math.round(rnd(225, 255));
      x.strokeStyle = `rgba(${l},${l - 4},${l - 8},${rnd(0.25, 0.6)})`;
      x.lineWidth = rnd(0.6, 1.4);
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(ang) * len, py + Math.cos(ang) * len); x.stroke();
    }
    const t = new T.CanvasTexture(cv);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  function tailTexture() {
    const W = 64, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#e6e0dc'; x.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) { // うろこの輪
      x.fillStyle = 'rgba(120,90,85,0.35)'; x.fillRect(0, y, W, 1.5);
      for (let k = 0; k < 8; k++) { x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(k * 8 + (y / 8 % 2) * 4, y + 2, 5, 4); }
    }
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(80,60,55,${rnd(0.05, 0.2)})`; x.fillRect(rnd(0, W), rnd(0, H), 1, rnd(2, 6)); }
    const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  const furTex = furTexture();
  furTex.repeat.set(5, 3);
  const tailTex = tailTexture();
  tailTex.repeat.set(1, 1);

  // ---------- マテリアル ----------
  const furMat = new T.MeshStandardMaterial({ color: 0xffffff, map: furTex, bumpMap: furTex, bumpScale: 0.04, roughness: 0.93, metalness: 0, vertexColors: true });
  const pinkMat = new T.MeshStandardMaterial({ color: C_PINK, roughness: 0.6 });
  const earInMat = new T.MeshStandardMaterial({ color: 0xe8a9a8, roughness: 0.55, side: T.DoubleSide });
  const noseMat = new T.MeshPhysicalMaterial({ color: C_NOSE, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const eyeMat = new T.MeshPhysicalMaterial({ color: 0x060404, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  const hiMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
  const tailMat = new T.MeshStandardMaterial({ color: C_TAIL, map: tailTex, roughness: 0.55 });
  const whiskMat = new T.MeshStandardMaterial({ color: 0x2c2724, roughness: 0.4 });

  // ---------- ヘルパ ----------
  function mesh(geo, mat, parent) {
    const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m); return m;
  }
  // 複数ジオメトリを1つに(position/normal/uv/color)
  function merge(list) {
    const parts = list.map(g => g.index ? g.toNonIndexed() : g);
    const out = new T.BufferGeometry();
    for (const name of ['position', 'normal', 'uv', 'color']) {
      if (!parts.every(p => p.attributes[name])) continue;
      const isz = parts[0].attributes[name].itemSize;
      let n = 0; parts.forEach(p => n += p.attributes[name].array.length);
      const arr = new Float32Array(n); let o = 0;
      parts.forEach(p => { arr.set(p.attributes[name].array, o); o += p.attributes[name].array.length; });
      out.setAttribute(name, new T.BufferAttribute(arr, isz));
    }
    return out;
  }
  function ell(rx, ry, rz, px, py, pz, ws, hs) {
    const g = new T.SphereGeometry(1, ws || 16, hs || 12);
    g.scale(rx, ry, rz); g.translate(px, py, pz); return g;
  }
  // a→b を結ぶ円柱(両端に球をつけて継ぎ目なし)
  function limb(a, b, ra, rb) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const g = new T.CylinderGeometry(rb, ra, L, 12, 1, true);
    g.translate(0, L / 2, 0);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q)); g.translate(A.x, A.y, A.z);
    return [g, ell(ra, ra, ra, A.x, A.y, A.z, 12, 8), ell(rb, rb, rb, B.x, B.y, B.z, 12, 8)];
  }
  // 毛の色を法線の向きで塗る(上=背中色、下=お腹色)。belly で境目を調整
  function colorize(g, opt) {
    opt = opt || {};
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const col = new Float32Array(n * 3), c = new T.Color();
    for (let i = 0; i < n; i++) {
      const ny = nor.getY(i), nx = nor.getX(i);
      const tB = T.MathUtils.smoothstep(-ny, opt.b0 !== undefined ? opt.b0 : 0.05, opt.b1 !== undefined ? opt.b1 : 0.55);
      const tS = T.MathUtils.smoothstep(ny, 0.35, 0.9);
      c.copy(C_SIDE).lerp(C_BACK, tS).lerp(C_BELLY, tB);
      if (opt.fn) opt.fn(c, pos.getX(i), pos.getY(i), pos.getZ(i), nx, ny);
      // 微小なムラ
      const k = 1 + (Math.sin(pos.getX(i) * 7.1 + pos.getZ(i) * 5.3) * 0.5 + Math.sin(pos.getY(i) * 9.7 - pos.getZ(i) * 3.1) * 0.5) * 0.04;
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    return g;
  }
  // (z, r) の輪郭から Z 軸回りの回転体を作り、頂点を変形
  function lathe(profile, segs, deform) {
    const pts = profile.map(p => new T.Vector2(p[1], p[0]));
    const g = new T.LatheGeometry(pts, segs);
    g.rotateX(Math.PI / 2); // lathe の +y → +z、継ぎ目は真下
    const pos = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); deform(v); pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  // 輪郭をなめらかに補間
  function smoothProfile(keys, n) {
    const curve = new T.SplineCurve(keys.map(k => new T.Vector2(k[0], k[1])));
    return curve.getPoints(n).map(p => [p.x, Math.max(0, p.y)]);
  }
  const g1 = (x, m, s) => Math.exp(-((x - m) / s) * ((x - m) / s));

  // ================= 胴 =================
  const body = new T.Group(); body.name = 'body';
  body.position.set(0, 3.0, 0);
  root.add(body);

  const torsoProfile = smoothProfile([
    [-7.0, 0.0], [-6.85, 1.15], [-6.4, 1.95], [-5.6, 2.5], [-4.6, 2.78], [-3.4, 2.8],
    [-2.2, 2.6], [-1.0, 2.3], [0.2, 1.98], [1.3, 1.72], [2.2, 1.55], [2.9, 1.3], [3.3, 0.7], [3.4, 0.0]
  ], 40);
  const torsoGeo = lathe(torsoProfile, 40, v => {
    const z = v.z;
    if (v.y < 0) v.y *= 0.9; else v.y *= 1.04;
    v.x *= 0.96 + 0.1 * g1(z, -4.2, 2.2);               // 腰まわりの張り
    v.y += 0.3 * g1(z, -3.6, 2.6);                        // 背のアーチ
    v.y -= 0.32 * Math.max(0, z + 0.5) / 3.5;             // 首へ向かって下がる
    if (v.y < -1.0) v.y = -1.0 + (v.y + 1.0) * 0.8;      // お腹を少し平らに
  });
  colorize(torsoGeo);
  mesh(torsoGeo, furMat, body).name = 'torso';

  // ================= 頭 =================
  const head = new T.Group(); head.name = 'head';
  head.position.set(0, 0.55, 2.3);   // 首
  body.add(head);
  const headPivot = new T.Group(); headPivot.rotation.x = 0.18; headPivot.scale.setScalar(1.08); head.add(headPivot);

  const headProfile = smoothProfile([
    [-1.6, 0.0], [-1.45, 0.95], [-1.0, 1.5], [-0.2, 1.78], [0.7, 1.8], [1.5, 1.6],
    [2.3, 1.22], [3.0, 0.85], [3.6, 0.55], [4.0, 0.36], [4.25, 0.18], [4.35, 0.0]
  ], 34);
  const headGeo = lathe(headProfile, 36, v => {
    const z = v.z;
    if (v.y < 0) v.y *= 0.78; else v.y *= 0.93;
    v.x *= 1.0 + 0.12 * g1(z, 0.9, 1.0);        // ほお
    v.y += 0.1 * g1(z, 0.4, 1.2);               // 頭頂の丸み
    v.y -= 0.08 * Math.max(0, z - 2.0);         // 鼻先を少し下げる
  });
  colorize(headGeo, {
    b0: 0.15, b1: 0.6,
    fn: (c, x, y, z) => { // マズルを少し明るく
      const t = T.MathUtils.smoothstep(z, 2.4, 3.8) * 0.35;
      c.lerp(C_BELLY, t);
    }
  });
  mesh(headGeo, furMat, headPivot).name = 'skull';

  // 鼻
  mesh(ell(0.3, 0.26, 0.26, 0, -0.12, 4.3, 14, 10), noseMat, headPivot).name = 'nose';

  // 目
  [1, -1].forEach(s => {
    const e = mesh(new T.SphereGeometry(0.42, 18, 14), eyeMat, headPivot);
    e.position.set(s * 1.22, 0.62, 1.7); e.scale.set(0.8, 1, 1.05);
    const h = mesh(new T.SphereGeometry(0.09, 8, 6), hiMat, headPivot);
    h.castShadow = false;
    h.position.set(s * 1.48, 0.86, 1.88);
  });

  // 耳
  const ears = {};
  [['l', 1], ['r', -1]].forEach(([k, s]) => {
    const ear = new T.Group(); ear.name = 'ear_' + k;
    ear.position.set(s * 0.92, 1.2, -0.05);
    ear.rotation.set(-0.2, s * 0.5, s * -0.4);
    ear.scale.setScalar(1.2);
    headPivot.add(ear);
    // 外側(毛)
    const og = new T.SphereGeometry(1, 20, 14);
    og.scale(0.95, 1.05, 0.22); og.translate(0, 0.85, -0.05);
    colorize(og, { fn: c => c.copy(C_SIDE).lerp(C_BACK, 0.4) });
    mesh(og, furMat, ear);
    // 内側(ピンク、くぼみ)
    const ig = new T.SphereGeometry(1, 20, 12);
    ig.scale(0.78, 0.86, 0.12); ig.translate(0, 0.9, 0.08);
    mesh(ig, earInMat, ear);
    ears[k] = ear;
  });

  // ひげ
  const whiskers = new T.Group(); whiskers.name = 'whiskers';
  whiskers.position.set(0, -0.05, 3.55);
  headPivot.add(whiskers);
  {
    const list = [];
    [1, -1].forEach(s => {
      for (let i = 0; i < 6; i++) {
        const a = (i - 2.5) * 0.16, len = 3.2 + Math.random() * 1.2 - Math.abs(i - 2.5) * 0.25;
        const p0 = new T.Vector3(s * 0.32, 0.1 + (i - 2.5) * 0.07, 0.2);
        const p2 = new T.Vector3(s * (0.32 + len * Math.cos(a) * 0.85), p0.y + len * Math.sin(a) * 0.6 - 0.2, -len * 0.45);
        const p1 = p0.clone().lerp(p2, 0.5).add(new T.Vector3(0, 0.35, 0.3));
        const tg = new T.TubeGeometry(new T.QuadraticBezierCurve3(p0, p1, p2), 8, 0.022, 3, false);
        tg.deleteAttribute('uv'); list.push(tg);
      }
    });
    const wm = mesh(merge(list), whiskMat, whiskers); wm.castShadow = false;
  }

  // ================= 脚 =================
  const legs = {};
  function makeLeg(key, front, s) {
    const leg = new T.Group(); leg.name = 'leg_' + key;
    const fur = [], pink = [];
    if (front) {
      leg.position.set(s * 1.25, -0.9, 1.9);  // 肩 (地面から 2.1)
      fur.push(ell(0.72, 1.15, 0.85, -s * 0.22, 0.15, -0.1));
      fur.push(...limb([0, -0.45, 0.0], [0, -1.55, 0.2], 0.4, 0.24));
      pink.push(...limb([0, -1.55, 0.2], [0, -1.9, 0.35], 0.2, 0.16));
      pink.push(ell(0.36, 0.13, 0.42, 0, -1.97, 0.5));
      for (let f = 0; f < 4; f++) {
        const a = (f - 1.5) * 0.38;
        pink.push(ell(0.08, 0.07, 0.17, Math.sin(a) * 0.4, -1.99, 0.5 + Math.cos(a) * 0.42));
      }
    } else {
      leg.position.set(s * 1.5, -0.3, -4.0); // 腰 (地面から 2.7)
      fur.push(ell(0.75, 1.25, 1.35, s * 0.12, -0.1, 0.1));
      fur.push(...limb([0, -0.9, -0.05], [0, -2.2, -0.8], 0.36, 0.2));
      pink.push(...limb([0, -2.2, -0.8], [0, -2.57, -0.72], 0.18, 0.14));
      pink.push(ell(0.36, 0.14, 1.1, 0, -2.58, 0.15));
      for (let f = 0; f < 5; f++) {
        const a = (f - 2) * 0.3;
        pink.push(ell(0.08, 0.07, 0.2, Math.sin(a) * 0.48, -2.62, 0.95 + Math.cos(a) * 0.28));
      }
    }
    const fg = merge(fur.map(g => colorize(g, { b0: -0.2, b1: 0.4 })));
    mesh(fg, furMat, leg);
    mesh(merge(pink), pinkMat, leg);
    body.add(leg);
    legs[key] = leg;
  }
  makeLeg('fl', true, 1); makeLeg('fr', true, -1);
  makeLeg('bl', false, 1); makeLeg('br', false, -1);

  // ================= 尻尾 =================
  const tail = [];
  {
    const N = 10, L = 1.22;
    const base = new T.Group(); // 付け根(胴内部、尻の下寄り)
    base.position.set(0, -0.35, -6.5);
    body.add(base);
    let parent = base;
    const restX = [-0.45, -0.4, 0.25, 0.4, 0.2, 0.0, 0.0, 0.0, 0.0, 0.0];
    const restY = [0.0, 0.06, 0.1, 0.14, 0.14, 0.1, 0.0, -0.12, -0.18, -0.2];
    for (let i = 0; i < N; i++) {
      const seg = new T.Group(); seg.name = 'tail' + i;
      if (i > 0) seg.position.set(0, 0, -L);
      seg.rotation.set(restX[i], restY[i], 0);
      const r0 = 0.17 * (1 - i / N) + 0.05, r1 = 0.17 * (1 - (i + 1) / N) + 0.05;
      const cg = new T.CylinderGeometry(r1, r0, L * 1.06, 12, 1, true);
      cg.translate(0, L * 0.53, 0); cg.rotateX(-Math.PI / 2); // +y → -z
      // uv の v を長さ方向に
      const parts = [cg, new T.SphereGeometry(r0, 12, 8)];
      if (i === N - 1) { const tip = new T.SphereGeometry(r1, 10, 6); tip.translate(0, 0, -L); parts.push(tip); }
      mesh(merge(parts), tailMat, seg);
      parent.add(seg); parent = seg; tail.push(seg);
    }
  }

  root.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; } });
  root.userData.parts = { body, head, legs, tail, ears, whiskers };
  root.userData.colliders = [];
  root.userData.size = { w: 5.6, h: 6.2, l: 14.0 };
  return root;
};
