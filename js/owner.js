// ---- The owner: season goals, a job security meter, the hot seat, getting fired (pick a new job) or extended. Plus the ring ceremony + title banners ----
// d.owner = { y, base, sec, exp, goals: [{ k, n, tx }], prevHot, next, ext, since, hotY, last: { y, final, verdict, met, of, posted, newJob } }
// d.jobs = [{ team, from, to, rec }] past jobs   d.ring = { y, team, rec, n, opp, sc } last title   d.ringShow = ring ceremony still to show
// Year 1 never gets you fired (a single season shows goals only). From year 2 on: a really bad season, or two bad ones in a row.
const OWN_LVL = [[75, 'SAFE', 'g', '#4fe08a'], [50, 'STABLE', '', '#f6c31c'], [30, 'WARM SEAT', 'c', '#ff9f43'], [0, 'HOT SEAT', 'r', '#ff6b6b']];
const seasonYr = y => 2025 + (y || 1); // year 1 = the 2026 season
const Owner = {
  on() { const d = Season.data; return !!d && !(Season.isCareer && Season.isCareer()); },
  rank(id) { const o = {}; for (const t of TEAMS) o[t.id] = Season.ovr(t.id); return TEAMS.map(t => t.id).sort((a, b) => o[b] - o[a]).indexOf(id) + 1; },
  ensure() {
    const d = Season.data;
    const o = d.owner || (d.owner = { base: 60, sec: 60, ext: 0, since: 1 });
    if (o.y !== d.year) this.newSeason(o);
    return o;
  },
  // the owner's goals for this year, from how good the roster is
  newSeason(o) {
    const d = Season.data, me = d.team, t = Season.team(me), rk = this.rank(me), N = d.games, W = f => Math.max(1, Math.round(N * f));
    const r = feedRng(hashStr(`own:${d.year}:${me}`)), pk = a => a[Math.floor(r() * a.length)];
    const hasRook = Contracts.all(me).some(p => p[6] && p[6].rookie === d.year);
    const T = { po: 'Make the playoffs', div: `Win the ${t.conf} ${String(t.div).toUpperCase()}`, po1: 'Win a playoff game', off10: 'Top-10 offense (points scored)', def10: 'Top-10 defense (points allowed)',
      rook: 'Develop a rookie (+2 OVR this season)', notLast: `Don't finish last in the ${t.conf} ${String(t.div).toUpperCase()}` };
    const g = k => ({ k, tx: T[k] }), wins = n => ({ k: 'wins', n, tx: `Win ${n} games` }), dev = () => g(hasRook ? 'rook' : pk(['off10', 'def10']));
    let goals;
    if (rk <= 6) goals = [g(pk(['div', 'po1'])), wins(W(0.65)), g(pk(['off10', 'def10']))];
    else if (rk <= 14) goals = [g('po'), wins(W(0.55))].concat(r() < 0.5 ? [dev()] : []);
    else if (rk <= 22) goals = [r() < 0.5 ? g('po') : wins(W(0.47)), dev()];
    else goals = [wins(W(0.33))].concat(r() < 0.5 ? [g(hasRook ? 'rook' : 'notLast')] : []);
    Object.assign(o, { y: d.year, rk, exp: 0.75 - (rk - 1) / 31 * 0.5, goals, sec: o.base, hotY: 0 });
    delete o.last;
  },
  // where a goal stands: done / fail / on (on track) / off (behind), plus a little progress text
  check(g) {
    const d = Season.data, me = d.team, t = Season.team(me), r = d.rec[me], gp = r.w + r.l + r.t, over = d.phase !== 'regular', left = over ? 0 : d.games - d.week;
    const st = (ok, bad, on, p) => ({ s: ok ? 'done' : bad ? 'fail' : on || !gp ? 'on' : 'off', p: p || '' }); // nobody is behind before week 1
    const mk = !over && typeof PO !== 'undefined' ? PO.status(t.conf)[me] : null, inPO = () => !!(d.bracket && d.bracket.seeds && d.bracket.seeds[t.conf].includes(me));
    const rankBy = (k, asc) => 1 + TEAMS.filter(x => asc ? d.rec[x.id][k] < r[k] : d.rec[x.id][k] > r[k]).length;
    switch (g.k) {
      case 'wins': return st(r.w >= g.n, r.w + left < g.n, gp ? (r.w + r.t / 2) / gp * d.games >= g.n - 0.5 : true, `${r.w}/${g.n}`);
      case 'po': return over ? st(inPO(), !inPO()) : st(['x', 'y', 'z'].includes(mk), mk === 'e', PO.seeds(t.conf).includes(me));
      case 'div': { const lead = Season.standings(t.conf).find(id => Season.team(id).div === t.div); return over ? st(lead === me, lead !== me) : st(['y', 'z'].includes(mk), mk === 'e', lead === me); }
      case 'po1': {
        const won = (d.log || []).some(x => x.games.some(gg => gg.score && (gg.home === me ? gg.score[0] > gg.score[1] : gg.away === me && gg.score[1] > gg.score[0])));
        if (won) return st(true);
        if (over) return st(false, d.phase !== 'playoffs', true);
        return st(false, mk === 'e', PO.seeds(t.conf).includes(me));
      }
      case 'off10': { const k = rankBy('pf'); return st(over && k <= 10, over && k > 10, k <= 10, `#${k}`); }
      case 'def10': { const k = rankBy('pa', true); return st(over && k <= 10, over && k > 10, k <= 10, `#${k}`); }
      case 'rook': { const b = Math.max(0, ...Contracts.all(me).filter(p => p[6] && p[6].rookie === d.year).map(p => Form.delta(p))); return st(b >= 2, over && b < 2, b >= 1 || d.week < d.games / 2, b ? `+${b}` : ''); }
      case 'notLast': { const dv = Season.standings(t.conf).filter(id => Season.team(id).div === t.div), last = dv[dv.length - 1] === me; return st(over && !last, over && last, !last); }
    }
    return st(false, false, true);
  },
  lvl(v) { return OWN_LVL.find(l => v >= l[0]); },
  // every week: record vs what the owner expected + how the goals look
  week() {
    const d = Season.data, o = this.ensure(), r = d.rec[d.team], gp = r.w + r.l + r.t; if (!gp || (o.last && o.last.y === d.year)) return; // the season's verdict is in
    const wp = (r.w + r.t / 2) / gp, adj = { done: 5, on: 2, off: -3, fail: -8 };
    const gs = o.goals.reduce((a, g) => a + adj[this.check(g).s], 0);
    o.sec = clamp(Math.round(o.base + (wp - o.exp) * 60 * Math.min(1, gp / 4) + gs), 0, 100);
    if (o.sec < 30 && gp >= 4 && o.hotY !== d.year && d.phase === 'regular') {
      o.hotY = d.year;
      Season.news(`HOT SEAT: the owner is not happy with the ${tName(d.team)} at ${recStr(d.team)}. Things need to turn around.`);
      Feed.say(Feed.ins, `Sources: the ${tName(d.team)} owner is NOT happy right now. ${recStr(d.team)} was not the plan. Hot seat 🔥🪑`, 0.7);
      Feed.say(Feed.fan(d.team), `Coach, we believe in you. But please win a game 🙏`, 0.3);
    }
  },
  // season over: the owner's verdict
  final() {
    const d = Season.data, o = this.ensure(), me = d.team, r = d.rec[me], gp = r.w + r.l + r.t || 1, wp = (r.w + r.t / 2) / gp;
    const res = o.goals.map(g => this.check(g).s), met = res.filter(s => s === 'done').length;
    const poWins = (d.log || []).reduce((a, x) => a + x.games.filter(g => g.score && (g.home === me ? g.score[0] > g.score[1] : g.away === me && g.score[1] > g.score[0])).length, 0);
    const final = clamp(Math.round(o.base + (wp - o.exp) * 70 + met * 10 - (res.length - met) * 12 + poWins * 4 + (d.champ === me ? 30 : 0)), 0, 100);
    const verdict = d.year >= 2 && (final < 15 || (final < 30 && o.prevHot)) ? 'fired' : final < 30 ? 'hot' : final >= 78 ? 'ext' : 'ok';
    o.sec = final; o.prevHot = final < 30; o.next = Math.round(final * 0.6 + 60 * 0.4);
    if (verdict === 'ext') o.ext = (o.ext || 0) + 1;
    o.last = { y: d.year, final, verdict, met, of: res.length, rec: recStr(me) };
  },
  // posts + news for the verdict (once, when the hub shows it)
  flush() {
    const d = Season.data, o = d.owner, L = o && o.last; if (!L || L.posted || L.y !== d.year) return;
    L.posted = 1; const T = tName(d.team);
    if (L.verdict === 'fired') { Season.news(`FIRED: the ${T} let their head coach go after a ${L.rec} season.`); Feed.say(Feed.ins, `BREAKING 🚨 The ${T} have fired their head coach after a ${L.rec} season. Big changes coming.`, 0.9); Feed.say(Feed.fan(d.team), `Wow. Didn't see that coming. Thanks for everything coach 👋`, 0.35); }
    else if (L.verdict === 'hot') { Season.news(`HOT SEAT: the ${T} owner says next season has to be better.`); Feed.say(Feed.ins, `The ${T} are keeping their coach for now, but the owner wants results next year 🔥🪑`, 0.6); }
    else if (L.verdict === 'ext') { Season.news(`CONTRACT EXTENSION: the ${T} owner extends your contract through year ${d.year + 3}.`); Feed.say(Feed.ins, `The ${T} give their head coach a contract extension after a ${L.rec} season. Well earned 🤝`, 0.7); }
    Season.save();
  },
  // jobs open after you get fired: a few worse teams
  openings() {
    const d = Season.data, ov = {}; for (const t of TEAMS) ov[t.id] = Season.ovr(t.id);
    const pool = TEAMS.filter(t => t.id !== d.team && !t.custom).map(t => t.id).sort((a, b) => ov[a] - ov[b]).slice(0, 10);
    const r = feedRng(hashStr(`jobs:${d.year}:${d.team}`)), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out.sort((a, b) => ov[b] - ov[a]);
  },
  takeJob(id) {
    const d = Season.data, o = this.ensure(), old = d.team;
    (d.jobs || (d.jobs = [])).push({ team: old, from: o.since || 1, to: d.year, rec: this.totalRec(old) });
    d.team = id; o.since = d.year + 1; o.base = o.next = o.sec = 55; o.prevHot = false; o.last.newJob = id;
    delete d.lastRecap; delete d.offer; d.trades = [];
    Season.news(`NEW JOB: you're the new head coach of the ${Season.team(id).city} ${tName(id)}.`);
    Feed.say(Feed.ins, `The ${tName(id)} have hired a new head coach, fresh off a stint with the ${tName(old)}. New era 👀`, 0.75);
    Feed.say(Feed.fan(id), `Welcome to town coach! Let's get to work 🙌`, 0.4);
    Season.save();
  },
  // your record with a team across the years you coached it
  totalRec(id) { let w = 0, l = 0, t = 0; for (const h of Season.data.history || []) if (h.team === id) { const m = String(h.rec).split('-').map(Number); w += m[0] || 0; l += m[1] || 0; t += m[2] || 0; } return `${w}-${l}${t ? '-' + t : ''}`; },
  titles() { return (Season.data.history || []).filter(h => h.champ && h.champ === h.team).length; },

  // ---- hub card ----
  card() {
    const d = Season.data, o = this.ensure(), L = this.lvl(o.sec), n = this.titles();
    let h = `<div class="owSec"><span>JOB SECURITY</span><b style="color:${L[3]}">${o.sec}</b><em class="fhTag ${L[2]}">${L[1]}</em></div><div class="fhBar owBar"><u style="width:${o.sec}%;background:${L[3]}"></u></div>`;
    if (o.last && o.last.newJob === d.team) h += `<div class="fhLine dim">New job. The owner sets new goals when the season starts.</div>`;
    else {
      const lab = { done: ['DONE', 'g'], on: ['ON TRACK', ''], off: ['BEHIND', 'c'], fail: ['MISSED', 'r'] };
      h += `<div class="fhSub fhGap">THIS YEAR'S GOALS</div>` + o.goals.map(g => { const c = this.check(g), l = lab[c.s];
        return `<div class="fhRow"><span>${g.tx}</span><span class="fhR">${c.p ? `<small>${c.p}</small>` : ''}<em class="fhTag ${l[1]}">${l[0]}</em></span></div>`; }).join('');
      if (d.year < 2) h += `<div class="fhLine dim">Rookie year: the owner is patient. From year 2 on, a bad season can cost you your job.</div>`;
    }
    return FH.card('fhOwn', 'OWNER', h, n ? `<em class="fhTag g owTi">${n} TITLE${n > 1 ? 'S' : ''}</em>` : '');
  }
};

