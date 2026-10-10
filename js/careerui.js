// ---- Career screens: create, college, combine, draft day, NFL hub, upgrades, gear, free agency, Hall of Fame + Trophy Case ----
screens.push('cap', 'trophies'); menuScreens.push('cap', 'trophies');
let capForm = null, capAnim = null, capTab = 'season', draftTimer = null;

// the season engine has two save slots: your franchise and your career
Season.slot = 'franchise';
Season.use = function (slot) {
  if (this.slot === slot) return;
  this.slot = slot; this.KEY = slot === 'career' ? 'bobbleCareerSeason' : 'bobbleSeason'; this.load();
};
const _seasonTeam = Season.team;
Season.team = function (id) { const t = _seasonTeam.call(this, id); return this.slot === 'career' ? Career.withCAP(t) : t; };
const _openSeason = openSeason;
openSeason = function () { Season.use('franchise'); _openSeason(); };
const _seasonCont = $('btnSeasonCont').onclick;
$('btnSeasonCont').onclick = () => { if (G.career) { G.season = false; G.career = false; G.teams = null; G.phase = 'idle'; CareerUI.open(); } else _seasonCont(); };
// combine 40: when the dash ends, back to the career
const _miniOver = G.hooks.onMiniOver;
G.hooks.onMiniOver = r => {
  if (G.mini && G.mini.combine) { const t = clamp(G.mini.done[0] || 5.4, 4.22, 5.8); Career.setCombine(t); Sound.td(); setTimeout(() => { G.mini = null; G.teams = null; CareerUI.open(); }, 900); return; }
  _miniOver(r);
};

$('btnCap').onclick = () => { Sound.init(); Sound.click(); CareerUI.open(); };
$('btnTrophies').onclick = () => { Sound.init(); Sound.click(); renderTrophies(); show('trophies'); };
$('troBack').onclick = () => show('title');

// little bobblehead of your guy (team can be an NFL or college team object)
function capPreview(tuple, team, cvId = 'capCv') {
  cancelAnimationFrame(capAnim);
  const cvp = $(cvId); if (!cvp || !team) return;
  const g = cvp.getContext('2d');
  const isOff = ['QB', 'RB', 'WR', 'TE'].includes(tuple[0]);
  const p = makePlayer(0, isOff, isOff ? 1 : 3, tuple);
  p.face.dir = 1; p.headScale = 1.15; p.xf = null;
  const fake = { teams: [team, team], ball: null, phase: 'over', human: 0, mode: G.mode, time: 0 };
  const loop = () => {
    fake.time = performance.now() / 1000; p.anim += 0.03; p.speedNow = 0;
    g.clearRect(0, 0, cvp.width, cvp.height);
    const bg = g.createRadialGradient(130, 160, 10, 130, 160, 160); bg.addColorStop(0, team.c1 + 'cc'); bg.addColorStop(1, '#0000');
    g.fillStyle = bg; g.fillRect(0, 0, cvp.width, cvp.height);
    g.save(); g.scale(2.6, 2.6); drawPlayer(g, p, fake, { x: 50, y: 112 }); g.restore();
    if ($('cap').classList.contains('show')) capAnim = requestAnimationFrame(loop);
  };
  loop();
}
const teamById = id => TEAMS.find(t => t.id === id) || COLLEGES.find(t => t.id === id);
const tFull = id => { const t = teamById(id); return t ? `${t.city} ${t.name}` : id; };
const money = m => `$${m >= 10 ? Math.round(m) : m.toFixed(1)} million`;

