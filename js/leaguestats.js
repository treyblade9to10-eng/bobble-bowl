// ---- League Stats (every player + every team, sortable), weekly awards, Pro Bowl ballot + rosters ----
screens.push('lgStats', 'proBowl'); menuScreens.push('lgStats', 'proBowl');
(() => {
  const a = document.createElement('div'); a.id = 'lgStats'; a.className = 'screen';
  a.innerHTML = `<div class="lsHead"><h3>LEAGUE STATS</h3><span id="lsSub"></span></div><div class="lsBar"><div class="tlTabs" id="lsTabs"></div><div class="tlTabs" id="lsWho"></div></div><div id="lsBody"></div><div class="row lsBtns"><button class="gold" id="lsBack">BACK</button></div>`;
  const b = document.createElement('div'); b.id = 'proBowl'; b.className = 'screen';
  b.innerHTML = `<div class="lsHead"><h3 id="prbTitle">PRO BOWL</h3><span id="prbSub"></span></div><div id="prbBody"></div><div class="row lsBtns" id="prbBtns"></div>`;
  $('stage').appendChild(a); $('stage').appendChild(b);
})();

const LS_TABS = [['pass', 'PASSING'], ['rush', 'RUSHING'], ['rec', 'RECEIVING'], ['def', 'DEFENSE'], ['team', 'TEAMS'], ['aw', 'AWARDS']];
let lsTab = 'pass', lsMine = false, lsSort = null, lsAsc = false, lsBack = null;

const LStats = {
  // one row per player for the season (a traded player's lines add up, shown on his team now)
  players() {
    const d = Season.data, ix = Form.index(), agg = new Map();
    for (const l of Object.values(d.stats || {})) {
      const k = l.name + '|' + l.pos; let a = agg.get(k);
      if (!a) { const e = ix.find(l.t, l.name, l.pos); a = { name: l.name, pos: l.pos, t: e ? e.id : l.t, p: e ? e.p : null, g: 0 }; agg.set(k, a); }
      a.g += l.g || 0; for (const s of FORM_KEYS) a[s] = (a[s] || 0) + (l[s] || 0);
    }
    return [...agg.values()];
  },
  hasBlk() { return Object.values(Season.data.stats || {}).some(l => l.blk != null); },
  teams() {
    const d = Season.data, out = {};
    for (const t of TEAMS) { const r = d.rec[t.id] || { w: 0, l: 0, t: 0, pf: 0, pa: 0 }; out[t.id] = { id: t.id, gp: r.w + r.l + r.t, pf: r.pf, pa: r.pa, diff: r.pf - r.pa, pct: Season.pct(t.id), pass: 0, rush: 0, sack: 0, int: 0, tkl: 0 }; }
    for (const l of Object.values(d.stats || {})) { const o = out[l.t]; if (!o) continue; o.pass += l.pass || 0; o.rush += l.rush || 0; o.sack += l.sack || 0; o.int += l.int || 0; }
    for (const o of Object.values(out)) { o.tot = o.pass + o.rush; o.ypg = o.gp ? Math.round(o.tot / o.gp) : 0; o.ppg = o.gp ? +(o.pf / o.gp).toFixed(1) : 0; }
    return Object.values(out);
  }
};
const perG = (v, g) => g ? +(v / g).toFixed(1) : 0;
// [key, label, value fn, how it shows]
const LS_COLS = {
  pass: { keep: r => r.pass > 0 && r.pos === 'QB', sort: 'pass', cols: [['g', 'G'], ['pass', 'YDS'], ['ypg', 'Y/G', r => perG(r.pass, r.g), r => perG(r.pass, r.g).toFixed(1)], ['td', 'TD'], ['rush', 'RUSH']] },
  rush: { keep: r => r.rush > 0, sort: 'rush', cols: [['g', 'G'], ['rush', 'YDS'], ['ypg', 'Y/G', r => perG(r.rush, r.g), r => perG(r.rush, r.g).toFixed(1)], ['td', 'TD'], ['rec', 'REC YDS']] },
  rec: { keep: r => r.rec > 0, sort: 'rec', cols: [['g', 'G'], ['rec', 'YDS'], ['ypg', 'Y/G', r => perG(r.rec, r.g), r => perG(r.rec, r.g).toFixed(1)], ['td', 'TD']] },
  def: { keep: r => FORM_DEF.includes(r.pos) && (r.tkl || r.sack || r.int || r.blk), sort: 'tkl', cols: [['g', 'G'], ['tkl', 'TKL'], ['sack', 'SACK'], ['int', 'INT'], ['blk', 'BLK']] },
  team: { sort: 'pct', cols: [['pct', 'W-L', r => r.pct, r => recStr(r.id)], ['pf', 'PF'], ['pa', 'PA'], ['diff', 'DIFF', null, r => (r.diff > 0 ? '+' : '') + r.diff], ['ppg', 'PTS/G', null, r => r.ppg.toFixed(1)], ['ypg', 'YDS/G'], ['pass', 'PASS'], ['rush', 'RUSH'], ['sack', 'SACKS'], ['int', 'INT']] }
};
// little gold tags next to a player: Pro Bowl this year, Player of the Week count
function lsTags(t, name, p) {
  let h = '';
  if (p && ProBowl.isPro(p)) h += '<em class="fhPb">PRO BOWL</em>';
  const n = Form.potwCount(t, name); if (n) h += `<em class="fhPw">POTW${n > 1 ? ' x' + n : ''}</em>`;
  return h;
}
function lsArrow(p) { const dv = Form.delta(p); return dv ? `<em class="fhMv ${dv > 0 ? 'up' : 'dn'}">${dv > 0 ? '▲' : '▼'}${Math.abs(dv)}</em>` : ''; }

