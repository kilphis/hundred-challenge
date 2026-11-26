// 曲げ。接地中の脚に重さを分け、各脚の骨に沿った曲げモーメントを計算して色で塗る。
// 近似: 足先には鉛直の反力 R だけが掛かる(横向きの力・脚の自重は無視)。
//   すると骨の上の点 Q での曲げ M(Q) = R × (Q と足先の水平距離)。足先で0、付け根で最大。
(function () {
  const D = window.DEFS;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const G = 9.81;

  // 3x3 の連立方程式(クラメル)
  function solve3(m, b) {
    const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
    const d = det(m); if (Math.abs(d) < 1e-12) return null;
    return [0, 1, 2].map(k => det(m.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / d);
  }

  // 反力の分け方: 合力 = W、重心まわりのモーメント = 0 を満たす中で Σ R_i²/w_i が最小のもの
  //   R = Wd Aᵀ (A Wd Aᵀ)⁻¹ b   (A の行 = [1], [x_i - cx], [z_i - cz]、b = [W,0,0]、Wd = 荷重の重み)
  function reactions(feet, weights, com, Wt) {
    const w = weights.slice(), n = feet.length;
    for (let iter = 0; iter < n; iter++) {
      const A = [feet.map(() => 1), feet.map(f => (f.x - com.x) / 100), feet.map(f => (f.z - com.z) / 100)];
      const M = [0, 1, 2].map(i => [0, 1, 2].map(j => A[i].reduce((s, a, k) => s + a * w[k] * A[j][k], 0) + (i === j ? 1e-6 : 0)));
      const lam = solve3(M, [Wt, 0, 0]);
      if (!lam) return feet.map(() => 0);
      const R = feet.map((_, k) => w[k] * (lam[0] * A[0][k] + lam[1] * A[1][k] + lam[2] * A[2][k]));
      const neg = R.findIndex(r => r < -1e-9);
      if (neg < 0) return R;
      w[neg] = 0;                                   // 引っ張る脚は外して解き直す(重心が支持多角形の外)
    }
    return feet.map(() => 0);
  }

  function createBend(walker) {
    const model = walker.model, Wt = D.massTon * G;   // 重さ [kN]
    const bones = [];
    model.traverse(o => {
      if (!o.isMesh || !o.userData.seg) return;
      o.geometry = o.geometry.clone();                // 脚ごとに色を持つので形を共有しない
      const pos = o.geometry.attributes.position, n = pos.count;
      const col = new Float32Array(n * 3);
      o.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
      let rRoot = 0; const zs = new Float32Array(n);
      for (let k = 0; k < n; k++) { zs[k] = pos.getZ(k); if (zs[k] < 15) rRoot = Math.max(rRoot, Math.hypot(pos.getX(k), pos.getY(k))); }
      // 曲がった骨は中心線が y にずれている(curve.js)。その分を引いて半径を測る
      const cf = o.userData.curve || (() => 0), cs = new Float32Array(n);
      for (let k = 0; k < n; k++) cs[k] = cf(zs[k]);
      rRoot = 0;
      for (let k = 0; k < n; k++) if (zs[k] < 15) rRoot = Math.max(rRoot, Math.hypot(pos.getX(k), pos.getY(k) - cs[k]));
      bones.push({ mesh: o, leg: o.userData.leg, seg: o.userData.seg, zs, cs, col, mat: o.material, rRoot });
    });
    const heat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });

    // 付け根の半径(上の骨の z≈0 の太さ)と、色の基準のモーメント
    const legs = walker.legs.map(L => {
      const b1 = bones.find(b => b.leg === L.i && b.seg === 1);
      const hip = L.leg.hip.getWorldPosition(V(0, 0, 0)).sub(model.position);
      const f = L.leg.foot.clone().applyEuler(model.rotation);
      return { rRoot: b1 ? b1.rRoot : 10, reach: Math.hypot(hip.x - f.x, hip.z - f.z) };
    });
    const reachAvg = legs.reduce((s, l) => s + l.reach, 0) / legs.length;
    const Mref = (Wt / 3) * (reachAvg / 100) * D.colorMax;   // [kN·m]

    const B = { on: false, R: [], Mroot: [], sigma: [], Mref, Wt, com: V(), legs };

    function ramp(x, out, k) {
      const t = Math.min(1, Math.max(0, x)), a = D.rampLow, c = D.rampHigh;
      out[k] = a[0] + (c[0] - a[0]) * t; out[k + 1] = a[1] + (c[1] - a[1]) * t; out[k + 2] = a[2] + (c[2] - a[2]) * t;
    }
    B.ramp = ramp;

    function setOn(on) {
      B.on = on;
      for (const b of bones) b.mesh.material = on ? heat : b.mat;
    }

    const Q0 = V(), Q1 = V(), Q2 = V();
    function update() {
      model.userData.body.getWorldPosition(B.com);
      const feet = walker.legs.map(L => L.foot), w = walker.legs.map(L => L.load);
      B.R = reactions(feet, w, B.com, Wt);
      walker.legs.forEach((L, i) => {
        const hip = L.leg.hip.getWorldPosition(Q0);
        const d = Math.hypot(hip.x - L.foot.x, hip.z - L.foot.z) / 100;
        B.Mroot[i] = B.R[i] * d;                                          // [kN·m]
        const r = legs[i].rRoot / 100, Z = Math.PI * r * r * r / 4;       // 丸棒の断面係数 [m³]
        B.sigma[i] = B.Mroot[i] / Z / 1000;                               // [MPa]
      });
      if (!B.on) return;
      for (const b of bones) {
        const L = walker.legs[b.leg], F = L.foot, R = B.R[b.leg];
        b.mesh.localToWorld(Q0.set(0, 0, 0)); b.mesh.localToWorld(Q1.set(0, 0, 1)).sub(Q0); b.mesh.localToWorld(Q2.set(0, 1, 0)).sub(Q0);
        // 中心線の点 = Q0 + z·(骨の向き) + c(z)·(骨に直角な向き)。その点と足先の水平距離 × R
        const ax = (Q0.x - F.x) / 100, az = (Q0.z - F.z) / 100, bx = Q1.x / 100, bz = Q1.z / 100, ex = Q2.x / 100, ez = Q2.z / 100;
        for (let k = 0; k < b.zs.length; k++) {
          const z = b.zs[k], c = b.cs[k];
          ramp(R * Math.hypot(ax + z * bx + c * ex, az + z * bz + c * ez) / Mref, b.col, k * 3);
        }
        b.mesh.geometry.attributes.color.needsUpdate = true;
      }
    }
    return Object.assign(B, { update, setOn, dispose: () => setOn(false) });
  }

  window.BEND = { createBend, reactions };
})();
