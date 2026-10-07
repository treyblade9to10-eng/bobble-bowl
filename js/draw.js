// ---- Rendering: field, bobbleheads, ball, effects, scorebug ----
const CW = 1280, CH = 720;
const PX = 22;          // pixels per yard (left/right)
const PY = 11;          // pixels per yard (up/down) - squished = tilted camera look
const TOP = 104;        // screen y of the far sideline
const FIELD_W = 53.33;
const cam = { x: 60, shake: 0 };

const SKIN = ['#f6d3b3', '#e8b48f', '#c98e62', '#a26a42', '#7a4a2a', '#5a3620'];

function sx(x) { return (x - cam.x) * PX + CW / 2; }
function sy(y) { return TOP + y * PY; }

function drawField(g, G) {
  // stands + sky strip
  g.fillStyle = '#1b2433'; g.fillRect(0, 0, CW, TOP - 14);
  const off = cam.x * PX * 0.6;
  for (let i = 0; i < 260; i++) { // crowd dots
    const wx = ((i * 37) % 1400) - (off % 1400);
    const x = ((wx % 1400) + 1400) % 1400 - 60, y = 18 + ((i * 53) % (TOP - 40));
    const cols = [G.teams[0].c1, G.teams[1].c1, '#ddd', '#888', G.teams[0].c2];
    g.fillStyle = cols[i % 5];
    const jump = G.crowdHype > 0 ? Math.abs(Math.sin(G.time * 12 + i)) * 5 * G.crowdHype : 0;
    g.beginPath(); g.arc(x, y - jump, 4, 0, 7); g.fill();
  }
  // sideline apron
  g.fillStyle = '#27622a'; g.fillRect(0, TOP - 14, CW, CH - TOP + 14);
  // grass stripes every 5 yards
  for (let yd = -10; yd < 130; yd += 5) {
    const x0 = sx(yd), x1 = sx(yd + 5);
    if (x1 < 0 || x0 > CW) continue;
    g.fillStyle = (Math.floor(yd / 5) % 2 === 0) ? '#3a9140' : '#358638';
    if (yd < 0 || yd >= 120) g.fillStyle = '#27622a';
    g.fillRect(x0, sy(0), x1 - x0 + 1, FIELD_W * PY);
  }
  // end zones: left one belongs to team 0 (home), right one to team 1
  for (let s = 0; s < 2; s++) {
    const t = G.teams[s], x0 = sx(s === 0 ? 0 : 110);
    if (x0 > CW || x0 + 10 * PX < 0) continue;
    g.fillStyle = t.c1; g.fillRect(x0, sy(0), 10 * PX, FIELD_W * PY);
    g.save(); g.translate(x0 + 5 * PX, sy(FIELD_W / 2)); g.rotate(s === 0 ? -Math.PI / 2 : Math.PI / 2);
    g.fillStyle = t.c2; g.font = '900 64px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.globalAlpha = 0.85; g.fillText(t.name.toUpperCase(), 0, 0); g.restore();
  }
  // lines
  g.strokeStyle = '#ffffffcc'; g.lineWidth = 2;
  for (let yd = 10; yd <= 110; yd += 5) {
    const x = sx(yd); if (x < -5 || x > CW + 5) continue;
    g.lineWidth = (yd === 10 || yd === 110) ? 4 : 2;
    g.beginPath(); g.moveTo(x, sy(0)); g.lineTo(x, sy(FIELD_W)); g.stroke();
  }
  // hash marks
  g.lineWidth = 1.5;
  for (let yd = 11; yd < 110; yd++) {
    const x = sx(yd); if (x < 0 || x > CW) continue;
    for (const hy of [0.6, 23.6, 29.7, 52.7]) { g.beginPath(); g.moveTo(x, sy(hy) - 3); g.lineTo(x, sy(hy) + 3); g.stroke(); }
  }
  // numbers
  g.fillStyle = '#ffffffd0'; g.font = 'bold 30px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let yd = 20; yd <= 100; yd += 10) {
    const x = sx(yd); if (x < -40 || x > CW + 40) continue;
    const n = yd <= 60 ? yd - 10 : 110 - yd;
    g.fillText(String(n), x, sy(9)); g.fillText(String(n), x, sy(44.5));
  }
  // sidelines + back lines
  g.strokeStyle = '#fff'; g.lineWidth = 5;
  g.strokeRect(sx(0), sy(0), 120 * PX, FIELD_W * PY);
  // goal posts (simple)
  for (const gx of [0, 120]) {
    const x = sx(gx); if (x < -60 || x > CW + 60) continue;
    g.strokeStyle = '#ffe14d'; g.lineWidth = 5; const my = sy(FIELD_W / 2);
    g.beginPath(); g.moveTo(x, my); g.lineTo(x, my - 60); g.moveTo(x, my - 60 - 34); g.lineTo(x, my - 60 + 34);
    g.moveTo(x, my - 60 - 34); g.lineTo(x + (gx ? 22 : -22), my - 60 - 34 - 40);
    g.moveTo(x, my - 60 + 34); g.lineTo(x + (gx ? 22 : -22), my - 60 + 34 - 40); g.stroke();
  }
}

