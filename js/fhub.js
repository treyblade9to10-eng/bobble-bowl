// ---- Franchise Hub: the season screen's first tab. Standing, injuries, trades, news, awards + Pro Bowl, cap and rating moves on one page ----
// Also: rating arrows + Pro Bowl / Player of the Week badges on the ROSTER tab and the depth chart, a LEAGUE STATS button on LEADERS.
(() => {
  const tabs = $('shTabs'), b = document.createElement('button');
  b.dataset.tab = 'home'; b.textContent = 'HUB'; tabs.insertBefore(b, tabs.firstChild);
  b.onclick = () => { hubTab = 'home'; Sound.click(); renderHubTab(); };
})();
hubTab = 'home';
// LEAGUE STATS on the season screen's button row
(() => { const b = document.createElement('button'); b.id = 'shStats'; b.textContent = 'LEAGUE STATS'; b.onclick = () => { Sound.click(); openLeagueStats(); }; $('shTrade').parentNode.insertBefore(b, $('shTrade')); })();

const FH = {
  ord: n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH'),
  card(cls, title, body, link) { return `<div class="fhCard ${cls}"><div class="fhT"><span>${title}</span>${link || ''}</div>${body}</div>`; },
  link(id, txt) { return `<button class="fhLink" id="${id}">${txt}</button>`; },
  standing() {
    const d = Season.data, me = d.team, t = Season.team(me), st = Season.standings(t.conf), div = st.filter(id => Season.team(id).div === t.div);
    const cr = st.indexOf(me) + 1, dr = div.indexOf(me) + 1;
    let big = `${this.ord(dr)} IN ${t.conf} ${String(t.div).toUpperCase()}`, sub = `${this.ord(cr)} in the ${t.conf}`, tag = '';
    if (d.phase === 'regular' && typeof PO !== 'undefined') {
      const seeds = PO.seeds(t.conf), mk = PO.status(t.conf)[me], si = seeds.indexOf(me);
      if (mk === 'z') tag = '<em class="fhTag g">CLINCHED THE 1 SEED</em>'; else if (mk === 'y') tag = '<em class="fhTag g">CLINCHED DIVISION</em>';
      else if (mk === 'x') tag = '<em class="fhTag g">CLINCHED PLAYOFFS</em>'; else if (mk === 'e') tag = '<em class="fhTag r">ELIMINATED</em>';
      else if (si >= 0) tag = `<em class="fhTag g">${si + 1} SEED IF IT ENDED TODAY</em>`;
      else { const gb = PO.gb(me, seeds[seeds.length - 1]); tag = `<em class="fhTag">${gb ? `${gb} GAME${gb === 1 ? '' : 'S'} BACK` : 'TIED FOR THE LAST SPOT'}</em>`; }
      sub += `  ·  ${PO.left()} game${PO.left() === 1 ? '' : 's'} left`;
    } else if (d.phase === 'playoffs') tag = `<em class="fhTag g">ALIVE: ${Season.roundName(d.bracket.round).toUpperCase()}</em>`;
    else if (d.champ === me) tag = '<em class="fhTag g">CHAMPIONS</em>';
    else if (d.phase === 'missed') tag = '<em class="fhTag r">MISSED THE PLAYOFFS</em>';
    else if (d.phase === 'eliminated') tag = '<em class="fhTag r">OUT OF THE PLAYOFFS</em>';
    const r = d.rec[me], diff = r.pf - r.pa;
    return this.card('fhStand', 'STANDING', `<div class="fhBig">${big}</div><div class="fhLine">${sub}  ·  ${diff >= 0 ? '+' : ''}${diff} point diff</div>${tag}`,
      this.link('fhPO', d.phase === 'regular' ? 'PLAYOFF PICTURE' : 'BRACKET'));
  },
  awards() {
    const d = Season.data, me = d.team, W = Form.thisYear(d.potw), w = W[W.length - 1];
    const one = (lbl, a) => a ? `<div class="fhAwR${a.t === me ? ' me' : ''}"><i>${lbl}</i><span>${a.pos} ${a.name} <small>${a.t}</small></span><small>${a.line}</small></div>` : '';
    const mineN = W.reduce((n, x) => n + ['off', 'def'].filter(k => x[k] && x[k].t === me).length, 0);
    let h = w ? `<div class="fhSub">WEEK ${w.wk + 1} PLAYERS OF THE WEEK</div>${one('OFF', w.off)}${one('DEF', w.def)}${w.rook && !w.rook.also ? one('ROOK', w.rook) : ''}${mineN ? `<div class="fhLine dim">Your players have won ${mineN} this year.</div>` : ''}`
      : '<div class="fhLine dim">Players of the Week start after week 1.</div>';
    const pb = prbStatus('fhVote'); if (pb) h += `<div class="fhSub fhGap">PRO BOWL</div>${pb}`;
    return this.card('fhAw', 'AWARDS', h, this.link('fhAwAll', 'ALL AWARDS'));
  },
  injuries() {
    const d = Season.data, L = Season.injList(d.team).sort((a, b) => b[3] - a[3]);
    const h = L.slice(0, 4).map(p => `<div class="fhRow"><span>${p[0]} ${p[1]} <small>${p[3]}</small></span><em class="fhOut">${(p[6].injWhat || 'hurt').toUpperCase()}  ·  ${wkStr(p[6].inj)}</em></div>`).join('')
      + (L.length > 4 ? `<div class="fhLine dim">+${L.length - 4} more</div>` : '');
    return this.card('fhInj', `INJURIES${L.length ? `  ·  ${L.length} OUT` : ''}`, h || '<div class="fhLine dim">Everybody is healthy.</div>', this.link('fhInjAll', 'INJURY REPORT'));
  },
  trades() {
    const d = Season.data, can = Season.canTrade(), o = d.offer;
    let h = '';
    if (o && can) h += `<div class="fhRow fhOffer"><span><b>${tName(o.from).toUpperCase()}</b> made you an offer</span><em class="fhTag g">ANSWER IT ON THE LEFT</em></div>`;
    h += `<div class="fhLine">${d.phase !== 'regular' ? 'Trades open again after the draft.' : can ? `Deadline: week ${Season.deadline()}  ·  ${Season.deadline() - d.week} week${Season.deadline() - d.week === 1 ? '' : 's'} left` : 'The deadline has passed. Rosters are locked.'}</div>`;
    const lg = (d.news || []).filter(n => /^(TRADE:|DEADLINE DEAL|OFFSEASON TRADE|DRAFT TRADE)/.test(n.text)).slice(0, 2);
    h += lg.map(n => `<div class="fhNews"><span>WK ${n.week}</span>${n.text.replace(/^[A-Z ]+: /, '')}</div>`).join('');
    const mine = (d.trades || []).length; if (mine) h += `<div class="fhLine dim">You've made ${mine} trade${mine === 1 ? '' : 's'} this year.</div>`;
    return this.card('fhTr', 'TRADES', h, can ? this.link('fhTrGo', 'TRADE CENTER') : '');
  },
  news() {
    const d = Season.data, N = (d.news || []).filter(n => !/^PLAYERS OF THE WEEK/.test(n.text)).slice(0, 4);
    return this.card('fhNw', 'LATEST NEWS', N.map(n => `<div class="fhNews"><span>WK ${n.week}</span>${n.text}</div>`).join('') || '<div class="fhLine dim">League news shows up here.</div>', this.link('fhNwAll', 'ALL NEWS'));
  },
  form() {
    const d = Season.data, me = d.team, all = Contracts.all(me);
    const moved = all.filter(p => Form.delta(p)).sort((a, b) => Math.abs(Form.delta(b)) - Math.abs(Form.delta(a)) || b[3] - a[3]);
    const streak = all.filter(p => !Form.delta(p) && Math.abs(Form.heat(p)) >= 1.4).sort((a, b) => Math.abs(Form.heat(b)) - Math.abs(Form.heat(a)));
    const row = p => { const dv = Form.delta(p), ht = Form.heat(p);
      return `<div class="fhRow"><span>${p[0]} ${p[1]}</span><span class="fhR">${ht >= 1.4 ? '<em class="fhTag g">HOT</em>' : ht <= -1.4 ? '<em class="fhTag c">COLD</em>' : ''}<b>${p[3]}</b>${lsArrow(p)}</span></div>`; };
    const list = moved.slice(0, 4).concat(streak.slice(0, Math.max(0, 4 - moved.length)));
    return this.card('fhFm', 'RATINGS ON THE MOVE', list.map(row).join('') || `<div class="fhLine dim">${d.week < FORM_MIN_GAMES ? `Ratings start moving with how guys play after week ${FORM_MIN_GAMES}.` : 'Nobody has heated up or cooled off yet.'}</div>`, this.link('fhRos', 'ROSTER'));
  },
  cap() {
    const me = Season.data.team, pay = Contracts.payroll(me), room = CAP - pay;
    return this.card('fhCap', 'SALARY CAP', `<div class="fhCapN"><b class="${room < 0 ? 'neg' : ''}">${cmoney(room)}</b><span>CAP ROOM</span></div><div class="fhBar"><u style="width:${Math.min(100, pay / CAP * 100)}%"></u></div><div class="fhLine dim">${cmoney(pay)} of ${cmoney(CAP)} spent</div>`,
      Season.data.phase === 'regular' ? this.link('fhFA', 'FREE AGENTS') : '');
  },
  render() {
    const d = Season.data;
    Contracts.ensure();
    $('shStand').innerHTML = `<div class="fhGrid"><div class="fhCol">${this.standing()}${this.injuries()}${this.news()}${this.cap()}</div><div class="fhCol">${this.awards()}${this.trades()}${this.form()}</div></div>`;
    const on = (id, f) => { const e = $(id); if (e) e.onclick = () => { Sound.click(); f(); }; };
    const tab = t => () => { hubTab = t; renderHubTab(); $('shStand').scrollTop = 0; };
    on('fhPO', openPlayoffs);
    on('fhAwAll', () => openLeagueStats('aw'));
    on('fhVote', () => openProBowl());
    on('fhInjAll', tab('inj')); on('fhNwAll', tab('news')); on('fhRos', tab('ros'));
    on('fhTrGo', () => $('shTrade').onclick()); on('fhFA', () => ctOpenFree());
  }
};

