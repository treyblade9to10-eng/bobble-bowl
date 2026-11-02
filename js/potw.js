// ---- Play of the Week (Season / franchise): after a game you played, your 3 best plays from the highlights go to a vote.
// The pick goes in the Trophy Case. WATCH plays the clip (highlights.js), SKIP moves on. Saved in localStorage bobblePotw ----
screens.push('potw'); menuScreens.push('potw');
(() => {
  const el = document.createElement('div'); el.id = 'potw'; el.className = 'screen';
  el.innerHTML = `<div class="pwHead"><b>PLAY OF THE WEEK</b><span id="pwSub"></span></div><div id="pwBody"></div><div class="pwBtns"><button id="pwSkip">SKIP</button></div>`;
  $('stage').appendChild(el);
})();

const Potw = {
  KEY: 'bobblePotw', cur: null,
  all() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]') || []; } catch (e) { return []; } },
  add(x) { const L = this.all(); L.push(x); while (L.length > 80) L.shift(); try { localStorage.setItem(this.KEY, JSON.stringify(L)); } catch (e) {} },
  // your team's best plays from the game that just ended (best first)
  picks() {
    if (!G.teams || G.human < 0 || typeof Highlights === 'undefined') return [];
    return Highlights.clips.filter(c => c.team === G.human).slice().sort((a, b) => b.ex - a.ex).slice(0, 3);
  },
  // a played Season / franchise game just ended (not career, not online)
  ready() {
    const d = typeof Season !== 'undefined' && Season.data;
    return !!(d && G.season && !G.career && !G.online && !G.versus && G.phase === 'over' && G.teams && !(Season.isCareer && Season.isCareer()) && this.picks().length >= 2);
  },
  // CONTINUE SEASON on the final screen: vote first, then the normal way (game recap, week recap, hub)
  open(then) {
    const d = Season.data, r = d.lastRecap, list = this.picks(), me = G.teams[G.human], opp = G.teams[1 - G.human];
    this.cur = { list, then, lbl: r && r.label ? r.label : `Week ${d.week}`, y: d.year, me, opp, fin: G.score.slice(), side: G.human, home: G.human === 0 };
    this.render(); show('potw');
  },
  card(c, i) {
    const T = G.teams, t = T[c.team], col = t.c1 === '#000000' ? '#555' : t.c1;
    return `<div class="pwCard" style="--tc:${col}"><div class="pwN">PLAY ${i + 1}</div>
      <div class="pwT">${Highlights.label(c)}</div><div class="pwW">${c.who || t.name.toUpperCase()}</div>
      <div class="pwQ">${c.q}  ${c.clock}  ·  ${T[1].id} ${c.score[1]} - ${c.score[0]} ${T[0].id}</div>
      <div class="pwB"><button class="big gold pwVote" data-i="${i}">VOTE</button><button class="pwWatch" data-i="${i}">WATCH</button></div></div>`;
  },
  render() {
    const P = this.cur;
    $('pwSub').textContent = `${P.lbl.toUpperCase()}  ·  ${tName(P.me.id).toUpperCase()} vs ${tName(P.opp.id).toUpperCase()}  ·  PICK YOUR BEST PLAY`;
    $('pwBody').className = '';
    $('pwBody').innerHTML = `<div class="pwRow">${P.list.map((c, i) => this.card(c, i)).join('')}</div>`;
    $('pwSkip').textContent = 'SKIP';
    $('pwBody').querySelectorAll('.pwVote').forEach(b => b.onclick = () => { Sound.click(); this.vote(+b.dataset.i); });
    $('pwBody').querySelectorAll('.pwWatch').forEach(b => b.onclick = () => { Sound.click(); Highlights.play([P.list[+b.dataset.i]], () => { show('potw'); }); });
  },
  vote(i) {
    const P = this.cur, c = P.list[i]; if (!c) return;
    const x = { y: P.y, wk: P.lbl, team: P.me.id, opp: P.opp.id, title: Highlights.label(c), who: c.who || '', q: c.q, clock: c.clock, fin: P.home ? `${P.fin[0]}-${P.fin[1]}` : `${P.fin[1]}-${P.fin[0]}`, won: P.fin[P.side] > P.fin[1 - P.side] };
    this.add(x); P.done = x;
    Sound.td();
    $('pwBody').className = 'pwDone';
    $('pwBody').innerHTML = `<div class="pwWin"><div class="tsvg">${typeof TROPHY_SVG !== 'undefined' ? TROPHY_SVG : ''}</div><div><span>${P.lbl.toUpperCase()}  ·  YEAR ${P.y}</span><b>${x.title}</b><i>${x.who}</i><em>Added to your Trophy Case</em></div></div>`;
    $('pwSkip').textContent = 'CONTINUE';
  },
  close() { const P = this.cur; this.cur = null; if (P && P.then) P.then(); }
};
$('pwSkip').onclick = () => { Sound.click(); Potw.close(); };
window.addEventListener('keydown', e => { if ($('potw').classList.contains('show') && e.code === 'Escape') { e.preventDefault(); Potw.close(); } });

// the final screen's CONTINUE SEASON: the vote comes first
{ const _cont = $('btnSeasonCont').onclick; $('btnSeasonCont').onclick = e => {
  if (Potw.ready() && !Potw.cur) { Sound.click(); return Potw.open(() => _cont(e)); }
  _cont(e);
}; }

// Trophy Case: your Plays of the Week
{ const _rt = renderTrophies; renderTrophies = function () {
  _rt();
  const L = Potw.all().slice().reverse();
  const rows = L.length ? L.map(x => `<div class="awRow pwRowT"><b>${x.title}</b> ${x.who} <span>${x.team} vs ${x.opp}  ·  ${x.wk}, Year ${x.y}</span></div>`).join('')
    : '<div class="troEmpty">Win a Play of the Week vote in Season mode and it shows up here.</div>';
  $('troBody').insertAdjacentHTML('beforeend', `<div class="troBox pwBox"><div class="troHead">PLAYS OF THE WEEK${L.length ? `  ·  ${L.length}` : ''}</div><div class="pwList">${rows}</div></div>`);
}; }
