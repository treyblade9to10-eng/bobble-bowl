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
    g.fillStyle = 'rgba(6,12,32,0.42)'; g.fillRect(0, 0, CW, CH);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const lx of [CW * 0.12, CW * 0.5, CW * 0.88]) {
      const lg = g.createRadialGradient(lx, -40, 10, lx, 120, 520);
      lg.addColorStop(0, 'rgba(255,250,225,0.32)'); lg.addColorStop(1, 'rgba(255,250,225,0)');
      g.fillStyle = lg; g.fillRect(0, 0, CW, CH);
    }
    g.restore();
    // the light towers
    for (const lx of [CW * 0.12, CW * 0.5, CW * 0.88]) { g.fillStyle = '#fffbe0'; g.beginPath(); g.ellipse(lx, 6, 40, 6, 0, 0, 7); g.fill(); }
  }
}
