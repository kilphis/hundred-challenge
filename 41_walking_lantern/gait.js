// 歩き方と IK。胴体を道すじに沿って進め、各脚の足先を
//   接地中 = 地面の1点に固定 / 遊脚中 = 次の着地点へ弧を描いて運ぶ
// と決めてから、足先の位置から関節の角度を逆算する(solveLeg)。
(function () {
  const D = window.DEFS;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ease = w => w * w * (3 - 2 * w);

  // 2本の骨の IK(SPEC.md と同じ)。余弦定理で膝の角度を出す
  function solveLeg(leg, target) {
    const p = leg.hip.parent.worldToLocal(target.clone()).sub(leg.hip.position);
    leg.hip.rotation.set(0, Math.atan2(p.x, p.z), 0);             // 1) 付け根を足先の方へ向ける
    leg.hip.updateMatrixWorld(true);
    const t = leg.hip.worldToLocal(target.clone());                 // 2) 脚の縦の面の中の2次元問題
    const L1 = leg.L1, L2 = leg.L2;
    const r = Math.min(Math.max(Math.hypot(t.y, t.z), Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-3);
    const phi = Math.atan2(-t.y, t.z);                              // 足先への下向きの角
    const alpha = Math.acos((L1 * L1 + r * r - L2 * L2) / (2 * L1 * r)); // 付け根の角(三角形の内角)
    const beta = Math.acos((L1 * L1 + L2 * L2 - r * r) / (2 * L1 * L2)); // 膝の内角
    leg.femur.rotation.x = phi - alpha;                             // 膝を上に出す側の解
    leg.knee.rotation.x = Math.PI - beta;
    return { r, phi, alpha, beta };
  }

  // 道すじ: 原点から +Z へ出発し、中心 (R,0,0) の円を回る。s = 進んだ距離
  function pathPose(s) {
    const R = D.pathRadius, a = s / R;
    return { x: R - R * Math.cos(a), z: R * Math.sin(a), yaw: a };
  }

  function createWalker(model) {
    const legs = model.userData.legs, n = legs.length;
    const gait = D.gaits[n] || { name: '波', beta: 0.75, phase: i => i / n };
    const body = model.userData.body;
    const base = { y: body.position.y, rx: body.rotation.x, rz: body.rotation.z };
    const W = {
      model, gait, n, s: 0, t: 0, speed: D.speed, paused: false,
      legs: legs.map((leg, i) => ({ leg, i, phase: gait.phase(i), stance: true, u: 0, load: 1,
        foot: V(0, 0, 0), from: V(0, 0, 0), to: V(0, 0, 0), ik: null })),
    };

    // 距離 s の時点での、脚 i の立ち位置(足先の基準点)を世界座標で
    function homeAt(s, L) {
      const p = pathPose(s), f = L.leg.foot, c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
      return V(p.x + f.x * c + f.z * sn, 0, p.z - f.x * sn + f.z * c);
    }
    const T = () => D.period, B = gait.beta;

    function phaseOf(L) { return ((W.t / T() - L.phase) % 1 + 1) % 1; }

    // 初期の足の位置: 接地中なら「接地の真ん中で基準点に来る」点、遊脚中ならその前の接地点
    function init() {
      for (const L of W.legs) {
        const u = phaseOf(L);
        if (u < B) { L.stance = true; L.foot.copy(homeAt(W.s + W.speed * (0.5 - u / B) * B * T(), L)); }
        else {
          const w = (u - B) / (1 - B);
          L.stance = false; L.from.copy(homeAt(W.s - W.speed * (w * (1 - B) * T() + B * T() / 2), L));
        }
      }
    }

    function update(dt) {
      if (!W.paused) { W.t += dt; W.s += W.speed * dt; }
      const p = pathPose(W.s), tau = W.t / T();
      model.position.set(p.x, 0, p.z); model.rotation.y = p.yaw;
      // 胴体の揺れ: 交互の組が入れ替わるたびに少し沈み、接地側へわずかに傾く
      body.position.y = base.y + D.bob * Math.cos(4 * Math.PI * tau);
      body.rotation.z = base.rz + 0.012 * Math.sin(2 * Math.PI * tau);
      body.rotation.x = base.rx + 0.006 * Math.sin(4 * Math.PI * tau + 1);
      model.updateMatrixWorld(true);

      const rampU = D.loadRamp;
      for (const L of W.legs) {
        const u = phaseOf(L); L.u = u;
        if (u < B) {                                     // 接地中
          if (!L.stance) { L.stance = true; L.foot.copy(L.to).setY(0); }
          const into = u, left = B - u;                  // 接地の始まり・終わりからの距離(周期比)
          L.load = Math.min(1, into / rampU, left / rampU);
        } else {                                         // 遊脚中
          const w = (u - B) / (1 - B);
          if (L.stance) { L.stance = false; L.from.copy(L.foot); }
          // 次の接地の真ん中で基準点に来るよう、着地点を先回りして決める
          const ahead = (1 - w) * (1 - B) * T() + B * T() / 2;
          L.to.copy(homeAt(W.s + W.speed * ahead, L));
          L.foot.lerpVectors(L.from, L.to, ease(w));
          L.foot.y = D.swingHeight * Math.sin(Math.PI * w);
          L.load = 0;
        }
        L.ik = solveLeg(L.leg, L.foot);
      }
    }

    init(); update(0);
    return Object.assign(W, { update, homeAt, solveLeg });
  }

  window.GAIT = { createWalker, solveLeg, pathPose };
})();
