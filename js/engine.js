// ---- Game engine: rules, players, AI, physics ----
// Field x: 0-10 = home end zone, 10-110 = field, 110-120 = away end zone. Home (side 0) attacks right.
const G = {
  phase: 'idle', teams: null, players: [], fx: [], ball: null, banner: null, time: 0, crowdHype: 0,
  score: [0, 0], hooks: {}, hint: '', paused: false
};

const dirOf = s => (s === 0 ? 1 : -1);
// 2-player: both sides are human. withSide() runs code as if `s` were the human side, with that player's keys.
const isHumanSide = s => G.versus ? s === 0 || s === 1 : s === G.human;
function withSide(s, fn) {
  if (!G.versus) return fn();
  G.hd[G.human] = G.humanDef;
  const h = G.human, ctl = Input.ctl;
  G.human = s; G.humanDef = G.hd[s]; Input.ctl = s === G.p1 ? 0 : 1;
  if (G.online) Input.use(Input.ctl);
  try { return fn(); } finally { G.hd[s] = G.humanDef; G.human = h; G.humanDef = G.hd[h]; Input.ctl = ctl; if (G.online) Input.use(ctl); }
}
function setHD(side, p) { if (G.versus) G.hd[side] = p; if (side === G.human) G.humanDef = p; }
const pName = s => G.online ? (s === G.human ? 'YOU' : 'OPP') : G.versus ? (s === G.p1 ? 'P1' : 'P2') : (s === G.human ? 'YOU' : 'CPU');
// mobile or computer controls for whoever is acting right now (online: each player's own device)
// Coach Mode: you call the plays, the CPU runs every one of your players (no stick, auto snap, auto kicks). Not in 2-player / online / Player Lock / challenges
const coachPref = () => { try { return JSON.parse(localStorage.getItem('bobbleOpts') || '{}').optCoachMode === '1'; } catch (e) { return false; } };
const coachOn = () => !!G.coachMode && !G.versus && !G.online && !G.lock && !G.demo && !G.mini && !G.challenge && G.human >= 0;
// Career: until the coach trusts you (or you're a veteran) he calls your team's plays (you still play your guy). No timeouts / audibles for you then
const coachCalls = () => !!G.coachCalls && !!G.career && !G.versus && !G.online && !G.demo && !G.mini && !G.challenge && G.human >= 0;
// kicks the human never aims: Coach Mode and every career game (rating-based, like the CPU)
const autoKick = () => coachOn() || (!!G.career && !G.versus && !G.online && !G.mini && G.human >= 0);
const ctlMobile = () => (G.online && G.netModes ? G.netModes[Input.ctl] : G.mode) === 'mobile';
const goalX = s => (s === 0 ? 110 : 10);      // goal line this side is attacking
const ownGoal = s => (s === 0 ? 10 : 110);    // goal line this side defends
const fromOwn = (s, x) => dirOf(s) * (x - ownGoal(s));
const MID = FIELD_W / 2;
const GAME_SPEED = 1.15; // a bit faster than real life = arcade feel
const POS_SPD = { QB: 80, RB: 89, WR: 91, TE: 82, OL: 66, DL: 76, LB: 84, CB: 91, S: 88 };

G.downText = function () {
  if (G.special === 'punt' || (G.km && G.km.kind === 'punt' && G.phase === 'kickmeter')) return 'PUNT';
  if ((G.special && G.special !== 'fgblock') || (G.phase === 'playcall' && G.kickoffSide != null && G.koPending) || (G.km && (G.km.kind === 'ko' || G.km.kind === 'onside') && G.phase === 'kickmeter')) return 'KICKOFF';
  if (G.patSide != null && !G.twoPt) return 'EXTRA POINT';
  if (G.twoPt) return '2-PT TRY';
  if (G.los == null) return '';
  const tg = G.goalToGo ? 'Goal' : Math.max(1, Math.round(Math.abs(G.firstDownX - G.los)));
  return `${ordinal(G.down)} & ${tg}  •  ${spotText(G.poss, G.los)}`;
};
function spotText(s, x) {
  const o = Math.round(fromOwn(s, x));
  if (o === 50) return 'at the 50';
  return o < 50 ? `${G.teams[s].id} ${o}` : `${G.teams[1 - s].id} ${100 - o}`;
}

// ---------------- game setup ----------------
function newGame(home, away, opts) {
  home = TwoWay.expand(Career.withCAP(home)); away = TwoWay.expand(Career.withCAP(away)); // two-way guys play both sides (twoway.js)
  initGame(home, away, opts);
  if (opts.scenario) { // e.g. the Two-Minute Challenge
    const sc = opts.scenario;
    Object.assign(G, { quarter: sc.quarter, clock: sc.clock, score: sc.score.slice() });
    if (sc.timeouts) G.timeouts = sc.timeouts.slice();
    setDrive(sc.poss, ownGoal(sc.poss) + dirOf(sc.poss) * sc.own);
    showBanner(sc.title, sc.sub, '#ffd23f', 2.6);
    return toPlayCall();
  }
  if (G.bigGame) { G.crowdHype = 1.5; showBanner(G.bigGame.name.toUpperCase(), `${away.city} ${away.name} vs ${home.city} ${home.name}  •  winner takes the trophy`, '#d9a933', 3); }
  else if (G.rivalryMatch) { G.crowdHype = 1; showBanner('RIVALRY GAME', `${away.city} ${away.name} at ${home.city} ${home.name}  •  ${G.stadium.name}`, '#ff6040', 2.8); }
  else showBanner('KICKOFF!', `Live from ${G.stadium.name}  •  ${away.name} get the ball first`, '#fff', 2.4);
  startKickoff(0);
}
function initGame(home, away, opts) {
  Object.assign(G, {
    tend: null, trickUsed: null, trickSeen: null, prevClock: null, rivalry: null, wind: null, teams: [home, away], human: opts.humanSide || 0, diff: opts.diff, flags: [], playClock: 0, playoff: !!opts.playoff, qtrLen: opts.qtr, score: [0, 0], quarter: 1, clock: opts.qtr,
    fx: [], banner: null, players: [], ball: null, patSide: null, twoPt: false, next: null, firstPoss: 1, paused: false,
    pstats: {}, tstats: [{ pass: 0, rush: 0, to: 0 }, { pass: 0, rush: 0, to: 0 }], twFat: {},
    timeouts: [3, 3], special: null, pendingRunoff: 0, twoMinQ: 0, twoMinAfterPlay: false, runFrom: 0, mini: null, scenario: opts.scenario || null,
    weather: stadiumOf(home).dome ? 'clear' : opts.weather === 'storm' ? 'rain' : opts.weather === 'fog' ? 'clear' : (opts.weather || 'clear'),
    storm: !stadiumOf(home).dome && opts.weather === 'storm', fog: !stadiumOf(home).dome && opts.weather === 'fog', ltn: null, night: !!opts.night || !!(typeof BCAST !== 'undefined' && BCAST[opts.bcast] && BCAST[opts.bcast].night), stadium: stadiumOf(home), uni: opts.uni || null, pbp: [], pbpShow: null, lastResult: null,
    versus: !!opts.versus, p1: opts.humanSide || 0, hd: [null, null], hp: [null, null], humanDef: null,
    career: opts.career || false, practice: opts.practice || null, lock: !!opts.lock, callBall: 0, sitOut: false, dirt: {}, coachCalls: !!opts.coachCalls, careerSlot: opts.careerSlot || 0, coachTok: null, coachCallName: null,
    bigGame: opts.bigGame ? { year: opts.bigGame, name: bowlName(opts.bigGame) } : null,
    bcast: typeof BCAST !== 'undefined' && BCAST[opts.bcast] && !opts.bigGame ? opts.bcast : null, // primetime TV look (primetime.js)
    coach: COACH_STYLES[opts.coach] ? opts.coach : savedCoach(), coachMode: opts.coachMode != null ? !!opts.coachMode : coachPref()
  });
  // big rivalries: the home team breaks out its rivalry set (unless someone picked uniforms on purpose)
  G.rivalryMatch = !opts.scenario && isRivalry(home, away);
  if (G.rivalryMatch && (!G.uni || (G.uni[0] === 'home' && G.uni[1] === 'away'))) G.uni = ['rivalry', 'away'];
  if (G.versus) G.diff = 1;
  Injury.reset();
  Input.versus = G.versus; Input.ctl = 0;
  setupXFactors();
  G.mo = 0; Review.reset(); // momentum meter + challenges (rules.js)
}

function setDrive(side, x) {
  G.poss = side; G.los = x; G.ballY = MID; G.down = 1; G.patSide = null; G.twoPt = false;
  setFirstDown();
}
function setFirstDown() {
  const d = dirOf(G.poss);
  G.firstDownX = G.los + d * 10;
  G.goalToGo = d * (G.firstDownX - goalX(G.poss)) >= 0;
  if (G.goalToGo) G.firstDownX = goalX(G.poss);
}

function stat(p) {
  if (!G.pstats) G.pstats = {};
  const k = p.side + ':' + p.name;
  return G.pstats[k] || (G.pstats[k] = { name: p.name, side: p.side, pos: p.tw2 ? p.tw2[0] : p.pos, tw: p.tw2 ? p.tw2[1] : undefined, pass: 0, rush: 0, rec: 0, td: 0, tkl: 0, int: 0, sack: 0, comp: 0, att: 0, blk: 0 });
}

// ---------------- play calling ----------------
function toPlayCall() {
  G.phase = 'playcall'; G.sitOut = false; G.coachCallName = null; G.coachTok = null;
  G.ball = null;
  G.flags = [];
  G.fx = G.fx.filter(f => f.kind !== 'flag');
  previewFormation();
  G.playClock = (isHumanSide(G.poss) && !(G.patSide != null && !G.twoPt)) ? (G.online ? 30 : G.versus ? 40 : G.mode === 'mobile' ? 25 : 20) : 0;
  G.koPending = false; G.special = null; G.kickoffSide = null; G.callStart = G.time; G.timeoutCalled = false;
  if (G.patSide != null && !G.twoPt) {
    if (isHumanSide(G.patSide) && !coachCalls()) G.hooks.onPlayCall({ mode: 'pat', side: G.patSide });
    else {
      const two = cpuGoForTwo(G.patSide), tok = G.coachTok = {};
      if (isHumanSide(G.patSide)) coachSays(two ? 'Go For 2' : 'Extra Point');
      setTimeout(() => { if (G.coachTok === tok && G.phase === 'playcall') choosePAT(two ? 'two' : 'xp'); }, 700);
    }
    return;
  }
  cpuTimeoutCheck();
  if (cpuSpikeCheck()) { setTimeout(() => { if (G.phase === 'playcall') { if (G.hooks.onClockOut) G.hooks.onClockOut(); spikeBall(true); addPbp(`${G.teams[G.poss].name} spike it to stop the clock.`); } }, 500); }
  if (typeof SaveGame !== 'undefined') SaveGame.save();
  G.sitOut = lockSitsOut();
  if (G.sitOut) { // Player Lock: your guy is on the sideline, so the coach calls it and the play runs itself (fast)
    const off = G.poss === G.human;
    if (!G.banner || G.banner.t > 1) showBanner(off ? 'OFFENSE ON THE FIELD' : 'DEFENSE ON THE FIELD', 'Your player is on the sideline', '#9aa6b5', 1.0);
    setTimeout(() => { if (G.phase === 'playcall' && G.sitOut) choosePlay(off ? cpuOffCall() : cpuDefCall()); }, 650);
    return;
  }
  if (G.versus) return G.hooks.onPlayCall({ ...withSide(G.poss, playCallCtx), side: G.poss });
  if (coachCalls()) return coachCallPlay();
  G.hooks.onPlayCall(playCallCtx());
}
// career: the coach calls it with the CPU play-call brain (4th downs, two-point tries and kneels included), you see what's coming, then play it
function coachCallPlay() {
  const off = G.poss === G.human, key = off ? cpuOffCall() : cpuDefCall(), tok = G.coachTok = {};
  coachSays(playLabel(key, off));
  setTimeout(() => { if (G.coachTok === tok && G.phase === 'playcall' && !G.koPending) choosePlay(key); }, 900);
}
function playLabel(key, off) {
  const p = (off ? OFF_PLAYS.concat(typeof FAKE_PLAYS !== 'undefined' ? FAKE_PLAYS : [], typeof SPECIAL_PLAYS !== 'undefined' ? SPECIAL_PLAYS : []) : DEF_PLAYS).find(x => x.key === key);
  return key === 'fg' ? 'Field Goal' : key === 'punt' ? 'Punt' : p ? p.name : key;
}
function coachSays(name) {
  G.coachCallName = name;
  if (!G.banner || G.banner.t > 0.8 || G.banner.text === "COACH'S CALL") showBanner("COACH'S CALL", name, '#ffd23f', 1.5);
}
// the presnap hint says what the coach called (and drops audible / timeout, those are his)
function coachHint() {
  if (!coachCalls() || G.phase !== 'presnap' || !G.coachCallName) return;
  const rest = (G.hint || '').replace(/\s*•\s*(Z audible|T timeout)/g, '').trim();
  G.hint = `COACH'S CALL: ${G.coachCallName}` + (rest ? '  •  ' + rest : '');
}
// leading late and the defense can't stop the clock enough: take a knee and end it
function canKneelOut() {
  if (G.twoPt || G.quarter < 4 || G.score[G.poss] <= G.score[1 - G.poss]) return false;
  const kneels = 4 - G.down + 1, tos = G.timeouts ? G.timeouts[1 - G.poss] : 0;
  return G.clock <= Math.max(0, kneels - tos) * 38 + 2;
}
function playCallCtx() {
  const humanOff = G.poss === G.human;
  return { mode: humanOff ? 'off' : 'def', fourth: G.down === 4 && !G.twoPt, twoPt: G.twoPt, fgDist: Math.round(Math.abs(goalX(G.poss) - G.los) + 17),
    fgMax: Math.round(fgRange(kickerOf(G.poss, 'fg').kp)), toGo: Math.round(Math.abs(G.firstDownX - G.los)), down: G.down,
    timeouts: G.timeouts ? G.timeouts[G.human] : 0, kneel: G.poss === G.human && canKneelOut(), canSpike: humanOff && G.down < 4 && !G.twoPt && G.pendingRunoff > 0, lastKey: humanOff ? G.lastOffKey : G.lastDefKey };
}

// CPU coaching styles (game setup: COACH). go = 4th-down guts, run = run/pass mix, blitz, two = 2-pt urge, deep = shot plays, fake = trick plays
const COACH_STYLES = {
  balanced: { go: 0, run: 1, blitz: 1, two: 0, deep: 0, fake: 0.03 },
  aggressive: { go: 1, run: 0.85, blitz: 1.6, two: 0.25, deep: 0.25, fake: 0.08 },
  conservative: { go: -1, run: 1.25, blitz: 0.6, two: -1, deep: -0.15, fake: 0 },
  air: { go: 0, run: 0.5, blitz: 1, two: 0.1, deep: 0.35, fake: 0.03 },
  ground: { go: 0.5, run: 1.7, blitz: 1.1, two: 0, deep: -0.1, fake: 0.03 }
};
function savedCoach() { try { const o = JSON.parse(localStorage.getItem('bobbleOpts') || 'null'); if (o && COACH_STYLES[o.optCoach]) return o.optCoach; } catch (e) {} return 'balanced'; }
const coachStyle = () => COACH_STYLES[G.coach] || COACH_STYLES.balanced;
// how smart the CPU offense is (play calls, QB reads): scales with difficulty; your own team's CPU coach/QB in career is a steady PRO
const cpuIQ = () => G.versus || isHumanSide(G.poss) ? 1 : [0.6, 1, 1.2, 1.4][G.diff] || 1;
// play value by situation = success rates from CPU v CPU play-lab sims (render/co_lab.js): E = 1st/2nd down, S = 1-2 to go, M = 3rd/4th & 3-6, L = 3rd/4th & 7+, G = goal line
const CPU_BOOK = {
  E: { mesh: 62, mdrag: 55, drive: 52, mwheel: 51, smash: 48, slants: 46, wrscreen: 44, flood: 40, mflat: 38, curls: 37, verts: 37, pa: 34, stopgo: 34, mseam: 32, ycross: 31, bubble: 35, boot: 28, screen: 46, outs: 17,
    stretch: 52, rpo: 48, power: 41, zone: 30, dive: 30, counter: 29, shovel: 26, toss: 24, sneak: 20, jet: 28, qbdraw: 42 },
  S: { mesh: 66, wrscreen: 50, drive: 50, curls: 48, flood: 46, smash: 44, slants: 42, mwheel: 42, mflat: 40, ycross: 38, verts: 36, stopgo: 34, mdrag: 32, bubble: 55, screen: 55, pa: 24, mseam: 23, boot: 20, outs: 18,
    counter: 85, stretch: 82, shovel: 75, power: 68, toss: 55, rpo: 45, zone: 32, sneak: 32, jet: 80, dive: 28, qbdraw: 30 },
  M: { mesh: 60, mwheel: 50, slants: 48, drive: 44, mdrag: 44, smash: 44, wrscreen: 38, mflat: 34, mseam: 34, ycross: 32, verts: 32, stopgo: 30, flood: 30, pa: 28, curls: 28, boot: 28, screen: 36, outs: 21, bubble: 24,
    rpo: 48, power: 39, stretch: 38, counter: 28, jet: 30, shovel: 20, zone: 20, dive: 18, toss: 14, sneak: 13, qbdraw: 38 },
  L: { flood: 37, verts: 36, boot: 35, drive: 34, mflat: 34, pa: 33, mesh: 32, stopgo: 32, mseam: 29, mdrag: 28, slants: 28, wrscreen: 14, mwheel: 26, ycross: 26, curls: 24, smash: 22, screen: 14, outs: 11, bubble: 22,
    rpo: 40, power: 12, dive: 10, stretch: 10, jet: 10, toss: 7, zone: 7, counter: 6, shovel: 5, sneak: 3, qbdraw: 26 },
  G: { mesh: 46, mflat: 44, slants: 38, drive: 38, smash: 24, curls: 22, outs: 20, flood: 18,
    stretch: 64, shovel: 50, rpo: 46, power: 32, toss: 30, sneak: 24, jet: 15, zone: 8, dive: 6, counter: 4, qbdraw: 2 }
};
// weighted pick from a list: plays that work in this spot come up more (sharper on higher difficulty), but it still mixes it up
function cpuPick(keys, bucket) {
  const tbl = CPU_BOOK[bucket] || CPU_BOOK.E, sharp = 5 * cpuIQ();
  const w = keys.map(k => Math.exp(((tbl[k] != null ? tbl[k] : 20) - 40) / 100 * sharp)), tot = w.reduce((a, b) => a + b, 0);
  const one = () => { let r = Math.random() * tot; for (let i = 0; i < keys.length; i++) { r -= w[i]; if (r <= 0) return keys[i]; } return keys[keys.length - 1]; };
  const last = G.cpuLast || (G.cpuLast = [null, null]);
  let k = one(); if (k === last[G.poss] && chance(0.6)) k = one(); // don't run the same play over and over
  return (last[G.poss] = k);
}
const CPU_RUNS = ['zone', 'toss', 'dive', 'counter', 'jet', 'power', 'stretch', 'rpo', 'shovel', 'qbdraw'];
const CPU_PASSES = ['slants', 'mesh', 'curls', 'screen', 'pa', 'verts', 'outs', 'bubble', 'smash', 'drive', 'ycross', 'flood', 'stopgo', 'mflat', 'mdrag', 'mseam', 'mwheel', 'boot', 'wrscreen'];
const cpuBucket = (toGo, down, own) => own >= 92 && toGo <= 3 ? 'G' : toGo <= 2 ? 'S' : down <= 2 ? (toGo >= 13 ? 'L' : 'E') : toGo <= 6 ? 'M' : 'L';
// ---- CPU coach: reads the score, the clock, timeouts and field position ----
// rough game-clock costs in this game: a hurry-up play ~11s, a normal play ~15s, a team milking the clock ~38s a snap
function situation(side = G.poss) {
  const margin = G.score[side] - G.score[1 - side], own = fromOwn(side, G.los), q = G.quarter;
  const tos = G.timeouts ? G.timeouts[side] : 0, oppTos = G.timeouts ? G.timeouts[1 - side] : 0;
  const fgDist = Math.abs(goalX(side) - G.los) + 17, fgMax = fgRange(kickerOf(side, 'fg').kp);
  const endGame = q >= 4 ? G.clock : Infinity, endHalf = q === 2 || q >= 4 ? G.clock : Infinity;
  const needScores = margin >= 0 ? 0 : Math.ceil(-margin / 8);
  // how long until we get the ball back if we give it away now (they milk it, we burn timeouts)
  const backIn = Math.max(20, 3 * 38 - tos * 32) + 12;
  return { margin, own, q, tos, oppTos, fgDist, fgOk: fgDist <= fgMax - 4, fgLong: fgDist <= fgMax, endGame, endHalf, needScores, backIn,
    toGo: Math.abs(G.firstDownX - G.los), clockRunning: G.pendingRunoff > 0 };
}
// does the CPU go for it on 4th down?
function cpuGoForIt(toGo, fgOk) {
  const S = situation(), { margin, own, q, endGame } = S;
  const fgPts = fgOk ? 3 : 0;
  if (q >= 4) {
    if (margin < 0) {
      const down = -margin;
      if (fgOk && down <= 3) return toGo <= 1 && own >= 92 && endGame > 30 ? true : false; // a field goal ties or wins it
      // not enough time to punt, stop them, and still score what we need: go
      const timeToScore = S.needScores * 55;
      if (endGame < S.backIn + timeToScore) {
        if (fgOk && down <= 8 && endGame > S.backIn + 50) return false; // kick it, there's time for one more drive
        return true;
      }
      if (down > 8 && own >= 45 && toGo <= 5) return true;    // two scores down: be aggressive past midfield
    } else if (margin > 0) {
      if (fgOk) return toGo <= 1 && own >= 95 && margin <= 3 && chance(0.5); // take the points (or punch it in from the 1)
      if (toGo <= 1 && own >= 50 && endGame < 75) return true; // one yard ices it
      return false;                                              // protecting a lead: punt it away
    } else if (endGame < 60) {                                   // tied late
      if (fgOk) return false;
      return own >= 50 && toGo <= 3;
    }
  }
  if (q === 2 && S.endHalf < 25) return fgOk ? false : own >= 55 && toGo <= 3; // end of half: points if we can get them
  // the normal book (modern analytics: go for it more than old coaches did), tilted by the coach's style
  const g = coachStyle().go;
  if (g < 0) return toGo <= 1 && own >= 55 && !fgOk && chance(0.6);  // old school: punt it, kick it
  if (fgOk) {
    if (toGo <= 1 && own >= 85) return chance(0.6 + g * 0.2);        // goal line: try to punch it in
    if (toGo <= 2 && own >= 70 && own < 85) return chance(0.35 + g * 0.25);
    return false;
  }
  if (toGo <= 1 && own >= 35 - g * 10) return true;                  // 4th and inches
  if (toGo <= 2 + g && own >= 50 - g * 10) return true;
  if (toGo <= 4 + g && own >= 58 - g * 8) return chance(0.55 + g * 0.2); // no man's land: too far to kick, too close to punt
  if (toGo <= 1 && own >= 25 && margin < 0 && q >= 3) return chance(0.5);
  return false;
}
// should the CPU kick a field goal right now, on ANY down? (clock about to run out)
function lastSecondKick(S) {
  if (!S.fgLong || G.twoPt || G.patSide != null) return false;
  const t = S.endHalf; if (t === Infinity) return false;
  // only when there's no time for another real play: clock stopped (or a timeout to stop it) = under 12s, clock running with no timeouts = under 18s
  const running = S.clockRunning && S.tos <= 0;
  if (t > (running ? 18 : 12)) return false;
  if (G.quarter === 2) return true;
  return S.margin >= -3 && S.margin <= 0 || (S.margin > 0 && S.margin <= 5);
}
function cpuOffCall() {
  if (canKneelOut()) return 'kneel';
  const S = situation(), toGo = S.toGo, margin = S.margin;
  if (lastSecondKick(S)) return 'fg';
  const twoMin = (S.q >= 4 && margin < 0 && S.endGame < Math.max(60, S.needScores * 70)) || (S.q === 2 && S.endHalf < 45);
  const hurry = twoMin || (S.q >= 4 && margin < -8 && S.endGame < 150);            // need points fast: throw, get out of bounds
  const milk = S.q >= 4 && margin > 0 && S.endGame < Math.max(90, (G.qtrLen || 180) * 0.45); // ahead late: run, stay in bounds
  G.cpuHurry = hurry && !milk; G.cpuMilk = milk;
  if (G.twoPt && chance(0.1 + Math.max(0, coachStyle().fake))) return pick(['philly', 'statue', 'shovel']);
  if (G.down === 4 && !G.twoPt) {
    const fgOk = S.fgOk;
    if (!cpuGoForIt(toGo, fgOk)) {
      if (toGo <= 5 && !hurry && !milk && S.q < 4 && chance(coachStyle().fake)) return fgOk ? 'fakefg' : 'fakepunt';
      return fgOk ? 'fg' : (S.own >= 62 && S.fgLong ? 'fg' : 'punt'); // a long FG beats punting it into the end zone
    }
    // going for it: pick a play that can actually get the yards
    const b4 = cpuBucket(toGo, 4, S.own);
    if (toGo <= 2) return cpuPick(chance(0.6) ? CPU_RUNS.concat('sneak') : ['mesh', 'smash', 'flood', 'slants', 'mflat', 'curls', 'drive'], b4);
    return cpuPick(CPU_PASSES.filter(k => k !== 'screen' && k !== 'bubble'), b4);
  }
  // end of half/game with the ball and time for one shot only (too far for a Hail Mary and losing: hook and lateral)
  if (S.endHalf < 8 && S.own > 45 && margin <= 0 && !S.fgLong) return 'hail';
  if (S.endHalf < 8 && S.q === 2 && S.own > 45 && !S.fgLong) return 'hail';
  if (S.endHalf < 8 && S.q >= 4 && margin < 0 && margin >= -8 && S.own <= 45) return 'hooklat';
  const trick = cpuTrickCall(S, hurry, milk);
  if (trick) return trick;
  // they keep blitzing: make them pay with screens and the jet sweep
  const bR = blitzRate(1 - G.poss), bk0 = cpuBucket(toGo, G.down, S.own);
  if (!hurry && !G.twoPt && toGo >= 3 && S.own < 90 && chance(clamp((bR - 0.2) * 0.8, 0, 0.3) * cpuIQ())) return cpuPick(['screen', 'wrscreen', 'jet', 'wrscreen'], bk0);
  // 3rd and long vs a defense sitting back: a draw or a screen (safe yards, sets up the kick)
  if (!hurry && !milk && G.down === 3 && toGo >= 8 && chance((0.1 + (S.fgLong ? 0.06 : 0)) * cpuIQ())) return cpuPick(['qbdraw', 'screen', 'qbdraw', 'bubble'], 'L');
  // run/pass mix by down and distance (1st down is a real coin flip, 3rd and long is a passing down)
  // 3rd and short is a running down (power / counter / stretch convert ~75%), 3rd and long is a passing down
  let runW = G.down === 1 ? (toGo >= 15 ? 0.2 : 0.36) : G.down === 2 ? (toGo <= 3 ? 0.55 : toGo >= 8 ? 0.22 : 0.38) : (toGo <= 2 ? 0.62 : toGo <= 4 ? 0.3 : 0.06);
  runW = clamp(runW * coachStyle().run, 0.04, 0.85);
  if (hurry) runW = toGo <= 1 ? 0.35 : 0.05;
  if (milk) runW = toGo >= 10 ? 0.4 : 0.85;
  const bk = G.twoPt ? 'G' : cpuBucket(toGo, G.down, S.own);
  if (!hurry && !milk && toGo >= 4 && (G.down <= 2 || toGo >= 10) && chance(coachStyle().deep)) return cpuPick(['verts', 'pa', 'stopgo', 'drive', 'mseam', 'mwheel'], bk); // take a shot
  if (toGo <= 1 && !hurry && chance(0.2)) return 'sneak'; // 4th/3rd and inches: the sneak converts ~80%
  if (chance(runW)) return cpuPick(milk ? ['zone', 'power', 'dive', 'counter', 'stretch'] : CPU_RUNS, bk);
  if (hurry) return cpuPick(['outs', 'smash', 'flood', 'curls', 'mwheel', 'drive', 'slants', 'mflat', ...(toGo >= 10 ? ['verts', 'ycross'] : ['mesh'])], bk); // sideline routes stop the clock (the QB looks there first)
  if (milk) return cpuPick(['screen', 'bubble', 'slants', 'mesh', 'curls', 'smash', 'mwheel'], bk); // safe, short, keep the clock moving
  return cpuPick(CPU_PASSES, bk);
}
// trick plays: rare, never when the clock matters, and a coach only goes to the well a couple of times a game
function cpuTrickCall(S, hurry, milk) {
  if (hurry || milk || G.twoPt || G.down > 3 || (S.q >= 4 && S.endGame < 150) || (S.q === 2 && S.endHalf < 30)) return null;
  const used = (G.trickUsed && G.trickUsed[G.poss]) || 0;
  if (used >= 2 || !chance(clamp(0.025 + coachStyle().fake * 0.6, 0.012, 0.08))) return null;
  (G.trickUsed || (G.trickUsed = [0, 0]))[G.poss]++;
  const toGo = S.toGo;
  if (S.own >= 88 && toGo <= 5) return pick(['philly', 'statue', 'philly', 'reverse']);             // red zone: Philly Special
  if (G.down <= 2 && toGo <= 10 && S.own >= 35 && S.own <= 78) return pick(['flea', 'flea', 'hbpass', 'reverse', 'endaround', 'philly']); // midfield, early down: take a shot
  if (toGo >= 8) return pick(['flea', 'hbpass', 'hooklat']);
  return pick(['reverse', 'endaround', 'statue']);
}
// the CPU's PAT choice: the real two-point chart late in games
function cpuGoForTwo(side) {
  const m = G.score[side] - G.score[1 - side], late = G.quarter >= 4 || (G.quarter === 3 && G.clock < (G.qtrLen || 180) * 0.3);
  if (!late) return chance(Math.max(0, 0.06 + coachStyle().two));
  if ([-2, -5, -10, -9, 1, 5, 12, -16].includes(m)) return true;   // down 2 -> tie, up 1 -> up 3, down 5 -> down 3, ...
  if (m === -1) return G.clock < 30;                                // last-second try for the win
  return false;
}
function cpuDefCall() {
  const toGo = Math.abs(G.firstDownX - G.los);
  const S = situation(1 - G.poss), oppOwn = fromOwn(G.poss, G.los);
  // protecting a lead late and they need a big play: keep everything in front
  if (S.q >= 4 && S.margin > 0 && S.margin <= 8 && S.endGame < 60 && oppOwn < 70) return pick(['prevent', 'c4', 'prevent', 'c3']);
  if (S.endHalf < 8 && oppOwn >= 45) return 'prevent';                         // hail mary coming
  if (oppOwn >= 95 || (G.twoPt && chance(0.5))) return pick(['run', 'man', 'c0', 'blitz']); // goal line: pack it in
  if (G.down === 4 && !G.twoPt && toGo > 2 && chance(0.6)) return pick(['alldrop', 'c3', 'c4', 'man']);
  if (G.down === 4 && toGo <= 2) return pick(['run', 'man', 'blitz', 'run']);
  if (G.down === 3 && toGo >= 8 && chance(0.5)) return pick(['c3', 'c4', 'fire', 'blitz', 'tampa']);
  if (toGo <= 2 && chance(0.5)) return 'run';
  if (toGo >= 15 && chance(0.4)) return 'prevent';
  // they've been running trick plays: stay home
  const seen = G.trickSeen ? G.trickSeen[G.poss] / Math.max(8, G.trickSeen[G.poss + 2]) : 0;
  if (seen && chance(Math.min(0.3, seen * 1.5))) return 'contain';
  const menu = ['man', 'c2', 'c3', 'blitz', 'man', 'c3', 'cb', 'run', 'c1', 'c4', 'tampa', 'fire', toGo > 6 ? 'c4' : 'c0', 'robber', 'c6', toGo > 6 ? 'c6' : 'sblitz'];
  const bz = coachStyle().blitz; // aggressive coaches send pressure, old-school ones sit in zone
  if (bz > 1 && chance((bz - 1) * 0.35)) return pick(['blitz', 'fire', 'c0', 'blitz', 'sblitz']);
  if (bz < 1 && chance((1 - bz) * 0.6)) return pick(['c3', 'c4', 'c2', 'tampa', 'c6']);
  // the CPU learns your habits: keep going deep and it sits back, keep running and it loads the box
  const t = G.tend, n = t ? t.run + t.short + t.deep : 0;
  if (n >= 4) {
    const k = [0.5, 0.75, 1, 1.25][G.diff];
    if (chance(k * Math.max(0, t.deep / n - 0.25) * 1.6)) return pick(['c2', 'c4', 'tampa', 'c3', 'c4', 'c6']);
    if (chance(k * Math.max(0, t.run / n - 0.35) * 1.6)) return pick(['run', 'fire', 'blitz', 'run', 'sblitz']);
    if (chance(k * Math.max(0, t.short / n - 0.4) * 1.4)) return pick(['man', 'c1', 'cb', 'tampa', 'robber']);
  }
  return pick(menu);
}
// how often each defense sends 5+ (the CPU offense remembers, recent calls count most)
const rushers = k => { const dp = DEF_PLAYS.find(p => p.key === k); return dp && dp.a ? dp.a.filter(a => a === 'rush').length : 0; };
function noteBlitz(defKey) {
  const b = G.blitzSeen || (G.blitzSeen = [{ n: 0, b: 0 }, { n: 0, b: 0 }]), t = b[1 - G.poss];
  t.n = t.n * 0.92 + 1; t.b = t.b * 0.92 + (rushers(defKey) >= 5 ? 1 : 0);
}
const blitzRate = side => { const t = G.blitzSeen && G.blitzSeen[side]; return t && t.n >= 4 ? t.b / t.n : 0; };
// CPU QB reads the look at the line: 5+ rushers walked up vs a slow-developing call = check to a screen or the jet sweep
function cpuCheck(offKey, defKey) {
  const op = OFF_PLAYS.find(p => p.key === offKey);
  if (!op || op.type !== 'pass' || G.twoPt || G.down === 4 || G.cpuHurry || op.screen || op.quick || op.jet || op.trick || op.chain || op.kneel || op.sneak || op.motion) return null;
  if (rushers(defKey) < 5 || Math.abs(G.firstDownX - G.los) <= 2 || fromOwn(G.poss, G.los) >= 90 || !chance(0.3 * cpuIQ())) return null;
  return pick(['wrscreen', 'jet', 'screen', 'wrscreen', 'jet']);
}
const DEEP_KEYS = ['verts', 'pa', 'stopgo', 'hail', 'drive', 'ycross', 'flood', 'post', 'flea', 'hbpass', 'philly'];
function noteTendency(key) {
  const pl = OFF_PLAYS.find(p => p.key === key); if (!pl) return;
  const t = G.tend || (G.tend = { run: 0, short: 0, deep: 0 });
  for (const k in t) t[k] *= 0.9; // recent plays count most
  t[pl.type === 'run' ? 'run' : DEEP_KEYS.includes(key) ? 'deep' : 'short']++;
}

