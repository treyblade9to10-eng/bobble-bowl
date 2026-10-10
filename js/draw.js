// ---- Rendering: field, bobbleheads, ball, effects, scorebug ----
let CW = 1280; const CH = 720; // CW grows on wide phones so the field fills the screen
const PX = 24;          // pixels per yard (left/right)
const PY = 14;          // pixels per yard (up/down) - squished = tilted camera look
const FIELD_W = 53.33;
const MID_Y = FIELD_W / 2;
const cam = { x: 60, y: FIELD_W / 2, shake: 0, zoom: 1 };
const SKIN = ['#f6d3b3', '#e8b48f', '#c98e62', '#a26a42', '#7a4a2a', '#5a3620'];
const OUT = '#14110f'; // cartoon outline color

// 5-point star as a shape (font star glyphs show up as boxes on some phones)
function starPath(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
}

const VY = 34; // screen offset so the HUD doesn't cover the play
function sx(x) { return (x - cam.x) * PX + CW / 2; }
function sy(y) { return (y - cam.y) * PY + CH / 2 + VY; }
function wx(px) { return (px - CW / 2) / PX + cam.x; }
function wy(py) { return (py - CH / 2 - VY) / PY + cam.y; }

// ---------- field (pre-rendered once per game) ----------
const FIELD_PAD_X = 6, FIELD_PAD_TOP = 8, FIELD_PAD_BOT = 5;
let fieldCv = null, fieldKey = '';
function buildField(G) {
  const key = G.teams[0].id + G.teams[1].id + (G.demo ? 'd' : '');
  if (fieldKey === key && fieldCv) return;
  fieldKey = key;
  const W = Math.ceil((120 + FIELD_PAD_X * 2) * PX), H = Math.ceil((FIELD_W + FIELD_PAD_TOP + FIELD_PAD_BOT) * PY);
  fieldCv = document.createElement('canvas'); fieldCv.width = W; fieldCv.height = H;
  const g = fieldCv.getContext('2d');
  const fx = x => (x + FIELD_PAD_X) * PX, fy = y => (y + FIELD_PAD_TOP) * PY;
  // stands
  const stad = stadiumOf(G.teams[0]);
  const st = g.createLinearGradient(0, 0, 0, fy(-1.2));
  st.addColorStop(0, stad.dome ? '#07090d' : '#0e1420'); st.addColorStop(1, stad.dome ? '#1b2230' : '#253147');
  g.fillStyle = st; g.fillRect(0, 0, W, fy(-1.2));
  // home crowd: mostly home colors, a few away fans
  const cols = [G.teams[0].c1, G.teams[0].c2, G.teams[0].c1, G.teams[1].c1, '#e8e8e8', G.teams[0].c1, G.teams[0].c2];
  for (let row = 0; row < 6; row++) for (let i = 0; i < W / 13; i++) {
    const h = hashStr(row + ':' + i);
    g.fillStyle = cols[h % cols.length];
    g.beginPath(); g.arc(i * 13 + (row % 2) * 6 + 4, 10 + row * 12, 4.5, 0, 7); g.fill();
    g.fillStyle = SKIN[(h >> 4) % 6]; g.beginPath(); g.arc(i * 13 + (row % 2) * 6 + 4, 4 + row * 12, 3, 0, 7); g.fill();
  }
  // ad wall
  g.fillStyle = '#10151d'; g.fillRect(0, fy(-1.9), W, 0.9 * PY);
  if (stad.dome) { g.fillStyle = '#ffffff10'; for (let x = 0; x < W; x += 90) g.fillRect(x, 0, 3, 8); } // roof trusses
  g.fillStyle = '#ffffff30'; g.font = 'bold 9px Barlow, Arial, sans-serif'; g.textAlign = 'left';
  const wall = `${stad.name.toUpperCase()}  •  ${G.teams[0].city.toUpperCase()}  •  BOBBLE BOWL`;
  for (let x = 0; x < W; x += 300) g.fillText(wall, x + 10, fy(-1.35));
  // apron + grass
  g.fillStyle = '#2b6b2e'; g.fillRect(0, fy(-1.2), W, H - fy(-1.2));
  for (let yd = -FIELD_PAD_X; yd < 120 + FIELD_PAD_X; yd += 5) {
    const inField = yd >= 0 && yd < 120;
    g.fillStyle = !inField ? (stad.turf ? '#23743a' : '#2b6b2e') : stad.turf ? ((Math.floor(yd / 5) % 2 === 0) ? '#34a04f' : '#2f9749') : (Math.floor(yd / 5) % 2 === 0) ? '#3d9a43' : '#378f3c';
    g.fillRect(fx(yd), fy(0), 5 * PX + 1, FIELD_W * PY);
  }
  // mowing texture
  g.globalAlpha = stad.turf ? 0.02 : 0.05; g.fillStyle = '#000';
  for (let y = 0; y < FIELD_W; y += 2) g.fillRect(fx(0), fy(y), 120 * PX, PY * 0.5);
  g.globalAlpha = 1;
  // end zones
  for (let s = 0; s < 2; s++) {
    const t = G.teams[s], x0 = fx(s === 0 ? 0 : 110);
    const ez = g.createLinearGradient(x0, 0, x0 + 10 * PX, 0);
    ez.addColorStop(0, shade(t.c1, -0.15)); ez.addColorStop(0.5, t.c1); ez.addColorStop(1, shade(t.c1, -0.15));
    g.fillStyle = ez; g.fillRect(x0, fy(0), 10 * PX, FIELD_W * PY);
    g.save(); g.translate(x0 + 5 * PX, fy(FIELD_W / 2)); g.rotate(s === 0 ? -Math.PI / 2 : Math.PI / 2);
    g.font = '900 86px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = shade(t.c1, -0.5); g.strokeText(t.name.toUpperCase(), 0, 0);
    g.fillStyle = t.c2; g.fillText(t.name.toUpperCase(), 0, 0); g.restore();
  }
  // yard lines
  g.strokeStyle = '#ffffffdd';
  for (let yd = 10; yd <= 110; yd += 5) { g.lineWidth = (yd === 10 || yd === 110) ? 5 : 2.5; g.beginPath(); g.moveTo(fx(yd), fy(0)); g.lineTo(fx(yd), fy(FIELD_W)); g.stroke(); }
  g.lineWidth = 2;
  for (let yd = 11; yd < 110; yd++) for (const hy of [0.7, 23.6, 29.7, 52.6]) { g.beginPath(); g.moveTo(fx(yd), fy(hy) - 4); g.lineTo(fx(yd), fy(hy) + 4); g.stroke(); }
  // numbers with arrows
  g.font = '900 34px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let yd = 20; yd <= 100; yd += 10) {
    const n = yd <= 60 ? yd - 10 : 110 - yd;
    for (const ny of [8.5, 44.8]) { g.fillStyle = '#ffffffd8'; g.fillText(String(n), fx(yd), fy(ny)); }
  }
  // midfield circle
  // home team logo at midfield
  const ht = G.teams[0];
  g.fillStyle = ht.c1 + 'd0'; g.beginPath(); g.ellipse(fx(60), fy(FIELD_W / 2), 4.4 * PX, 4.4 * PY, 0, 0, 7); g.fill();
  g.strokeStyle = ht.c2; g.lineWidth = 5; g.stroke();
  g.font = 'italic 900 56px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = shade(ht.c1, -0.5); g.strokeText(ht.id, fx(60), fy(FIELD_W / 2) + 2);
  g.fillStyle = ht.c2 === '#000000' ? '#fff' : ht.c2; g.fillText(ht.id, fx(60), fy(FIELD_W / 2) + 2);
  // sidelines
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.strokeRect(fx(0), fy(0), 120 * PX, FIELD_W * PY);
  // goal posts at the back of each end zone (fake 3D: height goes up and leans outward)
  for (const [ex, side] of [[0, -1], [120, 1]]) {
    const P = (y, z) => [fx(ex) + side * z * PX * 0.12, fy(y) - z * PX * 0.75];
    const half = 3.1, bar = 3.4, top = 12;
    const seg = (a, b, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
    g.fillStyle = '#00000040'; g.beginPath(); g.ellipse(fx(ex), fy(MID_Y), 10, 4, 0, 0, 7); g.fill();
    for (const [w, col] of [[11, '#3a2c00'], [7, '#ffd400']]) {
      seg(P(MID_Y, 0), P(MID_Y, bar * 0.7), w, col);                       // post
      seg(P(MID_Y, bar * 0.7), P(MID_Y - 0.6, bar), w, col);               // gooseneck
      seg(P(MID_Y - half, bar), P(MID_Y + half, bar), w, col);            // crossbar
      seg(P(MID_Y - half, bar), P(MID_Y - half, top), w - 1, col);        // uprights
      seg(P(MID_Y + half, bar), P(MID_Y + half, top), w - 1, col);
    }
    g.fillStyle = '#ff3b30'; for (const yy of [MID_Y - half, MID_Y + half]) { const [px, py] = P(yy, top); g.fillRect(px - 2, py - 10, 5, 10); }
  }
  // team benches area
  g.fillStyle = '#ffffff10'; g.fillRect(fx(35), fy(FIELD_W) + 10, 50 * PX, 3 * PY);
}

