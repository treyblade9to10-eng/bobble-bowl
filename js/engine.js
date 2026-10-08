// ---- Game engine: rules, players, AI, physics ----
// Field x: 0-10 = home end zone, 10-110 = field, 110-120 = away end zone. Home (side 0) attacks right.
const G = {
  phase: 'idle', teams: null, players: [], fx: [], ball: null, banner: null, time: 0, crowdHype: 0,
  score: [0, 0], hooks: {}, hint: '', paused: false
};

const dirOf = s => (s === 0 ? 1 : -1);
// 2-player: both sides are human. withSide() runs code as if `s` were the human side, with that player's keys.
const isHumanSide = s => G.versus ? s === 0 || s === 1 : s === G.human;
function withSide(s, fn) {
  if (!G.versus) return fn();
  G.hd[G.human] = G.humanDef;
  const h = G.human, ctl = Input.ctl;
  G.human = s; G.humanDef = G.hd[s]; Input.ctl = s === G.p1 ? 0 : 1;
  try { return fn(); } finally { G.hd[s] = G.humanDef; G.human = h; G.humanDef = G.hd[h]; Input.ctl = ctl; }
}
function setHD(side, p) { if (G.versus) G.hd[side] = p; if (side === G.human) G.humanDef = p; }
const pName = s => G.versus ? (s === G.p1 ? 'P1' : 'P2') : (s === G.human ? 'YOU' : 'CPU');
const goalX = s => (s === 0 ? 110 : 10);      // goal line this side is attacking
const ownGoal = s => (s === 0 ? 10 : 110);    // goal line this side defends
const fromOwn = (s, x) => dirOf(s) * (x - ownGoal(s));
const MID = FIELD_W / 2;
const GAME_SPEED = 1.15; // a bit faster than real life = arcade feel
const POS_SPD = { QB: 80, RB: 89, WR: 91, TE: 82, OL: 66, DL: 76, LB: 84, CB: 91, S: 88 };

G.downText = function () {
  if (G.special === 'punt' || (G.km && G.km.kind === 'punt' && G.phase === 'kickmeter')) return 'PUNT';
  if (G.special || (G.phase === 'playcall' && G.kickoffSide != null && G.koPending) || (G.km && (G.km.kind === 'ko' || G.km.kind === 'onside') && G.phase === 'kickmeter')) return 'KICKOFF';
  if (G.patSide != null && !G.twoPt) return 'EXTRA POINT';
  if (G.twoPt) return '2-PT TRY';
  if (G.los == null) return '';
  const tg = G.goalToGo ? 'Goal' : Math.max(1, Math.round(Math.abs(G.firstDownX - G.los)));
  return `${ordinal(G.down)} & ${tg}  •  ${spotText(G.poss, G.los)}`;
};
function spotText(s, x) {
  const o = Math.round(fromOwn(s, x));
  if (o === 50) return 'at the 50';
  return o < 50 ? `${G.teams[s].id} ${o}` : `${G.teams[1 - s].id} ${100 - o}`;
}

// ---------------- game setup ----------------
function newGame(home, away, opts) {
  home = Career.withCAP(home); away = Career.withCAP(away);
  Object.assign(G, {
    teams: [home, away], human: opts.humanSide || 0, diff: opts.diff, flags: [], playClock: 0, playoff: !!opts.playoff, qtrLen: opts.qtr, score: [0, 0], quarter: 1, clock: opts.qtr,
    fx: [], banner: null, players: [], ball: null, patSide: null, twoPt: false, next: null, firstPoss: 1, paused: false,
    pstats: {}, tstats: [{ pass: 0, rush: 0, to: 0 }, { pass: 0, rush: 0, to: 0 }],
    timeouts: [3, 3], special: null, pendingRunoff: 0, mini: null, scenario: opts.scenario || null,
    weather: opts.weather || 'clear', night: !!opts.night, uni: opts.uni || null, pbp: [], pbpShow: null, lastResult: null,
    versus: !!opts.versus, p1: opts.humanSide || 0, hd: [null, null], hp: [null, null], humanDef: null
  });
  if (G.versus) G.diff = 1;
  Input.versus = G.versus; Input.ctl = 0;
  setupXFactors();
  if (opts.scenario) { // e.g. the Two-Minute Challenge
    const sc = opts.scenario;
    Object.assign(G, { quarter: sc.quarter, clock: sc.clock, score: sc.score.slice() });
    if (sc.timeouts) G.timeouts = sc.timeouts.slice();
    setDrive(sc.poss, ownGoal(sc.poss) + dirOf(sc.poss) * sc.own);
    showBanner(sc.title, sc.sub, '#ffd23f', 2.6);
    return toPlayCall();
  }
  showBanner('KICKOFF!', `${away.city} ${away.name} get the ball first`, '#fff', 2.2);
  startKickoff(0);
}

function setDrive(side, x) {
  G.poss = side; G.los = x; G.ballY = MID; G.down = 1; G.patSide = null; G.twoPt = false;
  setFirstDown();
}
function setFirstDown() {
  const d = dirOf(G.poss);
  G.firstDownX = G.los + d * 10;
  G.goalToGo = d * (G.firstDownX - goalX(G.poss)) >= 0;
  if (G.goalToGo) G.firstDownX = goalX(G.poss);
}

function stat(p) {
  if (!G.pstats) G.pstats = {};
  const k = p.side + ':' + p.name;
  return G.pstats[k] || (G.pstats[k] = { name: p.name, side: p.side, pos: p.pos, pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, int: 0, sack: 0, comp: 0, att: 0 });
}

// ---------------- play calling ----------------
function toPlayCall() {
  G.phase = 'playcall';
  G.ball = null;
  G.flags = [];
  G.fx = G.fx.filter(f => f.kind !== 'flag');
  previewFormation();
  G.playClock = (isHumanSide(G.poss) && !(G.patSide != null && !G.twoPt)) ? (G.versus ? 40 : G.mode === 'mobile' ? 25 : 20) : 0;
  G.koPending = false; G.special = null; G.kickoffSide = null; G.callStart = G.time; G.timeoutCalled = false;
  if (G.patSide != null && !G.twoPt) {
    if (isHumanSide(G.patSide)) G.hooks.onPlayCall({ mode: 'pat', side: G.patSide });
    else { const two = chance(0.12) || (G.quarter >= 4 && G.score[G.patSide] - G.score[1 - G.patSide] === -2); setTimeout(() => choosePAT(two ? 'two' : 'xp'), 700); }
    return;
  }
  cpuTimeoutCheck();
  if (G.versus) return G.hooks.onPlayCall({ ...withSide(G.poss, playCallCtx), side: G.poss });
  G.hooks.onPlayCall(playCallCtx());
}
function playCallCtx() {
  const humanOff = G.poss === G.human;
  return { mode: humanOff ? 'off' : 'def', fourth: G.down === 4 && !G.twoPt, twoPt: G.twoPt, fgDist: Math.round(Math.abs(goalX(G.poss) - G.los) + 17),
    fgMax: Math.round(fgRange(kickerOf(G.poss, 'fg').ovr)), toGo: Math.round(Math.abs(G.firstDownX - G.los)), down: G.down,
    timeouts: G.timeouts ? G.timeouts[G.human] : 0, canSpike: humanOff && G.down < 4 && !G.twoPt && G.pendingRunoff > 0, lastKey: humanOff ? G.lastOffKey : G.lastDefKey };
}

function cpuOffCall() {
  if (G.down === 4 && !G.twoPt) {
    const fg = Math.abs(goalX(G.poss) - G.los) + 17;
    const toGo = Math.abs(G.firstDownX - G.los);
    const behind = G.score[G.poss] < G.score[1 - G.poss];
    const desperate = G.quarter >= 4 && behind && G.clock < 60;
    if (!desperate && !(toGo <= 2 && fromOwn(G.poss, G.los) > 45)) {
      const fgOk = fg <= fgRange(kickerOf(G.poss, 'fg').ovr) - 4;
      if (toGo <= 5 && chance(0.04)) return fgOk ? 'fakefg' : 'fakepunt';
      if (fgOk && !(desperate)) return 'fg';
      return 'punt';
    }
  }
  const toGo = Math.abs(G.firstDownX - G.los);
  const runW = toGo <= 3 ? 0.55 : toGo >= 8 ? 0.15 : 0.35;
  if (chance(runW)) return pick(['zone', 'zone', 'toss', 'qbdraw', 'dive', 'counter', 'jet']);
  if (G.clock < 8 && G.quarter % 2 === 0 && fromOwn(G.poss, G.los) > 45) return 'hail';
  return toGo >= 12 ? pick(['verts', 'pa', 'mesh', 'curls', 'verts', 'ycross', 'flood', 'stopgo', 'drive']) : pick(['slants', 'mesh', 'curls', 'screen', 'pa', 'verts', 'slants', 'outs', 'bubble', 'smash', 'drive', 'ycross']);
}
function cpuDefCall() {
  const toGo = Math.abs(G.firstDownX - G.los);
  if (G.down === 4 && !G.twoPt && toGo > 2 && chance(0.75)) return 'alldrop';
  if (toGo <= 2 && chance(0.5)) return 'run';
  if (toGo >= 15 && chance(0.4)) return 'prevent';
  return pick(['man', 'c2', 'c3', 'blitz', 'man', 'c3', 'cb', 'run', 'c1', 'c4', 'tampa', 'fire', toGo > 6 ? 'c4' : 'c0']);
}

// called by the UI when the human picks a card
function choosePlay(key, defPick) {
  const humanOff = G.versus || G.poss === G.human;
  const offKey = humanOff ? key : cpuOffCall();
  const defKey = G.versus ? (defPick || 'c3') : humanOff ? cpuDefCall() : key;
  if (G.versus) { G.lastOffKeys = G.lastOffKeys || [null, null]; G.lastOffKeys[G.poss] = offKey; G.lastDefKeys = G.lastDefKeys || [null, null]; G.lastDefKeys[1 - G.poss] = defKey; }
  else if (humanOff) G.lastOffKey = key; else G.lastDefKey = key;
  if (offKey === 'punt' || offKey === 'fg') { doKick(offKey); return; }
  const fake = FAKE_PLAYS.find(p => p.key === offKey);
  if (fake) setupFake(fake);
  else setupPlay(OFF_PLAYS.find(p => p.key === offKey), DEF_PLAYS.find(p => p.key === defKey));
  G.phase = 'presnap';
  G.snapTimer = humanOff ? Infinity : 1.6;
}

function choosePAT(kind) {
  if (kind === 'two') {
    const s = G.patSide;
    G.poss = s; G.los = goalX(s) - dirOf(s) * 3; G.ballY = MID; G.down = 1; G.twoPt = true; setFirstDown();
    toPlayCall();
  } else doKick('xp');
}

// ---------------- formations ----------------
function makePlayer(side, isOff, slot, tuple) {
  const [pos, name, num, ovr0, spd0, skin0, ex] = tuple;
  const h = hashStr(name);
  const cpu = side !== G.human;
  const ovr = clamp(ovr0 + (cpu && !G.versus ? [-7, 0, 5, 10][G.diff] : 0), 20, 99);
  const big = pos === 'OL' || pos === 'DL';
  const spdR = spd0 || POS_SPD[pos] || 80;
  // Madden speed matters: 99 SPD ≈ 12 yd/s, 85 ≈ 9.4, 70 ≈ 6.7
  const yps = Math.max(4.8, 2.6 + (spdR - 50) * 0.16) * GAME_SPEED;
  const skill = isOff && (pos === 'WR' || pos === 'TE' || pos === 'RB');
  const cpuMul = cpu && !G.versus ? (skill ? [0.85, 0.91, 0.96, 1.01] : [0.92, 0.98, 1.02, 1.06])[G.diff] : 1;
  return {
    side, off: isOff, slot, pos, name, num, ovr,
    x: 0, y: 0, vx: 0, vy: 0, dvx: 0, dvy: 0,
    spd: yps * cpuMul * Weather.speed(), spdR, acc: (big ? 20 : 30) * GAME_SPEED * Weather.grip(),
    face: { skin: skin0 != null ? skin0 : h % 6, beard: ((h >> 5) % 4) === 0, visor: ((h >> 7) % 5) === 0, dir: dirOf(side) },
    stiff: 0, stiffCd: 0, throwAnim: 0, celebrate: 0, dizzy: 0,
    head: { ox: 0, oy: 0, vx: 0, vy: 0, rot: 0 }, headScale: 1 + ((h >> 9) % 5) * 0.035 + (pos === 'QB' ? 0.06 : 0),
    anim: (h % 100) / 10, speedNow: 0, stamina: 1, down: 0, downDir: 1, stun: 0, spin: 0, juke: 0, jukeCd: 0, spinCd: 0,
    dive: 0, tackleCd: 0, engaged: null, shed: 0, shedCd: 0, mouth: '', mouthT: 0, isHuman: false, throwKey: 0, openness: null,
    role: 'idle', route: null, assign: null, aiIdle: 0,
    xf: (G.xf && G.xf[side + ':' + name]) || null,
    cap: !!(ex && ex.cap), thp: ex && ex.thp || null, tha: ex && ex.tha || null
  };
}

function parseAssign(a) {
  if (a === 'rush' || a === 'spy') return { type: a };
  const p = a.split(':');
  if (p[0] === 'man') return { type: 'man', t: +p[1] };
  return { type: 'zone', d: +p[1], y: p[2] };
}
function zoneY(code) {
  const by = G.ballY;
  if (code === 'mid') return by;
  if (code === 'edgeT') return 6; if (code === 'edgeB') return FIELD_W - 6;
  if (code === 'thirdT') return 9; if (code === 'thirdB') return FIELD_W - 9;
  return clamp(by + +code, 3, FIELD_W - 3);
}

function previewFormation() {
  const off = OFF_PLAYS[2], def = DEF_PLAYS[0];
  setupPlay(off, def, true);
}

