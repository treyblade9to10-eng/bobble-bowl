// ---- SAVE CLIP: films a highlight (or the instant replay) straight off the game canvas with canvas.captureStream + MediaRecorder,
// then hands you the video: the share sheet on phones (Save Video / Photos), a download on computers.
// iPhone Safari records mp4 ('video/mp4'), Chrome / Android / Firefox usually webm. Clips are kept under 10 seconds. ----
const CLIP_MAX = 9.6; // seconds of video
const Clips = {
  rec: null, chunks: [], busy: false, cancelled: false, blob: null, name: '', t0: 0, dur: CLIP_MAX,
  mime() {
    if (typeof MediaRecorder === 'undefined' || !cv.captureStream) return null;
    for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
    }
    return null;
  },
  ok() {
    if (this.busy) return false;
    if (!this.mime()) { this.say("This browser can't record video clips. Try Chrome, or Safari on iPhone / iPad."); return false; }
    return true;
  },
  // start filming the canvas (dur = how long the clip should run, for the progress bar)
  start(name, dur) {
    const type = this.mime();
    try {
      const stream = cv.captureStream(30);
      this.rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 });
    } catch (e) {
      try { this.rec = new MediaRecorder(cv.captureStream(30)); } catch (e2) { this.rec = null; this.say("This browser can't record video clips. Try Chrome, or Safari on iPhone / iPad."); return false; }
    }
    this.chunks = []; this.busy = true; this.cancelled = false; this.blob = null; this.t0 = performance.now(); this.dur = dur || CLIP_MAX;
    this.name = 'bobble-bowl-' + (name || 'clip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.rec.start(250);
    this.ui('rec');
    clearInterval(this.tick); this.tick = setInterval(() => this.paintRec(), 100);
    return true;
  },
  // the clip is over: wrap the file up and offer it
  stop() {
    clearInterval(this.tick);
    const r = this.rec; this.rec = null;
    if (!r) { this.busy = false; return; }
    r.onstop = () => {
      try { r.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this.busy = false;
      if (this.cancelled) { this.ui(null); return; }
      const type = (r.mimeType || this.mime() || 'video/webm').split(';')[0];
      this.blob = new Blob(this.chunks, { type }); this.chunks = [];
      if (!this.blob.size) { this.say("Couldn't save that clip. Try again."); return; }
      this.ui('ready');
    };
    try { r.stop(); } catch (e) { this.busy = false; this.ui(null); }
  },
  cancel() { this.cancelled = true; if (Highlights.on && Highlights.rec) Highlights.stop(); else if (Replay.on && Replay.recClip) Replay.finish(); else this.stop(); },
  ext() { return this.blob && this.blob.type.includes('mp4') ? 'mp4' : 'webm'; },
  // phones: the share sheet (Save Video puts it in Photos); computers (or no share): a download
  async share() {
    if (!this.blob) return;
    const file = new File([this.blob], `${this.name}.${this.ext()}`, { type: this.blob.type });
    if (G.mode === 'mobile' && navigator.canShare && navigator.share) {
      try { if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Bobble Bowl highlight' }); this.ui(null); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
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
    else if (st === 'ready') el.innerHTML = `<b>CLIP READY</b><span class="ciInfo">${(this.blob.size / 1048576).toFixed(1)} MB  ·  ${this.ext().toUpperCase()}</span><button class="gold" id="ciSave">${G.mode === 'mobile' && navigator.share ? 'SAVE / SHARE' : 'DOWNLOAD'}</button><button id="ciClose">CLOSE</button>`;
    else if (st === 'msg') el.innerHTML = `<b class="ciMsg">${this.msg}</b><button id="ciClose">OK</button>`;
    const on = (id, f) => { const b = document.getElementById(id); if (b) b.onclick = e => { e.stopPropagation(); Sound.click(); f(); }; };
    on('ciCancel', () => this.cancel()); on('ciSave', () => this.share()); on('ciClose', () => { this.blob = null; this.ui(null); });
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
    if (!this.start(c.title, Highlights.runTime(u0) + 1.0)) { Highlights.rec = false; Highlights.stop(); }
  },
  // the instant replay you're watching: start it over from the top and film it
  replay() {
    if (!Replay.on || !this.ok()) return;
    Replay.recClip = true;
    Replay.t = Math.max(0, Replay.frames.length - 60 * (CLIP_MAX - 0.8) * 0.55); Replay.hold = 0.6; // replay runs at 0.55x
    if (!this.start(G.lastResult && G.lastResult.type === 'td' ? 'touchdown' : 'replay', (Replay.frames.length - 1 - Replay.t) / 60 / 0.55 + 0.6)) Replay.recClip = false;
  }
};
