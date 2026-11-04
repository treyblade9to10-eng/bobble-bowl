// ---- Play-by-play: one announcer line per play, shown under the scorebug and in the pause menu ----
const ln = p => p ? lastName(p.name) : 'Somebody';
const yd = n => `${Math.abs(n)} yard${Math.abs(n) === 1 ? '' : 's'}`;

function addPbp(text, extra) {
  if (G.demo || !G.teams) return;
  if (!G.pbp) G.pbp = [];
  const q = G.quarter > 4 ? 'OT' : `Q${G.quarter}`, c = Math.max(0, Math.ceil(G.clock || 0));
  const line = { text: extra ? `${text} ${extra}` : text, q, clock: `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`, t: G.time };
  G.pbp.push(line); if (G.pbp.length > 200) G.pbp.shift();
  G.pbpShow = line;
}

// called by endPlay() before the down/score bookkeeping, so G.los is still the old spot
function pbpPlay(res) {
  if (G.demo || !G.play || !G.play.off) return;
  const off = G.poss, d = dirOf(off), car = res.carrier, cs = car ? car.side : off;
  const x = res.x != null ? res.x : G.los;
  const gain = Math.round(d * (Math.min(d > 0 ? 110 : 120, Math.max(d > 0 ? 0 : 10, x)) - G.los));
  const c = G.credit, tk = G.lastTackler;
  const flag = G.flags && G.flags.length ? ' Flag on the play.' : '';
  let s = '', hype = '';
  if (res.kneel) {
    s = `${ln(car)} takes a knee.`;
  } else if (res.type === 'inc') {
    const qb = G.lastPasser || (G.O && G.O[0]), tgt = G.intended;
    s = `${ln(qb)} pass incomplete${tgt ? `, intended for ${ln(tgt)}` : ''}.`;
    if (res.text === 'DROPPED!') s = `${ln(tgt)} drops it.`;
    else if (res.text === 'BROKEN UP!' || res.text === 'SWATTED!') s = `${ln(qb)} pass broken up${G.breakup ? ` by ${ln(G.breakup)}` : ''}.`;
  } else if (G.intBy && cs !== off) {
    s = `${ln(G.lastPasser || G.O[0])} pass INTERCEPTED by ${ln(G.intBy)}` + (res.type === 'td' ? ', and he takes it to the house!' : '.');
    hype = pick(['Huge turnover.', 'Read that one the whole way.', 'What a pick.']);
  } else if (res.type === 'sack') {
    s = `${ln(car)} sacked by ${ln(tk)} for a loss of ${yd(gain)}.`;
  } else if (res.type === 'fumble' || (cs !== off)) {
    s = cs !== off ? `FUMBLE, recovered by ${ln(car)}.` : `Fumble, but ${ln(car)} falls on it.`;
  } else if (c && c.kind === 'rec') {
    s = `${ln(c.passer)} pass to ${ln(c.p)} for ${gain < 0 ? 'a loss of ' : ''}${yd(gain)}`;
    s += res.type === 'td' ? '. TOUCHDOWN!' : tk ? `, tackled by ${ln(tk)}.` : res.type === 'oob' ? ', out of bounds.' : '.';
  } else if (c && c.kind === 'rush') {
    const how = c.p.pos === 'QB' ? pick(['scrambles', 'keeps it', 'takes off']) : pick(['runs', 'carries', 'rushes']);
    s = `${ln(c.p)} ${how} for ${gain < 0 ? 'a loss of ' : gain === 0 ? 'no gain' : ''}${gain === 0 ? '' : yd(gain)}`;
    s += res.type === 'td' ? '. TOUCHDOWN!' : tk ? `, tackled by ${ln(tk)}.` : res.type === 'oob' ? ', out of bounds.' : '.';
  } else s = `${ln(car)} for ${yd(gain)}.`;
  if (!hype && res.type === 'td') hype = pick(['He is gone!', 'Nobody is catching him.', 'Put it on the board.', 'Six!']);
  else if (!hype && gain >= 25 && cs === off) hype = pick(['Big play.', 'Chunk play!', 'That will move the chains.', 'Look at him go.']);
  else if (!hype && res.type === 'sack' && gain <= -8) hype = 'Drive killer.';
  const col = flag ? null : pbpColor(res, gain, cs, x);
  addPbp(s + flag, col ? col.text : hype);
  return { gain, type: res.type, big: res.type === 'td' || (G.intBy && cs !== off) || (cs === off && gain >= 25) || (res.type === 'fumble' && cs !== off) };
}

