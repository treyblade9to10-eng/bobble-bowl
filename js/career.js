// ---- My Player (create-a-player that levels up) + Trophy Case ----
const CAP_ARCH = {
  QB: [['Gunslinger', { spd: 74, thp: 76, tha: 60 }], ['Field General', { spd: 72, thp: 64, tha: 70 }], ['Scrambler', { spd: 87, thp: 64, tha: 62 }]],
  RB: [['Speed Back', { spd: 92 }], ['Power Back', { spd: 85 }]],
  WR: [['Deep Threat', { spd: 94 }], ['Possession', { spd: 87 }]],
  TE: [['Vertical Threat', { spd: 86 }], ['Blocker', { spd: 78 }]],
  DL: [['Speed Rusher', { spd: 83 }], ['Power Rusher', { spd: 74 }]],
  LB: [['Run Stopper', { spd: 82 }], ['Coverage', { spd: 87 }]],
  CB: [['Lockdown', { spd: 93 }], ['Ballhawk', { spd: 89 }]],
  S: [['Hitter', { spd: 87 }], ['Center Field', { spd: 91 }]]
};
const CAP_POS = Object.keys(CAP_ARCH);

const Career = {
  KEY: 'bobbleCAP', TKEY: 'bobbleTrophies',
  cap: null, tro: null,
  load() {
    try { this.cap = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { this.cap = null; }
    try { this.tro = JSON.parse(localStorage.getItem(this.TKEY) || 'null'); } catch (e) { this.tro = null; }
    if (!this.tro) this.tro = { games: 0, w: 0, l: 0, t: 0, titles: [], awards: [], bestWin: null, seasons: 0 };
    return this;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.cap)); localStorage.setItem(this.TKEY, JSON.stringify(this.tro)); } catch (e) {} },

  create(o) {
    const arch = (CAP_ARCH[o.pos].find(a => a[0] === o.arch) || CAP_ARCH[o.pos][0]);
    this.cap = { name: o.name, pos: o.pos, num: o.num, skin: o.skin, team: o.team, arch: arch[0], ovr: 62, spd: arch[1].spd, thp: arch[1].thp || 0, tha: arch[1].tha || 0,
      xp: 0, games: 0, stats: { pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0 }, log: [] };
    this.save();
  },
  retire() { this.cap = null; this.save(); },
  need(ovr) { return 60 + Math.max(0, ovr - 60) * 6; }, // xp to the next level

  tuple() {
    const c = this.cap; if (!c) return null;
    return [c.pos, c.name, c.num, c.ovr, Math.round(c.spd), c.skin, { cap: true, thp: c.thp || null, tha: c.tha || null }];
  },
  // slot the created player onto his team's roster (replacing the weakest guy at his spot)
  withCAP(team) {
    const c = this.cap; if (!c || !team || c.team !== team.id) return team;
    const t = { ...team, off: team.off.slice(), def: team.def.slice() }, tp = this.tuple();
    const swap = (list, idxs) => { let bi = idxs[0]; for (const i of idxs) if (list[i][3] < list[bi][3]) bi = i; list[bi] = tp; };
    if (c.pos === 'QB') t.off[0] = tp;
    else if (c.pos === 'RB') t.off[1] = tp;
    else if (c.pos === 'WR') { const wr = [2, 3, 4].filter(i => t.off[i][0] === 'WR'); swap(t.off, wr.length ? wr : [2, 3]); }
    else if (c.pos === 'TE') { const i = [2, 3, 4].find(i => t.off[i][0] === 'TE'); t.off[i != null ? i : 4] = tp; }
    else if (c.pos === 'DL') swap(t.def, [0, 1, 2]);
    else if (c.pos === 'LB') swap(t.def, [3, 4]);
    else if (c.pos === 'CB') swap(t.def, [5, 6]);
    else if (c.pos === 'S') t.def[7] = tp;
    return t;
  },

  // after a game: XP for what he did, level ups, career stats
  afterGame(s) {
    const c = this.cap; if (!c || G.versus) return null;
    const side = G.teams.findIndex(t => t.id === c.team);
    if (side < 0 || side !== G.human) return null;
    const st = Object.values(G.pstats || {}).find(p => p.side === side && p.name === c.name) || { pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0, comp: 0 };
    const won = s.score[side] > s.score[1 - side];
    const xp = Math.round(20 + (won ? 25 : 0) + st.pass / 10 + st.rush / 4 + st.rec / 4 + st.td * 15 + st.tkl * 4 + st.sack * 12 + st.int * 15 + (st.comp || 0));
    for (const k in c.stats) c.stats[k] += st[k] || 0;
    c.games++; c.xp += xp;
    const before = c.ovr; let ups = 0;
    while (c.ovr < 99 && c.xp >= this.need(c.ovr)) {
      c.xp -= this.need(c.ovr); c.ovr++; ups++;
      c.spd = Math.min(99, c.spd + 0.35);
      if (c.pos === 'QB') { if (c.ovr % 2) c.thp = Math.min(99, c.thp + 1); else c.tha = Math.min(99, c.tha + 1); c.tha = Math.min(99, c.tha + 0.5); }
    }
    if (c.ovr >= 99) c.xp = 0;
    c.log.unshift({ vs: G.teams[1 - side].id, score: `${s.score[side]}-${s.score[1 - side]}`, xp }); c.log.length = Math.min(c.log.length, 12);
    this.save();
    const line = [st.pass && `${st.pass} pass yds`, st.rush && `${st.rush} rush yds`, st.rec && `${st.rec} rec yds`, st.td && `${st.td} TD`, st.tkl && `${st.tkl} tkl`, st.sack && `${st.sack} sacks`, st.int && `${st.int} INT`].filter(Boolean).join(', ');
    return { xp, before, after: c.ovr, ups, line: line || 'quiet game' };
  },

  // trophy case bookkeeping
  gameDone(s) {
    if (G.versus || G.challenge || G.mini) return;
    const me = s.human, them = 1 - me, T = this.tro;
    T.games++;
    if (s.score[me] > s.score[them]) {
      T.w++;
      const m = s.score[me] - s.score[them];
      if (!T.bestWin || m > T.bestWin.margin) T.bestWin = { margin: m, text: `${s.teams[me].id} ${s.score[me]}, ${s.teams[them].id} ${s.score[them]}` };
    } else if (s.score[me] < s.score[them]) T.l++; else T.t++;
    this.save();
  },
  addTitle(team, year) { this.tro.titles.push({ team, year: year || 1, date: new Date().toISOString().slice(0, 10) }); this.save(); },
  addAward(award, name, team, year) { this.tro.awards.push({ award, name, team, year }); this.save(); }
};
Career.load();
