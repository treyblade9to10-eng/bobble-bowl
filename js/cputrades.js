// ---- League trades: CPU teams deal with each other (in-season, deadline day, offseason) and call you with offers ----
// Contenders buy upgrades at their weakest spot, losing teams sell veterans for younger players and draft picks.
const LeagueTrades = {
  // how good a team looks right now: record once games are played, roster rating before that
  power(id) {
    const d = Season.data, r = d.rec[id], g = r ? r.w + r.l + r.t : 0;
    const o = (Season.ovr(id) - 75) / 10;
    return g >= 2 ? Season.pct(id) * 0.75 + o * 0.25 : 0.5 + o * 0.5;
  },
  ok(p) { return p && !Season.hurt(p) && !(p[6] && p[6].cap); },
  sal(p) { const c = p && p[6] && p[6].con; return c ? c.sal || 0 : 0; },
  age(p) { return footballAge(p[0], (p[6] && p[6].age) || 27); },
  // cap check for a CPU-CPU deal (only once contracts exist)
  capOk(a, b, ka, kb) { return !Season.capProblem(a, b, ka, kb); },
  // move assets between any two teams (picks change owners, the best player at each spot starts)
  swap(a, b, ka, kb) { return Season.moveAssets(a, b, ka, kb); },
  // the picks a team would actually deal: rounds 1-3, any year
  dealPicks(id) { return Season.assets(id).filter(x => x.pk && x.pk.r <= 3); },
  // value of a package to a team (getting it or giving it up)
  val(id, from, keys, getting) { return keys.reduce((s, k) => { const x = Season.asset(from, k); return s + (x ? Season.worth(id, x, getting) : 0); }, 0); },
  // one sensible CPU-CPU deal. kind: 'season' | 'deadline' | 'offseason'
  one(kind) {
    const d = Season.data, ids = TEAMS.map(t => t.id).filter(i => i !== d.team && Season.ensureRosters()[i]);
    const rank = ids.slice().sort((x, y) => this.power(y) - this.power(x));
    const buyers = rank.slice(0, 14), sellers = rank.slice(-14);
    for (let tries = 0; tries < 40; tries++) {
      const A = pick(buyers), R = Season.ensureRosters()[A];
      // A's weakest starter (compared to the rest of its team)
      const slots = []; for (const side of ['off', 'def']) R[side].forEach((p, i) => { if (this.ok(p)) slots.push({ key: `${side}:${i}`, p }); });
      slots.sort((x, y) => x.p[3] - y.p[3]); const need = pick(slots.slice(0, 5)); if (!need) continue;
      const B = pick(sellers.filter(s => s !== A)); if (!B) continue;
      const targets = Season.assets(B).filter(x => x.p && x.starter && this.ok(x.p) && posGroup(x.p[0]) === posGroup(need.p[0]) && x.p[3] >= need.p[3] + 3 && x.p[3] >= 74);
      // sellers move older guys first
      targets.sort((x, y) => this.age(y.p) - this.age(x.p)); const T = targets[0]; if (!T) continue;
      const mine = Season.assets(A), picks = shuffle(this.dealPicks(A)).slice(0, 5), bench = mine.filter(x => x.p && !x.starter && this.ok(x.p) && x.p[3] >= 66 && (posGroup(x.p[0]) === posGroup(T.p[0]) || this.age(x.p) <= 24)); // a backup at the same spot or a young prospect
      const opts = [[need.key]];
      for (const pk of picks) { opts.push([need.key, pk.key]); opts.push([pk.key]); }
      for (const bn of bench.slice(0, 6)) { opts.push([need.key, bn.key]); if (picks[0]) opts.push([bn.key, picks[0].key]); }
      let best = null;
      for (const give of opts) {
        if (Season.rosterProblem(A, B, give, [T.key]) || !this.capOk(A, B, give, [T.key])) continue;
        const bGets = this.val(B, A, give, true), bGives = this.val(B, B, [T.key], false);
        const aGets = this.val(A, B, [T.key], true), aGives = this.val(A, A, give, false);
        if (bGets < bGives * 0.92 || bGets > bGives * 1.5 || aGets < aGives * 0.8) continue; // both sides have to like it, nobody gets robbed
        const bal = Math.abs(bGets / bGives - 1.05) + give.length * 0.03;
        if (!best || bal < best.bal) best = { give, bal };
      }
      if (!best) continue;
      const r = this.swap(A, B, best.give, [T.key]);
      const tag = kind === 'deadline' ? 'DEADLINE DEAL' : kind === 'offseason' ? 'OFFSEASON TRADE' : 'TRADE';
      Season.news(`${tag}: the ${tName(A)} get ${r.aGot.join(' + ')} from the ${tName(B)} for ${r.bGot.join(' + ')}`);
      (d.cpuTradeLog || (d.cpuTradeLog = [])).push({ y: d.year, wk: d.week, kind, a: A, b: B });
      return true;
    }
    return false;
  },
  run(kind, n) { if (Season.isCareer && Season.isCareer()) return 0; let k = 0; for (let i = 0; i < n; i++) if (this.one(kind)) k++; return k; },

  // ---- offers to you: a few a season, never two weeks in a row ----
  makeOffer() {
    const d = Season.data, me = d.team;
    if (!Season.canTrade() || d.offer) return;
    const dl = Season.deadline(), got = (d.offerLog || []).filter(o => o.y === d.year), last = got[got.length - 1];
    if (got.length >= 4 || (last && d.week - last.wk < (dl >= 8 ? 2 : 1)) || !chance(clamp(5 / dl, 0.25, 0.75))) return;
    let wants = Season.assets(me).filter(a => a.p && this.ok(a.p) && (a.starter ? a.p[3] >= 76 : a.p[3] >= 72));
    const block = wants.filter(a => (d.block || []).includes(a.p[1])); if (block.length && chance(0.7)) wants = block; // guys you shopped get calls first
    const myNeed = (() => { const R = Season.ensureRosters()[me]; let w = null; for (const side of ['off', 'def']) for (const p of R[side]) if (p && (!w || p[3] < w[3])) w = p; return w; })();
    for (let tries = 0; tries < 30; tries++) {
      const want = pick(wants); if (!want) return;
      const other = pick(TEAMS.filter(t => t.id !== me)).id;
      const A = Season.assets(other), pks = shuffle(this.dealPicks(other)), pk = pks[0];
      const same = A.filter(a => a.p && this.ok(a.p) && posGroup(a.p[0]) === posGroup(want.p[0]));
      const fill = myNeed ? A.filter(a => a.p && this.ok(a.p) && posGroup(a.p[0]) === posGroup(myNeed[0]) && a.p[3] > myNeed[3]) : [];
      const opts = [];
      for (const t of same) { opts.push([t.key]); if (pk) opts.push([t.key, pk.key]); }
      if (pks.length > 1) { opts.push([pks[0].key, pks[1].key]); if (pks[2]) opts.push([pks[0].key, pks[1].key, pks[2].key]); } // picks for a star
      for (const f of fill) { opts.push([f.key]); if (same[0]) opts.push([f.key, same[0].key]); if (pk) opts.push([f.key, pk.key]); }
      if (pk) opts.push([pk.key]);
      shuffle(opts);
      for (const get of opts) {
        const give = [want.key], odds = Season.dealOdds(other, give, get);
        if (odds < 82 || Season.rosterProblem(me, other, give, get) || !this.capOk(me, other, give, get)) continue;
        const youGet = get.reduce((s, k) => s + Season.worth(me, Season.asset(other, k), true), 0), youGive = Season.worth(me, want, false);
        if (youGet < youGive * 0.85) continue; // it has to be tempting for you
        d.offer = { from: other, give, get, week: d.week };
        (d.offerLog || (d.offerLog = [])).push({ y: d.year, wk: d.week, from: other });
        Season.news(`TRADE OFFER: the ${tName(other)} want ${want.p[0]} ${want.p[1]}. Check the season screen.`);
        return;
      }
    }
  }
};

// in-season: about one CPU deal every other week, a flurry on deadline day
Season.cpuTrades = function () {
  const d = this.data; if (d.phase !== 'regular' || (this.isCareer && this.isCareer())) return;
  if (this.canTrade()) { const n = chance(clamp(4.5 / this.deadline(), 0.25, 0.8)) ? 1 : 0; LeagueTrades.run('season', n + (chance(0.15) ? 1 : 0)); }
  else if (d.week === this.deadline()) LeagueTrades.run('deadline', 2 + (chance(0.5) ? 1 : 0));
};
Season.makeOffer = function () {
  const d = this.data;
  if (d.offer && d.week - d.offer.week >= 2) { this.news(`The ${tName(d.offer.from)} pulled their trade offer.`); delete d.offer; }
  LeagueTrades.makeOffer();
};
// offseason: a few teams reshuffle once the new year starts (after the draft, so the news sticks around)
{ const _ny = Season.nextYear; Season.nextYear = function () {
  const ch = _ny.call(this);
  if (!(this.isCareer && this.isCareer())) { LeagueTrades.run('offseason', 2 + Math.floor(Math.random() * 3)); this.save(); }
  return ch;
}; }