function setupPlay(offPlay, defPlay, preview) {
  const o = G.poss, dsd = 1 - o, d = dirOf(o), L = G.los, by = G.ballY;
  const ws = by <= MID ? 1 : -1; // the wide side
  const P = [];
  const offT = G.teams[o], defT = G.teams[dsd];
  offT.off.forEach((t, i) => P.push(makePlayer(o, true, i, t)));
  defT.def.forEach((t, i) => P.push(makePlayer(dsd, false, i, t)));
  const O = P.slice(0, 8), D = P.slice(8);
  const at = (p, x, y) => { p.x = x; p.y = y; p.hx = x; p.hy = y; };
  at(O[0], L - d * 4, by);
  at(O[1], L - d * 5, by + ws * 3.4);
  at(O[2], L - d * 0.8, Math.max(4, by - 16));
  at(O[3], L - d * 0.8, Math.min(FIELD_W - 4, by + 16));
  at(O[4], L - d * 1.5, by + ws * 8);
  at(O[5], L - d * 0.7, by - 2.4); at(O[6], L - d * 0.7, by); at(O[7], L - d * 0.7, by + 2.4);

  // offense roles
  for (const p of O) p.role = 'idle';
  O[0].role = 'qb';
  for (let s = 5; s <= 7; s++) { O[s].role = offPlay.type === 'run' ? 'runblock' : offPlay.screen ? 'screenblock' : 'passblock'; O[s].blockTarget = D[s - 5]; }
  for (let s = 1; s <= 4; s++) {
    const p = O[s];
    const rt = offPlay.routes && offPlay.routes[s];
    if (s === (offPlay.carrier || 1) && offPlay.rb) {
      p.role = 'runpath';
      p.route = { pts: offPlay.rb.path.map(([dd, w]) => ({ x: L + d * dd, y: clamp(by + ws * w, 1.5, FIELD_W - 1.5) })), end: offPlay.rb.end, i: 0 };
    } else if (rt) {
      const out = Math.sign(p.y - by) || ws;
      p.role = rt.end === 'block' ? 'stalk' : 'route';
      const deepX = goalX(o) + d * 7.5; // 2.5 yards in front of the end line
      p.route = { pts: rt.r.map(([dd, oo]) => { const x = p.x + d * dd; return { x: d > 0 ? Math.min(x, deepX) : Math.max(x, deepX), y: clamp(p.y + out * oo, 1.2, FIELD_W - 1.2) }; }), end: rt.end, i: 0 };
      if (rt.end === 'block') p.route.blockAfter = true;
    } else {
      p.role = s === 1 ? 'passblock' : 'stalk';
    }
  }

  // run plays: the slot guy (when he isn't carrying it) blocks down on a linebacker
  if (offPlay.type === 'run' && !offPlay.qbRun && (offPlay.carrier || 1) !== 4) {
    O[4].role = 'runblock'; O[4].route = null; O[4].crack = true;
    const pth = offPlay.rb && offPlay.rb.path, w = pth ? pth[pth.length - 1][1] : 0;
    O[4].crackY = Math.abs(w) > 2 ? by + ws * Math.sign(w) * 5 : null; // seal the linebacker on the side the play is going
    if (offPlay.pull && O[4].crackY != null) { // counter: the backside guard pulls and kicks out the playside linebacker
      const g = Math.sign(O[4].crackY - by) > 0 ? O[5] : O[7];
      g.crack = true; g.crackY = O[4].crackY; O[4].crackY = null;
    }
  }
  // defense alignment + assignments
  D.forEach((p, i) => { p.assign = parseAssign(defPlay.a[i]); });
  at(D[0], L + d * 1.3, by - 2.8); at(D[1], L + d * 1.3, by); at(D[2], L + d * 1.3, by + 2.8);
  at(D[3], L + d * 5, by - 4.5); at(D[4], L + d * 5, by + 4.5);
  at(D[5], L + d * 6, O[2].y); at(D[6], L + d * 6, O[3].y); at(D[7], L + d * 12, by);
  const base = D.map(p => ({ x: p.x, y: p.y }));
  for (const p of D) {
    const a = p.assign;
    if (a.type === 'man' && p.slot >= 5) { const t = O[a.t]; at(p, t.x + d * (p.pos === 'CB' ? 2 : 4), t.y + (t.y > by ? -0.6 : 0.6)); }
    if (a.type === 'rush' && p.slot >= 3) { at(p, L + d * (p.slot >= 5 ? 3 : 2.5), lerp(p.y, by, p.slot >= 5 ? 0.45 : 0.3)); }
    if (a.type === 'zone' && p.slot >= 5 && a.d > 10) { at(p, L + d * Math.min(a.d - 4, 14), lerp(p.y, zoneY(a.y), 0.4)); }
  }

  // the CPU defense disguises its call: blitzers sometimes hide in base spots, cover guys sometimes walk up like they're coming
  if (!preview && dsd !== G.human && G.human >= 0 && !G.versus) {
    D.forEach((p, i) => {
      if ((p.x !== base[i].x || p.y !== base[i].y) && chance(0.5)) at(p, base[i].x, base[i].y);
      else if (p.assign.type !== 'rush' && p.slot >= 3 && p.slot <= 6 && chance(0.22)) at(p, L + d * 2.6, lerp(p.y, by, 0.35));
    });
    if (D[7].assign.type === 'zone' && D[7].assign.d > 10 && chance(0.3)) at(D[7], L + d * 7, by + rand(-5, 5)); // safety rotates late
  }
  G.players = P; G.O = O; G.D = D;
  G.refs = [{ x: L - d * 11, y: clamp(by + 7, 3, FIELD_W - 3), face: -d, anim: 0, throwT: 0 },
            { x: L + d * 17, y: clamp(by - 6, 3, FIELD_W - 3), face: -d, anim: 0, throwT: 0 }];
  G.play = { off: offPlay, def: defPlay, t: 0 };
  G.ball = { x: L, y: by, z: 0, holder: preview ? null : O[0], flight: null, loose: null };
  if (!preview) G.ball.holder = O[0];
  else G.ball.holder = O[6]; // center holds it while we pick
  G.bstate = 'snap'; G.qbScramble = false; G.humanScramble = false; G.aim = null; G.fake = null; G.special = null; G.qbThink = 0; G.handedOff = false; G.intended = null;
  G.runoff = 0; G.passPlay = offPlay.type === 'pass'; G.thrownAway = false;
  // human control
  for (const p of P) p.isHuman = false;
  if (G.versus) { G.hd[dsd] = D[3]; G.hd[o] = null; G.humanDef = G.hd[G.human]; }
  else if (o !== G.human) G.humanDef = D.find(p => p.cap) || D[3];
  updateHuman();
}

// ---------------- snap & live play ----------------
// the clock hit 0:00 while you were in the huddle: quarter's over, no snap
function clockRanOut() {
  G.pendingRunoff = 0; G.playClock = 0;
  G.phase = 'dead'; G.deadT = 0.9; G.next = null; G.ball = G.ball || { x: G.los, y: G.ballY, z: 0 };
  showBanner('TIME EXPIRES', '', '#fff', 1.2); Sound.whistle();
  if (G.hooks.onClockOut) G.hooks.onClockOut();
}

function snap() {
  burnHuddleClock();
  G.phase = 'live'; G.play.t = 0; Sound.hike(); G.throwT = null; G.playClock = 0;
  G.credit = null; G.lastTackler = null; G.intBy = null; G.breakup = null; G.lastResult = null;
  if (typeof Replay !== 'undefined') Replay.begin();
  if (G.fake) { showBanner(G.fake === 'punt' ? 'FAKE PUNT!' : 'FAKE FIELD GOAL!', '', '#7fd3ff', 1.3); G.crowdHype = 1; }
  if (!G.twoPt && chance(0.012)) { const dl = pick(G.D.slice(0, 3)); throwFlag('OFFSIDE', dl.side, dl.x, dl.y, dl); }
  G.ball.holder = G.O[0]; G.bstate = 'snap';
  addDust(G.los, G.ballY, 4);
}

function update(dt) {
  if (G.paused) return;
  if (G.phase === 'replay') { Replay.update(dt); return; }
  if (G.slowmo > 0) { G.slowmo -= dt; dt *= 0.35; }
  G.time += dt;
  for (const p of G.players) { p.throwAnim = Math.max(0, p.throwAnim - dt); p.celebrate = Math.max(0, p.celebrate - dt); if (p.down <= 0) p.dizzy = 0; }
  G.crowdHype = Math.max(0, G.crowdHype - dt * 0.4);
  // game clock keeps running between plays after a tackle in bounds (dead ball, play call, pre-snap) until the snap or a timeout
  if (G.pendingRunoff > 0 && G.clock > 0 && !G.demo && !G.mini && (G.phase === 'dead' || G.phase === 'playcall' || G.phase === 'presnap')) {
    G.clock = Math.max(0, G.clock - dt);
    if (G.clock <= 0 && G.phase !== 'dead') return clockRanOut();
  }
  // play clock (only when you have the ball)
  if ((G.phase === 'playcall' || G.phase === 'presnap') && G.playClock > 0 && !G.demo) {
    G.playClock -= dt;
    if (G.playClock <= 0) return delayOfGame();
  }
  if (G.phase === 'presnap') {
    if (G.versus) { withSide(G.poss, () => presnapInput(dt)); if (G.phase === 'presnap') withSide(1 - G.poss, () => presnapInput(dt)); }
    else if (presnapInput(dt) === 'audible') return;
    idlePlayers(dt);
  } else if (G.phase === 'live') {
    livePlay(dt);
  } else if (G.phase === 'dead') {
    for (const p of G.players) { p.dvx = 0; p.dvy = 0; applyMove(p, dt); if (p.celly) p.celly.t += dt; }
    const cg = G.cellyGuy;
    if (cg) withSide(cg.side, () => {
      const moves = { ArrowUp: 'leap', KeyW: 'leap', ArrowDown: 'griddy', KeyS: 'griddy', ArrowLeft: 'spike', KeyA: 'spike', ArrowRight: 'dab', KeyD: 'dab' };
      for (const k in moves) if (Input.hit(k)) {
        cg.celly = { type: moves[k], t: 0 }; cg.celebrate = 3;
        addText(cg.x, cg.y - 2, { leap: 'LEAP!', griddy: 'THE GRIDDY!', spike: 'SPIKE IT!', dab: 'DAB!' }[moves[k]], '#ffd23f', 26, 1);
        Sound.boing(); Sound.crowd(false); G.crowdHype = 1.5;
        if (moves[k] === 'spike') { G.ball.holder = null; G.ball.x = cg.x + cg.face.dir * 0.6; G.ball.y = cg.y; G.ball.z = 2; G.ball.dead = { vx: cg.face.dir * 2, vy: rand(-1, 1) }; G.ball.bounce = 0.9; }
      }
    });
    updateBallPhysicsDead(dt);
    G.deadT -= dt;
    if (G.deadT <= 0) { if (Replay.want()) Replay.start(); else afterPlay(); }
  } else if (G.phase === 'kick') {
    updateKick(dt);
    idlePlayers(dt);
  } else if (G.phase === 'kickmeter') {
    withSide(G.km ? G.km.side : G.human, () => updateKickMeter(dt));
    idlePlayers(dt);
  } else if (G.phase === 'mini') {
    miniUpdate(dt);
  } else if (G.phase === 'playcall') {
    idlePlayers(dt);
  }
  if (Replay.rec && (G.phase === 'live' || G.phase === 'dead')) Replay.record();
  updateRefs(dt);
  updateFx(dt);
  updateHint();
  updateCamera(dt);
}
// before the snap: offense snaps / hot routes, defense picks who to control
function presnapInput(dt) {
  if (Input.hit('KeyT')) callTimeout(G.human);
  if (Input.hit('KeyZ') && !G.versus) { audible(); return 'audible'; }
  if (G.poss === G.human) {
    for (const [k, s2] of [['Digit1', 2], ['Digit2', 3], ['Digit3', 4], ['Digit4', 1]]) if (Input.hit(k)) hotRoute(s2);
    let tapped = false;
    for (const c of Input.taps) { // tap a receiver = hot route, tap anywhere else = snap
      let best = null, bd = 50;
      for (const r of G.O) if (r.slot >= 1 && r.slot <= 4) { const dd = Math.hypot(sx(r.x) - c.x, sy(r.y) - 35 - c.y); if (dd < bd) { bd = dd; best = r; } }
      if (best && G.play.off.type === 'pass') { hotRoute(best.slot); tapped = true; }
    }
    if (Input.hit('Space') || (Input.taps.length && !tapped)) snap();
  } else {
    G.snapTimer -= dt;
    if (Input.hit('KeyQ') || Input.hit('Tab')) presnapSwitch();
    if (G.snapTimer <= 0) snap();
  }
}

function updateRefs(dt) {
  if (!G.refs || !G.ball) return;
  const b = G.ball, d = dirOf(G.poss);
  const live = G.phase === 'live';
  G.refs.forEach((r, i) => {
    r.throwT = Math.max(0, r.throwT - dt);
    let tx = r.x, ty = r.y;
    if (live) { tx = i === 0 ? b.x - d * 9 : Math.max(b.x + d * 8, r.x * 0 + b.x + d * 8); ty = i === 0 ? clamp(b.y + 7, 2, FIELD_W - 2) : clamp(b.y - 7, 2, FIELD_W - 2); }
    const dx = tx - r.x, dy = ty - r.y, m = Math.hypot(dx, dy);
    const sp = Math.min(m * 2, 7);
    if (m > 0.3) { r.x += dx / m * sp * dt; r.y += dy / m * sp * dt; r.anim += sp * dt * 1.5; r.face = Math.abs(dx) > 0.3 ? Math.sign(dx) : r.face; r.moving = sp; }
    else r.moving = 0;
  });
}

function idlePlayers(dt) { for (const p of G.players) { p.dvx = 0; p.dvy = 0; applyMove(p, dt); } }

function livePlay(dt) {
  const pl = G.play; pl.t += dt;
  if (G.clock > 0) G.clock = Math.max(0, G.clock - dt);
  const b = G.ball;
  updateHuman();

  // AI + human desired velocities
  for (const p of G.players) {
    p.tackleCd = Math.max(0, p.tackleCd - dt); p.shedCd = Math.max(0, p.shedCd - dt);
    p.jukeCd = Math.max(0, p.jukeCd - dt); p.spinCd = Math.max(0, p.spinCd - dt);
    p.stiffCd = Math.max(0, p.stiffCd - dt); p.stiff = Math.max(0, p.stiff - dt);
    if (p.hit > 0) { p.hit -= dt; if (p.hit <= 0) { p.hit = 0; p.down = 0.7; p.downDir = p.vx >= 0 ? 1 : -1; addText(p.x, p.y, 'WHIFF!', '#ccc', 16, 0.7); } }
    p.hitCd = Math.max(0, (p.hitCd || 0) - dt);
    p.jump = Math.max(0, (p.jump || 0) - dt); p.jumpCd = Math.max(0, (p.jumpCd || 0) - dt); p.swimCd = Math.max(0, (p.swimCd || 0) - dt);
    p.stun = Math.max(0, p.stun - dt); p.juke = Math.max(0, p.juke - dt); p.spin = Math.max(0, p.spin - dt);
    if (p.mouthT > 0) { p.mouthT -= dt; if (p.mouthT <= 0) p.mouth = ''; }
    if (p.down > 0 || p.stun > 0) { p.dvx = p.dvy = 0; continue; }
    if (p.dive > 0) continue; // dive keeps its velocity
    p.humanDriven = false; p.sprinting = false;
    if (p.isHuman && withSide(p.side, () => humanControl(p, dt) && (p.humanDriven = Input.axis().m > 0.1 || Input.stick.m > 0.15 || Input.pointer.down || p.dive > 0, true))) { p.sdx = p.dvx; p.sdy = p.dvy; continue; }
    ai(p, dt);
    // smooth AI steering so players don't twitch
    const k = 1 - Math.exp(-dt * 12);
    p.sdx = p.sdx == null ? p.dvx : lerp(p.sdx, p.dvx, k); p.sdy = p.sdy == null ? p.dvy : lerp(p.sdy, p.dvy, k);
    if (p.juke <= 0) { p.dvx = p.sdx; p.dvy = p.sdy; }
  }
  resolveBlocks(dt);
  for (const p of G.players) {
    applyMove(p, dt);
    if (p.off) { (p.hist || (p.hist = [])).push({ t: pl.t, x: p.x, y: p.y, vx: p.vx, vy: p.vy }); if (p.hist.length > 45) p.hist.shift(); }
  }
  separate();

  // handoffs / pitches
  if (G.bstate === 'snap' && b.holder === G.O[0] && pl.off.type === 'run' && !pl.off.qbRun && !G.handedOff) {
    const rb = G.O[pl.off.carrier || 1];
    if (pl.off.toss && pl.t > 0.18) { G.handedOff = true; throwTo(G.O[0], rb, true); }
    else if (!pl.off.toss && pl.t > 0.25 && (dist(G.O[0], rb) < 1.6 || pl.t > (pl.off.carrier ? 1.5 : 0.9))) {
      G.handedOff = true; b.holder = rb; G.bstate = 'run'; stat(rb); G.credit = { p: rb, kind: 'rush' };
    }
  }
  // QB crosses the line = runner
  if (G.bstate === 'snap' && b.holder === G.O[0] && dirOf(G.poss) * (b.holder.x - G.los) > 0.5) {
    G.bstate = 'run'; G.credit = { p: b.holder, kind: 'rush' };
  }
  if (G.bstate === 'snap' && b.holder === G.O[0] && !G.O[0].isHuman) cpuQB(dt);
  if (G.humanScramble && G.bstate === 'snap' && b.holder === G.O[0]) { G.qbScramble = true; }

  // ball
  if (b.flight) updateFlight(dt);
  if (b.loose) updateLoose(dt);
  if (b.holder) { b.x = b.holder.x; b.y = b.holder.y; b.z = 1; }

  // throw markers for human QB
  withSide(G.poss, humanQBInput);

  if (G.phase !== 'live') return;
  checkFouls();
  checkTackles();
  if (G.phase !== 'live') return;
  checkBounds();
}

