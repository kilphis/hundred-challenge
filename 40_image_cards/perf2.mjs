// 計測(トレース版): node perf2.mjs [定常の秒=2.5] [幅=1280] [高さ=800]
// Chrome のトレースから、フレーム数・メインスレッド(BeginMainFrame)・合成(DrawAndSwap)・GPU(CrGpuMain)の実時間を、
// 「切替直後 1.2 秒」と「その後の定常」に分けて集計する。単語ごと、CSS の候補を外した版、gallery.html も測る。結果は perf2.md。
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SEC = +(process.argv[2] || 2.5), W = +(process.argv[3] || 1280), H = +(process.argv[4] || 800), SW = 1.2;
const dir = path.dirname(new URL(import.meta.url).pathname);
const port = 9300 + Math.floor(Math.random() * 400);
const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "perf-"))}`, `--window-size=${W},${H}`, "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tab; for (let k = 0; k < 50 && !tab; k++) { try { tab = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page"); } catch {} if (!tab) await sleep(200); }
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));
let id = 0; const pend = new Map(); let events = [], onDone;
ws.onmessage = m => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result ?? d); pend.delete(d.id); }
  else if (d.method === "Tracing.dataCollected") events.push(...d.params.value);
  else if (d.method === "Tracing.tracingComplete") onDone(); };
const send = (method, params = {}) => new Promise(r => { pend.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

async function load(url, dpr = 2, css = "") {
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: dpr, mobile: false });
  await send("Page.navigate", { url }); await sleep(1800);
  if (css) await ev(`(()=>{ const s=document.createElement("style"); s.textContent=${JSON.stringify(css)}; document.head.appendChild(s); return 1 })()`);
}
// trigger() を実行した瞬間から SEC 秒トレースして、切替直後/定常に分けて集計
async function trace(trigger, sec = SEC) {
  events = []; const fin = new Promise(r => (onDone = r));
  await send("Tracing.start", { categories: "benchmark,cc,viz,gpu,devtools.timeline", transferMode: "ReportEvents" });
  const t0 = performance.now(); if (trigger) await ev(trigger);
  await sleep((sec + SW) * 1000); await send("Tracing.end"); await fin;
  const thr = {}; for (const e of events) if (e.ph === "M" && e.name === "thread_name") thr[e.pid + ":" + e.tid] = e.args.name;
  const X = events.filter(e => e.ph === "X").map(e => ({ th: thr[e.pid + ":" + e.tid] || "?", n: e.name, ts: e.ts / 1000, d: (e.dur || 0) / 1000 }));
  const frames = X.filter(e => e.th === "VizCompositorThread" && e.n === "Display::DrawAndSwap");
  if (!frames.length) return null;
  const start = frames[0].ts;
  const win = (lo, hi) => {
    const f = e => e.ts - start >= lo * 1000 && e.ts - start < hi * 1000, len = hi - lo;
    const sum = (th, n) => X.filter(e => e.th === th && e.n === n && f(e)).reduce((a, e) => a + e.d, 0);
    const fr = frames.filter(f), main = X.filter(e => e.th === "CrRendererMain" && e.n === "ProxyMain::BeginMainFrame" && f(e));
    return { fps: fr.length / len, main: sum("CrRendererMain", "ProxyMain::BeginMainFrame") / len / 10, mainMax: Math.max(0, ...main.map(e => e.d)),
      draw: sum("VizCompositorThread", "Display::DrawAndSwap") / len / 10, drawMax: Math.max(0, ...fr.map(e => e.d)),
      gpu: sum("CrGpuMain", "Scheduler::RunTask") / len / 10, raster: sum("CrGpuMain", "RasterDecoderImpl::DoEndRasterCHROMIUM") / len / 10 };
  };
  return { sw: win(0, SW), st: win(SW, SW + sec) };
}
const f1 = (x, n = 1) => (x == null ? "-" : x.toFixed(n));
const base = pathToFileURL(path.join(dir, "index.html")).href;

await load(`${base}?no=551`);
const nos = await ev(`Object.keys(DEFS)`);
const sw = n => `(()=>{ i=deck.findIndex(w=>w.no==="${n}"); show(); })()`;
const T0 = performance.now();

// --- 0. 何も動かない状態(基準) ---
console.error("基準…"); await load(`${base}?no=551`); await ev(`stage.clear(); document.querySelector("#word").innerHTML=""; 1`); await sleep(500);
const idle = await trace(null);

// --- 1. 全単語 ---
const all = [];
for (const n of nos) { console.error("語", n); await load(`${base}?no=551`); const r = await trace(sw(n)); const fx = await ev(`DEFS[${n}].fx`); if (r) all.push({ no: n, fx, ...r }); }
const score = r => r.st.draw + r.st.gpu; // 定常の 合成+GPU
all.sort((a, b) => score(b) - score(a));

// --- 2. 変種(上位3+中央+最軽量) ---
const sample = [...all.slice(0, 3), all[Math.floor(all.length / 2)], all[all.length - 1]].map(x => x.no);
const variants = {
  "そのまま": ["", 2],
  "backdrop-filter なし": [".pill,.back{backdrop-filter:none!important}", 2],
  "ノイズ(overlay)なし": [".bg::after{display:none!important}", 2],
  "背景の saturate なし": [".bg{filter:none!important}", 2],
  "ビネットなし": [".stage::after{display:none!important}", 2],
  "文字の text-shadow なし": [".word{text-shadow:none!important}", 2],
  "DPR 1": ["", 1],
  "全部なし(DPR1含む)": [".pill,.back{backdrop-filter:none!important}.bg::after,.stage::after{display:none!important}.bg{filter:none!important}.word{text-shadow:none!important}", 1],
};
const vres = {};
for (const [name, [css, dpr]] of Object.entries(variants)) {
  vres[name] = [];
  for (const n of sample) { console.error("変種", name, n); await load(`${base}?no=551`, dpr, css); vres[name].push(await trace(sw(n))); }
}

// --- 3. gallery(50枠同時) ---
console.error("gallery…");
const gal = {};
for (const dpr of [2, 1]) { await load(pathToFileURL(path.join(dir, "gallery.html")).href, dpr); gal[dpr] = await trace(null, 3); }

// --- 出力 ---
const row = (w) => `${f1(w.fps)} | ${f1(w.main)} | ${f1(w.mainMax)} | ${f1(w.draw)} | ${f1(w.drawMax)} | ${f1(w.gpu)} | ${f1(w.raster)}`;
const hdr = `| fps | main% | main最大ms | 合成% | 合成最大ms | GPU% | ラスタ% |\n|---|---|---|---|---|---|---|`;
let md = `# day40 動作計測(トレース版 / Chrome headless ${W}x${H}, DPR2)\n\n`;
md += `ヘッドレスなので数字は実機と一致しない。%は壁時間に対する各スレッドの使用率(100%=1コア全部)。切替直後=単語を切り替えて最初の${SW}秒、定常=その後${SEC}秒。\n\n`;
md += `## 基準(何も動かない画面)\n\n${hdr.replace("| fps", "| 区間 | fps")}\n| 定常 | ${row(idle.st)} |\n\n`;
md += `## 単語ごと(定常の 合成%+GPU% が大きい順)\n\n| No | fx | 切替fps | 切替main最大ms | 切替合成最大ms | 定常fps | main% | 合成% | 合成最大ms | GPU% | ラスタ% |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of all) md += `| ${r.no} | ${r.fx} | ${f1(r.sw.fps)} | ${f1(r.sw.mainMax)} | ${f1(r.sw.drawMax)} | ${f1(r.st.fps)} | ${f1(r.st.main)} | ${f1(r.st.draw)} | ${f1(r.st.drawMax)} | ${f1(r.st.gpu)} | ${f1(r.st.raster)} |\n`;
md += `\n## CSS の候補を外した比較(定常の 合成%+GPU%、括弧内は切替直後の fps)\n\n| 語 | ${Object.keys(variants).join(" | ")} |\n|---|${Object.keys(variants).map(() => "---").join("|")}|\n`;
sample.forEach((n, k) => { md += `| ${n} (${all.find(a => a.no === n).fx}) | ${Object.keys(variants).map(v => { const r = vres[v][k]; return r ? `${f1(r.st.draw + r.st.gpu)} (${f1(r.sw.fps, 0)})` : "-"; }).join(" | ")} |\n`; });
md += `\n## gallery.html(50枠同時、定常)\n\n${hdr.replace("| fps", "| DPR | fps")}\n| 2 | ${row(gal[2].st)} |\n| 1 | ${row(gal[1].st)} |\n`;
writeFileSync(path.join(dir, "perf2.md"), md); console.log(md);
console.error(`所要 ${((performance.now() - T0) / 1000).toFixed(0)} 秒`);
ws.close(); proc.kill();
