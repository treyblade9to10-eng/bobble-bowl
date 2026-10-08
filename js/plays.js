// ---- Playbook ----
// Offense slots: 0 QB, 1 RB, 2 WR1 (top wide), 3 WR2 (bottom wide), 4 WR3 (slot), 5-7 OL
// Defense slots: 0-2 DL, 3-4 LB, 5 CB1 (vs WR1), 6 CB2 (vs WR2), 7 S
//
// Receiver routes: list of [downfield, out] steps measured from where the player lines up.
//   "out" is toward that player's own sideline (negative = toward the middle).
//   end: 'go' keeps running the last direction, 'sit' stops and waits for the ball.
// RB "path" uses field spots: [yards from line of scrimmage (negative = backfield), wide-side offset].

const OFF_PLAYS = [
  { key: 'zone', name: 'Inside Zone', type: 'run', desc: 'Handoff right up the gut.',
    rb: { path: [[-3.6, 0.6], [0.5, 0.4], [10, 0]], end: 'go' }, wr: 'block' },
  { key: 'toss', name: 'Toss Sweep', type: 'run', desc: 'Pitch it outside and race the edge.',
    rb: { path: [[-4, 5], [-2.5, 11], [4, 15], [14, 16]], end: 'go' }, wr: 'block', toss: true },
  { key: 'slants', name: 'Slants', type: 'pass', desc: 'Quick slants. Get it out fast!',
    routes: { 2: { r: [[2, 0], [9, -7]], end: 'go' }, 3: { r: [[2, 0], [9, -7]], end: 'go' }, 4: { r: [[5, 0], [6, 5]], end: 'sit' },
              1: { r: [[1, 4], [2, 9]], end: 'sit' } } },
  { key: 'verts', name: 'Four Verts', type: 'pass', desc: 'Everybody go deep. Big play hunting.',
    routes: { 2: { r: [[40, 0]], end: 'go' }, 3: { r: [[40, 0]], end: 'go' }, 4: { r: [[3, 0], [40, -2]], end: 'go' },
              1: { r: [[1, -2], [3, -3]], end: 'sit' } } },
  { key: 'mesh', name: 'Mesh', type: 'pass', desc: 'Crossers pick off man defenders.',
    routes: { 2: { r: [[2, 0], [4, -30]], end: 'go' }, 3: { r: [[3, 0], [5, -30]], end: 'go' }, 4: { r: [[10, 0], [18, 8]], end: 'go' },
              1: { r: [[1, 5], [25, 8]], end: 'go' } } },
  { key: 'curls', name: 'Curl Flat', type: 'pass', desc: 'Curls vs zone, slot runs the seam.',
    routes: { 2: { r: [[12, 0], [10, -1]], end: 'sit' }, 3: { r: [[12, 0], [10, -1]], end: 'sit' }, 4: { r: [[30, -1]], end: 'go' },
              1: { r: [[1, 5], [2, 9]], end: 'sit' } } },
  { key: 'pa', name: 'PA Deep Shot', type: 'pass', desc: 'Fake the run, then bomb it.', fake: true,
    rb: { path: [[-3.6, 0.6], [0, 0.3]], end: 'block' },
    routes: { 2: { r: [[12, 0], [32, -10]], end: 'go' }, 3: { r: [[40, 0]], end: 'go' }, 4: { r: [[10, 0], [18, -14]], end: 'go' } } },
  { key: 'screen', name: 'RB Screen', type: 'pass', desc: 'Let them rush, dump it to the RB.', screen: true,
    routes: { 2: { r: [[6, 0]], end: 'block' }, 3: { r: [[6, 0]], end: 'block' }, 4: { r: [[4, 0]], end: 'block' },
              1: { r: [[-1, 4], [-2, 9]], end: 'sit' } } },
  { key: 'qbdraw', name: 'QB Draw', type: 'run', desc: 'Fake pass, then the QB takes off.', qbRun: true,
    routes: { 2: { r: [[15, 0]], end: 'go' }, 3: { r: [[15, 0]], end: 'go' }, 4: { r: [[8, 0]], end: 'block' } } },
  // ---- page 2+ ----
  { key: 'dive', name: 'HB Dive', type: 'run', desc: 'Quick hit straight ahead. Short yardage.',
    rb: { path: [[-3.4, 0.4], [1, 0.2], [10, 0]], end: 'go' }, wr: 'block' },
  { key: 'counter', name: 'Counter', type: 'run', desc: 'Step one way, cut back the other.',
    rb: { path: [[-4.6, 4.5], [-3.6, 1], [0.5, -3.5], [9, -5]], end: 'go' }, wr: 'block' },
  { key: 'jet', name: 'Jet Sweep', type: 'run', desc: 'Slot WR flies across and takes it.', carrier: 4,
    rb: { path: [[-3.4, 2.2], [-3.4, -2], [-1, -10], [6, -15], [14, -16]], end: 'go' }, wr: 'block' },
  { key: 'outs', name: 'Quick Outs', type: 'pass', desc: 'Fast outs to the sideline. Safe.',
    routes: { 2: { r: [[5, 0], [5, 6]], end: 'sit' }, 3: { r: [[5, 0], [5, 6]], end: 'sit' }, 4: { r: [[6, 0], [6, -6]], end: 'sit' },
              1: { r: [[0, 5], [1, 10]], end: 'sit' } } },
  { key: 'bubble', name: 'Bubble Screen', type: 'pass', desc: 'Toss it to the slot, WRs block.', quick: true,
    routes: { 2: { r: [[3, 0]], end: 'block' }, 3: { r: [[3, 0]], end: 'block' }, 4: { r: [[-1, 3], [0, 6]], end: 'sit' } } },
  { key: 'smash', name: 'Smash', type: 'pass', desc: 'Hitches + a corner route over the top.',
    routes: { 2: { r: [[5, 0], [4, 0]], end: 'sit' }, 3: { r: [[5, 0], [4, 0]], end: 'sit' }, 4: { r: [[10, 0], [20, 9]], end: 'go' },
              1: { r: [[1, 5], [2, 10]], end: 'sit' } } },
  { key: 'ycross', name: 'Y-Cross', type: 'pass', desc: 'Deep crosser + post. Beats zone.',
    routes: { 2: { r: [[10, 0], [24, -8]], end: 'go' }, 3: { r: [[12, 0], [10, -1]], end: 'sit' }, 4: { r: [[8, 0], [16, -24]], end: 'go' },
              1: { r: [[2, -2], [4, -3]], end: 'sit' } } },
  { key: 'drive', name: 'Drive', type: 'pass', desc: 'Shallow cross under a dig.',
    routes: { 2: { r: [[12, 0], [12, -12]], end: 'sit' }, 3: { r: [[40, 0]], end: 'go' }, 4: { r: [[2, 0], [3, -22]], end: 'go' },
              1: { r: [[1, 5], [3, 9]], end: 'sit' } } },
  { key: 'flood', name: 'Flood', type: 'pass', desc: 'Three levels to one side.',
    routes: { 2: { r: [[8, 0], [18, -20]], end: 'go' }, 3: { r: [[40, 0]], end: 'go' }, 4: { r: [[12, 0], [12, 8]], end: 'sit' },
              1: { r: [[1, 6], [3, 12]], end: 'sit' } } },
  { key: 'stopgo', name: 'Stop & Go', type: 'pass', desc: 'Fake the hitch, then go deep. Double move!',
    routes: { 2: { r: [[6, 0], [5, 0], [40, 0]], end: 'go' }, 3: { r: [[6, 0], [5, 0], [40, 0]], end: 'go' }, 4: { r: [[30, -1]], end: 'go' },
              1: { r: [[1, -2], [3, -3]], end: 'sit' } } },
  { key: 'hail', name: 'Hail Mary', type: 'pass', desc: 'Everybody to the end zone. Pray.',
    routes: { 2: { r: [[50, 6]], end: 'go' }, 3: { r: [[50, 6]], end: 'go' }, 4: { r: [[50, -2]], end: 'go' } } }
];

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

