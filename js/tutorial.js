// ---- Training Camp: a tutorial you play through. Each lesson is a real play with a goal; fail = run it back ----
screens.push('tutorial'); menuScreens.push('tutorial');
(() => {
  const el = document.createElement('div');
  el.id = 'tutorial'; el.className = 'screen';
  el.innerHTML = `<h2>Training Camp</h2><div id="tuSub"></div><div id="tuList"></div>
    <div class="row"><button class="big gold" id="tuGo">START</button><button id="tuBack">BACK</button></div>`;
  document.getElementById('stage').appendChild(el);
  const card = document.createElement('div'); card.id = 'tuCard'; document.getElementById('stage').appendChild(card);
  // title screen button
  const how = $('btnHow'); const b = document.createElement('button'); b.id = 'btnTut'; b.className = 'gold'; b.textContent = 'TUTORIAL';
  how.parentNode.insertBefore(b, how);
})();

const TUT_KEY = 'bobbleTutorial';
const Tutorial = {
  i: 0, active: null,
  done() { try { return JSON.parse(localStorage.getItem(TUT_KEY) || '[]'); } catch (e) { return []; } },
  markDone(k) { const d = this.done(); if (!d.includes(k)) d.push(k); try { localStorage.setItem(TUT_KEY, JSON.stringify(d)); } catch (e) {} },
  // m = mobile? Each lesson: scenario + which plays you can pick + step hints + how to judge the play
  LESSONS: [
    { key: 'pass', name: 'Passing', goal: 'Complete a pass', own: 30, plays: p => p.type === 'pass' && !p.special,
      hint: (m, st) => st === 'call' ? 'Pick any PASS play (blue tag). The dotted lines on the card are the routes.'
        : st === 'snap' ? (m ? 'Tap the field to snap the ball.' : 'Press SPACE to snap the ball.')
        : st === 'qb' ? (m ? 'Find an open receiver. Tap his triangle, or put your finger down, DRAG BACK and let go to throw.' : 'Press 1 2 3 or 4 to throw to that receiver, or click him.')
        : 'Run with it!' },
    { key: 'run', name: 'Running', goal: 'Run for 4+ yards', own: 30, plays: p => p.type === 'run' && !p.special && !p.qbRun,
      hint: (m, st) => st === 'call' ? 'Pick any RUN play (red tag). The orange line is where the runner goes.'
        : st === 'snap' ? (m ? 'Tap the field to snap.' : 'Press SPACE to snap.')
        : st === 'qb' ? 'The QB hands it off. Get ready...'
        : m ? 'Hold your finger where you want him to go. He follows it. Find the hole!' : 'WASD to run, hold SHIFT to sprint. Find the hole!' },
    { key: 'moves', name: 'Juke, Spin, Stiff Arm', goal: 'Use a move on a run', own: 35, plays: p => p.type === 'run' && !p.special && !p.qbRun,
      hint: (m, st) => st === 'call' ? 'Pick a RUN play again.'
        : st === 'snap' ? (m ? 'Tap the field to snap.' : 'Press SPACE to snap.')
        : st === 'qb' ? 'Wait for the handoff...'
        : m ? 'When a tackler gets close: TAP the screen to juke, or hit the SPIN or STIFF ARM button.' : 'When a tackler gets close: E = juke, F = spin, R = stiff arm.' },
    { key: 'def', name: 'Defense', goal: 'Hold them to 3 yards or less', own: 30, cpuBall: true,
      hint: (m, st) => st === 'call' ? 'Now you are on defense. Pick any play. Run Stuff is great against runs.'
        : st === 'snap' ? 'You control the player with the yellow ring. Wait for the snap...'
        : m ? 'Hold your finger to move. Tap near the ball carrier to dive tackle. Tap a teammate to switch to him.' : 'WASD to move, SPACE to dive tackle, Q to switch to the guy closest to the ball.' },
    { key: 'kick', name: 'Field Goals', goal: 'Make the field goal', own: 78, down: 4, plays: p => p.key === 'fg',
      hint: (m, st) => st === 'call' ? 'It is 4th down close to their end zone. Pick FIELD GOAL.'
        : (m ? 'TAP' : 'Press SPACE') + ' once to lock the POWER, then again when the needle is in the GREEN.' },
    { key: 'td', name: 'Final Test: Score!', goal: 'Score a touchdown', own: 75, plays: p => !p.special,
      hint: (m, st) => st === 'call' ? 'Put it all together. You have 4 downs to score from here. Pick any play.'
        : st === 'snap' ? (m ? 'Tap the field to snap.' : 'Press SPACE to snap.')
        : st === 'qb' ? (m ? 'Drag back to throw, or tap a receiver.' : '1-4 to throw, or run it with WASD.')
        : 'Get in the end zone!' }
  ],
  menu(msg) {
    const d = this.done();
    $('tuSub').textContent = msg || 'Learn the game by playing it. Each lesson is one real play. Miss the goal? Just run it back.';
    $('tuList').innerHTML = this.LESSONS.map((l, i) => `<button class="tuRow${d.includes(l.key) ? ' ok' : ''}" data-i="${i}"><span class="n">${i + 1}</span><b>${l.name}</b><span class="g">${l.goal}</span><span class="ck">${d.includes(l.key) ? 'DONE' : ''}</span></button>`).join('');
    $('tuList').querySelectorAll('.tuRow').forEach(b => b.onclick = () => { Sound.click(); this.start(+b.dataset.i); });
    const next = this.LESSONS.findIndex(l => !d.includes(l.key));
    $('tuGo').textContent = next < 0 ? 'PLAY IT AGAIN' : next === 0 ? 'START' : `CONTINUE: LESSON ${next + 1}`;
    $('tuGo').onclick = () => { Sound.click(); this.start(Math.max(0, next)); };
    show('tutorial');
  },
  start(i) {
    const L = this.LESSONS[i]; this.i = i;
    Sound.init(); Sound.whistle();
    if (G.mode === 'mobile') goFullscreen();
    const me = TEAMS.find(t => t.id === 'KC'), op = TEAMS.find(t => t.id === 'NYJ');
    G.demo = false; G.season = false; G.challenge = null; G.mini = null; G.paused = false; show(null);
    const side = L.cpuBall ? 1 : 0;
    this.active = { L, starting: true, teams: null, moved: false, ended: false };
    newGame(me, op, { qtr: 900, diff: 0, humanSide: 0, weather: 'clear', night: false, uni: ['home', 'away'],
      scenario: { quarter: 1, clock: 900, score: [0, 0], poss: side, own: L.own, timeouts: [3, 3], title: `LESSON ${i + 1}: ${L.name.toUpperCase()}`, sub: L.goal } });
    this.active.teams = G.teams; this.active.starting = false;
    if (L.down) { G.down = L.down; G.firstDownX = goalX(G.poss); G.goalToGo = true; onPlayCall(playCallCtx()); }
    G.catchX = null;
    $('tuCard').classList.add('on');
  },
  stop() { this.active = null; $('tuCard').classList.remove('on'); },
  // called after every play / kick with what happened
  judge(r) {
    const a = this.active; if (!a || a.ended) return;
    const L = a.L; let ok = null, why = '';
    if (L.key === 'pass') { ok = r.caught; why = r.caught ? 'Complete!' : r.sack ? 'Sacked. Throw it a little faster next time.' : 'Incomplete. Look for the guy with nobody near him.'; }
    if (L.key === 'run') { ok = r.yds >= 4 && !r.turnover; why = ok ? `${r.yds} yards!` : r.turnover ? 'Fumble! Hold on to the ball.' : `Only ${Math.max(0, r.yds)} yards. Look for the gap and follow your blockers.`; }
    if (L.key === 'moves') { ok = a.moved && !r.turnover; why = ok ? 'Nice move!' : 'No move that time. Try one when a tackler is close.'; }
    if (L.key === 'def') { ok = r.yds <= 3 && !r.td; why = ok ? (r.youTackled ? 'You made the tackle!' : 'Stopped them!') : `They got ${r.yds} yards. Get to the ball carrier faster.`; }
    if (L.key === 'kick') { ok = r.fgGood; why = ok ? 'Right down the middle!' : 'Missed. Watch for the green zone on the meter.'; }
    if (L.key === 'td') {
      if (r.td) { ok = true; why = 'TOUCHDOWN! You are ready.'; }
      else if (r.turnover || r.downs) { ok = false; why = r.turnover ? 'Turnover! Run it back.' : 'Turnover on downs. Run it back.'; }
      else return; // keep the drive going
    }
    a.ended = true;
    showBanner(ok ? 'LESSON COMPLETE' : 'TRY AGAIN', why, ok ? '#9cff9c' : '#ff9a3c', 2.2);
    if (ok) { this.markDone(L.key); Sound.td(); } else Sound.bad();
    const i = this.i;
    setTimeout(() => {
      if (this.active !== a) return; // they quit in the meantime
      if (!ok) return this.start(i);
      if (i + 1 < this.LESSONS.length) return this.start(i + 1);
      this.stop(); show('tutorial'); this.menu('Training Camp complete! You know everything you need. Go win a Bobble Bowl.');
    }, 2300);
  }
};

