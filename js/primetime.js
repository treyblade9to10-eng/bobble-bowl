// ---- Primetime TV looks: Thursday / Sunday / Monday night, Christmas and Halloween games get their own scorebug + intro ----
// G.bcast: null (normal Sunday afternoon) | 'TNF' | 'SNF' | 'MNF' | 'XMAS' | 'HWN'. Our own drawings, not the real networks' logos.
const BCAST = {
  TNF: { name: 'THURSDAY NIGHT FOOTBALL', short: 'TNF', night: true, bar: ['#2c1156', '#150a2c'], acc: '#1fd6c4', acc2: '#8e52ff', down: '#3fe6d5', to: '#1fd6c4', slant: 9 },
  SNF: { name: 'SUNDAY NIGHT FOOTBALL', short: 'SNF', night: true, bar: ['#142a57', '#0a1631'], acc: '#e2b43b', acc2: '#e2b43b', down: '#f0c75a', to: '#e2b43b', frame: '#e2b43b' },
  MNF: { name: 'MONDAY NIGHT FOOTBALL', short: 'MNF', night: true, bar: ['#191919', '#060606'], acc: '#e01e2b', acc2: '#ffd21a', down: '#ffd21a', to: '#ffd21a', slant: 7 },
  XMAS: { name: 'CHRISTMAS DAY FOOTBALL', tagline: 'DECEMBER 25  ·  HOLIDAY SHOWDOWN', short: 'XMAS', bar: ['#0f4a2a', '#062413'], acc: '#d6202e', acc2: '#f3d36b', down: '#f3d36b', to: '#f3d36b' },
  HWN: { name: 'HALLOWEEN NIGHT FOOTBALL', tagline: 'OCTOBER 31  ·  TRICK OR TREAT', short: 'HALLOWEEN', night: true, bar: ['#1c0b2b', '#07030c'], acc: '#ff7a1a', acc2: '#8f4dff', down: '#ffa34a', to: '#ff7a1a' }
};
function bcStyle(G) { return (G && G.bcast && BCAST[G.bcast]) || null; }
// Christmas: a good chance of snow when the weather was left to chance
function bcWeather(code, w, choice) { return code === 'XMAS' && w === 'clear' && (!choice || choice === 'random') && chance(0.45) ? 'snow' : w; }

