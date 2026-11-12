// day17 人間: 部屋着でくつろぐ大人 (1 = 1cm, 身長 160, 正面 +Z, 原点 = 両足の間の床)
// 部品: userData.parts = { body, torso, head, legs:{l,r}(userData.knee), arms:{l,r}(userData.elbow) }
window.MODELS = window.MODELS || {};
window.MODELS.human = function () {
  const T = THREE;
  const root = new T.Group();
  root.name = 'human';

  // ================= 小道具 =================
  let seed = 1717;
  const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gs = (x, m, s) => Math.exp(-((x - m) / s) * ((x - m) / s));
  const sgnp = (c, p) => Math.sign(c) * Math.pow(Math.abs(c), p);
  // [[x, y], ...] を通るなめらかな 1 変数関数(エルミート補間)
  function curveFn(keys) {
    const n = keys.length, m = [];
    for (let i = 0; i < n; i++) {
      const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)];
      m.push((b[1] - a[1]) / (b[0] - a[0]));
    }
    return x => {
      if (x <= keys[0][0]) return keys[0][1];
      if (x >= keys[n - 1][0]) return keys[n - 1][1];
      let i = 0; while (x > keys[i + 1][0]) i++;
      const x0 = keys[i][0], x1 = keys[i + 1][0], h = x1 - x0, t = (x - x0) / h;
      const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * keys[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * keys[i + 1][1] + (t3 - t2) * h * m[i + 1];
    };
  }

  // 法線: 同じ位置の頂点をまとめて平均(継ぎ目・極を消す)し、外向きにそろえる
  function finish(g) {
    g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, map = new Map();
    for (let i = 0; i < pos.count; i++) {
      const k = Math.round(pos.getX(i) * 200) + '_' + Math.round(pos.getY(i) * 200) + '_' + Math.round(pos.getZ(i) * 200);
      let e = map.get(k); if (!e) { e = [0, 0, 0, []]; map.set(k, e); }
      e[0] += nor.getX(i); e[1] += nor.getY(i); e[2] += nor.getZ(i); e[3].push(i);
    }
    map.forEach(e => {
      const l = Math.hypot(e[0], e[1], e[2]) || 1;
      e[3].forEach(i => nor.setXYZ(i, e[0] / l, e[1] / l, e[2] / l));
    });
    // 外向きチェック
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < pos.count; i++) { cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i); }
    cx /= pos.count; cy /= pos.count; cz /= pos.count;
    let s = 0;
    for (let i = 0; i < pos.count; i++) s += nor.getX(i) * (pos.getX(i) - cx) + nor.getY(i) * (pos.getY(i) - cy) + nor.getZ(i) * (pos.getZ(i) - cz);
    if (s < 0) {
      for (let i = 0; i < nor.array.length; i++) nor.array[i] *= -1;
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
    }
    return g;
  }
  // (u,v) 格子から面を作る。fn(u, v, i, j) -> [x,y,z]
  function surf(nu, nv, fn, wrap, ur, vr) {
    ur = ur || 1; vr = vr || 1;
    const P = [], UV = [], I = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, p = fn(wrap && i === nu ? 0 : u, j / nv, wrap && i === nu ? 0 : i, j);
        P.push(p[0], p[1], p[2]); UV.push(u * ur, (1 - j / nv) * vr);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, d = a + nu + 1, c = d + 1;
      I.push(a, d, b, b, d, c);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2));
    g.setIndex(I);
    return finish(g);
  }
  // 輪郭 [[y, r], ...] の回転体。shape(th, y, r, v) -> [x,y,z]。th=0 が +Z(正面)
  function lathe(keys, nu, nv, shape, ur, vr) {
    const cv = new T.CatmullRomCurve3(keys.map(k => new T.Vector3(k[1], k[0], 0)), false, 'centripetal');
    const pts = cv.getSpacedPoints(nv);
    return surf(nu, nv, (u, v, i, j) => {
      const p = pts[j], th = u * Math.PI * 2, r = Math.max(0, p.x);
      return shape ? shape(th, p.y, r, v) : [r * Math.sin(th), p.y, r * Math.cos(th)];
    }, true, ur, vr);
  }
  function ell(rx, ry, rz, x, y, z, ws, hs) {
    const g = new T.SphereGeometry(1, ws || 16, hs || 12); g.scale(rx, ry, rz); g.translate(x, y, z); return g;
  }
  // a→b の円柱 + 両端の球
  function limb(a, b, ra, rb, seg) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const g = new T.CylinderGeometry(rb, ra, L, seg || 10, 1, true);
    g.translate(0, L / 2, 0);
    g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize())));
    g.translate(A.x, A.y, A.z);
    return [g, ell(ra, ra, ra, A.x, A.y, A.z, seg || 10, 8), ell(rb, rb, rb, B.x, B.y, B.z, seg || 10, 8)];
  }
  function paint(g, fn) { // 頂点色
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new T.Color();
    for (let i = 0; i < pos.count; i++) { fn(c, pos.getX(i), pos.getY(i), pos.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); return g;
  }
  function merge(list) {
    const parts = list.map(g => g.index ? g.toNonIndexed() : g);
    const hasCol = parts.some(p => p.attributes.color);
    const out = new T.BufferGeometry();
    const spec = [['position', 3, 0], ['normal', 3, 0], ['uv', 2, 0]];
    if (hasCol) spec.push(['color', 3, 1]);
    for (const [name, sz, fill] of spec) {
      let n = 0; parts.forEach(p => n += p.attributes.position.count * sz);
      const arr = new Float32Array(n); let o = 0;
      parts.forEach(p => {
        const a = p.attributes[name], cnt = p.attributes.position.count * sz;
        if (a) arr.set(a.array.subarray(0, cnt), o); else arr.fill(fill, o, o + cnt);
        o += cnt;
      });
      out.setAttribute(name, new T.BufferAttribute(arr, sz));
    }
    return out;
  }
  function mesh(geo, mat, parent, name) {
    const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    if (name) m.name = name; if (parent) parent.add(m); return m;
  }

  // ================= テクスチャ =================
  function canvas(S) { const cv = document.createElement('canvas'); cv.width = cv.height = S; return [cv, cv.getContext('2d')]; }
  function tex(cv) { const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; }
  function blotches(x, S, n, r0, r1, l0, l1, a) {
    for (let i = 0; i < n; i++) {
      const px = rnd(0, S), py = rnd(0, S), r = rnd(r0, r1), l = Math.round(rnd(l0, l1));
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
        g.addColorStop(0, `rgba(${l},${l},${l},${a})`); g.addColorStop(1, `rgba(${l},${l},${l},0)`);
        x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
      }
    }
  }
  // メリヤス編み: 32 目 × 40 段 / 枚
  function knitTexture() {
    const S = 512, [cv, x] = canvas(S);
    x.fillStyle = '#6c6c6c'; x.fillRect(0, 0, S, S);
    const cw = S / 32, rh = S / 40;
    for (let r = 0; r < 41; r++) for (let c = 0; c < 32; c++) {
      const cx = c * cw + cw / 2, cy = r * rh;
      const l = Math.round(rnd(205, 245));
      for (const s of [-1, 1]) {
        x.save(); x.translate(cx + s * cw * 0.22, cy); x.rotate(s * -0.55);
        const g = x.createLinearGradient(-cw * 0.25, 0, cw * 0.25, 0);
        g.addColorStop(0, `rgb(${l - 70},${l - 70},${l - 70})`); g.addColorStop(0.5, `rgb(${l},${l},${l})`); g.addColorStop(1, `rgb(${l - 60},${l - 60},${l - 60})`);
        x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, cw * 0.24, rh * 0.78, 0, 0, Math.PI * 2); x.fill(); x.restore();
      }
    }
    blotches(x, S, 40, 30, 90, 150, 255, 0.12);
    // 毛羽・毛玉
    for (let i = 0; i < 2500; i++) { const l = Math.round(rnd(200, 255)); x.strokeStyle = `rgba(${l},${l},${l},${rnd(0.08, 0.25)})`; x.lineWidth = 0.7; const px = rnd(0, S), py = rnd(0, S), a = rnd(0, 6.3), len = rnd(2, 7); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke(); }
    for (let i = 0; i < 160; i++) { const px = rnd(0, S), py = rnd(0, S), r = rnd(1.2, 2.6), l = Math.round(rnd(215, 250)); x.fillStyle = `rgba(${l},${l},${l},0.85)`; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.fillStyle = 'rgba(60,60,60,0.3)'; x.beginPath(); x.arc(px + r * 0.4, py + r * 0.5, r * 0.6, 0, 7); x.fill(); }
    return tex(cv);
  }
  // 裏起毛スウェット生地: 細かい綾目 + 杢(霜降り)
  function fleeceTexture() {
    const S = 512, [cv, x] = canvas(S);
    x.fillStyle = '#d2d2d2'; x.fillRect(0, 0, S, S);
    for (let i = -S; i < S * 2; i += 3) { x.strokeStyle = `rgba(90,90,90,${rnd(0.08, 0.16)})`; x.lineWidth = 1; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S * 0.35, S); x.stroke(); }
    for (let i = 0; i < 9000; i++) { const l = Math.random() < 0.5 ? Math.round(rnd(240, 255)) : Math.round(rnd(110, 150)); x.fillStyle = `rgba(${l},${l},${l},${rnd(0.25, 0.6)})`; x.fillRect(rnd(0, S), rnd(0, S), rnd(1, 3.5), 1); }
    blotches(x, S, 30, 40, 110, 160, 255, 0.1);
    for (let i = 0; i < 70; i++) { const px = rnd(0, S), py = rnd(0, S), r = rnd(0.8, 1.8); x.fillStyle = 'rgba(245,245,245,0.8)'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
    return tex(cv);
  }
  // フェルト
  function feltTexture() {
    const S = 512, [cv, x] = canvas(S);
    x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, S, S);
    blotches(x, S, 60, 20, 70, 140, 255, 0.18);
    for (let i = 0; i < 14000; i++) { const l = Math.random() < 0.5 ? Math.round(rnd(225, 255)) : Math.round(rnd(110, 160)); x.strokeStyle = `rgba(${l},${l},${l},${rnd(0.12, 0.35)})`; x.lineWidth = 0.6; const px = rnd(0, S), py = rnd(0, S), a = rnd(0, 6.3), len = rnd(2, 6); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + rnd(-2, 2), py + rnd(-2, 2), px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke(); }
    return tex(cv);
  }
  // 底(ゴム + クッション): 細かい凹凸
  function soleTexture() {
    const S = 256, [cv, x] = canvas(S);
    x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) { const l = Math.round(rnd(150, 255)); x.fillStyle = `rgba(${l},${l},${l},0.35)`; x.fillRect(rnd(0, S), rnd(0, S), 1.5, 1.5); }
    blotches(x, S, 20, 10, 40, 150, 255, 0.15);
    return tex(cv);
  }
  // 縫い目: 濃い帯に明るい糸の破線(u 方向に繰り返し)
  function stitchTexture() {
    const W = 64, H = 32, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#5a4434'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.2)})`; x.fillRect(rnd(0, W), rnd(0, H), 2, 1); }
    x.fillStyle = '#d9cbb0'; x.fillRect(10, 11, 38, 10);
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(12, 12, 34, 3);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(10, 19, 38, 2);
    return tex(cv);
  }
  // 髪: 縦の毛筋
  function hairTexture() {
    const S = 512, [cv, x] = canvas(S);
    x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const px = rnd(0, S), l = Math.random() < 0.5 ? Math.round(rnd(190, 255)) : Math.round(rnd(40, 110));
      x.strokeStyle = `rgba(${l},${l},${l},${rnd(0.15, 0.45)})`; x.lineWidth = rnd(0.6, 1.8);
      const py = rnd(-S * 0.2, S), len = rnd(S * 0.2, S * 0.7), bend = rnd(-8, 8);
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + bend, py + len / 2, px + bend * 0.4, py + len); x.stroke();
      x.beginPath(); x.moveTo(px, py - S); x.quadraticCurveTo(px + bend, py - S + len / 2, px + bend * 0.4, py - S + len); x.stroke();
    }
    return tex(cv);
  }
  const knitTex = knitTexture(), fleeceTex = fleeceTexture(), feltTex = feltTexture();
  const soleTex = soleTexture(), stitchTex = stitchTexture(), hairTex = hairTexture();

  // ================= マテリアル =================
  const SW = T.DoubleSide;
  const sweatMat = new T.MeshStandardMaterial({ color: 0xc3b69d, map: knitTex, bumpMap: knitTex, bumpScale: 0.25, roughness: 0.97, side: SW });
  const pantsMat = new T.MeshStandardMaterial({ color: 0x4f5664, map: fleeceTex, bumpMap: fleeceTex, bumpScale: 0.08, roughness: 0.92, side: SW });
  const sockMat = new T.MeshStandardMaterial({ color: 0xffffff, map: knitTex, bumpMap: knitTex, bumpScale: 0.15, roughness: 0.95, vertexColors: true });
  const soleMat = new T.MeshStandardMaterial({ color: 0xffffff, map: soleTex, bumpMap: soleTex, bumpScale: 0.05, roughness: 0.85, vertexColors: true });
  const feltMat = new T.MeshStandardMaterial({ color: 0x7a5c47, map: feltTex, bumpMap: feltTex, bumpScale: 0.12, roughness: 0.98, side: SW });
  const stitchMat = new T.MeshStandardMaterial({ color: 0xffffff, map: stitchTex, bumpMap: stitchTex, bumpScale: 0.06, roughness: 0.8 });
  const skinMat = new T.MeshStandardMaterial({ color: 0xe0b596, roughness: 0.62, vertexColors: true });
  const hairMat = new T.MeshStandardMaterial({ color: 0x3a2c24, map: hairTex, bumpMap: hairTex, bumpScale: 0.08, roughness: 0.55 });
  const darkMat = new T.MeshStandardMaterial({ color: 0x2b211c, roughness: 0.5 });
  const scleraMat = new T.MeshStandardMaterial({ color: 0xece6dc, roughness: 0.3 });
  const lipMat = new T.MeshStandardMaterial({ color: 0xb87b70, roughness: 0.45 });

  // ================= 寸法(立ち姿のワールド y) =================
  const BODY_Y = 92;            // 腰(body の原点)
  const HIP = [8.6, -13, 0.5];  // 股関節(body ローカル)
  const KNEE = -35;             // 股関節 → ひざ (ひざ y = 44)
  const SHOULDER = [17.3, 34, -0.8]; // 肩(torso ローカル) y = 126
  const ELBOW = -25.5;          // 肩 → ひじ (y ≈ 100.5)
  const NECK = 42;              // 首の付け根(torso ローカル) y = 134

  const body = new T.Group(); body.name = 'body'; body.position.set(0, BODY_Y, 0); root.add(body);

  // ================= 腰(ズボン) =================
  {
    const g = lathe([[5, 14.6], [0, 15.4], [-6, 16.4], [-12, 16.6], [-16, 15.2], [-19, 11], [-20.6, 5], [-21, 0]], 48, 30, (th, y, r) => {
      const c = Math.cos(th);
      let z = r * 0.72 * c;
      if (c < 0) z *= 1 + 0.16 * gs(y, -11, 5);   // お尻
      return [r * Math.sin(th), y, z + 0.5];
    }, 6, 2);
    mesh(g, pantsMat, body, 'hips');
  }

  // ================= 胴(スウェット) =================
  const torso = new T.Group(); torso.name = 'torso'; body.add(torso);
  {
    const kz = curveFn([[-14, 0.74], [-6, 0.73], [6, 0.7], [20, 0.74], [31, 0.7], [36, 0.66], [39.5, 0.85], [42, 1.0]]);
    const list = [];
    // 本体: 裾のゴムの上にたるんでかぶさる
    list.push(lathe([[-9.5, 15.6], [-8.6, 16.8], [-6.5, 17.3], [-3, 16.6], [3, 15.6], [10, 15.0], [18, 15.3], [26, 15.6], [31, 15.6], [34.5, 14.6], [37.5, 12.2], [39.6, 9.0], [41.2, 7.0], [42.2, 6.4]], 72, 64, (th, y, r) => {
      const s = Math.sin(th), c = Math.cos(th);
      // たるみのしわ(下ほど強い縦じわ + 裾上のよこじわ)
      const low = sm(10, -8, y);
      r += low * (0.45 * Math.sin(th * 7 + y * 0.12 + 0.8) + 0.25 * Math.sin(th * 13 - y * 0.2));
      r += sm(-2, -8, y) * 0.35 * Math.sin(y * 1.6 + th * 3);
      // わきの下のしわ(斜め)
      r += 0.3 * gs(y, 26, 5) * gs(Math.abs(s), 1, 0.3) * Math.sin(y * 1.1 + c * 6);
      let z = r * kz(y) * c;
      if (c > 0) z *= 1 + 0.05 * gs(y, 22, 6);  // 胸
      if (c < 0) z *= 1 + 0.06 * gs(y, 30, 6);  // 肩甲骨
      const x = r * s;
      return [x, y, z - 0.5 + 0.6 * sm(30, 42, y)];
    }, 7, 4));
    // 裾のリブ
    list.push(lathe([[-6.5, 15.4], [-7.2, 16.3], [-13.6, 16.5], [-14.3, 16.0], [-14.5, 15.2]], 288, 10, (th, y, r) => {
      r += 0.09 * Math.cos(th * 72) * sm(-6.8, -7.6, y) * sm(-14.4, -13.6, y);
      return [r * Math.sin(th), y, r * kz(y) * Math.cos(th) - 0.5];
    }, 7, 0.5));
    // 襟ぐりのリブ
    list.push(lathe([[40.6, 7.6], [41.8, 7.7], [43.6, 6.9], [44.2, 6.2], [43.6, 5.7]], 128, 8, (th, y, r) => {
      r += 0.06 * Math.cos(th * 40);
      return [r * Math.sin(th), y, r * 0.98 * Math.cos(th) + 0.1];
    }, 3, 0.3));
    mesh(merge(list), sweatMat, torso, 'sweater');
  }

  // ================= 頭 =================
  const head = new T.Group(); head.name = 'head'; head.position.set(0, NECK, 0.1); torso.add(head);
  {
    const HC = [0, 15.2, 0.9], R = [7.3, 10.6, 9.3];
    // 単位球 → 頭の形
    function headShape(ux, uy, uz, k) {
      let x = R[0] * ux * (1 - 0.3 * sm(0.05, -0.85, uy));
      let y = R[1] * uy;
      let z = R[2] * uz;
      if (uz < 0) { z *= 1 - 0.42 * sm(-0.1, -0.95, uy); z *= 1 + 0.05 * gs(uy, 0.25, 0.4); }
      else { z *= 1 - 0.1 * sm(-0.3, -0.95, uy) + 0.03 * gs(uy, -0.2, 0.25); x *= 1 + 0.04 * gs(uy, -0.15, 0.25); }
      if (uz > 0 && uy > 0.1) z *= 1 - 0.05 * sm(0.1, 0.6, uy);  // おでこをやや平らに
      // 目のくぼみ
      if (uz > 0) z -= 0.45 * gs(Math.abs(ux), 0.38, 0.13) * gs(uy, 0.1, 0.09);
      return [x * k + HC[0], y * k + HC[1], z * k + HC[2]];
    }
    const hg = new T.SphereGeometry(1, 56, 42);
    {
      const p = hg.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = headShape(p.getX(i), p.getY(i), p.getZ(i), 1); p.setXYZ(i, v[0], v[1], v[2]); }
    }
    finish(hg);
    const P = hg.attributes.position;
    const faceZ = (x, y) => { let best = -99, bw = 0, acc = 0; for (let i = 0; i < P.count; i++) { const dx = P.getX(i) - x, dy = P.getY(i) - y; const d = dx * dx + dy * dy; if (d < 0.9 && P.getZ(i) > 0) { const w = 1 / (d + 0.05); acc += P.getZ(i) * w; bw += w; } } return bw ? acc / bw : 8; };
    const skin = [hg];
    // 首
    skin.push(lathe([[-7, 5.6], [0, 5.3], [4, 5.0], [8, 4.9], [11, 4.6]], 32, 12, (th, y, r) => [r * Math.sin(th), y, r * 0.95 * Math.cos(th) + 0.06 * y - 0.2]));
    // 鼻
    { const zN = faceZ(0, 13.0); const n = ell(1.05, 2.3, 1.25, 0, 0, 0, 16, 12); n.rotateX(-0.32); n.translate(0, 13.2, zN - 0.35); skin.push(n);
      [1, -1].forEach(s => skin.push(ell(0.75, 0.6, 0.7, s * 0.85, 12.0, faceZ(s * 0.85, 12.0) - 0.15, 10, 8))); }
    // 耳
    [1, -1].forEach(s => {
      const e = ell(0.85, 3.0, 1.75, 0, 0, 0, 16, 12);
      const p = e.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) * (1 - 0.25 * sm(0, -3, y))); if (p.getX(i) > 0.2 * 0) p.setX(i, p.getX(i) - 0.35 * gs(p.getY(i), 0.3, 1.2) * gs(p.getZ(i), 0, 0.9)); }
      e.rotateZ(s * 0.08); e.rotateY(s * 0.25);
      e.scale(s, 1, 1);
      e.translate(s * 7.0, 15.0, -0.2);
      finish(e); skin.push(e);
    });
    // あご下の影・頬の赤み・唇まわりは頂点色で
    const sg = merge(skin.map(g => paint(g.index ? g.toNonIndexed() : g, (c, x, y, z) => {
      c.setRGB(1, 1, 1);
      const blush = gs(Math.abs(x), 4.2, 1.6) * gs(y, 12.8, 1.6) * (z > 4 ? 1 : 0);
      c.r *= 1 + 0.02 * blush; c.g *= 1 - 0.06 * blush; c.b *= 1 - 0.07 * blush;
      if (Math.abs(x) > 6.2 && z < 2) { c.multiplyScalar(0.94); }  // 耳の内側
    })));
    // 合成後の法線は finish 済みのものを使う
    mesh(sg, skinMat, head, 'skin');

    // 目・まゆ・まぶた
    const sclera = [], dark = [], lips = [];
    [1, -1].forEach(s => {
      const ex = s * 3.05, ey = 16.4, ez = faceZ(ex, ey);
      const sc = ell(1.25, 0.62, 0.5, 0, 0, 0, 16, 10); sc.rotateY(s * 0.32); sc.translate(ex, ey, ez - 0.28); sclera.push(sc);
      const ir = ell(0.6, 0.6, 0.3, 0, 0, 0, 14, 10); ir.rotateY(s * 0.3); ir.translate(ex - s * 0.05, ey - 0.02, ez - 0.02); dark.push(ir);
      const lid = ell(1.45, 0.2, 0.4, 0, 0, 0, 14, 6); lid.rotateZ(-s * 0.06); lid.rotateY(s * 0.32); lid.translate(ex, ey + 0.55, ez - 0.12); dark.push(lid);
      const by = 18.9, bz = faceZ(s * 3.2, by);
      const br = ell(1.9, 0.3, 0.4, 0, 0, 0, 14, 6); br.rotateZ(-s * 0.1); br.rotateY(s * 0.3); br.translate(s * 3.2, by, bz - 0.12); dark.push(br);
    });
    { const my = 9.9, mz = faceZ(0, my);
      const l1 = ell(1.9, 0.38, 0.45, 0, 0, 0, 16, 8); l1.translate(0, my + 0.28, mz - 0.18); lips.push(l1);
      const l2 = ell(1.7, 0.42, 0.45, 0, 0, 0, 16, 8); l2.translate(0, my - 0.32, mz - 0.22); lips.push(l2);
      const ln = ell(1.85, 0.07, 0.3, 0, 0, 0, 12, 4); ln.translate(0, my - 0.02, mz + 0.08); dark.push(ln); }
    mesh(merge(sclera), scleraMat, head, 'eyes');
    mesh(merge(dark), darkMat, head, 'features');
    mesh(merge(lips), lipMat, head, 'lips');

    // 髪: 頭を少し大きくした殻。生え際より下は頭の中へ引っ込める
    const hgeo = new T.SphereGeometry(1, 64, 48);
    {
      const p = hgeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
        // 生え際(前): 分け目は左寄り、右の前髪が少し下がる
        const hl = 0.5 - 0.1 * sm(-0.4, 0.5, -ux) + 0.08 * Math.abs(ux);
        let cut = sm(0.05, 0.3, uz) * sm(hl + 0.04, hl - 0.04, uy);
        // 耳まわり(耳を出す)
        cut = Math.max(cut, sm(0.45, 0.6, Math.abs(ux)) * sm(0.1, -0.05, uy) * sm(-0.45, -0.3, uz));
        // えり足
        cut = Math.max(cut, sm(-0.55, -0.68, uy));
        let k = 1.075 + 0.05 * sm(0.3, 0.9, uy) + 0.02 * Math.sin(Math.atan2(ux, uz) * 9 + uy * 4) * sm(0.6, -0.3, uy);
        // 毛先は少し外へはねる/後ろは丸く
        k += 0.03 * gs(uy, -0.45, 0.15) * sm(0, -0.5, uz);
        k = k * (1 - cut) + 0.86 * cut;
        const v = headShape(ux, uy, uz, k);
        // 頭頂の中心からの拡大を正しく(形状の中心 HC を基準に)
        p.setXYZ(i, v[0], v[1], v[2]);
      }
    }
    finish(hgeo);
    mesh(hgeo, hairMat, head, 'hair');
  }

  // ================= 腕 =================
  const arms = {};
  function makeArm(key, s) {
    const arm = new T.Group(); arm.name = 'arm_' + key;
    arm.position.set(s * SHOULDER[0], SHOULDER[1], SHOULDER[2]);
    arm.rotation.z = s * 0.085;   // 少しだけ外へ開いた自然な下ろし方
    torso.add(arm);
    // 上腕の袖(肩の丸みはてっぺんの半球)
    const ua = lathe([[5.6, 0], [5.0, 2.6], [3.6, 4.5], [1.2, 5.2], [-4, 5.1], [-12, 4.75], [-19, 4.4], [-25, 4.15], [-29, 4.0]], 40, 40, (th, y, r) => {
      const c = Math.cos(th), sn = Math.sin(th);
      r += 0.25 * sm(-14, -27, y) * Math.sin(y * 1.2 + th * 2 + s);      // ひじのしわ
      r += 0.25 * gs(y, -2, 4) * Math.sin(y * 0.9 - th * 3) * sm(0.2, -0.6, sn * s); // わき側のしわ
      return [r * sn * (1 + 0.04 * sm(0, 1, sn * s)), y, r * c * 1.02];
    }, 2.3, 2.4);
    mesh(ua, sweatMat, arm, 'upperArm');

    const elbow = new T.Group(); elbow.name = 'elbow_' + key; elbow.position.set(0, ELBOW, 0);
    elbow.rotation.x = -0.12; arm.add(elbow);
    arm.userData.elbow = elbow;
    // 前腕の袖 + 袖口リブ(袖がリブの上にたるむ)
    const fa = lathe([[4.5, 3.9], [0, 4.25], [-6, 4.3], [-12, 4.05], [-17.5, 3.95], [-19.6, 3.75], [-20.6, 3.1], [-20.9, 2.7]], 40, 40, (th, y, r) => {
      const c = Math.cos(th), sn = Math.sin(th);
      r += 0.3 * sm(3, -4, y) * sm(-8, -4, y) * Math.sin(y * 1.4 + th * 2 + s);
      r += 0.32 * sm(-12, -18, y) * Math.sin(y * 1.7 + th * 3 - s);
      return [r * sn * 0.92, y, r * c * 1.04];
    }, 2, 1.8);
    const cuff = lathe([[-19.6, 2.75], [-20.3, 3.05], [-24.6, 3.0], [-25.1, 2.75], [-25.2, 2.4]], 104, 8, (th, y, r) => {
      r += 0.06 * Math.cos(th * 26) * sm(-20.1, -20.6, y) * sm(-25.0, -24.4, y);
      return [r * Math.sin(th) * 0.9, y, r * Math.cos(th) * 1.05];
    }, 1.4, 0.35);
    mesh(merge([fa, cuff]), sweatMat, elbow, 'forearm');

    // 手(手のひらは体側 = -s*X 向き)
    const W = -23.8;
    const hp = [];
    hp.push(lathe([[-19, 2.45], [-23, 2.35], [-25.5, 2.5], [-27, 2.6]], 24, 8, (th, y, r) => [r * Math.sin(th) * 0.72, y, r * Math.cos(th) * 1.05 + 0.1]));
    const palm = ell(1.55, 4.8, 4.0, 0, 0, 0, 20, 16);
    { const p = palm.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); p.setZ(i, z * (0.92 + 0.08 * sm(3, -3, y))); if (p.getX(i) * s < 0) p.setX(i, p.getX(i) * (1 - 0.3 * gs(z, 0, 2.2) * gs(y, 0, 2.5))); } }
    palm.translate(-s * 0.1, W - 5.2, 0.3); finish(palm); hp.push(palm);
    // 指(人差し指が前 +Z)
    const fz = [2.55, 0.85, -0.85, -2.45], fl = [7.0, 7.8, 7.3, 5.8], fy = [W - 9.4, W - 9.8, W - 9.6, W - 9.0], fr = [0.82, 0.86, 0.8, 0.7];
    for (let f = 0; f < 4; f++) {
      let p = new T.Vector3(-s * 0.15, fy[f] + 1.0, fz[f] * 0.95), a = 0.05;
      const segL = [0.42, 0.33, 0.25].map(k => k * fl[f]);
      for (let k = 0; k < 3; k++) {
        a += [0.12, 0.22, 0.22][k];
        const q = p.clone().add(new T.Vector3(-s * Math.sin(a) * segL[k], -Math.cos(a) * segL[k], -0.04 * fz[f] * segL[k]));
        const rr0 = fr[f] * (1 - k * 0.1), rr1 = fr[f] * (1 - (k + 1) * 0.1);
        hp.push(...limb(p.toArray(), q.toArray(), rr0, rr1, 10));
        p = q;
      }
    }
    // 親指
    hp.push(...limb([-s * 0.6, W - 2.6, 2.6], [-s * 1.3, W - 5.4, 4.0], 1.25, 1.0, 12));
    hp.push(...limb([-s * 1.3, W - 5.4, 4.0], [-s * 1.9, W - 8.2, 4.3], 1.0, 0.85, 12));
    const hgm = merge(hp);
    paint(hgm, c => c.setRGB(1, 0.985, 0.98));
    mesh(hgm, skinMat, elbow, 'hand');
    arms[key] = arm;
  }
  makeArm('l', 1); makeArm('r', -1);

  // ================= 脚 =================
  const legs = {};
  // 足(靴下の足先)の形: z = かかと -6.5 〜 つま先 17.5、足裏 y = 2.0
  const FZ0 = -6.5, FZ1 = 17.5;
  const footW = curveFn([[-6.5, 2.9], [-4, 3.15], [0, 3.35], [4, 3.75], [9, 4.25], [12, 4.45], [15, 4.1], [17.5, 3.0]]);
  const footH = curveFn([[-6.5, 5.2], [-4, 6.8], [-1, 9.5], [2, 8.4], [5, 6.4], [9, 4.4], [12, 3.3], [15, 2.6], [17.5, 2.0]]);

  function makeLeg(key, s) {
    const leg = new T.Group(); leg.name = 'leg_' + key;
    leg.position.set(s * HIP[0], HIP[1], HIP[2]);
    body.add(leg);
    // 太もも(ゆったり)
    const th = lathe([[9, 7.5], [5, 9.2], [0, 9.6], [-8, 9.3], [-17, 8.7], [-26, 8.05], [-33, 7.6], [-38.5, 7.4], [-40, 6.6]], 48, 44, (t, y, r) => {
      const c = Math.cos(t), sn = Math.sin(t);
      r += 0.35 * sm(-20, -33, y) * Math.sin(y * 0.9 + t * 2 + s * 0.7);  // ひざ裏のしわ
      r += 0.25 * Math.sin(t * 5 + y * 0.08) * sm(-5, -20, y);
      let x = r * sn * 0.97, z = r * c;
      if (c < 0) z *= 1 + 0.06 * gs(y, 0, 6);
      return [x, y, z];
    }, 3, 3);
    mesh(th, pantsMat, leg, 'thigh');

    const knee = new T.Group(); knee.name = 'knee_' + key; knee.position.set(0, KNEE, 0);
    leg.add(knee); leg.userData.knee = knee;
    // すね〜すそ: 下ほど広がり、すそでたまる。後ろが少し長い
    const HEM = -33.6;
    const shin = lathe([[6, 6.9], [2, 7.5], [-4, 7.65], [-12, 7.8], [-20, 8.05], [-26, 8.4], [-30.5, 8.75], [-33.2, 9.0], [HEM, 8.9]], 64, 52, (t, y, r) => {
      const c = Math.cos(t), sn = Math.sin(t);
      const lowT = sm(-18, -32, y);
      r += 0.55 * lowT * Math.sin(y * 0.75 + t * 2 + s * 1.3);       // すそのたるみ(斜めのよれ)
      r += 0.3 * Math.sin(t * 4 + y * 0.05 + s) * sm(-6, -26, y);      // 縦の落ち感
      r += 0.25 * gs(y, -2, 4) * Math.sin(t * 3 + y);                  // ひざの抜け
      let yy = y - (1 - c) * 0.5 * 0.9 * sm(-28, HEM, y);              // 後ろが下がる
      return [r * sn * 0.98, yy, r * c];
    }, 3.5, 2.8);
    // すその折り返し(ロールアップ 1 回)
    const cuff = lathe([[HEM - 0.1, 8.6], [HEM - 0.4, 9.3], [HEM + 0.4, 9.65], [HEM + 3.4, 9.6], [HEM + 3.9, 9.25], [HEM + 4.0, 8.9]], 64, 12, (t, y, r) => {
      const c = Math.cos(t), sn = Math.sin(t);
      r += 0.35 * Math.sin(t * 3 + s * 2) + 0.15 * Math.sin(t * 7);
      const yy = y - (1 - c) * 0.5 * 0.9 + 0.35 * Math.sin(t * 2 + s);
      return [r * sn * 0.98, yy, r * c];
    }, 3.5, 0.4);
    mesh(merge([shin, cuff]), pantsMat, knee, 'shin');

    // ---- 足もと(床基準の座標系。つま先を少し外へ) ----
    const foot = new T.Group(); foot.name = 'foot_' + key;
    foot.position.set(0, -(BODY_Y + HIP[1] + KNEE), 0);
    foot.rotation.y = s * 0.13;
    knee.add(foot);
    const med = z => -s * 0.55 * sm(9, 17.5, z);   // 親指側(内側)へ寄る

    // 靴下: 足先
    const sockFoot = surf(64, 48, (u, v) => {
      const ph = Math.PI * v, z = (FZ0 + FZ1) / 2 - (FZ1 - FZ0) / 2 * Math.cos(ph);
      const k = Math.pow(Math.sin(ph), 0.42);
      const W = footW(z) * k, H = footH(z) * k, B = Math.min(1.0, H * 0.5);
      const a = u * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const x = med(z) + W * sgnp(c, 0.72);
      const y = sn >= 0 ? 2.0 + B + (H - B) * Math.pow(sn, 0.9) : 2.0 + B - B * Math.pow(-sn, 0.45);
      return [x, y, z];
    }, true, 3, 3.5);
    // 靴下: 足首〜すね(リブ、くるぶし)。上は肌(パンツの中)
    const sockLeg = lathe([[2.6, 4.2], [5, 4.3], [8, 3.85], [11, 3.55], [14, 3.6], [18, 3.95], [22, 4.4], [24.5, 4.75], [25.5, 4.8], [29, 5.1], [36, 5.0], [42, 4.6], [47, 4.5], [48, 0]], 160, 56, (t, y, r) => {
      const c = Math.cos(t), sn = Math.sin(t);
      // くるぶし(外が低い)
      r += 0.55 * gs(y, 8.3, 1.4) * gs(sn * s, 1, 0.35) + 0.5 * gs(y, 9.3, 1.4) * gs(sn * s, -1, 0.35);
      // リブ
      r += 0.075 * Math.cos(t * 40) * sm(10, 12, y) * sm(25.3, 24.6, y);
      r += 0.2 * gs(y, 23.6, 1.0);   // 口ゴム
      let z = r * c * 1.06;
      if (c < 0) z *= 1 + 0.35 * sm(9, 3, y);     // かかとへつなぐ
      if (c > 0) z *= 1 + 0.15 * sm(8, 3, y);
      return [r * sn * 0.95, y, z - 1.0];
    }, 2.2, 6);
    const sockGrey = new T.Color(0x8d8a85), sockDark = new T.Color(0x625f5b), skinC = new T.Color(0xf2d6c0);
    const sockCol = (c, x, y, z) => {
      c.copy(sockGrey);
      const heel = sm(-2.5, -4.5, z) * sm(7.5, 5.5, y), toe = sm(13.5, 15, z);
      c.lerp(sockDark, Math.max(heel, toe) * 0.85);
      if (y > 25.4) c.copy(skinC);
      const k = 1 + 0.04 * Math.sin(x * 3.1 + z * 2.3) * Math.sin(y * 2.7);
      c.multiplyScalar(k);
    };
    mesh(merge([paint(sockFoot.toNonIndexed(), sockCol), paint(sockLeg.toNonIndexed(), sockCol)]), sockMat, foot, 'sock');

    // スリッパの底: ゴム底 + クッション(足の輪郭 + 余白)
    const outline = (m) => {
      const pts = [], N = 36, zm = 5.8, hz = 13.6;
      for (let i = 0; i <= N; i++) { const ph = Math.PI * i / N, z = zm - hz * Math.cos(ph), w = (footW(clamp(z, FZ0, FZ1)) + m) * Math.pow(Math.sin(ph), 0.5); pts.push(new T.Vector2(med(z) + w, -z)); }
      for (let i = N - 1; i > 0; i--) { const ph = Math.PI * i / N, z = zm - hz * Math.cos(ph), w = (footW(clamp(z, FZ0, FZ1)) + m) * Math.pow(Math.sin(ph), 0.5); pts.push(new T.Vector2(med(z) - w, -z)); }
      return new T.Shape(pts);
    };
    const rubber = new T.ExtrudeGeometry(outline(1.2), { depth: 0.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2, curveSegments: 4 });
    rubber.rotateX(-Math.PI / 2); rubber.translate(0, 0.2, 0);
    const cushion = new T.ExtrudeGeometry(outline(1.0), { depth: 0.75, bevelEnabled: true, bevelThickness: 0.38, bevelSize: 0.38, bevelSegments: 3, curveSegments: 4 });
    cushion.rotateX(-Math.PI / 2); cushion.translate(0, 1.0 + 0.38, 0);
    [rubber, cushion].forEach(g => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.08, uv.getY(i) * 0.08); g.computeVertexNormals(); });
    const rubC = new T.Color(0x3b3530), cusC = new T.Color(0xd5c7ad);
    paint(rubber, (c, x, y) => { c.copy(rubC); if (y < 0.12) c.multiplyScalar(0.8); });
    paint(cushion, (c, x, y) => { c.copy(cusC); if (y > 2.4) c.multiplyScalar(0.92); });
    mesh(merge([rubber, cushion]), soleMat, foot, 'sole');

    // スリッパの甲: 足の甲を覆う布(かかと側は開いている)
    const ZT = 19.2;
    const upPos = (t, a) => {
      const zOpen = 4.2 - 3.6 * (1 - Math.sin(a));
      const z = zOpen + (ZT - zOpen) * t;
      const ku = Math.pow(1 - Math.pow(t, 4), 0.5);
      const W = (footW(clamp(z, FZ0, FZ1)) + 1.05) * ku;
      const H = (footH(clamp(z, FZ0, FZ1)) + 0.75) * Math.pow(ku, 0.7);
      const c = Math.cos(a), sn = Math.sin(a);
      const puff = 0.18 * Math.sin(t * Math.PI) * sn;   // 中わたのふくらみ
      return [med(z) + (W + puff) * sgnp(c, 0.65), 2.3 + (H + puff) * Math.pow(sn, 0.8), z];
    };
    const upper = surf(40, 36, (u, v) => upPos(u, Math.PI * v), false, 2.5, 2);
    mesh(upper, feltMat, foot, 'upper');
    // 縁どり(はき口のパイピング)と、底との縫い目
    const tubes = [];
    {
      const pts = []; for (let i = 0; i <= 30; i++) { const p = upPos(0, Math.PI * i / 30); pts.push(new T.Vector3(p[0], p[1], p[2] - 0.1)); }
      const cv = new T.CatmullRomCurve3(pts);
      const g = new T.TubeGeometry(cv, 60, 0.42, 8, false);
      const uv = g.attributes.uv, L = cv.getLength(); for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / 0.55);
      tubes.push(g);
      const p2 = [];
      for (let i = 0; i <= 24; i++) { const p = upPos(i / 24 * 0.985, 0.02); p2.push(new T.Vector3(p[0] + 0.05, 2.45, p[2])); }
      for (let i = 24; i >= 0; i--) { const p = upPos(i / 24 * 0.985, Math.PI - 0.02); p2.push(new T.Vector3(p[0] - 0.05, 2.45, p[2])); }
      const cv2 = new T.CatmullRomCurve3(p2);
      const g2 = new T.TubeGeometry(cv2, 120, 0.3, 6, false);
      const uv2 = g2.attributes.uv, L2 = cv2.getLength(); for (let i = 0; i < uv2.count; i++) uv2.setX(i, uv2.getX(i) * L2 / 0.45);
      tubes.push(g2);
    }
    mesh(merge(tubes), stitchMat, foot, 'stitch');

    legs[key] = leg;
  }
  makeLeg('l', 1); makeLeg('r', -1);

  // ================= 部品・当たり判定 =================
  root.userData.parts = { body, torso, head, legs, arms };
  root.userData.colliders = [
    [1.0, 0, -9, 17.5, 7, 21],          // 左足(スリッパ)
    [-17.5, 0, -9, -1.0, 7, 21],        // 右足
    [0.5, 7, -9.5, 18.5, 82, 9.5],      // 左脚
    [-18.5, 7, -9.5, -0.5, 82, 9.5],    // 右脚
    [-22, 78, -12.5, 22, 136, 12],      // 胴 + 腕
    [-9, 136, -9.5, 9, 161, 11.5],      // 頭
  ];

  // --- 一時: ポーズ確認用 ---
  const POSE = (typeof location !== 'undefined') ? new URLSearchParams(location.search).get('pose') : null;
  if (POSE === 'walk') {
    legs.l.rotation.x = -0.45; legs.l.userData.knee.rotation.x = 0.25;
    legs.r.rotation.x = 0.35; legs.r.userData.knee.rotation.x = 0.7;
    arms.l.rotation.x = 0.4; arms.r.rotation.x = -0.45; arms.r.userData.elbow.rotation.x = -0.6;
    head.rotation.y = 0.3; torso.rotation.y = -0.1;
  }
  return root;
};