function drawLines(g, G) {
  if (!G.los) return;
  const lx = sx(G.los);
  g.lineWidth = 4; g.strokeStyle = '#3aa0ff';
  g.beginPath(); g.moveTo(lx, sy(0)); g.lineTo(lx, sy(FIELD_W)); g.stroke();
  if (G.firstDownX != null && G.firstDownX > 10 && G.firstDownX < 110) {
    const fx = sx(G.firstDownX); g.strokeStyle = '#ffe14d';
    g.beginPath(); g.moveTo(fx, sy(0)); g.lineTo(fx, sy(FIELD_W)); g.stroke();
  }
}

// ---- the bobblehead ----
function drawPlayer(g, p, G) {
  const x = sx(p.x), y = sy(p.y);
  if (x < -60 || x > CW + 60) return;
  const team = G.teams[p.side];
  const home = p.side === 0;
  const jersey = home ? team.c1 : '#f4f4f4';
  const trim = home ? team.c2 : team.c1;
  const pants = home ? shade(team.c2, -0.1) : shade(team.c1, 0.1);
  const big = p.pos === 'OL' || p.pos === 'DL';
  const bw = big ? 22 : 17, bh = big ? 19 : 18;
  const headR = (big ? 15 : 16) * (p.headScale || 1);
  const face = p.face;

  // ring + shadow
  if (p.isHuman) {
    g.strokeStyle = '#ffe14d'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(x, y, 18, 8, 0, 0, 7); g.stroke();
    g.fillStyle = '#ffe14d'; g.beginPath(); g.moveTo(x - 7, y - 70 - headR); g.lineTo(x + 7, y - 70 - headR); g.lineTo(x, y - 60 - headR); g.fill();
  }
  g.fillStyle = '#0005'; g.beginPath(); g.ellipse(x, y, big ? 16 : 13, 5.5, 0, 0, 7); g.fill();

  g.save(); g.translate(x, y);
  if (p.down > 0) { // lying on the turf
    g.rotate(p.downDir * 1.35); g.translate(0, -4);
  } else if (p.spin > 0) {
    g.scale(Math.cos(p.spin * 18), 1);
  }

  // legs
  const sw = Math.sin(p.anim) * Math.min(1, p.speedNow / 3) * 0.7;
  g.strokeStyle = pants; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-4, -14); g.lineTo(-4 + Math.sin(sw) * 9, -2); g.stroke();
  g.beginPath(); g.moveTo(4, -14); g.lineTo(4 - Math.sin(sw) * 9, -2); g.stroke();
  g.fillStyle = '#111';
  g.beginPath(); g.arc(-4 + Math.sin(sw) * 9, -1, 3.2, 0, 7); g.arc(4 - Math.sin(sw) * 9, -1, 3.2, 0, 7); g.fill();

  // torso
  const ty = -14 - bh;
  g.fillStyle = jersey; g.strokeStyle = shade(jersey, -0.45); g.lineWidth = 2;
  roundRect(g, -bw / 2, ty, bw, bh, 6); g.fill(); g.stroke();
  g.fillStyle = trim; g.fillRect(-bw / 2 + 1, ty + bh - 6, bw - 2, 3);
  // arms
  const as = Math.sin(p.anim + Math.PI) * Math.min(1, p.speedNow / 3);
  g.strokeStyle = jersey; g.lineWidth = 6;
  g.beginPath(); g.moveTo(-bw / 2 + 1, ty + 4); g.lineTo(-bw / 2 - 4 + as * 3, ty + 14); g.stroke();
  g.beginPath(); g.moveTo(bw / 2 - 1, ty + 4); g.lineTo(bw / 2 + 4 - as * 3, ty + 14); g.stroke();
  g.fillStyle = SKIN[face.skin];
  g.beginPath(); g.arc(-bw / 2 - 4 + as * 3, ty + 15, 3, 0, 7); g.arc(bw / 2 + 4 - as * 3, ty + 15, 3, 0, 7); g.fill();
  // number
  g.fillStyle = trim; g.font = 'bold 11px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(p.num, 0, ty + bh / 2 - 1);

  // ball in arms
  if (G.ball && G.ball.holder === p) drawFootball(g, p.face.dir * 9, ty + 10, 0.9, p.face.dir * 0.5);

  // neck spring (the bobble!)
  const hx = p.head.ox, hy = ty - headR + 3 + p.head.oy;
  g.strokeStyle = SKIN[face.skin]; g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, ty + 1); g.lineTo(hx * 0.6, hy + headR * 0.7); g.stroke();
  g.save(); g.translate(hx, hy); g.rotate(p.head.rot);
  drawHead(g, headR, team, face, p);
  g.restore();
  g.restore();

  // labels
  const showName = p.isHuman || (G.ball && G.ball.holder === p) || G.phase === 'presnap' && (p.slot <= 4 && p.off);
  if (showName) {
    g.font = 'bold 12px Arial, sans-serif'; g.textAlign = 'center';
    const label = (p.isHuman || G.ball.holder === p) ? p.name : lastName(p.name);
    const w = g.measureText(label).width + 10, ly = y - 48 - headR * 2 - 8;
    g.fillStyle = '#000b'; roundRect(g, x - w / 2, ly - 9, w, 17, 6); g.fill();
    g.fillStyle = p.isHuman ? '#ffe14d' : '#fff'; g.textBaseline = 'middle'; g.fillText(label, x, ly);
  }
  if (p.throwKey) {
    const ky = y - 48 - headR * 2 - (showName ? 32 : 10);
    const col = ['#2f7bff', '#ff3b3b', '#2fd06b', '#ffb02e'][p.throwKey - 1];
    g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, ky, 12, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 15px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.throwKey, x, ky + 1);
    if (p.openness != null) { // little open meter
      g.fillStyle = p.openness > 3 ? '#2fd06b' : p.openness > 1.6 ? '#ffd23f' : '#ff4040';
      g.fillRect(x - 12, ky + 14, 24 * clamp(p.openness / 5, 0.15, 1), 4);
    }
  }
}

