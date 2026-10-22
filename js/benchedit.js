// ---- Roster editor: a team's starters + backups. Tap anyone for his player card (playeredit.js); add or cut backups ----
// Quick Game: edits a team's default roster (backups saved on this device in 'bobbleBenches', changed starters in 'bobbleStarters';
// both are also used when you start a new Season).
// Season: edits YOUR franchise's players (from the Depth Chart).
screens.push('benchEd'); menuScreens.push('benchEd');
(() => {
  const el = document.createElement('div'); el.id = 'benchEd'; el.className = 'screen';
  el.innerHTML = `
    <div class="beTop"><h2>Roster</h2><div class="tlTabs" id="beTeams"></div></div>
    <div id="beHead"></div>
    <div id="beList"></div>
    <div id="beMsg"></div>
    <div class="row"><button id="beAdd">ADD BACKUP</button><button id="beReset">RESET TO REAL</button><button class="big gold" id="beDone">DONE</button></div>`;
  document.getElementById('stage').appendChild(el);
})();

const BenchEd = {
  KEY: 'bobbleBenches', MAX: 10,
  orig: {},      // the real depth chart for each NFL team, so RESET can put it back
  ctx: null,     // { kind: 'quick', ids: [away, home], cur } or { kind: 'season', id }
  msg: '',

  store() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { return {}; } },
  saveStore(s) { try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch (e) {} },
  clean(p) {
    const pos = BACKUP_POS.includes(p && p[0]) ? p[0] : 'WR', n = v => Math.round(+v);
    return CT.ex([pos, String((p && p[1]) || 'Backup').replace(/[<>&"'`\\]/g, '').trim().slice(0, 18) || 'Backup', clamp(n(p && p[2]) || 0, 0, 99),
      clamp(n(p && p[3]) || 65, 40, 99), clamp(n(p && p[4]) || 80, 40, 99), clamp(isFinite(n(p && p[5])) ? n(p[5]) : 3, 0, 5)], p && p[6]); // keeps age + ratings
  },
  // a team's default backups as one list: QB2, RB2, then the rest
  listOf(t) { if (t.custom) return (t.backups || []).map(p => this.clean(p)); return [t.qb2, t.rb2, ...(t.bench || [])].filter(p => Array.isArray(p) && p[0] && p[1]).map(p => this.clean(p)); },
  // and back: first QB = qb2 (backup QB in games), first RB = rb2 (RB rotation), everybody else = bench
  setList(t, list) {
    const qi = list.findIndex(p => p[0] === 'QB'), ri = list.findIndex(p => p[0] === 'RB');
    t.qb2 = qi >= 0 ? list[qi] : null; t.rb2 = ri >= 0 ? list[ri] : null;
    t.bench = list.filter((p, i) => i !== qi && i !== ri);
  },
  remember(t) { if (t && !t.custom && !this.orig[t.id]) this.orig[t.id] = JSON.parse(JSON.stringify({ qb2: t.qb2 || null, rb2: t.rb2 || null, bench: t.bench || [] })); },
  // put saved edits onto the teams (runs at start and whenever the team list is rebuilt)
  applyAll() {
    const s = this.store();
    for (const t of TEAMS) {
      if (t.custom) continue; // created teams keep their backups on the team itself (Create a Team > ROSTER)
      this.remember(t); if (Array.isArray(s[t.id])) this.setList(t, s[t.id].map(p => this.clean(p)));
    }
  },
  // created team: write the list onto the team and save My Teams
  saveCustom(t, list) {
    for (const x of [t, CT.mine.find(m => m.uid === t.uid)]) if (x) { x.backups = list.map(p => p.slice(0, 7)); CT.derive(x); }
    CT.save();
  },

  // ---- open ----
  openQuick(side) {
    const ids = [TEAMS[sel.idx[1]].id, TEAMS[sel.idx[0]].id]; // away, home (same order as the screen)
    this.ctx = { kind: 'quick', ids, cur: ids[side === 0 ? 1 : 0] }; this.msg = ''; this.render(); show('benchEd');
  },
  openSeason() { this.ctx = { kind: 'season', id: Season.data.team }; this.msg = ''; this.render(); show('benchEd'); },

  team() { return TEAMS.find(t => t.id === (this.ctx.kind === 'season' ? this.ctx.id : this.ctx.cur)); },
  rows() { return this.ctx.kind === 'season' ? Season.bench(this.ctx.id) : (this.ctx.list = this.ctx.list && this.ctx.listId === this.ctx.cur ? this.ctx.list : (this.ctx.listId = this.ctx.cur, this.listOf(this.team()))); },
  commit() {
    if (this.ctx.kind === 'season') { Season.save(); return; }
    const t = this.team();
    if (t.custom) { // starters live on the team too: copy them to My Teams
      const m = CT.mine.find(x => x.uid === t.uid); if (m && m !== t) { m.off = t.off; m.def = t.def; m.k = t.k; m.p = t.p; }
      this.saveCustom(t, this.ctx.list); return;
    }
    const s = this.store(); s[t.id] = this.ctx.list; this.saveStore(s); this.setList(t, this.ctx.list.map(p => p.slice()));
    StarterEd.save(t);
  },
  // everybody on the card editor's list: starters (spot locked), kicker + punter (Quick Game), then the backups in the order shown
  starters() {
    const c = this.ctx, t = this.team(), R = c.kind === 'season' ? Season.ensureRosters()[c.id] : t, id = t.id, L = [];
    for (const side of ['off', 'def']) R[side].forEach(p => { if (p && !(p[6] && p[6].cap)) L.push({ p, teamId: id, tag: 'STARTER', real: c.kind !== 'season' && !t.custom }); }); // never your Career guy
    if (c.kind !== 'season') { if (t.k) L.push({ p: t.k, kick: 'K', teamId: id, real: !t.custom }); if (t.p) L.push({ p: t.p, kick: 'P', teamId: id, real: !t.custom }); }
    if (c.kind !== 'season' && !t.custom) { const o = StarterEd.orig[id]; if (o) L.forEach((e, i) => { const r = i < 16 ? (i < 8 ? o.off[i] : o.def[i - 8]) : e.kick === 'K' ? o.k : o.p; if (r) e.orig = JSON.parse(JSON.stringify(r)); }); }
    return L;
  },
  benchOrder(rows) { const order = p => BACKUP_POS.indexOf(p[0]); return rows.map((p, i) => [p, i]).sort((a, b) => order(a[0]) - order(b[0]) || b[0][3] - a[0][3]); },
  peList() {
    const season = this.ctx.kind === 'season', id = this.team().id;
    return this.starters().concat(this.benchOrder(this.rows()).map(([p, i]) => ({ p, bi: i, teamId: id, posList: BACKUP_POS, tag: season && Season.hurt(p) ? 'HURT' : 'BACKUP' })));
  },
  edit(k) {
    const t = this.team(), season = this.ctx.kind === 'season', team = season ? Season.team(t.id) : t;
    PlayerEd.open({ title: `${team.city} ${team.name}`.toUpperCase(), team, list: this.peList(), i: k, onChange: () => this.commit(), onClose: () => { this.commit(); this.render(); } });
  },

  render() {
    const c = this.ctx, t = this.team(), rows = this.rows(), season = c.kind === 'season', L = this.peList(), nSt = this.starters().length;
    $('beTeams').innerHTML = season ? '' : c.ids.map((id, i) => `<button data-id="${id}" class="${id === c.cur ? 'on' : ''}">${i ? 'HOME' : 'AWAY'}  ${tName(id).toUpperCase()}</button>`).join('');
    $('beHead').innerHTML = `${t.city.toUpperCase()} ${t.name.toUpperCase()}  ·  ${rows.length} BACKUP${rows.length === 1 ? '' : 'S'}<span>${season ? 'Your franchise. Tap a player to edit him. Change who starts in the Depth Chart.' : 'Tap a player to edit him. Used in Quick Games and new Seasons. The first QB and RB come in when a starter is hurt or tired.'}</span>`;
    const row = k => { const e = L[k], hurt = season && Season.hurt(e.p); return PlayerEd.row(e, k, k >= nSt ? `<button class="beX" data-k="${k}">${hurt ? 'CUT (HURT)' : 'CUT'}</button>` : ''); };
    const ks = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, j) => row(a + j)).join('');
    $('beList').innerHTML = `<div class="tlSec">STARTERS${StarterEd.edited(t) && !season ? '<span class="tlBkN">CHANGED</span>' : ''}</div><div class="peRows">${ks(0, nSt)}</div>
      <div class="tlSec">BACKUPS <span class="tlBkN">${rows.length} / ${this.MAX}</span></div>
      <div class="peRows">${ks(nSt, L.length) || '<div class="beEmpty">No backups. Tap ADD BACKUP.</div>'}</div>`;
    $('beMsg').textContent = this.msg;
    $('beAdd').disabled = rows.length >= this.MAX;
    $('beReset').style.display = !season && this.orig[t.id] ? '' : 'none';
    this.wire(L);
  },
  wire(L) {
    const rows = this.rows();
    document.querySelectorAll('#beTeams button').forEach(b => b.onclick = () => { this.ctx.cur = b.dataset.id; this.ctx.list = null; this.msg = ''; this.render(); });
    PlayerEd.wireRows($('beList'), k => this.edit(k));
    document.querySelectorAll('#beList .beX').forEach(b => b.onclick = () => {
      const p = L[+b.dataset.k].p;
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'SURE?'; return; }
      if (this.ctx.kind === 'season') Contracts.remove(this.ctx.id, p); else rows.splice(rows.indexOf(p), 1);
      this.msg = `${p[1]} is off the team.`; this.commit(); this.render();
    });
  },
  add() {
    const rows = this.rows(); if (rows.length >= this.MAX) return;
    const need = BACKUP_POS.find(pos => !rows.some(p => p[0] === pos)) || 'WR';
    const p = this.clean([need, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), 65, POS_SPD[need] || 80, Math.floor(Math.random() * 6)]);
    if (this.ctx.kind === 'season') { p[6] = { age: 24 }; if (typeof Contracts !== 'undefined') Contracts.give(p, { sal: MIN_SAL, yrs: 1 }); }
    rows.push(p); this.msg = `Added a ${p[0]}.`; this.commit(); this.render();
    this.edit(this.peList().findIndex(e => e.p === p)); // straight to his card
  },
  reset() {
    const t = this.team(), o = this.orig[t.id]; if (!o) return;
    const s = this.store(); delete s[t.id]; this.saveStore(s); StarterEd.reset(t);
    Object.assign(t, JSON.parse(JSON.stringify(o))); this.ctx.list = null; this.msg = 'Back to the real roster.'; this.render();
  },
  done() { this.commit(); if (this.ctx.kind === 'season') { openDepth(); } else { show('select'); renderSelect(); } }
};
$('beAdd').onclick = () => BenchEd.add();
$('beReset').onclick = () => BenchEd.reset();
$('beDone').onclick = () => BenchEd.done();

// saved edits go on as soon as the game loads, and again whenever the team list gets rebuilt (custom teams / seasons)
BenchEd.applyAll();
for (const k of ['useAll', 'useLeague']) { const f = CT[k]; CT[k] = function (...a) { const r = f.apply(this, a); BenchEd.applyAll(); return r; }; }

// entry points: Matchup screen (one button per team) and the Season depth chart
(() => {
  for (const [id, side] of [['pAway', 1], ['pHome', 0]]) {
    const b = document.createElement('button'); b.className = 'beOpen'; b.textContent = 'ROSTER';
    b.onclick = e => { e.stopPropagation(); BenchEd.openQuick(side); };
    $(id).appendChild(b);
  }
  const d = document.createElement('button'); d.id = 'dcBench'; d.textContent = 'EDIT PLAYERS';
  d.onclick = () => BenchEd.openSeason();
  $('dcAuto').after(d);
})();
