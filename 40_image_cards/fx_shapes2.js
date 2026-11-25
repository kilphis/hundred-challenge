// 図形の効果 その2(GSAP)。U は fx_shapes1.js で定義。

// glyphs: 文字が別の文字に入れ替わりながら漂う(translate)
FX.reg.glyphs = c => {
  const set = [..."あいうアカABCXYZ語字言ñéλΩЖ한"];
  for (let i = 0; i < 26; i++) {
    const e = c.box(40, 40, `color:${hsl(c.hue + rnd(-30, 30), 80, 75, 0.7)};font:700 ${rnd(20, 44)}px/40px "Hiragino Sans",sans-serif;text-align:center`, rnd(0, c.W), rnd(c.H * 0.1, c.H * 0.9));
    e.textContent = pick(set);
    gsap.to(e, { y: `-=${rnd(40, 110)}`, opacity: 0.1, duration: rnd(1.4, 2.4), repeat: -1, yoyo: true, ease: "sine.inOut", delay: rnd(0, 2), onRepeat() { e.textContent = pick(set); } });
  }
};

// orbit: 単語のまわりをぐるっと取り巻く(circumstance)
FX.reg.orbit = c => {
  [[0.2, 7, 1], [0.3, 11, -1], [0.41, 16, 1]].forEach(([k, T, dir], i) => {
    const R = U(c) * k, ring = c.dot(R, "transparent", c.cx, c.cy, `border:1px dashed ${hsl(c.hue, 70, 75, 0.35)}`);
    gsap.from(ring, { scale: 0, duration: 0.8, delay: i * 0.15, ease: "back.out(1.5)" });
    for (let j = 0; j < 2 + i; j++) {
      const wrap = c.box(R * 2, R * 2, "", c.cx, c.cy), r = 5 + i * 2;
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:50%;top:-${r}px;width:${r * 2}px;height:${r * 2}px;margin-left:-${r}px;border-radius:50%;background:${hsl(c.hue + i * 35, 90, 68)};box-shadow:0 0 14px ${hsl(c.hue + i * 35, 90, 60)}`;
      wrap.appendChild(d); gsap.set(wrap, { rotation: (360 / (2 + i)) * j });
      gsap.to(wrap, { rotation: `+=${dir * 360}`, duration: T, repeat: -1, ease: "none" });
    }
  });
};

// counter: 逆向きの流れ(contrary) / 大多数が一方へ・少数だけ逆(majority)。a={major:多数の割合, n}
FX.reg.counter = c => {
  const n = c.a.n ?? 44, major = c.a.major ?? 0.5;
  for (let i = 0; i < n; i++) {
    const right = i < n * major, lane = c.a.major ? rnd(0.2, 0.8) : right ? rnd(0.12, 0.3) : rnd(0.7, 0.88), r = rnd(3, 6);
    const e = c.dot(r, right ? hsl(c.hue, 85, 66) : hsl(c.hue + 160, 90, 66), 0, c.H * lane);
    const T = rnd(3.5, 6);
    gsap.fromTo(e, { x: right ? -20 : c.W + 20 }, { x: right ? c.W + 20 : -20, duration: T, repeat: -1, ease: "none", delay: -rnd(0, T) });
  }
};

// path: 長い道のりをたどって、最後にぱっと開ける(eventually)
FX.reg.path = c => {
  const pt = t => [c.W * (0.1 + 0.8 * t), c.cy + U(c) * 0.27 + Math.sin(t * 7) * U(c) * 0.05 * (1 - t * 0.4)];
  const pts = Array.from({ length: 80 }, (_, i) => pt(i / 79).join(",")).join(" ");
  const sv = c.svg(`<polyline points="${pts}" fill="none" stroke="${hsl(c.hue, 80, 72, 0.7)}" stroke-width="3" stroke-linecap="round"/>`, c.W, c.H, c.W / 2, c.H / 2);
  const line = sv.querySelector("polyline"), len = line.getTotalLength();
  const d = c.dot(9, hsl(c.hue, 95, 78), 0, 0, `box-shadow:0 0 22px ${hsl(c.hue, 95, 65)}`), o = { t: 0 };
  const flash = c.dot(U(c) * 0.08, "transparent", pt(1)[0], pt(1)[1], `border:3px solid ${hsl(c.hue, 95, 80)};opacity:0`);
  gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
  c.tl.to(o, { t: 1, duration: 4, ease: "power1.inOut", onUpdate() { const p = pt(o.t); gsap.set(d, { x: p[0] - 9, y: p[1] - 9 }); gsap.set(line, { strokeDashoffset: len * (1 - o.t) }); } })
    .fromTo(flash, { scale: 0.2, opacity: 1 }, { scale: 3.5, opacity: 0, duration: 0.9, ease: "power2.out" }, 4).to([line, d], { opacity: 0, duration: 0.6 }, 5.2).set([line, d], { opacity: 1 }).repeat(-1);
};

// spot: 暗がりにスポットライトが当たって露わになる(expose)。前面に重ねる
FX.reg.spot = c => {
  const o = document.createElement("div"); o.style.cssText = "position:absolute;inset:0;--sx:-20%;--sy:42%;background:radial-gradient(circle at var(--sx) var(--sy),transparent 0,transparent 14vmin,rgba(4,4,10,.93) 34vmin)";
  c.top.appendChild(o);
  c.tl.to(o, { "--sx": "50%", duration: 1.8, ease: "power2.inOut" }, 0.2).to(o, { "--sy": "36%", duration: 0.6, yoyo: true, repeat: 3, ease: "sine.inOut" }, 2).to(o, { opacity: 0, duration: 1.2 }, 5);
};

// panels: パネルが順に点灯する(panel)
FX.reg.panels = c => {
  const cols = 7, rows = 4, w = c.W * 0.095, h = U(c) * 0.12, ps = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++)
    ps.push(c.box(w, h, `background:${hsl(c.hue, 60, 22)};border:1px solid ${hsl(c.hue, 70, 55, 0.5)};border-radius:6px`, c.cx + (i - (cols - 1) / 2) * (w + 6), c.cy + (j - (rows - 1) / 2) * (h + 6)));
  gsap.from(ps, { opacity: 0, scale: 0.6, duration: 0.5, stagger: { each: 0.03, grid: [cols, rows], from: "start" } });
  gsap.to(ps, { backgroundColor: hsl(c.hue, 90, 62, 0.85), boxShadow: `0 0 18px ${hsl(c.hue, 90, 60, 0.7)}`, duration: 0.5, delay: 0.8, repeat: -1, yoyo: true, repeatDelay: 0.3, stagger: { each: 0.08, grid: [cols, rows], from: "start" } });
};

// pie: 円グラフの1切れが飛び出す(portion)
FX.reg.pie = c => {
  const r = U(c) * 0.11, s = r * 3, n = 6, m = s / 2, cs = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 6.2832 - 1.5708, a1 = ((i + 1) / n) * 6.2832 - 1.5708, big = 0;
    const p = `M${m},${m} L${m + r * Math.cos(a0)},${m + r * Math.sin(a0)} A${r},${r} 0 ${big} 1 ${m + r * Math.cos(a1)},${m + r * Math.sin(a1)} Z`;
    cs.push(`<path class="sl" d="${p}" fill="${hsl(c.hue + i * 6, 70, 60 - i * 3, 0.85)}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`);
  }
  const sv = c.svg(cs.join(""), s, s, c.cx, c.oy), sl = sv.querySelectorAll(".sl");
  gsap.from(sl, { scale: 0, transformOrigin: "50% 50%", rotation: -90, opacity: 0, duration: 0.6, stagger: 0.08, ease: "back.out(2)" });
  const mid = -1.5708 + 0.5 * (6.2832 / n);
  c.tl.to(sl[0], { x: Math.cos(mid) * r * 0.45, y: Math.sin(mid) * r * 0.45, duration: 0.5, ease: "back.out(3)" }, 1.2).to(sl[0], { x: 0, y: 0, duration: 0.5 }, 3).repeat(-1);
};

// bubble: 吹き出しが順にぽんと出る(remark)
FX.reg.bubble = c => {
  [[-0.2, 0.0, 1], [0.0, -0.03, 1.25], [0.2, 0.02, 0.9]].forEach(([dx, dy, k], i) => {
    const w = U(c) * 0.3 * k, h = U(c) * 0.16 * k, b = c.box(w, h, `background:${hsl(c.hue + i * 30, 70, 62, 0.9)};border-radius:${h / 2}px;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 8px 24px rgba(0,0,0,.3)`, c.cx + dx * c.W, c.oy + dy * c.H);
    for (let j = 0; j < 3; j++) { const d = document.createElement("i"); d.style.cssText = "width:8px;height:8px;border-radius:50%;background:#fff;display:block"; b.appendChild(d); gsap.to(d, { y: -6, duration: 0.4, repeat: -1, yoyo: true, delay: j * 0.13 + i * 0.3 }); }
    const tail = document.createElement("div"); tail.style.cssText = `position:absolute;bottom:-7px;left:${dx < 0 ? "22%" : "70%"};width:16px;height:16px;background:inherit;transform:rotate(45deg);border-radius:3px`; b.appendChild(tail);
    c.tl.from(b, { scale: 0, opacity: 0, duration: 0.7, ease: "elastic.out(1,.5)", transformOrigin: "30% 100%" }, 0.2 + i * 0.5);
  });
};

// clock: 針が回って、ぴたりと合う(timely)
FX.reg.clock = c => {
  const r = U(c) * 0.12, s = r * 2 + 8, m = s / 2, col = hsl(c.hue, 85, 72);
  const ticks = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * 6.2832; return `<line x1="${m + (r - 8) * Math.sin(a)}" y1="${m - (r - 8) * Math.cos(a)}" x2="${m + (r - 2) * Math.sin(a)}" y2="${m - (r - 2) * Math.cos(a)}" stroke="${col}" stroke-width="3"/>`; }).join("");
  const sv = c.svg(`<circle cx="${m}" cy="${m}" r="${r}" fill="${hsl(c.hue, 60, 20, 0.5)}" stroke="${col}" stroke-width="4"/>${ticks}<line class="mh" x1="${m}" y1="${m}" x2="${m}" y2="${m - r * 0.75}" stroke="${col}" stroke-width="4" stroke-linecap="round"/><line class="hh" x1="${m}" y1="${m}" x2="${m}" y2="${m - r * 0.5}" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="${m}" cy="${m}" r="5" fill="#fff"/>`, s, s, c.cx, c.oy);
  const mh = sv.querySelector(".mh"), hh = sv.querySelector(".hh"), pulse = c.dot(r, "transparent", c.cx, c.oy, `border:3px solid ${col};opacity:0`);
  gsap.set([mh, hh], { svgOrigin: `${m} ${m}` });
  c.tl.fromTo(mh, { rotation: -1080 }, { rotation: 0, duration: 2.2, ease: "power4.out" }, 0.2).fromTo(hh, { rotation: -90 }, { rotation: 0, duration: 2.2, ease: "power4.out" }, 0.2)
    .fromTo(pulse, { scale: 1, opacity: 0.9 }, { scale: 2, opacity: 0, duration: 0.7 }, 2.4).to(sv, { scale: 1.12, duration: 0.15, yoyo: true, repeat: 1 }, 2.4).repeat(-1).repeatDelay(1);
};

