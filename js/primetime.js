// ---- Primetime TV looks: Thursday / Sunday / Monday night, Christmas and Halloween games get their own scorebug + intro ----
// G.bcast: null (normal Sunday afternoon) | 'TNF' | 'SNF' | 'MNF' | 'XMAS' | 'HWN'. Our own drawings, not the real networks' logos.
const BCAST = {
  TNF: { name: 'THURSDAY NIGHT FOOTBALL', short: 'TNF', night: true, bar: ['#2c1156', '#150a2c'], acc: '#1fd6c4', acc2: '#8e52ff', down: '#3fe6d5', to: '#1fd6c4', slant: 9 },
  SNF: { name: 'SUNDAY NIGHT FOOTBALL', short: 'SNF', night: true, bar: ['#142a57', '#0a1631'], acc: '#e2b43b', acc2: '#e2b43b', down: '#f0c75a', to: '#e2b43b', frame: '#e2b43b' },
  MNF: { name: 'MONDAY NIGHT FOOTBALL', short: 'MNF', night: true, bar: ['#191919', '#060606'], acc: '#e01e2b', acc2: '#ffd21a', down: '#ffd21a', to: '#ffd21a', slant: 7 },
  XMAS: { name: 'CHRISTMAS DAY FOOTBALL', short: 'XMAS', bar: ['#11532f', '#08311b'], acc: '#d6202e', acc2: '#f3d36b', down: '#f3d36b', to: '#f3d36b' },
  HWN: { name: 'HALLOWEEN NIGHT FOOTBALL', short: 'HALLOWEEN', night: true, bar: ['#26123d', '#0d0615'], acc: '#ff7a1a', acc2: '#a259ff', down: '#ff9a3c', to: '#ff7a1a' }
};
function bcStyle(G) { return (G && G.bcast && BCAST[G.bcast]) || null; }
// Christmas: a good chance of snow when the weather was left to chance
function bcWeather(code, w, choice) { return code === 'XMAS' && w === 'clear' && (!choice || choice === 'random') && chance(0.45) ? 'snow' : w; }

// ---------- little drawn icons ----------
const BcIcon = {
  moon(g, x, y, r, col) {
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
    g.beginPath(); g.rect(x - r, y - r, r * 2, r * 2); g.arc(x + r * 0.5, y - r * 0.3, r * 0.82, 0, 7); g.fillStyle = col; g.fill('evenodd'); g.restore();
  },
  star(g, x, y, R, col) {
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = col; g.fill();
  },
  flake(g, x, y, r, col) {
    g.save(); g.translate(x, y); g.strokeStyle = col; g.lineWidth = Math.max(1.2, r / 5); g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r);
      g.moveTo(0, -r * 0.55); g.lineTo(-r * 0.3, -r * 0.8); g.moveTo(0, -r * 0.55); g.lineTo(r * 0.3, -r * 0.8); g.stroke();
    }
    g.restore();
  },
  pumpkin(g, x, y, r) {
    g.save(); g.translate(x, y);
    g.fillStyle = '#3c8a2e'; g.fillRect(-r * 0.12, -r * 1.08, r * 0.24, r * 0.4);
    g.fillStyle = '#d35d0e'; g.beginPath(); g.ellipse(-r * 0.45, 0, r * 0.55, r * 0.78, 0, 0, 7); g.ellipse(r * 0.45, 0, r * 0.55, r * 0.78, 0, 0, 7); g.fill();
    g.fillStyle = '#ff8a24'; g.beginPath(); g.ellipse(0, 0, r * 0.6, r * 0.82, 0, 0, 7); g.fill();
    g.fillStyle = '#2a1204'; g.beginPath();
    g.moveTo(-r * 0.5, -r * 0.12); g.lineTo(-r * 0.2, -r * 0.12); g.lineTo(-r * 0.35, -r * 0.4); g.closePath();
    g.moveTo(r * 0.5, -r * 0.12); g.lineTo(r * 0.2, -r * 0.12); g.lineTo(r * 0.35, -r * 0.4); g.closePath();
    g.moveTo(-r * 0.55, r * 0.18); g.lineTo(-r * 0.3, r * 0.42); g.lineTo(-r * 0.1, r * 0.28); g.lineTo(r * 0.1, r * 0.42); g.lineTo(r * 0.3, r * 0.28); g.lineTo(r * 0.55, r * 0.18); g.lineTo(r * 0.3, r * 0.55); g.lineTo(-r * 0.3, r * 0.55); g.closePath();
    g.fill(); g.restore();
  },
  bat(g, x, y, s, col) {
    const R = [[0, -2.5], [1, -4.3], [1.8, -2.2], [5, -4.6], [10, -3], [8.6, -1.2], [7.2, 0.3], [5.6, -0.6], [4, 1.3], [2.4, 0.4], [0, 2.6]];
    g.save(); g.translate(x, y); g.scale(s, s); g.beginPath();
    R.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); for (let i = R.length - 2; i > 0; i--) g.lineTo(-R[i][0], R[i][1]);
    g.closePath(); g.fillStyle = col; g.fill(); g.restore();
  }
};