function drawField(g, G) {
  buildField(G);
  g.fillStyle = '#2b6b2e'; g.fillRect(0, 0, CW, CH);
  // source rect for the current camera
  const x0 = wx(0), y0 = wy(0);
  let srcX = (x0 + FIELD_PAD_X) * PX, srcY = (y0 + FIELD_PAD_TOP) * PY;
  let dx = 0, dy = 0, w = CW, h = CH;
  if (srcX < 0) { dx = -srcX; w -= dx; srcX = 0; }
  if (srcY < 0) { dy = -srcY; h -= dy; srcY = 0; }
  w = Math.min(w, fieldCv.width - srcX); h = Math.min(h, fieldCv.height - srcY);
  if (w > 0 && h > 0) g.drawImage(fieldCv, srcX, srcY, w, h, dx, dy, w, h);
  // jumping fans when hyped
  if (G.crowdHype > 0.05) {
    const top = sy(-FIELD_PAD_TOP);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + G.time * 20) % (CW + 40) - 20, j = Math.abs(Math.sin(G.time * 11 + i)) * 10 * G.crowdHype;
      g.fillStyle = i % 2 ? G.teams[0].c1 : G.teams[1].c1;
      g.fillRect(x, top + 12 + (i % 5) * 12 - j, 6, 10);
    }
  }
}

function drawLines(g, G) {
  if (G.los == null || G.phase === 'kick' || G.phase === 'mini') return;
  const lx = sx(G.los);
  g.lineWidth = 5; g.strokeStyle = '#2f8cff';
  g.beginPath(); g.moveTo(lx, sy(0)); g.lineTo(lx, sy(FIELD_W)); g.stroke();
  if (G.firstDownX != null && G.firstDownX > 10 && G.firstDownX < 110 && !G.goalToGo) {
    const fx = sx(G.firstDownX); g.strokeStyle = '#ffd400';
    g.beginPath(); g.moveTo(fx, sy(0)); g.lineTo(fx, sy(FIELD_W)); g.stroke();
  }
}

// planned routes before the snap (only for the human's offense)
function drawRoutes(g, G) {
  if (!G.O || !G.play || (G.versus && !G.online)) return; // 2-player on one screen: no peeking at routes
  if (G.poss !== G.human) return drawDefJob(g, G);
  const live = G.phase === 'live';
  if (!(G.phase === 'presnap' || (live && G.bstate === 'snap'))) return;
  g.save(); g.lineWidth = live ? 3 : 3.5; g.setLineDash([8, 6]); g.lineCap = 'round';
  g.globalAlpha = live ? 0.55 : 1;
  const cols = { 2: '#5aa0ff', 3: '#ff6b6b', 4: '#4fe08a', 1: '#ffbf4a' };
  for (const p of G.O) {
    if (!p.route || !(p.role === 'route' || p.role === 'runpath')) continue;
    g.strokeStyle = p.role === 'runpath' && !G.play.off.fake ? '#ff9a3d' : (cols[p.slot] || '#fff');
    g.beginPath(); g.moveTo(sx(live ? p.x : p.hx), sy(live ? p.y : p.hy));
    for (let i = live ? p.route.i : 0; i < p.route.pts.length; i++) { const q = p.route.pts[i]; g.lineTo(sx(q.x), sy(q.y)); }
    g.stroke();
    const a = p.route.pts[p.route.pts.length - 2] || p, z = p.route.pts[p.route.pts.length - 1];
    if (p.route.end === 'go') { // arrow head
      const ang = Math.atan2(sy(z.y) - sy(a.y), sx(z.x) - sx(a.x));
      g.setLineDash([]); g.beginPath();
      g.moveTo(sx(z.x) + Math.cos(ang) * 10, sy(z.y) + Math.sin(ang) * 10);
      g.lineTo(sx(z.x) + Math.cos(ang + 2.5) * 10, sy(z.y) + Math.sin(ang + 2.5) * 10);
      g.lineTo(sx(z.x) + Math.cos(ang - 2.5) * 10, sy(z.y) + Math.sin(ang - 2.5) * 10);
      g.closePath(); g.fillStyle = g.strokeStyle; g.fill(); g.setLineDash([8, 6]);
    }
  }
  g.restore();
}
// on defense: show what YOUR player is supposed to do
function drawDefJob(g, G) {
  const h = G.humanDef;
  if (!h || !h.assign || !(G.phase === 'presnap' || (G.phase === 'live' && G.bstate === 'snap'))) return;
  const a = h.assign, d = dirOf(G.poss);
  g.save(); g.strokeStyle = '#ffe14d'; g.lineWidth = 3; g.setLineDash([6, 6]); g.globalAlpha = 0.8;
  let label = '';
  if (a.type === 'man') { const t = G.O[a.t]; g.beginPath(); g.moveTo(sx(h.x), sy(h.y)); g.lineTo(sx(t.x), sy(t.y)); g.stroke(); label = 'COVER ' + lastName(t.name).toUpperCase(); }
  else if (a.type === 'zone') { const zx = G.los + d * a.d, zy = zoneY(a.y); g.beginPath(); g.ellipse(sx(zx), sy(zy), 6 * PX, 6 * PY, 0, 0, 7); g.stroke(); g.fillStyle = '#ffe14d18'; g.fill(); label = 'GUARD THIS ZONE'; }
  else if (a.type === 'rush') { const q = G.O[0]; g.beginPath(); g.moveTo(sx(h.x), sy(h.y)); g.lineTo(sx(q.x), sy(q.y)); g.stroke(); label = 'GET THE QB!'; }
  else { label = 'SPY THE QB'; }
  g.setLineDash([]); g.globalAlpha = 1;
  if (G.phase === 'presnap') {
    g.font = 'bold 13px Barlow, Arial, sans-serif'; g.textAlign = 'center'; const w = g.measureText(label).width + 14;
    g.fillStyle = '#ffe14d'; roundRect(g, sx(h.x) - w / 2, sy(h.y) + 12, w, 20, 10); g.fill();
    g.fillStyle = '#111'; g.fillText(label, sx(h.x), sy(h.y) + 26);
  }
  g.restore();
}

