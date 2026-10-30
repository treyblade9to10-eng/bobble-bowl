// ---- Two-way players: one guy who starts on offense AND defense (Travis Hunter, or a two-way Career player) ----
// He lives on the roster ONCE, at his main spot. His info slot says what else he plays: p[6].tw = { pos: 'WR', d: -5 } = also WR at his OVR - 5.
// p[6].tw === null = two-way switched off (depth chart). Real ones without the field (Quick Game, old saves) come from TW_REAL by name.
// At game time TwoWay.expand() puts a copy of him in the other lineup in place of the weakest starter at that spot. The copy has p[6].twin = his
// main position. Stats, X-Factors, abilities and season form are all keyed by name, so it stays one player; aging, contracts, injuries
// and trades only ever see the roster tuple.
const TW_REAL = { 'Travis Huntar': { from: 'CB', pos: 'WR', d: -5 } }; // Madden 27: CB 85; his WR numbers (catch 85, routes 80-82, release 79) grade out about 80
// Career: main offensive spot -> the defensive spots he can also play
const TW_COMBOS = { WR: ['CB', 'S'], RB: ['LB', 'S'], TE: ['LB', 'DL'] };
const TW_SLOTS = { WR: [2, 3, 4], TE: [2, 3, 4], RB: [1], DL: [0, 1, 2], LB: [3, 4], CB: [5, 6], S: [7] };
const TW_OFFP = ['QB', 'RB', 'WR', 'TE'];
const twGrp = p => p === 'TE' ? 'WR' : p;
// Madden's stamina abilities (Hunter has both)
AB_TYPES.ironman = { name: 'Ironman', fx: 'iron', desc: 'Two-way: wears down slower' };
AB_TYPES.recuperation = { name: 'Recuperation', fx: 'recup', desc: 'Gets his legs back faster' };
AB_REAL['Travis Huntar'] = ['ironman', 'recuperation'];

const TwoWay = {
  // { pos, d } if this roster tuple also plays the other side
  info(p) {
    if (!p || !p[1]) return null;
    const m = p[6]; if (m && m.twin) return null; // the game-time copy
    if (m && 'tw' in m) return m.tw || null;
    const r = TW_REAL[p[1]]; return r && r.from === p[0] ? r : null;
  },
  // can be switched on in the depth chart (has it, or had it)
  can(p) { return !!(p && (this.info(p) || (p[6] && p[6].twWas) || (TW_REAL[p[1]] && TW_REAL[p[1]].from === p[0]))); },
  set(p, on) {
    const m = p[6] = Object.assign({}, p[6] || {});
    if (on) { const r = TW_REAL[p[1]]; m.tw = m.twWas || (r && r.from === p[0] ? { pos: r.pos, d: r.d } : null); delete m.twWas; }
    else { const cur = this.info(p); if (cur) m.twWas = { pos: cur.pos, d: cur.d }; m.tw = null; }
  },
  // his rating at the other spot
  ovr2(p) { const tw = this.info(p); return tw ? clamp(p[3] + (tw.d || 0), 40, 99) : null; },
  label(p) { const tw = this.info(p); return tw ? `${p[0]}/${tw.pos}` : p[0]; },
  // the game copy of a team: two-way starters show up on both sides (healthy starters only)
  expand(team) {
    if (!team || !team.off || !team.def) return team;
    let t = null;
    for (const side of ['off', 'def']) team[side].forEach((p, i) => {
      const tw = this.info(p); if (!tw || (p[6] && p[6].inj > 0)) return;
      const other = side === 'off' ? 'def' : 'off';
      t = t || { ...team, off: team.off.slice(), def: team.def.slice() };
      const list = t[other]; if (list.some(q => q && q[1] === p[1])) return;
      const free = k => list[k] && !(list[k][6] && (list[k][6].cap || list[k][6].twin));
      let idx = (TW_SLOTS[tw.pos] || []).filter(k => free(k) && twGrp(list[k][0]) === twGrp(tw.pos));
      if (!idx.length) idx = (TW_SLOTS[tw.pos] || []).filter(free);
      if (!idx.length) return;
      const k = idx.reduce((a, b) => list[b][3] < list[a][3] ? b : a);
      const m = Object.assign({}, p[6] || {}); delete m.tw; delete m.twWas; delete m.r; delete m.con; m.twin = p[0];
      list[k] = [tw.pos, p[1], p[2], this.ovr2(p), p[4], p[5], m];
      t[side][i] = p.slice(0, 6).concat([Object.assign({}, p[6] || {}, { twAlso: tw.pos })]); // marks the main one too (for stats)
    });
    return t || team;
  },
  // in-game: [main spot, other spot] for a two-way player object, else null
  pos2(ex, pos) { return ex && ex.twin ? [ex.twin, pos] : ex && ex.twAlso ? [pos, ex.twAlso] : null; },

  // ---- fatigue: he never comes off the field, so he wears down a little (a bit slower, less sprint) ----
  fat(side, name) { return (G.twFat && G.twFat[side + ':' + name]) || 0; },
  // every snap he's out there
  snap(P) {
    const F = G.twFat || (G.twFat = {});
    for (const p of P) {
      if (!p.tw2) continue;
      const k = p.side + ':' + p.name, was = F[k] || 0;
      F[k] = Math.min(1, was + 0.018 * (abHas(p, 'iron') ? 0.6 : 1));
      if (was < 0.6 && F[k] >= 0.6 && G.human >= 0 && !G.demo) addText(p.x, p.y - 2.2, `${lastName(p.name).toUpperCase()} IS GASSED`, '#ffb35c', 13, 1.2);
    }
  },
  // breaks between quarters (halftime = a real rest)
  rest(half) {
    const F = G.twFat; if (!F) return;
    for (const k in F) { const ab = abFor(k.slice(k.indexOf(':') + 1)).some(a => a.fx === 'recup'); F[k] *= half ? (ab ? 0.15 : 0.3) : (ab ? 0.4 : 0.6); }
  },
  // applied when the player object is built for a play
  apply(pl) {
    const f = this.fat(pl.side, pl.name); if (!f) return;
    pl.spd *= 1 - 0.06 * f; pl.stamina = 1 - 0.4 * f; pl.twTired = f;
  }
};
if (typeof SaveGame !== 'undefined') SaveGame.FIELDS.push('twFat');
