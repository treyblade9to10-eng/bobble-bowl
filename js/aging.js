// ---- Franchise aging: real ages, young guys grow, vets decline + retire, big seasons pay off, old stars lose their X-Factor ----
// a player's age lives in his tuple's info slot: p[6].age (only in franchise rosters)
const AGE_PEAK = { QB: 4, OL: 1, RB: -1 }; // QBs age slower, running backs faster
const XF_MAX_AGE = 33;                         // at this "football age" a star can't be an X-Factor anymore (QBs: 37)
const footballAge = (pos, age) => age - (AGE_PEAK[pos] || 0);
const xfTooOld = t => !!(t[6] && t[6].age && footballAge(t[0], t[6].age) >= XF_MAX_AGE);
function ageOf(teamId, p) {
  if (p[6] && p[6].age) return p[6].age;
  const a = typeof AGES !== 'undefined' && AGES[teamId] && AGES[teamId][p[2]];
  return a || 23 + (hashStr(p[1] || 'x') % 8); // made-up backups: 23-30
}
// how much a player's rating moves in one offseason from age alone
function ageCurve(fa) {
  if (fa <= 22) return 3; if (fa <= 23) return 2.5; if (fa <= 24) return 2; if (fa <= 25) return 1.2; if (fa <= 26) return 0.6; if (fa <= 27) return 0.2;
  if (fa <= 28) return -0.3; if (fa <= 29) return -0.9; if (fa <= 30) return -1.6; if (fa <= 31) return -2.4; if (fa <= 32) return -3.2; if (fa <= 33) return -4; if (fa <= 34) return -5; return -6;
}

