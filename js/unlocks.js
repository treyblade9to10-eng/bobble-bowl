// ---- Unlockable cellys: score touchdowns, win games and win Bobble Bowls to earn new celebrations ----
const Unlocks = {
  KEY: 'bobbleUnlocks', d: null,
  load() { if (this.d) return this.d; try { this.d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) {} this.d = this.d || { tds: 0, seen: [] }; return this.d; },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) {} },
  td() { this.load().tds++; this.save(); }, // you scored (any mode)
  stats() { const T = (typeof Career !== 'undefined' && Career.tro) || {}; return { tds: this.load().tds, wins: T.w || 0, titles: (T.titles || []).length }; },
  list() { return CELLYS.filter(c => c.lock); },
  has(id) { const c = CELLYS.find(x => x.id === id); if (!c || !c.lock) return true; const s = this.stats(); return Object.keys(c.lock).every(k => s[k] >= c.lock[k]); },
  req(c) { const [k, n] = Object.entries(c.lock)[0]; return k === 'tds' ? `Score ${n} touchdowns` : k === 'wins' ? `Win ${n} games` : n > 1 ? `Win ${n} Bobble Bowls` : 'Win a Bobble Bowl'; },
  progress(c) { const [k, n] = Object.entries(c.lock)[0], s = this.stats(); return [Math.min(s[k], n), n]; },
  // cellys that just unlocked and haven't been announced yet
  fresh() { const d = this.load(), out = this.list().filter(c => this.has(c.id) && !d.seen.includes(c.id)); if (out.length) { d.seen.push(...out.map(c => c.id)); this.save(); } return out; }
};
const CELLY_KEY_NAME = { Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9' };

// announce new cellys on the final screen
{
  const _over = G.hooks.onGameOver;
  G.hooks.onGameOver = s => {
    _over && _over(s);
    if (G.demo) return;
    let el = $('overUnlock');
    if (!el) { el = document.createElement('div'); el.id = 'overUnlock'; $('overStats').parentNode.insertBefore(el, $('overStats')); }
    const f = Unlocks.fresh();
    el.innerHTML = f.map(c => `<div class="unlk"><span>NEW CELLY UNLOCKED</span><b>${c.name}</b><i>${G.mode === 'mobile' ? 'Tap it after a touchdown' : `Press ${CELLY_KEY_NAME[c.keys[0]]} after a touchdown`}</i></div>`).join('');
  };
}
// Trophy Case: what you've unlocked and what's left
{
  const _rt = renderTrophies;
  renderTrophies = function () {
    _rt();
    const rows = Unlocks.list().map(c => { const ok = Unlocks.has(c.id), [h, n] = Unlocks.progress(c);
      return `<div class="clRow${ok ? ' ok' : ''}"><b>${c.name}</b><span>${ok ? (G.mode === 'mobile' ? 'UNLOCKED' : `UNLOCKED  ·  KEY ${CELLY_KEY_NAME[c.keys[0]]}`) : Unlocks.req(c)}</span>${ok ? '' : `<i class="clBar"><u style="width:${Math.round(100 * h / n)}%"></u></i><em>${h}/${n}</em>`}</div>`; }).join('');
    $('troBody').insertAdjacentHTML('beforeend', `<div class="troBox clBox"><div class="troHead">CELEBRATIONS</div>${rows}</div>`);
  };
}
// phone buttons for unlocked cellys
{
  const box = $('mbtns'), club = $('mbClub');
  for (const c of CELLYS.filter(c => c.lock)) { const b = document.createElement('button'); b.dataset.k = c.keys[0]; b.dataset.show = 'celly'; b.dataset.lock = c.id; b.textContent = c.name; box.insertBefore(b, club); }
}
