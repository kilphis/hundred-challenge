// 川の形・数値・岩の配置。調整はこのファイルだけで済ませる。
// 座標は「川座標」: s = 上流からの距離(m)、d = 川の中心線からの横位置(m、右が +)
const D = {
  LENGTH: 1800,        // ゴールの s
  HP: 5,
  RAFT_R: 1.5,         // 筏の当たり半径
  INVULN: 1.2,         // 被弾後の無敵秒

  // 操作・流れ
  FLOW_BASE: 5.5,      // ふつうの流れの速さ m/s
  FLOW_RAPID: 4.0,     // 急流で足される速さ
  PADDLE_FWD: 3.5,     // 前に漕いだときの上乗せ
  PADDLE_BACK: 3.0,
  STEER_ACC: 16,       // 左右の加速度
  SIDE_DRAG: 1.8,

  // 急流の区間 [開始 s, 終了 s]
  rapids: [[380, 520], [900, 1060], [1400, 1560]],

  cx(s) { return 18 * Math.sin(s / 60) + 9 * Math.sin(s / 23 + 1); },
  dcx(s) { return 0.3 * Math.cos(s / 60) + (9 / 23) * Math.cos(s / 23 + 1); },
  ddcx(s) { return -(0.3 / 60) * Math.sin(s / 60) - (9 / 529) * Math.sin(s / 23 + 1); },

  halfW(s) { return 8.5 + 2.5 * Math.sin(s / 70) + 1.2 * Math.sin(s / 31 + 2) - 1.5 * D.rapidness(s); },

  rapidness(s) {
    let m = 0;
    for (const [a, b] of D.rapids) {
      const t = Math.min((s - a) / 40, (b - s) / 40, 1);
      if (t > 0) m = Math.max(m, t * t * (3 - 2 * t));
    }
    return m;
  },
  flow(s) { return D.FLOW_BASE + D.FLOW_RAPID * D.rapidness(s); },

  // 岸の高さ(e = 岸の縁からの距離)
  bankH(s, e, side) {
    const k = Math.min(1, e / 10), k2 = Math.min(1, e / 14);
    return 0.35 + e * 0.1 + 1.6 * k * Math.sin(s / 17 + e / 9 + side * 2) + 1.2 * k2 * Math.sin(s / 7.3 + e / 5);
  },

  // 川座標 → 世界座標と進行方向
  frame(s, d, out) {
    const dc = D.dcx(s), n = Math.hypot(1, dc);
    out.x = D.cx(s) + d / n; out.z = -s + d * dc / n;
    out.heading = Math.atan2(-dc, 1);  // rotation.y(-z が前向きのモデル用)
    out.nx = 1 / n; out.nz = dc / n;
    return out;
  },

  rocks: [],
};

// 岩を決まった並びで置く(毎回同じ川)
(function () {
  let a = 20260122;
  const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let s = 70, side = 1;
  while (s < D.LENGTH - 50) {
    const rap = D.rapidness(s);
    const hw = D.halfW(s);
    side = rnd() < 0.7 ? -side : side;           // 左右に振りやすくする
    const r = 0.9 + rnd() * 1.1 + rap * 0.3;
    const d = side * (rnd() * (hw - r - 2.5));
    D.rocks.push({ s, d, r, seed: rnd() });
    if (rap > 0.5 && rnd() < 0.5) {              // 急流では2つ並べる(間は通れる)
      const d2 = -Math.sign(d || 1) * Math.min(hw - 2.5, Math.abs(d) + 5 + r);
      D.rocks.push({ s: s + 2 + rnd() * 3, d: d2, r: 0.9 + rnd() * 0.8, seed: rnd() });
    }
    s += 16 - rap * 4 + rnd() * 9;
  }
})();
