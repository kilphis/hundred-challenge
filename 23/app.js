// app.js — タスク看板と各課題の画面
const L = window.Lab;
const $ = (s, r = document) => r.querySelector(s);
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ---------- 進み具合の保存 ----------
const KEY = 'imgtask23';
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { store = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
const rec = id => (store[id] = store[id] || { status: 'todo', seed: 1 });

// ---------- 描画の道具 ----------
function cmap(v, name) {
  v = v < 0 ? 0 : v > 1 ? 1 : v;
  if (name === 'hot') return [255 * Math.min(1, v * 2.5), 255 * L.clamp((v - 0.4) * 2.5, 0, 1), 255 * L.clamp((v - 0.75) * 4, 0, 1)];
  const g = v * 255; return [g, g, g];
}
function imgCanvas(data, w, hh, lo, hi, name) {
  const c = document.createElement('canvas'); c.width = w; c.height = hh;
  const x = c.getContext('2d'), im = x.createImageData(w, hh);
  for (let i = 0; i < w * hh; i++) {
    const [r, g, b] = cmap((data[i] - lo) / (hi - lo), name);
    im.data[i * 4] = r; im.data[i * 4 + 1] = g; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c;
}
function blit(canvas, src) { const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, canvas.width, canvas.height); return x; }
const cv = (w, hh, cls) => h('canvas', { width: w, height: hh, class: cls || 'px' });
const fig = (label, c) => h('div', { class: 'fig' }, c, h('span', {}, label));
const pane = (title, ...kids) => h('div', { class: 'pane' }, title ? h('h4', {}, title) : null, ...kids);
const row = (...kids) => h('div', { class: 'row' }, ...kids);
function pos(e, c) { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; }
function range(min, max, step, val, oninput) { const e = h('input', { type: 'range', min, max, step, value: val }); e.addEventListener('input', () => oninput(+e.value)); return e; }
function select(opts, val, onchange) {
  const e = h('select', {}, opts.map(([v, t]) => h('option', { value: v }, t))); e.value = val;
  e.addEventListener('change', () => onchange(e.value)); return e;
}
function chartAxes(x, W, H, pad, xmin, xmax, ymin, ymax, xlab, ylab, xstep, ystep, yfmt) {
  x.clearRect(0, 0, W, H);
  x.strokeStyle = css('--line'); x.fillStyle = css('--mut'); x.font = '11px sans-serif'; x.lineWidth = 1;
  const X = v => pad.l + (v - xmin) / (xmax - xmin) * (W - pad.l - pad.r), Y = v => H - pad.b - (v - ymin) / (ymax - ymin) * (H - pad.t - pad.b);
  if (xstep) for (let v = Math.ceil(xmin / xstep) * xstep; v <= xmax + 1e-9; v += xstep) { x.beginPath(); x.moveTo(X(v), pad.t); x.lineTo(X(v), H - pad.b); x.stroke(); x.fillText(String(+v.toFixed(3)), X(v) - 8, H - pad.b + 13); }
  for (let v = Math.ceil(ymin / ystep) * ystep; v <= ymax + 1e-9; v += ystep) { x.beginPath(); x.moveTo(pad.l, Y(v)); x.lineTo(W - pad.r, Y(v)); x.stroke(); x.fillText(yfmt ? yfmt(v) : String(+v.toFixed(3)), 4, Y(v) + 4); }
  x.fillText(xlab, W - pad.r - x.measureText(xlab).width, H - 3);
  if (ylab) x.fillText(ylab, pad.l + 4, pad.t + 10);
  return { X, Y };
}

// ---------- 課題 ----------
const TASKS = [];

// 1. 超解像(1分子局在化)
TASKS.push({
  id: 'smlm', no: 1, theme: '共通の技術', title: '回折限界の向こうの2本線',
  tech: ['超解像顕微鏡', '画像処理'], level: 2,
  lead: '光ってはすぐ消える蛍光分子を1つずつ位置決めして、ふつうの顕微鏡では1本に見える構造を2本に分ける。',
  intro: `<p>光学顕微鏡には約200 nmの解像度の限界(回折限界)がある。それより近い2本の線は、ぼやけて1本に見える。</p>
<p>1分子局在化法(PALM/STORM)では、蛍光分子を「たまにだけ」光らせる。1コマの中で光っている分子は少ないので、光点が重ならない。光点1つ1つの中心を、画素(100 nm)よりずっと細かく求めて点を打っていく。それを何百コマ分重ねると、超解像の像ができる。</p>`,
  goal: '2本の線(細胞骨格の模擬)の間隔を nm 単位で求める。誤差 ±15 nm 以内で正解。',
  hints: ['まず「全コマの和」を見る。ふつうの顕微鏡で撮るとこう見える。', '検出しきい値を下げすぎるとノイズを分子と間違え、上げすぎると暗い分子を落とす。', '断面プロファイルで2つの山の頂上を順にクリックすると、間隔が出る。', '重心法とガウス当てはめで、山の鋭さを比べてみる。'],
  mount(ws, ans, api, seed) {
    const sm = L.makeSMLM(seed), F = sm.F, sum = new Float32Array(F * F);
    for (const fr of sm.stack) for (let i = 0; i < sum.length; i++) sum[i] += fr[i];
    let locs = null, frame = 0, thr = 30, method = 'fit', marks = [], prof = null;
    const cF = cv(256, 256), cW = cv(256, 256), cR = cv(320, 320, ''), cP = cv(720, 200, 'chart');
    const info = h('span', { class: 'stat' }, '');
    function drawFrame() {
      const fr = sm.stack[frame]; let mx = 0; for (const v of fr) mx = Math.max(mx, v);
      const x = blit(cF, imgCanvas(fr, F, F, sm.bg - 4, Math.max(sm.bg + 40, mx), 'hot'));
      if (locs) { x.strokeStyle = '#58a6ff'; x.lineWidth = 2; for (const p of locs) if (p.f === frame) { x.beginPath(); x.arc(p.x / sm.px * 8, p.y / sm.px * 8, 10, 0, 7); x.stroke(); } }
      fl.textContent = `${frame + 1} / ${sm.frames} コマ`;
    }
    blit(cW, imgCanvas(sum, F, F, Math.min(...sum), Math.max(...sum), 'hot'));
    function run() {
      locs = L.localize(sm, thr, method);
      const N = 320, hist = new Float32Array(N * N);
      for (const p of locs) { const i = Math.floor(p.x / 10), j = Math.floor(p.y / 10); if (i >= 0 && j >= 0 && i < N && j < N) hist[j * N + i]++; }
      const b = L.gaussBlur(hist, N, N, 1); let mx = 0; for (const v of b) mx = Math.max(mx, v);
      blit(cR, imgCanvas(b, N, N, 0, mx * 0.7, 'hot'));
      const xs = locs.map(p => p.x).sort((a, b) => a - b), med = xs[xs.length >> 1] || 1600;
      const x0 = med - 250, bins = 125, hh = new Float32Array(bins);
      for (const v of xs) { const k = Math.floor((v - x0) / 4); if (k >= 0 && k < bins) hh[k]++; }
      prof = { x0, bins, v: L.gaussBlur(hh, bins, 1, 1.5) };
      marks = []; info.textContent = `${locs.length} 個の分子を位置決め`;
      drawFrame(); drawProf();
    }
    function drawProf() {
      const x = cP.getContext('2d'), W = cP.width, H = cP.height;
      if (!prof) { x.clearRect(0, 0, W, H); x.fillStyle = css('--mut'); x.font = '13px sans-serif'; x.fillText('「位置決めを実行」すると、x方向の断面プロファイルがここに出る', 20, H / 2); return; }
      const mx = Math.max(...prof.v) * 1.1;
      const ax = chartAxes(x, W, H, { l: 34, r: 10, t: 10, b: 22 }, 0, 500, 0, mx, 'x [nm]', '分子数', 50, Math.max(1, Math.round(mx / 4)));
      x.strokeStyle = css('--acc'); x.lineWidth = 2; x.beginPath();
      prof.v.forEach((v, k) => { const px = ax.X(k * 4 + 2), py = ax.Y(v); k ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
      x.strokeStyle = css('--warn'); x.fillStyle = css('--warn');
      marks.forEach((m, i) => { x.beginPath(); x.moveTo(ax.X(m), 10); x.lineTo(ax.X(m), H - 22); x.stroke(); x.fillText('AB'[i], ax.X(m) + 3, 22); });
      if (marks.length === 2) { x.font = '600 14px sans-serif'; x.fillText(`A–B = ${Math.abs(marks[1] - marks[0]).toFixed(0)} nm`, W - 150, 26); }
      cP._ax = ax;
    }
    cP.addEventListener('click', e => {
      if (!prof) return; const [px] = pos(e, cP), ax = cP._ax;
      const v = (px - 34) / (cP.width - 44) * 500; if (v < 0 || v > 500) return;
      if (marks.length >= 2) marks = []; marks.push(v); drawProf();
    });
    const fl = h('span', { class: 'mut' });
    ws.append(
      pane('生データ', h('div', { class: 'figs' },
        fig(h('span', {}, '1コマ(青丸=見つけた分子) ', fl), cF), fig('全コマの和(ふつうの顕微鏡ではこう見える)', cW)),
        row('コマ', range(0, sm.frames - 1, 1, 0, v => { frame = v; drawFrame(); }))),
      pane('位置決め', row('検出しきい値', range(5, 120, 1, thr, v => { thr = v; tl.textContent = v + ' 光子'; }), tl = h('span', { class: 'stat' }, thr + ' 光子')),
        row('中心の求め方', select([['centroid', '重心'], ['fit', 'ガウス関数の当てはめ']], method, v => method = v),
          h('button', { class: 'pri', onclick: run }, '位置決めを実行'), info)),
      pane('再構成像と断面', h('div', { class: 'figs' }, fig('再構成像(10 nm/画素、視野 3.2 µm)', cR)),
        h('div', { class: 'mut' }, '断面プロファイル(中央付近の分子のx座標の分布)。山の頂上をクリック → A, B'), cP));
    var tl; drawFrame(); drawProf();
    const inp = h('input', { type: 'number', step: 1, placeholder: 'nm' });
    ans.append(h('label', {}, '2本の間隔', inp, 'nm'), h('button', { class: 'pri', onclick: () => {
      const v = +inp.value; if (!inp.value) return api.ng('数値を入れてください。');
      if (Math.abs(v - sm.gap) <= 15) api.clear(`正解。真の間隔は ${sm.gap} nm。全コマの和(ふつうの顕微鏡)では分けられない距離です。`);
      else api.ng(`ずれが15 nmより大きい(${v} nm)。山の頂上を選び直すか、位置決めの設定を見直してください。`);
    } }, '判定'));
  },
});

// 2. ノイズ除去
TASKS.push({
  id: 'denoise', no: 2, theme: 'β細胞', title: '低線量EM像のノイズを消す',
  tech: ['AIノイズ除去', '画像処理'], level: 1,
  lead: '電子線を弱めて撮ったザラザラのβ細胞像から、ミトコンドリアと分泌顆粒の形を取り戻す。',
  intro: `<p>電子顕微鏡で細胞を傷めずに撮る、あるいは大量の切片を速く撮ると、像はノイズだらけになる。</p>
<p>古典的な方法は、近くの画素で平均をとるフィルタ(平均・ガウシアン・メディアン)。学習で解く方法として <b>Noise2Noise</b> がある。同じ場所を2回撮ったノイズ画像の組を使い、「1枚目から2枚目を当てる」ように学習する。ノイズは2枚で独立しているので当てようがなく、構造だけを学ぶ。正解のきれいな画像は要らない。ここでは 9×9 の線形フィルタを、最小二乗法で学習する。</p>
<p class="mut">採点のため、この課題だけはノイズのない真の画像を裏に持っている(実際の撮影では存在しない)。</p>`,
  goal: '撮影1を処理して、PSNR(真の画像との近さ)を目標値以上にする。',
  hints: ['PSNR は大きいほど真の画像に近い。3 dB 上がると誤差の2乗が半分になる。', '「取り除いた成分」に細胞の形が見えていたら、構造まで削っている。', 'ぼかしは強すぎても弱すぎてもだめ。一番よい強さを探す。', 'メディアンは点状のノイズに強いが、このノイズ(ガウス雑音)では効きが違う。'],
  mount(ws, ans, api, seed) {
    const ph = L.makePhantom(seed, 224, 224, 40), w = 192, hh = 192;
    const clean = L.renderSlice(ph, 20, 16, 16, w, hh, 0, 0).img;
    const n1 = L.renderSlice(ph, 20, 16, 16, w, hh, 0.2, seed * 7 + 1).img, n2 = L.renderSlice(ph, 20, 16, 16, w, hh, 0.2, seed * 7 + 2).img;
    let best = 0; for (let s = 0.5; s <= 3.6; s += 0.1) best = Math.max(best, L.psnr(L.gaussBlur(n1, w, hh, s), clean));
    const target = Math.floor((best - 0.8) * 10) / 10;
    let method = 'none', par = { box: 3, gauss: 1.0, median: 3 }, ker = null, out = n1, cur = 0;
    const c1 = cv(w, hh), c2 = cv(w, hh), cO = cv(w, hh), cD = cv(w, hh), cT = cv(w, hh);
    blit(c1, imgCanvas(n1, w, hh, 0, 1)); blit(c2, imgCanvas(n2, w, hh, 0, 1)); blit(cT, imgCanvas(clean, w, hh, 0, 1));
    const ps = h('span', { class: 'stat' }), parBox = h('span', { class: 'row', style: 'margin:0' });
    const truthFig = fig('真の画像(クリア後に表示)', cT); truthFig.style.display = 'none';
    function apply() {
      if (method === 'none') out = n1;
      else if (method === 'box') out = L.boxBlur(n1, w, hh, par.box);
      else if (method === 'gauss') out = L.gaussBlur(n1, w, hh, par.gauss);
      else if (method === 'median') out = L.median(n1, w, hh, par.median);
      else { if (!ker) ker = L.n2nTrain(n1, n2, w, hh, 9); out = L.conv(n1, w, hh, ker, 9); }
      blit(cO, imgCanvas(out, w, hh, 0, 1));
      const d = n1.map((v, i) => v - out[i]); blit(cD, imgCanvas(d, w, hh, -0.5, 0.5));
      cur = L.psnr(out, clean);
      ps.innerHTML = `PSNR <b>${cur.toFixed(2)}</b> dB <span class="mut">(目標 ${target.toFixed(1)} dB / 入力そのまま ${L.psnr(n1, clean).toFixed(2)} dB)</span>`;
      ps.style.color = cur >= target ? css('--ok') : '';
    }
    function setMethod(m) {
      method = m; parBox.innerHTML = '';
      if (m === 'box') parBox.append('窓の大きさ', select([[3, '3×3'], [5, '5×5'], [7, '7×7'], [9, '9×9']], par.box, v => { par.box = +v; apply(); }));
      if (m === 'gauss') { const t = h('span', { class: 'stat' }, 'σ = ' + par.gauss.toFixed(1)); parBox.append('強さ', range(0.3, 4, 0.1, par.gauss, v => { par.gauss = v; t.textContent = 'σ = ' + v.toFixed(1); apply(); }), t); }
      if (m === 'median') parBox.append('窓の大きさ', select([[3, '3×3'], [5, '5×5'], [7, '7×7']], par.median, v => { par.median = +v; apply(); }));
      if (m === 'n2n') parBox.append(h('span', { class: 'mut' }, '撮影1→撮影2 を当てる 9×9 フィルタを学習して、撮影1にかける'));
      apply();
    }
    ws.append(
      pane('入力(同じ場所を2回撮影)', h('div', { class: 'figs' }, fig('撮影1(これを処理する)', c1), fig('撮影2(Noise2Noise の学習にだけ使う)', c2))),
      pane('処理', row('方法', select([['none', 'なし'], ['box', '平均フィルタ'], ['gauss', 'ガウシアンフィルタ'], ['median', 'メディアンフィルタ'], ['n2n', 'Noise2Noise(学習)']], method, setMethod), parBox),
        row(ps),
        h('div', { class: 'figs' }, fig('結果', cO), fig('取り除いた成分(撮影1 − 結果)', cD), truthFig)));
    setMethod('none');
    ans.append(h('button', { class: 'pri', onclick: () => {
      if (cur >= target) { truthFig.style.display = ''; api.clear(`クリア(PSNR ${cur.toFixed(2)} dB)。真の画像を表示しました。結果と見比べて、何が残り何が消えたかを確認できます。`); }
      else api.ng(`PSNR ${cur.toFixed(2)} dB。目標 ${target.toFixed(1)} dB まであと ${(target - cur).toFixed(2)} dB。`);
    } }, 'いまの結果を提出'));
  },
});

// 3. 連続切片の位置合わせ
TASKS.push({
  id: 'align', no: 3, theme: 'β細胞', title: '連続切片のズレを直す',
  tech: ['画像処理', '3次元再構築'], level: 2,
  lead: '8枚の連続切片は1枚ごとに少しずつズレて撮れている。隣どうしを重ねて、立体に積める状態にする。',
  intro: `<p>3次元電子顕微鏡では、試料を薄く削っては撮ることを繰り返す。ステージのドリフトなどのため、毎回の画像は少しずつズレる。そのまま積むと、立体の断面がギザギザになる。</p>
<p>隣り合う切片は、ほぼ同じ構造が写っている。そこで、片方をずらしながら「どれだけ似ているか」(正規化相互相関)を測り、一番似るずらし量を探す。</p>`,
  goal: '7組の隣接ペア(1→2 … 7→8)すべてで、ずらし量を正解から ±1 画素以内に合わせる。',
  hints: ['重ね表示では、前の切片が緑、今の切片がマゼンタ。合うと灰色になる。', '差分表示は、合うほど暗くなる。', '相互相関マップの一番明るい点が、一番似るずらし量。', '下の「縦の断面」は、全部合うと構造の縁がまっすぐつながる。', '矢印キー <kbd>←↑↓→</kbd> でも動かせる。'],
  mount(ws, ans, api, seed) {
    const ph = L.makePhantom(seed + 100, 224, 224, 40), K = 8, w = 128, r = L.rng(seed * 31 + 5), base = 48;
    const off = [[0, 0]], d = [null];
    for (let k = 1; k < K; k++) {
      let s; do { s = [Math.floor(r() * 11) - 5, Math.floor(r() * 11) - 5]; } while (!s[0] && !s[1]);
      d.push(s); off.push([off[k - 1][0] + s[0], off[k - 1][1] + s[1]]);
    }
    const sl = off.map((o, k) => L.renderSlice(ph, 12 + k * 2, base + o[0], base + o[1], w, w, 0.05, seed * 13 + k).img);
    const sh = Array.from({ length: K }, () => [0, 0]);
    let cur = 1, mode = 'ov', yrow = 64;
    const cM = cv(w, w), cN = cv(25, 25), cX = cv(w, K * 6);
    cM.style.width = '384px'; cN.style.width = '200px'; cX.style.width = '384px';
    const lab = h('span', { class: 'stat' }), peak = h('span', { class: 'mut' });
    const at = (img, x, y) => (x < 0 || y < 0 || x >= w || y >= w) ? null : img[y * w + x];
    function draw() {
      const a = sl[cur - 1], b = sl[cur], [dx, dy] = sh[cur];
      const x = cM.getContext('2d'), im = x.createImageData(w, w);
      for (let y = 0; y < w; y++) for (let xx = 0; xx < w; xx++) {
        const va = a[y * w + xx], vb = at(b, xx - dx, y - dy), i = (y * w + xx) * 4;
        const A = L.clamp((va - 0.1) / 0.85, 0, 1) * 255, B = vb == null ? 0 : L.clamp((vb - 0.1) / 0.85, 0, 1) * 255;
        if (mode === 'ov') { im.data[i] = B; im.data[i + 1] = A; im.data[i + 2] = B; }
        else { const v = vb == null ? 0 : Math.min(255, Math.abs(va - vb) * 600); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; }
        im.data[i + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      lab.textContent = `切片${cur} → 切片${cur + 1} のずらし量: dx = ${dx}, dy = ${dy}`;
      pairBtns.forEach((b, k) => b.classList.toggle('on', k + 1 === cur));
      // 縦の断面: 各切片の y=yrow の行を、累積のずらし量をかけて並べる
      const xz = new Float32Array(w * K * 6); let cx = 0, cy = 0;
      for (let k = 0; k < K; k++) {
        if (k) { cx += sh[k][0]; cy += sh[k][1]; }
        for (let xx = 0; xx < w; xx++) { const v = at(sl[k], xx - cx, yrow - cy); for (let t = 0; t < 6; t++) xz[(k * 6 + t) * w + xx] = v == null ? 0 : v; }
      }
      blit(cX, imgCanvas(xz, w, K * 6, 0.1, 0.95));
    }
    function ncc() {
      const R = 12, m = L.nccMap(sl[cur - 1], sl[cur], w, w, R); let bi = 0;
      for (let i = 0; i < m.length; i++) if (m[i] > m[bi]) bi = i;
      const mn = Math.min(...m), mx = m[bi]; const x = blit(cN, imgCanvas(m, 25, 25, mn, mx, 'hot'));
      x.strokeStyle = '#58a6ff'; x.lineWidth = 0.15; x.strokeRect(bi % 25, Math.floor(bi / 25), 1, 1);
      x.strokeStyle = '#fff'; x.strokeRect(R + sh[cur][0], R + sh[cur][1], 1, 1);
      peak.innerHTML = `一番明るい点: dx = ${bi % 25 - R}, dy = ${Math.floor(bi / 25) - R}(中心が 0,0。白枠=今のずらし量、青枠=最大)`;
    }
    const move = (ddx, ddy) => { sh[cur][0] += ddx; sh[cur][1] += ddy; draw(); if (peak.textContent) ncc(); };
    const pairBtns = [];
    for (let k = 1; k < K; k++) pairBtns.push(h('button', { onclick: () => { cur = k; peak.textContent = ''; cN.getContext('2d').clearRect(0, 0, 25, 25); draw(); } }, `${k}→${k + 1}`));
    const onKey = e => {
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (m && !/INPUT|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); move(...m); }
    };
    document.addEventListener('keydown', onKey); api.onLeave(() => document.removeEventListener('keydown', onKey));
    ws.append(
      pane('隣接ペア', row(...pairBtns),
        row('表示', select([['ov', '重ね(緑=前、マゼンタ=今)'], ['diff', '差分(合うほど暗い)']], mode, v => { mode = v; draw(); })),
        h('div', { class: 'figs', style: 'grid-template-columns:auto 1fr;align-items:start' },
          fig(lab, cM),
          h('div', {}, row(h('button', { onclick: () => move(-1, 0) }, '←'), h('button', { onclick: () => move(1, 0) }, '→'), h('button', { onclick: () => move(0, -1) }, '↑'), h('button', { onclick: () => move(0, 1) }, '↓'),
            h('button', { onclick: () => { sh[cur] = [0, 0]; draw(); } }, '0に戻す')),
            row(h('button', { onclick: ncc }, '相互相関マップを計算')), cN, h('div', { class: 'mut', style: 'max-width:260px' }, peak)))),
      pane('縦の断面(全8枚を、いまのずらし量で積んだもの)', row('切る位置 y', range(4, w - 5, 1, yrow, v => { yrow = v; draw(); })), cX));
    draw();
    ans.append(h('button', { class: 'pri', onclick: () => {
      const bad = []; for (let k = 1; k < K; k++) if (Math.abs(sh[k][0] - d[k][0]) > 1 || Math.abs(sh[k][1] - d[k][1]) > 1) bad.push(`${k}→${k + 1}`);
      if (!bad.length) api.clear('クリア。7組すべて揃いました。縦の断面で、構造がまっすぐつながっているはずです。');
      else api.ng(`まだズレている組: ${bad.join(', ')}`);
    } }, '揃えた結果を提出'));
  },
});

// 4. セグメンテーション
TASKS.push({
  id: 'seg', no: 4, theme: 'β細胞', title: 'ミトコンドリアを塗り分ける',
  tech: ['機械学習', '画像処理'], level: 2,
  lead: '少しだけ手で塗ったお手本から分類器を学習させ、画像全体のミトコンドリアを自動で見つける。',
  intro: `<p>3D-EMのデータは数千枚になるので、オルガネラを手で全部塗るのは無理がある。そこで、一部だけ人が塗り、残りを機械学習に任せる。</p>
<p>ここでは画素ごとに「特徴量」(ぼかした明るさ、勾配、局所のばらつき など)を並べる。それをロジスティック回帰に入れ、「ミトコンドリアである確率」を出す。どの特徴量を使うかで、結果が大きく変わる。</p>
<p>膜は暗く、内部はやや暗い灰色に縞(クリステ)が入っているのがミトコンドリア。黒い芯と白い縁を持つ丸がインスリン分泌顆粒。</p>`,
  goal: 'ミトコンドリアの予測と正解の重なり(Dice係数)を 0.75 以上にする。',
  hints: ['ミトコンドリアの中と、それ以外(細胞質・分泌顆粒)の両方を塗る。間違えやすい分泌顆粒も塗るのが大事。', '「輝度そのもの」だけだと、細かい縞やノイズに引きずられる。', '大きくぼかした特徴量は「まわりの様子」を表す。', 'しきい値を上げると「確実なところだけ」を取る。予測が広がりすぎるときに試す。', '採点すると、正解との差(赤=取りすぎ、青=取りこぼし)を表示できるようになる。'],
  mount(ws, ans, api, seed) {
    const ph = L.makePhantom(seed + 200, 224, 224, 40), w = 192, hh = 192, N = w * hh;
    const sl = L.renderSlice(ph, 20, 16, 16, w, hh, 0.12, seed * 9 + 3), gt = sl.mask.map(v => v === 1 ? 1 : 0);
    const maps = L.featureMaps(sl.img, w, hh), base = imgCanvas(sl.img, w, hh, 0, 1);
    const labels = new Int8Array(N).fill(-1);
    let brush = 1, rad = 3, prob = null, thr = 0.5, view = 'img', graded = false, painting = false;
    const chosen = new Set(['raw']);
    const c = cv(w * 2, hh * 2); c.style.cursor = 'crosshair';
    const cnt = h('span', { class: 'mut' }), res = h('span', { class: 'stat' });
    function draw() {
      const x = blit(c, base), S = 2;
      const ov = x.createImageData(c.width, c.height), bg = x.getImageData(0, 0, c.width, c.height);
      for (let y = 0; y < hh; y++) for (let xx = 0; xx < w; xx++) {
        const i = y * w + xx; let col = null;
        if (view === 'prob' && prob) { const [r, g, b] = cmap(prob[i], 'hot'); col = [r, g, b, 1]; }
        else if (view === 'pred' && prob) { if (prob[i] > thr) col = [255, 200, 0, 0.45]; }
        else if (view === 'err' && prob) {
          const p = prob[i] > thr ? 1 : 0;
          if (p && !gt[i]) col = [248, 81, 73, 0.6]; else if (!p && gt[i]) col = [56, 139, 253, 0.6]; else if (p) col = [63, 185, 80, 0.35];
        }
        if ((view === 'img' || view === 'pred') && labels[i] >= 0) col = labels[i] ? [255, 120, 0, 0.75] : [60, 160, 255, 0.75];
        for (let j = 0; j < S; j++) for (let k = 0; k < S; k++) {
          const o = ((y * S + j) * c.width + xx * S + k) * 4;
          if (col) { const a = col[3]; for (let t = 0; t < 3; t++) ov.data[o + t] = bg.data[o + t] * (1 - a) + col[t] * a; }
          else for (let t = 0; t < 3; t++) ov.data[o + t] = bg.data[o + t];
          ov.data[o + 3] = 255;
        }
      }
      x.putImageData(ov, 0, 0);
      let a = 0, b = 0; for (const v of labels) { if (v === 1) a++; else if (v === 0) b++; }
      cnt.textContent = `塗った画素: ミトコンドリア ${a} / それ以外 ${b}`;
    }
    function paint(e) {
      const [px, py] = pos(e, c), cx = Math.floor(px / 2), cy = Math.floor(py / 2);
      for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) {
        if (i * i + j * j > rad * rad) continue; const x = cx + i, y = cy + j; if (x < 0 || y < 0 || x >= w || y >= hh) continue;
        labels[y * w + x] = brush === 2 ? -1 : brush;
      }
      draw();
    }
    c.addEventListener('pointerdown', e => { painting = true; c.setPointerCapture(e.pointerId); paint(e); });
    c.addEventListener('pointermove', e => { if (painting) paint(e); });
    c.addEventListener('pointerup', () => { painting = false; });
    function train() {
      const idx = [], ys = []; labels.forEach((v, i) => { if (v >= 0) { idx.push(i); ys.push(v); } });
      if (!ys.includes(1) || !ys.includes(0)) return api.ng('ミトコンドリアとそれ以外の両方を塗ってください。');
      if (!chosen.size) return api.ng('特徴量を1つ以上選んでください。');
      api.hide();
      const m = L.trainLogistic(maps, [...chosen], idx, ys); prob = L.predict(m, maps, N);
      if (view === 'img') view = 'pred'; viewSel.value = view; draw();
      res.textContent = graded ? `Dice = ${L.dice(prob.map(v => v > thr ? 1 : 0), gt).toFixed(3)}` : '学習しました。予測を見て、よければ採点。';
    }
    const brushBtns = [['ミトコンドリア', 1], ['それ以外', 0], ['消しゴム', 2]].map(([t, v]) => h('button', { onclick: () => { brush = v; brushBtns.forEach(b => b.classList.remove('on')); brushBtns[[1, 0, 2].indexOf(v)].classList.add('on'); } }, t));
    brushBtns[0].classList.add('on');
    const viewSel = select([['img', '画像+塗り'], ['pred', '予測(黄)'], ['prob', '確率マップ']], view, v => { view = v; draw(); });
    const feats = L.FEATURES.map(f => h('label', { style: 'display:inline-flex;gap:4px;align-items:center;margin-right:10px' },
      h('input', Object.assign({ type: 'checkbox', onchange: e => { e.target.checked ? chosen.add(f.id) : chosen.delete(f.id); } }, chosen.has(f.id) ? { checked: '' } : {})), f.name));
    const tl = h('span', { class: 'stat' }, thr.toFixed(2));
    ws.append(
      pane('塗る(ドラッグ)', row('筆', ...brushBtns, '太さ', range(1, 8, 1, rad, v => rad = v), h('button', { onclick: () => { labels.fill(-1); draw(); } }, '塗りを全部消す'), cnt),
        row('表示', viewSel), c),
      pane('学習', h('div', {}, ...feats),
        row(h('button', { class: 'pri', onclick: train }, '学習して予測'), 'しきい値', range(0.05, 0.99, 0.01, thr, v => {
          thr = v; tl.textContent = v.toFixed(2); if (prob) { draw(); if (graded) res.textContent = `Dice = ${L.dice(prob.map(p => p > thr ? 1 : 0), gt).toFixed(3)}`; }
        }), tl), row(res)));
    draw();
    ans.append(h('button', { class: 'pri', onclick: () => {
      if (!prob) return api.ng('まず「学習して予測」を押してください。');
      const dc = L.dice(prob.map(v => v > thr ? 1 : 0), gt);
      if (!graded) { graded = true; viewSel.append(h('option', { value: 'err' }, '正解との差(赤=取りすぎ 青=取りこぼし 緑=一致)')); }
      res.textContent = `Dice = ${dc.toFixed(3)}`;
      if (dc >= 0.75) api.clear(`クリア(Dice ${dc.toFixed(3)})。表示を「正解との差」にすると、どこを間違えやすいか見られます。`);
      else api.ng(`Dice ${dc.toFixed(3)}。0.75 にとどいていない。表示を「正解との差」にして、どこを間違えているか見てください。`);
    } }, '採点'));
  },
});

// 5. 3D再構築と計数
TASKS.push({
  id: 'vol', no: 5, theme: 'β細胞', title: '分泌顆粒を立体で数える',
  tech: ['3次元再構築', '画像処理'], level: 2,
  lead: 'セグメンテーション済みの3Dボリュームから、インスリン分泌顆粒の個数と大きさを測る。',
  intro: `<p>前の課題のような塗り分けを全スライスで行うと、0と1の3次元配列(ボリューム)ができる。ここから「顆粒が何個あり、どれくらいの大きさか」を測る。</p>
<p>1つの顆粒は何枚ものスライスにまたがって写る。だからスライスごとに数えると、同じ顆粒を何度も数えてしまう。立体のままつながった塊(3D連結成分)にまとめる必要がある。自動の塗り分けには、小さなゴミ(誤検出)も混ざっている。</p>
<p>ボクセル(立体の画素)は 1辺 20 nm の立方体。</p>`,
  goal: '顆粒の個数(ぴったり)と、平均の直径(±10%)を答える。',
  hints: ['まず「スライスごとに数える」を押して、どれだけ多く数えてしまうか見る。', 'サイズ分布を見ると、ゴミと顆粒の大きさは離れている。その谷に最小サイズを置く。', '体積 V(ボクセル数)から、同じ体積の球の直径は d = (6V/π)^(1/3) ボクセル。nm にするには 20 をかける。'],
  mount(ws, ans, api, seed) {
    const gv = L.makeGranVol(seed), { W, H, D, vol } = gv;
    const truthN = gv.spheres.length, truthD = gv.spheres.reduce((a, s) => a + 2 * s.R, 0) / truthN * gv.voxel;
    let conn = 26, minSize = 0, lb = null, yaw = 0.6, pitch = 0.45, z = D >> 1;
    const surf = [];
    for (let k = 0; k < D; k++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (k * H + y) * W + x; if (!vol[i]) continue;
      if (x && y && k && x < W - 1 && y < H - 1 && k < D - 1 && vol[i - 1] && vol[i + 1] && vol[i - W] && vol[i + W] && vol[i - W * H] && vol[i + W * H]) continue;
      surf.push([x - W / 2, y - H / 2, k - D / 2, i]);
    }
    const c3 = cv(440, 440, ''), cS = cv(W, H), cHist = cv(560, 180, 'chart');
    cS.style.width = '288px';
    const hue = l => `hsl(${(l * 137.5) % 360} 70% 60%)`;
    const kept = l => lb && lb.sizes[l] >= minSize;
    function draw3d() {
      const x = c3.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 440, 440);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), s = 3.2;
      const pts = surf.map(([a, b, c, i]) => { const X = a * cy - b * sy, Y0 = a * sy + b * cy, Y = c * cp - Y0 * sp, Z = c * sp + Y0 * cp; return [X, Y, Z, i]; });
      pts.sort((p, q) => p[2] - q[2]);
      for (const [X, Y, Z, i] of pts) {
        const l = lb ? lb.lab[i] : 0, sh = 0.55 + 0.45 * (Z + 50) / 100;
        if (lb && !kept(l)) { x.fillStyle = `rgba(110,110,110,${0.5 * sh})`; x.fillRect(220 + X * s - 1, 220 - Y * s - 1, 2, 2); continue; }
        x.fillStyle = lb ? hue(l) : `rgb(${200 * sh},${200 * sh},${210 * sh})`;
        x.globalAlpha = sh; x.fillRect(220 + X * s - 1.8, 220 - Y * s - 1.8, 3.6, 3.6); x.globalAlpha = 1;
      }
      x.fillStyle = '#8b949e'; x.font = '12px sans-serif'; x.fillText('ドラッグで回転', 10, 18);
    }
    function drawSlice() {
      const x = cS.getContext('2d'), im = x.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const j = z * W * H + i, o = i * 4; im.data[o + 3] = 255;
        if (!vol[j]) continue;
        if (lb) { const l = lb.lab[j]; if (kept(l)) { const hh = (l * 137.5) % 360; const [r, g, b] = hsl(hh, 0.7, 0.6); im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; } else im.data[o] = im.data[o + 1] = im.data[o + 2] = 110; }
        else im.data[o] = im.data[o + 1] = im.data[o + 2] = 230;
      }
      x.putImageData(im, 0, 0); zl.textContent = `z = ${z} / ${D - 1}`;
    }
    function hsl(hh, s, l) { const f = n => { const k = (n + hh / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return [f(0), f(8), f(4)]; }
    function drawHist() {
      const x = cHist.getContext('2d'), Wc = cHist.width, Hc = cHist.height;
      if (!lb) { x.clearRect(0, 0, Wc, Hc); x.fillStyle = css('--mut'); x.font = '13px sans-serif'; x.fillText('ラベル付けすると、塊の大きさの分布がここに出る', 20, Hc / 2); return; }
      const nb = 11, cnt = new Array(nb).fill(0);
      for (let l = 1; l < lb.sizes.length; l++) cnt[Math.min(nb - 1, Math.floor(Math.log2(lb.sizes[l])))]++;
      const mx = Math.max(...cnt);
      const ax = chartAxes(x, Wc, Hc, { l: 34, r: 10, t: 12, b: 24 }, 0, nb, 0, mx * 1.1, '体積 [ボクセル](対数)', '個数', 1, Math.max(1, Math.ceil(mx / 4)));
      x.clearRect(0, Hc - 24, Wc, 24); x.fillStyle = css('--mut');
      for (let k = 0; k < nb; k++) {
        const x0 = ax.X(k), x1 = ax.X(k + 1);
        x.fillStyle = 2 ** (k + 1) <= minSize ? '#6e7681' : css('--acc');
        x.fillRect(x0 + 2, ax.Y(cnt[k]), x1 - x0 - 4, ax.Y(0) - ax.Y(cnt[k]));
        x.fillStyle = css('--mut'); x.fillText(`${2 ** k}〜`, x0 + 4, Hc - 10);
      }
    }
    function summary() {
      if (!lb) return;
      const ks = lb.sizes.map((s, l) => [s, l]).filter(([s, l]) => l && s >= minSize);
      const mv = ks.reduce((a, [s]) => a + s, 0) / (ks.length || 1);
      out.innerHTML = `残った塊: <b>${ks.length}</b> 個 / 全 ${lb.n} 個 &nbsp; 平均体積: <b>${mv.toFixed(1)}</b> ボクセル`;
    }
    let drag = null;
    c3.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; c3.setPointerCapture(e.pointerId); });
    c3.addEventListener('pointermove', e => { if (!drag) return; yaw += (e.clientX - drag[0]) * 0.01; pitch += (e.clientY - drag[1]) * 0.01; drag = [e.clientX, e.clientY]; draw3d(); });
    c3.addEventListener('pointerup', () => drag = null);
    const out = h('div', { class: 'stat' }), c2d = h('span', { class: 'stat' }), zl = h('span', { class: 'mut' });
    const ml = h('span', { class: 'stat' }, '0');
    ws.append(
      pane('ボリューム(96×96×48 ボクセル)', h('div', { class: 'figs', style: 'grid-template-columns:auto 1fr;align-items:start' },
        c3, h('div', {}, fig(h('span', {}, '1枚のスライス ', zl), cS), row(range(0, D - 1, 1, z, v => { z = v; drawSlice(); }))))),
      pane('数える', row(h('button', { onclick: () => { c2d.textContent = `スライスごとの塊の数の合計: ${L.count2d(vol, W, H, D)}`; } }, 'スライスごとに数える(2D)'), c2d),
        row('つながりの定義', select([[6, '6近傍(面で接する)'], [26, '26近傍(角で接するのも含む)']], conn, v => { conn = +v; }),
          h('button', { class: 'pri', onclick: () => { lb = L.label3d(vol, W, H, D, conn); summary(); draw3d(); drawSlice(); drawHist(); } }, '3Dでラベル付け')),
        row('最小サイズ', range(0, 300, 1, 0, v => { minSize = v; ml.textContent = v + ' ボクセル未満を捨てる'; summary(); draw3d(); drawSlice(); drawHist(); }), ml),
        out, cHist));
    draw3d(); drawSlice(); drawHist();
    const iN = h('input', { type: 'number', step: 1 }), iD = h('input', { type: 'number', step: 1 });
    ans.append(h('label', {}, '個数', iN, '個'), h('label', {}, '平均直径', iD, 'nm'), h('button', { class: 'pri', onclick: () => {
      const n = +iN.value, dd = +iD.value; if (!iN.value || !iD.value) return api.ng('2つとも入れてください。');
      const okN = n === truthN, okD = Math.abs(dd - truthD) / truthD <= 0.1;
      if (okN && okD) api.clear(`クリア。正解は ${truthN} 個、平均直径 ${truthD.toFixed(0)} nm。`);
      else api.ng(`${okN ? '個数は正しい' : '個数が違う'}。${okD ? '直径は範囲内' : '直径が±10%の外'}。`);
    } }, '判定'));
  },
});

