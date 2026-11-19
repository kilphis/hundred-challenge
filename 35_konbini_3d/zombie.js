// zombie: ゾンビの生成・目的地・視界・移動・行動(updateZombie)。描画しない
function makeZombie(kind, x, y, trait) {
  const shirts = ['#7a4b8c', '#8c4b4b', '#4b6a8c', '#8c7a4b', '#4b8c6a', '#666'];
  const z = { kind, x, y, dir: -Math.PI / 2, speed: rnd(1.0, 1.35), state: 'walk', path: [], sus: 0,
    shirt: pick(shirts), skin: pick(['#7fa36a', '#8fae78', '#6f9460']), plan: [], wait: 0, base: 0, t: Math.random() * 10,
    trait, sc: 1, vd: trait && TRAITS[trait].vd || VIEW_DIST, va: trait && TRAITS[trait].va || VIEW_ANG, lastSeen: null, lostT: 0, repath: 0, buyHot: false, wobble: Math.random() * 6 };
  if (kind == 'customer') {
    const n = 1 + ((Math.random() * 3) | 0);
    const secs = SECTIONS.map((_, i) => i).filter(secOn).sort(() => Math.random() - 0.5).slice(0, n);
    if (trait == 'messy') secs.length = 0, secs.push(...SECTIONS.map((_, i) => i).filter(secOn).sort(() => Math.random() - 0.5).slice(0, 5));
    z.persona = trait ? 'normal' : wpick();
    const P = PERSONAS[z.persona];
    if (!trait) { z.speed *= P.sp; secs.length = Math.min(secs.length, irnd(...P.shelves)); }
    secs.forEach(i => z.plan.push({ type: 'shelf', sec: i }));
    for (let n = irnd(...P.roam); n > 0 && !trait; n--) { const s = roamSpot(); if (s) z.plan.splice((Math.random() * (z.plan.length + 1)) | 0, 0, { type: 'roam', spot: s }); }
    if (trait) { Object.assign(z, { skin: TRAITS[trait].skin, shirt: TRAITS[trait].shirt });
      if (trait == 'fast') z.speed = rnd(1.8, 2.2);
      if (trait == 'giant') { z.sc = GIANT_SCALE; z.speed = rnd(...GIANT_SPEED); } }
    z.buyHot = !trait && G.S.hot && Math.random() < 0.55;
    z.plan.push({ type: 'counter' });
    z.plan.push({ type: 'exit' });
    nextGoal(z);
  } else {
    z.state = 'wait'; z.wait = 1;
    if (kind == 'staff') initStaff(z);
  }
  return z;
}

const wk = z => z.trait == 'giant' ? bigWalk : z.kind == 'staff' ? staffWalk : storeWalk;
// 巨大は棚の前まで入れないので、目的のマスから2マス以内に着けば良い
const reach = (z, gx, gy) => (x, y) => z.trait == 'giant' ? Math.max(Math.abs(x - gx), Math.abs(y - gy)) <= 2 : x == gx && y == gy;
// 性格の抽選と、ぶらぶらの寄り道先(空いている床のマス)
function wpick() { const f = typeof Q != 'undefined' && Q.get('persona'); if (f && PERSONAS[f]) return f;
  const ks = Object.keys(PERSONAS).filter(k => k == 'normal' || G.S.personas.includes(k));   // このシフトで解放済みの性格だけ
  let r = Math.random() * ks.reduce((a, k) => a + PERSONAS[k].w, 0); for (const k of ks) if ((r -= PERSONAS[k].w) < 0) return k; return 'normal'; }
