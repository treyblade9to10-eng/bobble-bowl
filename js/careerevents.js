// ---- Career moments: about 1 week in 3 something comes up (college + NFL). Every choice moves something real ----
// c.evt = the open one { k, t, x, a, o: [[label, hint]], wk }   c.evh = [{ k, s }] (s = season tag, no repeats in a season)   c.evDue = a game was played since the last roll
// effects (fx): tr coach trust, tt team trust, mo morale, xp, gpa, en energy, st draft stock, bk Bobble Bucks (in-game), job depth-chart battle, sit games, inj weeks, slump games, risk (injury risk next game)
const CareerEvt = {
  cap() { return Career.cap; },
  college() { return this.cap().phase === 'college'; },
  nextOpp() { const c = this.cap(); if (this.college()) { const g = Career.collegeGame(); return g && g.opp; } const g = Season.data && Season.myGame(); return g && (g.home === c.team ? g.away : g.home); },
  mate(not) {
    const t = CareerHard.myTeam(), L = t.off.concat(t.def).filter(p => p && p[0] !== 'OL' && !(p[6] && p[6].cap) && p[1] !== not);
    const p = pick(L.length ? L : t.off); return `${p[0]} ${p[1]}`;
  },
  SWITCH: { RB: 'WR', WR: 'CB', TE: 'WR', DL: 'LB', LB: 'DL', CB: 'S', S: 'CB' },
  // apply effects, return the chips
  fx(o) {
    const c = this.cap(), L = typeof CareerLife !== 'undefined' && CareerLife.L(), out = [], sg = v => (v > 0 ? '+' : '') + v;
    if (o.tr) { Career.addTrust(o.tr); out.push(`COACH TRUST ${sg(o.tr)}`); }
    if (o.tt && L) { CareerLife.add('tt', o.tt); out.push(`TEAM TRUST ${sg(o.tt)}`); }
    if (o.mo && L) { CareerLife.add('morale', o.mo); out.push(`MORALE ${sg(o.mo)}`); }
    if (o.xp) { Career.gainXP(o.xp); out.push(`+${o.xp} XP`); }
    if (o.gpa && c.school && c.phase === 'college') { c.school.gpa = +clamp(c.school.gpa + o.gpa, 0, 4).toFixed(2); out.push(`GPA ${sg(o.gpa.toFixed(2))} (${c.school.gpa.toFixed(2)})`); if (c.school.gpa < CareerSchool.PROB && !c.school.prob) { c.school.prob = 1; c.school.sitWk = c.college.week; } }
    if (o.en && c.school && c.phase === 'college') { c.school.energy = clamp(c.school.energy + o.en, 0, 100); out.push(`ENERGY ${sg(o.en)}`); }
    if (o.st) { c.stockAdj = (c.stockAdj || 0) + o.st; out.push(`DRAFT STOCK ${o.st > 0 ? 'UP' : 'DOWN'}`); }
    if (o.bk && L) { L.bucks = +Math.max(0, L.bucks + o.bk).toFixed(2); out.push(`${sg(o.bk)}M BOBBLE BUCKS`); }
    if (o.job && c.depth) { c.jobAdj = (c.jobAdj || 0) + o.job; out.push(`JOB BATTLE ${o.job > 0 ? 'UP' : 'DOWN'}`); }
    if (o.sit) { c.sit = (c.sit || 0) + o.sit; out.push(`SIT ${o.sit} GAME${o.sit > 1 ? 'S' : ''}`); }
    if (o.inj) { CareerHard.injure(o.inj, o.what); c.hn && c.hn.pop(); out.push(`OUT ${o.inj} GAME${o.inj > 1 ? 'S' : ''}`); }
    if (o.slump) { c.slump = { g: o.slump, d: o.d || 3 }; out.push(`-${o.d || 3} RATINGS FOR ${o.slump} GAME${o.slump > 1 ? 'S' : ''}`); }
    if (o.risk) { c.risk = (c.risk || 0) + o.risk; out.push('INJURY RISK UP'); }
    return out;
  },
  // ---------- the moments ----------
  // w: 'c' college only, 'n' NFL only, 'a' both. ok(c) = can it happen now. make(c) = { t, x, a, o: [[label, hint]] }. go[i](a) = { say, fx }
  K: {
    exam: { w: 'c', make: () => ({ t: 'Big Exam Week', x: 'You have a huge history exam the same week as a road game. The team bus leaves Thursday.', o: [['STUDY ALL WEEK', 'Ace it, miss a practice'], ['CRAM ON THE BUS', 'Some of both, tiring'], ['WING IT', 'All football']] }),
      go: [() => ({ say: 'You crushed the exam. Coach wasn\'t thrilled you missed practice.', fx: { gpa: 0.2, en: -5, tr: -1 } }), () => ({ say: 'Long nights on the bus. A solid grade, tired legs.', fx: { gpa: 0.08, en: -15 } }), () => ({ say: 'Great week of practice. The exam... not so great.', fx: { gpa: -0.25, xp: 30 } })] },
    tutor: { w: 'c', ok: c => c.school && c.school.gpa < 3.2, make: () => ({ t: 'Tutor Offer', x: 'The academic advisor found you a tutor for your toughest class. It means two early mornings a week.', o: [['TAKE THE TUTOR', 'Grades up, a bit tired'], ['NO THANKS', 'Sleep in']] }),
      go: [() => ({ say: 'The tutor is great. Your grades are climbing.', fx: { gpa: 0.15, en: -5 } }), () => ({ say: 'Extra sleep feels good. The class is still hard.', fx: { en: 8, gpa: -0.05 } })] },
    nil: { w: 'c', make: () => ({ t: 'NIL Deal', x: 'A local pizza place wants you in their TV commercial. It pays in Bobble Bucks (in-game only).', o: [['SIGN IT', 'Bobble Bucks + fame'], ['PUT THE LINEMEN IN IT TOO', 'Share the spotlight'], ['PASS', 'Stay focused']] }),
      go: [() => chance(0.3) ? { say: 'The commercial is everywhere. A few teammates think you\'re showing off.', fx: { bk: 0.3, mo: 5, tt: -5 } } : { say: 'The commercial is a hit around campus.', fx: { bk: 0.3, mo: 5, en: -5 } },
        () => ({ say: 'The big guys up front loved being on TV. The locker room is tight.', fx: { bk: 0.1, tt: 6, mo: 2 } }), () => ({ say: 'Coach likes that you kept your head in the playbook.', fx: { tr: 2 } })] },
    agent: { w: 'c', make: () => ({ t: 'An Agent Calls', x: 'A big-time sports agent wants to meet you this week. Coach says the season comes first.', o: [['MEET HIM', 'Scouts hear your name'], ['FOCUS ON THE SEASON', 'Coach approves']] }),
      go: [() => ({ say: 'The agent talks you up to NFL teams. Coach is not happy about the distraction.', fx: { st: 2, tr: -4, mo: 3 } }), () => ({ say: 'Coach noticed. "That\'s a leader," he told the team.', fx: { tr: 3 } })] },
    project: { w: 'c', make: () => ({ t: 'Group Project', x: 'Your group project is due the same night as a team meeting.', o: [['DO THE PROJECT', 'Grades first'], ['GO TO THE MEETING', 'Team first'], ['ASK FOR MORE TIME', 'Maybe the teacher says yes']] }),
      go: [() => ({ say: 'Your group got an A. Coach asked where you were.', fx: { gpa: 0.12, tr: -3 } }), () => ({ say: 'Coach saw you there. Your group was not happy.', fx: { gpa: -0.12, tr: 3 } }),
        () => chance(0.6) ? { say: 'The teacher said yes. You made both.', fx: { gpa: 0.05, tr: 1 } } : { say: 'No extension. You turned in a rushed project.', fx: { gpa: -0.15 } }] },
    walkon: { w: 'c', make: c => { const m = this_mate(); return { t: 'Walk-On Wants Help', x: `${m}, a walk-on, asks you to stay after practice and help him earn a scholarship.`, a: { m }, o: [['HELP HIM', 'Good teammate, more tired'], ['NOT THIS WEEK', 'Rest up']] }; },
      go: [a => ({ say: `${lastName(a.m)} is getting better every day. The locker room noticed.`, fx: { tt: 6, en: -10, xp: 15 } }), a => ({ say: `${lastName(a.m)} understands. Kind of.`, fx: { tt: -2, en: 5 } })] },
    speed: { w: 'c', ok: c => c.college.week >= 3, make: () => ({ t: 'Speed Coach', x: 'A speed coach offers to train you for the NFL Combine this season. Early mornings, sore legs.', o: [['SIGN UP', '+1 speed, tiring'], ['AFTER THE SEASON', 'Stay fresh']] }),
      go: [() => { Career.cap.spd = Math.min(99, Career.cap.spd + 1); return { say: 'You got faster. Your legs feel it.', fx: { en: -15, gpa: -0.05 } }; }, () => ({ say: 'Fresh legs for the rest of the season.', fx: { en: 5 } })] },
    late: { w: 'a', make: c => { const o = CareerEvt.nextOpp(); return { t: 'Late Night Out', x: `Some teammates want you to come along for a late night out the night before the ${o ? tFull(o) : 'next'} game.`, o: [['GO ALONG', 'Fun, but tired'], ['STAY IN', 'Rest up'], ['HOST A FILM NIGHT', 'Bring them to you']] }; },
      go: [() => chance(0.4) ? { say: 'Coach found out you were out late. He is not happy.', fx: { mo: 6, en: -25, tr: -6, slump: 1, d: 2 } } : { say: 'A fun night. You are dragging a little.', fx: { mo: 6, en: -25, tt: 2 } },
        () => ({ say: 'Early night. You wake up fresh.', fx: { en: 10, tr: 1 } }), () => ({ say: 'Pizza and game film. The guys loved it and so did coach.', fx: { tt: 5, tr: 2, en: -5 } })] },
    captain: { w: 'a', ok: c => (c.trust || 0) >= 35, make: () => ({ t: 'Team Captain?', x: 'Your teammates voted you a captain. It means more meetings and more pressure.', o: [['ACCEPT', 'Lead the team'], ['LET A VETERAN HAVE IT', 'Stay in your lane']] }),
      go: [() => ({ say: 'Captain! The C on your jersey looks good.', fx: { tt: 6, tr: 3, mo: 3, en: -10 } }), () => ({ say: 'The veteran appreciated it.', fx: { tt: 3, tr: 1 } })] },
    fan: { w: 'a', make: () => ({ t: 'Biggest Fan', x: 'A kid in the children\'s hospital says you are his favorite player. His family asks if you could visit.', o: [['VISIT HIM', 'Your day off'], ['SEND A SIGNED BALL', 'Quick and kind'], ['TOO BUSY', 'Focus on football']] }),
      go: [() => ({ say: 'You spent the afternoon with him. Best day of the season.', fx: { mo: 8, tt: 3, en: -10 } }), () => ({ say: 'He sleeps with the ball now. His mom sent a thank-you.', fx: { mo: 2 } }), () => ({ say: 'You stayed in the film room. It felt a little empty.', fx: { mo: -3, xp: 10 } })] },
    media: { w: 'a', make: () => ({ t: 'Media Question', x: 'A reporter asks: "Should your coach be calling more plays for you?"', o: [['DEFEND THE COACH', '"He knows what he\'s doing"'], ['"I WANT THE BALL"', 'Bold. Risky.'], ['NO COMMENT', 'Play it safe']] }),
      go: [() => ({ say: 'Coach read it the next morning and gave you a nod.', fx: { tr: 5 } }), () => chance(0.3) ? { say: 'Coach liked the fire. You get a bigger role this week.', fx: { mo: 3, job: 2 } } : { say: 'Coach did not like reading that in the paper.', fx: { mo: 3, tr: -7 } }, () => ({ say: 'Nothing to see here.', fx: {} })] },
    drama: { w: 'a', make: c => { const m = this_mate(); return { t: 'Teammate Drama', x: `${m} is upset that you get all the attention. He has been grumbling in the locker room.`, a: { m }, o: [['TALK IT OUT', 'Could fix it'], ['IGNORE IT', 'It might go away'], ['TELL THE COACH', 'Let him handle it']] }; },
      go: [a => chance(0.6) ? { say: `Good talk. You and ${lastName(a.m)} are cool now.`, fx: { tt: 5 } } : { say: `${lastName(a.m)} didn't want to hear it.`, fx: { tt: -2, mo: -2 } },
        a => chance(0.35) ? { say: 'It got worse. Now half the locker room is talking about it.', fx: { tt: -6, mo: -3 } } : { say: 'It blew over.', fx: {} }, a => ({ say: 'Coach handled it. Some guys think you snitched.', fx: { tr: 2, tt: -3 } })] },
    tweak: { w: 'a', make: () => ({ t: 'Tweaked Ankle', x: 'You rolled your ankle in practice. The trainer says it is minor, but it is sore.', o: [['PLAY THROUGH IT', 'Play hurt, could get worse'], ['SIT ONE GAME', 'Heal up, the backup plays'], ['SEE THE TRAINER', 'Ice + tape, maybe fine']] }),
      go: [() => chance(0.25) ? { say: 'It got worse in the next practice.', fx: { inj: 2, what: 'ankle sprain' } } : { say: 'You tape it up and play. You are not 100%.', fx: { slump: 2, d: 4, tr: 2 } },
        () => ({ say: 'You rest it. Your backup gets the start.', fx: { inj: 1, what: 'sore ankle', job: -1 } }), () => chance(0.5) ? { say: 'Ice, tape, good as new.', fx: { en: -5 } } : { say: 'The trainer wants you out a week.', fx: { inj: 1, what: 'sore ankle' } }] },
    trash: { w: 'a', ok: () => !!CareerEvt.nextOpp(), make: () => { const o = CareerEvt.nextOpp(); return { t: 'Trash Talk', x: `A ${tFull(o)} player said you are "overrated" on social media. Everyone is waiting for your answer.`, a: { o }, o: [['CLAP BACK', 'Fire up the fans'], ['STAY QUIET', 'Let the game talk'], ['PIN IT IN YOUR LOCKER', 'Extra motivation']] }; },
      go: [() => chance(0.35) ? { say: 'The fans loved it. Coach thinks you are giving them bulletin-board material.', fx: { mo: 6, tr: -5 } } : { say: 'The fans loved it!', fx: { mo: 6 } }, () => ({ say: 'Coach likes the calm.', fx: { tr: 2 } }), () => ({ say: 'You read it every morning before practice.', fx: { xp: 25, mo: 3 } })] },
    film: { w: 'a', make: () => ({ t: 'Early Film Session', x: 'Coach invites a few players to an extra film session at 6 AM Saturday.', o: [['BE THERE', 'Learn + coach trust'], ['SLEEP IN', 'Rest']] }),
      go: [() => ({ say: 'You spotted a tell in their defense. Coach was impressed.', fx: { tr: 4, xp: 20, en: -8 } }), () => ({ say: 'Great sleep. Coach noticed the empty chair.', fx: { en: 10, tr: -2 } })] },
    post: { w: 'a', make: () => ({ t: 'Post Gone Wrong', x: 'A joke you posted got taken the wrong way. People are arguing about it online.', o: [['APOLOGIZE', 'Own it'], ['DOUBLE DOWN', 'You meant it'], ['LOG OFF FOR A WEEK', 'Quiet time']] }),
      go: [() => ({ say: 'Classy. It blew over fast.', fx: { tt: 3, mo: -2 } }), () => ({ say: 'It got louder. The front office is not thrilled.', fx: { mo: 3, tt: -6, tr: -2 } }), () => ({ say: 'Peace and quiet. It feels good.', fx: { mo: -1, en: 5, xp: 10 } })] },
    switch: { w: 'a', ok: c => !c.tw && !!CareerEvt.SWITCH[c.pos] && !c.switched, make: c => { const to = CareerEvt.SWITCH[c.pos]; return { t: 'Switch Positions?', x: `Coach thinks you could help the team more at ${to}. He wants you to move from ${c.pos} to ${to}.`, a: { to }, o: [[`MOVE TO ${to}`, 'New spot, coach loves it'], ['STAY AT ' + c.pos, 'Your spot, coach is let down']] }; },
      go: [a => { const c = Career.cap; c.switched = 1; c.pos = a.to; c.arch = CAP_ARCH[a.to][0][0]; c.a = c.a.map(v => Math.max(40, v - 2)); c.depth = null; return { say: `You're a ${a.to} now. New skills to learn (-2 for now), but coach loves the buy-in.`, fx: { tr: 8, tt: 3 } }; },
        () => { Career.cap.switched = 1; return { say: 'You stay put. Coach says he understands.', fx: { tr: -5, mo: 2 } }; }] },
    mentor: { w: 'n', make: () => ({ t: 'Rookie Asks for Help', x: 'A rookie at your position asks you to show him the ropes. He could take snaps from you one day.', o: [['MENTOR HIM', 'Great teammate'], ['FOCUS ON YOURSELF', 'Your job first']] }),
      go: [() => ({ say: 'The kid is learning fast. The locker room loves it.', fx: { tt: 6, tr: 3, job: -1 } }), () => ({ say: 'Extra reps for you.', fx: { xp: 40, tt: -3 } })] },
    holdout: { w: 'n', ok: c => c.contract && c.contract.years <= 2 && Career.ovr() >= 78 && Career.yearNum() >= 2 && !(typeof Season !== 'undefined' && Season.data && Season.data.phase === 'playoffs'), make: c => ({ t: 'Hold Out?', x: `You are playing better than your deal (${bucks(c.contract.total / (c.contract.len || 4))} Bobble Bucks a year). Your agent says a holdout could get you paid.`, o: [['HOLD OUT', 'Sit until they pay. Risky.'], ['PLAY IT OUT', 'Team-first'], ['AGENT ASKS QUIETLY', 'Small chance of a raise']] }),
      go: [() => { const c = Career.cap, w = 1 + (chance(0.5) ? 1 : 0); if (chance(0.5)) { const ext = +(CareerLife.base() * 3 * 1.1).toFixed(1); c.contract.total = +(c.contract.total + ext).toFixed(1); c.contract.years += 3; c.contract.len = (c.contract.len || 4) + 3; return { say: `You sat ${w} game${w > 1 ? 's' : ''}, then they caved: 3 more years, +${bucks(ext)} Bobble Bucks.`, fx: { sit: w, tt: -4, mo: 6 } }; } return { say: `You sat ${w} game${w > 1 ? 's' : ''} and they didn't budge. The front office is mad.`, fx: { sit: w, tt: -10, tr: -8, mo: -4 } }; },
        () => ({ say: 'The team appreciates it. That pays off at contract time.', fx: { tt: 5, tr: 3 } }),
        () => { const c = Career.cap; if (chance(0.4)) { const up = +(c.contract.total * 0.15).toFixed(1); c.contract.total = +(c.contract.total + up).toFixed(1); return { say: `Your agent got you a quiet raise: +${bucks(up)} Bobble Bucks.`, fx: { mo: 3 } }; } return { say: 'The team said no. No harm done.', fx: {} }; }] },
    endorse: { w: 'n', make: () => ({ t: 'Cereal Box', x: 'A cereal company wants your face on the box and a commercial shoot this week (Bobble Bucks, in-game only).', o: [['TAKE THE DEAL', 'Bobble Bucks + fame'], ['PASS', 'Football first']] }),
      go: [() => chance(0.25) ? { say: 'You are on the box! The shoot ran long and you missed a walkthrough.', fx: { bk: 1.5, mo: 3, tr: -3 } } : { say: 'You are on the box! Kids everywhere eat you for breakfast.', fx: { bk: 1.5, mo: 3 } }, () => ({ say: 'Coach liked the focus.', fx: { tr: 2 } })] },
    vet: { w: 'n', ok: c => c.depth && c.depth.role === 'bench', make: c => ({ t: 'Slow Down, Rookie', x: `${c.depth.name}, the starter ahead of you, tells you to stop going so hard in practice. "You're making us look bad."`, o: [['KEEP GOING HARD', 'Win the job'], ['BACK OFF A BIT', 'Keep the peace']] }),
      go: [() => ({ say: 'Coach noticed. So did he.', fx: { job: 2, tt: -3, tr: 2 } }), () => ({ say: 'The vets like you. The coach sees less from you.', fx: { tt: 3, job: -1 } })] },
    rumor: { w: 'n', make: () => ({ t: 'Trade Rumors', x: 'TV says your team is shopping you before the deadline. Your phone is blowing up.', o: [['TALK TO THE GM', 'Get the truth'], ['IGNORE IT', 'Just play'], ['POST ABOUT IT', 'Speak your mind']] }),
      go: [() => chance(0.5) ? { say: '"You\'re not going anywhere." That felt good.', fx: { tr: 4, mo: 3 } } : { say: 'The GM wouldn\'t say no. Awkward.', fx: { mo: -3 } }, () => ({ say: 'It is hard not to think about it.', fx: { mo: -2 } }), () => ({ say: 'The fans are with you. The front office, not so much.', fx: { mo: 3, tt: -5 } })] },
    restructure: { w: 'n', ok: c => c.contract && c.contract.years >= 2 && !c.contract.rookie, make: () => ({ t: 'Take Less?', x: 'The team asks you to take a little less (Bobble Bucks, in-game) so they can keep a key teammate.', o: [['AGREE', 'Team-first'], ['SAY NO', 'You earned it']] }),
      go: [() => { const c = Career.cap, cut = +(c.contract.total * 0.1).toFixed(1); c.contract.total = +(c.contract.total - cut).toFixed(1); return { say: `You gave back ${bucks(cut)}. The whole building respects it.`, fx: { tt: 8, tr: 3 } }; }, () => ({ say: 'Fair enough. They find the money somewhere else.', fx: { tt: -4 } })] },
    camp: { w: 'n', make: () => ({ t: 'Youth Camp', x: 'A local youth league asks you to run a free football camp on your day off.', o: [['RUN THE CAMP', 'Great for the city'], ['REST', 'Day off is a day off']] }),
      go: [() => ({ say: 'Two hundred kids ran your routes. The city loves you.', fx: { tt: 3, mo: 5 } }), () => ({ say: 'A quiet day. You feel rested.', fx: { mo: 1 } })] },
    playoff: { w: 'n', ok: () => typeof Season !== 'undefined' && Season.data && Season.data.phase === 'playoffs', make: () => ({ t: 'Banged Up', x: 'Playoff week and your shoulder is sore. The trainer says playing could make it worse.', o: [['PLAY', 'Win now, injury risk'], ['SIT', 'Heal, miss the game']] }),
      go: [() => ({ say: 'You are suiting up. The team is fired up.', fx: { tr: 3, tt: 3, risk: 0.3 } }), () => ({ say: 'You sit. The guys will try to win one for you.', fx: { inj: 1, what: 'sore shoulder' } })] },
    duty: { w: 'n', ok: () => Career.yearNum() === 1, make: () => ({ t: 'Rookie Duty', x: 'The veterans say rookies carry the pads after practice and bring breakfast on Fridays.', o: [['DO IT WITH A SMILE', 'Earn respect'], ['REFUSE', 'You are a pro too']] }),
      go: [() => ({ say: 'Donuts on Friday. The vets love you now.', fx: { tt: 5, bk: -0.05 } }), () => ({ say: 'The vets will remember that.', fx: { tt: -5, mo: 2 } })] },
    scheme: { w: 'n', make: c => ({ t: 'New Role', x: `The new coordinator wants you to do more of the dirty work (more ${SEASON_RT.includes(c.pos) ? 'blocking' : 'run support'}, fewer highlight plays).`, o: [['BUY IN', 'Coach trust up'], ['PUSH BACK', 'You want the spotlight']] }),
      go: [() => ({ say: 'Coach calls you the ultimate team player.', fx: { tr: 6, mo: -3 } }), () => ({ say: 'You got your way. The coaches are grumbling.', fx: { tr: -5, mo: 3 } })] },
    jersey: { w: 'n', make: c => ({ t: 'Your Number', x: `A veteran just joined the team. He has worn #${c.num} his whole career and asks for yours.`, o: [['GIVE IT TO HIM', 'Pick a new number'], ['KEEP IT', 'It\'s yours'], ['ASK HIM TO DONATE TO CHARITY', 'He gets it, kids win']] }),
      go: [() => { const c = Career.cap; c.num = (c.num + 1 + Math.floor(rand(0, 40))) % 100; return { say: `You wear #${c.num} now. The vet owes you one.`, fx: { tt: 5 } }; }, () => ({ say: 'He was not happy.', fx: { tt: -4, mo: 2 } }),
        () => { const c = Career.cap; c.num = (c.num + 1 + Math.floor(rand(0, 40))) % 100; return { say: `He donated to the children's hospital. You wear #${c.num} now.`, fx: { tt: 3, mo: 3 } }; }] }
  },
  // between games: about 1 in 3, never twice in a row, no repeats in a season
  maybe() {
    const c = this.cap(); if (!c || !c.evDue || c.evt) return;
    c.evDue = false;
    const nfl = c.phase === 'nfl'; if (!(c.phase === 'college' && Career.collegeGame()) && !(nfl && CareerHard.inNFL() && Season.myGame())) return;
    if (c.evGn != null && c.gn - c.evGn < 2) return;
    if (!chance(0.38)) return;
    const s = CareerHard.yrTag(), used = (c.evh || []).filter(h => h.s === s).map(h => h.k);
    for (const k of shuffle(Object.keys(this.K))) {
      const K = this.K[k]; if (used.includes(k) || K.w === (nfl ? 'c' : 'n')) continue;
      let m = null; try { if (K.ok && !K.ok(c)) continue; m = K.make(c); } catch (e) { m = null; }
      if (!m) continue;
      c.evt = { k, s, t: m.t, x: m.x, a: m.a || {}, o: m.o };
      c.evGn = c.gn; Career.save(); return;
    }
  },
  open() { this.maybe(); const c = this.cap(); return c && c.evt; },
  choose(i) {
    const c = this.cap(), E = c && c.evt; if (!E) return null;
    const K = this.K[E.k], f = K && K.go[i];
    let r = { say: 'The moment passed.', fx: {} };
    try { if (f) r = f(E.a); } catch (e) { console.warn('career moment', e); }
    const chips = this.fx(r.fx || {});
    (c.evh || (c.evh = [])).push({ k: E.k, s: E.s, pick: E.o[i] ? E.o[i][0] : '' }); if (c.evh.length > 60) c.evh.shift();
    c.evt = null; c.evDue = false; Career.save();
    return { say: r.say, chips };
  },
  robot() { const E = this.cap().evt; return E ? this.choose(Math.floor(Math.random() * E.o.length)) : null; }
};
// a teammate's name (short helper the moments use)
function this_mate() { return CareerEvt.mate(Career.cap && Career.cap.depth && Career.cap.depth.name); }

