// ---- Commentary: the play-by-play gets read out loud by the browser's built-in voice ----
const Commentary = {
  enabled: (() => { try { return localStorage.getItem('bobbleTalk') !== 'off'; } catch (e) { return true; } })(),
  voice: null,
  ok: typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
  set(v) { this.enabled = v; try { localStorage.setItem('bobbleTalk', v ? 'on' : 'off'); } catch (e) {} if (!v && this.ok) speechSynthesis.cancel(); },
  pickVoice() {
    if (!this.ok || this.voice) return;
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    this.voice = vs.find(v => /male|daniel|alex|fred|guy|david/i.test(v.name)) || vs[0] || null;
  },
  say(text, hype) {
    if (!this.ok || !this.enabled || G.demo || G.paused || Sound.muted || !text) return;
    this.pickVoice();
    const clean = text.replace(/\bTD\b/g, 'touchdown').replace(/\bINT\b/g, 'interception').replace(/(\d+)-yard/g, '$1 yard');
    speechSynthesis.cancel(); // never fall behind the game
    const u = new SpeechSynthesisUtterance(clean);
    if (this.voice) u.voice = this.voice;
    u.rate = hype ? 1.25 : 1.12; u.pitch = hype ? 1.15 : 1; u.volume = 0.9;
    speechSynthesis.speak(u);
  }
};
