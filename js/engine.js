// ---- Game engine: rules, players, AI, physics ----
// Field x: 0-10 = home end zone, 10-110 = field, 110-120 = away end zone. Home (side 0) attacks right.
const G = {
  phase: 'idle', teams: null, players: [], fx: [], ball: null, banner: null, time: 0, crowdHype: 0,
  score: [0, 0], hooks: {}, hint: '', paused: false
};

const dirOf = s => (s === 0 ? 1 : -1);
const goalX = s => (s === 0 ? 110 : 10);      // goal line this side is attacking
const ownGoal = s => (s === 0 ? 10 : 110);    // goal line this side defends
const fromOwn = (s, x) => dirOf(s) * (x - ownGoal(s));
const MID = FIELD_W / 2;

G.downText = function () {
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
  Object.assign(G, {
    teams: [home, away], human: 0, diff: opts.diff, qtrLen: opts.qtr, score: [0, 0], quarter: 1, clock: opts.qtr,
    fx: [], banner: null, players: [], ball: null, patSide: null, twoPt: false, next: null, firstPoss: 1, paused: false,
    pstats: {}, tstats: [{ pass: 0, rush: 0, to: 0 }, { pass: 0, rush: 0, to: 0 }]
  });
  setDrive(1, ownGoal(1) + dirOf(1) * 25);
  showBanner('KICKOFF!', `${away.city} ${away.name} get the ball first`, '#fff', 2.2);
  toPlayCall();
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
  const k = p.side + ':' + p.name;
  return G.pstats[k] || (G.pstats[k] = { name: p.name, side: p.side, pos: p.pos, pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, int: 0, sack: 0, comp: 0, att: 0 });
}

// ---------------- play calling ----------------
function toPlayCall() {
  G.phase = 'playcall';
  G.ball = null;
  previewFormation();
  const humanOff = G.poss === G.human;
  if (G.patSide != null && !G.twoPt) {
    if (G.patSide === G.human) G.hooks.onPlayCall({ mode: 'pat' });
    else { const two = chance(0.12) || (G.quarter >= 4 && G.score[G.patSide] - G.score[1 - G.patSide] === -2); setTimeout(() => choosePAT(two ? 'two' : 'xp'), 700); }
    return;
  }
  const ctx = { mode: humanOff ? 'off' : 'def', fourth: G.down === 4 && !G.twoPt, fgDist: Math.round(Math.abs(goalX(G.poss) - G.los) + 17) };
  G.hooks.onPlayCall(ctx);
}

function cpuOffCall() {
  if (G.down === 4 && !G.twoPt) {
    const fg = Math.abs(goalX(G.poss) - G.los) + 17;
    const toGo = Math.abs(G.firstDownX - G.los);
    const behind = G.score[G.poss] < G.score[1 - G.poss];
    const desperate = G.quarter >= 4 && behind && G.clock < 60;
    if (!desperate && !(toGo <= 2 && fromOwn(G.poss, G.los) > 45)) {
      if (fg <= 52 && !(desperate)) return 'fg';
      return 'punt';
    }
  }
  const toGo = Math.abs(G.firstDownX - G.los);
  const runW = toGo <= 3 ? 0.55 : toGo >= 8 ? 0.15 : 0.35;
  if (chance(runW)) return pick(['zone', 'zone', 'toss', 'qbdraw']);
  return toGo >= 12 ? pick(['verts', 'pa', 'mesh', 'curls', 'verts']) : pick(['slants', 'mesh', 'curls', 'screen', 'pa', 'verts', 'slants']);
}
function cpuDefCall() {
  const toGo = Math.abs(G.firstDownX - G.los);
  if (toGo <= 2 && chance(0.5)) return 'run';
  if (toGo >= 15 && chance(0.4)) return 'prevent';
  return pick(['man', 'c2', 'c3', 'blitz', 'man', 'c3', 'cb', 'run']);
}

