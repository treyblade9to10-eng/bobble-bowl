// ---- Stadiums: every team's home field (real names), domes keep the weather out ----
// roof: 'dome' = indoors (always clear), 'open' = weather happens. turf: 'turf' looks brighter than real grass.
const STADIUMS = {
  BUF: ['Highmark Stadium', 'open', 'turf'], MIA: ['Hard Rock Stadium', 'open', 'grass'], NE: ['Gillette Stadium', 'open', 'turf'], NYJ: ['MetLife Stadium', 'open', 'turf'],
  BAL: ['M&T Bank Stadium', 'open', 'grass'], CIN: ['Paycor Stadium', 'open', 'turf'], CLE: ['Huntington Bank Field', 'open', 'grass'], PIT: ['Acrisure Stadium', 'open', 'grass'],
  HOU: ['NRG Stadium', 'dome', 'turf'], IND: ['Lucas Oil Stadium', 'dome', 'turf'], JAX: ['EverBank Stadium', 'open', 'grass'], TEN: ['Nissan Stadium', 'open', 'grass'],
  DEN: ['Empower Field at Mile High', 'open', 'grass'], KC: ['Arrowhead Stadium', 'open', 'grass'], LV: ['Allegiant Stadium', 'dome', 'grass'], LAC: ['SoFi Stadium', 'dome', 'turf'],
  DAL: ['AT&T Stadium', 'dome', 'turf'], NYG: ['MetLife Stadium', 'open', 'turf'], PHI: ['Lincoln Financial Field', 'open', 'grass'], WAS: ['Northwest Stadium', 'open', 'grass'],
  CHI: ['Soldier Field', 'open', 'grass'], DET: ['Ford Field', 'dome', 'turf'], GB: ['Lambeau Field', 'open', 'grass'], MIN: ['U.S. Bank Stadium', 'dome', 'turf'],
  ATL: ['Mercedes-Benz Stadium', 'dome', 'turf'], CAR: ['Bank of America Stadium', 'open', 'turf'], NO: ['Caesars Superdome', 'dome', 'turf'], TB: ['Raymond James Stadium', 'open', 'grass'],
  ARI: ['State Farm Stadium', 'dome', 'grass'], LAR: ['SoFi Stadium', 'dome', 'turf'], SF: ['Levi\'s Stadium', 'open', 'grass'], SEA: ['Lumen Field', 'open', 'turf']
};
// end zone paint for a few places (everyone else is solid)
const EZ_STYLE = { DEN: 'stripes', KC: 'stripes', GB: 'checker', CHI: 'stripes', DAL: 'checker', TB: 'stripes', SEA: 'checker', NO: 'checker', PIT: 'stripes', BUF: 'checker', LV: 'stripes', JAX: 'checker' };
const stadiumOf = team => { const st = stadiumBase(team); if (typeof FieldStyle !== 'undefined') { st.f = FieldStyle.of(team); st.turf = st.f.surf === 'turf'; } return st; };
const stadiumBase = team => {
  if (team && team.custom) return { name: team.stadium || 'Home Field', dome: !!team.dome, turf: false };
  const s = team && STADIUMS[team.id], st = s ? { name: s[0], dome: s[1] === 'dome', turf: s[2] === 'turf' } : { name: 'Bobble Bowl Stadium', dome: false, turf: false };
  // Stadium Editor changes on this device (the roof stays real online so both players get the same weather)
  const o = s && typeof FieldStyle !== 'undefined' && FieldStyle.get(team.id);
  if (o) { if (o.name) st.name = o.name; if (o.dome != null && !(typeof G !== 'undefined' && G.online)) st.dome = o.dome; }
  return st;
};
