// ---- Online play: one player hosts and gets a code, the other types it in ----
// The host's device runs the real game and streams it ~30x a second. The guest's device sends its controls back.
// Connection is peer-to-peer (WebRTC through PeerJS). No chat, no lobby: only someone with your code can join.
// Two lanes: a "safe" one (in order, nothing lost) for one-time things like play calls, banners and sounds,
// and a "fast" one for the constant position updates, so one lost packet can't freeze everything behind it.
// The guest plays the updates back ~0.1s behind and slides players smoothly between them.
const NET_VERSION = 2;
const NET_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const NET_KEYS = ['Space', 'ShiftLeft', 'ControlLeft', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'KeyF', 'KeyR', 'KeyQ', 'Tab', 'KeyC',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'KeyT', 'KeyX', 'KeyM', 'KeyV', 'KeyB', 'Enter', 'Escape'];
const PSTAT = ['x', 'y', 'vx', 'vy', 'anim', 'speedNow', 'down', 'downDir', 'dive', 'jump', 'spin', 'stiff', 'throwAnim', 'celebrate', 'dizzy', 'hit', 'stamina', 'juke'];

const Net = {
  peer: null, conn: null, fast: null, fastOk: false, role: null, code: null, side: null, status: '', ready: false,
  seq: 0, lastSeq: -1, inSeq: 0, lastIn: -1, buf: [], off: null, jit: 0.02,
  out: { pressed: [], taps: [] }, sendT: 0, snapT: 0, last: null, rosterRef: null, bannerRef: null, pbpRef: null, routeKey: '', sounds: [],
  picks: {}, callId: 0, pendingCall: null,

  // ---------------- connecting ----------------
  ice: { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] } },
  makeCode() { let c = ''; for (let i = 0; i < 4; i++) c += NET_CHARS[Math.floor(Math.random() * NET_CHARS.length)]; return c; },
  peerId(code) { return 'bobblebowl-' + code.toUpperCase(); },
  host(onCode, onStatus) {
    this.reset(); this.role = 'host'; this.side = 0;
    const tryCode = () => {
      this.code = this.makeCode();
      this.peer = new Peer(this.peerId(this.code), this.ice);
      this.peer.on('open', () => onCode(this.code));
      this.peer.on('error', e => { if (e.type === 'unavailable-id') { this.peer.destroy(); tryCode(); } else onStatus(this.errText(e)); });
      this.peer.on('connection', c => {
        if (c.label === 'fast') { // the guest's second lane
          if (!this.conn || c.peer !== this.conn.peer) { c.close(); return; }
          this.fast = c; c.on('open', () => { this.fastOk = true; }); c.on('data', m => this.recv(m, true)); c.on('close', () => { this.fastOk = false; });
          return;
        }
        if (this.conn) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } // only one friend per code
        this.conn = c; this.wire(c, onStatus);
      });
    };
    tryCode();
  },
  join(code, onStatus) {
    this.reset(); this.role = 'guest'; this.side = 1; this.code = code.toUpperCase();
    this.peer = new Peer(this.ice);
    this.peer.on('open', () => {
      const c = this.peer.connect(this.peerId(this.code), { reliable: true, serialization: 'json' });
      this.conn = c; this.wire(c, onStatus);
      c.on('open', () => { // then open the fast lane (unordered, JSON)
        const f = this.peer.connect(this.peerId(this.code), { reliable: false, serialization: 'json', label: 'fast' });
        this.fast = f; f.on('open', () => { this.fastOk = true; }); f.on('data', m => this.recv(m, true)); f.on('close', () => { this.fastOk = false; });
      });
      setTimeout(() => { if (!this.ready) onStatus("Couldn't reach that game. Check the code, and make sure your friend is still on the HOST screen."); }, 12000);
    });
    this.peer.on('error', e => onStatus(e.type === 'peer-unavailable' ? 'No game with that code. Double-check it with your friend.' : this.errText(e)));
  },
  errText(e) { return e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? "Can't reach the online server. Check your internet." : 'Connection problem (' + (e.type || 'unknown') + '). Try again.'; },
  wire(c, onStatus) {
    c.on('open', () => {
      this.ready = true;
      if (this.role === 'guest') c.send({ t: 'hello', team: TEAMS[sel.idx[sel.you]].id, mode: G.mode, v: NET_VERSION });
      onStatus('Connected!');
    });
    c.on('data', m => this.recv(m));
    c.on('close', () => this.lost());
    c.on('error', () => this.lost());
  },
  send(m, fast) {
    if (fast && this.fast && this.fastOk) { try { this.fast.send(m); } catch (e) {} return; }
    if (this.conn && this.ready) try { this.conn.send(m); } catch (e) {}
  },
  reset() {
    try { this.fast && this.fast.close(); } catch (e) {} try { this.conn && this.conn.close(); } catch (e) {} try { this.peer && this.peer.destroy(); } catch (e) {}
    Object.assign(this, { peer: null, conn: null, fast: null, fastOk: false, seq: 0, lastSeq: -1, inSeq: 0, lastIn: -1, buf: [], off: null, jit: 0.02, role: null, ready: false, last: null, rosterRef: null, bannerRef: null, pbpRef: null, routeKey: '', picks: {}, pendingCall: null, sounds: [], out: { pressed: [], taps: [] } });
    G.online = false; Input.online = false; Input.use(0); Input.store[1] = null;
  },
  lost() {
    if (!this.role) return;
    const inGame = G.online && G.teams && G.phase !== 'over';
    this.reset();
    if (inGame) {
      G.teams = null; G.phase = 'idle';
      if (typeof onlineMsg === 'function') onlineMsg('Your opponent left the game.');
    } else if (typeof onlineMsg === 'function') onlineMsg('Connection closed.');
  },
  leave() { this.send({ t: 'bye' }); setTimeout(() => this.reset(), 150); },

  // ---------------- messages ----------------
  recv(m, fast) {
    if (!m || !m.t) return;
    if (this.role === 'host') {
      if (m.t === 'hello') { if (m.v !== NET_VERSION) { this.send({ t: 'old' }); return setTimeout(() => this.reset(), 300); } return this.startHost(m); }
      if (m.t === 'in') return this.mergeInput(m);
      if (m.t === 'in1') return this.mergeOneShots(m);
      if (m.t === 'pick') return this.pick(1, m.mode, m.key, m.id);
      if (m.t === 'tool') { if (m.k === 'timeout') callTimeout(1); else if (m.k === 'spike' && G.poss === 1) spikeBall(); return; }
    } else {
      if (m.t === 'start') return this.startGuest(m);
      if (m.t === 'roster') return this.applyRoster(m);
      if (m.t === 's') return this.applySnap(m);
      if (m.t === 'e') return this.applyEvents(m);
      if (m.t === 'old') { if (typeof onlineMsg === 'function') onlineMsg('You two are on different versions. Both of you: close the game all the way and reopen it.'); return this.reset(); }
      if (m.t === 'call') return this.showCall(m);
      if (m.t === 'over') return this.guestOver(m);
      if (m.t === 'full') { if (typeof onlineMsg === 'function') onlineMsg('That game already has two players.'); return this.reset(); }
    }
    if (m.t === 'bye') this.lost();
  },

  // ---------------- host ----------------
  startHost(hello) {
    const mine = TEAMS[sel.idx[sel.you]];
    let theirs = TEAMS.find(t => t.id === hello.team) || TEAMS[(sel.idx[sel.you] + 1) % 32];
    if (theirs.id === mine.id) theirs = TEAMS[(TEAMS.indexOf(mine) + 1) % 32]; // can't both be the same team
    Input.online = true; Input.store[1] = Input.remote(); Input.use(0);
    G.online = true; G.netModes = [G.mode, hello.mode === 'mobile' ? 'mobile' : 'computer'];
    G.demo = false; G.season = false; G.challenge = null; G.mini = null; show(null);
    const opts = { qtr: +$('optQtr').value, diff: 1, humanSide: 0, versus: true, weather: pickWeather($('optWeather').value), night: $('optNight').value === '1' };
    newGame(mine, theirs, opts);
    this.send({ t: 'start', v: NET_VERSION, teams: G.teams, opts: { qtr: opts.qtr, weather: G.weather, night: G.night }, modes: G.netModes });
  },
  // guest's controls arrive: world coords -> host screen coords for taps / finger
  mergeInput(m) {
    const R = Input.store[1]; if (!R) return;
    if (m.n != null) { if (m.n <= this.lastIn) return; this.lastIn = m.n; } // fast lane: skip old ones that arrive late
    R.down = {}; for (const k of m.held || []) R.down[k] = true;
    this.mergeOneShots(m);
    R.stick.x = m.st[0]; R.stick.y = m.st[1]; R.stick.m = m.st[2];
    R.pads = [m.ax ? { x: m.ax[0], y: m.ax[1], m: m.ax[2] } : null, m.ax ? { x: m.ax[0], y: m.ax[1], m: m.ax[2] } : null];
    const P = R.pointer, wasDown = P.down;
    P.down = !!m.p[0]; P.wx = m.p[1]; P.wy = m.p[2]; P.wx0 = m.p[3]; P.wy0 = m.p[4]; P.t = m.p[5]; P.moved = !!m.p[6];
    if (!P.down || !wasDown) P.aiming = false;
  },
  // key presses, taps and throws come on the safe lane so they never get lost
  mergeOneShots(m) {
    const R = Input.store[1]; if (!R) return;
    for (const k of m.pressed || []) R.pressed[k] = true;
    for (const t of m.taps || []) R.taps.push({ wx: t[0], wy: t[1] });
    if (m.rel) { R.release = { x: m.rel[0], y: m.rel[1] }; R.flick = !!m.rel[2]; if (m.p) { const P = R.pointer; P.wx = m.p[1]; P.wy = m.p[2]; P.wx0 = m.p[3]; P.wy0 = m.p[4]; P.t = m.p[5]; P.moved = !!m.p[6]; } }
  },
  hostFrame(dt) {
    if (!this.ready || !G.teams) return;
    // after the engine used the guest's one-shot inputs this frame, clear them
    const R = Input.store[1];
    if (R) { R.pressed = {}; R.taps = []; R.release = null; if (Input.cur === 1) Input.use(0); }
    this.snapT -= dt;
    if (this.snapT <= 0) { this.snapT = 1 / 30; this.sendSnap(); }
  },
  // convert the guest's finger (sent in field coords) into this screen's coords right before the engine runs
  prepRemote() {
    const R = Input.store[1]; if (!R) return;
    const P = R.pointer;
    if (P.wx != null) { P.x = sx(P.wx); P.y = sy(P.wy); P.x0 = sx(P.wx0); P.y0 = sy(P.wy0); }
    for (const t of R.taps) if (t.wx != null) { t.x = sx(t.wx); t.y = sy(t.wy); }
  },
  sendSnap() {
    const P = G.players || [];
    if (P !== this.rosterRef) { this.rosterRef = P; this.sendRoster(); }
    const idx = p => p ? P.indexOf(p) : -1, b = G.ball;
    const r2 = v => Math.round(v * 100) / 100;
    const s = {
      t: 's', n: ++this.seq, tm: r2(performance.now() / 10) / 100, ph: G.phase, sc: G.score, q: G.quarter, cl: G.clock, dn: G.down, los: G.los, fdx: G.firstDownX, gtg: G.goalToGo, by: G.ballY, poss: G.poss,
      to: G.timeouts, pr: G.pendingRunoff > 0 ? 1 : 0, pc: G.playClock, sp: G.special, pat: G.patSide, two: G.twoPt, bs: G.bstate, kp: G.koPending, ks: G.kickoffSide, st: G.showTarget,
      ok: G.play && G.play.off && G.play.off.key, dk: G.play && G.play.def && G.play.def.key, fm: G.play && G.play.form && G.play.form.name, pt: G.play && G.play.t,
      ps: P.map(p => PSTAT.map(k => typeof p[k] === 'number' ? Math.round(p[k] * 100) / 100 : 0).concat([p.face.dir, p.engaged ? 1 : 0, p.isHuman ? 1 : 0, p.mouth || '',
        Math.round(p.head.ox), Math.round(p.head.oy), p.sprinting ? 1 : 0, p.xf && p.xf.on ? 1 : 0, p.celly ? p.celly.type : 0, p.celly ? Math.round(p.celly.t * 100) / 100 : 0,
        p.throwKey || 0, p.openness == null ? -1 : Math.round(p.openness * 10) / 10])),
      b: b ? [r2(b.x), r2(b.y), r2(b.z), r2(b.spin || 0), idx(b.holder), b.flight ? [r2(b.flight.sx), r2(b.flight.sy), r2(b.flight.tx), r2(b.flight.ty), r2(b.flight.t), r2(b.flight.T), r2(b.flight.peak), b.flight.pitch ? 1 : 0, b.flight.kick || 0, b.flight.duck ? 1 : 0, idx(b.flight.intended), b.flight.style || ''] : null, b.loose ? 1 : 0] : null,
      rf: (G.refs || []).map(r => [r2(r.x), r2(r.y), r.face, r2(r.anim || 0), r.moving, r2(r.throwT || 0)]),
      hp: [idx(G.hp && G.hp[0]), idx(G.hp && G.hp[1])], hd: [idx(G.hd && G.hd[0]), idx(G.hd && G.hd[1])],
      km: G.km && (G.phase === 'kickmeter' || G.phase === 'kick') ? { kind: G.km.kind, stage: G.km.stage, power: G.km.power, aim: G.km.aim, side: G.km.side, need: G.km.need, tol: G.km.tol, yds: G.km.yds, kk: G.km.kk, cpuT: G.km.cpuT != null ? 1 : null, wait: G.km.wait } : null,
      aim: G.aim, cg: idx(G.cellyGuy), hy: Math.round(G.crowdHype * 100) / 100, sh: Math.round(cam.shake), sm: G.slowmo > 0 ? 1 : 0, flg: (G.flags || []).length
    };
    // one-time stuff goes on the safe lane
    const e = { t: 'e', fx: [], snd: this.sounds.splice(0) };
    for (const f of G.fx) { if (f._s) continue; f._s = 1; if (f.kind === 'confetti') { e.conf = (e.conf || 0) + 1; continue; } e.fx.push(f); }
    if (G.banner !== this.bannerRef) { this.bannerRef = G.banner; e.bn = G.banner ? { ...G.banner } : 0; }
    if (G.pbpShow !== this.pbpRef) { this.pbpRef = G.pbpShow; e.pb = G.pbpShow; }
    // the guest's planned routes / defensive job (only before the snap)
    if (G.phase === 'presnap' && G.O) {
      const rk = JSON.stringify(G.O.map(p => [p.role, p.route && p.route.pts, p.hot]).concat(G.D.map(p => p.assign)));
      if (rk !== this.routeKey) { this.routeKey = rk; e.rt = { o: G.O.map(p => ({ role: p.role, route: p.route ? { pts: p.route.pts, end: p.route.end, i: 0 } : null, hot: p.hot || null, hx: p.hx, hy: p.hy })), d: G.D.map(p => p.assign) }; }
    } else this.routeKey = '';
    if (e.fx.length || e.snd.length || e.conf || e.bn !== undefined || e.pb || e.rt) this.send(e);
    this.send(s, true);
  },
  sendRoster() {
    const P = G.players || [];
    this.send({ t: 'roster', O: (G.O || []).map(p => P.indexOf(p)), D: (G.D || []).map(p => P.indexOf(p)),
      p: P.map(p => ({ side: p.side, off: p.off, slot: p.slot, pos: p.pos, name: p.name, num: p.num, ovr: p.ovr, spdR: p.spdR, face: p.face, headScale: p.headScale,
        role: p.role, assign: p.assign, xf: p.xf ? { kind: p.xf.kind, on: p.xf.on } : null, cap: p.cap })) });
  },
  // play calls: the offense and defense pick at the same time, each on their own screen
  onPlayCall(c) {
    this.picks = {}; this.callId++;
    const id = this.callId, side = c.side != null ? c.side : G.poss;
    const reqs = [{ ...c, side }];
    if (c.mode === 'off') reqs.push({ ...withSide(1 - side, playCallCtx), side: 1 - side });
    this.pendingCall = { id, reqs };
    for (const r of reqs) {
      if (r.side === 0) onPlayCall({ ...r, id });
      else this.send({ t: 'call', ctx: { ...r, id }, dt: G.downText() });
    }
    if (reqs.every(r => r.side === 0)) this.send({ t: 'call', ctx: { mode: 'wait', id } });
    if (reqs.every(r => r.side === 1)) { onlineWait('Waiting for your opponent to pick...'); }
  },
  pick(side, mode, key, id) {
    const pc = this.pendingCall; if (!pc || id !== pc.id || G.phase !== 'playcall') return;
    this.picks[side] = key;
    const offSide = pc.reqs[0].side, offKey = this.picks[offSide], defKey = this.picks[1 - offSide];
    const m = pc.reqs[0].mode;
    const special = offKey && ['punt', 'fg', 'fakepunt', 'fakefg', 'kneel'].includes(offKey);
    if (m === 'kickoff' && offKey) { this.done(); return chooseKickoff(offKey); }
    if (m === 'pat' && offKey) { this.done(); return choosePAT(offKey); }
    if (m === 'off' && offKey && (defKey || special)) { this.done(); return choosePlay(offKey, defKey || 'c3'); }
    if (side === 0) onlineWait('Waiting for your opponent to pick...');
  },
  done() { this.pendingCall = null; this.send({ t: 'call', ctx: { mode: 'close' } }); onlineWait(null); show(null); },
  over(s) { this.send({ t: 'over', s: { score: s.score, teams: s.teams.map(t => t.id), tstats: s.tstats, leaders: s.leaders } }); },

  // ---------------- guest ----------------
  startGuest(m) {
    if (m.v !== NET_VERSION) { if (typeof onlineMsg === 'function') onlineMsg('You two are on different versions. Both of you: close the game all the way and reopen it.'); return this.reset(); }
    Input.online = true;
    G.online = true; G.netModes = m.modes; G.demo = false; G.season = false; G.challenge = null; G.mini = null; show(null);
    initGame(m.teams[0], m.teams[1], { qtr: m.opts.qtr, diff: 1, humanSide: 1, versus: true, weather: m.opts.weather, night: m.opts.night });
    G.phase = 'idle'; G.players = []; G.ball = null;
  },
  applyRoster(m) {
    G.players = m.p.map(q => {
      const p = makePlayer(q.side, q.off, q.slot, [q.pos, q.name, q.num, q.ovr, q.spdR, q.face.skin]);
      Object.assign(p, { face: q.face, headScale: q.headScale, role: q.role, assign: q.assign, cap: q.cap, xf: q.xf, ovr: q.ovr });
      return p;
    });
    G.O = m.O.map(i => G.players[i]); G.D = m.D.map(i => G.players[i]);
    this.last = null; this.buf = [];
  },
  applySnap(s) {
    if (s.n != null) { if (s.n <= this.lastSeq) return; this.lastSeq = s.n; } // fast lane: an old one showed up late
    const first = !this.last; this.last = s;
    // clock sync: how far ahead the host's clock is (fastest arrival wins), and how jumpy arrivals are
    const clk = s.tm - performance.now() / 1000;
    if (this.off == null || clk > this.off) this.off = clk; else this.off -= 0.0002;
    this.jit += (Math.min(0.25, this.off - clk) - this.jit) * 0.05;
    this.buf.push({ tm: s.tm, p: s.ps.map(a => [a[0], a[1], a[2], a[3]]), b: s.b ? [s.b[0], s.b[1], s.b[2], s.b[4], s.b[5] ? s.b[5][4] : null] : null, rf: s.rf.map(r => [r[0], r[1]]) });
    if (this.buf.length > 20) this.buf.shift();
    const P = G.players;
    Object.assign(G, { phase: s.ph === 'replay' ? 'dead' : s.ph, score: s.sc, quarter: s.q, clock: s.cl, down: s.dn, los: s.los, firstDownX: s.fdx, goalToGo: s.gtg, ballY: s.by, poss: s.poss,
      timeouts: s.to, pendingRunoff: s.pr, playClock: s.pc, special: s.sp, patSide: s.pat, twoPt: s.two, bstate: s.bs, koPending: s.kp, kickoffSide: s.ks, showTarget: s.st, aim: s.aim,
      crowdHype: s.hy, km: s.km, flags: new Array(s.flg).fill({}) });
    if (s.sh > cam.shake) cam.shake = s.sh;
    if (s.sm) G.slowmo = 0.05;
    const off = OFF_PLAYS.concat(FAKE_PLAYS, typeof SPECIAL_PLAYS !== 'undefined' ? SPECIAL_PLAYS : []).find(p => p.key === s.ok) || (s.ok ? { key: s.ok, name: s.ok, type: s.ok === 'ret' ? 'ret' : 'pass' } : null);
    const def = DEF_PLAYS.find(p => p.key === s.dk) || (s.dk ? { key: s.dk, name: s.dk, a: [] } : null);
    G.play = off ? { off, def, t: s.pt || 0, form: s.fm ? { name: s.fm } : null } : null;
    s.ps.forEach((a, i) => {
      const p = P[i]; if (!p) return;
      if (first) { p.x = a[0]; p.y = a[1]; }
      for (let k = 2; k < PSTAT.length; k++) p[PSTAT[k]] = a[k];
      const n = PSTAT.length;
      p.face.dir = a[n]; p.engaged = a[n + 1] ? true : null; p.isHuman = !!a[n + 2]; p.mouth = a[n + 3]; p.head.ox = a[n + 4]; p.head.oy = a[n + 5];
      p.sprinting = !!a[n + 6]; if (p.xf) p.xf.on = !!a[n + 7]; p.celly = a[n + 8] ? { type: a[n + 8], t: a[n + 9] } : null;
      p.throwKey = a[n + 10]; p.openness = a[n + 11] < 0 ? null : a[n + 11];
      p.ctl = p.side === G.human ? 0 : 1; // you're always the yellow ring on your own screen
    });
    if (s.b) {
      const b = G.ball || (G.ball = {});
      if (b.x == null) { b.x = s.b[0]; b.y = s.b[1]; b.z = s.b[2]; }
      b.spin = s.b[3]; b.holder = s.b[4] >= 0 ? P[s.b[4]] : null; b.loose = s.b[6] ? {} : null;
      const f = s.b[5];
      b.flight = f ? { sx: f[0], sy: f[1], tx: f[2], ty: f[3], t: f[4], T: f[5], peak: f[6], pitch: !!f[7], kick: f[8] || null, duck: !!f[9], intended: P[f[10]] || null, style: f[11] } : null;
    } else G.ball = null;
    const oldRefs = G.refs || [];
    G.refs = s.rf.map((r, i) => ({ x: oldRefs[i] ? oldRefs[i].x : r[0], y: oldRefs[i] ? oldRefs[i].y : r[1], face: r[2], anim: r[3], moving: r[4], throwT: r[5] }));
    G.hp = s.hp.map(i => P[i] || null); G.humanPlayer = G.hp[G.human]; G.humanDef = P[s.hd[G.human]] || null;
    G.cellyGuy = P[s.cg] || null;
    if (G.phase !== 'playcall' && $('playcall').classList.contains('show')) { show(null); onlineWait(null); }
  },
  // one-time things from the safe lane: effects, sounds, banners, play-by-play, planned routes
  applyEvents(s) {
    for (const f of s.fx || []) G.fx.push(f);
    for (let i = 0; i < (s.conf || 0); i++) G.fx.push({ kind: 'confetti', px: rand(0, CW), py: rand(-200, 0), vy: rand(120, 260), vx: rand(-40, 40), z: 0, vz: 0, color: pick([G.teams[0].c1, G.teams[1].c1, '#fff']), life: 2.6, max: 2.6 });
    if (s.bn !== undefined) G.banner = s.bn || null;
    if (s.pb) { G.pbpShow = { ...s.pb, t: G.time }; (G.pbp || (G.pbp = [])).push(G.pbpShow); }
    for (const [k, args] of s.snd || []) if (Sound[k]) Sound[k](...args);
    if (s.rt) s.rt.o.forEach((q, i) => { const p = G.O && G.O[i]; if (p) Object.assign(p, q); });
    if (s.rt) s.rt.d.forEach((a, i) => { const p = G.D && G.D[i]; if (p) p.assign = a; });
  },
  // the guest just draws: smooth players toward the latest positions, run the camera / fx locally
  guestFrame(dt) {
    G.time += dt;
    if (G.slowmo > 0) G.slowmo -= dt;
    this.playback();
    updateFx(dt); updateCamera(dt); updateHint();
    this.guestSend(dt);
  },
  // draw the game a little in the past and slide between the two updates around that moment
  playback() {
    const B = this.buf; if (!B.length || this.off == null) return;
    const delay = clamp(0.05 + this.jit * 1.6, 0.06, 0.3);
    const rt = performance.now() / 1000 + this.off - delay;
    let a = B[0], c = null;
    for (let i = 0; i < B.length - 1; i++) if (B[i].tm <= rt && B[i + 1].tm >= rt) { a = B[i]; c = B[i + 1]; break; }
    if (!c) { a = B[B.length - 1]; if (rt < B[0].tm) a = B[0]; }
    const u = c ? (rt - a.tm) / Math.max(1e-4, c.tm - a.tm) : 0;
    const ex = c ? 0 : clamp(rt - a.tm, 0, 0.1); // ran out of updates: keep them moving a tiny bit
    const P = G.players;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], pa = a.p[i]; if (!pa) continue;
      const pc = c && c.p[i];
      if (pc) { const far = Math.hypot(pc[0] - pa[0], pc[1] - pa[1]) > 5; p.x = far ? pc[0] : lerp(pa[0], pc[0], u); p.y = far ? pc[1] : lerp(pa[1], pc[1], u); }
      else { p.x = pa[0] + pa[2] * ex; p.y = pa[1] + pa[3] * ex; }
    }
    const b = G.ball;
    if (b && a.b) {
      const cb = c && c.b;
      if (b.holder) { b.x = b.holder.x; b.y = b.holder.y; b.z = cb ? lerp(a.b[2], cb[2], u) : a.b[2]; }
      else if (cb && cb[3] === a.b[3]) { b.x = lerp(a.b[0], cb[0], u); b.y = lerp(a.b[1], cb[1], u); b.z = lerp(a.b[2], cb[2], u); }
      else { b.x = a.b[0]; b.y = a.b[1]; b.z = a.b[2]; }
      if (b.flight && a.b[4] != null) b.flight.t = cb && cb[4] != null && cb[4] >= a.b[4] ? lerp(a.b[4], cb[4], u) : a.b[4];
    }
    (G.refs || []).forEach((r, i) => { const ra = a.rf[i], rc = c && c.rf[i]; if (ra) { r.x = rc ? lerp(ra[0], rc[0], u) : ra[0]; r.y = rc ? lerp(ra[1], rc[1], u) : ra[1]; } });
  },
  guestSend(dt) {
    for (const c in Input.pressed) if (NET_KEYS.includes(c)) this.out.pressed.push(c);
    for (const t of Input.taps) this.out.taps.push([wx(t.x), wy(t.y)]);
    if (Input.release) this.out.rel = [Input.release.x, Input.release.y, Input.flick ? 1 : 0];
    const P = Input.pointer, ax = Input.axis(), r2 = v => Math.round(v * 100) / 100;
    const ptr = [P.down ? 1 : 0, r2(wx(P.x)), r2(wy(P.y)), r2(wx(P.x0)), r2(wy(P.y0)), r2(P.t || 0), P.moved ? 1 : 0];
    if (this.out.pressed.length || this.out.taps.length || this.out.rel) { // right away, on the safe lane
      this.send({ t: 'in1', pressed: this.out.pressed, taps: this.out.taps, rel: this.out.rel || null, p: ptr });
      this.out = { pressed: [], taps: [] }; this.sendT = 0;
    }
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 1 / 30;
    this.send({ t: 'in', n: ++this.inSeq, held: NET_KEYS.filter(c => Input.down[c]),
      st: [r2(Input.stick.x), r2(Input.stick.y), r2(Input.stick.m)], ax: Input.pads[0] ? [r2(ax.x), r2(ax.y), r2(ax.m)] : null, p: ptr }, true);
  },
  showCall(m) {
    const c = m.ctx;
    if (c.mode === 'close') { onlineWait(null); return show(null); }
    if (c.mode === 'wait') return onlineWait('Your opponent is picking a play...');
    onlineWait(null);
    onPlayCall(c);
  },
  guestOver(m) {
    const s = m.s;
    G.phase = 'over';
    G.hooks.onGameOver({ score: s.score, teams: s.teams.map(id => G.teams.find(t => t.id === id)), human: G.human, tstats: s.tstats, leaders: s.leaders });
  }
};

// the host's sounds get replayed on the guest's device
['tone', 'noise'].forEach(k => {
  const f = Sound[k].bind(Sound);
  Sound[k] = (...a) => { if (Net.role === 'host' && Net.ready) Net.sounds.push([k, a]); return f(...a); };
});