{ const _tab = renderHubTab; renderHubTab = function () {
  const d = Season.data, home = hubTab === 'home' && d && !(Season.isCareer && Season.isCareer());
  $('seasonHub').classList.toggle('fhHome', !!home);
  $('shStand').classList.toggle('fhOn', !!home);
  if (home) { document.querySelectorAll('#shTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'home')); try { FH.render(); } catch (e) { console.warn('hub', e); hubTab = 'stand'; _tab(); } return; }
  if (hubTab === 'home') hubTab = 'stand';
  _tab();
  if (!d) return;
  if (hubTab === 'lead') $('shStand').insertAdjacentHTML('beforeend', '<div class="fhQuick"><button id="fhLeadAll">FULL LEAGUE STATS</button></div>'), $('fhLeadAll').onclick = () => { Sound.click(); openLeagueStats(); };
  if (hubTab === 'ros') { // rating arrows + badges on your guys
    const me = d.team, all = Contracts.all(me);
    $('shStand').querySelectorAll('.leadRow').forEach(r => {
      const s = r.querySelector('span'), p = s && all.find(q => s.textContent.startsWith(`${q[0]} ${q[1]}`)); if (!p) return;
      const tags = lsTags(me, p[1], p); if (tags) s.insertAdjacentHTML('beforeend', tags);
      const b = r.querySelector('i b'); if (b) b.insertAdjacentHTML('afterend', lsArrow(p));
    });
    if (d.phase === 'regular') $('shStand').insertAdjacentHTML('beforeend', `<div class="note">Arrows: how much a player's rating has moved this season from how he's playing. Up to ${FORM_CAP} either way.</div>`);
  }
}; }
// same on the depth chart
{ const _rd = renderDepth; renderDepth = function () {
  _rd();
  if (!Season.data) return;
  document.querySelectorAll('.dcRow').forEach(r => {
    let p = null; try { p = dcGet(r.dataset.k); } catch (e) {} if (!p) return;
    const nm = r.querySelector('.nm'), b = r.querySelector(':scope > b');
    const tags = lsTags(Season.data.team, p[1], p); if (tags && nm) nm.firstChild.after(document.createRange().createContextualFragment(tags));
    if (b) b.insertAdjacentHTML('beforeend', lsArrow(p));
  });
}; }
