// ---- Menus, mode select, controls, play-call cards, main loop ----
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const screens = ['title', 'mode', 'how', 'select', 'playcall', 'over', 'pause'];
function show(id) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  for (const s of screens) $(s).classList.toggle('show', s === id);
  $('btnPause').style.display = (id === 'playcall' || id === null) && G.teams && !G.demo ? 'block' : 'none';
}

let myTeam = null, oppTeam = null;

// ---------- Mobile / Computer mode ----------
const looksTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && Math.min(screen.width, screen.height) < 900;
let modeAfter = 'select'; // where to go after picking a mode
function setMode(m) {
  G.mode = m;
  try { localStorage.setItem('bobbleMode', m); } catch (e) {}
  document.body.classList.toggle('mobile', m === 'mobile');
  $('modeLabel').textContent = m === 'mobile' ? '📱 MOBILE' : '💻 COMPUTER';
  document.querySelectorAll('.modecard').forEach(c => c.classList.toggle('sel', c.dataset.mode === m));
  buildHow();
}
let savedMode = null; try { savedMode = localStorage.getItem('bobbleMode'); } catch (e) {}
setMode(savedMode || (looksTouch ? 'mobile' : 'computer'));
document.querySelectorAll('.modecard').forEach(c => c.onclick = () => {
  Sound.init(); Sound.click(); setMode(c.dataset.mode);
  if (c.dataset.mode === 'mobile') goFullscreen();
  if (modeAfter === 'select') { buildGrid(); show('select'); } else show('title');
});
function goFullscreen() {
  const el = document.documentElement;
  try { (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}

function buildHow() {
  const m = G.mode === 'mobile';
  $('howGrid').innerHTML = m ? `
    <div><h3>🏈 Offense</h3>
      <p><b>Tap a play</b>, then <b>tap the field</b> to snap.</p>
      <p><b>Pass:</b> put your finger down, <b>DRAG BACK</b> (like a slingshot) and let go. Pull further = throw further. The yellow ring shows where it lands.</p>
      <p>Or just <b>tap a receiver's ▲</b> to throw to him.</p>
      <p><b>🏃 RUN</b> button = QB takes off.</p></div>
    <div><h3>🏃 Running</h3>
      <p>Your runner <b>runs on his own</b>. <b>Hold your finger</b> where you want him to go.</p>
      <p><b>Tap</b> = juke. <b>🌀 SPIN</b> and <b>✋ STIFF</b> arm buttons break tackles.</p></div>
    <div><h3>🛡️ Defense</h3>
      <p><b>Hold</b> to move your player (yellow ring). Let go and he plays on his own.</p>
      <p><b>Tap near the runner</b> = dive tackle. <b>Tap a teammate</b> to switch to him.</p></div>`
  : `
    <div><h3>🏈 Offense</h3>
      <p><b>Pick a play</b> (1-9), <b>SPACE</b> to snap.</p>
      <p>Throw: <b>1 2 3 4</b>, <b>click</b> a receiver, or <b>drag back with the mouse</b> and let go to throw to that spot.</p>
      <p>Move the QB with <b>WASD</b>; run past the line to scramble.</p></div>
    <div><h3>🏃 Running</h3>
      <p><b>WASD</b> move, <b>SHIFT</b> sprint.</p>
      <p><b>E</b> juke, <b>F</b> spin, <b>R</b> stiff arm.</p></div>
    <div><h3>🛡️ Defense</h3>
      <p>You control the player with the <b>yellow ring</b>.</p>
      <p><b>Q</b> switch to the guy closest to the ball, <b>SPACE</b> dive tackle, <b>SHIFT</b> sprint.</p></div>`;
}

// ---------- title ----------
$('btnPlay').onclick = () => { Sound.init(); Sound.click(); modeAfter = 'select'; show('mode'); };
$('btnMode').onclick = () => { Sound.init(); modeAfter = 'title'; show('mode'); };
$('btnHow').onclick = () => { Sound.init(); show('how'); };
$('btnHowBack').onclick = () => show('title');
$('btnMute').onclick = () => { Sound.muted = !Sound.muted; $('btnMute').textContent = Sound.muted ? '🔇' : '🔊'; };

// ---------- team select ----------
function teamOvr(t) { const all = t.off.concat(t.def); return Math.round(all.reduce((a, p) => a + p[3], 0) / all.length); }
function buildGrid() {
  const grid = $('teamGrid'); grid.innerHTML = '';
  let lastConf = '';
  for (const t of TEAMS) {
    if (t.conf !== lastConf) { lastConf = t.conf; const l = document.createElement('div'); l.className = 'conf-label'; l.textContent = t.conf; grid.appendChild(l); }
    const c = document.createElement('div');
    c.className = 'tcard'; c.style.background = `linear-gradient(160deg, ${t.c1} 60%, ${t.c2})`; c.style.color = textOn(t.c1);
    c.innerHTML = `<div class="ab">${t.id}</div><div class="nm">${t.name}<br>${teamOvr(t)} OVR</div>`;
    c.onclick = () => { pickTeam(t); peek(t); };
    c.onmouseenter = () => peek(t); c.onmouseleave = () => $('rosterPeek').style.display = 'none';
    c.dataset.id = t.id;
    grid.appendChild(c);
  }
  refreshSelect();
}
function pickTeam(t) {
  Sound.click();
  if (!myTeam || (myTeam && oppTeam)) { myTeam = t; oppTeam = null; }
  else if (t === myTeam) { myTeam = null; }
  else oppTeam = t;
  refreshSelect();
}
function refreshSelect() {
  document.querySelectorAll('.tcard').forEach(c => {
    c.classList.toggle('mine', !!myTeam && c.dataset.id === myTeam.id);
    c.classList.toggle('opp', !!oppTeam && c.dataset.id === oppTeam.id);
  });
  $('selectTitle').textContent = !myTeam ? 'Pick YOUR team' : !oppTeam ? 'Now pick who you play' : 'Ready!';
  $('matchup').innerHTML = myTeam ? `<b>${myTeam.city} ${myTeam.name}</b> vs ${oppTeam ? `<b>${oppTeam.city} ${oppTeam.name}</b>` : '???'}` : '';
  $('btnKick').disabled = !(myTeam && oppTeam);
}
function peek(t) {
  const row = p => `<div><span class="pos">${p[0]}</span>#${p[2]} ${p[1]} <b>${p[3]}</b> <span style="opacity:.6">SPD ${p[4]}</span></div>`;
  $('rosterPeek').innerHTML = `<div style="font-size:16px;margin-bottom:4px"><b>${t.city} ${t.name}</b> — ${teamOvr(t)} OVR</div>
    <div style="opacity:.7;margin:4px 0 2px">OFFENSE</div>${t.off.map(row).join('')}
    <div style="opacity:.7;margin:6px 0 2px">DEFENSE</div>${t.def.map(row).join('')}
    <div style="opacity:.5;margin-top:6px;font-size:11px">Madden 27 ratings • rosters as of Oct 7, 2026</div>`;
  $('rosterPeek').style.display = G.mode === 'mobile' ? 'none' : 'block';
}
$('btnRandomOpp').onclick = () => {
  if (!myTeam) myTeam = pick(TEAMS);
  do { oppTeam = pick(TEAMS); } while (oppTeam === myTeam);
  refreshSelect();
};
$('btnBackSel').onclick = () => { $('rosterPeek').style.display = 'none'; show('title'); };
$('btnKick').onclick = startGame;

function startGame() {
  $('rosterPeek').style.display = 'none';
  Sound.init(); Sound.whistle(); Sound.crowd(false);
  if (G.mode === 'mobile') goFullscreen();
  G.demo = false; show(null);
  newGame(myTeam, oppTeam, { qtr: +$('optQtr').value, diff: +$('optDiff').value });
}

// ---------- play calling ----------
let pcList = [];
function onPlayCall(c) {
  const humanOff = c.mode === 'off';
  if (c.mode === 'pat') {
    $('pcHead').innerHTML = 'TOUCHDOWN! Go for one or two?';
    pcList = [{ key: 'xp', name: 'Extra Point', desc: 'Easy kick for 1 point.', special: true },
              { key: 'two', name: 'Go For 2', desc: 'One play from the 3-yard line.', special: true }];
  } else {
    $('pcHead').innerHTML = `${humanOff ? '🏈 OFFENSE' : '🛡️ DEFENSE'} — ${G.downText()}`;
    pcList = humanOff ? OFF_PLAYS.slice() : DEF_PLAYS.slice();
    if (c.fourth && humanOff) pcList = SPECIAL_PLAYS.map(s => s.key === 'fg' ? { ...s, desc: `${c.fgDist}-yard kick. ${c.fgDist > 50 ? 'Long shot!' : ''}` } : s).concat(pcList);
  }
  const box = $('pcCards'); box.innerHTML = '';
  pcList.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'pcard' + (p.special ? ' special' : '');
    el.innerHTML = `<span class="k">${G.mode === 'mobile' ? (p.type === 'run' ? 'RUN' : p.type === 'pass' ? 'PASS' : '') : i + 1}</span><div class="t">${p.name}</div>`;
    const mini = document.createElement('canvas'); mini.width = 120; mini.height = 72;
    if (p.key === 'xp' || p.key === 'two') { const g = mini.getContext('2d'); g.fillStyle = '#3a8a3c'; g.fillRect(0, 0, 120, 72); g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText(p.key === 'xp' ? '🦶' : '✌️', 60, 48); }
    else drawPlayDiagram(mini, p, humanOff);
    el.appendChild(mini);
    const d = document.createElement('div'); d.className = 'd'; d.textContent = p.desc; el.appendChild(d);
    let sx0 = 0;
    el.addEventListener('pointerdown', e => { sx0 = e.clientX; });
    el.addEventListener('click', e => { if (Math.abs(e.clientX - sx0) < 12) choose(i); });
    box.appendChild(el);
  });
  $('pcHint').textContent = G.mode === 'mobile' ? 'Tap a play (swipe for more)' : 'Click a play or press its number';
  show('playcall');
}
G.hooks.onPlayCall = c => { if (!G.demo) onPlayCall(c); };
function choose(i) {
  const p = pcList[i]; if (!p || G.phase !== 'playcall') return;
  Sound.click();
  show(null);
  if (p.key === 'xp' || p.key === 'two') choosePAT(p.key);
  else choosePlay(p.key);
}
window.addEventListener('keydown', e => {
  if (!$('playcall').classList.contains('show')) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= pcList.length) choose(n - 1);
});

