// ---- Moves: hurdle, pocket feel (step up, throwing on the run, QB nerves), special catches, wind ----
// p.mvK = the move pose he's in (1 hurdle, 2 one-handed catch, 3 diving catch, 4 toe-tap), p.mvT = time left in it.
// Both are filmed by replay.js / highlights.js and sent online (net.js PSTAT), so the poses show up everywhere.
const MV = { HURDLE: 1, ONEHAND: 2, DIVE: 3, TOE: 4 };
const MV_T = { 1: 0.6, 2: 0.5, 3: 0.62, 4: 0.55 };
const HURDLE_CD = 2.2, HURDLE_UP = [0.06, 0.44]; // in the air between these (seconds into the hurdle), then the landing
const mvCount = k => { const c = G.mvCount || (G.mvCount = {}); c[k] = (c[k] || 0) + 1; };

// every frame (all phases): pose timers, the hurdle's air time, the QB's nerves
function moveTick(p, dt) {
  p.hurdleCd = Math.max(0, (p.hurdleCd || 0) - dt);
  const b = G.ball;
  // nerves: a free rusher closing in on the passer in the pocket
  const passing = G.phase === 'live' && b && b.holder === p && G.bstate === 'snap' && G.O && p === curPasser() && p.off;
  const nv = passing ? qbNerve(p) : 0;
  p.nerve = (p.nerve || 0) + (nv - (p.nerve || 0)) * Math.min(1, dt * 10);
  if (p.nerve < 0.01) p.nerve = 0;
  if (G.phase === 'live' && b && b.holder === p && p.off && G.handedOff && p !== G.O[0] && !p.wetChecked && G.credit && G.credit.kind === 'rush') wetExchange(p);
  if (!(p.mvT > 0)) { p.mvAir = false; return; }
  p.mvT = Math.max(0, p.mvT - dt);
  const e = MV_T[p.mvK] - p.mvT;
  if (p.mvK === MV.HURDLE) {
    p.mvAir = e > HURDLE_UP[0] && e < HURDLE_UP[1] && p.down <= 0;
    if (e >= HURDLE_UP[1] && !p.landed) { p.landed = true; addDust(p.x, p.y, 3); if (wet()) groundMark(p.x, p.y, 1, true); }
  } else p.mvAir = false;
  if (p.mvK === MV.TOE && e > 0.1 && e < 0.4 && Math.random() < dt * 20) { addDust(p.x - p.face.dir * 0.5, p.y, 1); groundMark(p.x - p.face.dir * 0.4, p.y, 0.7, true); } // the toes dragging
  if (p.mvT <= 0) {
    // diving catch: he's on the ground with it, the play is over
    if (p.mvK === MV.DIVE && G.phase === 'live' && b && b.holder === p) endPlay({ type: 'tackle', carrier: p, x: p.x, y: p.y });
    p.mvK = 0; p.mvAir = false;
  }
}