function humanQBInput() {
  const b = G.ball;
  const canThrow = humanCanThrow();
  for (const p of G.O) { p.throwKey = 0; p.openness = null; }
  if (canThrow) for (const s of [2, 3, 4, 1]) {
    const r = G.O[s];
    if (eligible(r)) { r.throwKey = s === 1 ? 4 : s - 1; r.openness = openness(r); }
  }
  G.aim = null;
  if (canThrow) {
    const qb = G.O[0];
    const keys = { Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 1, Numpad1: 2, Numpad2: 3, Numpad3: 4, Numpad4: 1 };
    const style = Input.held('ShiftLeft') ? 'bullet' : Input.held('ControlLeft', 'ControlRight') ? 'lob' : 'normal';
    for (const k in keys) if (Input.hit(k)) { const r = G.O[keys[k]]; if (eligible(r)) { throwTo(qb, r, false, null, style, Input.axis()); break; } }
    const P = Input.pointer;
    if (G.ball.holder === qb && P.down && P.moved) {
      P.aiming = true;
      const t = aimTarget(qb, P.x0 - P.x, P.y0 - P.y);
      const back = dirOf(G.poss) * (t.x - qb.x) < -1.5;
      G.aim = { style: G.mode === 'mobile' ? '' : style, tx: t.x, ty: t.y, run: back, target: back ? null : receiverFor(qb, t.x, t.y), from: { x: P.x0, y: P.y0 }, to: { x: P.x, y: P.y } };
    }
    if (G.ball.holder === qb && Input.release) {
      const v = Input.release;
      if (Math.hypot(v.x, v.y) > 28) {
        const t = aimTarget(qb, v.x, v.y);
        if (dirOf(G.poss) * (t.x - qb.x) < -1.5) qbTakeOff(qb); // aimed backwards = QB runs it
        else throwAt(qb, t.x, t.y, G.mode === 'mobile' ? (Input.flick ? 'bullet' : 'normal') : style);
      }
    }
    if (G.ball.holder === qb) for (const c of Input.taps) {
      let best = null, bd = 60;
      for (const r of G.O) if (r.throwKey) { const dd = Math.min(Math.hypot(sx(r.x) - c.x, sy(r.y) - 40 - c.y), Math.hypot(sx(r.x) - c.x, sy(r.y) - 120 - c.y)); if (dd < bd) { bd = dd; best = r; } }
      if (best) { throwTo(qb, best, false, null, style); break; }
    }
  }
}

const FOULS = {
  DPI: { name: 'PASS INTERFERENCE', def: true, text: 'Ball at the spot • Automatic 1st down' },
  RTP: { name: 'ROUGHING THE PASSER', def: true, text: '15 yards • Automatic 1st down' },
  OFFSIDE: { name: 'OFFSIDE', def: true, text: '5 yards' },
  HOLD: { name: 'HOLDING', def: false, text: '10 yards • Replay the down' },
  DELAY: { name: 'DELAY OF GAME', def: false, text: '5 yards • Replay the down' }
};
function throwFlag(type, foulSide, x, y, who) {
  if (!G.flags) G.flags = [];
  if (G.flags.some(f => f.type === type)) return;
  G.flags.push({ type, side: foulSide, x, y, num: who ? who.num : null });
  let ref = G.refs && G.refs[0];
  if (G.refs) for (const r of G.refs) if (Math.hypot(r.x - x, r.y - y) < Math.hypot(ref.x - x, ref.y - y)) ref = r;
  if (ref) { ref.throwT = 0.5; G.fx.push({ kind: 'flag', ax: ref.x, ay: ref.y, x, y, t: 0, T: 0.55, z: 0, vz: 0, life: 99, max: 99 }); }
  addText(x, y, 'FLAG!', '#ffe14d', 26, 1.1);
  Sound.tone(1800, 0.25, 'sine', 0.07); Sound.tone(2000, 0.25, 'sine', 0.05, 0, 0.08);
}
function checkFouls() {
  const b = G.ball, pl = G.play, qb = G.O[0], off = G.poss;
  // roughing the passer: hitting the QB after he already threw it
  if (G.throwT != null && pl.t - G.throwT < 1.0 && b.holder !== qb && qb.down <= 0) {
    for (const df of G.D) {
      if (df.engaged || df.down > 0 || df.side === off || dist(df, qb) > 0.9 || df.speedNow < 4) continue;
      if ((df.isHuman && df.humanDriven) || (!df.rtpChecked && !df.isHuman && chance(0.03))) {
        throwFlag('RTP', df.side, qb.x, qb.y, df);
        qb.down = 1.1; qb.downDir = dirOf(df.side); qb.dizzy = 1; df.down = 0.6; Sound.tackle(); cam.shake = 8;
      }
      df.rtpChecked = true;
    }
  }
  // pass interference: laying out a receiver before he has the ball
  const h = G.versus ? G.hp[1 - off] : G.humanPlayer;
  if (h && h.side !== off && (G.bstate === 'snap' || G.bstate === 'air') && h.down <= 0) {
    for (const r of G.O) {
      if (!eligible(r) || r === b.holder || r.down > 0) continue;
      if (h.humanDriven && dist(h, r) < 0.95 && (h.dive > 0 || h.speedNow > 8.5)) {
        const x = dirOf(off) * (r.x - G.los) > 0 ? r.x : G.los;
        throwFlag('DPI', h.side, x, r.y, h);
        r.down = 0.9; r.downDir = dirOf(h.side); r.dizzy = 1; h.dive = 0; h.down = 0.5; Sound.tackle();
        break;
      }
    }
  }
  // random holding on run plays
  if (pl.off.type === 'run' && !pl.holdRolled && pl.t > 0.7) {
    pl.holdRolled = true;
    if (chance(0.025)) { const ol = pick(G.O.slice(5)); throwFlag('HOLD', off, ol.x, ol.y, ol); }
  }
}

// ---------- penalty enforcement ----------
function enforcePenalty(res) {
  const f = G.flags[0], F = FOULS[f.type], off = G.poss, d = dirOf(off);
  const car = res.carrier, cs = car ? car.side : off;
  const turnover = cs !== off && res.type !== 'inc';
  const td = res.type === 'td' && cs === off;
  const resX = (res.type === 'inc' || turnover) ? G.los : (res.x != null ? res.x : G.los);
  const toGoal = d * (goalX(off) - G.los);
  let accept = true, newLos = G.los, autoFirst = false;
  if (F.def) {
    if (td) accept = false;
    else if (f.type === 'DPI') {
      let spot = f.x; if (d * (spot - G.los) < 5) spot = G.los + d * Math.min(5, toGoal / 2);
      if (d * (goalX(off) - spot) < 1) spot = goalX(off) - d * 1;
      newLos = spot; autoFirst = true; accept = turnover || d * (spot - resX) >= 0;
    } else if (f.type === 'RTP') {
      const base = (turnover || res.type === 'inc' || res.type === 'sack') ? G.los : resX;
      newLos = base + d * Math.min(15, d * (goalX(off) - base) / 2); autoFirst = true;
    } else if (f.type === 'OFFSIDE') {
      newLos = G.los + d * Math.min(5, toGoal / 2); accept = turnover || d * (resX - G.los) < 5;
    }
  } else { // offense fouled
    newLos = G.los - d * Math.min(10, d * (G.los - ownGoal(off)) / 2);
    accept = !turnover && (td || res.type === 'inc' || d * (resX - G.los) > -10);
  }
  G.flags = [];
  const who = `${G.teams[f.side].name}${f.num != null ? ' #' + f.num : ''}`;
  if (!accept) { G.flagNote = `FLAG: ${F.name}, DECLINED`; addPbp(`Penalty on ${who}: ${F.name.toLowerCase()}, declined.`); return false; }
  addPbp(`PENALTY on ${who}: ${F.name.toLowerCase()}. ${F.text.replace(/ • /g, ', ')}.`);
  G.los = clamp(newLos, 11, 109);
  if (autoFirst || d * (G.los - G.firstDownX) >= 0) { G.down = 1; setFirstDown(); }
  else if (!F.def) { /* same down, longer to go */ }
  G.next = null; G.runoff = 0; G.deadT = 2.4;
  showBanner(F.name, `${who} • ${F.text}`, '#ffe14d', 2.4);
  Sound.whistle();
  return true;
}

function delayOfGame() {
  const d = dirOf(G.poss);
  G.pendingRunoff = 0; // penalty stops the clock
  G.los = clamp(G.los - d * Math.min(5, d * (G.los - ownGoal(G.poss)) / 2), 11, 109);
  showBanner('DELAY OF GAME', `${G.teams[G.poss].name} • 5 yards • Replay the down`, '#ffe14d', 2.2);
  addPbp(`Delay of game on ${G.teams[G.poss].name}, 5 yards.`);
  Sound.whistle();
  const f = { kind: 'flag', ax: G.los - d * 10, ay: MID + 6, x: G.los, y: G.ballY, t: 0, T: 0.55, z: 0, vz: 0, life: 2.5, max: 2.5 };
  toPlayCall(); G.fx.push(f);
}

// screen drag vector -> where the ball lands (pull back further = throw further)
function aimTarget(qb, vx, vy) {
  const k = 3.3;
  return { x: clamp(qb.x + vx / PX * k, -2, 122), y: clamp(qb.y + vy / PX * k * 1.6, 0, FIELD_W) };
}
function eligible(r) {
  if (!r || r.slot < 1 || r.slot > 4) return false;
  if (r.role === 'route' || (r.slot === 1 && G.play.off.screen)) return true;
  return false;
}
function openness(r) {
  let m = 99;
  for (const d of G.D) if (!d.engaged && d.down <= 0) m = Math.min(m, dist(r, d));
  return m;
}
function humanCanThrow() {
  const b = G.ball, qb = G.O && G.O[0];
  return G.phase === 'live' && G.bstate === 'snap' && b.holder === qb && qb.isHuman && G.passPlay !== false && G.play.off.type === 'pass' &&
    dirOf(G.poss) * (qb.x - G.los) < 0.5 && !G.humanScramble;
}

// who the human is driving right now
function updateHuman() {
  for (const p of G.players) p.isHuman = false;
  G.humanPlayer = null;
  if (!G.ball || G.human < 0) return;
  if (G.versus) {
    const hs = [0, 1].map(s => withSide(s, humanFor));
    hs.forEach((h, s) => { if (h) { h.isHuman = true; h.ctl = s === G.p1 ? 0 : 1; } });
    G.hp = hs; G.humanPlayer = hs[G.human];
    return;
  }
  const h = humanFor();
  if (h) h.isHuman = true;
  G.humanPlayer = h;
}
function humanFor() {
  let h = null;
  const b = G.ball;
  if (G.poss === G.human) {
    if (b.holder && b.holder.side === G.human) h = b.holder;
    else if (b.flight && b.flight.intended && b.flight.intended.side === G.human && !b.flight.pitch) h = b.flight.intended;
    else if (b.holder && b.holder.side !== G.human) h = nearestTo(G.O.filter(p => p.side === G.human), b.holder) || G.humanDef;
    else h = G.O[b.flight && b.flight.pitch ? 1 : 0];
    if (b.holder && b.holder.side !== G.human) { // turnover: switch to a tackler
      if (!G.humanDef || G.humanDef.side !== G.human) G.humanDef = nearestTo(G.O, b.holder);
      h = G.humanDef;
    }
  } else {
    if (b.holder && b.holder.side === G.human) h = b.holder; // you picked it off!
    else h = G.humanDef;
  }
  return h;
}
// before the snap: cycle through every defender so you can pick a pass rusher
function presnapSwitch() {
  const order = [3, 4, 0, 1, 2, 5, 6, 7].map(i => G.D[i]);
  const i = order.indexOf(G.humanDef);
  G.humanDef = order[(i + 1) % order.length]; Sound.click(); updateHuman();
  G.snapTimer = Math.max(G.snapTimer, 0.6);
}
function nearestTo(list, t) { let best = null, bd = 1e9; for (const p of list) { const d = dist(p, t); if (d < bd && p.down <= 0) { bd = d; best = p; } } return best; }
function cycleHumanDef() {
  const b = G.ball; const target = b.holder || b;
  const pool = G.players.filter(p => p.side === G.human && p !== G.humanDef && !(b.holder === p));
  const n = nearestTo(pool, target.flight ? { x: target.flight.tx, y: target.flight.ty } : target);
  if (n) { G.humanDef = n; Sound.click(); }
}

// returns true if human input drove this player
function humanControl(p, dt) {
  const b = G.ball;
  const isCarrier = b.holder === p;
  if (Input.hit('KeyQ') && !isCarrier) { cycleHumanDef(); }
  if (G.mode === 'mobile') return mobileControl(p, dt, isCarrier);
  const ax = Input.axis();
  const sprint = Input.held('ShiftLeft') && p.stamina > 0.05;
  if (sprint && ax.m > 0.1) p.stamina = Math.max(0, p.stamina - dt * 0.32); else p.stamina = Math.min(1, p.stamina + dt * 0.18);
  p.sprinting = sprint && ax.m > 0.1;
  const mul = (sprint ? sprintBoost(p) : 1) * (p.spin > 0 ? 0.8 : 1) * 1.06 * (p.stamina < 0.2 ? 0.9 : 1); // you're a little faster than the AI
  if (isCarrier) {
    if (Input.hit('KeyE') && p.jukeCd <= 0 && G.bstate !== 'snap') doJuke(p, ax);
    if (Input.hit('KeyF') && p.spinCd <= 0 && G.bstate !== 'snap') doSpin(p);
    if (Input.hit('KeyR') && p.stiffCd <= 0) doStiff(p);
  }
  const chasing = b.holder ? b.holder.side !== p.side : p.side !== G.poss;
  if (!isCarrier && chasing && b.flight && !b.flight.pitch && Input.hit('Space')) { doJump(p); }
  else if (!isCarrier && chasing && Input.hit('Space') && p.dive <= 0) { doDive(p, ax); return true; }
  if (!isCarrier && p.engaged && Input.hit('KeyE')) doSwim(p);
  if (!isCarrier && chasing && Input.hit('KeyC')) doHitStick(p);
  if (p.hit > 0) return true;
  if (p.jump > 0 && b.flight && ax.m < 0.1) { steer(p, b.flight.tx, b.flight.ty, 1.08, 0.2); return true; }
  if (ax.m < 0.1 && isCarrier && G.humanScramble && p === G.O[0]) { aiRunner(p, dt); return true; }
  if (ax.m < 0.1) {
    if (!isCarrier && !(p === G.O[0] && G.bstate === 'snap')) { // idle defender / receiver: let AI help
      if (b.flight && b.flight.intended === p) { steer(p, b.flight.tx, b.flight.ty, 1); return true; }
      return false;
    }
    p.dvx = 0; p.dvy = 0; return true;
  }
  p.dvx = ax.x * p.spd * mul * ax.m; p.dvy = ax.y * p.spd * mul * ax.m;
  return true;
}

