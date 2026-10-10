// ---- Controllers (Xbox / PlayStation / any "standard" gamepad) ----
// Left stick moves. A = snap / dive / jump / kick, B = juke / swim, X = spin, Y = stiff arm, RT = sprint, LT = lob, RB = hit stick, LB = switch,
// when you can throw: A B X Y = receivers 1-4. VIEW/SELECT = timeout, START = pause. Menus: d-pad / stick to move, A to pick, B to go back.
const Pad = {
  prev: [{}, {}], on: false, navT: 0, focusI: -1,
  poll(dt) {
    const pads = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(p => p && p.connected);
    Input.pads = [null, null];
    if (!pads.length) return;
    if (!this.on) { this.on = true; document.body.classList.add('pad'); }
    this.navT -= dt;
    pads.slice(0, 2).forEach((gp, i) => this.one(gp, i, dt));
  },
  one(gp, i, dt) {
    const b = k => !!(gp.buttons[k] && gp.buttons[k].pressed), was = this.prev[i], now = {};
    for (let k = 0; k < gp.buttons.length; k++) now[k] = b(k);
    const hit = k => now[k] && !was[k];
    this.prev[i] = now;
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (now[14]) x = -1; if (now[15]) x = 1; if (now[12]) y = -1; if (now[13]) y = 1;
    const m = Math.hypot(x, y);
    Input.pads[i] = m > 0.22 ? { x: x / Math.max(1, m), y: y / Math.max(1, m), m: Math.min(1, m) } : null;
    // 2 players: the 2nd controller presses player 2's keys
    const code = c => (i === 1 && Input.versus) ? (P2KEYS[c] || c) : c;
    const press = c => { Input.pressed[code(c)] = true; }, hold = (c, on) => { if (on) Input.down[code(c)] = true; else if (was.__h && was.__h[c]) Input.release_(code(c)); };
    now.__h = { ShiftLeft: now[7], ControlLeft: now[6] };
    hold('ShiftLeft', now[7]); hold('ControlLeft', now[6]);
    if (hit(9)) { if (typeof togglePause === 'function' && G.teams && !G.demo) togglePause(); }
    if (this.menu()) return this.menuNav(gp, hit, x, y, i);
    const throwing = typeof humanCanThrow === 'function' && humanCanThrow();
    if (G.phase === 'presnap') {
      if (hit(0)) press('Space'); if (hit(3)) press('KeyZ'); if (hit(8)) press('KeyT'); if (hit(4)) press('KeyQ');
      if (hit(2)) press(G.poss === G.human ? 'KeyM' : 'KeyV'); if (hit(1) && G.poss !== G.human) press('KeyB');
      if (hit(1) && G.poss === G.human) press('Digit3');
    } else if (throwing) {
      if (hit(0)) press('Digit1'); if (hit(1)) press('Digit2'); if (hit(2)) press('Digit3'); if (hit(3)) press('Digit4');
    } else if (G.phase === 'dead' && G.cellyGuy) {
      if (hit(12)) press('ArrowUp'); if (hit(13)) press('ArrowDown'); if (hit(14)) press('ArrowLeft'); if (hit(15)) press('ArrowRight');
      if (hit(0)) press('Digit1'); if (hit(1)) press('Digit2'); if (hit(2)) press('Digit3'); if (hit(3)) press('Digit4'); if (hit(4)) press('KeyE'); if (hit(5)) press('KeyF');
    } else {
      if (hit(0)) press('Space'); if (hit(1)) press('KeyE'); if (hit(2)) press('KeyF'); if (hit(3)) press('KeyR');
      if (hit(5)) press('KeyC'); if (hit(4)) press('KeyQ'); if (hit(8)) press('KeyT');
    }
  },
  // any menu / play-call screen showing?
  menu() { return [...document.querySelectorAll('.screen.show')].length > 0; },
  menuNav(gp, hit, x, y, i) {
    const scr = [...document.querySelectorAll('.screen.show')].pop();
    const items = [...scr.querySelectorAll('button, .pcard, .mdcard, .modecard, .dRow, .trRow, select')].filter(e => e.offsetParent !== null && !e.disabled);
    if (!items.length) return;
    let cur = items.indexOf(document.activeElement);
    if (cur < 0) { cur = 0; items[0].focus(); }
    if (this.navT <= 0 && (Math.abs(x) > 0.5 || Math.abs(y) > 0.5)) {
      this.navT = 0.18;
      // move to the closest item in that direction
      const r0 = items[cur].getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
      const dx = Math.abs(x) > Math.abs(y) ? Math.sign(x) : 0, dy = dx ? 0 : Math.sign(y);
      let best = null, bd = 1e9;
      for (const e of items) {
        if (e === items[cur]) continue;
        const r = e.getBoundingClientRect(), ex = r.left + r.width / 2 - cx, ey = r.top + r.height / 2 - cy;
        if (dx && Math.sign(ex) !== dx) continue; if (dy && Math.sign(ey) !== dy) continue;
        const dd = (dx ? Math.abs(ex) + Math.abs(ey) * 2.5 : Math.abs(ey) + Math.abs(ex) * 2.5);
        if (dd < bd) { bd = dd; best = e; }
      }
      if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); Sound.click(); }
    }
    if (hit(0)) { const e = document.activeElement; if (e && items.includes(e)) e.click(); }
    if (hit(1)) { const back = [...scr.querySelectorAll('button')].find(e => /BACK|RESUME|MENU/i.test(e.textContent) && e.offsetParent !== null); if (back) back.click(); }
  }
};