// ---------------- hooks ----------------
{ const _fw = Season.finishWeek; Season.finishWeek = function (s) { _fw.call(this, s); if (Owner.on()) { try { Owner.week(); } catch (e) { console.warn('owner', e); } this.save(); } }; }
{ const _fs = Season.finishSeason; Season.finishSeason = function () {
  const d = this.data, first = !d.awards;
  _fs.call(this);
  if (!first || !Owner.on()) return;
  try {
    Owner.final();
    if (d.champ === d.team) {
      const fin = (d.log || []).slice(-1)[0], g = fin && fin.games[0], h = g && g.home === d.team;
      d.ring = { y: d.year, team: d.team, rec: recStr(d.team), n: Owner.titles(), opp: g ? (h ? g.away : g.home) : null, sc: g ? (h ? g.score : [g.score[1], g.score[0]]).join('-') : '' };
      d.ringShow = 1;
    }
  } catch (e) { console.warn('owner', e); }
}; }
// next year: the owner's mood, your past jobs and the ring come along
{ const _ny = Season.nextYear; Season.nextYear = function () {
  const d = this.data, o = d.owner, keep = { jobs: d.jobs, ring: d.ring, ringShow: d.ringShow };
  const ch = _ny.call(this);
  for (const k in keep) if (keep[k] != null) this.data[k] = keep[k];
  if (o) { this.data.owner = { base: o.next != null ? o.next : o.base, prevHot: !!o.prevHot, ext: o.ext || 0, since: o.since || 1 }; if (Owner.on()) Owner.ensure(); }
  if (keep.ringShow && Owner.on()) Feed.say(Feed.fan(this.data.team), `Ring night!! 💍🏆 The banner goes up tonight. Best fans in the league`, 0.6);
  this.save();
  return ch;
}; }

