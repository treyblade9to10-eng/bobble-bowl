// ---- Playoff picture (regular season: seeds, wild cards, in the hunt, clinched / eliminated) + playoff bracket ----
screens.push('playoffs'); menuScreens.push('playoffs');
(() => {
  const el = document.createElement('div'); el.id = 'playoffs'; el.className = 'screen';
  el.innerHTML = `<div id="poHead"></div><div id="poBody"></div><div class="row" id="poBtns"></div>`;
  $('stage').appendChild(el);
  const b = document.createElement('button'); b.id = 'shPO'; b.textContent = 'PLAYOFF PICTURE'; b.onclick = () => { Sound.click(); openPlayoffs(); };
  $('shTrade').parentNode.insertBefore(b, $('shTrade'));
})();

const PO = {
  full() { const d = Season.data; return d.games >= 17 || !!d.fullPO; },
  wins(id) { const r = Season.data.rec[id]; return r.w + r.t * 0.5; },
  left() { const d = Season.data; return d.phase === 'regular' ? Math.max(0, d.games - d.week) : 0; },
  // seeds if the season ended today (same rules as Season.startPlayoffs)
  seeds(conf) {
    const st = Season.standings(conf);
    if (!this.full()) return st.slice(0, 4);
    const win = ['East', 'North', 'South', 'West'].map(v => st.find(id => Season.team(id).div === v)).filter(Boolean);
    win.sort((a, b) => st.indexOf(a) - st.indexOf(b));
    return win.concat(st.filter(id => !win.includes(id)).slice(0, 7 - win.length));
  },
  // z = clinched the 1 seed + bye, y = clinched the division, x = clinched a playoff spot, e = eliminated.
  // Safe math: ties count against you, and every other team could win (or lose) all its games.
  status(conf) {
    const ids = TEAMS.filter(t => t.conf === conf).map(t => t.id), L = this.left(), full = this.full(), out = {};
    const div = id => Season.team(id).div, mn = id => this.wins(id), mx = id => this.wins(id) + L;
    for (const id of ids) {
      const others = ids.filter(o => o !== id), rivals = others.filter(o => div(o) === div(id));
      const can = others.filter(o => mx(o) >= mn(id));    // could still finish level with or ahead of us
      const sure = others.filter(o => mn(o) > mx(id));    // will finish ahead of us no matter what
      let s = '';
      if (!full) { if (can.length <= 3) s = can.length === 0 ? 'z' : 'x'; else if (sure.length >= 4) s = 'e'; out[id] = s; continue; }
      const extra = list => { const by = {}; for (const o of list) by[div(o)] = (by[div(o)] || 0) + 1; return Object.values(by).reduce((a, k) => a + Math.max(0, k - 1), 0); };
      const divWon = !rivals.some(o => mx(o) >= mn(id)), divLost = rivals.some(o => mn(o) > mx(id));
      if (!can.length) s = 'z';
      else if (divWon) s = 'y';
      else if (extra(can) <= 2) s = 'x';                // at most 2 non-division-winners can pass us
      else if (divLost && extra(sure) >= 3) s = 'e';     // can't win the division and 3 wild cards are already out of reach
      out[id] = s;
    }
    return out;
  },
  gb(id, ref) { const a = Season.data.rec[ref], b = Season.data.rec[id]; return ((a.w - b.w) + (b.l - a.l)) / 2; },
  // every round of the bracket: [{ conf, home, away, score }] per round, from the log, the current round, or the projection
  rounds(preview) {
    const d = Season.data, b = d.bracket, fin = preview ? (this.full() ? 3 : 2) : (b.final != null ? b.final : 2), out = [];
    for (let r = 0; r <= fin; r++) {
      const lg = !preview && (d.log || []).find(x => x.round === r);
      if (lg) out.push({ games: lg.games, bye: lg.bye });
      else if (!preview && b.round === r && !d.champ) out.push({ games: b.games, bye: b.full && r === 0 ? b.bye : null });
      else out.push({ games: [], bye: null });
    }
    if (preview) {
      const s = { AFC: this.seeds('AFC'), NFC: this.seeds('NFC') }, g = [];
      for (const c of ['AFC', 'NFC']) { const x = s[c];
        if (this.full()) g.push({ conf: c, home: x[1], away: x[6] }, { conf: c, home: x[2], away: x[5] }, { conf: c, home: x[3], away: x[4] });
        else g.push({ conf: c, home: x[0], away: x[3] }, { conf: c, home: x[1], away: x[2] }); }
      out[0] = { games: g, bye: this.full() ? { AFC: s.AFC[0], NFC: s.NFC[0] } : null };
    }
    return out;
  }
};

