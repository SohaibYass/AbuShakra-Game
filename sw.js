// Offline app-shell cache. Bump CACHE when files change to refresh clients.
const CACHE = "abushakra-v56";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./AbuVsSnake_4.png",
  "./Zugspitze_Back.png",
  "./Zugspitze_Front.png",
  "./Zugspitze_victory.mp4",
  "./level1_music_cramosicamus-persecucion-autor-marcos-molina-113857.mp3",
  "./level2_energysound-action-risk-countdown-trailer-509281.mp3",
  "./Grossglockner_Back.png",
  "./Grossglockner_Front2.png",
  "./Grande.png",
  "./Matterhorn.png",
  "./MontBlanc_1.png",
  "./character.png",
  "./character_walk.png",
  "./enemy.png",
  "./platform.png",
  "./carabiner.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// The HTML/JS lives in index.html, so it changes often. Serve the page
// network-first (always fresh when online, cached copy when offline) and
// keep static assets (images, manifest, icons) cache-first for speed.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isDoc =
    req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("index.html");

  if (isDoc) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for everything else, caching new GETs as they arrive.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => hit);
    })
  );
});
