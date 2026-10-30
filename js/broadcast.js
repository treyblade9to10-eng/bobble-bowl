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
    this.on = true; this.t0 = performance.now(); this.label = label || ''; this.DUR = 6.2; // long enough to read the facts
    G.paused = true; G.introPause = true;
    // each team's QB in today's uniform
    this.pl = [1, 0].map(s => { const t = G.teams[s], p = makePlayer(s, true, 0, t.off[0]); p.face.dir = s === 1 ? 1 : -1; p.headScale = 1.1; p.celebrate = 0; return p; });
    try { this.facts = [teamFacts(G.teams[0]), teamFacts(G.teams[1])]; } catch (e) { this.facts = null; }
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
    if (t > this.DUR + (G.bigGame ? 1.4 : 0)) return this.close();
    try { this.draw(t); } catch (e) { console.error('intro', e); return this.close(); } // never leave the game stuck behind a broken intro
    requestAnimationFrame(() => this.loop());
  },
  draw(t) {
    const cv = $('bcCv'), g = cv.getContext('2d'), W = cv.width, H = 720, A = G.teams[1], B = G.teams[0];
    const ein = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3), slide = ein(t / 0.55), fade = clamp((this.DUR + (G.bigGame ? 1.4 : 0) - t) / 0.35, 0, 1);
    g.clearRect(0, 0, W, H); g.save(); g.globalAlpha = fade;
    const S = typeof bcStyle === 'function' && !G.bigGame ? bcStyle(G) : null, acc = S ? S.acc : '#f6c31c'; // primetime look (primetime.js)
    // two-color split with a gold seam
    const cut = 70;
    g.fillStyle = shade(A.c1, -0.25); g.beginPath(); g.moveTo(0, 0); g.lineTo(W / 2 + cut, 0); g.lineTo(W / 2 - cut, H); g.lineTo(0, H); g.fill();
    g.fillStyle = shade(B.c1, -0.25); g.beginPath(); g.moveTo(W / 2 + cut, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W / 2 - cut, H); g.fill();
    const vg = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 800); vg.addColorStop(0, '#0000'); vg.addColorStop(1, '#000a'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.strokeStyle = acc; g.lineWidth = 8; g.beginPath(); g.moveTo(W / 2 + cut, 0); g.lineTo(W / 2 - cut, H); g.stroke();
    // big faded logos behind everything
    g.globalAlpha = fade * 0.12; Logo.draw(g, A, W * 0.22, H * 0.55, 560); Logo.draw(g, B, W * 0.78, H * 0.55, 560); g.globalAlpha = fade;
    // header bar
    if (S) { const hg = g.createLinearGradient(0, 0, 0, 64); hg.addColorStop(0, S.bar[0]); hg.addColorStop(1, S.bar[1]); g.fillStyle = hg; g.fillRect(0, 0, W, 64); g.fillStyle = acc; g.fillRect(0, 61, W, 3); }
    else { g.fillStyle = '#0b0f16e8'; g.fillRect(0, 0, W, 64); }
    g.fillStyle = '#d7263d'; g.fillRect(28, 18, 74, 28); g.fillStyle = '#fff'; g.font = '900 20px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('LIVE', 72, 33); g.beginPath(); g.arc(40, 32, 5, 0, 7); g.fillStyle = Math.sin(t * 8) > 0 ? '#fff' : '#ffffff55'; g.fill();
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'italic 900 30px "Barlow Condensed", Arial, sans-serif';
    const head = G.bigGame ? G.bigGame.name.toUpperCase() : S ? S.name : G.rivalryMatch || G.rivalry ? 'RIVALRY GAME' : G.night ? "TONIGHT'S MATCHUP" : "TODAY'S MATCHUP";
    if (S) { bcBadge(g, G.bcast, 116, 6, 72, 52); g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'italic 900 30px "Barlow Condensed", Arial, sans-serif'; }
    g.fillText(head, S ? 204 : 120, 34);
    if (S && (G.rivalryMatch || G.rivalry)) { const hw = g.measureText(head).width; g.font = '800 18px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#ff8a5c'; g.fillText('RIVALRY GAME', 222 + hw, 35); }
    if (this.label && !G.bigGame) { g.textAlign = 'right'; g.fillStyle = S ? S.down : '#f6c31c'; g.font = '800 22px "Barlow Condensed", Arial, sans-serif'; g.fillText(this.label.toUpperCase(), W - 30, 34); }
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
      g.fillStyle = S ? S.bar[1] + 'e0' : '#0b0f16d0'; g.fillRect(x - w / 2, 486, w, 32); g.fillStyle = S ? S.down : '#f6c31c'; g.fillText(chip, x, 503);
      // two quick facts under each team
      const facts = this.facts ? this.facts[side] : [];
      g.font = '700 17px Barlow, Arial, sans-serif'; g.fillStyle = '#ffffffe0';
      facts.forEach((f, i) => { const fw = Math.min(W * 0.3, g.measureText(f).width + 20); g.fillStyle = '#0b0f16a8'; g.fillRect(x - fw / 2, 530 + i * 30, fw, 26); g.fillStyle = '#fff'; g.fillText(f, x, 548 + i * 30, W * 0.3 - 16); });
      if (p) { p.anim += 0.04; p.speedNow = 0; g.save(); g.scale(2.5, 2.5); drawPlayer(g, p, G, { x: (x + (side === 1 ? -1 : 1) * Math.min(250, W * 0.2)) / 2.5, y: 650 / 2.5 }); g.restore(); }
      g.restore();
    };
    team(A, 1, W * 0.27, -1, this.pl[0]); team(B, 0, W * 0.73, 1, this.pl[1]);
    // VS (or the trophy, for the Bobble Bowl)
    const vs = ein((t - 0.35) / 0.4);
    if (G.bigGame) {
      g.save(); g.globalAlpha = fade * vs; const gl = g.createRadialGradient(W / 2, 300, 10, W / 2, 300, 220); gl.addColorStop(0, '#fff6d0aa'); gl.addColorStop(1, '#fff6d000'); g.fillStyle = gl; g.fillRect(W / 2 - 220, 80, 440, 440);
      drawTrophy(g, W / 2, 440 - (1 - vs) * 60, 260, t);
      g.textAlign = 'center'; g.font = 'italic 900 64px "Barlow Condensed", Arial, sans-serif'; g.lineWidth = 10; g.strokeStyle = '#000'; g.lineJoin = 'round';
      const rn = roman(bowlNo(G.bigGame.year)); g.strokeText(rn, W / 2, 500); g.fillStyle = '#d9a933'; g.fillText(rn, W / 2, 500); g.restore();
    } else {
      g.save(); g.translate(W / 2, 300); g.scale(0.5 + vs * 0.5, 0.5 + vs * 0.5); g.globalAlpha = fade * vs;
      g.font = 'italic 900 96px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.lineWidth = 12; g.strokeStyle = '#000'; g.strokeText('VS', 0, 0); g.fillStyle = acc; g.fillText('VS', 0, 0); g.restore();
    }
    // bottom ticker: where + conditions
    const wx = G.storm ? 'Storm' : G.fog ? 'Fog' : { clear: G.night ? 'Clear night' : 'Clear skies', rain: 'Rain', snow: 'Snow' }[G.weather] || '';
    const bits = [G.stadium && G.stadium.name, G.stadium && G.stadium.dome ? 'Indoors' : wx, G.wind && G.wind.mph ? `Wind ${G.wind.mph} mph` : ''].filter(Boolean);
    g.fillStyle = S ? S.bar[1] + 'f0' : '#0b0f16e8'; g.fillRect(0, H - 58, W, 58); g.fillStyle = acc; g.fillRect(0, H - 58, 8, 58);
    g.fillStyle = '#fff'; g.font = '800 24px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'left'; g.fillText(bits.join('   ·   ').toUpperCase(), 30, H - 28);
    g.restore();
  }
};
(() => {
  const skip = e => { if (!Broadcast.on) return; e.preventDefault(); e.stopPropagation(); Broadcast.close(); };
  $('bcast').addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip, true);
})();