// ---------- HURDLE ----------
// leaps over a guy going low (a dive, or a DB cutting at the legs). A tackler standing up gets a free shot at him though,
// and coming down he's off balance: bigger hits, a few more fumbles
function canHurdle(p) { return G.phase === 'live' && G.ball.holder === p && p.down <= 0 && !(p.hurdleCd > 0) && !(p.mvT > 0) && G.bstate !== 'snap' && !(p.dive > 0); }
function doHurdle(p) {
  if (!canHurdle(p)) return;
  if (chance(Weather.slipChance() * 0.6)) { slipDown(p); p.hurdleCd = 1; return; } // pushing off a wet field
  p.mvK = MV.HURDLE; p.mvT = MV_T[1]; p.hurdleCd = HURDLE_CD; p.landed = false; p.mvAir = false;
  const sp = Math.hypot(p.vx, p.vy), d = dirOf(p.side);
  if (sp < p.spd * 0.5) p.vx += d * 2.5; // a standing hurdle still goes forward
  p.vx *= 0.96; p.vy *= 0.96; p.dvx = p.vx; p.dvy = p.vy;
  G.hurdles = (G.hurdles || 0) + 1; Sound.boing(); addDust(p.x, p.y, 3);
  p.head.vy -= 260;
}
// how low this tackler goes (rolled once per try): dives always, DBs often cut at the legs, linemen never
function lowTackle(df) {
  if (df.dive > 0) return true;
  return chance(df.pos === 'CB' || df.pos === 'S' ? 0.45 : df.pos === 'LB' ? 0.1 : df.pos === 'DL' ? 0 : 0.25);
}
// added to the tackle chance (checkTackles)
function hurdleTkl(car, df) {
  if (car.mvK !== MV.HURDLE || !(car.mvT > 0)) return 0;
  if (car.mvAir) return lowTackle(df) ? -0.75 : 0.18; // over the top of him, or right into a guy standing up
  return 0.12; // landing
}
const hurdling = car => !!car && car.mvK === MV.HURDLE && car.mvT > 0;
const hurdleBoom = car => hurdling(car) && chance(car.mvAir ? 0.5 : 0.65); // caught in the air / on the way down = a big hit
const hurdleFum = car => hurdling(car) ? 1.7 : car && car.mvK === MV.DIVE && car.mvT > 0 ? 0 : 1; // (a diving catch: he's already down, no fumble)
function hurdledIt(car) { G.hurdleOk = (G.hurdleOk || 0) + 1; G.crowdHype = Math.min(1, G.crowdHype + 0.3); return 'HURDLED!'; }
// CPU runners hurdle a guy diving at them (or a DB about to go low) now and then
function cpuHurdle(p, foes) {
  if (p.isHuman || p.pos === 'OL' || p.pos === 'DL' || !canHurdle(p) || p.tuck) return;
  const d = dirOf(p.side);
  for (const f of foes) {
    const dd = dist(f, p); if (dd > 2.6 || dd < 1.1 || d * (f.x - p.x) < 0.4) continue;
    const pc = (f.dive > 0 ? 0.25 : 0) * (1 + (rat(p, 'AGI') - 75) / 50);
    if (pc > 0 && chance(pc)) { doHurdle(p); return; }
  }
}