// called by the UI when the human picks a card
function choosePlay(key) {
  const humanOff = G.poss === G.human;
  const offKey = humanOff ? key : cpuOffCall();
  const defKey = humanOff ? cpuDefCall() : key;
  if (offKey === 'punt' || offKey === 'fg') { doKick(offKey); return; }
  setupPlay(OFF_PLAYS.find(p => p.key === offKey), DEF_PLAYS.find(p => p.key === defKey));
  G.phase = 'presnap';
  G.snapTimer = humanOff ? Infinity : 1.3;
  if (!humanOff) addText(G.los + dirOf(G.poss) * -2, G.ballY - 8, G.play.off.name.toUpperCase() + '?', '#fff', 16, 1.2);
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
  const [pos, name, num, ovr0] = tuple;
  const h = hashStr(name);
  const cpu = side !== G.human;
  const ovr = clamp(ovr0 + (cpu ? [-7, 0, 5][G.diff] : 0), 40, 99);
  const base = { QB: 7.5, RB: 8.7, WR: 8.9, TE: 8.1, OL: 6.0, DL: 6.9, LB: 7.9, CB: 8.9, S: 8.6 }[pos] || 8;
  const big = pos === 'OL' || pos === 'DL';
  return {
    side, off: isOff, slot, pos, name, num, ovr,
    x: 0, y: 0, vx: 0, vy: 0, dvx: 0, dvy: 0,
    spd: base * (0.8 + ovr * 0.0023) * (cpu ? [0.94, 1, 1.03][G.diff] : 1), acc: big ? 15 : 24,
    face: { skin: h % 6, beard: ((h >> 5) % 4) === 0, angry: !isOff || big, dir: dirOf(side) },
    head: { ox: 0, oy: 0, vx: 0, vy: 0, rot: 0 }, headScale: 1 + ((h >> 9) % 5) * 0.035 + (pos === 'QB' ? 0.06 : 0),
    anim: (h % 100) / 10, speedNow: 0, stamina: 1, down: 0, downDir: 1, stun: 0, spin: 0, juke: 0, jukeCd: 0, spinCd: 0,
    dive: 0, tackleCd: 0, engaged: null, shed: 0, shedCd: 0, mouth: '', mouthT: 0, isHuman: false, throwKey: 0, openness: null,
    role: 'idle', route: null, assign: null, aiIdle: 0
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
  at(O[1], L - d * 4, by + ws * 2.2);
  at(O[2], L - d * 0.8, Math.max(4, by - 16));
  at(O[3], L - d * 0.8, Math.min(FIELD_W - 4, by + 16));
  at(O[4], L - d * 1.5, by + ws * 8);
  at(O[5], L - d * 0.7, by - 1.7); at(O[6], L - d * 0.7, by); at(O[7], L - d * 0.7, by + 1.7);

  // offense roles
  for (const p of O) p.role = 'idle';
  O[0].role = 'qb';
  for (let s = 5; s <= 7; s++) { O[s].role = offPlay.type === 'run' ? 'runblock' : offPlay.screen ? 'screenblock' : 'passblock'; O[s].blockTarget = D[s - 5]; }
  for (let s = 1; s <= 4; s++) {
    const p = O[s];
    const rt = offPlay.routes && offPlay.routes[s];
    if (s === 1 && offPlay.rb) {
      p.role = 'runpath';
      p.route = { pts: offPlay.rb.path.map(([dd, w]) => ({ x: L + d * dd, y: clamp(by + ws * w, 1.5, FIELD_W - 1.5) })), end: offPlay.rb.end, i: 0 };
    } else if (rt) {
      const out = Math.sign(p.y - by) || ws;
      p.role = rt.end === 'block' ? 'stalk' : 'route';
      p.route = { pts: rt.r.map(([dd, oo]) => ({ x: p.x + d * dd, y: clamp(p.y + out * oo, 1.2, FIELD_W - 1.2) })), end: rt.end, i: 0 };
      if (rt.end === 'block') p.route.blockAfter = true;
    } else {
      p.role = s === 1 ? 'passblock' : 'stalk';
    }
  }

  // defense alignment + assignments
  D.forEach((p, i) => { p.assign = parseAssign(defPlay.a[i]); });
  at(D[0], L + d * 1.2, by - 2.2); at(D[1], L + d * 1.2, by); at(D[2], L + d * 1.2, by + 2.2);
  at(D[3], L + d * 5, by - 4.5); at(D[4], L + d * 5, by + 4.5);
  at(D[5], L + d * 6, O[2].y); at(D[6], L + d * 6, O[3].y); at(D[7], L + d * 12, by);
  for (const p of D) {
    const a = p.assign;
    if (a.type === 'man' && p.slot >= 5) { const t = O[a.t]; at(p, t.x + d * (p.pos === 'CB' ? 2 : 4), t.y + (t.y > by ? -0.6 : 0.6)); }
    if (a.type === 'rush' && p.slot >= 3) { at(p, L + d * (p.slot >= 5 ? 3 : 2.5), lerp(p.y, by, p.slot >= 5 ? 0.45 : 0.3)); }
    if (a.type === 'zone' && p.slot >= 5 && a.d > 10) { at(p, L + d * Math.min(a.d - 4, 14), lerp(p.y, zoneY(a.y), 0.4)); }
  }

  G.players = P; G.O = O; G.D = D;
  G.play = { off: offPlay, def: defPlay, t: 0 };
  G.ball = { x: L, y: by, z: 0, holder: preview ? null : O[0], flight: null, loose: null };
  if (!preview) G.ball.holder = O[0];
  else G.ball.holder = O[6]; // center holds it while we pick
  G.bstate = 'snap'; G.qbScramble = false; G.qbThink = 0; G.handedOff = false; G.intended = null;
  G.runoff = 0; G.passPlay = offPlay.type === 'pass';
  // human control
  for (const p of P) p.isHuman = false;
  if (o !== G.human) G.humanDef = D[3];
  updateHuman();
}

// ---------------- snap & live play ----------------
function snap() {
  G.phase = 'live'; G.play.t = 0; Sound.hike();
  G.ball.holder = G.O[0]; G.bstate = 'snap';
  addDust(G.los, G.ballY, 4);
}

function update(dt) {
  G.time += dt;
  if (G.paused) return;
  G.crowdHype = Math.max(0, G.crowdHype - dt * 0.4);
  if (G.phase === 'presnap') {
    if (G.poss === G.human) { if (Input.hit('Space')) snap(); }
    else { G.snapTimer -= dt; if (Input.hit('KeyQ')) cycleHumanDef(); if (G.snapTimer <= 0) snap(); }
    idlePlayers(dt);
  } else if (G.phase === 'live') {
    livePlay(dt);
  } else if (G.phase === 'dead') {
    for (const p of G.players) { p.dvx = 0; p.dvy = 0; applyMove(p, dt); }
    updateBallPhysicsDead(dt);
    G.deadT -= dt;
    if (G.deadT <= 0) afterPlay();
  } else if (G.phase === 'kick') {
    updateKick(dt);
    idlePlayers(dt);
  } else if (G.phase === 'playcall') {
    idlePlayers(dt);
  }
  updateFx(dt);
  updateHint();
  updateCamera(dt);
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
    p.stun = Math.max(0, p.stun - dt); p.juke = Math.max(0, p.juke - dt); p.spin = Math.max(0, p.spin - dt);
    if (p.mouthT > 0) { p.mouthT -= dt; if (p.mouthT <= 0) p.mouth = ''; }
    if (p.down > 0 || p.stun > 0) { p.dvx = p.dvy = 0; continue; }
    if (p.dive > 0) continue; // dive keeps its velocity
    if (p.isHuman && humanControl(p, dt)) continue;
    ai(p, dt);
  }
  resolveBlocks(dt);
  for (const p of G.players) {
    applyMove(p, dt);
    if (p.off) { (p.hist || (p.hist = [])).push({ t: pl.t, x: p.x, y: p.y, vx: p.vx, vy: p.vy }); if (p.hist.length > 45) p.hist.shift(); }
  }
  separate();

  // handoffs / pitches
  if (G.bstate === 'snap' && b.holder === G.O[0] && pl.off.type === 'run' && !pl.off.qbRun && !G.handedOff) {
    const rb = G.O[1];
    if (pl.off.toss && pl.t > 0.22) { G.handedOff = true; throwTo(G.O[0], rb, true); }
    else if (!pl.off.toss && pl.t > 0.25 && (dist(G.O[0], rb) < 1.6 || pl.t > 0.9)) {
      G.handedOff = true; b.holder = rb; G.bstate = 'run'; stat(rb); G.credit = { p: rb, kind: 'rush' };
    }
  }
  // QB crosses the line = runner
  if (G.bstate === 'snap' && b.holder === G.O[0] && dirOf(G.poss) * (b.holder.x - G.los) > 0.5) {
    G.bstate = 'run'; G.credit = { p: b.holder, kind: 'rush' };
  }
  if (G.bstate === 'snap' && b.holder === G.O[0] && !G.O[0].isHuman) cpuQB(dt);

  // ball
  if (b.flight) updateFlight(dt);
  if (b.loose) updateLoose(dt);
  if (b.holder) { b.x = b.holder.x; b.y = b.holder.y; b.z = 1; }

  // throw markers for human QB
  const canThrow = humanCanThrow();
  for (const p of G.O) { p.throwKey = 0; p.openness = null; }
  if (canThrow) for (const s of [2, 3, 4, 1]) {
    const r = G.O[s];
    if (eligible(r)) { r.throwKey = s === 1 ? 4 : s - 1; r.openness = openness(r); }
  }
  if (canThrow) {
    const keys = { Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 1, Numpad1: 2, Numpad2: 3, Numpad3: 4, Numpad4: 1 };
    for (const k in keys) if (Input.hit(k)) { const r = G.O[keys[k]]; if (eligible(r)) { throwTo(G.O[0], r); break; } }
    for (const c of Input.clicks) {
      let best = null, bd = 50;
      for (const r of G.O) if (r.throwKey) { const dd = Math.hypot(sx(r.x) - c.x, sy(r.y) - 30 - c.y); if (dd < bd) { bd = dd; best = r; } }
      if (best) { throwTo(G.O[0], best); break; }
    }
  }

  if (G.phase !== 'live') return;
  checkTackles();
  if (G.phase !== 'live') return;
  checkBounds();
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
    dirOf(G.poss) * (qb.x - G.los) < 0.5;
}

