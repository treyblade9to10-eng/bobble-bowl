// ---- Franchise extras: rookie draft, trade deadline, CPU-to-CPU trades + league news ----
const FIRST = ['Jaylen', 'Marcus', 'Tyrese', 'Cole', 'Devin', 'Bryce', 'Malik', 'Trey', 'Isaiah', 'Caleb', 'Darnell', 'Jace', 'Xavier', 'Quinton', 'Logan', 'Andre', 'Kobe',
  'Elijah', 'Tavion', 'Brock', 'Jalen', 'Zion', 'Deshawn', 'Carter', 'Mason', 'Javon', 'Rashad', 'Owen', 'Keon', 'Dante', 'Grayson', 'Micah', 'Terrell', 'Bo', 'Amari'];
const LAST = ['Okafor', 'Brightwater', 'McAllister', 'Stonebrook', 'Fairley', 'Delacroix', 'Hollins', 'Pruitt', 'Vance', 'Ashworth', 'Kincaid', 'Mabry', 'Oduya', 'Thibodeau',
  'Rucker', 'Langston', 'Whitfield', 'Nwosu', 'Castellano', 'Brannigan', 'Sowell', 'Easley', 'Holloway', 'Pettiford', 'Quarles', 'Dupree', 'Lockett', 'Ferrante', 'Gaines', 'Mosley'];
const SCHOOLS = ['Alabama', 'Ohio State', 'Georgia', 'LSU', 'Michigan', 'Texas', 'Oregon', 'USC', 'Clemson', 'Penn State', 'Florida State', 'Miami', 'Notre Dame', 'Wisconsin',
  'Iowa', 'Utah', 'Tennessee', 'Ole Miss', 'Washington', 'Boise State', 'TCU', 'Auburn'];
const DRAFT_POS = ['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S'];
const ROOKIE_SPD = { QB: [70, 90], RB: [86, 95], WR: [87, 97], TE: [78, 88], OL: [60, 72], DL: [72, 87], LB: [80, 90], CB: [89, 97], S: [86, 93] };

