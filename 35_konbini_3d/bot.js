// bot: 開発用のCPUプレイ(Bで切替)。プレイヤー入力の代わりに移動方向と長押しを返すだけ。状態Gは update 側が動かす
// ==================== CPU操作 ====================
let botOn = false;
const bot = { path: [], tgt: null, replan: 0, stuck: 0, lastKey: '' };
const HOME = { x: 7.5, y: 2.5 };
const findTile = ch => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] == ch) return { x, y }; return null; };
const T = (ch) => { const t = findTile(ch); return t && { tile: t, key: ch }; };

// 欠品しそうな商品を、減っている順に(カートに積んだ分は数えない)
function botNeedy(hold) {
  return SECTIONS.map((_, i) => i).filter(i => secOn(i) && secMax(i) - G.stock[i] - (hold && hold.items[i] || 0) >= TILE_MAX)
    .sort((a, b) => (G.stock[a] > 0) - (G.stock[b] > 0) || G.stock[a] / secMax(a) - G.stock[b] / secMax(b));   // 欠品(在庫0)を最優先
}
// 欠品の棚が前より増えたら緊急モードに入り、欠品がなくなるまで他の作業より補充を優先する
let botEmptyN = 0, botUrgent = false;
function botEmpties(hold) { return botNeedy(hold).filter(i => G.stock[i] <= 0); }
function botCheckUrgent() {
  const n = SECTIONS.reduce((s, _, i) => s + (secOn(i) && G.stock[i] <= 0 ? 1 : 0), 0);
  if (n > botEmptyN) botUrgent = true;
  if (n == 0) botUrgent = false;
  botEmptyN = n;
}
function shelfGoal(i) {
  const k = SECTIONS[i].tiles.find(([x, y]) => G.ts[y * W + x] < TILE_MAX) || SECTIONS[i].tiles[0];
  return { tile: { x: k[0], y: k[1] }, key: 'sec' + i + ':' + k[1] };
}

// 次にやること: { tile } = そのタイルの隣で長押し / { pos } = その位置の近くで長押し
function botPlan() {
  const p = G.p, c = p.carry, S = G.S;
  botCheckUrgent();
  if (!c && botUrgent && botEmpties(null).length && !G.cartOut) return T('C');
  if (c) {
    if (c.kind == 'mop') {   // 汚れが残るあいだ近い汚れへ。終わったらバックヤードの壁に戻す
      const sp = G.jobs.find(j => j.kind == 'spill');
      if (!sp) return { tile: MOP_HOME, key: 'mophome' };
      let best = null, bd = 1e9;
      for (const [k, v] of sp.dirty) { const d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bd) { bd = d; best = [k, v]; } }
      return { pos: best[1], key: 'dirty' + best[0] };
    }
    if (c.kind == 'delivery') return T('V');
    if (c.kind == 'bag') return T('D');
    if (c.kind == 'fried') return T('H');
    if (c.kind == 'frozen') return T('R');
    if (c.kind == 'crate') {
      const ids = Object.keys(c.items).map(Number), room = CART_MAX - inCrate(c);
      const need = botNeedy(c).filter(i => !c.items[i]);
      if (room > 0 && need.length && ids.length < 2) { const [bx, by] = BACK_POS[need[0]]; return { tile: { x: bx, y: by }, key: 'back' + need[0] }; }
      const dist = i => Math.hypot(SECTIONS[i].spots[0].x - p.x, SECTIONS[i].spots[0].y - p.y);
      if (ids.length) return shelfGoal(ids.sort((a, b) => dist(a) - dist(b))[0]);
      if (need.length) { const [bx, by] = BACK_POS[need[0]]; return { tile: { x: bx, y: by }, key: 'back' + need[0] }; }
      return T('C');   // 空のカートは返す
    }
    return null;
  }
  const dl = G.dels[0]; if (dl) return { pos: { x: dl.x, y: dl.y }, key: 'del' };
  if (G.jobs.some(j => j.kind == 'spill') && G.mop.st == 'lean') return { tile: { x: G.mop.x, y: G.mop.y }, key: 'mop' + G.mop.x + ',' + G.mop.y };
  if (G.jobs.some(j => j.kind == 'toilet')) return T('W');
  const jb = G.jobs.find(j => j.sec !== undefined); if (jb) return shelfGoal(jb.sec);
  if (S.hot && G.fryer.state == 'done') return T('R');
  if (S.hot && G.fryer.state == 'empty' && G.hot <= HOT_MAX - HOT_ADD) return T('F');
  if (S.trash && G.trash > 0) return T('T');
  if (botNeedy(null).length && !G.cartOut) return T('C');
  return { pos: HOME, key: 'home', idle: true };
}

