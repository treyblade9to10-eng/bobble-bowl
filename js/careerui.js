// ---- My Player + Trophy Case screens ----
screens.push('cap', 'trophies');
let capForm = null, capAnim = null;

$('btnCap').onclick = () => { Sound.init(); Sound.click(); openCap(); };
$('btnTrophies').onclick = () => { Sound.init(); Sound.click(); renderTrophies(); show('trophies'); };
$('troBack').onclick = () => show('title');

function openCap() {
  Career.load();
  if (Career.cap) renderCapCard();
  else {
    capForm = capForm || { name: '', pos: 'QB', arch: CAP_ARCH.QB[0][0], num: 7, skin: 2, team: TEAMS[sel.idx[sel.you]].id };
    renderCapForm();
  }
  show('cap');
}

// spinning-free little bobblehead preview of your guy
function capPreview(tuple, teamId) {
  cancelAnimationFrame(capAnim);
  const cvp = $('capCv'); if (!cvp) return;
  const g = cvp.getContext('2d'), team = TEAMS.find(t => t.id === teamId);
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

function renderCapForm() {
  const f = capForm;
  const skins = SKIN.map((c, i) => `<button class="sw${i === f.skin ? ' on' : ''}" data-i="${i}" style="background:${c}" title="Skin ${i + 1}"></button>`).join('');
  $('capBody').innerHTML = `<div class="capWrap">
    <div class="capPrev"><canvas id="capCv" width="260" height="310"></canvas></div>
    <div class="capFields">
      <label>Name <input id="capName" maxlength="18" placeholder="First Last" value="${f.name.replace(/"/g, '')}"></label>
      <label>Position <select id="capPos">${CAP_POS.map(p => `<option${p === f.pos ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
      <label>Style <select id="capArch">${CAP_ARCH[f.pos].map(a => `<option${a[0] === f.arch ? ' selected' : ''}>${a[0]}</option>`).join('')}</select></label>
      <label>Number <input id="capNum" type="number" min="0" max="99" value="${f.num}"></label>
      <div class="capSkin">Skin <span>${skins}</span></div>
      <label>Team <select id="capTeam">${TEAMS.map(t => `<option value="${t.id}"${t.id === f.team ? ' selected' : ''}>${t.city} ${t.name}</option>`).join('')}</select></label>
      <div class="capNote">He starts at 62 overall. Play games with his team to earn XP and level him up. Hit 85 and he unlocks an X-Factor.</div>
      <div class="row"><button class="big" id="capCreate">CREATE</button><button id="capBack">BACK</button></div>
    </div></div>`;
  const read = () => {
    f.name = $('capName').value.trim(); f.pos = $('capPos').value; f.num = clamp(parseInt($('capNum').value, 10) || 0, 0, 99); f.team = $('capTeam').value;
    if (!CAP_ARCH[f.pos].some(a => a[0] === f.arch)) f.arch = CAP_ARCH[f.pos][0][0];
    else f.arch = $('capArch').value;
  };
  const preview = () => { const a = CAP_ARCH[f.pos].find(x => x[0] === f.arch)[1]; capPreview([f.pos, f.name || 'My Player', f.num, 62, a.spd, f.skin], f.team); };
  $('capPos').onchange = () => { read(); renderCapForm(); };
  for (const id of ['capArch', 'capNum', 'capTeam']) $(id).onchange = () => { read(); preview(); };
  $('capName').oninput = () => { f.name = $('capName').value; };
  document.querySelectorAll('.capSkin .sw').forEach(b => b.onclick = () => { read(); f.skin = +b.dataset.i; renderCapForm(); });
  $('capBack').onclick = () => { cancelAnimationFrame(capAnim); show('title'); };
  $('capCreate').onclick = () => {
    read();
    if (f.name.length < 2) { $('capName').focus(); $('capName').classList.add('bad'); return; }
    Career.create(f); Sound.td(); renderCapCard();
  };
  // keys typed into the name box shouldn't move players around
  $('capName').addEventListener('keydown', e => e.stopPropagation());
  preview();
}

function renderCapCard() {
  const c = Career.cap, team = TEAMS.find(t => t.id === c.team), need = Career.need(c.ovr);
  const st = c.stats, bits = [];
  if (c.pos === 'QB' || st.pass) bits.push(`${st.pass} pass yds`);
  if (st.rush || c.pos === 'RB') bits.push(`${st.rush} rush yds`);
  if (st.rec || c.pos === 'WR' || c.pos === 'TE') bits.push(`${st.rec} rec yds`);
  bits.push(`${st.td} TD`);
  if (!['QB', 'RB', 'WR', 'TE'].includes(c.pos)) bits.push(`${st.tkl} tackles`, `${st.sack} sacks`, `${st.int} INT`);
  const rat = [`SPD ${Math.round(c.spd)}`].concat(c.pos === 'QB' ? [`THROW POWER ${Math.round(c.thp)}`, `ACCURACY ${Math.round(c.tha)}`, `MAX RANGE ${Math.round(18 + c.thp * 0.52)} YDS`] : []);
  $('capBody').innerHTML = `<div class="capWrap">
    <div class="capPrev"><canvas id="capCv" width="260" height="310"></canvas></div>
    <div class="capInfo">
      <div class="capName">${c.name}</div>
      <div class="capSub">#${c.num} ${c.pos}  ·  ${c.arch}  ·  ${team.city} ${team.name}</div>
      <div class="capOvr"><b>${c.ovr}</b> OVR${c.ovr >= 85 ? '<span class="xfTag">X-FACTOR</span>' : ''}</div>
      <div class="xpbar"><i style="width:${c.ovr >= 99 ? 100 : Math.round(100 * c.xp / need)}%"></i></div>
      <div class="xptext">${c.ovr >= 99 ? 'Maxed out' : `${c.xp} / ${need} XP to ${c.ovr + 1}`}</div>
      <div class="capRat">${rat.join('   ')}</div>
      <div class="capStats"><b>${c.games}</b> games  ·  ${bits.join('  ·  ')}</div>
      ${c.log.length ? `<div class="capLog">${c.log.slice(0, 5).map(l => `<span>vs ${l.vs} ${l.score} <b>+${l.xp}</b></span>`).join('')}</div>` : '<div class="capLog">No games yet. Go get some XP.</div>'}
      <div class="row"><button class="big" id="capPlay">PLAY A GAME</button><button id="capBack">BACK</button><button id="capRetire">RETIRE</button></div>
    </div></div>`;
  $('capBack').onclick = () => { cancelAnimationFrame(capAnim); show('title'); };
  $('capRetire').onclick = () => { if (confirm(`Retire ${c.name}? This deletes him for good.`)) { Career.retire(); capForm = null; openCap(); } };
  $('capPlay').onclick = () => {
    const i = TEAMS.findIndex(t => t.id === c.team);
    sel.idx[sel.you] = i; if (sel.idx[1 - sel.you] === i) sel.idx[1 - sel.you] = (i + 7) % TEAMS.length;
    modeAfter = 'select'; renderSelect(); show('select');
  };
  capPreview(Career.tuple(), c.team);
}

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
  const c = Career.cap;
  $('troBody').innerHTML = `<div class="shelf">${titles}</div>
    <div class="troCols">
      <div class="troBox"><div class="troHead">RECORDS</div>${rec.map(([k, v]) => `<div class="rRow"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <div class="troBox"><div class="troHead">AWARDS</div>${aw}
        ${c ? `<div class="troHead" style="margin-top:10px">MY PLAYER</div><div class="rRow"><span>${c.name}, ${c.pos}</span><b>${c.ovr} OVR</b></div>` : ''}</div>
    </div>`;
}