function openLeagueStats(tab, back) { if (tab) lsTab = tab; lsSort = null; lsAsc = false; lsBack = back || null; renderLeagueStats(); show('lgStats'); }
function renderLeagueStats() {
  const d = Season.data, me = d.team;
  $('lsSub').textContent = `${d.year > 1 ? `YEAR ${d.year}  ·  ` : ''}${d.phase === 'regular' ? `AFTER WEEK ${d.week} OF ${d.games}` : 'FULL SEASON  ·  PLAYOFF GAMES INCLUDED'}`;
  $('lsTabs').innerHTML = LS_TABS.map(([k, l]) => `<button data-t="${k}" class="${lsTab === k ? 'on' : ''}">${l}</button>`).join('');
  $('lsWho').innerHTML = lsTab === 'aw' || lsTab === 'team' ? '' : `<button data-m="0" class="${lsMine ? '' : 'on'}">ALL TEAMS</button><button data-m="1" class="${lsMine ? 'on' : ''}">${tName(me).toUpperCase()}</button>`;
  $('lsBody').innerHTML = lsTab === 'aw' ? lsAwards() : lsTable();
  document.querySelectorAll('#lsTabs button').forEach(b => b.onclick = () => { Sound.click(); lsTab = b.dataset.t; lsSort = null; lsAsc = false; renderLeagueStats(); $('lsBody').scrollTop = 0; });
  document.querySelectorAll('#lsWho button').forEach(b => b.onclick = () => { Sound.click(); lsMine = b.dataset.m === '1'; renderLeagueStats(); });
  document.querySelectorAll('#lsBody th[data-s]').forEach(h => h.onclick = () => { Sound.click(); if (lsSort === h.dataset.s) lsAsc = !lsAsc; else { lsSort = h.dataset.s; lsAsc = false; } renderLeagueStats(); });
  const go = $('lsVote'); if (go) go.onclick = () => { Sound.click(); openProBowl(() => openLeagueStats('aw', lsBack)); };
  $('lsBack').onclick = () => { Sound.click(); if (lsBack) lsBack(); else renderHub(); };
}
function lsTable() {
  const d = Season.data, me = d.team, C = LS_COLS[lsTab], isTeam = lsTab === 'team';
  let cols = C.cols; if (lsTab === 'def' && !LStats.hasBlk()) cols = cols.filter(c => c[0] !== 'blk');
  const val = (r, c) => c[2] ? c[2](r) : r[c[0]] || 0;
  const key = lsSort || C.sort, col = cols.find(c => c[0] === key) || cols[0];
  let rows = isTeam ? LStats.teams() : LStats.players().filter(C.keep);
  if (lsMine && !isTeam) rows = rows.filter(r => r.t === me);
  rows.sort((a, b) => (lsAsc ? -1 : 1) * (val(b, col) - val(a, col)) || (b.g || 0) - (a.g || 0));
  if (!isTeam) rows = rows.slice(0, 60);
  if (!rows.length) return `<div class="note lsNone">${lsMine ? 'Nobody on your team has stats here yet.' : 'No stats yet. Play or sim a week.'}</div>`;
  const th = cols.map(c => `<th data-s="${c[0]}" class="${c[0] === col[0] ? 'on' : ''}">${c[1]}${c[0] === col[0] ? (lsAsc ? ' ▲' : ' ▼') : ''}</th>`).join('');
  const body = rows.map((r, i) => {
    const mine = (isTeam ? r.id : r.t) === me;
    const who = isTeam ? `<td class="lsNm">${dotFor(r.id)}${Season.team(r.id).city} ${tName(r.id)}</td>`
      : `<td class="lsNm"><i>${r.pos}</i>${r.name}${lsTags(r.t, r.name, r.p)}</td><td class="lsTm">${dotFor(r.t)}${r.t}</td>`;
    return `<tr class="${mine ? 'me' : ''}"><td class="lsRk">${i + 1}</td>${who}${cols.map(c => `<td class="${c[0] === col[0] ? 'on' : ''}">${c[3] ? c[3](r) : val(r, c)}</td>`).join('')}</tr>`;
  }).join('');
  return `<table class="lsTab"><tr><th class="lsRk">#</th><th class="lsNm">${isTeam ? 'TEAM' : 'PLAYER'}</th>${isTeam ? '' : '<th class="lsTm">TM</th>'}${th}</tr>${body}</table>
    <div class="note lsNote">Tap a column to sort. ${isTeam ? 'Yards are offense. Sacks and INT are what the defense got.' : 'TD counts every touchdown he scored or threw.'}</div>`;
}
// weekly winners + Pro Bowl status
function lsAwards() {
  const d = Season.data, me = d.team, W = Form.thisYear(d.potw).slice().reverse();
  const cell = a => a ? `<td class="${a.t === me ? 'me' : ''}"><b>${a.pos} ${a.name}</b> ${dotFor(a.t)}<i>${a.t}</i><small>${a.line}</small></td>` : '<td class="dim">-</td>';
  const rk = W.some(w => w.rook && !w.rook.also); // rookies only show up once a draft class is in the league
  const wk = W.length ? `<table class="lsTab lsAw"><tr><th class="lsRk">WK</th><th>OFFENSE</th><th>DEFENSE</th>${rk ? '<th>ROOKIE</th>' : ''}</tr>${W.map(w => `<tr><td class="lsRk">${w.wk + 1}</td>${cell(w.off)}${cell(w.def)}${rk ? cell(w.rook && !w.rook.also ? w.rook : null) : ''}</tr>`).join('')}</table>`
    : `<div class="note lsNone">Players of the Week are picked after every week of the regular season.</div>`;
  return `<div class="lsAwWrap"><div class="lsAwCol"><div class="leadHead">PLAYERS OF THE WEEK</div>${wk}</div><div class="lsAwSide"><div class="leadHead">PRO BOWL</div>${prbStatus('lsVote')}</div></div>`;
}
// short Pro Bowl status (hub card + awards tab)
function prbStatus(btnId) {
  const withBtn = !!btnId;
  const d = Season.data;
  if (ProBowl.announced()) {
    const mine = d.probowl.list.filter(x => x.t === d.team);
    return `<div class="fhLine"><b>${mine.length}</b> of your players made it${mine.length ? ':' : '.'}</div>${mine.slice(0, 5).map(x => `<div class="fhRow"><span>${x.pos} ${x.name}</span><em class="fhPb">PRO BOWL</em></div>`).join('')}${withBtn ? `<button id="${btnId}" class="fhBtn">SEE PRO BOWL ROSTERS</button>` : ''}`;
  }
  if (Season.isCareer && Season.isCareer()) return '';
  if (d.phase !== 'regular') return '<div class="fhLine">No Pro Bowl vote this season.</div>';
  const b = ProBowl.ballot(), n = Object.keys(b.picks).length;
  if (!ProBowl.open()) return `<div class="fhLine">Fan voting opens after week ${ProBowl.openWeek()}.</div>`;
  if (b.done) return `<div class="fhLine">Your ballot is in (${n} of ${PB_POS.length} spots). Rosters come out after week ${d.games}.</div>${withBtn ? `<button id="${btnId}" class="fhBtn">SEE YOUR BALLOT</button>` : ''}`;
  return `<div class="fhLine"><b class="fhHot">VOTING IS OPEN.</b> Pick one player at each spot. Your votes count when the rosters come out after week ${d.games}.</div>${withBtn ? `<button id="${btnId}" class="fhBtn gold">${n ? `FINISH BALLOT (${n}/${PB_POS.length})` : 'VOTE NOW'}</button>` : ''}`;
}

