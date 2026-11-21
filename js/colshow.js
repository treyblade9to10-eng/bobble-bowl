// ---- College football look: a scrappy college TV scorebug, a run-out where every player slaps the team sign and the
// first one bursts the paper banner, a GAME DAY intro card and a striped student section. Only for games with a college
// team in them (Quick Game COLLEGE switch, career college games); NFL games keep their own look.
const COL_IDS = new Set(COLLEGES.map(c => c.id));
const isColTeam = t => !!t && !t.custom && (!!t.college || COL_IDS.has(t.id));
const colGame = G => !!(G && G.teams && (isColTeam(G.teams[0]) || isColTeam(G.teams[1])));

const ColShow = {
  INK: '#16130f', PAPER: '#efe8d8', TAG: '#ffd23f',
  CS: { bar: ['#2a241d', '#16130f'], acc: '#ffd23f', down: '#ffd23f' }, // crunch-time tab + play clock colors under the college bug
  SHORT: { 'Ohio State': 'OHIO ST', 'Penn State': 'PENN ST', 'Florida State': 'FLORIDA ST', 'Iowa State': 'IOWA ST', 'Kansas State': 'K-STATE', 'Arizona State': 'ARIZONA ST',
    'Boise State': 'BOISE ST', 'App State': 'APP ST', 'South Carolina': 'S. CAROLINA', 'North Carolina': 'N. CAROLINA', 'Northern Illinois': 'N. ILLINOIS',
    'Virginia Tech': 'VA TECH', 'Georgia Tech': 'GA TECH', 'James Madison': 'J. MADISON', 'Notre Dame': 'NOTRE DAME', 'Texas Tech': 'TEXAS TECH' },
  short(t) { return isColTeam(t) ? (this.SHORT[t.city] || t.city.toUpperCase()) : t.name.toUpperCase(); },
  // a made-up preseason poll: program size first, then how good the real lineup is (top 25 get a number)
  poll: null,
  rank(t) {
    if (!isColTeam(t)) return 0;
    if (!this.poll) {
      const R = typeof COLLEGE_ROSTERS !== 'undefined' ? COLLEGE_ROSTERS : {};
      const sc = COLLEGES.map(c => { const l = R[c.id] ? R[c.id].off.concat(R[c.id].def) : []; const ov = l.length ? l.reduce((a, p) => a + p[3], 0) / l.length : 60 + c.pr * 3; return [c.id, c.pr * 4 + ov + (hashStr(c.id) % 100) / 1000]; });
      sc.sort((a, b) => b[1] - a[1]); this.poll = {}; sc.slice(0, 25).forEach(([id], i) => { this.poll[id] = i + 1; });
    }
    return this.poll[t.id] || 0;
  },
  // the words on the sign over the tunnel (our own lines; the school name goes under them)
  SIGN: ['EVERY SNAP FOR', 'FOUR QUARTERS FOR', 'LEAVE IT ALL FOR', 'NOBODY OUTWORKS', 'THIS FIELD BELONGS TO', 'TODAY WE PLAY FOR', 'TOUCH IT. GO WIN FOR', 'ONE MORE REP FOR'],
  slogan(t) { return this.SIGN[hashStr(t.id + 'sign') % this.SIGN.length]; },
  // light enough to read on dark ink: a school's second color, else its first, else gold
  pop(t) { return lum(t.c2) > 0.3 && lum(t.c2) < 0.97 ? t.c2 : lum(t.c1) > 0.3 ? t.c1 : this.TAG; },

  // ---------- scorebug: same size as the NFL one (640 x 46) ----------
  hud(g, G) {
    const W = 640, x0 = (CW - W) / 2, y0 = 6, H = 46, T0 = G.teams[0], T1 = G.teams[1], vs = G.versus ? (G.online ? 'o' + G.human : 'v' + G.p1) : '';
    const hk = ['col', CW, T0.id, T0.c1, T0.c2, T1.id, T1.c1, T1.c2, G.score[0], G.score[1], G.poss, G.timeouts ? G.timeouts.join() : '', vs, typeof Logo !== 'undefined' ? picId(Logo.canvas(T0, 64)) + picId(Logo.canvas(T1, 64)) : ''].join('|');
    const hc = hudLayer(hk, Math.floor(x0) - 4, W + 10, y0 + H + 6, hg => this.bugBase(hg, G, x0, y0, W, H));
    if (hc) g.drawImage(hc, hc.X0, 0); else this.bugBase(g, G, x0, y0, W, H);
    // clock + down and distance change every frame
    const cx = x0 + W - 110, q = G.quarter > 4 ? 'OT' : ordinal(G.quarter), c = Math.max(0, Math.ceil(G.clock));
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.font = '800 20px "Barlow Condensed", Arial, sans-serif';
    g.fillText(`${q}   ${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`, cx, y0 + 15);
    const dt = G.downText(); g.font = 'italic 900 14px "Barlow Condensed", "Arial Black", sans-serif';
    const dw = Math.min(128, g.measureText(dt).width + 16);
    g.fillStyle = this.TAG; g.beginPath(); g.moveTo(cx - dw / 2 + 4, y0 + 26); g.lineTo(cx + dw / 2 + 4, y0 + 26); g.lineTo(cx + dw / 2 - 4, y0 + 41); g.lineTo(cx - dw / 2 - 4, y0 + 41); g.closePath(); g.fill();
    g.fillStyle = this.INK; g.fillText(dt, cx, y0 + 34, dw - 8);
    // everything that hangs under the scorebug, same as the NFL one
    const moOn = !G.mini && !G.demo && G.mo != null;
    if (moOn) drawMomentum(g, x0 + 57, y0 + H + 3, 396);
    const crowdOn = moOn && Crowd.show();
    if (crowdOn) drawCrowd(g, x0 + W - 126, y0 + H + 6, Crowd.level());
    if (typeof Flow !== 'undefined' && !G.mini) { Flow.drawDrill(g, x0 + W - 96, y0 + H + 6 + (crowdOn ? 26 : 0)); Flow.drawTag(g); }
    if (typeof drawWindTag === 'function') drawWindTag(g, G, x0, y0, W);
    drawHUDRest(g, G, this.CS, x0, y0, W, H);
  },
  bugBase(g, G, x0, y0, W, H) {
    const ink = this.INK, para = (x, y, w, h, sl) => { g.beginPath(); g.moveTo(x + sl, y); g.lineTo(x + w, y); g.lineTo(x + w - sl, y + h); g.lineTo(x, y + h); g.closePath(); };
    // a paper strip with a hard ink shadow (printed-sticker look)
    g.fillStyle = ink; g.fillRect(x0 + 3, y0 + 3, W, H);
    g.fillStyle = this.PAPER; g.fillRect(x0, y0, W, H);
    g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(x0 + 1, y0 + 1, W - 2, H - 2);
    // COLLEGE FOOTBALL tag, stuck on a little crooked
    g.save(); g.translate(x0 + 28, y0 + H / 2); g.rotate(-0.06);
    g.fillStyle = '#c8102e'; g.fillRect(-23, -17, 46, 34); g.fillStyle = '#ffffff30'; g.fillRect(-23, -17, 46, 3);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 12px "Barlow Condensed", Arial, sans-serif';
    g.fillText('COLLEGE', 0, -6, 42); g.fillText('FOOTBALL', 0, 7, 42);
    g.restore();
    const cell = (t, s, x, poss) => {
      const w = 196, y = y0 + 5, h = H - 10, side = G.teams.indexOf(t), fg = textOn(t.c1);
      g.fillStyle = t.c1; para(x, y, w, h, 7); g.fill();
      g.save(); para(x, y, w, h, 7); g.clip(); g.fillStyle = t.c2; g.fillRect(x, y + h - 3, w, 3);
      g.fillStyle = ink; g.fillRect(x + w - 48, y, 48, h); g.restore(); // the score box
      g.drawImage(logoOn(t, 64, t.c1), x + 7, y + 2, h - 4, h - 4);
      const rk = this.rank(t), nm = this.short(t), lx = x + 9 + h;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.font = '800 13px "Barlow Condensed", Arial, sans-serif'; const rw = rk ? g.measureText('#' + rk).width + 4 : 0;
      if (rk) { g.fillStyle = fg; g.globalAlpha = 0.75; g.fillText('#' + rk, lx, y + 19); g.globalAlpha = 1; }
      const room = w - 48 - (lx - x) - rw - (poss ? 22 : 6); let fs = 21;
      g.font = `italic 900 ${fs}px "Barlow Condensed", "Arial Black", sans-serif`;
      while (fs > 14 && g.measureText(nm).width > room) { fs--; g.font = `italic 900 ${fs}px "Barlow Condensed", "Arial Black", sans-serif`; }
      g.fillStyle = fg; g.fillText(nm, lx + rw, y + 19, room);
      if (poss) drawFootball(g, lx + rw + Math.min(room, g.measureText(nm).width) + 12, y + 12, 0.75);
      if (G.versus && !G.online) { const tg = side === G.p1 ? 'P1' : 'P2'; g.font = 'italic 900 11px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = tg === 'P1' ? '#e0222b' : '#1f63e0'; g.fillRect(x + 1, y - 3, g.measureText(tg).width + 6, 13); g.fillStyle = '#fff'; g.fillText(tg, x + 4, y + 7); }
      if (G.timeouts) for (let i = 0; i < 3; i++) { g.fillStyle = fg; g.globalAlpha = i < G.timeouts[side] ? 0.95 : 0.22; g.fillRect(lx + i * 15, y + h - 10, 12, 3); } g.globalAlpha = 1;
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'italic 900 32px "Barlow Condensed", "Arial Black", sans-serif'; g.fillText(s, x + w - 25, y + h / 2 + 11);
    };
    cell(G.teams[1], G.score[1], x0 + 57, G.poss === 1);
    cell(G.teams[0], G.score[0], x0 + 257, G.poss === 0);
    g.fillStyle = ink; para(x0 + 458, y0 + 5, W - 463, H - 10, 7); g.fill(); // clock block (drawn on top each frame)
  },

  // ---------- GAME DAY intro card: drawn over the normal matchup card ----------
  card(t) {
    const B = Broadcast, cv = $('bcCv'), g = cv.getContext('2d'), W = cv.width, H = 720, A = G.teams[1], Hm = G.teams[0];
    const ein = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3), slide = ein(t / 0.55), fade = clamp((B.DUR - t) / 0.35, 0, 1);
    g.save(); g.globalAlpha = fade;
    // header: ink bar, both schools' colors as torn-tape stripes, GAME DAY
    g.fillStyle = this.INK; g.fillRect(0, 0, W, 64);
    g.fillStyle = A.c1; g.fillRect(0, 58, W / 2, 6); g.fillStyle = Hm.c1; g.fillRect(W / 2, 58, W / 2, 6);
    g.fillStyle = '#d7263d'; g.fillRect(28, 16, 74, 28); g.fillStyle = '#fff'; g.font = '900 20px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('LIVE', 72, 31); g.beginPath(); g.arc(40, 30, 5, 0, 7); g.fillStyle = Math.sin(t * 8) > 0 ? '#fff' : '#ffffff55'; g.fill();
    g.save(); g.translate(122, 8); g.rotate(-0.035); g.fillStyle = this.PAPER; g.fillRect(0, 0, 178, 46); g.fillStyle = this.INK; g.textAlign = 'left';
    g.font = 'italic 900 36px "Barlow Condensed", "Arial Black", sans-serif'; g.fillText('GAME DAY', 12, 25); g.restore();
    g.textAlign = 'left'; g.fillStyle = this.TAG; g.font = '800 20px "Barlow Condensed", Arial, sans-serif';
    g.fillText(G.rivalry || G.rivalryMatch ? 'COLLEGE FOOTBALL  ·  RIVALRY GAME' : 'COLLEGE FOOTBALL', 318, 32);
    if (B.label && !/^college football$/i.test(B.label)) { g.textAlign = 'right'; g.fillText(B.label.toUpperCase(), W - 30, 32); }
    // poll numbers next to the school names (they slide in with the teams)
    for (const [tm, x, dirIn] of [[A, W * 0.27, -1], [Hm, W * 0.73, 1]]) {
      const rk = this.rank(tm); if (!rk) continue;
      g.save(); g.translate((1 - slide) * 700 * dirIn, 0);
      g.font = '800 24px "Barlow Condensed", Arial, sans-serif'; const cw = g.measureText(tm.city.toUpperCase()).width;
      g.font = 'italic 900 22px "Barlow Condensed", Arial, sans-serif'; const rt = '#' + rk, rw = g.measureText(rt).width + 14, rx = x - cw / 2 - 10 - rw;
      g.fillStyle = this.TAG; g.fillRect(rx, 391, rw, 26); g.fillStyle = this.INK; g.textAlign = 'center'; g.fillText(rt, rx + rw / 2, 405);
      g.restore();
    }
    g.restore();
  },

  // ---------- student section: the home school's colors in stripes, rows alternating ----------
  students(G) {
    const g = fieldCv && fieldCv.getContext('2d'); if (!g) return;
    const t = G.teams[0]; if (!isColTeam(t)) return;
    const fx = x => (x + FIELD_PAD_X) * PX, fy = y => (y + FIELD_PAD_TOP) * PY, a = Math.floor(fx(70) / 13), b = Math.ceil(fx(104) / 13);
    const c2 = lum(t.c2) > 0.9 ? '#f4f4f4' : t.c2, stripe = row => row % 2 ? c2 : t.c1;
    for (let row = 0; row < 6; row++) for (let i = a; i < b; i++) {
      const h = hashStr(row + ':' + i), x = i * 13 + (row % 2) * 6 + 4;
      g.fillStyle = stripe(row); g.beginPath(); g.arc(x, 10 + row * 12, 4.5, 0, 7); g.fill();
      g.fillStyle = SKIN[(h >> 4) % 6]; g.beginPath(); g.arc(x, 4 + row * 12, 3, 0, 7); g.fill();
    }
    const wy0 = fy(FIELD_W + 3.4), H = fieldCv.height;
    for (let row = 0; wy0 + 14 + row * 12 < H + 6; row++) for (let i = a; i < b; i++) {
      const h = hashStr('b' + row + ':' + i), x = i * 13 + (row % 2) * 6 + 4;
      g.fillStyle = stripe(row); g.beginPath(); g.arc(x, wy0 + 18 + row * 12, 4.5, 0, 7); g.fill();
      g.fillStyle = SKIN[(h >> 4) % 6]; g.beginPath(); g.arc(x, wy0 + 12 + row * 12, 3, 0, 7); g.fill();
    }
  }
};