// ---- color commentary: what the play means today (running totals, streaks, runs, records, the situation) ----
// One short extra line at most, picked by how big it is; never the same kind twice in a row. A few also get a short
// tag for the banner (G.cmTag, put on by pbpBanner after endPlay). G.cm = the counts, new for every game.
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const tmName = s => G.teams[s].name;
function cmState() {
  if (!G.cm || G.cm.ref !== G.pbp) G.cm = { ref: G.pbp, sc: G.score.slice(), run: { side: -1, n: 0 }, down: [0, 0], long: 0, comp: {}, td: {}, tdp: {}, ms: {}, sacks: [0, 0], fum: [0, 0], last: '', lastText: '', said: {} };
  const c = G.cm, d = [G.score[0] - c.sc[0], G.score[1] - c.sc[1]];
  if (d[0] > 0 || d[1] > 0) { const s = d[0] >= d[1] ? 0 : 1; c.run = c.run.side === s ? { side: s, n: c.run.n + 1 } : { side: s, n: 1 }; c.sc = G.score.slice(); }
  for (const s of [0, 1]) c.down[s] = Math.max(c.down[s], G.score[1 - s] - G.score[s]);
  return c;
}
function pbpColor(res, gain, cs, x) {
  if (G.demo || G.mini || G.practice || G.twoPt || !G.teams || !G.score) return null;
  const c = cmState(), off = G.poss, def = 1 - off, d = dirOf(off), cr = G.credit, q = G.quarter, clk = Math.max(0, Math.ceil(G.clock || 0));
  const clock = `${Math.floor(clk / 60)}:${String(clk % 60).padStart(2, '0')}`, toGo = Math.round(Math.abs(G.firstDownX - G.los));
  const late = (q >= 4 && clk <= 120) || (q === 2 && clk <= 60), close = Math.abs(G.score[0] - G.score[1]) <= 8;
  const toGoal = Math.abs(goalX(off) - G.los), td = res.type === 'td' && cs === off, kept = cs === off && res.type !== 'inc' && res.type !== 'sack';
  const fd = kept && !td && d * (x - G.firstDownX) >= -0.05, stakes = G.playoff ? 'playoff' : (G.rivalryMatch || G.rivalry || (typeof isRivalry === 'function' && isRivalry(G.teams[0], G.teams[1]))) ? 'rival' : '';
  const L = []; // [priority, kind, text, banner tag, who the tag is about]
  const add = (pr, kind, text, tag, who) => L.push([pr, kind, text, tag || null, who || null]);
  const UP = p => ln(p).toUpperCase();
  const key = p => p.side + ':' + p.name;
  // passing streaks (count every throw, even this one)
  const qb = G.lastPasser;
  if (qb && (res.type === 'inc' || (cr && cr.kind === 'rec')) && !(G.intBy && cs !== off)) {
    const k = key(qb), n0 = c.comp[k] || 0;
    if (res.type === 'inc') { if (n0 >= 6) add(4, 'streak', `That ends a run of ${n0} straight completions.`); c.comp[k] = 0; }
    else { const n = c.comp[k] = n0 + 1; if (n >= 5 && n % 2 === 1) add(4, 'streak', pick([`That's ${n} straight completions for ${ln(qb)}.`, `${ln(qb)} has hit ${n} in a row.`, `${n} straight completions. He's locked in.`])); }
  }
  if (G.intBy && cs !== off && qb) c.comp[key(qb)] = 0;
  // the score: touchdowns, go-ahead scores, comebacks, runs
  if (td) {
    const car = res.carrier, k = key(car), n = c.td[k] = (c.td[k] || 0) + 1;
    if (n >= 2) add(6, 'tds', pick([`That's his ${ord(n)} touchdown today.`, `Touchdown number ${n} for ${ln(car)}.`, `${ln(car)} finds the end zone again. That's ${n}.`]), `${ord(n).toUpperCase()} TD TODAY`, car);
    if (cr && cr.kind === 'rec' && cr.passer) { const pk = key(cr.passer), m = c.tdp[pk] = (c.tdp[pk] || 0) + 1; if (m >= 2) add(5, 'tdpass', `${ln(cr.passer)}'s ${ord(m)} touchdown pass of the game.`, `${UP(cr.passer)}: ${ord(m).toUpperCase()} TD PASS`, cr.passer); }
    const before = G.score[off] - G.score[def], after = before + 6;
    if (late && q >= 4 && before <= 0 && after > 0) add(9, 'lead', pick([`They take the lead with ${clock} left!`, `Go-ahead score with ${clock} to go!`]), 'GO-AHEAD SCORE');
    else if (c.down[off] >= 10 && before < 0 && after > 0) { add(8, 'comeback', pick([`They were down ${c.down[off]}. Not anymore.`, `What a comeback. They were down ${c.down[off]}.`]), `WERE DOWN ${c.down[off]}`); c.down[off] = 0; }
    else if (after === -1 || after === 0) add(6, 'tie', after === 0 ? 'And this game is tied up.' : 'The extra point ties it.');
    const run = (c.run.side === off ? c.run.n : 0) + 1;
    if (run >= 3) add(7, 'run', pick([`That's ${run} straight scores for the ${tmName(off)}.`, `The ${tmName(off)} have scored ${run} times in a row.`]), `${run} STRAIGHT SCORES`);
    if (G.down === 4) add(8, 'fourth', pick(['On fourth down! What a call.', 'They went for it on fourth, and it paid off.']));
    if (q === 2 && clk <= 30) add(5, 'half', pick(['Points right before the half.', 'Big score heading into halftime.']));
    if (stakes === 'playoff' && q >= 4 && close) add(5, 'stakes', pick(['Huge score with the season on the line.', 'Win or go home, and that was big.']));
    else if (stakes === 'rival' && !c.said.rival) { c.said.rival = 1; add(3, 'stakes', pick(['Rivalry game, and this crowd is loving it.', 'Nothing like a rivalry touchdown.'])); }
    if (toGoal <= 20 && G.los !== x) add(1, 'rz', 'Red zone trip ends in six.');
  }
  // yards today: milestones, longest play
  if (kept && cr && gain > 0) {
    const ms = (p, have, list, what) => { const k = key(p) + what, hit = list.filter(m => have < m && have + gain >= m).pop(); if (hit && !c.ms[k + hit]) { c.ms[k + hit] = 1; add(hit >= 100 ? 6 : 3, 'yds', pick([`That puts ${ln(p)} over ${hit} ${what} yards today.`, `${ln(p)} has ${hit}+ ${what} yards on the day.`]), `${UP(p)}: ${hit}+ ${what.slice(0, what === 'receiving' ? 3 : 4).toUpperCase()} YDS`, p); } };
    if (cr.kind === 'rush') ms(cr.p, stat(cr.p).rush, [50, 100, 150, 200], 'rushing');
    else { ms(cr.p, stat(cr.p).rec, [50, 100, 150, 200], 'receiving'); if (cr.passer) ms(cr.passer, stat(cr.passer).pass, [200, 300, 400], 'passing'); }
    if (gain >= 20 && gain > c.long) { if (c.long > 0) add(td ? 4 : 5, 'long', pick(['Longest play of the game so far.', `Longest gain of the day. ${gain} yards.`]), 'LONGEST PLAY TODAY'); c.long = gain; }
  }
  // the down and distance
  if (fd && G.down === 4) add(7, 'fourth', pick(['Converted on fourth down!', 'They went for it, and they got it.']), '4TH DOWN CONVERSION');
  else if (fd && G.down === 3 && toGo >= 8) add(5, 'third', pick([`Third and ${toGo}, and he moves the chains.`, `Big conversion on third and ${toGo}.`]), `3RD & ${toGo} CONVERTED`);
  if (!td && G.down === 4 && (res.type === 'inc' || res.type === 'sack' || (kept && !fd))) add(7, 'stop', pick(['Stopped on fourth down! Huge stand by the defense.', 'Turnover on downs. What a stop.']));
  if (kept && !td && !fd && toGoal > 20 && d * (goalX(off) - x) <= 20 && d * (goalX(off) - x) > 0) add(1, 'rz', pick(['Now they are in the red zone.', 'Knocking on the door now.']));
  // sacks, picks, fumbles
  if (res.type === 'sack' && G.lastTackler) {
    const tk = G.lastTackler, n = stat(tk).sack, t = ++c.sacks[def];
    if (n >= 2) add(6, 'sacks', pick([`That's his ${ord(n)} sack today.`, `${ln(tk)} gets home again. Sack number ${n}.`]), `${ord(n).toUpperCase()} SACK TODAY`, tk);
    else if (t >= 3) add(4, 'sacks', `${ord(t)} sack of the game for the ${tmName(def)} defense.`);
  }
  if (G.intBy && cs !== off) {
    const n = stat(G.intBy).int, m = qb ? stat(qb).int : 0, thrown = qb ? Object.values(G.pstats || {}).filter(s => s.side === def).reduce((a, s) => a + (s.int || 0), 0) : 0;
    if (n >= 2) add(7, 'picks', pick([`That's his ${ord(n)} interception today!`, `${ln(G.intBy)} with pick number ${n}!`]), `${UP(G.intBy)}: ${ord(n).toUpperCase()} INT TODAY`, G.intBy);
    else if (thrown >= 2 && qb) add(5, 'picks', `That's ${thrown} picks for ${ln(qb)} today.`);
    if (toGoal <= 20) add(5, 'rz', 'Picked off in the red zone. Big swing.');
    if (q >= 4 && clk <= 120 && G.score[def] > G.score[off]) add(6, 'seal', pick(['That should just about seal it.', 'That might be the ball game.']));
  } else if (cs !== off) { // fumble lost
    const n = ++c.fum[off]; if (n >= 2) add(4, 'fum', `That's ${n} fumbles lost for the ${tmName(off)}.`);
  }
  // the clock, late in a half
  if (late && !td && kept && G.score[off] <= G.score[def] && clk > 0) {
    if (res.type === 'oob') add(3, 'clock', pick(['Smart. He gets out of bounds to stop the clock.', 'Out of bounds. Clock stops.']));
    else if (G.timeouts && G.timeouts[off] === 0) add(3, 'clock', pick([`Clock is running. ${clock} left.`, `No timeouts left, and the clock is ticking.`]));
  }
  // the best line that isn't a repeat of the last one
  L.sort((a, b) => b[0] - a[0]);
  const best = L.find(l => (l[1] !== c.last || l[0] >= 8) && l[2] !== c.lastText);
  if (!best) return null;
  c.last = best[1]; c.lastText = best[2];
  G.cmTag = best[3] ? { tag: best[3], who: best[4] && best[4].name, t: G.time } : null;
  return { text: best[2], tag: best[3] };
}
// endPlay just put up its banner: add the tag to the sub-line (TOUCHDOWN! / FIRST DOWN! / SACKED! / TURNOVER!)
function pbpBanner() {
  const t = G.cmTag, b = G.banner; G.cmTag = null;
  if (!t || !b || G.time - t.t > 0.5 || !/TOUCHDOWN|FIRST DOWN|SACKED|TURNOVER/.test(b.text)) return;
  const name = (b.sub || '').split(' • ')[0];
  if (/TOUCHDOWN|SACKED/.test(b.text) && name) { if (!t.who || t.who === name) b.sub = `${name} • ${t.tag.replace(/^[^:]*: /, '')}`; } // his own news only, under his name
  else b.sub = b.sub && b.sub.length + t.tag.length < 34 ? `${b.sub} • ${t.tag}` : t.tag;
}

