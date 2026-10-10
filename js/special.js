// ---- Special teams (kickoffs, onside kicks, punt returns, fakes) + clock tools (timeouts, spike, audible) ----

// ======== kickoffs & returns ========
// Kicking team = its defense players (coverage team). Receiving team = its offense players (return team).
// During a return the receiving team is G.poss, so the normal "run" logic (blocking / tackling) just works.
function startKickoff(k, from = 35) {
  G.sitOut = false;
  G.special = null; G.patSide = null; G.twoPt = false;
  G.kickoffSide = k; G.kickFrom = from; G.poss = 1 - k;
  G.phase = 'playcall'; G.flags = []; G.playClock = 0; G.pendingRunoff = 0; G.koPending = true;
  setupReturn('ko', k);
  if (typeof SaveGame !== 'undefined') SaveGame.save();
  if (isHumanSide(k) && !G.demo) G.hooks.onPlayCall({ mode: 'kickoff', side: k });
  else setTimeout(() => { if (G.phase === 'playcall' && G.kickoffSide === k) chooseKickoff(cpuKickoffCall(k)); }, 900);
}
function cpuKickoffCall(k) {
  const behind = G.score[1 - k] - G.score[k];
  return (G.quarter >= 4 && G.clock < 150 && behind > 0 && behind <= 16) ? 'onside' : 'ko';
}
// the human (or CPU) picked Kickoff / Onside
function chooseKickoff(type) {
  const k = G.kickoffSide;
  setupReturn(type === 'onside' ? 'onside' : 'ko', k);
  startKickMeter(type === 'onside' ? 'onside' : 'ko', k);
}

function setupReturn(kind, k) {
  const r = 1 - k, dk = dirOf(k);
  const spot = kind === 'punt' ? G.los : ownGoal(k) + dk * (G.kickFrom || 35);
  G.poss = r;
  const O = G.teams[r].off.map((t, i) => makePlayer(r, true, i, t));
  const D = G.teams[k].def.map((t, i) => makePlayer(k, false, i, t));
  const at = (p, x, y) => { p.x = x; p.y = clamp(y, 2, FIELD_W - 2); p.hx = p.x; p.hy = p.y; p.role = 'ret'; p.face.dir = dirOf(p.side); };
  // the kicker / punter joins the coverage team
  const kk = kickerOf(k, kind === 'punt' ? 'punt' : 'fg');
  Object.assign(D[1], { name: kk.name, num: kk.num, ovr: kk.ovr, pos: kind === 'punt' ? 'P' : 'K', cap: false, xf: null });
  if (kk.skin != null) D[1].face.skin = kk.skin;
  if (kind === 'punt') {
    D.forEach((p, i) => at(p, spot - dk * 0.8, MID + (i - 3.5) * 3.2));
    at(D[1], spot - dk * 12, MID);
    at(O[1], spot + dk * 44, MID);           // returner deep
    [0, 2, 3, 4, 5, 6, 7].forEach((s, j) => at(O[s], spot + dk * (j < 5 ? 1.4 : 8), MID + (j - 3) * 4.5));
  } else {
    D.forEach((p, i) => at(p, spot - dk * 1, 4 + i * (FIELD_W - 8) / 7));
    at(D[1], spot - dk * 6, MID);
    const rd = dirOf(r), rg = ownGoal(r);
    if (kind === 'onside') {
      [0, 2, 3, 4, 5, 6, 7].forEach((s, j) => at(O[s], spot + dk * 11, 6 + j * (FIELD_W - 12) / 6));
      at(O[1], rg + rd * 25, MID);
    } else {
      at(O[1], rg + rd * 3, MID);                                   // returner
      at(O[2], rg + rd * 10, MID - 9);
      [5, 6, 7].forEach((s, j) => at(O[s], rg + rd * 32, MID + (j - 1) * 9));
      [0, 3, 4].forEach((s, j) => at(O[s], rg + rd * 22, MID + (j - 1) * 12));
    }
  }
  D.forEach(p => { p.assign = { type: 'cover' }; });
  G.players = O.concat(D); G.O = O; G.D = D;
  G.play = { off: { type: 'ret', name: kind === 'punt' ? 'Punt Return' : 'Kick Return', key: 'ret' }, def: { name: 'Coverage', key: 'cover', a: [] }, t: 0 };
  G.ball = { x: kind === 'punt' ? D[1].x : spot, y: MID, z: 0.2, holder: null, flight: null, loose: null };
  G.bstate = 'snap'; G.los = kind === 'punt' ? G.los : spot; G.ballY = MID;
  G.refs = [{ x: spot - dk * 10, y: 3, face: dk, anim: 0, throwT: 0 }, { x: spot + dk * 45, y: FIELD_W - 3, face: -dk, anim: 0, throwT: 0 }];
  if (G.versus) { G.hd[k] = D[3]; G.hd[r] = null; G.humanDef = G.hd[G.human]; } else G.humanDef = D[3];
  updateHuman();
}

