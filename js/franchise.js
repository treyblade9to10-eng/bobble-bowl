// ---- Franchise extras: rookie draft, trade deadline, CPU-to-CPU trades + league news ----
const FIRST = ['Jaylen', 'Marcus', 'Tyrese', 'Cole', 'Devin', 'Bryce', 'Malik', 'Trey', 'Isaiah', 'Caleb', 'Darnell', 'Jace', 'Xavier', 'Quinton', 'Logan', 'Andre', 'Kobe',
  'Elijah', 'Tavion', 'Brock', 'Jalen', 'Zion', 'Deshawn', 'Carter', 'Mason', 'Javon', 'Rashad', 'Owen', 'Keon', 'Dante', 'Grayson', 'Micah', 'Terrell', 'Bo', 'Amari',
  'Tre', 'Kendrick', 'Austin', 'Damon', 'Wyatt', 'Jamal', 'Chase', 'Rylan', 'Desmond', 'Hunter', 'Kai', 'Marquis', 'Silas', 'Tariq', 'Ezra', 'Landon', 'Nico', 'Roman', 'Cedric', 'Jett'];
const LAST = ['Okafor', 'Brightwater', 'McAllister', 'Stonebrook', 'Fairley', 'Delacroix', 'Hollins', 'Pruitt', 'Vance', 'Ashworth', 'Kincaid', 'Mabry', 'Oduya', 'Thibodeau',
  'Rucker', 'Langston', 'Whitfield', 'Nwosu', 'Castellano', 'Brannigan', 'Sowell', 'Easley', 'Holloway', 'Pettiford', 'Quarles', 'Dupree', 'Lockett', 'Ferrante', 'Gaines', 'Mosley',
  'Bramlett', 'Tolliver', 'Okonkwo', 'Haverford', 'Pickens', 'Lunsford', 'Arceneaux', 'Wingate', 'Coltrane', 'Mabrey', 'Stallworth', 'Fontenot', 'Ridley', 'Batiste', 'Kimbrough',
  'Deloach', 'Hargrove', 'Ellison', 'Strickland', 'Petrakis', 'Ogunleye', 'Treadwell', 'Bellamy', 'Crutchfield', 'Mayweather', 'Lindqvist', 'Amadi', 'Sorensen', 'Bynum', 'Gallardo'];
const SCHOOLS = ['Alabama', 'Ohio State', 'Georgia', 'LSU', 'Michigan', 'Texas', 'Oregon', 'USC', 'Clemson', 'Penn State', 'Florida State', 'Miami', 'Notre Dame', 'Wisconsin',
  'Iowa', 'Utah', 'Tennessee', 'Ole Miss', 'Washington', 'Boise State', 'TCU', 'Auburn'];
