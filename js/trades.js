// ---- Trade center: players + draft picks (7 rounds, this year and 3 more), trade value meter, "what would it take", shopping players, CPU offers ----
// Player keys: 'off:3' / 'def:5' (starters), 'bench:2'. Pick keys: 'pick:2028:DAL:1' = the 2028 1st round pick that started out as DAL's.
// Who owns what: d.picks[year][team] = [owner of round 1, ..., owner of round 7]
const MAX_ASSETS = 6, BENCH_MAX = 14, ROUNDS = 7, PICK_YEARS = 4;
const BACKUP_POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];
const RD_NAME = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
const POS_TV = { QB: 1.35, DL: 1.15, CB: 1.08, WR: 1.08, OL: 1, LB: 0.92, S: 0.9, TE: 0.9, RB: 0.82 }; // how much teams care about each spot in a trade
const posGroup = p => p === 'TE' ? 'WR' : p; // tight ends and receivers can cover for each other
const tName = id => (TEAMS.find(t => t.id === id) || { name: id }).name; // 'Saints', not 'NO'

Object.assign(Season, {
  // every team gets a bench of backups (one at each spot) the first time we need it:
  // the real ones off its depth chart (teams.js qb2 + rb2 + bench), made-up guys only for teams without them (custom teams).
  // Saves that already have a bench keep it.
  realBench(id) {
    const t = TEAMS.find(x => x.id === id);
    if (!t || !Array.isArray(t.bench)) return null;
    const out = [t.qb2, t.rb2, ...t.bench].filter(p => Array.isArray(p) && p[0] && p[1]).map(p => { const q = p.slice(0, 6); if (q[5] == null) q[5] = 3; if (p[6]) q[6] = JSON.parse(JSON.stringify(p[6])); return q; }); // edited age / ratings come along
    for (const pos of BACKUP_POS) if (!out.some(p => p[0] === pos)) out.push(this.fakeBackup(pos)); // a spot with no real backup
    return out;
  },
  fakeBackup(pos) { const [s0, s1] = ROOKIE_SPD[pos]; return [pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), Math.round(rand(60, 71)), Math.round(rand(s0, s1) - 3), Math.floor(Math.random() * 6)]; },
  bench(id) {
    const R = this.ensureRosters()[id];
    if (!R.bench) R.bench = this.realBench(id) || BACKUP_POS.map(pos => this.fakeBackup(pos));
    return R.bench;
  },

  // ---------- draft picks ----------
  // builds the pick table (and fills in years/rounds older saves don't have: they only tracked 1st rounders)
  ensurePicks() {
    const d = this.data, P = d.picks || (d.picks = {}), y0 = this.draftYear(), ids = TEAMS.map(t => t.id);
    for (const y in P) if (+y < y0) delete P[y];
    for (let y = y0; y < y0 + PICK_YEARS; y++) { const Y = P[y] || (P[y] = {}); for (const id of ids) { const a = Y[id] || (Y[id] = []); while (a.length < ROUNDS) a.push(id); } }
    if (d.pickOwner) { for (const id in d.pickOwner) if (P[y0][id]) P[y0][id][0] = d.pickOwner[id]; delete d.pickOwner; }      // this year's 1st (old saves)
    if (d.futureOwe) { for (const id in d.futureOwe) if (P[y0 + 1][id]) P[y0 + 1][id][0] = d.futureOwe[id]; delete d.futureOwe; } // next year's 1st (old saves)
    return P;
  },
  pickKey(y, from, r) { return `pick:${y}:${from}:${r}`; },
  parsePick(key) { const s = key.split(':'); return s.length < 4 ? { y: this.draftYear(), from: s[1], r: 1 } : { y: +s[1], from: s[2], r: +s[3] }; }, // 'pick:DAL' = old saves
  pickOwnerOf(pk) { const Y = this.ensurePicks()[pk.y], a = Y && Y[pk.from]; return a ? a[pk.r - 1] : null; },
  movePick(pk, to) {
    const Y = this.ensurePicks()[pk.y]; if (Y && Y[pk.from]) Y[pk.from][pk.r - 1] = to;
    const dr = this.data.draft; // a draft that's going on right now
    if (dr && dr.year === pk.y && dr.via) for (let i = dr.i; i < dr.order.length; i++) if (dr.via[i] === pk.from && (dr.rd ? dr.rd[i] : 1) === pk.r) dr.order[i] = to;
  },
  // every pick a team owns, this year first, 1st rounders first
  picksOf(id) {
    const P = this.ensurePicks(), out = [];
    for (const y of Object.keys(P).map(Number).sort((a, b) => a - b)) for (const from of TEAMS.map(t => t.id)) (P[y][from] || []).forEach((o, i) => { if (o === id) out.push({ y, from, r: i + 1 }); });
    return out.sort((a, b) => a.y - b.y || a.r - b.r || this.pickNum(a) - this.pickNum(b));
  },
  pickName(pk) { return `${pk.y} ${RD_NAME[pk.r - 1]} (${pk.from})`; },
  // where a team is projected to pick (worst record = #1)
  pickSlot(id) {
    const ids = TEAMS.map(t => t.id).sort((a, b) => this.pct(a) - this.pct(b) || this.ovr(a) - this.ovr(b));
    return ids.indexOf(id) + 1;
  },
  // projected overall pick number: this year from the standings, later years drift toward the middle (nobody knows yet)
  pickNum(pk) {
    const n = TEAMS.length, y0 = this.draftYear(), dr = this.data.draft;
    if (dr && dr.year === pk.y && dr.via) { const i = dr.via.findIndex((v, j) => v === pk.from && (dr.rd ? dr.rd[j] : 1) === pk.r); if (i >= 0) return i + 1; }
    const s = this.pickSlot(pk.from), out = pk.y - y0, mid = (n + 1) / 2;
    return (pk.r - 1) * n + Math.round(out <= 0 ? s : mid + (s - mid) * (out === 1 ? 0.5 : 0.25));
  },
  // what a pick is worth by overall number: #1 ~ a 90 OVR player, late 1st ~ a 78, 7th rounders next to nothing
  pickCurve(n) { return 4 + 340 * Math.exp(-(n - 1) / 38); },
  pickValue(pk, id) {
    const m = id ? this.teamMode(id) : 'mid';
    return this.pickCurve(this.pickNum(pk)) * Math.pow(0.93, Math.max(0, pk.y - this.draftYear())) * (m === 'rebuild' ? 1.2 : m === 'win' ? 0.85 : 1);
  },

  // ---------- assets ----------
  assets(id) {
    const R = this.ensureRosters()[id], out = [];
    for (const side of ['off', 'def']) R[side].forEach((p, i) => { if (p) out.push({ key: `${side}:${i}`, p, starter: true }); });
    this.bench(id).forEach((p, i) => { if (p) out.push({ key: `bench:${i}`, p, starter: false }); });
    for (const pk of this.picksOf(id)) out.push({ key: this.pickKey(pk.y, pk.from, pk.r), pick: pk.from, pk });
    return out;
  },
  asset(id, key) {
    const [k, v] = key.split(':'), R = this.ensureRosters()[id];
    if (k === 'pick') { const pk = this.parsePick(key); return this.pickOwnerOf(pk) === id ? { key: this.pickKey(pk.y, pk.from, pk.r), pick: pk.from, pk } : null; }
    const p = k === 'bench' ? this.bench(id)[+v] : R[k] && R[k][+v];
    return p ? { key, p, starter: k !== 'bench' } : null;
  },
  assetName(a) { return !a ? '?' : a.pk ? this.pickName(a.pk) : `${a.p[0]} ${a.p[1]} (${a.p[3]})`; },

  // ---------- what teams think things are worth ----------
  // contender ('win'), middle ('mid') or rebuilding ('rebuild'): from the record once games are played, roster rating before that
  teamMode(id) {
    const d = this.data, key = `${d.year}:${d.week}:${d.phase}:${(d.trades || []).length}`;
    if (!this._modes || this._modes.key !== key) {
      const pw = x => typeof LeagueTrades !== 'undefined' ? LeagueTrades.power(x) : this.ovr(x);
      const ids = TEAMS.map(t => t.id).sort((a, b) => pw(b) - pw(a)), m = {};
      ids.forEach((x, i) => m[x] = i < 10 ? 'win' : i >= ids.length - 10 ? 'rebuild' : 'mid');
      this._modes = { key, m };
    }
    return this._modes.m[id] || 'mid';
  },
  // a player's trade value to a team: rating, position, age, contract and what the team is trying to do
  playerValue(id, p) {
    const m = p[6] || {}, fa = typeof footballAge === 'function' ? footballAge(p[0], m.age || 27) : 27, mode = this.teamMode(id);
    let v = this.value(p) * (POS_TV[p[0]] || 1);
    v *= fa <= 23 ? 1.15 : fa <= 25 ? 1.1 : fa <= 28 ? 1 : fa <= 29 ? 0.92 : fa <= 30 ? 0.82 : fa <= 31 ? 0.7 : fa <= 32 ? 0.58 : 0.45;
    if (m.rookie && m.pot) v *= { A: 1.15, B: 1.05 }[m.pot] || 1;
    const c = m.con; // cheap deals for good players are worth more, big deals for so-so players less
    if (c && c.sal && typeof Contracts !== 'undefined') { const mk = Contracts.value(p); v *= clamp(1 + (mk - c.sal) / (mk + 8) * 0.3 * Math.min(c.yrs || 1, 3) / 2, 0.75, 1.25); }
    if (mode === 'rebuild') v *= fa >= 29 ? 0.8 : fa <= 25 ? 1.1 : 1;       // rebuilding: young guys, not vets
    else if (mode === 'win') v *= (p[3] >= 84 ? 1.1 : 1) * (fa >= 30 ? 1.1 : 1); // contenders want stars now
    if (m.inj > 0) v *= m.inj > 4 ? 0.6 : 0.85;
    return v;
  },
  // the weakest starter at this player's position on a team (who he'd replace)
  weakestAt(id, pos) {
    const R = this.ensureRosters()[id]; let w = null;
    for (const side of ['off', 'def']) for (const p of R[side]) if (p && posGroup(p[0]) === posGroup(pos) && (!w || p[3] < w[3])) w = p;
    return w;
  },
  // how much a team values an asset (getting it or giving it up)
  worth(id, a, getting) {
    if (!a) return 0;
    if (a.pk) return this.pickValue(a.pk, id);
    let v = this.playerValue(id, a.p);
    if (getting) { const w = this.weakestAt(id, a.p[0]); if (!w || a.p[3] <= w[3]) v *= this.teamMode(id) === 'rebuild' && footballAge(a.p[0], (a.p[6] && a.p[6].age) || 27) <= 24 ? 0.75 : 0.55; } // would just sit on the bench
    else { if (!a.starter) v *= 0.6; if (a.p[3] >= 90) v *= 1.12; if (a.starter && this.teamMode(id) === 'win') v *= 1.08; } // stars cost extra
    return v;
  },
  // what a pile of stuff is worth to the team getting it: the best piece counts fully, every extra player takes a roster spot,
  // and small pieces don't add up to a star (no ten backups for one superstar)
  pkgWorth(vals, star) {
    return vals.slice().sort((a, b) => b.v - a.v).reduce((s, x, i) => s + x.v * (x.pl && i > 0 ? Math.max(0.6, 1 - 0.1 * i) : 1) * (star && x.v < star * 0.2 ? 0.6 : 1), 0);
  },
  oddsFrom(getVals, giveVals) {
    if (!giveVals.length) return getVals.length ? 100 : 0;
    const theyGive = giveVals.reduce((s, x) => s + x.v, 0), star = Math.max(...giveVals.map(x => x.v));
    return clamp(Math.round(80 + (this.pkgWorth(getVals, star) - theyGive) / Math.max(1, theyGive) * 160), 0, 100);
  },
  vals(id, from, keys, getting) { return keys.map(k => { const a = this.asset(from, k); return { v: this.worth(id, a, getting), pl: !!(a && a.p) }; }); },
  // chance the CPU team says yes (they need 80%)
  dealOdds(other, give, get) {
    const me = this.data.team;
    return this.oddsFrom(this.vals(other, me, give, true), this.vals(other, other, get, false));
  },
  // can both teams still fill every starting spot after the deal?
  rosterProblem(me, other, give, get) {
    for (const [id, out, inn] of [[me, give, get], [other, get, give]]) {
      const R = this.ensureRosters()[id], left = [];
      const outKeys = new Set(out);
      for (const side of ['off', 'def']) R[side].forEach((p, i) => { if (p && !outKeys.has(`${side}:${i}`)) left.push(p); });
      this.bench(id).forEach((p, i) => { if (p && !outKeys.has(`bench:${i}`)) left.push(p); });
      const fromId = id === me ? other : me;
      for (const k of inn) { const a = this.asset(fromId, k); if (a && a.p) left.push(a.p); }
      const need = {}; for (const side of ['off', 'def']) for (const p of R[side]) if (p) need[posGroup(p[0])] = (need[posGroup(p[0])] || 0) + 1;
      const have = {}; for (const p of left) have[posGroup(p[0])] = (have[posGroup(p[0])] || 0) + 1;
      for (const g in need) if ((have[g] || 0) < need[g]) return { team: id, pos: g };
    }
    return null;
  },
  // salary cap: nobody can end up over the cap by taking on more money than they send out
  capProblem(a, b, ka, kb) {
    if (typeof Contracts === 'undefined' || !this.data.rosters || !Contracts.all(a).some(p => Contracts.con(p))) return null;
    const sal = (id, keys) => keys.reduce((t, k) => { const x = this.asset(id, k); return t + (x && x.p ? ((Contracts.con(x.p) || {}).sal || 0) : 0); }, 0);
    const outA = sal(a, ka), outB = sal(b, kb);
    for (const [id, out, inn] of [[a, outA, outB], [b, outB, outA]]) { const room = Contracts.room(id); if (inn > out && room + out - inn < 0) return { team: id, over: Math.round((inn - out - room) * 10) / 10 }; }
    return null;
  },
  dealProblem(other, give, get) {
    const me = this.data.team, r = this.rosterProblem(me, other, give, get);
    if (r) return `${r.team === me ? 'You' : 'The ' + tName(r.team)} would have no ${r.pos} left to start. Add one back.`;
    const c = this.capProblem(me, other, give, get);
    if (c) return `${c.team === me ? 'You' : 'The ' + tName(c.team)} would be ${cmoney(c.over)} over the salary cap.`;
    return null;
  },

  // ---------- making deals ----------
  // move everything between two teams (picks change owners), then each team starts its best player at every spot
  moveAssets(a, b, ka, kb) {
    const R = this.ensureRosters();
    const pull = (id, to, keys) => {
      const got = [], picks = [];
      for (const k of keys) if (k.startsWith('pick:')) { const pk = this.parsePick(k); this.movePick(pk, to); picks.push(this.pickName(pk)); }
      for (const k of keys) if (!k.startsWith('pick:')) { const [g, v] = k.split(':'), arr = g === 'bench' ? this.bench(id) : R[id][g]; if (arr[+v]) got.push(arr[+v]); arr[+v] = null; }
      const bn = this.bench(id); bn.splice(0, bn.length, ...bn.filter(Boolean));
      for (const p of got) if (p[6]) delete p[6].injSlot;
      return { got, picks };
    };
    const toB = pull(a, b, ka), toA = pull(b, a, kb);
    this.bench(a).push(...toA.got); this.bench(b).push(...toB.got);
    this.setLineup(a); this.setLineup(b); // empty spots get the best backup (or a signing)
    const nm = x => x.got.map(p => `${p[0]} ${p[1]} (${p[3]})`).concat(x.picks);
    return { aGot: nm(toA), bGot: nm(toB) };
  },
  makeDeal(other, give, get) {
    const me = this.data.team, r = this.moveAssets(me, other, give, get);
    (this.data.trades || (this.data.trades = [])).push({ week: this.data.week, got: r.aGot.join(', '), gave: r.bGot.join(', '), with: other });
    this.news(`TRADE: the ${tName(me)} get ${r.aGot.join(', ')} from the ${tName(other)} for ${r.bGot.join(', ')}`);
    this.save();
    return { got: r.aGot, gave: r.bGot };
  },
  // who a team keeps when the bench is full: rating, plus a little for youth and potential
  keepScore(p) {
    const m = p[6] || {}, fa = typeof footballAge === 'function' ? footballAge(p[0], m.age || 26) : 26;
    return p[3] + (fa <= 23 ? 4 : fa <= 25 ? 2 : fa >= 31 ? -3 : 0) + (m.rookie ? ({ A: 5, B: 2 }[m.pot] || 0) : 0) + (p[0] === 'QB' ? 2 : 0) - (m.inj > 0 ? 3 : 0);
  },
  // the guys a team would let go (lowest keep score first; the last backup at a spot stays if there's a choice)
  cutOrder(id) {
    const bench = this.bench(id).filter(Boolean), cnt = {};
    for (const p of bench) cnt[posGroup(p[0])] = (cnt[posGroup(p[0])] || 0) + 1;
    return bench.filter(p => !(p[6] && p[6].inj > 0)).sort((a, b) => (cnt[posGroup(a[0])] > 1 ? 0 : 1) - (cnt[posGroup(b[0])] > 1 ? 0 : 1) || this.keepScore(a) - this.keepScore(b));
  },
  release(id, p, why) {
    const bench = this.bench(id), j = bench.indexOf(p); if (j < 0) return;
    bench.splice(j, 1);
    if (p[6]) { delete p[6].injSlot; delete p[6].con; }
    if (id === this.data.team) this.news(`${tName(id)} released ${p[0]} ${p[1]} (${p[3]})${why ? '. ' + why : ''}`);
    if (p[3] >= 60 && typeof Contracts !== 'undefined') { const L = Contracts.listing(p, id); L.ask.sal = Math.max(MIN_SAL, Math.round(L.ask.sal * 0.7 * 10) / 10); const F = this.data.faFree || (this.data.faFree = []); F.push(L); if (F.length > 60) F.splice(0, F.length - 60); }
  },
  // hurt guys (and holdouts) don't count against the bench limit, like injured reserve
  benchCount(id) { return this.bench(id).filter(p => p && !(p[6] && p[6].inj > 0)).length; },
  trimBench(id) {
    while (this.benchCount(id) > BENCH_MAX) { const c = this.cutOrder(id)[0]; if (!c) break; this.release(id, c, 'The roster was full.'); }
  },
  // fill empty spots and start the best player at each position; extra guys sit on the bench
  setLineup(id) {
    const R = this.ensureRosters()[id], bench = this.bench(id), base = TEAMS.find(t => t.id === id);
    const hurt = p => !!(p && p[6] && p[6].inj); // injured guys sit (franchise2.js)
    for (const side of ['off', 'def']) R[side].forEach((cur, i) => {
      const grp = posGroup(base[side][i][0]);
      let bi = -1;
      bench.forEach((b, j) => { if (b && !hurt(b) && posGroup(b[0]) === grp && (bi < 0 || b[3] > bench[bi][3])) bi = j; });
      if (bi >= 0 && (!cur || hurt(cur) || bench[bi][3] > cur[3])) { const b = bench.splice(bi, 1)[0]; if (cur) bench.push(cur); R[side][i] = b; }
    });
    // the original slot position stays the same (the game needs a QB in the QB spot, etc.)
    bench.sort((a, b) => b[3] - a[3]);
    if (!this.data.draft) this.trimBench(id); // during the draft rosters can run over; cut-down comes after it
  },
  describe(id, keys) { return keys.map(k => { const a = this.asset(id, k); return !a ? '?' : a.pk ? `${this.pickName(a.pk)} (projected #${this.pickNum(a.pk)})` : `${a.p[0]} ${a.p[1]} (${a.p[3]})`; }); },

  // ---------- the CPU tells you what it would take ----------
  // the cheapest set of your things (what they're worth to you) that gets the deal to 80%. null = nothing works
  whatItTakes(other, give, get, maxAdd = 5) {
    const me = this.data.team, ok = g => !this.rosterProblem(me, other, g, get) && !this.capProblem(me, other, g, get);
    if (this.dealOdds(other, give, get) >= 80 && ok(give)) return { give, added: [] };
    const theyGive = this.vals(other, other, get, false), base = this.vals(other, me, give, true);
    const C0 = this.assets(me).filter(a => !give.includes(a.key) && !(a.p && this.hurt(a.p)))
      .map(a => ({ key: a.key, v: this.worth(other, a, true), pl: !!a.p, r: a.pk && a.pk.r, c: this.worth(me, a, false) + 8 })).filter(x => x.v > 4)
      .sort((a, b) => b.v - a.v);
    const C = C0.filter(x => x.pl).slice(0, 16).concat(C0.filter(x => x.r && x.r <= 3).slice(0, 12)).sort((a, b) => b.v - a.v); // your best players + your early picks
    const n = Math.min(maxAdd, MAX_ASSETS - give.length), hits = [];
    // fewest pieces first: try every 1-piece add, then 2, ... (and one size past the first that works, in case it's cheaper)
    let found = 0;
    for (let size = 1; size <= n && found < 2; size++) {
      let nodes = 0;
      const walk = (start, chosen, cost) => {
        if (++nodes > 40000) return;
        if (chosen.length === size) { if (this.oddsFrom(base.concat(chosen), theyGive) >= 80) hits.push({ chosen: chosen.slice(), cost }); return; }
        for (let i = start; i < C.length; i++) { chosen.push(C[i]); walk(i + 1, chosen, cost + C[i].c); chosen.pop(); }
      };
      walk(0, [], 0);
      if (hits.length || found) found++;
    }
    hits.sort((a, b) => a.cost - b.cost);
    for (const h of hits.slice(0, 300)) { const g = give.concat(h.chosen.map(x => x.key)); if (ok(g)) return { give: g, added: h.chosen.map(x => x.key) }; }
    return null;
  },
  // shopping your players: what each team would give you for them (best few offers)
  shopOffers(give, n = 3) {
    const me = this.data.team, out = [];
    for (const t of TEAMS) {
      const other = t.id; if (other === me) continue;
      const theyGet = this.vals(other, me, give, true), top = this.pkgWorth(theyGet, 0);
      const C = this.assets(other).filter(a => !(a.p && this.hurt(a.p)) && !(a.p && a.p[6] && a.p[6].cap))
        .map(a => ({ key: a.key, v: this.worth(other, a, false), pl: !!a.p, mine: this.worth(me, a, true) })).filter(x => x.v > 4 && x.mine > 4 && x.v <= top)
        .sort((a, b) => b.mine - a.mine).slice(0, 14);
      const found = [];
      const walk = (start, chosen, sum) => {
        if (chosen.length) {
          if (this.oddsFrom(theyGet, chosen) < 80) return; // adding more only makes it worse for them
          found.push({ keys: chosen.map(x => x.key), sum });
        }
        if (chosen.length >= 3) return;
        for (let i = start; i < C.length; i++) { chosen.push(C[i]); walk(i + 1, chosen, sum + C[i].mine); chosen.pop(); }
      };
      walk(0, [], 0);
      found.sort((a, b) => b.sum - a.sum);
      const best = found.slice(0, 40).find(f => !this.rosterProblem(me, other, give, f.keys) && !this.capProblem(me, other, give, f.keys));
      if (best) out.push({ team: other, get: best.keys, sum: best.sum });
    }
    return out.sort((a, b) => b.sum - a.sum).slice(0, n);
  }
});

