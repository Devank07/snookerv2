// UPBSA.TV Service Worker
const CACHE = 'upbsa-tv-v1';

// Files to cache for offline use
const STATIC_FILES = [
  './index.html',
  './dashboard.html',
  './tournament.html',
  './players.html',
  './referee.html',
  './billiards-referee.html',
  './referee-hub.html',
  './scoreboard.html',
  './overlay.html',
  './builder.html',
  './design.html',
  './intro.html',
  './bracket.html',
  './schedule.html',
  './stats-overlay.html',
  './stats-control.html',
  './diagnostic.html',
  './setup.html',
  './upbsa-logo.jpg',
  './manifest.json'
];

// ── INSTALL: cache all static files ──
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(STATIC_FILES);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: network first, fallback to cache ──
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Let Firebase and Google Fonts go through network always
  if (url.includes('firebasedatabase') ||
      url.includes('firebaseapp') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // For HTML pages and assets: network first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(function(response) {
        // Cache fresh copy
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // Offline — serve from cache
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});

// ── BACKGROUND SYNC: flush offline score queue ──
self.addEventListener('sync', function(e) {
  if (e.tag === 'score-sync') {
    e.waitUntil(flushScoreQueue());
  }
});

function flushScoreQueue() {
  // Notify all clients to flush their queue
  return self.clients.matchAll().then(function(clients) {
    clients.forEach(function(c) {
      c.postMessage({ type: 'FLUSH_QUEUE' });
    });
  });
}