function startKickMeter(kind, k) {
  const kk = kickerOf(k, kind === 'punt' ? 'punt' : 'fg');
  G.km = { kind, yds: 0, kk, stage: 0, t: 0, power: 0, aim: 0, side: k, rateP: 0.7 + (90 - kk.ovr) * 0.015, rateA: 0.6 + (90 - kk.ovr) * 0.015, need: 0, tol: 0.35 };
  if (isHumanSide(k) && !G.demo && !(G.sitOut && kind === 'punt')) { G.phase = 'kickmeter'; G.km.wait = 0.35; return; }
  // CPU kickoffs: mostly land in the field so you get to return them, sometimes a deep boot
  G.km.power = kind === 'onside' ? rand(0.3, 0.8) : kind === 'ko' ? (chance(0.7) ? rand(0.15, 0.68) : rand(0.7, 0.98)) : rand(0.6, 0.98); G.km.aim = rand(-0.4, 0.4);
  G.phase = 'kickmeter'; G.km.cpuT = 0.8; G.km.stage = 3; // short pause so you can see the lineup
}

// called by the kick meter (or the CPU) — the ball goes up, the return team waits for it
function launchReturnKick() {
  const km = G.km, k = km.side, dk = dirOf(k), r = 1 - k, kicker = G.D[1];
  const b = G.ball, f = { sx: b.x, sy: b.y, t: 0, kick: km.kind, intended: G.O[1], passer: kicker };
  if (km.kind === 'ko') {
    const dist = 46 + km.power * (22 + (km.kk.ovr - 60) * 0.25);
    f.tx = b.x + dk * dist; f.ty = clamp(MID + km.aim * 20, 3, FIELD_W - 3); f.T = 2.5; f.peak = 13;
    f.touchback = dirOf(r) * (ownGoal(r) - f.tx) > 4; // deep in the end zone
  } else if (km.kind === 'onside') {
    const dist = 9 + km.power * 7;
    f.tx = b.x + dk * dist; f.ty = clamp(MID + km.aim * 18, 2, FIELD_W - 2); f.T = 0.85; f.peak = 1.2; f.onside = true;
  } else { // punt
    let dist = 30 + km.power * (18 + (km.kk.ovr - 60) * 0.35);
    f.shank = Math.abs(km.aim) > 0.75; if (f.shank) dist *= 0.55;
    f.tx = G.los + dk * dist; f.ty = G.ballY + km.aim * 24;
    f.oob = f.ty < 0 || f.ty > FIELD_W;
    if (f.oob) { const q = (f.ty < 0 ? -G.ballY : FIELD_W - G.ballY) / (f.ty - G.ballY); f.tx = G.los + dk * dist * q; f.ty = clamp(f.ty, -0.5, FIELD_W + 0.5); }
    f.touchback = dk * (f.tx - goalX(k)) >= 0;
    f.T = 1.5 + km.power * 1.4; f.peak = 9 + km.power * 10;
  }
  b.flight = f; G.special = km.kind; G.bstate = 'air'; G.koPending = false;
  G.lastTackler = null; G.lastResult = null; Replay.begin();
  G.phase = 'live'; G.play.t = 0;
  kicker.throwAnim = 0.3; kicker.vx = dk * 4;
  Sound.tone(140, 0.15, 'square', 0.15, -40); Sound.tone(90, 0.12, 'sine', 0.2);
  G.showTarget = true;
  if (f.onside) addText(b.x, b.y, 'ONSIDE!', '#ffd23f', 24, 1);
}

