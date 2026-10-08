// ---- Instant replay: records every frame of a play, then plays big ones back in slow motion ----
const Replay = {
  frames: [], rec: false, on: false, t: 0, hold: 0,
  enabled: (() => { try { return localStorage.getItem('bobbleReplay') !== 'off'; } catch (e) { return true; } })(),
  setEnabled(v) { this.enabled = v; try { localStorage.setItem('bobbleReplay', v ? 'on' : 'off'); } catch (e) {} },

  begin() { this.frames = []; this.rec = !G.demo; },
  record() {
    if (!this.rec || !G.ball || this.frames.length > 60 * 20) return;
    const b = G.ball;
    this.frames.push({
      ps: G.players.map(p => [p.x, p.y, p.vx, p.vy, p.anim, p.speedNow, p.face.dir, p.down, p.downDir, p.dive, p.jump || 0, p.spin, p.stiff, p.throwAnim, p.celebrate,
        p.engaged ? 1 : 0, p.head.ox, p.head.oy, p.head.rot, p.mouth, p.dizzy, p.sprinting, p.hit || 0]),
      b: [b.x, b.y, b.z, b.spin || 0, G.players.indexOf(b.holder), b.flight ? { ...b.flight } : null],
      refs: (G.refs || []).map(r => [r.x, r.y, r.face, r.anim, r.moving, r.throwT]),
      cam: [cam.x, cam.y], time: G.time
    });
  },
  want() { return this.enabled && !G.demo && !G.online && !G.mini && G.lastResult && G.lastResult.big && this.frames.length > 40; },
  start() {
    this.rec = false; this.on = true; this.hold = 0.6;
    this.save = this.frames[this.frames.length - 1];
    this.endState = { celly: G.cellyGuy, time: G.time };
    this.t = Math.max(0, this.frames.length - 60 * 6.5); // last 6.5 seconds
    G.phase = 'replay'; G.banner = null; G.fx = G.fx.filter(f => f.kind === 'flag'); G.showTarget = false; G.aim = null;
    Sound.tone(880, 0.08, 'square', 0.04); Sound.tone(660, 0.1, 'square', 0.04, 0, 0.09);
  },
  apply(fr) {
    fr.ps.forEach((a, i) => {
      const p = G.players[i]; if (!p) return;
      [p.x, p.y, p.vx, p.vy, p.anim, p.speedNow, p.face.dir, p.down, p.downDir, p.dive, p.jump, p.spin, p.stiff, p.throwAnim, p.celebrate] = a;
      p.engaged = a[15] ? (p.engaged || true) : null; p.head.ox = a[16]; p.head.oy = a[17]; p.head.rot = a[18]; p.mouth = a[19]; p.dizzy = a[20]; p.sprinting = a[21]; p.hit = a[22];
    });
    const b = G.ball; [b.x, b.y, b.z, b.spin] = fr.b; b.holder = fr.b[4] >= 0 ? G.players[fr.b[4]] : null; b.flight = fr.b[5];
    fr.refs.forEach((a, i) => { const r = G.refs && G.refs[i]; if (r) [r.x, r.y, r.face, r.anim, r.moving, r.throwT] = a; });
    cam.x = fr.cam[0]; cam.y = fr.cam[1];
  },
  update(dt) {
    const skip = Input.hit('Space', 'Enter', 'Escape') || Input.taps.length > 0;
    this.t += dt * 60 * 0.55;
    G.time += dt * 0.55;
    if (this.t >= this.frames.length - 1) { this.t = this.frames.length - 1; this.hold -= dt; }
    this.apply(this.frames[Math.floor(this.t)]);
    if (skip || this.hold <= 0) this.finish();
  },
  finish() {
    this.on = false;
    this.apply(this.save); G.cellyGuy = null;
    for (const p of G.players) { p.celly = null; p.engaged = null; }
    G.phase = 'dead'; G.deadT = 0;
    afterPlay();
  },
  drawOverlay(g) {
    g.fillStyle = '#000'; g.fillRect(0, 0, CW, 44); g.fillRect(0, CH - 44, CW, 44);
    g.fillStyle = (G.time * 2 % 1) < 0.6 ? '#e8401c' : '#5a1a10'; g.beginPath(); g.arc(34, 22, 8, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'italic 900 28px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('REPLAY', 52, 23);
    g.font = '800 15px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#9aa6b5'; g.textAlign = 'right';
    g.fillText(G.mode === 'mobile' ? 'TAP TO SKIP' : 'SPACE TO SKIP', CW - 24, CH - 22);
    const L = G.pbpShow;
    if (L) { g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '600 18px "Barlow Condensed", Arial, sans-serif'; g.fillText(L.text.length > 100 ? L.text.slice(0, 97) + '...' : L.text, 24, CH - 22); }
  }
};
