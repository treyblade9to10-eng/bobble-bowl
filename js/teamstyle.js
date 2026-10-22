// ---- Deeper Create-a-Team options: uniform details per set (stripes, yoke, matte, number outline), helmet side + team gear,
// how the CPU coaches the team, and a rival. Everything is checked in CT.extras / CT.unis (customteams.js) ----
const TS_CUTS = [
  ['sleeve', 'Sleeve stripes', [[0, 'NONE'], [1, 'ONE'], [2, 'TWO'], [3, 'THREE']]],
  ['pstripe', 'Pants stripes', [[0, 'NONE'], [1, 'ONE'], [2, 'TWO']]],
  ['hstripe', 'Helmet stripe', [[0, 'NONE'], [1, 'ONE'], [2, 'TWO THIN']]],
  ['sockBand', 'Sock stripes', [[0, 'NONE'], [1, 'ONE'], [2, 'TWO'], [3, 'THREE']]],
  ['yoke', 'Shoulders', [[false, 'PLAIN'], [true, 'YOKE']]],
  ['matte', 'Helmet finish', [[false, 'GLOSSY'], [true, 'MATTE']]]
];
const TS_KIT = [
  ['decal', 'Helmet side', [['num', 'NUMBER'], ['logo', 'LOGO'], ['none', 'BLANK']]],
  ['mask', 'Facemask', [['classic', 'CLASSIC'], ['cage', 'CAGE'], ['robot', 'ROBOT'], ['open', 'OPEN']]],
  ['gloves', 'Gloves', [['auto', 'AUTO'], ['white', 'WHITE'], ['black', 'BLACK'], ['team', 'TEAM'], ['gold', 'GOLD']]],
  ['cleats', 'Cleats', [['auto', 'AUTO'], ['white', 'WHITE'], ['black', 'BLACK'], ['team', 'TEAM'], ['gold', 'GOLD'], ['neon', 'NEON']]]
];
const TS_COACH = [['balanced', 'BALANCED', 'Mixes it up.'], ['aggressive', 'AGGRESSIVE', 'Goes for it on 4th, blitzes a lot, tries trick plays.'], ['conservative', 'OLD SCHOOL', 'Runs the ball, punts, sits back in zone.'],
  ['air', 'AIR RAID', 'Throws it all over the field and takes deep shots.'], ['ground', 'GROUND + POUND', 'Runs, runs, runs. Goes for it on short 4th downs.']];
const tsSeg = (cls, k, opts, cur) => `<div class="tlTabs sdSeg ${cls}" data-k="${k}">${opts.map(([v, n]) => `<button data-v="${v}"${String(cur) === String(v) ? ' class="on"' : ''}>${n}</button>`).join('')}</div>`;