// ---------- little drawn icons ----------
const BcIcon = {
  moon(g, x, y, r, col) {
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
    g.beginPath(); g.rect(x - r, y - r, r * 2, r * 2); g.arc(x + r * 0.5, y - r * 0.3, r * 0.82, 0, 7); g.fillStyle = col; g.fill('evenodd'); g.restore();
  },
  star(g, x, y, R, col) {
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = col; g.fill();
  },
  flake(g, x, y, r, col) {
    g.save(); g.translate(x, y); g.strokeStyle = col; g.lineWidth = Math.max(1.2, r / 5); g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r);
      g.moveTo(0, -r * 0.55); g.lineTo(-r * 0.3, -r * 0.8); g.moveTo(0, -r * 0.55); g.lineTo(r * 0.3, -r * 0.8); g.stroke();
    }
    g.restore();
  },
  pumpkin(g, x, y, r) {
    g.save(); g.translate(x, y);
    g.fillStyle = '#3c8a2e'; g.fillRect(-r * 0.12, -r * 1.08, r * 0.24, r * 0.4);
    g.fillStyle = '#d35d0e'; g.beginPath(); g.ellipse(-r * 0.45, 0, r * 0.55, r * 0.78, 0, 0, 7); g.ellipse(r * 0.45, 0, r * 0.55, r * 0.78, 0, 0, 7); g.fill();
    g.fillStyle = '#ff8a24'; g.beginPath(); g.ellipse(0, 0, r * 0.6, r * 0.82, 0, 0, 7); g.fill();
    g.fillStyle = '#2a1204'; g.beginPath();
    g.moveTo(-r * 0.5, -r * 0.12); g.lineTo(-r * 0.2, -r * 0.12); g.lineTo(-r * 0.35, -r * 0.4); g.closePath();
    g.moveTo(r * 0.5, -r * 0.12); g.lineTo(r * 0.2, -r * 0.12); g.lineTo(r * 0.35, -r * 0.4); g.closePath();
    g.moveTo(-r * 0.55, r * 0.18); g.lineTo(-r * 0.3, r * 0.42); g.lineTo(-r * 0.1, r * 0.28); g.lineTo(r * 0.1, r * 0.42); g.lineTo(r * 0.3, r * 0.28); g.lineTo(r * 0.55, r * 0.18); g.lineTo(r * 0.3, r * 0.55); g.lineTo(-r * 0.3, r * 0.55); g.closePath();
    g.fill(); g.restore();
  },
  // jack-o'-lantern with a flickering candle glow behind the face
  lantern(g, x, y, r, t = 0) {
    const fl = 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3);
    g.save(); g.translate(x, y);
    const gl = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.9); gl.addColorStop(0, `rgba(255,150,30,${0.55 * fl})`); gl.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r * 1.9, 0, 7); g.fill();
    g.fillStyle = '#3c8a2e'; g.beginPath(); g.moveTo(-r * 0.1, -r * 0.7); g.quadraticCurveTo(r * 0.05, -r * 1.25, r * 0.32, -r * 1.12); g.lineTo(r * 0.12, -r * 0.7); g.fill();
    g.fillStyle = '#c4500b'; g.beginPath(); g.ellipse(-r * 0.48, r * 0.04, r * 0.55, r * 0.78, 0, 0, 7); g.ellipse(r * 0.48, r * 0.04, r * 0.55, r * 0.78, 0, 0, 7); g.fill();
    g.fillStyle = '#ff8a1f'; g.beginPath(); g.ellipse(0, r * 0.02, r * 0.62, r * 0.84, 0, 0, 7); g.fill();
    g.strokeStyle = '#c4500b'; g.lineWidth = Math.max(1, r * 0.07); g.beginPath(); g.moveTo(-r * 0.25, -r * 0.7); g.quadraticCurveTo(-r * 0.4, 0, -r * 0.25, r * 0.78); g.moveTo(r * 0.25, -r * 0.7); g.quadraticCurveTo(r * 0.4, 0, r * 0.25, r * 0.78); g.stroke();
    g.fillStyle = `rgb(255,${200 + 40 * fl | 0},${60 + 60 * fl | 0})`; g.beginPath();
    g.moveTo(-r * 0.55, -r * 0.05); g.lineTo(-r * 0.18, -r * 0.05); g.lineTo(-r * 0.36, -r * 0.38); g.closePath();
    g.moveTo(r * 0.55, -r * 0.05); g.lineTo(r * 0.18, -r * 0.05); g.lineTo(r * 0.36, -r * 0.38); g.closePath();
    g.moveTo(-r * 0.1, r * 0.08); g.lineTo(r * 0.1, r * 0.08); g.lineTo(0, r * 0.24); g.closePath();
    g.moveTo(-r * 0.62, r * 0.28); g.lineTo(-r * 0.38, r * 0.5); g.lineTo(-r * 0.2, r * 0.36); g.lineTo(0, r * 0.52); g.lineTo(r * 0.2, r * 0.36); g.lineTo(r * 0.38, r * 0.5); g.lineTo(r * 0.62, r * 0.28); g.lineTo(r * 0.4, r * 0.68); g.lineTo(-r * 0.4, r * 0.68); g.closePath();
    g.fill(); g.restore();
  },
  ghost(g, x, y, r, a = 1) {
    g.save(); g.translate(x, y); g.globalAlpha *= a;
    g.fillStyle = '#f2eefc'; g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.lineTo(r, r * 1.3);
    for (let i = 0; i < 4; i++) { const x1 = r - (i + 0.5) * r / 2, x2 = r - (i + 1) * r / 2; g.quadraticCurveTo(x1, r * (i % 2 ? 1.6 : 1.0), x2, r * 1.3); }
    g.closePath(); g.fill();
    g.fillStyle = '#1b0f2a'; g.beginPath(); g.ellipse(-r * 0.35, -r * 0.05, r * 0.16, r * 0.24, 0, 0, 7); g.ellipse(r * 0.35, -r * 0.05, r * 0.16, r * 0.24, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(0, r * 0.45, r * 0.14, r * 0.2, 0, 0, 7); g.fill();
    g.restore();
  },
  web(g, x, y, R, flipX = 1) { // a corner spiderweb, (x, y) = the corner
    g.save(); g.translate(x, y); g.scale(flipX, 1); g.strokeStyle = '#ffffff40'; g.lineWidth = 1;
    const A = [0, 0.4, 0.8, 1.2, Math.PI / 2];
    for (const a of A) { g.beginPath(); g.moveTo(0, 0); g.lineTo(-Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
    for (const k of [0.35, 0.6, 0.85]) { g.beginPath(); A.forEach((a, i) => { const px = -Math.cos(a) * R * k, py = Math.sin(a) * R * k; if (!i) g.moveTo(px, py); else { const pa = A[i - 1], m = (a + pa) / 2; g.quadraticCurveTo(-Math.cos(m) * R * k * 0.82, Math.sin(m) * R * k * 0.82, px, py); } }); g.stroke(); }
    g.restore();
  },
  spider(g, x, y, s) {
    g.save(); g.translate(x, y); g.strokeStyle = '#c9b6e4'; g.fillStyle = '#c9b6e4'; g.lineWidth = 1.1;
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sd * s * 1.1, -s * 0.6 + i * s * 0.45, sd * s * 1.6, -s * 0.1 + i * s * 0.5); g.stroke(); }
    g.beginPath(); g.ellipse(0, 0, s * 0.55, s * 0.7, 0, 0, 7); g.fill();
    g.fillStyle = '#ff7a1a'; g.fillRect(-s * 0.25, -s * 0.2, s * 0.15, s * 0.15); g.fillRect(s * 0.1, -s * 0.2, s * 0.15, s * 0.15);
    g.restore();
  },
  wreath(g, x, y, r) {
    g.save(); g.translate(x, y);
    g.strokeStyle = '#1f7a3a'; g.lineWidth = r * 0.42; g.beginPath(); g.arc(0, 0, r * 0.75, 0, 7); g.stroke();
    g.strokeStyle = '#2f9a4f'; g.lineWidth = r * 0.14; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.arc(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, r * 0.18, a, a + 2.4); g.stroke(); }
    g.fillStyle = '#ff3b3b'; for (const a of [0.5, 2.2, 3.6, 5.1]) { g.beginPath(); g.arc(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.11, 0, 7); g.fill(); }
    g.fillStyle = '#d6202e'; g.beginPath(); g.moveTo(0, r * 0.72); g.lineTo(-r * 0.42, r * 0.5); g.lineTo(-r * 0.42, r * 0.98); g.closePath(); g.moveTo(0, r * 0.72); g.lineTo(r * 0.42, r * 0.5); g.lineTo(r * 0.42, r * 0.98); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-r * 0.08, r * 0.78); g.lineTo(-r * 0.3, r * 1.25); g.lineTo(-r * 0.12, r * 1.15); g.closePath(); g.moveTo(r * 0.08, r * 0.78); g.lineTo(r * 0.3, r * 1.25); g.lineTo(r * 0.12, r * 1.15); g.closePath(); g.fill();
    g.beginPath(); g.arc(0, r * 0.72, r * 0.12, 0, 7); g.fillStyle = '#ff4a55'; g.fill();
    g.restore();
  },
  ornament(g, x, y, r, col = '#d6202e') {
    g.save(); g.translate(x, y);
    g.fillStyle = '#e2c25a'; g.fillRect(-r * 0.32, -r * 1.2, r * 0.64, r * 0.36);
    g.strokeStyle = '#e2c25a'; g.lineWidth = 1; g.beginPath(); g.arc(0, -r * 1.35, r * 0.2, 0, 7); g.stroke();
    const og = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r); og.addColorStop(0, '#fff'); og.addColorStop(0.25, col); og.addColorStop(1, shade(col, -0.45));
    g.fillStyle = og; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.strokeStyle = '#f3d36b'; g.lineWidth = r * 0.16; g.beginPath(); g.moveTo(-r * 0.92, r * 0.1); g.quadraticCurveTo(0, r * 0.45, r * 0.92, r * 0.1); g.stroke();
    g.restore();
  },
  hat(g, x, y, s) { // a Santa hat sitting on the top-left of a logo
    g.save(); g.translate(x, y); g.rotate(-0.35);
    g.fillStyle = '#d6202e'; g.beginPath(); g.moveTo(-s * 0.95, 0); g.quadraticCurveTo(-s * 0.4, -s * 1.3, s * 0.9, -s * 0.9); g.quadraticCurveTo(s * 0.5, -s * 0.55, s * 0.85, 0); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 0.98, -s * 0.86, s * 0.26, 0, 7); g.fill();
    g.beginPath(); g.ellipse(-s * 0.05, 0, s * 1.02, s * 0.24, 0, 0, 7); g.fill();
    g.restore();
  },
  bat(g, x, y, s, col, flap = 1) {
    const R = [[0, -2.5], [1, -4.3], [1.8, -2.2], [5, -4.6], [10, -3], [8.6, -1.2], [7.2, 0.3], [5.6, -0.6], [4, 1.3], [2.4, 0.4], [0, 2.6]];
    g.save(); g.translate(x, y); g.scale(s, s * flap); g.beginPath();
    R.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); for (let i = R.length - 2; i > 0; i--) g.lineTo(-R[i][0], R[i][1]);
    g.closePath(); g.fillStyle = col; g.fill(); g.restore();
  }
};

