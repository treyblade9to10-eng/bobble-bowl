// ---- X-Factors: the real Madden 27 X-Factor players, each with his real ability, switches on when he gets hot ----
const XF_TYPES = {
  // real Madden 27 abilities
  dots: { name: 'Dots', desc: 'Every pass is thrown with elite accuracy' },
  bazooka: { name: 'Bazooka', desc: 'Can throw it way deeper than anybody' },
  rungun: { name: 'Run & Gun', desc: 'Elite accuracy throwing on the run' },
  proreads: { name: 'Pro Reads', desc: 'Ignores the pass rush and puts it on target' },
  brickwall: { name: 'Brick Wall', desc: 'Breaks the first sack attempt' },
  truzz: { name: 'Truzz', desc: 'Never fumbles' },
  freight: { name: 'Freight Train', desc: 'Runs right through arm tackles' },
  firstfree: { name: 'First One Free', desc: 'His next juke or spin always fakes the defender out' },
  ankle: { name: 'Ankle Breaker', desc: 'Jukes and spins leave defenders grabbing air' },
  phenom: { name: 'Phenom', desc: 'Wins the first battle with any defender' },
  hands: { name: 'Double Me', desc: 'Wins almost every contested catch' },
  yac: { name: "YAC 'Em Up", desc: 'Breaks the first tackle after the catch' },
  unstoppable: { name: 'Unstoppable Force', desc: 'Blockers can barely slow him down' },
  relentless: { name: 'Relentless', desc: 'Pass rush moves are free and win more' },
  dualthreat: { name: 'Dual Threat', desc: 'Beats blocks and knocks catches loose' },
  fearmonger: { name: 'Fearmonger', desc: 'Pressures the QB even while he is blocked' },
  momentum: { name: 'Momentum Shift', desc: 'Knocks the whole other team out of the zone' },
  univ: { name: 'Universal Coverage', desc: 'Knocks the ball loose on almost every catch he contests' },
  shutdown: { name: 'Shutdown', desc: 'Tighter coverage and more picks' },
  bottleneck: { name: 'Bottleneck', desc: 'Jams his receiver at the line' },
  reinforcement: { name: 'Reinforcement', desc: 'Sheds run blocks and makes the stop' },
  // made-up ones for created teams + My Player
  dimes: { name: 'Dime Dropper', desc: 'Throws land right on the money' },
  lurker: { name: 'Lurker', desc: 'Jumps routes and takes the ball away' }
};
const XF_FOR = { QB: 'dimes', RB: 'freight', WR: 'hands', TE: 'hands', DL: 'unstoppable', LB: 'unstoppable', CB: 'lurker', S: 'lurker' };
// who has one in Madden 27 (EA ratings, Oct 2026), by the name he has in this game
const XF_REAL = {
  "Josh Allan": 'bazooka', "Pat Mahomez": 'bazooka', "Matthew Staffurd": 'dots', "Joe Burrows": 'rungun', "Dak Prescot": 'rungun', "Jalen Hurtz": 'rungun',
  "Drake Mayes": 'proreads', "Caleb Wiliamz": 'brickwall', "Lamar Jaxon": 'truzz',
  "Jonathan Tailer": 'freight', "Derrick Henrie": 'freight', "Bijan Robbinson": 'firstfree', "Jahmyr Gibbz": 'firstfree',
  "Christian McCafferty": 'ankle', "Nico Colins": 'ankle', "Saquon Barkly": 'phenom',
  "Ja'Marr Chaze": 'hands', "Jaxon Smith-Njigbuh": 'hands', "Puka Nakua": 'hands', "Justin Jeffurson": 'hands', "Amon-Ra St. Browne": 'hands',
  "Brock Bowerz": 'hands', "Mike Evanz": 'hands', "Terry McLauren": 'hands',
  "Trey McBryde": 'yac', "George Kittel": 'yac', "CeeDee Lam": 'yac',
  "Myles Garret": 'unstoppable', "T.J. Watts": 'unstoppable', "Aidan Hutchinsun": 'unstoppable', "Josh Hines-Allun": 'unstoppable',
  "Maxx Crosbee": 'relentless', "Nick Bossa": 'relentless', "Micah Parsnips": 'dualthreat', "Cam Haywood": 'fearmonger', "Vita Veya": 'fearmonger',
  "Chris Jonez": 'momentum',
  "Christian Gonzales": 'univ', "Fred Warnor": 'univ',
  "Pat Surtane II": 'shutdown', "Jessie Bayts": 'shutdown', "Antoine Winfeld Jr.": 'shutdown', "Derek Stingly": 'shutdown', "Xavier McKinny": 'shutdown',
  "Jalen Ramzy": 'bottleneck',
  "Derwin Jamez": 'reinforcement', "Roquan Smyth": 'reinforcement', "Demario Davus": 'reinforcement', "Budda Bakery": 'reinforcement'
};
const XF_RUSH = new Set(['unstoppable', 'relentless', 'dualthreat', 'fearmonger', 'momentum']);
// which zone meter he builds: passer, runner, catcher, pass rusher or cover guy (by spot on the field)
function xfFamily(pos, kind) {
  if (pos === 'QB') return 'qb';
  if (pos === 'RB') return 'rb';
  if (pos === 'WR' || pos === 'TE') return 'rec';
  if (pos === 'DL') return 'rush';
  if (pos === 'LB') return XF_RUSH.has(kind) ? 'rush' : 'cov';
  return 'cov';
}
const XF_PLAYS = 8; // how long it stays on