// called by the UI when the human picks a card
function choosePlay(key, defPick) {
  const humanOff = G.versus || G.poss === G.human;
  let offKey = humanOff ? key : cpuOffCall();
  const defKey = G.versus ? (defPick || 'c3') : humanOff ? cpuDefCall() : key;
  if (!G.versus) noteBlitz(defKey);
  if (!humanOff && !G.versus) { const ck = cpuCheck(offKey, defKey); if (ck) { offKey = ck; G.cpuChecked = true; } else G.cpuChecked = false; }
  if (G.versus) { G.lastOffKeys = G.lastOffKeys || [null, null]; G.lastOffKeys[G.poss] = offKey; G.lastDefKeys = G.lastDefKeys || [null, null]; G.lastDefKeys[1 - G.poss] = defKey; }
  else if (humanOff) { G.lastOffKey = key; noteTendency(key); } else G.lastDefKey = key;
  if (offKey === 'punt' || offKey === 'fg') { doKick(offKey); return; }
  const fake = FAKE_PLAYS.find(p => p.key === offKey);
  if (fake) setupFake(fake);
  else setupPlay(OFF_PLAYS.find(p => p.key === offKey), DEF_PLAYS.find(p => p.key === defKey));
  if (G.cpuChecked && G.human >= 0 && G.O) addText(G.O[0].x, G.O[0].y - 2.4, 'AUDIBLE', '#ffe14d', 14, 1.0); // the CPU QB saw the blitz coming
  G.phase = 'presnap'; G.presnapAt = G.time;
  Input.pressed = {}; Input.taps.length = 0; // the key/tap that picked the play doesn't count as a hot route or snap
  G.snapTimer = humanOff && !G.sitOut ? (coachOn() ? 2.2 : Infinity) : G.cpuMotion != null ? 2.4 : 1.6;
  if (G.play && G.play.off && G.play.off.motion) { G.cpuMotion = null; startMotion(); if (!humanOff) G.snapTimer = 2.2; } // motion plays: he takes off right away
  if (!humanOff && !G.sitOut && !coachOn() && (G.mode === 'mobile' || (G.online && G.netModes && G.netModes.includes('mobile')))) G.snapTimer += 1.2; // phones: a beat longer to tap SWITCH / a defender
}

function choosePAT(kind) {
  if (kind === 'two') {
    const s = G.patSide;
    G.poss = s; G.los = goalX(s) - dirOf(s) * 3; G.ballY = MID; G.down = 1; G.twoPt = true; setFirstDown();
    toPlayCall();
  } else doKick('xp');
}

// ---------------- formations ----------------
function makePlayer(side, isOff, slot, tuple) {
  const [pos, name, num, ovr0, spd0, skin0, ex] = tuple;
  const h = hashStr(name);
  const cpu = side !== G.human;
  const ovr = clamp(ovr0 + (cpu && !G.versus ? [-7, 0, 5, 10][G.diff] : 0), 20, 99);
  const big = pos === 'OL' || pos === 'DL';
  const spdR = spd0 || POS_SPD[pos] || 80;
  // Madden speed matters: 99 SPD ≈ 12 yd/s, 85 ≈ 9.4, 70 ≈ 6.7
  const gap = Sliders.mul('spd'); // SPEED GAP slider: stretch / squeeze speeds around 80
  const yps = Math.max(4.8, 2.6 + ((gap === 1 ? spdR : 80 + (spdR - 80) * gap) - 50) * 0.16) * GAME_SPEED;
  const skill = isOff && (pos === 'WR' || pos === 'TE' || pos === 'RB');
  const cpuMul = cpu && !G.versus ? (skill ? (G.career ? [0.92, 1.0, 1.03, 1.06] : [0.88, 0.96, 1.0, 1.04]) : [0.95, 1.0, 1.03, 1.06])[G.diff] : 1; // career: no speed handicap for CPU skill guys (games were too easy)
  const pl = {
    side, off: isOff, slot, pos, name, num, ovr,
    x: 0, y: 0, vx: 0, vy: 0, dvx: 0, dvy: 0,
    spd: yps * cpuMul * Weather.speed(), spdR, acc: (big ? 20 : 30) * GAME_SPEED * Weather.grip(),
    face: { skin: skin0 != null ? skin0 : h % 6, beard: ((h >> 5) % 4) === 0, visor: ex && ex.visor != null ? ex.visor : ((h >> 7) % 5) === 0, dir: dirOf(side) },
    stiff: 0, stiffCd: 0, throwAnim: 0, celebrate: 0, dizzy: 0,
    head: { ox: 0, oy: 0, vx: 0, vy: 0, rot: 0 }, headScale: 1 + ((h >> 9) % 5) * 0.035 + (pos === 'QB' ? 0.06 : 0),
    anim: (h % 100) / 10, speedNow: 0, stamina: 1, down: 0, downDir: 1, stun: 0, spin: 0, juke: 0, jukeCd: 0, spinCd: 0,
    dive: 0, tackleCd: 0, engaged: null, shed: 0, shedCd: 0, mouth: '', mouthT: 0, isHuman: false, throwKey: 0, openness: null,
    role: 'idle', route: null, assign: null, aiIdle: 0,
    xf: (G.xf && G.xf[side + ':' + name]) || null, ab: abFor(name), dirt: (G.dirt && G.dirt[side + ':' + name]) || 0, slip: 0, slipCd: 0,
    cap: !!(ex && ex.cap), thp: ex && ex.thp || null, tha: ex && ex.tha || null, gloves: ex && ex.gloves || null, teamGloves: !!(ex && ex.teamGloves),
    rt: ex && ex.r ? Ratings.clean(ex.r, ovr0, spdR) : null, // specific ratings (ratings.js), offsets from OVR
    tw2: TwoWay.pos2(ex, pos) // two-way: [main spot, other spot]
  };
  if (pl.tw2) TwoWay.apply(pl); // plays every snap: wears down a little
  if (pl.rt) pl.acc *= accMul(pl);
  if (abHas(pl, 'cuts')) pl.acc *= 1.12; // Route Technician / Human Joystick
  return typeof Gear !== 'undefined' && !(ex && ex.cap) ? Gear.apply(pl, G.teams && G.teams[side]) : pl; // Gear Locker picks
}

function parseAssign(a) {
  if (a === 'rush' || a === 'spy') return { type: a };
  const p = a.split(':');
  if (p[0] === 'man') return { type: 'man', t: +p[1] };
  return { type: 'zone', d: +p[1], y: p[2] };
}
function zoneY(code) {
  const by = G.ballY;
  if (code === 'mid') return by;
  if (code === 'edgeT') return 6; if (code === 'edgeB') return FIELD_W - 6;
  if (code === 'thirdT') return 9; if (code === 'thirdB') return FIELD_W - 9;
  return clamp(by + +code, 3, FIELD_W - 3);
}

function previewFormation() {
  const off = OFF_PLAYS[2], def = DEF_PLAYS[0];
  setupPlay(off, def, true);
}

function setupPlay(offPlay, defPlay, preview) {
  const o = G.poss, dsd = 1 - o, d = dirOf(o), L = G.los, by = G.ballY;
  const ws = by <= MID ? 1 : -1; // the wide side
  const P = [];
  const offT = G.teams[o], defT = G.teams[dsd];
  const offTuples = offT.off.slice();
  // RB rotation: a team with two good backs gives RB2 a share of the carries (about 1 in 3, or half if they're close)
  const rb1 = offTuples[1], rb2 = offT.rb2;
  if (!preview && rb2 && rb1 && rb1[0] === 'RB' && !(rb1[6] && rb1[6].cap) && rb2[3] >= 72 && rb2[3] >= rb1[3] - 14 && !G.mini && !G.challenge) {
    const key = G.los + ':' + G.down + ':' + Math.round(G.clock) + ':' + G.quarter;
    if (G.rbKey !== key) { G.rbKey = key; G.rbSnap = G.rbSnap || [0, 0]; G.rbSnap[o]++; }
    const n = G.rbSnap[o], close = rb2[3] >= rb1[3] - 3;
    if (close ? n % 4 >= 2 : n % 6 >= 4) { offTuples[1] = rb2; G.rb2In = true; } else G.rb2In = false;
  }
  if (offPlay.jet || offPlay.fast) { const tg = offPlay.fast || 4; let f = tg; for (const k of [2, 3, 4]) if ((offTuples[k][4] || 0) > (offTuples[f][4] || 0)) f = k; [offTuples[tg], offTuples[f]] = [offTuples[f], offTuples[tg]]; } // jet / reverse goes to the fastest receiver
  offTuples.forEach((t, i) => P.push(makePlayer(o, true, i, t)));
  defT.def.forEach((t, i) => P.push(makePlayer(dsd, false, i, t)));
  const O = P.slice(0, 8), D = P.slice(8);
  if (!preview) TwoWay.snap(P);
  const at = (p, x, y) => { p.x = x; p.y = y; p.hx = x; p.hy = y; };
  const form = FORMATIONS[preview ? 'gun' : formationFor(offPlay)] || FORMATIONS.gun;
  for (let k = 0; k <= 4; k++) { const [bk, w] = (!preview && offPlay.spots && offPlay.spots[k]) || form.spots[k]; at(O[k], L - d * bk, clamp(by + ws * w, 4, FIELD_W - 4)); }
  if (offPlay.jet && !preview) at(O[4], L - d * 2.6, clamp(by - ws * 5, 3, FIELD_W - 3)); // jet guy lines up on the short side and flies across
  at(O[5], L - d * 0.7, by - 2.4); at(O[6], L - d * 0.7, by); at(O[7], L - d * 0.7, by + 2.4);
  if (!preview && offT.rb2 && O[1].pos === 'RB') { G.rbOn = G.rbOn || ['', '']; if (G.rbOn[o] && G.rbOn[o] !== O[1].name) addText(O[1].x, O[1].y, `${lastName(O[1].name).toUpperCase()} IN`, '#7fd3ff', 15, 1.3); G.rbOn[o] = O[1].name; } // running back sub

  // offense roles
  for (const p of O) p.role = 'idle';
  O[0].role = 'qb';
  for (let s = 5; s <= 7; s++) { O[s].role = offPlay.type === 'run' ? 'runblock' : offPlay.screen ? 'screenblock' : 'passblock'; O[s].blockTarget = D[s - 5]; }
  for (let s = 1; s <= 4; s++) {
    const p = O[s];
    const rt = offPlay.routes && offPlay.routes[s];
    if (s === (offPlay.carrier || 1) && offPlay.rb) {
      p.role = 'runpath';
      p.route = { pts: offPlay.rb.path.map(([dd, w]) => ({ x: L + d * dd, y: clamp(by + ws * w, 1.5, FIELD_W - 1.5) })), end: offPlay.rb.end, i: 0 };
    } else if (rt) {
      const out = Math.sign(p.y - by) || ws;
      p.role = rt.end === 'block' ? 'stalk' : 'route';
      const deepX = goalX(o) + d * 7.5; // 2.5 yards in front of the end line
      p.route = { pts: rt.r.map(([dd, oo]) => { const x = p.x + d * dd; return { x: d > 0 ? Math.min(x, deepX) : Math.max(x, deepX), y: clamp(p.y + out * oo, 1.2, FIELD_W - 1.2) }; }), end: rt.end, i: 0, wait: rt.wait };
      if (rt.end === 'block') p.route.blockAfter = true;
    } else {
      p.role = s === 1 ? 'passblock' : 'stalk';
    }
  }

  // jet sweep: the back leads out to the edge for him
  if (offPlay.jet) { const rb = O[1]; rb.role = 'lead'; rb.route = { pts: [{ x: L + d * 0.8, y: clamp(by + ws * 11, 2, FIELD_W - 2) }], end: 'block', i: 0 }; }
  // draw: the back sets up like it's a pass, then leads the QB through the hole
  if (offPlay.draw) { O[1].role = 'lead'; O[1].route = null; }
  // run plays: the slot guy (when he isn't carrying it) blocks down on a linebacker
  if (offPlay.type === 'run' && !offPlay.qbRun && (offPlay.carrier || 1) !== 4 && !offPlay.chain && !offPlay.rpo) {
    O[4].role = 'runblock'; O[4].route = null; O[4].crack = true;
    const pth = offPlay.rb && offPlay.rb.path, w = pth ? pth[pth.length - 1][1] : 0;
    O[4].crackY = Math.abs(w) > 2 ? by + ws * Math.sign(w) * 5 : null; // seal the linebacker on the side the play is going
    if (offPlay.pull && O[4].crackY != null) { // counter: the backside guard pulls and kicks out the playside linebacker
      const g = Math.sign(O[4].crackY - by) > 0 ? O[5] : O[7];
      g.crack = true; g.crackY = O[4].crackY; O[4].crackY = null;
    }
  }
  // trick plays: designed paths for everyone who handles the ball, and a route for the QB (Philly Special)
  if (offPlay.paths) for (const s in offPlay.paths) {
    const p = O[s], pa = offPlay.paths[s];
    p.role = 'runpath'; p.crack = false;
    p.route = { pts: pa.path.map(([dd, w]) => ({ x: L + d * dd, y: clamp(by + ws * w, 1.5, FIELD_W - 1.5) })), end: pa.end, i: 0, wait: pa.wait };
  }
  if (offPlay.routes && offPlay.routes[0]) {
    const rt = offPlay.routes[0], p = O[0], out = Math.sign(p.y - by) || ws;
    p.role = 'route'; p.route = { pts: rt.r.map(([dd, oo]) => ({ x: p.x + d * dd, y: clamp(p.y + out * oo, 1.2, FIELD_W - 1.2) })), end: rt.end, i: 0, wait: rt.wait };
  }
  // defense alignment + assignments
  D.forEach((p, i) => { p.assign = parseAssign(defPlay.a[i]); });
  // trick plays: who bites on the fake (linebackers mostly; disciplined calls and smarter CPU defenses bite less)
  const dk = (dsd !== G.human || G.versus) ? 1 : [1.15, 1, 0.9, 0.8][G.diff] || 1, disc = defPlay.disc ? 0.3 : 1;
  D.forEach(p => { const a = p.assign; p.bite = !preview && !!offPlay.chain && (a.type === 'zone' || a.type === 'man') && !(disc < 1 && a.type === 'zone' && a.d <= 3) && chance((p.slot <= 4 ? 0.7 : a.type === 'man' ? 0.05 : offPlay.type === 'run' ? 0.35 : 0.15) * disc * dk); });
  at(D[0], L + d * 1.3, by - 2.8); at(D[1], L + d * 1.3, by); at(D[2], L + d * 1.3, by + 2.8);
  at(D[3], L + d * 5, by - 4.5); at(D[4], L + d * 5, by + 4.5);
  at(D[5], L + d * 6, O[2].y); at(D[6], L + d * 6, O[3].y); at(D[7], L + d * 12, by);
  const base = D.map(p => ({ x: p.x, y: p.y }));
  for (const p of D) {
    const a = p.assign;
    if (a.type === 'man' && p.slot >= 5) { const t = O[a.t]; at(p, t.x + d * (p.pos === 'CB' ? 2 : 4), t.y + (t.y > by ? -0.6 : 0.6)); }
    if (a.type === 'rush' && p.slot >= 3) { at(p, L + d * (p.slot >= 5 ? 3 : 2.5), lerp(p.y, by, p.slot >= 5 ? 0.45 : 0.3)); }
    if (a.type === 'zone' && p.slot >= 5 && a.d > 10) { at(p, L + d * Math.min(a.d - 4, 14), lerp(p.y, zoneY(a.y), 0.4)); }
  }

  // the CPU defense disguises its call: blitzers sometimes hide in base spots, cover guys sometimes walk up like they're coming
  if (!preview && dsd !== G.human && G.human >= 0 && !G.versus) {
    D.forEach((p, i) => {
      if ((p.x !== base[i].x || p.y !== base[i].y) && chance(0.5)) at(p, base[i].x, base[i].y);
      else if (p.assign.type !== 'rush' && p.slot >= 3 && p.slot <= 6 && chance(0.22)) at(p, L + d * 2.6, lerp(p.y, by, 0.35));
    });
    if (D[7].assign.type === 'zone' && D[7].assign.d > 10 && chance(0.3)) at(D[7], L + d * 7, by + rand(-5, 5)); // safety rotates late
    if (defPlay.a[5] && defPlay.a[5].startsWith('man') && chance(0.35)) { G.cpuPress = true; at(D[5], L + d * 1.1, O[2].y); at(D[6], L + d * 1.1, O[3].y); }
  }
  G.players = P; G.O = O; G.D = D;
  G.refs = [{ x: L - d * 11, y: clamp(by + 7, 3, FIELD_W - 3), face: -d, anim: 0, throwT: 0 },
            { x: L + d * 17, y: clamp(by - 6, 3, FIELD_W - 3), face: -d, anim: 0, throwT: 0 }];
  G.play = { off: offPlay, def: defPlay, t: 0, form };
  G.ball = { x: L, y: by, z: 0, holder: preview ? null : O[0], flight: null, loose: null };
  if (!preview) G.ball.holder = O[offPlay.directSnap || 0];
  else G.ball.holder = O[6]; // center holds it while we pick
  G.motion = null; G.xfSpent = new Set(); G.press = !!G.cpuPress; G.cpuPress = false; G.showBlitz = false;
  G.cpuMotion = (!preview && !isHumanSide(o) && G.human >= 0 && offPlay.type === 'pass' && !offPlay.chain && chance(0.3)) ? 1.0 : null;
  G.bstate = 'snap'; G.meter = null; G.meterV = null; G.chold = null; G.qbScramble = false; G.humanScramble = false; G.aim = null; G.fake = null; G.special = null; G.qbThink = 0; G.handedOff = false; G.intended = null;
  G.trickI = 0; G.decoy = null; G.trickPasser = null; G.trickT = 0; G.trickMinT = 0; G.bite = false; G.pumped = false; G.pumpAt = null; G.rpoKeep = false; G.lastPasser = null; G.latDone = false; G.catchT = null; G.drawAt = null;
  G.runoff = 0; G.passPlay = offPlay.type === 'pass'; G.thrownAway = false;
  // human control
  for (const p of P) p.isHuman = false;
  if (G.versus) { G.hd[dsd] = D[3]; G.hd[o] = null; G.humanDef = G.hd[G.human]; }
  else if (o !== G.human) G.humanDef = D.find(p => p.cap) || D[3];
  updateHuman();
}

// ---------------- pre-snap motion + defensive shifts ----------------
// send a receiver in motion across the formation: if a defender runs with him, it's man coverage
function startMotion() {
  if (G.phase !== 'presnap' || G.motion || G.play.off.chain || G.play.off.type !== 'pass' && !G.play.off.toss && G.play.off.carrier !== 4) return;
  const p = G.play.off.carrier === 4 || G.play.off.motion ? G.O[4] : [G.O[4], G.O[2], G.O[3]].find(r => r.role === 'route');
  if (!p) return;
  const by = G.ballY, to = clamp(by - (p.hy - by) * 0.55, 5, FIELD_W - 5);
  G.motion = { p, to, from: p.y };
  if (isHumanSide(p.side)) addText(p.x, p.y, 'MOTION', '#ffe14d', 15, 0.7);
  Sound.click();
}
function updateMotion(dt) {
  const m = G.motion; if (!m) return;
  const p = m.p, dy = m.to - p.y;
  p.inMotion = true; p.dvx = 0; p.dvy = Math.abs(dy) > 0.3 ? Math.sign(dy) * Math.min(5.5, Math.abs(dy) * 4) : 0; applyMove(p, dt);
  // man defender travels with him (that's the tell)
  for (const df of G.D) if (df.assign.type === 'man' && G.O[df.assign.t] === p) { df.inMotion = true; df.dvx = 0; df.dvy = clamp((p.y + (p.y > G.ballY ? -0.6 : 0.6) - df.y) * 4, -6, 6); applyMove(df, dt); }
}
function snapMotion() {
  const m = G.motion; G.motion = null; G.cpuMotion = null;
  for (const p of G.players) p.inMotion = false;
  // jet sweep / toss: the runner is already flying at the snap
  if (G.play.off.jet) { const j = G.O[G.play.off.carrier || 1], t = j.route && j.route.pts[0]; if (t) { const dx = t.x - j.x, dy = t.y - j.y, m2 = Math.hypot(dx, dy) || 1; j.vx = dx / m2 * j.spd; j.vy = dy / m2 * j.spd; } }
  if (m && m.p.route && G.play.off.mroute && m.p === G.O[4]) { // motion play: his route starts from where he is, heading the way he was going
    const d = dirOf(G.poss), dir = Math.sign(m.to - m.from) || 1, p = m.p, deepX = goalX(G.poss) + d * 7.5;
    p.route = { pts: G.play.off.mroute.map(([dd, oo]) => { const x = p.x + d * dd; return { x: d > 0 ? Math.min(x, deepX) : Math.max(x, deepX), y: clamp(p.y + dir * oo, 1.2, FIELD_W - 1.2) }; }), end: G.play.off.mend || 'go', i: 0 };
    p.hy = p.y; p.motionMan = true;
  } else if (m && m.p.route) { const sh = m.p.y - m.p.hy; for (const pt of m.p.route.pts) pt.y = clamp(pt.y + sh, 1.2, FIELD_W - 1.2); m.p.hy = m.p.y; }
  for (const p of G.players) if (abHas(p, 'quick')) p.qj = 0.5; // Quick Jump: a faster first step
  for (const df of G.D) if (xfOn(df, 'bottleneck')) { // Bottleneck: wins the jam on the closest receiver, press or not
    let r = null, rd = 6; for (const o of G.O) if (o.slot >= 2 && dist(o, df) < rd) { rd = dist(o, df); r = o; }
    if (r) { r.stun = 0.6; addText(r.x, r.y, 'BOTTLENECK', '#ff8a1a', 14, 0.7); }
  }
  if (G.press) for (const df of G.D) { // press coverage: jam the receiver at the line
    if (df.slot < 5 || df.slot > 6) continue;
    const r = G.O[df.slot - 3];
    if (r && dist(r, df) < 3 && chance(clamp(0.5 + (rat(df, 'COV') - rat(r, 'AGI')) / 60, 0.2, 0.8))) { r.stun = 0.35; addText(r.x, r.y, 'JAMMED', '#ff8a8a', 13, 0.6); }
  }
}
// defense pre-snap: press the corners up, or walk the linebackers up to show blitz
function defShift(kind) {
  if (G.phase !== 'presnap') return;
  const d = dirOf(G.poss), L = G.los, by = G.ballY;
  const at = (p, x, y) => { p.x = x; p.y = y; p.hx = x; p.hy = y; };
  if (kind === 'press') {
    G.press = !G.press;
    for (const i of [5, 6]) { const df = G.D[i], r = G.O[i - 3]; at(df, G.press ? L + d * 1.1 : L + d * 6, G.press ? r.y : df.y); }
    addText(G.D[5].x, G.D[5].y, G.press ? 'PRESS' : 'OFF COVERAGE', '#7fd3ff', 15, 0.8);
  } else {
    G.showBlitz = !G.showBlitz;
    for (const i of [3, 4]) { const df = G.D[i]; at(df, G.showBlitz ? L + d * 2.2 : L + d * 5, G.showBlitz ? lerp(df.y, by, 0.35) : by + (i === 3 ? -4.5 : 4.5)); }
    addText(G.D[3].x, G.D[3].y, G.showBlitz ? 'SHOW BLITZ' : 'BACK OFF', '#7fd3ff', 15, 0.8);
  }
  Sound.click(); G.snapTimer = Math.max(G.snapTimer, 0.6);
}

