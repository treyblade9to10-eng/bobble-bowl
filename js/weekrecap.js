// ---- Weekly recap (after every regular-season week, played or simmed): your game, top 3 plays around the league, notable stat lines, power rankings ----
// d.pwr = { y, wk, list: [ids best first], prev: [last week's list] }   d.wkr = the last recap   d.wkrOff = true when you turned recaps off
screens.push('wkRecap'); menuScreens.push('wkRecap');
(() => {
  const el = document.createElement('div'); el.id = 'wkRecap'; el.className = 'screen';
  el.innerHTML = `<div id="wrBody"></div><div class="wrBtns"><button class="big gold" id="wrGo">CONTINUE</button><button id="wrOff"></button></div>`;
  $('stage').appendChild(el);
})();

// seeded random (same week = same picks every time)
function feedRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const Power = {
  // record + point differential (both count more as the season goes on) + how good the roster is
  list() {
    const d = Season.data, sc = {};
    for (const t of TEAMS) {
      const r = d.rec[t.id] || { w: 0, l: 0, t: 0, pf: 0, pa: 0 }, gp = r.w + r.l + r.t, k = Math.min(1, gp / 6);
      const pct = gp ? (r.w + r.t / 2) / gp : 0.5, pd = gp ? (r.pf - r.pa) / gp : 0;
      sc[t.id] = (pct - 0.5) * 100 * k + clamp(pd, -21, 21) * 1.1 * k + (Season.ovr(t.id) - 80) * 3;
    }
    return TEAMS.map(t => t.id).sort((a, b) => sc[b] - sc[a]);
  },
  update(wk) {
    const d = Season.data, old = d.pwr && d.pwr.y === d.year ? d.pwr.list : TEAMS.map(t => t.id).sort((a, b) => Season.ovr(b) - Season.ovr(a)); // week 1: compared to the preseason (roster only)
    d.pwr = { y: d.year, wk, list: this.list(), prev: old };
  },
  move(id) { const p = Season.data.pwr; if (!p || !p.prev) return 0; const a = p.prev.indexOf(id); return a < 0 ? 0 : a - p.list.indexOf(id); }
};