const CareerUI = {
  open() {
    Career.load(); clearInterval(draftTimer);
    const c = Career.cap;
    if (!c) return this.form();
    if (c.phase === 'college') return this.college();
    if (c.phase === 'combine') return this.combine();
    if (c.phase === 'draft') return c.draft && !c.draft.done ? this.draftDay(true) : this.preDraft();
    if (c.phase === 'nfl') { Season.use('career'); if (!Season.data) this.startNFLSeason(); return this.nfl(); }
    if (c.phase === 'retired') return this.retired();
  },
  set(html, title) { $('cap').querySelector('h2').textContent = title || 'Career'; $('capBody').innerHTML = html; show('cap'); },

  // ---------------- create ----------------
  form() {
    const f = capForm = capForm || { name: '', pos: 'WR', arch: CAP_ARCH.WR[0][0], num: 7, skin: 2, stars: 3, college: 'MICH', games: 10, diff: 1, qtr: 180 };
    const offers = collegeOffers(f.stars, f.pos + f.arch);
    if (!offers.some(t => t.id === f.college)) f.college = offers[0].id;
    const arch0 = CAP_ARCH[f.pos].find(x => x[0] === f.arch)[1], startOvr = Math.round((arch0.a[0] + arch0.a[1]) / 2) + RECRUIT[f.stars].ovr;
    const star = on => `<svg viewBox="0 0 24 24" class="rStar${on ? ' on' : ''}"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>`;
    const stars = [1, 2, 3, 4, 5].map(n => `<button class="rBtn" data-n="${n}" title="${n}-star">${star(n <= f.stars)}</button>`).join('') + `<b class="rLab">${f.stars}-STAR</b>`;
    const skins = SKIN.map((c, i) => `<button class="sw${i === f.skin ? ' on' : ''}" data-i="${i}" style="background:${c}" title="Skin ${i + 1}"></button>`).join('');
    const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, t]) => `<option value="${k}"${String(k) === String(v) ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
    this.set(`<div class="capWrap">
      <div class="capPrev"><canvas id="capCv" width="260" height="310"></canvas></div>
      <div class="capFields">
        <label>Name <input id="capName" maxlength="18" placeholder="First Last" value="${f.name.replace(/"/g, '')}"></label>
        <label>Position ${sel('capPos', CAP_POS.map(p => [p, p]), f.pos)}</label>
        <label>Style ${sel('capArch', CAP_ARCH[f.pos].map(a => [a[0], a[0]]), f.arch)}</label>
        <label>Number <input id="capNum" type="number" min="0" max="99" value="${f.num}"></label>
        <div class="capSkin">Skin <span>${skins}</span></div>
        <div class="capRec"><span>Recruit</span><div class="rRow">${stars}</div></div>
        <div class="capRecNote">Starts at <b>${startOvr} OVR</b>  ·  ${offers.length} scholarship offer${offers.length > 1 ? 's' : ''}</div>
        <label>College offers ${sel('capCol', offers.map(t => [t.id, `${t.city} (${['Small', 'Rising', 'Big', 'Elite'][t.pr]})`]), f.college)}</label>
        <label>NFL season ${sel('capGames', [[6, '6 games'], [10, '10 games'], [14, '14 games']], f.games)}</label>
        <label>Quarters ${sel('capQtr', [[120, '2 min'], [180, '3 min'], [300, '5 min']], f.qtr)}</label>
        <label>Difficulty ${sel('capDiff', [[0, 'Rookie'], [1, 'Pro'], [2, 'All-Pro'], [3, 'All-Madden']], f.diff)}</label>
        <div class="capNote">Your story: a senior season in college, the NFL Combine, then Draft Day. Play well and you go higher.</div>
        <div class="row"><button class="big" id="capCreate">START CAREER</button><button id="capBack">BACK</button></div>
      </div></div>`, 'Create Your Player');
    const read = () => {
      f.name = $('capName').value.trim(); f.pos = $('capPos').value; f.num = clamp(parseInt($('capNum').value, 10) || 0, 0, 99);
      f.college = $('capCol').value; f.games = +$('capGames').value; f.qtr = +$('capQtr').value; f.diff = +$('capDiff').value;
      f.arch = CAP_ARCH[f.pos].some(a => a[0] === $('capArch').value) ? $('capArch').value : CAP_ARCH[f.pos][0][0];
    };
    const preview = () => { const a = CAP_ARCH[f.pos].find(x => x[0] === f.arch)[1]; capPreview([f.pos, f.name || 'My Player', f.num, startOvr, a.spd + RECRUIT[f.stars].spd, f.skin], COLLEGES.find(t => t.id === f.college)); };
    document.querySelectorAll('.rBtn').forEach(b => b.onclick = () => { read(); f.stars = +b.dataset.n; Sound.click(); this.form(); });
    $('capPos').onchange = () => { read(); f.arch = CAP_ARCH[f.pos][0][0]; this.form(); };
    $('capArch').onchange = () => { read(); this.form(); };
    for (const id of ['capNum', 'capCol', 'capGames', 'capQtr', 'capDiff']) $(id).onchange = () => { read(); preview(); };
    $('capName').oninput = () => { f.name = $('capName').value; };
    document.querySelectorAll('.capSkin .sw').forEach(b => b.onclick = () => { read(); f.skin = +b.dataset.i; this.form(); });
    $('capBack').onclick = () => { cancelAnimationFrame(capAnim); show('title'); };
    $('capCreate').onclick = () => {
      read();
      if (f.name.length < 2) { $('capName').focus(); $('capName').classList.add('bad'); return; }
      Career.create(f); capForm = null; Sound.td(); this.open();
    };
    $('capName').addEventListener('keydown', e => e.stopPropagation());
    preview();
  },

  // ---------------- shared pieces ----------------
  card(team) {
    const c = Career.cap, o = Career.ovr(), need = Career.need(c.lvl);
    const sk = CAP_SKILLS[c.pos];
    return `<div class="ccCard" style="--tc:${team.c1}">
      <canvas id="capCv" width="260" height="310"></canvas>
      <div class="ccName">${c.name}</div>
      <div class="ccSub">#${c.num} ${c.pos} · ${c.arch} · Age ${c.age}</div>
      <div class="ccOvr"><b>${o}</b> OVR${o >= 85 ? '<span class="xfTag">X-FACTOR</span>' : ''}</div>
      <div class="xpbar"><i style="width:${Math.round(100 * c.xp / need)}%"></i></div>
      <div class="xptext">Level ${c.lvl} · ${c.xp}/${need} XP</div>
      <div class="ccRat"><span>${sk[0]} <b>${c.a[0]}</b></span><span>${sk[1]} <b>${c.a[1]}</b></span><span>Speed <b>${Math.round(c.spd)}</b></span></div>
      <div class="row ccBtns"><button class="${c.sp ? 'gold pulse' : ''}" id="ccUp">UPGRADE${c.sp ? ` (${c.sp})` : ''}</button><button id="ccGear">GEAR</button></div>
    </div>`;
  },
  wireCard(team) {
    $('ccUp').onclick = () => { Sound.click(); this.upgrade(); };
    $('ccGear').onclick = () => { Sound.click(); this.gear(); };
    capPreview(Career.tuple(), team);
  },
  goalsHtml() { return `<div class="ccGoals"><div class="lbl">GAME GOALS (+60 XP EACH)</div>${Career.goals().map(g => `<span>${g.text}</span>`).join('')}</div>`; },
  lockBtn() { const c = Career.cap; return `<button id="ccLock" class="${c.lock ? 'on' : ''}">PLAYER LOCK: ${c.lock ? 'ON' : 'OFF'}</button>`; },
  wireLock(re) { $('ccLock').onclick = () => { Career.cap.lock = !Career.cap.lock; Career.save(); Sound.click(); re(); }; },
  logHtml() {
    const c = Career.cap;
    return c.log.length ? `<div class="ccLog">${c.log.slice(0, 4).map(l => `<div><span class="gr g${(l.grade || '').replace('+', 'p')}">${l.grade || ''}</span> vs ${l.vs} ${l.score} · ${l.line} <b>+${l.xp}</b></div>`).join('')}</div>` : '';
  },
  newBadges() {
    const f = Career.fresh || []; Career.fresh = [];
    return f.length ? `<div class="ccNew">NEW BADGE${f.length > 1 ? 'S' : ''}: ${f.map(k => BADGES[k]).join(', ')}</div>` : '';
  },
  play(home, away, opts) {
    Sound.init(); Sound.whistle(); Sound.crowd(false);
    if (G.mode === 'mobile') goFullscreen();
    cancelAnimationFrame(capAnim);
    G.demo = false; G.challenge = null; G.mini = null; show(null);
    newGame(home, away, { qtr: Career.cap.qtr, diff: Career.cap.diff, lock: Career.cap.lock, ...opts });
    const mineIsHome = opts.humanSide === 0, opp = mineIsHome ? away : home;
    if (Career.isRival(opp.id)) {
      G.rivalry = opp.id; G.crowdHype = 1;
      showBanner('RIVALRY GAME', `vs ${opp.city} ${opp.name} · 1.5x XP · series ${Career.series(opp.id)}`, '#ff6040', 3);
    }
  },

  // ---------------- college ----------------
  college() {
    const c = Career.cap, cl = c.college, me = Career.collegeTeam(cl.id), g = Career.collegeGame();
    const opp = g && Career.collegeTeam(g.opp), s = Career.cur(false);
    const ovr = t => Math.round(t.off.concat(t.def).reduce((a, p) => a + p[3], 0) / 16);
    const sched = cl.sched.map((x, i) => { const t = COLLEGES.find(k => k.id === x.opp); const r = x.score ? (x.score[0] > x.score[1] ? `<b class="w">W ${x.score[0]}-${x.score[1]}</b>` : `<b class="l">L ${x.score[0]}-${x.score[1]}</b>`) : ''; return `<div class="${i === cl.week ? 'cur' : ''}">${x.bowl ? 'BOWL' : 'Wk ' + (i + 1)} ${x.home ? 'vs' : '@'} ${t.city} ${r}</div>`; }).join('');
    this.set(`<div class="ccWrap">${this.card(me)}
      <div class="ccMain">
        <div class="ccHead">SENIOR SEASON · ${me.city.toUpperCase()} ${me.name.toUpperCase()} · ${cl.w}-${cl.l}</div>
        ${this.newBadges()}
        ${g ? `<div class="ccNext" style="background:linear-gradient(110deg, ${me.c1} 45%, ${opp.c1} 55%)"><div class="lbl">${g.bowl ? 'BOWL GAME' : Career.isRival(g.opp) ? 'RIVALRY WEEK · 1.5x XP' : 'NEXT GAME'}</div><div class="mu">${g.home ? 'vs' : '@'} ${opp.city} ${opp.name}</div><div class="sub">${opp.id} ${ovr(opp)} OVR · you are ${g.home ? 'HOME' : 'AWAY'}</div></div>
        ${this.goalsHtml()}
        <div class="row"><button class="big" id="ccPlay">PLAY</button><button id="ccSim">SIM</button>${this.lockBtn()}</div>` : ''}
        <div class="ccStock">DRAFT STOCK: <b>${Career.projText()}</b></div>
        <div class="ccLine">This season: ${s.g} games · ${Career.line(s)}</div>
        <div class="ccSched">${sched}</div>
        ${this.logHtml()}
        <div class="row"><button id="capBack">MENU</button><button id="ccRetire">RETIRE</button></div>
      </div></div>`, 'College');
    this.wireCard(me);
    $('capBack').onclick = () => { cancelAnimationFrame(capAnim); show('title'); };
    $('ccRetire').onclick = () => this.quit();
    if (!g) return;
    this.wireLock(() => this.college());
    $('ccPlay').onclick = () => {
      const mine = Career.collegeTeam(cl.id), o = Career.collegeTeam(g.opp);
      this.play(g.home ? mine : o, g.home ? o : mine, { humanSide: g.home ? 0 : 1, career: 'college', weather: 'clear', night: !!g.bowl || chance(0.3) });
    };
    $('ccSim').onclick = () => { Sound.click(); Career.simCollege(); this.open(); };
  },

  // ---------------- combine ----------------
  combine() {
    const c = Career.cap, cl = c.college, me = Career.collegeTeam(cl.id);
    this.set(`<div class="ccWrap">${this.card(me)}
      <div class="ccMain">
        <div class="ccHead">NFL COMBINE · INDIANAPOLIS</div>
        ${this.newBadges()}
        <div class="ccText">College is done: <b>${cl.w}-${cl.l}</b>${cl.bowl ? ', played in a bowl game' : ''}. ${Career.line(c.seasons.find(s => s.lvl === 'NCAA') || {})}.<br><br>
          Every scout in the NFL is watching your <b>40-yard dash</b>. Mash to run. A fast time moves you up draft boards.</div>
        <div class="ccStock">DRAFT STOCK RIGHT NOW: <b>${Career.projText()}</b></div>
        <div class="row"><button class="big gold" id="ccRun">RUN THE 40</button><button id="ccSkip">SKIP (USE MY SPEED)</button></div>
        <div class="row"><button id="capBack">MENU</button></div>
      </div></div>`, 'The Combine');
    this.wireCard(me);
    $('capBack').onclick = () => { cancelAnimationFrame(capAnim); show('title'); };
    $('ccSkip').onclick = () => { Career.setCombine(Career.fortyFromSpd()); Sound.click(); this.open(); };
    $('ccRun').onclick = () => {
      Sound.init(); cancelAnimationFrame(capAnim); if (G.mode === 'mobile') goFullscreen();
      G.demo = false; G.season = false; G.challenge = null; show(null);
      startDash(0);
      const m = G.mini, old = m.me, me2 = makePlayer(0, true, 2, Career.tuple());
      Object.assign(me2, { x: old.x, y: old.y, isHuman: true, spd: (2.6 + (me2.spdR - 50) * 0.16) * 1.15 });
      G.players[0] = me2; G.O[0] = me2; G.humanPlayer = me2; m.me = me2; m.combine = true;
      G.teams[0] = Career.collegeTeam(cl.id);
      showBanner('NFL COMBINE: 40-YARD DASH', `${c.name} vs ${m.rival.name}`, '#ffd23f', 2);
    };
  },
  preDraft() {
    const c = Career.cap, cl = c.college, me = Career.collegeTeam(cl.id), cb = c.combine;
    this.set(`<div class="ccWrap">${this.card(me)}
      <div class="ccMain">
        <div class="ccHead">COMBINE RESULTS</div>
        <div class="ccCombine"><div><b>${cb.forty.toFixed(2)}s</b><span>40-YARD DASH</span></div><div><b>${cb.bench}</b><span>BENCH REPS</span></div><div><b>${cb.vert}"</b><span>VERTICAL</span></div></div>
        <div class="ccStock">PROJECTED: <b>${Career.projText()}</b></div>
        <div class="ccText">Spend your skill points before the draft. A higher overall still moves you up.</div>
        <div class="row"><button class="big gold" id="ccDraft">GO TO DRAFT DAY</button><button id="capBack">MENU</button></div>
      </div></div>`, 'Draft Day');
    this.wireCard(me);
    $('capBack').onclick = () => { cancelAnimationFrame(capAnim); show('title'); };
    $('ccDraft').onclick = () => { Career.runDraft(); Sound.whistle(); this.draftDay(); };
  },
  // picks scroll by until it's yours, then the big reveal
  draftDay(resume) {
    const c = Career.cap, d = c.draft;
    cancelAnimationFrame(capAnim); clearInterval(draftTimer);
    this.set(`<div class="ddWrap"><div class="ddTop"><span id="ddClock">ON THE CLOCK</span><button id="ddSkip">SKIP TO MY PICK</button></div>
      <div class="ddList" id="ddList"></div><div id="ddReveal"></div></div>`, 'NFL Draft');
    const list = $('ddList'); let i = resume ? d.picks.length - 1 : 0;
    const row = p => { const t = TEAMS.find(x => x.id === p.team); return `<div class="ddRow"><span class="n">${p.n}</span><span class="tm" style="background:${t.c1};color:${textOn(t.c1)}">${t.id}</span><b>${p.pos} ${p.name}</b><i>${p.school}</i></div>`; };
    const reveal = () => {
      clearInterval(draftTimer);
      const t = TEAMS.find(x => x.id === d.team);
      $('ddClock').textContent = 'THE PICK IS IN...'; $('ddSkip').style.display = 'none'; Sound.whistle();
      setTimeout(() => {
        $('ddReveal').innerHTML = `<div class="ddCard" style="background:linear-gradient(140deg, ${t.c1} 55%, ${t.c2})">
          <div class="r">ROUND ${d.round} · PICK ${d.pick}${d.round > 1 ? ` (#${d.inRound} in the round)` : ''}</div>
          <div class="t" style="color:${textOn(t.c1)}">THE ${t.city.toUpperCase()} ${t.name.toUpperCase()} SELECT</div>
          <div class="p">${c.name}</div><div class="s">${c.pos} · ${tFull(c.college.id)} · ${Career.ovr()} OVR</div>
          <div class="k">Rookie contract: 4 years, ${money(c.contract.total)}</div>
          <button class="big gold" id="ddGo">START ROOKIE SEASON</button></div>`;
        Sound.td(); for (let k = 0; k < 3; k++) setTimeout(() => Sound.td(), 250 * k);
        $('ddGo').onclick = () => { Career.joinNFL(); Season.use('career'); this.startNFLSeason(); this.open(); };
      }, 1600);
    };
    const step = () => {
      const p = d.picks[i]; if (!p) return;
      if (p.me) return reveal();
      list.insertAdjacentHTML('afterbegin', row(p)); i++;
      const nx = d.picks[i]; if (nx) $('ddClock').textContent = `ON THE CLOCK: ${tFull(nx.team).toUpperCase()}  ·  PICK ${nx.n}`;
      if (i % 4 === 0) Sound.click();
    };
    draftTimer = setInterval(step, d.pick > 40 ? 120 : 260);
    $('ddSkip').onclick = () => { clearInterval(draftTimer); while (d.picks[i] && !d.picks[i].me) { list.insertAdjacentHTML('afterbegin', row(d.picks[i])); i++; } reveal(); };
    if (resume) reveal();
  },

  // ---------------- NFL ----------------
  startNFLSeason() {
    const c = Career.cap;
    Season.data = null; Season.start(c.team, c.games, c.qtr, c.diff);
  },
  nfl() {
    const c = Career.cap, d = Season.data, me = Season.team(c.team), g = Season.myGame();
    const over = !g;
    if (over && !d.capEnded) { Career.endNFLSeason(d); d.capEnded = true; Season.save(); }
    const yr = c.seasons.filter(x => x.lvl === 'NFL').length;
    const rec = d.rec[c.team], recS = `${rec.w}-${rec.l}${rec.t ? '-' + rec.t : ''}`;
    let next = '';
    if (g) {
      const home = g.home === c.team, opp = Season.team(home ? g.away : g.home);
      next = `<div class="ccNext" style="background:linear-gradient(110deg, ${me.c1} 45%, ${opp.c1} 55%)"><div class="lbl">${d.phase === 'playoffs' ? Season.roundName(d.bracket.round).toUpperCase() : `WEEK ${d.week + 1} OF ${d.games}`}${Career.isRival(opp.id) ? ` · <b class="rivTag">RIVALRY · 1.5x XP · ${Career.series(opp.id)}</b>` : ''}</div><div class="mu">${home ? 'vs' : '@'} ${opp.city} ${opp.name}</div><div class="sub">${opp.id} is ${recStr(opp.id)} · ${teamOvr(opp)} OVR</div></div>
        ${this.goalsHtml()}
        <div class="row"><button class="big" id="ccPlay">PLAY</button><button id="ccSim">SIM</button>${this.lockBtn()}</div>`;
    } else {
      const aw = (d.awards || []).map(a => `<div class="awLine"><b>${a.award}</b> ${a.name} <span>${a.pos}, ${a.team}</span></div>`).join('');
      const msg = d.champ === c.team ? 'You won the Bobble Bowl!' : d.phase === 'missed' ? 'Your team missed the playoffs.' : 'Your season ended in the playoffs.';
      next = `<div class="ccNext done"><div class="mu">${msg}</div><div class="sub">Your season: ${Career.line(c.seasons[c.seasons.length - 1])}</div>${aw ? `<div class="awards">${aw}</div>` : ''}</div>
        <div class="row"><button class="big gold" id="ccNextYr">${Career.mustRetire() ? 'TIME TO RETIRE' : 'TO THE OFFSEASON'}</button></div>`;
    }
    const tabs = [['season', 'SEASON'], ['career', 'CAREER'], ['badges', 'BADGES'], ['league', 'LEAGUE']];
    this.set(`<div class="ccWrap">${this.card(me)}
      <div class="ccMain">
        <div class="ccHead">YEAR ${Math.max(1, yr + (over ? 0 : 1))} · ${me.city.toUpperCase()} ${me.name.toUpperCase()} · ${recS} · ${c.contract ? `${c.contract.years} YR${c.contract.years === 1 ? '' : 'S'} LEFT ON CONTRACT` : ''}</div>
        ${this.newBadges()}${next}
        <div class="ccTabs">${tabs.map(([k, t]) => `<button data-t="${k}" class="${capTab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="ccTab" id="ccTab"></div>
        <div class="row"><button id="capBack">MENU</button><button id="ccRetire">RETIRE</button></div>
      </div></div>`, 'Career');
    this.wireCard(me);
    this.tab();
    document.querySelectorAll('.ccTabs button').forEach(b => b.onclick = () => { capTab = b.dataset.t; Sound.click(); this.nfl(); });
    $('capBack').onclick = () => { cancelAnimationFrame(capAnim); show('title'); };
    $('ccRetire').onclick = () => { if (confirm(`Retire ${c.name} now? His career ends and he goes up for the Hall of Fame.`)) this.retire(); };
    if (g) {
      this.wireLock(() => this.nfl());
      $('ccPlay').onclick = () => {
        const home = g.home === c.team, wx = d.phase === 'regular' && d.weather ? d.weather[d.week] : { w: pickWeather('random', d.games, d.games), night: chance(0.5) };
        G.season = true;
        this.play(Season.team(g.home), Season.team(g.away), { humanSide: home ? 0 : 1, playoff: d.phase === 'playoffs', weather: wx.w, night: wx.night, career: 'nfl' });
        G.season = true;
      };
      $('ccSim').onclick = () => { Sound.click(); this.simNFL(g); this.nfl(); };
    } else $('ccNextYr').onclick = () => { Sound.click(); Career.mustRetire() ? this.retire() : this.offseason(); };
  },
  tab() {
    const c = Career.cap, d = Season.data, box = $('ccTab');
    if (capTab === 'season') {
      box.innerHTML = `<div class="ccLine">This season: ${Career.cur(false).g} games · ${Career.line(Career.cur(false))}</div>` + this.logHtml() +
        `<div class="ccSched">${d.weeks.map((wk, i) => { const x = wk[0], home = x.home === c.team, o = home ? x.away : x.home; const r = x.score ? ((home ? x.score[0] > x.score[1] : x.score[1] > x.score[0]) ? `<b class="w">W ${x.score[0]}-${x.score[1]}</b>` : `<b class="l">L ${x.score[0]}-${x.score[1]}</b>`) : ''; return `<div class="${i === d.week && d.phase === 'regular' ? 'cur' : ''}">Wk ${i + 1} ${home ? 'vs' : '@'} ${o} ${r}</div>`; }).join('')}</div>`;
    } else if (capTab === 'career') {
      const k = SEASON_RT.includes(c.pos) ? [['pass', 'PASS'], ['rush', 'RUSH'], ['rec', 'REC'], ['td', 'TD']] : [['tkl', 'TKL'], ['sack', 'SACK'], ['int', 'INT']];
      box.innerHTML = `<div class="ccDraftNote">${c.draft && c.draft.round ? `Drafted: Round ${c.draft.round}, Pick ${c.draft.pick} by ${tFull(c.draft.team)}` : ''}${c.combine ? ` · 40: ${c.combine.forty.toFixed(2)}s` : ''}</div>
        <table class="ccTable"><tr><th>YEAR</th><th>TEAM</th><th>G</th>${k.map(x => `<th>${x[1]}</th>`).join('')}<th>OVR</th><th></th></tr>
        ${c.seasons.map((s, i) => `<tr><td>${s.lvl === 'NCAA' ? 'College' : 'Yr ' + c.seasons.slice(0, i + 1).filter(z => z.lvl === 'NFL').length}</td><td>${s.team}</td><td>${s.g}</td>${k.map(x => `<td>${s[x[0]]}</td>`).join('')}<td>${s.ovr || (s.open ? Career.ovr() : '')}</td><td>${s.champ ? 'CHAMP ' : ''}${(s.awards || []).map(a => a === 'Offensive Player of the Year' ? 'OPOY' : a === 'Defensive Player of the Year' ? 'DPOY' : a).join(' ')}</td></tr>`).join('')}
        <tr class="tot"><td>TOTAL</td><td></td><td>${c.stats.g}</td>${k.map(x => `<td>${c.stats[x[0]]}</td>`).join('')}<td></td><td></td></tr></table>`;
    } else if (capTab === 'badges') {
      box.innerHTML = `<div class="ccBadges">${Object.keys(BADGES).map(k => { const b = c.badges.find(x => x.k === k); return `<div class="bd${b ? ' on' : ''}"><b>${BADGES[k]}</b><span>${b ? b.lvl : 'locked'}</span></div>`; }).join('')}</div>`;
    } else {
      const st = Season.standings(teamById(c.team).conf).slice(0, 6);
      const L = (k, t) => { const l = Season.leaders(k, 3); return l.length ? `<div class="ccLead"><b>${t}</b>${l.map(x => `<span class="${x.name === c.name ? 'me' : ''}">${x.name} (${x.t}) ${x[k]}</span>`).join('')}</div>` : ''; };
      box.innerHTML = `<div class="ccLeague"><div><div class="lbl">${teamById(c.team).conf} STANDINGS</div>${st.map((id, i) => `<div class="${id === c.team ? 'me' : ''}">${i + 1}. ${tFull(id)} <b>${recStr(id)}</b></div>`).join('')}</div>
        <div>${SEASON_RT.includes(c.pos) ? L('pass', 'PASSING') + L('rush', 'RUSHING') + L('rec', 'RECEIVING') : L('tkl', 'TACKLES') + L('sack', 'SACKS') + L('int', 'INTERCEPTIONS')}</div></div>`;
    }
  },
  // sim one of your games: your line comes from the league sim
  simNFL(g) {
    const c = Career.cap, d = Season.data, k = c.team + ':' + c.name;
    const before = { ...(d.stats && d.stats[k] || {}) };
    const sc = d.phase === 'playoffs' ? Season.playoffSim(g.home, g.away) : Season.simScore(g.home, g.away);
    const after = d.stats[k] || {}, st = {};
    for (const s of ['pass', 'rush', 'rec', 'td', 'tkl', 'sack', 'int']) st[s] = (after[s] || 0) - (before[s] || 0);
    const home = g.home === c.team, won = home ? sc[0] > sc[1] : sc[1] > sc[0];
    Career.addStats(st); Career.gameBadges(st);
    const xp = Career.simXP(st, won); Career.gainXP(xp); Career.checkBadges();
    c.log.unshift({ vs: home ? g.away : g.home, score: home ? `${sc[0]}-${sc[1]}` : `${sc[1]}-${sc[0]}`, xp, grade: 'SIM', line: Career.line(st) }); c.log.length = Math.min(c.log.length, 12);
    Career.save();
    seasonGameDone(sc);
  },
  offseason() {
    const c = Career.cap, before = { a: c.a.slice(), spd: Math.round(c.spd), ovr: Career.ovr() };
    Career.offseason();
    const me = teamById(c.team), dv = Career.ovr() - before.ovr;
    const expired = !c.contract || c.contract.years <= 0;
    const offers = expired ? Career.offers() : [];
    this.set(`<div class="ccWrap">${this.card(me)}
      <div class="ccMain">
        <div class="ccHead">OFFSEASON · AGE ${c.age}</div>
        <div class="ccText">Training camp: overall ${before.ovr} → <b class="${dv > 0 ? 'w' : dv < 0 ? 'l' : ''}">${Career.ovr()}</b>${dv ? ` (${dv > 0 ? '+' : ''}${dv})` : ''}. ${c.age >= 31 ? 'Father Time is coming. Your ratings start to slip in your 30s.' : c.age <= 26 ? 'Young legs: you got better with work.' : ''}</div>
        ${expired ? `<div class="ccHead">FREE AGENCY · YOUR CONTRACT IS UP</div><div class="ccOffers">${offers.map((o, i) => { const t = TEAMS.find(x => x.id === o.team); return `<button class="ofr" data-i="${i}" style="border-color:${t.c1}"><b>${t.city} ${t.name}</b><span>${o.years} years, ${money(o.total)}${o.team === c.team ? ' · stay home' : ''}</span></button>`; }).join('')}</div>`
          : `<div class="ccText">${c.contract.years} year${c.contract.years === 1 ? '' : 's'} left on your deal with the ${me.name}.</div><div class="row"><button class="big gold" id="ccGo">START NEXT SEASON</button></div>`}
      </div></div>`, 'Offseason');
    this.wireCard(me);
    const go = () => { Season.data.capEnded = false; Season.nextYear(); Season.data.capEnded = false; Season.save(); capTab = 'season'; this.open(); };
    if (expired) document.querySelectorAll('.ofr').forEach(b => b.onclick = () => {
      const o = offers[+b.dataset.i]; Sound.td();
      c.contract = { years: o.years, total: o.total };
      if (o.team !== c.team) { Season.news && Season.news(`SIGNING: ${c.name} signs with ${o.team}`); c.team = o.team; Season.data.team = o.team; }
      Career.save(); go();
    });
    else $('ccGo').onclick = () => { Sound.whistle(); go(); };
  },
  retire() {
    const L = Career.retireCareer(); Sound.td();
    this.plaque(L);
  },
  plaque(L) {
    const tms = L.teams.map(tFull).join(', ');
    const k = SEASON_RT.includes(L.pos) ? `${L.stats.pass ? L.stats.pass + ' pass yds · ' : ''}${L.stats.rush ? L.stats.rush + ' rush yds · ' : ''}${L.stats.rec ? L.stats.rec + ' rec yds · ' : ''}${L.stats.td} TD` : `${L.stats.tkl} tackles · ${L.stats.sack} sacks · ${L.stats.int} INT`;
    this.set(`<div class="hofWrap"><div class="hof${L.hof ? ' gold' : ''}">
      <div class="h1">${L.hof ? 'PRO FOOTBALL HALL OF FAME' : 'CAREER COMPLETE'}</div>
      <div class="nm">${L.name}</div><div class="ps">${L.pos} · #${L.num} · ${L.college ? tFull(L.college) : ''}</div>
      <div class="ln">${L.years} NFL season${L.years === 1 ? '' : 's'} · ${tms || ''}</div>
      <div class="ln">${k}</div>
      <div class="ln">Peak ${L.peak} OVR · ${L.awards} award${L.awards === 1 ? '' : 's'} · ${L.titles} title${L.titles === 1 ? '' : 's'}${L.draft ? ' · ' + L.draft : ''}</div>
      ${L.hof ? '<div class="ln big">INDUCTED ' + new Date().getFullYear() + '</div>' : '<div class="ln">Not quite Hall of Fame. Next time: more big seasons, awards and rings.</div>'}
      </div><div class="row"><button class="big gold" id="ccNew">NEW CAREER</button><button id="capBack">MENU</button></div></div>`, L.hof ? 'Hall of Fame' : 'Retired');
    $('ccNew').onclick = () => { Career.retireNow(); Season.use('career'); Season.clear(); this.open(); };
    $('capBack').onclick = () => show('title');
  },
  retired() { this.plaque(Career.tro.legends[0] || { name: Career.cap.name, pos: Career.cap.pos, num: Career.cap.num, teams: [], years: 0, stats: Career.cap.stats, peak: Career.ovr(), awards: 0, titles: 0 }); },
  quit() {
    if (!confirm(`End ${Career.cap.name}'s career? He's deleted for good.`)) return;
    Career.retireNow(); Season.use('career'); Season.clear(); this.open();
  },

  // ---------------- upgrades + gear ----------------
  upgrade() {
    const c = Career.cap, sk = CAP_SKILLS[c.pos], team = teamById(c.team);
    const bar = (k, label, v, cost) => `<div class="upRow"><span>${label}</span><div class="upBar"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b><button data-k="${k}" ${c.sp < cost || v >= 99 ? 'disabled' : ''}>+1 <small>(${cost} pt${cost > 1 ? 's' : ''})</small></button></div>`;
    this.set(`<div class="ccWrap">${this.card(team)}
      <div class="ccMain">
        <div class="ccHead">SKILL POINTS: <b class="gold">${c.sp}</b></div>
        <div class="ccText">You get 3 points every level. Overall is the average of your two skills. Speed costs 2 points but makes you faster on every play.</div>
        ${bar(0, sk[0], c.a[0], 1)}${bar(1, sk[1], c.a[1], 1)}${bar('spd', 'Speed', c.spd, 2)}
        <div class="row"><button class="big" id="upDone">DONE</button></div>
      </div></div>`, 'Upgrade');
    this.wireCard(team);
    document.querySelectorAll('.upRow button').forEach(b => b.onclick = () => { const k = b.dataset.k; if (Career.upgrade(k === 'spd' ? 'spd' : +k)) Sound.click(); this.upgrade(); });
    $('upDone').onclick = () => this.open();
  },
  gear() {
    const c = Career.cap, team = teamById(c.team), o = Career.ovr();
    const opt = (k, v, label, need) => { const ok = !need || o >= need; const on = c.gear[k] === v; return `<button class="gOpt${on ? ' on' : ''}" data-k="${k}" data-v="${v}" ${ok ? '' : 'disabled'}>${label}${ok ? '' : ` <small>(${need} OVR)</small>`}</button>`; };
    this.set(`<div class="ccWrap">${this.card(team)}
      <div class="ccMain">
        <div class="ccHead">GEAR</div>
        <div class="ccText">Level up to unlock more gear.</div>
        <div class="gRow"><span>VISOR</span>${opt('visor', false, 'None')}${opt('visor', true, 'Dark Visor', CAP_GEAR.visor)}</div>
        <div class="gRow"><span>GLOVES</span>${opt('gloves', 'white', 'White')}${opt('gloves', 'black', 'Black')}${opt('gloves', 'team', 'Team Color', CAP_GEAR.gloves)}${opt('gloves', 'gold', 'Gold', CAP_GEAR.goldGloves)}</div>
        <div class="row"><button class="big" id="gDone">DONE</button></div>
      </div></div>`, 'Gear');
    this.wireCard(team);
    document.querySelectorAll('.gOpt').forEach(b => b.onclick = () => { const k = b.dataset.k; c.gear[k] = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v; Career.save(); Sound.click(); this.gear(); });
    $('gDone').onclick = () => this.open();
  }
};