// ---------- the bobblehead ----------
// real throwback sets for some teams; everyone else gets a generic alternate built from their colors
const THROWBACKS = {
  CHI: { jersey: '#0B162A', trim: '#C83803', num: '#ffffff', pants: '#d8cdb0', sock: '#C83803', helmet: '#0B162A', stripe: '#0B162A', mask: '#8a8a8a' },
  TB: { jersey: '#F47B20', trim: '#C8102E', num: '#C8102E', pants: '#ffffff', sock: '#F47B20', helmet: '#ffffff', stripe: '#F47B20', mask: '#C8102E' },
  PHI: { jersey: '#2b8a3e', trim: '#ffffff', num: '#ffffff', pants: '#ffffff', sock: '#2b8a3e', helmet: '#2b8a3e', stripe: '#ffffff', mask: '#9a9a9a' },
  TEN: { jersey: '#6CACE4', trim: '#C8102E', num: '#ffffff', pants: '#ffffff', sock: '#6CACE4', helmet: '#6CACE4', stripe: '#C8102E', mask: '#ffffff' },
  SEA: { jersey: '#1C3F94', trim: '#4CA845', num: '#ffffff', pants: '#A5ACAF', sock: '#1C3F94', helmet: '#A5ACAF', stripe: '#1C3F94', mask: '#1C3F94' },
  LAR: { jersey: '#003594', trim: '#FFD100', num: '#ffffff', pants: '#ffffff', sock: '#003594', helmet: '#003594', stripe: '#FFD100', mask: '#ffffff' },
  NE: { jersey: '#C8102E', trim: '#0C2340', num: '#ffffff', pants: '#ffffff', sock: '#C8102E', helmet: '#ffffff', stripe: '#C8102E', mask: '#C8102E' },
  DEN: { jersey: '#FB4F14', trim: '#0C2C6D', num: '#ffffff', pants: '#ffffff', sock: '#FB4F14', helmet: '#0C2C6D', stripe: '#FB4F14', mask: '#9a9a9a' },
  MIA: { jersey: '#00A3AD', trim: '#F26A24', num: '#ffffff', pants: '#ffffff', sock: '#00A3AD', helmet: '#ffffff', stripe: '#F26A24', mask: '#9a9a9a' },
  BUF: { jersey: '#00338D', trim: '#C60C30', num: '#ffffff', pants: '#ffffff', sock: '#00338D', helmet: '#ffffff', stripe: '#C60C30', mask: '#9a9a9a' },
  DET: { jersey: '#0076B6', trim: '#B0B7BC', num: '#ffffff', pants: '#B0B7BC', sock: '#0076B6', helmet: '#B0B7BC', stripe: '#0076B6', mask: '#9a9a9a' },
  KC: { jersey: '#C8102E', trim: '#FFB81C', num: '#ffffff', pants: '#ffffff', sock: '#C8102E', helmet: '#C8102E', stripe: '#FFB81C', mask: '#9a9a9a' },
  GB: { jersey: '#1d2a5b', trim: '#C8A04A', num: '#C8A04A', pants: '#C8A04A', sock: '#1d2a5b', helmet: '#7a5230', stripe: '#7a5230', mask: '#7a5230' }
};
const UNIFORMS = [['home', 'Home'], ['away', 'Away'], ['rush', 'Color Rush'], ['throwback', 'Throwback']];
const lookCache = new Map();
function teamLook(team, home, style) {
  style = style || (home ? 'home' : 'away');
  if (style.startsWith('mix:')) { // mix and match: helmet from one set, jersey from another, pants from a third
    const key = team.id + team.c1 + team.c2 + team.helmet + team.mask + team.pants + home + style; let m = lookCache.get(key);
    if (!m) {
      const [h, j, p] = style.slice(4).split(',').map(k => teamLook(team, home, k));
      m = { helmet: h.helmet, stripe: h.stripe, mask: h.mask, jersey: j.jersey, trim: j.trim, num: j.num, sock: j.sock, pants: p.pants };
      lookCache.set(key, m);
    }
    return m;
  }
  const base = { helmet: team.helmet, stripe: team.c2, mask: team.mask };
  const light = c => textOn(c) === '#111';
  if (style === 'throwback') {
    if (THROWBACKS[team.id]) return { ...base, ...THROWBACKS[team.id] };
    const j = light(team.c2) ? shade(team.c1, -0.35) : team.c2;
    return { ...base, jersey: j, trim: team.c1, num: light(j) ? team.c1 : '#ffffff', pants: '#ffffff', sock: j };
  }
  if (style === 'rush') return { ...base, jersey: team.c1, trim: team.c2, num: light(team.c2) ? '#fff' : team.c2, pants: shade(team.c1, -0.08), sock: team.c1 };
  return style === 'home'
    ? { ...base, jersey: team.c1, trim: team.c2, num: team.c2 === '#ffffff' || team.c2 === '#FFFFFF' ? '#fff' : team.c2, pants: team.pants || shade(team.c2, 0.15), sock: team.c1 }
    : { ...base, jersey: '#f7f7f7', trim: team.c1, num: team.c1, pants: team.pantsAway || '#ececec', sock: team.c1 };
}