// ---------------- snap & live play ----------------
// two-minute warning: once per half (2nd and 4th quarter), the clock stops at 2:00
function crossedTwoMin(c0) {
  return (G.quarter === 2 || G.quarter === 4) && G.qtrLen > 150 && c0 > 120 && G.clock <= 120 && G.twoMinQ !== G.quarter && !G.mini;
}
function twoMinWarning() {
  G.twoMinQ = G.quarter; G.twoMinAfterPlay = false;
  showBanner('TWO-MINUTE WARNING', '', '#ffd23f', 1.8); Sound.whistle();
  addPbp('Two-minute warning.');
}
// the clock hit 0:00 while you were in the huddle: quarter's over, no snap
function clockRanOut() {
  G.pendingRunoff = 0; G.playClock = 0;
  G.phase = 'dead'; G.deadT = 0.9; G.next = null; G.ball = G.ball || { x: G.los, y: G.ballY, z: 0 };
  showBanner('TIME EXPIRES', '', '#fff', 1.2); Sound.whistle();
  if (G.hooks.onClockOut) G.hooks.onClockOut();
}

function snap() {
  // the CPU offense takes its time in the huddle (you see the clock jump); way more when it's protecting a lead late
  if (G.pendingRunoff > 0 && !isHumanSide(G.poss) && !G.twoPt && G.clock > 0) {
    const lead = G.score[G.poss] - G.score[1 - G.poss], milk = lead > 0 && G.quarter >= 4;
    const extra = Math.max(0, (milk || G.play.off.kneel ? 32 : G.cpuHurry ? 4 : 9) - (G.time - (G.runFrom || G.time)));
    const c0 = G.clock;
    G.clock = Math.max(0, G.clock - extra);
    if (crossedTwoMin(c0)) { G.clock = 120; G.pendingRunoff = 0; twoMinWarning(); }
    if (G.clock <= 0) return clockRanOut();
  }
  if (falseStartRoll()) return;
  burnHuddleClock();
  if (G.down === 3 && !G.twoPt && !G.special && G.tstats) { const t = G.tstats[G.poss]; t.a3 = (t.a3 || 0) + 1; }
  if (G.banner) G.banner.dur = Math.min(G.banner.dur, G.banner.t + 0.25); // ball is snapped: get the banner off the field
  G.phase = 'live'; G.play.t = 0; Sound.hike(); G.throwT = null; G.playClock = 0;
  G.play.fakeSpike = !!G.fakeSpike; G.fakeSpike = false;
  if (G.play.fakeSpike) { G.O[0].throwAnim = 0.35; addText(G.O[0].x, G.O[0].y - 3, 'FAKE SPIKE!', '#7fd3ff', 18, 1.0); }
  G.credit = null; G.lastTackler = null; G.intBy = null; G.breakup = null; G.lastResult = null;
  Review.snapReset();
  if (typeof Replay !== 'undefined') Replay.begin();
  if (G.fake) { showBanner(G.fake === 'punt' ? 'FAKE PUNT!' : 'FAKE FIELD GOAL!', '', '#7fd3ff', 1.3); G.crowdHype = 1; }
  if (!G.twoPt && chance(0.012 * Sliders.mul('pen'))) { const dl = pick(G.D.slice(0, 3)); throwFlag('OFFSIDE', dl.side, dl.x, dl.y, dl); }
  G.ball.holder = G.O[G.play.off.directSnap || 0]; G.bstate = 'snap';
  G.trickSeen = G.trickSeen || [0, 0, 0, 0]; G.trickSeen[G.poss + 2]++; if (G.play.off.trick) G.trickSeen[G.poss]++; // trick plays / all snaps
  snapMotion();
  addDust(G.los, G.ballY, 4);
}

function update(dt) {
  if (G.paused) return;
  // time of possession: whoever has the ball gets the seconds that came off the clock
  if (G.prevClock != null && G.clock < G.prevClock && G.tstats && G.tstats[G.poss] && !G.demo) G.tstats[G.poss].top = (G.tstats[G.poss].top || 0) + G.prevClock - G.clock;
  G.prevClock = G.clock;
  if (G.phase === 'replay') { Replay.update(dt); return; }
  if (G.phase === 'review') { Review.update(dt); return; } // coach's challenge / booth review (rules.js)
  if (G.slowmo > 0) { G.slowmo -= dt; dt *= 0.35; }
  G.time += dt;
  for (const p of G.players) { p.throwAnim = Math.max(0, p.throwAnim - dt); p.celebrate = Math.max(0, p.celebrate - dt); if (p.down <= 0) p.dizzy = 0; if (p.kickT != null && (p.kickT += dt) > 0.9) p.kickT = null; }
  G.crowdHype = Math.max(0, G.crowdHype - dt * 0.4);
  // game clock keeps running between plays after a tackle in bounds (dead ball, play call, pre-snap) until the snap or a timeout
  if (G.pendingRunoff > 0 && G.clock > 0 && !G.demo && !G.mini && (G.phase === 'dead' || G.phase === 'playcall' || G.phase === 'presnap')) {
    const c0 = G.clock;
    G.clock = Math.max(0, G.clock - dt);
    if (crossedTwoMin(c0)) { G.clock = 120; G.pendingRunoff = 0; twoMinWarning(); }
    else if (G.clock <= 0 && G.phase !== 'dead') return clockRanOut();
  }
  // play clock (only when you have the ball)
  if ((G.phase === 'playcall' || G.phase === 'presnap') && G.playClock > 0 && !G.demo) {
    G.playClock -= dt;
    if (G.playClock <= 0) return delayOfGame();
  }
  if (G.phase === 'presnap') {
    if (G.versus) { withSide(G.poss, () => presnapInput(dt)); if (G.phase === 'presnap') withSide(1 - G.poss, () => presnapInput(dt)); }
    else if (presnapInput(dt) === 'audible') return;
    idlePlayers(dt);
    if (G.phase === 'presnap') updateMotion(dt);
  } else if (G.phase === 'live') {
    livePlay(dt);
  } else if (G.phase === 'dead') {
    for (const p of G.players) { p.dvx = 0; p.dvy = 0; applyMove(p, dt); if (p.celly) Celly.update(p, dt); }
    if (G.tdScorer) Celly.stage(G.tdScorer, dt);
    const cg = G.cellyGuy;
    if (cg) withSide(cg.side, () => Celly.input(cg));
    updateBallPhysicsDead(dt);
    Review.tick(dt);
    G.deadT -= dt;
    if (G.deadT <= 0) { if (Review.pending()) Review.start(); else if (!G.rvDone && Replay.want()) Replay.start(); else afterPlay(); }
  } else if (G.phase === 'kick') {
    updateKick(dt);
    if (G.km && G.km.live) fgLive(dt); else idlePlayers(dt);
  } else if (G.phase === 'kickmeter') {
    withSide(G.km ? G.km.side : G.human, () => updateKickMeter(dt));
    if (G.phase === 'kickmeter' && G.km && G.km.live) fgLive(dt); else idlePlayers(dt);
  } else if (G.phase === 'mini') {
    miniUpdate(dt);
  } else if (G.phase === 'playcall') {
    idlePlayers(dt);
  }
  if (Replay.rec && (G.phase === 'live' || G.phase === 'dead')) Replay.record();
  updateRefs(dt);
  updateFx(dt);
  updateHint(); coachHint();
  updateCamera(dt);
}
// before the snap: offense snaps / hot routes, defense picks who to control
function presnapInput(dt) {
  if (G.sitOut) { G.snapTimer -= dt; if (G.snapTimer <= 0) snap(); return; }
  if (coachOn()) { // Coach Mode: timeout / audible still work, the ball snaps itself (or tap / SPACE to snap on offense)
    if (Input.hit('KeyT')) callTimeout(G.human);
    if (Input.hit('KeyZ')) { audible(); return 'audible'; }
    G.snapTimer -= dt;
    if (G.cpuMotion != null && G.snapTimer < G.cpuMotion) { G.cpuMotion = null; startMotion(); }
    const settled = G.time - (G.presnapAt || 0) > 0.3;
    if (G.snapTimer <= 0 || (G.poss === G.human && settled && (Input.hit('Space') || Input.taps.length))) snap();
    return;
  }
  if (Input.hit('KeyT') && !coachCalls()) callTimeout(G.human);
  if (Input.hit('KeyZ') && !G.versus && !coachCalls()) { audible(); return 'audible'; }
  if (G.poss === G.human) {
    if (Input.hit('KeyM')) startMotion();
    const settled = G.time - (G.presnapAt || 0) > 0.3;
    if (settled) for (const [k, s2] of [['Digit1', 2], ['Digit2', 3], ['Digit3', 4], ['Digit4', 1]]) if (Input.hit(k)) hotRoute(s2);
    let tapped = false;
    for (const c of Input.taps) { // tap a receiver = hot route, tap anywhere else = snap
      let best = null, bd = 50;
      for (const r of G.O) if (r.slot >= 1 && r.slot <= 4) { const dd = Math.hypot(sx(r.x) - c.x, sy(r.y) - 35 * viewZ - c.y); if (dd < bd) { bd = dd; best = r; } }
      if (best && G.play.off.type === 'pass') { hotRoute(best.slot); tapped = true; }
    }
    if (Input.hit('Space') || (Input.taps.length && !tapped)) snap();
  } else {
    G.snapTimer -= dt;
    if (Input.hit('KeyV')) defShift('press');
    if (Input.hit('KeyB')) defShift('show');
    if (G.cpuMotion != null && G.snapTimer < G.cpuMotion) { G.cpuMotion = null; startMotion(); }
    if (Input.hit('KeyQ') || Input.hit('Tab')) presnapSwitch();
    for (const c of Input.taps) { // mobile: tap a defender to take him
      if (G.lock && lockedGuy()) break;
      let best = null, bd = 55;
      for (const d of G.D) { const dd = Math.hypot(sx(d.x) - c.x, sy(d.y) - 30 * viewZ - c.y); if (dd < bd) { bd = dd; best = d; } }
      if (best && best !== G.humanDef) { G.humanDef = best; Sound.click(); updateHuman(); G.snapTimer = Math.max(G.snapTimer, 0.9); }
    }
    if (G.snapTimer <= 0) snap();
  }
}

function updateRefs(dt) {
  if (!G.refs || !G.ball) return;
  const b = G.ball, d = dirOf(G.poss);
  const live = G.phase === 'live';
  G.refs.forEach((r, i) => {
    r.throwT = Math.max(0, r.throwT - dt);
    let tx = r.x, ty = r.y;
    if (live) { tx = i === 0 ? b.x - d * 9 : Math.max(b.x + d * 8, r.x * 0 + b.x + d * 8); ty = i === 0 ? clamp(b.y + 7, 2, FIELD_W - 2) : clamp(b.y - 7, 2, FIELD_W - 2); }
    const dx = tx - r.x, dy = ty - r.y, m = Math.hypot(dx, dy);
    const sp = Math.min(m * 2, 7);
    if (m > 0.3) { r.x += dx / m * sp * dt; r.y += dy / m * sp * dt; r.anim += sp * dt * 1.5; r.face = Math.abs(dx) > 0.3 ? Math.sign(dx) : r.face; r.moving = sp; }
    else r.moving = 0;
  });
}

function idlePlayers(dt) { for (const p of G.players) { if (p.inMotion) continue; p.dvx = 0; p.dvy = 0; applyMove(p, dt); } }

function livePlay(dt) {
  const pl = G.play; pl.t += dt;
  if (G.clock > 0) { const c0 = G.clock; G.clock = Math.max(0, G.clock - dt); if (crossedTwoMin(c0)) G.twoMinAfterPlay = true; }
  const b = G.ball;
  updateHuman();

  // AI + human desired velocities
  for (const p of G.players) {
    p.tackleCd = Math.max(0, p.tackleCd - dt); p.shedCd = Math.max(0, p.shedCd - dt);
    p.jukeCd = Math.max(0, p.jukeCd - dt); p.spinCd = Math.max(0, p.spinCd - dt);
    p.stiffCd = Math.max(0, p.stiffCd - dt); p.stiff = Math.max(0, p.stiff - dt);
    if (p.hit > 0) { p.hit -= dt; if (p.hit <= 0) { p.hit = 0; p.down = 0.7; p.downDir = p.vx >= 0 ? 1 : -1; addText(p.x, p.y, 'WHIFF!', '#ccc', 16, 0.7); } }
    p.hitCd = Math.max(0, (p.hitCd || 0) - dt);
    p.jump = Math.max(0, (p.jump || 0) - dt); p.jumpCd = Math.max(0, (p.jumpCd || 0) - dt); p.swimCd = Math.max(0, (p.swimCd || 0) - dt);
    p.stun = Math.max(0, p.stun - dt); p.juke = Math.max(0, p.juke - dt); p.spin = Math.max(0, p.spin - dt);
    if (p.mouthT > 0) { p.mouthT -= dt; if (p.mouthT <= 0) p.mouth = ''; }
    if (p.down > 0 || p.stun > 0) { p.dvx = p.dvy = 0; continue; }
    if (p.dive > 0) continue; // dive keeps its velocity
    p.humanDriven = false; p.sprinting = false;
    if (pl.fakeSpike && pl.t < 0.55 && !p.off && !p.isHuman) { p.dvx = p.dvy = 0; p.sdx = p.sdy = 0; continue; } // the defense bought it
    if (G.pumpAt != null && pl.t - G.pumpAt < 0.6 && !p.off && !p.isHuman && p.assign && p.assign.type !== 'rush' && !p.engaged) { p.dvx *= 0.2; p.dvy *= 0.2; p.sdx = p.dvx; p.sdy = p.dvy; continue; } // pump fake: the coverage freezes
    if (pl.off.kneel && b.holder === G.O[0]) { // victory formation: QB backs up a step, everybody else stands down
      p.dvx = p === G.O[0] && pl.t < 0.3 ? -dirOf(G.poss) * 3 : 0; p.dvy = 0; p.engaged = null; p.sdx = p.dvx; p.sdy = p.dvy; continue;
    }
    if (p.isHuman && withSide(p.side, () => humanControl(p, dt) && (p.humanDriven = Input.axis().m > 0.1 || Input.stick.m > 0.15 || Input.pointer.down || p.dive > 0, true))) { if (p.tuck && b.holder === p) { p.dvx *= 0.92; p.dvy *= 0.92; } p.sdx = p.dvx; p.sdy = p.dvy; continue; }
    ai(p, dt);
    // smooth AI steering so players don't twitch
    const k = 1 - Math.exp(-dt * 12);
    p.sdx = p.sdx == null ? p.dvx : lerp(p.sdx, p.dvx, k); p.sdy = p.sdy == null ? p.dvy : lerp(p.sdy, p.dvy, k);
    if (p.juke <= 0) { p.dvx = p.sdx; p.dvy = p.sdy; }
  }
  resolveBlocks(dt);
  for (const p of G.players) {
    applyMove(p, dt);
    if (p.off) { (p.hist || (p.hist = [])).push({ t: pl.t, x: p.x, y: p.y, vx: p.vx, vy: p.vy }); if (p.hist.length > 45) p.hist.shift(); }
  }
  separate();

  // handoffs / pitches
  if (G.bstate === 'snap' && b.holder === G.O[0] && pl.off.type === 'run' && !pl.off.qbRun && !pl.off.kneel && !pl.off.chain && !G.handedOff) {
    const rb = G.O[pl.off.carrier || 1];
    if (pl.off.toss && pl.t > 0.18) { G.handedOff = true; throwTo(G.O[0], rb, true); }
    else if (!pl.off.toss && pl.t > 0.25 && (dist(G.O[0], rb) < 1.6 || pl.t > (pl.off.carrier ? 1.5 : 0.9))) {
      G.handedOff = true;
      if (pl.off.rpo && rpoRead()) { G.rpoKeep = true; addText(G.O[0].x, G.O[0].y - 2, 'KEEP!', '#7fd3ff', 15, 0.7); } // RPO: QB pulls it and throws
      else { b.holder = rb; G.bstate = 'run'; stat(rb); G.credit = { p: rb, kind: 'rush' }; }
    }
  }
  if (pl.off.draw && G.drawAt == null && b.holder === G.O[0] && (G.qbScramble || pl.t > 1.3 || dirOf(G.poss) * (G.O[0].x - G.O[0].hx) > 0.7)) G.drawAt = pl.t; // the draw shows
  if (pl.off.chain) trickStep(pl);
  if (pl.off.lateral) lateralStep(pl);
  G.bite = !!pl.off.chain && G.bstate === 'snap' && !!b.holder && b.holder.side === G.poss && b.holder !== G.O[0];
  // victory formation: QB takes a knee
  if (pl.off.kneel && b.holder === G.O[0]) {
    const qb = G.O[0], d = dirOf(G.poss);
    if (pl.t >= 0.3) { if (!qb.kneel) addText(qb.x, qb.y - 3, 'VICTORY FORMATION', '#ffd23f', 15, 1.1); qb.kneel = (qb.kneel || 0) + dt; qb.face.dir = d; } // down on one knee and hold it
    if (pl.t > 1.35) { G.credit = { p: qb, kind: 'rush' }; return endPlay({ type: 'tackle', carrier: qb, x: G.los - d * 1, y: qb.y, kneel: true }); }
  }
  // QB (or a trick-play passer) crosses the line = runner
  if (G.bstate === 'snap' && b.holder && b.holder.side === G.poss && dirOf(G.poss) * (b.holder.x - G.los) > 0.5) {
    G.bstate = 'run'; G.credit = { p: b.holder, kind: 'rush' };
  }
  const passer = curPasser();
  if (G.bstate === 'snap' && b.holder === passer && !passer.isHuman && !trickBusy()) cpuQB(dt);
  if (G.humanScramble && G.bstate === 'snap' && b.holder === passer) { G.qbScramble = true; }

  // ball
  if (b.flight) updateFlight(dt);
  if (b.loose) updateLoose(dt);
  if (b.holder) { b.x = b.holder.x; b.y = b.holder.y; b.z = 1; }

  // throw markers for human QB
  withSide(G.poss, humanQBInput);

  if (G.phase !== 'live') return;
  checkFouls();
  if (!G.play.off.kneel) checkTackles();
  if (G.phase !== 'live') return;
  checkBounds();
}

function humanQBInput() {
  const b = G.ball;
  const canThrow = humanCanThrow();
  for (const p of G.O) { p.throwKey = 0; p.openness = null; }
  if (canThrow) for (const s of [2, 3, 4, 1, 0]) { // the QB only gets a button when he runs a route (Philly Special): he takes the RB's 4
    const r = G.O[s];
    if (eligible(r) && !(s === 0 && G.O[1].throwKey)) { r.throwKey = s <= 1 ? 4 : s - 1; r.openness = openness(r); }
  }
  G.aim = null;
  if (!canThrow) { G.meter = null; G.meterV = null; }
  if (canThrow) {
    const qb = curPasser();
    const keys = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4 };
    const style = Input.held('ShiftLeft') ? 'bullet' : Input.held('ControlLeft', 'ControlRight') ? 'lob' : 'normal';
    const useMeter = meterOn() && Input.cur !== 1; // online guest keys arrive as single presses: no meter for those
    if (G.meter && G.meter.key) { // holding a receiver key: let go to throw
      const r = G.O.find(o => o.throwKey === keys[G.meter.key]);
      if (G.ball.holder !== qb || !eligible(r)) G.meter = null;
      else if (!Input.held(G.meter.key)) meterThrow(qb, r, style, Input.axis());
    } else for (const k in keys) if (Input.hit(k)) { const r = G.O.find(o => o.throwKey === keys[k]); if (eligible(r)) { if (useMeter && Input.held(k)) meterStart(qb, k, r); else throwTo(qb, r, false, null, useMeter && style === 'normal' ? 'lob' : style, Input.axis()); break; } }
    const P = Input.pointer;
    // finger on a receiver's icon: hold for the power bar, a quick tap lobs it
    if (meterOn() && G.ball.holder === qb && !G.meter && P.down && !P.moved) {
      const best = iconAt(P.x0, P.y0);
      if (best) { meterStart(qb, null, best); P.noSteer = true; } // this finger is the pass bar: never "run to here", even if the hold gets cut off
    }
    if (G.meter && G.meter.r && !G.meter.key) {
      if (G.ball.holder !== qb || !eligible(G.meter.r)) G.meter = null; // finger can wander once the hold started: it still goes to him
      else if (!P.down) { meterThrow(qb, G.meter.r, style); Input.taps.length = 0; }
      else Input.taps.length = 0;
    }
    // (drag-back throwing was removed: tap / hold a receiver's icon or key instead; RUN button / X = QB takes off)
    G.meterV = G.meter && G.time - G.meter.t0 >= TAP_LOB * 0.6 ? [meterVal(), G.meter.green[0], G.meter.green[1]] : null;
    if (G.ball.holder === qb) for (const c of Input.taps) {
      const best = iconAt(c.x, c.y);
      if (best) { throwTo(qb, best, false, null, meterOn() && style === 'normal' ? 'lob' : style); break; }
    }
  }
}

const FOULS = {
  DPI: { name: 'PASS INTERFERENCE', def: true, text: 'Ball at the spot • Automatic 1st down' },
  RTP: { name: 'ROUGHING THE PASSER', def: true, text: '15 yards • Automatic 1st down' },
  OFFSIDE: { name: 'OFFSIDE', def: true, text: '5 yards' },
  HOLD: { name: 'HOLDING', def: false, text: '10 yards • Replay the down' },
  DELAY: { name: 'DELAY OF GAME', def: false, text: '5 yards • Replay the down' },
  ROUGHK: { name: 'ROUGHING THE KICKER', def: true, text: '15 yards • Automatic 1st down' }, // kick fouls are enforced in special.js
  RIK: { name: 'RUNNING INTO THE KICKER', def: true, text: '5 yards' },
  FACEMASK: { name: 'FACEMASK', def: true, text: '15 yards • Automatic 1st down' },
  GROUND: { name: 'INTENTIONAL GROUNDING', def: false, text: 'Loss of down • Ball at the spot' },
  IBB: { name: 'ILLEGAL BLOCK IN THE BACK', def: false, text: '10 yards from the spot' } // kick returns: enforced in special.js
};
function throwFlag(type, foulSide, x, y, who) {
  if (!G.flags) G.flags = [];
  if (G.flags.some(f => f.type === type)) return;
  G.flags.push({ type, side: foulSide, x, y, num: who ? who.num : null });
  let ref = G.refs && G.refs[0];
  if (G.refs) for (const r of G.refs) if (Math.hypot(r.x - x, r.y - y) < Math.hypot(ref.x - x, ref.y - y)) ref = r;
  if (ref) { ref.throwT = 0.5; G.fx.push({ kind: 'flag', ax: ref.x, ay: ref.y, x, y, t: 0, T: 0.55, z: 0, vz: 0, life: 99, max: 99 }); }
  addText(x, y, 'FLAG!', '#ffe14d', 26, 1.1);
  Sound.tone(1800, 0.25, 'sine', 0.07); Sound.tone(2000, 0.25, 'sine', 0.05, 0, 0.08);
}
function checkFouls() {
  const b = G.ball, pl = G.play, qb = G.lastPasser || G.O[0], off = G.poss;
  if (G.special === 'punt' && G.km && G.km.live) kickerHit(G.km.live, G.km.live.P); // roughing the punter (special.js)
  // roughing the passer: hitting the QB after he already threw it
  if (G.throwT != null && pl.t - G.throwT < 1.0 && b.holder !== qb && qb.down <= 0) {
    for (const df of G.D) {
      if (df.engaged || df.down > 0 || df.side === off || dist(df, qb) > 0.9 || df.speedNow < 4) continue;
      if ((df.isHuman && df.humanDriven && Sliders.call('pen')) || (!df.rtpChecked && !df.isHuman && chance(0.03 * Sliders.mul('pen')))) {
        throwFlag('RTP', df.side, qb.x, qb.y, df);
        qb.down = 1.1; qb.downDir = dirOf(df.side); qb.dizzy = 1; df.down = 0.6; Sound.tackle(); cam.shake = 8;
      }
      df.rtpChecked = true;
    }
  }
  // pass interference: ONLY when the ball is in the air to that receiver, he could have caught it, and you knocked him off it.
  // Going up for the ball yourself is legal. Bumping a guy before the throw (or one the ball isn't going to) is just a bump.
  const h = G.versus ? G.hp[1 - off] : G.humanPlayer;
  if (h && h.side !== off && (G.bstate === 'snap' || G.bstate === 'air') && h.down <= 0 && h.humanDriven) {
    const f = b.flight;
    for (const r of G.O) {
      if (!eligible(r) || r === b.holder || r.down > 0 || r.bumpCd > pl.t) continue;
      if (dist(h, r) > 0.95 || !(h.dive > 0 || h.speedNow > 7.5)) continue;
      const land = f && !f.pitch && !f.kick ? { x: f.tx, y: f.ty } : null;
      const target = land && f.intended === r && f.t / f.T > 0.3;
      const catchable = target && dist(r, land) < 3;
      const playingBall = h.jump > 0 && land && dist(h, land) <= dist(r, land) + 0.5;
      if (catchable && !playingBall && Sliders.call('pen')) {
        const x = dirOf(off) * (r.x - G.los) > 0 ? r.x : G.los;
        throwFlag('DPI', h.side, x, r.y, h);
        r.down = 0.9; r.downDir = dirOf(h.side); r.dizzy = 1; h.dive = 0; h.down = 0.5; Sound.tackle();
        break;
      }
      // legal contact: he stumbles a little, no flag
      r.stun = Math.max(r.stun, 0.25); r.bumpCd = pl.t + 0.8; r.vx *= 0.6; r.vy *= 0.6;
      addText(r.x, r.y, 'BUMPED', '#cfe3ff', 13, 0.5);
    }
  }
  // random holding on run plays
  if (pl.off.type === 'run' && !pl.holdRolled && pl.t > 0.7) {
    pl.holdRolled = true;
    if (chance(0.025 * Sliders.mul('pen'))) { const ol = pick(G.O.slice(5)); throwFlag('HOLD', off, ol.x, ol.y, ol); }
  }
  // illegal block in the back on a kick / punt return (rare): rolled once when the return gets going
  if ((G.special === 'ko' || G.special === 'punt') && G.bstate === 'run' && !pl.ibbRolled && G.retStart != null && b.holder && b.holder.side === off && Math.abs(b.holder.x - G.retStart) > 8) {
    pl.ibbRolled = true;
    const car = b.holder, bl = G.O.filter(p => p !== car && p.down <= 0 && G.D.some(c => dist(c, p) < 2.2));
    if (bl.length && chance(0.06)) { const p = pick(bl); throwFlag('IBB', off, p.x, p.y, p); }
  }
}

// ---------- penalty enforcement ----------
function enforcePenalty(res) {
  const f = G.flags[0], F = FOULS[f.type], off = G.poss, d = dirOf(off);
  const car = res.carrier, cs = car ? car.side : off;
  const turnover = cs !== off && res.type !== 'inc';
  const td = res.type === 'td' && cs === off;
  const resX = (res.type === 'inc' || turnover) ? G.los : (res.x != null ? res.x : G.los);
  const toGoal = d * (goalX(off) - G.los);
  let accept = true, newLos = G.los, autoFirst = false;
  if (F.def) {
    if (td) accept = false;
    else if (f.type === 'DPI') {
      let spot = f.x; if (d * (spot - G.los) < 5) spot = G.los + d * Math.min(5, toGoal / 2);
      if (d * (goalX(off) - spot) < 1) spot = goalX(off) - d * 1;
      newLos = spot; autoFirst = true; accept = turnover || d * (spot - resX) >= 0;
    } else if (f.type === 'RTP') {
      const base = (turnover || res.type === 'inc' || res.type === 'sack') ? G.los : resX;
      newLos = base + d * Math.min(15, d * (goalX(off) - base) / 2); autoFirst = true;
    } else if (f.type === 'OFFSIDE') {
      newLos = G.los + d * Math.min(5, toGoal / 2); accept = turnover || d * (resX - G.los) < 5;
    } else if (f.type === 'FACEMASK') { // from the end of the run (or the line if he was stopped behind it)
      const base = d * (resX - G.los) > 0 ? resX : G.los;
      newLos = base + d * Math.min(15, d * (goalX(off) - base) / 2); autoFirst = true;
    }
  } else if (f.type === 'GROUND') { // intentional grounding: the spot of the pass (at least 10 back) and the down is lost
    const ten = G.los - d * Math.min(10, d * (G.los - ownGoal(off)) / 2);
    newLos = d * (f.x - ten) < 0 ? f.x : ten; accept = !turnover;
  } else { // offense fouled
    newLos = G.los - d * Math.min(10, d * (G.los - ownGoal(off)) / 2);
    accept = !turnover && (td || res.type === 'inc' || d * (resX - G.los) > -10);
  }
  G.flags = [];
  const who = `${G.teams[f.side].name}${f.num != null ? ' #' + f.num : ''}`;
  if (!accept) { G.flagNote = `FLAG: ${F.name}, DECLINED`; addPbp(`Penalty on ${who}: ${F.name.toLowerCase()}, declined.`); return false; }
  addPbp(`PENALTY on ${who}: ${F.name.toLowerCase()}. ${F.text.replace(/ • /g, ', ')}.`);
  G.next = null; G.runoff = 0; G.deadT = 2.4;
  showBanner(F.name, `${who} • ${F.text}`, '#ffe14d', 2.4);
  Sound.whistle();
  refSignal(F.name);
  if (f.type === 'GROUND') {
    if (d * (newLos - ownGoal(off)) <= 0) { G.score[1 - off] += 2; showBanner('SAFETY!', 'Intentional grounding in the end zone', '#ff6040', 2.4); G.next = { kickoff: off, from: 20 }; return true; }
    G.los = clamp(newLos, 11, 109);
    if (++G.down > 4) { showBanner('TURNOVER ON DOWNS', 'Intentional grounding on 4th down', '#ff9a3d', 2.4); G.next = { drive: 1 - off, x: G.los }; }
    return true;
  }
  G.los = clamp(newLos, 11, 109);
  if (autoFirst || d * (G.los - G.firstDownX) >= 0) { G.down = 1; setFirstDown(); }
  else if (!F.def) { /* same down, longer to go */ }
  return true;
}

