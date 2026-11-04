// ---- Online ranked: your record and rating in online versus games, kept on this device only (no public list) ----
// Both devices send their rating when they connect (hello / start in net.js). At the end each side works out the same
// change from the host's final score: a simple Elo (beat a higher-rated friend = more points). Co-op games don't count,
// and neither does a game somebody left before the end.
const Ranked = {
  KEY: 'bobbleRanked', START: 1000,
  TIERS: [[0, 'ROOKIE'], [1100, 'STARTER'], [1200, 'PRO'], [1300, 'ALL-PRO'], [1400, 'MVP'], [1550, 'HALL OF FAME']],
  d: null,
  load() {
    if (this.d) return this.d;
    let d = null; try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) {}
    if (!d || typeof d.r !== 'number' || !isFinite(d.r)) d = { r: this.START, w: 0, l: 0, t: 0, pf: 0, pa: 0, st: 0, best: this.START, g: 0 };
    return this.d = d;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) {} },
  rating() { return Math.round(this.load().r); },
  tier(r) { let t = this.TIERS[0]; for (const x of this.TIERS) if (r >= x[0]) t = x; return t[1]; },
  rec(d = this.load()) { return `${d.w}-${d.l}${d.t ? '-' + d.t : ''}`; },
  streak(d = this.load()) { return d.st > 0 ? 'W' + d.st : d.st < 0 ? 'L' + -d.st : ''; },
  // one finished game: my points, theirs, their rating (from the hello / start message)
  record(mine, theirs, opp) {
    const d = this.load(), r0 = d.r, t0 = this.tier(r0);
    if (!(typeof opp === 'number' && opp >= 100 && opp <= 3000)) opp = this.START;
    const S = mine > theirs ? 1 : mine < theirs ? 0 : 0.5, E = 1 / (1 + Math.pow(10, (opp - r0) / 400));
    const K = d.g < 10 ? 40 : 32; // first 10 games move faster so you find your level
    const ch = Math.round(K * (S - E));
    d.r = Math.max(100, r0 + ch); d.g++; d.pf += mine; d.pa += theirs;
    if (S === 1) { d.w++; d.st = d.st > 0 ? d.st + 1 : 1; } else if (S === 0) { d.l++; d.st = d.st < 0 ? d.st - 1 : -1; } else { d.t++; d.st = 0; }
    d.best = Math.max(d.best || this.START, d.r);
    this.save();
    const t1 = this.tier(d.r);
    return this.last = { ch, r: d.r, tier: t1, up: t1 !== t0 && d.r > r0, down: t1 !== t0 && d.r < r0, opp: this.tier(opp) };
  },
  // the little card on the ONLINE screen
  chip() {
    let el = $('onRank');
    if (!el) { el = document.createElement('div'); el.id = 'onRank'; $('online').appendChild(el); }
    const d = this.load(), tr = this.tier(d.r);
    el.innerHTML = `<span class="rkL">RANKED</span><b class="rkT rk${this.TIERS.findIndex(x => x[1] === tr)}">${tr}</b><span class="rkN">${Math.round(d.r)}</span>` +
      `<span class="rkR">${d.g ? `${this.rec(d)}${this.streak(d) ? '  ·  ' + this.streak(d) : ''}<span class="rkP">  ·  ${d.pf}-${d.pa} PTS</span>` : 'BEAT A FRIEND TO MOVE UP'}</span>`;
  }
};

// end of an online versus game: count it once (the host may send its final score again after a reconnect)
{
  const _over = G.hooks.onGameOver;
  G.hooks.onGameOver = s => {
    _over(s);
    if (!G.online || !G.versus || G.coop || G.demo || Net.watch || !Net.role) return;
    if (!Net.rkDone) { Net.rkDone = true; const me = s.human; Ranked.record(s.score[me], s.score[1 - me], Net.oppRk); }
    const L = Ranked.last; if (!L) return;
    $('overChal').innerHTML = `RANKED: <b>${L.tier}</b> ${L.r} (${L.ch >= 0 ? '+' : ''}${L.ch})  ·  ${Ranked.rec()}${Ranked.streak() ? '  ·  ' + Ranked.streak() : ''}` +
      (L.up ? `  ·  <b>MOVED UP TO ${L.tier}</b>` : L.down ? `  ·  DOWN TO ${L.tier}` : '');
    $('overChal').style.color = L.ch > 0 ? '#ffd23f' : L.ch < 0 ? '#ff8a8a' : '#dfe6ee';
  };
}
// show it whenever the ONLINE screen opens
{ const _oo = openOnline; openOnline = function (msg) { _oo(msg); Ranked.chip(); }; }