function drawPlayer(g, p, G, at) {
  const x = at ? at.x : sx(p.x), y = at ? at.y : sy(p.y);
  if (!at && (x < -80 || x > CW + 80 || y < -40 || y > CH + 140)) return;
  const team = G.teams[p.side], look = teamLook(team, p.side === 0, G.uni && G.uni[p.side]);
  const big = p.pos === 'OL' || p.pos === 'DL';
  let k = Math.min(1, p.speedNow / 5);
  if (p.celly) { const ps = Celly.pose(p, p.celly.type, p.celly.t); if (ps.legK != null) k = ps.legK; else k = 0; }
  const dir = p.face.dir;
  const carrying = G.ball && G.ball.holder === p;
  const celebrate = p.celebrate > 0;
  const jumping = p.jump > 0;
  const cel = p.celly, ct = cel ? cel.t : 0, pose = cel ? Celly.pose(p, cel.type, ct) : null;
  let hop = (celebrate && !cel && !p.pinAt ? Math.abs(Math.sin(G.time * 10 + p.slot)) * 14 : 0) + (jumping ? Math.sin((0.55 - p.jump) / 0.55 * Math.PI) * 30 : 0);
  if (pose) hop = pose.hop;

  // ground marks
  if (p.isHuman && !at && G.phase !== 'kick' && G.phase !== 'kickmeter') {
    const pulse = 1 + Math.sin(G.time * 8) * 0.08;
    g.strokeStyle = G.versus && p.ctl === 1 ? '#5ad1ff' : '#ffe14d'; g.lineWidth = 3.5;
    g.beginPath(); g.ellipse(x, y, 22 * pulse, 9 * pulse, 0, 0, 7); g.stroke();
  }
  if (!at) drawXFRing(g, p, x, y);
  { const sw0 = big ? 21 : 17, shg = g.createRadialGradient(x, y, 1, x, y, sw0); shg.addColorStop(0, '#00000070'); shg.addColorStop(0.7, '#00000040'); shg.addColorStop(1, '#00000000');
    g.save(); g.translate(x, y); g.scale(1, 0.36); g.translate(-x, -y); g.fillStyle = shg; g.beginPath(); g.arc(x, y, sw0, 0, 7); g.fill(); g.restore(); }
  // stamina bar under the player you control: only while you're sprinting or getting your wind back, then it fades away
  if (p.isHuman && !at && G.phase === 'live' && p.stamina != null) {
    const st = clamp(p.stamina, 0, 1);
    p.stamA = p.sprinting || st < 0.97 ? 1 : Math.max(0, (p.stamA || 0) - 0.03);
    if (p.stamA > 0) {
      const w = 40, empty = st < 0.08;
      g.save(); g.globalAlpha = p.stamA * (empty ? 0.6 + 0.4 * Math.sin(G.time * 18) : 1);
      g.fillStyle = '#000a'; roundRect(g, x - w / 2 - 2, y + 11, w + 4, 8, 4); g.fill();
      g.fillStyle = st > 0.5 ? '#2fd06b' : st > 0.2 ? '#ffd23f' : '#ff4040'; roundRect(g, x - w / 2, y + 13, Math.max(2, w * st), 4, 2); g.fill();
      g.restore();
    }
  }

  // speed streaks when sprinting
  if (p.sprinting && p.speedNow > 6 && !at) {
    const ang = Math.atan2(p.vy * PY, p.vx * PX), ux = Math.cos(ang), uy = Math.sin(ang);
    g.strokeStyle = '#ffffffaa'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 12, sx0 = x - ux * 26 - uy * off, sy0 = y - 28 - uy * 26 + ux * off * 0.5;
      const len = 16 + ((G.time * 60 + i * 7) % 10);
      g.beginPath(); g.moveTo(sx0, sy0); g.lineTo(sx0 - ux * len, sy0 - uy * len); g.stroke();
    }
  }
  g.save(); g.translate(x, y - hop);
  if (pose) {
    if (pose.rot) { g.translate(0, -32); g.rotate(pose.rot * dir); g.translate(0, 32); } // spin around his belly, not his feet
    if (pose.lie) { g.translate(0, -6); g.rotate(pose.lie * dir); }
    if (pose.sy !== 1) g.scale(1 / Math.sqrt(pose.sy), pose.sy); // squash and stretch
  }
  if (p.down > 0) { g.translate(0, -6); g.rotate(p.downDir * 1.45); }
  else if (p.dive > 0) { g.rotate(dir * 1.0); }
  const spinScale = p.spin > 0 ? Math.cos(p.spin * 20) : 1;
  g.scale(dir * (Math.abs(spinScale) < 0.15 ? 0.15 * Math.sign(spinScale || 1) : spinScale), 1);

  const W = big ? 30 : 24, TH = big ? 24 : 22, HIP = big ? 17 : 18;
  const lean = (p.down > 0 ? 0 : k * 0.18) + (p.engaged ? 0.25 : 0);

  // legs (two segments) + cleats
  const leg = (side, ph) => {
    const s = Math.sin(p.anim + ph) * k, lift = Math.max(0, Math.cos(p.anim + ph)) * k * 5;
    const hx = side * (W * 0.18), hy = -HIP;
    const kx = hx + s * 7 + 2, ky = -HIP * 0.48 - lift * 0.6;
    const fxp = hx + s * 12, fyp = -lift;
    g.strokeStyle = OUT; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fxp, fyp - 2); g.stroke();
    g.strokeStyle = look.pants; g.lineWidth = 7;
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.stroke();
    g.strokeStyle = look.trim; g.lineWidth = 1.6; // pants stripe
    g.beginPath(); g.moveTo(hx - 1.8, hy + 1); g.lineTo(kx - 1.8, ky - 1); g.stroke();
    g.strokeStyle = look.sock; g.lineWidth = 6.5;
    g.beginPath(); g.moveTo(kx, ky); g.lineTo(fxp, fyp - 2); g.stroke();
    g.fillStyle = '#ffffff30'; g.beginPath(); g.arc(kx + 1, ky - 1, 2.2, 0, 7); g.fill(); // knee shine
    const ck = textOn(look.pants) === '#111' ? '#f2f2f2' : '#151515';
    g.fillStyle = ck; g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.ellipse(fxp + 3, fyp - 1, 6, 3.6, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = look.trim === ck ? look.jersey : look.trim; g.fillRect(fxp - 0.5, fyp - 3, 5, 1.6);
    g.fillStyle = '#ffffff40'; g.fillRect(fxp + 1, fyp - 4, 4, 1);
  };
  leg(-1, Math.PI); leg(1, 0);

  g.save(); g.translate(0, -HIP); g.rotate(lean);
  // pants top
  g.fillStyle = look.pants; g.strokeStyle = OUT; g.lineWidth = 2.5;
  roundRect(g, -W * 0.42, -4, W * 0.84, 9, 4); g.fill(); g.stroke();
  // back arm (behind torso)
  const sw = Math.sin(p.anim) * k;
  const arm = (front) => {
    const shx = front ? W * 0.3 : -W * 0.22, shy = -TH + 5;
    let ex, ey, hx, hy;
    const pa = pose && pose.arm ? pose.arm(front, shx, shy) : null;
    if (pa) ({ ex, ey, hx, hy } = pa);
    else if (carrying && front) { ex = shx + 4; ey = shy + 10; hx = shx + 10; hy = shy + 8; }
    else if (p.throwAnim > 0 && front) { const t = p.throwAnim; ex = shx - 6 + (1 - t) * 14; ey = shy - 10; hx = shx - 4 + (1 - t) * 22; hy = shy - 18 + (1 - t) * 10; }
    else if (celebrate || jumping) { ex = shx + (front ? 4 : -4); ey = shy - 11; hx = shx + (front ? 6 : -6); hy = shy - 22; }
    else if (p.stiff > 0 && front) { ex = shx + 9; ey = shy + 1; hx = shx + 19; hy = shy; }
    else if (p.engaged && front) { ex = shx + 8; ey = shy + 4; hx = shx + 15; hy = shy + 2; }
    else { const s = (front ? -sw : sw); ex = shx + s * 7; ey = shy + 9; hx = shx + s * 12 + 2; hy = shy + 16; }
    g.strokeStyle = OUT; g.lineWidth = 9.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(shx, shy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
    g.strokeStyle = look.jersey; g.lineWidth = 6.5;
    g.beginPath(); g.moveTo(shx, shy); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = SKIN[p.face.skin]; g.beginPath(); g.moveTo(ex, ey); g.lineTo(hx, hy); g.stroke();
    g.fillStyle = p.teamGloves ? look.trim : p.gloves || '#f2f2f2'; g.strokeStyle = OUT; g.lineWidth = 2;
    g.beginPath(); g.arc(hx, hy, 3.8, 0, 7); g.fill(); g.stroke();
    return { hx, hy };
  };
  arm(false);
  // torso
  const tg = g.createLinearGradient(-W / 2, 0, W / 2, 0);
  tg.addColorStop(0, shade(look.jersey, -0.18)); tg.addColorStop(0.45, look.jersey); tg.addColorStop(1, shade(look.jersey, -0.08));
  g.fillStyle = tg; g.strokeStyle = OUT; g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(-W * 0.4, -2); g.lineTo(-W * 0.5, -TH + 6); g.quadraticCurveTo(-W * 0.55, -TH - 2, -W * 0.3, -TH - 3);
  g.lineTo(W * 0.3, -TH - 3); g.quadraticCurveTo(W * 0.55, -TH - 2, W * 0.5, -TH + 6); g.lineTo(W * 0.4, -2); g.closePath();
  g.fill(); g.stroke();
  // light from the top left
  g.save(); g.clip(); g.fillStyle = '#ffffff1c'; g.fillRect(-W * 0.55, -TH - 4, W * 0.32, TH + 4); g.restore();
  // shoulder pads under the jersey
  for (const sx0 of [-W * 0.4, W * 0.4]) {
    const pg = g.createRadialGradient(sx0 - 1.5, -TH - 2, 1, sx0, -TH + 1, 8);
    pg.addColorStop(0, shade(look.jersey, 0.28)); pg.addColorStop(1, shade(look.jersey, -0.12));
    g.fillStyle = pg; g.strokeStyle = OUT; g.lineWidth = 2.2;
    g.beginPath(); g.ellipse(sx0, -TH + 1, 7.5, 5.5, sx0 < 0 ? -0.35 : 0.35, 0, 7); g.fill(); g.stroke();
  }
  // collar
  g.strokeStyle = look.trim; g.lineWidth = 2.2; g.beginPath(); g.arc(0, -TH - 3, 4.5, 0.15, Math.PI - 0.15); g.stroke();
  // sleeve stripes
  g.strokeStyle = look.trim; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(W * 0.42, -TH + 2); g.lineTo(W * 0.5, -TH + 8); g.stroke();
  g.beginPath(); g.moveTo(-W * 0.42, -TH + 2); g.lineTo(-W * 0.5, -TH + 8); g.stroke();
  // number (un-flipped so it reads right)
  g.save(); g.scale(dir, 1);
  g.font = `900 ${big ? 13 : 12}px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3; g.strokeStyle = shade(look.jersey, -0.55); g.strokeText(p.num, 0, -TH / 2 - 1);
  g.fillStyle = look.num; g.fillText(p.num, 0, -TH / 2 - 1);
  g.restore();
  // front arm + ball
  const hand = arm(true);
  if (carrying) drawFootball(g, hand.hx - 2, hand.hy - 1, 0.95, 0.4);

  // neck + bobble head
  const R = (big ? 19 : 21) * (p.headScale || 1);
  const hx = p.head.ox * dir, hy = -TH - R + 4 + p.head.oy;
  g.fillStyle = SKIN[p.face.skin]; g.strokeStyle = OUT; g.lineWidth = 2;
  g.fillRect(-3, -TH - 6, 6, 6);
  g.save(); g.translate(hx, hy); g.rotate(p.head.rot * dir + (p.down > 0 ? 0 : -lean * 0.4) + (pose ? pose.head : 0));
  drawHead(g, R, team, p, look);
  g.restore();
  g.restore(); // torso
  g.restore(); // player

  // dizzy stars
  if (p.down > 0 && p.dizzy > 0) {
    for (let i = 0; i < 3; i++) {
      const a = G.time * 6 + i * 2.1;
      g.fillStyle = '#ffe14d'; starPath(g, x + p.downDir * 30 + Math.cos(a) * 14, y - 23 + Math.sin(a) * 5, 6); g.fill();
    }
  }
  if (cel) Celly.overlay(g, p, x, y, hop);
  // labels
  const headTop = y - hop - (big ? 85 : 92);
  if (at || G.phase === 'kick' || G.phase === 'kickmeter') return;
  if (p.xf && p.xf.on && p.down <= 0) { drawXFBadge(g, p, x, headTop - (p.isHuman || carrying ? 44 : 4)); }
  const showName = !p.celly && (p.isHuman || carrying || p.cap || (G.phase === 'presnap' && p.off && p.slot <= 4 && p.side === G.human));
  let ly = headTop;
  if (showName && p.down <= 0) {
    g.font = 'bold 13px Barlow, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = (p.isHuman || carrying) ? `${p.name}` : lastName(p.name);
    const w = g.measureText(label).width + 14;
    g.fillStyle = p.isHuman ? (G.versus && p.ctl === 1 ? '#5ad1ff' : '#ffe14d') : '#000000c0'; roundRect(g, x - w / 2, ly - 10, w, 20, 10); g.fill();
    if (p.cap) { g.strokeStyle = '#f6c31c'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = p.isHuman ? '#111' : '#fff'; g.fillText(label, x, ly + 1);
    if (p.isHuman || carrying) { g.font = 'bold 10px Barlow, Arial, sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; const r = `${p.pos} • ${p.ovr} OVR`; g.strokeText(r, x, ly - 17); g.fillText(r, x, ly - 17); }
    ly -= 30;
  }
  if (p.hot && G.phase === 'presnap') {
    g.font = 'bold 11px Barlow, Arial, sans-serif'; g.textAlign = 'center'; const w = g.measureText(p.hot).width + 12;
    g.fillStyle = '#ffe14d'; roundRect(g, x - w / 2, ly - 8, w, 16, 8); g.fill(); g.fillStyle = '#111'; g.fillText(p.hot, x, ly + 4); ly -= 22;
  }
  if (p.throwKey) {
    const col = ['#2f7bff', '#ff3b3b', '#2fd06b', '#ffb02e'][p.throwKey - 1];
    const tgt = G.aim && G.aim.target === p;
    const r = tgt ? 17 : 14;
    g.fillStyle = col; g.strokeStyle = tgt ? '#ffe14d' : '#fff'; g.lineWidth = tgt ? 4 : 2.5;
    g.beginPath(); g.arc(x, ly, r, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = '900 16px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (G.mode === 'mobile') { g.beginPath(); g.moveTo(x, ly - 7); g.lineTo(x + 7, ly + 6); g.lineTo(x - 7, ly + 6); g.closePath(); g.fill(); }
    else g.fillText(p.throwKey, x, ly + 1);
    if (p.openness != null) {
      const o = clamp(p.openness / 5, 0.12, 1);
      g.fillStyle = '#000a'; g.fillRect(x - 16, ly + r + 3, 32, 6);
      g.fillStyle = p.openness > 3 ? '#2fd06b' : p.openness > 1.6 ? '#ffd23f' : '#ff4040';
      g.fillRect(x - 15, ly + r + 4, 30 * o, 4);
    }
  }
}

function drawHead(g, R, team, p, look) {
  const face = p.face;
  // helmet shell with shine
  const hg = g.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.15, 0, 0, R * 1.05);
  hg.addColorStop(0, shade(look.helmet, 0.45)); hg.addColorStop(0.45, look.helmet); hg.addColorStop(1, shade(look.helmet, -0.35));
  g.fillStyle = hg; g.strokeStyle = OUT; g.lineWidth = 3;
  g.beginPath(); g.ellipse(-R * 0.05, 0, R * 1.04, R, 0, 0, 7); g.fill(); g.stroke();
  // stripe front-to-back over the top
  g.save(); g.beginPath(); g.ellipse(-R * 0.05, 0, R * 1.04, R, 0, 0, 7); g.clip();
  g.strokeStyle = look.stripe; g.lineWidth = R * 0.32;
  g.beginPath(); g.ellipse(-R * 0.1, R * 0.15, R * 0.98, R * 1.02, 0, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
  g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(-R * 0.1, R * 0.15, R * 0.8, R * 0.84, 0, Math.PI * 1.08, Math.PI * 1.72); g.stroke();
  g.restore();
  // side decal: jersey number
  g.save(); g.scale(face.dir, 1);
  g.font = `900 ${Math.round(R * 0.62)}px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3; g.strokeStyle = shade(look.helmet, -0.6); g.fillStyle = look.stripe === look.helmet ? '#fff' : look.stripe;
  const dx = -R * 0.38 * face.dir;
  g.strokeText(p.num, dx, -R * 0.08); g.fillText(p.num, dx, -R * 0.08);
  g.restore();
  // gloss
  g.save(); g.translate(-R * 0.42, -R * 0.52); g.rotate(-0.6);
  const gl = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.32); gl.addColorStop(0, '#ffffffb0'); gl.addColorStop(1, '#ffffff00');
  g.fillStyle = gl; g.beginPath(); g.ellipse(0, 0, R * 0.34, R * 0.16, 0, 0, 7); g.fill(); g.restore();
  // bottom rim of the shell
  g.save(); g.beginPath(); g.ellipse(-R * 0.05, 0, R * 1.04, R, 0, 0, 7); g.clip();
  g.strokeStyle = shade(look.helmet, -0.45); g.lineWidth = R * 0.12; g.beginPath(); g.ellipse(-R * 0.05, R * 0.06, R * 1.02, R * 0.98, 0, Math.PI * 0.15, Math.PI * 0.7); g.stroke(); g.restore();
  // ear hole
  g.fillStyle = shade(look.helmet, -0.55); g.beginPath(); g.arc(-R * 0.18, R * 0.22, R * 0.13, 0, 7); g.fill();
  // face opening
  const fx = R * 0.36, fy = R * 0.16;
  g.fillStyle = SKIN[face.skin]; g.strokeStyle = OUT; g.lineWidth = 2;
  g.beginPath(); g.ellipse(fx, fy, R * 0.6, R * 0.66, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#ffffff22'; g.beginPath(); g.ellipse(fx - R * 0.12, fy - R * 0.25, R * 0.25, R * 0.15, 0, 0, 7); g.fill();
  // eyes
  const mood = p.mouth === 'O' ? 'shock' : p.celebrate > 0 ? 'happy' : (p.engaged || !p.off) ? 'mad' : 'focus';
  const ey = fy - R * 0.14, e1 = fx - R * 0.1, e2 = fx + R * 0.3;
  if (face.visor) {
    g.fillStyle = '#1a1f2bdd'; roundRect(g, fx - R * 0.36, ey - R * 0.2, R * 0.78, R * 0.34, R * 0.12); g.fill();
    g.fillStyle = '#ffffff55'; g.fillRect(fx - R * 0.25, ey - R * 0.14, R * 0.2, R * 0.06);
  } else {
    for (const ex of [e1, e2]) {
      g.fillStyle = '#fff'; g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.ellipse(ex, ey, R * 0.16, mood === 'shock' ? R * 0.22 : R * 0.19, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.arc(ex + R * 0.05, ey + R * 0.01, R * 0.09, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + R * 0.08, ey - R * 0.04, R * 0.035, 0, 7); g.fill();
    }
    // eyebrows
    g.strokeStyle = '#1d120a'; g.lineWidth = 2.6; g.lineCap = 'round';
    const tilt = mood === 'mad' ? 0.08 : mood === 'shock' ? -0.1 : mood === 'happy' ? -0.05 : 0.03;
    g.beginPath(); g.moveTo(e1 - R * 0.12, ey - R * (0.22 - tilt)); g.lineTo(e1 + R * 0.1, ey - R * (0.22 + tilt));
    g.moveTo(e2 - R * 0.1, ey - R * (0.22 + tilt)); g.lineTo(e2 + R * 0.12, ey - R * (0.22 - tilt)); g.stroke();
  }
  // eye black
  g.fillStyle = '#111'; g.fillRect(e1 - R * 0.1, ey + R * 0.17, R * 0.18, R * 0.06); g.fillRect(e2 - R * 0.08, ey + R * 0.17, R * 0.18, R * 0.06);
  // mouth
  const my = fy + R * 0.34, mx = fx + R * 0.12;
  g.strokeStyle = '#3a130a'; g.lineWidth = 2.2; g.fillStyle = '#5a1a10';
  if (mood === 'shock') { g.beginPath(); g.ellipse(mx, my, R * 0.1, R * 0.13, 0, 0, 7); g.fill(); }
  else if (mood === 'happy') { g.beginPath(); g.arc(mx, my - R * 0.05, R * 0.17, 0.1, Math.PI - 0.1); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(mx - R * 0.12, my - R * 0.04, R * 0.24, R * 0.05); }
  else if (mood === 'mad') { g.fillStyle = '#fff'; roundRect(g, mx - R * 0.15, my - R * 0.05, R * 0.3, R * 0.11, 2); g.fill(); g.stroke(); }
  else { g.beginPath(); g.moveTo(mx - R * 0.13, my); g.quadraticCurveTo(mx, my + R * 0.06, mx + R * 0.13, my - R * 0.02); g.stroke(); }
  if (face.beard) { g.fillStyle = '#2a1a10cc'; g.beginPath(); g.ellipse(mx, my + R * 0.16, R * 0.25, R * 0.11, 0, 0, Math.PI); g.fill(); }
  // facemask cage
  const mc = look.mask || '#c8c8c8';
  for (const [col, w] of [[OUT, 3.6], [mc, 2]]) {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-R * 0.05, fy + R * 0.12); g.quadraticCurveTo(fx + R * 0.4, fy + R * 0.12, fx + R * 0.66, fy + R * 0.08);
    g.moveTo(-R * 0.02, fy + R * 0.44); g.quadraticCurveTo(fx + R * 0.35, fy + R * 0.5, fx + R * 0.6, fy + R * 0.42);
    g.moveTo(fx + R * 0.64, fy + R * 0.06); g.lineTo(fx + R * 0.58, fy + R * 0.6);
    g.moveTo(fx + R * 0.2, fy + R * 0.13); g.lineTo(fx + R * 0.17, fy + R * 0.48); // center bar
    g.stroke();
  }
  // where the cage bolts on
  g.fillStyle = mc; g.strokeStyle = OUT; g.lineWidth = 1.2;
  for (const by of [fy + R * 0.12, fy + R * 0.44]) { g.beginPath(); g.arc(-R * 0.03, by, R * 0.07, 0, 7); g.fill(); g.stroke(); }
  // chin strap
  g.strokeStyle = '#ffffffcc'; g.lineWidth = 2; g.beginPath(); g.moveTo(-R * 0.05, R * 0.55); g.lineTo(fx - R * 0.1, fy + R * 0.58); g.stroke();
}