// who the human is driving right now
function updateHuman() {
  for (const p of G.players) p.isHuman = false;
  let h = null;
  const b = G.ball;
  G.humanPlayer = null;
  if (!b || G.human < 0) return;
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
  if (h) h.isHuman = true;
  G.humanPlayer = h;
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
  const ax = Input.axis();
  const b = G.ball;
  const isCarrier = b.holder === p;
  if (Input.hit('KeyQ') && !isCarrier) { cycleHumanDef(); }
  const sprint = Input.held('ShiftLeft') && p.stamina > 0.05;
  if (sprint && ax.m > 0.1) p.stamina = Math.max(0, p.stamina - dt * 0.32); else p.stamina = Math.min(1, p.stamina + dt * 0.18);
  const mul = (sprint ? 1.13 : 1) * (p.spin > 0 ? 0.8 : 1);
  if (isCarrier) {
    if (Input.hit('KeyE') && p.jukeCd <= 0 && G.bstate !== 'snap') doJuke(p, ax);
    if (Input.hit('KeyF') && p.spinCd <= 0 && G.bstate !== 'snap') doSpin(p);
  }
  const chasing = b.holder ? b.holder.side !== p.side : p.side !== G.poss;
  if (!isCarrier && chasing && Input.hit('Space') && p.dive <= 0) { doDive(p, ax); return true; }
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

function doJuke(p, ax) {
  const sp = Math.hypot(p.vx, p.vy) || 1;
  let fx = p.vx / sp, fy = p.vy / sp;
  if (sp < 1) { fx = dirOf(p.side); fy = 0; }
  let side = (ax && Math.abs(-fy * ax.x + fx * ax.y) > 0.2) ? Math.sign(-fy * ax.x + fx * ax.y) : (p.lastJuke = -(p.lastJuke || 1));
  const px = -fy * side, py = fx * side;
  p.vx = px * p.spd * 1.15 + fx * p.spd * 0.35; p.vy = py * p.spd * 1.15 + fy * p.spd * 0.35;
  p.juke = 0.3; p.jukeCd = 1.0; Sound.juke(); addDust(p.x, p.y, 3);
  p.head.vx += side * 260;
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
    if (carrier) return pursue(p, carrier);
  }
  if (b.loose) { steer(p, b.x, b.y, 1.05); return; }

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
    const near = dist(p, land) < 13 || (a.type === 'man' && G.O[a.t] === tgt);
    if (near && a.type !== 'rush') {
      const ttl = f.T - f.t;
      const reach = p.spd * ttl;
      if (dist(p, land) <= reach + 1.2) steer(p, land.x, land.y, 1.05, 0.3);
      else steer(p, lerp(tgt.x, land.x, 0.6), lerp(tgt.y, land.y, 0.6), 1.05);
      return;
    }
    if (a.type === 'rush') { steer(p, land.x, land.y, 0.6); return; }
  }
  if (b.flight && b.flight.pitch) return pursue(p, G.O[1]);
  const holder = carrier || qb;
  switch (a.type) {
    case 'rush': steer(p, holder.x, holder.y, (p.pos === 'DL' ? 0.95 : 0.97) * (G.play.t < 0.45 ? 0.55 : 1), 0.2); break;
    case 'spy': {
      if (G.qbScramble || d * (holder.x - G.los) > 0) return pursue(p, holder);
      steer(p, G.los + d * 5, lerp(p.y, holder.y, 0.6), 0.8); break;
    }
    case 'man': {
      const t = G.O[a.t];
      if (!eligible(t) && G.play.t > 0.6) { // target stayed in to block: go get the QB
        if (G.play.off.type === 'run') return pursue(p, carrier || G.O[1]);
        steer(p, G.los + d * 4, lerp(p.y, holder.y, 0.5), 0.8); break;
      }
      const lag = 0.15 + (99 - p.ovr) * 0.004;
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
      if (G.play.off.type === 'run' && G.play.t > 0.6) return pursue(p, carrier || G.O[1]);
      break;
    }
  }
  if (G.qbScramble && dist(p, holder) < 9) pursue(p, holder);
}

