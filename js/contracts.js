// ---- Contracts, salary cap and free agency (franchise mode) ----
// every player's deal lives in his info slot: p[6].con = { sal: millions per year, yrs: seasons left (counting this one) }
// offseason order: RE-SIGN your expiring guys -> FREE AGENCY (3 days, CPU teams bid too) -> combine -> draft -> next year
const CAP = 225;          // salary cap in millions
const MIN_SAL = 0.8;
const POS_PAY = { QB: 1.35, OL: 0.95, DL: 1.05, WR: 1.0, TE: 0.8, RB: 0.7, LB: 0.85, CB: 0.95, S: 0.8 };
const cmoney = v => `$${v >= 10 ? Math.round(v) : v.toFixed(1)}M`;

const Contracts = {
  // what a player is worth on the market (per year)
  value(p) {
    const fa = typeof footballAge === 'function' && p[6] && p[6].age ? footballAge(p[0], p[6].age) : 27;
    const q = clamp((p[3] - 60) / 39, 0, 1), base = MIN_SAL + 44 * Math.pow(q, 2.6);
    return Math.max(MIN_SAL, Math.round(base * (POS_PAY[p[0]] || 1) * (fa >= 33 ? 0.55 : fa >= 31 ? 0.75 : 1) * 10) / 10);
  },
  // how many years he wants: young guys want long deals, vets want short ones
  wantYears(p) { const fa = p[6] && p[6].age ? footballAge(p[0], p[6].age) : 27; return fa >= 32 ? 1 : fa >= 30 ? 2 : fa <= 25 ? 4 : 3; },
  rookieDeal(p) { return { sal: Math.round((MIN_SAL + Math.max(0, p[3] - 62) * 0.32) * 10) / 10, yrs: 4 }; },
  give(p, con) { p[6] = Object.assign({}, p[6] || {}, { con }); return p; },
  con(p) { return p && p[6] && p[6].con; },

  // first time a franchise needs money: hand everybody a contract, then make sure every team fits under the cap
  ensure() {
    const R = Season.ensureRosters();
    for (const id in R) {
      if (Season.bench) Season.bench(id);
      let fresh = false;
      for (const p of this.all(id)) if (!this.con(p) && !(p[6] && p[6].cap)) {
        fresh = true;
        const fa = p[6] && p[6].age ? footballAge(p[0], p[6].age) : 27;
        this.give(p, p[6] && p[6].rookie ? this.rookieDeal(p) : { sal: this.value(p), yrs: fa >= 32 ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 5) });
      }
      const pay = this.payroll(id);
      if (fresh && pay > CAP * 0.9) { const k = CAP * 0.9 / pay; for (const p of this.all(id)) { const c = this.con(p); if (c) c.sal = Math.max(MIN_SAL, Math.round(c.sal * k * 10) / 10); } }
    }
  },
  all(id) { const R = Season.ensureRosters()[id]; return R.off.concat(R.def, R.bench || []).filter(Boolean); },
  payroll(id) { return Math.round(this.all(id).reduce((a, p) => a + ((this.con(p) || {}).sal || 0), 0) * 10) / 10; },
  room(id) { return Math.round((CAP - this.payroll(id)) * 10) / 10; },

  // take a player off a team (starters leave a hole that gets filled right after)
  remove(id, p) {
    const R = Season.ensureRosters()[id];
    for (const side of ['off', 'def']) { const i = R[side].indexOf(p); if (i >= 0) R[side][i] = null; }
    if (R.bench) { const j = R.bench.indexOf(p); if (j >= 0) R.bench.splice(j, 1); }
  },
  // every empty starting spot: best backup at that position, or a cheap young call-up
  fillHoles(id) {
    const R = Season.ensureRosters()[id], base = TEAMS.find(t => t.id === id), bench = Season.bench(id);
    for (const side of ['off', 'def']) R[side].forEach((p, i) => {
      if (p) return;
      const pos = base[side][i][0];
      let bi = -1; bench.forEach((b, j) => { if (posGroup(b[0]) === posGroup(pos) && (bi < 0 || b[3] > bench[bi][3])) bi = j; });
      if (bi >= 0) R[side][i] = bench.splice(bi, 1)[0];
      else R[side][i] = this.scrub(pos);
    });
    Season.setLineup(id);
  },
  scrub(pos) { const [s0, s1] = ROOKIE_SPD[pos] || [75, 88]; return this.give([pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), Math.round(rand(60, 65)), Math.round(rand(s0, s1) - 2), Math.floor(Math.random() * 6), { age: Math.round(rand(23, 26)) }], { sal: MIN_SAL, yrs: 1 }); },

  // ---------- offseason ----------
  start() {
    const d = Season.data;
    this.ensure();
    const R = Season.ensureRosters(), pool = [], mine = [];
    for (const id in R) for (const p of this.all(id)) {
      const c = this.con(p); if (!c) continue;
      c.yrs--;
      if (c.yrs > 0) continue;
      if (id === d.team) { mine.push(p); continue; }
      // CPU teams keep most of their good players (if they can pay them)
      const keep = chance(p[3] >= 88 ? 0.92 : p[3] >= 80 ? 0.72 : p[3] >= 72 ? 0.45 : 0.2);
      const ask = this.value(p), can = this.room(id) + c.sal;
      if (keep && footballAge(p[0], p[6].age || 27) < 34 && can >= ask * 0.85) { c.sal = Math.min(ask, Math.round(can * 10) / 10); c.yrs = this.wantYears(p); } // stars usually stay (a little hometown discount)
      else { this.remove(id, p); pool.push(this.listing(p, id)); }
    }
    for (const id in R) if (id !== d.team) this.fillHoles(id);
    // a few veterans nobody signed last year are out there too
    for (let i = 0; i < 14; i++) { const pos = pick(BACKUP_POS), [s0, s1] = ROOKIE_SPD[pos]; const p = [pos, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), Math.round(rand(66, 79)), Math.round(rand(s0, s1) - 4), Math.floor(Math.random() * 6), { age: Math.round(rand(27, 32)) }]; pool.push(this.listing(p, null)); }
    d.fa = { year: d.year, stage: 'resign', day: 1, pool, mine: mine.map(p => ({ t: p, ask: { sal: this.value(p), yrs: this.wantYears(p) } })), log: [] };
    Season.save();
  },
  listing(p, from) { return { t: p, from, ask: { sal: this.value(p), yrs: this.wantYears(p) } }; },
  // re-sign one of your own guys at his asking price
  resign(i) {
    const d = Season.data, m = d.fa.mine[i]; if (!m) return 'gone';
    const old = (this.con(m.t) || {}).sal || 0;
    if (this.room(d.team) + old < m.ask.sal) return 'cap';
    this.con(m.t).sal = m.ask.sal; this.con(m.t).yrs = m.ask.yrs; m.done = 'kept'; Season.save(); return 'ok';
  },
  letGo(i) {
    const d = Season.data, m = d.fa.mine[i]; if (!m) return;
    this.remove(d.team, m.t); m.done = 'gone'; d.fa.pool.push(this.listing(m.t, d.team));
    Season.save();
  },
  toFreeAgency() {
    const d = Season.data;
    d.fa.mine.forEach((m, i) => { if (!m.done) this.letGo(i); }); // anyone you didn't decide on hits the market
    this.fillHoles(d.team);
    d.fa.stage = 'fa'; Season.save();
  },
  // will he sign for this? 0-100 (80+ = yes). Money, years he wants, how good your team is, and later days = less picky
  interest(L, sal, yrs, teamId, day = 1) {
    const ratio = sal / L.ask.sal, yrsFit = -Math.abs(yrs - L.ask.yrs) * 7;
    const team = (Season.ovr(teamId) - 80) * 1.5, home = L.from === teamId ? 6 : 0;
    return clamp(Math.round(78 + (ratio - 1) * 150 + yrsFit + team + home + (day - 1) * 6), 0, 100);
  },
  offer(k, sal, yrs) {
    const d = Season.data, L = d.fa.pool[k]; if (!L) return { ok: false, why: 'gone' };
    if (this.room(d.team) < sal) return { ok: false, why: 'cap' };
    const n = this.interest(L, sal, yrs, d.team, d.fa.day);
    if (n < 80) return { ok: false, why: 'no', n };
    this.sign(d.team, k, sal, yrs); return { ok: true };
  },
  sign(id, k, sal, yrs) {
    const d = Season.data, pool = d.fa && d.fa.stage === 'fa' ? d.fa.pool : d.faFree, L = pool.splice(k, 1)[0]; if (!L) return;
    this.give(L.t, { sal: Math.round(sal * 10) / 10, yrs });
    Season.bench(id).push(L.t); Season.setLineup(id);
    const line = `${tName(id)} sign ${L.t[0]} ${L.t[1]} (${L.t[3]}): ${yrs} yr${yrs > 1 ? 's' : ''}, ${cmoney(sal)} a year`;
    if (d.fa && d.fa.stage === 'fa') d.fa.log.unshift(line);
    Season.news(`FREE AGENCY: ${line}`);
    Season.save();
  },
  // the CPU teams make their moves for the day
  cpuDay() {
    const d = Season.data, fa = d.fa, R = Season.ensureRosters();
    const ids = Object.keys(R).filter(i => i !== d.team);
    const list = fa.pool.slice().sort((a, b) => b.t[3] - a.t[3]);
    for (const L of list) {
      if (L.t[3] < 68 || !chance(fa.day === 1 ? 0.5 : fa.day === 2 ? 0.4 : 0.35)) continue;
      let best = null, bs = -99;
      for (const id of ids) {
        if (this.room(id) < L.ask.sal * 0.9) continue;
        const f = Season.fit(id, Object.assign(L.t.slice(), { pot: 'C' })), gain = f ? f.gain : -10;
        const sc = gain + rand(-3, 3); if (sc > bs) { bs = sc; best = id; }
      }
      if (best && bs > -2) this.sign(best, fa.pool.indexOf(L), L.ask.sal * rand(0.92, 1.12), L.ask.yrs);
    }
    for (const L of fa.pool) L.ask.sal = Math.max(MIN_SAL, Math.round(L.ask.sal * 0.9 * 10) / 10); // still unsigned: asks come down
  },
  nextDay() {
    const fa = Season.data.fa;
    this.cpuDay();
    if (fa.day >= 3) return this.finish();
    fa.day++; Season.save();
  },
  finish() {
    const d = Season.data;
    for (const L of d.fa.pool) L.ask.sal = Math.max(MIN_SAL, Math.round(L.ask.sal * 0.6 * 10) / 10); // whoever's left will take less in-season
    d.faFree = d.fa.pool.filter(L => L.t[3] >= 64).slice(0, 40);
    d.fa.stage = 'done'; d.fa.pool = [];
    const R = Season.ensureRosters(); for (const id in R) this.fillHoles(id);
    Season.save();
  },
  release(p) {
    const d = Season.data, id = d.team;
    this.remove(id, p); this.fillHoles(id);
    const L = this.listing(p, id); L.ask.sal = Math.max(MIN_SAL, Math.round(L.ask.sal * 0.7 * 10) / 10);
    if (d.fa && d.fa.stage === 'fa') d.fa.pool.push(L); else (d.faFree || (d.faFree = [])).push(L);
    Season.news(`${tName(id)} release ${p[0]} ${p[1]} (${p[3]})`);
    Season.save();
  }
};

