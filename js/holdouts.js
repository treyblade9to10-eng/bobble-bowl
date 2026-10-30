// ---- Holdouts + trade requests (franchise, your team only, rare: 0-2 a season) ----
// Preseason: a star who is way underpaid for how good he is may hold out. He sits (like an injury, 'holdout') until you give him a raise that fits under the cap.
// Mid-season: a star on a losing team may ask to be traded. Trade him by the deadline, or he plays a little worse the rest of the year.
// d.hold = { y, name, pos, want, done }   d.treq = { y, name, pos, wk, state: 'open' | 'traded' | 'stayed' }
const Holdout = {
  on() { const d = Season.data; return !!d && !(Season.isCareer && Season.isCareer()); },
  mine(name) { return Contracts.all(Season.data.team).find(p => p[1] === name) || null; },
  // start of a new year (after the draft): is anyone way underpaid?
  check() {
    const d = Season.data; if (!this.on() || d.year < 2 || (d.hold && d.hold.y === d.year)) return;
    Contracts.ensure();
    const me = d.team, R = Season.ensureRosters()[me];
    const C = R.off.concat(R.def).filter(p => p && p[3] >= 84 && !Season.hurt(p) && !(p[6] && p[6].cap)).map(p => ({ p, c: Contracts.con(p), v: Contracts.value(p) }))
      .filter(x => x.c && x.c.yrs >= 1 && x.c.sal < x.v * 0.55).sort((a, b) => a.c.sal / a.v - b.c.sal / b.v);
    if (!C.length || !chance(0.35)) return;
    const { p, v } = C[0], m = p[6], want = Math.round(v * 1.05 * 10) / 10;
    d.hold = { y: d.year, name: p[1], pos: p[0], want };
    m.inj = d.games + 4; m.injWhat = 'holdout'; delete m.injSlot;
    for (const side of ['off', 'def']) { const i = R[side].indexOf(p); if (i >= 0) { m.injSlot = side + ':' + i; m.injSub = Season.fillSlot(me, side, i, d.week)[1]; } }
    Season.news(`HOLDOUT: ${p[0]} ${p[1]} (${p[3]}) won't play until he gets a new deal. He wants ${cmoney(want)} a year.`);
    Feed.say(Feed.ins, `${p[1]} is holding out from ${tName(me)} camp. He wants a new deal around ${cmoney(want)} a year 💰`, 0.75);
    Feed.say(Feed.pl(p[1], me, p[2]), `Just want what's fair. Love the city. Love the fans. Business is business 🤷`, 0.6);
    Season.save();
  },
  // give him the raise: back in the lineup right away
  pay() {
    const d = Season.data, H = d.hold, p = H && this.mine(H.name); if (!p || H.done) return 'gone';
    const c = Contracts.con(p) || Contracts.give(p, { sal: 1, yrs: 1 })[6].con;
    if (Contracts.room(d.team) + c.sal < H.want) return 'cap';
    c.sal = H.want; c.yrs = Math.max(c.yrs || 1, 1) + 2; H.done = 'paid';
    this.back(p);
    Season.news(`HOLDOUT OVER: ${p[0]} ${p[1]} signs a new deal (${cmoney(H.want)} a year) and is back in the lineup.`);
    Feed.say(Feed.pl(p[1], d.team, p[2]), `Deal done. Back to work. Let's get it 🙌`, 0.7);
    Season.save(); return 'ok';
  },
  back(p) {
    const me = Season.data.team, m = p[6], slot = m.injSlot; delete m.inj; delete m.injWhat; delete m.injSlot; delete m.injSub;
    const R = Season.ensureRosters()[me], bench = Season.bench(me), bi = bench.indexOf(p);
    if (slot && bi >= 0) { const [side, i] = slot.split(':'), cur = R[side][+i]; if (cur && posGroup(cur[0]) === posGroup(p[0]) && p[3] >= cur[3]) { bench[bi] = cur; R[side][+i] = p; } }
  },
  // every week: holdout traded away? trade request?
  week() {
    const d = Season.data, me = d.team, H = d.hold;
    if (H && H.y === d.year && !H.done && !this.mine(H.name)) { // traded while holding out: he reports to his new team
      H.done = 'traded'; const R = Season.ensureRosters();
      for (const id in R) for (const p of Contracts.all(id)) if (p[1] === H.name && p[6] && p[6].injWhat === 'holdout') { delete p[6].inj; delete p[6].injWhat; delete p[6].injSlot; delete p[6].injSub; Season.setLineup(id); }
    }
    const T = d.treq;
    if (T && T.y === d.year && T.state === 'open') {
      const p = this.mine(T.name);
      if (!p) { T.state = 'traded'; Feed.say(Feed.pl(T.name, me, ''), `Grateful for my time with the ${tName(me)}. New chapter 🙏`, 0.6); }
      else if (!Season.canTrade()) {
        T.state = 'stayed'; Dilemma.boost(p, -2, d.games - d.week + 4);
        Season.news(`TRADE REQUEST: the deadline passed and ${p[0]} ${p[1]} is still here. He's not happy: -2 OVR the rest of the season.`);
        Feed.say(Feed.ins, `${p[1]} did not get his trade before the deadline. Sources say he is not happy about it 😬`, 0.6);
      }
      return;
    }
    if (d.phase !== 'regular' || !Season.canTrade() || d.week < 3 || (T && T.y === d.year) || Season.pct(me) > 0.34) return;
    const R = Season.ensureRosters()[me], star = R.off.concat(R.def).filter(p => p && p[3] >= 85 && !Season.hurt(p) && !(p[6] && p[6].cap)).sort((a, b) => b[3] - a[3])[0];
    if (!star || !chance(0.18)) return;
    d.treq = { y: d.year, name: star[1], pos: star[0], wk: d.week, state: 'open' };
    Season.news(`TRADE REQUEST: ${star[0]} ${star[1]} (${star[3]}) wants out. Trade him by week ${Season.deadline()} or he won't be happy.`);
    Feed.say(Feed.ins, `Sources: ${star[1]} has asked the ${tName(me)} for a trade. He wants to play for a winner 👀`, 0.85);
    Feed.say(Feed.pl(star[1], me, star[2]), `Just want to win. That's it 🤐`, 0.7);
  },
  // the card on the hub (only when something is going on)
  card() {
    const d = Season.data, H = d.hold && d.hold.y === d.year && !d.hold.done ? d.hold : null, T = d.treq && d.treq.y === d.year && d.treq.state === 'open' ? d.treq : null;
    if (!H && !T) return '';
    let h = '';
    if (H) { const p = this.mine(H.name), c = p && Contracts.con(p), can = p && Contracts.room(d.team) + ((c && c.sal) || 0) >= H.want;
      h += `<div class="fhRow"><span><b>${H.pos} ${H.name}</b> is holding out</span><em class="fhTag r">OUT</em></div><div class="fhLine">He wants ${cmoney(H.want)} a year${c ? ` (now ${cmoney(c.sal)})` : ''}. He plays again when he gets it.</div>
        <button class="fhBtn${can ? ' gold' : ''}" id="hoPay"${can ? '' : ' disabled'}>${can ? `GIVE HIM ${cmoney(H.want)} A YEAR` : 'NOT ENOUGH CAP ROOM'}</button>`; }
    if (T) h += `${H ? '<div class="fhGap"></div>' : ''}<div class="fhRow"><span><b>${T.pos} ${T.name}</b> wants a trade</span><em class="fhTag c">UNHAPPY</em></div><div class="fhLine">Trade him by week ${Season.deadline()}, or he plays a little worse the rest of the year.</div>`
      + (Season.canTrade() ? `<button class="fhBtn" id="hoTrade">TRADE CENTER</button>` : '');
    return FH.card('fhHold', 'LOCKER ROOM', h);
  }
};
// hooks: preseason check after the draft, weekly check, hub card
{ const _ny = Season.nextYear; Season.nextYear = function () { const ch = _ny.call(this); try { Holdout.check(); } catch (e) { console.warn('holdout', e); } return ch; }; }
{ const _fw = Season.finishWeek; Season.finishWeek = function (s) { _fw.call(this, s); if (Holdout.on()) { try { Holdout.week(); } catch (e) { console.warn('holdout', e); } this.save(); } }; }
{ const _r = FH.render; FH.render = function () {
  _r.call(this);
  if (!Holdout.on()) return;
  const h = Holdout.card(), st = document.querySelector('#shStand .fhStand'); if (!h || !st) return;
  st.insertAdjacentHTML('afterend', h);
  const pay = $('hoPay'); if (pay) pay.onclick = () => { const r = Holdout.pay(); Sound[r === 'ok' ? 'td' : 'click'](); renderHub(); };
  const tr = $('hoTrade'); if (tr) tr.onclick = () => { Sound.click(); $('shTrade').onclick(); };
}; }
