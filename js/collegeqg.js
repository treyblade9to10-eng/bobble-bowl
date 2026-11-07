// ---- Quick Game with college teams: an NFL / COLLEGE switch on the Matchup screen ----
// COLLEGE puts the college teams (career.js COLLEGES + the real lineups in colleges.js) in front of the NFL teams in TEAMS
// (CT.useCollege), so both cards go to colleges and ALL TEAMS can still pick an NFL team for college vs NFL.
// Only the Matchup screen uses it: going back to the title (or Season / Online / Challenges, which call CT.useAll / useLeague) puts TEAMS back.
Object.assign(STADIUMS, { // real stadium names
  ALA: ['Bryant-Denny Stadium', 'open', 'grass'], OSU: ['Ohio Stadium', 'open', 'turf'], UGA: ['Sanford Stadium', 'open', 'grass'],
  LSU: ['Tiger Stadium', 'open', 'grass'], MICH: ['Michigan Stadium', 'open', 'turf'], TEX: ['DKR-Texas Memorial Stadium', 'open', 'turf'],
  ORE: ['Autzen Stadium', 'open', 'turf'], USC: ['LA Memorial Coliseum', 'open', 'grass'], CLEM: ['Memorial Stadium', 'open', 'grass'],
  PSU: ['Beaver Stadium', 'open', 'grass'], ND: ['Notre Dame Stadium', 'open', 'turf'], TENN: ['Neyland Stadium', 'open', 'grass'],
  WIS: ['Camp Randall Stadium', 'open', 'turf'], BSU: ['Albertsons Stadium', 'open', 'turf'], ISU: ['Jack Trice Stadium', 'open', 'turf'],
  APP: ['Kidd Brewer Stadium', 'open', 'turf'], TOL: ['Glass Bowl', 'open', 'turf'], NIU: ['Huskie Stadium', 'open', 'turf'],
  // the 33 added schools (surfaces checked 2026-11: SMU, UNC went back to grass in 2025, Colorado to turf)
  FLA: ['Ben Hill Griffin Stadium', 'open', 'grass'], OU: ['Oklahoma Memorial Stadium', 'open', 'grass'], TAMU: ['Kyle Field', 'open', 'grass'],
  AUB: ['Jordan-Hare Stadium', 'open', 'grass'], MISS: ['Vaught-Hemingway Stadium', 'open', 'grass'], SC: ['Williams-Brice Stadium', 'open', 'grass'],
  MIZ: ['Faurot Field', 'open', 'turf'], IU: ['Memorial Stadium', 'open', 'turf'], IOWA: ['Kinnick Stadium', 'open', 'turf'],
  NEB: ['Memorial Stadium', 'open', 'turf'], UCLA: ['Rose Bowl', 'open', 'grass'], WASH: ['Husky Stadium', 'open', 'turf'],
  UTAH: ['Rice-Eccles Stadium', 'open', 'turf'], COLO: ['Folsom Field', 'open', 'turf'], ASU: ['Mountain America Stadium', 'open', 'grass'],
  KSU: ['Bill Snyder Family Stadium', 'open', 'turf'], TTU: ['Jones AT&T Stadium', 'open', 'turf'], BYU: ['LaVell Edwards Stadium', 'open', 'grass'],
  TCU: ['Amon G. Carter Stadium', 'open', 'grass'], FSU: ['Doak Campbell Stadium', 'open', 'grass'], UM: ['Hard Rock Stadium', 'open', 'grass'],
  LOU: ['L&N Stadium', 'open', 'turf'], VT: ['Lane Stadium', 'open', 'grass'], UNC: ['Kenan Stadium', 'open', 'grass'],
  GT: ['Bobby Dodd Stadium', 'open', 'turf'], SMU: ['Gerald J. Ford Stadium', 'open', 'grass'], ARMY: ['Michie Stadium', 'open', 'turf'],
  NAVY: ['Navy-Marine Corps Stadium', 'open', 'turf'], TULN: ['Yulman Stadium', 'open', 'turf'], MEM: ['Simmons Bank Liberty Stadium', 'open', 'turf'],
  UNLV: ['Allegiant Stadium', 'dome', 'turf'], LIB: ['Williams Stadium', 'open', 'turf'], JMU: ['Bridgeforth Stadium', 'open', 'turf']
});
Object.assign(EZ_STYLE, { TENN: 'checker', LSU: 'stripes' });
// the real field color where it isn't green (Boise State's famous blue turf)
const REAL_SHADE = { BSU: 'blue' };

