// node tools/check.js : tda.js の結果を ripser(tools/ref.json)と突き合わせる
const fs = require("fs"), TDA = require("../tda.js");
global.window = {}; eval(fs.readFileSync(__dirname + "/../data.js", "utf8"));
const ref = JSON.parse(fs.readFileSync(__dirname + "/ref.json", "utf8").replace(/Infinity/g, "null"));
// ripser は float32 なので 1e-5 の誤差を許して貪欲に対応づける
const key = bs => bs.filter(([b, d]) => d - b > 1e-5).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
const near = (x, y) => Math.abs(x[0] - y[0]) < 1e-5 && (x[1] === y[1] || Math.abs(x[1] - y[1]) < 1e-5);
function match(a, b) { const used = new Uint8Array(b.length), miss = [];
  for (const x of a) { const i = b.findIndex((y, k) => !used[k] && near(x, y)); if (i < 0) miss.push(x); else used[i] = 1; }
  return { miss, extra: b.filter((_, k) => !used[k]) }; }
let ok = true;
for (const s of window.DATASETS) {
  const t0 = Date.now(), r = TDA.build(s.points), ms = Date.now() - t0;
  for (const [dim, mine] of [[0, r.h0], [1, r.h1]]) {
    const a = key(mine.map(x => [x.birth, x.death])), b = key(ref[s.id][dim].map(([x, y]) => [x, y === null ? Infinity : y]));
    const { miss, extra } = match(a, b), same = !miss.length && !extra.length;
    if (!same) { ok = false; console.log("  diff", s.id, "H" + dim, miss.slice(0, 5), extra.slice(0, 5)); }
    console.log(s.id, "H" + dim, a.length, "bars", same ? "一致" : "不一致");
  }
  console.log(`  ${s.id}: n=${r.n} edges=${r.m} tris=${r.nt} enc=${r.enc.toFixed(3)} ${ms}ms`);
}
process.exit(ok ? 0 : 1);