// the show's badge: a small block at the left end of the scorebug (also used on the intro, replays and highlights)
function bcBadge(g, code, x, y, w, h) {
  const S = BCAST[code]; if (!S) return;
  const HD = '"Barlow Condensed", "Arial Black", sans-serif';
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  const bg = g.createLinearGradient(x, y, x + w, y + h);
  const word = (txt, px, col, yy) => { g.font = `italic 900 ${px}px ${HD}`; g.fillStyle = col; g.fillText(txt, x + w / 2, yy, w - 8); };
  if (code === 'TNF') {
    bg.addColorStop(0, '#7a3cf0'); bg.addColorStop(1, '#22105a'); g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = S.acc; g.fillRect(x, y + h - 4, w, 4);
    BcIcon.moon(g, x + w - 12, y + 11, 6, '#e9f7ff');
    word('TNF', h * 0.5, '#fff', y + h * 0.56);
  } else if (code === 'SNF') {
    bg.addColorStop(0, '#1d3a78'); bg.addColorStop(1, '#0a1631'); g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.strokeStyle = S.acc; g.lineWidth = 1.5; g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
    BcIcon.star(g, x + w / 2, y + h * 0.3, h * 0.15, S.acc);
    word('SNF', h * 0.4, S.acc, y + h * 0.68);
  } else if (code === 'MNF') {
    g.fillStyle = '#c8101d'; g.fillRect(x, y, w, h);
    g.fillStyle = S.acc2; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + 10, y); g.lineTo(x + 16, y); g.lineTo(x + 6, y + h); g.fill();
    g.fillStyle = '#0005'; g.fillRect(x, y + h - 5, w, 5);
    word('MNF', h * 0.5, '#fff', y + h * 0.48);
  } else if (code === 'XMAS') {
    bg.addColorStop(0, '#e2283a'); bg.addColorStop(1, '#8e0f1c'); g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = '#ffffff22'; g.lineWidth = 5; // candy-cane stripes
    for (let i = -h; i < w; i += 13) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke(); } g.restore();
    BcIcon.wreath(g, x + w / 2, y + h * 0.3, h * 0.2);
    word('DEC 25', h * 0.3, '#fff', y + h * 0.8);
  } else if (code === 'HWN') {
    const hb = g.createLinearGradient(x, y, x, y + h); hb.addColorStop(0, '#2a0f3d'); hb.addColorStop(1, '#0b0410'); g.fillStyle = hb; g.fillRect(x, y, w, h);
    BcIcon.lantern(g, x + w / 2, y + h * 0.38, h * 0.25, G.time || 0);
    word('OCT 31', h * 0.3, S.acc, y + h * 0.82);
    g.fillStyle = S.acc; g.fillRect(x, y + h - 2, w, 2);
  }
  g.restore();
}