// where a player was `ago` seconds back (for late reactions)
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
  const sp = p.spd * 1.07, rx = t.x - p.x, ry = t.y - p.y;
  const a = t.vx * t.vx + t.vy * t.vy - sp * sp, bq = 2 * (rx * t.vx + ry * t.vy), c = rx * rx + ry * ry;
  let T = dd / sp * 0.5;
  const disc = bq * bq - 4 * a * c;
  if (Math.abs(a) > 1e-3 && disc >= 0) { const r1 = (-bq - Math.sqrt(disc)) / (2 * a), r2 = (-bq + Math.sqrt(disc)) / (2 * a); const r = [r1, r2].filter(v => v > 0).sort((x, y) => x - y)[0]; if (r != null) T = r; }
  T = Math.min(T, 1.6);
  steer(p, t.x + t.vx * T, t.y + t.vy * T, 1.07, 0.1);
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
  if (pl.off.type === 'run') { steer(p, G.los - d * 4.5, G.ballY, 0.4); return; }
  const depth = pl.off.fake ? 6.5 : 5.8;
  let tx = G.los - d * depth, ty = G.ballY;
  // slide away from the closest rusher
  let near = null, nd = 4;
  for (const df of G.D) { if (df.engaged) continue; const dd = dist(p, df); if (dd < nd) { nd = dd; near = df; } }
  if (near && pl.t > 0.5) { ty = p.y + Math.sign(p.y - near.y || 1) * 3; tx = p.x - d * 0.5; }
  steer(p, tx, clamp(ty, 4, FIELD_W - 4), pl.t < 0.8 ? 0.85 : 0.6, 0.6);
}

function cpuQB(dt) {
  const pl = G.play, qb = G.O[0];
  if (pl.off.type === 'run' || G.qbScramble) return;
  G.qbThink -= dt; if (G.qbThink > 0) return; G.qbThink = 0.15;
  const minT = pl.off.fake ? 1.2 : pl.off.screen ? 0.55 : 0.7;
  if (pl.t < minT) return;
  const d = dirOf(G.poss);
  let best = null, bs = -1e9;
  for (const s of [1, 2, 3, 4]) {
    const r = G.O[s]; if (!eligible(r)) continue;
    const op = Math.min(6, openness(r));
    const down = d * (r.x - G.los);
    let sc = op + clamp(down, -3, 30) * 0.06 + (r.route && r.route.i >= r.route.pts.length && r.route.end === 'sit' ? 0.3 : 0);
    if (pl.off.screen && s === 1) sc += 3;
    if (down < Math.abs(G.firstDownX - G.los) && G.down >= 3) sc -= 0.8;
    sc += rand(-0.3, 0.3);
    if (sc > bs) { bs = sc; best = r; }
  }
  let pressure = 99; for (const df of G.D) if (!df.engaged && df.down <= 0) pressure = Math.min(pressure, dist(qb, df));
  const need = 3.3 - (pl.t - minT) * 0.9;
  if (best && (bs > need || (pressure < 2.2 && bs > 1.2) || pl.t > 3.6)) { throwTo(qb, best); return; }
  if (pressure < 2.0 && chance(0.25 + (qb.pos === 'QB' && qb.spd > 7.6 ? 0.2 : 0))) G.qbScramble = true;
}

