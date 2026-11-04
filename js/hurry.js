// ---- Hurry-up / no huddle: late in a half the offense skips the huddle and lines right up ----
// Your offense: a small NO HUDDLE bar instead of the play cards (same play, 3 quick picks, spike, timeout, or the full playbook).
// It comes up on its own when you're behind or tied late (or at the end of the half); NO HUDDLE on the play cards turns it on.
// When you go no huddle the CPU defense can't sub: it's stuck in the call it had last snap.
// CPU offense: it already hurries when it's behind late (engine.js cpuHurry); here it also gets to the line faster and shows it.
// Also: the crowd gets louder as the clock runs down in a close one, and a small NO HUDDLE tag next to the 2:00 DRILL spot.
const Hurry = {
  on: false, poss: -1, skip: false, open: false, lockDef: false, lastDef: null, saidDrive: -1, drive: 0, cpuSaid: -1, cpuNow: false,
  stats: { bars: 0, picks: 0, same: 0, quick: 0, locked: 0, cpuFast: 0, spikes: 0 },
  reset() { this.on = false; this.poss = -1; this.skip = false; this.close(); this.lastDef = null; this.saidDrive = -1; this.cpuSaid = -1; this.drive = 0; this.cpuNow = false; },
  // the last part of a half (the 2:00 drill window, scaled to the quarter length)
  late() { const q = G.quarter; return (q === 2 || q >= 4) && G.clock > 0 && G.clock <= Flow.drillT(); },
  // can your offense go no huddle on this snap?
  can(c) {
    return !!G.teams && !G.demo && !G.mini && !G.practice && !G.online && !G.versus && !G.sitOut && !coachCalls() && G.human >= 0 && G.poss === G.human
      && !(typeof Tutorial !== 'undefined' && Tutorial.active) && c && c.mode === 'off' && !c.twoPt && !c.fourth && G.patSide == null && G.down < 4 && this.late() && !canKneelOut();
  },
  // turns itself on when you need points: behind or tied late, or driving at the end of the half
  want() { const m = G.score[G.poss] - G.score[1 - G.poss]; return G.quarter === 2 || m <= 0; },
  // the play-call screen is about to open: the bar instead?
  intercept(c) {
    if (G.poss !== this.poss) { this.poss = G.poss; this.on = false; this.drive++; } // a new drive starts in the huddle
    if (!this.can(c)) return false;
    if (!this.on && this.want()) this.on = true;
    if (!this.on || this.skip) { this.skip = false; return false; }
    this.showBar(c);
    return true;
  },

  // ---------- the bar ----------
  el() {
    let el = $('hurry'); if (el) return el;
    el = document.createElement('div'); el.id = 'hurry'; el.className = 'screen';
    $('stage').appendChild(el); screens.push('hurry');
    return el;
  },
  shown() { const el = $('hurry'); return !!el && el.classList.contains('show'); },
  plays() { return typeof Playbook !== 'undefined' ? Playbook.list(true) : OFF_PLAYS; },
  // same play as last snap (if it's a normal play), and 3 quick ones: sideline / chunk throws, short ones on short yardage
  menu() {
    const list = this.plays(), has = k => list.find(p => p.key === k && !p.special && !p.kneel);
    const same = has(G.lastOffKey) ? has(G.lastOffKey) : null, toGo = Math.abs(G.firstDownX - G.los);
    const pref = toGo >= 10 ? ['verts', 'flood', 'drive', 'outs', 'ycross', 'smash', 'mwheel'] : toGo <= 3 ? ['slants', 'mesh', 'outs', 'mflat', 'curls', 'smash'] : ['outs', 'smash', 'slants', 'flood', 'curls', 'mesh', 'drive'];
    const quick = pref.map(has).filter(p => p && p !== same).slice(0, 3);
    return { same: same || quick.shift() || has('slants') || list[0], quick };
  },
  showBar(c) {
    const el = this.el(), M = this.menu(), mob = G.mode === 'mobile', key = k => mob ? '' : `<i>${k}</i>`;
    const run = G.pendingRunoff > 0, tos = G.timeouts ? G.timeouts[G.human] : 0, ck = Math.max(0, Math.ceil(G.clock));
    this.M = M; this.open = true; this.stats.bars++;
    el.innerHTML = `<div id="huBox"><div id="huHead"><b>NO HUDDLE</b><span>${G.downText()}  ·  ${run ? '<em>CLOCK RUNNING</em>' : 'CLOCK STOPPED'}  ·  ${Math.floor(ck / 60)}:${String(ck % 60).padStart(2, '0')}</span></div>
      <div id="huBtns"><button class="gold huSame" data-k="${M.same.key}">${key('H')}<small>SAME PLAY</small>${M.same.name}</button>${M.quick.map((p, i) => `<button class="huQ" data-k="${p.key}">${key(i + 1)}${p.name}</button>`).join('')}
      ${c.canSpike ? `<button class="huTool" id="huSpike">${key('X')}SPIKE</button>` : ''}${run && tos > 0 ? `<button class="huTool" id="huTO">${key('T')}TIMEOUT (${tos})</button>` : ''}<button class="huTool" id="huBook">${key('C')}PLAYBOOK</button></div></div>`;
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => this.pick(b.dataset.k, b.classList.contains('huSame')));
    const on = (id, f) => { const b = $(id); if (b) b.onclick = f; };
    on('huSpike', () => this.spike()); on('huTO', () => this.timeout()); on('huBook', () => this.book());
    show('hurry'); $('btnPause').style.display = 'block';
  },
  close() { this.open = false; if (this.shown()) show(null); },
  pick(k, same) {
    if (G.phase !== 'playcall') return this.close();
    this.close(); Sound.click();
    this.stats.picks++; this.stats[same ? 'same' : 'quick']++;
    this.lockDef = true;
    try { choosePlay(k); } finally { this.lockDef = false; }
    G.lastOffKey = k;
    const qb = G.O && G.O[0];
    if (qb) addText(qb.x, qb.y - 2.6, 'NO HUDDLE', '#ffd23f', 16, 1.0);
    if (this.saidDrive !== this.drive) { this.saidDrive = this.drive; addPbp(`No huddle! The ${G.teams[1 - G.poss].name} can't sub.`); }
  },
  spike() { if (G.phase !== 'playcall') return; this.close(); this.stats.spikes++; spikeBall(); },
  timeout() { if (callTimeout(G.human)) this.showBar(playCallCtx()); },
  book() { Sound.click(); this.open = false; this.skip = true; G.hooks.onPlayCall(playCallCtx()); }, // the full play cards, just this snap
  key(e) {
    if (!this.shown() || e.repeat) return;
    const c = e.code, M = this.M; if (!M) return;
    let done = true;
    if (c === 'KeyH' || c === 'Enter' || c === 'Space') this.pick(M.same.key, true);
    else if (/^Digit[1-3]$/.test(c) && M.quick[+c[5] - 1]) this.pick(M.quick[+c[5] - 1].key, false);
    else if (c === 'KeyX' && $('huSpike')) this.spike();
    else if (c === 'KeyT' && $('huTO')) this.timeout();
    else if (c === 'KeyC') this.book();
    else done = false;
    if (done) e.preventDefault();
  },

  // ---------- every game step ----------
  tick() {
    if (!G.teams) return;
    if (this.open && G.phase !== 'playcall') this.close(); // clock ran out, a penalty, the half ended...
    else if (this.open && !this.shown() && !G.paused && !document.querySelector('.screen.show')) { show('hurry'); $('btnPause').style.display = 'block'; } // back from pause
    this.cpuNow = !!G.cpuHurry && !isHumanSide(G.poss) && this.late();
  },
  // the small tag (next to the scorebug, where 2:00 DRILL goes): between plays only, while an offense is in hurry-up
  tagOn() {
    if (G.mini || G.demo || !['dead', 'playcall', 'presnap'].includes(G.phase) || G.patSide != null || !this.late()) return false;
    return (this.on && G.poss === G.human && G.poss === this.poss) || this.cpuNow;
  },
  drawTag(g, x, y) {
    const w = 96, h = 22, run = G.pendingRunoff > 0, fast = G.clock <= 30;
    g.fillStyle = '#0b0f16e8'; roundRect(g, x, y, w, h, 2); g.fill();
    g.fillStyle = '#ffd23f'; g.fillRect(x, y, 4, h);
    g.font = 'italic 900 15px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('NO HUDDLE', x + 12, y + h / 2 + 1);
    if (run) { const p = 0.35 + 0.65 * Math.abs(Math.sin(G.time * (fast ? 7 : 3.5))); g.fillStyle = `rgba(232,40,28,${p})`; g.beginPath(); g.arc(x + w - 11, y + h / 2, 4, 0, 7); g.fill(); } // the clock is running
  },
  // a close game late: the place gets louder as the seconds go
  heat() {
    if (!G.teams || G.demo || G.mini || !(G.quarter >= 4) || Math.abs(G.score[0] - G.score[1]) > 8) return 0;
    const T = Flow.drillT(); if (G.clock > T) return 0;
    return 0.1 + 0.25 * (1 - G.clock / T) + (this.tagOn() ? 0.1 : 0);
  }
};