// ---------------- Pro Bowl screen ----------------
let prbPos = 'QB', prbBack = null, prbPool = null;
function openProBowl(back) { prbBack = back || null; prbPool = null; const b = ProBowl.ballot(); prbPos = PB_POS.find(p => !b.picks[p]) || 'QB'; renderProBowl(); show('proBowl'); }
function renderProBowl() {
  const d = Season.data, me = d.team, done = ProBowl.announced();
  $('prbTitle').textContent = done ? `${d.year > 1 ? `YEAR ${d.year} ` : ''}PRO BOWL` : 'PRO BOWL BALLOT';
  let h = '', btns = '';
  if (done) {
    const L = d.probowl.list, col = conf => `<div class="prbConf"><div class="prbCH">${conf}</div>${PB_POS.map(pos => `<div class="prbGrp"><span class="prbPos">${pos}</span><div>${L.filter(x => x.conf === conf && x.pos === pos).map(x =>
      `<div class="prbSel${x.t === me ? ' me' : ''}">${dotFor(x.t)}<b>${x.name}</b><i>${x.t}  ·  ${x.ovr}  ·  ${x.stat}</i>${x.voted ? '<em class="fhPw">YOUR VOTE</em>' : ''}</div>`).join('')}</div></div>`).join('')}</div>`;
    const mine = L.filter(x => x.t === me).length;
    $('prbSub').textContent = mine ? `${mine} OF YOUR PLAYERS MADE IT` : 'NONE OF YOUR PLAYERS MADE IT';
    h = `<div class="prbCols">${col('AFC')}${col('NFC')}</div>`;
  } else {
    const b = ProBowl.ballot(), open = ProBowl.open(), n = Object.keys(b.picks).length;
    prbPool = prbPool || ProBowl.pool();
    $('prbSub').textContent = !open ? `VOTING OPENS AFTER WEEK ${ProBowl.openWeek()}` : b.done ? 'YOUR BALLOT IS IN' : `${n} OF ${PB_POS.length} SPOTS VOTED`;
    const tabs = `<div class="tlTabs prbTabs">${PB_POS.map(p => `<button data-p="${p}" class="${p === prbPos ? 'on' : ''}${b.picks[p] ? ' voted' : ''}">${p}</button>`).join('')}</div>`;
    const cands = ProBowl.candidates(prbPool, prbPos);
    const card = c => `<div class="prbCard${b.picks[prbPos] === c.key ? ' on' : ''}${c.t === me ? ' me' : ''}${b.done || !open ? ' lock' : ''}" data-k="${c.key}" tabindex="0" style="--tc:${Season.team(c.t).c1}">
      <span class="prbLogo">${teamBadge(Season.team(c.t))}</span><div class="prbInfo"><b>${c.name}</b><i>${c.t}  ·  ${c.conf}${c.t === me ? '  ·  YOUR TEAM' : ''}</i><span>${ProBowl.keyStat(c)}</span></div><em class="prbOvr">${c.p[3]}</em>${b.picks[prbPos] === c.key ? '<u>YOUR VOTE</u>' : ''}</div>`;
    h = `${tabs}<div class="prbHint">${PB_NAMES[prbPos]}  ·  ${open && !b.done ? 'TAP TO VOTE' : 'TOP CANDIDATES'}</div><div class="prbGrid">${cands.map(card).join('') || '<div class="note">Nobody yet.</div>'}</div>
      <div class="note prbNote">Each conference sends ${PB_POS.map(p => `${PB_SPOTS[p]} ${p}`).join(', ')}. Stats count most, then rating and team record. Your vote is a big boost.</div>`;
    if (open && !b.done) btns = `<button class="gold" id="prbSubmit"${n ? '' : ' disabled'}>SUBMIT BALLOT${n < PB_POS.length ? ` (${n}/${PB_POS.length})` : ''}</button>`;
  }
  $('prbBody').innerHTML = h;
  $('prbBtns').innerHTML = btns + '<button id="prbBack">BACK</button>';
  document.querySelectorAll('.prbTabs button').forEach(x => x.onclick = () => { Sound.click(); prbPos = x.dataset.p; renderProBowl(); });
  document.querySelectorAll('.prbCard:not(.lock)').forEach(x => x.onclick = () => {
    ProBowl.vote(prbPos, x.dataset.k); Sound.click();
    const b = ProBowl.ballot(), voted = !!b.picks[prbPos];
    renderProBowl();
    if (voted) { const nx = PB_POS.slice(PB_POS.indexOf(prbPos) + 1).concat(PB_POS).find(p => !b.picks[p]); if (nx) setTimeout(() => { if ($('proBowl').classList.contains('show')) { prbPos = nx; renderProBowl(); } }, 320); }
  });
  const sb = $('prbSubmit'); if (sb) sb.onclick = () => { ProBowl.submit(); Sound.td(); renderProBowl(); };
  $('prbBack').onclick = () => { Sound.click(); if (prbBack) prbBack(); else renderHub(); };
}
