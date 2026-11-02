// ---- Game sound: real recordings (pads + helmets, stadium crowd, ref whistle) and the orchestral menu theme ----
// All of it lives in audio/ (sources + licenses in audio/CREDITS.txt). Files load once after the first tap and stay decoded.
// Everything goes through one master gain, so the sound button mutes all of it at once.
// tone() / noise() are still here for the little celly / UI sounds (sine + noise only: Trey: no 8-bit beeps)
const Sound = {
  ctx: null, muted: false, out: null, buf: {}, voices: [],
  FILES: { hits: 'audio/hits.mp3', fx: 'audio/crowd_fx.mp3', bed: 'audio/crowd_bed.mp3', hype: 'audio/crowd_hype.mp3', theme: 'audio/theme.mp3', hub: 'audio/hub.mp3', stTd: 'audio/sting_td.mp3', stKick: 'audio/sting_kick.mp3' },
  // sprite slots: [start, length] in seconds, counted from 0.25 s after the marker click at the top of the file
  HITS: { thud1: [0, 0.323], thud2: [0.383, 0.323], thud3: [0.766, 0.323], thud4: [1.149, 0.323], body1: [1.532, 0.504], body2: [2.096, 0.504], body3: [2.66, 0.504], body4: [3.224, 0.504], body5: [3.788, 0.504],
    clack: [4.352, 0.452], fall: [4.864, 1.205], impact1: [6.129, 0.604], impact2: [6.793, 0.604], impact3: [7.457, 0.604], bodyhit: [8.121, 0.503], sub: [8.684, 0.502] },
  FX: { cheerBig: [0, 8.15], cheer: [8.21, 4.8], cheer2: [13.07, 4.8], ooh: [17.93, 5], groan: [22.99, 3], boo: [26.05, 6], boo2: [32.11, 5.5],
    clap1: [37.67, 0.324], clap2: [38.054, 0.324], clap3: [38.438, 0.324], whistle: [38.822, 1.4], whistle2: [40.282, 0.53], drum: [40.872, 1] },
  init() {
    // iPhone: the silent switch mutes web game sound unless we ask for 'playback' (iOS 17+), older iOS: a silent <audio> loop does the same
    if (!this.unlocked) { this.unlocked = true;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      try { const a = new Audio('data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAACAE00QSBpc29taXNvMgAAAAhmcmVlAAAAGm1kYXQhEAUgpBv/wAAAAAAAAAAAAAAAAAAAAA=='); a.loop = true; a.volume = 0.01; a.setAttribute('playsinline', ''); a.play().catch(() => {}); this.keep = a; } catch (e) {} }
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.ctx && !this.out) { // master gain -> a soft limiter (stacked hits + a roaring crowd never clip on phone speakers)
      const c = this.ctx, lim = c.createDynamicsCompressor(); lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 10; lim.attack.value = 0.003; lim.release.value = 0.2;
      this.out = c.createGain(); this.out.connect(lim); lim.connect(c.destination); this.load();
    }
  },
  // fetch + decode one file at a time (menu music first) so a phone never chokes on all of them at once
  load() {
    const order = ['theme', 'hits', 'fx', 'bed', 'hype', 'stTd', 'stKick', 'hub'];
    const next = () => {
      const k = order.shift(); if (!k) return;
      fetch(this.FILES[k]).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
        .then(ab => new Promise((ok, no) => { const p = this.ctx.decodeAudioData(ab, ok, no); if (p && p.catch) p.catch(no); }))
        .then(b => { this.buf[k] = { b, at: k.startsWith('st') ? 0 : this.marker(b) }; }, () => {}).then(next);
    };
    next();
  },
  // every loop / sprite file starts with a one-sample click, then 0.25 s of silence: works out the decoder's start delay on any browser
  marker(b) { const d = b.getChannelData(0), n = Math.min(d.length, Math.floor(b.sampleRate * 0.12)); let k = 0, m = 0; for (let i = 0; i < n; i++) if (Math.abs(d[i]) > m) { m = Math.abs(d[i]); k = i; } return k / b.sampleRate + 0.25; },
  live() { return !this.muted && this.ctx && this.out && this.ctx.state === 'running'; },
  // one sprite slot through the master gain. Hits: max 10 at once, crowd: max 5 (the oldest of that kind gets cut)
  spr(file, slot, vol = 1, rate = 1, delay = 0) {
    const B = this.buf[file], s = (file === 'hits' ? this.HITS : this.FX)[slot];
    if (!B || !s || !this.live() || vol <= 0) return null;
    const c = this.ctx, t = c.currentTime + Math.max(0, delay);
    this.voices = this.voices.filter(v => v.end > c.currentTime);
    const mine = this.voices.filter(v => v.f === file);
    if (mine.length >= (file === 'hits' ? 10 : 5)) { const v = mine[0]; this.voices.splice(this.voices.indexOf(v), 1); try { v.g.gain.setTargetAtTime(0, c.currentTime, 0.02); v.s.stop(c.currentTime + 0.1); } catch (e) {} }
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = B.b; src.playbackRate.value = rate; g.gain.value = vol;
    src.connect(g); g.connect(this.out); src.start(t, B.at + s[0], s[1]);
    const v = { s: src, g, f: file, end: t + s[1] / rate }; this.voices.push(v); return v;
  },
  // named sound events. The online host's calls get replayed on the guest (net.js), so every game sound goes through here
  sfx(kind, k = 1, dl = 0) {
    if (!this.live() || (G.demo && kind !== 'sting')) return; // the demo game behind the title menu stays quiet (the theme plays)
    const r = (a, b) => a + Math.random() * (b - a), one = (...a) => a[Math.floor(Math.random() * a.length)];
    const H = (n, v, rt = 1, dl = 0) => this.spr('hits', n, 0.8 * v * r(0.85, 1.1), rt * r(0.93, 1.07), dl);
    switch (kind) {
      // pads + helmets: a padded thud, a body layer and a helmet clack, each picked and pitched at random
      case 'hit': H(one('thud1', 'thud2', 'thud3', 'thud4'), 0.85); H(one('body1', 'body2', 'body3', 'body4', 'body5'), 0.55); H('clack', 0.32, r(1, 1.25)); H('sub', 0.35, r(1.1, 1.3)); break;
      case 'big': // BOOM / hit stick: everything louder and lower, and often the crowd going "OHHH"
        H(one('impact1', 'impact2', 'impact3'), 1, 0.9); H(one('body1', 'body2', 'body3'), 0.85, 0.88); H('clack', 0.75, r(0.85, 1)); H('sub', 0.9, 0.9); H(one('thud1', 'thud2'), 0.6, 0.85, 0.012);
        if (Math.random() < 0.5) this.spr('fx', 'ooh', 0.5 * k, r(0.95, 1.05), 0.15); break;
      case 'sack': H('fall', 0.8); H(one('thud1', 'thud3'), 0.8, 0.9); H(one('body2', 'body4'), 0.6); H('clack', 0.4, r(0.95, 1.15), 0.02); H('sub', 0.6, 0.95); break;
      case 'gang': // a pile: three or four hits stacking up, then the ground
        for (let i = 0; i < 3; i++) { const dl = i * r(0.06, 0.1); H(one('thud1', 'thud2', 'thud3', 'thud4'), 0.75 - i * 0.08, 1, dl); if (i !== 1) H('clack', 0.3, r(0.95, 1.3), dl + 0.01); }
        H(one('body1', 'body5'), 0.6); H('fall', 0.45, 1, 0.18); break;
      case 'spike': H('bodyhit', 0.45, r(1.5, 1.7)); break;
      case 'catch': H(one('thud2', 'thud3', 'thud4'), 0.16 * k, r(1.7, 2)); break;
      case 'whistle': this.spr('fx', Math.random() < 0.7 ? 'whistle' : 'whistle2', 0.26, r(0.98, 1.03)); break;
      // crowd reactions (k = how big, 0..1+)
      case 'cheerBig': this.spr('fx', 'cheerBig', 0.8 * k, r(0.97, 1.03), dl); break;
      case 'cheer': this.spr('fx', one('cheer', 'cheer2'), 0.62 * k, r(0.96, 1.04), dl); break;
      case 'ooh': this.spr('fx', 'ooh', 0.55 * k, r(0.96, 1.04), dl); break;
      case 'groan': this.spr('fx', 'groan', 0.6 * k, r(0.94, 1.04), dl); break;
      case 'boo': this.spr('fx', one('boo', 'boo2'), 0.55 * k, r(0.97, 1.03), dl); break;
      case 'drum': this.spr('fx', 'drum', 0.5 * k, r(0.98, 1.02), dl); break;
      case 'clap': this.spr('fx', one('clap1', 'clap2', 'clap3'), 0.42 * k, r(0.97, 1.03), dl); break;
      case 'sting': Music.sting(k === 2 ? 'stKick' : 'stTd', k === 3 ? 0.86 : 0); break;
    }
  },
  tone(freq, dur, type = 'square', vol = 0.12, slide = 0, delay = 0) {
    if (!this.live() || type !== 'sine') return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, hp = 400, delay = 0) {
    if (!this.live()) return;
    const c = this.ctx, t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(this.out); s.start(t);
  },
  whistle() { this.sfx('whistle'); },
  hike() {},
  throw() {},
  catch() { this.sfx('catch'); },
  // kind: 'hit' (normal), 'big' (BOOM / hit stick), 'sack', 'gang', 'spike'
  tackle(kind) { this.sfx(kind || 'hit'); },
  juke() {},
  boing() {},
  bad() {},
  crowd(big) { this.sfx(big ? 'cheerBig' : 'cheer', big ? 1 : 0.7); },
  // a score / a win: in a game the crowd reacts (CrowdFX: cheer or boo, the brass sting on touchdowns), in the menus a short brass hit
  td() { if (G.teams && !G.demo) { if (typeof CrowdFX !== 'undefined') CrowdFX.scored(); } else this.sfx('sting', 3); },
  thunder(delay = 0.5) { this.noise(2.4, 0.4, 35, delay); this.tone(48, 1.6, 'sine', 0.22, -12, delay); this.noise(1.2, 0.2, 120, delay + 0.3); },
  click() {}
};
// the sound button: mute right away (fades the master gain, so long crowd sounds stop too)
setInterval(() => { const S = Sound; if (S.out && S.ctx) { const v = S.muted ? 0 : 1; if (Math.abs(S.out.gain.value - v) > 0.01) S.out.gain.setTargetAtTime(v, S.ctx.currentTime, 0.05); } }, 120);
