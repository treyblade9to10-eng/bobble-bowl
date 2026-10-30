// ---- Menus, mode select, controls, play-call cards, main loop ----
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
// widen the canvas on wide screens (phones) so the field fills it instead of black bars
function fitCanvas() {
  const w = Math.round(Math.min(Math.max(innerWidth / innerHeight, 16 / 9), 2.2) * CH);
  if (cv.width !== w) { cv.width = w; CW = w; }
  document.documentElement.style.setProperty('--ar', w / CH);
}
fitCanvas();
addEventListener('resize', fitCanvas);
const $ = id => document.getElementById(id);
const screens = ['title', 'mode', 'how', 'select', 'playcall', 'over', 'pause', 'seasonNew', 'seasonHub', 'modes', 'miniOver', 'half'];
function show(id) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  for (const s of screens) $(s).classList.toggle('show', s === id);
  if (id === 'title' && typeof SaveGame !== 'undefined') { const sv = SaveGame.get(); $('resumeRow').style.display = sv ? 'flex' : 'none'; if (sv) $('resumeInfo').textContent = SaveGame.summary(sv); }
  $('btnPause').style.display = (id === 'playcall' || id === null) && G.teams && !G.demo ? 'block' : 'none';
}



// ---------- Phones: double tap / pinch must not zoom or scroll the page (it slid down to a black screen) ----------
(() => {
  const typing = el => el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]');
  let lastEnd = 0, moved = false, sx = 0, sy = 0;
  document.addEventListener('touchstart', e => { const p = e.touches[0]; moved = false; sx = p.clientX; sy = p.clientY; }, { passive: true });
  document.addEventListener('touchmove', e => { const p = e.touches[0]; if (Math.abs(p.clientX - sx) + Math.abs(p.clientY - sy) > 10) moved = true; }, { passive: true });
  document.addEventListener('touchend', e => {
    const now = e.timeStamp; if (now - lastEnd < 350 && !moved && !typing(e.target)) {
      e.preventDefault(); // stops the zoom; game buttons already fired on pointerdown, menu buttons still get their click
      const t = e.target, b = t.closest && t.closest('button');
      if (!(b && b.disabled)) t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
    lastEnd = now;
  }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => { if (!typing(e.target)) e.preventDefault(); }, { passive: false });
  const snap = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); };
  window.addEventListener('scroll', snap, { passive: true });
  if (window.visualViewport) visualViewport.addEventListener('resize', snap);
})();

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
  if (modeAfter === 'select') { buildGrid(); show('select'); } else if (modeAfter === 'season') openSeason(); else if (modeAfter === 'tutorial') Tutorial.menu(); else show('title');
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
      <p><b>Pass:</b> <b>TAP</b> a receiver's icon for a soft lob, or <b>HOLD</b> it and let go when the power bar is in the green for a perfect bullet. <b>RUN</b> = the QB takes off.</p>
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
      <p>Throw: <b>1 2 3 4</b>, <b>click</b> a receiver. Tap = lob, hold = power bar (let go in the green). <b>X</b> = QB run.</p>
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
    <div><h3>Career</h3>
      <p>Create a player, play a college season, run the 40 at the Combine, and get picked on <b>Draft Day</b>. Then play NFL seasons until you retire, and maybe make the Hall of Fame.</p>
      <p><b>Player Lock</b>: you only control your guy. Receivers: <b>SPACE</b> (or tap) to call for the ball. Level up for skill points, hit game goals for bonus XP.</p></div>
    <div><h3>Online</h3>
      <p>Tap <b>ONLINE</b>. One player hits <b>HOST</b> and gets a 4-letter code, the other hits <b>JOIN</b> and types it in. Each of you picks plays on your own screen.</p></div>
    <div><h3>Before the snap</h3>
      <p><b>MOTION</b> (M) sends a receiver across. If a defender follows him, it's man coverage. On defense: <b>PRESS</b> (V) jams receivers, <b>SHOW BLITZ</b> (B) fakes a blitz.</p></div>
    <div><h3>Create a Team</h3>
      <p>Pick colors, a badge, a stadium and a roster, and set every player's rating. Play it in <b>Quick Game</b>, or start a <b>Season</b> where it takes over an NFL team's spot.</p>
      <p>Set it to <b>PUBLIC</b> to share it in the <b>Team Database</b>, and grab teams other players made.</p></div>
    <div><h3>Controller</h3>
      <p>Plug in an Xbox or PlayStation controller. Stick moves, <b>A</b> snap / dive, <b>B</b> juke, <b>X</b> spin, <b>Y</b> stiff arm, <b>RT</b> sprint. Passing: A B X Y throw to receivers 1-4.</p></div>`;
}

// ---------- title ----------
$('btnPlay').onclick = () => { Sound.init(); Sound.click(); modeAfter = 'select'; show('mode'); };
$('btnMode').onclick = () => { Sound.init(); modeAfter = 'title'; show('mode'); };
$('btnHow').onclick = () => { Sound.init(); show('how'); };
$('btnResume2').onclick = () => {
  Sound.init(); Sound.click();
  if (G.mode === 'mobile') goFullscreen();
  G.demo = false; G.challenge = null; G.mini = null; G.paused = false; show(null);
  if (!SaveGame.resume()) show('title');
};
{ const sv = SaveGame.get(); if (sv) { $('resumeRow').style.display = 'flex'; $('resumeInfo').textContent = SaveGame.summary(sv); } }
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
  return `<div class="wm">${teamBadge(t)}</div><div class="ab">${t.id}</div><div class="nm">${t.city}<br>${t.name}</div>
    <div class="ov">${ovr} OVR</div><div style="font-size:12px;margin-bottom:6px;text-shadow:1px 1px 0 #000">OFF ${offO} • DEF ${defO}</div>
    <div class="stars">${stars.map(p => `<div>${p[0]} <b>${p[3]}</b> #${p[2]} ${p[1]}</div>`).join('')}</div>
    ${xfs.length ? `<div class="xfl"><span>X-FACTOR</span> ${xfs.map(x => lastName(x.name)).join(', ')}</div>` : ''}
    <div class="cnt">${TEAMS.findIndex(x => x.id === t.id) + 1} / ${TEAMS.length}</div>`;
}
// Matchup screen card: big logo, city + name, OVR with OFF/DEF bars, QB + best player
function muBadge(t) { // a bigger copy of teamBadge for the matchup cards
  if (t && t.custom && t.logo) return `<img class="badge" src="${t.logo}" alt="${t.id}">`;
  if (typeof Logo !== 'undefined' && Logo.has(t)) { const u = Logo.url(t, 256); if (u) return `<img class="badge" src="${u}" alt="${t.id}">`; }
  return teamBadge(t);
}
function muCard(t) {
  t = Career.withCAP(t);
  const avg = a => a.length ? Math.round(a.reduce((s, p) => s + p[3], 0) / a.length) : 0;
  const xf = teamXFactors(t).map(x => x.name), all = t.off.concat(t.def);
  const qb = t.off.find(p => p[0] === 'QB') || t.off[0], star = all.filter(p => p !== qb).sort((a, b) => b[3] - a[3])[0];
  const bar = (k, v) => `<div class="muB"><span>${k}</span><i><u style="width:${Math.round(clamp((v - 55) / 45, 0.05, 1) * 100)}%"></u></i><b>${v}</b></div>`;
  const pl = (tag, p) => p ? `<div class="muP"><span class="tg">${tag}</span><span class="nm">${p[1]}${xf.includes(p[1]) ? '<em>X</em>' : ''}</span><b>${p[3]}</b></div>` : '';
  return `<div class="muLogo">${muBadge(t)}</div>
    <div class="muCity">${t.city}</div><div class="muName">${t.name}</div>
    <div class="muRat"><div class="muOvr"><b>${teamOvr(t)}</b><span>OVR</span></div><div class="muBars">${bar('OFF', avg(t.off))}${bar('DEF', avg(t.def))}</div></div>
    <div class="muPl">${pl('QB', qb)}${pl(star ? star[0] : '', star)}</div>`;
}
function renderSelect(bumpSide) {
  if (typeof renderUniBtns === 'function') setTimeout(renderUniBtns, 0);
  const two = $('optPlayers').value === '2' && G.mode !== 'mobile';
  for (const [side, id] of [[0, 'pHome'], [1, 'pAway']]) {
    const t = TEAMS[sel.idx[side]], card = $(id), el = card.querySelector('.muBody');
    el.innerHTML = muCard(t);
    card.style.setProperty('--c1', t.c1); card.style.setProperty('--c2', t.c2); card.style.setProperty('--fg', textOn(t.c1));
    card.querySelector('.muCnt').textContent = `${sel.idx[side] + 1} / ${TEAMS.length}`;
    const who = card.querySelector('.who');
    who.textContent = sel.you === side ? (two ? 'P1' : 'YOU') : (two ? 'P2' : 'CPU'); who.className = 'who ' + (sel.you === side ? 'you' : two ? 'p2' : 'cpu');
    const foot = card.querySelector('.muFoot'); // the ROSTER button (benchedit.js) lives in the card footer
    card.querySelectorAll(':scope > .beOpen').forEach(b => foot.appendChild(b));
    if (bumpSide === side) { card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump'); }
  }
  muPaint();
  $('selHint').textContent = G.mode === 'mobile' ? '' : two ? 'P1: WASD move, SPACE snap/dive, SHIFT sprint, 1-4 throw, E/F/R moves, Q switch      P2: ARROWS, ENTER, RIGHT SHIFT, 7-0 throw, / . , moves, L switch' : 'W / S  away team      ↑ / ↓  home team      ENTER  play';
  try { localStorage.setItem('bobbleSel', JSON.stringify(sel)); } catch (e) {}
}
function moveTeam(side, d) {
  let i = sel.idx[side];
  do { i = (i + d + TEAMS.length) % TEAMS.length; } while (i === sel.idx[1 - side]);
  sel.idx[side] = i; Sound.click(); renderSelect(side);
}
document.querySelectorAll('#select .muArr').forEach(b => b.onclick = e => { e.stopPropagation(); moveTeam(+b.dataset.side, +b.dataset.d); });
// key labels for the computer arrows: away = W / S, home = arrow keys (up = previous team, down = next)
document.querySelectorAll('#select .muArr').forEach(b => { b.dataset.key = b.dataset.side === '1' ? (b.dataset.d === '-1' ? 'W' : 'S') : (b.dataset.d === '-1' ? '\u2191' : '\u2193'); });
$('btnSwap').onclick = () => { sel.you = 1 - sel.you; Sound.click(); renderSelect(); };
// card body: tap = team grid, swipe left/right = next/previous team, mouse wheel scrolls teams
document.querySelectorAll('#select .muBody').forEach(el => {
  const side = +el.parentNode.dataset.side; let x0 = null, y0 = 0, swiped = false;
  el.addEventListener('wheel', e => { e.preventDefault(); moveTeam(side, e.deltaY > 0 ? 1 : -1); }, { passive: false });
  el.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; swiped = false; });
  el.addEventListener('pointerup', e => {
    if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swiped = true; moveTeam(side, dx < 0 ? 1 : -1); }
  });
  el.addEventListener('pointercancel', () => { x0 = null; });
  el.addEventListener('click', () => { if (swiped) { swiped = false; return; } openTeamGrid(side); });
});
window.addEventListener('keydown', e => {
  if (!$('select').classList.contains('show')) return;
  if ($('tgrid').classList.contains('show') || $('muSet').classList.contains('show')) { // an overlay is up: ESC / ENTER just closes it
    if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); $('tgrid').classList.remove('show'); muSetShow(false); }
    return;
  }
  if (e.code === 'KeyW') moveTeam(1, -1); if (e.code === 'KeyS') moveTeam(1, 1);
  if (e.code === 'ArrowUp') moveTeam(0, -1); if (e.code === 'ArrowDown') moveTeam(0, 1);
  if (e.code === 'Enter') startGame();
});
function buildGrid() { renderSelect(); }

// team badge: our own shield in the team colors (no real logos)
function teamBadge(t) {
  if (t && t.custom && t.logo) return `<img class="badge" src="${t.logo}" alt="${t.id}">`;
  if (typeof Logo !== 'undefined' && Logo.has(t)) { const u = Logo.url(t, 128); if (u) return `<img class="badge" src="${u}" alt="${t.id}">`; }
  const fg = textOn(t.c1), fs = t.id.length > 3 ? 18 : t.id.length > 2 ? 22 : 27;
  const SHAPE = { shield: 'M32 3 L59 12 V36 C59 53 47 64 32 69 C17 64 5 53 5 36 V12 Z', round: 'M32 6 A29 29 0 1 1 31.9 6 Z', diamond: 'M32 3 L61 36 L32 69 L3 36 Z', hex: 'M32 3 L60 19 V53 L32 69 L4 53 V19 Z' };
  return `<svg viewBox="0 0 64 72" class="badge"><path d="${SHAPE[t.shape] || SHAPE.shield}" fill="${t.c1}" stroke="${t.c2}" stroke-width="4"/>
    ${!t.shape || t.shape === 'shield' ? `<path d="M12 16 L32 9.5 L52 16" fill="none" stroke="${t.helmet || '#fff'}" stroke-width="3" opacity=".8"/>` : ''}
    <text x="32" y="${t.id.length > 2 ? 44 : 46}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-style="italic" font-weight="900" font-size="${fs}" fill="${fg}" stroke="#0007" stroke-width="1">${t.id}</text></svg>`;
}