const CQ = {
  KEY: 'bobbleQGCol', list: null,
  s: (() => { try { return JSON.parse(localStorage.getItem('bobbleQGCol') || 'null') || {}; } catch (e) { return {}; } })(), // { on, ids: [home, away], nfl: [home, away] }
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.s)); } catch (e) {} },
  // every college as a full team (same build as a career college game)
  teams() {
    if (!this.list) this.list = COLLEGES.map(c => {
      const r = Career.realCollegeRoster(c.id) || Career.makeCollegeRoster(c.pr);
      const k = r.k || ['Kicker', 3, 72, 2], p = r.p || ['Punter', 8, 72, 2];
      return { ...c, conf: 'NCAA', div: '', college: true, off: r.off, def: r.def, k, p };
    });
    return this.list;
  },
  ids() { return [0, 1].map(s => TEAMS[sel.idx[s]] && TEAMS[sel.idx[s]].id); },
  // put both cards back on these teams (by id), if they're there
  pickIds(ids) {
    if (!ids) return;
    for (const s of [0, 1]) { const i = TEAMS.findIndex(t => t.id === ids[s]); if (i >= 0 && i !== sel.idx[1 - s]) sel.idx[s] = i; }
    CT.fixSel();
  },
  enter() {
    if (CT.mode === 'college') return;
    this.s.nfl = this.ids();
    CT.useCollege();
    this.pickIds(this.s.ids || ['ALA', 'OSU']);
    if (!TEAMS[sel.idx[0]].college && !TEAMS[sel.idx[1]].college) this.pickIds(['ALA', 'OSU']);
  },
  // CT.useAll / useLeague while colleges are in: keep the college picks for next time, NFL picks come back
  leaving() { if (CT.mode === 'college') this.s.ids = this.ids(); },
  back() { if (this.s.nfl) this.pickIds(this.s.nfl); this.save(); },
  // arriving on the Matchup screen: college mode if that's what you had (not when you came to play your created team)
  sync() {
    if (this.s.on && CT.mode === 'all' && !(TEAMS[sel.idx[sel.you]] || {}).custom) this.enter();
    else if (this.s.on && CT.mode === 'all') { this.s.on = false; this.save(); }
    else if (!this.s.on && CT.mode === 'college') CT.useAll();
  },
  set(on) {
    if (!!this.s.on === on) return;
    this.s.on = on; Sound.click();
    if (on) this.enter(); else CT.useAll();
    this.save(); renderSelect();
  },
  paint() {
    const col = CT.mode === 'college';
    $('muLg').querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.l === 'col') === col));
    for (const [side, id] of [[0, 'pHome'], [1, 'pAway']]) {
      const t = TEAMS[sel.idx[side]], card = $(id);
      if (col) { const g = TEAMS.filter(x => !!x.college === !!t.college); card.querySelector('.muCnt').textContent = `${g.indexOf(t) + 1} / ${g.length}`; }
      const be = card.querySelector('.beOpen'); if (be) be.style.display = t.college ? 'none' : ''; // (roster editing is for NFL teams)
      card.classList.toggle('colT', !!t.college);
      const nm = card.querySelector('.muName'); nm.style.fontSize = ''; // long college names (CRIMSON TIDE, FIGHTING IRISH): shrink to fit
      const rg = document.createRange(), px = (el, k) => parseFloat(getComputedStyle(el)[k]) || 0, box = nm.parentElement;
      const over = () => { rg.selectNodeContents(nm); return rg.getBoundingClientRect().width / ((nm.getBoundingClientRect().width / nm.offsetWidth) || 1) + px(nm, 'paddingLeft') + px(nm, 'paddingRight') > box.clientWidth - px(box, 'paddingLeft') - px(box, 'paddingRight') - 1; }; // (scrollWidth rounds to fit while italic text is still cut off)
      for (let fs = parseFloat(getComputedStyle(nm).fontSize), n = 0; over() && fs > 12 && n < 14; n++) nm.style.fontSize = (fs -= 2) + 'px';
    }
    if (col) this.s.ids = this.ids();
    this.save();
  }
};
CT.useCollege = function () {
  this.mode = 'college'; this.swap = null;
  TEAMS.length = 0; TEAMS.push(...CQ.teams(), ...this.NFL, ...this.mine);
  this.fixSel();
};
for (const k of ['useAll', 'useLeague']) { const f = CT[k]; CT[k] = function (...a) { const was = this.mode === 'college'; if (was) CQ.leaving(); const r = f.apply(this, a); if (was) CQ.back(); return r; }; }
// (the saved picks may be college spots from last time)
if (CQ.s.on && CQ.s.nfl && CT.mode === 'all') CQ.pickIds(CQ.s.nfl);

