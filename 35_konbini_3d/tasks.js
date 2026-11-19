// tasks: 研修ステップ・任されるタスク(整頓/期限切れ撤去/床掃除)・床の荷物と店長の動き・全面開放。描画しない
// ==================== 研修 ====================
function tutEvent(ev) {
  if (!G.tut || !G.tut.length || G.tut[0].ev != ev) return;
  G.tut.shift(); toast(G.tut.length ? '✓ OK。次のステップへ' : '✓ 研修ステップ完了。あとは自由に', '#b7e08a');
}
// 現在のステップの目的地(タイル中心)。なければ null
function tutTarget() {
  const st = G.tut && G.tut[0]; if (!st || !st.at) return null;
  const p = G.p;
  if (st.at == 'drop') return G.drops[0] ? { x: G.drops[0].x, y: G.drops[0].y } : null;
  if (st.at == 'shelf') {
    const ids = p.carry && p.carry.kind == 'crate' ? Object.keys(p.carry.items) : [];
    if (!ids.length) return null;
    const i = ids.sort((a, b) => Math.hypot(SECTIONS[a].spots[0].x - p.x, SECTIONS[a].spots[0].y - p.y) - Math.hypot(SECTIONS[b].spots[0].x - p.x, SECTIONS[b].spots[0].y - p.y))[0];
    const t = SECTIONS[i].tiles; return { x: t[0][0] + 0.5, y: (t[0][1] + t[t.length - 1][1]) / 2 + 0.5 };
  }
  let best = null, bd = 1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] == st.at) {
    const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y); if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
  }
  return best;
}

// ==================== 荷物を床に置く ====================
// 向いている方向の1マス先にだけ置ける。カートは店長に片付けられず、ゾンビの通れない壁になる
function dropCarry() {
  const p = G.p; if (!p.carry) return;
  if (p.carry.kind == 'mop') return toast('モップは壁や棚に立てかける', '#ff9966');
  const c = Math.cos(p.dir), s = Math.sin(p.dir);
  const dx = Math.abs(c) > Math.abs(s) ? Math.sign(c) : 0, dy = dx ? 0 : Math.sign(s);
  const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
  if (tile(x, y) != '.' || dropAt(x, y) || G.zs.some(z => Math.hypot(z.x - x - 0.5, z.y - y - 0.5) < 0.9))
    return toast('そこには置けない', '#ff9966');
  G.drops.push({ x: x + 0.5, y: y + 0.5, carry: p.carry }); p.carry = null;
  toast(G.drops[G.drops.length - 1].carry.cart ? 'カートを前に置いた(壁になる。店長は片付けない)' : '前に置いた', '#aaa'); tutEvent('drop');
}

// ==================== 全面開放 ====================
function openShop() {
  G.closed = false;
  for (let y = 6; y <= 18; y++) set(SHUT_X, y, '.');
  set(ALLEY_DOOR.x, ALLEY_DOOR.y, 'd');
  SECTIONS.forEach((s, i) => { if (s.tiles[0][0] >= SHUT_X) fillSec(i, true); });
  toast('客が増えてきたので、店の奥も開けた', '#ffcc55');
}

// ==================== 任されるタスク ====================
function doneJob(j) {
  G.jobs.splice(G.jobs.indexOf(j), 1); G.jobsDone++;
  toast({ tidy: '棚を整えた', expire: '期限切れを撤去した', spill: '床を拭いた', toilet: 'トイレを掃除した' }[j.kind], '#b7e08a');
}
function updateJobs(dt) {
  const S = G.S, kinds = ['tidy', 'expire', 'spill', 'toilet'].filter(k => S[k]);
  if (!kinds.length) return;
  G.jobT -= dt;
  if (G.jobT <= 0) {
    G.jobT = rnd(JOB_EVERY[0], JOB_EVERY[1]);
    const k = pick(kinds);
    if (G.jobs.length < JOB_MAX) {
      if (k == 'toilet') {
        if (!G.jobs.some(j => j.kind == 'toilet')) G.jobs.push({ kind: k, t: 0 });
      } else if (k == 'spill') {
        if (!G.jobs.some(j => j.kind == 'spill' && j.zone >= 0)) addSpillZone();
      } else {
        const free = SECTIONS.map((_, i) => i).filter(i => secOn(i) && G.stock[i] > 0 && !G.jobs.some(j => j.sec === i)
          && (k != 'expire' || !(G.t - (G.fresh[i] ?? -1e9) < FRESH_SEC)));
        if (free.length) G.jobs.push({ kind: k, sec: pick(free), t: 0 });
      }
    }
  }
  for (const j of G.jobs.slice()) {
    j.t += dt;
    if (JOB_LIMIT[j.kind] && j.t > JOB_LIMIT[j.kind]) { G.jobs.splice(G.jobs.indexOf(j), 1); miss(JOB_MSG[j.kind]); }
  }
}

