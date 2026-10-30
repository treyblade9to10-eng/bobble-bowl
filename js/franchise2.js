// ---- Franchise 2: game recaps, injuries that last weeks, depth chart, scouting combine, draft-day trades ----
screens.push('recap', 'depth', 'combine'); menuScreens.push('recap', 'depth', 'combine');

// ================= injuries =================
// a hurt player keeps his info in p[6]: inj = weeks left, injWhat = what's hurt, injSlot = the starting spot he had
const INJ_WHAT = ['ankle', 'hamstring', 'knee', 'shoulder', 'concussion', 'ribs', 'foot', 'wrist', 'groin', 'back', 'calf', 'hand'];
const INJ_RATE = 0.011; // per starter per game: about 3 injuries a team each season
const injWeeks = () => { const r = Math.random(); return r < 0.45 ? 1 : r < 0.7 ? 2 : r < 0.82 ? 3 : r < 0.94 ? 4 + Math.floor(rand(0, 3)) : 7 + Math.floor(rand(0, 4)); };
const wkStr = n => `${n} WK${n === 1 ? '' : 'S'}`;

Object.assign(Season, {
  hurt(p) { return !!(p && p[6] && p[6].inj > 0); },
  injList(id) { const R = this.ensureRosters()[id], out = []; for (const g of ['off', 'def', 'bench']) (R[g] || []).forEach(p => { if (this.hurt(p)) out.push(p); }); return out; },
  // news stamped with the week the game was played
  wkNews(text, wk) { const d = this.data; (d.news || (d.news = [])).unshift({ text, week: wk + 1, year: d.year }); d.news.length = Math.min(d.news.length, 40); },
  freeAgent(pos) { const [s0, s1] = ROOKIE_SPD[pos] || [75, 88]; return [pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), Math.round(rand(60, 66)), Math.round(rand(s0, s1) - 2), Math.floor(Math.random() * 6), { age: Math.round(rand(24, 29)) }]; },
  // the best healthy backup takes a starting spot (or a free agent gets signed)
  fillSlot(id, side, i, wk) {
    const R = this.ensureRosters()[id], bench = this.bench(id), cur = R[side][i], pos = TEAMS.find(t => t.id === id)[side][i][0];
    let bi = -1; bench.forEach((b, j) => { if (b && !this.hurt(b) && posGroup(b[0]) === posGroup(pos) && (bi < 0 || b[3] > bench[bi][3])) bi = j; });
    const sub = bi >= 0 ? bench.splice(bi, 1)[0] : this.freeAgent(pos);
    if (bi < 0 && id === this.data.team) this.wkNews(`SIGNED: the ${tName(id)} sign free agent ${pos} ${sub[1]} (${sub[3]}). Nobody healthy was left at ${pos}.`, wk != null ? wk : this.data.week);
    R[side][i] = sub; if (cur) bench.push(cur);
    return sub;
  },
  injure(id, p, wks, what, wk) {
    const R = this.ensureRosters()[id], m = p[6] || (p[6] = {});
    m.inj = wks; m.injWhat = what || pick(INJ_WHAT); delete m.injSlot;
    for (const side of ['off', 'def']) { const i = R[side].indexOf(p); if (i >= 0) { m.injSlot = side + ':' + i; m.injSub = this.fillSlot(id, side, i, wk)[1]; } }
    const mine = id === this.data.team;
    if (mine || (p[3] >= 85 && m.injSlot)) this.wkNews(`INJURY: ${mine ? 'your' : `the ${tName(id)}'`} ${p[0]} ${p[1]} (${m.injWhat}) is out ${wks === 1 ? '1 week' : wks + ' weeks'}${mine && m.injSub ? `. ${m.injSub} starts` : ''}`, wk);
    (this._newInj || (this._newInj = [])).push({ team: id, pos: p[0], name: p[1], wks, what: m.injWhat });
  },
  // he's healthy: CPU teams start their best guys, your guy gets his old spot back if he's better than the fill-in
  healed(id, p, wk) {
    const m = p[6], slot = m.injSlot; delete m.inj; delete m.injWhat; delete m.injSlot; delete m.injSub;
    if (id !== this.data.team) return this.setLineup(id);
    this.wkNews(`BACK: ${p[0]} ${p[1]} is healthy again`, wk);
    const R = this.ensureRosters()[id], bench = this.bench(id), bi = bench.indexOf(p);
    if (!slot || bi < 0) return;
    const [side, i] = slot.split(':'), cur = R[side][+i];
    if (cur && posGroup(cur[0]) === posGroup(p[0]) && p[3] >= cur[3]) { bench[bi] = cur; R[side][+i] = p; }
  },
  // once a week: guys heal, then the teams that just played can get hurt
  // career mode runs its own league: no franchise injuries there
  isCareer() { return this.slot === 'career' || !!G.career; },
  injuryWeek(teams, wk) {
    this._newInj = []; if (this.isCareer()) return;
    const R = this.ensureRosters(), d = this.data;
    const back = new Set();
    for (const id in R) for (const p of this.injList(id)) if (--p[6].inj <= 0) { back.add(p); this.healed(id, p, wk); }
    for (const id of teams) {
      if (!R[id]) continue;
      for (const side of ['off', 'def']) for (const p of R[id][side].slice()) if (p && !back.has(p) && !(p[6] && p[6].cap) && chance(INJ_RATE * Sliders.mul('inj'))) this.injure(id, p, injWeeks(), null, wk);
    }
    // a QB who got hurt in the game you played misses real time too
    if (G.season && G.phase === 'over' && G.teams && G.qbHurt) G.qbHurt.forEach((nm, s) => {
      const id = G.teams[s] && G.teams[s].id, r = nm && R[id]; if (!r) return;
      const p = r.off.concat(r.bench || []).find(x => x && x[1] === nm);
      if (p && !this.hurt(p)) this.injure(id, p, 1 + Math.floor(rand(0, 3)), pick(['shoulder', 'ankle', 'ribs', 'concussion']), wk);
    });
    for (const id in R) this.patchHoles(id, wk);
  },
  // no empty or hurt starters, ever
  patchHoles(id, wk) {
    const R = this.ensureRosters()[id];
    for (const side of ['off', 'def']) R[side].forEach((p, i) => { if (!p || this.hurt(p)) this.fillSlot(id, side, i, wk); });
  },
  healAll() {
    const R = this.ensureRosters();
    for (const id in R) for (const p of this.injList(id)) { const m = p[6]; delete m.inj; delete m.injWhat; delete m.injSlot; delete m.injSub; }
  }
});
// setLineup (trades.js) skips hurt guys; if nobody healthy is left, sign someone
{ const _setLineup = Season.setLineup; Season.setLineup = function (id) { _setLineup.call(this, id); this.patchHoles(id); }; }
// the backup QB in a game you play is the real one off your bench
{ const _team = Season.team; Season.team = function (id) {
  const t = _team.call(this, id), r = this.data && this.data.rosters && this.data.rosters[id];
  if (!r || !r.bench) return t;
  const qb = r.bench.filter(p => p && p[0] === 'QB' && !this.hurt(p)).sort((a, b) => b[3] - a[3])[0];
  return qb ? { ...t, qb2: qb.slice(0, 6) } : t; // keeps his skin tone
}; }
{ const _fw = Season.finishWeek; Season.finishWeek = function (s) {
  const wk = this.data.week; _fw.call(this, s);
  this.injuryWeek(TEAMS.map(t => t.id), wk); this.save();
}; }
{ const _fp = Season.finishPlayoffRound; Season.finishPlayoffRound = function (s) {
  const b = this.data.bracket, ids = b ? b.games.flatMap(g => [g.home, g.away]) : [], wk = this.data.games + (b ? b.round : 0);
  _fp.call(this, s);
  if (this.data.phase !== 'done') this.injuryWeek(ids, wk);
  this.save();
}; }
// everybody heals over the offseason (traded future picks live in the pick table: trades.js)
{ const _ny = Season.nextYear; Season.nextYear = function () {
  this.healAll();
  const ch = _ny.call(this);
  this.save();
  return ch;
}; }

