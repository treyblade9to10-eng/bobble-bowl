// ---- Player card editor: one full-screen card for any player you can edit ----
// Opens from Create a Team > ROSTER, the Roster editor (Quick Game teams + your franchise) and the Season ROSTER tab.
// PlayerEd.open({ title, team, list: [{ p, kick: 'K'|'P', posList, tag, orig, teamId }], i, onChange, onClose })
// It edits the tuple in place: [pos, name, num, ovr, spd, skin, { age, r }]; kickers [name, num, ovr, skin, { age, r }].
(() => {
  const el = document.createElement('div'); el.id = 'peBox';
  el.innerHTML = '<div class="peCard" id="peCard"></div>';
  document.getElementById('stage').appendChild(el);
})();

const PE_AGE = [18, 45];
const peChev = d => `<svg viewBox="0 0 24 24" class="chev"><path d="${d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;
const peCol = v => v >= 85 ? '#6fdc8c' : v >= 70 ? 'var(--gold)' : v >= 60 ? '#ffb057' : '#ff7a6a';
const peName = s => String(s || '').replace(/[<>&"'`\\]/g, '').slice(0, 18);

const PlayerEd = {
  ctx: null, i: 0, all: false, a: null, auto: true, dirty: false, hint: '',

  // ---- the player's numbers ----
  ix(e) { return e.kick ? { n: 0, no: 1, ov: 2, sk: 3, ex: 4 } : { n: 1, no: 2, ov: 3, sp: 4, sk: 5, ex: 6 }; },
  pos(e) { return e.kick || e.p[0]; },
  spd(e) { return e.kick ? 0 : e.p[4]; },
  ex(e) { return e.p[this.ix(e).ex] || null; },
  ovr(e) { return e.p[this.ix(e).ov]; },
  age(e) {
    const x = this.ex(e); if (x && x.age) return x.age;
    if (e.kick) return 24 + hashStr(e.p[0] || 'k') % 10;
    return typeof ageOf === 'function' ? ageOf(e.teamId || '', e.p) : 26;
  },
  setEx(e, k, v) {
    const I = this.ix(e), x = Object.assign({}, e.p[I.ex] || {}); // a fresh object: franchise info slots can be shared
    if (v == null) delete x[k]; else x[k] = v;
    if (Object.keys(x).length) e.p[I.ex] = x; else if (e.p.length > I.ex) e.p.length = I.ex;
  },
  load() { const e = this.e(), x = this.ex(e); this.a = Ratings.abs(this.ovr(e), this.spd(e), x && x.r, !!e.kick); this.auto = Ratings.ovrOf(this.pos(e), this.a) === this.ovr(e); },
  e() { return this.ctx.list[this.i]; },
  // working ratings -> the tuple (OVR from the ratings when AUTO is on, offsets from OVR saved in p[6].r)
  write() {
    const e = this.e(), I = this.ix(e), kick = !!e.kick;
    const ovr = this.auto ? Ratings.ovrOf(this.pos(e), this.a) : e.p[I.ov], r = {};
    for (const k of kick ? RT_KICK : RT_KEYS) { const o = this.a[k] - (k === 'ACC' ? this.spd(e) : ovr); if (o) r[k] = o; }
    e.p[I.ov] = ovr; this.setEx(e, 'r', Object.keys(r).length ? r : null);
    this.dirty = true;
  },
  setRating(k, v) { this.a[k] = clamp(Math.round(v), RT_MIN, RT_MAX); this.write(); },
  // typing in an OVR moves every rating by the same amount (keeps his strengths, just better or worse)
  setOvr(v) {
    const e = this.e(), I = this.ix(e), keys = Object.keys(this.a).filter(k => k !== 'ACC');
    v = clamp(Math.round(v), RT_MIN, RT_MAX);
    for (let n = 0; n < 4; n++) {
      const d = v - (this.auto ? Ratings.ovrOf(this.pos(e), this.a) : e.p[I.ov]); if (!d) break;
      for (const k of keys) this.a[k] = clamp(this.a[k] + d, RT_MIN, RT_MAX);
      if (!this.auto) { e.p[I.ov] = v; break; }
    }
    this.write();
  },
  setSpd(v) { const e = this.e(); if (e.kick) return; v = clamp(Math.round(v), RT_MIN, RT_MAX); this.a.ACC = clamp(this.a.ACC + v - e.p[4], RT_MIN, RT_MAX); e.p[4] = v; this.write(); }, // ACC rides along with SPD
  val(k) { const e = this.e(); return k === 'OVR' ? this.ovr(e) : k === 'SPD' ? this.spd(e) : this.a[k]; },
  set(k, v) { if (k === 'OVR') this.setOvr(v); else if (k === 'SPD') this.setSpd(v); else this.setRating(k, v); this.refresh(); },
  flush() { if (!this.dirty || !this.ctx) return; this.dirty = false; if (this.ctx.onChange) this.ctx.onChange(this.e()); },

  // ---- open / move / close ----
  open(ctx) {
    this.ctx = ctx; this.i = clamp(ctx.i || 0, 0, ctx.list.length - 1); this.hint = '';
    for (const e of ctx.list) if (!e.orig) e.orig = JSON.parse(JSON.stringify(e.p));
    this.load(); this.render(); $('peBox').classList.add('show');
  },
  go(d) { this.flush(); const n = this.ctx.list.length; this.i = (this.i + d + n) % n; this.hint = ''; this.load(); this.render(); },
  close() { this.flush(); $('peBox').classList.remove('show'); const c = this.ctx; this.ctx = null; if (c && c.onClose) c.onClose(); },
  isOpen() { return !!this.ctx; },
  reset() {
    const e = this.e(), I = this.ix(e), o = e.orig, ox = o[I.ex] || {};
    for (let k = 0; k < I.ex; k++) if (o[k] !== undefined) e.p[k] = o[k];
    this.setEx(e, 'r', ox.r ? { ...ox.r } : null); this.setEx(e, 'age', ox.age || null);
    this.dirty = true; this.load(); this.hint = e.real ? 'Back to his real ratings.' : 'Changes undone.'; this.render();
  },

  // ---- drawing ----
  slider(k, label, sub) {
    const v = this.val(k);
    return `<div class="peRt${k === 'OVR' ? ' peRtO' : ''}" data-k="${k}">
      <span class="peK"><b>${label}</b><i>${sub}</i></span>
      <button class="peStep peMinus" data-k="${k}" data-s="-1" aria-label="Lower ${sub}"></button>
      <div class="peSl" data-k="${k}"><div class="peTr"><u style="width:${(v - RT_MIN) / (RT_MAX - RT_MIN) * 100}%;background:${peCol(v)}"></u></div><em style="left:${(v - RT_MIN) / (RT_MAX - RT_MIN) * 100}%"></em></div>
      <button class="peStep pePlus" data-k="${k}" data-s="1" aria-label="Raise ${sub}"></button>
      <b class="peV" style="color:${peCol(v)}">${v}</b></div>`;
  },
  render() {
    const c = this.ctx, e = this.e(), I = this.ix(e), pos = this.pos(e), kick = !!e.kick, p = e.p;
    const main = Ratings.keysFor(pos), rest = kick ? [] : RT_KEYS.filter(k => !main.includes(k));
    const rows = ks => ks.map(k => this.slider(k, k, RATINGS[k][0])).join('');
    const posBtns = e.posList ? e.posList.map(q => `<button class="pePos${q === pos ? ' on' : ''}" data-p="${q}">${q}</button>`).join('') : `<span class="pePos on lock">${pos}</span>`;
    $('peCard').innerHTML = `
      <div class="peTop">
        <button class="arr2 peArr" data-d="-1" aria-label="Previous player">${peChev(-1)}</button>
        <div class="peWho"><span>${esc(c.title || '')}${e.tag ? '  ·  ' + esc(e.tag) : ''}  ·  ${this.i + 1} / ${c.list.length}</span><b id="peWhoNm">${esc(p[I.n])}</b></div>
        <button class="arr2 peArr" data-d="1" aria-label="Next player">${peChev(1)}</button>
        <button id="peReset">RESET PLAYER</button><button class="big gold" id="peDone">DONE</button>
      </div>
      <div class="peBody">
        <div class="peL">
          <div class="peHero">
            <canvas id="peCv" width="180" height="210"></canvas>
            <div class="peBig"><span class="pePosT">${pos}</span><b id="peOvr" style="color:${peCol(this.ovr(e))}">${this.ovr(e)}</b><span>OVR</span>
              <button id="peAuto" class="${this.auto ? 'on' : ''}" title="AUTO: OVR comes from his ratings">${this.auto ? 'AUTO' : 'LOCKED'}</button></div>
          </div>
          ${this.slider('OVR', 'OVR', 'Overall')}
          <div class="peF"><span>NAME</span><input id="peNm" maxlength="18" value="${esc(p[I.n])}" autocomplete="off" spellcheck="false"></div>
          <div class="peF2">
            <div class="peF"><span>NO.</span><input id="peNo" type="number" inputmode="numeric" min="0" max="99" value="${p[I.no]}"></div>
            <div class="peF peAge"><span>AGE</span><button class="peStep peMinus" data-age="-1" aria-label="Younger"></button><b id="peAgeV">${this.age(e)}</b><button class="peStep pePlus" data-age="1" aria-label="Older"></button></div>
          </div>
          <div class="peF"><span>POS</span><div class="pePosL">${posBtns}</div></div>
          <div class="peF"><span>SKIN</span><div class="peSkL">${SKIN.map((s, j) => `<button class="peSk${p[I.sk] === j ? ' on' : ''}" data-s="${j}" style="background:${s}" aria-label="Skin tone ${j + 1}"></button>`).join('')}</div></div>
          ${typeof abHtml === 'function' ? abHtml(p[I.n]) : ''}
        </div>
        <div class="peR">
          <div class="peSec">${kick ? 'KICKING' : 'SPEED + KEY RATINGS'}<span>${pos}</span></div>
          <div class="peGrid">${kick ? '' : this.slider('SPD', 'SPD', 'Speed')}${rows(main)}</div>
          ${rest.length ? `<div class="peSec">OTHER RATINGS<button id="peAll" class="tlMini">${this.all ? 'HIDE' : 'SHOW ALL'}</button></div>${this.all ? `<div class="peGrid">${rows(rest)}</div>` : ''}` : ''}
          <div id="peHint">${this.hint || (kick ? 'Kick Power = range and distance. Kick Accuracy = slower meter, bigger green zone.' : 'Tap or drag a bar, or hold + / -. While AUTO is on, OVR follows the ratings that matter for his position.')}</div>
        </div>
      </div>`;
    this.wire(); this.portrait();
  },
  // live update while dragging (no re-render, so the finger keeps its grip)
  refresh() {
    const e = this.e();
    document.querySelectorAll('#peCard .peRt').forEach(r => {
      const v = this.val(r.dataset.k), f = (v - RT_MIN) / (RT_MAX - RT_MIN) * 100;
      const u = r.querySelector('u'); u.style.width = f + '%'; u.style.background = peCol(v); r.querySelector('em').style.left = f + '%';
      const b = r.querySelector('.peV'); b.textContent = v; b.style.color = peCol(v);
    });
    const o = $('peOvr'); o.textContent = this.ovr(e); o.style.color = peCol(this.ovr(e));
  },
  portrait() {
    const cv = $('peCv'), t = this.ctx.team; if (!cv) return;
    if (!t || typeof drawTurntable !== 'function') { cv.style.display = 'none'; return; }
    const e = this.e(), I = this.ix(e), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H * 0.62, 8, W / 2, H * 0.62, W * 0.8);
    bg.addColorStop(0, shade(t.c1, -0.25)); bg.addColorStop(1, '#0c1016'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    try {
      const lk = teamLook(t, true, 'home');
      g.save(); g.translate(W / 2, H - 8); g.scale(0.62, 0.62);
      g.fillStyle = '#00000066'; g.beginPath(); g.ellipse(0, 2, 46, 11, 0, 0, 7); g.fill();
      drawTurntable(g, lk, cleatFor(lk, 'home'), { num: e.p[I.no], name: lastName(e.p[I.n]), skin: e.p[I.sk] }, 0.35);
      g.restore();
    } catch (err) { cv.style.display = 'none'; }
  },
  hintFor(k) {
    if (k === 'OVR') return this.auto ? 'OVR: moves all his ratings up or down together.' : 'OVR is LOCKED: it stays where you put it. Tap LOCKED to go back to AUTO.';
    if (k === 'SPD') return 'SPD  Speed: his top speed.';
    return `${k}  ${RATINGS[k][0]}: ${RATINGS[k][1]}.`;
  },
  showHint(k) { this.hint = this.hintFor(k); const h = $('peHint'); if (h) h.textContent = this.hint; },

  // ---- controls ----
  // custom slider: tap anywhere to jump, drag sideways to slide, swipe up/down still scrolls the list (iPhone)
  wireSlider(el) {
    const k = el.dataset.k; let st = null;
    const at = ev => { const r = el.getBoundingClientRect(); return RT_MIN + clamp((ev.clientX - r.left) / r.width, 0, 1) * (RT_MAX - RT_MIN); };
    el.addEventListener('pointerdown', ev => {
      st = { x: ev.clientX, y: ev.clientY, drag: ev.pointerType === 'mouse' }; this.showHint(k);
      if (st.drag) { try { el.setPointerCapture(ev.pointerId); } catch (e) {} this.set(k, at(ev)); }
    });
    el.addEventListener('pointermove', ev => {
      if (!st) return;
      const dx = Math.abs(ev.clientX - st.x), dy = Math.abs(ev.clientY - st.y);
      if (!st.drag && dx > 6 && dx > dy) { st.drag = true; try { el.setPointerCapture(ev.pointerId); } catch (e) {} }
      if (st.drag) { ev.preventDefault(); this.set(k, at(ev)); }
    });
    el.addEventListener('pointerup', ev => { if (st && !st.drag && Math.hypot(ev.clientX - st.x, ev.clientY - st.y) < 10) this.set(k, at(ev)); st = null; this.flush(); });
    el.addEventListener('pointercancel', () => { st = null; this.flush(); });
  },
  // tap = one step, hold = keeps going
  hold(btn, fn) {
    let t1 = null, t2 = null;
    const stop = () => { if (t1 == null && t2 == null) return; clearTimeout(t1); clearInterval(t2); t1 = t2 = null; this.flush(); };
    btn.addEventListener('pointerdown', ev => { ev.preventDefault(); stop(); fn(); t1 = setTimeout(() => { t1 = null; t2 = setInterval(fn, 70); }, 380); });
    for (const k of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(k, stop);
    btn.addEventListener('click', ev => { if (ev.detail === 0) { fn(); this.flush(); } }); // keyboard Enter / Space
    btn.addEventListener('contextmenu', ev => ev.preventDefault()); // long-press menu on phones
  },
  wire() {
    const e = this.e(), I = this.ix(e), box = $('peCard');
    box.querySelectorAll('.peArr').forEach(b => b.onclick = () => this.go(+b.dataset.d));
    $('peDone').onclick = () => this.close();
    $('peReset').onclick = () => this.reset();
    $('peAuto').onclick = () => { this.auto = !this.auto; if (this.auto) this.write(); this.flush(); this.showHint('OVR'); const b = $('peAuto'); b.classList.toggle('on', this.auto); b.textContent = this.auto ? 'AUTO' : 'LOCKED'; this.refresh(); };
    if ($('peAll')) $('peAll').onclick = () => { this.all = !this.all; this.render(); };
    box.querySelectorAll('.peSl').forEach(s => this.wireSlider(s));
    box.querySelectorAll('.peStep[data-k]').forEach(b => this.hold(b, () => { const k = b.dataset.k; this.showHint(k); this.set(k, this.val(k) + +b.dataset.s); }));
    box.querySelectorAll('.peStep[data-age]').forEach(b => this.hold(b, () => {
      const v = clamp(this.age(e) + +b.dataset.age, PE_AGE[0], PE_AGE[1]); this.setEx(e, 'age', v); this.dirty = true; $('peAgeV').textContent = v;
      this.hint = 'AGE: in a Season, young players improve and older ones slow down, retire and want shorter deals.'; $('peHint').textContent = this.hint;
    }));
    const nm = $('peNm'), no = $('peNo');
    nm.addEventListener('input', () => { e.p[I.n] = peName(nm.value); $('peWhoNm').textContent = e.p[I.n]; this.dirty = true; });
    nm.addEventListener('change', () => { if (!e.p[I.n].trim()) { e.p[I.n] = e.kick ? (e.kick === 'P' ? 'Punter' : 'Kicker') : 'Player'; nm.value = e.p[I.n]; } else e.p[I.n] = e.p[I.n].trim(); this.dirty = true; this.flush(); this.portrait(); });
    no.addEventListener('input', () => { if (no.value === '') return; e.p[I.no] = clamp(parseInt(no.value, 10) || 0, 0, 99); this.dirty = true; });
    no.addEventListener('change', () => { no.value = e.p[I.no]; this.flush(); this.portrait(); });
    for (const i of [nm, no]) i.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') i.blur(); });
    box.querySelectorAll('.pePos[data-p]').forEach(b => b.onclick = () => { e.p[0] = b.dataset.p; this.write(); this.flush(); this.render(); });
    box.querySelectorAll('.peSk').forEach(b => b.onclick = () => { e.p[I.sk] = +b.dataset.s; this.dirty = true; this.flush(); box.querySelectorAll('.peSk').forEach(x => x.classList.toggle('on', x === b)); this.portrait(); });
  },

  // ---- roster rows (shared by every list that opens the editor) ----
  row(e, k, extra = '') {
    const p = e.p, I = this.ix(e), pos = this.pos(e), ov = this.ovr(e), edited = !!(this.ex(e) && this.ex(e).r);
    return `<div class="peRow" tabindex="0" data-k="${k}"><span class="pos">${pos}</span><span class="no">${p[I.no]}</span>
      <span class="nm">${esc(p[I.n])}<i>AGE ${this.age(e)}${e.kick ? '' : `  ·  SPD ${p[4]}`}${e.tag === 'HURT' ? '  ·  HURT' : ''}${edited ? '  ·  EDITED' : ''}${typeof abTags === 'function' ? abTags(p[I.n]) : ''}</i></span>
      <b class="ov" style="color:${peCol(ov)}">${ov}</b>${extra}<span class="go">${peChev(1)}</span></div>`;
  },
  wireRows(root, open) {
    root.querySelectorAll('.peRow').forEach(r => {
      r.onclick = ev => { if (ev.target.closest('button')) return; open(+r.dataset.k); };
      r.onkeydown = ev => { if (ev.key === 'Enter' && ev.target === r) open(+r.dataset.k); };
    });
  }
};
$('peBox').addEventListener('keydown', ev => {
  ev.stopPropagation(); // game + menu hotkeys stay off while the card is up
  if (ev.target.tagName === 'INPUT') return;
  if (ev.key === 'Escape') PlayerEd.close();
  else if (ev.key === 'ArrowLeft') PlayerEd.go(-1); else if (ev.key === 'ArrowRight') PlayerEd.go(1);
});
// keys typed while the card is open but nothing in it has focus
window.addEventListener('keydown', ev => {
  if (!PlayerEd.isOpen() || $('peBox').contains(ev.target)) return;
  ev.stopImmediatePropagation();
  if (ev.key === 'Escape') PlayerEd.close(); else if (ev.key === 'ArrowLeft') PlayerEd.go(-1); else if (ev.key === 'ArrowRight') PlayerEd.go(1);
}, true);

// ================= NFL starters you changed in Quick Game (saved on this device, like backups) =================
// Only the players you actually changed are saved, so roster updates still reach everybody else. New Seasons start from these too.
const StarterEd = {
  KEY: 'bobbleStarters', orig: {},
  store() { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { return {}; } },
  saveStore(s) { try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch (e) {} },
  remember(t) { if (t && !t.custom && !this.orig[t.id]) this.orig[t.id] = JSON.parse(JSON.stringify({ off: t.off, def: t.def, k: t.k || null, p: t.p || null })); },
  cleanP(p, pos) { const q = BenchEd.clean(p); q[0] = pos; return q; }, // the spot stays the real one
  cleanK(k) { return CT.ex([CT.str(k && k[0], 18) || 'Kicker', CT.num(k && k[1], 0, 99, 3), CT.num(k && k[2], 40, 99, 72), CT.num(k && k[3], 0, 5, 2)], k && k[4], true); },
  applyAll() {
    const s = this.store();
    for (const t of CT.NFL) {
      this.remember(t); const o = s[t.id], r = this.orig[t.id]; if (!o || typeof o !== 'object') continue;
      for (const side of ['off', 'def']) for (const i in o[side] || {}) if (r[side][+i]) t[side][+i] = this.cleanP(o[side][i], r[side][+i][0]);
      for (const k of ['k', 'p']) if (o[k] && r[k]) t[k] = this.cleanK(o[k]);
    }
  },
  save(t) {
    const r = this.orig[t.id]; if (!r || t.custom) return;
    const o = {}, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const side of ['off', 'def']) t[side].forEach((p, i) => { if (!same(p, r[side][i])) (o[side] || (o[side] = {}))[i] = p; });
    for (const k of ['k', 'p']) if (t[k] && !same(t[k], r[k])) o[k] = t[k];
    const s = this.store(); if (Object.keys(o).length) s[t.id] = o; else delete s[t.id]; this.saveStore(s);
  },
  reset(t) {
    const r = this.orig[t.id]; if (!r) return;
    const c = JSON.parse(JSON.stringify(r)), s = this.store(); delete s[t.id]; this.saveStore(s);
    t.off.splice(0, t.off.length, ...c.off); t.def.splice(0, t.def.length, ...c.def); if (c.k) t.k = c.k; if (c.p) t.p = c.p;
  },
  edited(t) { return !!this.store()[t.id]; }
};
StarterEd.applyAll();

