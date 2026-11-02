// ---- Crowd sound in a game: real stadium recordings (audio/CREDITS.txt) ----
// A murmur loop the whole game plus an excited cheering loop on top that follows the moment (crowd hype, road offense on
// 3rd down, momentum, a close 4th quarter). Cheers / groans / boos on big plays for the HOME crowd, and boom-boom-clap
// stadium drums when the home defense needs a stop on 3rd down. Reactions + drums go through Sound.sfx, so the online
// guest hears the host's; the loops run on each device from the game state.
const CrowdFX = {
  L: { bed: 20, hype: 16 }, // loop lengths (s) after the file marker
  bed: null, hype: null, sc: null, lastR: -99, lastP: 0, chant: null,
  stats: { cheerBig: 0, cheer: 0, groan: 0, boo: 0, ooh: 0, drum: 0 },
  host() { return !(typeof Net !== 'undefined' && Net.role === 'guest' && G.online); },
  // a reaction. Bigger ones win: nothing smaller plays for 1.5 s after one
  say(kind, k = 1, dl = 0) {
    const pr = { cheerBig: 3, boo: 3, cheer: 2, groan: 2, ooh: 1 }[kind] || 1, now = G.time || 0; // game time
    if (now - this.lastR >= 0 && now - this.lastR < 1.5 && pr <= this.lastP) return;
    this.lastR = now; this.lastP = pr; this.stats[kind] = (this.stats[kind] || 0) + 1;
    Sound.sfx(kind, k, dl);
  },
  scoreDelta() { const s = G.score || [0, 0], o = this.sc || s.slice(); this.sc = s.slice(); return [s[0] - o[0], s[1] - o[1]]; },
  // a momentum swing (flow.js): side made a big play worth amt
  react(side, amt) {
    if (!this.host() || !G.teams || G.demo || G.mini) return;
    const d = this.scoreDelta();
    if (d[0] >= 6 || d[1] >= 6) return this.touchdown(d[0] >= 6 ? 0 : 1);
    if (side === 0) this.say(amt >= 20 ? 'cheerBig' : 'cheer', amt >= 20 ? 0.9 : 0.75);
    else if (amt >= 26) { this.say('ooh', 0.7); this.lastP = 1; this.say('groan', 1, 0.45); } // a road takeaway: "OHH... aww"
    else this.say('groan', 0.8);
  },
  // touchdown: the home crowd goes nuts (or boos the road team scoring in their house), plus the TV brass sting
  touchdown(side) { this.say(side === 0 ? 'cheerBig' : 'boo', 1); Sound.sfx('sting', 1); },
  // Sound.td(): a score just went up. Field goals / extra points / 2-pt tries don't always swing the momentum
  scored() {
    if (!this.host()) return;
    setTimeout(() => {
      if (!G.teams || G.demo) return;
      const d = this.scoreDelta();
      if (d[0] >= 6 || d[1] >= 6) this.touchdown(d[0] >= 6 ? 0 : 1);
      else if (d[0] >= 2) this.say('cheer', 0.85); else if (d[0] === 1) this.say('cheer', 0.5); else if (d[1] >= 3) this.say('groan', 0.7);
    }, 30);
  },
  // an incomplete pass: home offense -> groan, road offense on 3rd / 4th down -> cheer
  incomplete(d0) {
    if (!this.host() || !G.teams || G.demo || G.mini || G.special) return;
    if (G.poss === 0) { if (d0 >= 3) this.say('groan', 1); else if (Math.random() < 0.6) this.say('groan', 0.5); }
    else if (d0 >= 3) this.say('cheer', 0.7);
  },
  // how loud the place is right now (0..1): the excited layer on top of the murmur
  heat() {
    if (!G.teams) return 0;
    let h = Math.min(1, (G.crowdHype || 0) / 1.8) + (typeof Crowd !== 'undefined' ? Crowd.level() * 0.8 : 0);
    const m = (G.score[0] || 0) - (G.score[1] || 0);
    if (G.quarter >= 4 && Math.abs(m) <= 8) h += 0.15;
    if (G.phase === 'live') h += 0.12;
    if (typeof Momentum !== 'undefined') h += Momentum.of(0) * 0.3;
    if (m < -17) h *= 0.5; // getting blown out: the place empties out
    return Math.max(0, Math.min(1, h));
  },
  loop(k, v) {
    const c = Sound.ctx, B = Sound.buf[k]; if (!B || !Sound.out) return null;
    const src = c.createBufferSource(), g = c.createGain(); src.buffer = B.b; src.loop = true; src.loopStart = B.at; src.loopEnd = B.at + this.L[k];
    g.gain.value = 0; src.connect(g); g.connect(Sound.out); src.start(c.currentTime + 0.02, B.at + Math.random() * this.L[k] * 0.9);
    return { src, g };
  },
  stop() {
    const c = Sound.ctx; for (const k of ['bed', 'hype']) { const l = this[k]; if (!l) continue; try { l.g.gain.setTargetAtTime(0, c.currentTime, 0.25); l.src.stop(c.currentTime + 1.5); } catch (e) {} this[k] = null; }
  },
  tick() {
    const c = Sound.ctx; if (!c || !Sound.out) return;
    const game = !!G.teams && !G.demo && G.phase !== 'over' && !document.hidden && Sound.live();
    if (!game) { if (this.bed) this.stop(); this.chant = null; this.sc = null; return; }
    if (!this.sc) this.sc = (G.score || [0, 0]).slice();
    if (!this.bed) this.bed = this.loop('bed'); if (!this.hype) this.hype = this.loop('hype');
    const quiet = G.paused || (typeof Highlights !== 'undefined' && Highlights.on) || (typeof Broadcast !== 'undefined' && Broadcast.on);
    const fly = typeof Flyover !== 'undefined' && Flyover.on, base = typeof Crowd !== 'undefined' ? Crowd.base() : 0.4, h = fly ? 0.9 : this.heat();
    const m = (G.score[0] || 0) - (G.score[1] || 0), bv = (quiet && !fly ? 0.12 : 0.36 + base * 0.3) * (m < -17 ? 0.6 : 1) * (G.mini ? 0.6 : 1);
    if (this.bed) this.bed.g.gain.setTargetAtTime(bv, c.currentTime, 0.5);
    if (this.hype) this.hype.g.gain.setTargetAtTime(quiet && !fly ? 0 : 0.05 + 0.5 * h * h, c.currentTime, h > 0.5 ? 0.35 : 0.8);
    // 3rd down, road offense, the home crowd brings it: boom boom CLAP until the snap (the 2:00 drill has its own drums)
    const want = this.host() && G.poss === 1 && G.down >= 3 && !G.special && G.patSide == null && !G.mini && !quiet
      && (G.phase === 'presnap' || G.phase === 'playcall') && base > 0 && !(typeof Flow !== 'undefined' && Flow.bed);
    if (!want) { this.chant = null; return; }
    if (!this.chant) this.chant = { next: c.currentTime + 0.3, i: 0 };
    const ch = this.chant;
    while (ch.next < c.currentTime + 0.4) {
      const dl = Math.max(0, ch.next - c.currentTime), k = ch.i % 4;
      if (k < 2) { Sound.sfx('drum', 0.8 + k * 0.2, dl); this.stats.drum++; } else if (k === 2) Sound.sfx('clap', 1, dl);
      ch.next += 0.42; ch.i++;
    }
  }
};
setInterval(() => { try { CrowdFX.tick(); } catch (e) {} }, 200);
// incomplete passes (the down before the play decides how much it hurts)
{ const _ep = endPlay; endPlay = function (res) { const d0 = G.down, live = G.phase === 'live'; const r = _ep.apply(this, arguments); if (live && res && res.type === 'inc') CrowdFX.incomplete(d0); return r; }; }
