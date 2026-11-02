// ---- Game flow: momentum swings (crowd, bench, a short swing tag), icing the kicker, the two-minute drill (tight camera, drum bed, scorebug tag) ----
// Builds on the momentum meter + crowd noise in rules.js. Wraps a few functions instead of changing them.
const Flow = {
  on: () => !!G.teams && !G.mini && !G.demo,
  bench: [0, 0], swingT: -99, tag: null, surge: null, drill: false, lastTO: null, shivP: null,
  stats: { swings: 0, tags: 0, surgeSnaps: 0, iced: 0, icedMiss: 0, cpuIce: 0, drills: 0 },
  reset() {
    this.bench = [0, 0]; this.swingT = -99; this.tag = null; this.surge = null; this.drill = false; this.said = false; this.lastTO = null; this.shivP = null;
    this.bedStop();
  },

  // ======== momentum swings ========
  // a big play just moved the meter: the bench of the team that made it jumps up, the home crowd roars (or goes quiet)
  swung(side, amt, flip, m0) {
    if (!this.on() || amt < 10 || G.reviewing) return;
    const m1 = G.mo || 0, s = side === 0 ? 1 : -1;
    this.stats.swings++;
    this.bench[side] = Math.max(this.bench[side], amt >= 20 ? 2.2 : 1.4);
    if (side === 0) { G.crowdHype = Math.max(G.crowdHype || 0, amt >= 20 ? 1.4 : 0.9); this.roar(amt >= 20 ? 1 : 0.6); }
    else { G.crowdHype = Math.min(G.crowdHype || 0, 0.2); this.roar(0.25); } // the road team made it: the place groans
    // a real swing (it changed hands, and by a lot): a small tag, not more than once in a while
    if (flip && m0 * s < 5 && m1 * s >= 20) {
      this.surge = { side, n: 2 }; // riding it: a touch of the momentum edge for the next 2 snaps (Momentum.of)
      if (G.time - this.swingT > 40) { this.swingT = G.time; this.tag = { side, t: G.time }; this.stats.tags++; }
    }
  },
  // crowd sound: filtered noise that swells and fades (louder = more)
  roar(k) {
    const c = Sound.ctx; if (Sound.muted || !c) return;
    try {
      const t = c.currentTime, dur = 1.2 + k * 1.4, buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 + 0.13 * k, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.buffer = buf; s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur + 0.05);
    } catch (e) {}
  },
  // the bench along the near sideline: home on the left half, road team on the right. They jump when their team makes a play
  drawBench(g) {
    if (!this.on() || G.phase === 'hl') return;
    const y0 = FIELD_W + 1.9, S = 1.7; // (little bobbleheads: big helmet, small body)
    for (const side of [0, 1]) {
      const t = G.teams[side], lk = teamLook(t, side === 0, G.uni && G.uni[side]), hot = Math.min(1, this.bench[side] / 0.6), f = side === 0 ? 1 : -1;
      for (let i = 0; i < 10; i++) {
        const wxp = (side === 0 ? 37 : 62.5) + i * 2.25 + ((i * 7) % 3) * 0.3, row = i % 2;
        const x = sx(wxp), y = sy(y0 + row * 0.6);
        if (x < -30 || x > CW + 30 || y < -60 || y > CH + 60) continue;
        const j = hot > 0 ? Math.abs(Math.sin(G.time * 9 + i * 1.7)) * 14 * hot : Math.sin(G.time * 1.3 + i) * 0.8;
        const by = y - j;
        g.fillStyle = '#00000040'; g.beginPath(); g.ellipse(x, y + 1, 6 * S, 2 * S, 0, 0, 7); g.fill();
        g.strokeStyle = OUT; g.lineWidth = 2;
        if (hot > 0.3) { g.beginPath(); g.moveTo(x - 4 * S, by - 11 * S); g.lineTo(x - 7 * S, by - 19 * S); g.moveTo(x + 4 * S, by - 11 * S); g.lineTo(x + 7 * S, by - 19 * S); g.lineWidth = 3.4 * S; g.lineCap = 'round'; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 2.2 * S; g.strokeStyle = lk.jersey; g.stroke(); g.lineCap = 'butt'; g.lineWidth = 2; g.strokeStyle = OUT; } // arms up
        g.fillStyle = lk.pants || '#ddd'; g.fillRect(x - 4 * S, by - 5 * S, 8 * S, 5 * S); g.strokeRect(x - 4 * S, by - 5 * S, 8 * S, 5 * S);
        g.fillStyle = lk.jersey; roundRect(g, x - 5 * S, by - 14 * S, 10 * S, 10 * S, 2 * S); g.fill(); g.stroke();
        g.fillStyle = lk.helmet || t.c1; g.beginPath(); g.arc(x, by - 20 * S, 7 * S, 0, 7); g.fill(); g.stroke();
        g.fillStyle = lk.stripe || t.c2; g.fillRect(x - 1 * S, by - 27 * S, 2 * S, 7 * S);
        g.strokeStyle = lk.mask || '#888'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + f * 3 * S, by - 21 * S); g.lineTo(x + f * 7.5 * S, by - 21 * S); g.moveTo(x + f * 3 * S, by - 18 * S); g.lineTo(x + f * 7 * S, by - 18 * S); g.stroke();
      }
    }
  },
  // the swing tag: slides in under the play name at the top left for ~2.4 s
  drawTag(g) {
    const tg = this.tag; if (!tg || !G.teams) return;
    const a = G.time - tg.t; if (a < 0 || a > 2.4) { if (a > 2.4) this.tag = null; return; }
    const t = G.teams[tg.side], sl = 1 - Math.pow(1 - Math.min(1, a / 0.25), 3), fade = Math.min(1, (2.4 - a) * 3);
    g.save(); g.globalAlpha = fade;
    g.font = 'italic 900 20px "Barlow Condensed", "Arial Black", sans-serif';
    const txt = `MOMENTUM SWING  ·  ${t.name.toUpperCase()}`, w = g.measureText(txt).width + 34, x = -w + sl * (w + 10), y = 46;
    g.fillStyle = '#0b0f16e8'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - 10, y + 30); g.lineTo(x, y + 30); g.fill();
    g.fillStyle = barColor(t); g.fillRect(x, y, 6, 30);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, x + 16, y + 16);
    g.restore();
  },

  // ======== ice the kicker ========
  // the CPU coach ices your kicker: late, close, the kick ties it or puts you ahead, and he still has a timeout
  cpuIce(s) {
    const d = 1 - s;
    if (G.versus || G.online || G.coop || !isHumanSide(s) || isHumanSide(d) || G.challenge || !G.timeouts || G.timeouts[d] <= 0) return false;
    const m = G.score[s] - G.score[d], late = (G.quarter === 4 && G.clock <= 120) || G.quarter >= 5;
    if (!late || m < -3 || m > 2 || G.clock < 1) return false;
    return chance([0.25, 0.4, 0.5, 0.6][G.diff] || 0.4);
  },
  ice(by, cpu) {
    const km = G.km; if (!km) return;
    km.iced = 1; this.stats.iced++;
    const T = G.teams[by], kk = km.kk;
    if (cpu) { G.timeouts[by]--; G.pendingRunoff = 0; this.stats.cpuIce++; showBanner('TIMEOUT', `${T.name} ice the kicker  •  ${G.timeouts[by]} left`, '#9fdcff', 1.6); Sound.whistle(); }
    addPbp(`Iced! The ${T.name} call timeout to make ${kk.name} wait on the ${km.yds}-yard try.`);
    const k = G.O && G.O[0]; if (k) { k.shiver = true; this.shivP = k; addText(k.x, k.y - 2.2, 'ICED!', '#9fdcff', 18, 1.4); }
    if (km.cpuT == null) { // your meter: faster, with a narrower green
      km.rateP *= 1.15; km.rateA *= 1.22; km.tol *= 0.82; km.wait = Math.max(km.wait || 0, cpu ? 1.5 : 0.8);
    } else { // computer (or auto) kick: a little more likely to miss
      if (km.live && km.live.pre != null) km.live.pre += cpu ? 1.2 : 0.5;
      const good = km.power >= km.need && Math.abs(km.aim) <= km.tol;
      if (good && chance(0.14)) { km.aim = (chance(0.5) ? 1 : -1) * rand(km.tol * 1.15, km.tol * 1.8); this.stats.icedMiss++; }
    }
  },

  // ======== two-minute drill ========
  drillT: () => Math.min(120, (G.qtrLen || 180) * 0.67),
  drillNow() {
    if (!this.on() || G.phase === 'over' || G.challenge) return false;
    const late = (G.quarter === 4 || G.quarter >= 5) && G.clock <= this.drillT();
    return late && Math.abs(G.score[0] - G.score[1]) <= 8;
  },
  // the tighter camera: a small step in from whatever CAMERA setting you picked (main.js render)
  camK() { return this.drill && this.on() && !Highlights.on ? 1.07 : 1; },
  drawDrill(g, x, y) {
    if (!this.drill || !this.on()) return;
    const w = 96, h = 22, p = 0.55 + 0.45 * Math.abs(Math.sin(G.time * 2.4));
    g.fillStyle = '#0b0f16e8'; roundRect(g, x, y, w, h, 2); g.fill();
    g.fillStyle = `rgba(232,40,28,${p})`; g.fillRect(x, y, 4, h);
    g.fillStyle = '#ffd23f'; g.font = 'italic 900 15px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('2:00 DRILL', x + 12, y + h / 2 + 1);
  },
  // the drum bed: stadium drums (boom boom clap) over a low crowd rumble. Only real-sounding parts (no beeps)
  bed: null,
  bedOn() {
    const c = Sound.ctx; if (!c || this.bed) return;
    try {
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      src.buffer = buf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 520;
      g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.045, c.currentTime + 1.2);
      lfo.frequency.value = 0.18; lg.gain.value = 0.015; lfo.connect(lg); lg.connect(g.gain); // the crowd swells and settles
      src.connect(f); f.connect(g); g.connect(c.destination); src.start(); lfo.start();
      this.bed = { src, g, lfo, next: c.currentTime + 0.4, i: 0 };
    } catch (e) { this.bed = null; }
  },
  bedStop() {
    const b = this.bed; this.bed = null; if (!b) return;
    try { const t = Sound.ctx.currentTime; b.g.gain.cancelScheduledValues(t); b.g.gain.setValueAtTime(Math.max(0.0001, b.g.gain.value), t); b.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); b.src.stop(t + 0.7); b.lfo.stop(t + 0.7); } catch (e) {}
  },
  bedTick() {
    const b = this.bed, c = Sound.ctx; if (!b || !c) return;
    const beat = 0.36;
    while (b.next < c.currentTime + 0.25) {
      const dl = Math.max(0, b.next - c.currentTime), k = b.i % 4;
      if (k === 0 || k === 1) Sound.tone(78, 0.28, 'sine', 0.2, -36, dl);          // boom, boom
      else if (k === 2) { Sound.noise(0.06, 0.07, 1400, dl); Sound.noise(0.05, 0.05, 1800, dl + 0.012); } // clap
      b.next += beat; b.i++;
    }
  },

  // every update: bench timers, kicker shiver, the drill switch (only between plays, so the camera never jumps mid-play), the bed
  tick(dt) {
    if (!G.teams) return this.bedStop();
    if (G.paused) return this.bedStop();
    this.bench[0] = Math.max(0, this.bench[0] - dt); this.bench[1] = Math.max(0, this.bench[1] - dt);
    // dead ball after a big play: the camera leans toward the sideline so you see the bench go up
    const hotB = Math.max(this.bench[0], this.bench[1]);
    if (hotB > 0.4 && G.phase === 'dead' && !G.mini && !cam.focus && !G.players.some(p => p.celly)) {
      const yr = Math.max(0, 6 - (1 / viewZ - 1) * 15), yc = MID + (1 - viewZ) * 6;
      cam.y += (yc + yr - cam.y) * (1 - Math.exp(-dt * 2.5));
    }
    const sp = this.shivP;
    if (sp && !(G.phase === 'kickmeter' && G.km && G.km.iced && !(G.km.live && G.km.live.kicked != null))) { sp.shiver = false; this.shivP = null; }
    if (G.phase === 'playcall' || G.phase === 'dead' || G.phase === 'over' || G.demo || G.mini) {
      const on = this.drillNow();
      if (on !== this.drill) { this.drill = on; if (on && !this.said) { this.said = true; this.stats.drills++; addPbp('Two-minute drill. Every second counts now.'); } }
    }
    const want = this.drill && this.on() && !Sound.muted && !Highlights.on && G.phase !== 'replay' && G.phase !== 'review' && !(typeof document !== 'undefined' && document.hidden);
    if (want && !this.bed) this.bedOn(); else if (!want && this.bed) this.bedStop();
    if (this.bed) this.bedTick();
  }
};

