// ---- tiny synth sound effects (no audio files needed) ----
const Sound = {
  ctx: null, muted: false,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, dur, type = 'square', vol = 0.12, slide = 0, delay = 0) {
    if (this.muted || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, hp = 400, delay = 0) {
    if (this.muted || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  },
  whistle() { this.tone(2300, 0.35, 'sine', 0.08); this.tone(2450, 0.35, 'sine', 0.05); },
  hike() { this.tone(180, 0.12, 'square', 0.1, -60); },
  throw() { this.tone(500, 0.18, 'triangle', 0.1, 400); },
  catch() { this.tone(660, 0.08, 'square', 0.08); this.tone(990, 0.1, 'square', 0.08, 0, 0.07); },
  tackle() { this.noise(0.18, 0.35, 150); this.tone(90, 0.2, 'sine', 0.25, -40); },
  juke() { this.tone(300, 0.1, 'sawtooth', 0.06, 500); },
  boing() { this.tone(240, 0.25, 'sine', 0.12, 300); },
  bad() { this.tone(220, 0.25, 'square', 0.1, -120); this.tone(160, 0.35, 'square', 0.1, -80, 0.2); },
  crowd(big) { this.noise(big ? 2.2 : 0.9, big ? 0.22 : 0.1, 700); },
  td() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'square', 0.1, 0, i * 0.13)); this.crowd(true); },
  click() { this.tone(800, 0.04, 'square', 0.05); }
};
