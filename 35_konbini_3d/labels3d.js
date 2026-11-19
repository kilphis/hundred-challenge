// labels3d: 3D の上に2Dで重ねる文字・輪(棚の名札・在庫・長押しゲージ・研修の案内)。状態Gを読むだけ
// ==================== 2D の重ね描き ====================
const outline = (txt, x, y) => { cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.65)'; cx.strokeText(txt, x, y); cx.fillText(txt, x, y); cx.lineWidth = 1; };
function overlays() {
  cx.textAlign = 'center';
  // 棚の名札と在庫
  cx.font = 'bold 11px sans-serif';
  SECTIONS.forEach((s, i) => {
    const v = secViews[i], q = proj(v.cx + s.face * 0.55, v.cz, 2.5);
    cx.fillStyle = G ? (G.stock[i] == 0 ? '#ff7060' : G.stock[i] <= 2 ? '#ffd060' : '#fff') : '#fff';
    outline(G ? `${s.name} ${G.stock[i]}` : s.name, q.x, q.y);
    if (G && G.stock[i] == 0 && secOn(i)) { cx.fillStyle = '#ff4433';
      cx.font = 'bold 13px sans-serif';
      outline('欠品', q.x, q.y + 15);
      cx.font = 'bold 11px sans-serif';
      }
  });
  cx.fillStyle = 'rgba(255,255,255,.8)';
  BACK_POS.map(([x, y], i) => [SECTIONS[i].name, x + 0.5, y == 1 ? 2.3 : 2.75]).filter((_, i) => G && G.preview == i)
    .concat(BACK_SHELVES.map(b => [b.name, b.x + BACK_BLOCKS / 2, b.y == 1 ? 0.95 : 3.95])).concat([['冷凍', 14, 2.3]])
    .forEach(([n, x, z]) => { const q = proj(x, z, 0); outline(n, q.x, q.y); });
  cx.font = '12px sans-serif'; cx.textAlign = 'left';
  let q = proj(8, 3.5, 0); cx.fillStyle = 'rgba(255,255,255,.6)'; outline('バックヤード(客は入れない)', q.x, q.y);
  q = proj(16, 3.0, 0); outline('裏路地', q.x, q.y);
  q = proj(12, 18.9, 0); outline('入口', q.x, q.y);
  q = proj(11.5, 3.9, 0); outline('検品台', q.x, q.y);
  if (G && G.mop.st == 'lean') { q = proj(G.mop.x + 0.5 + G.mop.sx * 0.78, G.mop.y + 0.5 + G.mop.sy * 0.78, 1.5);
    cx.fillStyle = '#bfe0ff';
    outline('モップ', q.x, q.y);
    }
  q = proj(23.6, 18.4, 0); outline('トイレ', q.x, q.y);
  if (G) for (const d of G.dels) { q = proj(d.x, d.y, 0.9); cx.fillStyle = '#ffe08a'; outline('納品', q.x, q.y); }
  if (!G) return;
  // 整頓・撤去の印
  cx.textAlign = 'center'; cx.font = 'bold 11px sans-serif';
  for (const j of G.jobs) {
    if (j.kind == 'toilet') { const q = proj(24.5, 17.5, 1.4);
      cx.fillStyle = '#e0a020';
      cx.beginPath();
      cx.arc(q.x, q.y, 12, 0, 7);
      cx.fill();
      cx.fillStyle = '#fff';
      cx.fillText('汚れ', q.x, q.y + 4);
      continue;
      }
    if (j.kind == 'spill') {
      if (j.zone >= 0) { const z = MOP_ZONES[j.zone], q = proj((z.x0 + z.x1 + 1) / 2, (z.y0 + z.y1 + 1) / 2, 0.1);
        cx.fillStyle = '#bfe0ff';
        cx.font = 'bold 13px sans-serif';
        outline(z.name + ' 残り ' + j.dirty.size + '/' + j.total, q.x, q.y);
        cx.font = 'bold 11px sans-serif';
        }
      continue;
    }
    const s = SECTIONS[j.sec], v = secViews[j.sec], q = proj(v.cx, v.cz, 1.8), exp = j.kind == 'expire';
    cx.fillStyle = exp ? '#c8281e' : '#e0a020'; cx.beginPath(); cx.arc(q.x, q.y, 12, 0, 7); cx.fill();
    cx.fillStyle = '#fff'; cx.fillText(exp ? '期限' : '乱れ', q.x, q.y + 4);
  }
  // ゾンビの「?」「!」
  for (const z of G.zs) {
    const q = proj(z.x, z.y, 1.95 * z.sc);
    if (z.kind == 'staff') { cx.fillStyle = '#7ab8ff';
      cx.font = 'bold 12px sans-serif';
      outline('店員ゾンビ' + (z.say ? '：' + z.say : ''), q.x, proj(z.x, z.y, 2.35).y);
      }
    if (z.trait) { const T = TRAITS[z.trait], q2 = proj(z.x, z.y, 2.35 * z.sc);
      cx.fillStyle = T.color;
      cx.font = 'bold 12px sans-serif';
      outline(T.label, q2.x, q2.y);
      }
    if (!z.trait && z.persona && PERSONAS[z.persona].label) { const P = PERSONAS[z.persona], q2 = proj(z.x, z.y, 2.35);
      cx.fillStyle = P.color; cx.font = 'bold 12px sans-serif'; outline(P.label, q2.x, q2.y); }
    if (z.state == 'chase') { cx.fillStyle = '#ff3333'; cx.font = 'bold 26px sans-serif'; outline('!', q.x, q.y); }
    else if (z.sus > 0.05) {
      cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(q.x - 13, q.y - 4, 26, 6);
      cx.fillStyle = '#ffcc33'; cx.fillRect(q.x - 13, q.y - 4, 26 * z.sus, 6);
      cx.font = 'bold 18px sans-serif'; outline('?', q.x, q.y - 8);
    }
  }
  // 店長のセリフ
  const m = G.mgr;
  if (m.say && m.sayT > 0) {
    const q = proj(m.x, m.y, 2.6); cx.font = 'bold 12px sans-serif'; const w = cx.measureText(m.say).width + 12;
    cx.fillStyle = '#fff'; cx.fillRect(q.x - w / 2, q.y - 14, w, 18); cx.fillStyle = '#222'; cx.fillText(m.say, q.x, q.y);
  }
  drawYou();
  // 長押しの進み
  if (G.p.hold > 0 && G.act) {
    const q = proj(G.p.x, G.p.y, 1.0);
    cx.strokeStyle = '#7fe07f'; cx.lineWidth = 4; cx.beginPath();
    cx.arc(q.x, q.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, G.p.hold / G.act.dur)); cx.stroke(); cx.lineWidth = 1;
  }
}

