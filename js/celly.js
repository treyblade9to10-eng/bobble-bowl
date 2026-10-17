// ---- Touchdown celebrations: 10 cellys, each one a little animation with its own poses + effects ----
// Keys: arrows / WASD = Leap, Griddy, Spike, Dab   1-4 = Flex, Bow, Shush, Moonwalk   E = Nap   F = Bowling (the squad joins in)
const CELLYS = [
  { id: 'leap', name: 'LEAP', keys: ['ArrowUp', 'KeyW'], dur: 1.7, say: 'BACKFLIP!' },
  { id: 'griddy', name: 'GRIDDY', keys: ['ArrowDown', 'KeyS'], dur: 2.6, say: 'THE GRIDDY!' },
  { id: 'spike', name: 'SPIKE', keys: ['ArrowLeft', 'KeyA'], dur: 1.6, say: 'SPIKE IT!' },
  { id: 'dab', name: 'DAB', keys: ['ArrowRight', 'KeyD'], dur: 1.8, say: 'DAB!' },
  { id: 'flex', name: 'FLEX', keys: ['Digit1'], dur: 2.2, say: 'TOO STRONG!' },
  { id: 'bow', name: 'BOW', keys: ['Digit2'], dur: 2.2, say: 'THANK YOU!' },
  { id: 'shush', name: 'SHUSH', keys: ['Digit3'], dur: 2.2, say: 'SHHHH...' },
  { id: 'moon', name: 'MOONWALK', keys: ['Digit4'], dur: 2.6, say: 'SMOOTH!' },
  { id: 'nap', name: 'NAP', keys: ['KeyE'], dur: 2.8, say: 'NAP TIME' },
  { id: 'bowl', name: 'BOWLING', keys: ['KeyF'], dur: 3.4, say: 'STRIKE!', team: true },
  { id: 'angel', name: 'SNOW ANGEL', keys: ['KeyR'], dur: 3.0, say: 'SNOW ANGEL!', wx: 'snow' },
  { id: 'slide', name: 'MUD SLIDE', keys: ['KeyC'], dur: 2.4, say: 'SLIP AND SLIDE!', wx: 'rain' }
];
// team signature cellys (key G): only the team they belong to can do them
CELLYS.push(
  { id: 'lambeau', name: 'LAMBEAU LEAP', keys: ['KeyG'], dur: 3.6, say: 'LAMBEAU LEAP!', club: ['GB'] },
  { id: 'flap', name: 'BIRD GANG', keys: ['KeyG'], dur: 2.4, say: 'FLY EAGLES FLY!', club: ['PHI'] },
  { id: 'skol', name: 'SKOL CLAP', keys: ['KeyG'], dur: 3.0, say: 'SKOL!', club: ['MIN'] },
  { id: 'salute', name: 'MILE HIGH SALUTE', keys: ['KeyG'], dur: 2.2, say: 'MILE HIGH SALUTE!', club: ['DEN'] },
  { id: 'towel', name: 'TERRIBLE TOWEL', keys: ['KeyG'], dur: 2.6, say: 'HERE WE GO!', club: ['PIT'] },
  { id: 'twelve', name: '12TH MAN', keys: ['KeyG'], dur: 2.4, say: 'GET LOUD!', club: ['SEA'] },
  { id: 'bark', name: 'DAWG POUND', keys: ['KeyG'], dur: 2.4, say: 'WOOF WOOF!', club: ['CLE'] },
  { id: 'roar', name: 'ROAR', keys: ['KeyG'], dur: 2.2, say: 'ROAR!', club: ['DET', 'CHI', 'JAX', 'CIN', 'CAR'] }
);
// unlockable cellys (keys 5-9): earned in the Trophy Case, see unlocks.js
CELLYS.push(
  { id: 'robot', name: 'THE ROBOT', keys: ['Digit5'], dur: 2.6, say: 'BEEP BOOP', lock: { tds: 10 } },
  { id: 'superman', name: 'SUPERMAN', keys: ['Digit6'], dur: 2.4, say: 'UP, UP AND AWAY!', lock: { wins: 5 } },
  { id: 'shimmy', name: 'SHIMMY', keys: ['Digit7'], dur: 2.4, say: 'SHIMMY!', lock: { wins: 15 } },
  { id: 'worm', name: 'THE WORM', keys: ['Digit8'], dur: 3.0, say: 'THE WORM!', lock: { tds: 30 } },
  { id: 'heisman', name: 'HEISMAN', keys: ['Digit9'], dur: 2.4, say: 'HEISMAN POSE!', lock: { titles: 1 } }
);
// weather cellys only work when the field has snow / is soaked; team cellys only for their team
const cellyOk = (c, cg) => (!c.wx || c.wx === G.weather) && (!c.club || (cg && G.teams && c.club.includes(G.teams[cg.side].id))) && (!c.lock || (typeof Unlocks !== 'undefined' && Unlocks.has(c.id)));
const clubCelly = cg => cg && G.teams && CELLYS.find(c => c.club && c.club.includes(G.teams[cg.side].id));
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

