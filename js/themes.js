// ---- Seasonal menu looks by this device's date: October spooky (primetime.js), fall leaves, Thanksgiving, winter snow, Christmas ----
// ?theme=fall|thanksgiving|winter|christmas|valentine|spooky|none to test (?spooky=1 still works). Valentine's is only reachable that way for now
const THEMES = ['spooky', 'fall', 'thanksgiving', 'winter', 'christmas', 'valentine'];
function themeByDate(d) {
  const m = d.getMonth(), day = d.getDate();
  if (m === 9) return 'spooky';
  if (m === 10) return day <= 18 ? 'fall' : 'thanksgiving';
  if (m === 11) return day >= 18 && day <= 25 ? 'christmas' : 'winter';
  if (m === 0 && day <= 20) return 'winter';
  return null;
}
// no date given = today, and the test params win
function themeNow(d) {
  if (!d && typeof location !== 'undefined') {
    const q = /[?&]theme=(\w+)/.exec(location.search); if (q) return THEMES.includes(q[1]) ? q[1] : null;
    if (/[?&]spooky=1/.test(location.search)) return 'spooky';
  }
  return themeByDate(d || new Date());
}
// the fake game behind the title screen
const themeDemo = () => { const t = themeNow(); return { night: t === 'spooky' || t === 'christmas', weather: t === 'winter' || t === 'christmas' ? 'snow' : 'clear' }; };

