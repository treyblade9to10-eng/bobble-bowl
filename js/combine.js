// ---- Career: NFL Combine drills. 40-yard dash (tap on the beat), bench press (tap fast), catching drill (tap when the ball gets there).
// ~10-20 s each, any one can be auto-simmed (or all of them). Results nudge your draft stock a little (+ up to 2 skill points).
// Tap / click the field, SPACE / ENTER, or A / cross on a controller ----
screens.push('cbDrill'); menuScreens.push('cbDrill');
(() => {
  const el = document.createElement('div'); el.id = 'cbDrill'; el.className = 'screen';
  el.innerHTML = `<div class="cdHead"><b id="cdName"></b><span id="cdHow"></span><em id="cdStep"></em></div>
    <div class="cdStage"><canvas id="cdCv"></canvas><button class="big cdTap" id="cdTap" aria-label="Tap"></button></div>
    <div class="cdBtns"><button class="big gold" id="cdGo">START</button><button id="cdAuto">AUTO RESULT</button><button id="cdAll">SKIP ALL</button></div>`;
  $('stage').appendChild(el);
})();

const CD_DRILLS = [
  { k: 'dash', name: '40-YARD DASH', how: 'Tap on the beat: every time a marker hits the gold line. Clean strides = a faster time.' },
  { k: 'bench', name: 'BENCH PRESS', how: 'Tap as fast as you can to push the bar up. 225 pounds, 12 seconds.' },
  { k: 'catch', name: 'CATCHING DRILL', how: 'The JUGS machine fires 8 balls. Tap right when the ball gets to your hands.' }
];
const Combine = {
  i: 0, st: 'intro', res: {}, d: null, t: 0, raf: 0, fb: null,
  cap() { return Career.cap; },
  // what the drill would give a player like you (the auto result is built around these)
  base40() { const c = this.cap(); return 5.55 - (c.spd - 60) * 0.03; },
  benchAvg() { const c = this.cap(); return Math.round(12 + (c.pos === 'DL' ? 14 : c.pos === 'LB' || c.pos === 'TE' ? 8 : 0) + (c.a[1] - 60) * 0.2); },
  hands() { const c = this.cap(); return ['WR', 'TE', 'RB'].includes(c.pos) ? c.a[0] : Math.min(c.a[0], 70) - 6; },
  auto(k) {
    if (k === 'dash') return +clamp(this.base40() + rand(-0.04, 0.12), 4.22, 5.9).toFixed(2);
    if (k === 'bench') return Math.max(4, Math.round(this.benchAvg() + rand(-3, 3)));
    return clamp(Math.round(4.5 + (this.hands() - 60) / 10 + rand(-1, 1)), 1, 8);
  },
  open() {
    this.i = 0; this.res = {}; this.st = 'intro'; Sound.init();
    show('cbDrill'); this.size(); this.intro();
    cancelAnimationFrame(this.raf); this.last = performance.now(); this.raf = requestAnimationFrame(t => this.frame(t));
  },
  intro() {
    const D = CD_DRILLS[this.i];
    this.st = 'intro'; this.d = null; this.fb = null;
    $('cdName').textContent = D.name; $('cdHow').textContent = D.how; $('cdStep').textContent = `DRILL ${this.i + 1} OF 3`;
    $('cdGo').textContent = 'START'; this.btns(true);
  },
  btns(menu) {
    $('cdGo').style.display = $('cdAuto').style.display = $('cdAll').style.display = menu ? '' : 'none';
    $('cdTap').style.display = menu ? 'none' : '';
    if (!menu && document.activeElement && document.activeElement.blur) document.activeElement.blur();
  },
  start() {
    const D = CD_DRILLS[this.i], c = this.cap();
    this.st = 'play'; this.t = 0; this.fb = null; this.btns(false);
    if (D.k === 'dash') this.d = { beat: 0.48, t0: 1.6, next: 0, dist: 0, n: 0, good: 0, v: 0 }; // first beat comes after the SET / GO
    if (D.k === 'bench') { const E = this.benchAvg(); this.d = { E, need: 84 / (E * 1.15), h: 0, reps: 0, T: 12, up: 0 }; }
    if (D.k === 'catch') this.d = { n: 0, got: 0, wnd: clamp(0.085 + (this.hands() - 60) * 0.001, 0.07, 0.12), ball: null, wait: 1.0 };
    Sound.whistle();
  },
  // a tap (finger, mouse, SPACE / ENTER, controller A)
  tap() {
    if (this.st !== 'play' || !this.d) return;
    const D = CD_DRILLS[this.i].k, d = this.d;
    if (D === 'dash') {
      const t = this.t - d.t0, b = d.next * d.beat, off = t - b; // the beat we're waiting on
      if (t < -0.25) return this.say('TOO SOON', '#ff8a6a');
      if (off < -0.2) return this.say('EARLY', '#9aa6b5');
      this.stride(Math.abs(off) <= 0.06 ? 1 : Math.abs(off) <= 0.13 ? 0.8 : 0.5);
    } else if (D === 'bench') {
      if (d.T <= 0) return;
      d.h += 1 / (d.need * (1 + d.reps * 0.015)); d.up = 0.12; Sound.tone(120 + d.h * 60, 0.05, 'sine', 0.06);
      if (d.h >= 1) { d.reps++; d.h = 0; this.say(String(d.reps), '#fff'); Sound.tone(220, 0.1, 'sine', 0.1); }
    } else if (D === 'catch') {
      const b = d.ball; if (!b || b.done) return;
      const off = this.t - b.at;
      if (off < -d.wnd * 2.2) { b.done = 'early'; this.say('TOO EARLY', '#ff8a6a'); Sound.tone(160, 0.2, 'sine', 0.1); }
      else if (Math.abs(off) <= d.wnd) { b.done = 'got'; d.got++; this.say(Math.abs(off) <= d.wnd / 2 ? 'SURE HANDS' : 'CAUGHT', '#4fe08a'); Sound.catch(); Sound.tone(520, 0.08, 'sine', 0.08); }
      else { b.done = 'drop'; this.say(off < 0 ? 'TOO EARLY' : 'TOO LATE', '#ff8a6a'); Sound.tone(160, 0.2, 'sine', 0.1); }
    }
  },
  // dash: one stride (q = 1 clean, 0.8 a bit off, 0.5 missed the beat)
  stride(q) {
    const d = this.d; d.next++; d.n++; d.dist += 40 / 22 * q; if (q === 1) d.good++;
    this.say(q === 1 ? 'PERFECT' : q > 0.6 ? 'GOOD' : 'MISS', q === 1 ? '#4fe08a' : q > 0.6 ? '#ffd23f' : '#ff8a6a');
    Sound.tone(q === 1 ? 140 : 100, 0.06, 'sine', 0.12, -40);
    if (d.dist >= 40) this.finish(+clamp(this.base40() - 0.08 + (d.n - 22) * 0.05, 4.22, 5.9).toFixed(2));
  },
  say(txt, col) { this.fb = { txt, col, t: this.t }; },
  update(dt) {
    if (this.st !== 'play' || !this.d) return;
    this.t += dt;
    const D = CD_DRILLS[this.i].k, d = this.d;
    if (D === 'dash') {
      const t = this.t - d.t0;
      if (t > d.next * d.beat + 0.13) this.stride(0.5); // let a beat go by: a sloppy stride
      d.v += ((t > 0 ? 6 + d.good / Math.max(1, d.n) * 4 : 0) - d.v) * Math.min(1, dt * 3);
    } else if (D === 'bench') {
      d.T -= dt; d.up = Math.max(0, d.up - dt);
      if (d.h > 0) d.h = Math.max(0, d.h - dt * (0.22 + d.reps * 0.004)); // the bar wants to come down
      if (d.T <= 0) this.finish(clamp(d.reps, Math.round(d.E * 0.4), Math.round(d.E * 1.45)));
    } else if (D === 'catch') {
      const b = d.ball;
      if (!b) { d.wait -= dt; if (d.wait <= 0) { if (d.n >= 8) return this.finish(d.got); d.n++; const T = rand(0.85, 1.35); d.ball = { t0: this.t, at: this.t + T, T, arc: rand(0.6, 1.4) }; Sound.tone(70, 0.15, 'sine', 0.12, -20); } }
      else {
        if (!b.done && this.t > b.at + d.wnd) { b.done = 'drop'; this.say('DROPPED', '#ff8a6a'); }
        if (b.done && this.t > b.at + 0.55) { d.ball = null; d.wait = 0.45; }
      }
    }
  },
  finish(v) {
    const D = CD_DRILLS[this.i];
    this.res[D.k] = v; this.st = 'result'; this.rt = this.t; Sound.td();
    $('cdHow').textContent = this.resText(D.k, v);
    $('cdGo').textContent = this.i < 2 ? 'NEXT DRILL' : 'RESULTS';
    this.btns(true); $('cdAuto').style.display = $('cdAll').style.display = 'none';
  },
  resText(k, v) { return k === 'dash' ? `40 time: ${v.toFixed(2)} seconds` : k === 'bench' ? `${v} reps at 225` : `${v} of 8 caught`; },
  next() {
    if (this.st === 'intro') return this.start();
    if (this.st === 'result') { if (this.i < 2) { this.i++; return this.intro(); } return this.summary(); }
    if (this.st === 'sum') return this.done();
  },
  autoOne() { const D = CD_DRILLS[this.i]; this.res[D.k] = this.auto(D.k); if (this.i < 2) { this.i++; this.intro(); } else this.summary(); },
  autoAll() { for (const D of CD_DRILLS) if (this.res[D.k] == null) this.res[D.k] = this.auto(D.k); this.summary(); },
  // how much it moves you: a good bench / hands day = a couple of spots up the board (the 40 already counts in Career.stock)
  bonus(r) { return clamp((r.bench - this.benchAvg()) * 0.3 + (r.catch - 5) * 1.2, -4, 4); },
  sp(r) { return (r.dash <= this.base40() - 0.04 ? 1 : 0) + (r.catch >= 7 || r.bench >= this.benchAvg() * 1.15 ? 1 : 0); },
  summary() {
    const r = this.res, b = this.bonus(r), sp = this.sp(r);
    this.st = 'sum'; this.d = null;
    $('cdName').textContent = 'COMBINE RESULTS'; $('cdStep').textContent = '';
    $('cdHow').textContent = `40: ${r.dash.toFixed(2)}s  ·  BENCH: ${r.bench} reps  ·  HANDS: ${r.catch}/8  ·  ${b >= 1 ? 'Scouts liked what they saw' : b <= -1 ? 'A rough day for your stock' : 'Right about where they had you'}${sp ? `  ·  +${sp} SKILL POINT${sp > 1 ? 'S' : ''}` : ''}`;
    $('cdGo').textContent = 'CONTINUE'; this.btns(true); $('cdAuto').style.display = $('cdAll').style.display = 'none';
  },
  done() {
    const r = this.res, c = this.cap();
    cancelAnimationFrame(this.raf); this.raf = 0;
    Career.setCombine(r.dash);
    Object.assign(c.combine, { bench: r.bench, catch: r.catch, bonus: +this.bonus(r).toFixed(1), drills: 1 });
    c.sp = (c.sp || 0) + this.sp(r);
    Career.save(); Sound.click(); CareerUI.open();
  },

  // ---------------- drawing ----------------
  size() {
    const cv = $('cdCv'), r = cv.getBoundingClientRect(), k = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(200, Math.round(r.width)), h = Math.max(120, Math.round(r.height));
    if (cv.width !== Math.round(w * k) || cv.height !== Math.round(h * k)) { cv.width = Math.round(w * k); cv.height = Math.round(h * k); }
    this.W = w; this.H = h; this.k = k;
  },
  frame(now) {
    if (!$('cbDrill').classList.contains('show')) { this.raf = 0; return; }
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.update(dt); this.size();
    const g = $('cdCv').getContext('2d'); g.setTransform(this.k, 0, 0, this.k, 0, 0);
    try { this.draw(g); } catch (e) { console.error('combine', e); }
    this.raf = requestAnimationFrame(t => this.frame(t));
  },
  me() {
    if (!this.pl) { const p = makePlayer(0, true, 2, Career.tuple()); p.face.dir = 1; p.headScale = 1.1; this.pl = p; }
    return this.pl;
  },
  fakeG() { const t = Career.collegeTeam(this.cap().college.id); return { teams: [t, t], ball: null, phase: 'over', human: 0, mode: G.mode, time: performance.now() / 1000 }; },
  draw(g) {
    const W = this.W, H = this.H, D = CD_DRILLS[this.i].k, d = this.d, team = Career.collegeTeam(this.cap().college.id);
    g.clearRect(0, 0, W, H);
    const HD = '"Barlow Condensed", Arial, sans-serif';
    if (this.st === 'sum') return this.drawSum(g, W, H, HD);
    if (D === 'dash') this.drawDash(g, W, H, d, HD);
    else if (D === 'bench') this.drawBench(g, W, H, d, team, HD);
    else this.drawCatch(g, W, H, d, HD);
    // feedback word
    const f = this.fb;
    if (f && this.t - f.t < 0.7 && this.st === 'play') {
      const a = 1 - (this.t - f.t) / 0.7;
      g.save(); g.globalAlpha = a; g.font = `italic 900 ${Math.round(H * 0.13)}px ${HD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText(f.txt, W / 2, H * 0.2 - (1 - a) * 10); g.fillStyle = f.col; g.fillText(f.txt, W / 2, H * 0.2 - (1 - a) * 10); g.restore();
    }
    if (this.st === 'result') {
      g.fillStyle = '#0b0f16d8'; g.fillRect(0, 0, W, H);
      g.font = `italic 900 ${Math.round(H * 0.22)}px ${HD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f6c31c';
      const v = this.res[D]; g.fillText(D === 'dash' ? `${v.toFixed(2)}s` : D === 'bench' ? `${v} REPS` : `${v} / 8`, W / 2, H / 2);
    }
  },
  drawDash(g, W, H, d, HD) {
    const pxy = W / 14, run = d ? d.dist : 0, cx = W * 0.32, gy = H * 0.66;
    g.fillStyle = '#2f7a32'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff10'; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
    // yard lines every 5 yards, the start and the finish
    g.font = `900 ${Math.round(H * 0.09)}px ${HD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let yd = -10; yd <= 50; yd += 5) {
      const x = cx + (yd - run) * pxy; if (x < -40 || x > W + 40) continue;
      g.fillStyle = yd === 0 || yd === 40 ? '#fff' : '#ffffffaa'; g.fillRect(x - (yd === 40 ? 3 : 1.5), H * 0.18, yd === 40 ? 6 : 3, H * 0.62);
      if (yd > 0 && yd <= 40) { g.fillStyle = '#ffffffcc'; g.fillText(String(yd), x, H * 0.12); }
    }
    const p = this.me(), fg = this.fakeG(), sp = d ? d.v : 0;
    p.speedNow = sp; p.anim = (p.anim || 0) + sp * 0.016; p.sprinting = sp > 4;
    const s = H / 190;
    g.save(); g.translate(cx, gy); g.scale(s, s); drawPlayer(g, p, fg, { x: 0, y: 0 }); g.restore();
    // the beat track: markers slide in from the right to the gold line
    const ty = H - 30, hx = 70;
    g.fillStyle = '#0b0f16d8'; g.fillRect(0, ty - 22, W, 44);
    g.fillStyle = '#f6c31c'; g.fillRect(hx - 2, ty - 20, 4, 40);
    if (d && this.st === 'play') {
      const t = this.t - d.t0;
      for (let n = d.next; n < d.next + 8; n++) { const x = hx + (n * d.beat - t) * 260; if (x > W + 20) break; g.fillStyle = n === d.next ? '#fff' : '#ffffff80'; g.beginPath(); g.arc(x, ty, n === d.next ? 11 : 8, 0, 7); g.fill(); }
      if (t < 0) { g.font = `italic 900 ${Math.round(H * 0.16)}px ${HD}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(t < -0.8 ? 'SET' : 'GO!', W / 2, H * 0.42); }
    }
    // the clock: what this run comes out to so far
    if (d) {
      const n = Math.max(0, (this.t - d.t0) / d.beat), est = this.st === 'result' && this.res.dash ? this.res.dash : Math.max(0, (this.base40() - 0.08) * Math.min(1, d.dist / 40) + Math.max(0, n - d.dist / (40 / 22)) * 0.05);
      g.fillStyle = '#0b0f16d8'; g.fillRect(W - 120, 10, 110, 40); g.fillStyle = '#f6c31c'; g.fillRect(W - 120, 10, 4, 40);
      g.fillStyle = '#fff'; g.font = `italic 900 28px ${HD}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(est.toFixed(2), W - 18, 31);
    }
  },
  drawBench(g, W, H, d, team, HD) {
    g.fillStyle = '#151b24'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d2531'; g.fillRect(0, H * 0.8, W, H * 0.2);
    const s = H / 300, cx = W / 2, by = H * 0.8 - 62 * s, p = this.me(), lk = teamLook(team, true), skin = SKIN[p.face.skin] || SKIN[2];
    const h = d ? d.h : 0, up = d && d.up ? 3 * s : 0;
    const line = (pts, w, col) => { g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = OUT; g.lineWidth = w + 4; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
    // the bench (side view)
    g.fillStyle = '#3a4352'; g.fillRect(cx - 120 * s, by, 230 * s, 14 * s); g.fillRect(cx - 100 * s, by + 14 * s, 9 * s, 48 * s); g.fillRect(cx + 85 * s, by + 14 * s, 9 * s, 48 * s);
    g.fillStyle = '#222a35'; g.fillRect(cx + 70 * s, by - 150 * s, 10 * s, 150 * s); // the rack
    // legs: hip -> knee -> foot on the floor
    line([[cx - 60 * s, by - 10 * s], [cx - 120 * s, by - 26 * s], [cx - 130 * s, by + 58 * s]], 15 * s, lk.pants || '#ddd');
    // body lying on the bench
    g.fillStyle = lk.jersey; roundRect(g, cx - 70 * s, by - 34 * s, 130 * s, 32 * s, 12 * s); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    // the bar from the side: plates, moving with your taps. The arm reaches up to it (straight at the top)
    const gx = cx + 22 * s, shY = by - 26 * s, barY = shY - 30 * s - h * 62 * s - up, dist = shY - barY, L = 98 * s;
    const ex = gx - Math.sqrt(Math.max(0, (L / 2) ** 2 - (dist / 2) ** 2)), ey = (shY + barY) / 2;
    line([[gx, shY], [ex, ey], [gx, barY]], 12 * s, lk.jersey);
    g.fillStyle = skin; g.beginPath(); g.arc(gx, barY, 7 * s, 0, 7); g.fill();
    g.fillStyle = '#2a2f37'; g.beginPath(); g.arc(gx, barY, 40 * s, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#f6c31c'; g.lineWidth = 5 * s; g.beginPath(); g.arc(gx, barY, 33 * s, 0, 7); g.stroke();
    g.fillStyle = '#c9ced6'; g.beginPath(); g.arc(gx, barY, 8 * s, 0, 7); g.fill();
    // his head at the end of the bench
    g.save(); g.translate(cx + 82 * s, by - 34 * s); g.rotate(-0.25); drawHead(g, 30 * s, team, p, lk); g.restore();
    // reps + time + the push meter
    g.fillStyle = '#fff'; g.font = `italic 900 ${Math.round(H * 0.2)}px ${HD}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(`${d ? d.reps : 0}`, 20, 14); g.font = `800 14px ${HD}`; g.fillStyle = '#9aa6b5'; g.fillText('REPS', 22, 18 + H * 0.2);
    if (d) { g.textAlign = 'right'; g.font = `italic 900 30px ${HD}`; g.fillStyle = d.T < 3 ? '#ff8a6a' : '#fff'; g.fillText(Math.max(0, d.T).toFixed(1), W - 18, 14); }
    g.fillStyle = '#0b0f16'; g.fillRect(W - 34, H * 0.25, 16, H * 0.5); g.fillStyle = '#f6c31c'; g.fillRect(W - 34, H * 0.75 - H * 0.5 * h, 16, H * 0.5 * h);
  },
  drawCatch(g, W, H, d, HD) {
    g.fillStyle = '#2f7a32'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff10'; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
    const s = H / 190, rx = W * 0.22, gy = H * 0.72, mx = W * 0.86;
    // the JUGS machine
    g.fillStyle = '#1b2029'; roundRect(g, mx - 26, gy - 70 * s, 52, 44 * s, 6); g.fill(); g.fillStyle = '#e8401c'; g.fillRect(mx - 26, gy - 70 * s, 52, 6);
    g.fillStyle = '#3a4352'; g.fillRect(mx - 4, gy - 26 * s, 8, 26 * s); g.beginPath(); g.arc(mx - 16, gy, 7, 0, 7); g.arc(mx + 16, gy, 7, 0, 7); g.fill();
    const p = this.me(), fg = this.fakeG(), b = d && d.ball;
    p.speedNow = 0; p.anim = (p.anim || 0) + 0.02; p.celebrate = b && b.done === 'got' ? 1 : 0;
    g.save(); g.translate(rx, gy); g.scale(s, s); drawPlayer(g, p, fg, { x: 0, y: 0 }); g.restore();
    const hx = rx + 18 * s, hy = gy - 46 * s;
    if (b) {
      const u = clamp((this.t - b.t0) / b.T, 0, b.done === 'got' ? 1 : 1.25);
      let x = lerp(mx - 20, hx, u), y = lerp(gy - 64 * s, hy, u) - Math.sin(Math.min(1, u) * Math.PI) * 50 * s * b.arc;
      if (b.done === 'got') { x = hx; y = hy; }
      if (b.done === 'drop' || b.done === 'early') { const k = Math.max(0, this.t - b.at); x = hx - 30 * k * 3; y = Math.min(gy, hy + 200 * k * k + 40 * k); }
      // the closing ring: tap when it shrinks onto your hands
      const left = b.at - this.t;
      if (!b.done && left < 0.7) { g.strokeStyle = left < d.wnd ? '#4fe08a' : '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.arc(hx, hy, 12 + Math.max(0, left) * 70, 0, 7); g.stroke(); }
      drawFootball(g, x, y, 1.2 * s * 1.6, -0.3 + u * 6);
    }
    g.strokeStyle = '#ffffff50'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, 12, 0, 7); g.stroke();
    if (d) {
      g.fillStyle = '#0b0f16d8'; g.fillRect(W - 200, 10, 190, 40); g.fillStyle = '#f6c31c'; g.fillRect(W - 200, 10, 4, 40);
      g.fillStyle = '#fff'; g.font = `italic 900 24px ${HD}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(`${d.got} CAUGHT  ·  BALL ${Math.max(d.n, 1)}/8`, W - 18, 31);
    }
  },
  drawSum(g, W, H, HD) {
    const r = this.res, cells = [[r.dash.toFixed(2) + 's', '40-YARD DASH'], [String(r.bench), 'BENCH REPS'], [`${r.catch}/8`, 'CATCHING']];
    const cw = Math.min(200, (W - 60) / 3), x0 = (W - cw * 3 - 20) / 2;
    cells.forEach(([v, l], i) => {
      const x = x0 + i * (cw + 10), y = H * 0.18, h = H * 0.6;
      g.fillStyle = '#141a23'; g.fillRect(x, y, cw, h); g.fillStyle = '#f6c31c'; g.fillRect(x, y, cw, 4);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f6c31c'; g.font = `italic 900 ${Math.round(Math.min(56, H * 0.2))}px ${HD}`; g.fillText(v, x + cw / 2, y + h * 0.45);
      g.fillStyle = '#9aa6b5'; g.font = `800 14px ${HD}`; g.fillText(l, x + cw / 2, y + h * 0.8);
    });
  }
};
{
  const tapEl = $('cdTap');
  tapEl.addEventListener('pointerdown', e => { e.preventDefault(); Combine.tap(); });
  tapEl.addEventListener('mousedown', e => e.preventDefault());
  tapEl.addEventListener('click', e => { if (e.detail === 0) Combine.tap(); }); // controller A / keyboard (a real click already counted on pointerdown)
  $('cdGo').onclick = () => { Sound.click(); Combine.next(); };
  $('cdAuto').onclick = () => { Sound.click(); Combine.autoOne(); };
  $('cdAll').onclick = () => { Sound.click(); Combine.autoAll(); };
  const k = e => { if (!$('cbDrill').classList.contains('show') || Combine.st !== 'play' || !(e.code === 'Space' || e.code === 'Enter')) return; e.preventDefault(); if (e.type === 'keydown' && !e.repeat) Combine.tap(); };
  window.addEventListener('keydown', k); window.addEventListener('keyup', k);
}
// the 40 counts in the draft stock already; the bench + catching day adds a little on top
{ const _st = Career.stock; Career.stock = function () { const c = this.cap; return _st.call(this) + ((c && c.combine && c.combine.bonus) || 0); }; }
// the combine screen: the drills (or auto results) instead of the old dash
{ const _cb = CareerUI.combine; CareerUI.combine = function () {
  _cb.call(this);
  const run = $('ccRun'), skip = $('ccSkip'), tx = document.querySelector('#capBody .ccText');
  if (tx) tx.innerHTML = tx.innerHTML.replace(/Every scout in the NFL[\s\S]*/, 'Every scout in the NFL is watching. Three drills: the <b>40-yard dash</b>, the <b>bench press</b> and a <b>catching drill</b>. Good numbers move you up draft boards.');
  if (run) { run.textContent = 'START THE DRILLS'; run.onclick = () => { Sound.init(); Sound.click(); cancelAnimationFrame(capAnim); Combine.pl = null; Combine.open(); }; }
  if (skip) { skip.textContent = 'SKIP (AUTO RESULTS)'; skip.onclick = () => { Sound.click(); Combine.pl = null; Combine.res = {}; Combine.i = 0; for (const D of CD_DRILLS) Combine.res[D.k] = Combine.auto(D.k); Combine.done(); }; }
}; }
// combine results card: the catching drill next to the rest
{ const _pd = CareerUI.preDraft; CareerUI.preDraft = function () {
  _pd.call(this);
  const cb = Career.cap && Career.cap.combine, box = document.querySelector('#capBody .ccCombine');
  if (cb && cb.catch != null && box) box.insertAdjacentHTML('beforeend', `<div><b>${cb.catch}/8</b><span>CATCHING</span></div>`);
}; }
