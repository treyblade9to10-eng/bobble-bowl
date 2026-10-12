// ---- The Bobble Bowl: Roman numerals, the trophy, and the trophy ceremony ----
// Numbering follows the real thing: Year 1 of a season = Bobble Bowl LXI, Year 2 = LXII, ...
function roman(n) {
  const R = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = ''; for (const [v, r] of R) while (n >= v) { s += r; n -= v; } return s;
}
const bowlNo = year => 60 + (year || 1);
const bowlName = year => `Bobble Bowl ${roman(bowlNo(year))}`;
// Quick Game Bobble Bowls count up on their own: LXI, LXII, LXIII...
function quickBowlYear() { let n = 1; try { n = (+localStorage.getItem('bobbleQuickBowl') || 0) + 1; localStorage.setItem('bobbleQuickBowl', n); } catch (e) {} return n; }

// the trophy: a silver football standing on a tapered base (s = height in px, x/y = bottom center)
function drawTrophy(g, x, y, s, shine = 0) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
  const silver = (x0, x1) => { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#8d949b'); gr.addColorStop(0.35, '#f4f7f9'); gr.addColorStop(0.55, '#c3c9ce'); gr.addColorStop(1, '#6f767c'); return gr; };
  g.lineJoin = 'round'; g.strokeStyle = '#2a2e33'; g.lineWidth = 2.2;
  // base: black block with a gold plate
  g.fillStyle = '#16191d'; g.beginPath(); g.moveTo(-17, 0); g.lineTo(17, 0); g.lineTo(14, -14); g.lineTo(-14, -14); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#d9a933'; g.fillRect(-8, -10, 16, 5);
  // tapered stand
  g.fillStyle = silver(-12, 12); g.beginPath(); g.moveTo(-12, -14); g.lineTo(12, -14); g.lineTo(4, -58); g.lineTo(-4, -58); g.closePath(); g.fill(); g.stroke();
  // the football, tipped up like it's ready for a kickoff
  g.save(); g.translate(0, -73); g.rotate(-0.55);
  g.fillStyle = silver(-12, 12); g.beginPath(); g.ellipse(0, 0, 11, 18, 0, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = '#7b8288'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -9); g.lineTo(0, 9);
  for (let k = -6; k <= 6; k += 3) { g.moveTo(-3, k); g.lineTo(3, k); } g.stroke();
  g.restore();
  // sparkle
  if (shine) { g.globalAlpha = 0.5 + 0.5 * Math.sin(shine * 6); g.fillStyle = '#fff'; starPath(g, -6, -82, 5); g.fill(); starPath(g, 8, -40, 3.5); g.fill(); g.globalAlpha = 1; }
  g.restore();
}

