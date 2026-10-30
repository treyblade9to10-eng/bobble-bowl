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
  if (isHumanSide(k) && !G.demo && !coachCalls()) G.hooks.onPlayCall({ mode: 'kickoff', side: k });
  else {
    if (isHumanSide(k) && !G.demo) coachSays(cpuKickoffCall(k) === 'onside' ? 'Onside Kick' : 'Kickoff'); // career: the coach's call
    setTimeout(() => { if (G.phase === 'playcall' && G.kickoffSide === k) chooseKickoff(cpuKickoffCall(k)); }, 900);
  }
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
  G.poss = r; G.fair = null;
  const O = G.teams[r].off.map((t, i) => makePlayer(r, true, i, t));
  const D = G.teams[k].def.map((t, i) => makePlayer(k, false, i, t));
  const at = (p, x, y) => { p.x = x; p.y = clamp(y, 2, FIELD_W - 2); p.hx = p.x; p.hy = p.y; p.role = 'ret'; p.face.dir = dirOf(p.side); };
  // the kicker / punter joins the coverage team
  const kk = kickerOf(k, kind === 'punt' ? 'punt' : 'fg');
  Object.assign(D[1], { name: kk.name, num: kk.num, ovr: kk.ovr, pos: kind === 'punt' ? 'P' : 'K', cap: false, xf: null, rt: null });
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
  G.km = { kind, yds: 0, kk, stage: 0, t: 0, power: 0, aim: 0, side: k, rateP: 0.7 + (90 - kk.ka) * 0.015, rateA: 0.6 + (90 - kk.ka) * 0.015, need: 0, tol: 0.35 };
  if (kind === 'punt') { G.km.live = puntSetup(k, kk); updateHuman(); } // live punt: snap, protection, rush, gunners (below)
  if (isHumanSide(k) && !G.demo && !(G.sitOut && kind === 'punt') && !autoKick()) { G.phase = 'kickmeter'; G.km.wait = 0.35; return; }
  // CPU kickoffs: mostly land in the field so you get to return them, sometimes a deep boot
  G.km.power = kind === 'onside' ? rand(0.3, 0.8) : kind === 'ko' ? (chance(0.7) ? rand(0.15, 0.68) : rand(0.7, 0.98)) : rand(0.6, 0.98); G.km.aim = rand(-0.4, 0.4);
  if (isHumanSide(k) && autoKick() && kind !== 'onside') { const q = clamp((kk.ka - 60) / 35, 0, 1); G.km.power = clamp(rand(0.55, 0.85) + q * 0.15, 0.4, 1); G.km.aim = rand(-0.4, 0.4) * (1.2 - q * 0.6); } // Coach Mode: your kicker's rating decides it
  G.phase = 'kickmeter'; G.km.cpuT = 0.8; G.km.stage = 3; // short pause so you can see the lineup
  if (G.km.live) { G.km.cpuT = Infinity; G.km.locked = true; } // puntLive snaps it and kicks it
}

// called by the kick meter (or the CPU) — the ball goes up, the return team waits for it
function launchReturnKick() {
  const km = G.km, k = km.side, dk = dirOf(k), r = 1 - k, kicker = G.D[1];
  const b = G.ball, f = { sx: b.x, sy: b.y, t: 0, kick: km.kind, intended: G.O[1], passer: kicker };
  if (km.kind === 'ko') {
    const dist = 46 + km.power * (22 + (km.kk.kp - 60) * 0.25);
    f.tx = b.x + dk * dist; f.ty = clamp(MID + km.aim * 20, 3, FIELD_W - 3); f.T = 2.5; f.peak = 13;
    f.touchback = dirOf(r) * (ownGoal(r) - f.tx) > 4; // deep in the end zone
  } else if (km.kind === 'onside') {
    const dist = 9 + km.power * 7;
    f.tx = b.x + dk * dist; f.ty = clamp(MID + km.aim * 18, 2, FIELD_W - 2); f.T = 0.85; f.peak = 1.2; f.onside = true;
  } else { // punt
    let dist = 30 + km.power * (18 + (km.kk.kp - 60) * 0.35);
    f.shank = Math.abs(km.aim) > 0.75; if (f.shank) dist *= 0.55;
    f.tx = G.los + dk * dist; f.ty = G.ballY + km.aim * 24;
    f.oob = f.ty < 0 || f.ty > FIELD_W;
    if (f.oob) { const q = (f.ty < 0 ? -G.ballY : FIELD_W - G.ballY) / (f.ty - G.ballY); f.tx = G.los + dk * dist * q; f.ty = clamp(f.ty, -0.5, FIELD_W + 0.5); }
    f.touchback = dk * (f.tx - goalX(k)) >= 0;
    f.T = 1.5 + km.power * 1.4; f.peak = 9 + km.power * 10; f.z0 = 0.5; // off his foot, not out of a QB's hand
  }
  const live = km.live && km.live.snapT != null; // a live punt already started the replay at the snap
  b.flight = f; b.holder = null; G.special = km.kind; G.bstate = 'air'; G.koPending = false;
  G.lastTackler = null; G.lastResult = null; if (!live) Replay.begin();
  G.phase = 'live'; G.play.t = 0;
  for (const p of G.players) p.engaged = null;
  if (kicker.kickT == null) kicker.kickT = 0.16; kicker.vx = dk * (live ? 2 : 4);
  if (live && isHumanSide(k) && !(G.lock && lockedGuy())) setHD(k, nearestTo(G.D.filter(p => p.pr === 'gun'), { x: f.tx, y: f.ty }) || kicker); // you: a gunner, go get him
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
  if (!rt || rd > 3) { // nobody under it: a punt bounces around until someone downs it (puntRoll / puntTouch)
    b.loose = { vx: dirOf(k) * 2, vy: rand(-1, 1), t: 0, punt: f.kick === 'punt' }; b.x = f.tx; b.y = f.ty; G.bstate = 'loose';
    if (f.kick !== 'punt') addText(f.tx, f.ty, 'LOOSE BALL!', '#ff9a3d', 20, 1); return;
  }
  // fair catch: he waved for it (you, or the CPU when the gunners are on him), or a CPU guy with somebody right in his face
  const cover = Math.min(...G.D.map(p => dist(p, rt)));
  if (f.kick === 'punt' && (G.fair === rt || ((!isHumanSide(rt.side) || coachOn()) && cover < 2))) {
    if (G.fair !== rt) addText(rt.x, rt.y, 'FAIR CATCH', '#fff', 18, 1);
    rt.fair = 0; Sound.catch(); addPbp(`${lastName(rt.name)} calls for a fair catch.`);
    return endPlay({ type: 'kickdead', x: rt.x, why: 'FAIR CATCH' });
  }
  if (chance(0.02)) { b.loose = { vx: rand(-2, 2), vy: rand(-2, 2), t: 0 }; b.x = rt.x; b.y = rt.y; G.bstate = 'loose'; addText(rt.x, rt.y, 'MUFFED IT!', '#ff6040', 22, 1); return; }
  b.holder = rt; G.bstate = 'run'; G.credit = null; G.retStart = rt.x;
  Sound.catch(); addText(rt.x, rt.y, 'RETURN!', '#9cff9c', 18, 0.8);
  if (isHumanSide(rt.side)) setHD(rt.side, rt);
}