// little ticker under the scoreboard for the latest line
function drawTicker(g, G) {
  const L = G.pbpShow; if (!L || G.demo || G.mini) return;
  // the play-call cards cover the top of the screen, and a big banner is the same news: wait, then show the line for its full time
  const t0 = L.st != null ? L.st : L.t;
  if ((G.banner && G.banner.t < G.banner.dur) || $('playcall').classList.contains('show')) { if (G.time - t0 < 5) L.st = Math.max(t0, G.time - 0.2); return; }
  const age = G.time - t0; if (age > 5 || G.phase === 'live' || G.phase === 'replay') return;
  const a = Math.min(1, age * 5, (5 - age) * 2);
  g.save(); g.globalAlpha = a;
  g.font = '600 17px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = L.text.length > 110 ? L.text.slice(0, 107) + '...' : L.text;
  const w = Math.min(CW - 40, g.measureText(txt).width + 70), y = G.playClock > 0 || (typeof Crowd !== 'undefined' && Crowd.show()) ? 102 : 76;
  g.fillStyle = '#0b0f16e8'; g.fillRect(CW / 2 - w / 2, y - 14, w, 28);
  g.fillStyle = '#f6c31c'; g.fillRect(CW / 2 - w / 2, y - 14, 4, 28);
  g.fillStyle = '#9aa6b5'; g.textAlign = 'left'; g.font = '800 13px "Barlow Condensed", Arial, sans-serif'; g.fillText(`${L.q} ${L.clock}`, CW / 2 - w / 2 + 12, y + 1);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 17px "Barlow Condensed", Arial, sans-serif'; g.fillText(txt, CW / 2 + 22, y + 1);
  g.restore();
}

// the pause menu shows the last few plays
function pbpHtml(n = 8) {
  const list = (G.pbp || []).slice(-n).reverse();
  if (!list.length) return '';
  return '<div class="pbpHead">PLAY BY PLAY</div>' + list.map(l => `<div class="pbpRow"><span>${l.q} ${l.clock}</span>${l.text}</div>`).join('');
}
