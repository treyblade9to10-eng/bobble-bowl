// ---- Playbook ----
// Offense slots: 0 QB, 1 RB, 2 WR1 (top wide), 3 WR2 (bottom wide), 4 WR3 (slot), 5-7 OL
// Defense slots: 0-2 DL, 3-4 LB, 5 CB1 (vs WR1), 6 CB2 (vs WR2), 7 S
//
// Receiver routes: list of [downfield, out] steps measured from where the player lines up.
//   "out" is toward that player's own sideline (negative = toward the middle).
//   end: 'go' keeps running the last direction, 'sit' stops and waits for the ball.
// RB "path" uses field spots: [yards from line of scrimmage (negative = backfield), wide-side offset].

const OFF_PLAYS = [
  { key: 'zone', form: 'iform', name: 'Inside Zone', type: 'run', desc: 'Handoff right up the gut.',
    rb: { path: [[-3.6, 0.6], [0.5, 0.4], [10, 0]], end: 'go' }, wr: 'block' },
  { key: 'toss', form: 'gun', name: 'Toss Sweep', type: 'run', desc: 'Pitch it outside and race the edge.',
    rb: { path: [[-4.2, 7.5], [-2.2, 12], [1.5, 15], [12, 16]], end: 'go' }, wr: 'block', toss: true },
  { key: 'slants', form: 'gun', name: 'Slants', type: 'pass', desc: 'Quick slants. Get it out fast!',
    routes: { 2: { r: [[2, 0], [9, -7]], end: 'go' }, 3: { r: [[2, 0], [9, -7]], end: 'go' }, 4: { r: [[5, 0], [6, 5]], end: 'sit' },
              1: { r: [[1, 4], [2, 9]], end: 'sit' } } },
  { key: 'verts', form: 'empty', name: 'Four Verts', type: 'pass', desc: 'Everybody go deep. Big play hunting.',
    routes: { 2: { r: [[40, 0]], end: 'go' }, 3: { r: [[40, 0]], end: 'go' }, 4: { r: [[3, 0], [40, -2]], end: 'go' },
              1: { r: [[1, -2], [3, -3]], end: 'sit' } } },
  { key: 'mesh', form: 'trips', name: 'Mesh', type: 'pass', desc: 'Crossers pick off man defenders.',
    routes: { 2: { r: [[2, 0], [4, -30]], end: 'go' }, 3: { r: [[3, 0], [5, -30]], end: 'go' }, 4: { r: [[10, 0], [18, 8]], end: 'go' },
              1: { r: [[1, 5], [25, 8]], end: 'go' } } },
  { key: 'curls', form: 'gun', name: 'Curl Flat', type: 'pass', desc: 'Curls vs zone, slot runs the seam.',
    routes: { 2: { r: [[12, 0], [10, -1]], end: 'sit' }, 3: { r: [[12, 0], [10, -1]], end: 'sit' }, 4: { r: [[30, -1]], end: 'go' },
              1: { r: [[1, 5], [2, 9]], end: 'sit' } } },
  { key: 'pa', form: 'iform', name: 'PA Deep Shot', type: 'pass', desc: 'Fake the run, then bomb it.', fake: true,
    rb: { path: [[-3.6, 0.6], [0, 0.3]], end: 'block' },
    routes: { 2: { r: [[12, 0], [32, -10]], end: 'go' }, 3: { r: [[40, 0]], end: 'go' }, 4: { r: [[10, 0], [18, -14]], end: 'go' } } },
  { key: 'screen', form: 'gun', name: 'RB Screen', type: 'pass', desc: 'Let them rush, dump it to the RB.', screen: true,
    routes: { 2: { r: [[6, 0]], end: 'block' }, 3: { r: [[6, 0]], end: 'block' }, 4: { r: [[4, 0]], end: 'block' },
              1: { r: [[-1, 4], [-2, 9]], end: 'sit' } } },
  { key: 'qbdraw', form: 'gun', name: 'QB Draw', type: 'run', desc: 'Fake pass, then the QB takes off.', qbRun: true,
    routes: { 2: { r: [[15, 0]], end: 'go' }, 3: { r: [[15, 0]], end: 'go' }, 4: { r: [[8, 0]], end: 'block' } } },
  { key: 'sneak', form: 'goal', name: 'QB Sneak', type: 'run', desc: 'Under center, QB pushes forward. Need 1 yard? This.', qbRun: true, sneak: true },
  { key: 'power', form: 'iform', name: 'HB Power', type: 'run', desc: 'Guard pulls, RB follows him off tackle.', pull: true,
    rb: { path: [[-5, 0.5], [-1.5, 2.5], [1, 4], [10, 5]], end: 'go' }, wr: 'block' },
  // ---- page 2+ ----
  { key: 'dive', form: 'iform', name: 'HB Dive', type: 'run', desc: 'Quick hit straight ahead. Short yardage.',
    rb: { path: [[-3.4, 0.4], [1, 0.2], [10, 0]], end: 'go' }, wr: 'block' },
  { key: 'counter', form: 'gun', name: 'Counter', type: 'run', desc: 'Step one way, cut back the other.',
    rb: { path: [[-4.8, 4], [-3.6, 0.5], [0, -3], [9, -4.5]], end: 'go' }, wr: 'block', pull: true },
  { key: 'jet', form: 'gun', name: 'Jet Sweep', type: 'run', desc: 'Slot WR flies across and takes it.', carrier: 4,
    rb: { path: [[-2.6, 0.5], [-2.1, 5], [-0.4, 9.5], [3, 13.5], [14, 15]], end: 'go' }, wr: 'block', jet: true },
  { key: 'outs', form: 'gun', name: 'Quick Outs', type: 'pass', desc: 'Fast outs to the sideline. Safe.',
    routes: { 2: { r: [[5, 0], [5, 6]], end: 'sit' }, 3: { r: [[5, 0], [5, 6]], end: 'sit' }, 4: { r: [[6, 0], [6, -6]], end: 'sit' },
              1: { r: [[0, 5], [1, 10]], end: 'sit' } } },
  { key: 'bubble', form: 'trips', name: 'Bubble Screen', type: 'pass', desc: 'Toss it to the slot, WRs block.', quick: true,
    routes: { 2: { r: [[3, 0]], end: 'block' }, 3: { r: [[3, 0]], end: 'block' }, 4: { r: [[-1, 3], [0, 6]], end: 'sit' } } },
  { key: 'smash', form: 'gun', name: 'Smash', type: 'pass', desc: 'Hitches + a corner route over the top.',
    routes: { 2: { r: [[5, 0], [4, 0]], end: 'sit' }, 3: { r: [[5, 0], [4, 0]], end: 'sit' }, 4: { r: [[10, 0], [20, 9]], end: 'go' },
              1: { r: [[1, 5], [2, 10]], end: 'sit' } } },
  { key: 'ycross', form: 'trips', name: 'Y-Cross', type: 'pass', desc: 'Deep crosser + post. Beats zone.',
    routes: { 2: { r: [[10, 0], [24, -8]], end: 'go' }, 3: { r: [[12, 0], [10, -1]], end: 'sit' }, 4: { r: [[8, 0], [16, -24]], end: 'go' },
              1: { r: [[2, -2], [4, -3]], end: 'sit' } } },
  { key: 'drive', form: 'gun', name: 'Drive', type: 'pass', desc: 'Shallow cross under a dig.',
    routes: { 2: { r: [[12, 0], [12, -12]], end: 'sit' }, 3: { r: [[40, 0]], end: 'go' }, 4: { r: [[2, 0], [3, -22]], end: 'go' },
              1: { r: [[1, 5], [3, 9]], end: 'sit' } } },
  { key: 'flood', form: 'trips', name: 'Flood', type: 'pass', desc: 'Three levels to one side.',
    routes: { 2: { r: [[8, 0], [18, -20]], end: 'go' }, 3: { r: [[40, 0]], end: 'go' }, 4: { r: [[12, 0], [12, 8]], end: 'sit' },
              1: { r: [[1, 6], [3, 12]], end: 'sit' } } },
  { key: 'stopgo', form: 'empty', name: 'Stop & Go', type: 'pass', desc: 'Fake the hitch, then go deep. Double move!',
    routes: { 2: { r: [[6, 0], [5, 0], [40, 0]], end: 'go' }, 3: { r: [[6, 0], [5, 0], [40, 0]], end: 'go' }, 4: { r: [[30, -1]], end: 'go' },
              1: { r: [[1, -2], [3, -3]], end: 'sit' } } },
  { key: 'hail', form: 'gun', name: 'Hail Mary', type: 'pass', desc: 'Everybody to the end zone. Pray.',
    routes: { 2: { r: [[50, 6]], end: 'go' }, 3: { r: [[50, 6]], end: 'go' }, 4: { r: [[50, -2]], end: 'go' } } },
  // motion plays: the slot (#4) goes in motion across the formation before the snap and the play is built for him.
  // mroute: [yards downfield, yards in the direction he was moving] from wherever he is at the snap
  { key: 'mflat', form: 'gun', name: 'Motion Flat', type: 'pass', desc: 'Slot goes in motion and keeps running to the flat. Quick and easy.', motion: true,
    mroute: [[1, 2], [1.5, 4.5]], mend: 'sit',
    routes: { 2: { r: [[12, 0]], end: 'go' }, 3: { r: [[2, 0], [9, -7]], end: 'go' }, 4: { r: [[1, 2], [1.5, 4.5]], end: 'sit' }, 1: { r: [[2, -3], [5, -6]], end: 'sit' } } },
  { key: 'mwheel', form: 'gun', name: 'Motion Wheel', type: 'pass', desc: 'Motion man runs to the flat, then turns it up the sideline. Big play.', motion: true,
    mroute: [[1, 3], [4, 6], [30, 7]], mend: 'go',
    routes: { 2: { r: [[6, 0], [5, 0]], end: 'sit' }, 3: { r: [[10, 0], [18, -6]], end: 'go' }, 4: { r: [[1, 3], [4, 6], [30, 7]], end: 'go' }, 1: { r: [[2, -3], [5, -6]], end: 'sit' } } },
  { key: 'mdrag', form: 'gun', name: 'Motion Drag', type: 'pass', desc: 'Motion man snaps back underneath across the middle. Beats man.', motion: true,
    mroute: [[3, -2], [4, -12], [5, -22]], mend: 'go',
    routes: { 2: { r: [[12, 0], [12, 6]], end: 'sit' }, 3: { r: [[12, 0], [12, 6]], end: 'sit' }, 4: { r: [[3, -2], [4, -12], [5, -22]], end: 'go' }, 1: { r: [[1, 4], [2, 9]], end: 'sit' } } },
  { key: 'mseam', form: 'gun', name: 'Motion Seam', type: 'pass', desc: 'Motion man turns straight up the seam. Outside guys pull the corners away.', motion: true,
    mroute: [[3, 1], [28, 2]], mend: 'go',
    routes: { 2: { r: [[8, 0], [8, 7]], end: 'sit' }, 3: { r: [[8, 0], [8, 7]], end: 'sit' }, 4: { r: [[3, 1], [28, 2]], end: 'go' }, 1: { r: [[1, 4], [2, 9]], end: 'sit' } } },
  { key: 'kneel', form: 'goal', name: 'Kneel', type: 'run', desc: 'Victory formation. QB takes a knee, clock keeps running.', kneel: true }
];

