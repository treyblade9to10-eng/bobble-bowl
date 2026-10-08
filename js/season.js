// ---- Season mode: schedule, sim games, standings, playoffs, save/load ----
const Season = {
  data: null, // saved season (null = none)
  KEY: 'bobbleSeason',

  load() { try { this.data = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { this.data = null; } return this.data; },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  clear() { this.data = null; try { localStorage.removeItem(this.KEY); } catch (e) {} },

  start(teamId, games, qtr, diff) {
    const ids = TEAMS.map(t => t.id);
    const others = ids.filter(i => i !== teamId);
    // your opponents: no repeats until everyone has been played
    const opp = [];
    while (opp.length < games) opp.push(...shuffle(others.slice()));
    opp.length = games;
    const weeks = opp.map((o, w) => {
      const rest = shuffle(ids.filter(i => i !== teamId && i !== o));
      const games = [{ home: w % 2 === 0 ? teamId : o, away: w % 2 === 0 ? o : teamId }];
      for (let i = 0; i < rest.length; i += 2) games.push(chance(0.5) ? { home: rest[i], away: rest[i + 1] } : { home: rest[i + 1], away: rest[i] });
      return games;
    });
    const rec = {}; for (const i of ids) rec[i] = { w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    this.data = { team: teamId, games, qtr, diff, week: 0, weeks, rec, phase: 'regular', bracket: null, champ: null, log: [] };
    this.save();
  },

  team(id) { return TEAMS.find(t => t.id === id); },
  myGame() {
    const d = this.data; if (!d) return null;
    if (d.phase === 'regular') return d.weeks[d.week] && d.weeks[d.week][0];
    if (d.phase === 'playoffs') return this.myPlayoffGame();
    return null;
  },

  // quick rating-based result for games you don't play
  simScore(homeId, awayId) {
    const r = id => { const t = this.team(id), all = t.off.concat(t.def); return all.reduce((a, p) => a + p[3], 0) / all.length; };
    const edge = (r(homeId) - r(awayId) + 1.5) / 4;
    const homeWins = chance(1 / (1 + Math.exp(-edge)));
    const S = [3, 6, 7, 10, 13, 14, 16, 17, 20, 21, 23, 24, 27, 28, 30, 31, 34, 35, 38, 41, 42, 45];
    const w = S[4 + Math.floor(Math.random() * 14)];
    let l = Math.max(0, w - [1, 2, 3, 4, 6, 7, 7, 10, 11, 14, 17, 21][Math.floor(Math.random() * 12)]);
    return homeWins ? [w, l] : [l, w];
  },
  addResult(home, away, hs, as) {
    const R = this.data.rec;
    R[home].pf += hs; R[home].pa += as; R[away].pf += as; R[away].pa += hs;
    if (hs > as) { R[home].w++; R[away].l++; } else if (as > hs) { R[away].w++; R[home].l++; } else { R[home].t++; R[away].t++; }
  },

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

  // ---- playoffs: top 4 in each conference, then the Bobble Bowl ----
  startPlayoffs() {
    const d = this.data;
    const myConf = this.team(d.team).conf;
    const seeds = { AFC: this.standings('AFC').slice(0, 4), NFC: this.standings('NFC').slice(0, 4) };
    d.bracket = { seeds, round: 0, games: [] };
    d.phase = seeds[myConf].includes(d.team) ? 'playoffs' : 'missed';
    this.makeRound();
    if (d.phase === 'missed') this.simRestOfPlayoffs();
    this.save();
  },
  makeRound() {
    const b = this.data.bracket;
    if (b.round === 0) b.games = ['AFC', 'NFC'].flatMap(c => [{ conf: c, home: b.seeds[c][0], away: b.seeds[c][3] }, { conf: c, home: b.seeds[c][1], away: b.seeds[c][2] }]);
    else if (b.round === 1) b.games = ['AFC', 'NFC'].map(c => { const w = b.winners.filter(x => x.conf === c).map(x => x.id).sort((x, y) => b.seeds[c].indexOf(x) - b.seeds[c].indexOf(y)); return { conf: c, home: w[0], away: w[1] }; });
    else if (b.round === 2) { const a = b.winners.find(x => x.conf === 'AFC').id, n = b.winners.find(x => x.conf === 'NFC').id; b.games = [{ conf: 'BOWL', home: chance(0.5) ? a : n, away: null }]; b.games[0].away = b.games[0].home === a ? n : a; }
  },
  roundName(r) { return ['Semifinal', 'Conference Championship', 'Bobble Bowl'][r]; },
  myPlayoffGame() { const b = this.data.bracket; return b && b.games.find(g => g.home === this.data.team || g.away === this.data.team); },
  playoffSim(home, away) { let s = this.simScore(home, away); if (s[0] === s[1]) s[chance(0.5) ? 0 : 1] += 3; return s; },
  finishPlayoffRound(myScore) {
    const d = this.data, b = d.bracket;
    b.winners = [];
    for (const g of b.games) {
      g.score = (g.home === d.team || g.away === d.team) && myScore ? myScore : this.playoffSim(g.home, g.away);
      b.winners.push({ conf: g.conf, id: g.score[0] > g.score[1] ? g.home : g.away });
    }
    d.log.push({ round: b.round, games: b.games.map(g => ({ ...g })) });
    const iWon = b.winners.some(w => w.id === d.team);
    if (b.round === 2) { d.champ = b.winners[0].id; d.phase = 'done'; }
    else { b.round++; this.makeRound(); if (!iWon) { d.phase = 'eliminated'; this.simRestOfPlayoffs(); } }
    this.save();
  },
  simRestOfPlayoffs() {
    const d = this.data, b = d.bracket;
    while (b.round <= 2 && !d.champ) {
      b.winners = [];
      for (const g of b.games) { g.score = this.playoffSim(g.home, g.away); b.winners.push({ conf: g.conf, id: g.score[0] > g.score[1] ? g.home : g.away }); }
      d.log.push({ round: b.round, games: b.games.map(g => ({ ...g })) });
      if (b.round === 2) d.champ = b.winners[0].id; else { b.round++; this.makeRound(); }
    }
    this.save();
  }
};

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
