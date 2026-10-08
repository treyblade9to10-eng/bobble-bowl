// ---- Trade center: multi-player deals, draft picks, benches, "what would it take", CPU trade offers ----
// Assets are keyed like 'off:3' / 'def:5' (starters), 'bench:2', 'pick:DAL' (DAL's 1st round pick this year).
const MAX_ASSETS = 3, BENCH_MAX = 10;
const BACKUP_POS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];
const posGroup = p => p === 'TE' ? 'WR' : p; // tight ends and receivers can cover for each other
const tName = id => (TEAMS.find(t => t.id === id) || { name: id }).name; // 'Saints', not 'NO'

Object.assign(Season, {
  // every team gets a bench of backups (one at each spot) the first time we need it
  bench(id) {
    const R = this.ensureRosters()[id];
    if (!R.bench) R.bench = BACKUP_POS.map(pos => { const [s0, s1] = ROOKIE_SPD[pos]; return [pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), Math.round(rand(60, 71)), Math.round(rand(s0, s1) - 3), Math.floor(Math.random() * 6)]; });
    return R.bench;
  },
  pickOwner(id) { const o = this.data.pickOwner; return (o && o[id]) || id; },
  picksOf(id) { return TEAMS.map(t => t.id).filter(t => this.pickOwner(t) === id); },
  // where a team is projected to pick (worst record = #1)
  pickSlot(id) {
    const ids = TEAMS.map(t => t.id).sort((a, b) => this.pct(a) - this.pct(b) || this.ovr(a) - this.ovr(b));
    return ids.indexOf(id) + 1;
  },
  assets(id) {
    const R = this.ensureRosters()[id], out = [];
    for (const side of ['off', 'def']) R[side].forEach((p, i) => out.push({ key: `${side}:${i}`, p, starter: true }));
    this.bench(id).forEach((p, i) => out.push({ key: `bench:${i}`, p, starter: false }));
    for (const from of this.picksOf(id)) out.push({ key: `pick:${from}`, pick: from });
    return out;
  },
  asset(id, key) {
    const [k, v] = key.split(':'), R = this.ensureRosters()[id];
    if (k === 'pick') return { key, pick: v };
    const p = k === 'bench' ? this.bench(id)[+v] : R[k][+v];
    return p ? { key, p, starter: k !== 'bench' } : null;
  },
  pickValue(from) { const slot = this.pickSlot(from); return this.value([0, 0, 0, Math.round(83 - slot * 0.32)]) * 1.15; },
  // the weakest starter at this player's position on a team (who he'd replace)
  weakestAt(id, pos) {
    const R = this.ensureRosters()[id]; let w = null;
    for (const side of ['off', 'def']) for (const p of R[side]) if (posGroup(p[0]) === posGroup(pos) && (!w || p[3] < w[3])) w = p;
    return w;
  },
  // how much a team values an asset (getting it or giving it up)
  worth(id, a, getting) {
    if (a.pick) return this.pickValue(a.pick);
    let v = this.value(a.p);
    if (getting) { const w = this.weakestAt(id, a.p[0]); if (!w || a.p[3] <= w[3]) v *= 0.55; } // would just sit on the bench
    else { if (!a.starter) v *= 0.55; if (a.p[3] >= 93) v *= 1.15; }                        // stars cost extra
    if (a.p[6] && a.p[6].rookie && (a.p.pot === 'A')) v *= 1.1;
    return v;
  },
  // can both teams still fill every starting spot after the deal?
  rosterProblem(me, other, give, get) {
    for (const [id, out, inn] of [[me, give, get], [other, get, give]]) {
      const R = this.ensureRosters()[id], left = [];
      const outKeys = new Set(out);
      for (const side of ['off', 'def']) R[side].forEach((p, i) => { if (!outKeys.has(`${side}:${i}`)) left.push(p); });
      this.bench(id).forEach((p, i) => { if (!outKeys.has(`bench:${i}`)) left.push(p); });
      const fromId = id === me ? other : me;
      for (const k of inn) { const a = this.asset(fromId, k); if (a && a.p) left.push(a.p); }
      const need = {}; for (const side of ['off', 'def']) for (const p of R[side]) need[posGroup(p[0])] = (need[posGroup(p[0])] || 0) + 1;
      const have = {}; for (const p of left) have[posGroup(p[0])] = (have[posGroup(p[0])] || 0) + 1;
      for (const g in need) if ((have[g] || 0) < need[g]) return { team: id, pos: g };
    }
    return null;
  },
  // chance the CPU team says yes (they need 80%)
  dealOdds(other, give, get) {
    const me = this.data.team;
    const theyGet = give.reduce((s, k) => s + this.worth(other, this.asset(me, k), true), 0);
    const theyGive = get.reduce((s, k) => s + this.worth(other, this.asset(other, k), false), 0);
    if (!get.length) return give.length ? 100 : 0;
    return clamp(Math.round(80 + (theyGet - theyGive) / Math.max(1, theyGive) * 160), 0, 100);
  },
  // swap everything, then each team puts its best player at every spot
  makeDeal(other, give, get) {
    const me = this.data.team, R = this.ensureRosters();
    const pull = (id, keys) => {
      const got = [], rows = keys.map(k => k.split(':'));
      for (const [k, v] of rows) if (k === 'pick') (this.data.pickOwner || (this.data.pickOwner = {}))[v] = id === me ? other : me;
      for (const [k, v] of rows) if (k !== 'pick') { const arr = k === 'bench' ? this.bench(id) : R[id][k]; got.push(arr[+v]); arr[+v] = null; }
      this.bench(id).splice(0, this.bench(id).length, ...this.bench(id).filter(Boolean));
      return got;
    };
    const toOther = pull(me, give), toMe = pull(other, get);
    this.bench(me).push(...toMe); this.bench(other).push(...toOther);
    this.setLineup(me); this.setLineup(other);
    const nm = (id, keys) => keys.map(k => { const [a, v] = k.split(':'); return a === 'pick' ? `${tName(v)} 1st round pick` : null; }).filter(Boolean);
    const gotNames = toMe.map(p => `${p[0]} ${p[1]}`).concat(nm(other, get)), gaveNames = toOther.map(p => `${p[0]} ${p[1]}`).concat(nm(me, give));
    (this.data.trades || (this.data.trades = [])).push({ week: this.data.week, got: gotNames.join(', '), gave: gaveNames.join(', '), with: other });
    this.news(`TRADE: the ${tName(me)} get ${gotNames.join(', ')} from the ${tName(other)} for ${gaveNames.join(', ')}`);
    this.save();
    return { got: gotNames, gave: gaveNames };
  },
  // fill empty spots and start the best player at each position; extra guys sit on the bench
  setLineup(id) {
    const R = this.ensureRosters()[id], bench = this.bench(id), base = TEAMS.find(t => t.id === id);
    for (const side of ['off', 'def']) R[side].forEach((cur, i) => {
      const grp = posGroup(base[side][i][0]);
      let bi = -1;
      bench.forEach((b, j) => { if (posGroup(b[0]) === grp && (bi < 0 || b[3] > bench[bi][3])) bi = j; });
      if (bi >= 0 && (!cur || bench[bi][3] > cur[3])) { const b = bench.splice(bi, 1)[0]; if (cur) bench.push(cur); R[side][i] = b; }
    });
    // the original slot position stays the same (the game needs a QB in the QB spot, etc.)
    bench.sort((a, b) => b[3] - a[3]);
    while (bench.length > BENCH_MAX) { const cut = bench.pop(); if (id === this.data.team) this.news(`${id} released ${cut[0]} ${cut[1]} (${cut[3]}). The bench was full.`); }
  },
  // CPU teams sometimes call you with an offer
  makeOffer() {
    const d = this.data, me = d.team;
    if (!this.canTrade() || d.offer || !chance(0.3)) return;
    const mine = this.assets(me).filter(a => a.p && a.starter && a.p[3] >= 76);
    for (let tries = 0; tries < 30; tries++) {
      const other = pick(TEAMS.filter(t => t.id !== me)).id, want = pick(mine); if (!want) return;
      const theirs = this.assets(other).filter(a => a.p && posGroup(a.p[0]) === posGroup(want.p[0]));
      const pickA = this.assets(other).find(a => a.pick);
      const opts = [];
      for (const t of theirs) { opts.push([t.key]); if (pickA) opts.push([t.key, pickA.key]); }
      shuffle(opts);
      for (const get of opts) {
        const give = [want.key], odds = this.dealOdds(other, give, get);
        if (odds < 82 || odds > 100 || this.rosterProblem(me, other, give, get)) continue;
        // it has to be at least a little tempting for you
        const youGet = get.reduce((s, k) => s + this.worth(me, this.asset(other, k), true), 0), youGive = this.worth(me, want, false);
        if (youGet < youGive * 0.8) continue;
        d.offer = { from: other, give, get, week: d.week };
        this.news(`TRADE OFFER: the ${tName(other)} want ${want.p[0]} ${want.p[1]}. Check the season screen.`);
        return;
      }
    }
  },
  describe(id, keys) {
    return keys.map(k => { const a = this.asset(id, k); return !a ? '?' : a.pick ? `${tName(a.pick)} 1st round pick (projected #${this.pickSlot(a.pick)})` : `${a.p[0]} ${a.p[1]} (${a.p[3]})`; });
  }
});

