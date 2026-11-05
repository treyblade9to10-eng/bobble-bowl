// ---- Transfer saves to another device (iPhone Safari and the Home Screen app keep separate saves, so does a Chromebook) ----
// SEND puts this device's game saves in the online database under a 6-letter code (bobble/xfer/CODE) for 30 minutes.
// RECEIVE on the other device: type the code, see what gets replaced, confirm, and the game restarts with them.
// Only game saves go (bobble* keys), never this device's own settings (controls mode, graphics test) or online names / ids.
// Big saves get gzipped and split into pieces (each well under the database's limits). Received once = deleted.
const Xfer = {
  LIFE: 30 * 60000, PIECE: 400000, MAX: 9000000,
  // this device only, or online identity (leaderboard name + device id, online league seat): stays where it is
  SKIP: /^bobble(Mode|Welcome|GfxAuto|PadRumble|Boards|OSeason|OSeasonQ|OSName|OSTitle.*)$/,
  NAMES: { bobblePlaybook: 'playbook', bobbleRecords: 'records', bobbleGear: 'gear', bobbleField: 'fields', bobbleStarters: 'depth charts', bobbleBenches: 'benches',
    bobbleUnlocks: 'unlocks', bobbleTourney: 'tournament', bobbleTourneyLast: 'tournament', bobbleDraftChamps: 'draft challenge', bobblePotw: 'player of the week',
    bobbleHStripe: 'uniforms', bobblePractice: 'practice', bobbleTutorial: 'tutorial', bobbleSel: 'team picks', bobbleOnline: 'online setup', bobbleShow: 'show settings',
    bobbleReplay: 'replays', bobbleQuickBowl: 'Bobble Bowl', bobbleSeasonSlot: 'season slot', bobbleCareerSlot: 'career slot' },
  keys() {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('bobble') && !this.SKIP.test(k)) out.push(k); } } catch (e) {}
    return out.sort();
  },
  // a short line for one save ("SEASON 1: YEAR 2, BEARS 8-3, WEEK 12 OF 17"), null = goes in the "also" list
  label(k, v) {
    let d = null; try { d = JSON.parse(v); } catch (e) {}
    let m;
    if ((m = k.match(/^bobbleSeason(\d?)$/))) {
      const s = d && typeof SeasonSlots !== 'undefined' ? SeasonSlots.summary(d) : null;
      return `SEASON ${m[1] || 1}: ` + (s ? `YEAR ${s.year}, ${(s.team && s.team.name || d.team).toUpperCase()} ${s.rec}, ${s.where}` : 'saved season');
    }
    if ((m = k.match(/^bobbleCAP(\d?)$/))) return `CAREER ${m[1] || 1}: ` + (d && d.name ? `${d.name}, ${d.pos || ''}${d.phase ? ' (' + String(d.phase).toUpperCase() + ')' : ''}` : 'my player');
    if (/^bobbleCareerSeason\d?$/.test(k)) return null; // (goes with its career)
    if (k === 'bobbleLive') return d && d.teams ? 'GAME IN PROGRESS: ' + (typeof SaveGame !== 'undefined' ? SaveGame.summary(d) : '') : 'game in progress';
    if (k === 'bobbleMyTeams') return `CREATED TEAMS (${Array.isArray(d) ? d.length : 0})` + (Array.isArray(d) && d.length ? ': ' + d.slice(0, 3).map(t => t.name).join(', ') + (d.length > 3 ? '...' : '') : '');
    if (k === 'bobbleTrophies') return 'TROPHY CASE';
    if (k === 'bobbleOpts') return 'SETTINGS';
    if (k === 'bobbleRanked') return d ? `ONLINE RANKED: ${Ranked.tier(d.r)} ${Math.round(d.r)}, ${d.w}-${d.l}${d.t ? '-' + d.t : ''}` : 'online ranked';
    return null;
  },
  summary(map) {
    const lines = [], also = new Set();
    for (const k of Object.keys(map).sort()) { const l = this.label(k, map[k]); if (l) lines.push([k, l]); else if (!/^bobbleCareerSeason/.test(k)) also.add(this.NAMES[k] || 'other'); }
    const ORD = ['bobbleSeason', 'bobbleCAP', 'bobbleLive', 'bobbleMyTeams', 'bobbleTrophies', 'bobbleRanked', 'bobbleOpts'], at = k => ORD.findIndex(o => k.startsWith(o));
    lines.sort((a, b) => at(a[0]) - at(b[0]) || (a[0] < b[0] ? -1 : 1)); // seasons + careers first
    return { lines, also: [...also] };
  },
  local() { const o = {}; for (const k of this.keys()) { try { o[k] = localStorage.getItem(k); } catch (e) {} } return o; },
  makeCode() { let c = ''; for (let i = 0; i < 6; i++) c += NET_CHARS[Math.floor(Math.random() * NET_CHARS.length)]; return c; },

  // ---- packing: JSON -> gzip -> base64 (plain JSON if this browser can't zip) ----
  async zip(str) {
    if (typeof CompressionStream !== 'function') return { z: 0, d: str };
    const buf = new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { z: 1, d: btoa(bin) };
  },
  async unzip(z, d) {
    if (!z) return d;
    if (typeof DecompressionStream !== 'function') throw new Error('nozip');
    const bin = atob(d), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  },
  // the database's clock (codes run out by its time, not this device's)
  now(db) { return new Promise(r => db.ref('.info/serverTimeOffset').once('value').then(sn => r(Date.now() + (+sn.val() || 0)), () => r(Date.now()))); },
  // old codes nobody picked up: gone after 30 minutes (checked whenever somebody sends)
  sweep(db, now) {
    db.ref('bobble/xferidx').once('value').then(sn => { const v = sn.val() || {}; for (const c in v) if (typeof v[c] !== 'number' || now - v[c] > this.LIFE) this.drop(db, c); }).catch(() => {});
  },
  drop(db, code) { db.ref('bobble/xfer/' + code).remove().catch(() => {}); db.ref('bobble/xferidx/' + code).remove().catch(() => {}); },

  async send(onStatus) {
    const map = this.local(), sum = this.summary(map);
    if (!sum.lines.length && !sum.also.length) throw new Error('nothing');
    onStatus('PACKING YOUR SAVES...');
    const body = JSON.stringify({ v: 1, keys: map });
    const p = body.length > 400000 ? await this.zip(body) : { z: 0, d: body }; // (small: plain, works on any browser)
    if (p.d.length > this.MAX) throw new Error('big');
    const db = await Relay.load(), now = await this.now(db);
    this.sweep(db, now);
    let code = null;
    for (let i = 0; i < 6 && !code; i++) { const c = this.makeCode(), sn = await db.ref('bobble/xfer/' + c + '/m').once('value'); if (!sn.val()) code = c; }
    if (!code) throw new Error('code');
    const n = Math.max(1, Math.ceil(p.d.length / this.PIECE));
    for (let i = 0; i < n; i++) {
      onStatus(n > 1 ? `UPLOADING ${Math.round(100 * i / n)}%...` : 'UPLOADING...');
      await db.ref(`bobble/xfer/${code}/c/${i}`).set(p.d.slice(i * this.PIECE, (i + 1) * this.PIECE));
    }
    // the label list goes last: a code only "exists" once every piece is up
    const TS = firebase.database.ServerValue.TIMESTAMP;
    await db.ref(`bobble/xfer/${code}/m`).set({ t: TS, v: 1, n, z: p.z, len: p.d.length, from: (document.querySelector('.ver') || {}).textContent || '', sum: sum.lines.map(l => l[1]).slice(0, 30), also: sum.also });
    await db.ref('bobble/xferidx/' + code).set(TS);
    this.sent = { code, at: Date.now(), sum };
    return code;
  },
  async fetch(code, onStatus) {
    const db = await Relay.load();
    const m = (await db.ref(`bobble/xfer/${code}/m`).once('value')).val();
    if (!m || !m.n) return { err: 'No saves with that code. Check it, or SEND again on the other device.' };
    if ((await this.now(db)) - m.t > this.LIFE) { this.drop(db, code); return { err: 'That code ran out (they last 30 minutes). SEND again on the other device.' }; }
    let d = '';
    for (let i = 0; i < m.n; i++) {
      onStatus(m.n > 1 ? `DOWNLOADING ${Math.round(100 * i / m.n)}%...` : 'DOWNLOADING...');
      const c = (await db.ref(`bobble/xfer/${code}/c/${i}`).once('value')).val();
      if (typeof c !== 'string') return { err: 'Part of those saves is missing. SEND again on the other device.' };
      d += c;
    }
    let data;
    try { data = JSON.parse(await this.unzip(m.z, d)); } catch (e) { return { err: e.message === 'nozip' ? 'This browser is too old to unpack big saves. Update it (or iOS) and try again.' : 'Those saves came through broken. SEND again on the other device.' }; }
    if (!data || typeof data.keys !== 'object') return { err: 'Those saves came through broken. SEND again on the other device.' };
    const keys = {};
    for (const k in data.keys) if (/^bobble[A-Za-z0-9:_-]*$/.test(k) && !this.SKIP.test(k) && typeof data.keys[k] === 'string') keys[k] = data.keys[k];
    return { code, keys, db };
  },
  // write them in (all or nothing), drop the code, restart
  apply(got) {
    const keep = {}, opts = (() => { try { return JSON.parse(localStorage.getItem('bobbleOpts') || 'null'); } catch (e) { return null; } })();
    for (const k in got.keys) keep[k] = localStorage.getItem(k);
    try {
      for (const k in got.keys) {
        let v = got.keys[k];
        if (k === 'bobbleOpts' && opts) { try { const o = JSON.parse(v); o.optGfx = opts.optGfx; v = JSON.stringify(o); } catch (e) {} } // (graphics setting fits this device)
        localStorage.setItem(k, v);
      }
    } catch (e) {
      for (const k in keep) try { if (keep[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, keep[k]); } catch (e2) {}
      return false;
    }
    this.drop(got.db, got.code);
    return true;
  }
};

