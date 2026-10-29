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
  G.poss = r;
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
  if (isHumanSide(k) && !G.demo && !(G.sitOut && kind === 'punt') && !autoKick()) { G.phase = 'kickmeter'; G.km.wait = 0.35; return; }
  // CPU kickoffs: mostly land in the field so you get to return them, sometimes a deep boot
  G.km.power = kind === 'onside' ? rand(0.3, 0.8) : kind === 'ko' ? (chance(0.7) ? rand(0.15, 0.68) : rand(0.7, 0.98)) : rand(0.6, 0.98); G.km.aim = rand(-0.4, 0.4);
  if (isHumanSide(k) && autoKick() && kind !== 'onside') { const q = clamp((kk.ka - 60) / 35, 0, 1); G.km.power = clamp(rand(0.55, 0.85) + q * 0.15, 0.4, 1); G.km.aim = rand(-0.4, 0.4) * (1.2 - q * 0.6); } // Coach Mode: your kicker's rating decides it
  G.phase = 'kickmeter'; G.km.cpuT = 0.8; G.km.stage = 3; // short pause so you can see the lineup
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
  if (f.kick === 'punt' && (!isHumanSide(rt.side) || coachOn()) && cover < 3.5) { addText(rt.x, rt.y, 'FAIR CATCH', '#fff', 18, 1); return endPlay({ type: 'kickdead', x: rt.x, why: 'FAIR CATCH' }); }
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
  if (G.special === 'fgblock') return endBlocked(res);
  const r = G.poss, k = 1 - r, kind = G.special, rd = dirOf(r);
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

