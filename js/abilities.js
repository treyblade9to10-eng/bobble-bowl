// ---- Superstar abilities: the real Madden 27 ones (the smaller, always-on kind, not X-Factors). Max 2 per player ----
// fx = what it does in this game (engine.js asks abHas(p, fx)), c = when it counts (throw / catch spot)
const AB_TYPES = {
  // passers
  sideeye: { name: 'Sideline Deadeye', fx: 'eye', c: 'out', desc: 'Dead-on outside the numbers from a clean pocket' },
  ineye: { name: 'Inside Deadeye', fx: 'eye', c: 'in', desc: 'Dead-on over the middle from a clean pocket' },
  longeye: { name: 'Long Range Deadeye', fx: 'eye', c: 'deep', desc: 'Dead-on deep balls from a clean pocket' },
  pocketeye: { name: 'Pocket Deadeye', fx: 'eye', desc: 'Dead-on from a clean pocket' },
  lofteye: { name: 'Lofting Deadeye', fx: 'eye', c: 'lob', desc: 'Lobs and touch passes land on the money' },
  higheye: { name: 'High Point Deadeye', fx: 'eye', c: 'short', desc: 'Short throws are right on target' },
  nolookeye: { name: 'No-Look Deadeye', fx: 'eye', c: 'short', desc: 'Short throws are right on target' },
  rzeye: { name: 'Red Zone Deadeye', fx: 'eye', c: 'rz', desc: 'Dead-on in the red zone' },
  dasheye: { name: 'Dashing Deadeye', fx: 'runeye', desc: 'Accurate throwing on the run' },
  roameye: { name: 'Roaming Deadeye', fx: 'runeye', desc: 'Accurate throwing on the run' },
  fearless: { name: 'Fearless', fx: 'fearless', desc: 'Pressure barely shakes his throws' },
  extender: { name: 'Extender', fx: 'extender', desc: 'Can shake off the first sack try' },
  gunslinger: { name: 'Gunslinger', fx: 'gun', desc: 'Throws a faster ball' },
  giftwrap: { name: 'Gift-Wrapped', fx: 'gift', desc: 'Easy completions to his running backs' },
  // catchers
  shortin: { name: 'Short In Elite', fx: 'elite', c: 'short in', desc: 'Sure hands on short throws over the middle' },
  shortout: { name: 'Short Out Elite', fx: 'elite', c: 'short out', desc: 'Sure hands on short throws to the outside' },
  midin: { name: 'Mid In Elite', fx: 'elite', c: 'mid in', desc: 'Sure hands on 10-20 yd throws over the middle' },
  midout: { name: 'Mid Out Elite', fx: 'elite', c: 'mid out', desc: 'Sure hands on 10-20 yd throws to the outside' },
  deepin: { name: 'Deep In Elite', fx: 'elite', c: 'deep in', desc: 'Sure hands on deep throws over the middle' },
  deepout: { name: 'Deep Out Elite', fx: 'elite', c: 'deep out', desc: 'Sure hands on deep throws to the outside' },
  deepelite: { name: 'Deep Elite', fx: 'elite', c: 'deep', desc: 'Sure hands on deep throws' },
  slot: { name: 'Slot-O-Matic', fx: 'elite', c: 'short', desc: 'Sure hands on short throws' },
  acrobat: { name: 'Acrobat', fx: 'contest', desc: 'Makes the tough catch with a defender on him' },
  rzthreat: { name: 'Red Zone Threat', fx: 'contest', c: 'rz', desc: 'Wins contested catches in the red zone' },
  thirdthreat: { name: '3rd Down Threat', fx: 'contest', c: 'third', desc: 'Wins contested catches on 3rd down' },
  nightmare: { name: 'Matchup Nightmare', fx: 'contest', c: 'big', desc: 'Wins contested catches against linebackers' },
  bfmismatch: { name: 'Backfield Mismatch', fx: 'contest', c: 'big', desc: 'Wins catches against linebackers out of the backfield' },
  routetech: { name: 'Route Technician', fx: 'cuts', desc: 'Sharper cuts, more separation' },
  quickjump: { name: 'Quick Jump', fx: 'quick', desc: 'Explodes off the line at the snap' },
  // ball carriers
  armbar: { name: 'Arm Bar', fx: 'stiff', desc: 'Stronger stiff arm' },
  bruiser: { name: 'Bruiser', fx: 'stiff', desc: 'Stronger stiff arm' },
  jukebox: { name: 'Juke Box', fx: 'moves', desc: 'Jukes and spins work more often' },
  evasive: { name: 'Evasive', fx: 'moves', desc: 'Jukes and spins work more often' },
  joystick: { name: 'Human Joystick', fx: 'cuts', desc: 'Changes direction without slowing down' },
  tank: { name: 'Tank', fx: 'tank', desc: 'Hard to bring down' },
  steamroller: { name: 'Steamroller', fx: 'tank', desc: 'Hard to bring down' },
  reachit: { name: 'Reach For It', fx: 'secure', desc: 'Hardly ever fumbles' },
  // pass rush
  edgethreat: { name: 'Edge Threat', fx: 'rush', desc: 'Beats pass blocks faster' },
  intthreat: { name: 'Interior Threat', fx: 'rush', desc: 'Beats pass blocks faster' },
  maxeffort: { name: 'Max Effort', fx: 'rush', desc: 'Beats pass blocks faster' },
  eltoro: { name: 'El Toro', fx: 'rush', desc: 'Bull rush beats pass blocks faster' },
  unpredictable: { name: 'Unpredictable', fx: 'rush', desc: 'Beats pass blocks faster' },
  swimclub: { name: 'Swim Club', fx: 'swim', desc: 'Swim moves win more and come back faster' },
  bogo: { name: 'B.O.G.O.', fx: 'swim', desc: 'Swim moves win more and come back faster' },
  extracredit: { name: 'Extra Credit', fx: 'swim', desc: 'Swim moves win more and come back faster' },
  underpressure: { name: 'Under Pressure', fx: 'reach', desc: 'Pressures the QB from farther away' },
  // run defense + tackling
  nooutsiders: { name: 'No Outsiders', fx: 'runstop', desc: 'Sheds run blocks faster' },
  insidestuff: { name: 'Inside Stuff', fx: 'runstop', desc: 'Sheds run blocks faster' },
  runstopper: { name: 'Run Stopper', fx: 'runstop', desc: 'Sheds run blocks faster' },
  goalline: { name: 'Goal Line Stuff', fx: 'runstop', desc: 'Sheds run blocks faster' },
  securetackler: { name: 'Secure Tackler', fx: 'tackler', desc: 'Hard to juke or spin past' },
  enforcer: { name: 'Enforcer', fx: 'tackler', desc: 'Fewer broken tackles' },
  // coverage
  lurker: { name: 'Lurker', fx: 'lurker', desc: 'More picks when he sits in a zone' },
  flatko: { name: 'Flat Zone KO', fx: 'ko', c: 'short out', desc: 'Knocks loose short catches to the outside' },
  shortko: { name: 'Short Route KO', fx: 'ko', c: 'short', desc: 'Knocks loose short catches' },
  midzoneko: { name: 'Mid Zone KO', fx: 'ko', c: 'mid', desc: 'Knocks loose 10-20 yd catches' },
  medko: { name: 'Medium Route KO', fx: 'ko', c: 'mid', desc: 'Knocks loose 10-20 yd catches' },
  deepko: { name: 'Deep Route KO', fx: 'ko', c: 'deep', desc: 'Knocks loose deep catches' },
  deepoutko: { name: 'Deep Out Zone KO', fx: 'ko', c: 'deep out', desc: 'Knocks loose deep catches to the outside' },
  deepinko: { name: 'Deep In Zone KO', fx: 'ko', c: 'deep in', desc: 'Knocks loose deep catches over the middle' },
  outmatched: { name: 'Outmatched', fx: 'ko', c: 'back', desc: 'Knocks loose catches by backs and tight ends' },
  inshade: { name: 'Inside Shade', fx: 'shade', desc: 'Sticks to his man in man coverage' },
  outshade: { name: 'Outside Shade', fx: 'shade', desc: 'Sticks to his man in man coverage' },
  onestep: { name: 'One Step Ahead', fx: 'shade', desc: 'Sticks to his man in man coverage' },
  ontheball: { name: 'On The Ball', fx: 'shade', desc: 'Sticks to his man in man coverage' },
  // blockers
  toughnut: { name: 'Tough Nut', fx: 'pblock', desc: 'Pass rushers take longer to beat him' },
  passprot: { name: 'Pass Protector', fx: 'pblock', desc: 'Pass rushers take longer to beat him' },
  edgeprot: { name: 'Edge Protector', fx: 'pblock', desc: 'Pass rushers take longer to beat him' },
  secureprot: { name: 'Secure Protector', fx: 'pblock', desc: 'Pass rushers take longer to beat him' },
  allday: { name: 'All Day', fx: 'pblock', desc: 'Pass rushers take longer to beat him' },
  postup: { name: 'Post Up', fx: 'pblock', desc: 'Pass rushers take longer to beat him' },
  runprot: { name: 'Run Protector', fx: 'rblock', desc: 'Holds his run blocks longer' },
  nasty: { name: 'Nasty Streak', fx: 'rblock', desc: 'Holds his run blocks longer' },
  screenprot: { name: 'Screen Protector', fx: 'rblock', desc: 'Holds his run and screen blocks longer' },
  puller: { name: 'Puller Elite', fx: 'rblock', desc: 'Holds his run blocks longer' },
  linchpin: { name: 'Linchpin', fx: 'rblock', desc: 'Holds his run blocks longer' },
  // kickers
  zen: { name: 'Zen Kicker', fx: 'zen', desc: 'Calmer kick meter on 45+ yd kicks' }
};
// who has which in Madden 27 (EA ratings, Oct 2026), by the name he has in this game. Best 2 for this game, best first
const AB_REAL = {
  "Josh Allan": ['dasheye', 'extender'], "James Cooke": ['bfmismatch', 'jukebox'], "Dion Dawkens": ['toughnut', 'runprot'],
  "Greg Rousso": ['maxeffort', 'bogo'], "Drake Mayes": ['longeye', 'fearless'], "A.J. Bruwn": ['shortin', 'quickjump'],
  "Milton Willyams": ['quickjump'], "Christian Gonzales": ['lurker', 'shortko'], "Garrett Wilsun": ['slot', 'midin'], "David Baylee": ['quickjump'],
  "Demario Davus": ['securetackler', 'outmatched'], "Minkah Fitzpatrik": ['deepoutko'], "Lamar Jaxon": ['giftwrap', 'jukebox'],
  "Derrick Henrie": ['armbar', 'steamroller'], "Mark Andrewz": ['nightmare'], "Ronnie Stanly": ['secureprot', 'edgeprot'],
  "Nnamdi Madubike": ['bogo', 'insidestuff'], "Trey Hendrikson": ['edgethreat', 'nooutsiders'], "Roquan Smyth": ['securetackler', 'midzoneko'],
  "Kyle Hamiltun": ['outmatched'], "Joe Burrows": ['sideeye', 'fearless'], "Ja'Marr Chaze": ['midin', 'acrobat'],
  "Tee Higgens": ['deepout', 'acrobat'], "Dexter Lawrance": ['eltoro', 'intthreat'], "Jonathan Alen": ['runstopper'],
  "Jared Versey": ['maxeffort', 'underpressure'], "Mason Grayham": ['quickjump'], "Denzel Warde": ['lurker', 'deepko'], "DK Metcalfe": ['deepout'],
  "Cam Haywood": ['unpredictable', 'insidestuff'], "T.J. Watts": ['edgethreat', 'nooutsiders'], "Alex Highsmyth": ['edgethreat'],
  "Jalen Ramzy": ['onestep'], "Rico Doodle": ['tank'], "Nick Herbeg": ['quickjump'], "Nico Colins": ['midin', 'quickjump'],
  "Will Andersun": ['edgethreat', 'securetackler'], "Danielle Huntor": ['edgethreat', 'maxeffort'], "Derek Stingly": ['lurker', 'deepoutko'],
  "Jonathan Tailer": ['armbar', 'tank'], "Tyler Warrin": ['midout', 'shortout'], "Sauce Gardnor": ['deepoutko', 'inshade'],
  "Charvarius Word": ['shortko'], "Josh Hines-Allun": ['edgethreat', 'unpredictable'], "Travon Walkur": ['quickjump'],
  "Foye Oluokoon": ['securetackler', 'flatko'], "Cam Littel": ['zen'], "Courtland Sutten": ['shortout', 'quickjump'], "Garett Bowles": ['secureprot'],
  "Quinn Meinertz": ['postup', 'runprot'], "Nik Bonito": ['edgethreat', 'quickjump'], "Zach Alan": ['eltoro', 'intthreat'],
  "Jonathon Kooper": ['quickjump'], "Pat Surtane II": ['lurker', 'shortko'], "Pat Mahomez": ['rzeye', 'dasheye'],
  "Kenneth Walkah": ['armbar', 'reachit'], "Travis Kelsey": ['deepout', 'thirdthreat'], "Creed Humphry": ['toughnut', 'linchpin'],
  "Trey Smitt": ['postup', 'screenprot'], "Chris Jonez": ['eltoro', 'underpressure'], "L'Jarius Sneeds": ['flatko'],
  "Brock Bowerz": ['deepout', 'tank'], "Maxx Crosbee": ['edgethreat', 'swimclub'], "Justin Herbirt": ['sideeye', 'roameye'],
  "Ladd McConkie": ['slot', 'shortin'], "Rashawn Slatter": ['secureprot', 'allday'], "Khalil Mac": ['edgethreat', 'nooutsiders'],
  "Derwin Jamez": ['securetackler', 'flatko'], "Dak Prescot": ['ineye', 'fearless'], "CeeDee Lam": ['midout', 'quickjump'],
  "George Pickins": ['deepelite', 'acrobat'], "Jake Fergusen": ['midin', 'shortout'], "Quinnen Willyums": ['unpredictable', 'runstopper'],
  "Kenny Clarke": ['unpredictable', 'insidestuff'], "Brandon Awbrey": ['zen'], "Malik Nabors": ['midout', 'midin'], "Andrew Thommas": ['passprot'],
  "Brian Burnz": ['maxeffort'], "Abdul Kartor": ['quickjump'], "Saquon Barkly": ['evasive', 'joystick'], "DeVonta Smitty": ['midout'],
  "Dallas Goedirt": ['shortout', 'armbar'], "Jordan Malata": ['allday', 'runprot'], "Jalen Cartier": ['unpredictable', 'quickjump'],
  "Jonathan Greenyard": ['edgethreat', 'securetackler'], "Nolan Smithers": ['quickjump'], "Zack Bawn": ['outmatched'],
  "Quinyon Mitchel": ['lurker', 'flatko'], "Jayden Daniells": ['sideeye', 'fearless'], "Caleb Wiliamz": ['longeye', 'fearless'],
  "Joe Thooney": ['postup', 'nasty'], "Jeffery Simmonz": ['eltoro', 'runstopper'], "Jaylon Johnsin": ['deepko', 'ontheball'],
  "Jared Gough": ['pocketeye'], "Jahmyr Gibbz": ['evasive', 'joystick'], "Amon-Ra St. Browne": ['shortout', 'quickjump'], "Sam LaPorte": ['midin'],
  "Penei Sewel": ['toughnut', 'screenprot'], "Aidan Hutchinsun": ['edgethreat', 'bogo'], "Kerby Josef": ['lurker', 'deepinko'],
  "Jordan Luv": ['sideeye', 'giftwrap'], "Josh Jakobs": ['bruiser', 'steamroller'], "Micah Parsnips": ['edgethreat', 'securetackler'],
  "Devonte Wyat": ['quickjump'], "Xavier McKinny": ['lurker', 'midzoneko'], "Christian Darisaw": ['edgeprot', 'postup'],
  "Dallas Turnor": ['quickjump'], "Harrison Smyth": ['enforcer', 'flatko'], "Bijan Robbinson": ['bfmismatch', 'jukebox'],
  "Drake Londen": ['shortout', 'acrobat'], "Chris Lindstrum": ['toughnut', 'runprot'], "A.J. Terrel": ['deepko', 'inshade'],
  "Jessie Bayts": ['lurker', 'deepinko'], "Tetairoa McMillen": ['quickjump'], "Derrick Brownstone": ['unpredictable', 'swimclub'],
  "Devin Floyd": ['lurker', 'shortko'], "Jaycee Horne": ['medko'], "Baker Mayfeild": ['ineye', 'fearless'], "Bucky Irvin": ['jukebox', 'joystick'],
  "Tristan Wurfs": ['toughnut', 'passprot'], "Vita Veya": ['eltoro', 'swimclub'], "Rueben Bane": ['quickjump'], "Yaya Diabee": ['quickjump'],
  "Antoine Winfeld Jr.": ['lurker'], "Trey McBryde": ['deepin', 'midout'], "Josh Sweats": ['edgethreat', 'extracredit'], "Walter Nolan": ['quickjump'],
  "Budda Bakery": ['securetackler', 'midzoneko'], "Matthew Staffurd": ['longeye', 'nolookeye'], "Kyren Williamz": ['armbar', 'reachit'],
  "Puka Nakua": ['shortin', 'routetech'], "Byron Yung": ['quickjump'], "Trent McDuffy": ['deepko', 'inshade'], "Brock Purdie": ['ineye', 'fearless'],
  "Christian McCafferty": ['bfmismatch', 'evasive'], "Mike Evanz": ['deepout', 'rzthreat'], "George Kittel": ['shortout', 'shortin'],
  "Trent Williamson": ['edgeprot', 'nasty'], "Nick Bossa": ['maxeffort', 'extracredit'], "DeForest Bucknor": ['eltoro', 'underpressure'],
  "Fred Warnor": ['enforcer', 'lurker'], "Jaxon Smith-Njigbuh": ['deepout', 'quickjump'], "Quenton Nelsen": ['puller', 'nasty'],
  "Leonard Willums": ['eltoro', 'bogo'], "DeMarcus Lorrence": ['edgethreat', 'nooutsiders'], "Devon Witherspoone": ['shortko', 'inshade']
};