// draft: picks go to whoever owns them now; rookies who don't start sit on the bench instead of disappearing
Season.draftPick = function (team, k, quiet) {
  const dr = this.data.draft, pr = dr.pool.splice(k, 1)[0];
  const t = Object.assign(pr.t.slice(), { pot: pr.pot }), f = this.fit(team, t);
  let replaced = null;
  if (f && f.gain > 0) { replaced = f.cur; this.ensureRosters()[team][f.side][f.i] = pr.t; this.bench(team).push(replaced); }
  else this.bench(team).push(pr.t);
  this.setLineup(team);
  const via = dr.via && dr.via[dr.i] !== team ? dr.via[dr.i] : null, rd = dr.rd ? dr.rd[dr.i] : 1;
  dr.picks.push({ n: dr.i + 1, rd, team, via, name: pr.t[1], pos: pr.t[0], ovr: pr.t[3], pot: pr.pot, school: pr.school, starts: !!replaced, replaced: replaced ? replaced[1] : null });
  dr.i++;
  if (!quiet) this.save();
};
const _nextYear = Season.nextYear.bind(Season);
Season.nextYear = function () {
  // bench guys develop in Season.develop (aging.js) along with everyone else; the pick table carries over (this year's draft is used up)
  const R = this.ensureRosters(), picks = this.ensurePicks();
  const keepBench = {}; for (const id in R) keepBench[id] = R[id].bench;
  const ch = _nextYear();
  for (const id in keepBench) if (this.data.rosters[id]) this.data.rosters[id].bench = keepBench[id] || [];
  this.data.picks = picks; this.ensurePicks(); // a new year of picks shows up at the far end
  this.save();
  return ch;
};
const _finishWeek2 = Season.finishWeek;
Season.finishWeek = function (s) {
  _finishWeek2.call(this, s);
  if (this.data.offer && !this.canTrade()) delete this.data.offer;
  this.makeOffer(); this.save();
};