// AI while a kick is in the air
function aiKickFlight(p) {
  const f = G.ball.flight;
  if (p.off) {
    if (p === f.intended) { if (f.kick === 'punt' && !G.fair && !p.isHuman) cpuFair(p, f); return steer(p, f.tx, f.ty, 1, 0.3); }
    if (p.jam && p.engaged === p.jam && f.t >= p.viseT) { unlink(p, p.jam); p.stun = 0.3; } // he beat the vise
    if (p.jam && p.jam.down <= 0 && f.t < p.viseT) return steer(p, p.jam.x + dirOf(p.jam.side) * 1.1, p.jam.y, 1.08, 0.2); // vise: stay on your gunner and wall him off
    if (f.onside) return steer(p, f.tx, f.ty, 1.05, 0.2);
    // set up a wall in front of the returner
    let t = null, td = 30;
    for (const d of G.D) { const dd = dist(p, d); if (dd < td && !d.engaged && d.pos !== 'P' && d.pos !== 'K') { td = dd; t = d; } } // (leave the kicker alone)
    if (t) return steer(p, lerp(t.x, f.tx, 0.35), lerp(t.y, f.ty, 0.35), 0.95, 0.3);
    return steer(p, f.tx, f.ty, 0.7);
  }
  // coverage: sprint down in lanes
  if (p.pos === 'K' || p.pos === 'P') return steer(p, f.tx - dirOf(p.side) * 15, MID, 0.7);
  if (p.pr === 'gun') return steer(p, f.tx - dirOf(p.side) * 1.2, f.ty, 1.05, 0.3); // gunners go right at the returner
  const lane = lerp(p.hy, f.ty, 0.55);
  steer(p, f.tx - dirOf(p.side) * (f.onside ? 0 : 3), f.onside ? f.ty : lane, f.onside ? 1.05 : 1, 0.5);
}

// end of a kick / return play
function endReturn(res, flags) {
  if (G.special === 'fgblock') return endBlocked(res);
  const r = G.poss, k = 1 - r, kind = G.special, rd = dirOf(r);
  if (kind === 'punt' && flags && flags.length && puntFoul(res, flags)) return;
  if (flags && flags.some(f => f.type === 'IBB') && ibbFoul(res, flags.find(f => f.type === 'IBB'))) return;
  const car = res.carrier, cs = car ? car.side : r;
  let x = res.x != null ? res.x : G.ball.x;
  G.special = null;
  if (res.type === 'td') {
    G.score[cs] += 6; G.deadT = isHumanSide(cs) ? 3.8 : 2.5;
    if (isHumanSide(cs) && !coachOn()) { G.cellyGuy = car; car.down = 0; car.dive = 0; } else { car.down = 0; car.dive = 0; Celly.cpu(car); }
    showBanner(cs === r ? (kind === 'punt' ? 'PUNT RETURN TD!' : 'KICK RETURN TD!') : 'TOUCHDOWN!', `${car.name} • ${G.teams[cs].name}`, cs === G.human ? '#ffd23f' : '#ff6040', 2.6);
    Sound.td(); G.crowdHype = 1.5; stat(car).td++; G.slowmo = 0.9;
    for (const q of G.players) if (q.side === cs) q.celebrate = 2.6;
    addPbp(`${lastName(car.name)} takes the ${kind === 'punt' ? 'punt' : 'kick'} back for a TOUCHDOWN!`, 'Special teams!'); G.lastResult = { big: true, type: 'td' };
    Momentum.kick('rettd', cs);
    G.next = { pat: cs }; return;
  }
  if (res.type === 'kickdead') {
    if (res.tb) { x = ownGoal(r) + rd * (kind === 'punt' ? 20 : 25); showBanner('TOUCHBACK', '', '#fff', 1.2); addPbp(`${kind === 'punt' ? 'Punt' : 'Kickoff'} goes for a touchback.`); }
    else showBanner(res.why || 'DOWN', '', '#fff', 1.1);
    G.next = { drive: r, x }; return;
  }
  if (cs === k) { // kicking team got it back (onside or fumble)
    showBanner(kind === 'onside' ? 'ONSIDE RECOVERED!' : 'FUMBLE RECOVERED!', `${G.teams[k].name} ball!`, k === G.human ? '#9cff9c' : '#ff6040', 1.8);
    Momentum.kick('recover', k);
    G.next = { drive: k, x: clamp(x, 11, 109) }; return;
  }
  if (rd * (x - ownGoal(r)) <= 0) x = ownGoal(r) + rd * 20; // downed in own end zone
  const ret = G.retStart != null ? Math.round(rd * (x - G.retStart)) : 0;
  if (ret > 0) addText(x, MID, `${ret} YD RETURN`, '#9cff9c', 20, 1.2);
  if (ret >= 35) Momentum.kick('bigret', r);
  if (car && cs === r) addPbp(`${lastName(car.name)} ${ret > 0 ? `returns the ${kind === 'punt' ? 'punt' : 'kick'} ${ret} yards` : `fields the ${kind === 'punt' ? 'punt' : 'kick'} and gets stopped right there`}${G.lastTackler ? `, tackled by ${lastName(G.lastTackler.name)}` : ''}.`);
  if (kind === 'onside' && res.type !== 'tackle') showBanner('RECOVERED!', `${G.teams[r].name} ball`, '#fff', 1.3);
  G.next = { drive: r, x: clamp(x, 11, 109) };
}

