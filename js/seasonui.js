// ---- Season / franchise screens: new season, hub, leaders, history, offseason, trades ----
screens.push('offseason', 'trade');
menuScreens.push('offseason', 'trade');
let snIdx = TEAMS.findIndex(t => t.id === 'KC');
let hubTab = 'stand';

$('btnSeason').onclick = () => { Sound.init(); Sound.click(); openSeason(); };
function openSeason() {
  Season.load();
  const d = Season.data;
  if (d) { if (!d.history) d.history = []; if (!d.year) d.year = 1; if (!d.stats) d.stats = {}; renderHub(); }
  else renderSeasonNew();
}
function renderSeasonNew() {
  const el = $('pSeason').querySelector('.tbig'), t = TEAMS[snIdx];
  el.innerHTML = teamCard(t); el.style.background = `linear-gradient(160deg, ${t.c1} 55%, ${t.c2})`; el.style.color = textOn(t.c1);
  show('seasonNew');
}
$('snUp').onclick = () => { snIdx = (snIdx + TEAMS.length - 1) % TEAMS.length; Sound.click(); renderSeasonNew(); };
$('snDn').onclick = () => { snIdx = (snIdx + 1) % TEAMS.length; Sound.click(); renderSeasonNew(); };
$('snBack').onclick = () => show('title');
$('snStart').onclick = () => { Season.start(TEAMS[snIdx].id, +$('snGames').value, +$('snQtr').value, +$('snDiff').value); Sound.whistle(); renderHub(); };
window.addEventListener('keydown', e => {
  if ($('seasonNew').classList.contains('show')) { if (e.code === 'ArrowUp' || e.code === 'KeyW') $('snUp').onclick(); if (e.code === 'ArrowDown' || e.code === 'KeyS') $('snDn').onclick(); if (e.code === 'Enter') $('snStart').onclick(); }
  else if ($('seasonHub').classList.contains('show') && e.code === 'Enter' && $('shPlay').style.display !== 'none') $('shPlay').onclick();
});