// ---------------- trade screen ----------------
const td = { other: null, give: [], get: [], note: '', tab: { mine: 'ros', theirs: 'ros' }, shop: null };
const TR_CHEV = d => `<svg viewBox="0 0 10 16" width="10" height="16"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
(() => {
  $('trade').innerHTML = `<div id="trTop"><h2>Trade Center</h2>
      <div id="trPickT"><button id="trPrev" aria-label="Previous team">${TR_CHEV('M8 1 L2 8 L8 15')}</button><select id="trTeam"></select><button id="trNext" aria-label="Next team">${TR_CHEV('M2 1 L8 8 L2 15')}</button></div>
      <div id="trInfo"></div><button id="trBack">BACK</button></div>
    <div id="trWrap">
      <div class="trCol"><div class="trHead" id="trMineHead"></div><div class="trTabs" data-side="mine"></div><div class="trList" id="trMine"></div></div>
      <div id="trMid">
        <div id="trSum"></div>
        <div id="trMeterBox"><div class="trMLbl"><span>TRADE VALUE</span><b id="trPct"></b></div><div id="trMeter"><i></i><u></u></div><div id="trVerdict"></div></div>
        <div id="trMsg"></div>
        <button class="big" id="trGo" disabled>MAKE TRADE</button>
        <div class="trB2"><button id="trAsk">WHAT WOULD IT TAKE?</button><button id="trShop">SHOP</button><button id="trClear">CLEAR</button></div>
      </div>
      <div class="trCol"><div class="trHead" id="trTheirHead"></div><div class="trTabs" data-side="theirs"></div><div class="trList" id="trTheirs"></div></div>
    </div>`;
})();
$('trBack').onclick = () => { Sound.click(); renderHub(); };
function trOpen() { Season.ensureRosters(); Season.ensurePicks(); if (typeof Contracts !== 'undefined') Contracts.ensure(); td.give = []; td.get = []; td.note = ''; td.shop = null; if (!td.other || td.other === Season.data.team) td.other = TEAMS.find(t => t.id !== Season.data.team).id; renderTrade(); show('trade'); }
$('shTrade').onclick = trOpen;
function trSetTeam(id) { td.other = id; td.get = []; td.note = ''; td.shop = null; renderTrade(); }
$('trTeam').onchange = () => trSetTeam($('trTeam').value);
const trCycle = dir => { const ids = TEAMS.map(t => t.id).filter(id => id !== Season.data.team), i = ids.indexOf(td.other); Sound.click(); trSetTeam(ids[(i + dir + ids.length) % ids.length]); };
$('trPrev').onclick = () => trCycle(-1); $('trNext').onclick = () => trCycle(1);
const TR_MODE = { win: ['CONTENDER', 'g', 'wants stars who help now'], mid: ['MIDDLE', '', 'open to anything fair'], rebuild: ['REBUILDING', 'r', 'wants picks + young players'] };
const trSal = p => { const c = p[6] && p[6].con; return c ? `${cmoney(c.sal)}·${c.yrs}Y` : ''; };
function tdRows(id, mine) {
  const d = Season.data, sel = mine ? td.give : td.get, A = Season.assets(id), tab = td.tab[mine ? 'mine' : 'theirs'];
  const row = a => {
    const on = sel.includes(a.key);
    if (a.pk) { const n = Season.pickNum(a.pk), cur = a.pk.y === Season.draftYear();
      return `<div tabindex="0" class="trRow trPk${on ? ' on' : ''}" data-k="${a.key}"><span class="pos">R${a.pk.r}</span><span class="nm">${a.pk.y} ${RD_NAME[a.pk.r - 1]}<small>${a.pk.from === id ? 'OWN' : 'VIA ' + a.pk.from}</small></span><em>${cur ? 'PROJ' : 'EST'} #${n}</em></div>`; }
    const p = a.p, m = p[6] || {};
    let cls = ''; if (!mine) { const w = Season.weakestAt(d.team, p[0]); if (w && p[3] > w[3]) cls = ' up'; }
    const tag = Season.hurt(p) ? '<small class="out">OUT</small>' : m.rookie ? '<small>RK</small>' : '';
    return `<div tabindex="0" class="trRow${on ? ' on' : ''}${cls}" data-k="${a.key}"><span class="pos">${p[0]}</span><b>${p[3]}</b><span class="nm">${innerWidth < 900 ? `${p[1][0]}. ${lastName(p[1])}` : p[1]}${tag}</span><em>${m.age || '?'}<i>${trSal(p)}</i></em></div>`;
  };
  const grp = (title, list) => list.length ? `<div class="trGrp">${title}</div>` + list.map(row).join('') : '';
  if (tab === 'pk') { const P = A.filter(a => a.pk), ys = [...new Set(P.map(a => a.pk.y))];
    return ys.map(y => grp(`${y} DRAFT`, P.filter(a => a.pk.y === y))).join('') || '<div class="note">No picks left.</div>'; }
  return grp('OFFENSE', A.filter(a => a.key.startsWith('off'))) + grp('DEFENSE', A.filter(a => a.key.startsWith('def'))) + grp('BENCH', A.filter(a => a.key.startsWith('bench')));
}
function trHead(id, mine) {
  const t = Season.team(id), cap = typeof Contracts !== 'undefined' ? Contracts.room(id) : null, M = TR_MODE[Season.teamMode(id)];
  return `<span class="trTn">${mine ? 'YOU' : t.name.toUpperCase()}</span><span class="trTi">${recStr(id)} · ${teamOvr(t)} OVR${cap != null ? ` · <b class="${cap < 0 ? 'neg' : ''}">${cmoney(cap)}</b> ROOM` : ''}</span>${mine ? '' : `<em class="trMode ${M[1]}" title="${M[2]}">${M[0]}</em>`}`;
}
function renderTrade() {
  const d = Season.data, me = d.team, other = td.other;
  $('trTeam').innerHTML = TEAMS.filter(t => t.id !== me).map(t => `<option value="${t.id}"${t.id === other ? ' selected' : ''}>${t.city} ${t.name} (${recStr(t.id)})</option>`).join('');
  $('trInfo').innerHTML = d.phase === 'regular' ? `DEADLINE WEEK ${Season.deadline()}` : '';
  $('trMineHead').innerHTML = trHead(me, true); $('trTheirHead').innerHTML = trHead(other, false);
  document.querySelectorAll('#trade .trTabs').forEach(box => { const s = box.dataset.side;
    box.innerHTML = [['ros', 'ROSTER'], ['pk', 'DRAFT PICKS']].map(([k, l]) => `<button data-t="${k}" class="${td.tab[s] === k ? 'on' : ''}">${l}</button>`).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => { Sound.click(); td.tab[s] = b.dataset.t; renderTrade(); }); });
  const keepScroll = ['trMine', 'trTheirs'].map(i => $(i).scrollTop);
  $('trMine').innerHTML = tdRows(me, true); $('trTheirs').innerHTML = tdRows(other, false);
  ['trMine', 'trTheirs'].forEach((i, j) => $(i).scrollTop = keepScroll[j]);
  for (const [box, list] of [[$('trMine'), td.give], [$('trTheirs'), td.get]]) box.querySelectorAll('.trRow').forEach(r => r.onclick = () => {
    const k = r.dataset.k, i = list.indexOf(k);
    td.note = ''; td.shop = null;
    if (i >= 0) list.splice(i, 1); else if (list.length < MAX_ASSETS) list.push(k); else td.note = `Up to ${MAX_ASSETS} on each side.`;
    Sound.click(); renderTrade();
  });
  // the deal in the middle
  const chip = (id, k, side) => { const a = Season.asset(id, k); if (!a) return '';
    return `<div class="trChip" data-x="${side}:${k}">${a.pk ? Season.pickName(a.pk) : `<span class="pos">${a.p[0]}</span>${lastName(a.p[1])} <b>${a.p[3]}</b>`}</div>`; };
  const salOf = (id, keys) => keys.reduce((s, k) => { const a = Season.asset(id, k); return s + (a && a.p && a.p[6] && a.p[6].con ? a.p[6].con.sal : 0); }, 0);
  const capAfter = typeof Contracts !== 'undefined' ? Contracts.room(me) + salOf(me, td.give) - salOf(other, td.get) : null;
  $('trSum').innerHTML = `<div class="trSumCol"><div class="lbl">YOU GIVE</div>${td.give.map(k => chip(me, k, 'g')).join('') || '<div class="dim">Tap your players or picks</div>'}</div>
    <div class="trSumCol"><div class="lbl">YOU GET</div>${td.get.map(k => chip(other, k, 'r')).join('') || '<div class="dim">Tap their players or picks</div>'}</div>`
    + (capAfter != null && (td.give.length || td.get.length) ? `<div class="trCapA">YOUR CAP ROOM AFTER <b class="${capAfter < 0 ? 'neg' : ''}">${cmoney(capAfter)}</b></div>` : '');
  $('trSum').querySelectorAll('.trChip').forEach(c => c.onclick = () => { const [s, ...k] = c.dataset.x.split(':'), key = k.join(':'), L = s === 'g' ? td.give : td.get; L.splice(L.indexOf(key), 1); td.note = ''; Sound.click(); renderTrade(); });
  const go = $('trGo'), meter = $('trMeter').firstElementChild, prob = (td.give.length || td.get.length) ? Season.dealProblem(other, td.give, td.get) : null;
  if (td.get.length || td.give.length) {
    const pct = td.get.length ? Season.dealOdds(other, td.give, td.get) : 100;
    meter.style.width = pct + '%'; meter.style.background = pct >= 80 ? '#5cdd8a' : pct >= 55 ? 'var(--gold)' : 'var(--red)';
    $('trPct').textContent = pct + '%';
    $('trVerdict').innerHTML = !td.give.length ? `<span>Add what you'll give</span>` : !td.get.length ? `<span>A gift? They'd take it. Pick what you want back.</span>` : pct >= 80 ? `<span class="g">THE ${tName(other).toUpperCase()} WOULD ACCEPT</span>` : pct >= 55 ? `<span class="c">CLOSE. THEY WANT A LITTLE MORE</span>` : `<span class="r">NOT INTERESTED</span>`;
    go.disabled = pct < 80 || !!prob || !td.give.length || !td.get.length;
  } else { meter.style.width = '0%'; $('trPct').textContent = ''; $('trVerdict').innerHTML = `<span>The ${tName(other)} are ${TR_MODE[Season.teamMode(other)][0].toLowerCase()}: ${TR_MODE[Season.teamMode(other)][2]}.</span>`; go.disabled = true; }
  $('trAsk').disabled = !td.get.length; $('trShop').disabled = !td.give.length;
  $('trClear').disabled = !td.give.length && !td.get.length;
  let msg = prob || td.note || 'They need 80% to say yes. Picks from later years are worth a bit less.';
  if (td.shop) msg = td.shop.length ? `<div class="trShopL">${td.shop.map((o, i) => `<div class="trOfr" data-i="${i}"><b>${tName(o.team).toUpperCase()}</b>${Season.describe(o.team, o.get).map(s => s.replace(/ \(projected #\d+\)/, '')).join(' + ')}</div>`).join('')}</div>` : 'Nobody wants to give up anything for that right now.';
  $('trMsg').innerHTML = msg;
  $('trMsg').querySelectorAll('.trOfr').forEach(e => e.onclick = () => { const o = td.shop[+e.dataset.i]; Sound.click(); td.other = o.team; td.get = o.get.slice(); td.shop = null; td.note = `The ${tName(o.team)} offer this. Tap MAKE TRADE to do it.`; renderTrade(); });
}
$('trGo').onclick = () => {
  if (!td.give.length || !td.get.length || Season.dealProblem(td.other, td.give, td.get) || Season.dealOdds(td.other, td.give, td.get) < 80) return;
  const r = Season.makeDeal(td.other, td.give, td.get);
  Sound.td(); td.give = []; td.get = []; td.note = `Done. You got ${r.got.join(', ')}.`; renderTrade();
};
$('trClear').onclick = () => { Sound.click(); td.give = []; td.get = []; td.note = ''; td.shop = null; renderTrade(); };
// the CPU tells you what it wants from your side
$('trAsk').onclick = () => {
  const other = td.other; Sound.click(); td.shop = null;
  if (!td.get.length) return;
  const r = Season.whatItTakes(other, td.give, td.get);
  if (!r) td.note = `The ${tName(other)} won't do it. Nothing you can add gets them there.`;
  else if (!r.added.length) td.note = 'They already like this deal.';
  else { td.give = r.give; td.note = `The ${tName(other)} want ${Season.describe(Season.data.team, r.added).map(s => s.replace(/ \(projected #\d+\)/, '')).join(' + ')} added.`; }
  renderTrade();
};
// shop what's on your side to the whole league: the best offers show up in the middle (tap one to load it)
$('trShop').onclick = () => {
  Sound.click(); if (!td.give.length) return;
  td.shop = Season.shopOffers(td.give);
  const d = Season.data; d.block = td.give.map(k => Season.asset(d.team, k)).filter(a => a && a.p).map(a => a.p[1]); // CPU teams call about these guys first
  renderTrade();
};

// incoming offer box on the season hub
const _renderHub = renderHub;
renderHub = function () {
  _renderHub();
  const d = Season.data; let box = $('trOffer');
  if (!box) { box = document.createElement('div'); box.id = 'trOffer'; $('shLeft').insertBefore(box, $('shBtns')); }
  const o = d && d.offer;
  if (!o || !Season.canTrade()) { box.style.display = 'none'; return; }
  box.style.display = '';
  const short = (id, keys) => keys.map(k => { const a = Season.asset(id, k); return !a ? '?' : a.pk ? Season.pickName(a.pk) : `${a.p[0]} ${lastName(a.p[1])} (${a.p[3]})`; }).join(' + ');
  box.innerHTML = `<div class="ofTxt"><span class="lbl">${tName(o.from).toUpperCase()} OFFER</span> Your <b>${short(d.team, o.give)}</b> for <b>${short(o.from, o.get)}</b></div>
    <button class="gold" id="ofYes">ACCEPT</button><button id="ofNo">NO</button>`;
  $('ofYes').onclick = () => {
    const ok = o.give.every(k => Season.asset(d.team, k)) && o.get.every(k => Season.asset(o.from, k)) && !Season.dealProblem(o.from, o.give, o.get);
    delete d.offer;
    if (ok) { const r = Season.makeDeal(o.from, o.give, o.get); Sound.td(); Season.news(`You accepted the ${tName(o.from)} offer and got ${r.got.join(', ')}.`); }
    else Season.news(`That ${tName(o.from)} offer doesn't work anymore (roster or salary cap).`);
    Season.save(); renderHub();
  };
  $('ofNo').onclick = () => { delete d.offer; Season.save(); Sound.click(); renderHub(); };
};
