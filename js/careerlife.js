// ---- Career life: your agent, contract talks (Bobble Bucks: in-game play money, buys nothing real), press conferences, morale + team trust ----
// Morale (0-100) nudges XP a little. Team trust (0-100) nudges how often the QB looks your way and what contracts you get offered.
const AGENTS = {
  shark: { name: 'Rex Maxwell', firm: 'Max Out Sports', style: 'AGGRESSIVE', pro: 'Biggest asks + free agency offers', con: 'Asking for more can make your team mad',
    ask: 0.2, risk: 0.35, anger: 10, fa: 1.12, home: 1, trustYr: 0 },
  even: { name: 'Dez Monroe', firm: 'Monroe & Co.', style: 'BALANCED', pro: 'Fair deals, a little extra', con: 'Small risk when you push',
    ask: 0.12, risk: 0.15, anger: 5, fa: 1.03, home: 1, trustYr: 1 },
  pal: { name: 'Gloria Hart', firm: 'Hometown Hart Group', style: 'LOYAL', pro: 'Your team trusts you more every year', con: 'Smaller deals',
    ask: 0.06, risk: 0, anger: 0, fa: 0.92, home: 0.97, trustYr: 4 }
};
const bucks = m => `${m >= 10 ? Math.round(m) : (+m).toFixed(1)}M`;

// press conference questions: 3 answers each, always [humble, confident, fiery]
const PRESS_Q = {
  win: [
    ['Big win today. What was working out there?', ['Honestly, my teammates did the hard work. I just finished the plays.', 'We had a great plan and we ran it. That\'s what we expect every week.', 'Everything! We came out swinging and we\'re not slowing down.']],
    ['Your team looked really good. Best game of the year?', ['There\'s still a lot to clean up. Back to the film room tomorrow.', 'Feels like it. When we play like that, we\'re tough to beat.', 'Best game? Wait until you see next week.']],
    ['What did you tell the team after the game?', ['Just thanked everybody. That was a team win.', 'Enjoy it tonight, then get ready. We have bigger goals.', 'This is just the start. Let\'s go get the next one!']]
  ],
  loss: [
    ['Tough one today. What went wrong?', ['That\'s on me. I have to make more plays for my team.', 'We beat ourselves. We\'ll fix it and we\'ll be fine.', 'I\'m mad, and I should be. Nobody in this locker room likes losing.']],
    ['Are you worried about the rest of the season?', ['One game at a time. We\'ll keep working.', 'Not at all. This team is still really good.', 'Worried? Mark it down: we bounce back next week.']],
    ['The other team said they had you figured out. Your answer?', ['Credit to them. They had a good plan today.', 'They got one. Let\'s see them do it again.', 'Tell them to save the film. They\'ll need it next time.']]
  ],
  bigW: [
    ['You put up huge numbers today. What was clicking?', ['My teammates got me open. I just made the catch, the run, the play.', 'I put in the work all week and it showed.', 'When I\'m rolling like that, good luck stopping me!']],
    ['Was that the best game of your career?', ['Maybe. The win is what I care about.', 'It\'s up there. And I\'m just getting started.', 'Best game so far. I have a lot more where that came from.']]
  ],
  bigL: [['Big numbers, but a loss. How do you feel?', ['Stats don\'t matter if we lose. I\'d trade them for a win.', 'I\'ll take the numbers, but we want the W next time.', 'I\'m going to play even harder next week. That\'s a promise.']]],
  rivalW: [['You beat your biggest rival. How does that feel?', ['It means a lot to our fans. They deserve this one.', 'Feels great. That\'s how this rivalry should go.', 'Best feeling ever. Bragging rights are ours all year!']]],
  rivalL: [['Losing to your rival stings. What now?', ['They played better today. We\'ll be ready for the rematch.', 'One game doesn\'t change who we are.', 'Circle the next one on the calendar. We\'ll be there.']]],
  postW: [['You\'re moving on! What\'s the mood in the locker room?', ['Grateful. Everybody did their job tonight.', 'We expected to be here. We\'re not done.', 'Loud! We want the whole thing!']]],
  postL: [['Your season ends here. What will you remember?', ['The guys in that locker room. I\'m proud of them.', 'We\'ll be back here next year, and we\'ll be better.', 'This feeling? I\'m using it all offseason.']]],
  champ: [['Champions! What do you want to say to the fans?', ['Thank you. This one is for all of you.', 'We told you we\'d do it!', 'We\'re not done. Let\'s run it back next year!']]]
};
const PRESS_TONE = ['HUMBLE', 'CONFIDENT', 'FIERY'], PRESS_HINT = ['TEAM TRUST UP', 'A LITTLE OF BOTH', 'MORALE UP, TRUST RISK'];
const REPORTERS = [['Kim Waters', 'Bobble Sports Network'], ['Marcus Bell', 'The Daily Huddle'], ['Ana Ruiz', 'Gridiron Today'], ['Tom Park', 'Channel 8 Sports'], ['Jada Cole', 'End Zone Radio']];
const COLLEGE_REPS = [['Sam Ortiz', 'Campus Sports Radio'], ['Riley Chen', 'The College Gameday Post'], ['Nia Brooks', 'Student Sports Weekly']];