// ---- hooks ----
// a new game: clean slate
{ const _ng = newGame; newGame = function (...a) { const r = _ng.apply(this, a); Flow.reset(); return r; }; }
// every game step
{ const _u = update; update = function (dt) { _u(dt); try { Flow.tick(dt); } catch (e) { console.error('flow', e); } }; }
// momentum: watch the big swings (rules.js), the short surge after one, count it down a snap at a time
{
  const _sw = Momentum.swing.bind(Momentum), _of = Momentum.of.bind(Momentum), _ap = Momentum.afterPlay.bind(Momentum);
  Momentum.swing = (side, amt, flip) => { const m0 = G.mo || 0; _sw(side, amt, flip); if (G.mo !== m0) Flow.swung(side, amt, flip, m0); };
  Momentum.of = side => { const v = _of(side), s = Flow.surge; return s && s.n > 0 && s.side === side && Momentum.on() ? Math.max(v, 0.35) : v; };
  Momentum.afterPlay = (res, d0) => { const s = Flow.surge; if (s && s.n > 0) { Flow.stats.surgeSnaps++; s.n--; } _ap(res, d0); };
}
// timeouts: remember a defensive timeout (a field goal on the very same snap = iced)
{ const _ct = callTimeout; callTimeout = function (side) {
  const r = _ct(side);
  if (r && G.teams && side !== G.poss) Flow.lastTO = { side, poss: G.poss, down: G.down, los: G.los, q: G.quarter };
  return r;
}; }
// field goals: iced by your timeout, or the CPU coach ices yours
{ const _dk = doKick; doKick = function (kind) {
  const s = G.poss, t = Flow.lastTO; Flow.lastTO = null;
  let by = null, cpu = false;
  if (kind === 'fg' && Flow.on()) {
    if (t && t.side === 1 - s && t.poss === s && t.down === G.down && t.los === G.los && t.q === G.quarter) by = t.side;
    else if (Flow.cpuIce(s)) { by = 1 - s; cpu = true; }
  }
  const r = _dk(kind);
  if (by != null && G.km && G.km.kind === 'fg') Flow.ice(by, cpu);
  return r;
}; }