// full team picker: every team at once, grouped by division
let tgSide = 0, tgConf = 'all';
function openTeamGrid(side) {
  tgSide = side; Sound.click();
  $('tgTitle').innerHTML = `PICK THE <b>${side === 0 ? 'HOME' : 'AWAY'}</b> TEAM`;
  renderTeamGrid(); $('tgrid').classList.add('show');
}
function renderTeamGrid() {
  document.querySelectorAll('#tgTabs button').forEach(b => b.classList.toggle('on', b.dataset.f === tgConf));
  let h = '';
  for (const conf of ['AFC', 'NFC']) for (const dv of ['East', 'North', 'South', 'West']) {
    if (tgConf !== 'all' && tgConf !== conf) continue;
    const list = TEAMS.map((t, i) => [t, i]).filter(([t]) => t.conf === conf && t.div === dv);
    if (!list.length) continue;
    h += `<div class="tgDiv"><div class="tgDn">${conf} ${dv.toUpperCase()}</div><div class="tgRow">` + list.map(([t, i]) => {
      const cur = sel.idx[tgSide] === i, opp = sel.idx[1 - tgSide] === i, tt = Career.withCAP(t);
      return `<button class="tgT${cur ? ' cur' : ''}${opp ? ' opp' : ''}" data-i="${i}" style="--c1:${t.c1};--c2:${t.c2}">${teamBadge(t)}<span class="tgN">${t.city}<br><b>${t.name}</b></span><span class="tgO">${teamOvr(tt)}</span>${opp ? '<span class="tgOpp">OPPONENT</span>' : ''}</button>`;
    }).join('') + '</div></div>';
  }
  const mine = TEAMS.map((t, i) => [t, i]).filter(([t]) => t.custom);
  if (mine.length && (tgConf === 'all' || tgConf === 'MINE')) h = `<div class="tgDiv tgMine"><div class="tgDn">MY TEAMS</div><div class="tgRow">` + mine.map(([t, i]) => {
    const cur = sel.idx[tgSide] === i, opp = sel.idx[1 - tgSide] === i;
    return `<button class="tgT${cur ? ' cur' : ''}${opp ? ' opp' : ''}" data-i="${i}" style="--c1:${t.c1};--c2:${t.c2}">${teamBadge(t)}<span class="tgN">${t.city}<br><b>${t.name}</b></span><span class="tgO">${teamOvr(t)}</span></button>`;
  }).join('') + '</div></div>' + (tgConf === 'MINE' ? '' : h);
  else if (tgConf === 'MINE') h = `<div class="tgEmpty">No custom teams yet. Make one in CREATE A TEAM on the title screen.</div>`;
  $('tgList').innerHTML = h;
  $('tgList').querySelectorAll('.tgT').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (i === sel.idx[1 - tgSide]) { [sel.idx[0], sel.idx[1]] = [sel.idx[1], sel.idx[0]]; } else sel.idx[tgSide] = i; // picking the opponent swaps the two
    Sound.click(); $('tgrid').classList.remove('show'); renderSelect(tgSide);
  });
}
document.querySelectorAll('#tgTabs button').forEach(b => b.onclick = () => { tgConf = b.dataset.f; Sound.click(); renderTeamGrid(); });
$('tgClose').onclick = () => { Sound.click(); $('tgrid').classList.remove('show'); };
for (const [side, id] of [[0, 'pHome'], [1, 'pAway']]) {
  const b = document.createElement('button'); b.className = 'allTeams'; b.textContent = 'ALL TEAMS'; b.onclick = () => openTeamGrid(side);
  $(id).querySelector('.muFoot').appendChild(b);
}