function followRoute(p, dt) {
  const r = p.route, d = dirOf(G.poss);
  if (!r) { p.dvx = p.dvy = 0; return; }
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
  let t = null, td = 7;
  for (const df of G.D) { if (df.engaged || df.down > 0) continue; const ahead = d * (df.x - p.x); if (ahead < -1) continue; const dd = dist(p, df); if (dd < td) { td = dd; t = df; } }
  if (t) steer(p, t.x, t.y, 1, 0.1); else steer(p, p.x + d * 3, p.y, 0.8);
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
    steer(p, t.x, t.y, 1, 0.1); return;
  }
  const foes = G.players.filter(q => q.side !== p.side && q.down <= 0 && !q.engaged);
  let best = 0, bs = -1e9;
  for (let a = -80; a <= 80; a += 16) {
    const r = a * Math.PI / 180;
    const vx = Math.cos(r) * d, vy = Math.sin(r);
    const px = p.x + vx * 3, py = p.y + vy * 3;
    let sc = Math.cos(r) * 2.6;
    for (const f of foes) { const dd = Math.hypot(f.x - px, f.y - py); if (dd < 7) sc -= 2.2 / (dd + 0.4); }
    if (py < 1.5 || py > FIELD_W - 1.5) sc -= 6;
    if (sc > bs) { bs = sc; best = r; }
  }
  const vx = Math.cos(best) * d, vy = Math.sin(best);
  p.dvx = vx * p.spd; p.dvy = vy * p.spd;
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
    if (df.isHuman && Input.axis().m > 0.3) rate *= 1.7;
    if (G.bstate === 'run') rate *= big ? 1.3 : 1.8;
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
      df.vx += (df.y > bl.y ? 0 : 0); addText(df.x, df.y, 'SHED!', '#ff8a8a', 13, 0.6);
      bl.head.vx += 200;
    }
  }
}
function unlink(a, b) { if (a) a.engaged = null; if (b) b.engaged = null; }

// ---------------- movement physics ----------------
function applyMove(p, dt) {
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
  p.anim += p.speedNow * dt * 1.7;
  if (Math.abs(p.vx) > 0.6) p.face.dir = Math.sign(p.vx);
  else if (G.phase !== 'live') p.face.dir = dirOf(p.side) * (p.off ? 1 : 1) * (p.side === G.poss ? 1 : 1);
  headPhysics(p, ax / Math.max(dt, 1e-3), ay / Math.max(dt, 1e-3), dt);
}
function headPhysics(p, ax, ay, dt) {
  const h = p.head;
  const k = 170, c = 7.5;
  h.vx += (-k * h.ox - c * h.vx - clamp(ax, -60, 60) * 2.4) * dt;
  h.vy += (-k * h.oy - c * h.vy - clamp(ay, -60, 60) * 1.0) * dt + Math.sin(p.anim * 2) * Math.min(1, p.speedNow / 4) * 60 * dt;
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
      const push = (0.75 - d) / 2, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }
}

// ---------------- passing ----------------
function throwTo(qb, r, pitch = false) {
  const b = G.ball;
  const spd = pitch ? 13 : 19 + (qb.ovr - 70) * 0.12;
  let tx = r.x, ty = r.y, T = 0.3;
  const sitting = r.route && r.route.end === 'sit' && r.route.i >= r.route.pts.length;
  for (let k = 0; k < 4; k++) {
    T = Math.max(pitch ? 0.3 : 0.35, Math.hypot(tx - qb.x, ty - qb.y) / spd);
    if (sitting) break;
    tx = r.x + r.vx * T; ty = r.y + r.vy * T;
  }
  const len = Math.hypot(tx - qb.x, ty - qb.y);
  if (!pitch) {
    let pressure = false; for (const df of G.D) if (!df.engaged && dist(df, qb) < 2.4) pressure = true;
    let err = (1.4 - (qb.ovr - 60) / 60) * (0.4 + len / 24);
    if (pressure) err += 0.9;
    if (qb.speedNow > 3) err += 0.4;
    const a = rand(0, Math.PI * 2), m = Math.abs(rand(-1, 1) + rand(-1, 1)) / 2 * err * 2;
    tx += Math.cos(a) * m; ty += Math.sin(a) * m;
    stat(qb).att++;
    Sound.throw();
    qb.mouth = 'O'; qb.mouthT = 0.5;
  } else Sound.tone(400, 0.1, 'triangle', 0.08, 200);
  ty = clamp(ty, -0.5, FIELD_W + 0.5);
  b.holder = null;
  b.flight = { sx: qb.x, sy: qb.y, tx, ty, t: 0, T: Math.max(T, len / spd), peak: pitch ? 0.4 : 0.6 + len * 0.1, intended: r, pitch, passer: qb };
  G.bstate = 'air'; G.intended = r;
  G.passPlay = !pitch;
  G.showTarget = true;
  if (!pitch && r.side === G.human) G.humanDef = r;
}

function updateFlight(dt) {
  const b = G.ball, f = b.flight;
  f.t += dt;
  const u = Math.min(1, f.t / f.T);
  b.x = lerp(f.sx, f.tx, u); b.y = lerp(f.sy, f.ty, u);
  b.z = 1.7 + f.peak * 4 * u * (1 - u) - u * 0.6;
  b.spin = (b.spin || 0) + dt * 18;
  if (u >= 1) resolveCatch();
}