// ball comes down on a kick
function catchKick(f) {
  const b = G.ball, r = G.poss, k = 1 - r;
  G.showTarget = false;
  if (f.oob) return endPlay({ type: 'kickdead', x: clamp(f.tx, 11, 109), why: 'OUT OF BOUNDS' });
  if (f.touchback) return endPlay({ type: 'kickdead', tb: true });
  if (f.onside) { b.loose = { vx: dirOf(k) * 3, vy: rand(-2, 2), t: 0 }; b.x = f.tx; b.y = f.ty; G.bstate = 'loose'; return; }
  // closest return man grabs it
  let rt = null, rd = 99;
  for (const p of G.O) { const d = Math.hypot(p.x - f.tx, p.y - f.ty); if (d < rd && p.down <= 0) { rd = d; rt = p; } }
  if (!rt || rd > 3) { b.loose = { vx: dirOf(k) * 2, vy: rand(-1, 1), t: 0 }; b.x = f.tx; b.y = f.ty; G.bstate = 'loose'; addText(f.tx, f.ty, 'LOOSE BALL!', '#ff9a3d', 20, 1); return; }
  // CPU returner calls a fair catch on punts when the coverage is right there
  const cover = Math.min(...G.D.map(p => dist(p, rt)));
  if (f.kick === 'punt' && !isHumanSide(rt.side) && cover < 3.5) { addText(rt.x, rt.y, 'FAIR CATCH', '#fff', 18, 1); return endPlay({ type: 'kickdead', x: rt.x, why: 'FAIR CATCH' }); }
  if (chance(0.02)) { b.loose = { vx: rand(-2, 2), vy: rand(-2, 2), t: 0 }; b.x = rt.x; b.y = rt.y; G.bstate = 'loose'; addText(rt.x, rt.y, 'MUFFED IT!', '#ff6040', 22, 1); return; }
  b.holder = rt; G.bstate = 'run'; G.credit = null; G.retStart = rt.x;
  Sound.catch(); addText(rt.x, rt.y, 'RETURN!', '#9cff9c', 18, 0.8);
  if (isHumanSide(rt.side)) setHD(rt.side, rt);
}

// AI while a kick is in the air
function aiKickFlight(p) {
  const f = G.ball.flight;
  if (p.off) {
    if (p === f.intended) return steer(p, f.tx, f.ty, 1, 0.3);
    if (f.onside) return steer(p, f.tx, f.ty, 1.05, 0.2);
    // set up a wall in front of the returner
    let t = null, td = 30;
    for (const d of G.D) { const dd = dist(p, d); if (dd < td && !d.engaged) { td = dd; t = d; } }
    if (t) return steer(p, lerp(t.x, f.tx, 0.35), lerp(t.y, f.ty, 0.35), 0.95, 0.3);
    return steer(p, f.tx, f.ty, 0.7);
  }
  // coverage: sprint down in lanes
  if (p.pos === 'K' || p.pos === 'P') return steer(p, f.tx - dirOf(p.side) * 15, MID, 0.7);
  const lane = lerp(p.hy, f.ty, 0.55);
  steer(p, f.tx - dirOf(p.side) * (f.onside ? 0 : 3), f.onside ? f.ty : lane, f.onside ? 1.05 : 1, 0.5);
}