// hub: OWNER card at the top of the second column
{ const _r = FH.render; FH.render = function () {
  _r.call(this);
  if (!Owner.on()) return;
  const col = document.querySelectorAll('#shStand .fhCol')[1];
  if (col) try { col.insertAdjacentHTML('afterbegin', Owner.card()); } catch (e) { console.warn('owner card', e); }
}; }

// season over: the owner's verdict on the left panel, FIND A NEW JOB if you got fired
{ const _hub = renderHub; renderHub = function () {
  const d = Season.data;
  if (d && Owner.on() && d.ringShow && d.ring && d.year > d.ring.y && d.phase === 'regular') { delete d.ringShow; Season.save(); _hub(); return openRing(); }
  _hub();
  $('seasonHub').classList.remove('owOver');
  if (!d || !Owner.on() || d.phase === 'regular' || d.phase === 'playoffs') return;
  const o = d.owner, L = o && o.last; if (!L || L.y !== d.year) return;
  $('seasonHub').classList.add('owOver'); // makes room for the verdict
  Owner.flush();
  const row = $('shNext').querySelector('.row'), nx = $('shNext2');
  const msg = L.newJob ? `<b>NEW JOB.</b> You're the head coach of the ${Season.team(L.newJob).city} ${tName(L.newJob)} now. Your franchise keeps going with them.`
    : L.verdict === 'fired' ? `<b>THE OWNER MADE A CHANGE.</b> You've been let go after going ${L.rec}. Other teams want you though. Pick your next job.`
    : L.verdict === 'hot' ? `<b>HOT SEAT.</b> The owner is not happy (${L.met} of ${L.of} goals). ${d.year >= 2 ? "Another season like this and you're out." : 'Next year has to be better.'}`
    : L.verdict === 'ext' ? `<b>CONTRACT EXTENSION.</b> The owner loves what you're building (${L.met} of ${L.of} goals). You're signed through year ${L.y + 3}.`
    : `<b>THE OWNER:</b> a solid year. ${L.met} of ${L.of} goals met. Job security ${L.final}.`;
  if (row) row.insertAdjacentHTML('beforebegin', `<div class="owMsg ${L.newJob ? 'ext' : L.verdict}">${msg}</div>`);
  if (L.verdict === 'fired' && !L.newJob && nx) { nx.textContent = 'FIND A NEW JOB'; nx.onclick = () => { Sound.click(); openJobs(); }; }
  if (L.newJob) $('shSched').innerHTML = `<div class="note">Your ${tName(L.newJob)} schedule comes out when the new season starts.</div>`; // the list still has your old team's games
}; }

