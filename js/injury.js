// ---- QB wear and tear + injuries: every hit on the QB adds wear, a worn-down QB gets less accurate
// and can get hurt. If he does, the backup QB finishes the game. ----
const BACKUP_FIRST = ['Tyler', 'Mason', 'Cooper', 'Jake', 'Brett', 'Drew', 'Kyle', 'Tanner', 'Easton', 'Zach', 'Brock', 'Jalen', 'Devin', 'Marcus', 'Chase', 'Logan'];
const BACKUP_LAST = ['Hollis', 'Kerrigan', 'Mabry', 'Stroud-Lee', 'Pruett', 'Vance', 'Dobbins', 'Rourke', 'Calloway', 'Sutter', 'Whitlock', 'Bramlett', 'Okafor', 'Delacroix', 'Fenwick', 'Tisdale'];
// every team's backup QB (made-up names): about 64-72 OVR
function backupQB(team) {
  const h = hashStr(team.id + 'bqb'), start = team.off[0];
  const ovr = 64 + (h % 9), spd = 70 + ((h >> 4) % 18);
  return ['QB', `${BACKUP_FIRST[h % 16]} ${BACKUP_LAST[(h >> 8) % 16]}`, [7, 8, 11, 12, 14, 16, 19][(h >> 12) % 7], ovr, spd, (h >> 16) % 6];
}

const Injury = {
  reset() { G.qbWear = [0, 0]; G.qbHurt = [null, null]; },
  on() { return !G.demo && !G.mini && !G.online && !G.challenge; },
  wear(side) { return (G.qbWear && G.qbWear[side]) || 0; },
  // the QB got hit: kind = 'sack' | 'tackle' | 'boom'
  hit(qb, kind) {
    if (!this.on() || !qb || qb.pos !== 'QB' || qb !== G.O[0]) return;
    if (!G.qbWear) this.reset();
    const s = qb.side, add = kind === 'boom' ? 20 : kind === 'sack' ? 13 : 8;
    const before = G.qbWear[s];
    G.qbWear[s] = Math.min(100, before + add);
    if (before < 55 && G.qbWear[s] >= 55) { addText(qb.x, qb.y - 3, 'QB IS BANGED UP', '#ffb35c', 16, 1.4); addPbp(`${qb.name} is slow to get up.`); }
    if (qb.cap || G.qbHurt[s]) return; // your career player shakes it off; only one QB injury per team per game
    const w = G.qbWear[s], p = w < 50 ? 0 : 0.003 + (w - 50) * 0.0008 + (kind === 'boom' ? 0.01 : 0); // only a QB who's taken a beating can get hurt
    if (chance(p)) this.hurt(s, qb);
  },
  hurt(s, qb) {
    const t = G.teams[s], b = backupQB(t);
    G.qbHurt[s] = qb.name;
    G.teams[s] = { ...t, off: [b, ...t.off.slice(1)] };
    G.qbWear[s] = 10;
    G.injuryNote = { side: s, out: qb.name, inn: b[1], t: 0 };
    addPbp(`INJURY: ${qb.name} is hurt and out for the game. Backup ${b[1]} is in at QB.`);
  },
  // shown when the dead ball is over so it doesn't fight the play result banner
  announce() {
    const n = G.injuryNote; if (!n) return;
    G.injuryNote = null;
    showBanner('QB INJURY', `${n.out} is out  ·  backup ${n.inn} comes in`, '#ffb35c', 2.4);
  },
  // halftime: the trainers help a little
  half() { if (G.qbWear) G.qbWear = G.qbWear.map(w => Math.round(w * 0.6)); }
};
