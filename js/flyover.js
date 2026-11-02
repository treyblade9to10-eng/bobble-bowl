// ---- Stadium fly-over before kickoff: a sweep over the stadium with its name, then the home team runs out of the tunnel ----
// Plays after the broadcast matchup card (Quick Game + Season). Tap / any key / any pad button skips. Off in settings (SHOW).
// Online games skip it, so nobody waits on the other player. The real game is paused underneath and never touched:
// the runners only exist while the intro is drawn.
const Flyover = {
  on: false, pending: false, DUR: 5.6, CUT: 2.5,
  ok() { return ShowOpts.intro && G.teams && !G.demo && !G.online && !G.challenge && !G.mini && !G.scenario && !G.practice && !G.career; },
  start() {
    this.pending = false;
    if (!this.ok()) return;
    const home = G.teams[0], d = dirOf(0), end = goalX(1) - d * 10; // home team's end line (they come out behind their own end zone)
    this.on = true; this.t = 0; this.last = this.t0 = performance.now(); this.camX = end + d * 14; this.d = d; this.end = end; this.cheer = 0;
    this.hx = goalX(1) + d * 9; this.ty = MID + 9; // where they huddle up / the tunnel (off to the side of the goal post)
    // the whole home roster, in the order they come out (QB carries the flag)
    const tup = home.off.concat(home.def);
    this.runners = tup.map((tp, i) => {
      const p = makePlayer(0, i < home.off.length, i, tp); p.face.dir = d; p.isHuman = false;
      const a = (i / tup.length) * Math.PI * 2;
      Object.assign(p, { x: end - d * 0.5, y: this.ty + [0, -1, 1][i % 3] * 0.9, go: 0.15 + i * 0.085, tx: this.hx + Math.cos(a) * 3.6, ty: MID + 2 + Math.sin(a) * 3.2, out: false });
      p.celly = { type: 'runout', t: 0, fx: {}, flag: i === 0 };
      return p;
    });
    this.puffs = [];
    G.paused = true; G.flyPause = true;
    this.hidden = $('playcall').classList.contains('show'); // your kickoff call waits until the intro is done
    if (this.hidden) $('playcall').classList.remove('show');
    document.body.classList.add('flyOn');
    Sound.crowd(false);
    requestAnimationFrame(() => this.loop());
  },
  close() {
    if (!this.on) return;
    this.on = false; this.runners = null; document.body.classList.remove('flyOn');
    if (G.flyPause) { G.paused = false; G.flyPause = false; }
    if (this.hidden && G.teams && !G.demo && G.phase === 'playcall') show('playcall');
    this.hidden = false; G.crowdHype = Math.max(G.crowdHype || 0, 1.2);
  },
  loop() {
    if (!this.on) return;
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!G.teams || G.demo || G.online) return this.close();
    this.t = (now - this.t0) / 1000; G.time += dt; // real time, so a slow phone doesn't drag it out (rain / snow keep falling)
    if (this.t > this.DUR) return this.close();
    try { this.update(dt); } catch (e) { console.error('flyover', e); return this.close(); }
    if (this.padHit()) return this.close();
    requestAnimationFrame(() => this.loop());
  },
  padHit() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(p => p && p.connected) : [];
    const down = pads.some(p => p.buttons.some(b => b && b.pressed));
    const hit = down && this.padUp; this.padUp = !down; return hit;
  },
  update(dt) {
    const t = this.t - this.CUT; if (t < 0) return;
    if (!this.cheer && t > 0.1) { this.cheer = 1; Sound.crowd(true); }
    if (this.cheer === 1 && t > 1.5) { this.cheer = 2; Sound.crowd(true); }
    G.crowdHype = Math.min(2.4, 0.4 + t * 1.2);
    // the camera drifts along with the pack
    const out = this.runners.filter(p => p.out), ax = out.length ? out.reduce((a, p) => a + p.x, 0) / out.length : this.end, d = this.d;
    const want = d > 0 ? Math.max(this.end + 14, ax + 4) : Math.min(this.end - 14, ax - 4);
    this.camX = this.camX == null ? this.end + d * 14 : lerp(this.camX, want, 1 - Math.exp(-dt * 2));
    for (const p of this.runners) {
      p.celly.t += dt;
      if (t < p.go) continue;
      if (!p.out) { p.out = true; for (let k = 0; k < 2; k++) this.puffs.push({ x: this.end + this.d * 0.6, y: p.y + (Math.random() - 0.5) * 2, life: 1, r: 6 }); }
      const dx = p.tx - p.x, dy = p.ty - p.y, l = Math.hypot(dx, dy);
      if (l > 0.25) { const sp = Math.min(9.5, l * 3 + 2) * dt; p.x += dx / l * Math.min(l, sp); p.y += dy / l * Math.min(l, sp); p.anim += dt * 15; p.speedNow = 7; p.face.dir = Math.abs(dx) > 0.3 ? Math.sign(dx) : p.face.dir; p.home = false; }
      else { p.speedNow = 0; p.home = true; p.face.dir = Math.sign(this.hx - p.x) || this.d; }
    }
    for (const f of this.puffs) { f.life -= dt * 0.8; f.r += dt * 30; f.x += this.d * dt * 1.5; }
    this.puffs = this.puffs.filter(f => f.life > 0);
  },
  // camera for this moment of the intro
  shot() {
    const t = this.t, d = this.d;
    if (t < this.CUT) { // high over the stadium, sweeping from the far end zone toward the home end
      const u = ease(t / this.CUT);
      return { zoom: 'fly', x: lerp(60 + d * 32, 60 - d * 24, u), y: lerp(2, MID + 4, u) };
    }
    const u = ease((t - this.CUT) / (this.DUR - this.CUT));
    return { zoom: 'normal', x: this.camX, y: MID + 8 - u * 1.5 };
  },
  // the inflatable tunnel + smoke, drawn over the field (world space)
  drawTunnel(g) {
    const tm = G.teams[0], d = this.d, e = this.end, base = sy(this.ty + 2.4), top = sy(this.ty - 2.4), x0 = sx(e - d * 7), x1 = sx(e - d * 0.2), H = 64;
    const L = Math.min(x0, x1), R = Math.max(x0, x1), mouth = x1;
    g.save(); g.lineJoin = 'round';
    // body: a long puffy tube in team colors
    g.fillStyle = shade(tm.c1, -0.15); g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(L, base); g.lineTo(L, top - H * 0.55); g.quadraticCurveTo(L, top - H, L + 30, top - H); g.lineTo(R - 30, top - H); g.quadraticCurveTo(R, top - H, R, top - H * 0.55); g.lineTo(R, base); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = tm.c2; g.lineWidth = 7; for (let k = 1; k < 5; k++) { const x = lerp(L, R, k / 5); g.beginPath(); g.moveTo(x, base - 2); g.lineTo(x, top - H + 6); g.stroke(); }
    if (typeof Logo !== 'undefined') Logo.draw(g, tm, (L + R) / 2, (base + top - H) / 2, Math.min(80, (base - top + H) * 0.7));
    // the open end facing the field
    g.fillStyle = '#05070a'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.ellipse(mouth, (base + top - H) / 2 + 6, 13, (base - top + H) / 2 - 4, 0, 0, 7); g.fill();
    g.strokeStyle = tm.c2; g.lineWidth = 6; g.stroke();
    for (const f of this.puffs) { g.globalAlpha = Math.max(0, f.life) * 0.55; g.fillStyle = '#e8edf2'; g.beginPath(); g.arc(sx(f.x), sy(f.y) - 20, f.r, 0, 7); g.fill(); }
    g.restore();
  },
  // name card + letterbox (screen space)
  drawCard(g) {
    const t = this.t, W = CW, H = CH, tm = G.teams[0], acc = '#f6c31c';
    const fin = clamp((this.DUR - t) / 0.35, 0, 1), bar = Math.round(H * 0.075 * ease(Math.min(1, t / 0.35)) * fin);
    g.save();
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    // white flash on the cut
    const ct = t - this.CUT; if (ct > -0.08 && ct < 0.25) { g.globalAlpha = 1 - Math.abs(ct + 0.08) / 0.33; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    const card = (x, y, kick, big, sub, color, a, logo) => {
      g.save(); g.globalAlpha = a; g.translate(x - (1 - a) * 80, y);
      g.font = 'italic 900 58px "Barlow Condensed", Arial, sans-serif'; const bw = Math.max(320, g.measureText(big).width + (logo ? 110 : 50));
      g.fillStyle = '#0b0f16e8'; g.beginPath(); g.moveTo(0, 0); g.lineTo(bw + 26, 0); g.lineTo(bw, 112); g.lineTo(0, 112); g.closePath(); g.fill();
      g.fillStyle = color; g.fillRect(0, 0, 9, 112); g.fillRect(9, 108, bw - 9, 4);
      if (logo) Logo.draw(g, tm, 62, 62, 76);
      const lx = logo ? 112 : 30; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = color; g.font = '800 20px "Barlow Condensed", Arial, sans-serif'; g.fillText(kick, lx, 30);
      g.fillStyle = '#fff'; g.font = 'italic 900 58px "Barlow Condensed", Arial, sans-serif'; g.fillText(big, lx, 82);
      g.fillStyle = '#ffffffb0'; g.font = '700 17px Barlow, Arial, sans-serif'; g.fillText(sub, lx, 103);
      g.restore();
    };
    const st = G.stadium || { name: 'Home Field' }, wx = st.dome ? 'Indoors' : G.storm ? 'Storm' : G.fog ? 'Fog' : G.weather === 'rain' ? 'Rain' : G.weather === 'snow' ? 'Snow' : G.night ? 'Under the lights' : 'Clear skies';
    const a1 = clamp((t - 0.35) / 0.3, 0, 1) * clamp((this.CUT - 0.1 - t) / 0.25, 0, 1);
    if (a1 > 0) card(Math.round(W * 0.04), H - bar - 150, 'LIVE FROM', st.name.toUpperCase(), `${tm.city}  ·  ${wx}`, acc, a1, false);
    const a2 = clamp((t - this.CUT - 0.5) / 0.3, 0, 1) * fin;
    if (a2 > 0) card(Math.round(W * 0.04), H - bar - 150, 'TAKING THE FIELD', `HERE COME THE ${tm.name.toUpperCase()}`, [Broadcast.label, typeof Season !== 'undefined' && G.season && Season.data && Season.data.rec[tm.id] ? `${Season.data.rec[tm.id].w}-${Season.data.rec[tm.id].l}` : '', 'Home team'].filter(Boolean).join('  ·  '), tm.c2 && lum(tm.c2) > 0.25 ? tm.c2 : acc, a2, true);
    g.globalAlpha = 0.55; g.fillStyle = '#fff'; g.font = '800 13px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'right'; g.fillText('TAP TO SKIP', W - 24, H - bar - 14);
    // fade to the kickoff
    if (fin < 1) { g.globalAlpha = 1 - fin; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    g.restore();
  }
};
CAM_ZOOMS.fly = 0.62; // (only the intro uses this one)
(() => {
  // runners: legs going, a fist pumping (the first guy carries the team flag), then bouncing in the huddle
  const basePose = Celly.pose, baseOverlay = Celly.overlay;
  Celly.pose = function (p, type, t) {
    if (type !== 'runout') return basePose.call(this, p, type, t);
    const P = { hop: 0, rot: 0, sy: 1, lie: 0, legK: p.home ? 0 : 1, head: 0, arm: null, leg: null, noBall: true };
    if (p.home) { P.hop = Math.abs(Math.sin(t * 9 + p.slot)) * 10; P.arm = (front, shx, shy) => ({ ex: shx + (front ? 5 : -3), ey: shy - 11, hx: shx + (front ? 7 : -5), hy: shy - 23 }); return P; }
    const pump = Math.sin(t * 15);
    P.arm = (front, shx, shy) => front ? (p.celly.flag ? { ex: shx + 6, ey: shy - 10, hx: shx + 9, hy: shy - 22 } : { ex: shx + 5, ey: shy - 9 - pump * 3, hx: shx + 7, hy: shy - 21 - pump * 5 }) : { ex: shx - pump * 6, ey: shy + 9, hx: shx - pump * 10 + 2, hy: shy + 16 };
    return P;
  };
  Celly.overlay = function (g, p, x, y, hop) {
    baseOverlay.call(this, g, p, x, y, hop);
    if (!p.celly || p.celly.type !== 'runout' || !p.celly.flag) return;
    const tm = G.teams[0], dir = p.face.dir || 1, hx = x + dir * 16, hy = y - hop - 18 - 17 - 22, w = Math.sin(p.celly.t * 12);
    g.save(); g.strokeStyle = '#d8d8d8'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, hy + 14); g.lineTo(hx - dir * 4, hy - 70); g.stroke();
    g.fillStyle = tm.c1; g.strokeStyle = OUT; g.lineWidth = 2; // flag streams back behind him
    const fx = hx - dir * 4, fy = hy - 70;
    g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx - dir * 30, fy - 4 + w * 6, fx - dir * 62, fy + w * 4); g.lineTo(fx - dir * 62, fy + 38 + w * 4); g.quadraticCurveTo(fx - dir * 30, fy + 34 + w * 6, fx - dir * 2, fy + 40); g.closePath(); g.fill(); g.stroke();
    if (typeof Logo !== 'undefined') Logo.draw(g, tm, fx - dir * 32, fy + 19 + w * 4, 30);
    g.restore();
  };
  // the broadcast card goes first, the fly-over right after it
  const bShow = Broadcast.show, bClose = Broadcast.close;
  Broadcast.show = function (label) {
    bShow.call(this, label);
    if (!Flyover.ok()) return;
    if (this.on) { Flyover.pending = true; Flyover.bcAt = performance.now(); } else Flyover.start();
  };
  // (closed by code the moment it opened = a test script or a quick start: no intro then)
  Broadcast.close = function () { const was = this.on; bClose.call(this); if (was && Flyover.pending && performance.now() - Flyover.bcAt > 300) Flyover.start(); else Flyover.pending = false; };
  // drawing: swap in the intro's players + camera just for the picture, then put the real game back
  const baseRender = render;
  render = function () {
    if (!Flyover.on || !G.teams) return baseRender();
    const s = Flyover.shot(), keep = { players: G.players, refs: G.refs, ball: G.ball, fx: G.fx, banner: G.banner, x: cam.x, y: cam.y, zoom: cam.zoom, focus: cam.focus, shake: cam.shake, cz: camZoom, tags: nameTagMode };
    G.players = Flyover.runners.filter(p => p.out); G.refs = []; G.ball = null; G.fx = []; G.banner = null;
    cam.x = s.x; cam.y = s.y; cam.zoom = 1; cam.focus = null; cam.shake = 0; camZoom = s.zoom; nameTagMode = 'off';
    try { baseRender(); Flyover.drawCard(ctx); }
    finally { Object.assign(G, { players: keep.players, refs: keep.refs, ball: keep.ball, fx: keep.fx, banner: keep.banner }); Object.assign(cam, { x: keep.x, y: keep.y, zoom: keep.zoom, focus: keep.focus, shake: keep.shake }); camZoom = keep.cz; nameTagMode = keep.tags; }
  };
  // no scoreboard / kick meter / banner while it plays; the tunnel goes over the field
  for (const fn of ['drawHUD', 'drawTicker', 'drawKickMeter', 'drawBanner']) { const f = window[fn]; if (typeof f === 'function') window[fn] = function () { if (!Flyover.on) return f.apply(this, arguments); }; }
  const bLines = drawLines; drawLines = function () { if (!Flyover.on) return bLines.apply(this, arguments); }; // (no scrimmage / first down lines yet)
  const bAim = drawAim;
  drawAim = function (g, G) { if (Flyover.on && Flyover.t >= Flyover.CUT) Flyover.drawTunnel(g); return bAim.apply(this, arguments); };
  const skip = e => { if (!Flyover.on || performance.now() - Flyover.t0 < 250) return; // (the tap that closed the matchup card doesn't count)
    e.preventDefault(); e.stopPropagation(); Flyover.close(); };
  $('stage').addEventListener('pointerdown', skip, true);
  const css = document.createElement('style'); css.textContent = 'body.flyOn #btnPause, body.flyOn #mbtns, body.flyOn #joy { display: none !important; } body.flyOn #stage { cursor: pointer; }'; document.head.appendChild(css);
  window.addEventListener('keydown', skip, true);
})();
