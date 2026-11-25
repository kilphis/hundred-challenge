// 図形の効果 その1(GSAP で動かす)。c = Stage.play が渡す道具箱(fx_core.js)。
// 座標: c.cx,c.cy = 単語の中心 / c.oy = 単語の上のあたり / c.W,c.H = 枠の大きさ
const U = c => Math.min(c.W, c.H); // 枠の短い辺。大きさはこれに比例させて、小さな枠でも崩れないようにする

// shine: 光の帯が単語を横切る(dealership)
FX.reg.shine = c => {
  const b = c.box(c.W * 0.18, c.H * 1.6, `background:linear-gradient(90deg,transparent,${hsl(c.hue, 20, 96, 0.7)},transparent);filter:blur(4px);mix-blend-mode:screen`, -c.W * 0.2, c.H / 2);
  gsap.set(b, { rotation: 22 });
  const g = c.box(c.W * 0.7, 2, `background:linear-gradient(90deg,transparent,${hsl(c.hue, 40, 90)},transparent);box-shadow:0 0 18px ${hsl(c.hue, 80, 70)}`, c.cx, c.cy + U(c) * 0.28);
  gsap.from(g, { scaleX: 0, duration: 1, ease: "expo.out" });
  c.tl.to(b, { x: c.W * 1.2, duration: 1.3, ease: "power2.inOut", repeat: -1, repeatDelay: 1.2 });
};

// flutter: ひらひら舞い落ちる布/葉(garment, resign)。a={shape:"ribbon"|"leaf", n, desat}
FX.reg.flutter = c => {
  const n = c.a.n ?? 14, leaf = c.a.shape === "leaf";
  for (let i = 0; i < n; i++) {
    const w = leaf ? rnd(14, 26) : rnd(6, 10), h = leaf ? w : rnd(60, 130);
    const e = c.box(w, h, `background:${hsl(c.hue + rnd(-30, 30), leaf ? 55 : 85, leaf ? 52 : 74, 0.9)};border-radius:${leaf ? "0 100% 0 100%" : "40px"};opacity:.9`, rnd(0, c.W), -h);
    gsap.to(e, { y: c.H + h, duration: rnd(5, 9), delay: rnd(0, 6), repeat: -1, ease: "none" });
    gsap.to(e, { x: `+=${rnd(-80, 80)}`, rotation: rnd(-70, 70), duration: rnd(1.2, 2.4), repeat: -1, yoyo: true, ease: "sine.inOut" });
  }
  if (c.a.desat) gsap.to(c.root, { "--sat": 0.25, duration: 1.6 });
};

// gears: 2つの歯車がかみ合って回る(implement)
const gearPath = (r, teeth) => {
  const u = (Math.PI * 2) / teeth, rin = r * 0.82, pts = [];
  for (let t = 0; t < teeth; t++) for (const [f, k] of [[0, rin], [0.12, r], [0.38, r], [0.5, rin]]) {
    const a = (t + f) * u; pts.push(`${(r * 1.05 + k * Math.cos(a)).toFixed(1)},${(r * 1.05 + k * Math.sin(a)).toFixed(1)}`);
  } return pts.join(" ");
};
FX.reg.gears = c => {
  const r = U(c) * 0.2, s = r * 2.1, col = hsl(c.hue, 80, 68);
  const mk = (x, y, dir, off) => {
    const g = c.svg(`<polygon points="${gearPath(r, 12)}" fill="${hsl(c.hue, 80, 60, 0.12)}" stroke="${col}" stroke-width="3" stroke-linejoin="round"/><circle cx="${s / 2}" cy="${s / 2}" r="${r * 0.3}" fill="none" stroke="${col}" stroke-width="3"/>`, s, s, x, y, `filter:drop-shadow(0 0 10px ${col})`);
    gsap.set(g, { rotation: off }); gsap.from(g, { scale: 0, opacity: 0, duration: 0.8, ease: "back.out(2)" });
    gsap.to(g, { rotation: off + dir * 360, duration: 8, repeat: -1, ease: "none" });
  };
  mk(c.cx - r * 0.98, c.cy, 1, 0); mk(c.cx + r * 0.98, c.cy, -1, 15);
};

