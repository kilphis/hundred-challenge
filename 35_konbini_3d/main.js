// main: 入力・画面遷移(タイトル/シフト開始)・メインループ・撮影用クエリ
// ==================== 入力 ====================
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code == 'KeyB' && mode == 'play') toggleBot();
  if (e.code == 'KeyP' && (mode == 'play' || mode == 'pause')) mode = mode == 'play' ? 'pause' : 'play';
  if (e.code == 'KeyQ' && mode == 'play') dropCarry();
  if ((e.code == 'Space' || e.code == 'Enter') && mode == 'brief') endBrief();
});
addEventListener('keyup', e => keys[e.code] = false);
const kd = (...c) => c.some(k => keys[k]);

// ==================== 画面遷移 ====================
function showTitle() {
  mode = 'title';
  document.getElementById('result').classList.add('hidden');
  const list = document.getElementById('shiftList');
  list.innerHTML = SHIFTS.map((s, i) => {
    const locked = i > cleared && !devMode;
    const tag = locked ? '🔒 前のシフトに合格で解放' : i >= cleared && devMode && i > cleared ? '開発者: 選択可' : i < cleared ? '合格済み' : '挑戦できる';
    return `<div class="shift ${locked ? 'locked' : ''}" onclick="${locked ? '' : `startShift(${i})`}">
      <div><div class="t">${i + 1}. ${s.name}（${s.hours}時間）<span class="new">新要素: ${s.news}</span></div><div class="d">${s.desc}</div></div>
      <div class="tag">${tag}</div></div>`;
  }).join('');
  document.getElementById('devMode').checked = devMode;
  document.getElementById('title').classList.remove('hidden');
}
function setDevMode(on) {
  devMode = on; try { localStorage.setItem('zconv_dev', on ? '1' : '0'); } catch (e) {}
  showTitle();
}
function startShift(i, noBrief) {
  newShift(i); mode = 'play'; resultT = 0;
  if (devMode) botOn = true;   // 開発者モードならCPUが自動でプレイ(Bで切替)
  for (const k in keys) keys[k] = false;
  document.getElementById('title').classList.add('hidden');
  document.getElementById('result').classList.add('hidden');
  toast(SHIFTS[i].name + ' スタート', '#b7e08a');
  toast('新要素: ' + SHIFTS[i].news, '#ffcc55');
  if (!noBrief && !botOn) showBrief(i);
}
// 開始カード: 目的・操作・画面の見方を読ませる。Space で始まるまで時間は止まる
function showBrief(i) {
  const S = SHIFTS[i], t = TUT[i];
  const end = clockStr(S.start + S.hours);
  document.getElementById('briefBody').innerHTML = `<div class="brief">
    <h2>${i + 1}. ${S.name}　${clockStr(S.start)}〜${end}</h2>
    <div class="goal"><b>目的:</b> ゾンビのお客に見つからないように、棚の欠けたところを補充して、${end} まで店を回す。<br>
      クレームが <b>${S.missMax}</b> を超えるか、3回捕まると失敗。</div>
    <h3>このシフトで増えること</h3><div class="legend">${S.news}</div>
    ${t ? `<h3>研修(お客は来ません。1つできたら次へ進みます)</h3><ol>${t.map(s => `<li>${s.text} <kbd>${s.key}</kbd></li>`).join('')}</ol>` : ''}
    <h3>操作</h3><div class="legend"><kbd>WASD</kbd>/<kbd>矢印</kbd> 移動　<kbd>E</kbd> 長押しで作業　<kbd>Q</kbd> 持ち物を前に置く　<kbd>P</kbd> 一時停止</div>
    <h3>画面の見方</h3><div class="legend">
      <span class="dot" style="background:#5fd4ff"></span>水色の輪 = あなた<br>
      <span class="dot" style="background:#ffe680"></span>黄色の輪と矢印 = 次に行く場所<br>
      上の中央 = 知らせ / 水色の吹き出し = いまできる作業(E長押し) / 下の帯 = 持ち物と売上</div>
    <div class="go" onclick="endBrief()">Space で開始</div></div>`;
  document.getElementById('brief').classList.remove('hidden');
  mode = 'brief';
}
function endBrief() {
  if (mode != 'brief') return;
  document.getElementById('brief').classList.add('hidden');
  for (const k in keys) keys[k] = false;
  mode = 'play';
}

let last = performance.now(), resultT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode == 'play') update(dt);
  else if (mode == 'result' && devMode && botOn && G && (resultT += dt) > 2.5) startShift(G.idx);   // CPU中は結果を2.5秒見せて同じシフトをやり直す
  draw();
  if (botOn && (mode == 'play' || mode == 'pause')) { cx.fillStyle = '#8ad0ff';
    cx.font = 'bold 14px sans-serif';
    cx.textAlign = 'right';
    cx.fillText('CPUプレイ中 (B)', CW - 10, HUD - 8);
    }
  requestAnimationFrame(loop);
}

// 撮影・確認用: ?shift=N&ff=秒&px=x&py=y&carry=p|r|s&trait=smell|fast|charge|giant|messy
//   &empty=N(先頭からN棚を欠品に) &strikes=N(捕まり回数) &trash=N(ゴミ箱の中身) &gmin=分(シフト内の経過) &tut=0(研修を飛ばす) &bot(CPUプレイ)
const Q = new URLSearchParams(location.search);
if (Q.has('shift')) {
  startShift(+Q.get('shift'), !Q.has('brief'));
  if (Q.has('bot')) botOn = true;
  if (Q.has('trait')) G.zs.push(makeZombie('customer', 12.5, 14.5, Q.get('trait')));
  const ff = +(Q.get('ff') || 0);
  for (let i = 0; i < ff * 60 && mode == 'play'; i++) update(1 / 60);
  if (Q.has('px')) { G.p.x = +Q.get('px'); G.p.y = +Q.get('py'); }
  if (Q.has('carry')) G.p.carry = makeCrate(Q.get('carry'));
  if (Q.has('empty')) for (let i = 0; i < +Q.get('empty'); i++) SECTIONS[i].tiles.forEach(([x, y]) => { tileAdd(i, y * W + x, -G.ts[y * W + x]); });
  if (Q.has('trash')) G.trash = +Q.get('trash');
  if (Q.has('strikes')) G.strikes = +Q.get('strikes');
  if (Q.has('gmin')) G.gmin = +Q.get('gmin');
  if (Q.get('tut') == '0') G.tut = null;
} else showTitle();
requestAnimationFrame(loop);

// 結果画面(DOM)。sim.js の endShift が集計だけ作って呼ぶ
function showResult({ S, head, rows, next, pass }) {
  document.getElementById('resultBody').innerHTML =
    `<h2>${S.name}：${head}</h2><table>${rows}</table>${next}
     <span class="btn" onclick="startShift(${G.idx})">もう一度</span>
     ${pass && G.idx + 1 < SHIFTS.length ? `<span class="btn" onclick="startShift(${G.idx + 1})">次のシフトへ</span>` : ''}
     <span class="btn" onclick="showTitle()">シフト選択へ</span>`;
  document.getElementById('result').classList.remove('hidden');
}
