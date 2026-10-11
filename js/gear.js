// ---- Gear Locker: visors, facemasks, sleeves, arm bands, gloves, cleats. Set it for the whole team or one player ----
const GEAR_OPTS = [
  ['visor', 'VISOR', [['auto', 'Auto'], ['none', 'None'], ['clear', 'Clear'], ['dark', 'Dark'], ['smoke', 'Smoke'], ['gold', 'Gold'], ['blue', 'Blue']]],
  ['mask', 'FACEMASK', [['classic', 'Classic'], ['cage', 'Cage'], ['robot', 'Robot'], ['open', 'Open']]],
  ['sleeve', 'SLEEVES', [['none', 'None'], ['white', 'White'], ['black', 'Black'], ['team', 'Team']]],
  ['band', 'ARM BANDS', [['off', 'Off'], ['on', 'On']]],
  ['gloves', 'GLOVES', [['auto', 'Auto'], ['white', 'White'], ['black', 'Black'], ['team', 'Team'], ['gold', 'Gold']]],
  ['cleats', 'CLEATS', [['auto', 'Auto'], ['white', 'White'], ['black', 'Black'], ['team', 'Team'], ['gold', 'Gold'], ['neon', 'Neon']]]
];
// (VISOR_COL + GEAR_COL live in draw.js so the demo game can draw before this file loads)

const Gear = {
  KEY: 'bobbleGear', d: null,
  load() { if (!this.d) { try { this.d = JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { this.d = {}; } } return this.d; },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) {} },
  // what one player wears: his own picks on top of the team's picks
  of(team, name) {
    if (!team || typeof localStorage === 'undefined') return null;
    const t = this.load()[team.id]; if (!t) return null;
    const g = { ...(t.all || {}), ...((t.pl || {})[name] || {}) };
    return Object.keys(g).length ? g : null;
  },
  set(teamId, name, k, v) {
    const t = this.load()[teamId] || (this.d[teamId] = { all: {}, pl: {} });
    const o = name ? (t.pl[name] || (t.pl[name] = {})) : t.all;
    if (v == null) delete o[k]; else o[k] = v;
    this.save();
  },
  reset(teamId) { delete this.load()[teamId]; this.save(); },
  // put the gear on a freshly made player
  apply(p, team) {
    const gr = this.of(team, p.name); p.gear = gr; if (!gr) return p;
    if (gr.visor && gr.visor !== 'auto') p.face.visor = gr.visor !== 'none';
    if (gr.gloves && gr.gloves !== 'auto') { p.teamGloves = gr.gloves === 'team'; p.gloves = GEAR_COL[gr.gloves] || null; }
    return p;
  }
};

// ---------- the Gear Locker screen ----------
screens.push('gear'); menuScreens.push('gear');
(() => {
  const el = document.createElement('div');
  el.id = 'gear'; el.className = 'screen';
  el.innerHTML = `
    <div id="grHead"><h2>Gear Locker</h2><div id="grTabs"><button data-s="1"></button><button data-s="0"></button></div><button class="big gold" id="grDone">DONE</button></div>
    <div id="grBody">
      <div id="grRoster"></div>
      <canvas id="grCv" width="280" height="300"></canvas>
      <div id="grOpts"></div>
    </div>`;
  document.getElementById('stage').appendChild(el);
})();