// ---- trophy case ----
const TROPHY_SVG = '<svg viewBox="0 0 64 64"><path d="M18 8h28v14c0 9-6 16-14 16s-14-7-14-16z"/><path d="M18 13H9c0 9 4 14 10 15M46 13h9c0 9-4 14-10 15" fill="none" stroke-width="4"/><path d="M28 38h8v9h-8z"/><path d="M19 50h26v6H19z"/></svg>';
function renderTrophies() {
  Career.load();
  const T = Career.tro, R = Records.get();
  const titles = T.titles.length
    ? T.titles.map(t => { const tm = TEAMS.find(x => x.id === t.team); return `<div class="troph"><div class="tsvg">${TROPHY_SVG}</div><b>${t.team}</b><span>${tm ? tm.name : ''}${t.year > 1 ? `, Year ${t.year}` : ''}</span></div>`; }).join('')
    : '<div class="troEmpty">No Bobble Bowls yet. Win a season and it goes right here.</div>';
  const rec = [
    ['Record', `${T.w}-${T.l}${T.t ? '-' + T.t : ''}`],
    ['Games played', T.games],
    ['Biggest win', T.bestWin ? T.bestWin.text : '-'],
    ['QB Targets', R.qb ? `${R.qb} pts` : '-'],
    ['Longest FG', R.kick ? `${R.kick} yds` : '-'],
    ['40-yard dash', R.dash && R.dash < 99 ? `${R.dash}s` : '-'],
    ['Two-Minute Drill', R.twoMin ? `${R.twoMin.wins} of ${R.twoMin.tries}` : '-'],
    ['Daily streak', R.daily && R.daily.streak ? `${R.daily.streak} days` : '-']
  ];
  const aw = T.awards.length ? T.awards.slice().reverse().map(a => `<div class="awRow"><b>${a.award}</b> ${a.name} <span>${a.team}${a.year ? `, Year ${a.year}` : ''}</span></div>`).join('') : '<div class="troEmpty">Season awards you win show up here.</div>';
  const leg = (T.legends || []).length ? T.legends.map(l => `<div class="rRow"><span>${l.hof ? 'HOF  ' : ''}${l.name}, ${l.pos} (${l.years} yrs)</span><b>${l.peak} OVR</b></div>`).join('') : '<div class="troEmpty">Finish a career and your player goes here. Great ones make the Hall of Fame.</div>';
  const c = Career.cap;
  $('troBody').innerHTML = `<div class="shelf">${titles}</div>
    <div class="troCols">
      <div class="troBox"><div class="troHead">RECORDS</div>${rec.map(([k, v]) => `<div class="rRow"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <div class="troBox"><div class="troHead">AWARDS</div>${aw}
        <div class="troHead" style="margin-top:10px">CAREERS</div>${c && c.phase !== 'retired' ? `<div class="rRow"><span>${c.name}, ${c.pos} (active)</span><b>${Career.ovr()} OVR</b></div>` : ''}${leg}</div>
    </div>`;
}