(() => {
  const th = themeNow(); if (!th || th === 'spooky' || typeof document === 'undefined') return;
  document.body.classList.add('themed', 'th-' + th);
  const R = (a, b) => a + Math.random() * (b - a), f1 = v => v.toFixed(1);

  // ---- little drawings ----
  const MAPLE = 'M0-9L1.6-5.2 3.6-6.2 3-2 6.6-4 6-1.6 9-1.2 6.4 1.4 7.4 3.2 3 2.6 1 4.4.5 4.4.5 9-.5 9-.5 4.4-1 4.4-3 2.6-7.4 3.2-6.4 1.4-9-1.2-6-1.6-6.6-4-3-2-3.6-6.2-1.6-5.2Z';
  const OAK = 'M0-9Q3-8 3-6Q6-7 5.5-3.5Q8-3 6-.5Q8 1.5 5 3Q4 5.5 1 5L.6 9H-.6L-1 5Q-4 5.5-5 3Q-8 1.5-6-.5Q-8-3-5.5-3.5Q-6-7-3-6Q-3-8 0-9Z';
  const LEAFC = [['#d9531e', '#8a2d12'], ['#f2a51a', '#a35a0c'], ['#a3271f', '#5e1410'], ['#c97a1c', '#7a4310'], ['#e8862a', '#8a3f12']];
  const leaf = (i, oak = i % 3 === 1) => { const [c, v] = LEAFC[i % LEAFC.length]; return `<path d="${oak ? OAK : MAPLE}" fill="${c}"/><path d="M0 8.6V-5M0 1.5 4-2M0 1.5-4-2" stroke="${v}" stroke-width=".7" fill="none" stroke-linecap="round"/>`; };
  const leafAt = (x, y, r, s, i) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">${leaf(i)}</g>`;
  const HEART = 'M0 7C-3-0.5-9-2.5-9-6.5-9-9.5-6.8-11.5-4.5-11.5-2.6-11.5-1-10.4 0-8.6 1-10.4 2.6-11.5 4.5-11.5 6.8-11.5 9-9.5 9-6.5 9-2.5 3-0.5 0 7Z';
  const flake = (r, w) => `<g stroke="#f2fbff" stroke-width="${w}" stroke-linecap="round" fill="none">${[0, 60, 120, 180, 240, 300].map(a => `<path transform="rotate(${a})" d="M0 0V-${r}M0-${f1(r * .5)}l${f1(r * .3)}-${f1(r * .3)}M0-${f1(r * .5)}l-${f1(r * .3)}-${f1(r * .3)}M0-${f1(r * .78)}l${f1(r * .2)}-${f1(r * .2)}M0-${f1(r * .78)}l-${f1(r * .2)}-${f1(r * .2)}"/>`).join('')}</g>`;
  // things falling (or floating up) across the screen: CSS moves them, nothing per frame here
  const fallers = (n, cls, art, vb = '-10 -10 20 20') => Array.from({ length: n }, (_, i) =>
    `<i class="thP ${cls}" style="left:${f1((i + R(.15, .85)) / n * 100)}%;--d:${f1(R(10, 17))}s;--dl:-${f1(R(0, 17))}s;--s:${R(.65, 1.15).toFixed(2)};--fl:${f1(R(1.6, 3.2))}s"><svg viewBox="${vb}">${art(i)}</svg></i>`).join('');
  const snow = n => fallers(n, 'sn', i => i % 4 ? `<circle r="${4 + i % 3}" fill="#fff" opacity="${(.6 + i % 3 * .15).toFixed(2)}"/>` : flake(9, 1.8)); // the field behind already snows too
  // a rope that sags across the top, things hung along it (lights, flags, hearts). x in %, y in px
  const sagY = (x, segs, sag) => { const t = (x * segs / 100) % 1; return 3 + sag * 4 * t * (1 - t); };
  const rope = (segs, sag, col) => `<svg class="thRope" style="height:${sag + 8}px" viewBox="0 0 100 ${sag + 8}" preserveAspectRatio="none"><path d="${Array.from({ length: segs }, (_, s) => { const a = s * 100 / segs, b = a + 100 / segs; return `${s ? '' : `M0 3`}Q${f1((a + b) / 2)} ${3 + sag * 2} ${f1(b)} 3`; }).join('')}" stroke="${col}" stroke-width="1.6" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
  const hung = (n, segs, sag, cls, art, vb) => Array.from({ length: n }, (_, i) => { const x = (i + .5) / n * 100; return `<i class="thH ${cls} k${i % 4}" style="left:${f1(x)}%;top:${f1(sagY(x, segs, sag))}px"><svg viewBox="${vb}">${art(i)}</svg></i>`; }).join('');
  const lights = (n, segs, sag) => rope(segs, sag, '#173a22') + hung(n, segs, sag, 'bulb', i => `<rect x="-2.6" y="-1" width="5.2" height="4" rx=".8" fill="#2c3b2f"/><path d="M0 2.6C3.6 2.6 4.2 7 3.4 9.4 2.6 12 1 13.4 0 13.4S-2.6 12-3.4 9.4C-4.2 7-3.6 2.6 0 2.6Z" fill="${['#ff3b3b', '#2fe07a', '#ffd34a', '#4fb4ff'][i % 4]}"/><path d="M-1.5 5.5C-2.3 6.8-2.3 8.6-1.8 10" stroke="#ffffffaa" stroke-width="1" fill="none" stroke-linecap="round"/>`, '-8 -2 16 18');
  const frost = c => { let p = ''; for (let a = 4; a <= 86; a += 13) { const r = a * Math.PI / 180, L = 70 + (a * 37 % 45); const px = t => f1(Math.cos(r) * t), py = t => f1(Math.sin(r) * t);
      p += `M0 0L${px(L)} ${py(L)}`; for (let t = 16; t < L - 6; t += 13) { const b = 8 * (1 - t / L) + 3; for (const s of [-1, 1]) { const q = r + s * .75; p += `M${px(t)} ${py(t)}l${f1(Math.cos(q) * b)} ${f1(Math.sin(q) * b)}`; } } }
    return `<svg class="thFrost ${c}" viewBox="0 0 120 120"><defs><radialGradient id="thFg${c}" cx="0" cy="0" r="1"><stop offset="0" stop-color="#e8f7ff" stop-opacity=".38"/><stop offset=".6" stop-color="#e8f7ff" stop-opacity=".08"/><stop offset="1" stop-color="#e8f7ff" stop-opacity="0"/></radialGradient></defs><rect width="120" height="120" fill="url(#thFg${c})"/><path d="${p}" stroke="#eaf8ff" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".75"/></svg>`; };
  const drift = (c = '#eef7ff', sh = '#b9d6ee') => `<svg class="thDrift" viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 22C30 10 60 14 90 20S150 8 190 16 260 24 300 14 370 10 400 20V40H0Z" fill="${sh}"/><path d="M0 26C34 15 64 19 92 24S152 13 192 21 262 28 302 19 372 15 400 24V40H0Z" fill="${c}"/></svg>`;
  const pine = (c, snowy = true) => `<svg class="thPine ${c}" viewBox="-30 -62 60 66"><rect x="-3" y="-4" width="6" height="8" fill="#3a2414"/>${[[-4, 26, 22], [-22, 21, 20], [-38, 15, 18]].map(([y, w, h]) => `<path d="M0 ${y - h}L${w} ${y}H-${w}Z" fill="#163a35"/>` + (snowy ? `<path d="M0 ${y - h}L${f1(w * .45)} ${f1(y - h * .55)} ${f1(w * .2)} ${f1(y - h * .62)} 0 ${f1(y - h * .5)}-${f1(w * .25)} ${f1(y - h * .6)}-${f1(w * .45)} ${f1(y - h * .55)}Z" fill="#f2fbff"/><path d="M-${w} ${y}Q-${f1(w * .5)} ${y - 4} 0 ${y - 1}T${w} ${y}Z" fill="#e6f4ff"/>` : '')).join('')}</svg>`;

  // ---- the title screen, per theme ----
  const tree = `<svg class="thTree" viewBox="-34 -78 68 82"><rect x="-4" y="-6" width="8" height="10" fill="#4a2a14"/>${[[-6, 30, 24], [-24, 24, 22], [-42, 18, 20], [-58, 12, 16]].map(([y, w, h]) => `<path d="M0 ${y - h}L${w} ${y}Q0 ${y + 4}-${w} ${y}Z" fill="#14593a"/><path d="M0 ${y - h}L${w} ${y}Q${w * .5} ${y + 2} ${w * .3} ${y + 1}Z" fill="#0d4129"/>`).join('')}`
    + `<path d="M-22-12Q0-4 22-16M-16-30Q0-24 16-34M-10-48Q0-44 10-52" stroke="#f3d36b" stroke-width="1.4" fill="none"/>`
    + [[-14, -10, '#e01e2b'], [10, -14, '#f3d36b'], [-6, -27, '#4fb4ff'], [12, -32, '#e01e2b'], [-9, -46, '#f3d36b'], [5, -50, '#e01e2b'], [0, -18, '#ffffff'], [18, -6, '#4fb4ff'], [-20, -4, '#f3d36b']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${c}"/><circle cx="${x - .8}" cy="${y - .8}" r=".8" fill="#fff" opacity=".7"/>`).join('')
    + `<path d="M0-82l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L0-69.6l-5 2.8 1.2-5.6-4.2-3.8 5.6-.6Z" fill="#ffd34a" class="star"/></svg>`;
  const gift = (x, y, w, h, c, rb) => `<g transform="translate(${x} ${y})"><rect x="0" y="0" width="${w}" height="${h}" fill="${c}"/><rect x="0" y="0" width="${w}" height="${h}" fill="url(#thGiftSh)"/><rect x="${w / 2 - 2.5}" y="0" width="5" height="${h}" fill="${rb}"/><rect x="-2" y="-5" width="${w + 4}" height="7" fill="${c}"/><rect x="${w / 2 - 2.5}" y="-5" width="5" height="7" fill="${rb}"/><path d="M${w / 2}-5c-8-9-15-3-9 1zM${w / 2}-5c8-9 15-3 9 1z" fill="${rb}"/></g>`;
  const gifts = `<svg class="thGifts" viewBox="0 0 120 70"><defs><linearGradient id="thGiftSh" x1="0" x2="1"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>${gift(6, 30, 44, 38, '#c8102e', '#f3d36b')}${gift(56, 40, 32, 28, '#1f8a4c', '#e9eef5')}${gift(30, 10, 26, 20, '#2f6fd6', '#f3d36b')}${gift(90, 48, 24, 20, '#f3d36b', '#c8102e')}</svg>`;
  const ornament = (x, len, c, sc) => `<g class="orn" style="transform-origin:${x}px 0"><line x1="${x}" y1="0" x2="${x}" y2="${len}" stroke="#f3d36b" stroke-width=".8"/><rect x="${x - 3}" y="${len - 1}" width="6" height="4" fill="#d9b24a"/><circle cx="${x}" cy="${len + 3 + 10 * sc}" r="${10 * sc}" fill="${c}"/><path d="M${f1(x - 10 * sc)} ${f1(len + 3 + 10 * sc)}q${f1(10 * sc)} ${f1(4 * sc)} ${f1(20 * sc)} 0" stroke="#ffffff66" stroke-width="1.2" fill="none"/><circle cx="${f1(x - 3.5 * sc)}" cy="${f1(len + 3 + 6.5 * sc)}" r="${f1(2.6 * sc)}" fill="#fff" opacity=".55"/></g>`;
  const orns = c => `<svg class="thOrn ${c}" viewBox="0 0 90 90">${ornament(16, 26, '#c8102e', 1.1) + ornament(44, 46, '#f3d36b', .9) + ornament(70, 18, '#1f8a4c', 1)}</svg>`;
  const cornucopia = `<svg class="thHorn" viewBox="0 0 150 96"><path d="M20 20C46 14 78 12 104 16L108 86C76 82 46 62 26 40 18 34 8 30 6 22 4 14 12 8 18 12 22 15 20 19 16 19" fill="#b5762e" stroke="#7a4a1c" stroke-width="2" stroke-linejoin="round"/>`
    + [34, 50, 66, 82, 96].map(x => { const yb = 40 + (x - 26) * .55; return `<path d="M${x} ${f1(16 - (x - 34) * .03)}Q${x + 9} ${f1((16 + yb) / 2)} ${x + 2} ${f1(yb)}" stroke="#8a5320" stroke-width="3" fill="none" opacity=".8"/>`; }).join('')
    + `<path d="M24 24C48 20 78 18 102 22" stroke="#e0a45a" stroke-width="2" fill="none" opacity=".7"/><ellipse cx="106" cy="51" rx="10" ry="35" fill="#3a1e0c" stroke="#d99a4e" stroke-width="3"/>`
    + `<g transform="translate(112 30) rotate(-30)"><ellipse rx="6" ry="15" fill="#f2c14e"/><path d="M-4-10h8M-5-5h10M-5.5 0h11M-5 5h10M-4 10h8" stroke="#c99520" stroke-width=".8"/><path d="M0 14C-9 10-10 0-8-8-3 2-2 8 0 14 2 8 3 2 8-8 10 0 9 10 0 14Z" fill="#7c9a3a"/></g>`
    + `<g fill="#6a2c7a"><circle cx="104" cy="70" r="4.4"/><circle cx="112" cy="70" r="4.4"/><circle cx="108" cy="77" r="4.4"/><circle cx="116" cy="77" r="4.4"/><circle cx="112" cy="84" r="4.4"/><circle cx="100" cy="77" r="4.4"/></g><path d="M108 66q2-6 7-6" stroke="#5a7a2a" stroke-width="1.6" fill="none"/>`
    + `<g transform="translate(131 76)"><ellipse rx="17" ry="13" fill="#d9661a"/><path d="M-9-12Q-14 0-9 12M0-13V13M9-12Q14 0 9 12" stroke="#a84a10" stroke-width="1.6" fill="none"/><path d="M0-13q1-6 5-7" stroke="#5a7a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`
    + `<g transform="translate(128 50)"><circle r="9" fill="#c8202a"/><circle cx="-3" cy="-3" r="2.2" fill="#fff" opacity=".4"/><path d="M0-8q1-4 3-5" stroke="#4a2a14" stroke-width="1.4" fill="none"/><path d="M1-9q6-4 9 0-5 3-9 0Z" fill="#5a8a2a"/></g>`
    + leafAt(92, 88, 200, 1, 0) + leafAt(140, 92, 150, .9, 2) + '</svg>';
  const pie = `<svg class="thPie" viewBox="-46 -30 92 56"><path d="M-40 0L-34 18H34L40 0Z" fill="#9aa3ad"/><path d="M-40 0L-34 18H34L40 0Z" fill="url(#thTin)"/><defs><linearGradient id="thTin"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>`
    + `<ellipse cx="0" cy="0" rx="40" ry="13" fill="#d99a4e"/><ellipse cx="0" cy="0" rx="40" ry="13" fill="none" stroke="#e8b46a" stroke-width="6" stroke-dasharray="1 6.4" stroke-linecap="round"/><ellipse cx="0" cy="-.5" rx="33" ry="9.5" fill="#b8571a"/><ellipse cx="-6" cy="-2" rx="18" ry="4" fill="#cf6d24" opacity=".7"/>`
    + `<path d="M-9-2C-11-6-6-9-3-8-3-13 5-13 5-8 9-9 12-5 9-2 4 0-4 0-9-2Z" fill="#fffaf0"/><path d="M-5-5Q0-10 5-6" stroke="#e6dccb" stroke-width="1" fill="none"/><path d="M2-11q-1-3 1-5" stroke="#fffaf0" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  const pennants = (n, segs, sag) => rope(segs, sag, '#5a3214') + hung(n, segs, sag, 'flag', i => `<path d="M-9 0H9L0 18Z" fill="${['#a8322a', '#e07a1f', '#f2c14e', '#6b3a1e', '#f3e3c3'][i % 5]}"/><path d="M-9 0H9L0 18Z" fill="url(#thFlagSh)"/>`, '-10 -1 20 20');
  const candy = (x, y, r, c, t) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="${HEART}" transform="scale(2.1)" fill="${c}"/><path d="${HEART}" transform="scale(2.1)" fill="none" stroke="#00000022" stroke-width=".6"/><text y="-9" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="900" font-style="italic" font-size="${t.length > 4 ? 7.5 : 9.5}" fill="#d0104c" opacity=".85">${t}</text></g>`;
  const candies = (c, list) => `<svg class="thCandy ${c}" viewBox="0 0 110 60">${list.map(a => candy(...a)).join('')}</svg>`;
  const heartArt = i => `<path d="${HEART}" fill="${['#ff4d7d', '#ff8fb1', '#d0104c', '#ffc2d4', '#ff6f9a'][i % 5]}"/><path d="M-5-8.5C-6.5-8.5-7-7.2-7-6.4" stroke="#ffffff99" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;

  const T = {
    branches: () => `<svg class="thBranch l" viewBox="0 0 200 110"><path d="M-4 4C40 2 80 16 128 12S176 20 196 16" stroke="#3a1f12" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 12Q86 30 84 44M128 12Q140 24 150 26" stroke="#3a1f12" stroke-width="2" fill="none" stroke-linecap="round"/>`
        + leafAt(20, 14, 190, 1.4, 0) + leafAt(44, 16, 160, 1.2, 1) + leafAt(84, 52, 175, 1.3, 2) + leafAt(102, 22, 205, 1.1, 3) + leafAt(150, 34, 150, 1.2, 4) + leafAt(176, 26, 195, 1, 0) + leafAt(64, 26, 140, .9, 4) + '</svg>'
      + `<svg class="thBranch r" viewBox="0 0 200 110"><path d="M-4 4C40 2 80 16 128 12S176 20 196 16" stroke="#3a1f12" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M90 12Q100 30 96 40" stroke="#3a1f12" stroke-width="2" fill="none" stroke-linecap="round"/>`
        + leafAt(24, 16, 170, 1.3, 1) + leafAt(56, 20, 200, 1.1, 2) + leafAt(96, 48, 180, 1.2, 4) + leafAt(130, 24, 165, 1.2, 0) + leafAt(166, 30, 190, 1, 3) + '</svg>',
    fall: () => `<div class="thGlow"></div>` + T.branches()
      + `<svg class="thStadium" viewBox="0 0 800 100" preserveAspectRatio="xMidYMax slice"><defs><radialGradient id="thSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe08a"/><stop offset=".6" stop-color="#ff9a3a"/><stop offset="1" stop-color="#e8541e"/></radialGradient><radialGradient id="thLamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1c8" stop-opacity=".7"/><stop offset="1" stop-color="#ffd28a" stop-opacity="0"/></radialGradient></defs>`
        + `<circle cx="560" cy="62" r="40" fill="url(#thSun)" opacity=".9"/>`
        + [70, 730].map(x => `<circle cx="${x + 2}" cy="12" r="30" fill="url(#thLamp)"/><rect x="${x}" y="16" width="4" height="50" fill="#1c0d0a"/><rect x="${x - 18}" y="4" width="40" height="15" fill="#2a1408"/>${[0, 1, 2, 3].map(c => [0, 1].map(r => `<rect x="${x - 15 + c * 9.5}" y="${6.5 + r * 6}" width="6.5" height="4" fill="#ffe7a8"/>`).join('')).join('')}`).join('')
        + `<path d="M0 100V60C180 47 620 47 800 60V100Z" fill="#1c0d0a"/><path d="M0 60C180 47 620 47 800 60" stroke="#5a2a16" stroke-width="2" fill="none"/><path d="M0 72C180 61 620 61 800 72" stroke="#2c140c" stroke-width="1.5" fill="none"/></svg>`
      + fallers(9, 'leaf', i => leaf(i)),
    thanksgiving: () => `<div class="thGlow"></div><div class="thTable"></div>` + `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="thFlagSh" x1="0" x2="1"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs></svg>`
      + `<div class="thTop">${pennants(17, 2, 18)}</div>` + cornucopia + pie + fallers(6, 'leaf', i => leaf(i + 1)),
    winter: () => `<div class="thGlow"></div>` + snow(28) + frost('l') + frost('r')
      + `<svg class="thFlake f1" viewBox="-12 -12 24 24">${flake(11, 1.1)}</svg><svg class="thFlake f2" viewBox="-12 -12 24 24">${flake(11, 1.3)}</svg><svg class="thFlake f3" viewBox="-12 -12 24 24">${flake(11, 1.2)}</svg>`
      + drift() + pine('l') + pine('l2') + pine('r'),
    christmas: () => `<div class="thGlow"></div>` + snow(22) + `<div class="thTop">${lights(24, 3, 22)}</div>` + orns('l') + orns('r') + drift() + gifts + tree,
    valentine: () => `<div class="thGlow"></div><div class="thTop">${rope(3, 14, '#ffb3c7') + hung(15, 3, 14, 'hrt', heartArt, '-10 -13 20 22')}</div>`
      + fallers(10, 'rise', heartArt, '-10 -13 20 22')
      + candies('l', [[24, 44, -14, '#ffc2d4', 'GO TEAM'], [62, 50, 10, '#d9c2ff', 'MVP'], [44, 26, 4, '#c6f0d8', 'TD'], [88, 38, -8, '#fff1a8', 'HIKE']])
      + candies('r', [[30, 46, 12, '#fff1a8', 'BFF'], [70, 44, -10, '#ffc2d4', '#1 FAN'], [52, 22, -4, '#c6f0d8', 'WIN']])
  };
  // the other menus get a lighter version (only the screen that's showing animates)
  const M = {
    fall: () => T.branches() + fallers(7, 'leaf', i => leaf(i)),
    thanksgiving: () => `<div class="thTop">${pennants(13, 2, 14)}</div>` + fallers(5, 'leaf', i => leaf(i + 1)),
    winter: () => snow(14) + frost('l') + frost('r'),
    christmas: () => snow(8) + `<div class="thTop">${lights(18, 2, 14)}</div>`,
    valentine: () => `<div class="thTop">${rope(2, 12, '#ffb3c7') + hung(11, 2, 12, 'hrt', heartArt, '-10 -13 20 22')}</div>` + fallers(6, 'rise', heartArt, '-10 -13 20 22')
  };
  const add = (id, html, cls) => { const s = document.getElementById(id); if (!s) return; const el = document.createElement('div'); el.className = 'thFx ' + cls; el.innerHTML = html; s.prepend(el); };
  add('title', T[th](), 'full');
  for (const id of ['select', 'mode', 'how', 'modes', 'seasonNew', 'trophies', 'cap']) add(id, M[th](), 'mini');
})();
