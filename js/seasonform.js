// ---- Season week by week: player form (OVR moves with how a guy is actually playing), Players of the Week, Pro Bowl ----
// Saved data (all added lazily, old saves load fine):
//   p[6].fm = { y: year, h: heat, n: games graded, d: net OVR change this season, base: OVR at his first graded game, s: streak }
//   p[6].pb = [years he made the Pro Bowl]
//   d.formLog = [{ y, wk, t, name, pos, from, to }]  newest first, d.formN = { y, u, d } league risers / fallers this year
//   d.potw = [{ y, wk, off, def, rook }]   d.prbVote = { y, picks: { QB: key, ... }, done }   d.probowl = { y, list: [...] }
// Offseason development (aging.js) already rewards a big year: what a player gained or lost in-season comes off that, so it never counts twice.
const FORM_HOT = 2.6, FORM_DECAY = 0.55, FORM_CAP = 4, FORM_MIN_GAMES = 3;
// big games (TDs, sacks, picks) spike a lot higher than a quiet game drops, so each spot gets its own cold line (from simmed seasons: about as many go down as up)
const FORM_COLD = { QB: -2.3, RB: -2.0, WR: -1.55, TE: -1.55, DL: -1.45, LB: -1.7, CB: -1.05, S: -1.1 };
const FORM_KEYS = ['pass', 'rush', 'rec', 'td', 'tkl', 'sack', 'int', 'blk'];
const FORM_OFF = ['QB', 'RB', 'WR', 'TE'], FORM_DEF = ['DL', 'LB', 'CB', 'S'];
const PB_SPOTS = { QB: 3, RB: 2, WR: 4, TE: 2, OL: 4, DL: 4, LB: 3, CB: 3, S: 2 }; // per conference
const PB_POS = Object.keys(PB_SPOTS);
const PB_NAMES = { QB: 'QUARTERBACK', RB: 'RUNNING BACK', WR: 'WIDE RECEIVER', TE: 'TIGHT END', OL: 'OFFENSIVE LINE', DL: 'DEFENSIVE LINE', LB: 'LINEBACKER', CB: 'CORNERBACK', S: 'SAFETY' };