// ---- game settings panel: grouped rows of tap targets. The hidden <select>s still hold the values (other code reads them) ----
const MU_GROUPS = [
  ['GAME', [['optQtr', 'QUARTERS'], ['optDiff', 'CPU'], ['optPlayers', 'PLAYERS'], ['optGame', 'GAME']]],
  ['CONDITIONS', [['optWeather', 'WEATHER'], ['optNight', 'TIME'], ['optBcast', 'BROADCAST'], ['sliders', 'SLIDERS']]],
  ['CONTROLS', [['optMeter', 'PASS METER'], ['optMeterSpd', 'METER SPEED'], ['optCatchM', 'CATCH METER'], ['optDefM', 'DEFENSE METER'], ['optCoach', 'COACH'], ['optCoachMode', 'COACH MODE']]],
  ['LOOK', [['optLogos', 'LOGOS'], ['optNameTags', 'NAME TAGS'], ['uni', 'UNIFORMS'], ['stad', 'STADIUM']]]
];
const muRows = []; // [select id, paint fn]
function muSetShow(on) { $('muSet').classList.toggle('show', on); if (on) muPaint(); }
function muSetVal(id, v) { const sl = $(id); if (sl.value === v) return; sl.value = v; sl.dispatchEvent(new Event('change')); saveOpts(); Sound.click(); muPaint(); }
let muStadFrom = false;
function muOpenStadium() { // STADIUM straight from the matchup screen; DONE comes back here instead of the Uniform Room
  if (typeof StadiumRoom === 'undefined') return;
  const sd = $('sdDone');
  if (!sd.muWrapped) { const orig = sd.onclick; sd.onclick = function () { if (muStadFrom) { muStadFrom = false; fieldKey = ''; Sound.click(); show('select'); renderSelect(); } else orig.call(this); }; sd.muWrapped = true; }
  Sound.click(); muStadFrom = true; muSetShow(false); StadiumRoom.open(0);
}
function buildMuSet() {
  const body = $('muSetBody');
  for (const [g, rows] of MU_GROUPS) {
    const grp = document.createElement('div'); grp.className = 'muGrp'; grp.innerHTML = `<div class="muGh">${g}</div>`;
    for (const [id, label] of rows) {
      const row = document.createElement('div'); row.className = 'muRow'; row.id = 'muRow_' + id;
      row.innerHTML = `<span class="muL">${label}</span><div class="muC"></div>`;
      const c = row.querySelector('.muC');
      if (id === 'sliders') { // SLIDERS panel (sliders.js)
        const b = document.createElement('button'); b.className = 'muGo'; b.id = 'muSlGo';
        b.onclick = () => { Sound.click(); Sliders.open(() => muPaint()); };
        c.appendChild(b);
        muRows.push([id, () => { const n = SLIDER_DEFS.filter(d => Sliders.val(d[0]) !== 50).length; b.innerHTML = `${n ? `CUSTOM: ${n} CHANGED` : 'DEFAULT'}<i>OPEN</i>`; }]);
      } else if (id === 'uni' || id === 'stad') { // these open their own rooms
        const b = document.createElement('button'); b.className = 'muGo'; b.id = id === 'uni' ? 'muUniGo' : 'muStadGo';
        b.onclick = id === 'uni' ? () => { Sound.click(); muSetShow(false); Locker.open(); } : muOpenStadium;
        c.appendChild(b);
        muRows.push([id, () => { const un = v => typeof uniName === 'function' ? uniName(v) : v; b.innerHTML = id === 'uni' ? `${un($('optUni1').value)} / ${un($('optUni0').value)}<i>OPEN</i>` : `${muStadium()}<i>OPEN</i>`; }]);
      } else {
        const sl = $(id), opts = [...sl.options];
        if (opts.length <= 4 || sl.dataset.seg) { // segmented: every choice visible
          c.classList.add('seg');
          for (const o of opts) { const b = document.createElement('button'); b.dataset.v = o.value; b.textContent = o.text; b.onclick = () => muSetVal(id, o.value); c.appendChild(b); }
          muRows.push([id, () => c.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === sl.value))]);
        } else { // long lists: arrows + value
          c.classList.add('step');
          const mk = (d, svg) => { const b = document.createElement('button'); b.className = 'muStep'; b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${svg}"/></svg>`; b.onclick = () => muSetVal(id, sl.options[(sl.selectedIndex + d + sl.options.length) % sl.options.length].value); return b; };
          const v = document.createElement('span'); v.className = 'muV';
          c.append(mk(-1, 'M15 5l-7 7 7 7'), v, mk(1, 'M9 5l7 7-7 7'));
          muRows.push([id, () => { v.textContent = sl.options[sl.selectedIndex] ? sl.options[sl.selectedIndex].text : ''; }]);
        }
        sl.addEventListener('change', () => muPaint());
      }
      grp.appendChild(row);
    }
    body.appendChild(grp);
  }
}
function muStadium() {
  const t = TEAMS[sel.idx[0]]; if (!t) return '';
  try { return t.custom ? (t.stadium || 'Home Field') : ((typeof FieldStyle !== 'undefined' && (FieldStyle.get(t.id) || {}).name) || (STADIUMS[t.id] || ['Home Field'])[0]); } catch (e) { return 'Home Field'; }
}
// one summary line on the SETTINGS button, so you can see the setup without opening the panel
function muPaint() {
  const txt = id => { const s = $(id); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : ''; };
  const two = $('optPlayers').value === '2' && G.mode !== 'mobile';
  $('muRow_optPlayers').style.display = G.mode === 'mobile' ? 'none' : '';
  $('muRow_optCoachMode').style.display = two ? 'none' : '';
  for (const [, f] of muRows) f();
  const bits = [txt('optQtr') + ' QTRS', two ? '2 PLAYERS' : 'CPU ' + txt('optDiff'), txt('optWeather') + (txt('optNight') === 'Night' ? ' NIGHT' : ''), typeof BCAST !== 'undefined' && BCAST[quickBcast()] ? BCAST[quickBcast()].short : '', $('optGame').value === 'bowl' ? 'BOBBLE BOWL' : ''];
  $('muSetSum').textContent = bits.filter(Boolean).join('  ·  ');
  if (typeof bcLockPaint === 'function') bcLockPaint();
  $('muStadName').textContent = muStadium();
}
$('muSetBtn').onclick = () => { Sound.click(); muSetShow(true); };
$('muSetDone').onclick = () => { Sound.click(); muSetShow(false); };
$('muStadBtn').onclick = muOpenStadium;
$('muSet').addEventListener('click', e => { if (e.target === $('muSet')) muSetShow(false); });

$('btnBackSel').onclick = () => show('title');
$('btnKick').onclick = startGame;

// uniforms / weather / time pickers
const fillSel = (id, list, val) => { $(id).innerHTML = list.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); if (val != null) $(id).value = val; };
fillSel('optUni0', UNIFORMS, 'home');
$('optPlayers').onchange = () => renderSelect(); fillSel('optUni1', UNIFORMS, 'away'); fillSel('optWeather', WEATHER, 'clear');
// v9.3: catch + defense meters now start OFF (v9.2 saved them ON for everybody)
// v10: catch meter is hold-to-catch now (bar only shows while you hold), so it's back ON for everybody
try { const o = JSON.parse(localStorage.getItem('bobbleOpts') || 'null'); if (o && !o.m100) { o.optCatchM = '1'; o.m100 = 1; o.m93 = 1; localStorage.setItem('bobbleOpts', JSON.stringify(o)); } } catch (e) {}
try { const o = JSON.parse(localStorage.getItem('bobbleOpts') || 'null'); if (o && !o.m93) { o.optCatchM = '0'; o.optDefM = '0'; o.m93 = 1; localStorage.setItem('bobbleOpts', JSON.stringify(o)); } } catch (e) {}
try { const o = JSON.parse(localStorage.getItem('bobbleOpts') || 'null'); if (o) for (const k in o) if ($(k)) $(k).value = o[k]; } catch (e) {}
function saveOpts() { const o = {}; for (const k of ['optUni0', 'optUni1', 'optWeather', 'optNight', 'optBcast', 'optGame', 'optLogos', 'optQtr', 'optDiff', 'optCoach', 'optCoachMode', 'optPlayers', 'optMeter', 'optMeterSpd', 'optCatchM', 'optDefM', 'optNameTags', 'optZoom']) o[k] = $(k).value; o.m93 = 1; o.m100 = 1; if (Sliders.changed()) o.sliders = { ...Sliders.v }; try { localStorage.setItem('bobbleOpts', JSON.stringify(o)); } catch (e) {} }
buildMuSet(); // after the weather/uniform lists are filled
$('optLogos').addEventListener('change', () => { Logo.setStyle($('optLogos').value); renderSelect(); });
// NAME TAGS: ALL / KEY PLAYERS / OFF (draw.js reads nameTagMode every frame)
const setNameTags = v => { nameTagMode = ['all', 'key', 'off'].includes(v) ? v : 'key'; $('optNameTags').value = nameTagMode; };
setNameTags($('optNameTags').value);
$('optNameTags').addEventListener('change', () => setNameTags($('optNameTags').value));
const tagsLabel = () => { $('btnTagsOpt').textContent = 'NAME TAGS: ' + { all: 'ALL', key: 'KEY PLAYERS', off: 'OFF' }[nameTagMode]; };
$('btnTagsOpt').onclick = () => { Sound.click(); setNameTags({ all: 'key', key: 'off', off: 'all' }[nameTagMode]); saveOpts(); tagsLabel(); };
// CAMERA: NORMAL / FAR / FARTHEST = zoom out to see more of the field (draw.js CAM_ZOOMS). Changes the view behind the pause menu right away
const setZoom = v => { camZoom = CAM_ZOOMS[v] ? v : 'normal'; $('optZoom').value = camZoom; };
setZoom($('optZoom').value);
const zoomLabel = () => { $('btnZoomOpt').textContent = 'CAMERA: ' + camZoom.toUpperCase(); };
$('btnZoomOpt').onclick = () => {
  Sound.click(); setZoom({ normal: 'far', far: 'farthest', farthest: 'normal' }[camZoom]); saveOpts(); zoomLabel();
  if (G.paused && G.teams && !G.demo) { render(); updateCamera(5); } // new zoom now, then put the camera where it would be (paused = it isn't moving)
};
$('btnSlidersOpt').onclick = () => { Sound.click(); Sliders.open(); };
Logo.onReady(() => { if ($('select').classList.contains('show')) renderSelect(); });
// Coach Mode (you call the plays, the CPU plays them): one saved setting shared by Quick Game, Season and the pause menu
function setCoachMode(on) {
  $('optCoachMode').value = $('snCoachMode').value = on ? '1' : '0'; $('optCoachMode').dispatchEvent(new Event('change')); saveOpts();
  if (G.teams) { G.coachMode = on; updateHuman(); }
  coachLabel();
}
const coachLabel = () => { $('btnCoachOpt').textContent = 'COACH MODE: ' + ((G.teams ? G.coachMode : $('optCoachMode').value === '1') ? 'ON' : 'OFF'); };
$('snCoachMode').value = $('optCoachMode').value;
$('snCoachMode').onchange = () => setCoachMode($('snCoachMode').value === '1');
$('optCoachMode').addEventListener('change', () => { $('snCoachMode').value = $('optCoachMode').value; });
$('btnCoachOpt').onclick = () => { Sound.click(); setCoachMode(!G.coachMode); };

