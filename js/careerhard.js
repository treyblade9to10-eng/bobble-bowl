// ---- Career: the hard parts. Depth chart (a rival can take your starting job), injuries, slumps, tougher CPU in your games ----
// c.depth = { team, yr, name, num, ovr, role: 'start' | 'bench', out }   c.inj = { wks, what }   c.slump = { g, d }   c.sit = games you sit (holdout etc.)
// c.form = last few grades, c.gn = games so far, c.hn = news for the hub (shown once)
const CH_FORM = { 'A+': 2, A: 1.5, 'B+': 1, B: 0.5, 'C+': 0, C: -0.5, D: -1, F: -2 };
const CareerHard = {
  off: null, // set while a game is simmed without you
  cap() { return Career.cap; },
  inNFL() { const c = this.cap(); return c && c.phase === 'nfl' && typeof Season !== 'undefined' && Season.slot === 'career' && !!Season.data; },
  yrTag() { const c = this.cap(); return c.phase === 'college' ? 'C' : this.inNFL() ? 'N' + (Season.data.year || 1) : null; },
  news(t) { const c = this.cap(); (c.hn || (c.hn = [])).push(t); if (c.hn.length > 3) c.hn.shift(); },
  // the guy you'd replace on the depth chart (the starter at your spot without you)
  myTeam() { const c = this.cap(); return c.phase === 'college' ? Career.collegeTeam(c.college.id) : Season.team(c.team); },
  findRival() {
    const was = Career.noCAP; Career.noCAP = true; let base;
    try { base = this.myTeam(); } finally { Career.noCAP = was; }
    const w = Career.withCAP(base);
    for (const side of ['off', 'def']) for (let i = 0; i < base[side].length; i++) if (w[side][i] !== base[side][i]) { const p = base[side][i]; return { name: p[1], num: p[2], ovr: p[3], age: (p[6] && p[6].age) || null }; }
    return null;
  },
  // how hard he is to beat for the job (on your scale: real college / NFL starters are rated way above a new prospect)
  jobRating(real) {
    const c = this.cap();
    if (c.phase === 'college') { const pr = (COLLEGES.find(t => t.id === c.college.id) || { pr: 1 }).pr; return Math.round(56 + pr * 2 + (real - 80) * 0.2 + rand(-2, 2)); }
    return clamp(Math.round(62 + (real - 70) * 0.5 + rand(-1, 1)), 58, 82);
  },
  // job battle: above 0 = you should start. Ratings, coach trust, recent form; a high pick / a big recruit gets the benefit of the doubt early
  battle() {
    const c = this.cap(), D = c.depth; if (!D) return 10;
    let b = Career.ovr() - D.ovr + ((c.trust || 0) - 40) * 0.12 + this.formPts() * 2 + (c.jobAdj || 0);
    if (c.phase === 'college') b += ((c.stars || 3) - 3) * 1.5;
    else if (c.draft && Career.yearNum() === 1) b += { 1: 6, 2: 3, 3: 1 }[c.draft.round] || 0;
    if (c.slump && c.slump.g > 0) b -= 2;
    return b;
  },
  formPts() { const f = (this.cap().form || []).slice(-3); return f.length ? f.reduce((a, g) => a + (CH_FORM[g] != null ? CH_FORM[g] : 0), 0) / f.length : 0; },
  // new team / new season: training camp decides who starts
  ensure() {
    const c = this.cap(); if (!c || (c.phase !== 'college' && !this.inNFL())) return;
    const yr = this.yrTag(), D = c.depth;
    if (D && D.team === c.team && D.yr === yr && D.pos === c.pos) return;
    const R = this.findRival(), was = D && D.team === c.team && D.role === 'start';
    c.jobAdj = 0;
    c.depth = { team: c.team, yr, pos: c.pos, name: R ? R.name : 'Nobody', num: R ? R.num : 0, ovr: R ? this.jobRating(R.ovr) : 40, role: 'start', out: 0 };
    const b = this.battle() + (was ? 3 : 0) + rand(-3, 3);
    c.depth.role = b >= 0 ? 'start' : 'bench';
    this.news(c.depth.role === 'start' ? `${c.phase === 'college' ? 'FALL CAMP' : 'TRAINING CAMP'}: you won the starting job over ${c.depth.name}.` : `${c.phase === 'college' ? 'FALL CAMP' : 'TRAINING CAMP'}: ${c.depth.name} starts ahead of you. Win the job.`);
    Career.save();
  },
  // what happens with you this week
  status() {
    const c = this.cap(); if (!c) return 'start';
    this.ensure();
    if (c.inj && c.inj.wks > 0) return 'hurt';
    if (c.sit > 0) return 'susp';
    if (typeof CareerSchool !== 'undefined' && CareerSchool.sits()) return 'acad';
    return c.depth && c.depth.role === 'bench' ? 'bench' : 'start';
  },
  canPlay() { return this.status() === 'start'; },
  // after every game (played or simmed)
  after(o) {
    const c = this.cap(); if (!c) return;
    const st = o.status || 'start';
    c.gn = (c.gn || 0) + 1; c.evDue = true; // (a career moment may come up next: careerevents.js)
    if (o.grade) { (c.form || (c.form = [])).push(o.grade); if (c.form.length > 5) c.form.shift(); }
    // this week's absence is used up
    if (st === 'hurt' && c.inj) { c.inj.wks--; if (c.inj.wks <= 0) { this.news(`HEALTHY: you're back from the ${c.inj.what}.`); c.inj = null; if (c.depth && c.depth.role === 'start' && this.battle() < 0 && chance(0.5)) { c.depth.role = 'bench'; this.news(`${c.depth.name} played well while you were out. He keeps the job for now.`); } } }
    if (st === 'susp' && c.sit > 0) c.sit--;
    if (c.slump && c.slump.g > 0 && st === 'start') { c.slump.g--; if (!c.slump.g) this.news('Slump over. You feel like yourself again.'); }
    // two bad grades in a row: a slump (a few points off for 2 games)
    if (o.grade && (o.grade === 'D' || o.grade === 'F') && c.form.length >= 2 && CH_FORM[c.form[c.form.length - 2]] <= -0.5 && !(c.slump && c.slump.g > 0) && c.gn - (c.slumpAt || -9) > 4) {
      c.slump = { g: 2, d: 3 }; c.slumpAt = c.gn; this.news('SLUMP: two rough games in a row. -3 to your ratings for the next 2 games.');
    }
    // knocked out? (more likely when you're tired or getting older)
    if (st === 'start') {
      const en = typeof CareerSchool !== 'undefined' ? CareerSchool.energy() : 70;
      const p = 0.03 + (en < 35 ? 0.04 : 0) + (c.phase === 'nfl' && c.age >= 31 ? 0.02 : 0) + (c.risk || 0);
      if (chance(p)) this.injure(chance(0.6) ? 1 : chance(0.75) ? 2 : 3);
    }
    c.risk = 0;
    this.depthWeek(st);
    Career.save();
  },
  injure(wks, what) {
    const c = this.cap(); what = what || pick(['ankle sprain', 'hamstring', 'shoulder', 'knee bruise', 'wrist', 'concussion check']);
    c.inj = { wks: Math.max(wks, (c.inj && c.inj.wks) || 0), what };
    this.news(`INJURY: ${what}. You're out ${c.inj.wks} game${c.inj.wks > 1 ? 's' : ''}.`);
  },
  depthWeek(st) {
    const c = this.cap(), D = c.depth; if (!D) return;
    if (D.out > 0) D.out--;
    const b = this.battle();
    if (D.role === 'start') {
      if (st !== 'start') return;
      if ((b < -3 && this.formPts() <= 0 && chance(0.4)) || (c.trust || 0) < 12) { D.role = 'bench'; this.news(`BENCHED: the coach is going with ${D.name} for now.`); }
    } else if (st === 'bench') {
      if (chance(0.05)) { D.out = 1 + Math.floor(rand(0, 3)); D.role = 'start'; this.news(`${D.name} got hurt. You're the starter. Make it count.`); return; }
      const p = b >= 2 ? 0.5 : b >= -2 ? 0.25 : b >= -6 ? 0.1 : 0.04;
      if (chance(p)) { D.role = 'start'; this.news(`YOU WON THE JOB: you're starting over ${D.name}.`); }
    }
  },
  // the rival gets a year older and better/worse with the rest of the league (re-read from the roster each season)
  // CPU teams in your games are a little better than in quick games
  oppBoost(t) {
    const B = [1, 2, 2, 3][Career.cap ? Career.cap.diff || 0 : 1] || 2, up = p => (p && p[0] !== 'OL' ? Object.assign(p.slice(), { 3: Math.min(99, p[3] + B) }) : p);
    return { ...t, off: t.off.map(up), def: t.def.map(up) };
  },
  label(st) { return { hurt: 'INJURED', susp: 'SITTING OUT', acad: 'ACADEMIC HOLD', bench: 'ON THE BENCH' }[st] || 'STARTER'; },
  why(st) {
    const c = this.cap(), D = c.depth;
    if (st === 'hurt') return `${c.inj.what}: out ${c.inj.wks} more game${c.inj.wks > 1 ? 's' : ''}. Sim the week while you heal.`;
    if (st === 'susp') return `You sit ${c.sit} more game${c.sit > 1 ? 's' : ''}. Sim the week.`;
    if (st === 'acad') return CareerSchool.why();
    if (st === 'bench') return `${D.name} starts at ${c.pos} (job battle: ${CareerUI.battleWord(this.battle()).toLowerCase()}). Win it: raise your overall, earn coach trust, play well when you get in. The coach takes another look every week.`;
    return '';
  }
};