// ==================== 床掃除(モップ) ====================
// 汚れは床タイルごとに持つ(j.dirty: タイル番号 → 位置)。区画の汚れは1つの任務、ゾンビの汚した1マスは同じ任務に足す
const mopLeanable = c => c == '#' || c == 'S' || !!DEPTS[c];
function addSpillZone() {
  const ok = MOP_ZONES.map((z, i) => i).filter(i => !G.closed || MOP_ZONES[i].x1 < SHUT_X);
  if (!ok.length) return;
  const i = pick(ok), z = MOP_ZONES[i], dirty = new Map();
  for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) if (storeWalk(x, y)) dirty.set(y * W + x, { x: x + 0.5, y: y + 0.5 });
  let j = G.jobs.find(j => j.kind == 'spill');
  if (!j) { j = { kind: 'spill', zone: i, dirty, total: dirty.size, t: 0 }; G.jobs.push(j); }
  else { j.zone = i; dirty.forEach((v, k) => j.dirty.set(k, v)); j.total = j.dirty.size; }
  toast(z.name + 'が汚れている(モップで拭く)', '#8ad0ff');
}
function addSpillTile(fx, fy) {
  if (!G.S.spill) return;   // 床の清掃が解放される前のシフトでは汚れない
  const x = Math.floor(fx), y = Math.floor(fy); if (!storeWalk(x, y)) return;
  let j = G.jobs.find(j => j.kind == 'spill');
  if (!j) { j = { kind: 'spill', zone: -1, dirty: new Map(), total: 0, t: 0 }; G.jobs.push(j); }
  if (!j.dirty.has(y * W + x)) { j.dirty.set(y * W + x, { x: x + 0.5, y: y + 0.5 }); j.total++; }
}
// モップを持って歩くと、進行方向に直角な3マスの床を拭く
function rollMop(p = G.p, done = doneJob) {   // 持っている人(プレイヤーか店員ゾンビ)の進行方向に直角な3マス
  const px = Math.floor(p.x), py = Math.floor(p.y), horiz = Math.abs(Math.cos(p.dir)) > Math.abs(Math.sin(p.dir));
  for (const j of G.jobs.filter(j => j.kind == 'spill')) {
    for (let d = -1; d <= 1; d++) j.dirty.delete((horiz ? py + d : py) * W + (horiz ? px : px + d));
    if (!j.dirty.size) done(j);
  }
}
function pickMop() { G.mop.st = 'held'; G.p.carry = { kind: 'mop' }; }
function leanMop(x, y) {
  const p = G.p, dx = p.x - x - 0.5, dy = p.y - y - 0.5, horiz = Math.abs(dx) > Math.abs(dy);
  G.mop = { st: 'lean', x, y, sx: horiz ? Math.sign(dx) : 0, sy: horiz ? 0 : Math.sign(dy) || 1, t: 0, told: false };
  p.carry = null; toast(isShelf(tile(x, y)) ? '棚にモップを立てかけた(放置すると苦情)' : 'モップを壁に立てかけた', '#aaa');
}
function mopHome() { G.mop = { st: 'lean', x: MOP_HOME.x, y: MOP_HOME.y, sx: 0, sy: 1, t: 0, told: false }; }
function updateMop(dt) {
  const m = G.mop; if (m.st != 'lean') return;
  const c = tile(m.x, m.y); if (!mopLeanable(c)) return mopHome();   // 立てかけた壁が開いた
  if (!isShelf(c)) { m.t = 0; return; }
  m.t += dt;
  if (m.t > MOP_SHELF_LIMIT && !m.told) { m.told = true; miss('モップが棚に立てかけっぱなし'); }
}

