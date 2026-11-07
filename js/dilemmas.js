// ---- Season dilemmas: about 1 week in 3 the coach has to make a call. Choices have real effects (ratings, injuries, cap, trades) ----
// d.dilemma = the open one, d.dilemmas = every call you made, d.boosts = short-term rating changes that wear off after a few games
const Dilemma = {
  me() { return Season.data.team; },
  R() { return Season.ensureRosters()[this.me()]; },
  starters() { const R = this.R(); return R.off.concat(R.def).filter(p => p && !Season.hurt(p)); },
  find(name, team) {
    const all = Season.ensureRosters(), ids = [team].concat(Object.keys(all).filter(i => i !== team));
    for (const id of ids) { const r = all[id]; if (!r) continue; for (const g of ['off', 'def', 'bench']) for (const p of r[g] || []) if (p && p[1] === name) return p; }
    return null;
  },
  nm(p) { return `${p[0]} ${p[1]}`; },
  // pick a player for a dilemma (random the first time, the same guy again after a reload)
  fix: null, rec: {},
  pk(list, slot) {
    if (this.fix) { const n = this.fix[slot]; return n ? list.find(p => p[1] === n) || this.find(n, this.me()) : null; }
    const p = shuffle(list.slice())[0]; if (p) this.rec[slot] = p[1]; return p;
  },
  // a rating change that lasts a few games (games = how many)
  boost(p, delta, games, team) {
    const before = p[3]; p[3] = clamp(p[3] + delta, 40, 99);
    const dd = p[3] - before; if (!dd) return;
    (Season.data.boosts || (Season.data.boosts = [])).push({ t: team || this.me(), n: p[1], d: dd, g: games });
  },
  // this week's opponent (and his starters)
  opp() { const g = Season.myGame(); return g ? (g.home === this.me() ? g.away : g.home) : null; },
  oppBoost(delta, games) { const o = this.opp(), R = o && Season.ensureRosters()[o]; if (!R) return; for (const p of R.off.concat(R.def)) if (p && !Season.hurt(p)) this.boost(p, delta, games, o); },
  age(p) { return (p[6] && p[6].age) || 26; },
  teamBoost(delta, games) { for (const p of this.starters()) this.boost(p, delta, games); },
  // one game played: boosts tick down, the finished ones come off
  tick(all) {
    const d = Season.data; if (!d || !d.boosts) return;
    d.boosts = d.boosts.filter(b => { if (!all && --b.g > 0) return true; const p = this.find(b.n, b.t); if (p) p[3] = clamp(p[3] - b.d, 40, 99); return false; });
  },
  sitOut(p, wks, what) { Season.injure(this.me(), p, wks, what, Season.data.week); },
  // trade one of your guys for a fair return (a 1st round pick or a player at his spot)
  tradeAway(p) {
    const me = this.me(), key = Season.assets(me).find(a => a.p === p);
    if (!key) return null;
    for (const t of shuffle(TEAMS.filter(t => t.id !== me).map(t => t.id))) {
      const A = Season.assets(t), pk = A.find(a => a.pick), same = A.filter(a => a.p && !Season.hurt(a.p) && posGroup(a.p[0]) === posGroup(p[0]) && a.p[3] < p[3]).sort((a, b) => b.p[3] - a.p[3]);
      const opts = []; if (same[0] && pk) opts.push([same[0].key, pk.key]); if (same[0]) opts.push([same[0].key]); if (pk) opts.push([pk.key]);
      for (const get of opts) if (Season.dealOdds(t, [key.key], get) >= 80 && !Season.rosterProblem(me, t, [key.key], get)) { const r = Season.makeDeal(t, [key.key], get); return { team: t, got: r.got }; }
    }
    return null;
  },

  // ---------- the dilemmas ----------
  // each: make() returns null if it can't happen right now, else { title, text, opts: [{ label, hint, go() -> result text }] }
  KINDS: {
    holdout() {
      const p = Dilemma.pk(Dilemma.starters().filter(p => p[3] >= 82), 'a'); if (!p) return null;
      if (typeof Contracts !== 'undefined') Contracts.ensure();
      const c = Contracts.con(p) || { sal: 5, yrs: 1 }, want = Math.max(c.sal + 1, Math.round(Contracts.value(p) * 1.15 * 10) / 10), room = Contracts.room(Dilemma.me()), can = room >= want - c.sal;
      return { title: 'Contract Holdout', text: `${Dilemma.nm(p)} (${p[3]}) wants a new deal NOW: ${cmoney(want)} a year. If he doesn't get it, he might sit out.`,
        opts: [
          { label: 'PAY HIM', hint: can ? `${cmoney(want)} a year, 3 more years` : 'Not enough cap room', off: !can, go() { c.sal = want; c.yrs = (c.yrs || 1) + 3; Dilemma.boost(p, 2, 3); return `${lastName(p[1])} signs and is fired up: +2 OVR for 3 games. Cap room left: ${cmoney(Contracts.room(Dilemma.me()))}.`; } },
          { label: 'MAKE HIM WAIT', hint: 'Save money. He might hold out.', go() { if (chance(0.5)) { Dilemma.sitOut(p, 2, 'holdout'); return `${lastName(p[1])} holds out! He misses the next 2 games.`; } Dilemma.boost(p, -3, 3); return `${lastName(p[1])} shows up, but he's grumpy: -3 OVR for 3 games.`; } },
          { label: 'TRADE HIM', hint: 'Get something for him now', go() { const r = Dilemma.tradeAway(p); if (r) return `${lastName(p[1])} is traded to the ${tName(r.team)} for ${r.got.join(' + ')}.`; Dilemma.boost(p, -3, 3); return `Nobody offered enough. ${lastName(p[1])} stays and sulks: -3 OVR for 3 games.`; } }] };
    },
    rookie() {
      const R = Dilemma.R(), bench = Season.bench(Dilemma.me()), age = p => (p[6] && p[6].age) || 26, pairs = [];
      for (const side of ['off', 'def']) R[side].forEach((v, i) => {
        if (!v || Season.hurt(v) || age(v) < 28) return;
        const y = bench.find(b => b && !Season.hurt(b) && posGroup(b[0]) === posGroup(v[0]) && age(b) <= 24 && b[3] >= v[3] - 8);
        if (y) pairs.push({ v, y, side, i });
      });
      const pr = Dilemma.fix ? pairs.find(x => x.v[1] === Dilemma.fix.a && x.y[1] === Dilemma.fix.b) : shuffle(pairs)[0];
      if (!pr) return null;
      Dilemma.rec = { a: pr.v[1], b: pr.y[1] };
      { const { v, y, side, i } = pr;
        return { title: 'Rookie or Veteran?', text: `Young ${Dilemma.nm(y)} (${y[3]}, age ${age(y)}) is pushing veteran ${Dilemma.nm(v)} (${v[3]}, age ${age(v)}) for the starting job.`,
          opts: [
            { label: 'START THE KID', hint: 'He learns fast by playing', go() { const j = bench.indexOf(y); if (j >= 0) { bench[j] = v; R[side][i] = y; } y[3] = clamp(y[3] + 3, 40, 99); Dilemma.boost(v, -2, 2); return `${lastName(y[1])} starts and gets better fast: +3 OVR for good. ${lastName(v[1])} is not happy: -2 OVR for 2 games.`; } },
            { label: 'TRUST THE VET', hint: 'Experience wins games', go() { Dilemma.boost(v, 3, 3); return `${lastName(v[1])} plays like he has something to prove: +3 OVR for 3 games.`; } }] };
      }
    },
    trade() {
      const p = Dilemma.pk(Dilemma.starters().filter(p => p[3] >= 76 && p[0] !== 'QB'), 'a'); if (!p || !Season.canTrade()) return null;
      return { title: 'Trade Request', text: `${Dilemma.nm(p)} (${p[3]}) says he wants to be traded. He wants more chances to shine.`,
        opts: [
          { label: 'TRADE HIM', hint: 'Get value back now', go() { const r = Dilemma.tradeAway(p); if (r) return `Done. ${lastName(p[1])} goes to the ${tName(r.team)}. You get ${r.got.join(' + ')}.`; Dilemma.boost(p, -2, 2); return `No team offered enough. ${lastName(p[1])} stays: -2 OVR for 2 games.`; } },
          { label: 'TALK IT OUT', hint: 'Could work. Could go badly.', go() { if (chance(0.6)) { Dilemma.boost(p, 2, 2); return `Great talk! ${lastName(p[1])} feels wanted: +2 OVR for 2 games.`; } Dilemma.boost(p, -4, 4); return `It didn't help. ${lastName(p[1])} is sulking: -4 OVR for 4 games.`; } }] };
    },
    fight() {
      const s = Dilemma.starters().filter(p => p[0] !== 'QB'), a = Dilemma.pk(s, 'a'), b = a && Dilemma.pk(s.filter(p => p !== a), 'b'); if (!a || !b) return null;
      return { title: 'Locker Room Fight', text: `${Dilemma.nm(a)} and ${Dilemma.nm(b)} got into a shoving match at practice. Everybody is watching what you do.`,
        opts: [
          { label: 'SUSPEND BOTH', hint: 'They sit 1 game. Team respects it.', go() { Dilemma.sitOut(a, 1, 'suspended'); Dilemma.sitOut(b, 1, 'suspended'); Dilemma.teamBoost(1, 2); return `Both sit out 1 game. The team tightens up: everyone +1 OVR for 2 games.`; } },
          { label: 'LET IT SLIDE', hint: 'Keep your starters. Risky.', go() { if (chance(0.5)) return 'They shake hands and move on. No harm done.'; Dilemma.teamBoost(-1, 2); return 'The drama keeps going: everyone -1 OVR for 2 games.'; } }] };
    },
    practice() {
      return { title: 'Extra Practice?', text: 'Your coaches want a tough full-pads practice this week. Young guys would get better, but someone could get hurt.',
        opts: [
          { label: 'GO HARD', hint: 'Young players improve. Injury risk.', go() {
            const young = Dilemma.R().off.concat(Dilemma.R().def, Season.bench(Dilemma.me())).filter(p => p && !Season.hurt(p) && ((p[6] && p[6].age) || 26) <= 25).sort((a, b) => b[3] - a[3]).slice(0, 3);
            young.forEach(p => p[3] = clamp(p[3] + 1, 40, 99));
            let t = young.length ? `${young.map(p => lastName(p[1])).join(', ')} got better: +1 OVR for good.` : 'Nobody young enough to learn much.';
            if (chance(0.35)) { const h = pick(Dilemma.starters()); if (h) { const w = 1 + Math.floor(rand(0, 3)); Dilemma.sitOut(h, w, pick(['hamstring', 'ankle', 'shoulder'])); t += ` But ${Dilemma.nm(h)} got hurt and is out ${w} week${w > 1 ? 's' : ''}.`; } }
            return t; } },
          { label: 'REST DAY', hint: 'Fresh legs for Sunday', go() { Dilemma.teamBoost(1, 1); return 'Everyone rests up: +1 OVR next game.'; } }] };
    },
    media() {
      const d = Season.data, qb = Dilemma.R().off[0]; if (!qb || Season.hurt(qb)) return null;
      const r = d.rec[d.team]; if (r.l < 1) return null;
      return { title: 'Media Pressure', text: `Fans and reporters are loud this week. Everyone is asking if ${Dilemma.nm(qb)} is the right guy.`,
        opts: [
          { label: 'BACK YOUR QB', hint: 'Show you believe in him', go() { if (chance(0.7)) { Dilemma.boost(qb, 3, 3); return `${lastName(qb[1])} hears it and plays loose: +3 OVR for 3 games.`; } return 'He appreciates it, but nothing changes.'; } },
          { label: 'CALL HIM OUT', hint: 'Tough love. Big swing.', go() { if (chance(0.5)) { Dilemma.boost(qb, 4, 3); return `It lit a fire! ${lastName(qb[1])}: +4 OVR for 3 games.`; } Dilemma.boost(qb, -4, 3); return `${lastName(qb[1])} feels the pressure: -4 OVR for 3 games.`; } },
          { label: 'TAKE THE BLAME', hint: 'Protect the whole team', go() { Dilemma.teamBoost(1, 2); return 'The players love that you have their backs: everyone +1 OVR for 2 games.'; } }] };
    },
    trash() {
      const g = Season.myGame(); if (!g) return null;
      const opp = g.home === Dilemma.me() ? g.away : g.home, star = Dilemma.starters().sort((a, b) => b[3] - a[3])[0]; if (!star) return null;
      return { title: 'Trash Talk', text: `The ${tName(opp)} have been talking trash all week. Your players want to fire back.`,
        opts: [
          { label: 'FIRE BACK', hint: 'Big boost. Penalty risk.', go() { Dilemma.teamBoost(2, 1); if (chance(0.35)) { Dilemma.boost(star, -4, 1); if (Contracts.con(star)) Contracts.con(star).sal = Math.round((Contracts.con(star).sal + 0.5) * 10) / 10; return `Your team is fired up: everyone +2 OVR next game. But ${Dilemma.nm(star)} got fined $0.5M for a taunting penalty and is rattled (-4 next game).`; } return 'Your team is fired up: everyone +2 OVR next game!'; } },
          { label: 'STAY HUMBLE', hint: 'Let the game do the talking', go() { Dilemma.boost(star, 2, 1); return `${lastName(star[1])} stays calm and focused: +2 OVR next game.`; } }] };
    },
    hurt() {
      const p = Dilemma.pk(Season.injList(Dilemma.me()).filter(p => p[3] >= 78 && p[6].inj >= 2 && !/holdout|suspended/.test(p[6].injWhat || '')), 'a'); if (!p || !Season.hurt(p)) return null;
      return { title: 'Play Through It?', text: `${Dilemma.nm(p)} (${p[6].injWhat}) is out ${p[6].inj} more weeks, but he says he can play now.`,
        opts: [
          { label: 'LET HIM PLAY', hint: 'He plays hurt. Could get worse.', go() {
            if (chance(0.3)) { p[6].inj += 3; return `He tried, but it got worse. ${lastName(p[1])} is now out ${p[6].inj} weeks.`; }
            p[6].inj = 1; Season.injuryWeekHeal(p); Dilemma.boost(p, -4, 3); return `${lastName(p[1])} is back in the lineup, playing at less than 100%: -4 OVR for 3 games.`; } },
          { label: 'REST HIM', hint: 'Safe. He heals fully.', go() { p[3] = clamp(p[3] + 1, 40, 99); return `Smart. ${lastName(p[1])} rests and comes back stronger: +1 OVR when healthy.`; } }] };
    },
    weather() {
      const d = Season.data, w = d.weather && d.weather[d.week] && d.weather[d.week].w; if (!['rain', 'snow', 'storm'].includes(w)) return null;
      const qb = Dilemma.R().off[0]; if (!qb || Season.hurt(qb)) return null;
      return { title: 'Bad Weather Week', text: `The forecast says ${w === 'snow' ? 'snow' : 'a big storm'} for Sunday. Do you practice outside in it all week?`,
        opts: [
          { label: 'PRACTICE OUTSIDE', hint: 'Ready for anything. Someone could get sick.', go() { Dilemma.teamBoost(1, 1); if (chance(0.2)) { const h = Dilemma.pk(Dilemma.starters(), 'a'); if (h) { Dilemma.sitOut(h, 1, 'sick'); return `The team is ready for the ${w}: everyone +1 next game. But ${Dilemma.nm(h)} caught a cold and misses 1 game.`; } } return `Cold hands, tough minds. Everyone +1 OVR next game.`; } },
          { label: 'STAY INDOORS', hint: 'Sharp passing, softer team', go() { Dilemma.boost(qb, 2, 1); return `Perfect practice reps for ${lastName(qb[1])}: +2 OVR next game.`; } }] };
    },
    captain() {
      const s = Dilemma.starters().sort((a, b) => b[3] - a[3]).slice(0, 4), a = Dilemma.pk(s, 'a'), b = a && Dilemma.pk(s.filter(p => p !== a), 'b'); if (!a || !b) return null;
      return { title: 'Pick a Captain', text: `The team needs a new captain. ${Dilemma.nm(a)} and ${Dilemma.nm(b)} both want it.`,
        opts: [
          { label: `${lastName(a[1]).toUpperCase()}`, hint: 'He leads by example', go() { Dilemma.boost(a, 3, 3); Dilemma.boost(b, -1, 2); return `${lastName(a[1])} is fired up: +3 OVR for 3 games. ${lastName(b[1])} is a little hurt: -1 for 2 games.`; } },
          { label: `${lastName(b[1]).toUpperCase()}`, hint: 'He leads with his voice', go() { Dilemma.boost(b, 3, 3); Dilemma.boost(a, -1, 2); return `${lastName(b[1])} is fired up: +3 OVR for 3 games. ${lastName(a[1])} is a little hurt: -1 for 2 games.`; } },
          { label: 'LET THE TEAM VOTE', hint: 'Everyone has a say', go() { Dilemma.teamBoost(1, 2); return 'The players love having a say: everyone +1 OVR for 2 games.'; } }] };
    },
    extension() {
      if (typeof Contracts === 'undefined') return null; Contracts.ensure();
      const p = Dilemma.pk(Dilemma.starters().filter(p => Dilemma.age(p) <= 25 && p[3] >= 75 && Contracts.con(p)), 'a'); if (!p) return null;
      const c = Contracts.con(p), want = Math.max(c.sal, Math.round(Contracts.value(p) * 0.9 * 10) / 10), can = Contracts.room(Dilemma.me()) >= want - c.sal;
      return { title: 'Early Extension?', text: `Young ${Dilemma.nm(p)} (${p[3]}, age ${Dilemma.age(p)}) wants to lock in a long deal now: ${cmoney(want)} a year.`,
        opts: [
          { label: 'EXTEND HIM', hint: can ? `${cmoney(want)} a year, 4 more years` : 'Not enough cap room', off: !can, go() { c.sal = want; c.yrs = (c.yrs || 1) + 4; Dilemma.boost(p, 2, 3); return `${lastName(p[1])} is locked up long term and playing loose: +2 OVR for 3 games.`; } },
          { label: 'WAIT AND SEE', hint: 'He might be annoyed', go() { if (chance(0.5)) { Dilemma.boost(p, -2, 2); return `${lastName(p[1])} feels disrespected: -2 OVR for 2 games.`; } return `${lastName(p[1])} shrugs it off. He wants to prove his worth.`; } }] };
    },
    rest() {
      const p = Dilemma.pk(Dilemma.starters().filter(p => Dilemma.age(p) >= 31 && p[3] >= 75), 'a'); if (!p) return null;
      return { title: 'Veteran Needs Rest', text: `${Dilemma.nm(p)} (age ${Dilemma.age(p)}) says his body is tired. The trainers want him to sit a game.`,
        opts: [
          { label: 'REST HIM', hint: 'Miss 1 game, fresher after', go() { Dilemma.sitOut(p, 1, 'rest'); Dilemma.boost(p, 3, 4); return `${lastName(p[1])} sits 1 game and comes back fresh: +3 OVR for his next games.`; } },
          { label: 'PLAY HIM', hint: 'Need him now. Injury risk.', go() { if (chance(0.25)) { const w = 2 + Math.floor(rand(0, 2)); Dilemma.sitOut(p, w, 'hamstring'); return `His body gave out. ${lastName(p[1])} is out ${w} weeks.`; } Dilemma.boost(p, -1, 2); return `${lastName(p[1])} gutted it out, a step slow: -1 OVR for 2 games.`; } }] };
    },
    struggling() {
      const p = Dilemma.pk(Dilemma.starters().filter(p => Dilemma.age(p) <= 24 && p[0] !== 'QB'), 'a'); if (!p) return null;
      return { title: 'Young Player Struggling', text: `${Dilemma.nm(p)} (age ${Dilemma.age(p)}) has made big mistakes two weeks in a row. The coaches want to sit him.`,
        opts: [
          { label: 'SIT HIM A WEEK', hint: 'Reset his head', go() { Dilemma.sitOut(p, 1, 'benched'); Dilemma.boost(p, 2, 4); return `${lastName(p[1])} watches a week, then comes back focused: +2 OVR after.`; } },
          { label: 'KEEP STARTING HIM', hint: 'He learns by playing. Big swing.', go() { if (chance(0.5)) { p[3] = clamp(p[3] + 2, 40, 99); return `It clicked! ${lastName(p[1])} figured it out: +2 OVR for good.`; } Dilemma.boost(p, -3, 2); return `More mistakes. ${lastName(p[1])}: -3 OVR for 2 games.`; } }] };
    },
    scouting() {
      const o = Dilemma.opp(); if (!o) return null;
      return { title: 'Scouting Tip', text: `Your scouts found a weakness in the ${tName(o)} defense. Using it means a whole week of special practice.`,
        opts: [
          { label: 'BUILD THE GAME PLAN', hint: 'Better next game, no reps for the young guys', go() { Dilemma.teamBoost(2, 1); return 'Everyone knows the plan: +2 OVR next game.'; } },
          { label: 'NORMAL WEEK', hint: 'Young players get their reps', go() { const y = Season.bench(Dilemma.me()).filter(p => p && !Season.hurt(p) && Dilemma.age(p) <= 24).sort((a, b) => b[3] - a[3]).slice(0, 2); y.forEach(p => p[3] = clamp(p[3] + 1, 40, 99)); return y.length ? `${y.map(p => lastName(p[1])).join(' and ')} got good reps: +1 OVR for good.` : 'A normal week. Nothing new.'; } }] };
    },
    qbBattle() {
      const R = Dilemma.R(), qb = R.off[0], bench = Season.bench(Dilemma.me()), b = bench.find(p => p && p[0] === 'QB' && !Season.hurt(p) && p[3] >= (qb ? qb[3] - 6 : 0));
      if (!qb || !b || Season.hurt(qb)) return null;
      Dilemma.rec = { a: qb[1], b: b[1] };
      return { title: 'QB Controversy', text: `Backup ${Dilemma.nm(b)} (${b[3]}) has looked great in practice. Fans want him to start over ${Dilemma.nm(qb)} (${qb[3]}).`,
        opts: [
          { label: 'START THE BACKUP', hint: 'New energy. The starter will be upset.', go() { const j = bench.indexOf(b); if (j >= 0) { bench[j] = qb; R.off[0] = b; } b[3] = clamp(b[3] + 2, 40, 99); Dilemma.boost(qb, -2, 2); return `${lastName(b[1])} gets the start and +2 OVR for good. ${lastName(qb[1])} is not happy: -2 for 2 games.`; } },
          { label: 'STICK WITH YOUR QB', hint: 'Show faith in him', go() { Dilemma.boost(qb, 2, 2); return `${lastName(qb[1])} hears it: +2 OVR for 2 games.`; } }] };
    },
    coordinator() {
      return { title: 'Coordinator Interview', text: 'Your offensive coordinator has a head coaching interview with another team. He asks for your blessing.',
        opts: [
          { label: 'GIVE YOUR BLESSING', hint: 'Classy. Might lose him.', go() { if (chance(0.5)) { Dilemma.teamBoost(-1, 2); return 'He got the job! The offense is a little lost without him: everyone -1 OVR for 2 games.'; } Dilemma.teamBoost(1, 2); return 'He didn\'t get it, and he is grateful you backed him: everyone +1 OVR for 2 games.'; } },
          { label: 'ASK HIM TO STAY', hint: 'Keep the staff together', go() { if (chance(0.6)) { Dilemma.teamBoost(1, 3); return 'He stays and the staff is fired up: everyone +1 OVR for 3 games.'; } Dilemma.teamBoost(-2, 2); return 'He took the interview anyway and things got awkward: everyone -2 OVR for 2 games.'; } }] };
    },
    bigHits() {
      const p = Dilemma.pk(Dilemma.starters().filter(p => ['LB', 'S', 'CB'].includes(p[0]) && p[3] >= 74), 'a'); if (!p) return null;
      return { title: 'Too Many Flags', text: `${Dilemma.nm(p)} keeps getting flagged for late hits. The league is watching him.`,
        opts: [
          { label: 'TEACH SAFER TACKLING', hint: 'Slower now, better later', go() { Dilemma.boost(p, -2, 2); p[3] = clamp(p[3] + 1, 40, 99); return `${lastName(p[1])} is learning: -2 OVR for 2 games, then +1 for good.`; } },
          { label: 'LET HIM PLAY HIS WAY', hint: 'Could get suspended', go() { if (chance(0.35)) { Dilemma.sitOut(p, 1, 'suspended'); return `Another late hit. ${lastName(p[1])} is suspended 1 game.`; } Dilemma.boost(p, 2, 1); return `${lastName(p[1])} plays with fire: +2 OVR next game.`; } }] };
    },
    travel() {
      const g = Season.myGame(); if (!g || g.home === Dilemma.me()) return null;
      return { title: 'Long Road Trip', text: `It's a long flight to ${tName(g.home)}. Fly out a day early?`,
        opts: [
          { label: 'FLY OUT EARLY', hint: 'Rested, but a short practice week', go() { Dilemma.teamBoost(1, 1); const y = Dilemma.R().off[0]; if (y) Dilemma.boost(y, -1, 1); return 'The team is rested: everyone +1 OVR next game (QB -1, fewer practice reps).'; } },
          { label: 'NORMAL SCHEDULE', hint: 'Full practice week, jet lag risk', go() { if (chance(0.4)) { Dilemma.teamBoost(-1, 1); return 'Jet lag hit hard: everyone -1 OVR next game.'; } return 'Smooth trip. No problems.'; } }] };
    },
    teamNight() {
      return { title: 'Team Bowling Night', text: 'The players want a team bowling night to bond before a big stretch of games.',
        opts: [
          { label: 'GO BOWLING', hint: 'Team bonding. Tiny injury risk.', go() { Dilemma.teamBoost(1, 2); if (chance(0.1)) { const h = Dilemma.pk(Dilemma.starters(), 'a'); if (h) { Dilemma.sitOut(h, 1, 'wrist'); return `Great night: everyone +1 OVR for 2 games. ${Dilemma.nm(h)} hurt his wrist bowling and misses 1 game.`; } } return 'Great night: everyone +1 OVR for 2 games.'; } },
          { label: 'PLAYBOOK NIGHT', hint: 'Study instead', go() { const qb = Dilemma.R().off[0]; if (qb) Dilemma.boost(qb, 2, 1); return 'Extra study: QB +2 OVR next game. Some players are grumbling.'; } }] };
    },
    contractYear() {
      if (typeof Contracts === 'undefined') return null; Contracts.ensure();
      const R = Dilemma.R(), p = Dilemma.pk(R.off.filter(p => p && !Season.hurt(p) && ['RB', 'WR', 'TE'].includes(p[0]) && Contracts.con(p) && Contracts.con(p).yrs <= 1), 'a'); if (!p) return null;
      const other = R.off.filter(q => q && q !== p && ['RB', 'WR', 'TE'].includes(q[0]) && !Season.hurt(q)).sort((a, b) => b[3] - a[3])[0];
      return { title: 'Contract Year', text: `${Dilemma.nm(p)} is in the last year of his deal and wants the ball more to prove he deserves a big contract.`,
        opts: [
          { label: 'FEED HIM', hint: 'He gets hot, someone else waits', go() { Dilemma.boost(p, 3, 3); if (other) Dilemma.boost(other, -2, 2); return `${lastName(p[1])} is rolling: +3 OVR for 3 games.${other ? ` ${lastName(other[1])} gets fewer touches: -2 for 2 games.` : ''}`; } },
          { label: 'STICK TO THE PLAN', hint: 'Spread it around', go() { Dilemma.boost(p, -2, 2); return `${lastName(p[1])} sulks a little: -2 OVR for 2 games.`; } }] };
    },
    lateNight() {
      const s = Dilemma.starters().filter(p => p[0] !== 'QB'), a = Dilemma.pk(s, 'a'), b = a && Dilemma.pk(s.filter(p => p !== a), 'b'); if (!a || !b) return null;
      return { title: 'Missed Curfew', text: `${Dilemma.nm(a)} and ${Dilemma.nm(b)} got back to the team hotel way past curfew.`,
        opts: [
          { label: 'SIT THEM 1 GAME', hint: 'Rules are rules', go() { Dilemma.sitOut(a, 1, 'suspended'); Dilemma.sitOut(b, 1, 'suspended'); Dilemma.teamBoost(1, 2); return 'They sit 1 game. The team respects it: everyone +1 OVR for 2 games.'; } },
          { label: 'WARNING ONLY', hint: 'They play tired', go() { Dilemma.boost(a, -3, 1); Dilemma.boost(b, -3, 1); return 'They play, but they are tired: -3 OVR each next game.'; } }] };
    },
    hype() {
      const p = Dilemma.pk(Dilemma.starters().filter(p => Dilemma.age(p) <= 23), 'a'); if (!p) return null;
      return { title: 'Rookie Hype', text: `TV can't stop talking about ${Dilemma.nm(p)}. Everyone wants an interview with him.`,
        opts: [
          { label: 'PROTECT HIM', hint: 'No media this week', go() { Dilemma.boost(p, 2, 2); return `${lastName(p[1])} stays focused: +2 OVR for 2 games.`; } },
          { label: 'LET HIM SHINE', hint: 'Could go either way', go() { if (chance(0.5)) { Dilemma.boost(p, 4, 3); return `${lastName(p[1])} loves the spotlight: +4 OVR for 3 games!`; } Dilemma.boost(p, -3, 3); return `The hype got to him: -3 OVR for 3 games.`; } }] };
    },
    openPractice() {
      const o = Dilemma.opp(); if (!o) return null;
      return { title: 'Open Practice?', text: 'Fans are asking for an open practice this week. Thousands would come watch.',
        opts: [
          { label: 'OPEN IT UP', hint: 'Team loves it. Scouts might watch too.', go() { Dilemma.teamBoost(1, 1); if (chance(0.3)) { Dilemma.oppBoost(2, 1); return `Your players fed off the crowd: +1 OVR next game. But the ${tName(o)} saw your plays: they get +2 next game.`; } return 'Your players fed off the crowd: everyone +1 OVR next game.'; } },
          { label: 'CLOSED DOORS', hint: 'Keep the plays secret', go() { const qb = Dilemma.R().off[0]; if (qb) Dilemma.boost(qb, 1, 1); return 'Quiet, focused week: QB +1 OVR next game.'; } }] };
    },
    charity() {
      const top = Dilemma.starters().sort((a, b) => b[3] - a[3]).slice(0, 2); if (top.length < 2) return null;
      Dilemma.rec = { a: top[0][1], b: top[1][1] };
      return { title: 'Charity Game', text: `A celebrity softball game for the children's hospital wants your two biggest stars: ${Dilemma.nm(top[0])} and ${Dilemma.nm(top[1])}.`,
        opts: [
          { label: 'SEND YOUR STARS', hint: 'Great cause. Small injury risk.', go() { top.forEach(p => Dilemma.boost(p, 2, 2)); if (chance(0.15)) { Dilemma.sitOut(top[1], 1, 'sore back'); return `The city loves it and your stars feel great (+2 for 2 games). ${lastName(top[1][1])} tweaked his back and misses 1 game.`; } return 'The city loves it. Your stars feel great: +2 OVR for 2 games.'; } },
          { label: 'SEND THE BACKUPS', hint: 'Young guys get the spotlight', go() { const y = Season.bench(Dilemma.me()).filter(p => p && !Season.hurt(p)).sort((a, b) => b[3] - a[3]).slice(0, 2); y.forEach(p => p[3] = clamp(p[3] + 1, 40, 99)); return y.length ? `${y.map(p => lastName(p[1])).join(' and ')} loved it: +1 OVR for good.` : 'The backups had fun.'; } }] };
    },
    lostPlaybook() {
      const o = Dilemma.opp(); if (!o) return null;
      return { title: 'Lost Playbook', text: `A player left his playbook on the team bus. It might have ended up with the ${tName(o)}.`,
        opts: [
          { label: 'CHANGE THE PLAYS', hint: 'Safe, but new plays to learn', go() { Dilemma.teamBoost(-1, 1); return 'New signals, new names: everyone -1 OVR next game while they learn them.'; } },
          { label: 'KEEP THEM', hint: 'Probably nothing...', go() { if (chance(0.4)) { Dilemma.oppBoost(3, 1); return `They had it. The ${tName(o)} know your plays: +3 OVR for them next game.`; } return 'Nobody found it. Phew.'; } }] };
    }
  },
  // between weeks: about 1 in 3, never two weeks in a row
  maybe() {
    const d = Season.data;
    if (d && d.dilemma && d.dilemma.week !== d.week) delete d.dilemma; // skipped (only possible from tests / old flows)
    if (!d || d.phase !== 'regular' || d.dilemma || d.week < 1 || d.week >= d.games || (Season.isCareer && Season.isCareer())) return;
    const last = (d.dilemmas || []).slice(-1)[0];
    if (last && last.year === d.year && d.week - last.week < 2) return;
    if (!chance(0.45)) return;
    const used = (d.dilemmas || []).filter(x => x.year === d.year).map(x => x.kind);
    const kinds = shuffle(Object.keys(this.KINDS)).filter(k => !used.includes(k)); // no repeats in a season
    for (const k of kinds) if (this.make(k)) return;
  },
  make(k) {
    const d = Season.data; let m = null; this.fix = null; this.rec = {};
    try { m = this.KINDS[k](); } catch (e) { m = null; }
    if (!m) return false;
    d.dilemma = { kind: k, args: this.rec, week: d.week, year: d.year, title: m.title, text: m.text, opts: m.opts.map(o => ({ label: o.label, hint: o.hint, off: !!o.off })) };
    this.live = m; return true;
  },
  // the choice. The effects are rebuilt from the same kind if the page was reloaded
  choose(i) {
    const d = Season.data, D = d.dilemma; if (!D) return null;
    let m = this.live && this.live.title === D.title && this.live.text === D.text ? this.live : null;
    if (!m) { // reloaded: rebuild it with the same players
      this.fix = D.args || {}; try { m = this.KINDS[D.kind](); } catch (e) { m = null; } this.fix = null;
      if (!m) { delete d.dilemma; Season.save(); return 'The moment passed. Nothing changed.'; }
    }
    const o = m.opts[i]; if (!o || o.off) return null;
    const res = o.go();
    (d.dilemmas || (d.dilemmas = [])).push({ kind: D.kind, year: D.year, week: D.week, title: D.title, choice: o.label, result: res });
    Season.news(`COACH'S CALL: ${D.title}. You chose ${o.label.toLowerCase()}. ${res}`);
    delete d.dilemma; this.live = null;
    Season.save();
    return res;
  },
  autoPick() { const D = Season.data.dilemma; if (!D) return; const ok = D.opts.map((o, i) => o.off ? -1 : i).filter(i => i >= 0); return this.choose(pick(ok)); }
};
// heal one player right away (used by "play through it")
Season.injuryWeekHeal = function (p) {
  const me = this.data.team; p[6].inj = 0; this.healed(me, p, this.data.week);
  const R = this.ensureRosters()[me]; if (R.off.includes(p) || R.def.includes(p)) return;
  // put him back over whoever is starting at his spot
  for (const side of ['off', 'def']) { const i = R[side].findIndex((q, k) => q && posGroup(TEAMS.find(t => t.id === me)[side][k][0]) === posGroup(p[0]) && q[3] < p[3]); if (i >= 0) { const b = this.bench(me), j = b.indexOf(p); if (j >= 0) { b[j] = R[side][i]; R[side][i] = p; } return; } }
};
// hooks: boosts wear off after each game, a new dilemma might show up, everything resets for next year
{ const _fw = Season.finishWeek; Season.finishWeek = function (s) { _fw.call(this, s); Dilemma.tick(); Dilemma.maybe(); this.save(); }; }
{ const _fp = Season.finishPlayoffRound; Season.finishPlayoffRound = function (s) { _fp.call(this, s); Dilemma.tick(); this.save(); }; }
{ const _ny = Season.nextYear; Season.nextYear = function () { Dilemma.tick(true); delete this.data.dilemma; return _ny.call(this); }; }

