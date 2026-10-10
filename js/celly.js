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
  { id: 'bowl', name: 'BOWLING', keys: ['KeyF'], dur: 3.4, say: 'STRIKE!', team: true }
];
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

const Celly = {
  // human: check the celly keys
  input(cg) {
    for (const c of CELLYS) if (Input.hit(...c.keys)) return this.start(cg, c.id);
  },
  start(cg, id) {
    const c = CELLYS.find(k => k.id === id); if (!c || !cg) return;
    if (cg.celly && cg.celly.t < 0.5) return; // let the last one get going first
    cg.celly = { type: id, t: 0, fx: {} }; cg.celebrate = c.dur + 0.5; cg.down = 0; cg.dive = 0;
    cg.cx0 = cg.x; cg.cy0 = cg.y;
    addText(cg.x, cg.y - 2.5, c.say, '#ffd23f', 26, 1.1);
    if (G.banner && G.banner.dur - G.banner.t > 0.35) G.banner.t = G.banner.dur - 0.35; // clear the TOUCHDOWN banner so you can see it
    Sound.boing(); Sound.crowd(false); G.crowdHype = 1.5;
    if (G.phase === 'dead') G.deadT = Math.max(G.deadT, c.dur + 0.5); // stay on it until it's done
    if (c.team) this.setupBowl(cg);
  },
  // CPU scorers celebrate too
  cpu(cg) { if (cg && chance(0.85)) setTimeout(() => { if (G.phase === 'dead' && G.players.includes(cg) && !cg.celly) this.start(cg, pick(CELLYS).id); }, 450); },
  setupBowl(cg) {
    const d = cg.face.dir || 1;
    const mates = G.players.filter(p => p.side === cg.side && p !== cg).sort((a, b) => dist(a, cg) - dist(b, cg)).slice(0, 3);
    cg.celly.pins = mates;
    mates.forEach((m, i) => { m.pinAt = { x: cg.x + d * 7.5 + (i === 0 ? 0 : 0.9) * d, y: cg.y + [0, -1.1, 1.1][i] }; m.celebrate = 3.4; });
  },
  update(cg, dt) {
    const c = cg.celly; if (!c) return;
    c.t += dt; const t = c.t, f = c.fx, d = cg.face.dir || 1;
    // give him the stage: anybody from the other team standing on top of him walks off
    for (const o of G.players) if (o.side !== cg.side && o.down <= 0) { const dx = o.x - cg.x, dy = o.y - cg.y, l = Math.hypot(dx, dy); if (l < 3.2) { const ux = l > 0.05 ? dx / l : 0, uy = l > 0.05 ? dy / l : 1; o.x += ux * 3.5 * dt; o.y += uy * 3.5 * dt; o.anim += dt * 8; o.speedNow = 3; } }
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
    const P = { hop: 0, rot: 0, sy: 1, lie: 0, legK: null, head: 0, arm: null };
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
    if (c.type === 'shush' && c.t > 0.35 && c.t < 2) { g.font = 'italic 900 18px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.globalAlpha = Math.min(1, (2 - c.t) * 2); g.fillText('shhh', x + p.face.dir * 30, y - hop - 95 - (c.t - 0.35) * 10); g.globalAlpha = 1; }
  }
};