function mobileControl(p, dt, isCarrier) {
  const b = G.ball, P = Input.pointer;
  const qbHolding = p === G.O[0] && G.bstate === 'snap' && b.holder === p;
  if (qbHolding && Input.hit('KeyX')) qbTakeOff(p);
  if (qbHolding && !G.humanScramble) return false; // QB moves himself in the pocket; you just aim + throw
  const onD = p.side !== G.poss || (b.holder && b.holder.side !== p.side);
  if (!isCarrier && onD && b.flight && !b.flight.pitch && (Input.taps.length || Input.hit('Space'))) { doJump(p); Input.taps.length = 0; }
  if (!isCarrier && p.engaged && Input.hit('KeyE')) doSwim(p);
  if (!isCarrier && onD && Input.hit('KeyC')) doHitStick(p);
  if (p.hit > 0) return true;
  // taps = moves
  for (const c of Input.taps) {
    if (isCarrier) { if (p.jukeCd <= 0) doJuke(p, { x: 0, y: wy(c.y) < p.y ? -1 : 1, m: 1 }); }
    else if (p.side !== G.poss || (b.holder && b.holder.side !== p.side)) {
      const w = { x: wx(c.x), y: wy(c.y) };
      const mate = G.players.find(q => q.side === p.side && q !== p && Math.hypot(q.x - w.x, q.y - w.y) < 2.5);
      if (mate) { G.humanDef = mate; Sound.click(); return true; }
      const car = b.holder;
      if (car && dist(p, car) < 4.5 && p.dive <= 0) { doDive(p, { x: car.x - p.x, y: car.y - p.y, m: 1 }); return true; }
      cycleHumanDef();
    }
  }
  if (isCarrier) {
    if (Input.hit('KeyF') && p.spinCd <= 0) doSpin(p);
    if (Input.hit('KeyR') && p.stiffCd <= 0) doStiff(p);
    if (Input.hit('KeyE') && p.jukeCd <= 0) doJuke(p, null);
  } else if (Input.hit('Space') && p.dive <= 0) { const car = b.holder || b; doDive(p, { x: car.x - p.x, y: car.y - p.y, m: 1 }); return true; }
  const sprint = p.stamina > 0.05;
  const st = Input.stick;
  if (st.m > 0.15 && isFinite(st.x) && isFinite(st.y)) { // joystick
    if (sprint) p.stamina = Math.max(0, p.stamina - dt * 0.15);
    p.sprinting = st.m > 0.9 && sprint;
    const mul = (p.sprinting ? sprintBoost(p) : 1) * (p.spin > 0 ? 0.8 : 1) * 1.06;
    p.dvx = st.x * p.spd * mul; p.dvy = st.y * p.spd * mul;
    return true;
  }
  if (p.jump > 0 && b.flight) { steer(p, b.flight.tx, b.flight.ty, 1.08, 0.2); return true; }
  const held = P.down && !P.aiming && P.t > 0.12;
  if (held) {
    const tx = wx(P.x), ty = wy(P.y);
    if (sprint) p.stamina = Math.max(0, p.stamina - dt * 0.2);
    p.sprinting = sprint;
    steer(p, tx, ty, (sprint ? sprintBoost(p) : 1) * (p.spin > 0 ? 0.8 : 1) * 1.06, 0.4);
    return true;
  }
  p.stamina = Math.min(1, p.stamina + dt * 0.25);
  if (isCarrier) { aiRunner(p, dt); return true; } // auto-run forward, you steer by holding
  return false; // defenders: AI helps when you're not touching
}
function qbTakeOff(qb) {
  G.humanScramble = true; G.qbScramble = true; Sound.juke();
  addText(qb.x, qb.y, 'QB RUN!', '#7fd3ff', 22, 0.9);
  qb.vx += dirOf(qb.side) * 3;
}
// faster guys get a bigger burst: 99 SPD ≈ +18%, 80 ≈ +11%, 65 ≈ +6%
function sprintBoost(p) { return 1.02 + clamp((p.spdR || 80) - 50, 0, 50) * 0.0033; }
function doStiff(p) { p.stiff = 0.4; p.stiffCd = 1.4; Sound.tone(160, 0.12, 'sawtooth', 0.08); }
function doJuke(p, ax) {
  if (chance(Weather.slipChance())) { p.down = 0.55; p.downDir = p.face.dir; p.jukeCd = 1; addText(p.x, p.y, 'SLIPPED!', '#cfe3ff', 18, 0.8); Sound.boing(); return; }
  const sp = Math.hypot(p.vx, p.vy) || 1;
  let fx = p.vx / sp, fy = p.vy / sp;
  if (sp < 1) { fx = dirOf(p.side); fy = 0; }
  let side = (ax && Math.abs(-fy * ax.x + fx * ax.y) > 0.2) ? Math.sign(-fy * ax.x + fx * ax.y) : (p.lastJuke = -(p.lastJuke || 1));
  const px = -fy * side, py = fx * side;
  p.vx = px * p.spd * 1.15 + fx * p.spd * 0.35; p.vy = py * p.spd * 1.15 + fy * p.spd * 0.35;
  p.juke = 0.3; p.jukeCd = 1.0; Sound.juke(); addDust(p.x, p.y, 3);
  p.head.vx += side * 260;
}
function doJump(p) {
  if (p.jump > 0 || p.jumpCd > 0 || p.down > 0) return;
  p.jump = 0.55; p.jumpCd = 1.2; Sound.boing();
  addText(p.x, p.y, 'JUMP!', '#7fd3ff', 16, 0.6);
}
function doHitStick(p) {
  if (p.hitCd > 0 || p.down > 0) return;
  const car = G.ball.holder; if (!car || car.side === p.side) return;
  const dd = dist(p, car); if (dd > 3.5) { addText(p.x, p.y, 'TOO FAR', '#ccc', 13, 0.5); return; }
  p.hit = 0.28; p.hitCd = 1.6;
  const dx = car.x + car.vx * 0.15 - p.x, dy = car.y + car.vy * 0.15 - p.y, m = Math.hypot(dx, dy) || 1;
  p.vx = dx / m * p.spd * 1.7; p.vy = dy / m * p.spd * 1.7; p.dvx = p.vx; p.dvy = p.vy;
  Sound.tone(220, 0.15, 'sawtooth', 0.1, 200);
}
function doSwim(p) {
  if (p.swimCd > 0 || !p.engaged) return;
  p.swimCd = 1.2;
  const bl = p.engaged;
  if (chance(clamp(0.45 + (p.ovr - bl.ovr) / 90, 0.2, 0.8))) {
    unlink(bl, p); p.shedCd = 0.8; bl.stun = 0.7; bl.head.vx += 250;
    addText(p.x, p.y, 'SWIM MOVE!', '#ff8a8a', 18, 0.7); Sound.juke();
  } else addText(p.x, p.y, 'STUFFED', '#ccc', 14, 0.6);
}
function doSpin(p) { p.spin = 0.45; p.spinCd = 1.4; Sound.juke(); p.head.vx += 300; }
function doDive(p, ax) {
  const b = G.ball; const t = b.holder || b;
  let dx = ax.m > 0.1 ? ax.x : t.x - p.x, dy = ax.m > 0.1 ? ax.y : t.y - p.y;
  const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
  p.dive = 0.32; p.vx = dx * p.spd * 1.55; p.vy = dy * p.spd * 1.55; p.dvx = p.vx; p.dvy = p.vy; p.downDir = dx >= 0 ? 1 : -1;
  Sound.boing();
}

// ---------------- AI ----------------
function steer(p, tx, ty, mul = 1, arrive = 1.0) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 0.05) { p.dvx = p.dvy = 0; return; }
  const sp = p.spd * mul * Math.min(1, d / arrive);
  p.dvx = dx / d * sp; p.dvy = dy / d * sp;
}

function ai(p, dt) {
  const b = G.ball, d = dirOf(G.poss);
  const carrier = b.holder;
  // ---- after a catch / handoff / turnover: everyone either blocks or chases ----
  if (G.bstate === 'run' || (carrier && carrier.side !== G.poss)) {
    if (carrier === p) return aiRunner(p, dt);
    if (carrier && p.side === carrier.side) return aiEscort(p, carrier);
    // run fits: until he reads it, a back-seven defender fills his gap at the line instead of beelining to the ball
    if (carrier && !p.off && p.pos !== 'DL' && G.play.off.type === 'run' && G.play.t < readTime(p) + 0.15 && d * (carrier.x - G.los) < 0 && dist(p, carrier) > 2.2) {
      return steer(p, G.los + d * 1.2, lerp(p.y, carrier.y, 0.45), 0.85, 0.4);
    }
    if (carrier) return pursue(p, carrier);
  }
  if (b.loose) { steer(p, b.x, b.y, 1.05); return; }
  if (b.flight && b.flight.kick) return aiKickFlight(p);

  if (p.off && b.flight && b.flight.intended === p && !b.flight.pitch) { steer(p, b.flight.tx, b.flight.ty, 1, 0.25); return; }
  if (p.off) {
    switch (p.role) {
      case 'qb': return aiQBMove(p, dt);
      case 'route': return followRoute(p, dt);
      case 'runpath': return followRoute(p, dt);
      case 'passblock': return passBlock(p);
      case 'runblock': return runBlock(p);
      case 'screenblock': return G.play.t < 1.1 ? passBlock(p) : stalk(p, 10);
      case 'stalk': return (p.route && p.route.i < p.route.pts.length && G.play.t < 1.2) ? followRoute(p, dt) : stalk(p, 8);
      default: p.dvx = p.dvy = 0;
    }
    return;
  }
  // ---- defense before the ball is caught / handed off ----
  const qb = G.O[0];
  const a = p.assign;
  if (b.flight && !b.flight.pitch) {
    const f = b.flight, land = { x: f.tx, y: f.ty };
    const tgt = f.intended;
    const near = dist(p, land) < 15 || (a.type === 'man' && G.O[a.t] === tgt);
    if (near && a.type !== 'rush') {
      const ttl = f.T - f.t;
      const reach = p.spd * ttl;
      // sometimes a defender leaps for it
      if (!p.isHuman && !p.jumpTried && dist(p, land) < 2.2 && ttl < 0.4) { p.jumpTried = true; if (chance([0.04, 0.07, 0.1, 0.15][G.diff])) doJump(p); }
      if (dist(p, land) <= reach + 1.2) steer(p, land.x, land.y, 1.05, 0.3);
      else steer(p, lerp(tgt.x, land.x, 0.6), lerp(tgt.y, land.y, 0.6), 1.05);
      return;
    }
    if (a.type === 'rush') { steer(p, land.x, land.y, 0.6); return; }
  }
  if (b.flight && b.flight.pitch) return pursue(p, b.flight.intended);
  const holder = carrier || qb;
  switch (a.type) {
    case 'rush': steer(p, holder.x, holder.y, (p.pos === 'DL' ? 0.95 : 0.97) * (G.play.t < 0.45 ? 0.55 : 1) * (G.poss === G.human && !G.versus ? [0.88, 0.94, 1, 1.06][G.diff] : 1), 0.2); break;
    case 'spy': {
      if (G.qbScramble || d * (holder.x - G.los) > 0) return pursue(p, holder);
      steer(p, G.los + d * 5, lerp(p.y, holder.y, 0.6), 0.8); break;
    }
    case 'man': {
      const t = G.O[a.t];
      if (!eligible(t) && G.play.t > readTime(p)) { // target stayed in to block: go get the QB
        if (G.play.off.type === 'run') return pursue(p, carrier || G.O[1]);
        steer(p, G.los + d * 4, lerp(p.y, holder.y, 0.5), 0.8); break;
      }
      const lag = 0.07 + (99 - p.ovr) * 0.0025;
      const old = pastOf(t, lag);
      const tx = old.x + old.vx * lag * 0.8 + d * 0.9, ty = old.y + old.vy * lag * 0.8;
      steer(p, tx, ty, 1, 0.4);
      break;
    }
    case 'zone': {
      const zx = G.los + d * a.d, zy = zoneY(a.y);
      let threat = null, td = 9.5;
      for (const r of G.O) {
        if (!eligible(r)) continue;
        const dd = Math.hypot(r.x - zx, r.y - zy);
        if (dd < td) { td = dd; threat = r; }
      }
      if (threat) {
        const tx = clamp(threat.x + d * 1.5, Math.min(zx - 7, zx + 7), Math.max(zx - 7, zx + 7));
        const ty = clamp(threat.y, zy - 7, zy + 7);
        steer(p, tx, ty, 0.95, 0.5);
      } else steer(p, zx, lerp(zy, holder.y, 0.25), 0.8, 1.2);
      // read run
      if (G.play.off.type === 'run' && G.play.t > readTime(p)) return pursue(p, carrier || G.O[1]);
      break;
    }
  }
  if (G.qbScramble && dist(p, holder) < 9) pursue(p, holder);
}

// where a player was `ago` seconds back (for late reactions)
// how long a defender takes to diagnose a run (better players read it faster)
function readTime(p) { return 0.55 + clamp(92 - p.ovr, 0, 30) * 0.018 + (p.isHuman ? 0 : 0.1); }
function pastOf(p, ago) {
  const h = p.hist; if (!h || !h.length) return { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
  const want = G.play.t - ago;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= want) return h[i];
  return h[0];
}
function pursue(p, t) {
  if (!t) return;
  const dd = dist(p, t);
  // aim for the spot where we can cut him off (pursuit angle)
  const sp = p.spd * (G.play.off.type === 'run' ? 1.03 : 1.09), rx = t.x - p.x, ry = t.y - p.y;
  const a = t.vx * t.vx + t.vy * t.vy - sp * sp, bq = 2 * (rx * t.vx + ry * t.vy), c = rx * rx + ry * ry;
  let T = dd / sp * 0.5;
  const disc = bq * bq - 4 * a * c;
  if (Math.abs(a) > 1e-3 && disc >= 0) { const r1 = (-bq - Math.sqrt(disc)) / (2 * a), r2 = (-bq + Math.sqrt(disc)) / (2 * a); const r = [r1, r2].filter(v => v > 0).sort((x, y) => x - y)[0]; if (r != null) T = r; }
  T = Math.min(T, 1.6);
  steer(p, t.x + t.vx * T, t.y + t.vy * T, G.play.off.type === 'run' ? 1.03 : 1.09, 0.1);
  // AI dive at the ball carrier
  if (!p.isHuman && dd < 1.7 && dd > 0.85 && p.dive <= 0 && t === G.ball.holder && chance(0.035)) {
    doDive(p, { x: t.x + t.vx * 0.15 - p.x, y: t.y + t.vy * 0.15 - p.y, m: 1 });
  }
}

