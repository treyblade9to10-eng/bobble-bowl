// ---- Specific ratings (Madden-style) on top of OVR ----
// A player can carry them in his info slot: p[6].r = { CTH: +4, TAK: -6, ... } (kickers: k[4].r).
// They're stored as OFFSETS from his OVR (ACC: from his SPD), so everything that moves OVR (aging, progression,
// boosts, CPU difficulty) moves his ratings with it. Missing rating = offset 0 = plays exactly like OVR always did.
const RATINGS = {
  ACC: ['Acceleration', 'How fast he gets up to top speed'],
  AGI: ['Agility', 'Jukes in the open field, beating the press jam'],
  STR: ['Strength', 'Driving and holding the pile at the line'],
  AWR: ['Awareness', 'Defense: reads the run and a blocker staying in sooner. QB: throws it away instead of taking a sack'],
  THP: ['Throw Power', 'Ball speed and how far he can throw it'],
  THA: ['Throw Accuracy', 'How close his throws land to the target'],
  CTH: ['Catching', 'Catching passes, holding on in traffic, interceptions'],
  CAR: ['Carrying', 'Ball security: fewer fumbles when he gets hit'],
  BTK: ['Break Tackle', 'Shrugging off tacklers'],
  RBK: ['Run Block', 'Holding blocks on running plays'],
  PBK: ['Pass Block', 'Keeping rushers off the QB'],
  PRS: ['Pass Rush', 'Beating pass blocks, swim moves'],
  BSH: ['Block Shed', 'Getting off blocks against the run'],
  TAK: ['Tackling', 'Bringing the ball carrier down'],
  COV: ['Coverage', 'Sticking with receivers, breaking up and picking off passes'],
  KPW: ['Kick Power', 'Field goal range, kickoff and punt distance'],
  KAC: ['Kick Accuracy', 'Bigger green zone, slower meter, more makes']
};
const RT_KEYS = Object.keys(RATINGS).filter(k => k !== 'KPW' && k !== 'KAC'), RT_KICK = ['KPW', 'KAC'];
// what OVR means at each spot: a weighted average of the ratings that spot actually uses in games (ACC is not in it, it rides on SPD)
const RT_W = {
  QB: { THA: 35, THP: 30, AWR: 25, AGI: 5, CAR: 5 },
  RB: { BTK: 25, AGI: 25, CAR: 20, CTH: 20, PBK: 5, STR: 5 },
  WR: { CTH: 45, AGI: 30, BTK: 10, CAR: 10, RBK: 5 },
  TE: { CTH: 30, RBK: 25, PBK: 15, STR: 10, BTK: 10, AGI: 5, CAR: 5 },
  OL: { PBK: 40, RBK: 40, STR: 20 },
  DL: { PRS: 35, BSH: 35, STR: 15, TAK: 15 },
  LB: { TAK: 30, BSH: 20, AWR: 20, COV: 20, PRS: 10 },
  CB: { COV: 50, CTH: 20, AWR: 15, TAK: 15 },
  S: { COV: 35, TAK: 25, AWR: 20, CTH: 20 },
  K: { KPW: 50, KAC: 50 }, P: { KPW: 60, KAC: 40 }
};
const RT_MIN = 40, RT_MAX = 99;

const Ratings = {
  // the ratings a position cares about first (biggest OVR weight first, ACC near the top for everyone but linemen)
  keysFor(pos) {
    if (pos === 'K' || pos === 'P') return RT_KICK.slice();
    const w = RT_W[pos] || {}, main = Object.keys(w).sort((a, b) => w[b] - w[a]);
    if (pos !== 'OL') main.splice(Math.min(2, main.length), 0, 'ACC');
    return main;
  },
  // sanitize an offsets object (saves, database teams): only known keys, whole numbers, and it has to land in 40-99
  clean(r, ovr, spd, kick) {
    if (!r || typeof r !== 'object') return null;
    const out = {};
    for (const k of kick ? RT_KICK : RT_KEYS) {
      const v = Math.round(+r[k]); if (!v || !isFinite(v)) continue;
      const base = k === 'ACC' ? spd : ovr, o = clamp(v, RT_MIN - base, RT_MAX - base);
      if (o) out[k] = o;
    }
    return Object.keys(out).length ? out : null;
  },
  // full numbers for the editor: { ACC: 91, CTH: 84, ... }
  abs(ovr, spd, r, kick) {
    const out = {};
    for (const k of kick ? RT_KICK : RT_KEYS) out[k] = clamp((k === 'ACC' ? spd : ovr) + ((r && r[k]) || 0), RT_MIN, RT_MAX);
    return out;
  },
  // OVR from the ratings for that spot
  ovrOf(pos, a) {
    const w = RT_W[pos]; if (!w) return null;
    let s = 0, n = 0; for (const k in w) { s += w[k] * a[k]; n += w[k]; }
    return clamp(Math.round(s / n), RT_MIN, RT_MAX);
  },
  // full numbers -> new OVR + offsets (what gets saved)
  pack(pos, a, spd, kick) {
    const ovr = this.ovrOf(pos, a), r = {};
    for (const k of kick ? RT_KICK : RT_KEYS) { const o = a[k] - (k === 'ACC' ? spd : ovr); if (o) r[k] = o; }
    return { ovr, r: Object.keys(r).length ? r : null };
  }
};

// ---- in games: a live player's specific rating. p.rt = the offsets (engine makePlayer), p.ovr already has the CPU difficulty in it
const rat = (p, k) => p.rt && p.rt[k] ? clamp(p.ovr + p.rt[k], 20, 99) : p.ovr;
// ACC: +10 over his SPD = ~12% quicker burst
const accMul = p => p.rt && p.rt.ACC ? clamp(1 + p.rt.ACC * 0.012, 0.6, 1.4) : 1;
// CAR: 10 over his OVR = 30% fewer fumbles
const carMul = p => p && p.rt && p.rt.CAR ? clamp(1 - p.rt.CAR * 0.03, 0.3, 2) : 1;
