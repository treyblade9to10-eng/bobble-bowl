// ---- Game-day feel: momentum meter, road crowd noise, coach's challenges + replay review ----

// ======== momentum ========
// G.mo runs from -100 (away team rolling) to +100 (home team rolling). Big plays swing it, it fades a bit every snap.
// The team holding it gets a tiny edge (Momentum.of): a touch more accurate, sure-handed, better tackling. Capped and small.
const Momentum = {
  on: () => !!G.teams && !G.mini && !G.demo,
  swing(side, amt, flip) {
    if (!this.on() || side == null || side < 0) return;
    const s = side === 0 ? 1 : -1;
    let m = G.mo || 0;
    if (flip && m * s < 0) m *= 0.2; // a takeaway (or a stop) flips it right away
    G.mo = clamp(m + s * amt, -100, 100);
  },
  // 0..1 edge for this side: only the team holding it gets anything, and only once it's really theirs
  of(side) { if (!this.on()) return 0; const m = (G.mo || 0) * (side === 0 ? 1 : -1); return m > 20 ? (m - 20) / 80 : 0; },
  // scrimmage plays (end of endPlay). d0 = the down before the play
  afterPlay(res, d0) {
    if (!this.on()) return;
    const off = G.poss, car = res.carrier, cs = car ? car.side : off, gain = (G.lastResult && G.lastResult.gain) || 0;
    G.mo = (G.mo || 0) * 0.93;
    if (res.type === 'td') this.swing(cs, cs === off ? 26 : 36, true);
    else if (cs !== off && res.type !== 'inc') this.swing(cs, 32, true);              // interception / fumble
    else if (G.next && G.next.kickoff === off && G.next.from === 20) this.swing(1 - off, 24, true); // safety
    else if (G.down > 4) this.swing(1 - off, 22, true);                                // stopped on 4th down
    else {
      if (res.type === 'sack') this.swing(1 - off, gain <= -8 ? 14 : 10);
      if (gain >= 20) this.swing(off, 8 + Math.min(10, (gain - 20) * 0.4));
      if (d0 === 4 && G.down === 1) this.swing(off, 12);                               // converted on 4th
    }
  },
  // kicks and returns (special.js / updateKick)
  kick(kind, side) {
    if (kind === 'fg') this.swing(side, 6);
    else if (kind === 'fgmiss') this.swing(1 - side, 8);
    else if (kind === 'rettd') this.swing(side, 30, true);
    else if (kind === 'bigret') this.swing(side, 10);
    else if (kind === 'recover') this.swing(side, 30, true); // onside / muffed kick
  }
};
// the thin bar under the scorebug: fills from the middle toward whoever has it, in their color
function drawMomentum(g, x, y, w) {
  if (!G.teams || G.mini || G.mo == null) return;
  const m = clamp(G.mo, -100, 100), mid = x + w / 2, t = m > 0 ? G.teams[0] : G.teams[1];
  g.fillStyle = '#0b0f16f0'; g.fillRect(x, y, w, 8);
  if (Math.abs(m) > 1) {
    const len = (w / 2 - 1) * Math.abs(m) / 100, hot = Math.abs(m) >= 60;
    g.fillStyle = barColor(t);
    // the away team sits on the left of the scorebug, home on the right
    if (m > 0) g.fillRect(mid, y + 2, len, 4); else g.fillRect(mid - len, y + 2, len, 4);
    g.fillStyle = hot ? `rgba(255,255,255,${0.45 + 0.3 * Math.sin(G.time * 6)})` : '#ffffff50';
    if (m > 0) g.fillRect(mid + len - 3, y + 2, 3, 4); else g.fillRect(mid - len, y + 2, 3, 4);
  }
  g.fillStyle = '#fff'; g.fillRect(mid - 1, y, 2, 8);
  // it just swung to one team for real: a little tag under the bar for a couple of seconds
  const hold = m >= 50 ? 0 : m <= -50 ? 1 : Math.abs(m) < 25 ? null : G.moHolder;
  if (hold !== G.moHolder) { G.moHolder = hold; if (hold != null) G.moPop = G.time; }
  if (G.moHolder != null && G.moPop != null && G.time - G.moPop < 2.6 && G.time >= G.moPop) {
    // away: under its own cell on the left; home: just right of the bar (the play clock sits in the middle)
    g.font = 'italic 900 13px "Barlow Condensed", Arial, sans-serif';
    const a = Math.min(1, (2.6 - (G.time - G.moPop)) * 3), tw = g.measureText(`MOMENTUM  ${t.id}`).width + 16, tx = G.moHolder === 0 ? x + w + 4 : x, ty = G.moHolder === 0 ? y : y + 9;
    g.save(); g.globalAlpha = a;
    g.fillStyle = '#0b0f16e8'; g.fillRect(tx, ty, tw, 18); g.fillStyle = barColor(t); g.fillRect(tx, ty, 3, 18);
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(`MOMENTUM  ${t.id}`, tx + 9, ty + 9.5);
    g.restore();
  }
}

