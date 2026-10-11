// ---- Team logos: our own cartoon emblems (not the real NFL marks), drawn with canvas ----
// Logo.draw(g, team, x, y, size) draws one centered at x,y. Logo.canvas(team, px) = cached image. Logo.url(team, px) = data URL for HTML.
const Logo = (() => {
  const O = '#14110f';
  const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); };
  const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); };
  const fs = (g, fill, w = 3) => { g.fillStyle = fill; g.fill(); g.lineWidth = w; g.strokeStyle = O; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  // a fat cartoon stroke: dark outline, then color on top
  const fat = (g, path, w, col) => { g.lineCap = 'round'; g.lineJoin = 'round'; path(); g.strokeStyle = O; g.lineWidth = w + 6; g.stroke(); path(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
  const eyes = (g, y, gap, r, mad = true) => {
    for (const s of [-1, 1]) {
      circ(g, s * gap, y, r); fs(g, '#fff', 2);
      circ(g, s * gap + s * -r * 0.15, y + r * 0.1, r * 0.5); g.fillStyle = '#111'; g.fill();
      if (mad) { g.strokeStyle = O; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * (gap + r * 1.2), y - r * 1.5); g.lineTo(s * (gap - r * 1.1), y - r * 0.55); g.stroke(); }
    }
  };
  const sideEye = (g, x, y, r) => {
    circ(g, x, y, r); fs(g, '#fff', 2); circ(g, x + r * 0.3, y + r * 0.05, r * 0.5); g.fillStyle = '#111'; g.fill();
    g.strokeStyle = O; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - r * 1.3, y - r * 1.5); g.lineTo(x + r * 1.3, y - r * 0.6); g.stroke();
  };
  const fangs = (g, y, gap) => { for (const s of [-1, 1]) { poly(g, [[s * gap - 3.5, y], [s * gap + 3.5, y], [s * gap, y + 8]]); fs(g, '#fff', 1.5); } };
  const lite = '#f3e6cf';

  // ---------- the icons (drawn in a box from -50 to 50) ----------
  const I = {
    cat(g, c, o) { // big cat head: lion (mane), tiger (stripes), jaguar (spots), panther (plain)
      if (o.mane) { const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, r = i % 2 ? 40 : 49; pts.push([Math.cos(a) * r, Math.sin(a) * r + 2]); } poly(g, pts); fs(g, o.mane); }
      for (const s of [-1, 1]) { poly(g, [[s * 34, -6], [s * 30, -42], [s * 10, -28]]); fs(g, o.base); poly(g, [[s * 28, -12], [s * 27, -34], [s * 15, -26]]); g.fillStyle = '#f2a9a0'; g.fill(); }
      ell(g, 0, 3, 34, 32); fs(g, o.base);
      if (o.stripes) { g.strokeStyle = o.stripes; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath();
        g.moveTo(-6, -27); g.lineTo(-3, -16); g.moveTo(6, -27); g.lineTo(3, -16); g.moveTo(0, -29); g.lineTo(0, -20);
        for (const s of [-1, 1]) { g.moveTo(s * 33, 0); g.lineTo(s * 22, 4); g.moveTo(s * 32, 10); g.lineTo(s * 23, 12); g.moveTo(s * 28, -14); g.lineTo(s * 20, -9); }
        g.stroke(); }
      if (o.spots) { g.fillStyle = o.spots; for (const [x, y, r] of [[-20, -18, 3.5], [20, -18, 3.5], [-26, 4, 3], [26, 4, 3], [-8, -24, 2.6], [8, -24, 2.6], [-22, 18, 2.6], [22, 18, 2.6]]) { circ(g, x, y, r); g.fill(); } }
      ell(g, 0, 17, 17, 12); fs(g, o.muzzle || lite, 2.5);
      poly(g, [[-7, 7], [7, 7], [0, 14]]); fs(g, '#2a1a14', 2);
      g.strokeStyle = O; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 20); g.moveTo(-8, 22); g.quadraticCurveTo(0, 26, 8, 22); g.stroke();
      fangs(g, 23, 6);
      eyes(g, -8, 13, 7);
      if (o.eye) for (const s of [-1, 1]) { circ(g, s * 13 + s * -1, -7, 3.3); g.fillStyle = o.eye; g.fill(); }
    },
    bear(g, c, o) {
      for (const s of [-1, 1]) { circ(g, s * 27, -27, 13); fs(g, o.base); circ(g, s * 27, -27, 6); g.fillStyle = shade(o.base, 0.25); g.fill(); }
      ell(g, 0, 4, 36, 33); fs(g, o.base);
      ell(g, 0, 17, 17, 13); fs(g, o.muzzle || '#c79a6b', 2.5);
      ell(g, 0, 9, 8, 5.5); fs(g, '#1a1210', 2);
      g.strokeStyle = O; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 20); g.moveTo(-8, 24); g.quadraticCurveTo(0, 20, 8, 24); g.stroke();
      fangs(g, 23, 5);
      eyes(g, -8, 14, 7);
    },
    dog(g, c, o) {
      ell(g, 0, 2, 32, 34); fs(g, o.base);
      for (const s of [-1, 1]) { ell(g, s * 32, 2, 11, 25, s * -0.25); fs(g, shade(o.base, -0.3)); }
      ell(g, 0, 20, 19, 14); fs(g, o.muzzle || lite, 2.5);
      ell(g, 0, 11, 9, 6); fs(g, '#1a1210', 2);
      g.strokeStyle = O; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-9, 25); g.quadraticCurveTo(0, 30, 9, 25); g.stroke();
      fangs(g, 26, 6);
      eyes(g, -9, 13, 7);
      g.fillStyle = o.collar; g.fillRect(-26, 33, 52, 7); g.strokeStyle = O; g.lineWidth = 2.5; g.strokeRect(-26, 33, 52, 7);
    },
    bird(g, c, o) { // bird head facing right: raven, falcon, eagle, cardinal, seahawk
      if (o.crest) { poly(g, [[-18, -24], [-26, -50], [-8, -30], [-10, -54], [4, -30]]); fs(g, o.base); }
      poly(g, [[-40, 18], [-46, -4], [-30, -6], [-42, -22], [-22, -18], [-26, -34], [-8, -26], [-30, 30]]); fs(g, o.back || shade(o.base, -0.25));
      ell(g, -4, 0, 32, 30); fs(g, o.base);
      if (o.face) { ell(g, 4, 6, 20, 18); g.fillStyle = o.face; g.fill(); }
      // hooked beak
      g.beginPath(); g.moveTo(16, -10); g.quadraticCurveTo(44, -12, 50, 6); g.quadraticCurveTo(44, 2, 40, 6); g.lineTo(16, 14); g.closePath(); fs(g, o.beak || '#f2b21b');
      g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.moveTo(18, 4); g.lineTo(38, 3); g.stroke();
      if (o.mask) { poly(g, [[-4, -14], [20, -12], [16, 0], [-6, -2]]); g.fillStyle = o.mask; g.fill(); }
      sideEye(g, 7, -6, 6.5);
      if (o.eye) { circ(g, 9, -6, 3); g.fillStyle = o.eye; g.fill(); }
    },
    horse(g, c, o) { // horse head facing right with a flowing mane
      const head = [[-26, 46], [-32, 6], [-22, -24], [-16, -46], [-6, -30], [6, -28], [36, 2], [44, 16], [36, 28], [18, 26], [2, 22], [-4, 46]];
      poly(g, head); fs(g, o.base);
      poly(g, [[-22, -24], [-38, -22], [-30, -10], [-46, -2], [-34, 8], [-48, 20], [-34, 24], [-44, 40], [-26, 46], [-32, 6]]); fs(g, o.mane);
      ell(g, 38, 16, 3, 4); g.fillStyle = '#111'; g.fill();
      g.strokeStyle = O; g.lineWidth = 2.5; g.beginPath(); g.moveTo(22, 24); g.quadraticCurveTo(30, 20, 40, 24); g.stroke();
      sideEye(g, 4, -12, 6);
    },
    horseshoe(g, c, o) {
      const path = () => { g.beginPath(); g.arc(0, -4, 28, Math.PI * 0.82, Math.PI * 2.18); };
      fat(g, path, 20, o.base);
      g.fillStyle = O; for (const a of [0.95, 1.2, 1.5, 1.8, 2.05]) { circ(g, Math.cos(a * Math.PI) * 28, -4 + Math.sin(a * Math.PI) * 28, 2.6); g.fill(); }
    },
    bison(g, c, o) { // side view, charging left
      poly(g, [[-44, 4], [-40, -18], [-26, -34], [-4, -40], [18, -34], [34, -22], [46, -6], [46, 14], [38, 22], [-30, 24], [-42, 18]]); fs(g, o.base);
      poly(g, [[-44, 4], [-40, -18], [-26, -34], [-14, -36], [-12, 10], [-30, 26], [-42, 18]]); fs(g, shade(o.base, -0.28));
      for (const x of [-26, -10, 22, 36]) { g.fillStyle = shade(o.base, -0.2); g.strokeStyle = O; g.lineWidth = 3; g.fillRect(x - 4, 20, 8, 18); g.strokeRect(x - 4, 20, 8, 18); }
      g.beginPath(); g.moveTo(-30, -24); g.quadraticCurveTo(-44, -36, -34, -46); g.quadraticCurveTo(-38, -32, -24, -28); g.closePath(); fs(g, lite, 2.5);
      sideEye(g, -32, -10, 4.5);
      if (o.streak) { poly(g, [[-6, -30], [44, -16], [44, -8], [-4, -20]]); g.fillStyle = o.streak; g.fill(); }
    },
    ram(g, c, o) {
      for (const s of [-1, 1]) { // curled horns
        const m = a => s > 0 ? a : Math.PI - a; // mirror angles for the left horn
        const path = () => { g.beginPath(); g.arc(s * 26, -4, 17, m(-2.6), m(1.4), s < 0); };
        fat(g, path, 13, o.horn);
        g.strokeStyle = shade(o.horn, -0.35); g.lineWidth = 2; for (let k = 0; k < 4; k++) { const a = m(-2.2 + k * 0.65); g.beginPath(); g.moveTo(s * 26 + Math.cos(a) * 11, -4 + Math.sin(a) * 11); g.lineTo(s * 26 + Math.cos(a) * 23, -4 + Math.sin(a) * 23); g.stroke(); }
      }
      g.beginPath(); g.moveTo(-16, -28); g.quadraticCurveTo(0, -38, 16, -28); g.lineTo(13, 22); g.quadraticCurveTo(0, 38, -13, 22); g.closePath(); fs(g, o.base);
      ell(g, 0, 26, 10, 7); fs(g, shade(o.base, 0.25), 2.5);
      for (const s of [-1, 1]) { ell(g, s * 4, 25, 2, 2.5); g.fillStyle = '#111'; g.fill(); }
      eyes(g, -6, 8, 5.5);
    },
    bull(g, c, o) {
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 20, -16); g.quadraticCurveTo(s * 48, -18, s * 46, -44); g.quadraticCurveTo(s * 40, -24, s * 18, -28); g.closePath(); fs(g, lite); }
      for (const s of [-1, 1]) { ell(g, s * 28, -10, 9, 6, s * 0.4); fs(g, o.base); }
      g.beginPath(); g.moveTo(-22, -26); g.quadraticCurveTo(0, -36, 22, -26); g.lineTo(18, 16); g.quadraticCurveTo(0, 30, -18, 16); g.closePath(); fs(g, o.base);
      ell(g, 0, 22, 16, 11); fs(g, shade(o.base, 0.3), 2.5);
      for (const s of [-1, 1]) { ell(g, s * 6, 22, 2.5, 3.5); g.fillStyle = '#111'; g.fill(); }
      g.strokeStyle = '#d9d9d9'; g.lineWidth = 3; g.beginPath(); g.arc(0, 30, 6, 0.1, Math.PI - 0.1); g.stroke();
      eyes(g, -6, 10, 6);
      if (o.star) { g.fillStyle = o.star; starPath(g, 0, -18, 7); g.fill(); }
    },
    dolphin(g, c, o) {
      if (o.sun) { circ(g, 4, 6, 34); fs(g, o.sun, 3); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.strokeStyle = o.sun; g.lineWidth = 4; g.beginPath(); g.moveTo(4 + Math.cos(a) * 38, 6 + Math.sin(a) * 38); g.lineTo(4 + Math.cos(a) * 46, 6 + Math.sin(a) * 46); g.stroke(); } }
      g.beginPath(); g.moveTo(-34, 30); g.lineTo(-48, 22); g.lineTo(-40, 36); g.lineTo(-44, 48); g.lineTo(-30, 38); g.closePath(); fs(g, o.base); // tail
      poly(g, [[-6, -28], [6, -48], [12, -26]]); fs(g, o.base); // fin
      const body = () => { g.beginPath(); g.moveTo(-32, 32); g.quadraticCurveTo(-24, -34, 24, -18); g.quadraticCurveTo(40, -10, 46, 2); };
      fat(g, body, 22, o.base);
      g.strokeStyle = '#f2f6f8'; g.lineWidth = 7; g.beginPath(); g.moveTo(-22, 26); g.quadraticCurveTo(-12, -10, 26, -6); g.stroke();
      sideEye(g, 26, -18, 4.5);
      g.strokeStyle = O; g.lineWidth = 2.5; g.beginPath(); g.moveTo(34, -4); g.quadraticCurveTo(40, 0, 46, 2); g.stroke();
    },
    jet(g, c, o) {
      g.save(); g.rotate(-0.5);
      poly(g, [[48, 0], [36, -6], [-30, -6], [-44, -3], [-44, 3], [-30, 6], [36, 6]]); fs(g, o.base);
      poly(g, [[10, -6], [-14, -40], [-24, -40], [-12, -6]]); fs(g, o.wing);
      poly(g, [[10, 6], [-14, 40], [-24, 40], [-12, 6]]); fs(g, o.wing);
      poly(g, [[-30, -5], [-44, -20], [-48, -20], [-42, -4]]); fs(g, o.wing);
      poly(g, [[-30, 5], [-44, 20], [-48, 20], [-42, 4]]); fs(g, o.wing);
      ell(g, 30, 0, 7, 3.5); g.fillStyle = '#9fd3ff'; g.fill();
      g.restore();
      g.strokeStyle = '#ffffffaa'; g.lineWidth = 3; g.lineCap = 'round'; for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(-40 - k * 2, 28 + k * 7); g.lineTo(-22 - k * 2, 18 + k * 7); g.stroke(); }
    },
    bolt(g, c, o) { poly(g, [[14, -48], [-26, 6], [-2, 6], [-14, 48], [28, -12], [4, -12], [20, -48]]); fs(g, o.base, 3.5); poly(g, [[12, -40], [-16, 0], [-4, 0]]); g.fillStyle = '#ffffff55'; g.fill(); },
    star(g, c, o) { g.lineJoin = 'round'; starPath(g, 0, 3, 48); fs(g, o.base, 4); starPath(g, 0, 3, 34); g.strokeStyle = o.inner; g.lineWidth = 4; g.stroke(); },
    arrowhead(g, c, o) {
      poly(g, [[-44, -32], [44, -32], [0, 44]]); fs(g, o.base, 3.5);
      poly(g, [[-30, -24], [30, -24], [0, 28]]); g.strokeStyle = o.inner; g.lineWidth = 3; g.stroke();
      g.font = 'italic 900 34px "Barlow Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = o.inner; g.fillText(o.text, 0, -6);
    },
    swords(g, c, o) {
      circ(g, 0, 0, 30); fs(g, o.shield, 3.5); circ(g, 0, 0, 20); g.strokeStyle = O + '66'; g.lineWidth = 2; g.stroke();
      for (const s of [-1, 1]) {
        g.save(); g.rotate(s * 0.75);
        poly(g, [[-5, 22], [5, 22], [5, -40], [0, -50], [-5, -40]]); fs(g, '#d8dde2');
        g.fillStyle = O; g.fillRect(-14, 20, 28, 6); g.fillStyle = o.hilt; g.fillRect(-13, 21, 26, 4);
        g.fillStyle = O; g.fillRect(-4, 26, 8, 18); g.fillStyle = '#5a4030'; g.fillRect(-3, 27, 6, 16);
        g.restore();
      }
    },
    flamesword(g, c, o) {
      g.beginPath(); g.moveTo(0, 44);
      for (let i = 0; i <= 12; i++) { const a = Math.PI * (0.75 + i / 12 * 1.5), r = i % 2 ? 26 : 44; g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.9 + 4); }
      g.closePath(); fs(g, o.flame);
      g.beginPath(); g.moveTo(0, 30); for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.85 + i / 8 * 1.3), r = i % 2 ? 14 : 28; g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.85 + 6); } g.closePath(); g.fillStyle = '#ffd23f'; g.fill();
      poly(g, [[-5, 20], [5, 20], [5, -40], [0, -50], [-5, -40]]); fs(g, '#e4e8ec');
      g.fillStyle = O; g.fillRect(-16, 18, 32, 7); g.fillStyle = o.hilt; g.fillRect(-15, 19, 30, 5);
      g.fillStyle = O; g.fillRect(-4, 25, 8, 20); g.fillStyle = o.hilt; g.fillRect(-3, 26, 6, 18);
    },
    tricorn(g, c, o) {
      g.beginPath(); g.moveTo(-48, 6); g.quadraticCurveTo(-30, -38, 0, -36); g.quadraticCurveTo(30, -38, 48, 6); g.quadraticCurveTo(24, -6, 0, 20); g.quadraticCurveTo(-24, -6, -48, 6); g.closePath(); fs(g, o.base, 3.5);
      g.strokeStyle = o.trim; g.lineWidth = 4; g.beginPath(); g.moveTo(-42, 2); g.quadraticCurveTo(-22, -8, 0, 13); g.quadraticCurveTo(22, -8, 42, 2); g.stroke();
      g.fillStyle = o.star; g.strokeStyle = O; g.lineWidth = 2.5; starPath(g, 0, -12, 13); g.fill(); g.stroke();
      for (const x of [-14, 14]) { circ(g, x, 32, 3); g.fillStyle = o.star; g.fill(); }
      g.fillStyle = o.star; starPath(g, 0, 36, 5); g.fill();
    },
    girder(g, c, o) {
      poly(g, [[-44, -26], [44, -26], [44, -14], [8, -14], [8, 14], [44, 14], [44, 26], [-44, 26], [-44, 14], [-8, 14], [-8, -14], [-44, -14]]);
      const sg = g.createLinearGradient(0, -26, 0, 26); sg.addColorStop(0, '#e9edf0'); sg.addColorStop(0.5, '#9aa3ab'); sg.addColorStop(1, '#cfd5da'); fs(g, sg, 3.5);
      g.fillStyle = O; for (const x of [-36, -22, 22, 36]) for (const y of [-20, 20]) { circ(g, x, y, 2.4); g.fill(); }
      g.fillStyle = o.glow; for (const [y, w] of [[-38, 30], [38, 30]]) { g.fillRect(-w / 2, y - 2.5, w, 5); }
      for (const s of [-1, 1]) { poly(g, [[s * 30, -40], [s * 24, -34], [s * 30, -28], [s * 36, -34]]); g.fillStyle = o.glow; g.fill(); }
    },
    viking(g, c, o) {
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 30, 0); g.quadraticCurveTo(s * 54, -10, s * 46, -46); g.quadraticCurveTo(s * 40, -22, s * 22, -18); g.closePath(); fs(g, lite); }
      g.beginPath(); g.arc(0, 8, 34, Math.PI, 0); g.closePath(); fs(g, o.base, 3.5);
      g.fillStyle = shade(o.base, 0.3); g.beginPath(); g.ellipse(-12, -12, 9, 5, -0.5, 0, 7); g.fill();
      g.fillStyle = o.band; g.strokeStyle = O; g.lineWidth = 3; g.fillRect(-36, 2, 72, 10); g.strokeRect(-36, 2, 72, 10);
      g.fillStyle = O; for (let x = -28; x <= 28; x += 14) { circ(g, x, 7, 2); g.fill(); }
      poly(g, [[-5, 12], [5, 12], [3, 36], [-3, 36]]); fs(g, o.band);
    },
    fleur(g, c, o) {
      g.beginPath(); g.moveTo(0, -48); g.quadraticCurveTo(20, -24, 6, 10); g.lineTo(-6, 10); g.quadraticCurveTo(-20, -24, 0, -48); fs(g, o.base, 3.5);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, 8); g.quadraticCurveTo(s * 18, -26, s * 38, -14); g.quadraticCurveTo(s * 48, -2, s * 38, 6); g.quadraticCurveTo(s * 34, -6, s * 24, -2); g.quadraticCurveTo(s * 18, 6, s * 12, 18); g.closePath(); fs(g, o.base, 3.5); }
      g.beginPath(); g.moveTo(-4, 20); g.quadraticCurveTo(-14, 36, -24, 42); g.lineTo(24, 42); g.quadraticCurveTo(14, 36, 4, 20); g.closePath(); fs(g, o.base, 3.5);
      g.fillStyle = o.base; g.strokeStyle = O; g.lineWidth = 3.5; g.fillRect(-22, 12, 44, 9); g.strokeRect(-22, 12, 44, 9);
    },
    skullflag(g, c, o) {
      g.beginPath(); g.moveTo(-46, -34); g.quadraticCurveTo(-10, -44, 10, -34); g.quadraticCurveTo(30, -26, 46, -34); g.lineTo(46, 28); g.quadraticCurveTo(30, 36, 10, 28); g.quadraticCurveTo(-10, 18, -46, 28); g.closePath(); fs(g, o.flag, 3.5);
      g.strokeStyle = '#f2ece0'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(-22, 18); g.lineTo(22, -12); g.moveTo(-22, -12); g.lineTo(22, 18); g.stroke();
      ell(g, 0, -8, 17, 16); fs(g, '#f2ece0', 2.5); g.fillStyle = '#f2ece0'; g.fillRect(-9, 4, 18, 10); g.strokeStyle = O; g.lineWidth = 2.5; g.strokeRect(-9, 4, 18, 10);
      g.fillStyle = O; for (const s of [-1, 1]) { ell(g, s * 7, -9, 5, 5.5); g.fill(); } poly(g, [[0, -3], [-3, 2], [3, 2]]); g.fill();
      g.fillRect(-4, 6, 1.6, 8); g.fillRect(2, 6, 1.6, 8);
    },
    cheese(g, c, o) {
      poly(g, [[-46, 4], [36, -30], [46, -14], [46, 30], [-46, 30]]); fs(g, '#f4c430', 3.5);
      poly(g, [[-46, 4], [36, -30], [46, -14], [-40, 10]]); fs(g, '#ffe27a', 2.5);
      g.fillStyle = '#d99d1b'; for (const [x, y, rx, ry] of [[-24, 20, 6, 4], [4, 14, 8, 5], [28, 22, 6, 5], [16, 2, 4, 3], [-6, 26, 4, 2.5], [36, 6, 4, 3]]) { ell(g, x, y, rx, ry); g.fill(); }
      if (o.trim) { g.fillStyle = o.trim; g.fillRect(-46, 30, 92, 6); g.strokeStyle = O; g.lineWidth = 2.5; g.strokeRect(-46, 30, 92, 6); }
    },
    pickaxe(g, c, o) {
      g.save(); g.rotate(-0.6);
      g.fillStyle = O; g.fillRect(-5, -10, 10, 58); g.fillStyle = '#8a5a34'; g.fillRect(-3, -8, 6, 54);
      g.beginPath(); g.moveTo(-40, -6); g.quadraticCurveTo(0, -28, 40, -6); g.quadraticCurveTo(0, -16, -40, -6); fs(g, '#c9ced6', 3);
      g.restore();
      poly(g, [[4, 6], [22, -4], [42, 4], [46, 22], [32, 36], [10, 32], [2, 20]]); fs(g, o.gold, 3.5);
      poly(g, [[12, 6], [22, 0], [30, 6], [20, 14]]); g.fillStyle = '#fff3b0'; g.fill();
    },
    text(g, c, o) {
      g.font = `italic 900 ${o.size || 64}px "Barlow Condensed", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = 12; g.strokeStyle = O; g.strokeText(o.text, 0, 4); g.lineWidth = 6; g.strokeStyle = o.out; g.strokeText(o.text, 0, 4); g.fillStyle = o.fill; g.fillText(o.text, 0, 4);
    }
  };

  // ---------- which icon each team gets ----------
  const SPEC = {
    BUF: t => ['bison', { base: t.c1, streak: t.c2 }], MIA: t => ['dolphin', { base: t.c1, sun: t.c2 }], NE: t => ['tricorn', { base: t.c1, trim: '#fff', star: t.c2 }],
    NYJ: t => ['jet', { base: '#f4f6f7', wing: t.c1 }], BAL: t => ['bird', { base: '#1b1530', back: '#241773', beak: '#9e7c0c', eye: '#9e7c0c' }],
    CIN: t => ['cat', { base: t.c1, stripes: '#111' }], CLE: t => ['dog', { base: '#7b4a26', collar: t.c1 }], PIT: t => ['girder', { glow: t.c2 }],
    HOU: t => ['bull', { base: t.c2, star: '#fff' }], IND: t => ['horseshoe', { base: t.c1 }], JAX: t => ['cat', { base: '#c99b2e', spots: '#2a1a10', eye: t.c1 }],
    TEN: t => ['flamesword', { flame: t.c2 === '#ffffff' ? '#ff6a2a' : '#ff6a2a', hilt: t.c1 }], DEN: t => ['horse', { base: '#f2f2f2', mane: t.c1 }],
    KC: t => ['arrowhead', { base: t.c1, inner: '#fff', text: 'KC' }], LV: t => ['swords', { shield: '#a5acaf', hilt: '#111' }], LAC: t => ['bolt', { base: t.c2 }],
    DAL: t => ['star', { base: t.c1, inner: '#fff' }], NYG: t => ['text', { text: 'NY', fill: t.c1, out: '#fff', size: 70 }], PHI: t => ['bird', { base: '#f5f5f5', back: t.c1, beak: '#e9b81c' }],
    WAS: t => ['text', { text: 'W', fill: t.c1, out: t.c2, size: 84 }], CHI: t => ['bear', { base: '#4a2e1c', muzzle: '#b98a5e' }], DET: t => ['cat', { base: t.c1, mane: '#b0b7bc', muzzle: '#cfe3f2' }],
    GB: t => ['cheese', { trim: t.c1 }], MIN: t => ['viking', { base: t.c1, band: t.c2 }], ATL: t => ['bird', { base: '#1c1c1c', back: t.c1, beak: '#c9ced6', mask: t.c1 }],
    CAR: t => ['cat', { base: '#1b1b1b', muzzle: '#2c2c2c', eye: t.c1 }], NO: t => ['fleur', { base: t.c2 }], TB: t => ['skullflag', { flag: t.c1 }],
    ARI: t => ['bird', { base: t.c1, crest: true, face: '#1b1b1b', beak: '#f2b21b' }], LAR: t => ['ram', { base: t.c1, horn: t.c2 }],
    SF: t => ['pickaxe', { gold: '#d9a933' }], SEA: t => ['bird', { base: t.c1, back: t.c2, beak: '#a5acaf', eye: t.c2 }]
  };
  const specOf = t => (SPEC[t.id] && !t.custom) ? SPEC[t.id](t) : ['text', { text: t.id, fill: t.c1, out: t.c2 === t.c1 ? '#fff' : t.c2, size: t.id.length > 2 ? 44 : 58 }];

  function draw(g, t, x, y, size) {
    const [k, o] = specOf(t);
    g.save(); g.translate(x, y); g.scale(size / 100, size / 100);
    I[k](g, t, o);
    g.restore();
  }
  const cache = new Map();
  function canvas(t, px) {
    const key = t.id + t.c1 + t.c2 + (t.custom ? 'c' : '') + px;
    let cv = cache.get(key); if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = cv.height = px;
    const g = cv.getContext('2d'); if (!g || !g.save) return cv;
    draw(g, t, px / 2, px / 2, px * 0.86);
    cache.set(key, cv); return cv;
  }
  function url(t, px = 96) { try { return canvas(t, px).toDataURL(); } catch (e) { return ''; } }
  return { draw, canvas, url, has: t => !!(t && SPEC[t.id] && !t.custom) };
})();