// ================= Create a Team > ROSTER: tap a player for his card =================
TeamLab.peList = function () {
  const t = this.t, L = [];
  t.off.forEach((p, i) => L.push({ p, g: 'off', i, teamId: t.id, tag: 'STARTER' }));
  t.def.forEach((p, i) => L.push({ p, g: 'def', i, teamId: t.id, tag: 'STARTER' }));
  L.push({ p: t.k, kick: 'K', g: 'k', teamId: t.id }, { p: t.p, kick: 'P', g: 'p', teamId: t.id });
  (t.backups || []).forEach((p, i) => L.push({ p, g: 'bk', i, posList: CT.BK_POS, teamId: t.id, tag: 'BACKUP' }));
  return L;
};
TeamLab.pane_ros = function () {
  const t = this.t, avg = l => Math.round(l.reduce((a, p) => a + p[3], 0) / l.length), L = this.peList();
  const rows = g => L.map((e, k) => [e, k]).filter(([e]) => e.g === g || (g === 'st' && e.kick)).map(([e, k]) => PlayerEd.row(e, k, g === 'bk' ? `<button class="tlBkX" data-i="${e.i}">CUT</button>` : '')).join('');
  return `<div class="tlSec">TEAM RATINGS <button class="tlMini" id="tlRandN">NEW NAMES</button></div>
    <div class="tlBig">${[['all', 'TEAM'], ['off', 'OFFENSE'], ['def', 'DEFENSE']].map(([k, n]) => `<label><span>${n}</span><input type="range" min="50" max="99" data-g="${k}" value="${k === 'all' ? CT.ovr(t) : avg(t[k])}"><b>${k === 'all' ? CT.ovr(t) : avg(t[k])}</b></label>`).join('')}</div>
    <div class="tlHint">Tap a player to open his card: ratings, age, number, skin and more.</div>
    <div class="tlSec">OFFENSE</div><div class="peRows">${rows('off')}</div>
    <div class="tlSec">DEFENSE</div><div class="peRows">${rows('def')}</div>
    <div class="tlSec">SPECIAL TEAMS</div><div class="peRows">${rows('st')}</div>
    <div class="tlSec">BACKUPS <span class="tlBkN">${(t.backups || []).length} / ${CT.BK_MAX}</span>
      <button class="tlMini" id="tlBkAdd"${(t.backups || []).length >= CT.BK_MAX ? ' disabled' : ''}>ADD BACKUP</button><button class="tlMini" id="tlBkFill">FILL BENCH</button></div>
    <div class="tlHint">They come in when a starter gets hurt or tired. The first QB is your backup QB, the first RB splits carries.</div>
    <div class="peRows">${rows('bk') || '<div class="tlHint">No backups yet. Tap ADD BACKUP or FILL BENCH.</div>'}</div>`;
};
TeamLab.wire_ros = function () {
  const t = this.t; t.backups = t.backups || [];
  const openAt = k => PlayerEd.open({ title: `${t.city} ${t.name}`.toUpperCase(), team: t, list: this.peList(), i: k, onChange: () => this.renderName(), onClose: () => this.renderEd() });
  PlayerEd.wireRows($('tlPane'), openAt);
  $('tlBkAdd').onclick = () => { if (t.backups.length >= CT.BK_MAX) return; const need = CT.BK_POS.find(pos => !t.backups.some(p => p[0] === pos)) || 'WR'; t.backups.push(CT.mkBackup(need)); this.renderEd(); openAt(this.peList().length - 1); };
  $('tlBkFill').onclick = () => { for (const pos of CT.BK_POS) if (t.backups.length < CT.BK_MAX && !t.backups.some(p => p[0] === pos)) t.backups.push(CT.mkBackup(pos)); this.renderEd(); };
  document.querySelectorAll('#tlPane .tlBkX').forEach(b => b.onclick = () => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'SURE?'; return; } t.backups.splice(+b.dataset.i, 1); this.renderEd(); });
  document.querySelectorAll('.tlBig input').forEach(i => {
    i.addEventListener('input', () => { CT.setOvr(t, i.dataset.g, +i.value); i.nextElementSibling.textContent = i.value; this.renderName();
      document.querySelectorAll('#tlPane .peRow').forEach(r => { const e = this.peList()[+r.dataset.k]; if (e && !e.kick) { const b = r.querySelector('.ov'); b.textContent = e.p[3]; b.style.color = peCol(e.p[3]); } }); });
    i.addEventListener('change', () => this.renderEd());
  });
  $('tlRandN').onclick = () => { for (const p of t.off.concat(t.def)) p[1] = CT.randName(); t.k[0] = CT.randName(); t.p[0] = CT.randName(); this.renderEd(); };
};