const CareerLife = {
  blank() { return { morale: 60, tt: 50, agent: null, bucks: 0, deals: [], press: null, pcN: 0, talk: null, quote: null }; },
  // old saves: defaults (NFL guys get paid for the years they already played and pick an agent next time they open the career)
  ensure(c) {
    if (!c || c.life) return c;
    const L = c.life = this.blank();
    if (c.phase === 'nfl' || c.phase === 'retired') {
      if (c.contract && !c.contract.len) c.contract.len = Math.max(c.contract.years, c.contract.rookie ? 4 : 3);
      const yrs = (c.seasons || []).filter(s => s.lvl === 'NFL' && !s.open).length;
      if (c.contract) { L.bucks = +(yrs * c.contract.total / c.contract.len).toFixed(1); L.deals.push({ team: c.team, years: c.contract.len, total: c.contract.total, rookie: !!c.contract.rookie }); }
    }
    return c;
  },
  L() { const c = Career.cap; return c && this.ensure(c).life; },
  agent() { const L = this.L(); return L && AGENTS[L.agent]; },
  add(k, d) { const L = this.L(); L[k] = clamp(Math.round(L[k] + d), 0, 100); return L[k]; },
  // morale: up to +-12% XP
  xpMult() { const L = this.L(); return L ? 1 + (L.morale - 50) / 420 : 1; },
  // team trust: the QB's read leans your way a bit (up to about +-0.4 on a 0-10ish scale)
  look() { const L = this.L(); return L ? (L.tt - 50) / 125 : 0; },
  moraleWord(m) { return m >= 80 ? 'FIRED UP' : m >= 60 ? 'GOOD' : m >= 40 ? 'OK' : 'LOW'; },
  trustWord(t) { return t >= 80 ? 'FRANCHISE GUY' : t >= 60 ? 'TRUSTED' : t >= 40 ? 'SOLID' : t >= 25 ? 'SHAKY' : 'ON THIN ICE'; },

  // ---- press conferences ----
  // after a game you played: big games always get one, normal ones sometimes
  maybePress(st, sc, won, info) {
    const c = Career.cap, L = this.L(); if (!c || !L) return null;
    const margin = Math.abs(sc[0] - sc[1]), tie = sc[0] === sc[1], big = Career.big(st);
    if (tie) return null;
    if (!(info.champ || info.post || info.rival || big || margin >= 14 || Math.random() < 0.3)) return null;
    const key = info.champ && won ? 'champ' : info.post ? (won ? 'postW' : 'postL') : info.rival ? (won ? 'rivalW' : 'rivalL') : big ? (won ? 'bigW' : 'bigL') : won ? 'win' : 'loss';
    const pool = PRESS_Q[key], qi = Math.floor(Math.random() * pool.length), rep = pick(c.phase === 'college' ? COLLEGE_REPS : REPORTERS);
    L.press = { key, qi, won, vs: info.vs, score: `${sc[0]}-${sc[1]}`, tag: info.champ ? 'CHAMPIONSHIP' : info.post ? info.postName || 'PLAYOFFS' : info.rival ? 'RIVALRY GAME' : big ? 'BIG GAME' : '', rep };
    return L.press;
  },
  // what an answer does: humble = trust, fiery = morale (and a little trust risk)
  effect(tone, won) { return [{ m: 2, t: 5 }, { m: won ? 5 : 3, t: won ? 2 : 1 }, { m: won ? 9 : 7, t: won ? -2 : -4 }][tone]; },
  answer(tone) {
    const L = this.L(), p = L.press; if (!p) return null;
    const e = tone == null ? { m: 0, t: 0 } : this.effect(tone, p.won);
    this.add('morale', e.m); this.add('tt', e.t);
    if (tone != null) { L.pcN++; L.quote = { text: PRESS_Q[p.key][p.qi][1][tone], tone }; }
    L.press = null; Career.save();
    return e;
  },

  // ---- agent texts between weeks ----
  tip() {
    const c = Career.cap, L = this.L(), A = this.agent(); if (!A) return '';
    const d = typeof Season !== 'undefined' && Season.data, g = d && Season.myGame && Season.myGame();
    const T = [];
    if (c.contract && c.contract.years === 1) T.push('Contract year. Every big game now is a bigger deal for us this offseason.');
    if (c.sp >= 2) T.push(`You have ${c.sp} skill points sitting there. Go spend them.`);
    if (L.morale < 40) T.push('Head up. One good game turns all of this around.');
    if (L.tt < 35) T.push('The front office is a little cold on you right now. Humble answers at the podium help.');
    if (L.tt >= 75) T.push('The team loves you. That\'s leverage at contract time.');
    if (L.morale >= 80) T.push('You\'re feeling it. Ride the wave, but stay hungry.');
    if (g && Career.isRival(g.home === c.team ? g.away : g.home)) T.push('Rivalry week. Everybody\'s watching. Give them a show.');
    if (d && d.phase === 'playoffs') T.push('Playoff football. This is where legends get made.');
    T.push({ shark: 'Three teams already asked about you. Keep stacking stats and let me do the talking.', even: 'Steady weeks win long careers. Eat, sleep, film, repeat.', pal: 'Keep being a great teammate. That pays off more than you think.' }[L.agent]);
    T.push({ shark: 'Big numbers, big deal. Simple math.', even: 'Win games and the money takes care of itself.', pal: 'Your coach told me you were the first one in the building this week. Love it.' }[L.agent]);
    const wk = d ? (d.year || 1) * 31 + (d.week || 0) + (d.phase === 'playoffs' ? 20 + (d.bracket ? d.bracket.round : 0) : 0) : 0;
    return T[wk % T.length];
  },

  // ---- contracts ----
  base() { return Math.max(1, (Career.ovr() - 60) * 1.4); }, // per year, same scale as the old offers
  homeOffer() {
    const c = Career.cap, L = this.L(), A = this.agent() || AGENTS.even;
    if (L.tt < 20) return null; // they want to go another way
    const yrs = c.age >= 32 ? pick([1, 2]) : L.tt >= 65 ? pick([4, 5]) : pick([2, 3, 4]);
    return { team: c.team, years: yrs, total: +(this.base() * yrs * (0.85 + L.tt * 0.003) * A.home * rand(0.95, 1.05)).toFixed(1) };
  },
  faOffers() {
    const c = Career.cap, A = this.agent() || AGENTS.even, yrs = c.age >= 32 ? [1, 2] : [2, 3, 4, 5];
    return shuffle(TEAMS.map(t => t.id).filter(id => id !== c.team)).slice(0, 3)
      .map(id => { const y = pick(yrs); return { team: id, years: y, total: +(this.base() * y * rand(0.85, 1.2) * A.fa).toFixed(1) }; }).sort((a, b) => b.total - a.total);
  },
  startTalks() { const L = this.L(); if (!L.talk) { L.talk = { home: this.homeOffer(), asked: false, fa: null, note: '' }; Career.save(); } return L.talk; },
  askMore() {
    const L = this.L(), T = L.talk, A = this.agent() || AGENTS.even; if (!T || !T.home || T.asked || T.fa) return;
    T.asked = true;
    if (Math.random() < A.risk) { this.add('tt', -A.anger); this.add('morale', -3); T.mad = true; T.note = 'They didn\'t love that. Same offer, and the front office is grumpy now.'; }
    else { T.home.total = +(T.home.total * (1 + A.ask)).toFixed(1); if (L.agent === 'pal') this.add('tt', 3); T.note = `They bumped it to ${bucks(T.home.total)}. Nice.`; }
    Career.save();
  },
  testFA() {
    const L = this.L(), T = L.talk; if (!T || T.fa) return;
    T.fa = this.faOffers(); if (T.home) this.add('tt', -4); // your team noticed you looked around
    T.note = T.fa.length ? `${T.fa.length} teams called. Take your pick.` : 'Quiet market. Your team is still there.';
    Career.save();
  },
  // sign a deal: new team = new locker room (team trust starts over)
  sign(o) {
    const c = Career.cap, L = this.L();
    c.contract = { years: o.years, total: o.total, len: o.years };
    L.deals.push({ team: o.team, years: o.years, total: o.total, age: c.age, fa: o.team !== c.team });
    if (o.team !== c.team) {
      if (Season.news) Season.news(`SIGNING: ${c.name} signs with ${o.team}`);
      Career.changeTeam(o.team); Season.data.team = o.team; L.tt = 45;
    } else this.add('tt', 3);
    L.talk = null; Career.save();
  },
  // a season's pay goes on the resume (and a loyal agent keeps the team happy)
  payday() { const c = Career.cap, L = this.L(); if (!c.contract) return; L.bucks = +(L.bucks + c.contract.total / (c.contract.len || 4)).toFixed(1); const A = this.agent(); if (A) this.add('tt', A.trustYr); }
};

