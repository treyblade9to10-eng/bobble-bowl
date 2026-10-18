// ---- Season save slots: keep up to 3 franchises. Slot 1 is the old single save ('bobbleSeason'), so nothing has to move ----
// Everything a franchise has (rosters, contracts, cap, draft, news, trades, injuries, dilemmas) lives inside Season.data,
// so one localStorage key per slot holds the whole thing. Career mode keeps its own key ('bobbleCareerSeason').
const SeasonSlots = {
  N: 3, AKEY: 'bobbleSeasonSlot',
  key(n) { return n === 1 ? 'bobbleSeason' : 'bobbleSeason' + n; },
  active: (() => { let n = 1; try { n = +localStorage.getItem('bobbleSeasonSlot') || 1; } catch (e) {} return n >= 1 && n <= 3 ? n : 1; })(),
  peek(n) { try { return JSON.parse(localStorage.getItem(this.key(n)) || 'null'); } catch (e) { return null; } },
  // switch the franchise save to slot n (and load it)
  select(n) {
    this.active = n; try { localStorage.setItem(this.AKEY, String(n)); } catch (e) {}
    Season.slot = 'franchise'; Season.KEY = this.key(n); Season.load();
  },
  remove(n) {
    try { localStorage.removeItem(this.key(n)); } catch (e) {}
    if (Season.slot === 'franchise' && Season.KEY === this.key(n)) { Season.data = null; if (typeof CT !== 'undefined') CT.useLeague(null); }
  },
  summary(d) {
    if (!d || !d.rec || !d.team) return null;
    const r = d.rec[d.team] || { w: 0, l: 0, t: 0 }, base = (d.swap && d.swap.team && d.swap.team.id === d.team) ? d.swap.team : TEAMS.find(t => t.id === d.team) || (typeof CT !== 'undefined' && CT.NFL && CT.NFL.find(t => t.id === d.team));
    const where = d.phase === 'regular' ? `WEEK ${d.week + 1} OF ${d.games}` : d.phase === 'playoffs' ? 'PLAYOFFS' : d.draft ? 'DRAFT' : d.fa && d.fa.year === d.year && d.fa.stage !== 'done' ? 'FREE AGENCY' : 'OFFSEASON';
    const titles = (d.history || []).filter(h => h.champ === h.team).length + (d.champ === d.team && !(d.history || []).some(h => h.year === d.year) ? 1 : 0);
    return { team: base, rec: `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`, year: d.year || 1, where, titles };
  }
};
// the franchise side of the season engine always points at the active slot
Season.KEY = SeasonSlots.key(SeasonSlots.active);
{ const _use = Season.use; Season.use = function (slot) {
  _use.call(this, slot);
  if (slot === 'franchise' && this.KEY !== SeasonSlots.key(SeasonSlots.active)) { this.KEY = SeasonSlots.key(SeasonSlots.active); this.load(); }
}; }
// a saved mid-game remembers which slot it belongs to
SaveGame.FIELDS.push('seasonSlot');
{ const _r = SaveGame.resume.bind(SaveGame); SaveGame.resume = function () {
  const d = this.get();
  if (d && d.season && d.career !== 'nfl' && d.seasonSlot && d.seasonSlot !== SeasonSlots.active) SeasonSlots.select(d.seasonSlot);
  return _r();
}; }
{ const _p = $('shPlay').onclick; $('shPlay').onclick = e => { _p(e); G.seasonSlot = Season.slot === 'franchise' ? SeasonSlots.active : 0; }; }

// ---------------- slot picker ----------------
screens.push('seasonSlots'); menuScreens.push('seasonSlots');
(() => {
  const el = document.createElement('div'); el.id = 'seasonSlots'; el.className = 'screen';
  el.innerHTML = `<h2>Season Saves</h2><div id="ssCards"></div><div class="row"><button id="ssBack">BACK</button></div>`;
  $('stage').appendChild(el);
})();
function openSlots() {
  const h = [];
  for (let n = 1; n <= SeasonSlots.N; n++) {
    const s = SeasonSlots.summary(SeasonSlots.peek(n)), t = s && s.team;
    h.push(s && t ? `<div class="ssCard${n === SeasonSlots.active ? ' last' : ''}" style="--c1:${t.c1};--c2:${t.c2}">
        <div class="ssSlot">SLOT ${n}${n === SeasonSlots.active ? '  ·  LAST PLAYED' : ''}</div>
        <div class="ssLogo">${teamBadge(t)}</div><div class="ssTeam">${t.city ? `<i>${t.city}</i>` : ''}${t.name}</div>
        <div class="ssInfo"><b>YEAR ${s.year}</b>  ·  ${s.rec}</div><div class="ssWhere">${s.where}${s.titles ? `  ·  ${s.titles} TITLE${s.titles > 1 ? 'S' : ''}` : ''}</div>
        <button class="gold ssGo" data-n="${n}">CONTINUE</button><button class="ssDel" data-n="${n}">DELETE</button></div>`
      : `<div class="ssCard empty"><div class="ssSlot">SLOT ${n}</div><div class="ssEmpty">EMPTY</div><div class="ssWhere">Start a new franchise here</div><button class="ssGo" data-n="${n}">NEW SEASON</button></div>`);
  }
  $('ssCards').innerHTML = h.join('');
  document.querySelectorAll('.ssGo').forEach(b => b.onclick = () => { Sound.click(); SeasonSlots.select(+b.dataset.n); openSeason(); });
  document.querySelectorAll('.ssDel').forEach(b => b.onclick = () => {
    if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'TAP AGAIN TO DELETE'; Sound.click(); return; }
    SeasonSlots.remove(+b.dataset.n); Sound.click(); openSlots();
  });
  show('seasonSlots');
}
$('ssBack').onclick = () => { Sound.click(); show('title'); };
$('btnSeason').onclick = () => { Sound.init(); Sound.click(); openSlots(); };
