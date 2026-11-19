// sim: 状態Gとシフト進行・update・クレーム/終了の集計。作業は action.js。描画もDOMも触らない(結果画面は main.js の showResult)
// ==================== 状態 ====================
const VIEW_ANG = 0.62, VIEW_DIST = 5.5;
let G = null;           // 現在のシフトの状態
let mode = 'title';     // title / play / pause / result
const keys = {};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];

let cleared = 0;
try { cleared = +(localStorage.getItem('zconv_cleared') || 0); } catch (e) {}
if (new URLSearchParams(location.search).has('all')) cleared = SHIFTS.length;
let devMode = false;      // 開発者モード: 未解放のシフトも選べる
try { devMode = localStorage.getItem('zconv_dev') == '1'; } catch (e) {}

function newShift(idx) {
  const S = SHIFTS[idx];
  G = {
    idx, S, fresh: {}, gmin: 0, spawnT: 3, closed: !!S.half, jobs: [], dels: [], delT: 12, delDone: 0, returns: 0, jobT: 8, nightT: 10, jobsDone: 0, staffDone: 0, sales: 0, rating: 5,
    tut: TUT[idx] ? TUT[idx].slice() : null,
    mgr: { x: MANAGER.x, y: MANAGER.y, dir: 0, mode: 'idle', act: 'stand', actT: 2, path: [], phase: 0, say: '', sayT: 0, job: null },
    stock: [], ts: {}, preview: -1,
    hot: S.hot ? 3 : 0,
    fryer: { state: 'empty', t: 0 },   // empty / frying / done
    trash: S.trash ? 3 : 0,
    p: { x: 7.5, y: 2.5, dir: Math.PI / 2, carry: null, hold: 0 },
    mop: { st: 'lean', x: MOP_HOME.x, y: MOP_HOME.y, sx: 0, sy: 1, t: 0, told: false },   // st: lean(立てかけ) / held(手持ち)
    cartOut: false,                     // カートが倉庫の外に出ている
    drops: [],                          // 床に置いた持ち物
    zs: [], misses: 0, strikes: 0, stocked: 0, hotAdded: 0, trashOut: 0,
    toasts: [], flash: 0, rushSaid: false, t: 0,
  };
  dropsRef = G.drops;
  SECTIONS.forEach((_, i) => fillSec(i, secOn(i)));
  for (let y = 6; y <= 18; y++) set(SHUT_X, y, G.closed ? '#' : '.');
  set(ALLEY_DOOR.x, ALLEY_DOOR.y, G.closed ? '#' : 'd');
  if (S.alley) G.zs.push(makeZombie('alley', 20.5, 2.5));
}

const secOn = i => !G.closed || SECTIONS[i].tiles[0][0] < SHUT_X;   // 閉めた奥の棚は使わない
const emptyCount = () => G.stock.filter((v, i) => v == 0 && secOn(i)).length;
// 棚は1ブロックごとに在庫を持つ(G.ts)。G.stock[i] は商品(区画)ごとの合計
const secMax = i => SECTIONS[i].tiles.length * TILE_MAX;
const inCrate = c => Object.values(c.items).reduce((a, b) => a + b, 0);
function fillSec(i, rand) {
  let sum = 0;
  SECTIONS[i].tiles.forEach(([x, y]) => { const v = rand ? 1 + ((Math.random() * TILE_MAX) | 0) : TILE_MAX; G.ts[y * W + x] = v; sum += v; });
  G.stock[i] = sum;
}
const FRESH_SEC = 90;   // 補充してからこの間は、その棚に期限切れの任務を出さない
function tileAdd(i, k, d) {
  G.ts[k] += d; G.stock[i] += d;
  if (d > 0) G.fresh[i] = G.t;
  const drop = f => { for (const j of G.jobs.filter(j => j.sec === i && f(j))) G.jobs.splice(G.jobs.indexOf(j), 1); };
  if (G.stock[i] == 0) drop(j => j.kind == 'tidy' || j.kind == 'expire');   // 欠品の棚は乱れも期限もない
  else if (G.stock[i] >= secMax(i)) drop(j => j.kind == 'expire');          // 全部入れ替えたら期限切れは消える
}
// 客は、立っている正面のブロックから取る。そこが空なら、同じ商品で一番近い在庫のあるブロック
function takeBlock(i, spot) {
  const ks = SECTIONS[i].tiles.map(([x, y]) => ({ k: y * W + x, d: Math.abs(y - spot.fy) })).filter(o => G.ts[o.k] > 0);
  return ks.sort((a, b) => a.d - b.d)[0].k;
}

