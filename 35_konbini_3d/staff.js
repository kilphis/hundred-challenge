// staff: 店員ゾンビの仕事。動きはCPU(bot.js)と同じ「目的地まで歩く → その場で作業する」の繰り返し。
// 道具はカートを使わず、作業が終わった時に効果だけ状態Gへ直接かける。床はモップを持って歩いて拭く。
// 追跡・視認は zombie.js の updateZombie に任せる。描画しない
const staffWalk = (x, y) => playerWalk(x, y);
const staffTileCache = {};
function staffTile(ch) {
  if (!staffTileCache[ch]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] == ch && !staffTileCache[ch]) staffTileCache[ch] = { x, y };
  return staffTileCache[ch];
}
const staffDist = (z, x, y) => Math.hypot(x - z.x, y - z.y);
const staffSpot = (sec, k) => SECTIONS[sec].spots.find(s => s.fy * W + s.fx == k);   // 棚ブロック k の前に立てる位置

function staffFinishJob(j) { const i = G.jobs.indexOf(j); if (i >= 0) G.jobs.splice(i, 1); }
function staffDropMop() { if (G.mop.st == 'staff') mopHome(); }   // 途中で投げ出したらモップは定位置へ戻る

// 床: 次に拭く汚れ(いちばん近い)へモップをかけながら歩く。汚れが無くなったらモップを戻しに行く
function staffNextSweep(z, j) {
  const steps = z.task.steps;
  if (G.jobs.includes(j) && j.dirty.size) {
    let best = null, bd = 1e9;
    for (const v of j.dirty.values()) { const d = staffDist(z, v.x, v.y); if (d < bd) { bd = d; best = v; } }
    steps.push({ pos: best, work: 0, sweep: true, text: '床を拭く', ok: () => G.mop.st == 'staff', run: z => staffNextSweep(z, j) });
  } else steps.push({ tile: { x: MOP_HOME.x, y: MOP_HOME.y }, work: STAFF.work.mop, text: 'モップを戻す', run: () => mopHome() });
}

// 仕事の候補。ステップ列を返す(無ければ null)。ステップ = { tile | pos, work(秒), text, ok(まだ有効か), run(z)(終わった時の効果) }
// tile = そのタイルの隣で作業 / pos = その位置で作業(face = 向く先のタイル) / sweep = 歩きながらモップをかける
const STAFF_TASKS = {
  trash: z => {
    if (!G.S.trash || G.trash <= 0) return null;
    return [{ tile: staffTile('T'), work: STAFF.work.trash, text: 'ゴミをまとめる', ok: () => G.trash > 0, run: () => { G.trash = 0; } },
            { tile: staffTile('D'), work: STAFF.work.bin, text: 'ゴミを捨てる', run: () => { G.trashOut++; } }];
  },
  hot: z => {
    if (!G.S.hot) return null;
    const f = G.fryer;
    if (f.state == 'done') return [
      { tile: staffTile('R'), work: STAFF.work.fry, text: '揚げあがりを取る', ok: () => G.fryer.state == 'done', run: () => { G.fryer = { state: 'empty', t: 0 }; } },
      { tile: staffTile('H'), work: STAFF.work.fry, text: 'ホットケースに並べる', run: () => { G.hot = Math.min(HOT_MAX, G.hot + HOT_ADD); G.hotAdded++; } }];
    if (f.state == 'empty' && G.hot <= HOT_MAX - HOT_ADD) return [
      { tile: staffTile('F'), work: STAFF.work.fry, text: '冷凍を取る' },
      { tile: staffTile('R'), work: STAFF.work.fry, text: 'フライヤーに入れる', ok: () => G.fryer.state == 'empty', run: () => { G.fryer = { state: 'frying', t: FRY_TIME };
        } }];
    return null;
  },
  toilet: z => {
    const j = G.jobs.find(j => j.kind == 'toilet'); if (!j) return null;
    return [{ tile: staffTile('W'), work: STAFF.work.toilet, text: 'トイレを掃除', ok: () => G.jobs.includes(j), run: () => staffFinishJob(j) }];
  },
  tidy: z => {   // 整頓と期限切れ撤去。いちばん近い棚から
    const js = G.jobs.filter(j => j.sec !== undefined && SECTIONS[j.sec].spots.length);
    if (!js.length) return null;
    const near = j => Math.min(...SECTIONS[j.sec].spots.map(s => staffDist(z, s.x + 0.5, s.y + 0.5)));
    const j = js.sort((a, b) => near(a) - near(b))[0], s = SECTIONS[j.sec].spots.sort((a, b) => staffDist(z, a.x + 0.5, a.y + 0.5) - staffDist(z, b.x + 0.5, b.y + 0.5))[0];
    return [{ pos: { x: s.x + 0.5, y: s.y + 0.5 }, face: { x: s.fx + 0.5, y: s.fy + 0.5 }, work: STAFF.work.tidy, text: j.kind == 'tidy' ? '棚を整える' : '期限切れを撤去',
              ok: () => G.jobs.includes(j), run: () => staffFinishJob(j) }];
  },
  spill: z => {   // 壁のモップを持ち、汚れを順に拭き、モップを戻す
    const j = G.jobs.find(j => j.kind == 'spill'); if (!j || !j.dirty.size || G.mop.st != 'lean') return null;
    return [{ tile: { x: G.mop.x, y: G.mop.y }, work: STAFF.work.mop, text: 'モップを取る', ok: () => G.mop.st == 'lean' && G.jobs.includes(j),
              run: z => { G.mop.st = 'staff'; staffNextSweep(z, j); } }];
  },
  refill: z => {   // 「ほぼ満タンの棚」を足す(欠品の棚は後回し)。バックヤードで持ってから、空いたブロックへ1個ずつ
    const full = i => G.stock[i] / secMax(i);
    const ids = SECTIONS.map((_, i) => i).filter(i => secOn(i) && G.stock[i] < secMax(i) && SECTIONS[i].spots.length && full(i) >= STAFF.refillMin);
    if (!ids.length) return null;
    const i = ids.sort((a, b) => full(b) - full(a))[0], n = Math.min(STAFF.carry, secMax(i) - G.stock[i]);
    const ts = {}; SECTIONS[i].tiles.forEach(([x, y]) => { ts[y * W + x] = G.ts[y * W + x]; });
    const steps = [{ tile: { x: BACK_POS[i][0], y: BACK_POS[i][1] }, work: STAFF.work.take, text: SECTIONS[i].name + 'を持つ' }];
    for (let c = 0; c < n; c++) {
      const k = Object.keys(ts).map(Number).filter(k => ts[k] < TILE_MAX && staffSpot(i, k)).sort((a, b) => ts[a] - ts[b])[0];
      if (k === undefined) break;
      ts[k]++; const s = staffSpot(i, k);
      steps.push({ pos: { x: s.x + 0.5, y: s.y + 0.5 }, face: { x: s.fx + 0.5, y: s.fy + 0.5 }, work: STAFF.work.refill, text: SECTIONS[i].name + 'を補充',
                   ok: () => G.ts[k] < TILE_MAX, run: () => tileAdd(i, k, 1) });
    }
    return steps.length > 1 ? steps : null;
  },
};

