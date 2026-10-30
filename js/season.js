// ---- Season mode: schedule, sim games, standings, playoffs, stats, awards, franchise years, trades, save/load ----
const Season = {
  data: null, // saved season (null = none)
  KEY: 'bobbleSeason',

  load() { try { this.data = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { this.data = null; } return this.data; },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  clear() { this.data = null; try { localStorage.removeItem(this.KEY); } catch (e) {} },

  // carry = what a franchise brings into the next year (rosters, history, year)
  start(teamId, games, qtr, diff, carry) {
    const ids = TEAMS.map(t => t.id);
    const others = ids.filter(i => i !== teamId);
    // your opponents: no repeats until everyone has been played
    const opp = [];
    while (opp.length < games) opp.push(...shuffle(others.slice()));
    opp.length = games;
    // rivalry games are always on the schedule, and the last week of the year is Rivalry Week
    const byId = id => TEAMS.find(t => t.id === id), rivals = others.filter(o => isRivalry(byId(teamId), byId(o)));
    for (const r of rivals) if (!opp.includes(r)) { const i = opp.findIndex(o => !rivals.includes(o)); if (i >= 0) opp[i] = r; }
    const ri = opp.findIndex(o => rivals.includes(o));
    if (ri >= 0 && games > 1) { const [r] = opp.splice(ri, 1); opp.push(r); }
    const weeks = opp.map((o, w) => {
      const rest = shuffle(ids.filter(i => i !== teamId && i !== o));
      const games = [{ home: w % 2 === 0 ? teamId : o, away: w % 2 === 0 ? o : teamId }];
      for (let i = 0; i < rest.length; i += 2) games.push(chance(0.5) ? { home: rest[i], away: rest[i + 1] } : { home: rest[i + 1], away: rest[i] });
      return games;
    });
    const rec = {}; for (const i of ids) rec[i] = { w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    this.data = { team: teamId, games, qtr, diff, week: 0, weeks, rec, phase: 'regular', bracket: null, champ: null, log: [],
      stats: {}, awards: null, fullPO: true, year: carry ? carry.year : 1, history: carry ? carry.history : [], rosters: carry ? carry.rosters : null,
      weather: weeks.map((_, w) => ({ w: pickWeather('random', w, games), night: chance(0.3) })) };
    this.save();
  },

  team(id) {
    const base = TEAMS.find(t => t.id === id);
    const r = this.data && this.data.rosters && this.data.rosters[id];
    return r ? { ...base, off: r.off, def: r.def } : base;
  },
  ovr(id) { const t = this.team(id), all = t.off.concat(t.def); return all.reduce((a, p) => a + p[3], 0) / all.length; },
  myGame() {
    const d = this.data; if (!d) return null;
    if (d.phase === 'regular') return d.weeks[d.week] && d.weeks[d.week][0];
    if (d.phase === 'playoffs') return this.myPlayoffGame();
    return null;
  },

  // quick rating-based result for games you don't play
  simScore(homeId, awayId) {
    const edge = (this.ovr(homeId) - this.ovr(awayId) + 1.5) / 4;
    const homeWins = chance(1 / (1 + Math.exp(-edge)));
    const S = [3, 6, 7, 10, 13, 14, 16, 17, 20, 21, 23, 24, 27, 28, 30, 31, 34, 35, 38, 41, 42, 45];
    const w = S[4 + Math.floor(Math.random() * 14)];
    let l = Math.max(0, w - [1, 2, 3, 4, 6, 7, 7, 10, 11, 14, 17, 21][Math.floor(Math.random() * 12)]);
    const sc = homeWins ? [w, l] : [l, w];
    this.simStats(homeId, sc[0], sc[1]); this.simStats(awayId, sc[1], sc[0]);
    return sc;
  },
  addResult(home, away, hs, as) {
    const R = this.data.rec;
    R[home].pf += hs; R[home].pa += as; R[away].pf += as; R[away].pa += hs;
    if (hs > as) { R[home].w++; R[away].l++; } else if (as > hs) { R[away].w++; R[home].l++; } else { R[home].t++; R[away].t++; }
  },

  // ---- season stats ----
  line(teamId, p) {
    const S = this.data.stats || (this.data.stats = {}), k = teamId + ':' + p[1], m = p[6] || {};
    const l = S[k] || (S[k] = { t: teamId, name: p[1], pos: m.twin || p[0], g: 0, pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0 });
    const tw = m.twin ? p[0] : m.twAlso; if (tw && !l.tw) l.tw = tw; // two-way player: one line, both sides (twoway.js)
    return l;
  },
  // a believable box score for a game nobody played
  simStats(teamId, pts, oppPts) {
    if (!this.data) return;
    const t = TwoWay.expand(this.team(teamId)), [qb, rb, ...rest] = t.off, recs = rest.filter(p => p[0] !== 'OL');
    const tds = Math.round(pts / 7), pTD = Math.round(tds * rand(0.45, 0.75)), rTD = Math.max(0, tds - pTD);
    const passY = Math.max(60, Math.round(150 + pts * 4 + rand(-50, 60) + (qb[3] - 80) * 3));
    const rushY = Math.max(10, Math.round(55 + rand(-20, 70) + (rb[3] - 80) * 2));
    const seen = new Set(), L = p => { const l = this.line(teamId, p); if (!seen.has(l)) { l.g++; seen.add(l); } return l; }; // a two-way guy is one game played
    const lq = L(qb); lq.pass += passY; lq.td += pTD; lq.rush += Math.round(rand(-5, 25));
    const lr = L(rb); lr.rush += rushY; lr.td += rTD; lr.rec += Math.round(passY * rand(0.05, 0.15));
    const w = recs.map(p => Math.pow(p[3], 3) * rand(0.6, 1.4)), sw = w.reduce((a, b) => a + b, 0);
    recs.forEach((p, i) => { const l = L(p); l.rec += Math.round(passY * 0.85 * w[i] / sw); });
    for (let i = 0; i < pTD; i++) { let r = rand(0, sw), j = 0; while (r > w[j] && j < w.length - 1) { r -= w[j]; j++; } this.line(teamId, recs[j]).td++; }
    // defense
    const D = t.def, tk = D.map((p, i) => (i >= 3 && i <= 4 ? 2.2 : i === 7 ? 1.6 : 1) * rand(0.5, 1.5)), stk = tk.reduce((a, b) => a + b, 0);
    const sacks = Math.max(0, Math.round(rand(0, 3.5) + (D[0][3] + D[1][3] + D[2][3]) / 3 / 40 - 2));
    const ints = oppPts < 14 ? (chance(0.6) ? 1 + (chance(0.3) ? 1 : 0) : 0) : (chance(0.3) ? 1 : 0);
    D.forEach((p, i) => { const l = L(p); l.tkl += Math.round(24 * tk[i] / stk); });
    for (let i = 0; i < sacks; i++) this.line(teamId, pick(D.slice(0, 5))).sack++;
    for (let i = 0; i < ints; i++) this.line(teamId, pick(D.slice(3))).int++;
  },
  // the game you actually played
  addPlayedStats(pstats, teams) {
    if (!this.data) return;
    const seen = new Set();
    for (const s of Object.values(pstats || {})) {
      const t = teams[s.side]; if (!t) continue;
      const l = this.line(t.id, [s.pos, s.name, 0, 0, 0, 0, s.tw ? { twAlso: s.tw } : null]);
      if (!seen.has(l)) { l.g++; seen.add(l); }
      for (const k of ['pass', 'rush', 'rec', 'td', 'tkl', 'sack', 'int']) l[k] += s[k] || 0;
      if (s.blk) l.blk = (l.blk || 0) + s.blk; // blocked kicks (older saves don't have the field)
    }
  },
  leaders(k, n = 5) { return Object.values(this.data.stats || {}).filter(l => l[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, n); },

  // call after your game this week is decided (score = [home, away])
  finishWeek(myScore) {
    const d = this.data, wk = d.weeks[d.week];
    const mine = wk[0];
    this.addResult(mine.home, mine.away, myScore[0], myScore[1]);
    mine.score = myScore;
    for (let i = 1; i < wk.length; i++) { const g = wk[i]; g.score = this.simScore(g.home, g.away); this.addResult(g.home, g.away, g.score[0], g.score[1]); }
    d.week++;
    if (d.week >= d.games) this.startPlayoffs();
    this.save();
  },

  pct(id) { const r = this.data.rec[id], g = r.w + r.l + r.t; return g ? (r.w + r.t * 0.5) / g : 0; },
  standings(conf) {
    return TEAMS.filter(t => !conf || t.conf === conf).map(t => t.id)
      .sort((a, b) => this.pct(b) - this.pct(a) || (this.data.rec[b].pf - this.data.rec[b].pa) - (this.data.rec[a].pf - this.data.rec[a].pa) || this.data.rec[b].pf - this.data.rec[a].pf);
  },

  // ---- playoffs. Full 17-game season = the real NFL setup: 7 teams per conference (4 division winners + 3 wild cards),
  // the 1 seed gets a bye, then Wild Card, Divisional, Conference Championship, Bobble Bowl (every season now; old saves until their next year) ----
  startPlayoffs() {
    const d = this.data;
    const myConf = this.team(d.team).conf, full = d.games >= 17 || !!d.fullPO; // every season started from v7.4 on gets the full 14-team playoff
    const seedConf = c => {
      const st = this.standings(c);
      if (!full) return st.slice(0, 4);
      const divs = ['East', 'North', 'South', 'West'], win = divs.map(v => st.find(id => this.team(id).div === v)).filter(Boolean);
      win.sort((a, b) => st.indexOf(a) - st.indexOf(b));
      return win.concat(st.filter(id => !win.includes(id)).slice(0, 7 - win.length));
    };
    const seeds = { AFC: seedConf('AFC'), NFC: seedConf('NFC') };
    d.bracket = { seeds, round: 0, games: [], full, final: full ? 3 : 2, alive: { AFC: seeds.AFC.slice(), NFC: seeds.NFC.slice() } };
    d.phase = seeds[myConf].includes(d.team) ? 'playoffs' : 'missed';
    this.makeRound();
    if (d.phase === 'missed') this.simRestOfPlayoffs(); else this.skipBye();
    this.save();
  },
  isFinal() { const b = this.data && this.data.bracket; return !!b && b.round === (b.final != null ? b.final : 2); },
  makeRound() {
    const b = this.data.bracket, fin = b.final != null ? b.final : 2;
    if (!b.alive) { b.alive = { AFC: [], NFC: [] }; for (const w of b.winners || []) if (b.alive[w.conf]) b.alive[w.conf].push(w.id); } // old saves
    const bySeed = c => b.alive[c].slice().sort((x, y) => b.seeds[c].indexOf(x) - b.seeds[c].indexOf(y));
    if (b.round === fin) {
      const a = b.alive.AFC[0], n = b.alive.NFC[0];
      b.games = [{ conf: 'BOWL', home: chance(0.5) ? a : n, away: null }]; b.games[0].away = b.games[0].home === a ? n : a;
      return;
    }
    b.games = [];
    for (const c of ['AFC', 'NFC']) {
      const s = bySeed(c);
      if (b.full && b.round === 0) { b.bye = b.bye || {}; b.bye[c] = s[0]; b.games.push({ conf: c, home: s[1], away: s[6] }, { conf: c, home: s[2], away: s[5] }, { conf: c, home: s[3], away: s[4] }); }
      else for (let k = 0; k < s.length / 2; k++) b.games.push({ conf: c, home: s[k], away: s[s.length - 1 - k] }); // best left vs worst left
    }
  },
  roundName(r) {
    const b = this.data && this.data.bracket, bowl = bowlName(this.data && this.data.year);
    return (b && b.full ? ['Wild Card', 'Divisional Round', 'Conference Championship', bowl] : ['Semifinal', 'Conference Championship', bowl])[r] || bowl;
  },
  myPlayoffGame() { const b = this.data.bracket; return b && b.games.find(g => g.home === this.data.team || g.away === this.data.team); },
  playoffSim(home, away) { let s = this.simScore(home, away); if (s[0] === s[1]) s[chance(0.5) ? 0 : 1] += 3; return s; },
  // the 1 seed sits out Wild Card weekend: play the round without us
  skipBye() { const d = this.data; if (d.phase === 'playoffs' && !this.myPlayoffGame()) this.finishPlayoffRound(null); },
  finishPlayoffRound(myScore) {
    const d = this.data, b = d.bracket, fin = b.final != null ? b.final : 2;
    b.winners = [];
    for (const g of b.games) {
      g.score = (g.home === d.team || g.away === d.team) && myScore ? myScore : this.playoffSim(g.home, g.away);
      b.winners.push({ conf: g.conf, id: g.score[0] > g.score[1] ? g.home : g.away });
    }
    d.log.push({ round: b.round, games: b.games.map(g => ({ ...g })), bye: b.full && b.round === 0 ? b.bye : null });
    this.advance(b);
    const alive = b.round === fin ? b.winners.some(w => w.id === d.team) : (b.alive.AFC.includes(d.team) || b.alive.NFC.includes(d.team));
    if (b.round === fin) { d.champ = b.winners[0].id; d.phase = 'done'; this.finishSeason(); }
    else { b.round++; this.makeRound(); if (!alive) { d.phase = 'eliminated'; this.simRestOfPlayoffs(); } else this.skipBye(); }
    this.save();
  },
  // losers go home; the bye team stays in
  advance(b) {
    if (!b.alive || b.round === (b.final != null ? b.final : 2)) return;
    for (const c of ['AFC', 'NFC']) b.alive[c] = b.winners.filter(w => w.conf === c).map(w => w.id).concat(b.full && b.round === 0 && b.bye ? [b.bye[c]] : []);
  },
  simRestOfPlayoffs() {
    const d = this.data, b = d.bracket, fin = b.final != null ? b.final : 2;
    while (b.round <= fin && !d.champ) {
      b.winners = [];
      for (const g of b.games) { g.score = this.playoffSim(g.home, g.away); b.winners.push({ conf: g.conf, id: g.score[0] > g.score[1] ? g.home : g.away }); }
      d.log.push({ round: b.round, games: b.games.map(g => ({ ...g })), bye: b.full && b.round === 0 ? b.bye : null });
      this.advance(b);
      if (b.round === fin) d.champ = b.winners[0].id; else { b.round++; this.makeRound(); }
    }
    this.finishSeason();
    this.save();
  },

  // ---- end of year: awards, trophy case ----
  finishSeason() {
    const d = this.data; if (d.awards) return;
    const all = Object.values(d.stats || {}), win = id => this.pct(id);
    const best = (list, f) => list.slice().sort((a, b) => f(b) - f(a))[0];
    const at = (l, list) => list.includes(l.pos) || list.includes(l.tw); // two-way players count at both spots
    const mvp = best(all.filter(l => at(l, ['QB', 'RB', 'WR', 'TE'])), l => l.pass / 25 + l.rush / 10 + l.rec / 10 + l.td * 4 + win(l.t) * 40);
    const opoy = best(all.filter(l => at(l, ['RB', 'WR', 'TE']) && l !== mvp), l => l.rush / 10 + l.rec / 10 + l.td * 6);
    const dpoy = best(all.filter(l => at(l, ['DL', 'LB', 'CB', 'S'])), l => l.tkl + l.sack * 5 + l.int * 6);
    // Two-Way Player of the Year: real production on both sides
    const twoW = best(all.filter(l => l.tw && l.g >= Math.min(4, d.games) && l.rush + l.rec > 0 && l.tkl + l.int + l.sack > 0), l => l.rush / 10 + l.rec / 10 + l.td * 6 + l.tkl + l.sack * 5 + l.int * 6);
    const line = l => !l ? '' : l.tw ? `${l.rush + l.rec} total yds, ${l.td} TD, ${l.tkl} tkl, ${l.int} INT` : ['QB'].includes(l.pos) ? `${l.pass} pass yds, ${l.td} TD` : ['RB', 'WR', 'TE'].includes(l.pos) ? `${l.rush + l.rec} total yds, ${l.td} TD` : `${l.tkl} tkl, ${l.sack} sacks, ${l.int} INT`;
    d.awards = [['MVP', mvp], ['Offensive Player of the Year', opoy], ['Defensive Player of the Year', dpoy], ['Two-Way Player of the Year', twoW]].filter(a => a[1]).map(([award, l]) => ({ award, name: l.name, team: l.t, pos: l.tw ? `${l.pos}/${l.tw}` : l.pos, line: line(l) }));
    // your stuff goes in the trophy case
    if (d.champ === d.team) Career.addTitle(d.team, d.year);
    for (const a of d.awards) if (a.team === d.team) Career.addAward(a.award, a.name, a.team, d.year);
    const r = d.rec[d.team];
    d.history.push({ year: d.year, team: d.team, rec: `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`, finish: d.champ === d.team ? `Won ${bowlName(d.year)}` : d.phase === 'missed' ? 'Missed playoffs' : 'Lost in playoffs', champ: d.champ });
  },

  // ---- franchise: rosters you can change (trades) and that develop each year ----
  ensureRosters() {
    const d = this.data;
    if (!d.rosters) { const cp = p => p[6] ? p.slice(0, 6).concat([JSON.parse(JSON.stringify(p[6]))]) : p.slice(); d.rosters = {}; for (const t of TEAMS) d.rosters[t.id] = { off: t.off.map(cp), def: t.def.map(cp) }; } // own copy of the info slot (injuries etc. live there)
    return d.rosters;
  },
  // ratings move a little every offseason: young-ish low guys grow, top stars level off, award winners get a bump
  develop() {
    const R = this.ensureRosters(), d = this.data, mine = [];
    const award = new Set((d.awards || []).map(a => a.team + ':' + a.name));
    for (const id in R) for (const side of ['off', 'def']) R[id][side].forEach(p => {
      const before = p[3];
      let dv = rand(-2.7, 3.2) + (p[3] < 75 ? 1.6 : p[3] < 82 ? 0.6 : 0) - (p[3] >= 95 ? 1.8 : p[3] >= 90 ? 0.8 : 0) + (award.has(id + ':' + p[1]) ? 1.5 : 0);
      p[3] = clamp(Math.round(p[3] + dv), 55, 99);
      p[4] = clamp(Math.round((p[4] || 80) + rand(-1.6, 0.9)), 55, 99);
      if (id === d.team) mine.push({ name: p[1], pos: p[0], from: before, to: p[3] });
    });
    return mine.sort((a, b) => (b.to - b.from) - (a.to - a.from));
  },
  nextYear() {
    const d = this.data;
    const changes = this.develop();
    const carry = { year: d.year + 1, history: d.history, rosters: d.rosters };
    const sw = d.swap;
    this.start(d.team, d.games, d.qtr, d.diff, carry);
    if (sw) { this.data.swap = sw; this.save(); } // your custom team stays in the league
    this.data.devReport = changes;
    this.save();
    return changes;
  },
  // trade value: stars are worth a lot more than role players
  value(p) { return Math.pow(Math.max(1, p[3] - 55), 1.7); },
  tradeOdds(mine, theirs) {
    const vm = this.value(mine), vt = this.value(theirs);
    return clamp(Math.round(80 + (vm - vt) / vt * 160), 0, 100);
  },
  // swap two players at the same position (side: 'off' or 'def', i/j = roster slots)
  trade(otherId, side, i, j) {
    const R = this.ensureRosters(), a = R[this.data.team][side], b = R[otherId][side];
    const t = a[i]; a[i] = b[j]; b[j] = t;
    (this.data.trades || (this.data.trades = [])).push({ week: this.data.week, got: a[i][1], gave: b[j][1], with: otherId });
    this.save();
  }
};

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