function drawFootball(g, x, y, s = 1, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const bg = g.createLinearGradient(0, -6, 0, 6); bg.addColorStop(0, '#9a5523'); bg.addColorStop(1, '#5b2c0e');
  g.fillStyle = bg; g.strokeStyle = OUT; g.lineWidth = 1.8;
  g.beginPath(); g.ellipse(0, 0, 9, 5.6, 0, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(-3.5, -1); g.lineTo(3.5, -1);
  for (let i = -2; i <= 2; i += 2) { g.moveTo(i, -2.6); g.lineTo(i, 0.6); }
  g.stroke(); g.restore();
}

function drawSpiral(g, x, y, ang, phase, s) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  const bg = g.createLinearGradient(0, -6, 0, 6); bg.addColorStop(0, '#a65d27'); bg.addColorStop(1, '#5b2c0e');
  g.fillStyle = bg; g.strokeStyle = OUT; g.lineWidth = 1.8;
  g.beginPath(); g.ellipse(0, 0, 9.5, 5.2, 0, 0, 7); g.fill(); g.stroke();
  // laces roll around the ball = spiral
  const ly = Math.sin(phase) * 3.4, vis = Math.cos(phase);
  if (vis > -0.2) {
    g.globalAlpha = clamp(vis + 0.3, 0, 1);
    g.strokeStyle = '#fff'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-3.5, ly); g.lineTo(3.5, ly);
    for (let i = -2; i <= 2; i += 2) { g.moveTo(i, ly - 1.4); g.lineTo(i, ly + 1.4); }
    g.stroke(); g.globalAlpha = 1;
  }
  // white stripes near the tips
  g.strokeStyle = '#ffffffaa'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-6.5, -3.4); g.lineTo(-6.5, 3.4); g.moveTo(6.5, -3.4); g.lineTo(6.5, 3.4); g.stroke();
  // spin blur
  g.strokeStyle = '#ffffff30'; g.lineWidth = 2; g.beginPath(); g.ellipse(-12, 0, 4, 2, 0, 0, 7); g.stroke();
  g.restore();
}
function drawBallFree(g, G) {
  const b = G.ball; if (!b || b.holder) return;
  const x = sx(b.x), y = sy(b.y);
  g.fillStyle = '#0006'; g.beginPath(); g.ellipse(x, y, 8, 3.5, 0, 0, 7); g.fill();
  if (b.flight) { // trail
    g.strokeStyle = '#ffffff40'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i < 6; i++) { const u = Math.max(0, b.flight.t / b.flight.T - i * 0.03); const tx = lerp(b.flight.sx, b.flight.tx, u), ty = lerp(b.flight.sy, b.flight.ty, u), tz = 1.7 + b.flight.peak * 4 * u * (1 - u) - u * 0.6; const px = sx(tx), py = sy(ty) - tz * PX * 0.9; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  }
  if (b.flight && b.flight.duck && !b.flight.kick) drawFootball(g, x, y - b.z * PX * 0.9, 1.3, Math.sin(G.time * 9) * 0.9 + G.time * 2); // wobbly duck
  else if (b.flight) {
    const f = b.flight, u = Math.min(1, f.t / f.T);
    const dz = (f.peak * 4 * (1 - 2 * u) - 0.6) / f.T;            // height change per second
    const vxs = (f.tx - f.sx) / f.T * PX, vys = (f.ty - f.sy) / f.T * PY - dz * PX * 0.9;
    drawSpiral(g, x, y - b.z * PX * 0.9, Math.atan2(vys, vxs), b.spin || 0, 1.35);
  } else drawFootball(g, x, y - b.z * PX * 0.9, 1.3, b.spin || 0);
  if (b.flight && G.showTarget && !b.flight.pitch) {
    const tx = sx(b.flight.tx), ty = sy(b.flight.ty), pulse = 1 + Math.sin(G.time * 12) * 0.1;
    g.strokeStyle = '#ffe14d'; g.lineWidth = 3; g.setLineDash([5, 5]);
    g.beginPath(); g.ellipse(tx, ty, 18 * pulse, 8 * pulse, 0, 0, 7); g.stroke(); g.setLineDash([]);
  }
}