let poView = 'pic';
function openPlayoffs() { const d = Season.data; poView = d.phase === 'regular' ? 'pic' : 'bracket'; renderPlayoffs(); show('playoffs'); }
const poLogo = id => `<span class="poLogo">${teamBadge(Season.team(id))}</span>`;
const poSeedOf = (id, seeds) => { for (const c of ['AFC', 'NFC']) { const i = (seeds[c] || []).indexOf(id); if (i >= 0) return i + 1; } return ''; };

function renderPlayoffs() {
  const d = Season.data, me = d.team, reg = d.phase === 'regular';
  const title = reg ? (poView === 'pic' ? 'PLAYOFF PICTURE' : 'IF THE SEASON ENDED TODAY') : `${d.year > 1 ? `YEAR ${d.year} ` : ''}PLAYOFFS`;
  const sub = reg ? `WEEK ${d.week + 1} OF ${d.games}  ·  ${PO.left()} GAME${PO.left() === 1 ? '' : 'S'} LEFT` : d.champ ? `${tName(d.champ).toUpperCase()} WIN THE ${bowlName(d.year).toUpperCase()}` : Season.roundName(d.bracket.round).toUpperCase();
  $('poHead').innerHTML = `<h3>${title}</h3><span>${sub}</span>`;
  $('poBody').className = poView === 'pic' && reg ? 'pic' : 'bk';
  $('poBody').innerHTML = poView === 'pic' && reg ? poPicture() : poBracket(reg);
  $('poBtns').innerHTML = (reg ? `<button id="poPic" class="${poView === 'pic' ? 'on' : ''}">STANDINGS VIEW</button><button id="poBk" class="${poView === 'bracket' ? 'on' : ''}">BRACKET VIEW</button>` : '') + `<button class="gold" id="poBack">BACK</button>`;
  if (reg) { $('poPic').onclick = () => { Sound.click(); poView = 'pic'; renderPlayoffs(); }; $('poBk').onclick = () => { Sound.click(); poView = 'bracket'; renderPlayoffs(); }; }
  $('poBack').onclick = () => { Sound.click(); renderHub(); };
}

function poPicture() {
  const d = Season.data, me = d.team, full = PO.full();
  const col = conf => {
    const seeds = PO.seeds(conf), st = PO.status(conf), stand = Season.standings(conf), last = seeds[seeds.length - 1];
    const mk = id => st[id] ? `<em class="poMk ${st[id]}">${st[id]}</em>` : '';
    const row = (id, seed, right) => `<div class="poRow${id === me ? ' me' : ''}${st[id] === 'e' ? ' out' : ''}${seed === 'h5' ? ' h5' : ''}"><b class="poSeed">${seed === 'h5' ? '' : seed}</b>${poLogo(id)}<span class="poNm">${tName(id)}</span>${mk(id)}<span class="poRec">${recStr(id)}</span>${right || ''}</div>`;
    const nDiv = full ? 4 : 0;
    let h = `<div class="poConf"><div class="poCH">${conf}</div>`;
    if (full) h += `<div class="poSec">DIVISION LEADERS</div>` + seeds.slice(0, nDiv).map((id, i) => row(id, i + 1, `<span class="poTag">${i === 0 ? 'BYE' : Season.team(id).div.toUpperCase()}</span>`)).join('');
    h += `<div class="poSec">${full ? 'WILD CARDS' : 'PLAYOFF SPOTS'}</div>` + seeds.slice(nDiv).map((id, i) => row(id, nDiv + i + 1, `<span class="poTag">${full ? 'WC' : i === 0 ? 'TOP' : ''}</span>`)).join('');
    const rest = stand.filter(id => !seeds.includes(id)), hunt = rest.filter(id => st[id] !== 'e').slice(0, 5), gone = rest.filter(id => st[id] === 'e' || !hunt.includes(id));
    h += `<div class="poSec">IN THE HUNT</div>` + (hunt.map((id, i) => row(id, i >= 3 ? 'h5' : '', `<span class="poTag gb">${PO.gb(id, last) ? PO.gb(id, last) + ' GB' : 'TIED'}</span>`)).join('') || '<div class="poNone">Nobody else is still alive</div>');
    if (gone.length) h += `<div class="poSec">${gone.some(id => st[id] !== 'e') ? 'LONG SHOTS + ELIMINATED' : 'ELIMINATED'}</div><div class="poGone">${gone.map(id => `<span class="${st[id] === 'e' ? 'out' : ''}${id === me ? ' me' : ''}" title="${tName(id)}">${poLogo(id)}<i>${recStr(id)}</i></span>`).join('')}</div>`;
    return h + '</div>';
  };
  return `<div class="poCols">${col('AFC')}${col('NFC')}</div>
    <div class="poKey"><span><em class="poMk z">z</em> CLINCHED 1 SEED + BYE</span><span><em class="poMk y">y</em> CLINCHED DIVISION</span><span><em class="poMk x">x</em> CLINCHED PLAYOFFS</span><span><em class="poMk e">e</em> ELIMINATED</span><span class="poGbK">GB = GAMES BEHIND THE LAST SPOT</span></div>`;
}