function resolveCatch() {
  const b = G.ball, f = b.flight, land = { x: f.tx, y: f.ty };
  b.flight = null; G.showTarget = false;
  if (f.pitch) { b.holder = f.intended; G.bstate = 'run'; G.credit = { p: f.intended, kind: 'rush' }; Sound.catch(); return; }
  const offSide = f.passer.side;
  let rcv = null, rd = 99, def = null, dd = 99;
  for (const p of G.players) {
    if (p.down > 0 || p.engaged) continue;
    const d = dist(p, land);
    if (p.side === offSide) { if (p.slot >= 1 && p.slot <= 4 && d < rd) { rd = d; rcv = p; } }
    else if (d < dd) { dd = d; def = p; }
  }
  const humanDefBonus = def && def.isHuman ? 0.15 : 0;
  const R = 1.45;
  if (def && dd < 1.25 && dd < rd - 0.25) { // defender has inside position
    const pInt = clamp(0.32 + (def.ovr - 75) / 110 + humanDefBonus - (rd < 1 ? 0.12 : 0), 0.08, 0.7);
    if (chance(pInt)) return intercept(def);
    return incomplete(def, 'BROKEN UP!');
  }
  if (rcv && rd < R) {
    let pc = 0.86 + (rcv.ovr - 78) / 140 - (rd > 0.9 ? 0.12 : 0);
    if (def && dd < 1.4) { pc -= 0.28 - (rcv.ovr - def.ovr) / 150; if (chance(0.07 + humanDefBonus * 0.5)) return intercept(def); }
    if (chance(clamp(pc, 0.25, 0.97))) {
      b.holder = rcv; G.bstate = 'run'; Sound.catch(); G.catchX = rcv.x;
      rcv.mouth = 'O'; rcv.mouthT = 0.4;
      stat(f.passer).comp++; G.credit = { p: rcv, kind: 'rec', passer: f.passer };
      addText(rcv.x, rcv.y, pick(['CAUGHT!', 'GOT IT!', 'NICE GRAB!']), '#9cff9c', 15, 0.8);
      if (rcv.side === G.human) G.humanDef = rcv;
      return;
    }
    return incomplete(rcv, 'DROPPED!');
  }
  if (def && dd < 1.0) return chance(0.25) ? intercept(def) : incomplete(def, 'BROKEN UP!');
  incomplete(null, 'INCOMPLETE');
}

function intercept(def) {
  const b = G.ball;
  b.holder = def; G.bstate = 'run'; Sound.bad();
  stat(def).int++; G.tstats[G.poss].to++;
  showBanner('INTERCEPTED!', def.name, '#ff5050', 1.6);
  def.mouth = 'O'; def.mouthT = 0.6;
  G.credit = null; G.crowdHype = 1;
  if (def.side === G.human) G.humanDef = def;
  else G.humanDef = nearestTo(G.players.filter(p => p.side === G.human), def);
}
function incomplete(who, text) {
  const b = G.ball;
  b.loose = null; b.dead = { vx: rand(-3, 3), vy: rand(-2, 2) }; b.z = 1;
  if (who) addText(who.x, who.y, text, '#fff', 16, 1);
  endPlay({ type: 'inc', text });
}

// ---------------- tackles / fumbles / bounds ----------------
function checkTackles() {
  const b = G.ball, car = b.holder;
  if (!car) return;
  let hitters = 0;
  for (const df of G.players) {
    if (df.side === car.side || df.down > 0 || df.engaged || df.stun > 0 || df.tackleCd > 0) continue;
    const reach = 0.85 + (df.dive > 0 ? 0.75 : 0);
    if (dist(df, car) > reach) continue;
    hitters++;
    df.tackleCd = 0.5;
    let p = 0.72 + (df.ovr - car.ovr) / 110;
    if (car.juke > 0) p -= 0.42;
    if (car.spin > 0) p -= 0.48;
    if (df.dive > 0) p += 0.15;
    if (car.pos === 'QB' && G.bstate === 'snap') p += 0.12;
    if (car.pos === 'OL' || car.pos === 'DL') p += 0.2;
    if (car.side === G.human) p += [-0.08, 0, 0.06][G.diff];
    p = clamp(p, 0.1, 0.94);
    if (chance(p)) return tackle(car, df, hitters);
    // broken tackle
    df.down = 0.75; df.downDir = car.x > df.x ? 1 : -1; df.vx *= 0.3; df.vy *= 0.3; df.dive = 0;
    car.vx *= 0.55; car.vy *= 0.55;
    addText(car.x, car.y, car.juke > 0 ? 'JUKED!' : car.spin > 0 ? 'SPUN AWAY!' : 'BROKE IT!', '#ffe14d', 17, 0.9);
    df.head.vx += 300; Sound.boing(); G.crowdHype = Math.min(1, G.crowdHype + 0.4);
  }
}