// the show's badge: a small block at the left end of the scorebug (also used on the intro, replays and highlights)
function bcBadge(g, code, x, y, w, h) {
  const S = BCAST[code]; if (!S) return;
  const HD = '"Barlow Condensed", "Arial Black", sans-serif';
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  const bg = g.createLinearGradient(x, y, x + w, y + h);
  const word = (txt, px, col, yy) => { g.font = `italic 900 ${px}px ${HD}`; g.fillStyle = col; g.fillText(txt, x + w / 2, yy, w - 8); };
  if (code === 'TNF') {
    bg.addColorStop(0, '#7a3cf0'); bg.addColorStop(1, '#22105a'); g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = S.acc; g.fillRect(x, y + h - 4, w, 4);
    BcIcon.moon(g, x + w - 12, y + 11, 6, '#e9f7ff');
    word('TNF', h * 0.5, '#fff', y + h * 0.56);
  } else if (code === 'SNF') {
    bg.addColorStop(0, '#1d3a78'); bg.addColorStop(1, '#0a1631'); g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.strokeStyle = S.acc; g.lineWidth = 1.5; g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
    BcIcon.star(g, x + w / 2, y + h * 0.3, h * 0.15, S.acc);
    word('SNF', h * 0.4, S.acc, y + h * 0.68);
  } else if (code === 'MNF') {
    g.fillStyle = '#c8101d'; g.fillRect(x, y, w, h);
    g.fillStyle = S.acc2; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + 10, y); g.lineTo(x + 16, y); g.lineTo(x + 6, y + h); g.fill();
    g.fillStyle = '#0005'; g.fillRect(x, y + h - 5, w, 5);
    word('MNF', h * 0.5, '#fff', y + h * 0.48);
  } else if (code === 'XMAS') {
    bg.addColorStop(0, '#e2283a'); bg.addColorStop(1, '#8e0f1c'); g.fillStyle = bg; g.fillRect(x, y, w, h);
    BcIcon.flake(g, x + w / 2, y + h * 0.33, h * 0.19, '#fff');
    word('CHRISTMAS', h * 0.27, '#fff', y + h * 0.77);
  } else if (code === 'HWN') {
    g.fillStyle = '#120818'; g.fillRect(x, y, w, h);
    g.fillStyle = S.acc2 + '55'; g.fillRect(x, y + h - 3, w, 3);
    BcIcon.pumpkin(g, x + w / 2, y + h * 0.36, h * 0.2);
    word('HALLOWEEN', h * 0.25, S.acc, y + h * 0.8);
  }
  g.restore();
}

// scorebug background + trim for the special shows
function bcBar(g, S, x0, y0, W, H) {
  const bg = g.createLinearGradient(0, y0, 0, y0 + H); bg.addColorStop(0, S.bar[0]); bg.addColorStop(1, S.bar[1]);
  g.fillStyle = bg; roundRect(g, x0, y0, W, H, 3); g.fill();
}
function bcTrim(g, code, x0, y0, W, H) {
  const S = BCAST[code], t = G.time || 0;
  g.save();
  if (code === 'SNF') { g.strokeStyle = S.frame; g.lineWidth = 1.5; roundRect(g, x0 + 0.75, y0 + 0.75, W - 1.5, H - 1.5, 3); g.stroke(); }
  else if (code === 'TNF') { const lg = g.createLinearGradient(x0, 0, x0 + W, 0); lg.addColorStop(0, S.acc2); lg.addColorStop(1, S.acc); g.fillStyle = lg; g.fillRect(x0, y0 + H - 2, W, 3); }
  else if (code === 'MNF') { g.fillStyle = S.acc; g.fillRect(x0, y0 + H - 3, W, 3); g.fillStyle = S.acc2; g.fillRect(x0, y0 + H, W, 1.5); }
  else if (code === 'HWN') {
    g.fillStyle = S.acc; g.fillRect(x0, y0 + H - 2, W, 2);
    BcIcon.bat(g, x0 + W - 20, y0 + 13 + Math.sin(t * 2) * 1.2, 1.15, S.acc2 + 'aa');
  } else if (code === 'XMAS') {
    // a little snow on top, a string of lights along the bottom
    g.fillStyle = '#f4f8ff'; g.beginPath(); g.moveTo(x0 + 3, y0 + 2);
    for (let x = x0 + 3; x < x0 + W - 3; x += 12) { const b = 3 + hashStr('sn' + Math.round(x - x0)) % 4; g.quadraticCurveTo(x + 6, y0 - b, Math.min(x0 + W - 3, x + 12), y0 + 1); }
    g.lineTo(x0 + W - 3, y0 + 3.5); g.lineTo(x0 + 3, y0 + 3.5); g.closePath(); g.fill();
    const cols = ['#ff4040', '#3fdc78', '#ffd23f', '#5ab8ff'], yb = y0 + H;
    g.strokeStyle = '#0a2214'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + 4, yb);
    for (let x = x0 + 4; x < x0 + W - 4; x += 30) g.quadraticCurveTo(x + 15, yb + 5, Math.min(x0 + W - 4, x + 30), yb);
    g.stroke();
    let i = 0;
    for (let x = x0 + 19; x < x0 + W - 8; x += 30, i++) {
      const a = 0.65 + 0.35 * Math.sin(t * 1.6 + i * 1.7);
      g.globalAlpha = a; g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(x, yb + 5.5, 2.3, 3.2, 0, 0, 7); g.fill();
      g.globalAlpha = a * 0.35; g.beginPath(); g.arc(x, yb + 5.5, 5.5, 0, 7); g.fill();
    }
  }
  g.restore();
}

