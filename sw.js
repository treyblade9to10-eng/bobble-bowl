// ---- Offline support: network first (so updates show up right away), saved copy when there's no signal ----
const CACHE = 'bobble-v5.8';
const FILES = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-180.png',
  'js/teams.js',
  'js/util.js',
  'js/audio.js',
  'js/plays.js',
  'js/draw.js',
  'js/stadiums.js',
  'js/weather.js',
  'js/pbp.js',
  'js/replay.js',
  'js/xfactor.js',
  'js/career.js',
  'js/engine.js',
  'js/injury.js',
  'js/celly.js',
  'js/special.js',
  'js/season.js',
  'js/modes.js',
  'js/savegame.js',
  'js/gamepad.js',
  'js/lib/peerjs.min.js',
  'js/net.js',
  'js/main.js',
  'js/locker.js',
  'js/careerui.js',
  'js/seasonui.js',
  'js/franchise.js',
  'js/trades.js',
  'js/tutorial.js',
  'fonts/barlow-500.woff2',
  'fonts/barlow-700.woff2',
  'fonts/bc-600.woff2',
  'fonts/bc-800.woff2',
  'fonts/bc-800i.woff2',
  'fonts/bc-900i.woff2'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // online play etc. goes straight to the network
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
