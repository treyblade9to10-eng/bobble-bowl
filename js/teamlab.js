// ---- Create-a-Team screens: My Teams, the editor (identity / colors / roster / share) and the online Team Database ----
screens.push('tlHub', 'tlEdit'); menuScreens.push('tlHub', 'tlEdit');
(() => {
  const st = document.getElementById('stage');
  const hub = document.createElement('div'); hub.id = 'tlHub'; hub.className = 'screen';
  hub.innerHTML = `
    <div class="tlTop"><h2>Create a Team</h2>
      <div class="tlTabs" id="tlHubTabs"><button data-t="mine">MY TEAMS</button><button data-t="db">TEAM DATABASE</button></div>
      <button id="tlHubBack">BACK</button></div>
    <div id="tlDbBar"><input id="tlSearch" maxlength="20" placeholder="Search teams"><div class="tlTabs" id="tlSort"><button data-s="new">NEWEST</button><button data-s="pop">POPULAR</button><button data-s="ovr">BEST</button></div></div>
    <div id="tlGrid"></div>
    <div id="tlToast"></div>`;
  st.appendChild(hub);
  const ed = document.createElement('div'); ed.id = 'tlEdit'; ed.className = 'screen';
  ed.innerHTML = `
    <div class="tlTop"><h2 id="tlEdTitle">New Team</h2>
      <div class="tlTabs" id="tlEdTabs"><button data-t="id">IDENTITY</button><button data-t="col">COLORS</button><button data-t="ros">ROSTER</button><button data-t="share">SHARE</button></div>
      <button class="big gold" id="tlSave">SAVE TEAM</button><button id="tlEdBack">BACK</button></div>
    <div id="tlEdBody">
      <div id="tlPrev">
        <canvas id="tlCv" width="240" height="280"></canvas>
        <div id="tlPrevName"></div>
        <div class="tlTabs" id="tlKit"><button data-k="home">HOME</button><button data-k="away">AWAY</button><button data-k="rush">COLOR RUSH</button></div>
      </div>
      <div id="tlPane"></div>
    </div>
    <div id="tlEdMsg"></div>`;
  st.appendChild(ed);
})();

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TL_PALETTE = ['#0B162A', '#1F3A93', '#0076B6', '#6CACE4', '#00A3AD', '#125740', '#2B8A3E', '#7BC043', '#4F2683', '#9B59B6', '#C8102E', '#E8401C', '#FB4F14', '#FF8200', '#F6C31C', '#FFD700', '#A5ACAF', '#5A5A5A', '#151515', '#FFFFFF', '#D8CDB0', '#7A5230', '#A71930', '#E31837'];