// ======== live field goals / extra points ========
// The FG unit runs a real play: center snaps it, the holder (the punter) spots it, the kicker steps into it,
// the line holds up the rush. Blocks come from where the rushers actually are when the ball leaves the foot.
const FG_SNAP = 0.36;  // snap flight
const FG_SET = 0.62;   // holder has it down, kicker starts his steps
const KICK_HIT = 0.16; // leg swing: start of the swing to foot-on-ball (draw.js kickSwing uses the same timing)
// defense [off the ball, across]: six rush (3 a side), a contain man for fakes, a safety deep
const FG_DL = [[1, -1], [1, 1], [1, -2.6], [1, 2.6], [3, 7.5], [1.2, -4.6], [1.2, 4.6], [10, 0]];
function fgSetup(kind) {
  const s = G.poss, d = dirOf(s), L = G.los, by = G.ballY, O = G.O, D = G.D;
  const kx = L - d * 7, ky = by;
  const at = (p, x, y) => { p.x = x; p.y = clamp(y, 1, FIELD_W - 1); p.hx = p.x; p.hy = p.y; p.vx = p.vy = 0; p.engaged = null; p.fgT = null; };
  at(O[6], L - d * 0.45, by); at(O[5], L - d * 0.5, by - 1.4); at(O[7], L - d * 0.5, by + 1.4);
  at(O[2], L - d * 0.6, by - 2.9); at(O[3], L - d * 0.6, by + 2.9); at(O[4], L - d * 1, by - 4.3); // wing on the kicker's side
  const pk = kickerOf(s, 'punt'), h = O[1]; // the punter holds, like the real thing
  Object.assign(h, { name: pk.name, num: pk.num, ovr: pk.ovr, pos: 'P', cap: false, xf: null, rt: null }); if (pk.skin != null) h.face.skin = pk.skin;
  at(h, kx + d * 0.55, ky - 0.8); h.kneel = 1; h.kpose = 'hold'; // down on one knee facing the snapper, the spot just behind his front knee (draw.js kickPose uses this offset)
  at(O[0], kx - d * 2.6, ky + 1.6); // kicker: a few steps back and off to the side (soccer-style approach)
  for (const p of O) { p.role = p.slot >= 2 ? 'fgblock' : 'route'; p.route = null; p.blockTarget = null; } // 'route' keeps the kicker/holder out of the block fights
  D.forEach((p, i) => { at(p, L + d * FG_DL[i][0], by + FG_DL[i][1]); p.assign = i === 4 || i === 7 ? { type: 'zone', d: 10, y: 'mid' } : { type: 'rush' }; });
  const b = G.ball; b.holder = null; b.flight = null; b.loose = null; b.x = L; b.y = by; b.z = 0.2; b.hold = 0; b.snap = 0;
  G.play = { off: { key: 'fg', name: kind === 'xp' ? 'Extra Point' : 'Field Goal', type: 'kick', special: true }, def: KICK_RUSH, t: 0, form: null };
  const rush = !G.mini && !(typeof Tutorial !== 'undefined' && Tutorial.active);
  const kk = kickerOf(s, kind);
  // a human on defense gets an edge rusher (career Player Lock keeps his own guy)
  if (rush && isHumanSide(1 - s) && !coachOn() && !(G.lock && lockedGuy())) setHD(1 - s, D[6]);
  updateHuman();
  return { t: 0, snapT: null, kx, ky, rush, kicked: null,
    kickAt: clamp(1.36 - (kk.ka - 70) * 0.004, 1.22, 1.42) + rand(-0.04, 0.04), // snap to kick: better kickers are quicker
    pre: isHumanSide(1 - s) && rush && !coachOn() ? 1.2 : 0.7 };
}
// this device's player is rushing a live kick (hint, phone joystick)
function fgRushing() {
  const km = G.km, h = G.humanPlayer;
  if (G.phase !== 'kickmeter' || !km || G.mini || !h || h.side === km.side) return false;
  return km.kind === 'punt' ? h.off && h.slot !== 1 : (km.kind === 'fg' || km.kind === 'xp') && !h.off; // a punt: anybody but the returner
}
// live punt hints: rushing it, picking a rusher, waving for a fair catch
function puntHint() {
  const km = G.km, h = G.humanPlayer, mob = G.mode === 'mobile', f = G.ball && G.ball.flight;
  if (!h || coachOn() || G.demo || (G.versus && !G.online)) return null;
  if (G.phase === 'live' && G.special === 'fgblock' && G.ball && G.ball.loose) return mob ? 'LOOSE BALL!  •  Get on it' : 'LOOSE BALL!  •  WASD get on it  •  Q switch';
  if (G.phase === 'kickmeter' && km && km.kind === 'punt' && h.side !== km.side) {
    const pre = !km.live || km.live.snapT == null;
    if (fgRushing()) return mob ? 'BLOCK THE PUNT!  •  Stick to rush  •  TAP = jump (swim when blocked)' : 'BLOCK THE PUNT!  •  WASD rush  •  SPACE jump  •  E swim' + (pre && !G.lock ? '  •  Q switch' : '');
    return pre && !G.lock ? (mob ? 'PUNT RETURN  •  TAP a rusher to go block it' : 'PUNT RETURN  •  Q / TAB = pick a rusher to block it') : '';
  }
  if (G.phase === 'live' && f && f.kick === 'punt' && f.intended === h && !h.fair) return mob ? 'Get under it  •  TAP him or FAIR CATCH = fair catch' : 'WASD get under it  •  C or SPACE = FAIR CATCH';
  return null;
}
function fgSnap() {
  const L = G.km.live; if (!L || L.snapT != null) return;
  L.snapT = L.t; Sound.hike(); addDust(G.los, G.ballY, 3); G.throwT = null; // (no leftover roughing-the-passer window from the last play)
  G.play.t = 0; G.bstate = 'snap'; G.lastResult = null; G.credit = null; G.lastTackler = null;
  if (typeof Replay !== 'undefined') Replay.begin();
}
// every frame of a live kick (kick meter phase, and the ball in the air after it)
function fgLive(dt) {
  if (G.km.live.punt) return puntLive(dt);
  const km = G.km, L = km.live, b = G.ball, d = dirOf(km.side), O = G.O;
  L.t += dt;
  const st = L.snapT == null ? -1 : L.t - L.snapT; // time since the snap
  if (st < 0 && km.locked && L.t >= L.pre) fgSnap(); // CPU / auto kicks snap on their own
  if (st >= 0) G.play.t = st;
  for (const p of G.players) {
    p.shedCd = Math.max(0, p.shedCd - dt); p.stun = Math.max(0, p.stun - dt); p.swimCd = Math.max(0, (p.swimCd || 0) - dt);
    p.jump = Math.max(0, (p.jump || 0) - dt); p.jumpCd = Math.max(0, (p.jumpCd || 0) - dt);
  }
  // the ball: snap, catch, spot
  const kick = O[0], hold = O[1];
  if (st < 0) { b.x = G.los; b.y = G.ballY; b.z = 0.2; }
  else if (st < FG_SNAP) { const u = st / FG_SNAP; b.x = lerp(G.los, hold.x + d * 0.67, u); b.y = lerp(G.ballY, hold.y, u); b.z = lerp(0.3, 1, u) + Math.sin(u * Math.PI) * 0.4; b.spin = (b.spin || 0) + dt * 25; b.snap = d; } // spiral right into his hands
  else if (L.kicked == null) { b.snap = 0; b.hold = Math.max(0.01, clamp((st - FG_SNAP) / (FG_SET - FG_SNAP), 0, 1)); b.x = L.kx; b.y = L.ky; b.z = 0; } // the holder spins the laces and spots it (drawn in his hands)
  // who goes where
  for (const p of G.players) {
    if (p.down > 0 || p.stun > 0 || p.dive > 0) { if (p.down > 0 || p.stun > 0) p.dvx = p.dvy = 0; continue; }
    if (st < 0 || L.kicked != null && L.t - L.kicked > 0.35) { p.dvx = p.dvy = 0; continue; } // in the stance / play's over
    if (L.kicked != null) { p.dvx *= 0.9; p.dvy *= 0.9; continue; } // pull up after the kick
    if (p === kick) {
      const tx = L.kx - d * 0.5, ty = L.ky + 0.3, left = Math.max(0.05, L.kickAt - KICK_HIT - st); // plant foot right beside the ball
      if (st < FG_SET || L.swing != null) { p.dvx = p.dvy = 0; continue; } // waits for the spot / plants and swings
      const dx = tx - p.x, dy = ty - p.y, m = Math.hypot(dx, dy);
      const sp = Math.min(6, m / left); p.dvx = m > 0.05 ? dx / m * sp : 0; p.dvy = m > 0.05 ? dy / m * sp : 0;
    } else if (p === hold) { p.dvx = p.dvy = 0; }
    else if (p.off) fgBlockAI(p, L);
    else if (!L.rush) { p.dvx = p.dvy = 0; }
    else {
      p.humanDriven = !!(p.isHuman && withSide(p.side, () => fgHumanRush(p, dt, L)));
      if (!p.humanDriven) fgRushAI(p, L, st);
      if (p.engaged) { p.dvx *= 0.5; p.dvy *= 0.5; } // the kick unit sits down and anchors: no driving the pile into the kicker
    }
  }
  const hp = st < 0 && L.rush && G.D.find(p => p.isHuman);
  if (hp) withSide(hp.side, () => fgHumanRush(hp, dt, L)); // pick your rusher before the snap
  if (st >= 0 && L.kicked == null) resolveBlocks(dt * (st < 1.2 ? 0.7 : 0.2)); // FG protection holds longer than a pass set, then anchors (a slow kicker isn't a sure block)
  for (const p of G.players) applyMove(p, dt);
  separate();
  hold.face.dir = d; kick.face.dir = d; // (an overshoot on his last step must not turn him around)
  if (L.kicked == null && st >= 0 && typeof Replay !== 'undefined' && Replay.rec) Replay.record();
  if (L.kicked != null && L.rush) kickerHit(L, kick);
  // foot meets ball: the leg starts coming through a beat before contact
  if (G.phase === 'kickmeter' && km.locked && L.swing == null && st >= L.kickAt - KICK_HIT) { L.swing = st; kick.kickT = 0; kick.vx *= 0.25; kick.vy *= 0.25; } // plant foot stops him
  if (G.phase === 'kickmeter' && L.swing != null && st >= L.swing + KICK_HIT && L.kicked == null) {
    L.kicked = L.t; L.kt = G.time; b.hold = 0; hold.kpose = null;
    L.hot = G.D.find(p => p.isHuman && p.humanDriven); // you were steering him into it: you can get flagged
    const by = L.rush ? fgBlockRoll(L) : null;
    if (by) return fgBlocked(by);
    for (const p of G.D) if (!p.isHuman && L.rush && p.jump <= 0 && dist(p, { x: L.kx, y: L.ky }) < 4.5) p.jump = 0.45; // hands up
    launchKick();
  }
}
// line: hold your ground, take the nearest guy coming through your gap
function fgBlockAI(p, L) {
  if (p.engaged) return;
  const d = dirOf(G.poss);
  let t = null, td = 4.2;
  for (const df of G.D) {
    if (df.down > 0 || df.engaged || df.shedCd > 0 || df.assign.type !== 'rush') continue;
    const dd = Math.hypot(df.x - p.hx, (df.y - p.hy) * 1.25);
    if (dd < td && !G.O.some(o => o !== p && o.fgT === df && !o.engaged)) { td = dd; t = df; }
  }
  p.fgT = t;
  if (t) steer(p, t.x - d * 0.9, lerp(t.y, L.ky, 0.2), 0.95, 0.25);
  else steer(p, p.hx - d * 0.7, p.hy, 0.5, 0.5);
}
// rush: inside guys go straight at the kick point, edges bend around the end of the line
function fgRushAI(p, L, st) {
  const d = dirOf(G.poss), bx = L.kx + d * 1.2, by = L.ky;
  if (p.assign.type !== 'rush') return steer(p, p.hx, p.hy, 0.4);
  const mul = (st < 0.3 ? 0.6 : 0.95) * (G.poss === G.human && !G.versus ? [0.9, 0.95, 1, 1.04][G.diff] : 1);
  const side = Math.sign(p.hy - by) || 1;
  if (Math.abs(p.hy - by) > 5 && d * (p.x - (G.los - d * 2)) > 0) return steer(p, G.los - d * 2.5, by + side * 4.6, mul, 0.2);
  steer(p, bx, by, mul, 0.2);
}
// you on the rush: steer, SPACE / tap = jump, E (or tap while blocked on a phone) = swim
function fgHumanRush(p, dt, L) {
  const mob = ctlMobile();
  if (L.snapT == null) { // before the snap: switch rushers
    if (!(G.lock && lockedGuy())) {
      const rush = G.D.filter(q => q.assign.type === 'rush');
      if (Input.hit('KeyQ') || Input.hit('Tab')) { G.humanDef = rush[(rush.indexOf(p) + 1) % rush.length]; updateHuman(); }
      for (const c of Input.taps) { let best = null, bd = 55; for (const q of rush) { const dd = Math.hypot(sx(q.x) - c.x, sy(q.y) - 30 - c.y); if (dd < bd) { bd = dd; best = q; } } if (best) { G.humanDef = best; updateHuman(); } }
    }
    p.dvx = p.dvy = 0; return true;
  }
  if (L.kicked != null) return false;
  const tap = Input.taps.length > 0;
  if (p.engaged && (Input.hit('KeyE') || (mob && tap))) fgSwim(p);
  else if (Input.hit('Space') || (mob && tap)) doJump(p);
  if (mob) {
    const st = Input.stick, P = Input.pointer;
    if (st.m > 0.15 && isFinite(st.x) && isFinite(st.y)) { p.dvx = st.x * p.spd; p.dvy = st.y * p.spd; return true; }
    if (P.down && !P.aiming && P.t > 0.12) { steer(p, wx(P.x), wy(P.y), 1, 0.4); return true; }
    return false; // not touching: he rushes on his own
  }
  const ax = Input.axis();
  if (ax.m < 0.1) return false;
  const sprint = Input.held('ShiftLeft') && p.stamina > 0.05;
  if (sprint) p.stamina = Math.max(0, p.stamina - dt * 0.42);
  const mul = sprint ? sprintBoost(p) : 1;
  p.dvx = ax.x * p.spd * mul * ax.m; p.dvy = ax.y * p.spd * mul * ax.m;
  return true;
}
// swim move on a kick block: harder than on a pass rush (everybody's set, nobody's going anywhere)
function fgSwim(p) {
  if (p.swimCd > 0 || !p.engaged || p.engaged === true) return;
  p.swimCd = 1.2;
  const bl = p.engaged;
  if (chance(clamp(0.18 + (rat(p, 'PRS') - rat(bl, 'PBK')) / 90, 0.08, 0.28))) { // hard to beat a kick-protection lineman
    unlink(bl, p); p.shedCd = 0.8; bl.stun = 0.6; bl.head.vx += 250;
    addText(p.x, p.y, 'SWIM MOVE!', '#ff8a8a', 18, 0.7); Sound.juke();
  } else addText(p.x, p.y, 'STUFFED', '#ccc', 14, 0.6);
}
// does anybody get a hand on it? Reach near the kick point, big guys in the lane at the line on a low kick,
// a timed jump, pass rush vs the line's pass block. CPU tuning: ~1.5% of XPs, 1-2% of short FGs, ~4% of 45+ yarders.
function fgBlockChance(L) {
  const km = G.km, d = dirOf(km.side), bx = L.kx + d * 1.2, by = L.ky;
  const low = 1 + clamp((km.yds - 30) / 30, 0, 0.8) + clamp(0.8 - km.power, 0, 0.6) * 1.5; // long kicks / a weak leg = a lower ball
  const ol = (rat(G.O[5], 'PBK') + rat(G.O[6], 'PBK') + rat(G.O[7], 'PBK')) / 3;
  const each = [];
  for (const p of G.D) {
    if (p.down > 0 || p.assign.type !== 'rush') continue;
    const r = Math.hypot(p.x - bx, p.y - by), q = clamp((3 - r) / 2.2, 0, 1);
    const s = d * (p.x - L.kx), lane = Math.abs(p.y - by) < 1.4 && s > 1 && s < 9 ? 0.04 * (low - 0.6) * (1 + clamp(6.5 - s, 0, 4) * 0.5) : 0;
    let pb = 0.3 * q * q + lane;
    if (pb <= 0) continue;
    const jf = p.jump > 0 ? 1 + 0.45 * Math.sin((1 - p.jump / 0.55) * Math.PI) : p.isHuman ? 0.7 : 1; // a human has to time his jump
    pb *= jf * (1 + (low - 1) * 0.5) * clamp(Math.pow(rat(p, 'PRS') / ol, 2), 0.6, 1.6) * (p.engaged ? 0.35 : 1);
    each.push([p, Math.min(0.25, pb)]); // even a perfect rush only gets a hand on it sometimes
  }
  return each;
}
function fgBlockRoll(L) {
  const each = fgBlockChance(L);
  if (G.fgDbg) G.fgDbg.push(1 - each.reduce((m, e) => m * (1 - e[1]), 1));
  for (const [p, pb] of each) if (chance(pb)) return p;
  return null;
}
function fgBlocked(by) {
  const km = G.km, s = km.side, d = dirOf(s), b = G.ball;
  G.blk = { kind: km.kind, side: s, clock: G.clock, flip: false };
  G.special = 'fgblock'; G.phase = 'live'; G.bstate = 'loose'; G.play.t = 0;
  b.holder = null; b.flight = null; b.hold = 0; b.snap = 0; b.z = 1.4; b.x = by.x - d * 0.7; b.y = lerp(b.y, by.y, 0.7); // off his hands
  const k = G.O[0]; k.vx = d * 3; // he still swings through
  b.loose = { vx: -d * rand(3, 8), vy: rand(-3, 3) + Math.sign(b.y - by.y) * 2, t: 0 };
  for (const p of G.players) { p.engaged = null; p.kneel = 0; p.kpose = null; }
  blockedBy(by, km.kind);
  addPbp(`${lastName(km.kk.name)}'s ${km.kind === 'xp' ? 'extra point' : `${km.yds}-yard field goal`} is BLOCKED by ${lastName(by.name)}!`, 'Special teams!');
}
// shared by blocked field goals / extra points / punts: the banner, the hype, the stat, you get the guy nearest the ball
function blockedBy(by, kind) {
  const s = G.km.side, st = stat(by), ts = G.tstats && G.tstats[by.side];
  for (const side of [0, 1]) if (isHumanSide(side) && !(G.lock && lockedGuy())) setHD(side, nearestTo(G.players.filter(p => p.side === side), G.ball));
  updateHuman();
  st.blk = (st.blk || 0) + 1; if (ts) ts.blk = (ts.blk || 0) + 1;
  by.jump = Math.max(by.jump || 0, 0.3); by.head.vy -= 300;
  showBanner('BLOCKED!', `${by.name} gets a hand on it!`, isHumanSide(by.side) && !isHumanSide(s) ? '#9cff9c' : '#ff6040', 1.6);
  Momentum.kick('recover', by.side);
  Sound.tackle(); cam.shake = 9; G.crowdHype = 1.3; G.slowmo = 0.5;
  addText(G.ball.x, G.ball.y, kind === 'punt' ? 'PUNT BLOCKED!' : 'BLOCKED!', '#ff9a3d', 26, 1);
  G.lastResult = { big: true, type: 'block' };
}
// a blocked kick bounces loose: the defense can scoop it and take it the other way
function fgScoop(p) {
  const b = G.ball;
  b.loose = null; b.holder = p; G.bstate = 'run'; G.blk.flip = true; Sound.catch();
  addText(p.x, p.y, 'SCOOP!', '#ffd23f', 22, 0.9);
  if (isHumanSide(p.side)) setHD(p.side, p);
}
// somebody gets to a blocked kick on the ground: the other team scoops it, the kicking team just falls on it
function blkTouch(p) {
  if (p.side !== G.blk.side) return fgScoop(p);
  const b = G.ball;
  b.loose = null; b.holder = p; b.fumbler = null; Sound.catch();
  showBanner('RECOVERED!', p.name, isHumanSide(p.side) ? '#9cff9c' : '#fff', 1.1);
  endPlay({ type: 'fumble', carrier: p, x: p.x, y: p.y });
}
function endBlocked(res) {
  const B = G.blk, s = B.side, car = res.carrier, cs = car ? car.side : s;
  let x = res.x != null ? res.x : G.ball.x;
  G.special = null; G.blk = null; G.poss = s; // (a punt has the return team "on offense" until now)
  if (B.kind === 'xp') { G.clock = B.clock; G.patSide = null; } // a try never runs the clock
  if (res.type === 'td' && cs !== s) {
    G.score[cs] += B.kind === 'xp' ? 2 : 6; G.deadT = isHumanSide(cs) ? 3.8 : 2.5;
    car.down = 0; car.dive = 0;
    if (isHumanSide(cs) && !coachOn()) G.cellyGuy = car; else Celly.cpu(car);
    showBanner(B.kind === 'xp' ? 'DEFENSIVE 2 POINTS!' : B.kind === 'punt' ? 'BLOCKED PUNT TD!' : 'BLOCKED KICK TD!', `${car.name} • ${G.teams[cs].name}`, isHumanSide(cs) ? '#ffd23f' : '#ff6040', 2.6);
    Sound.td(); G.crowdHype = 1.5; G.slowmo = 0.9; if (B.kind !== 'xp') stat(car).td++;
    for (const q of G.players) if (q.side === cs) q.celebrate = 2.6;
    addPbp(`${lastName(car.name)} scoops up the blocked kick and takes it all the way!`, B.kind === 'xp' ? 'Two points for the defense' : 'Touchdown!');
    G.next = B.kind === 'xp' ? { kickoff: s } : { pat: cs }; return;
  }
  if (B.kind === 'xp') { G.next = { kickoff: s }; return; }
  if (cs !== s) { // defense ball where he went down
    const cd = dirOf(cs);
    if (cd * (x - ownGoal(cs)) <= 0) x = ownGoal(cs) + cd * 20;
    showBanner('TURNOVER!', `${G.teams[cs].name} ball`, '#ff9a3d', 1.4);
    G.next = { drive: cs, x: clamp(x, 11, 109) }; return;
  }
  if (dirOf(s) * (x - ownGoal(s)) <= 0) { // fell on a blocked punt in his own end zone
    G.score[1 - s] += 2; showBanner('SAFETY!', '+2', isHumanSide(s) ? '#ff6040' : '#9cff9c', 1.8); addPbp('Blocked punt is recovered in the end zone. Safety!');
    G.next = { kickoff: s, from: 20 }; return;
  }
  if (B.flip) { G.next = { drive: s, x: clamp(x, 11, 109) }; return; } // got it back after the defense had it: new set of downs
  G.ballY = clamp(res.y != null ? res.y : G.ballY, 20, FIELD_W - 20);
  G.next = advanceDown(x, true); // kicking team falls on it: on 4th down that's a turnover on downs
}