const recStr = id => { const r = Season.data.rec[id]; return `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`; };
const dotFor = id => { const t = Season.team(id); return `<span class="dot" style="background:${t.c1}"></span>`; };
function renderHub() {
  const d = Season.data, me = Season.team(d.team), conf = me.conf;
  $('shTop').innerHTML = `<div class="big1" style="color:${me.c1 === '#000000' ? '#fff' : me.c1};-webkit-text-stroke:1px #fff">${me.city.toUpperCase()} ${me.name.toUpperCase()}</div>
    <div class="rec">${d.year > 1 ? `YEAR ${d.year}  •  ` : ''}${recStr(d.team)}  •  ${d.phase === 'regular' ? `WEEK ${d.week + 1} of ${d.games}  •  ${Season.canTrade() ? `TRADE DEADLINE: WEEK ${Season.deadline()}` : 'TRADE DEADLINE PASSED'}` : d.phase === 'playoffs' ? 'PLAYOFFS' : 'SEASON OVER'}</div>`;
  // next game / season result
  const g = Season.myGame(), nx = $('shNext');
  const canPlay = !!g;
  if (g) {
    const home = g.home === d.team, opp = Season.team(home ? g.away : g.home);
    const wx = d.phase === 'regular' && d.weather && d.weather[d.week];
    const cond = wx ? [wx.night ? 'Night game' : '', wx.w !== 'clear' ? (wx.w === 'rain' ? 'Rain' : 'Snow') : ''].filter(Boolean).join(', ') : '';
    nx.style.background = `linear-gradient(120deg, ${me.c1} 0%, ${me.c1} 45%, ${opp.c1} 55%, ${opp.c1} 100%)`;
    nx.innerHTML = `<div class="lbl">${d.phase === 'playoffs' ? Season.roundName(d.bracket.round).toUpperCase() : 'NEXT GAME'}</div>
      <div class="mu">${home ? 'vs' : '@'} ${opp.city} ${opp.name}</div>
      <div class="sub">${opp.id} is ${recStr(opp.id)}  •  ${teamOvr(opp)} OVR  •  you are ${home ? 'HOME' : 'AWAY'}${cond ? `  •  ${cond}` : ''}</div>`;
  } else {
    nx.style.background = 'var(--panel)';
    const ch = d.champ && Season.team(d.champ);
    const msg = d.phase === 'done' && d.champ === d.team ? `You won the Bobble Bowl.` :
      d.phase === 'missed' ? `You missed the playoffs (top 4 get in).` : d.phase === 'eliminated' ? `Your season ended in the playoffs.` : 'Season over.';
    const aw = (d.awards || []).map(a => `<div class="awLine"><b>${a.award}</b> ${a.name} <span>${a.pos}, ${a.team}  ·  ${a.line}</span></div>`).join('');
    nx.innerHTML = `<div class="mu">${msg}</div><div class="sub">${ch ? `Bobble Bowl champion: <b>${ch.city} ${ch.name}</b>` : ''}</div>
      ${aw ? `<div class="awards">${aw}</div>` : ''}
      <div class="row"><button class="big gold" id="shNext2">${d.draft ? 'BACK TO THE DRAFT' : `DRAFT + YEAR ${d.year + 1}`}</button><button id="shNew">NEW TEAM</button></div>`;
    $('shNext2').onclick = () => { Sound.click(); openDraft(); };
    $('shNew').onclick = () => { if (confirm('Start over with a new team? This franchise will be deleted.')) { Season.clear(); renderSeasonNew(); } };
  }
  $('shPlay').style.display = $('shSim').style.display = canPlay ? '' : 'none';
  $('shQuit').style.display = canPlay ? '' : 'none';
  $('shTrade').style.display = Season.canTrade() ? '' : 'none';
  // schedule + playoff results
  let sched = '';
  d.weeks.forEach((wk, i) => {
    const m = wk[0], home = m.home === d.team, opp = home ? m.away : m.home;
    let res = '';
    if (m.score) { const my = home ? m.score[0] : m.score[1], th = home ? m.score[1] : m.score[0]; const r = my > th ? 'W' : my < th ? 'L' : 'T'; res = `<span class="${r}">${r} ${my}-${th}</span>`; }
    sched += `<div class="wkrow ${i === d.week && d.phase === 'regular' ? 'now' : ''}"><span>Wk ${i + 1} ${home ? 'vs' : '@'} ${dotFor(opp)}${opp}</span>${res}</div>`;
  });
  if (d.log.length) {
    sched += `<div style="margin-top:6px;color:var(--gold);font-weight:bold">PLAYOFFS</div>`;
    for (const r of d.log) sched += `<div style="opacity:.8;margin-top:3px">${Season.roundName(r.round)}</div><div class="bracket">${r.games.map(x => `<div class="bgame"><div class="${x.score[0] > x.score[1] ? 'win' : ''}">${dotFor(x.home)}${x.home} ${x.score[0]}</div><div class="${x.score[1] > x.score[0] ? 'win' : ''}">${dotFor(x.away)}${x.away} ${x.score[1]}</div></div>`).join('')}</div>`;
  }
  $('shSched').innerHTML = sched;
  renderHubTab();
  show('seasonHub');
}

