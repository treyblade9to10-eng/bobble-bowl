// ---- Rendering: field, bobbleheads, ball, effects, scorebug ----
let CW = 1280; const CH = 720; // CW grows on wide phones so the field fills the screen
const PX = 24;          // pixels per yard (left/right)
const PY = 14;          // pixels per yard (up/down) - squished = tilted camera look
const FIELD_W = 53.33;
const MID_Y = FIELD_W / 2;
const cam = { x: 60, y: FIELD_W / 2, shake: 0, zoom: 1 };
const SKIN = ['#f6d3b3', '#e8b48f', '#c98e62', '#a26a42', '#7a4a2a', '#5a3620'];
const OUT = '#14110f'; // cartoon outline color
let nameTagMode = 'key'; // NAME TAGS setting: 'all' | 'key' (players that matter on this play) | 'off'
const tagBoxes = []; // name tags / throw icons drawn this frame (screen boxes), so floating words can stay off them

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
  const key = G.teams[0].id + G.teams[1].id + (G.demo ? 'd' : '') + (G.bigGame ? 'B' + G.bigGame.year : '') + (typeof Logo !== 'undefined' ? Logo.style() : '') + (G.teams[0].logo ? G.teams[0].logo.length + G.teams[0].logo.slice(-24) : '') + (G.teams[1].logo ? G.teams[1].logo.length : '') + FieldStyle.key(G);
  if (fieldKey === key && fieldCv) return;
  fieldKey = key;
  const W = Math.ceil((120 + FIELD_PAD_X * 2) * PX), H = Math.ceil((FIELD_W + FIELD_PAD_TOP + FIELD_PAD_BOT) * PY);
  fieldCv = document.createElement('canvas'); fieldCv.width = W; fieldCv.height = H;
  const g = fieldCv.getContext('2d', { alpha: false }); // solid picture: copies to the screen faster
  const fx = x => (x + FIELD_PAD_X) * PX, fy = y => (y + FIELD_PAD_TOP) * PY;
  // stands
  const stad = stadiumOf(G.teams[0]);
  // the home team's paint job (the Bobble Bowl keeps its own neutral split look)
  const fs = G.bigGame ? { ...FieldStyle.DEF, surf: stad.turf ? 'turf' : 'grass' } : FieldStyle.of(G.teams[0]), fc = FieldStyle.colors(fs, G.teams[0]), tf = FieldStyle.turf(fs);
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
  g.fillStyle = shade(fc.wall, -0.75); g.fillRect(0, fy(-1.9), W, 0.9 * PY);
  if (stad.dome) { // roof: dark steel with trusses and a ring of lights
    const rf = g.createLinearGradient(0, 0, 0, 22); rf.addColorStop(0, '#05070a'); rf.addColorStop(1, '#05070a00');
    g.fillStyle = rf; g.fillRect(0, 0, W, 22);
    g.fillStyle = '#ffffff14'; for (let x = 0; x < W; x += 90) { g.fillRect(x, 0, 3, 14); g.fillRect(x, 6, 90, 1.5); }
    for (let x = 45; x < W; x += 90) { const lg = g.createRadialGradient(x, 4, 0, x, 4, 16); lg.addColorStop(0, '#fffbe6'); lg.addColorStop(1, '#fffbe600'); g.fillStyle = lg; g.fillRect(x - 16, 0, 32, 20); }
  }
  g.fillStyle = '#ffffff30'; g.font = 'bold 9px Barlow, Arial, sans-serif'; g.textAlign = 'left';
  const wall = `${stad.name.toUpperCase()}  •  ${G.teams[0].city.toUpperCase()}  •  BOBBLE BOWL`;
  for (let x = 0; x < W; x += 300) g.fillText(wall, x + 10, fy(-1.35));
  // apron + grass
  g.fillStyle = tf.apron; g.fillRect(0, fy(-1.2), W, H - fy(-1.2));
  for (let yd = -FIELD_PAD_X; yd < 120 + FIELD_PAD_X; yd += 5) {
    const inField = yd >= 0 && yd < 120;
    g.fillStyle = !inField ? tf.apron : (Math.floor(yd / 5) % 2 === 0) ? tf.a : tf.b;
    g.fillRect(fx(yd), fy(0), 5 * PX + 1, FIELD_W * PY);
  }
  // mowing texture
  g.globalAlpha = tf.mow; g.fillStyle = '#000';
  for (let y = 0; y < FIELD_W; y += 2) g.fillRect(fx(0), fy(y), 120 * PX, PY * 0.5);
  g.globalAlpha = 1;
  // end zones
  for (let s = 0; s < 2; s++) {
    const t = G.teams[G.bigGame ? s : 0], x0 = fx(s === 0 ? 0 : 110); // home team's stadium = both end zones are theirs (the Bobble Bowl splits them)
    FieldStyle.paintEZ(g, t, fs, x0, fy(0), 10 * PX, FIELD_W * PY, s);
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
    for (const ny of [8.5, 44.8]) { g.fillStyle = fc.yard + 'd8'; g.fillText(String(n), fx(yd), fy(ny)); }
  }
  // home team logo painted at midfield
  const ht = G.teams[0];
  if (G.bigGame && g.save) { // Bobble Bowl field: the trophy and the Roman numerals at midfield
    g.save(); g.translate(fx(60), fy(FIELD_W / 2)); g.scale(0.78, 0.78); // real shape, not squished
    g.fillStyle = '#0b0f16c0'; g.beginPath(); g.arc(0, 0, 6.6 * PX, 0, 7); g.fill(); g.strokeStyle = '#d9a933'; g.lineWidth = 6; g.stroke();
    drawTrophy(g, -2.2 * PX, 3.6 * PX, 7.6 * PX);
    g.font = 'italic 900 70px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#d9a933';
    g.fillText(roman(bowlNo(G.bigGame.year)), 2.6 * PX, 0.6 * PX); g.font = '800 22px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#fff'; g.fillText('BOBBLE BOWL', 2.6 * PX, -2.4 * PX);
    g.restore();
  } else if (typeof Logo !== 'undefined' && g.save && fs.mid !== 'none') {
    Logo.draw(g, ht, fx(60), fy(FIELD_W / 2), (fs.mid === 'big' ? 13 : 9) * PX); // real shape, not squished
  }
  // sidelines
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.strokeRect(fx(0), fy(0), 120 * PX, FIELD_W * PY);
  // goal posts: drawn live in the game (drawGoalPosts), only baked in for the field editor pictures
  if (G.preview) for (const [ex, side] of [[0, -1], [120, 1]]) paintPost(g, fx(ex), side, fy, null, ht.c1, 0);
  // stands + a big video board behind each end zone
  for (const side of [-1, 1]) {
    const xa = side < 0 ? 0 : fx(122.6), w = side < 0 ? fx(-2.6) : W - fx(122.6), top = fy(-1.2); // stands start right behind the wall (Lambeau Leap territory)
    g.fillStyle = '#10151d'; g.fillRect(xa, top, w, H - top);
    g.fillStyle = shade(fc.wall, -0.2); g.fillRect(side < 0 ? xa + w - 7 : xa, top, 7, H - top); // padded wall
    for (let yy = top + 6; yy < H; yy += 11) for (let xx = xa + 5; xx < xa + w - 3; xx += 11) { const hh = hashStr(side + ':' + xx + ':' + yy); g.fillStyle = cols[hh % cols.length]; g.beginPath(); g.arc(xx, yy, 4, 0, 7); g.fill(); }
    const bx = side < 0 ? fx(-FIELD_PAD_X + 0.3) : fx(120 + FIELD_PAD_X - 1.9), by = fy(FIELD_W / 2) - 70, bw = 1.6 * PX, bh = 140;
    g.fillStyle = '#05070a'; g.fillRect(bx - 4, by - 4, bw + 8, bh + 8); g.fillStyle = shade(fc.wall, -0.4); g.fillRect(bx, by, bw, bh);
    if (typeof Logo !== 'undefined' && g.save) Logo.draw(g, G.teams[0], bx + bw / 2, by + bh / 2, Math.min(bw, bh) - 6);
  }
  // team benches area
  g.fillStyle = '#ffffff10'; g.fillRect(fx(35), fy(FIELD_W) + 10, 50 * PX, 3 * PY);
  // stands along the near sideline too (wall, then fans)
  const wy0 = fy(FIELD_W + 3.4);
  g.fillStyle = '#10151d'; g.fillRect(0, wy0, W, H - wy0); g.fillStyle = '#1b2433'; g.fillRect(0, wy0, W, 6);
  for (let row = 0; wy0 + 14 + row * 12 < H + 6; row++) for (let i = 0; i < W / 13; i++) {
    const h = hashStr('b' + row + ':' + i); g.fillStyle = cols[h % cols.length];
    g.beginPath(); g.arc(i * 13 + (row % 2) * 6 + 4, wy0 + 18 + row * 12, 4.5, 0, 7); g.fill();
    g.fillStyle = SKIN[(h >> 4) % 6]; g.beginPath(); g.arc(i * 13 + (row % 2) * 6 + 4, wy0 + 12 + row * 12, 3, 0, 7); g.fill();
  }
  // a tile of fans for everything past the edges of the field canvas (celly cam, end zones)
  crowdPat = null; crowdCv = document.createElement('canvas'); crowdCv.width = 156; crowdCv.height = 72;
  const cg = crowdCv.getContext('2d');
  if (cg && cg.fillRect) {
    cg.fillStyle = '#10151d'; cg.fillRect(0, 0, 156, 72);
    for (let row = 0; row < 6; row++) for (let i = 0; i < 12; i++) {
      const h = hashStr('c' + row + ':' + i);
      for (const wrap of [0, -156]) { const x = i * 13 + (row % 2) * 6 + 4 + wrap; // wrap around so the tiles join with no seam
        cg.fillStyle = cols[h % cols.length]; cg.beginPath(); cg.arc(x, 10 + row * 12, 4.5, 0, 7); cg.fill();
        cg.fillStyle = SKIN[(h >> 4) % 6]; cg.beginPath(); cg.arc(x, 4 + row * 12, 3, 0, 7); cg.fill(); }
    }
    cg.fillStyle = 'rgba(5,8,14,0.35)'; cg.fillRect(0, 0, 156, 72); // in the shade of the upper deck
  }
}
let crowdCv = null, crowdPat = null;