// end of a kick / return play
function endReturn(res) {
  const r = G.poss, k = 1 - r, kind = G.special, rd = dirOf(r);
  const car = res.carrier, cs = car ? car.side : r;
  let x = res.x != null ? res.x : G.ball.x;
  G.special = null;
  if (res.type === 'td') {
    G.score[cs] += 6; G.deadT = isHumanSide(cs) ? 3.8 : 2.5;
    if (isHumanSide(cs)) { G.cellyGuy = car; car.down = 0; car.dive = 0; } else { car.down = 0; car.dive = 0; Celly.cpu(car); }
    showBanner(cs === r ? (kind === 'punt' ? 'PUNT RETURN TD!' : 'KICK RETURN TD!') : 'TOUCHDOWN!', `${car.name} • ${G.teams[cs].name}`, cs === G.human ? '#ffd23f' : '#ff6040', 2.6);
    Sound.td(); G.crowdHype = 1.5; stat(car).td++; G.slowmo = 0.9;
    for (const q of G.players) if (q.side === cs) q.celebrate = 2.6;
    addPbp(`${lastName(car.name)} takes the ${kind === 'punt' ? 'punt' : 'kick'} back for a TOUCHDOWN!`, 'Special teams!'); G.lastResult = { big: true, type: 'td' };
    G.next = { pat: cs }; return;
  }
  if (res.type === 'kickdead') {
    if (res.tb) { x = ownGoal(r) + rd * (kind === 'punt' ? 20 : 25); showBanner('TOUCHBACK', '', '#fff', 1.2); addPbp(`${kind === 'punt' ? 'Punt' : 'Kickoff'} goes for a touchback.`); }
    else showBanner(res.why || 'DOWN', '', '#fff', 1.1);
    G.next = { drive: r, x }; return;
  }
  if (cs === k) { // kicking team got it back (onside or fumble)
    showBanner(kind === 'onside' ? 'ONSIDE RECOVERED!' : 'FUMBLE RECOVERED!', `${G.teams[k].name} ball!`, k === G.human ? '#9cff9c' : '#ff6040', 1.8);
    G.next = { drive: k, x: clamp(x, 11, 109) }; return;
  }
  if (rd * (x - ownGoal(r)) <= 0) x = ownGoal(r) + rd * 20; // downed in own end zone
  const ret = G.retStart != null ? Math.round(rd * (x - G.retStart)) : 0;
  if (ret > 0) addText(x, MID, `${ret} YD RETURN`, '#9cff9c', 20, 1.2);
  if (car && cs === r) addPbp(`${lastName(car.name)} ${ret > 0 ? `returns the ${kind === 'punt' ? 'punt' : 'kick'} ${ret} yards` : `fields the ${kind === 'punt' ? 'punt' : 'kick'} and gets stopped right there`}${G.lastTackler ? `, tackled by ${lastName(G.lastTackler.name)}` : ''}.`);
  if (kind === 'onside' && res.type !== 'tackle') showBanner('RECOVERED!', `${G.teams[r].name} ball`, '#fff', 1.3);
  G.next = { drive: r, x: clamp(x, 11, 109) };
}

// ======== fakes ========
const FAKE_PLAYS = [
  { key: 'fakepunt', name: 'Fake Punt', type: 'pass', special: true, fakeKind: 'punt', desc: 'Punter throws it! Defense won\'t see it coming.',
    routes: { 2: { r: [[5, 0], [5, 6]], end: 'sit' }, 3: { r: [[8, 0], [8, -8]], end: 'go' }, 4: { r: [[2, 0], [2, -10]], end: 'go' }, 1: { r: [[1, 5], [3, 10]], end: 'sit' } } },
  { key: 'fakefg', name: 'Fake FG', type: 'pass', special: true, fakeKind: 'fg', desc: 'Holder pops up and throws.',
    routes: { 2: { r: [[5, 0], [4, 0]], end: 'sit' }, 3: { r: [[10, 0], [20, 9]], end: 'go' }, 4: { r: [[1, 4], [2, 9]], end: 'sit' }, 1: { r: [[1, -3], [3, -6]], end: 'sit' } } }
];
const KICK_RUSH = { key: 'kickrush', name: 'Kick Block', a: ['rush', 'rush', 'rush', 'rush', 'rush', 'zone:5:-8', 'zone:35:mid', 'zone:6:8'] };
function setupFake(play) {
  setupPlay(play, KICK_RUSH);
  const qb = G.O[0], d = dirOf(G.poss);
  const kk = kickerOf(G.poss, play.fakeKind === 'punt' ? 'punt' : 'fg');
  if (play.fakeKind === 'punt') { Object.assign(qb, { name: kk.name, num: kk.num, ovr: Math.min(qb.ovr, kk.ovr - 5), pos: 'P', cap: false, xf: null, thp: null, tha: null }); if (kk.skin != null) qb.face.skin = kk.skin; qb.x = G.los - d * 9; qb.hx = qb.x; }
  else { qb.x = G.los - d * 7; qb.hx = qb.x; qb.ovr = Math.min(qb.ovr, 72); }
  G.fake = play.fakeKind;
}

