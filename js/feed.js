// ---- Bobble Feed: a made-up sports social feed on the FEED tab, written from what really happened (results, stat lines, injuries, trades, X-Factors, awards, the playoff race) ----
// d.feed = [{ y, w: 'WK 5', h: handle, n: name, c: avatar color, a: avatar letters, v: verified, tx, lk: likes, rp: reposts }]  newest first
// Each week uses a seeded random from the scores, so the same week always reads the same way. Emojis are OK in post text only (Trey said so for the feed).
const FEED_MAX = 100;
const FD_ICON = {
  like: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.8 4.5c2.2 0 3.6 1.3 5.2 3.1 1.6-1.8 3-3.1 5.2-3.1 3.8 0 5.9 4 4.4 7.3C19.5 16.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  rp: '<svg viewBox="0 0 24 24"><path d="M4 9V7a2 2 0 0 1 2-2h12l-3-3M20 15v2a2 2 0 0 1-2 2H6l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ver: '<svg class="fdVer" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f6c31c"/><path d="M7 12.5l3.2 3L17 9" fill="none" stroke="#111" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const Feed = {
  r: Math.random,
  live() { return !!Season.data && !(Season.isCareer && Season.isCareer()); },
  pk(a) { return a[Math.floor(this.r() * a.length)]; },
  H: s => String(s).replace(/[^A-Za-z0-9]/g, ''),
  // accounts
  ins: { h: '@BobbleInsider', n: 'Bobble Insider', c: '#f6c31c', a: 'BI', v: 1 },
  lg: { h: '@BobbleBowl', n: 'Bobble Bowl', c: '#e8401c', a: 'BB', v: 1 },
  st: { h: '@BobbleStats', n: 'Bobble Stats', c: '#2f8cff', a: 'BS', v: 1 },
  fan(id) { const t = Season.team(id); return { h: `@${this.H(t.name)}Fans`, n: `${t.name} Fans`, c: t.c1, a: id.slice(0, 3) }; },
  pl(name, id, num) { const t = Season.team(id), p = name.split(' '); return { h: `@${this.H(name)}${num != null ? num : ''}`, n: name, c: t.c1, a: (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase(), v: 1 }; },
  fanH(id) { return this.fan(id).h; },
  // find a player's tuple (for his jersey number)
  find(name, id) { const R = Season.ensureRosters()[id]; if (!R) return null; for (const g of ['off', 'def', 'bench']) for (const p of R[g] || []) if (p && p[1] === name) return p; return null; },
  plFor(name, id) { const p = this.find(name, id); return this.pl(name, id, p ? p[2] : ''); },
  emo(k) { return this.pk({ win: ['🔥', '🙌', '💪', '🏈', '😤', '🎉'], loss: ['😩', '😬', '😤', '💔', '🙃'], hype: ['🔥', '💪', '😤', '🏈', '💯'] }[k]); },
  fill(s, v) { return s.replace(/\{(\w+)\}/g, (m, k) => v[k] != null ? v[k] : m); },
  // likes + reposts: big accounts and big moments get more
  add(who, tx, buzz, w) {
    const d = Season.data, lk = Math.round((150 + (buzz || 0.3) * 9000) * (0.45 + this.r() * 1.1));
    (d.feed || (d.feed = [])).unshift({ y: d.year, w: w || this.label(), h: who.h, n: who.n, c: who.c, a: who.a, v: who.v ? 1 : 0, tx, lk, rp: Math.round(lk * (0.06 + this.r() * 0.2)) });
    d.feed.length = Math.min(d.feed.length, FEED_MAX);
  },
  // one post from outside the weekly batch (owner, holdouts): seeded by its text
  say(who, tx, buzz) { if (!this.live()) return; this.r = feedRng(hashStr(tx + Season.data.year)); this.add(who, tx, buzz); },
  label() { const d = Season.data; return d.phase === 'regular' ? (d.week ? `WK ${d.week}` : 'PRESEASON') : d.phase === 'playoffs' ? 'PLAYOFFS' : 'OFFSEASON'; },
  short(x) { return Form.statLine(x).split(', ').slice(0, 3).join(', '); },

  // ---------- the weekly batch: 5 to 12 posts ----------
  week(wk, lines, news, r) {
    const d = Season.data, me = d.team, gm = WeekRecap.games(wk), my = gm[me], P = [], w = `WK ${wk + 1}`;
    this.r = r;
    const post = (pri, who, tx, buzz) => P.push({ pri, who, tx, buzz });
    const res = o => o.my > o.th ? 'W' : o.my < o.th ? 'L' : 'T';
    const recOf = id => recStr(id);
    // a team's streak going into next week (your team: from the schedule)
    let streak = 0; if (my) { const R = res(my); for (let i = wk; i >= 0; i--) { const g = d.weeks[i][0]; if (!g.score) break; const h = g.home === me, s = h ? g.score : [g.score[1], g.score[0]]; if ((s[0] > s[1] ? 'W' : s[0] < s[1] ? 'L' : 'T') !== R) break; streak++; } }
    // fans after a game
    const fanPost = (id, o, pri, mine) => {
      const R = res(o), m = Math.abs(o.my - o.th), v = { opp: tName(o.opp), my: o.my, th: o.th, rec: recOf(id), m, n: streak, oppFans: this.fanH(o.opp) };
      let pool;
      if (R === 'T') pool = ['A tie?? What do we even do with that 🤷', 'Tie game. Nobody is happy. Nobody is sad. Just confused 🫠'];
      else if (R === 'W') pool = (mine && streak >= 3 ? [`{n} straight wins. This team is DIFFERENT ${this.emo('win')}`, `{n} in a row and counting ${this.emo('win')} {rec}`] : [])
        .concat(m >= 21 ? [`{my}-{th}?? That was a statement ${this.emo('win')}`] : [], [`LET'S GOOOO ${this.emo('win')} {rec} and rolling`, `W. That's it. That's the post ${this.emo('win')}`, `Never doubted them for a second. Okay, maybe one second ${this.emo('win')}`,
          `{oppFans} real quiet right now 🤫`, `Beat the {opp} {my}-{th}. Somebody frame this one ${this.emo('win')}`]);
      else pool = (mine && streak >= 3 ? [`{n} losses in a row. Somebody turn this around please 😭`] : []).concat(m <= 3 ? [`Lost by {m}. My heart can't take this 💔`] : [],
        [`Not our day. We bounce back next week 😤`, `I need a nap after that one 😩`, `{th} points allowed... defense, we need you 😬`, `It's fine. Everything is fine. {rec} is fine 🙃`, `Still believe in this team. Let's fix it 🔧`]);
      post(pri, this.fan(id), this.fill(this.pk(pool), v), mine ? 0.35 : 0.2);
    };
    if (my) { fanPost(me, my, 100, true); if (this.r() < 0.6) fanPost(my.opp, gm[my.opp], 40, false); }
    // rivalry: the winner's fans enjoy it
    if (my && my.my !== my.th && isRivalry(Season.team(me), Season.team(my.opp))) {
      const W = my.my > my.th ? me : my.opp, L = W === me ? my.opp : me;
      post(70, this.fan(W), `Rivalry win hits different. See you next time ${this.fanH(L)} 👋`, 0.4);
    }
    // the best offensive game of the week hypes himself, the insider agrees
    const off = lines.filter(x => FORM_OFF.includes(x.pos) && gm[x.t]).sort((a, b) => Form.offScore(b) - Form.offScore(a)), def = lines.filter(x => FORM_DEF.includes(x.pos) && gm[x.t]).sort((a, b) => Form.defScore(b) - Form.defScore(a));
    const hype = off[0], mineTop = off.find(x => x.t === me);
    if (hype && Form.offScore(hype) >= 18) {
      const o = gm[hype.t], won = o.my > o.th, v = { line: this.short(hype), opp: tName(o.opp), name: hype.name };
      post(80, this.plFor(hype.name, hype.t), this.fill(won ? this.pk([`Told y'all. {line} ${this.emo('hype')}`, `BUILT DIFFERENT ${this.emo('hype')}`, `They keep doubting. I keep producing. {line}`, `Locked in. Team win ${this.emo('hype')}`, `Film don't lie ${this.emo('hype')}`])
        : `Numbers don't matter when we lose. Back to work 💯`, v), 0.75);
      post(60, this.ins, this.fill(`{name} is BUILT DIFFERENT. {line} against the {opp} ${this.emo('hype')}`, v), 0.6);
    }
    if (mineTop && mineTop !== hype && Form.offScore(mineTop) >= 14 && my && my.my > my.th) post(65, this.plFor(mineTop.name, me), this.fill(this.pk([`Team win. That's all that matters ${this.emo('hype')}`, `On to the next one 🏈`, `We eat together ${this.emo('hype')}`]), {}), 0.5);
    // monster stat lines (not already covered)
    const monster = x => x.pos === 'QB' ? x.pass >= 340 || x.td >= 4 : x.pos === 'RB' ? x.rush >= 150 || x.td >= 3 : (x.pos === 'WR' || x.pos === 'TE') ? x.rec >= 150 || x.td >= 3 : x.sack >= 3 || x.int >= 2;
    lines.filter(x => x !== hype && gm[x.t] && monster(x)).sort((a, b) => Math.max(Form.offScore(b), Form.defScore(b) * 1.6) - Math.max(Form.offScore(a), Form.defScore(a) * 1.6)).slice(0, 2).forEach((x, i) => post(55 - i * 10, this.st, this.fill(this.pk([`{pos} {name} ({t}) this week: {line} 📊`, `Monster game alert 🚨 {name}: {line}`, `Big day for {name} of the {team}: {line} 📈`]), { pos: x.pos, name: x.name, t: x.t, team: tName(x.t), line: this.short(x) }), 0.4));
    // X-Factor moments
    for (const x of off.slice(0, 6).concat(def.slice(0, 6))) {
      const kind = typeof XF_REAL !== 'undefined' && XF_REAL[x.name], big = FORM_OFF.includes(x.pos) ? Form.offScore(x) >= 20 : Form.defScore(x) >= 12;
      if (!kind || !big || !XF_TYPES[kind]) continue;
      post(58, this.lg, `X-FACTOR MODE ⚡ ${x.name} (${XF_TYPES[kind].name}) took over: ${this.short(x)}`, 0.55); break;
    }
    // upsets + blowouts around the league
    let up = null, blow = null;
    for (const g of (d.weeks[wk] || []).slice(1)) if (g.score && g.score[0] !== g.score[1]) {
      const hw = g.score[0] > g.score[1], W = hw ? g.home : g.away, L = hw ? g.away : g.home, gap = Season.ovr(L) - Season.ovr(W), m = Math.abs(g.score[0] - g.score[1]);
      const s = `${Math.max(...g.score)}-${Math.min(...g.score)}`;
      if (gap >= 3 && (!up || gap > up.gap)) up = { W, L, gap, s };
      if (m >= 24 && (!blow || m > blow.m)) blow = { W, L, m, s };
    }
    if (up) post(62, this.ins, `UPSET ALERT 🚨 The ${tName(up.W)} (${teamOvr(Season.team(up.W))} OVR) knock off the ${tName(up.L)} (${teamOvr(Season.team(up.L))} OVR), ${up.s}`, 0.6);
    if (blow) post(35, this.st, `The ${tName(blow.W)} beat the ${tName(blow.L)} ${blow.s}. Ouch 😬`, 0.3);
    // injuries: your guys and big names
    const inj = (Season._newInj || []).filter(x => x.team === me || ((this.find(x.name, x.team) || [])[3] >= 85)).slice(0, 2);
    inj.forEach((x, i) => post(x.team === me ? 75 : 50 - i * 5, this.ins, `Injury update: ${tName(x.team)} ${x.pos} ${x.name} (${x.what}) is expected to miss ${x.wks === 1 ? '1 week' : x.wks + ' weeks'} 🏥`, 0.45));
    if (inj.some(x => x.team === me)) { const x = inj.find(x => x.team === me); post(45, this.fan(me), `Get well soon ${x.name} 🙏`, 0.2); }
    // trades this week, or a rumor
    const tr = news.find(n => /^(TRADE:|DEADLINE DEAL)/.test(n.text));
    if (tr) { const t = tr.text.replace(/^(TRADE|DEADLINE DEAL): ?/, ''); post(85, this.ins, `BREAKING 🚨 ${t[0].toUpperCase()}${t.slice(1)}`, 0.8); }
    else if (Season.canTrade() && wk >= 3 && this.r() < 0.45) {
      const sellers = TEAMS.map(t => t.id).filter(id => id !== me && Season.pct(id) <= 0.35), id = sellers.length ? this.pk(sellers) : null, R = id && Season.ensureRosters()[id];
      const star = R && R.off.concat(R.def).filter(p => p && p[3] >= 86 && !Season.hurt(p)).sort((a, b) => b[3] - a[3])[0];
      if (star) post(52, this.ins, `Hearing the ${tName(id)} are getting calls about ${star[0]} ${star[1]} (${star[3]}). Stay tuned 👀`, 0.55);
    }
    // Players of the Week
    const pw = (d.potw || []).filter(x => x.y === d.year && x.wk === wk).pop();
    if (pw && (pw.off || pw.def)) post(68, this.lg, `Players of the Week 🏆 ${[pw.off && `Offense: ${pw.off.pos} ${pw.off.name} (${pw.off.t})`, pw.def && `Defense: ${pw.def.pos} ${pw.def.name} (${pw.def.t})`].filter(Boolean).join('. ')}`, 0.5);
    // trash talk before a rivalry game next week (friendly)
    const nx = d.weeks[wk + 1] && d.weeks[wk + 1][0];
    if (nx) {
      const opp = nx.home === me ? nx.away : nx.home, riv = isRivalry(Season.team(me), Season.team(opp)), R = Season.ensureRosters();
      const star = id => R[id].off.concat(R[id].def).filter(p => p && !Season.hurt(p)).sort((a, b) => b[3] - a[3])[0];
      if (riv || this.r() < 0.25) {
        const a = star(me), b = star(opp);
        if (a) post(riv ? 72 : 30, this.pl(a[1], me, a[2]), this.fill(this.pk([`{oppFans} circle the date. See you next week 👀`, `Heard the {opp} think they can slow us down. We'll see 😤`, `Next up: the {opp}. Let's work 💪`]), { oppFans: this.fanH(opp), opp: tName(opp) }), 0.55);
        if (a && b && riv) post(71, this.pl(b[1], opp, b[2]), `We'll be ready. Bring your A game ${this.pl(a[1], me, a[2]).h} 🤫`, 0.5);
      }
    }
    // power rankings
    const pr = d.pwr;
    if (pr && pr.list) { let best = null; for (const id of pr.list) { const mv = Power.move(id); if (mv > 0 && (!best || mv > best.mv)) best = { id, mv }; }
      post(40, this.ins, `Power Rankings, week ${wk + 1}: 1. ${tName(pr.list[0])} 2. ${tName(pr.list[1])} 3. ${tName(pr.list[2])}.${best && best.mv >= 3 ? ` Biggest riser: the ${tName(best.id)}, up ${best.mv} 📈` : ''}`, 0.4); }
    // the playoff race
    if (typeof PO !== 'undefined' && d.phase === 'regular' && wk >= Math.floor(d.games / 2)) {
      const was = d.fdPO && d.fdPO.y === d.year ? d.fdPO.s : {}, now = {};
      for (const c of ['AFC', 'NFC']) Object.assign(now, PO.status(c));
      for (const id in now) {
        const k = now[id]; if (!k || k === was[id]) continue;
        const t = Season.team(id);
        if (k === 'z') post(id === me ? 90 : 45, this.lg, `The ${tName(id)} lock up the No. 1 seed in the ${t.conf}. First-round bye 😴`, 0.5);
        else if (k === 'y' && id === me) post(88, this.lg, `The ${tName(id)} are ${t.conf} ${String(t.div).toUpperCase()} champions 👑`, 0.5);
        else if (k === 'x' && id === me) post(87, this.lg, `The ${tName(id)} have clinched a playoff spot ✅`, 0.5);
        else if (k === 'e' && id === me) post(86, this.fan(me), `Officially out of the playoff race. Next year is OUR year 😤`, 0.3);
      }
      d.fdPO = { y: d.year, s: now };
    }
    if (d.phase !== 'regular' && d.bracket && d.bracket.seeds) post(95, this.lg, `The playoff field is set 🏈 No. 1 seeds: the ${tName(d.bracket.seeds.AFC[0])} and the ${tName(d.bracket.seeds.NFC[0])}`, 0.7);
    // keep 5 to 12: your game always, then the biggest stories
    const n = 5 + Math.floor(this.r() * 8);
    P.forEach(p => { p.k = p.pri + this.r() * 8; });
    const keep = P.slice().sort((a, b) => b.k - a.k).slice(0, n);
    keep.reverse().forEach(p => this.add(p.who, p.tx, p.buzz, w));
  },

  // a playoff round (your game, plus one more result)
  round(round, name, games) {
    const d = Season.data, me = d.team, w = name.toUpperCase().replace('CONFERENCE CHAMPIONSHIP', 'CONF CHAMPIONSHIP');
    this.r = feedRng(hashStr(`${d.year}:po${round}:${me}:${games.map(g => g.score.join('-')).join(',')}`));
    const mine = games.find(g => g.home === me || g.away === me), others = games.filter(g => g !== mine);
    if (mine) {
      const h = mine.home === me, my = h ? mine.score[0] : mine.score[1], th = h ? mine.score[1] : mine.score[0], opp = h ? mine.away : mine.home;
      if (my > th && !(d.champ === me)) this.add(this.fan(me), this.pk([`SURVIVE AND ADVANCE ${this.emo('win')} ${my}-${th} over the ${tName(opp)}`, `Playoff football in our town hits different ${this.emo('win')}`, `ONE STEP CLOSER ${this.emo('win')}`]), 0.5, w);
      else if (my < th) this.add(this.fan(me), this.pk([`Season's over. Proud of this team though. Next year 💯`, `That one hurts. Thanks for the ride, see you next year 💔`]), 0.35, w);
    } else if (d.phase === 'playoffs' && round === 0) this.add(this.fan(me), `Bye week vibes 😴 Rest up, we've got work to do`, 0.25, w);
    const g = others.length ? this.pk(others) : null;
    if (g && g.conf !== 'BOWL') { const hw = g.score[0] > g.score[1]; this.add(this.ins, `The ${tName(hw ? g.home : g.away)} beat the ${tName(hw ? g.away : g.home)} ${Math.max(...g.score)}-${Math.min(...g.score)} and move on 🏈`, 0.45, w); }
  },
  // the champion gets crowned (posted once, the next time the hub shows)
  champ() {
    const d = Season.data; if (!d.champ || d.fdChamp === d.year) return;
    d.fdChamp = d.year; const me = d.team, c = d.champ;
    this.r = feedRng(hashStr(`${d.year}:champ:${c}`));
    const w = bowlName(d.year).toUpperCase();
    this.add(this.lg, `The ${tName(c)} are your ${bowlName(d.year)} champions 🏆🎉`, 0.95, w);
    this.add(this.fan(c), `CHAMPIONS!!! 🏆🏆🏆 Best day ever`, 0.6, w);
    if (c === me) { const R = Season.ensureRosters()[me], s = R.off.concat(R.def).filter(Boolean).sort((a, b) => b[3] - a[3])[0]; if (s) this.add(this.pl(s[1], me, s[2]), `We did it. For the city. For each other. 🏆`, 0.9, w); }
    Season.save();
  },

  // ---------- the FEED tab ----------
  esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  num: n => n >= 10000 ? Math.round(n / 1000) + 'K' : n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : String(n),
  html() {
    const L = Season.data.feed || [];
    if (!L.length) return '<div class="note">The Bobble Feed fills up as the weeks go by: fans, players, the insider and the league all post about what happened.</div>';
    return '<div class="fdList">' + L.map(p => `<div class="fdPost"><span class="fdAv" style="background:${p.c};color:${textOn(p.c)}">${this.esc(p.a)}</span><div class="fdB">
      <div class="fdH"><b>${this.esc(p.n)}</b>${p.v ? FD_ICON.ver : ''}<i>${this.esc(p.h)}  ·  ${p.w}</i></div>
      <div class="fdTx">${this.esc(p.tx).replace(/(@[A-Za-z0-9_]+)/g, '<u>$1</u>')}</div>
      <div class="fdF"><span>${FD_ICON.like}${this.num(p.lk)}</span><span>${FD_ICON.rp}${this.num(p.rp)}</span></div></div></div>`).join('') + '</div>';
  }
};

// ---------- hooks ----------
// after every regular-season week: power rankings, the weekly recap and the feed, all from this week's stat lines
{ const _fw = Season.finishWeek; Season.finishWeek = function (s) {
  const d = this.data;
  if (!Feed.live() || d.phase !== 'regular') return _fw.call(this, s);
  const wk = d.week, pre = this._wkPre || Form.snap(), top = (d.news || [])[0];
  this._fdPost = null; this._fdOn = true;
  try { _fw.call(this, s); } finally { this._fdOn = false; }
  try {
    const D = this.data, lines = Form.diff(pre, this._fdPost), fresh = [];
    for (const n of D.news || []) { if (n === top) break; fresh.push(n); }
    const r = feedRng(hashStr(`${D.year}:${wk}:${D.team}:${(D.weeks[wk][0].score || []).join('-')}`));
    Power.update(wk);
    WeekRecap.build(wk, lines, r);
    Feed.week(wk, lines, fresh, r);
  } catch (e) { console.warn('feed', e); }
  this._fdPost = null;
  this.save();
}; }
// the regular season just ended: freeze the stats before any playoff game gets simmed
{ const _sp = Season.startPlayoffs; Season.startPlayoffs = function () { if (this._fdOn) this._fdPost = Form.snap(); return _sp.call(this); }; }
{ const _fp = Season.finishPlayoffRound; Season.finishPlayoffRound = function (s) {
  const d = this.data, b = d.bracket; if (!Feed.live() || !b) return _fp.call(this, s);
  const round = b.round, name = this.roundName(round);
  _fp.call(this, s);
  try { const lg = (this.data.log || []).find(x => x.round === round); if (lg) Feed.round(round, name, lg.games); } catch (e) { console.warn('feed', e); }
  this.save();
}; }
// the feed + your recap setting come along into next year
{ const _ny = Season.nextYear; Season.nextYear = function () {
  const d = this.data, keep = { feed: d.feed, wkrOff: d.wkrOff, fdChamp: d.fdChamp };
  const ch = _ny.call(this);
  for (const k in keep) if (keep[k] != null) this.data[k] = keep[k];
  if (Feed.live()) Feed.say(Feed.lg, `Year ${this.data.year} is almost here. New season, new chances. Who you got? 🏈`, 0.5);
  this.save();
  return ch;
}; }
{ const _hub = renderHub; renderHub = function () { const d = Season.data; if (d && Feed.live()) try { Feed.champ(); } catch (e) {} _hub(); }; }

// FEED tab (was NEWS): the feed, with league news one tap away
let feedMode = 'feed';
{ const _tab = renderHubTab; renderHubTab = function () {
  const nb = document.querySelector('#shTabs button[data-tab="news"]'), on = Feed.live();
  if (nb) nb.textContent = on ? 'FEED' : 'NEWS';
  _tab();
  if (hubTab !== 'news' || !on) return;
  const d = Season.data, box = $('shStand');
  const bar = `<div class="fdBar"><button data-m="feed" class="${feedMode === 'feed' ? 'on' : ''}">BOBBLE FEED</button><button data-m="news" class="${feedMode === 'news' ? 'on' : ''}">LEAGUE NEWS</button>${d.wkr && d.wkr.y === d.year ? '<button id="fdWk">WEEK RECAP</button>' : ''}</div>`;
  if (feedMode === 'feed') box.innerHTML = bar + Feed.html(); else box.insertAdjacentHTML('afterbegin', bar);
  box.querySelectorAll('.fdBar button[data-m]').forEach(b => b.onclick = () => { feedMode = b.dataset.m; Sound.click(); renderHubTab(); box.scrollTop = 0; });
  if ($('fdWk')) $('fdWk').onclick = () => { Sound.click(); openWeekRecap(); };
}; }
// the hub's ALL NEWS link still goes to the news list
{ const _r = FH.render; FH.render = function () {
  _r.call(this);
  const b = $('fhNwAll'); if (b) b.onclick = () => { Sound.click(); hubTab = 'news'; feedMode = 'news'; renderHubTab(); $('shStand').scrollTop = 0; };
}; }