// ---- the screen ----
(() => {
  const el = document.createElement('div'); el.id = 'xfer'; el.className = 'screen';
  el.innerHTML = `<div id="xfTop"><span>ANOTHER DEVICE</span><b>TRANSFER SAVES</b></div>
    <div id="xfRow">
      <div id="xfList" class="xfPanel"></div>
      <div id="xfSide" class="xfPanel">
        <div id="xfPick"><button class="big gold" id="xfSend">SEND</button><button class="big" id="xfRecv">RECEIVE</button></div>
        <div id="xfCodeBox" style="display:none"><div class="onLbl">YOUR CODE</div><div id="xfCode">......</div></div>
        <div id="xfInBox" style="display:none"><input id="xfCodeIn" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE"><button class="big gold" id="xfGo">GET</button></div>
        <div id="xfOk" style="display:none"><button class="big gold" id="xfYes">REPLACE MY SAVES</button></div>
        <div id="xfStatus"></div>
        <button id="xfBack">BACK</button>
      </div>
    </div>`;
  $('stage').appendChild(el);
  screens.push('xfer'); menuScreens.push('xfer');
})();
{
  const HELP = 'SEND on the device that has your saves. RECEIVE on the one that should get them, and type the code. Works for 30 minutes, one time.';
  const st = t => { $('xfStatus').textContent = t; };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const list = (head, sum, note) => `<div class="xfHead">${head}</div>` + (sum.lines.length ? sum.lines.map(l => `<div class="xfLine">${esc(l[1] || l)}</div>`).join('') : '<div class="xfLine dim">No saves yet</div>') +
    (sum.also.length ? `<div class="xfAlso">ALSO: ${esc(sum.also.join(', ').toUpperCase())}</div>` : '') + (note ? `<div class="xfNote">${note}</div>` : '');
  let got = null, tick = null;
  const mode = m => {
    $('xfPick').style.display = m === 'pick' ? '' : 'none'; $('xfCodeBox').style.display = m === 'code' ? '' : 'none';
    $('xfInBox').style.display = m === 'in' ? '' : 'none'; $('xfOk').style.display = m === 'ok' ? '' : 'none';
  };
  const open = () => {
    got = null; clearInterval(tick); mode('pick'); st(HELP);
    $('xfList').innerHTML = list('ON THIS DEVICE', Xfer.summary(Xfer.local()));
    show('xfer');
  };
  window.openXfer = open;
  $('xfBack').onclick = () => { Sound.click(); clearInterval(tick); if ($('xfPick').style.display === 'none') return open(); openOnline(); }; // (inside SEND / RECEIVE: back to the two buttons)
  $('xfSend').onclick = async () => {
    Sound.click(); mode('code'); $('xfCode').textContent = '......';
    try {
      const code = await Xfer.send(st);
      $('xfCode').textContent = code;
      const left = () => { const m = Math.max(0, Math.ceil((Xfer.LIFE - (Date.now() - Xfer.sent.at)) / 60000)); st(m ? `On your other device: ONLINE, TRANSFER SAVES, RECEIVE, then type this code. Good for ${m} more minute${m === 1 ? '' : 's'}, one time.` : 'That code ran out. SEND again.'); };
      left(); clearInterval(tick); tick = setInterval(() => { if ($('xfer').classList.contains('show')) left(); else clearInterval(tick); }, 15000);
      $('xfList').innerHTML = list('SENT', Xfer.sent.sum);
    } catch (e) {
      $('xfCode').textContent = '......'; mode('pick');
      st(e.message === 'nothing' ? 'No saves on this device yet.' : e.message === 'big' ? 'Your saves are too big to send. Delete an old Season or Career slot and try again.' : "Can't reach the online server. Check your internet.");
    }
  };
  $('xfRecv').onclick = () => { Sound.click(); mode('in'); $('xfCodeIn').value = ''; $('xfCodeIn').focus(); st('Type the 6-letter code from your other device.'); };
  $('xfGo').onclick = async () => {
    const code = $('xfCodeIn').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return st('Codes are 6 letters/numbers.');
    if ([...code].some(c => !NET_CHARS.includes(c))) return st('Codes never use O, 0, I, 1 or L. Look at the code again.');
    Sound.click(); st('LOOKING FOR THAT CODE...');
    let r; try { r = await Xfer.fetch(code, st); } catch (e) { r = { err: "Can't reach the online server. Check your internet." }; }
    if (r.err) return st(r.err);
    got = r;
    const inc = Xfer.summary(r.keys), mine = {};
    for (const k in r.keys) { const v = localStorage.getItem(k); if (v != null) mine[k] = v; }
    const old = Xfer.summary(mine);
    $('xfList').innerHTML = list('COMING IN', inc) + `<div class="xfGap"></div>` + list('REPLACED ON THIS DEVICE', old, 'Saves that are only on this device stay.');
    mode('ok'); st('Replace the saves on this device with these? This can\'t be undone.');
  };
  $('xfYes').onclick = () => {
    if (!got) return;
    Sound.click();
    if (!Xfer.apply(got)) { got = null; mode('in'); return st('Not enough room on this device for those saves. Nothing was changed.'); }
    mode(''); st('DONE. RESTARTING WITH YOUR SAVES...');
    setTimeout(() => location.reload(), 600);
  };
  $('xfCodeIn').addEventListener('keydown', e => { if (e.code === 'Enter') $('xfGo').onclick(); e.stopPropagation(); });
  // the way in: next to BACK on the ONLINE screen
  const b = document.createElement('button'); b.id = 'onXfer'; b.textContent = 'TRANSFER SAVES';
  const back = $('onBack'), row = document.createElement('div'); row.id = 'onBackRow';
  back.parentNode.insertBefore(row, back); row.appendChild(back); row.appendChild(b);
  b.onclick = () => { if (Net.role) return; Sound.click(); open(); };
}
