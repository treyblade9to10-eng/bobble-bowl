// ---- Menu music: an orchestral sports theme (brass fanfare, timpani, drumline) for the title and menus,
// a calmer version of it for the Season hub. Both are loops in audio/ (made from free CC0 orchestra samples, see audio/CREDITS.txt).
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
  LOOP: { theme: 28.23529, hub: 35.55556 }, // loop length (s) of each file, after its marker (and intro)
  INTRO: { theme: 3.52942 }, // the theme opens with a 2-bar build (cymbal swell -> hit) that plays once, then the loop
  cur: null, src: null, g: null,
  // who should be playing right now
  want() {
    if (this.VOL[ShowOpts.music] === 0 || Sound.muted || document.hidden || !Sound.ctx || Sound.ctx.state !== 'running') return null;
    if (G.teams && !G.demo) return null; // a game is on (or its pause / halftime / final screen)
    if ((typeof Highlights !== 'undefined' && Highlights.on) || (typeof Broadcast !== 'undefined' && Broadcast.on) || (typeof Flyover !== 'undefined' && Flyover.on)) return null;
    const calm = ['seasonHub', 'offseason', 'draft', 'recap', 'depth', 'combine', 'trade', 'cap'].some(id => { const e = $(id); return e && e.classList.contains('show'); });
    return calm ? 'hub' : 'theme';
  },
  tick() {
    let w = this.want(); if (w && !Sound.buf[w]) w = null; // still loading: try again next tick
    if (w !== this.cur) this.switchTo(w);
    else if (this.g && !this.duck) { const v = this.VOL[ShowOpts.music]; if (Math.abs(this.g.gain.value - v) > 0.01) this.g.gain.setTargetAtTime(v, Sound.ctx.currentTime, 0.2); }
  },
  // fade out what's playing, fade the new loop in from the top
  switchTo(w) {
    const c = Sound.ctx; this.cur = w; if (!c) return;
    if (this.src) { const { src, g } = this, t = c.currentTime; try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1.2); src.stop(t + 1.3); } catch (e) {} this.src = this.g = null; }
    if (!w) return;
    const B = Sound.buf[w], t = c.currentTime + 0.05, src = c.createBufferSource(), g = c.createGain();
    src.buffer = B.b; src.loop = true; src.loopStart = B.at + (this.INTRO[w] || 0); src.loopEnd = src.loopStart + this.LOOP[w];
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(this.VOL[ShowOpts.music], t + 1.5);
    src.connect(g); g.connect(Sound.out); src.start(t, B.at);
    this.src = src; this.g = g;
  },
  // short brass + timpani hit: kickoff card, halftime, touchdowns, wins in the menus. Uses the MENU MUSIC volume (OFF = none)
  sting(k, from = 0) {
    const c = Sound.ctx, B = Sound.buf[k], v = this.VOL[ShowOpts.music];
    if (!B || !v || !Sound.live() || document.hidden) return;
    if (this.stT && c.currentTime - this.stT < 1.5) return; // never two on top of each other
    this.stT = c.currentTime;
    const src = c.createBufferSource(), g = c.createGain(); src.buffer = B.b; g.gain.value = Math.min(0.85, v * 1.3);
    src.connect(g); g.connect(Sound.out); src.start(c.currentTime + 0.02, B.at + from);
    if (this.g) { const t = c.currentTime; this.duck = true; this.g.gain.setTargetAtTime(v * 0.3, t, 0.05); this.g.gain.setTargetAtTime(v, t + B.b.duration - B.at - from - 0.5, 0.4); clearTimeout(this.duckT); this.duckT = setTimeout(() => { this.duck = false; }, (B.b.duration + 0.5) * 1000); }
  }
};
(() => {
  // phones only let sound start from a touch: the first tap / key anywhere wakes the audio up
  const wake = () => { Sound.init(); Music.tick(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, wake, { passive: true });
  setInterval(() => { try { Music.tick(); } catch (e) {} }, 300);
  document.addEventListener('visibilitychange', () => { try { Music.tick(); } catch (e) {} });
  // the sound button mutes the music too (checked on the next tick, this makes it instant)
  const mb = $('btnMute'); if (mb) mb.addEventListener('click', () => setTimeout(() => Music.tick(), 0));
  // stings: the TV matchup card before kickoff, halftime, the final
  if (typeof Broadcast !== 'undefined' && Broadcast.show) { const _bs = Broadcast.show.bind(Broadcast); Broadcast.show = (...a) => { const r = _bs(...a); if (Broadcast.on) Sound.sfx('sting', 2); return r; }; }
  { const _ht = G.hooks.onHalftime; G.hooks.onHalftime = (...a) => { if (!G.demo) Sound.sfx('sting', 2); return _ht && _ht(...a); }; }
  { const _go = G.hooks.onGameOver; G.hooks.onGameOver = (...a) => { if (!G.demo) Sound.sfx('sting', 2); return _go && _go(...a); }; }
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