// ---------- POCKET ----------
// pushing toward the line in the pocket climbs it a step or two (sprint, X / RUN = take off)
function pocketStep(p, sprint) {
  const b = G.ball;
  if (sprint || p !== curPasser() || b.holder !== p || G.bstate !== 'snap' || G.humanScramble || !humanCanThrow()) return;
  const d = dirOf(p.side), fwd = d * p.dvx; if (fwd <= 0) return;
  const room = d * (G.los - d * 1.3 - p.x);
  p.dvx = d * (room <= 0 ? 0 : Math.min(fwd * 0.55, room * 5));
}
// CPU QB: a rusher coming off the edge (beside or behind him) with nobody in front = step up into the pocket
function cpuStepUp(p, near, d) {
  if (d * (near.x - p.x) > -0.3) return null; // only a rusher coming from behind him: otherwise slide away like before
  const tx = Math.min(d * (p.x + d * 1.6), d * (G.los - d * 2.2)) * d;
  if (d * (tx - p.x) < 0.3) return null; // already as far up as he can go
  if (G.D.some(df => df.down <= 0 && d * (df.x - p.x) > 0 && Math.hypot(df.x - tx, df.y - p.y) < (df.engaged ? 1.5 : 2.2))) return null;
  return { x: tx, y: p.y };
}
// QB composure: awareness + overall. 0 = rattled easily, 1 = ice in his veins
const qbCool = qb => clamp((rat(qb, 'AWR') * 0.5 + (qb.ovr || 75) * 0.5 - 62) / 34, 0, 1);
// 0..1 how hot it is in the pocket right now (the closest free rusher)
function qbNerve(qb) {
  if (xfOn(qb, 'proreads')) return 0; // Pro Reads: ignores the rush
  let dn = 99;
  for (const df of G.D) if (df.down <= 0 && (!df.engaged || xfOn(df, 'fearmonger'))) dn = Math.min(dn, dist(df, qb) - (df.engaged ? 0.8 : 0) - (abHas(df, 'reach') ? 0.4 : 0));
  return clamp((3.2 - dn) / 1.7, 0, 1);
}
// extra throw error from the rush (replaces the old flat "pressure" penalty, about the same on average)
function nerveErr(qb, arm, elite) {
  const n = qbNerve(qb); if (n <= 0) return 0;
  const cool = qbCool(qb);
  return (0.6 * (1 - elite * 0.5) + arm.accF * 0.45) * Math.pow(n, 1.2) * lerp(1.3, 0.75, cool);
}
// throwing on the run: faster = wilder, throwing where he's running is easier than throwing back across his body
function runThrowErr(qb, arm, tx, ty) {
  const sp = qb.speedNow || 0; if (sp <= 4) return 0;
  const L = Math.hypot(tx - qb.x, ty - qb.y) || 1, c = (qb.vx * (tx - qb.x) + qb.vy * (ty - qb.y)) / (sp * L);
  const way = c > 0 ? lerp(1, 0.55, c) : lerp(1, 1.5, -c);
  const feet = clamp(1.1 - (rat(qb, 'AGI') - 70) / 100, 0.85, 1.2); // nimble QBs keep their feet under them
  return (0.3 + arm.accF * 0.3) * Math.min(1.15, sp / 8) * way * feet;
}
// the little shake next to the passer's head when the rush gets to him
function drawNerves(g, p, x, y) {
  const n = p.nerve; if (!(n > 0.3) || p.down > 0 || G.phase !== 'live') return;
  const a = Math.min(1, (n - 0.3) / 0.5) * 0.7, j = Math.sin(G.time * 52) * 1.4 * n, cy = y - 62;
  g.save(); g.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`; g.lineWidth = 2; g.lineCap = 'round';
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const r = 27 + i * 6, c = s > 0 ? 0 : Math.PI;
    g.beginPath(); g.arc(x + j * s, cy, r, c - 0.42 + i * 0.08, c + 0.42 - i * 0.08); g.stroke();
  }
  g.restore();
}

// ---------- CATCHES ----------
const nearLine = (v, max) => Math.min(v, max - v); // < 0 = out
// called by resolveCatch() right before a catch is ruled: picks the pose (and on a toe-tap, keeps his feet in)
function catchStyle(rcv, f, land, rd) {
  G.catchStyle = null;
  if (f.pitch || G.special) return null;
  const cth = rat(rcv, 'CTH'), side = nearLine(rcv.y, FIELD_W), back = rcv.x < 10 || rcv.x > 110 ? nearLine(rcv.x, 120) : 9;
  let k = rcv.mvK === MV.ONEHAND && rcv.mvT > 0 ? 'onehand' : null;
  // toe-tap: right on the sideline (or the end line), a good receiver drags both feet in
  const edge = Math.min(side, back);
  if (!k && edge < 1 && edge >= -0.9) {
    if (edge < -0.25) { // he'd be out: a good receiver gets the toes down anyway
      if (!chance(clamp(0.2 + (cth - 75) / 50, 0.1, 0.6))) return null;
      if (side === edge) rcv.y = rcv.y < MID ? 0.25 : FIELD_W - 0.25; else rcv.x = rcv.x < 60 ? 0.25 : 119.75; // clearly in: no review
      k = 'toe';
    } else if (chance(0.65)) k = 'toe';
  }
  if (!k && rd > 1.2 && chance(0.5)) k = 'dive'; // had to lay out for it
  if (!k && rd > 0.6 && cth >= 86 && chance(0.05 + (cth - 86) * 0.008)) k = 'onehand'; // a star reaching out with one hand
  if (!k) return null;
  setCatchPose(rcv, k, land);
  G.catchStyle = k; G.lastCatch = { k, t: G.time }; mvCount(k);
  addText(rcv.x, rcv.y, k === 'toe' ? 'TOE TAP!' : k === 'dive' ? 'DIVING CATCH!' : 'ONE HANDED!', '#9cff9c', 17, 0.9);
  return k;
}
function setCatchPose(rcv, k, land) {
  rcv.mvK = k === 'toe' ? MV.TOE : k === 'dive' ? MV.DIVE : MV.ONEHAND; rcv.mvT = MV_T[rcv.mvK];
  if (k === 'dive') { // lays out toward the ball and slides on the grass
    const dx = land.x - rcv.x, dy = land.y - rcv.y, m = Math.hypot(dx, dy) || 1, v = Math.min(9, 3 + m * 4);
    rcv.vx = dx / m * v; rcv.vy = dy / m * v; rcv.dvx = rcv.dvy = 0; rcv.dive = 0;
    if (Math.abs(dx) > 0.2) rcv.face.dir = Math.sign(dx);
    rcv.down = MV_T[MV.DIVE] + 0.15; rcv.downDir = rcv.face.dir; addDust(rcv.x, rcv.y, 4);
  } else if (k === 'toe') { // feet planted, drifting toward the line
    rcv.vx *= 0.3; rcv.vy *= 0.3;
  }
}
// a star receiver saves a ball that was going to hit the turf with one hand (rare, slightly off throws only)
function oneHandSave(rcv, rd, def, dd) {
  if (G.special || rd < 0.55) return false;
  const cth = rat(rcv, 'CTH'); if (cth < 85) return false;
  if (!chance(clamp((cth - 82) / 15, 0, 1) * 0.2 * (def && dd < 1.2 ? 0.6 : 1))) return false;
  rcv.mvK = MV.ONEHAND; rcv.mvT = MV_T[MV.ONEHAND];
  return true;
}
// just out of reach: he lays out for it. Better hands = more of these come down with it
function divingTry(rcv, f, land, rd, def, dd) {
  if (G.special || rd > 2.0 || (def && dd < 1.0) || rcv.down > 0 || rcv.engaged) return false;
  if (rcv.y < 0 || rcv.y > FIELD_W || rcv.x < 0 || rcv.x > 120) return false;
  const front = rcv.speedNow > 2 ? ((land.x - rcv.x) * rcv.vx + (land.y - rcv.y) * rcv.vy) / (rcv.speedNow * rd) : 0;
  const toQB = ((f.sx - rcv.x) * (land.x - rcv.x) + (f.sy - rcv.y) * (land.y - rcv.y)) / ((Math.hypot(f.sx - rcv.x, f.sy - rcv.y) || 1) * rd);
  if (front < 0.3 && toQB < 0.3) return false; // only balls out in front of him or thrown short
  const pc = clamp(0.32 + (rat(rcv, 'CTH') - 78) / 70 - (rd - 1.45) * 0.4 - Weather.catchPenalty() + (f.cp === 'perfect' ? 0.15 : f.cp === 'good' ? 0.07 : 0), 0.08, 0.6);
  setCatchPose(rcv, 'dive', land);
  if (!chance(pc)) { // can't hang on
    rcv.mvK = MV.DIVE; G.catchStyle = 'diveMiss'; mvCount('diveMiss');
    incomplete(rcv, 'JUST MISSED'); return true;
  }
  G.catchStyle = 'dive'; G.lastCatch = { k: 'dive', t: G.time }; mvCount('dive');
  const b = G.ball;
  b.holder = rcv; G.bstate = 'run'; Sound.catch(); G.catchX = rcv.x;
  rcv.mouth = 'O'; rcv.mouthT = 0.4;
  stat(f.passer).comp++; G.credit = { p: rcv, kind: 'rec', passer: f.passer };
  addText(rcv.x, rcv.y, 'DIVING CATCH!', '#9cff9c', 17, 0.9);
  if (isHumanSide(rcv.side)) setHD(rcv.side, rcv);
  return true;
}
const CATCH_LINES = {
  onehand: ['One-handed grab!', 'He snags it with one hand!'],
  dive: ['Diving catch!', 'He laid out for that one!'],
  toe: ['Toe-tap on the sideline, both feet in!', 'Drags the toes, in bounds!'],
  diveMiss: ['He laid out for it, just out of reach.']
};
// the announcer mentions the catch
if (typeof pbpPlay === 'function') {
  const basePbp = pbpPlay;
  pbpPlay = function (res) {
    const cs = G.catchStyle; G.catchStyle = null;
    const out = basePbp(res);
    const rec = G.credit && G.credit.kind === 'rec' && res.type !== 'inc';
    if (cs && CATCH_LINES[cs] && G.pbp && G.pbp.length && (cs === 'diveMiss' ? res.type === 'inc' : rec) && !(G.intBy && res.carrier && res.carrier.side !== G.poss)) {
      const L = G.pbp[G.pbp.length - 1]; L.text += ' ' + pick(CATCH_LINES[cs]);
      if (out && (cs === 'onehand' || cs === 'toe')) out.big = true; // worth an instant replay
    }
    return out;
  };
}

// ---------- WIND ----------
// G.wind = { mph, dir, ang }: ang = which way it blows on the field (radians, x = down the field, y = down the screen).
// dir (+1 / -1) is the part across the field, like before (rain lean, flags on the posts)
if (typeof gameWind === 'function') {
  const baseWind = gameWind;
  gameWind = function () {
    const w = baseWind();
    if (w && w.ang == null) w.ang = (w.dir > 0 ? 1 : -1) * rand(0.15, Math.PI - 0.15);
    return w;
  };
}
const windXY = () => { const w = G.wind; if (!w || !w.mph) return { x: 0, y: 0, mph: 0 }; const a = w.ang != null ? w.ang : w.dir * Math.PI / 2; return { x: Math.cos(a) * w.mph, y: Math.sin(a) * w.mph, mph: w.mph }; };
// kick meter locked (or the CPU kicks): the wind pushes the aim, and a head / tail wind changes how far it goes
function windAim(km) {
  if (!km || km.windDone) return; km.windDone = true;
  const w = (gameWind(), windXY()); if (!w.mph) return;
  const d = dirOf(km.side), along = w.x * d;
  if (km.kind === 'punt' || km.kind === 'ko' || km.kind === 'onside') km.aim = clamp(km.aim + w.y / 15 * 0.12, -1, 1);
  else if (km.kind === 'fg' || km.kind === 'xp') {
    km.aim = clamp(km.aim + w.y / 15 * 0.08 * (km.yds / 40), -1, 1);
    if (km.need) km.need *= 1 - along / 15 * 0.05;
  }
}
// punts / kickoffs: a tail wind carries it, a head wind knocks it down
function windKickPower(km) {
  const w = windXY(); if (!w.mph || km.kind === 'onside') return;
  const d = dirOf(km.side), along = w.x * d, kp = km.kk ? km.kk.kp : 74;
  const yds = along / 15 * (km.kind === 'punt' ? 5 : 4), per = km.kind === 'punt' ? 18 + (kp - 60) * 0.35 : 22 + (kp - 60) * 0.25;
  km.power = clamp(km.power + yds / Math.max(8, per), 0, 1.15);
}
if (typeof launchReturnKick === 'function') {
  const baseLRK = launchReturnKick;
  launchReturnKick = function () {
    const km = G.km; if (km) { windAim(km); if (!km.windPow) { km.windPow = true; windKickPower(km); } }
    return baseLRK.apply(this, arguments);
  };
}
if (typeof launchKick === 'function') {
  const baseLK = launchKick;
  launchKick = function () { if (G.km) windAim(G.km); return baseLK.apply(this, arguments); };
}
// deep balls drift with the wind (lobs the most, bullets hardly at all). The ball curves into the new spot on the way
function windPass(f, style) {
  const w = windXY(); if (!f || f.pitch || f.kick || !w.mph) return;
  const len = Math.hypot(f.tx - f.sx, f.ty - f.sy); if (len < 15) return;
  const k = (len - 15) * 0.045 / 15 * (style === 'lob' ? 1.6 : style === 'bullet' ? 0.5 : 1) * (f.duck ? 1.3 : 1) * (f.perfect ? 0.5 : 1);
  f.wdx = w.x * k; f.wdy = w.y * k;
  f.tx += f.wdx; f.ty = clamp(f.ty + f.wdy, -0.5, FIELD_W + 0.5);
}
// small wind arrow + speed at the right end of the scorebug
function drawWindTag(g, G, x0, y0, W) {
  if (G.demo || G.mini || !G.teams || G.phase === 'over') return;
  const w = G.wind || (typeof Net !== 'undefined' && Net.role === 'guest' ? null : gameWind());
  if (!w || !(w.mph >= 2)) return;
  const a = w.ang != null ? w.ang : w.dir * Math.PI / 2, cx = x0 + W - 30, cy = y0 + 16;
  g.save(); g.translate(cx, cy); g.rotate(a);
  g.strokeStyle = '#e8ecf2'; g.fillStyle = '#e8ecf2'; g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-8, 0); g.lineTo(4, 0); g.stroke();
  g.beginPath(); g.moveTo(9, 0); g.lineTo(2.5, -4.5); g.lineTo(2.5, 4.5); g.closePath(); g.fill();
  g.restore();
  g.font = '800 12px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#9aa6b5'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`${w.mph} MPH`, cx, y0 + 35);
}

// ---------- WET BALL ----------
// rain / snow: once in a while the handoff squirts loose (fumbles + drops in the wet are in weather.js too)
function wetExchange(p) {
  if (!wet() || G.special || G.mini || p.wetChecked) return; p.wetChecked = true;
  if (!chance((G.weather === 'snow' ? 0.008 : 0.006) * (G.storm ? 1.3 : 1) * Sliders.mul('fum'))) return;
  const b = G.ball; b.holder = null; b.x = p.x; b.y = p.y; b.loose = { vx: rand(-3, 3), vy: rand(-3, 3), t: 0 };
  G.bstate = 'loose'; b.fumbler = p; G.credit = null; mvCount('wetFum');
  showBanner('FUMBLE!', 'Slippery handoff', '#ff9a3d', 1.0); Sound.boing();
}

// ---------- the poses (draw.js drawPlayer) ----------
// same shape as the celly / slide poses: hop, rot, lie, sy, leg(), arm(), head, noBall. own = the pose turns him (not the "down" tilt)
function movePose(p, HIP) {
  const K = p.mvK, T = MV_T[K]; if (!K || !T || !(p.mvT > 0)) return null;
  const e = T - p.mvT, u = clamp(e / T, 0, 1), sm = v => v * v * (3 - 2 * v);
  const P = { hop: 0, rot: 0, sy: 1, lie: 0, legK: 0, head: 0, arm: null, leg: null, noBall: false, own: false };
  if (K === MV.HURDLE) {
    const up = clamp((e - 0.02) / (HURDLE_UP[1] - 0.02), 0, 1), f = e < HURDLE_UP[1] ? sm(Math.min(1, up * 3)) : sm(clamp(1 - (e - HURDLE_UP[1]) / (T - HURDLE_UP[1]), 0, 1));
    P.hop = Math.sin(up * Math.PI) * 36; P.rot = 0.16 * f; P.head = -0.1 * f;
    if (e >= HURDLE_UP[1]) P.sy = 1 - 0.1 * Math.sin((e - HURDLE_UP[1]) / (T - HURDLE_UP[1]) * Math.PI); // lands and sinks into it
    P.leg = (side, hx, hy, kx, ky, fx, fy) => side > 0
      ? { kx: lerp(kx, hx + 13, f), ky: lerp(ky, hy - 4, f), fx: lerp(fx, hx + 15, f), fy: lerp(fy, hy + 7, f) } // lead knee up to his chest, shin hanging
      : { kx: lerp(kx, hx + 9, f), ky: lerp(ky, hy + 1, f), fx: lerp(fx, hx - 5, f), fy: lerp(fy, hy + 5, f) }; // trail knee up, foot folded back
    P.arm = (front, shx, shy) => front ? null : { ex: shx - 7 * f, ey: shy + 8 - 12 * f, hx: shx - 12 * f, hy: shy + 16 - 27 * f }; // free arm up for balance
  } else if (K === MV.ONEHAND) {
    const f = sm(clamp(u * 4, 0, 1)) * (u > 0.75 ? sm(clamp((1 - u) * 4, 0, 1)) : 1);
    P.hop = Math.sin(clamp(u * 1.6, 0, 1) * Math.PI) * 12; P.rot = -0.08 * f; P.head = -0.25 * f;
    P.arm = (front, shx, shy) => front ? { ex: lerp(shx + 4, shx + 11, f), ey: lerp(shy + 10, shy - 6, f), hx: lerp(shx + 10, shx + 22, f), hy: lerp(shy + 8, shy - 13, f) } // up and out past his helmet, ball in the fingertips
      : { ex: shx - 6 * f, ey: shy + 8, hx: shx - 11 * f, hy: shy + 15 };
    P.leg = (side, hx, hy, kx, ky, fx, fy) => side > 0 ? { kx: lerp(kx, hx + 7, f), ky: lerp(ky, hy + 6, f), fx: lerp(fx, hx + 6, f), fy: lerp(fy, hy + 15, f) } : null;
  } else if (K === MV.DIVE) {
    const f = sm(clamp(u / 0.3, 0, 1));
    P.own = true; P.lie = 1.3 * f; P.hop = Math.sin(clamp(u / 0.3, 0, 1) * Math.PI) * 10; P.head = -0.5 * f;
    P.noBall = !(G.ball && G.ball.holder === p);
    P.arm = (front, shx, shy) => ({ ex: lerp(shx + 4, shx + (front ? 10 : 8), f), ey: lerp(shy + 9, shy - (front ? 4 : 2), f), hx: lerp(shx + 9, shx + (front ? 20 : 17), f), hy: lerp(shy + 12, shy - (front ? 9 : 5), f) }); // both arms stretched out ahead under his helmet
    P.leg = (side, hx, hy, kx, ky, fx, fy) => side > 0 ? { kx: lerp(kx, hx + 1, f), ky: lerp(ky, hy + 9, f), fx: lerp(fx, hx + 1, f), fy: lerp(fy, hy + 18, f) }
      : { kx: lerp(kx, hx - 1, f), ky: lerp(ky, hy + 9, f), fx: lerp(fx, hx - 9, f), fy: lerp(fy, hy + 12, f) }; // legs trail out behind, one bent
  } else if (K === MV.TOE) {
    const f = sm(clamp(u * 4, 0, 1)) * (u > 0.8 ? sm(clamp((1 - u) * 5, 0, 1)) : 1);
    P.rot = -0.2 * f; P.head = 0.15 * f;
    P.leg = (side, hx, hy, kx, ky, fx, fy) => side > 0
      ? { kx: lerp(kx, hx + 4, f), ky: lerp(ky, hy + 9, f), fx: lerp(fx, hx + 3, f), fy: lerp(fy, 0, f) }           // planted foot
      : { kx: lerp(kx, hx - 6, f), ky: lerp(ky, hy + 9, f), fx: lerp(fx, hx - 17, f), fy: lerp(fy, -1, f) };      // toe dragging behind on the grass
    P.arm = (front, shx, shy) => front ? { ex: lerp(shx + 4, shx + 9, f), ey: lerp(shy + 10, shy + 1, f), hx: lerp(shx + 10, shx + 16, f), hy: lerp(shy + 8, shy - 4, f) }
      : { ex: lerp(shx + 6, shx + 8, f), ey: lerp(shy + 9, shy + 3, f), hx: lerp(shx + 12, shx + 15, f), hy: lerp(shy + 13, shy + 1, f) }; // both hands on it, out in front
  }
  return P;
}

// a new game: clear the move counters
if (typeof initGame === 'function') {
  const baseInit = initGame;
  initGame = function () { Object.assign(G, { mvCount: null, hurdles: 0, hurdleOk: 0, lastCatch: null, catchStyle: null }); return baseInit.apply(this, arguments); };
}