// 店員ゾンビはラッシュの間だけ出勤する。ラッシュが終わったら、追いかけていなければ帰る
function updateStaffShift(rushing) {
  const st = G.zs.find(z => z.kind == 'staff');
  if (rushing && !st) { G.zs.push(makeZombie('staff', 9.5, 2.5)); toast('店員ゾンビが出勤した…', '#7ab8ff'); }
  else if (!rushing && st && st.state != 'chase') { staffDropMop(); G.zs.splice(G.zs.indexOf(st), 1); toast('店員ゾンビが退勤した', '#7ab8ff'); }
}

function toast(msg, color = '#fff') { G.toasts.push({ msg, color, t: 3 }); }

// ==================== 更新 ====================
function update(dt) {
  const S = G.S, p = G.p;
  G.t += dt;
  G.gmin += dt * GMIN_PER_SEC;
  const hour = S.start + G.gmin / 60;
  if (G.gmin >= S.hours * 60) return endShift(false);
  const rushing = inRush(S, hour);
  if (rushing && !G.rushSaid) { G.rushSaid = true; toast(S.rushName + '！ お客が増える', '#ffcc55'); }
  if (S.staff) updateStaffShift(rushing);

  // --- プレイヤー移動 ---
  let mx = (kd('KeyD', 'ArrowRight') ? 1 : 0) - (kd('KeyA', 'ArrowLeft') ? 1 : 0);
  let my = (kd('KeyS', 'ArrowDown') ? 1 : 0) - (kd('KeyW', 'ArrowUp') ? 1 : 0);
  const b = botOn ? botStep(dt) : null;
  if (b) { mx = b.mx; my = b.my; }
  const moving = mx || my;
  if (moving) {
    const l = Math.hypot(mx, my); mx /= l; my /= l;
    p.dir = Math.atan2(my, mx);
    const sp = !p.carry ? SPEED.free : SPEED[p.carry.kind] || SPEED.other;
    moveCircle(p, mx * sp * dt, my * sp * dt, 0.3, playerWalk, (x, y) => G.zs.some(z => z.trait == 'giant' && Math.abs(x - z.x) < GIANT_SCALE / 2 + 0.3 && Math.abs(y - z.y) < 0.8));
  }

  // --- 作業 ---
  G.preview = -1;
  const act = currentAction();
  G.act = act;
  const held = b ? b.e : kd('KeyE', 'Space');
  if (!held) { p.n = 0; p.lock = false; }
  if (act && held && !moving && act.dur < INFO && !p.lock) {
    p.hold += dt;
    if (p.hold >= act.dur) {
      act.run(); p.hold = 0;
      if (!act.repeat && !b) keys.KeyE = keys.Space = false;
      else if (++p.n >= REFILL_PER_HOLD) p.lock = true;   // 手を離すまで次の補充は始まらない
    }
  } else p.hold = 0;

  // --- フライヤー ---
  if (G.fryer.state == 'frying') { G.fryer.t -= dt; if (G.fryer.t <= 0) { G.fryer.state = 'done'; toast('ホットスナックが揚がった', '#ffcc55'); } }

  // --- 客の来店 ---
  if (G.tut && G.tut.length) G.spawnT = Math.max(G.spawnT, 1);   // 研修のステップが残っている間はお客を入れない
  G.spawnT -= dt * GMIN_PER_SEC;
  const customers = G.zs.filter(z => z.kind == 'customer' && !z.trait).length;
  if (G.spawnT <= 0) {
    G.spawnT = S.spawn(hour) * rnd(0.6, 1.4);
    if (customers < S.maxZ(hour) && G.gmin < S.hours * 60 - 10) G.zs.push(makeZombie('customer', pick([12.5, 13.5]), 19.5));
  }

  // --- 夜の危険なゾンビ ---
  if (S.night && G.gmin < S.hours * 60 - 10) {
    G.nightT -= dt;
    if (G.nightT <= 0) {
      G.nightT = rnd(NIGHT_EVERY[0], NIGHT_EVERY[1]);
      if (G.zs.filter(z => z.trait).length < NIGHT_MAX) {
        const fresh = S.traits[S.traits.length - 1];   // このシフトで増えた種類は、最初に必ず1体出す
        const t = G.zs.some(z => z.trait == fresh) ? pick(S.traits) : fresh;
        G.zs.push(makeZombie('customer', pick([12.5, 13.5]), 19.5, t));
        toast('夜の客が来た… ' + {
          smell: '鼻が利くやつ', fast: '足の速いやつ', messy: '棚を荒らすやつ', giant: '横幅3マスの巨大なやつ',
          charge: '遠くまで見えて突進してくるやつ' }[t], TRAITS[t].color);
      }
    }
  }

  // --- 欠品が多いと売上・評価が減る / 作業・店長 / 全面開放 ---
  const over = emptyCount() - EMPTY_LIMIT;
  if (over > 0) { G.sales = Math.max(0, G.sales - SALES_LOSS * over * dt); G.rating = Math.max(1, G.rating - RATING_LOSS * over * dt); }
  if (p.carry && p.carry.kind == 'mop') rollMop();
  updateMop(dt); updateJobs(dt); updateDeliver(dt); updateManager(dt);
  if (G.closed && customers >= OPEN_AT) openShop();

  // --- ゾンビ ---
  const safe = inBackyard(Math.floor(p.x), Math.floor(p.y));
  for (const z of G.zs) updateZombie(z, dt, safe);
  G.zs = G.zs.filter(z => !z.dead);

  G.flash = Math.max(0, G.flash - dt);
  G.toasts.forEach(t => t.t -= dt);
  G.toasts = G.toasts.filter(t => t.t > 0);
}