// ================= game recap =================
const potgScore = p => p.pass / 20 + p.rush / 8 + p.rec / 8 + p.td * 6 + p.tkl * 1.5 + p.sack * 4 + p.int * 6;
const statBits = p => { const b = [];
  if (p.pass) b.push(`${p.pass} pass yds`); if (p.rush) b.push(`${p.rush} rush yds`); if (p.rec) b.push(`${p.rec} rec yds`); if (p.td) b.push(`${p.td} TD`);
  if (p.tkl) b.push(`${p.tkl} tkl`); if (p.sack) b.push(`${p.sack} sack${p.sack === 1 ? '' : 's'}`); if (p.int) b.push(`${p.int} INT`);
  return b.join('  ·  ') || 'Did a bit of everything'; };

// stamp the score on every play-by-play line so we can find lead changes later
{ const _add = addPbp; addPbp = function (text, extra) {
  _add(text, extra);
  const l = G.pbp && G.pbp[G.pbp.length - 1];
  if (l && l.sc == null && G.score) { l.sc = G.score.slice(); l.off = G.poss; }
}; }

const Recap = {
  pre: null, // season stats before a sim (to find who did what)
  headline(w, l, ws, ls, ot, down) {
    const W = tName(w), L = tName(l);
    if (ws === ls) return `${W} and ${L} play to a ${ws}-${ls} tie`;
    if (ot) return `${W} beat the ${L} in overtime, ${ws}-${ls}`;
    if (down >= 10) return `${W} come back from ${down} down to beat the ${L}, ${ws}-${ls}`;
    if (ws - ls >= 17) return `${W} roll past the ${L}, ${ws}-${ls}`;
    if (ws - ls <= 3) return `${W} hold off the ${L}, ${ws}-${ls}`;
    return `${W} beat the ${L}, ${ws}-${ls}`;
  },
  // the big moments of the game you played, from the play-by-play
  keyPlays(teams, final) {
    const L = (G.pbp || []).filter(l => l && l.text), n = L.length, out = [];
    const after = i => (i + 1 < n && L[i + 1].sc) || final;
    const ws = final[0] > final[1] ? 0 : final[1] > final[0] ? 1 : -1;
    // the go-ahead score the winner never gave back
    let gw = -1, gwDrive = 0;
    if (ws >= 0) for (let i = 0; i < n; i++) {
      if (!L[i].sc) continue;
      const a = after(i), was = L[i].sc[ws] - L[i].sc[1 - ws], now = a[ws] - a[1 - ws];
      if (was <= 0 && now > 0) gw = i;
    }
    if (gw > 0 && /extra point|Two-point/i.test(L[gw].text)) gw--;
    if (gw >= 0) { for (let i = gw; i >= 0 && L[i].off === ws; i--) if (/pass|runs|carries|rushes|scrambles|keeps it|takes off|sacked|incomplete|drops it/i.test(L[i].text)) gwDrive++; }
    for (let i = 0; i < n; i++) {
      const l = L[i], t = l.text, a = after(i), sc = l.sc;
      const scorer = sc ? (a[0] > sc[0] ? 0 : a[1] > sc[1] ? 1 : -1) : -1;
      const gain = +((t.match(/(?:for|returns the \w+) (\d+) yards/) || [])[1] || 0);
      let tag = '', pri = 0, side = l.off != null ? l.off : -1;
      if (i === gw && /Q4|OT/.test(l.q)) { tag = 'GAME WINNER'; pri = 5; side = ws; }
      else if (/TOUCHDOWN|to the house/i.test(t)) { tag = 'TD'; pri = 4; if (scorer >= 0) side = scorer; }
      else if (/INTERCEPTED|FUMBLE, recovered/.test(t)) { tag = 'TURNOVER'; pri = 3; if (side >= 0) side = 1 - side; }
      else if (/field goal is GOOD/.test(t) && /Q4|OT/.test(l.q) && Math.abs(a[0] - a[1]) <= 8) { tag = 'FG'; pri = 2; if (scorer >= 0) side = scorer; }
      else if (gain >= 25) { tag = 'BIG PLAY'; pri = 1; }
      if (!tag) continue;
      let text = t; if (tag === 'GAME WINNER' && gwDrive >= 2) text += `  (${gwDrive}-play drive)`;
      out.push({ i, q: l.q, clock: l.clock, text, tag, team: teams[side] ? teams[side].id : null, pri, sc: a.slice() });
    }
    const keep = out.slice().sort((a, b) => b.pri - a.pri || a.i - b.i).slice(0, 5);
    return out.filter(x => keep.includes(x)).map(({ i, pri, ...x }) => x);
  },
  // biggest deficit the winner came back from
  comeback(ws) {
    let worst = 0; for (const l of G.pbp || []) if (l.sc) worst = Math.max(worst, l.sc[1 - ws] - l.sc[ws]);
    return worst;
  },
  league(info) {
    const d = Season.data;
    if (info.phase === 'regular') return d.weeks[info.wk].slice(1).map(g => ({ home: g.home, away: g.away, score: g.score }));
    const r = (d.log || []).find(x => x.round === info.round);
    return r ? r.games.filter(g => g.home !== d.team && g.away !== d.team).map(g => ({ home: g.home, away: g.away, score: g.score })) : [];
  },
  build(info, score, played) {
    const d = Season.data, me = d.team, home = info.home === me, opp = home ? info.away : info.home;
    const my = home ? score[0] : score[1], th = home ? score[1] : score[0];
    const r = { label: info.label, played, me, opp, my, th, league: this.league(info),
      inj: (Season._newInj || []).filter(x => x.team === me || x.team === opp) };
    if (played && G.teams) {
      const ms = G.teams[0].id === me ? 0 : 1, ws = G.score[0] > G.score[1] ? 0 : G.score[1] > G.score[0] ? 1 : ms;
      r.plays = this.keyPlays(G.teams, G.score.slice());
      r.ot = (G.pbp || []).some(l => l.q === 'OT');
      r.down = G.score[0] !== G.score[1] ? this.comeback(ws) : 0;
      const best = Object.values(G.pstats || {}).filter(p => p.side === ws).sort((a, b) => potgScore(b) - potgScore(a))[0];
      if (best) r.potg = { name: best.name, pos: best.pos, team: G.teams[ws].id, line: statBits(best) };
      const T = G.tstats || [], g = (s, k) => (T[s] && T[s][k]) || 0;
      const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
      r.stats = [['TOTAL YARDS', s => g(s, 'pass') + g(s, 'rush')], ['PASSING', s => g(s, 'pass')], ['RUSHING', s => g(s, 'rush')], ['FIRST DOWNS', s => g(s, 'fd')],
        ['3RD DOWN', s => `${g(s, 'c3')}/${g(s, 'a3')}`, s => g(s, 'a3') ? g(s, 'c3') / g(s, 'a3') : 0], ['TURNOVERS', s => g(s, 'to')], ['POSSESSION', s => mmss(g(s, 'top')), s => g(s, 'top')]]
        .map(([lbl, f, v]) => [lbl, f(ms), f(1 - ms), v ? v(ms) : f(ms), v ? v(1 - ms) : f(1 - ms)]);
    } else {
      // simmed: who stood out, from the season stat lines
      const pre = this.pre || {}, lines = Object.entries(d.stats || {}).filter(([, l]) => l.t === me || l.t === opp).map(([k, l]) => {
        const b = pre[k] || {}, x = { name: l.name, pos: l.pos, t: l.t };
        for (const s of ['pass', 'rush', 'rec', 'td', 'tkl', 'sack', 'int']) x[s] = (l[s] || 0) - (b[s] || 0);
        return x; }).sort((a, b) => potgScore(b) - potgScore(a));
      const wt = my >= th ? me : opp, best = lines.find(l => l.t === wt), top = id => lines.filter(l => l.t === id).slice(0, 2);
      if (best) r.potg = { name: best.name, pos: best.pos, team: wt, line: statBits(best) };
      r.tops = [me, opp].map(id => ({ id, list: top(id).map(l => ({ name: l.name, pos: l.pos, line: statBits(l) })) }));
    }
    this.pre = null;
    return r;
  },
  snap() { this.pre = JSON.parse(JSON.stringify((Season.data && Season.data.stats) || {})); }
};

