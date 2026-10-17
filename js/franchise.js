// ---- Franchise extras: rookie draft, trade deadline, CPU-to-CPU trades + league news ----
const FIRST = ['Jaylen', 'Marcus', 'Tyrese', 'Cole', 'Devin', 'Bryce', 'Malik', 'Trey', 'Isaiah', 'Caleb', 'Darnell', 'Jace', 'Xavier', 'Quinton', 'Logan', 'Andre', 'Kobe',
  'Elijah', 'Tavion', 'Brock', 'Jalen', 'Zion', 'Deshawn', 'Carter', 'Mason', 'Javon', 'Rashad', 'Owen', 'Keon', 'Dante', 'Grayson', 'Micah', 'Terrell', 'Bo', 'Amari'];
const LAST = ['Okafor', 'Brightwater', 'McAllister', 'Stonebrook', 'Fairley', 'Delacroix', 'Hollins', 'Pruitt', 'Vance', 'Ashworth', 'Kincaid', 'Mabry', 'Oduya', 'Thibodeau',
  'Rucker', 'Langston', 'Whitfield', 'Nwosu', 'Castellano', 'Brannigan', 'Sowell', 'Easley', 'Holloway', 'Pettiford', 'Quarles', 'Dupree', 'Lockett', 'Ferrante', 'Gaines', 'Mosley'];
const SCHOOLS = ['Alabama', 'Ohio State', 'Georgia', 'LSU', 'Michigan', 'Texas', 'Oregon', 'USC', 'Clemson', 'Penn State', 'Florida State', 'Miami', 'Notre Dame', 'Wisconsin',
  'Iowa', 'Utah', 'Tennessee', 'Ole Miss', 'Washington', 'Boise State', 'TCU', 'Auburn'];