// ---------------- the card on the season hub ----------------
{ const _hub = renderHub; renderHub = function () {
  _hub();
  const d = Season.data; let box = $('dlmBox');
  if (!box) { box = document.createElement('div'); box.id = 'dlmBox'; $('seasonHub').appendChild(box); }
  if (d && d.dilemma && (d.phase !== 'regular' || d.dilemma.week !== d.week || d.dilemma.year !== d.year)) { delete d.dilemma; Season.save(); } // the week moved on without an answer
  const D = d && d.dilemma;
  if (!D) { box.style.display = 'none'; return; }
  $('shPlay').style.display = $('shSim').style.display = 'none';
  box.style.display = 'flex';
  box.innerHTML = `<div class="dlmCard"><div class="dlmTag">COACH'S CALL  ·  WEEK ${D.week + 1}</div><div class="dlmT">${D.title}</div><div class="dlmTx">${D.text}</div>
    <div class="dlmOpts">${D.opts.map((o, i) => `<button data-i="${i}"${o.off ? ' disabled' : ''}><b>${o.label}</b><i>${o.hint}</i></button>`).join('')}</div></div>`;
  box.querySelectorAll('.dlmOpts button').forEach(b => b.onclick = () => {
    const res = Dilemma.choose(+b.dataset.i); if (res == null) return;
    Sound.click();
    box.innerHTML = `<div class="dlmCard"><div class="dlmTag">COACH'S CALL  ·  RESULT</div><div class="dlmT">${D.title}</div><div class="dlmTx dlmRes">${res}</div><div class="dlmOpts"><button class="gold" id="dlmOk"><b>BACK TO THE SEASON</b></button></div></div>`;
    $('dlmOk').onclick = () => { Sound.click(); renderHub(); };
  });
}; }
