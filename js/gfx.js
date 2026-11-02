// ---- GRAPHICS setting: AUTO / HIGH / FAST ----
// FAST is for slow computers (Chromebooks) and old phones: the game is painted on a smaller canvas (the browser
// stretches it to fill the screen), night lights + rain/snow get simpler and the moving menu decorations stop.
// HIGH = everything as before. AUTO starts on HIGH and watches the first seconds of play: if frames keep running
// long it flips to FAST (and remembers that for the next visits). Gameplay speed never depends on this (main.js stepUpdate).
const Gfx = {
  pref: 'auto', auto: false, fast: false, why: '',
  SCALE: 0.75,      // FAST canvas size (0.75 x 0.75 = a bit over half the pixels to paint)
  hint: (() => { const n = navigator.hardwareConcurrency || 8, m = navigator.deviceMemory || 8, cros = /CrOS/.test(navigator.userAgent);
    return { weak: (n <= 4 && m <= 4) || (cros && (n <= 4 || m <= 4)), some: n <= 4 || m <= 4 }; })(),
  init(pref) {
    try { const a = JSON.parse(localStorage.getItem('bobbleGfxAuto') || 'null'); if (a && a.f && Date.now() - a.t < 14 * 864e5) { this.auto = true; this.why = a.why || 'slow'; } } catch (e) {}
    if (!this.auto && this.hint.weak) { this.auto = true; this.why = 'device'; }
    this.set(pref);
  },
  set(v) {
    this.pref = ['auto', 'high', 'fast'].includes(v) ? v : 'auto';
    const f = this.pref === 'fast' || (this.pref === 'auto' && this.auto);
    this.fast = f; RS = f ? this.SCALE : 1;
    if (document.body) document.body.classList.toggle('gfxFast', f);
    if (typeof fitCanvas === 'function') fitCanvas();
    this.n = 0; this.gaps = []; this.work = [];
  },
  label() { return this.pref === 'auto' ? 'AUTO' + (this.fast ? ' (FAST)' : '') : this.pref.toUpperCase(); },
  desc() { return this.pref + (this.fast ? ':fast' : ':high') + (this.why ? '/' + this.why : ''); },
  // AUTO: one sample per frame while a game (or the title screen) is on. gap = time since the last frame, work = our own JS time
  gaps: [], work: [], n: 0,
  sample(gap, work, on) {
    if (this.pref !== 'auto' || this.fast) return;
    if (!on || gap > 250 || document.hidden) { this.n = 0; return; } // (menus, a hidden tab or one big hitch don't count)
    if (++this.n < 30) return; // let the first frames after a screen change settle
    this.gaps.push(gap); this.work.push(work);
    if (this.gaps.length < 100) return;
    const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1], g = med(this.gaps), w = med(this.work);
    this.gaps = []; this.work = [];
    // under ~48 fps (or our own work alone eating most of a 60 fps frame): FAST
    if (g > (this.hint.some ? 18.5 : 20.5) || w > 10) {
      this.auto = true; this.why = 'slow';
      try { localStorage.setItem('bobbleGfxAuto', JSON.stringify({ f: 1, t: Date.now(), why: 'slow' })); } catch (e) {}
      this.set('auto');
      if (typeof gfxLabel === 'function') gfxLabel();
    }
  }
};
