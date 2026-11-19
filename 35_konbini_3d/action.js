// action: プレイヤーの作業(E長押しで何をするか)。actionAt=タイルごとの作業、currentAction=いま実行できる1つ。状態Gを読み、run() で変える

// ==================== 作業(アクション) ====================
function crateList(c) {
  return Object.entries(c.items).map(([i, n]) => SECTIONS[i].name + '×' + n).join('  ');
}
function carryName(c) {
  if (!c) return '';
  if (c.kind == 'crate') return c.cart ? 'カート' : '商品';
  return { frozen: '冷凍ホットスナック', fried: '揚げたてホットスナック', bag: 'ゴミ袋', mop: 'モップ', delivery: '納品箱' }[c.kind];
}

const INFO = Infinity;   // dur が INFO の作業は表示だけ(実行できない)
function actionAt(x, y) {
  const c = tile(x, y), p = G.p, S = G.S;
  if (p.carry && p.carry.kind == 'mop') return mopLeanable(c) ? { label: 'モップを立てかける' + (isShelf(c) ? '(棚だと放置で苦情)' : ''), dur: 0.4, run: () => leanMop(x, y) } : null;
  if (!p.carry && G.mop.st == 'lean' && G.mop.x == x && G.mop.y == y) return { label: 'モップを持つ(歩くと幅3マスを拭く)', dur: 0.3, run: pickMop };
  if (DEPTS[c]) {   // バックヤードの在庫棚: 4つの大きな棚(区分)のどのタイルからでも、その区分で足りない商品をまとめて持てる
    const i0 = backSec[y * W + x], g0 = Math.floor(i0 / BACK_BLOCKS), shelf = BACK_OF[i0].shelf;
    if (p.carry && p.carry.kind != 'crate') return null;
    const hold = p.carry;   // カートでも、手持ち(cart なし)でもよい
    const cap = hold && hold.cart ? CART_MAX : HAND_MAX; let room = cap - (hold ? inCrate(hold) : 0);
    const room0 = room, takes = [];
    const ids = SECTIONS.map((_, j) => j).filter(j => Math.floor(j / BACK_BLOCKS) == g0 && secOn(j))
      .sort((a, b) => G.stock[a] / secMax(a) - G.stock[b] / secMax(b));
    ids.forEach(j => { const n = Math.min(room, secMax(j) - G.stock[j] - (hold && hold.items[j] || 0)); if (n > 0) { takes.push([j, n]); room -= n; } });
    G.preview = (takes[0] || [i0])[0];
    if (room0 <= 0) return { label: (hold && hold.cart ? 'カート' : '手') + 'がいっぱい(' + cap + '個まで)', dur: INFO, run: () => {} };
    if (!takes.length) return { label: shelf + 'の棚：補充は要らない', dur: INFO, run: () => {} };
    return { label: shelf + 'の棚：' + takes.map(([j, n]) => SECTIONS[j].name + '×' + n).join('・') 
      + 'を' + (hold ? '足して' : '') + '持つ' + (hold && hold.cart ? '' : '(手で)'),
      dur: 0.5, run: () => {
      if (!p.carry) p.carry = { kind: 'crate', dept: 'p', items: {} };
      takes.forEach(([j, n]) => { p.carry.items[j] = (p.carry.items[j] || 0) + n; }); tutEvent('crate');
    } };
  }
  if (c == 'C') {
    const out = p.carry && p.carry.cart ? 'carried' : G.drops.some(d => d.carry.cart) ? 'placed' : G.cartOut ? 'carried' : 'home';
    if (out == 'home') return { label: 'カートを引き出す(1台だけ・多く運べる・壁にもなる)', dur: 0.5, run: () => { p.carry = { kind: 'crate', cart: true, dept: 'p', items: {} };
      G.cartOut = true;
      tutEvent('cart');
      } };
    if (p.carry && p.carry.cart && !inCrate(p.carry)) return { label: 'カートを戻す', dur: 0.5, run: () => { p.carry = null; G.cartOut = false; } };
    return { label: out == 'placed' ? 'カートは店内に出ている' : 'カートを戻すには空にする', dur: INFO, run: () => {} };
  }
  if (c == 'F' && S.hot && !p.carry)
    return { label: '冷凍ホットスナックを持つ', dur: 0.3, run: () => { p.carry = { kind: 'frozen' }; tutEvent('frozen'); } };
  if (isShelf(c)) {
    const k = y * W + x, i = secAt[k], s = SECTIONS[i];
    if (p.carry && p.carry.kind == 'crate' && p.carry.items[i]) {
      if (G.ts[k] >= TILE_MAX) return { label: 'このブロックは満杯(' + s.name + ')', dur: INFO, run: () => {} };
      return { label: s.name + 'をこのブロックに補充 ' + G.ts[k] + '/' + TILE_MAX + '(長押しで1個ずつ)', dur: REFILL_STEP, repeat: true, run: () => {
        tileAdd(i, k, 1); p.carry.items[i]--; G.stocked++; tutEvent('stock');
        if (p.carry.items[i] <= 0) delete p.carry.items[i];
        if (!Object.keys(p.carry.items).length) { toast(p.carry.cart ? 'カートが空になった(置くか、返す)' : '手持ちが空になった', '#b7e08a');
          if (!p.carry.cart) p.carry = null; }
      } };
    }
    const j = !p.carry && G.jobs.find(j => j.sec === i);
    if (j) return { label: j.kind == 'tidy' ? s.name + 'の棚を整える' : s.name + 'の期限切れを撤去', dur: 0.48, run: () => doneJob(j) };
    return { label: s.name + '　このブロック ' + G.ts[k] + '/' + TILE_MAX + '　商品全体 ' + G.stock[i] + '/' + secMax(i), dur: INFO, run: () => {} };
  }
  if (c == 'R' && S.hot) {
    if (G.fryer.state == 'empty' && p.carry && p.carry.kind == 'frozen')
      return { label: 'フライヤーに入れる', dur: 0.8, run: () => { G.fryer = { state: 'frying', t: FRY_TIME }; p.carry = null; tutEvent('fry'); } };
    if (G.fryer.state == 'done' && !p.carry)
      return { label: '揚げあがりを取り出す', dur: 0.5, run: () => { G.fryer = { state: 'empty', t: 0 }; p.carry = { kind: 'fried' }; tutEvent('take'); } };
  }
  if (c == 'H' && S.hot && p.carry && p.carry.kind == 'fried')
    return { label: 'ホットケースに並べる', dur: 0.8, run: () => { G.hot = Math.min(HOT_MAX, G.hot + HOT_ADD); p.carry = null; G.hotAdded++; tutEvent('hot'); } };
  if (c == 'T' && S.trash && !p.carry && G.trash > 0)
    return { label: 'ゴミ袋をまとめる', dur: 1.0, run: () => { G.trash = 0; p.carry = { kind: 'bag' }; } };
  if (c == 'W') {
    const j = !p.carry && G.jobs.find(j => j.kind == 'toilet');
    if (j) return { label: 'トイレを掃除する', dur: TOILET_TIME, run: () => doneJob(j) };
    return { label: 'トイレ', dur: INFO, run: () => {} };
  }
  if (c == 'V' && p.carry && p.carry.kind == 'delivery') return inspectAction(p.carry);
  if (c == 'D' && p.carry && p.carry.kind == 'bag')
    return { label: 'ゴミを捨てる', dur: 0.4, run: () => { p.carry = null; G.trashOut++; } };
  return null;
}

