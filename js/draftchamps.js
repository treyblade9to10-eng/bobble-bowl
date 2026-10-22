// ---- Draft Champions: pick 1 of 3 real players for every spot, then win 3 straight against drafted CPU squads ----
screens.push('dchamp'); menuScreens.push('dchamp');
(() => {
  const el = document.createElement('div');
  el.id = 'dchamp'; el.className = 'screen';
  el.innerHTML = `
    <div id="dcHead"><div><div id="dcKick">DRAFT CHAMPIONS</div><h2 id="dcTitle"></h2></div><div id="dcOvr"></div><button id="dcQuit">QUIT</button></div>
    <div id="dcCards"></div>
    <div id="dcFoot"><div id="dcLine"></div></div>`;
  document.getElementById('stage').appendChild(el);
})();

const DC = {
  KEY: 'bobbleDraftChamps',
  SLOTS: ['QB', 'RB', 'WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'DL', 'DL', 'DL', 'LB', 'LB', 'CB', 'CB', 'S'],
  GAMES: 3,
  run: null, // { base, picks: [tuple|null], game, wins, opp }

  // every real starter (and real QB2/RB2) in the league, with the team he plays for
  pool(pos) {
    const out = [];
    for (const t of CT.NFL) {
      for (const p of t.off.concat(t.def)) if (p[0] === pos) out.push({ p, team: t });
      for (const p of [t.qb2, t.rb2]) if (p && p[0] === pos) out.push({ p, team: t });
    }
    return out.sort((a, b) => b.p[3] - a.p[3]);
  },
  // three choices: a star, a solid starter, a wild card (never someone you already have)
  choices(pos, taken) {
    const all = this.pool(pos).filter(c => !taken.has(c.p[1])), n = all.length;
    if (n <= 3) return all;
    const tier = (a, b) => all.slice(Math.floor(n * a), Math.max(Math.floor(n * a) + 1, Math.floor(n * b)));
    const out = [];
    for (const list of [tier(0, 0.2), tier(0.2, 0.6), tier(0, 1)]) {
      const left = list.filter(c => !out.includes(c)); if (left.length) out.push(pick(left));
    }
    return out.sort(() => Math.random() - 0.5);
  },
  // the CPU drafts too: best of 3 at every spot, a bit better each game
  cpuSquad(game) {
    const taken = new Set(this.run.picks.filter(Boolean).map(p => p[1])), squad = [];
    for (const pos of this.SLOTS) {
      const ch = this.choices(pos, taken).sort((a, b) => b.p[3] - a.p[3]);
      const c = ch[Math.min(ch.length - 1, game >= 2 ? 0 : game === 1 ? (chance(0.6) ? 0 : 1) : (chance(0.4) ? 0 : 1))];
      taken.add(c.p[1]); squad.push(c.p);
    }
    return squad;
  },
  squadTeam(base, picks) {
    const t = { ...base, off: picks.slice(0, 8).map(p => p.slice(0, 6)), def: picks.slice(8).map(p => p.slice(0, 6)) };
    delete t.qb2; delete t.rb2; delete t.bench; delete t.replaces;
    return t;
  },
  ovr(picks) { const ps = picks.filter(Boolean); return ps.length ? Math.round(ps.reduce((a, p) => a + p[3], 0) / ps.length) : 0; },

  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.run)); } catch (e) {} },
  load() {
    try { const r = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (r && Array.isArray(r.picks) && r.picks.length === this.SLOTS.length) return r; } catch (e) {}
    return null;
  },
  clear() { this.run = null; try { localStorage.removeItem(this.KEY); } catch (e) {} },

  // from the Challenges menu / TRY AGAIN / NEXT GAME
  start() {
    this.run = this.load();
    if (this.run && this.run.picks.every(Boolean) && this.run.wins < this.GAMES && !this.run.lost) return this.play();
    const base = TEAMS[myIdx()] || CT.NFL[0];
    this.run = { base: base.id, picks: this.SLOTS.map(() => null), game: 0, wins: 0, lost: false };
    this.save(); this.render();
  },
  baseTeam() { return TEAMS.find(t => t.id === this.run.base) || CT.mine.find(t => t.id === this.run.base) || CT.NFL[0]; },

  render() {
    const r = this.run, i = r.picks.findIndex(p => !p);
    if (i < 0) return this.play();
    const pos = this.SLOTS[i], taken = new Set(r.picks.filter(Boolean).map(p => p[1]));
    if (!r.offer || r.offer.i !== i) { r.offer = { i, list: this.choices(pos, taken).map(c => ({ p: c.p, team: c.team.id })) }; this.save(); }
    $('dcTitle').textContent = `ROUND ${i + 1} OF ${this.SLOTS.length}  ·  PICK A ${pos}`;
    $('dcOvr').innerHTML = `<span>SQUAD OVR</span><b>${this.ovr(r.picks) || '--'}</b>`;
    $('dcCards').innerHTML = r.offer.list.map((c, k) => {
      const t = CT.NFL.find(x => x.id === c.team) || CT.NFL[0], p = c.p;
      const star = p[3] >= 90 ? 'dcGold' : p[3] >= 82 ? 'dcSil' : 'dcBrz';
      return `<button class="dcCard ${star}" data-k="${k}" style="--tc:${t.c1}">
        <div class="dcTop">${teamBadge(t)}<span class="dcPos">${p[0]}</span></div>
        <div class="dcO">${p[3]}</div><div class="dcN">${p[1]}</div>
        <div class="dcM">${t.city.toUpperCase()}  ·  #${p[2]}  ·  SPD ${p[4]}</div></button>`;
    }).join('');
    document.querySelectorAll('.dcCard').forEach(b => b.onclick = () => {
      r.picks[i] = r.offer.list[+b.dataset.k].p.slice(0, 6); r.offer = null; this.save(); this.render();
    });
    this.renderLine(i);
    show('dchamp');
  },
  renderLine(cur) {
    $('dcLine').innerHTML = this.SLOTS.map((pos, k) => {
      const p = this.run.picks[k];
      return `<div class="dcSlot${k === cur ? ' cur' : ''}${p ? ' got' : ''}"><span>${pos}</span><b>${p ? p[3] : ''}</b><i>${p ? lastName(p[1]) : ''}</i></div>`;
    }).join('');
  },

  play() {
    const r = this.run, base = this.baseTeam();
    if (!r.opp || r.opp.game !== r.game) {
      const others = CT.NFL.filter(t => t.id !== base.id);
      r.opp = { game: r.game, team: pick(others).id, picks: this.cpuSquad(r.game) }; this.save();
    }
    const me = this.squadTeam(base, r.picks), op = this.squadTeam(CT.NFL.find(t => t.id === r.opp.team) || CT.NFL[1], r.opp.picks);
    if (G.mode === 'mobile') goFullscreen();
    G.demo = false; G.season = false; G.mini = null; show(null);
    G.challenge = { type: 'draft' };
    const home = chance(0.5);
    newGame(home ? me : op, home ? op : me, { qtr: 120, diff: Math.min(3, 1 + Math.floor(r.game / 2)), humanSide: home ? 0 : 1 });
    showBanner(`GAME ${r.game + 1} OF ${this.GAMES}`, `Draft Champions  ·  your squad ${this.ovr(r.picks)} OVR vs ${op.name} squad ${this.ovr(r.opp.picks)} OVR`, '#ffd23f', 2.8);
  },
  // after a Draft Champions game: on to the next one, or the run is over
  result(won) {
    const r = this.run || this.load(); if (!r) return null;
    this.run = r;
    const R = Records.get(); R.draft = R.draft || { runs: 0, titles: 0, best: 0 };
    if (won) {
      r.wins++; r.game++;
      R.draft.best = Math.max(R.draft.best, r.wins);
      if (r.wins >= this.GAMES) { R.draft.runs++; R.draft.titles++; Records.set(R); this.clear(); return { ok: true, done: true, text: `DRAFT CHAMPION! 3-0 run. Titles: ${R.draft.titles}` }; }
      Records.set(R); this.save();
      return { ok: true, next: true, text: `Win ${r.wins} of ${this.GAMES}. The next squad drafts tougher.` };
    }
    R.draft.runs++; Records.set(R); r.lost = true; this.clear();
    return { ok: false, text: `Run over at ${r.wins}-1. Draft a new squad and go again.` };
  },
  recordText() { const d = Records.get().draft; return d ? `Titles: ${d.titles}  ·  Best: ${d.best}-0` : (this.load() ? 'Run in progress' : ''); }
};
$('dcQuit').onclick = () => { if (confirm('Quit this draft? Your squad is deleted.')) { DC.clear(); openModes(); } };