const WeekRecap = {
  on() { const d = Season.data; return !!d && !d.wkrOff && !(Season.isCareer && Season.isCareer()); },
  pending() { const d = Season.data, r = d && d.wkr; return this.on() && !!r && !r.seen && r.y === d.year; },
  // who played who this week, from each team's side
  games(wk) {
    const out = {};
    for (const g of Season.data.weeks[wk] || []) if (g.score) { out[g.home] = { opp: g.away, my: g.score[0], th: g.score[1] }; out[g.away] = { opp: g.home, my: g.score[1], th: g.score[0] }; }
    return out;
  },
  // the 3 best plays: made from the real box scores (a WR with a TD + big yards caught a long one), plus the closest game
  plays(wk, lines, r) {
    const d = Season.data, gm = this.games(wk), C = [], yd = (a, b) => Math.round(a + r() * Math.max(0, b - a));
    for (const x of lines) {
      const o = gm[x.t]; if (!o) continue;
      const vs = tName(o.opp), who = `${x.name} (${x.t})`;
      if ((x.pos === 'WR' || x.pos === 'TE') && x.td >= 1 && x.rec >= 70) C.push({ s: x.rec / 9 + x.td * 6, t: x.t, tx: `${who} gets behind the defense for a ${yd(28, Math.min(78, x.rec - 10))}-yard touchdown catch against the ${vs}` });
      else if (x.pos === 'RB' && x.td >= 1 && x.rush >= 70) C.push({ s: x.rush / 9 + x.td * 6, t: x.t, tx: `${who} breaks a tackle and goes ${yd(22, Math.min(70, x.rush - 15))} yards for a touchdown against the ${vs}` });
      else if (x.pos === 'QB' && x.td >= 3) C.push({ s: x.td * 6 + x.pass / 40, t: x.t, tx: `${who} throws for ${x.pass} yards and ${x.td} touchdowns against the ${vs}` });
      if (['CB', 'S', 'LB'].includes(x.pos) && x.int >= 1) C.push({ s: 12 + x.int * 8, t: x.t, tx: `${who} jumps the route and picks off the ${vs}${x.int > 1 ? `, ${x.int} times` : ''}` });
      if (x.sack >= 2) C.push({ s: x.sack * 7, t: x.t, tx: `${who} gets to the quarterback ${x.sack} times against the ${vs}` });
      if (x.blk) C.push({ s: 18, t: x.t, tx: `${who} blocks a kick against the ${vs}` });
    }
    for (const g of (d.weeks[wk] || []).slice(1)) if (g.score && Math.abs(g.score[0] - g.score[1]) <= 3 && g.score[0] !== g.score[1]) {
      const hw = g.score[0] > g.score[1], W = hw ? g.home : g.away, L = hw ? g.away : g.home;
      C.push({ s: 16 + r() * 6, t: W, tx: `The ${tName(W)} hold off the ${tName(L)}, ${Math.max(...g.score)}-${Math.min(...g.score)}, in the closest finish of the week` });
    }
    C.sort((a, b) => b.s - a.s);
    const out = [], used = new Set();
    for (const c of C) { if (out.length >= 3) break; if (used.has(c.t) && C.length > 5) continue; used.add(c.t); out.push({ t: c.t, tx: c.tx }); }
    return out;
  },
  // called by the weekly hook in feed.js with this week's stat lines
  build(wk, lines, r) {
    const d = Season.data, me = d.team, g = (d.weeks[wk] || [])[0]; if (!g || !g.score) return;
    const home = g.home === me, opp = home ? g.away : g.home;
    const pg = typeof potgScore === 'function' ? potgScore : x => x.pass / 20 + x.rush / 8 + x.rec / 8 + x.td * 6;
    const top = lines.filter(x => x.t === me).sort((a, b) => pg(b) - pg(a)).slice(0, 3).map(x => ({ pos: x.pos, name: x.name, line: Form.statLine(x) }));
    const big = x => Math.max(Form.offScore(x), Form.defScore(x) * 1.6);
    const notable = lines.filter(x => Form.statLine(x)).sort((a, b) => big(b) - big(a)).slice(0, 4).map(x => ({ t: x.t, pos: x.pos, name: x.name, line: Form.statLine(x) }));
    d.wkr = { y: d.year, wk, opp, home, my: home ? g.score[0] : g.score[1], th: home ? g.score[1] : g.score[0], top, notable, plays: this.plays(wk, lines, r), seen: 0 };
  },
  html() {
    const d = Season.data, r = d.wkr, A = Season.team(d.team), B = Season.team(r.opp), res = r.my > r.th ? 'W' : r.my < r.th ? 'L' : 'T';
    const P = d.pwr && d.pwr.y === r.y ? d.pwr.list : [], top = P.slice(0, 10), mi = P.indexOf(d.team);
    if (mi >= 10) top.push(d.team);
    const prRow = id => { const mv = Power.move(id), rk = P.indexOf(id) + 1;
      return `<div class="wrPr${id === d.team ? ' me' : ''}"><b>${rk}</b><span>${dotFor(id)}${tName(id)}</span><i>${recStr(id)}</i><em class="fhMv ${mv > 0 ? 'up' : mv < 0 ? 'dn' : ''}">${mv > 0 ? '▲' + mv : mv < 0 ? '▼' + -mv : '-'}</em></div>`; };
    const row = (a, b) => `<div class="leadRow"><span>${a}</span><i>${b}</i></div>`;
    return `<div class="wrHead"><b>WEEK ${r.wk + 1} RECAP</b><span>AROUND THE BOBBLE LEAGUE</span></div>
      <div class="wrGrid">
        <div class="wrCol"><div class="leadHead">YOUR GAME</div>
          <div class="wrScore" style="background:linear-gradient(110deg, ${A.c1} 0%, ${A.c1} 46%, ${B.c1} 54%, ${B.c1} 100%)"><span style="color:${textOn(A.c1)}">${A.name.toUpperCase()}</span><b style="color:${textOn(A.c1)}">${r.my}</b><em class="rcRes ${res}">${res}</em><b style="color:${textOn(B.c1)}">${r.th}</b><span style="color:${textOn(B.c1)}">${B.name.toUpperCase()}</span></div>
          <div class="leadHead wrGap">TOP PERFORMERS</div>${r.top.map(x => row(`${x.pos} ${x.name}`, x.line)).join('') || '<div class="note">Nobody filled up the stat sheet.</div>'}</div>
        <div class="wrCol"><div class="leadHead">TOP 3 PLAYS OF THE WEEK</div>${r.plays.map((p, i) => `<div class="wrPlay"><b>${i + 1}</b><span>${p.tx}</span></div>`).join('') || '<div class="note">A quiet week around the league.</div>'}
          <div class="leadHead wrGap">NOTABLE STAT LINES</div>${r.notable.map(x => row(`${x.pos} ${x.name} <i>${x.t}</i>`, x.line)).join('')}</div>
        <div class="wrCol wrPrCol"><div class="leadHead">POWER RANKINGS</div>${top.map(prRow).join('')}</div>
      </div>`;
  }
};

