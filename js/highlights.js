// ---- Game highlights: every play is filmed (20 samples/s), the most exciting ones are kept compact, then shown as a TV-style reel ----
// Frames are whole numbers, stored per track as base-36 deltas with run-lengths, so a clip is a few KB of text.
const HL_RATE = 20, HL_MAX = 8, HL_PRE = 9, HL_POST = 1.6; // samples/s, clips kept, seconds before / after the whistle
// [get, set, scale, smooth] for each player number we film (only what drawPlayer needs)
const HL_PF = [
  [p => p.x, (p, v) => p.x = v, 20, 1], [p => p.y, (p, v) => p.y = v, 20, 1], [p => p.vx, (p, v) => p.vx = v, 5, 1], [p => p.vy, (p, v) => p.vy = v, 5, 1],
  [p => p.anim, (p, v) => p.anim = v, 10, 1], [p => p.speedNow, (p, v) => p.speedNow = v, 10, 1], [p => p.face.dir, (p, v) => p.face.dir = v, 1, 0],
  [p => p.down, (p, v) => p.down = v, 20, 1], [p => p.downDir, (p, v) => p.downDir = v, 1, 0], [p => p.dive, (p, v) => p.dive = v, 20, 1],
  [p => p.jump, (p, v) => p.jump = v, 50, 1], [p => p.spin, (p, v) => p.spin = v, 20, 1], [p => p.stiff, (p, v) => p.stiff = v, 20, 1],
  [p => p.throwAnim, (p, v) => p.throwAnim = v, 20, 1], [p => p.celebrate, (p, v) => p.celebrate = v, 10, 1], [p => p.dizzy, (p, v) => p.dizzy = v, 10, 1],
  [p => p.kneel, (p, v) => p.kneel = v, 20, 1], [p => p.sprinting ? 1 : 0, (p, v) => p.sprinting = !!v, 1, 0], [p => p.engaged ? 1 : 0, (p, v) => p.engaged = v ? true : null, 1, 0],
  [p => p.head.ox, (p, v) => p.head.ox = v, 1, 1], [p => p.head.oy, (p, v) => p.head.oy = v, 1, 1], [p => p.head.rot, (p, v) => p.head.rot = v, 50, 1],
  [p => p.celly ? p.celly.t : 0, (p, v) => { if (p.celly) p.celly.t = v; }, 20, 1]
];
const HL_NF = HL_PF.length;
const HL_KEEP = ['side', 'off', 'slot', 'pos', 'name', 'num', 'ovr', 'face', 'headScale', 'cap', 'thp', 'tha', 'gloves', 'teamGloves', 'gear', 'dirt', 'pants', 'pstripe'];
// base-36 deltas, "d*n" = the same delta n times (players running straight compress to almost nothing)
function hlEnc(col) {
  const out = []; let prev = 0, i = 0;
  while (i < col.length) {
    const d = col[i] - prev; let n = 1;
    while (i + n < col.length && col[i + n] - col[i + n - 1] === d) n++;
    out.push(n > 2 ? d.toString(36) + '*' + n.toString(36) : Array(n).fill(d.toString(36)).join(','));
    prev = col[i + n - 1]; i += n;
  }
  return out.join(',');
}
function hlDec(s, scale) {
  const out = []; let v = 0;
  for (const t of s.split(',')) { const k = t.indexOf('*'), d = parseInt(k < 0 ? t : t.slice(0, k), 36), n = k < 0 ? 1 : parseInt(t.slice(k + 1), 36); for (let j = 0; j < n; j++) out.push((v += d) / scale); }
  return out;
}
const hlRle = a => { const o = []; for (const v of a) { const l = o[o.length - 1]; if (l && l[0] === v) l[1]++; else o.push([v, 1]); } return o; };
const hlUnrle = o => o.flatMap(([v, n]) => Array(n).fill(v));
const hlR2 = v => Math.round(v * 100) / 100;