const TeamLab = {
  tab: 'mine', sort: 'new', db: null, dbErr: '', loading: false,
  t: null, edTab: 'id', kit: 'home', ang: 0.4, editing: false,

  // ---------------- hub ----------------
  open(tab) {
    if (tab) this.tab = tab;
    CT.useAll(); show('tlHub'); this.renderHub();
    if (this.tab === 'db' && !this.db && !this.loading) this.fetchDb();
  },
  renderHub() {
    document.querySelectorAll('#tlHubTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === this.tab));
    document.querySelectorAll('#tlSort button').forEach(b => b.classList.toggle('on', b.dataset.s === this.sort));
    $('tlDbBar').style.display = this.tab === 'db' ? 'flex' : 'none';
    const card = (t, btns, sub) => `<div class="tlCard" style="--c1:${t.c1};--c2:${t.c2}">
        <div class="tlBadge">${teamBadge(t)}</div>
        <div class="tlInfo"><div class="tlCity">${esc(t.city)}</div><div class="tlNm">${esc(t.name)}</div><div class="tlSub">${sub}</div></div>
        <div class="tlOvr"><b>${CT.ovr(t)}</b><span>OVR</span></div>
        <div class="tlBtns">${btns}</div></div>`;
    if (this.tab === 'mine') {
      const list = CT.mine.map((t, i) => card(t,
        `<button data-a="play" data-i="${i}">PLAY</button><button data-a="edit" data-i="${i}">EDIT</button><button data-a="del" data-i="${i}" class="tlDel">DELETE</button>`,
        `${esc(t.id)}  ·  <span class="tlChip ${t.pub ? 'pub' : ''}">${t.pub ? 'PUBLIC' : 'PRIVATE'}</span>${t.fromBy ? `  ·  from ${esc(t.fromBy)}` : ''}`)).join('');
      $('tlGrid').innerHTML = `<button class="tlNew" id="tlNew"><span class="plus"></span><b>NEW TEAM</b><span>Colors, logo, roster, ratings</span></button>` + list;
      $('tlNew').onclick = () => { Sound.click(); this.edit(null); };
    } else {
      if (this.loading) { $('tlGrid').innerHTML = `<div class="tlEmpty">Loading teams...</div>`; return; }
      if (this.dbErr) { $('tlGrid').innerHTML = `<div class="tlEmpty">${esc(this.dbErr)}<br><button id="tlRetry">TRY AGAIN</button></div>`; $('tlRetry').onclick = () => this.fetchDb(); return; }
      const q = $('tlSearch').value.trim().toLowerCase();
      let list = (this.db || []).filter(t => !q || `${t.city} ${t.name} ${t.id} ${t.by}`.toLowerCase().includes(q));
      list.sort(this.sort === 'pop' ? (a, b) => b.dl - a.dl : this.sort === 'ovr' ? (a, b) => CT.ovr(b) - CT.ovr(a) : (a, b) => b.at - a.at);
      const have = new Set(CT.mine.map(t => t.from || t.uid));
      $('tlGrid').innerHTML = list.length ? list.slice(0, 60).map(t => card(t,
        have.has(t.uid) ? `<button disabled>IN MY TEAMS</button>` : `<button data-a="get" data-u="${esc(t.uid)}" class="tlGet">GET TEAM</button>`,
        `${esc(t.id)}  ·  by ${esc(t.by || 'Anonymous')}  ·  ${t.dl} download${t.dl === 1 ? '' : 's'}`)).join('')
        : `<div class="tlEmpty">${q ? 'No teams match that search.' : 'No public teams yet. Make one and set it to PUBLIC to be the first.'}</div>`;
    }
    $('tlGrid').querySelectorAll('button[data-a]').forEach(b => b.onclick = () => this.act(b.dataset.a, b.dataset));
  },
  async fetchDb() {
    this.loading = true; this.dbErr = ''; this.renderHub();
    try { this.db = await CT.browse(); } catch (e) { this.dbErr = 'Could not load the Team Database. Check your internet.'; }
    this.loading = false; if ($('tlHub').classList.contains('show')) this.renderHub();
  },
  toast(msg) { const el = $('tlToast'); el.textContent = msg; el.classList.add('on'); clearTimeout(this.tt); this.tt = setTimeout(() => el.classList.remove('on'), 2200); },
  async act(a, d) {
    Sound.click();
    if (a === 'edit') return this.edit(CT.mine[+d.i]);
    if (a === 'play') { const t = CT.mine[+d.i]; CT.useAll(); sel.idx[sel.you] = TEAMS.findIndex(x => x.uid === t.uid); CT.fixSel(); modeAfter = 'select'; show('mode'); return; }
    if (a === 'del') {
      const t = CT.mine[+d.i], b = $('tlGrid').querySelector(`button[data-a="del"][data-i="${d.i}"]`);
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'SURE?'; return; }
      if (t.pub) CT.unpublish(t);
      CT.mine.splice(+d.i, 1); CT.save(); CT.useAll(); this.renderHub(); this.toast(`${t.city} ${t.name} deleted`); return;
    }
    if (a === 'get') {
      const t = (this.db || []).find(x => x.uid === d.u); if (!t) return;
      const c = CT.adopt(t); CT.countDownload(t); t.dl++; CT.useAll();
      this.renderHub(); this.toast(`${c.city} ${c.name} added to My Teams${c.id !== t.id ? ` as ${c.id}` : ''}`);
    }
  },

  // ---------------- editor ----------------
  edit(t) {
    this.editing = !!t;
    this.t = t ? JSON.parse(JSON.stringify(t)) : CT.blank();
    this.edTab = 'id'; this.kit = 'home'; this.ang = 0.4;
    $('tlEdTitle').textContent = t ? 'Edit Team' : 'New Team'; $('tlEdMsg').textContent = '';
    show('tlEdit'); this.renderEd(); this.loop();
  },
  renderEd() {
    const t = this.t;
    document.querySelectorAll('#tlEdTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === this.edTab));
    document.querySelectorAll('#tlKit button').forEach(b => b.classList.toggle('on', b.dataset.k === this.kit));
    this.renderName();
    $('tlPane').innerHTML = this['pane_' + this.edTab]();
    this['wire_' + this.edTab]();
  },
  renderName() {
    const t = this.t;
    $('tlPrevName').innerHTML = `<div class="tlPB">${teamBadge(t)}</div><div><div class="tlCity">${esc(t.city)}</div><div class="tlNm">${esc(t.name)}</div><div class="tlSub">${esc(t.id)}  ·  ${CT.ovr(t)} OVR</div></div>`;
  },
  field(label, id, val, max, extra = '') { return `<label class="tlF"><span>${label}</span><input id="${id}" maxlength="${max}" value="${esc(val)}" ${extra}></label>`; },
  pane_id() {
    const t = this.t;
    return `<div class="tlSec">TEAM</div>
      ${this.field('City', 'tlCityIn', t.city, 16)}${this.field('Team name', 'tlNameIn', t.name, 16)}
      ${this.field('Abbreviation', 'tlIdIn', t.id, 4, 'class="tlIdIn"')}<div class="tlHint" id="tlIdHint">2-4 letters. Shows on the scoreboard and at midfield.</div>
      <div class="tlSec">BADGE</div>
      <div class="tlShapes">${CT.SHAPES.map(s => `<button class="tlShape${t.shape === s ? ' on' : ''}" data-s="${s}">${teamBadge({ ...t, shape: s })}<span>${s.toUpperCase()}</span></button>`).join('')}</div>
      <div class="tlSec">STADIUM</div>
      ${this.field('Stadium', 'tlStadIn', t.stadium, 24)}
      <div class="tlF"><span>Roof</span><div class="tlTabs" id="tlRoof"><button data-d="0" class="${t.dome ? '' : 'on'}">OPEN AIR</button><button data-d="1" class="${t.dome ? 'on' : ''}">DOME</button></div></div>`;
  },
  wire_id() {
    const t = this.t;
    const on = (id, k, f) => $(id).addEventListener('input', () => { t[k] = f ? f($(id).value) : $(id).value; this.renderName(); });
    on('tlCityIn', 'city'); on('tlNameIn', 'name'); on('tlStadIn', 'stadium');
    $('tlIdIn').addEventListener('input', () => {
      const v = $('tlIdIn').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); $('tlIdIn').value = v; t.id = v;
      const bad = v.length < 2 ? 'Needs at least 2 letters.' : CT.idTaken(v, t.uid) ? `${v} is already taken. Try another.` : '';
      $('tlIdHint').textContent = bad || '2-4 letters. Shows on the scoreboard and at midfield.'; $('tlIdHint').classList.toggle('bad', !!bad);
      this.renderName(); document.querySelectorAll('.tlShape').forEach(b => { b.querySelector('svg').outerHTML = teamBadge({ ...t, shape: b.dataset.s }); });
    });
    document.querySelectorAll('.tlShape').forEach(b => b.onclick = () => { t.shape = b.dataset.s; Sound.click(); this.renderEd(); });
    document.querySelectorAll('#tlRoof button').forEach(b => b.onclick = () => { t.dome = b.dataset.d === '1'; Sound.click(); this.renderEd(); });
    for (const id of ['tlCityIn', 'tlNameIn', 'tlIdIn', 'tlStadIn']) $(id).addEventListener('keydown', e => e.stopPropagation());
  },
  COLORS: [['c1', 'Main color', 'Jersey'], ['c2', 'Second color', 'Numbers + trim'], ['helmet', 'Helmet', 'Shell'], ['mask', 'Facemask', 'Cage'], ['pants', 'Pants', 'Home pants']],
  pane_col() {
    const t = this.t;
    return `<div class="tlSec">COLORS <button class="tlMini" id="tlShuffle">SHUFFLE</button></div>` + this.COLORS.map(([k, n, sub]) => `<div class="tlColRow">
      <div class="tlColL"><i style="background:${t[k]}"></i><div><b>${n}</b><span>${sub}</span></div></div>
      <div class="tlSw">${TL_PALETTE.map(c => `<button class="tlC${t[k] === c ? ' on' : ''}" data-k="${k}" data-c="${c}" style="background:${c}"></button>`).join('')}
      <label class="tlPick" title="Any color"><input type="color" data-k="${k}" value="${t[k].toLowerCase()}"><span>+</span></label></div></div>`).join('');
  },
  wire_col() {
    const t = this.t;
    document.querySelectorAll('.tlC').forEach(b => b.onclick = () => { t[b.dataset.k] = b.dataset.c; Sound.click(); this.renderEd(); });
    document.querySelectorAll('.tlPick input').forEach(i => i.addEventListener('change', () => { t[i.dataset.k] = i.value.toUpperCase(); this.renderEd(); }));
    $('tlShuffle').onclick = () => {
      const a = pick(TL_PALETTE.filter(c => c !== '#FFFFFF')); let b; do { b = pick(TL_PALETTE); } while (b === a || colorGap(a, b) < 120);
      Object.assign(t, { c1: a, c2: b, helmet: chance(0.6) ? a : chance(0.5) ? b : '#FFFFFF', mask: chance(0.5) ? b : pick(['#FFFFFF', '#151515', '#A5ACAF']), pants: chance(0.5) ? '#FFFFFF' : chance(0.5) ? b : '#A5ACAF' });
      Sound.click(); this.renderEd();
    };
  },
  pane_ros() {
    const t = this.t, avg = l => Math.round(l.reduce((a, p) => a + p[3], 0) / l.length);
    const row = (p, side, i) => `<div class="tlP" data-s="${side}" data-i="${i}">
      <span class="tlPos">${p[0]}</span>
      <input class="tlPn" maxlength="18" value="${esc(p[1])}">
      <input class="tlNo" type="number" min="0" max="99" value="${p[2]}">
      <input class="tlRg" type="range" min="40" max="99" value="${p[3]}"><b class="tlOv">${p[3]}</b>
      <button class="tlSk" style="background:${SKIN[p[5]]}" title="Skin tone"></button></div>`;
    const kRow = (k, side) => `<div class="tlP" data-s="${side}" data-i="-1">
      <span class="tlPos">${side === 'k' ? 'K' : 'P'}</span>
      <input class="tlPn" maxlength="18" value="${esc(k[0])}">
      <input class="tlNo" type="number" min="0" max="99" value="${k[1]}">
      <input class="tlRg" type="range" min="40" max="99" value="${k[2]}"><b class="tlOv">${k[2]}</b>
      <button class="tlSk" style="background:${SKIN[k[3]]}" title="Skin tone"></button></div>`;
    return `<div class="tlSec">RATINGS <button class="tlMini" id="tlRandN">NEW NAMES</button></div>
      <div class="tlBig">${[['all', 'TEAM'], ['off', 'OFFENSE'], ['def', 'DEFENSE']].map(([k, n]) => `<label><span>${n}</span><input type="range" min="50" max="99" data-g="${k}" value="${k === 'all' ? CT.ovr(t) : avg(t[k])}"><b>${k === 'all' ? CT.ovr(t) : avg(t[k])}</b></label>`).join('')}</div>
      <div class="tlSec">OFFENSE</div>${t.off.map((p, i) => row(p, 'off', i)).join('')}
      <div class="tlSec">DEFENSE</div>${t.def.map((p, i) => row(p, 'def', i)).join('')}
      <div class="tlSec">SPECIAL TEAMS</div>${kRow(t.k, 'k')}${kRow(t.p, 'p')}`;
  },
  wire_ros() {
    const t = this.t;
    const get = el => { const r = el.closest('.tlP'), s = r.dataset.s, i = +r.dataset.i; return s === 'k' || s === 'p' ? { arr: t[s], n: 0, no: 1, ov: 2, sk: 3 } : { arr: t[s][i], n: 1, no: 2, ov: 3, sk: 5 }; };
    document.querySelectorAll('.tlP .tlPn').forEach(i => { i.addEventListener('input', () => { const g = get(i); g.arr[g.n] = i.value; }); i.addEventListener('keydown', e => e.stopPropagation()); });
    document.querySelectorAll('.tlP .tlNo').forEach(i => { i.addEventListener('input', () => { const g = get(i); g.arr[g.no] = clamp(parseInt(i.value, 10) || 0, 0, 99); }); i.addEventListener('keydown', e => e.stopPropagation()); });
    document.querySelectorAll('.tlP .tlRg').forEach(i => i.addEventListener('input', () => { const g = get(i); g.arr[g.ov] = +i.value; i.nextElementSibling.textContent = i.value; this.renderName(); }));
    document.querySelectorAll('.tlP .tlSk').forEach(b => b.onclick = () => { const g = get(b); g.arr[g.sk] = (g.arr[g.sk] + 1) % 6; b.style.background = SKIN[g.arr[g.sk]]; });
    document.querySelectorAll('.tlBig input').forEach(i => {
      i.addEventListener('input', () => { CT.setOvr(t, i.dataset.g, +i.value); i.nextElementSibling.textContent = i.value; this.renderName();
        document.querySelectorAll('.tlP').forEach(r => { const s = r.dataset.s; if (s === 'k' || s === 'p') return; const p = t[s][+r.dataset.i]; r.querySelector('.tlRg').value = p[3]; r.querySelector('.tlOv').textContent = p[3]; }); });
      i.addEventListener('change', () => this.renderEd());
    });
    $('tlRandN').onclick = () => { for (const p of t.off.concat(t.def)) p[1] = CT.randName(); t.k[0] = CT.randName(); t.p[0] = CT.randName(); Sound.click(); this.renderEd(); };
  },
  pane_share() {
    const t = this.t;
    return `<div class="tlSec">WHO CAN USE IT</div>
      <div class="tlVis">
        <button class="tlVisB${t.pub ? '' : ' on'}" data-p="0"><b>PRIVATE</b><span>Only on this device. Nobody else sees it.</span></button>
        <button class="tlVisB${t.pub ? ' on' : ''}" data-p="1"><b>PUBLIC</b><span>Goes in the Team Database so anyone can download it and play with it.</span></button>
      </div>
      <div class="tlSec">MADE BY</div>
      ${this.field('Nickname', 'tlByIn', t.by, 16, 'placeholder="Anonymous"')}
      <div class="tlHint">Use a nickname or gamertag, not your real name.</div>`;
  },
  wire_share() {
    const t = this.t;
    document.querySelectorAll('.tlVisB').forEach(b => b.onclick = () => { t.pub = b.dataset.p === '1'; Sound.click(); this.renderEd(); });
    $('tlByIn').addEventListener('input', () => { t.by = $('tlByIn').value; });
    $('tlByIn').addEventListener('keydown', e => e.stopPropagation());
  },
  async saveTeam() {
    const raw = this.t, msg = $('tlEdMsg');
    raw.id = String(raw.id || '').toUpperCase();
    if (raw.id.length < 2 || CT.idTaken(raw.id, raw.uid)) { this.edTab = 'id'; this.renderEd(); msg.textContent = 'Pick a different abbreviation first.'; return; }
    const t = CT.clean(raw);
    if (t.pub && !CT.isClean(t)) { msg.textContent = 'Some words in this team are not allowed in the database. Change them or make it PRIVATE.'; return; }
    const i = CT.mine.findIndex(x => x.uid === t.uid), was = i >= 0 ? CT.mine[i] : null;
    if (i >= 0) CT.mine[i] = t; else CT.mine.push(t);
    CT.save(); CT.useAll(); Sound.td();
    if (t.pub) {
      msg.textContent = 'Saving to the Team Database...';
      try { await CT.publish(t); this.db = null; this.toast(`${t.city} ${t.name} saved and posted to the Team Database`); }
      catch (e) { this.toast(`Saved on this device. ${e.message}`); }
    } else { if (was && was.pub) CT.unpublish(t); this.db = null; this.toast(`${t.city} ${t.name} saved`); }
    this.open('mine');
  },
  loop() {
    if (!$('tlEdit').classList.contains('show')) return;
    this.ang += 0.012;
    const cv = $('tlCv'), g = cv.getContext('2d'), W = cv.width, H = cv.height, t = this.t;
    const lk = teamLook(t, this.kit !== 'away', this.kit), qb = t.off[0];
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, W * 0.85);
    bg.addColorStop(0, shade(t.c1, -0.3)); bg.addColorStop(1, '#0c1016'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H - 12); g.scale(0.82, 0.82);
    g.fillStyle = '#00000066'; g.beginPath(); g.ellipse(0, 2, 46, 11, 0, 0, 7); g.fill();
    drawTurntable(g, lk, cleatFor(lk, this.kit), { num: qb[2], name: lastName(qb[1]), skin: qb[5] }, Math.sin(this.ang) * 0.9);
    g.restore();
    requestAnimationFrame(() => this.loop());
  }
};
// wiring
document.querySelectorAll('#tlHubTabs button').forEach(b => b.onclick = () => { Sound.click(); TeamLab.tab = b.dataset.t; TeamLab.renderHub(); if (b.dataset.t === 'db' && !TeamLab.db) TeamLab.fetchDb(); });
document.querySelectorAll('#tlSort button').forEach(b => b.onclick = () => { Sound.click(); TeamLab.sort = b.dataset.s; TeamLab.renderHub(); });
$('tlSearch').addEventListener('input', () => TeamLab.renderHub());
$('tlSearch').addEventListener('keydown', e => e.stopPropagation());
$('tlHubBack').onclick = () => { Sound.click(); show('title'); };
document.querySelectorAll('#tlEdTabs button').forEach(b => b.onclick = () => { Sound.click(); TeamLab.edTab = b.dataset.t; TeamLab.renderEd(); });
document.querySelectorAll('#tlKit button').forEach(b => b.onclick = () => { Sound.click(); TeamLab.kit = b.dataset.k; TeamLab.renderEd(); });
$('tlSave').onclick = () => TeamLab.saveTeam();
$('tlEdBack').onclick = () => { Sound.click(); TeamLab.open('mine'); };