function aiQBMove(p, dt) {
  const d = dirOf(G.poss), pl = G.play;
  if (G.ball.holder !== p) { // handed it off / threw it: drift
    steer(p, p.x + d * 2, p.y, 0.4); return;
  }
  if (pl.off.qbRun && pl.t > 0.35) { G.qbScramble = true; return aiRunner(p, dt); }
  if (G.qbScramble) return aiRunner(p, dt);
  if (pl.off.type === 'run') {
    if (pl.off.jet && !G.handedOff) { const c = G.O[pl.off.carrier]; steer(p, c.x - d * 0.6, c.y - Math.sign(c.y - p.y) * 0.9, 0.9, 0.3); return; } // meet the jet guy
    steer(p, G.los - d * 4.5, G.ballY, 0.4); return;
  }
  const depth = pl.off.fake ? 6.5 : 5.8;
  // re-think where to stand a few times a second (not every frame = no twitching)
  p.pocketT = (p.pocketT || 0) - dt;
  if (!p.pocketTarget || p.pocketT <= 0) {
    p.pocketT = 0.35;
    let tx = G.los - d * depth, ty = p.pocketTarget ? p.pocketTarget.y : G.ballY;
    let near = null, nd = 3.5;
    for (const df of G.D) { if (df.engaged || df.down > 0) continue; const dd = dist(p, df); if (dd < nd) { nd = dd; near = df; } }
    if (near && pl.t > 0.6) { ty = p.y + Math.sign(p.y - near.y || 1) * 2.5; tx = Math.min(p.x, tx) * (d > 0 ? 1 : 0) + Math.max(p.x, tx) * (d > 0 ? 0 : 1) - d * 0.4; }
    p.pocketTarget = { x: tx, y: clamp(ty, 4, FIELD_W - 4) };
  }
  steer(p, p.pocketTarget.x, p.pocketTarget.y, pl.t < 0.8 ? 0.7 : 0.45, 0.8);
}

function cpuQB(dt) {
  const pl = G.play, qb = G.O[0];
  if (pl.off.type === 'run' || G.qbScramble) return;
  G.qbThink -= dt; if (G.qbThink > 0) return; G.qbThink = 0.15;
  const minT = (pl.off.fake ? 1.35 : pl.off.screen || pl.off.quick ? 0.6 : 1.0) + [0.15, 0, -0.1, -0.2][G.diff];
  if (pl.t < minT) return;
  const d = dirOf(G.poss);
  let best = null, bs = -1e9;
  for (const s of [1, 2, 3, 4]) {
    const r = G.O[s]; if (!eligible(r)) continue;
    const op = Math.min(4.5, openness(r));
    const down = d * (r.x - G.los);
    let sc = op + clamp(down, -3, 35) * 0.13 + (r.route && r.route.i >= r.route.pts.length && r.route.end === 'sit' ? 0.3 : 0);
    if (s === 1 && !pl.off.screen) sc -= 1.4 - Math.min(1, (pl.t - minT) * 0.4); // check-down only when nothing else is there
    if (pl.off.screen && s === 1) sc += 3;
    if (op < 1.2) sc -= 1.5; // don't throw into a defender
    sc += [-0.6, 0, 0.3, 0.6][G.diff] * (op > 2 ? 1 : 0);
    if (down < Math.abs(G.firstDownX - G.los) && G.down >= 3) sc -= 0.8;
    sc += rand(-0.3, 0.3);
    if (sc > bs) { bs = sc; best = r; }
  }
  let pressure = 99; for (const df of G.D) if (!df.engaged && df.down <= 0) pressure = Math.min(pressure, dist(qb, df));
  const need = 4.6 - (pl.t - minT) * 1.2;
  // hot read: a free rusher is coming, so take what's there
  if (best && pressure < 3.2 && bs > 0.6 + (pressure < 1.8 ? -0.6 : 0) && chance(0.5)) { throwTo(qb, best); return; }
  if (best && (bs > need || (pressure < 1.6 && bs > 1.0 && chance(0.6)) || pl.t > 3.8)) { throwTo(qb, best); return; }
  // nothing open and about to get hit: smart QBs throw it away instead of taking the sack
  if (pressure < 1.5 && pl.t > 0.9 && chance(0.25 + (qb.ovr - 70) / 100)) { throwAway(qb); return; }
  if (pressure < 1.5 && chance(0.12 + (qb.spdR > 86 ? 0.2 : 0))) G.qbScramble = true;
}
// launch it out of bounds (or into the dirt) so nobody can catch it
function throwAway(qb) {
  const d = dirOf(G.poss), side = qb.y < MID ? -3 : FIELD_W + 3;
  const r = G.O.filter(eligible).sort((a, b) => Math.abs(a.y - side) - Math.abs(b.y - side))[0];
  if (!r) return;
  addText(qb.x, qb.y - 2, 'THROWN AWAY', '#cfe3ff', 14, 0.9);
  G.thrownAway = true;
  throwTo(qb, r, false, { x: qb.x + d * 8, y: side }, 'normal');
}

function followRoute(p, dt) {
  const r = p.route, d = dirOf(G.poss);
  if (!r) { p.dvx = p.dvy = 0; return; }
  // deep in the end zone: don't run out the back — shuffle side to side to get open
  if (p.role === 'route' && G.ball.holder !== p && d * (p.x - (goalX(G.poss) + d * 6)) > 0) return endZoneDrill(p, d);
  if (p.role === 'runpath' && G.ball.holder !== p && G.handedOff) return stalk(p, 6); // after the fake
  if (r.i < r.pts.length) {
    const t = r.pts[r.i];
    if (Math.hypot(t.x - p.x, t.y - p.y) < 0.8) r.i++;
    else { steer(p, t.x, t.y, p.role === 'runpath' ? 1 : 0.97, 0.15); return; }
  }
  if (r.i >= r.pts.length) {
    if (r.end === 'go') {
      const a = r.pts[r.pts.length - 2] || { x: p.hx, y: p.hy }, z = r.pts[r.pts.length - 1];
      let vx = z.x - a.x, vy = z.y - a.y; const m = Math.hypot(vx, vy) || 1;
      vx /= m; vy /= m;
      if (p.y < 3 && vy < 0 || p.y > FIELD_W - 3 && vy > 0) { vy = 0; vx = d; }
      steer(p, p.x + vx * 10, p.y + vy * 10, 0.97);
    } else if (r.end === 'sit') {
      // settle in the open
      let near = null, nd = 3;
      for (const df of G.D) { const dd = dist(p, df); if (dd < nd) { nd = dd; near = df; } }
      const last = r.pts[r.pts.length - 1];
      if (near) steer(p, last.x + (p.x - near.x) * 0.4, last.y + (p.y - near.y) * 0.4, 0.5);
      else steer(p, last.x, last.y, 0.4);
    } else if (r.end === 'block') { p.role = p.slot === 1 ? 'passblock' : 'stalk'; stalk(p, 8); }
    if (p.role === 'runpath' && G.play.off.fake) { p.role = 'passblock'; }
  }
}

function endZoneDrill(p, d) {
  const back = goalX(G.poss) + d * 10;
  if (!p.drill) p.drill = { dir: p.y < MID ? 1 : -1, y0: p.y, t: 0 };
  const dr = p.drill;
  dr.t += 1 / 60;
  // slide away from the closest defender, otherwise go back and forth
  let near = null, nd = 3;
  for (const df of G.D) { if (df.down > 0) continue; const dd = dist(p, df); if (dd < nd) { nd = dd; near = df; } }
  if (near && dr.t > 0.3 && Math.sign(near.y - p.y) === dr.dir) { dr.dir *= -1; dr.t = 0; }
  if (Math.abs(p.y - dr.y0) > 5.5 || p.y < 3 || p.y > FIELD_W - 3) { if (dr.t > 0.3) { dr.dir = p.y < 3 ? 1 : p.y > FIELD_W - 3 ? -1 : -dr.dir; dr.t = 0; } }
  const tx = back - d * (3.5 + Math.sin(G.play.t * 2) * 0.8);
  steer(p, tx, p.y + dr.dir * 4, 0.72, 0.5);
}
function passBlock(p) {
  const qb = G.O[0], d = dirOf(G.poss);
  const free = df => df && df.down <= 0 && df.shedCd <= 0 && (!df.engaged || df.engaged === p) && (df.assign.type === 'rush' || G.qbScramble);
  let threat = free(p.blockTarget) ? p.blockTarget : null;
  if (!threat) {
    let td = 7;
    for (const df of G.D) {
      if (!free(df) || G.players.some(o => o !== p && o.blockTarget === df && o.stun <= 0)) continue;
      const dd = dist(p, df); if (dd < td) { td = dd; threat = df; }
    }
    p.blockTarget = threat;
  }
  if (threat) { const t = 0.65; steer(p, lerp(qb.x, threat.x, t), lerp(qb.y, threat.y, t), 0.95, 0.3); }
  else steer(p, p.hx - d * Math.min(2, G.play.t * 1.5), p.hy, 0.5, 0.6);
}
function runBlock(p) {
  const d = dirOf(G.poss);
  let t = null, td = p.crack ? 20 : 7;
  for (const df of G.D) {
    if (df.engaged || df.down > 0) continue; const ahead = d * (df.x - p.x); if (ahead < -1) continue;
    const dd = dist(p, df) + (p.crack && df.pos !== 'LB' ? 6 : 0) + (p.crack && p.crackY != null ? Math.abs(df.y - p.crackY) * 0.8 : 0); // crack blocker hunts a linebacker
    if (dd < td) { td = dd; t = df; }
  }
  if (t) steer(p, t.x, t.y, p.crack ? 1.05 : 1, 0.1); else steer(p, p.x + d * 3, p.y, 0.8);
}
function stalk(p, range) {
  const b = G.ball, car = b.holder || G.O[1];
  let t = null, td = range;
  for (const df of G.D) { if (df.engaged || df.down > 0) continue; const dd = dist(p, df); if (dd < td) { td = dd; t = df; } }
  if (t) steer(p, lerp(t.x, car.x, 0.2), lerp(t.y, car.y, 0.2), 0.95, 0.2);
  else steer(p, p.x + dirOf(G.poss) * 2, p.y, 0.4);
}

function aiEscort(p, car) {
  const d = dirOf(car.side);
  const foes = G.players.filter(q => q.side !== car.side);
  let t = null, td = 10;
  for (const df of foes) {
    if (df.engaged || df.down > 0) continue;
    if (d * (df.x - car.x) < -1.5) continue;
    const dd = dist(df, car); if (dd < td && dist(p, df) < 12) { td = dd; t = df; }
  }
  if (t) steer(p, lerp(t.x, car.x, 0.25), lerp(t.y, car.y, 0.25), 1, 0.2);
  else steer(p, car.x + d * 5, lerp(p.y, car.y, 0.3), 0.9);
}

function aiRunner(p, dt) {
  const d = dirOf(p.side);
  // follow a designed run path first
  if (p.role === 'runpath' && p.route && p.route.i < p.route.pts.length && d * (p.x - G.los) < 1) {
    const t = p.route.pts[p.route.i];
    if (Math.hypot(t.x - p.x, t.y - p.y) < 1) p.route.i++;
    steer(p, t.x, t.y, p.route.i >= 1 ? 1.06 : 1, 0.1); return;
  }
  const foes = G.players.filter(q => q.side !== p.side && q.down <= 0 && !q.engaged);
  let best = 0, bs = -1e9;
  for (let a = -80; a <= 80; a += 10) {
    const r = a * Math.PI / 180;
    const vx = Math.cos(r) * d, vy = Math.sin(r);
    // north-south runner: get upfield, read the defenders in FRONT (guys chasing from behind barely matter)
    let sc = Math.cos(r) * 3.6 - Math.abs(r - (p.runAng || 0)) * 0.35;
    for (const L of [2.2, 5]) {
      const px = p.x + vx * L, py = p.y + vy * L;
      for (const f of foes) {
        const behind = d * (f.x - p.x) < -0.8;
        const dd = Math.hypot(f.x - px, f.y - py);
        if (dd < 6) sc -= (behind ? 0.5 : 1.6) / (dd + 0.5) * (L > 3 ? 0.6 : 1);
      }
      if (py < 1.5 || py > FIELD_W - 1.5) sc -= 5;
    }
    if (sc > bs) { bs = sc; best = r; }
  }
  p.runAng = best;
  const vx = Math.cos(best) * d, vy = Math.sin(best);
  let open = 99; for (const f of foes) open = Math.min(open, dist(f, p));
  p.sprinting = open > 2.5 || (open > 1.5 && d * (p.x - G.los) > 0);
  const boost = p.sprinting ? 1 + (sprintBoost(p) - 1) * 0.7 : 1;
  p.dvx = vx * p.spd * boost; p.dvy = vy * p.spd * boost;
  let nd = 99; for (const f of foes) nd = Math.min(nd, dist(f, p));
  if (nd < 1.9 && nd > 0.9 && p.jukeCd <= 0 && chance(0.022 + (p.ovr - 70) * 0.001)) {
    if (chance(0.7)) doJuke(p, null); else doSpin(p);
  }
}

// ---------------- blocking ----------------
function resolveBlocks(dt) {
  const b = G.ball;
  const carrierSide = b.holder ? b.holder.side : G.poss;
  // new engagements: blockers are the ball side's players (not the carrier, not the QB holding it)
  for (const bl of G.players) {
    if (bl.side !== carrierSide || bl === b.holder || bl.engaged || bl.stun > 0 || bl.down > 0 || bl.isHuman) continue;
    if (bl.slot === 0 && bl.off) continue;
    if (bl.off && (bl.role === 'route') && G.bstate !== 'run') continue;
    for (const df of G.players) {
      if (df.side === carrierSide || df.engaged || df.down > 0 || df.shedCd > 0 || df.dive > 0 || df === b.holder) continue;
      if (dist(bl, df) < 1.15) { bl.engaged = df; df.engaged = bl; df.shed = 0; Sound.tone(110, 0.05, 'square', 0.04); break; }
    }
  }
  // engaged pairs fight
  for (const bl of G.players) {
    const df = bl.engaged;
    if (!df || df.engaged !== bl || bl.side !== carrierSide) continue;
    if (df.down > 0 || bl.down > 0 || dist(bl, df) > 2.5 || df === b.holder || bl === b.holder) { unlink(bl, df); continue; }
    const big = bl.pos === 'OL';
    let rate = (big ? 0.42 : 0.85) * Math.pow(df.ovr / bl.ovr, 2.2) * rand(0.4, 1.4);
    if (bl.role === 'screenblock') rate *= 1.8;
    if (df.isHuman && withSide(df.side, () => Input.axis().m) > 0.3) rate *= 1.7;
    if (xfOn(df, 'unstoppable')) rate *= 2.6;
    if (G.bstate === 'run') rate *= big ? 1.4 : 2.8;
    df.shed += rate * dt;
    // the defender pushes slowly toward where he wants to go
    const push = clamp(df.ovr / bl.ovr, 0.6, 1.4) * 0.22;
    df.dvx *= push; df.dvy *= push;
    if (G.play.off.type === 'run' && bl.role === 'runblock') { df.dvx += dirOf(G.poss) * 0.9 * (bl.ovr / df.ovr); }
    const nx = df.x - (df.dvx === 0 && df.dvy === 0 ? dirOf(carrierSide) * 0.95 : (df.dvx / (Math.hypot(df.dvx, df.dvy) || 1)) * 0.95);
    const ny = df.y - (df.dvx === 0 && df.dvy === 0 ? 0 : (df.dvy / (Math.hypot(df.dvx, df.dvy) || 1)) * 0.95);
    bl.dvx = (nx - bl.x) * 8 + df.dvx; bl.dvy = (ny - bl.y) * 8 + df.dvy;
    if (df.shed >= 1) {
      unlink(bl, df); df.shedCd = 1.1; bl.stun = 0.45;
      df.vx += (df.y > bl.y ? 0 : 0); if (df.isHuman) addText(df.x, df.y, 'SHED!', '#ff8a8a', 13, 0.6);
      bl.head.vx += 200;
    }
  }
}
function unlink(a, b) { if (a) a.engaged = null; if (b) b.engaged = null; }

