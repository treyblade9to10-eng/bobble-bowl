// ---- Playbook: pick which plays are on your play-call cards (and their order), and draw your own plays ----
// Your plays get built in the same format as OFF_PLAYS, so the engine runs them like any other play.
// They only show up on YOUR cards: the CPU never calls them, and online games leave them out (the other side doesn't have them).
const Playbook = {
  KEY: 'bobblePlaybook', MAX: 30, NAME_MAX: 16,
  // route presets, same [downfield, out] steps as plays.js / hot routes
  PRESETS: [
    ['GO', [[15, 0]], 'go'], ['SLANT', [[2, 0], [9, -7]], 'go'], ['OUT', [[6, 0], [6, 6]], 'sit'], ['IN', [[7, 0], [7, -10]], 'go'],
    ['CURL', [[12, 0], [10, -1]], 'sit'], ['POST', [[12, 0], [28, -9]], 'go'], ['CORNER', [[10, 0], [20, 9]], 'go'],
    ['FLAT', [[1, 5], [3, 10]], 'sit'], ['WHEEL', [[1, 5], [22, 8]], 'go'], ['BLOCK', null, 'block']
  ],
  HOLES: [-9, -4, 0, 4, 9],
  HOLE_NAMES: ['SWEEP LEFT', 'OFF TACKLE LEFT', 'UP THE MIDDLE', 'OFF TACKLE RIGHT', 'SWEEP RIGHT'],
  SLOTS: [2, 3, 4, 1], // same order as the 1-4 throw buttons
  SLOT_NAME: { 1: 'RB', 2: 'WR1', 3: 'WR2', 4: 'SLOT' },
  d: null,

  // ---------- saved data ----------
  load() {
    let d = null; try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) {}
    if (!d || typeof d !== 'object') d = {};
    const keys = a => Array.isArray(a) ? a.filter(k => typeof k === 'string').slice(0, 200) : [];
    const book = b => ({ order: keys(b && b.order), hidden: keys(b && b.hidden), fav: keys(b && b.fav) });
    this.d = { off: book(d.off), def: book(d.def), mine: (Array.isArray(d.mine) ? d.mine : []).map(m => this.clean(m)).filter(Boolean).slice(0, this.MAX) };
    this.sync();
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) {} this.sync(); },
  // make sure a saved play can't break anything
  clean(m) {
    if (!m || typeof m !== 'object' || !/^cp[a-z0-9]{1,16}$/.test(m.key)) return null;
    const num = (v, a, b) => clamp(Math.round((+v || 0) * 2) / 2, a, b);
    const out = { key: m.key, name: String(m.name || 'My Play').slice(0, this.NAME_MAX), form: FORMATIONS[m.form] ? m.form : 'gun', type: m.type === 'run' ? 'run' : 'pass',
      r: {}, end: {}, tag: {}, pa: !!m.pa, carrier: ['rb', 'qb', 'jet'].includes(m.carrier) ? m.carrier : 'rb', hole: clamp(m.hole | 0, 0, 4) };
    for (const s of this.SLOTS) {
      const r = m.r && m.r[s];
      if (Array.isArray(r) && r.length) out.r[s] = r.slice(0, 3).map(p => [num(p && p[0], -12, 40), num(p && p[1], -55, 55)]);
      out.end[s] = m.end && m.end[s] === 'sit' ? 'sit' : 'go';
      out.tag[s] = m.tag && typeof m.tag[s] === 'string' ? m.tag[s].slice(0, 8) : '';
    }
    if (out.form === 'empty') out.pa = false;
    return out;
  },
  // a saved play -> a real OFF_PLAYS entry
  build(m) {
    const F = FORMATIONS[m.form] || FORMATIONS.gun;
    const p = { key: m.key, form: m.form, name: m.name, type: m.type, custom: true, desc: this.descOf(m) };
    if (m.type === 'pass') {
      p.routes = {};
      for (const s of this.SLOTS) {
        if (s === 1 && m.pa) continue;
        const r = m.r[s];
        if (r && r.length) p.routes[s] = { r: r.map(x => x.slice()), end: m.end[s] === 'sit' ? 'sit' : 'go' };
        else if (s !== 1) p.routes[s] = { r: [[2, 0]], end: 'block' };
      }
      if (m.pa) { p.fake = true; p.rb = { path: [[-3.6, (Math.sign(F.spots[1][1]) || 1) * 0.6], [0, 0.3]], end: 'block' }; }
      let deep = 0; for (const s in p.routes) for (const [dd] of p.routes[s].r) deep = Math.max(deep, dd);
      p.deep = deep >= 16;
    } else if (m.carrier === 'qb') {
      p.qbRun = true;
      if (F.under) p.sneak = true;
      else p.routes = { 2: { r: [[15, 0]], end: 'go' }, 3: { r: [[15, 0]], end: 'go' }, 4: { r: [[8, 0]], end: 'block' } };
    } else if (m.carrier === 'jet') {
      Object.assign(p, { carrier: 4, jet: true, wr: 'block', rb: { path: [[-2.6, 0.5], [-2.1, 5], [-0.4, 9.5], [3, 13.5], [14, 15]], end: 'go' } });
    } else Object.assign(p, this.runPath(m));
    return p;
  },
  runPath(m) {
    const F = FORMATIONS[m.form] || FORMATIONS.gun, H = this.HOLES[m.hole], w = F.spots[1][1], s = Math.sign(H);
    if (Math.abs(H) >= 8) return { toss: true, wr: 'block', rb: { path: [[-4, s * 6], [-1.8, s * 10], [1.5, s * 12.5], [12, s * 13.5]], end: 'go' } };
    const mesh = [F.under ? -2.4 : -3.6, (Math.sign(w) || s || 1) * 0.6]; // meet the QB right where he stands (a human QB doesn't move to the RB)
    return { wr: 'block', pull: Math.abs(H) >= 3, rb: { path: [mesh, [0.5, H ? H * 0.95 : 0.4], [10, H * 1.05]], end: 'go' } };
  },
  descOf(m) {
    if (m.type === 'run') {
      if (m.carrier === 'qb') return 'Your play. The QB keeps it and runs.';
      if (m.carrier === 'jet') return 'Your play. Jet sweep to the fastest WR.';
      return `Your play. ${Math.abs(this.HOLES[m.hole]) >= 8 ? 'Pitch to the RB' : 'Handoff to the RB'}, ${this.HOLE_NAMES[m.hole].toLowerCase()}.`;
    }
    const bits = [];
    for (const s of this.SLOTS) {
      if (s === 1 && m.pa) continue;
      const r = m.r[s]; if (!r || !r.length) continue;
      const t = m.tag[s] && m.tag[s] !== 'ROUTE' ? m.tag[s].toLowerCase() : 'route';
      bits.push(`${s === 4 ? 'slot' : this.SLOT_NAME[s]} ${t}`);
    }
    const txt = bits.join(', ');
    return (m.pa ? 'Fake the handoff. ' : 'Your play: ') + (txt ? txt.charAt(0).toUpperCase() + txt.slice(1) + '.' : '');
  },
  // put my plays into OFF_PLAYS (so choosePlay can find them)
  sync() {
    for (let i = OFF_PLAYS.length - 1; i >= 0; i--) if (OFF_PLAYS[i].custom) OFF_PLAYS.splice(i, 1);
    for (const m of this.d.mine) {
      const p = this.build(m); OFF_PLAYS.push(p);
      if (p.deep && !DEEP_KEYS.includes(p.key)) DEEP_KEYS.push(p.key); // the CPU defense learns your deep habits too
    }
  },

  // ---------- order / show / hide ----------
  all(off) { return off ? OFF_PLAYS.filter(p => p.key !== 'kneel') : DEF_PLAYS.slice(); },
  book(off) { return this.d[off ? 'off' : 'def']; },
  ordered(off) {
    const all = this.all(off), b = this.book(off);
    const at = p => { const i = b.order.indexOf(p.key); return i >= 0 ? i : 1000 + (p.custom ? 500 : 0) + all.indexOf(p); };
    return all.sort((x, y) => (b.fav.includes(y.key) - b.fav.includes(x.key)) || at(x) - at(y));
  },
  shown(off) { const b = this.book(off); return this.ordered(off).filter(p => !b.hidden.includes(p.key)); },
  // the play-call screen asks for this (human side only)
  list(off) {
    if (!this.d || (typeof Tutorial !== 'undefined' && Tutorial.active)) return (off ? OFF_PLAYS : DEF_PLAYS).filter(p => !p.custom);
    let out = this.shown(off);
    if (G.online) out = out.filter(p => !p.custom);
    if (!out.length) out = this.all(off).filter(p => !p.custom);
    if (off) out = out.concat(OFF_PLAYS.filter(p => p.key === 'kneel')); // victory formation is always there
    return out;
  },
  setOrder(off, list) { this.book(off).order = list.map(p => p.key); }
};
Playbook.load();