// title screen button
(() => {
  const b = document.createElement('button'); b.className = 'big'; b.id = 'btnTeamLab'; b.textContent = 'CREATE A TEAM';
  b.onclick = () => { Sound.init(); Sound.click(); TeamLab.open('mine'); };
  $('btnOnline').parentNode.appendChild(b);
})();

// Quick Game / Challenges get every team; Online sticks to the 32 NFL teams (both players need the same teams)
for (const id of ['btnPlay', 'btnModes']) { const o = $(id).onclick; $(id).onclick = e => { CT.useAll(); o && o(e); }; }
{ const o = $('btnOnline').onclick; $('btnOnline').onclick = e => { CT.useLeague(null); o && o(e); }; }

// ---------------- Season: play as your custom team (it takes over an NFL team's spot in the league) ----------------
{
  const _load = Season.load;
  Season.load = function () { const d = _load.call(this); CT.useLeague(d && d.swap); return d; };
  const _clear = Season.clear;
  Season.clear = function () { _clear.call(this); CT.useLeague(null); };
  const _use = Season.use;
  Season.use = function (slot) { _use.call(this, slot); CT.useLeague(this.data && this.data.swap); };
}
let snReplace = 0;
{
  const _open = openSeason;
  openSeason = function () { _open(); if (!Season.data) { CT.useAll(); renderSeasonNew(); } };
  const _render = renderSeasonNew;
  renderSeasonNew = function () {
    _render();
    let row = $('snSwap');
    if (!row) { row = document.createElement('div'); row.id = 'snSwap'; $('snOpts').insertBefore(row, $('snOpts').querySelector('.snInfo')); }
    const t = TEAMS[snIdx];
    if (t && t.custom) {
      const nfl = CT.NFL, r = nfl[((snReplace % nfl.length) + nfl.length) % nfl.length];
      row.innerHTML = `<div class="snSwL">YOUR TEAM TAKES THE PLACE OF</div><div class="snSwR"><button class="arr2" id="snRepP"><svg viewBox="0 0 24 24" class="chev"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span class="snRep" style="--c1:${r.c1}">${teamBadge(r)}<b>${r.city} ${r.name}</b><i>${r.conf} ${r.div}</i></span>
        <button class="arr2" id="snRepN"><svg viewBox="0 0 24 24" class="chev"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
      row.style.display = 'block';
      $('snRepP').onclick = () => { snReplace--; Sound.click(); renderSeasonNew(); };
      $('snRepN').onclick = () => { snReplace++; Sound.click(); renderSeasonNew(); };
    } else row.style.display = 'none';
  };
  $('snStart').onclick = () => {
    const t = TEAMS[snIdx];
    if (t && t.custom) {
      const r = CT.NFL[((snReplace % 32) + 32) % 32], swap = { out: r.id, team: t };
      CT.useLeague(swap);
      Season.start(t.id, +$('snGames').value, +$('snQtr').value, +$('snDiff').value);
      Season.data.swap = swap; Season.save();
    } else { CT.useLeague(null); Season.start(t.id, +$('snGames').value, +$('snQtr').value, +$('snDiff').value); }
    Sound.whistle(); renderHub();
  };
}