// ---- hooks ----
{
  // slump / injury-through-it / tired legs: your guy plays a few points worse
  const _tuple = Career.tuple;
  Career.tuple = function () {
    const t = _tuple.call(this), c = this.cap; if (!t || !c) return t;
    const d = (c.slump && c.slump.g > 0 ? c.slump.d : 0), tired = typeof CareerSchool !== 'undefined' && CareerSchool.energy() < 30 ? 2 : 0;
    if (d) { t[3] = Math.max(40, t[3] - d); if (t[6].thp) { t[6].thp -= d; t[6].tha -= d; } }
    if (tired) t[4] = Math.max(50, t[4] - tired);
    return t;
  };
  // a game simmed without you: your backup line (or nothing), less XP, coach trust doesn't move
  const _simLine = Career.simLine;
  Career.simLine = function (pts, won) {
    const st = _simLine.call(this, pts, won), o = CareerHard.off, c = this.cap;
    const f = o === 'bench' ? 0.25 : o ? 0 : c && c.slump && c.slump.g > 0 ? 0.8 : 1;
    if (f !== 1) for (const k of ['pass', 'rush', 'rec', 'tkl']) st[k] = Math.round(st[k] * f);
    if (o) { st.td = o === 'bench' && chance(0.1) ? 1 : 0; st.sack = 0; st.int = o === 'bench' && chance(0.05) ? 1 : 0; }
    return st;
  };
  const _simXP = Career.simXP;
  Career.simXP = function (st, won) { const o = CareerHard.off; return o === 'bench' ? Math.round(_simXP.call(this, st, won) * 0.6) : o ? 5 : _simXP.call(this, st, won); };
  const _simTrust = Career.simTrust;
  Career.simTrust = function (won) { return CareerHard.off ? this.addTrust(0) : _simTrust.call(this, won); };
  // college game film for the scouts: played games count fully, simmed ones a bit less (c.tape = { p, s })
  const _add = Career.addStats;
  Career.addStats = function (st) { const c = this.cap; if (c && c.phase === 'college') { const T = c.tape || (c.tape = { p: 0, s: 0 }); T[CareerHard.simming ? 's' : 'p'] += Career.score(st, c.pos); } return _add.call(this, st); };
  // college sim
  const _simC = Career.simCollege;
  Career.simCollege = function () {
    const st = CareerHard.status(), out = st !== 'start';
    if (out) { CareerHard.off = st === 'bench' ? 'bench' : 'out'; Career.noCAP = true; }
    CareerHard.simming = true;
    let r; try { r = _simC.call(this); } finally { CareerHard.off = null; Career.noCAP = false; CareerHard.simming = false; }
    if (r && out && this.cap.log[0]) this.cap.log[0].grade = st === 'bench' ? 'BENCH' : 'OUT';
    if (r && out && st !== 'bench') { const c = this.cap, s = c.seasons.find(x => x.lvl === 'NCAA'); if (s && s.g) { s.g--; c.stats.g--; } } // you didn't play
    if (r) CareerHard.after({ status: st });
    return r;
  };
  // a game you played
  const _after = Career.afterGame;
  Career.afterGame = function (s) {
    const r = _after.call(this, s); if (r) CareerHard.after({ status: 'start', grade: r.grade });
    return r;
  };
  // new team: new depth chart (camp battle)
  const _ct = Career.changeTeam;
  Career.changeTeam = function (id) { _ct.call(this, id); if (this.cap) this.cap.depth = null; };
  // NFL sim: when you're not playing, your rival plays (his stats), you get a backup line or nothing
  const _simNFL = CareerUI.simNFL;
  CareerUI.simNFL = function (g) {
    const st = CareerHard.status();
    if (st === 'start') { _simNFL.call(this, g); CareerHard.after({ status: st }); return; }
    const c = Career.cap, d = Season.data;
    Career.noCAP = true; let sc;
    try { sc = d.phase === 'playoffs' ? Season.playoffSim(g.home, g.away) : Season.simScore(g.home, g.away); } finally { Career.noCAP = false; }
    const home = g.home === c.team, won = home ? sc[0] > sc[1] : sc[1] > sc[0], my = home ? sc[0] : sc[1];
    CareerHard.off = st === 'bench' ? 'bench' : 'out';
    let xs; try { const line = Career.simLine(my, won); if (st === 'bench') { Career.addStats(line); Career.gameBadges(line); } xs = { line, xp: Career.simXP(line, won) }; Career.simTrust(won); } finally { CareerHard.off = null; }
    Career.gainXP(xs.xp); Career.checkBadges();
    c.log.unshift({ vs: home ? g.away : g.home, score: home ? `${sc[0]}-${sc[1]}` : `${sc[1]}-${sc[0]}`, xp: xs.xp, grade: st === 'bench' ? 'BENCH' : 'OUT', line: st === 'bench' ? Career.line(xs.line) : CareerHard.label(st).toLowerCase() }); c.log.length = Math.min(c.log.length, 12);
    Career.save();
    CareerHard.after({ status: st });
    seasonGameDone(sc);
  };
  // your games: the CPU side is a bit better
  const _play = CareerUI.play;
  CareerUI.play = function (home, away, opts) {
    if (opts && opts.humanSide === 0) away = CareerHard.oppBoost(away); else if (opts && opts.humanSide === 1) home = CareerHard.oppBoost(home);
    return _play.call(this, home, away, opts);
  };
}