// ---------- game over ----------
G.hooks.onGameOver = s => {
  if (G.demo) return;
  const me = s.human, them = 1 - me;
  const won = s.score[me] > s.score[them], tie = s.score[me] === s.score[them];
  $('overTitle').textContent = won ? '🏆 YOU WIN! 🏆' : tie ? 'TIE GAME' : 'YOU LOST 😬';
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
  Sound[won ? 'td' : 'bad']();
  setTimeout(() => show('over'), 1200);
};
$('btnAgain').onclick = () => { show(null); startGame(); };
$('btnNewTeams').onclick = () => { G.teams = null; myTeam = oppTeam = null; buildGrid(); show('select'); };

// ---------- pause ----------
function togglePause() {
  if (!G.teams || G.phase === 'over' || G.demo) return;
  G.paused = !G.paused;
  if (G.paused) { G.pauseFrom = $('playcall').classList.contains('show') ? 'playcall' : null; show('pause'); }
  else show(G.pauseFrom);
}
$('btnPause').onclick = togglePause;
$('btnResume').onclick = togglePause;
$('btnQuit').onclick = () => { G.paused = false; G.teams = null; G.phase = 'idle'; show('title'); };
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
  if (P.aiming) Input.release = { x: P.x0 - P.x, y: P.y0 - P.y };
  else if (!P.moved && quick) Input.taps.push({ x: P.x, y: P.y });
  P.down = false; P.moved = false; P.aiming = false;
};
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('contextmenu', e => e.preventDefault());

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
  if (st === mbState) return;
  mbState = st;
  document.querySelectorAll('#mbtns button').forEach(x => x.classList.toggle('on', x.dataset.show === st));
}