// the switch: above VS on the Matchup screen
{
  const el = document.createElement('div'); el.id = 'muLg';
  el.innerHTML = '<button data-l="nfl">NFL</button><button data-l="col">COLLEGE</button>';
  el.querySelectorAll('button').forEach(b => b.onclick = () => CQ.set(b.dataset.l === 'col'));
  $('muMid').insertBefore(el, $('muMid').firstChild);
}
{ const _rs = renderSelect; renderSelect = function (b) { CQ.sync(); _rs(b); CQ.paint(); }; }
// arrows / swipes stay with colleges (or with NFL + your teams) in college mode
{ const _mt = moveTeam; moveTeam = function (side, d) {
  if (CT.mode !== 'college') return _mt(side, d);
  const col = !!TEAMS[sel.idx[side]].college, L = TEAMS.map((t, i) => i).filter(i => !!TEAMS[i].college === col && i !== sel.idx[1 - side]);
  const k = L.indexOf(sel.idx[side]); sel.idx[side] = L[(k + d + L.length) % L.length]; Sound.click(); renderSelect(side);
}; }
// ALL TEAMS: the colleges on top (by program), then the NFL
{
  const tab = document.createElement('button'); tab.dataset.f = 'COL'; tab.textContent = 'COLLEGE';
  tab.onclick = () => { tgConf = 'COL'; Sound.click(); renderTeamGrid(); };
  $('tgTabs').insertBefore(tab, $('tgTabs').firstChild.nextSibling);
  const _rg = renderTeamGrid; renderTeamGrid = function () {
    const col = CT.mode === 'college'; tab.style.display = col ? '' : 'none';
    if (!col && tgConf === 'COL') tgConf = 'all';
    _rg();
    if (!col || (tgConf !== 'all' && tgConf !== 'COL')) return;
    let h = '';
    for (let pr = 3; pr >= 0; pr--) {
      const list = TEAMS.map((t, i) => [t, i]).filter(([t]) => t.college && t.pr === pr); if (!list.length) continue;
      h += `<div class="tgDiv tgCol"><div class="tgDn">COLLEGE · ${PROGRAM[pr].toUpperCase()}S</div><div class="tgRow">` + list.map(([t, i]) => {
        const cur = sel.idx[tgSide] === i, opp = sel.idx[1 - tgSide] === i;
        return `<button class="tgT${cur ? ' cur' : ''}${opp ? ' opp' : ''}" data-i="${i}" style="--c1:${t.c1};--c2:${t.c2}">${teamBadge(t)}<span class="tgN">${t.city}<br><b>${t.name}</b></span><span class="tgO">${teamOvr(t)}</span>${opp ? '<span class="tgOpp">OPPONENT</span>' : ''}</button>`;
      }).join('') + '</div></div>';
    }
    $('tgList').insertAdjacentHTML('afterbegin', h);
    $('tgList').querySelectorAll('.tgCol .tgT').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (i === sel.idx[1 - tgSide]) [sel.idx[0], sel.idx[1]] = [sel.idx[1], sel.idx[0]]; else sel.idx[tgSide] = i;
      Sound.click(); $('tgrid').classList.remove('show'); renderSelect(tgSide);
    });
  };
}
// pregame facts ("2nd-best secondary in the league"): colleges are ranked against colleges, NFL teams against the NFL
{ const _tf = teamFacts; teamFacts = function (tm) {
  if (!tm || CT.mode !== 'college') return _tf(tm);
  const keep = TEAMS.slice(); TEAMS.length = 0; TEAMS.push(...keep.filter(t => !!t.college === !!tm.college));
  try { const f = _tf(tm); return tm.college ? f.map(s => s.replace(/in the league/g, 'in college football')) : f; } finally { TEAMS.length = 0; TEAMS.push(...keep); }
}; }
// back on the title: TEAMS goes back to the NFL + your teams (Daily Challenge, Challenges etc. count on that)
{ const _sh = show; show = function (id) { if (id === 'title' && CT.mode === 'college') CT.useAll(); return _sh(id); }; }
// college logos come from the web: repaint the cards / team list when they arrive
Logo.onReady(() => { if (CT.mode !== 'college' || !$('select').classList.contains('show')) return; if ($('tgrid').classList.contains('show')) renderTeamGrid(); else renderSelect(); });