// hooks into the game
const _tutEndPlay = endPlay;
endPlay = function (res) {
  const a = Tutorial.active;
  if (a && G.teams === a.teams && G.phase === 'live' && G.play) {
    const d = dirOf(G.poss), carrierOurs = res.carrier ? res.carrier.side === G.poss : true;
    const yds = res.type === 'inc' ? 0 : Math.round(d * ((res.x != null ? res.x : G.los) - G.los));
    const caught = G.catchX != null && res.type !== 'inc' && carrierOurs && res.type !== 'int';
    const r = { type: res.type, yds, caught, sack: res.type === 'sack', td: res.type === 'td' && carrierOurs, turnover: !carrierOurs,
      youTackled: !!(G.lastTackler && G.lastTackler.isHuman) };
    const out = _tutEndPlay(res);
    G.catchX = null;
    Tutorial.judge(r);
    return out;
  }
  return _tutEndPlay(res);
};
// only show the plays that fit the lesson
const _tutOnPlayCall = onPlayCall;
onPlayCall = function (c) {
  _tutOnPlayCall(c);
  const a = Tutorial.active;
  if (!a || !(a.starting || G.teams === a.teams) || !a.L.plays || c.mode !== 'off') return;
  const keep = pcList.filter(a.L.plays);
  if (keep.length) { pcList = keep; pcCoach = keep[0].key; pcPage = 0; renderCards(); }
};

