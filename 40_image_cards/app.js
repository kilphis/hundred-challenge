// 単語帳の画面。出題順・めくり・キー操作だけ。効果の中身は fx_*.js、割り当ては defs.js。
const $ = id => document.getElementById(id);
const stage = new Stage($("stage"), $("word"));
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const FALLBACK = { fx: "drift", h: 220, t: "rise", img: "(未設定)ゆっくり漂う粒" };
let deck = [], i = 0, flipped = false, shuffle = false;

const params = new URLSearchParams(location.search); // ?no=574&flip=1 で特定の単語を直接開く(撮影用)

function start() {
  const lo = +$("lo").value, hi = +$("hi").value;
  deck = WORDS.filter(w => +w.no >= lo && +w.no <= hi);
  if (shuffle) deck.sort(() => Math.random() - 0.5);
  i = 0; show();
}
function show() {
  const w = deck[i]; if (!w) return;
  flipped = false; const def = DEFS[w.no] || FALLBACK;
  $("back").classList.add("hide"); $("hint").classList.remove("hide");
  $("prog").textContent = `${i + 1} / ${deck.length}  ·  No.${w.no}`;
  $("sub").innerHTML = `<span class="pos">${esc(w.pos)}</span>${esc(w.pron)}`;
  stage.play(def, w.word);
  gsap.fromTo("#sub", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.6 });
  document.documentElement.style.setProperty("--h", def.h);
}
function flip() {
  const w = deck[i]; if (!w || flipped) return;
  flipped = true; const def = DEFS[w.no] || FALLBACK;
  const en = esc(w.en_full).replace(esc(w.word), m => `<mark>${m}</mark>`);
  $("back").innerHTML = `<span class="img">イメージ：${esc(def.img)}</span><div class="mean">${esc(w.meaning)}<small>${esc(w.pos)}</small></div>` +
    `<div class="ja">${esc(w.ja)}</div><div class="en">${en}</div><div class="note">${esc(w.note)}</div>`;
  $("back").classList.remove("hide"); $("hint").classList.add("hide");
  gsap.fromTo("#back", { y: 60, opacity: 0, xPercent: -50 }, { y: 0, opacity: 1, xPercent: -50, duration: 0.6, ease: "power3.out" });
  gsap.fromTo("#back > *", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.07, delay: 0.15, ease: "power2.out" });
}
const go = d => { i = (i + d + deck.length) % deck.length; show(); };

$("go").onclick = start; $("next").onclick = () => go(1); $("prev").onclick = () => go(-1);
$("flip").onclick = () => (flipped ? go(1) : flip()); $("replay").onclick = show;
$("shuf").onclick = () => { shuffle = !shuffle; $("shuf").classList.toggle("on", shuffle); start(); };
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") { if (e.key === "Enter") { e.target.blur(); start(); } return; }
  if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === " " || e.key === "Enter") { e.preventDefault(); flipped ? go(1) : flip(); }
  else if (e.key === "r" || e.key === "R") show();
});

start();
if (params.get("no")) { i = Math.max(0, deck.findIndex(w => w.no === params.get("no"))); show(); if (params.get("flip")) flip(); }
