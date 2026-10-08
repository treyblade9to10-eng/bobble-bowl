// ---- Uniform locker: look at the helmet, jersey, pants and cleats up close and spin the player around ----
screens.push('locker'); menuScreens.push('locker');
(() => {
  const el = document.createElement('div');
  el.id = 'locker'; el.className = 'screen';
  el.innerHTML = `
    <h2 id="lkTitle">Uniforms</h2>
    <div id="lkStyles"></div>
    <div id="lkWrap">
      <div id="lkStage">
        <canvas id="lkCv" width="420" height="460"></canvas>
        <div id="lkSpin">
          <button class="lkRot" data-r="-1"><svg viewBox="0 0 24 24" class="chev"><path d="M15 5l-7 7 7 7"/></svg></button>
          <span>DRAG TO SPIN</span>
          <button class="lkRot" data-r="1"><svg viewBox="0 0 24 24" class="chev"><path d="M9 5l7 7-7 7"/></svg></button>
        </div>
      </div>
      <div id="lkParts"></div>
    </div>
    <div class="row"><button class="big gold" id="lkWear">WEAR THIS</button><button id="lkBack">BACK</button></div>`;
  document.getElementById('stage').appendChild(el);
})();

const Locker = {
  side: 0, style: 'home', part: 'full', ang: 0.5, spinV: 0, dragging: false, idle: 0,
  zoom: { x: 0, y: -150, s: 1 },
  open(side) {
    this.side = side; this.style = $(side === 0 ? 'optUni0' : 'optUni1').value || (side === 0 ? 'home' : 'away');
    this.part = 'full'; this.ang = 0.5; this.zoom = { ...this.PARTS.full };
    show('locker'); this.render(); this.loop();
  },
  team() { return TEAMS[sel.idx[this.side]]; },
  look() { return teamLook(this.team(), this.side === 0, this.style); },
  // camera targets for each part (in figure space: feet at y=0, head on top)
  PARTS: {
    full: { x: 0, y: -150, s: 1, name: 'FULL UNIFORM' },
    helmet: { x: 0, y: -262, s: 1.85, name: 'HELMET' },
    jersey: { x: 0, y: -150, s: 1.7, name: 'JERSEY' },
    pants: { x: 0, y: -72, s: 2.0, name: 'PANTS' },
    cleats: { x: 0, y: -12, s: 2.8, name: 'CLEATS' }
  },
  render() {
    const t = this.team(), lk = this.look();
    $('lkTitle').textContent = `${t.city} ${t.name}`;
    $('lkStyles').innerHTML = UNIFORMS.map(([v, n]) => `<button class="lkStyle${v === this.style ? ' on' : ''}" data-v="${v}">${n}</button>`).join('');
    $('lkStyles').querySelectorAll('button').forEach(b => b.onclick = () => { this.style = b.dataset.v; Sound.click(); this.render(); });
    const sw = (c, n) => `<span class="lkSw"><i style="background:${c}"></i>${n}</span>`;
    const rows = {
      full: [sw(lk.helmet, 'Helmet'), sw(lk.jersey, 'Jersey'), sw(lk.pants, 'Pants'), sw(lk.sock, 'Socks')],
      helmet: [sw(lk.helmet, 'Shell'), sw(lk.stripe, 'Stripe'), sw(lk.mask || '#c8c8c8', 'Facemask')],
      jersey: [sw(lk.jersey, 'Jersey'), sw(lk.num, 'Numbers'), sw(lk.trim, 'Trim')],
      pants: [sw(lk.pants, 'Pants'), sw(lk.trim, 'Stripe'), sw(lk.sock, 'Socks')],
      cleats: [sw(this.cleat(lk), 'Cleats'), sw(lk.trim, 'Accent')]
    };
    $('lkParts').innerHTML = Object.keys(this.PARTS).map(k => `<button class="lkPart${k === this.part ? ' on' : ''}" data-k="${k}"><b>${this.PARTS[k].name}</b><span class="lkSws">${rows[k].join('')}</span></button>`).join('');
    $('lkParts').querySelectorAll('button').forEach(b => b.onclick = () => { this.part = b.dataset.k; Sound.click(); this.render(); });
  },
  cleat(lk) { return this.style === 'rush' ? lk.jersey : textOn(lk.pants) === '#111' ? '#f2f2f2' : '#151515'; },
  loop() {
    if (!$('locker').classList.contains('show')) return;
    const dt = 1 / 60;
    if (!this.dragging) { this.ang += this.spinV * dt; this.spinV *= 0.94; this.idle += dt; if (this.idle > 2.5 && Math.abs(this.spinV) < 0.3) this.ang += 0.5 * dt; }
    const tg = this.PARTS[this.part], z = this.zoom, k = 1 - Math.exp(-dt * 7);
    z.x += (tg.x - z.x) * k; z.y += (tg.y - z.y) * k; z.s += (tg.s - z.s) * k;
    this.draw();
    requestAnimationFrame(() => this.loop());
  },
  draw() {
    const cv = $('lkCv'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, W * 0.75);
    bg.addColorStop(0, '#2a3446'); bg.addColorStop(1, '#0c1016'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const t = this.team(), lk = this.look(), qb = t.off[0];
    const z = this.zoom, base = 1.25;
    g.save(); g.translate(W / 2, H * 0.52); g.scale(base * z.s, base * z.s); g.translate(-z.x, -z.y);
    // floor spot
    g.fillStyle = '#00000066'; g.beginPath(); g.ellipse(0, 2, 46, 11, 0, 0, 7); g.fill();
    drawTurntable(g, lk, this.cleat(lk), { num: qb[2], name: qb[1].split(' ').slice(-1)[0], skin: qb[5] || 0 }, this.ang);
    g.restore();
  }
};

// a front/side/back view of a bobblehead player rotated by `a` (0 = facing you, PI = back)
function drawTurntable(g, lk, cleat, pl, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const proj = (X, Z) => ({ x: X * c + Z * s, d: -X * s + Z * c }); // screen x, depth (bigger = closer)
  const parts = [];
  // legs + cleats
  for (const side of [-1, 1]) {
    const p = proj(side * 12, 0);
    parts.push({ d: p.d, f: () => {
      const x = p.x;
      g.strokeStyle = OUT; g.lineCap = 'round';
      g.lineWidth = 20; g.beginPath(); g.moveTo(x, -98); g.lineTo(x, -8); g.stroke();
      g.strokeStyle = lk.pants; g.lineWidth = 16; g.beginPath(); g.moveTo(x, -98); g.lineTo(x, -52); g.stroke();
      // pants stripe down the outside of the leg
      const sd = proj(side * 19, 0), vis = side * -s; // outside of this leg faces the camera when vis > 0
      if (Math.abs(sd.x - x) > 1.5) { g.strokeStyle = lk.trim; g.lineWidth = 3; g.globalAlpha = Math.min(1, Math.abs(s) + 0.2); g.beginPath(); g.moveTo(x + Math.sign(sd.x - x) * 5.5, -96); g.lineTo(x + Math.sign(sd.x - x) * 5.5, -56); g.stroke(); g.globalAlpha = 1; }
      void vis;
      g.strokeStyle = lk.sock; g.lineWidth = 14; g.beginPath(); g.moveTo(x, -52); g.lineTo(x, -10); g.stroke();
      // cleat: long from the side, short from the front
      const len = 9 + 9 * Math.abs(s), toe = s * 6;
      g.fillStyle = cleat; g.strokeStyle = OUT; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(x + toe, -5, len, 7, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = lk.trim; g.fillRect(x + toe - len * 0.45, -7, len * 0.9, 2.5);
      g.fillStyle = '#222'; for (let i = -1; i <= 1; i++) g.fillRect(x + toe + i * len * 0.5 - 1.5, 1, 3, 3); // studs
    } });
  }
  // arms
  for (const side of [-1, 1]) {
    const p = proj(side * 40, 0);
    parts.push({ d: p.d, f: () => {
      const x = p.x;
      g.strokeStyle = OUT; g.lineCap = 'round'; g.lineWidth = 17;
      g.beginPath(); g.moveTo(x, -178); g.lineTo(x + side * c * 4, -120); g.stroke();
      g.strokeStyle = lk.jersey; g.lineWidth = 13; g.beginPath(); g.moveTo(x, -178); g.lineTo(x + side * c * 2, -152); g.stroke();
      g.strokeStyle = lk.trim; g.lineWidth = 13; g.beginPath(); g.moveTo(x + side * c * 1.7, -157); g.lineTo(x + side * c * 2, -152); g.stroke();
      g.strokeStyle = SKIN[pl.skin]; g.lineWidth = 12; g.beginPath(); g.moveTo(x + side * c * 2, -150); g.lineTo(x + side * c * 4, -122); g.stroke();
      g.fillStyle = '#f2f2f2'; g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.arc(x + side * c * 4, -116, 7, 0, 7); g.fill(); g.stroke();
    } });
  }
  // torso (wide from the front, thin from the side)
  parts.push({ d: 0, f: () => {
    const hw = Math.hypot(34 * c, 27 * s), top = -186, bot = -92;
    // pants top / belt
    g.fillStyle = lk.pants; g.strokeStyle = OUT; g.lineWidth = 3; roundRect(g, -hw * 0.86, bot - 8, hw * 1.72, 18, 6); g.fill(); g.stroke();
    const tg = g.createLinearGradient(-hw, 0, hw, 0);
    tg.addColorStop(0, shade(lk.jersey, -0.2)); tg.addColorStop(0.5 + s * 0.3, shade(lk.jersey, 0.08)); tg.addColorStop(1, shade(lk.jersey, -0.2));
    g.fillStyle = tg; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-hw * 0.82, bot); g.lineTo(-hw * 1.05, top + 14); g.quadraticCurveTo(-hw * 1.1, top - 4, -hw * 0.6, top - 4);
    g.lineTo(hw * 0.6, top - 4); g.quadraticCurveTo(hw * 1.1, top - 4, hw * 1.05, top + 14); g.lineTo(hw * 0.82, bot); g.closePath(); g.fill(); g.stroke();
    // collar
    g.strokeStyle = lk.trim; g.lineWidth = 4; g.beginPath(); g.ellipse(s * 8, top - 2, 13 * Math.max(0.3, Math.abs(c)), 5, 0, 0, Math.PI); g.stroke();
    // number on the front, name + number on the back
    const front = c > 0.12, back = c < -0.12;
    if (front || back) {
      g.save(); g.translate(s * 20 * (front ? 1 : -1) * 0.5, -132); g.scale(Math.abs(c), 1);
      g.font = '900 54px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = lk.trim === lk.num ? shade(lk.jersey, -0.5) : lk.trim; g.fillStyle = lk.num;
      g.strokeText(String(pl.num), 0, 4); g.fillText(String(pl.num), 0, 4);
      if (back) { g.font = '800 15px "Barlow Condensed", Arial, sans-serif'; g.lineWidth = 0; g.fillStyle = lk.num; g.fillText(pl.name.toUpperCase(), 0, -36); }
      g.restore();
    }
  } });
  parts.sort((p, q) => p.d - q.d).forEach(p => p.f());
  drawTurnHelmet(g, lk, pl, a);
}

function drawTurnHelmet(g, lk, pl, a) {
  const c = Math.cos(a), s = Math.sin(a), R = 52, cy = -248;
  g.save(); g.translate(0, cy);
  const sh = g.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.15, 0, 0, R * 1.05);
  sh.addColorStop(0, shade(lk.helmet, 0.45)); sh.addColorStop(0.45, lk.helmet); sh.addColorStop(1, shade(lk.helmet, -0.35));
  g.fillStyle = sh; g.strokeStyle = OUT; g.lineWidth = 3.5;
  g.beginPath(); g.ellipse(0, 0, R * 1.04, R, 0, 0, 7); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.ellipse(0, 0, R * 1.04, R, 0, 0, 7); g.clip();
  // center stripe runs front to back over the top: a line from the front it's a thin band, from the side it's an arc
  g.strokeStyle = lk.stripe; g.lineWidth = R * 0.26;
  g.beginPath(); g.ellipse(-s * R * 0.08, R * 0.2, Math.max(1, R * 0.88 * Math.abs(s)), R * 0.98, 0, Math.PI, Math.PI * 2); g.stroke();
  // side decal (team number) on the side facing you
  for (const side of [-1, 1]) {
    const dx = side * c, depth = -side * s; // side of the helmet facing the camera when depth > 0
    if (depth > 0.15) {
      g.save(); g.translate(side * R * 0.55 * c, -R * 0.05); g.scale(depth, 1);
      g.font = `900 ${Math.round(R * 0.62)}px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = shade(lk.helmet, -0.6); g.fillStyle = lk.stripe === lk.helmet ? '#fff' : lk.stripe;
      g.strokeText(String(pl.num), 0, 0); g.fillText(String(pl.num), 0, 0); g.restore();
      g.fillStyle = shade(lk.helmet, -0.55); g.beginPath(); g.ellipse(-side * s * R * 0.05 + dx * R * 0.2, R * 0.3, R * 0.11 * depth + 1, R * 0.11, 0, 0, 7); g.fill();
    }
  }
  g.restore();
  // face + facemask when we can see the front
  if (c > -0.1) {
    const fx = s * R * 0.6, k = Math.max(0.42, c), fy = R * 0.18;
    g.fillStyle = SKIN[pl.skin]; g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(fx, fy, R * 0.55 * k, R * 0.62, 0, 0, 7); g.fill(); g.stroke();
    if (c > 0.35) for (const ex of [-0.22, 0.22]) {
      const x = fx + ex * R * k;
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, fy - R * 0.14, R * 0.13 * k, R * 0.16, 0, 0, 7); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(x + s * 3, fy - R * 0.13, R * 0.07, 0, 7); g.fill();
      g.fillRect(x - R * 0.09 * k, fy + R * 0.06, R * 0.18 * k, R * 0.05); // eye black
    }
    const mc = lk.mask || '#c8c8c8';
    for (const [col, w] of [[OUT, 5], [mc, 3]]) {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
      for (const yy of [0.12, 0.36, 0.58]) { g.moveTo(fx - R * 0.6 * k, fy + R * yy); g.lineTo(fx + R * 0.6 * k, fy + R * yy); }
      g.moveTo(fx, fy + R * 0.1); g.lineTo(fx, fy + R * 0.6);
      g.stroke();
    }
  }
  g.restore();
}

// controls: drag to spin, arrow buttons, part + style buttons
(() => {
  const cv = $('lkCv'); let lastX = 0, lastT = 0;
  cv.addEventListener('pointerdown', e => { Locker.dragging = true; lastX = e.clientX; lastT = performance.now(); Locker.spinV = 0; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!Locker.dragging) return;
    const dx = e.clientX - lastX, now = performance.now(), dtt = Math.max(1, now - lastT) / 1000;
    Locker.ang += dx * 0.012; Locker.spinV = dx * 0.012 / dtt * 0.6; lastX = e.clientX; lastT = now; Locker.idle = 0;
  });
  const up = () => { Locker.dragging = false; Locker.idle = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  document.querySelectorAll('.lkRot').forEach(b => b.onclick = () => { Locker.spinV = 0; Locker.idle = 0; Locker.ang += +b.dataset.r * Math.PI / 4; });
  $('lkWear').onclick = () => { $(Locker.side === 0 ? 'optUni0' : 'optUni1').value = Locker.style; saveOpts(); Sound.click(); show('select'); renderUniBtns(); };
  $('lkBack').onclick = () => { Sound.click(); show('select'); };
  window.addEventListener('keydown', e => {
    if (!$('locker').classList.contains('show')) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { Locker.ang -= Math.PI / 4; Locker.idle = 0; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { Locker.ang += Math.PI / 4; Locker.idle = 0; }
    if (e.code === 'Escape') { show('select'); }
  });
})();

// uniform buttons on the team select screen (they open the locker)
function renderUniBtns() {
  for (const side of [1, 0]) {
    const b = $('uniBtn' + side), v = $('optUni' + side).value, n = (UNIFORMS.find(u => u[0] === v) || UNIFORMS[0])[1];
    b.innerHTML = `${side === 0 ? 'HOME' : 'AWAY'} UNIFORM: <b>${n}</b>`;
  }
}
(() => {
  const box = $('selOpts');
  for (const side of [0, 1]) { const lab = $('optUni' + side).closest('label'); if (lab) lab.style.display = 'none'; }
  for (const side of [1, 0]) {
    const b = document.createElement('button'); b.id = 'uniBtn' + side; b.className = 'uniBtn';
    b.onclick = () => { Sound.click(); Locker.open(side); };
    box.insertBefore(b, box.children[side === 1 ? 0 : 1]);
  }
  renderUniBtns();
})();