// ---------- the college run-out (rides on the stadium fly-over in flyover.js) ----------
// The visitors jog on from the far sideline first (a few boos), then the home team comes out of the tunnel one by one:
// each one jumps and slaps the sign over the path, the first one bursts the paper banner, drums on every slap.
const ColRun = {
  SH: 40, // paper shreds (one pool, reused)
  setup(F) {
    const d = F.d, e = F.end, goal = goalX(1), sh = MID + 13 - F.ty;
    F.ty += sh; for (const p of F.runners) p.y += sh; // the tunnel sits nearer the camera than the NFL one (clear of the goal post)
    this.signX = e + d * 1.8; this.signY = F.ty - 1.3; this.bnX = e + d * 5.2; this.burst = 0; this.wob = 0; this.drums = 0; this.boo = 0;
    if (!this.hits) this.hits = [0, 1, 2].map(() => ({ x: 0, dir: 1, t: 9 })); // slap flashes on the sign
    for (const h of this.hits) h.t = 9;
    this.focus = { x: 0, y: 0 }; F.ax = null;
    F.runners.forEach((p, i) => {
      p.go = 1.45 + i * 0.19; p.lane = p.y; p.leg = 0; p.celly.flag = false; p.celly.jmp = 0; p.celly.jh = 0; p.slapped = false;
      p.wx = e + d * 7; // straight out under the sign + through the banner, then to the huddle
    });
    // the visitors: in from the far sideline to their own huddle further up the field
    const aw = G.teams[1], tup = aw.off.concat(aw.def), ax = goal + d * 21, ay = MID - 6;
    this.away = tup.map((tp, i) => {
      const p = makePlayer(1, i < aw.off.length, i, tp); p.isHuman = false;
      const a = (i / tup.length) * Math.PI * 2;
      Object.assign(p, { x: ax + (i % 6 - 2.5) * 1.6, y: 7 - Math.floor(i / 6) * 1.5, go: 0.05 + (i % 6) * 0.05 + Math.floor(i / 6) * 0.15, tx: ax + Math.cos(a) * 3.4, ty: ay + Math.sin(a) * 2.8, out: false, away: true });
      p.face.dir = Math.sign(p.tx - p.x) || -d;
      p.celly = { type: 'runout', t: 0, fx: {}, flag: false };
      return p;
    });
    F.runners.push(...this.away);
    if (!this.shreds) this.shreds = Array.from({ length: this.SH }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, vr: 0, c: '#fff', life: 0 }));
    for (const s of this.shreds) s.life = 0;
  },
  update(F, dt) {
    const t = F.t - F.CUT; if (t < 0) return;
    const d = F.d, tm = G.teams[0];
    if (!this.boo && t > 0.15) { this.boo = 1; Sound.sfx('boo', 0.45); }
    // drumline build-up before the first one comes out
    if (this.drums < 3 && t > 0.45 + this.drums * 0.18) { this.drums++; Sound.sfx('drum', 0.5 + this.drums * 0.12); }
    G.crowdHype = Math.min(2.4, 0.5 + Math.max(0, t - 0.8) * 1.1);
    let n = 0, ax = 0;
    for (const p of F.runners) {
      p.celly.t += dt;
      if (t < p.go) continue;
      if (!p.out) { p.out = true; if (!p.away) for (let k = 0; k < 2; k++) F.puffs.push({ x: F.end + d * 0.6, y: p.y + (Math.random() - 0.5) * 2, life: 1, r: 6 }); }
      if (!p.away) { n++; ax += p.x; }
      // home runners: straight out to the waypoint first (under the sign, through the banner)
      const tx = !p.away && p.leg === 0 ? p.wx : p.tx, ty = !p.away && p.leg === 0 ? p.lane : p.ty;
      const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy);
      if (l > 0.25) {
        const sp = (p.away ? Math.min(8.5, l * 3 + 2) : p.leg === 0 ? 8.5 : Math.min(9.5, l * 3 + 2)) * dt;
        p.x += dx / l * Math.min(l, sp); p.y += dy / l * Math.min(l, sp); p.anim += dt * 15; p.speedNow = 7; p.home = false;
        if (Math.abs(dx) > 0.3) p.face.dir = Math.sign(dx);
      } else if (!p.away && p.leg === 0) p.leg = 1;
      else { p.speedNow = 0; p.home = true; p.face.dir = p.away ? (Math.sign(F.hx - p.x) || -d) : (Math.sign(F.hx - p.x) || d); }
      if (p.away) continue;
      // the sign: jump on the way under it, slap at the top
      const pre = (this.signX - p.x) * d;
      if (!p.slapped && p.celly.jmp === 0 && pre < 1.3 && pre > -0.5) { p.celly.jmp = 0.001; p.celly.jh = clamp(62 + (p.y - F.ty) * PY, 44, 80); }
      if (p.celly.jmp > 0) {
        p.celly.jmp += dt / 0.34;
        if (!p.slapped && p.celly.jmp >= 0.5) { p.slapped = true; this.wob = 1; Sound.sfx('drum', 0.42); const h = this.hits.reduce((a, b) => b.t > a.t ? b : a); h.x = p.x; h.dir = p.face.dir || d; h.t = 0; }
        if (p.celly.jmp >= 1) p.celly.jmp = 0;
      }
      // the banner: the first one through tears it
      if (!this.burst && (p.x - this.bnX) * d > -0.8) this.tear(tm);
    }
    if (n) F.ax = ax / n;
    this.wob = Math.max(0, this.wob - dt * 2.5); for (const h of this.hits) h.t += dt;
    if (this.burst) this.burst += dt;
    for (const s of this.shreds) {
      if (s.life <= 0) continue;
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - dt * 1.5; s.vy *= 1 - dt * 1.5; s.vz -= 260 * dt; s.z = Math.max(0, s.z + s.vz * dt); s.r += s.vr * dt;
      if (s.z === 0) { s.vx = s.vy = 0; s.vr = 0; }
    }
    for (const f of F.puffs) { f.life -= dt * 0.8; f.r += dt * 30; f.x += d * dt * 1.5; }
    for (let i = F.puffs.length - 1; i >= 0; i--) if (F.puffs[i].life <= 0) F.puffs.splice(i, 1);
  },
  // the camera: wide on the visitors, push in on the tunnel for the sign + banner, then back out with the pack
  shot(F) {
    const ct = F.t - F.CUT, d = F.d, inn = ease(clamp((ct - 1.15) / 0.5, 0, 1)), out = ease(clamp((ct - 4.1) / 1.1, 0, 1)), k = inn * (1 - out);
    const wide = F.end + d * 15, close = this.signX + d * 3.2, pack = F.ax != null ? F.ax + d * 3 : wide;
    const x = out > 0 ? lerp(close, d > 0 ? Math.max(wide, pack) : Math.min(wide, pack), out) : lerp(wide, close, inn);
    this.focus.x = x; this.focus.y = F.ty - 1.5;
    return { zoom: 'normal', x, y: lerp(MID - 2, MID + 7, Math.max(inn, out)), cz: 1 + 0.55 * k, focus: k > 0.002 ? this.focus : null };
  },
  tear(tm) {
    this.burst = 0.001; Sound.crowd(true);
    const cols = [tm.c1, tm.c2, '#ffffff', tm.c1];
    this.shreds.forEach((s, i) => Object.assign(s, { x: this.bnX + rand(-0.3, 0.3), y: Flyover.ty + rand(-2.2, 2.2), z: rand(20, 80), vx: Flyover.d * rand(1, 7), vy: rand(-2.5, 2.5), vz: rand(40, 200), r: rand(0, 6), vr: rand(-12, 12), c: cols[i % 4], life: rand(1.6, 3) }));
  },
  // behind the players: the sign on its frame + the paper banner
  drawBack(g, F) {
    const tm = G.teams[0], wob = Math.sin(F.t * 38) * this.wob;
    // the sign: two posts and a painted board facing the camera, high enough to jump for
    const gx = sx(this.signX), gy = sy(this.signY), bw = 150, bh = 46, bot = gy - 104;
    g.save();
    g.strokeStyle = OUT; g.lineWidth = 6; g.lineCap = 'round';
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(gx + k * (bw / 2 - 8), gy); g.lineTo(gx + k * (bw / 2 - 8), bot); g.stroke(); }
    g.strokeStyle = '#c9ced6'; g.lineWidth = 3;
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(gx + k * (bw / 2 - 8), gy); g.lineTo(gx + k * (bw / 2 - 8), bot); g.stroke(); }
    g.translate(gx, bot - bh / 2); g.rotate(wob * 0.035); g.translate(0, wob * 2);
    const pic = this.signPic(tm, bw, bh); g.drawImage(pic, -bw / 2 - 3, -bh / 2 - 3);
    g.restore();
    // the paper banner: across the path, seen from the side (leans with depth like the goal posts).
    // Painted on its own plane: u = 0..60 across the path (far pole to near pole), v = 0..top down from the top edge
    const D = 2.1, k = 15, top = 104, foot = 8, X0 = sx(this.bnX) - D * k, Y0 = sy(F.ty - D);
    g.save(); g.lineCap = 'round';
    for (const dy of [-D, D]) { const px = X0 + (dy + D) * k, py = Y0 + (dy + D) * PY; g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - top - 8); g.stroke(); g.strokeStyle = '#d8dde4'; g.lineWidth = 3; g.stroke(); }
    g.transform(D * 2 * k / 60, D * 2 * PY / 60, 0, 1, X0, Y0 - top);
    const ph = top - foot;
    if (!this.burst) {
      g.fillStyle = this.paper(tm); g.fillRect(0, 0, 60, ph); g.fillStyle = tm.c1; g.fillRect(0, 0, 60, 9); g.fillRect(0, ph - 9, 60, 9);
      if (typeof Logo !== 'undefined') Logo.draw(g, tm, 30, ph / 2, 50);
      g.strokeStyle = OUT; g.lineWidth = 1.5; g.strokeRect(0, 0, 60, ph);
    } else { // two torn flaps left on the poles, flapping
      const fl = Math.sin(F.t * 14) * 3, u = Math.min(1, this.burst * 3);
      for (const [a, w] of [[0, 15 + fl], [60, -15 + fl]]) {
        g.beginPath(); g.moveTo(a, 0); g.lineTo(a + w, 0); g.lineTo(a + w * 0.55, ph * 0.45); g.lineTo(a + w * 0.8, ph * 0.7); g.lineTo(a + w * 0.3 * (1 - u), ph); g.lineTo(a, ph); g.closePath();
        g.fillStyle = this.paper(tm); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
      }
    }
    g.restore();
  },
  // over the players: flying paper
  paper(tm) { return lum(tm.c2) > 0.75 ? tm.c2 : ColShow.PAPER; },
  drawFront(g) {
    // a quick white burst where a hand hits the sign
    const bot = sy(this.signY) - 104;
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round';
    for (const h of this.hits) {
      if (h.t > 0.16) continue;
      const x = sx(h.x) + h.dir * 20, r0 = 6 + h.t * 60, r1 = r0 + 9; g.globalAlpha = 1 - h.t / 0.16; g.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.14); g.moveTo(x + Math.cos(a) * r0, bot + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, bot + Math.sin(a) * r1); }
      g.stroke();
    }
    g.globalAlpha = 1;
    if (!this.burst) return;
    for (const s of this.shreds) {
      if (s.life <= 0) continue;
      const x = sx(s.x), y = sy(s.y) - s.z, c = Math.cos(s.r) * 5, sn = Math.sin(s.r) * 3;
      g.globalAlpha = Math.min(1, s.life * 2); g.fillStyle = s.c;
      g.beginPath(); g.moveTo(x - c, y - sn); g.lineTo(x + sn, y - c * 0.6); g.lineTo(x + c, y + sn); g.lineTo(x - sn, y + c * 0.6); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
  },
  // the sign board, painted once per team
  signPic(tm, bw, bh) {
    const key = tm.id + tm.c1 + tm.c2 + bw + (typeof Logo !== 'undefined' ? picId(Logo.canvas(tm, 64)) : '');
    if (this.sign && this.sign.key === key) return this.sign;
    const c = document.createElement('canvas'); c.width = bw + 6; c.height = bh + 6; c.key = key;
    const g = c.getContext('2d'); if (!g || !g.fillRect) return c;
    g.translate(3, 3);
    g.fillStyle = OUT; g.fillRect(-3, -3, bw + 6, bh + 6);
    g.fillStyle = tm.c1; g.fillRect(0, 0, bw, bh);
    g.fillStyle = tm.c2; g.fillRect(0, 0, bw, 3); g.fillRect(0, bh - 3, bw, 3);
    g.fillStyle = ColRun.paper(tm); g.beginPath(); g.arc(22, bh / 2, bh / 2 - 5, 0, 7); g.fill(); g.strokeStyle = tm.c2; g.lineWidth = 2; g.stroke(); // (a light patch so the logo shows on its own color)
    if (typeof Logo !== 'undefined') Logo.draw(g, tm, 22, bh / 2, bh - 14);
    const fg = textOn(tm.c1), acc = lum(tm.c2) > 0.25 && Math.abs(lum(tm.c2) - lum(tm.c1)) > 0.25 ? tm.c2 : fg;
    g.textAlign = 'center'; g.textBaseline = 'middle'; const mid = 22 + (bw - 22) / 2 + 2;
    g.fillStyle = acc; g.font = '800 12px "Barlow Condensed", Arial, sans-serif'; g.fillText(ColShow.slogan(tm), mid, 13, bw - 52);
    g.fillStyle = fg; g.font = 'italic 900 24px "Barlow Condensed", "Arial Black", sans-serif'; g.fillText(ColShow.short(tm), mid, 31, bw - 52);
    this.sign = c; return c;
  },
  // lower-third cards: the visitors, then the home team (paper + ink, school color edge)
  drawCard(g, F) {
    const t = F.t, W = CW, H = CH, fin = clamp((F.DUR - t) / 0.35, 0, 1), bar = Math.round(H * 0.075 * ease(Math.min(1, t / 0.35)) * fin);
    g.save();
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    const ct = t - F.CUT; if (ct > -0.08 && ct < 0.25) { g.globalAlpha = 1 - Math.abs(ct + 0.08) / 0.33; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    const card = (tm, kick, big, sub, a, logo) => {
      g.save(); g.globalAlpha = a; g.translate(Math.round(W * 0.04) - (1 - a) * 80, H - bar - 150); g.rotate(-0.012);
      g.font = '700 17px Barlow, Arial, sans-serif'; const sw = g.measureText(sub).width;
      g.font = 'italic 900 56px "Barlow Condensed", Arial, sans-serif'; const bw = Math.max(320, Math.max(g.measureText(big).width, sw) + (logo ? 116 : 50));
      g.fillStyle = ColShow.INK; g.fillRect(5, 5, bw, 112);
      g.fillStyle = ColShow.PAPER; g.fillRect(0, 0, bw, 112);
      g.fillStyle = tm ? tm.c1 : '#c8102e'; g.fillRect(0, 0, 10, 112); if (tm) { g.fillStyle = tm.c2; g.fillRect(10, 0, 4, 112); }
      if (logo && tm) Logo.draw(g, tm, 66, 58, 78);
      const lx = logo ? 116 : 32; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = '#c8102e'; g.font = '900 20px "Barlow Condensed", Arial, sans-serif'; g.fillText(kick, lx, 30);
      g.fillStyle = ColShow.INK; g.font = 'italic 900 56px "Barlow Condensed", Arial, sans-serif'; g.fillText(big, lx, 80);
      g.fillStyle = '#4b443a'; g.font = '700 17px Barlow, Arial, sans-serif'; g.fillText(sub, lx, 102);
      g.restore();
    };
    const st = G.stadium || { name: 'Home Field' }, Hm = G.teams[0], A = G.teams[1], rk = tm => { const r = ColShow.rank(tm); return r ? `#${r} ` : ''; };
    const wx = st.dome ? 'Indoors' : G.storm ? 'Storm' : G.fog ? 'Fog' : G.weather === 'rain' ? 'Rain' : G.weather === 'snow' ? 'Snow' : G.night ? 'Under the lights' : 'Clear skies';
    const a1 = clamp((t - 0.35) / 0.3, 0, 1) * clamp((F.CUT - 0.1 - t) / 0.25, 0, 1);
    if (a1 > 0) card(null, 'LIVE FROM', st.name.toUpperCase(), `${Hm.city}  ·  ${wx}`, a1, false);
    const a0 = clamp((ct - 0.2) / 0.25, 0, 1) * clamp((1.55 - ct) / 0.2, 0, 1);
    if (a0 > 0) card(A, 'THE VISITORS', rk(A) + ColShow.short(A), `${A.city} ${A.name}`, a0, true);
    const a2 = clamp((ct - 1.75) / 0.3, 0, 1) * fin;
    if (a2 > 0) card(Hm, 'TAKING THE FIELD', rk(Hm) + ColShow.short(Hm), [Broadcast.label && !/^college football$/i.test(Broadcast.label) ? Broadcast.label : '', `${Hm.city} ${Hm.name}`, 'Home team'].filter(Boolean).join('  ·  '), a2, true);
    g.globalAlpha = 0.55; g.fillStyle = '#fff'; g.font = '800 13px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'right'; g.fillText('TAP TO SKIP', W - 24, H - bar - 14);
    if (fin < 1) { g.globalAlpha = 1 - fin; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    g.restore();
  }
};

(() => {
  // scorebug (the fly-over hides it like the NFL one)
  const bHUD = drawHUD;
  drawHUD = function (g, G) { if (!colGame(G) || (typeof Flyover !== 'undefined' && Flyover.on)) return bHUD.apply(this, arguments); ColShow.hud(g, G); };
  // matchup card
  const bDraw = Broadcast.draw;
  Broadcast.draw = function (t) { bDraw.call(this, t); if (colGame(G) && !G.bigGame) ColShow.card(t); };
  // student section, painted on the field picture when it's made
  const bField = buildField;
  buildField = function (G) { const was = fieldCv; bField(G); if (fieldCv && fieldCv !== was && colGame(G) && !G.bigGame && !G.preview) try { ColShow.students(G); } catch (e) { console.warn('students', e); } };
  // the run-out: career college games get the intro too
  const fOk = Flyover.ok;
  Flyover.ok = function () { return fOk.call(this) || (G.career === 'college' && ShowOpts.intro && !!G.teams && !G.demo && !G.online && !G.challenge && !G.mini && !G.scenario && !G.practice && colGame(G)); };
  const fStart = Flyover.start, fUpdate = Flyover.update, fShot = Flyover.shot, fTunnel = Flyover.drawTunnel, fCard = Flyover.drawCard;
  Flyover.start = function () {
    const col = colGame(G); this.col = false; this.DUR = col ? 7.8 : 5.6; this.CUT = col ? 2.3 : 2.5;
    fStart.call(this);
    if (this.on && col) { try { ColRun.setup(this); this.col = true; } catch (e) { console.error('college run-out', e); } }
    if (!this.col) { this.DUR = 5.6; this.CUT = 2.5; }
  };
  Flyover.update = function (dt) { return this.col ? ColRun.update(this, dt) : fUpdate.call(this, dt); };
  Flyover.shot = function () { return this.col && this.t >= this.CUT ? ColRun.shot(this) : fShot.call(this); };
  Flyover.drawTunnel = function (g) { fTunnel.call(this, g); if (this.col) ColRun.drawFront(g); };
  Flyover.drawCard = function (g) { return this.col ? ColRun.drawCard(g, this) : fCard.call(this, g); };
  const bLines = drawLines;
  drawLines = function (g) { if (Flyover.on && Flyover.col && Flyover.t >= Flyover.CUT) { try { ColRun.drawBack(g, Flyover); } catch (e) { console.error('run-out sign', e); } return; } return bLines.apply(this, arguments); };
  // jumping for the sign: up in the air, slapping hand straight up
  const bPose = Celly.pose;
  Celly.pose = function (p, type, t) {
    const P = bPose.call(this, p, type, t);
    if (type !== 'runout' || !(p.celly.jmp > 0)) return P;
    const u = p.celly.jmp; P.hop = Math.sin(Math.PI * Math.min(1, u)) * p.celly.jh; P.legK = 0.25;
    P.arm = (front, shx, shy) => front ? { ex: shx + 12, ey: shy - 12, hx: shx + 21, hy: shy - 30 } : { ex: shx - 7, ey: shy + 3, hx: shx - 10, hy: shy + 11 };
    return P;
  };
})();