const BADGE_W = 64; // the show badge at the left end of the scorebug (draw.js BW)
// themed bits inside the team boxes: Christmas = Santa hats, ornament for the ball, candy-cane timeouts; Halloween = jack-o'-lantern ball, candy-corn timeouts
function bcCellDeco(g, code, x, y0) { if (code === 'XMAS') BcIcon.hat(g, x + 13, y0 + 11, 8); }
function bcPoss(g, code, x, y) {
  if (code === 'XMAS') { BcIcon.ornament(g, x, y + 1, 6.5); return true; }
  if (code === 'HWN') { BcIcon.lantern(g, x, y + 1, 7.5, (G.time || 0) + 1.3); return true; }
  return false;
}
function bcPip(g, code, tx, ty, on) {
  if (code === 'XMAS') {
    g.fillStyle = on ? '#fff' : '#ffffff30'; g.fillRect(tx, ty, 14, 4);
    if (on) { g.save(); g.beginPath(); g.rect(tx, ty, 14, 4); g.clip(); g.fillStyle = '#d6202e'; for (let i = -4; i < 14; i += 5) { g.beginPath(); g.moveTo(tx + i, ty + 4); g.lineTo(tx + i + 3, ty); g.lineTo(tx + i + 5, ty); g.lineTo(tx + i + 2, ty + 4); g.fill(); } g.restore(); }
    return true;
  }
  if (code === 'HWN') {
    g.save(); g.globalAlpha = on ? 1 : 0.25; g.beginPath(); g.moveTo(tx + 1, ty + 5); g.lineTo(tx + 13, ty + 5); g.lineTo(tx + 7, ty - 4); g.closePath(); g.clip();
    g.fillStyle = '#ffd23f'; g.fillRect(tx, ty + 2, 14, 4); g.fillStyle = '#ff7a1a'; g.fillRect(tx, ty - 1.5, 14, 3.6); g.fillStyle = '#fff6e0'; g.fillRect(tx, ty - 5, 14, 3.6);
    g.restore(); return true;
  }
  return false;
}

