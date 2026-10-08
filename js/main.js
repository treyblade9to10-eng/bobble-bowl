// ---- Menus, mode select, controls, play-call cards, main loop ----
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const screens = ['title', 'mode', 'how', 'select', 'playcall', 'over', 'pause', 'seasonNew', 'seasonHub', 'modes', 'miniOver'];
function show(id) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  for (const s of screens) $(s).classList.toggle('show', s === id);
  $('btnPause').style.display = (id === 'playcall' || id === null) && G.teams && !G.demo ? 'block' : 'none';
}



// ---------- Mobile / Computer mode ----------
const looksTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && Math.min(screen.width, screen.height) < 900;
let modeAfter = 'select'; // where to go after picking a mode
function setMode(m) {
  G.mode = m;
  try { localStorage.setItem('bobbleMode', m); } catch (e) {}
  document.body.classList.toggle('mobile', m === 'mobile');
  $('modeLabel').textContent = m === 'mobile' ? 'MOBILE' : 'COMPUTER';
  document.querySelectorAll('.modecard').forEach(c => c.classList.toggle('sel', c.dataset.mode === m));
  buildHow();
}
let savedMode = null; try { savedMode = localStorage.getItem('bobbleMode'); } catch (e) {}
setMode(savedMode || (looksTouch ? 'mobile' : 'computer'));
document.querySelectorAll('.modecard').forEach(c => c.onclick = () => {
  Sound.init(); Sound.click(); setMode(c.dataset.mode);
  if (c.dataset.mode === 'mobile') goFullscreen();
  if (modeAfter === 'select') { buildGrid(); show('select'); } else if (modeAfter === 'season') openSeason(); else show('title');
});
function goFullscreen() {
  const el = document.documentElement;
  try { (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}

function buildHow() {
  const m = G.mode === 'mobile';
  $('howGrid').innerHTML = m ? `
    <div><h3>Offense</h3>
      <p><b>Tap a play</b>, then <b>tap the field</b> to snap.</p>
      <p><b>Pass:</b> put your finger down, <b>DRAG BACK</b> (like a slingshot) and let go. Pull further = throw further. The yellow ring shows where it lands.</p>
      <p>Or just <b>tap a receiver's ▲</b> to throw to him.</p>
      <p><b>RUN</b> button = QB takes off.</p></div>
    <div><h3>Running</h3>
      <p>Your runner <b>runs on his own</b>. <b>Hold your finger</b> where you want him to go.</p>
      <p><b>Tap</b> = juke. <b>SPIN</b> and <b>STIFF</b> arm buttons break tackles.</p></div>
    <div><h3>Defense</h3>
      <p><b>Hold</b> to move your player (yellow ring). Let go and he plays on his own.</p>
      <p><b>Tap near the runner</b> = dive tackle. <b>Tap a teammate</b> to switch to him.</p></div>`
  : `
    <div><h3>Offense</h3>
      <p><b>Pick a play</b> (1-9), <b>SPACE</b> to snap.</p>
      <p>Throw: <b>1 2 3 4</b>, <b>click</b> a receiver, or <b>drag back with the mouse</b> and let go to throw to that spot.</p>
      <p>Move the QB with <b>WASD</b>; run past the line to scramble.</p></div>
    <div><h3>Running</h3>
      <p><b>WASD</b> move, <b>SHIFT</b> sprint.</p>
      <p><b>E</b> juke, <b>F</b> spin, <b>R</b> stiff arm.</p></div>
    <div><h3>Defense</h3>
      <p>You control the player with the <b>yellow ring</b>.</p>
      <p><b>Q</b> switch to the guy closest to the ball, <b>SPACE</b> dive tackle, <b>SHIFT</b> sprint.</p></div>
    <div><h3>2 Players</h3>
      <p>Pick <b>2 Players</b> on the matchup screen. Each of you calls a play in secret.</p>
      <p><b>P1:</b> WASD, SPACE, SHIFT, 1-4 throw, E/F/R moves, Q switch, C hit stick.</p>
      <p><b>P2:</b> ARROWS, ENTER, RIGHT SHIFT, 7 8 9 0 throw, / . , moves, L switch, K hit stick.</p></div>`;
  $('howGrid').innerHTML += `
    <div><h3>Arm strength</h3>
      <p>Every QB has a <b>max range</b> based on his rating. Aim past it and the marker turns red, and the ball dies short.</p>
      <p>Low-rated QBs miss more, especially deep, on the run, or with a rusher in their face.</p></div>
    <div><h3>X-Factors</h3>
      <p>Stars have a special ability. String together big plays and they get <b>in the zone</b> (orange glow).</p>
      <p>A bad play, or 8 snaps, knocks them out of it.</p></div>
    <div><h3>My Player</h3>
      <p>Create your own guy, put him on any team, and play games with that team to earn XP and level him up.</p></div>`;
}

// ---------- title ----------
$('btnPlay').onclick = () => { Sound.init(); Sound.click(); modeAfter = 'select'; show('mode'); };
$('btnMode').onclick = () => { Sound.init(); modeAfter = 'title'; show('mode'); };
$('btnHow').onclick = () => { Sound.init(); show('how'); };
$('btnHowBack').onclick = () => show('title');
$('btnMute').onclick = () => { Sound.muted = !Sound.muted; $('btnMute').classList.toggle('off', Sound.muted); };

// ---------- team select: AWAY (left) vs HOME (right), arrows to scroll ----------
function teamOvr(t) { const all = t.off.concat(t.def); return Math.round(all.reduce((a, p) => a + p[3], 0) / all.length); }
const sel = { idx: [TEAMS.findIndex(t => t.id === 'KC'), TEAMS.findIndex(t => t.id === 'PHI')], you: 0 }; // idx[0] = home, idx[1] = away
try { const saved = JSON.parse(localStorage.getItem('bobbleSel') || 'null'); if (saved) Object.assign(sel, saved); } catch (e) {}
function teamCard(t) {
  t = Career.withCAP(t);
  const xfs = teamXFactors(t);
  const ovr = teamOvr(t), offO = Math.round(t.off.reduce((a, p) => a + p[3], 0) / 8), defO = Math.round(t.def.reduce((a, p) => a + p[3], 0) / 8);
  const stars = t.off.concat(t.def).slice().sort((a, b) => b[3] - a[3]).slice(0, 5);
  return `<div class="ab">${t.id}</div><div class="nm">${t.city}<br>${t.name}</div>
    <div class="ov">${ovr} OVR</div><div style="font-size:12px;margin-bottom:6px;text-shadow:1px 1px 0 #000">OFF ${offO} • DEF ${defO}</div>
    <div class="stars">${stars.map(p => `<div>${p[0]} <b>${p[3]}</b> #${p[2]} ${p[1]}</div>`).join('')}</div>
    ${xfs.length ? `<div class="xfl"><span>X-FACTOR</span> ${xfs.map(x => lastName(x.name)).join(', ')}</div>` : ''}
    <div class="cnt">${TEAMS.findIndex(x => x.id === t.id) + 1} / ${TEAMS.length}</div>`;
}
function renderSelect(bumpSide) {
  for (const [side, id] of [[0, 'pHome'], [1, 'pAway']]) {
    const t = TEAMS[sel.idx[side]], el = $(id).querySelector('.tbig');
    el.innerHTML = teamCard(t);
    el.style.background = `linear-gradient(160deg, ${t.c1} 55%, ${t.c2})`; el.style.color = textOn(t.c1);
    const who = $(id).querySelector('.who');
    const two = $('optPlayers').value === '2' && G.mode !== 'mobile';
    who.textContent = sel.you === side ? (two ? 'P1' : 'YOU') : (two ? 'P2' : 'CPU'); who.className = 'who ' + (sel.you === side ? 'you' : two ? 'p2' : 'cpu');
    if (bumpSide === side) { el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 120); }
  }
  $('selHint').textContent = G.mode === 'mobile' ? 'Tap the arrows to change teams' : $('optPlayers').value === '2' ? 'P1: WASD move, SPACE snap/dive, SHIFT sprint, 1-4 throw, E/F/R moves, Q switch      P2: ARROWS, ENTER, RIGHT SHIFT, 7-0 throw, / . , moves, L switch' : 'W / S  away team      ↑ / ↓  home team      ENTER  kickoff';
  try { localStorage.setItem('bobbleSel', JSON.stringify(sel)); } catch (e) {}
}
function moveTeam(side, d) {
  let i = sel.idx[side];
  do { i = (i + d + TEAMS.length) % TEAMS.length; } while (i === sel.idx[1 - side]);
  sel.idx[side] = i; Sound.click(); renderSelect(side);
}
document.querySelectorAll('.arr').forEach(b => b.onclick = () => moveTeam(+b.dataset.side, +b.dataset.d));
$('btnSwap').onclick = () => { sel.you = 1 - sel.you; Sound.click(); renderSelect(); };
document.querySelectorAll('.tbig').forEach((el, i) => el.addEventListener('wheel', e => { e.preventDefault(); moveTeam(el.closest('#pHome') ? 0 : 1, e.deltaY > 0 ? 1 : -1); }, { passive: false }));
window.addEventListener('keydown', e => {
  if (!$('select').classList.contains('show')) return;
  if (e.code === 'KeyW') moveTeam(1, -1); if (e.code === 'KeyS') moveTeam(1, 1);
  if (e.code === 'ArrowUp') moveTeam(0, -1); if (e.code === 'ArrowDown') moveTeam(0, 1);
  if (e.code === 'Enter') startGame();
});
function buildGrid() { renderSelect(); }
$('btnBackSel').onclick = () => show('title');
$('btnKick').onclick = startGame;

// uniforms / weather / time pickers
const fillSel = (id, list, val) => { $(id).innerHTML = list.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); if (val != null) $(id).value = val; };
fillSel('optUni0', UNIFORMS, 'home');
$('optPlayers').onchange = () => renderSelect(); fillSel('optUni1', UNIFORMS, 'away'); fillSel('optWeather', WEATHER, 'clear');
try { const o = JSON.parse(localStorage.getItem('bobbleOpts') || 'null'); if (o) for (const k in o) if ($(k)) $(k).value = o[k]; } catch (e) {}
function saveOpts() { const o = {}; for (const k of ['optUni0', 'optUni1', 'optWeather', 'optNight', 'optQtr', 'optDiff', 'optPlayers']) o[k] = $(k).value; try { localStorage.setItem('bobbleOpts', JSON.stringify(o)); } catch (e) {} }

function startGame() {
  Sound.init(); Sound.whistle(); Sound.crowd(false);
  if (G.mode === 'mobile') goFullscreen();
  saveOpts();
  G.demo = false; G.season = false; G.challenge = null; G.mini = null; show(null);
  newGame(TEAMS[sel.idx[0]], TEAMS[sel.idx[1]], { qtr: +$('optQtr').value, diff: +$('optDiff').value, humanSide: sel.you,
    weather: pickWeather($('optWeather').value), night: $('optNight').value === '1', uni: [$('optUni0').value, $('optUni1').value],
    versus: $('optPlayers').value === '2' && G.mode !== 'mobile' });
}

// ---------- play calling ----------
let pcList = [];
function onPlayCall(c) {
  const humanOff = c.mode === 'off';
  pcCtx = c;
  const who = G.versus ? `<span class="vsTag p${c.side === G.p1 ? 1 : 2}">${pName(c.side)}</span>` : '';
  if (c.mode === 'kickoff') {
    $('pcHead').innerHTML = who + 'KICKOFF <span class="pcsub">You kick to them</span>';
    pcList = [{ key: 'ko', name: 'Kickoff', desc: 'Boom it deep, then cover the return!', special: true },
              { key: 'onside', name: 'Onside Kick', desc: 'Short hop. Try to steal the ball back.', special: true }];
  } else if (c.mode === 'pat') {
    $('pcHead').innerHTML = who + 'TOUCHDOWN <span class="pcsub">Kick the extra point or go for two</span>';
    pcList = [{ key: 'xp', name: 'Extra Point', desc: 'Easy kick for 1 point.', special: true },
              { key: 'two', name: 'Go For 2', desc: 'One play from the 3-yard line.', special: true }];
  } else {
    $('pcHead').innerHTML = `${who}${humanOff ? 'OFFENSE' : 'DEFENSE'} <span class="pcsub">${G.downText()}</span>`;
    pcList = humanOff ? OFF_PLAYS.slice() : DEF_PLAYS.slice();
    if (humanOff && !c.twoPt) {
      const sp = [];
      if (c.fourth) sp.push(SPECIAL_PLAYS[0]);
      if (c.fourth) sp.push(FAKE_PLAYS[0]);
      if (c.fourth && c.fgDist <= c.fgMax + 8) sp.push(FAKE_PLAYS[1]);
      // field goal: any down, as long as it's not hopeless
      if (c.fgDist <= c.fgMax + 8) sp.push({ ...SPECIAL_PLAYS[1], name: `${c.fgDist} yd FG`, desc: c.fgDist > c.fgMax ? 'Past his range. Long shot.' : c.fgDist > c.fgMax - 8 ? 'Long kick. Nail the meter!' : 'Kick it through for 3.' });
      pcList = sp.concat(pcList);
    }
  }
  pcCoach = coachPick(c, pcList);
  // coach pick goes to the front (after kicks) so it's always on page 1
  const ci = pcList.findIndex(p => p.key === pcCoach), nSpec = pcList.filter(p => p.special).length;
  if (ci > nSpec) pcList.splice(nSpec, 0, pcList.splice(ci, 1)[0]);
  pcOff = humanOff; pcPage = 0;
  renderCards();
  show('playcall');
  // 2-player: hide the cards until the right player is looking
  const cover = $('pcCover');
  if (G.versus) {
    const other = pName(1 - c.side);
    cover.innerHTML = `<div class="vsTag big p${c.side === G.p1 ? 1 : 2}">${pName(c.side)}</div><div class="cvT">${c.mode === 'off' ? 'OFFENSE' : c.mode === 'def' ? 'DEFENSE' : c.mode === 'pat' ? 'EXTRA POINT' : 'KICKOFF'}: YOUR CALL</div>
      <div class="cvS">${other}, look away.</div><button class="big" id="pcReveal">SHOW MY PLAYS</button>`;
    cover.classList.add('on');
    $('pcReveal').onclick = () => { cover.classList.remove('on'); Sound.click(); };
  } else cover.classList.remove('on');
}
let pcPage = 0, pcCoach = null, pcOff = true, pcCtx = {};
const PER_PAGE = 10;
function renderCards() {
  const pages = Math.max(1, Math.ceil(pcList.length / PER_PAGE));
  pcPage = clamp(pcPage, 0, pages - 1);
  const list = pcList.slice(pcPage * PER_PAGE, pcPage * PER_PAGE + PER_PAGE);
  const box = $('pcCards'); box.innerHTML = '';
  const cols = Math.max(2, Math.ceil(list.length / 2));
  box.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  box.style.width = `min(${cols * 200}px, calc(100vw - 20px))`;
  list.forEach((p, j) => {
    const i = pcPage * PER_PAGE + j;
    const el = document.createElement('div');
    el.className = 'pcard' + (p.special ? ' special' : '') + (p.key === pcCoach ? ' coach' : '');
    const kind = p.type === 'run' ? 'run' : p.type === 'pass' ? 'pass' : p.special ? 'kick' : '';
    const label = G.mode === 'mobile' ? (kind === 'run' ? 'RUN' : kind === 'pass' ? 'PASS' : kind === 'kick' ? 'KICK' : 'D') : (j + 1) % 10;
    el.innerHTML = `${p.key === pcCoach ? '<span class="cp">COACH PICK</span>' : ''}<span class="k ${kind}">${label}</span><div class="t">${p.name}</div>`;
    const mini = document.createElement('canvas'); mini.width = 120; mini.height = 72;
    if (p.key === 'xp' || p.key === 'two') { const g = mini.getContext('2d'); g.fillStyle = '#3a8a3c'; g.fillRect(0, 0, 120, 72); g.font = "italic 900 34px 'Barlow Condensed', sans-serif"; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(p.key === 'xp' ? '+1' : '+2', 60, 48); }
    else drawPlayDiagram(mini, p, pcOff);
    el.appendChild(mini);
    const d = document.createElement('div'); d.className = 'd'; d.textContent = p.desc; el.appendChild(d);
    let sx0 = 0;
    el.addEventListener('pointerdown', e => { sx0 = e.clientX; });
    el.addEventListener('click', e => { if (Math.abs(e.clientX - sx0) < 12) choose(i); });
    box.appendChild(el);
  });
  const hint = $('pcHint'); hint.innerHTML = '';
  if (pages > 1) {
    const mk = (txt, d) => { const b = document.createElement('button'); b.className = 'pgbtn'; b.textContent = txt; b.onclick = () => { pcPage = (pcPage + d + pages) % pages; Sound.click(); renderCards(); }; return b; };
    hint.appendChild(mk('‹ PREV', -1));
    const t = document.createElement('span'); t.className = 'pgtxt'; t.textContent = `PAGE ${pcPage + 1} / ${pages}`; hint.appendChild(t);
    hint.appendChild(mk('NEXT ›', 1));
  }
  // clock tools
  const tool = (txt, fn) => { const b = document.createElement('button'); b.className = 'pgbtn tool'; b.textContent = txt; b.onclick = fn; hint.appendChild(b); };
  const tos = pcCtx.side != null ? pcCtx.side : G.human;
  if ((pcCtx.mode === 'off' || pcCtx.mode === 'def') && G.timeouts && G.timeouts[tos] > 0 && G.pendingRunoff > 0) tool(`TIMEOUT (${G.timeouts[tos]})`, () => { if (callTimeout(tos)) renderCards(); });
  if (pcCtx.mode === 'off' && G.down < 4 && G.pendingRunoff > 0) tool('SPIKE', () => { show(null); spikeBall(); });
  const last = G.versus ? (pcCtx.mode === 'off' ? (G.lastOffKeys || [])[pcCtx.side] : pcCtx.mode === 'def' ? (G.lastDefKeys || [])[pcCtx.side] : null) : pcCtx.mode === 'off' ? G.lastOffKey : pcCtx.mode === 'def' ? G.lastDefKey : null;
  const li = last ? pcList.findIndex(p => p.key === last) : -1;
  if (li >= 0) tool('LAST PLAY', () => choose(li));
  const tip = document.createElement('span'); tip.className = 'pgtip';
  tip.textContent = G.mode === 'mobile' ? '' : `1-${Math.min(PER_PAGE, list.length) % 10 || 0} to pick     ← → pages`;
  hint.appendChild(tip);
}
G.hooks.onPlayCall = c => { if (!G.demo) onPlayCall(c); };
G.hooks.onClockOut = () => { if ($('playcall').classList.contains('show')) show(null); };
// a simple suggestion so new players always have a good default
function coachPick(c, list) {
  const has = k => list.some(p => p.key === k);
  if (c.mode === 'pat') return 'xp';
  if (c.mode === 'kickoff') return G.quarter >= 4 && G.clock < 150 && G.score[1 - G.human] - G.score[G.human] > 0 && G.score[1 - G.human] - G.score[G.human] <= 16 ? 'onside' : 'ko';
  if (c.mode === 'off') {
    if (c.fourth) { if (has('fg') && c.fgDist <= c.fgMax - 2) return 'fg'; if (c.toGo <= 1) return 'zone'; return has('punt') ? 'punt' : 'slants'; }
    if (c.kneel) return 'kneel';
    if (c.toGo <= 1) return pick(['sneak', 'power']);
    if (c.toGo <= 2) return 'zone';
    if (c.toGo >= 12) return pick(['verts', 'pa']);
    if (c.toGo >= 7) return pick(['curls', 'mesh', 'slants']);
    return pick(['slants', 'toss', 'screen', 'zone']);
  }
  if (c.down === 4 && c.toGo > 2) return 'alldrop';
  if (c.toGo <= 2) return 'run';
  if (c.toGo >= 15) return 'prevent';
  if (c.down === 3) return pick(['blitz', 'man']);
  return pick(['c3', 'c2', 'man']);
}
function choose(i) {
  const p = pcList[i]; if (!p || G.phase !== 'playcall') return;
  if (G.patSide == null && p.key === 'xp') return;
  if (p.key === 'ko' || p.key === 'onside') { show(null); Sound.click(); return chooseKickoff(p.key); }
  Sound.click();
  show(null);
  if (p.key === 'xp' || p.key === 'two') choosePAT(p.key);
  else if (G.versus && pcCtx.mode === 'off' && !p.special) { // now the defense picks
    G.vsOff = p.key;
    setTimeout(() => onPlayCall({ ...withSide(1 - G.poss, playCallCtx), side: 1 - G.poss }), 60);
  } else if (G.versus && pcCtx.mode === 'def') choosePlay(G.vsOff, p.key);
  else choosePlay(p.key);
}
window.addEventListener('keydown', e => {
  if (!$('playcall').classList.contains('show')) return;
  if ($('pcCover').classList.contains('on')) { if (e.code === 'Space' || e.code === 'Enter') $('pcReveal').onclick(); return; }
  if (e.code === 'KeyT' && G.timeouts && G.pendingRunoff > 0) { if (callTimeout(G.human)) renderCards(); return; }
  if (e.code === 'Enter') { const last = pcCtx.mode === 'off' ? G.lastOffKey : G.lastDefKey; const li = pcList.findIndex(p => p.key === last); if (li >= 0) choose(li); return; }
  if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { const pages = Math.ceil(pcList.length / PER_PAGE); pcPage = (pcPage + (e.code === 'ArrowRight' ? 1 : -1) + pages) % pages; renderCards(); return; }
  const n = parseInt(e.key, 10);
  if (isNaN(n)) return;
  const i = pcPage * PER_PAGE + (n === 0 ? 9 : n - 1);
  if (i < Math.min(pcList.length, (pcPage + 1) * PER_PAGE)) choose(i);
});

// ---------- game over / YOU WIN ----------
let mvpAnim = null;
G.hooks.onGameOver = s => {
  if (G.demo) return;
  const me = s.human, them = 1 - me;
  const won = s.score[me] > s.score[them], tie = s.score[me] === s.score[them];
  $('over').classList.toggle('win', won);
  $('overTitle').textContent = G.versus ? (tie ? 'TIE GAME' : `${s.score[G.p1] > s.score[1 - G.p1] ? 'PLAYER 1' : 'PLAYER 2'} WINS`) : won ? 'YOU WIN!' : tie ? 'TIE GAME' : 'GAME OVER';
  const tag = t => `<span style="color:${t.c1 === '#000000' ? '#aaa' : t.c1};-webkit-text-stroke:1px #fff">${t.id}</span>`;
  $('overScore').innerHTML = `${tag(s.teams[1])} ${s.score[1]} - ${s.score[0]} ${tag(s.teams[0])}`;
  const line = (lbl, p, k, suf) => p ? `<div>${lbl}: <b>${p.name}</b> — ${p[k]} ${suf}</div>` : '';
  let html = '';
  for (const side of [me, them]) {
    const L = s.leaders[side], t = s.teams[side];
    html += `<div style="margin-bottom:8px"><b style="color:#ffd23f">${t.city} ${t.name}</b> — ${s.tstats[side].pass} pass yds, ${s.tstats[side].rush} rush yds, ${s.tstats[side].to} turnovers` +
      line('Passing', L.pass, 'pass', 'yds') + line('Rushing', L.rush, 'rush', 'yds') + line('Receiving', L.rec, 'rec', 'yds') +
      line('Tackles', L.tkl, 'tkl', '') + line('Sacks', L.sack, 'sack', '') + line('INTs', L.int, 'int', '') + '</div>';
  }
  $('overStats').innerHTML = html;
  // my player XP + trophy case
  const cr = !G.challenge && !G.mini ? Career.afterGame(s) : null;
  Career.gameDone(s);
  $('overCap').innerHTML = cr ? `MY PLAYER <b>${Career.cap.name}</b>: ${cr.line}. <b>+${cr.xp} XP</b>${cr.ups ? `<span class="lvl">OVR ${cr.before} → ${cr.after}</span>` : ''}` : '';
  // MVP: best performer on the winning team (or yours if tied)
  const mvpSide = won || tie ? me : them;
  const score = p => p.pass / 20 + p.rush / 8 + p.rec / 8 + p.td * 6 + p.tkl * 1.5 + p.sack * 4 + p.int * 6;
  const cand = Object.values(G.pstats || {}).filter(p => p.side === mvpSide).sort((a, b) => score(b) - score(a))[0];
  drawMvp(cand, mvpSide);
  // confetti
  const box = $('confetti'); box.innerHTML = '';
  if (won) for (let i = 0; i < 70; i++) {
    const c = document.createElement('i'); const t = s.teams[me];
    c.style.left = Math.random() * 100 + '%'; c.style.background = pick([t.c1, t.c2, '#fff', '#ffd23f']);
    c.style.animationDuration = (2 + Math.random() * 3) + 's'; c.style.animationDelay = (-Math.random() * 5) + 's';
    box.appendChild(c);
  }
  Sound[won ? 'td' : 'bad']();
  const inSeason = !!G.season;
  const ch = challengeResult(s);
  $('overChal').textContent = ch ? ch.text : '';
  $('overChal').style.color = ch ? (ch.ok ? '#9cff9c' : '#ff8a8a') : '';
  if (ch && ch.ok) $('overTitle').textContent = G.challenge.type === '2min' ? 'DRIVE COMPLETE!' : 'CHALLENGE COMPLETE!';
  $('btnAgain').textContent = G.challenge ? 'TRY AGAIN' : 'REMATCH';
  $('btnNewTeams').textContent = G.challenge ? 'CHALLENGES' : 'NEW TEAMS';
  if (inSeason) { Season.addPlayedStats(G.pstats, G.teams); seasonGameDone(s.score); }
  $('btnSeasonCont').style.display = inSeason ? '' : 'none';
  $('btnAgain').style.display = $('btnNewTeams').style.display = inSeason ? 'none' : '';
  if (inSeason && G.playoff && won) $('overTitle').textContent = Season.data.phase === 'done' ? 'CHAMPIONS' : 'YOU ADVANCE!';
  setTimeout(() => show('over'), 1400);
};
function drawMvp(st, side) {
  const cvm = $('mvpCv'), g = cvm.getContext('2d');
  cancelAnimationFrame(mvpAnim);
  if (!st) { $('mvpBox').style.display = 'none'; return; }
  $('mvpBox').style.display = '';
  const t = G.teams[side];
  const all = t.off.map((p, i) => [p, true, i]).concat(t.def.map((p, i) => [p, false, i]));
  const found = all.find(([p]) => p[1] === st.name) || all[0];
  const p = makePlayer(side, found[1], found[2], found[0]);
  p.celebrate = 1e9; p.face.dir = 1; p.headScale = 1.15;
  const bits = [];
  if (st.pass) bits.push(`${st.pass} pass yds`); if (st.rush) bits.push(`${st.rush} rush yds`); if (st.rec) bits.push(`${st.rec} rec yds`);
  if (st.td) bits.push(`${st.td} TD`); if (st.tkl) bits.push(`${st.tkl} tkl`); if (st.sack) bits.push(`${st.sack} sacks`); if (st.int) bits.push(`${st.int} INT`);
  $('mvpText').innerHTML = `<b>${st.name}</b> • ${st.pos} • ${t.name}<br>${bits.join(' • ')}`;
  const fake = { teams: G.teams, ball: null, phase: 'over', human: G.human, mode: G.mode, time: 0 };
  const loop = () => {
    fake.time = performance.now() / 1000; p.anim += 0.05; p.speedNow = 0;
    g.clearRect(0, 0, 260, 300);
    const bg = g.createRadialGradient(130, 150, 10, 130, 150, 150); bg.addColorStop(0, t.c1 + 'aa'); bg.addColorStop(1, '#0000');
    g.fillStyle = bg; g.fillRect(0, 0, 260, 300);
    g.save(); g.scale(2.6, 2.6); drawPlayer(g, p, fake, { x: 50, y: 108 }); g.restore();
    if ($('over').classList.contains('show')) mvpAnim = requestAnimationFrame(loop);
  };
  setTimeout(loop, 1450);
}
$('btnAgain').onclick = () => { const c = G.challenge; show(null); if (c) runChallenge(c.type); else startGame(); };
$('btnNewTeams').onclick = () => { const c = G.challenge; G.teams = null; G.challenge = null; if (c) openModes(); else { renderSelect(); show('select'); } };

// ---------- pause ----------
function togglePause() {
  if (!G.teams || G.phase === 'over' || G.demo) return;
  G.paused = !G.paused;
  if (G.paused) { G.pauseFrom = $('playcall').classList.contains('show') ? 'playcall' : null; $('pausePbp').innerHTML = pbpHtml(8); show('pause'); }
  else show(G.pauseFrom);
}
$('btnPause').onclick = togglePause;
$('btnResume').onclick = togglePause;
const replayLabel = () => { $('btnReplayOpt').textContent = 'INSTANT REPLAYS: ' + (Replay.enabled ? 'ON' : 'OFF'); };
replayLabel();
$('btnReplayOpt').onclick = () => { Replay.setEnabled(!Replay.enabled); replayLabel(); };
$('btnQuit').onclick = () => {
  G.paused = false; G.teams = null; G.phase = 'idle';
  if (G.season) { G.season = false; openSeason(); } else if (G.challenge || G.mini) { G.challenge = null; G.mini = null; openModes(); } else show('title');
};
window.addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP') togglePause(); });

// ---------- mouse / finger on the field ----------
function toCanvas(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * CW / r.width, y: (e.clientY - r.top) * CH / r.height }; }
let activeId = null;
cv.addEventListener('pointerdown', e => {
  Sound.init();
  if (activeId !== null) return;
  activeId = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  const p = toCanvas(e), P = Input.pointer;
  Object.assign(P, { down: true, x: p.x, y: p.y, x0: p.x, y0: p.y, t: 0, moved: false, aiming: false, start: performance.now() });
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== activeId) return;
  const p = toCanvas(e), P = Input.pointer;
  P.x = p.x; P.y = p.y;
  if (Math.hypot(P.x - P.x0, P.y - P.y0) > 14) P.moved = true;
});
const endPointer = e => {
  if (e.pointerId !== activeId) return;
  activeId = null;
  const P = Input.pointer;
  const quick = performance.now() - P.start < 260;
  if (P.aiming) { Input.release = { x: P.x0 - P.x, y: P.y0 - P.y }; Input.flick = performance.now() - P.start < 330; }
  else if (!P.moved && quick) Input.taps.push({ x: P.x, y: P.y });
  P.down = false; P.moved = false; P.aiming = false;
};
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('contextmenu', e => e.preventDefault());

// joystick (mobile)
(function joystick() {
  const joy = $('joy'), knob = $('joyKnob'); let id = null;
  const set = e => {
    const r = joy.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return; // stick is hidden (pitch / pass in the air): a 0-wide box would divide by zero = NaN players
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    if (!isFinite(x) || !isFinite(y)) return;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    Input.stick.x = x; Input.stick.y = y; Input.stick.m = Math.min(1, m);
    knob.style.left = (43 + x * 45) + 'px'; knob.style.top = (43 + y * 45) + 'px';
  };
  const reset = () => { id = null; Input.stick.x = Input.stick.y = Input.stick.m = 0; knob.style.left = knob.style.top = '43px'; };
  joy.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; try { joy.setPointerCapture(id); } catch (_) {} set(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
  joy.addEventListener('pointerup', e => { if (e.pointerId === id) reset(); });
  joy.addEventListener('pointercancel', reset);
  joy.addEventListener('lostpointercapture', reset);
})();

// mobile buttons
document.querySelectorAll('#mbtns button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Input.press(k); });
  b.addEventListener('pointerup', e => { e.preventDefault(); Input.release_(k); });
});
let mbState = '';
function updateMobileButtons() {
  if (G.mode !== 'mobile') return;
  const h = G.humanPlayer, b = G.ball;
  let st = '';
  if (G.phase === 'live' && h && b && !G.demo) {
    if (humanCanThrow()) st = 'qb';
    else if (b.holder === h) st = 'carrier';
    else if (h.side !== G.poss || (b.holder && b.holder.side !== h.side)) st = 'def';
  }
  if (G.phase === 'dead' && G.cellyGuy && !G.demo) st = 'celly';
  if (G.phase === 'presnap' && !G.demo) st = 'presnap';
  const joyOn = G.phase === 'live' && !G.demo && h && (st === 'def' || st === 'carrier');
  $('joy').classList.toggle('on', !!joyOn);
  if (!joyOn && Input.stick.m) { Input.stick.x = Input.stick.y = Input.stick.m = 0; $('joyKnob').style.left = $('joyKnob').style.top = '43px'; }
  const key = st + (b && b.flight ? 'air' : '') + (h && h.engaged ? 'eng' : '');
  if (key === mbState) return;
  mbState = key;
  document.querySelectorAll('#mbtns button').forEach(x => x.classList.toggle('on', x.dataset.show === st));
  $('mbDive').textContent = b && b.flight ? 'JUMP' : 'DIVE';
  $('mbSwim').style.display = st === 'def' && h && h.engaged ? 'block' : 'none';
  $('mbTO').style.display = st === 'presnap' && G.timeouts && G.timeouts[G.human] > 0 && G.pendingRunoff > 0 ? 'block' : 'none';
}

// (season mode screens live in seasonui.js)

// ---------- CHALLENGES & MINI-GAMES ----------
const myIdx = () => sel.idx[sel.you];
$('btnModes').onclick = () => { Sound.init(); Sound.click(); openModes(); };
$('mdBack').onclick = () => show('title');
$('mdPrev').onclick = () => { sel.idx[sel.you] = (myIdx() + 31) % 32; if (sel.idx[0] === sel.idx[1]) sel.idx[sel.you] = (myIdx() + 31) % 32; Sound.click(); openModes(); };
$('mdNext').onclick = () => { sel.idx[sel.you] = (myIdx() + 1) % 32; if (sel.idx[0] === sel.idx[1]) sel.idx[sel.you] = (myIdx() + 1) % 32; Sound.click(); openModes(); };
function openModes() {
  G.mini = null; G.challenge = null;
  const R = Records.get(), d = dailyToday(), t = TEAMS[myIdx()];
  $('mdTeamName').textContent = `Your team: ${t.city} ${t.name}`;
  const done = R.daily && R.daily.done && R.daily.done[d.date];
  const cards = [
    ['2min', '01', 'TWO-MINUTE DRILL', 'Down by up to a touchdown, 2:00 left, ball on your 25.', R.twoMin ? `Record: ${R.twoMin.wins}/${R.twoMin.tries}` : ''],
    ['daily', '02', 'DAILY CHALLENGE', `${TEAMS[d.mine].name} vs ${TEAMS[d.opp].name}: ${d.goal.text}`, done ? 'Done today' + (R.daily.streak ? `, ${R.daily.streak} day streak` : '') : (R.daily && R.daily.streak ? `${R.daily.streak} day streak` : 'New one every day')],
    ['qb', '03', 'QB TARGETS', '45 seconds to hit targets downfield. Bullseyes are worth 300.', R.qb ? `High score: ${R.qb}` : ''],
    ['kick', '04', 'KICKING CONTEST', 'Start at 25 yards, back up 5 every make. 2 misses = out.', R.kick ? `Longest: ${R.kick} yds` : ''],
    ['dash', '05', '40-YARD DASH', 'Mash ← → (or tap) to race your fastest player.', R.dash && R.dash < 99 ? `Best: ${R.dash}s` : '']
  ];
  $('mdCards').innerHTML = cards.map(([k, i, tt, dd, rr]) => `<div class="mdcard" data-k="${k}"><div class="mi">${i}</div><div class="mt">${tt}</div><div class="md">${dd}</div><div class="mr">${rr}</div></div>`).join('');
  document.querySelectorAll('.mdcard').forEach(c => c.onclick = () => runChallenge(c.dataset.k));
  show('modes');
}
function runChallenge(k) {
  Sound.init(); Sound.whistle();
  if (G.mode === 'mobile') goFullscreen();
  G.demo = false; G.season = false; G.challenge = null; G.mini = null; show(null);
  if (k === '2min') startTwoMinute(myIdx());
  else if (k === 'daily') startDaily();
  else if (k === 'qb') startQBTargets(myIdx());
  else if (k === 'kick') startKickContest(myIdx());
  else if (k === 'dash') startDash(myIdx());
  G.lastMini = k;
}
G.hooks.onMiniOver = r => {
  $('moTitle').textContent = r.title; $('moBig').textContent = r.big; $('moSub').textContent = r.sub; $('moBest').textContent = r.best;
  if (r.best.includes('NEW')) Sound.td(); else Sound.click();
  setTimeout(() => show('miniOver'), 600);
};
$('moRetry').onclick = () => runChallenge(G.lastMini);
$('moBack').onclick = () => { G.mini = null; G.teams = null; openModes(); };

// ---------- title screen background: a fake game ----------
function demoSetup() {
  const a = pick(TEAMS); let b; do { b = pick(TEAMS); } while (b === a);
  Object.assign(G, { teams: [a, b], human: -1, diff: 1, poss: 0, los: rand(30, 70), ballY: MID, down: 1, score: [0, 0], quarter: 1, clock: 180, demo: true, fx: [], weather: 'clear', night: false, uni: null, versus: false, xf: null,
    pstats: {}, tstats: [{ pass: 0, rush: 0, to: 0 }, { pass: 0, rush: 0, to: 0 }], patSide: null, twoPt: false, next: null, paused: false, slowmo: 0, banner: null });
  setFirstDown();
  setupPlay(pick(OFF_PLAYS), pick(DEF_PLAYS));
  snap();
}

// ---------- main loop ----------
const menuScreens = ['title', 'how', 'select', 'mode', 'seasonNew', 'seasonHub', 'modes', 'miniOver', 'cap', 'trophies'];
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); // schedule first so one bad frame can't freeze the game
  try { step(now); } catch (e) { console.error(e); if (G.demo) G.phase = 'over'; }
}
function step(now) {
  const dt = clamp((now - last) / 1000, 0, 0.033); last = now;
  if (Input.pointer.down) Input.pointer.t += dt;
  Input.versus = !!G.versus && !G.demo; if (!Input.versus) Input.ctl = 0;
  const inMenu = menuScreens.some(id => $(id).classList.contains('show')) && !(G.mini && $('miniOver').classList.contains('show'));
  if (inMenu) {
    if (!G.demo || G.phase === 'over') demoSetup();
    if (G.phase === 'live' && G.play.t > 7) G.phase = 'dead';
    if ((G.phase === 'dead' && G.deadT < 0.4) || G.phase === 'playcall' || G.phase === 'kick') demoSetup();
    G.next = null;
    Input.taps.length = 0; Input.release = null;
    update(dt);
  } else {
    if (G.demo) G.demo = false;
    update(dt);
  }
  updateMobileButtons();
  render();
  Input.endFrame();
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, CW, CH);
  if (cam.shake > 0.3) ctx.translate(rand(-cam.shake, cam.shake), rand(-cam.shake, cam.shake));
  if (G.teams) {
    drawField(ctx, G);
    drawWeatherGround(ctx, G);
    drawLines(ctx, G);
    drawRoutes(ctx, G);
    const ps = G.players.concat(G.refs || []).sort((a, b) => a.y - b.y);
    for (const p of ps) p.slot === undefined ? drawRef(ctx, p, G) : drawPlayer(ctx, p, G);
    if (G.mini) drawMini(ctx, G);
    if (G.ball) drawBallFree(ctx, G);
    drawAim(ctx, G);
    drawFx(ctx, G);
    drawWeather(ctx, G);
  }
  ctx.restore();
  if (G.teams && !G.demo) {
    if (G.phase === 'replay') Replay.drawOverlay(ctx);
    else { drawBanner(ctx, G); if (G.mini) drawMiniHUD(ctx, G); else { drawHUD(ctx, G); drawTicker(ctx, G); } drawKickMeter(ctx, G); }
  }
}

requestAnimationFrame(frame);