// morph: 四角が丸に、色も変わる(convert)
FX.reg.morph = c => {
  const s = U(c) * 0.16, b = c.box(s, s, `background:linear-gradient(135deg,${hsl(c.hue, 90, 62)},${hsl(c.hue + 60, 90, 60)});box-shadow:0 0 30px ${hsl(c.hue, 90, 55, 0.5)}`, c.cx, c.oy);
  gsap.to(b, { borderRadius: "50%", rotation: 180, scale: 1.15, duration: 1.3, repeat: -1, yoyo: true, repeatDelay: 0.35, ease: "power2.inOut" });
};

// drop: 重い塊がドンと落ちて揺れる(obligation)
FX.reg.drop = c => {
  const w = U(c) * 0.34, h = U(c) * 0.12, g = c.cy + U(c) * 0.3, b = c.box(w, h, `background:linear-gradient(180deg,${hsl(c.hue, 15, 44)},${hsl(c.hue, 15, 26)});border-radius:8px;box-shadow:inset 0 2px 0 rgba(255,255,255,.25),0 10px 30px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.55);font:800 ${h * 0.4}px/1 Avenir Next,sans-serif;letter-spacing:.1em`, c.cx, g - h / 2);
  b.textContent = "100 kg"; c.box(c.W * 0.8, 2, `background:${hsl(c.hue, 30, 70, 0.5)}`, c.cx, g);
  c.tl.from(b, { y: `-=${c.H}`, duration: 0.55, ease: "power4.in" }, 0.4).fromTo(c.root, { y: 14 }, { y: 0, duration: 0.7, ease: "elastic.out(1,.2)", clearProps: "transform" }, 0.95)
    .fromTo(b, { scaleY: 0.85, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.5, ease: "elastic.out(1,.3)" }, 0.95);
  for (let i = 0; i < 14; i++) { const d = c.dot(rnd(2, 5), hsl(c.hue, 15, 70, 0.6), c.cx + rnd(-w / 2, w / 2), g - 4); c.tl.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.01 }, 0.95).to(d, { x: `+=${rnd(-160, 160)}`, y: `-=${rnd(20, 90)}`, opacity: 0, duration: 0.9, ease: "power2.out" }, 0.96); }
};

