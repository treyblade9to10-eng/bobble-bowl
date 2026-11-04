// ---- SAVE CLIP: films a highlight (or the instant replay) off the game canvas with captureStream + MediaRecorder,
// then hands you the video: the share sheet when the browser can share files (iPhone, Android, Chromebook), else a download.
// iPhone Safari records mp4, Chrome mp4 (newer) or webm. Clips are kept under 10 seconds.
// The video is a smaller copy of the screen (540 lines, 30 fps; 432 / 24 on a weak device) with a score bug + watermark painted
// on the copy only, so filming doesn't slow the game down. ----
const CLIP_MAX = 9.6; // seconds of video
const Clips = {
  rec: null, chunks: [], busy: false, cancelled: false, blob: null, file: null, name: '', t0: 0, dur: CLIP_MAX, rc: null, info: null,
  mime() {
    if (typeof MediaRecorder === 'undefined' || !cv.captureStream) return null;
    for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
    }
    return null;
  },
  can() { return this._can != null ? this._can : (this._can = !!this.mime()); }, // SAVE CLIP buttons only show where it works
  ok() {
    if (this.busy) return false;
    if (!this.mime()) { this.say("This browser can't record video clips. Try Chrome, or Safari on iPhone / iPad."); return false; }
    return true;
  },
  // the smaller copy that gets filmed: same shape as the screen, even sizes (video encoders want them)
  makeCanvas() {
    const weak = (typeof Gfx !== 'undefined' && (Gfx.fast || (Gfx.hint && Gfx.hint.weak)));
    const H = Math.min(weak ? 432 : 540, cv.height), W = Math.round(H * cv.width / cv.height / 2) * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H - H % 2;
    c.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;pointer-events:none'; // in the page (Safari won't film a loose canvas)
    document.body.appendChild(c);
    this.fps = weak ? 24 : 30;
    return c;
  },
  // copy the game picture over + the score bug + the watermark (runs right after the game draws each frame)
  paint() {
    const c = this.rc; if (!c) return;
    const now = performance.now(); if (now - (this.lastP || 0) < 1000 / this.fps - 4) return; this.lastP = now;
    const g = c.getContext('2d'), W = c.width, H = c.height, u = H / 720;
    g.drawImage(cv, 0, 0, W, H);
    g.save(); g.scale(u, u); this.overlay(g, W / u); g.restore();
  },
  overlay(g, w) {
    const I = this.info, T = G.teams, HD = '"Barlow Condensed", Arial, sans-serif';
    g.textBaseline = 'middle';
    // watermark, top right
    g.font = `italic 900 30px ${HD}`; g.textAlign = 'right';
    g.fillStyle = '#000000a0'; g.fillText('BOBBLE BOWL', w - 26, 73); g.fillStyle = '#ffffffd8'; g.fillText('BOBBLE', w - 26 - g.measureText(' BOWL').width, 71);
    g.fillStyle = '#f6c31c'; g.fillText(' BOWL', w - 26, 71);
    if (!I || !T) return;
    // score bug, top center: AWAY 14  HOME 21  Q4 1:12
    const cell = 118, bw = cell * 2 + 110, x = w / 2 - bw / 2, y = 52, h = 40;
    g.fillStyle = '#0b0f16e8'; g.fillRect(x, y, bw, h);
    [1, 0].forEach((s, i) => {
      const t = T[s], cx = x + i * cell;
      g.fillStyle = t.c1 === '#000000' ? '#333' : t.c1; g.fillRect(cx, y, cell - 4, h);
      g.fillStyle = t.c2 || '#fff'; g.fillRect(cx, y + h - 4, cell - 4, 4);
      g.fillStyle = textOn(t.c1); g.font = `italic 900 22px ${HD}`; g.textAlign = 'left'; g.fillText(t.id, cx + 10, y + h / 2);
      g.font = `italic 900 28px ${HD}`; g.textAlign = 'right'; g.fillText(I.score[s], cx + cell - 14, y + h / 2 + 1);
    });
    g.fillStyle = '#ffd23f'; g.font = `800 19px ${HD}`; g.textAlign = 'center'; g.fillText(`${I.q}  ${I.clock}`, x + cell * 2 + 53, y + h / 2 + 1);
  },
  loop() {
    if (!this.rc) return;
    requestAnimationFrame(() => this.loop()); // queued after the game's frame, so it copies the finished picture
    try { this.paint(); } catch (e) {}
  },
  // start filming the canvas (dur = how long the clip should run, for the progress bar)
  start(name, dur, info) {
    const type = this.mime();
    this.info = info || null; this.rc = this.makeCanvas(); this.lastP = 0; this.paint();
    try {
      const stream = this.rc.captureStream(this.fps);
      this.rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2.5e6 });
    } catch (e) {
      try { this.rec = new MediaRecorder(this.rc.captureStream(this.fps)); } catch (e2) { this.rec = null; this.drop(); this.say("This browser can't record video clips. Try Chrome, or Safari on iPhone / iPad."); return false; }
    }
    this.loop();
    this.chunks = []; this.busy = true; this.cancelled = false; this.blob = null; this.file = null; this.t0 = performance.now(); this.dur = dur || CLIP_MAX;
    this.name = 'bobble-bowl-' + (name || 'clip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.rec.start(1000);
    this.ui('rec');
    clearInterval(this.tick); this.tick = setInterval(() => this.paintRec(), 100);
    return true;
  },
  // the clip is over: wrap the file up and offer it
  drop() { const c = this.rc; this.rc = null; if (c) c.remove(); },
  stop() {
    clearInterval(this.tick);
    const r = this.rec; this.rec = null;
    const rc = this.rc; this.rc = null; setTimeout(() => { if (rc) rc.remove(); }, 300); // the copy canvas goes (after the recorder's last frame)
    if (!r) { this.busy = false; return; }
    r.onstop = () => {
      try { r.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this.busy = false;
      if (this.cancelled) { this.ui(null); return; }
      const type = (r.mimeType || this.mime() || 'video/webm').split(';')[0];
      this.blob = new Blob(this.chunks, { type }); this.chunks = [];
      if (!this.blob.size) { this.say("Couldn't save that clip. Try again."); return; }
      this.file = new File([this.blob], `${this.name}.${this.ext()}`, { type: this.blob.type });
      this.ui('ready');
    };
    try { r.stop(); } catch (e) { this.busy = false; this.ui(null); }
  },
  cancel() { this.cancelled = true; if (Highlights.on && Highlights.rec) Highlights.stop(); else if (Replay.on && Replay.recClip) Replay.finish(); else this.stop(); },
  ext() { return this.blob && this.blob.type.includes('mp4') ? 'mp4' : 'webm'; },
  // can this browser hand the file to the share sheet? (iPhone / Android / Chromebook yes, most desktops no)
  canShare() { try { return !!(this.file && navigator.share && navigator.canShare && navigator.canShare({ files: [this.file] })); } catch (e) { return false; } },
  // the share sheet (Messages, Save Video...). No awaits before navigator.share: Safari needs it straight from the tap
  async share() {
    if (!this.file) return;
    if (!this.canShare()) return this.download();
    try { await navigator.share({ files: [this.file], title: 'Bobble Bowl highlight' }); this.ui(null); }
    catch (e) { if (!e || e.name !== 'AbortError') this.download(); }
  },
  download() {
    if (!this.file) return;
    const url = URL.createObjectURL(this.file), a = document.createElement('a');
    a.href = url; a.download = this.file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    this.ui(null);
  },
  say(msg) { this.msg = msg; this.ui('msg'); },

  // ---------- the little bar at the top (it's HTML, so it isn't in the video) ----------
  el() {
    let el = document.getElementById('clipUI'); if (el) return el;
    el = document.createElement('div'); el.id = 'clipUI';
    document.getElementById('stage').appendChild(el);
    el.addEventListener('pointerdown', e => e.stopPropagation());
    return el;
  },
  ui(st) {
    const el = this.el();
    el.className = st ? 'show ' + st : '';
    if (st === 'rec') el.innerHTML = `<span class="ciDot"></span><b>SAVING CLIP...</b><span class="ciBar"><i id="ciFill"></i></span><span id="ciPct">0%</span><button id="ciCancel">CANCEL</button>`;
    else if (st === 'ready') { // share sheet where it works; computers also get a plain download
      const sh = this.canShare(), dl = !sh || G.mode !== 'mobile';
      el.innerHTML = `<b>CLIP READY</b><span class="ciInfo">${(this.blob.size / 1048576).toFixed(1)} MB  ·  ${this.ext().toUpperCase()}</span>${sh ? `<button class="gold" id="ciSave">${G.mode === 'mobile' ? 'SAVE / SHARE' : 'SHARE'}</button>` : ''}${dl ? `<button class="${sh ? '' : 'gold'}" id="ciDl">DOWNLOAD</button>` : ''}<button id="ciClose">CLOSE</button>`;
    }
    else if (st === 'msg') el.innerHTML = `<b class="ciMsg">${this.msg}</b><button id="ciClose">OK</button>`;
    const on = (id, f) => { const b = document.getElementById(id); if (b) b.onclick = e => { e.stopPropagation(); Sound.click(); f(); }; };
    on('ciCancel', () => this.cancel()); on('ciSave', () => this.share()); on('ciDl', () => this.download()); on('ciClose', () => { this.blob = this.file = null; this.ui(null); });
  },
  paintRec() {
    const f = document.getElementById('ciFill'), p = document.getElementById('ciPct'); if (!f) return;
    const k = Math.min(1, (performance.now() - this.t0) / 1000 / this.dur);
    f.style.width = Math.round(k * 100) + '%'; p.textContent = Math.round(k * 100) + '%';
  },

  // ---------- what gets filmed ----------
  // a highlight from the reel: played once from a start point that keeps it under the limit, no buttons on screen
  highlight(c, then) {
    if (!c || !this.ok()) return;
    Highlights.play([c], () => { Highlights.rec = false; this.stop(); if (then) then(); });
    Highlights.rec = true;
    const u0 = Highlights.recStart(CLIP_MAX - 1.1); // the end hold + fade is about a second
    Highlights.u = u0; Highlights.age = 0; Highlights.apply(u0);
    if (!this.start(c.title, Highlights.runTime(u0) + 1.0, { score: c.score, q: c.q, clock: c.clock })) { Highlights.rec = false; Highlights.stop(); }
  },
  // the instant replay you're watching: start it over from the top and film it
  replay() {
    if (!Replay.on || !this.ok()) return;
    Replay.recClip = true;
    Replay.t = Math.max(0, Replay.frames.length - 60 * (CLIP_MAX - 0.8) * 0.55); Replay.hold = 0.6; // replay runs at 0.55x
    const c = Math.max(0, Math.ceil(G.clock || 0));
    const info = { score: G.score.slice(), q: G.quarter > 4 ? 'OT' : `Q${G.quarter}`, clock: `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}` };
    if (!this.start(G.lastResult && G.lastResult.type === 'td' ? 'touchdown' : 'replay', (Replay.frames.length - 1 - Replay.t) / 60 / 0.55 + 0.6, info)) Replay.recClip = false;
  }
};