// 6. 空間統計(肺の血管ニッチ)
TASKS.push({
  id: 'niche', no: 6, theme: '肺線維症', title: '血管ニッチに集まる細胞はどれか',
  tech: ['空間統計解析'], level: 3,
  lead: '線維化した肺の切片で、細胞の種類ごとに「血管の近くに偏っているか」を、偶然の並びと比べて判定する。',
  intro: `<p>特発性肺線維症の研究は、上皮細胞・線維芽細胞・マクロファージを中心に進んできた。一方、血管内皮やペリサイトがつくる「血管ニッチ」がどう関わるかは、まだ分かっていない。</p>
<p>「血管の近くに多い」と目で見て感じても、偶然かもしれない。そこで空間統計を使う。細胞と同じ数の点を組織中にランダムに置く(完全空間ランダム, CSR)。その点から最寄りの血管までの距離の分布を、何十回も作る。実際の細胞の分布がその幅(包絡線)の外に出ていれば、偶然では説明しにくい。</p>
<p class="mut">データは模擬(どの細胞種がどう並ぶかは、データを作るたびに入れ替わる)。視野 600×600 µm。</p>`,
  goal: '3種類の細胞それぞれについて、「血管の近くに偏る/ランダム/血管を避ける」を判定する。',
  hints: ['累積分布(距離 r 以内にいる細胞の割合)の線が包絡線より上なら、ランダムより血管に近い。', '下にはみ出すなら、血管から離れている。', 'シミュレーション回数が少ないと包絡線が狭く、ブレやすい。', '地図で種類を1つずつ表示すると、目でも確かめられる。'],
  mount(ws, ans, api, seed) {
    const lu = L.makeLung(seed), S = lu.S, show = lu.types.map(() => true);
    const cMap = cv(480, 480, ''), cC = cv(560, 260, 'chart'); let sel = 0, nsim = 99;
    const res = h('div', { class: 'mut' });
    function drawMap() {
      const x = cMap.getContext('2d'), k = 480 / S; x.fillStyle = '#10151c'; x.fillRect(0, 0, 480, 480);
      x.strokeStyle = '#f85149'; x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round';
      for (const p of lu.vessels) { x.beginPath(); p.forEach(([a, b], i) => i ? x.lineTo(a * k, b * k) : x.moveTo(a * k, b * k)); x.stroke(); }
      lu.types.forEach((t, j) => { if (!show[j]) return; x.fillStyle = t.color; for (const [a, b] of t.pts) { x.beginPath(); x.arc(a * k, b * k, 2.8, 0, 7); x.fill(); } });
      x.fillStyle = '#fff'; x.fillRect(470 - 100 * k, 462, 100 * k, 3); x.font = '11px sans-serif'; x.fillText('100 µm', 470 - 100 * k, 456);
    }
    function run() {
      const t = lu.types[sel], r = L.rng(seed * 101 + sel * 7 + nsim), R = 150, step = 2, nr = R / step + 1;
      const cdf = ds => { const c = new Float32Array(nr); for (const d of ds) { const k = Math.ceil(d / step); if (k < nr) c[k]++; } for (let k = 1; k < nr; k++) c[k] += c[k - 1]; return c.map(v => v / ds.length); };
      const obsD = t.pts.map(([a, b]) => lu.dAt(a, b)), obs = cdf(obsD), lo = new Float32Array(nr).fill(1), hi = new Float32Array(nr), mean = new Float32Array(nr), means = [];
      for (let s = 0; s < nsim; s++) {
        const ds = []; for (let i = 0; i < t.pts.length; i++) ds.push(lu.dAt(r() * S, r() * S));
        const c = cdf(ds); for (let k = 0; k < nr; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); mean[k] += c[k] / nsim; }
        means.push(ds.reduce((a, b) => a + b, 0) / ds.length);
      }
      const om = obsD.reduce((a, b) => a + b, 0) / obsD.length, mm = means.reduce((a, b) => a + b, 0) / nsim;
      const p = (1 + means.filter(v => Math.abs(v - mm) >= Math.abs(om - mm)).length) / (nsim + 1);
      const x = cC.getContext('2d'), ax = chartAxes(x, cC.width, cC.height, { l: 40, r: 10, t: 12, b: 24 }, 0, R, 0, 1, '最寄りの血管までの距離 r [µm]', '', 25, 0.25, v => (v * 100) + '%');
      x.fillStyle = 'rgba(139,148,158,.35)'; x.beginPath();
      for (let k = 0; k < nr; k++) x.lineTo(ax.X(k * step), ax.Y(hi[k])); for (let k = nr - 1; k >= 0; k--) x.lineTo(ax.X(k * step), ax.Y(lo[k])); x.fill();
      x.setLineDash([4, 4]); x.strokeStyle = css('--mut'); x.lineWidth = 1.5; x.beginPath(); mean.forEach((v, k) => k ? x.lineTo(ax.X(k * step), ax.Y(v)) : x.moveTo(ax.X(0), ax.Y(v))); x.stroke(); x.setLineDash([]);
      x.strokeStyle = t.color; x.lineWidth = 2.5; x.beginPath(); obs.forEach((v, k) => k ? x.lineTo(ax.X(k * step), ax.Y(v)) : x.moveTo(ax.X(0), ax.Y(v))); x.stroke();
      x.fillStyle = css('--fg'); x.font = '12px sans-serif'; x.fillText(`${t.name}(実線) / ランダム ${nsim}回の幅(灰)と平均(点線)`, 48, 26);
      res.innerHTML = `${t.name}: 平均距離 <b>${om.toFixed(1)} µm</b>(ランダムの平均 ${mm.toFixed(1)} µm、幅 ${Math.min(...means).toFixed(1)}〜${Math.max(...means).toFixed(1)})。モンテカルロ検定 p = ${p.toFixed(3)}`;
    }
    ws.append(
      pane('組織の地図(赤=血管)', row(...lu.types.map((t, j) => h('label', { style: 'display:inline-flex;gap:4px;align-items:center' },
        h('input', { type: 'checkbox', checked: '', onchange: e => { show[j] = e.target.checked; drawMap(); } }), h('span', { style: `color:${t.color}` }, '●'), t.name))), cMap),
      pane('最寄りの血管までの距離 × ランダム配置との比較',
        row('細胞の種類', select(lu.types.map((t, j) => [j, t.name]), sel, v => sel = +v),
          'シミュレーション回数', select([[19, '19回'], [99, '99回'], [199, '199回']], nsim, v => nsim = +v),
          h('button', { class: 'pri', onclick: run }, '計算')), cC, res));
    drawMap(); chartAxes(cC.getContext('2d'), cC.width, cC.height, { l: 40, r: 10, t: 12, b: 24 }, 0, 150, 0, 1, '最寄りの血管までの距離 r [µm]', '', 25, 0.25, v => (v * 100) + '%');
    const opts = [['', '選ぶ'], ['near', '血管の近くに偏る'], ['random', 'ランダム'], ['avoid', '血管を避ける']];
    const sels = lu.types.map(t => { const s = select(opts, '', () => {}); ans.append(h('label', {}, h('span', { style: `color:${t.color}` }, '●'), t.name, s)); return s; });
    ans.append(h('button', { class: 'pri', onclick: () => {
      if (sels.some(s => !s.value)) return api.ng('3種類すべて選んでください。');
      const wrong = lu.types.filter((t, j) => sels[j].value !== t.truth).map(t => t.name);
      if (!wrong.length) api.clear('クリア。3種類とも正しく判定できました。');
      else api.ng(`違うもの: ${wrong.join('、')}`);
    } }, '判定'));
  },
});