// ---- hub: depth chart cell, status box, play button ----
Object.assign(CareerUI, {
  battleWord(b) { return b >= 4 ? 'SAFE' : b >= 0 ? 'CLOSE' : b >= -4 ? 'BEHIND' : 'FAR BEHIND'; },
  hardHub() {
    const c = Career.cap; if (!c) return;
    const st = CareerHard.status(), D = c.depth, strip = document.querySelector('#capBody .clStrip');
    if (strip && D) {
      const b = CareerHard.battle(), lbl = st === 'start' ? 'STARTER' : st === 'bench' ? 'BACKUP' : CareerHard.label(st);
      strip.insertAdjacentHTML('beforeend', `<div class="clCell chDepth ${st}"><span>DEPTH CHART</span><b class="clNm">${lbl}</b><em>${st === 'start' ? 'AHEAD OF' : 'VS'} ${lastName(D.name).toUpperCase()} · ${this.battleWord(b)}</em></div>`);
    }
    const hn = c.hn || []; c.hn = [];
    const at = document.querySelector('#capBody .ccHead');
    if (hn.length && at) at.insertAdjacentHTML('afterend', `<div class="chNews">${hn.map(t => `<div>${t}</div>`).join('')}</div>`);
    const play = $('ccPlay');
    if (play && st !== 'start') {
      play.disabled = true; play.textContent = CareerHard.label(st); play.classList.add('chOff');
      if ($('ccSim')) $('ccSim').textContent = 'SIM WEEK';
      const g = document.querySelector('#capBody .ccGoals');
      if (g) g.outerHTML = `<div class="chStatus ${st}"><b>${CareerHard.label(st)}</b><span>${CareerHard.why(st)}</span></div>`;
    } else if (c.slump && c.slump.g > 0 && play) {
      const g = document.querySelector('#capBody .ccGoals'); if (g) g.insertAdjacentHTML('beforebegin', `<div class="chStatus slump"><b>SLUMP</b><span>-${c.slump.d} to your ratings for ${c.slump.g} more game${c.slump.g > 1 ? 's' : ''}. Grind through it.</span></div>`);
    }
    Career.save();
  }
});
{
  const _col = CareerUI.college;
  CareerUI.college = function () { _col.call(this); if (Career.cap && Career.cap.phase === 'college') this.hardHub(); };
  const _nfl = CareerUI.nfl;
  CareerUI.nfl = function () { _nfl.call(this); if (Career.cap && Career.cap.phase === 'nfl') this.hardHub(); };
}