// Formations: where each skill guy lines up. [yards behind the line, sideways offset] — positive offset = the wide side of the field.
const FORMATIONS = {
  gun:   { name: 'Shotgun', spots: { 0: [4, 0], 1: [5, 3.4], 2: [0.8, -16], 3: [0.8, 16], 4: [1.5, 8] } },
  iform: { name: 'I-Form', under: true, spots: { 0: [1.2, 0], 1: [6.5, 0], 2: [0.8, -16], 3: [0.8, 16], 4: [0.8, 4.4] } },
  trips: { name: 'Trips', spots: { 0: [4, 0], 1: [5, -3.4], 2: [1.5, 5.5], 3: [0.8, 16], 4: [1.5, 10.8] } },
  empty: { name: 'Empty', spots: { 0: [4.5, 0], 1: [1.5, -9], 2: [0.8, -16], 3: [0.8, 16], 4: [1.5, 8] } },
  goal:  { name: 'Goal Line', under: true, spots: { 0: [1.2, 0], 1: [5.5, 0], 2: [0.8, -6.5], 3: [0.8, 6.5], 4: [0.8, 3.6] } }
};
// near the goal line, runs come out in a heavy Goal Line set
function formationFor(play) {
  if (typeof G !== 'undefined' && G.goalToGo && G.los != null && play.type === 'run' && !play.toss && !play.jet && Math.abs(goalX(G.poss) - G.los) <= 4) return 'goal';
  return play.form || 'gun';
}