// ---- hooks into the career ----
{
  const _load = Career.load;
  Career.load = function () { _load.call(this); CareerLife.ensure(this.cap); return this; };
  CareerLife.ensure(Career.cap);
  const _blank = Career.blank;
  Career.blank = function (o) { const c = _blank.call(this, o); c.life = CareerLife.blank(); return c; };
  // rookie deal: 4 years, set by the pick
  const _join = Career.joinNFL;
  Career.joinNFL = function () {
    _join.call(this); const c = this.cap, L = CareerLife.L();
    c.contract.len = 4; L.tt = c.draft.round === 1 ? 55 : 50; L.deals.push({ team: c.team, years: 4, total: c.contract.total, rookie: true, age: c.age }); L.talk = null; L.press = null;
    this.save();
  };
  const _end = Career.endNFLSeason;
  Career.endNFLSeason = function (d) { CareerLife.payday(); return _end.call(this, d); };
  const _ret = Career.retireCareer;
  Career.retireCareer = function () { const L = CareerLife.L(), R = _ret.call(this); if (R && L) { R.bucks = L.bucks; this.save(); } return R; };
  // morale: a little more (or less) XP
  const _simXP = Career.simXP;
  Career.simXP = function (st, won) { return Math.round(_simXP.call(this, st, won) * CareerLife.xpMult()); };
  const _simTrust = Career.simTrust;
  Career.simTrust = function (won) { if (CareerLife.L()) CareerLife.add('morale', won ? 1 : -1); return _simTrust.call(this, won); };
  // team trust: college sims give you a few more (or fewer) touches
  const _simLine = Career.simLine;
  Career.simLine = function (pts, won) {
    const st = _simLine.call(this, pts, won), f = 1 + CareerLife.look() / 4;
    for (const k of ['pass', 'rush', 'rec', 'tkl']) st[k] = Math.round(st[k] * f);
    return st;
  };
  const _after = Career.afterGame;
  Career.afterGame = function (s) {
    const r = _after.call(this, s); if (!r) return r;
    const c = this.cap, side = G.teams.findIndex(t => t.id === c.team);
    const st = Object.values(G.pstats || {}).find(p => p.side === side && p.name === c.name) || {};
    const extra = Math.round(r.xp * (CareerLife.xpMult() - 1));
    if (extra) { const g = this.gainXP(extra); r.lv += g.lv; r.sp += g.lv * this.SP_PER_LVL; r.xp += extra; if (c.log[0]) c.log[0].xp += extra; }
    r.moraleXP = extra;
    CareerLife.add('morale', r.won ? 1 : -1);
    const sc = [s.score[side], s.score[1 - side]], cl = c.college, last = G.career === 'college' && cl ? cl.sched[cl.week - 1] : null;
    const post = G.career === 'college' ? !!(last && (last.bowl || last.cfp)) : !!G.playoff;
    const champ = G.career === 'college' ? !!(last && last.cfp === 4) : !!G.bigGame;
    r.press = CareerLife.maybePress(st, sc, r.won, { vs: G.teams[1 - side].id, rival: !!r.rival, post, champ, postName: last ? this.postName(last).toUpperCase() : G.playoff && Season.data ? Season.roundName(Season.data.bracket ? Season.data.bracket.round : 1).toUpperCase() : '' });
    this.save();
    return r;
  };
}

