// ---- Weather + night games: how it looks and how it changes the game ----
// G.weather: 'clear' | 'rain' | 'snow'.  G.night: true/false.
const WEATHER = [['clear', 'Clear'], ['rain', 'Rain'], ['storm', 'Storm'], ['snow', 'Snow'], ['fog', 'Fog'], ['random', 'Random']];
const wet = () => G.weather === 'rain' || G.weather === 'snow';

function pickWeather(choice, week, games) {
  if (choice && choice !== 'random') return choice;
  const late = week != null && games ? week >= games / 2 : chance(0.5);
  const r = Math.random();
  return r < 0.11 ? 'rain' : r < 0.15 ? 'storm' : r < 0.19 ? 'fog' : r < (late ? 0.32 : 0.22) ? 'snow' : 'clear';
}

// gameplay knobs (used by the engine)
const Weather = {
  speed: () => G.weather === 'snow' ? 0.95 : 1,          // top speed
  grip: () => G.weather === 'snow' ? 0.7 : G.weather === 'rain' ? 0.86 : 1, // acceleration / cutting
  catchPenalty: () => G.weather === 'rain' ? 0.07 : G.weather === 'snow' ? 0.05 : 0,
  fumbleBonus: () => wet() ? 0.02 : 0,
  slipChance: () => G.weather === 'snow' ? 0.15 : G.weather === 'rain' ? 0.1 : 0,   // on a juke
  cutSlip: () => G.weather === 'snow' ? 0.022 : G.weather === 'rain' ? 0.014 : 0,    // on any hard cut at full speed
  kickRange: () => G.weather === 'snow' ? -4 : G.weather === 'rain' ? -2 : 0
};

// ---------- slipping ----------
// a hard cut or a hard stop at full speed on a wet/snowy field can take your feet out. Anyone can slip: you, the CPU, the guy covering your receiver
function cutSlip(p, dt) {
  p.slipCd = Math.max(0, (p.slipCd || 0) - dt);
  if (!wet() || G.phase !== 'live' || p.slipCd > 0 || p.engaged || p.jump > 0) return false;
  const v = Math.hypot(p.vx, p.vy), want = Math.hypot(p.dvx, p.dvy);
  if (v < p.spd * 0.8) return false;
  const cos = want < 0.6 ? -1 : (p.vx * p.dvx + p.vy * p.dvy) / (v * want);
  if (cos > 0) return false;            // only cuts of 90 degrees or more (or slamming on the brakes)
  p.slipCd = 0.8;                        // one roll of the dice per cut
  const agile = clamp(1.25 - (p.ovr - 60) / 80, 0.7, 1.3); // better players keep their feet more often
  if (!chance(Weather.cutSlip() * agile * (p.sprinting ? 1.35 : 1))) return false;
  slipDown(p); return true;
}
function slipDown(p) {
  p.down = 0.65 + rand(0, 0.25); p.slip = p.down;
  p.downDir = -(Math.sign(p.vx) || p.face.dir); // feet fly out in front, he lands on his back
  p.vx *= 0.85; p.vy *= 0.85; p.dvx = p.dvy = 0; p.dive = 0; p.mouth = 'O'; p.mouthT = 0.9;
  if (p.engaged) unlink(p, p.engaged);
  G.slips = (G.slips || 0) + 1;
  const car = G.ball && G.ball.holder;
  if (p.isHuman || p === car || (car && dist(p, car) < 7)) { addText(p.x, p.y, 'SLIPPED!', '#cfe3ff', 18, 0.8); Sound.boing(); }
  addDust(p.x, p.y, 8); groundMark(p.x, p.y, 1.6, true);
}