function addTrash() {
  if (G.trash >= TRASH_MAX) miss('ゴミ箱があふれている');
  else G.trash++;
}
function miss(msg) {
  G.misses++; G.rating = Math.max(1, G.rating - 0.15); toast('クレーム：' + msg, '#ff9966');
  if (!G.claimTold) { G.claimTold = true; toast('クレームが ' + G.S.missMax + ' を超えるとシフト不合格。欠品を作らないこと', '#ffcc55'); }
}

function caught(z) {
  G.strikes++; G.flash = 0.8;
  toast(G.strikes >= 3 ? '噛まれた…' : '捕まった！ なんとか振りほどいてバックヤードへ', '#ff4444');
  const st = G.zs.find(q => q.kind == 'staff');
  const home = st ? RESPAWN.reduce((a, b) => Math.hypot(b.x - st.x, b.y - st.y) > Math.hypot(a.x - st.x, a.y - st.y) ? b : a) : RESPAWN[0];
  G.p.x = home.x; G.p.y = home.y; if (G.p.carry && G.p.carry.kind == 'delivery') G.dels.push({ x: 18.5, y: 2.5, t: 0, bad: G.p.carry.bad });
  if (G.p.carry && G.p.carry.kind == 'mop') mopHome();
  G.p.carry = null; G.p.hold = 0;
  z.state = 'giveup'; z.wait = 2; z.sus = 0; z.path = [];
  if (G.strikes >= 3) endShift(true);
}

function endShift(fail) {
  mode = 'result';
  const S = G.S, pass = !fail && G.misses <= S.missMax;
  if (pass && G.idx + 1 > cleared) { cleared = G.idx + 1; try { localStorage.setItem('zconv_cleared', cleared); } catch (e) {} }
  const rows = [
    ['売上 / 評価', '¥' + Math.round(G.sales) + ' / ★' + G.rating.toFixed(1)],
    ['棚の補充', G.stocked + ' 個'],
    (S.tidy || S.expire || S.spill || S.toilet) ? ['整頓・撤去・清掃', G.jobsDone + ' 回'] : null,
    S.deliver ? [S.inspect ? '納品・検品' : '納品', G.delDone + ' 回' + (S.inspect ? '(返品 ' + G.returns + ')' : '')] : null,
    S.staff ? ['店員ゾンビの仕事', G.staffDone + ' 回'] : null,
    S.hot ? ['ホットスナック補充', G.hotAdded + ' 回'] : null,
    S.trash ? ['ゴミ捨て', G.trashOut + ' 回'] : null,
    ['クレーム', G.misses + ' / ' + S.missMax + ' まで'],
    ['見つかって捕まった', G.strikes + ' / 3'],
  ].filter(Boolean).map(r => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('');
  const head = fail ? '早退… (3回捕まった)' : pass ? 'シフト合格！' : 'シフト終了… クレームが多すぎた';
  const next = pass && G.idx + 1 < SHIFTS.length ? `<div style="margin-top:10px;color:#b7e08a">次のシフト「${SHIFTS[G.idx + 1].name}」を任されるようになった。</div>` : '';
  showResult({ S, head, rows, next, pass });
}