Object.assign(Season, {
  deadline() { return Math.max(2, Math.ceil(this.data.games * 0.6)); },          // last week you can trade
  canTrade() { const d = this.data; return d.phase === 'regular' && d.week < this.deadline(); },

  // ---- CPU teams make deals with each other during the season ----
  cpuTrades() {
    const d = this.data; if (!this.canTrade() || !chance(0.4)) return;
    const R = this.ensureRosters(), ids = Object.keys(R).filter(i => i !== d.team);
    for (let tries = 0; tries < 20; tries++) {
      const a = pick(ids), b = pick(ids); if (a === b) continue;
      const side = chance(0.5) ? 'off' : 'def', i = Math.floor(Math.random() * 8);
      const pa = R[a][side][i], j = R[b][side].findIndex(p => p[0] === pa[0] && p !== pa);
      if (j < 0) continue;
      const pb = R[b][side][j], o1 = this.tradeOdds(pa, pb), o2 = this.tradeOdds(pb, pa);
      if (o1 < 65 || o2 < 65 || Math.abs(pa[3] - pb[3]) > 4) continue; // both sides have to like it
      R[a][side][i] = pb; R[b][side][j] = pa;
      this.news(`TRADE: ${a} sends ${pa[0]} ${pa[1]} (${pa[3]}) to ${b} for ${pb[0]} ${pb[1]} (${pb[3]})`);
      return;
    }
  },
  news(text) { const d = this.data; (d.news || (d.news = [])).unshift({ text, week: d.week + 1, year: d.year }); d.news.length = Math.min(d.news.length, 40); },

  // ---- rookie draft (runs before the next year starts) ----
  makeProspect() {
    const pos = pick(DRAFT_POS), r = Math.random();
    const ovr = Math.round(r < 0.06 ? rand(80, 85) : r < 0.3 ? rand(74, 80) : rand(64, 74));
    const [s0, s1] = ROOKIE_SPD[pos];
    const spd = Math.round(rand(s0, s1));
    const t = [pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), ovr, spd, Math.floor(Math.random() * 6), { rookie: this.data.year + 1 }];
    t.school = pick(SCHOOLS); t.pot = ovr >= 78 || chance(0.25) ? 'A' : chance(0.5) ? 'B' : 'C';
    return t;
  },
  // which roster spot a prospect would take (the weakest guy at his position), and by how much he's better
  fit(teamId, pr) {
    const R = this.ensureRosters()[teamId], side = ['QB', 'RB', 'WR', 'TE', 'OL'].includes(pr[0]) ? 'off' : 'def';
    const same = p => p[0] === pr[0] || (pr[0] === 'TE' && p[0] === 'WR') || (pr[0] === 'WR' && p[0] === 'TE');
    let best = -1;
    R[side].forEach((p, i) => { if (same(p) && (best < 0 || p[3] < R[side][best][3])) best = i; });
    if (best < 0) return null;
    const pot = { A: 6, B: 3, C: 0 }[pr.pot] || 0;
    return { side, i: best, cur: R[side][best], gain: pr[3] + pot - R[side][best][3] };
  },
  startDraft() {
    const d = this.data;
    this.ensureRosters();
    // worst record picks first, champion picks last
    const order = TEAMS.map(t => t.id).sort((a, b) => this.pct(a) - this.pct(b) || (d.rec[a].pf - d.rec[a].pa) - (d.rec[b].pf - d.rec[b].pa));
    if (d.champ) { order.splice(order.indexOf(d.champ), 1); order.push(d.champ); }
    const pool = []; for (let i = 0; i < 48; i++) pool.push(this.makeProspect());
    pool.sort((a, b) => b[3] - a[3]);
    d.draft = { order, pool: pool.map(p => ({ t: p.slice(0, 7), school: p.school, pot: p.pot })), picks: [], i: 0 };
    this.save();
  },
  // CPU teams pick until it's your turn (or the draft is over). Returns true if it's your pick.
  draftRun() {
    const dr = this.data.draft;
    while (dr.i < dr.order.length) {
      const team = dr.order[dr.i];
      if (team === this.data.team) return true;
      // best value for what they need, with some randomness
      let bi = 0, bs = -1e9;
      dr.pool.forEach((pr, k) => { const t = Object.assign(pr.t.slice(), { pot: pr.pot }), f = this.fit(team, t); const sc = (f ? f.gain : -20) + pr.t[3] * 0.25 + rand(-3, 3); if (sc > bs) { bs = sc; bi = k; } });
      this.draftPick(team, bi);
    }
    return false;
  },
  draftPick(team, k) {
    const dr = this.data.draft, pr = dr.pool.splice(k, 1)[0];
    const t = Object.assign(pr.t.slice(), { pot: pr.pot }), f = this.fit(team, t);
    let replaced = null;
    if (f && f.gain > 0) { replaced = f.cur; this.ensureRosters()[team][f.side][f.i] = pr.t; } // rookie starts over the weakest guy
    dr.picks.push({ n: dr.i + 1, team, name: pr.t[1], pos: pr.t[0], ovr: pr.t[3], pot: pr.pot, school: pr.school, starts: !!replaced, replaced: replaced ? replaced[1] : null });
    dr.i++;
    this.save();
  }
});

// rookies grow faster: hook the yearly development
const _develop = Season.develop.bind(Season);
Season.develop = function () {
  const R = this.ensureRosters();
  for (const id in R) for (const side of ['off', 'def']) R[id][side].forEach(p => { if (p[6] && p[6].rookie) { p[3] = clamp(p[3] + Math.round(rand(1, 4)), 55, 99); if (p[6].rookie < this.data.year - 1) delete p[6].rookie; } });
  return _develop();
};
// CPU trades happen as the weeks go by
const _finishWeek = Season.finishWeek.bind(Season);
Season.finishWeek = function (s) {
  _finishWeek(s);
  this.cpuTrades();
  if (this.data.phase === 'regular' && this.data.week === this.deadline()) this.news('The trade deadline has passed. Rosters are locked until the offseason.');
  this.save();
};