// ---------------- movement physics ----------------
function applyMove(p, dt) {
  // safety net: a bad input value must never turn a player into NaN (that breaks the spot, the camera and every play after)
  if (!isFinite(p.dvx) || !isFinite(p.dvy)) { p.dvx = 0; p.dvy = 0; }
  if (!isFinite(p.vx) || !isFinite(p.vy)) { p.vx = 0; p.vy = 0; }
  if (!isFinite(p.x) || !isFinite(p.y)) { p.x = isFinite(p.lx) ? p.lx : (G.los != null ? G.los : 60); p.y = isFinite(p.ly) ? p.ly : MID; }
  p.lx = p.x; p.ly = p.y;
  if (p.down > 0) {
    p.down -= dt; p.vx *= 0.88; p.vy *= 0.88; p.x += p.vx * dt; p.y += p.vy * dt;
    headPhysics(p, 0, 0, dt); return;
  }
  let ax, ay;
  if (p.dive > 0) {
    p.dive -= dt; ax = 0; ay = 0;
    if (p.dive <= 0) { p.down = 0.7; p.downDir = p.vx >= 0 ? 1 : -1; addDust(p.x, p.y, 3); }
  } else {
    ax = p.dvx - p.vx; ay = p.dvy - p.vy;
    const m = Math.hypot(ax, ay), maxA = p.acc * dt * (p.juke > 0 ? 0.25 : 1);
    if (m > maxA) { ax *= maxA / m; ay *= maxA / m; }
    p.vx += ax; p.vy += ay;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p !== (G.ball && G.ball.holder)) { p.y = clamp(p.y, -2, FIELD_W + 2); p.x = clamp(p.x, -3, 123); }
  p.speedNow = Math.hypot(p.vx, p.vy);
  p.anim += Math.min(p.speedNow, 12) * dt * 1.45;
  if (Math.abs(p.vx) > 1.6 || (Math.abs(p.vx) > 0.6 && Math.abs(p.vx) > Math.abs(p.vy))) p.face.dir = Math.sign(p.vx);
  else if (G.phase !== 'live') p.face.dir = dirOf(p.side);
  headPhysics(p, ax / Math.max(dt, 1e-3), ay / Math.max(dt, 1e-3), dt);
}
function headPhysics(p, ax, ay, dt) {
  const h = p.head;
  const k = 170, c = 7.5;
  h.vx += (-k * h.ox - c * h.vx - clamp(ax, -60, 60) * 2.4) * dt;
  h.vy += (-k * h.oy - c * h.vy - clamp(ay, -60, 60) * 0.8) * dt + Math.sin(p.anim * 2) * Math.min(1, p.speedNow / 5) * 32 * dt;
  h.ox = clamp(h.ox + h.vx * dt, -11, 11); h.oy = clamp(h.oy + h.vy * dt, -7, 7);
  h.rot = h.ox * 0.045;
}
function separate() {
  const P = G.players;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    if (a.down > 0 || b.down > 0 || a.engaged === b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 0.75 && d > 0.001) {
      const push = (0.75 - d) * 0.3, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }
}