function irnd(a, b) { return a + ((Math.random() * (b - a + 1)) | 0); }
function roamSpot() {
  for (let n = 0; n < 40; n++) {
    const x = irnd(1, W - 2), y = irnd(1, H - 3);
    if (storeWalk(x, y) && tile(x, y) == '.') { const a = Math.random() * 6.28; return { x, y, fx: x + Math.cos(a) * 2, fy: y + Math.sin(a) * 2 }; }
  }
  return null;
}
function nextGoal(z) {
  if (z.kind == 'staff') return staffReset(z);
  const tx = Math.floor(z.x), ty = Math.floor(z.y);
  if (z.kind == 'alley') {
    z.path = bfs(tx, ty, (x, y) => x == z.goal.x && y == z.goal.y, alleyWalk) || [];
    z.state = 'walk'; return;
  }
  const g = z.plan[0];
  if (!g) { z.dead = true; return; }
  if (g.type == 'roam') {
    z.path = bfs(tx, ty, (x, y) => x == g.spot.x && y == g.spot.y, wk(z)) || [];
  } else if (g.type == 'shelf') {
    if (!g.spot) g.spot = pick(SECTIONS[g.sec].spots);
    z.path = bfs(tx, ty, reach(z, g.spot.x, g.spot.y), wk(z)) || [];
  } else if (g.type == 'counter') {
    if (!g.spot) g.spot = { x: 3, y: z.buyHot ? 11 : pick([9, 10, 12, 13]), fx: 2, fy: 0 };
    g.spot.fy = g.spot.y;
    z.path = bfs(tx, ty, reach(z, g.spot.x, g.spot.y), wk(z)) || [];
  } else if (g.type == 'exit') {
    z.path = bfs(tx, ty, (x, y) => tile(x, y) == 'E', wk(z)) || [];
  }
  z.state = 'walk';
}

function moveCircle(o, dx, dy, r, pass, hit) {
  const blocked = (x, y) => {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (!pass(Math.floor(x + ox), Math.floor(y + oy))) return true;
    return false;
  };
  const free = (x, y) => !blocked(x, y) && !(hit && hit(x, y) && !hit(o.x, o.y));
  if (free(o.x + dx, o.y)) o.x += dx;
  if (free(o.x, o.y + dy)) o.y += dy;
}

function canSee(z) {
  const VIEW_DIST = z.vd, VIEW_ANG = z.va;
  const p = G.p, dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy);
  if (d > VIEW_DIST) return 0;
  let da = Math.atan2(dy, dx) - z.dir;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  const close = d < 1.1;                   // すぐ横にいたら気配でバレる
  if (!close && Math.abs(da) > VIEW_ANG) return 0;
  if (!los(z.x, z.y, p.x, p.y)) return 0;
  return close ? 2.5 : 0.9 + (VIEW_DIST - d) * 0.45;
}

function turnTo(z, a, rate, dt) {
  let da = a - z.dir; da = Math.atan2(Math.sin(da), Math.cos(da));
  z.dir += Math.max(-rate * dt, Math.min(rate * dt, da));
}

function followPath(z, sp, dt) {
  if (!z.path.length) return true;
  const n = z.path[0], tx = n.x + 0.5, ty = n.y + 0.5;
  const dx = tx - z.x, dy = ty - z.y, d = Math.hypot(dx, dy);
  turnTo(z, Math.atan2(dy, dx), 6, dt);
  if (d <= sp * dt) { z.x = tx; z.y = ty; z.path.shift(); }
  else { z.x += dx / d * sp * dt; z.y += dy / d * sp * dt; }
  return !z.path.length;
}

