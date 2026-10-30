// ---- Practice mode: pick two teams and a situation (down, distance, spot, quarter, clock), call a play, run it, and it resets to the
// same spot right away. No game clock, no score, nothing saved to Season / Career / stats. ----
const PR_KEY = 'bobblePractice';
const Practice = {
  s: null, // the situation you set up
  load() {
    let s = null; try { s = JSON.parse(localStorage.getItem(PR_KEY) || 'null'); } catch (e) {}
    const id = i => TEAMS[i] ? TEAMS[i].id : null, at = (tid, d) => { const i = TEAMS.findIndex(t => t.id === tid); return i >= 0 ? i : d; };
    const you = at(s && s.you, sel.idx[sel.you] || 0); let opp = at(s && s.opp, sel.idx[1 - sel.you] || 1); if (opp === you) opp = (you + 1) % TEAMS.length;
    this.s = { you: id(you), opp: id(opp), side: 'off', down: 1, togo: 10, own: 25, qtr: 1, clock: 180, ...(s || {}) };
    this.s.you = id(you); this.s.opp = id(opp);
  },
  save() { try { localStorage.setItem(PR_KEY, JSON.stringify(this.s)); } catch (e) {} },
  team(k) { return TEAMS.find(t => t.id === this.s[k]) || TEAMS[0]; },

  // ---------- setup screen ----------
  build() {
    const el = document.createElement('div'); el.id = 'practice'; el.className = 'screen';
    const card = (k, side, who) => `<div class="muCard prTeam" id="prT_${k}"><div class="muHead"><span class="pside">${side}</span><span class="who ${who === 'YOU' ? 'you' : 'cpu'}">${who}</span></div>
      <div class="prTB"></div>
      <button class="muArr l" data-k="${k}" data-d="-1" aria-label="previous team"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <button class="muArr r" data-k="${k}" data-d="1" aria-label="next team"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>`;
    el.innerHTML = `<div id="prTop"><span>PRACTICE</span><b>SET THE SITUATION</b></div>
      <div id="prRow"><div id="prTeams">${card('you', 'YOUR TEAM', 'YOU')}${card('opp', 'OPPONENT', 'CPU')}</div>
      <div id="prOpts"><div id="prHead"><b>SITUATION</b><button id="prSl">SLIDERS</button></div><div id="prSet"></div><div id="prSum"></div>
      <div id="prGo"><button id="prBack" class="muBack">BACK</button><button class="big" id="prStart">START PRACTICE</button></div></div></div>`;
    document.getElementById('stage').appendChild(el);
    const arrow = 'M15 5l-7 7 7 7', arrow2 = 'M13 5l-7 7 7 7M19 5l-7 7 7 7';
    const svg = (d, flip) => `<svg viewBox="0 0 24 24"${flip ? ' style="transform:scaleX(-1)"' : ''}><path d="${d}"/></svg>`;
    const rows = [
      ['side', 'YOU ARE ON', 'seg', [['off', 'OFFENSE'], ['def', 'DEFENSE']]],
      ['down', 'DOWN', 'seg', [[1, '1ST'], [2, '2ND'], [3, '3RD'], [4, '4TH']]],
      ['togo', 'TO GO', 'step', [1, 5]],
      ['own', 'BALL ON', 'step', [1, 10]],
      ['qtr', 'QUARTER', 'seg', [[1, '1ST'], [2, '2ND'], [3, '3RD'], [4, '4TH']]],
      ['clock', 'CLOCK', 'step', [15, 60]]
    ];
    const set = $id => el.querySelector('#' + $id);
    for (const [k, label, kind, o] of rows) {
      const row = document.createElement('div'); row.className = 'muRow'; row.dataset.k = k;
      row.innerHTML = `<span class="muL">${label}</span><div class="muC ${kind}"></div>`;
      const c = row.querySelector('.muC');
      if (kind === 'seg') for (const [v, t] of o) { const b = document.createElement('button'); b.dataset.v = v; b.textContent = t; b.onclick = () => this.change(k, v, true); c.appendChild(b); }
      else {
        const mk = (d, path, flip) => { const b = document.createElement('button'); b.className = 'muStep'; b.innerHTML = svg(path, flip); b.onclick = () => this.change(k, d); return b; };
        c.append(mk(-o[1], arrow2), mk(-o[0], arrow), Object.assign(document.createElement('span'), { className: 'muV' }), mk(o[0], arrow, true), mk(o[1], arrow2, true));
      }
      set('prSet').appendChild(row);
    }
    el.querySelectorAll('.muArr').forEach(b => b.onclick = () => this.pickTeam(b.dataset.k, +b.dataset.d));
    set('prBack').onclick = () => { Sound.click(); show('title'); };
    set('prStart').onclick = () => this.start();
    set('prSl').onclick = () => { Sound.click(); Sliders.open(); };
  },
  // clamp the situation so it always makes sense (yards to go can't run past the goal line)
  change(k, v, abs) {
    const s = this.s;
    if (abs) s[k] = v; else s[k] += v;
    if (k === 'side') s.side = v;
    s.down = clamp(s.down, 1, 4); s.qtr = clamp(s.qtr, 1, 4); s.clock = clamp(s.clock, 15, 300); s.own = clamp(s.own, 1, 99);
    s.togo = clamp(s.togo, 1, 100 - s.own); // = 100 - own means goal to go
    Sound.click(); this.save(); this.paint();
  },
  pickTeam(k, d) {
    const o = k === 'you' ? 'opp' : 'you';
    let i = TEAMS.findIndex(t => t.id === this.s[k]);
    do { i = (i + d + TEAMS.length) % TEAMS.length; } while (TEAMS[i].id === this.s[o]);
    this.s[k] = TEAMS[i].id; Sound.click(); this.save(); this.paint();
  },
  // spots read from your side: YOUR 25 / THEIR 35 (own = yards from the offense's goal line)
  spot(own) { const mine = (own < 50) === (this.s.side === 'off'); return own === 50 ? 'THE 50' : `${mine ? 'YOUR' : 'THEIR'} ${own < 50 ? own : 100 - own}`; },
  toGoText(s) { return s.togo >= 100 - s.own ? 'GOAL' : String(s.togo); },
  paint() {
    const s = this.s, el = $('practice');
    for (const k of ['you', 'opp']) {
      const t = Career.withCAP(this.team(k)), c = $('prT_' + k);
      c.style.setProperty('--c1', t.c1); c.style.setProperty('--c2', t.c2); c.style.setProperty('--fg', textOn(t.c1));
      const avg = a => Math.round(a.reduce((n, p) => n + p[3], 0) / a.length);
      c.querySelector('.prTB').innerHTML = `<div class="prLogo">${muBadge(t)}</div><div class="prTN"><span class="muCity">${t.city}</span><span class="muName">${t.name}</span>
        <span class="prOv"><b>${teamOvr(t)}</b> OVR <i>OFF ${avg(t.off)}  ·  DEF ${avg(t.def)}</i></span></div>`;
    }
    el.querySelectorAll('#prSet .muRow').forEach(r => {
      const k = r.dataset.k, v = s[k];
      r.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
      const val = r.querySelector('.muV');
      if (val) val.textContent = k === 'togo' ? this.toGoText(s) : k === 'own' ? this.spot(s.own) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    });
    $('prSum').innerHTML = `${s.side === 'off' ? 'You have the ball' : 'They have the ball'}: <b>${ordinal(s.down)} & ${this.toGoText(s)}</b> at the <b>${this.spot(s.own)}</b>  ·  ${ordinal(s.qtr)} quarter, ${Math.floor(s.clock / 60)}:${String(s.clock % 60).padStart(2, '0')} left`;
  },
  open() { this.load(); this.paint(); show('practice'); },

  // ---------- running it ----------
  start() {
    Sound.init(); Sound.whistle(); Sound.click();
    if (G.mode === 'mobile') goFullscreen();
    this.save();
    const s = this.s, you = this.team('you'), opp = this.team('opp');
    G.demo = false; G.season = false; G.challenge = null; G.mini = null; G.career = false; show(null);
    initGame(TwoWay.expand(Career.withCAP(you)), TwoWay.expand(Career.withCAP(opp)), { qtr: 300, diff: +$('optDiff').value, humanSide: 0, weather: 'clear', coachMode: false, uni: ['home', 'away'],
      practice: { ...s, reps: 0, yds: 0, att: 0, comp: 0, conv: 0, td: 0, to: 0, flags: 0 } });
    Highlights.reset();
    this.hidePanel(); this.reset(); toPlayCall();
  },
  // put everything back to the starting spot
  reset() {
    const P = G.practice, o = P.side === 'off' ? 0 : 1, d = dirOf(o);
    Object.assign(G, { score: [0, 0], timeouts: [3, 3], quarter: P.qtr, clock: P.clock, prevClock: P.clock, pendingRunoff: 0, playClock: 0, next: null, flags: [], fx: [], banner: null,
      patSide: null, twoPt: false, special: null, kickoffSide: null, koPending: false, km: null, kick: null, slowmo: 0, cellyGuy: null, tdScorer: null, runoff: 0,
      twoMinAfterPlay: false, intBy: null, qbWear: [0, 0], paused: false, flagNote: null });
    cam.zoom = 1; cam.focus = null;
    setDrive(o, ownGoal(o) + d * P.own);
    G.down = P.down;
    G.firstDownX = G.los + d * P.togo; G.goalToGo = d * (G.firstDownX - goalX(o)) >= 0;
    if (G.goalToGo) G.firstDownX = goalX(o);
  },
  // the whistle: read the result, reset the spot, show RUN IT AGAIN / CHANGE PLAY / ...
  afterPlay() {
    const P = G.practice, r = this.result();
    P.lastOff = G.play && G.play.off && G.play.off.key; P.lastDef = G.play && G.play.def && G.play.def.key;
    P.reps++; if (r.flag) P.flags++; else { P.yds += r.gain; if (r.pass) { P.att++; if (r.comp) P.comp++; } if (r.conv) P.conv++; if (r.td) P.td++; if (r.to) P.to++; }
    for (const p of G.players) { if (p.celly) Celly.end(p); p.tdRun = null; p.cellyNext = null; }
    this.reset();
    G.phase = 'playcall'; G.ball = null; previewFormation(); G.callStart = G.time;
    this.showPanel(r);
  },
  result() {
    const P = G.practice, lr = G.lastResult || {}, off = G.poss;
    const line = (G.pbpShow && G.pbpShow.text) || '', flag = /^PENALTY on/.test(line); // an accepted flag is the last line of the play
    const gain = lr.gain || 0, cr = G.credit, to = (G.intBy && G.intBy.side !== off) || (lr.type === 'fumble' && G.ball && G.ball.holder && G.ball.holder.side !== off);
    const td = lr.type === 'td' && !to, pass = !!(G.lastPasser || lr.type === 'inc' || (cr && cr.kind === 'rec')) && lr.type !== 'sack';
    const comp = pass && cr && cr.kind === 'rec' && lr.type !== 'inc' && !to;
    const conv = !to && (td || gain >= Math.min(P.togo, 100 - P.own)) && lr.type !== 'inc';
    let head, tone;
    if (flag) { head = 'FLAG ON THE PLAY'; tone = 'flag'; }
    else if (G.intBy && G.intBy.side !== off) { head = lr.type === 'td' ? 'PICK SIX' : 'INTERCEPTED'; tone = 'bad'; }
    else if (to) { head = 'FUMBLE LOST'; tone = 'bad'; }
    else if (td) { head = 'TOUCHDOWN'; tone = 'good'; }
    else if (lr.type === 'inc') { head = 'INCOMPLETE'; tone = 'meh'; }
    else if (lr.type === 'sack') { head = `SACKED  ${gain}`; tone = 'bad'; }
    else { head = (comp ? 'COMPLETE  ' : '') + (gain > 0 ? `+${gain} YARDS` : gain < 0 ? `${gain} YARDS` : 'NO GAIN'); tone = conv ? 'good' : gain > 0 ? 'ok' : 'bad'; }
    if (P.side === 'def' && tone !== 'flag') tone = { good: 'bad', bad: 'good', ok: 'meh', meh: 'good' }[tone];
    const tag = flag ? '' : P.side === 'off' ? (td ? '' : conv ? (P.down === 4 || P.togo >= 100 - P.own ? 'CONVERTED' : 'FIRST DOWN') : to ? '' : 'SHORT') : (to ? 'TAKEAWAY' : conv ? 'THEY CONVERTED' : 'STOP');
    return { head, tone, tag, line, gain, pass, comp, conv, td, to, flag };
  },

  // ---------- after-play panel ----------
  panel() {
    let el = $('prPanel'); if (el) return el;
    el = document.createElement('div'); el.id = 'prPanel';
    el.innerHTML = `<div class="prRes"><b id="prHeadL"></b><span id="prTag"></span></div><div id="prLine"></div><div id="prTally"></div>
      <div class="prBtns"><button class="big gold" id="prAgain">RUN IT AGAIN<i>ENTER</i></button><button id="prPlay">CHANGE PLAY<i>C</i></button><button id="prSit">CHANGE SITUATION<i>S</i></button><button id="prExit">EXIT<i>X</i></button></div>`;
    document.getElementById('stage').appendChild(el);
    $('prAgain').onclick = () => this.again();
    $('prPlay').onclick = () => { Sound.click(); this.hidePanel(); toPlayCall(); };
    $('prSit').onclick = () => { Sound.click(); this.hidePanel(); this.open(); };
    $('prExit').onclick = () => this.exit();
    return el;
  },
  showPanel(r) {
    const el = this.panel(), P = G.practice;
    el.className = 'show ' + r.tone;
    $('prHeadL').textContent = r.head; $('prTag').textContent = r.tag; $('prTag').style.display = r.tag ? '' : 'none';
    $('prLine').textContent = r.line;
    const ypp = P.reps ? (P.yds / P.reps).toFixed(1) : '0.0';
    $('prTally').textContent = `THIS SESSION: ${P.reps} PLAY${P.reps === 1 ? '' : 'S'}  ·  ${ypp} YDS / PLAY` + (P.att ? `  ·  ${P.comp}/${P.att} PASSING` : '') + `  ·  ${P.side === 'off' ? `${P.conv} CONVERTED` : `${P.reps - P.conv - P.flags} STOP${P.reps - P.conv - P.flags === 1 ? '' : 'S'}`}` + (P.to ? `  ·  ${P.to} TURNOVER${P.to === 1 ? '' : 'S'}` : '');
  },
  hidePanel() { const el = $('prPanel'); if (el) el.className = ''; },
  panelUp() { const el = $('prPanel'); return !!(el && el.classList.contains('show')); },
  // same play, same call on the other side
  again() {
    const P = G.practice; if (!P || !P.lastOff) return;
    Sound.click(); this.hidePanel(); this.reset();
    const co = cpuOffCall, cd = cpuDefCall;
    cpuOffCall = () => P.lastOff; cpuDefCall = () => P.lastDef;
    try { G.phase = 'playcall'; previewFormation(); choosePlay(P.side === 'off' ? P.lastOff : P.lastDef); } finally { cpuOffCall = co; cpuDefCall = cd; }
  },
  exit() { Sound.click(); this.hidePanel(); G.practice = null; G.teams = null; G.phase = 'idle'; show('title'); }
};
Practice.build(); screens.push('practice'); menuScreens.push('practice');
$('btnPractice').onclick = () => { Sound.init(); Sound.click(); Practice.open(); };
addEventListener('keydown', e => {
  if (!G.practice || !Practice.panelUp() || G.paused) return;
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); Practice.again(); }
  else if (e.code === 'KeyC') $('prPlay').click(); else if (e.code === 'KeyS') $('prSit').click(); else if (e.code === 'KeyX') Practice.exit();
});
// no game clock, no play clock, no score in practice; the panel goes away if the practice ends any other way (pause menu QUIT)
{ const _u = update; update = function (dt) { _u(dt); const P = G.practice; if (P && G.teams) { G.clock = P.clock; G.prevClock = P.clock; G.pendingRunoff = 0; G.playClock = 0; if (G.score[0] || G.score[1]) G.score = [0, 0]; } else if (Practice.panelUp()) Practice.hidePanel(); }; }
// the CPU offense never kicks in practice (it's a run or a pass from the spot you picked)
{ const _c = cpuOffCall; cpuOffCall = function () { const k = _c(); return G.practice && (k === 'punt' || k === 'fg' || k === 'kneel' || FAKE_PLAYS.some(f => f.key === k)) ? cpuPick(CPU_PASSES, cpuBucket(G.practice.togo, 3, G.practice.own)) : k; }; }
// the tab next to the scorebug says PRACTICE (instead of the late-game clock / what you need)
{ const _c = crunchText; crunchText = function (G) { const P = G.practice; return P && G.teams && !G.demo ? ['PRACTICE', `REP ${P.reps + 1}  ·  ${P.side === 'off' ? 'OFFENSE' : 'DEFENSE'}`, '#f6c31c'] : _c(G); }; }