function currentAction() {
  const p = G.p, px = Math.floor(p.x), py = Math.floor(p.y);
  const dl = !p.carry && G.dels.find(d => Math.hypot(d.x - p.x, d.y - p.y) < 1.0);
  if (dl) return { label: '納品の箱を持つ', dur: 0.4, run: () => { G.dels.splice(G.dels.indexOf(dl), 1);
    p.carry = { kind: 'delivery', bad: dl.bad, checked: false };
    } };
  let best = null, bd = 9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const x = px + dx, y = py + dy;
    // タイルの矩形までの距離
    const ddx = Math.max(x - p.x, 0, p.x - (x + 1)), ddy = Math.max(y - p.y, 0, p.y - (y + 1));
    const d = Math.hypot(ddx, ddy);
    if (d > 0.55) continue;
    const a = actionAt(x, y);
    const face = Math.cos(p.dir) * (x + 0.5 - p.x) + Math.sin(p.dir) * (y + 0.5 - p.y);   // 向いている側を優先
    const score = a ? d - 0.1 * Math.sign(face) + (a.dur == INFO ? 1 : 0) : 9;   // 実行できる作業を優先
    if (a && score < bd) { best = a; bd = score; }
  }
  if ((!best || best.dur == INFO) && !p.carry) for (const d of G.drops) if (Math.hypot(d.x - p.x, d.y - p.y) < 1.3)
    return { label: carryName(d.carry) + 'を拾う', dur: 0.3, run: () => { p.carry = d.carry; G.drops.splice(G.drops.indexOf(d), 1); tutEvent('pick'); } };
  return best;
}
