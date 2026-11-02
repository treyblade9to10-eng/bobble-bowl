// ---- ONLINE SEASON: you and a friend each run a team in one league, each on your own phone or computer ----
// The league lives in the same Firebase database as the online relay (bobble/leagues/CODE). Only game stuff goes in:
// two nicknames, the two teams, the schedule, scores and box score lines. Nothing personal.
//   cfg   games / quarter length / CPU level / seed      pl    A (made the league) + B (joined): nickname + team
//   sched [[home, away], ...] per week                    st    phase, week, CPU-vs-CPU scores, playoff bracket, champ
//   res   scores (+ box score) of the games the two of you play, by slot (w0.. = weeks, p0.. = playoff rounds)
//   live  "I'm hosting our matchup, here's the code"      vote  SIM IT taps        pres  who has the app open
// Your games vs the CPU are played on your own device and uploaded. The other games are simmed by whichever device
// moves the league on, inside one transaction on st (seeded, so a second try comes out the same).
// The week moves on once both of your games are in. The head-to-head game is a normal online VERSUS game (net.js);
// if it can't happen, both tap SIM IT (or the host sims it after 2 days).
// Finished games wait in a local queue until they're uploaded, so a game played with no signal still counts.
// Leagues nobody has touched for 60 days get deleted (lgidx = code -> last touched).
const OSN_IDLE = 60 * 864e5, OSN_SIM_WAIT = 2 * 864e5, OSN_LIVE = 25 * 60000;
const OSN = {
  KEY: 'bobbleOSeason', QKEY: 'bobbleOSeasonQ', NKEY: 'bobbleOSName',
  me: null, L: null, ref: null, db: null, offs: [], conn: false, view: 'setup', tab: 'stand', conf: null, wkView: null,
  msg: '', match: null, next: null, fl: {}, busy: false, swept: false, paintT: null, cfg: { games: 8, qtr: 120, diff: 1 },

  // ---------- small helpers ----------
  ids() { return CT.NFL.map(t => t.id); },
  T(id) { return CT.NFL.find(t => t.id === id); },
  ovr(id) { const t = this.T(id), all = t.off.concat(t.def); return all.reduce((a, p) => a + p[3], 0) / all.length; },
  rng(k) { return seeded(this.L.cfg.seed + ':' + k); },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); },
  clean(n) { return String(n || '').replace(/[^A-Za-z0-9 .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12); },
  nick(w) { const p = this.L && this.L.pl && this.L.pl[w]; return p ? this.esc(p.n).toUpperCase() : w === 'A' ? 'HOST' : 'FRIEND'; },
  fr() { return this.me.who === 'A' ? 'B' : 'A'; },
  myTm() { const p = this.L.pl[this.me.who]; return p && p.tm; },
  frTm() { const p = this.L.pl[this.fr()]; return p && p.tm; },
  owner(id) { const P = this.L.pl; return P.A && P.A.tm === id ? 'A' : P.B && P.B.tm === id ? 'B' : null; },
  loadMe() { try { this.me = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { this.me = null; } return this.me; },
  saveMe() { try { if (this.me) localStorage.setItem(this.KEY, JSON.stringify(this.me)); else localStorage.removeItem(this.KEY); } catch (e) {} },
  q() { try { return JSON.parse(localStorage.getItem(this.QKEY) || '[]'); } catch (e) { return []; } },
  saveQ(Q) { try { localStorage.setItem(this.QKEY, JSON.stringify(Q)); } catch (e) {} },
  makeCode() { let c = ''; for (let i = 0; i < 5; i++) c += NET_CHARS[Math.floor(Math.random() * NET_CHARS.length)]; return c; },
  touch() { if (!this.ref || !this.L) return; const now = Date.now(); this.ref.child('touch').set(now).catch(() => {}); this.db.ref('bobble/lgidx/' + this.me.code).set(now).catch(() => {}); },

  // ---------- schedule + sims (all seeded: same on both devices) ----------
  // one head-to-head game (two in 12+ game seasons), you never play the same CPU team twice, everyone plays every week
  makeSched(A, B, games, rng) {
    const ids = this.ids(), others = ids.filter(i => i !== A && i !== B);
    const sh = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const hw = games >= 12 ? [Math.floor(games / 3), games - 1] : [Math.floor(games / 2)];
    const pA = [], pB = [];
    const next = (pool, not) => { let k = pool.findIndex(x => !not.includes(x)); if (k < 0) { pool.push(...sh(others.slice())); k = pool.findIndex(x => !not.includes(x)); } return pool.splice(k, 1)[0]; };
    return Array.from({ length: games }, (_, w) => {
      const out = [];
      if (hw.includes(w)) out.push(hw.indexOf(w) % 2 ? [B, A] : [A, B]);
      else { const oa = next(pA, []), ob = next(pB, [oa]); out.push(w % 2 ? [oa, A] : [A, oa], w % 2 ? [B, ob] : [ob, B]); }
      const used = new Set([].concat(...out)), rest = sh(ids.filter(i => !used.has(i)));
      for (let i = 0; i + 1 < rest.length; i += 2) out.push(rng() < 0.5 ? [rest[i], rest[i + 1]] : [rest[i + 1], rest[i]]);
      return out;
    });
  },
  // same odds + scores as Season.simScore (never a tie)
  sim(h, a, key) {
    const r = this.rng(key), edge = (this.ovr(h) - this.ovr(a) + 1.5) / 4, hw = r() < 1 / (1 + Math.exp(-edge));
    const S = [3, 6, 7, 10, 13, 14, 16, 17, 20, 21, 23, 24, 27, 28, 30, 31, 34, 35, 38, 41, 42, 45];
    const w = S[4 + Math.floor(r() * 14)], l = Math.max(0, w - [1, 2, 3, 4, 6, 7, 7, 10, 11, 14, 17, 21][Math.floor(r() * 12)]);
    return hw ? [w, l] : [l, w];
  },
  // a believable box score for a game nobody played (like Season.simStats, seeded)
  simStats(S, id, pts, oppPts, r) {
    const R = (a, b) => a + r() * (b - a), t = this.T(id), [qb, rb, ...rest] = t.off, recs = rest.filter(p => p[0] !== 'OL');
    const L = p => { const k = id + ':' + p[1]; return S[k] || (S[k] = { t: id, name: p[1], pos: p[0], pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0 }); };
    const tds = Math.round(pts / 7), pTD = Math.round(tds * R(0.45, 0.75)), rTD = Math.max(0, tds - pTD);
    const passY = Math.max(60, Math.round(150 + pts * 4 + R(-50, 60) + (qb[3] - 80) * 3)), rushY = Math.max(10, Math.round(55 + R(-20, 70) + (rb[3] - 80) * 2));
    const lq = L(qb); lq.pass += passY; lq.td += pTD;
    const lr = L(rb); lr.rush += rushY; lr.td += rTD; lr.rec += Math.round(passY * R(0.05, 0.15));
    const w = recs.map(p => Math.pow(p[3], 3) * R(0.6, 1.4)), sw = w.reduce((a, b) => a + b, 0);
    recs.forEach((p, i) => { L(p).rec += Math.round(passY * 0.85 * w[i] / sw); });
    for (let i = 0; i < pTD; i++) { let x = R(0, sw), j = 0; while (x > w[j] && j < w.length - 1) { x -= w[j]; j++; } L(recs[j]).td++; }
    const D = t.def, tk = D.map((p, i) => (i >= 3 && i <= 4 ? 2.2 : i === 7 ? 1.6 : 1) * R(0.5, 1.5)), stk = tk.reduce((a, b) => a + b, 0);
    D.forEach((p, i) => { L(p).tkl += Math.round(24 * tk[i] / stk); });
    const sacks = Math.max(0, Math.round(R(0, 3.5) + (D[0][3] + D[1][3] + D[2][3]) / 120 - 2)), ints = r() < (oppPts < 14 ? 0.6 : 0.3) ? 1 : 0;
    for (let i = 0; i < sacks; i++) L(D[Math.floor(r() * 5)]).sack++;
    for (let i = 0; i < ints; i++) L(D[3 + Math.floor(r() * (D.length - 3))]).int++;
  },

  // ---------- reading the league ----------
  slotOf(st) { return st.ph === 'reg' ? 'w' + st.wk : st.ph === 'po' && st.po ? 'p' + st.po.r : null; },
  gamesOf(st, slot) { if (slot[0] === 'w') return (this.L.sched || [])[+slot.slice(1)] || []; const R = st.po && st.po.rounds && st.po.rounds[+slot.slice(1)]; return (R && R.g) || []; },
  res(slot, i) { const r = this.L.res && this.L.res[slot]; return (r && r['g' + i]) || null; },
  scoreOf(st, slot, i) { const r = this.res(slot, i); if (r) return r.s; const c = st.cpu && st.cpu[slot]; return (c && c['g' + i]) || null; },
  // every slot the league has reached: [slot, games]
  slots(st) {
    const out = [], wk = st.ph === 'reg' ? st.wk : (this.L.sched || []).length;
    for (let w = 0; w <= Math.min(wk, (this.L.sched || []).length - 1); w++) out.push(['w' + w, this.gamesOf(st, 'w' + w)]);
    if (st.po) (st.po.rounds || []).forEach((R, r) => out.push(['p' + r, (R && R.g) || []]));
    return out;
  },
  recs(st) {
    const R = {}; for (const id of this.ids()) R[id] = { w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    for (const [slot, G] of this.slots(st)) if (slot[0] === 'w') G.forEach((g, i) => {
      const s = this.scoreOf(st, slot, i), h = R[g[0]], a = R[g[1]]; if (!s || !h || !a) return;
      h.pf += s[0]; h.pa += s[1]; a.pf += s[1]; a.pa += s[0];
      if (s[0] > s[1]) { h.w++; a.l++; } else if (s[1] > s[0]) { a.w++; h.l++; } else { h.t++; a.t++; }
    });
    return R;
  },
  standings(R, conf) {
    const pct = id => { const r = R[id], g = r.w + r.l + r.t; return g ? (r.w + r.t / 2) / g : 0; };
    return this.ids().filter(id => this.T(id).conf === conf).sort((a, b) => pct(b) - pct(a) || (R[b].pf - R[b].pa) - (R[a].pf - R[a].pa) || R[b].pf - R[a].pf);
  },
  recStr(R, id) { const r = R[id]; return `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`; },
  ready(st, slot) { return this.gamesOf(st, slot).every((g, i) => !(this.owner(g[0]) || this.owner(g[1])) || this.res(slot, i)); },
  // your game this slot: { i, h, a, h2h, po } or null (bye / out)
  myGame(st) {
    st = st || this.L.st; const slot = this.slotOf(st); if (!slot) return null;
    const me = this.myTm(), i = this.gamesOf(st, slot).findIndex(g => g[0] === me || g[1] === me); if (i < 0) return null;
    const g = this.gamesOf(st, slot)[i];
    return { slot, i, h: g[0], a: g[1], h2h: !!(this.owner(g[0]) && this.owner(g[1])), po: slot[0] === 'p', opp: g[0] === me ? g[1] : g[0], home: g[0] === me };
  },
  frGame(st) { st = st || this.L.st; const slot = this.slotOf(st); if (!slot) return null; const f = this.frTm(), i = this.gamesOf(st, slot).findIndex(g => g[0] === f || g[1] === f); return i < 0 ? null : { slot, i, g: this.gamesOf(st, slot)[i] }; },
  roundName(r) { return ['Wild Card', 'Divisional Round', 'Conference Championship', 'Bobble Bowl'][r] || 'Bobble Bowl'; },

  // ---------- moving the league on (runs inside the st transaction) ----------
  step(st, slot) {
    const G = this.gamesOf(st, slot), cpu = {};
    G.forEach((g, i) => { if (!this.res(slot, i)) cpu['g' + i] = this.sim(g[0], g[1], slot + ':' + i); });
    st.cpu = st.cpu || {}; st.cpu[slot] = cpu; st.t = Date.now();
    if (st.ph === 'reg') { st.wk++; if (st.wk >= this.L.cfg.games) this.startPO(st); }
    else this.poRound(st);
    // neither of you is still playing: sim the rest of the playoffs right now
    let n = 0;
    while (st.ph === 'po' && n++ < 6 && !this.gamesOf(st, this.slotOf(st)).some(g => this.owner(g[0]) || this.owner(g[1]))) {
      const s2 = this.slotOf(st), c2 = {}; this.gamesOf(st, s2).forEach((g, i) => { c2['g' + i] = this.sim(g[0], g[1], s2 + ':' + i); });
      st.cpu[s2] = c2; this.poRound(st);
    }
    return st;
  },
  // 7 per conference: 4 division winners + 3 wild cards, the 1 seed gets a bye (same as Season.startPlayoffs)
  startPO(st) {
    const R = this.recs(st), seeds = {};
    for (const c of ['AFC', 'NFC']) {
      const s = this.standings(R, c), win = ['East', 'North', 'South', 'West'].map(v => s.find(id => this.T(id).div === v)).filter(Boolean);
      win.sort((a, b) => s.indexOf(a) - s.indexOf(b));
      seeds[c] = win.concat(s.filter(id => !win.includes(id)).slice(0, 7 - win.length));
    }
    st.ph = 'po'; st.po = { seeds, alive: { AFC: seeds.AFC.slice(), NFC: seeds.NFC.slice() }, r: 0, rounds: [] };
    this.mkRound(st);
  },
  mkRound(st) {
    const P = st.po, r = P.r, bySeed = c => (P.alive[c] || []).slice().sort((x, y) => P.seeds[c].indexOf(x) - P.seeds[c].indexOf(y));
    const R = { g: [] };
    if (r === 3) { const a = P.alive.AFC[0], n = P.alive.NFC[0]; R.g.push(this.rng('final')() < 0.5 ? [a, n] : [n, a]); }
    else for (const c of ['AFC', 'NFC']) {
      const s = bySeed(c);
      if (r === 0) { R.bye = R.bye || {}; R.bye[c] = s[0]; R.g.push([s[1], s[6]], [s[2], s[5]], [s[3], s[4]]); }
      else for (let k = 0; k < s.length / 2; k++) R.g.push([s[k], s[s.length - 1 - k]]);
    }
    P.rounds = P.rounds || []; P.rounds[r] = R;
  },
  poRound(st) {
    const P = st.po, r = P.r, slot = 'p' + r, R = P.rounds[r], win = [];
    R.g.forEach((g, i) => { const s = this.scoreOf(st, slot, i) || [1, 0]; win.push(s[0] >= s[1] ? g[0] : g[1]); });
    if (r === 3) { st.champ = win[0]; st.ph = 'done'; return; }
    for (const c of ['AFC', 'NFC']) P.alive[c] = win.filter(id => this.T(id).conf === c).concat(r === 0 && R.bye ? [R.bye[c]] : []);
    P.r++; this.mkRound(st);
  },
  advance() {
    const L = this.L; if (!L || !L.st || this.busy || !this.conn) return;
    const slot = this.slotOf(L.st); if (!slot || !this.ready(L.st, slot)) return;
    this.busy = true;
    this.ref.child('st').transaction(cur => {
      if (!cur || this.slotOf(cur) !== slot) return; // already moved on (the other device got there first)
      return this.step(JSON.parse(JSON.stringify(cur)), slot);
    }).then(r => { if (r && r.committed) this.touch(); }, () => {}).then(() => { this.busy = false; });
  },

  // ---------- results: queued locally, uploaded when we can ----------
  queue(slot, i, v) { const Q = this.q(); Q.push({ code: this.me.code, slot, gk: 'g' + i, v }); this.saveQ(Q); this.flush(); },
  flush() {
    if (!this.ref || !this.L || !this.me) return;
    let Q = this.q(); const n = Q.length; Q = Q.filter(x => x.code === this.me.code); if (Q.length !== n) this.saveQ(Q); // old leagues
    for (const it of Q) {
      const k = it.slot + '/' + it.gk; if (this.fl[k]) continue; this.fl[k] = 1;
      // first score in wins; a box score can still replace a score-only result (the guest's copy of an online game)
      this.ref.child('res/' + k).transaction(cur => cur && (cur.ps || !it.v.ps) ? undefined : it.v).then(() => {
        this.saveQ(this.q().filter(x => !(x.code === it.code && x.slot === it.slot && x.gk === it.gk))); this.touch();
      }, () => {}).then(() => { delete this.fl[k]; this.paint(); });
    }
  },
  pending(slot, i) { return this.q().some(x => this.me && x.code === this.me.code && x.slot === slot && x.gk === 'g' + i); },

  // ---------- connecting to the league ----------
  listen() {
    const code = this.me.code;
    if (this.ref && this.ref.key === code) return;
    this.unlisten(); this.L = null; this.loaded = false;
    Relay.load().then(db => {
      if (!this.me || this.me.code !== code) return;
      this.db = db; const ref = this.ref = db.ref('bobble/leagues/' + code);
      const cb = ref.on('value', sn => this.got(sn.val()), () => { this.msg = "Can't reach the league right now."; this.paint(); });
      const info = db.ref('.info/connected'), pres = ref.child('pres/' + this.me.who);
      const ic = info.on('value', sn => {
        this.conn = !!sn.val();
        if (this.conn && this.L) { pres.onDisconnect().remove(); pres.set(Date.now()).catch(() => {}); this.flush(); this.sweep(); }
        this.paint();
      });
      this.offs.push(() => ref.off('value', cb), () => { info.off('value', ic); pres.onDisconnect().cancel(); if (this.L) pres.remove().catch(() => {}); });
    }).catch(() => { this.msg = "Can't reach the online server. Check your internet."; this.paint(); });
  },
  unlisten() { for (const f of this.offs.splice(0)) try { f(); } catch (e) {} this.ref = null; this.conn = false; },
  got(v) {
    const first = !this.loaded; this.loaded = true;
    if (!v || !v.cfg || !v.pl || !v.pl[this.me.who]) { // deleted (by the host, or nobody played for 60 days)
      if (this.me) { const c = this.me.code; this.unlisten(); this.me = null; this.saveMe(); this.L = null; this.view = 'setup';
        this.msg = `League ${c} is gone. The host deleted it, or nobody played for 60 days.`; this.paint(); }
      return;
    }
    v.res = v.res || {}; v.st = v.st || { ph: 'lobby', wk: 0 }; v.st.cpu = v.st.cpu || {}; v.vote = v.vote || {}; v.pres = v.pres || {};
    if (v.st.po) { const P = v.st.po; P.rounds = P.rounds || []; P.alive = P.alive || {}; P.alive.AFC = P.alive.AFC || []; P.alive.NFC = P.alive.NFC || []; }
    this.L = v;
    if (first && this.conn) { const pres = this.ref.child('pres/' + this.me.who); pres.onDisconnect().remove(); pres.set(Date.now()).catch(() => {}); this.flush(); this.sweep(); }
    const view = v.st.ph === 'lobby' ? 'lobby' : 'hub'; if (view !== this.view) this.msg = ''; this.view = view;
    if (v.st.ph !== 'lobby') { this.flush(); this.advance(); this.autoSim(); this.trophy(); }
    this.paint();
  },
  // once a session: delete leagues nobody has touched for 60 days
  sweep() {
    if (this.swept || !this.db) return; this.swept = true;
    const db = this.db;
    db.ref('bobble/lgidx').once('value').then(sn => {
      const v = sn.val() || {}, now = Date.now();
      for (const c in v) if (typeof v[c] !== 'number' || now - v[c] > OSN_IDLE) { db.ref('bobble/leagues/' + c).remove().catch(() => {}); db.ref('bobble/lgidx/' + c).remove().catch(() => {}); }
    }).catch(() => {});
  },

  // ---------- making / joining ----------
  create() {
    const name = this.clean($('osName').value); if (!name) return this.say('Type a nickname first (first name or nickname only).');
    this.saveName(name); this.say('Making your league...');
    Relay.load().then(db => {
      this.db = db;
      const pick = n => { const c = this.makeCode(); return db.ref('bobble/leagues/' + c + '/cfg').once('value').then(sn => sn.val() && n < 5 ? pick(n + 1) : c); };
      return pick(0).then(code => {
        const now = Date.now(), c = this.cfg;
        return db.ref('bobble/leagues/' + code).set({ cfg: { v: 1, games: c.games, qtr: c.qtr, diff: c.diff, seed: String(Math.floor(Math.random() * 1e9)), made: now }, pl: { A: { n: name } }, st: { ph: 'lobby', wk: 0 }, touch: now })
          .then(() => db.ref('bobble/lgidx/' + code).set(now)).then(() => code);
      });
    }).then(code => { this.me = { code, who: 'A', name }; this.saveMe(); this.msg = ''; this.view = 'lobby'; this.listen(); this.paint(); },
      () => this.say("Can't reach the online server. Check your internet."));
  },
  join() {
    const name = this.clean($('osName').value), code = $('osCodeIn').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!name) return this.say('Type a nickname first (first name or nickname only).');
    if (code.length !== 5) return this.say('League codes are 5 letters/numbers.');
    if ([...code].some(ch => !NET_CHARS.includes(ch))) return this.say('Codes never use O, 0, I, 1 or L. Look at the code again.');
    this.saveName(name); this.say('Looking for league ' + code + '...');
    Relay.load().then(db => {
      this.db = db; const ref = db.ref('bobble/leagues/' + code);
      return ref.once('value').then(sn => {
        const v = sn.val(); if (!v || !v.cfg) return this.say('No league with that code. Check it with your friend.');
        const P = v.pl || {}, same = w => P[w] && String(P[w].n).toLowerCase() === name.toLowerCase();
        if (same('A') || same('B')) return this.joined(code, same('A') ? 'A' : 'B', name); // back in on another phone: same nickname
        if (P.B) return this.say(`That league is full (${this.esc(P.A && P.A.n)} and ${this.esc(P.B.n)}). Rejoining? Use the same nickname as before.`);
        return ref.child('pl/B').transaction(cur => cur ? undefined : { n: name }).then(r => r.committed ? this.joined(code, 'B', name) : this.say('Someone else just joined that league.'));
      });
    }).catch(() => this.say("Can't reach the online server. Check your internet."));
  },
  joined(code, who, name) { this.me = { code, who, name }; this.saveMe(); this.msg = ''; this.view = 'lobby'; this.listen(); this.touch(); this.paint(); },
  saveName(n) { try { localStorage.setItem(this.NKEY, n); } catch (e) {} },
  pickTeam(id) {
    const who = this.me.who, fr = this.fr();
    this.ref.transaction(cur => {
      if (!cur || !cur.st || cur.st.ph !== 'lobby' || !cur.pl || !cur.pl[who]) return;
      if (cur.pl[fr] && cur.pl[fr].tm === id) return; // your friend has it
      cur.pl[who].tm = id; cur.touch = Date.now(); return cur;
    }).then(r => { if (!r.committed) this.say('Your friend already has that team.'); }, () => this.say("Couldn't save that. Check your internet."));
  },
  start() {
    this.ref.transaction(cur => {
      if (!cur || !cur.st || cur.st.ph !== 'lobby' || !cur.pl || !cur.pl.A || !cur.pl.B || !cur.pl.A.tm || !cur.pl.B.tm) return;
      cur.sched = this.makeSched(cur.pl.A.tm, cur.pl.B.tm, cur.cfg.games, seeded(cur.cfg.seed + ':sched'));
      cur.st = { ph: 'reg', wk: 0, t: Date.now() }; cur.touch = Date.now(); return cur;
    }).then(r => { if (r.committed) { Sound.whistle(); this.touch(); } }, () => this.say("Couldn't start. Check your internet."));
  },
  leave() {
    const host = this.me.who === 'A', started = this.L && this.L.st.ph !== 'lobby';
    if (!confirm(host ? 'Delete this league for both of you? It can\'t be undone.' : started ? 'Leave this league on this device? You can come back with the code and the same nickname.' : 'Leave this league?')) return;
    const ref = this.ref, code = this.me.code, db = this.db;
    if (ref && host) { ref.remove().catch(() => {}); db.ref('bobble/lgidx/' + code).remove().catch(() => {}); }
    else if (ref && !started) ref.child('pl/B').remove().catch(() => {});
    this.cancelMatch(); this.unlisten(); this.me = null; this.saveMe(); this.L = null; this.view = 'setup'; this.msg = ''; this.paint();
  },

  // ---------- your games ----------
  // vs the CPU, on this device (a normal game; the score goes to the league when it ends)
  playCpu() {
    const L = this.L, g = this.myGame(); if (!g || g.h2h || this.res(g.slot, g.i) || this.pending(g.slot, g.i)) return;
    CT.useAll(); Sound.init(); Sound.whistle(); Sound.crowd(false);
    if (G.mode === 'mobile') goFullscreen();
    G.demo = false; G.season = false; G.challenge = null; G.mini = null; show(null);
    const r = this.rng('wx:' + g.slot), wk = g.po ? L.cfg.games : +g.slot.slice(1);
    this.next = { code: this.me.code, slot: g.slot, i: g.i, h: g.h, a: g.a, po: g.po };
    Career.noCAP = true;
    try {
      newGame(this.T(g.h), this.T(g.a), { qtr: L.cfg.qtr, diff: L.cfg.diff, humanSide: g.home ? 0 : 1, playoff: g.po, weather: pickWeather('random', wk, L.cfg.games), night: r() < 0.3 });
    } finally { Career.noCAP = false; this.next = null; }
    if (g.po) showBanner(this.roundName(+g.slot.slice(1)).toUpperCase(), 'Lose and go home', '#ffd23f', 2.4);
    Broadcast.show(g.po ? this.roundName(+g.slot.slice(1)) : 'Week ' + (wk + 1));
  },
  simMine() {
    const g = this.myGame(); if (!g || g.h2h || this.res(g.slot, g.i) || this.pending(g.slot, g.i)) return;
    Sound.click(); this.queue(g.slot, g.i, { s: this.sim(g.h, g.a, g.slot + ':' + g.i), by: this.me.who, sim: 1, t: Date.now() }); this.paint();
  },
  // head-to-head: whoever taps first hosts a normal online VERSUS game, the other joins it from the hub
  playMatch() {
    const g = this.myGame(); if (!g || !g.h2h || this.match) return;
    if (typeof Peer === 'undefined') return this.say("Online play couldn't load. Check your internet and refresh.");
    Sound.init(); Sound.click(); if (G.mode === 'mobile') goFullscreen();
    const lv = this.liveFr(); if (lv) return this.joinMatch(lv.code);
    this.hostMatch();
  },
  liveFr() { const lv = this.L.live, g = this.myGame(); return lv && g && lv.by === this.fr() && lv.slot === g.slot && Date.now() - lv.t < OSN_LIVE ? lv : null; },
  setSel() { CT.useAll(); const i = TEAMS.findIndex(t => t.id === this.myTm()); if (i >= 0) sel.idx[sel.you] = i; },
  hostMatch() {
    const g = this.myGame(), m = this.match = { code: this.me.code, slot: g.slot, i: g.i, h: g.h, a: g.a, po: g.po, host: 1, st: 'Getting a code...' };
    this.setSel(); this.paint();
    const who = this.me.who, ref = this.ref;
    Net.host(code => {
      if (this.match !== m) return;
      m.net = code; m.st = `Waiting for ${this.nick(this.fr())}. Tell them to tap PLAY MATCHUP in ONLINE SEASON. Game code ${code}.`;
      ref.child('live').transaction(cur => cur && cur.by !== who && cur.slot === m.slot && Date.now() - cur.t < OSN_LIVE ? undefined : { code, by: who, slot: m.slot, t: Date.now() }).then(r => {
        if (this.match !== m) return;
        if (!r.committed) { const v = r.snapshot && r.snapshot.val(); Net.reset(); this.match = null; if (v && v.code) this.joinMatch(v.code); return; } // they hosted first: join theirs
        ref.child('live').onDisconnect().remove();
      }, () => {});
      this.paint();
    }, st => { if (this.match === m) { m.st = st; this.paint(); } });
  },
  joinMatch(code) {
    const g = this.myGame();
    const m = this.match = { code: this.me.code, slot: g.slot, i: g.i, h: g.h, a: g.a, po: g.po, st: 'Connecting to ' + this.nick(this.fr()) + '...' };
    this.setSel(); this.paint();
    Net.join(code, st => { if (this.match === m) { m.st = st; this.paint(); } });
  },
  cancelMatch() {
    const m = this.match; if (!m) return;
    this.match = null; if (Net.role && !G.online) Net.reset();
    if (this.ref && m.host && this.L && this.L.live && this.L.live.by === this.me.who) { this.ref.child('live').onDisconnect().cancel(); this.ref.child('live').remove().catch(() => {}); }
  },
  // SIM IT: both tap it (or the host, once the week is 2 days old)
  vote() {
    const g = this.myGame(); if (!g || !g.h2h) return;
    Sound.click(); this.ref.child('vote/' + g.slot + '/' + this.me.who).set(Date.now()).then(() => this.touch(), () => {});
    if (this.canForce()) this.simH2H(g);
  },
  canForce() { const g = this.myGame(); return !!(g && g.h2h && this.me.who === 'A' && this.L.st.t && Date.now() - this.L.st.t > OSN_SIM_WAIT); },
  autoSim() {
    const g = this.myGame(); if (!g || !g.h2h || this.res(g.slot, g.i)) return;
    const v = this.L.vote[g.slot]; if (v && v.A && v.B) this.simH2H(g);
  },
  simH2H(g) { if (!this.pending(g.slot, g.i)) this.queue(g.slot, g.i, { s: this.sim(g.h, g.a, g.slot + ':' + g.i), by: 'S', sim: 1, t: Date.now() }); },
  // the game ended (vs CPU, or the online matchup): send the score + box score
  gameOver(s) {
    const o = G.osn; if (!o || !this.me || o.code !== this.me.code) return;
    const sc = s.teams[0].id === o.h ? [s.score[0], s.score[1]] : [s.score[1], s.score[0]];
    if (o.po && sc[0] === sc[1]) sc[this.rng('ot:' + o.slot)() < 0.5 ? 0 : 1] += 3; // (playoffs have overtime; just in case)
    const v = { s: sc, by: this.me.who, t: Date.now() };
    const guest = G.online && Net.role === 'guest';
    if (!guest) {
      const ps = Object.values(G.pstats || {}).filter(p => p.pass || p.rush || p.rec || p.td || p.tkl || p.sack || p.int).map(p => {
        const side = G.teams[p.side] && G.teams[p.side].id === o.h ? 0 : 1;
        return [side, p.pos, String(p.name).slice(0, 32), p.pass | 0, p.rush | 0, p.rec | 0, p.td | 0, p.tkl | 0, p.sack | 0, p.int | 0];
      });
      if (ps.length) v.ps = ps;
      this.queue(o.slot, o.i, v);
    } else setTimeout(() => this.queue(o.slot, o.i, v), 3000); // the host's copy has the box score; ours is the backup
    if (G.online) { const t = this.L && this.L.live; if (t && t.by === this.me.who && this.ref) this.ref.child('live').remove().catch(() => {}); }
    this.match = null;
    // the over screen: back to the league instead of rematch / new teams
    $('btnAgain').style.display = 'none'; $('btnSeasonCont').style.display = 'none';
    $('btnNewTeams').style.display = ''; $('btnNewTeams').textContent = 'TO THE LEAGUE';
    if (G.online) { const w = sc[0] === sc[1] ? null : sc[0] > sc[1] ? o.h : o.a; $('overTitle').textContent = w ? `${this.nick(this.owner(w))} WINS` : 'TIE GAME'; }
  },
  trophy() {
    const L = this.L; if (L.st.ph !== 'done' || L.st.champ !== this.myTm()) return;
    const k = 'bobbleOSTitle:' + this.me.code; try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) { return; }
    Career.addTitle(L.st.champ, 1);
  },

  // ---------- screens ----------
  open(msg) {
    Sound.init(); CT.useAll();
    if (msg) this.msg = msg;
    this.loadMe();
    if (this.me) { this.listen(); if (this.L) this.view = this.L.st.ph === 'lobby' ? 'lobby' : 'hub'; } else this.view = 'setup';
    show('osn'); this.paint(true);
  },
  say(t) { this.msg = t; const el = $('osMsg'); if (el) el.innerHTML = t; },
  paint(now) {
    if (!$('osn').classList.contains('show')) return;
    clearTimeout(this.paintT);
    if (now) this.render(); else this.paintT = setTimeout(() => this.render(), 60);
  },
  render() {
    const el = $('osn'); if (!el.classList.contains('show')) return; // (a late repaint after a game started)
    for (const v of ['setup', 'lobby', 'hub']) el.classList.toggle('os-' + v, v === this.view);
    if (this.view === 'setup') return this.renderSetup();
    if (!this.L) { el.innerHTML = `<div id="osTop"><span>WITH A FRIEND</span><b>ONLINE SEASON</b></div><div id="osMsg" class="osLoad">${this.msg || 'Loading your league...'}</div><div class="row"><button id="osBack">BACK</button></div>`; $('osBack').onclick = () => this.back(); return; }
    if ($('osGrid')) return; // picking a team: don't wipe the grid
    if (this.view === 'lobby') return this.renderLobby();
    const keep = ['osSched', 'olBody'].map(id => $(id) ? $(id).scrollTop : 0); // (a repaint keeps the lists where they were)
    this.renderHub();
    ['osSched', 'olBody'].forEach((id, i) => { if ($(id)) $(id).scrollTop = keep[i]; });
  },
  back() { Sound.click(); this.cancelMatch(); $('osGrid') && $('osGrid').remove(); show('title'); },
  seg(id, label, opts, cur) { return `<div class="muRow"><span class="muL">${label}</span><div class="muC seg" id="${id}">${opts.map(([v, t]) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${t}</button>`).join('')}</div></div>`; },
  renderSetup() {
    let nm = ''; try { nm = localStorage.getItem(this.NKEY) || ''; } catch (e) {}
    const c = this.cfg;
    $('osn').innerHTML = `<div id="osTop"><span>WITH A FRIEND</span><b>ONLINE SEASON</b></div>
      <div id="osSetup">
        <div class="osCard">
          <div class="osH">ONE LEAGUE, TWO COACHES</div>
          <div class="osStep"><b>1</b>One of you makes a league and sends the code. The other joins with it.</div>
          <div class="osStep"><b>2</b>You each pick a team. Your games vs the CPU are played on your own phone, any time.</div>
          <div class="osStep"><b>3</b>When you play each other, both tap PLAY MATCHUP for a live online game (or both tap SIM IT).</div>
          <div class="osStep"><b>4</b>The week moves on when both of you have played. Then playoffs and the Bobble Bowl.</div>
          <div class="osFine">Only your nickname, teams and scores are saved online. A league nobody plays for 60 days is deleted.</div>
        </div>
        <div class="osForm">
          <div class="muRow"><span class="muL">NICKNAME</span><input id="osName" maxlength="12" autocomplete="off" spellcheck="false" placeholder="First name or nickname" value="${this.esc(nm)}"></div>
          ${this.seg('osG', 'GAMES', [[6, '6'], [8, '8'], [12, '12'], [17, '17 FULL']], c.games)}
          ${this.seg('osQ', 'QUARTERS', [[120, '2 MIN'], [180, '3 MIN'], [300, '5 MIN']], c.qtr)}
          ${this.seg('osD', 'CPU', [[0, 'ROOKIE'], [1, 'PRO'], [2, 'ALL-PRO'], [3, 'MADDEN']], c.diff)}
          <button class="big gold" id="osMake">MAKE A LEAGUE</button>
          <div class="osJoin"><input id="osCodeIn" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE"><button class="big" id="osJoinGo">JOIN</button></div>
          <div id="osMsg">${this.msg || 'Got a code from a friend? Type it and tap JOIN.'}</div>
          <button id="osBack">BACK</button>
        </div>
      </div>`;
    for (const [id, k] of [['osG', 'games'], ['osQ', 'qtr'], ['osD', 'diff']]) $(id).querySelectorAll('button').forEach(b => b.onclick = () => { Sound.click(); this.cfg[k] = +b.dataset.v; $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
    $('osMake').onclick = () => { Sound.click(); this.create(); };
    $('osJoinGo').onclick = () => { Sound.click(); this.join(); };
    $('osBack').onclick = () => this.back();
    for (const id of ['osName', 'osCodeIn']) $(id).addEventListener('keydown', e => { e.stopPropagation(); if (e.code === 'Enter') (id === 'osName' ? $('osMake') : $('osJoinGo')).click(); });
  },
  teamChip(id, big) {
    const t = id && this.T(id); if (!t) return `<span class="osTm none">NO TEAM YET</span>`;
    return `<span class="osTm${big ? ' big' : ''}" style="--c1:${t.c1}">${teamBadge(t)}<span>${t.city}<b>${t.name}</b></span></span>`;
  },
  renderLobby() {
    const L = this.L, P = L.pl, host = this.me.who === 'A', c = L.cfg;
    const row = w => `<div class="osPl${w === this.me.who ? ' me' : ''}"><div class="osPn">${P[w] ? this.nick(w) : 'WAITING FOR A FRIEND'}<i>${w === 'A' ? 'HOST' : 'FRIEND'}${w === this.me.who ? '  ·  YOU' : ''}</i></div>${P[w] ? this.teamChip(P[w].tm) : ''}${w === this.me.who ? `<button id="osPick" class="${P[w].tm ? '' : 'gold'}">${P[w].tm ? 'CHANGE' : 'PICK TEAM'}</button>` : ''}</div>`;
    const can = P.A && P.B && P.A.tm && P.B.tm;
    $('osn').innerHTML = `<div id="osTop"><span>WITH A FRIEND</span><b>ONLINE SEASON</b></div>
      <div id="osSetup">
        <div class="osCard osCodeCard">
          <div class="osH">LEAGUE CODE</div><div id="osCode">${L.cfg && this.me.code}</div>
          <div class="osFine">${P.B ? 'You\'re both in. Pick your teams.' : 'Send this code to your friend. They tap ONLINE then ONLINE SEASON, type a nickname and the code, then JOIN.'}</div>
          <div class="osSet">${c.games} GAMES  ·  ${c.qtr / 60} MIN QUARTERS  ·  CPU ${['ROOKIE', 'PRO', 'ALL-PRO', 'MADDEN'][c.diff] || 'PRO'}</div>
        </div>
        <div class="osForm">
          ${row('A')}${row('B')}
          ${host ? `<button class="big gold" id="osStart"${can ? '' : ' disabled'}>START SEASON</button>` : `<div class="osWait">${can ? 'Waiting for ' + this.nick('A') + ' to start the season.' : 'Pick a team. The host starts the season.'}</div>`}
          <div id="osMsg">${this.msg || (host && !can ? 'Both of you need a team before the season can start.' : '')}</div>
          <div class="osBtnRow"><button id="osBack">BACK</button><button id="osLeave">${host ? 'DELETE LEAGUE' : 'LEAVE'}</button></div>
        </div>
      </div>`;
    if ($('osPick')) $('osPick').onclick = () => { Sound.click(); this.openGrid(); };
    if ($('osStart')) $('osStart').onclick = () => { if (can) { Sound.click(); this.start(); } };
    $('osBack').onclick = () => this.back();
    $('osLeave').onclick = () => this.leave();
  },
  openGrid() {
    const P = this.L.pl, mine = P[this.me.who].tm, theirs = this.frTm();
    const tile = t => `<button class="tgT${t.id === mine ? ' cur' : ''}${t.id === theirs ? ' opp' : ''}" data-id="${t.id}" style="--c1:${t.c1};--c2:${t.c2}">${teamBadge(t)}<span class="tgN">${t.city}<br><b>${t.name}</b></span><span class="tgO">${teamOvr(t)}</span>${t.id === theirs ? `<span class="tgOpp">${this.nick(this.fr())}</span>` : ''}</button>`;
    let h = '';
    for (const conf of ['AFC', 'NFC']) for (const dv of ['East', 'North', 'South', 'West']) h += `<div class="tgDiv"><div class="tgDn">${conf} ${dv.toUpperCase()}</div><div class="tgRow">${CT.NFL.filter(t => t.conf === conf && t.div === dv).map(tile).join('')}</div></div>`;
    const g = document.createElement('div'); g.id = 'osGrid';
    g.innerHTML = `<div id="osGHead"><span>PICK <b>YOUR</b> TEAM</span><button id="osGClose">CLOSE</button></div><div id="osGList">${h}</div>`;
    $('osn').appendChild(g);
    $('osGClose').onclick = () => { Sound.click(); g.remove(); };
    g.querySelectorAll('.tgT').forEach(b => b.onclick = () => { if (b.dataset.id === theirs) return; Sound.click(); g.remove(); this.pickTeam(b.dataset.id); });
  },
  renderHub() {
    const L = this.L, st = L.st, me = this.myTm(), fr = this.fr(), t = this.T(me), R = this.recs(st), g = this.myGame(), slot = this.slotOf(st);
    const wkTxt = st.ph === 'reg' ? `WEEK ${st.wk + 1} OF ${L.cfg.games}` : st.ph === 'po' ? this.roundName(st.po.r).toUpperCase() : 'SEASON OVER';
    const dot = id => { const x = this.T(id); return `<span class="dot" style="background:${x.c1}"></span>`; };
    const tag = id => { const w = this.owner(id); return w ? ` <b class="osWho ${w === this.me.who ? 'me' : 'fr'}">${this.nick(w)}</b>` : ''; };
    // next game card
    let card = '', btns = '', info = [];
    if (g) {
      const o = this.T(g.opp), r = this.res(g.slot, g.i), pend = this.pending(g.slot, g.i);
      card = `<div class="lbl">${st.ph === 'po' ? this.roundName(st.po.r).toUpperCase() : 'WEEK ' + (st.wk + 1)}${g.h2h ? ' · <b class="osH2H">HEAD-TO-HEAD</b>' : ''}</div>
        <div class="mu">${g.home ? 'vs' : '@'} ${o.city} ${o.name}</div>
        <div class="sub">${g.h2h ? this.nick(fr) + '\'s team' : 'CPU'}  •  ${o.id} is ${this.recStr(R, o.id)}  •  ${teamOvr(o)} OVR  •  you are ${g.home ? 'HOME' : 'AWAY'}</div>`;
      if (r || pend) {
        const s = r ? r.s : this.q().find(x => x.code === this.me.code && x.slot === g.slot && x.gk === 'g' + g.i).v.s;
        const my = g.home ? s[0] : s[1], th = g.home ? s[1] : s[0], wl = my > th ? 'W' : my < th ? 'L' : 'T';
        card += `<div class="osDone"><span class="${wl}">${wl} ${my}-${th}</span>${r && r.sim ? ' (SIM)' : ''}${pend && !r ? '  ·  UPLOADING...' : ''}</div>`;
      } else if (g.h2h) {
        if (this.match) btns = `<div class="osLive"><div>${this.esc(this.match.st)}</div><button id="osCancel">CANCEL</button></div>`;
        else {
          const lv = this.liveFr(), v = L.vote[g.slot] || {};
          btns = `<button class="big gold" id="osMatch">${lv ? 'JOIN ' + this.nick(fr) : 'PLAY MATCHUP'}</button><button id="osSimIt" class="${v[this.me.who] ? 'on' : ''}">${this.canForce() ? 'SIM IT NOW' : v[this.me.who] ? 'SIM IT: WAITING' : 'SIM IT'}</button>`;
          if (lv) info.push(`<b class="osGo">${this.nick(fr)} IS WAITING FOR YOU. TAP JOIN.</b>`);
          if (v[fr] && !v[this.me.who]) info.push(`${this.nick(fr)} wants to sim this one. Tap SIM IT to agree.`);
          else if (v[this.me.who] && !v[fr]) info.push(`Waiting for ${this.nick(fr)} to tap SIM IT too.${this.me.who === 'A' && !this.canForce() ? ` After 2 days you can sim it alone.` : ''}`);
        }
      } else btns = `<button class="big" id="osPlay">PLAY</button><button id="osSim">SIM</button>`;
    } else if (st.ph === 'done') {
      const ch = this.T(st.champ), w = this.owner(st.champ);
      card = `<div class="lbl">BOBBLE BOWL CHAMPION</div><div class="mu">${ch.city} ${ch.name}</div><div class="sub">${w ? (w === this.me.who ? 'That\'s you. It\'s in your Trophy Case.' : this.nick(w) + ' won it all.') : 'Neither of you this time. Run it back?'}</div>`;
      btns = this.me.who === 'A' ? `<button class="big gold" id="osAgain">NEW LEAGUE</button>` : '';
    } else if (st.ph === 'po') card = `<div class="lbl">${this.roundName(st.po.r).toUpperCase()}</div><div class="mu">${st.po.r === 0 && st.po.rounds[0] && st.po.rounds[0].bye && Object.values(st.po.rounds[0].bye).includes(me) ? 'First-round bye' : 'Your season is over'}</div><div class="sub">${this.nick(fr)} is still playing. The rest gets simmed.</div>`;
    // your friend this week
    const fg = this.frGame();
    if (st.ph !== 'done' && fg) {
      const done = this.res(fg.slot, fg.i), h2h = this.owner(fg.g[0]) && this.owner(fg.g[1]);
      if (!h2h) { const ft = this.frTm(), o = fg.g[0] === ft ? fg.g[1] : fg.g[0]; info.push(done ? `${this.nick(fr)} played ${fg.g[0] === ft ? 'vs' : '@'} ${o}: ${done.s[fg.g[0] === ft ? 0 : 1]}-${done.s[fg.g[0] === ft ? 1 : 0]}` : `${this.nick(fr)} hasn't played ${fg.g[0] === ft ? 'vs' : '@'} ${o} yet.`); }
    } else if (st.ph === 'po' && !fg) info.push(`${this.nick(fr)} is out of the playoffs.`);
    if (g && (this.res(g.slot, g.i) || this.pending(g.slot, g.i)) && st.ph !== 'done') info.push('The week moves on once both games are in.');
    const on = L.pres[fr];
    info.unshift(`<span class="osOn${on ? ' y' : ''}"></span>${this.nick(fr)} ${on ? 'HAS THE GAME OPEN' : 'IS AWAY'}${this.conn ? '' : '  ·  <b class="osOff">YOU\'RE OFFLINE: RESULTS UPLOAD WHEN YOU\'RE BACK</b>'}`);
    // your schedule
    let sched = '';
    (L.sched || []).forEach((wk, w) => {
      const i = wk.findIndex(x => x[0] === me || x[1] === me); if (i < 0) return;
      const x = wk[i], home = x[0] === me, opp = home ? x[1] : x[0], s = this.scoreOf(st, 'w' + w, i);
      let res = ''; if (s) { const my = home ? s[0] : s[1], th = home ? s[1] : s[0], r = my > th ? 'W' : my < th ? 'L' : 'T'; res = `<span class="${r}">${r} ${my}-${th}</span>`; }
      sched += `<div class="wkrow ${st.ph === 'reg' && w === st.wk ? 'now' : ''}"><span>Wk ${w + 1} ${home ? 'vs' : '@'} ${dot(opp)}${opp}${tag(opp)}</span>${res}</div>`;
    });
    if (st.po) st.po.rounds.forEach((Rd, r) => { const i = Rd.g.findIndex(x => x[0] === me || x[1] === me); if (i < 0) return; const x = Rd.g[i], home = x[0] === me, opp = home ? x[1] : x[0], s = this.scoreOf(st, 'p' + r, i);
      let res = ''; if (s) { const my = home ? s[0] : s[1], th = home ? s[1] : s[0]; res = `<span class="${my > th ? 'W' : 'L'}">${my > th ? 'W' : 'L'} ${my}-${th}</span>`; }
      sched += `<div class="wkrow ${st.ph === 'po' && r === st.po.r ? 'now' : ''}"><span>${this.roundName(r)} ${home ? 'vs' : '@'} ${dot(opp)}${opp}${tag(opp)}</span>${res}</div>`; });
    const bg = g ? `linear-gradient(120deg, ${t.c1} 0%, ${t.c1} 45%, ${this.T(g.opp).c1} 55%, ${this.T(g.opp).c1} 100%)` : 'var(--panel)';
    $('osn').innerHTML = `<div id="osTop"><div class="big1" style="color:${t.c1 === '#000000' ? '#fff' : t.c1}">${t.city.toUpperCase()} ${t.name.toUpperCase()}</div>
        <div class="rec">${this.nick(this.me.who)}  •  ${this.recStr(R, me)}  •  ${wkTxt}  •  LEAGUE ${this.me.code}</div></div>
      <div id="osMain">
        <div id="osLeft"><div id="osNext" style="background:${bg}">${card}</div>${btns ? `<div id="osBtns">${btns}</div>` : ''}<div id="osInfo">${info.map(x => `<div>${x}</div>`).join('')}</div><div id="osMsg">${this.msg}</div><div id="osSched">${sched}</div></div>
        <div id="osRight"><div id="osTabs">${[['stand', 'STANDINGS'], ['scores', 'SCORES'], ['lead', 'LEADERS'], ['po', 'PLAYOFFS']].map(([k, n]) => `<button data-t="${k}" class="${k === this.tab ? 'on' : ''}">${n}</button>`).join('')}</div><div id="olBody"></div></div>
      </div>
      <div class="row" id="osRow"><button id="osBack">MENU</button><button id="osRefresh">REFRESH</button><button id="osLeave">${this.me.who === 'A' ? 'DELETE LEAGUE' : 'LEAVE LEAGUE'}</button></div>`;
    const on2 = (id, f) => { const e = $(id); if (e) e.onclick = f; };
    on2('osPlay', () => this.playCpu()); on2('osSim', () => this.simMine()); on2('osMatch', () => this.playMatch()); on2('osSimIt', () => this.vote());
    on2('osCancel', () => { Sound.click(); this.cancelMatch(); this.paint(); });
    on2('osAgain', () => { if (confirm('Start a new league? This one gets deleted for both of you.')) { const ref = this.ref, code = this.me.code; ref && ref.remove().catch(() => {}); this.db && this.db.ref('bobble/lgidx/' + code).remove().catch(() => {}); this.unlisten(); this.me = null; this.saveMe(); this.L = null; this.view = 'setup'; this.paint(); } });
    on2('osBack', () => this.back()); on2('osLeave', () => this.leave());
    on2('osRefresh', () => { Sound.click(); this.msg = ''; this.flush(); this.advance(); this.paint(); });
    $('osTabs').querySelectorAll('button').forEach(b => b.onclick = () => { Sound.click(); this.tab = b.dataset.t; this.renderTab(); });
    this.renderTab();
  },
  renderTab() {
    const L = this.L, st = L.st, me = this.myTm(), R = this.recs(st), el = $('olBody');
    $('osTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === this.tab));
    const dot = id => `<span class="dot" style="background:${this.T(id).c1}"></span>`;
    const who = id => { const w = this.owner(id); return w ? ` <b class="osWho ${w === this.me.who ? 'me' : 'fr'}">${this.nick(w)}</b>` : ''; };
    let h = '';
    if (this.tab === 'stand') {
      const conf = this.conf || this.T(me).conf, s = this.standings(R, conf);
      h = `<div class="osConf">${['AFC', 'NFC'].map(c => `<button data-c="${c}" class="${c === conf ? 'on' : ''}">${c}</button>`).join('')}</div><table><tr><th>#</th><th>${conf}</th><th>W-L</th><th>PF</th><th>PA</th></tr>` +
        s.map((id, i) => { const r = R[id], w = this.owner(id); return `<tr class="${w ? (w === this.me.who ? 'me' : 'fr') : ''} ${i === 6 ? 'cut' : ''}"><td>${i + 1}</td><td>${dot(id)}${this.T(id).name}${who(id)}</td><td>${this.recStr(R, id)}</td><td>${r.pf}</td><td>${r.pa}</td></tr>`; }).join('') +
        `</table><div class="note">Dashed line = playoff cut (top 7: 4 division winners + 3 wild cards)</div>`;
    } else if (this.tab === 'scores') {
      const S = this.slots(st).filter(([slot, G]) => G.some((g, i) => this.scoreOf(st, slot, i)));
      if (!S.length) h = '<div class="note">Scores show up here once week 1 is played.</div>';
      else {
        let k = this.wkView == null || this.wkView >= S.length ? S.length - 1 : this.wkView; this.wkView = k;
        const [slot, G] = S[k], name = slot[0] === 'w' ? 'WEEK ' + (+slot.slice(1) + 1) : this.roundName(+slot.slice(1)).toUpperCase();
        h = `<div class="osWk"><button id="osWkP"${k ? '' : ' disabled'}>&lsaquo;</button><span>${name}</span><button id="osWkN"${k < S.length - 1 ? '' : ' disabled'}>&rsaquo;</button></div><div class="bracket osScores">` +
          G.map((g, i) => { const s = this.scoreOf(st, slot, i); return `<div class="bgame${this.owner(g[0]) || this.owner(g[1]) ? ' osHum' : ''}"><div class="${s && s[1] > s[0] ? 'win' : ''}">${dot(g[1])}${g[1]}${who(g[1])} <b>${s ? s[1] : '-'}</b></div><div class="${s && s[0] > s[1] ? 'win' : ''}">${dot(g[0])}${g[0]}${who(g[0])} <b>${s ? s[0] : '-'}</b></div></div>`; }).join('') + '</div>';
      }
    } else if (this.tab === 'lead') {
      const S = this.stats(), all = Object.values(S);
      const cats = [['pass', 'PASSING YDS'], ['rush', 'RUSHING YDS'], ['rec', 'RECEIVING YDS'], ['td', 'TOUCHDOWNS'], ['sack', 'SACKS'], ['int', 'INTERCEPTIONS']];
      h = '<div class="leadGrid">' + cats.map(([k, lbl]) => `<div class="leadBox"><div class="leadHead">${lbl}</div>` +
        (all.filter(l => l[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, 5).map((l, i) => `<div class="leadRow ${this.owner(l.t) ? (this.owner(l.t) === this.me.who ? 'me' : 'fr') : ''}"><span>${i + 1}. ${dot(l.t)}${this.esc(lastName(l.name))} <i>${l.t}</i></span><b>${l[k]}</b></div>`).join('') || '<div class="note">No stats yet</div>') + '</div>').join('') + '</div>';
    } else {
      if (!st.po) h = `<div class="note">After week ${L.cfg.games}: the top 7 in each conference make the playoffs (4 division winners + 3 wild cards, the 1 seed gets a bye). Win three or four games to take the Bobble Bowl.</div>`;
      else st.po.rounds.forEach((Rd, r) => {
        h += `<div class="leadHead" style="margin-top:6px">${this.roundName(r).toUpperCase()}${Rd.bye ? ` <span class="osBye">(BYE: ${Rd.bye.AFC}, ${Rd.bye.NFC})</span>` : ''}</div><div class="bracket">` +
          Rd.g.map((g, i) => { const s = this.scoreOf(st, 'p' + r, i); return `<div class="bgame${this.owner(g[0]) || this.owner(g[1]) ? ' osHum' : ''}"><div class="${s && s[0] > s[1] ? 'win' : ''}">${dot(g[0])}${g[0]}${who(g[0])} <b>${s ? s[0] : ''}</b></div><div class="${s && s[1] > s[0] ? 'win' : ''}">${dot(g[1])}${g[1]}${who(g[1])} <b>${s ? s[1] : ''}</b></div></div>`; }).join('') + '</div>';
      });
      if (st.champ) h += `<div class="osChamp">CHAMPION: ${dot(st.champ)}${this.T(st.champ).city} ${this.T(st.champ).name}${who(st.champ)}</div>`;
    }
    el.innerHTML = h;
    el.querySelectorAll('.osConf button').forEach(b => b.onclick = () => { Sound.click(); this.conf = b.dataset.c; this.renderTab(); });
    if ($('osWkP')) { $('osWkP').onclick = () => { Sound.click(); this.wkView--; this.renderTab(); }; $('osWkN').onclick = () => { Sound.click(); this.wkView++; this.renderTab(); }; }
  },
  // league leaders: your two box scores + seeded sim lines for everything else
  stats() {
    const L = this.L, st = L.st, S = {};
    for (const [slot, G] of this.slots(st)) G.forEach((g, i) => {
      const s = this.scoreOf(st, slot, i); if (!s) return;
      const r = this.res(slot, i);
      if (r && r.ps) for (const p of r.ps) { const id = g[p[0] ? 1 : 0], k = id + ':' + p[2], l = S[k] || (S[k] = { t: id, name: p[2], pos: p[1], pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, sack: 0, int: 0 });
        ['pass', 'rush', 'rec', 'td', 'tkl', 'sack', 'int'].forEach((f, j) => { l[f] += +p[3 + j] || 0; }); }
      else { const rr = this.rng('st:' + slot + ':' + i); this.simStats(S, g[0], s[0], s[1], rr); this.simStats(S, g[1], s[1], s[0], rr); }
    });
    return S;
  }
};

// ---------- hooks into the rest of the game ----------
screens.push('osn'); menuScreens.push('osn');
{ const el = document.createElement('div'); el.id = 'osn'; el.className = 'screen'; $('stage').appendChild(el); }
// entry: ONLINE screen (under HOST / JOIN)
{ const b = document.createElement('button'); b.id = 'onSeason'; b.innerHTML = 'ONLINE SEASON <i>WITH A FRIEND</i>'; b.onclick = () => { if (Net.role) return; Sound.click(); OSN.open(); }; $('onPick').appendChild(b); }
// a game knows it's a league game (G.osn) only when it was started from the league
{ const _ig = initGame; initGame = function (h, a, o) {
  _ig(h, a, o);
  const n = OSN.next, m = OSN.match; G.osn = null;
  if (n && !G.online && h.id === n.h && a.id === n.a) G.osn = n;
  else if (m && G.online && [h.id, a.id].includes(m.h) && [h.id, a.id].includes(m.a)) G.osn = m;
}; }
SaveGame.FIELDS.push('osn'); // a league game picked back up with RESUME GAME still counts
// hosting the matchup: league quarter length, VERSUS, playoff overtime
{ const _sh = Net.startHost; Net.startHost = function (hello) {
  const m = OSN.match; if (!m || !OSN.L) return _sh.call(this, hello);
  const q = $('optQtr'), qv = q.value, md = onMode;
  q.value = String(OSN.L.cfg.qtr); onMode = 'vs'; Career.noCAP = true;
  try { _sh.call(this, hello); } finally { q.value = qv; onMode = md; Career.noCAP = false; }
  if (m.po && G.online) G.playoff = true;
}; }
{ const _go = G.hooks.onGameOver; G.hooks.onGameOver = s => { _go(s); if (G.osn && !G.demo) OSN.gameOver(s); }; }
{ const b = $('btnNewTeams'), _f = b.onclick; b.onclick = e => {
  if (!G.osn) return _f(e);
  if (G.online) Net.leave(); G.online = false; G.teams = null; G.phase = 'idle'; G.osn = null; OSN.open();
}; }
{ const b = $('btnQuit'), _f = b.onclick; b.onclick = e => { const o = G.osn; _f(e); if (o) { G.osn = null; OSN.match = null; OSN.open(); } }; }
// online trouble during the matchup (friend left, code ran out): back to the league with the message
{ const _om = onlineMsg; onlineMsg = t => {
  if (G.osn && G.phase === 'over') return; // the game is done: stay on the results
  if (OSN.match || G.osn) { OSN.match = null; G.osn = null; onlineWait(null); OSN.open(t); return; }
  _om(t);
}; }
// results that couldn't upload yet go out when we're back
setInterval(() => { if (OSN.me && OSN.ref && OSN.L) { OSN.flush(); OSN.advance(); if ($('osn').classList.contains('show') && !OSN.match) OSN.paint(); } }, 15000);
window.addEventListener('online', () => OSN.flush());
// a league from last time: connect in the background so finished games upload and the week can move on
if (OSN.loadMe() && OSN.q().length) setTimeout(() => { try { OSN.listen(); } catch (e) {} }, 3000);