const Form = {
  live() { const d = Season.data; return !!d && !(Season.isCareer && Season.isCareer()); },
  // season stat lines as plain numbers, to diff after the week
  snap() { const out = {}; for (const [k, l] of Object.entries(Season.data.stats || {})) out[k] = FORM_KEYS.map(s => l[s] || 0).concat(l.g || 0); return out; },
  // post = the stats right when the regular season ended (playoff games simmed in the same call don't count)
  diff(pre, post) {
    const out = [], G0 = FORM_KEYS.length;
    for (const [k, a] of Object.entries(post || this.snap())) {
      const l = Season.data.stats[k], b = pre[k], g = a[G0] - (b ? b[G0] : 0); if (!l || g <= 0) continue;
      const x = { k, t: l.t, name: l.name, pos: l.pos, tw: l.tw };
      FORM_KEYS.forEach((s, i) => { x[s] = a[i] - (b ? b[i] : 0); });
      out.push(x);
    }
    return out;
  },
  // team:name -> { id, p } for every rostered player (and by name alone, for guys traded this week)
  index() {
    const R = Season.ensureRosters(), byKey = new Map(), byName = new Map();
    for (const id in R) for (const g of ['off', 'def', 'bench']) for (const p of R[id][g] || []) if (p) { const e = { id, p }; byKey.set(id + ':' + p[1], e); if (!byName.has(p[1])) byName.set(p[1], e); }
    return { find: (t, name, pos) => { const e = byKey.get(t + ':' + name) || byName.get(name); return e && (!pos || e.p[0] === pos || posGroup(e.p[0]) === posGroup(pos)) ? e : null; } };
  },
  // one game: about -2.5 (awful) to +2.5 (huge), judged against what a player of his rating usually puts up
  grade(x, ovr) {
    const s = k => x[k] || 0, o = ovr || 80;
    let z = 0;
    if (x.pos === 'QB') z = (s('pass') - (235 + 3 * (o - 81))) / 70 + (s('td') - 1.6) / 1.2 + (s('rush') - 10) / 45;
    else if (x.pos === 'RB') z = (s('rush') + s('rec') - (112 + 2 * (o - 84))) / 40 + (s('td') - 1.1) / 1.0;
    else if (x.pos === 'WR' || x.pos === 'TE') z = (s('rec') - (66 + 2 * (o - 82))) / 35 + (s('td') - 0.5) / 0.8;
    else if (x.pos === 'DL') z = (s('sack') - 0.36) / 0.6 + (s('tkl') - 2.2) / 2;
    else if (x.pos === 'LB') z = (s('tkl') - 4.8) / 2.5 + (s('sack') - 0.37) / 0.6 + (s('int') - 0.08) / 0.4;
    else if (x.pos === 'CB') z = (s('int') - 0.09) / 0.4 + (s('tkl') - 2.2) / 2;
    else if (x.pos === 'S') z = (s('int') - 0.08) / 0.4 + (s('tkl') - 3.5) / 2.2;
    else return null; // linemen (no stat line) and kickers: offseason only
    return clamp((z + s('blk') * 1.5) / 1.4, -2.5, 2.5);
  },
  // how far up a player can climb in one season: young guys and high-potential rookies more, stars and vets less
  upRoom(p, f) {
    const m = p[6] || {}, fa = typeof footballAge === 'function' ? footballAge(p[0], m.age || 27) : 27;
    let r = m.rookie ? ({ A: 4, B: 3, C: 2 }[m.pot] || 3) : fa <= 24 ? 4 : fa <= 27 ? 3 : fa <= 30 ? 2 : 1;
    if (f.base >= 93) r = Math.min(r, 1); else if (f.base >= 89) r = Math.min(r, 2);
    return Math.min(r, FORM_CAP, 99 - f.base);
  },
  fm(p) { const d = Season.data, m = p[6] || (p[6] = {}); if (!m.fm || m.fm.y !== d.year) m.fm = { y: d.year, h: 0, n: 0, d: 0, s: 0, base: p[3] }; return m.fm; },
  // this season's net change (0 for last year's numbers)
  delta(p) { const f = p && p[6] && p[6].fm; return f && Season.data && f.y === Season.data.year ? f.d || 0 : 0; },
  heat(p) { const f = p && p[6] && p[6].fm; return f && Season.data && f.y === Season.data.year ? f.h || 0 : 0; },

  // after every regular-season week
  week(pre, wk, post) {
    const d = Season.data, lines = this.diff(pre, post), ix = this.index(), me = d.team;
    // the game you played: different quarter lengths mean different stat totals, so scale it to a normal game
    const played = Season._wkPlayed;
    for (const x of lines) x.raw = Object.assign({}, x);
    if (played) {
      const mine = lines.filter(x => played.includes(x.t)), tot = mine.reduce((a, x) => a + x.pass + x.rush, 0);
      if (tot > 0) { const f = clamp(tot / 670, 0.5, 2.2); for (const x of mine) for (const s of FORM_KEYS) x[s] /= f; }
    }
    // who won (POTW leans to winners)
    const won = new Set(); for (const g of d.weeks[wk] || []) if (g.score) { if (g.score[0] > g.score[1]) won.add(g.home); else if (g.score[1] > g.score[0]) won.add(g.away); }
    const moves = [];
    // keep about as many risers as fallers around the league: if one side is running ahead, its line moves a little further out
    const N = d.formN && d.formN.y === d.year ? d.formN : (d.formN = { y: d.year, u: 0, d: 0 }), bias = clamp((N.u - N.d) / 30, -0.6, 0.6);
    for (const x of lines) {
      const e = ix.find(x.t, x.name, x.pos); x.e = e; if (!e || (e.p[6] && e.p[6].cap)) continue;
      const p = e.p, g0 = this.grade(x, p[3]), g1 = x.tw ? this.grade({ ...x, pos: x.tw }, p[3]) : null; // two-way: his better side
      const g = g1 == null ? g0 : g0 == null ? g1 : Math.max(g0, g1); if (g == null) continue;
      const f = this.fm(p);
      f.h = Math.round((f.h * FORM_DECAY + g) * 100) / 100; f.n++;
      f.s = g >= 0.6 ? Math.max(0, f.s || 0) + 1 : g <= -0.6 ? Math.min(0, f.s || 0) - 1 : 0;
      let mv = 0;
      if (f.n >= FORM_MIN_GAMES && f.h >= FORM_HOT + bias && f.d < this.upRoom(p, f) && p[3] < 99) mv = 1;
      else if (f.n >= FORM_MIN_GAMES && f.h <= (FORM_COLD[x.pos] || -FORM_HOT) + bias && f.d > -FORM_CAP && p[3] > 50) mv = -1;
      if (!mv) continue;
      const from = p[3]; p[3] = clamp(p[3] + mv, 40, 99); f.d += mv; f.h = 0; if (mv > 0) N.u++; else N.d++;
      moves.push({ y: d.year, wk, t: e.id, name: p[1], pos: p[0], from, to: p[3], s: f.s });
    }
    if (moves.length) {
      d.formLog = moves.concat(d.formLog || []).slice(0, 60);
      for (const m of moves) if (m.t === me) {
        const why = m.to > m.from ? (m.s >= 2 ? `${m.s} big games in a row` : 'a hot stretch') : (m.s <= -2 ? `${-m.s} rough games in a row` : 'a cold stretch');
        Season.wkNews(`${m.to > m.from ? 'RATING UP' : 'RATING DOWN'}: ${m.pos} ${m.name} goes ${m.from} to ${m.to} after ${why}`, wk);
      }
    }
    // CPU coaches start whoever is better now (your depth chart is yours to set)
    for (const id of new Set(moves.map(m => m.t))) if (id !== me && Season.setLineup) Season.setLineup(id);
    this.potw(lines, wk, won);
  },

  // ---- Players of the Week ----
  offScore: x => x.pass / 25 + (x.rush + x.rec) / 10 + x.td * 6,
  defScore: x => x.tkl + x.sack * 4 + x.int * 6 + (x.blk || 0) * 5,
  statLine(x) {
    const b = [], s = k => Math.round(x[k] || 0);
    if (s('pass')) b.push(`${s('pass')} pass yds`); if (s('rush')) b.push(`${s('rush')} rush yds`); if (s('rec')) b.push(`${s('rec')} rec yds`); if (s('td')) b.push(`${s('td')} TD`);
    if (s('tkl')) b.push(`${s('tkl')} tkl`); if (s('sack')) b.push(`${s('sack')} sack${s('sack') === 1 ? '' : 's'}`); if (s('int')) b.push(`${s('int')} INT`); if (s('blk')) b.push(`${s('blk')} blocked kick${s('blk') === 1 ? '' : 's'}`);
    return b.join(', ');
  },
  potw(lines, wk, won) {
    const d = Season.data, best = (list, f) => list.reduce((a, x) => { const v = f(x) + (won.has(x.t) ? 3 : 0); return !a || v > a.v ? { x, v } : a; }, null);
    const pack = b => b && b.v > 4 ? { t: b.x.e ? b.x.e.id : b.x.t, name: b.x.name, pos: b.x.pos, line: this.statLine(b.x.raw) } : null;
    const off = best(lines.filter(x => FORM_OFF.includes(x.pos) || FORM_OFF.includes(x.tw)), this.offScore), def = best(lines.filter(x => FORM_DEF.includes(x.pos) || FORM_DEF.includes(x.tw)), this.defScore);
    const rookies = lines.filter(x => x.e && x.e.p[6] && x.e.p[6].rookie);
    const rook = best(rookies, x => (this.grade(x, x.e.p[3]) || 0) * 8 + (FORM_OFF.includes(x.pos) ? this.offScore(x) : this.defScore(x)) * 0.3); // how far over his usual game he went, so it isn't always a QB
    const w = { y: d.year, wk, off: pack(off), def: pack(def), rook: pack(rook) };
    if (w.rook && ((w.off && w.rook.name === w.off.name) || (w.def && w.rook.name === w.def.name))) w.rook.also = true;
    d.potw = (d.potw || []).concat([w]).slice(-40);
    const tx = a => `${a.pos} ${a.name} (${a.t}): ${a.line}`;
    if (w.off || w.def) Season.wkNews(`PLAYERS OF THE WEEK: ${[w.off && 'offense ' + tx(w.off), w.def && 'defense ' + tx(w.def)].filter(Boolean).join('. ')}`, wk);
  },
  thisYear(list) { const d = Season.data; return (list || []).filter(w => w.y === d.year); },
  // POTW count for a player this season
  potwCount(t, name) { return this.thisYear(Season.data.potw).reduce((a, w) => a + ['off', 'def', 'rook'].filter(k => w[k] && w[k].name === name && w[k].t === t && !(k === 'rook' && w[k].also)).length, 0); }
};