function startGame() {
  Sound.init(); Sound.whistle(); Sound.crowd(false);
  if (G.mode === 'mobile') goFullscreen();
  saveOpts();
  G.demo = false; G.season = false; G.challenge = null; G.mini = null; show(null);
  const bc = typeof quickBcast === 'function' ? quickBcast() : null;
  newGame(TEAMS[sel.idx[0]], TEAMS[sel.idx[1]], { qtr: +$('optQtr').value, diff: +$('optDiff').value, coach: $('optCoach').value, humanSide: sel.you,
    weather: typeof bcWeather === 'function' ? bcWeather(bc, pickWeather($('optWeather').value), $('optWeather').value) : pickWeather($('optWeather').value), night: $('optNight').value === '1', bcast: bc, uni: [$('optUni0').value, $('optUni1').value],
    versus: $('optPlayers').value === '2' && G.mode !== 'mobile', bigGame: $('optGame').value === 'bowl' ? quickBowlYear() : 0 });
  Broadcast.show();
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
    pcList = typeof Playbook !== 'undefined' ? Playbook.list(humanOff) : humanOff ? OFF_PLAYS.slice() : DEF_PLAYS.slice(); // your playbook (js/playbook.js)
    if (humanOff && !c.twoPt && !G.practice) { // (practice: plays only, no kicks)
      const sp = [];
      if (c.fourth) sp.push(SPECIAL_PLAYS[0]);
      if (c.fourth) sp.push(FAKE_PLAYS[0]);
      if (c.fourth && c.fgDist <= c.fgMax + 8) sp.push(FAKE_PLAYS[1]);
      // field goal: any down, as long as it's not hopeless
      // the range depends on YOUR kicker (big legs can hit it from farther)
      if (c.fgDist <= c.fgMax + 8) {
        const rng = c.fgDist > c.fgMax ? 'out' : c.fgDist > c.fgMax - 8 ? 'long' : 'in', kk = kickerOf(G.poss, 'fg');
        sp.push({ ...SPECIAL_PLAYS[1], name: `${c.fgDist} yd FG`, range: rng,
          desc: `${kk.name} max: ${c.fgMax} yd. ` + (rng === 'out' ? 'Out of his range. Long shot.' : rng === 'long' ? (G.career ? 'Long one for him.' : 'Long one. Nail the meter!') : 'In his range.') });
      }
      pcList = sp.concat(pcList);
    }
  }
  pcCoach = coachPick(c, pcList);
  // coach pick goes to the front (after kicks) so it's always on page 1
  const ci = pcList.findIndex(p => p.key === pcCoach), nSpec = pcList.filter(p => p.special).length;
  if (ci > nSpec) pcList.splice(nSpec, 0, pcList.splice(ci, 1)[0]);
  pcOff = humanOff; pcPage = 0;
  renderCards(); renderPcXF(c);
  show('playcall');
  // 2-player: hide the cards until the right player is looking
  const cover = $('pcCover');
  if (G.versus && !G.online) {
    const other = pName(1 - c.side);
    cover.innerHTML = `<div class="vsTag big p${c.side === G.p1 ? 1 : 2}">${pName(c.side)}</div><div class="cvT">${c.mode === 'off' ? 'OFFENSE' : c.mode === 'def' ? 'DEFENSE' : c.mode === 'pat' ? 'EXTRA POINT' : 'KICKOFF'}: YOUR CALL</div>
      <div class="cvS">${other}, look away.</div><button class="big" id="pcReveal">SHOW MY PLAYS</button>`;
    cover.classList.add('on');
    $('pcReveal').onclick = () => { cover.classList.remove('on'); Sound.click(); };
  } else cover.classList.remove('on');
}
let pcPage = 0, pcCoach = null, pcOff = true, pcCtx = {};
const PER_PAGE = 10;
// pages of card indexes: regular plays first, trick plays on their own TRICK page(s) at the end
function pcPages() {
  const reg = [], tr = [], out = [];
  pcList.forEach((p, i) => (pcOff && p.trick ? tr : reg).push(i));
  for (let i = 0; i < reg.length; i += PER_PAGE) out.push(reg.slice(i, i + PER_PAGE));
  const trick0 = tr.length ? out.length : -1;
  for (let i = 0; i < tr.length; i += PER_PAGE) out.push(tr.slice(i, i + PER_PAGE));
  if (!out.length) out.push([]);
  return { pages: out, trick0 };
}
function renderCards() {
  const { pages: pg, trick0 } = pcPages(), pages = pg.length;
  pcPage = clamp(pcPage, 0, pages - 1);
  const idx = pg[pcPage], list = idx.map(i => pcList[i]), onTrick = trick0 >= 0 && pcPage >= trick0;
  const box = $('pcCards'); box.innerHTML = '';
  const cols = Math.max(2, Math.ceil(list.length / 2));
  box.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  box.style.width = `min(${cols * 200}px, calc(100vw - 20px))`;
  $('pcTop').style.width = box.style.width;
  list.forEach((p, j) => {
    const i = idx[j];
    const el = document.createElement('div');
    el.className = 'pcard' + (p.special ? ' special' : '') + (p.key === pcCoach ? ' coach' : ''); el.tabIndex = 0;
    const kind = (p.card || p.type) === 'run' ? 'run' : p.type === 'pass' ? 'pass' : p.special ? 'kick' : ''; // card: what the play looks like to you (Statue of Liberty is a run)
    const label = G.mode === 'mobile' ? (kind === 'run' ? 'RUN' : kind === 'pass' ? 'PASS' : kind === 'kick' ? 'KICK' : 'D') : (j + 1) % 10;
    el.innerHTML = `${p.key === pcCoach ? '<span class="cp">COACH PICK</span>' : ''}<div class="ph"><span class="k ${kind}">${label}</span><div class="t">${p.name}</div></div>`;
    const mini = document.createElement('canvas'); mini.width = 480; mini.height = 288; // 4x so the art stays sharp
    if (p.key === 'xp' || p.key === 'two') { const g = mini.getContext('2d'); g.scale(4, 4); g.fillStyle = '#2b6b31'; g.fillRect(0, 0, 120, 72); g.font = "italic 900 34px 'Barlow Condensed', sans-serif"; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(p.key === 'xp' ? '+1' : '+2', 60, 48); }
    else drawPlayDiagram(mini, p, pcOff);
    el.appendChild(mini);
    if (p.range) { const r = document.createElement('div'); r.className = 'rng ' + p.range; r.textContent = p.range === 'in' ? 'IN RANGE' : p.range === 'long' ? 'AT HIS MAX' : 'OUT OF RANGE'; el.appendChild(r); }
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
    const nReg = trick0 >= 0 ? trick0 : pages;
    const t = document.createElement('span'); t.className = 'pgtxt'; t.textContent = onTrick ? 'TRICK PLAYS' : `PAGE ${pcPage + 1} / ${nReg}`; hint.appendChild(t);
    hint.appendChild(mk('NEXT ›', 1));
    if (trick0 >= 0) { const b = document.createElement('button'); b.className = 'pgbtn' + (onTrick ? '' : ' trick'); b.textContent = onTrick ? 'REGULAR PLAYS' : 'TRICK PLAYS'; b.onclick = () => { pcPage = onTrick ? 0 : trick0; Sound.click(); renderCards(); }; hint.appendChild(b); }
  }
  // clock tools
  const tool = (txt, fn) => { const b = document.createElement('button'); b.className = 'pgbtn tool'; b.textContent = txt; b.onclick = fn; hint.appendChild(b); };
  const tos = pcCtx.side != null ? pcCtx.side : G.human;
  const guest = G.online && Net.role === 'guest';
  if ((pcCtx.mode === 'off' || pcCtx.mode === 'def') && G.timeouts && G.timeouts[tos] > 0 && (G.pendingRunoff > 0 || guest)) tool(`TIMEOUT (${G.timeouts[tos]})`, () => { if (guest) { Net.send({ t: 'tool', k: 'timeout' }); Sound.click(); } else if (callTimeout(tos)) renderCards(); });
  if (pcCtx.mode === 'off' && G.down < 4 && G.pendingRunoff > 0 && !G.online) {
    tool('SPIKE', () => { show(null); spikeBall(); });
    tool('FAKE SPIKE', () => { show(null); G.fakeSpike = true; choosePlay(pick(['slants', 'verts', 'smash'])); });
  }
  if (pcCtx.mode === 'off' && !G.online && G.score[G.poss] > G.score[1 - G.poss] && (G.quarter >= 4 || (G.quarter === 2 && G.clock < 60)) && !G.twoPt) tool('KNEEL', () => { show(null); choosePlay('kneel'); });
  const last = G.versus && !G.online ? (pcCtx.mode === 'off' ? (G.lastOffKeys || [])[pcCtx.side] : pcCtx.mode === 'def' ? (G.lastDefKeys || [])[pcCtx.side] : null) : pcCtx.mode === 'off' ? G.lastOffKey : pcCtx.mode === 'def' ? G.lastDefKey : null;
  const li = last ? pcList.findIndex(p => p.key === last) : -1;
  if (li >= 0) tool('LAST PLAY', () => choose(li));
  const tip = document.createElement('span'); tip.className = 'pgtip';
  tip.textContent = G.mode === 'mobile' ? '' : `1-${Math.min(PER_PAGE, list.length) % 10 || 0} to pick     ← → pages` + [...hint.querySelectorAll('.tool')].map(b => b.textContent === 'KNEEL' ? '     K kneel' : b.textContent === 'SPIKE' ? '     X spike' : '').join('');
  hint.appendChild(tip);
}
// X-Factors on both sides of the header: zone meter + what it takes (yours on the left)
function renderPcXF(c) {
  const me = c.side != null ? c.side : G.human >= 0 ? G.human : 0, max = G.mode === 'mobile' ? 2 : 3, big = G.mode !== 'mobile';
  [me, 1 - me].forEach((s, j) => {
    const L = (c.mode === 'off' || c.mode === 'def') && !(G.online && Net.role === 'guest') ? xfTeamList(s) : [], col = G.teams[s] ? G.teams[s].c1 : '#888';
    $('pcXF' + j).innerHTML = L.slice(0, max).map(x => xfChip(x, col, big)).join('') + (L.length > max ? `<div class="xfc more">+${L.length - max}</div>` : '');
  });
}
G.hooks.onPlayCall = c => { if (G.demo) return; if (G.online && Net.role === 'host') return Net.onPlayCall(c); onPlayCall(c); };
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
  if (G.online) { // online: send your pick, the host starts the play when both picks are in
    Sound.click(); show(null);
    if (pcCtx.mode === 'off') G.lastOffKey = p.key; else if (pcCtx.mode === 'def') G.lastDefKey = p.key;
    if (Net.role === 'host') Net.pick(0, pcCtx.mode, p.key, pcCtx.id);
    else { Net.send({ t: 'pick', mode: pcCtx.mode, key: p.key, id: pcCtx.id }); onlineWait('Waiting for your opponent to pick...'); }
    return;
  }
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
  if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { const pages = pcPages().pages.length; pcPage = (pcPage + (e.code === 'ArrowRight' ? 1 : -1) + pages) % pages; renderCards(); return; }
  const n = parseInt(e.key, 10);
  if (isNaN(n)) return;
  const i = (pcPages().pages[pcPage] || [])[n === 0 ? 9 : n - 1];
  if (i != null) choose(i);
});