function delayOfGame() {
  const d = dirOf(G.poss);
  G.pendingRunoff = 0; // penalty stops the clock
  G.los = clamp(G.los - d * Math.min(5, d * (G.los - ownGoal(G.poss)) / 2), 11, 109);
  showBanner('DELAY OF GAME', `${G.teams[G.poss].name} • 5 yards • Replay the down`, '#ffe14d', 2.2);
  addPbp(`Delay of game on ${G.teams[G.poss].name}, 5 yards.`);
  Sound.whistle();
  const f = { kind: 'flag', ax: G.los - d * 10, ay: MID + 6, x: G.los, y: G.ballY, t: 0, T: 0.55, z: 0, vz: 0, life: 2.5, max: 2.5 };
  toPlayCall(); G.fx.push(f);
}
// the ref's signal: his arms go up and the call floats over his head
function refSignal(text) {
  const r = G.refs && G.refs[0]; if (!r) return;
  r.throwT = 0.5; addText(r.x, r.y, text, '#ffe14d', 14, 1.8);
}
// false start: a lineman flinches before the snap. Dead ball, 5 yards, same down (crowd = the road crowd got him)
function falseStart(crowd) {
  const d = dirOf(G.poss), ol = pick(G.O.slice(5)), who = `${G.teams[G.poss].name} #${ol.num}`;
  ol.x += d * 0.8; addText(ol.x, ol.y, 'FALSE START', '#ffe14d', 16, 1.2);
  G.los = clamp(G.los - d * Math.min(5, d * (G.los - ownGoal(G.poss)) / 2), 11, 109);
  showBanner('FALSE START', `${who} • 5 yards • Replay ${ordinal(G.down)} down${crowd ? '  •  Crowd noise' : ''}`, '#ffe14d', 2.2);
  addPbp(`False start on ${who}, 5 yards.${crowd ? ' The crowd got to them.' : ''}`);
  Sound.whistle();
  const f = { kind: 'flag', ax: G.los - d * 10, ay: MID + 6, x: G.los, y: G.ballY, t: 0, T: 0.55, z: 0, vz: 0, life: 2.5, max: 2.5 };
  toPlayCall(); G.fx.push(f); refSignal('FALSE START');
}
// rolled at the snap: rare for anybody, more on 3rd down on the road in a loud place (crowd.js)
function falseStartRoll() {
  if (G.twoPt || G.mini || G.demo || G.special || G.fake || G.play.off.kneel || G.fakeSpike || G.patSide != null || (typeof Tutorial !== 'undefined' && Tutorial.active)) return false;
  const cr = typeof Crowd !== 'undefined' ? Crowd.falseStart() : 0;
  const base = isHumanSide(G.poss) ? 0 : 0.004;
  if (!chance(base + cr)) return false;
  falseStart(cr > 0 && chance(cr / (base + cr)));
  return true;
}

// screen drag vector -> where the ball lands (pull back further = throw further)
function aimTarget(qb, vx, vy) {
  const k = 3.3;
  return { x: clamp(qb.x + vx / PX * k, -2, 122), y: clamp(qb.y + vy / PX * k * 1.6, 0, FIELD_W) };
}
function eligible(r) {
  if (!r || r.slot < 0 || r.slot > 4 || r === G.trickPasser || (G.ball && r === G.ball.holder)) return false;
  if (r.slot === 0) return r.role === 'route'; // Philly Special: the QB is a receiver
  if (r.role === 'route' || (r.slot === (G.play.off.screenTo || 1) && G.play.off.screen)) return true;
  return false;
}
function openness(r) {
  let m = 99;
  for (const d of G.D) if (!d.engaged && d.down <= 0) m = Math.min(m, dist(r, d));
  return m;
}
// which receiver's throw icon is under this screen point
function iconAt(x, y) {
  let best = null, bd = 60;
  for (const r of G.O) if (r.throwKey) { const dd = Math.min(Math.hypot(sx(r.x) - x, sy(r.y) - 40 * viewZ - y), Math.hypot(sx(r.x) - x, sy(r.y) - 28 - 92 * viewZ - y)); if (dd < bd) { bd = dd; best = r; } } // (the icon is over his head: lower when zoomed out)
  return best;
}
function humanCanThrow() {
  const b = G.ball, qb = curPasser(), off = G.play && G.play.off;
  if (!qb || !off || off.noThrow || trickBusy()) return false;
  const passing = G.trickPasser || G.rpoKeep || (off.rpo && !G.handedOff) || (G.passPlay !== false && off.type === 'pass');
  return G.phase === 'live' && G.bstate === 'snap' && b.holder === qb && qb.isHuman && passing &&
    dirOf(G.poss) * (qb.x - G.los) < 0.5 && !G.humanScramble;
}
// who throws it: the QB, or on a trick play the RB / WR who ends up with it
function curPasser() { return G.trickPasser || (G.O && G.O[0]); }
// a trick play is still handing / pitching the ball around (nobody throws, the AI runs it)
function trickBusy() {
  const ch = G.play && G.play.off && G.play.off.chain;
  return !!ch && (G.trickI || 0) < ch.length && (G.bstate === 'snap' || G.bstate === 'air');
}
// does p still get the ball later in this trick play?
function trickWaits(p) {
  const ch = G.play.off.chain; if (!ch) return false;
  for (let k = G.trickI || 0; k < ch.length; k++) if (G.O[ch[k].to] === p) return true;
  return false;
}
// next exchange of a trick play: handoff when they're close enough, otherwise a quick pitch
function trickStep(pl) {
  const ch = pl.off.chain, b = G.ball, k = G.trickI || 0;
  if (k >= ch.length || G.bstate !== 'snap' || !b.holder || b.flight || b.loose) return;
  const st = ch[k], from = b.holder, to = G.O[st.to];
  if (from.side !== G.poss || from === to || from.down > 0) return;
  if (st.pump && !G.pumped && pl.t >= st.pump) { G.pumped = true; G.pumpAt = pl.t; from.throwAnim = 0.35; from.mouth = 'O'; from.mouthT = 0.4; addText(from.x, from.y - 2, 'PUMP FAKE', '#7fd3ff', 15, 0.7); }
  if (pl.t < st.at || (to.down > 0 && pl.t < st.at + 1)) return;
  const close = dist(from, to) < 1.7;
  if (st.kind === 'hand' && !close && pl.t < st.at + 0.7) return; // give him a moment to get there
  G.trickI = k + 1; G.handedOff = true; G.trickFrom = from;
  if (st.kind === 'hand' && close) { b.holder = to; Sound.tone(300, 0.06, 'triangle', 0.06); trickGot(to, st); }
  else { throwTo(from, to, true); if (b.flight) { b.flight.trick = st; b.flight.shovel = st.kind === 'shovel'; } if (st.kind === 'shovel') { from.throwAnim = 0.25; addText(from.x, from.y - 2, 'SHOVEL!', '#7fd3ff', 15, 0.6); } }
}
// the ball got to the next guy in a trick play
function trickGot(p, st) {
  if (st.run) { G.decoy = st.decoy != null ? G.O[st.decoy] : G.trickFrom; G.fooledT = G.play.t + 0.8; G.bstate = 'run'; G.credit = { p, kind: 'rush' }; stat(p); return; }
  G.bstate = 'snap'; G.credit = p === G.O[0] ? null : { p, kind: 'rush' };
  if (st.pass) { G.trickPasser = p; G.trickT = G.play.t; G.trickMinT = st.minT || 0; G.passPlay = true; G.qbScramble = false; if (p !== G.O[0]) addText(p.x, p.y - 2, 'HE CAN THROW!', '#7fd3ff', 15, 0.9); }
}
// hook and lateral: the hook guy catches it, the trailer swings by and gets the pitch
function lateralStep(pl) {
  const L = pl.off.lateral, b = G.ball, car = b.holder;
  if (G.latDone || G.bstate !== 'run' || !car || car !== G.O[L.from] || !G.credit || G.credit.kind !== 'rec') return;
  if (G.catchT == null) G.catchT = pl.t;
  const tr = G.O[L.to], d = dirOf(G.poss);
  if (pl.t - G.catchT > 1.8) { G.latDone = true; return; }
  if (tr.down > 0 || car.down > 0 || pl.t - G.catchT < 0.25) return;
  if (dist(tr, car) < 8 && d * (tr.x - car.x) < 0.3) {
    G.latDone = true; throwTo(car, tr, true);
    if (b.flight) b.flight.lateral = true;
    car.throwAnim = 0.25; addText(car.x, car.y - 2, 'LATERAL!', '#7fd3ff', 18, 0.8);
  }
}
// RPO read: a loaded box or a linebacker crashing on the run = pull it and throw; otherwise hand it off
function rpoRead() {
  const d = dirOf(G.poss), by = G.ballY, sl = G.O[4];
  let box = 0, crash = false;
  for (const df of G.D) {
    if (df.pos === 'DL' || df.down > 0) continue;
    if (d * (df.x - G.los) < 7 && Math.abs(df.y - by) < 7) box++;
    if (df.slot >= 3 && df.slot <= 4 && Math.abs(df.y - sl.y) < 12 && -d * df.vx > 2.5) crash = true;
  }
  if (openness(sl) < 2.2) return chance(0.1); // the bubble is covered: give it
  return chance(box >= 3 || crash ? 0.85 : 0.15);
}

// who the human is driving right now
function updateHuman() {
  for (const p of G.players) p.isHuman = false;
  G.humanPlayer = null;
  if (!G.ball || G.human < 0) return;
  if (G.versus) {
    const hs = [0, 1].map(s => withSide(s, humanFor));
    hs.forEach((h, s) => { if (h) { h.isHuman = true; h.ctl = s === G.p1 ? 0 : 1; } });
    G.hp = hs; G.humanPlayer = hs[G.human];
    return;
  }
  if (coachOn()) return; // Coach Mode: the CPU plays everybody
  const h = G.lock ? lockedGuy() || (G.sitOut || G.special ? null : humanFor()) : humanFor();
  if (h) h.isHuman = true;
  G.humanPlayer = h;
}
// Player Lock (career): you only ever control your own player
// a WR can't play defense (and a CB can't play offense): when your guy's side of the ball is off the field, you watch. A two-way guy never sits
function lockSitsOut() {
  if (!G.lock || G.versus || G.online || G.mini || !G.teams || G.human < 0) return false;
  const t = G.teams[G.human], isCap = p => p && p[6] && p[6].cap;
  if (!t.off.concat(t.def).some(isCap)) return false;
  return !(G.poss === G.human ? t.off : t.def).some(isCap);
}
function lockedGuy() { return G.players.find(p => p.cap && p.side === G.human && p.down <= 0) || G.players.find(p => p.cap && p.side === G.human); }
// career receiver / back: ask the QB for the ball
function callForBall(p) {
  if (G.callBall > 0) return;
  G.callBall = 1.4; addText(p.x, p.y - 1.5, "I'M OPEN!", '#ffe14d', 16, 0.9); Sound.click();
}
function humanFor() {
  let h = null;
  const b = G.ball;
  if ((G.phase === 'kickmeter' || G.phase === 'playcall') && G.km && G.km.live && G.km.live.punt && G.km.live.kicked == null) return G.humanDef && G.humanDef.side === G.human ? G.humanDef : null; // live punt: the guy you picked (special.js)
  if (G.special === 'fgblock' && !b.holder && G.humanDef && G.humanDef.side === G.human) return G.humanDef; // blocked kick on the ground: the guy closest to it
  if (G.poss === G.human) {
    if (b.holder && b.holder.side === G.human) h = b.holder;
    else if (b.flight && b.flight.intended && b.flight.intended.side === G.human && !b.flight.pitch) h = b.flight.intended;
    else if (b.holder && b.holder.side !== G.human) h = nearestTo(G.O.filter(p => p.side === G.human), b.holder) || G.humanDef;
    else h = b.flight && b.flight.pitch ? b.flight.intended : G.O[0];
    if (b.holder && b.holder.side !== G.human) { // turnover: switch to a tackler
      if (!G.humanDef || G.humanDef.side !== G.human) G.humanDef = nearestTo(G.O, b.holder);
      h = G.humanDef;
    }
  } else {
    if (b.holder && b.holder.side === G.human) h = b.holder; // you picked it off!
    else h = G.humanDef;
  }
  return h;
}
// before the snap: cycle through every defender so you can pick a pass rusher
function presnapSwitch() {
  if (G.lock && lockedGuy()) return; // your guy is on the field: no switching
  const order = [3, 4, 0, 1, 2, 5, 6, 7].map(i => G.D[i]);
  const i = order.indexOf(G.humanDef);
  G.humanDef = order[(i + 1) % order.length]; Sound.click(); updateHuman();
  G.snapTimer = Math.max(G.snapTimer, 0.6);
}
function nearestTo(list, t) { let best = null, bd = 1e9; for (const p of list) { const d = dist(p, t); if (d < bd && p.down <= 0) { bd = d; best = p; } } return best; }
function cycleHumanDef() {
  if (G.lock && lockedGuy()) return;
  const b = G.ball; const target = b.holder || b;
  const pool = G.players.filter(p => p.side === G.human && p !== G.humanDef && !(b.holder === p));
  const n = nearestTo(pool, target.flight ? { x: target.flight.tx, y: target.flight.ty } : target);
  if (n) { G.humanDef = n; Sound.click(); }
}

// returns true if human input drove this player
function humanControl(p, dt) {
  const b = G.ball;
  const isCarrier = b.holder === p;
  if (!isCarrier && b.flight && b.flight.kick === 'punt') puntRetInput(p); // fair catch (special.js)
  if (trickBusy() && (isCarrier || trickWaits(p))) return false; // trick play: the handoffs / pitches run themselves, you get him when he can throw or run
  if (Input.hit('KeyQ') && !isCarrier) { cycleHumanDef(); }
  if (isCarrier && Input.hit('KeyG') && G.bstate !== 'snap') toggleTuck(p);
  if (ctlMobile()) return mobileControl(p, dt, isCarrier);
  const ax = Input.axis();
  const sprint = Input.held('ShiftLeft') && p.stamina > 0.05;
  if (sprint && ax.m > 0.1) p.stamina = Math.max(0, p.stamina - dt * 0.42); else p.stamina = Math.min(1, p.stamina + dt * 0.18);
  p.sprinting = sprint && ax.m > 0.1;
  const mul = (sprint ? sprintBoost(p) : 1) * (p.spin > 0 ? 0.8 : 1) * (p.stamina < 0.2 ? 0.9 : 1); // same top speed as the AI, sprint is your edge
  if (isCarrier) {
    if (Input.hit('KeyE') && p.jukeCd <= 0 && G.bstate !== 'snap' && !p.tuck) doJuke(p, ax);
    if (Input.hit('KeyF') && p.spinCd <= 0 && G.bstate !== 'snap' && !p.tuck) doSpin(p);
    if (Input.hit('KeyR') && p.stiffCd <= 0) doStiff(p);
  }
  const chasing = b.holder ? b.holder.side !== p.side : p.side !== G.poss;
  if (G.lock && !isCarrier && !chasing && p !== G.O[0] && G.bstate === 'snap' && !b.flight && Input.hit('Space')) callForBall(p);
  if (!isCarrier && !chasing && b.flight && !b.flight.pitch) catchHold(p, Input.held('Space'));
  if (!isCarrier && chasing && b.flight && !b.flight.pitch && Input.hit('Space')) { flightPress(p, 'def'); doJump(p); }
  else if (!isCarrier && chasing && Input.hit('Space') && p.dive <= 0) { doDive(p, ax); return true; }
  if (!isCarrier && p.engaged && Input.hit('KeyE')) doSwim(p);
  if (!isCarrier && chasing && Input.hit('KeyC')) doHitStick(p);
  if (p.hit > 0) return true;
  if (p.jump > 0 && b.flight && ax.m < 0.1) { steer(p, b.flight.tx, b.flight.ty, 1.08, 0.2); return true; }
  if (ax.m < 0.1 && isCarrier && G.humanScramble && p === curPasser()) { aiRunner(p, dt); return true; }
  // under center: the QB takes his drop on his own until you grab the controls (a bootleg rolls him out)
  if (ax.m < 0.1 && isCarrier && p === G.O[0] && G.bstate === 'snap' && G.play.form && G.play.form.under && G.play.off.type === 'pass' && G.play.t < (G.play.off.boot ? 1.5 : 0.9)) { aiQBMove(p, dt); return true; }
  if (ax.m < 0.1 && isCarrier && p === G.trickPasser && p !== G.O[0] && G.bstate === 'snap') return false; // trick passer keeps drifting on his path until you steer
  if (ax.m < 0.1) {
    if (!isCarrier && !(p === G.O[0] && G.bstate === 'snap')) { // idle defender / receiver: let AI help
      if (b.flight && b.flight.intended === p) { steer(p, b.flight.tx, b.flight.ty, 1); return true; }
      return false;
    }
    p.dvx = 0; p.dvy = 0; return true;
  }
  p.dvx = ax.x * p.spd * mul * ax.m; p.dvy = ax.y * p.spd * mul * ax.m;
  return true;
}

function mobileControl(p, dt, isCarrier) {
  const b = G.ball, P = Input.pointer;
  const qbHolding = p === curPasser() && G.bstate === 'snap' && b.holder === p && (p === G.O[0] || humanCanThrow());
  if (qbHolding && Input.hit('KeyX')) qbTakeOff(p);
  if (qbHolding && !G.humanScramble) { // QB moves himself in the pocket unless you slide him with the stick; you aim + throw on the field
    const st = Input.stick;
    if (st.m > 0.15 && isFinite(st.x) && isFinite(st.y)) { p.dvx = st.x * p.spd * 0.75; p.dvy = st.y * p.spd * 0.75; return true; }
    if (G.meter) { p.dvx = 0; p.dvy = 0; return true; } // charging a throw: he plants his feet (only the stick moves him)
    return false;
  }
  const onD = p.side !== G.poss || (b.holder && b.holder.side !== p.side);
  const inAir = !isCarrier && onD && b.flight && !b.flight.pitch;
  if (inAir && (Input.taps.length || Input.hit('Space'))) { flightPress(p, 'def'); doJump(p); Input.taps.length = 0; }
  if (!isCarrier && !onD && b.flight && !b.flight.pitch && b.flight.intended === p) {
    catchHold(p, Input.pointer.down || Input.held('Space')); Input.taps.length = 0;
    if (P.down && catchMeterOn()) P.noSteer = true; // that finger is the catch bar, not "run to here" (also after the catch until you lift it)
  }
  if (!isCarrier && p.engaged && Input.hit('KeyE')) doSwim(p);
  if (!isCarrier && onD && Input.hit('KeyC')) doHitStick(p);
  if (p.hit > 0) return true;
  // taps = moves
  for (const c of Input.taps) {
    if (G.lock && !isCarrier && !onD && p !== G.O[0] && G.bstate === 'snap' && !b.flight) { callForBall(p); continue; }
    if (isCarrier) { if (p.jukeCd <= 0) doJuke(p, { x: 0, y: wy(c.y) < p.y ? -1 : 1, m: 1 }); }
    else if (p.side !== G.poss || (b.holder && b.holder.side !== p.side)) {
      const w = { x: wx(c.x), y: wy(c.y) };
      const mate = G.players.find(q => q.side === p.side && q !== p && Math.hypot(q.x - w.x, q.y - w.y) < 2.5);
      if (mate) { G.humanDef = mate; Sound.click(); return true; }
      const car = b.holder;
      if (car && dist(p, car) < 4.5 && p.dive <= 0) { doDive(p, { x: car.x - p.x, y: car.y - p.y, m: 1 }); return true; }
      cycleHumanDef();
    }
  }
  if (isCarrier) {
    if (Input.hit('KeyF') && p.spinCd <= 0 && !p.tuck) doSpin(p);
    if (Input.hit('KeyR') && p.stiffCd <= 0) doStiff(p);
    if (Input.hit('KeyE') && p.jukeCd <= 0 && !p.tuck) doJuke(p, null);
  } else if (G.lock && !onD && p !== G.O[0] && Input.hit('Space')) { if (G.bstate === 'snap' && !b.flight) callForBall(p); }
  else if (!inAir && Input.hit('Space') && p.dive <= 0) { const car = b.holder || b; doDive(p, { x: car.x - p.x, y: car.y - p.y, m: 1 }); return true; }
  const sprint = p.stamina > 0.05;
  const st = Input.stick;
  if (st.m > 0.15 && isFinite(st.x) && isFinite(st.y)) { // joystick
    p.sprinting = st.m > 0.9 && sprint;
    if (p.sprinting) p.stamina = Math.max(0, p.stamina - dt * 0.42); else p.stamina = Math.min(1, p.stamina + dt * 0.18);
    const mul = (p.sprinting ? sprintBoost(p) : 1) * (p.spin > 0 ? 0.8 : 1);
    p.dvx = st.x * p.spd * mul; p.dvy = st.y * p.spd * mul;
    return true;
  }
  if (p.jump > 0 && b.flight) { steer(p, b.flight.tx, b.flight.ty, 1.08, 0.2); return true; }
  const held = P.down && !P.aiming && !P.noSteer && P.t > 0.12;
  if (held) {
    const tx = wx(P.x), ty = wy(P.y);
    if (sprint) p.stamina = Math.max(0, p.stamina - dt * 0.42);
    p.sprinting = sprint;
    steer(p, tx, ty, (sprint ? sprintBoost(p) : 1) * (p.spin > 0 ? 0.8 : 1), 0.4);
    return true;
  }
  p.stamina = Math.min(1, p.stamina + dt * 0.25);
  if (isCarrier) { aiRunner(p, dt); return true; } // auto-run forward, you steer by holding
  return false; // defenders: AI helps when you're not touching
}
function qbTakeOff(qb) {
  G.humanScramble = true; G.qbScramble = true; Sound.juke();
  addText(qb.x, qb.y, 'QB RUN!', '#7fd3ff', 22, 0.9);
  qb.vx += dirOf(qb.side) * 3;
}
// faster guys get a bigger burst: 99 SPD ≈ +18%, 80 ≈ +11%, 65 ≈ +6%
function sprintBoost(p) { return 1.0 + clamp((p.spdR || 80) - 50, 0, 50) * 0.002; }
function doStiff(p) { p.stiff = 0.4; p.stiffCd = 1.4; Sound.tone(160, 0.12, 'sawtooth', 0.08); }
function doJuke(p, ax) {
  if (p.tuck) return;
  if (chance(Weather.slipChance())) { slipDown(p); p.jukeCd = 1; return; }
  const sp = Math.hypot(p.vx, p.vy) || 1;
  let fx = p.vx / sp, fy = p.vy / sp;
  if (sp < 1) { fx = dirOf(p.side); fy = 0; }
  let side = (ax && Math.abs(-fy * ax.x + fx * ax.y) > 0.2) ? Math.sign(-fy * ax.x + fx * ax.y) : (p.lastJuke = -(p.lastJuke || 1));
  const px = -fy * side, py = fx * side;
  p.vx = px * p.spd * 1.15 + fx * p.spd * 0.35; p.vy = py * p.spd * 1.15 + fy * p.spd * 0.35;
  p.juke = 0.3; p.jukeCd = 1.0; Sound.juke(); addDust(p.x, p.y, 3);
  p.head.vx += side * 260;
}
function doJump(p) {
  if (p.jump > 0 || p.jumpCd > 0 || p.down > 0) return;
  p.jump = 0.55; p.jumpCd = 1.2; Sound.boing();
  addText(p.x, p.y, 'JUMP!', '#7fd3ff', 16, 0.6);
}
function doHitStick(p) {
  if (p.hitCd > 0 || p.down > 0) return;
  const car = G.ball.holder; if (!car || car.side === p.side) return;
  const dd = dist(p, car); if (dd > 3.5) { addText(p.x, p.y, 'TOO FAR', '#ccc', 13, 0.5); return; }
  p.hit = 0.28; p.hitCd = 1.6;
  const dx = car.x + car.vx * 0.15 - p.x, dy = car.y + car.vy * 0.15 - p.y, m = Math.hypot(dx, dy) || 1;
  p.vx = dx / m * p.spd * 1.7; p.vy = dy / m * p.spd * 1.7; p.dvx = p.vx; p.dvy = p.vy;
  Sound.tone(220, 0.15, 'sawtooth', 0.1, 200);
}
function doSwim(p) {
  if (p.swimCd > 0 || !p.engaged) return;
  const rel = xfOn(p, 'relentless'), sw = abHas(p, 'swim'); p.swimCd = rel ? 0.4 : sw ? 0.9 : 1.2; // Relentless: rush moves are free
  const bl = p.engaged;
  if (chance(clamp(0.45 + (rat(p, 'PRS') - rat(bl, 'PBK')) / 90 + (rel ? 0.2 : 0) + (sw ? 0.1 : 0), 0.2, 0.9))) {
    unlink(bl, p); p.shedCd = 0.8; bl.stun = 0.7; bl.head.vx += 250;
    addText(p.x, p.y, 'SWIM MOVE!', '#ff8a8a', 18, 0.7); Sound.juke();
  } else addText(p.x, p.y, 'STUFFED', '#ccc', 14, 0.6);
}
function doSpin(p) {
  if (p.tuck) return; p.spin = 0.45; p.spinCd = 1.4; Sound.juke(); p.head.vx += 300; }
function doDive(p, ax) {
  const b = G.ball; const t = b.holder || b;
  let dx = ax.m > 0.1 ? ax.x : t.x - p.x, dy = ax.m > 0.1 ? ax.y : t.y - p.y;
  const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
  p.dive = 0.32; p.vx = dx * p.spd * 1.55; p.vy = dy * p.spd * 1.55; p.dvx = p.vx; p.dvy = p.vy; p.downDir = dx >= 0 ? 1 : -1;
  Sound.boing();
}

// ---------------- AI ----------------
function steer(p, tx, ty, mul = 1, arrive = 1.0) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 0.05) { p.dvx = p.dvy = 0; return; }
  const sp = p.spd * mul * Math.min(1, d / arrive);
  p.dvx = dx / d * sp; p.dvy = dy / d * sp;
}

