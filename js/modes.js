// ---- Challenges & mini-games: Two-Minute Drill, Daily Challenge, QB Targets, Kicking Contest, 40-Yard Dash ----
const Records = {
  get() { try { return JSON.parse(localStorage.getItem('bobbleRecords') || '{}'); } catch (e) { return {}; } },
  set(r) { try { localStorage.setItem('bobbleRecords', JSON.stringify(r)); } catch (e) {} }
};

// seeded random so everybody gets the same Daily Challenge on the same day
function seeded(seed) { let a = hashStr(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

const DAILY_GOALS = [
  { key: 'win14', text: 'Win by 14 or more', check: (me, op) => me - op >= 14 },
  { key: 'score35', text: 'Score 35+ points and win', check: (me, op) => me >= 35 && me > op },
  { key: 'hold10', text: 'Win and hold them to 10 or less', check: (me, op) => me > op && op <= 10 },
  { key: 'clean', text: 'Win with ZERO turnovers', check: (me, op, ts) => me > op && ts.to === 0 },
  { key: 'upset', text: 'Pull off the upset as the underdog', check: (me, op) => me > op },
  { key: 'shoot', text: 'Win a shootout: both teams score 21+', check: (me, op) => me > op && op >= 21 }
];
function dailyToday() {
  const rnd = seeded('bobble-daily-' + todayStr());
  const ids = TEAMS.map((t, i) => i);
  const a = Math.floor(rnd() * 32); let b = Math.floor(rnd() * 32); if (b === a) b = (b + 7) % 32;
  const goal = DAILY_GOALS[Math.floor(rnd() * DAILY_GOALS.length)];
  // for the upset goal, you get the weaker team
  let mine = a, opp = b;
  const ovr = i => { const t = TEAMS[i], all = t.off.concat(t.def); return all.reduce((s, p) => s + p[3], 0) / all.length; };
  if (goal.key === 'upset' && ovr(mine) > ovr(opp)) [mine, opp] = [opp, mine];
  return { date: todayStr(), mine, opp, goal, diff: rnd() < 0.5 ? 1 : 2, home: rnd() < 0.5 };
}

// ======== Two-Minute Drill ========
function startTwoMinute(teamIdx) {
  const me = TEAMS[teamIdx];
  let oi; do { oi = Math.floor(Math.random() * 32); } while (oi === teamIdx);
  const down = pick([3, 4, 4, 6, 7]), base = pick([10, 14, 17, 20, 24]);
  const home = chance(0.5), hs = home ? 0 : 1;
  const score = [0, 0]; score[hs] = base; score[1 - hs] = base + down;
  G.challenge = { type: '2min', down };
  newGame(home ? me : TEAMS[oi], home ? TEAMS[oi] : me, { qtr: 180, diff: 1, humanSide: hs,
    scenario: { quarter: 4, clock: 120, score, poss: hs, own: 25, timeouts: [2, 2], title: 'TWO-MINUTE DRILL', sub: `Down ${down} • 2:00 left • go win it!` } });
}
function startDaily() {
  const d = dailyToday();
  G.challenge = { type: 'daily', goal: d.goal, date: d.date };
  const me = TEAMS[d.mine], op = TEAMS[d.opp];
  newGame(d.home ? me : op, d.home ? op : me, { qtr: 120, diff: d.diff, humanSide: d.home ? 0 : 1 });
  showBanner('DAILY CHALLENGE', d.goal.text, '#ffd23f', 2.8);
}
// returns { ok, text } after a challenge game
function challengeResult(s) {
  const c = G.challenge; if (!c) return null;
  const me = s.score[s.human], op = s.score[1 - s.human];
  const R = Records.get();
  if (c.type === '2min') {
    const ok = me > op;
    R.twoMin = R.twoMin || { wins: 0, tries: 0 }; R.twoMin.tries++; if (ok) R.twoMin.wins++;
    Records.set(R);
    return { ok, text: ok ? `DRIVE COMPLETE! 2-minute record: ${R.twoMin.wins}/${R.twoMin.tries}` : `Came up short. 2-minute record: ${R.twoMin.wins}/${R.twoMin.tries}` };
  }
  if (c.type === 'daily') {
    const ok = c.goal.check(me, op, s.tstats[s.human]);
    R.daily = R.daily || { streak: 0, last: null, done: {} };
    if (ok && !R.daily.done[c.date]) {
      const y = new Date(Date.now() - 864e5); const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      R.daily.streak = R.daily.last === ys ? R.daily.streak + 1 : 1; R.daily.last = c.date; R.daily.done[c.date] = true;
    }
    Records.set(R);
    return { ok, text: ok ? `Goal complete: ${c.goal.text}. Streak: ${R.daily.streak} day${R.daily.streak === 1 ? '' : 's'}` : `Goal missed: ${c.goal.text}. Try again.` };
  }
  return null;
}

// ======== mini-games ========
// shared shell: a fake game state with just the players we need
function miniShell(teamIdx, type) {
  const me = TEAMS[teamIdx]; let oi = (teamIdx + 11) % 32;
  Object.assign(G, { teams: [me, TEAMS[oi]], human: 0, diff: 1, score: [0, 0], quarter: 0, clock: 0, poss: 0, los: 30, ballY: MID, down: 1,
    fx: [], banner: null, flags: [], timeouts: null, special: null, playClock: 0, patSide: null, twoPt: false, demo: false, paused: false, season: false, challenge: null,
    pstats: {}, tstats: [{ pass: 0, rush: 0, to: 0 }, { pass: 0, rush: 0, to: 0 }], refs: [], km: null });
  G.mini = { type, t: 0, score: 0 };
  setFirstDown();
}

// --- QB Target Challenge ---
function startQBTargets(teamIdx) {
  miniShell(teamIdx, 'qb');
  const team = G.teams[0];
  const qb = makePlayer(0, true, 0, team.off[0]);
  qb.x = 30; qb.y = MID; qb.hx = qb.x; qb.hy = qb.y; qb.isHuman = true;
  G.players = [qb]; G.O = [qb]; G.D = [];
  G.ball = { x: qb.x, y: qb.y, z: 1, holder: qb, flight: null, loose: null };
  Object.assign(G.mini, { time: 45, targets: [], throws: 0, hits: 0 });
  for (let i = 0; i < 3; i++) G.mini.targets.push(newTarget());
  G.phase = 'mini'; G.humanPlayer = qb;
  showBanner('QB TARGETS', 'Drag back (or click) to throw • 45 seconds', '#ffd23f', 2.2);
  cam.x = 54; cam.y = MID;
}
function newTarget() {
  const far = rand(0, 1);
  return { x: 38 + far * 36, y: rand(6, FIELD_W - 6), r: 2.3 - far * 0.9, vy: G.mini.time < 30 ? rand(-3, 3) : 0, pop: 0 };
}
function miniQBUpdate(dt) {
  const m = G.mini, qb = G.O[0], b = G.ball;
  m.time = Math.max(0, m.time - dt);
  for (const t of m.targets) { t.y += t.vy * dt; if (t.y < 5 || t.y > FIELD_W - 5) t.vy *= -1; t.pop = Math.max(0, t.pop - dt); }
  // aim / throw
  G.aim = null;
  if (b.holder === qb && m.time > 0) {
    const P = Input.pointer;
    if (P.down && P.moved) { P.aiming = true; const t = aimTarget(qb, P.x0 - P.x, P.y0 - P.y); G.aim = { tx: t.x, ty: t.y, target: null, from: { x: P.x0, y: P.y0 }, to: { x: P.x, y: P.y } }; }
    let tx = null, ty = null;
    if (Input.release && Math.hypot(Input.release.x, Input.release.y) > 28) { const t = aimTarget(qb, Input.release.x, Input.release.y); tx = t.x; ty = t.y; }
    else if (Input.taps.length) { tx = wx(Input.taps[0].x); ty = wy(Input.taps[0].y); }
    if (tx != null && G.mode !== 'mobile' || tx != null && Input.release) qbMiniThrow(qb, tx, ty);
    else if (tx != null && G.mode === 'mobile') { // mobile: tap a target to throw at it
      const t = m.targets.find(t => Math.hypot(t.x - tx, t.y - ty) < t.r + 2); if (t) qbMiniThrow(qb, t.x, t.y);
    }
  }
  if (b.flight) {
    const f = b.flight; f.t += dt; const u = Math.min(1, f.t / f.T);
    b.x = lerp(f.sx, f.tx, u); b.y = lerp(f.sy, f.ty, u); b.z = 1.7 + f.peak * 4 * u * (1 - u) - u * 0.6; b.spin = (b.spin || 0) + dt * 30;
    if (u >= 1) {
      b.flight = null; let best = null, bd = 99;
      for (const t of m.targets) { const d = Math.hypot(t.x - b.x, t.y - b.y); if (d < t.r && d < bd) { bd = d; best = t; } }
      if (best) {
        const pts = bd < best.r * 0.33 ? 300 : bd < best.r * 0.66 ? 200 : 100;
        const far = Math.round((best.x - 30) / 10) * 10;
        m.score += pts + far; m.hits++;
        addText(best.x, best.y, `+${pts + far}${pts === 300 ? ' BULLSEYE!' : ''}`, pts === 300 ? '#ffd23f' : '#9cff9c', 22, 1);
        Sound.catch(); if (pts === 300) Sound.boing();
        m.targets[m.targets.indexOf(best)] = newTarget();
      } else { addText(b.x, b.y, 'MISS', '#ff8a8a', 16, 0.7); }
      b.dead = { vx: 0, vy: 0 }; b.bounce = 0.6;
      setTimeout(() => { if (G.mini && G.mini.type === 'qb') { b.holder = qb; b.dead = null; b.bounce = 0; } }, 250);
    }
  }
  if (b.bounce) { b.bounce -= dt; b.z = Math.abs(Math.sin(b.bounce * 9)) * b.bounce * 2; }
  qb.throwAnim = Math.max(0, qb.throwAnim - dt);
  applyMove(qb, dt); qb.face.dir = 1;
  if (m.time <= 0 && !b.flight && !m.over) { m.over = true; setTimeout(() => miniFinish(), 900); showBanner("TIME'S UP!", `${m.score} points`, '#ffd23f', 1.6); }
}
function qbMiniThrow(qb, tx, ty) {
  const b = G.ball, m = G.mini;
  tx = clamp(tx, 32, 110); ty = clamp(ty, 1, FIELD_W - 1);
  const len = Math.hypot(tx - qb.x, ty - qb.y), spd = (19 + (qb.ovr - 70) * 0.14) * GAME_SPEED;
  const err = (1.4 - (qb.ovr - 60) / 60) * (0.2 + len / 40) * 0.6, a = rand(0, 7), e = Math.abs(rand(-1, 1)) * err;
  tx += Math.cos(a) * e; ty += Math.sin(a) * e;
  b.holder = null; b.flight = { sx: qb.x, sy: qb.y, tx, ty, t: 0, T: Math.max(0.35, len / spd), peak: 0.6 + len * 0.1 };
  qb.throwAnim = 0.3; m.throws++; Sound.throw();
}

// --- Kicking Contest: 25, 30, 35 ... until you miss twice ---
function startKickContest(teamIdx) {
  miniShell(teamIdx, 'kick');
  Object.assign(G.mini, { dist: 25, made: 0, misses: 0, best: 0 });
  showBanner('KICKING CONTEST', 'Make it, move back 5 yards. Two misses and you\'re out!', '#ffd23f', 2.4);
  setTimeout(() => miniNextKick(), 1200);
}
function miniNextKick() {
  const m = G.mini; if (!m || m.type !== 'kick') return;
  G.poss = 0; G.los = goalX(0) - (m.dist - 17); G.ballY = pick([MID, 23.6, 29.7]); setFirstDown();
  G.patSide = null;
  doKick('fg');
}
// called by afterPlay when a mini-game play finishes
function miniAfterPlay() {
  const m = G.mini;
  G.phase = 'mini';
  if (m.type === 'kick') {
    if (G.miniKick) { m.made++; m.best = m.dist; m.dist += 5; m.score = m.best; }
    else m.misses++;
    if (m.misses >= 2 || m.dist > 70) return miniFinish();
    showBanner(`${m.dist} YARDS`, `Made ${m.made} • Misses ${m.misses}/2`, '#fff', 1.2);
    G.phase = 'mini'; setTimeout(() => miniNextKick(), 900);
  }
}

// --- 40-Yard Dash: mash LEFT/RIGHT (or tap) as fast as you can ---
function startDash(teamIdx) {
  miniShell(teamIdx, 'dash');
  const fastest = t => t.off.concat(t.def).slice().sort((a, b) => b[4] - a[4])[0];
  const me = makePlayer(0, true, 2, fastest(G.teams[0]));
  let rt; do { rt = pick(TEAMS); } while (rt === G.teams[0]); G.teams[1] = rt;
  const rival = makePlayer(1, true, 2, fastest(rt)); rival.side = 1; rival.face.dir = 1;
  me.x = rival.x = 10; me.y = MID - 3.5; rival.y = MID + 3.5; me.isHuman = true;
  me.spd = (2.6 + (me.spdR - 50) * 0.16) * 1.15; rival.spd = (2.6 + (rival.spdR - 50) * 0.16) * 1.15;
  G.players = [me, rival]; G.O = [me, rival]; G.D = []; G.humanPlayer = me;
  G.ball = { x: 0, y: 0, z: 0, holder: null, flight: null };
  Object.assign(G.mini, { me, rival, count: 3.2, go: false, power: 0, last: null, done: [null, null], t: 0 });
  G.phase = 'mini'; cam.x = 30; cam.y = MID;
  showBanner('40-YARD DASH', `${me.name} vs ${rival.name}`, '#ffd23f', 2);
}
function miniDashUpdate(dt) {
  const m = G.mini, me = m.me, rv = m.rival;
  if (!m.go) {
    m.count -= dt;
    if (m.count <= 0) { m.go = true; showBanner('GO!', '', '#9cff9c', 0.7); Sound.whistle(); }
    else if (Math.ceil(m.count) !== m.lastShown && m.count < 3) { m.lastShown = Math.ceil(m.count); showBanner(String(m.lastShown), '', '#fff', 0.7); Sound.click(); }
    me.vx = rv.vx = 0;
  } else {
    m.t += dt;
    // mash: alternate keys, or just tap fast on a phone
    const keys = [['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']];
    for (let i = 0; i < 2; i++) if (Input.hit(...keys[i]) && m.last !== i) { m.power = Math.min(1.25, m.power + 0.16); m.last = i; }
    if (Input.hit('Space')) m.power = Math.min(1.25, m.power + 0.08);
    for (const _ of Input.taps) m.power = Math.min(1.25, m.power + 0.14);
    m.power = Math.max(0, m.power - dt * 1.15);
    if (m.done[0] == null) { me.dvx = me.spd * Math.min(1, m.power) * 1.05; me.dvy = 0; }
    if (m.done[1] == null) { const ramp = Math.min(1, m.t / 0.9); rv.dvx = rv.spd * 0.95 * ramp; rv.dvy = 0; }
    for (const p of [me, rv]) { if (m.done[p === me ? 0 : 1] != null) { p.dvx = 0; } p.acc = 30; applyMove(p, dt); p.y = p === me ? MID - 3.5 : MID + 3.5; p.face.dir = 1; }
    for (const [i, p] of [[0, me], [1, rv]]) if (m.done[i] == null && p.x >= 50) { m.done[i] = m.t * 1.2; addText(p.x, p.y, (m.t * 1.2).toFixed(2) + 's', i === 0 ? '#ffd23f' : '#fff', 22, 1.5); if (i === 0) Sound.catch(); }
    if (m.done[0] != null && m.done[1] != null && !m.over) { m.over = true; m.score = m.done[0]; setTimeout(() => miniFinish(), 1200); }
    if (m.t > 15 && !m.over) { m.over = true; m.done[0] = m.done[0] || 99; m.score = m.done[0]; setTimeout(() => miniFinish(), 500); }
  }
  cam.x = clamp(Math.max(me.x, rv.x) + 12, 24, 96);
}

function miniUpdate(dt) {
  const m = G.mini; if (!m) return;
  if (m.type === 'qb') miniQBUpdate(dt);
  else if (m.type === 'dash') miniDashUpdate(dt);
}

function miniFinish() {
  const m = G.mini; if (!m || m.finished) return;
  m.finished = true;
  const R = Records.get();
  let title = '', big = '', sub = '', best = '';
  if (m.type === 'qb') {
    const prev = R.qb || 0; if (m.score > prev) R.qb = m.score;
    title = 'QB TARGETS'; big = `${m.score} pts`; sub = `${m.hits} hits on ${m.throws} throws`; best = m.score > prev ? 'NEW HIGH SCORE' : `High score: ${prev}`;
  } else if (m.type === 'kick') {
    const prev = R.kick || 0; if (m.best > prev) R.kick = m.best;
    title = 'KICKING CONTEST'; big = m.best ? `${m.best} yards` : 'No makes'; sub = `${m.made} field goals made`; best = m.best > prev ? 'NEW RECORD' : `Longest ever: ${prev} yards`;
  } else {
    const t = m.done[0], prev = R.dash || 99, rv = m.done[1];
    if (t < prev) R.dash = +t.toFixed(2);
    title = '40-YARD DASH'; big = t >= 99 ? 'DNF' : `${t.toFixed(2)}s`;
    sub = rv ? `${t < rv ? 'You beat' : 'You lost to'} ${m.rival.name} (${rv.toFixed(2)}s)` : '';
    best = t < prev ? 'NEW PERSONAL BEST' : `Best: ${prev.toFixed(2)}s`;
  }
  Records.set(R);
  G.hooks.onMiniOver && G.hooks.onMiniOver({ type: m.type, title, big, sub, best });
}

// draw targets for the QB game + mini HUD
function drawMini(g, G) {
  const m = G.mini; if (!m) return;
  if (m.type === 'qb') for (const t of m.targets) {
    const x = sx(t.x), y = sy(t.y);
    for (const [k, col] of [[1, '#ff3b30'], [0.66, '#ffffff'], [0.33, '#ff3b30']]) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, t.r * k * PX, t.r * k * PY, 0, 0, 7); g.fill(); }
    g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, t.r * PX, t.r * PY, 0, 0, 7); g.stroke();
    g.fillStyle = '#111'; g.fillRect(x - 2, y - 46, 4, 46); // little pole so it reads as a target
    g.fillStyle = '#ffd23f'; g.font = 'bold 12px Barlow, Arial, sans-serif'; g.textAlign = 'center'; g.fillText(`${Math.round(t.x - 30)} yd`, x, y - 50);
  }
  if (m.type === 'dash') { // finish line
    const fx = sx(50); g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.setLineDash([12, 8]); g.beginPath(); g.moveTo(fx, sy(MID - 8)); g.lineTo(fx, sy(MID + 8)); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffd23f'; g.font = '900 18px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('FINISH', fx, sy(MID - 8) - 8);
  }
}
function drawMiniHUD(g, G) {
  const m = G.mini; if (!m) return;
  g.fillStyle = '#0b0f16ee'; roundRect(g, CW / 2 - 200, 8, 400, 46, 12); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 22px "Barlow Condensed", "Arial Black", sans-serif';
  if (m.type === 'qb') g.fillText(`0:${String(Math.ceil(m.time)).padStart(2, '0')}      ${m.score} PTS`, CW / 2, 40);
  else if (m.type === 'kick') g.fillText(`${m.dist} YD  •  MADE ${m.made}  •  MISSES ${m.misses}/2`, CW / 2, 40);
  else {
    g.fillText(m.go ? `${(m.t * 1.2).toFixed(2)}s` : 'GET READY', CW / 2, 40);
    // mash meter
    g.fillStyle = '#000a'; roundRect(g, CW / 2 - 150, CH - 70, 300, 22, 11); g.fill();
    g.fillStyle = m.power > 0.85 ? '#2fd06b' : '#ffd23f'; roundRect(g, CW / 2 - 148, CH - 68, 296 * Math.min(1, m.power), 18, 9); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 14px Barlow, Arial, sans-serif';
    g.fillText(G.mode === 'mobile' ? 'TAP TAP TAP as fast as you can!' : 'Mash ← → (or A D) back and forth!', CW / 2, CH - 80);
  }
}
