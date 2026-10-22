// ---- Stadium Editor: end zones, field color, logos, wall. Two ways in:
//   Create a Team > STADIUM tab (saved with the team, goes up to the Team Database with it)
//   Uniform Room > STADIUM (any team on this device; NFL teams can RESET back to their real look) ----
const StadiumUI = {
  view: 'half', raf: 0,
  seg(k, opts, cur) { return `<div class="tlTabs sdSeg" data-k="${k}">${opts.map(([v, n]) => `<button data-v="${v}"${String(cur) === String(v) ? ' class="on"' : ''}>${n}</button>`).join('')}</div>`; },
  row(label, ctl) { return `<div class="tlF sdF"><span>${label}</span>${ctl}</div>`; },
  // a color row: team-color shortcuts first, then the palette + any color
  colRow(k, label, val, t, sp) {
    const real = v => v === 'c1' ? t.c1 : v === 'c2' ? t.c2 : v === 'auto' ? null : v, cur = real(val);
    return `<div class="sdCol"><div class="sdColL"><i class="${cur ? '' : 'auto'}" style="${cur ? `background:${cur}` : ''}"></i><b>${label}</b>
        ${sp.map(([v, n]) => `<button class="sdSp${val === v ? ' on' : ''}" data-k="${k}" data-c="${v}">${real(v) ? `<u style="background:${real(v)}"></u>` : ''}${n}</button>`).join('')}</div>
      <div class="tlSw">${TL_PALETTE.map(c => `<button class="tlC${val === c ? ' on' : ''}" data-k="${k}" data-c="${c}" style="background:${c}"></button>`).join('')}
        <label class="tlPick" title="Any color"><input type="color" data-k="${k}" value="${hex6(cur || '#808080').toLowerCase()}"><span>+</span></label></div></div>`;
  },
  // f = the look being edited (+ name/dome), t = the team (its colors + name), o.custom = a created team (words get the database filter)
  pane(f, t, o) {
    const T = [['c1', 'TEAM 1'], ['c2', 'TEAM 2']], FS = FieldStyle;
    return `<div class="tlSec">STADIUM</div>
      ${this.row('Name', `<input id="sdName" maxlength="24" value="${esc(f.name || '')}" placeholder="${esc(o.realName || 'Home Field')}">`)}
      ${this.row('Roof', this.seg('dome', [['0', 'OPEN AIR'], ['1', 'DOME']], f.dome ? 1 : 0))}
      ${this.row('Surface', this.seg('surf', [['grass', 'GRASS'], ['turf', 'TURF']], f.surf))}
      ${this.row('Field color', `<div class="sdShades">${Object.entries(FS.SHADES).map(([k, s]) => `<button class="sdShade${f.sh === k ? ' on' : ''}" data-v="${k}"><i style="background:linear-gradient(90deg, ${s[1]} 50%, ${s[2]} 50%)"></i>${s[0]}</button>`).join('')}</div>`)}
      <div class="tlSec">END ZONE PAINT</div>
      ${this.colRow('ez', 'END ZONE', f.ez, t, T)}
      ${this.row('Pattern', this.seg('pat', FS.PATS, f.pat))}
      ${f.pat === 'solid' ? '' : this.colRow('pc', 'PATTERN', f.pc, t, [['auto', 'AUTO']])}
      <div class="tlSec">END ZONE WORDS</div>
      ${this.row('Words', `<input id="sdText" maxlength="${FS.TXT_MAX}" value="${esc(f.tx)}" placeholder="${esc(t.name.toUpperCase())}">`)}
      <div class="tlHint" id="sdTextHint">Up to ${FS.TXT_MAX} letters. Leave it empty for the team name.</div>
      ${this.row('Style', this.seg('ts', FS.TSTY, f.ts))}
      ${f.ts === 'none' ? '' : this.colRow('tc', 'LETTERS', f.tc, t, T) + this.colRow('oc', 'OUTLINE', f.oc, t, [['auto', 'AUTO']])}
      <div class="tlSec">LOGOS</div>
      ${this.row('End zones', this.seg('lg', FS.LOGOS, f.lg))}
      ${this.row('Midfield', this.seg('mid', FS.MIDS, f.mid))}
      <div class="tlSec">STANDS + NUMBERS</div>
      ${this.colRow('wall', 'WALL + BOARD', f.wall, t, T)}
      ${this.colRow('yc', 'YARD NUMBERS', f.yc, t, [])}`;
  },
  wire(root, f, t, o, change) {
    const q = s => root.querySelectorAll(s);
    q('.sdSeg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => {
      const k = sg.dataset.k, v = b.dataset.v;
      f[k] = k === 'lg' ? +v : k === 'dome' ? v === '1' : v; change(true);
    }));
    q('.sdShade').forEach(b => b.onclick = () => { f.sh = b.dataset.v; change(true); });
    q('.sdSp, .sdCol .tlC').forEach(b => b.onclick = () => { f[b.dataset.k] = b.dataset.c; change(true); });
    q('.sdCol .tlPick input').forEach(i => {
      i.addEventListener('input', () => { f[i.dataset.k] = i.value.toUpperCase(); change(false); }); // live while dragging
      i.addEventListener('change', () => { f[i.dataset.k] = i.value.toUpperCase(); change(true); });
    });
    const name = root.querySelector('#sdName'), txt = root.querySelector('#sdText');
    for (const el of [name, txt]) el.addEventListener('keydown', e => e.stopPropagation()); // game hotkeys stay quiet while typing
    name.addEventListener('input', () => { f.name = name.value; change(false); });
    txt.addEventListener('input', () => {
      f.tx = FieldStyle.text(txt.value);
      const bad = o.custom && CT.BAD.test(f.tx.toLowerCase().replace(/[^a-z]+/g, ' ')), h = root.querySelector('#sdTextHint');
      h.textContent = bad ? 'Those words are not allowed in the Team Database.' : `Up to ${FieldStyle.TXT_MAX} letters. Leave it empty for the team name.`; h.classList.toggle('bad', !!bad);
      change(false);
    });
  },
  // the preview uses the real field painter; redraw at most once a frame
  paint(cv, team) { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => FieldStyle.preview(cv, team, this.view)); },
  viewBtns(id) { return `<div class="tlTabs sdView" id="${id}"><button data-v="half"${this.view === 'half' ? ' class="on"' : ''}>GAME VIEW</button><button data-v="ez"${this.view === 'ez' ? ' class="on"' : ''}>END ZONE</button></div>`; },
  wireView(id, redo) { document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { this.view = b.dataset.v; redo(); }); }
};

