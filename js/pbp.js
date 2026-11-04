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
  addPbp(s + flag, hype);
  return { gain, type: res.type, big: res.type === 'td' || (G.intBy && cs !== off) || (cs === off && gain >= 25) || (res.type === 'fumble' && cs !== off) };
}

// little ticker under the scoreboard for the latest line
const tickFit = { L: null, key: '', ft: '', w: 0, y: 76 };
function drawTicker(g, G) {
  const L = G.pbpShow; if (!L || G.demo || G.mini) return;
  // the play-call cards cover the top of the screen, and a big banner is the same news: wait, then show the line for its full time
  const t0 = L.st != null ? L.st : L.t;
  if ((G.banner && G.banner.t < G.banner.dur) || $('playcall').classList.contains('show')) { if (G.time - t0 < 5) L.st = Math.max(t0, G.time - 0.2); return; }
  const age = G.time - t0; if (age > 5 || G.phase === 'live' || G.phase === 'replay') return;
  const a = Math.min(1, age * 5, (5 - age) * 2), K = typeof Pad !== 'undefined' ? Pad.scale(1.3) : 1; // (phones: a bit bigger)
  // under whatever hangs off the scorebug: play clock / crowd meter, the 2:00 DRILL tag, the MOMENTUM SWING tag
  const crowd = typeof Crowd !== 'undefined' && Crowd.show(), xm = G.bcast === 'XMAS' ? 6 : 0;
  let top = G.playClock > 0 || crowd ? 88 + xm : 62;
  if (typeof Flow !== 'undefined' && Flow.drill && Flow.on()) top = Math.max(top, 82 + (crowd ? 26 : 0) + xm);
  if (typeof Flow !== 'undefined' && Flow.tag) top = Math.max(top, 80);
  // fit the line once (kept in tickFit, not on the line: lines get saved + sent online), not a measureText every frame
  const maxW = (CW - 40) / K, key = maxW + (document.fonts ? document.fonts.status : ''), F = tickFit, ty = top + 14 * K;
  if (F.L !== L || F.key !== key) {
    g.font = '600 17px "Barlow Condensed", Arial, sans-serif'; let txt = L.text;
    while (txt.length > 12 && g.measureText(txt).width + 70 > maxW) { const i = txt.lastIndexOf(' ', txt.length - 5); txt = txt.slice(0, i > 0 ? i : txt.length - 4) + '...'; }
    if (F.L !== L) F.y = ty;
    Object.assign(F, { L, key, ft: txt, w: Math.min(maxW, g.measureText(txt).width + 70) });
  }
  F.y = lerp(F.y, ty, 0.25);
  const txt = F.ft, w = F.w;
  F.box = { x0: CW / 2 - w * K / 2, x1: CW / 2 + w * K / 2, y0: F.y - 14 * K, y1: F.y + 14 * K }; F.at = G.time; // (draw.js: name tags stay out from under it)
  g.save(); g.globalAlpha = a; g.translate(CW / 2, F.y); if (K !== 1) g.scale(K, K);
  g.textBaseline = 'middle';
  g.fillStyle = '#0b0f16e8'; g.fillRect(-w / 2, -14, w, 28);
  g.fillStyle = '#f6c31c'; g.fillRect(-w / 2, -14, 4, 28);
  g.fillStyle = '#9aa6b5'; g.textAlign = 'left'; g.font = '800 13px "Barlow Condensed", Arial, sans-serif'; g.fillText(`${L.q} ${L.clock}`, -w / 2 + 12, 1);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 17px "Barlow Condensed", Arial, sans-serif'; g.fillText(txt, 22, 1);
  g.restore();
}

// the pause menu shows the last few plays
function pbpHtml(n = 8) {
  const list = (G.pbp || []).slice(-n).reverse();
  if (!list.length) return '';
  return '<div class="pbpHead">PLAY BY PLAY</div>' + list.map(l => `<div class="pbpRow"><span>${l.q} ${l.clock}</span>${l.text}</div>`).join('');
}