// Chromebooks can drop canvas memory (GPU reset, low memory, waking from sleep). When that happens every pre-drawn picture
// comes back blank, so throw them all away and draw them again
function resetGfx() {
  fieldKey = ''; fieldCv = null; crowdCv = null; crowdPat = null;
  if (typeof headCache !== 'undefined') headCache.clear();
  if (typeof torsoCache !== 'undefined') torsoCache.clear();
  for (const k in shadowSprites) delete shadowSprites[k];
  if (typeof Logo !== 'undefined' && Logo.reset) Logo.reset();
  if (typeof wxCv !== 'undefined') { wxCv = null; wxMix = null; nightL = null; skyL = null; }
}
let gfxCheck = 0, fieldBlit = null;
function drawField(g, G) {
  tagBoxes.length = 0;
  if (++gfxCheck % 30 === 0 && fieldCv) { const fg = fieldCv.getContext('2d'); if (fg && fg.isContextLost && fg.isContextLost()) resetGfx(); }
  buildField(G);
  // past the edges of the field = more fans (scrolls with the camera)
  // only needed when the camera can see past the field picture (edges, celly cam) - filling it every frame is slow on Chromebooks
  const zoomed = cam.zoom > 1.001, edge = zoomed || wx(0) < -FIELD_PAD_X || wx(CW) > 120 + FIELD_PAD_X || wy(0) < -FIELD_PAD_TOP || wy(CH) > FIELD_W + FIELD_PAD_BOT;
  if (edge && crowdCv && g.createPattern && !crowdPat) crowdPat = g.createPattern(crowdCv, 'repeat');
  const pat = edge ? crowdPat : null;
  if (pat) { const ox = ((-cam.x * PX) % 156 + 156) % 156, oy = ((-cam.y * PY) % 72 + 72) % 72; g.save(); g.translate(ox - 156, oy - 72); g.fillStyle = pat; g.fillRect(-CW, -CH, CW * 3 + 312, CH * 3 + 144); g.restore(); }
  else if (edge) { g.fillStyle = '#0e1420'; g.fillRect(0, 0, CW, CH); }
  // wet games: the field picture with the snow/mud already on it (weather.js)
  fieldBlit = (typeof wxMixed === 'function' && wxMixed(G)) || fieldCv;
  blitWorld(g, fieldBlit);
  drawGoalPosts(g, G, false);
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
// ---------- goal posts ----------
// drawn every frame (not baked into the field) so a kick can sail between them. Fake 3D seen from the near sideline:
// height goes straight up the screen (same scale as the ball) and depth (y) also slides a bit sideways, so the two
// uprights stand apart and the crossbar is a slanted bar a good kick clearly goes over. The padded base pole stands
// behind the end line and the gooseneck reaches forward to the middle of the crossbar. Whatever is nearer the camera
// (bigger y) than the ball covers it: behind the near upright, in front of the far one
const GPOST = { half: 3.08, bar: 3.33, top: 12, skew: -0.75, deep: 0.6, back: 1.4 }; // yards: 18'6" wide, crossbar 10 ft up, uprights 30 ft above it
const ZPX = PX * 0.9; // screen pixels per yard of height (the ball uses the same)
// the fake 3D near the posts: depth y slides sideways (yards out past the end line; the far side sits further out) and
// gets squished toward the middle (so the crossbar reads as a bar, not a line running down the screen)
const postShift = y => (y - MID_Y) * GPOST.skew, postDeep = y => MID_Y + (y - MID_Y) * GPOST.deep;
// cut = depth (y) of the ball: only draw the parts nearer the camera than that (null = the whole post)
function paintPost(g, bx, side, fy, cut, pad, t) {
  const { half, bar, top, back } = GPOST, M = MID_Y;
  const P = (u, y, z) => [bx + side * (u + postShift(y)) * PX, fy(postDeep(y)) - z * ZPX]; // u = yards behind the end line
  const keep = d => cut == null || d > cut;
  if (cut == null) { // soft shadow on the grass (sun behind the posts, so it falls in toward the field)
    const S = (u, y, z) => P(u - z * 0.45, y + z * 0.1, 0);
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 7; g.beginPath();
    g.moveTo(...S(back, M, 0)); g.lineTo(...S(back, M, bar - 0.9)); g.lineTo(...S(0, M, bar));
    g.moveTo(...S(0, M - half, top)); g.lineTo(...S(0, M - half, bar)); g.lineTo(...S(0, M + half, bar)); g.lineTo(...S(0, M + half, top)); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(...P(back, M, 0), 13, 5, 0, 0, 7); g.fill();
  }
  // tubes: [points, width, butt end]
  const tubes = [], neck = [];
  for (let i = 0; i <= 8; i++) { const a = i / 8, u = back * (1 - a * a), z = bar - 0.9 * (1 - a) * (1 - a); neck.push(P(u, M, z)); } // gooseneck curve
  if (keep(M)) tubes.push([[P(back, M, 1), P(back, M, bar - 0.9), ...neck], 9]);
  if (cut == null) tubes.push([[P(0, M - half, bar), P(0, M + half, bar)], 8]);
  else if (cut < M + half) tubes.push([[P(0, Math.max(cut, M - half), bar), P(0, M + half, bar)], 8, true]); // just the near piece of the crossbar
  for (const y of [M - half, M + half]) if (keep(y)) tubes.push([[P(0, y, bar), P(0, y, top)], 7]);
  const stroke = (pts, w, col, butt, ox = 0, oy = 0) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = butt ? 'butt' : 'round'; g.lineJoin = 'round'; g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy)); g.stroke();
  };
  for (const [pts, w, butt] of tubes) stroke(pts, w + 4, OUT, butt);
  for (const [pts, w, butt] of tubes) stroke(pts, w, '#f7c600', butt);
  for (const [pts, w, butt] of tubes) stroke(pts, w * 0.35, '#c99400', butt, w * 0.28, w * 0.1); // shade on the right
  for (const [pts, w, butt] of tubes) stroke(pts, w * 0.28, '#fff08a', butt, -w * 0.22, -w * 0.12); // shine on the left
  if (keep(M)) { // padding around the bottom of the pole
    const [px, py] = P(back, M, 0), ph = 2.1 * ZPX;
    g.fillStyle = OUT; g.beginPath(); g.roundRect ? g.roundRect(px - 9, py - ph - 2, 18, ph + 4, 5) : g.rect(px - 9, py - ph - 2, 18, ph + 4); g.fill();
    g.fillStyle = pad || '#1d3557'; g.fillRect(px - 7, py - ph, 14, ph);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(px - 5, py - ph + 2, 3, ph - 4);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px + 3, py - ph, 4, ph);
  }
  // wind ribbons on top of the uprights
  const wd = (typeof G !== 'undefined' && G && G.wind && G.wind.mph > 3 ? G.wind.dir : 1) * side, flap = t || 0;
  for (const y of [M - half, M + half]) if (keep(y)) {
    const [px, py] = P(0, y, top), pts = [];
    for (let i = 0; i <= 5; i++) pts.push([px + wd * i * 5, py - 2 + i * 1.5 + Math.sin(flap * 9 - i * 1.2 + y) * i * 0.8]);
    stroke(pts, 6, OUT, false); stroke(pts, 3.5, '#ff5a1f', false);
  }
}
// over = after the ball: redraw the bits of the post that are in front of a ball flying through it
function drawGoalPosts(g, G, over) {
  const b = G.ball, pad = G.teams && G.teams[0].c1;
  for (const [ex, side] of [[0, -1], [120, 1]]) {
    const bx = sx(ex); if (bx < -150 || bx > CW + 150) continue;
    if (!over) paintPost(g, bx, side, sy, null, pad, G.time);
    else if (b && !b.holder && !b.hold && b.z > 0.15 && Math.abs(b.x - ex) < 4) paintPost(g, bx, side, sy, b.y, pad, G.time);
  }
}
// a field goal / extra point gets the same fake 3D as the posts it's flying at (so it lines up with them), eased in
// over the last stretch before the end line. Returns the screen [x, y] shift for the ball and its shadow
function kickLean(G, b) {
  const k = G.phase === 'kick' && (G.kick || G.km);
  if (!k || (k.kind !== 'fg' && k.kind !== 'xp')) return [0, 0];
  const d = dirOf(k.side), ex = d > 0 ? 120 : 0, a = clamp(1 - (d * (ex - b.x) - 1) / 14, 0, 1), e = a * a * (3 - 2 * a); // 0 far out, 1 at the end line and past it
  return [d * postShift(b.y) * e * PX, (postDeep(b.y) - b.y) * e * PY];
}