// draft: traded picks go to their new owner; rookies who don't start sit on the bench instead of disappearing
const _startDraft = Season.startDraft.bind(Season);
Season.startDraft = function () {
  _startDraft();
  const dr = this.data.draft; dr.via = dr.order.slice(); dr.order = dr.order.map(id => this.pickOwner(id));
  this.save();
};
Season.draftPick = function (team, k) {
  const dr = this.data.draft, pr = dr.pool.splice(k, 1)[0];
  const t = Object.assign(pr.t.slice(), { pot: pr.pot }), f = this.fit(team, t);
  let replaced = null;
  if (f && f.gain > 0) { replaced = f.cur; this.ensureRosters()[team][f.side][f.i] = pr.t; this.bench(team).push(replaced); }
  else this.bench(team).push(pr.t);
  this.setLineup(team);
  const via = dr.via && dr.via[dr.i] !== team ? dr.via[dr.i] : null;
  dr.picks.push({ n: dr.i + 1, team, via, name: pr.t[1], pos: pr.t[0], ovr: pr.t[3], pot: pr.pot, school: pr.school, starts: !!replaced, replaced: replaced ? replaced[1] : null });
  dr.i++;
  this.save();
};
const _nextYear = Season.nextYear.bind(Season);
Season.nextYear = function () {
  // bench guys develop too
  const R = this.ensureRosters();
  for (const id in R) (R[id].bench || []).forEach(p => { p[3] = clamp(Math.round(p[3] + rand(-2, 3) + (p[3] < 75 ? 1.5 : 0)), 55, 99); });
  const keepBench = {}; for (const id in R) keepBench[id] = R[id].bench;
  const ch = _nextYear();
  this.data.pickOwner = {};
  for (const id in keepBench) if (this.data.rosters[id]) this.data.rosters[id].bench = keepBench[id] || [];
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
const td = { other: null, give: [], get: [], note: '' };
$('shTrade').onclick = () => { Season.ensureRosters(); td.give = []; td.get = []; td.note = ''; if (!td.other || td.other === Season.data.team) td.other = TEAMS.find(t => t.id !== Season.data.team).id; renderTrade(); show('trade'); };
$('trTeam').onchange = () => { td.other = $('trTeam').value; td.get = []; td.note = ''; renderTrade(); };
function tdRows(id, mine) {
  const d = Season.data, sel = mine ? td.give : td.get, A = Season.assets(id);
  const group = (title, list) => list.length ? `<div class="trGrp">${title}</div>` + list.map(a => {
    const on = sel.includes(a.key);
    let tag = '';
    if (a.pick) tag = `<em>PROJ #${Season.pickSlot(a.pick)}</em>`;
    else if (!mine) { const w = Season.weakestAt(d.team, a.p[0]); if (w && a.p[3] > w[3]) tag = `<em class="up">STARTS FOR YOU</em>`; }
    const body = a.pick ? `<span class="pos">PICK</span><b></b><span>${tName(a.pick)} 1st round</span>` : `<span class="pos">${a.p[0]}</span><b>${a.p[3]}</b><span>#${a.p[2]} ${a.p[1]}</span>`;
    return `<div tabindex="0" class="trRow${on ? ' on' : ''}" data-k="${a.key}">${body}${tag}</div>`;
  }).join('') : '';
  return group('OFFENSE', A.filter(a => a.key.startsWith('off'))) + group('DEFENSE', A.filter(a => a.key.startsWith('def'))) +
    group('BENCH', A.filter(a => a.key.startsWith('bench'))) + group('DRAFT PICKS', A.filter(a => a.pick));
}
function renderTrade() {
  const d = Season.data, me = d.team, other = td.other;
  $('trTeam').innerHTML = TEAMS.filter(t => t.id !== me).map(t => `<option value="${t.id}"${t.id === other ? ' selected' : ''}>${t.city} ${t.name} (${recStr(t.id)})</option>`).join('');
  $('trMineHead').textContent = `${Season.team(me).name.toUpperCase()} (YOU)`;
  $('trMine').innerHTML = tdRows(me, true); $('trTheirs').innerHTML = tdRows(other, false);
  for (const [box, list] of [[$('trMine'), td.give], [$('trTheirs'), td.get]]) box.querySelectorAll('.trRow').forEach(r => r.onclick = () => {
    const k = r.dataset.k, i = list.indexOf(k);
    td.note = '';
    if (i >= 0) list.splice(i, 1); else if (list.length < MAX_ASSETS) list.push(k); else td.note = `Up to ${MAX_ASSETS} on each side.`;
    Sound.click(); renderTrade();
  });
  const go = $('trGo'), meter = $('trMeter').firstElementChild;
  const giveTxt = Season.describe(me, td.give), getTxt = Season.describe(other, td.get);
  $('trSum').innerHTML = `<div class="trSumCol"><div class="lbl">YOU GIVE</div>${giveTxt.map(t => `<div>${t}</div>`).join('') || '<div class="dim">tap your players</div>'}</div>
    <div class="trSumCol"><div class="lbl">YOU GET</div>${getTxt.map(t => `<div>${t}</div>`).join('') || '<div class="dim">tap their players</div>'}</div>`;
  const prob = (td.give.length || td.get.length) && Season.rosterProblem(me, other, td.give, td.get);
  if (td.give.length && td.get.length) {
    const pct = Season.dealOdds(other, td.give, td.get);
    meter.style.width = pct + '%'; meter.style.background = pct >= 80 ? '#5cdd8a' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
    $('trPct').textContent = `${pct}% chance they say yes`;
    go.disabled = pct < 80 || !!prob;
  } else { meter.style.width = '0%'; $('trPct').textContent = td.give.length ? 'Now pick what you want from them' : 'Pick what you want to give'; go.disabled = true; }
  $('trAsk').disabled = !td.get.length;
  $('trMsg').textContent = prob ? `${prob.team === me ? 'You' : 'The ' + tName(prob.team)} would have no ${prob.pos} left to start. Add one back.` : td.note || 'They need 80% to accept. The best player at each spot starts automatically.';
}
$('trGo').onclick = () => {
  if (!td.give.length || !td.get.length) return;
  const r = Season.makeDeal(td.other, td.give, td.get);
  Sound.td(); td.give = []; td.get = []; td.note = `Done. You got ${r.got.join(', ')}.`; renderTrade();
};
// the CPU tells you what it would take: add the cheapest thing of yours that gets the deal to 80%
$('trAsk').onclick = () => {
  const me = Season.data.team, other = td.other; Sound.click();
  if (Season.dealOdds(other, td.give, td.get) >= 80) { td.note = 'They already like this deal.'; return renderTrade(); }
  // first: if they'd be missing a position, add your cheapest guy who plays it
  const prob = Season.rosterProblem(me, other, td.give, td.get), added = [];
  if (prob && prob.team === other && td.give.length < MAX_ASSETS) {
    const fill = Season.assets(me).filter(a => a.p && !td.give.includes(a.key) && posGroup(a.p[0]) === prob.pos).sort((a, b) => a.p[3] - b.p[3]);
    for (const f of fill) if (!Season.rosterProblem(me, other, td.give.concat(f.key), td.get)) { td.give.push(f.key); added.push(f.key); break; }
  }
  if (Season.dealOdds(other, td.give, td.get) >= 80 && !Season.rosterProblem(me, other, td.give, td.get)) { td.note = `The ${tName(other)} want ${Season.describe(me, added).join(' and ')} added.`; return renderTrade(); }
  const cands = Season.assets(me).filter(a => !td.give.includes(a.key)).sort((a, b) => Season.worth(other, a, true) - Season.worth(other, b, true));
  for (const n of [1, 2]) {
    if (td.give.length + n > MAX_ASSETS) break;
    const combos = n === 1 ? cands.map(a => [a]) : cands.slice(0, 18).flatMap((a, i) => cands.slice(i + 1, 18).map(b => [a, b]));
    for (const c of combos) {
      const give = td.give.concat(c.map(a => a.key));
      if (Season.dealOdds(other, give, td.get) >= 80 && !Season.rosterProblem(me, other, give, td.get)) {
        td.give = give; td.note = `The ${tName(other)} want ${Season.describe(me, added.concat(c.map(a => a.key))).join(' and ')} added.`; return renderTrade();
      }
    }
  }
  td.give = td.give.filter(k => !added.includes(k));
  td.note = `The ${tName(other)} won't do it. Nothing you can add gets them there.`; renderTrade();
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
  const short = (id, keys) => keys.map(k => { const a = Season.asset(id, k); return !a ? '?' : a.pick ? `${tName(a.pick)} 1st (#${Season.pickSlot(a.pick)})` : `${a.p[0]} ${lastName(a.p[1])} (${a.p[3]})`; }).join(' + ');
  box.innerHTML = `<div class="ofTxt"><span class="lbl">${tName(o.from).toUpperCase()} OFFER</span> Your <b>${short(d.team, o.give)}</b> for <b>${short(o.from, o.get)}</b></div>
    <button class="gold" id="ofYes">ACCEPT</button><button id="ofNo">NO</button>`;
  $('ofYes').onclick = () => {
    const ok = o.give.every(k => Season.asset(d.team, k)) && o.get.every(k => Season.asset(o.from, k)) && !Season.rosterProblem(d.team, o.from, o.give, o.get);
    delete d.offer;
    if (ok) { const r = Season.makeDeal(o.from, o.give, o.get); Sound.td(); Season.news(`You accepted the ${tName(o.from)} offer and got ${r.got.join(', ')}.`); }
    Season.save(); renderHub();
  };
  $('ofNo').onclick = () => { delete d.offer; Season.save(); Sound.click(); renderHub(); };
};