// swap: 入れ替わる(substitute=片方が抜けて別のが入る / transaction=お互いに交換)。a={mode:"replace"|"exchange"}
FX.reg.swap = c => {
  const r = U(c) * 0.06, y = c.oy, d = U(c) * 0.22, A = c.dot(r, hsl(c.hue, 90, 62), c.cx - d, y, `box-shadow:0 0 22px ${hsl(c.hue, 90, 60)}`),
    B = c.dot(r, hsl(c.hue + 150, 90, 62), c.cx + d, y, `box-shadow:0 0 22px ${hsl(c.hue + 150, 90, 60)}`);
  if (c.a.mode === "exchange") {
    const arc = (e, x1, up) => { const t = c.tl; t.to(e, { x: x1 - r, duration: 1, ease: "power2.inOut" }, 0); t.to(e, { y: y - r + up, duration: 0.5, ease: "sine.out", yoyo: true, repeat: 1 }, 0); };
    arc(A, c.cx + d, -r * 2.2); arc(B, c.cx - d, r * 2.2);
    c.tl.repeat(-1).yoyo(true).repeatDelay(0.6);
  } else {
    gsap.set(B, { x: c.cx - d - r, y: y - r - U(c) * 0.3, opacity: 0 });
    c.tl.to(A, { y: y - r + U(c) * 0.28, opacity: 0, scale: 0.4, duration: 0.7, ease: "power2.in" }, 0.2)
      .to(B, { y: y - r, opacity: 1, duration: 0.8, ease: "bounce.out" }, 0.7).to([A, B], { opacity: 0, duration: 0.5 }, 2.6)
      .set(A, { y: y - r, scale: 1 }).set(B, { y: y - r - U(c) * 0.3 }).to(A, { opacity: 1, duration: 0.4 }).repeat(-1);
  }
};

// grid: 同じ点が整然と並び、波のように呼吸する(typically)
FX.reg.grid = c => {
  const cols = 11, rows = 5, gap = U(c) * 0.085, dots = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
    dots.push(c.dot(2.5, hsl(c.hue, 70, 78, 0.9), c.cx + (i - (cols - 1) / 2) * gap * 1.5, c.cy + (j - (rows - 1) / 2) * gap));
  gsap.from(dots, { scale: 0, opacity: 0, duration: 0.5, stagger: { each: 0.02, from: "center", grid: [cols, rows] } });
  gsap.to(dots, { scale: 2.2, opacity: 0.35, duration: 0.9, delay: 1, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: { each: 0.06, from: "center", grid: [cols, rows] } });
};

// stamp: 判子がドンと押される(authorize)
FX.reg.stamp = c => {
  const s = U(c) * 0.3, col = hsl(c.hue, 85, 55), x = c.cx + c.W * 0.22, y = c.cy + U(c) * 0.12;
  const seal = c.svg(`<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 4}" fill="none" stroke="${col}" stroke-width="6"/><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 16}" fill="none" stroke="${col}" stroke-width="2"/><text x="50%" y="56%" text-anchor="middle" font-size="${s * 0.3}" font-weight="900" fill="${col}" font-family="Hiragino Mincho ProN,serif">承認</text>`, s, s, x, y, "opacity:0");
  gsap.set(seal, { rotation: -14 });
  const dust = c.dot(s * 0.5, "transparent", x, y, `border:3px solid ${col};opacity:0`);
  c.tl.to(seal, { opacity: 0.95, duration: 0.05 }, 0.5).from(seal, { scale: 3.2, duration: 0.25, ease: "power4.in" }, 0.5)
    .fromTo(dust, { scale: 0.6, opacity: 0.8 }, { scale: 2.4, opacity: 0, duration: 0.7, ease: "power2.out" }, 0.75)
    .fromTo(c.root, { x: 0, y: 8 }, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,.25)", clearProps: "transform" }, 0.75);
};

// twin: 同じ大きさの2つの円が並んで釣り合う(comparable)
FX.reg.twin = c => {
  const r = U(c) * 0.075, y = c.oy, g = r * 1.15, mk = (x, k) => c.dot(r, "transparent", x, y, `border:4px solid ${hsl(c.hue + k, 90, 66)};box-shadow:0 0 24px ${hsl(c.hue + k, 90, 55, 0.6)}, inset 0 0 20px ${hsl(c.hue + k, 90, 55, 0.4)}`);
  const A = mk(c.cx - c.W * 0.5, 0), B = mk(c.cx + c.W * 0.5, 40);
  c.tl.to(A, { x: c.cx - g - r, duration: 0.9, ease: "power3.out" }).to(B, { x: c.cx + g - r, duration: 0.9, ease: "power3.out" }, 0);
  for (const dy of [-r * 0.28, r * 0.28]) {
    const bar = c.box(r * 0.7, 4, `background:${hsl(c.hue, 40, 90)};border-radius:2px;opacity:0`, c.cx, y + dy);
    c.tl.to(bar, { opacity: 1, duration: 0.3 }, 0.8);
  }
  gsap.to([A, B], { scale: 1.12, duration: 0.7, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1 });
};

