// 調整で変わる数値はここだけ。仕組みは gait.js(歩き方と IK)/ bend.js(曲げ)/ main.js(画面)
window.DEFS = {
  model: 'sculpt_c_vein',     // 最初に出す脚の種類(sculpt_c_strand / _vein / _muscle。V で切替)

  // 歩き方。phase = 脚ごとの位相(0〜1)、beta = 1周期のうち接地している割合
  gaits: {
    6:  { name: '3本ずつ交互', beta: 0.56, phase: i => (i % 2) * 0.5 },
    8:  { name: '4本ずつ交互', beta: 0.56, phase: i => (i % 2) * 0.5 },
    10: { name: '1本ずつの波', beta: 0.80, phase: i => (i * 3 % 10) / 10 },
    12: { name: '前から後ろへの波', beta: 0.75, phase: i => ((i % 6) / 6 + (i < 6 ? 0 : 0.5)) % 1 },
  },
  period: 4.2,        // 1歩の周期 [s]
  speed: 55,          // 進む速さ [cm/s](1周期で speed*period 進む = 歩幅)
  swingHeight: 120,   // 足を上げる高さ [cm]
  bob: 7,             // 胴体の上下 [cm]

  // 脚のしなり(curve.js)。amp = 骨の長さに対するふくらみ、peak = ふくらみの位置(0=付け根側/膝側 〜 1)、
  // p = 両端の向きのそろい方(1 で弧、大きいほど中央だけがふくらむ)
  curve: {
    femur: { amp: 0.13, peak: 0.50, p: 1.3 },   // 上の骨: 上に反る
    tibia: { amp: 0.08, peak: 0.36, p: 1.3 },   // 下の骨: 膝寄りで外へふくらみ、足先へまっすぐ細く
  },

  // 道すじ: 半径 R の円をゆっくり回る
  pathRadius: 2200,

  // 曲げ(鉛直の反力だけを考える近似)
  massTon: 18,        // 彫刻の質量 [t](鋳鉄の灯籠のつもり)
  loadRamp: 0.08,     // 接地の始まりと終わりで荷重をなめらかに移す幅(周期に対する割合)
  colorMax: 1.4,      // 色の上限 = 1本あたり W/3 × 付け根〜足先の水平距離 の何倍か
  rampLow: [0.20, 0.19, 0.18],  // 曲げ 0 の色(暗い灰)
  rampHigh: [1.00, 0.62, 0.16], // 曲げ 最大の色(橙)

  ground: 0x8d8579,
  sky: 0xc9cdd2,
};
