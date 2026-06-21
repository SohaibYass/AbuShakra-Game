/* ============================================================================
   AbuShakra — Supabase configuration  (classic <script>, loads before the
   other js/ modules and after the supabase-js CDN script).
   ----------------------------------------------------------------------------
   FILL THESE IN after creating your Supabase project (see supabase/README.md).
   Only the PUBLIC anon key may live in the browser. NEVER put the service-role
   key here.
   ============================================================================ */
const SUPABASE_URL = "REPLACE_WITH_SUPABASE_URL";
const SUPABASE_ANON_KEY = "REPLACE_WITH_SUPABASE_ANON_KEY";

/* Version stored with every run (bump on each deploy). */
const GAME_VERSION = "abushakra-v122";

/* The privacy-policy / competition-rules version the player must accept. */
const PRIVACY_VERSION = "2026-06-19";

/* Client-side mirror of server validation limits — for hints only. The SERVER
   (level_config + edge functions) is authoritative. Keep roughly in sync. */
const LEVEL_MAX_CARABINERS = { 1: 60, 2: 80, 3: 80, 4: 80, 5: 80 };

(function () {
  const T = (window.AbuTracking = window.AbuTracking || {});
  T.config = { SUPABASE_URL, SUPABASE_ANON_KEY, GAME_VERSION, PRIVACY_VERSION, LEVEL_MAX_CARABINERS };

  // True only when the placeholders have been replaced with real values.
  T.configured = function () {
    return typeof SUPABASE_URL === "string" && SUPABASE_URL.indexOf("REPLACE_WITH") !== 0 &&
           typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.indexOf("REPLACE_WITH") !== 0;
  };

  // Lazily create the supabase-js client (CDN script must be present).
  T.client = function () {
    if (T._client) return T._client;
    if (!window.supabase || !T.configured()) return null;
    T._client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "abushakra_auth" },
    });
    return T._client;
  };
})();
