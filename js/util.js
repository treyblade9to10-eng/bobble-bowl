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
// player 2 keys: arrows move, right shift sprint, enter = snap / dive / jump, / . , = juke spin stiff arm, 7 8 9 0 = throw, L switch, K hit stick
const P2KEYS = { KeyW: 'ArrowUp', KeyA: 'ArrowLeft', KeyS: 'ArrowDown', KeyD: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  Space: 'Enter', ShiftLeft: 'ShiftRight', ControlLeft: 'ControlRight', ControlRight: 'ControlRight', KeyE: 'Slash', KeyF: 'Period', KeyR: 'Comma', KeyQ: 'KeyL', Tab: 'KeyL',
  KeyC: 'KeyK', Digit1: 'Digit7', Digit2: 'Digit8', Digit3: 'Digit9', Digit4: 'Digit0', Numpad1: 'Digit7', Numpad2: 'Digit8', Numpad3: 'Digit9', Numpad4: 'Digit0', KeyT: 'KeyN', KeyX: 'KeyJ' };
const P1BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter']);
const Input = {
  down: {},      // key code -> held
  pressed: {},   // key code -> pressed this frame
  // mouse / finger on the game canvas (screen coords in 1280x720 space)
  pointer: { down: false, x: 0, y: 0, x0: 0, y0: 0, t: 0, moved: false, aiming: false },
  stick: { x: 0, y: 0, m: 0 }, // on-screen joystick (mobile)
  taps: [],      // quick taps/clicks this frame
  release: null, // drag-back vector released this frame
  press(code) { if (!this.down[code]) this.pressed[code] = true; this.down[code] = true; },
  release_(code) { this.down[code] = false; },
  endFrame() { this.pressed = {}; this.taps.length = 0; this.release = null; },
  // 2-player on one keyboard: the engine always asks for P1's keys, and we translate them for whoever is acting
  versus: false, ctl: 0,
  map(c) { if (!this.versus) return c; if (this.ctl === 1) return P2KEYS[c] || '-'; return P1BLOCK.has(c) ? '-' : c; },
  hit(...codes) { return codes.some(c => this.pressed[this.map(c)]); },
  held(...codes) { return codes.some(c => this.down[this.map(c)]); },
  pads: [null, null], // controller left sticks (see gamepad.js)
  axis() {
    const pd = this.pads[this.versus ? this.ctl : 0];
    if (pd) return pd;
    let x = 0, y = 0;
    if (this.held('KeyA', 'ArrowLeft')) x -= 1;
    if (this.held('KeyD', 'ArrowRight')) x += 1;
    if (this.held('KeyW', 'ArrowUp')) y -= 1;
    if (this.held('KeyS', 'ArrowDown')) y += 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  }
};

window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  Input.press(e.code);
  if (e.code === 'ShiftRight' && !Input.versus) Input.press('ShiftLeft');
  if (Input.versus && ['Slash', 'Quote', 'Tab'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') e.preventDefault();
  Input.release_(e.code);
  if (e.code === 'ShiftRight' && !Input.versus) Input.release_('ShiftLeft');
});
window.addEventListener('blur', () => { Input.down = {}; });

