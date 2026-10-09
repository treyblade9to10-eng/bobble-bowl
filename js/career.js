// ---- Career mode (My Player): create a player -> college season -> combine -> draft day -> NFL seasons -> Hall of Fame ----
// Plus the Trophy Case bookkeeping for every mode.
const CAP_ARCH = {
  QB: [['Gunslinger', { spd: 74, a: [70, 60] }], ['Field General', { spd: 72, a: [62, 70] }], ['Scrambler', { spd: 87, a: [62, 62] }]],
  RB: [['Speed Back', { spd: 92, a: [62, 64] }], ['Power Back', { spd: 85, a: [70, 60] }]],
  WR: [['Deep Threat', { spd: 94, a: [62, 62] }], ['Possession', { spd: 87, a: [68, 64] }]],
  TE: [['Vertical Threat', { spd: 86, a: [64, 60] }], ['Blocker', { spd: 78, a: [60, 70] }]],
  DL: [['Speed Rusher', { spd: 83, a: [66, 60] }], ['Power Rusher', { spd: 74, a: [62, 70] }]],
  LB: [['Run Stopper', { spd: 82, a: [68, 60] }], ['Coverage', { spd: 87, a: [60, 66] }]],
  CB: [['Lockdown', { spd: 93, a: [66, 60] }], ['Ballhawk', { spd: 89, a: [60, 66] }]],
  S: [['Hitter', { spd: 87, a: [66, 60] }], ['Center Field', { spd: 91, a: [60, 66] }]]
};
const CAP_POS = Object.keys(CAP_ARCH);
// the two skills for each position (overall = their average; speed is its own thing)
const CAP_SKILLS = {
  QB: ['Throw Power', 'Accuracy'], RB: ['Elusiveness', 'Ball Carrier Vision'], WR: ['Catching', 'Route Running'], TE: ['Catching', 'Blocking'],
  DL: ['Pass Rush', 'Strength'], LB: ['Tackling', 'Coverage'], CB: ['Man Coverage', 'Ball Skills'], S: ['Coverage', 'Hit Power']
};
const COLLEGES = [
  { id: 'ALA', city: 'Alabama', name: 'Crimson Tide', c1: '#9E1B32', c2: '#FFFFFF', helmet: '#9E1B32', mask: '#FFFFFF', pants: '#FFFFFF', pr: 3 },
  { id: 'OSU', city: 'Ohio State', name: 'Buckeyes', c1: '#BB0000', c2: '#9AA1A8', helmet: '#B0B7BC', mask: '#BB0000', pants: '#9AA1A8', pr: 3 },
  { id: 'UGA', city: 'Georgia', name: 'Bulldogs', c1: '#BA0C2F', c2: '#000000', helmet: '#BA0C2F', mask: '#111111', pants: '#C8C8C8', pr: 3 },
  { id: 'LSU', city: 'LSU', name: 'Tigers', c1: '#461D7C', c2: '#FDD023', helmet: '#FDD023', mask: '#ffffff', pants: '#FDD023', pr: 2 },
  { id: 'MICH', city: 'Michigan', name: 'Wolverines', c1: '#00274C', c2: '#FFCB05', helmet: '#00274C', mask: '#FFCB05', pants: '#FFCB05', pr: 3 },
  { id: 'TEX', city: 'Texas', name: 'Longhorns', c1: '#BF5700', c2: '#FFFFFF', helmet: '#FFFFFF', mask: '#9a9a9a', pants: '#FFFFFF', pr: 2 },
  { id: 'ORE', city: 'Oregon', name: 'Ducks', c1: '#154733', c2: '#FEE123', helmet: '#154733', mask: '#FEE123', pants: '#154733', pr: 2 },
  { id: 'USC', city: 'USC', name: 'Trojans', c1: '#990000', c2: '#FFC72C', helmet: '#990000', mask: '#9a9a9a', pants: '#FFC72C', pr: 2 },
  { id: 'CLEM', city: 'Clemson', name: 'Tigers', c1: '#F56600', c2: '#522D80', helmet: '#FFFFFF', mask: '#F56600', pants: '#FFFFFF', pr: 2 },
  { id: 'PSU', city: 'Penn State', name: 'Nittany Lions', c1: '#041E42', c2: '#FFFFFF', helmet: '#FFFFFF', mask: '#041E42', pants: '#FFFFFF', pr: 2 },
  { id: 'ND', city: 'Notre Dame', name: 'Fighting Irish', c1: '#0C2340', c2: '#C99700', helmet: '#C99700', mask: '#9a9a9a', pants: '#C99700', pr: 2 },
  { id: 'TENN', city: 'Tennessee', name: 'Volunteers', c1: '#FF8200', c2: '#FFFFFF', helmet: '#FFFFFF', mask: '#FF8200', pants: '#FFFFFF', pr: 1 }
];
const CAP_GEAR = { visor: 68, gloves: 74, goldGloves: 88 }; // overall needed to unlock
const BADGES = {
  first_td: 'First Touchdown', big_game: 'Big Game', perfect: 'Perfect Game', bowl: 'Bowl Champion', first_round: 'First-Round Pick', top10: 'Top 10 Pick',
  xfactor: 'X-Factor Unlocked', elite: 'Elite: 90 OVR', club99: '99 Club', mvp: 'MVP', opoy: 'Offensive Player of the Year', dpoy: 'Defensive Player of the Year',
  champ: 'Bobble Bowl Champion', big_season: 'Monster Season', vet: '10-Year Veteran', hof: 'Hall of Fame'
};
const SEASON_RT = ['QB', 'RB', 'WR', 'TE'];

