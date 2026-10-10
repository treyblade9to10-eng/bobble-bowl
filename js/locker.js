// ---- Uniform Room: both teams side by side. Pick a full set, or mix and match helmet / jersey / pants ----
screens.push('locker'); menuScreens.push('locker');
(() => {
  const el = document.createElement('div');
  el.id = 'locker'; el.className = 'screen';
  el.innerHTML = `
    <div id="lkHead"><h2>Uniforms</h2><div id="lkClash"></div><button class="big gold" id="lkDone">DONE</button></div>
    <div id="lkCols">${[1, 0].map(s => `
      <div class="lkCol" data-side="${s}">
        <div class="lkTeam"><span class="lkSide">${s === 0 ? 'HOME' : 'AWAY'}</span><b class="lkName"></b></div>
        <div class="lkBody">
          <canvas class="lkBig" width="260" height="300"></canvas>
          <div class="lkCtl">
            <div class="lkSets"></div>
            <div class="lkMixT">MIX AND MATCH</div>
            <div class="lkMix"></div>
          </div>
        </div>
      </div>`).join('')}
    </div>`;
  document.getElementById('stage').appendChild(el);
})();

// uniform value: a set ('home', 'rush', ...) or a mix 'mix:helmetSet,jerseySet,pantsSet'
const uniParts = v => { if (v && v.startsWith('mix:')) { const [h, j, p] = v.slice(4).split(','); return { h, j, p }; } return { h: v, j: v, p: v }; };
const uniValue = ({ h, j, p }) => h === j && j === p ? h : `mix:${h},${j},${p}`;
const uniName = v => { const n = k => (UNIFORMS.find(u => u[0] === k) || UNIFORMS[0])[1]; if (!v || !v.startsWith('mix:')) return n(v || 'home'); return 'Custom'; };
function setUni(side, v) {
  const s = $('optUni' + side);
  if (![...s.options].some(o => o.value === v)) { const o = document.createElement('option'); o.value = v; o.textContent = uniName(v); s.appendChild(o); }
  s.value = v;
}
const cleatFor = (lk, style) => style === 'rush' ? lk.jersey : textOn(lk.pants) === '#111' ? '#f2f2f2' : '#151515';
const colorGap = (a, b) => { const n = h => { const x = parseInt(h.replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [x >> 16, (x >> 8) & 255, x & 255]; }; const [p, q] = [n(a), n(b)]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

const Locker = {
  ang: [0.5, 0.5], spinV: [0, 0], drag: -1, idle: 0,
  open() {
    this.ang = [0.45, -0.45]; this.spinV = [0, 0];
    show('locker'); this.render(); this.loop();
  },
  team(side) { return TEAMS[sel.idx[side]]; },
  val(side) { return $('optUni' + side).value || (side === 0 ? 'home' : 'away'); },
  look(side, v) { return teamLook(this.team(side), side === 0, v || this.val(side)); },
  pl(side) { const qb = this.team(side).off[0]; return { num: qb[2], name: qb[1].split(' ').slice(-1)[0], skin: qb[5] || 0 }; },
  pick(side, v) { setUni(side, v); saveOpts(); Sound.click(); this.render(); },
  render() {
    for (const side of [0, 1]) {
      const col = document.querySelector(`.lkCol[data-side="${side}"]`), t = this.team(side), v = this.val(side), parts = uniParts(v);
      col.style.setProperty('--tc', t.c1);
      col.querySelector('.lkName').textContent = `${t.city} ${t.name}`;
      // full sets with a little picture of each
      col.querySelector('.lkSets').innerHTML = UNIFORMS.map(([k, n]) => `<button class="lkSet${k === v ? ' on' : ''}" data-v="${k}"><canvas width="84" height="96"></canvas><span>${n}</span></button>`).join('');
      col.querySelectorAll('.lkSet').forEach(b => {
        this.mini(b.querySelector('canvas'), side, b.dataset.v);
        b.onclick = () => this.pick(side, b.dataset.v);
      });
      // mix and match rows
      const rows = [['h', 'HELMET', lk => [lk.helmet, lk.stripe]], ['j', 'JERSEY', lk => [lk.jersey, lk.num]], ['p', 'PANTS', lk => [lk.pants, lk.sock]]];
      col.querySelector('.lkMix').innerHTML = rows.map(([k, label, cols]) => `<div class="lkRow"><span>${label}</span>${UNIFORMS.map(([u, n]) => {
        const c = cols(teamLook(t, side === 0, u));
        return `<button class="lkChip${parts[k] === u ? ' on' : ''}" data-k="${k}" data-u="${u}" title="${n}"><i style="background:linear-gradient(135deg, ${c[0]} 55%, ${c[1]} 55%)"></i></button>`;
      }).join('')}</div>`).join('');
      col.querySelectorAll('.lkChip').forEach(b => b.onclick = () => { const p = uniParts(this.val(side)); p[b.dataset.k] = b.dataset.u; this.pick(side, uniValue(p)); });
    }
    // can you tell the two teams apart?
    const ja = this.look(1).jersey, jh = this.look(0).jersey, clash = colorGap(ja, jh) < 90;
    $('lkClash').innerHTML = clash ? `<span>These jerseys look alike. Hard to tell the teams apart.</span><button id="lkFix">FIX IT</button>` : '';
    if (clash) $('lkFix').onclick = () => {
      const opts = ['away', 'home', 'rush', 'throwback'].filter(u => colorGap(this.look(0).jersey, this.look(1, u).jersey) >= 90);
      if (opts.length) this.pick(1, opts[0]); else this.pick(0, 'home');
    };
  },
  mini(cv, side, v) {
    const g = cv.getContext('2d'), lk = this.look(side, v);
    g.clearRect(0, 0, cv.width, cv.height);
    g.save(); g.translate(cv.width / 2, cv.height - 4); g.scale(0.29, 0.29);
    drawTurntable(g, lk, cleatFor(lk, v), this.pl(side), side === 0 ? 0.4 : -0.4);
    g.restore();
  },
  loop() {
    if (!$('locker').classList.contains('show')) return;
    const dt = 1 / 60;
    this.idle += dt;
    for (const s of [0, 1]) if (this.drag !== s) { this.ang[s] += this.spinV[s] * dt; this.spinV[s] *= 0.94; if (this.idle > 2.5 && Math.abs(this.spinV[s]) < 0.3) this.ang[s] += (s === 0 ? 0.45 : -0.45) * dt; }
    document.querySelectorAll('.lkBig').forEach(cv => {
      const side = +cv.closest('.lkCol').dataset.side, g = cv.getContext('2d'), W = cv.width, H = cv.height, v = this.val(side), lk = this.look(side, v);
      g.clearRect(0, 0, W, H);
      const bg = g.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, W * 0.8);
      bg.addColorStop(0, shade(this.team(side).c1, -0.35)); bg.addColorStop(1, '#0c1016'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, H - 14); g.scale(0.88, 0.88);
      g.fillStyle = '#00000066'; g.beginPath(); g.ellipse(0, 2, 46, 11, 0, 0, 7); g.fill();
      drawTurntable(g, lk, cleatFor(lk, v), this.pl(side), this.ang[side]);
      g.restore();
    });
    requestAnimationFrame(() => this.loop());
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

// controls: drag a player to spin him
(() => {
  let lastX = 0, lastT = 0;
  document.querySelectorAll('.lkBig').forEach(cv => {
    const side = +cv.closest('.lkCol').dataset.side;
    cv.addEventListener('pointerdown', e => { Locker.drag = side; lastX = e.clientX; lastT = performance.now(); Locker.spinV[side] = 0; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (Locker.drag !== side) return;
      const dx = e.clientX - lastX, now = performance.now(), dtt = Math.max(1, now - lastT) / 1000;
      Locker.ang[side] += dx * 0.014; Locker.spinV[side] = dx * 0.014 / dtt * 0.6; lastX = e.clientX; lastT = now; Locker.idle = 0;
    });
    const up = () => { Locker.drag = -1; Locker.idle = 0; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  });
  $('lkDone').onclick = () => { saveOpts(); Sound.click(); show('select'); renderUniBtns(); };
  window.addEventListener('keydown', e => { if ($('locker').classList.contains('show') && (e.code === 'Escape' || e.code === 'Enter')) $('lkDone').onclick(); });
})();

// one UNIFORMS button on the team select screen shows both teams' colors and opens the room
function renderUniBtns() {
  const b = $('uniBtn'); if (!b || typeof sel === 'undefined') return;
  const sw = side => { try { const lk = teamLook(TEAMS[sel.idx[side]], side === 0, $('optUni' + side).value); return `<i style="background:linear-gradient(135deg, ${lk.helmet} 50%, ${lk.jersey} 50%)"></i>`; } catch (e) { return ''; } };
  b.innerHTML = `UNIFORMS ${sw(1)}<b>${uniName($('optUni1').value)}</b> ${sw(0)}<b>${uniName($('optUni0').value)}</b>`;
}
(() => {
  const box = $('selOpts');
  for (const side of [0, 1]) { const lab = $('optUni' + side).closest('label'); if (lab) lab.style.display = 'none'; }
  const b = document.createElement('button'); b.id = 'uniBtn'; b.className = 'uniBtn';
  b.onclick = () => { Sound.click(); Locker.open(); };
  box.insertBefore(b, box.children[0]);
  // custom mixes saved from last time need an <option> to live in
  try { const o = JSON.parse(localStorage.getItem('bobbleOpts') || 'null'); if (o) for (const s of [0, 1]) if (o['optUni' + s]) setUni(s, o['optUni' + s]); } catch (e) {}
  renderUniBtns();
})();