// ---------- pregame facts: "Bears lead the league in passing" ----------
// Season (2+ weeks in): real season numbers. Otherwise: who has the best players at each spot.
function teamFacts(tm) {
  const nm = tm.name, ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
  const say = (rank, what, extra) => rank === 1 ? `${nm} lead the league in ${what}${extra ? ` (${extra})` : ''}` : `${nm} are ${ord(rank)} in the league in ${what}${extra ? ` (${extra})` : ''}`;
  const facts = [];
  const d = typeof Season !== 'undefined' && Season.data, gp = id => { const r = d && d.rec[id]; return r ? r.w + r.l + r.t : 0; };
  if (G.season && d && gp(tm.id) >= 2) {
    const ids = Object.keys(d.rec), tot = {};
    for (const id of ids) tot[id] = { pass: 0, rush: 0, sack: 0, int: 0 };
    for (const l of Object.values(d.stats || {})) if (tot[l.t]) { tot[l.t].pass += l.pass; tot[l.t].rush += l.rush; tot[l.t].sack += l.sack; tot[l.t].int += l.int; }
    const per = (id, v) => v / Math.max(1, gp(id));
    const rank = f => 1 + ids.filter(id => f(id) > f(tm.id) + 1e-9).length;
    const cats = [
      ['passing', id => per(id, tot[id].pass), v => `${Math.round(v)} yds a game`],
      ['rushing', id => per(id, tot[id].rush), v => `${Math.round(v)} yds a game`],
      ['scoring', id => per(id, d.rec[id].pf), v => `${v.toFixed(1)} pts a game`],
      ['defense', id => -per(id, d.rec[id].pa), v => `${(-v).toFixed(1)} pts allowed`],
      ['sacks', id => tot[id].sack, v => `${v}`],
      ['interceptions', id => tot[id].int, v => `${v}`]
    ].map(([w, f, fmt]) => ({ r: rank(f), t: say(rank(f), w, fmt(f(tm.id))) }));
    cats.sort((a, b) => a.r - b.r); facts.push(...cats.slice(0, 2).map(c => c.t));
    const r = d.rec[tm.id]; if (r.w >= 3 && r.l === 0) facts.unshift(`${nm} are still unbeaten at ${r.w}-0`);
  } else {
    const pool = TEAMS.map(t => (typeof Season !== 'undefined' && Season.data && G.season) ? Season.team(t.id) : t).filter(t => t.id !== tm.id).concat([tm]);
    const avg = (t, f) => { const l = t.off.concat(t.def).filter(f); return l.length ? l.reduce((a, p) => a + p[3], 0) / l.length : 0; };
    const best = (t, pos) => t.off.concat(t.def).filter(p => p[0] === pos).sort((a, b) => b[3] - a[3])[0];
    const cats = [
      ['QB', t => (best(t, 'QB') || [0, 0, 0, 0])[3], () => { const q = best(tm, 'QB'); return q ? `${q[1]}` : ''; }, 'quarterback'],
      ['offense', t => avg(t, p => ['QB', 'RB', 'WR', 'TE', 'OL'].includes(p[0])), null, 'offense'],
      ['defense', t => avg(t, p => ['DL', 'LB', 'CB', 'S'].includes(p[0])), null, 'defense'],
      ['pass rush', t => avg(t, p => p[0] === 'DL'), null, 'pass rush'],
      ['secondary', t => avg(t, p => p[0] === 'CB' || p[0] === 'S'), null, 'secondary'],
      ['receivers', t => avg(t, p => p[0] === 'WR' || p[0] === 'TE'), null, 'receiving corps'],
      ['speed', t => avg(t, () => true) * 0 + t.off.concat(t.def).reduce((a, p) => a + (p[4] || 0), 0), null, 'team speed'],
      ['backfield', t => (best(t, 'RB') || [0, 0, 0, 0])[3] + (t.rb2 && t.rb2[3] >= 72 ? t.rb2[3] * 0.3 : 0), null, 'backfield']
    ].map(([k, f, who, label]) => {
      const r = 1 + pool.filter(t => f(t) > f(tm) + 1e-9).length, w = who && who();
      return { r, t: k === 'QB' ? (r === 1 ? `${w} is the top-rated QB in the league` : `${w} is the ${ord(r)}-rated QB in the league`) : r === 1 ? `${nm} have the best ${label} in the league` : `${nm} have the ${ord(r)}-best ${label} in the league` };
    });
    cats.sort((a, b) => a.r - b.r); facts.push(...cats.slice(0, 2).map(c => c.t));
    if (tm.rb2 && tm.rb2[3] >= 72 && tm.off[1] && tm.rb2[3] >= tm.off[1][3] - 14) facts.push(`Two-back team: ${lastName(tm.off[1][1])} and ${lastName(tm.rb2[1])} split the carries`);
  }
  return facts.slice(0, 2);
}