// ======== live punts ========
// Long snap to the punter 14 back, the line + a personal protector hold up the rush, two gunners split wide fight
// through their jammers and go get the returner. Kick distance / aim are the same meter + ratings as always.
const PT_SNAP = 0.62; // long snap flight
// return team (G.O) up front: five across the line, a jammer on each gunner, the returner deep
const PT_RUSH = [[0, -4.2], [4, -2.25], [5, -0.75], [6, 0.75], [7, 2.7]];
function puntSetup(k, kk) {
  const r = 1 - k, d = dirOf(k), L = G.los, by = clamp(G.ballY, 8, FIELD_W - 8), O = G.O, D = G.D;
  const at = (p, x, y, pr) => { p.x = x; p.y = clamp(y, 1, FIELD_W - 1); p.hx = p.x; p.hy = p.y; p.vx = p.vy = 0; p.engaged = null; p.pr = pr; p.face.dir = dirOf(p.side); };
  const gy = [clamp(by - 14, 3, FIELD_W - 3), clamp(by + 14, 3, FIELD_W - 3)];
  at(D[0], L - d * 0.5, by, 'blk'); at(D[2], L - d * 0.6, by - 1.5, 'blk'); at(D[3], L - d * 0.6, by + 1.5, 'blk'); at(D[7], L - d * 0.9, by - 3, 'blk');
  at(D[4], L - d * 5.5, by + 0.8, 'pp'); at(D[1], L - d * 14, by, 'p'); D[1].kpose = 'pc';
  at(D[5], L - d * 0.6, gy[0], 'gun'); at(D[6], L - d * 0.6, gy[1], 'gun');
  at(O[1], L + d * clamp(41 + (kk.kp - 75) * 0.3, 35, 48), by, 'ret');
  at(O[2], L + d * 1.3, gy[0], 'jam'); at(O[3], L + d * 1.3, gy[1], 'jam'); O[2].jam = D[5]; O[3].jam = D[6]; O[2].viseT = rand(0, 1.4); O[3].viseT = rand(0, 1.4); // how long he stays on his gunner once it's kicked
  // the call: usually two (sometimes three) come after the punter and the rest hold up the line and peel back to set up the return; now and then they all go for the block
  const all = chance(0.1), extra = chance(0.5) ? 0 : 4;
  PT_RUSH.forEach(([s, o], i) => { at(O[s], L + d * 1, by + o, all || i === 2 || i === 3 || i === extra ? 'rush' : 'hold'); O[s].peelT = rand(0.45, 0.8); });
  for (const g of [D[5], D[6]]) g.relT = clamp(rand(0.45, 1.2) + (rat(O[g === D[5] ? 2 : 3], 'BSH') - rat(g, 'SPD')) / 120, 0.1, 1.1); // how long the jam holds him up
  if (all) { at(O[2], L + d * 1.2, by - 6, 'rush'); O[2].jam = null; D[5].relT = 0; } // block call: a jammer comes off the edge too (six on five), his gunner runs free
  const b = G.ball; Object.assign(b, { x: L, y: by, z: 0.2, holder: null, flight: null, loose: null, hold: 0, snap: 0 });
  G.ballY = by; G.bstate = 'snap'; G.fair = null;
  // you: the punter when you kick, the returner when you receive (before the snap Q / a tap picks a rusher instead)
  if (isHumanSide(k)) setHD(k, D[1]);
  if (isHumanSide(r) && !(G.lock && lockedGuy())) setHD(r, O[1]);
  const rush = !(typeof Tutorial !== 'undefined' && Tutorial.active);
  return { punt: true, t: 0, snapT: null, rush, kicked: null, drop: null, P: D[1], all,
    kickAt: clamp(1.62 - (kk.ka - 70) * 0.004, 1.5, 1.72) + rand(-0.05, 0.05), // snap to foot: a good punter gets it off quicker
    pre: isHumanSide(r) && !coachOn() && !G.sitOut ? 1.4 : 0.8 };
}
// every frame of a live punt until the ball is in the air (then the normal kick return code takes over)
function puntLive(dt) {
  const km = G.km, L = km.live, b = G.ball, d = dirOf(km.side), P = L.P;
  L.t += dt;
  const st = L.snapT == null ? -1 : L.t - L.snapT;
  if (st < 0 && km.locked && L.t >= L.pre) fgSnap();
  if (st >= 0) G.play.t = st;
  for (const p of G.players) {
    p.shedCd = Math.max(0, p.shedCd - dt); p.stun = Math.max(0, p.stun - dt); p.swimCd = Math.max(0, (p.swimCd || 0) - dt);
    p.jump = Math.max(0, (p.jump || 0) - dt); p.jumpCd = Math.max(0, (p.jumpCd || 0) - dt);
  }
  // you're receiving: pick the returner or one of the rushers before the snap
  if (st < 0 && L.rush && !coachOn() && !G.sitOut) for (const s of [0, 1]) if (s !== km.side && isHumanSide(s)) withSide(s, puntPick);
  for (const p of G.players) {
    if (p.down > 0 || p.stun > 0 || p.dive > 0) { if (p.down > 0 || p.stun > 0) p.dvx = p.dvy = 0; continue; }
    p.humanDriven = false;
    if (st < 0) { p.dvx = p.dvy = 0; continue; }
    if (p.pr === 'p') { // catch it, two steps, drop, swing
      const left = Math.max(0.05, L.kickAt - KICK_HIT - st), tx = G.los - d * 12.8;
      if (st < PT_SNAP + 0.12) { p.dvx = p.dvy = 0; } else steer(p, tx, P.hy, Math.min(1, Math.abs(tx - p.x) / left / p.spd + 0.05), 0.1);
    } else if (p.pr === 'gun') puntGunner(p, L, st);
    else if (p.pr === 'jam') puntJammer(p);
    else if (p.pr === 'blk' || p.pr === 'pp') puntProtect(p, L);
    else if (p.pr === 'hold') puntHold(p, st);
    else if (p.pr === 'rush' && L.rush) {
      p.humanDriven = !!(p.isHuman && withSide(p.side, () => fgHumanRush(p, dt, L)));
      if (!p.humanDriven) puntRushAI(p, L, st);
      if (p.engaged) { p.dvx *= 0.5; p.dvy *= 0.5; }
    } else { p.dvx = p.dvy = 0; } // returner waits deep
  }
  if (st >= 0) puntBlocks(dt, st);
  for (const p of G.players) applyMove(p, dt);
  separate();
  P.face.dir = d;
  // the ball: long snap, he catches it, then drops it to his foot
  if (st < 0) { b.x = G.los; b.y = G.ballY; b.z = 0.2; }
  else if (st < PT_SNAP) { const u = st / PT_SNAP; b.x = lerp(G.los, P.x + d * 0.6, u); b.y = lerp(G.ballY, P.y, u); b.z = lerp(0.3, 1, u) + Math.sin(u * Math.PI) * 0.7; b.spin = (b.spin || 0) + dt * 30; b.snap = -d; }
  else if (L.drop == null) { if (b.holder !== P) { b.holder = P; b.snap = 0; Sound.catch(); } b.x = P.x; b.y = P.y; b.z = 1; }
  if (st >= 0 && L.kicked == null && typeof Replay !== 'undefined' && Replay.rec) Replay.record();
  // he lets go of it a beat before his foot gets there (a slow aim on the meter = he holds it longer)
  if (km.locked && L.drop == null && st >= Math.max(PT_SNAP + 0.3, L.kickAt - KICK_HIT)) { L.drop = st; b.holder = null; P.kickT = 0; P.kpose = null; }
  if (L.drop != null) { const u = clamp((st - L.drop) / KICK_HIT, 0, 1); b.x = P.x + d * lerp(0.5, 0.75, u); b.y = P.y + 0.05; b.z = lerp(1, 0.5, u * u); b.spin = 0; }
  if (L.drop != null && L.kicked == null && st >= L.drop + KICK_HIT) {
    L.kicked = L.t; L.kt = G.time;
    L.hot = G.O.find(p => p.isHuman && p.humanDriven);
    const by = L.rush ? puntBlockRoll(L) : null;
    if (by) return puntBlocked(by);
    for (const p of G.O) if (p.pr === 'rush' && !p.isHuman && p.jump <= 0 && dist(p, P) < 4) p.jump = 0.45; // hands up
    launchReturnKick();
  }
}
// you on the return team before the snap: Q / TAB / tap cycles the returner and the five rushers
function puntPick() {
  if (G.lock && lockedGuy()) return;
  const list = [G.O[1]].concat(G.O.filter(q => q.pr === 'rush' || q.pr === 'hold'));
  let pick = null;
  if (Input.hit('KeyQ') || Input.hit('Tab')) pick = list[(list.indexOf(G.humanDef) + 1) % list.length];
  for (const c of Input.taps) { let bd = 55; for (const q of list) { const dd = Math.hypot(sx(q.x) - c.x, sy(q.y) - 30 - c.y); if (dd < bd) { bd = dd; pick = q; } } }
  if (pick && pick !== G.humanDef) { G.humanDef = pick; if (pick.pr === 'hold') pick.pr = 'rush'; Sound.click(); updateHuman(); } // you go after the punter
}
// gunner: the jammer in his face holds him up for a moment, then he's gone
function puntGunner(p, L, st) {
  const d = dirOf(p.side), ret = G.O[1], j = G.O.find(q => q.jam === p);
  if (!p.rel && st >= p.relT) { p.rel = true; if (j && dist(j, p) < 1.6) j.head.vx += 200; } // beat the jam (the jammer runs with him, aiKickFlight)
  const jammed = !p.rel && j && j.down <= 0 && dist(j, p) < 1.6;
  steer(p, p.x + d * 8, lerp(p.y, ret.y, 0.18), jammed ? 0.35 : 1, 0.2);
  if (jammed) p.dvy += Math.sign(ret.y - p.y) * 1.2; // fighting to get inside
}
// hold-up guys: punch the man in front of them, then turn and run back to set up the return
function puntHold(p, st) {
  const d = dirOf(G.km.side);
  if (st < p.peelT) return steer(p, G.los - d * 0.8, p.hy, 0.8, 0.3);
  if (p.engaged) unlink(p.engaged, p);
  steer(p, G.los + d * 22, lerp(p.hy, G.ballY, 0.3), 1, 0.5);
}
function puntJammer(p) {
  const g = p.jam, d = dirOf(g.side);
  steer(p, g.x + d * 0.9, g.y, 1.05, 0.15); // stay square in front of him
}
// protection: snapper / guards hold their gap, the personal protector picks up whoever comes free
function puntProtect(p, L) {
  if (p.engaged) return;
  const d = dirOf(p.side), P = L.P;
  const pp = p.pr === 'pp';
  let t = null, td = pp ? 7 : 5;
  for (const r of G.O) {
    if (r.pr !== 'rush' || r.down > 0 || r.engaged || r.shedCd > 0) continue;
    const dd = pp ? dist(r, p) : Math.hypot(r.x - p.hx, (r.y - p.hy) * 1.25);
    // the line takes the guys in front of it first; the protector takes whoever the line didn't
    const taken = G.D.some(o => o !== p && o.ptT === r && !o.engaged && (o.pr === 'blk' || pp === (o.pr === 'pp')));
    if (dd < td && !taken && !(!pp && G.D.some(o => o.pr === 'pp' && o.ptT === r && dist(o, r) < 1.6))) { td = dd; t = r; }
  }
  p.ptT = t;
  if (t) steer(p, t.x - d * 0.9, lerp(t.y, P.y, 0.25), 0.95, 0.25);
  else steer(p, p.hx - d * (p.pr === 'pp' ? 0 : 0.6), lerp(p.hy, P.y, p.pr === 'pp' ? 0.3 : 0), 0.5, 0.5);
}
// rush: inside guys go at the spot just in front of his foot, edges bend around the end of the line
function puntRushAI(p, L, st) {
  const d = dirOf(L.P.side), bx = L.P.x + d * 1.3, by = L.P.y;
  const mul = (st < 0.3 ? 0.6 : 0.95) * (L.P.side === G.human && !G.versus ? [0.9, 0.95, 1, 1.04][G.diff] : 1);
  const side = Math.sign(p.hy - G.ballY) || 1;
  if (Math.abs(p.hy - G.ballY) > 2.6 && d * (p.x - (G.los - d * 2)) > 0) return steer(p, G.los - d * 2.5, G.ballY + side * 4.8, mul, 0.2);
  steer(p, bx, by, mul, 0.2);
}
// the punt team's line vs the rush: same idea as pass pro, but these are linebackers and DBs blocking
function puntBlocks(dt, st) {
  const k = G.km.side;
  for (const bl of G.D) {
    if ((bl.pr !== 'blk' && bl.pr !== 'pp') || bl.engaged || bl.stun > 0 || bl.down > 0) continue;
    for (const df of G.O) if (df.pr === 'rush' && (!bl.ptT || bl.ptT === df || dist(bl.ptT, bl) > 2) && !df.engaged && df.down <= 0 && df.shedCd <= 0 && dist(bl, df) < 1.15) { bl.engaged = df; df.engaged = bl; df.shed = 0; Sound.tone(110, 0.05, 'square', 0.04); break; }
  }
  for (const bl of G.D) {
    const df = bl.engaged;
    if (!df || df.engaged !== bl) continue;
    if (df.down > 0 || bl.down > 0 || dist(bl, df) > 2.5) { unlink(bl, df); continue; }
    let rate = 0.35 * clamp(Math.pow(rat(df, 'PRS') / rat(bl, 'PBK'), 2), 0.6, 1.5) * rand(0.4, 1.4); // (starters vs backups: capped, or a star QB on the rush walks right through)
    if (df.isHuman && df.humanDriven) rate *= 1.5;
    df.shed += rate * dt;
    const push = clamp(rat(df, 'STR') / rat(bl, 'STR'), 0.6, 1.4) * 0.22;
    df.dvx *= push; df.dvy *= push;
    const m = Math.hypot(df.dvx, df.dvy) || 1, nx = df.x - (m < 0.01 ? -dirOf(k) * 0.95 : df.dvx / m * 0.95), ny = df.y - (m < 0.01 ? 0 : df.dvy / m * 0.95);
    bl.dvx = (nx - bl.x) * 8 + df.dvx; bl.dvy = (ny - bl.y) * 8 + df.dvy;
    if (df.shed >= 1) { unlink(bl, df); df.shedCd = 1.1; bl.stun = 0.45; bl.head.vx += 200; if (df.isHuman) addText(df.x, df.y, 'SHED!', '#ff8a8a', 13, 0.6); }
  }
}
// block chance: like a field goal, but the ball comes off the foot ~13 yards deep, so only a guy who's basically free gets there.
// CPU tuning: ~1-2% of punts
function puntBlockChance(L) {
  const P = L.P, d = dirOf(P.side), bx = P.x + d * 1.3, by = P.y, each = [];
  const ol = G.D.filter(p => p.pr === 'blk').reduce((a, p) => a + rat(p, 'PBK'), 0) / 4;
  for (const p of G.O) {
    if (p.down > 0 || p.pr !== 'rush') continue;
    const q = clamp((2.6 - Math.hypot(p.x - bx, p.y - by)) / 2, 0, 1);
    if (q <= 0) continue;
    const jf = p.jump > 0 ? 1 + 0.45 * Math.sin((1 - p.jump / 0.55) * Math.PI) : p.isHuman ? 0.7 : 1;
    each.push([p, Math.min(0.2, 0.12 * q * q * jf * clamp(Math.pow(rat(p, 'PRS') / ol, 2), 0.6, 1.6) * (p.engaged ? 0.3 : 1))]);
  }
  return each;
}
function puntBlockRoll(L) {
  const each = puntBlockChance(L);
  if (G.fgDbg) G.fgDbg.push(1 - each.reduce((m, e) => m * (1 - e[1]), 1));
  for (const [p, pb] of each) if (chance(pb)) return p;
  return null;
}
// blocked punt: the ball squirts back toward his own end zone, live (blkTouch: the return team can scoop and score)
function puntBlocked(by) {
  const km = G.km, s = km.side, d = dirOf(s), b = G.ball, P = km.live.P;
  G.blk = { kind: 'punt', side: s, clock: G.clock, flip: false };
  G.special = 'fgblock'; G.phase = 'live'; G.bstate = 'loose'; G.play.t = 0;
  b.holder = null; b.flight = null; b.snap = 0; b.z = 1; b.x = P.x + d * 0.9; b.y = lerp(P.y, by.y, 0.5);
  b.loose = { vx: (chance(0.4) ? d * rand(1, 4) : -d * rand(2, 6)), vy: rand(-3, 3) + Math.sign(b.y - by.y) * 2, t: 0 };
  for (const p of G.players) p.engaged = null;
  blockedBy(by, 'punt');
  addPbp(`${lastName(km.kk.name)}'s punt is BLOCKED by ${lastName(by.name)}!`, 'Special teams!');
}
// CPU returner: waves for a fair catch when a gunner is going to be on him as it comes down
function cpuFair(p, f) {
  const u = f.t / f.T; if (u < 0.55) return;
  const left = (1 - u) * f.T;
  let near = 99;
  for (const q of G.D) if (q.down <= 0 && !q.engaged && q.pos !== 'P') near = Math.min(near, Math.hypot(q.x - f.tx, q.y - f.ty) - q.spd * left * 0.9);
  if (near < 14 || (dirOf(p.side) * (f.tx - ownGoal(p.side)) < 8 && near < 9)) callFair(p); // deep in his own end: don't risk it
}
function callFair(p) {
  G.fair = p; p.fair = 1;
  addText(p.x, p.y - 1.5, 'FAIR CATCH', '#fff', 18, 1);
}
// you returning a punt: C / SPACE (phone: tap him or the FAIR CATCH button) waves for a fair catch
function puntRetInput(p) {
  const f = G.ball && G.ball.flight;
  if (!f || f.kick !== 'punt' || f.intended !== p || G.fair) return;
  let go = Input.hit('KeyC') || Input.hit('Space');
  if (!go && ctlMobile()) for (const c of Input.taps) if (Math.hypot(sx(p.x) - c.x, sy(p.y) - 40 - c.y) < 70) go = true;
  if (!go) return;
  callFair(p); if (ctlMobile()) Input.taps.length = 0;
}
// a punt nobody caught: it rolls into the end zone (touchback) or dies where it stops
function puntRoll(l) {
  const b = G.ball, r = G.poss;
  if (dirOf(r) * (b.x - ownGoal(r)) <= 0) { b.loose = null; endPlay({ type: 'kickdead', tb: true }); return true; }
  if (l.t > 1.6 && Math.hypot(l.vx, l.vy) < 0.6) { b.loose = null; addText(b.x, b.y, 'DOWNED', '#fff', 16, 0.9); endPlay({ type: 'kickdead', x: b.x, why: 'DOWNED' }); return true; }
  return false;
}
// first to touch a bouncing punt: the cover team downs it, the return team can pick it up and go
function puntTouch(p) {
  const b = G.ball;
  b.loose = null;
  if (p.side !== G.poss) { addText(b.x, b.y, 'DOWNED', '#fff', 16, 0.9); return endPlay({ type: 'kickdead', x: b.x, why: 'DOWNED' }); }
  b.holder = p; G.bstate = 'run'; G.credit = null; G.retStart = p.x; Sound.catch();
  if (isHumanSide(p.side)) setHD(p.side, p);
}
// roughing / running into the kicker: a rusher who didn't get the ball runs into him right after the kick.
// A blocked kick never gets here. Most CPU bumps are let go (rare: ~1% of punts); you steering into him always gets flagged.
function kickerHit(L, kp) {
  if (L.kt == null || L.flag || G.time - L.kt > 0.5 || kp.down > 0) return;
  for (const p of G.players) {
    if (p.side === kp.side || p.down > 0 || p.roughChk || p.speedNow < 2.5 || dist(p, kp) > 0.9) continue;
    p.roughChk = true;
    const hard = p.speedNow > 5.5 || p.dive > 0;
    if (p !== L.hot && !chance(hard ? 0.035 : 0.03)) continue;
    L.flag = hard ? 'ROUGHK' : 'RIK';
    throwFlag(L.flag, p.side, kp.x, kp.y, p);
    if (hard) { kp.down = 1.1; kp.downDir = dirOf(p.side); kp.dizzy = 1; kp.kickT = null; Sound.tackle(); cam.shake = 7; }
    else { kp.stun = 0.35; kp.head.vx += 220; Sound.boing(); }
    return;
  }
}
// enforce it on a field goal / extra point (updateKick). Good kick: they keep the points. Missed: the kicking team keeps the ball
function kickFoul(k) {
  const L = G.km.live, F = FOULS[L.flag], s = k.side, d = dirOf(s);
  const f = (G.flags || []).find(x => x.type === L.flag) || {}, who = `${G.teams[1 - s].name}${f.num != null ? ' #' + f.num : ''}`;
  G.flags = [];
  if (k.good) { addPbp(`Penalty on ${who}: ${F.name.toLowerCase()}, declined.`); return; }
  addPbp(`PENALTY on ${who}: ${F.name.toLowerCase()}. ${F.text.replace(/ • /g, ', ')}.`);
  showBanner(F.name, `${who} • ${F.text}`, '#ffe14d', 2.4); Sound.whistle();
  k.wait = 2.4;
  if (k.kind === 'xp') { G.next = { pat: s }; return; } // try it again
  const yds = L.flag === 'ROUGHK' ? 15 : 5;
  G.los = clamp(G.los + d * Math.min(yds, d * (goalX(s) - G.los) / 2), 11, 109); G.poss = s;
  if (L.flag === 'ROUGHK' || d * (G.los - G.firstDownX) >= -0.05) { G.down = 1; setFirstDown(); } // running into him: only a 1st down if the 5 get it
  G.next = null; G.runoff = 0;
}
// enforce it on a punt (endReturn): roughing = 15 + a 1st down for the punting team; running into him only if the 5 yards get the 1st down
function puntFoul(res, flags) {
  const f = flags.find(x => x.type === 'ROUGHK' || x.type === 'RIK'); if (!f) return false;
  const r = G.poss, k = 1 - r, d = dirOf(k), F = FOULS[f.type], who = `${G.teams[r].name}${f.num != null ? ' #' + f.num : ''}`;
  const car = res.carrier;
  if (car && car.side === k && res.type !== 'kickdead') return false; // they got the ball anyway (muff): decline
  const x = clamp(G.los + d * Math.min(f.type === 'ROUGHK' ? 15 : 5, d * (goalX(k) - G.los) / 2), 11, 109);
  if (f.type === 'RIK' && d * (x - G.firstDownX) < -0.05) { addPbp(`Penalty on ${who}: ${F.name.toLowerCase()}, declined.`); return false; }
  G.special = null;
  addPbp(`PENALTY on ${who}: ${F.name.toLowerCase()}. ${f.type === 'ROUGHK' ? '15 yards, automatic first down' : '5 yards, first down'}. ${G.teams[k].name} keep the ball.`);
  showBanner(F.name, `${who} • ${f.type === 'ROUGHK' ? F.text : '5 yards • 1st down'}`, '#ffe14d', 2.4); Sound.whistle();
  G.deadT = 2.4; G.next = { drive: k, x };
  return true;
}
// illegal block in the back on a return: 10 yards back from where the block was (or from the end of the run if he got stopped behind it)
function ibbFoul(res, f) {
  const r = G.poss, rd = dirOf(r), F = FOULS.IBB, who = `${G.teams[r].name}${f.num != null ? ' #' + f.num : ''}`, car = res.carrier;
  if (!car || car.side !== r) { addPbp(`Penalty on ${who}: ${F.name.toLowerCase()}, declined.`); return false; } // the kicking team got the ball anyway
  const end = res.type === 'td' ? goalX(r) : res.x != null ? res.x : f.x, base = rd * (end - f.x) < 0 ? end : f.x;
  const x = clamp(base - rd * Math.min(10, rd * (base - ownGoal(r)) / 2), 11, 109);
  const ret = G.retStart != null ? Math.round(rd * (end - G.retStart)) : 0;
  G.special = null;
  if (ret > 0) addPbp(`${lastName(car.name)} returns it ${ret} yards, but there's a flag.`);
  addPbp(`PENALTY on ${who}: ${F.name.toLowerCase()}. 10 yards from the spot of the foul.`);
  showBanner(F.name, `${who} • ${F.text}${res.type === 'td' ? '  •  Touchdown comes off the board' : ''}`, '#ffe14d', 2.4); Sound.whistle(); refSignal('BLOCK IN THE BACK');
  G.deadT = 2.4; G.next = { drive: r, x };
  return true;
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
  if (play.fakeKind === 'punt') { Object.assign(qb, { name: kk.name, num: kk.num, ovr: Math.min(qb.ovr, kk.ovr - 5), pos: 'P', cap: false, xf: null, thp: null, tha: null, rt: null }); if (kk.skin != null) qb.face.skin = kk.skin; qb.x = G.los - d * 9; qb.hx = qb.x; }
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
  if (G.versus) return;
  for (const cpu of [0, 1]) {
    if ((isHumanSide(cpu) && !coachCalls()) || !G.pendingRunoff || G.timeouts[cpu] <= 0 || G.clock <= 1) continue;
    const S = situation(cpu), q = G.quarter;
    const late = Math.min(100, (G.qtrLen || 180) * 0.45); // the "two-minute drill" window, scaled to the quarter length
    if (G.poss === cpu) {
      if (G.down === 4 && !cpuGoForIt(S.toGo, S.fgOk)) continue; // kicking anyway: save it
      // our ball, clock running: save time when we need points (end of half, or behind/tied late)
      if (q === 2 && G.clock < 40 && S.own >= 35) callTimeout(cpu);
      else if (q >= 4 && S.margin <= 0 && G.clock < Math.min(late, Math.max(45, S.needScores * 40))) callTimeout(cpu);
    } else if (q >= 4 && S.margin < 0 && S.margin >= -16) {
      // their ball, we're behind: stop the clock so we get it back with time left (not when a kneel ends it anyway).
      // only in the real end-game window, never with most of the 4th still to play
      if (G.clock < late && !canKneelOut()) callTimeout(cpu);
    } else if (q === 2 && G.poss !== cpu && G.clock < 50 && G.down >= 3 && fromOwn(G.poss, G.los) < 40 && S.tos >= 2) callTimeout(cpu); // make them punt with time on the clock
  }
}
// CPU spikes it when the clock is running, it's out of timeouts and the seconds matter
function cpuSpikeCheck() {
  const s = G.poss;
  if ((isHumanSide(s) && !coachCalls()) || G.versus || !G.pendingRunoff || G.down >= 4 || G.patSide != null || G.twoPt) return false;
  if (G.timeouts[s] > 0 || !(G.quarter === 2 || G.quarter >= 4) || G.clock > 22 || G.clock < 3) return false;
  const S = situation(s);
  if (G.quarter >= 4 && S.margin > 0) return false;
  if (lastSecondKick(S)) return false; // just kick it
  if (S.fgLong && (G.quarter === 2 || (S.margin >= -3 && S.margin <= 0))) return true;   // stop it, then kick
  return S.own > 40 && G.down <= 2;
}
// the clock already ran live during the huddle (see update()); snapping or spiking just stops it running
function burnHuddleClock() {
  G.pendingRunoff = 0;
}
function spikeBall(cpu) {
  if (!(G.phase === 'playcall' || G.phase === 'presnap') || (!cpu && !isHumanSide(G.poss)) || G.down >= 4 || G.patSide != null) return;
  burnHuddleClock();
  G.clock = Math.max(0, G.clock - 1);
  showBanner('SPIKED!', 'Clock stopped', '#fff', 1.1); Sound.tackle();
  G.down++;
  G.next = null;
  G.phase = 'dead'; G.deadT = 0.9; G.ball = G.ball || { x: G.los, y: G.ballY, z: 0 };
  if (G.ball) { G.ball.holder = null; G.ball.x = G.los - dirOf(G.poss) * 1; G.ball.dead = { vx: 0, vy: 0 }; G.ball.bounce = 0.7; }
}
function audible() {
  if (G.phase !== 'presnap' || coachCalls()) return;
  if (Crowd.cantHear()) return; // loud road crowd: the call doesn't get through
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
  const p = G.O[slot]; if (!p || (G.play.off.paths && G.play.off.paths[slot]) || G.play.off.lateral) return; // trick plays keep their design
  if (Crowd.cantHear()) return;
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
