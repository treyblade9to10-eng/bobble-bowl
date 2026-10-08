// ---- X-Factors: a team's best players get a special ability that switches on when they get hot ----
const XF_TYPES = {
  dimes: { name: 'Dime Dropper', desc: 'Throws land right on the money' },
  freight: { name: 'Freight Train', desc: 'Runs right through arm tackles' },
  hands: { name: 'Double Me', desc: 'Wins almost every contested catch' },
  unstoppable: { name: 'Unstoppable', desc: 'Blockers can barely slow him down' },
  lurker: { name: 'Lurker', desc: 'Jumps routes and takes the ball away' }
};
const XF_FOR = { QB: 'dimes', RB: 'freight', WR: 'hands', TE: 'hands', DL: 'unstoppable', LB: 'unstoppable', CB: 'lurker', S: 'lurker' };
const XF_PLAYS = 8; // how long it stays on

// pick each team's X-Factor players (top 2 stars, 92+; if nobody, their best 89+ guy)
function teamXFactors(team) {
  const all = team.off.concat(team.def).filter(t => XF_FOR[t[0]] && !(t[6] && t[6].cap && t[3] < 85)).sort((a, b) => b[3] - a[3]);
  let list = all.filter(t => t[3] >= 92).slice(0, 2);
  if (!list.length) list = all.filter(t => t[3] >= 89).slice(0, 1);
  const cap = team.off.concat(team.def).find(t => t[6] && t[6].cap && t[3] >= 85); // My Player unlocks his at 85
  if (cap && !list.includes(cap)) list.push(cap);
  return list.map(t => ({ name: t[1], pos: t[0], kind: XF_FOR[t[0]] }));
}
function setupXFactors() {
  G.xf = {};
  G.teams.forEach((t, s) => { for (const x of teamXFactors(t)) G.xf[s + ':' + x.name] = { kind: x.kind, name: x.name, zone: 0, on: false, plays: 0 }; });
}
const xfOn = (p, kind) => !!(p && p.xf && p.xf.on && p.xf.kind === kind);

function xfActivate(p) {
  const x = p.xf; x.on = true; x.zone = 0; x.plays = 0;
  showBanner('X-FACTOR', `${p.name}: ${XF_TYPES[x.kind].name}`, '#ff8a1a', 2);
  addPbp(`${p.name} is in the zone. ${XF_TYPES[x.kind].name}: ${XF_TYPES[x.kind].desc.toLowerCase()}.`);
  Sound.tone(520, 0.12, 'square', 0.06); Sound.tone(780, 0.18, 'square', 0.06, 0, 0.1);
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
    if (x.kind === 'dimes' && p === G.O[0]) {
      if (c && c.kind === 'rec' && c.passer === p) up += gain >= 20 ? 0.6 : 0.34;
      if (td && c && c.passer === p) up += 0.6;
      if (G.intBy || (sack && car === p)) bad = true;
    } else if (x.kind === 'freight') {
      if (c && c.p === p && c.kind === 'rush') { up += gain >= 15 ? 0.7 : gain >= 6 ? 0.4 : 0; if (gain < 0) bad = true; }
      if (td && car === p) up += 1;
    } else if (x.kind === 'hands') {
      if (c && c.p === p && c.kind === 'rec') up += gain >= 15 ? 0.7 : 0.4;
      if (td && car === p) up += 1;
      if (res.type === 'inc' && res.text === 'DROPPED!' && G.intended === p) bad = true;
    } else if (x.kind === 'unstoppable') {
      if (G.lastTackler === p) up += sack ? 0.9 : gain <= 0 ? 0.5 : 0.25;
      if (p.side !== off && gain >= 20) bad = true;
    } else if (x.kind === 'lurker') {
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
