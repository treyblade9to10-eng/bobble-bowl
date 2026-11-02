// ---- Challenge leaderboards: online top 20 per challenge. OFF until you say yes; first name or nickname only ----
// Firebase: bobble/boards/{board}/{device id} = { n: name, s: score, t: time }. One entry per device per board (your best).
const Boards = {
  DB: 'https://cardio-game-3713-default-rtdb.firebaseio.com/bobble/boards',
  KEY: 'bobbleBoards',
  // per: the board starts fresh every day / week. low: lower is better. min/max: anything outside is junk
  DEF: {
    qb: { name: 'QB TARGETS', unit: 'PTS', min: 100, max: 30000 },
    kick: { name: 'KICKING CONTEST', unit: 'YDS', min: 20, max: 70 },
    dash: { name: '40-YARD DASH', unit: 'SEC', min: 3, max: 15, low: true, dec: 2 },
    '2min': { name: 'TWO-MINUTE DRILL', unit: 'WINS', min: 1, max: 5000, sub: 'Drives won, all time' },
    daily: { name: 'DAILY CHALLENGE', unit: 'MARGIN', min: 1, max: 99, per: 'day', sub: 'Goal done today: biggest winning margin' },
    weekly: { name: 'WEEKLY CHALLENGES', unit: '%', min: 1, max: 300, per: 'week', sub: 'This week: progress on all 3 goals (300 = all done)' },
    draft: { name: 'DRAFT CHAMPIONS', unit: 'TITLES', min: 1, max: 1000, sub: 'Draft titles won, all time' }
  },
  ORDER: ['qb', 'kick', 'dash', '2min', 'daily', 'weekly', 'draft'],
  st: null,
  load() {
    if (this.st) return this.st;
    let s; try { s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) {}
    s = s && typeof s === 'object' ? s : {};
    if (!s.id) s.id = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    s.best = s.best || {}; s.posted = s.posted || {};
    if (s.on !== true && s.on !== false) s.on = null; // null = never asked
    return (this.st = s);
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.st)); } catch (e) {} },
  // board key: daily / weekly boards get the date on the end
  key(id) { const d = this.DEF[id]; return d.per === 'day' ? 'daily-' + todayStr() : d.per === 'week' ? 'weekly-' + Weekly.weekKey() : id; },
  better(id, a, b) { return b == null || (this.DEF[id].low ? a < b : a > b); },
  fix(id, s) { const d = this.DEF[id]; s = +s; if (!isFinite(s) || s < d.min || s > d.max) return null; return d.dec ? +s.toFixed(d.dec) : Math.round(s); },
  fmt(id, s) { const d = this.DEF[id]; return d.dec ? s.toFixed(d.dec) + 's' : id === 'weekly' ? s + '%' : String(s); },

  // first name or nickname: 12 letters/numbers/spaces, no bad words, no phone numbers / emails
  okName(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (!s || s.length > 12 || !/^[A-Za-z0-9 ]+$/.test(s) || s.replace(/\D/g, '').length >= 5) return null;
    const low = s.toLowerCase(), leet = low.replace(/[0134578]/g, c => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' })[c]);
    if ([low, leet, leet.replace(/ /g, '')].some(v => CT.BAD.test(v))) return null;
    return s;
  },
  nameErr(s) {
    s = String(s || '').trim();
    if (!s) return 'Type a first name or nickname.';
    if (s.length > 12) return '12 letters max.';
    if (/[^A-Za-z0-9 ]/.test(s)) return 'Letters, numbers and spaces only.';
    if (s.replace(/\D/g, '').length >= 5) return 'No phone numbers.';
    return this.okName(s) ? '' : 'Pick a different name.';
  },

  // a challenge just finished: keep your local best, post it if you said yes, ask the first time
  add(id, score, quiet) {
    const s = this.load(), v = this.fix(id, score); if (v == null) return;
    const k = this.key(id);
    if (this.better(id, v, s.best[k])) s.best[k] = v;
    this.save();
    if (s.on) this.post(id, k);
    else if (s.on === null && !quiet && !this.asking) {
      this.asking = true;
      setTimeout(() => { if (['over', 'miniOver'].some(x => $(x).classList.contains('show'))) this.ask(); else this.asking = false; }, 2200); // only on the results screen
    }
  },
  async post(id, k) {
    const s = this.load(), v = s.best[k];
    if (!s.on || !s.name || v == null || !this.better(id, v, s.posted[k])) return false;
    s.posted[k] = v; this.save();
    try { const r = await fetch(`${this.DB}/${k}/${s.id}.json`, { method: 'PUT', body: JSON.stringify({ n: s.name, s: v, t: { '.sv': 'timestamp' } }) }); return r.ok; } catch (e) { return false; }
  },
  turnOn(name) {
    const s = this.load(); s.on = true; s.name = name; for (const k in s.posted) s.posted[k] = null; this.save(); // keys stay so TURN OFF can delete them
    for (const id of this.ORDER) { const k = this.key(id), v = this.localBest(id); if (v != null) { s.best[k] = v; this.post(id, k); } } // (a new name re-posts everything)
  },
  // turn off: delete everything this device posted
  async turnOff() {
    const s = this.load(), ks = Object.keys(s.posted);
    s.on = false; s.posted = {}; this.save();
    await Promise.all(ks.map(k => fetch(`${this.DB}/${k}/${s.id}.json`, { method: 'DELETE' }).catch(() => {})));
  },
  // top 20 (junk filtered out) + where you rank
  async top(id) {
    const k = this.key(id), s = this.load();
    const r = await fetch(`${this.DB}/${k}.json`); if (!r.ok) throw new Error('net');
    const all = Object.entries((await r.json()) || {}).map(([u, e]) => e && typeof e === 'object' ? { u, n: this.okName(e.n), s: this.fix(id, e.s) } : null)
      .filter(e => e && e.n && e.s != null).sort((a, b) => this.DEF[id].low ? a.s - b.s : b.s - a.s);
    const mi = all.findIndex(e => e.u === s.id);
    return { list: all.slice(0, 20), me: mi >= 0 ? { rank: mi + 1, ...all[mi] } : null, count: all.length };
  },

  // ---- the yes / no box ----
  ask(onYes, onNo) {
    const box = $('lbAsk'), s = this.load(), inp = $('lbName');
    inp.value = s.name || ''; $('lbErr').textContent = '';
    box.classList.add('on');
    const close = () => { box.classList.remove('on'); this.asking = false; };
    $('lbYes').onclick = () => {
      const n = this.okName(inp.value); if (!n) { $('lbErr').textContent = this.nameErr(inp.value); Sound.bad && Sound.bad(); return; }
      Sound.click(); close(); this.turnOn(n); onYes && onYes(); this.refresh();
    };
    $('lbNo').onclick = () => { Sound.click(); close(); if (s.on === null) { s.on = false; this.save(); } onNo && onNo(); this.refresh(); };
    setTimeout(() => { if (G.mode !== 'mobile') inp.focus(); }, 50);
  },

  // ---- LEADERBOARD tab on the Challenges screen ----
  cur: 'qb', seq: 0,
  render() {
    const s = this.load(), el = $('mdBoard');
    el.innerHTML = `<div id="lbSide">${this.ORDER.map(id => { const b = this.localBest(id);
      return `<button class="lbPick${id === this.cur ? ' on' : ''}" data-id="${id}"><b>${this.DEF[id].name}</b><span>${b != null ? 'BEST ' + this.fmt(id, b) : '&nbsp;'}</span></button>`; }).join('')}</div>
      <div id="lbMain"><div id="lbHead"><b>${this.DEF[this.cur].name}</b><span>${this.DEF[this.cur].sub || 'Top 20'}</span></div><div id="lbList"></div>
      <div id="lbBar">${s.on ? `<span>Posting as <b>${s.name}</b></span><button id="lbRename">CHANGE NAME</button><button id="lbOff">TURN OFF</button>`
        : `<span>Online leaderboard is <b>OFF</b>. Your scores stay on this device.</span><button id="lbOn" class="gold">TURN ON</button>`}</div></div>`;
    el.querySelectorAll('.lbPick').forEach(b => b.onclick = () => { Sound.click(); this.cur = b.dataset.id; this.render(); });
    if ($('lbOn')) $('lbOn').onclick = () => { Sound.click(); this.ask(); };
    if ($('lbRename')) $('lbRename').onclick = () => { Sound.click(); this.ask(); };
    if ($('lbOff')) $('lbOff').onclick = async () => { if (!confirm('Turn off the online leaderboard? Your scores get deleted from it.')) return; await this.turnOff(); this.render(); };
    this.fill();
  },
  async fill() {
    const id = this.cur, s = this.load(), mine = this.localBest(id), my = mine != null ? this.fmt(id, mine) : '-', n = ++this.seq;
    const L = $('lbList'); if (!L) return;
    const local = `<div class="lbRow me"><i></i><b>YOUR BEST (this device)</b><span>${my}</span></div>`;
    if (!s.on) { L.innerHTML = local + '<div class="lbMsg">Turn on the online leaderboard to see the top 20.</div>'; return; }
    L.innerHTML = local + '<div class="lbMsg">Loading...</div>';
    let r; try { r = await this.top(id); } catch (e) { if (n === this.seq) L.innerHTML = local + '<div class="lbMsg">Couldn\'t reach the leaderboard. Check your internet.</div>'; return; }
    if (n !== this.seq || !$('lbList')) return;
    const row = (e, rk) => `<div class="lbRow${e.u === s.id ? ' you' : ''}${rk <= 3 ? ' r' + rk : ''}"><i>${rk}</i><b>${e.n}</b><span>${this.fmt(id, e.s)}</span></div>`;
    L.innerHTML = local + (r.list.length ? r.list.map((e, i) => row(e, i + 1)).join('') : '<div class="lbMsg">No scores yet. Be the first.</div>') +
      (r.me && r.me.rank > 20 ? `<div class="lbGap"></div>${row(r.me, r.me.rank)}` : '');
  },
  // your best on this device (older records count too)
  localBest(id) {
    const v = this.load().best[this.key(id)]; if (v != null) return v;
    const R = Records.get(), old = { qb: R.qb, kick: R.kick, dash: R.dash, '2min': R.twoMin && R.twoMin.wins, draft: R.draft && R.draft.titles }[id];
    return this.fix(id, old);
  },
  refresh() { if ($('modes').classList.contains('show') && $('mdBoard').style.display !== 'none') this.render(); this.paintSet(); },
  // Challenges screen tabs: CHALLENGES / LEADERBOARD / TOURNAMENT
  tab(t) {
    if (t === 'tn') { Sound.click(); return Tourney.open(); }
    document.querySelectorAll('#mdTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $('modes').classList.toggle('lbOn', t === 'lb');
    for (const id of ['mdWeekly', 'mdCards']) $(id).style.display = t === 'lb' ? 'none' : '';
    $('mdBoard').style.display = t === 'lb' ? '' : 'none';
    if (t === 'lb') this.render();
  },
  // GAME SETTINGS panel: LEADERBOARD OFF / ON row
  paintSet() { const on = !!this.load().on; document.querySelectorAll('#muRow_boards .muC button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === on)); },
  addSetRow() {
    const grp = document.querySelector('#muSetBody .muGrp'); if (!grp) return;
    const row = document.createElement('div'); row.className = 'muRow'; row.id = 'muRow_boards';
    row.innerHTML = '<span class="muL">ONLINE LEADERBOARD</span><div class="muC seg"><button data-v="0">Off</button><button data-v="1">On</button></div>';
    row.querySelectorAll('button').forEach(b => b.onclick = async () => {
      const on = b.dataset.v === '1'; if (on === !!this.load().on) return;
      Sound.click();
      if (on) this.ask(); else if (confirm('Turn off the online leaderboard? Your scores get deleted from it.')) { await this.turnOff(); this.paintSet(); }
    });
    grp.appendChild(row); this.paintSet();
  }
};
document.querySelectorAll('#mdTabs button').forEach(b => b.onclick = () => { Sound.click(); Boards.tab(b.dataset.t); });
$('lbName').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('lbYes').click(); }); // typing a space mustn't snap a ball
Boards.addSetRow();
