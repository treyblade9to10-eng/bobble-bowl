// ---- Menus, play-call cards, main loop ----
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const screens = ['title', 'how', 'select', 'playcall', 'over', 'pause'];
function show(id) { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); for (const s of screens) $(s).classList.toggle('show', s === id); $('btnPause').style.display = (id === 'playcall' || id === null) && G.teams ? 'block' : 'none'; }

let myTeam = null, oppTeam = null;

// ---------- title ----------
$('btnPlay').onclick = () => { Sound.init(); Sound.click(); buildGrid(); show('select'); };
$('btnHow').onclick = () => { Sound.init(); show('how'); };
$('btnHowBack').onclick = () => show('title');
$('btnMute').onclick = () => { Sound.muted = !Sound.muted; $('btnMute').textContent = Sound.muted ? '🔇' : '🔊'; };

// ---------- team select ----------
function buildGrid() {
  const grid = $('teamGrid'); grid.innerHTML = '';
  let lastConf = '';
  for (const t of TEAMS) {
    if (t.conf !== lastConf) { lastConf = t.conf; const l = document.createElement('div'); l.className = 'conf-label'; l.textContent = t.conf; grid.appendChild(l); }
    const c = document.createElement('div');
    c.className = 'tcard'; c.style.background = `linear-gradient(160deg, ${t.c1} 60%, ${t.c2})`; c.style.color = textOn(t.c1);
    c.innerHTML = `<div class="ab">${t.id}</div><div class="nm">${t.city}<br>${t.name}</div>`;
    c.onclick = () => pickTeam(t);
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
    c.classList.toggle('mine', myTeam && c.dataset.id === myTeam.id);
    c.classList.toggle('opp', oppTeam && c.dataset.id === oppTeam.id);
  });
  $('selectTitle').textContent = !myTeam ? 'Pick YOUR team' : !oppTeam ? 'Now pick who you play' : 'Ready!';
  $('matchup').innerHTML = myTeam ? `<b>${myTeam.city} ${myTeam.name}</b> vs ${oppTeam ? `<b>${oppTeam.city} ${oppTeam.name}</b>` : '???'}` : '';
  $('btnKick').disabled = !(myTeam && oppTeam);
}
function peek(t) {
  const row = p => `<div><span class="pos">${p[0]}</span>#${p[2]} ${p[1]} <b>${p[3]}</b></div>`;
  $('rosterPeek').innerHTML = `<div style="font-size:16px;margin-bottom:4px"><b>${t.city} ${t.name}</b></div>
    <div style="opacity:.7;margin:4px 0 2px">OFFENSE</div>${t.off.map(row).join('')}
    <div style="opacity:.7;margin:6px 0 2px">DEFENSE</div>${t.def.map(row).join('')}`;
  $('rosterPeek').style.display = 'block';
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
  G.demo = false; show(null);
  newGame(myTeam, oppTeam, { qtr: +$('optQtr').value, diff: +$('optDiff').value });
}

