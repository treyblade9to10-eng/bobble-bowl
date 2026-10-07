// ---- small helpers shared by every file ----
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const chance = p => Math.random() < p;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function shade(hex, amt) { // amt -1..1, darker/lighter
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// pick white or black text for a background color
function textOn(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? '#111' : '#fff';
}

// last name for tight labels
const lastName = n => { const p = n.split(' '); return p.length > 1 ? p.slice(1).join(' ') : n; };

// ---------------- input ----------------
const Input = {
  down: {},      // key code -> held
  pressed: {},   // key code -> pressed this frame
  stick: { x: 0, y: 0 }, // touch joystick
  clicks: [],    // canvas clicks in world coords are resolved by engine
  press(code) { if (!this.down[code]) this.pressed[code] = true; this.down[code] = true; },
  release(code) { this.down[code] = false; },
  endFrame() { this.pressed = {}; this.clicks.length = 0; },
  hit(...codes) { return codes.some(c => this.pressed[c]); },
  held(...codes) { return codes.some(c => this.down[c]); },
  axis() {
    let x = 0, y = 0;
    if (this.held('KeyA', 'ArrowLeft')) x -= 1;
    if (this.held('KeyD', 'ArrowRight')) x += 1;
    if (this.held('KeyW', 'ArrowUp')) y -= 1;
    if (this.held('KeyS', 'ArrowDown')) y += 1;
    x += this.stick.x; y += this.stick.y;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  }
};

window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  Input.press(e.code);
  if (e.code === 'ShiftRight') Input.press('ShiftLeft');
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') e.preventDefault();
  Input.release(e.code);
  if (e.code === 'ShiftRight') Input.release('ShiftLeft');
});
window.addEventListener('blur', () => { Input.down = {}; });

// touch joystick + buttons
(function setupTouch() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add('touch');
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  if (!stick) return;
  let sid = null;
  const move = t => {
    const r = stick.getBoundingClientRect();
    let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    Input.stick.x = Math.abs(dx) < 0.15 ? 0 : dx; Input.stick.y = Math.abs(dy) < 0.15 ? 0 : dy;
    knob.style.left = (45 + dx * 45) + 'px'; knob.style.top = (45 + dy * 45) + 'px';
  };
  stick.addEventListener('touchstart', e => { e.preventDefault(); sid = e.changedTouches[0].identifier; move(e.changedTouches[0]); }, { passive: false });
  stick.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === sid) move(t); }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; Input.stick.x = Input.stick.y = 0; knob.style.left = knob.style.top = '45px'; } };
  stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
  document.querySelectorAll('#tbtns button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('touchstart', e => { e.preventDefault(); Input.press(k); }, { passive: false });
    b.addEventListener('touchend', e => { e.preventDefault(); Input.release(k); }, { passive: false });
    b.addEventListener('mousedown', () => Input.press(k));
    b.addEventListener('mouseup', () => Input.release(k));
  });
})();