// scorebug background + trim for the special shows
function bcBar(g, S, x0, y0, W, H) {
  const bg = g.createLinearGradient(0, y0, 0, y0 + H); bg.addColorStop(0, S.bar[0]); bg.addColorStop(1, S.bar[1]);
  g.fillStyle = bg; roundRect(g, x0, y0, W, H, 3); g.fill();
  if (S === BCAST.HWN) { const gl = g.createRadialGradient(x0 + W - 112, y0 + H, 4, x0 + W - 112, y0 + H, 120); gl.addColorStop(0, '#ff7a1a40'); gl.addColorStop(1, '#ff7a1a00'); g.fillStyle = gl; g.fillRect(x0 + W - 240, y0, 240, H); }
}
function bcTrim(g, code, x0, y0, W, H) {
  const S = BCAST[code], t = G.time || 0;
  g.save();
  if (code === 'SNF') { g.strokeStyle = S.frame; g.lineWidth = 1.5; roundRect(g, x0 + 0.75, y0 + 0.75, W - 1.5, H - 1.5, 3); g.stroke(); }
  else if (code === 'TNF') { const lg = g.createLinearGradient(x0, 0, x0 + W, 0); lg.addColorStop(0, S.acc2); lg.addColorStop(1, S.acc); g.fillStyle = lg; g.fillRect(x0, y0 + H - 2, W, 3); }
  else if (code === 'MNF') { g.fillStyle = S.acc; g.fillRect(x0, y0 + H - 3, W, 3); g.fillStyle = S.acc2; g.fillRect(x0, y0 + H, W, 1.5); }
  else if (code === 'HWN') {
    // orange goo along the bottom (slow drips), a cobweb + spider in the corner, flapping bats, a ghost peeking out
    g.fillStyle = S.acc; g.fillRect(x0, y0 + H - 2, W, 2.5);
    const dr = [0.62, 0.7, 0.79, 0.86, 0.93];
    dr.forEach((f, i) => {
      const dx = x0 + W * f, len = 6 + 5 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 2.1)) + (i % 2) * 3;
      g.beginPath(); g.moveTo(dx - 3, y0 + H); g.quadraticCurveTo(dx - 2, y0 + H + len * 0.6, dx, y0 + H + len); g.quadraticCurveTo(dx + 2, y0 + H + len * 0.6, dx + 3, y0 + H); g.fill();
      g.beginPath(); g.arc(dx, y0 + H + len, 2.8, 0, 7); g.fill();
    });
    BcIcon.web(g, x0 + W - 1, y0 + 1, 26);
    const sy = y0 + 22 + Math.sin(t * 1.3) * 4; g.strokeStyle = '#ffffff55'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x0 + W - 14, y0 + 2); g.lineTo(x0 + W - 14, sy); g.stroke();
    BcIcon.spider(g, x0 + W - 14, sy + 2, 3.6);
    const fl = 0.55 + 0.45 * Math.abs(Math.sin(t * 9));
    BcIcon.bat(g, x0 + W - 52 + Math.sin(t * 0.8) * 6, y0 + 11 + Math.sin(t * 2.1) * 2, 1.3, S.acc2, fl);
    BcIcon.bat(g, x0 + W - 74 + Math.sin(t * 0.6 + 2) * 5, y0 + 7 + Math.sin(t * 1.7 + 1) * 1.5, 0.85, S.acc2 + 'bb', 0.55 + 0.45 * Math.abs(Math.sin(t * 10 + 1)));
    const gp = 0.5 + 0.5 * Math.sin(t * 0.7); // the ghost slowly rises out from under the bar, then hides again
    g.save(); g.beginPath(); g.rect(x0 + W - 46, y0 + H, 40, 30); g.clip();
    BcIcon.ghost(g, x0 + W - 28, y0 + H + 1 + gp * 7 + Math.sin(t * 3) * 0.8, 7.5, 0.95); g.restore();
  } else if (code === 'XMAS') {
    // a little snow on top, a string of lights along the bottom
    g.fillStyle = '#f4f8ff'; g.beginPath(); g.moveTo(x0 + 3, y0 + 2);
    for (let x = x0 + 3; x < x0 + W - 3; x += 12) { const b = 3 + hashStr('sn' + Math.round(x - x0)) % 4; g.quadraticCurveTo(x + 6, y0 - b, Math.min(x0 + W - 3, x + 12), y0 + 1); }
    g.lineTo(x0 + W - 3, y0 + 3.5); g.lineTo(x0 + 3, y0 + 3.5); g.closePath(); g.fill();
    g.save(); g.beginPath(); g.rect(x0 + BADGE_W, y0 + H - 3, W - BADGE_W, 3); g.clip(); g.fillStyle = '#fff'; g.fillRect(x0, y0 + H - 3, W, 3); g.fillStyle = '#d6202e'; // candy-cane edge
    for (let x = x0 + BADGE_W - 6; x < x0 + W; x += 10) { g.beginPath(); g.moveTo(x, y0 + H); g.lineTo(x + 4, y0 + H - 3); g.lineTo(x + 9, y0 + H - 3); g.lineTo(x + 5, y0 + H); g.fill(); } g.restore();
    const cols = ['#ff4040', '#3fdc78', '#ffd23f', '#5ab8ff'], yb = y0 + H;
    g.strokeStyle = '#0a2214'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + 4, yb);
    for (let x = x0 + 4; x < x0 + W - 4; x += 30) g.quadraticCurveTo(x + 15, yb + 5, Math.min(x0 + W - 4, x + 30), yb);
    g.stroke();
    let i = 0;
    for (let x = x0 + 19; x < x0 + W - 8; x += 30, i++) {
      const a = 0.65 + 0.35 * Math.sin(t * 1.6 + i * 1.7);
      g.globalAlpha = a; g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(x, yb + 5.5, 2.3, 3.2, 0, 0, 7); g.fill();
      g.globalAlpha = a * 0.35; g.beginPath(); g.arc(x, yb + 5.5, 5.5, 0, 7); g.fill();
    }
  }
  g.restore();
}

