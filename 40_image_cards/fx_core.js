// 舞台(Stage): 1つの枠(root)の中に「粒子(tsParticles)」「図形(GSAP)」「前面(fxtop)」を重ねる土台。
// 効果は FX.reg[名前] = c => {...} で登録する(fx_*.js)。単語→効果の対応は defs.js。
// gallery.html のように、枠を複数作って同時に動かせる。
gsap.ticker.lagSmoothing(0); // 撮影(仮想時間)でも実時間どおりに進める
const FX = { reg: {}, txt: {} };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const hsl2 = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)}, ${s}%, ${l}%)`;
const hsl = (h, s = 90, l = 62, a = 1) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;
let STAGE_SEQ = 0;
const TS_READY = loadFull(tsParticles); // 粒子の部品(動き・色・形・emitter など)を読み込む。これが無いと何も描かれない

class Stage {
  constructor(root, wordEl) {
    this.root = root; this.wordEl = wordEl; this.id = "tsp" + ++STAGE_SEQ; this.token = 0;
    root.insertAdjacentHTML("afterbegin",
      `<div class="bg"></div><div id="${this.id}" class="layer"></div><div class="layer fx"></div>`);
    root.insertAdjacentHTML("beforeend", `<div class="layer fxtop"></div>`);
    this.tsp = root.children[1]; this.fx = root.children[2]; this.top = root.querySelector(".fxtop");
  }
  clear() {
    this.token++;
    this.gctx && this.gctx.revert(); this.gctx = null;
    this.fx.innerHTML = ""; this.top.innerHTML = ""; this.tsp.style.filter = "";
    if (this.cont) { this.cont.destroy(); this.cont = null; }
    this.root.style.setProperty("--sat", 1);
  }
  // def = {fx, h(色相), a(効果ごとの数値), t(文字の動き), img(説明)}, word = 英単語
  play(def, word) {
    this.clear();
    const st = this, my = this.token, W = this.root.clientWidth, H = this.root.clientHeight;
    const hue = def.h ?? 220, a = def.a || {};
    const mk = (parent, css, x, y, w, h) => {
      const e = document.createElement("div");
      e.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;${css}`;
      parent.appendChild(e); gsap.set(e, { x: x - w / 2, y: y - h / 2 }); return e;
    };
    const c = {
      W, H, cx: W / 2, cy: H * 0.42, oy: H * 0.2, hue, a, fx: this.fx, top: this.top, root: this.root,
      alive: () => st.token === my,
      // 中心(x,y)に w×h の箱 / 半径 r の円 / SVG を置く
      box: (w, h, css = "", x = W / 2, y = H * 0.42) => mk(st.fx, css, x, y, w, h),
      dot: (r, color, x = W / 2, y = H * 0.42, css = "") => mk(st.fx, `border-radius:50%;background:${color};${css}`, x, y, r * 2, r * 2),
      svg: (inner, w, h, x = W / 2, y = H * 0.42, css = "") => {
        const e = mk(st.fx, css, x, y, w, h);
        e.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">${inner}</svg>`; return e;
      },
      pal: (...offs) => offs.map(o => hsl2(hue + o, 90, 64)), // tsParticles は hsl(色相 彩度% 明度%) の新しい書き方を読めないので、カンマ区切りで渡す
      // tsParticles: 粒子の設定(options の一部)を渡す。枠の中央は emitter 等で x:50,y:42 (%)
      particles(opts) {
        const base = { fullScreen: { enable: false }, pauseOnBlur: false, pauseOnOutsideViewport: false, background: { color: "transparent" }, detectRetina: true, fpsLimit: 60,
          particles: { number: { value: 0 }, move: { enable: true } } };
        TS_READY.then(() => tsParticles.load({ id: st.id, options: deepMerge(base, opts) })).then(ct => { if (!c.alive()) ct.destroy(); else st.cont = ct; });
      },
    };
    this.gctx = gsap.context(() => {
      c.tl = gsap.timeline();
      (FX.reg[def.fx] || FX.reg.drift)(c);
      const chars = this.setWord(word);
      (FX.txt[def.t] || FX.txt.rise)(chars, c);
    }, this.root);
    gsap.to(this.root, { "--h": hue, duration: 0.8, ease: "power2.out" });
  }
  setWord(word) {
    this.wordEl.innerHTML = [...word].map(ch => `<span class="ch">${ch === " " ? "&nbsp;" : ch}</span>`).join("");
    return [...this.wordEl.children];
  }
}

function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== "object" || b === null) return b;
  const o = { ...a };
  for (const k in b) o[k] = k in a && typeof a[k] === "object" && !Array.isArray(a[k]) ? deepMerge(a[k], b[k]) : b[k];
  return o;
}