function ai(p, dt) {
  const b = G.ball, d = dirOf(G.poss);
  const carrier = b.holder;
  // ---- after a catch / handoff / turnover: everyone either blocks or chases ----
  if (G.bstate === 'run' || (carrier && carrier.side !== G.poss)) {
    if (carrier === p) return aiRunner(p, dt);
    const lat = G.play.off.lateral;
    if (lat && !G.latDone && p === G.O[lat.to] && carrier === G.O[lat.from]) return steer(p, carrier.x - d * 1.3, carrier.y + (carrier.y < MID ? 3.2 : -3.2), 1.05, 0.2); // trail him for the pitch
    if (carrier && p.side === carrier.side) return p.role === 'stalk' && G.play.off.jet && screenMan() ? stalk(p, 8) : aiEscort(p, carrier); // jet: the receivers hold their blocks on the edge
    if (G.decoy && !p.off && G.decoy !== carrier && G.play.t < G.fooledT - (p.bite ? 0 : G.play.def.disc ? 9 : 0.45) && dist(p, carrier) > 3 && !(p.assign && p.assign.type === 'man' && G.O[p.assign.t] === carrier)) return pursue(p, G.decoy); // fooled: still chasing the fake
    // run fits: until he reads it, a back-seven defender fills his gap at the line instead of beelining to the ball
    const wide = G.play.off.toss || G.play.off.jet || G.play.off.wide;
    if (carrier && !p.off && p.pos !== 'DL' && runT() >= 0 && runT() < readTime(p) - (wide ? 0.25 : 0) + 0.15 && d * (carrier.x - G.los) < 0 && dist(p, carrier) > 2.2) {
      // inside runs: fill your gap. Sweeps/tosses: flow outside with him and keep him from turning the corner
      if (wide) return steer(p, G.los + d * 2.5, carrier.y + Math.sign(carrier.y - G.ballY || 1) * 2.5, 1.0, 0.3);
      return steer(p, G.los + d * 1.2, lerp(p.y, carrier.y, 0.45), 0.85, 0.4);
    }
    if (carrier) return pursue(p, carrier);
  }
  if (b.loose) { const l = b.loose, k = l.blk ? 0.35 : 0; steer(p, b.x + l.vx * k, b.y + l.vy * k, 1.05); return; } // a bouncing blocked kick: go where it's headed
  if (b.flight && b.flight.kick) return aiKickFlight(p);

  if (p.off && b.flight && b.flight.intended === p && !b.flight.pitch) { steer(p, b.flight.tx, b.flight.ty, 1, 0.25); return; }
  if (p.off && p === carrier && p !== G.O[0] && G.qbScramble) return aiRunner(p, dt); // trick passer gives up on the throw and runs
  if (p.off) {
    switch (p.role) {
      case 'qb': return aiQBMove(p, dt);
      case 'route': return followRoute(p, dt);
      case 'runpath': return followRoute(p, dt);
      case 'passblock': return passBlock(p);
      case 'runblock': return G.play.off.draw && G.drawAt == null ? passBlock(p) : runBlock(p); // draw: pass set first, sell it
      case 'screenblock': return screenBlock(p);
      case 'lead': if (G.play.off.draw) return G.drawAt == null ? drawPickup(p) : aiEscort(p, G.O[0]);
        return G.handedOff && G.ball.holder && G.play.t > 0.7 ? aiEscort(p, G.ball.holder) : followRoute(p, dt);
      case 'stalk': return (p.route && p.route.i < p.route.pts.length && G.play.t < 1.2) ? followRoute(p, dt) : stalk(p, 8);
      default: p.dvx = p.dvy = 0;
    }
    return;
  }
  // ---- defense before the ball is caught / handed off ----
  const qb = G.O[0];
  const a = p.assign;
  // screen: it takes the coverage a beat after the throw to see it ("SCREEN!") and come up
  const scrLate = G.play.off.screen && b.flight && !b.flight.pitch && b.flight.intended.slot === (G.play.off.screenTo || 1) && G.play.t - (G.throwT || 0) < 0.35 && !(a.type === 'man' && G.O[a.t] === b.flight.intended);
  if (b.flight && !b.flight.pitch) {
    const f = b.flight, land = { x: f.tx, y: f.ty };
    const tgt = f.intended;
    const near = dist(p, land) < 19 || (a.type === 'man' && G.O[a.t] === tgt);
    if (near && a.type !== 'rush' && !scrLate) {
      const ttl = f.T - f.t;
      const reach = p.spd * ttl;
      // sometimes a defender leaps for it
      if (!p.isHuman && !p.jumpTried && dist(p, land) < 2.2 && ttl < 0.4) { p.jumpTried = true; if (chance([0.04, 0.07, 0.1, 0.15][G.diff])) doJump(p); }
      if (dist(p, land) <= reach + 2.2) steer(p, land.x, land.y, 1.1, 0.3);
      else steer(p, lerp(tgt.x, land.x, 0.6), lerp(tgt.y, land.y, 0.6), 1.12);
      return;
    }
    if (a.type === 'rush') { steer(p, land.x, land.y, 0.6); return; }
  }
  if (b.flight && b.flight.pitch) return pursue(p, b.flight.intended);
  if (G.bite && p.bite && carrier) { // bit on the trick play's fake: crash the line to fill against the run
    if (dist(p, carrier) < 3.5) return pursue(p, carrier);
    return steer(p, G.los + d * 0.6, lerp(p.y, carrier.y, 0.8), 1.0, 0.4);
  }
  const holder = carrier || qb;
  switch (a.type) {
    case 'rush': if (G.play.off.draw && runT() < readTime(p) && holder === qb) { steer(p, G.los - d * 6.5, holder.y + (Math.sign(p.hy - G.ballY) || 1) * 1.9, 0.97, 0.2); break; } // draw: rushers fly upfield at the pass drop and run past him
      steer(p, holder.x, holder.y, (p.pos === 'DL' ? 0.95 : 0.97) * (G.play.t < 0.45 ? 0.55 : 1) * (G.poss === G.human && !G.versus ? [0.88, 0.94, 1, 1.06][G.diff] : 1), 0.2); break;
    case 'spy': {
      if (G.qbScramble || d * (holder.x - G.los) > 0) return pursue(p, holder);
      steer(p, G.los + d * 5, lerp(p.y, holder.y, 0.6), 0.8); break;
    }
    case 'man': {
      const t = G.O[a.t];
      if (!eligible(t) && G.play.t > readTime(p)) { // target stayed in to block: go get the QB
        if (runT() >= 0) return pursue(p, carrier || G.O[1]);
        steer(p, G.los + d * 4, lerp(p.y, holder.y, 0.5), 0.8); break;
      }
      const lag = 0.07 + (99 - rat(p, 'COV')) * 0.0025;
      const old = pastOf(t, lag);
      const tx = old.x + old.vx * lag * 0.8 + d * 0.9, ty = old.y + old.vy * lag * 0.8;
      steer(p, tx, ty, 1.08, 0.4);
      break;
    }
    case 'zone': {
      const zx = G.los + d * a.d, zy = zoneY(a.y);
      if (G.play.def.disc && a.d <= 3) { // contain: hold the edge, only take on a runner who comes your way
        if (carrier && carrier !== qb && dist(p, carrier) < 7) return pursue(p, carrier);
        steer(p, zx, zy, 0.9, 0.6); break;
      }
      let threat = null, td = 9.5;
      for (const r of G.O) {
        if (!eligible(r)) continue;
        const dd = Math.hypot(r.x - zx, r.y - zy);
        if (dd < td) { td = dd; threat = r; }
      }
      // deep zones never let anyone get behind them: stay on top of the deepest guy in your half
      const deepTh = a.d >= 12 ? deepestIn(zy, a.d >= 14 ? 14 : 8, G.los + d * (a.d - 6)) : null;
      // short zones "carry" a receiver running straight past them (sideline or seam) when no deep help is over there
      let carry = !deepTh && a.d <= 8 ? deepestIn(zy, a.y === 'edgeT' || a.y === 'edgeB' ? 7 : 6, p.x - d * 2) : null;
      if (carry && d * (carry.x - G.los) < 6 && d * carry.vx < 4) carry = null; // only carry guys who are actually going deep
      if (deepTh) steer(p, deepTh.x + d * 2.5, clamp(deepTh.y, zy - 14, zy + 14), 1, 0.4);
      else if (carry && !deepHelp(carry, p) && d * (carry.x - G.los) < 26) steer(p, carry.x + d * 2, carry.y + (carry.y < MID ? 0.8 : -0.8), 1, 0.4);
      else if (threat) {
        const fooled = G.play.off.screen && threat.slot === (G.play.off.screenTo || 1) && (!b.flight || scrLate) ? 3 : 7; // a screen: zone guys keep dropping, they don't jump the man behind the line yet
        const tx = clamp(threat.x + d * 1.5, Math.min(zx - d * fooled, zx + 7 * d), Math.max(zx - d * fooled, zx + 7 * d));
        const ty = clamp(threat.y, zy - 7, zy + 7);
        steer(p, tx, ty, 1.03, 0.5);
      } else steer(p, zx, lerp(zy, holder.y, 0.25), 0.8, 1.2);
      // read run
      if (runT() > readTime(p)) return pursue(p, carrier || G.O[1]);
      break;
    }
  }
  if (G.qbScramble && dist(p, holder) < 9) pursue(p, holder);
}

// deepest receiver within `w` yards (sideways) of lane y, past depth x0
function deepestIn(y, w, x0) {
  const d = dirOf(G.poss); let best = null;
  for (const r of G.O) { if (!eligible(r) || Math.abs(r.y - y) > w || d * (r.x - x0) < 0) continue; if (!best || d * (r.x - best.x) > 0) best = r; }
  return best;
}
// is another defender (not p) already over the top of receiver r?
function deepHelp(r, p) {
  const d = dirOf(G.poss);
  return G.D.some(df => df !== p && df.assign.type === 'zone' && df.assign.d >= 12 && d * (df.x - r.x) > -1 && Math.abs(df.y - r.y) < 9);
}
// where a player was `ago` seconds back (for late reactions)
// how long a defender takes to diagnose a run (better players read it faster)
// how long the run has been showing (-1 = still looks like a pass): a draw looks like a pass until the QB takes off
function runT() { const o = G.play.off; return o.type !== 'run' ? -1 : o.draw ? (G.drawAt != null ? G.play.t - G.drawAt + 0.3 : -1) : G.play.t; }
function readTime(p) { return 0.55 + clamp(92 - rat(p, 'AWR'), 0, 30) * 0.018 + (p.isHuman ? 0 : 0.1); }
function pastOf(p, ago) {
  const h = p.hist; if (!h || !h.length) return { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
  const want = G.play.t - ago;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= want) return h[i];
  return h[0];
}
function pursue(p, t) {
  if (!t) return;
  const dd = dist(p, t);
  // aim for the spot where we can cut him off (pursuit angle)
  const sp = p.spd * (G.play.off.type === 'run' ? 1.05 : 1.12), rx = t.x - p.x, ry = t.y - p.y;
  const a = t.vx * t.vx + t.vy * t.vy - sp * sp, bq = 2 * (rx * t.vx + ry * t.vy), c = rx * rx + ry * ry;
  let T = dd / sp * 0.5;
  const disc = bq * bq - 4 * a * c;
  if (Math.abs(a) > 1e-3 && disc >= 0) { const r1 = (-bq - Math.sqrt(disc)) / (2 * a), r2 = (-bq + Math.sqrt(disc)) / (2 * a); const r = [r1, r2].filter(v => v > 0).sort((x, y) => x - y)[0]; if (r != null) T = r; }
  T = Math.min(T, 1.6);
  steer(p, t.x + t.vx * T, t.y + t.vy * T, (G.play.off.type === 'run' ? 1.05 : 1.12) * (t.isHuman && !G.versus ? 1.06 : 1), 0.1); // you dodge better than the AI, so they chase harder
  // AI dive at the ball carrier
  if (!p.isHuman && dd < 1.7 && dd > 0.85 && p.dive <= 0 && t === G.ball.holder && chance(0.035)) {
    doDive(p, { x: t.x + t.vx * 0.15 - p.x, y: t.y + t.vy * 0.15 - p.y, m: 1 });
  }
}

function aiQBMove(p, dt) {
  const d = dirOf(G.poss), pl = G.play;
  if (G.ball.holder !== p) { // handed it off / threw it: drift (flea flicker: get back for the pitch)
    if (pl.off.chain && trickWaits(p)) { steer(p, G.los - d * 7, lerp(p.y, G.ballY, 0.5), 0.6, 0.6); return; }
    steer(p, p.x + d * 2, p.y, 0.4); return;
  }
  if (pl.off.chain && trickBusy()) { // trick play handoff coming up: go meet him
    const st = pl.off.chain[G.trickI], c = G.O[st.to];
    if (st.kind === 'hand' && !st.pump && pl.t > st.at - 0.55 && dist(p, c) < 4.5) { steer(p, c.x - d * 0.6, c.y - Math.sign(c.y - p.y) * 0.9, 0.9, 0.3); return; }
  }
  if (pl.off.draw && pl.t < 0.5) { steer(p, G.los - d * 5, G.ballY, 0.35, 0.6); return; } // draw: show pass for a beat
  if (pl.off.qbRun && pl.t > (pl.off.sneak ? 0.05 : 0.35)) { G.qbScramble = true; return aiRunner(p, dt); }
  if (G.qbScramble) return aiRunner(p, dt);
  if (pl.off.type === 'run') {
    if (pl.off.jet && !G.handedOff) { const c = G.O[pl.off.carrier]; steer(p, c.x - d * 0.6, c.y - Math.sign(c.y - p.y) * 0.9, 0.9, 0.3); return; } // meet the jet guy
    steer(p, G.los - d * 4.5, G.ballY, 0.4); return;
  }
  const depth = pl.off.drop || (pl.off.fake ? 6.5 : 5.8);
  // re-think where to stand a few times a second (not every frame = no twitching)
  p.pocketT = (p.pocketT || 0) - dt;
  if (!p.pocketTarget || p.pocketT <= 0) {
    p.pocketT = 0.35;
    let tx = G.los - d * depth, ty = p.pocketTarget ? p.pocketTarget.y : G.ballY;
    if (pl.off.boot && pl.t > 0.45) ty = G.ballY + (G.ballY <= MID ? 9 : -9); // bootleg: roll out to the wide side
    let near = null, nd = 3.5;
    for (const df of G.D) { if (df.engaged || df.down > 0) continue; const dd = dist(p, df); if (dd < nd) { nd = dd; near = df; } }
    if (near && pl.t > 0.6) { ty = p.y + Math.sign(p.y - near.y || 1) * 2.5; tx = Math.min(p.x, tx) * (d > 0 ? 1 : 0) + Math.max(p.x, tx) * (d > 0 ? 0 : 1) - d * 0.4; }
    p.pocketTarget = { x: tx, y: clamp(ty, 4, FIELD_W - 4) };
  }
  steer(p, p.pocketTarget.x, p.pocketTarget.y, pl.t < (pl.off.boot ? 1.6 : 0.8) ? 0.7 : 0.45, 0.8);
}

function cpuQB(dt) {
  const pl = G.play, qb = curPasser();
  if (G.callBall > 0) G.callBall -= dt;
  if ((pl.off.type === 'run' && !G.rpoKeep) || G.qbScramble || pl.off.noThrow) return;
  G.qbThink -= dt; if (G.qbThink > 0) return; G.qbThink = 0.15;
  const heat = (pl.def.a || []).filter(a => a === 'rush').length >= 5; // a big blitz: get the screen out now
  let minT = (pl.off.fake ? 1.15 : pl.off.screen ? (pl.off.screenTo ? 0.45 : heat ? 0.65 : 0.85) : pl.off.quick ? 0.3 : 1.0) + [0.15, 0, -0.1, -0.2][G.diff]; // RB screen: let the rush come first
  if (G.trickPasser) minT = Math.max(G.trickT + 0.35, G.trickMinT); // trick play: set your feet, let the deep guys get open
  else if (G.rpoKeep) minT = 0.5;
  let pressure = 99; for (const df of G.D) if (!df.engaged && df.down <= 0) pressure = Math.min(pressure, dist(qb, df));
  if (pl.t < minT && !(pl.t > 0.45 && pressure < 2.4 && !G.trickPasser && !G.rpoKeep)) return; // a free rusher: hot read before the play is fully developed
  const d = dirOf(G.poss), iq = cpuIQ(), toGo = Math.abs(G.firstDownX - G.los), late = pl.t - minT;
  let best = null, bs = -1e9;
  const scr = pl.off.screenTo || 1;
  if (pl.off.screen && pl.t >= minT + (pl.off.screenTo ? 0.15 : 0) && !G.trickPasser) { // screen: the rushers flying by don't matter, only a cover guy sitting on him does
    const r = G.O[scr], tight = pl.off.screenTo ? 1.6 : 2.2;
    if (eligible(r) && r.down <= 0 && (pressure < 2.2 || !G.D.some(df => !df.engaged && df.down <= 0 && df.assign.type !== 'rush' && dist(df, r) < tight))) { throwTo(qb, r); return; }
  }
  for (const s of [1, 2, 3, 4, 0]) {
    const r = G.O[s]; if (!eligible(r)) continue;
    const op = Math.min(4.5, throwWindow(qb, r));
    const down = d * (r.x - G.los);
    let sc = op + clamp(down, -3, 35) * 0.13 + (r.route && r.route.i >= r.route.pts.length && r.route.end === 'sit' ? 0.3 : 0);
    if (down > 14 && d * r.vx > 3 && hasStep(r)) sc += 1.4; // he's got a step on everybody deep: take the shot
    if (s === 1 && !pl.off.screen) sc -= 1.4 - Math.min(1, (pl.t - minT) * 0.4); // check-down only when nothing else is there
    if (pl.off.screen && s === scr) sc += 3;
    if (pl.off.focus === s) sc += 2.5; // the play is built for him
    if (s === 0 && G.trickPasser) sc += 1.2;
    if (G.rpoKeep && s === 4) sc += 1.5;
    if (r.motionMan) sc += 0.9; // the play is built for the man in motion: look there first
    if (G.lock && r.cap && G.poss === G.human) sc += G.callBall > 0 ? 0.9 : 0; // your QB looks for you (more when you call for it)
    if (op < 1.2) sc -= 2.5; // don't throw into a defender
    sc += [-0.6, 0, 0.3, 0.6][G.diff] * (op > 2 ? 1 : 0);
    if (G.down >= 3 || G.twoPt) { // 3rd/4th down: where he'll catch it (end of a sit route, or ahead of a runner) + a step after the catch vs the sticks
      const rt = r.route, last = rt && rt.end === 'sit' && rt.i < rt.pts.length ? rt.pts[rt.pts.length - 1] : null;
      const reach = (last ? Math.max(down, d * (last.x - G.los)) : down + Math.max(0, d * r.vx) * dist(qb, r) / (19 * GAME_SPEED) * 0.8) + 1.5;
      const short = toGo - reach;
      if (short > 0) sc -= iq * (G.down === 4 || G.twoPt ? 1.6 + short * 0.25 : 0.6 + short * 0.18) * (late > 1.4 || pressure < 2 ? 0.5 : 1); // short of the sticks = punt (less picky once he's out of time)
      else if (op > 1.5) sc += 0.5 * iq;
    }
    if (G.cpuHurry && !isHumanSide(G.poss) && (r.y < 8 || r.y > FIELD_W - 8)) sc += 0.6;        // two-minute drill: sideline throws stop the clock
    if (G.cpuMilk && !isHumanSide(G.poss) && op < 2.5) sc -= 1;                                 // ahead late: no risky throws
    sc += rand(-0.3, 0.3);
    if (sc > bs) { bs = sc; best = r; }
  }
  const need = 4.7 - late * 1.9; // throw on time: the longer he holds it, the less open the guy has to be
  // hot read: a free rusher is coming, so take what's there
  if (best && pressure < 3.2 && bs > 0.6 + (pressure < 1.8 ? -0.6 : 0) && chance(0.5)) { throwTo(qb, best); return; }
  if (best && (bs > need || (pressure < 1.6 && bs > 1.0 && chance(0.6)))) { throwTo(qb, best); return; }
  if (late > 2.0) { if (best && bs > 0.3) throwTo(qb, best); else throwAway(qb); return; } // held it too long: take it or get rid of it
  // nothing open and about to get hit: smart QBs throw it away instead of taking the sack
  if (pressure < 1.6 && pl.t > 0.9 && chance(0.45 + (rat(qb, 'AWR') - 70) / 100)) { throwAway(qb); return; }
  if (pressure < 1.5 && chance(0.12 + (qb.spdR > 86 ? 0.2 : 0))) G.qbScramble = true;
}
// nobody is deeper than him within a few yards: he's beaten his man
function hasStep(r) { const d = dirOf(G.poss); return !G.D.some(df => df.down <= 0 && d * (df.x - r.x) > -0.8 && Math.abs(df.y - r.y) < 5); }
// how open a receiver will be when the ball gets there: defenders who can close on the spot or sit in the passing lane count against it
function throwWindow(qb, r) {
  const d = dirOf(G.poss), T = dist(qb, r) / (19 * GAME_SPEED), lx = r.x + r.vx * T, ly = r.y + r.vy * T;
  const sx = lx - qb.x, sy = ly - qb.y, L2 = sx * sx + sy * sy || 1;
  let m = 99;
  for (const df of G.D) {
    if (df.engaged || df.down > 0) continue;
    // a defender trailing a receiver who's running deep can't undercut a ball thrown out in front of him
    const trailing = d * (df.x - r.x) < -0.5 && d * r.vx > 3;
    m = Math.min(m, Math.hypot(df.x - lx, df.y - ly) - df.spd * Math.max(0, T - 0.1) * (trailing ? 0.5 : 1.0));
    if (!trailing && Math.hypot(df.x - lx, df.y - ly) < 2.2) m = Math.min(m, -1); // somebody's already sitting on that spot
    const u = ((df.x - qb.x) * sx + (df.y - qb.y) * sy) / L2;
    if (u > 0.15 && u < 0.9 && Math.abs((df.x - qb.x) * sy - (df.y - qb.y) * sx) / Math.sqrt(L2) < 1.3) m = Math.min(m, 0);
  }
  return m;
}
// QB still in the pocket (tackle box, behind the line) with a free rusher on him: a pass to nobody is grounding
function pocketPressure(qb) {
  if (qb !== G.O[0] || G.trickPasser || G.special || dirOf(G.poss) * (qb.x - G.los) > -0.5 || Math.abs(qb.y - G.ballY) > 4.5) return false;
  return G.D.some(df => !df.engaged && df.down <= 0 && dist(df, qb) < 2.4);
}
// launch it out of bounds (or into the dirt) so nobody can catch it
function throwAway(qb) {
  const d = dirOf(G.poss), side = qb.y < MID ? -3 : FIELD_W + 3;
  const r = G.O.filter(eligible).sort((a, b) => Math.abs(a.y - side) - Math.abs(b.y - side))[0];
  if (!r) return;
  addText(qb.x, qb.y - 2, 'THROWN AWAY', '#cfe3ff', 14, 0.9);
  G.thrownAway = true;
  throwTo(qb, r, false, { x: qb.x + d * 8, y: side }, 'normal');
}

function followRoute(p, dt) {
  const r = p.route, d = dirOf(G.poss);
  if (!r) { p.dvx = p.dvy = 0; return; }
  // deep in the end zone: don't run out the back — shuffle side to side to get open
  if (p.role === 'route' && G.ball.holder !== p && d * (p.x - (goalX(G.poss) + d * 6)) > 0) return endZoneDrill(p, d);
  if (p.role === 'runpath' && G.ball.holder !== p && G.handedOff && !(G.ball.flight && G.ball.flight.intended === p) && !(G.play.off.chain && trickWaits(p))) return stalk(p, 6); // after the fake (not while the pitch is coming to him)
  if (r.wait && r.i >= r.wait[0] && G.play.t < r.wait[1]) { const h = r.wait[0] > 0 ? r.pts[r.wait[0] - 1] : { x: p.hx, y: p.hy }; steer(p, h.x, h.y, 0.9, 1.5); return; } // timed: hold here
  if (r.i < r.pts.length) {
    const t = r.pts[r.i];
    if (Math.hypot(t.x - p.x, t.y - p.y) < 0.8) r.i++;
    else { steer(p, t.x, t.y, p.role === 'runpath' ? 1 : 0.97, 0.15); return; }
  }
  if (r.i >= r.pts.length) {
    if (r.end === 'go') {
      const a = r.pts[r.pts.length - 2] || { x: p.hx, y: p.hy }, z = r.pts[r.pts.length - 1];
      let vx = z.x - a.x, vy = z.y - a.y; const m = Math.hypot(vx, vy) || 1;
      vx /= m; vy /= m;
      if (p.y < 3 && vy < 0 || p.y > FIELD_W - 3 && vy > 0) { vy = 0; vx = d; }
      steer(p, p.x + vx * 10, p.y + vy * 10, 0.97);
    } else if (r.end === 'sit') {
      if (G.play.off.screen && p.slot === (G.play.off.screenTo || 1)) return steer(p, r.pts[r.pts.length - 1].x, r.pts[r.pts.length - 1].y, 0.4); // screen: stay behind your wall
      // settle in the open
      let near = null, nd = 3;
      for (const df of G.D) { const dd = dist(p, df); if (dd < nd) { nd = dd; near = df; } }
      const last = r.pts[r.pts.length - 1];
      if (near) steer(p, last.x + (p.x - near.x) * 0.4, last.y + (p.y - near.y) * 0.4, 0.5);
      else steer(p, last.x, last.y, 0.4);
    } else if (r.end === 'block') { if (p.role === 'lead') return aiEscort(p, G.ball.holder || G.O[G.play.off.carrier || 4]); p.role = p.slot === 1 ? 'passblock' : 'stalk'; stalk(p, 8); }
    if (p.role === 'runpath' && G.play.off.fake) { p.role = 'passblock'; }
  }
}

function endZoneDrill(p, d) {
  const back = goalX(G.poss) + d * 10;
  if (!p.drill) p.drill = { dir: p.y < MID ? 1 : -1, y0: p.y, t: 0 };
  const dr = p.drill;
  dr.t += 1 / 60;
  // slide away from the closest defender, otherwise go back and forth
  let near = null, nd = 3;
  for (const df of G.D) { if (df.down > 0) continue; const dd = dist(p, df); if (dd < nd) { nd = dd; near = df; } }
  if (near && dr.t > 0.3 && Math.sign(near.y - p.y) === dr.dir) { dr.dir *= -1; dr.t = 0; }
  if (Math.abs(p.y - dr.y0) > 5.5 || p.y < 3 || p.y > FIELD_W - 3) { if (dr.t > 0.3) { dr.dir = p.y < 3 ? 1 : p.y > FIELD_W - 3 ? -1 : -dr.dir; dr.t = 0; } }
  const tx = back - d * (3.5 + Math.sin(G.play.t * 2) * 0.8);
  steer(p, tx, p.y + dr.dir * 4, 0.72, 0.5);
}
function passBlock(p) {
  const qb = G.O[0], d = dirOf(G.poss);
  const free = df => df && df.down <= 0 && df.shedCd <= 0 && (!df.engaged || df.engaged === p) && (df.assign.type === 'rush' || G.qbScramble);
  let threat = free(p.blockTarget) ? p.blockTarget : null;
  if (!threat) {
    let td = 7;
    for (const df of G.D) {
      if (!free(df) || G.players.some(o => o !== p && o.blockTarget === df && o.stun <= 0)) continue;
      const dd = dist(p, df); if (dd < td) { td = dd; threat = df; }
    }
    p.blockTarget = threat;
  }
  if (threat && G.play.off.chain) steer(p, threat.x, threat.y, 1, 0.1); // trick play: the ball moves around behind you, so go get your man
  else if (threat) { const t = 0.65; steer(p, lerp(qb.x, threat.x, t), lerp(qb.y, threat.y, t), 0.95, 0.3); }
  else steer(p, p.hx - d * Math.min(2, G.play.t * 1.5), p.hy, 0.5, 0.6);
}
function runBlock(p) {
  const d = dirOf(G.poss);
  let t = null, td = p.crack ? 20 : 7;
  for (const df of G.D) {
    if (df.engaged || df.down > 0) continue; const ahead = d * (df.x - p.x); if (ahead < -1) continue;
    const dd = dist(p, df) + (p.crack && df.pos !== 'LB' ? 6 : 0) + (p.crack && p.crackY != null ? Math.abs(df.y - p.crackY) * 0.8 : 0); // crack blocker hunts a linebacker
    if (dd < td) { td = dd; t = df; }
  }
  if (t) steer(p, t.x, t.y, p.crack ? 1.05 : 1, 0.1); else steer(p, p.x + d * 3, p.y, 0.8);
}
function stalk(p, range) {
  const b = G.ball, sm = screenMan();
  let t = null, td = range;
  for (const df of G.D) {
    if (df.engaged || df.down > 0) continue; const dd = dist(p, df);
    if (sm && sm !== p) { if (df.assign.type === 'rush' || dirOf(G.poss) * (df.x - sm.x) < -1) continue; const sc = dist(df, sm) + dd * 0.5; if (dd < 13 && sc < td + 4) { td = sc - 4; t = df; } continue; } // screens / jet: take the guy who'd get to the ball man's lane first
    if (dd < td) { td = dd; t = df; }
  }
  if (t && sm && sm !== p) return steer(p, lerp(t.x, sm.x, 0.3), lerp(t.y, sm.y, 0.3), 1.05, 0.2); // stay between him and the ball man
  if (t) steer(p, t.x + (t.vx || 0) * 0.15, t.y + (t.vy || 0) * 0.15, 1.05, 0.2); // go get your man (don't drift along with him)
  else steer(p, p.x + dirOf(G.poss) * 2, p.y, 0.4);
}