// ==================== 店長(レジ裏) ====================
const MGR_IDLE = ['sweep', 'yawn', 'look', 'reg', 'pace', 'wander', 'wander', 'wander', 'stretch', 'dance', 'nap', 'count', 'hop', 'spin', 'wipe', 'startle', 'hum'];
// 振る舞いごとの秒の範囲。セリフは出さない(動きだけで分かるように。動きは render3d.js の mgrAnim)
const MGR_ACT = {
  yawn: [3, 4], stretch: [3, 4], dance: [4, 6], nap: [4, 6], count: [3.5, 5], hop: [2.5, 3.5],
  spin: [2, 3], wipe: [3.5, 5], startle: [1.5, 2.2], hum: [3.5, 5], look: [3, 4.5], reg: [3, 4.5],
};
function updateManager(dt) {
  const m = G.mgr; m.sayT = Math.max(0, m.sayT - dt);
  // レジに向かう客(会計待ち・会計中)がいる間は、機械の前(MANAGER.y)に戻って接客する
  if (G.zs.some(z => z.kind != 'staff' && !z.dead && z.plan && z.plan[0] && z.plan[0].type == 'counter' && (z.state == 'walk' || z.state == 'browse'))) {
    m.act = 'reg'; m.actT = 1.5; m.wy = null; m.wpause = 0; m.spin0 = m.dir;
    const d = MANAGER.y - m.y;
    if (Math.abs(d) > 0.05) { m.y += Math.sign(d) * Math.min(Math.abs(d), dt * 1.8); m.dir = Math.PI / 2 * Math.sign(d); m.phase += dt * 6; }
    else { m.y = MANAGER.y; m.dir = 0; }
    return;
  }
  m.actT -= dt;
  if (m.actT <= 0) { m.act = pick(MGR_IDLE); m.actT = m.act == 'wander' ? rnd(7, 11) : rnd(2.5, 4.5); m.wy = null; m.spin0 = m.dir; const a = MGR_ACT[m.act]; if (a) { m.actT = rnd(a[0], a[1]); } }
  if (m.act == 'wander') {   // レジ裏のレーン(y 8.5〜12.5)を行ったり来たり。着いたら少し立ち止まって次の地点へ
    if (m.wy == null || Math.abs(m.wy - m.y) < 0.08) { if (m.wy != null && !m.wpause) m.wpause = rnd(0.5, 1.2); m.wpause = (m.wpause || 0) - dt; if (m.wpause <= 0 || m.wy == null) { m.wpause = 0; m.wy = rnd(8.5, 12.5); } }
    else { const s = Math.sign(m.wy - m.y); m.y += s * Math.min(Math.abs(m.wy - m.y), dt * 1.1); m.dir = Math.PI / 2 * s; m.phase += dt * 4; }
    return;
  }
  const goalY = m.act == 'pace' ? MANAGER.y + Math.sin(G.t * 1.6) * 0.38 : MANAGER.y;
  m.y += (goalY - m.y) * Math.min(1, dt * 4);
  if (m.act == 'spin') { m.dir += dt * 6; m.phase += dt * 4; return; }
  if (m.act == 'dance' || m.act == 'wipe') m.phase += dt * (m.act == 'dance' ? 5 : 8);
  m.dir = m.act == 'nap' || m.act == 'count' ? 0 : m.act == 'startle' ? 0.9 : m.act == 'wipe' ? Math.PI / 2 : m.act == 'look' ? Math.sin(G.t * 1.8) * 1.4 : m.act == 'reg' ? -0.4 : m.act == 'pace' ? Math.PI / 2 * Math.sign(Math.cos(G.t * 1.6) || 1) : Math.sin(G.t * 0.7) * 0.25;
  if (m.act == 'pace') m.phase += dt * 4;
}
