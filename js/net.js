// ---- Online play: one player hosts and gets a code, the other types it in ----
// The host's device runs the real game and streams it ~50x a second. The guest's device sends its controls back.
// Connection is peer-to-peer (WebRTC through PeerJS) when the two networks allow it. No chat, no lobby: only someone with your code can join.
// Two lanes: a "safe" one (in order, nothing lost) for one-time things like play calls, banners and sounds,
// and a "fast" one for the constant position updates, so one lost packet can't freeze everything behind it.
// The guest plays the updates back ~0.1s behind and slides players smoothly between them.
const NET_VERSION = 4;
const NET_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const NET_KEYS = ['Space', 'ShiftLeft', 'ControlLeft', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'KeyF', 'KeyR', 'KeyQ', 'Tab', 'KeyC',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'KeyT', 'KeyX', 'KeyM', 'KeyV', 'KeyB', 'Enter', 'Escape', 'KeyY'];
const PSTAT = ['x', 'y', 'vx', 'vy', 'anim', 'speedNow', 'down', 'downDir', 'dive', 'jump', 'spin', 'stiff', 'throwAnim', 'celebrate', 'dizzy', 'hit', 'stamina', 'juke'];

// Backup route (relay): when a direct connection can't get through (phone data, school Wi-Fi, two different houses),
// both devices talk through a Firebase database instead. Slower than direct, but it works on any network.
// It is also the way back in when a direct game drops in the middle (tunnel, switching apps): the game keeps going there.
// Room = bobble/rooms/CODE: host + guest (who's here), h2g / g2h (one lane each way, everything in order).
// Every lane is a list the other side reads and deletes, and each side's stuff is deleted by the server
// when that device drops off, so old rooms clean themselves up.
const RELAY_CFG = { apiKey: 'AIzaSyDkw-xjR0eAkCPR3BRQyKk0Rnusu3pbEmw', authDomain: 'cardio-game-3713.firebaseapp.com', databaseURL: 'https://cardio-game-3713-default-rtdb.firebaseio.com', projectId: 'cardio-game-3713' };
const NET_HZ = 50; // direct connection: updates per second both ways (was 30)
const RELAY_HZ = 25;
const RELAY_WAIT = 2500; // guest: direct line not up this long after the game was found -> relay
const LINK_DEAD = 2000;  // nothing at all from the other side this long on a direct game -> switch it to the relay
const HOLD_AFTER = 1500; // host: no controls from the guest this long -> pause the game until they're back
const GIVE_UP = 30000;   // nothing at all this long -> the game is over
const CODE_LIFE = 30 * 60000; // an unused host code goes away after 30 minutes
const Relay = {
  dbp: null,
  load() {
    if (this.dbp) return this.dbp;
    this.dbp = new Promise((res, rej) => {
      const add = (src, cb) => { const sc = document.createElement('script'); sc.src = src; sc.onload = cb; sc.onerror = () => rej(new Error('relay load')); document.head.appendChild(sc); };
      const init = () => { try { const app = firebase.apps.find(a => a.name === 'bobble') || firebase.initializeApp(RELAY_CFG, 'bobble'); res(app.database()); } catch (e) { rej(e); } };
      if (typeof firebase !== 'undefined' && firebase.database) init(); else add('js/lib/firebase-app-compat.js', () => add('js/lib/firebase-database-compat.js', init));
    });
    this.dbp.catch(() => { this.dbp = null; });
    return this.dbp;
  },
  // numbers to 3 decimals on the way out (keeps every write small)
  rnd(k, v) { return typeof v === 'number' && v % 1 ? Math.round(v * 1000) / 1000 : v; },
  // a fake "connection" with the same send/on/close as a PeerJS one: push onto our list, read + delete theirs (in order, nothing lost).
  // Everything sent in one frame goes out as one write, and what we read gets deleted in batches.
  lane(room, outKey, inKey) {
    const L = { open: true, hs: {}, relay: true, q: [], bytes: 0, outB: 0, writes: 0,
      on(ev, fn) { (this.hs[ev] = this.hs[ev] || []).push(fn); if (ev === 'open') setTimeout(() => { if (L.open) fn(); }, 0); },
      emit(ev, x) { for (const f of this.hs[ev] || []) f(x); } };
    const outRef = room.child(outKey), inRef = room.child(inKey);
    let del = {}, delT = null;
    const cb = inRef.on('child_added', sn => {
      del[sn.key] = null; if (!delT) delT = setTimeout(() => { delT = null; const d = del; del = {}; inRef.update(d).catch(() => {}); }, 200);
      const v = sn.val(); if (typeof v !== 'string' || !L.open) return;
      let a; try { a = JSON.parse(v); } catch (e) { return; }
      L.bytes += v.length;
      for (const m of v[0] === '[' ? a : [a]) L.emit('data', m);
    });
    L.send = m => {
      if (!L.open) return;
      L.q.push(JSON.stringify(m, Relay.rnd));
      if (L.q.length === 1) Promise.resolve().then(() => { const q = L.q; L.q = []; if (!L.open || !q.length) return; const v = q.length === 1 ? q[0] : '[' + q.join(',') + ']'; L.outB += v.length; L.writes++; outRef.push(v); });
    };
    L.close = () => { if (!L.open) return; L.open = false; inRef.off('child_added', cb); setTimeout(() => L.emit('close'), 0); };
    return L;
  },
  // "I'm here": (re)written every time this device (re)connects, and wiped by the server when it drops
  presence(db, room, key, val, lanes) {
    const info = db.ref('.info/connected');
    const cb = info.on('value', sn => {
      Net.dbOn = !!sn.val();
      if (!sn.val()) return;
      for (const k of [key, ...lanes]) room.child(k).onDisconnect().remove();
      room.child(key).set(val());
    });
    return () => { info.off('value', cb); for (const k of [key, ...lanes]) room.child(k).onDisconnect().cancel(); };
  },
  // relay only: the legs' swing and running speed get worked out on the guest's side and speeds are rounded,
  // so most numbers stay the same from one update to the next
  slim(s) {
    for (const a of s.ps) { a[2] = Math.round(a[2] * 10) / 10; a[3] = Math.round(a[3] * 10) / 10; a[4] = 0; a[5] = 0; a[16] = Math.round(a[16] * 20) / 20; }
    for (const r of s.rf) r[3] = 0;
    return s;
  },
  // snapshots on the relay only send what changed since the last one (a full one every few seconds, or when the guest asks)
  pack(s, p) {
    const d = { t: 'sd', n: s.n }, u = [];
    for (const k in s) {
      if (k === 't' || k === 'n' || k === 'ps' || k === 'rf') continue;
      if (s[k] === undefined) { if (p[k] !== undefined) u.push(k); continue; }
      if (JSON.stringify(s[k]) !== JSON.stringify(p[k])) d[k] = s[k];
    }
    if (u.length) d._u = u;
    const ps = this.rows(s.ps, p.ps), rf = this.rows(s.rf, p.rf);
    if (ps.length) d.ps = ps;
    if (rf.length) d.rf = rf;
    return d;
  },
  rows(A, B) { const out = []; A.forEach((a, i) => { const b = B[i], ch = []; a.forEach((v, j) => { if (v !== b[j]) ch.push(j, v); }); if (ch.length) out.push(i, ch); }); return out; },
  unrows(A, d) { for (let i = 0; i < d.length; i += 2) { const a = A[d[i]], ch = d[i + 1]; if (a) for (let j = 0; j < ch.length; j += 2) a[ch[j]] = ch[j + 1]; } },
  unpack(d, base) {
    if (d.t === 's') return d;
    if (!base || d.n !== base.n + 1) return null; // missed one: wait for a full one
    const s = JSON.parse(JSON.stringify(base)); s.n = d.n;
    for (const k in d) if (k !== 't' && k !== 'n' && k !== 'ps' && k !== 'rf' && k !== '_u') s[k] = d[k];
    for (const k of d._u || []) delete s[k];
    this.unrows(s.ps, d.ps || []); this.unrows(s.rf, d.rf || []);
    return s;
  }
};

