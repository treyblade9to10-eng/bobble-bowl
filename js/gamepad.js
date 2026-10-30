// ---- Controllers (Xbox / PlayStation / any "standard" gamepad) ----
// The pad presses the same keys the keyboard does, so every move works the same way. Button layout (Xbox / PlayStation):
//  Left stick / d-pad move (push a little = jog), RT / R2 sprint, MENU / OPTIONS pause, VIEW / CREATE timeout (or the red flag when it shows)
//  Before the snap, offense: A snap, X motion, Y audible, hold LB + A B X Y = hot route that receiver
//  Before the snap, defense: B or LB switch player, X press coverage, RB show blitz, Y audible
//  Passing: A B X Y = the receiver with that button (tap = lob, hold = power bar), LT lob / RT bullet, RB throw it away, LB or L3 = QB run
//  Ball carrier: Y juke, B spin, A stiff arm, X slide, LB tuck. Right stick flick: up / down = juke that way, toward the goal = truck, back = spin
//  Defense: A dive (jump for the pick while the ball is in the air), Y jump, B switch to the guy closest to the ball, X swim, RB / right stick = hit stick
//  Kicks: A stops the meter. Punt coming down: A fair catch. After a TD: d-pad / A B X Y / LB RB celebrate
//  Menus: stick / d-pad move the gold box, A pick, B back, LB / RB pages (play call) or teams (matchup), Y last play
const PB = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, MOVE: 20, FLICK: 21, DPAD: 22 };
const PAD_COL = { xb: ['#5ad85a', '#ff5a52', '#4aa6ff', '#ffc933'], ps: ['#86b6ff', '#ff6f7a', '#f08ad8', '#3fe0b5'] };
const PAD_NAMES = { xb: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'L3', 'R3'], ps: ['CROSS', 'CIRCLE', 'SQUARE', 'TRIANGLE', 'L1', 'R1', 'L2', 'R2', 'CREATE', 'OPTIONS', 'L3', 'R3'] };
const padType = gp => { const id = gp.id || ''; return /054c|playstation|dualshock|dualsense/i.test(id) || (/wireless controller/i.test(id) && !/xbox|045e/i.test(id)) ? 'ps' : 'xb'; };
// glyph art, drawn in a 24-unit box around 0,0 (bumpers / triggers / pills are 30 wide)
const padGW = k => (k >= 4 && k <= 9) ? 30 : 24;
function padGlyphDraw(g, k, t) {
  const ps = t === 'ps';
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const txt = (s, sz, col) => { g.fillStyle = col || '#fff'; g.font = `900 ${sz}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 1); };
  g.lineWidth = 1.6; g.strokeStyle = '#e8ecf2'; g.fillStyle = '#151a23';
  if (k <= 3) { // face buttons
    g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill(); g.stroke();
    const col = PAD_COL[ps ? 'ps' : 'xb'][k];
    if (!ps) return txt('ABXY'[k], 16, col);
    g.strokeStyle = col; g.lineWidth = 2.3; g.beginPath();
    if (k === 0) { g.moveTo(-4.6, -4.6); g.lineTo(4.6, 4.6); g.moveTo(4.6, -4.6); g.lineTo(-4.6, 4.6); }
    else if (k === 1) g.arc(0, 0, 5.3, 0, 7);
    else if (k === 2) g.rect(-4.7, -4.7, 9.4, 9.4);
    else { g.moveTo(0, -5.8); g.lineTo(5.8, 4.3); g.lineTo(-5.8, 4.3); g.closePath(); }
    g.stroke(); return;
  }
  if (k === 4 || k === 5) { rr(-14, -7, 28, 14, 4); g.fill(); g.stroke(); return txt(PAD_NAMES[ps ? 'ps' : 'xb'][k], 12); }
  if (k === 6 || k === 7) { // trigger: rounded top
    g.beginPath(); g.moveTo(-12, 9); g.lineTo(-12, -2); g.quadraticCurveTo(-12, -10, 0, -10); g.quadraticCurveTo(12, -10, 12, -2); g.lineTo(12, 9); g.closePath(); g.fill(); g.stroke();
    return txt(PAD_NAMES[ps ? 'ps' : 'xb'][k], 12);
  }
  if (k === 8 || k === 9) { // small pill: view / create, menu / options
    rr(-13, -7, 26, 14, 7); g.fill(); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath();
    if (k === 9) for (const y of [-3, 0, 3]) { g.moveTo(-4.5, y); g.lineTo(4.5, y); }
    else if (!ps) { g.rect(-5, -3.5, 6, 5); g.rect(-1, -1.5, 6, 5); }
    else for (const x of [-3.5, 0, 3.5]) { g.moveTo(x - 1.2, 3.5); g.lineTo(x + 1.2, -3.5); }
    g.stroke(); return;
  }
  if (k === 10 || k === 11 || k === 20 || k === 21) { // sticks
    g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(0, 0, 7, 0, 7); g.strokeStyle = '#ffffff60'; g.stroke();
    const L = k === 10 || k === 20;
    if (k >= 20) { g.fillStyle = '#f6c31c'; for (let a = 0; a < 4; a++) { g.save(); g.rotate(a * Math.PI / 2); g.beginPath(); g.moveTo(0, -10.5); g.lineTo(2.6, -7.6); g.lineTo(-2.6, -7.6); g.closePath(); g.fill(); g.restore(); } }
    return txt(k >= 20 ? (L ? 'L' : 'R') : (ps ? (L ? 'L3' : 'R3') : (L ? 'LS' : 'RS')), k >= 20 ? 11 : 10);
  }
  // d-pad: 22 = the whole pad, 12-15 = one arm lit
  g.beginPath(); g.moveTo(-3.6, -11); g.lineTo(3.6, -11); g.lineTo(3.6, -3.6); g.lineTo(11, -3.6); g.lineTo(11, 3.6); g.lineTo(3.6, 3.6); g.lineTo(3.6, 11); g.lineTo(-3.6, 11); g.lineTo(-3.6, 3.6); g.lineTo(-11, 3.6); g.lineTo(-11, -3.6); g.lineTo(-3.6, -3.6); g.closePath(); g.fill(); g.stroke();
  if (k >= 12 && k <= 15) { const a = { 12: 0, 15: 1, 13: 2, 14: 3 }[k]; g.save(); g.rotate(a * Math.PI / 2); g.fillStyle = '#f6c31c'; g.fillRect(-2.4, -9.8, 4.8, 6); g.restore(); }
}

const Pad = {
  prev: [[], []], bind: [{}, {}], holds: [{}, {}], rsOn: [false, false], navs: [{ dir: '', t: 0 }, { dir: '', t: 0 }],
  ids: [null, null], on: false, ui: false, type: 'xb', cur: null, hotShow: false, barKey: '', imgs: {},
  rumble: (() => { try { return localStorage.getItem('bobblePadRumble') !== '0'; } catch (e) { return true; } })(),
  poll(dt) {
    const pads = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(p => p && p.connected);
    Input.pads = [null, null]; this.hotShow = false;
    const ids = [0, 1].map(i => pads[i] ? pads[i].id : null);
    for (let i = 0; i < 2; i++) if (ids[i] !== this.ids[i]) {
      if (ids[i]) this.toast(i, padType(pads[i]), true);
      else { this.toast(i, this.type, false); this.letGo(i); if (G.teams && !G.demo && !G.paused && !G.online && G.phase !== 'over' && !document.querySelector('.screen.show')) togglePause(); } // pad died mid-play: pause
    }
    this.ids = ids;
    const pc = $('padCtl'); if (pc && pc.classList.contains('show') && !$(pc.dataset.from || 'how').classList.contains('show')) pc.classList.remove('show'); // its menu closed under it
    if (!pads.length) { if (this.on) { this.on = false; document.body.classList.remove('pad'); this.setUI(false); } return; }
    if (!this.on) { this.on = true; document.body.classList.add('pad'); }
    pads.slice(0, 2).forEach((gp, i) => this.one(gp, i, dt));
    if (this.ui) this.bar();
  },
  // last thing touched was a pad: show its buttons (keyboard / mouse / finger hides them again)
  setUI(on, t) {
    if (t && t !== this.type) { this.type = t; document.body.classList.toggle('pad-ps', t === 'ps'); this.barKey = ''; }
    if (on === this.ui) return;
    this.ui = on; document.body.classList.toggle('padui', on);
    if (!on && this.cur) { this.cur.classList.remove('pfocus'); this.dropPick(); this.cur = null; }
  },
  letGo(i) {
    for (const k in this.bind[i]) for (const c of this.bind[i][k]) Input.release_(c);
    for (const c in this.holds[i]) Input.release_(c);
    this.bind[i] = {}; this.holds[i] = {}; this.prev[i] = [];
  },
  one(gp, i, dt) {
    const now = [], was = this.prev[i];
    for (let k = 0; k < 17; k++) { const b = gp.buttons[k]; now[k] = !!b && (k === 6 || k === 7 ? (b.value || (b.pressed ? 1 : 0)) > 0.3 : b.pressed); }
    this.prev[i] = now;
    const hit = k => now[k] && !was[k];
    // left stick: round dead zone, then rescaled so a light push = a slow jog and full tilt = full speed
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0, m = Math.hypot(x, y);
    let mag = m < 0.2 ? 0 : Math.min(1, (m - 0.2) / 0.72);
    const dx = (now[15] ? 1 : 0) - (now[14] ? 1 : 0), dy = (now[13] ? 1 : 0) - (now[12] ? 1 : 0);
    if (dx || dy) { x = dx; y = dy; m = Math.hypot(dx, dy); mag = 1; }
    Input.pads[i] = mag > 0 ? { x: x / m, y: y / m, m: mag } : null;
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0, rm = Math.hypot(rx, ry);
    const flick = rm > 0.75 && !this.rsOn[i];
    if (rm > 0.75) this.rsOn[i] = true; else if (rm < 0.35) this.rsOn[i] = false;
    if (now.some((v, k) => v && !was[k]) || m > 0.5 || rm > 0.5) this.setUI(true, padType(gp));
    // buttons let go: release whatever key they pressed
    const B = this.bind[i];
    for (const k in B) if (!now[k]) { for (const c of B[k]) Input.release_(c); delete B[k]; }
    // 2 players: the 2nd controller presses player 2's keys
    const code = c => (i === 1 && Input.versus) ? (P2KEYS[c] || c) : c;
    // a press stays tied to the key it pressed, so holding A through the snap can't turn into a throw
    const press = (k, c) => { const cc = code(c); Input.press(cc); (B[k] = B[k] || []).push(cc); };
    const hold = (c, on) => { const cc = code(c), H = this.holds[i]; if (on && !H[cc]) { H[cc] = 1; Input.press(cc); } else if (!on && H[cc]) { delete H[cc]; Input.release_(cc); } };
    if (hit(PB.MENU) && G.teams && !G.demo && (!document.querySelector('.screen.show') || $('pause').classList.contains('show') || $('playcall').classList.contains('show')) && !$('padCtl').classList.contains('show')) { togglePause(); return; }
    if (this.menu()) { hold('ShiftLeft', false); hold('ControlLeft', false); return this.menuNav(i, hit, x, y, mag > 0 || dx || dy, dt, ry); }
    if (!G.teams || G.demo) return;
    const side = Input.versus ? (i === 0 ? G.p1 : 1 - G.p1) : G.human;
    const cx = withSide(side, () => this.ctx());
    hold('ShiftLeft', now[PB.RT] && cx !== 'celly');
    hold('ControlLeft', now[PB.LT] && cx === 'throw');
    const map = {};
    if (cx === 'hl') Object.assign(map, { 0: 'Space', 1: 'Escape', 5: 'ArrowRight' });
    else if (cx === 'dash') Object.assign(map, { 0: 'KeyA', 4: 'KeyA', 14: 'KeyA', 1: 'KeyD', 5: 'KeyD', 15: 'KeyD' });
    else if (cx === 'kick') Object.assign(map, { 0: 'Space', 3: 'Space', 1: 'KeyQ', 4: 'KeyQ', 2: 'KeyE' });
    else if (cx === 'preO') {
      if (now[PB.LB]) { Object.assign(map, { 0: 'Digit1', 1: 'Digit2', 2: 'Digit3', 3: 'Digit4' }); this.hotShow = G.play && G.play.off && G.play.off.type === 'pass'; }
      else Object.assign(map, { 0: 'Space', 2: 'KeyM', 3: 'KeyZ' });
      map[8] = 'KeyT';
    } else if (cx === 'preD') Object.assign(map, { 1: 'KeyQ', 4: 'KeyQ', 2: 'KeyV', 5: 'KeyB', 3: 'KeyZ', 8: 'KeyT' });
    else if (cx === 'throw') Object.assign(map, { 0: 'Digit1', 1: 'Digit2', 2: 'Digit3', 3: 'Digit4', 5: 'KeyU', 4: 'KeyX', 10: 'KeyX' });
    else if (cx === 'carrier') Object.assign(map, { 3: 'KeyE', 1: 'KeyF', 0: 'KeyR', 2: 'KeyX', 4: 'KeyG' });
    else if (cx === 'def') Object.assign(map, { 0: 'Space', 3: 'Space', 1: 'KeyQ', 4: 'KeyQ', 2: 'KeyE', 5: 'KeyC' });
    else if (cx === 'off') Object.assign(map, { 0: 'Space', 3: 'Space' });
    else if (cx === 'celly') Object.assign(map, { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Digit1', 1: 'Digit2', 2: 'Digit3', 3: 'Digit4', 4: 'KeyE', 5: 'KeyF', 6: 'KeyC', 7: 'KeyR', 11: 'KeyG' });
    else Object.assign(map, { 0: 'Space' });
    if (cx === 'celly' || cx === 'other') map[8] = G.rvWin ? 'KeyY' : 'KeyT'; // red flag after a close call
    for (const k in map) if (hit(+k)) press(+k, map[k]);
    // right stick flick: ball carrier = juke up / down, truck toward the goal, spin going back. Defense = hit stick
    if (flick && (cx === 'carrier' || cx === 'def')) {
      if (cx === 'def') press(PB.RS + 100, 'KeyC');
      else if (Math.abs(ry) > Math.abs(rx)) { Input.jukeAx = { x: 0, y: Math.sign(ry), m: 1 }; press(PB.RS + 100, 'KeyE'); }
      else press(PB.RS + 100, Math.sign(rx) === dirOf(side) ? 'KeyR' : 'KeyF');
    }
  },
  // what your controller is doing right now (run as the pad's side in 2-player)
  ctx() {
    if (typeof Highlights !== 'undefined' && Highlights.on) return 'hl';
    if (G.mini && G.mini.type === 'dash') return 'dash';
    const rush = typeof fgRushing === 'function' && fgRushing();
    if (G.phase === 'kickmeter' && !rush) return 'kick';
    if (G.phase === 'presnap') return G.poss === G.human ? 'preO' : 'preD';
    if (G.phase === 'dead' && G.cellyGuy) return 'celly';
    if (G.phase === 'live' || rush) {
      const h = G.versus ? (G.hp || [])[G.human] : G.humanPlayer, b = G.ball;
      if (!h || !b) return 'other';
      if (humanCanThrow()) return 'throw';
      if (b.holder === h) return 'carrier';
      if (h.side !== G.poss || (b.holder && b.holder.side !== h.side) || rush) return 'def';
      return 'off';
    }
    return 'other';
  },

  // ---------- menus ----------
  menu() { return !!document.querySelector('.screen.show'); },
  // every clickable thing you can see on top (a box open over a screen wins over the screen under it)
  items() {
    const sel = 'button, select, input:not([type=hidden]), a[href], [tabindex]:not([tabindex="-1"]), .pcard, .mdcard, .modecard, .dRow, .trRow';
    const set = new Set();
    for (const s of document.querySelectorAll('.screen.show')) {
      for (const e of s.querySelectorAll(sel)) set.add(e);
      for (const e of s.querySelectorAll('div, span, li, td, tr, label, canvas, img')) if (typeof e.onclick === 'function') set.add(e);
    }
    const W = innerWidth, H = innerHeight;
    const onTop = (e, r) => {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx > 0 && cy > 0 && cx < W && cy < H) { const t = document.elementFromPoint(cx, cy); if (t && (t === e || e.contains(t))) return true; }
      // scrolled out of its list: count it if the list itself is on top
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) {
          const ra = a.getBoundingClientRect(), ax = clamp(ra.left + ra.width / 2, 1, W - 1), ay = clamp(ra.top + ra.height / 2, 1, H - 1), t = document.elementFromPoint(ax, ay);
          return !!t && a.contains(t);
        }
      }
      return false;
    };
    return [...set].filter(e => {
      if (e.disabled || e.closest('#muHidden, #mbtns') || e.id === 'btnMute' || e.id === 'btnPause') return false;
      const r = e.getBoundingClientRect(); if (r.width < 3 || r.height < 3) return false;
      if (getComputedStyle(e).visibility === 'hidden') return false;
      return onTop(e, r);
    }).filter((e, _, all) => !(e.tagName === 'LABEL' && all.some(o => o !== e && e.contains(o)))); // a label around a select: just the select
  },
  focus(e) {
    if (this.cur === e) return;
    if (this.cur) { this.cur.classList.remove('pfocus'); this.dropPick(); }
    this.cur = e; if (!e) return;
    e.classList.add('pfocus');
    try { e.focus({ preventScroll: true }); } catch (x) {}
    e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (e.classList.contains('pcard')) { const s = document.createElement('span'); s.className = 'padPick'; s.innerHTML = this.icon(PB.A) + 'PICK'; e.appendChild(s); }
  },
  dropPick() { document.querySelectorAll('.padPick').forEach(s => s.remove()); },
  firstPick(items) {
    const want = ['.pcard.coach', '#pcReveal', '.modecard[data-mode="computer"]', '#btnResume', '#pcBack', 'button.big'];
    for (const q of want) { const e = items.find(x => x.matches(q)); if (e) return e; }
    return items[0];
  },
  menuNav(i, hit, x, y, moving, dt, ry) {
    const N = this.navs[i];
    if (Math.abs(ry) > 0.3) { const sb = this.scroller(); if (sb) sb.scrollTop += ry * dt * 900; } // right stick scrolls a long list
    const dir = !moving ? '' : Math.abs(x) > Math.abs(y) ? (x > 0 ? 'r' : 'l') : (y > 0 ? 'd' : 'u');
    let step = false;
    if (dir && dir !== N.dir) { step = true; N.t = 0.38; } else if (dir) { N.t -= dt; if (N.t <= 0) { step = true; N.t = 0.11; } }
    N.dir = dir;
    const any = step || [0, 1, 2, 3, 4, 5, 8].some(hit);
    // a new menu (or a box opened over it): put the gold box on its main button right away
    const sk = [...document.querySelectorAll('.screen.show')].map(s => s.id).join();
    this.chk = (this.chk || 0) - dt;
    if (!any && this.ui && (sk !== this.scrKey || !this.cur || !this.cur.isConnected || !this.cur.getClientRects().length || this.chk <= 0)) {
      this.scrKey = sk; this.chk = 0.5;
      const it = this.items(); if (it.length && !it.includes(this.cur)) this.focus(this.firstPick(it));
      return;
    }
    if (!any) return;
    const items = this.items();
    if (!items.length) return;
    if (!items.includes(this.cur)) { this.focus(this.firstPick(items)); return; }
    const cur = this.cur;
    if (step) {
      // a dropdown / slider: left-right changes it
      if ((dir === 'l' || dir === 'r') && cur.tagName === 'SELECT') { const n = cur.selectedIndex + (dir === 'r' ? 1 : -1); if (n >= 0 && n < cur.options.length) { cur.selectedIndex = n; cur.dispatchEvent(new Event('change', { bubbles: true })); Sound.click(); } return; }
      if ((dir === 'l' || dir === 'r') && cur.tagName === 'INPUT' && cur.type === 'range') { if (dir === 'r') cur.stepUp(); else cur.stepDown(); cur.dispatchEvent(new Event('input', { bubbles: true })); cur.dispatchEvent(new Event('change', { bubbles: true })); return; }
      const best = this.near(items, cur, dir);
      if (best) { this.focus(best); Sound.click(); }
    }
    if (hit(PB.A)) { if (cur.tagName === 'INPUT' && /text|search|number/.test(cur.type)) cur.focus(); else cur.click(); }
    if (hit(PB.B)) { const b = items.find(e => /^\s*(‹\s*)?(BACK|CLOSE|DONE|CANCEL|EXIT)\b|^\s*RESUME\s*$/i.test(e.textContent) || /back|close/i.test(e.id)); if (b) b.click(); }
    const pc = $('playcall').classList.contains('show') && !$('pcCover').classList.contains('on');
    const btn = re => items.find(e => re.test(e.textContent));
    if (hit(PB.LB) || hit(PB.RB)) {
      const d = hit(PB.RB) ? 1 : -1;
      if (pc) { const b = btn(d > 0 ? /NEXT/ : /PREV/); if (b) { b.click(); this.cur = null; const it = this.items(); this.focus(it.find(e => e.classList.contains('pcard')) || this.firstPick(it)); } }
      else if ($('select').classList.contains('show') && items.some(e => e.classList.contains('muArr'))) moveTeam(sel.you, d);
      else this.tab(items, d);
    }
    if (hit(PB.Y) && pc) { const b = btn(/^LAST PLAY/); if (b) b.click(); }
    if (hit(PB.VIEW) && pc) { const b = btn(/^TIMEOUT/); if (b) b.click(); }
  },
  // the list the right stick scrolls: the one around the gold box, or the biggest one on the top screen
  scroller() {
    const ok = a => { const cs = getComputedStyle(a); return /(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 4; };
    for (let a = this.cur && this.cur.parentElement; a && a !== document.body; a = a.parentElement) if (ok(a)) return a;
    const top = [...document.querySelectorAll('.screen.show')].pop(); if (!top) return null;
    if (ok(top)) return top;
    let best = null, bh = 0; for (const a of top.querySelectorAll('div')) if (a.clientHeight > bh && ok(a)) { bh = a.clientHeight; best = a; }
    return best;
  },
  // closest thing in that direction (straight lines count more than diagonals)
  near(items, cur, dir) {
    const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    const ux = dir === 'r' ? 1 : dir === 'l' ? -1 : 0, uy = dir === 'd' ? 1 : dir === 'u' ? -1 : 0;
    let best = null, bd = 1e9;
    for (const e of items) {
      if (e === cur || e.contains(cur) || cur.contains(e)) continue;
      const r = e.getBoundingClientRect();
      // gap between the boxes along the move, and how far off to the side
      const along = ux ? (ux > 0 ? r.left - r0.right : r0.left - r.right) : (uy > 0 ? r.top - r0.bottom : r0.top - r.bottom);
      const ex = r.left + r.width / 2 - cx, ey = r.top + r.height / 2 - cy, main = ux ? ex * ux : ey * uy;
      if (main <= 4 || along < -Math.min(r.width, r.height, r0.width, r0.height) * 0.5) continue;
      const off = ux ? Math.max(0, Math.abs(ey) - (r.height + r0.height) / 2) : Math.max(0, Math.abs(ex) - (r.width + r0.width) / 2);
      const dd = Math.max(0, along) + off * 2.5 + (ux ? Math.abs(ey) : Math.abs(ex)) * 0.3;
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  },
  // bumpers on screens with tabs: next / previous tab
  tab(items, d) {
    const tabs = items.filter(e => e.tagName === 'BUTTON' && e.parentElement && /tab/i.test(e.parentElement.id + ' ' + e.parentElement.className));
    if (tabs.length < 2) return;
    const on = tabs.findIndex(e => /\b(on|sel|active|cur)\b/.test(e.className) || e.getAttribute('aria-selected') === 'true');
    const n = tabs[((on < 0 ? 0 : on) + d + tabs.length) % tabs.length];
    n.click(); this.cur = null; Sound.click();
    const it = this.items(); const back = it.find(e => e.textContent === n.textContent && e.tagName === 'BUTTON'); this.focus(back || this.firstPick(it));
  },
  // button prompts along the bottom of a menu
  bar() {
    const el = $('padBar'); if (!el) return;
    const scr = [...document.querySelectorAll('.screen.show')].map(s => s.id), pc = scr.includes('playcall') && !$('pcCover').classList.contains('on');
    const key = scr.join() + this.type + (pc ? $('pcHint').textContent : '');
    if (key === this.barKey) return; this.barKey = key;
    if (!scr.length) { el.innerHTML = ''; return; }
    const L = [[[PB.A], pc ? 'PICK' : 'SELECT']];
    if (pc) { if (/NEXT/.test($('pcHint').textContent)) L.push([[PB.LB, PB.RB], 'PAGE']); if (/LAST PLAY/.test($('pcHint').textContent)) L.push([[PB.Y], 'LAST PLAY']); if (/TIMEOUT/.test($('pcHint').textContent)) L.push([[PB.VIEW], 'TIMEOUT']); L.push([[PB.MENU], 'PAUSE']); }
    else { L.push([[PB.B], 'BACK']); if (scr.includes('select')) L.push([[PB.LB, PB.RB], 'TEAM']); if (this.scroller()) L.push([[PB.FLICK], 'SCROLL']); }
    el.innerHTML = L.map(([ks, t]) => `<span>${ks.map(k => this.icon(k)).join('')}<b>${t}</b></span>`).join('');
    // phones: the prompts show for a few seconds when a menu opens, then get out of the way of its buttons
    el.classList.remove('fade'); clearTimeout(this.barT);
    if (!pc && innerHeight < 500) this.barT = setTimeout(() => el.classList.add('fade'), 3500);
  },

  // ---------- glyphs ----------
  img(k, t) {
    const id = k + t + (document.fonts && document.fonts.status);
    if (this.imgs[id]) return this.imgs[id];
    const c = document.createElement('canvas'), s = 3; c.width = padGW(k) * s; c.height = 24 * s;
    const g = c.getContext('2d'); g.scale(s, s); g.translate(padGW(k) / 2, 12); padGlyphDraw(g, k, t);
    return (this.imgs[id] = c.toDataURL());
  },
  icon(k, t) { return `<img class="pgl${padGW(k) > 24 ? ' w' : ''}" src="${this.img(k, t || this.type)}" alt="${PAD_NAMES[t || this.type][k] || ''}">`; },
  // how much smaller than full size the game picture is on this screen (1 on a computer)
  scale(max) { const h = cv.clientHeight || CH; return clamp(CH / h, 1, max); },
  drawGlyph(g, k, x, y, r, t) { g.save(); g.translate(x, y); g.scale(r / 12, r / 12); padGlyphDraw(g, k, t || this.type); g.restore(); },
  // in-game prompts with real buttons (engine updateHint asks first)
  setHint() {
    G.padHint = null;
    if (!this.ui || G.versus || G.demo || G.mini || coachOn()) return false;
    const humanOff = G.poss === G.human, b = G.ball, ph = G.phase, H = [];
    const cx = this.ctx(), h = G.humanPlayer;
    if (ph === 'kickmeter' && cx === 'kick') return false;
    if (cx === 'preO') {
      const pass = G.play.off.type === 'pass';
      H.push([[PB.A], 'SNAP']); if (pass) H.push([[PB.LB, PB.A], 'HOT ROUTE'], [[PB.X], 'MOTION']);
      if (!coachCalls()) H.push([[PB.Y], 'AUDIBLE'], [[PB.VIEW], 'TIMEOUT']);
    } else if (cx === 'preD') {
      if (!(G.lock && lockedGuy())) H.push([[PB.B], 'SWITCH']);
      H.push([[PB.X], 'PRESS'], [[PB.RB], 'SHOW BLITZ']); if (!coachCalls()) H.push([[PB.Y], 'AUDIBLE'], [[PB.VIEW], 'TIMEOUT']);
    } else if (cx === 'throw') {
      H.push([[PB.A, PB.B, PB.X, PB.Y], meterOn() ? 'TAP = LOB  HOLD = POWER' : 'THROW']);
      if (!meterOn()) H.push([[PB.LT], 'LOB'], [[PB.RT], 'BULLET']);
      H.push([[PB.RB], 'THROW AWAY'], [[PB.LB], 'QB RUN']);
    } else if (cx === 'carrier') {
      H.push([[PB.MOVE], 'MOVE'], [[PB.RT], 'SPRINT'], [[PB.Y], 'JUKE'], [[PB.B], 'SPIN'], [[PB.A], 'STIFF ARM'], [[PB.X], 'SLIDE'], [[PB.LB], h && h.tuck ? 'ONE HAND' : 'TUCK']);
    } else if (cx === 'def') {
      if (b.flight && b.flight.kick === 'punt' && b.flight.intended === h && !G.fair) H.push([[PB.A], 'FAIR CATCH']);
      else if (b.flight && !b.flight.pitch) H.push([[PB.A], 'JUMP FOR THE PICK']);
      else if (h && h.engaged) H.push([[PB.X], 'SWIM MOVE']);
      else H.push([[PB.A], 'DIVE'], [[PB.RB], 'HIT STICK']);
      H.push([[PB.RT], 'SPRINT']); if (!(G.lock && lockedGuy())) H.push([[PB.B], 'SWITCH']);
    } else if (cx === 'off') {
      if (G.lock && h && h !== G.O[0] && G.bstate === 'snap' && !b.flight) H.push([[PB.A], 'CALL FOR IT']);
      else if (b.flight && b.flight.intended === h && catchMeterOn()) H.push([[PB.A], 'HOLD, LET GO IN THE GREEN']);
      else return false;
      H.push([[PB.MOVE], 'MOVE']);
    } else if (cx === 'celly') H.push([[PB.DPAD], 'OR'], [[PB.A, PB.B, PB.X, PB.Y], 'CELEBRATE']);
    else return false;
    G.hint = ''; G.padHint = H; return true;
  },
  drawHint(g) {
    const H = G.padHint; if (!H) return;
    const sc = this.scale(1.8); g.save(); g.translate(CW / 2, CH); g.scale(sc, sc); g.translate(-CW / 2, -CH); // phones: the canvas is drawn small, so the prompts grow
    g.font = 'italic 800 15px "Barlow Condensed", Arial, sans-serif'; g.textBaseline = 'middle';
    const r = 10, gw = k => padGW(k) / 24 * r * 2 + 3;
    let w = 0; for (const [ks, t] of H) w += ks.reduce((a, k) => a + gw(k), 0) + 4 + g.measureText(t).width + 16;
    w += 8;
    let x = CW / 2 - w / 2; const y = CH - 21;
    g.fillStyle = '#000000a8'; roundRect(g, x, y - 14, w, 28, 2); g.fill();
    x += 12;
    for (const [ks, t] of H) {
      for (const k of ks) { const ww = gw(k); this.drawGlyph(g, k, x + ww / 2 - 1.5, y, r); x += ww; }
      g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = 'italic 800 15px "Barlow Condensed", Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText(t, x + 3, y + 1);
      x += 4 + g.measureText(t).width + 16;
    }
    g.textBaseline = 'alphabetic'; g.restore();
  },
  // rumble on big moments (only the controller of the side it happened to)
  buzz(kind, side) {
    if (!this.rumble || !this.on || G.demo || (side != null && !isHumanSide(side))) return;
    const fx = { tackle: [110, 0.25, 0.35], hit: [280, 1, 0.7], sack: [360, 0.9, 0.8], td: [650, 0.55, 1], pick: [420, 0.8, 0.9] }[kind]; if (!fx) return;
    const pads = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(p => p && p.connected).slice(0, 2);
    pads.forEach((gp, i) => {
      if (G.versus && !G.online && side != null && (i === 0 ? G.p1 : 1 - G.p1) !== side) return;
      const va = gp.vibrationActuator;
      if (va && va.playEffect) try { const p = va.playEffect(va.type || 'dual-rumble', { startDelay: 0, duration: fx[0], strongMagnitude: fx[1], weakMagnitude: fx[2] }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    });
  },
  toast(i, t, on) {
    const el = $('padToast'); if (!el) return;
    el.innerHTML = `<svg viewBox="0 0 48 32"><path d="M14 5h20c6 0 9 4 11 12l2 8c1 4-2 6-5 4l-6-6H12l-6 6c-3 2-6 0-5-4l2-8C5 9 8 5 14 5z"/><circle cx="14" cy="14" r="3"/><circle cx="34" cy="11" r="1.8"/><circle cx="38" cy="15" r="1.8"/><circle cx="30" cy="15" r="1.8"/><circle cx="34" cy="19" r="1.8"/></svg>`
      + `<span><b>${t === 'ps' ? 'PLAYSTATION' : 'XBOX'} CONTROLLER ${on ? 'CONNECTED' : 'DISCONNECTED'}</b><i>${on ? (i ? 'Player 2 in a 2-player game' : 'Controls: pause menu or How to Play') : 'Plug it back in or press a button'}</i></span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('show'), 3200);
  },

  // ---------- CONTROLLER page (pause menu / How to Play) ----------
  openCtl(from) {
    const el = $('padCtl'); el.dataset.from = from; this.ctlType = this.type; this.renderCtl(); el.classList.add('show');
    if (this.cur) { this.cur.classList.remove('pfocus'); this.cur = null; }
  },
  renderCtl() {
    const t = this.ctlType || this.type, I = k => this.icon(k, t), N = PAD_NAMES[t];
    const cols = [
      ['BEFORE THE SNAP', [[[PB.A], 'Snap'], [[PB.LB, PB.A], 'Hot route: hold this bumper, press his button'], [[PB.X], 'Motion'], [[PB.Y], 'Audible'], [[PB.VIEW], 'Timeout'], [[PB.B], 'Defense: switch player'], [[PB.X], 'Defense: press coverage'], [[PB.RB], 'Defense: show blitz']]],
      ['PASSING', [[[PB.A, PB.B, PB.X, PB.Y], 'Throw to the receiver with that button'], [[], 'Tap = lob. Hold = power bar, let go in the green'], [[PB.LT], 'Hold for a lob'], [[PB.RT], 'Hold for a bullet'], [[PB.RB], 'Throw it away'], [[PB.LB], 'QB takes off running']]],
      ['RUNNING', [[[PB.MOVE], 'Move. Push a little to jog'], [[PB.RT], 'Sprint'], [[PB.Y], 'Juke'], [[PB.B], 'Spin'], [[PB.A], 'Stiff arm'], [[PB.FLICK], 'Flick: up / down juke, forward truck, back spin'], [[PB.X], 'Slide, give yourself up'], [[PB.LB], 'Tuck the ball (fewer fumbles)']]],
      ['DEFENSE', [[[PB.B], 'Switch to the guy closest to the ball'], [[PB.A], 'Dive tackle'], [[PB.A], 'Ball in the air: jump for the pick'], [[PB.RB], 'Hit stick (or flick the right stick)'], [[PB.X], 'Swim past a blocker'], [[PB.RT], 'Sprint']]],
      ['KICKS + MORE', [[[PB.A], 'Stop the kick meter'], [[PB.A], 'Punt coming down: fair catch'], [[PB.MENU], 'Pause'], [[PB.VIEW], 'Red flag after a close call'], [[PB.DPAD], 'Celebrate after a TD (or the face buttons)'], [[PB.DPAD], `Menus: move. ${N[0]} pick, ${N[1]} back, bumpers flip pages`]]]
    ];
    $('pcCols').innerHTML = '<canvas id="pcArt"></canvas>' + cols.map(([h, rows]) => `<div class="pcCol"><div class="pcH">${h}</div>${rows.map(([ks, txt]) => `<div class="pcR"><span class="pcG">${ks.map(I).join('')}</span><span>${txt}</span></div>`).join('')}</div>`).join('');
    $('pcTypeX').classList.toggle('on', t === 'xb'); $('pcTypeP').classList.toggle('on', t === 'ps');
    $('pcRumble').textContent = 'VIBRATION: ' + (this.rumble ? 'ON' : 'OFF');
    this.drawPadArt($('pcArt'), t);
  },
  // the controller picture with what the main buttons do
  drawPadArt(c, t) {
    const g = c.getContext('2d'), s = 2; c.width = 400 * s; c.height = 220 * s; g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, 400, 220);
    g.fillStyle = '#1c2430'; g.strokeStyle = '#ffffff40'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(130, 62); g.lineTo(270, 62); g.bezierCurveTo(318, 62, 334, 92, 346, 140); g.lineTo(356, 180); g.bezierCurveTo(362, 206, 334, 214, 318, 196);
    g.lineTo(286, 162); g.lineTo(114, 162); g.lineTo(82, 196); g.bezierCurveTo(66, 214, 38, 206, 44, 180); g.lineTo(54, 140); g.bezierCurveTo(66, 92, 82, 62, 130, 62); g.closePath(); g.fill(); g.stroke();
    const G2 = (k, x, y, r) => this.drawGlyph(g, k, x, y, r || 11, t);
    const ps = t === 'ps', lab = (txt, x, y, al, col) => { g.font = 'italic 800 13px "Barlow Condensed", Arial, sans-serif'; g.textAlign = al; g.textBaseline = 'middle'; g.fillStyle = col || '#eef1f5'; g.fillText(txt, x, y); };
    G2(PB.LT, 112, 22); G2(PB.LB, 112, 48); G2(PB.RT, 288, 22); G2(PB.RB, 288, 48);
    lab('LOB', 92, 22, 'right'); lab('SWITCH', 92, 48, 'right'); lab('SPRINT', 308, 22, 'left', '#f6c31c'); lab('HIT STICK', 308, 48, 'left');
    const lsX = ps ? 150 : 110, lsY = ps ? 140 : 100, dpX = ps ? 110 : 150, dpY = ps ? 100 : 140;
    G2(PB.MOVE, lsX, lsY, 14); G2(PB.DPAD, dpX, dpY, 12); G2(PB.FLICK, 250, 140, 14);
    G2(PB.Y, 290, 84, 10); G2(PB.X, 270, 104, 10); G2(PB.B, 310, 104, 10); G2(PB.A, 290, 124, 10);
    G2(PB.VIEW, 168, 92, 10); G2(PB.MENU, 232, 92, 10);
    lab('MOVE', lsX - 22, lsY + (ps ? 26 : 0), ps ? 'center' : 'right', '#f6c31c'); lab('MENUS', dpX + (ps ? -20 : 0), dpY + (ps ? 0 : 26), ps ? 'right' : 'center');
    lab('JUKE / TRUCK', 250, 172, 'center'); lab('TIMEOUT', 168, 76, 'center'); lab('PAUSE', 232, 76, 'center');
    lab(ps ? 'CROSS = SNAP / DIVE / KICK' : 'A = SNAP / DIVE / KICK', 200, 206, 'center', '#9aa6b5');
  }
};
// keyboard / mouse / finger used: back to their prompts
addEventListener('keydown', () => Pad.setUI(false), true);
addEventListener('pointerdown', e => { if (e.isTrusted) Pad.setUI(false); }, true);
(() => { // (this file loads after #stage, so the toast / bar / page can go in right away)
  const st = document.getElementById('stage'), $ = id => document.getElementById(id);
  st.insertAdjacentHTML('beforeend', `<div id="padToast"></div><div id="padBar"></div>
    <div id="padCtl" class="screen"><h2>Controller</h2>
      <div id="pcCols"></div>
      <div class="row"><button id="pcTypeX">XBOX</button><button id="pcTypeP">PLAYSTATION</button><button id="pcRumble">VIBRATION: ON</button><button id="pcBack" class="gold">BACK</button></div></div>`);
  $('pcTypeX').onclick = () => { Sound.click(); Pad.ctlType = 'xb'; Pad.renderCtl(); };
  $('pcTypeP').onclick = () => { Sound.click(); Pad.ctlType = 'ps'; Pad.renderCtl(); };
  $('pcRumble').onclick = () => { Sound.click(); Pad.rumble = !Pad.rumble; try { localStorage.setItem('bobblePadRumble', Pad.rumble ? '1' : '0'); } catch (e) {} Pad.renderCtl(); if (Pad.rumble) Pad.buzz('hit'); };
  $('pcBack').onclick = () => { Sound.click(); $('padCtl').classList.remove('show'); if (Pad.cur) { Pad.cur.classList.remove('pfocus'); Pad.cur = null; } };
  if ($('btnPadOpt')) $('btnPadOpt').onclick = () => { Sound.click(); Pad.openCtl('pause'); };
  if ($('btnHowPad')) $('btnHowPad').onclick = () => { Sound.click(); Pad.openCtl('how'); };
})();
