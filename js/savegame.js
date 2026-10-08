// ---- Mid-game save: the game saves itself before every snap so a refresh / phone call doesn't wipe it ----
const SaveGame = {
  KEY: 'bobbleLive',
  FIELDS: ['human', 'diff', 'playoff', 'qtrLen', 'score', 'quarter', 'clock', 'poss', 'los', 'ballY', 'down', 'firstDownX', 'goalToGo', 'timeouts', 'patSide', 'twoPt',
    'weather', 'night', 'uni', 'versus', 'p1', 'pstats', 'tstats', 'xf', 'twoMinQ', 'firstPoss', 'lastOffKey', 'lastDefKey', 'lastOffKeys', 'lastDefKeys', 'kickFrom'],
  save() {
    if (G.demo || G.mini || G.challenge || G.online || !G.teams || G.phase === 'over' || G.human < 0) return;
    const d = { v: 1, at: Date.now(), teams: G.teams, pbp: (G.pbp || []).slice(-40), ko: G.koPending ? G.kickoffSide : null,
      season: G.season ? (Season.data && Season.data.week) + ':' + (Season.data && Season.data.phase) : null };
    for (const k of this.FIELDS) d[k] = G[k];
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) {}
  },
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} },
  // "CHI 14 - 10 PHI • 3rd 1:22"
  summary(d) {
    const c = Math.max(0, Math.ceil(d.clock)), q = d.quarter > 4 ? 'OT' : ordinal(d.quarter);
    return `${d.teams[1].id} ${d.score[1]} - ${d.score[0]} ${d.teams[0].id}  •  ${q} ${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}${d.season ? '  •  SEASON' : ''}`;
  },
  resume() {
    const d = this.get(); if (!d) return false;
    initGame(d.teams[0], d.teams[1], { qtr: d.qtrLen, diff: d.diff, humanSide: d.human, weather: d.weather, night: d.night, uni: d.uni, versus: d.versus, playoff: d.playoff });
    for (const k of this.FIELDS) if (d[k] !== undefined) G[k] = d[k];
    G.pbp = d.pbp || [];
    // a season game only counts if the season is still on that same week
    const sNow = Season.data ? Season.data.week + ':' + Season.data.phase : null;
    G.season = !!(d.season && d.season === sNow);
    showBanner('GAME RESUMED', this.summary(d), '#fff', 2);
    if (d.ko != null) startKickoff(d.ko, d.kickFrom || 35);
    else toPlayCall();
    return true;
  }
};