function drawTut() {   // 研修の案内(上の帯)と、目的地の輪・矢印
  if (!G || !G.tut) return;
  const st = G.tut[0], msg = st ? `研修 [${st.key}]  ${st.text}` : '研修ステップ完了。あとは自由に';
  cx.font = 'bold 14px sans-serif'; const w = Math.min(CW - 20, cx.measureText(msg).width + 24);
  cx.fillStyle = 'rgba(20,24,20,.85)'; cx.fillRect((CW - w) / 2, HUD + 8, w, 28);
  cx.fillStyle = st ? '#ffe680' : '#b7e08a'; cx.textAlign = 'center'; cx.fillText(msg, CW / 2, HUD + 27);
  const tg = tutTarget(); if (!tg) return;
  const q = proj(tg.x, tg.y, 0), a = proj(tg.x, tg.y, 1.9), bob = Math.sin(G.t * 6) * 4;
  cx.strokeStyle = '#ffe680'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(q.x, q.y, 20 + bob / 2, 12 + bob / 3, 0, 0, 7); cx.stroke(); cx.lineWidth = 1;
  cx.fillStyle = '#ffe680'; cx.beginPath(); cx.moveTo(a.x, a.y + bob); cx.lineTo(a.x - 9, a.y - 15 + bob); cx.lineTo(a.x + 9, a.y - 15 + bob); cx.fill();
}

// 自分の位置(水色の輪)と、いまできる作業の吹き出し。知らせ(toast)は上の中央
function drawYou() {
  const p = G.p, f = proj(p.x, p.y, 0), bob = Math.sin(G.t * 5) * 1.5;
  cx.strokeStyle = '#5fd4ff'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(f.x, f.y + 4, 17 + bob, 10 + bob / 2, 0, 0, 7); cx.stroke(); cx.lineWidth = 1;
  const h = proj(p.x, p.y, 2.0);
  if (G.t < 25) { cx.font = 'bold 13px sans-serif'; cx.textAlign = 'center'; cx.fillStyle = '#5fd4ff'; outline('あなた', h.x, h.y - 6); }
  if (G.act && G.act.dur != INFO && mode == 'play') {
    const msg = '[E 長押し] ' + G.act.label;
    cx.font = 'bold 14px sans-serif'; const w = cx.measureText(msg).width + 18, y = h.y - 38;
    cx.fillStyle = 'rgba(10,40,60,.92)'; cx.fillRect(h.x - w / 2, y, w, 24);
    cx.strokeStyle = '#5fd4ff'; cx.strokeRect(h.x - w / 2, y, w, 24);
    cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.fillText(msg, h.x, y + 17);
  }
}
function drawToasts() {
  if (!G) return;
  G.toasts.slice(-3).forEach((t, i) => {
    cx.globalAlpha = Math.min(1, t.t); cx.font = 'bold 16px sans-serif'; cx.textAlign = 'center';
    const w = cx.measureText(t.msg).width + 24, y = HUD + 46 + i * 28;
    cx.fillStyle = 'rgba(15,18,15,.85)'; cx.fillRect((CW - w) / 2, y, w, 24);
    cx.fillStyle = t.color; cx.fillText(t.msg, CW / 2, y + 18);
  });
  cx.globalAlpha = 1;
}