// ---------------- screens ----------------
screens.push('contracts'); menuScreens.push('contracts');
(() => {
  const el = document.createElement('div'); el.id = 'contracts'; el.className = 'screen';
  el.innerHTML = `<h2 id="ctTitle">Offseason</h2><div id="ctBody"></div><div class="row" id="ctBtns"></div><div id="ctToast"></div>`;
  $('stage').appendChild(el);
  // in-season free agents button in the hub
  const b = document.createElement('button'); b.id = 'shFA'; b.textContent = 'FREE AGENTS'; b.onclick = () => { Sound.click(); ctOpenFree(); };
  $('shDepth').parentNode.insertBefore(b, $('shDepth').nextSibling);
})();
let ctPos = 'ALL', ctSel = null, ctMode = '', ctYrs = 3, ctSal = 1;
const ctToast = t => { const e = $('ctToast'); e.textContent = t; e.classList.add('on'); clearTimeout(ctToast.t); ctToast.t = setTimeout(() => e.classList.remove('on'), 2400); };
const capLine = id => { const pay = Contracts.payroll(id), room = CAP - pay; return `<div class="ctCap"><span>PAYROLL <b>${cmoney(pay)}</b> of ${cmoney(CAP)}</span><span class="${room < 0 ? 'neg' : ''}">CAP ROOM <b>${cmoney(room)}</b></span><i><u style="width:${Math.min(100, pay / CAP * 100)}%"></u></i></div>`; };
const ctRow = (p, right, cls = '') => `<div class="ctRow ${cls}"><span class="pos">${p[0]}</span><b class="ov">${p[3]}</b><span class="nm">${p[1]}<i>AGE ${(p[6] && p[6].age) || '?'}  ·  SPD ${p[4]}</i></span>${right}</div>`;
function ctOpen() {
  const d = Season.data;
  if (!d.fa || d.fa.year !== d.year) Contracts.start();
  ctSel = null; ctPos = 'ALL';
  ctRender(); show('contracts');
}
function ctRender() {
  const d = Season.data, fa = d.fa, me = d.team;
  if (fa.stage === 'resign') {
    $('ctTitle').textContent = 'Re-Sign Players';
    const rows = fa.mine.map((m, i) => ctRow(m.t, m.done === 'kept' ? `<em class="ok">RE-SIGNED ${m.ask.yrs} YR · ${cmoney(m.ask.sal)}</em>` : m.done === 'gone' ? `<em class="bad">LET GO</em>` :
      `<span class="ask">wants ${m.ask.yrs} yr${m.ask.yrs > 1 ? 's' : ''} · ${cmoney(m.ask.sal)}</span><button data-r="${i}">RE-SIGN</button><button class="dim" data-g="${i}">LET GO</button>`)).join('');
    $('ctBody').innerHTML = `<div class="dHead">YEAR ${d.year} OFFSEASON  ·  CONTRACTS ENDING</div>${capLine(me)}
      <div class="ctList">${rows || '<div class="note">Nobody on your team has an expiring contract this year.</div>'}</div>
      <div class="note">Anyone you don't re-sign goes to free agency, where other teams can grab him.</div>`;
    $('ctBtns').innerHTML = `<button class="big gold" id="ctGo">GO TO FREE AGENCY</button>`;
    $('ctGo').onclick = () => { Sound.click(); Contracts.toFreeAgency(); ctRender(); };
    document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const r = Contracts.resign(+b.dataset.r); if (r === 'cap') ctToast('Not enough cap room. Let someone go or release a player first.'); else Sound.td(); ctRender(); });
    document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { Sound.click(); Contracts.letGo(+b.dataset.g); ctRender(); });
    return;
  }
  // free agency
  ctMode = 'fa';
  $('ctTitle').textContent = `Free Agency  ·  Day ${fa.day} of 3`;
  ctRenderMarket(fa.pool, true);
}
// the market (offseason or in-season)
function ctRenderMarket(pool, offseason) {
  const d = Season.data, me = d.team, day = offseason ? d.fa.day : 3;
  const tabs = `<div class="tlTabs dFilt">${['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'].map(f => `<button data-f="${f}" class="${ctPos === f ? 'on' : ''}">${f}</button>`).join('')}</div>`;
  const list = pool.map((L, k) => [L, k]).filter(([L]) => ctPos === 'ALL' || L.t[0] === ctPos).sort((a, b) => b[0].t[3] - a[0].t[3]).slice(0, 40);
  const rows = list.map(([L, k]) => { const f = Season.fit(me, Object.assign(L.t.slice(), { pot: 'C' }));
    const note = f && L.t[3] > f.cur[3] ? `<span class="up">starts over ${lastName(f.cur[1])} (${f.cur[3]})</span>` : f ? `<span>backup</span>` : '';
    return ctRow(L.t, `${note}<span class="ask">asks ${L.ask.yrs} yr · ${cmoney(L.ask.sal)}</span>`, 'pick' + (ctSel === k ? ' sel' : '')).replace('class="ctRow', `data-k="${k}" class="ctRow`); }).join('');
  let deal = '';
  if (ctSel != null && pool[ctSel]) {
    const L = pool[ctSel], n = Contracts.interest(L, ctSal, ctYrs, me, day);
    deal = `<div class="ctDeal"><div class="ctDh">OFFER  ·  ${L.t[0]} ${L.t[1]} (${L.t[3]})</div>
      <label>YEARS <span class="ctYrs">${[1, 2, 3, 4, 5].map(y => `<button data-y="${y}" class="${ctYrs === y ? 'on' : ''}">${y}</button>`).join('')}</span></label>
      <label>PER YEAR <input type="range" id="ctSal" min="${Math.max(MIN_SAL, L.ask.sal * 0.5).toFixed(1)}" max="${(L.ask.sal * 1.6).toFixed(1)}" step="0.1" value="${ctSal}"><b id="ctSalV">${cmoney(ctSal)}</b></label>
      <div class="ctInt"><span>WILL HE SIGN?</span><i><u id="ctIntBar" style="width:${n}%" class="${n >= 80 ? 'yes' : ''}"></u></i><b id="ctIntN">${n}%</b></div>
      <button class="big gold" id="ctOffer">${n >= 80 ? 'SIGN HIM' : 'MAKE OFFER'}</button><div class="note">80% or more and he signs. Your team's rating and the years he wants matter too.</div></div>`;
  }
  const mine = Contracts.all(me).filter(p => !(p[6] && p[6].cap)).sort((a, b) => b[3] - a[3]).map(p => { const c = Contracts.con(p) || {}; return `<div class="ctMine"><span>${p[0]} ${lastName(p[1])} <i>${p[3]}</i></span><em>${c.sal ? cmoney(c.sal) : ''} · ${c.yrs || 0}y</em><button data-x="${Season.ensureRosters()[me].bench.includes(p) ? 'b' : 's'}:${p[1]}">CUT</button></div>`; }).join('');
  $('ctBody').innerHTML = `${capLine(me)}<div class="ctWrap"><div class="ctBoard">${tabs}${rows || '<div class="note">Nobody left at that spot.</div>'}</div>
    <div class="ctSide">${deal || (offseason && d.fa.log.length ? `<div class="leadHead">LATEST SIGNINGS</div>${d.fa.log.slice(0, 8).map(t => `<div class="ctLog">${t}</div>`).join('')}` : '<div class="note">Tap a player to make him an offer.</div>')}
      <div class="leadHead" style="margin-top:8px">YOUR ROSTER</div><div class="ctMineL">${mine}</div></div></div>`;
  $('ctBtns').innerHTML = offseason ? `<button class="big gold" id="ctNext">${d.fa.day >= 3 ? 'FINISH FREE AGENCY' : `END DAY ${d.fa.day}`}</button>` : `<button class="big gold" id="ctBack">BACK TO THE SEASON</button>`;
  if (offseason) $('ctNext').onclick = () => { Sound.click(); ctSel = null; const last = d.fa.day >= 3; Contracts.nextDay(); if (last) { ctToast('Free agency is over. On to the combine and the draft.'); openDraftAfterFA(); } else ctRender(); };
  else $('ctBack').onclick = () => { Sound.click(); renderHub(); };
  const redraw = () => offseason ? ctRender() : ctRenderMarket(d.faFree, false);
  document.querySelectorAll('#ctBody .dFilt button').forEach(b => b.onclick = () => { Sound.click(); ctPos = b.dataset.f; ctSel = null; redraw(); });
  document.querySelectorAll('#ctBody .ctRow.pick').forEach(r => r.onclick = () => { Sound.click(); ctSel = +r.dataset.k; const L = pool[ctSel]; ctYrs = L.ask.yrs; ctSal = L.ask.sal; redraw(); });
  document.querySelectorAll('.ctYrs button').forEach(b => b.onclick = () => { Sound.click(); ctYrs = +b.dataset.y; redraw(); });
  const sl = $('ctSal');
  if (sl) sl.oninput = () => { ctSal = +sl.value; const n = Contracts.interest(pool[ctSel], ctSal, ctYrs, me, day); $('ctSalV').textContent = cmoney(ctSal); $('ctIntN').textContent = n + '%'; $('ctIntBar').style.width = n + '%'; $('ctIntBar').classList.toggle('yes', n >= 80); $('ctOffer').textContent = n >= 80 ? 'SIGN HIM' : 'MAKE OFFER'; };
  if ($('ctOffer')) $('ctOffer').onclick = () => {
    const L = pool[ctSel];
    if (Contracts.room(me) < ctSal) { ctToast('Not enough cap room. Cut someone or offer less.'); return; }
    const n = Contracts.interest(L, ctSal, ctYrs, me, day);
    if (n < 80) { ctToast(`${lastName(L.t[1])} says no. Offer more money or the years he wants.`); Sound.click(); return; }
    Sound.td();
    Contracts.sign(me, ctSel, ctSal, ctYrs);
    ctToast(`${L.t[1]} signs! ${ctYrs} yr${ctYrs > 1 ? 's' : ''}, ${cmoney(ctSal)} a year.`); ctSel = null; redraw();
  };
  document.querySelectorAll('.ctMine button').forEach(b => b.onclick = () => {
    if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'SURE?'; return; }
    const name = b.dataset.x.slice(2), p = Contracts.all(me).find(q => q[1] === name); if (!p) return;
    Sound.click(); Contracts.release(p); ctToast(`${name} released. ${cmoney((Contracts.con(p) || {}).sal || 0)} of cap room back.`); ctSel = null; redraw();
  });
}
function ctOpenFree() {
  const d = Season.data; Contracts.ensure();
  d.faFree = d.faFree || [];
  ctSel = null; ctPos = 'ALL';
  $('ctTitle').textContent = 'Free Agents';
  ctRenderMarket(d.faFree, false); show('contracts');
}
// hook into the offseason: season over -> re-sign + free agency -> combine + draft
const _openDraftCT = openDraft;
function openDraftAfterFA() { _openDraftCT(); }
openDraft = function () {
  const d = Season.data;
  if (!d.draft && !(d.fa && d.fa.year === d.year && d.fa.stage === 'done')) return ctOpen();
  _openDraftCT();
};
// hub: contract + cap info on the ROSTER tab, FREE AGENTS button during the regular season
{
  const _hub = renderHub;
  renderHub = function () {
    _hub();
    const d = Season.data; if (!d) return;
    $('shFA').style.display = d.phase === 'regular' ? '' : 'none';
    const nx = $('shNext2'); if (nx && !d.draft && !(d.fa && d.fa.year === d.year && d.fa.stage === 'done')) nx.textContent = `OFFSEASON: RE-SIGN + FREE AGENCY`;
  };
  const _tab = renderHubTab;
  renderHubTab = function () {
    _tab();
    if (hubTab !== 'ros' || !Season.data) return;
    Contracts.ensure();
    const me = Season.data.team, box = $('shStand');
    box.insertAdjacentHTML('afterbegin', capLine(me));
    // add salary + years to each row
    const all = Contracts.all(me);
    box.querySelectorAll('.leadRow').forEach(r => { const nm = r.querySelector('span'); if (!nm) return; const p = all.find(q => nm.textContent.includes(q[1])); const c = p && Contracts.con(p); if (c) r.querySelector('i').insertAdjacentHTML('afterbegin', `${cmoney(c.sal)} · ${c.yrs}Y  ·  `); });
  };
}
// leftover free agents stay on the market into the new season
{ const _ny = Season.nextYear; Season.nextYear = function () { const keep = this.data.faFree; const ch = _ny.call(this); if (keep) { this.data.faFree = keep; this.save(); } return ch; }; }
