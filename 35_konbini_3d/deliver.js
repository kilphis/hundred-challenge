// deliver: 納品(裏路地に箱が届く)・検品(検品台で伝票と照合)。トイレ掃除は tasks.js の任されるタスクと同じ仕組み
function updateDeliver(dt) {
  const S = G.S; if (!S.deliver) return;
  G.delT -= dt;
  if (G.delT <= 0) {
    G.delT = rnd(DELIVER_EVERY[0], DELIVER_EVERY[1]);
    const free = DEL_SPOTS.filter(([x, y]) => !G.dels.some(d => d.x == x && d.y == y));
    if (G.dels.length < DELIVER_MAX && free.length) {
      const [x, y] = pick(free); G.dels.push({ x, y, t: 0, bad: S.inspect && Math.random() < BAD_RATE });
      toast('納品が届いた(裏路地)', '#ffcc55');
    }
  }
  for (const d of G.dels.slice()) {
    d.t += dt;
    if (d.t > DELIVER_LIMIT) { G.dels.splice(G.dels.indexOf(d), 1); miss('納品が滞っている'); }
  }
}
function finishDelivery(c) { G.p.carry = null; G.delDone++; }
// 検品台での作業。検品なしのシフトは置くだけ。あり: 照合 → 数違いなら返品
function inspectAction(c) {
  if (!G.S.inspect) return { label: '納品の箱を検品台に置く(納品)', dur: 0.6, run: () => { finishDelivery(c); toast('納品した', '#b7e08a'); } };
  if (!c.checked) return { label: '伝票と照合する(検品)', dur: INSPECT_TIME, run: () => {
    c.checked = true;
    if (!c.bad) { finishDelivery(c); toast('検品OK。納品完了', '#b7e08a'); }
    else toast('数が合わない！ 伝票に書いて返品する', '#ff9966');
  } };
  return { label: '不足を伝票に書いて返品する', dur: 1.0, run: () => { G.returns++; finishDelivery(c); toast('返品した', '#b7e08a'); } };
}
