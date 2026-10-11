// ---- Broadcast intro: a TV-style "tonight's matchup" card before kickoff. Tap / any key skips it ----
(() => {
  const el = document.createElement('div');
  el.id = 'bcast'; el.innerHTML = '<canvas id="bcCv" width="1280" height="720"></canvas><div id="bcSkip">TAP TO SKIP</div>';
  document.getElementById('stage').appendChild(el);
})();

const Broadcast = {
  on: false, t0: 0, DUR: 4.6,
  show(label) {
    if (G.demo || G.online || G.challenge || G.mini || G.scenario || !G.teams) return;
    this.on = true; this.t0 = performance.now(); this.label = label || '';
    G.paused = true; G.introPause = true;
    // each team's QB in today's uniform
    this.pl = [1, 0].map(s => { const t = G.teams[s], p = makePlayer(s, true, 0, t.off[0]); p.face.dir = s === 1 ? 1 : -1; p.headScale = 1.1; p.celebrate = 0; return p; });
    $('bcCv').width = CW; // match the game's width so wide phones get no side bars
    $('bcast').classList.add('on');
    this.loop();
  },
  close() {
    if (!this.on) return;
    this.on = false; $('bcast').classList.remove('on');
    if (G.introPause) { G.paused = false; G.introPause = false; }
  },
  loop() {
    if (!this.on) return;
    const t = (performance.now() - this.t0) / 1000;
    if (t > this.DUR) return this.close();
    this.draw(t);
    requestAnimationFrame(() => this.loop());
  },
  draw(t) {
    const cv = $('bcCv'), g = cv.getContext('2d'), W = cv.width, H = 720, A = G.teams[1], B = G.teams[0];
    const ein = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3), slide = ein(t / 0.55), fade = clamp((this.DUR - t) / 0.35, 0, 1);
    g.clearRect(0, 0, W, H); g.save(); g.globalAlpha = fade;
    // two-color split with a gold seam
    const cut = 70;
    g.fillStyle = shade(A.c1, -0.25); g.beginPath(); g.moveTo(0, 0); g.lineTo(W / 2 + cut, 0); g.lineTo(W / 2 - cut, H); g.lineTo(0, H); g.fill();
    g.fillStyle = shade(B.c1, -0.25); g.beginPath(); g.moveTo(W / 2 + cut, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W / 2 - cut, H); g.fill();
    const vg = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 800); vg.addColorStop(0, '#0000'); vg.addColorStop(1, '#000a'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#f6c31c'; g.lineWidth = 8; g.beginPath(); g.moveTo(W / 2 + cut, 0); g.lineTo(W / 2 - cut, H); g.stroke();
    // big faded logos behind everything
    g.globalAlpha = fade * 0.12; Logo.draw(g, A, W * 0.22, H * 0.55, 560); Logo.draw(g, B, W * 0.78, H * 0.55, 560); g.globalAlpha = fade;
    // header bar
    g.fillStyle = '#0b0f16e8'; g.fillRect(0, 0, W, 64);
    g.fillStyle = '#d7263d'; g.fillRect(28, 18, 74, 28); g.fillStyle = '#fff'; g.font = '900 20px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('LIVE', 72, 33); g.beginPath(); g.arc(40, 32, 5, 0, 7); g.fillStyle = Math.sin(t * 8) > 0 ? '#fff' : '#ffffff55'; g.fill();
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'italic 900 30px "Barlow Condensed", Arial, sans-serif';
    const head = G.rivalryMatch || G.rivalry ? 'RIVALRY GAME' : G.night ? "TONIGHT'S MATCHUP" : "TODAY'S MATCHUP";
    g.fillText(head, 120, 34);
    if (this.label) { g.textAlign = 'right'; g.fillStyle = '#f6c31c'; g.font = '800 22px "Barlow Condensed", Arial, sans-serif'; g.fillText(this.label.toUpperCase(), W - 30, 34); }
    // each team: logo, name, rating, player in uniform
    const team = (tm, side, x, dirIn, p) => {
      const off = (1 - slide) * 700 * dirIn;
      g.save(); g.translate(off, 0);
      g.save(); g.shadowColor = '#000a'; g.shadowBlur = 24; Logo.draw(g, tm, x, 250, 230); g.restore();
      g.textAlign = 'center'; g.fillStyle = '#ffffffcc'; g.font = '800 24px "Barlow Condensed", Arial, sans-serif'; g.fillText(tm.city.toUpperCase(), x, 404);
      g.font = 'italic 900 64px "Barlow Condensed", Arial, sans-serif'; g.lineWidth = 8; g.strokeStyle = '#000'; g.lineJoin = 'round';
      g.strokeText(tm.name.toUpperCase(), x, 452); g.fillStyle = '#fff'; g.fillText(tm.name.toUpperCase(), x, 452);
      const rec = G.season && typeof Season !== 'undefined' && Season.data && Season.data.rec[tm.id] ? `${Season.data.rec[tm.id].w}-${Season.data.rec[tm.id].l}  ·  ` : '';
      const chip = `${rec}${teamOvr(tm)} OVR  ·  ${side === 0 ? 'HOME' : 'AWAY'}`;
      g.font = '800 20px "Barlow Condensed", Arial, sans-serif'; const w = g.measureText(chip).width + 28;
      g.fillStyle = '#0b0f16d0'; g.fillRect(x - w / 2, 486, w, 32); g.fillStyle = '#f6c31c'; g.fillText(chip, x, 503);
      if (p) { p.anim += 0.04; p.speedNow = 0; g.save(); g.scale(2.5, 2.5); drawPlayer(g, p, G, { x: (x + (side === 1 ? -1 : 1) * Math.min(250, W * 0.2)) / 2.5, y: 650 / 2.5 }); g.restore(); }
      g.restore();
    };
    team(A, 1, W * 0.27, -1, this.pl[0]); team(B, 0, W * 0.73, 1, this.pl[1]);
    // VS
    const vs = ein((t - 0.35) / 0.4);
    g.save(); g.translate(W / 2, 300); g.scale(0.5 + vs * 0.5, 0.5 + vs * 0.5); g.globalAlpha = fade * vs;
    g.font = 'italic 900 96px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.lineWidth = 12; g.strokeStyle = '#000'; g.strokeText(G.teams && 'VS', 0, 0); g.fillStyle = '#f6c31c'; g.fillText('VS', 0, 0); g.restore();
    // bottom ticker: where + conditions
    const wx = G.storm ? 'Storm' : G.fog ? 'Fog' : { clear: G.night ? 'Clear night' : 'Clear skies', rain: 'Rain', snow: 'Snow' }[G.weather] || '';
    const bits = [G.stadium && G.stadium.name, G.stadium && G.stadium.dome ? 'Indoors' : wx, G.wind && G.wind.mph ? `Wind ${G.wind.mph} mph` : ''].filter(Boolean);
    g.fillStyle = '#0b0f16e8'; g.fillRect(0, H - 58, W, 58); g.fillStyle = '#f6c31c'; g.fillRect(0, H - 58, 8, 58);
    g.fillStyle = '#fff'; g.font = '800 24px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'left'; g.fillText(bits.join('   ·   ').toUpperCase(), 30, H - 28);
    g.restore();
  }
};
(() => {
  const skip = e => { if (!Broadcast.on) return; e.preventDefault(); e.stopPropagation(); Broadcast.close(); };
  $('bcast').addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip, true);
})();