// 開始直後は、同じバックヤードにいるプレイヤーに気づかずぼーっとする(危ないので)
function initStaff(z) {
  Object.assign(z, { speed: STAFF.speed, shirt: STAFF.shirt, skin: STAFF.skin, task: null, say: 'ぼーっとしている', skip: {}, daze: STAFF.startDaze, base: z.dir });
  z.state = 'wait'; z.wait = 0;
}
function staffDazed(z, dt) {
  if (!(z.daze > 0)) return false;
  z.daze -= dt; z.dir = z.base + Math.sin(z.t * 0.8 + z.wobble) * 0.9;
  if (z.daze <= 0) z.say = '';
  return true;
}
// 追跡をあきらめた・捕まえたあと: 仕事を投げ出して、すぐ次の仕事を探す
function staffReset(z) { staffDropMop(); z.task = null; z.say = ''; staffPick(z); }
function staffWait(z, t) { z.state = 'wait'; z.wait = t; z.path = []; z.base = z.dir; }

function staffPick(z) {
  for (const kind of STAFF.order) {
    if ((z.skip[kind] || 0) > G.t) continue;
    const steps = STAFF_TASKS[kind](z);
    if (!steps) continue;
    z.task = { kind, steps, i: 0 };
    if (staffGo(z)) return;
  }
  z.say = ''; staffWait(z, rnd(...STAFF.noWork));   // 仕事が無い
}
// 現在のステップの場所まで歩き始める。道が無ければこの種類の仕事はしばらく諦める
function staffGo(z) {
  const t = z.task, st = t.steps[t.i];
  const isGoal = st.tile ? (x, y) => Math.abs(x - st.tile.x) + Math.abs(y - st.tile.y) == 1 : (x, y) => x == Math.floor(st.pos.x) && y == Math.floor(st.pos.y);
  const path = bfs(Math.floor(z.x), Math.floor(z.y), isGoal, staffWalk);
  if (!path) { z.skip[t.kind] = G.t + STAFF.skip; z.task = null; staffDropMop(); return false; }
  z.path = path; z.state = 'walk'; z.say = st.text; return true;
}
function staffEndTask(z, done) {
  if (done) G.staffDone++;
  staffDropMop(); z.task = null; z.say = '';
  staffPick(z);   // 合間のぼーっとはしない。すぐ次へ
}

function updateStaff(z, dt) {
  if (z.state == 'wait') {
    z.wait -= dt; z.dir = z.base + Math.sin(z.t * 0.8 + z.wobble) * 0.9;
    if (z.wait <= 0) staffPick(z);
    return;
  }
  const t = z.task; if (!t) return staffWait(z, 1);
  const st = t.steps[t.i];
  if (z.state == 'walk') {
    if (st.sweep) rollMop(z, staffFinishJob);
    if (!followPath(z, z.speed, dt)) return;
    const f = st.face || st.tile || st.pos;
    z.base = Math.atan2(f.y + (st.tile ? 0.5 : 0) - z.y, f.x + (st.tile ? 0.5 : 0) - z.x);
    z.state = 'browse'; z.wait = st.work * rnd(0.9, 1.3);
    return;
  }
  // 作業中(browse)
  z.wait -= dt; turnTo(z, z.base, 6, dt);
  if (z.wait > 0) return;
  if (st.ok && !st.ok()) return staffEndTask(z, false);   // 歩いている間にプレイヤーが片付けた
  if (st.run) st.run(z);
  if (++t.i < t.steps.length) { if (!staffGo(z)) staffWait(z, STAFF.noWork[0]); }   // 次の場所へ道が無い(staffGo が task を捨てる)
  else staffEndTask(z, true);
}
