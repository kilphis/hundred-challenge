// Saguaro (Carnegiea gigantea) の若い株を素焼き鉢+受け皿に植えたもの。1 = 1cm。
(function () {
  window.MODELS = window.MODELS || {};

  function rng(seed) { let s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, rx, ry) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4; return t;
  }
  function smooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

  // ---- サボテンの皮テクスチャ: 縦に N 本の稜。稜の頂点が u=k/N、谷が (k+.5)/N。v は 4.2cm で1周期
  function skinTexture(N, seed) {
    const W = N * 42, H = 512, c = mkCanvas(W, H), x = c.getContext('2d');
    const id = x.createImageData(W, H), d = id.data, R = rng(seed);
    const noiseRow = new Float32Array(W);
    for (let i = 0; i < W; i++) noiseRow[i] = R();
    for (let py = 0; py < H; py++) {
      const wr = (Math.sin(py * 0.9 + R() * 0.2) * 0.5 + 0.5) * 0.04; // 横しわ
      for (let px = 0; px < W; px++) {
        const ph = px / W * N;
        const f = Math.abs(Math.cos(Math.PI * ph));           // 1=稜 0=谷
        const n1 = noiseRow[(px * 7 + py * 3) % W] * 0.5 + R() * 0.5;
        const streak = Math.sin(px * 1.7 + Math.sin(py * 0.02) * 3) * 0.5 + 0.5;
        const t = Math.pow(f, 0.7);
        let r = 30 + t * 50 + n1 * 12 + streak * 6 - wr * 60;
        let g = 66 + t * 58 + n1 * 14 + streak * 8 - wr * 60;
        let b = 48 + t * 30 + n1 * 10;
        // 蝋質の粉ふき(青白さ)
        const bloom = smooth(0.3, 1, f) * 0.1;
        r += bloom * 70; g += bloom * 80; b += bloom * 80;
        const i = (py * W + px) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    x.putImageData(id, 0, 0);
    // 刺座(アレオーレ): 稜の頂点に灰褐色のフェルト。偶数稜 v=0、奇数稜 v=.5
    for (let k = 0; k < N; k++) {
      const cx = k / N * W, cy = (k % 2 === 0) ? 0 : H / 2;
      for (const yy of [cy, cy + H, cy - H]) {
        for (const xx of [cx, cx + W, cx - W]) {
          const gr = x.createRadialGradient(xx, yy, 0, xx, yy, 13);
          gr.addColorStop(0, 'rgba(150,128,96,1)'); gr.addColorStop(0.55, 'rgba(110,92,66,0.9)'); gr.addColorStop(1, 'rgba(110,92,66,0)');
          x.fillStyle = gr; x.save(); x.translate(xx, yy); x.scale(0.8, 1.4); x.translate(-xx, -yy);
          x.beginPath(); x.arc(xx, yy, 13, 0, 7); x.fill(); x.restore();
        }
      }
    }
    // 小さな傷・日焼けの黄ばみ
    for (let i = 0; i < 40; i++) {
      x.fillStyle = 'rgba(' + (150 + R() * 40) + ',' + (150 + R() * 30) + ',70,' + (0.05 + R() * 0.08) + ')';
      x.beginPath(); x.ellipse(R() * W, R() * H, 3 + R() * 8, 6 + R() * 18, 0, 0, 7); x.fill();
    }
    return tex(c);
  }

  // ---- 稜つきチューブ(曲線に沿う)。円柱状で頂部は半球 ----
  function ribbedTube(pts, Rad, N, opts) {
    opts = opts || {};
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    curve.arcLengthDivisions = 600;
    const len = curve.getLength(), Rtop = Rad * 0.98;
    const body = len - Rtop, step = 0.4;
    const ss = [];
    const nb = Math.ceil(body / step);
    for (let i = 0; i <= nb; i++) ss.push({ s: body * i / nb, k: 1 });
    const nd = 10;
    for (let i = 1; i <= nd; i++) { const ph = i / nd * Math.PI / 2; ss.push({ s: body + Rtop * Math.sin(ph), k: Math.max(0.025, Math.cos(ph)) }); }
    const A = N * 8, depth = opts.depth || 0.2;
    const pos = [], uv = [], idx = [], rings = [];
    // 平行移動フレーム
    let T0 = curve.getTangentAt(0), n = new THREE.Vector3(0, 0, 1);
    if (Math.abs(T0.z) > 0.9) n.set(1, 0, 0);
    n.addScaledVector(T0, -n.dot(T0)).normalize();
    for (let i = 0; i < ss.length; i++) {
      const s = ss[i].s, u = Math.min(1, s / len);
      const c = curve.getPointAt(u), T = curve.getTangentAt(u);
      n.addScaledVector(T, -n.dot(T)).normalize();
      const b = new THREE.Vector3().crossVectors(T, n);
      let r = Rad * (opts.rf ? opts.rf(s, len) : 1) * ss[i].k;
      rings.push({ c: c.clone(), T: T.clone(), n: n.clone(), b: b.clone(), r: r, s: s });
      for (let j = 0; j <= A; j++) {
        const th = 2 * Math.PI * j / A;
        const f = Math.abs(Math.cos(N * th / 2));
        const rr = r * (1 - depth * (1 - Math.pow(f, 0.55)));
        pos.push(c.x + rr * (Math.cos(th) * n.x + Math.sin(th) * b.x),
                 c.y + rr * (Math.cos(th) * n.y + Math.sin(th) * b.y),
                 c.z + rr * (Math.cos(th) * n.z + Math.sin(th) * b.z));
        uv.push(j / A, s / 4.2);
      }
    }
    const W = A + 1;
    for (let i = 0; i < ss.length - 1; i++) for (let j = 0; j < A; j++) {
      const a = i * W + j, b2 = a + 1, c2 = a + W, d2 = c2 + 1;
      idx.push(a, b2, c2, b2, d2, c2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return { geo: g, rings: rings, N: N, len: len };
  }

  // ---- 刺を1つのジオメトリに結合 ----
  function SpineBuilder() { this.p = []; this.c = []; this.n = 0; }
  SpineBuilder.prototype.add = function (base, dir, len, rad, c0, c1) {
    const tip = base.clone().addScaledVector(dir, len);
    let a = new THREE.Vector3(1, 0, 0); if (Math.abs(dir.x) > 0.8) a.set(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, a).normalize().multiplyScalar(rad);
    const v = new THREE.Vector3().crossVectors(dir, u).normalize().multiplyScalar(rad);
    const q = [base.clone().add(u),
               base.clone().addScaledVector(u, -0.5).addScaledVector(v, 0.87),
               base.clone().addScaledVector(u, -0.5).addScaledVector(v, -0.87)];
    const tris = [[q[0], q[1], tip], [q[1], q[2], tip], [q[2], q[0], tip]];
    for (const t of tris) {
      t.forEach((P, k) => { this.p.push(P.x, P.y, P.z); const cc = k === 2 ? c1 : c0; this.c.push(cc[0], cc[1], cc[2]); });
    }
  };
  SpineBuilder.prototype.geo = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals(); return g;
  };

  function addSpines(sb, tube, R, skip) {
    const N = tube.N, rings = tube.rings;
    for (let k = 0; k < N; k++) {
      const th = 2 * Math.PI * k / N;
      const off = (k % 2 === 0) ? 0 : 2.1;
      for (let s = off + 2.1 * (k % 2 === 0 ? 0.5 : 0); s < tube.len - 0.4; s += 4.2) {
        let ri = 0, bd = 1e9;
        for (let i = 0; i < rings.length; i++) { const dd = Math.abs(rings[i].s - s); if (dd < bd) { bd = dd; ri = i; } }
        const g = rings[ri];
        const out = g.n.clone().multiplyScalar(Math.cos(th)).addScaledVector(g.b, Math.sin(th));
        const tan = g.n.clone().multiplyScalar(-Math.sin(th)).addScaledVector(g.b, Math.cos(th));
        const base = g.c.clone().addScaledVector(out, g.r * 0.985);
        if (skip(base)) continue;
        const crown = g.r < Rad_small(tube) ? 1 : 1;
        const rr = R();
        // 中心の刺
        sb.add(base, out.clone().addScaledVector(g.T, 0.25).normalize(), 2.2 + rr * 0.5, 0.055, [0.30, 0.22, 0.15], [0.80, 0.74, 0.62]);
        const m = 7;
        for (let q = 0; q < m; q++) {
          const ang = 2 * Math.PI * q / m + rr;
          const d = out.clone().multiplyScalar(0.7)
            .addScaledVector(g.T, Math.cos(ang) * 0.6).addScaledVector(tan, Math.sin(ang) * 0.6).normalize();
          sb.add(base, d, 1.1 + R() * 0.7, 0.035, [0.34, 0.27, 0.19], [0.86, 0.82, 0.72]);
        }
      }
    }
    // 頂部の若い刺(密集)
    const top = rings[rings.length - 2];
    for (let q = 0; q < 10; q++) {
      const ang = q / 10 * 6.283;
      const rad = top.r * 0.6;
      const base = top.c.clone().addScaledVector(top.n, Math.cos(ang) * rad).addScaledVector(top.b, Math.sin(ang) * rad).addScaledVector(top.T, 0.3);
      const d = top.T.clone().multiplyScalar(0.8).addScaledVector(top.n, Math.cos(ang) * 0.5).addScaledVector(top.b, Math.sin(ang) * 0.5).normalize();
      sb.add(base, d, 1.0 + R() * 0.8, 0.04, [0.45, 0.33, 0.2], [0.9, 0.85, 0.7]);
    }
  }
  function Rad_small() { return 0; }

  // ---- 鉢・受け皿のテクスチャ ----
  function potTexture(rimFrac) {
    const W = 512, H = 512, c = mkCanvas(W, H), x = c.getContext('2d'), R = rng(77);
    x.fillStyle = '#b4623a'; x.fillRect(0, 0, W, H);
    const id = x.getImageData(0, 0, W, H), d = id.data;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const nn = (R() - 0.5) * 22 + Math.sin(px * 0.05 + py * 0.02) * 6 + Math.sin(py * 0.3) * 3;
      const down = py / H;
      d[i] = 176 + nn - down * 10; d[i + 1] = 94 + nn * 0.8 - down * 8; d[i + 2] = 58 + nn * 0.6;
    }
    x.putImageData(id, 0, 0);
    // 大きな色ムラ
    for (let i = 0; i < 60; i++) {
      x.fillStyle = 'rgba(' + (R() > 0.5 ? '120,50,28' : '210,130,86') + ',' + (0.05 + R() * 0.07) + ')';
      x.beginPath(); x.ellipse(R() * W, R() * H, 20 + R() * 60, 10 + R() * 40, R() * 3, 0, 7); x.fill();
    }
    // 縁の帯境界
    const ry = rimFrac * H;
    x.fillStyle = 'rgba(70,30,15,0.45)'; x.fillRect(0, ry - 3, W, 5);
    x.fillStyle = 'rgba(230,160,110,0.25)'; x.fillRect(0, ry + 2, W, 4);
    // 白い石灰(塩)の染み: 縁の下から垂れる
    for (let i = 0; i < 70; i++) {
      const sx = R() * W, sy = ry + R() * 30, ln = 20 + R() * 120;
      const gr = x.createLinearGradient(0, sy, 0, sy + ln);
      gr.addColorStop(0, 'rgba(235,225,205,' + (0.15 + R() * 0.25) + ')'); gr.addColorStop(1, 'rgba(235,225,205,0)');
      x.fillStyle = gr; x.fillRect(sx, sy, 2 + R() * 8, ln);
    }
    // 緑の苔っぽい汚れ(下部)
    for (let i = 0; i < 25; i++) {
      x.fillStyle = 'rgba(70,95,50,' + (0.06 + R() * 0.08) + ')';
      x.beginPath(); x.ellipse(R() * W, H * 0.6 + R() * H * 0.3, 10 + R() * 30, 5 + R() * 15, 0, 0, 7); x.fill();
    }
    return tex(c);
  }
  function gravelTexture() {
    const S = 512, c = mkCanvas(S, S), x = c.getContext('2d'), R = rng(5);
    x.fillStyle = '#6a5a48'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const v = 90 + R() * 130, w = R();
      x.fillStyle = 'rgb(' + (v + (w > 0.6 ? 20 : 0)) + ',' + (v - 5 + (w > 0.6 ? 10 : 0)) + ',' + (v - 25) + ')';
      x.beginPath(); x.ellipse(R() * S, R() * S, 2 + R() * 5, 2 + R() * 4, R() * 3, 0, 7); x.fill();
      x.strokeStyle = 'rgba(30,22,14,0.35)'; x.lineWidth = 1; x.stroke();
    }
    return tex(c);
  }

  function resample(pts, n) {
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const out = [], tot = L[L.length - 1];
    for (let k = 0; k < n; k++) {
      const t = tot * k / (n - 1); let i = 1; while (i < L.length - 1 && L[i] < t) i++;
      const a = (t - L[i - 1]) / (L[i] - L[i - 1] || 1);
      out.push(pts[i - 1].clone().lerp(pts[i], a));
    }
    return { pts: out, tot: tot, L: L };
  }

  function flower(R, scaleK) {
    const f = new THREE.Group();
    const pm = new THREE.MeshStandardMaterial({ color: 0xfbf7ea, roughness: 0.55, emissive: 0x4a463a, side: THREE.DoubleSide });
    const pg = new THREE.SphereGeometry(1, 10, 8);
    // 緑の筒(がく)
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 1.8, 14),
      new THREE.MeshStandardMaterial({ color: 0x6f8a4c, roughness: 0.7 }));
    tube.position.y = 0.9; f.add(tube);
    for (let ring = 0; ring < 2; ring++) {
      const cnt = ring ? 9 : 11;
      for (let i = 0; i < cnt; i++) {
        const p = new THREE.Mesh(pg, pm);
        const ang = i / cnt * 6.283 + ring * 0.3 + R() * 0.1;
        p.scale.set(0.5, 2.0 - ring * 0.2, 0.09);
        const tilt = (ring ? 0.8 : 1.1) + R() * 0.15;
        const holder = new THREE.Group();
        holder.rotation.y = ang;
        const inner = new THREE.Group();
        inner.rotation.z = tilt;
        p.position.y = 2.0 - ring * 0.2;
        inner.add(p); holder.add(inner); holder.position.y = 1.8;
        f.add(holder);
      }
    }
    const sm = new THREE.MeshStandardMaterial({ color: 0xe5b92a, roughness: 0.6, emissive: 0x3a2a00 });
    const sg = new THREE.SphereGeometry(0.1, 6, 5);
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Mesh(sg, sm), a = R() * 6.283, rr = R() * 0.85;
      s.position.set(Math.cos(a) * rr, 2.2 + R() * 0.9, Math.sin(a) * rr); f.add(s);
    }
    const stg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xcfd9a0, roughness: 0.6 }));
    stg.position.y = 2.4; f.add(stg);
    f.scale.setScalar(scaleK || 1);
    return f;
  }

  window.MODELS.cactus = function () {
    const g = new THREE.Group();
    const R = rng(2026);
    const add = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

    // ---- 受け皿 ----
    const saucerPts = [[0, 0], [5.8, 0], [6.3, 0.25], [8.9, 1.9], [9.3, 2.0], [9.4, 2.2], [9.0, 2.2], [8.6, 2.1], [6.0, 0.7], [0, 0.7]].map(p => new THREE.Vector2(p[0], p[1]));
    const sTex = potTexture(0.5);
    const saucer = add(new THREE.Mesh(new THREE.LatheGeometry(saucerPts, 48),
      new THREE.MeshStandardMaterial({ map: sTex, color: 0xc8b4a8, roughness: 0.85, side: THREE.DoubleSide })));

    // ---- 鉢 ----
    const PY = 0.7;
    const prof = [[0, 0], [4.8, 0], [5.1, 0.3], [6.9, 10.4], [7.0, 10.6], [8.0, 10.7], [8.2, 11.0], [8.2, 13.2], [8.0, 13.5], [7.4, 13.5], [7.2, 13.1], [7.0, 12.6], [6.4, 12.6], [6.0, 12.2]];
    const pp = prof.map(p => new THREE.Vector2(p[0], p[1]));
    // 弧長でv割り当て(LatheGeometry は点番号でvを振るので再サンプル)
    const rs = resample(pp.map(p => new THREE.Vector3(p.x, p.y, 0)), 60);
    const potPts = rs.pts.map(p => new THREE.Vector2(p.x, p.y));
    let rimLen = 0; for (let i = 1; i <= 4; i++) rimLen += pp[i].distanceTo(pp[i - 1]); // 底→縁下端 手前まで
    let toRim = 0; for (let i = 1; i <= 5; i++) toRim += pp[i].distanceTo(pp[i - 1]);
    const pot = add(new THREE.Mesh(new THREE.LatheGeometry(potPts, 64),
      new THREE.MeshStandardMaterial({ map: potTexture(toRim / rs.tot), color: 0xf0e0d8, emissive: 0x2a1208, roughness: 0.9, side: THREE.DoubleSide })));
    pot.position.y = PY;

    // ---- 土(砂利の化粧砂) ----
    const soilY = PY + 12.1;
    const soil = add(new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.2, 1.0, 40),
      new THREE.MeshStandardMaterial({ map: (function () { const t = gravelTexture(); t.repeat.set(1.5, 1.5); return t; })(), roughness: 1.0 })));
    soil.position.y = soilY - 0.5;
    // 小石
    const pebG = new THREE.DodecahedronGeometry(0.4, 0);
    const peb = new THREE.InstancedMesh(pebG, new THREE.MeshStandardMaterial({ color: 0xb8ad98, roughness: 0.95 }), 70);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < 70; i++) {
      const a = R() * 6.283, r = Math.sqrt(R()) * 6.2, s = 0.5 + R() * 0.9;
      e.set(R() * 3, R() * 3, R() * 3); q.setFromEuler(e);
      sc.set(s, s * 0.6, s * (0.7 + R() * 0.4)); ps.set(Math.cos(a) * r, soilY + 0.05, Math.sin(a) * r);
      mtx.compose(ps, q, sc); peb.setMatrixAt(i, mtx);
      peb.setColorAt && peb.setColorAt(i, new THREE.Color().setHSL(0.09, 0.15, 0.45 + R() * 0.3));
    }
    add(peb);

    // ---- 本体(幹) ----
    const skinMat12 = new THREE.MeshStandardMaterial({ map: skinTexture(12, 11), roughness: 0.62, color: 0xffffff });
    skinMat12.bumpMap = skinMat12.map; skinMat12.bumpScale = 0.6;
    const skinMat8 = new THREE.MeshStandardMaterial({ map: skinTexture(8, 23), roughness: 0.62 });
    skinMat8.bumpMap = skinMat8.map; skinMat8.bumpScale = 0.6;

    const trunkR = 4.4, y0 = soilY - 1.5;
    const trunkPts = [new THREE.Vector3(0.1, y0, 0), new THREE.Vector3(0, y0 + 12, 0.05), new THREE.Vector3(-0.1, y0 + 26, 0.15), new THREE.Vector3(0, y0 + 40, 0.05), new THREE.Vector3(0.1, y0 + 46, 0)];
    const trunk = ribbedTube(trunkPts, trunkR, 12, { depth: 0.2, rf: (s, len) => (0.9 + 0.1 * smooth(0, 14, s)) * (1 + 0.02 * Math.sin(s * 0.5)) });
    add(new THREE.Mesh(trunk.geo, skinMat12));

    // ---- 腕 ----
    function arm(ang, yStart, rise, out, rad, N) {
      const dx = Math.sin(ang), dz = Math.cos(ang);
      const P = (a, y) => new THREE.Vector3(dx * a, yStart + y, dz * a);
      const pts = [P(0, -0.5), P(trunkR * 0.7, 0.3), P(trunkR + out * 0.5, 1.8), P(trunkR + out * 0.9, 5.2), P(trunkR + out, 9.5), P(trunkR + out + 0.2, 9.5 + rise * 0.5), P(trunkR + out + 0.1, 9.5 + rise)];
      return ribbedTube(pts, rad, N, { depth: 0.2, rf: (s, len) => 0.95 + 0.05 * Math.sin(s * 0.4) });
    }
    const armA = arm(-1.45, y0 + 21, 9, 5.6, 2.5, 8);
    const armB = arm(1.75 + 0.3, y0 + 28, 5, 4.6, 2.2, 8);
    add(new THREE.Mesh(armA.geo, skinMat8));
    add(new THREE.Mesh(armB.geo, skinMat8));

    // ---- 刺 ----
    const SB = new SpineBuilder();
    addSpines(SB, trunk, R, p => p.y < soilY + 0.8);
    const armSkip = p => Math.hypot(p.x, p.z) < trunkR + 0.4;
    addSpines(SB, armA, R, armSkip);
    addSpines(SB, armB, R, armSkip);
    add(new THREE.Mesh(SB.geo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide })));

    // ---- 花: 幹の頂部に開花2つ、腕の先に蕾気味1つ ----
    const topT = trunk.rings[trunk.rings.length - 1];
    function putFlower(basePos, normal, k) {
      const f = flower(R, k);
      f.position.copy(basePos);
      f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize());
      f.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(f);
    }
    const ty = y0 + 46;
    putFlower(new THREE.Vector3(1.4, ty - 1.2, 1.2), new THREE.Vector3(0.45, 1, 0.4), 1.0);
    putFlower(new THREE.Vector3(-1.7, ty - 1.6, -0.9), new THREE.Vector3(-0.55, 1, -0.3), 0.85);
    const at = armA.rings[armA.rings.length - 1].c;
    putFlower(new THREE.Vector3(at.x, at.y - 1.0, at.z), new THREE.Vector3(-0.4, 1, 0.3), 0.7);

    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };
})();