// ---------- Season: tag the real-feeling TV slots (1 Thursday, 1 Sunday night, 1 Monday night a week + holidays) ----------
// Tags are stored on the schedule the first time they're needed, so old saved seasons get them too. Deterministic (no Math.random).
const SeasonBC = {
  weeks(n) { return { hw: n >= 6 ? Math.round(n * 7 / 17) : -1, cw: n >= 6 ? n - 2 : -1 }; }, // Halloween ~ week 8 of 17, Christmas the next-to-last week
  ensure(d) {
    if (!d || !d.weeks || d.bcv === 1) return;
    const n = d.weeks.length, { hw, cw } = this.weeks(n), seen = {}, byId = id => TEAMS.find(t => t.id === id);
    const ovr = id => { try { return Season.ovr(id); } catch (e) { return 75; } };
    d.weeks.forEach((wk, w) => {
      const slots = w === cw ? ['XMAS', 'XMAS', 'SNF', 'MNF'] : w === hw ? ['SNF', 'MNF', 'HWN'] : ['SNF', 'MNF', 'TNF'];
      const sc = wk.map((m, i) => {
        if (!m || !m.home || !m.away) return [-1e9, i];
        const riv = isRivalry(byId(m.home), byId(m.away)) ? 5 : 0, mine = i === 0 ? 3 : 0;
        const rep = ((seen[m.home] || 0) + (seen[m.away] || 0)) * 3.5, noise = (hashStr(`${d.year || 1}:${w}:${m.home}${m.away}`) % 1000) / 1000 * 7;
        return [ovr(m.home) + ovr(m.away) + riv + mine + noise - rep, i];
      }).sort((a, b) => b[0] - a[0]);
      for (const m of wk) if (m) delete m.bc;
      slots.forEach((s, k) => { const e = sc[k]; if (!e || e[0] < -1e8) return; const m = wk[e[1]]; m.bc = s; seen[m.home] = (seen[m.home] || 0) + 1; seen[m.away] = (seen[m.away] || 0) + 1; });
    });
    d.bcv = 1;
    try { Season.save(); } catch (e) {}
  },
  // tag of one game (gi = index in the week, 0 = yours)
  of(d, w, gi) { if (!d) return null; this.ensure(d); const m = d.weeks && d.weeks[w] && d.weeks[w][gi || 0]; return (m && BCAST[m.bc]) ? m.bc : null; },
  tag(code) { return BCAST[code] ? `<b class="bcTag bc${code}">${BCAST[code].short}</b>` : ''; }
};