// ---------- team stat sheet (halftime + final) ----------
function statTable(ts, teams, me) {
  const sides = [me, 1 - me];
  const g = (t, k) => (t && t[k]) || 0;
  const mmss = v => { v = Math.round(v || 0); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  const rows = [
    ['Total yards', t => g(t, 'pass') + g(t, 'rush'), 1],
    ['Passing', t => g(t, 'pass'), 1],
    ['Rushing', t => g(t, 'rush'), 1],
    ['First downs', t => g(t, 'fd'), 1],
    ['3rd down', t => `${g(t, 'c3')}/${g(t, 'a3')}`, 0],
    ['Turnovers', t => g(t, 'to'), -1],
    ['Possession', t => mmss(g(t, 'top')), 0, t => g(t, 'top')]
  ];
  if (g(ts[0], 'blk') + g(ts[1], 'blk') > 0) rows.push(['Blocked kicks', t => g(t, 'blk'), 1]); // only when it happened
  const tag = t => `<span style="color:${t.c1 === '#000000' ? '#ccc' : t.c1}">${t.id}</span>`;
  let h = `<table class="stTab"><tr><th></th><th>${tag(teams[sides[0]])}</th><th>${tag(teams[sides[1]])}</th></tr>`;
  for (const [lbl, f, better, raw] of rows) {
    const a = f(ts[sides[0]]), b = f(ts[sides[1]]);
    const va = raw ? raw(ts[sides[0]]) : a, vb = raw ? raw(ts[sides[1]]) : b;
    const w = better === 0 && !raw ? 0 : (better || 1) * ((va > vb) - (va < vb));
    h += `<tr><td>${lbl}</td><td class="${w > 0 ? 'up' : ''}">${a}</td><td class="${w < 0 ? 'up' : ''}">${b}</td></tr>`;
  }
  return h + '</table>';
}
G.hooks.onHalftime = () => {
  if (G.demo || G.online || G.mini || G.challenge || G.versus) return;
  const me = Math.max(0, G.human), t = G.teams;
  $('halfScore').innerHTML = `${t[1].id} ${G.score[1]} - ${G.score[0]} ${t[0].id}`;
  $('halfStats').innerHTML = statTable(G.tstats, t, me);
  G.halfFrom = $('playcall').classList.contains('show') ? 'playcall' : null;
  Highlights.finalize(); $('btnHalfHl').style.display = Highlights.clips.length ? '' : 'none';
  G.paused = true; show('half');
};
$('btnHalf').onclick = () => { G.paused = false; show(G.halfFrom); };
$('btnHalfHl').onclick = () => { Sound.click(); hlMenu('half'); };

// ---------- game over / YOU WIN ----------
let mvpAnim = null, mvpLoop = null;
G.hooks.onGameOver = s => {
  if (G.demo) return;
  const me = s.human, them = 1 - me;
  const won = s.score[me] > s.score[them], tie = s.score[me] === s.score[them];
  $('over').classList.toggle('win', won);
  $('overTitle').textContent = G.versus ? (tie ? 'TIE GAME' : `${s.score[G.p1] > s.score[1 - G.p1] ? 'PLAYER 1' : 'PLAYER 2'} WINS`) : won ? 'YOU WIN!' : tie ? 'TIE GAME' : 'GAME OVER';
  const tag = t => `<span style="color:${t.c1 === '#000000' ? '#aaa' : t.c1};-webkit-text-stroke:1px #fff">${t.id}</span>`;
  $('overScore').innerHTML = `${tag(s.teams[1])} ${s.score[1]} - ${s.score[0]} ${tag(s.teams[0])}`;
  let html = statTable(s.tstats, s.teams, me);
  const lead = side => { const L = s.leaders[side], b = [];
    if (L.pass) b.push(`${lastName(L.pass.name)} ${L.pass.pass} pass`); if (L.rush) b.push(`${lastName(L.rush.name)} ${L.rush.rush} rush`); if (L.rec) b.push(`${lastName(L.rec.name)} ${L.rec.rec} rec`);
    if (L.sack) b.push(`${lastName(L.sack.name)} ${L.sack.sack} sk`); if (L.int) b.push(`${lastName(L.int.name)} ${L.int.int} INT`);
    if (L.blk) b.push(`${lastName(L.blk.name)} ${L.blk.blk} blocked kick${L.blk.blk > 1 ? 's' : ''}`);
    for (const p of Object.values(G.pstats || {})) if (p.tw && p.side === side && (p.rec || p.rush || p.td || p.tkl || p.int || p.sack)) b.push(`${lastName(p.name)} 2-WAY: ${[p.rush && p.rush + ' rush', p.rec && p.rec + ' rec', p.td && p.td + ' TD', p.tkl + ' tkl', p.int && p.int + ' INT', p.pd && p.pd + ' PD'].filter(Boolean).join(', ')}`); // both sides, one line
    return b.length ? `<div class="stLead"><b>${s.teams[side].id}</b> ${b.join(' &middot; ')}</div>` : ''; };
  html += lead(me) + lead(them);
  $('overStats').innerHTML = html;
  // my player XP + trophy case
  const cr = !G.challenge && !G.mini ? Career.afterGame(s) : null;
  Career.gameDone(s);
  const wk = Weekly.afterGame(s);
  $('overWeek').innerHTML = wk ? (wk.champ ? `<div class="wkChamp">WEEKLY CHAMPION: all 3 done. Trophy added${Career.cap ? ', +250 XP' : ''}.</div>` : '') +
    wk.out.map(g => `<div class="wkG${g.done ? ' done' : ''}"><span class="wkT">WEEKLY: ${g.text}</span><span class="wkBar"><i style="width:${Math.round(100 * g.have / g.need)}%"></i></span><span class="wkN">${g.done ? 'DONE' : `${g.have}/${g.need}`}</span></div>`).join('') : '';
  $('overCap').innerHTML = cr ? `<div class="ocTop"><span class="ocGrade g${cr.grade.replace('+', 'p')}">${cr.grade}</span><div><b>${Career.cap.name}</b>: ${cr.line}<br><b class="ocXp">+${cr.xp} XP</b>${cr.rival ? `<span class="rivTag"> RIVALRY 1.5x · series ${cr.rival.series}</span>` : ''}${cr.lv ? `<span class="lvl">LEVEL UP! +${cr.sp} SKILL POINT${cr.sp === 1 ? '' : 'S'}</span>` : ''}<br><span class="ocTrust">COACH TRUST ${cr.trust.v} (${cr.trust.d >= 0 ? '+' : ''}${cr.trust.d})${cr.trust.unlocked ? '  ·  PLAY CALLING UNLOCKED' : ''}</span></div></div>
    <div class="ocGoals">${cr.goals.map(g => `<span class="${g.done ? 'ok' : ''}">${g.done ? 'DONE' : 'MISSED'}: ${g.text}</span>`).join('')}</div>` : '';
  // MVP: best performer on the winning team (or yours if tied)
  const mvpSide = won || tie ? me : them;
  const score = p => p.pass / 20 + p.rush / 8 + p.rec / 8 + p.td * 6 + p.tkl * 1.5 + p.sack * 4 + p.int * 6;
  const cand = Object.values(G.pstats || {}).filter(p => p.side === mvpSide).sort((a, b) => score(b) - score(a))[0];
  drawMvp(cand, mvpSide);
  hlOver(s);
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
  if (ch && ch.ok && !ch.next) $('overTitle').textContent = G.challenge.type === '2min' ? 'DRIVE COMPLETE!' : G.challenge.type === 'draft' ? 'DRAFT CHAMPION!' : 'CHALLENGE COMPLETE!';
  $('btnAgain').textContent = ch && ch.next ? 'NEXT GAME' : G.challenge && G.challenge.type === 'draft' ? 'NEW DRAFT' : G.challenge ? 'TRY AGAIN' : 'REMATCH';
  $('btnNewTeams').textContent = G.challenge ? 'CHALLENGES' : G.online ? 'MAIN MENU' : 'NEW TEAMS';
  if (G.online && Net.role === 'host') Net.over(s);
  if (won && (G.rivalryMatch || G.rivalry) && !G.versus && !G.challenge && !G.mini && !G.online) { Career.addRivalTrophy(s.teams[me].id, s.teams[them].id, inSeason && Season.data ? Season.data.year : 1); $('overChal').textContent = `RIVALRY TROPHY: you beat the ${s.teams[them].name}. It's in your Trophy Case.`; $('overChal').style.color = '#ffd23f'; }
  if (inSeason) { Season.addPlayedStats(G.pstats, G.teams); seasonGameDone(s.score); }
  const inCareer = !!G.career;
  $('btnSeasonCont').style.display = inSeason || inCareer ? '' : 'none';
  $('btnAgain').style.display = $('btnNewTeams').style.display = inSeason || inCareer ? 'none' : '';
  if (G.online) $('btnAgain').style.display = 'none';
  if (inSeason && G.playoff && won) $('overTitle').textContent = Season.data.phase === 'done' ? 'CHAMPIONS' : 'YOU ADVANCE!';
  // the Bobble Bowl: trophy ceremony for the winners first (a Quick Game Bobble Bowl win goes in the Trophy Case too)
  if (G.bigGame && won && !inSeason && !G.career && !G.versus && !G.online) Career.addTitle(s.teams[me].id, G.bigGame.year);
  if (G.bigGame && !tie && !G.demo) {
    const ws = s.score[0] > s.score[1] ? 0 : 1;
    const best = Object.values(G.pstats || {}).filter(p => p.side === ws).sort((a, b) => score(b) - score(a))[0];
    setTimeout(() => Ceremony.show(ws, best, () => show('over')), 1400);
  } else setTimeout(() => show('over'), 1400);
};
function drawMvp(st, side) {
  const cvm = $('mvpCv'), g = cvm.getContext('2d');
  cancelAnimationFrame(mvpAnim);
  if (!st) { $('mvpBox').style.display = 'none'; return; }
  $('mvpBox').style.display = '';
  const t = G.teams[side];
  $('mvpBox').style.setProperty('--tc', t.c1);
  const all = t.off.map((p, i) => [p, true, i]).concat(t.def.map((p, i) => [p, false, i]));
  const found = all.find(([p]) => p[1] === st.name) || all[0];
  const p = makePlayer(side, found[1], found[2], found[0]);
  p.celebrate = 1e9; p.face.dir = 1; p.headScale = 1.15;
  const bits = [];
  if (st.pass) bits.push(`${st.pass} pass yds`); if (st.rush) bits.push(`${st.rush} rush yds`); if (st.rec) bits.push(`${st.rec} rec yds`);
  if (st.td) bits.push(`${st.td} TD`); if (st.tkl) bits.push(`${st.tkl} tkl`); if (st.sack) bits.push(`${st.sack} sack${st.sack === 1 ? "" : "s"}`); if (st.int) bits.push(`${st.int} INT`);
  const ln = lastName(st.name), lines = (G.pbp || []).filter(l => l.text.includes(ln));
  const key = lines.find(l => /TOUCHDOWN/i.test(l.text)) || lines.find(l => /INTERCEPT|SACK|FUMBLE/i.test(l.text)) || lines[lines.length - 1];
  $('mvpText').innerHTML = `<b>${st.name}</b> &middot; ${st.tw ? st.pos + '/' + st.tw : st.pos} &middot; ${t.name}<div class="mvpLine">${bits.join(' &middot; ') || 'Did a bit of everything'}</div>${key ? `<div class="mvpKey">${key.q} ${key.clock} &middot; ${key.text}</div>` : ''}`;
  const fake = { teams: G.teams, ball: null, phase: 'over', human: G.human, mode: G.mode, time: 0 };
  const loop = () => {
    fake.time = performance.now() / 1000; p.anim += 0.05; p.speedNow = 0;
    g.clearRect(0, 0, 260, 300);
    const bg = g.createRadialGradient(130, 150, 10, 130, 150, 150); bg.addColorStop(0, t.c1 + 'aa'); bg.addColorStop(1, '#0000');
    g.fillStyle = bg; g.fillRect(0, 0, 260, 300);
    g.globalAlpha = 0.18; Logo.draw(g, t, 130, 135, 230); g.globalAlpha = 1; // trading card: team logo behind him
    g.save(); g.scale(2.6, 2.6); drawPlayer(g, p, fake, { x: 50, y: 108 }); g.restore();
    // OVR badge + position, like a card
    g.fillStyle = '#0b0f16e0'; g.fillRect(8, 8, 58, 58); g.fillStyle = '#f6c31c'; g.fillRect(8, 62, 58, 4);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.font = 'italic 900 30px "Barlow Condensed", Arial, sans-serif'; g.fillText(p.ovr, 37, 30);
    g.font = '800 13px "Barlow Condensed", Arial, sans-serif'; g.fillStyle = '#f6c31c'; g.fillText(st.pos, 37, 52);
    g.drawImage(Logo.canvas(t, 96), 206, 10, 44, 44);
    if ($('over').classList.contains('show')) mvpAnim = requestAnimationFrame(loop);
  };
  mvpLoop = loop; // restarted after watching highlights
  setTimeout(loop, 1450);
}
// ---------- highlights: PLAY OF THE GAME card + the list (only the computer running the game films it) ----------
const hlBack = to => () => { show(to); if (to === 'over' && mvpLoop) { cancelAnimationFrame(mvpAnim); mvpLoop(); } };
function hlOver(s) {
  const list = Highlights.done(s), top = Highlights.best(); // an online guest's list comes back empty (nothing filmed in this game)
  $('potgBox').style.display = top ? '' : 'none'; if (!top) return;
  const t = G.teams[top.team];
  $('potgBox').style.setProperty('--tc', t.c1);
  $('potgTitle').innerHTML = (top.gw ? '<em>GAME-WINNING</em>' : '') + top.title.split(' ').map(w => `<span>${w}</span>`).join(' '); // spans: only wrap between words
  $('potgWho').textContent = [top.who, `${top.q}\u00a0${top.clock}`].filter(Boolean).join(' · ');
  $('potgAll').textContent = `ALL HIGHLIGHTS (${list.length})`; $('potgAll').style.display = list.length > 1 ? '' : 'none';
}
$('potgWatch').onclick = () => { Sound.click(); Highlights.play([Highlights.best()], hlBack('over')); };
$('potgAll').onclick = () => { Sound.click(); hlMenu('over'); };
function hlMenu(from) {
  const list = Highlights.clips, top = Highlights.best(), T = G.teams;
  $('hlSub').textContent = `${from === 'half' ? 'HALFTIME' : 'FINAL'}  ·  ${T[1].id} ${G.score[1]} - ${G.score[0]} ${T[0].id}  ·  ${list.length} PLAY${list.length === 1 ? '' : 'S'}`;
  $('hlList').innerHTML = list.map((c, i) => `<button class="hlRow${c === top ? ' top' : ''}" data-i="${i}" style="--tc:${T[c.team].c1 === '#000000' ? '#555' : T[c.team].c1}">
    <span class="hlQ">${c.q}<i>${c.clock}</i></span><span class="hlT">${c === top ? '<em>PLAY OF THE GAME</em>' : ''}<b>${Highlights.label(c)}</b><i>${c.who}</i></span><span class="hlS">${T[1].id} ${c.score[1]} - ${c.score[0]} ${T[0].id}</span></button>`).join('');
  $('hlList').querySelectorAll('.hlRow').forEach(b => b.onclick = () => { Sound.click(); Highlights.play([list[+b.dataset.i]], () => hlMenu(from)); });
  $('hlAll').onclick = () => { Sound.click(); Highlights.play(list, () => hlMenu(from)); };
  $('hlBack').onclick = () => { Sound.click(); hlBack(from)(); };
  show('hlMenu');
}
screens.push('hlMenu');
$('btnAgain').onclick = () => { const c = G.challenge; show(null); if (c) runChallenge(c.type); else startGame(); };
$('btnNewTeams').onclick = () => { if (G.online) { Net.leave(); G.teams = null; G.online = false; show('title'); return; } const c = G.challenge; G.teams = null; G.challenge = null; if (c) openModes(); else { renderSelect(); show('select'); } };

// ---------- pause ----------
// pause menu: every X-Factor in the game, both teams
function renderPauseXF() {
  const me = G.human >= 0 ? G.human : 0, cols = [me, 1 - me].map(s => [s, xfTeamList(s)]).filter(([, L]) => L.length);
  $('pauseXF').innerHTML = !cols.length || G.mini || (G.online && Net.role === 'guest') ? '' : cols.map(([s, L]) => `<div class="pxCol"><div class="pbpHead">${G.teams[s].name} X-FACTORS</div>${L.map(x => xfChip(x, G.teams[s].c1, true)).join('')}</div>`).join('');
}
function togglePause() {
  if (!G.teams || G.phase === 'over' || G.demo || Highlights.on || $('hlMenu').classList.contains('show')) return;
  if (G.online) { const on = !$('pause').classList.contains('show'); if (on) { zoomLabel(); $('pausePbp').innerHTML = '<div class="pbpHead">ONLINE GAME KEEPS GOING WHILE THIS IS OPEN</div>' + pbpHtml(6); show('pause'); } else show(null); return; }
  G.paused = !G.paused;
  if (G.paused) { G.pauseFrom = $('playcall').classList.contains('show') ? 'playcall' : null; coachLabel(); tagsLabel(); zoomLabel(); $('btnCoachOpt').style.display = G.versus || G.lock || G.mini || G.challenge ? 'none' : ''; $('pausePbp').innerHTML = pbpHtml(8); renderPauseXF(); show('pause'); }
  else show(G.pauseFrom);
}
$('btnPause').onclick = togglePause;
$('btnResume').onclick = togglePause;
const replayLabel = () => { $('btnReplayOpt').textContent = 'INSTANT REPLAYS: ' + (Replay.enabled ? 'ON' : 'OFF'); };
replayLabel();
$('btnReplayOpt').onclick = () => { Replay.setEnabled(!Replay.enabled); replayLabel(); };
$('btnQuit').onclick = () => {
  if (G.online) { Net.leave(); G.online = false; G.teams = null; G.phase = 'idle'; show('title'); return; }
  SaveGame.clear();
  G.paused = false; G.teams = null; G.phase = 'idle';
  if (G.career) { G.season = false; G.career = false; CareerUI.open(); } else if (G.season) { G.season = false; openSeason(); } else if (G.challenge || G.mini) { G.challenge = null; G.mini = null; openModes(); } else show('title');
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
  Object.assign(P, { down: true, x: p.x, y: p.y, x0: p.x, y0: p.y, t: 0, moved: false, aiming: false, noSteer: false, start: performance.now() });
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
  if (P.aiming || (G.online && Net.role === 'guest' && P.moved)) { Input.release = { x: P.x0 - P.x, y: P.y0 - P.y }; Input.flick = performance.now() - P.start < 330; }
  else if (!P.moved && quick && !nearMobileButton(e)) Input.taps.push({ x: P.x, y: P.y });
  P.down = false; P.moved = false; P.aiming = false;
};
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('lostpointercapture', endPointer); // a missed pointerup can't leave the field stuck "held"
cv.addEventListener('contextmenu', e => e.preventDefault());

// a tap that just misses a mobile button shouldn't count as "tap the field" (that would snap the ball)
function nearMobileButton(e) {
  if (G.mode !== 'mobile') return false;
  for (const b of document.querySelectorAll('#mbtns button.on')) {
    const r = b.getBoundingClientRect(), pad = 26;
    if (e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad) return true;
  }
  return false;
}
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
    const c = (joy.clientWidth - knob.offsetWidth) / 2, travel = joy.clientWidth * 0.32;
    knob.style.left = (c + x * travel) + 'px'; knob.style.top = (c + y * travel) + 'px';
  };
  const reset = () => { id = null; Input.stick.x = Input.stick.y = Input.stick.m = 0; knob.style.left = knob.style.top = ''; };
  joy.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; try { joy.setPointerCapture(id); } catch (_) {} set(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
  joy.addEventListener('pointerup', e => { if (e.pointerId === id) reset(); });
  joy.addEventListener('pointercancel', reset);
  joy.addEventListener('lostpointercapture', reset);
})();