// draw: the back picks up anybody coming free at the QB (a linebacker chasing him in man, a blitzer), else sits next to him
function drawPickup(p) {
  const qb = G.O[0], d = dirOf(G.poss);
  const t = G.D.filter(df => !df.engaged && df.down <= 0 && dist(df, qb) < 8 && d * (df.x - qb.x) > -0.5).sort((a, b) => dist(a, qb) - dist(b, qb))[0];
  if (t) return steer(p, lerp(qb.x, t.x, 0.6), lerp(qb.y, t.y, 0.6), 1.0, 0.2);
  steer(p, qb.x + d * 0.6, qb.y + (p.hy > qb.y ? 1.4 : -1.4), 0.6, 0.6);
}
// screens, bubbles and the jet sweep: the man the blockers are clearing a path for (before he has the ball)
function screenMan() {
  const o = G.play.off, jetOn = o.jet && dirOf(G.poss) * (G.O[o.carrier || 4].x - G.los) < 1; // jet: until he turns the corner
  if (G.bstate === 'run' && !jetOn) return null;
  const r = o.screen || o.screenTo ? G.O[o.screenTo || 1] : jetOn ? G.O[o.carrier || 4] : null;
  if (!r || !r.route || !r.route.pts.length) return r;
  return r.route.pts[Math.min(r.route.pts.length - 1, o.jet ? 3 : 9)]; // where he'll have the ball: the end of his screen route, the corner on the jet
}
// screen line: block a beat to sell the pass, let the rusher go, then get out in front of the screen man
function screenBlock(p) {
  const pl = G.play, r = G.O[pl.off.screenTo || 1], d = dirOf(G.poss), rel = pl.off.screenTo ? 0.25 : 0.55;
  const side = Math.sign(r.y - G.ballY) || 1, k = side * (p.y - G.ballY); // k: how far toward the screen side he lines up
  if (pl.t < rel || (pl.off.screenTo && k < -1)) return passBlock(p); // WR screen: the backside tackle stays in
  if (!p.screenOut) { p.screenOut = true; if (p.engaged) { p.engaged.shedCd = 0.4; unlink(p.engaged, p); } }
  if (G.ball.flight || G.ball.holder !== G.O[0]) { const t = G.D.filter(df => !df.engaged && df.down <= 0 && df.assign.type !== 'rush' && d * (df.x - p.x) > -0.5 && dist(df, p) < 6).sort((a, b) => dist(a, r) - dist(b, r))[0]; if (t) return steer(p, t.x, t.y, 1.05, 0.1); }
  const n = k > 1 ? 0 : k > -1 ? 1 : 2; // a wall in front of him: the closest lineman goes widest
  steer(p, G.los + d * (0.9 - n * 0.6), r.y - side * n * 2, 1.05, 0.3);
}
function aiEscort(p, car) {
  const d = dirOf(car.side);
  const foes = G.players.filter(q => q.side !== car.side);
  let t = null, td = 10;
  for (const df of foes) {
    if (df.engaged || df.down > 0) continue;
    if (d * (df.x - car.x) < -1.5) continue;
    const dd = dist(df, car); if (dd < td && dist(p, df) < 12) { td = dd; t = df; }
  }
  if (t) steer(p, lerp(t.x, car.x, 0.25), lerp(t.y, car.y, 0.25), 1, 0.2);
  else steer(p, car.x + d * 5, lerp(p.y, car.y, 0.3), 0.9);
}

function aiRunner(p, dt) {
  const d = dirOf(p.side);
  // clock: a CPU runner who's behind late heads for the sideline once he's got a few yards (or is about to be hit)
  const cpuClock = !isHumanSide(p.side) && p.side === G.poss && G.cpuHurry && (G.timeouts[p.side] <= 1 || G.clock < 30) ? 'out' : '';
  // follow a designed run path first
  if (p.role === 'runpath' && p.route && p.route.i < p.route.pts.length && d * (p.x - G.los) < 1) {
    while (p.route.i < p.route.pts.length - 1 && d * (p.route.pts[p.route.i].x - p.x) < -0.5) p.route.i++; // never run backward to a spot you already passed
    const t = p.route.pts[p.route.i];
    if (Math.hypot(t.x - p.x, t.y - p.y) < 1) p.route.i++;
    steer(p, t.x, t.y, G.play.off.jet ? 1.03 : p.route.i >= 1 ? 1.06 : 1, 0.1); return;
  }
  const drawLane = G.play.off.draw && G.bstate === 'snap'; // draw: read the blocks, run where the rushers aren't
  const foes = G.players.filter(q => q.side !== p.side && q.down <= 0 && (!q.engaged || drawLane));
  const held = drawLane ? [] : G.players.filter(q => q.side !== p.side && q.down <= 0 && q.engaged && dist(q, p) < 5); // blocked guys: don't run right into them (they shed and make the tackle)
  let best = 0, bs = -1e9;
  for (let a = -80; a <= 80; a += 10) {
    const r = a * Math.PI / 180;
    const vx = Math.cos(r) * d, vy = Math.sin(r);
    // north-south runner: get upfield, read the defenders in FRONT (guys chasing from behind barely matter)
    let sc = Math.cos(r) * 3.6 - Math.abs(r - (p.runAng || 0)) * 0.35;
    for (const L of [2.2, 5]) {
      const px = p.x + vx * L, py = p.y + vy * L;
      for (const f of foes) {
        const behind = d * (f.x - p.x) < -0.8;
        const dd = Math.hypot(f.x - px, f.y - py);
        if (dd < 6) sc -= (behind ? 0.5 : 1.6) / (dd + 0.5) * (L > 3 ? 0.6 : 1);
      }
      if (L < 3) for (const f of held) { const dd = Math.hypot(f.x - px, f.y - py); if (dd < 2.5) sc -= 0.7 / (dd + 0.5); }
      if (py < 1.5 || py > FIELD_W - 1.5) sc -= (cpuClock === 'out' ? 0 : 5);
    }
    if (cpuClock === 'out' && d * (p.x - G.los) > 1) { const side = p.y < MID ? -1 : 1; sc += vy * side * 2.2; } // late and behind: get out of bounds
    if (sc > bs) { bs = sc; best = r; }
  }
  p.runAng = best;
  const vx = Math.cos(best) * d, vy = Math.sin(best);
  let open = 99; for (const f of foes) open = Math.min(open, dist(f, p));
  p.sprinting = open > 2.5 || (open > 1.5 && d * (p.x - G.los) > 0);
  const boost = p.sprinting ? 1 + (sprintBoost(p) - 1) * 0.7 : 1;
  p.dvx = vx * p.spd * boost; p.dvy = vy * p.spd * boost;
  let nd = 99; for (const f of foes) nd = Math.min(nd, dist(f, p));
  if (nd < 1.9 && nd > 0.9 && p.jukeCd <= 0 && chance(0.022 + (rat(p, 'AGI') - 70) * 0.001)) {
    if (chance(0.7)) doJuke(p, null); else doSpin(p);
  }
}

// ---------------- blocking ----------------
function resolveBlocks(dt) {
  const b = G.ball;
  const carrierSide = b.holder ? b.holder.side : G.poss;
  // new engagements: blockers are the ball side's players (not the carrier, not the QB holding it)
  for (const bl of G.players) {
    if (bl.side !== carrierSide || bl === b.holder || bl.engaged || bl.stun > 0 || bl.down > 0 || bl.isHuman) continue;
    if (bl.slot === 0 && bl.off) continue;
    if (bl.off && (bl.role === 'route') && G.bstate !== 'run') continue;
    for (const df of G.players) {
      if (df.side === carrierSide || df.engaged || df.down > 0 || df.shedCd > 0 || df.dive > 0 || df === b.holder) continue;
      if (bl.screenOut && (df.assign.type === 'rush' || dirOf(G.poss) * (df.x - bl.x) < -0.3)) continue; // let the rusher go
      if (dist(bl, df) < (bl.role === 'stalk' || bl.role === 'lead' ? 1.45 : 1.15)) { bl.engaged = df; df.engaged = bl; df.shed = 0; Sound.tone(110, 0.05, 'square', 0.04); break; }
    }
  }
  // engaged pairs fight
  for (const bl of G.players) {
    const df = bl.engaged;
    if (!df || df.engaged !== bl || bl.side !== carrierSide) continue;
    if (df.down > 0 || bl.down > 0 || dist(bl, df) > 2.5 || df === b.holder || bl === b.holder) { unlink(bl, df); continue; }
    const big = bl.pos === 'OL';
    // pass pro: a good line gives the QB ~4 seconds, a bad one vs a good rush gets beat fast
    const passPro = big && G.bstate !== 'run';
    let rate = (passPro ? 0.3 : big ? 0.42 : 0.85) * Math.pow(rat(df, passPro ? 'PRS' : 'BSH') / rat(bl, passPro ? 'PBK' : 'RBK'), passPro ? 3.5 : 2.2) * rand(0.4, 1.4);
    if (bl.role === 'screenblock') rate *= 1.8;
    const so = G.play.off; if (!big && bl.off && (so.screen || so.screenTo)) rate *= 0.6; // screens are built on these blocks: receivers set up to hold them
    if (G.play.off.draw && G.drawAt != null && big) rate *= 0.6; // the rushers came upfield on a draw: easy to ride them out
    if (df.isHuman && withSide(df.side, () => Input.axis().m) > 0.3) rate *= 1.7;
    if (xfOn(df, 'unstoppable')) rate *= 2.6;
    if (passPro && (xfOn(df, 'relentless') || xfOn(df, 'dualthreat'))) rate *= 2.2;
    if (!passPro && xfOn(df, 'reinforcement')) rate *= 2.4;
    rate *= abShed(df, bl, passPro);
    if (passPro) rate *= Sliders.side(df.side, 'cpuRush'); else rate *= Sliders.side(bl.side, 'cpuRunBlk'); // PASS RUSH / RUN BLOCKING sliders
    if (G.bstate === 'run') rate *= big ? 1.4 : 1.5; // receivers can hold a stalk block long enough to spring a sweep or screen
    df.shed += rate * dt;
    // the defender pushes slowly toward where he wants to go
    const push = clamp(rat(df, 'STR') / rat(bl, 'STR'), 0.6, 1.4) * 0.22;
    df.dvx *= push; df.dvy *= push;
    if (G.play.off.type === 'run' && bl.role === 'runblock') { df.dvx += dirOf(G.poss) * 0.9 * (rat(bl, 'STR') / rat(df, 'STR')); }
    if (G.play.off.draw && G.drawAt != null && big) { df.dvy += (Math.sign(df.y - G.O[0].y) || 1) * 2.2; } // draw: the rushers came upfield, now ride them out of the lane
    const nx = df.x - (df.dvx === 0 && df.dvy === 0 ? dirOf(carrierSide) * 0.95 : (df.dvx / (Math.hypot(df.dvx, df.dvy) || 1)) * 0.95);
    const ny = df.y - (df.dvx === 0 && df.dvy === 0 ? 0 : (df.dvy / (Math.hypot(df.dvx, df.dvy) || 1)) * 0.95);
    bl.dvx = (nx - bl.x) * 8 + df.dvx; bl.dvy = (ny - bl.y) * 8 + df.dvy;
    if (df.shed >= 1) {
      unlink(bl, df); df.shedCd = 1.1; bl.stun = 0.45;
      df.vx += (df.y > bl.y ? 0 : 0); if (df.isHuman) addText(df.x, df.y, 'SHED!', '#ff8a8a', 13, 0.6);
      bl.head.vx += 200;
    }
  }
}
function unlink(a, b) { if (a) a.engaged = null; if (b) b.engaged = null; }