function updateZombie(z, dt, safe) {
  const p = G.p;
  z.t += dt;
  if (z.kind == 'staff') { safe = false; if (staffDazed(z, dt)) return; }   // バックヤードに逃げても店員ゾンビには関係ない
  const pass = z.kind == 'alley' ? alleyWalk : wk(z);
  const playerReachable = pass(Math.floor(p.x), Math.floor(p.y));

  // 視認
  const seen = (!safe && z.state != 'giveup') ? canSee(z) : 0;
  // 匂い: 棚越しでも距離だけで気づく。視界より遅く、じわじわ
  const smell = (z.trait == 'smell' && !safe && z.state != 'giveup') ? Math.max(0, 1 - Math.hypot(p.x - z.x, p.y - z.y) / SMELL_DIST) : 0;
  z.smell = smell;
  if (z.state != 'chase') {
    if (smell && !seen) z.sus = Math.min(1, z.sus + smell * SMELL_RATE * dt);
    else if (seen) z.sus = Math.min(1, z.sus + seen * 0.55 * dt);
    else z.sus = Math.max(0, z.sus - 0.35 * dt);
    if (z.sus >= 1 && playerReachable) {
      z.state = 'chase'; z.lastSeen = { x: p.x, y: p.y }; z.lostT = 0; z.repath = 0; z.rushed = false;
      toast(z.kind == 'staff' ? '店員ゾンビに見つかった！ バックヤードでも安全じゃない' : '見つかった！ バックヤードへ逃げろ', '#ff6655');
    }
  }

  if (z.state == 'chase') {
    if (safe || !playerReachable) {             // バックヤードに逃げ込まれた → 諦める
      z.state = 'giveup'; z.wait = 1.5; z.sus = 0; z.path = []; return;
    }
    if (z.trait == 'charge') { z.lostT = 0; z.cT = (z.cT || 0) + dt; }
    else if (seen || smell > 0.1) { z.lastSeen = { x: p.x, y: p.y }; z.lostT = 0; } else z.lostT += dt;
    const cs = z.kind == 'staff' ? STAFF.chase : z.trait == 'fast' ? FAST_CHASE : z.trait == 'charge' ? CHARGE_SPEED : z.trait == 'giant' ? GIANT_CHASE : 2.6;
    if (z.lostT > 3) { z.state = 'giveup'; z.wait = 1.2; z.sus = 0.4; z.path = []; return; }
    z.repath -= dt;
    if (z.trait == 'charge' && !z.path.length && !z.rushed) { z.rushed = true;
      z.path = bfs(Math.floor(z.x), Math.floor(z.y), (x, y) => x == Math.floor(z.lastSeen.x) && y == Math.floor(z.lastSeen.y), pass) || [];
      }
    if (z.trait != 'charge' && z.repath <= 0) {
      z.repath = 0.25;
      const gx = Math.floor(z.lastSeen.x), gy = Math.floor(z.lastSeen.y);
      z.path = bfs(Math.floor(z.x), Math.floor(z.y), reach(z, gx, gy), pass) || [];
    }
    if (!z.path.length && z.trait != 'giant') {
      const dx = z.lastSeen.x - z.x, dy = z.lastSeen.y - z.y, d = Math.hypot(dx, dy);
      if (d > 0.05) { z.x += dx / d * cs * dt; z.y += dy / d * cs * dt; turnTo(z, Math.atan2(dy, dx), 8, dt); }
    } else followPath(z, cs, dt);
    if (Math.hypot(p.x - z.x, p.y - z.y) < (z.trait == 'giant' ? GIANT_CATCH : 0.6)) caught(z);
    if (z.trait == 'charge' && !z.path.length && z.rushed && (z.cT > 6 || Math.hypot(z.lastSeen.x - z.x, z.lastSeen.y - z.y) < 0.2)) { z.state = 'giveup';
      z.wait = CHARGE_STUN;
      z.sus = 0;
      z.rushed = false;
      z.cT = 0;
      toast('猪突が空振りした', '#e05cff');
      }
    return;
  }

  if (z.state == 'giveup') {
    z.wait -= dt; z.dir += Math.sin(z.t * 3) * dt * 2;
    if (z.wait <= 0) { if (z.kind == 'alley') { z.state = 'wait'; z.wait = 0.5; } else nextGoal(z); }
    return;
  }

  // 怪しんでいる間は立ち止まってこちらを向く
  if (z.sus > 0.3 && (seen || smell)) { turnTo(z, Math.atan2(p.y - z.y, p.x - z.x), 3, dt); return; }

  if (z.kind == 'alley') {
    if (z.state == 'wait') {
      z.wait -= dt; z.dir = z.base + Math.sin(z.t * 0.9) * 1.2;
      if (z.wait <= 0) {
        let gx, gy; do { gx = (16 + Math.random() * 9) | 0; gy = (1 + Math.random() * 3) | 0; } while (!alleyWalk(gx, gy));
        z.goal = { x: gx, y: gy }; nextGoal(z);
      }
    } else if (followPath(z, z.speed * 0.8, dt)) { z.state = 'wait'; z.wait = rnd(2, 5); z.base = z.dir; }
    return;
  }

  if (z.kind == 'staff') return updateStaff(z, dt);

  // 客
  if (z.state == 'walk') {
    if (followPath(z, z.speed, dt)) {
      const g = z.plan[0];
      if (g.type == 'exit') { z.dead = true; if (G.S.trash && Math.random() < 0.5) addTrash(); return; }
      z.state = 'browse'; z.wait = (g.type == 'shelf' ? rnd(2.0, 3.5) : g.type == 'roam' ? rnd(1.5, 3.5) : rnd(1.5, 2.5)) * (z.trait ? 1 : PERSONAS[z.persona].browse);
      z.base = Math.atan2(g.spot.fy + 0.5 - z.y, g.spot.fx + 0.5 - z.x);
    }
  } else if (z.state == 'browse') {
    z.wait -= dt;
    z.dir = z.base + Math.sin(z.t * 1.3 + z.wobble) * 1.1;   // 棚の前でキョロキョロ
    if (z.wait <= 0) {
      const g = z.plan.shift();
      if (g.type == 'shelf' && z.trait == 'messy') {
        const s = SECTIONS[g.sec];
        for (let n = 0; n < MESSY_STOCK_LOSS; n++) {
          const ks = s.tiles.map(([x, y]) => y * W + x).filter(k => G.ts[k] > 0);
          if (ks.length) tileAdd(g.sec, pick(ks), -1);
        }
        if (!G.jobs.some(j => j.sec === g.sec)) G.jobs.push({ kind: 'tidy', sec: g.sec, t: 0 });
        if (Math.random() < MESSY_SPILL) addSpillTile(z.x, z.y);
        toast(s.name + 'の棚が荒らされた', '#ffb030');
      } else if (g.type == 'shelf') {
        if (G.stock[g.sec] > 0) {
          tileAdd(g.sec, takeBlock(g.sec, g.spot), -1); G.sales += PRICE;
          if (z.persona == 'rough' && Math.random() < ROUGH_DROP) {   // 雑: 取るついでに1個落として棚を乱す
            const ks = SECTIONS[g.sec].tiles.map(([x, y]) => y * W + x).filter(k => G.ts[k] > 0);
            if (ks.length) tileAdd(g.sec, pick(ks), -1);
            if (!G.jobs.some(j => j.sec === g.sec)) G.jobs.push({ kind: 'tidy', sec: g.sec, t: 0 });
            if (Math.random() < ROUGH_SPILL) addSpillTile(z.x, z.y);
            toast(SECTIONS[g.sec].name + 'の商品を雑に扱う客がいた', PERSONAS.rough.color);
          }
        }
        else miss(SECTIONS[g.sec].name + 'が欠品');
        const ex = G.jobs.find(j => j.kind == 'expire' && j.sec == g.sec);
        if (ex) { G.jobs.splice(G.jobs.indexOf(ex), 1); miss('期限切れ商品を売ってしまった'); }
        else if (Math.random() < CLAIM_PER_EMPTY * (emptyCount() - 1)) miss('棚がスカスカで客が不満');
      } else if (g.type == 'counter' && z.buyHot) {
        if (G.hot > 0) G.hot--;
        else miss('ホットスナックが切れている');
      }
      nextGoal(z);
    }
  }
}