const Net = {
  peer: null, conn: null, fast: null, fastOk: false, role: null, code: null, side: null, status: '', ready: false,
  seq: 0, lastSeq: -1, inSeq: 0, lastIn: -1, buf: [], off: null, jit: 0.02,
  out: { pressed: [], taps: [] }, sendT: 0, snapT: 0, last: null, rosterRef: null, bannerRef: null, pbpRef: null, routeKey: '', sounds: [],
  picks: {}, callId: 0, pendingCall: null, callMsgs: [], overMsg: null, rSent: {}, rIds: 0, rCache: {},
  relayRoom: null, rroom: null, onRelay: false, relayOffs: [], relayPrev: null, relayKf: 0, relayBase: null, kfT: 0,
  rxT: 0, inT: 0, snapRxT: 0, pingT: 0, rtt: null, held: false, heldPause: false, waitWas: null, swapping: false, gid: '', okT: 0, dbOn: true, onStatus: null, inKey: '', inSentT: 0, expT: null,

  // ---------------- connecting ----------------
  // STUN only: no free TURN server works without an account any more, so blocked networks use the relay
  ice: { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] } },
  makeCode() { let c = ''; for (let i = 0; i < 4; i++) c += NET_CHARS[Math.floor(Math.random() * NET_CHARS.length)]; return c; },
  peerId(code) { return 'bobblebowl-' + code.toUpperCase(); },
  serverErr(e) { return e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed'; },
  host(onCode, onStatus) {
    this.reset(); this.role = 'host'; this.side = 0; this.onStatus = onStatus;
    let shown = false;
    const ready = code => {
      if (shown || this.role !== 'host') return; shown = true; this.code = code; onCode(code); this.hostRelay(onStatus);
      this.expT = setTimeout(() => { if (this.role === 'host' && !G.online && this.code === code) { this.reset(); if (typeof onlineMsg === 'function') onlineMsg('Your code ran out after 30 minutes. Host again to get a new one.'); } }, CODE_LIFE);
    };
    // the direct-connect server can't be reached (blocked network) or is slow: host on the relay only
    const relayOnly = () => {
      if (shown || this.role !== 'host') return;
      Relay.load().then(db => {
        const pick = () => { const c = this.makeCode(); return db.ref('bobble/rooms/' + c + '/host').once('value').then(sn => sn.val() ? pick() : c); };
        return db.ref('bobble/rooms/' + this.code + '/host').once('value').then(sn => sn.val() ? pick() : this.code);
      }).then(ready).catch(() => { if (!shown) onStatus("Can't reach the online server. Check your internet."); });
    };
    const tryCode = () => {
      this.code = this.makeCode();
      const pe = this.peer = new Peer(this.peerId(this.code), this.ice);
      pe.on('open', () => { if (pe === this.peer) ready(this.code); });
      pe.on('error', e => {
        if (pe !== this.peer) return;
        if (e.type === 'unavailable-id' && !shown) { pe._bye = true; pe.destroy(); tryCode(); }
        else if (!shown && this.serverErr(e)) relayOnly();
        else if (!this.relayRoom && !G.online) onStatus(this.errText(e));
      });
      // came back from another app: get back on the direct-connect server (after a moment, in case we're still offline)
      pe.on('disconnected', () => setTimeout(() => { try { if (pe === this.peer && !pe._bye && !pe.destroyed && pe.disconnected) pe.reconnect(); } catch (e) {} }, 1500));
      pe.on('connection', c => {
        if (this.onRelay) { c.close(); return; } // already playing over the relay
        if (c.label === 'fast') { // the guest's second lane
          if (!this.conn || c.peer !== this.conn.peer) { c.close(); return; }
          this.fast = c; c.on('open', () => { if (this.fast === c) this.fastOk = true; }); c.on('data', m => { if (this.fast === c) this.recv(m, true); }); c.on('close', () => { if (this.fast === c) this.fastOk = false; });
          return;
        }
        if (G.online || (this.conn && this.conn.open)) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } // only one friend per code
        if (this.conn) { const old = this.conn; this.conn = null; try { old.close(); } catch (e) {} } // an earlier try that never opened
        this.conn = c; this.wire(c, onStatus);
      });
    };
    tryCode();
    setTimeout(relayOnly, 3000);
  },
  // host side of the relay: put the game in the database and wait for a guest to show up there
  hostRelay(onStatus) {
    const code = this.code;
    Relay.load().then(db => {
      if (this.code !== code || this.role !== 'host' || this.relayRoom) return;
      const room = this.relayRoom = this.rroom = db.ref('bobble/rooms/' + code);
      this.relayOffs.push(Relay.presence(db, room, 'host', () => ({ t: firebase.database.ServerValue.TIMESTAMP, v: NET_VERSION, busy: G.online ? 1 : 0 }), ['h2g']));
      const g = room.child('guest'), cb = g.on('value', sn => {
        if (this.relayRoom !== room || !sn.val() || this.onRelay) return;
        // a guest came in the relay way (before the game, or a direct game that dropped)
        this.dropDirect();
        this.useRelayLanes(room, 'h2g', 'g2h', onStatus);
        if (G.online) this.resync();
      });
      this.relayOffs.push(() => g.off('value', cb));
    }).catch(() => {});
  },
  useRelayLanes(room, out, inn, onStatus) {
    this.onRelay = true; this.relayPrev = null; this.relayBase = null;
    const L = Relay.lane(room, out, inn);
    this.conn = L; this.fast = L; this.fastOk = true; this.wire(L, onStatus);
  },
  // close the direct line without it counting as the friend leaving
  dropDirect() {
    const c = this.conn, f = this.fast; this.conn = null; this.fast = null; this.fastOk = false;
    for (const x of [f, c]) if (x && !x.relay) try { x.close(); } catch (e) {}
  },
  // host, after the game moved to the relay: send again what the guest may have missed
  resync() {
    this.rosterRef = null; this.relayPrev = null; this.bannerRef = undefined; this.routeKey = ''; this.rSent = {};
    const pc = this.pendingCall;
    if (pc && G.phase === 'playcall') { if (this.picks[1] == null) for (const m of this.callMsgs) this.send(m); else this.send({ t: 'call', ctx: { mode: 'wait', id: pc.id } }); }
    if (G.phase === 'over' && this.overMsg) this.send(this.overMsg);
  },
  join(code, onStatus) {
    code = code.toUpperCase();
    if ([...code].some(ch => !NET_CHARS.includes(ch))) { onStatus('Codes never use O, 0, I, 1 or L. Look at the code again.'); return; }
    this.reset(); this.role = 'guest'; this.side = 1; this.code = code; this.onStatus = onStatus;
    this.gid = Math.random().toString(36).slice(2, 10);
    const alive = () => this.role === 'guest' && this.code === code;
    let hostSeen = null, noGame = false, noDirect = false, waitT = null; // hostSeen: null = still checking, true/false = the database answered
    onStatus(`CONNECTING TO GAME ${code}...`);
    // the direct line is out (blocked, or it failed): go the relay way as soon as we know the game is there
    const directOut = () => { if (noDirect || !alive() || this.ready) return; noDirect = true; if (hostSeen) { clearTimeout(waitT); this.toRelay(); } };
    this.directOut = directOut;
    // 1) direct connection (fastest)
    try {
      const pe = this.peer = new Peer(this.ice);
      pe.on('open', () => {
        if (!alive() || this.onRelay) return;
        const c = pe.connect(this.peerId(code), { reliable: true, serialization: 'json' });
        this.conn = c; this.wire(c, onStatus);
        c.on('open', () => { // then open the fast lane (unordered, JSON)
          if (this.onRelay || c !== this.conn) return;
          const f = pe.connect(this.peerId(code), { reliable: false, serialization: 'json', label: 'fast' });
          this.fast = f; f.on('open', () => { if (this.fast === f) this.fastOk = true; }); f.on('data', m => { if (this.fast === f) this.recv(m, true); }); f.on('close', () => { if (this.fast === f) this.fastOk = false; });
        });
      });
      pe.on('error', e => {
        if (!alive() || this.onRelay) return;
        if (this.ready) return; // (losing the direct-connect server mid-game doesn't matter, the line itself is checked by tick)
        if (e.type === 'peer-unavailable' || this.serverErr(e) || e.type === 'webrtc' || e.type === 'negotiation-failed') return directOut();
        if (hostSeen === false) onStatus(this.errText(e));
      });
    } catch (e) { noDirect = true; }
    // 2) the relay: is the game in the database? If the direct line isn't up soon, switch over
    Relay.load().then(db => {
      if (!alive()) return;
      this.rdb = db; const room = this.rroom = db.ref('bobble/rooms/' + code);
      const look = () => room.child('host').once('value');
      return look().then(sn => sn.val() || noDirect ? sn : new Promise(r => setTimeout(r, 1500)).then(look)).then(sn => { // just hosted: its room may be a moment behind
        if (!alive()) return;
        const h = sn.val(); hostSeen = !!h;
        if (this.ready) return;
        if (!h) { noGame = true; onStatus('No game with that code. Check it with your friend, and make sure they are still on the HOST screen.'); return; }
        if (h.v !== NET_VERSION) { onStatus('You two are on different versions. Both of you: close the game all the way and reopen it.'); return; }
        if (h.busy) { onStatus('That game already has two players.'); return; }
        onStatus(`FOUND GAME ${code}. CONNECTING...`);
        const wait = () => {
          if (!alive() || this.ready || this.onRelay) return;
          // the direct line is just about to open: give it a little longer
          const pc = this.conn && this.conn.peerConnection, st = pc && pc.iceConnectionState;
          if ((st === 'connected' || st === 'completed') && !wait.more) { wait.more = 1; waitT = setTimeout(wait, 1500); return; }
          this.toRelay();
        };
        waitT = setTimeout(wait, noDirect ? 0 : RELAY_WAIT);
      });
    }).catch(() => { hostSeen = false; });
    setTimeout(() => { if (alive() && !this.ready && !noGame) onStatus("Couldn't reach that game. Make sure your friend is still on the HOST screen with the same code, then try again."); }, 20000);
  },
  // guest: move to the relay (before the game when the direct line can't get through, or in the middle of a game when it drops)
  toRelay() {
    const room = this.rroom, code = this.code, onStatus = this.onStatus || (() => {});
    if (this.role !== 'guest' || this.onRelay || this.swapping || !room) return;
    this.swapping = true;
    if (!this.ready) onStatus('NO DIRECT LINE BETWEEN YOUR NETWORKS. CONNECTING THROUGH THE RELAY...');
    room.child('guest').transaction(cur => cur && cur.id !== this.gid ? undefined : { t: firebase.database.ServerValue.TIMESTAMP, id: this.gid }, (err, ok) => {
      this.swapping = false;
      if (this.role !== 'guest' || this.code !== code || this.onRelay) return;
      if (err || !ok) { if (!this.ready) onStatus(err ? "Can't reach the online server. Check your internet." : 'That game already has two players.'); return; }
      const mid = this.ready && G.online;
      this.dropDirect(); this.ready = false;
      this.relayRoom = room;
      this.relayOffs.push(Relay.presence(this.rdb, room, 'guest', () => ({ t: firebase.database.ServerValue.TIMESTAMP, id: this.gid }), ['g2h']));
      this.useRelayLanes(room, 'g2h', 'h2g', mid ? () => {} : onStatus);
      this.rxT = performance.now();
    }, false);
  },
  errText(e) { return this.serverErr(e) ? "Can't reach the online server. Check your internet." : 'Connection problem (' + (e.type || 'unknown') + '). Try again.'; },
  wire(c, onStatus) {
    c.on('open', () => {
      if (c !== this.conn) return;
      this.ready = true; this.okT = this.rxT = this.inT = this.snapRxT = performance.now();
      if (this.role === 'guest') c.send({ t: 'hello', team: TEAMS[sel.idx[sel.you]].id, mode: G.mode, v: NET_VERSION, on: G.online ? 1 : 0 });
      onStatus(this.onRelay ? 'CONNECTED (RELAY)' : 'CONNECTED (DIRECT)');
    });
    c.on('data', m => { if (c === this.conn) this.recv(m); });
    c.on('close', () => { if (c === this.conn) this.linkDown(); });
    c.on('error', () => { if (c === this.conn) this.linkDown(); });
  },
  // the direct line closed or broke
  linkDown() {
    if (!this.role) return;
    if (G.online && G.teams && G.phase !== 'over') { // mid-game: keep the game, the relay brings the friend back
      this.dropDirect();
      if (this.role === 'guest') this.toRelay(); // the host waits for them (tick pauses the game, gives up after a while)
      return;
    }
    if (!G.online) { // still connecting: the guest tries the relay, the host keeps its code up for the next try
      this.dropDirect(); this.ready = false;
      if (this.role === 'guest' && this.directOut) this.directOut();
      return;
    }
    this.lost();
  },
  send(m, fast) {
    if (fast && this.fast && this.fastOk) { try { this.fast.send(m); } catch (e) {} return; }
    if (this.conn && this.ready) try { this.conn.send(m); } catch (e) {}
  },
  reset() {
    const fa = this.fast, co = this.conn, pe = this.peer, room = this.relayRoom, role = this.role;
    this.conn = null; this.fast = null; this.relayRoom = null; this.onRelay = false;
    if (this.heldPause) G.paused = false;
    if (this.expT) clearTimeout(this.expT);
    try { fa && fa.close(); } catch (e) {} try { co && co.close(); } catch (e) {} try { if (pe) { pe._bye = true; pe.destroy(); } } catch (e) {}
    for (const f of this.relayOffs.splice(0)) try { f(); } catch (e) {}
    if (room) try { if (role === 'host') room.remove(); else for (const k of ['guest', 'g2h']) room.child(k).remove(); } catch (e) {}
    Object.assign(this, { peer: null, conn: null, fast: null, fastOk: false, seq: 0, lastSeq: -1, inSeq: 0, lastIn: -1, buf: [], off: null, jit: 0.02, role: null, ready: false, last: null, rosterRef: null, bannerRef: null, pbpRef: null, routeKey: '', picks: {}, pendingCall: null, sounds: [], out: { pressed: [], taps: [] }, relayPrev: null, relayBase: null,
      rroom: null, rdb: null, startMsg: null, callMsgs: [], overMsg: null, rSent: {}, rIds: 0, rCache: {}, held: false, heldPause: false, waitWas: null, swapping: false, rtt: null, onStatus: null, directOut: null, expT: null, inKey: '' });
    G.online = false; Input.online = false; Input.use(0); Input.store[1] = null;
  },
  lost(link) {
    if (!this.role) return;
    const inGame = G.online && G.teams && G.phase !== 'over';
    this.reset();
    if (inGame) {
      G.teams = null; G.phase = 'idle';
      if (typeof onlineMsg === 'function') onlineMsg(link ? 'Lost the connection to your friend.' : 'Your opponent left the game.');
    } else if (typeof onlineMsg === 'function') onlineMsg('Connection closed.');
  },
  leave() { this.send({ t: 'bye' }); setTimeout(() => this.reset(), 150); },
  // 4x a second: pings, a direct line that went quiet moves to the relay, the host pauses while the guest is away
  tick() {
    this.badge();
    if (!this.role || !this.ready || !G.online) return;
    const now = performance.now(), quiet = now - this.rxT, playing = G.teams && G.phase !== 'over';
    if (this.role === 'guest') {
      if (now - this.pingT > 1000) { this.pingT = now; this.send({ t: 'pg', c: Math.round(now), r: this.rtt }); }
      if (!this.onRelay && playing && (quiet > LINK_DEAD || (this.last && this.last.deaf))) this.toRelay(); // the line is down, or only works one way
      const away = playing && now - this.snapRxT > HOLD_AFTER; // no game updates: the host switched apps or the line is down
      if (away) {
        if (!this.held) { this.held = true; this.waitWas = $('onWait').style.display === 'block' ? $('onWait').textContent : null; }
        onlineWait(quiet > LINK_DEAD ? 'Reconnecting to your friend...' : 'Waiting for your friend...');
      } else if (this.held) { this.held = false; if (/^(Reconnecting to your friend|Waiting for your friend)/.test($('onWait').textContent)) onlineWait(this.waitWas); }
    } else {
      const hold = playing && now - this.inT > HOLD_AFTER;
      if (hold) {
        if (!this.held) { // clear the guest's controls so nobody keeps running, and freeze the game
          this.held = true; this.waitWas = $('onWait').style.display === 'block' ? $('onWait').textContent : null;
          const R = Input.store[1]; if (R) { R.down = {}; R.stick.x = R.stick.y = R.stick.m = 0; R.pads = [null, null]; R.pointer.down = false; }
          if (!G.paused) { G.paused = true; this.heldPause = true; }
        }
        onlineWait(quiet > LINK_DEAD ? 'Your friend lost connection. Reconnecting...' : 'Waiting for your friend...');
      } else if (this.held) {
        this.held = false;
        if (this.heldPause) { G.paused = false; this.heldPause = false; }
        if (/^(Your friend lost|Waiting for your friend)/.test($('onWait').textContent)) onlineWait(this.waitWas);
      }
    }
    if (playing && quiet > GIVE_UP) this.lost(true);
  },
  // small corner tag in an online game: which way you're connected and how fast
  badge() {
    let el = $('netBadge');
    if (!el) {
      el = document.createElement('div'); el.id = 'netBadge';
      el.style.cssText = 'display:none;position:absolute;left:8px;top:6px;z-index:24;pointer-events:none;font-family:var(--hd),sans-serif;font-style:italic;font-weight:800;font-size:12px;letter-spacing:.08em;color:#f6c31c;background:#0b0f16b0;padding:1px 8px;white-space:nowrap';
      const w = $('onWait'); if (!w) return; w.parentNode.appendChild(el);
    }
    const on = G.online && this.role && G.teams && typeof menuScreens !== 'undefined' && !menuScreens.some(id => $(id) && $(id).classList.contains('show'));
    let t = '';
    if (on) {
      const now = performance.now(), bad = !this.ready || now - this.rxT > LINK_DEAD || (this.onRelay && !this.dbOn);
      const lane = this.onRelay ? 'RELAY' : 'DIRECT';
      t = bad ? 'RECONNECTING...' : now - this.okT < 4000 ? `CONNECTED (${lane})` : lane + (this.rtt != null ? ' ' + this.rtt + ' MS' : '');
      el.style.color = bad ? '#ff6b5b' : '#f6c31c';
    }
    if (el.textContent !== t) el.textContent = t;
    el.style.display = t ? 'block' : 'none';
  },
  // came back to the tab: a direct line that died while we were away goes to the relay right away
  onVisible() {
    if (document.visibilityState !== 'visible' || !this.role || !G.online) return;
    const now = performance.now();
    this.rxT = Math.max(this.rxT, now - 1000); this.inT = Math.max(this.inT, now - 1000); // give their updates a moment to arrive
    if (this.role !== 'guest' || this.onRelay) return;
    const pc = this.conn && this.conn.peerConnection, st = pc && pc.iceConnectionState;
    if (!this.conn || !this.conn.open || !pc || st === 'failed' || st === 'closed' || st === 'disconnected') this.toRelay();
  },

  // ---------------- messages ----------------
  recv(m, fast) {
    if (!m || !m.t) return;
    const now = performance.now(); this.rxT = now;
    if (m.t === 'pg') { this.send({ t: 'po', c: m.c }); if (m.r != null) this.rtt = m.r; return; }
    if (m.t === 'po') { this.rtt = Math.round(now - m.c); return; }
    if (this.role === 'host') {
      if (m.t === 'in' || m.t === 'in1' || m.t === 'pick' || m.t === 'tool') this.inT = now;
      // (a hello in the middle of a game = the guest moved lanes; resend the start if it never got there)
      if (m.t === 'hello') { if (G.online) { if (!m.on && this.startMsg) { this.send(this.startMsg); this.resync(); } return; } if (m.v !== NET_VERSION) { this.send({ t: 'old' }); return setTimeout(() => this.reset(), 300); } return this.startHost(m); }
      if (m.t === 'in') return this.mergeInput(m);
      if (m.t === 'in1') return this.mergeOneShots(m);
      if (m.t === 'pick') return this.pick(1, m.mode, m.key, m.id);
      if (m.t === 'tool') { if (m.k === 'timeout') callTimeout(1); else if (m.k === 'spike' && G.poss === 1) spikeBall(); return; }
      if (m.t === 'kf') { this.relayPrev = null; return; } // guest missed a relay update: next one is a full one
      if (m.t === 'rr') { this.rSent = {}; this.rosterRef = null; return; } // guest is missing a player: send the whole roster
    } else {
      if (m.t === 'start') return this.startGuest(m);
      if (m.t === 'roster') return this.applyRoster(m);
      if (m.t === 's' || m.t === 'sd') {
        this.snapRxT = now;
        if (!this.onRelay) return this.applySnap(m);
        const s = Relay.unpack(m, this.relayBase);
        if (!s) { if (now - this.kfT > 500) { this.kfT = now; this.send({ t: 'kf' }); } return; }
        this.relayBase = s; return this.applySnap(JSON.parse(JSON.stringify(s)));
      }
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
    const bc = typeof quickBcast === 'function' ? quickBcast() : null;
    const opts = { qtr: +$('optQtr').value, diff: 1, humanSide: 0, versus: true, weather: typeof bcWeather === 'function' ? bcWeather(bc, pickWeather($('optWeather').value), $('optWeather').value) : pickWeather($('optWeather').value), night: $('optNight').value === '1', bcast: bc };
    newGame(mine, theirs, opts);
    if (this.relayRoom) this.relayRoom.child('host/busy').set(1); // nobody else can join now
    this.send(this.startMsg = { t: 'start', v: NET_VERSION, teams: G.teams, opts: { qtr: opts.qtr, weather: G.storm ? 'storm' : G.fog ? 'fog' : G.weather, night: G.night, bcast: G.bcast }, modes: G.netModes });
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
    if (this.snapT <= 0) { this.snapT = Math.max(0, this.snapT + (this.held ? 0.25 : this.onRelay ? 1 / RELAY_HZ : 1 / NET_HZ)); this.sendSnap(); } // carry the leftover so 60fps really gives 50 a second
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
      t: 's', n: ++this.seq, tm: r2(performance.now() / 10) / 100, ph: G.phase, sc: G.score, q: G.quarter, cl: r2(G.clock), dn: G.down, los: G.los, fdx: G.firstDownX, gtg: G.goalToGo, by: G.ballY, poss: G.poss,
      to: G.timeouts, pr: G.pendingRunoff > 0 ? 1 : 0, pc: r2(G.playClock), sp: G.special, pat: G.patSide, two: G.twoPt, bs: G.bstate, kp: G.koPending, ks: G.kickoffSide, st: G.showTarget,
      ok: G.play && G.play.off && G.play.off.key, dk: G.play && G.play.def && G.play.def.key, fm: G.play && G.play.form && G.play.form.name, pt: G.play && r2(G.play.t),
      ps: P.map(p => PSTAT.map(k => typeof p[k] === 'number' ? Math.round(p[k] * 100) / 100 : 0).concat([p.face.dir, p.engaged ? 1 : 0, p.isHuman ? 1 : 0, p.mouth || '',
        Math.round(p.head.ox), Math.round(p.head.oy), p.sprinting ? 1 : 0, p.xf && p.xf.on ? 1 : 0, p.celly ? p.celly.type : 0, p.celly ? Math.round(p.celly.t * 100) / 100 : 0,
        p.throwKey || 0, p.openness == null ? -1 : Math.round(p.openness * 10) / 10,
        p.kneel > 0 ? 1 : 0, p.kickT != null ? r2(p.kickT) : -1, p.kpose === 'hold' ? 1 : p.kpose === 'pc' ? 2 : 0, p.fair ? 1 : 0])), // kick poses (at the end: older guests just ignore them)
      b: b ? [r2(b.x), r2(b.y), r2(b.z), r2(b.spin || 0), idx(b.holder), b.flight ? [r2(b.flight.sx), r2(b.flight.sy), r2(b.flight.tx), r2(b.flight.ty), r2(b.flight.t), r2(b.flight.T), r2(b.flight.peak), b.flight.pitch ? 1 : 0, b.flight.kick || 0, b.flight.duck ? 1 : 0, idx(b.flight.intended), b.flight.style || ''] : null, b.loose ? 1 : 0, r2(b.hold || 0), b.snap || 0] : null,
      rf: (G.refs || []).map(r => [r2(r.x), r2(r.y), r.face, r2(r.anim || 0), r.moving, r2(r.throwT || 0)]),
      hp: [idx(G.hp && G.hp[0]), idx(G.hp && G.hp[1])], hd: [idx(G.hd && G.hd[0]), idx(G.hd && G.hd[1])],
      km: G.km && (G.phase === 'kickmeter' || G.phase === 'kick') ? { kind: G.km.kind, stage: G.km.stage, power: G.km.power, aim: G.km.aim, side: G.km.side, need: G.km.need, tol: G.km.tol, yds: G.km.yds, kk: G.km.kk, cpuT: G.km.cpuT != null ? 1 : null, wait: G.km.wait, needle: G.km.needle, wind: G.wind } : null,
      aim: G.aim, mv: G.meterV ? G.meterV.map(r2) : null, cv: G.chold ? r2(catchFill()) : null, cg: idx(G.cellyGuy), hy: Math.round(G.crowdHype * 100) / 100, sh: Math.round(cam.shake), sm: G.slowmo > 0 ? 1 : 0, flg: (G.flags || []).length,
      mo: Math.round(G.mo || 0), cw: G.rvWin ? [G.rvWin.side, r2(G.rvWin.t)] : 0, chl: G.chalLeft, rvs: G.phase === 'review' ? G.rvShow : 0, // momentum, challenge window, review overlay
      deaf: this.held && performance.now() - this.rxT > LINK_DEAD ? 1 : undefined // host hears nothing from the guest at all
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
    if (this.onRelay) {
      Relay.slim(s);
      const p = this.relayPrev, full = !p || s.n - this.relayKf >= RELAY_HZ * 5 || p.ps.length !== s.ps.length || p.rf.length !== s.rf.length;
      if (full) this.relayKf = s.n;
      this.send(full ? s : Relay.pack(s, p), true);
      this.relayPrev = JSON.parse(JSON.stringify(s)); // frozen copy: score etc. are reused arrays
    } else this.send(s, true);
  },
  // each player's fixed stuff (name, number, face...) only goes out the first time; after that just an id + this play's job
  sendRoster() {
    const P = G.players || [];
    this.send({ t: 'roster', O: (G.O || []).map(p => P.indexOf(p)), D: (G.D || []).map(p => P.indexOf(p)),
      p: P.map(p => {
        const fix = { side: p.side, pos: p.pos, name: p.name, num: p.num, ovr: p.ovr, spdR: p.spdR, face: { ...p.face, dir: 0 }, headScale: p.headScale }, k = JSON.stringify(fix);
        const q = { off: p.off, slot: p.slot, role: p.role, assign: p.assign, xf: p.xf ? { kind: p.xf.kind, on: p.xf.on } : undefined, cap: p.cap || undefined };
        if (this.rSent[k] != null) q.i = this.rSent[k]; else { q.i = this.rSent[k] = ++this.rIds; q.f = fix; }
        return q;
      }) });
  },
  // play calls: the offense and defense pick at the same time, each on their own screen
  onPlayCall(c) {
    this.picks = {}; this.callId++;
    const id = this.callId, side = c.side != null ? c.side : G.poss;
    const reqs = [{ ...c, side }];
    if (c.mode === 'off') reqs.push({ ...withSide(1 - side, playCallCtx), side: 1 - side });
    this.pendingCall = { id, reqs };
    this.callMsgs = [];
    for (const r of reqs) {
      if (r.side === 0) onPlayCall({ ...r, id });
      else this.callMsgs.push({ t: 'call', ctx: { ...r, id }, dt: G.downText() });
    }
    if (reqs.every(r => r.side === 0)) this.callMsgs.push({ t: 'call', ctx: { mode: 'wait', id } });
    for (const m of this.callMsgs) this.send(m);
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
  over(s) { this.overMsg = { t: 'over', s: { score: s.score, teams: s.teams.map(t => t.id), tstats: s.tstats, leaders: s.leaders } }; this.send(this.overMsg); },

  // ---------------- guest ----------------
  startGuest(m) {
    if (m.v !== NET_VERSION) { if (typeof onlineMsg === 'function') onlineMsg('You two are on different versions. Both of you: close the game all the way and reopen it.'); return this.reset(); }
    Input.online = true;
    G.online = true; G.netModes = m.modes; G.demo = false; G.season = false; G.challenge = null; G.mini = null; show(null);
    initGame(m.teams[0], m.teams[1], { qtr: m.opts.qtr, diff: 1, humanSide: 1, versus: true, weather: m.opts.weather, night: m.opts.night, bcast: m.opts.bcast });
    G.phase = 'idle'; G.players = []; G.ball = null;
  },
  applyRoster(m) {
    for (const q of m.p) if (q.f) this.rCache[q.i] = q.f;
    if (m.p.some(q => !this.rCache[q.i])) { this.send({ t: 'rr' }); return; } // missed a player's first showing: ask for everyone again
    G.players = m.p.map(q => {
      q = { ...this.rCache[q.i], ...q }; q.face = { ...q.face, dir: dirOf(q.side) };
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
    const P = G.players, relay = this.onRelay;
    Object.assign(G, { phase: s.ph === 'replay' ? 'dead' : s.ph, score: s.sc, quarter: s.q, clock: s.cl, down: s.dn, los: s.los, firstDownX: s.fdx, goalToGo: s.gtg, ballY: s.by, poss: s.poss,
      timeouts: s.to, pendingRunoff: s.pr, playClock: s.pc, special: s.sp, patSide: s.pat, twoPt: s.two, bstate: s.bs, koPending: s.kp, kickoffSide: s.ks, showTarget: s.st, aim: s.aim,
      crowdHype: s.hy, km: s.km, meterV: s.mv || null, catchV: s.cv != null ? s.cv : null, flags: new Array(s.flg).fill({}),
      mo: s.mo || 0, rvWin: s.cw ? { side: s.cw[0], t: s.cw[1] } : null, chalLeft: s.chl || [2, 2], rvShow: s.rvs || null });
    if (s.sh > cam.shake) cam.shake = s.sh;
    if (s.sm) G.slowmo = 0.05;
    const off = OFF_PLAYS.concat(FAKE_PLAYS, typeof SPECIAL_PLAYS !== 'undefined' ? SPECIAL_PLAYS : []).find(p => p.key === s.ok) || (s.ok ? { key: s.ok, name: s.ok, type: s.ok === 'ret' ? 'ret' : 'pass' } : null);
    const def = DEF_PLAYS.find(p => p.key === s.dk) || (s.dk ? { key: s.dk, name: s.dk, a: [] } : null);
    G.play = off ? { off, def, t: s.pt || 0, form: s.fm ? { name: s.fm } : null } : null;
    s.ps.forEach((a, i) => {
      const p = P[i]; if (!p) return;
      if (first) { p.x = a[0]; p.y = a[1]; }
      for (let k = 2; k < PSTAT.length; k++) if (!relay || (k !== 4 && k !== 5)) p[PSTAT[k]] = a[k];
      const n = PSTAT.length;
      p.face.dir = a[n]; p.engaged = a[n + 1] ? true : null; p.isHuman = !!a[n + 2]; p.mouth = a[n + 3]; p.head.ox = a[n + 4]; p.head.oy = a[n + 5];
      p.sprinting = !!a[n + 6]; if (p.xf) p.xf.on = !!a[n + 7]; p.celly = a[n + 8] ? { type: a[n + 8], t: a[n + 9] } : null;
      p.throwKey = a[n + 10]; p.openness = a[n + 11] < 0 ? null : a[n + 11];
      p.kneel = a[n + 12] || 0; p.kickT = a[n + 13] >= 0 ? a[n + 13] : null; p.kpose = [null, 'hold', 'pc'][a[n + 14]] || null; p.fair = a[n + 15] || 0;
      p.ctl = p.side === G.human ? 0 : 1; // you're always the yellow ring on your own screen
    });
    if (s.b) {
      const b = G.ball || (G.ball = {});
      if (b.x == null) { b.x = s.b[0]; b.y = s.b[1]; b.z = s.b[2]; }
      b.spin = s.b[3]; b.holder = s.b[4] >= 0 ? P[s.b[4]] : null; b.loose = s.b[6] ? {} : null; b.hold = s.b[7] || 0; b.snap = s.b[8] || 0;
      const f = s.b[5];
      b.flight = f ? { sx: f[0], sy: f[1], tx: f[2], ty: f[3], t: f[4], T: f[5], peak: f[6], pitch: !!f[7], kick: f[8] || null, duck: !!f[9], intended: P[f[10]] || null, style: f[11] } : null;
    } else G.ball = null;
    const oldRefs = G.refs || [];
    G.refs = s.rf.map((r, i) => ({ x: oldRefs[i] ? oldRefs[i].x : r[0], y: oldRefs[i] ? oldRefs[i].y : r[1], face: r[2], anim: relay && oldRefs[i] ? oldRefs[i].anim : r[3], moving: r[4], throwT: r[5] }));
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
    if (this.onRelay) { // the relay doesn't send leg swing / running speed: work them out here like the engine does
      for (const p of G.players) { p.speedNow = Math.hypot(p.vx, p.vy); p.anim += Math.min(p.speedNow, 12) * dt * 1.45; }
      for (const r of G.refs || []) r.anim += (r.moving || 0) * dt * 1.5;
    }
    updateFx(dt); updateCamera(dt); updateHint();
    this.guestSend(dt);
  },
  // draw the game a little in the past and slide between the two updates around that moment
  playback() {
    const B = this.buf; if (!B.length || this.off == null) return;
    const delay = clamp((this.onRelay ? 0.06 : 0.03) + this.jit * 1.4, this.onRelay ? 0.07 : 0.035, 0.3);
    const rt = performance.now() / 1000 + this.off - delay;
    let a = B[0], c = null;
    for (let i = 0; i < B.length - 1; i++) if (B[i].tm <= rt && B[i + 1].tm >= rt) { a = B[i]; c = B[i + 1]; break; }
    if (!c) { a = B[B.length - 1]; if (rt < B[0].tm) a = B[0]; }
    const u = c ? (rt - a.tm) / Math.max(1e-4, c.tm - a.tm) : 0;
    const ex = c ? 0 : clamp(rt - a.tm, 0, 0.1); // ran out of updates: keep them moving a tiny bit
    const P = G.players, now = performance.now() / 1000 + this.off;
    const me = G.phase === 'live' && G.humanPlayer && !G.humanPlayer.celly ? G.humanPlayer : null; // the guy you're steering
    for (let i = 0; i < P.length; i++) {
      const p = P[i], pa = a.p[i]; if (!pa) continue;
      const pc = c && c.p[i];
      if (p === me) { // newest spot + his speed * how old it is, eased so it never snaps
        const L = B[B.length - 1].p[i]; if (!L) continue;
        const ahead = clamp(now - B[B.length - 1].tm, 0, this.onRelay ? 0.2 : 0.12), tx = L[0] + L[2] * ahead, ty = L[1] + L[3] * ahead;
        if (Math.hypot(tx - p.x, ty - p.y) > 5) { p.x = tx; p.y = ty; } else { p.x = lerp(p.x, tx, 0.45); p.y = lerp(p.y, ty, 0.45); }
        continue;
      }
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
    const m = { held: NET_KEYS.filter(c => Input.down[c]), st: [r2(Input.stick.x), r2(Input.stick.y), r2(Input.stick.m)], ax: Input.pads[0] ? [r2(ax.x), r2(ax.y), r2(ax.m)] : null, p: ptr };
    if (this.onRelay) { // relay: only when something changed (and twice a second so the host knows we're here)
      const k = JSON.stringify(m), now = performance.now();
      if (k === this.inKey && now - this.inSentT < 500) return;
      this.inKey = k; this.inSentT = now;
    }
    this.sendT = this.onRelay ? 1 / RELAY_HZ : 0; // direct: your controls go out every frame
    m.t = 'in'; m.n = ++this.inSeq;
    this.send(m, true);
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

setInterval(() => Net.tick(), 250);
document.addEventListener('visibilitychange', () => Net.onVisible());