// ---------------- UI ----------------
screens.push('draft'); menuScreens.push('draft');
function openDraft() {
  if (!Season.data.draft) Season.startDraft();
  const mine = Season.draftRun();
  renderDraft(mine);
  show('draft');
}
function renderDraft(myTurn) {
  const d = Season.data, dr = d.draft, me = Season.team(d.team);
  const recent = dr.picks.slice(-6).reverse().map(p => `<div class="dpRow"><span>#${p.n} ${dotFor(p.team)}${p.team}</span><b>${p.pos} ${p.name}</b><i>${p.ovr} OVR</i></div>`).join('');
  let board = '';
  if (myTurn) {
    board = dr.pool.slice(0, 24).map((pr, k) => {
      const f = Season.fit(d.team, Object.assign(pr.t.slice(), { pot: pr.pot }));
      const note = f ? (pr.t[3] > f.cur[3] ? `<span class="up">starts over ${lastName(f.cur[1])} (${f.cur[3]})</span>` : `<span>backup to ${lastName(f.cur[1])} (${f.cur[3]})</span>`) : '';
      return `<div class="dRow" data-k="${k}"><span class="pos">${pr.t[0]}</span><b>${pr.t[3]}</b><span class="nm">${pr.t[1]}<i>${pr.school}  •  SPD ${pr.t[4]}  •  POT ${pr.pot}</i></span>${note}</div>`;
    }).join('');
  } else {
    const mineP = dr.picks.find(p => p.team === d.team);
    board = `<div class="dDone">DRAFT COMPLETE</div>${mineP ? `<div class="dMine">Your pick: <b>#${mineP.n} ${mineP.pos} ${mineP.name}</b> (${mineP.ovr} OVR, potential ${mineP.pot}, ${mineP.school})<br>${mineP.starts ? `He starts right away over ${mineP.replaced}.` : 'He sits behind your starters for now.'}</div>` : ''}
      <div class="dTop">${dr.picks.slice(0, 8).map(p => `<div class="dpRow"><span>#${p.n} ${dotFor(p.team)}${p.team}</span><b>${p.pos} ${p.name}</b><i>${p.ovr}</i></div>`).join('')}</div>`;
  }
  $('drBody').innerHTML = `<div class="dHead">${me.city.toUpperCase()} ${me.name.toUpperCase()}  ·  YEAR ${d.year + 1} DRAFT  ·  ${myTurn ? `YOU'RE ON THE CLOCK (PICK #${dr.i + 1})` : 'ALL 32 PICKS ARE IN'}</div>
    <div class="dWrap"><div class="dBoard">${board}</div><div class="dSide"><div class="leadHead">LATEST PICKS</div>${recent || '<div class="note">Nobody has picked yet</div>'}</div></div>`;
  $('drGo').textContent = myTurn ? 'AUTO PICK FOR ME' : `START YEAR ${d.year + 1}`;
  document.querySelectorAll('.dRow').forEach(r => r.onclick = () => { Sound.td(); Season.draftPick(d.team, +r.dataset.k); Season.draftRun(); renderDraft(false); });
  $('drGo').onclick = () => {
    if (myTurn) { let bi = 0, bs = -1e9; dr.pool.forEach((pr, k) => { const f = Season.fit(d.team, Object.assign(pr.t.slice(), { pot: pr.pot })); const sc = (f ? f.gain : -20) + pr.t[3] * 0.25; if (sc > bs) { bs = sc; bi = k; } }); Season.draftPick(d.team, bi); Season.draftRun(); Sound.click(); return renderDraft(false); }
    const draftNews = dr.picks.slice(0, 3).map(p => `DRAFT: ${p.team} takes ${p.pos} ${p.name} (${p.school}) at #${p.n}`);
    delete d.draft;
    const ch = Season.nextYear(); Sound.whistle();
    draftNews.reverse().forEach(t => Season.news(t)); Season.save();
    renderOffseason(ch);
  };
}