// ---------------- Create a Team: STADIUM tab ----------------
(() => {
  const b = document.createElement('button'); b.dataset.t = 'stad'; b.textContent = 'STADIUM';
  const tabs = $('tlEdTabs'), ros = tabs.querySelector('[data-t="ros"]'); tabs.insertBefore(b, ros);
  b.onclick = () => { TeamLab.edTab = 'stad'; TeamLab.renderEd(); };
  // preview box for the field, swapped in for the player turntable on this tab
  const box = document.createElement('div'); box.id = 'sdTlBox';
  box.innerHTML = `<canvas id="sdTlCv" class="sdCv" width="740" height="400"></canvas><div class="sdUnder">${StadiumUI.viewBtns('sdTlView')}</div>`;
  $('tlPrev').insertBefore(box, $('tlPrevName'));
})();
Object.assign(TeamLab, {
  stadLook() { // the team's field style + its stadium name and roof, as one thing to edit
    const t = this.t; if (!t.field) t.field = FieldStyle.of(t);
    return t.field;
  },
  pane_stad() {
    const t = this.t, f = this.stadLook();
    return StadiumUI.pane({ ...f, name: t.stadium, dome: t.dome }, t, { custom: true, realName: `${t.name} Field` }) +
      `<div class="tlSec">START OVER <button class="tlMini" id="sdTlReset">RESET FIELD</button></div><div class="tlHint">Saved with the team. If the team is PUBLIC, everyone who downloads it plays on this field.</div>`;
  },
  wire_stad() {
    const t = this.t, f = { ...this.stadLook(), name: t.stadium, dome: t.dome };
    const change = full => {
      t.stadium = f.name; t.dome = !!f.dome; const o = { ...f }; delete o.name; delete o.dome; t.field = FieldStyle.clean(o);
      if (full) this.renderEd(); else StadiumUI.paint($('sdTlCv'), t);
    };
    StadiumUI.wire($('tlPane'), f, t, { custom: true }, change);
    $('sdTlReset').onclick = () => { t.field = FieldStyle.of({ ...t, field: null }); this.renderEd(); };
  }
});
{
  const _render = TeamLab.renderEd;
  TeamLab.renderEd = function () {
    _render.call(this);
    const on = this.edTab === 'stad';
    $('tlEdBody').classList.toggle('sdWide', on);
    if (on) { StadiumUI.paint($('sdTlCv'), this.t); StadiumUI.wireView('sdTlView', () => { $('sdTlBox').querySelector('.sdUnder').innerHTML = StadiumUI.viewBtns('sdTlView'); this.renderEd(); }); }
  };
}