const SMALL_SCHOOLS = ['North Dakota State', 'Montana', 'Appalachian State', 'Toledo', 'Fresno State', 'James Madison', 'South Dakota State', 'Tulane', 'Memphis', 'UCF',
  'Liberty', 'Sacramento State', 'Wyoming', 'Northern Iowa', 'Coastal Carolina', 'Jackson State', 'Villanova', 'Air Force', 'Marshall', 'Kent State', 'Eastern Washington', 'Furman'];
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

  // ---- rookie draft (runs before the next year starts): 7 rounds ----
  // rank = where he'd go on a big board (0 = first overall), n = how many prospects. Late-round guys are mostly 45-70.
  makeProspect(rank = 0, n = 256, used) {
    const pos = pick(DRAFT_POS), k = rank / n;
    const ovr = Math.round(clamp(83 - 36 * Math.pow(k, 0.75) + rand(-3, 3), 44, 86));
    const [s0, s1] = ROOKIE_SPD[pos];
    const spd = Math.round(clamp(rand(s0, s1) - (ovr < 60 ? 3 : 0), 50, 99));
    const pot = ovr >= 78 || chance(k < 0.2 ? 0.25 : 0.12) ? 'A' : chance(0.45) ? 'B' : 'C';
    let name; for (let i = 0; i < 20; i++) { name = `${pick(FIRST)} ${pick(LAST)}`; if (!used || !used.has(name)) break; }
    if (used) used.add(name);
    const t = [pos, name, 1 + Math.floor(Math.random() * 98), ovr, spd, Math.floor(Math.random() * 6), { rookie: this.data.year + 1, pot, age: chance(0.6) ? 22 : chance(0.5) ? 21 : 23 }];
    t.school = k < 0.3 ? pick(SCHOOLS) : pick(chance(0.5) ? SCHOOLS : SMALL_SCHOOLS); t.pot = pot;
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
    const d = this.data, n = TEAMS.length;
    this.ensureRosters();
    const P = this.ensurePicks(), year = this.draftYear();
    // worst record picks first, champion picks last, same order every round. Traded picks go to their new owner.
    const base = TEAMS.map(t => t.id).sort((a, b) => this.pct(a) - this.pct(b) || (d.rec[a].pf - d.rec[a].pa) - (d.rec[b].pf - d.rec[b].pa));
    if (d.champ) { base.splice(base.indexOf(d.champ), 1); base.push(d.champ); }
    const order = [], via = [], rd = [];
    for (let r = 1; r <= ROUNDS; r++) for (const id of base) { via.push(id); rd.push(r); order.push((P[year] && P[year][id] && P[year][id][r - 1]) || id); }
    // the next few years start with REAL college players (draftclasses.js); everyone after them is made up
    const real = typeof DRAFT_CLASSES !== 'undefined' && DRAFT_CLASSES[year] || [];
    const pool = real.map(r => { const t = r.slice(0, 6); t.push({ rookie: d.year + 1, pot: r[7], age: r[8] || 22, real: 1 }); t.school = r[6]; t.pot = r[7]; return t; });
    const total = order.length + 32, used = new Set(pool.map(t => t[1]));
    for (const id in d.rosters) for (const g of ['off', 'def', 'bench']) for (const p of d.rosters[id][g] || []) if (p) used.add(p[1]);
    while (pool.length < total) pool.push(this.makeProspect(pool.length, total, used));
    pool.sort((a, b) => b[3] - a[3]);
    d.draft = { order, via, rd, rounds: ROUNDS, year, real: real.length > 0, pool: pool.map(p => ({ t: p.slice(0, 7), school: p.school, pot: p.pot })), picks: [], i: 0 };
    this.save();
  },
  // an older save stopped in the middle of a 1-round draft: add rounds 2-7 and enough prospects for them
  upgradeDraft() {
    const d = this.data, dr = d.draft; if (!dr || dr.rd) return;
    const n = dr.order.length, P = this.ensurePicks(), base = (dr.via || dr.order).slice();
    dr.via = base.slice(); dr.rd = base.map(() => 1); dr.rounds = ROUNDS;
    for (let r = 2; r <= ROUNDS; r++) for (const id of base) { dr.via.push(id); dr.rd.push(r); dr.order.push((P[dr.year] && P[dr.year][id] && P[dr.year][id][r - 1]) || id); }
    const total = dr.order.length - dr.i + 32, used = new Set(dr.pool.map(pr => pr.t[1]));
    for (let k = dr.pool.length; k < total; k++) { const t = this.makeProspect(Math.round(n + (k - dr.pool.length) * (dr.order.length - n) / (total - dr.pool.length)), dr.order.length + 32, used), pr = { t: t.slice(0, 7), school: t.school, pot: t.pot };
      if (typeof Scout !== 'undefined' && dr.sp != null) { Scout.hide(pr); Scout.measure(pr); } dr.pool.push(pr); }
    this.save();
  },
  // CPU teams pick until it's your turn (or the draft is over). Returns true if it's your pick.
  draftRun() {
    const dr = this.data.draft;
    while (dr.i < dr.order.length) {
      const team = dr.order[dr.i];
      if (team === this.data.team) { this.save(); return true; }
      // best value for what they need, with some randomness
      let bi = 0, bs = -1e9;
      dr.pool.forEach((pr, k) => { const t = Object.assign(pr.t.slice(), { pot: pr.pot }); if (pr.cpu != null) t[3] = pr.cpu; /* CPU scouts aren't perfect either */ const f = this.fit(team, t); const sc = (f ? f.gain : -20) + t[3] * 0.25 + rand(-3, 3); if (sc > bs) { bs = sc; bi = k; } });
      this.draftPick(team, bi, true);
    }
    this.save();
    return false;
  },
  // your best pick by the scouts' grades (AUTO PICK)
  myAutoPick() {
    const d = this.data, dr = d.draft; let bi = 0, bs = -1e9;
    dr.pool.forEach((pr, k) => { const st = seenT(pr), f = this.fit(d.team, st); const sc = (f ? f.gain : -20) + st[3] * 0.25 + ({ A: 2, B: 1 }[st.pot] || 0); if (sc > bs) { bs = sc; bi = k; } });
    return bi;
  },
  // roster cut-down after the draft: how many of your guys have to go
  overLimit(id) { return Math.max(0, this.benchCount(id) - BENCH_MAX); },
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
  Season.upgradeDraft(); // older saves: 1-round draft in progress
  if (!Season.data.draft.combineDone) return openCombine(); // scouting combine first (franchise2.js)
  renderDraft();
  show('draft');
}
let draftPos = 'ALL';
// 'R2 #5' (pick 37 overall)
const draftSlot = (dr, i) => { const n = TEAMS.length, r = dr.rd ? dr.rd[i] : 1; return `R${r} #${i - (r - 1) * n + 1}`; };
// the cut-down after the draft: which of your bench guys go (preselected: the ones you'd miss least)
function draftCuts() {
  const d = Season.data, dr = d.draft, need = Season.overLimit(d.team), bench = Season.bench(d.team).filter(p => p && !Season.hurt(p));
  if (!dr.cuts) dr.cuts = Season.cutOrder(d.team).slice(0, need).map(p => p[1]);
  dr.cuts = dr.cuts.filter(nm => bench.some(p => p[1] === nm));
  return { need, bench };
}
// the draft goes one pick at a time: watch, trade up, or sim to your pick (trades + scouting: franchise2.js)
function renderDraft() {
  const d = Season.data, dr = d.draft, me = Season.team(d.team);
  const over = dr.i >= dr.order.length, myTurn = !over && dr.order[dr.i] === d.team, more = dr.order.slice(dr.i).includes(d.team);
  const recent = dr.picks.slice(-8).reverse().map(p => `<div class="dpRow${p.team === d.team ? ' me' : ''}"><span>${draftSlot(dr, p.n - 1)} ${dotFor(p.team)}${p.team}${p.via ? ` <small>via ${p.via}</small>` : ''}</span><b>${p.pos} ${p.name}</b><i>${p.ovr}</i></div>`).join('');
  let board = '', side = '';
  if (!over) {
    const tabs = `<div class="tlTabs dFilt">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'].map(f => `<button data-f="${f}" class="${draftPos === f ? 'on' : ''}">${f}</button>`).join('')}</div>`;
    const shown = dr.pool.map((pr, k) => [pr, k]).filter(([pr]) => draftPos === 'ALL' || pr.t[0] === draftPos).slice(0, draftPos === 'ALL' ? 40 : 48);
    board = tabs + (shown.length ? '' : `<div class="note">No ${draftPos}s left on the board.</div>`) + shown.map(([pr, k]) => {
      const st = seenT(pr), f = Season.fit(d.team, st);
      const note = f ? (st[3] > f.cur[3] ? `<span class="up">starts over ${lastName(f.cur[1])} (${f.cur[3]})</span>` : `<span>backup to ${lastName(f.cur[1])} (${f.cur[3]})</span>`) : '';
      return `<div class="dRow${myTurn ? '' : ' wait'}" tabindex="0" data-k="${k}"><span class="pos">${pr.t[0]}</span><b>${scoutOvr(pr)}</b><span class="nm">${pr.t[1]}<i>${pr.school}  •  AGE ${(pr.t[6] && pr.t[6].age) || 22}  •  SPD ${pr.t[4]}  •  POT ${scoutPot(pr)}</i></span>${note}</div>`;
    }).join('');
    const left = dr.order.map((o, j) => [o, j]).filter(([o, j]) => o === d.team && j >= dr.i).map(([, j]) => draftSlot(dr, j));
    side = `${draftDesk(myTurn, over)}<div class="leadHead">YOUR PICKS LEFT</div><div class="dLeft">${left.join('  ·  ') || 'None'}</div><div class="leadHead">LATEST PICKS</div>${recent || '<div class="note">Nobody has picked yet</div>'}`;
  } else {
    const mine = dr.picks.filter(p => p.team === d.team);
    board = `<div class="dDone">DRAFT COMPLETE  ·  YOUR CLASS</div>${mine.map(p => `<div class="dMine"><span>${draftSlot(dr, p.n - 1)}</span><b>${p.pos} ${p.name}</b><i>${p.ovr} OVR  ·  POT ${p.pot}  ·  ${p.school}</i><em class="${p.starts ? 'up' : ''}">${p.starts ? `STARTS OVER ${lastName(p.replaced).toUpperCase()}` : 'BENCH'}</em></div>`).join('') || '<div class="note">You had no picks this year.</div>'}
      <div class="leadHead">FIRST ROUND</div><div class="dTop">${dr.picks.slice(0, TEAMS.length).map(p => `<div class="dpRow"><span>#${p.n} ${dotFor(p.team)}${p.team}</span><b>${p.pos} ${p.name}</b><i>${p.ovr}</i></div>`).join('')}</div>`;
    const { need, bench } = draftCuts();
    side = need ? `<div class="leadHead">ROSTER CUT-DOWN</div><div class="dCutNote">The bench holds ${BENCH_MAX}. You have ${bench.length}: release ${need} (${dr.cuts.length} picked). Tap a player to change.</div>`
      + Season.cutOrder(d.team).map(p => { const on = dr.cuts.includes(p[1]), m = p[6] || {};
        return `<div class="dCut${on ? ' on' : ''}" tabindex="0" data-n="${p[1]}"><span class="pos">${p[0]}</span><b>${p[3]}</b><span class="nm">${p[1]}<i>AGE ${m.age || '?'}${m.rookie ? '  ·  ROOKIE' : ''}${m.pot && m.rookie ? '  ·  POT ' + m.pot : ''}</i></span><em>${on ? 'CUT' : 'KEEP'}</em></div>`; }).join('')
      : `<div class="leadHead">ROSTER</div><div class="note">Your bench has room for everyone (${bench.length} of ${BENCH_MAX}).</div><div class="leadHead">LATEST PICKS</div>${recent}`;
  }
  const n = TEAMS.length, rd = !over && dr.rd ? dr.rd[dr.i] : 0;
  $('drBody').innerHTML = `<div class="dHead">${me.name.toUpperCase()}  ·  ${dr.year || Season.draftYear()} DRAFT${dr.real ? ' (REAL CLASS)' : ''}  ·  ${myTurn ? `YOU'RE ON THE CLOCK: ROUND ${rd}, PICK ${dr.i - (rd - 1) * n + 1} (#${dr.i + 1})` : over ? `ALL ${dr.order.length} PICKS ARE IN` : `ROUND ${rd || 1}  ·  #${dr.i + 1}: ${tName(dr.order[dr.i]).toUpperCase()} ON THE CLOCK`}</div>
    <div class="dWrap"><div class="dBoard">${board}</div><div class="dSide">${side}</div></div>`;
  const cutN = over ? draftCuts().need : 0;
  $('drGo').textContent = myTurn ? 'AUTO PICK FOR ME' : over ? (cutN ? `RELEASE ${cutN} + START YEAR ${d.year + 1}` : `START YEAR ${d.year + 1}`) : more ? 'SIM TO MY PICK' : 'FINISH THE DRAFT';
  wireDraftDesk();
  // after your pick: if you have no more picks the rest of the draft runs
  const picked = k => { Season.draftPick(d.team, k); if (!dr.order.slice(dr.i).includes(d.team)) Season.draftRun(); renderDraft(); };
  document.querySelectorAll('.dFilt button').forEach(b => b.onclick = () => { Sound.click(); draftPos = b.dataset.f; renderDraft(); });
  if (myTurn) document.querySelectorAll('.dRow').forEach(r => r.onclick = () => { Sound.td(); picked(+r.dataset.k); });
  document.querySelectorAll('.dCut').forEach(r => r.onclick = () => {
    const nm = r.dataset.n, i = dr.cuts.indexOf(nm), need = draftCuts().need; Sound.click();
    if (i >= 0) dr.cuts.splice(i, 1); else { dr.cuts.push(nm); if (dr.cuts.length > need) dr.cuts.shift(); }
    Season.save(); renderDraft();
  });
  $('drGo').onclick = () => {
    if (myTurn) { Sound.click(); return picked(Season.myAutoPick()); }
    if (!over) { Season.draftRun(); Sound.click(); return renderDraft(); }
    // cut-down: your picks first, then the guys you'd miss least if you didn't pick enough
    const { need } = draftCuts(), out = dr.cuts.slice();
    for (const p of Season.cutOrder(d.team)) { if (out.length >= need) break; if (!out.includes(p[1])) out.push(p[1]); }
    for (const nm of out.slice(0, need)) { const p = Season.bench(d.team).find(x => x && x[1] === nm); if (p) Season.release(d.team, p, 'Roster cut-down.'); }
    const draftNews = dr.picks.slice(0, 3).map(p => `DRAFT: the ${tName(p.team)} take ${p.pos} ${p.name} (${p.school}) at #${p.n}`);
    delete d.draft;
    for (const t of TEAMS) Season.trimBench(t.id); // CPU teams make their cuts too
    const ch = Season.nextYear(); Sound.whistle();
    draftNews.reverse().forEach(t => Season.news(t)); Season.save();
    renderOffseason(ch);
  };
}