// ---- Pro Bowl: fans vote from mid-season on, rosters come out when the regular season ends ----
const ProBowl = {
  openWeek() { const g = Season.data.games; return Math.max(2, Math.floor(g * 0.45)); }, // weeks played before the ballot opens
  announced() { const d = Season.data; return !!(d && d.probowl && d.probowl.y === d.year); },
  open() { const d = Season.data; return !!d && d.phase === 'regular' && d.week >= this.openWeek() && !this.announced() && !(Season.isCareer && Season.isCareer()); },
  ballot() { const d = Season.data; if (!d.prbVote || d.prbVote.y !== d.year) d.prbVote = { y: d.year, picks: {}, done: false }; return d.prbVote; },
  // everyone's season so far (a traded player's lines add up), on his team now
  pool() {
    const d = Season.data, R = Season.ensureRosters(), agg = new Map();
    for (const l of Object.values(d.stats || {})) {
      const k = l.name + '|' + l.pos, a = agg.get(k) || { g: 0 }; agg.set(k, a);
      a.g += l.g || 0; for (const s of FORM_KEYS) a[s] = (a[s] || 0) + (l[s] || 0);
    }
    const out = {}; for (const pos of PB_POS) out[pos] = [];
    for (const id in R) {
      const conf = Season.team(id).conf, pct = Season.pct(id);
      R[id].off.concat(R[id].def, R[id].bench || []).forEach((p, i) => {
        if (!p || !out[p[0]]) return;
        const st = agg.get(p[1] + '|' + p[0]) || { g: 0 }, starter = i < 16;
        if (!starter && !(st.g >= 2)) return;
        if (p[0] === 'OL' && !starter) return;
        out[p[0]].push({ key: id + ':' + p[1], t: id, conf, name: p[1], pos: p[0], p, st, pct, raw: this.statScore(p[0], st, p, pct) });
      });
    }
    for (const pos of PB_POS) {
      const L = out[pos], mx = Math.max(1, ...L.map(c => c.raw));
      for (const c of L) c.score = 0.6 * c.raw / mx + 0.25 * clamp((c.p[3] - 60) / 39, 0, 1) + 0.15 * c.pct;
      L.sort((a, b) => b.score - a.score);
    }
    return out;
  },
  statScore(pos, s, p, pct) {
    const v = k => s[k] || 0, blk = v('blk') * 5;
    if (pos === 'QB') return Math.max(0, v('pass') / 25 + v('td') * 4 + v('rush') / 10);
    if (pos === 'RB') return v('rush') / 10 + v('rec') / 10 + v('td') * 6;
    if (pos === 'WR' || pos === 'TE') return v('rec') / 10 + v('td') * 6 + blk;
    if (pos === 'OL') return Math.max(1, (p[3] - 60) * 3 + pct * 30);
    if (pos === 'DL') return v('sack') * 5 + v('tkl') + blk;
    if (pos === 'LB') return v('tkl') + v('sack') * 5 + v('int') * 6 + blk;
    return v('int') * 7 + v('tkl') + blk; // CB, S
  },
  keyStat(c) {
    const s = c.st, v = k => s[k] || 0;
    if (c.pos === 'QB') return `${v('pass')} YDS · ${v('td')} TD`;
    if (c.pos === 'RB') return `${v('rush') + v('rec')} YDS · ${v('td')} TD`;
    if (c.pos === 'WR' || c.pos === 'TE') return `${v('rec')} YDS · ${v('td')} TD`;
    if (c.pos === 'OL') return `${recStr(c.t)} TEAM`;
    if (c.pos === 'DL') return `${v('sack')} SACKS · ${v('tkl')} TKL`;
    if (c.pos === 'LB') return `${v('tkl')} TKL · ${v('sack')} SACKS`;
    return `${v('int')} INT · ${v('tkl')} TKL`;
  },
  // ballot: the top 6 at each spot, plus your best guy if he's not already on it
  candidates(pool, pos) {
    const me = Season.data.team, L = (pool || this.pool())[pos] || [], top = L.slice(0, 6);
    const mine = L.find(c => c.t === me); if (mine && !top.includes(mine)) top.push(mine);
    return top;
  },
  vote(pos, key) { const b = this.ballot(); if (b.done) return; if (b.picks[pos] === key) delete b.picks[pos]; else b.picks[pos] = key; Season.save(); },
  submit() { const b = this.ballot(); b.done = true; Season.save(); },
  // the rosters: stats + rating + team record, your votes count as a big chunk of the fan vote
  announce() {
    const d = Season.data; if (!d || this.announced() || (Season.isCareer && Season.isCareer())) return;
    const pool = this.pool(), b = d.prbVote && d.prbVote.y === d.year ? d.prbVote : { picks: {} }, list = [];
    for (const pos of PB_POS) for (const conf of ['AFC', 'NFC']) {
      pool[pos].filter(c => c.conf === conf).map(c => ({ c, s: c.score + (b.picks[pos] === c.key ? 0.15 : 0) })).sort((x, y) => y.s - x.s).slice(0, PB_SPOTS[pos])
        .forEach(({ c }) => {
          list.push({ t: c.t, conf, name: c.name, pos, ovr: c.p[3], stat: this.keyStat(c), voted: b.picks[pos] === c.key });
          const m = c.p[6] || (c.p[6] = {}); m.pb = (m.pb || []).filter(y => y !== d.year).concat([d.year]);
        });
    }
    d.probowl = { y: d.year, list };
    const mine = list.filter(x => x.t === d.team), wk = Math.max(0, d.games - 1);
    Season.wkNews(`PRO BOWL: the rosters are out. ${mine.length ? `${mine.length} of your players made it: ${mine.map(x => `${x.pos} ${x.name}`).join(', ')}` : 'None of your players made it this year.'}`, wk);
    const yv = list.filter(x => x.voted).length; if (yv) Season.wkNews(`PRO BOWL: ${yv} of the players you voted for made the team.`, wk);
  },
  isPro(p) { const d = Season.data; return !!(d && p && p[6] && p[6].pb && p[6].pb.includes(d.year)); },
  count(p) { return (p && p[6] && p[6].pb || []).length; }
};