const DRAFT_POS = ['QB', 'QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S'];
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
    const pot = ovr >= 78 || chance(0.25) ? 'A' : chance(0.5) ? 'B' : 'C';
    const t = [pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), ovr, spd, Math.floor(Math.random() * 6), { rookie: this.data.year + 1, pot, age: chance(0.6) ? 22 : chance(0.5) ? 21 : 23 }];
    t.school = pick(SCHOOLS); t.pot = pot;
    return t;
  },
  draftYear() { return 2026 + this.data.year; }, // year 1 = the 2026 season, so its draft is the 2027 draft
  // who's coming out next draft (for the season hub)
  draftPreview(n = 10) {
    const real = typeof DRAFT_CLASSES !== 'undefined' && DRAFT_CLASSES[this.draftYear()];
    return real ? real.slice().sort((a, b) => b[3] - a[3]).slice(0, n) : null;
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
    // the next few years are REAL college players (draftclasses.js); after that, made-up classes
    const year = this.draftYear(), real = typeof DRAFT_CLASSES !== 'undefined' && DRAFT_CLASSES[year] || [];
    const pool = real.map(r => { const t = r.slice(0, 6); t.push({ rookie: d.year + 1, pot: r[7], age: r[8] || 22, real: 1 }); t.school = r[6]; t.pot = r[7]; return t; });
    while (pool.length < 48) pool.push(this.makeProspect());
    pool.sort((a, b) => b[3] - a[3]);
    d.draft = { order, year, real: real.length > 0, pool: pool.map(p => ({ t: p.slice(0, 7), school: p.school, pot: p.pot })), picks: [], i: 0 };
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
      dr.pool.forEach((pr, k) => { const t = Object.assign(pr.t.slice(), { pot: pr.pot }); if (pr.cpu != null) t[3] = pr.cpu; /* CPU scouts aren't perfect either */ const f = this.fit(team, t); const sc = (f ? f.gain : -20) + t[3] * 0.25 + rand(-3, 3); if (sc > bs) { bs = sc; bi = k; } });
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

// rookie growth, aging and big seasons: see aging.js
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
  if (!Season.data.draft.combineDone) return openCombine(); // scouting combine first (franchise2.js)
  renderDraft();
  show('draft');
}
let draftPos = 'ALL';
// the draft goes one pick at a time: watch, trade up, or sim to your pick (trades + scouting: franchise2.js)
function renderDraft() {
  const d = Season.data, dr = d.draft, me = Season.team(d.team);
  const over = dr.i >= dr.order.length, myTurn = !over && dr.order[dr.i] === d.team, more = dr.order.slice(dr.i).includes(d.team);
  const recent = dr.picks.slice(-6).reverse().map(p => `<div class="dpRow"><span>#${p.n} ${dotFor(p.team)}${p.team}${p.via ? ` <small>via ${p.via}</small>` : ''}</span><b>${p.pos} ${p.name}</b><i>${p.ovr} OVR</i></div>`).join('');
  let board = '';
  if (!over) {
    const tabs = `<div class="tlTabs dFilt">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'].map(f => `<button data-f="${f}" class="${draftPos === f ? 'on' : ''}">${f}</button>`).join('')}</div>`;
    const shown = dr.pool.map((pr, k) => [pr, k]).filter(([pr]) => draftPos === 'ALL' || pr.t[0] === draftPos).slice(0, draftPos === 'ALL' ? 30 : 48);
    board = tabs + (shown.length ? '' : `<div class="note">No ${draftPos}s left on the board.</div>`) + shown.map(([pr, k]) => {
      const st = seenT(pr), f = Season.fit(d.team, st);
      const note = f ? (st[3] > f.cur[3] ? `<span class="up">starts over ${lastName(f.cur[1])} (${f.cur[3]})</span>` : `<span>backup to ${lastName(f.cur[1])} (${f.cur[3]})</span>`) : '';
      return `<div class="dRow${myTurn ? '' : ' wait'}" tabindex="0" data-k="${k}"><span class="pos">${pr.t[0]}</span><b>${scoutOvr(pr)}</b><span class="nm">${pr.t[1]}<i>${pr.school}  •  AGE ${(pr.t[6] && pr.t[6].age) || 22}  •  SPD ${pr.t[4]}  •  POT ${scoutPot(pr)}</i></span>${note}</div>`;
    }).join('');
  } else {
    const mine = dr.picks.filter(p => p.team === d.team);
    board = `<div class="dDone">DRAFT COMPLETE</div>${mine.map(p => `<div class="dMine">Your pick: <b>#${p.n} ${p.pos} ${p.name}</b> (${p.ovr} OVR, potential ${p.pot}, ${p.school})<br>${p.starts ? `He starts right away over ${p.replaced}.` : 'He sits behind your starters for now.'}</div>`).join('')}
      <div class="dTop">${dr.picks.slice(0, 8).map(p => `<div class="dpRow"><span>#${p.n} ${dotFor(p.team)}${p.team}</span><b>${p.pos} ${p.name}</b><i>${p.ovr}</i></div>`).join('')}</div>`;
  }
  $('drBody').innerHTML = `<div class="dHead">${me.city.toUpperCase()} ${me.name.toUpperCase()}  ·  ${dr.year || Season.draftYear()} DRAFT${dr.real ? ' (REAL CLASS)' : ''}  ·  ${myTurn ? `YOU'RE ON THE CLOCK (PICK #${dr.i + 1})` : over ? 'ALL 32 PICKS ARE IN' : `PICK #${dr.i + 1}: ${tName(dr.order[dr.i]).toUpperCase()} ON THE CLOCK`}</div>
    <div class="dWrap"><div class="dBoard">${board}</div><div class="dSide">${draftDesk(myTurn, over)}<div class="leadHead">LATEST PICKS</div>${recent || '<div class="note">Nobody has picked yet</div>'}</div></div>`;
  $('drGo').textContent = myTurn ? 'AUTO PICK FOR ME' : over ? `START YEAR ${d.year + 1}` : more ? 'SIM TO MY PICK' : 'FINISH THE DRAFT';
  wireDraftDesk();
  // after your pick: if you have no more picks the rest of the draft runs
  const picked = k => { Season.draftPick(d.team, k); if (!dr.order.slice(dr.i).includes(d.team)) Season.draftRun(); renderDraft(); };
  document.querySelectorAll('.dFilt button').forEach(b => b.onclick = () => { Sound.click(); draftPos = b.dataset.f; renderDraft(); });
  if (myTurn) document.querySelectorAll('.dRow').forEach(r => r.onclick = () => { Sound.td(); picked(+r.dataset.k); });
  $('drGo').onclick = () => {
    if (myTurn) { let bi = 0, bs = -1e9; dr.pool.forEach((pr, k) => { const st = seenT(pr), f = Season.fit(d.team, st); const sc = (f ? f.gain : -20) + st[3] * 0.25; if (sc > bs) { bs = sc; bi = k; } }); Sound.click(); return picked(bi); }
    if (!over) { Season.draftRun(); Sound.click(); return renderDraft(); }
    const draftNews = dr.picks.slice(0, 3).map(p => `DRAFT: the ${tName(p.team)} take ${p.pos} ${p.name} (${p.school}) at #${p.n}`);
    delete d.draft;
    const ch = Season.nextYear(); Sound.whistle();
    draftNews.reverse().forEach(t => Season.news(t)); Season.save();
    renderOffseason(ch);
  };
}
