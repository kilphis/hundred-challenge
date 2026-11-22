// 動き・操作・カメラ・HUD。見た目は world.js、数値は defs.js。
const Q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const $ = id => document.getElementById(id);
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'Space' && S.mode === 'ready') start();
  if (e.code === 'KeyR' && (S.mode === 'dead' || S.mode === 'goal')) reset(true);
});
addEventListener('keyup', e => { keys[e.code] = false; });
const down = (...c) => c.some(k => keys[k]);

let S;
function best() { try { return +localStorage.getItem('raft_best') || 0; } catch (e) { return 0; } }
function reset(go) {
  S = { mode: 'ready', s: +Q.get('s') || 0, d: +Q.get('d') || 0, vs: D.FLOW_BASE, vd: 0, yaw: 0, kick: 0,
        hp: D.HP, inv: 0, t: 0, time: 0, hit: 0, stroke: 0, camS: 0, camD: 0, clock: 0 };
  S.camS = S.s - 12; S.camD = S.d * 0.6;
  $('title').style.display = 'flex'; $('result').style.display = 'none';
  if (go) start();
}
function start() { S.mode = 'run'; $('title').style.display = 'none'; }

function paddling() { return down('ArrowUp', 'KeyW'); }

function step(dt) {
  S.clock += dt;
  const running = S.mode === 'run';
  const hw = D.halfW(S.s);
  const u = D.flow(S.s) * (1 - 0.45 * Math.pow(S.d / hw, 2));       // 中央ほど速い
  const fwd = running && down('ArrowUp', 'KeyW'), back = running && down('ArrowDown', 'KeyS');
  const steer = running ? (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0) : 0;

  let target = u + (fwd ? D.PADDLE_FWD : 0) - (back ? D.PADDLE_BACK : 0);
  if (S.mode === 'goal') target = 0;
  S.vs += (target - S.vs) * Math.min(1, dt * (S.mode === 'goal' ? 0.8 : 1.6));
  S.vd += steer * D.STEER_ACC * dt;
  S.vd -= S.vd * D.SIDE_DRAG * dt;
  S.vd -= D.ddcx(S.s) * S.vs * S.vs * 1.5 * dt;                      // カーブで外側へ流される
  S.s += S.vs * dt; S.d += S.vd * dt;

  // 岸
  const lim = D.halfW(S.s) - D.RAFT_R * 0.8;
  if (Math.abs(S.d) > lim) {
    const sg = Math.sign(S.d); S.d = sg * lim;
    if (S.vd * sg > 0) S.vd = -S.vd * 0.25;
    S.vs *= 1 - 0.9 * dt;
  }
  // 岩
  S.inv = Math.max(0, S.inv - dt); S.hit = Math.max(0, S.hit - dt);
  if (running) for (const r of D.rocks) {
    if (Math.abs(r.s - S.s) > 6) continue;
    const dx = S.s - r.s, dy = S.d - r.d, dist = Math.hypot(dx, dy) || 0.01, min = r.r + D.RAFT_R * 0.85;
    if (dist >= min) continue;
    const nx = dx / dist, ny = dy / dist;
    S.s = r.s + nx * min; S.d = r.d + ny * min;
    const vn = S.vs * nx + S.vd * ny;
    if (vn < 0) { S.vs -= 1.5 * vn * nx; S.vd -= 1.5 * vn * ny; }
    if (S.inv <= 0) {
      S.hp--; S.inv = D.INVULN; S.hit = 0.5; S.vs *= 0.4; S.kick = (ny >= 0 ? 1 : -1) * 2.5;
      if (S.hp <= 0) { S.mode = 'dead'; showResult('筏がバラバラになった', 'R でやり直し'); }
    }
  }
  if (running) { S.time += dt; if (S.s >= D.LENGTH) goal(); }
  if (S.mode === 'goal' && S.s > D.LENGTH + 50) S.s = D.LENGTH + 50;
  S.d = Math.max(-D.halfW(S.s) + 1.2, Math.min(D.halfW(S.s) - 1.2, S.d));
  S.stroke += dt * ((fwd ? 5 : 0) + Math.abs(steer) * 4);
}

function goal() {
  S.mode = 'goal';
  const b = best(); const rec = !b || S.time < b;
  if (rec) { try { localStorage.setItem('raft_best', S.time.toFixed(2)); } catch (e) {} }
  showResult('ゴール！ ' + S.time.toFixed(1) + ' 秒', (rec ? '自己ベスト更新　' : 'ベスト ' + b.toFixed(1) + ' 秒　') + '残りの筏 ' + S.hp + '/' + D.HP + '　R でもう一度');
}
function showResult(a, b) { $('result').style.display = 'flex'; $('rt').textContent = a; $('rs').textContent = b; }

const wp = {};
function render() {
  // 筏
  D.frame(S.s, S.d, wp);
  const rap = D.rapidness(S.s), t = S.clock;
  S.kick -= S.kick * Math.min(1, 3 * 0.016);
  const yawT = -Math.atan2(S.vd, Math.max(S.vs, 1)) * 0.9;
  S.yaw += (yawT - S.yaw) * 0.12;
  raft.position.set(wp.x, 0.1 + Math.sin(t * 2 + S.s * 0.2) * (0.04 + rap * 0.1), wp.z);
  raft.rotation.set(Math.sin(t * 1.7 + S.s * 0.3) * (0.02 + rap * 0.05), wp.heading + S.yaw + S.kick * 0.15, Math.sin(t * 1.3) * (0.03 + rap * 0.07), 'YXZ');
  raft.visible = !(S.inv > 0 && S.mode === 'run' && Math.floor(S.clock * 14) % 2 === 0);
  paddle.rotation.set(Math.sin(S.stroke * 2) * 0.7, 0, 0.15);

  // カメラ: 川座標で追う。筏の揺れ・向きには影響されない
  const k = 1 - Math.pow(0.001, S.clockDt * 0.5);
  S.camS += (S.s - 14 - S.camS) * k;
  S.camD += (S.d * 0.6 - S.camD) * k;
  const cp = {}, lk = {};
  D.frame(S.camS, S.camD, cp);
  D.frame(S.camS + 17, S.camD * 0.8 + (S.d - S.camD) * 0.25, lk);
  camera.position.set(cp.x, 8, cp.z);
  camera.lookAt(lk.x, 0.5, lk.z);
  camera.fov = 60 + (S.vs - 5) * 0.8; camera.updateProjectionMatrix();

  waterTex.offset.y -= S.clockDt * D.flow(S.s) / 24;
  waterTex.offset.y %= 1;
  for (const f of foams) { const r = f.userData.r, p = 1 + Math.sin(t * 3 + r.seed * 9) * 0.06; f.scale.set(p, p, p); }

  // HUD
  const hp = D.HP;
  $('hp').innerHTML = '筏 ' + '■'.repeat(S.hp) + '<span style="opacity:.25">' + '■'.repeat(hp - S.hp) + '</span>';
  $('time').textContent = S.time.toFixed(1) + ' 秒';
  $('bar').style.width = Math.min(100, S.s / D.LENGTH * 100) + '%';
  $('dist').textContent = Math.max(0, Math.round(D.LENGTH - S.s)) + ' m';
  $('flash').style.opacity = S.hit > 0 ? S.hit : 0;
  renderer.render(scene, camera);
}

reset(false);
if (Q.get('go')) start();
let last = performance.now();
function loop(now) {
  const dt = Math.max(0, Math.min(1 / 30, (now - last) / 1000)); last = now;
  S.clockDt = dt;
  step(dt); render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