// mini whiteboard drawings for the play cards
function drawPlayDiagram(cv, play, isOff) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#3a8a3c'; g.fillRect(0, 0, W, H);
  const losX = 34, sx = 2.1, sy = 1.25, cy = H / 2;
  const P = (d, y) => [losX + d * sx, cy + y * sy];
  g.strokeStyle = '#fff6'; g.lineWidth = 1; g.beginPath(); g.moveTo(losX, 0); g.lineTo(losX, H); g.stroke();
  if (play.special) {
    g.fillStyle = '#fff'; g.font = "italic 900 26px 'Barlow Condensed', sans-serif"; g.textAlign = 'center';
    g.fillText({ punt: 'PUNT', ko: 'DEEP', onside: 'ONSIDE', fakepunt: 'FAKE', fakefg: 'FAKE' }[play.key] || 'FG', W / 2, H / 2 + 9);
    return;
  }
  if (isOff) {
    const spots = { 0: [-4, 0], 1: [-4, 6], 2: [-0.6, -24], 3: [-0.6, 24], 4: [-1.5, -14], 5: [-0.7, -4], 6: [-0.7, 0], 7: [-0.7, 4] };
    g.lineWidth = 2;
    for (const s in spots) {
      const [d, y] = spots[s];
      const route = play.routes && play.routes[s];
      if (route && route.end !== 'block') {
        const out = y === 0 ? 1 : Math.sign(y);
        g.strokeStyle = s == 1 ? '#7fd3ff' : '#ffe14d'; g.beginPath();
        let [x0, y0] = P(d, y); g.moveTo(x0, y0); let cd = d, cyy = y;
        for (const [dd, oo] of route.r) { cd = d + Math.min(dd, 30); cyy = y + oo * out; const [px, py] = P(cd, cyy); g.lineTo(px, py); }
        g.stroke();
      }
      g.fillStyle = s == 0 ? '#ff5050' : '#fff';
      const [px, py] = P(d, y); g.beginPath(); g.arc(px, py, 3.2, 0, 7); g.fill();
    }
    const runner = play.rb && play.rb.path;
    if (runner) {
      const jet = play.carrier === 4, sgn = jet ? -1 : 1;
      g.strokeStyle = play.fake ? '#fff8' : '#ff8a3d'; g.setLineDash(play.fake ? [3, 3] : []); g.lineWidth = 2.5;
      g.beginPath(); let [x0, y0] = jet ? P(-1.5, -14) : P(-4, 6); g.moveTo(x0, y0);
      for (const [d, w] of runner) { const [px, py] = P(Math.min(d, 26), sgn * w * 1.4); g.lineTo(px, py); }
      g.stroke(); g.setLineDash([]);
    }
    if (play.qbRun) { g.strokeStyle = '#ff8a3d'; g.lineWidth = 2.5; g.beginPath(); let [a, b] = P(-4, 0); g.moveTo(a, b); [a, b] = P(16, 0); g.lineTo(a, b); g.stroke(); }
  } else {
    const spots = [[1.2, -4], [1.2, 0], [1.2, 4], [5, -6], [5, 6], [6, -24], [6, 24], [13, 0]];
    play.a.forEach((a, i) => {
      const [d, y] = spots[i]; const [px, py] = P(d, y);
      g.lineWidth = 2;
      if (a === 'rush') { g.strokeStyle = '#ff5050'; g.beginPath(); g.moveTo(px, py); const [qx, qy] = P(-4, y * 0.3); g.lineTo(qx, qy); g.stroke(); }
      else if (a.startsWith('zone')) {
        const z = a.split(':'); const zd = +z[1]; let zy = z[2];
        zy = zy === 'mid' ? 0 : zy === 'edgeT' ? -20 : zy === 'edgeB' ? 20 : zy === 'thirdT' ? -16 : zy === 'thirdB' ? 16 : +zy;
        const [zx, zz] = P(Math.min(zd, 30), zy);
        g.strokeStyle = '#7fd3ff'; g.beginPath(); g.moveTo(px, py); g.lineTo(zx, zz); g.stroke();
        g.fillStyle = '#7fd3ff55'; g.beginPath(); g.ellipse(zx, zz, 9, 6, 0, 0, 7); g.fill();
      } else if (a === 'spy') { g.strokeStyle = '#d58cff'; g.beginPath(); g.arc(px, py, 6, 0, 7); g.stroke(); }
      else { g.strokeStyle = '#ffe14d'; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(px, py); g.lineTo(px + 8, py); g.stroke(); g.setLineDash([]); }
      g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('X', px, py + 3);
    });
  }
}