{ const _done = seasonGameDone; seasonGameDone = function (score) {
  const d = Season.data, g = d && Season.myGame();
  if (!g) return _done(score);
  const info = { home: g.home, away: g.away, phase: d.phase, wk: d.week, round: d.bracket && d.bracket.round,
    label: d.phase === 'playoffs' ? Season.roundName(d.bracket.round) : `Week ${d.week + 1}` };
  const played = !!(G.season && G.phase === 'over' && G.teams);
  _done(score);
  try { Season.data.lastRecap = Recap.build(info, score, played); } catch (e) { Season.data.lastRecap = null; }
  Season.save();
}; }
{ const _sim = $('shSim').onclick; $('shSim').onclick = () => { Recap.snap(); _sim(); }; }
// after a game you played: CONTINUE SEASON goes to the recap first
{ const _cont = $('btnSeasonCont').onclick; $('btnSeasonCont').onclick = () => {
  const r = !G.career && G.season && Season.data && Season.data.lastRecap;
  if (!r || !r.played) return _cont();
  G.season = false; G.teams = null; G.phase = 'idle'; openRecap();
}; }

function openRecap() {
  const d = Season.data, r = d && d.lastRecap; if (!r) return renderHub();
  const A = Season.team(r.me), B = Season.team(r.opp), res = r.my > r.th ? 'W' : r.my < r.th ? 'L' : 'T';
  const wt = r.my >= r.th ? r.me : r.opp, lt = wt === r.me ? r.opp : r.me;
  const tag = t => `<span class="rcTeam" style="color:${textOn(t.c1)}">${t.name.toUpperCase()}</span>`;
  const plays = (r.plays || []).map(p => `<div class="rcPlay"><span class="rcTag${p.tag === 'GAME WINNER' ? ' gw' : ''}">${p.tag}</span><div><i>${p.q} ${p.clock}${p.team ? `  ·  ${tName(p.team)}` : ''}</i>${p.text.replace(/\.\./g, '.')}</div></div>`).join('');
  const potg = r.potg ? `<div class="rcPotg"><b>${r.potg.name}</b> <i>${r.potg.pos}, ${tName(r.potg.team)}</i><div>${r.potg.line}</div></div>` : '';
  const stats = (r.stats || []).map(([lbl, a, b, va, vb]) => { const tot = (+va || 0) + (+vb || 0), pa = tot ? Math.round(100 * va / tot) : 50;
    return `<div class="rcSt"><b>${a}</b><span>${lbl}</span><b>${b}</b></div><div class="rcBar"><i style="width:${pa}%"></i></div>`; }).join('');
  const tops = (r.tops || []).map(t => `<div class="rcTop"><div class="leadHead">${tName(t.id).toUpperCase()}</div>${t.list.map(l => `<div class="leadRow"><span>${l.pos} ${l.name}</span><i>${l.line}</i></div>`).join('') || '<div class="note">No stats</div>'}</div>`).join('');
  const inj = (r.inj || []).map(x => `<div class="leadRow"><span>${x.pos} ${x.name} <i>${tName(x.team)}</i></span><i class="rcOut">${x.what.toUpperCase()}  ·  OUT ${wkStr(x.wks)}</i></div>`).join('');
  const lg = (r.league || []).filter(g => g.score).map(g => { const aw = g.score[1] > g.score[0], hw = g.score[0] > g.score[1];
    return `<div class="rcLg"><span class="${aw ? 'w' : ''}">${dotFor(g.away)}${g.away} ${g.score[1]}</span><span class="${hw ? 'w' : ''}">${dotFor(g.home)}${g.home} ${g.score[0]}</span></div>`; }).join('');
  $('rcBody').innerHTML = `<div class="rcHead">${r.label.toUpperCase()}  ·  FINAL${r.played ? '' : '  ·  SIMULATED'}</div>
    <div class="rcScore" style="background:linear-gradient(110deg, ${A.c1} 0%, ${A.c1} 46%, ${B.c1} 54%, ${B.c1} 100%)">${tag(A)}<b style="color:${textOn(A.c1)}">${r.my}</b><span class="rcRes ${res}">${res}</span><b style="color:${textOn(B.c1)}">${r.th}</b>${tag(B)}</div>
    <div class="rcLine">${Recap.headline(wt, lt, Math.max(r.my, r.th), Math.min(r.my, r.th), r.ot, r.down || 0)}</div>
    <div class="rcGrid">
      <div class="rcCol">${r.played ? `<div class="leadHead">KEY PLAYS</div>${plays || '<div class="note">A quiet one. No big plays.</div>'}` : tops}
        ${potg ? `<div class="leadHead rcGap">PLAYER OF THE GAME</div>${potg}` : ''}</div>
      ${r.played || inj ? `<div class="rcCol">${r.played ? `<div class="leadHead">TEAM STATS  ·  ${A.name.toUpperCase()} / ${B.name.toUpperCase()}</div>${stats}` : ''}
        ${inj ? `<div class="leadHead${r.played ? ' rcGap' : ''}">INJURIES</div>${inj}` : ''}</div>` : ''}
      <div class="rcCol"><div class="leadHead">AROUND THE LEAGUE</div><div class="rcLgGrid">${lg || '<div class="note">No other games</div>'}</div></div>
    </div>`;
  show('recap');
}
$('rcGo').onclick = () => { Sound.click(); renderHub(); };