// ---- 文字の動き(t) ----
FX.txt.rise = (ch, c) => gsap.from(ch, { y: 70, opacity: 0, duration: 0.8, stagger: 0.05, ease: "back.out(1.7)" });
FX.txt.drop = (ch, c) => gsap.from(ch, { y: -c.H * 0.6, opacity: 0, duration: 0.9, stagger: 0.04, ease: "bounce.out" });
FX.txt.blur = (ch, c) => gsap.from(ch, { filter: "blur(24px)", opacity: 0, scale: 1.4, duration: 1.1, stagger: 0.06, ease: "power2.out" });
FX.txt.zoom = (ch, c) => gsap.from(ch, { scale: 4, opacity: 0, duration: 0.7, stagger: 0.03, ease: "expo.out" });
FX.txt.flip = (ch, c) => gsap.from(ch, { rotationX: 90, opacity: 0, transformOrigin: "50% 100%", duration: 0.8, stagger: 0.06, ease: "back.out(2)" });
FX.txt.slide = (ch, c) => gsap.from(ch, { x: -c.W * 0.25, skewX: -30, opacity: 0, duration: 0.7, stagger: 0.03, ease: "power4.out" });
FX.txt.type = (ch, c) => gsap.from(ch, { opacity: 0, duration: 0.01, stagger: 0.12, delay: 0.2 });
FX.txt.scramble = (ch, c) => {
  const set = "あアbxZ字ñ語λ#%ΩЖ", fin = ch.map(e => e.textContent);
  ch.forEach((e, i) => {
    const o = { n: 0 };
    gsap.to(o, { n: 1, duration: 1.1 + i * 0.07, ease: "none",
      onUpdate() { e.textContent = o.n < 1 ? pick([...set]) : fin[i]; }, onComplete() { e.textContent = fin[i]; } });
  });
};

// ---- 粒子の効果(tsParticles) ----
const baseDrift = (c, o) => c.particles({
  particles: {
    number: { value: o.n ?? 40 }, color: { value: o.colors ?? c.pal(0, 25, -25) }, shape: { type: o.shape ?? "circle" },
    size: { value: { min: o.s?.[0] ?? 2, max: o.s?.[1] ?? 6 } },
    opacity: { value: { min: o.op?.[0] ?? 0.2, max: o.op?.[1] ?? 0.8 }, animation: { enable: true, speed: 0.6, sync: false } },
    move: { enable: true, speed: o.speed ?? 0.8, direction: o.dir ?? "none", random: true, straight: false, outModes: { default: "out" } },
    ...(o.extra || {}),
  },
});
// drift: ふわふわ漂う粒。a={n,s:[最小,最大],op,speed,shape,dir,blur}
FX.reg.drift = c => { baseDrift(c, c.a); if (c.a.blur) c.root.querySelector(".layer").style.filter = `blur(${c.a.blur}px)`; };
// bokeh: ぼやけた大きな丸(generally)
FX.reg.bokeh = c => { baseDrift(c, { n: 14, s: [25, 70], op: [0.2, 0.5], speed: 0.4, ...c.a }); c.root.querySelector(".layer").style.filter = "blur(10px)"; };
// rise: 下から上へ浮く(relief)。a={n,shape}
FX.reg.rise = c => baseDrift(c, { n: 36, s: [4, 14], op: [0.15, 0.6], speed: 1.4, dir: "top", ...c.a });
// confetti: 中央から弾けて落ちる(reward)。a={n,shapes,gold}
FX.reg.confetti = c => c.particles({
  emitters: { position: { x: 50, y: 42 }, rate: { quantity: c.a.n ?? 70, delay: 0.1 }, life: { count: 1, duration: 0.1 }, size: { width: 0, height: 0 } },
  particles: {
    color: { value: c.a.gold ? ["#ffd54a", "#ffb300", "#fff2a8", "#ff9800"] : c.pal(0, 40, 80, -40, 160) },
    shape: { type: c.a.shapes ?? ["star", "circle", "square"] }, size: { value: { min: 4, max: 11 } },
    opacity: { value: { min: 0, max: 1 }, animation: { enable: true, speed: 0.5, startValue: "max", destroy: "min", sync: false } }, // 最小=最大だと即消えるので幅を持たせる
    rotate: { value: { min: 0, max: 360 }, animation: { enable: true, speed: 25 } },
    move: { enable: true, speed: { min: 8, max: 22 }, direction: "none", random: true, straight: false, decay: 0.06,
      gravity: { enable: true, acceleration: 14 }, outModes: { default: "destroy" } },
    life: { duration: { value: { min: 2.5, max: 4 } } },
  },
});
// coins: 金貨が降って底で跳ねる(paycheck)
FX.reg.coins = c => c.particles({
  emitters: { position: { x: 50, y: -5 }, rate: { quantity: 2, delay: 0.18 }, life: { count: 1, duration: 1.6 }, size: { width: 60, height: 0 } },
  particles: {
    color: { value: ["#ffd54a", "#ffc107", "#ffe082"] }, shape: { type: "circle" }, size: { value: { min: 9, max: 15 } },
    stroke: { width: 3, color: { value: "#b8860b" } },
    opacity: { value: 1, animation: { enable: true, speed: 0.15, startValue: "max", destroy: "min", sync: false, delay: 3 } },
    move: { enable: true, speed: { min: 3, max: 6 }, direction: "bottom", gravity: { enable: true, acceleration: 9 }, outModes: { default: "bounce", top: "none" }, random: true },
    bounce: { vertical: { value: { min: 0.35, max: 0.55 } } },
    life: { duration: { value: 5 } },
  },
});
// network: 点が線でつながる(consult)
FX.reg.network = c => c.particles({
  particles: {
    number: { value: c.a.n ?? 36 }, color: { value: c.pal(0, 30) }, size: { value: { min: 2, max: 5 } },
    opacity: { value: 0.8 }, links: { enable: true, distance: c.a.d ?? 140, color: hsl2(c.hue, 90, 70), opacity: 0.45, width: 1.2 },
    move: { enable: true, speed: 1.2, outModes: { default: "bounce" } },
  },
});