// history: every job you've had
{ const _tab = renderHubTab; renderHubTab = function () {
  _tab();
  const d = Season.data; if (hubTab !== 'hist' || !d || !Owner.on()) return;
  const o = Owner.ensure(), jobs = (d.jobs || []).concat([{ team: d.team, from: o.since || 1, to: null, rec: Owner.totalRec(d.team) }]), n = Owner.titles();
  $('shStand').insertAdjacentHTML('beforeend', `<div class="leadHead" style="margin-top:8px">COACHING CAREER${n ? `  ·  ${n} TITLE${n > 1 ? 'S' : ''}` : ''}</div>` +
    jobs.map(j => `<div class="leadRow"><span>${dotFor(j.team)}${Season.team(j.team).city} ${tName(j.team)}</span><i>YEAR ${j.from}${j.to ? `-${j.to}` : '-NOW'}  ·  ${j.rec}</i></div>`).join(''));
}; }

// ---------------- new job screen ----------------
screens.push('jobs', 'ringCer'); menuScreens.push('jobs', 'ringCer');
(() => {
  const a = document.createElement('div'); a.id = 'jobs'; a.className = 'screen';
  a.innerHTML = `<h2>New Job</h2><div id="jbNote"></div><div id="jbCards"></div><button id="jbBack">BACK</button>`;
  const b = document.createElement('div'); b.id = 'ringCer'; b.className = 'screen';
  b.innerHTML = `<div id="rgBody"></div>`;
  $('stage').appendChild(a); $('stage').appendChild(b);
})();
function openJobs() {
  const d = Season.data, ids = Owner.openings();
  $('jbNote').textContent = `These teams have an opening. Your franchise keeps going with whoever you pick (history, titles and all).`;
  $('jbCards').innerHTML = ids.map(id => { const t = Season.team(id), r = d.rec[id];
    return `<div class="jbCard" style="--c1:${t.c1};--c2:${t.c2}"><div class="jbLogo">${teamBadge(t)}</div><div class="jbTeam"><i>${t.city}</i>${t.name}</div>
      <div class="jbInfo"><b>${teamOvr(t)} OVR</b>  ·  ${r.w}-${r.l}${r.t ? '-' + r.t : ''} last year</div><div class="jbInfo dim">${t.conf} ${String(t.div).toUpperCase()}  ·  Cap room ${cmoney(Contracts.room(id))}</div>
      <button class="gold jbGo" data-id="${id}">TAKE THE JOB</button></div>`; }).join('');
  document.querySelectorAll('.jbGo').forEach(b => b.onclick = () => { Sound.whistle(); Owner.takeJob(b.dataset.id); renderHub(); });
  show('jobs');
}
$('jbBack').onclick = () => { Sound.click(); renderHub(); };