// follow: 先頭の点に、みんながついていく(initiative)
FX.reg.follow = c => {
  const n = 16, pos = t => ({ x: c.W * (0.08 + 0.84 * t), y: c.oy + Math.sin(t * Math.PI * 3) * U(c) * 0.06 });
  for (let i = 0; i < n; i++) {
    const lead = i === 0, e = c.dot(lead ? 11 : 6 - i * 0.18, lead ? hsl(c.hue, 95, 75) : hsl(c.hue, 80, 65, 1 - i * 0.05), 0, 0, lead ? `box-shadow:0 0 24px ${hsl(c.hue, 95, 65)}` : ""), o = { t: 0 };
    const r = lead ? 11 : 6 - i * 0.18;
    gsap.to(o, { t: 1, duration: 3.2, delay: i * 0.1, ease: "power1.inOut", repeat: -1, repeatDelay: 0.6,
      onUpdate() { const p = pos(o.t); gsap.set(e, { x: p.x - r, y: p.y - r }); } });
  }
};

// target: 輪が縮んで中心を射抜く(aim)
FX.reg.target = c => {
  const R = U(c) * 0.36, rings = [1, 0.72, 0.46, 0.22].map(k => c.dot(R * k, "transparent", c.cx, c.cy, `border:2px solid ${hsl(c.hue, 90, 70, 0.7)}`));
  const h = c.box(R * 2.2, 2, `background:${hsl(c.hue, 90, 75, 0.6)}`), v = c.box(2, R * 2.2, `background:${hsl(c.hue, 90, 75, 0.6)}`);
  const hit = c.dot(R * 0.22, hsl(c.hue + 20, 100, 70, 0.9), c.cx, c.cy, `box-shadow:0 0 40px ${hsl(c.hue + 20, 100, 60)}`);
  gsap.set(hit, { scale: 0 });
  c.tl.from(rings, { scale: 3, opacity: 0, duration: 0.7, stagger: 0.12, ease: "power3.in" }).from([h, v], { scaleX: 0, scaleY: 1, opacity: 0, duration: 0.3 }, 0.3)
    .fromTo(hit, { scale: 0, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.5, ease: "power2.out" }, 1.05).set(hit, { scale: 0 })
    .to(rings, { scale: 0.9, duration: 0.2, yoyo: true, repeat: 1 }, 1.05).to([...rings, h, v], { opacity: 0, duration: 0.4 }, 2.4).repeat(-1).repeatDelay(0.2);
};

// lamp: 「使用中」の赤ランプが点滅する(occupied)
FX.reg.lamp = c => {
  const r = U(c) * 0.34, halo = c.dot(r, `radial-gradient(circle,${hsl(c.hue, 100, 55, 0.7)},${hsl(c.hue, 100, 40, 0)} 68%)`, c.cx, c.cy);
  const core = c.dot(U(c) * 0.035, hsl(c.hue, 100, 70), c.cx, c.oy - U(c) * 0.02, `box-shadow:0 0 30px 8px ${hsl(c.hue, 100, 55)}`);
  gsap.to(halo, { scale: 1.25, opacity: 0.45, duration: 0.55, repeat: -1, yoyo: true, ease: "sine.inOut" });
  gsap.to(core, { opacity: 0.25, duration: 0.55, repeat: -1, yoyo: true, ease: "steps(1)" });
};

// stack: ブロックがずしんと積み上がる(solid)
FX.reg.stack = c => {
  const bw = U(c) * 0.2, bh = U(c) * 0.085, base = c.cy + U(c) * 0.3;
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const b = c.box(bw, bh, `background:linear-gradient(180deg,${hsl(c.hue + k * 8, 60, 58)},${hsl(c.hue + k * 8, 60, 44)});border-radius:6px;box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 6px 14px rgba(0,0,0,.35)`, c.cx + side * c.W * 0.3, base - k * (bh + 4));
    c.tl.from(b, { y: `-=${c.H}`, duration: 0.7, ease: "bounce.out" }, k * 0.35 + (side > 0 ? 0.15 : 0));
  }
};

// jump: 2回はね返されて、3回目に壁を越える(attempt)
FX.reg.jump = c => {
  const r = U(c) * 0.03, g = c.cy + U(c) * 0.3, wh = U(c) * 0.16, x0 = c.cx - c.W * 0.28, x1 = c.cx + c.W * 0.28;
  c.box(10, wh, `background:${hsl(c.hue, 40, 70)};border-radius:4px`, c.cx, g - wh / 2);
  c.box(c.W * 0.7, 2, `background:${hsl(c.hue, 30, 70, 0.5)}`, c.cx, g);
  const d = c.dot(r, hsl(c.hue + 30, 95, 66), x0, g - r, `box-shadow:0 0 16px ${hsl(c.hue + 30, 95, 60)}`), px = x0 - r;
  const hop = (t, xa, xb, peak, dur) => c.tl.to(d, { x: xb - r, duration: dur, ease: "none" }, t).to(d, { y: g - r * 2 - peak, duration: dur / 2, ease: "power2.out", yoyo: true, repeat: 1 }, t);
  hop(0.3, x0, c.cx - 18, wh * 0.45, 0.6); hop(1.0, c.cx - 18, x0, wh * 0.3, 0.5);
  hop(1.7, x0, c.cx - 18, wh * 0.7, 0.65); hop(2.45, c.cx - 18, x0, wh * 0.3, 0.5);
  hop(3.2, x0, x1, wh * 1.5, 1.1);
  const star = c.dot(r * 2, "transparent", x1, g - r, `border:3px solid ${hsl(c.hue + 30, 95, 70)};opacity:0`);
  c.tl.fromTo(star, { scale: 0.3, opacity: 1 }, { scale: 2.5, opacity: 0, duration: 0.6 }, 4.3).set(d, { x: px }, 5.4).repeat(-1);
};

