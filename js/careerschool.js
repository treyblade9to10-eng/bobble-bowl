// ---- Career: college classes. One quick pick a week (study / practice / rest) trades GPA vs skill vs energy. AUTO picks for you ----
// c.school = { gpa, n, energy, plan: { wk, k }, auto, hist: [k...], prob, done }
// GPA under 2.0 = academic probation (you sit some games), under 1.6 = ineligible. 3.5+ at the end = Academic All-American (draft stock + coach trust)
BADGES.acad = 'Academic All-American';
const CS_PLANS = {
  study: { name: 'STUDY', hint: 'GPA up, a little XP', wk: 3.8, xp: 10, en: -5 },
  practice: { name: 'EXTRA PRACTICE', hint: 'Big XP, GPA down, tiring', wk: 1.5, xp: 70, en: -15, tr: 1 },
  rest: { name: 'REST + FRIENDS', hint: 'Energy + morale back', wk: 3.0, xp: 0, en: 25, mo: 3 }
};
const CareerSchool = {
  PROB: 2.0, INELIG: 1.6, AA: 3.5,
  S() {
    const c = Career.cap; if (!c || !c.college) return null;
    if (!c.school) c.school = { gpa: +(2.7 + (hashStr(c.name || 'x') % 7) / 10).toFixed(2), n: 2, energy: 80, plan: null, auto: false, hist: [], prob: 0 }; // old saves get a fresh report card
    return c.school;
  },
  on() { const c = Career.cap; return !!c && c.phase === 'college' && !!c.college && !c.college.done; },
  energy() { const c = Career.cap, S = c && c.school; return S && c.phase === 'college' ? S.energy : 70; },
  week() { return Career.cap.college.week; },
  planned() { const S = this.S(); return !!(S && S.plan && S.plan.wk === this.week()); },
  // the pick for this week: effects right away
  choose(k) {
    const c = Career.cap, S = this.S(), P = CS_PLANS[k]; if (!S || !P || this.planned()) return null;
    const g0 = S.gpa, wk = clamp(P.wk + rand(-0.3, 0.3), 0, 4);
    S.gpa = +clamp((S.gpa * S.n + wk) / (S.n + 1), 0, 4).toFixed(2); S.n = Math.min(S.n + 1, 4);
    S.energy = clamp(S.energy + P.en, 0, 100);
    if (P.xp) Career.gainXP(P.xp);
    if (P.tr) Career.addTrust(P.tr);
    if (k === 'practice' && c.depth && c.depth.role === 'bench') c.jobAdj = (c.jobAdj || 0) + 1; // the backup who grinds in practice gets noticed
    if (P.mo && typeof CareerLife !== 'undefined' && CareerLife.L()) CareerLife.add('morale', P.mo);
    S.plan = { wk: this.week(), k, d: +(S.gpa - g0).toFixed(2) }; S.hist.push(k);
    // dropping under 2.0: probation starts with a sit-out game
    if (S.gpa < this.PROB && !S.prob) { S.prob = 1; S.sitWk = this.week(); }
    if (S.gpa >= this.PROB) S.prob = 0;
    Career.save();
    return S.plan;
  },
  autoPick() {
    const S = this.S(); if (!S) return 'study';
    if (S.gpa < 2.35) return 'study';
    if (S.energy < 35) return 'rest';
    return this.week() % 2 ? 'study' : 'practice';
  },
  // before a game: no pick yet = AUTO picks
  ensure() { if (this.on() && !this.planned()) this.choose(this.autoPick()); },
  // probation: sit the first game under 2.0, then every other game while still under. Under 1.6: every game
  sits() {
    const S = this.on() && this.S(); if (!S || !this.planned()) return false;
    if (S.gpa < this.INELIG) return true;
    return S.gpa < this.PROB && (this.week() - (S.sitWk || 0)) % 2 === 0;
  },
  why() { const S = this.S(); return S.gpa < this.INELIG ? `GPA ${S.gpa.toFixed(2)}: academically ineligible. Study to get back over ${this.PROB.toFixed(1)} and play again.` : `GPA ${S.gpa.toFixed(2)}: academic probation, you sit this one. Study to get back over ${this.PROB.toFixed(1)}.`; },
  afterGame() { const S = this.on() && this.S(); if (S) S.energy = clamp(S.energy - 8, 0, 100); },
  // season over: the report card
  final() {
    const c = Career.cap, S = c.school; if (!S || S.done) return;
    S.done = true;
    if (S.gpa >= this.AA) { Career.badge('acad'); Career.addTrust(3); CareerHard.news(`ACADEMIC ALL-AMERICAN: ${S.gpa.toFixed(2)} GPA. Scouts noticed.`); }
  },
  stock() { const S = Career.cap && Career.cap.school; if (!S) return 0; return clamp((S.gpa - 2.8) * 6, -10, 4) + (S.gpa >= this.AA ? 4 : 0); },
  word(g) { return g >= this.AA ? 'DEAN\'S LIST' : g >= 3 ? 'GOOD' : g >= this.PROB ? 'OK' : g >= this.INELIG ? 'PROBATION' : 'INELIGIBLE'; },
  // the week row on the college hub
  html() {
    const S = this.S(); if (!S || !this.on() || !Career.collegeGame()) return '';
    if (this.planned()) { const p = S.plan, P = CS_PLANS[p.k]; return `<div class="csWeek done"><span class="csL">THIS WEEK</span><b>${P.name}</b><em>GPA ${S.gpa.toFixed(2)} (${p.d >= 0 ? '+' : ''}${p.d.toFixed(2)})${P.xp ? ` · +${P.xp} XP` : ''} · ENERGY ${S.energy}</em>${S.auto ? '<i>AUTO</i>' : ''}</div>`; }
    if (S.auto) return '';
    return `<div class="csWeek"><span class="csL">THIS WEEK</span>${Object.entries(CS_PLANS).map(([k, P]) => `<button class="csPick" data-k="${k}"><b>${P.name}</b><i>${P.hint}</i></button>`).join('')}<button class="csAuto">AUTO</button></div>`;
  },
  cells() {
    const S = this.S(); if (!S) return '';
    const meter = (k, lbl, v, pct, word) => `<div class="clCell clM ${k}"><span>${lbl}</span><b>${v}</b><div class="clBar"><i style="width:${pct}%"></i></div><em>${word}</em></div>`;
    return meter('gpa' + (S.gpa < this.PROB ? ' low' : ''), 'GPA', S.gpa.toFixed(2), S.gpa / 4 * 100, this.word(S.gpa)) + meter('en' + (S.energy < 35 ? ' low' : ''), 'ENERGY', S.energy, S.energy, S.energy < 30 ? 'TIRED LEGS' : S.energy < 50 ? 'WORN' : 'FRESH');
  },
  // the robot: auto picks, sometimes a lazy / grinder week (prof 'great' keeps the grades up)
  robot(prof) { if (!this.on() || this.planned()) return false; this.choose(prof === 'great' ? (this.S().gpa < 3.4 ? 'study' : this.autoPick()) : this.autoPick()); return true; }
};
// ---- hooks ----
{
  const _cr = Career.collegeResult;
  Career.collegeResult = function (sc) { const r = _cr.call(this, sc); CareerSchool.afterGame(); if (this.cap.phase === 'combine') CareerSchool.final(); return r; };
  const _st = Career.stock;
  Career.stock = function () { return _st.call(this) + CareerSchool.stock(); };
  // sim: no pick = AUTO first
  const _sim = Career.simCollege;
  Career.simCollege = function () { CareerSchool.ensure(); return _sim.call(this); };
  const _col = CareerUI.college;
  CareerUI.college = function () {
    const c = Career.cap; if (c && c.college) CareerSchool.S();
    _col.call(this);
    if (!c || c.phase !== 'college') return;
    const strip = document.querySelector('#capBody .clStrip'); if (strip) strip.insertAdjacentHTML('beforeend', CareerSchool.cells());
    const row = $('ccPlay') && $('ccPlay').parentElement; if (row) row.insertAdjacentHTML('beforebegin', CareerSchool.html());
    document.querySelectorAll('.csPick').forEach(b => b.onclick = () => { Sound.click(); CareerSchool.choose(b.dataset.k); this.open(); });
    const au = document.querySelector('.csAuto'); if (au) au.onclick = () => { Sound.click(); CareerSchool.S().auto = true; CareerSchool.ensure(); this.open(); };
    const done = document.querySelector('.csWeek.done'); if (done && CareerSchool.S().auto) { done.title = 'Tap to pick your own weeks again'; done.onclick = () => { CareerSchool.S().auto = false; Career.save(); Sound.click(); this.open(); }; }
    // PLAY with no pick: AUTO picks first (it can put you on an academic hold, so re-check)
    const play = $('ccPlay');
    if (play && !play.disabled) { const go = play.onclick; play.onclick = () => { if (!CareerSchool.planned()) { CareerSchool.ensure(); if (!CareerHard.canPlay()) return this.open(); } go(); }; }
  };
}