// drag-back throw aim
function drawAim(g, G) {
  const a = G.aim; if (!a || !G.O) return;
  const qb = G.O[0];
  if (a.run) {
    const d = dirOf(G.poss), x0 = sx(qb.x), y0 = sy(qb.y) - 20, x1 = sx(qb.x + d * 7), y1 = y0;
    g.strokeStyle = '#7fd3ff'; g.fillStyle = '#7fd3ff'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.beginPath(); g.moveTo(x1 + d * 16, y1); g.lineTo(x1 - d * 4, y1 - 14); g.lineTo(x1 - d * 4, y1 + 14); g.fill();
    g.font = '900 22px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#000';
    g.strokeText('QB RUN', (x0 + x1) / 2, y0 - 22); g.fillText('QB RUN', (x0 + x1) / 2, y0 - 22);
    if (a.from) { g.strokeStyle = '#ffffff66'; g.lineWidth = 3; g.beginPath(); g.moveTo(a.from.x, a.from.y); g.lineTo(a.to.x, a.to.y); g.stroke(); }
    return;
  }
  const reach = qbArm(qb).range, want = Math.hypot(a.tx - qb.x, a.ty - qb.y), far = want > reach;
  const k = far ? reach / want : 1, ax = qb.x + (a.tx - qb.x) * k, ay = qb.y + (a.ty - qb.y) * k;
  const x0 = sx(qb.x), y0 = sy(qb.y) - 50, x1 = sx(ax), y1 = sy(ay);
  const len = Math.min(want, reach), peak = 0.6 + len * 0.1;
  g.strokeStyle = far ? '#ff6a5a' : a.target ? '#ffe14d' : '#ffffffaa'; g.lineWidth = 4; g.setLineDash([2, 10]); g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= 24; i++) { const u = i / 24; const px = lerp(x0, x1, u), py = lerp(y0, y1, u) - peak * 4 * u * (1 - u) * PX * 0.9; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke(); g.setLineDash([]);
  g.fillStyle = far ? '#ff6a5a44' : a.target ? '#ffe14d55' : '#ffffff33'; g.strokeStyle = far ? '#ff6a5a' : a.target ? '#ffe14d' : '#fff'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(x1, y1, 22, 10, 0, 0, 7); g.fill(); g.stroke();
  if (far) { g.font = '900 15px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText('MAX RANGE', x1, y1 - 18); g.fillStyle = '#ff6a5a'; g.fillText('MAX RANGE', x1, y1 - 18); }
  if (a.style && a.style !== 'normal') { g.font = '900 14px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#7fd3ff'; g.fillText(a.style.toUpperCase(), x1, y1 - 16); }
  // pull-back line from the finger
  if (a.from) { g.strokeStyle = '#ffffff66'; g.lineWidth = 3; g.beginPath(); g.moveTo(a.from.x, a.from.y); g.lineTo(a.to.x, a.to.y); g.stroke(); g.fillStyle = '#fff8'; g.beginPath(); g.arc(a.from.x, a.from.y, 10, 0, 7); g.fill(); }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---- particles & floating text ----
function drawFx(g, G) {
  for (const f of G.fx) {
    const a = clamp(f.life / f.max, 0, 1);
    if (f.kind === 'dust') { g.fillStyle = `rgba(225,215,180,${a * 0.6})`; g.beginPath(); g.arc(sx(f.x), sy(f.y) - f.z, f.r * (2 - a), 0, 7); g.fill(); }
    else if (f.kind === 'star') { g.fillStyle = `rgba(255,225,70,${a})`; starPath(g, sx(f.x), sy(f.y) - f.z - 7, 9); g.fill(); }
    else if (f.kind === 'flag') {
      const u = Math.min(1, f.t / f.T);
      const fx = sx(lerp(f.ax, f.x, u)), fy = sy(lerp(f.ay, f.y, u)) - Math.sin(u * Math.PI) * 70;
      g.save(); g.translate(fx, fy); g.rotate(u < 1 ? f.t * 14 : 0.3);
      g.fillStyle = '#ffd400'; g.strokeStyle = '#7a5d00'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-9, -5); g.quadraticCurveTo(0, -9, 9, -4); g.lineTo(8, 5); g.quadraticCurveTo(0, 8, -8, 5); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-6, -3, 2.2, 0, 7); g.fill();
      g.restore();
    }
    else if (f.kind === 'ring') { g.strokeStyle = f.color || '#fff'; g.globalAlpha = a; g.lineWidth = 4 * a + 1; g.beginPath(); g.ellipse(sx(f.x), sy(f.y), 10 + (1 - a) * 60, 4 + (1 - a) * 22, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
    else if (f.kind === 'zzz') { g.globalAlpha = a; g.fillStyle = '#cfe3ff'; g.font = `italic 900 ${16 + (1 - a) * 14}px "Barlow Condensed", Arial, sans-serif`; g.textAlign = 'center'; g.fillText('Z', sx(f.x) + (1 - a) * 18 * (f.dx || 1), sy(f.y) - f.z - 20); g.globalAlpha = 1; }
    else if (f.kind === 'confetti') { g.fillStyle = f.color; g.globalAlpha = a; g.fillRect(f.px, f.py, 6, 9); g.globalAlpha = 1; }
    else if (f.kind === 'text') {
      const pop = Math.min(1, (f.max - f.life) * 8);
      g.save(); g.translate(sx(f.x), sy(f.y) - 60 - f.z); g.scale(0.5 + pop * 0.5, 0.5 + pop * 0.5);
      g.font = `900 ${f.size || 20}px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = a; g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText(f.text, 0, 0); g.fillStyle = f.color || '#fff'; g.fillText(f.text, 0, 0);
      g.restore(); g.globalAlpha = 1;
    }
  }
}

function drawBanner(g, G) {
  const b = G.banner; if (!b) return;
  const t = b.t, pop = t < 0.18 ? 0.3 + (t / 0.18) * 0.9 : 1.2 - Math.min(0.2, (t - 0.18) * 1.2);
  const fade = Math.min(1, (b.dur - t) * 4);
  g.save(); g.globalAlpha = fade; g.translate(CW / 2, CH / 2 - 70); g.scale(pop, pop); g.rotate(-0.03);
  g.font = 'italic 900 100px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 16; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.strokeText(b.text, 0, 0);
  const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, b.color || '#ffd23f'); gr.addColorStop(1, shade(b.color || '#ffd23f', -0.3));
  g.fillStyle = gr; g.fillText(b.text, 0, 0);
  if (b.sub) { g.font = 'bold 28px Barlow, Arial, sans-serif'; g.lineWidth = 7; g.strokeText(b.sub, 0, 64); g.fillStyle = '#fff'; g.fillText(b.sub, 0, 64); }
  g.restore();
}

function ordinal(n) { return ['1st', '2nd', '3rd', '4th'][n - 1] || n + 'th'; }

function drawHUD(g, G) {
  const W = 640, x0 = (CW - W) / 2, y0 = 6, H = 46;
  g.fillStyle = '#0b0f16f0'; roundRect(g, x0, y0, W, H, 3); g.fill();
  const cell = (t, s, x, poss) => {
    const cg = g.createLinearGradient(x, 0, x + 200, 0); cg.addColorStop(0, t.c1); cg.addColorStop(1, shade(t.c1, -0.3));
    g.fillStyle = cg; roundRect(g, x, y0 + 4, 200, H - 8, 2); g.fill();
    g.fillStyle = t.c2; g.fillRect(x, y0 + H - 8, 200, 4);
    // team name sits high so the timeout bars underneath get their own space
    const ny = y0 + 18;
    g.fillStyle = textOn(t.c1); g.font = 'italic 900 23px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(t.id, x + 10, ny);
    if (G.versus) { const tg = G.online ? (G.teams.indexOf(t) === G.human ? 'YOU' : 'OPP') : G.teams.indexOf(t) === G.p1 ? 'P1' : 'P2'; g.font = '800 12px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = tg === 'P1' || tg === 'YOU' ? '#ffe14d' : '#5ad1ff'; g.fillText(tg, x + 10, y0 + 9); g.font = 'italic 900 23px "Barlow Condensed", "Arial Black", sans-serif'; g.fillStyle = textOn(t.c1); }
    if (poss) drawFootball(g, x + 10 + g.measureText(t.id).width + 16, ny, 0.9);
    g.font = 'italic 900 36px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'right'; g.fillText(s, x + 192, y0 + H / 2 + 1);
    const side = G.teams.indexOf(t);
    if (G.timeouts) for (let i = 0; i < 3; i++) {
      const tx = x + 10 + i * 20, ty = y0 + H - 16;
      g.fillStyle = '#00000059'; g.fillRect(tx - 1, ty - 1, 16, 6);
      g.fillStyle = i < G.timeouts[side] ? '#ffd23f' : '#ffffff38'; g.fillRect(tx, ty, 14, 4);
    }
  };
  cell(G.teams[1], G.score[1], x0 + 5, G.poss === 1);
  cell(G.teams[0], G.score[0], x0 + 210, G.poss === 0);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 21px "Barlow Condensed", Arial, sans-serif';
  const q = G.quarter > 4 ? 'OT' : ordinal(G.quarter);
  const c = Math.max(0, Math.ceil(G.clock)), m = Math.floor(c / 60), s = String(c % 60).padStart(2, '0');
  g.fillText(`${q}   ${m}:${s}`, x0 + W - 112, y0 + 16);
  g.font = '800 15px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#ffd23f';
  g.fillText(G.downText(), x0 + W - 112, y0 + 35);

  // play clock
  if (G.playClock > 0 && (G.phase === 'playcall' || G.phase === 'presnap')) {
    const pc = Math.ceil(G.playClock), red = pc <= 5;
    g.fillStyle = red ? '#c0141ccc' : '#0b0f16e0'; roundRect(g, CW / 2 - 36, y0 + H + 4, 72, 26, 2); g.fill();
    g.fillStyle = red ? '#fff' : '#ffd23f'; g.font = '900 15px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center';
    g.fillText(`:${String(pc).padStart(2, '0')}`, CW / 2, y0 + H + 22);
  }
  // your play
  if (G.play && (G.phase === 'presnap' || G.phase === 'live') && !G.demo && (!G.versus || G.online)) {
    const mine = G.poss === G.human ? G.play.off : G.play.def;
    const t = mine.name.toUpperCase();
    g.font = 'bold 14px Barlow, Arial, sans-serif'; const w = g.measureText(t).width + 22;
    g.fillStyle = '#0b0f16d0'; roundRect(g, 10, 10, w, 28, 2); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(t, 21, 29);
  }
  // hint + stamina
  if (G.hint) {
    g.font = 'bold 14px Barlow, Arial, sans-serif'; const w = g.measureText(G.hint).width + 24;
    g.fillStyle = '#000000a0'; roundRect(g, CW / 2 - w / 2, CH - 34, w, 26, 2); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(G.hint, CW / 2, CH - 20);
  }
  const h = G.humanPlayer;
  if (h && G.phase === 'live' && G.mode !== 'mobile') {
    g.fillStyle = '#000a'; roundRect(g, 14, CH - 34, 132, 16, 8); g.fill();
    g.fillStyle = h.stamina > 0.3 ? '#2fd06b' : '#ff6040'; roundRect(g, 17, CH - 31, 126 * h.stamina, 10, 5); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 10px Barlow, Arial, sans-serif'; g.textAlign = 'left'; g.fillText('SPRINT', 152, CH - 25);
  }
}

// ---------- referees ----------
function drawRef(g, r, G) {
  const x = sx(r.x), y = sy(r.y);
  if (x < -60 || x > CW + 60) return;
  g.fillStyle = '#00000055'; g.beginPath(); g.ellipse(x, y, 13, 5, 0, 0, 7); g.fill();
  g.save(); g.translate(x, y); g.scale(r.face || 1, 1);
  const k = Math.min(1, (r.moving || 0) / 4), s1 = Math.sin(r.anim) * k;
  // legs (white knickers, black socks)
  for (const [side, ph] of [[-1, s1], [1, -s1]]) {
    g.strokeStyle = OUT; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(side * 4, -16); g.lineTo(side * 4 + ph * 9, -1); g.stroke();
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 5.5; g.beginPath(); g.moveTo(side * 4, -16); g.lineTo(side * 4 + ph * 5, -8); g.stroke();
    g.strokeStyle = '#111'; g.beginPath(); g.moveTo(side * 4 + ph * 5, -8); g.lineTo(side * 4 + ph * 9, -1); g.stroke();
  }
  // striped shirt
  g.save(); roundRect(g, -10, -38, 20, 23, 5); g.clip();
  g.fillStyle = '#fff'; g.fillRect(-10, -38, 20, 23);
  g.fillStyle = '#111'; for (let i = -10; i < 10; i += 5) g.fillRect(i, -38, 2.5, 23);
  g.restore();
  g.strokeStyle = OUT; g.lineWidth = 2.2; roundRect(g, -10, -38, 20, 23, 5); g.stroke();
  // arms (one up when throwing a flag)
  g.strokeStyle = OUT; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-8, -34); g.lineTo(-12, -22); g.stroke();
  g.beginPath(); g.moveTo(8, -34); r.throwT > 0 ? g.lineTo(14, -52) : g.lineTo(12, -22); g.stroke();
  // head: cap + face
  const R = 15;
  g.fillStyle = SKIN[1]; g.strokeStyle = OUT; g.lineWidth = 2.2;
  g.beginPath(); g.arc(1, -52, R, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#111'; g.beginPath(); g.arc(1, -54, R, Math.PI * 1.02, Math.PI * 1.98); g.fill();
  g.fillRect(6, -57, 14, 4);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(6, -50, 3.3, 0, 7); g.arc(13, -50, 3.3, 0, 7); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(7, -50, 1.7, 0, 7); g.arc(14, -50, 1.7, 0, 7); g.fill();
  g.strokeStyle = '#3a130a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(6, -43); g.lineTo(13, -43); g.stroke();
  // whistle
  g.fillStyle = '#ccc'; g.fillRect(12, -44, 5, 3);
  g.restore();
}

// ---------- field goal / punt meter (simple: power bar, then aim slider) ----------
function drawKickMeter(g, G) {
  const km = G.km; if (!km || G.phase !== 'kickmeter' || !isHumanSide(km.side) || km.cpuT != null) return;
  const W = 560, H = 176, x0 = (CW - W) / 2, y0 = CH - H - 40;
  const fg = km.kind === 'fg' || km.kind === 'xp', st = km.stage;
  g.fillStyle = '#0b0f16f0'; g.fillRect(x0, y0, W, H);
  g.fillStyle = '#f6c31c'; g.fillRect(x0, y0, 6, H);
  g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = 'italic 900 26px "Barlow Condensed", "Arial Black", sans-serif';
  const title = km.kind === 'punt' ? 'PUNT' : km.kind === 'ko' ? 'KICKOFF' : km.kind === 'onside' ? 'ONSIDE KICK' : km.kind === 'xp' ? 'EXTRA POINT' : `${km.yds}-YARD FIELD GOAL`;
  g.fillText(title, x0 + 22, y0 + 32);
  g.fillStyle = '#9aa6b5'; g.font = '600 13px Barlow, Arial, sans-serif'; g.textAlign = 'right';
  g.fillText(`${km.kk.name}  ·  ${km.kk.ovr} OVR`, x0 + W - 20, y0 + 30);
  const bx = x0 + 96, bw = W - 118, bh = 26;
  const label = (y, t, on) => { g.textAlign = 'left'; g.fillStyle = on ? '#fff' : '#6c7684'; g.font = '800 15px "Barlow Condensed", Arial, sans-serif'; g.fillText(t, x0 + 22, y + 18); g.fillStyle = '#1a212c'; g.fillRect(bx, y, bw, bh); };
  // 1) power
  const py = y0 + 56;
  label(py, '1  POWER', st === 0);
  const pg = g.createLinearGradient(bx, 0, bx + bw, 0); pg.addColorStop(0, '#1f8f4c'); pg.addColorStop(0.7, '#f6c31c'); pg.addColorStop(1, '#e8401c');
  g.fillStyle = pg; g.fillRect(bx, py, bw * clamp(km.power, 0, 1), bh);
  if (fg) {
    const nx = bx + bw * Math.min(1, km.need);
    g.fillStyle = km.need > 1 ? '#e8401c' : '#fff'; g.fillRect(nx - 1.5, py - 5, 3, bh + 10);
    g.font = '800 11px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.fillText(km.need > 1 ? 'OUT OF RANGE' : 'NEED', Math.min(nx, bx + bw - 34), py - 8);
  }
  // 2) aim
  const ay = y0 + 106, cx = bx + bw / 2;
  label(ay, '2  AIM', st === 1);
  const zw = bw / 2 * km.tol;
  g.fillStyle = fg ? '#2fd06bcc' : '#2fd06b66'; g.fillRect(cx - zw, ay, zw * 2, bh);
  g.fillStyle = '#ffffff44'; g.fillRect(cx - 1, ay, 2, bh);
  if (st >= 1) {
    const sx = cx + clamp(km.aim, -1, 1) * (bw / 2 - 3);
    g.fillStyle = '#fff'; g.fillRect(sx - 3, ay - 6, 6, bh + 12);
  }
  const tap = G.mode === 'mobile' ? 'TAP' : G.online ? 'SPACE' : G.versus && km.side !== G.p1 ? 'ENTER' : 'SPACE';
  g.textAlign = 'center'; g.fillStyle = '#f6c31c'; g.font = 'italic 900 19px "Barlow Condensed", Arial, sans-serif';
  g.fillText(st === 0 ? `${tap} TO SET THE POWER` : st === 1 ? `${tap} WHEN IT'S IN THE GREEN` : '', CW / 2, y0 + H - 14);
}