const abFor = name => (AB_REAL[name] || []).map(id => AB_TYPES[id] && { id, ...AB_TYPES[id] }).filter(Boolean);
const abHas = (p, fx) => !!(p && p.ab && p.ab.some(a => a.fx === fx));
// one-shot ones (Extender): once per play
function abFree(p, fx) { if (!abHas(p, fx) || p.abUsed === G.play) return false; p.abUsed = G.play; return true; }
// where a throw lands: short / mid / deep (from the line), in / out (the numbers), red zone, 3rd down
function abSpot(x, y, side) {
  const d = dirOf(side) * (x - G.los), out = y < 12 || y > FIELD_W - 12;
  return { short: d < 10, mid: d >= 10 && d < 20, deep: d >= 20, in: !out, out, rz: Math.abs(goalX(side) - G.los) <= 20, third: G.down === 3 };
}
const abWhen = (a, s, extra) => !a.c || a.c.split(' ').every(k => s[k] || (extra && extra[k]));
// throw accuracy: multiplier on the miss distance
function abThrowErr(qb, c) {
  if (!qb.ab) return 1;
  let m = 1;
  const s = abSpot(c.tx, c.ty, qb.side);
  if (!c.pressure && !c.onRun && qb.ab.some(a => a.fx === 'eye' && abWhen(a, s, { lob: c.style === 'lob' }))) m *= 0.8;
  if (!c.pressure && c.onRun && abHas(qb, 'runeye')) m *= 0.75;
  if (c.pressure && abHas(qb, 'fearless')) m *= 0.85;
  return m;
}
// catch chance: + for the catcher's abilities, - for the defender's knockouts
function abCatch(rcv, def, close, f, land) {
  const s = abSpot(land.x, land.y, f.passer.side);
  let d = 0;
  if (rcv.ab) {
    if (rcv.ab.some(a => a.fx === 'elite' && abWhen(a, s))) d += 0.07;
    if (close && def && rcv.ab.some(a => a.fx === 'contest' && abWhen(a, s, { big: def.pos === 'LB' || def.pos === 'DL' }))) d += 0.06;
  }
  if (rcv.pos === 'RB' && abHas(f.passer, 'gift')) d += 0.06;
  if (close && def && def.ab && def.ab.some(a => a.fx === 'ko' && abWhen(a, s, { back: rcv.pos === 'RB' || rcv.pos === 'TE' }))) d -= 0.07;
  return d;
}
// tackle chance: + helps the tackler, - helps the runner
function abTackle(car, df, front) {
  let d = 0;
  const moved = car.juke > 0 || car.spin > 0;
  if (moved && abHas(car, 'moves')) d -= 0.06;
  if (car.stiff > 0 && front && abHas(car, 'stiff')) d -= 0.08;
  if (abHas(car, 'tank')) d -= 0.05;
  if (abHas(df, 'tackler')) d += moved ? 0.08 : 0.04;
  return d;
}
// block fights: how fast the defender sheds (df = defender, bl = blocker)
function abShed(df, bl, passPro) {
  let m = 1;
  if (passPro) { if (abHas(df, 'rush')) m *= 1.25; if (abHas(bl, 'pblock')) m *= 0.82; }
  else { if (abHas(df, 'runstop')) m *= 1.3; if (abHas(bl, 'rblock')) m *= 0.82; }
  return m;
}
// list for cards / roster views: gold diamond + name + one line
function abHtml(name, opt = {}) {
  const xf = !opt.noXF && typeof XF_REAL !== 'undefined' && XF_REAL[name] && XF_TYPES[XF_REAL[name]];
  const L = abFor(name);
  if (!xf && !L.length) return opt.empty || '';
  const row = (a, cls) => `<div class="abRow${cls}"><i class="abIco"></i><b>${a.name}</b><span>${a.desc}</span></div>`;
  return `<div class="abList">${xf ? row(xf, ' xf') : ''}${L.map(a => row(a, '')).join('')}</div>`;
}
// roster rows: small gold diamond + ability name after his age / speed
function abTags(name) {
  return abFor(name).map(a => `<span class="abTag"><i class="abIco"></i>${a.name}</span>`).join('');
}
