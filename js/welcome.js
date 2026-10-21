// ---- First-time pop-ups: offer the Training Camp tutorial the first time a device opens the game,
// and again the first time it starts a Quick Game or a Season. Each one shows once and can be skipped.
(() => {
  const box = document.createElement('div'); box.id = 'wcBox';
  box.innerHTML = `<div class="wcCard"><div class="wcTag" id="wcTag"></div><h3 id="wcTitle"></h3><div id="wcBody"></div>
    <div class="wcBtns"><button class="big gold" id="wcYes"></button><button id="wcNo"></button></div></div>`;
  document.getElementById('stage').appendChild(box);
})();

const Welcome = {
  KEY: 'bobbleWelcome',
  seen() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]') || []; } catch (e) { return []; } },
  mark(k) { const s = this.seen(); if (!s.includes(k)) s.push(k); try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch (e) {} },
  // a device that played before this existed isn't new: don't pop anything up on it
  init() {
    let old = false;
    try { if (localStorage.getItem(this.KEY) == null) for (let i = 0; i < localStorage.length; i++) if (/^bobble/.test(localStorage.key(i)) && !['bobbleWelcome', 'bobbleMode'].includes(localStorage.key(i))) { old = true; break; } } catch (e) {}
    if (old) for (const k of ['first', 'quick', 'season']) this.mark(k);
    else if (!this.seen().includes('first')) setTimeout(() => this.show('first', null), 600);
  },
  TEXT: {
    first: { tag: 'WELCOME', title: 'New to Bobble Bowl?', yes: 'START TUTORIAL', no: 'NO THANKS',
      body: 'Training Camp is a quick tutorial you play through: passing, running, moves, defense and kicking. It only takes a few minutes.' },
    quick: { tag: 'QUICK GAME', title: 'First game?', yes: 'DO THE TUTORIAL', no: 'NO THANKS, PLAY',
      body: 'Pick two teams and play one game. Want to learn the controls in Training Camp first?' },
    season: { tag: 'SEASON', title: 'First season?', yes: 'DO THE TUTORIAL', no: 'NO THANKS, PLAY',
      body: 'Pick a team and play a whole year: play or sim each week, make the playoffs, then trade, draft and sign players. Want to learn the controls in Training Camp first?' }
  },
  // show the pop-up for k; `go` runs if they say no (keeps going where they were headed)
  show(k, go) {
    const T = this.TEXT[k];
    $('wcTag').textContent = T.tag; $('wcTitle').textContent = T.title; $('wcBody').textContent = T.body;
    $('wcYes').textContent = T.yes; $('wcNo').textContent = T.no;
    const close = () => { $('wcBox').classList.remove('show'); this.mark(k); };
    $('wcYes').onclick = () => { Sound.init(); Sound.click(); close(); if (k === 'first') this.mark('quick'); modeAfter = 'tutorial'; show('mode'); };
    $('wcNo').onclick = () => { Sound.init(); Sound.click(); close(); if (go) go(); };
    $('wcBox').classList.add('show');
  },
  // run `go` now, or after the pop-up if this is the first time
  gate(k, go) {
    if (this.seen().includes(k) || (typeof Tutorial !== 'undefined' && Tutorial.done().length)) { this.mark(k); go(); return; }
    this.show(k, go);
  }
};
for (const [id, k] of [['btnPlay', 'quick'], ['btnSeason', 'season']]) {
  const f = $(id).onclick; $(id).onclick = e => { Sound.init(); Welcome.gate(k, () => f.call($(id), e)); };
}
Welcome.init();