// ---------------- ring ceremony ----------------
function ringSVG(t, yr) {
  const c1 = t.c1, c2 = t.c2, dia = [];
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; dia.push(`<circle cx="${(120 + Math.cos(a) * 60).toFixed(1)}" cy="${(100 + Math.sin(a) * 54).toFixed(1)}" r="${i % 3 ? 4 : 5.2}" fill="#fff" stroke="#9fb3c8" stroke-width="1"/>`); }
  return `<svg viewBox="0 0 240 250" class="rgSvg"><defs>
    <linearGradient id="rgGd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4b8"/><stop offset=".35" stop-color="#f6c31c"/><stop offset=".7" stop-color="#a5770f"/><stop offset="1" stop-color="#f3d264"/></linearGradient>
    <radialGradient id="rgGm" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${shade(c1, 0.45)}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${shade(c1, -0.55)}"/></radialGradient></defs>
    <path d="M60 150 C 52 214 96 242 120 242 C 144 242 188 214 180 150" fill="none" stroke="url(#rgGd)" stroke-width="20" stroke-linecap="round"/>
    <path d="M60 150 C 52 214 96 242 120 242 C 144 242 188 214 180 150" fill="none" stroke="#5c4006" stroke-width="2" opacity=".5"/>
    <rect x="34" y="22" width="172" height="158" rx="40" fill="url(#rgGd)" stroke="#5c4006" stroke-width="3"/>
    <rect x="46" y="34" width="148" height="134" rx="32" fill="#16120a"/>
    ${dia.join('')}
    <ellipse cx="120" cy="100" rx="44" ry="39" fill="url(#rgGm)" stroke="${c2}" stroke-width="4"/>
    <path d="M78 22 h84 l-6 16 h-72 z" fill="${c1}" stroke="#5c4006" stroke-width="2"/>
    <text x="120" y="35" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-style="italic" font-weight="900" font-size="14" fill="${textOn(c1)}">${yr}</text>
    <path d="M62 160 h116 l-10 20 h-96 z" fill="${c2}" stroke="#5c4006" stroke-width="2"/>
    <text x="120" y="175" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-style="italic" font-weight="900" font-size="15" letter-spacing="1" fill="${textOn(c2)}">CHAMPIONS</text>
    <path d="M70 40 q 20 -8 34 -6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55" fill="none"/>
    <clipPath id="rgCl"><rect x="34" y="22" width="172" height="158" rx="40"/></clipPath>
    <g clip-path="url(#rgCl)"><polygon class="rgShine" points="0,0 34,0 -6,250 -40,250" fill="#fff" opacity=".22"/></g></svg>`;
}
function openRing() {
  const d = Season.data, R = d.ring, t = Season.team(R.team), st = stadiumOf(t);
  $('rgBody').innerHTML = `<div class="rgWrap"><div class="rgArt">${ringSVG(t, seasonYr(R.y))}<div class="rgLogo">${teamBadge(t)}</div></div>
    <div class="rgInfo"><div class="rgTag">RING CEREMONY  ·  OPENING NIGHT, YEAR ${d.year}</div>
      <div class="rgTeam" style="color:${t.c1 === '#000000' ? '#fff' : t.c1}">${t.city} ${t.name}</div>
      <div class="rgBowl">${bowlName(R.y)} CHAMPIONS</div>
      <div class="rgLine"><b>${R.rec}</b> in the regular season${R.opp ? `  ·  beat the ${tName(R.opp)} <b>${R.sc}</b> in the final` : ''}</div>
      <div class="rgLine">Title number <b>${R.n}</b>. The banner goes up at ${st.name} tonight.</div>
      <button class="big gold" id="rgGo">RAISE THE BANNER</button></div></div>`;
  $('rgGo').onclick = () => { Sound.click(); renderHub(); };
  show('ringCer');
  if (Sound.td) Sound.td();
}