const GearRoom = {
  side: 0, who: null, anim: 0,
  open(side) { this.side = side == null ? sel.you : side; this.who = null; show('gear'); this.render(); this.loop(); },
  team() { return Locker.team(this.side); },
  roster() { const t = this.team(); return t.off.map((p, i) => [p, true, i]).concat(t.def.map((p, i) => [p, false, i])); },
  render() {
    const t = this.team();
    document.querySelectorAll('#grTabs button').forEach(b => { const s = +b.dataset.s, tm = Locker.team(s); b.textContent = `${s === 0 ? 'HOME' : 'AWAY'}  ${tm.id}`; b.classList.toggle('on', s === this.side); b.onclick = () => { Sound.click(); this.side = s; this.who = null; this.render(); }; });
    $('gear').style.setProperty('--tc', t.c1);
    const mine = n => { const pl = ((Gear.load()[t.id] || {}).pl || {})[n]; return pl && Object.keys(pl).length; };
    $('grRoster').innerHTML = `<button class="grP${this.who ? '' : ' on'}" data-n="">WHOLE TEAM</button>` +
      this.roster().map(([p]) => `<button class="grP${this.who === p[1] ? ' on' : ''}" data-n="${p[1]}"><b>${p[0]}</b> ${p[1]}${mine(p[1]) ? ' <i>CUSTOM</i>' : ''}</button>`).join('');
    document.querySelectorAll('.grP').forEach(b => b.onclick = () => { Sound.click(); this.who = b.dataset.n || null; this.render(); });
    const T = Gear.load()[t.id] || { all: {}, pl: {} };
    const cur = this.who ? ((T.pl || {})[this.who] || {}) : (T.all || {});
    $('grOpts').innerHTML = `<div class="grFor">${this.who ? `${this.who}` : `EVERYONE ON THE ${t.name.toUpperCase()}`}</div>` +
      GEAR_OPTS.map(([k, label, opts]) => `<div class="grRow"><span>${label}</span>${(this.who ? [['', 'Default']] : []).concat(opts).map(([v, n]) => {
        const on = this.who ? (cur[k] || '') === v : (cur[k] || opts[0][0]) === v;
        return `<button class="grO${on ? ' on' : ''}" data-k="${k}" data-v="${v}">${n}</button>`;
      }).join('')}</div>`).join('') +
      `<div class="grRow"><button class="grReset" id="grReset">${this.who ? 'RESET THIS PLAYER' : 'RESET WHOLE TEAM'}</button></div>`;
    document.querySelectorAll('.grO').forEach(b => b.onclick = () => { Sound.click(); Gear.set(t.id, this.who, b.dataset.k, b.dataset.v || null); this.render(); });
    $('grReset').onclick = () => { Sound.click(); if (this.who) { const T2 = Gear.load()[t.id]; if (T2 && T2.pl) { delete T2.pl[this.who]; Gear.save(); } } else Gear.reset(t.id); this.render(); };
    this.makePreview();
  },
  makePreview() {
    const t = this.team(), r = this.roster(), f = (this.who && r.find(([p]) => p[1] === this.who)) || r[0];
    const p = makePlayer(0, f[1], f[2], f[0]); p.side = 0; p.face.dir = 1; p.headScale = 1.1; Gear.apply(p, t);
    this.pl = p;
  },
  loop() {
    if (!$('gear').classList.contains('show')) return;
    const cv = $('grCv'), g = cv.getContext('2d'), t = this.team(), p = this.pl;
    const fake = { teams: [t, t], uni: [Locker.val(this.side), Locker.val(this.side)], ball: null, phase: 'over', human: 0, mode: G.mode, time: performance.now() / 1000 };
    g.clearRect(0, 0, cv.width, cv.height);
    const bg = g.createRadialGradient(140, 170, 10, 140, 170, 170); bg.addColorStop(0, shade(t.c1, -0.25)); bg.addColorStop(1, '#0c1016'); g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    if (p) { p.anim += 0.03; p.speedNow = 0.6; g.save(); g.scale(2.7, 2.7); drawPlayer(g, p, fake, { x: 52, y: 104 }); g.restore(); }
    requestAnimationFrame(() => this.loop());
  }
};
(() => {
  $('grDone').onclick = () => { Sound.click(); Locker.open(); };
  window.addEventListener('keydown', e => { if ($('gear').classList.contains('show') && e.code === 'Escape') $('grDone').onclick(); });
  // a GEAR button in the Uniform Room header
  const b = document.createElement('button'); b.id = 'lkGear'; b.textContent = 'GEAR LOCKER';
  b.onclick = () => { Sound.click(); GearRoom.open(sel.you); };
  $('lkHead').insertBefore(b, $('lkDone'));
})();