// the coach's red flag (phone + computer; Y on a keyboard)
$('chalBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Review.tap(); });
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
    else if (G.lock && h !== G.O[0] && G.bstate === 'snap' && !b.flight) st = 'call';
    else if (b.flight && b.flight.kick === 'punt' && b.flight.intended === h && !h.fair) st = 'ret'; // punt coming down: FAIR CATCH button
  }
  if (G.phase === 'dead' && G.cellyGuy && !G.cellyGuy.celly && !G.cellyGuy.cellyNext && !G.demo && (!G.online || G.cellyGuy.side === G.human)) st = 'celly'; // buttons hide once he's celebrating
  if (G.phase === 'presnap' && !G.demo) st = 'presnap';
  const coach = coachOn(); // Coach Mode: no stick or move buttons, just AUDIBLE / TIMEOUT before the snap
  if (coach && st !== 'presnap') st = '';
  const joyOn = (G.phase === 'live' || fgRushing()) && !G.demo && !!h; // stays up the whole play so your thumb never loses it (+ rushing a field goal)
  $('joy').classList.toggle('on', !!joyOn);
  if (!joyOn && Input.stick.m) { Input.stick.x = Input.stick.y = Input.stick.m = 0; $('joyKnob').style.left = $('joyKnob').style.top = ''; }
  const side = G.poss === G.human ? 'off' : 'def';
  const po = G.play && G.play.off, canMotion = !!po && !po.chain && (po.type === 'pass' || po.toss || po.carrier === 4);
  const club = st === 'celly' ? clubCelly(G.cellyGuy) : null;
  const cc = coachCalls(); // career: the coach has the audible / timeout
  const key = st + side + coach + cc + canMotion + G.weather + (club ? club.id : '') + (b && b.flight ? 'air' : '') + (h && h.engaged ? 'eng' : '') + (h && h.fair ? 'fc' : '');
  if (key === mbState) return;
  mbState = key;
  document.querySelectorAll('#mbtns button').forEach(x => x.classList.toggle('on', x.dataset.show === st && (!x.dataset.side || x.dataset.side === side) && (x.dataset.k !== 'KeyM' || canMotion) && (!x.dataset.wx || x.dataset.wx === G.weather) && (!x.dataset.lock || Unlocks.has(x.dataset.lock)) && (!coach || x.dataset.k === 'KeyZ' || x.dataset.k === 'KeyT') && !(cc && (x.dataset.k === 'KeyZ' || x.dataset.k === 'KeyT'))));
  $('mbtns').classList.toggle('pre', st === 'presnap');
  $('mbtns').classList.toggle('cel', st === 'celly');
  $('mbClub').classList.toggle('on', !!club); if (club) $('mbClub').textContent = club.name; // team signature celly
  $('mbDive').textContent = b && b.flight ? 'JUMP' : 'DIVE';
  $('mbSwim').style.display = st === 'def' && h && h.engaged ? 'block' : 'none';
  $('mbTO').style.display = st === 'presnap' && !cc && G.timeouts && G.timeouts[G.human] > 0 && G.pendingRunoff > 0 ? 'block' : 'none';
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
    ['dash', '05', '40-YARD DASH', 'Mash ← → (or tap) to race your fastest player.', R.dash && R.dash < 99 ? `Best: ${R.dash}s` : ''],
    ['draft', '06', 'DRAFT CHAMPIONS', 'Pick 1 of 3 real players at every spot, then win 3 straight.', DC.recordText()]
  ];
  $('mdWeekly').innerHTML = weeklyHtml(true);
  $('mdCards').innerHTML = cards.map(([k, i, tt, dd, rr]) => `<div class="mdcard" tabindex="0" data-k="${k}"><div class="mi">${i}</div><div class="mt">${tt}</div><div class="md">${dd}</div><div class="mr">${rr}</div></div>`).join('');
  document.querySelectorAll('.mdcard').forEach(c => c.onclick = () => runChallenge(c.dataset.k));
  show('modes');
}
function runChallenge(k) {
  Sound.init(); Sound.whistle();
  if (k === 'draft') { G.lastMini = k; G.demo = false; G.challenge = null; G.mini = null; return DC.start(); }
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
  Object.assign(G, { teams: [a, b], human: -1, diff: 1, poss: 0, los: rand(30, 70), ballY: MID, down: 1, score: [0, 0], quarter: 1, clock: 180, demo: true, fx: [], weather: 'clear', night: typeof spookyNow === 'function' && spookyNow(), bcast: null, uni: null, versus: false, xf: null,
    pstats: {}, tstats: [{ pass: 0, rush: 0, to: 0 }, { pass: 0, rush: 0, to: 0 }], patSide: null, twoPt: false, next: null, paused: false, slowmo: 0, banner: null, practice: null });
  setFirstDown();
  setupPlay(pick(OFF_PLAYS.filter(p => !p.custom)), pick(DEF_PLAYS));
  snap();
}