// rays: 放射状の光が回る(authority)
FX.reg.rays = c => {
  const s = U(c) * 1.1, r = c.box(s, s, `border-radius:50%;background:repeating-conic-gradient(from 0deg,${hsl(c.hue, 95, 62, 0.4)} 0 5deg,transparent 5deg 15deg);-webkit-mask-image:radial-gradient(circle,#000 8%,transparent 68%);mask-image:radial-gradient(circle,#000 8%,transparent 68%)`);
  gsap.from(r, { scale: 0.2, opacity: 0, duration: 1.2, ease: "power3.out" });
  gsap.to(r, { rotation: 360, duration: 40, repeat: -1, ease: "none" });
};

// enclosed: 輪の中だけで跳ね回る(domestic)
FX.reg.enclosed = c => {
  const R = U(c) * 0.28, ring = c.dot(R, "transparent", c.cx, c.cy, `border:3px solid ${hsl(c.hue, 80, 70, 0.8)};box-shadow:0 0 30px ${hsl(c.hue, 90, 60, 0.35)},inset 0 0 40px ${hsl(c.hue, 90, 60, 0.18)}`);
  gsap.from(ring, { scale: 0.4, opacity: 0, duration: 0.8, ease: "back.out(2)" });
  for (let i = 0; i < 16; i++) {
    const r = rnd(4, 8), e = c.dot(r, hsl(c.hue + rnd(-20, 20), 90, 68), c.cx, c.cy), pt = () => { const a = rnd(0, 6.28), d = Math.sqrt(Math.random()) * (R - r - 4); return [c.cx + d * Math.cos(a) - r, c.cy + d * Math.sin(a) - r]; };
    gsap.to(e, { x: () => pt()[0], y: () => pt()[1], duration: () => rnd(0.6, 1.3), repeat: -1, repeatRefresh: true, ease: "sine.inOut" });
  }
};

// gate: 扉が左右に開いて光がもれる(permission)
FX.reg.gate = c => {
  const w = c.W * 0.22, h = U(c) * 0.6, glass = `background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(6px)`;
  const light = c.box(4, h, `background:${hsl(c.hue, 90, 85)};box-shadow:0 0 60px 20px ${hsl(c.hue, 95, 60, 0.8)};border-radius:2px`);
  const L = c.box(w, h, glass, c.cx - w / 2, c.cy), R = c.box(w, h, glass, c.cx + w / 2, c.cy);
  c.tl.from(light, { scaleY: 0, duration: 0.4 }).to(L, { x: `-=${w * 0.95}`, duration: 1.1, ease: "power3.inOut" }, 0.5).to(R, { x: `+=${w * 0.95}`, duration: 1.1, ease: "power3.inOut" }, 0.5)
    .to(light, { scaleX: w * 0.9, duration: 1.1, ease: "power3.inOut", opacity: 0.35 }, 0.5);
};

// ring: 波紋がくり返し広がる(presence)
FX.reg.ring = c => {
  for (let i = 0; i < 5; i++) {
    const e = c.dot(U(c) * 0.16, "transparent", c.cx, c.cy, `border:3px solid ${hsl(c.hue + i * 10, 90, 70)}`);
    gsap.fromTo(e, { scale: 0.3, opacity: 0.9 }, { scale: 3.2, opacity: 0, duration: 3, delay: i * 0.6, repeat: -1, ease: "power1.out" });
  }
};

// speed: 横に走る速度線(rapidly)
FX.reg.speed = c => {
  for (let i = 0; i < 38; i++) {
    const w = rnd(c.W * 0.12, c.W * 0.4), e = c.box(w, rnd(1.5, 3), `background:linear-gradient(90deg,transparent,${hsl(c.hue, 70, 85, rnd(0.4, 0.9))})`, 0, rnd(c.H * 0.05, c.H * 0.95));
    gsap.fromTo(e, { x: -w }, { x: c.W + w, duration: rnd(0.35, 0.9), delay: rnd(0, 1.2), repeat: -1, repeatDelay: rnd(0, 0.6), ease: "power1.in" });
  }
};