// lock: 錠がカチッと閉まる(securely)
FX.reg.lock = c => {
  const s = U(c) * 0.26, bw = s * 0.62, m = s / 2, col = hsl(c.hue, 80, 70);
  const sv = c.svg(`<path class="sh" d="M${m - bw * 0.3},${m - 2} V${m - bw * 0.55} a${bw * 0.3},${bw * 0.3} 0 0 1 ${bw * 0.6},0 V${m - 2}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round"/><rect x="${m - bw / 2}" y="${m - 4}" width="${bw}" height="${bw * 0.72}" rx="9" fill="${hsl(c.hue, 70, 45)}" stroke="${col}" stroke-width="4"/><circle cx="${m}" cy="${m + bw * 0.24}" r="6" fill="#fff"/>`, s, s, c.cx, c.oy);
  const sh = sv.querySelector(".sh"), ring = c.dot(s * 0.4, "transparent", c.cx, c.oy, `border:3px solid ${col};opacity:0`);
  c.tl.fromTo(sh, { y: -bw * 0.28 }, { y: 0, duration: 0.5, ease: "power4.in" }, 0.5).fromTo(ring, { scale: 0.6, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.8, ease: "power2.out" }, 1)
    .to(sv, { scale: 1.1, duration: 0.12, yoyo: true, repeat: 1 }, 1).to(sh, { y: -bw * 0.28, duration: 0.01 }, 2.8).repeat(-1);
};

