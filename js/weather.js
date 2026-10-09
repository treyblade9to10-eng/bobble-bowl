// ---- Weather + night games: how it looks and how it changes the game ----
// G.weather: 'clear' | 'rain' | 'snow'.  G.night: true/false.
const WEATHER = [['clear', 'Clear'], ['rain', 'Rain'], ['snow', 'Snow'], ['random', 'Random']];
const wet = () => G.weather === 'rain' || G.weather === 'snow';

function pickWeather(choice, week, games) {
  if (choice && choice !== 'random') return choice;
  const late = week != null && games ? week >= games / 2 : chance(0.5);
  const r = Math.random();
  return r < 0.16 ? 'rain' : r < (late ? 0.3 : 0.2) ? 'snow' : 'clear';
}

// gameplay knobs (used by the engine)
const Weather = {
  speed: () => G.weather === 'snow' ? 0.95 : 1,          // top speed
  grip: () => G.weather === 'snow' ? 0.7 : G.weather === 'rain' ? 0.86 : 1, // acceleration / cutting
  catchPenalty: () => G.weather === 'rain' ? 0.07 : G.weather === 'snow' ? 0.05 : 0,
  fumbleBonus: () => wet() ? 0.02 : 0,
  slipChance: () => G.weather === 'snow' ? 0.15 : G.weather === 'rain' ? 0.1 : 0,
  kickRange: () => G.weather === 'snow' ? -4 : G.weather === 'rain' ? -2 : 0
};

// snow piles up on the grass
function drawWeatherGround(g, G) {
  if (G.weather !== 'snow' || G.demo) return;
  g.fillStyle = 'rgba(240,246,255,0.2)'; g.fillRect(0, 0, CW, CH);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 26; i++) { // drifts that move with the camera
    const wx0 = (i * 37.3) % 130 - 5, wy0 = (i * 19.7) % FIELD_W;
    g.beginPath(); g.ellipse(sx(wx0), sy(wy0), 70 + (i % 4) * 25, 14 + (i % 3) * 6, 0, 0, 7); g.fill();
  }
}

// falling rain / snow + the night lighting, drawn over the field and players
function drawWeather(g, G) {
  if (G.demo) return;
  const t = G.time;
  if (G.weather === 'rain') {
    g.fillStyle = 'rgba(20,32,48,0.16)'; g.fillRect(0, 0, CW, CH);
    g.strokeStyle = 'rgba(200,220,255,0.45)'; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < 150; i++) {
      const sp = 900 + (i % 7) * 60;
      const x = ((i * 131.7 + t * 260) % (CW + 100)) - 50, y = ((i * 71.3 + t * sp) % (CH + 60)) - 30;
      g.moveTo(x, y); g.lineTo(x - 7, y + 22);
    }
    g.stroke();
  } else if (G.weather === 'snow') {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 170; i++) {
      const sp = 40 + (i % 5) * 18, r = 1.4 + (i % 4) * 0.7;
      const x = ((i * 97.1 + Math.sin(t * 1.3 + i) * 24 + t * 25) % (CW + 40)) - 20, y = ((i * 53.9 + t * sp) % (CH + 20)) - 10;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }
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
    // light banks with a glow
    for (const lx of xs) {
      const bl = g.createRadialGradient(lx, 4, 2, lx, 4, 70);
      bl.addColorStop(0, 'rgba(255,255,240,0.9)'); bl.addColorStop(0.25, 'rgba(255,250,220,0.35)'); bl.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = bl; g.fillRect(lx - 70, 0, 140, 74);
    }
    g.restore();
    for (const lx of xs) { g.fillStyle = '#fffef2'; g.fillRect(lx - 26, 0, 52, 5); g.fillStyle = '#ffffffaa'; for (let k = -2; k <= 2; k++) g.fillRect(lx + k * 10 - 3, 6, 6, 3); }
  }
}