// watch the game: hint text, moves used, field goals, quitting
setInterval(() => {
  const a = Tutorial.active, card = $('tuCard');
  if (!a) return;
  if (G.teams !== a.teams || menuScreens.some(id => id !== 'playcall' && $(id) && $(id).classList.contains('show'))) { Tutorial.stop(); return; }
  const m = G.mode === 'mobile';
  const st = G.phase === 'playcall' ? 'call' : G.phase === 'presnap' ? 'snap' : G.phase === 'kickmeter' ? 'kick'
    : G.ball && G.ball.holder && G.ball.holder === G.O[0] && G.poss === G.human ? 'qb' : 'live';
  const carrier = G.ball && G.ball.holder;
  if (carrier && carrier.isHuman && (carrier.juke > 0 || carrier.spin > 0 || carrier.stiff > 0)) a.moved = true;
  // kicks don't go through endPlay
  if (a.L.key === 'kick' && !a.ended && G.banner) {
    const t = G.banner.text;
    if (t === "IT'S GOOD!") Tutorial.judge({ fgGood: true });
    else if (t === 'NO GOOD!' || t === 'SHORT!' || t === 'BLOCKED!') Tutorial.judge({ fgGood: false });
  }
  if (a.L.key === 'td' && !a.ended && G.poss !== G.human && G.phase === 'playcall') Tutorial.judge({ downs: true });
  card.innerHTML = `<div class="tuHead">LESSON ${Tutorial.i + 1}/${Tutorial.LESSONS.length}  ·  ${a.L.name.toUpperCase()}</div>
    <div class="tuGoal">GOAL: ${a.L.goal}</div><div class="tuHint">${a.ended ? '' : a.L.hint(m, st)}</div>`;
  card.classList.toggle('low', st === 'call');
}, 150);

$('btnTut').onclick = () => { Sound.init(); Sound.click(); modeAfter = 'tutorial'; show('mode'); };
$('tuBack').onclick = () => { Sound.click(); show('title'); };