// ---------------- the Playbook screen ----------------
(() => {
  const PB = Playbook, W = 540, H = 400, YD = 10, LOS = 310, K = 2; // editor field: 10 px a yard, line of scrimmage 9 yards up from the bottom
  const X = lat => W / 2 + lat * YD, Y = d => LOS - d * YD;
  const html = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = document.createElement('div'); el.id = 'pb';
  el.innerHTML = `
    <div class="tlTop"><h2>Playbook</h2>
      <div class="tlTabs" id="pbTabs"><button data-t="off">OFFENSE</button><button data-t="def">DEFENSE</button><button data-t="make">CREATE PLAY</button></div>
      <button class="big gold" id="pbSave">SAVE PLAY</button><button id="pbBack">BACK</button></div>
    <div id="pbList">
      <div id="pbBar"><span id="pbCount"></span>
        <span id="pbAct"><button id="pbUp">&lsaquo; MOVE</button><button id="pbDn">MOVE &rsaquo;</button><button id="pbFav">FAVORITE</button><button id="pbEdit">EDIT</button><button id="pbDel">DELETE</button></span>
        <button id="pbReset">RESET TO DEFAULT</button></div>
      <div id="pbGrid"></div>
    </div>
    <div id="pbMake"><div id="pbCvBox"><canvas id="pbCv" width="${W * K}" height="${H * K}"></canvas><div id="pbTip"></div></div><div id="pbSide"></div></div>
    <div id="pbToast"></div>`;
  $('stage').appendChild(el);
  const cvm = $('pbCv'), g = cvm.getContext('2d');
  const S = { tab: 'off', sel: null, m: null, slot: 2, drag: null, dirty: false, from: null, sure: null };
  let toastT = 0;
  const toast = t => { const b = $('pbToast'); b.textContent = t; b.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => b.classList.remove('on'), 1800); };

  PB.open = function (from) {
    PB.load();
    S.from = from || 'title'; S.sel = null; S.sure = null;
    el.classList.add('on');
    tab(S.tab === 'make' ? 'off' : S.tab);
  };
  PB.close = function () {
    el.classList.remove('on'); S.drag = null;
    // paused on the play-call screen: rebuild the cards with the new playbook
    if (S.from === 'pause' && G.pauseFrom === 'playcall' && G.phase === 'playcall' && !G.online && typeof pcCtx !== 'undefined' && pcCtx.mode) { onPlayCall(pcCtx); show('pause'); }
  };
  const isOpen = () => el.classList.contains('on');

  function tab(t) {
    S.tab = t; S.sure = null;
    document.querySelectorAll('#pbTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    el.classList.toggle('making', t === 'make');
    if (t === 'make') { if (!S.m) newPlay(); renderSide(); draw(); }
    else renderList();
  }

  // ---------- OFFENSE / DEFENSE lists ----------
  function renderList() {
    const off = S.tab === 'off', b = PB.book(off), list = PB.ordered(off);
    const n = list.filter(p => !b.hidden.includes(p.key)).length;
    $('pbCount').innerHTML = `<b>${n}</b> / ${list.length} ON YOUR CARDS`;
    const grid = $('pbGrid'), top = grid.scrollTop; grid.innerHTML = '';
    let no = 0;
    for (const p of list) {
      const hid = b.hidden.includes(p.key), fav = b.fav.includes(p.key);
      const t = document.createElement('div');
      t.className = 'pbTile' + (hid ? ' hid' : '') + (fav ? ' fav' : '') + (S.sel === p.key ? ' sel' : '');
      const kind = off ? ((p.card || p.type) === 'run' ? 'run' : 'pass') : 'd';
      t.innerHTML = `${fav ? '<span class="pbFavT">FAVORITE</span>' : ''}<div class="pbTh"><span class="pbNo">${hid ? '-' : ++no}</span><span class="k ${kind}">${off ? kind.toUpperCase() : 'D'}</span><b>${html(p.name)}</b>
        <button class="pbOn${hid ? '' : ' on'}">${hid ? 'OFF' : 'ON'}</button></div>`;
      const c = document.createElement('canvas'); c.width = 360; c.height = 216; drawPlayDiagram(c, p, off); t.appendChild(c);
      const f = document.createElement('div'); f.className = 'pbTf'; f.textContent = p.custom ? 'MY PLAY' : p.trick ? 'TRICK PLAY' : off ? (FORMATIONS[p.form || 'gun'] || FORMATIONS.gun).name : 'DEFENSE'; t.appendChild(f);
      t.onclick = () => { S.sel = S.sel === p.key ? null : p.key; S.sure = null; Sound.click(); renderList(); };
      t.querySelector('.pbOn').onclick = e => { e.stopPropagation(); toggleHide(p.key); };
      grid.appendChild(t);
    }
    const sp = list.find(p => p.key === S.sel);
    $('pbAct').classList.toggle('none', !sp);
    $('pbEdit').style.display = $('pbDel').style.display = sp && sp.custom ? '' : 'none';
    if (sp) $('pbFav').textContent = b.fav.includes(sp.key) ? 'UNFAVORITE' : 'FAVORITE';
    $('pbDel').textContent = S.sure === 'del' ? 'SURE?' : 'DELETE'; $('pbDel').classList.toggle('sure', S.sure === 'del');
    $('pbReset').textContent = S.sure === 'reset' ? 'SURE? TAP AGAIN' : 'RESET TO DEFAULT'; $('pbReset').classList.toggle('sure', S.sure === 'reset');
    grid.scrollTop = top; // keep your spot in the list
    const se = grid.querySelector('.sel'); if (se && se.scrollIntoViewIfNeeded) se.scrollIntoViewIfNeeded(false);
  }
  function toggleHide(k) {
    const off = S.tab === 'off', b = PB.book(off), i = b.hidden.indexOf(k);
    if (i >= 0) b.hidden.splice(i, 1);
    else {
      const min = off ? 4 : 3;
      if (PB.shown(off).length <= min) { toast(`Keep at least ${min} plays on your cards`); Sound.bad(); return; }
      b.hidden.push(k);
    }
    Sound.click(); PB.save(); renderList();
  }
  function move(dir) {
    const off = S.tab === 'off', b = PB.book(off), list = PB.ordered(off), i = list.findIndex(p => p.key === S.sel);
    if (i < 0) return;
    const fav = b.fav.includes(S.sel), j = i + dir;
    if (j < 0 || j >= list.length || b.fav.includes(list[j].key) !== fav) return; // favorites stay together up front
    [list[i], list[j]] = [list[j], list[i]];
    PB.setOrder(off, list); Sound.click(); PB.save(); renderList();
  }
  $('pbUp').onclick = () => move(-1);
  $('pbDn').onclick = () => move(1);
  $('pbFav').onclick = () => {
    const off = S.tab === 'off', b = PB.book(off), i = b.fav.indexOf(S.sel); if (!S.sel) return;
    if (i >= 0) b.fav.splice(i, 1); else { b.fav.push(S.sel); const h = b.hidden.indexOf(S.sel); if (h >= 0) b.hidden.splice(h, 1); }
    PB.setOrder(off, PB.ordered(off)); Sound.click(); PB.save(); renderList();
  };
  $('pbEdit').onclick = () => { const m = PB.d.mine.find(x => x.key === S.sel); if (!m) return; Sound.click(); S.m = JSON.parse(JSON.stringify(m)); S.slot = 2; S.dirty = false; tab('make'); };
  $('pbDel').onclick = () => {
    if (S.sure !== 'del') { S.sure = 'del'; Sound.click(); return renderList(); }
    const k = S.sel; PB.d.mine = PB.d.mine.filter(x => x.key !== k);
    for (const b of [PB.d.off]) for (const a of ['order', 'hidden', 'fav']) b[a] = b[a].filter(x => x !== k);
    if (S.m && S.m.key === k) S.m = null;
    S.sel = null; S.sure = null; PB.save(); Sound.click(); toast('Play deleted'); renderList();
  };
  $('pbReset').onclick = () => {
    if (S.sure !== 'reset') { S.sure = 'reset'; Sound.click(); return renderList(); }
    S.sure = null; PB.d[S.tab === 'off' ? 'off' : 'def'] = { order: [], hidden: [], fav: [] };
    PB.save(); Sound.click(); toast(S.tab === 'off' ? 'Offense back to default. Your plays are at the end.' : 'Defense back to default'); renderList();
  };

  // ---------- CREATE PLAY ----------
  function newPlay() {
    S.m = { key: '', name: '', form: 'gun', type: 'pass', r: {}, end: {}, tag: {}, pa: false, carrier: 'rb', hole: 3 };
    for (const [s, t] of [[2, 'SLANT'], [3, 'GO'], [4, 'CURL'], [1, 'FLAT']]) setPreset(s, t);
    S.slot = 2; S.dirty = false;
  }
  function setPreset(s, name) {
    const pr = PB.PRESETS.find(p => p[0] === name), m = S.m;
    if (!pr[1]) { delete m.r[s]; m.tag[s] = ''; m.end[s] = 'go'; return; }
    m.r[s] = pr[1].map(x => x.slice()); m.end[s] = pr[2]; m.tag[s] = name;
  }
  // a player's spot on the editor field: [yards downfield (negative = backfield), sideways yards]
  const spotOf = s => { const F = FORMATIONS[S.m.form]; if (S.m.type === 'run' && S.m.carrier === 'jet' && s === 4) return [-2.6, -5]; const [b, w] = F.spots[s]; return [-b, w]; };
  const outOf = s => Math.sign(spotOf(s)[1]) || 1;
  const toAbs = (s, [dd, oo]) => { const [d0, w] = spotOf(s); return [d0 + dd, w + oo * outOf(s)]; };
  const toRel = (s, [d, lat]) => { const [d0, w] = spotOf(s); return [d - d0, (lat - w) * outOf(s)]; };
  const colOf = s => ROUTE_COL[(s === 1 ? 4 : s - 1) - 1];

  function sec(t) { return `<div class="tlSec">${t}</div>`; }
  function chips(id, items, on) { return `<div class="tlTabs pbChips" id="${id}">${items.map(([v, l, x]) => `<button data-v="${v}"${v === on ? ' class="on"' : ''}${x ? ` ${x}` : ''}>${l}</button>`).join('')}</div>`; }
  function renderSide() {
    const m = S.m, pass = m.type === 'pass', side = $('pbSide');
    let h = sec('PLAY NAME') + `<input id="pbName" maxlength="${PB.NAME_MAX}" placeholder="Name your play" value="${html(m.name)}" autocomplete="off" spellcheck="false">`;
    h += sec('FORMATION') + chips('pbForm', Object.keys(FORMATIONS).map(k => [k, FORMATIONS[k].name]), m.form);
    h += sec('PLAY TYPE') + chips('pbType', [['pass', 'PASS'], ['run', 'RUN']], m.type);
    if (pass) {
      h += sec('PLAYER') + chips('pbSlot', PB.SLOTS.map(s => [s, `<i style="background:${colOf(s)}">${PB.SLOTS.indexOf(s) + 1}</i>${PB.SLOT_NAME[s]}`]), S.slot);
      const fake = S.slot === 1 && m.pa;
      h += sec('ROUTE') + (fake ? '<div class="pbNote">The RB fakes the handoff, then blocks. Turn off PLAY ACTION to give him a route.</div>'
        : chips('pbPre', PB.PRESETS.map(p => [p[0], p[0]]), m.r[S.slot] ? m.tag[S.slot] : 'BLOCK'));
      if (!fake && m.r[S.slot]) h += sec('AT THE END') + chips('pbEnd', [['go', 'KEEP RUNNING'], ['sit', 'STOP AND WAIT']], m.end[S.slot]) + '<button class="tlMini pbUndo" id="pbUndo">REMOVE LAST POINT</button>';
      h += sec('PLAY ACTION') + chips('pbPa', [['0', 'NO'], ['1', 'FAKE HANDOFF', m.form === 'empty' ? 'disabled' : '']], m.pa ? '1' : '0');
    } else {
      h += sec('BALL CARRIER') + chips('pbCar', [['rb', 'RB'], ['qb', 'QB'], ['jet', 'SLOT (JET SWEEP)']], m.carrier);
      if (m.carrier === 'rb') h += sec('WHERE IT GOES') + chips('pbHole', PB.HOLE_NAMES.map((n, i) => [i, n]), m.hole);
      else h += `<div class="pbNote">${m.carrier === 'qb' ? 'The QB keeps it and runs. Everyone else blocks.' : 'The fastest WR goes in motion and takes the handoff on the run.'}</div>`;
    }
    h += `<div class="pbBtm"><button class="tlMini" id="pbNew">NEW PLAY</button><span id="pbMsg"></span></div>`;
    side.innerHTML = h;
    const nm = $('pbName');
    nm.addEventListener('input', () => { m.name = nm.value; S.dirty = true; $('pbMsg').textContent = ''; $('pbMsg').className = ''; });
    nm.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); });
    const on = (id, f) => { const box = $(id); if (box) box.querySelectorAll('button').forEach(b => b.onclick = () => { Sound.click(); f(b.dataset.v); S.dirty = true; renderSide(); draw(); }); };
    on('pbForm', v => { m.form = v; if (v === 'empty') m.pa = false; });
    on('pbType', v => { m.type = v; });
    on('pbSlot', v => { S.slot = +v; });
    on('pbPre', v => setPreset(S.slot, v));
    on('pbEnd', v => { m.end[S.slot] = v; });
    on('pbPa', v => { m.pa = v === '1'; if (m.pa && S.slot === 1) S.slot = 2; });
    on('pbCar', v => { m.carrier = v; });
    on('pbHole', v => { m.hole = +v; });
    if ($('pbUndo')) $('pbUndo').onclick = () => { Sound.click(); undo(); };
    $('pbNew').onclick = () => { Sound.click(); newPlay(); renderSide(); draw(); };
    $('pbTip').textContent = pass ? 'Tap a player to pick him. Tap the field to add up to 3 route points, drag them to move.' : m.carrier === 'rb' ? 'Tap a hole on the line to pick where the run goes.' : '';
    $('pbSave').textContent = m.key ? 'SAVE CHANGES' : 'SAVE PLAY';
  }
  function undo() {
    const r = S.m.r[S.slot]; if (!r) return;
    r.pop(); if (!r.length) delete S.m.r[S.slot]; S.m.tag[S.slot] = r.length ? 'ROUTE' : '';
    S.dirty = true; renderSide(); draw();
  }
  function msg(t, bad) { const e = $('pbMsg'); if (e) { e.textContent = t; e.className = bad ? 'bad' : ''; } }

  $('pbSave').onclick = () => {
    const m = S.m; if (!m) return;
    const name = m.name.replace(/\s+/g, ' ').trim();
    if (!name) { Sound.bad(); return msg('Give your play a name first.', true); }
    if (typeof CT !== 'undefined' && CT.BAD.test(name.toLowerCase().replace(/[^a-z]+/g, ' '))) return msg('Pick a different name.', true);
    if (PB.d.mine.some(x => x.key !== m.key && x.name.toLowerCase() === name.toLowerCase())) return msg('You already have a play with that name.', true);
    if (m.type === 'pass' && !PB.SLOTS.some(s => m.r[s] && m.r[s].length && !(s === 1 && m.pa))) return msg('Give at least one player a route.', true);
    if (!m.key && PB.d.mine.length >= PB.MAX) return msg(`You can have ${PB.MAX} plays. Delete one first.`, true);
    m.name = name;
    const isNew = !m.key;
    if (isNew) m.key = 'cp' + Date.now().toString(36) + Math.floor(Math.random() * 36 * 36).toString(36);
    const c = PB.clean(m), i = PB.d.mine.findIndex(x => x.key === c.key);
    if (i >= 0) PB.d.mine[i] = c; else PB.d.mine.push(c);
    if (isNew) { const off = PB.d.off, list = PB.ordered(true).filter(p => p.key !== c.key); const nf = list.findIndex(p => !off.fav.includes(p.key)); list.splice(nf < 0 ? list.length : nf, 0, { key: c.key }); PB.setOrder(true, list); }
    PB.save(); Sound.click();
    S.m = null; S.dirty = false; S.sel = c.key;
    tab('off'); toast(isNew ? `${name.toUpperCase()} is on your play cards` : 'Play saved');
  };
  $('pbBack').onclick = () => {
    Sound.click();
    if (S.tab === 'make' && S.dirty) { S.dirty = false; return msg('Not saved. Tap BACK again to leave.', true); }
    if (S.tab === 'make' && !S.m.key) S.m = null;
    PB.close();
  };
  document.querySelectorAll('#pbTabs button').forEach(b => b.onclick = () => { Sound.click(); if (b.dataset.t === 'make' && S.tab !== 'make' && S.m && S.m.key) S.m = null; tab(b.dataset.t); });

  // ---------- editor field ----------
  function arrow(x0, y0, x1, y1, col, s) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    g.fillStyle = col; g.beginPath(); g.moveTo(x1 + Math.cos(a) * 3, y1 + Math.sin(a) * 3);
    g.lineTo(x1 - Math.cos(a - 0.5) * s, y1 - Math.sin(a - 0.5) * s); g.lineTo(x1 - Math.cos(a + 0.5) * s, y1 - Math.sin(a + 0.5) * s); g.closePath(); g.fill();
  }
  function path(pts, col, w, end, dash) {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash(dash || []);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.setLineDash([]);
    const n = pts.length; if (n < 2) return;
    const [x0, y0] = pts[n - 2], [x1, y1] = pts[n - 1];
    if (end === 'sit') { const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1 - Math.sin(a) * 7, y1 + Math.cos(a) * 7); g.lineTo(x1 + Math.sin(a) * 7, y1 - Math.cos(a) * 7); g.stroke(); }
    else if (end === 'go') arrow(x0, y0, x1, y1, col, 6 + w);
  }
  const blockT = (x, y) => { g.strokeStyle = '#ffffffb0'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 11); g.lineTo(x, y - 18); g.moveTo(x - 5, y - 18); g.lineTo(x + 5, y - 18); g.stroke(); };
  function draw() {
    if (!S.m) return;
    const m = S.m, pass = m.type === 'pass', play = PB.build({ ...m, key: 'cpx' });
    g.setTransform(K, 0, 0, K, 0, 0); g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2f7436'); bg.addColorStop(1, '#265f2c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let d = -5; d <= 30; d += 5) { // yard lines + how far downfield
      g.strokeStyle = d === 0 ? '#5aa0ff' : '#ffffff26'; g.lineWidth = d === 0 ? 2.5 : 1;
      g.beginPath(); g.moveTo(0, Y(d)); g.lineTo(W, Y(d)); g.stroke();
      if (d > 0) { g.fillStyle = '#ffffff55'; g.font = "800 13px 'Barlow Condensed', sans-serif"; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(d + ' YDS', 10, Y(d) + 9); }
    }
    g.strokeStyle = '#ffffffb0'; g.lineWidth = 2; for (const lat of [-26.4, 26.4]) { g.beginPath(); g.moveTo(X(lat), 0); g.lineTo(X(lat), H); g.stroke(); } // sidelines
    g.strokeStyle = '#ffffff1a'; g.lineWidth = 1; // hash marks
    for (let d = -9; d <= 31; d++) for (const lat of [-3.1, 3.1]) { g.beginPath(); g.moveTo(X(lat) - 4, Y(d)); g.lineTo(X(lat) + 4, Y(d)); g.stroke(); }
    // routes (the picked player last so he's on top)
    const P = s => { const [d, lat] = spotOf(s); return [X(lat), Y(d)]; };
    if (pass) {
      for (const s of PB.SLOTS.filter(s => s !== S.slot).concat(S.slot)) {
        if (s === 1 && m.pa) continue;
        const r = m.r[s];
        if (!r) { if (s !== 1) blockT(...P(s)); continue; }
        const pts = [P(s)].concat(r.map(x => { const [d, lat] = toAbs(s, x); return [X(lat), Y(d)]; }));
        g.globalAlpha = s === S.slot ? 1 : 0.75;
        path(pts, colOf(s), s === S.slot ? 4 : 2.6, m.end[s]);
        g.globalAlpha = 1;
        if (s === S.slot) pts.slice(1).forEach(([x, y], i) => { g.fillStyle = '#0c1016'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = "800 10px 'Barlow Condensed', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i + 1, x, y + 0.5); });
      }
      if (m.pa) path([P(1)].concat(play.rb.path.map(([d, lat]) => [X(lat), Y(d)])), '#ffffffb0', 2.4, 'go', [6, 5]);
    } else {
      for (const s of [2, 3, 4]) { // everyone else blocks (on a QB draw the outside guys clear out deep)
        const rt = play.routes && play.routes[s];
        if (rt && rt.end !== 'block') path([P(s)].concat(rt.r.map(x => { const [d, lat] = toAbs(s, x); return [X(lat), Y(d)]; })), '#ffffff90', 2.2, rt.end);
        else if (s !== (play.carrier || 1)) blockT(...P(s));
      }
      if (m.carrier === 'rb') { // holes along the line
        PB.HOLES.forEach((lat, i) => {
          const on = i === m.hole, x = X(lat), y = Y(0) - 30;
          g.fillStyle = on ? '#f6c31c' : '#0c101699'; g.beginPath(); g.moveTo(x - 9, y - 7); g.lineTo(x + 9, y - 7); g.lineTo(x, y + 6); g.closePath(); g.fill();
          if (!on) { g.strokeStyle = '#ffffff70'; g.lineWidth = 1.2; g.stroke(); }
        });
      }
      if (play.qbRun) path([P(0), [X(0), Y(12)]], '#ff8a3d', 4.5, 'go');
      else {
        const c = play.carrier || 1, pts = [P(c)].concat(play.rb.path.map(([d, lat]) => [X(clamp(lat, -25.5, 25.5)), Y(Math.min(d, 29))]));
        path(pts, '#ff8a3d', 4.5, 'go');
        if (play.jet) path([P(1), [X(11), Y(0.8)]], '#ffffffb0', 2.4, 'go', [6, 5]);
      }
    }
    // linemen + players
    for (const lat of [-2.4, 0, 2.4]) { const x = X(lat), y = Y(-0.7); g.fillStyle = '#fff'; g.strokeStyle = '#0b0f16'; g.lineWidth = 1.6; g.fillRect(x - 7, y - 7, 14, 14); g.strokeRect(x - 7, y - 7, 14, 14); }
    const [qx, qy] = P(0); g.fillStyle = '#f6c31c'; g.strokeStyle = '#0b0f16'; g.lineWidth = 1.6; g.beginPath(); g.arc(qx, qy, 9, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#111'; g.font = "800 10px 'Barlow Condensed', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('QB', qx, qy + 0.5);
    for (const s of PB.SLOTS) {
      const [x, y] = P(s), on = pass && s === S.slot;
      if (on) { g.strokeStyle = '#f6c31c'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 14, 0, 7); g.stroke(); }
      g.fillStyle = pass ? colOf(s) : '#fff'; g.strokeStyle = '#0b0f16'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 9.5, 0, 7); g.fill(); g.stroke();
      g.fillStyle = pass ? '#fff' : '#111'; g.font = "900 12px 'Barlow Condensed', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(pass ? PB.SLOTS.indexOf(s) + 1 : '', x, y + 0.5);
      g.fillStyle = on ? '#f6c31c' : '#ffffffc0'; g.font = "800 11px 'Barlow Condensed', sans-serif"; g.fillText(PB.SLOT_NAME[s], x, y + 19);
    }
  }
  // pointer: pick a player, add / drag route points, pick a hole
  const at = e => { const r = cvm.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const fieldAt = ([x, y]) => [clamp(Math.round((LOS - y) / YD * 2) / 2, -8, 30), clamp(Math.round((x - W / 2) / YD * 2) / 2, -25.5, 25.5)];
  cvm.addEventListener('pointerdown', e => {
    if (!S.m) return;
    e.preventDefault();
    const m = S.m, p = at(e), near = (q, r) => Math.hypot(q[0] - p[0], q[1] - p[1]) < r;
    const P = s => { const [d, lat] = spotOf(s); return [X(lat), Y(d)]; };
    if (m.type === 'run') {
      const hit = PB.SLOTS.concat(0).find(s => near(P(s), 22));
      if (hit === 0) m.carrier = 'qb'; else if (hit === 1) m.carrier = 'rb'; else if (hit === 4) m.carrier = 'jet';
      else if (m.carrier === 'rb' && Math.abs(fieldAt(p)[0]) < 5) { const lat = fieldAt(p)[1]; let best = 0; PB.HOLES.forEach((h, i) => { if (Math.abs(h - lat) < Math.abs(PB.HOLES[best] - lat)) best = i; }); m.hole = best; }
      else return;
      Sound.click(); S.dirty = true; renderSide(); draw(); return;
    }
    const r = m.r[S.slot];
    if (r && !(S.slot === 1 && m.pa)) { // grab one of his points
      const i = r.findIndex(x => { const [d, lat] = toAbs(S.slot, x); return near([X(lat), Y(d)], 20); });
      if (i >= 0) { S.drag = i; try { cvm.setPointerCapture(e.pointerId); } catch (_) {} return; }
    }
    const hit = PB.SLOTS.find(s => near(P(s), 22));
    if (hit) { S.slot = hit; if (hit === 1 && m.pa) m.pa = false; Sound.click(); renderSide(); draw(); return; }
    if (S.slot === 1 && m.pa) return;
    const pt = toRel(S.slot, fieldAt(p)), rr = m.r[S.slot] || (m.r[S.slot] = []);
    if (rr.length >= 3) rr[2] = pt; else rr.push(pt);
    S.drag = rr.length - 1; m.tag[S.slot] = 'ROUTE'; if (rr.length === 1 && !m.end[S.slot]) m.end[S.slot] = 'go';
    S.dirty = true; try { cvm.setPointerCapture(e.pointerId); } catch (_) {}
    renderSide(); draw();
  });
  cvm.addEventListener('pointermove', e => {
    if (S.drag == null || !S.m) return;
    const r = S.m.r[S.slot]; if (!r || !r[S.drag]) return;
    r[S.drag] = toRel(S.slot, fieldAt(at(e)));
    if (S.m.tag[S.slot] !== 'ROUTE') { S.m.tag[S.slot] = 'ROUTE'; renderSide(); }
    S.dirty = true; draw();
  });
  const up = () => { S.drag = null; };
  cvm.addEventListener('pointerup', up); cvm.addEventListener('pointercancel', up);

  // keys: Esc = back, 1-4 = pick a player, Backspace = remove a point. Nothing leaks to the paused game underneath.
  window.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    e.stopPropagation();
    if (e.code === 'Escape') return $('pbBack').onclick();
    if (S.tab === 'make' && S.m && S.m.type === 'pass') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) { S.slot = PB.SLOTS[n - 1]; if (S.slot === 1 && S.m.pa) S.m.pa = false; Sound.click(); renderSide(); draw(); }
      if (e.code === 'Backspace' || e.code === 'Delete') { e.preventDefault(); undo(); }
    } else if (S.tab !== 'make' && S.sel) {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { e.preventDefault(); move(-1); }
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { e.preventDefault(); move(1); }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); toggleHide(S.sel); }
    }
  }, true);

  // ---------- ways in: title screen + pause menu ----------
  const tb = document.createElement('button'); tb.className = 'big'; tb.id = 'btnPlaybook'; tb.textContent = 'PLAYBOOK';
  tb.onclick = () => { Sound.init(); Sound.click(); PB.open('title'); };
  $('btnSeason').parentNode.appendChild(tb);
  const pbb = document.createElement('button'); pbb.id = 'btnPlaybookP'; pbb.textContent = 'PLAYBOOK';
  pbb.onclick = () => { if (G.online) return; Sound.click(); PB.open('pause'); };
  $('btnQuit').parentNode.insertBefore(pbb, $('btnQuit'));
  // online games keep running behind the pause menu, so no playbook there
  new MutationObserver(() => { pbb.style.display = G.online ? 'none' : ''; }).observe($('pause'), { attributes: true, attributeFilter: ['class'] });
})();