// Defensive calls. Assignment kinds:
//   rush            go after the QB / ball
//   man:N           cover offense slot N
//   zone:[d, y]     guard a spot (d yards past the line, y = field row 0..53; 'mid' = ball row)
//   spy             mirror the QB about 5 yards deep
const DEF_PLAYS = [
  { key: 'man', name: 'Man Coverage', desc: 'Lock up every receiver.',
    a: ['rush', 'rush', 'rush', 'man:1', 'spy', 'man:2', 'man:3', 'man:4'] },
  { key: 'c2', name: 'Cover 2', desc: 'Two deep, corners squat the flats.',
    a: ['rush', 'rush', 'rush', 'zone:7:-8', 'zone:7:8', 'zone:4:edgeT', 'zone:4:edgeB', 'zone:18:mid'] },
  { key: 'c3', name: 'Cover 3', desc: 'Three deep zones, LBs underneath.',
    a: ['rush', 'rush', 'rush', 'zone:6:-9', 'zone:6:9', 'zone:16:thirdT', 'zone:16:thirdB', 'zone:18:mid'] },
  { key: 'blitz', name: 'LB Blitz', desc: 'Send both linebackers. Risky!',
    a: ['rush', 'rush', 'rush', 'rush', 'rush', 'man:2', 'man:3', 'man:4'] },
  { key: 'run', name: 'Run Stuff', desc: 'Crash the line, stop the run.',
    a: ['rush', 'rush', 'rush', 'rush', 'spy', 'man:2', 'man:3', 'zone:8:mid'] },
  { key: 'cb', name: 'Corner Blitz', desc: 'Surprise heat off the edge.',
    a: ['rush', 'rush', 'rush', 'man:1', 'man:4', 'rush', 'man:3', 'man:2'] },
  { key: 'prevent', name: 'Prevent', desc: 'Nothing deep. Give up short stuff.',
    a: ['rush', 'rush', 'zone:4:mid', 'zone:10:-10', 'zone:10:10', 'zone:22:thirdT', 'zone:22:thirdB', 'zone:28:mid'] },
  { key: 'alldrop', name: 'All Drop', desc: 'Nobody rushes. Everyone drops into coverage. 4th down lock!',
    a: ['zone:4:-5', 'zone:4:5', 'zone:6:mid', 'zone:9:-10', 'zone:9:10', 'zone:16:thirdT', 'zone:16:thirdB', 'zone:22:mid'] },
  // ---- page 2 ----
  { key: 'c1', name: 'Cover 1', desc: 'Man everywhere, one safety deep.',
    a: ['rush', 'rush', 'rush', 'man:1', 'man:4', 'man:2', 'man:3', 'zone:18:mid'] },
  { key: 'c4', name: 'Cover 4', desc: 'Four deep quarters. Stops the bomb.',
    a: ['rush', 'rush', 'rush', 'zone:6:-8', 'zone:6:8', 'zone:15:thirdT', 'zone:15:thirdB', 'zone:17:mid'] },
  { key: 'tampa', name: 'Tampa 2', desc: 'Middle LB runs deep down the seam.',
    a: ['rush', 'rush', 'rush', 'zone:12:mid', 'zone:6:9', 'zone:5:edgeT', 'zone:5:edgeB', 'zone:18:-6'] },
  { key: 'fire', name: 'Fire Zone', desc: 'A DL drops, LBs blitz. Confuse him!',
    a: ['rush', 'zone:5:-6', 'rush', 'rush', 'rush', 'zone:14:thirdT', 'zone:14:thirdB', 'zone:16:mid'] },
  { key: 'c0', name: 'Cover 0', desc: 'Everybody blitzes, pure man. All or nothing.',
    a: ['rush', 'rush', 'rush', 'rush', 'man:1', 'man:2', 'man:3', 'man:4'] }
];

