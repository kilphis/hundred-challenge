// 計測: node perf.mjs [秒/効果=3] [幅=1280] [高さ=800]
// ヘッドレス Chrome を CDP で操作し、単語ごとに「rAF の間隔(fps)・長いフレーム・JS/レイアウト/スタイル/描画の時間」を測る。
// 続けて CSS の重い候補を外した版(?x=...)で基準の単語を測り、差を出す。結果は perf.md に書く。
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SEC = +(process.argv[2] || 3), W = +(process.argv[3] || 1280), H = +(process.argv[4] || 800);
const dir = path.dirname(new URL(import.meta.url).pathname);
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 400);
const proc = spawn(CH, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "perf-"))}`,
  `--window-size=${W},${H}`, "--hide-scrollbars", "--no-first-run", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tab; for (let k = 0; k < 50 && !tab; k++) { try { tab = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page"); } catch {} if (!tab) await sleep(200); }
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result ?? d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

await send("Page.enable"); await send("Performance.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: false });
const metrics = async () => Object.fromEntries((await send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));

// 1ページ読んで、効果ごとに SEC 秒測る。words=[no,...]。測定中は rAF の間隔を記録する。
async function run(url, words) {
  await send("Page.navigate", { url }); await sleep(1500);
  await ev(`window.__lt=[]; try{ new PerformanceObserver(l=>l.getEntries().forEach(e=>__lt.push(e.duration))).observe({entryTypes:["longtask"]}) }catch{}; 1`);
  const out = [];
  for (const no of words) {
    await ev(`(()=>{ const k=deck.findIndex(w=>w.no==="${no}"); if(k<0) return; i=k; show(); })()`);
    await sleep(600); // 初期化(粒子の読み込みなど)をならす
    await ev(`window.__lt.length=0; window.__d=[]; window.__run=true; let p=performance.now(); (function f(t){ if(!window.__run) return; __d.push(t-p); p=t; requestAnimationFrame(f) })(p); 1`);
    const m0 = await metrics(); const t0 = Date.now();
    await sleep(SEC * 1000);
    const m1 = await metrics(); const wall = (Date.now() - t0) / 1000;
    const r = await ev(`(()=>{ window.__run=false; const d=__d.slice(2).sort((a,b)=>a-b); const n=d.length, sum=d.reduce((a,b)=>a+b,0);
      return { n, fps: n/(sum/1000), p50: d[Math.floor(n*.5)], p95: d[Math.floor(n*.95)], max: d[n-1], slow: d.filter(x=>x>25).length,
        lt: __lt.reduce((a,b)=>a+b,0), el: document.querySelectorAll("#stage *").length, cv: document.querySelectorAll("#stage canvas").length,
        fx: (DEFS[${no}]||{}).fx } })()`);
    const pct = k => ((m1[k] - m0[k]) / wall) * 100; // 壁時間に対する % (1コア=100%)
    out.push({ no, ...r, js: pct("ScriptDuration"), layout: pct("LayoutDuration"), style: pct("RecalcStyleDuration"), task: pct("TaskDuration") });
  }
  return out;
}

const base = pathToFileURL(path.join(dir, "index.html")).href;
await send("Page.navigate", { url: base }); await sleep(1200);
const nos = await ev(`Object.keys(DEFS)`);
const f1 = (x, n = 1) => (x == null ? "-" : x.toFixed(n));

// --- 1. 全単語 ---
console.error(`全${nos.length}語 × ${SEC}秒 …`);
const all = await run(`${base}?no=${nos[0]}`, nos);
all.sort((a, b) => a.fps - b.fps);

// --- 2. CSS の候補を外して、同じ数語を測る(重かった上位+中央+軽い1つ) ---
const sample = [...all.slice(0, 3), all[Math.floor(all.length / 2)], all[all.length - 1]].map(x => x.no);
const variants = {
  "そのまま": "",
  "backdrop-filter なし": ".chrome .pill,.back{backdrop-filter:none!important}",
  "ノイズ(overlay)なし": "*::before,*::after{mix-blend-mode:normal!important;background-image:none!important}",
  "背景の filter なし": ".bg{filter:none!important}",
  "DPR 1(retina なし)": "",
};
const vres = {};
for (const [name, css] of Object.entries(variants)) {
  console.error(`変種: ${name}`);
  const dpr = name.startsWith("DPR 1") ? 1 : 2;
  vres[name] = await runInjected(css, dpr, sample);
}
async function runInjected(css, dpr, words) {
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: dpr, mobile: false });
  await send("Page.navigate", { url: `${base}?no=${words[0]}` }); await sleep(1500);
  if (css) await ev(`(()=>{ const s=document.createElement("style"); s.textContent=${JSON.stringify(css)}; document.head.appendChild(s); return 1 })()`);
  const out = [];
  for (const no of words) {
    await ev(`(()=>{ const k=deck.findIndex(w=>w.no==="${no}"); i=k; show(); })()`); await sleep(600);
    await ev(`window.__d=[]; window.__run=true; let p=performance.now(); (function f(t){ if(!window.__run) return; __d.push(t-p); p=t; requestAnimationFrame(f) })(p); 1`);
    await sleep(SEC * 1000);
    const r = await ev(`(()=>{ window.__run=false; const d=__d.slice(2).sort((a,b)=>a-b), n=d.length, s=d.reduce((a,b)=>a+b,0); return { fps:n/(s/1000), p95:d[Math.floor(n*.95)] } })()`);
    out.push({ no, ...r });
  }
  return out;
}

// --- 出力 ---
let md = `# day40 動作計測(Chrome headless ${W}x${H}, DPR2, ${SEC}秒/効果)\n\n`;
md += `※ヘッドレスなので実機のGPU描画と完全には一致しない。差(相対)を見る。fps は rAF 間隔の平均、p95 は遅い方から5%の境目。js/layout/style は1コアに対する%。\n\n`;
md += `## 全単語(fps の低い順)\n\n| No | fx | fps | p50ms | p95ms | max ms | 25ms超 | 長タスク ms | JS% | layout% | style% | DOM数 | canvas |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of all) md += `| ${r.no} | ${r.fx} | ${f1(r.fps)} | ${f1(r.p50)} | ${f1(r.p95)} | ${f1(r.max)} | ${r.slow} | ${f1(r.lt, 0)} | ${f1(r.js, 0)} | ${f1(r.layout, 0)} | ${f1(r.style, 0)} | ${r.el} | ${r.cv} |\n`;
const byFx = {}; for (const r of all) (byFx[r.fx] ??= []).push(r.fps);
md += `\n## fx 別の平均 fps\n\n| fx | 語数 | 平均fps |\n|---|---|---|\n`;
for (const [k, v] of Object.entries(byFx).sort((a, b) => a[1].reduce((x, y) => x + y) / a[1].length - b[1].reduce((x, y) => x + y) / b[1].length)) md += `| ${k} | ${v.length} | ${f1(v.reduce((x, y) => x + y) / v.length)} |\n`;
md += `\n## CSS の候補を外した比較(fps / p95ms)\n\n| 語 | ${Object.keys(variants).join(" | ")} |\n|---|${Object.keys(variants).map(() => "---").join("|")}|\n`;
sample.forEach((no, k) => { md += `| ${no} (${all.find(a => a.no === no).fx}) | ${Object.keys(variants).map(n => `${f1(vres[n][k].fps)} / ${f1(vres[n][k].p95)}`).join(" | ")} |\n`; });
writeFileSync(path.join(dir, "perf.md"), md); console.log(md);
ws.close(); proc.kill();