Object.assign(CareerUI, {
  moment() {
    const c = Career.cap, E = c.evt, team = teamById(c.team) || { c1: '#333' };
    const wk = c.phase === 'college' ? `WEEK ${c.college.week + 1}` : Season.data.phase === 'playoffs' ? 'PLAYOFFS' : `WEEK ${Season.data.week + 1}`;
    this.set(`<div class="ceWrap" style="--tc:${team.c1}"><div class="dlmCard ceCard"><div class="dlmTag">${c.phase === 'college' ? 'COLLEGE LIFE' : 'CAREER MOMENT'}  ·  ${wk}</div><div class="dlmT">${E.t}</div><div class="dlmTx">${E.x}</div>
      <div class="dlmOpts">${E.o.map(([l, h], i) => `<button data-i="${i}"><b>${l}</b><i>${h}</i></button>`).join('')}</div></div></div>`, c.phase === 'college' ? 'College' : 'Career');
    document.querySelectorAll('.ceCard .dlmOpts button').forEach(b => b.onclick = () => {
      const r = CareerEvt.choose(+b.dataset.i); if (!r) return this.open();
      Sound.click();
      document.querySelector('.ceCard').innerHTML = `<div class="dlmTag">${c.phase === 'college' ? 'COLLEGE LIFE' : 'CAREER MOMENT'}  ·  RESULT</div><div class="dlmT">${E.t}</div><div class="dlmTx dlmRes">${r.say}</div>
        ${r.chips.length ? `<div class="ceChips">${r.chips.map(t => `<span class="${/[-]|DOWN|OUT|SIT|RISK/.test(t) ? 'bad' : ''}">${t}</span>`).join('')}</div>` : ''}<div class="dlmOpts"><button class="gold" id="ceOk"><b>CONTINUE</b></button></div>`;
      $('ceOk').onclick = () => { Sound.click(); this.open(); };
    });
  }
});
{
  const _open = CareerUI.open;
  CareerUI.open = function () {
    const r = _open.call(this), c = Career.cap;
    if (!c || !(c.phase === 'college' || c.phase === 'nfl')) return r;
    if (c.life && c.life.press) return r; // press conference first
    if (c.phase === 'nfl' && c.life && !c.life.agent) return r; // agent pick first
    if (CareerEvt.open()) return this.moment();
    return r;
  };
}