// ---------- the ceremony after the Bobble Bowl ----------
(() => {
  const el = document.createElement('div');
  el.id = 'cerem'; el.innerHTML = '<canvas id="ceCv" width="1280" height="720"></canvas><div id="ceSkip">TAP TO CONTINUE</div>';
  document.getElementById('stage').appendChild(el);
})();
const Ceremony = {
  on: false,
  show(side, mvp, done) {
    this.on = true; this.side = side; this.mvp = mvp; this.done = done; this.t0 = performance.now();
    const t = G.teams[side];
    // the winners on stage: QB in the middle holding the trophy, teammates around him
    const pick = [[true, 0], [true, 2], [false, 0], [true, 1], [false, 5]];
    this.pl = pick.map(([off, i], k) => { const p = makePlayer(side, off, i, (off ? t.off : t.def)[i]); p.celebrate = 1e9; p.face.dir = k % 2 ? -1 : 1; p.headScale = 1.1; p.slot = k + 1; return p; });
    this.conf = Array.from({ length: 140 }, () => ({ x: Math.random() * CW, y: -Math.random() * 720, vy: 80 + Math.random() * 160, vx: -30 + Math.random() * 60, r: Math.random() * 6, c: [t.c1, t.c2, '#fff', '#d9a933'][Math.floor(Math.random() * 4)] }));
    $('ceCv').width = CW; $('cerem').classList.add('on');
    Sound.td(); setTimeout(() => this.on && Sound.crowd(true), 600);
    this.last = performance.now(); this.loop();
  },
  close() { if (!this.on) return; this.on = false; $('cerem').classList.remove('on'); const d = this.done; this.done = null; if (d) d(); },
  loop() {
    if (!this.on) return;
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.draw((now - this.t0) / 1000, dt);
    requestAnimationFrame(() => this.loop());
  },
  draw(t, dt) {
    const cv = $('ceCv'), g = cv.getContext('2d'), W = cv.width, H = 720, tm = G.teams[this.side];
    // night stadium with spotlights in the champ's colors
    g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
    const fl = g.createLinearGradient(0, 380, 0, H); fl.addColorStop(0, '#173f1f'); fl.addColorStop(1, '#0b200f'); g.fillStyle = fl; g.fillRect(0, 380, W, H - 380);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = Math.sin(t * 0.8 + i * 1.7) * 0.35, sx0 = W * (0.12 + i * 0.25);
      g.save(); g.translate(sx0, 0); g.rotate(a);
      const sp = g.createLinearGradient(0, 0, 0, H); sp.addColorStop(0, (i % 2 ? tm.c2 : tm.c1) + '88'); sp.addColorStop(1, '#0000');
      g.fillStyle = sp; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.lineTo(170, H); g.lineTo(-170, H); g.fill(); g.restore();
    }
    g.globalCompositeOperation = 'source-over';
    // giant logo behind the stage
    g.globalAlpha = 0.2; Logo.draw(g, tm, W / 2, 300, 420); g.globalAlpha = 1;
    // stage
    g.fillStyle = '#111418'; g.fillRect(W / 2 - 330, 560, 660, 24); g.fillStyle = tm.c1; g.fillRect(W / 2 - 330, 584, 660, 40); g.fillStyle = '#d9a933'; g.fillRect(W / 2 - 330, 580, 660, 4);
    // players: hop + QB lifts the trophy over his head
    const fake = { teams: G.teams, uni: G.uni, ball: null, phase: 'over', human: G.human, mode: G.mode, time: t };
    const xs = [0, -150, 150, -270, 270];
    const lift = Math.min(1, Math.max(0, (t - 0.8) / 0.8));
    this.pl.forEach((p, k) => {
      p.anim += dt * 4; p.speedNow = 0; p.celebrate = 1e9;
      g.save(); g.scale(2.3, 2.3); drawPlayer(g, p, fake, { x: (W / 2 + xs[k]) / 2.3, y: 562 / 2.3 }); g.restore();
    });
    const hop = Math.abs(Math.sin(t * 10)) * 14 * lift;
    drawTrophy(g, W / 2 + 6, 352 - lift * 26 - hop, 118, t); // held up over the QB's head
    // big title
    const pop = Math.min(1, t / 0.5);
    g.save(); g.translate(W / 2, 84); g.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = '800 30px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#d9a933'; g.fillText(G.bigGame.name.toUpperCase() + ' CHAMPIONS', 0, -44);
    g.font = 'italic 900 64px "Barlow Condensed", Arial, sans-serif'; g.lineWidth = 12; g.strokeStyle = '#000';
    const nm = `${tm.city} ${tm.name}`.toUpperCase(); g.strokeText(nm, 0, 6); g.fillStyle = '#fff'; g.fillText(nm, 0, 6);
    g.restore();
    if (this.mvp && t > 1.4) {
      g.globalAlpha = Math.min(1, (t - 1.4) * 2); g.fillStyle = '#0b0f16e0'; g.fillRect(W / 2 - 260, 640, 520, 46); g.fillStyle = '#d9a933'; g.fillRect(W / 2 - 260, 640, 6, 46);
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '800 24px "Barlow Condensed", Arial, sans-serif'; g.fillText(`${G.bigGame.name.toUpperCase()} MVP:  ${this.mvp.name.toUpperCase()}`, W / 2, 664); g.globalAlpha = 1;
    }
    // confetti
    for (const c of this.conf) {
      c.y += c.vy * dt; c.x += c.vx * dt + Math.sin(t * 3 + c.r) * 0.6; if (c.y > H) { c.y = -10; c.x = Math.random() * W; }
      g.fillStyle = c.c; g.save(); g.translate(c.x, c.y); g.rotate(t * 4 + c.r); g.fillRect(-3, -5, 6, 10); g.restore();
    }
  }
};
(() => {
  const go = e => { if (!Ceremony.on || (performance.now() - Ceremony.t0) < 1200) return; e.preventDefault(); e.stopPropagation(); Ceremony.close(); };
  $('cerem').addEventListener('pointerdown', go);
  window.addEventListener('keydown', go, true);
})();