const Celly = {
  // human: check the celly keys
  input(cg) {
    for (const c of CELLYS) if (cellyOk(c, cg) && Input.hit(...c.keys)) return this.start(cg, c.id);
  },
  start(cg, id) {
    const c = CELLYS.find(k => k.id === id); if (!c || !cg) return;
    if (cg.tdRun) { cg.cellyNext = id; return; } // still trotting into the end zone: dance when he gets there
    if (cg.celly && cg.celly.t < 0.5) return; // let the last one get going first
    cg.celly = { type: id, t: 0, fx: {} }; cg.celebrate = c.dur + 0.5; cg.down = 0; cg.dive = 0; cg.tdRun = null; cg.speedNow = 0;
    if (c.id === 'slide' || c.id === 'moon') cg.face.dir = c.id === 'slide' ? -dirOf(cg.side) : dirOf(cg.side); // slide back toward the field, moonwalk deeper
    cg.cx0 = cg.x; cg.cy0 = cg.y;
    addText(cg.x, cg.y - 2.5, c.say, '#ffd23f', 26, 1.1);
    if (G.banner && G.banner.dur - G.banner.t > 0.35) G.banner.t = G.banner.dur - 0.35; // clear the TOUCHDOWN banner so you can see it
    Sound.boing(); Sound.crowd(false); G.crowdHype = 1.5;
    if (G.phase === 'dead') G.deadT = Math.max(G.deadT, c.dur + 0.5); // stay on it until it's done
    if (c.team) this.setupBowl(cg);
  },
  // CPU scorers celebrate too
  cpu(cg) { if (cg && chance(0.85)) setTimeout(() => { if (G.phase === 'dead' && G.players.includes(cg) && !cg.celly) this.start(cg, (clubCelly(cg) && chance(0.55) ? clubCelly(cg) : wet() && chance(0.5) ? CELLYS.find(c => c.wx === G.weather) : null || pick(CELLYS.filter(c => cellyOk(c, cg) && !c.club && !c.lock))).id); }, 900); }, // after he trots into the end zone
  setupBowl(cg) {
    const d = cg.face.dir || 1;
    const mates = G.players.filter(p => p.side === cg.side && p !== cg).sort((a, b) => dist(a, cg) - dist(b, cg)).slice(0, 3);
    cg.celly.pins = mates;
    mates.forEach((m, i) => { m.pinAt = { x: cg.x + d * 7.5 + (i === 0 ? 0 : 0.9) * d, y: cg.y + [0, -1.1, 1.1][i] }; m.celebrate = 3.4; });
  },
  // after a TD: the scorer trots into the end zone, everybody else backs off so you can see the celly
  stage(cg, dt) {
    if (!G.players.includes(cg)) return;
    const r = cg.tdRun;
    if (r && !cg.celly) {
      const dx = r.x - cg.x, dy = r.y - cg.y, l = Math.hypot(dx, dy);
      if (l > 0.2) { const sp = Math.min(l * 3, 6.5) * dt; cg.x += dx / l * sp; cg.y += dy / l * sp; cg.anim += dt * 14; cg.speedNow = 5; cg.face.dir = dirOf(cg.side); }
      else { cg.tdRun = null; cg.speedNow = 0; if (cg.cellyNext) { const id = cg.cellyNext; cg.cellyNext = null; this.start(cg, id); } }
    }
    const pins = (cg.celly && cg.celly.pins) || [];
    for (const o of G.players) {
      if (o === cg || pins.includes(o)) continue;
      const dx = o.x - cg.x, dy = o.y - cg.y, l = Math.hypot(dx, dy), room = o.side === cg.side ? 3.4 : 7; // teammates crowd in a little, defenders walk away
      if (l < room) { const ux = l > 0.05 ? dx / l : -dirOf(cg.side), uy = l > 0.05 ? dy / l : 0; const sp = (o.down > 0 ? 1.2 : 5) * dt; o.x += ux * sp; o.y += uy * sp; if (o.down <= 0) { o.anim += dt * 8; o.speedNow = 3; } }
    }
  },
  update(cg, dt) {
    const c = cg.celly; if (!c) return;
    c.t += dt; const t = c.t, f = c.fx, d = cg.face.dir || 1;
    // moonwalks and mud slides stay inside the end zone (no sliding into the stands)
    { const gx = goalX(cg.side), gd = dirOf(cg.side), lo = Math.min(gx + gd * 0.5, gx + gd * 9.3), hi = Math.max(gx + gd * 0.5, gx + gd * 9.3); if (c.type !== 'lambeau' && Math.abs(cg.x - gx) < 12) cg.x = clamp(cg.x, lo, hi); }
    if (c.type === 'leap' && t > 1.0 && !f.land) { f.land = 1; addDust(cg.x, cg.y, 10); cam.shake = 6; Sound.tone(110, 0.1, 'sine', 0.15); }
    if (c.type === 'griddy' || c.type === 'moon') cg.anim += dt * (c.type === 'griddy' ? 14 : 9);
    if (c.type === 'moon' && t < 2.2) { cg.x -= d * 2.0 * dt; if (Math.floor(t * 6) !== f.step) { f.step = Math.floor(t * 6); addDust(cg.x + d * 0.6, cg.y, 1); } }
    if (c.type === 'spike' && t > 0.22 && !f.slam) {
      f.slam = 1; cam.shake = 9; Sound.tone(90, 0.12, 'square', 0.15, -30);
      G.ball.holder = null; G.ball.x = cg.x + d * 0.6; G.ball.y = cg.y; G.ball.z = 0.4; G.ball.dead = { vx: d * 3, vy: rand(-1, 1) }; G.ball.bounce = 1.4;
      G.fx.push({ kind: 'ring', x: cg.x + d * 0.6, y: cg.y, life: 0.6, max: 0.6, z: 0, vz: 0 }); addDust(cg.x + d * 0.6, cg.y, 8);
    }
    if (c.type === 'flex' && Math.floor(t / 0.55) !== f.pulse) { f.pulse = Math.floor(t / 0.55); if (t < 2) { G.fx.push({ kind: 'ring', x: cg.x, y: cg.y, life: 0.45, max: 0.45, z: 0, vz: 0, color: '#ffd23f' }); Sound.tone(220 + f.pulse * 40, 0.08, 'triangle', 0.08); } }
    if (c.type === 'bow' && t > 0.5 && !f.cheer) { f.cheer = 1; G.crowdHype = 2; for (let i = 0; i < 6; i++) G.fx.push({ kind: 'star', x: cg.x + rand(-2.5, 2.5), y: cg.y + rand(-1, 1), z: rand(30, 60), vz: rand(10, 30), life: 1.2, max: 1.2 }); }
    if (c.type === 'shush' && t > 0.4 && !f.quiet) { f.quiet = 1; G.crowdHype = 0; }
    if (c.type === 'nap' && t > 0.6 && Math.floor(t / 0.5) !== f.z) { f.z = Math.floor(t / 0.5); G.fx.push({ kind: 'zzz', x: cg.x - d * 0.4, y: cg.y, z: 30, vz: 22, life: 1.3, max: 1.3, dx: d }); }
    if (c.type === 'bowl') this.updateBowl(cg, dt);
    if (c.type === 'lambeau') { // run to the back of the end zone and jump into the stands
      const gd = dirOf(cg.side), wallX = gd > 0 ? 122.5 : -2.5; cg.face.dir = gd;
      if (t < 1.0) { const dx = wallX - gd * 0.7 - cg.x; if (Math.abs(dx) > 0.1) { cg.x += Math.sign(dx) * Math.min(Math.abs(dx), 10 * dt); cg.anim += dt * 16; } }
      else if (t < 1.35) { cg.x = lerp(cg.x, wallX + gd * 0.5, Math.min(1, dt * 8)); if (!f.jump) { f.jump = 1; Sound.boing(); } }
      else if (t < 3.1) { if (!f.fans) { f.fans = 1; G.crowdHype = 2.2; cam.shake = 4; Sound.crowd(true); } }
      else if (!f.down) { f.down = 1; cg.x = wallX - gd * 0.4; addDust(cg.x, cg.y, 6); }
    }
    if ((c.type === 'skol') && Math.floor(t / (t < 1.5 ? 0.6 : 0.32)) !== f.clap && t > 0.3) { f.clap = Math.floor(t / (t < 1.5 ? 0.6 : 0.32)); Sound.tone(90, 0.14, 'sine', 0.22, -20); G.fx.push({ kind: 'ring', x: cg.x, y: cg.y, life: 0.35, max: 0.35, z: 0, vz: 0, color: '#ffc62f' }); G.crowdHype = 2; }
    if (c.type === 'twelve' && t > 0.4 && !f.loud) { f.loud = 1; G.crowdHype = 2.5; Sound.crowd(true); cam.shake = 5; }
    if (c.type === 'bark' && Math.floor(t / 0.5) !== f.w && t > 0.3) { f.w = Math.floor(t / 0.5); addText(cg.x + (cg.face.dir || 1) * 1.5, cg.y - 1.5, 'WOOF', '#ff7a1a', 16, 0.6); Sound.tone(180, 0.1, 'sawtooth', 0.1, -80); }
    if (c.type === 'roar' && t > 0.35 && !f.roar) { f.roar = 1; cam.shake = 7; Sound.noise(0.6, 0.3, 120); for (let k = 0; k < 2; k++) G.fx.push({ kind: 'ring', x: cg.x, y: cg.y, life: 0.6 + k * 0.2, max: 0.6 + k * 0.2, z: 0, vz: 0, color: '#fff' }); }
    if (c.type === 'angel') { // flop on your back and flap: leaves an angel in the snow
      if (t > 0.45 && !f.flop) { f.flop = 1; addDust(cg.x, cg.y, 10); Sound.tone(120, 0.15, 'sine', 0.15); }
      if (t > 0.6 && t < 2.5 && Math.floor(t / 0.3) !== f.flap) { f.flap = Math.floor(t / 0.3); addDust(cg.x - d * 0.8, cg.y, 3); for (const s of [-1, 1]) groundMark(cg.x - d * 0.6 + s * 0.2, cg.y + s * 0.9, 1.3, true); groundMark(cg.x - d * 1.6, cg.y, 1.1, true); }
    }
    if (c.type === 'slide') { // sprint, then a belly flop slide through the mud
      if (t < 0.45) { cg.x += d * 7 * dt; cg.anim += dt * 14; }
      else if (t < 1.5) { const v = 9 * (1 - (t - 0.45) / 1.05); cg.x += d * v * dt; if (Math.floor(t * 12) !== f.sp) { f.sp = Math.floor(t * 12); addDust(cg.x + d * 0.6, cg.y, 3); groundMark(cg.x, cg.y, 1.5, true); } if (!f.splash) { f.splash = 1; cam.shake = 5; Sound.noise(0.4, 0.25, 300); } }
    }
  },
  updateBowl(cg, dt) {
    const c = cg.celly, t = c.t, d = cg.face.dir || 1;
    for (const m of c.pins || []) if (m.pinAt && !m.fell) { // pins run into place
      const dx = m.pinAt.x - m.x, dy = m.pinAt.y - m.y, l = Math.hypot(dx, dy);
      if (l > 0.15) { const sp = Math.min(l * 4, 9) * dt; m.x += dx / l * sp; m.y += dy / l * sp; m.anim += dt * 12; m.speedNow = 6; m.face.dir = -d; }
      else m.speedNow = 0;
    }
    if (t > 1.2 && !c.fx.roll) { // roll it
      c.fx.roll = 1; Sound.tone(160, 0.25, 'triangle', 0.1);
      G.ball.holder = null; G.ball.x = cg.x + d * 0.8; G.ball.y = cg.y; G.ball.z = 0.2; G.ball.dead = { vx: 0, vy: 0 }; G.ball.bounce = 0;
    }
    if (c.fx.roll && !c.fx.strike) { G.ball.x += d * 9 * dt; G.ball.spin = (G.ball.spin || 0) + dt * 25; }
    if (c.fx.roll && !c.fx.strike && d * (G.ball.x - (cg.x + d * 7)) > -0.4) { // STRIKE: everybody goes down
      c.fx.strike = 1; cam.shake = 8; G.ball.dead = { vx: d * 3, vy: rand(-2, 2) }; G.ball.bounce = 0.8; Sound.boing(); G.crowdHype = 2;
      for (const m of c.pins || []) { m.fell = 1; m.down = 2.2; m.downDir = d; m.head.vx += rand(-300, 300); addStars(m.x, m.y); }
      addText(cg.x + d * 7, cg.y - 3, 'STRIKE!', '#ffd23f', 30, 1.2);
    }
  },
  end(cg) { if (!cg) return; const c = cg.celly; if (c && c.pins) for (const m of c.pins) { m.pinAt = null; m.fell = 0; } cg.celly = null; },

  // ---- the poses (drawn in player space: +x = the way he faces, up = negative y) ----
  // returns { hop, rot, sy (squash), lie, legK, head, arm(front, shx, shy) -> {ex, ey, hx, hy} | null }
  pose(p, type, t) {
    const P = { hop: 0, rot: 0, sy: 1, lie: 0, legK: null, head: 0, arm: null, leg: null };
    const up = (front, shx, shy, k = 1) => ({ ex: shx + (front ? 5 : -3), ey: shy - 11 * k, hx: shx + (front ? 7 : -5), hy: shy - 23 * k });
    if (type === 'leap') {
      const u = clamp(t / 1.0, 0, 1);
      if (t < 0.18) { P.sy = 1 - ease(t / 0.18) * 0.22; P.hop = 0; } // crouch
      else if (t < 1.0) { P.hop = Math.sin((t - 0.18) / 0.82 * Math.PI) * 78; P.rot = -ease((t - 0.18) / 0.82) * Math.PI * 2; } // backflip
      else if (t < 1.18) P.sy = 1 - Math.sin((t - 1.0) / 0.18 * Math.PI) * 0.2; // land
      else P.hop = Math.abs(Math.sin(t * 9)) * 8;
      P.arm = (front, shx, shy) => t < 0.18 ? { ex: shx - 6, ey: shy + 6, hx: shx - 10, hy: shy + 12 } : u < 1 ? { ex: shx + 4, ey: shy - 10, hx: shx + 8, hy: shy - 4 } : up(front, shx, shy);
    } else if (type === 'griddy') {
      const s = Math.sin(t * 14);
      P.hop = Math.abs(s) * 8; P.legK = 1; P.head = s * 0.12;
      P.arm = (front, shx, shy) => { const w = s * (front ? 1 : -1); return { ex: shx + w * 10, ey: shy + 6, hx: shx + w * 18, hy: shy + (w > 0 ? -2 : 10) }; };
    } else if (type === 'spike') {
      const a = clamp(t / 0.22, 0, 1);
      P.rot = a < 1 ? -0.15 + a * 0.4 : 0.25 * Math.max(0, 1 - (t - 0.22) * 2);
      P.hop = t < 0.22 ? a * 14 : Math.max(0, 10 - (t - 0.22) * 40);
      P.arm = (front, shx, shy) => front ? (t < 0.22 ? { ex: shx + 2, ey: shy - 12 + a * 22, hx: shx + 4 + a * 6, hy: shy - 24 + a * 44 } : { ex: shx + 6, ey: shy + 8, hx: shx + 10, hy: shy + 18 }) : (t > 0.4 ? up(false, shx, shy) : null);
    } else if (type === 'dab') {
      const a = ease(t / 0.2);
      P.rot = -0.14 * a; P.head = 0.55 * a;
      P.arm = (front, shx, shy) => front ? { ex: shx + 9 * a, ey: shy - 8 * a, hx: shx + 18 * a, hy: shy - 16 * a } : { ex: shx + 10 * a, ey: shy - 4 * a, hx: shx + 17 * a, hy: shy - 12 * a };
    } else if (type === 'flex') {
      const pulse = Math.sin(t / 0.55 * Math.PI * 2) * 0.5 + 0.5;
      P.sy = 1 + pulse * 0.06; P.hop = t < 0.2 ? t * 30 : 0; P.head = -0.1;
      P.arm = (front, shx, shy) => { const o = front ? 1 : -1; return { ex: shx + o * (11 + pulse * 2), ey: shy - 2, hx: shx + o * 9, hy: shy - 15 - pulse * 3 }; };
    } else if (type === 'bow') {
      const a = t < 0.4 ? ease(t / 0.4) : t < 1.6 ? 1 : 1 - ease((t - 1.6) / 0.4);
      P.rot = a * 0.75; P.head = a * 0.25;
      P.arm = (front, shx, shy) => front ? { ex: shx + 4, ey: shy + 7, hx: shx - 2, hy: shy + 4 } : { ex: shx - 8 * a, ey: shy + 6, hx: shx - 16 * a, hy: shy + 2 - a * 6 };
    } else if (type === 'shush') {
      const a = ease(t / 0.3);
      P.head = -0.12 * a; P.hop = t > 0.3 ? Math.sin((t - 0.3) * 3) * 2 : 0;
      P.arm = (front, shx, shy) => front ? { ex: shx + 8 * a, ey: shy + 2 - 6 * a, hx: shx + 6 + 4 * a, hy: shy - 16 * a } : { ex: shx - 6 * a, ey: shy - 6 * a, hx: shx - 4, hy: shy - 20 * a };
    } else if (type === 'moon') {
      P.legK = t < 2.2 ? 0.8 : 0; P.head = Math.sin(t * 6) * 0.08; P.rot = -0.06;
      P.arm = (front, shx, shy) => t > 2.2 ? (front ? { ex: shx + 2, ey: shy - 12, hx: shx + 9, hy: shy - 22 } : null) : (front ? { ex: shx + 6, ey: shy + 6, hx: shx + 3, hy: shy + 14 } : { ex: shx - 4, ey: shy + 8, hx: shx - 2, hy: shy + 16 });
    } else if (type === 'nap') {
      const a = ease(t / 0.5);
      P.lie = -a * 1.5; P.hop = a * -2;
      P.arm = (front, shx, shy) => ({ ex: shx - 4 * a, ey: shy - 8 * a, hx: shx - 10 * a, hy: shy - 14 * a });
    } else if (type === 'angel') {
      const a = ease((t - 0.2) / 0.35), flap = t > 0.6 && t < 2.5 ? Math.sin((t - 0.6) * 10.5) : 0;
      if (t > 2.5) { const u = ease((t - 2.5) / 0.4); P.lie = -1.5 * (1 - u); P.hop = u * 6; } else { P.lie = -a * 1.5; P.hop = -a * 2; }
      P.legK = t > 0.6 && t < 2.5 ? 1 : 0;
      P.arm = (front, shx, shy) => t > 2.5 ? up(front, shx, shy) : ({ ex: shx - 4 + flap * 6, ey: shy - 6 - Math.abs(flap) * 3, hx: shx - 8 + flap * 14, hy: shy - 14 + Math.abs(flap) * 4 });
    } else if (type === 'slide') {
      if (t < 0.45) { P.legK = 1; P.rot = 0.12; }
      else if (t < 1.6) { const a = ease((t - 0.45) / 0.15); P.rot = 1.35 * a; P.hop = -4 * a; P.legK = 0; }
      else { const u = ease((t - 1.6) / 0.35); P.rot = 1.35 * (1 - u); P.hop = u * Math.abs(Math.sin(t * 9)) * 10; }
      P.arm = (front, shx, shy) => t < 0.45 ? null : t < 1.6 ? { ex: shx + 10, ey: shy - 4, hx: shx + 20, hy: shy - 8 } : up(front, shx, shy);
    } else if (type === 'lambeau') {
      if (t < 1.0) { P.legK = 1; P.rot = 0.12; }
      else if (t < 1.35) { const u = (t - 1.0) / 0.35; P.hop = Math.sin(u * Math.PI * 0.6) * 60; P.rot = -0.2; }
      else if (t < 3.1) { P.hop = 40 + Math.sin(t * 6) * 4; P.rot = -0.35 + Math.sin(t * 5) * 0.08; P.legK = 0.6; P.head = Math.sin(t * 7) * 0.12; } // held up by the fans
      else { const u = Math.min(1, (t - 3.1) / 0.3); P.hop = 40 * (1 - u); }
      P.arm = (front, shx, shy) => t < 1.0 ? null : up(front, shx, shy);
    } else if (type === 'flap') {
      const fl = Math.sin(t * 13); P.hop = 6 + Math.abs(fl) * 10;
      P.arm = (front, shx, shy) => { const o = front ? 1 : -1; return { ex: shx + o * 11, ey: shy - 2 + fl * 6, hx: shx + o * 22, hy: shy - 4 + fl * 12 }; };
    } else if (type === 'skol') {
      const per = t < 1.5 ? 0.6 : 0.32, u = (t % per) / per, clap = u < 0.25;
      P.hop = clap ? 4 : 0;
      P.arm = (front, shx, shy) => { const o = front ? 1 : -1, w = clap ? 1 : 8; return { ex: shx + o * 6, ey: shy - 14, hx: shx + o * w * 0.5 + 2, hy: shy - 27 }; };
    } else if (type === 'salute') {
      const a = ease(t / 0.3); P.head = -0.05;
      P.arm = (front, shx, shy) => front ? { ex: shx + 10 * a, ey: shy - 6 * a, hx: shx + 8 + 6 * a, hy: shy - 20 * a } : null;
    } else if (type === 'towel') {
      const w = Math.sin(t * 12); P.hop = Math.abs(w) * 5;
      P.arm = (front, shx, shy) => front ? { ex: shx + 4 + w * 3, ey: shy - 12, hx: shx + 6 + w * 8, hy: shy - 25 } : null;
    } else if (type === 'twelve') {
      P.hop = t < 0.3 ? t * 30 : Math.abs(Math.sin(t * 6)) * 6;
      P.arm = (front, shx, shy) => front ? { ex: shx + 2, ey: shy - 13, hx: shx + 3, hy: shy - 27 } : { ex: shx - 6, ey: shy - 8, hx: shx - 10, hy: shy - 18 };
    } else if (type === 'bark') {
      P.rot = 0.45; P.sy = 0.92; P.head = -0.25 + Math.sin(t * 12) * 0.08;
      P.arm = (front, shx, shy) => ({ ex: shx + 6, ey: shy + 8, hx: shx + 10, hy: shy + 18 });
    } else if (type === 'roar') {
      const a = ease(t / 0.35); P.head = -0.35 * a; P.sy = 1 + 0.06 * a; P.rot = -0.08 * a;
      P.arm = (front, shx, shy) => { const o = front ? 1 : -1; return { ex: shx + o * 10 * a, ey: shy - 6 * a, hx: shx + o * 16 * a, hy: shy - 16 * a }; };
    } else if (type === 'robot') { // stiff arms that snap from pose to pose, head clicks side to side
      const st = Math.floor(t / 0.3), a = st % 4;
      P.head = [0.3, 0, -0.3, 0][a]; P.legK = 0; P.hop = [0, 4, 0, 4][a]; P.rot = [0.05, 0, -0.05, 0][a]; P.noBall = true;
      P.arm = (front, shx, shy) => { const o = front ? 1 : -1, up = (a + (front ? 0 : 1)) % 2 === 0; // elbows locked at right angles, snapping up and down
        return up ? { ex: shx + o * 11, ey: shy + 1, hx: shx + o * 11, hy: shy - 13 } : { ex: shx + o * 11, ey: shy + 1, hx: shx + o * 11, hy: shy + 14 }; };
    } else if (type === 'superman') { // fly forward with both fists out, then pop up
      if (t < 0.25) { P.sy = 1 - ease(t / 0.25) * 0.18; }
      else if (t < 1.6) { const u = (t - 0.25) / 1.35; P.rot = 1.35 * ease(Math.min(1, u * 4)); P.hop = Math.sin(Math.min(1, u) * Math.PI) * 46 + 10; P.legK = 0; }
      else { const u = ease((t - 1.6) / 0.35); P.rot = 1.35 * (1 - u); P.hop = 10 * (1 - u); }
      P.arm = (front, shx, shy) => t < 0.25 ? null : t < 1.8 ? { ex: shx + 10, ey: shy - 6, hx: shx + 21, hy: shy - 10 } : up(front, shx, shy);
    } else if (type === 'shimmy') { // shoulders shake, little bounce
      const sh = Math.sin(t * 22); P.hop = Math.abs(Math.sin(t * 6)) * 8; P.rot = sh * 0.16; P.head = -sh * 0.14; P.legK = 0.5; P.sy = 1 - Math.abs(sh) * 0.04;
      P.arm = (front, shx, shy) => { const o = front ? 1 : -1; return { ex: shx + o * 12, ey: shy + 4 + sh * 4 * o, hx: shx + o * 20, hy: shy - 2 + sh * 6 * o }; }; // arms out wide, shoulders rolling
    } else if (type === 'worm') { // down on the turf, a wave rolls through him
      const a = ease(t / 0.4), w = Math.sin(t * 9);
      if (t < 2.6) { P.lie = -1.5 * a; P.hop = a * (4 + Math.max(0, w) * 10); P.sy = 1 + w * 0.08 * a; }
      else { const u = ease((t - 2.6) / 0.35); P.lie = -1.5 * (1 - u); P.hop = u * 6; }
      P.legK = 0;
      P.arm = (front, shx, shy) => t > 2.6 ? up(front, shx, shy) : { ex: shx + 4, ey: shy + 6 + w * 3, hx: shx + 8, hy: shy + 12 + w * 4 };
    } else if (type === 'heisman') { // the trophy pose: front knee up, stiff arm straight out, hold it
      const a = ease(t / 0.3);
      P.head = -0.05 * a; P.legK = 0; P.hop = a * 6; P.rot = -0.06 * a; P.noBall = a > 0.5; // ball tucked away behind him
      P.leg = (side, hx, hy, kx, ky, fx, fy) => side < 0 ? null : { kx: lerp(kx, hx + 17, a), ky: lerp(ky, hy + 2, a), fx: lerp(fx, hx + 13, a), fy: lerp(fy, hy + 14, a) }; // knee out front at hip height
      P.arm = (front, shx, shy) => front ? { ex: shx + 12 * a, ey: shy - 1 * a, hx: shx + 25 * a, hy: shy - 3 * a } : { ex: shx + 2, ey: shy + 8, hx: shx + 6, hy: shy + 6 };
    } else if (type === 'bowl') {
      const wind = t > 0.6 && t < 1.2 ? ease((t - 0.6) / 0.6) : 0, rel = t >= 1.2 ? Math.min(1, (t - 1.2) * 5) : 0;
      P.rot = wind * 0.35 + rel * 0.5 - (t > 1.6 && t < 2 ? 0 : 0); P.sy = 1 - wind * 0.1;
      if (t > 1.9) { P.hop = Math.abs(Math.sin(t * 9)) * 10; P.rot = 0; }
      P.arm = (front, shx, shy) => front ? (t < 1.2 ? { ex: shx - 6 * wind, ey: shy + 8, hx: shx - 14 * wind + 2, hy: shy + 14 - wind * 4 } : t < 1.9 ? { ex: shx + 8, ey: shy + 8, hx: shx + 16, hy: shy + 10 } : up(true, shx, shy)) : (t > 1.9 ? up(false, shx, shy) : null);
    }
    return P;
  },
  // extra drawing on top of the player (screen space)
  overlay(g, p, x, y, hop) {
    const c = p.celly; if (!c) return;
    const dir = p.face.dir || 1, tm = G.teams && G.teams[p.side];
    if (c.type === 'lambeau' && c.t > 1.2 && c.t < 3.2) { // fans grabbing him from the stands
      for (let k = 0; k < 7; k++) {
        const fx0 = x + dir * (14 + (k % 3) * 10) + (k - 3) * 9, fy0 = y + 10 + (k % 2) * 8, reach = Math.sin(c.t * 9 + k) * 4;
        g.strokeStyle = SKIN[k % 6]; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(fx0, fy0); g.lineTo(x + (k - 3) * 5, y - hop - 18 + reach); g.stroke();
        g.fillStyle = k % 2 ? (tm ? tm.c2 : '#ffb612') : (tm ? tm.c1 : '#203731'); g.beginPath(); g.arc(fx0, fy0 + 6, 7, 0, 7); g.fill();
      }
    }
    if (c.type === 'towel') { // the towel spins over his head
      const w = Math.sin(c.t * 12), tx = x + dir * (8 + w * 8), ty = y - hop - 112;
      g.save(); g.translate(tx, ty); g.rotate(w * 0.8); g.fillStyle = '#ffb612'; g.strokeStyle = '#14110f'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-3, 0); g.quadraticCurveTo(10, -10 - w * 6, 24, -2); g.lineTo(22, 12); g.quadraticCurveTo(10, 4, -3, 12); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    if (c.type === 'twelve' && c.t > 0.3) { g.save(); g.globalAlpha = Math.min(1, (c.t - 0.3) * 3); g.font = 'italic 900 40px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.lineWidth = 7; g.strokeStyle = '#002244'; g.strokeText('12', x + dir * 6, y - hop - 140); g.fillStyle = '#69be28'; g.fillText('12', x + dir * 6, y - hop - 140); g.restore(); }
    if (c.type === 'shush' && c.t > 0.35 && c.t < 2) { g.font = 'italic 900 18px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.globalAlpha = Math.min(1, (2 - c.t) * 2); g.fillText('shhh', x + p.face.dir * 30, y - hop - 95 - (c.t - 0.35) * 10); g.globalAlpha = 1; }
  }
};
