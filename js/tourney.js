// ---- Couch Tournament: 4 or 8 players on one device, single elimination, saved so you can finish later ----
// Head to head: each matchup is a normal 2-player game (computer keyboard / two controllers).
// Pass and play (phone without 2 controllers): both players play one game vs the CPU, each with their own team
// against the other player's team. Biggest winning margin advances (tie: more points, then a coin flip).
screens.push('tourney'); menuScreens.push('tourney');
const Tourney = {
  KEY: 'bobbleTourney', LAST: 'bobbleTourneyLast',
  d: null, view: 'setup', pending: null,
  load() { try { this.d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { this.d = null; } return this.d; },
  save() { try { if (this.d) localStorage.setItem(this.KEY, JSON.stringify(this.d)); else localStorage.removeItem(this.KEY); } catch (e) {} },
  team(id) { return TEAMS.find(t => t.id === id) || TEAMS[0]; },
  canH2H() { return localMulti(); },
  RN: { 1: 'FINAL', 2: 'SEMIFINALS', 4: 'QUARTERFINALS' },
  roundName(r) { return this.RN[this.d.n >> (r + 1)] || 'ROUND ' + (r + 1); },

  open() {
    G.tourney = null; G.teams = null; G.challenge = null; G.mini = null; G.phase = 'idle';
    this.load();
    this.view = !this.d ? 'setup' : this.d.champ != null ? 'champ' : 'bracket';
    this.render(); show('tourney');
  },

  // ---------- setup ----------
  su: null,
  newSetup() {
    let last; try { last = JSON.parse(localStorage.getItem(this.LAST) || 'null'); } catch (e) {}
    const def = ['KC', 'PHI', 'BUF', 'SF', 'DET', 'BAL', 'DAL', 'GB'], used = new Set(), P = [];
    for (let i = 0; i < 8; i++) {
      const lp = last && last.players && last.players[i];
      let id = lp && TEAMS.some(t => t.id === lp.team) && !used.has(lp.team) ? lp.team : def.find(x => !used.has(x) && TEAMS.some(t => t.id === x)) || TEAMS.find(t => !used.has(t.id)).id;
      used.add(id); P.push({ name: lp ? lp.name : '', team: id });
    }
    const o = last || {};
    this.su = { n: o.n === 8 ? 8 : 4, seed: o.seed === 'seeded' ? 'seeded' : 'random', qtr: [60, 120, 180].includes(o.qtr) ? o.qtr : 120, diff: [0, 1, 2].includes(o.diff) ? o.diff : 1,
      style: this.canH2H() && o.style !== 'pass' ? 'h2h' : 'pass', players: P };
  },
  seg(key, opts) { return `<span class="tnSeg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(this.su[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`; },
  renderSetup() {
    if (!this.su) this.newSetup();
    const S = this.su, h2h = this.canH2H();
    if (!h2h) S.style = 'pass';
    const slots = S.players.slice(0, S.n).map((p, i) => { const t = this.team(p.team);
      return `<div class="tnSlot" style="--c1:${t.c1}"><i>${i + 1}</i><input class="tnName" data-i="${i}" maxlength="12" placeholder="Player ${i + 1}" value="${p.name.replace(/"/g, '')}" autocomplete="off" spellcheck="false">
        <button class="tnArr" data-i="${i}" data-d="-1" aria-label="previous team">&lsaquo;</button><span class="tnTeam"><b>${t.id}</b> ${t.name}</span><button class="tnArr" data-i="${i}" data-d="1" aria-label="next team">&rsaquo;</button></div>`; }).join('');
    $('tnBody').innerHTML = `<div class="tnOpts"><label>PLAYERS ${this.seg('n', [[4, '4'], [8, '8']])}</label><label>BRACKET ${this.seg('seed', [['random', 'RANDOM'], ['seeded', 'SEEDED']])}</label>
      <label>QUARTERS ${this.seg('qtr', [[60, '1 MIN'], [120, '2 MIN'], [180, '3 MIN']])}</label>
      ${h2h ? `<label>MATCHES ${this.seg('style', [['h2h', 'HEAD TO HEAD'], ['pass', 'PASS + PLAY']])}</label>` : ''}${S.style === 'pass' ? `<label>CPU ${this.seg('diff', [[0, 'ROOKIE'], [1, 'PRO'], [2, 'ALL-PRO']])}</label>` : ''}</div>
      <div class="tnRule">${S.style === 'h2h' ? 'Each matchup is a 2-player game: P1 and P2 on the keyboard or two controllers. Ties go to overtime.'
        : 'PASS AND PLAY: in each matchup both players play one game vs the CPU, with their own team against the other player\'s team. Biggest winning margin advances (tie: more points, then a coin flip).'}</div>
      <div class="tnSlots n${S.n}">${slots}</div><div class="tnErr" id="tnErr"></div>`;
    $('tnBtns').innerHTML = `<button id="tnBack">BACK</button><button class="big" id="tnStart">START TOURNAMENT</button>`;
    $('tnBody').querySelectorAll('.tnSeg button').forEach(b => b.onclick = () => { const k = b.parentNode.dataset.k; S[k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; Sound.click(); this.renderSetup(); });
    $('tnBody').querySelectorAll('.tnName').forEach(inp => {
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); }); // typing a space mustn't snap a ball
      inp.oninput = () => { S.players[+inp.dataset.i].name = inp.value.slice(0, 12); };
    });
    $('tnBody').querySelectorAll('.tnArr').forEach(b => b.onclick = () => {
      const i = +b.dataset.i, d = +b.dataset.d, taken = new Set(S.players.slice(0, S.n).filter((p, j) => j !== i).map(p => p.team));
      let k = TEAMS.findIndex(t => t.id === S.players[i].team);
      do { k = (k + d + TEAMS.length) % TEAMS.length; } while (taken.has(TEAMS[k].id));
      S.players[i].team = TEAMS[k].id; Sound.click(); this.renderSetup();
    });
    $('tnBack').onclick = () => { Sound.click(); openModes(); };
    $('tnStart').onclick = () => this.start();
  },
  start() {
    const S = this.su, P = S.players.slice(0, S.n), err = m => { $('tnErr').textContent = m; Sound.bad && Sound.bad(); };
    const names = [];
    for (let i = 0; i < P.length; i++) {
      const raw = P[i].name.trim() || `Player ${i + 1}`, n = Boards.okName(raw);
      if (!n) return err(`Player ${i + 1}: ${Boards.nameErr(raw)}`);
      if (names.some(x => x.toLowerCase() === n.toLowerCase())) return err(`Two players are called ${n}. Give everybody their own name.`);
      names.push(n);
    }
    if (new Set(P.map(p => p.team)).size < P.length) return err('Everybody needs a different team.');
    try { localStorage.setItem(this.LAST, JSON.stringify({ n: S.n, seed: S.seed, qtr: S.qtr, diff: S.diff, style: S.style, players: S.players })); } catch (e) {}
    const players = P.map((p, i) => ({ name: names[i], team: p.team }));
    // seeded: best team (OVR) is the 1 seed, 1 v 8, 4 v 5 ... so the top two can only meet in the final
    let order = players.map((p, i) => i);
    if (S.seed === 'seeded') order.sort((a, b) => teamOvr(this.team(players[b].team)) - teamOvr(this.team(players[a].team)));
    else for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const pairs = S.seed === 'seeded' ? (S.n === 4 ? [[0, 3], [1, 2]] : [[0, 7], [3, 4], [1, 6], [2, 5]]) : order.map((x, i) => i).filter(i => i % 2 === 0).map(i => [i, i + 1]);
    const rounds = [pairs.map(([x, y]) => ({ a: order[x], b: order[y], w: null }))];
    for (let m = S.n / 4; m >= 1; m /= 2) rounds.push(Array.from({ length: m }, () => ({ a: null, b: null, w: null })));
    this.d = { v: 1, at: Date.now(), n: S.n, seed: S.seed, qtr: S.qtr, diff: S.diff, style: S.style, players, seeds: S.seed === 'seeded' ? order : null, rounds, champ: null };
    this.save(); Sound.whistle(); this.view = 'bracket'; this.render();
  },

  // ---------- bracket ----------
  next() { for (let r = 0; r < this.d.rounds.length; r++) for (let i = 0; i < this.d.rounds[r].length; i++) { const m = this.d.rounds[r][i]; if (m.a != null && m.b != null && m.w == null) return { r, i, m }; } return null; },
  pl(i) { return this.d.players[i]; },
  seedOf(i) { return this.d.seeds ? this.d.seeds.indexOf(i) + 1 : 0; },
  // one player line in a bracket box
  line(m, side) {
    const i = m[side]; if (i == null) return `<div class="tnP tbd"><i></i><b>TBD</b></div>`;
    const p = this.pl(i), t = this.team(p.team), done = m.w != null, won = m.w === i;
    let sc = '';
    if (m.sc) sc = this.d.style === 'pass' ? (m.sc[side === 'a' ? 0 : 1] > 0 ? '+' : '') + m.sc[side === 'a' ? 0 : 1] : m.sc[side === 'a' ? 0 : 1];
    else if (m.legs && m.legs[side === 'a' ? 0 : 1]) { const l = m.legs[side === 'a' ? 0 : 1]; sc = (l[0] - l[1] > 0 ? '+' : '') + (l[0] - l[1]); }
    return `<div class="tnP${done ? won ? ' w' : ' l' : ''}" style="--c1:${t.c1}"><i></i>${this.seedOf(i) ? `<em>${this.seedOf(i)}</em>` : ''}<b>${p.name}</b><span>${t.id}</span><u>${sc}</u></div>`;
  },
  renderBracket() {
    const D = this.d, nx = this.next();
    $('tnBody').innerHTML = `<div class="tnBracket">${D.rounds.map((R, r) => `<div class="tnCol"><div class="tnRound">${this.roundName(r)}</div><div class="tnMs">${R.map((m, i) =>
      `<div class="tnM${nx && nx.r === r && nx.i === i ? ' next' : ''}">${this.line(m, 'a')}${this.line(m, 'b')}${m.coin ? '<div class="tnCoin">coin flip</div>' : ''}</div>`).join('')}</div></div>`).join('')}
      <div class="tnCol champ"><div class="tnRound">CHAMPION</div><div class="tnMs"><div class="tnCh">${TN_TROPHY}<b>${D.champ != null ? this.pl(D.champ).name : '?'}</b></div></div></div></div>`;
    let mid = '';
    if (nx) {
      const A = this.pl(nx.m.a), B = this.pl(nx.m.b), ta = this.team(A.team), tb = this.team(B.team);
      const nm = D.rounds[nx.r].length > 1 ? ` ${nx.i + 1}` : '';
      if (D.style === 'h2h') mid = `<div class="tnNext"><span>${this.roundName(nx.r).replace(/S$/, '')}${nm}</span><b><em class="p1">P1</em>${A.name} <small>${ta.id}</small> vs <em class="p2">P2</em>${B.name} <small>${tb.id}</small></b></div>`;
      else {
        const leg = nx.m.legs && nx.m.legs[0] ? 1 : 0, me = leg ? B : A, tm = leg ? tb : ta, op = leg ? ta : tb;
        const prev = leg ? `${A.name} won by ${nx.m.legs[0][0] - nx.m.legs[0][1]}`.replace('won by -', 'lost by ') + `. ` : '';
        mid = `<div class="tnNext"><span>${this.roundName(nx.r).replace(/S$/, '')}${nm} &middot; GAME ${leg + 1} OF 2</span><b>${prev}Hand it to ${me.name}: ${tm.name} vs ${op.name} (CPU)</b></div>`;
      }
    }
    $('tnBtns').innerHTML = `<button id="tnBack">BACK</button>${mid}${nx ? '<button class="big" id="tnPlay">PLAY</button>' : ''}<button id="tnQuit">END</button>`;
    $('tnBack').onclick = () => { Sound.click(); openModes(); };
    $('tnQuit').onclick = () => { if (!confirm('End this tournament? The bracket gets deleted.')) return; this.d = null; this.save(); this.su = null; this.view = 'setup'; this.render(); };
    if (nx) $('tnPlay').onclick = () => this.play(nx);
  },
  play(nx) {
    const D = this.d, m = nx.m;
    Sound.init(); Sound.whistle(); Sound.crowd && Sound.crowd(false);
    if (G.mode === 'mobile') goFullscreen();
    G.demo = false; G.season = false; G.challenge = null; G.mini = null; show(null);
    const A = this.team(this.pl(m.a).team), B = this.team(this.pl(m.b).team);
    if (D.style === 'h2h' && this.canH2H()) {
      this.pending = { r: nx.r, i: nx.i, leg: -1 };
      newGame(A, B, { qtr: D.qtr, diff: 1, humanSide: 0, versus: true, playoff: true, weather: 'clear' }); // P1 = player A (home)
      showBanner(`${this.pl(m.a).name} vs ${this.pl(m.b).name}`, `${this.roundName(nx.r)}  P1 ${A.id}  P2 ${B.id}`, '#ffd23f', 2.6);
    } else {
      const leg = m.legs && m.legs[0] ? 1 : 0;
      this.pending = { r: nx.r, i: nx.i, leg };
      newGame(leg ? B : A, leg ? A : B, { qtr: D.qtr, diff: D.diff, humanSide: 0, playoff: true, weather: 'clear' });
      showBanner(`${this.pl(leg ? m.b : m.a).name.toUpperCase()}'S GAME`, `${this.roundName(nx.r)}  game ${leg + 1} of 2: win big`, '#ffd23f', 2.6);
    }
  },

  // ---------- after a tournament game (called from the game-over screen) ----------
  gameOver(s) {
    const g = G.tourney; if (!g || !this.load()) return;
    const m = this.d.rounds[g.r] && this.d.rounds[g.r][g.i]; if (!m || m.w != null) return;
    const A = this.pl(m.a), B = this.pl(m.b);
    let msg = '';
    if (g.leg < 0) {
      m.sc = [s.score[0], s.score[1]];
      m.w = s.score[0] > s.score[1] ? m.a : s.score[1] > s.score[0] ? m.b : (m.coin = true, Math.random() < 0.5 ? m.a : m.b);
      $('overTitle').textContent = `${this.pl(m.w).name.toUpperCase()} WINS`;
    } else {
      m.legs = m.legs || []; m.legs[g.leg] = [s.score[0], s.score[1]];
      const mg = l => l[0] - l[1], who = g.leg ? B : A, d = mg(m.legs[g.leg]);
      $('overTitle').textContent = `${who.name.toUpperCase()}: ${d > 0 ? 'WON BY ' + d : 'LOST BY ' + -d}`;
      if (g.leg === 0) msg = `Next: ${B.name} plays. ${B.name} has to ${d > 0 ? `win by more than ${d}` : `lose by less than ${-d}, or win`}.`;
      else {
        const ma = mg(m.legs[0]), mb = mg(m.legs[1]);
        m.sc = [ma, mb];
        if (ma !== mb) m.w = ma > mb ? m.a : m.b;
        else if (m.legs[0][0] !== m.legs[1][0]) { m.w = m.legs[0][0] > m.legs[1][0] ? m.a : m.b; m.tie = 'pts'; }
        else { m.coin = true; m.w = Math.random() < 0.5 ? m.a : m.b; }
      }
    }
    if (m.w != null) {
      const W = this.pl(m.w), L = this.pl(m.w === m.a ? m.b : m.a), last = g.r === this.d.rounds.length - 1;
      if (this.d.style === 'pass') msg = `${W.name} advances: ${m.tie ? 'same margin, more points' : m.coin ? 'dead even, won the coin flip' : 'bigger margin'} (${m.sc[0] > 0 ? '+' : ''}${m.sc[0]} vs ${m.sc[1] > 0 ? '+' : ''}${m.sc[1]}).`;
      else msg = `${W.name} ${last ? 'wins the tournament' : 'advances'}! ${L.name} is out.`;
      if (last) { this.d.champ = m.w; msg = `${W.name} is the CHAMPION!`; }
      else { const nr = this.d.rounds[g.r + 1][g.i >> 1]; nr[g.i & 1 ? 'b' : 'a'] = m.w; }
    }
    this.save();
    $('overChal').textContent = msg; $('overChal').style.color = '#ffd23f';
    $('btnAgain').textContent = this.d.champ != null ? 'CHAMPION' : 'BRACKET'; $('btnAgain').style.display = '';
    $('btnNewTeams').style.display = 'none';
  },
  back() { Sound.click(); this.open(); },

  // ---------- champion ----------
  renderChamp() {
    const D = this.d, W = this.pl(D.champ), t = this.team(W.team), f = D.rounds[D.rounds.length - 1][0], L = this.pl(f.w === f.a ? f.b : f.a);
    const sc = f.sc ? D.style === 'pass' ? `margins ${f.sc[0] > 0 ? '+' : ''}${f.sc[0]} / ${f.sc[1] > 0 ? '+' : ''}${f.sc[1]}` : `${Math.max(...f.sc)}-${Math.min(...f.sc)}` : '';
    $('tnBody').innerHTML = `<div class="tnChamp" style="--c1:${t.c1}"><div class="tnConf">${Array.from({ length: 50 }, () => `<i style="left:${Math.random() * 100}%;background:${pick([t.c1, t.c2, '#fff', '#ffd23f'])};animation-duration:${2 + Math.random() * 3}s;animation-delay:${-Math.random() * 5}s"></i>`).join('')}</div>
      <div class="tnTro">${TN_TROPHY}</div><div class="tnCT"><span>COUCH TOURNAMENT CHAMPION</span><b>${W.name}</b><em>${t.city} ${t.name}</em><small>Beat ${L.name} in the final${sc ? ' (' + sc + ')' : ''}</small></div></div>`;
    $('tnBtns').innerHTML = `<button id="tnBack">BACK</button><button id="tnBr">BRACKET</button><button class="big gold" id="tnNew">NEW TOURNAMENT</button>`;
    $('tnBack').onclick = () => { Sound.click(); openModes(); };
    $('tnBr').onclick = () => { Sound.click(); this.view = 'bracket'; this.render(); };
    $('tnNew').onclick = () => { Sound.click(); this.d = null; this.save(); this.su = null; this.view = 'setup'; this.render(); };
    Sound.td && Sound.td();
  },
  render() {
    $('tourney').className = 'screen show v-' + this.view;
    if (this.view === 'setup') this.renderSetup(); else if (this.view === 'champ') this.renderChamp(); else this.renderBracket();
  }
};
const TN_TROPHY = '<svg viewBox="0 0 64 64" class="tnTrophy"><path d="M18 8h28v14c0 9-6 16-14 16s-14-7-14-16z"/><path d="M18 13H9c0 9 4 14 10 15M46 13h9c0 9-4 14-10 15" fill="none" stroke-width="4"/><path d="M28 38h8v9h-8z"/><path d="M19 50h26v6H19z"/></svg>';
// every new game clears the tournament tag unless the tournament started it
const _tnNewGame = newGame;
newGame = function (...a) { G.tourney = Tourney.pending; Tourney.pending = null; return _tnNewGame.apply(this, a); };
