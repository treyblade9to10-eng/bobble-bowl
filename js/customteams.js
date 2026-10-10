// ---- Create-a-Team: your own teams (saved on this device) + the online team database ----
// TEAMS switches between two lineups:
//   useAll()          the 32 NFL teams + your custom teams (Quick Game, Challenges)
//   useLeague(swap)   the 32-team league; in a Season your custom team can take over one NFL team's spot
const CT = {
  KEY: 'bobbleMyTeams',
  DB: 'https://cardio-game-3713-default-rtdb.firebaseio.com/bobble/teams',
  NFL: TEAMS.slice(),
  mine: [],
  OFF: ['QB', 'RB', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL'],
  DEF: ['DL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S'],
  SHAPES: ['shield', 'round', 'diamond', 'hex'],

  load() {
    try { this.mine = (JSON.parse(localStorage.getItem(this.KEY) || '[]') || []).map(t => this.clean(t)).filter(Boolean); } catch (e) { this.mine = []; }
    return this.mine;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.mine)); } catch (e) {} },

  // ---- keep every team safe to show + play (teams from the database are other people's data) ----
  str(s, n) { return String(s == null ? '' : s).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); },
  col(c, d) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c.toUpperCase() : d; },
  num(v, a, b, d) { v = Math.round(+v); return isFinite(v) ? clamp(v, a, b) : d; },
  clean(t) {
    if (!t || typeof t !== 'object') return null;
    const id = this.str(t.id, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (id.length < 2) return null;
    const pl = (p, pos) => ['' + pos, this.str(p && p[1], 18) || 'Player', this.num(p && p[2], 0, 99, 0), this.num(p && p[3], 40, 99, 70), this.num(p && p[4], 40, 99, POS_SPD[pos] || 80), this.num(p && p[5], 0, 5, 2)];
    const ks = (k, d) => [this.str(k && k[0], 18) || d, this.num(k && k[1], 0, 99, 3), this.num(k && k[2], 40, 99, 72), this.num(k && k[3], 0, 5, 2)];
    return {
      id, city: this.str(t.city, 16) || 'My', name: this.str(t.name, 16) || 'Team', conf: 'CUSTOM', div: '', custom: true,
      uid: this.str(t.uid, 24) || this.newUid(), by: this.str(t.by, 16), pub: !!t.pub, at: this.num(t.at, 0, 9e15, Date.now()), dl: this.num(t.dl, 0, 1e9, 0),
      c1: this.col(t.c1, '#1F3A93'), c2: this.col(t.c2, '#F6C31C'), helmet: this.col(t.helmet, '#1F3A93'), mask: this.col(t.mask, '#FFFFFF'), pants: this.col(t.pants, '#FFFFFF'),
      shape: this.SHAPES.includes(t.shape) ? t.shape : 'shield', stadium: this.str(t.stadium, 24) || 'Home Field', dome: !!t.dome,
      off: this.OFF.map((pos, i) => pl(t.off && t.off[i], pos)), def: this.DEF.map((pos, i) => pl(t.def && t.def[i], pos)),
      k: ks(t.k, 'Kicker'), p: ks(t.p, 'Punter')
    };
  },
  newUid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  // abbreviations must be unique (they're the team's id everywhere)
  idTaken(id, uid) { return this.NFL.some(t => t.id === id) || (typeof COLLEGES !== 'undefined' && COLLEGES.some(t => t.id === id)) || this.mine.some(t => t.id === id && t.uid !== uid); },
  freeId(id, uid) { if (!this.idTaken(id, uid)) return id; const b = id.slice(0, 3); for (let i = 2; i < 99; i++) if (!this.idTaken(b + i, uid)) return (b + i).slice(0, 4); return 'T' + Math.floor(Math.random() * 999); },

  // ---- which teams are in TEAMS right now ----
  mode: 'all', swap: null,
  useAll() {
    this.mode = 'all'; this.swap = null;
    TEAMS.length = 0; TEAMS.push(...this.NFL, ...this.mine);
    this.fixSel();
  },
  useLeague(swap) {
    this.mode = 'league'; this.swap = swap || null;
    TEAMS.length = 0; TEAMS.push(...this.NFL);
    if (swap && swap.team) {
      const i = TEAMS.findIndex(t => t.id === swap.out), t = this.clean(swap.team);
      if (i >= 0 && t) TEAMS[i] = { ...t, conf: this.NFL[i].conf, div: this.NFL[i].div, replaces: swap.out };
    }
    this.fixSel();
  },
  fixSel() {
    if (typeof sel === 'undefined') return;
    for (const s of [0, 1]) if (!(sel.idx[s] < TEAMS.length)) sel.idx[s] = s;
    if (sel.idx[0] === sel.idx[1]) sel.idx[1] = (sel.idx[0] + 1) % TEAMS.length;
    if (typeof snIdx !== 'undefined' && !(snIdx < TEAMS.length)) snIdx = 0;
  },

  // ---- a fresh team to start from ----
  blank() {
    const t = { id: this.freeId('NEW', ''), city: 'Milwaukee', name: 'Thunder', c1: '#1F3A93', c2: '#F6C31C', helmet: '#1F3A93', mask: '#F6C31C', pants: '#FFFFFF', shape: 'shield', stadium: 'Thunder Field', dome: false, pub: false, by: '' };
    const mk = (pos, i) => [pos, this.randName(), this.randNum(pos, i), 75 + Math.round(rand(-7, 7)), clamp((POS_SPD[pos] || 80) + Math.round(rand(-4, 4)), 50, 97), Math.floor(Math.random() * 6)];
    t.off = this.OFF.map(mk); t.def = this.DEF.map(mk);
    t.k = [this.randName(), 3, 75, Math.floor(Math.random() * 6)]; t.p = [this.randName(), 9, 74, Math.floor(Math.random() * 6)];
    return this.clean(t);
  },
  randName() { return `${pick(TL_FIRST)} ${pick(TL_LAST)}`; },
  randNum(pos) {
    const r = { QB: [1, 19], RB: [20, 39], WR: [10, 19, 80, 89], TE: [80, 89], OL: [60, 79], DL: [90, 99], LB: [40, 59], CB: [20, 39], S: [20, 39] }[pos] || [1, 99];
    const k = r.length > 2 && chance(0.5) ? 2 : 0; return r[k] + Math.floor(Math.random() * (r[k + 1] - r[k] + 1));
  },
  // set every player's overall around a target, keeping who's better than who
  setOvr(t, side, target) {
    const list = side === 'all' ? t.off.concat(t.def) : t[side];
    const avg = list.reduce((a, p) => a + p[3], 0) / list.length;
    for (const p of list) p[3] = clamp(Math.round(p[3] + target - avg), 40, 99);
  },
  ovr(t) { const a = t.off.concat(t.def); return Math.round(a.reduce((s, p) => s + p[3], 0) / a.length); },

  // ---- online database (public teams) ----
  BAD: /(fuck|shit|bitch|cunt|nigg|fagg|whore|porn|nazi|hitler|retard|penis|vagina|pussy|slut|\b(dick|cock|sex|sexy|rape|anal|cum|boob|boobs|kys|fag|ass|hoe|tits)\b)/,
  isClean(t) { return ![t.city, t.name, t.id, t.stadium, t.by, ...t.off.map(p => p[1]), ...t.def.map(p => p[1]), t.k[0], t.p[0]].some(s => this.BAD.test(String(s).toLowerCase().replace(/[^a-z]+/g, ' '))); },
  async publish(t) {
    if (!this.isClean(t)) throw new Error('Some words in this team are not allowed. Change them and try again.');
    const body = { ...t, pub: true, at: Date.now() }; delete body.custom; delete body.conf; delete body.div;
    const r = await fetch(`${this.DB}/${t.uid}.json`, { method: 'PUT', body: JSON.stringify(body) });
    if (!r.ok) throw new Error('Could not reach the team database (' + r.status + ').');
  },
  async unpublish(t) { try { await fetch(`${this.DB}/${t.uid}.json`, { method: 'DELETE' }); } catch (e) {} },
  async browse() {
    const r = await fetch(`${this.DB}.json`);
    if (!r.ok) throw new Error('Could not reach the team database (' + r.status + ').');
    const all = (await r.json()) || {};
    return Object.keys(all).map(k => this.clean({ ...all[k], uid: k })).filter(t => t && t.pub && this.isClean(t));
  },
  async countDownload(t) { try { await fetch(`${this.DB}/${t.uid}/dl.json`, { method: 'PUT', body: String((t.dl || 0) + 1) }); } catch (e) {} },
  // put somebody else's team in My Teams (your copy is private and editable)
  adopt(t) {
    const c = this.clean({ ...t, uid: this.newUid(), pub: false, from: t.uid });
    c.id = this.freeId(c.id, c.uid); c.fromBy = t.by;
    this.mine.push(c); this.save(); return c;
  }
};
const TL_FIRST = ['Marcus', 'Jaylen', 'Tyler', 'DeShawn', 'Cole', 'Malik', 'Bryce', 'Isaiah', 'Trent', 'Andre', 'Caleb', 'Darius', 'Logan', 'Xavier', 'Jordan', 'Quinton', 'Brady', 'Elijah', 'Rashad', 'Owen', 'Dante', 'Mason', 'Terrell', 'Chase', 'Jalen', 'Noah', 'Kendall', 'Micah', 'Reggie', 'Zion'];
const TL_LAST = ['Barnes', 'Whitfield', 'Okoro', 'Castillo', 'Merritt', 'Hayes', 'Sutton', 'Lockhart', 'Boone', 'Fairley', 'Granger', 'Pruitt', 'Ashby', 'Delaney', 'Kincaid', 'Mercer', 'Tolliver', 'Vance', 'Holloway', 'Rhodes', 'Stallings', 'Bishop', 'Crowder', 'Mabry', 'Ellison', 'Foreman', 'Lattimore', 'Quarles', 'Redmond', 'Sterling'];
CT.load();
CT.useAll();