function drawHead(g, R, team, face, p) {
  const d = face.dir; // 1 = facing right, -1 = left
  // helmet shell
  g.fillStyle = team.helmet; g.strokeStyle = shade(team.helmet, -0.5); g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); g.stroke();
  // shine
  g.fillStyle = '#ffffff40'; g.beginPath(); g.ellipse(-d * R * 0.35, -R * 0.45, R * 0.35, R * 0.2, -0.5 * d, 0, 7); g.fill();
  // center stripe
  g.strokeStyle = team.c2; g.lineWidth = 3.5;
  g.beginPath(); g.arc(0, 0, R - 2, -Math.PI / 2 - 1.1 * d, -Math.PI / 2 + 0.3 * d, d < 0); g.stroke();
  // face opening
  const fx = d * R * 0.38, fy = R * 0.15;
  g.fillStyle = SKIN[face.skin];
  g.beginPath(); g.ellipse(fx, fy, R * 0.55, R * 0.58, 0, 0, 7); g.fill();
  // eyebrows / eyes
  const ex = fx + d * R * 0.12;
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(ex - R * 0.2, fy - R * 0.12, R * 0.15, R * 0.18, 0, 0, 7); g.ellipse(ex + R * 0.2, fy - R * 0.12, R * 0.15, R * 0.18, 0, 0, 7); g.fill();
  g.fillStyle = '#111';
  const look = d * R * 0.06;
  g.beginPath(); g.arc(ex - R * 0.2 + look, fy - R * 0.1, R * 0.08, 0, 7); g.arc(ex + R * 0.2 + look, fy - R * 0.1, R * 0.08, 0, 7); g.fill();
  g.strokeStyle = '#1a1009'; g.lineWidth = 2;
  const brow = face.angry ? 0.12 : -0.04;
  g.beginPath(); g.moveTo(ex - R * 0.34, fy - R * (0.36 + brow)); g.lineTo(ex - R * 0.08, fy - R * 0.36);
  g.moveTo(ex + R * 0.08, fy - R * 0.36); g.lineTo(ex + R * 0.34, fy - R * (0.36 + brow)); g.stroke();
  // mouth
  g.strokeStyle = '#4a1b10'; g.lineWidth = 2;
  g.beginPath();
  if (p.mouth === 'O') { g.fillStyle = '#4a1b10'; g.ellipse(ex, fy + R * 0.25, R * 0.1, R * 0.12, 0, 0, 7); g.fill(); }
  else g.arc(ex, fy + R * 0.12, R * 0.18, 0.3, Math.PI - 0.3);
  g.stroke();
  if (face.beard) { g.fillStyle = '#2a1a10cc'; g.beginPath(); g.ellipse(ex, fy + R * 0.38, R * 0.36, R * 0.16, 0, 0, Math.PI); g.fill(); }
  // facemask
  g.strokeStyle = team.mask || '#bbb'; g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(fx - R * 0.45, fy - R * 0.02); g.lineTo(fx + R * 0.5, fy - R * 0.02);
  g.moveTo(fx - R * 0.4, fy + R * 0.32); g.lineTo(fx + R * 0.45, fy + R * 0.32);
  g.moveTo(fx, fy - R * 0.02); g.lineTo(fx + d * R * 0.05, fy + R * 0.55);
  g.stroke();
  // ear hole
  g.fillStyle = shade(team.helmet, -0.4); g.beginPath(); g.arc(-d * R * 0.25, R * 0.1, R * 0.12, 0, 7); g.fill();
}

