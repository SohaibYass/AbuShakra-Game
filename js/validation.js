/* ============================================================================
   AbuShakra — pure validation + ranking helpers. No DOM / no network, so they
   can be unit-tested with Node (see tests/validation.test.js). Works both as a
   browser global (window.AbuValidation) and as a CommonJS module.
   ============================================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;       // Node
  root.AbuValidation = api;                                                         // browser
})(typeof self !== "undefined" ? self : this, function () {
  const NAME_RE = /^[A-Za-z0-9 _-]{3,20}$/;

  // Display name: trim, 3–20 chars, allowed charset. (The server also enforces a
  // blocked-word list.) Returns { ok, value, error }.
  function validateName(raw) {
    const value = String(raw == null ? "" : raw).trim();
    if (value.length < 3 || value.length > 20) return { ok: false, value, error: "LENGTH" };
    if (!NAME_RE.test(value)) return { ok: false, value, error: "CHARS" };
    return { ok: true, value, error: null };
  }

  // Age group from birth month/year as of `now` (default: today).
  function ageGroup(month, year, now) {
    now = now || new Date();
    const yrs = now.getFullYear() - year - ((now.getMonth() + 1) < month ? 1 : 0);
    if (yrs < 13) return "under_13";
    if (yrs < 18) return "13_17";
    return "18_plus";
  }

  function validBirth(month, year, now) {
    now = now || new Date();
    return Number.isInteger(month) && month >= 1 && month <= 12 &&
           Number.isInteger(year) && year >= 1900 && year <= now.getFullYear();
  }

  // Leaderboard tie-break comparator (mirrors get_leaderboard() ordering).
  // Returns < 0 if `a` ranks ABOVE `b`. Used in tests to lock the rules.
  function compareRuns(a, b) {
    if (b.total_carabiners !== a.total_carabiners) return b.total_carabiners - a.total_carabiners;
    if (b.total_gear !== a.total_gear) return b.total_gear - a.total_gear;
    if (b.levels_completed !== a.levels_completed) return b.levels_completed - a.levels_completed;
    const ac = a.status === "completed" ? 1 : 0, bc = b.status === "completed" ? 1 : 0;
    if (bc !== ac) return bc - ac;                                  // completed before incomplete
    const at = a.completion_time_ms == null ? Infinity : a.completion_time_ms;
    const bt = b.completion_time_ms == null ? Infinity : b.completion_time_ms;
    if (at !== bt) return at - bt;                                  // faster first
    const af = a.finished_at ? Date.parse(a.finished_at) : Infinity;
    const bf = b.finished_at ? Date.parse(b.finished_at) : Infinity;
    return af - bf;                                                 // earliest finish first
  }

  return { NAME_RE, validateName, ageGroup, validBirth, compareRuns };
});