// ---- game over: morale bonus + press conference heads-up ----
{
  const _over = G.hooks.onGameOver;
  G.hooks.onGameOver = s => {
    _over(s);
    const L = CareerLife.L(); if (!G.career || !L || !$('overCap').innerHTML) return;
    const pc = L.press;
    $('overCap').insertAdjacentHTML('beforeend', `<div class="clOver"><span>MORALE <b>${L.morale}</b></span><span>TEAM TRUST <b>${L.tt}</b></span>${pc ? '<em>PRESS CONFERENCE NEXT</em>' : ''}</div>`);
  };
}

// ---- screens ----
Object.assign(CareerUI, {
  // meters for the hub
  lifeHtml(nfl) {
    const c = Career.cap, L = CareerLife.L(), A = CareerLife.agent();
    const meter = (k, lbl, v, word) => `<div class="clCell clM ${k}"><span>${lbl}</span><b>${v}</b><div class="clBar"><i style="width:${v}%"></i></div><em>${word}</em></div>`;
    const ct = c.contract;
    return `<div class="clStrip">
      ${nfl ? `<div class="clCell"><span>AGENT</span><b class="clNm">${A ? A.name : 'NONE'}</b><em>${A ? A.style : ''}</em></div>
      <div class="clCell"><span>CONTRACT</span><b class="clNm">${ct ? `${ct.years} YR${ct.years === 1 ? '' : 'S'} LEFT` : 'NONE'}</b><em>${ct ? `${bucks(ct.total / (ct.len || 4))} BOBBLE BUCKS A YEAR` : ''}</em></div>` : ''}
      ${meter('mo', 'MORALE', L.morale, CareerLife.moraleWord(L.morale))}${meter('tt', 'TEAM TRUST', L.tt, CareerLife.trustWord(L.tt))}
    </div>${nfl && A ? `<div class="clText"><span class="clFrom">TEXT FROM ${A.name.toUpperCase()}</span>${CareerLife.tip()}</div>` : ''}`;
  },
  // the CONTRACT tab: agent, deal, career earnings, every deal you signed
  lifeTab() {
    const c = Career.cap, L = CareerLife.L(), A = CareerLife.agent(), ct = c.contract;
    return `<div class="clTab"><div class="clCol">
        <div class="clRow"><span>Agent</span><b>${A ? `${A.name}, ${A.firm}` : 'None yet'}</b></div>
        <div class="clRow"><span>Style</span><b>${A ? A.style : '-'}</b></div>
        <div class="clRow"><span>Contract</span><b>${ct ? `${ct.len || ct.years} yrs, ${bucks(ct.total)} (${ct.years} left)` : '-'}</b></div>
        <div class="clRow"><span>Career earnings</span><b class="gold">${bucks(L.bucks)} Bobble Bucks</b></div>
        <div class="clRow"><span>Press conferences</span><b>${L.pcN}</b></div>
        ${L.quote ? `<div class="clQuote">"${L.quote.text}"<span>${PRESS_TONE[L.quote.tone]}</span></div>` : ''}
      </div><div class="clCol"><div class="lbl">DEALS SIGNED</div>
        ${L.deals.length ? L.deals.map(d => `<div class="clRow"><span>${d.team}${d.rookie ? ' · rookie deal' : d.fa ? ' · free agent' : ' · re-signed'}</span><b>${d.years} yrs, ${bucks(d.total)}</b></div>`).join('') : '<div class="clRow"><span>None yet</span></div>'}
        <div class="clNote">Bobble Bucks are in-game only. They go on your career resume.</div></div></div>`;
  },
  // right after the draft: pick who does your deals
  agentPick() {
    const c = Career.cap, team = teamById(c.team);
    this.set(`<div class="clAgents"><div class="ccHead">PICK YOUR AGENT · ${team.city.toUpperCase()} ${team.name.toUpperCase()} ROOKIE</div>
      <div class="ccText">Your agent handles your next contract and texts you tips during the season. Choose the style you like.</div>
      <div class="clAgRow">${Object.entries(AGENTS).map(([k, a]) => `<button class="clAg ${k}" data-k="${k}"><em>${a.style}</em><b>${a.name}</b><span class="f">${a.firm}</span><span class="p">+ ${a.pro}</span><span class="m">- ${a.con}</span></button>`).join('')}</div></div>`, 'Your Agent');
    document.querySelectorAll('.clAg').forEach(b => b.onclick = () => { CareerLife.L().agent = b.dataset.k; Career.save(); Sound.td(); this.open(); });
  },
  // the podium: 1 question, 3 answers
  press() {
    const c = Career.cap, L = CareerLife.L(), p = L.press, team = teamById(c.team) || { c1: '#333' };
    const [q, ans] = PRESS_Q[p.key][p.qi];
    this.set(`<div class="pcWrap" style="--tc:${team.c1}">
      <div class="pcTop"><span class="pcTag">PRESS CONFERENCE</span><span class="pcGame"><b class="${p.won ? 'w' : 'l'}">${p.won ? 'W' : 'L'} ${p.score}</b> vs ${p.vs}${p.tag ? ' · ' + p.tag : ''}</span></div>
      <div class="pcRep"><b>${p.rep[0]}</b>, ${p.rep[1]}</div>
      <div class="pcQ">"${q}"</div>
      <div class="pcAns">${ans.map((a, i) => `<button class="pcA t${i}" data-i="${i}"><em>${PRESS_TONE[i]}</em><span>"${a}"</span><i>${PRESS_HINT[i]}</i></button>`).join('')}</div>
      <div class="pcFoot"><span>MORALE ${L.morale} · TEAM TRUST ${L.tt}</span><button id="pcSkip">NO COMMENT</button></div></div>`, 'Press Conference');
    const done = tone => {
      const e = CareerLife.answer(tone); Sound.click();
      const sgn = v => (v > 0 ? '+' : '') + v;
      const say = tone == null ? 'You walk off with a wave. Nothing gained, nothing lost.' : tone === 0 ? 'Teammates loved that answer. The front office noticed too.'
        : tone === 1 ? 'Cool and steady. Good answer.' : p.won ? 'The fans loved it! The coaches think it was a little much.' : 'The fans are fired up. The front office wants a calmer you.';
      document.querySelector('.pcAns').innerHTML = `<div class="pcRes"><div>${say}</div><div class="pcD"><span>MORALE <b>${sgn(e.m)}</b> (${L.morale})</span><span>TEAM TRUST <b>${sgn(e.t)}</b> (${L.tt})</span></div><button class="big gold" id="pcGo">CONTINUE</button></div>`;
      document.querySelector('.pcFoot').style.display = 'none';
      $('pcGo').onclick = () => { Sound.click(); this.open(); };
    };
    document.querySelectorAll('.pcA').forEach(b => b.onclick = () => done(+b.dataset.i));
    $('pcSkip').onclick = () => done(null);
  },
  // contract ran out: your team offers, you can ask for more or test free agency
  talks() {
    const c = Career.cap, T = CareerLife.startTalks(), A = CareerLife.agent() || AGENTS.even, box = $('clTalk'); if (!box) return;
    const me = teamById(c.team);
    const per = o => `${o.years} year${o.years === 1 ? '' : 's'} · <b>${bucks(o.total)}</b> Bobble Bucks (${bucks(o.total / o.years)} a year)`;
    const note = T.note || (T.home ? (c.life.tt >= 65 ? 'They love you here. Good spot to be in.' : 'Here\'s what they put on the table.') : 'Your team wants to go another way. Free agency it is.');
    box.innerHTML = `<div class="ccHead">CONTRACT TALKS · YOUR DEAL IS UP</div>
      <div class="clText"><span class="clFrom">${A.name.toUpperCase()}</span>${note}</div>
      ${T.home ? `<div class="clOffer home" style="--tc:${me.c1}"><span>${me.city.toUpperCase()} ${me.name.toUpperCase()} OFFER${T.mad ? ' · GRUMPY' : ''}</span><div>${per(T.home)}</div></div>` : ''}
      ${T.fa ? `<div class="ccOffers">${T.fa.concat(T.home ? [T.home] : []).map((o, i) => { const t = TEAMS.find(x => x.id === o.team); return `<button class="ofr" data-i="${i}" style="border-color:${t.c1}"><b>${t.city} ${t.name}</b><span>${o.years} yrs, ${bucks(o.total)} Bobble Bucks${o.team === c.team ? ' · stay home' : ''}</span></button>`; }).join('')}</div>`
        : `<div class="row">${T.home ? `<button class="big gold" id="clAccept">ACCEPT</button><button id="clAsk" ${T.asked ? 'disabled' : ''}>ASK FOR MORE</button>` : ''}<button id="clFA">TEST FREE AGENCY</button></div>`}
      <div class="clNote">MORALE ${c.life.morale} · TEAM TRUST ${c.life.tt}. Higher team trust = better offers from your team.</div>`;
    const go = () => { Season.data.capEnded = false; Season.nextYear(); Season.data.capEnded = false; Season.save(); capTab = 'season'; this.open(); };
    const sign = o => { Sound.td(); CareerLife.sign(o); go(); };
    if (T.fa) box.querySelectorAll('.ofr').forEach(b => b.onclick = () => sign(T.fa.concat(T.home ? [T.home] : [])[+b.dataset.i]));
    else {
      if ($('clAccept')) $('clAccept').onclick = () => sign(T.home);
      if ($('clAsk')) $('clAsk').onclick = () => { CareerLife.askMore(); Sound.click(); this.talks(); };
      $('clFA').onclick = () => { CareerLife.testFA(); Sound.whistle(); this.talks(); };
    }
  }
});
{
  const _open = CareerUI.open;
  CareerUI.open = function () {
    const r = _open.call(this), c = Career.cap, L = CareerLife.L(); if (!c || !L) return r;
    if (L.press && (c.phase === 'college' || c.phase === 'nfl' || c.phase === 'combine')) return this.press();
    if (c.phase === 'nfl' && !L.agent) return this.agentPick();
    return r;
  };
  const _nfl = CareerUI.nfl;
  CareerUI.nfl = function () {
    if (capTab === 'life') { const t = capTab; capTab = 'season'; _nfl.call(this); capTab = t; } else _nfl.call(this);
    const tabs = document.querySelector('.ccTabs'); if (!tabs) return;
    tabs.insertAdjacentHTML('beforebegin', this.lifeHtml(true));
    tabs.insertAdjacentHTML('beforeend', `<button data-t="life" class="${capTab === 'life' ? 'on' : ''}">CONTRACT</button>`);
    if (capTab === 'life') { tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === 'life')); $('ccTab').innerHTML = this.lifeTab(); }
    tabs.lastElementChild.onclick = () => { capTab = 'life'; Sound.click(); this.nfl(); };
  };
  const _col = CareerUI.college;
  CareerUI.college = function () {
    _col.call(this);
    const at = document.querySelector('#capBody .ccStock'); if (at) at.insertAdjacentHTML('beforebegin', this.lifeHtml(false));
  };
  const _off = CareerUI.offseason;
  CareerUI.offseason = function () {
    _off.call(this);
    const c = Career.cap, ofr = document.querySelector('#capBody .ccOffers');
    if (ofr && (!c.contract || c.contract.years <= 0)) { ofr.previousElementSibling.remove(); ofr.outerHTML = '<div id="clTalk" class="clTalk"></div>'; this.talks(); }
  };
  const _plq = CareerUI.plaque;
  CareerUI.plaque = function (L) { _plq.call(this, L); if (L && L.bucks) { const h = document.querySelector('#capBody .hof'); if (h) h.insertAdjacentHTML('beforeend', `<div class="ln">Career earnings: ${bucks(L.bucks)} Bobble Bucks</div>`); } };
}