// ======== clock tools ========
function callTimeout(side) {
  if (!G.timeouts || G.timeouts[side] <= 0) return false;
  if (!(G.phase === 'playcall' || G.phase === 'presnap')) return false;
  G.timeouts[side]--; G.pendingRunoff = 0; G.timeoutCalled = true;
  showBanner('TIMEOUT', `${G.teams[side].name} • ${G.timeouts[side]} left`, '#fff', 1.4);
  Sound.whistle();
  if (side === G.poss) G.playClock = G.playClock > 0 ? (G.mode === 'mobile' ? 25 : 20) : 0;
  return true;
}
// CPU uses timeouts to save clock when it's behind late in a half
function cpuTimeoutCheck() {
  const cpu = 1 - G.human;
  if (G.versus || G.human < 0 || !G.pendingRunoff || G.timeouts[cpu] <= 0) return;
  if (!(G.quarter === 2 || G.quarter >= 4) || G.clock > 120) return;
  const behind = G.score[G.human] - G.score[cpu];
  if ((G.poss === cpu && behind >= 0) || (G.poss === G.human && behind > 0 && behind <= 16)) callTimeout(cpu);
}
// the clock already ran live during the huddle (see update()); snapping or spiking just stops it running
function burnHuddleClock() {
  G.pendingRunoff = 0;
}
function spikeBall() {
  if (!(G.phase === 'playcall' || G.phase === 'presnap') || !isHumanSide(G.poss) || G.down >= 4 || G.patSide != null) return;
  burnHuddleClock();
  G.clock = Math.max(0, G.clock - 1);
  showBanner('SPIKED!', 'Clock stopped', '#fff', 1.1); Sound.tackle();
  G.down++;
  G.next = null;
  G.phase = 'dead'; G.deadT = 0.9; G.ball = G.ball || { x: G.los, y: G.ballY, z: 0 };
  if (G.ball) { G.ball.holder = null; G.ball.x = G.los - dirOf(G.poss) * 1; G.ball.dead = { vx: 0, vy: 0 }; G.ball.bounce = 0.7; }
}
function audible() {
  if (G.phase !== 'presnap') return;
  Sound.click();
  G.phase = 'playcall';
  G.hooks.onPlayCall(playCallCtx());
}
// hot route: press 1-4 (or tap a receiver) before the snap to change his route
const HOT = [
  ['GO', [[40, 0]], 'go'], ['SLANT', [[2, 0], [9, -7]], 'go'], ['OUT', [[6, 0], [6, 6]], 'sit'], ['IN', [[7, 0], [7, -10]], 'go'],
  ['CURL', [[12, 0], [10, -1]], 'sit'], ['POST', [[12, 0], [30, -10]], 'go'], ['CORNER', [[10, 0], [20, 9]], 'go']
];
const HOT_RB = [['FLAT', [[1, 5], [3, 10]], 'sit'], ['WHEEL', [[1, 5], [25, 8]], 'go'], ['CHECK', [[2, -2], [4, -3]], 'sit'], ['BLOCK', null, 'block']];
function hotRoute(slot) {
  if (G.phase !== 'presnap' || G.poss !== G.human || G.play.off.type !== 'pass') return;
  const p = G.O[slot]; if (!p) return;
  const list = slot === 1 ? HOT_RB : HOT;
  const i = ((p.hotI == null ? -1 : p.hotI) + 1) % list.length;
  p.hotI = i; const [name, steps, end] = list[i];
  p.hot = name;
  const d = dirOf(G.poss), by = G.ballY, out = Math.sign(p.hy - by) || (p.hy < MID ? -1 : 1);
  if (!steps) { p.role = 'passblock'; p.route = null; }
  else {
    const deepX = goalX(G.poss) + d * 7.5;
    p.role = 'route';
    p.route = { pts: steps.map(([dd, oo]) => { const x = p.hx + d * dd; return { x: d > 0 ? Math.min(x, deepX) : Math.max(x, deepX), y: clamp(p.hy + out * oo, 1.2, FIELD_W - 1.2) }; }), end, i: 0 };
  }
  Sound.click();
  addText(p.x, p.y, name, '#ffe14d', 16, 0.8);
}