// draw a canvas laid out like the field canvas (same padding + scale) under the current camera
function blitWorld(g, cv) {
  // draw a bit past the screen edges too, so the zoomed celly cam never runs off the painted area
  const z = cam.zoom > 1.001, mx = z ? CW * 0.75 : 40, my = z ? CH * 0.75 : 40; // 40px covers screen shake
  let srcX = (wx(-mx) + FIELD_PAD_X) * PX, srcY = (wy(-my) + FIELD_PAD_TOP) * PY;
  let dx = -mx, dy = -my, w = CW + mx * 2, h = CH + my * 2;
  if (srcX < 0) { dx -= srcX; w += srcX; srcX = 0; }
  if (srcY < 0) { dy -= srcY; h += srcY; srcY = 0; }
  w = Math.min(w, cv.width - srcX); h = Math.min(h, cv.height - srcY);
  if (w > 0 && h > 0) g.drawImage(cv, srcX, srcY, w, h, dx, dy, w, h);
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
  if (!h || !h.assign || coachOn() || !(G.phase === 'presnap' || (G.phase === 'live' && G.bstate === 'snap'))) return;
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
const UNIFORMS = [['home', 'Home'], ['away', 'Away'], ['rush', 'Color Rush'], ['throwback', 'Throwback'], ['rivalry', 'Rivalry']];
// the details that make each set look different: sleeve stripes, pants stripes, helmet stripes, sock bands, shoulder yoke
const UNI_CUT = {
  home: { sleeve: 2, pstripe: 1, hstripe: 1, sockBand: 1 },
  away: { sleeve: 2, pstripe: 1, hstripe: 1, sockBand: 1 },
  rush: { sleeve: 0, pstripe: 1, hstripe: 1, sockBand: 0 },
  throwback: { sleeve: 3, pstripe: 2, hstripe: 2, sockBand: 3 },
  rivalry: { sleeve: 1, pstripe: 1, hstripe: 1, sockBand: 1, yoke: true, matte: true }
};
// big real rivalries get the rivalry sets (home team wears them, the road team wears white)
const RIVALRIES = ['CHI-GB', 'DAL-PHI', 'DAL-WAS', 'DAL-NYG', 'NYG-PHI', 'BAL-PIT', 'CLE-PIT', 'CIN-PIT', 'KC-LV', 'DEN-LV', 'DEN-KC', 'SEA-SF', 'LAR-SF',
  'DAL-SF', 'BUF-MIA', 'NE-NYJ', 'BUF-NE', 'BUF-KC', 'GB-MIN', 'DET-GB', 'CHI-DET', 'ATL-NO', 'CAR-NO', 'NO-TB', 'HOU-TEN', 'IND-NE', 'LAC-LAR', 'NYG-NYJ', 'BAL-CLE', 'ARI-SEA'];
function isRivalry(a, b) { return !!(a && b && a.id !== b.id && RIVALRIES.includes([a.id, b.id].sort().join('-'))); }
const lum = c => { let h = (c || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h.slice(0, 6), 16) || 0; return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const VISOR_COL = { clear: '#cfe6ff60', dark: '#1a1f2bdd', smoke: '#4a515cc8', gold: '#d9a933e0', blue: '#2a6cffb0' };
const GEAR_COL = { white: '#f2f2f2', black: '#161616', gold: '#d9a933', neon: '#b6ff2e' };
const lookCache = new Map();
// helmet stripe override per team, picked in the Uniform Room: 0 = no stripe, 1 = one stripe, 2 = two thin stripes (none saved = the uniform's own)
const HStripe = {
  KEY: 'bobbleHStripe', d: null,
  all() { if (!this.d) { try { this.d = JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { this.d = {}; } } return this.d; },
  get(id) { const v = this.all()[id]; return v === 0 || v === 1 || v === 2 ? v : null; },
  set(id, v) { const d = this.all(); if (v == null) delete d[id]; else d[id] = v; try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) {} }
};
function teamLook(team, home, style) {
  const lk = teamLookBase(team, home, style), o = team && HStripe.get(team.id);
  return o == null || lk.hstripe === o ? lk : { ...lk, hstripe: o };
}
function teamLookBase(team, home, style) {
  style = style || (home ? 'home' : 'away');
  if (style.startsWith('mix:')) { // mix and match: helmet from one set, jersey from another, pants from a third
    const key = team.id + team.c1 + team.c2 + team.helmet + team.mask + team.pants + home + style + (team.unis ? JSON.stringify(team.unis) : ''); let m = lookCache.get(key);
    if (!m) {
      const [h, j, p] = style.slice(4).split(',').map(k => teamLook(team, home, k));
      m = { helmet: h.helmet, stripe: h.stripe, mask: h.mask, hstripe: h.hstripe, matte: h.matte, decal: h.decal, maskStyle: h.maskStyle, logoTeam: h.logoTeam,
        jersey: j.jersey, trim: j.trim, num: j.num, numOut: j.numOut, sleeve: j.sleeve, yoke: j.yoke, sock: j.sock, sockBand: j.sockBand, pants: p.pants, pstripe: p.pstripe };
      lookCache.set(key, m);
    }
    return m;
  }
  const lk = baseLook(team, style);
  return { ...(UNI_CUT[style] || UNI_CUT.home), ...lk, numOut: lk.numOut || numOutline(lk, style) };
}
// created teams can set every color of each uniform by hand (helmet, jersey, numbers, pants...)
const UNI_PARTS = ['helmet', 'stripe', 'mask', 'jersey', 'num', 'trim', 'pants', 'sock'];
function baseLook(team, style) {
  const lk = autoLook(team, style), cu = team.custom && team.unis && team.unis[style], kit = team.custom && team.kit;
  if (!cu && !kit) return lk;
  const out = { ...lk }; if (cu) { for (const k of UNI_PARTS) if (cu[k]) out[k] = cu[k];
    if (cu.num || cu.jersey || cu.trim) delete out.numOut; // let the number outline match the new colors
    for (const k of ['sleeve', 'pstripe', 'hstripe', 'sockBand', 'yoke', 'matte', 'numOut']) if (cu[k] != null) out[k] = cu[k]; } // stripe counts, yoke, matte, outline picked in Create a Team
  if (kit) { if (kit.decal) { out.decal = kit.decal; out.logoTeam = team; } if (kit.mask) out.maskStyle = kit.mask; } // helmet side + facemask for the editor's turntable
  return out;
}
function autoLook(team, style) {
  const base = { helmet: team.helmet, stripe: team.c2, mask: team.mask };
  const light = c => textOn(c) === '#111';
  if (style === 'throwback') {
    if (THROWBACKS[team.id]) return { ...base, ...THROWBACKS[team.id] };
    const j = light(team.c2) ? shade(team.c1, -0.35) : team.c2;
    return { ...base, jersey: j, trim: team.c1, num: light(j) ? team.c1 : '#ffffff', pants: '#ffffff', sock: j };
  }
  if (style === 'rivalry') {
    // a dark, matte, one-color set with the team's loudest color as the accent
    const [dark, bright] = lum(team.c1) <= lum(team.c2) ? [team.c1, team.c2] : [team.c2, team.c1];
    const body = shade(dark, lum(dark) > 0.35 ? -0.6 : lum(dark) > 0.18 ? -0.4 : -0.15), acc = lum(bright) < 0.3 ? '#c9ced6' : bright;
    const pants = lum(dark) < 0.18 ? acc : body; // already-dark teams get bold accent pants so the set doesn't look like their home one
    return { helmet: shade(body, 0.06), stripe: acc, mask: acc, jersey: body, trim: acc, num: acc, numOut: '#ffffff', pants, sock: body };
  }
  if (style === 'rush') return { ...base, jersey: team.c1, trim: team.c2, num: light(team.c2) ? '#fff' : team.c2, pants: shade(team.c1, -0.08), sock: team.c1 };
  return style === 'home'
    ? { ...base, jersey: team.c1, trim: team.c2, num: team.c2 === '#ffffff' || team.c2 === '#FFFFFF' ? '#fff' : team.c2, pants: team.pants || shade(team.c2, 0.15), sock: team.c1 }
    : { ...base, jersey: '#f7f7f7', trim: team.c1, num: team.c1, pants: team.pantsAway || '#ececec', sock: team.c1 };
}
// two-tone numbers: an outline that pops off the jersey
function numOutline(lk, style) {
  if (style === 'throwback') return shade(lk.jersey, -0.5);
  if (style === 'away') return lk.trim !== lk.num ? lk.trim : shade(lk.num, -0.45);
  const lightNum = lum(lk.num) > 0.62;
  if (lightNum) return lum(lk.jersey) > 0.5 ? shade(lk.jersey, -0.55) : (lk.trim !== lk.num && lum(lk.trim) < 0.62 ? lk.trim : shade(lk.jersey, -0.5));
  return lum(lk.jersey) < 0.5 ? '#ffffff' : shade(lk.jersey, -0.55);
}
// mud, grass and snow build up on a player every time he hits the ground
const DIRT = { clear: '#4e6e2c', rain: '#4a3420', snow: '#f4f8ff' };
function dirtSpots(g, p, n, x0, y0, w, h, a) {
  if (!p.dirt || p.dirt < 0.04) return;
  const hs = hashStr(p.name || 'x');
  g.fillStyle = DIRT[G.weather] || DIRT.clear; g.globalAlpha = Math.min(0.75, p.dirt * 0.8) * a;
  const k = Math.ceil(n * Math.min(1, p.dirt * 1.4));
  for (let i = 0; i < k; i++) {
    const r = (hs >> (i * 3)) & 63, q = (hs >> (i * 2 + 5)) & 63;
    g.beginPath(); g.ellipse(x0 + (r / 63) * w, y0 + (q / 63) * h, 2 + (r % 4) * (0.6 + p.dirt), 1.4 + (q % 3) * 0.7, (r % 7) * 0.4, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}

const torsoCache = new Map();
function drawTorso(g, p, G, look, W, TH, big, dir) {
  // torso
  const tg = g.createLinearGradient(-W / 2, 0, W / 2, 0);
  tg.addColorStop(0, shade(look.jersey, -0.18)); tg.addColorStop(0.45, look.jersey); tg.addColorStop(1, shade(look.jersey, -0.08));
  g.fillStyle = tg; g.strokeStyle = OUT; g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(-W * 0.4, -2); g.lineTo(-W * 0.5, -TH + 6); g.quadraticCurveTo(-W * 0.55, -TH - 2, -W * 0.3, -TH - 3);
  g.lineTo(W * 0.3, -TH - 3); g.quadraticCurveTo(W * 0.55, -TH - 2, W * 0.5, -TH + 6); g.lineTo(W * 0.4, -2); g.closePath();
  g.fill(); g.stroke();
  // inside the jersey: shoulder yoke, side panel, mud/snow, wet shine, light from the top left
  g.save(); g.clip();
  if (look.yoke) { g.fillStyle = look.trim; g.fillRect(-W * 0.6, -TH - 4, W * 1.2, 5); g.fillStyle = shade(look.jersey, 0.1); g.fillRect(-W * 0.6, -TH + 1, W * 1.2, 1.5); }
  g.fillStyle = shade(look.jersey, -0.22); g.fillRect(W * 0.3, -TH + 6, W * 0.25, TH); // side panel
  g.fillStyle = look.trim; g.fillRect(W * 0.28, -TH + 6, 1.4, TH);
  dirtSpots(g, p, 5, -W * 0.45, -TH * 0.55, W * 0.9, TH * 0.55, 1);
  g.fillStyle = G.weather === 'rain' ? '#ffffff30' : '#ffffff1c'; g.fillRect(-W * 0.55, -TH - 4, W * 0.32, TH + 4);
  if (G.weather === 'rain') { g.fillStyle = '#ffffff40'; g.fillRect(-W * 0.36, -TH + 3, 2, TH - 8); } // soaked jersey sheen
  g.restore();
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
  g.font = `900 ${big ? 14 : 13}px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 4.2; g.strokeStyle = shade(look.jersey, -0.6); g.strokeText(p.num, 0, -TH / 2 - 1);
  g.lineWidth = 2.4; g.strokeStyle = look.numOut || shade(look.jersey, -0.55); g.strokeText(p.num, 0, -TH / 2 - 1);
  g.fillStyle = look.num; g.fillText(p.num, 0, -TH / 2 - 1);
  g.restore();
}
// soft round shadow under each player, painted once
const shadowSprites = {};
function shadowSprite(r) {
  if (shadowSprites[r]) return shadowSprites[r];
  const c = document.createElement('canvas'); c.width = c.height = r * 4; const g = c.getContext('2d');
  if (!g || !g.createRadialGradient) return null;
  const m = r * 2, shg = g.createRadialGradient(m, m, 2, m, m, m); shg.addColorStop(0, '#00000070'); shg.addColorStop(0.7, '#00000040'); shg.addColorStop(1, '#00000000');
  g.fillStyle = shg; g.beginPath(); g.arc(m, m, m, 0, 7); g.fill();
  return (shadowSprites[r] = c);
}
// drawing a picture tilted is ~5x slower than straight on phones, so tilted heads/jerseys get turned once per small angle step
// and copied over straight on whole pixels. Anything zoomed or squashed draws the normal way
const rotSprites = new Map(); let rotSpriteId = 0;
function blitRot(g, c, dx, dy, dw, dh) {
  if (G.demo) return g.drawImage(c, dx, dy, dw, dh); // (the menu demo changes teams every play: nothing would get reused)
  const m = g.getTransform(), a = m.a, b = m.b, cc = m.c, d = m.d;
  if (Math.abs(b) < 1e-9 && Math.abs(cc) < 1e-9 || Math.abs(a * a + b * b - 1) > 1e-6 || Math.abs(cc * cc + d * d - 1) > 1e-6 || Math.abs(a * cc + b * d) > 1e-6) return g.drawImage(c, dx, dy, dw, dh);
  const flip = a * d - b * cc < 0, q = Math.round((flip ? Math.atan2(-b, -a) : Math.atan2(b, a)) / 0.02), th = q * 0.02, co = Math.cos(th), si = Math.sin(th);
  if (!q) { g.save(); g.setTransform(flip ? -1 : 1, 0, 0, 1, m.e, m.f); g.drawImage(c, dx, dy, dw, dh); g.restore(); return; } // tilted less than half a step: straight
  const L = flip ? [-co, -si, -si, co] : [co, si, -si, co]; // (flipped = mirrored left-right, then turned)
  if (!c.rid) c.rid = ++rotSpriteId;
  const key = c.rid + '|' + q + (flip ? 'f' : '') + '|' + dx + '|' + dy + '|' + dw + '|' + dh;
  let r = rotSprites.get(key);
  if (r) { rotSprites.delete(key); rotSprites.set(key, r); }
  else {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [px, py] of [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]]) { const X = L[0] * px + L[2] * py, Y = L[1] * px + L[3] * py; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    const ox = Math.floor(x0) - 1, oy = Math.floor(y0) - 1;
    r = document.createElement('canvas'); r.width = Math.ceil(x1) + 1 - ox; r.height = Math.ceil(y1) + 1 - oy; r.ox = ox; r.oy = oy;
    const rg = r.getContext('2d');
    if (!rg || !rg.setTransform) return g.drawImage(c, dx, dy, dw, dh);
    rg.setTransform(L[0], L[1], L[2], L[3], -ox, -oy); rg.drawImage(c, dx, dy, dw, dh);
    if (rotSprites.size > 800) { let n = 80; for (const k of rotSprites.keys()) { rotSprites.delete(k); if (!--n) break; } } // keep graphics memory small: drop the oldest
    rotSprites.set(key, r);
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(r, Math.round(m.e) + r.ox, Math.round(m.f) + r.oy); g.restore();
}
// ---- kick poses (fields set in special.js): kickT = leg swing clock, kpose 'hold' (FG holder) / 'pc' (punter wants the snap), fair = fair catch wave ----
// kicking leg angle from straight down (+ = forward): cock it back, whip through the ball at KICK_HIT, follow through high
function kickSwingAng(t, punt) {
  const top = punt ? 3.1 : 2.4;
  if (t < 0.1) return lerp(0, -1.1, t / 0.1);
  if (t < KICK_HIT) return lerp(-1.1, 0.6, (t - 0.1) / (KICK_HIT - 0.1));
  if (t < 0.42) return lerp(0.6, top, ease((t - KICK_HIT) / (0.42 - KICK_HIT)));
  return lerp(top, 0, clamp((t - 0.42) / 0.4, 0, 1));
}
function kickPose(p, G, HIP) {
  if (p.down > 0) return null;
  if (p.kickT != null) {
    const a = kickSwingAng(p.kickT, p.pos === 'P'), Lg = HIP * 0.6; // (a little stretch so the swing reads at game size)
    const a1 = a > 0 ? a * 0.85 : a * 0.4, a2 = a1 - (a < 0 ? -a * 1.4 : Math.max(0, 0.7 - a) * 0.6); // thigh, shin (the knee folds on the backswing)
    return {
      lean: a > 0.8 ? -0.24 * Math.min(1, (a - 0.8) / 1.0) : 0.06, // leans back as the leg comes up
      leg: (side, hx, hy) => {
        if (side < 0) return { kx: hx + 2, ky: hy * 0.5, fx: hx + 3, fy: 0 }; // plant leg
        const kx = hx + Math.sin(a1) * Lg, ky = hy + Math.cos(a1) * Lg;
        return { kx, ky, fx: kx + Math.sin(a2) * Lg, fy: ky + Math.cos(a2) * Lg + 2 };
      },
      arm: (front, shx, shy) => front ? { ex: shx + 5, ey: shy + 8, hx: shx + 3 - a * 3, hy: shy + 15 } : { ex: shx - 8, ey: shy - 1, hx: shx - 15, hy: shy - 7 } // arms out for balance
    };
  }
  if (p.kpose === 'hold' && p.kneel > 0) {
    const b = G.ball, e = b && b.hold > 0 ? ease(Math.min(1, b.hold)) : -1; // -1: waiting for the snap
    if (e < 0) return { arm: (front, shx, shy) => front ? { ex: shx + 8, ey: shy + 1, hx: shx + 15, hy: shy - 1 } : { ex: shx + 7, ey: shy + 4, hx: shx + 13, hy: shy + 3 } }; // hands up: give me a target
    // the ball goes from his hands (flat, out front) to standing point-down on the spot: just behind his front knee, a bit toward the camera
    const S = 1.2, SX = -13.2, SY = 11.2, rot = -Math.PI / 2 * e, bc = { x: lerp(16, SX, e), y: lerp(-21, SY - 9 * S, e) };
    const top = { x: bc.x + Math.cos(rot) * 9 * S, y: bc.y + Math.sin(rot) * 9 * S }, bot = { x: bc.x - Math.cos(rot) * 9 * S, y: bc.y - Math.sin(rot) * 9 * S };
    const elbow = (sh, h, out) => ({ ex: (sh.x + h.x) / 2 + out, ey: (sh.y + h.y) / 2 + 2, hx: h.x, hy: h.y });
    return {
      arm: (front, shx, shy, toT) => {
        if (front) return elbow({ x: shx, y: shy }, toT(top.x - 1, top.y - 2), 4); // one finger on top of the ball
        const rest = toT(13, -13), h = e < 0.75 ? toT(bot.x, bot.y) : rest; // both hands on it, then the back hand goes to his knee
        return elbow({ x: shx, y: shy }, h, 3);
      },
      ball: (g, toT, lean) => {
        const sp = toT(SX, SY), c = toT(bc.x, bc.y);
        g.fillStyle = '#0005'; g.beginPath(); g.ellipse(sp.x, sp.y, 6, 2.2, 0, 0, 7); g.fill();
        if (e < 1) drawSpiral(g, c.x, c.y, rot - lean, (1 - e) * 18, S); // spinning the laces out
        else drawFootball(g, c.x, c.y, S, rot - lean);
      }
    };
  }
  if (p.kpose === 'pc') return { arm: (front, shx, shy) => front ? { ex: shx + 8, ey: shy + 4, hx: shx + 15, hy: shy + 2 } : { ex: shx + 6, ey: shy + 6, hx: shx + 13, hy: shy + 4 } }; // arms out: snap it here
  if (p.fair) return { arm: (front, shx, shy) => front ? { ex: shx + 10, ey: shy - 12, hx: shx + 18 + Math.sin(G.time * 14) * 3, hy: shy - 26 } : null }; // waving for a fair catch
  return null;
}
// arms and legs: the lines for one pose are painted once into a big sheet and copied from there after that
// (16 players x 4 limbs x ~6 lines a frame was the slowest thing on phones). Only for straight-up players at normal zoom
const LIMB_STEP = Math.PI * 2 / 48, limbCache = new Map();
const q4 = v => Math.round(v * 4) / 4;
function limbBlit(g, key, x0, y0, x1, y1, paint) {
  let c = limbCache.get(key);
  if (c) { limbCache.delete(key); limbCache.set(key, c); } // (most recently used last)
  else {
    const X0 = Math.floor(x0), Y0 = Math.floor(y0), w = Math.ceil(x1) - X0, h = Math.ceil(y1) - Y0;
    c = document.createElement('canvas'); c.width = w; c.height = h; c.X0 = X0; c.Y0 = Y0;
    const sg = c.getContext('2d');
    if (!sg || !sg.translate) return paint(g);
    sg.translate(-X0, -Y0); paint(sg);
    if (limbCache.size > 5000) { let n = 500; for (const k of limbCache.keys()) { limbCache.delete(k); if (!--n) break; } } // keep graphics memory small: drop the oldest
    limbCache.set(key, c);
  }
  g.drawImage(c, c.X0, c.Y0);
}
function paintLeg(g, p, look, ck, hx, hy, kx, ky, fxp, fyp) {
  g.strokeStyle = OUT; g.lineWidth = 10; g.lineCap = 'round';
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fxp, fyp - 2); g.stroke();
  g.strokeStyle = look.pants; g.lineWidth = 7;
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.stroke();
  // pants stripes: single, or a classic double/triple on throwbacks
  const ps = look.pstripe == null ? 1 : look.pstripe;
  if (ps) {
    g.strokeStyle = look.trim; g.lineWidth = ps > 1 ? 1.1 : 1.7;
    g.beginPath();
    for (let i = 0; i < ps; i++) { const o = -2.2 + i * 1.8; g.moveTo(hx + o, hy + 1); g.lineTo(kx + o, ky - 1); }
    g.stroke();
  }
  dirtSpots(g, p, 3, Math.min(hx, kx) - 3, Math.min(hy, ky), Math.abs(kx - hx) + 6, Math.abs(ky - hy), 1);
  g.strokeStyle = look.sock; g.lineWidth = 6.5;
  g.beginPath(); g.moveTo(kx, ky); g.lineTo(fxp, fyp - 2); g.stroke();
  if (look.sockBand) { // stripes around the top of the sock
    const bands = look.sockBand;
    g.strokeStyle = look.trim; g.lineWidth = bands > 1 ? 1.1 : 1.8;
    for (let i = 0; i < bands; i++) { const u = 0.22 + i * 0.14, bx = lerp(kx, fxp, u), by = lerp(ky, fyp - 2, u); g.beginPath(); g.moveTo(bx - 3.2, by); g.lineTo(bx + 3.2, by); g.stroke(); }
  }
  g.fillStyle = '#ffffff30'; g.beginPath(); g.arc(kx + 1, ky - 1, 2.2, 0, 7); g.fill(); // knee shine
  g.fillStyle = ck; g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.ellipse(fxp + 3, fyp - 1, 6, 3.6, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = look.trim === ck ? look.jersey : look.trim; g.fillRect(fxp - 0.5, fyp - 3, 5, 1.6);
  g.fillStyle = '#ffffff40'; g.fillRect(fxp + 1, fyp - 4, 4, 1);
}
function paintArm(g, p, look, sl, shx, shy, ex, ey, hx, hy) {
  g.strokeStyle = OUT; g.lineWidth = 9.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(shx, shy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
  g.strokeStyle = look.jersey; g.lineWidth = 6.5;
  g.beginPath(); g.moveTo(shx, shy); g.lineTo(ex, ey); g.stroke();
  if (look.sleeve) { // sleeve stripes near the cuff
    const n = look.sleeve, w = n > 2 ? 0.07 : 0.1;
    g.strokeStyle = look.trim; g.lineWidth = 6.5; g.lineCap = 'butt';
    for (let i = 0; i < n; i++) { const u = 0.58 + i * (w + 0.07); g.beginPath(); g.moveTo(lerp(shx, ex, u), lerp(shy, ey, u)); g.lineTo(lerp(shx, ex, u + w), lerp(shy, ey, u + w)); g.stroke(); }
    g.lineCap = 'round';
  }
  g.strokeStyle = sl || SKIN[p.face.skin]; g.beginPath(); g.moveTo(ex, ey); g.lineTo(hx, hy); g.stroke();
  if (p.gear && p.gear.band === 'on') { g.strokeStyle = sl === '#f2f2f2' ? look.trim : '#f4f4f4'; g.lineCap = 'butt'; g.beginPath(); g.moveTo(lerp(ex, hx, 0.12), lerp(ey, hy, 0.12)); g.lineTo(lerp(ex, hx, 0.3), lerp(ey, hy, 0.3)); g.stroke(); g.lineCap = 'round'; }
  g.fillStyle = p.teamGloves ? look.trim : p.gloves || '#f2f2f2'; g.strokeStyle = OUT; g.lineWidth = 2;
  g.beginPath(); g.arc(hx, hy, 3.8, 0, 7); g.fill(); g.stroke();
}
function drawPlayer(g, p, G, at) {
  const x = at ? at.x : sx(p.x), y = at ? at.y : sy(p.y);
  if (!at && (x < -80 - CW * 0.4 || x > CW * 1.4 + 80 || y < -40 || y > CH + 140)) return; // a bit wide so the zoomed celly cam never loses anyone
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
  if (p.isHuman && !at && (G.phase !== 'kick' && G.phase !== 'kickmeter' || (G.phase === 'kickmeter' && (!p.off || (G.km && G.km.kind === 'punt'))))) { // + your rusher on a field goal / your guy on a punt
    const pulse = 1 + Math.sin(G.time * 8) * 0.08;
    g.strokeStyle = G.versus && p.ctl === 1 ? '#5ad1ff' : '#ffe14d'; g.lineWidth = 3.5;
    g.beginPath(); g.ellipse(x, y, 22 * pulse, 9 * pulse, 0, 0, 7); g.stroke();
  }
  if (!at) drawXFRing(g, p, x, y);
  { const sw0 = big ? 21 : 17, sh = shadowSprite(sw0); if (sh) g.drawImage(sh, x - sw0, y - sw0 * 0.36, sw0 * 2, sw0 * 0.72); }
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
  // victory formation: the QB drops to one knee (front knee up, back knee on the grass)
  const kn = p.kneel > 0 ? ease(Math.min(1, p.kneel / 0.3)) : 0;
  const W = big ? 30 : 24, TH = big ? 24 : 22, HIP = (big ? 17 : 18) - kn * 9.5;
  const kp = pose ? null : kickPose(p, G, HIP); // holder / kicker / punter / fair catch
  // plain standing/running (most of the time): the player goes on whole pixels and his arms/legs come from the limb sheet
  const m0 = !at && !G.demo && !pose && !kn && !kp && p.down <= 0 && !(p.dive > 0) && !(p.spin > 0) && g.globalAlpha === 1 ? g.getTransform() : null;
  const fast = !!m0 && m0.a === 1 && m0.b === 0 && m0.c === 0 && m0.d === 1 && m0.e === Math.round(m0.e) && m0.f === Math.round(m0.f);
  g.save(); g.translate(fast ? Math.round(x) : x, fast ? Math.round(y - hop) : y - hop);
  if (pose) {
    if (pose.rot) { g.translate(0, -32); g.rotate(pose.rot * dir); g.translate(0, 32); } // spin around his belly, not his feet
    if (pose.lie) { g.translate(0, -6); g.rotate(pose.lie * dir); }
    if (pose.sy !== 1) g.scale(1 / Math.sqrt(pose.sy), pose.sy); // squash and stretch
  }
  if (p.down > 0) { g.translate(0, -6); g.rotate(p.downDir * 1.45); }
  else if (p.dive > 0) { g.rotate(dir * 1.0); }
  const spinScale = p.spin > 0 ? Math.cos(p.spin * 20) : 1;
  g.scale(dir * (Math.abs(spinScale) < 0.15 ? 0.15 * Math.sign(spinScale || 1) : spinScale), 1);

  const PMe = fast ? m0.e + Math.round(x) : 0, PMf = fast ? m0.f + Math.round(y - hop) : 0; // player frame on screen (fast path)
  const kL = fast ? Math.round(k * 5) / 5 : k; // arm/leg swing in small steps so poses repeat
  const anim = fast ? Math.round(p.anim / LIMB_STEP) * LIMB_STEP : p.anim;
  const kneelLeg = kn ? (side, hx, hy, kx, ky, fx, fy) => side > 0
    ? { kx: lerp(kx, hx + 10, kn), ky: lerp(ky, hy - 2, kn), fx: lerp(fx, hx + 11, kn), fy: lerp(fy, 0, kn) }      // front leg: thigh flat, shin straight down
    : { kx: lerp(kx, hx - 1, kn), ky: lerp(ky, -1, kn), fx: lerp(fx, hx - 13, kn), fy: lerp(fy, -2, kn) } : null; // back leg: knee on the grass, shin flat behind
  const legPose = kneelLeg || (pose && pose.leg) || (kp && kp.leg) || null;
  let lean = (p.down > 0 ? 0 : k * 0.18) + (p.engaged ? 0.25 : 0) + kn * 0.12 + (kp && kp.lean || 0);
  if (fast) lean = Math.round(lean / 0.02) * 0.02; // same steps as the turned jersey picture
  const lc = Math.cos(lean), ls = Math.sin(lean), toT = (x, y) => ({ x: x * lc + (y + HIP) * ls, y: -x * ls + (y + HIP) * lc }); // feet coords -> torso coords

  // legs (two segments) + cleats
  const gc = p.gear && p.gear.cleats, ck = gc && gc !== 'auto' ? (gc === 'team' ? look.jersey : GEAR_COL[gc]) : textOn(look.pants) === '#111' ? '#f2f2f2' : '#151515';
  const dk = p.dirt >= 0.04 ? Math.round(p.dirt * 20) : 0, dirtKey = dk ? dk + p.name + G.weather : '';
  const leg = (side, ph) => {
    const s = Math.sin(anim + ph) * kL, lift = Math.max(0, Math.cos(anim + ph)) * kL * 5;
    const hx = side * (W * 0.18), hy = -HIP;
    let kx = hx + s * 7 + 2, ky = -HIP * 0.48 - lift * 0.6;
    let fxp = hx + s * 12, fyp = -lift;
    const lp = legPose && legPose(side, hx, hy, kx, ky, fxp, fyp); // kneeling / Heisman: the pose places this leg
    if (lp) ({ kx, ky, fx: fxp, fy: fyp } = lp);
    if (!fast) return paintLeg(g, p, look, ck, hx, hy, kx, ky, fxp, fyp);
    kx = q4(kx); ky = q4(ky); fxp = q4(fxp); fyp = q4(fyp);
    const pd = dk ? 12 : 6;
    limbBlit(g, 'L' + look.pants + look.trim + look.pstripe + look.sock + look.sockBand + ck + dirtKey + '|' + hx + '|' + hy + '|' + kx + '|' + ky + '|' + fxp + '|' + fyp,
      Math.min(hx, kx, fxp) - pd, Math.min(hy, ky) - pd, Math.max(hx, kx, fxp + 5) + pd, Math.max(ky, fyp + 4) + 2,
      sg => paintLeg(sg, p, look, ck, hx, hy, kx, ky, fxp, fyp));
  };
  leg(-1, Math.PI); leg(1, 0);

  g.save(); g.translate(0, -HIP); g.rotate(lean);
  // pants top
  g.fillStyle = look.pants; g.strokeStyle = OUT; g.lineWidth = 2.5;
  roundRect(g, -W * 0.42, -4, W * 0.84, 9, 4); g.fill(); g.stroke();
  dirtSpots(g, p, 3, -W * 0.36, -2, W * 0.72, 6, 1);
  // back arm (behind torso)
  const sw = Math.sin(anim) * kL;
  const arm = (front) => {
    const shx = front ? W * 0.3 : -W * 0.22, shy = -TH + 5;
    let ex, ey, hx, hy;
    const pa = pose && pose.arm ? pose.arm(front, shx, shy) : kp && kp.arm ? kp.arm(front, shx, shy, toT) : null;
    if (pa) ({ ex, ey, hx, hy } = pa);
    else if (carrying && front) { ex = shx + 4; ey = shy + 10; hx = shx + (p.tuck ? 7 : 10); hy = shy + (p.tuck ? 6 : 8); }
    else if (carrying && p.tuck) { ex = shx + 6; ey = shy + 9; hx = shx + 13; hy = shy + 7; } // two hands on it
    else if (p.throwAnim > 0 && front) { const t = p.throwAnim; ex = shx - 6 + (1 - t) * 14; ey = shy - 10; hx = shx - 4 + (1 - t) * 22; hy = shy - 18 + (1 - t) * 10; }
    else if (celebrate || jumping) { ex = shx + (front ? 4 : -4); ey = shy - 11; hx = shx + (front ? 6 : -6); hy = shy - 22; }
    else if (p.stiff > 0 && front) { ex = shx + 9; ey = shy + 1; hx = shx + 19; hy = shy; }
    else if (p.engaged && front) { ex = shx + 8; ey = shy + 4; hx = shx + 15; hy = shy + 2; }
    else { const s = (front ? -sw : sw); ex = shx + s * 7; ey = shy + 9; hx = shx + s * 12 + 2; hy = shy + 16; }
    const sl = p.gear && p.gear.sleeve && p.gear.sleeve !== 'none' ? (p.gear.sleeve === 'team' ? shade(look.jersey, -0.08) : GEAR_COL[p.gear.sleeve]) : null;
    if (!fast) paintArm(g, p, look, sl, shx, shy, ex, ey, hx, hy);
    else { // turn the arm with the body by hand so the picture copies over straight
      const T = (x, y) => [q4(x * lc - y * ls), q4(x * ls + y * lc - HIP)], [a0, a1] = T(shx, shy), [b0, b1] = T(ex, ey), [c0, c1] = T(hx, hy);
      g.save(); g.setTransform(dir, 0, 0, 1, PMe, PMf);
      limbBlit(g, 'A' + look.jersey + look.trim + look.sleeve + sl + (p.gear && p.gear.band) + (p.teamGloves ? look.trim : p.gloves) + p.face.skin + '|' + a0 + '|' + a1 + '|' + b0 + '|' + b1 + '|' + c0 + '|' + c1,
        Math.min(a0, b0, c0) - 6, Math.min(a1, b1, c1) - 6, Math.max(a0, b0, c0) + 6, Math.max(a1, b1, c1) + 6,
        sg => paintArm(sg, p, look, sl, a0, a1, b0, b1, c0, c1));
      g.restore();
    }
    return { hx, hy };
  };
  arm(false);
  // torso: drawn once per look and reused (number text + gradients are slow to redraw every frame)
  { const dk = p.dirt >= 0.04 ? Math.round(p.dirt * 20) : 0;
    const key = [big ? 1 : 0, dir, look.jersey, look.trim, look.yoke ? 1 : 0, look.num, look.numOut, p.num, G.weather, dk, dk ? p.name : ''].join('|');
    let c = torsoCache.get(key);
    if (!c) {
      const S = 2, BX = Math.ceil(W * 0.75), BY = TH + 8;
      c = document.createElement('canvas'); c.width = BX * 2 * S; c.height = (BY + 6) * S; c.BX = BX; c.BY = BY;
      const tg2 = c.getContext('2d');
      if (tg2 && tg2.save) { tg2.scale(S, S); tg2.translate(BX, BY); drawTorso(tg2, p, G, look, W, TH, big, dir); if (torsoCache.size > 160) torsoCache.clear(); torsoCache.set(key, c); }
      else { c = null; drawTorso(g, p, G, look, W, TH, big, dir); }
    }
    if (c) blitRot(g, c, -c.BX, -c.BY, c.BX * 2, c.BY + 6);
  }
  // front arm + ball
  if (kp && kp.ball) kp.ball(g, toT, lean); // the holder's ball goes under his hand
  const hand = arm(true);
  if (carrying && !(pose && pose.noBall)) drawFootball(g, hand.hx - 2, hand.hy - 1, 0.95, 0.4);

  // neck + bobble head
  const R = (big ? 19 : 21) * (p.headScale || 1);
  const hx = p.head.ox * dir, hy = -TH - R - 1 + p.head.oy; // head sits a little high so the jersey number shows
  g.fillStyle = SKIN[p.face.skin]; g.strokeStyle = OUT; g.lineWidth = 2;
  g.fillRect(-3, -TH - 9, 6, 9);
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
  else if (p.xf && G.phase === 'presnap' && !G.demo && p.down <= 0) drawXFPip(g, p, x + 24, headTop + 30);
  const showName = !p.celly && p.down <= 0 && tagFor(p, G, carrying);
  let ly = headTop;
  if (showName) {
    g.font = 'bold 13px Barlow, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const full = p.isHuman || carrying, label = full ? `${p.name}` : lastName(p.name) + (p.tw2 && G.phase === 'presnap' ? '  ·  2-WAY' : '');
    const w = g.measureText(label).width + 14;
    g.fillStyle = p.isHuman ? (G.versus && p.ctl === 1 ? '#5ad1ff' : '#ffe14d') : '#000000c0'; roundRect(g, x - w / 2, ly - 10, w, 20, 10); g.fill();
    if (p.cap) { g.strokeStyle = '#f6c31c'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = p.isHuman ? '#111' : '#fff'; g.fillText(label, x, ly + 1);
    if (full) { g.font = 'bold 10px Barlow, Arial, sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; const r = `${p.tw2 ? '2-WAY ' : ''}${p.pos} • ${p.ovr} OVR`; g.strokeText(r, x, ly - 17); g.fillText(r, x, ly - 17); }
    if (p.xf && p.xf.on) drawXFBadge(g, p, x - w / 2 - 12, ly); // X-Factor badge sits next to his name
    tagBoxes.push({ x0: x - w / 2 - (p.xf && p.xf.on ? 24 : 0), x1: x + w / 2, y0: ly - (full ? 24 : 10), y1: ly + 10 });
    ly -= 30;
  } else if (p.xf && p.xf.on && p.down <= 0) drawXFBadge(g, p, x, headTop - 4);
  if (p.hot && G.phase === 'presnap') {
    g.font = 'bold 11px Barlow, Arial, sans-serif'; g.textAlign = 'center'; const w = g.measureText(p.hot).width + 12;
    g.fillStyle = '#ffe14d'; roundRect(g, x - w / 2, ly - 8, w, 16, 8); g.fill(); g.fillStyle = '#111'; g.fillText(p.hot, x, ly + 4);
    tagBoxes.push({ x0: x - w / 2, x1: x + w / 2, y0: ly - 8, y1: ly + 8 }); ly -= 22;
  }
  // controller: holding LB before the snap shows which button hot-routes each receiver
  if (Pad.hotShow && G.phase === 'presnap' && p.side === G.poss && p.slot >= 1 && p.slot <= 4 && G.O && G.O.includes(p)) { Pad.drawGlyph(g, p.slot === 1 ? 3 : p.slot - 2, x, ly, 13); ly -= 30; }
  if (p.throwKey) {
    const col = ['#2f7bff', '#ff3b3b', '#2fd06b', '#ffb02e'][p.throwKey - 1];
    const tgt = G.aim && G.aim.target === p;
    const r = tgt ? 17 : 14;
    tagBoxes.push({ x0: x - r - 2, x1: x + r + 2, y0: ly - r - 2, y1: ly + r + (p.openness != null ? 10 : 2) });
    if (Pad.ui) { // controller: the face button that throws to him
      if (tgt) { g.strokeStyle = '#ffe14d'; g.lineWidth = 3; g.beginPath(); g.arc(x, ly, r + 3, 0, 7); g.stroke(); }
      Pad.drawGlyph(g, p.throwKey - 1, x, ly, (r + 1) * Pad.scale(1.35));
    } else {
    g.fillStyle = col; g.strokeStyle = tgt ? '#ffe14d' : '#fff'; g.lineWidth = tgt ? 4 : 2.5;
    g.beginPath(); g.arc(x, ly, r, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = '900 16px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (G.mode === 'mobile') { g.beginPath(); g.moveTo(x, ly - 7); g.lineTo(x + 7, ly + 6); g.lineTo(x - 7, ly + 6); g.closePath(); g.fill(); }
    else g.fillText(p.throwKey, x, ly + 1);
    }
    if (p.openness != null) {
      const o = clamp(p.openness / 5, 0.12, 1);
      g.fillStyle = '#000a'; g.fillRect(x - 16, ly + r + 3, 32, 6);
      g.fillStyle = p.openness > 3 ? '#2fd06b' : p.openness > 1.6 ? '#ffd23f' : '#ff4040';
      g.fillRect(x - 15, ly + r + 4, 30 * o, 4);
    }
  }
}

// NAME TAGS: who gets a name over his head. KEY PLAYERS = the ball carrier, the guy the pass is going to, the player you control,
// your career player, X-Factors in the zone, two-way players before the snap, and the tackler for a moment after the whistle
function tagFor(p, G, carrying) {
  if (nameTagMode === 'off') return false;
  if (nameTagMode === 'all') return true;
  if (p.isHuman || carrying || p.cap || (p.xf && p.xf.on) || (p.tw2 && G.phase === 'presnap')) return true;
  const f = G.ball && G.ball.flight;
  if (f && f.intended === p && !f.pitch && !f.kick) return true;
  return G.phase === 'dead' && p === G.lastTackler && G.deadT > 0.25;
}

// heads are the most expensive thing on screen, so each look gets drawn once and reused as a picture (big speedup on Chromebooks)
const headCache = new Map();
function drawHead(g, R, team, p, look) {
  const face = p.face, gear = p.gear || {};
  const mood = p.mouth === 'O' ? 'shock' : p.celebrate > 0 ? 'happy' : (p.engaged || !p.off) ? 'mad' : 'focus';
  const snow = G.weather === 'snow' && p.dirt > 0.1 ? Math.round(Math.min(1, p.dirt + 0.3) * 6) : 0;
  const key = [R.toFixed(1), mood, face.dir, face.skin, face.visor ? 1 : 0, face.beard ? 1 : 0, look.helmet, look.stripe, look.hstripe, look.matte ? 1 : 0, look.mask, p.num, gear.visor, gear.mask, look.decal ? look.decal + team.id : '', G.weather === 'rain' ? 'r' : '', snow].join('|');
  let c = headCache.get(key);
  if (!c) {
    const S = 2, B = Math.ceil(R * 1.3 + 4); // drawn at 2x so the zoomed celly cam stays sharp
    c = document.createElement('canvas'); c.width = c.height = B * 2 * S; c.B = B;
    const hg = c.getContext('2d');
    if (!hg || !hg.save) { drawHeadRaw(g, R, team, p, look); return; }
    hg.scale(S, S); hg.translate(B, B); drawHeadRaw(hg, R, team, p, look);
    if (headCache.size > 160) headCache.clear(); // keep graphics memory small (Chromebooks)
    headCache.set(key, c);
  }
  blitRot(g, c, -c.B, -c.B, c.B * 2, c.B * 2);
}
function drawHeadRaw(g, R, team, p, look) {
  const face = p.face;
  // helmet shell with shine
  const hg = g.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.15, 0, 0, R * 1.05);
  hg.addColorStop(0, shade(look.helmet, 0.45)); hg.addColorStop(0.45, look.helmet); hg.addColorStop(1, shade(look.helmet, -0.35));
  g.fillStyle = hg; g.strokeStyle = OUT; g.lineWidth = 3;
  g.beginPath(); g.ellipse(-R * 0.05, 0, R * 1.04, R, 0, 0, 7); g.fill(); g.stroke();
  // stripe front-to-back over the top
  g.save(); g.beginPath(); g.ellipse(-R * 0.05, 0, R * 1.04, R, 0, 0, 7); g.clip();
  const hs = look.hstripe == null ? 1 : look.hstripe;
  if (hs === 2) { // two thin stripes, old school
    g.strokeStyle = look.stripe; g.lineWidth = R * 0.12;
    for (const k of [1.0, 0.8]) { g.beginPath(); g.ellipse(-R * 0.1, R * 0.15, R * 0.98 * k, R * 1.02 * k, 0, Math.PI * 1.05, Math.PI * 1.75); g.stroke(); }
  } else if (hs) {
    g.strokeStyle = look.stripe; g.lineWidth = R * 0.32;
    g.beginPath(); g.ellipse(-R * 0.1, R * 0.15, R * 0.98, R * 1.02, 0, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
    g.strokeStyle = look.matte ? shade(look.stripe, -0.35) : '#ffffffcc'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(-R * 0.1, R * 0.15, R * 0.8, R * 0.84, 0, Math.PI * 1.08, Math.PI * 1.72); g.stroke();
  }
  // snow sticks to the top of the helmet, rain beads on it
  if (G.weather === 'snow' && p.dirt > 0.1) { g.fillStyle = '#f4f8ffcc'; g.beginPath(); g.ellipse(-R * 0.2, -R * 0.95, R * 0.7 * Math.min(1, p.dirt + 0.3), R * 0.22, -0.1, 0, 7); g.fill(); }
  if (G.weather === 'rain') { g.fillStyle = '#ffffff70'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-R * (0.6 - i * 0.28), -R * (0.35 + (i % 2) * 0.25), R * 0.05, 0, 7); g.fill(); } }
  g.restore();
  // side decal: jersey number
  g.save(); g.scale(face.dir, 1);
  g.font = `900 ${Math.round(R * 0.62)}px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3; g.strokeStyle = shade(look.helmet, -0.6); g.fillStyle = look.stripe === look.helmet ? '#fff' : look.stripe;
  const dx = -R * 0.38 * face.dir;
  if (look.decal === 'logo' && typeof Logo !== 'undefined') Logo.draw(g, team, dx, -R * 0.06, R * 0.78); // created teams can put their logo on the helmet
  else if (look.decal !== 'none') { g.strokeText(p.num, dx, -R * 0.08); g.fillText(p.num, dx, -R * 0.08); }
  g.restore();
  // gloss
  g.save(); g.translate(-R * 0.42, -R * 0.52); g.rotate(-0.6);
  const gl = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.32); gl.addColorStop(0, look.matte ? '#ffffff38' : '#ffffffb0'); gl.addColorStop(1, '#ffffff00');
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
    const vk = p.gear && VISOR_COL[p.gear.visor] ? p.gear.visor : 'dark';
    if (vk === 'gold') { const vg = g.createLinearGradient(fx - R * 0.36, 0, fx + R * 0.42, 0); vg.addColorStop(0, '#f6d365'); vg.addColorStop(0.5, '#c77dff'); vg.addColorStop(1, '#4cc9f0'); g.fillStyle = vg; } else g.fillStyle = VISOR_COL[vk];
    roundRect(g, fx - R * 0.36, ey - R * 0.2, R * 0.78, R * 0.34, R * 0.12); g.fill();
    if (vk === 'clear') { for (const ex of [e1, e2]) { g.fillStyle = '#111'; g.beginPath(); g.arc(ex + R * 0.05, ey + R * 0.01, R * 0.09, 0, 7); g.fill(); } }
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
    const ms = p.gear && p.gear.mask || 'classic';
    if (ms !== 'open') { g.moveTo(fx + R * 0.2, fy + R * 0.13); g.lineTo(fx + R * 0.17, fy + R * 0.48); } // center bar
    if (ms === 'cage' || ms === 'robot') { g.moveTo(fx + R * 0.42, fy + R * 0.1); g.lineTo(fx + R * 0.4, fy + R * 0.5); g.moveTo(fx - R * 0.02, fy - R * 0.12); g.quadraticCurveTo(fx + R * 0.3, fy - R * 0.1, fx + R * 0.62, fy - R * 0.14); }
    if (ms === 'robot') { g.moveTo(-R * 0.0, fy + R * 0.66); g.quadraticCurveTo(fx + R * 0.3, fy + R * 0.74, fx + R * 0.54, fy + R * 0.62); }
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
  const b = G.ball; if (!b || b.holder || b.hold) return; // (the holder draws the ball he's spotting)
  const [lx, ly] = kickLean(G, b), x = sx(b.x) + lx, x0 = x, y = sy(b.y) + ly;
  const sh = 1 / (1 + (b.z || 0) * 0.06); // shadow on the grass: smaller + lighter the higher it goes
  g.fillStyle = `rgba(0,0,0,${(0.4 * sh).toFixed(2)})`; g.beginPath(); g.ellipse(x0, y, 6 * sh + 2, 2.5 * sh + 1, 0, 0, 7); g.fill();
  if (b.flight) { // trail
    g.strokeStyle = '#ffffff40'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i < 6; i++) { const u = Math.max(0, b.flight.t / b.flight.T - i * 0.03); const tx = lerp(b.flight.sx, b.flight.tx, u), ty = lerp(b.flight.sy, b.flight.ty, u), tz = flightZ(b.flight, u); const px = sx(tx), py = sy(ty) - tz * PX * 0.9; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  }
  if (b.snap && !b.flight) drawSpiral(g, x, y - b.z * PX * 0.9, b.snap > 0 ? 0 : Math.PI, b.spin || 0, 1.25); // long snap: a tight spiral back
  else if (b.flight && b.flight.duck && !b.flight.kick) drawFootball(g, x, y - b.z * PX * 0.9, 1.3, Math.sin(G.time * 9) * 0.9 + G.time * 2); // wobbly duck
  else if (b.flight) {
    const f = b.flight, u = Math.min(1, f.t / f.T);
    const dz = (f.peak * 4 * (1 - 2 * u) + 1.1 - (f.z0 != null ? f.z0 : 1.7)) / f.T; // height change per second
    const vxs = (f.tx - f.sx) / f.T * PX, vys = (f.ty - f.sy) / f.T * PY - dz * PX * 0.9;
    drawSpiral(g, x, y - b.z * PX * 0.9, Math.atan2(vys, vxs), b.spin || 0, 1.35);
  } else drawFootball(g, x, y - b.z * PX * 0.9, 1.3 * (1 + Math.min(b.z || 0, 14) * 0.02), b.spin || 0); // kicks: a bit bigger up high (nearer the camera)
  drawGoalPosts(g, G, true);
  if (b.flight && G.showTarget && !b.flight.pitch) {
    const tx = sx(b.flight.tx), ty = sy(b.flight.ty), pulse = 1 + Math.sin(G.time * 12) * 0.1;
    g.strokeStyle = '#ffe14d'; g.lineWidth = 3; g.setLineDash([5, 5]);
    g.beginPath(); g.ellipse(tx, ty, 18 * pulse, 8 * pulse, 0, 0, 7); g.stroke(); g.setLineDash([]);
  }
}

// throw meter: a bar beside the QB. Green = PERFECT, past it = too hard
function drawMeter(g, G) {
  const m = G.meterV; if (!m || !G.O) return;
  const qb = curPasser ? curPasser() : G.O[0]; if (!qb) return;
  const [v, g0, g1] = m, w = 22, h = 130, x = sx(qb.x) + 48, y = sy(qb.y) - 165;
  g.fillStyle = '#0c1016e8'; g.fillRect(x - 4, y - 4, w + 8, h + 8); g.strokeStyle = '#ffffff55'; g.lineWidth = 2; g.strokeRect(x - 4, y - 4, w + 8, h + 8);
  g.fillStyle = '#ffffff22'; g.fillRect(x, y, w, h);
  g.fillStyle = '#ff6a5a66'; g.fillRect(x, y, w, h * (1 - g1)); // too hard
  g.fillStyle = '#2fd15a'; g.fillRect(x, y + h * (1 - g1), w, h * (g1 - g0)); // the green
  const inG = v >= g0 && v <= g1;
  g.fillStyle = inG ? '#7dff98' : v > g1 ? '#ff6a5a' : '#f6c31c'; g.fillRect(x + 3, y + h * (1 - v), w - 6, h * v);
  g.fillStyle = '#fff'; g.fillRect(x - 6, y + h * (1 - v) - 2, w + 12, 4); // the needle
  g.font = 'italic 900 16px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#000';
  g.strokeText('POWER', x + w / 2, y + h + 20); g.fillStyle = '#fff'; g.fillText('POWER', x + w / 2, y + h + 20);
}
// catch / defense meter: a bar over where the ball lands. Press when the needle hits the green
function drawFlightMeter(g, G) {
  const f = G.ball && G.ball.flight, me = G.humanPlayer; if (!f || f.pitch || f.kick || !me || G.human < 0 || !(f.T > 0)) return;
  const off = G.poss === G.human;
  if (off) { // hold-to-catch bar: only while you're holding
    const v = G.catchV != null ? G.catchV : catchFill(); if (!G.chold && G.catchV == null || f.intended !== me) return;
    const w = 120, h = 12, x = sx(me.x) - w / 2, y = sy(me.y) - 150;
    g.fillStyle = '#0c1016e0'; g.fillRect(x - 4, y - 4, w + 8, h + 8); g.fillStyle = '#ffffff22'; g.fillRect(x, y, w, h);
    const cg = G.chold && G.chold.g || G.catchG || CATCH_GREEN; // shrinks when he's covered
    g.fillStyle = '#2fd15a'; g.fillRect(x + w * cg[0], y, w * (cg[1] - cg[0]), h);
    const inG = v >= cg[0] && v <= cg[1]; g.fillStyle = inG ? '#7dff98' : v > cg[1] ? '#ff6a5a' : '#f6c31c'; g.fillRect(x, y + 3, w * v, h - 6);
    g.fillStyle = '#fff'; g.fillRect(x + w * v - 2, y - 5, 4, h + 10);
    g.font = 'italic 900 15px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#000';
    g.strokeText('CATCH', x + w / 2, y - 9); g.fillStyle = '#fff'; g.fillText('CATCH', x + w / 2, y - 9);
    return;
  }
  const on = defMeterOn() && me.side !== G.poss;
  if (!on || Math.hypot(me.x - f.tx, me.y - f.ty) > METER_NEAR) return; // only when the ball is coming down by your guy
  const u = clamp(f.t / f.T, 0, 1), w = 120, h = 12, x = sx(f.tx) - w / 2, y = sy(f.ty) - 78;
  const done = off ? f.cp : f.dp && f.dp.res;
  g.fillStyle = '#0c1016e0'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
  g.fillStyle = '#ffffff22'; g.fillRect(x, y, w, h);
  const dw = done ? (f.dw || CATCH_WIN) : defWin(me, f); // window size depends on how close you are
  g.fillStyle = '#2fd15a'; g.fillRect(x + w * dw[0], y, w * (dw[1] - dw[0]), h);
  g.fillStyle = off ? '#f6c31c' : '#7fd3ff'; g.fillRect(x, y, w * u, h * 0.35);
  g.fillStyle = '#fff'; g.fillRect(x + w * u - 2, y - 5, 4, h + 10);
  g.font = 'italic 900 15px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#000';
  const t = done ? (done === 'perfect' ? 'PERFECT' : done === 'good' ? 'GOOD' : 'EARLY') : off ? (ctlMobile() ? 'TAP TO CATCH' : 'SPACE TO CATCH') : (ctlMobile() ? 'TAP TO DEFEND' : 'SPACE TO DEFEND');
  g.strokeText(t, x + w / 2, y - 9); g.fillStyle = done === 'perfect' ? '#5dff7a' : '#fff'; g.fillText(t, x + w / 2, y - 9);
}
// drag-back throw aim
function drawAim(g, G) {
  const a = G.aim; if (!a || !G.O) return;
  const qb = curPasser();
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
    if (f.kind === 'dust') { g.fillStyle = G.weather === 'snow' ? `rgba(246,250,255,${a * 0.85})` : G.weather === 'rain' ? `rgba(185,205,225,${a * 0.7})` : `rgba(225,215,180,${a * 0.6})`; g.beginPath(); g.arc(sx(f.x), sy(f.y) - f.z, f.r * (2 - a), 0, 7); g.fill(); }
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
      g.font = `900 ${f.size || 20}px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      // keep floating words off the name tags / throw icons and off each other: nudge up until it's clear (smoothed so it doesn't jump)
      const X = sx(f.x), Y0 = sy(f.y) - 78 - f.z, hw = g.measureText(f.text).width / 2 + 4, hh = (f.size || 20) / 2 + 3;
      let Y = Y0;
      for (let k = 0; k < 8; k++) { const b = tagBoxes.find(b => X + hw > b.x0 && X - hw < b.x1 && Y + hh > b.y0 && Y - hh < b.y1); if (!b) break; Y = b.y0 - hh - 2; }
      f.lift = f.lift == null ? Y0 - Y : lerp(f.lift, Y0 - Y, 0.3);
      const ty = Y0 - f.lift; tagBoxes.push({ x0: X - hw, x1: X + hw, y0: ty - hh, y1: ty + hh });
      g.save(); g.translate(X, ty);
      g.scale(0.5 + pop * 0.5, 0.5 + pop * 0.5);
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

// what's on the line late in a half: ['0:38 LEFT  ·  2 TO', 'NEED A TD', color] (or null when it doesn't matter yet)
function crunchText(G) {
  if (!G.teams || G.demo || !['playcall', 'presnap', 'dead'].includes(G.phase) || G.patSide != null) return null;
  const q = G.quarter, c = Math.max(0, Math.ceil(G.clock));
  const me = G.versus ? G.poss : G.human; if (me == null || me < 0) return null;
  const m = G.score[me] - G.score[1 - me], hasBall = G.poss === me;
  if (q > 4) return ['OVERTIME', 'NEXT SCORE WINS', '#ffd23f'];
  const late = (q === 4 && c <= 120 && Math.abs(m) <= 24) || (q === 2 && c <= 40);
  if (!late) return null;
  const top = `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')} LEFT  ·  ${G.timeouts ? G.timeouts[me] : 0} TO`;
  const who = G.versus && !G.online ? `${pName(me)}: ` : '';
  if (q === 2) return [top, who + (hasBall ? 'POINTS BEFORE HALF' : 'HOLD THEM'), '#fff'];
  if (m < 0) { const d = -m; return [top, who + (d <= 2 ? 'FG WINS IT' : d === 3 ? 'FG TIES IT' : d <= 8 ? 'NEED A TD' : d <= 16 ? 'NEED 2 SCORES' : 'NEED 3 SCORES'), '#ff8a6a']; }
  if (m === 0) return [top, who + (hasBall ? 'SCORE TO WIN' : 'STOP THEM'), '#ffd23f'];
  if (hasBall) return [top, who + (canKneelOut() ? 'KNEEL TO WIN' : `UP ${m}  ·  RUN THE CLOCK`), '#4fe08a'];
  return [top, who + `UP ${m}  ·  ` + (m <= 3 ? 'NO FIELD GOAL' : m <= 8 ? 'NO TOUCHDOWN' : 'KEEP IT IN FRONT'), '#4fe08a'];
}
function drawHUD(g, G) {
  // primetime games (TNF / SNF / MNF / Christmas / Halloween, see primetime.js) get their own colors + a badge at the left end
  const S = typeof bcStyle === 'function' ? bcStyle(G) : null, BW = S ? 64 : 0;
  const W = 640 + BW, x0 = (CW - W) / 2, y0 = 6, H = 46, bx = x0 + BW;
  // the bar + both team boxes only change on a score / timeout / change of possession: painted once and copied
  const T0 = G.teams[0], T1 = G.teams[1], vs = G.versus ? (G.online ? 'o' + G.human : 'v' + G.p1) : '';
  const hk = S && G.bcast === 'HWN' ? null : [S ? G.bcast : '', CW, T0.id, T0.c1, T0.c2, T1.id, T1.c1, T1.c2, G.score[0], G.score[1], G.poss, G.timeouts ? G.timeouts.join() : '', vs, typeof Logo !== 'undefined' ? picId(Logo.canvas(T0, 64)) + picId(Logo.canvas(T1, 64)) : ''].join('|');
  const hc = hk && hudLayer(hk, Math.floor(x0) - 2, W + 5, y0 + H + 4, hg => drawHUDBase(hg, G, S, x0, y0, W, H, bx));
  if (hc) g.drawImage(hc, hc.X0, 0); else drawHUDBase(g, G, S, x0, y0, W, H, bx);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 21px "Barlow Condensed", Arial, sans-serif';
  const q = G.quarter > 4 ? 'OT' : ordinal(G.quarter);
  const c = Math.max(0, Math.ceil(G.clock)), m = Math.floor(c / 60), s = String(c % 60).padStart(2, '0');
  g.fillText(`${q}   ${m}:${s}`, x0 + W - 112, y0 + 16);
  g.font = '800 15px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = S ? S.down : '#ffd23f';
  g.fillText(G.downText(), x0 + W - 112, y0 + 35);
  if (S) {
    bcTrim(g, G.bcast, x0, y0, W, H);
    const bc = G.bcast === 'HWN' ? null : hudLayer('badge|' + G.bcast + '|' + CW, Math.floor(x0) - 2, BW + 4, y0 + H + 2, hg => bcBadge(hg, G.bcast, x0, y0, BW, H));
    if (bc) g.drawImage(bc, bc.X0, 0); else bcBadge(g, G.bcast, x0, y0, BW, H);
  }
  // momentum bar under the two team cells + the road crowd meter on the big downs (rules.js)
  const moOn = !G.mini && !G.demo && G.mo != null;
  if (moOn) drawMomentum(g, bx + 5, y0 + H + (G.bcast === 'XMAS' ? 7 : 1), 405);
  if (moOn && Crowd.show()) drawCrowd(g, x0 + W - 126, y0 + H + (G.bcast === 'XMAS' ? 10 : 4), Crowd.level());
  drawHUDRest(g, G, S, x0, y0, W, H);
}
// a picture of part of the scorebug, painted in screen pixels (keeps any half pixel of the centered bar)
const hudCache = new Map(); let picN = 0;
const picId = c => (c.pid || (c.pid = ++picN)) + ','; // (a logo picture swapped for the real one = new key)
function hudLayer(key, X0, w, h, paint) {
  let c = hudCache.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = w; c.height = h; c.X0 = X0;
    const hg = c.getContext('2d'); if (!hg || !hg.translate) return null;
    hg.translate(-X0, 0); paint(hg);
    if (hudCache.size > 12) hudCache.clear();
    hudCache.set(key, c);
  }
  return c;
}
function drawHUDBase(g, G, S, x0, y0, W, H, bx) {
  if (S) bcBar(g, S, x0, y0, W, H); else { g.fillStyle = '#0b0f16f0'; roundRect(g, x0, y0, W, H, 3); g.fill(); }
  const cell = (t, s, x, poss) => {
    const cg = g.createLinearGradient(x, 0, x + 200, 0); cg.addColorStop(0, t.c1); cg.addColorStop(1, shade(t.c1, -0.3));
    const sl = S && S.slant || 0, shape = () => { if (!sl) return roundRect(g, x, y0 + 4, 200, H - 8, 2); g.beginPath(); g.moveTo(x + sl, y0 + 4); g.lineTo(x + 200, y0 + 4); g.lineTo(x + 200 - sl, y0 + H - 4); g.lineTo(x, y0 + H - 4); g.closePath(); };
    g.fillStyle = cg; shape(); g.fill();
    g.save(); shape(); g.clip(); g.fillStyle = t.c2; g.fillRect(x, y0 + H - 8, 200, 4); g.restore();
    // team name sits high so the timeout bars underneath get their own space
    const ny = y0 + 18;
    g.fillStyle = textOn(t.c1); g.font = 'italic 900 23px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    const lx = typeof Logo !== 'undefined' ? 40 : 10; // little logo at the left of the score cell
    if (lx > 10) g.drawImage(Logo.canvas(t, 64), x + 4, y0 + 6, 34, 34);
    if (S) bcCellDeco(g, G.bcast, x, y0);
    g.fillText(t.id, x + lx, ny);
    if (G.versus) { const tg = G.online ? (G.teams.indexOf(t) === G.human ? 'YOU' : 'OPP') : G.teams.indexOf(t) === G.p1 ? 'P1' : 'P2'; g.font = '800 12px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = tg === 'P1' || tg === 'YOU' ? '#ffe14d' : '#5ad1ff'; g.fillText(tg, x + lx, y0 + 9); g.font = 'italic 900 23px "Barlow Condensed", "Arial Black", sans-serif'; g.fillStyle = textOn(t.c1); }
    if (poss && !(S && bcPoss(g, G.bcast, x + lx + g.measureText(t.id).width + 16, ny))) drawFootball(g, x + lx + g.measureText(t.id).width + 16, ny, 0.9);
    g.font = 'italic 900 36px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'right'; g.fillText(s, x + 192, y0 + H / 2 + 1);
    const side = G.teams.indexOf(t);
    if (G.timeouts) for (let i = 0; i < 3; i++) {
      const tx = x + lx + i * 20, ty = y0 + H - 16;
      if (S && bcPip(g, G.bcast, tx, ty, i < G.timeouts[side])) continue; // candy canes / candy corn
      g.fillStyle = '#00000059'; g.fillRect(tx - 1, ty - 1, 16, 6);
      g.fillStyle = i < G.timeouts[side] ? (S ? S.to : '#ffd23f') : '#ffffff38'; g.fillRect(tx, ty, 14, 4);
    }
  };
  cell(G.teams[1], G.score[1], bx + 5, G.poss === 1);
  cell(G.teams[0], G.score[0], bx + 210, G.poss === 0);
}
function drawHUDRest(g, G, S, x0, y0, W, H) {
  // crunch time: a little tab on the right of the scorebug with the clock, timeouts and what you need
  const sit = crunchText(G);
  if (sit && !G.mini) {
    const tx = x0 + W + 6, tw = 168;
    if (tx + tw < CW - 110) {
      g.fillStyle = S ? S.bar[1] + 'f0' : '#0b0f16f0'; roundRect(g, tx, y0, tw, H, 3); g.fill();
      g.fillStyle = S ? S.acc : '#ffd23f'; g.fillRect(tx, y0, 3, H);
      g.textAlign = 'left'; g.font = '800 13px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#9aa6b5';
      g.fillText(sit[0], tx + 12, y0 + 15);
      g.font = 'italic 900 18px "Barlow Condensed", "Arial Black", sans-serif'; g.fillStyle = sit[2] || '#fff';
      g.fillText(sit[1], tx + 12, y0 + 34);
    }
  }
  // play clock
  if (G.playClock > 0 && (G.phase === 'playcall' || G.phase === 'presnap')) {
    const pc = Math.ceil(G.playClock), red = pc <= 5, py = y0 + H + (G.bcast === 'XMAS' ? 15 : 10); // below the momentum bar (and the Christmas lights)
    g.fillStyle = red ? '#c0141ccc' : S ? S.bar[1] + 'e0' : '#0b0f16e0'; roundRect(g, CW / 2 - 36, py, 72, 26, 2); g.fill();
    g.fillStyle = red ? '#fff' : S ? S.down : '#ffd23f'; g.font = '900 15px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center';
    g.fillText(`:${String(pc).padStart(2, '0')}`, CW / 2, py + 18);
  }
  // your play
  if (G.play && (G.phase === 'presnap' || G.phase === 'live') && !G.demo && (!G.versus || G.online)) {
    const mine = G.poss === G.human ? G.play.off : G.play.def;
    const t = mine.name.toUpperCase();
    g.font = 'bold 14px Barlow, Arial, sans-serif'; const w = g.measureText(t).width + 22;
    g.fillStyle = '#0b0f16d0'; roundRect(g, 10, 10, w, 28, 2); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(t, 21, 29);
    if (coachOn()) { // small Coach Mode tag next to your call
      g.font = 'italic 900 12px "Barlow Condensed", "Arial Black", sans-serif'; const cw = g.measureText('COACH MODE').width + 14;
      g.fillStyle = '#0b0f16d0'; roundRect(g, 16 + w, 13, cw, 22, 2); g.fill();
      g.fillStyle = '#d9a933'; g.fillRect(16 + w, 13, 3, 22); g.fillText('COACH MODE', 24 + w, 28.5);
    }
  }
  // hint + stamina
  if (G.padHint) Pad.drawHint(g);
  else if (G.hint) {
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
  if (Pad.ui && st < 2 && !(G.versus && !G.online)) { // controller: the A / cross glyph instead of SPACE
    const t = st === 0 ? 'TO SET THE POWER' : "WHEN IT'S IN THE GREEN", w = g.measureText(t).width + 30;
    Pad.drawGlyph(g, 0, CW / 2 - w / 2 + 11, y0 + H - 20, 11); g.textAlign = 'left'; g.fillStyle = '#f6c31c'; g.fillText(t, CW / 2 - w / 2 + 30, y0 + H - 14);
  } else
  g.fillText(st === 0 ? `${tap} TO SET THE POWER` : st === 1 ? `${tap} WHEN IT'S IN THE GREEN` : '', CW / 2, y0 + H - 14);
}