// ---------------- title banners in your stadium (end zone stands, next to the wall) ----------------
Owner.bannerYears = G => {
  const d = Season.data; if (!G || !G.season || G.bigGame || G.career || !d || !Owner.on() || !G.teams || G.teams[0].id !== d.team) return [];
  return (d.history || []).filter(h => h.team === d.team && h.champ === d.team).map(h => h.year).slice(-4);
};
{ let drawn = '';
  const _bf = buildField; buildField = function (G) {
    const ys = Owner.bannerYears(G), sig = ys.join(',');
    if (sig !== drawn) { fieldKey = ''; drawn = sig; } // new title since this field was drawn
    const before = fieldCv; _bf(G);
    if (fieldCv === before || !ys.length) return;
    const g = fieldCv.getContext('2d'); if (!g || !g.save) return;
    const t = G.teams[0], fx = x => (x + FIELD_PAD_X) * PX, fy = y => (y + FIELD_PAD_TOP) * PY, w = 30, h = 46;
    for (const x0 of [fx(-2.6) - 7 - 6 - w, fx(122.6) + 7 + 6]) ys.slice().reverse().forEach((y, i) => {
      const x = x0, top = fy(3) + i * (h + 9);
      g.fillStyle = '#555c66'; g.fillRect(x - 3, top - 3, w + 6, 2);
      g.fillStyle = t.c1; g.strokeStyle = t.c2; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, top); g.lineTo(x + w, top); g.lineTo(x + w, top + h); g.lineTo(x + w / 2, top + h - 8); g.lineTo(x, top + h); g.closePath(); g.fill(); g.stroke();
      if (typeof drawTrophy === 'function') drawTrophy(g, x + w / 2, top + 22, 17);
      g.fillStyle = textOn(t.c1); g.font = '900 10px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(seasonYr(y)), x + w / 2, top + 31);
    });
  };
}