// chevron: 矢印(>)が一方向へ流れる。a={dir:"up"|"right"}  (strive=上へ / urge=右へ背中を押す)
FX.reg.chevron = c => {
  const up = c.a.dir === "up", n = up ? 7 : 6, sz = U(c) * 0.075;
  for (let k = 0; k < (up ? 3 : 1); k++) for (let i = 0; i < n; i++) {
    const x = up ? c.cx + (k - 1) * c.W * 0.3 : c.cx - c.W * 0.32, y = up ? c.cy + U(c) * 0.32 : c.cy;
    const e = c.box(sz, sz, `border-right:5px solid ${hsl(c.hue + i * 4, 90, 68)};border-top:5px solid ${hsl(c.hue + i * 4, 90, 68)};border-radius:3px;transform-origin:center`, x, y);
    gsap.set(e, { rotation: up ? -45 : 45 });
    gsap.fromTo(e, up ? { y: y - sz / 2, opacity: 0 } : { x: x - sz / 2 - 10, opacity: 0 },
      { ...(up ? { y: `-=${U(c) * 0.62}` } : { x: `+=${c.W * 0.2}` }), opacity: 1, duration: 1.1, delay: i * 0.22 + k * 0.15, repeat: -1, ease: "power1.in", yoyo: false, onRepeat() { } });
    gsap.to(e, { opacity: 0, duration: 0.3, delay: i * 0.22 + k * 0.15 + 0.8, repeat: -1, repeatDelay: 0.8 });
  }
  if (!up) gsap.to(c.root.querySelector(".word"), { x: 24, duration: 0.4, repeat: -1, yoyo: true, ease: "power2.out", repeatDelay: 0.6 });
};