function tackle(car, df, hitters) {
  const b = G.ball;
  Sound.tackle(); cam.shake = 7;
  car.down = 1.2; car.downDir = dirOf(df.side); car.vx = df.vx * 0.4; car.vy = df.vy * 0.4; car.mouth = 'O'; car.mouthT = 1.2;
  df.down = 0.9; df.downDir = car.downDir; df.dive = 0;
  car.head.vx += rand(-400, 400); car.head.vy -= 200;
  addStars(car.x, car.y);
  const st = stat(df);
  // fumble?
  if (G.bstate === 'run' && chance(0.022 + (hitters > 1 ? 0.02 : 0))) {
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
  G.phase = 'dead'; G.deadT = 1.6; G.showTarget = false;
  Sound.whistle();
  for (const p of G.players) { p.throwKey = 0; p.engaged = null; }
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
    if (res.type === 'td' && cs === off) { G.score[off] += 2; showBanner('TWO POINTS!', '', '#9cff9c', 1.8); Sound.td(); }
    else showBanner('NO GOOD', '2-point try fails', '#ff6040', 1.5);
    G.twoPt = false; G.patSide = null;
    next = { drive: 1 - off, own: 25 };
  } else if (res.type === 'td') {
    G.score[cs] += 6; G.deadT = 2.6;
    showBanner('TOUCHDOWN!', `${car.name} • ${G.teams[cs].city} ${G.teams[cs].name}`, cs === G.human ? '#ffd23f' : '#ff6040', 2.6);
    Sound.td(); G.crowdHype = 1.5; stat(car).td++;
    if (G.credit && G.credit.passer && cs === off) stat(G.credit.passer).td++;
    for (let i = 0; i < 25; i++) G.fx.push({ kind: 'star', x: car.x + rand(-4, 4), y: car.y + rand(-4, 4), z: rand(0, 40), vz: rand(20, 60), life: 1.4, max: 1.4 });
    next = { pat: cs };
  } else if (res.type === 'inc') {
    showBanner('INCOMPLETE', '', '#ffffff', 0.9);
    next = advanceDown(G.los, false);
  } else if (cs !== off) { // takeaway
    const cd = dirOf(cs);
    if (cd * (x - ownGoal(cs)) <= 0) { x = ownGoal(cs) + cd * 20; addText(x, MID, 'TOUCHBACK', '#fff', 18, 1.2); }
    if (res.type !== 'fumble') showBanner('TURNOVER!', `${G.teams[cs].name} ball`, '#ff9a3d', 1.4);
    next = { drive: cs, x };
  } else if (d * (x - ownGoal(off)) <= 0) {
    G.score[1 - off] += 2; showBanner('SAFETY!', '+2', '#ff6040', 1.8);
    next = { drive: 1 - off, own: 35 };
  } else {
    G.ballY = clamp(res.y != null ? res.y : G.ballY, 20, FIELD_W - 20);
    next = advanceDown(x, true);
    if (res.type !== 'oob') G.runoff = 9;
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
  if (G.runoff && G.clock > 0) { G.clock = Math.max(0, G.clock - G.runoff); G.runoff = 0; }
  // overtime is sudden death
  if (G.quarter >= 5 && G.score[0] !== G.score[1]) return gameOver();
  if (n && n.pat != null) { G.patSide = n.pat; G.poss = n.pat; G.los = goalX(n.pat) - dirOf(n.pat) * 3; G.ballY = MID; return toPlayCall(); }
  if (n && n.drive != null) {
    setDrive(n.drive, n.own != null ? ownGoal(n.drive) + dirOf(n.drive) * n.own : clamp(n.x, 11, 109));
  }
  if (G.clock <= 0 && endQuarter()) return;
  toPlayCall();
}

function endQuarter() {
  if (G.quarter === 2) {
    G.quarter = 3; G.clock = G.qtrLen;
    setDrive(1 - G.firstPoss, ownGoal(1 - G.firstPoss) + dirOf(1 - G.firstPoss) * 25);
    showBanner('HALFTIME', `${G.teams[1].id} ${G.score[1]}  -  ${G.teams[0].id} ${G.score[0]}`, '#fff', 2.5);
  } else if (G.quarter >= 4) {
    if (G.quarter === 4 && G.score[0] === G.score[1]) {
      G.quarter = 5; G.clock = G.qtrLen;
      const s = chance(0.5) ? 0 : 1;
      setDrive(s, ownGoal(s) + dirOf(s) * 25);
      showBanner('OVERTIME!', `Next score wins • ${G.teams[s].name} ball`, '#ffd23f', 2.5);
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
function doKick(kind) {
  const s = G.poss, d = dirOf(s);
  setupPlay(OFF_PLAYS[2], DEF_PLAYS[0], true);
  const kicker = G.O[0];
  kicker.x = G.los - d * (kind === 'punt' ? 10 : 7); kicker.y = G.ballY;
  G.ball.holder = null;
  const k = { kind, t: 0, side: s };
  if (kind === 'punt') {
    const net = rand(36, 49);
    k.land = G.los + d * net; k.T = 2.3; k.peak = 14;
    k.ty = clamp(G.ballY + rand(-10, 10), 6, FIELD_W - 6);
  } else {
    const yds = kind === 'xp' ? 33 : Math.abs(goalX(s) - G.los) + 17;
    const pGood = kind === 'xp' ? 0.94 : clamp(1.02 - Math.max(0, yds - 22) * 0.017, 0.05, 0.98);
    k.good = chance(pGood); k.yds = Math.round(yds);
    k.land = goalX(s) + d * 10; k.T = 1.6; k.peak = 9;
    k.ty = MID + (k.good ? rand(-1.5, 1.5) : pick([-1, 1]) * rand(4.5, 8));
  }
  k.sx = kicker.x; k.sy = kicker.y;
  G.kick = k; G.phase = 'kick';
  G.ball.x = k.sx; G.ball.y = k.sy; G.ball.z = 0;
  Sound.tone(140, 0.15, 'square', 0.15, -40);
  if (kind === 'fg') addText(G.los, G.ballY - 6, `${k.yds} YARD TRY`, '#fff', 18, 1.5);
}
function updateKick(dt) {
  const k = G.kick, b = G.ball;
  k.t += dt;
  const u = Math.min(1, k.t / k.T);
  b.x = lerp(k.sx, k.land, u); b.y = lerp(k.sy, k.ty, u);
  b.z = k.peak * 4 * u * (1 - u) + (k.kind !== 'punt' ? u * 3.5 : 0); b.spin = (b.spin || 0) + dt * 14;
  if (u < 1) return;
  if (k.done) { k.wait -= dt; if (k.wait <= 0) afterPlay(); return; }
  k.done = true; k.wait = 1.6;
  const s = k.side, d = dirOf(s);
  if (k.kind === 'punt') {
    let x = k.land;
    if (d * (x - goalX(s)) >= 0) { x = goalX(s) - d * 20; showBanner('TOUCHBACK', '', '#fff', 1.2); }
    else showBanner('PUNT', `${Math.round(Math.abs(k.land - k.sx))} yards`, '#fff', 1.2);
    G.next = { drive: 1 - s, x }; G.runoff = 6;
  } else if (k.kind === 'fg') {
    if (k.good) { G.score[s] += 3; showBanner("IT'S GOOD!", `${k.yds}-yard field goal`, '#9cff9c', 1.8); Sound.td(); G.next = { drive: 1 - s, own: 25 }; }
    else { showBanner('NO GOOD!', `${k.yds}-yard try is wide`, '#ff6040', 1.6); Sound.bad(); G.next = { drive: 1 - s, x: d * (G.los - (goalX(s) - d * 20)) > 0 ? goalX(s) - d * 20 : G.los }; }
    G.runoff = 5;
  } else { // xp
    if (k.good) { G.score[s] += 1; showBanner('EXTRA POINT GOOD', '', '#9cff9c', 1.2); Sound.catch(); }
    else { showBanner('XP MISSED!', '', '#ff6040', 1.3); Sound.bad(); }
    G.patSide = null; G.next = { drive: 1 - s, own: 25 };
  }
}

function updateBallPhysicsDead(dt) {
  const b = G.ball; if (!b || !b.dead || b.holder) return;
  b.x += b.dead.vx * dt; b.y += b.dead.vy * dt; b.dead.vx *= 0.94; b.dead.vy *= 0.94;
  b.z = Math.max(0, b.z - dt * 4);
}

// ---------------- fx / camera / hints ----------------
function addText(x, y, text, color, size = 18, life = 1) { G.fx.push({ kind: 'text', x, y, text, color, size, z: 40, vz: 30, life, max: life }); }
function addDust(x, y, n) { for (let i = 0; i < n; i++) G.fx.push({ kind: 'dust', x: x + rand(-0.6, 0.6), y: y + rand(-0.6, 0.6), z: 0, vz: rand(5, 20), r: rand(3, 6), life: 0.5, max: 0.5 }); }
function addStars(x, y) { for (let i = 0; i < 5; i++) G.fx.push({ kind: 'star', x: x + rand(-1, 1), y: y + rand(-1, 1), z: 20 + rand(0, 20), vz: rand(20, 50), life: 0.8, max: 0.8 }); addDust(x, y, 6); }
function showBanner(text, sub, color, dur) { G.banner = { text, sub, color, t: 0, dur }; }
function updateFx(dt) {
  for (const f of G.fx) { f.life -= dt; f.z += f.vz * dt; }
  G.fx = G.fx.filter(f => f.life > 0);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  cam.shake *= Math.pow(0.02, dt);
}
function updateCamera(dt) {
  if (!G.teams) return;
  const b = G.ball;
  let tx = G.los != null ? G.los + dirOf(G.poss) * 8 : 60;
  if (G.phase === 'live' || G.phase === 'dead' || G.phase === 'kick') {
    if (b && b.holder) tx = b.holder.x + dirOf(b.holder.side) * 6;
    else if (b) tx = b.x;
  }
  const half = CW / 2 / PX;
  tx = clamp(tx, half - 5, 125 - half);
  cam.x = lerp(cam.x, tx, 1 - Math.exp(-dt * 3.5));
}
function updateHint() {
  if (!G.teams) return;
  const humanOff = G.poss === G.human;
  const b = G.ball;
  if (G.phase === 'presnap') G.hint = humanOff ? (G.play.off.type === 'run' ? 'SPACE = snap  (run play: you take the handoff)' : 'SPACE = snap  •  then 1-4 or click a receiver to throw') : 'Get ready…  Q = switch player';
  else if (G.phase === 'live') {
    const h = G.humanPlayer;
    if (h && b.holder === h && h.side === G.human) G.hint = humanCanThrow() ? '1 2 3 4 / click = throw  •  WASD move  •  run past the line to scramble' : 'WASD move  •  SHIFT sprint  •  E juke  •  F spin';
    else if (h && h.side !== G.poss || (b.holder && b.holder.side !== G.human)) G.hint = 'WASD move  •  SHIFT sprint  •  SPACE dive  •  Q switch player';
    else G.hint = 'Steer to the ball marker to catch it!';
  } else G.hint = '';
}