// ---------------- passing ----------------
// drag-back throw: ball goes where you aimed, the closest receiver goes for it
function receiverFor(qb, tx, ty) {
  let best = null, bd = 7;
  for (const r of G.O) {
    if (!eligible(r)) continue;
    const T = Math.hypot(tx - qb.x, ty - qb.y) / (24 * GAME_SPEED);
    const d = Math.hypot(r.x + r.vx * T - tx, r.y + r.vy * T - ty);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
function throwAt(qb, tx, ty, style) {
  const r = receiverFor(qb, tx, ty) || nearestTo(G.O.filter(eligible), { x: tx, y: ty });
  if (!r) return;
  throwTo(qb, r, false, { x: tx, y: clamp(ty, -0.5, FIELD_W + 0.5) }, style);
}
// QB arm: throw power sets how far and how fast, accuracy sets how close it lands to where you wanted
function qbArm(qb) {
  const thp = qb.thp || qb.ovr, acc = qb.tha || qb.ovr; // thp = throw power, tha = throw accuracy (created players have their own)
  return { thp, acc, range: 18 + thp * 0.52, accF: Math.pow(clamp((100 - acc) / 30, 0, 4), 1.3) };
}
function throwTo(qb, r, pitch = false, aimed = null, style = 'normal', lead = null) {
  const b = G.ball;
  const arm = qbArm(qb);
  const sMul = style === 'bullet' ? 1.3 : style === 'lob' ? 0.72 : 1;
  const spd = (pitch ? 13 : Math.max(11, 19 + (arm.thp - 70) * 0.16)) * GAME_SPEED * (pitch ? 1 : sMul);
  let tx = r.x, ty = r.y, T = 0.3;
  const sitting = r.route && r.route.end === 'sit' && r.route.i >= r.route.pts.length;
  if (aimed) { tx = aimed.x; ty = aimed.y; T = Math.max(0.3, Math.hypot(tx - qb.x, ty - qb.y) / spd); }
  else for (let k = 0; k < 4; k++) {
    T = Math.max(pitch ? 0.3 : 0.35, Math.hypot(tx - qb.x, ty - qb.y) / spd);
    if (sitting) break;
    tx = r.x + r.vx * T; ty = r.y + r.vy * T;
  }
  if (lead && lead.m > 0.1 && !pitch) { tx += lead.x * 2.6; ty += lead.y * 2.6; } // lead him away from the defender
  let len = Math.hypot(tx - qb.x, ty - qb.y);
  let duck = false;
  if (!pitch) {
    // past his range the ball dies short of the spot
    const reach = arm.range * (style === 'lob' ? 0.92 : style === 'bullet' ? 0.85 : 1) * (G.weather === 'rain' || G.weather === 'snow' ? 0.93 : 1);
    if (len > reach) {
      const k = reach * rand(0.9, 1) / len; tx = qb.x + (tx - qb.x) * k; ty = qb.y + (ty - qb.y) * k;
      len = Math.hypot(tx - qb.x, ty - qb.y); duck = true;
      addText(qb.x, qb.y - 2, 'NOT ENOUGH ARM', '#ff8a8a', 15, 0.9);
    }
    let pressure = false; for (const df of G.D) if (!df.engaged && dist(df, qb) < 2.4) pressure = true;
    let err = (0.4 + arm.accF) * (0.35 + len / 22);
    if (len > reach * 0.75) err *= 1 + (len / reach - 0.75) * 2; // straining for distance
    if (pressure) err += 0.6 + arm.accF * 0.45;
    if (qb.speedNow > 4) err += (0.3 + arm.accF * 0.3) * Math.min(1, qb.speedNow / 8);
    if (aimed) err *= lerp(0.45, 0.85, clamp(arm.accF / 2.5, 0, 1)); // you aimed it, but a bad QB still sprays it
    if (style === 'bullet') err *= 1.15; else if (style === 'lob') err *= 0.9;
    if (qb.xf && qb.xf.on && qb.xf.kind === 'dimes') err *= 0.35;
    if (G.weather === 'rain' || G.weather === 'snow') err *= 1.15;
    if (arm.thp < 62 || err > 3.5) duck = true;
    if (style !== 'normal') addText(qb.x, qb.y, style === 'bullet' ? 'BULLET!' : 'LOB!', '#7fd3ff', 15, 0.6);
    const a = rand(0, Math.PI * 2), m = Math.abs(rand(-1, 1) + rand(-1, 1)) / 2 * err * 2;
    tx += Math.cos(a) * m; ty += Math.sin(a) * m;
    stat(qb).att++;
    Sound.throw();
    qb.mouth = 'O'; qb.mouthT = 0.5; qb.throwAnim = 0.3; G.throwT = G.play.t;
  } else Sound.tone(400, 0.1, 'triangle', 0.08, 200);
  ty = clamp(ty, -0.5, FIELD_W + 0.5);
  b.holder = null;
  const pk = pitch ? 0.4 : (0.6 + len * 0.1) * (style === 'bullet' ? 0.45 : style === 'lob' ? 1.9 : 1) + (style === 'lob' ? 1.5 : 0);
  b.flight = { sx: qb.x, sy: qb.y, tx, ty, t: 0, T: Math.max(T, len / spd), peak: pk, intended: r, pitch, passer: qb, style, duck };
  G.bstate = 'air'; G.intended = r;
  for (const p of G.players) { p.laneChecked = false; p.jumpTried = false; }
  G.passPlay = !pitch;
  G.showTarget = true;
  if (!pitch && isHumanSide(r.side)) setHD(r.side, r);
}

function updateFlight(dt) {
  const b = G.ball, f = b.flight;
  f.t += dt;
  const u = Math.min(1, f.t / f.T);
  b.x = lerp(f.sx, f.tx, u); b.y = lerp(f.sy, f.ty, u);
  b.z = 1.7 + f.peak * 4 * u * (1 - u) - u * 0.6;
  b.spin = (b.spin || 0) + dt * 30;
  // the ball can be picked off on the way: a defender in the passing lane (jumping = higher reach)
  if (!f.pitch && !f.kick && !G.thrownAway && u > 0.12 && u < 0.88) {
    for (const p of G.players) {
      if (p.side === f.passer.side || p.down > 0 || p.engaged || p.laneChecked) continue;
      const jumping = p.jump > 0, reach = jumping ? 1.4 : 0.5, high = jumping ? 3.6 : 2.0;
      if (b.z > high || Math.hypot(p.x - b.x, p.y - b.y) > reach) continue;
      p.laneChecked = true;
      const pInt = clamp((jumping ? (p.isHuman ? 0.7 : 0.4) : 0.45) + (p.ovr - 80) / 200 + (p.isHuman ? 0.05 : 0) + (xfOn(p, 'lurker') ? 0.1 : 0), 0.25, 0.9);
      b.flight = null; G.showTarget = false;
      if (chance(pInt)) { addText(p.x, p.y, jumping ? 'SKY HIGH!' : 'PICKED!', '#7fd3ff', 22, 0.9); return intercept(p); }
      return incomplete(p, 'TIPPED!');
    }
  }
  if (u >= 1) { if (f.kick) { b.flight = null; return catchKick(f); } resolveCatch(); }
}

function resolveCatch() {
  const b = G.ball, f = b.flight, land = { x: f.tx, y: f.ty };
  b.flight = null; G.showTarget = false;
  if (f.pitch) { b.holder = f.intended; G.bstate = 'run'; G.credit = { p: f.intended, kind: 'rush' }; Sound.catch(); return; }
  const offSide = f.passer.side;
  if (G.thrownAway) { G.thrownAway = false; return incomplete(null, 'THROWN AWAY'); }
  let rcv = null, rd = 99, def = null, dd = 99;
  for (const p of G.players) {
    if (p.down > 0 || p.engaged) continue;
    const d = dist(p, land);
    if (p.side === offSide) { if (p.slot >= 1 && p.slot <= 4 && d < rd) { rd = d; rcv = p; } }
    else if (d < dd) { dd = d; def = p; }
  }
  // a defender who jumped the route gets first crack at it
  const jumper = G.players.find(p => p.side !== offSide && p.jump > 0 && p.down <= 0 && dist(p, land) < 2.0);
  if (jumper) {
    const jd = dist(jumper, land);
    const pInt = clamp((jumper.isHuman ? 0.62 : 0.4) + (jumper.ovr - 75) / 90 - (rd < jd ? 0.25 : 0) - jd * 0.12, 0.1, 0.85);
    if (chance(pInt)) return intercept(jumper);
    if (chance(0.6)) return incomplete(jumper, 'SWATTED!');
  }
  const humanDefBonus = (def && def.isHuman ? 0.15 : 0) + (xfOn(def, 'lurker') ? 0.2 : 0);
  const R = 1.45;
  const hands = xfOn(rcv, 'hands') && rd < 1.6; // a "Double Me" guy usually wins the 50-50 ball
  if (def && dd < 0.5 && dd < rd - 0.3 && !(hands && chance(0.7))) { // ball hits the defender right in the body: 7 out of 10 get picked
    if (chance(def.isHuman ? 0.55 : 0.4)) return intercept(def);
    return incomplete(def, 'BROKEN UP!');
  }
  if (def && dd < 1.25 && dd < rd - 0.25 && !(hands && chance(0.7))) { // defender has inside position
    const pInt = clamp(0.12 + (def.ovr - 75) / 140 + humanDefBonus + (G.diff === 3 && !def.isHuman ? 0.08 : 0) - (rd < 1 ? 0.08 : 0), 0.05, 0.6);
    if (chance(pInt)) return intercept(def);
    return incomplete(def, 'BROKEN UP!');
  }
  if (rcv && rd < R && def && dd < 1.0 && chance(0.03)) { throwFlag('DPI', def.side, land.x, land.y, def); return incomplete(def, 'INTERFERENCE!'); }
  if (rcv && rd < R) {
    let pc = 0.93 + (rcv.ovr - 78) / 160 - (rd > 0.9 ? 0.08 : 0) - Weather.catchPenalty();
    if (hands) pc += 0.15;
    if (def && dd < 1.4) { pc -= (hands ? 0.06 : 0.2) - (rcv.ovr - def.ovr) / 150; if (chance(0.03 + humanDefBonus * 0.5)) return intercept(def); }
    if (chance(clamp(pc, 0.25, 0.97))) {
      b.holder = rcv; G.bstate = 'run'; Sound.catch(); G.catchX = rcv.x;
      rcv.mouth = 'O'; rcv.mouthT = 0.4;
      stat(f.passer).comp++; G.credit = { p: rcv, kind: 'rec', passer: f.passer };
      addText(rcv.x, rcv.y, pick(['CAUGHT!', 'GOT IT!', 'NICE GRAB!']), '#9cff9c', 15, 0.8);
      if (isHumanSide(rcv.side)) setHD(rcv.side, rcv);
      return;
    }
    return incomplete(rcv, 'DROPPED!');
  }
  if (def && dd < 1.0) return chance(0.1) ? intercept(def) : incomplete(def, 'BROKEN UP!');
  incomplete(null, 'INCOMPLETE');
}

function intercept(def) {
  const b = G.ball;
  b.holder = def; G.bstate = 'run'; Sound.bad();
  stat(def).int++; G.tstats[G.poss].to++; G.intBy = def;
  showBanner('INTERCEPTED!', def.name, '#ff5050', 1.6);
  def.mouth = 'O'; def.mouthT = 0.6;
  G.credit = null; G.crowdHype = 1;
  if (G.versus) { setHD(def.side, def); setHD(1 - def.side, nearestTo(G.players.filter(p => p.side !== def.side), def)); }
  else if (def.side === G.human) G.humanDef = def;
  else G.humanDef = nearestTo(G.players.filter(p => p.side === G.human), def);
}
function incomplete(who, text) {
  const b = G.ball;
  b.loose = null; b.dead = { vx: rand(-3, 3), vy: rand(-2, 2) }; b.z = 1;
  if (who) addText(who.x, who.y, text, '#fff', 16, 1);
  if (who && who.side !== G.poss) G.breakup = who;
  endPlay({ type: 'inc', text });
}

// ---------------- tackles / fumbles / bounds ----------------
function checkTackles() {
  const b = G.ball, car = b.holder;
  if (!car) return;
  let hitters = 0;
  for (const df of G.players) {
    if (df.side === car.side || df.down > 0 || df.engaged || df.stun > 0 || df.tackleCd > 0) continue;
    const reach = 0.95 + (df.dive > 0 ? 0.8 : 0) + (df.hit > 0 ? 0.45 : 0);
    if (dist(df, car) > reach) continue;
    hitters++;
    df.tackleCd = 0.5;
    let p = 0.79 + (df.ovr - car.ovr) / 110;
    if (car.juke > 0) p -= 0.42;
    if (car.spin > 0) p -= 0.48;
    const front = dirOf(car.side) * (df.x - car.x) > -0.3;
    if (car.stiff > 0 && front) p -= 0.38;
    if (df.dive > 0) p += 0.15;
    if (df.hit > 0) p = 0.5 + (df.ovr - car.ovr) / 100 - (car.juke > 0 ? 0.3 : 0);
    if (car.pos === 'QB' && G.bstate === 'snap') p += 0.12;
    if (car.pos === 'OL' || car.pos === 'DL') p += 0.2;
    if (car.side === G.human && !G.versus) p += [-0.08, 0, 0.06, 0.13][G.diff];
    if (xfOn(car, 'freight')) p -= 0.25;
    if (xfOn(df, 'unstoppable')) p += 0.1;
    p = clamp(p, 0.1, 0.94);
    if (chance(p)) return tackle(car, df, hitters);
    if (df.hit > 0) { df.hit = 0; df.down = 1.1; df.downDir = car.x > df.x ? 1 : -1; addText(df.x, df.y, 'WHIFF!', '#ccc', 18, 0.8); continue; }
    // broken tackle
    df.down = 0.75; df.downDir = car.x > df.x ? 1 : -1; df.vx *= 0.3; df.vy *= 0.3; df.dive = 0;
    car.vx *= 0.55; car.vy *= 0.55;
    if (car.stiff > 0 && front) { df.down = 1.1; df.vx = dirOf(car.side) * 5; df.dizzy = 1; }
    addText(car.x, car.y, car.stiff > 0 && front ? 'STIFF ARM!' : car.juke > 0 ? 'JUKED!' : car.spin > 0 ? 'SPUN AWAY!' : 'BROKE IT!', '#ffe14d', 22, 0.9);
    df.head.vx += 300; Sound.boing(); G.crowdHype = Math.min(1, G.crowdHype + 0.4);
  }
}

function tackle(car, df, hitters) {
  const b = G.ball;
  Sound.tackle(); cam.shake = 7; G.lastTackler = df;
  const stick = df.hit > 0;
  const boom = stick || ((df.speedNow > 11 || (df.dive > 0 && df.speedNow > 10.5)) && chance(0.35));
  if (boom) { cam.shake = 15; G.slowmo = 0.45; car.dizzy = 1; addText(car.x, car.y, pick(['BOOM!', 'WHAM!', 'CRUNCH!', 'POW!']), '#ff7a3d', 30, 0.9); Sound.boing(); }
  car.down = 1.2; car.downDir = dirOf(df.side); car.vx = df.vx * 0.4; car.vy = df.vy * 0.4; car.mouth = 'O'; car.mouthT = 1.2;
  df.down = 0.9; df.downDir = car.downDir; df.dive = 0;
  car.head.vx += rand(-400, 400); car.head.vy -= 200;
  addStars(car.x, car.y);
  const st = stat(df);
  // fumble?
  df.hit = 0;
  if ((G.bstate === 'run' || stick) && chance(0.022 + (hitters > 1 ? 0.02 : 0) + (stick ? 0.3 : 0) + Weather.fumbleBonus())) {
    b.holder = null; b.x = car.x; b.y = car.y;
    b.loose = { vx: rand(-4, 4), vy: rand(-3, 3), t: 0 };
    G.bstate = 'loose'; showBanner('FUMBLE!', '', '#ff9a3d', 1.0); car.down = 0.9;
    return;
  }
  st.tkl++;
  const sack = car === G.O[0] && G.bstate === 'snap' && dirOf(G.poss) * (car.x - G.los) <= 0;
  if (sack) { st.sack++; showBanner('SACKED!', df.name, '#ff6040', 1.2); }
  endPlay({ type: sack ? 'sack' : 'tackle', carrier: car, x: car.x, y: car.y });
}

function updateLoose(dt) {
  const b = G.ball, l = b.loose;
  l.t += dt; b.x += l.vx * dt; b.y += l.vy * dt; l.vx *= 0.96; l.vy *= 0.96;
  b.z = Math.abs(Math.sin(l.t * 9)) * 0.8 * Math.max(0, 1 - l.t);
  b.spin = (b.spin || 0) + dt * 10;
  if (b.y < 0 || b.y > FIELD_W) { // rolled out: last team to have it keeps it
    b.loose = null; endPlay({ type: 'oob', carrier: G.O[1].side === G.poss ? G.O[1] : null, x: b.x, y: b.y, keep: true }); return;
  }
  if (l.t < 0.3) return;
  for (const p of G.players) if (p.down <= 0 && dist(p, b) < 0.9) {
    b.loose = null; b.holder = p; Sound.catch();
    if (p.side !== G.poss) { G.tstats[G.poss].to++; showBanner('RECOVERED!', p.name, '#ff5050', 1.3); }
    else showBanner('RECOVERED!', p.name, '#9cff9c', 1.1);
    endPlay({ type: 'fumble', carrier: p, x: p.x, y: p.y });
    return;
  }
}

function checkBounds() {
  const car = G.ball.holder; if (!car) return;
  const s = car.side, d = dirOf(s);
  if (d * (car.x - goalX(s)) >= 0) { return endPlay({ type: 'td', carrier: car, x: car.x, y: car.y }); }
  if (car.y < 0 || car.y > FIELD_W || car.x < 0 || car.x > 120) {
    addText(car.x, clamp(car.y, 1, FIELD_W - 1), 'OUT OF BOUNDS', '#fff', 14, 1);
    endPlay({ type: 'oob', carrier: car, x: clamp(car.x, 0, 120), y: car.y });
  }
}

// ---------------- end of a play ----------------
function endPlay(res) {
  if (G.phase !== 'live') return;
  if (res.x != null && !isFinite(res.x)) res.x = G.los; // never let a broken spot become the new line of scrimmage
  if (res.y != null && !isFinite(res.y)) res.y = G.ballY;
  G.phase = 'dead'; G.deadT = 1.15; G.showTarget = false; G.aim = null;
  Sound.whistle();
  for (const p of G.players) { p.throwKey = 0; p.engaged = null; }
  G.flagNote = null; G.pendingRunoff = 0;
  if (G.special) { G.flags = []; return endReturn(res); }
  G.lastResult = pbpPlay(res);
  xfAfterPlay(res, G.lastResult);
  if (G.flags && G.flags.length) { if (G.twoPt) G.flags = []; else if (enforcePenalty(res)) return; }
  const off = G.poss, d = dirOf(off);
  const car = res.carrier;
  const cs = car ? car.side : off;
  let x = res.x != null ? res.x : G.los;
  let next = null;

  // stats credit (offense keeps the ball)
  if (G.credit && cs === off && res.type !== 'inc') {
    const yds = Math.round(d * (Math.min(d > 0 ? 110 : 120, Math.max(d > 0 ? 0 : 10, x)) - G.los));
    const c = G.credit;
    if (c.kind === 'rush') { stat(c.p).rush += yds; G.tstats[off].rush += yds; }
    else { stat(c.p).rec += yds; stat(c.passer).pass += yds; G.tstats[off].pass += yds; }
  }
  if (res.type === 'sack') { const yds = Math.round(d * (x - G.los)); G.tstats[off].pass += yds; }

  if (G.twoPt) {
    if (res.type === 'td' && cs === off) { G.score[off] += 2; showBanner('TWO POINTS!', '', '#9cff9c', 1.8); Sound.td(); addPbp('Two-point try is GOOD.'); }
    else showBanner('NO GOOD', '2-point try fails', '#ff6040', 1.5);
    G.twoPt = false; G.patSide = null;
    next = { kickoff: off };
  } else if (res.type === 'td') {
    G.score[cs] += 6; G.deadT = isHumanSide(cs) ? 3.8 : 2.5;
    if (isHumanSide(cs)) { G.cellyGuy = car; car.down = 0; car.dive = 0; }
    showBanner('TOUCHDOWN!', `${car.name} • ${G.teams[cs].city} ${G.teams[cs].name}`, isHumanSide(cs) ? '#ffd23f' : '#ff6040', 2.6);
    Sound.td(); G.crowdHype = 1.5; stat(car).td++; G.slowmo = 0.9;
    for (const q of G.players) if (q.side === cs) q.celebrate = 2.6;
    for (let i = 0; i < 70; i++) G.fx.push({ kind: 'confetti', px: rand(0, CW), py: rand(-200, 0), vy: rand(120, 260), vx: rand(-40, 40), z: 0, vz: 0, color: pick([G.teams[cs].c1, G.teams[cs].c2, '#fff']), life: 2.6, max: 2.6 });
    if (G.credit && G.credit.passer && cs === off) stat(G.credit.passer).td++;
    for (let i = 0; i < 25; i++) G.fx.push({ kind: 'star', x: car.x + rand(-4, 4), y: car.y + rand(-4, 4), z: rand(0, 40), vz: rand(20, 60), life: 1.4, max: 1.4 });
    next = { pat: cs };
  } else if (res.type === 'inc') {
    showBanner('INCOMPLETE', G.flagNote || '', '#ffffff', 0.9);
    next = advanceDown(G.los, false);
  } else if (cs !== off) { // takeaway
    const cd = dirOf(cs);
    if (cd * (x - ownGoal(cs)) <= 0) { x = ownGoal(cs) + cd * 20; addText(x, MID, 'TOUCHBACK', '#fff', 18, 1.2); }
    if (res.type !== 'fumble') showBanner('TURNOVER!', `${G.teams[cs].name} ball`, '#ff9a3d', 1.4);
    next = { drive: cs, x };
  } else if (d * (x - ownGoal(off)) <= 0) {
    G.score[1 - off] += 2; showBanner('SAFETY!', '+2', '#ff6040', 1.8);
    next = { kickoff: off, from: 20 };
  } else {
    G.ballY = clamp(res.y != null ? res.y : G.ballY, 20, FIELD_W - 20);
    next = advanceDown(x, true);
    if (res.type !== 'oob') G.pendingRunoff = 9;
  }
  G.next = next;
}

function advanceDown(x, moved) {
  const d = dirOf(G.poss);
  if (moved) {
    const gain = Math.round(d * (x - G.los));
    G.los = clamp(x, 11, 109);
    if (d * (G.los - G.firstDownX) >= -0.05) {
      G.down = 1; setFirstDown();
      if (!G.banner || G.banner.t > 0.5) showBanner('FIRST DOWN!', gain > 0 ? `+${gain} yards` : '', '#9cff9c', 1.1);
      return null;
    }
    if (gain !== 0 && (!G.banner || G.banner.t > 0.8)) addText(x, G.ballY - 4, (gain > 0 ? '+' : '') + gain + ' YDS', gain > 0 ? '#9cff9c' : '#ff8a8a', 18, 1.2);
  }
  G.down++;
  if (G.down > 4) {
    showBanner('TURNOVER ON DOWNS', '', '#ff9a3d', 1.5);
    return { drive: 1 - G.poss, x: G.los };
  }
  return null;
}

function afterPlay() {
  const n = G.next; G.next = null;
  if (G.cellyGuy) { G.cellyGuy.celly = null; G.cellyGuy = null; }
  G.runoff = 0;
  if (G.mini && typeof miniAfterPlay === 'function') return miniAfterPlay();
  // overtime is sudden death
  if (G.quarter >= 5 && G.score[0] !== G.score[1]) return gameOver();
  if (n && n.pat != null) { G.patSide = n.pat; G.poss = n.pat; G.los = goalX(n.pat) - dirOf(n.pat) * 3; G.ballY = MID; return toPlayCall(); }
  if (G.clock <= 0 && G.quarter > 0 && endQuarter()) return;
  if (n && n.kickoff != null) return startKickoff(n.kickoff, n.from || 35);
  if (n && n.drive != null) {
    setDrive(n.drive, n.own != null ? ownGoal(n.drive) + dirOf(n.drive) * n.own : clamp(n.x, 11, 109));
  }
  toPlayCall();
}

function endQuarter() {
  G.pendingRunoff = 0; // new quarter: clock waits for the snap
  if (G.quarter === 2) {
    G.quarter = 3; G.clock = G.qtrLen; G.timeouts = [3, 3];
    showBanner('HALFTIME', `${G.teams[1].id} ${G.score[1]}  -  ${G.teams[0].id} ${G.score[0]}`, '#fff', 2.5);
    startKickoff(G.firstPoss); // the team that got the ball first kicks off now
    return true;
  } else if (G.quarter >= 4) {
    if ((G.quarter === 4 || G.playoff) && G.score[0] === G.score[1]) {
      G.quarter = Math.max(5, G.quarter + 1); G.clock = G.qtrLen; G.timeouts = [2, 2];
      const s = chance(0.5) ? 0 : 1;
      showBanner('OVERTIME!', `Next score wins • ${G.teams[s].name} get the ball`, '#ffd23f', 2.5);
      startKickoff(1 - s);
      return true;
    } else { gameOver(); return true; }
  } else {
    G.quarter++; G.clock = G.qtrLen;
    showBanner(`END OF ${ordinal(G.quarter - 1).toUpperCase()}`, '', '#fff', 1.4);
  }
  return false;
}

function gameOver() {
  G.phase = 'over';
  const all = Object.values(G.pstats);
  const top = (k, side) => all.filter(s => s.side === side && s[k] > 0).sort((a, b) => b[k] - a[k])[0];
  G.hooks.onGameOver({
    score: G.score.slice(), teams: G.teams, human: G.human, tstats: G.tstats,
    leaders: [0, 1].map(s => ({ pass: top('pass', s), rush: top('rush', s), rec: top('rec', s), tkl: top('tkl', s), int: top('int', s), sack: top('sack', s) }))
  });
}

// ---------------- kicks (punt, field goal, extra point) ----------------
function kickerOf(side, kind) {
  const t = G.teams[side], k = kind === 'punt' ? t.p : t.k;
  return k ? { name: k[0], num: k[1], ovr: k[2], skin: k[3] } : { name: t.name + (kind === 'punt' ? ' Punter' : ' Kicker'), num: kind === 'punt' ? 4 : 3, ovr: 74 };
}
const fgRange = ovr => 42 + (ovr - 60) * 0.6 + Weather.kickRange();   // 90 OVR kicker ≈ 60 yards, 70 OVR ≈ 48
function fgTol(yds, ovr) { return clamp(0.3 - (yds - 20) * 0.0045, 0.07, 0.3) * (0.75 + (ovr - 60) / 120); }

function doKick(kind) {
  const s = G.poss, d = dirOf(s);
  if (kind === 'punt') { G.kickFrom = null; setupReturn('punt', s); G.poss = 1 - s; return startKickMeter('punt', s); }
  setupPlay(OFF_PLAYS[2], DEF_PLAYS[0], true);
  const kk = kickerOf(s, kind);
  const kicker = G.O[0];
  Object.assign(kicker, { name: kk.name, num: kk.num, ovr: kk.ovr, pos: kind === 'punt' ? 'P' : 'K', cap: false, xf: null });
  if (kk.skin != null) kicker.face.skin = kk.skin;
  kicker.x = G.los - d * (kind === 'punt' ? 12 : 8.5); kicker.y = G.ballY - (kind === 'punt' ? 0 : 1.2);
  if (kind !== 'punt') { const h = G.O[1]; h.x = G.los - d * 7; h.y = G.ballY; h.face.dir = -d; }
  // everybody lines up tight for the kick
  [2, 3, 4].forEach((i, j) => { G.O[i].x = G.los - d * 0.8; G.O[i].y = G.ballY + [-4.2, 4.2, 6.2][j]; });
  G.D.forEach((p, i) => { if (kind === 'punt' && i >= 5) { p.x = G.los + d * 38; p.y = G.ballY + (i - 6) * 6; } else { p.x = G.los + d * 1.3; p.y = G.ballY + (i - 3.5) * 1.6; } });
  G.ball.holder = null; G.ball.x = kind === 'punt' ? kicker.x : G.los - d * 7; G.ball.y = G.ballY; G.ball.z = 0.3;
  const yds = kind === 'xp' ? 33 : kind === 'fg' ? Math.round(Math.abs(goalX(s) - G.los) + 17) : 0;
  const ovr = kk.ovr;
  G.km = { kind, yds, kk, stage: 0, t: 0, power: 0, aim: 0, side: s,
           rateP: 0.75 + (90 - ovr) * 0.02, rateA: 0.9 + (90 - ovr) * 0.028,
           need: kind === 'punt' ? 0 : yds / fgRange(ovr), tol: kind === 'punt' ? 0.35 : fgTol(yds, ovr) * (kind === 'xp' ? 1.25 : 1) };
  G.playClock = 0;
  if (isHumanSide(s) && !G.demo) { G.phase = 'kickmeter'; G.km.wait = 0.35; return; }
  // computer kicks: roll the dice using the kicker's rating
  const km = G.km;
  if (kind === 'punt') { km.power = rand(0.55, 0.95); km.aim = rand(-0.45, 0.45); }
  else {
    const pGood = kind === 'xp' ? clamp(0.86 + (ovr - 70) * 0.005, 0.8, 0.98) : clamp(1.0 - Math.max(0, yds - 25) * 0.021 * (1 + (78 - ovr) / 40), 0.03, 0.97);
    const good = chance(pGood);
    km.power = good ? Math.max(km.need + 0.05, rand(0.8, 1)) : (km.need > 0.85 && chance(0.5) ? km.need - rand(0.05, 0.2) : rand(Math.min(1, km.need + 0.05), 1));
    km.aim = good ? rand(-km.tol * 0.8, km.tol * 0.8) : (km.power < km.need ? rand(-0.2, 0.2) : pick([-1, 1]) * rand(km.tol * 1.15, km.tol * 2.2));
  }
  launchKick();
}

const tri = t => 1 - Math.abs(((t % 2) + 2) % 2 - 1); // 0..1..0
function updateKickMeter(dt) {
  const km = G.km;
  km.t += dt;
  if (km.cpuT != null) { km.cpuT -= dt; if (km.cpuT <= 0) { km.cpuT = null; launchReturnKick(); } return; }
  if (km.wait > 0) { km.wait -= dt; Input.taps.length = 0; return; }
  const press = Input.hit('Space') || Input.taps.length > 0;
  if (km.stage === 0) {
    km.power = tri(km.t * km.rateP);
    if (press) { km.stage = 1; km.t2 = 0; Sound.click(); }
  } else if (km.stage === 1) {
    km.t2 += dt;
    km.aim = tri(km.t2 * km.rateA + 0.5) * 2 - 1;
    if (press) { km.stage = 2; Sound.click(); (km.kind === 'punt' || km.kind === 'ko' || km.kind === 'onside') ? launchReturnKick() : launchKick(); }
  }
}

function launchKick() {
  const km = G.km, s = km.side, d = dirOf(s), kicker = G.O[0];
  const k = { kind: km.kind, t: 0, side: s, yds: km.yds };
  if (km.kind === 'punt') {
    let dist = 30 + km.power * (18 + (km.kk.ovr - 60) * 0.35);
    const shank = Math.abs(km.aim) > 0.75;
    if (shank) dist *= 0.55;
    k.land = G.los + d * dist - d * 12 + d * 12; // measured from the line
    k.ty = G.ballY + km.aim * 24;
    k.oob = k.ty < 0 || k.ty > FIELD_W;
    if (k.oob) { const f = (k.ty < 0 ? -G.ballY : FIELD_W - G.ballY) / (k.ty - G.ballY); k.land = G.los + d * dist * f; k.ty = clamp(k.ty, -1, FIELD_W + 1); }
    k.shank = shank; k.T = 1.4 + km.power * 1.4; k.peak = 8 + km.power * 10;
  } else {
    const range = fgRange(km.kk.ovr);
    k.short = km.power < km.need;
    k.good = !k.short && Math.abs(km.aim) <= km.tol;
    if (k.short) { k.land = G.los - d * 7 + d * Math.max(10, km.power * range); k.ty = MID + km.aim * 6; }
    else { k.land = goalX(s) + d * 10; k.ty = MID + (k.good ? (km.aim / km.tol) * 2.6 : Math.sign(km.aim || 1) * (3.6 + Math.abs(km.aim) * 4)); }
    k.T = 1.25 + km.yds / 60; k.peak = 7 + km.power * 5;
  }
  k.sx = G.ball.x; k.sy = G.ball.y;
  G.kick = k; G.phase = 'kick';
  kicker.throwAnim = 0.3; kicker.vx = d * 4;
  Sound.tone(140, 0.15, 'square', 0.15, -40); Sound.tone(90, 0.12, 'sine', 0.2);
  if (km.kind === 'fg') addText(G.los, G.ballY - 6, `${km.yds} YARD TRY`, '#fff', 18, 1.5);
}

function updateKick(dt) {
  const k = G.kick, b = G.ball;
  k.t += dt;
  const u = Math.min(1, k.t / k.T);
  b.x = lerp(k.sx, k.land, u); b.y = lerp(k.sy, k.ty, u);
  b.z = k.peak * 4 * u * (1 - u) + (k.kind !== 'punt' && !k.short ? u * 3.5 : 0); b.spin = (b.spin || 0) + dt * 14;
  if (u < 1) return;
  if (k.done) { k.wait -= dt; if (k.wait <= 0) afterPlay(); return; }
  k.done = true; k.wait = 1.7;
  const s = k.side, d = dirOf(s);
  if (k.kind === 'punt') {
    let x = k.land;
    if (d * (x - goalX(s)) >= 0) { x = goalX(s) - d * 20; showBanner('TOUCHBACK', '', '#fff', 1.2); }
    else {
      const yl = Math.round(d * (goalX(s) - x));
      addPbp(`${G.km.kk.name.split(' ').slice(-1)[0]} punts ${yd(Math.round(Math.abs(x - G.los)))}${k.shank ? ', shanked' : k.oob ? ', out of bounds' : ''}.`);
      showBanner(k.shank ? 'SHANKED!' : k.oob ? 'OUT OF BOUNDS' : 'PUNT', `${Math.round(Math.abs(x - G.los))} yards${yl <= 10 ? ` • pinned at the ${yl}!` : ''}`, k.shank ? '#ff6040' : '#fff', 1.4);
    }
    G.next = { drive: 1 - s, x }; G.runoff = 6;
  } else if (k.kind === 'fg') {
    if (G.mini) { k.wait = 1.4; G.miniKick = k.good; showBanner(k.good ? "IT'S GOOD!" : k.short ? 'SHORT!' : 'NO GOOD!', `${k.yds} yards`, k.good ? '#9cff9c' : '#ff6040', 1.3); (k.good ? Sound.td() : Sound.bad()); return; }
    addPbp(`${lastName(G.km.kk.name)} ${k.yds}-yard field goal is ${k.good ? 'GOOD' : k.short ? 'short' : 'no good'}.`);
    if (k.good) { G.score[s] += 3; showBanner("IT'S GOOD!", `${k.yds}-yard field goal`, '#9cff9c', 1.8); Sound.td(); G.next = { kickoff: s }; }
    else { showBanner(k.short ? 'SHORT!' : 'NO GOOD!', k.short ? `${k.yds} yards was too far` : `${k.yds}-yard try is ${k.ty < MID ? 'wide left' : 'wide right'}`, '#ff6040', 1.6); Sound.bad(); G.next = { drive: 1 - s, x: d * (G.los - (goalX(s) - d * 20)) > 0 ? goalX(s) - d * 20 : G.los }; }
    G.runoff = 5;
  } else { // xp
    addPbp(`${lastName(G.km.kk.name)} extra point is ${k.good ? 'good' : 'NO GOOD'}.`);
    if (k.good) { G.score[s] += 1; showBanner('EXTRA POINT GOOD', '', '#9cff9c', 1.2); Sound.catch(); }
    else { showBanner('XP MISSED!', '', '#ff6040', 1.3); Sound.bad(); }
    G.patSide = null; G.next = { kickoff: s };
  }
}

function updateBallPhysicsDead(dt) {
  const b = G.ball; if (!b || !b.dead || b.holder) return;
  b.x += b.dead.vx * dt; b.y += b.dead.vy * dt; b.dead.vx *= 0.94; b.dead.vy *= 0.94;
  if (b.bounce) { b.bounce -= dt; b.z = Math.abs(Math.sin(b.bounce * 9)) * b.bounce * 2.2; b.spin = (b.spin || 0) + dt * 20; }
  else b.z = Math.max(0, b.z - dt * 4);
}

// ---------------- fx / camera / hints ----------------
function addText(x, y, text, color, size = 18, life = 1) { G.fx.push({ kind: 'text', x, y, text, color, size, z: 40, vz: 30, life, max: life }); }
function addDust(x, y, n) { for (let i = 0; i < n; i++) G.fx.push({ kind: 'dust', x: x + rand(-0.6, 0.6), y: y + rand(-0.6, 0.6), z: 0, vz: rand(5, 20), r: rand(3, 6), life: 0.5, max: 0.5 }); }
function addStars(x, y) { for (let i = 0; i < 5; i++) G.fx.push({ kind: 'star', x: x + rand(-1, 1), y: y + rand(-1, 1), z: 20 + rand(0, 20), vz: rand(20, 50), life: 0.8, max: 0.8 }); addDust(x, y, 6); }
function showBanner(text, sub, color, dur) { G.banner = { text, sub, color, t: 0, dur }; }
function updateFx(dt) {
  for (const f of G.fx) { f.life -= dt; f.z += f.vz * dt; if (f.kind === 'confetti') { f.px += f.vx * dt; f.py += f.vy * dt; } if (f.kind === 'flag') f.t += dt; }
  G.fx = G.fx.filter(f => f.life > 0);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  cam.shake *= Math.pow(0.02, dt);
}
function updateCamera(dt) {
  if (!G.teams) return;
  if (G.mini && G.phase === 'mini') return;
  if (!isFinite(cam.x) || !isFinite(cam.y)) { cam.x = 60; cam.y = MID; }
  const b = G.ball;
  let tx = G.los != null ? G.los + dirOf(G.poss) * 8 : 60;
  if (G.phase === 'live' || G.phase === 'dead' || G.phase === 'kick') {
    if (b && b.holder) tx = b.holder.x + dirOf(b.holder.side) * 6;
    else if (b) tx = b.x;
  }
  const half = CW / 2 / PX;
  const kicking = G.phase === 'kick' || G.phase === 'kickmeter';
  if (G.phase === 'kickmeter' && G.km && G.km.kind !== 'punt') tx = lerp(G.los, goalX(G.poss) + dirOf(G.poss) * 10, 0.6); // show the posts while you aim
  tx = clamp(tx, half - (kicking ? 9 : 5), (kicking ? 129 : 125) - half);
  cam.x = lerp(cam.x, tx, 1 - Math.exp(-dt * 4));
  let ty = MID;
  if (b && (G.phase === 'live' || G.phase === 'dead')) ty = lerp(MID, b.holder ? b.holder.y : b.y, 0.4);
  cam.y = lerp(cam.y, clamp(ty, MID - 6, MID + 6), 1 - Math.exp(-dt * 3));
}
function updateHint() {
  if (!G.teams) return;
  if (G.phase === 'kickmeter' || G.mini) { G.hint = ''; return; }
  if (G.cellyGuy && G.phase === 'dead') { G.hint = G.versus ? `${pName(G.cellyGuy.side)}: CELEBRATE!` : G.mode === 'mobile' ? 'CELEBRATE! Tap a celly button' : 'CELEBRATE!  ↑ Leap  •  ↓ Griddy  •  ← Spike  •  → Dab'; return; }
  if (G.mode === 'mobile') return updateHintMobile();
  if (G.versus) {
    const k = s => s === G.p1 ? 'SPACE' : 'ENTER';
    G.hint = G.phase === 'presnap' ? `${pName(G.poss)} snaps with ${k(G.poss)}  •  ${pName(1 - G.poss)} picks a defender with ${G.poss === G.p1 ? 'L' : 'Q'}` : '';
    return;
  }
  const humanOff = G.poss === G.human;
  const b = G.ball;
  if (G.phase === 'presnap') G.hint = humanOff ? (G.play.off.type === 'run' ? 'SPACE snap  •  Z audible  •  T timeout' : 'SPACE snap  •  1-4 = HOT ROUTE a receiver  •  Z audible  •  T timeout') : 'Q / TAB pick your defender  •  Z audible  •  T timeout';
  else if (G.phase === 'live') {
    const h = G.humanPlayer;
    if (h && b.holder === h && h.side === G.human) G.hint = humanCanThrow() ? '1-4 throw (SHIFT = bullet, CTRL = lob, hold WASD to lead)  •  or drag back with mouse' : 'WASD move  •  SHIFT sprint  •  E juke  •  F spin  •  R stiff arm';
    else if (h && (h.side !== G.poss || (b.holder && b.holder.side !== G.human))) G.hint = b.flight ? 'SPACE = JUMP for the pick!  •  WASD move' : h.engaged ? 'E = SWIM MOVE past the blocker!' : 'WASD move  •  SHIFT sprint  •  SPACE dive  •  C HIT STICK  •  Q switch';
    else G.hint = 'Steer to the ball marker to catch it!';
  } else G.hint = '';
}

function updateHintMobile() {
  const humanOff = G.poss === G.human, b = G.ball, h = G.humanPlayer;
  if (G.phase === 'presnap') G.hint = humanOff ? (G.play.off.type === 'pass' ? 'TAP field to snap  •  TAP a receiver = hot route' : 'TAP to snap') : 'SWITCH = pick your defender';
  else if (G.phase === 'kickmeter') G.hint = '';
  else if (G.phase === 'live') {
    if (humanCanThrow()) G.hint = 'DRAG BACK to throw  •  drag FORWARD = QB run  •  or tap a receiver';
    else if (h && b.holder === h) G.hint = 'Hold to steer  •  TAP = juke';
    else if (h && (h.side !== G.poss || (b.holder && b.holder.side !== G.human))) G.hint = b.flight ? 'TAP = JUMP for the pick!' : h.engaged ? 'SWIM to beat the blocker!' : 'Joystick / hold to move  •  TAP near runner = dive';
    else G.hint = '';
  } else G.hint = '';
}
