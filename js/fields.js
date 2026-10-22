// ---- Field paint jobs: end zones, turf, midfield, wall. Created teams carry their own (published with the team),
// NFL teams can be repainted on this device (saved per team, RESET goes back to the real look) ----
const FieldStyle = {
  KEY: 'bobbleField', d: null,
  PATS: [['solid', 'SOLID'], ['stripes', 'STRIPES'], ['checker', 'CHECKER'], ['diamonds', 'DIAMONDS'], ['pins', 'PINSTRIPES'], ['fade', 'FADE'], ['frame', 'BORDER']],
  // field shades: [label, grass stripe A, grass stripe B, apron]. Classic keeps the original colors
  SHADES: {
    classic: ['CLASSIC', '#3d9a43', '#378f3c', '#2b6b2e'], dark: ['DARK', '#2c7533', '#286b2e', '#1f4f22'], light: ['BRIGHT', '#55b55a', '#4dab52', '#3a8a3e'],
    blue: ['BLUE', '#2f6fd3', '#2a64c2', '#1d4a94'], red: ['RED', '#b8352d', '#a92f28', '#7a211c'], black: ['BLACK', '#202329', '#1b1d22', '#121418'], purple: ['PURPLE', '#5d3a9e', '#54348f', '#3c2568']
  },
  TSTY: [['block', 'BLOCK'], ['italic', 'ITALIC'], ['hollow', 'HOLLOW'], ['none', 'NO WORDS']],
  LOGOS: [[0, 'OFF'], [1, 'SMALL'], [2, 'NORMAL'], [3, 'BIG']],
  MIDS: [['none', 'NONE'], ['logo', 'LOGO'], ['big', 'BIG LOGO']],
  DEF: { ez: 'c1', pat: 'solid', pc: 'auto', tx: '', tc: 'c2', oc: 'auto', ts: 'block', lg: 2, mid: 'logo', surf: 'grass', sh: 'classic', yc: '#FFFFFF', wall: 'c1' },
  TXT_MAX: 14,

  // ---- keep it safe: created teams' styles come from the online database (other people's data) ----
  hex(c) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c.toUpperCase() : null; },
  clean(f, nfl) {
    if (!f || typeof f !== 'object') return null;
    const D = this.DEF, one = (v, list, d) => list.includes(v) ? v : d, cc = (v, sp, d) => sp.includes(v) ? v : this.hex(v) || d;
    const o = {
      ez: cc(f.ez, ['c1', 'c2'], D.ez), pat: one(f.pat, this.PATS.map(p => p[0]), D.pat), pc: cc(f.pc, ['auto'], D.pc),
      tx: this.text(f.tx), tc: cc(f.tc, ['c1', 'c2'], D.tc), oc: cc(f.oc, ['auto'], D.oc), ts: one(f.ts, this.TSTY.map(p => p[0]), D.ts),
      lg: [0, 1, 2, 3].includes(f.lg) ? f.lg : D.lg, mid: one(f.mid, this.MIDS.map(p => p[0]), D.mid),
      surf: one(f.surf, ['grass', 'turf'], D.surf), sh: this.SHADES[f.sh] && Object.prototype.hasOwnProperty.call(this.SHADES, f.sh) ? f.sh : D.sh,
      yc: cc(f.yc, [], D.yc), wall: cc(f.wall, ['c1', 'c2'], D.wall)
    };
    if (nfl) { // NFL overrides on this device can also rename the stadium and add/remove the roof
      const n = this.text(f.name, 24); if (n) o.name = n;
      if (f.dome === true || f.dome === false) o.dome = f.dome;
    }
    return o;
  },
  text(s, n = this.TXT_MAX) { return String(s == null ? '' : s).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); },

  // ---- NFL teams: device-saved overrides (same idea as the Uniform Room's helmet stripes) ----
  all() { if (!this.d) { try { this.d = JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { this.d = {}; } } return this.d; },
  get(id) { const v = this.all()[id]; return v ? this.clean(v, true) : null; },
  set(id, f) { const c = this.clean(f, true); if (c) this.all()[id] = c; else delete this.all()[id]; this.store(); },
  reset(id) { delete this.all()[id]; this.store(); },
  store() { this.ver++; try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) {} },

  // the real look: some stadiums paint stripes or a checkerboard, turf fields look brighter
  real(team) {
    const s = team && !team.custom && STADIUMS[team.id];
    return { ...this.DEF, pat: team && !team.custom && EZ_STYLE[team.id] || 'solid', surf: s && s[2] === 'turf' ? 'turf' : 'grass' };
  },
  of(team) {
    if (!team) return { ...this.DEF };
    const o = team.custom ? this.clean(team.field) : this.get(team.id);
    const f = { ...this.real(team), ...(o || {}) }; delete f.name; delete f.dome;
    return f;
  },
  // cheap enough to check every frame (the field picture is only redrawn when this changes)
  key(G) { const t = G.teams[0]; return (G.online ? 'n' : '') + (G.bigGame ? 'B' : '') + (t.custom ? JSON.stringify(t.field || 0) + t.stadium + t.dome : 'v' + this.ver); },
  ver: 0,
  // turn 'c1' / 'auto' into real colors for this team
  colors(f, t) {
    const tc = v => v === 'c1' ? t.c1 : v === 'c2' ? t.c2 : v;
    const base = tc(f.ez), txt = tc(f.tc);
    const auto = ['stripes', 'checker'].includes(f.pat) ? shade(base, -0.22) : shade(base, lum(base) < 0.22 ? 0.3 : -0.28); // new patterns pop a bit more (lighter on dark colors)
    return { base, pat: f.pc === 'auto' ? auto : f.pc, text: txt, out: f.oc === 'auto' ? shade(base, -0.5) : f.oc, wall: tc(f.wall), yard: f.yc };
  },
  turf(f) {
    const s = this.SHADES[f.sh] || this.SHADES.classic;
    if (f.surf === 'turf') return f.sh === 'classic' ? { a: '#34a04f', b: '#2f9749', apron: '#23743a', mow: 0.02 } : { a: shade(s[1], 0.06), b: shade(s[2], 0.06), apron: s[3], mow: 0.02 };
    return { a: s[1], b: s[2], apron: s[3], mow: 0.05 };
  },

  // ---- paint one end zone (x0,y0 = top-left, w x h pixels). side 0 = left end zone (words read bottom to top) ----
  paintEZ(g, t, f, x0, y0, w, h, side) {
    const C = this.colors(f, t);
    const ez = g.createLinearGradient(x0, 0, x0 + w, 0);
    ez.addColorStop(0, shade(C.base, -0.15)); ez.addColorStop(0.5, C.base); ez.addColorStop(1, shade(C.base, -0.15));
    g.fillStyle = ez; g.fillRect(x0, y0, w, h);
    if (f.pat !== 'solid') {
      g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); g.fillStyle = C.pat; g.strokeStyle = C.pat;
      const yb = y0 + h, back = side === 0 ? x0 : x0 + w; // back line = far edge of the end zone
      if (f.pat === 'stripes') for (let k = -h; k < w + h; k += 44) { g.beginPath(); g.moveTo(x0 + k, y0); g.lineTo(x0 + k + 20, y0); g.lineTo(x0 + k + 20 - h, yb); g.lineTo(x0 + k - h, yb); g.fill(); }
      else if (f.pat === 'checker') { const cw = w / 4, ch = cw / 1.7; for (let i = 0; i < 4; i++) for (let j = 0; j * ch < h; j++) if ((i + j) % 2) g.fillRect(x0 + i * cw, y0 + j * ch, cw, ch); }
      else if (f.pat === 'diamonds') { // diamonds touching tip to tip (squished like the rest of the field)
        const dw = w / 4, dh = dw * 0.62;
        for (let i = 0; i <= 4; i++) for (let j = 0; j * dh <= h + dh; j++) { const cx = x0 + i * dw, cy = y0 + j * dh; g.beginPath(); g.moveTo(cx, cy - dh / 2); g.lineTo(cx + dw / 2, cy); g.lineTo(cx, cy + dh / 2); g.lineTo(cx - dw / 2, cy); g.closePath(); g.fill(); }
      }
      else if (f.pat === 'pins') for (let x = x0 + 9; x < x0 + w; x += 18) g.fillRect(x, y0, 3, h);
      else if (f.pat === 'fade') { const fg = g.createLinearGradient(back, 0, side === 0 ? x0 + w : x0, 0); fg.addColorStop(0, C.pat); fg.addColorStop(1, C.pat + '00'); g.fillStyle = fg; g.fillRect(x0, y0, w, h); }
      else if (f.pat === 'frame') { g.lineWidth = 10; g.strokeRect(x0 + 16, y0 + 12, w - 32, h - 24); g.lineWidth = 3; g.strokeRect(x0 + 32, y0 + 26, w - 64, h - 52); }
      g.restore();
    }
    // logos at both ends (kept inside the end zone when they're big), the words in the middle
    const L = [0, 4.2, 5.6, 7.4][f.lg] * PX, ly = Math.max(h * 0.12, L / 2 + 8);
    if (L && typeof Logo !== 'undefined' && g.save) for (const yy of [y0 + ly, y0 + h - ly]) Logo.draw(g, t, x0 + w / 2, yy, L); // logos keep their real shape
    if (f.ts === 'none') return;
    const word = (f.tx || t.name).toUpperCase(), room = (L ? h - 2 * (ly + L / 2) - 16 : h - 40);
    g.save(); g.translate(x0 + w / 2, y0 + h / 2); g.rotate(side === 0 ? -Math.PI / 2 : Math.PI / 2);
    let fs = 86; g.font = `${f.ts === 'italic' ? 'italic ' : ''}900 ${fs}px "Barlow Condensed", "Arial Black", sans-serif`;
    const tw = g.measureText(word).width; if (tw > room && room > 40) { fs = Math.max(30, Math.floor(fs * room / tw)); g.font = `${f.ts === 'italic' ? 'italic ' : ''}900 ${fs}px "Barlow Condensed", "Arial Black", sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    if (f.ts === 'hollow') { // outlined letters: the end zone shows through
      g.lineWidth = fs * 0.2; g.strokeStyle = C.out; g.strokeText(word, 0, 0);
      g.lineWidth = fs * 0.09; g.strokeStyle = C.text; g.strokeText(word, 0, 0);
      g.fillStyle = C.base; g.fillText(word, 0, 0);
    } else { g.lineWidth = fs * 0.093; g.strokeStyle = C.out; g.strokeText(word, 0, 0); g.fillStyle = C.text; g.fillText(word, 0, 0); }
    g.restore();
  },

  // ---- a picture of the field with the real field painter (for the editors) ----
  // view 'half' = what the game camera sees near the goal line, 'ez' = close-up of the left end zone
  preview(cv, team, view) {
    if (typeof buildField !== 'function' || !cv) return;
    const opp = team.id === 'DAL' ? CT.NFL[0] : CT.NFL.find(x => x.id === 'DAL') || CT.NFL[0];
    const fake = { teams: [team, opp], demo: false, bigGame: null };
    const keep = [fieldCv, fieldKey, crowdCv, crowdPat]; // the real game's field stays untouched
    fieldKey = '#preview'; fieldCv = null;
    try { buildField(fake); } catch (e) { [fieldCv, fieldKey, crowdCv, crowdPat] = keep; return; }
    const src = fieldCv;
    [fieldCv, fieldKey, crowdCv, crowdPat] = keep;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, ez = view === 'ez';
    const x0 = ez ? -1.2 : -4, x1 = ez ? 12 : 64; // yards
    const sx0 = (x0 + FIELD_PAD_X) * PX, sw = (x1 - x0) * PX, sy0 = (FIELD_PAD_TOP - (ez ? 1 : 3.2)) * PY, sh = (FIELD_W + (ez ? 2 : 4.6)) * PY;
    g.fillStyle = '#0c1016'; g.fillRect(0, 0, W, H);
    g.imageSmoothingQuality = 'high';
    g.save(); g.translate(W / 2, H / 2);
    if (ez) g.rotate(Math.PI / 2); // close-up: the end zone turned on its side so the words read across
    const bw = ez ? H : W, bh = ez ? W : H, k = Math.min(bw / sw, bh / sh), dw = sw * k, dh = sh * k;
    g.drawImage(src, sx0, sy0, sw, sh, -dw / 2, -dh / 2, dw, dh);
    g.restore();
    src.width = src.height = 0; // let phones free the big picture right away
  }
};
