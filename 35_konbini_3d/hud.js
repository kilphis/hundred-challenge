// hud: 2D canvas(上帯・下帯・オーバーレイ)の準備とHUD描画。3Dの上に重ねる。状態Gは読むだけ
const cv = document.getElementById('cv'), cx = cv.getContext('2d');
// 描画は論理サイズ CW×CH で書く。実ピクセル数は画面の大きさ×dpr に合わせて RES 倍(?dpr=1 で等倍に戻せる)
const CW = W * TS, CH = H * TS + HUD + BOT;
const DPR_Q = new URLSearchParams(location.search).get('dpr');
let RES = 1;
function fit() {
  const s = Math.min(innerWidth / CW, innerHeight / CH);
  cv.style.width = (CW * s) + 'px'; cv.style.height = (CH * s) + 'px';
  RES = DPR_Q ? +DPR_Q : Math.min(2, Math.max(1, s * devicePixelRatio));
  cv.width = Math.round(CW * RES); cv.height = Math.round(CH * RES);
  if (typeof R3 != 'undefined') { R3.setPixelRatio(RES); R3.setSize(W * TS, H * TS); }
}
addEventListener('resize', fit); fit();

const COL = {
  wall: '#3a3d42', floor1: '#d9d6cc', floor2: '#cfccc1', back: '#8d8a83', back2: '#86837c', alley: '#4a4c50', alley2: '#45474b',
};

function drawHUD() {
  const S = G.S;
  cx.fillStyle = '#1a1d1a'; cx.fillRect(0, 0, CW, HUD);
  const tot = S.start * 60 + Math.min(G.gmin, S.hours * 60);
  const hh = ((tot / 60) | 0) % 24, mm = (tot % 60) | 0;
  cx.fillStyle = '#fff'; cx.font = 'bold 26px monospace'; cx.textAlign = 'left';
  cx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 14, 37);
  cx.font = '13px sans-serif'; cx.fillStyle = '#9a9';
  cx.fillText(`${S.name}  〜${(S.start + S.hours) % 24}:00`, 110, 22);
  // 時間バー
  const bw = 260, prog = G.gmin / (S.hours * 60);
  cx.fillStyle = '#333'; cx.fillRect(110, 30, bw, 8);
  if (S.rush) { const a = (S.rush[0] - S.start) / S.hours, b = (S.rush[1] - S.start) / S.hours; cx.fillStyle = '#6a4a20'; cx.fillRect(110 + bw * a, 30, bw * (b - a), 8); }
  cx.fillStyle = '#b7e08a'; cx.fillRect(110, 30, bw * prog, 8);
  // クレーム・捕まり
  cx.font = '14px sans-serif'; cx.fillStyle = G.misses > S.missMax ? '#ff6655' : '#fff';
  cx.fillText(`クレーム ${G.misses} / ${S.missMax}`, 400, 26);
  cx.fillStyle = '#fff'; cx.fillText('捕まり', 400, 46);
  for (let i = 0; i < 3; i++) { cx.fillStyle = i < G.strikes ? '#e33' : '#444'; cx.beginPath(); cx.arc(460 + i * 18, 41, 6, 0, Math.PI * 2); cx.fill(); }
  // 状況
  cx.font = '13px sans-serif';
  let sx = 540;
  const empty = emptyCount(), low = G.stock.filter((v, i) => secOn(i) && v > 0 && v <= secMax(i) / 4).length;
  cx.fillStyle = empty ? '#ff6655' : '#ccc'; cx.fillText(`欠品 ${empty}棚`, sx, 22);
  cx.fillStyle = low ? '#ffcc55' : '#ccc'; cx.fillText(`残りわずか ${low}棚`, sx, 44);
  sx += 110;
  if (S.hot) {
    const fr = { empty: '空', frying: `揚げ中 ${Math.ceil(G.fryer.t)}s`, done: '揚がった！' }[G.fryer.state];
    cx.fillStyle = G.hot == 0 ? '#ff6655' : '#ccc'; cx.fillText(`ホットケース ${G.hot}/${HOT_MAX}`, sx, 22);
    cx.fillStyle = G.fryer.state == 'done' ? '#ffcc55' : '#ccc'; cx.fillText(`フライヤー ${fr}`, sx, 44);
    sx += 140;
  }
  if (S.trash) { cx.fillStyle = G.trash >= TRASH_MAX ? '#ff6655' : '#ccc'; cx.fillText(`ゴミ箱 ${G.trash}/${TRASH_MAX}`, sx, 22); }
  cx.fillStyle = '#ccc';
  cx.fillText(`お客 ${G.zs.filter(z => z.kind == 'customer').length}`, sx, 44);


  // 下段: 持ち物と作業ヒント
  const by = HUD + H * TS;
  cx.fillStyle = '#1a1d1a'; cx.fillRect(0, by, CW, BOT);
  cx.fillStyle = '#fff'; cx.font = '14px sans-serif'; cx.textAlign = 'left';
  const c = G.p.carry;
  cx.fillText('持ち物: ' + (c ? carryName(c) : 'なし'), 14, by + 24);
  if (c && c.kind == 'crate') { cx.fillStyle = '#9fe08a';
    cx.font = '13px sans-serif';
    cx.fillText(crateList(c), 14 + cx.measureText('持ち物: ' + carryName(c) + '　').width + 30, by + 24);
    }
  cx.textAlign = 'center'; cx.fillStyle = emptyCount() > EMPTY_LIMIT ? '#ff6655' : '#ccc'; cx.font = '14px sans-serif';
  cx.fillText(`売上 ¥${Math.round(G.sales)}　評価 ★${G.rating.toFixed(1)}`, CW / 2, by + 24); cx.textAlign = 'left';
  if (c) { cx.textAlign = 'right';
    cx.fillStyle = '#ffcc55';
    cx.font = 'bold 15px sans-serif';
    cx.fillText('[Q] 前に置く', CW - 14, by + 24);
    cx.textAlign = 'left';
    }
  if (G.act) { cx.font = '14px sans-serif';
    cx.fillStyle = G.act.dur == INFO ? '#999' : '#b7e08a';
    cx.fillText((G.act.dur == INFO ? '' : '[E 長押し] ') + G.act.label, 14, by + 50);
    }
  cx.textAlign = 'right'; cx.fillStyle = '#8a9a8a'; cx.font = '12px sans-serif';
  cx.fillText('移動 WASD/矢印　作業 E長押し　置く Q　停止 P', CW - 14, by + 50);
}
