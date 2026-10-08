// ---- Stadiums: every team's home field (made-up names), domes keep the weather out ----
// roof: 'dome' = indoors (always clear), 'open' = weather happens. turf: 'turf' looks brighter than real grass.
const STADIUMS = {
  BUF: ['Orchard Hill Stadium', 'open', 'turf'], MIA: ['Sunshine Rock Stadium', 'open', 'grass'], NE: ['Razor Field', 'open', 'turf'], NYJ: ['MetLive Stadium', 'open', 'turf'],
  BAL: ['Crab Bank Stadium', 'open', 'grass'], CIN: ['Jungle Stadium', 'open', 'turf'], CLE: ['Lakefront Field', 'open', 'grass'], PIT: ['Three Rivers Field', 'open', 'grass'],
  HOU: ['Energy Dome', 'dome', 'turf'], IND: ['Lucky Oil Stadium', 'dome', 'turf'], JAX: ['Riverbank Stadium', 'open', 'grass'], TEN: ['Music City Stadium', 'open', 'grass'],
  DEN: ['Mile High Field', 'open', 'grass'], KC: ['Arrowhead Hill Stadium', 'open', 'grass'], LV: ['Desert Dome', 'dome', 'grass'], LAC: ['SoFly Stadium', 'dome', 'turf'],
  DAL: ['Big Star Dome', 'dome', 'turf'], NYG: ['MetLive Stadium', 'open', 'turf'], PHI: ['The Linc Field', 'open', 'grass'], WAS: ['Landover Field', 'open', 'grass'],
  CHI: ['Lakeshore Field', 'open', 'grass'], DET: ['Motor City Dome', 'dome', 'turf'], GB: ['Frozen Tundra Field', 'open', 'grass'], MIN: ['Viking Hall', 'dome', 'turf'],
  ATL: ['Peach Dome', 'dome', 'turf'], CAR: ['Queen City Stadium', 'open', 'turf'], NO: ['Bayou Superdome', 'dome', 'turf'], TB: ['Pirate Ship Stadium', 'open', 'grass'],
  ARI: ['Cactus Dome', 'dome', 'grass'], LAR: ['SoFly Stadium', 'dome', 'turf'], SF: ['Bay Gold Stadium', 'open', 'grass'], SEA: ['Sound Field', 'open', 'turf']
};
const stadiumOf = team => { const s = team && STADIUMS[team.id]; return s ? { name: s[0], dome: s[1] === 'dome', turf: s[2] === 'turf' } : { name: 'Bobble Bowl Stadium', dome: false, turf: false }; };