Object.assign(Season, {
  ensureAges() {
    const R = this.ensureRosters();
    for (const id in R) for (const grp of ['off', 'def', 'bench']) (R[id][grp] || []).forEach(p => { if (p && !(p[6] && p[6].age)) p[6] = Object.assign({}, p[6] || {}, { age: ageOf(id, p) }); });
  },
  // a great season = a bigger jump. Rates are per 17 games so short seasons count the same
  bigYear(p) {
    const ls = Object.values(this.data.stats || {}).filter(l => l.name === p[1] && l.pos === p[0]);
    const g = ls.reduce((a, l) => a + l.g, 0); if (g < 3) return 0;
    const s = k => ls.reduce((a, l) => a + (l[k] || 0), 0) / g * 17;
    let b = 0;
    if (p[0] === 'QB') b = (s('pass') - 3400) / 600 + (s('td') - 22) / 7;
    else if (p[0] === 'RB') b = (s('rush') + s('rec') - 1100) / 300 + (s('td') - 8) / 4;
    else if (p[0] === 'WR' || p[0] === 'TE') b = (s('rec') - 750) / 250 + (s('td') - 5) / 3;
    else if (p[0] === 'DL') b = (s('sack') - 5) / 2.5 + (s('tkl') - 40) / 30;
    else if (p[0] === 'LB') b = (s('tkl') - 90) / 25 + s('sack') / 4 + s('int') * 0.8;
    else if (p[0] === 'CB' || p[0] === 'S') b = (s('int') - 1.5) * 1.1 + (s('tkl') - 55) / 30;
    return clamp(b, -1, 4);
  },
  // the yearly offseason: returns what happened to YOUR guys
  develop() {
    this.ensureAges();
    const R = this.ensureRosters(), d = this.data, mine = [];
    const award = new Set((d.awards || []).map(a => a.team + ':' + a.name));
    const xfBefore = new Set(teamXFactors(this.team(d.team)).map(x => x.name));
    // pass 1: everyone's raw change. Then shift the whole league so the average rating stays put (no 99s everywhere after 5 years)
    const raw = new Map(); let sum = 0, n = 0;
    for (const id in R) for (const grp of ['off', 'def', 'bench']) (R[id][grp] || []).forEach(p => {
      if (!p) return;
      const m = p[6] = Object.assign({}, p[6] || {}); if (m.cap) return;
      const big = this.bigYear(p), pot = m.rookie ? ({ A: 1.5, B: 0.5, C: 0 }[m.pot] || 0) : 0;
      const dv = ageCurve(footballAge(p[0], m.age)) + rand(-1.8, 1.8) + big + pot + (award.has(id + ':' + p[1]) ? 1.5 : 0) + (p[3] < 68 ? 0.8 : 0) - (p[3] >= 88 ? (p[3] - 87) * 0.6 : 0);
      raw.set(p, { dv, big }); if (grp !== 'bench') { sum += dv; n++; }
    });
    const drift = n ? sum / n + 0.3 : 0; // starters slip a bit on average; the best backups + rookies moving up even it out
    for (const id in R) {
      for (const grp of ['off', 'def', 'bench']) (R[id][grp] || []).forEach((p, i, arr) => {
        if (!p || !raw.has(p)) return;
        const m = p[6], fa = footballAge(p[0], m.age), from = p[3], { dv, big } = raw.get(p);
        p[3] = clamp(Math.round(p[3] + dv - drift), 50, 99);
        p[4] = clamp(Math.round(p[4] + (fa >= 29 ? -rand(0.8, 2.2) - (fa - 29) * 0.35 : fa <= 24 ? rand(0, 1.2) : rand(-1, 0.6))), 50, 99);
        m.age++;
        if (m.rookie && m.rookie < d.year) delete m.rookie;
        // retirement: old, or old and fading
        const oa = footballAge(p[0], m.age), retire = (oa >= 35 && chance(oa >= 37 ? 0.85 : 0.45)) || (oa >= 33 && p[3] < 70 && chance(0.6));
        const row = id === d.team ? { name: p[1], pos: p[0], from, to: p[3], age: m.age, big: big >= 1.2 } : null;
        if (retire) {
          if (row) { row.retired = true; row.to = from; }
          if (id === d.team || p[3] >= 85) this.news(`RETIRED: ${tName(id)} ${p[0]} ${p[1]} calls it a career at ${m.age}`);
          arr[i] = null;
        }
        if (row) mine.push(row);
      });
      if (R[id].bench) { const keep = R[id].bench.filter(Boolean); R[id].bench.splice(0, R[id].bench.length, ...keep); } // in place: trades.js holds on to this array across the new year
      // fill any hole a retirement left: best backup steps in, or a young free agent gets signed
      for (const side of ['off', 'def']) R[id][side].forEach((p, i) => {
        if (p) return;
        const pos = TEAMS.find(t => t.id === id)[side][i][0], bench = R[id].bench;
        let bi = -1; bench.forEach((b, j) => { if (posGroup(b[0]) === posGroup(pos) && (bi < 0 || b[3] > bench[bi][3])) bi = j; });
        if (bi >= 0) R[id][side][i] = bench.splice(bi, 1)[0];
        else { const [s0, s1] = ROOKIE_SPD[pos] || [75, 88]; R[id][side][i] = [pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), Math.round(rand(64, 71)), Math.round(rand(s0, s1)), Math.floor(Math.random() * 6), { age: Math.round(rand(23, 26)) }]; }
      });
      if (this.setLineup) this.setLineup(id);
    }
    // X-Factors you gained or lost
    const xfAfter = new Set(teamXFactors(this.team(d.team)).map(x => x.name));
    for (const r of mine) { if (xfBefore.has(r.name) && !xfAfter.has(r.name) && !r.retired) r.xfLost = true; if (!xfBefore.has(r.name) && xfAfter.has(r.name)) r.xfNew = true; }
    return mine.sort((a, b) => (b.retired ? -1 : 0) - (a.retired ? -1 : 0) || (b.to - b.from) - (a.to - a.from));
  }
});
// rosters get ages the moment a franchise starts using them
{ const _ens = Season.ensureRosters.bind(Season); let busy = false;
  Season.ensureRosters = function () { const R = _ens(); if (!busy) { busy = true; try { this.ensureAges(); } finally { busy = false; } } return R; }; }