// hub: tags on the schedule list + the next-game card
{ const _hub = renderHub; renderHub = function () {
  const d = Season.data; try { SeasonBC.ensure(d); } catch (e) { console.warn('bc tags', e); }
  _hub();
  if (!d || !d.weeks) return;
  const rows = $('shSched').querySelectorAll('.wkrow');
  d.weeks.forEach((wk, i) => { const c = wk[0] && wk[0].bc, sp = rows[i] && rows[i].querySelector('span'); if (c && sp) sp.insertAdjacentHTML('beforeend', ' ' + SeasonBC.tag(c)); });
  const c = d.phase === 'regular' ? SeasonBC.of(d, d.week, 0) : null, lbl = $('shNext').querySelector('.lbl');
  if (c && lbl && Season.myGame()) {
    lbl.innerHTML = SeasonBC.tag(c) + ' ' + lbl.innerHTML.replace(/^NEXT GAME/, BCAST[c].name);
    const sub = $('shNext').querySelector('.sub'); // the tag already says it's a night game
    if (sub && BCAST[c].night) sub.innerHTML = sub.innerHTML.replace('Night game, ', '').replace('  •  Night game', '');
  }
}; }

// Quick Game / online: the BROADCAST setting (AUTO and SUNDAY = the normal look)
function quickBcast() { const v = $('optBcast') && $('optBcast').value; return BCAST[v] ? v : null; }