function openWeekRecap() {
  const d = Season.data; if (!d || !d.wkr) return renderHub();
  d.wkr.seen = 1; Season.save();
  $('wrBody').innerHTML = WeekRecap.html();
  $('wrOff').textContent = `WEEKLY RECAP: ${d.wkrOff ? 'OFF' : 'ON'}`;
  show('wkRecap');
}
$('wrGo').onclick = () => { Sound.click(); renderHub(); };
$('wrOff').onclick = () => { const d = Season.data; d.wkrOff = !d.wkrOff; Season.save(); Sound.click(); $('wrOff').textContent = `WEEKLY RECAP: ${d.wkrOff ? 'OFF' : 'ON'}`; };
window.addEventListener('keydown', e => { if ($('wkRecap').classList.contains('show') && (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space')) { e.preventDefault(); $('wrGo').onclick(); } });

// season setup: WEEKLY RECAP on/off row (same segmented buttons as the other rows)
{
  const sl = document.createElement('select'); sl.id = 'snRecap'; sl.style.display = 'none';
  sl.innerHTML = '<option value="1" selected>On</option><option value="0">Off</option>'; $('seasonNew').appendChild(sl);
  const grp = $('snSetBody').querySelector('.muGrp'), row = document.createElement('div'); row.className = 'muRow'; row.id = 'snR_snRecap';
  row.innerHTML = `<span class="muL">WEEKLY RECAP</span><div class="muC seg"></div>`;
  const c = row.querySelector('.muC');
  for (const o of sl.options) { const b = document.createElement('button'); b.dataset.v = o.value; b.textContent = o.text.toUpperCase(); b.onclick = () => snSetVal('snRecap', o.value); c.appendChild(b); }
  snPaints.push(() => c.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === sl.value)));
  if (grp) grp.appendChild(row);
  const _st = $('snStart').onclick; $('snStart').onclick = e => { _st(e); if (Season.data && Season.data.week === 0 && Season.data.year === 1) { Season.data.wkrOff = sl.value === '0'; Season.save(); } };
}

// a game you played: its biggest moment makes the top 3 (the game recap is built right after the week is done)
{ const _done = seasonGameDone; seasonGameDone = function (score) {
  _done(score);
  const d = Season.data, r = d && d.wkr, lr = d && d.lastRecap;
  if (!r || r.y !== d.year || r.kp || !lr || !lr.played || lr.label !== `Week ${r.wk + 1}`) return;
  const sc = p => (p.tag === 'GAME WINNER' ? 100 : 0) + (p.team === d.team ? 20 : 0) + (p.tag === 'TD' ? 10 : 0) + +((p.text.match(/(\d+) yards?/) || [])[1] || 0) / 5; // the winner, yours, a TD, a long one
  const kp = (lr.plays || []).slice().sort((a, b) => sc(b) - sc(a))[0];
  if (!kp) return;
  const t = kp.team || d.team;
  r.plays = [{ t, tx: `${tName(t)}: ${kp.text.replace(/\.\./g, '.')}` }].concat(r.plays.filter(p => p.t !== t)).slice(0, 3); r.kp = 1;
  Season.save();
}; }

// SIM: the recap comes right after. A played game: after the game recap.
{ const _sim = $('shSim').onclick; $('shSim').onclick = e => { _sim(e); if (WeekRecap.pending()) openWeekRecap(); }; }
{ const _go = $('rcGo').onclick; $('rcGo').onclick = e => { if (WeekRecap.pending()) { Sound.click(); return openWeekRecap(); } _go(e); }; }