// team color that shows up on the dark scorebug (navy / black teams use their second color)
function barColor(t) {
  const lum = h => { const n = parseInt((h || '#888').replace('#', ''), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
  return lum(t.c1) >= 55 ? t.c1 : lum(t.c2) >= 55 ? t.c2 : '#ffd23f';
}

// ======== crowd noise ========
// Loud places on the road: domes are the loudest, a few outdoor stadiums are famous for it, rivalries and the playoffs crank it up.
// Hits whoever has the ball as the AWAY team (G.poss === 1): audibles / hot routes sometimes don't get through, false starts on 3rd down.
const LOUD = { SEA: 0.72, KC: 0.7, NO: 0.76, MIN: 0.74, BUF: 0.62, PHI: 0.62, BAL: 0.56, DEN: 0.58, GB: 0.56, PIT: 0.56, CLE: 0.54, DET: 0.66, LV: 0.58 };
const Crowd = {
  base() {
    const t = G.teams && G.teams[0]; if (!t) return 0;
    const st = stadiumOf(t);
    return (LOUD[t.id] || (st.dome ? 0.56 : 0.38)) + (G.rivalryMatch ? 0.12 : 0) + (G.playoff ? 0.15 : 0) + (G.bigGame ? 0.08 : 0);
  },
  // how loud it is right now for the away offense (0..1)
  level() {
    if (!G.teams || G.mini || G.demo || G.poss !== 1 || G.special || G.patSide != null || G.los == null) return 0;
    const m = G.score[0] - G.score[1], late = G.quarter >= 4 && Math.abs(m) <= 8;
    let L = this.base() * (G.down >= 3 ? 1.25 : 0.85) + (late ? 0.12 : 0) + 0.2 * Momentum.of(0) - 0.25 * Momentum.of(1);
    if (m < -17) L -= 0.25; // home team getting blown out: the place goes quiet
    return clamp(L, 0, 1);
  },
  loud() { return this.level() >= 0.55; },
  // false start chance on 3rd / 4th down: the road offense can't hear the snap count (CPU teams get a smaller dose)
  falseStart() {
    const L = this.level(); if (L < 0.55 || G.down < 3) return 0;
    return (L - 0.55) * (isHumanSide(G.poss) ? 0.12 : 0.05);
  },
  // audible / hot route on the road: sometimes it doesn't get through
  cantHear() {
    if (!isHumanSide(G.poss) || coachCalls()) return false;
    const L = this.level(); if (L < 0.55 || !chance((L - 0.45) * 0.5)) return false;
    const qb = G.O && G.O[0];
    if (qb) addText(qb.x, qb.y - 2, "CAN'T HEAR!", '#ff8a6a', 17, 0.9);
    Sound.tone(220, 0.12, 'square', 0.04); return true;
  },
  // the meter only shows up on the big moments: road offense, 3rd / 4th down (or it's deafening)
  show() { const L = this.level(); return L >= 0.55 && (G.down >= 3 || L >= 0.8) && (G.phase === 'presnap' || G.phase === 'playcall'); }
};
function drawCrowd(g, x, y, L) {
  const n = 8, on = Math.round(L * n), w = 126;
  g.fillStyle = '#0b0f16e0'; roundRect(g, x, y, w, 22, 2); g.fill();
  g.fillStyle = '#9aa6b5'; g.font = '800 12px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('CROWD', x + 8, y + 11.5);
  for (let i = 0; i < n; i++) {
    const shake = i < on && L >= 0.75 ? Math.sin(G.time * 30 + i) * 1.2 : 0;
    g.fillStyle = i < on ? (i >= 6 ? '#ff5a3a' : i >= 4 ? '#ffb43a' : '#ffd23f') : '#ffffff26';
    g.fillRect(x + 46 + i * 9.5, y + 6 + shake, 6.5, 10);
  }
}

// ======== coach's challenges + replay review ========
// On a genuinely close play (sideline catch, spot at the sticks, goal line, fumble vs down) the officials
// sometimes get it wrong. We know the truth from the sim, so the replay booth can fix it.
// Each coach: 2 challenges, needs a timeout, loses it if the ruling stands. Last 2:00 of a half + OT: the booth reviews, no flag.
// 2-player / online: both players can challenge (Y / the red flag button; online the guest's press is sent like any key).
const Review = {
  on: () => !!G.teams && !G.mini && !G.demo && !G.twoPt && !G.special && G.patSide == null && !G.reviewing && !(typeof Tutorial !== 'undefined' && Tutorial.active),
  reset() { G.chalLeft = [2, 2]; G.rv = null; G.rvWin = null; G.rvDone = false; G.rvStats = { close: 0, wrong: 0, chal: 0, booth: 0, over: 0 }; },
  snapReset() { G.rv = null; G.rvWin = null; G.rvDone = false; },
  wrongRate: 0.2, // how often a close call goes the wrong way
  miss() { return chance(this.wrongRate); },
  // everything a reversal needs to put back (taken right before the call is made)
  save() {
    return { los: G.los, down: G.down, firstDownX: G.firstDownX, goalToGo: G.goalToGo, ballY: G.ballY, poss: G.poss, score: G.score.slice(), mo: G.mo,
      tstats: JSON.parse(JSON.stringify(G.tstats)), pstats: JSON.parse(JSON.stringify(G.pstats || {})), credit: G.credit, intBy: G.intBy, lastTackler: G.lastTackler,
      breakup: G.breakup, catchX: G.catchX, pendingRunoff: G.pendingRunoff };
  },
  // a close call: kind, was the call wrong, who the call went against, the real result (when wrong), what the replay is looking at
  make(kind, wrong, against, truth, q, fix) {
    if (G.rv || !this.on()) return;
    G.rv = { kind, wrong, against, truth, q, fix, s: this.save(), frame: Replay.frames.length };
    G.rvStats.close++; if (wrong) G.rvStats.wrong++; G.rvStats[kind] = (G.rvStats[kind] || 0) + 1;
  },
  // how far inside the lines he is (negative = out); the game's own rule allows a quarter yard
  edge: p => Math.min(p.x + 0.25, 120.25 - p.x, p.y + 0.25, FIELD_W + 0.25 - p.y),
  // the catch at the sideline / end line (resolveCatch). Returns whether the officials rule him OUT
  catchCall(rcv, f, out) {
    const m = this.edge(rcv);
    if (!this.on() || G.rv || Math.abs(m) > 0.45) return out;
    const wrong = this.miss(), ruledOut = wrong ? !out : out, off = rcv.side, d = dirOf(off);
    const truth = !wrong ? null : out ? () => ({ type: 'inc', text: 'OUT OF BOUNDS' }) : () => {
      stat(f.passer).comp++; G.credit = { p: rcv, kind: 'rec', passer: f.passer }; G.catchX = rcv.x;
      return d * (rcv.x - goalX(off)) >= 0 ? { type: 'td', carrier: rcv, x: rcv.x, y: rcv.y } : { type: 'oob', carrier: rcv, x: rcv.x, y: rcv.y };
    };
    this.make('catch', wrong, ruledOut ? off : 1 - off, truth, 'Did he get his feet in?', out ? 'He was out of bounds: incomplete' : 'He got his feet in: catch');
    return ruledOut;
  },
  // a fumble right as he went down (tackle): sometimes his knee was already down
  fumbleCall(car) {
    if (!this.on() || G.rv || car.side !== G.poss) return;
    const wrong = chance(this.wrongRate * 1.2), x = car.x, y = car.y;
    this.make('fumble', wrong, car.side, wrong ? () => ({ type: 'tackle', carrier: car, x, y }) : null, 'Fumble, or was he down?', 'He was down before the ball came out');
  },
  // the spot at the end of a play (start of endPlay): goal line, line to gain, a touchdown in traffic / at the pylon
  call(res) {
    const rv = G.rv;
    if (rv && rv.kind === 'fumble' && (!res.carrier || res.carrier.side === G.poss)) G.rv = null; // they kept it: nothing to fight about
    if (G.rv || !this.on() || G.intBy || res.kneel) return res;
    const off = G.poss, d = dirOf(off), car = res.carrier; if (!car || car.side !== off) return res;
    const gx = goalX(off);
    if (res.type === 'td' && G.ball.holder === car && d * (car.x - gx) < 1) { // just got over the line (not a catch deep in the end zone)
      const traffic = G.D.some(p => p.down <= 0 && dist(p, car) < 1.3), pylon = car.y < 1.8 || car.y > FIELD_W - 1.8;
      if (!traffic && !pylon) return res;
      const wrong = this.miss();
      this.make('goal', wrong, wrong ? off : 1 - off, wrong ? () => res : null, 'Did he break the plane?', 'The ball broke the plane: touchdown');
      return wrong ? { type: 'tackle', carrier: car, x: gx - d * 0.3, y: car.y } : res;
    }
    if (res.type !== 'tackle' && res.type !== 'oob') return res;
    const toGoal = d * (gx - res.x);
    if (toGoal > 0 && toGoal < 0.45) { // stopped just short of the goal line
      const wrong = this.miss();
      this.make('goal', wrong, wrong ? 1 - off : off, wrong ? () => res : null, 'Did he break the plane?', 'He was down short of the goal line');
      return wrong ? { ...res, type: 'td' } : res;
    }
    const mg = d * (res.x - G.firstDownX) + 0.05; // >= 0: he got the first down
    if (G.goalToGo || Math.abs(mg) > 0.4 || d * (res.x - G.los) <= 0) return res;
    const made = mg >= 0, wrong = this.miss(), ruledMade = wrong ? !made : made;
    this.make('spot', wrong, ruledMade ? 1 - off : off, wrong ? () => res : null, 'Spot of the ball: did he get the first down?', made ? 'He got the first down' : 'He was short of the line to gain');
    return wrong ? { ...res, x: G.firstDownX + d * (made ? -0.3 : 0.05) } : res;
  },
  booth: () => (G.quarter === 2 || G.quarter >= 4) && G.clock <= 120 || G.quarter >= 5,
  // does a human coach run this side's challenges? (career / Player Lock: the CPU coach does)
  humanCoach: s => isHumanSide(s) && !coachCalls() && !G.lock,
  canChal: s => G.chalLeft && G.chalLeft[s] > 0 && G.timeouts && G.timeouts[s] > 0,
  // end of endPlay: open the red-flag window (or let the booth / the CPU coach decide)
  open() {
    const rv = G.rv; if (!rv) return;
    if (this.booth()) { rv.go = rv.wrong || chance(0.3); if (!rv.go) G.rv = null; return; }
    const s = rv.against;
    if (!this.canChal(s)) { G.rv = null; return; }
    if (this.humanCoach(s)) { G.rvWin = { side: s, t: 3.2 }; G.deadT = Math.max(G.deadT, 3.2); return; }
    rv.cpu = rv.wrong ? chance([0.45, 0.6, 0.7, 0.8][G.diff] || 0.6) : chance(0.05); // the CPU coach saw the replay upstairs (smarter on higher levels)
    if (!rv.cpu) G.rv = null;
  },
  pending() { const rv = G.rv; return !!rv && !G.rvDone && (rv.go || rv.cpu || rv.flag); },
  // dead ball: watch for the red flag (key Y, or the button)
  tick(dt) {
    const w = G.rvWin; if (!w) return;
    w.t -= dt;
    if (withSide(w.side, () => Input.hit('KeyY'))) return this.throwFlag(w.side);
    if (w.t <= 0) { G.rvWin = null; if (G.rv && !G.rv.flag) G.rv = null; }
  },
  throwFlag(s) {
    const w = G.rvWin; if (!w || w.side !== s || !G.rv || !this.canChal(s)) return;
    G.rvWin = null; G.rv.flag = true; G.deadT = 0;
  },
  // the red flag button (phone + computer): online guest sends it like a key press
  tap() {
    if (G.online && typeof Net !== 'undefined' && Net.role === 'guest') { Input.press('KeyY'); return; }
    if (G.rvWin) this.throwFlag(G.rvWin.side);
  },
  start() {
    const rv = G.rv, booth = !!rv.go, by = booth ? -1 : rv.against;
    rv.by = by; rv.booth = booth;
    if (!booth) { G.chalLeft[by]--; G.rvStats.chal++; } else G.rvStats.booth++;
    for (const p of G.players) { if (p.celly) Celly.end(p); p.celly = null; p.tdRun = null; p.cellyNext = null; }
    G.cellyGuy = null; G.tdScorer = null; cam.zoom = 1; cam.focus = null;
    const tm = by >= 0 ? G.teams[by].name : '';
    addPbp(booth ? `The replay booth is taking a look. ${rv.q}` : `${tm} throw the red flag: coach's challenge. ${rv.q}`);
    showBanner(booth ? 'BOOTH REVIEW' : 'CHALLENGE!', booth ? rv.q : `${tm} challenge the call`, '#ff5040', 1.3);
    Sound.whistle();
    G.phase = 'review'; this.t = 0;
    // the replay of the moment (not online: the other player's screen can't play it back)
    const F = Replay.frames, n = F.length, at = Math.min(n - 1, rv.frame || n - 1);
    this.fr = !G.online && n > 30 ? { a: Math.max(0, at - 100), b: Math.min(n - 1, at + 40), u: 0, save: F[n - 1] } : null;
    this.dur = this.fr ? (this.fr.b - this.fr.a) / (60 * 0.6) + 0.6 : 2.6;
    G.rvShow = { q: rv.q, by, booth };
  },
  update(dt) {
    this.t += dt; G.time += dt * 0.6;
    const f = this.fr;
    if (f && G.players) { f.u = Math.min(f.b - f.a, f.u + dt * 60 * 0.6); Replay.apply(Replay.frames[Math.floor(f.a + f.u)]); }
    updateFx(dt);
    const skip = this.t > 0.8 && (Input.hit('Space', 'Enter', 'Escape') || Input.taps.length > 0) && !G.online;
    if (this.t >= this.dur || skip) this.decide();
  },
  decide() {
    const rv = G.rv, f = this.fr; this.fr = null; G.rvShow = null;
    if (f && f.save) Replay.apply(f.save);
    for (const p of G.players) { p.engaged = null; p.celly = null; }
    const over = !!rv.wrong && !!rv.truth, by = rv.by;
    if (over) {
      G.rvStats.over++;
      addPbp(`After review, the ruling on the field is OVERTURNED. ${rv.fix}.`);
      const S = rv.s;
      Object.assign(G, { los: S.los, down: S.down, firstDownX: S.firstDownX, goalToGo: S.goalToGo, ballY: S.ballY, poss: S.poss, score: S.score.slice(), mo: S.mo,
        tstats: S.tstats, pstats: S.pstats, credit: S.credit, intBy: S.intBy, lastTackler: S.lastTackler, breakup: S.breakup, catchX: S.catchX, pendingRunoff: S.pendingRunoff,
        next: null, flags: [], lastResult: null, cellyGuy: null, tdScorer: null });
      if (G.ball) { G.ball.loose = null; G.ball.flight = null; }
      G.rv = null; G.reviewing = true; G.phase = 'live';
      try { endPlay(rv.truth()); } finally { G.reviewing = false; }
      if (by >= 0) Momentum.swing(by, 8);
    } else {
      let lost = '';
      if (by >= 0) { G.timeouts[by] = Math.max(0, G.timeouts[by] - 1); lost = ` ${G.teams[by].name} lose a timeout.`; }
      addPbp(`After review, the ruling on the field stands.${lost}`);
      G.phase = 'dead';
    }
    G.rv = null; G.rvDone = true; G.deadT = Math.max(G.deadT || 0, 2.2);
    showBanner(over ? 'OVERTURNED' : 'RULING STANDS', over ? rv.fix : by >= 0 ? `${G.teams[by].name} lose a timeout  •  ${G.chalLeft[by]} challenge${G.chalLeft[by] === 1 ? '' : 's'} left` : 'The call on the field is confirmed', over ? '#4fe08a' : '#ffffff', 2.2);
    Sound.tone(over ? 660 : 330, 0.18, 'square', 0.05);
  },
  // black bars + UNDER REVIEW while the booth looks at it
  drawOverlay(g) {
    const r = G.rvShow || {};
    g.fillStyle = '#000'; g.fillRect(0, 0, CW, 44); g.fillRect(0, CH - 44, CW, 44);
    drawRedFlag(g, 30, 10, 1, G.time);
    g.fillStyle = '#fff'; g.font = 'italic 900 28px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('UNDER REVIEW', 58, 23);
    const tw = g.measureText('UNDER REVIEW').width;
    g.font = '800 15px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#9aa6b5';
    g.fillText(r.booth ? 'BOOTH REVIEW' : r.by != null && r.by >= 0 && G.teams ? `CHALLENGE: ${G.teams[r.by].name.toUpperCase()}` : '', 58 + tw + 18, 24);
    if (r.q) { g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '600 18px "Barlow Condensed", Arial, sans-serif'; g.fillText(r.q, 24, CH - 22); }
    if (!G.online) { g.textAlign = 'right'; g.fillStyle = '#9aa6b5'; g.font = '800 15px "Barlow Condensed", Arial, sans-serif'; g.fillText(G.mode === 'mobile' ? 'TAP TO SKIP' : 'SPACE TO SKIP', CW - 24, CH - 22); }
  },
  // the red flag button: shows for whoever the close call went against, while the window is open
  ui() {
    const el = $('chalBtn'); if (!el) return;
    const w = G.rvWin, me = !w ? false : G.online ? w.side === G.human : G.versus ? true : w.side === G.human;
    const on = !!w && me && G.phase === 'dead' && !G.paused && !Highlights.on;
    if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
    if (!on) return;
    const left = G.chalLeft ? G.chalLeft[w.side] : 0, txt = `${left} LEFT`;
    const key = G.mode === 'mobile' ? '' : G.versus && !G.online ? (w.side === G.p1 ? '  •  P1: Y' : '  •  P2: O') : '  •  Y';
    if (el.dataset.left !== txt + key) { el.dataset.left = txt + key; $('chalLeft').textContent = txt + key; }
    $('chalBar').style.width = Math.max(0, Math.min(100, w.t / 3.2 * 100)) + '%';
  }
};
// little red challenge flag (canvas)
function drawRedFlag(g, x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 2.5, 24);
  const wv = Math.sin(t * 6) * 1.5;
  g.fillStyle = '#e8281c'; g.beginPath(); g.moveTo(2.5, 1); g.quadraticCurveTo(10, -1 + wv, 18, 2); g.lineTo(18, 13); g.quadraticCurveTo(10, 10 + wv, 2.5, 12); g.closePath(); g.fill();
  g.restore();
}
