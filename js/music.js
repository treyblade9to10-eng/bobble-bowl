// ---- Menu music: two little loops made right here with Web Audio (no songs, no sound files) ----
// 'stadium' = drums + bass + brass riff for the title and menus, 'hub' = a calm keys groove for the Season hub.
// Never during a game. Starts after the first tap/key (phones only allow sound after you touch something).
const ShowOpts = (() => {
  let o = {}; try { o = JSON.parse(localStorage.getItem('bobbleShow') || '{}') || {}; } catch (e) {}
  return {
    get intro() { return o.intro !== 0; }, // stadium fly-over before kickoff
    get music() { return o.music || 'med'; }, // off / low / med / high
    set(k, v) { o[k] = v; try { localStorage.setItem('bobbleShow', JSON.stringify(o)); } catch (e) {} }
  };
})();

const Music = {
  VOL: { off: 0, low: 0.22, med: 0.42, high: 0.7 },
  cur: null, out: null, tracks: {}, timer: null, step: 0, next: 0, noiseBuf: null,
  // who should be playing right now
  want() {
    if (this.VOL[ShowOpts.music] === 0 || Sound.muted || document.hidden || !Sound.ctx || Sound.ctx.state !== 'running') return null;
    if (G.teams && !G.demo) return null; // a game is on (or its pause / halftime / final screen)
    if ((typeof Highlights !== 'undefined' && Highlights.on) || (typeof Broadcast !== 'undefined' && Broadcast.on) || (typeof Flyover !== 'undefined' && Flyover.on)) return null;
    const calm = ['seasonHub', 'offseason', 'draft', 'recap', 'depth', 'combine', 'trade', 'cap'].some(id => { const e = $(id); return e && e.classList.contains('show'); });
    return calm ? 'hub' : 'stadium';
  },
  tick() {
    const w = this.want();
    if (w !== this.cur) this.switchTo(w);
    else if (this.out) { const v = this.VOL[ShowOpts.music]; if (Math.abs(this.out.gain.value - v) > 0.01 && !this.fading) this.out.gain.setTargetAtTime(v, Sound.ctx.currentTime, 0.2); }
  },
  setup() {
    const c = Sound.ctx;
    if (this.out && this.out.context === c) return;
    this.out = c.createGain(); this.out.gain.value = 0; this.out.connect(c.destination);
    // a little echo so the brass sounds like it's in a big stadium
    this.dly = c.createDelay(1); this.dly.delayTime.value = 0.21; this.fb = c.createGain(); this.fb.gain.value = 0.22; this.dlp = c.createBiquadFilter(); this.dlp.type = 'lowpass'; this.dlp.frequency.value = 1800;
    this.dly.connect(this.dlp); this.dlp.connect(this.fb); this.fb.connect(this.dly); this.dlp.connect(this.out);
    const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = n;
  },
  switchTo(w) {
    const c = Sound.ctx;
    this.cur = w;
    if (!c) return;
    if (!w) { // fade out, then stop scheduling
      if (this.out) { this.fading = true; this.out.gain.cancelScheduledValues(c.currentTime); this.out.gain.setValueAtTime(this.out.gain.value, c.currentTime); this.out.gain.linearRampToValueAtTime(0, c.currentTime + 1.2); }
      clearTimeout(this.stopT); this.stopT = setTimeout(() => { if (!this.cur) { clearInterval(this.timer); this.timer = null; this.fading = false; } }, 1300);
      return;
    }
    this.setup(); clearTimeout(this.stopT); this.fading = false;
    const v = this.VOL[ShowOpts.music], t = c.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(0, t); this.out.gain.linearRampToValueAtTime(v, t + 1.5);
    this.track = this.TRACKS[w]; this.step = 0; this.next = t + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.pump(), 60);
  },
  // schedule the notes for the next quarter second
  pump() {
    const c = Sound.ctx; if (!c || !this.track || !this.cur) return;
    if (this.next < c.currentTime - 0.3) this.next = c.currentTime + 0.05; // tab was asleep: don't play a pile of catch-up notes
    const tr = this.track, sp = 60 / tr.bpm / 4;
    while (this.next < c.currentTime + 0.25) { tr.play(this, this.step, this.next, sp); this.step = (this.step + 1) % (16 * tr.bars); this.next += sp; }
  },
  // ---- instruments ----
  env(g, t, a, peak, dec, sus = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec); },
  osc(type, f, t, end, to) { const o = Sound.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(to); o.start(t); o.stop(end); return o; },
  kick(t, v = 1) { const c = Sound.ctx, g = c.createGain(); g.connect(this.out); this.env(g, t, 0.004, 0.9 * v, 0.28); const o = this.osc('sine', 150, t, t + 0.32, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.13); },
  noise(t, dur, v, type, f, q = 0.8) { const c = Sound.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); fl.connect(g); g.connect(this.out); this.env(g, t, 0.002, v, dur); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); return g; },
  snare(t, v = 1) { this.noise(t, 0.17, 0.42 * v, 'bandpass', 1900, 0.7); const c = Sound.ctx, g = c.createGain(); g.connect(this.out); this.env(g, t, 0.002, 0.25 * v, 0.07); this.osc('sine', 195, t, t + 0.1, g); },
  hat(t, v = 1) { this.noise(t, 0.035, 0.12 * v, 'highpass', 7500, 0.5); },
  bass(t, m, len, v = 1) {
    const c = Sound.ctx, f = 440 * Math.pow(2, (m - 69) / 12), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g); g.connect(this.out);
    this.env(g, t, 0.01, 0.5 * v, len * 0.9, 0.05); this.osc('triangle', f, t, t + len + 0.05, lp); this.osc('sine', f / 2, t, t + len + 0.05, lp);
  },
  brass(t, m, len, v = 1) { // two slightly detuned saws through a filter that opens up = a brassy stab
    const c = Sound.ctx, f = 440 * Math.pow(2, (m - 69) / 12), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5; lp.connect(g); g.connect(this.out); g.connect(this.dly);
    lp.frequency.setValueAtTime(450, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.05); lp.frequency.exponentialRampToValueAtTime(1100, t + Math.max(0.12, len));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11 * v, t + 0.025); g.gain.setValueAtTime(0.09 * v, t + Math.max(0.03, len - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.1);
    for (const dt of [-7, 7]) { const o = this.osc('sawtooth', f, t, t + len + 0.12, lp); o.detune.value = dt; }
  },
  keys(t, m, len, v = 1) { // soft electric-piano-ish: a sine plus a quiet overtone that fades first
    const c = Sound.ctx, f = 440 * Math.pow(2, (m - 69) / 12), g = c.createGain(), g2 = c.createGain(); g.connect(this.out); g2.connect(this.out); g.connect(this.dly);
    this.env(g, t, 0.01, 0.075 * v, len); this.env(g2, t, 0.005, 0.03 * v, len * 0.35);
    this.osc('sine', f, t, t + len + 0.05, g); this.osc('sine', f * 2, t, t + len * 0.4 + 0.05, g2);
  },
  TRACKS: {}
};
// stadium loop: D minor, 112 bpm, 8 bars. Kick-kick-snare stomp, driving bass, a brass riff answering itself
Music.TRACKS.stadium = (() => {
  const roots = [38, 38, 46, 48, 38, 38, 46, 45]; // D D Bb C D D Bb A
  const riff = [ // [step, note, 16ths] per bar
    [[0, 62, 2], [3, 62, 1], [6, 65, 2], [8, 64, 1], [10, 62, 2], [14, 57, 2]],
    [[0, 62, 2], [3, 62, 1], [6, 65, 2], [8, 67, 1], [10, 69, 4]],
    [[0, 65, 3], [6, 62, 1], [8, 65, 2], [12, 67, 3]],
    [[0, 67, 3], [6, 64, 1], [8, 67, 2], [12, 69, 3]],
    [[0, 69, 2], [3, 69, 1], [6, 72, 2], [8, 70, 1], [10, 69, 2], [14, 65, 2]],
    [[0, 69, 2], [3, 67, 1], [6, 65, 2], [8, 64, 1], [10, 62, 4]],
    [[0, 70, 2], [3, 69, 1], [6, 67, 2], [10, 65, 2], [12, 67, 2]],
    [[0, 69, 6], [8, 61, 2], [12, 64, 3]]
  ];
  return {
    bpm: 112, bars: 8,
    play(M, s, t, sp) {
      const bar = s >> 4, i = s & 15, r = roots[bar];
      if (i === 0 || i === 8 || (i === 10 && bar % 2 === 1)) M.kick(t);
      if (i === 4 || i === 12) M.snare(t);
      if (bar === 7 && i >= 8 && i !== 12) M.snare(t, 0.25 + (i - 8) * 0.07); // roll into the top of the loop
      if (i % 2 === 0) M.hat(t, i % 4 === 2 ? 1 : 0.6);
      if ([0, 3, 6, 8, 10, 14].includes(i)) M.bass(t, r + (i === 6 || i === 14 ? 12 : 0), sp * 1.6);
      for (const [st, m, n] of riff[bar]) if (st === i) { M.brass(t, m, sp * n); M.brass(t, m - 7, sp * n, 0.6); }
    }
  };
})();
// season hub loop: C major, 86 bpm, 4 bars. Laid back keys, soft kick and shaker
Music.TRACKS.hub = (() => {
  const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]], roots = [36, 33, 41, 43];
  const arp = [0, 2, 1, 3, 2, 1, 3, 2];
  return {
    bpm: 86, bars: 4,
    play(M, s, t, sp) {
      const bar = s >> 4, i = s & 15, ch = chords[bar];
      if (i === 0 || i === 10) for (const m of ch) M.keys(t, m, sp * 7, 0.8);
      if (i % 2 === 0 && i > 0) M.keys(t, ch[arp[i >> 1]] + 12, sp * 3, 0.35);
      if (i === 0 || i === 7 || (i === 8 && bar % 2)) M.bass(t, roots[bar] + 12, sp * 3, 0.7);
      if (i === 0 || i === 8) M.kick(t, 0.5);
      if (i === 4 || i === 12) M.noise(t, 0.05, 0.08, 'bandpass', 3200, 1.2); // rim tap
      M.hat(t, i % 4 === 2 ? 0.35 : 0.15);
    }
  };
})();
(() => {
  // phones only let sound start from a touch: the first tap / key anywhere wakes the audio up
  const wake = () => { Sound.init(); Music.tick(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, wake, { passive: true });
  setInterval(() => { try { Music.tick(); } catch (e) {} }, 300);
  document.addEventListener('visibilitychange', () => { try { Music.tick(); } catch (e) {} });
  // the sound button mutes the music too (checked on the next tick, this makes it instant)
  const mb = $('btnMute'); if (mb) mb.addEventListener('click', () => setTimeout(() => Music.tick(), 0));
  // settings: PREGAME INTRO + MENU MUSIC rows in the Quick Game settings panel
  const body = $('muSetBody'); if (!body) return;
  const grp = document.createElement('div'); grp.className = 'muGrp'; grp.innerHTML = '<div class="muGh">SHOW</div>';
  const row = (label, id, opts, get, set) => {
    const r = document.createElement('div'); r.className = 'muRow'; r.id = 'muRow_' + id; r.innerHTML = `<span class="muL">${label}</span><div class="muC seg"></div>`;
    const c = r.querySelector('.muC'), paint = () => c.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(get())));
    for (const [v, txt] of opts) { const b = document.createElement('button'); b.dataset.v = v; b.textContent = txt; b.onclick = () => { set(v); Sound.click(); paint(); Music.tick(); }; c.appendChild(b); }
    paint(); grp.appendChild(r);
  };
  row('PREGAME INTRO', 'showIntro', [['1', 'ON'], ['0', 'OFF']], () => ShowOpts.intro ? '1' : '0', v => ShowOpts.set('intro', +v));
  row('MENU MUSIC', 'showMusic', [['off', 'OFF'], ['low', 'LOW'], ['med', 'MED'], ['high', 'HIGH']], () => ShowOpts.music, v => ShowOpts.set('music', v));
  body.appendChild(grp);
})();