// ---------------- hooks ----------------
// stats before the week starts (your game is added before finishWeek runs, a simmed game of yours too)
{ const _ap = Season.addPlayedStats; Season.addPlayedStats = function (ps, teams) {
  const reg = Form.live() && this.data.phase === 'regular';
  if (reg && !this._wkPre) this._wkPre = Form.snap();
  // blocked kicks: count them if the game tracks them and the base code doesn't already
  const blk = []; for (const s of Object.values(ps || {})) { const t = teams && teams[s.side]; if (t && s.blk) { const l = this.line(t.id, [s.pos, s.name]); blk.push([l, l.blk || 0, s.blk]); } }
  _ap.call(this, ps, teams);
  for (const [l, b, n] of blk) if ((l.blk || 0) === b) l.blk = b + n;
  if (reg) this._wkPlayed = (teams || []).map(t => t && t.id);
}; }
{ const _ss = Season.simScore; Season.simScore = function (h, a) {
  if (Form.live() && this.data.phase === 'regular' && !this._wkPre) this._wkPre = Form.snap();
  return _ss.call(this, h, a);
}; }
{ const _ld = Season.load; Season.load = function () { this._wkPre = this._wkPlayed = null; return _ld.call(this); }; }
{ const _st = Season.start; Season.start = function (...a) { this._wkPre = this._wkPlayed = null; return _st.apply(this, a); }; }
{ const _fw = Season.finishWeek; Season.finishWeek = function (s) {
  const d = this.data;
  if (!Form.live() || d.phase !== 'regular') { this._wkPre = this._wkPlayed = null; return _fw.call(this, s); }
  const wk = d.week, pre = this._wkPre || Form.snap(); this._wkPre = pre;
  this._wkPost = null;
  _fw.call(this, s);
  try { Form.week(pre, wk, this._wkPost); } catch (e) { console.warn('form', e); }
  this._wkPre = this._wkPlayed = this._wkPost = null;
  const D = this.data;
  if (D.phase === 'regular' && D.week === ProBowl.openWeek()) this.wkNews('PRO BOWL VOTING IS OPEN: cast your ballot from the season screen.', wk);
  this.save();
}; }
// the regular season is over: freeze this week's stats before any playoff game is simmed, then name the Pro Bowl (regular season stats only)
{ const _sp = Season.startPlayoffs; Season.startPlayoffs = function () {
  if (Form.live()) { if (this._wkPre) this._wkPost = Form.snap(); try { ProBowl.announce(); } catch (e) { console.warn('probowl', e); } }
  return _sp.call(this);
}; }
// the offseason already rewards a big year (aging.js bigYear): take off what he already got during the season
{ const _by = Season.bigYear; Season.bigYear = function (p) {
  const b = _by.call(this, p), f = p && p[6] && p[6].fm;
  if (!f || f.y !== this.data.year || !f.d) return b;
  if (f.d > 0 && b > 0) return Math.max(0, b - f.d);
  if (f.d < 0 && b < 0) return Math.min(0, b - f.d);
  return b;
}; }