const SPECIAL_PLAYS = [
  { key: 'punt', name: 'Punt', special: true, desc: 'Boot it away. Flip the field.' },
  { key: 'fg', name: 'Field Goal', special: true, desc: 'Try for 3 points.' }
];

// play art for the play cards (drawn at 4x so it stays sharp when the card is big)
const ROUTE_COL = ['#3d8bff', '#ff4d4d', '#33d17a', '#ffb02e']; // same colors as the 1-4 throw icons in the game
function pdArrow(g, x0, y0, x1, y1, col, s = 3.2) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.fillStyle = col; g.beginPath(); g.moveTo(x1 + Math.cos(a) * 1.2, y1 + Math.sin(a) * 1.2);
  g.lineTo(x1 - Math.cos(a - 0.5) * s, y1 - Math.sin(a - 0.5) * s); g.lineTo(x1 - Math.cos(a + 0.5) * s, y1 - Math.sin(a + 0.5) * s); g.closePath(); g.fill();
}
function pdPath(g, pts, col, w, end) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
  const n = pts.length; if (n < 2) return;
  const [x0, y0] = pts[n - 2], [x1, y1] = pts[n - 1];
  if (end === 'sit') { const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1 - Math.sin(a) * 2.6, y1 + Math.cos(a) * 2.6); g.lineTo(x1 + Math.sin(a) * 2.6, y1 - Math.cos(a) * 2.6); g.stroke(); }
  else pdArrow(g, x0, y0, x1, y1, col, 3 + w * 0.4);
}
function drawPlayDiagram(cv, play, isOff) {
  const g = cv.getContext('2d'), S = cv.width / 120, W = 120, H = 72;
  g.setTransform(S, 0, 0, S, 0, 0); g.clearRect(0, 0, W, H);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2f7436'); bg.addColorStop(1, '#265f2c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const losX = 32, sx = 2.1, sy = 1.25, cy = H / 2;
  const P = (d, y) => [losX + d * sx, clamp(cy + y * sy, 3.5, H - 3.5)]; // routes stay inside the card
  // yard lines every 5 yards
  g.strokeStyle = '#ffffff16'; g.lineWidth = 0.6;
  for (let d = -10; d <= 40; d += 5) { const x = losX + d * sx; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  g.strokeStyle = '#ffffff70'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(losX, 2); g.lineTo(losX, H - 2); g.stroke();
  if (play.special) {
    const lbl = { punt: 'PUNT', ko: 'KICKOFF', onside: 'ONSIDE', fakepunt: 'FAKE PUNT', fakefg: 'FAKE FG', kneel: 'KNEEL' }[play.key] || 'FIELD GOAL';
    if (lbl === 'FIELD GOAL') { // uprights
      g.strokeStyle = '#f6c31c'; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(96, 48); g.lineTo(96, 36); g.moveTo(84, 36); g.lineTo(108, 36); g.moveTo(84, 36); g.lineTo(84, 16); g.moveTo(108, 36); g.lineTo(108, 16); g.stroke();
      g.setLineDash([2, 2.5]); g.strokeStyle = '#ffffffb0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(26, 50); g.quadraticCurveTo(62, 2, 96, 24); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = '#fff'; g.font = "italic 900 17px 'Barlow Condensed', sans-serif"; g.textAlign = lbl === 'FIELD GOAL' ? 'left' : 'center'; g.textBaseline = 'middle';
    g.fillText(lbl, lbl === 'FIELD GOAL' ? 6 : W / 2, lbl === 'FIELD GOAL' ? 62 : H / 2 + 1);
    return;
  }
  const dot = (x, y, fill, sq) => { g.fillStyle = fill; g.strokeStyle = '#0b0f16'; g.lineWidth = 0.9; g.beginPath(); if (sq) g.rect(x - 2.6, y - 2.6, 5.2, 5.2); else g.arc(x, y, 2.9, 0, 7); g.fill(); g.stroke(); };
  if (isOff) {
    const F = FORMATIONS[play.form || 'gun'], spots = { 5: [-0.7, -4.8], 6: [-0.7, 0], 7: [-0.7, 4.8] };
    for (const k in F.spots) spots[k] = [-F.spots[k][0], F.spots[k][1] * 1.5];
    // blockers: short T in front of them
    const blockT = (x, y) => { g.strokeStyle = '#ffffff99'; g.lineWidth = 1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + 5.8, y); g.moveTo(x + 5.8, y - 1.8); g.lineTo(x + 5.8, y + 1.8); g.stroke(); };
    for (const s in spots) {
      const [d, y] = spots[s], [px, py] = P(d, y);
      const route = play.routes && play.routes[s];
      if (+s >= 5) blockT(px, py);
      else if (+s >= 1 && route && route.end !== 'block') {
        const out = y === 0 ? 1 : Math.sign(y), key = +s === 1 ? 4 : +s - 1;
        const pts = [[px, py]];
        for (const [dd, oo] of route.r) pts.push(P(d + Math.min(dd, 30), y + oo * out));
        pdPath(g, pts, ROUTE_COL[key - 1], 1.5, route.end);
      } else if (+s >= 2 && (play.wr === 'block' || (route && route.end === 'block'))) blockT(px, py);
    }
    const runner = play.rb && play.rb.path;
    if (runner) {
      const c = spots[play.carrier || 1], pts = [P(c[0], c[1])];
      for (const [d, w] of runner) pts.push(P(Math.min(d, 26), w * 1.5));
      if (play.fake) { g.setLineDash([2.5, 2]); pdPath(g, pts, '#ffffff90', 1.3, 'go'); g.setLineDash([]); }
      else pdPath(g, pts, '#ff8a3d', 2.1, 'go');
    }
    if (play.qbRun) pdPath(g, [P(spots[0][0], 0), P(16, 0)], '#ff8a3d', 2.1, 'go');
    for (const s in spots) { const [px, py] = P(...spots[s]); dot(px, py, +s === 0 ? '#f6c31c' : '#ffffff', +s >= 5); }
    g.fillStyle = '#ffffffa0'; g.font = "800 7px 'Barlow Condensed', sans-serif"; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(F.name.toUpperCase(), 3, H - 3);
  } else {
    const spots = [[1.2, -4], [1.2, 0], [1.2, 4], [5, -6], [5, 6], [6, -24], [6, 24], [13, 0]];
    // zones first (under everything)
    play.a.forEach((a, i) => {
      if (!a.startsWith('zone')) return;
      const z = a.split(':'), zd = +z[1]; let zy = z[2];
      zy = zy === 'mid' ? 0 : zy === 'edgeT' ? -20 : zy === 'edgeB' ? 20 : zy === 'thirdT' ? -16 : zy === 'thirdB' ? 16 : +zy;
      const [zx, zz] = P(Math.min(zd, 30), zy), deep = zd >= 12, col = deep ? '61,139,255' : '255,210,63';
      g.fillStyle = `rgba(${col},0.28)`; g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = 0.9;
      g.beginPath(); g.ellipse(zx, zz, deep ? 11 : 9, deep ? 8 : 6.5, 0, 0, 7); g.fill(); g.stroke();
      const [px, py] = P(...spots[i]); g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = 1.1; g.beginPath(); g.moveTo(px, py); g.lineTo(zx, zz); g.stroke();
    });
    play.a.forEach((a, i) => {
      const [px, py] = P(...spots[i]);
      if (a === 'rush') pdPath(g, [[px, py], P(-4.5, spots[i][1] * 0.3)], '#ff4d4d', 1.5, 'go');
      else if (a === 'spy') { g.strokeStyle = '#c08cff'; g.lineWidth = 1.1; g.beginPath(); g.arc(px, py, 5.5, 0, 7); g.stroke(); }
      else if (a.startsWith('man')) { g.setLineDash([1.8, 1.6]); pdPath(g, [[px, py], [px - 7, py]], '#c08cff', 1.2, 'go'); g.setLineDash([]); }
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(px - 2.3, py - 2.3); g.lineTo(px + 2.3, py + 2.3); g.moveTo(px + 2.3, py - 2.3); g.lineTo(px - 2.3, py + 2.3); g.stroke();
    });
  }
}