// ---------- the ground: snow cover that gets trampled, or a soaked field with puddles + mud ----------
let wxCv = null;
const wxGx = x => (x + FIELD_PAD_X) * PX, wxGy = y => (y + FIELD_PAD_TOP) * PY;
function buildWxGround(G) {
  if (typeof document === 'undefined' || !fieldCv) return;
  const W = fieldCv.width, H = fieldCv.height;
  wxCv = wxCv && wxCv.width === W && wxCv.height === H ? wxCv : document.createElement('canvas');
  wxCv.width = W; wxCv.height = H; wxCv.owner = G.dirt; wxCv.kind = G.weather;
  const g = wxCv.getContext('2d'); g.clearRect(0, 0, W, H);
  const top = wxGy(-1.2), R = (a, b) => a + Math.random() * (b - a);
  wxCv.puddles = [];
  if (G.weather === 'snow') {
    g.fillStyle = 'rgba(244,248,255,0.12)'; g.fillRect(0, 0, W, top);           // snow in the stands
    g.fillStyle = 'rgba(240,246,255,0.5)'; g.fillRect(0, top, W, H - top);     // a blanket on the field
    // soft uneven cover: blurry blobs (thicker in some spots, thinner in others) + fine sparkle
    const blob = document.createElement('canvas'); blob.width = blob.height = 64;
    const bg = blob.getContext('2d'), rg = bg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); bg.fillStyle = rg; bg.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 900; i++) { const w = R(50, 170); g.globalAlpha = R(0.05, 0.2); g.drawImage(blob, R(-40, W), R(top - 20, H), w, w * 0.4); }
    g.globalAlpha = 1;
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '200,214,232'},${R(0.15, 0.45)})`; g.fillRect(R(0, W), R(top, H), 1.5, 1.5); }
    for (let i = 0; i < 70; i++) {                                           // drifts piled along the sidelines + back of the end zones
      const side = i % 2, y = side ? R(FIELD_W - 1, FIELD_W + FIELD_PAD_BOT) : R(-1.2, 1.2), x = R(-FIELD_PAD_X, 120 + FIELD_PAD_X);
      const dg = g.createRadialGradient(wxGx(x), wxGy(y), 2, wxGx(x), wxGy(y), R(40, 90));
      dg.addColorStop(0, 'rgba(255,255,255,0.75)'); dg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = dg; g.fillRect(wxGx(x) - 90, wxGy(y) - 90, 180, 180);
    }
    for (const ex of [0, 120]) for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(wxGx(ex + (ex ? 1 : -1) * R(0.5, 4)), wxGy(R(0, FIELD_W)), R(40, 80), R(14, 26), 0, 0, 7); g.fill(); }
  } else if (G.weather === 'rain') {
    g.fillStyle = 'rgba(6,18,26,0.24)'; g.fillRect(0, top, W, H - top);        // soaked, darker grass
    for (let i = 0; i < 26; i++) {                                           // chewed-up mud between the hashes
      const x = R(15, 105), y = R(18, 35);
      g.fillStyle = `rgba(74,52,30,${R(0.08, 0.2)})`; g.beginPath(); g.ellipse(wxGx(x), wxGy(y), R(20, 60), R(8, 20), R(-0.3, 0.3), 0, 7); g.fill();
    }
    for (let i = 0; i < 16; i++) {                                           // standing water
      const x = R(4, 116), y = R(3, FIELD_W - 3), rx = R(1.6, 4.2) * PX, ry = R(0.9, 2) * PY;
      wxCv.puddles.push({ x, y, rx, ry });
      const pg = g.createRadialGradient(wxGx(x) - rx * 0.2, wxGy(y) - ry * 0.3, 2, wxGx(x), wxGy(y), rx);
      pg.addColorStop(0, 'rgba(120,150,175,0.5)'); pg.addColorStop(0.7, 'rgba(40,62,80,0.5)'); pg.addColorStop(1, 'rgba(30,45,55,0)');
      g.save(); g.translate(wxGx(x), wxGy(y)); g.scale(1, ry / rx); g.translate(-wxGx(x), -wxGy(y));
      g.fillStyle = pg; g.beginPath(); g.arc(wxGx(x), wxGy(y), rx, 0, 7); g.fill(); g.restore();
      g.strokeStyle = 'rgba(220,235,255,0.35)'; g.lineWidth = 2; g.lineCap = 'round';  // stadium lights reflecting
      g.beginPath(); g.moveTo(wxGx(x) - rx * 0.45, wxGy(y) - ry * 0.25); g.lineTo(wxGx(x) + rx * 0.1, wxGy(y) - ry * 0.4); g.stroke();
    }
  }
}
// a footprint / slide mark on the ground (snow gets packed down to the grass, rain churns up mud)
function groundMark(x, y, r, big) {
  if (!wxCv || wxCv.owner !== G.dirt || wxCv.kind !== G.weather) return;
  const g = wxCv.getContext('2d'), px = wxGx(x + rand(-0.25, 0.25)), py = wxGy(y + rand(-0.2, 0.2));
  if (G.weather === 'snow') {
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = `rgba(0,0,0,${big ? 0.3 : 0.16})`;
    g.beginPath(); g.ellipse(px, py, r * PX * 0.5, r * PY * 0.4, 0, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
  } else {
    g.fillStyle = `rgba(66,46,26,${big ? 0.22 : 0.07})`;
    g.beginPath(); g.ellipse(px, py, r * PX * 0.5, r * PY * 0.4, 0, 0, 7); g.fill();
  }
}

function drawWeatherGround(g, G) {
  if (!wet() || G.demo) return;
  if (!wxCv || wxCv.owner !== G.dirt || wxCv.kind !== G.weather) buildWxGround(G);
  if (wxCv) blitWorld(g, wxCv);
}

// falling rain / snow + the night lighting, drawn over the field and players
function windLean() { return G.wind ? G.wind.dir * Math.min(1, G.wind.mph / 14) : 0.35; }
function drawWeather(g, G) {
  if (G.demo) return;
  const t = G.time, lean = windLean();
  if (G.weather === 'rain') {
    // gloomy sky + mist rolling off the stands
    g.fillStyle = 'rgba(20,32,48,0.18)'; g.fillRect(0, 0, CW, CH);
    const mist = g.createLinearGradient(0, 0, 0, CH * 0.45); mist.addColorStop(0, 'rgba(170,185,205,0.32)'); mist.addColorStop(1, 'rgba(170,185,205,0)');
    g.fillStyle = mist; g.fillRect(0, 0, CW, CH * 0.45);
    // rings in the puddles
    if (wxCv && wxCv.puddles) for (const pd of wxCv.puddles) {
      const x = sx(pd.x), y = sy(pd.y); if (x < -pd.rx || x > CW + pd.rx) continue;
      for (let k = 0; k < 3; k++) {
        const u = (t * 1.6 + k * 0.33 + pd.x * 0.13) % 1, ox = Math.sin(pd.y * 7 + k * 2 + Math.floor(t * 1.6 + k * 0.33 + pd.x * 0.13) * 3.1) * pd.rx * 0.45;
        g.strokeStyle = `rgba(215,230,250,${0.5 * (1 - u)})`; g.lineWidth = 1.3;
        g.beginPath(); g.ellipse(x + ox, y, 2 + u * 12, 1 + u * 5, 0, 0, 7); g.stroke();
      }
    }
    // splashes hitting the turf
    g.strokeStyle = 'rgba(210,225,245,0.55)'; g.lineWidth = 1.2; g.beginPath();
    for (let i = 0; i < 46; i++) {
      const cyc = t * 3 + i * 0.37, u = cyc % 1, n = Math.floor(cyc), h = hashStr(i + ':' + n);
      const x = (h % 1000) / 1000 * CW, y = CH * 0.25 + ((h >> 10) % 1000) / 1000 * CH * 0.75, s = 2 + u * 6;
      if (u > 0.6) continue;
      g.moveTo(x - s, y - s * 0.9); g.lineTo(x - s * 0.3, y); g.moveTo(x + s, y - s * 0.9); g.lineTo(x + s * 0.3, y); g.moveTo(x, y - s * 1.2); g.lineTo(x, y - s * 0.3);
    }
    g.stroke();
    // two layers of rain: thin far-off sheets + fat close drops, both pushed by the wind (a storm dumps twice as much)
    const heavy = G.storm ? 1.8 : 1;
    for (const [n, len, w, a, sp] of [[150 * heavy, 13, 1, 0.26, 760], [70 * heavy, 30, 2, 0.45, 1300]]) {
      g.strokeStyle = `rgba(200,220,255,${a})`; g.lineWidth = w; g.beginPath();
      const dx = len * (0.25 + lean * 0.4);
      for (let i = 0; i < n; i++) {
        const s = sp * (1 + (i % 5) * 0.08);
        const y = ((i * 71.3 + t * s) % (CH + 60)) - 30, x = ((i * 131.7 + t * s * (0.25 + lean * 0.4)) % (CW + 120)) - 60;
        g.moveTo(x, y); g.lineTo(x - dx, y - len);
      }
      g.stroke();
    }
  } else if (G.weather === 'snow') {
    g.fillStyle = 'rgba(232,240,250,0.08)'; g.fillRect(0, 0, CW, CH);
    const fog = g.createLinearGradient(0, 0, 0, CH * 0.5); fog.addColorStop(0, 'rgba(235,242,250,0.4)'); fog.addColorStop(1, 'rgba(235,242,250,0)');
    g.fillStyle = fog; g.fillRect(0, 0, CW, CH * 0.5);
    // far flakes, mid flakes, then a few big soft ones right in front of the camera
    for (const [n, r0, r1, a, sp, drift] of [[160, 1.1, 1.8, 0.75, 34, 18], [80, 2.2, 3.4, 0.9, 62, 32]]) {
      g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath();
      for (let i = 0; i < n; i++) {
        const r = r0 + (i % 4) / 3 * (r1 - r0), s = sp + (i % 5) * 8;
        const x = (((i * 97.1 + Math.sin(t * 1.3 + i) * 22 + t * (drift + lean * 40)) % (CW + 40)) + CW + 40) % (CW + 40) - 20, y = ((i * 53.9 + t * s) % (CH + 20)) - 10;
        g.moveTo(x + r, y); g.arc(x, y, r, 0, 7);
      }
      g.fill();
    }
    for (let i = 0; i < 14; i++) {
      const r = 6 + (i % 4) * 2.5, x = (((i * 211.3 + Math.sin(t * 0.9 + i) * 40 + t * (70 + lean * 90)) % (CW + 80)) + CW + 80) % (CW + 80) - 40, y = ((i * 149.1 + t * (120 + i * 6)) % (CH + 40)) - 20;
      const fg = g.createRadialGradient(x, y, 0, x, y, r); fg.addColorStop(0, 'rgba(255,255,255,0.55)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = fg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  if (G.fog) drawFog(g, G);
  if (G.storm) drawLightning(g, G);
  if (G.night) {
    // real night game: everything outside the lights goes dark blue, the field is lit by banks of stadium lights
    g.save();
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(52,64,112)'; g.fillRect(0, 0, CW, CH);
    g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(CW / 2, CH / 2, CH * 0.3, CW / 2, CH / 2, CW * 0.66);
    vg.addColorStop(0, 'rgba(0,0,12,0)'); vg.addColorStop(1, 'rgba(0,0,14,0.85)');
    g.fillStyle = vg; g.fillRect(0, 0, CW, CH);
    g.globalCompositeOperation = 'soft-light';
    const xs = [0.1, 0.37, 0.63, 0.9].map(f => CW * f);
    for (const [ly, dy] of [[-30, 1], [CH + 30, -1]]) for (const lx of xs) {
      const lg = g.createRadialGradient(lx, ly, 10, lx, ly + dy * 200, 480);
      lg.addColorStop(0, 'rgba(255,246,215,0.7)'); lg.addColorStop(0.5, 'rgba(255,246,215,0.18)'); lg.addColorStop(1, 'rgba(255,246,215,0)');
      g.fillStyle = lg; g.fillRect(0, 0, CW, CH);
    }
    g.globalCompositeOperation = 'lighter';
    // light banks with a glow (rain and snow catch the light under them)
    for (const lx of xs) {
      const bl = g.createRadialGradient(lx, 4, 2, lx, 4, 70);
      bl.addColorStop(0, 'rgba(255,255,240,0.9)'); bl.addColorStop(0.25, 'rgba(255,250,220,0.35)'); bl.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = bl; g.fillRect(lx - 70, 0, 140, 74);
      if (wet()) { const cone = g.createLinearGradient(0, 0, 0, CH * 0.6); cone.addColorStop(0, 'rgba(255,250,225,0.13)'); cone.addColorStop(1, 'rgba(255,250,225,0)'); g.fillStyle = cone; g.beginPath(); g.moveTo(lx - 22, 0); g.lineTo(lx + 22, 0); g.lineTo(lx + 140, CH * 0.6); g.lineTo(lx - 140, CH * 0.6); g.fill(); }
    }
    g.restore();
    for (const lx of xs) { g.fillStyle = '#fffef2'; g.fillRect(lx - 26, 0, 52, 5); g.fillStyle = '#ffffffaa'; for (let k = -2; k <= 2; k++) g.fillRect(lx + k * 10 - 3, 6, 6, 3); }
  }
}

// ---------- storms: lightning flashes + thunder ----------
function drawLightning(g, G) {
  const L = G.ltn || (G.ltn = { next: G.time + rand(3, 7), t0: -9, seed: 1 });
  if (L.next < G.time - 30 || L.t0 > G.time + 1) { L.next = G.time + rand(3, 7); L.t0 = -9; } // new game / time reset
  if (G.time >= L.next) {
    L.t0 = G.time; L.next = G.time + rand(6, 14); L.seed = Math.floor(rand(1, 9999)); L.x = rand(0.15, 0.85) * CW;
    if (!G.paused && G.phase !== 'replay') { Sound.thunder(rand(0.35, 1.3)); }
  }
  const t = G.time - L.t0; if (t < 0 || t > 0.7) return;
  // the sky flickers twice
  const a = t < 0.08 ? 0.55 : t < 0.14 ? 0.1 : t < 0.24 ? 0.4 : Math.max(0, 0.4 - (t - 0.24) * 0.9);
  g.fillStyle = `rgba(225,232,255,${a})`; g.fillRect(0, 0, CW, CH);
  if (t < 0.26) { // the bolt way off over the stands
    let x = L.x, y = -10, h = L.seed;
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.shadowColor = '#bcd0ff'; g.shadowBlur = 18; g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < 9; i++) { h = (h * 9301 + 49297) % 233280; x += (h / 233280 - 0.5) * 60; y += CH * 0.035; g.lineTo(x, y); }
    g.stroke(); g.shadowBlur = 0;
  }
}
// ---------- fog: you can only see so far from the ball ----------
function drawFog(g, G) {
  const b = G.ball, fx = b ? sx(b.x) : CW / 2, fy = b ? sy(b.y) - 20 : CH / 2;
  const col = G.night ? '120,128,140' : '214,220,226';
  const fg = g.createRadialGradient(fx, fy, 230, fx, fy, 700);
  fg.addColorStop(0, `rgba(${col},0.08)`); fg.addColorStop(0.45, `rgba(${col},0.6)`); fg.addColorStop(1, `rgba(${col},0.88)`);
  g.fillStyle = fg; g.fillRect(0, 0, CW, CH);
  // wisps drifting across
  for (let i = 0; i < 9; i++) {
    const w = 260 + (i % 3) * 120, x = ((i * 337 + G.time * (14 + i * 3)) % (CW + w * 2)) - w, y = (i * 131) % CH;
    const wg = g.createRadialGradient(x, y, 0, x, y, w / 2); wg.addColorStop(0, `rgba(${col},0.22)`); wg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = wg; g.save(); g.translate(x, y); g.scale(1, 0.35); g.translate(-x, -y); g.fillRect(x - w / 2, y - w / 2, w, w); g.restore();
  }
}
// ---------- ball security: tuck it with two hands = way fewer fumbles, but you're a little slower and can't juke or spin ----------
function toggleTuck(p) {
  p.tuck = !p.tuck; Sound.click();
  addText(p.x, p.y, p.tuck ? 'BALL TUCKED' : 'ONE HAND', p.tuck ? '#7fd3ff' : '#ddd', 15, 0.7);
}
const tuckFumbleMul = car => car && car.tuck ? 0.25 : 1;
