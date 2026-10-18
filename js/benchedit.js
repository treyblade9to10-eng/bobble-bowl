// ---- Backups editor: change who's on a team's bench (name, number, position, OVR, speed, skin), add or cut backups ----
// Quick Game: edits a team's default backups (saved on this device in 'bobbleBenches', also used when you start a new Season).
// Season: edits YOUR franchise's bench (from the Depth Chart).
screens.push('benchEd'); menuScreens.push('benchEd');
(() => {
  const el = document.createElement('div'); el.id = 'benchEd'; el.className = 'screen';
  el.innerHTML = `
    <div class="beTop"><h2>Backups</h2><div class="tlTabs" id="beTeams"></div></div>
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
    return [pos, String((p && p[1]) || 'Backup').replace(/[<>&"'`\\]/g, '').trim().slice(0, 18) || 'Backup', clamp(n(p && p[2]) || 0, 0, 99),
      clamp(n(p && p[3]) || 65, 40, 99), clamp(n(p && p[4]) || 80, 40, 99), clamp(isFinite(n(p && p[5])) ? n(p[5]) : 3, 0, 5)];
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
    for (const x of [t, CT.mine.find(m => m.uid === t.uid)]) if (x) { x.backups = list.map(p => p.slice(0, 6)); CT.derive(x); }
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
    const t = this.team(); if (t.custom) { this.saveCustom(t, this.ctx.list); return; }
    const s = this.store(); s[t.id] = this.ctx.list; this.saveStore(s); this.setList(t, this.ctx.list.map(p => p.slice()));
  },

  render() {
    const c = this.ctx, t = this.team(), rows = this.rows(), season = c.kind === 'season';
    $('beTeams').innerHTML = season ? '' : c.ids.map((id, i) => `<button data-id="${id}" class="${id === c.cur ? 'on' : ''}">${i ? 'HOME' : 'AWAY'}  ${tName(id).toUpperCase()}</button>`).join('');
    $('beHead').innerHTML = `${t.city.toUpperCase()} ${t.name.toUpperCase()}  ·  ${rows.length} BACKUP${rows.length === 1 ? '' : 'S'}<span>${season ? 'Your franchise bench. Tap a position to change it.' : 'Used in Quick Games and new Seasons. The first QB and RB come in when a starter is hurt or tired.'}</span>`;
    const order = p => BACKUP_POS.indexOf(p[0]);
    $('beList').innerHTML = rows.map((p, i) => [p, i]).sort((a, b) => order(a[0]) - order(b[0]) || b[0][3] - a[0][3]).map(([p, i]) => {
      const hurt = season && Season.hurt(p);
      return `<div class="beP" data-i="${i}">
        <button class="bePos" title="Change position">${p[0]}</button>
        <input class="bePn" maxlength="18" value="${esc(p[1])}">
        <input class="beNo" type="number" min="0" max="99" value="${p[2]}">
        <label class="beR"><span>OVR</span><input type="range" min="40" max="99" data-k="3" value="${p[3]}"><b>${p[3]}</b></label>
        <label class="beR"><span>SPD</span><input type="range" min="40" max="99" data-k="4" value="${p[4]}"><b>${p[4]}</b></label>
        <button class="tlSk" style="background:${SKIN[p[5] == null ? 3 : p[5]]}" title="Skin tone"></button>
        <button class="beX">${hurt ? 'CUT (HURT)' : 'CUT'}</button></div>`;
    }).join('') || '<div class="beEmpty">No backups. Tap ADD BACKUP.</div>';
    $('beMsg').textContent = this.msg;
    $('beAdd').disabled = rows.length >= this.MAX;
    $('beReset').style.display = !season && this.orig[t.id] ? '' : 'none';
    this.wire();
  },
  wire() {
    const rows = this.rows(), get = e => rows[+e.closest('.beP').dataset.i], stop = e => e.stopPropagation();
    document.querySelectorAll('#beTeams button').forEach(b => b.onclick = () => { Sound.click(); this.ctx.cur = b.dataset.id; this.ctx.list = null; this.msg = ''; this.render(); });
    document.querySelectorAll('.beP .bePn').forEach(i => { i.addEventListener('input', () => { get(i)[1] = i.value.replace(/[<>&"'`\\]/g, '').slice(0, 18); }); i.addEventListener('change', () => { const p = get(i); if (!p[1].trim()) p[1] = 'Backup'; this.commit(); }); i.addEventListener('keydown', stop); });
    document.querySelectorAll('.beP .beNo').forEach(i => { i.addEventListener('change', () => { get(i)[2] = clamp(parseInt(i.value, 10) || 0, 0, 99); i.value = get(i)[2]; this.commit(); }); i.addEventListener('keydown', stop); });
    document.querySelectorAll('.beP input[type=range]').forEach(i => { i.addEventListener('input', () => { get(i)[+i.dataset.k] = +i.value; i.nextElementSibling.textContent = i.value; }); i.addEventListener('change', () => this.commit()); });
    document.querySelectorAll('.beP .tlSk').forEach(b => b.onclick = () => { const p = get(b); p[5] = ((p[5] == null ? 3 : p[5]) + 1) % 6; b.style.background = SKIN[p[5]]; this.commit(); });
    document.querySelectorAll('.beP .bePos').forEach(b => b.onclick = () => { const p = get(b); p[0] = BACKUP_POS[(BACKUP_POS.indexOf(p[0]) + 1) % BACKUP_POS.length]; Sound.click(); this.commit(); this.render(); });
    document.querySelectorAll('.beP .beX').forEach(b => b.onclick = () => {
      const p = get(b);
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'SURE?'; return; }
      if (this.ctx.kind === 'season') Contracts.remove(this.ctx.id, p); else rows.splice(rows.indexOf(p), 1);
      this.msg = `${p[1]} is off the team.`; Sound.click(); this.commit(); this.render();
    });
  },
  add() {
    const rows = this.rows(); if (rows.length >= this.MAX) return;
    const need = BACKUP_POS.find(pos => !rows.some(p => p[0] === pos)) || 'WR';
    const p = this.clean([need, `${pick(FIRST)} ${pick(LAST)}`, 1 + Math.floor(Math.random() * 98), 65, POS_SPD[need] || 80, Math.floor(Math.random() * 6)]);
    if (this.ctx.kind === 'season') { p[6] = { age: 24 }; if (typeof Contracts !== 'undefined') Contracts.give(p, { sal: MIN_SAL, yrs: 1 }); }
    rows.push(p); this.msg = `Added a ${p[0]}. Change his name, spot and ratings below.`; Sound.click(); this.commit(); this.render();
    const last = document.querySelector(`.beP[data-i="${rows.length - 1}"]`); if (last) last.scrollIntoView({ block: 'nearest' });
  },
  reset() {
    const t = this.team(), o = this.orig[t.id]; if (!o) return;
    const s = this.store(); delete s[t.id]; this.saveStore(s);
    Object.assign(t, JSON.parse(JSON.stringify(o))); this.ctx.list = null; this.msg = 'Back to the real depth chart.'; Sound.click(); this.render();
  },
  done() { Sound.click(); this.commit(); if (this.ctx.kind === 'season') { openDepth(); } else { show('select'); renderSelect(); } }
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
    const b = document.createElement('button'); b.className = 'beOpen'; b.textContent = 'BACKUPS';
    b.onclick = e => { e.stopPropagation(); Sound.click(); BenchEd.openQuick(side); };
    $(id).appendChild(b);
  }
  const d = document.createElement('button'); d.id = 'dcBench'; d.textContent = 'EDIT BACKUPS';
  d.onclick = () => { Sound.click(); BenchEd.openSeason(); };
  $('dcAuto').after(d);
})();
