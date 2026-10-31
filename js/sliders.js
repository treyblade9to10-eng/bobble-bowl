// ---- Sliders (like Madden): every one goes 0-100, 50 = the normal game (exactly). Saved in bobbleOpts.sliders.
// The engine asks Sliders.mul(key) at the spot where that chance / rate is worked out. Online: the host runs the game, so the host's sliders count. ----
// [key, label, what it does, multiplier at 0, multiplier at 100, group]
const SLIDER_DEFS = [
  ['cpuAcc', 'QB ACCURACY', 'How close CPU throws land to the target', 2.6, 0.35, 'CPU'],
  ['cpuInt', 'INTERCEPTIONS', 'How often CPU defenders pick you off', 0, 2.5, 'CPU'],
  ['cpuRush', 'PASS RUSH', 'How fast CPU rushers beat your blockers', 0.35, 2.5, 'CPU'],
  ['cpuRunBlk', 'RUN BLOCKING', 'How long CPU blockers hold on runs', 2.2, 0.45, 'CPU'],
  ['cpuTkl', 'TACKLING', 'How often CPU tacklers bring you down', 0.6, 1.3, 'CPU'],
  ['humAcc', 'QB ACCURACY', 'How close your throws land to the target', 2.6, 0.35, 'YOU'],
  ['humTkl', 'TACKLING', 'How often your tacklers bring them down', 0.6, 1.3, 'YOU'],
  ['fum', 'FUMBLES', 'How often runners cough it up', 0, 3, 'GAME'],
  ['pen', 'PENALTIES', 'How often the refs throw flags', 0, 3, 'GAME'],
  ['inj', 'INJURIES', 'QB injuries in games, Season injuries between weeks', 0, 3, 'GAME'],
  ['spd', 'SPEED GAP', 'How much faster the fast guys are than the slow ones', 0.4, 1.6, 'GAME']
];
const Sliders = {
  v: {},
  load() {
    try { const s = JSON.parse(localStorage.getItem('bobbleOpts') || '{}').sliders || {}; this.v = {}; for (const d of SLIDER_DEFS) if (Number.isFinite(s[d[0]])) this.v[d[0]] = clamp(Math.round(s[d[0]]), 0, 100); } catch (e) { this.v = {}; }
  },
  val(k) { const v = this.v[k]; return v == null ? 50 : v; },
  // 50 = exactly 1, so the default game is untouched
  mul(k) {
    if (G.online) return 1; // online = the normal game for both players
    const v = this.val(k); if (v === 50) return 1;
    const d = SLIDER_DEFS.find(x => x[0] === k); if (!d) return 1;
    return v < 50 ? lerp(d[3], 1, v / 50) : lerp(1, d[4], (v - 50) / 50);
  },
  // the CPU / your side version of a slider (cpuKey only = it does nothing for your side)
  side(side, cpuKey, humKey) { return isHumanSide(side) ? (humKey ? this.mul(humKey) : 1) : this.mul(cpuKey); },
  // a flag that's always called at 50+ (no dice roll, so the default game plays out the same)
  call(k) { const m = this.mul(k); return m >= 1 || chance(m); },
  changed() { return SLIDER_DEFS.some(d => this.val(d[0]) !== 50); },
  set(k, v) { v = clamp(Math.round(+v || 0), 0, 100); if (v === 50) delete this.v[k]; else this.v[k] = v; this.save(); },
  reset() { this.v = {}; this.save(); },
  save() {
    try { const o = JSON.parse(localStorage.getItem('bobbleOpts') || '{}'); if (this.changed()) o.sliders = { ...this.v }; else delete o.sliders; localStorage.setItem('bobbleOpts', JSON.stringify(o)); } catch (e) {}
  },

  // ---------- the SLIDERS panel (opens over whatever screen you're on) ----------
  open(back) {
    this.back = back || null;
    let el = document.getElementById('slPanel');
    if (!el) {
      el = document.createElement('div'); el.id = 'slPanel';
      el.innerHTML = `<div id="slHead"><b>SLIDERS</b><span>50 = the normal game</span><button id="slReset">RESET TO DEFAULTS</button><button id="slDone" class="big gold">DONE</button></div><div id="slBody"></div>`;
      document.getElementById('stage').appendChild(el);
      el.querySelector('#slReset').onclick = () => { Sound.click(); this.reset(); this.paint(); };
      el.querySelector('#slDone').onclick = () => this.close();
      const body = el.querySelector('#slBody');
      for (const g of ['CPU', 'YOU', 'GAME']) {
        const grp = document.createElement('div'); grp.className = 'slGrp';
        grp.innerHTML = `<div class="muGh">${g === 'YOU' ? 'YOUR TEAM' : g === 'CPU' ? 'CPU TEAM' : 'GAME'}</div>`;
        for (const [k, label, help] of SLIDER_DEFS.filter(d => d[5] === g)) {
          const row = document.createElement('label'); row.className = 'slRow'; row.dataset.k = k;
          row.innerHTML = `<span class="slL">${label}<i>${help}</i></span><input type="range" min="0" max="100" step="1"><b class="slV"></b>`;
          const inp = row.querySelector('input');
          inp.addEventListener('input', () => { this.set(k, inp.value); this.paintRow(row); });
          inp.addEventListener('keydown', e => e.stopPropagation()); // arrow keys move the slider, not the game
          grp.appendChild(row);
        }
        body.appendChild(grp);
      }
    }
    this.paint(); el.classList.add('show');
  },
  paintRow(row) {
    const v = this.val(row.dataset.k), inp = row.querySelector('input');
    if (+inp.value !== v) inp.value = v;
    inp.style.setProperty('--p', v + '%');
    const b = row.querySelector('.slV'); b.textContent = v; b.classList.toggle('mod', v !== 50);
  },
  paint() { document.querySelectorAll('#slPanel .slRow').forEach(r => this.paintRow(r)); },
  close() { Sound.click(); const el = document.getElementById('slPanel'); if (el) el.classList.remove('show'); if (this.back) this.back(); },
  isOpen() { const el = document.getElementById('slPanel'); return !!(el && el.classList.contains('show')); }
};
Sliders.load();