// 7. 接触解析と群比較
TASKS.push({
  id: 'contact', no: 7, theme: 'β細胞', title: 'ミトコンドリアとERの接触は減ったか',
  tech: ['空間統計解析', '画像処理'], level: 3,
  lead: '高グルコースにさらしたβ細胞で、ミトコンドリアと小胞体(ER)の接触が減るかを、細胞単位で検定する。',
  intro: `<p>膵β細胞のインスリンの合成と分泌は、オルガネラどうしの連携に支えられている。その一つが、ミトコンドリアと小胞体(ER)が数十 nm まで近づく「接触部位」で、カルシウムや脂質のやりとりをする。</p>
<p>栄養状態(ここでは高グルコース)で接触が減るかを調べる。電顕画像から各細胞のミトコンドリアとERの位置は抽出済み。<b>接触の定義(何 nm 以内を接触とみなすか)</b>を決めて、細胞ごとの接触割合を出し、2群を比べる。</p>
<p>検定は並べ替え検定を使う。「群の名札を付け替えても、同じくらいの差が出るか」を、16細胞を8対8に分ける全12870通りで調べる。</p>
<p class="mut">データは模擬。各群8細胞。</p>`,
  goal: `<ol><li>接触の定義を 30 nm 以内としたときの、接触割合の平均の差(通常 − 高グルコース、%ポイント)を ±2 で答える。</li><li>その差は有意(p &lt; 0.05)か。</li><li>定義を 100 nm 以内に広げると、有意か。</li></ol>`,
  hints: ['距離は「ミトコンドリアの外膜」から「ERの膜(線)」まで。', '細胞ごとに割合を出してから比べる。ミトコンドリア1個ずつを独立に数えると、細胞の個体差を無視することになる。', '定義のスライダーを動かすと、点の並びがどう変わるか見てみる。'],
  mount(ws, ans, api, seed) {
    const st = L.makeContactStudy(seed), S = st.S; let d = 60, gi = 0, ci = 0;
    const cCell = cv(420, 420, ''), cStrip = cv(420, 260, 'chart'), res = h('div', { class: 'stat' });
    const dl = h('span', { class: 'stat' }, d + ' nm');
    function drawCell() {
      const cell = st.groups[gi].cells[ci], k = 420 / S, x = cCell.getContext('2d');
      x.fillStyle = '#10151c'; x.fillRect(0, 0, 420, 420);
      x.strokeStyle = '#39c5cf'; x.lineWidth = 2; x.lineJoin = 'round';
      for (const p of cell.er) { x.beginPath(); p.forEach(([a, b], i) => i ? x.lineTo(a * k, b * k) : x.moveTo(a * k, b * k)); x.stroke(); }
      let n = 0;
      for (const m of cell.mitos) {
        const c = m.gap <= d; if (c) n++;
        x.beginPath(); x.arc(m.x * k, m.y * k, m.R * k, 0, 7);
        x.fillStyle = c ? 'rgba(240,136,62,.55)' : 'rgba(139,148,158,.25)'; x.fill();
        x.strokeStyle = c ? '#f0883e' : '#8b949e'; x.lineWidth = c ? 2 : 1; x.stroke();
      }
      x.fillStyle = '#fff'; x.fillRect(410 - 500 * k, 404, 500 * k, 3); x.font = '11px sans-serif'; x.fillText('500 nm', 410 - 500 * k, 398);
      x.fillText(`接触 ${n} / ${cell.mitos.length}(${(100 * n / cell.mitos.length).toFixed(0)}%)`, 10, 18);
    }
    function drawStrip() {
      const x = cStrip.getContext('2d'), Wc = cStrip.width, Hc = cStrip.height;
      const ax = chartAxes(x, Wc, Hc, { l: 40, r: 10, t: 14, b: 22 }, 0, 2, 0, 1, '', '細胞ごとの接触割合', 0, 0.25, v => (v * 100) + '%');
      st.groups.forEach((g, j) => {
        const fs = g.cells.map(c => L.contactFrac(c, d)), mx = ax.X(j + 0.5), mean = fs.reduce((a, b) => a + b, 0) / fs.length;
        x.fillStyle = j ? '#a371f7' : '#58a6ff';
        fs.forEach((f, i) => { x.beginPath(); x.arc(mx + (i - 3.5) * 9, ax.Y(f), 4.5, 0, 7); x.fill(); });
        x.strokeStyle = css('--fg'); x.lineWidth = 2; x.beginPath(); x.moveTo(mx - 50, ax.Y(mean)); x.lineTo(mx + 50, ax.Y(mean)); x.stroke();
        x.fillStyle = css('--fg'); x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText(`${g.name.split('(')[0]} 平均 ${(mean * 100).toFixed(1)}%`, mx, Hc - 6); x.textAlign = 'left';
      });
    }
    const update = () => { drawCell(); drawStrip(); res.textContent = ''; };
    const cellSel = select(st.groups[0].cells.map((_, i) => [i, `細胞 ${i + 1}`]), 0, v => { ci = +v; drawCell(); });
    ws.append(
      pane('接触の定義', row('ミトコンドリア外膜とERの距離が', range(5, 150, 1, d, v => { d = v; dl.textContent = v + ' nm'; update(); }), dl, '以内なら接触')),
      h('div', { class: 'figs' },
        pane('細胞を見る(橙=接触しているミトコンドリア、水色=ER)', row(select(st.groups.map((g, j) => [j, g.name]), 0, v => { gi = +v; drawCell(); }), cellSel), cCell),
        pane('2群の比較(点=細胞1つ、横線=平均)', cStrip, row(h('button', { class: 'pri', onclick: () => {
          const a = st.groups[0].cells.map(c => L.contactFrac(c, d)), b = st.groups[1].cells.map(c => L.contactFrac(c, d)), t = L.permTest(a, b);
          res.innerHTML = `定義 ${d} nm: 差 ${(t.diff * 100).toFixed(1)} ポイント、p = ${t.p.toFixed(4)}(${t.N}通り中)`;
        } }, '並べ替え検定')), res)));
    update();
    const truth = dd => { const a = st.groups[0].cells.map(c => L.contactFrac(c, dd)), b = st.groups[1].cells.map(c => L.contactFrac(c, dd)); return L.permTest(a, b); };
    const t30 = truth(30), t100 = truth(100);
    const iDiff = h('input', { type: 'number', step: 0.1 }), yn = () => select([['', '選ぶ'], ['y', '有意(p<0.05)'], ['n', '有意でない']], '', () => {});
    const s30 = yn(), s100 = yn();
    ans.append(h('label', {}, '① 30 nm での差', iDiff, 'ポイント'), h('label', {}, '② 30 nm で', s30), h('label', {}, '③ 100 nm で', s100),
      h('button', { class: 'pri', onclick: () => {
        if (!iDiff.value || !s30.value || !s100.value) return api.ng('3つとも答えてください。');
        const ok1 = Math.abs(+iDiff.value - t30.diff * 100) <= 2, ok2 = (s30.value === 'y') === (t30.p < 0.05), ok3 = (s100.value === 'y') === (t100.p < 0.05);
        if (ok1 && ok2 && ok3) api.clear(`クリア。30 nm: 差 ${(t30.diff * 100).toFixed(1)} ポイント, p = ${t30.p.toFixed(4)}。100 nm: p = ${t100.p.toFixed(4)}。接触の定義しだいで結論が変わることがある。`);
        else api.ng(`違うもの: ${[ok1 ? '' : '①', ok2 ? '' : '②', ok3 ? '' : '③'].filter(Boolean).join(' ')}`);
      } }, '判定'));
  },
});