// ================= Season > ROSTER tab: tap one of your guys =================
{ const _tab = renderHubTab; renderHubTab = function () {
  _tab();
  if (hubTab !== 'ros' || !Season.data || Season.isCareer()) return; // career is your one guy: no editing the league there
  const d = Season.data, me = d.team, R = Season.ensureRosters()[me], box = $('shStand');
  const L = PlayerEd.seasonList(me), used = new Set();
  box.querySelectorAll('.leadRow').forEach(r => {
    const s = r.querySelector('span'); if (!s) return;
    const k = L.findIndex((e, j) => !used.has(j) && s.textContent.startsWith(`${e.p[0]} ${e.p[1]}`)); if (k < 0) return;
    used.add(k); r.classList.add('peTap'); r.tabIndex = 0;
    r.onclick = () => PlayerEd.open({ title: `${Season.team(me).city} ${Season.team(me).name}`.toUpperCase(), team: Season.team(me), list: PlayerEd.seasonList(me), i: k, onChange: () => Season.save(), onClose: () => renderHubTab() });
  });
  if (R) box.insertAdjacentHTML('afterbegin', '<div class="note">Tap a player to edit his ratings, age and more.</div>');
}; }
// your franchise: starters (spot locked), then the bench
PlayerEd.seasonList = function (id) {
  const R = Season.ensureRosters()[id], bench = Season.bench(id), L = [];
  for (const side of ['off', 'def']) R[side].forEach(p => { if (p && !(p[6] && p[6].cap)) L.push({ p, teamId: id, tag: 'STARTER' }); }); // never your Career guy
  bench.forEach(p => { if (p) L.push({ p, teamId: id, posList: BACKUP_POS, tag: Season.hurt(p) ? 'HURT' : 'BENCH' }); });
  return L;
};