const Career = {
  KEY: 'bobbleCAP', TKEY: 'bobbleTrophies',
  cap: null, tro: null,
  load() {
    try { this.cap = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { this.cap = null; }
    try { this.tro = JSON.parse(localStorage.getItem(this.TKEY) || 'null'); } catch (e) { this.tro = null; }
    if (!this.tro) this.tro = { games: 0, w: 0, l: 0, t: 0, titles: [], awards: [], bestWin: null, seasons: 0 };
    if (!this.tro.legends) this.tro.legends = [];
    if (this.cap && !this.cap.v) this.migrate();
    return this;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.cap)); localStorage.setItem(this.TKEY, JSON.stringify(this.tro)); } catch (e) {} },
  // old My Player saves: drop him straight into the NFL on his team
  migrate() {
    const o = this.cap;
    this.cap = this.blank({ name: o.name, pos: o.pos, arch: o.arch, num: o.num, skin: o.skin, college: 'ALA', games: 10, diff: 1, qtr: 180 });
    const c = this.cap;
    c.a = [o.ovr, o.ovr]; c.spd = o.spd; if (o.pos === 'QB') c.a = [Math.round(o.thp || o.ovr), Math.round(o.tha || o.ovr)];
    c.phase = 'nfl'; c.team = o.team; c.draft = { round: 0, pick: 0, team: o.team, note: 'Signed before the new career mode' }; c.age = 23;
    c.contract = { years: 3, total: 9 }; c.stats = { pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0, g: o.games || 0 };
    this.save();
  },
  blank(o) {
    const arch = CAP_ARCH[o.pos].find(a => a[0] === o.arch) || CAP_ARCH[o.pos][0];
    return { v: 2, name: o.name, pos: o.pos, arch: arch[0], num: o.num, skin: o.skin, a: arch[1].a.slice(), spd: arch[1].spd, sp: 0, xp: 0, lvl: 1,
      games: o.games || 10, diff: o.diff != null ? o.diff : 1, qtr: o.qtr || 180, lock: true, gear: { visor: false, gloves: 'white' },
      phase: 'college', age: 21, college: null, team: null, combine: null, draft: null, contract: null,
      stats: { pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0, g: 0 }, seasons: [], badges: [], log: [] };
  },
  create(o) {
    this.cap = this.blank(o);
    this.startCollege(o.college);
    this.save();
  },
  retireNow() { this.cap = null; this.save(); },

  // ---- ratings ----
  ovr(c = this.cap) { return Math.round((c.a[0] + c.a[1]) / 2); },
  need(lvl) { return 120 + lvl * 10; }, // XP for the next level (each level = 3 skill points)
  tuple() {
    const c = this.cap; if (!c) return null;
    const gl = c.gear.gloves === 'team' ? null : c.gear.gloves === 'black' ? '#151515' : c.gear.gloves === 'gold' ? '#f6c31c' : '#f2f2f2';
    return [c.pos, c.name, c.num, this.ovr(), Math.round(c.spd), c.skin,
      { cap: true, thp: c.pos === 'QB' ? c.a[0] : null, tha: c.pos === 'QB' ? c.a[1] : null, visor: !!c.gear.visor, gloves: gl, teamGloves: c.gear.gloves === 'team' }];
  },
  // slot the created player onto his team's roster (replacing the weakest guy at his spot)
  withCAP(team) {
    const c = this.cap; if (!c || !team || c.team !== team.id || c.phase === 'retired') return team;
    if (team.off.concat(team.def).some(p => p[6] && p[6].cap)) return team; // already on there
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
  gainXP(xp) {
    const c = this.cap, before = this.ovr(); let lv = 0;
    c.xp += xp;
    while (c.xp >= this.need(c.lvl)) { c.xp -= this.need(c.lvl); c.lvl++; c.sp += 3; lv++; }
    return { lv, before };
  },
  // spend skill points: +1 to a skill costs 1, +1 speed costs 2
  upgrade(k) {
    const c = this.cap;
    if (k === 'spd') { if (c.sp < 2 || c.spd >= 99) return false; c.sp -= 2; c.spd = Math.min(99, c.spd + 1); }
    else { if (c.sp < 1 || c.a[k] >= 99) return false; c.sp -= 1; c.a[k]++; }
    this.checkBadges(); this.save(); return true;
  },
  gearOk(k) { return this.ovr() >= CAP_GEAR[k]; },
  badge(k) { const c = this.cap; if (!c || c.badges.some(b => b.k === k)) return false; c.badges.push({ k, lvl: c.phase === 'college' ? 'College' : `Year ${this.yearNum()}` }); this.fresh = (this.fresh || []).concat(k); return true; },
  yearNum() { return Math.max(1, (this.cap.seasons.filter(s => s.lvl === 'NFL').length) + (this.cap.phase === 'nfl' ? 1 : 0)); },
  checkBadges() {
    const o = this.ovr();
    if (o >= 85) this.badge('xfactor'); if (o >= 90) this.badge('elite'); if (o >= 99) this.badge('club99');
  },

  // ---- game goals + grade ----
  goals() {
    const c = this.cap, f = (c.qtr || 180) / 180, n = v => Math.max(1, Math.round(v * f / 5) * 5), k = v => Math.max(1, Math.round(v * f));
    const G3 = {
      QB: [['pass', n(150), 'pass yds'], ['td', k(2), 'touchdowns'], ['win', 1, 'Win the game']],
      RB: [['rush', n(60), 'rush yds'], ['td', 1, 'touchdown'], ['tot', n(90), 'total yds']],
      WR: [['rec', n(50), 'rec yds'], ['td', 1, 'touchdown'], ['rec', n(90), 'rec yds']],
      TE: [['rec', n(40), 'rec yds'], ['td', 1, 'touchdown'], ['win', 1, 'Win the game']],
      DL: [['tkl', k(2), 'tackles'], ['sack', 1, 'sack'], ['win', 1, 'Win the game']],
      LB: [['tkl', k(4), 'tackles'], ['big', 1, 'sack or INT'], ['win', 1, 'Win the game']],
      CB: [['tkl', k(2), 'tackles'], ['int', 1, 'interception'], ['win', 1, 'Win the game']],
      S: [['tkl', k(3), 'tackles'], ['int', 1, 'interception'], ['win', 1, 'Win the game']]
    }[c.pos];
    return G3.map(([key, v, txt]) => ({ key, v, text: key === 'win' ? txt : `${v} ${txt}` }));
  },
  goalVal(key, st, won) { return key === 'win' ? (won ? 1 : 0) : key === 'tot' ? (st.rush || 0) + (st.rec || 0) : key === 'big' ? (st.sack || 0) + (st.int || 0) : st[key] || 0; },
  score(st, pos) {
    return SEASON_RT.includes(pos) ? (st.pass || 0) / 12 + (st.rush || 0) / 5 + (st.rec || 0) / 5 + (st.td || 0) * 7 : (st.tkl || 0) * 3 + (st.sack || 0) * 9 + (st.int || 0) * 11;
  },
  grade(st, won, goalsHit) {
    const c = this.cap, f = (c.qtr || 180) / 180;
    const exp = { QB: 26, RB: 18, WR: 15, TE: 11, DL: 9, LB: 13, CB: 8, S: 10 }[c.pos] * f;
    const r = this.score(st, c.pos) / exp + (won ? 0.15 : 0) + goalsHit * 0.12;
    return r >= 1.6 ? 'A+' : r >= 1.25 ? 'A' : r >= 1.0 ? 'B+' : r >= 0.8 ? 'B' : r >= 0.6 ? 'C+' : r >= 0.45 ? 'C' : r >= 0.3 ? 'D' : 'F';
  },
  big(st) {
    return (st.pass || 0) >= 300 || (st.rush || 0) >= 100 || (st.rec || 0) >= 100 || (st.td || 0) >= 3 || (st.tkl || 0) >= 8 || (st.sack || 0) >= 2 || (st.int || 0) >= 2;
  },
  gameBadges(st) { if (st.td) this.badge('first_td'); if (this.big(st)) this.badge('big_game'); },
  addStats(st) { const c = this.cap; for (const k of ['pass', 'rush', 'rec', 'td', 'tkl', 'sack', 'int']) { c.stats[k] += st[k] || 0; this.cur()[k] += st[k] || 0; } c.stats.g++; this.cur().g++; },
  // this year's stat line
  // create = false: just look (don't start a new season line)
  cur(create = true) {
    const c = this.cap, lvl = c.phase === 'college' ? 'NCAA' : 'NFL', team = c.phase === 'college' ? c.college.id : c.team;
    let s = c.seasons[c.seasons.length - 1];
    if (!s || s.open !== true || s.lvl !== lvl || s.team !== team) {
      if (!create) return { g: 0, pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0 };
      s = { lvl, team, open: true, age: c.age, g: 0, pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0 }; c.seasons.push(s); }
    return s;
  },

  // after a game you PLAYED: stats, goals, grade, XP
  afterGame(s) {
    const c = this.cap; if (!c || !G.career) return null;
    const side = G.teams.findIndex(t => t.id === c.team); if (side < 0) return null;
    const st = Object.values(G.pstats || {}).find(p => p.side === side && p.name === c.name) || {};
    const won = s.score[side] > s.score[1 - side];
    const goals = this.goals().map(g => ({ ...g, done: this.goalVal(g.key, st, won) >= g.v }));
    const hit = goals.filter(g => g.done).length;
    const grade = this.grade(st, won, hit);
    const gb = { 'A+': 80, A: 60, 'B+': 45, B: 30, 'C+': 20, C: 10, D: 0, F: 0 }[grade];
    const xp = Math.round(50 + (won ? 30 : 0) + hit * 60 + gb + this.score(st, c.pos) * 2.5);
    this.addStats(st); this.gameBadges(st);
    if (hit === 3) this.badge('perfect');
    const r = this.gainXP(xp); this.checkBadges();
    const opp = G.teams[1 - side].id;
    c.log.unshift({ vs: opp, score: `${s.score[side]}-${s.score[1 - side]}`, xp, grade, line: this.line(st) }); c.log.length = Math.min(c.log.length, 12);
    if (G.career === 'college') this.collegeResult(side === 0 ? s.score : [s.score[1], s.score[0]], side === 0);
    this.save();
    return { xp, grade, goals, lv: r.lv, line: this.line(st), won };
  },
  line(st) {
    const L = [st.pass && `${st.pass} pass yds`, st.rush && `${st.rush} rush yds`, st.rec && `${st.rec} rec yds`, st.td && `${st.td} TD`, st.tkl && `${st.tkl} tkl`, st.sack && `${st.sack} sack${st.sack > 1 ? 's' : ''}`, st.int && `${st.int} INT`].filter(Boolean);
    return L.join(', ') || 'quiet game';
  },
  // a stat line for a game you simmed
  simLine(pts, won) {
    const c = this.cap, o = this.ovr(), q = (o - 55) / 40, r = () => rand(0.6, 1.4);
    const st = { pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0 };
    const tds = Math.round(pts / 7);
    if (c.pos === 'QB') { st.pass = Math.round((140 + q * 160) * r()); st.td = Math.min(tds, Math.round(tds * rand(0.4, 0.8))); st.rush = Math.round(rand(-5, 30) * (c.spd > 85 ? 2 : 1)); }
    else if (c.pos === 'RB') { st.rush = Math.round((40 + q * 70) * r()); st.rec = Math.round(rand(0, 35)); st.td = chance(0.3 + q * 0.4) ? 1 + (chance(0.25) ? 1 : 0) : 0; }
    else if (c.pos === 'WR' || c.pos === 'TE') { st.rec = Math.round((c.pos === 'WR' ? 35 + q * 70 : 25 + q * 50) * r()); st.td = chance(0.25 + q * 0.35) ? 1 : 0; }
    else { st.tkl = Math.round(({ DL: 2.5, LB: 5, CB: 3, S: 4 }[c.pos] + q * 2) * r()); st.sack = c.pos === 'DL' || c.pos === 'LB' ? (chance(0.25 + q * 0.4) ? 1 : 0) : 0; st.int = c.pos === 'CB' || c.pos === 'S' || c.pos === 'LB' ? (chance(0.12 + q * 0.2) ? 1 : 0) : 0; }
    return st;
  },
  // simmed games give less XP than playing (playing is where you really get better)
  simXP(st, won) { return Math.round(30 + (won ? 15 : 0) + this.score(st, this.cap.pos) * 1.2); },

  // ---------------- college ----------------
  collegeTeam(id) {
    const c = this.cap, base = COLLEGES.find(x => x.id === id);
    const ro = c.college.rosters[id];
    return { ...base, conf: 'NCAA', div: '', off: ro.off, def: ro.def };
  },
  makeCollegeRoster(pr, seed) {
    const mk = pos => { const [s0, s1] = ROOKIE_SPD[pos]; const star = chance(0.15); return [pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), Math.round(rand(58, 70) + pr * 2 + (star ? 7 : 0)), Math.round(rand(s0, s1) - 2), Math.floor(Math.random() * 6)]; };
    return { off: ['QB', 'RB', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL'].map(mk), def: ['DL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S'].map(mk) };
  },
  startCollege(id) {
    const c = this.cap, rosters = {};
    for (const t of COLLEGES) rosters[t.id] = this.makeCollegeRoster(t.pr);
    const opps = shuffle(COLLEGES.filter(t => t.id !== id).map(t => t.id)).slice(0, 6);
    c.college = { id, rosters, sched: opps.map((o, i) => ({ opp: o, home: i % 2 === 0, score: null })), week: 0, w: 0, l: 0, bowl: null, done: false };
    c.team = id; c.phase = 'college';
  },
  collegeGame() { const cl = this.cap.college; return cl.week < cl.sched.length ? cl.sched[cl.week] : null; },
  // score = [mine, theirs]
  collegeResult(sc) {
    const cl = this.cap.college, g = this.collegeGame(); if (!g) return;
    g.score = sc; cl.week++;
    if (sc[0] > sc[1]) cl.w++; else cl.l++;
    if (g.bowl && sc[0] > sc[1]) this.badge('bowl');
    if (cl.week >= cl.sched.length) {
      if (!cl.bowl && cl.w >= 4) { // earned a bowl game
        const used = new Set(cl.sched.map(s => s.opp)), opp = COLLEGES.find(t => t.id !== cl.id && !used.has(t.id)) || COLLEGES.find(t => t.id !== cl.id);
        cl.bowl = opp.id; cl.sched.push({ opp: opp.id, home: false, score: null, bowl: true });
      } else { cl.done = true; this.cur().open = false; this.cap.phase = 'combine'; }
    }
  },
  simCollege() {
    const c = this.cap, g = this.collegeGame(); if (!g) return null;
    const me = this.collegeTeam(c.college.id), op = this.collegeTeam(g.opp);
    const ov = t => t.off.concat(t.def).reduce((a, p) => a + p[3], 0) / 16;
    const edge = (ov(this.withCAP(me)) - ov(op) + (g.home ? 1.5 : 0) + (this.ovr() - 65) * 0.15) / 4;
    const won = chance(1 / (1 + Math.exp(-edge)));
    const w = pick([17, 20, 21, 24, 27, 28, 31, 34, 35, 38, 42]), l = Math.max(0, w - pick([1, 3, 4, 6, 7, 10, 14, 17]));
    const sc = won ? [w, l] : [l, w];
    const st = this.simLine(sc[0], won); this.addStats(st); this.gameBadges(st);
    const xp = this.simXP(st, won); this.gainXP(xp); this.checkBadges();
    c.log.unshift({ vs: g.opp, score: `${sc[0]}-${sc[1]}`, xp, grade: 'SIM', line: this.line(st) }); c.log.length = Math.min(c.log.length, 12);
    this.collegeResult(sc); this.save();
    return { sc, st, xp };
  },

  // ---------------- combine + draft ----------------
  setCombine(t) {
    const c = this.cap, bench = Math.round(8 + (c.pos === 'DL' ? 14 : c.pos === 'LB' || c.pos === 'TE' ? 8 : 0) + rand(0, 8) + (c.a[1] - 60) * 0.2);
    const vert = Math.round((28 + (c.spd - 75) * 0.45 + rand(-2, 3)) * 2) / 2;
    c.combine = { forty: +t.toFixed(2), bench, vert }; c.phase = 'draft'; this.save();
  },
  // 40 time if you skip the dash (from your speed)
  fortyFromSpd() { return +(5.55 - (this.cap.spd - 60) * 0.03 + rand(-0.04, 0.04)).toFixed(2); },
  stock() {
    const c = this.cap, s = c.seasons.find(x => x.lvl === 'NCAA') || { g: 1 };
    const pg = this.score(s, c.pos) / Math.max(1, s.g) * (180 / (c.qtr || 180));
    const cl = c.college, pr = COLLEGES.find(x => x.id === cl.id).pr;
    const forty = c.combine ? c.combine.forty : this.fortyFromSpd();
    const fortyAvg = { QB: 4.85, RB: 4.5, WR: 4.48, TE: 4.7, DL: 4.85, LB: 4.65, CB: 4.45, S: 4.55 }[c.pos];
    return (this.ovr() - 58) * 2.2 + Math.min(36, pg * 1.4) + cl.w * 2 + (cl.bowl && cl.sched[cl.sched.length - 1].score && cl.sched[cl.sched.length - 1].score[0] > cl.sched[cl.sched.length - 1].score[1] ? 5 : 0) + (fortyAvg - forty) * 45 + pr * 3;
  },
  projPick(stock = this.stock()) { return clamp(Math.round(97 - stock * 0.95), 1, 96); },
  projText(p = this.projPick()) { const r = Math.ceil(p / 32); const lo = clamp(p - 6, 1, 96), hi = clamp(p + 6, 1, 96); return `Round ${r} (picks ${lo}-${hi})`; },
  // the whole draft: 3 rounds, worse teams pick first; you go around your projection
  runDraft() {
    const c = this.cap;
    const order = TEAMS.map(t => t.id).map(id => ({ id, k: TEAMS.find(t => t.id === id).off.concat(TEAMS.find(t => t.id === id).def).reduce((a, p) => a + p[3], 0) + rand(-60, 60) })).sort((a, b) => a.k - b.k).map(o => o.id);
    const myPick = clamp(this.projPick() + Math.round(rand(-5, 5)), 1, 96);
    const picks = [];
    for (let n = 1; n <= myPick; n++) {
      const team = order[(n - 1) % 32];
      if (n === myPick) picks.push({ n, team, me: true });
      else { const pos = pick(DRAFT_POS); picks.push({ n, team, pos, name: `${pick(FIRST)} ${pick(LAST)}`, school: pick(SCHOOLS) }); }
    }
    const team = order[(myPick - 1) % 32], round = Math.ceil(myPick / 32), inRound = (myPick - 1) % 32 + 1;
    const total = round === 1 ? +(Math.max(4, 42 - myPick * 1.1)).toFixed(1) : round === 2 ? +(rand(6, 9)).toFixed(1) : +(rand(4, 5.5)).toFixed(1);
    c.draft = { pick: myPick, round, inRound, team, picks, done: false };
    c.contract = { years: 4, total, rookie: true };
    this.save();
    return c.draft;
  },
  // after the draft card: you're on the team
  joinNFL() {
    const c = this.cap, d = c.draft;
    if (d.round === 1) this.badge('first_round'); if (d.pick <= 10) this.badge('top10');
    d.done = true; c.team = d.team; c.phase = 'nfl'; c.age = 22;
    this.save();
  },

  // ---------------- NFL years ----------------
  // a season ended: grade the year, badges, awards, aging, contract
  endNFLSeason(d) {
    const c = this.cap, s = this.cur();
    s.open = false; s.record = d.rec[c.team] ? `${d.rec[c.team].w}-${d.rec[c.team].l}` : ''; s.ovr = this.ovr();
    s.awards = (d.awards || []).filter(a => a.name === c.name && a.team === c.team).map(a => a.award);
    if (s.awards.includes('MVP')) this.badge('mvp'); if (s.awards.includes('Offensive Player of the Year')) this.badge('opoy'); if (s.awards.includes('Defensive Player of the Year')) this.badge('dpoy');
    if (d.champ === c.team) { s.champ = true; this.badge('champ'); }
    if (s.g >= 4 && this.score(s, c.pos) / s.g >= ({ QB: 40, RB: 26, WR: 22, TE: 16, DL: 14, LB: 18, CB: 13, S: 15 }[c.pos]) * (c.qtr / 180)) this.badge('big_season');
    if (c.seasons.filter(x => x.lvl === 'NFL').length >= 10) this.badge('vet');
    this.save();
  },
  // offseason: older, maybe better or worse; contract ticks down
  offseason() {
    const c = this.cap; c.age++;
    const dv = c.age <= 26 ? rand(0, 2) : c.age <= 30 ? rand(-1, 1) : c.age <= 33 ? rand(-3, 0) : rand(-5, -1);
    c.a = c.a.map(v => clamp(Math.round(v + dv), 40, 99)); c.spd = clamp(Math.round(c.spd + (c.age > 29 ? -rand(0.5, 2) : rand(-0.3, 0.6))), 50, 99);
    if (c.contract) c.contract.years--;
    this.save();
  },
  // contract ran out: three teams make an offer
  offers() {
    const c = this.cap, o = this.ovr(), base = Math.max(1, (o - 60) * 1.4), yrs = c.age >= 32 ? [1, 2] : [2, 3, 4, 5];
    const ids = shuffle(TEAMS.map(t => t.id).filter(id => id !== c.team)).slice(0, 2).concat([c.team]);
    return ids.map(id => { const y = pick(yrs); return { team: id, years: y, total: +(base * y * rand(0.8, 1.25) * (id === c.team ? 0.95 : 1)).toFixed(1) }; }).sort((a, b) => b.total - a.total);
  },
  mustRetire() { const c = this.cap; return c.age >= 38 || (c.age >= 33 && this.ovr() < 65); },
  // Hall of Fame: big careers get a plaque
  retireCareer() {
    const c = this.cap, nfl = c.seasons.filter(s => s.lvl === 'NFL');
    const awards = nfl.reduce((a, s) => a + (s.awards || []).length, 0), titles = nfl.filter(s => s.champ).length;
    const peak = Math.max(this.ovr(), ...nfl.map(s => s.ovr || 0));
    const tot = nfl.reduce((a, s) => a + this.score(s, c.pos), 0);
    const pts = (peak - 75) * 3 + awards * 25 + titles * 15 + nfl.length * 4 + tot / (SEASON_RT.includes(c.pos) ? 60 : 30);
    const hof = pts >= 100;
    if (hof) this.badge('hof');
    const L = { name: c.name, pos: c.pos, num: c.num, college: c.college ? c.college.id : '', teams: [...new Set(nfl.map(s => s.team))], years: nfl.length, peak, awards, titles,
      stats: { ...c.stats }, hof, draft: c.draft ? `Round ${c.draft.round}, Pick ${c.draft.pick}` : '', skin: c.skin, date: new Date().toISOString().slice(0, 10) };
    this.tro.legends.unshift(L);
    c.phase = 'retired'; this.save();
    return L;
  },

  // ---------------- trophy case (all modes) ----------------
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