// NFL teams: the real X-Factor players. Created teams: their top 2 stars (92+), or their best 89+ guy. My Player unlocks his at 85.
function teamXFactors(team) {
  const ok = t => XF_FOR[t[0]] && !(t[6] && t[6].cap && t[3] < 85) && !(typeof xfTooOld !== 'undefined' && xfTooOld(t) && !(t[6] && t[6].cap));
  const starters = team.off.concat(team.def).filter(ok);
  let list;
  if (!team.custom) {
    // real X-Factors keep it until age drags them under 85 OVR in franchise (some are already 33+ in real life)
    const real = t => t && XF_REAL[t[1]] && XF_FOR[t[0]] && t[3] >= 85;
    const all = team.off.concat(team.def, [team.qb2, team.rb2], team.bench || []); // a backup X-Factor keeps it when he comes in
    list = all.filter(real).map(t => ({ t, kind: XF_REAL[t[1]] }));
  } else {
    const all = starters.slice().sort((a, b) => b[3] - a[3]);
    let top = all.filter(t => t[3] >= 92).slice(0, 2);
    if (!top.length) top = all.filter(t => t[3] >= 89).slice(0, 1);
    list = top.map(t => ({ t, kind: XF_FOR[t[0]] }));
  }
  const cap = team.off.concat(team.def).find(t => t[6] && t[6].cap && t[3] >= 85);
  if (cap && !list.some(x => x.t === cap)) list.push({ t: cap, kind: XF_FOR[cap[0]] });
  return list.map(({ t, kind }) => ({ name: t[1], pos: t[0], kind }));
}
function setupXFactors() {
  G.xf = {};
  G.teams.forEach((t, s) => { for (const x of teamXFactors(t)) G.xf[s + ':' + x.name] = { kind: x.kind, fam: xfFamily(x.pos, x.kind), name: x.name, zone: 0, on: false, plays: 0 }; });
}
const xfOn = (p, kind) => !!(p && p.xf && p.xf.on && p.xf.kind === kind);
// one-shot abilities (first sack / first tackle / next move): once per play, G.xfSpent is cleared at the snap
function xfFree(p, kind) {
  if (!xfOn(p, kind)) return false;
  const used = G.xfSpent || (G.xfSpent = new Set());
  if (used.has(p)) return false;
  used.add(p); return true;
}