// ---------- play calling ----------
let pcList = [], pcSel = 0;
G.hooks.onPlayCall = c => {
  const humanOff = c.mode === 'off';
  const head = $('pcHead');
  if (c.mode === 'pat') {
    head.innerHTML = 'TOUCHDOWN! Go for one or two?';
    pcList = [{ key: 'xp', name: 'Extra Point', desc: 'Easy kick for 1 point.', special: true },
              { key: 'two', name: 'Go For 2', desc: 'One play from the 3-yard line.', special: true }];
  } else {
    const t = G.teams[G.poss];
    head.innerHTML = `${humanOff ? '🏈 OFFENSE' : '🛡️ DEFENSE'} — ${G.downText()}`;
    pcList = humanOff ? OFF_PLAYS.slice() : DEF_PLAYS.slice();
    if (c.fourth && humanOff) pcList = pcList.concat(SPECIAL_PLAYS.map(s => s.key === 'fg' ? { ...s, desc: `${c.fgDist}-yard kick. ${c.fgDist > 50 ? 'Long shot!' : ''}` } : s));
  }
  const box = $('pcCards'); box.innerHTML = '';
  pcList.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'pcard' + (p.special ? ' special' : '');
    el.innerHTML = `<span class="k">${i + 1}</span><div class="t">${p.name}</div>`;
    const mini = document.createElement('canvas'); mini.width = 120; mini.height = 72;
    if (p.key === 'xp' || p.key === 'two') { const g = mini.getContext('2d'); g.fillStyle = '#3a8a3c'; g.fillRect(0, 0, 120, 72); g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText(p.key === 'xp' ? '🦶' : '✌️', 60, 48); }
    else drawPlayDiagram(mini, p, humanOff);
    el.appendChild(mini);
    const d = document.createElement('div'); d.className = 'd'; d.textContent = p.desc; el.appendChild(d);
    el.onclick = () => choose(i);
    box.appendChild(el);
  });
  pcSel = 0;
  $('pcHint').textContent = 'Click a play or press its number';
  show('playcall');
};
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
  const me = s.human, them = 1 - me;
  const won = s.score[me] > s.score[them], tie = s.score[me] === s.score[them];
  $('overTitle').textContent = won ? '🏆 YOU WIN! 🏆' : tie ? 'TIE GAME' : 'YOU LOST 😬';
  $('overScore').innerHTML = `<span style="color:${s.teams[1].c1 === '#000000' ? '#aaa' : s.teams[1].c1};-webkit-text-stroke:1px #fff">${s.teams[1].id}</span> ${s.score[1]} - ${s.score[0]} <span style="color:${s.teams[0].c1 === '#000000' ? '#aaa' : s.teams[0].c1};-webkit-text-stroke:1px #fff">${s.teams[0].id}</span>`;
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
  if (!G.teams || G.phase === 'over') return;
  G.paused = !G.paused;
  if (G.paused) { G.pauseFrom = $('playcall').classList.contains('show') ? 'playcall' : null; show('pause'); }
  else show(G.pauseFrom);
}
$('btnPause').onclick = togglePause;
$('btnResume').onclick = togglePause;
$('btnQuit').onclick = () => { G.paused = false; G.teams = null; G.phase = 'idle'; show('title'); };
window.addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP') togglePause(); });

// clicks on the canvas → world clicks (for throwing)
cv.addEventListener('pointerdown', e => {
  Sound.init();
  const r = cv.getBoundingClientRect();
  Input.clicks.push({ x: (e.clientX - r.left) * CW / r.width, y: (e.clientY - r.top) * CH / r.height });
});

// ---------- title screen background: a fake game ----------
function demoSetup() {
  const a = pick(TEAMS); let b; do { b = pick(TEAMS); } while (b === a);
  Object.assign(G, { teams: [a, b], human: -1, diff: 1, poss: 0, los: 45, ballY: MID, down: 1, score: [0, 0], quarter: 1, clock: 180, demo: true, fx: [] });
  setFirstDown();
  setupPlay(pick(OFF_PLAYS), pick(DEF_PLAYS));
  snap();
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  const inMenu = $('title').classList.contains('show') || $('how').classList.contains('show') || $('select').classList.contains('show');
  if (inMenu) {
    if (!G.demo || G.phase === 'over') demoSetup();
    if (G.phase === 'live' && G.play.t > 7) G.phase = 'dead';
    if ((G.phase === 'dead' && G.deadT < 0.4) || G.phase === 'playcall' || G.phase === 'kick') demoSetup();
    G.next = null;
    update(dt);
  } else {
    if (G.demo) { G.demo = false; }
    update(dt);
  }
  render();
  Input.endFrame();
  requestAnimationFrame(frame);
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, CW, CH);
  if (cam.shake > 0.3) ctx.translate(rand(-cam.shake, cam.shake), rand(-cam.shake, cam.shake));
  if (G.teams) {
    drawField(ctx, G);
    drawLines(ctx, G);
    const ps = G.players.slice().sort((a, b) => a.y - b.y);
    for (const p of ps) drawPlayer(ctx, p, G);
    if (G.ball) drawBallFree(ctx, G);
    drawFx(ctx, G);
  }
  ctx.restore();
  if (G.teams && !G.demo) { drawBanner(ctx, G); drawHUD(ctx, G); }
}

// in demo mode the "human" is nobody, so the hooks shouldn't open menus
const realPlayCall = G.hooks.onPlayCall;
G.hooks.onPlayCall = c => { if (G.demo) return; realPlayCall(c); };
const realOver = G.hooks.onGameOver;
G.hooks.onGameOver = s => { if (G.demo) return; realOver(s); };

requestAnimationFrame(frame);