// ================= hub: last game, injuries tab, depth chart button =================
{ const _hub = renderHub; renderHub = function () {
  _hub();
  const d = Season.data, r = d && d.lastRecap; let box = $('shLast');
  if (!box) { box = document.createElement('div'); box.id = 'shLast'; $('shLeft').insertBefore(box, $('shSched')); }
  if (!r) { box.style.display = 'none'; return; }
  const res = r.my > r.th ? 'W' : r.my < r.th ? 'L' : 'T';
  box.style.display = '';
  box.innerHTML = `<span class="lbl">LAST GAME</span><span class="${res}">${res} ${r.my}-${r.th}</span><span class="lsTxt">vs ${tName(r.opp)}${r.potg ? `  ·  ${r.potg.pos} ${lastName(r.potg.name)}: ${r.potg.line.split('  ·  ').slice(0, 2).join(', ')}` : ''}</span><button id="shRecap">RECAP</button>`;
  $('shRecap').onclick = () => { Sound.click(); openRecap(); };
}; }
{ const _tab = renderHubTab; renderHubTab = function () {
  if (hubTab !== 'inj') return _tab();
  document.querySelectorAll('#shTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === hubTab));
  const d = Season.data, R = Season.ensureRosters();
  const mine = Season.injList(d.team), row = (id, p) => { const m = p[6];
    return `<div class="leadRow"><span>${p[0]} ${p[1]}${id !== d.team ? ` <i>${tName(id)}</i>` : m.injSub ? ` <i>${lastName(m.injSub)} starting</i>` : ''}</span><i><span class="rcOut">${(m.injWhat || 'hurt').toUpperCase()}  ·  OUT ${wkStr(m.inj)}</span>  ·  <b>${p[3]}</b></i></div>`; };
  const lg = []; for (const id in R) if (id !== d.team) for (const p of Season.injList(id)) lg.push([id, p]);
  lg.sort((a, b) => b[1][3] - a[1][3]);
  $('shStand').innerHTML = `<div class="leadHead">YOUR TEAM</div>${mine.map(p => row(d.team, p)).join('') || '<div class="note">Nobody is hurt. Your whole team is healthy.</div>'}
    <div class="leadHead" style="margin-top:8px">AROUND THE LEAGUE</div>${lg.map(([id, p]) => row(id, p)).join('') || '<div class="note">No injuries around the league yet.</div>'}
    <div class="note">Hurt players sit out and the best healthy backup starts. Change who starts in DEPTH CHART.</div>`;
}; }

// ================= depth chart =================
const DC_GROUPS = { off: [['QB', 'QB'], ['RB', 'RB'], ['WR', 'WR / TE'], ['OL', 'OL']], def: [['DL', 'DL'], ['LB', 'LB'], ['CB', 'CB'], ['S', 'S']] };
let dcSel = null, dcMsg = '';
function dcGet(k) { const R = Season.ensureRosters()[Season.data.team], [a, b, c] = k.split(':'); return a === 's' ? R[b][+c] : Season.bench(Season.data.team)[+b]; }
function dcSet(k, p) { const R = Season.ensureRosters()[Season.data.team], [a, b, c] = k.split(':'); if (a === 's') R[b][+c] = p; else Season.bench(Season.data.team)[+b] = p; }
function renderDepth() {
  const d = Season.data, me = d.team, R = Season.ensureRosters()[me], bench = Season.bench(me), base = TEAMS.find(t => t.id === me);
  const grpOf = k => posGroup(k[0] === 's' ? base[k.split(':')[1]][+k.split(':')[2]][0] : dcGet(k)[0]);
  const xf = new Set(teamXFactors(Season.team(me)).map(x => x.name));
  const row = (k, p, slotPos) => {
    const on = dcSel === k, can = dcSel && dcSel !== k && grpOf(dcSel) === grpOf(k) && !(dcSel[0] === 'b' && k[0] === 'b'), m = p[6] || {};
    const tag = Season.hurt(p) ? `<em class="out">OUT ${wkStr(m.inj)}</em>` : k[0] === 's' ? '<em class="st">STARTER</em>' : '';
    return `<div class="dcRow ${k[0] === 's' ? 'st' : 'bk'}${on ? ' on' : ''}${can ? ' can' : ''}" tabindex="0" data-k="${k}"><span class="pos">${slotPos}</span><b>${p[3]}</b><span class="nm">${p[1]}${xf.has(p[1]) ? ' <small class="rsXf">X-FACTOR</small>' : ''}<i>${p[0]}  ·  AGE ${m.age || '?'}  ·  SPD ${p[4]}</i></span>${tag}</div>`;
  };
  const col = side => DC_GROUPS[side].map(([g, lbl]) => {
    const st = R[side].map((p, i) => [p, i]).filter(([, i]) => posGroup(base[side][i][0]) === g);
    const bk = bench.map((p, j) => [p, j]).filter(([p]) => p && posGroup(p[0]) === g).sort((a, b) => b[0][3] - a[0][3]);
    return `<div class="dcGrp">${lbl}</div>` + st.map(([p, i]) => row(`s:${side}:${i}`, p, base[side][i][0])).join('') + bk.map(([p, j]) => row(`b:${j}`, p, '')).join('');
  }).join('');
  $('dcBody').innerHTML = `<div class="dHead">${Season.team(me).city.toUpperCase()} ${Season.team(me).name.toUpperCase()}  ·  ${teamOvr(Season.team(me))} OVR</div>
    <div class="dcWrap"><div class="dcCol"><div class="leadHead">OFFENSE</div>${col('off')}</div><div class="dcCol"><div class="leadHead">DEFENSE</div>${col('def')}</div></div>
    <div id="dcMsg">${dcMsg || 'Tap a starter, then tap a backup at the same spot to swap them. Receivers and tight ends can cover for each other.'}</div>`;
  document.querySelectorAll('.dcRow').forEach(r => r.onclick = () => {
    const k = r.dataset.k; dcMsg = '';
    if (!dcSel || dcSel === k) dcSel = dcSel === k ? null : k;
    else if (grpOf(dcSel) !== grpOf(k) || (dcSel[0] === 'b' && k[0] === 'b')) dcSel = k;
    else {
      const a = dcGet(dcSel), b = dcGet(k), sk = dcSel[0] === 's' ? dcSel : k, inn = sk === dcSel ? b : a;
      if (Season.hurt(inn) && !(dcSel[0] === 's' && k[0] === 's')) dcMsg = `${inn[1]} is hurt. He can't start until he's healthy.`;
      else { dcSet(dcSel, b); dcSet(k, a); if (inn[6]) delete inn[6].injSlot; Season.save(); dcMsg = dcSel[0] === 's' && k[0] === 's' ? `${lastName(a[1])} and ${lastName(b[1])} switched spots.` : `${inn[1]} is in the lineup.`; }
      dcSel = null;
    }
    Sound.click(); renderDepth();
  });
}
function openDepth() { Season.ensureRosters(); Season.bench(Season.data.team); dcSel = null; dcMsg = ''; renderDepth(); show('depth'); }
$('shDepth').onclick = () => { Sound.click(); openDepth(); };
$('dcAuto').onclick = () => { Season.setLineup(Season.data.team); Season.save(); dcSel = null; dcMsg = 'Your best healthy players are starting.'; Sound.click(); renderDepth(); };
$('dcBack').onclick = () => { Sound.click(); renderHub(); };

// ================= scouting combine =================
// every prospect has a true rating the scouts can only guess at. The board shows a range until you scout him.
const SCOUT_PTS = 10, POTS = ['C', 'B', 'A'];
const BENCH_BASE = { OL: 27, DL: 25, TE: 19, LB: 21, RB: 17, S: 14, CB: 12, WR: 12 };
const Scout = {
  // combine numbers come from his speed and strength
  measure(pr) {
    const s = pr.t[4], o = pr.proj != null ? pr.proj : pr.t[3], pos = pr.t[0];
    pr.cmb = { forty: +clamp(4.24 + (97 - s) * 0.027 + rand(-0.05, 0.05), 4.22, 5.6).toFixed(2),
      bench: pos === 'QB' ? null : Math.max(6, Math.round((BENCH_BASE[pos] || 18) + (o - 74) * 0.25 + rand(-4, 4))),
      vert: Math.round(2 * clamp(28 + (s - 75) * 0.45 + rand(-2, 2), 22, 44)) / 2,
      cone: +clamp(7.9 - (s - 60) * 0.03 + rand(-0.12, 0.12), 6.5, 8.2).toFixed(2) };
  },
  // the hidden part: some guys are better than the scouts think, some worse
  hide(pr) {
    const proj = pr.t[3], dv = Math.round(clamp((rand(-1, 1) + rand(-1, 1) + rand(-1, 1)) * 2.6, -6, 6));
    pr.proj = proj; pr.ppot = pr.pot;
    pr.t[3] = clamp(proj + dv, 42, 92);
    const pi = POTS.indexOf(pr.pot);
    if (dv >= 2 && chance(0.4) && pi < 2) pr.pot = POTS[pi + 1]; else if (dv <= -2 && chance(0.4) && pi > 0) pr.pot = POTS[pi - 1];
    pr.t[6] = Object.assign({}, pr.t[6] || {}, { pot: pr.pot });
    pr.est = Math.round(proj + rand(-1, 1));
    pr.cpu = Math.round((proj + pr.t[3]) / 2 + rand(-1.5, 1.5));
  }
};
const known = pr => pr.proj == null || pr.scouted;
function scoutOvr(pr) { return known(pr) ? `${pr.t[3]}` : `<small>${pr.est - 3}-${pr.est + 3}</small>`; }
function scoutPot(pr) { return known(pr) ? pr.pot : pr.ppot + '?'; }
function seenT(pr) { const t = Object.assign(pr.t.slice(), { pot: known(pr) ? pr.pot : pr.ppot }); if (!known(pr)) t[3] = pr.est; return t; }
{ const _sd = Season.startDraft; Season.startDraft = function () {
  _sd.call(this);
  const dr = this.data.draft; dr.sp = SCOUT_PTS; dr.offers = {};
  for (const pr of dr.pool) { Scout.hide(pr); Scout.measure(pr); }
  dr.pool.sort((a, b) => b.est - a.est);
  this.save();
}; }

let cbPos = 'ALL', cbSort = 'board';
function openCombine() {
  const dr = Season.data.draft;
  if (dr.sp == null) dr.sp = SCOUT_PTS;
  for (const pr of dr.pool) if (!pr.cmb) Scout.measure(pr);
  renderCombine(); show('combine');
}
function renderCombine() {
  const d = Season.data, dr = d.draft;
  const fast = dr.pool.map(pr => pr.cmb.forty).sort((a, b) => a - b)[2];
  const by = { board: () => 0, forty: (a, b) => a.cmb.forty - b.cmb.forty, bench: (a, b) => (b.cmb.bench || 0) - (a.cmb.bench || 0), vert: (a, b) => b.cmb.vert - a.cmb.vert, cone: (a, b) => a.cmb.cone - b.cmb.cone };
  const list = dr.pool.map((pr, k) => [pr, k]).filter(([pr]) => cbPos === 'ALL' || pr.t[0] === cbPos).sort((a, b) => by[cbSort](a[0], b[0]));
  const th = (k, lbl) => `<th data-s="${k}" class="${cbSort === k ? 'on' : ''}">${lbl}</th>`;
  const grade = pr => { if (!known(pr)) return `<td class="cbG">${pr.est - 3}-${pr.est + 3}</td><td>${pr.ppot}?</td>`;
    const cls = pr.proj == null ? '' : pr.t[3] >= pr.est + 3 ? 'up' : pr.t[3] <= pr.est - 3 ? 'down' : '';
    return `<td class="cbG ${cls}"><b>${pr.t[3]}</b></td><td class="${pr.pot !== pr.ppot && pr.ppot ? (POTS.indexOf(pr.pot) > POTS.indexOf(pr.ppot) ? 'up' : 'down') : ''}">${pr.pot}</td>`; };
  $('cbBody').innerHTML = `<div class="dHead">${dr.year} SCOUTING COMBINE  ·  SCOUT POINTS LEFT: ${dr.sp} OF ${SCOUT_PTS}</div>
    <div class="tlTabs dFilt cbFilt">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'].map(f => `<button data-f="${f}" class="${cbPos === f ? 'on' : ''}">${f}</button>`).join('')}</div>
    <div class="cbList"><table class="cbTab"><tr>${th('board', 'POS')}<th class="cbNm">PLAYER</th>${th('forty', '40 YD')}${th('bench', 'BENCH')}${th('vert', 'VERT')}${th('cone', '3-CONE')}<th>GRADE</th><th>POT</th><th></th></tr>
    ${list.map(([pr, k]) => `<tr><td class="pos">${pr.t[0]}</td><td class="cbNm">${pr.t[1]}<i>${pr.school}</i></td><td class="${pr.cmb.forty <= fast ? 'up' : ''}">${pr.cmb.forty.toFixed(2)}</td><td>${pr.cmb.bench == null ? '-' : pr.cmb.bench}</td><td>${pr.cmb.vert}"</td><td>${pr.cmb.cone.toFixed(2)}</td>${grade(pr)}
      <td>${known(pr) ? '<em>SCOUTED</em>' : `<button class="cbScout" data-k="${k}"${dr.sp ? '' : ' disabled'}>SCOUT</button>`}</td></tr>`).join('')}</table></div>
    <div class="note cbNote">Grades are the scouts' best guess. Some players will be better and some worse. Scouting a player (1 point) shows his real rating and potential. Tap a column to sort.</div>`;
  document.querySelectorAll('.cbFilt button').forEach(b => b.onclick = () => { cbPos = b.dataset.f; Sound.click(); renderCombine(); });
  document.querySelectorAll('.cbTab th[data-s]').forEach(h => h.onclick = () => { cbSort = h.dataset.s; Sound.click(); renderCombine(); });
  document.querySelectorAll('.cbScout').forEach(b => b.onclick = () => { if (!dr.sp) return; const pr = dr.pool[+b.dataset.k]; pr.scouted = 1; dr.sp--; Season.save(); Sound.td(); renderCombine(); });
  $('cbGo').textContent = dr.combineDone ? 'BACK TO THE DRAFT' : 'TO THE DRAFT';
}
$('cbGo').onclick = () => { Season.data.draft.combineDone = 1; Season.save(); Sound.whistle(); renderDraft(); show('draft'); };

// ================= draft-day trades =================
const DraftDay = {
  // what a pick is worth: same scale as trades.js, the top 10 cost extra on draft day
  slotVal(n) { return Season.pickCurve(n) * (1 + Math.max(0, 10 - n) * 0.04); },
  // a team's picks in next year's draft (1st and 2nd round) it could throw in
  futures(id) { const y = Season.data.draft.year + 1; return Season.picksOf(id).filter(pk => pk.y === y && pk.r <= 2); },
  fut(pk, forId) { return { kind: 'fut', pk, v: Season.pickValue(pk, forId) * 0.95, txt: Season.pickName(pk) }; },
  slot(j) { return { kind: 'slot', j, v: this.slotVal(j + 1), txt: `${draftSlot(Season.data.draft, j)} (#${j + 1})` }; },
  pLabel(p) { return `${p[0]} ${lastName(p[1])} (${p[3]})`; },
  // the cheapest package of yours a team would take for pick k
  upDeal(k) {
    const d = Season.data, dr = d.draft, me = d.team, other = dr.order[k], need = this.slotVal(k + 1), A = [];
    dr.order.forEach((o, j) => { if (o === me && j > k && A.length < 8) A.push(this.slot(j)); });
    this.futures(me).forEach(pk => A.push(this.fut(pk, other)));
    Season.assets(me).filter(a => a.p && !Season.rosterProblem(me, other, [a.key], []))
      .map(a => ({ kind: 'p', key: a.key, name: a.p[1], starter: a.starter, v: Season.worth(other, a, true) * (Season.hurt(a.p) ? 0.6 : 1), txt: this.pLabel(a.p) }))
      .sort((a, b) => b.v - a.v).slice(0, 10).forEach(x => A.push(x));
    let best = null;
    const tryC = c => {
      const v = c.reduce((s, a) => s + a.v, 0); if (v < need) return;
      const cost = v - need + c.length * 10 + c.filter(a => a.kind === 'p').length * 25 + c.filter(a => a.starter).length * 30;
      if (best && cost >= best.cost) return;
      const keys = c.filter(a => a.kind === 'p').map(a => a.key);
      if (keys.length > 1 && Season.rosterProblem(me, other, keys, [])) return;
      best = { list: c, v, cost };
    };
    for (let a = 0; a < A.length; a++) { tryC([A[a]]); for (let b = a + 1; b < A.length; b++) { tryC([A[a], A[b]]); for (let c = b + 1; c < A.length; c++) tryC([A[a], A[b], A[c]]); } }
    return best && { k, team: other, list: best.list };
  },
  // CPU teams a few spots back offer to move up to your pick
  downOffers() {
    const d = Season.data, dr = d.draft, me = d.team, k = dr.i, give = this.slotVal(k + 1);
    dr.offers = dr.offers || {};
    if (dr.offers[k]) return dr.offers[k];
    const list = [], cands = shuffle(dr.order.map((o, j) => [o, j]).filter(([o, j]) => j > k && j <= k + 12 && o !== me));
    for (const [T, j] of cands) {
      if (list.length >= 2) break;
      if (list.some(o => o.team === T) || !chance(0.75)) continue;
      const owe = give - this.slotVal(j + 1), ex = [];
      this.futures(T).forEach(pk => ex.push(this.fut(pk, me)));
      dr.order.forEach((o, j2) => { if (o === T && j2 > j) ex.push(this.slot(j2)); });
      Season.assets(T).filter(a => a.p && !Season.hurt(a.p) && !Season.rosterProblem(me, T, [], [a.key]))
        .forEach(a => ex.push({ kind: 'p', name: a.p[1], v: Season.worth(me, a, true), txt: this.pLabel(a.p) }));
      let best = null; for (const e of ex) if (e.v >= owe * 0.9 && e.v <= owe * 2.2 + 40 && (!best || e.v < best.v)) best = e;
      if (best) list.push({ team: T, j, extra: best });
    }
    dr.offers[k] = list; Season.save();
    return list;
  },
  // move players between teams (best players start, holes get filled)
  movePlayer(from, to, name) {
    const R = Season.ensureRosters()[from];
    for (const g of ['off', 'def', 'bench']) { const arr = g === 'bench' ? Season.bench(from) : R[g], i = arr.findIndex(p => p && p[1] === name);
      if (i < 0) continue;
      const p = arr[i]; if (g === 'bench') arr.splice(i, 1); else arr[i] = null;
      if (p[6]) delete p[6].injSlot;
      Season.bench(to).push(p); Season.setLineup(from); Season.setLineup(to);
      return p;
    }
    return null;
  },
  // this year's slots change hands in the order (and the pick table), future picks in the pick table
  setSlot(j, to) { const dr = Season.data.draft; dr.order[j] = to; if (dr.via && dr.rd) Season.movePick({ y: dr.year, from: dr.via[j], r: dr.rd[j] }, to); },
  send(list, from, to) {
    for (const a of list) {
      if (a.kind === 'slot') this.setSlot(a.j, to);
      else if (a.kind === 'fut') Season.movePick(a.pk, to);
      else this.movePlayer(from, to, a.name);
    }
  },
  log(other, got, gave, text) {
    const d = Season.data;
    (d.trades || (d.trades = [])).push({ week: d.week, got, gave, with: other });
    Season.news(text);
  },
  tradeUp(k) {
    const d = Season.data, dr = d.draft, me = d.team, deal = this.upDeal(k); if (!deal) return;
    this.send(deal.list, me, deal.team); this.setSlot(k, me); delete dr.offers[k];
    const gave = deal.list.map(a => a.txt).join(', ');
    this.log(deal.team, `Pick #${k + 1}`, gave, `DRAFT TRADE: the ${tName(me)} move up to #${k + 1}, sending ${gave} to the ${tName(deal.team)}`);
    Season.save();
  },
  tradeDown(n) {
    const d = Season.data, dr = d.draft, me = d.team, k = dr.i, o = (dr.offers[k] || [])[n]; if (!o || dr.order[o.j] !== o.team) return;
    this.setSlot(k, o.team); this.setSlot(o.j, me);
    this.send([o.extra], o.team, me); delete dr.offers[k];
    const got = `#${o.j + 1}, ${o.extra.txt}`;
    this.log(o.team, got, `Pick #${k + 1}`, `DRAFT TRADE: the ${tName(o.team)} move up to #${k + 1}. The ${tName(me)} get ${got}`);
    Season.save();
  }
};

// the trade desk on the right side of the draft screen
function draftDesk(myTurn, over) {
  if (over) return '';
  const d = Season.data, dr = d.draft, me = d.team;
  let h = `<div class="dkBtns">${myTurn ? '' : '<button id="dkNext">NEXT PICK</button>'}<button id="dkComb">COMBINE${dr.sp ? `  ·  ${dr.sp} PTS` : ''}</button>${dr.order.indexOf(me, dr.i) >= 0 ? '<button id="dkAuto">AUTO DRAFT REST</button>' : ''}</div>`;
  if (myTurn) {
    const offers = DraftDay.downOffers();
    h += `<div class="leadHead">TRADE DOWN</div>` + (offers.length ? offers.map((o, n) => `<div class="dkRow"><div><b>${tName(o.team)}</b> want #${dr.i + 1}<i>You get #${o.j + 1} + ${o.extra.txt}</i></div><button data-dn="${n}">ACCEPT</button></div>`).join('')
      : '<div class="note">Nobody is calling about this pick.</div>');
  } else {
    const mineAt = dr.order.indexOf(me, dr.i), ks = [];
    for (let k = dr.i; k < dr.order.length && ks.length < 3 && (mineAt < 0 || k < mineAt); k++) if (dr.order[k] !== me) ks.push(k);
    h += `<div class="leadHead">TRADE UP</div>` + (ks.map(k => { const u = DraftDay.upDeal(k);
      return `<div class="dkRow"><div><b>#${k + 1} ${tName(dr.order[k])}</b><i>${u ? `They want ${u.list.map(a => a.txt).join(' + ')}` : 'Nothing you have is enough'}</i></div>${u ? `<button data-up="${k}">TRADE</button>` : ''}</div>`; }).join('')
      || '<div class="note">No picks to trade up to.</div>');
  }
  return `<div class="dDesk">${h}</div>`;
}
function wireDraftDesk() {
  const nx = $('dkNext'); if (nx) nx.onclick = () => { Sound.click(); Season.draftOne(); renderDraft(); };
  const cb = $('dkComb'); if (cb) cb.onclick = () => { Sound.click(); renderCombine(); show('combine'); };
  // your picks get made for you (best player for your team), the CPU picks the rest
  const au = $('dkAuto'); if (au) au.onclick = () => { Sound.click(); const dr = Season.data.draft;
    while (dr.i < dr.order.length) { if (dr.order[dr.i] === Season.data.team) Season.draftPick(Season.data.team, Season.myAutoPick(), true); else Season.draftRun(); }
    Season.save(); renderDraft(); };
  // first tap asks, second tap makes the deal
  const sure = (b, go) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'SURE?'; Sound.click(); return; } Sound.td(); go(); renderDraft(); };
  document.querySelectorAll('.dkRow button[data-up]').forEach(b => sure(b, () => DraftDay.tradeUp(+b.dataset.up)));
  document.querySelectorAll('.dkRow button[data-dn]').forEach(b => sure(b, () => DraftDay.tradeDown(+b.dataset.dn)));
}
// just the next CPU pick (draftRun stops at the end of the order, so hand it a short one)
Season.draftOne = function () {
  const dr = this.data.draft; if (dr.i >= dr.order.length || dr.order[dr.i] === this.data.team) return;
  const real = dr.order; dr.order = real.slice(0, dr.i + 1);
  try { this.draftRun(); } finally { dr.order = real; }
  this.save();
};