{
  // ---- COLORS tab: details for the uniform picked under the player, then team-wide helmet + gear ----
  const _pane = TeamLab.pane_col, _wire = TeamLab.wire_col;
  TeamLab.pane_col = function () {
    const t = this.t, kit = this.kit, lk = teamLook(t, kit !== 'away', kit), cu = (t.unis && t.unis[kit]) || {}, kt = t.kit || {};
    const no = cu.numOut ? hex6(cu.numOut) : null;
    return _pane.call(this) +
      `<div class="tlSec">${this.KITS[kit]} UNIFORM DETAILS</div>` +
      TS_CUTS.map(([k, n, opts]) => `<div class="tlF sdF"><span>${n}</span>${tsSeg('tsCut', k, opts, k === 'yoke' || k === 'matte' ? !!lk[k] : lk[k] == null ? 1 : lk[k])}</div>`).join('') +
      `<div class="tlColRow"><div class="tlColL"><i style="background:${no || lk.numOut || '#000'}"></i><div><b>Number outline</b><span>${no ? 'Your pick' : 'Auto'}</span></div></div>
        <div class="tlSw"><button class="tsAuto${no ? '' : ' on'}" data-nx="auto">AUTO</button>${TL_PALETTE.map(c => `<button class="tlC${no === c ? ' on' : ''}" data-nx="${c}" style="background:${c}"></button>`).join('')}
        <label class="tlPick" title="Any color"><input type="color" data-nx="1" value="${hex6(no || lk.numOut || '#000000').toLowerCase()}"><span>+</span></label></div></div>` +
      `<div class="tlSec">HELMET + GEAR <span class="tlSecSub">EVERY UNIFORM</span></div>` +
      TS_KIT.map(([k, n, opts]) => `<div class="tlF sdF"><span>${n}</span>${tsSeg('tsKit', k, opts, kt[k] || opts[0][0])}</div>`).join('') +
      `<div class="tlHint">LOGO puts your team logo on both sides of the helmet. Gloves and cleats show in games. The Gear Locker can still change single players.</div>`;
  };
  TeamLab.wire_col = function () {
    _wire.call(this);
    const t = this.t, kit = this.kit;
    const cut = () => { t.unis = t.unis || {}; return t.unis[kit] || (t.unis[kit] = {}); };
    document.querySelectorAll('.tsCut button').forEach(b => b.onclick = () => { const k = b.parentNode.dataset.k, v = b.dataset.v; cut()[k] = v === 'true' ? true : v === 'false' ? false : +v; this.renderEd(); });
    document.querySelectorAll('.tsKit button').forEach(b => b.onclick = () => { t.kit = { ...(t.kit || {}), [b.parentNode.dataset.k]: b.dataset.v }; this.renderEd(); });
    document.querySelectorAll('[data-nx]').forEach(b => {
      if (b.tagName === 'INPUT') b.addEventListener('change', () => { cut().numOut = b.value.toUpperCase(); this.renderEd(); });
      else b.onclick = () => { if (b.dataset.nx === 'auto') delete cut().numOut; else cut().numOut = b.dataset.nx; this.renderEd(); };
    });
  };

  // ---- IDENTITY tab: game day (CPU coach style + rival) ----
  const _pid = TeamLab.pane_id, _wid = TeamLab.wire_id;
  TeamLab.rivals = function () { const t = this.t; return [null, ...CT.NFL, ...CT.mine.filter(m => m.uid !== t.uid)]; };
  TeamLab.pane_id = function () {
    const t = this.t, c = TS_COACH.find(x => x[0] === (t.coach || 'balanced')) || TS_COACH[0];
    const r = t.rival && this.rivals().find(x => x && x.id === t.rival);
    return _pid.call(this) + `<div class="tlSec">GAME DAY</div>
      <div class="tlF sdF"><span>CPU coach</span>${tsSeg('tsCoach', 'coach', TS_COACH, c[0])}</div>
      <div class="tlHint">${c[2]} Used when the CPU plays this team. A COACH pick in game setup wins.</div>
      <div class="tlF sdF"><span>Rival</span><div class="tsRiv"><button class="arr2" id="tsRivP"><svg viewBox="0 0 24 24" class="chev"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="tsRivN">${r ? `${teamBadge(r)}<b>${esc(r.city)} ${esc(r.name)}</b>` : t.rival ? `<b>${esc(t.rival)}</b>` : '<b class="dim">NO RIVAL</b>'}</div>
        <button class="arr2" id="tsRivN"><svg viewBox="0 0 24 24" class="chev"><path d="M9 5l7 7-7 7"/></svg></button></div></div>
      <div class="tlHint">Games against your rival get the RIVALRY GAME intro, your rivalry uniforms and a trophy when you win.</div>`;
  };
  TeamLab.wire_id = function () {
    _wid.call(this);
    const t = this.t;
    document.querySelectorAll('.tsCoach button').forEach(b => b.onclick = () => { t.coach = b.dataset.v; this.renderEd(); });
    const step = d => { const l = this.rivals(), i = Math.max(0, l.findIndex(x => (x ? x.id : null) === (t.rival || null))); const n = l[(i + d + l.length) % l.length]; if (n) t.rival = n.id; else delete t.rival; this.renderEd(); };
    $('tsRivP').onclick = () => step(-1); $('tsRivN').onclick = () => step(1);
  };
}

// ---- in games: team gear defaults, rivals, CPU coach style ----
{
  const _of = Gear.of;
  Gear.of = function (team, name) { // the team's picks first, this device's Gear Locker picks on top
    const o = _of.call(this, team, name), k = team && team.custom && team.kit; if (!k) return o;
    const d = {}; for (const n of ['mask', 'gloves', 'cleats']) if (k[n]) d[n] = k[n];
    return Object.keys(d).length ? { ...d, ...(o || {}) } : o;
  };
  const _riv = isRivalry;
  isRivalry = function (a, b) { return _riv(a, b) || !!(a && b && a.id !== b.id && ((a.custom && a.rival === b.id) || (b.custom && b.rival === a.id))); };
  const _init = initGame;
  initGame = function (home, away, opts) {
    _init(home, away, opts);
    const cpu = G.teams[1 - G.human]; // a created team's coaching style, unless a COACH style was picked for this game
    if (!G.versus && !G.online && cpu && cpu.custom && CT.COACHES.includes(cpu.coach) && (!opts.coach || opts.coach === 'balanced')) G.coach = cpu.coach;
  };
  Logo.onReady(() => headCache.clear()); // helmet logos drawn before the picture loaded
}