// ======== live field goals / extra points ========
// The FG unit runs a real play: center snaps it, the holder (the punter) spots it, the kicker steps into it,
// the line holds up the rush. Blocks come from where the rushers actually are when the ball leaves the foot.
const FG_SNAP = 0.36;  // snap flight
const FG_SET = 0.62;   // holder has it down, kicker starts his steps
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
  at(h, kx, ky + 0.85); h.kneel = 1;
  at(O[0], kx - d * 2.6, ky - 1.7);
  for (const p of O) { p.role = p.slot >= 2 ? 'fgblock' : 'route'; p.route = null; p.blockTarget = null; } // 'route' keeps the kicker/holder out of the block fights
  D.forEach((p, i) => { at(p, L + d * FG_DL[i][0], by + FG_DL[i][1]); p.assign = i === 4 || i === 7 ? { type: 'zone', d: 10, y: 'mid' } : { type: 'rush' }; });
  const b = G.ball; b.holder = null; b.flight = null; b.loose = null; b.x = L; b.y = by; b.z = 0.2;
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
function fgRushing() { const km = G.km, h = G.humanPlayer; return G.phase === 'kickmeter' && !!km && (km.kind === 'fg' || km.kind === 'xp') && !G.mini && !!h && !h.off && h.side !== km.side; }
function fgSnap() {
  const L = G.km.live; if (!L || L.snapT != null) return;
  L.snapT = L.t; Sound.hike(); addDust(G.los, G.ballY, 3);
  G.play.t = 0; G.bstate = 'snap'; G.lastResult = null; G.credit = null; G.lastTackler = null;
  if (typeof Replay !== 'undefined') Replay.begin();
}
// every frame of a live kick (kick meter phase, and the ball in the air after it)
function fgLive(dt) {
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
  else if (st < FG_SNAP) { const u = st / FG_SNAP; b.x = lerp(G.los, L.kx, u); b.y = lerp(G.ballY, L.ky + 0.4, u); b.z = 0.5 + Math.sin(u * Math.PI) * 0.5; b.spin = (b.spin || 0) + dt * 20; }
  else if (!L.kicked) { const u = clamp((st - FG_SNAP) / (FG_SET - FG_SNAP), 0, 1); b.x = L.kx; b.y = lerp(L.ky + 0.4, L.ky, u); b.z = lerp(0.9, 0.3, u); }
  // who goes where
  for (const p of G.players) {
    if (p.down > 0 || p.stun > 0 || p.dive > 0) { if (p.down > 0 || p.stun > 0) p.dvx = p.dvy = 0; continue; }
    if (st < 0 || L.kicked != null && L.t - L.kicked > 0.35) { p.dvx = p.dvy = 0; continue; } // in the stance / play's over
    if (L.kicked != null) { p.dvx *= 0.9; p.dvy *= 0.9; continue; } // pull up after the kick
    if (p === kick) {
      const tx = L.kx - d * 0.55, ty = L.ky - 0.45, left = Math.max(0.05, L.kickAt - st);
      if (st < FG_SET) { p.dvx = p.dvy = 0; continue; }
      const dx = tx - p.x, dy = ty - p.y, m = Math.hypot(dx, dy);
      const sp = Math.min(6, m / left); p.dvx = m > 0.05 ? dx / m * sp : 0; p.dvy = m > 0.05 ? dy / m * sp : 0;
    } else if (p === hold) { p.dvx = p.dvy = 0; }
    else if (p.off) fgBlockAI(p, L);
    else if (!L.rush) { p.dvx = p.dvy = 0; }
    else {
      if (!(p.isHuman && withSide(p.side, () => fgHumanRush(p, dt, L)))) fgRushAI(p, L, st);
      if (p.engaged) { p.dvx *= 0.5; p.dvy *= 0.5; } // the kick unit sits down and anchors: no driving the pile into the kicker
    }
  }
  const hp = st < 0 && L.rush && G.D.find(p => p.isHuman);
  if (hp) withSide(hp.side, () => fgHumanRush(hp, dt, L)); // pick your rusher before the snap
  if (st >= 0 && L.kicked == null) resolveBlocks(dt * (st < 1.2 ? 0.7 : 0.2)); // FG protection holds longer than a pass set, then anchors (a slow kicker isn't a sure block)
  for (const p of G.players) applyMove(p, dt);
  separate();
  hold.face.dir = -d;
  if (L.kicked == null && st >= 0 && typeof Replay !== 'undefined' && Replay.rec) Replay.record();
  // foot meets ball
  if (G.phase === 'kickmeter' && km.locked && st >= L.kickAt && L.kicked == null) {
    L.kicked = L.t;
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
  if (chance(clamp(0.25 + (rat(p, 'PRS') - rat(bl, 'PBK')) / 90, 0.1, 0.4))) {
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
    const jf = p.jump > 0 ? 1 + 0.8 * Math.sin((1 - p.jump / 0.55) * Math.PI) : p.isHuman ? 0.7 : 1; // a human has to time his jump
    pb *= jf * (1 + (low - 1) * 0.5) * clamp(Math.pow(rat(p, 'PRS') / ol, 2), 0.6, 1.6) * (p.engaged ? 0.35 : 1);
    each.push([p, Math.min(0.4, pb)]);
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
  b.holder = null; b.flight = null; b.z = 1.4; b.x = by.x - d * 0.7; b.y = lerp(b.y, by.y, 0.7); // off his hands
  const k = G.O[0]; k.throwAnim = 0.3; k.vx = d * 3; // he still swings through
  b.loose = { vx: -d * rand(3, 8), vy: rand(-3, 3) + Math.sign(b.y - by.y) * 2, t: 0 };
  for (const p of G.players) { p.engaged = null; p.kneel = 0; }
  by.jump = Math.max(by.jump || 0, 0.3); by.head.vy -= 300;
  showBanner('BLOCKED!', `${by.name} gets a hand on it!`, isHumanSide(by.side) && !isHumanSide(s) ? '#9cff9c' : '#ff6040', 1.6);
  Sound.tackle(); cam.shake = 9; G.crowdHype = 1.3; G.slowmo = 0.5;
  addText(b.x, b.y, 'BLOCKED!', '#ff9a3d', 26, 1);
  addPbp(`${lastName(km.kk.name)}'s ${km.kind === 'xp' ? 'extra point' : `${km.yds}-yard field goal`} is BLOCKED by ${lastName(by.name)}!`, 'Special teams!');
  G.lastResult = { big: true, type: 'block' };
}
// a blocked kick bounces loose: the defense can scoop it and take it the other way
function fgScoop(p) {
  const b = G.ball;
  b.loose = null; b.holder = p; G.bstate = 'run'; G.blk.flip = true; Sound.catch();
  addText(p.x, p.y, 'SCOOP!', '#ffd23f', 22, 0.9);
  if (isHumanSide(p.side)) setHD(p.side, p);
}
function endBlocked(res) {
  const B = G.blk, s = B.side, car = res.carrier, cs = car ? car.side : s;
  let x = res.x != null ? res.x : G.ball.x;
  G.special = null; G.blk = null;
  if (B.kind === 'xp') { G.clock = B.clock; G.patSide = null; } // a try never runs the clock
  if (res.type === 'td' && cs !== s) {
    G.score[cs] += B.kind === 'xp' ? 2 : 6; G.deadT = isHumanSide(cs) ? 3.8 : 2.5;
    car.down = 0; car.dive = 0;
    if (isHumanSide(cs) && !coachOn()) G.cellyGuy = car; else Celly.cpu(car);
    showBanner(B.kind === 'xp' ? 'DEFENSIVE 2 POINTS!' : 'BLOCKED KICK TD!', `${car.name} • ${G.teams[cs].name}`, isHumanSide(cs) ? '#ffd23f' : '#ff6040', 2.6);
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
  if (B.flip) { G.next = { drive: s, x: clamp(x, 11, 109) }; return; } // got it back after the defense had it: new set of downs
  G.ballY = clamp(res.y != null ? res.y : G.ballY, 20, FIELD_W - 20);
  G.next = advanceDown(x, true); // kicking team falls on it: on 4th down that's a turnover on downs
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