// check: 輪が描かれてチェックが入る(acknowledge)
FX.reg.check = c => {
  const s = U(c) * 0.24, m = s / 2, col = hsl(c.hue, 85, 68);
  const sv = c.svg(`<circle class="cc" cx="${m}" cy="${m}" r="${m - 6}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"/><path class="ck" d="M${m * 0.55},${m * 1.02} L${m * 0.9},${m * 1.35} L${m * 1.5},${m * 0.68}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`, s, s, c.cx, c.oy);
  const cc = sv.querySelector(".cc"), ck = sv.querySelector(".ck"), l1 = cc.getTotalLength(), l2 = ck.getTotalLength(), ping = c.dot(m, "transparent", c.cx, c.oy, `border:3px solid ${col};opacity:0`);
  gsap.set(cc, { strokeDasharray: l1, strokeDashoffset: l1 }); gsap.set(ck, { strokeDasharray: l2, strokeDashoffset: l2 });
  c.tl.to(cc, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" }, 0.2).to(ck, { strokeDashoffset: 0, duration: 0.4, ease: "power2.out" }, 0.8)
    .fromTo(ping, { scale: 1, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 0.7 }, 1.15).to([cc, ck], { opacity: 0, duration: 0.4 }, 2.6).repeat(-1);
};

// timeline: 線がのびて、節目が順に灯る(timeline)
FX.reg.timeline = c => {
  const y = c.cy + U(c) * 0.28, x0 = c.W * 0.1, x1 = c.W * 0.9, line = c.box(x1 - x0, 3, `background:${hsl(c.hue, 70, 72, 0.8)};border-radius:2px;transform-origin:0 50%`, (x0 + x1) / 2, y);
  c.tl.from(line, { scaleX: 0, duration: 1.6, ease: "power2.inOut" }, 0.2);
  for (let i = 0; i < 6; i++) {
    const x = x0 + ((x1 - x0) * i) / 5, d = c.dot(i === 5 ? 10 : 7, i === 5 ? hsl(c.hue + 40, 95, 70) : hsl(c.hue, 90, 70), x, y, `box-shadow:0 0 14px ${hsl(c.hue, 90, 60)}`), t = c.box(2, 16, `background:${hsl(c.hue, 70, 72, 0.6)}`, x, y - 22);
    c.tl.from([d, t], { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(3)" }, 0.2 + 1.6 * (i / 5));
  }
};

// core: 外側の殻がはがれ、核だけが残る(essential)
FX.reg.core = c => {
  const shells = [0.42, 0.34, 0.26, 0.19].map((k, i) => c.dot(U(c) * k, "transparent", c.cx, c.cy, `border:2px solid ${hsl(c.hue + i * 12, 70, 72, 0.6)}`));
  const core = c.dot(U(c) * 0.08, `radial-gradient(circle,#fff,${hsl(c.hue, 95, 65)} 55%,${hsl(c.hue, 95, 50, 0.4)})`, c.cx, c.cy, `box-shadow:0 0 50px 14px ${hsl(c.hue, 95, 60, 0.7)}`);
  c.tl.from(shells, { scale: 0.3, opacity: 0, duration: 0.6, stagger: 0.12 }).to(shells, { scale: 1.6, opacity: 0, duration: 1.1, stagger: 0.15, ease: "power2.in" }, 1.4)
    .fromTo(core, { scale: 0.7 }, { scale: 1.15, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 3 }, 1.6).to(core, { opacity: 0, duration: 0.4 }, 4).set(core, { opacity: 1 }).repeat(-1);
};

// gap: 輪が欠けていく(lack)
FX.reg.gap = c => {
  const n = 20, R = U(c) * 0.28, ds = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832; ds.push(c.dot(8, hsl(c.hue, 85, 66), c.cx + R * Math.cos(a), c.cy + R * Math.sin(a), `box-shadow:0 0 10px ${hsl(c.hue, 85, 55)}`)); }
  gsap.from(ds, { scale: 0, duration: 0.4, stagger: 0.03 });
  c.tl.to([ds[3], ds[4], ds[5], ds[6], ds[7]], { opacity: 0.12, scale: 0.5, y: `+=${R * 0.25}`, duration: 0.7, stagger: 0.16, ease: "power2.in" }, 1.4).to({}, { duration: 1 }, 3.6).repeat(-1);
};

// gather: 散らばった点が中央に集まって輪になる(recruit)
FX.reg.gather = c => {
  const n = 28, R = U(c) * 0.3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.2832, e = c.dot(7, hsl(c.hue + rnd(-25, 25), 90, 66), c.cx + R * Math.cos(a), c.cy + R * Math.sin(a), `box-shadow:0 0 10px ${hsl(c.hue, 90, 55)}`);
    gsap.from(e, { x: rnd(0, c.W), y: rnd(0, c.H), opacity: 0, duration: 1.6, delay: i * 0.04, ease: "power3.inOut" });
    gsap.to(e, { scale: 1.5, duration: 0.6, delay: 2.4 + i * 0.03, yoyo: true, repeat: -1, repeatDelay: 2, ease: "sine.inOut" });
  }
};

// comet: 光が流れて尾を引き、その後に静けさが残る(afterwards)
FX.reg.comet = c => {
  for (let i = 0; i < 12; i++) {
    const w = rnd(c.W * 0.15, c.W * 0.35), y = rnd(c.H * 0.1, c.H * 0.9), e = c.box(w, 4, `background:linear-gradient(90deg,transparent,${hsl(c.hue + rnd(-20, 20), 90, 72)});border-radius:4px;box-shadow:0 0 12px ${hsl(c.hue, 90, 60, 0.6)}`, 0, y);
    gsap.fromTo(e, { x: -w }, { x: c.W + w, duration: rnd(1.4, 2.4), delay: rnd(0, 2), repeat: -1, repeatDelay: rnd(1, 3), ease: "power2.inOut" });
  }
};

// hier: 1つの大きな円と、そのまわりの小さな円たち(primary)
FX.reg.hier = c => {
  const big = c.dot(U(c) * 0.11, `radial-gradient(circle at 35% 30%,#fff,${hsl(c.hue, 90, 62)} 45%,${hsl(c.hue, 90, 40)})`, c.cx, c.oy, `box-shadow:0 0 50px ${hsl(c.hue, 90, 55, 0.6)}`);
  gsap.from(big, { scale: 0, duration: 0.9, ease: "elastic.out(1,.5)" });
  gsap.to(big, { scale: 1.08, duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
  for (let i = 0; i < 14; i++) {
    const r = rnd(3, 9), e = c.dot(r, hsl(c.hue + rnd(-25, 25), 70, 70, 0.8), c.cx, c.oy), pt = () => { const a = rnd(0, 6.28), d = U(c) * rnd(0.17, 0.3); return [c.cx + d * Math.cos(a) * 1.6 - r, c.oy + d * Math.sin(a) - r]; };
    gsap.to(e, { x: () => pt()[0], y: () => pt()[1], duration: () => rnd(1.4, 2.6), repeat: -1, repeatRefresh: true, ease: "sine.inOut" });
  }
};
