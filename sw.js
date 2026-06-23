// Offline app-shell cache. Bump CACHE when files change to refresh clients.
const CACHE = "abushakra-v131";
const ASSETS = [
  "./",
  "./index.html",
  "./privacy.html",
  "./competition-rules.html",
  "./js/validation.js",
  "./js/supabase-config.js",
  "./js/run-tracker.js",
  "./js/leaderboard.js",
  "./js/player-registration.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./AbuVsSnake_4.png",
  "./Zugspitze_Back.png",
  "./Zugspitze_Front.png",
  "./Zugspitze_Foreground_1.png",
  "./Zugspitze_Foreground_2.png",
  "./Zugspitze_Foreground_3.png",
  "./Zugspitze_Foreground_4.png",
  "./woodbridge.png",
  "./rope_anchor_hill.png",
  "./Zugspitze_Waterfall_Stepping_Rock_1.png",
  "./Zugspitze_Waterfall_Stepping_Rock_3.png",
  "./Zugspitze_Waterfall_Stepping_Rock_4.png",
  "./Zugspitze_Waterfall_Stepping_Rock_5.png",
  "./Zugspitze_Collapsing_Rock_Ledge_3frames.png",
  "./level1_music_cramosicamus-persecucion-autor-marcos-molina-113857.mp3",
  "./level2_energysound-action-risk-countdown-trailer-509281.mp3",
  "./level3_luis_humanoide-sport-news-formula-1-vibes-265165.mp3",
  "./level4_niknet_art-thriller-action-trailer-336723.mp3",
  "./level5_niknet_art-super-suspense-adrenaline-trailer-music-297760.mp3",
  "./Grossglockner_Back.png",
  "./Grossglockner_Front2.png",
  "./Grande_Back.png",
  "./Grande_Front.png",
  "./Matterhorn_Back.png",
  "./Matterhorn_Front2.png",
  "./MontBlanc_Back.png",
  "./MontBlanc_Front.png",
  "./character.png",
  "./character_walk.png",
  "./enemy.png",
  "./enemy_snake.png",
  "./enemy_bear.png",
  "./enemy_bear_walk.png",
  "./enemy_gyrfalcon_walk.png",
  "./enemy_wolf_walk.png",
  "./platform.png",
  "./carabiner.png",
  "./camping_knife.png",
  "./rope.png",
  "./rope_rock.png",
  "./rope2.png",
  "./rope_rock2.png",
  "./rope_grip.png",
  "./abu_mantle.png",
  "./descend_anchor.png",
  "./descend_ropeseg.png",
  "./shelter.png",
  "./abu_rest.png",
  "./Abu_Stand_To_Deep_Squat_2frames.png",
  "./abu_exhausted.png",
  "./abu_fatal_fall.png",
  "./abu_throw.png",
  "./gear_shoes.png",
  "./gear_rope.png",
  "./gear_helmet.png",
  "./abu_flag.png",
  "./abu_gearup.png",
  "./abu_ropeclimb.png",
  "./climb_rope_seg.png",
  "./climb_anchor.png",
  "./climbhill.png",
  "./upper_platform.png",
  "./enemy_snake_red_walk.png"
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
  // Never touch cross-origin requests (Supabase API/auth, the supabase-js CDN).
  // Let the browser fetch them normally so dynamic API responses are never
  // served from the static app-shell cache.
  if (url.origin !== self.location.origin) return;

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