// ---- hooks ----
{ const _ng = newGame; newGame = function (...a) { const r = _ng.apply(this, a); Hurry.reset(); return r; }; }
{ const _u = update; update = function (dt) { _u(dt); try { Hurry.tick(); } catch (e) { console.error('hurry', e); } }; }
// your offense's play call: the NO HUDDLE bar when it's on
{ const _pc = G.hooks.onPlayCall; G.hooks.onPlayCall = c => { if (!G.demo && !G.online && Hurry.intercept(c)) return; _pc(c); }; }
// the CPU defense can't sub against the no huddle: same call as last snap
{ const _cd = cpuDefCall; cpuDefCall = function () {
  const side = 1 - G.poss, L = Hurry.lastDef;
  if (Hurry.lockDef && L && L.side === side) { Hurry.stats.locked++; return L.k; }
  const k = _cd(); Hurry.lastDef = { k, side }; return k;
}; }
// CPU hurry-up: up to the line and snap quicker (game-clock cost is the same, engine.js snap() keeps the 4 s minimum)
{ const _cp = choosePlay; choosePlay = function (...a) {
  const r = _cp.apply(this, a);
  Hurry.cpuNow = !!G.cpuHurry && !isHumanSide(G.poss) && Hurry.late(); // (cpuOffCall just decided)
  if (G.phase === 'presnap' && Hurry.cpuNow && !G.versus && !G.sitOut && !coachOn() && G.cpuMotion == null && !(G.play && G.play.off && G.play.off.motion)) {
    G.snapTimer = Math.min(G.snapTimer, G.mode === 'mobile' ? 2.0 : 1.1); Hurry.stats.cpuFast++;
    if (Hurry.cpuSaid !== G.poss + ':' + Hurry.drive) { Hurry.cpuSaid = G.poss + ':' + Hurry.drive; if (G.human >= 0) addPbp(`The ${G.teams[G.poss].name} go no huddle.`); }
  }
  return r;
}; }
// after the whistle: a hurrying offense is back on the ball sooner (normal tackles only, not a challenge window); the banner gets its commentary tag (pbp.js)
{ const _ep = endPlay; endPlay = function (res) {
  const live = G.phase === 'live', o = G.poss, r = _ep.apply(this, arguments);
  if (live) {
    try { pbpBanner(); } catch (e) {}
    if (G.phase === 'dead' && G.deadT === 1.15 && G.poss === o && G.pendingRunoff > 0 && Hurry.late() && ((Hurry.on && o === G.human && o === Hurry.poss) || (G.cpuHurry && !isHumanSide(o)))) G.deadT = 0.7;
  }
  return r;
}; }
// the 2:00 DRILL tag spot: NO HUDDLE while an offense is hurrying
{ const _dd = Flow.drawDrill.bind(Flow); Flow.drawDrill = (g, x, y) => { if (Hurry.tagOn()) Hurry.drawTag(g, x, y); else _dd(g, x, y); }; }
{ const _h = CrowdFX.heat.bind(CrowdFX); CrowdFX.heat = () => Math.min(1, _h() + Hurry.heat()); }
// NO HUDDLE on the regular play cards, when it's allowed but off (you were ahead, or you picked PLAYBOOK)
{ const _rc = renderCards; renderCards = function () {
  _rc();
  if (!pcOff || !Hurry.can(pcCtx)) return;
  const hint = $('pcHint'), b = document.createElement('button'); b.className = 'pgbtn tool'; b.textContent = 'NO HUDDLE';
  b.onclick = () => { Sound.click(); Hurry.on = true; Hurry.poss = G.poss; show(null); Hurry.showBar(pcCtx); };
  hint.insertBefore(b, hint.querySelector('.pgtip'));
}; }
addEventListener('keydown', e => Hurry.key(e));
// controller: A picks the box you're on, Y = same play, X = spike, VIEW = timeout
if (typeof Pad !== 'undefined') {
  const _mn = Pad.menuNav.bind(Pad);
  Pad.menuNav = function (i, hit, ...a) {
    if (Hurry.shown() && Hurry.M) {
      if (hit(PB.Y)) return Hurry.pick(Hurry.M.same.key, true);
      if (hit(PB.X) && $('huSpike')) return Hurry.spike();
      if (hit(PB.VIEW) && $('huTO')) return Hurry.timeout();
    }
    return _mn(i, hit, ...a);
  };
  const _bar = Pad.bar.bind(Pad);
  Pad.bar = function () {
    if (!Hurry.shown()) return _bar();
    const el = $('padBar'); if (!el) return;
    const k = 'hurry' + this.type + !!$('huSpike') + !!$('huTO'); if (k === this.barKey) return; this.barKey = k;
    const L = [[[PB.A], 'PICK'], [[PB.Y], 'SAME PLAY']];
    if ($('huSpike')) L.push([[PB.X], 'SPIKE']); if ($('huTO')) L.push([[PB.VIEW], 'TIMEOUT']); L.push([[PB.MENU], 'PAUSE']);
    el.innerHTML = L.map(([ks, t]) => `<span>${ks.map(q => this.icon(q)).join('')}<b>${t}</b></span>`).join('');
    el.classList.remove('fade');
  };
}