function drawFootball(g, x, y, s = 1, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = '#7a3e14'; g.strokeStyle = '#3d1d08'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(0, 0, 8, 5, 0, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0);
  for (let i = -2; i <= 2; i += 2) { g.moveTo(i, -1.5); g.lineTo(i, 1.5); }
  g.stroke(); g.restore();
}

function drawBallFree(g, G) {
  const b = G.ball; if (!b || b.holder) return;
  const x = sx(b.x), y = sy(b.y);
  g.fillStyle = '#0006'; g.beginPath(); g.ellipse(x, y, 7, 3, 0, 0, 7); g.fill();
  drawFootball(g, x, y - b.z * PX * 0.9, 1.15, b.spin || 0);
  if (b.flight && G.showTarget) { // landing marker
    const tx = sx(b.flight.tx), ty = sy(b.flight.ty);
    g.strokeStyle = '#ffffff99'; g.lineWidth = 2; g.setLineDash([4, 4]);
    g.beginPath(); g.ellipse(tx, ty, 14, 6, 0, 0, 7); g.stroke(); g.setLineDash([]);
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---- particles & floating text ----
function drawFx(g, G) {
  for (const f of G.fx) {
    const a = clamp(f.life / f.max, 0, 1);
    if (f.kind === 'dust') { g.fillStyle = `rgba(230,220,190,${a * 0.6})`; g.beginPath(); g.arc(sx(f.x), sy(f.y) - f.z, f.r * (2 - a), 0, 7); g.fill(); }
    else if (f.kind === 'star') { g.fillStyle = `rgba(255,230,80,${a})`; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('★', sx(f.x), sy(f.y) - f.z); }
    else if (f.kind === 'text') {
      g.font = `900 ${f.size || 20}px Arial Black, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = `rgba(0,0,0,${a})`; g.fillStyle = f.color || '#fff'; g.globalAlpha = a;
      g.strokeText(f.text, sx(f.x), sy(f.y) - f.z); g.fillText(f.text, sx(f.x), sy(f.y) - f.z); g.globalAlpha = 1;
    }
  }
}

function drawBanner(g, G) {
  const b = G.banner; if (!b) return;
  const t = b.t, pop = t < 0.25 ? 0.4 + (t / 0.25) * 0.8 : 1.2 - Math.min(0.2, (t - 0.25) * 0.8);
  g.save(); g.translate(CW / 2, CH / 2 - 40); g.scale(pop, pop); g.rotate(Math.sin(t * 6) * 0.03);
  g.font = '900 78px Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#000'; g.strokeText(b.text, 0, 0);
  g.fillStyle = b.color || '#ffd23f'; g.fillText(b.text, 0, 0);
  if (b.sub) { g.font = 'bold 26px Arial, sans-serif'; g.lineWidth = 6; g.strokeText(b.sub, 0, 60); g.fillStyle = '#fff'; g.fillText(b.sub, 0, 60); }
  g.restore();
}

function ordinal(n) { return ['1st', '2nd', '3rd', '4th'][n - 1] || n + 'th'; }

function drawHUD(g, G) {
  const W = 620, x0 = (CW - W) / 2, y0 = 8;
  g.fillStyle = '#0d1117ee'; roundRect(g, x0, y0, W, 52, 12); g.fill();
  const cell = (t, s, x, poss) => {
    g.fillStyle = t.c1; roundRect(g, x, y0 + 6, 190, 40, 8); g.fill();
    g.fillStyle = textOn(t.c1); g.font = '900 22px Arial Black, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(t.id, x + 10, y0 + 27);
    const idW = g.measureText(t.id).width;
    g.font = 'bold 11px Arial, sans-serif'; g.fillText(t.name.toUpperCase().slice(0, 11), x + 16 + idW, y0 + 28);
    g.font = '900 28px Arial Black, sans-serif'; g.textAlign = 'right'; g.fillText(s, x + 182, y0 + 27);
    if (poss) drawFootball(g, x + 95, y0 + 41, 0.7);
  };
  cell(G.teams[1], G.score[1], x0 + 6, G.poss === 1);
  cell(G.teams[0], G.score[0], x0 + 216 + 8, G.poss === 0);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 18px Arial, sans-serif';
  const q = G.quarter > 4 ? 'OT' : ordinal(G.quarter);
  const c = Math.max(0, Math.ceil(G.clock)), m = Math.floor(c / 60), s = String(c % 60).padStart(2, '0');
  g.fillText(`${q}  ${m}:${s}`, x0 + W - 92, y0 + 18);
  g.font = 'bold 14px Arial, sans-serif'; g.fillStyle = '#ffd23f';
  g.fillText(G.downText(), x0 + W - 92, y0 + 40);
  // away label tiny
  g.fillStyle = '#fff8'; g.font = '10px Arial'; g.textAlign = 'left';
  g.fillText('AWAY', x0 + 8, y0 + 58 + 4); g.fillText('HOME', x0 + 224, y0 + 58 + 4);

  // controls hint
  g.textAlign = 'left'; g.fillStyle = '#ffffffb0'; g.font = 'bold 13px Arial, sans-serif';
  g.fillText(G.hint || '', 12, CH - 12);
  // stamina bar
  const h = G.humanPlayer;
  if (h && G.phase === 'live') {
    g.fillStyle = '#0009'; g.fillRect(12, CH - 42, 124, 12);
    g.fillStyle = h.stamina > 0.3 ? '#2fd06b' : '#ff6040'; g.fillRect(14, CH - 40, 120 * h.stamina, 8);
    g.fillStyle = '#fff'; g.font = 'bold 10px Arial'; g.fillText('SPRINT', 140, CH - 32);
  }
}