// right side: standings / league leaders / franchise history
function renderHubTab() {
  const d = Season.data, conf = Season.team(d.team).conf;
  document.querySelectorAll('#shTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === hubTab));
  let h = '';
  if (hubTab === 'stand') {
    const st = Season.standings(conf);
    h = `<table><tr><th>#</th><th>${conf}</th><th>W-L</th><th>PF</th><th>PA</th></tr>` +
      st.map((id, i) => { const r = d.rec[id]; return `<tr class="${id === d.team ? 'me' : ''} ${i === 3 ? 'cut' : ''}"><td>${i + 1}</td><td>${dotFor(id)}${Season.team(id).name}</td><td>${recStr(id)}</td><td>${r.pf}</td><td>${r.pa}</td></tr>`; }).join('') +
      `</table><div class="note">Dashed line = playoff cut (top 4)</div>`;
  } else if (hubTab === 'lead') {
    const cats = [['pass', 'PASSING YDS'], ['rush', 'RUSHING YDS'], ['rec', 'RECEIVING YDS'], ['td', 'TOUCHDOWNS'], ['sack', 'SACKS'], ['int', 'INTERCEPTIONS']];
    h = '<div class="leadGrid">' + cats.map(([k, lbl]) => `<div class="leadBox"><div class="leadHead">${lbl}</div>` +
      (Season.leaders(k).map((l, i) => `<div class="leadRow ${l.t === d.team ? 'me' : ''}"><span>${i + 1}. ${dotFor(l.t)}${lastName(l.name)} <i>${l.t}</i></span><b>${l[k]}</b></div>`).join('') || '<div class="note">No stats yet</div>') + '</div>').join('') + '</div>';
  } else if (hubTab === 'news') {
    h = (d.news || []).length ? d.news.map(n => `<div class="newsRow"><span>WK ${n.week}</span>${n.text}</div>`).join('') : '<div class="note">League news (CPU trades, the deadline, draft picks) shows up here.</div>';
  } else {
    const hist = (d.history || []).slice().reverse();
    h = hist.length ? `<table><tr><th>YEAR</th><th>TEAM</th><th>REC</th><th>FINISH</th><th>CHAMP</th></tr>${hist.map(x => `<tr><td>${x.year}</td><td>${x.team}</td><td>${x.rec}</td><td>${x.finish}</td><td>${x.champ || ''}</td></tr>`).join('')}</table>` : '<div class="note">Finish a season to start your franchise history. Then hit START YEAR 2 to keep going with the same team.</div>';
    if (d.trades && d.trades.length) h += `<div class="leadHead" style="margin-top:8px">TRADES THIS YEAR</div>` + d.trades.map(t => `<div class="leadRow"><span>Got ${t.got} from ${t.with}</span><i>for ${t.gave}</i></div>`).join('');
  }
  $('shStand').innerHTML = h;
}
document.querySelectorAll('#shTabs button').forEach(b => b.onclick = () => { hubTab = b.dataset.tab; Sound.click(); renderHubTab(); });

$('shMenu').onclick = () => show('title');
$('shQuit').onclick = () => { if (confirm('Abandon this season? Your progress will be deleted.')) { Season.clear(); show('title'); } };
$('shSim').onclick = () => {
  const d = Season.data, g = Season.myGame(); if (!g) return;
  const sc = d.phase === 'playoffs' ? Season.playoffSim(g.home, g.away) : Season.simScore(g.home, g.away);
  Sound.click(); seasonGameDone(sc); renderHub();
};
$('shPlay').onclick = () => {
  const d = Season.data, g = Season.myGame(); if (!g) return;
  Sound.init(); Sound.whistle(); Sound.crowd(false);
  if (G.mode === 'mobile') goFullscreen();
  G.demo = false; G.season = true; show(null);
  const wx = d.phase === 'regular' && d.weather ? d.weather[d.week] : { w: pickWeather('random', d.games, d.games), night: d.bracket && d.bracket.round === 2 ? true : chance(0.5) };
  newGame(Season.team(g.home), Season.team(g.away), { qtr: d.qtr, diff: d.diff, humanSide: g.home === d.team ? 0 : 1, playoff: d.phase === 'playoffs',
    weather: wx ? wx.w : 'clear', night: wx ? wx.night : false });
  if (d.phase === 'playoffs') showBanner(Season.roundName(d.bracket.round).toUpperCase(), 'Lose and go home', '#ffd23f', 2.4);
};
function seasonGameDone(score) {
  const d = Season.data;
  if (d.phase === 'regular') Season.finishWeek(score);
  else if (d.phase === 'playoffs') Season.finishPlayoffRound(score);
}
$('btnSeasonCont').onclick = () => { G.season = false; G.teams = null; G.phase = 'idle'; renderHub(); };

// ---- offseason: who got better, who slipped ----
function renderOffseason(changes) {
  const d = Season.data, me = Season.team(d.team);
  const row = c => { const dv = c.to - c.from; return `<div class="devRow"><span>${c.pos} ${c.name}</span><b class="${dv > 0 ? 'up' : dv < 0 ? 'down' : ''}">${c.from} → ${c.to}${dv ? ` (${dv > 0 ? '+' : ''}${dv})` : ''}</b></div>`; };
  $('osBody').innerHTML = `<div class="osHead">${me.city.toUpperCase()} ${me.name.toUpperCase()}  ·  YEAR ${d.year}</div>
    <div class="osNote">Every player in the league trained this offseason. Here's how your guys came back:</div>
    <div class="devList">${changes.map(row).join('')}</div>
    <div class="osNote">Team overall is now <b>${teamOvr(me)}</b>. Want to shake up the roster? Hit TRADE from the season screen any time during the regular season.</div>`;
  show('offseason');
}
$('osGo').onclick = () => renderHub();

// ---- trades ----
const tr = { other: null, side: null, mine: null, theirs: null };
$('shTrade').onclick = () => { Season.ensureRosters(); tr.mine = tr.theirs = null; if (!tr.other || tr.other === Season.data.team) tr.other = TEAMS.find(t => t.id !== Season.data.team).id; renderTrade(); show('trade'); };
$('trBack').onclick = () => renderHub();
$('trTeam').onchange = () => { tr.other = $('trTeam').value; tr.theirs = null; renderTrade(); };
function trList(teamId, el, pickMine) {
  const t = Season.team(teamId);
  const rows = [];
  for (const side of ['off', 'def']) t[side].forEach((p, i) => {
    const key = side + ':' + i;
    const selKey = pickMine ? tr.mine : tr.theirs;
    const blocked = !pickMine && tr.mine && (tr.side !== side || Season.team(Season.data.team)[side][+tr.mine.split(':')[1]][0] !== p[0]);
    rows.push(`<div tabindex="0" class="trRow${selKey === key ? ' on' : ''}${blocked ? ' off' : ''}" data-k="${key}"><span class="pos">${p[0]}</span><b>${p[3]}</b><span>#${p[2]} ${p[1]}</span></div>`);
  });
  el.innerHTML = rows.join('');
  el.querySelectorAll('.trRow').forEach(r => r.onclick = () => {
    if (r.classList.contains('off')) return;
    Sound.click();
    if (pickMine) { tr.mine = r.dataset.k; tr.side = tr.mine.split(':')[0]; tr.theirs = null; } else tr.theirs = r.dataset.k;
    renderTrade();
  });
}
function renderTrade() {
  const d = Season.data;
  $('trTeam').innerHTML = TEAMS.filter(t => t.id !== d.team).map(t => `<option value="${t.id}"${t.id === tr.other ? ' selected' : ''}>${t.city} ${t.name}</option>`).join('');
  $('trMineHead').textContent = `${Season.team(d.team).name.toUpperCase()} (YOU)`;
  trList(d.team, $('trMine'), true); trList(tr.other, $('trTheirs'), false);
  const go = $('trGo'), meter = $('trMeter').firstElementChild;
  if (tr.mine && tr.theirs) {
    const [s1, i1] = tr.mine.split(':'), [, i2] = tr.theirs.split(':');
    const a = Season.team(d.team)[s1][+i1], b = Season.team(tr.other)[s1][+i2];
    const pct = Season.tradeOdds(a, b);
    meter.style.width = pct + '%'; meter.style.background = pct >= 80 ? '#5cdd8a' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
    $('trPct').textContent = `${pct}% chance they say yes`;
    $('trMsg').textContent = `${a[1]} (${a[3]}) for ${b[1]} (${b[3]})`;
    go.disabled = pct < 80;
  } else {
    meter.style.width = '0%'; $('trPct').textContent = tr.mine ? 'Now pick one of their players at the same position' : 'Pick one of your players';
    $('trMsg').textContent = 'They need to hit 80% to accept.'; go.disabled = true;
  }
}
$('trGo').onclick = () => {
  if (!tr.mine || !tr.theirs) return;
  const [side, i] = tr.mine.split(':'), [, j] = tr.theirs.split(':');
  const got = Season.team(tr.other)[side][+j][1];
  Season.trade(tr.other, side, +i, +j);
  Sound.td(); tr.mine = tr.theirs = null; renderTrade();
  $('trMsg').textContent = `Done. ${got} is on your team now.`;
};