// ---------- main loop ----------
const menuScreens = ['title', 'how', 'select', 'mode', 'seasonNew', 'seasonHub', 'modes', 'miniOver', 'cap', 'trophies'];
let last = performance.now();
let errRun = 0, errPhase = '', menuSkip = false;
function frame(now) {
  requestAnimationFrame(frame); // schedule first so one bad frame can't freeze the game
  try { step(now); errRun = 0; } catch (e) {
    if (errRun++ % 120 === 0) console.error(e);
    if (G.demo) G.phase = 'over';
    try { render(); } catch (e2) {} // keep the picture up even if the game logic tripped
    // the same thing keeps breaking for 2 seconds: skip ahead to the next play instead of hanging
    if (errRun > 120 && G.teams && !G.demo) { errRun = 0; try { G.paused = false; for (const p of G.players) p.celly = null; G.cellyGuy = null; G.tdScorer = null; if (['live', 'dead', 'replay', 'kick', 'review'].includes(G.phase)) { G.phase = 'dead'; G.rv = null; afterPlay(); } else toPlayCall(); } catch (e3) { console.error(e3); } }
  }
}
// if the browser drops the canvas (GPU reset / low memory), redraw everything from scratch
cv.addEventListener('contextlost', () => resetGfx());
cv.addEventListener('contextrestored', () => resetGfx());
// a slow frame on a phone used to turn into slow motion (dt was capped at 1/30s). Now the game catches up in
// small 1/60s steps so it keeps real speed and the physics stay steady. Taps/keys only count in the first step.
function stepUpdate(raw) {
  const n = Math.min(6, Math.max(1, Math.ceil(raw / (1 / 60) - 0.05))), h = raw / n;
  for (let i = 0; i < n; i++) {
    if (i === 1) { Input.pressed = {}; Input.taps.length = 0; Input.release = null; }
    update(h);
  }
}
function step(now) {
  const raw = clamp((now - last) / 1000, 0, 0.1); last = now;
  const dt = Math.min(raw, 0.033);
  if (Input.pointer.down) Input.pointer.t += dt;
  Pad.poll(dt);
  Input.versus = !!G.versus && !G.demo; if (!Input.versus) Input.ctl = 0;
  const inMenu = menuScreens.some(id => $(id).classList.contains('show')) && !(G.mini && $('miniOver').classList.contains('show'));
  if (Highlights.on) Highlights.update(raw); // the highlight reel drives the picture by itself
  else if (inMenu) {
    if (!G.demo || G.phase === 'over') demoSetup();
    if (G.phase === 'live' && G.play.t > 7) G.phase = 'dead';
    if ((G.phase === 'dead' && G.deadT < 0.4) || G.phase === 'playcall' || G.phase === 'kick') demoSetup();
    G.next = null;
    Input.taps.length = 0; Input.release = null;
    update(dt);
  } else if (G.online && Net.role === 'guest') {
    Net.guestFrame(dt); // the host runs the game; we just draw it and send our controls
  } else {
    if (G.demo) G.demo = false;
    if (G.online) Net.prepRemote();
    if (G.online) update(dt); else stepUpdate(raw);
    if (G.sitOut && !G.paused && ['presnap', 'live', 'dead'].includes(G.phase)) update(dt); // Player Lock: plays without your guy go by at double speed
    if (G.online) Net.hostFrame(dt);
  }
  updateMobileButtons();
  Review.ui();
  // behind a menu the demo game is mostly covered: draw it at 30fps so the phone has time for the menu itself (the title keeps 60)
  if (!(inMenu && !Highlights.on && !$('title').classList.contains('show') && (menuSkip = !menuSkip))) render();
  Input.endFrame();
}

