// day41 B. 自由曲面シェル(薄いコンクリートの屋根)3案: shell_a / shell_b / shell_c
// 注意: 形は「応力が一様」と仮定して Δz=-1 を解いた近似で、自由縁では厳密な力の釣り合いにはなっていない。
// 手順: 輪郭 R(θ) → 極座標格子 (s,θ) → 三角形メッシュの cotangent ラプラシアン(自然境界=ノイマン) →
//       支点だけ z=0 にして SOR で反復 → 最大高さに合わせて拡大 → 上面 / 法線方向に厚み分下げた下面 / 縁の側面。
// 単位 1=1cm。原点=平面(極座標の中心)の地面。底面 y=0。
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const PI = Math.PI, TAU = Math.PI * 2;
  const THICK = 25;

  // ---- 3案の定義(ここだけ変えれば形が変わる) ----
  // base(θ): 支点位置での外形の半径(cm)。sup: 支点(c=中心角[度], w=弧の幅[cm])
  // bow[k]: 支点k→k+1 の間の弓なりのへこみ(0〜1。0.5 なら半径が半分に)
  const ellipse = (a, b) => (t) => 1 / Math.sqrt(Math.cos(t) ** 2 / (a * a) + Math.sin(t) ** 2 / (b * b));
  const DEFS = {
    shell_a: {
      name: '三点', NT: 200, NS: 56, H: 450, q: 1.2,
      base: () => 1650,
      sup: [{ c: 90, w: 450 }, { c: 210, w: 450 }, { c: 330, w: 450 }],
      bow: [0.2, 0.2, 0.2],
    },
    shell_b: {
      name: '五点の雲', NT: 240, NS: 56, H: 550, q: 1.2,
      base: (() => { const e = ellipse(2350, 1650); return (t) => e(t) * (1 + 0.05 * Math.sin(3 * t + 0.6) + 0.035 * Math.sin(5 * t + 2.1)); })(),
      sup: [{ c: 10, w: 300 }, { c: 80, w: 500 }, { c: 135, w: 350 }, { c: 245, w: 600 }, { c: 300, w: 400 }],
      bow: [0.18, 0.12, 0.3, 0.15, 0.22],
    },
    shell_c: {
      name: '長い波', NT: 240, NS: 56, H: 600, q: 1.2,
      base: ellipse(2700, 1300),
      sup: [{ c: 40, w: 350 }, { c: 125, w: 450 }, { c: 270, w: 1300 }],
      bow: [0.25, 0.18, 0.18],
    },
  };

  // ---- 輪郭 R(θ) ----
  function makeOutline(d) {
    const sup = d.sup.map((s) => { const c = s.c * PI / 180; return { c, a: s.w / 2 / d.base(c) }; });
    const n = sup.length;
    const mod = (x) => ((x % TAU) + TAU) % TAU;
    return function R(theta) {
      const base = d.base(theta);
      for (let k = 0; k < n; k++) {
        const k2 = (k + 1) % n;
        const span = mod(sup[k2].c - sup[k].c) || TAU;
        const dd = mod(theta - sup[k].c);
        if (dd < span) {
          const st = sup[k].a, en = span - sup[k2].a;
          if (dd <= st || dd >= en) return base;
          const u = (dd - st) / (en - st);
          return base * (1 - d.bow[k] * Math.pow(Math.sin(PI * u), d.q));
        }
      }
      return base;
    };
  }

  // ---- 形を解く(THREE に依存しない) ----
  function buildField(d) {
    const NT = d.NT, NS = d.NS, N = 1 + NT * NS;
    const R = makeOutline(d);
    const px = new Float64Array(N), pz = new Float64Array(N); // 平面座標 [m]
    const idx = (j, i) => 1 + (j - 1) * NT + ((i % NT) + NT) % NT;
    const th = (i) => (i / NT) * TAU;
    for (let j = 1; j <= NS; j++) for (let i = 0; i < NT; i++) {
      const r = (j / NS) * R(th(i)) / 100, v = idx(j, i);
      px[v] = r * Math.cos(th(i)); pz[v] = r * Math.sin(th(i));
    }
    // 三角形
    const tris = [];
    for (let i = 0; i < NT; i++) tris.push(0, idx(1, i + 1), idx(1, i));
    for (let j = 1; j < NS; j++) for (let i = 0; i < NT; i++) {
      const a = idx(j, i), b = idx(j, i + 1), c = idx(j + 1, i + 1), e = idx(j + 1, i);
      tris.push(a, b, c, a, c, e);
    }
    // 上向きの面になるよう向きをそろえる(平面 x,z から y を上にしたとき)
    // (b-a)×(c-a) の y 成分 = (bz-az)(cx-ax)-(bx-ax)(cz-az)... 符号を見て反転
    {
      const a = tris[3 * NT], b = tris[3 * NT + 1], c = tris[3 * NT + 2]; // 最初の四角の三角形
      const ny = (pz[b] - pz[a]) * (px[c] - px[a]) - (px[b] - px[a]) * (pz[c] - pz[a]);
      if (ny < 0) for (let t = 0; t < tris.length; t += 3) { const tmp = tris[t + 1]; tris[t + 1] = tris[t + 2]; tris[t + 2] = tmp; }
    }
    const NTRI = tris.length / 3;
    // cotangent 重みと頂点面積
    const emap = new Map(), area = new Float64Array(N);
    const addW = (i, j, w) => { const k = i < j ? i * N + j : j * N + i; emap.set(k, (emap.get(k) || 0) + w); };
    for (let t = 0; t < NTRI; t++) {
      const v = [tris[3 * t], tris[3 * t + 1], tris[3 * t + 2]];
      const ar = Math.abs(((px[v[1]] - px[v[0]]) * (pz[v[2]] - pz[v[0]]) - (px[v[2]] - px[v[0]]) * (pz[v[1]] - pz[v[0]])) / 2);
      for (let k = 0; k < 3; k++) {
        const o = v[k], p = v[(k + 1) % 3], q = v[(k + 2) % 3];
        const ux = px[p] - px[o], uz = pz[p] - pz[o], wx = px[q] - px[o], wz = pz[q] - pz[o];
        const dot = ux * wx + uz * wz, cr = Math.abs(ux * wz - uz * wx);
        addW(p, q, 0.5 * dot / (cr + 1e-12));
        area[v[k]] += ar / 3;
      }
    }
    const deg = new Int32Array(N);
    for (const k of emap.keys()) { deg[Math.floor(k / N)]++; deg[k % N]++; }
    const off = new Int32Array(N + 1);
    for (let i = 0; i < N; i++) off[i + 1] = off[i] + deg[i];
    const nb = new Int32Array(off[N]), wt = new Float64Array(off[N]), fill = new Int32Array(N);
    const diag = new Float64Array(N);
    for (const [k, w0] of emap) {
      const i = Math.floor(k / N), j = k % N, w = Math.max(w0, 0);
      nb[off[i] + fill[i]] = j; wt[off[i] + fill[i]++] = w; diag[i] += w;
      nb[off[j] + fill[j]] = i; wt[off[j] + fill[j]++] = w; diag[j] += w;
    }
    // 支点: 外周のうち支点の角度範囲にある頂点を z=0 に固定
    const fixed = new Uint8Array(N), isSup = new Uint8Array(NT);
    let nfix = 0;
    for (const s of d.sup) {
      const c = s.c * PI / 180, half = s.w / 2 / d.base(c) + (0.5 / NT) * TAU;
      for (let i = 0; i < NT; i++) {
        let dd = Math.abs(((th(i) - c) % TAU + TAU + PI) % TAU - PI);
        if (dd <= half && !isSup[i]) { isSup[i] = 1; fixed[idx(NS, i)] = 1; nfix++; }
      }
    }
    // 支点の間の縁: ディリクレ条件でアーチ z_edge(u) = h_edge * sin(πu)^p(u は弧長で支点の端から次の端まで)
    // h_edge は最大高さ H の 0.55〜0.7 倍(開口の弧長に比例、上限あり)。拡大後の高さで直接与える。
    const edgeZ = new Float64Array(N);
    const ringLen = (i0, i1) => { let s = 0; for (let i = i0; i < i1; i++) { const a = idx(NS, i), b = idx(NS, i + 1); s += Math.hypot(px[a] - px[b], pz[a] - pz[b]) * 100; } return s; };
    const gaps = [];
    {
      let st = isSup.indexOf(1);
      for (let n = 0; n < NT;) {
        const i = (st + n) % NT;
        if (isSup[i]) { n++; continue; }
        let m = n; while (m < NT && !isSup[(st + m) % NT]) m++;
        gaps.push({ s0: st + n - 1, s1: st + m, L: 0 }); n = m;
      }
      for (const g of gaps) g.L = ringLen(g.s0, g.s1);
    }
    const Lmean = gaps.reduce((s, g) => s + g.L, 0) / (gaps.length || 1);
    const pe = d.pEdge || 0.9;
    for (const g of gaps) {
      g.frac = Math.min(0.7, Math.max(0.55, 0.62 * g.L / Lmean));
      for (let i = g.s0 + 1; i < g.s1; i++) {
        const u = ringLen(g.s0, i) / g.L, v = idx(NS, i);
        fixed[v] = 1; edgeZ[v] = g.frac * d.H * Math.pow(Math.sin(PI * u), pe);
      }
    }
    // SOR: Σ w_ij (z_i - z_j) = load*A_i。解は線形なので、
    // 荷重だけの解 zp(縁=0) と 縁だけの調和解 zh を別々に解き、Z = k·zp + zh の最大が H になる k を選ぶ。
    const omega = 1.94;
    const t0 = Date.now();
    let iters = 0;
    function sor(load, init) {
      const z = new Float64Array(N);
      for (let i = 0; i < N; i++) z[i] = fixed[i] ? edgeZ[i] : init;
      if (!load) for (let i = 0; i < N; i++) if (fixed[i] && !edgeZ[i]) z[i] = 0;
      let it, zm = 1, md = 0;
      for (it = 1; it <= 8000; it++) {
        md = 0; zm = 0;
        for (let i = 0; i < N; i++) {
          if (fixed[i]) { if (z[i] > zm) zm = z[i]; continue; }
          let s = load ? area[i] : 0;
          for (let e = off[i]; e < off[i + 1]; e++) s += wt[e] * z[nb[e]];
          const nz = z[i] + omega * (s / diag[i] - z[i]);
          const dz = Math.abs(nz - z[i]); if (dz > md) md = dz;
          z[i] = nz; if (nz > zm) zm = nz;
        }
        if (md < 1e-7 * zm) break;
      }
      iters += it;
      return z;
    }
    // 荷重解は縁(支点も含む)を0にしたいので edgeZ を一時的に使わない
    const edgeSave = Float64Array.from(edgeZ); edgeZ.fill(0);
    const zp = sor(true, 1);
    edgeZ.set(edgeSave);
    let em = 0; for (let i = 0; i < N; i++) em += edgeZ[i];
    const zh = sor(false, em / Math.max(1, nfix + gaps.reduce((s, g) => s + (g.s1 - g.s0 - 1), 0)));
    let zpm = 0; for (let i = 0; i < N; i++) if (zp[i] > zpm) zpm = zp[i];
    const maxZ = (k) => { let m = 0; for (let i = 0; i < N; i++) { const v = k * zp[i] + zh[i]; if (v > m) m = v; } return m; };
    let lo = 0, hi = d.H / zpm * 1.01;
    for (let r = 0; r < 60; r++) { const mid = (lo + hi) / 2; if (maxZ(mid) < d.H) lo = mid; else hi = mid; }
    const kk = (lo + hi) / 2;
    const ms = Date.now() - t0;
    const y = new Float64Array(N);
    for (let i = 0; i < N; i++) y[i] = Math.max(kk * zp[i] + zh[i], 0);
    return { N, NT, NS, px, pz, y, tris: Uint32Array.from(tris), idx, stats: { iters, ms, nfix, gaps: gaps.map((g) => [Math.round(g.L), +g.frac.toFixed(2)]) } };
  }

  // ---- コンクリートのテクスチャ(全案で共有) ----
  let tex = null;
  function concreteTexture() {
    if (tex) return tex;
    const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d');
    let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    c.fillStyle = '#d9d9d5'; c.fillRect(0, 0, S, S);
    const wrap = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy); };
    // 大きな色ムラ
    for (let k = 0; k < 90; k++) {
      const x = rnd() * S, y = rnd() * S, r = 60 + rnd() * 200, l = rnd() < 0.5 ? 255 : 150, a = 0.03 + rnd() * 0.05;
      wrap((ox, oy) => {
        const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, `rgba(${l},${l},${l - 4},${a})`); g.addColorStop(1, `rgba(${l},${l},${l - 4},0)`);
        c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      });
    }
    // 細かい粒
    const im = c.getImageData(0, 0, S, S), dt = im.data;
    for (let i = 0; i < dt.length; i += 4) {
      const n = (rnd() - 0.5) * 16 + (rnd() - 0.5) * 8;
      dt[i] += n; dt[i + 1] += n; dt[i + 2] += n * 0.95;
    }
    c.putImageData(im, 0, 0);
    // 気泡穴
    for (let k = 0; k < 900; k++) {
      const x = rnd() * S, y = rnd() * S, r = 0.6 + Math.pow(rnd(), 3) * 3.2;
      wrap((ox, oy) => {
        c.fillStyle = 'rgba(255,255,250,0.35)'; c.beginPath(); c.arc(x + ox + r * 0.35, y + oy + r * 0.35, r, 0, TAU); c.fill();
        c.fillStyle = `rgba(70,68,64,${0.45 + rnd() * 0.35})`; c.beginPath(); c.arc(x + ox, y + oy, r, 0, TAU); c.fill();
      });
    }
    // 薄い汚れの筋
    for (let k = 0; k < 40; k++) {
      const x = rnd() * S, y = rnd() * S, h = 80 + rnd() * 260;
      wrap((ox, oy) => {
        const g = c.createLinearGradient(0, y + oy, 0, y + oy + h);
        g.addColorStop(0, 'rgba(110,108,100,0)'); g.addColorStop(0.3, 'rgba(110,108,100,0.05)'); g.addColorStop(1, 'rgba(110,108,100,0)');
        c.fillStyle = g; c.fillRect(x + ox, y + oy, 3 + rnd() * 9, h);
      });
    }
    tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  // ---- メッシュを組む(全案共通) ----
  function buildShell(key) {
    const d = DEFS[key], F = buildField(d), { N, NT, NS, px, pz, y, tris, idx } = F;
    const T = THICK;
    // 上面
    const top = new Float32Array(N * 3), uv = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { top[3 * i] = px[i] * 100; top[3 * i + 1] = y[i]; top[3 * i + 2] = pz[i] * 100; uv[2 * i] = px[i] / 6; uv[2 * i + 1] = pz[i] / 6; }
    const gTop0 = new THREE.BufferGeometry();
    gTop0.setAttribute('position', new THREE.BufferAttribute(top, 3));
    gTop0.setIndex(new THREE.BufferAttribute(tris, 1));
    gTop0.computeVertexNormals();
    const nrm = gTop0.attributes.normal.array;
    // 下面 = 法線方向に厚み分下げる。y<0 になる所(足元)は地面に切り、上面を持ち上げて厚みを保つ
    const bot = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let bx = top[3 * i] - nrm[3 * i] * T, by = top[3 * i + 1] - nrm[3 * i + 1] * T, bz = top[3 * i + 2] - nrm[3 * i + 2] * T;
      by = Math.min(by, top[3 * i + 1] - T * 0.6); // 急な縁で下面が上面を越えないように
      if (by < 0) { by = 0; if (top[3 * i + 1] < T * 0.8) top[3 * i + 1] = T * 0.8; }
      bot[3 * i] = bx; bot[3 * i + 1] = by; bot[3 * i + 2] = bz;
    }
    const gTop = new THREE.BufferGeometry();
    gTop.setAttribute('position', new THREE.BufferAttribute(top, 3));
    gTop.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    gTop.setIndex(new THREE.BufferAttribute(tris, 1));
    gTop.computeVertexNormals();
    const trisF = new Uint32Array(tris.length);
    for (let t = 0; t < tris.length; t += 3) { trisF[t] = tris[t]; trisF[t + 1] = tris[t + 2]; trisF[t + 2] = tris[t + 1]; }
    const gBot = new THREE.BufferGeometry();
    gBot.setAttribute('position', new THREE.BufferAttribute(bot, 3));
    gBot.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    gBot.setIndex(new THREE.BufferAttribute(trisF, 1));
    gBot.computeVertexNormals();
    // 縁の側面(頂点を別にして、上面・下面との境をシャープにする)
    const sp = new Float32Array(NT * 2 * 3), su = new Float32Array(NT * 2 * 2), si = [];
    let acc = 0;
    for (let i = 0; i < NT; i++) {
      const v = idx(NS, i), v1 = idx(NS, i - 1);
      if (i > 0) acc += Math.hypot(top[3 * v] - top[3 * v1], top[3 * v + 2] - top[3 * v1 + 2]);
      for (let k = 0; k < 3; k++) { sp[6 * i + k] = top[3 * v + k]; sp[6 * i + 3 + k] = bot[3 * v + k]; }
      su[4 * i] = acc / 600; su[4 * i + 1] = top[3 * v + 1] / 600; su[4 * i + 2] = acc / 600; su[4 * i + 3] = bot[3 * v + 1] / 600;
    }
    for (let i = 0; i < NT; i++) { const a = 2 * i, b = 2 * ((i + 1) % NT); si.push(a, a + 1, b, b, a + 1, b + 1); }
    // 外向きに向ける
    {
      const a = si[0], b = si[1], c = si[2];
      const e1 = [sp[3 * b] - sp[3 * a], sp[3 * b + 1] - sp[3 * a + 1], sp[3 * b + 2] - sp[3 * a + 2]];
      const e2 = [sp[3 * c] - sp[3 * a], sp[3 * c + 1] - sp[3 * a + 1], sp[3 * c + 2] - sp[3 * a + 2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], nz = e1[0] * e2[1] - e1[1] * e2[0];
      const v = idx(NS, 0);
      if (nx * top[3 * v] + nz * top[3 * v + 2] < 0) for (let t = 0; t < si.length; t += 3) { const tmp = si[t + 1]; si[t + 1] = si[t + 2]; si[t + 2] = tmp; }
    }
    const gSide = new THREE.BufferGeometry();
    gSide.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    gSide.setAttribute('uv', new THREE.BufferAttribute(su, 2));
    gSide.setIndex(si);
    gSide.computeVertexNormals();
    return { d, F, geoms: [gTop, gBot, gSide] };
  }

  const cache = {};
  function make(key) {
    if (!cache[key]) cache[key] = buildShell(key);
    const { d, F, geoms } = cache[key];
    const t = concreteTexture();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, bumpMap: t, bumpScale: 0.7, roughness: 0.93, metalness: 0 });
    const g = new THREE.Group();
    for (const gm of geoms) { const m = new THREE.Mesh(gm, mat); m.castShadow = m.receiveShadow = true; g.add(m); }
    const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3());
    g.userData.info = {
      name: '自由曲面シェル「' + d.name + '」', supports: d.sup.length,
      span: Math.round(Math.max(sz.x, sz.z)), plan: [Math.round(sz.x), Math.round(sz.z)],
      height: Math.round(sz.y), thickness: THICK, solve: F.stats,
    };
    return g;
  }

  root.MODELS = root.MODELS || {};
  for (const k of Object.keys(DEFS)) root.MODELS[k] = () => make(k);
  root.__shellField = (k) => buildField(DEFS[k]);
})();
