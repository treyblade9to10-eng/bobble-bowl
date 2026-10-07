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

// ---------- team select: AWAY (left) vs HOME (right), arrows to scroll ----------
function teamOvr(t) { const all = t.off.concat(t.def); return Math.round(all.reduce((a, p) => a + p[3], 0) / all.length); }
const sel = { idx: [TEAMS.findIndex(t => t.id === 'KC'), TEAMS.findIndex(t => t.id === 'PHI')], you: 0 }; // idx[0] = home, idx[1] = away
try { const saved = JSON.parse(localStorage.getItem('bobbleSel') || 'null'); if (saved) Object.assign(sel, saved); } catch (e) {}
function teamCard(t) {
  const ovr = teamOvr(t), offO = Math.round(t.off.reduce((a, p) => a + p[3], 0) / 8), defO = Math.round(t.def.reduce((a, p) => a + p[3], 0) / 8);
  const stars = t.off.concat(t.def).slice().sort((a, b) => b[3] - a[3]).slice(0, 5);
  return `<div class="ab">${t.id}</div><div class="nm">${t.city}<br>${t.name}</div>
    <div class="ov">${ovr} OVR</div><div style="font-size:12px;margin-bottom:6px;text-shadow:1px 1px 0 #000">OFF ${offO} • DEF ${defO}</div>
    <div class="stars">${stars.map(p => `<div>${p[0]} <b>${p[3]}</b> #${p[2]} ${p[1]}</div>`).join('')}</div>
    <div class="cnt">${TEAMS.indexOf(t) + 1} / ${TEAMS.length}</div>`;
}
function renderSelect(bumpSide) {
  for (const [side, id] of [[0, 'pHome'], [1, 'pAway']]) {
    const t = TEAMS[sel.idx[side]], el = $(id).querySelector('.tbig');
    el.innerHTML = teamCard(t);
    el.style.background = `linear-gradient(160deg, ${t.c1} 55%, ${t.c2})`; el.style.color = textOn(t.c1);
    const who = $(id).querySelector('.who');
    who.textContent = sel.you === side ? 'YOU' : 'CPU'; who.className = 'who ' + (sel.you === side ? 'you' : 'cpu');
    if (bumpSide === side) { el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 120); }
  }
  $('selHint').textContent = G.mode === 'mobile' ? 'Tap the arrows to change teams' : 'Arrows to change teams  •  W/S = away  •  ↑/↓ = home  •  ENTER = kickoff';
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

function startGame() {
  Sound.init(); Sound.whistle(); Sound.crowd(false);
  if (G.mode === 'mobile') goFullscreen();
  G.demo = false; show(null);
  newGame(TEAMS[sel.idx[0]], TEAMS[sel.idx[1]], { qtr: +$('optQtr').value, diff: +$('optDiff').value, humanSide: sel.you });
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

// ---------- game over / YOU WIN ----------
let mvpAnim = null;
G.hooks.onGameOver = s => {
  if (G.demo) return;
  const me = s.human, them = 1 - me;
  const won = s.score[me] > s.score[them], tie = s.score[me] === s.score[them];
  $('over').classList.toggle('win', won);
  $('overTitle').textContent = won ? 'YOU WIN!' : tie ? 'TIE GAME' : 'GAME OVER';
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
$('btnAgain').onclick = () => { show(null); startGame(); };
$('btnNewTeams').onclick = () => { G.teams = null; renderSelect(); show('select'); };

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

// joystick (mobile)
(function joystick() {
  const joy = $('joy'), knob = $('joyKnob'); let id = null;
  const set = e => {
    const r = joy.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    Input.stick.x = x; Input.stick.y = y; Input.stick.m = Math.min(1, m);
    knob.style.left = (43 + x * 45) + 'px'; knob.style.top = (43 + y * 45) + 'px';
  };
  const reset = () => { id = null; Input.stick.x = Input.stick.y = Input.stick.m = 0; knob.style.left = knob.style.top = '43px'; };
  joy.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; try { joy.setPointerCapture(id); } catch (_) {} set(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
  joy.addEventListener('pointerup', e => { if (e.pointerId === id) reset(); });
  joy.addEventListener('pointercancel', reset);
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
  const joyOn = G.phase === 'live' && !G.demo && h && (st === 'def' || st === 'carrier');
  $('joy').classList.toggle('on', !!joyOn);
  if (!joyOn && Input.stick.m) { Input.stick.x = Input.stick.y = Input.stick.m = 0; }
  const key = st + (b && b.flight ? 'air' : '') + (h && h.engaged ? 'eng' : '');
  if (key === mbState) return;
  mbState = key;
  document.querySelectorAll('#mbtns button').forEach(x => x.classList.toggle('on', x.dataset.show === st));
  $('mbDive').textContent = b && b.flight ? '🙌 JUMP' : '💥 DIVE';
  $('mbSwim').style.display = st === 'def' && h && h.engaged ? 'block' : 'none';
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
    const ps = G.players.concat(G.refs || []).sort((a, b) => a.y - b.y);
    for (const p of ps) p.slot === undefined ? drawRef(ctx, p, G) : drawPlayer(ctx, p, G);
    if (G.ball) drawBallFree(ctx, G);
    drawAim(ctx, G);
    drawFx(ctx, G);
  }
  ctx.restore();
  if (G.teams && !G.demo) { drawBanner(ctx, G); drawHUD(ctx, G); drawKickMeter(ctx, G); }
}

requestAnimationFrame(frame);