// ---------------- movement physics ----------------
function applyMove(p, dt) {
  // safety net: a bad input value must never turn a player into NaN (that breaks the spot, the camera and every play after)
  if (!isFinite(p.dvx) || !isFinite(p.dvy)) { p.dvx = 0; p.dvy = 0; }
  if (!isFinite(p.vx) || !isFinite(p.vy)) { p.vx = 0; p.vy = 0; }
  if (!isFinite(p.x) || !isFinite(p.y)) { p.x = isFinite(p.lx) ? p.lx : (G.los != null ? G.los : 60); p.y = isFinite(p.ly) ? p.ly : MID; }
  p.lx = p.x; p.ly = p.y;
  if (p.down > 0) {
    // on the ground: mud / grass / snow sticks to the uniform for the rest of the game. Slips slide farther on a wet field
    const fr = p.slip > 0 ? 0.955 : 0.88;
    p.down -= dt; p.slip = Math.max(0, (p.slip || 0) - dt); p.vx *= fr; p.vy *= fr; p.x += p.vx * dt; p.y += p.vy * dt;
    if (G.dirt && G.phase === 'live') { p.dirt = Math.min(1, (p.dirt || 0) + dt * (G.weather === 'clear' ? 0.12 : 0.45)); G.dirt[p.side + ':' + p.name] = p.dirt; }
    if (p.slip > 0 && Math.hypot(p.vx, p.vy) > 1.5) groundMark(p.x, p.y, 1.4, true);
    headPhysics(p, 0, 0, dt); return;
  }
  let ax, ay;
  if (p.dive > 0) {
    p.dive -= dt; ax = 0; ay = 0;
    if (p.dive <= 0) { p.down = 0.7; p.downDir = p.vx >= 0 ? 1 : -1; addDust(p.x, p.y, 3); }
  } else {
    ax = p.dvx - p.vx; ay = p.dvy - p.vy;
    if (cutSlip(p, dt)) return;
    if (p.qj > 0) p.qj -= dt;
    const m = Math.hypot(ax, ay), maxA = p.acc * dt * (p.juke > 0 ? 0.25 : 1) * (p.qj > 0 ? 1.5 : 1);
    if (m > maxA) { ax *= maxA / m; ay *= maxA / m; }
    p.vx += ax; p.vy += ay;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (wet() && G.phase === 'live' && p.speedNow > 2.5 && (p.stepT = (p.stepT || 0) + dt) > 0.13) { p.stepT = 0; groundMark(p.x, p.y, 0.55, false); } // footprints / splashes
  if (p !== (G.ball && G.ball.holder)) { p.y = clamp(p.y, -2, FIELD_W + 2); p.x = clamp(p.x, -3, 123); }
  p.speedNow = Math.hypot(p.vx, p.vy);
  p.anim += Math.min(p.speedNow, 12) * dt * 1.45;
  if (Math.abs(p.vx) > 1.6 || (Math.abs(p.vx) > 0.6 && Math.abs(p.vx) > Math.abs(p.vy))) p.face.dir = Math.sign(p.vx);
  else if (G.phase !== 'live') p.face.dir = dirOf(p.side);
  headPhysics(p, ax / Math.max(dt, 1e-3), ay / Math.max(dt, 1e-3), dt);
}
function headPhysics(p, ax, ay, dt) {
  const h = p.head;
  const k = 170, c = 7.5;
  h.vx += (-k * h.ox - c * h.vx - clamp(ax, -60, 60) * 2.4) * dt;
  h.vy += (-k * h.oy - c * h.vy - clamp(ay, -60, 60) * 0.8) * dt + Math.sin(p.anim * 2) * Math.min(1, p.speedNow / 5) * 32 * dt;
  h.ox = clamp(h.ox + h.vx * dt, -11, 11); h.oy = clamp(h.oy + h.vy * dt, -7, 7);
  h.rot = h.ox * 0.045;
}
function separate() {
  const P = G.players;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    if (a.down > 0 || b.down > 0 || a.engaged === b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 0.75 && d > 0.001) {
      const push = (0.75 - d) * 0.3, nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }
}

// ---------------- passing ----------------
// drag-back throw: ball goes where you aimed, the closest receiver goes for it
function receiverFor(qb, tx, ty) {
  let best = null, bd = 7;
  for (const r of G.O) {
    if (!eligible(r)) continue;
    const T = Math.hypot(tx - qb.x, ty - qb.y) / (24 * GAME_SPEED);
    const d = Math.hypot(r.x + r.vx * T - tx, r.y + r.vy * T - ty);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
// ---- throw meter: hold to aim, the bar fills up and back down. Let go in the green = PERFECT (on target, easier catch)
// tap a receiver = touch LOB, hold = the POWER bar fills: green = PERFECT bullet, past it = TOO HARD. Catch + defense meters time the ball's arrival
const optOn = (k, d = '1') => { try { return (JSON.parse(localStorage.getItem('bobbleOpts') || '{}')[k] || d) === '1'; } catch (e) { return d === '1'; } };
const meterOn = () => optOn('optMeter'), catchMeterOn = () => optOn('optCatchM', '1'), defMeterOn = () => optOn('optDefM', '0'); // catch + defense meters start OFF
const METER_NEAR = 7; // the catch / defense bar only shows when your guy is this close to where the ball comes down
const TAP_LOB = 0.18; // let go faster than this = it was a tap
const METER_SPD = { slow: 1.45, normal: 1.0, fast: 0.7 }; // PASS METER SPEED setting
const meterCycle = () => { try { return METER_SPD[JSON.parse(localStorage.getItem('bobbleOpts') || '{}').optMeterSpd] || 1; } catch (e) { return 1; } };
function meterStart(qb, key, r) { G.meter = { t0: G.time, key, r: r || null, green: meterGreen(qb), cyc: meterCycle() }; }
function meterGreen(qb) { const w = clamp(0.13 + (qbArm(qb).acc - 70) * 0.005, 0.11, 0.24); return [0.92 - w, 0.92]; } // better accuracy = bigger green
function meterVal() { const m = G.meter; if (!m) return 0; return Math.min(1, Math.max(0, G.time - m.t0 - 0.08) / (m.cyc || 1)); }
// what the release did: power 0..1 and whether it was perfect
function meterRead() { const m = G.meter; if (!m) return null; const v = meterVal(); G.meter = null; return { v, perfect: v >= m.green[0] && v <= m.green[1], over: v > m.green[1], g0: m.green[0] }; }
// let go of a held receiver: a quick tap is a lob, a hold throws with the meter's power (strong enough = a bullet)
function meterThrow(qb, r, style, lead) {
  const tap = G.time - G.meter.t0 < TAP_LOB;
  if (tap) { G.meter = null; return throwTo(qb, r, false, null, style === 'normal' ? 'lob' : style, lead); }
  const mt = meterRead();
  throwTo(qb, r, false, null, style !== 'normal' ? style : mt.v >= mt.g0 ? 'bullet' : 'normal', lead, mt);
}
// catch meter: HOLD Space / your finger while the ball is coming, the bar fills; let go in the green (or still be in it when the ball gets there) = PERFECT CATCH
const CATCH_FILL = 0.7, CATCH_GREEN = [0.72, 0.92];
const catchFill = () => G.chold ? Math.min(1, (G.time - G.chold.t0) / CATCH_FILL) : 0;
// how covered the catch is: 0 = wide open, 1 = a defender right on him / on the spot (within ~1 yd)
function coverageAt(rcv, f) {
  if (!rcv || !f || !G.players) return 0;
  const left = clamp(f.T - f.t, 0, 0.6); let d = 99;
  for (const q of G.players) {
    if (q.side === rcv.side || q.down > 0 || q.engaged) continue;
    const px = q.x + (q.vx || 0) * left, py = q.y + (q.vy || 0) * left; // where he'll be when the ball gets there
    d = Math.min(d, Math.hypot(px - f.tx, py - f.ty), Math.hypot(q.x - rcv.x, q.y - rcv.y));
  }
  const s = clamp((5 - d) / 4, 0, 1); return s * s * (3 - 2 * s);
}
// catch meter green: wide open = big, blanketed = tiny; good hands help a little
function catchGreen(p, f) {
  const w = clamp(0.30 - 0.20 * coverageAt(p, f) + (rat(p, 'CTH') - 80) * 0.0015, 0.08, 0.34);
  return [0.82 - w / 2, Math.min(0.99, 0.82 + w / 2)];
}
function catchHold(p, held) {
  const f = G.ball && G.ball.flight;
  if (!f || f.pitch || f.kick || f.intended !== p || f.cp || !catchMeterOn()) { G.chold = null; return; }
  if (held && !G.chold) G.chold = { t0: G.time };
  if (G.chold) G.chold.g = catchGreen(p, f);
  if (!held && G.chold) catchLock(f);
}
function catchLock(f) {
  const v = catchFill(), p = f.intended, cg = G.chold && G.chold.g || catchGreen(p, f); G.chold = null;
  f.cp = v >= cg[0] && v <= cg[1] ? 'perfect' : v >= 0.45 ? 'good' : 'early';
  addText(p.x, p.y - 1.5, f.cp === 'perfect' ? 'PERFECT CATCH' : f.cp === 'good' ? 'GOOD CATCH' : 'TOO EARLY', f.cp === 'perfect' ? '#5dff7a' : f.cp === 'good' ? '#fff' : '#ff8a8a', 15, 0.8);
}
// defense meter: press when the ball gets there. Window = last part of the flight
const CATCH_WIN = [0.78, 0.96];
// defense meter window, the other way round: right in his hip pocket = big window, trailing way behind = small
function defWin(p, f) {
  const left = clamp(f.T - f.t, 0, 0.6), r = f.intended;
  const d = Math.min(Math.hypot(p.x + (p.vx || 0) * left - f.tx, p.y + (p.vy || 0) * left - f.ty), r ? Math.hypot(p.x - r.x, p.y - r.y) : 99);
  const s = clamp((5 - d) / 4, 0, 1), w = clamp(0.10 + 0.14 * s * s * (3 - 2 * s) + (rat(p, 'COV') - 75) * 0.0015, 0.08, 0.26);
  return [0.87 - w / 2, Math.min(0.99, 0.87 + w / 2)];
}
function flightPress(p, kind) {
  const f = G.ball && G.ball.flight; if (!f || f.pitch || f.kick) return;
  if (kind === 'catch' ? (!catchMeterOn() || f.intended !== p || f.cp) : (!defMeterOn() || f.dp)) return;
  if (Math.hypot(p.x - f.tx, p.y - f.ty) > METER_NEAR) return; // too far from the ball to matter
  const W = kind === 'catch' ? CATCH_WIN : defWin(p, f);
  const u = f.t / f.T, res = u >= W[0] && u <= W[1] ? 'perfect' : u >= 0.62 && u <= 1 ? 'good' : 'early';
  if (kind === 'catch') f.cp = res; else { f.dp = { p, res }; f.dw = W; }
  if (res !== 'early') addText(p.x, p.y - 1.5, res === 'perfect' ? (kind === 'catch' ? 'PERFECT CATCH' : 'PERFECT READ') : 'GOOD TIMING', res === 'perfect' ? '#5dff7a' : '#fff', 15, 0.8);
  else addText(p.x, p.y - 1.5, 'TOO EARLY', '#ff8a8a', 14, 0.7);
}
function throwAt(qb, tx, ty, style, mt) {
  const r = receiverFor(qb, tx, ty) || nearestTo(G.O.filter(eligible), { x: tx, y: ty });
  if (!r) return;
  throwTo(qb, r, false, { x: tx, y: clamp(ty, -0.5, FIELD_W + 0.5) }, style, null, mt);
}
// QB arm: throw power sets how far and how fast, accuracy sets how close it lands to where you wanted
function qbArm(qb) {
  const wear = qb.side != null && qb === G.O[0] ? Injury.wear(qb.side) : 0; // a beat-up QB loses a little zip and touch
  let thp = (qb.thp || rat(qb, 'THP')) - wear * 0.04, acc = (qb.tha || rat(qb, 'THA')) - wear * 0.08; // thp = throw power, tha = throw accuracy (created players have their own)
  if (G.O && qb !== G.O[0] && qb.pos !== 'QB') { thp = Math.min(thp, 70); acc = Math.min(acc, 55); } // trick play: a RB / WR throwing it
  return { thp, acc, range: 18 + thp * 0.52 + (xfOn(qb, 'bazooka') ? 12 : 0), accF: Math.pow(clamp((100 - acc) / 30, 0, 4), 1.3) };
}
function throwTo(qb, r, pitch = false, aimed = null, style = 'normal', lead = null, mt = null) {
  const b = G.ball;
  const arm = qbArm(qb);
  const sMul = style === 'bullet' ? 1.3 : style === 'lob' ? 0.72 : 1;
  // meter power: weak = a slower ball (defenders close), too hard = faster but wilder
  const mMul = !mt || pitch ? 1 : mt.perfect ? 1.05 : mt.over ? 1.15 : lerp(0.78, 1, clamp(mt.v / mt.g0, 0, 1));
  const spd = (pitch ? 20 : Math.max(11, 19 + (arm.thp - 70) * 0.16) * (abHas(qb, 'gun') ? 1.05 : 1)) * GAME_SPEED * (pitch ? 1 : sMul * mMul); // pitches are short and quick
  let tx = r.x, ty = r.y, T = 0.3;
  const sitting = r.route && r.route.end === 'sit' && r.route.i >= r.route.pts.length;
  if (aimed) {
    tx = aimed.x; ty = aimed.y; T = Math.max(0.3, Math.hypot(tx - qb.x, ty - qb.y) / spd);
    // aimed right at a running receiver: lead him a bit so it isn't thrown behind him
    if (!pitch && r && dist(r, aimed) < 4.5 && Math.hypot(r.vx || 0, r.vy || 0) > 2) for (let k = 0; k < 3; k++) {
      T = Math.max(0.3, Math.hypot(tx - qb.x, ty - qb.y) / spd); tx = aimed.x + r.vx * T * 0.8; ty = aimed.y + r.vy * T * 0.8;
    }
  }
  else for (let k = 0; k < 4; k++) {
    T = Math.max(pitch ? 0.25 : 0.35, Math.hypot(tx - qb.x, ty - qb.y) / spd);
    if (pitch) T = Math.min(T, 0.4);
    if (sitting) break;
    tx = r.x + r.vx * T; ty = r.y + r.vy * T;
    if (!pitch && r.route && r.route.end === 'sit' && (G.play.off.screen || G.play.off.screenTo) && r.slot === (G.play.off.screenTo || 1)) { // screen: throw it to the spot he's settling into, not past it
      const lp = r.route.pts[r.route.pts.length - 1], dd = dist(r, lp), go = Math.min(dd, Math.hypot(r.vx, r.vy) * T);
      if (dd > 0.1) { tx = r.x + (lp.x - r.x) / dd * go; ty = r.y + (lp.y - r.y) / dd * go; }
    }
  }
  if (lead && lead.m > 0.1 && !pitch) { tx += lead.x * 2.6; ty += lead.y * 2.6; } // lead him away from the defender
  if (!aimed && !pitch) { tx = clamp(tx, 1.2, 118.8); ty = clamp(ty, 0.8, FIELD_W - 0.8); } // don't lead him out the back of the end zone or over the sideline
  let len = Math.hypot(tx - qb.x, ty - qb.y);
  let duck = false;
  if (!pitch) {
    // past his range the ball dies short of the spot
    const reach = arm.range * (style === 'lob' ? 0.92 : style === 'bullet' ? 0.85 : 1) * (G.weather === 'rain' || G.weather === 'snow' ? 0.93 : 1);
    if (len > reach) {
      const k = reach * rand(0.9, 1) / len; tx = qb.x + (tx - qb.x) * k; ty = qb.y + (ty - qb.y) * k;
      len = Math.hypot(tx - qb.x, ty - qb.y); duck = true;
      addText(qb.x, qb.y - 2, 'NOT ENOUGH ARM', '#ff8a8a', 15, 0.9);
    }
    let pressure = false; for (const df of G.D) if ((!df.engaged || xfOn(df, 'fearmonger')) && dist(df, qb) < (df.engaged ? 3.2 : 2.4) + (abHas(df, 'reach') ? 0.4 : 0)) pressure = true;
    if (xfOn(qb, 'proreads')) pressure = false; // Pro Reads: ignores the rush
    const elite = clamp((arm.acc - 80) / 12, 0, 1); // 92+ accuracy = elite, 80 and under = normal
    let err = (lerp(0.55, 0.28, elite) + arm.accF) * (0.42 + len / 20);
    if (len > reach * 0.75) err *= 1 + (len / reach - 0.75) * 2; // straining for distance
    if (pressure) err += 0.6 * (1 - elite * 0.5) + arm.accF * 0.45;
    const onRun = qb.speedNow > 4;
    if (onRun && !xfOn(qb, 'rungun')) err += (0.3 + arm.accF * 0.3) * Math.min(1, qb.speedNow / 8);
    if (onRun && xfOn(qb, 'rungun')) err *= 0.35; // Run & Gun: dots on the move
    if (aimed) err *= lerp(0.45, 0.85, clamp(arm.accF / 2.5, 0, 1)); // you aimed it, but a bad QB still sprays it
    if ((G.play.off.screen || G.play.off.screenTo) && r.slot === (G.play.off.screenTo || 1)) err *= 0.55; // a screen is an easy little toss
    if (style === 'bullet') err *= 1.15; else if (style === 'lob') err *= 0.9;
    if (xfOn(qb, 'dimes') || xfOn(qb, 'dots')) err *= 0.35;
    if (xfOn(qb, 'proreads')) err *= 0.7;
    err *= abThrowErr(qb, { pressure, onRun, tx, ty, style }); // Deadeye / Fearless
    err *= 1 - 0.08 * Momentum.of(qb.side); // riding the momentum
    if (G.weather === 'rain' || G.weather === 'snow') err *= 1.15;
    err *= Sliders.side(qb.side, 'cpuAcc', 'humAcc'); // QB ACCURACY sliders
    if (mt) { if (mt.perfect) err *= 0.25; else if (mt.over) err *= 1.35; else err *= 1 + (1 - clamp(mt.v / mt.g0, 0, 1)) * 0.6; }
    if (arm.thp < 62 || err > 3.5) duck = true;
    if (mt && mt.perfect) duck = false;
    if (mt) addText(qb.x, qb.y - 2.4, mt.perfect ? 'PERFECT' : mt.over ? 'TOO HARD' : mt.v / mt.g0 < 0.6 ? 'WEAK' : 'GOOD', mt.perfect ? '#5dff7a' : mt.over ? '#ff8a8a' : '#fff', 15, 0.8);
    if (style !== 'normal') addText(qb.x, qb.y, style === 'bullet' ? 'BULLET!' : 'LOB!', '#7fd3ff', 15, 0.6);
    const a = rand(0, Math.PI * 2), m = Math.abs(rand(-1, 1) + rand(-1, 1)) / 2 * err * 2;
    let ex = Math.cos(a) * m, ey = Math.sin(a) * m;
    // good QBs miss long or to the safe side, not short behind the receiver
    if (len > 1 && !duck) { const ux = (tx - qb.x) / len, uy = (ty - qb.y) / len, along = ex * ux + ey * uy; if (along < 0) { const cut = along * clamp(0.6 + (arm.acc - 72) / 45, 0.6, 1); ex -= ux * cut; ey -= uy * cut; } }
    tx += ex; ty += ey;
    stat(qb).att++;
    Sound.throw();
    qb.mouth = 'O'; qb.mouthT = 0.5; qb.throwAnim = 0.3; G.throwT = G.play.t; G.lastPasser = qb;
  } else Sound.tone(400, 0.1, 'triangle', 0.08, 200);
  ty = clamp(ty, -0.5, FIELD_W + 0.5);
  b.holder = null;
  const pk = pitch ? 0.4 : (0.6 + len * 0.1) * (style === 'bullet' ? 0.45 : style === 'lob' ? 1.9 : 1) + (style === 'lob' ? 1.5 : 0);
  b.flight = { sx: qb.x, sy: qb.y, tx, ty, t: 0, T: Math.max(T, len / spd), peak: pk, intended: r, pitch, passer: qb, style, duck, perfect: !!(mt && mt.perfect), grnd: !pitch && pocketPressure(qb) };
  G.bstate = 'air'; G.intended = r;
  for (const p of G.players) { p.laneChecked = false; p.jumpTried = false; }
  G.passPlay = !pitch;
  G.showTarget = true;
  if (!pitch && isHumanSide(r.side)) setHD(r.side, r);
}

// ball height along a throw / kick: leaves at hand height (a punt: foot height, f.z0), comes down at chest height
const flightZ = (f, u) => { const z0 = f.z0 != null ? f.z0 : 1.7; return z0 + f.peak * 4 * u * (1 - u) + u * (1.1 - z0); };
function updateFlight(dt) {
  const b = G.ball, f = b.flight;
  f.t += dt;
  const u = Math.min(1, f.t / f.T);
  b.x = lerp(f.sx, f.tx, u); b.y = lerp(f.sy, f.ty, u);
  b.z = flightZ(f, u);
  b.spin = (b.spin || 0) + dt * 30;
  // the ball can be picked off on the way: a defender in the passing lane (jumping = higher reach)
  if (!f.pitch && !f.kick && !G.thrownAway && u > 0.12 && u < 0.88) {
    for (const p of G.players) {
      if (p.side === f.passer.side || p.down > 0 || p.engaged || p.laneChecked) continue;
      const jumping = p.jump > 0, reach = jumping ? 1.4 : 0.5, high = jumping ? 3.6 : 2.0;
      if (b.z > high || Math.hypot(p.x - b.x, p.y - b.y) > reach) continue;
      p.laneChecked = true;
      const pInt = clamp((jumping ? (p.isHuman ? 0.7 : 0.3) : p.isHuman ? 0.45 : 0.28) + (rat(p, 'CTH') - 80) / 200 + (p.isHuman ? 0.05 : 0) + (xfOn(p, 'lurker') || xfOn(p, 'shutdown') ? 0.1 : 0) + (abHas(p, 'lurker') && p.assign && p.assign.type === 'zone' ? 0.06 : 0), 0.15, 0.9); // CPU: fewer picks, more tips (players said too many INTs)
      b.flight = null; G.showTarget = false;
      if (chance(pInt * Sliders.side(p.side, 'cpuInt'))) { addText(p.x, p.y, jumping ? 'SKY HIGH!' : 'PICKED!', '#7fd3ff', 22, 0.9); return intercept(p); }
      return incomplete(p, 'TIPPED!');
    }
  }
  if (u >= 1) { if (f.kick) { b.flight = null; return catchKick(f); } if (G.chold && !f.cp) catchLock(f); G.chold = null; resolveCatch(); }
}

function resolveCatch() {
  const b = G.ball, f = b.flight, land = { x: f.tx, y: f.ty };
  b.flight = null; G.showTarget = false;
  if (f.pitch) {
    if ((f.trick && !f.shovel) || f.lateral) if (chance((f.lateral ? 0.05 : 0.03) * Sliders.mul('fum'))) { // trick pitches are risky: sometimes it hits the turf
      b.x = f.tx; b.y = f.ty; b.loose = { vx: rand(-3, 3), vy: rand(-3, 3), t: 0 }; G.bstate = 'loose'; G.credit = null;
      showBanner('FUMBLE!', 'Bad pitch', '#ff9a3d', 1.0); return;
    }
    b.holder = f.intended; Sound.catch();
    if (f.shovel) { G.bstate = 'run'; stat(f.passer).att++; stat(f.passer).comp++; G.credit = { p: f.intended, kind: 'rec', passer: f.passer }; G.catchX = f.intended.x; G.lastPasser = f.passer; return; }
    if (f.trick) return trickGot(f.intended, f.trick);
    G.bstate = 'run';
    if (f.lateral && G.credit && G.credit.kind === 'rec') G.credit = { ...G.credit, p: f.intended };
    else G.credit = { p: f.intended, kind: 'rush' };
    return;
  }
  const offSide = f.passer.side; G.lastThrower = f.passer;
  // intentional grounding: thrown from inside the pocket with a rusher on him and no receiver anywhere near it
  if (f.grnd && !G.twoPt && !G.mini && !G.O.some(p => eligible(p) && dist(p, land) < 6.5) && chance(0.6)) throwFlag('GROUND', offSide, f.sx, f.sy, f.passer);
  if (G.thrownAway) { G.thrownAway = false; return incomplete(null, 'THROWN AWAY'); }
  let rcv = null, rd = 99, def = null, dd = 99;
  for (const p of G.players) {
    if (p.down > 0 || p.engaged) continue;
    const d = dist(p, land);
    if (p.side === offSide) { if (((p.slot >= 1 && p.slot <= 4) || (p.slot === 0 && p.role === 'route')) && p !== f.passer && d < rd) { rd = d; rcv = p; } }
    else if (d < dd) { dd = d; def = p; }
  }
  const scrToss = rcv && (G.play.off.screen || G.play.off.screenTo) && rcv.slot === (G.play.off.screenTo || 1) && dirOf(offSide) * (land.x - G.los) < 0.5; // a screen toss: he's facing the QB, easy catch
  // a defender who jumped the route gets first crack at it
  const jumper = G.players.find(p => p.side !== offSide && p.jump > 0 && p.down <= 0 && dist(p, land) < 2.0);
  if (jumper) {
    const jd = dist(jumper, land);
    const dpj = f.dp && f.dp.p === jumper ? f.dp.res : null; // a well-timed jump wins more often
    const pInt = clamp((jumper.isHuman ? 0.62 : 0.3) + (rat(jumper, 'CTH') - 75) / 90 - (rd < jd ? 0.25 : 0) - jd * 0.12 + (dpj === 'perfect' ? 0.2 : dpj === 'good' ? 0.08 : 0), 0.1, 0.9);
    if (chance(pInt * Sliders.side(jumper.side, 'cpuInt'))) return intercept(jumper);
    if (chance(0.6)) return incomplete(jumper, 'SWATTED!');
  }
  const dpr = f.dp && f.dp.p === def ? f.dp.res : null;
  const humanDefBonus = (def && def.isHuman ? 0.15 : 0) + (xfOn(def, 'lurker') || xfOn(def, 'shutdown') ? 0.2 : 0) + (dpr === 'perfect' ? 0.15 : dpr === 'good' ? 0.06 : 0);
  const R = 1.45;
  const hands = (xfOn(rcv, 'hands') || f.cp === 'perfect') && rd < 1.6; // a "Double Me" guy (or a PERFECT catch) usually wins the 50-50 ball
  // Universal Coverage / Dual Threat: any defender with this ability close to the catch knocks it loose
  for (const q of G.players) if (q.side !== f.passer.side && q.down <= 0 && rcv && rd < R && dist(q, land) < (xfOn(q, 'univ') ? 1.7 : 1.2) && (xfOn(q, 'univ') || xfOn(q, 'dualthreat'))
    && chance((xfOn(q, 'univ') ? 0.8 : 0.45) * (hands ? 0.5 : 1))) return incomplete(q, 'KNOCKED LOOSE!');
  const tight = (xfOn(def, 'shutdown') ? 0.35 : 0) + (abHas(def, 'shade') && def.assign && def.assign.type === 'man' ? 0.12 : 0); // Shutdown: plays the ball from farther away
  if (def && dd < 0.5 && dd < rd - 0.3 && !(hands && chance(0.7))) { // ball hits the defender right in the body: 7 out of 10 get picked
    if (chance((def.isHuman ? 0.55 : 0.13) * (scrToss ? 0.4 : 1) * Sliders.side(def.side, 'cpuInt'))) return intercept(def);
    return incomplete(def, 'BROKEN UP!');
  }
  if (def && dd < 1.25 + tight && dd < rd - 0.25 + tight && !(hands && chance(0.7))) { // defender has inside position
    const pInt = clamp((def.isHuman ? 0.08 : 0.04) + (rat(def, 'COV') - 75) / 160 + humanDefBonus + (abHas(def, 'lurker') && def.assign && def.assign.type === 'zone' ? 0.04 : 0) + (G.diff === 3 && !def.isHuman ? 0.06 : 0) - (rd < 1 ? 0.08 : 0), 0.03, 0.6);
    if (chance(pInt * Sliders.side(def.side, 'cpuInt'))) return intercept(def);
    return incomplete(def, 'BROKEN UP!');
  }
  if (rcv && rd < R && def && dd < 0.8 && def.jump <= 0 && chance(0.015 * Sliders.mul('pen'))) { throwFlag('DPI', def.side, land.x, land.y, def); return incomplete(def, 'INTERFERENCE!'); }
  if (rcv && rd < R) {
    let pc = 0.9 + (rat(rcv, 'CTH') - 78) / 160 - Math.max(0, Math.hypot(land.x - f.sx, land.y - f.sy) - 15) * 0.006 - (rd > 0.9 ? 0.08 : 0) - Weather.catchPenalty();
    if (hands) pc += 0.15;
    pc += 0.03 * Momentum.of(rcv.side);
    if (f.perfect) pc += 0.12; // a PERFECT meter throw is right in his hands
    if (f.cp === 'perfect') pc += 0.1; else if (f.cp === 'good') pc += 0.08; // timed catch
    pc += abCatch(rcv, def, def && dd < 1.8, f, land); // superstar abilities: route Elites, contested catches, knockouts
    if (def && dd < 1.8) { pc -= ((hands ? 0.08 : 0.24) - (rat(rcv, 'CTH') - rat(def, 'COV')) / 150) * (scrToss ? 0.4 : 1); if (chance(((def.isHuman ? 0.03 : 0.015) + humanDefBonus * 0.5) * Sliders.side(def.side, 'cpuInt'))) return intercept(def); }
    if (scrToss) pc = lerp(pc, 0.97, 0.5);
    if (chance(clamp(pc, 0.25, 0.97))) {
      const backLine = rcv.x < -0.25 || rcv.x > 120.25, sideLine = rcv.y < -0.25 || rcv.y > FIELD_W + 0.25;
      if (Review.catchCall(rcv, f, backLine || sideLine)) { addText(clamp(rcv.x, 1, 119), clamp(rcv.y, 1, FIELD_W - 1), backLine ? 'OUT THE BACK' : 'NO FEET IN', '#fff', 15, 1); return incomplete(rcv, 'OUT OF BOUNDS'); }
      b.holder = rcv; G.bstate = 'run'; Sound.catch(); G.catchX = rcv.x;
      rcv.mouth = 'O'; rcv.mouthT = 0.4;
      stat(f.passer).comp++; G.credit = { p: rcv, kind: 'rec', passer: f.passer };
      addText(rcv.x, rcv.y, pick(['CAUGHT!', 'GOT IT!', 'NICE GRAB!']), '#9cff9c', 15, 0.8);
      if (isHumanSide(rcv.side)) setHD(rcv.side, rcv);
      return;
    }
    return incomplete(rcv, 'DROPPED!');
  }
  if (def && dd < 1.0) return chance(0.1 * Sliders.side(def.side, 'cpuInt')) ? intercept(def) : incomplete(def, 'BROKEN UP!');
  incomplete(null, 'INCOMPLETE');
}

function intercept(def) {
  const b = G.ball;
  b.holder = def; G.bstate = 'run'; Sound.bad();
  stat(def).int++; G.tstats[G.poss].to++; G.intBy = def;
  if (G.lastThrower) { const t = stat(G.lastThrower); t.tov = (t.tov || 0) + 1; }
  showBanner('INTERCEPTED!', def.name, '#ff5050', 1.6);
  def.mouth = 'O'; def.mouthT = 0.6;
  G.credit = null; G.crowdHype = 1;
  if (G.versus) { setHD(def.side, def); setHD(1 - def.side, nearestTo(G.players.filter(p => p.side !== def.side), def)); }
  else if (def.side === G.human) G.humanDef = def;
  else G.humanDef = nearestTo(G.players.filter(p => p.side === G.human), def);
}
function incomplete(who, text) {
  const b = G.ball;
  b.loose = null; b.dead = { vx: rand(-3, 3), vy: rand(-2, 2) }; b.z = 1;
  if (who) addText(who.x, who.y, text, '#fff', 16, 1);
  if (who && who.side !== G.poss) { G.breakup = who; const s = stat(who); s.pd = (s.pd || 0) + 1; } // pass defended
  endPlay({ type: 'inc', text });
}

// ---------------- tackles / fumbles / bounds ----------------
function checkTackles() {
  const b = G.ball, car = b.holder;
  if (!car) return;
  let hitters = 0;
  for (const df of G.players) {
    if (df.side === car.side || df.down > 0 || df.engaged || df.stun > 0 || df.tackleCd > 0) continue;
    const reach = 1.15 + (df.dive > 0 ? 0.8 : 0) + (df.hit > 0 ? 0.45 : 0);
    if (dist(df, car) > reach) continue;
    hitters++;
    df.tackleCd = 0.5;
    let p = 0.87 + (rat(df, 'TAK') - rat(car, 'BTK')) / 110;
    const front = dirOf(car.side) * (df.x - car.x) > -0.3;
    // moves don't stack: the best one counts, a second one only adds a little
    const mv = [car.juke > 0 ? 0.34 : 0, car.spin > 0 ? 0.4 : 0, car.stiff > 0 && front ? 0.38 : 0].sort((a, b) => b - a);
    p -= mv[0] + mv[1] * 0.15;
    if (df.dive > 0) p += 0.15;
    if (df.hit > 0) p = 0.5 + (rat(df, 'TAK') - rat(car, 'BTK')) / 100 - (car.juke > 0 ? 0.3 : 0);
    if (car.pos === 'QB' && G.bstate === 'snap' && !G.play.off.qbRun) p += 0.12;
    if (car.pos === 'OL' || car.pos === 'DL') p += 0.2;
    if (car.side === G.human && !G.versus) p += [-0.08, 0, 0.06, 0.13][G.diff];
    if (xfOn(car, 'freight')) p -= 0.25;
    if (xfOn(df, 'unstoppable') || xfOn(df, 'reinforcement')) p += 0.1;
    if (xfOn(car, 'ankle') && (car.juke > 0 || car.spin > 0)) p -= 0.3;
    p += abTackle(car, df, front);
    p += 0.03 * (Momentum.of(df.side) - Momentum.of(car.side));
    p = clamp(p, 0.1, 0.94);
    const tm = Sliders.side(df.side, 'cpuTkl', 'humTkl'); // TACKLING sliders
    if (tm !== 1) p = clamp(p * tm, 0.05, 0.98);
    // one-shot breaks: Brick Wall (first sack try), Phenom (first hit), First One Free (next move), YAC 'Em Up (first hit after the catch)
    const xfBreak = (car === G.O[0] && G.bstate === 'snap' && xfFree(car, 'brickwall')) || xfFree(car, 'phenom')
      || ((car.juke > 0 || car.spin > 0) && xfFree(car, 'firstfree')) || (G.bstate === 'run' && G.credit && G.credit.kind === 'rec' && xfFree(car, 'yac'));
    if (xfBreak || (car === G.O[0] && G.bstate === 'snap' && car.pos === 'QB' && abFree(car, 'extender') && chance(0.4))) p = 0; // Extender: sometimes shakes the first sack try
    if (chance(p)) return tackle(car, df, hitters);
    if (df.hit > 0) { df.hit = 0; df.down = 1.1; df.downDir = car.x > df.x ? 1 : -1; addText(df.x, df.y, 'WHIFF!', '#ccc', 18, 0.8); continue; }
    // broken tackle
    df.down = 0.75; df.downDir = car.x > df.x ? 1 : -1; df.vx *= 0.3; df.vy *= 0.3; df.dive = 0;
    car.vx *= 0.55; car.vy *= 0.55;
    if (car.stiff > 0 && front) { df.down = 1.1; df.vx = dirOf(car.side) * 5; df.dizzy = 1; }
    addText(car.x, car.y, car.stiff > 0 && front ? 'STIFF ARM!' : car.juke > 0 ? 'JUKED!' : car.spin > 0 ? 'SPUN AWAY!' : 'BROKE IT!', '#ffe14d', 22, 0.9);
    df.head.vx += 300; Sound.boing(); G.crowdHype = Math.min(1, G.crowdHype + 0.4);
  }
}

function tackle(car, df, hitters) {
  const b = G.ball;
  Sound.tackle(); cam.shake = 7; G.lastTackler = df;
  const stick = df.hit > 0;
  const boom = stick || ((df.speedNow > 11 || (df.dive > 0 && df.speedNow > 10.5)) && chance(0.35));
  if (boom) { cam.shake = 15; G.slowmo = 0.45; car.dizzy = 1; addText(car.x, car.y, pick(['BOOM!', 'WHAM!', 'CRUNCH!', 'POW!']), '#ff7a3d', 30, 0.9); Sound.boing(); }
  Injury.hit(car, boom ? 'boom' : car === G.O[0] && G.bstate === 'snap' ? 'sack' : 'tackle');
  car.down = 1.2; car.downDir = dirOf(df.side); car.vx = df.vx * 0.4; car.vy = df.vy * 0.4; car.mouth = 'O'; car.mouthT = 1.2;
  df.down = 0.9; df.downDir = car.downDir; df.dive = 0;
  car.head.vx += rand(-400, 400); car.head.vy -= 200;
  addStars(car.x, car.y);
  const st = stat(df);
  // fumble?
  df.hit = 0;
  if ((G.bstate === 'run' || stick) && !xfOn(car, 'truzz') && chance((0.022 + (hitters > 1 ? 0.02 : 0) + (stick ? 0.3 : 0) + Weather.fumbleBonus()) * tuckFumbleMul(car) * carMul(car) * (abHas(car, 'secure') ? 0.6 : 1) * Sliders.mul('fum'))) {
    b.holder = null; b.x = car.x; b.y = car.y;
    b.loose = { vx: rand(-4, 4), vy: rand(-3, 3), t: 0 };
    Review.fumbleCall(car);
    G.bstate = 'loose'; showBanner('FUMBLE!', '', '#ff9a3d', 1.0); car.down = 0.9; b.fumbler = car;
    return;
  }
  st.tkl++;
  if (!G.special && !G.mini && !G.twoPt && chance(0.005)) { throwFlag('FACEMASK', df.side, car.x, car.y, df); car.head.rot = 0.6; car.head.vx += 600; } // grabbed the face mask
  const sack = car === G.O[0] && G.bstate === 'snap' && !G.play.off.qbRun && dirOf(G.poss) * (car.x - G.los) <= 0; // a QB draw stopped short is a run, not a sack
  if (sack) { st.sack++; showBanner('SACKED!', df.name, '#ff6040', 1.2); }
  endPlay({ type: sack ? 'sack' : 'tackle', carrier: car, x: car.x, y: car.y });
}

function updateLoose(dt) {
  const b = G.ball, l = b.loose;
  if (l.blk) return blkBounce(dt); // blocked kick (special.js)
  l.t += dt; b.x += l.vx * dt; b.y += l.vy * dt; l.vx *= 0.96; l.vy *= 0.96;
  b.z = Math.abs(Math.sin(l.t * 9)) * 0.8 * Math.max(0, 1 - l.t);
  b.spin = (b.spin || 0) + dt * 10;
  if (b.y < 0 || b.y > FIELD_W) { // rolled out: last team to have it keeps it
    b.loose = null; endPlay({ type: 'oob', carrier: G.O[1].side === G.poss ? G.O[1] : null, x: b.x, y: b.y, keep: true }); return;
  }
  if (l.punt && puntRoll(l)) return; // a punt nobody caught (special.js)
  if (l.t < 0.3) return;
  for (const p of G.players) if (p.down <= 0 && dist(p, b) < 0.9) {
    if (l.punt) return puntTouch(p);
    if (G.special === 'fgblock') return blkTouch(p); // blocked kick: the defense can run with it
    b.loose = null; b.holder = p; Sound.catch();
    if (p.side !== G.poss) { G.tstats[G.poss].to++; showBanner('RECOVERED!', p.name, '#ff5050', 1.3); if (b.fumbler && b.fumbler.side === G.poss) { const t = stat(b.fumbler); t.tov = (t.tov || 0) + 1; } }
    else showBanner('RECOVERED!', p.name, '#9cff9c', 1.1);
    b.fumbler = null;
    endPlay({ type: 'fumble', carrier: p, x: p.x, y: p.y });
    return;
  }
}

function checkBounds() {
  const car = G.ball.holder; if (!car) return;
  const s = car.side, d = dirOf(s);
  if (d * (car.x - goalX(s)) >= 0) { return endPlay({ type: 'td', carrier: car, x: car.x, y: car.y }); }
  if (car.y < 0 || car.y > FIELD_W || car.x < 0 || car.x > 120) {
    addText(car.x, clamp(car.y, 1, FIELD_W - 1), 'OUT OF BOUNDS', '#fff', 14, 1);
    endPlay({ type: 'oob', carrier: car, x: clamp(car.x, 0, 120), y: car.y });
  }
}

// ---------------- end of a play ----------------
function endPlay(res) {
  if (G.phase !== 'live') return;
  if (res.x != null && !isFinite(res.x)) res.x = G.los; // never let a broken spot become the new line of scrimmage
  if (res.y != null && !isFinite(res.y)) res.y = G.ballY;
  G.phase = 'dead'; G.deadT = 1.15; G.showTarget = false; G.aim = null; G.meter = null; G.meterV = null;
  Sound.whistle();
  for (const p of G.players) { p.throwKey = 0; p.engaged = null; }
  G.flagNote = null; G.pendingRunoff = 0;
  if (G.special) { const fl = G.flags; G.flags = []; return endReturn(res, fl); } // (a punt can carry a roughing-the-kicker flag)
  const d0 = G.down;
  if (G.flags && G.flags.length) G.rv = null; else res = Review.call(res); // close calls: the officials can miss one (rules.js)
  G.lastResult = pbpPlay(res);
  if (!G.reviewing) xfAfterPlay(res, G.lastResult); // (an overturned call already counted the play once)
  if (G.flags && G.flags.length) { if (G.twoPt) G.flags = []; else if (enforcePenalty(res)) return; }
  const off = G.poss, d = dirOf(off);
  const car = res.carrier;
  const cs = car ? car.side : off;
  let x = res.x != null ? res.x : G.los;
  let next = null;

  // stats credit (offense keeps the ball)
  if (G.credit && cs === off && res.type !== 'inc') {
    const yds = Math.round(d * (Math.min(d > 0 ? 110 : 120, Math.max(d > 0 ? 0 : 10, x)) - G.los));
    const c = G.credit;
    if (c.kind === 'rush') { stat(c.p).rush += yds; G.tstats[off].rush += yds; }
    else { stat(c.p).rec += yds; stat(c.passer).pass += yds; G.tstats[off].pass += yds; }
  }
  if (res.type === 'sack') { const yds = Math.round(d * (x - G.los)); G.tstats[off].pass += yds; }

  if (G.twoPt) {
    if (res.type === 'td' && cs === off) { G.score[off] += 2; showBanner('TWO POINTS!', '', '#9cff9c', 1.8); Sound.td(); addPbp('Two-point try is GOOD.'); }
    else showBanner('NO GOOD', '2-point try fails', '#ff6040', 1.5);
    G.twoPt = false; G.patSide = null;
    next = { kickoff: off };
  } else if (res.type === 'td') {
    G.score[cs] += 6; G.deadT = isHumanSide(cs) ? 3.8 : 2.5;
    if (isHumanSide(cs) && !coachOn()) { G.cellyGuy = car; car.down = 0; car.dive = 0; } else { car.down = 0; car.dive = 0; Celly.cpu(car); }
    // he trots a few yards into the end zone so the celly isn't buried in the pile
    const gx = goalX(cs), gd = dirOf(cs); G.tdScorer = car;
    car.tdRun = { x: gd * (car.x - gx) >= 3 ? car.x : gx + gd * 3.5, y: clamp(car.y, 9, FIELD_W - 9) };
    showBanner('TOUCHDOWN!', `${car.name} • ${G.teams[cs].city} ${G.teams[cs].name}`, isHumanSide(cs) ? '#ffd23f' : '#ff6040', 2.6);
    Sound.td(); G.crowdHype = 1.5; stat(car).td++; G.slowmo = 0.9;
    if (typeof Unlocks !== 'undefined' && isHumanSide(cs) && !G.versus && !G.mini && !G.practice) Unlocks.td();
    for (const q of G.players) if (q.side === cs) q.celebrate = 2.6;
    for (let i = 0; i < 70; i++) G.fx.push({ kind: 'confetti', px: rand(0, CW), py: rand(-200, 0), vy: rand(120, 260), vx: rand(-40, 40), z: 0, vz: 0, color: pick([G.teams[cs].c1, G.teams[cs].c2, '#fff']), life: 2.6, max: 2.6 });
    if (G.credit && G.credit.passer && cs === off) stat(G.credit.passer).td++;
    for (let i = 0; i < 25; i++) G.fx.push({ kind: 'star', x: car.x + rand(-4, 4), y: car.y + rand(-4, 4), z: rand(0, 40), vz: rand(20, 60), life: 1.4, max: 1.4 });
    next = { pat: cs };
  } else if (res.type === 'inc') {
    showBanner('INCOMPLETE', G.flagNote || '', '#ffffff', 0.9);
    next = advanceDown(G.los, false);
  } else if (cs !== off) { // takeaway
    const cd = dirOf(cs);
    if (cd * (x - ownGoal(cs)) <= 0) { x = ownGoal(cs) + cd * 20; addText(x, MID, 'TOUCHBACK', '#fff', 18, 1.2); }
    if (res.type !== 'fumble') showBanner('TURNOVER!', `${G.teams[cs].name} ball`, '#ff9a3d', 1.4);
    next = { drive: cs, x };
  } else if (d * (x - ownGoal(off)) <= 0) {
    G.score[1 - off] += 2; showBanner('SAFETY!', '+2', '#ff6040', 1.8);
    next = { kickoff: off, from: 20 };
  } else {
    G.ballY = clamp(res.y != null ? res.y : G.ballY, 20, FIELD_W - 20);
    next = advanceDown(x, true);
    if (res.type !== 'oob') { G.pendingRunoff = 9; G.runFrom = G.time; }
  }
  G.next = next;
  Momentum.afterPlay(res, d0);
  Review.open();
}

function advanceDown(x, moved) {
  const d = dirOf(G.poss);
  if (moved) {
    const gain = Math.round(d * (x - G.los));
    G.los = clamp(x, 11, 109);
    if (d * (G.los - G.firstDownX) >= -0.05) {
      const t = G.tstats && G.tstats[G.poss];
      if (t) { t.fd = (t.fd || 0) + 1; if (G.down === 3) t.c3 = (t.c3 || 0) + 1; }
      G.down = 1; setFirstDown();
      if (!G.banner || G.banner.t > 0.5) showBanner('FIRST DOWN!', gain > 0 ? `+${gain} yards` : '', '#9cff9c', 1.1);
      return null;
    }
    if (gain !== 0 && (!G.banner || G.banner.t > 0.8)) addText(x, G.ballY - 4, (gain > 0 ? '+' : '') + gain + ' YDS', gain > 0 ? '#9cff9c' : '#ff8a8a', 18, 1.2);
  }
  G.down++;
  if (G.down > 4) {
    showBanner('TURNOVER ON DOWNS', '', '#ff9a3d', 1.5);
    return { drive: 1 - G.poss, x: G.los };
  }
  return null;
}

function afterPlay() {
  const n = G.next; G.next = null;
  Injury.announce();
  for (const p of G.players) { if (p.celly) Celly.end(p); p.tdRun = null; p.cellyNext = null; }
  G.cellyGuy = null; G.tdScorer = null;
  G.runoff = 0;
  if (G.practice && typeof Practice !== 'undefined') return Practice.afterPlay(n); // practice: back to the same spot
  if (G.twoMinAfterPlay) { G.pendingRunoff = 0; if (G.quarter === G.twoMinQ || G.clock <= 0) G.twoMinAfterPlay = false; else twoMinWarning(); }
  if (G.mini && typeof miniAfterPlay === 'function') return miniAfterPlay();
  // overtime is sudden death
  if (G.quarter >= 5 && G.score[0] !== G.score[1]) return gameOver();
  if (n && n.pat != null) { G.patSide = n.pat; G.poss = n.pat; G.los = goalX(n.pat) - dirOf(n.pat) * 3; G.ballY = MID; return toPlayCall(); }
  if (G.clock <= 0 && G.quarter > 0 && endQuarter()) return;
  if (n && n.kickoff != null) return startKickoff(n.kickoff, n.from || 35);
  if (n && n.drive != null) {
    setDrive(n.drive, n.own != null ? ownGoal(n.drive) + dirOf(n.drive) * n.own : clamp(n.x, 11, 109));
  }
  toPlayCall();
}

function endQuarter() {
  G.pendingRunoff = 0; // new quarter: clock waits for the snap
  TwoWay.rest(G.quarter === 2);
  if (G.quarter === 2) {
    Injury.half();
    G.quarter = 3; G.clock = G.qtrLen; G.timeouts = [3, 3];
    showBanner('HALFTIME', `${G.teams[1].id} ${G.score[1]}  -  ${G.teams[0].id} ${G.score[0]}`, '#fff', 2.5);
    startKickoff(G.firstPoss); // the team that got the ball first kicks off now
    if (G.hooks.onHalftime) G.hooks.onHalftime();
    return true;
  } else if (G.quarter >= 4) {
    if ((G.quarter === 4 || G.playoff) && G.score[0] === G.score[1]) {
      G.quarter = Math.max(5, G.quarter + 1); G.clock = G.qtrLen; G.timeouts = [2, 2];
      const s = chance(0.5) ? 0 : 1;
      showBanner('OVERTIME!', `Next score wins • ${G.teams[s].name} get the ball`, '#ffd23f', 2.5);
      startKickoff(1 - s);
      return true;
    } else { gameOver(); return true; }
  } else {
    G.quarter++; G.clock = G.qtrLen;
    showBanner(`END OF ${ordinal(G.quarter - 1).toUpperCase()}`, '', '#fff', 1.4);
  }
  return false;
}

function gameOver() {
  G.phase = 'over';
  if (typeof SaveGame !== 'undefined') SaveGame.clear();
  const all = Object.values(G.pstats);
  const top = (k, side) => all.filter(s => s.side === side && s[k] > 0).sort((a, b) => b[k] - a[k])[0];
  G.hooks.onGameOver({
    score: G.score.slice(), teams: G.teams, human: G.human, tstats: G.tstats,
    leaders: [0, 1].map(s => ({ pass: top('pass', s), rush: top('rush', s), rec: top('rec', s), tkl: top('tkl', s), int: top('int', s), sack: top('sack', s), blk: top('blk', s) }))
  });
}

// ---------------- kicks (punt, field goal, extra point) ----------------
function kickerOf(side, kind) {
  const t = G.teams[side], k = kind === 'punt' ? t.p : t.k;
  const r = k && k[4] && k[4].r ? Ratings.clean(k[4].r, k[2], 0, true) : null; // kick power / accuracy offsets
  return k ? { name: k[0], num: k[1], ovr: k[2], skin: k[3], kp: clamp(k[2] + ((r && r.KPW) || 0), 20, 99), ka: clamp(k[2] + ((r && r.KAC) || 0), 20, 99) } : { name: t.name + (kind === 'punt' ? ' Punter' : ' Kicker'), num: kind === 'punt' ? 4 : 3, ovr: 74, kp: 74, ka: 74 };
}
const fgRange = ovr => 42 + (ovr - 60) * 0.6 + Weather.kickRange();   // 90 OVR kicker ≈ 60 yards, 70 OVR ≈ 48
function fgTol(yds, ovr) { return clamp(0.3 - (yds - 20) * 0.0045, 0.07, 0.3) * (0.75 + (ovr - 60) / 120); }

function doKick(kind) {
  const s = G.poss, d = dirOf(s);
  if (kind === 'punt') { G.kickFrom = null; setupReturn('punt', s); G.poss = 1 - s; return startKickMeter('punt', s); }
  setupPlay(OFF_PLAYS[2], DEF_PLAYS[0], true);
  const kk = kickerOf(s, kind);
  const kicker = G.O[0];
  Object.assign(kicker, { name: kk.name, num: kk.num, ovr: kk.ovr, pos: kind === 'punt' ? 'P' : 'K', cap: false, xf: null, ab: null, rt: null });
  if (kk.skin != null) kicker.face.skin = kk.skin;
  const live = fgSetup(kind); // live play: snap, hold, the line blocks, the defense rushes (special.js)
  const yds = kind === 'xp' ? 33 : kind === 'fg' ? Math.round(Math.abs(goalX(s) - G.los) + 17) : 0;
  const ovr = kk.ka, pw = kk.kp; // accuracy runs the meter + the green zone, power the range
  G.km = { kind, yds, kk, stage: 0, t: 0, power: 0, aim: 0, side: s,
           rateP: 0.7 + (90 - ovr) * 0.015, rateA: 0.6 + (90 - ovr) * 0.015,
           need: kind === 'punt' ? 0 : yds / fgRange(pw), tol: kind === 'punt' ? 0.35 : Math.min(0.45, fgTol(yds, ovr) * (kind === 'xp' ? 1.6 : 1.35)), live };
  if (yds >= 45 && abFor(kk.name).some(a => a.fx === 'zen')) { G.km.rateP *= 0.85; G.km.rateA *= 0.85; G.km.tol *= 1.1; } // Zen Kicker
  G.playClock = 0;
  if (isHumanSide(s) && !G.demo && !G.sitOut && !autoKick()) { G.phase = 'kickmeter'; G.km.wait = 0.35; return; } // setting the power snaps it
  // computer kicks: roll the dice using the kicker's rating
  const km = G.km;
  const pGood = kind === 'xp' ? clamp(0.86 + (ovr - 70) * 0.005, 0.8, 0.98) : clamp(1.0 - Math.max(0, yds - 25) * 0.021 * (1 + (78 - ovr) / 40), 0.03, 0.97);
  const good = chance(pGood);
  km.power = good ? Math.max(km.need + 0.05, rand(0.8, 1)) : (km.need > 0.85 && chance(0.5) ? km.need - rand(0.05, 0.2) : rand(Math.min(1, km.need + 0.05), 1));
  km.aim = good ? rand(-km.tol * 0.8, km.tol * 0.8) : (km.power < km.need ? rand(-0.2, 0.2) : pick([-1, 1]) * rand(km.tol * 1.15, km.tol * 2.2));
  G.phase = 'kickmeter'; km.stage = 3; km.cpuT = Infinity; km.locked = true; // fgLive snaps it and kicks it
}

const tri = t => 1 - Math.abs(((t % 2) + 2) % 2 - 1); // 0..1..0
// wind for this game: none in a dome, more when it's raining or snowing. dir +1 pushes the ball down the screen
function gameWind() {
  if (!G.wind) { const dome = typeof stadiumOf === 'function' && G.teams && stadiumOf(G.teams[0]).dome; G.wind = { mph: dome || G.mini ? 0 : Math.round(rand(0, 13) + (G.weather === 'rain' || G.weather === 'snow' ? 6 : 0)), dir: chance(0.5) ? 1 : -1 }; }
  return G.wind;
}
// simple 2-tap kick meter: tap to lock the POWER as the bar fills, then tap to lock the AIM when the slider is in the green.
// Better kickers move slower and get a wider green zone. No wind on field goals.
function updateKickMeter(dt) {
  const km = G.km;
  km.t += dt;
  if (km.live && km.cpuT != null) return; // CPU field goal: fgLive runs it
  if (km.cpuT != null) { km.cpuT -= dt; if (km.cpuT <= 0) { km.cpuT = null; launchReturnKick(); } return; }
  if (km.wait > 0) { km.wait -= dt; Input.taps.length = 0; km.t = 0; return; }
  const L = km.live, rushed = L && L.snapT != null && L.t - L.snapT > 2.6; // took too long: he has to kick it now
  const press = Input.hit('Space') || Input.taps.length > 0 || (km.stage === 1 && rushed);
  if (km.stage === 0) { // power bar fills up and back down
    km.power = tri(km.t * km.rateP);
    if (press) { km.stage = 1; km.t2 = 0; Sound.click(); if (L) fgSnap(); } // field goals: setting the power snaps the ball
  } else if (km.stage === 1) { // aim slider sweeps left and right
    km.t2 += dt;
    km.aim = tri(km.t2 * km.rateA) * 2 - 1;
    if (press) {
      km.stage = 2; Sound.click();
      if (km.kind === 'punt' || km.kind === 'ko' || km.kind === 'onside') { const w = gameWind(); km.aim = clamp(km.aim + w.dir * w.mph / 15 * 0.12, -1, 1); }
      const good = Math.abs(km.aim) <= km.tol;
      if (km.kind === 'fg' || km.kind === 'xp') addText(G.los, G.ballY - 8, km.power < km.need ? 'NOT ENOUGH LEG' : good ? (Math.abs(km.aim) < km.tol * 0.35 ? 'PERFECT!' : 'GOOD CONTACT') : km.aim > 0 ? 'PUSHED IT' : 'PULLED IT', good && km.power >= km.need ? '#9cff9c' : '#ff8a8a', 18, 1.2);
      if (L) km.locked = true; // the kick goes when the kicker gets to the ball (fgLive)
      else (km.kind === 'punt' || km.kind === 'ko' || km.kind === 'onside') ? launchReturnKick() : launchKick();
    }
  }
}

function launchKick() {
  const km = G.km, s = km.side, d = dirOf(s), kicker = G.O[0];
  const k = { kind: km.kind, t: 0, side: s, yds: km.yds };
  if (km.kind === 'punt') {
    let dist = 30 + km.power * (18 + (km.kk.kp - 60) * 0.35);
    const shank = Math.abs(km.aim) > 0.75;
    if (shank) dist *= 0.55;
    k.land = G.los + d * dist - d * 12 + d * 12; // measured from the line
    k.ty = G.ballY + km.aim * 24;
    k.oob = k.ty < 0 || k.ty > FIELD_W;
    if (k.oob) { const f = (k.ty < 0 ? -G.ballY : FIELD_W - G.ballY) / (k.ty - G.ballY); k.land = G.los + d * dist * f; k.ty = clamp(k.ty, -1, FIELD_W + 1); }
    k.shank = shank; k.T = 1.4 + km.power * 1.4; k.peak = 8 + km.power * 10;
  } else {
    const range = fgRange(km.kk.kp), f = km.power / km.need, half = 3.08, bar = 3.33; // posts: same size as draw.js GPOST
    k.short = km.power < km.need;
    k.good = !k.short && Math.abs(km.aim) <= km.tol;
    // the flight only shows the result decided above: zEnd = height when it gets to the posts
    const clear = bar + 1.5 + 4 * clamp((km.power - km.need) / 0.5, 0, 1); // more leg = clears the bar by more
    if (k.short && f < 0.9) { k.land = G.los - d * 7 + d * Math.max(10, km.power * range); k.ty = MID + km.aim * 6; k.zEnd = 0; } // dies in front
    else {
      k.land = goalX(s) + d * 10;
      if (k.short) { // just short: under the bar, or off the crossbar
        k.ty = MID + km.aim * 6;
        if (f >= 0.97 && Math.abs(k.ty - MID) < half - 0.3) { k.hit = 'bar'; k.zEnd = bar - 0.05; } else k.zEnd = 0.8 + (f - 0.9) * 22;
      } else if (k.good) { k.ty = MID + (km.aim / km.tol) * 2.6; k.zEnd = clear; }
      else { // wide: barely wide doinks off the upright
        const over = Math.abs(km.aim) - km.tol;
        k.hit = over < km.tol * 0.25 ? 'post' : null;
        k.ty = MID + Math.sign(km.aim || 1) * (k.hit ? half : half + 0.6 + over * 5); k.zEnd = clear;
      }
    }
    k.T = 1.25 + km.yds / 60; k.peak = 7 + km.power * 5;
    // one arc that lands past the posts: k.up = how far along it the posts are (k.T = time to the posts)
    if (k.zEnd > 0) { k.peak = Math.max(k.peak, k.zEnd / 0.95); k.up = (1 + Math.sqrt(1 - k.zEnd / k.peak)) / 2; }
  }
  k.sx = G.ball.x; k.sy = G.ball.y;
  G.kick = k; G.phase = 'kick';
  if (kicker.kickT == null) kicker.kickT = KICK_HIT; kicker.vx = d * 4; // follow-through (a live kick already started his swing)
  Sound.tone(140, 0.15, 'square', 0.15, -40); Sound.tone(90, 0.12, 'sine', 0.2);
  if (km.kind === 'fg') addText(G.los, G.ballY - 6, `${km.yds} YARD TRY`, '#fff', 18, 1.5);
}

// after the posts: the ball sails on into the net, drops and skips
function kickCarry(k, b, dt) {
  const c = k.carry; if (!c) return;
  b.x += c.vx * dt; b.y += c.vy * dt; c.vz -= (c.g || 30) * dt; b.z = Math.max(0, (b.z || 0) + c.vz * dt); b.spin = (b.spin || 0) + dt * 14;
  if (b.z <= 0) { if (Math.abs(c.vz) > 4) { c.vz = -c.vz * 0.35; b.z = 0.01; } else c.vz = 0; c.vx *= 0.9; c.vy *= 0.9; }
}
function updateKick(dt) {
  const k = G.kick, b = G.ball;
  k.t += dt;
  if (k.done && k.carry) { kickCarry(k, b, dt); k.wait -= dt; if (k.wait <= 0) afterPlay(); return; } // past the posts: keep it flying
  const u = Math.min(1, k.t / k.T);
  b.x = lerp(k.sx, k.land, u); b.y = lerp(k.sy, k.ty, u);
  const ua = u * (k.up || 1); // how far along the whole arc
  b.z = k.peak * 4 * ua * (1 - ua); b.spin = (b.spin || 0) + dt * 14;
  if (u < 1) return;
  if (k.done) { if (k.carry) kickCarry(k, b, dt); k.wait -= dt; if (k.wait <= 0) afterPlay(); return; }
  if (k.kind !== 'punt' && k.up) { // field goals keep flying through (or past, or under) the uprights on the same arc
    const w = k.up / k.T, c = k.carry = { vx: (k.land - k.sx) / k.T, vy: (k.ty - k.sy) / k.T, vz: 4 * k.peak * (1 - 2 * k.up) * w, g: 8 * k.peak * w * w };
    if (k.hit) { // doink: bounces back off the upright (out wide) or the crossbar
      c.vx *= -0.18; c.vz = k.hit === 'bar' ? 5 : 2; c.g = 30; c.vy = k.hit === 'post' ? Math.sign(k.ty - MID) * 3 : c.vy * 0.3;
      Sound.tone(1250, 0.16, 'sine', 0.16, -500); cam.shake = Math.max(cam.shake, 3); addText(k.land, k.ty, 'DOINK!', '#ffd400', 22, 1.1);
    }
    b.x = k.land; b.y = k.ty; kickCarry(k, b, 0);
  }
  k.done = true; k.wait = 1.7;
  const s = k.side, d = dirOf(s);
  if (k.kind === 'punt') {
    let x = k.land;
    if (d * (x - goalX(s)) >= 0) { x = goalX(s) - d * 20; showBanner('TOUCHBACK', '', '#fff', 1.2); }
    else {
      const yl = Math.round(d * (goalX(s) - x));
      addPbp(`${G.km.kk.name.split(' ').slice(-1)[0]} punts ${yd(Math.round(Math.abs(x - G.los)))}${k.shank ? ', shanked' : k.oob ? ', out of bounds' : ''}.`);
      showBanner(k.shank ? 'SHANKED!' : k.oob ? 'OUT OF BOUNDS' : 'PUNT', `${Math.round(Math.abs(x - G.los))} yards${yl <= 10 ? ` • pinned at the ${yl}!` : ''}`, k.shank ? '#ff6040' : '#fff', 1.4);
    }
    G.next = { drive: 1 - s, x }; G.runoff = 6;
  } else if (k.kind === 'fg') {
    if (G.mini) { k.wait = 1.4; G.miniKick = k.good; showBanner(k.good ? "IT'S GOOD!" : k.short ? 'SHORT!' : 'NO GOOD!', `${k.yds} yards`, k.good ? '#9cff9c' : '#ff6040', 1.3); (k.good ? Sound.td() : Sound.bad()); return; }
    addPbp(`${lastName(G.km.kk.name)} ${k.yds}-yard field goal is ${k.good ? 'GOOD' : k.short ? 'short' : 'no good'}.`);
    if (k.good) { G.score[s] += 3; showBanner("IT'S GOOD!", `${k.yds}-yard field goal`, '#9cff9c', 1.8); Sound.td(); G.next = { kickoff: s }; }
    else { showBanner(k.short ? 'SHORT!' : 'NO GOOD!', k.short ? (k.hit ? `${k.yds} yards, off the crossbar` : `${k.yds} yards was too far`) : k.hit ? `${k.yds}-yard try hits the upright` : `${k.yds}-yard try is ${k.ty < MID ? 'wide left' : 'wide right'}`, '#ff6040', 1.6); Sound.bad(); G.next = { drive: 1 - s, x: d * (G.los - (goalX(s) - d * 20)) > 0 ? goalX(s) - d * 20 : G.los }; }
    G.runoff = 5; Momentum.kick(k.good ? 'fg' : 'fgmiss', s);
  } else { // xp
    addPbp(`${lastName(G.km.kk.name)} extra point is ${k.good ? 'good' : 'NO GOOD'}.`);
    if (k.good) { G.score[s] += 1; showBanner('EXTRA POINT GOOD', '', '#9cff9c', 1.2); Sound.catch(); }
    else { showBanner('XP MISSED!', '', '#ff6040', 1.3); Sound.bad(); }
    G.patSide = null; G.next = { kickoff: s };
  }
  if (G.km && G.km.live && G.km.live.flag) kickFoul(k); // roughing / running into the kicker (special.js)
}

function updateBallPhysicsDead(dt) {
  const b = G.ball; if (!b || !b.dead || b.holder) return;
  b.x += b.dead.vx * dt; b.y += b.dead.vy * dt; b.dead.vx *= 0.94; b.dead.vy *= 0.94;
  if (b.bounce) { b.bounce -= dt; b.z = Math.abs(Math.sin(b.bounce * 9)) * b.bounce * 2.2; b.spin = (b.spin || 0) + dt * 20; }
  else b.z = Math.max(0, b.z - dt * 4);
}

// ---------------- fx / camera / hints ----------------
// floating words stack instead of piling on top of each other (max 2 at one spot, newest on top)
function addText(x, y, text, color, size = 18, life = 1) {
  const near = G.fx.filter(f => f.kind === 'text' && Math.abs(f.x - x) < 4 && Math.abs(f.y - y) < 2.5 && f.life > 0.15);
  if (near.length >= 2) { const old = near.sort((a, b) => a.life - b.life)[0]; old.life = 0; }
  const z = 40 + near.filter(f => f.life > 0).reduce((m, f) => Math.max(m, f.z - 40 + 24), 0);
  G.fx.push({ kind: 'text', x, y, text, color, size, z, vz: 30, life, max: life });
}
function addDust(x, y, n) { for (let i = 0; i < n; i++) G.fx.push({ kind: 'dust', x: x + rand(-0.6, 0.6), y: y + rand(-0.6, 0.6), z: 0, vz: rand(5, 20), r: rand(3, 6), life: 0.5, max: 0.5 }); }
function addStars(x, y) { for (let i = 0; i < 5; i++) G.fx.push({ kind: 'star', x: x + rand(-1, 1), y: y + rand(-1, 1), z: 20 + rand(0, 20), vz: rand(20, 50), life: 0.8, max: 0.8 }); addDust(x, y, 6); }
function showBanner(text, sub, color, dur) { G.banner = { text, sub, color, t: 0, dur }; }
function updateFx(dt) {
  for (const f of G.fx) { f.life -= dt; f.z += f.vz * dt; if (f.kind === 'confetti') { f.px += f.vx * dt; f.py += f.vy * dt; } if (f.kind === 'flag') f.t += dt; }
  G.fx = G.fx.filter(f => f.life > 0);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  cam.shake *= Math.pow(0.02, dt);
}
function updateCamera(dt) {
  if (!G.teams) return;
  if (G.mini && G.phase === 'mini') return;
  if (!isFinite(cam.x) || !isFinite(cam.y)) { cam.x = 60; cam.y = MID; }
  const b = G.ball;
  let tx = G.los != null ? G.los + dirOf(G.poss) * 8 : 60;
  if (G.phase === 'live' || G.phase === 'dead' || G.phase === 'kick') {
    if (b && b.holder) tx = b.holder.x + dirOf(b.holder.side) * 6;
    else if (b) tx = b.x;
  }
  const half = CW / 2 / (PX * viewZ); // (CAMERA zoomed out = sees more)
  const kicking = G.phase === 'kick' || G.phase === 'kickmeter';
  if (G.phase === 'kickmeter' && G.km && G.km.kind !== 'punt') { // show the posts while you aim, but keep the kick spot + the rush in view
    const d = dirOf(G.poss), keep = G.los + d * (half - 14); // the kicker (~10 yards back) stays on screen
    tx = lerp(G.los, goalX(G.poss) + d * 10, 0.6); tx = d > 0 ? Math.min(tx, keep) : Math.max(tx, keep);
  }
  const kk = G.kick || G.km, fgk = G.phase === 'kick' && kk && (kk.kind === 'fg' || kk.kind === 'xp') && b;
  if (fgk) { // field goal in the air: frame the ball and the posts, then hold with the posts in view while it sails through
    const d = dirOf(kk.side), ex = d > 0 ? 120 : 0;
    tx = lerp(b.x, ex, 0.5); tx = d > 0 ? Math.min(tx, ex - half * 0.3) : Math.max(tx, ex + half * 0.3);
  }
  const cel = G.phase === 'dead' ? G.players.find(p => p.celly) : null;
  if (cel) tx = cel.x; // follow the celebration (the Lambeau Leap goes right into the stands)
  tx = fgk ? clamp(tx, half * 0.3, 120 - half * 0.3) : clamp(tx, half - (kicking || cel ? 9 : 5), (kicking || cel ? 129 : 125) - half);
  cam.x = lerp(cam.x, tx, 1 - Math.exp(-dt * 4));
  let ty = MID;
  if (b && (G.phase === 'live' || G.phase === 'dead')) ty = lerp(MID, b.holder ? b.holder.y : b.y, 0.4);
  const yr = Math.max(0, 6 - (1 / viewZ - 1) * 15), yc = MID + (1 - viewZ) * 6; // zoomed out: the whole width is in view, so hold still (a bit low = less sky past the stands)
  cam.y = lerp(cam.y, clamp(ty, yc - yr, yc + yr), 1 - Math.exp(-dt * 3));
  // celly cam: push in on the guy celebrating
  const cg = G.phase === 'dead' ? G.players.find(p => p.celly) : null;
  if (cg) cam.focus = { x: cg.x + (cg.celly.type === 'bowl' ? (cg.face.dir || 1) * 3.5 : 0), y: cg.y };
  cam.zoom = lerp(cam.zoom || 1, cg ? 1.6 / viewZ : 1, 1 - Math.exp(-dt * (cg ? 3 : 6))); // (same push-in size whatever the CAMERA setting)
  if (!cg && cam.zoom < 1.01) cam.zoom = 1;
}
function updateHint() {
  if (!G.teams) return;
  const km = G.km, def = km ? 1 - km.side : -1;
  if (G.versus && !G.online && G.phase === 'kickmeter' && km && (km.kind === 'fg' || km.kind === 'xp') && G.hp && G.hp[def] && !G.hp[def].off) { G.hint = `${pName(def)}: BLOCK THE KICK!  •  ${def === G.p1 ? 'WASD rush  •  SPACE jump  •  E swim' : 'ARROWS rush  •  ENTER jump  •  / swim'}`; return; }
  const ph = puntHint(); if (ph != null) { G.hint = ph; return; } // live punt: rush it / fair catch (special.js)
  if (fgRushing() && !coachOn()) { // you're rushing the kick
    G.hint = G.mode === 'mobile' ? 'BLOCK THE KICK!  •  Stick to rush  •  TAP = jump (swim when blocked)' : 'BLOCK THE KICK!  •  WASD rush  •  SPACE jump  •  E swim' + (G.lock ? '' : '  •  Q switch');
    return;
  }
  if (G.phase === 'kickmeter' || G.mini) { G.hint = ''; return; }
  if (G.cellyGuy && G.phase === 'dead') { G.hint = G.versus && !G.online ? `${pName(G.cellyGuy.side)}: CELEBRATE!` : G.mode === 'mobile' ? '' : 'CELLY:  ↑ Leap  ↓ Griddy  ← Spike  → Dab   1 Flex  2 Bow  3 Shush  4 Moonwalk   E Nap   F Bowling' + (G.weather === 'snow' ? '   R Snow Angel' : G.weather === 'rain' ? '   C Mud Slide' : '') + (clubCelly(G.cellyGuy) ? `   G ${clubCelly(G.cellyGuy).name}` : '') + CELLYS.filter(c => c.lock && Unlocks.has(c.id)).map(c => `   ${CELLY_KEY_NAME[c.keys[0]]} ${c.name}`).join(''); return; }
  if (coachOn()) { G.hint = G.phase === 'presnap' && G.poss === G.human ? (G.mode === 'mobile' ? 'You call the plays, your team plays them  •  TAP to snap' : 'You call the plays, your team plays them  •  SPACE snap  •  Z audible  •  T timeout') : G.phase === 'presnap' || G.phase === 'live' ? 'You call the plays, your team plays them' + (G.phase === 'presnap' && G.mode !== 'mobile' ? '  •  Z audible  •  T timeout' : '') : ''; return; }
  if (G.mode === 'mobile') return updateHintMobile();
  if (G.versus && !G.online) {
    const k = s => s === G.p1 ? 'SPACE' : 'ENTER';
    G.hint = G.phase === 'presnap' ? `${pName(G.poss)} snaps with ${k(G.poss)}  •  ${pName(1 - G.poss)} picks a defender with ${G.poss === G.p1 ? 'L' : 'Q'}` : '';
    return;
  }
  const humanOff = G.poss === G.human;
  const b = G.ball;
  if (G.lock && G.phase === 'live' && humanOff && G.humanPlayer && G.humanPlayer !== G.O[0] && b.holder !== G.humanPlayer && !b.flight) { G.hint = 'PLAYER LOCK  •  WASD run your route  •  SPACE = call for the ball'; return; }
  if (G.lock && G.phase === 'presnap' && !humanOff) { G.hint = 'PLAYER LOCK: you play your guy  •  V press  •  B show blitz  •  T timeout'; return; }
  if (G.phase === 'presnap') G.hint = humanOff ? (G.play.off.type === 'run' ? 'SPACE snap  •  Z audible  •  T timeout' : `SPACE snap  •  1-4 hot route  •  M motion${G.versus ? '' : '  •  Z audible'}  •  T timeout`) : `Q / TAB pick defender  •  V press  •  B show blitz${G.versus ? '' : '  •  Z audible'}  •  T timeout`;
  else if (G.phase === 'live') {
    const h = G.humanPlayer;
    if (h && b.holder === h && h.side === G.human) G.hint = humanCanThrow() ? (meterOn() ? 'TAP 1-4 / click = lob  •  HOLD = power, let go in the green  •  X = QB run' : '1-4 or click a receiver to throw (SHIFT = bullet, CTRL = lob)  •  X = QB run') : 'WASD move  •  SHIFT sprint  •  E juke  •  F spin  •  R stiff arm';
    else if (h && (h.side !== G.poss || (b.holder && b.holder.side !== G.human))) G.hint = b.flight ? 'SPACE = JUMP for the pick!  •  WASD move' : h.engaged ? 'E = SWIM MOVE past the blocker!' : 'WASD move  •  SHIFT sprint  •  SPACE dive  •  C HIT STICK  •  Q switch';
    else G.hint = catchMeterOn() ? `Steer to the ball  •  HOLD ${ctlMobile() ? 'your finger on the field' : 'SPACE'} and let go in the green to catch` : 'Steer to the ball marker to catch it!';
  } else G.hint = '';
}

function updateHintMobile() {
  const humanOff = G.poss === G.human, b = G.ball, h = G.humanPlayer;
  if (G.lock && G.phase === 'live' && humanOff && h && h !== G.O[0] && b.holder !== h && !b.flight) { G.hint = 'PLAYER LOCK  •  hold to steer  •  TAP = call for the ball'; return; }
  if (G.lock && G.phase === 'presnap' && !humanOff) { G.hint = 'PLAYER LOCK: you play your guy'; return; }
  if (G.phase === 'presnap') G.hint = humanOff ? (G.play.off.type === 'pass' ? 'TAP field to snap  •  TAP a receiver = hot route' : 'TAP to snap') : 'SWITCH or TAP a defender to pick your guy';
  else if (G.phase === 'kickmeter') G.hint = '';
  else if (G.phase === 'live') {
    if (humanCanThrow()) G.hint = 'TAP a receiver = lob  •  HOLD = power, let go in the green  •  RUN = QB takes off';
    else if (h && b.holder === h) G.hint = 'Hold to steer  •  TAP = juke';
    else if (h && (h.side !== G.poss || (b.holder && b.holder.side !== G.human))) G.hint = b.flight ? 'TAP = JUMP for the pick!' : h.engaged ? 'SWIM to beat the blocker!' : 'Joystick / hold to move  •  TAP near runner = dive';
    else G.hint = '';
  } else G.hint = '';
}
