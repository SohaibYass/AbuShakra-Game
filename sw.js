// Offline app-shell cache. Bump CACHE when files change to refresh clients.
const CACHE = "abushakra-v202";
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
  "./aiknowmads_logo.png",
  "./Zugspitze_Back.png",
  "./Zugspitze_Front.png",
  "./Zugspitze_Foreground_1.png",
  "./Zugspitze_Foreground_2.png",
  "./Zugspitze_Foreground_3.png",
  "./Zugspitze_Foreground_4.png",
  "./Zugspitze_Foreground_5.png",
  "./Zugspitze_Foreground_6.png",
  "./Zugspitze_Foreground_Deep_Water_Sequence_frame2_v3.png",
  "./Zugspitze_Seq7_Animated_Lake_Frame2.png",
  "./Zugspitze_Symmetric_Cliff_Foreground_NoAbu_Clean.png",
  "./Zugspitze_Symmetric_Cliff_Foreground_NoAbu.png",
  "./infopoint_icon.png",
  "./info_point1.png",
  "./info_point2.png",
  "./info_point3.png",
  "./info_point4.png",
  "./info_point5.png",
  "./info_point6.png",
  "./info_point7.png",
  "./infoicon_button.png",
  "./iconBlack.png",
  "./yellowLightning.png",
  "./woodbridge.png",
  "./Zugspitze_Rope_Bridge.png",
  "./Zugspitze_Small_Wood_Bridge_640.png",
  "./Zugspitze_Small_Wood_Bridge.png",
  "./rope_anchor_hill.png",
  "./Zugspitze_Waterfall_Stepping_Rock_1.png",
  "./Zugspitze_Waterfall_Stepping_Rock_3.png",
  "./Zugspitze_Waterfall_Stepping_Rock_4.png",
  "./Zugspitze_Waterfall_Stepping_Rock_5.png",
  "./Zugspitze_Collapsing_Rock_Ledge_3frames.png",
  "./collapse_ledge_v2.png",
  "./level1_music_cramosicamus-persecucion-autor-marcos-molina-113857.mp3",
  "./Simulate_yellow_line_rotate_202607021410.mp4",
  "./character.png",
  "./character_walk.png",
  "./enemy.png",
  "./enemy_snake.png",
  "./enemy_wolf_walk.png",
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
  "./shelter3_bigger_flag_smoke_2frames.png",
  "./abu_rest.png",
  "./Abu_Stand_To_Deep_Squat_2frames.png",
  "./abu_exhausted.png",
  "./abu_ice_slide.png",
  "./abu_fatal_fall.png",
  "./abu_dies.png",
  "./abu_throw.png",
  "./gear_shoes.png",
  "./gear_rope.png",
  "./gear_helmet.png",
  "./abu_gearup.png",
  "./abu_ropeclimb.png",
  "./climb_rope_seg.png",
  "./climb_anchor.png",
  "./climbhill.png",
  "./upper_platform.png",
  "./enemy_snake_red_walk.png",
  "./cobra_attack.png",
  "./croc_attack.png",
  "./harpoon_gun.png",
  "./abu_harpoon_shoot.png",
  "./wolf_attack.png",
  "./enemy_baby_eagle_attack.png",
  "./enemy_snake_distinct_3frames.png",
  "./Zugspitze_Horizontal_Anchor_Rope.png",
  "./abu_climbshill.png",
  "./Abu_Rectangular_Flag_With_Stick_512.png",
  "./Abu_Rectangular_Flag_With_Stick.png",
  "./austria_6km_sign.png",
  "./plane_only.png",
  "./Abu_Energy_Bottle_384.png",
  "./Abu_Energy_Powerup_3frames.png",
  "./eagle_nest_eggs.png",
  "./enemy_eagle_walk.png",
  "./guardian_eagle_landing_2frame.png",
  "./level1_snowy_pine_tree.png",
  "./level1_small_snowy_tree_2.png",
  "./small_rock_3.png",
  "./edelweiss.png",
  "./Abu_Energy_Powerup_frame2_walk_5frames_v3_clean.png",
  "./abu_swimming_6frames_refined.png",
  "./abu_parachute_fly_4frames.png",
  "./parachute_icon.png"
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
    // Bypass the browser HTTP cache so mobile (esp. iOS Safari) can't hand back a
    // stale page; fall back to the cached copy only when the network is unavailable.
    e.respondWith(
      fetch(req, { cache: "no-store" })
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