// ---------------- Stadium Editor for any team (from the Uniform Room) ----------------
screens.push('sdRoom'); menuScreens.push('sdRoom');
(() => {
  const el = document.createElement('div'); el.id = 'sdRoom'; el.className = 'screen';
  el.innerHTML = `
    <div class="tlTop"><h2>Stadium Editor</h2><div class="tlTabs" id="sdSides"></div><button class="big gold" id="sdDone">DONE</button></div>
    <div id="sdBody">
      <div id="sdLeft">
        <div id="sdTeam"></div>
        <canvas id="sdCv" class="sdCv" width="740" height="400"></canvas>
        <div class="sdUnder"><span id="sdViewWrap"></span><button class="tlMini" id="sdReset"></button></div>
        <div class="tlHint" id="sdNote"></div>
      </div>
      <div id="sdPane"></div>
    </div>`;
  $('stage').appendChild(el);
})();
const StadiumRoom = {
  i: 0,
  open(side) { this.i = sel.idx[side == null ? 0 : side]; show('sdRoom'); this.render(); },
  team() { return TEAMS[this.i] || TEAMS[0]; },
  // what we're editing: NFL = device override (or the real look), created team = its own saved field
  look(t) {
    const st = stadiumBase(t);
    return { ...FieldStyle.of(t), name: t.custom ? t.stadium : (FieldStyle.get(t.id) || {}).name || '', dome: st.dome };
  },
  save(t, f) {
    if (t.custom) {
      const o = { ...f }; delete o.name; delete o.dome;
      const m = CT.mine.find(x => x.uid === t.uid) || t;
      for (const x of [t, m]) { x.field = FieldStyle.clean(o); x.stadium = FieldStyle.text(f.name, 24) || x.stadium; x.dome = !!f.dome; }
      CT.save(); fieldKey = '';
    } else {
      const s = STADIUMS[t.id], o = { ...f };
      if (!o.name || o.name === (s && s[0])) delete o.name;
      if (s && o.dome === (s[1] === 'dome')) delete o.dome;
      FieldStyle.set(t.id, o);
    }
  },
  changed(t) { // NFL: is anything different from the real look?
    return t.custom ? true : !!FieldStyle.all()[t.id];
  },
  render() {
    const t = this.team(), f = this.look(t);
    $('sdSides').innerHTML = [0, 1].map(s => { const tm = TEAMS[sel.idx[s]]; return tm ? `<button data-i="${sel.idx[s]}"${sel.idx[s] === this.i ? ' class="on"' : ''}>${s === 0 ? 'HOME' : 'AWAY'}  ${esc(tm.id)}</button>` : ''; }).join('');
    $('sdSides').querySelectorAll('button').forEach(b => b.onclick = () => { this.i = +b.dataset.i; this.render(); });
    $('sdRoom').style.setProperty('--tc', t.c1);
    $('sdTeam').innerHTML = `<button class="arr2" id="sdPrevT"><svg viewBox="0 0 24 24" class="chev"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="tlPB">${teamBadge(t)}</div><div class="sdTN"><div class="tlCity">${esc(t.city)}</div><div class="tlNm">${esc(t.name)}</div></div>
      <button class="arr2" id="sdNextT"><svg viewBox="0 0 24 24" class="chev"><path d="M9 5l7 7-7 7"/></svg></button>`;
    $('sdPrevT').onclick = () => { this.i = (this.i + TEAMS.length - 1) % TEAMS.length; this.render(); };
    $('sdNextT').onclick = () => { this.i = (this.i + 1) % TEAMS.length; this.render(); };
    $('sdViewWrap').innerHTML = StadiumUI.viewBtns('sdView');
    StadiumUI.wireView('sdView', () => this.render());
    $('sdReset').textContent = t.custom ? 'RESET FIELD' : 'RESET TO REAL';
    $('sdReset').disabled = !this.changed(t);
    $('sdReset').onclick = () => { if (t.custom) { this.save(t, { ...FieldStyle.of({ ...t, field: null }), name: t.stadium, dome: t.dome }); } else FieldStyle.reset(t.id); this.render(); };
    $('sdNote').textContent = t.custom ? `Saved with the ${tName(t.id)}. Save the team again in Create a Team to update its Team Database copy.`
      : `Saved on this device. Shows whenever the ${tName(t.id)} play at home. The roof stays real in online games.`;
    $('sdPane').innerHTML = StadiumUI.pane(f, t, { custom: !!t.custom, realName: t.custom ? 'Home Field' : (STADIUMS[t.id] || ['Home Field'])[0] });
    StadiumUI.wire($('sdPane'), f, t, { custom: !!t.custom }, full => { this.save(t, f); if (full) this.render(); else StadiumUI.paint($('sdCv'), t); });
    StadiumUI.paint($('sdCv'), t);
  }
};
(() => {
  $('sdDone').onclick = () => { fieldKey = ''; Locker.open(); };
  window.addEventListener('keydown', e => { if ($('sdRoom').classList.contains('show') && e.code === 'Escape') $('sdDone').onclick(); });
  // a STADIUM button in the Uniform Room header, next to GEAR LOCKER
  const b = document.createElement('button'); b.id = 'lkStad'; b.textContent = 'STADIUM';
  b.onclick = () => StadiumRoom.open(0);
  $('lkHead').insertBefore(b, $('lkGear') || $('lkDone'));
  // real logos load late: redraw whichever preview is up
  Logo.onReady(() => {
    if ($('sdRoom').classList.contains('show')) StadiumUI.paint($('sdCv'), StadiumRoom.team());
    else if ($('tlEdit').classList.contains('show') && TeamLab.edTab === 'stad') StadiumUI.paint($('sdTlCv'), TeamLab.t);
  });
})();