// ---------- Season: tag the real-feeling TV slots (1 Thursday, 1 Sunday night, 1 Monday night a week + holidays) ----------
// Tags are stored on the schedule the first time they're needed, so old saved seasons get them too. Deterministic (no Math.random).
const SeasonBC = {
  weeks(n) { return { hw: n >= 6 ? Math.round(n * 7 / 17) : -1, cw: n >= 6 ? n - 2 : -1 }; }, // Halloween ~ week 8 of 17, Christmas the next-to-last week
  ensure(d) {
    if (!d || !d.weeks || d.bcv === 1) return;
    const n = d.weeks.length, { hw, cw } = this.weeks(n), seen = {}, byId = id => TEAMS.find(t => t.id === id);
    const ovr = id => { try { return Season.ovr(id); } catch (e) { return 75; } };
    d.weeks.forEach((wk, w) => {
      const slots = w === cw ? ['XMAS', 'XMAS', 'SNF', 'MNF'] : w === hw ? ['SNF', 'MNF', 'HWN'] : ['SNF', 'MNF', 'TNF'];
      const sc = wk.map((m, i) => {
        if (!m || !m.home || !m.away) return [-1e9, i];
        const riv = isRivalry(byId(m.home), byId(m.away)) ? 5 : 0, mine = i === 0 ? 3 : 0;
        const rep = ((seen[m.home] || 0) + (seen[m.away] || 0)) * 3.5, noise = (hashStr(`${d.year || 1}:${w}:${m.home}${m.away}`) % 1000) / 1000 * 7;
        return [ovr(m.home) + ovr(m.away) + riv + mine + noise - rep, i];
      }).sort((a, b) => b[0] - a[0]);
      for (const m of wk) if (m) delete m.bc;
      slots.forEach((s, k) => { const e = sc[k]; if (!e || e[0] < -1e8) return; const m = wk[e[1]]; m.bc = s; seen[m.home] = (seen[m.home] || 0) + 1; seen[m.away] = (seen[m.away] || 0) + 1; });
    });
    d.bcv = 1;
    try { Season.save(); } catch (e) {}
  },
  // tag of one game (gi = index in the week, 0 = yours)
  of(d, w, gi) { if (!d) return null; this.ensure(d); const m = d.weeks && d.weeks[w] && d.weeks[w][gi || 0]; return (m && BCAST[m.bc]) ? m.bc : null; },
  tag(code) { return BCAST[code] ? `<b class="bcTag bc${code}">${BCAST[code].short}</b>` : ''; }
};

// hub: tags on the schedule list + the next-game card
{ const _hub = renderHub; renderHub = function () {
  const d = Season.data; try { SeasonBC.ensure(d); } catch (e) { console.warn('bc tags', e); }
  _hub();
  if (!d || !d.weeks) return;
  const rows = $('shSched').querySelectorAll('.wkrow');
  d.weeks.forEach((wk, i) => { const c = wk[0] && wk[0].bc, sp = rows[i] && rows[i].querySelector('span'); if (c && sp) sp.insertAdjacentHTML('beforeend', ' ' + SeasonBC.tag(c)); });
  const c = d.phase === 'regular' ? SeasonBC.of(d, d.week, 0) : null, lbl = $('shNext').querySelector('.lbl');
  if (c && lbl && Season.myGame()) {
    lbl.innerHTML = SeasonBC.tag(c) + ' ' + lbl.innerHTML.replace(/^NEXT GAME/, BCAST[c].name);
    const sub = $('shNext').querySelector('.sub'); // the tag already says it's a night game
    if (sub && BCAST[c].night) sub.innerHTML = sub.innerHTML.replace('Night game, ', '').replace('  •  Night game', '');
  }
}; }

// Quick Game / online: the BROADCAST setting (AUTO and SUNDAY = the normal look)
function quickBcast() { const v = $('optBcast') && $('optBcast').value; return BCAST[v] ? v : null; }
