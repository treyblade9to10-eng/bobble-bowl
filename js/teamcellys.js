// ---- more team signature cellys (key G / mobile team button / pad): one per team, unlocked for that team from the start ----
// (adds to celly.js: same pose system, +x = the way he faces, up = negative y, arm coords from his shoulder)
CELLYS.find(c => c.id === 'roar').club = ['DET', 'JAX', 'CAR']; // Bears + Bengals get their own now
CELLYS.push(
  { id: 'claw', name: 'BEAR CLAW', keys: ['KeyG'], dur: 2.4, say: 'BEAR DOWN!', club: ['CHI'] },
  { id: 'whodey', name: 'WHO DEY', keys: ['KeyG'], dur: 2.6, say: 'WHO DEY!', club: ['CIN'] },
  { id: 'flock', name: 'THE FLOCK', keys: ['KeyG'], dur: 2.8, say: 'CAW CAW!', club: ['BAL'] },
  { id: 'spyglass', name: 'SPYGLASS', keys: ['KeyG'], dur: 2.6, say: 'LAND HO!', club: ['LV'] },
  { id: 'lasso', name: 'LASSO', keys: ['KeyG'], dur: 3.0, say: 'YEEHAW!', club: ['DAL'] },
  { id: 'horns', name: 'BULL HORNS', keys: ['KeyG'], dur: 2.6, say: 'BULL RUSH!', club: ['HOU'] },
  { id: 'dirty', name: 'DIRTY BIRD', keys: ['KeyG'], dur: 2.6, say: 'DIRTY BIRD!', club: ['ATL'] },
  { id: 'bolt', name: 'BOLT', keys: ['KeyG'], dur: 2.2, say: 'LIGHTNING!', club: ['LAC'] },
  { id: 'jet', name: 'JET FLYOVER', keys: ['KeyG'], dur: 2.8, say: 'J-E-T-S!', club: ['NYJ'] },
  { id: 'fin', name: 'FINS UP', keys: ['KeyG'], dur: 2.4, say: 'FINS UP!', club: ['MIA'] },
  { id: 'wheel', name: 'SHIP WHEEL', keys: ['KeyG'], dur: 2.6, say: 'FULL SPEED AHEAD!', club: ['TB'] },
  { id: 'gold', name: 'GOLD RUSH', keys: ['KeyG'], dur: 2.6, say: 'STRUCK GOLD!', club: ['SF'] }
);
(() => {
  const NEW = new Set(['claw', 'whodey', 'flock', 'spyglass', 'lasso', 'horns', 'dirty', 'bolt', 'jet', 'fin', 'wheel', 'gold']);
  const baseUpdate = Celly.update, basePose = Celly.pose, baseOverlay = Celly.overlay;
  const font = s => `italic 900 ${s}px "Barlow Condensed", Arial, sans-serif`;
  // where his hand is on screen (no body rotation in these poses, so it's just shoulder + arm)
  const handAt = (p, front, x, y, hop) => {
    const c = p.celly, ps = Celly.pose(p, c.type, c.t), big = p.pos === 'OL' || p.pos === 'DL', W = big ? 30 : 24, TH = big ? 24 : 22, HIP = big ? 17 : 18;
    const shx = front ? W * 0.3 : -W * 0.22, shy = -TH + 5, a = ps.arm ? ps.arm(front, shx, shy) : { hx: shx, hy: shy + 16 };
    return { x: x + (p.face.dir || 1) * a.hx, y: y - hop - HIP + a.hy };
  };
  Celly.update = function (cg, dt) {
    baseUpdate.call(this, cg, dt);
    const c = cg.celly; if (!c || !NEW.has(c.type)) return;
    const t = c.t, f = c.fx, d = cg.face.dir || 1, beat = (n, per, from = 0) => t > from && Math.floor((t - from) / per) !== f[n] ? (f[n] = Math.floor((t - from) / per), true) : false;
    if (c.type === 'claw' && t < 2 && beat('sw', 0.6, 0.25)) { Sound.noise(0.14, 0.18, 900); c.slash = t; G.crowdHype = 1.8; }
    if (c.type === 'whodey' && t < 2.1 && beat('pt', 0.7, 0.3)) { // point at the crowd three times, they answer the third
      addText(cg.x + d * 2, cg.y - 3 - f.pt * 0.6, f.pt < 2 ? 'WHO DEY' : 'NOBODY!', f.pt < 2 ? '#fb4f14' : '#fff', 18 + f.pt * 4, 0.8);
      Sound.tone(150, 0.1, 'sine', 0.18, -40); if (f.pt === 2) { G.crowdHype = 2.4; Sound.crowd(true); }
    }
    if (c.type === 'flock' || c.type === 'jet') { // glide around in a loop, leaning into the turn
      const jet = c.type === 'jet', a = clamp((t - 0.25) / 2.2, 0, 1), r = jet ? 3.2 : 2.2, ang = a * Math.PI * 2;
      if (!c.d0) { c.d0 = d; if (jet) Sound.noise(1.6, 0.12, 1500); }
      if (t > 0.25 && a < 1) { cg.x = cg.cx0 + Math.sin(ang) * r * c.d0; cg.y = cg.cy0 - (1 - Math.cos(ang)) * r * 0.7; cg.anim += dt * (jet ? 16 : 10); cg.face.dir = Math.cos(ang) >= 0 ? c.d0 : -c.d0; }
      if (jet && t > 0.25 && a < 1 && beat('tr', 0.07)) G.fx.push({ kind: 'dust', x: cg.x - cg.face.dir * 0.8, y: cg.y, z: 26, vz: 2, r: 4, life: 0.7, max: 0.7 });
    }
    if (c.type === 'lasso') {
      if (t < 1.9 && beat('sp', 0.4, 0.3)) Sound.noise(0.08, 0.06, 2500);
      if (t > 1.9 && !f.toss) { f.toss = 1; Sound.noise(0.25, 0.12, 1800); }
      if (t > 2.25 && !f.land) { f.land = 1; G.crowdHype = 2; addDust(cg.x + d * 5.5, cg.y, 6); }
    }
    if (c.type === 'horns') { // paw the ground, then charge
      if (t < 1.3 && beat('paw', 0.35, 0.3)) { addDust(cg.x + d * 0.4, cg.y, 3); Sound.tone(80, 0.1, 'sine', 0.15); }
      if (t > 1.35 && t < 1.95) { cg.x += d * 9 * dt; cg.anim += dt * 16; if (beat('ch', 0.08, 1.35)) addDust(cg.x - d * 0.5, cg.y, 2); }
      if (t > 1.95 && !f.stop) { f.stop = 1; cam.shake = 6; Sound.noise(0.3, 0.25, 140); G.crowdHype = 2.2; }
    }
    if (c.type === 'dirty' && beat('st', 0.33, 0.2)) { addDust(cg.x, cg.y, 1); Sound.tone(110, 0.06, 'sine', 0.1); }
    if (c.type === 'bolt' && t > 0.4 && !f.zap) { f.zap = 1; cam.shake = 9; Sound.noise(0.5, 0.32, 90); Sound.tone(60, 0.5, 'sine', 0.2, -20); G.crowdHype = 2.3; G.fx.push({ kind: 'ring', x: cg.x, y: cg.y, life: 0.6, max: 0.6, z: 0, vz: 0, color: '#ffc20e' }); }
    if (c.type === 'fin') cg.x += Math.cos(t * 4) * d * 1.6 * dt;
    if (c.type === 'wheel' && beat('cr', 0.45, 0.3) && t < 2.2) Sound.tone(260 - (f.cr % 2) * 40, 0.08, 'sine', 0.06);
    if (c.type === 'gold' && t > 1.55 && !f.nug) { f.nug = 1; G.crowdHype = 2; Sound.tone(1320, 0.25, 'sine', 0.08); Sound.tone(1760, 0.3, 'sine', 0.06, 0, 0.12); for (let i = 0; i < 6; i++) G.fx.push({ kind: 'star', x: cg.x + d * 0.6 + rand(-1, 1), y: cg.y + rand(-0.5, 0.5), z: rand(50, 80), vz: rand(10, 30), life: 1, max: 1 }); }
  };
  Celly.pose = function (p, type, t) {
    if (!NEW.has(type)) return basePose.call(this, p, type, t);
    const P = { hop: 0, rot: 0, sy: 1, lie: 0, legK: null, head: 0, arm: null, leg: null };
    const up = (front, shx, shy) => ({ ex: shx + (front ? 5 : -3), ey: shy - 11, hx: shx + (front ? 7 : -5), hy: shy - 23 });
    const a = ease(t / 0.3), end = t > (CELLYS.find(c => c.id === type).dur - 0.4);
    if (type === 'claw') { // big bear swipes, one paw then the other
      const u = t < 0.25 ? 0 : ((t - 0.25) % 0.6) / 0.6, sw = u < 0.35 ? ease(u / 0.35) : 1 - ease((u - 0.35) / 0.65), which = Math.floor(Math.max(0, t - 0.25) / 0.6) % 2;
      P.sy = 1 - 0.05 * a; P.head = -0.15 * a; P.hop = sw * 4; P.noBall = true;
      P.arm = (front, shx, shy) => { const s = (front ? which === 0 : which === 1) ? sw : 0, o = front ? 1 : 0.4;
        return { ex: shx + (6 + 6 * s) * o + 2, ey: shy - 12 * a + 14 * s, hx: shx + (12 + 8 * s) * o + 3, hy: shy - 22 * a + 30 * s }; };
    } else if (type === 'whodey') { // point at the stands on every beat
      const u = t < 0.3 ? 0 : ((t - 0.3) % 0.7) / 0.7, pk = u < 0.2 ? ease(u / 0.2) : 1 - ease((u - 0.2) / 0.8) * 0.4;
      P.hop = t > 0.3 && t < 2.1 ? (1 - Math.min(1, u * 4)) * 10 : 0; P.head = -0.12 * a; P.noBall = true;
      P.arm = (front, shx, shy) => front ? { ex: shx + 10 * pk * a, ey: shy - 8 * pk * a + 6 * (1 - a), hx: shx + 22 * pk * a, hy: shy - 18 * pk * a + 14 * (1 - a) } : { ex: shx + 2, ey: shy + 9, hx: shx + 8, hy: shy + 5 };
    } else if (type === 'flock') { // wings flapping slow, soaring in a loop
      const fl = Math.sin(t * 7); P.hop = 6 + Math.abs(fl) * 6; P.rot = 0; P.legK = t > 0.25 && t < 2.55 ? 0.5 : 0;
      P.arm = (front, shx, shy) => { const o = front ? 1 : -1; return { ex: shx + o * 11, ey: shy - 4 + fl * 5, hx: shx + o * 21, hy: shy - 2 + fl * 10 }; };
      if (end) P.arm = up;
    } else if (type === 'jet') { // arms straight out like wings, banking through a loop
      P.legK = t > 0.25 && t < 2.45 ? 1 : 0; P.hop = t > 0.25 && t < 2.45 ? 4 : 0;
      const bank = t > 0.25 && t < 2.45 ? Math.sin((t - 0.25) / 2.2 * Math.PI * 2) * 6 : 0;
      P.arm = (front, shx, shy) => end ? up(front, shx, shy) : { ex: shx + (front ? 11 : -11), ey: shy - 1 + (front ? -bank : bank) * 0.5, hx: shx + (front ? 23 : -21), hy: shy - 2 + (front ? -bank : bank) };
    } else if (type === 'spyglass') { // telescope up to the eye, scanning the horizon
      P.head = Math.sin(t * 2.2) * 0.12 - 0.05; P.hop = 0; P.noBall = true; P.legK = 0;
      P.arm = (front, shx, shy) => front ? { ex: shx + 9 * a, ey: shy - 4 * a + 8 * (1 - a), hx: shx + 6 * a + 4, hy: shy - 25 * a + 15 * (1 - a) } : { ex: shx + 4, ey: shy + 7, hx: shx + 10, hy: shy + 4 };
    } else if (type === 'lasso') { // spin the rope over his head, then throw it
      const spin = t * 13, th = t > 1.9 ? ease((t - 1.9) / 0.25) : 0; P.noBall = true; P.hop = t < 1.9 ? Math.abs(Math.sin(t * 6.5)) * 4 : 0;
      P.arm = (front, shx, shy) => front ? (th > 0 ? { ex: shx + 4 + 8 * th, ey: shy - 12 + 8 * th, hx: shx + 6 + 16 * th, hy: shy - 24 + 16 * th } : { ex: shx + 9, ey: shy - 10, hx: shx + 14 + Math.cos(spin) * 3, hy: shy - 24 + Math.sin(spin) * 1.5 }) : { ex: shx - 4, ey: shy + 7, hx: shx + 2, hy: shy + 12 };
      if (t > 2.4) P.arm = (front, shx, shy) => front ? up(true, shx, shy) : { ex: shx - 4, ey: shy + 7, hx: shx + 2, hy: shy + 12 };
    } else if (type === 'horns') { // fingers up by the helmet like horns, paw the turf, charge
      const ch = t > 1.35 && t < 1.95; P.head = 0.28 * a; P.legK = ch ? 1 : 0; P.noBall = true; P.sy = 1 - 0.04 * a;
      if (t < 1.3 && t > 0.3) P.leg = (side, hx, hy, kx, ky, fx, fy) => side < 0 ? null : (() => { const s = Math.sin((t - 0.3) / 0.35 * Math.PI * 2); return { kx: kx + 3, ky: ky - 2 - Math.max(0, s) * 3, fx: fx + 4 - s * 6, fy: fy - Math.max(0, s) * 3 }; })();
      P.arm = (front, shx, shy) => front ? { ex: shx + 9, ey: shy - 8 * a, hx: shx + 5, hy: shy - 26 * a + 6 } : { ex: shx - 4, ey: shy - 8 * a, hx: shx + 1, hy: shy - 26 * a + 6 };
    } else if (type === 'dirty') { // chicken-wing elbows + knees up, left right left right
      const s = Math.sin((t - 0.2) * Math.PI / 0.33), on = t > 0.2 && !end; P.hop = on ? Math.abs(s) * 7 : 0; P.head = on ? s * 0.08 : 0;
      if (on) P.leg = (side, hx, hy, kx, ky, fx, fy) => (s > 0) === (side > 0) ? { kx: hx + 11, ky: hy + 4, fx: hx + 9, fy: hy + 15 } : null;
      P.arm = (front, shx, shy) => end ? up(front, shx, shy) : { ex: shx + (front ? 9 : -9), ey: shy + 2 - Math.abs(s) * 5, hx: shx + (front ? 1 : -1), hy: shy + 5 };
    } else if (type === 'bolt') { // the lightning bolt: one arm high, one arm low, zig zag
      P.head = -0.12 * a; P.rot = -0.06 * a; P.hop = t > 0.4 && t < 0.6 ? 8 : 0; P.noBall = true;
      P.arm = (front, shx, shy) => front ? { ex: shx + 9 * a, ey: shy - 10 * a, hx: shx + 4 + 12 * a, hy: shy - 24 * a } : { ex: shx - 9 * a, ey: shy + 9 * a, hx: shx - 4 - 12 * a, hy: shy + 20 * a };
    } else if (type === 'fin') { // a hand up like a shark fin, swimming side to side
      const sw = Math.sin(t * 4); P.rot = sw * 0.08; P.hop = Math.abs(Math.sin(t * 8)) * 3; P.head = sw * 0.08;
      P.arm = (front, shx, shy) => front ? { ex: shx + 10 * a, ey: shy - 2 * a, hx: shx + 10 * a, hy: shy - 20 * a } : { ex: shx - 8, ey: shy + 6 + sw * 4, hx: shx - 14, hy: shy + 2 - sw * 8 };
    } else if (type === 'wheel') { // both hands on the ship's wheel, cranking it side to side
      const w = t < 0.3 ? 0 : Math.sin((t - 0.3) * 2.8) * 0.9, R = 10, cx = 16, cy = -6; P.noBall = true; P.rot = w * 0.05; P.hop = Math.abs(Math.sin(t * 5)) * 2;
      P.arm = (front, shx, shy) => { const ang = w + (front ? -0.5 : Math.PI + 0.5), hx = cx + Math.cos(ang) * R * 0.5, hy = shy + cy + Math.sin(ang) * R; return { ex: lerp(shx, hx, 0.5) + 2, ey: lerp(shy, hy, 0.5) + 5, hx, hy }; };
    } else if (type === 'gold') { // crouch and swirl the pan, then hold the nugget up
      const pan = t < 1.55, sw = Math.sin(t * 9); P.noBall = true;
      if (pan) { P.sy = 1 - 0.14 * a; P.rot = 0.2 * a; P.head = 0.2 * a; }
      else { const u = ease((t - 1.55) / 0.25); P.hop = u * 10 + (t > 1.8 ? Math.abs(Math.sin(t * 8)) * 4 : 0); P.head = -0.15 * u; }
      P.arm = (front, shx, shy) => pan ? { ex: shx + (front ? 8 : 4), ey: shy + 9, hx: shx + (front ? 15 : 11) + sw * 2, hy: shy + 14 + Math.cos(t * 9) * 1.5 } : front ? { ex: shx + 6, ey: shy - 12, hx: shx + 9, hy: shy - 25 } : { ex: shx - 4, ey: shy + 8, hx: shx - 2, hy: shy + 15 };
    }
    return P;
  };
  Celly.overlay = function (g, p, x, y, hop) {
    baseOverlay.call(this, g, p, x, y, hop);
    const c = p.celly; if (!c || !NEW.has(c.type)) return;
    const t = c.t, dir = p.face.dir || 1;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    if (c.type === 'claw' && c.slash != null && t - c.slash < 0.4) { // three claw marks hanging in the air
      const al = 1 - (t - c.slash) / 0.4, hx = x + dir * 34, hy = y - hop - 60;
      g.globalAlpha = al; g.strokeStyle = '#fff'; g.lineWidth = 5;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(hx + k * 9 - dir * 8, hy - 16); g.lineTo(hx + k * 9 + dir * 6, hy + 18); g.stroke(); }
      g.strokeStyle = '#c83803'; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(hx + k * 9 - dir * 8, hy - 16); g.lineTo(hx + k * 9 + dir * 6, hy + 18); g.stroke(); }
    }
    if (c.type === 'flock' && t > 0.3) { // a few birds circling over him
      g.globalAlpha = Math.min(1, (t - 0.3) * 3) * Math.min(1, (2.8 - t) * 3); g.strokeStyle = '#241773'; g.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const a = t * 2.4 + k * 2.1, bx = x + Math.cos(a) * 46, by = y - hop - 120 + Math.sin(a) * 12, fl = Math.sin(t * 14 + k) * 5;
        g.beginPath(); g.moveTo(bx - 9, by - fl); g.quadraticCurveTo(bx - 4, by - 4, bx, by); g.quadraticCurveTo(bx + 4, by - 4, bx + 9, by - fl); g.stroke(); }
    }
    if (c.type === 'spyglass') { // brass telescope out in front of his eye
      const h = handAt(p, true, x, y, hop), tilt = Math.sin(t * 2.2) * 0.12 - 0.08, a = ease(t / 0.3);
      g.translate(h.x, h.y - 2); g.rotate(dir > 0 ? tilt : Math.PI - tilt); g.globalAlpha = a;
      g.fillStyle = '#14110f'; g.fillRect(-8, -5, 18, 10); g.fillStyle = '#b8892f'; g.fillRect(8, -6, 14, 12); g.fillStyle = '#e1b85a'; g.fillRect(20, -7, 6, 14);
      g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-8, -5, 34, 10);
    }
    if (c.type === 'lasso') { // the rope loop: spinning over his head, then flying out and landing
      const h = handAt(p, true, x, y, hop);
      let lx = h.x, ly = h.y - 22, rx = 26, ry = 7;
      if (t > 1.9) { const u = ease((t - 1.9) / 0.35); lx = lerp(h.x, x + dir * 130, u); ly = lerp(h.y - 22, y - 4, u) - Math.sin(u * Math.PI) * 40; rx = lerp(26, 20, u); ry = lerp(7, 8, u); }
      g.strokeStyle = '#d8b06a'; g.lineWidth = 3; g.beginPath(); g.ellipse(lx, ly, rx, ry, t < 1.9 ? Math.sin(t * 13) * 0.15 : 0, 0, 7); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(h.x, h.y); g.quadraticCurveTo((h.x + lx) / 2, Math.max(h.y, ly) + 12, lx - dir * rx * 0.7, ly + 2); g.stroke();
    }
    if (c.type === 'horns') { // horns on the helmet + steam out of his nose
      const hx = x + dir * p.head.ox, hy = y - hop - 50, a = ease(t / 0.3);
      g.fillStyle = '#f4ead2'; g.strokeStyle = OUT; g.lineWidth = 2;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + s * 12, hy - 15); g.quadraticCurveTo(hx + s * 30, hy - 18 - 6 * a, hx + s * 26, hy - 20 - 16 * a); g.quadraticCurveTo(hx + s * 22, hy - 20, hx + s * 6, hy - 19); g.closePath(); g.fill(); g.stroke(); }
      if (t > 0.3 && t < 1.4) for (let k = 0; k < 2; k++) { const u = ((t * 2 + k * 0.5) % 1); g.globalAlpha = (1 - u) * 0.7; g.fillStyle = '#fff'; g.beginPath(); g.arc(x + dir * (26 + u * 26), y - hop - 56 + u * 6, 4 + u * 7, 0, 7); g.fill(); }
    }
    if (c.type === 'bolt' && t > 0.38 && t < 0.9) { // a lightning bolt comes down out of the sky right onto him
      const al = 1 - (t - 0.38) / 0.52, top = y - hop - 330, bx = x + dir * 6;
      g.globalAlpha = al; g.strokeStyle = '#fff6b0'; g.lineWidth = 10; g.shadowColor = '#ffc20e'; g.shadowBlur = 18;
      const pts = [[bx + 30, top], [bx - 6, top + 110], [bx + 22, top + 120], [bx - 14, top + 250], [bx + 8, top + 260], [bx - 4, y - hop - 80]];
      g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = '#ffc20e'; g.lineWidth = 4; g.stroke();
    }
    if (c.type === 'fin') { // a dorsal fin on his raised hand
      const h = handAt(p, true, x, y, hop), a = ease(t / 0.3);
      g.globalAlpha = a; g.fillStyle = '#008e97'; g.strokeStyle = OUT; g.lineWidth = 2;
      g.beginPath(); g.moveTo(h.x - dir * 8, h.y + 6); g.quadraticCurveTo(h.x - dir * 2, h.y - 12, h.x + dir * 10, h.y - 22); g.quadraticCurveTo(h.x + dir * 5, h.y - 6, h.x + dir * 9, h.y + 6); g.closePath(); g.fill(); g.stroke();
    }
    if (c.type === 'wheel') { // wooden ship's wheel in front of him
      const w = t < 0.3 ? 0 : Math.sin((t - 0.3) * 2.8) * 0.9, cx = x + dir * 16, cy = y - hop - 18 - 17 - 6;
      g.translate(cx, cy); g.scale(0.5, 1); g.rotate(w * dir);
      g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.stroke();
      g.strokeStyle = '#8a5a2b'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.stroke();
      g.lineWidth = 3; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); g.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); g.stroke(); }
      g.fillStyle = '#c99a5b'; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill();
    }
    if (c.type === 'gold') {
      if (t < 1.55) { const h = handAt(p, true, x, y, hop); g.fillStyle = '#7d8590'; g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.ellipse(h.x - dir * 3, h.y + 2, 14, 5, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#c9a74a'; g.beginPath(); g.ellipse(h.x - dir * 3, h.y + 1, 7, 2.2, 0, 0, 7); g.fill(); }
      else { const h = handAt(p, true, x, y, hop), s = 1 + Math.sin(t * 10) * 0.08; g.fillStyle = '#ffd23f'; g.strokeStyle = '#8a6a10'; g.lineWidth = 2; g.beginPath(); g.moveTo(h.x - 6 * s, h.y - 2); g.lineTo(h.x - 2, h.y - 10 * s); g.lineTo(h.x + 6 * s, h.y - 6); g.lineTo(h.x + 4, h.y + 2); g.closePath(); g.fill(); g.stroke(); }
    }
    if (c.type === 'jet' && t > 0.4 && t < 2.4) { g.globalAlpha = 0.9; g.font = font(22); g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#125740'; const s = 'J-E-T-S'.slice(0, 1 + Math.floor((t - 0.4) / 0.28) * 2); g.strokeText(s, x, y - hop - 130); g.fillStyle = '#fff'; g.fillText(s, x, y - hop - 130); }
    g.restore();
  };
})();