function poBracket(preview) {
  const d = Season.data, me = d.team, b = d.bracket, full = preview ? PO.full() : b.full;
  const seeds = preview ? { AFC: PO.seeds('AFC'), NFC: PO.seeds('NFC') } : b.seeds;
  const R = PO.rounds(preview), fin = R.length - 1, champ = !preview && d.champ;
  const labels = full ? ['WILD CARD', 'DIVISIONAL', 'CONFERENCE'] : ['SEMIFINAL', 'CONFERENCE'];
  const want = full ? [3, 2, 1] : [2, 1];
  const team = (id, sc, won, lost) => !id ? `<div class="bkT tbd"><b class="poSeed"></b><span class="poNm">TBD</span></div>`
    : `<div class="bkT${won ? ' won' : ''}${lost ? ' lost' : ''}${id === me ? ' me' : ''}"><b class="poSeed">${poSeedOf(id, seeds)}</b>${poLogo(id)}<span class="poNm">${tName(id)}</span>${sc != null ? `<em>${sc}</em>` : ''}</div>`;
  const game = g => { const s = g && g.score, hw = s && s[0] > s[1], aw = s && s[1] > s[0];
    return `<div class="bkG${g && (g.home === me || g.away === me) ? ' mine' : ''}">${team(g && g.home, s ? s[0] : null, hw, aw)}${team(g && g.away, s ? s[1] : null, aw, hw)}</div>`; };
  const col = (conf, r) => {
    const games = R[r].games.filter(g => g.conf === conf);
    while (games.length < want[r]) games.push(null);
    const bye = full && r === 0 ? ((R[0].bye && R[0].bye[conf]) || seeds[conf][0]) : null;
    return `<div class="bkCol"><div class="bkLbl"><b>${conf}</b> ${labels[r]}</div><div class="bkGames">${bye ? `<div class="bkG bye${bye === me ? ' mine' : ''}">${team(bye)}<div class="bkByeTxt">FIRST-ROUND BYE</div></div>` : ''}${games.map(game).join('')}</div></div>`;
  };
  const left = [], right = [];
  for (let r = 0; r < fin; r++) { left.push(col('AFC', r)); right.unshift(col('NFC', r)); }
  const bowl = R[fin].games[0];
  const center = `<div class="bkCol bkBowl"><div class="bkLbl">${bowlName(d.year).toUpperCase()}</div><div class="bkGames">
    ${champ ? `<div class="bkChamp">${poLogo(champ)}<b>${tName(champ).toUpperCase()}</b><span>CHAMPIONS</span></div>` : `<div class="bkTro">${typeof TROPHY_SVG !== 'undefined' ? TROPHY_SVG : ''}</div>`}
    ${game(bowl)}</div></div>`;
  return `<div class="bkWrap">${left.join('')}${center}${right.join('')}</div>
    ${preview ? '<div class="poKey"><span>The top seed in each conference skips the Wild Card round. Higher seeds host.</span></div>' : ''}`;
}

// the hub button says what it'll show
{ const _hub = renderHub; renderHub = function () {
  _hub();
  const d = Season.data, b = $('shPO'); if (!d || !b) return;
  b.textContent = d.phase === 'regular' ? 'PLAYOFF PICTURE' : 'PLAYOFF BRACKET';
  b.style.display = d.phase === 'regular' || d.bracket ? '' : 'none';
}; }