function render() {
  // CAMERA zoomed out (pause menu): the world is drawn scaled down, sized as if the screen were bigger (draw.js CAM_ZOOMS)
  const z = G.teams && !G.demo ? CAM_ZOOMS[camZoom] || 1 : 1, cel = cam.zoom > 1.001 && cam.focus && G.phase !== 'replay';
  scrW = CW; scrH = CH; viewZ = vk = z; // (taps + the camera use viewZ until the next frame)
  if (z !== 1) { CW = scrW / z; CH = scrH / z; vk = 1; uiK = lerp(1 / z, 1, cel ? clamp((cam.zoom - 1) / (1.6 / z - 1), 0, 1) : 0); }
  // draw with the camera on whole pixels: the big field picture then copies straight over instead of being resampled
  // every frame (3x cheaper on phones). Everything moves together, so nothing shifts against the field
  const camX = cam.x, camY = cam.y;
  if (!cel && z === 1) { cam.x = (Math.round(cam.x * PX - CW / 2) + CW / 2) / PX; cam.y = Math.round(cam.y * PY) / PY; }
  else if (!cel) { // zoomed out: the shrunk field picture's corner on a whole screen pixel
    const ax = z * PX, ay = z * PY, ox = scrW / 2, oy = scrH / 2 + VY;
    cam.x = (Math.round(ax * (cam.x + FIELD_PAD_X) - ox) + ox) / ax - FIELD_PAD_X; cam.y = (Math.round(ay * (cam.y + FIELD_PAD_TOP) - oy) + oy) / ay - FIELD_PAD_TOP;
  }
  try { renderFrame(z); } finally { cam.x = camX; cam.y = camY; zoomDone(); }
}
let scrW = CW, scrH = CH;
function zoomDone() { CW = scrW; CH = scrH; vk = viewZ; uiK = 1; } // back to screen size for the HUD
function renderFrame(z) {
  ctx.save();
  ctx.clearRect(0, 0, CW, CH);
  if (cam.shake > 0.3) ctx.translate(Math.round(rand(-cam.shake, cam.shake)), Math.round(rand(-cam.shake, cam.shake)));
  if (z !== 1) ctx.scale(z, z);
  if (cam.zoom > 1.001 && cam.focus && G.phase !== 'replay') { // celly cam (pushes in to the same size whatever the CAMERA setting)
    const fx = sx(cam.focus.x), fy = sy(cam.focus.y) - 40, k = clamp((cam.zoom - 1) / (1.6 / viewZ - 1), 0, 1);
    ctx.translate(lerp(fx, CW / 2, k), lerp(fy, CH * (G.mode === 'mobile' ? 0.56 : 0.66), k)); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-fx, -fy);
  }
  if (G.teams) {
    safeDraw('field', () => drawField(ctx, G), () => { resetGfx(); ctx.fillStyle = '#2f7a32'; ctx.fillRect(0, 0, CW, CH); });
    safeDraw('ground', () => drawWeatherGround(ctx, G));
    safeDraw('lines', () => { drawLines(ctx, G); drawRoutes(ctx, G); });
    const ps = G.players.concat(G.refs || []).sort((a, b) => a.y - b.y);
    for (const p of ps) safeDraw('player', () => p.slot === undefined ? drawRef(ctx, p, G) : drawPlayer(ctx, p, G));
    if (G.mini) safeDraw('mini', () => drawMini(ctx, G));
    safeDraw('ball', () => { if (G.ball) drawBallFree(ctx, G); drawAim(ctx, G); drawMeter(ctx, G); drawFlightMeter(ctx, G); });
    safeDraw('fx', () => { drawFx(ctx, G); drawWeather(ctx, G); });
  }
  ctx.restore();
  zoomDone();
  if (G.teams && !G.demo) {
    if (G.phase === 'replay') safeDraw('replay', () => Replay.drawOverlay(ctx));
    else if (G.phase === 'review') safeDraw('review', () => { Review.drawOverlay(ctx); drawBanner(ctx, G); });
    else if (Highlights.on) safeDraw('hl', () => Highlights.drawOverlay(ctx));
    else safeDraw('hud', () => { drawBanner(ctx, G); if (G.mini) drawMiniHUD(ctx, G); else { drawHUD(ctx, G); drawTicker(ctx, G); } drawKickMeter(ctx, G); });
  }
}
// draw one piece; if it throws, put the canvas state back and keep going (the rest of the frame still shows)
const drawErrs = {};
function safeDraw(name, f, onFail) {
  ctx.save();
  try { f(); } catch (e) {
    if (!drawErrs[name] || performance.now() - drawErrs[name] > 5000) { drawErrs[name] = performance.now(); console.error('draw ' + name, e); }
    if (onFail) try { onFail(); } catch (e2) {}
  }
  ctx.restore();
}

requestAnimationFrame(frame);

// ---------- install as an app (home screen icon, full screen, works offline) ----------
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('btnInstall').style.display = ''; });
$('btnInstall').onclick = async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; $('btnInstall').style.display = 'none'; };
window.addEventListener('appinstalled', () => { $('btnInstall').style.display = 'none'; });

// ---------- ONLINE: host a game (get a code) or join with your friend's code ----------
screens.push('online'); menuScreens.push('online');
function renderOnlineTeam() {
  const t = TEAMS[sel.idx[sel.you]];
  $('onTeam').innerHTML = `<span class="dot" style="background:${t.c1}"></span>${t.city} ${t.name}  <b>${teamOvr(t)} OVR</b>`;
}
function openOnline(msg) {
  $('onCodeBox').style.display = 'none'; $('onJoinBox').style.display = 'none'; $('onPick').style.display = '';
  $('onStatus').textContent = msg || 'Play a friend on another phone or computer. One of you hosts and gets a code, the other types it in.';
  renderOnlineTeam(); show('online');
}
function onlineMsg(t) { onlineWait(null); openOnline(t); }
function onlineWait(t) { const el = $('onWait'); el.textContent = t || ''; el.style.display = t ? 'block' : 'none'; }
$('btnOnline').onclick = () => { Sound.init(); Sound.click(); openOnline(); };
$('onPrev').onclick = () => { sel.idx[sel.you] = (sel.idx[sel.you] + 31) % 32; Sound.click(); renderOnlineTeam(); };
$('onNext').onclick = () => { sel.idx[sel.you] = (sel.idx[sel.you] + 1) % 32; Sound.click(); renderOnlineTeam(); };
$('onBack').onclick = () => { Net.reset(); show('title'); };
$('onHost').onclick = () => {
  Sound.click(); if (G.mode === 'mobile') goFullscreen();
  if (typeof Peer === 'undefined') { $('onStatus').textContent = "Online play couldn't load. Check your internet and refresh."; return; }
  $('onPick').style.display = 'none'; $('onCodeBox').style.display = ''; $('onCode').textContent = '....';
  $('onStatus').textContent = 'Getting a code...';
  Net.host(code => { $('onCode').textContent = code; $('onStatus').textContent = 'Tell your friend this code. The game starts when they join. Keep this screen open.'; },
    st => { $('onStatus').textContent = st; });
};
$('onJoin').onclick = () => { Sound.click(); $('onPick').style.display = 'none'; $('onJoinBox').style.display = ''; $('onCodeIn').value = ''; $('onCodeIn').focus(); $('onStatus').textContent = 'Type the 4-letter code from your friend\'s screen.'; };
$('onGo').onclick = () => {
  const code = $('onCodeIn').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { $('onStatus').textContent = 'Codes are 4 letters/numbers.'; return; }
  if (typeof Peer === 'undefined') { $('onStatus').textContent = "Online play couldn't load. Check your internet and refresh."; return; }
  Sound.click(); if (G.mode === 'mobile') goFullscreen();
  $('onStatus').textContent = 'CONNECTING...';
  Net.join(code, st => { $('onStatus').textContent = st; });
};
$('onCodeIn').addEventListener('keydown', e => { if (e.code === 'Enter') $('onGo').onclick(); e.stopPropagation(); });

// play-call shortcuts on a keyboard: K = kneel, X = spike (only when they'd show as buttons)
addEventListener('keydown', e => {
  if (!$('playcall').classList.contains('show') || pcCtx.mode !== 'off') return;
  const btn = [...document.querySelectorAll('#pcHint .tool')].find(b => b.textContent === (e.code === 'KeyK' ? 'KNEEL' : e.code === 'KeyX' ? 'SPIKE' : '-'));
  if (btn) { e.preventDefault(); btn.click(); }
});