// ---------- title screen background: a fake game ----------
function demoSetup() {
  const a = pick(TEAMS); let b; do { b = pick(TEAMS); } while (b === a);
  Object.assign(G, { teams: [a, b], human: -1, diff: 1, poss: 0, los: rand(30, 70), ballY: MID, down: 1, score: [0, 0], quarter: 1, clock: 180, demo: true, fx: [],
    pstats: {}, tstats: [{ pass: 0, rush: 0, to: 0 }, { pass: 0, rush: 0, to: 0 }], patSide: null, twoPt: false, next: null, paused: false, slowmo: 0, banner: null });
  setFirstDown();
  setupPlay(pick(OFF_PLAYS), pick(DEF_PLAYS));
  snap();
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); // schedule first so one bad frame can't freeze the game
  try { step(now); } catch (e) { console.error(e); if (G.demo) G.phase = 'over'; }
}
function step(now) {
  const dt = clamp((now - last) / 1000, 0, 0.033); last = now;
  if (Input.pointer.down) Input.pointer.t += dt;
  const inMenu = ['title', 'how', 'select', 'mode'].some(id => $(id).classList.contains('show'));
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
    drawLines(ctx, G);
    drawRoutes(ctx, G);
    const ps = G.players.slice().sort((a, b) => a.y - b.y);
    for (const p of ps) drawPlayer(ctx, p, G);
    if (G.ball) drawBallFree(ctx, G);
    drawAim(ctx, G);
    drawFx(ctx, G);
  }
  ctx.restore();
  if (G.teams && !G.demo) { drawBanner(ctx, G); drawHUD(ctx, G); }
}

requestAnimationFrame(frame);