// 戻り値: { mx, my, e }
function botStep(dt) {
  const p = G.p, px = Math.floor(p.x), py = Math.floor(p.y), out = { mx: 0, my: 0, e: false };
  const chaser = G.zs.find(z => z.state == 'chase' && (z.kind == 'staff' || !inBackyard(px, py)));
  const FLEE = [HOME, { x: 20.5, y: 2.5 }, { x: 12.5, y: 14.5 }, { x: 3.5, y: 16.5 }];   // 客からはバックヤードへ。店員ゾンビからは遠い所へ
  const fi = !chaser || chaser.kind != 'staff' ? 0 : FLEE.reduce((a, b, i) => Math.hypot(b.x - chaser.x, b.y - chaser.y) > Math.hypot(FLEE[a].x - chaser.x, FLEE[a].y - chaser.y) ? i : a, 0);
  const g = chaser ? { pos: FLEE[fi], key: 'flee' + fi, idle: true } : botPlan();
  if (!g) return out;
  if (g.key != bot.lastKey) { bot.lastKey = g.key; bot.path = null; bot.stuck = 0; }
  bot.replan -= dt;
  const isGoal = g.tile
    ? (x, y) => Math.abs(x - g.tile.x) + Math.abs(y - g.tile.y) == 1
    : (x, y) => Math.hypot(x + 0.5 - g.pos.x, y + 0.5 - g.pos.y) < (g.idle ? 0.8 : 0.5);
  if (!bot.path || bot.replan <= 0) {
    // ゾンビの近く(追跡中は広め)を避けて歩く。通れなければ気にせず最短で
    const near = (x, y) => G.zs.some(z => Math.hypot(z.x - x - 0.5, z.y - y - 0.5) < (z.state == 'chase' ? 2.2 : 1.6) && !(Math.abs(px - x) + Math.abs(py - y) == 0));
    bot.path = bfs(px, py, isGoal, (x, y) => playerWalk(x, y) && !near(x, y)) || bfs(px, py, isGoal, playerWalk); bot.replan = 0.2;
  }
  const path = bot.path;
  if (!path) { bot.stuck += dt; return out; }
  let tx, ty;
  if (path.length) { tx = path[0].x + 0.5; ty = path[0].y + 0.5; }
  else if (g.tile) { tx = px + 0.5; ty = py + 0.5; }
  else { tx = g.pos.x; ty = g.pos.y; }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d > (path.length ? 0.12 : 0.04)) { out.mx = dx / d; out.my = dy / d; }
  if (!path.length && !g.idle) {
    out.e = true;
    bot.stuck += dt;
    if (bot.stuck > 10) { bot.stuck = 0; bot.path = null; bot.lastKey = ''; if (p.carry && p.carry.kind == 'crate') dropCarry(); }   // 10秒進まなければ立て直す
  }
  return out;
}

function toggleBot() {
  botOn = !botOn; bot.path = null; bot.lastKey = '';
  if (G) toast(botOn ? 'CPUがプレイ中 (Bで戻す)' : 'CPUをやめた。操作は自分に戻った', '#8ad0ff');
}