// ---------- 看板 ----------
const STATUS = { todo: ['未着手', 'b-todo'], doing: ['挑戦中', 'b-doing'], clear: ['クリア', 'b-clear'] };
let leave = [];
function showBoard() {
  leave.forEach(f => f()); leave = [];
  $('#back').style.display = 'none'; $('#title').textContent = '画像解析タスク看板';
  const nc = TASKS.filter(t => rec(t.id).status === 'clear').length;
  $('#sub').textContent = `クリア ${nc} / ${TASKS.length}`;
  const m = $('#main'); m.innerHTML = '';
  const lanes = [['todo', '未着手'], ['doing', '挑戦中'], ['clear', 'クリア']];
  for (const [k, name] of lanes) {
    const ts = TASKS.filter(t => rec(t.id).status === k); if (!ts.length) continue;
    m.append(h('section', { class: 'lane' }, h('h2', {}, `${name}(${ts.length})`), h('div', { class: 'grid' }, ts.map(card))));
  }
  m.append(h('p', { class: 'mut' }, 'データはすべてブラウザの中で作った模擬データ。進み具合はこのブラウザに保存される。'));
}
function card(t) {
  const s = rec(t.id), [sl, sc] = STATUS[s.status];
  return h('div', { class: 'card', onclick: () => { location.hash = t.id; } },
    h('div', { class: 'meta' }, h('span', { class: 'no' }, `TASK ${String(t.no).padStart(2, '0')} · ${t.theme}`), h('span', { class: 'badge ' + sc }, sl)),
    h('h3', {}, t.title), h('p', {}, t.lead),
    h('div', { class: 'meta' }, h('div', { class: 'tags' }, t.tech.map(x => h('span', { class: 'tag' }, x))), h('span', { class: 'lv', title: '難しさ' }, '★'.repeat(t.level) + '☆'.repeat(3 - t.level))));
}
function showTask(t) {
  leave.forEach(f => f()); leave = [];
  const s = rec(t.id); if (s.status === 'todo') { s.status = 'doing'; save(); }
  $('#back').style.display = ''; $('#title').textContent = `TASK ${String(t.no).padStart(2, '0')}`; $('#sub').textContent = t.title;
  const m = $('#main'); m.innerHTML = '';
  const msg = h('div', { class: 'msg' }), ansBox = h('div', { class: 'ans' }), ws = h('div', { class: 'ws' });
  const badge = h('span', { class: 'badge ' + STATUS[s.status][1] }, STATUS[s.status][0]);
  const api = {
    clear(text) { msg.className = 'msg ok'; msg.textContent = text; s.status = 'clear'; save(); badge.className = 'badge b-clear'; badge.textContent = 'クリア'; },
    ng(text) { msg.className = 'msg ng'; msg.textContent = text; },
    hide() { msg.className = 'msg'; },
    onLeave(f) { leave.push(f); },
  };
  m.append(h('div', { class: 'task' },
    h('aside', { class: 'brief' },
      h('div', { class: 'meta' }, h('span', { class: 'mut' }, t.theme + ' · ' + t.tech.join(' / ')), badge),
      h('h2', {}, t.title),
      h('h3', {}, '背景'), h('div', { html: t.intro }),
      h('h3', {}, '課題'), h('div', { class: 'goal', html: t.goal }),
      h('details', {}, h('summary', {}, 'ヒント'), h('ul', {}, t.hints.map(x => h('li', { html: x })))),
      h('h3', {}, '回答'), ansBox, msg,
      h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { onclick: () => { s.seed++; save(); showTask(t); } }, '別のデータで解き直す'), h('span', { class: 'mut' }, `データ番号 ${s.seed}`))),
    ws));
  t.mount(ws, ansBox, api, s.seed);
  window.scrollTo(0, 0);
}
function route() { const t = TASKS.find(x => x.id === location.hash.slice(1)); t ? showTask(t) : showBoard(); }
$('#back').addEventListener('click', () => { location.hash = ''; });
window.addEventListener('hashchange', route);
route();