const Highlights = {
  clips: [], cur: null, pbpRef: null, gw: null, on: false, rec: false,
  // a new game = a new play-by-play list
  reset() { this.clips = []; this.cur = null; this.gw = null; this.pbpRef = G.pbp; this.teams = G.teams; },
  // the snap (Replay.begin calls this): start filming the play
  begin() {
    this.finalize();
    if (G.demo || G.mini || !G.teams || !G.players || G.players.length < 6 || G.phase === 'over' || (G.online && typeof Net !== 'undefined' && Net.role === 'guest')) return;
    if (G.pbp !== this.pbpRef) this.reset();
    this.cur = { src: G.players, fr: [], t0: G.time, next: G.time, end: null, endI: -1, catchI: -1, boomI: -1, fl: [], fRef: null, hold: G.ball && G.ball.holder,
      score: G.score.slice(), q: G.quarter, clock: G.clock, poss: G.poss, special: G.special || (G.km && G.phase === 'kickmeter' ? G.km.kind : null), los: G.los, fdx: G.firstDownX, gtg: G.goalToGo, nref: (G.refs || []).length };
  },
  // after every update: take a sample, notice the catch / the big hit / the whistle
  tick() {
    const c = this.cur; if (!c) return;
    const ph = G.phase, film = ph === 'live' || ph === 'dead' || ph === 'kick' || ph === 'kickmeter';
    if (!film || G.players !== c.src) return this.finalize();
    if (c.end == null && (ph === 'dead' || (ph === 'kick' && G.kick && G.kick.done))) { c.end = G.time; c.endI = c.fr.length; }
    if (c.end != null && G.time - c.end > HL_POST) return this.finalize();
    const b = G.ball;
    if (b && b.holder && b.holder !== c.hold && c.hadFlight) c.catchI = c.fr.length;
    if (b) { c.hold = b.holder; if (b.flight) c.hadFlight = true; }
    if (ph === 'live' && cam.shake >= 14.5 && c.boomI < 0) c.boomI = c.fr.length; // BOOM tackle (the only thing that shakes this hard)
    if (G.time < c.next) return;
    c.next = Math.max(c.next + 1 / HL_RATE, G.time - 0.5 / HL_RATE);
    const ps = [];
    for (const p of G.players) for (const f of HL_PF) { const v = f[0](p); ps.push(Math.round((+v || 0) * f[2])); }
    let fi = -1, ft = 0;
    if (b && b.flight) {
      if (b.flight !== c.fRef) { const f = b.flight; c.fRef = f; c.fl.push({ sx: hlR2(f.sx), sy: hlR2(f.sy), tx: hlR2(f.tx), ty: hlR2(f.ty), T: hlR2(f.T), peak: hlR2(f.peak), pitch: !!f.pitch, kick: f.kick || 0, duck: !!f.duck }); }
      fi = c.fl.length - 1; ft = Math.round(b.flight.t * 100);
    }
    c.fr.push({ p: ps, m: G.players.map(p => (p.mouth || '') + '|' + (p.celly ? p.celly.type : '')),
      b: b ? [Math.round(b.x * 20), Math.round(b.y * 20), Math.round((b.z || 0) * 20), Math.round((b.spin || 0) * 10), b.holder ? G.players.indexOf(b.holder) : -1, fi, ft] : [0, 0, 0, 0, -2, -1, 0],
      r: (G.refs || []).slice(0, c.nref).flatMap(r => [Math.round(r.x * 20), Math.round(r.y * 20), r.face || 1, Math.round((r.anim || 0) * 10), r.moving ? 1 : 0, Math.round((r.throwT || 0) * 20)]),
      c: [Math.round(cam.x * 20), Math.round(cam.y * 20)] });
    if (c.fr.length > HL_RATE * (HL_PRE + HL_POST + 3)) { c.fr.shift(); for (const k of ['endI', 'catchI', 'boomI']) if (c[k] >= 0) c[k]--; }
  },
  // the play is over: was it worth keeping?
  finalize() {
    const c = this.cur; this.cur = null;
    if (!c || c.fr.length < HL_RATE * 1.5 || G.pbp !== this.pbpRef || !G.teams) return;
    const info = this.judge(c); if (!info) return;
    const low = this.clips.length >= HL_MAX ? this.clips.reduce((a, x) => x.ex < a.ex ? x : a) : null;
    const keepGw = info.goAhead && info.qn >= 4; // the go-ahead score late is held onto in case it wins the game
    if (low && low.ex >= info.ex && !keepGw) return;
    const clip = this.pack(c, info);
    if (keepGw) this.gw = clip;
    if (!low || low.ex < info.ex) { if (low) this.clips.splice(this.clips.indexOf(low), 1); this.clips.push(clip); }
  },
  // excitement score + a TV label from the play-by-play
  judge(c) {
    const lines = (G.pbp || []).filter(l => l.t >= c.t0 - 1e-6), txt = lines.map(l => l.text).join(' ');
    const lr = G.lastResult || {}, sc = G.score, d = [sc[0] - c.score[0], sc[1] - c.score[1]];
    const side = d[0] > d[1] ? 0 : d[1] > d[0] ? 1 : -1, pts = side < 0 ? 0 : d[side], def = 1 - c.poss;
    const L = s => (s || '').toUpperCase(), N = n => n ? L(lastName(n)) : '', NM = "([A-Z][\\w'-]*(?: (?:Jr\\.|Sr\\.|II|III|IV))?)", cr = G.credit, gain = lr.gain || 0;
    let ex = 0, title = '', who = '', team = c.poss, key = c.endI, m;
    const td = pts >= 6;
    if (/PENALTY on/.test(txt)) return null; // a flag took it back (or moved it): not a highlight
    if (/BLOCKED/.test(txt)) {
      m = txt.match(new RegExp('BLOCKED by ' + NM + '!')); ex = td ? 95 : 55; title = td ? 'BLOCKED KICK TD' : 'BLOCKED KICK'; who = m ? L(m[1]) : ''; team = def;
      if (td) { const s = txt.match(new RegExp(NM + ' scoops up')); if (s) who = L(s[1]); }
    } else if ((m = txt.match(/takes the (punt|kick) back for a TOUCHDOWN/))) {
      ex = 88; title = (m[1] === 'punt' ? 'PUNT' : 'KICK') + ' RETURN TD'; who = L(txt.split(' takes the')[0].split('. ').pop()); team = side;
    } else if ((m = txt.match(new RegExp(NM + ' returns the (punt|kick) (\\d+) yards'))) && +m[3] >= 35) {
      ex = 18 + +m[3] * 0.6; title = `${m[3]}-YD ${m[2] === 'punt' ? 'PUNT' : 'KICK'} RETURN`; who = L(m[1]); team = c.poss;
    } else if ((m = txt.match(/(\d+)-yard field goal is GOOD/))) {
      const y = +m[1]; ex = y >= 50 ? 32 + (y - 50) * 3 : 4; title = `${y}-YD FIELD GOAL`; who = L((txt.match(new RegExp(NM + ' \\d+-yard field goal')) || [])[1]); team = side;
    } else if (G.intBy && G.intBy.side !== c.poss && /INTERCEPTED/.test(txt)) {
      ex = td ? 92 : 46; title = td ? 'PICK SIX' : 'INTERCEPTION'; who = N(G.intBy.name); team = def; if (c.catchI >= 0) key = c.catchI;
    } else if ((m = txt.match(new RegExp('FUMBLE, recovered by ' + NM)))) {
      ex = td ? 90 : 38; title = td ? 'FUMBLE RETURN TD' : 'FUMBLE RECOVERY'; who = L(m[1]); team = def;
    } else if (td && side === c.poss && cr) {
      const rec = cr.kind === 'rec';
      ex = 52 + Math.min(40, gain * 0.6); title = `${gain}-YD TD ${rec ? 'PASS' : 'RUN'}`; who = rec ? `${N(cr.passer && cr.passer.name)} TO ${N(cr.p.name)}` : N(cr.p.name);
      if (rec && c.catchI >= 0 && c.endI - c.catchI < HL_RATE * 2.5) key = c.catchI;
    } else if (lr.type === 'sack') {
      ex = 22 + Math.min(12, -gain); title = gain < 0 ? `SACK, ${-gain}-YD LOSS` : 'SACK'; who = G.lastTackler ? N(G.lastTackler.name) : ''; team = def;
    } else if (gain >= 25 && cr && lr.type !== 'inc') {
      const rec = cr.kind === 'rec';
      ex = 14 + Math.min(30, gain * 0.7); title = `${gain}-YD ${rec ? 'CATCH' : 'RUN'}`; who = rec ? `${N(cr.passer && cr.passer.name)} TO ${N(cr.p.name)}` : N(cr.p.name);
      if (rec && c.catchI >= 0) key = c.catchI;
    }
    if (c.boomI >= 0) { // hit stick / BOOM tackle
      if (!title) { title = 'BIG HIT'; who = G.lastTackler ? N(G.lastTackler.name) : ''; team = def; ex = 24; } else ex += 10;
      if (!/TD|PASS|PICK/.test(title)) key = c.boomI;
    }
    if (!title) return null;
    if (c.special && /RETURN|BLOCK/.test(title)) c.los = null; // kick plays: no line of scrimmage on the replay
    const mb = side ? c.score[1] - c.score[0] : c.score[0] - c.score[1], ma = side ? sc[1] - sc[0] : sc[0] - sc[1]; // margins for the scoring team
    const goAhead = side >= 0 && pts >= 2 && mb <= 0 && (ma > 0 || (pts >= 6 && ma >= -1)); // a TD that the extra point puts ahead counts
    if (c.q >= 4 && Math.abs(sc[0] - sc[1]) <= 8) ex += 10;
    if (goAhead && c.q >= 4) ex += 15;
    if (team >= 0 && team === G.human) ex += 8; // your plays first
    if (ex < 15) return null;
    const ck = Math.max(0, Math.ceil(c.clock || 0));
    return { ex: Math.round(ex), title, who, team: team < 0 ? c.poss : team, key: key < 0 ? c.fr.length - 1 : key, goAhead, qn: c.q, score: sc.slice(),
      q: c.q > 4 ? 'OT' : `Q${c.q}`, clock: `${Math.floor(ck / 60)}:${String(ck % 60).padStart(2, '0')}`, t: c.t0 };
  },
  // squeeze the frames down: trim to the play, one text track per number
  pack(c, info) {
    const endI = c.endI >= 0 ? c.endI : c.fr.length - 1, a = Math.max(0, endI - HL_PRE * HL_RATE), fr = c.fr.slice(a), n = fr.length;
    const np = c.src.length, tr = [];
    for (let i = 0; i < np; i++) for (let k = 0; k < HL_NF; k++) tr.push(hlEnc(fr.map(s => s.p[i * HL_NF + k])));
    const col = (f, j) => hlEnc(fr.map(s => f(s)[j]));
    const ghost = p => { const g = {}; for (const k of HL_KEEP) if (p[k] !== undefined) g[k] = p[k]; return g; };
    return { ...info, key: Math.max(0, info.key - a), n, pl: c.src.map(ghost), tr, m: c.src.map((_, i) => hlRle(fr.map(s => s.m[i]))),
      b: [0, 1, 2, 3, 4, 5, 6].map(j => col(s => s.b, j)), r: Array.from({ length: c.nref * 6 }, (_, j) => col(s => s.r, j)), c: [0, 1].map(j => col(s => s.c, j)),
      fl: c.fl, los: c.los, fdx: c.fdx, gtg: c.gtg };
  },
  // the game is over: close the last play, crown the game-winner, list them in game order
  done(s) {
    this.finalize();
    if (G.pbp !== this.pbpRef) return this.clips = [];
    const me = s && s.score ? s.score : G.score, win = me[0] > me[1] ? 0 : me[1] > me[0] ? 1 : -1;
    const gw = this.gw; // the last go-ahead score of the 4th / OT, by the team that won = the game-winner
    if (gw && win >= 0 && gw.team === win && !gw.gwDone) {
      gw.gwDone = gw.gw = true; gw.ex += 60;
      if (!this.clips.includes(gw)) { this.clips.push(gw); if (this.clips.length > HL_MAX) this.clips.splice(this.clips.indexOf(this.clips.filter(x => x !== gw).reduce((a, x) => x.ex < a.ex ? x : a)), 1); }
    }
    this.clips.sort((a, b) => a.t - b.t);
    return this.clips;
  },
  label: c => (c.gw ? 'GAME-WINNING ' : '') + c.title,
  best() { return this.clips.reduce((a, x) => !a || x.ex > a.ex ? x : a, null); },
  bytes() { return JSON.stringify(this.clips).length; },

  // ---------------- the reel ----------------
  // list = clips to show back to back; then(): where to go when it's done
  play(list, then) {
    if (!list || !list.length) return;
    const S = this.saved = { then, cam: { x: cam.x, y: cam.y, zoom: cam.zoom, focus: cam.focus, shake: cam.shake } };
    for (const k of ['players', 'O', 'D', 'ball', 'refs', 'los', 'firstDownX', 'goalToGo', 'phase', 'fx', 'banner', 'pbpShow', 'crowdHype', 'time', 'showTarget', 'aim', 'meterV', 'humanPlayer', 'cellyGuy', 'tdScorer', 'slowmo', 'kick']) S[k] = G[k];
    this.list = list; this.idx = 0; this.on = true; this.load(0);
    show(null); $('btnPause').style.display = 'none';
    Object.assign(G, { O: null, D: null, fx: [], banner: null, showTarget: false, aim: null, meterV: null, humanPlayer: null, cellyGuy: null, tdScorer: null, slowmo: 0, phase: 'hl' });
    cam.zoom = 1; cam.focus = null;
  },
  load(i) {
    const c = this.list[i]; this.idx = i; this.u = 0; this.age = 0; this.hold = 0; this.fade = 0;
    const tr = c.tr.map((s, j) => hlDec(s, HL_PF[j % HL_NF][2]));
    this.dec = { tr, m: c.m.map(hlUnrle), b: c.b.map((s, j) => hlDec(s, [20, 20, 20, 10, 1, 1, 100][j])), r: c.r.map((s, j) => hlDec(s, [20, 20, 1, 10, 1, 20][j % 6])), c: c.c.map(s => hlDec(s, 20)) };
    G.players = c.pl.map(p => ({ ...p, face: { ...p.face }, head: { ox: 0, oy: 0, vx: 0, vy: 0, rot: 0 }, stamina: 1, isHuman: false, x: 0, y: 0 }));
    G.refs = Array.from({ length: c.r.length / 6 }, () => ({ x: 0, y: 0, face: 1, anim: 0, throwT: 0 }));
    G.ball = { x: 0, y: 0, z: 0, spin: 0, holder: null, flight: null };
    Object.assign(G, { los: c.los, firstDownX: c.fdx, goalToGo: c.gtg, crowdHype: 0 });
    this.apply(0);
  },
  // put frame u (fractional = blend the two around it) onto the stand-ins
  apply(u) {
    const c = this.list[this.idx], D = this.dec, n = c.n, i = Math.min(n - 1, Math.floor(u)), j = Math.min(n - 1, i + 1), f = u - i;
    const at = (a, sm) => sm ? a[i] + (a[j] - a[i]) * f : a[i];
    G.players.forEach((p, pi) => {
      for (let k = 0; k < HL_NF; k++) HL_PF[k][1](p, at(D.tr[pi * HL_NF + k], HL_PF[k][3]));
      const [mo, ct] = D.m[pi][i].split('|'); p.mouth = mo;
      if (ct) { if (!p.celly || p.celly.type !== ct) p.celly = { type: ct, t: 0 }; HL_PF[HL_NF - 1][1](p, at(D.tr[pi * HL_NF + HL_NF - 1], 1)); } else p.celly = null;
    });
    const B = D.b, b = G.ball, h = B[4][i], fi = B[5][i];
    b.x = at(B[0], 1); b.y = at(B[1], 1); b.z = at(B[2], 1); b.spin = at(B[3], 1);
    b.holder = h >= 0 ? G.players[h] : null;
    if (h === -2) { b.x = -999; b.z = 0; } // no ball that frame
    b.flight = fi >= 0 ? { ...c.fl[fi], t: B[5][j] === fi ? at(B[6], 1) : B[6][i] } : null;
    G.refs.forEach((r, ri) => { const R = k => D.r[ri * 6 + k]; r.x = at(R(0), 1); r.y = at(R(1), 1); r.face = R(2)[i]; r.anim = at(R(3), 1); r.moving = !!R(4)[i]; r.throwT = at(R(5), 1); });
    cam.x = at(D.c[0], 1); cam.y = at(D.c[1], 1);
  },
  // SAVE CLIP (clips.js): how long the clip runs from frame u0, and the earliest start that fits in maxSec
  runTime(u0) { const c = this.list[this.idx]; let u = u0, t = 0; while (u < c.n - 1 && t < 60) { u += HL_RATE * this.speed(u) / 30; t += 1 / 30; } return t; },
  recStart(maxSec) { const c = this.list[this.idx]; let u0 = 0; while (u0 < c.key && this.runTime(u0) > maxSec) u0 += 5; return Math.min(u0, Math.max(0, c.n - 2)); },
  // play speed: real time, then slow motion through the big moment
  speed(u) { const t = (u - this.list[this.idx].key) / HL_RATE, ramp = v => 1 - Math.min(1, Math.max(0, v)) * 0.6; return t < 0 ? ramp((t + 0.75) / 0.25) : ramp((0.55 - t) / 0.2); }, // 0.4x from 0.5s before to 0.35s after
  update(dt) {
    dt = Math.min(dt, 0.05);
    const P = Input.pressed, taps = Input.taps.splice(0), c = this.list[this.idx];
    let next = P.Space || P.Enter || P.ArrowRight || P.KeyN, stop = P.Escape || P.Backspace, save = P.KeyS;
    for (const t of taps) { const B = this.btns(); if (B.done.hit(t)) stop = true; else if (B.save.hit(t)) save = true; else next = true; }
    if (this.rec) next = stop = save = false; // filming a clip: it plays through on its own (CANCEL is on the bar up top)
    if (save) { const th = this.saved.then; this.saved.then = null; this.stop(); return Clips.highlight(c, th); }
    if (stop) return this.stop();
    if (next) return this.advance();
    const sp = this.speed(this.u);
    G.time += dt * sp; this.age += dt;
    const k = c.key;
    if (this.u < k && this.u + dt * HL_RATE * sp >= k && c.title.includes('HIT')) cam.shake = 12;
    if (this.u >= k && (c.gw || /TD|PICK|GOAL/.test(c.title))) G.crowdHype = Math.min(1.4, G.crowdHype + dt * 3); else G.crowdHype = Math.max(0, G.crowdHype - dt);
    this.u = Math.min(c.n - 1, this.u + dt * HL_RATE * sp);
    cam.shake = Math.max(0, cam.shake - dt * 30);
    if (this.u >= c.n - 1) { this.hold += dt; if (this.hold > 0.7) this.fade += dt; if (this.fade > 0.3) return this.advance(); }
    this.apply(this.u);
  },
  advance() { if (this.idx + 1 < this.list.length) { this.load(this.idx + 1); this.fade = 0; } else this.stop(); },
  stop() {
    const S = this.saved; this.on = false; this.dec = null;
    for (const k in S) if (k !== 'cam' && k !== 'then') G[k] = S[k];
    Object.assign(cam, S.cam);
    Input.taps.length = 0; Input.pressed = {};
    if (S.then) S.then();
  },
  // tap targets (canvas coords): DONE bottom right; anywhere else = next play
  btns() {
    const mob = G.mode === 'mobile', w = mob ? 150 : 128, h = mob ? 60 : 50, y = CH - 34 - h, x = CW - w - 30; // bottom right, by your thumb
    const box = (x, y) => ({ x, y, w, h, hit: t => t.x >= x - 10 && t.x <= x + w + 10 && t.y >= y - 10 && t.y <= y + h + 10 });
    return { done: box(x, y), next: box(x - w - 12, y), save: box(24, 96), w, h }; // SAVE CLIP: top left, under HIGHLIGHTS
  },
  drawOverlay(g) {
    const c = this.list[this.idx]; if (!c) return;
    const HD = '"Barlow Condensed", Arial, sans-serif', mob = G.mode === 'mobile', t = G.teams[c.team] || G.teams[0];
    const potg = c === this.best();
    g.save(); g.textBaseline = 'middle';
    // top left: HIGHLIGHTS + where we are in the reel
    g.fillStyle = '#0b0f16e6'; g.beginPath(); g.moveTo(0, 18); g.lineTo(250, 18); g.lineTo(236, 66); g.lineTo(0, 66); g.fill();
    g.fillStyle = '#f6c31c'; g.fillRect(0, 18, 8, 48);
    g.fillStyle = '#fff'; g.font = `italic 900 32px ${HD}`; g.textAlign = 'left'; g.fillText('HIGHLIGHTS', 24, 43);
    if (this.list.length > 1) for (let i = 0; i < this.list.length; i++) { g.fillStyle = i < this.idx ? '#f6c31c88' : i === this.idx ? '#f6c31c' : '#ffffff33'; g.fillRect(24 + i * 26, 74, 20, 6); }
    // top right: NEXT / DONE
    const B = this.btns();
    const btn = (b, label, key, gold) => {
      g.fillStyle = gold ? '#f6c31c' : '#0b0f16e6'; g.beginPath(); g.moveTo(b.x + 10, b.y); g.lineTo(b.x + b.w, b.y); g.lineTo(b.x + b.w - 10, b.y + b.h); g.lineTo(b.x, b.y + b.h); g.fill();
      g.fillStyle = gold ? '#111' : '#fff'; g.textAlign = 'center'; g.font = `italic 900 ${mob ? 28 : 24}px ${HD}`; g.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + (mob ? 1 : -4));
      if (!mob) { g.font = `800 12px ${HD}`; g.fillStyle = gold ? '#111a' : '#9aa6b5'; g.fillText(key, b.x + b.w / 2, b.y + b.h - 8); }
    };
    if (this.rec) { g.fillStyle = '#ffffffb0'; g.font = `italic 900 26px ${HD}`; g.textAlign = 'right'; g.fillText('BOBBLE BOWL', CW - 30, 42); } // filming: no buttons, a little watermark
    else {
      if (this.list.length > 1) btn(B.next, this.idx + 1 < this.list.length ? 'NEXT' : 'END', mob ? '' : 'SPACE');
      btn(B.done, 'DONE', 'ESC', true);
      btn(B.save, 'SAVE CLIP', 'S');
    }
    // lower third: slides in, team color + gold edge, big italic caps
    const sl = 1 - Math.pow(1 - Math.min(1, this.age / 0.35), 3), w = Math.min(CW - 80, 860), h = 122, x = 40 - (1 - sl) * (w + 60), y = CH - h - 34;
    g.globalAlpha = sl;
    g.fillStyle = '#0b0f16ee'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - 18, y + h); g.lineTo(x, y + h); g.fill();
    g.fillStyle = t.c1 === '#000000' ? '#333' : t.c1; g.fillRect(x, y, 118, h);
    g.fillStyle = '#f6c31c'; g.fillRect(x + 118, y, 5, h);
    try { g.drawImage(Logo.canvas(t, 96), x + 15, y + 17, 88, 88); } catch (e) {}
    g.textAlign = 'left'; g.fillStyle = '#f6c31c'; g.font = `800 19px ${HD}`;
    g.fillText(potg ? 'PLAY OF THE GAME' : this.list.length > 1 ? `HIGHLIGHT ${this.idx + 1} OF ${this.list.length}` : 'HIGHLIGHT', x + 142, y + 24);
    const lb = this.label(c); g.fillStyle = '#fff'; g.font = `italic 900 ${lb.length > 22 ? 40 : 48}px ${HD}`;
    g.fillText(lb, x + 140, y + 62, w - 330);
    g.fillStyle = '#c9d3df'; g.font = `600 22px ${HD}`;
    g.fillText([c.who, `${c.q}  ${c.clock}`].filter(Boolean).join('  ·  '), x + 142, y + 100, w - 330);
    // score after the play
    const T = G.teams, sx0 = x + w - 190;
    g.fillStyle = '#ffffff10'; g.fillRect(sx0, y + 22, 150, 78);
    [1, 0].forEach((s, r) => {
      const yy = y + 42 + r * 38; g.fillStyle = T[s].c1 === '#000000' ? '#555' : T[s].c1; g.fillRect(sx0, yy - 15, 6, 30);
      g.fillStyle = '#fff'; g.font = `italic 900 26px ${HD}`; g.textAlign = 'left'; g.fillText(T[s].id, sx0 + 16, yy + 1);
      g.textAlign = 'right'; g.fillStyle = c.score[s] > c.score[1 - s] ? '#f6c31c' : '#fff'; g.fillText(c.score[s], sx0 + 138, yy + 1);
    });
    // progress through the clip
    g.fillStyle = '#ffffff22'; g.fillRect(x + 123, y + h - 5, w - 141, 5);
    g.fillStyle = '#f6c31c'; g.fillRect(x + 123, y + h - 5, (w - 141) * Math.min(1, this.u / Math.max(1, c.n - 1)), 5);
    g.globalAlpha = 1;
    // slow motion tag + fade between plays
    if (this.speed(this.u) < 0.6) { g.fillStyle = '#0b0f16cc'; g.fillRect(x, y - 38, 128, 30); g.fillStyle = '#f6c31c'; g.font = `italic 900 20px ${HD}`; g.textAlign = 'left'; g.fillText('SLOW MOTION', x + 12, y - 22); }
    const fa = Math.max(Math.min(1, this.fade / 0.3), 1 - Math.min(1, this.age / 0.25));
    if (fa > 0) { g.globalAlpha = fa; g.fillStyle = '#05070b'; g.fillRect(0, 0, CW, CH); }
    g.restore();
  }
};
// film every snap: Replay.begin() runs at each snap / kick return, update() runs every game step
{ const _b = Replay.begin.bind(Replay); Replay.begin = () => { _b(); try { Highlights.begin(); } catch (e) { console.error('hl', e); } }; }
{ const _u = update; update = function (dt) { _u(dt); if (Highlights.cur) try { Highlights.tick(); } catch (e) { console.error('hl', e); Highlights.cur = null; } }; }