function xfActivate(p) {
  const x = p.xf; x.on = true; x.zone = 0; x.plays = 0;
  showBanner('X-FACTOR', `${p.name}: ${XF_TYPES[x.kind].name}`, '#ff8a1a', 2);
  addPbp(`${p.name} is in the zone. ${XF_TYPES[x.kind].name}: ${XF_TYPES[x.kind].desc.toLowerCase()}.`);
  Sound.tone(520, 0.12, 'square', 0.06); Sound.tone(780, 0.18, 'square', 0.06, 0, 0.1);
  if (x.kind === 'momentum') for (const q of G.players) if (q.xf && q.side !== p.side && (q.xf.on || q.xf.zone > 0)) { if (q.xf.on) xfKnockOut(q); q.xf.zone = 0; }
}
function xfKnockOut(p) {
  if (!p.xf.on) { p.xf.zone = Math.max(0, p.xf.zone - 0.5); return; }
  p.xf.on = false; p.xf.zone = 0;
  addText(p.x, p.y, 'OUT OF THE ZONE', '#ffb27a', 15, 1);
  addPbp(`${lastName(p.name)} has been knocked out of the zone.`);
}

// after every scrimmage play: build up / burn down each X-Factor's zone meter
function xfAfterPlay(res, r) {
  if (!G.xf || !r || G.demo) return;
  const off = G.poss, c = G.credit, gain = r.gain || 0, car = res.carrier, cs = car ? car.side : off;
  const td = res.type === 'td' && cs === off, sack = res.type === 'sack';
  for (const p of G.players) {
    const x = p.xf; if (!x) continue;
    let up = 0, bad = false;
    const fam = x.fam || xfFamily(p.pos, x.kind);
    if (fam === 'qb' && p === G.O[0]) {
      if (c && c.kind === 'rec' && c.passer === p) up += gain >= 20 ? 0.6 : 0.34;
      if (td && c && c.passer === p) up += 0.6;
      if (G.intBy || (sack && car === p)) bad = true;
    } else if (fam === 'rb') {
      if (c && c.p === p && c.kind === 'rush') { up += gain >= 15 ? 0.7 : gain >= 6 ? 0.4 : 0; if (gain < 0) bad = true; }
      if (td && car === p) up += 1;
    } else if (fam === 'rec') {
      if (c && c.p === p && c.kind === 'rec') up += gain >= 15 ? 0.7 : 0.4;
      if (td && car === p) up += 1;
      if (res.type === 'inc' && res.text === 'DROPPED!' && G.intended === p) bad = true;
    } else if (fam === 'rush') {
      if (G.lastTackler === p) up += sack ? 0.9 : gain <= 0 ? 0.5 : 0.25;
      if (p.side !== off && gain >= 20) bad = true;
    } else if (fam === 'cov') {
      if (G.intBy === p) up += 1; else if (G.breakup === p) up += 0.5; else if (G.lastTackler === p) up += 0.2;
      if (p.side !== off && c && c.kind === 'rec' && gain >= 25) bad = true;
    }
    if (x.on) { x.plays++; if (bad || x.plays >= XF_PLAYS) xfKnockOut(p); }
    else if (bad) xfKnockOut(p);
    else if (up > 0) { x.zone += up; if (x.zone >= 1) xfActivate(p); }
  }
}

// glow + badge for a player who's in the zone (drawn under / over the bobblehead)
function drawXFRing(g, p, x, y) {
  if (!p.xf || !p.xf.on) return;
  const f = 1 + Math.sin(G.time * 10) * 0.08;
  const rg = g.createRadialGradient(x, y, 4, x, y, 34 * f);
  rg.addColorStop(0, 'rgba(255,140,26,0.55)'); rg.addColorStop(1, 'rgba(255,90,0,0)');
  g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, 34 * f, 14 * f, 0, 0, 7); g.fill();
  g.strokeStyle = '#ff8a1a'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y, 25 * f, 10 * f, 0, 0, 7); g.stroke();
}
function drawXFBadge(g, p, x, y) {
  if (!p.xf || !p.xf.on) return;
  g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
  g.fillStyle = '#ff8a1a'; g.strokeStyle = '#111'; g.lineWidth = 2; g.fillRect(-8, -8, 16, 16); g.strokeRect(-8, -8, 16, 16);
  g.restore();
  g.fillStyle = '#111'; g.font = 'italic 900 14px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('X', x, y + 1);
}
