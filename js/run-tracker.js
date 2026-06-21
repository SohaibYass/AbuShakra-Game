/* ============================================================================
   AbuShakra — run tracker.  Records carabiners, gear and level results to
   Supabase via the edge functions. The SERVER recomputes authoritative totals
   from accepted checkpoints; the client values are advisory.
   Exposes window.AbuTracking.* used by index.html.
   ============================================================================ */
(function () {
  const T = (window.AbuTracking = window.AbuTracking || {});

  const onlineRun = (T.run = {
    playerId: null,
    runId: null,
    startedAt: null,
    currentLevelStartedAt: null,
    totalCarabiners: 0,
    totalGear: 0,
    totalScore: 0,           // competitive score = carabiners + enemy-kill points
    perLevel: {},
    submitted: false,
    onlineEligible: false,   // true once a server run exists; false = offline/non-qualifying
  });

  function fnUrl(name) {
    return T.config.SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/" + name;
  }
  async function authHeaders() {
    const c = T.client();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    const tok = data && data.session && data.session.access_token;
    return tok ? { Authorization: "Bearer " + tok, "Content-Type": "application/json",
                   apikey: T.config.SUPABASE_ANON_KEY } : null;
  }
  // POST to an edge function with limited exponential backoff on 5xx/network.
  async function callFn(name, body, tries, keepalive) {
    tries = tries || 1;
    const headers = await authHeaders();
    if (!headers) throw new Error("NO_SESSION");
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(fnUrl(name), {
          method: "POST", headers, body: JSON.stringify(body || {}), keepalive: !!keepalive,
        });
        if (res.ok) return await res.json().catch(() => ({}));
        lastErr = new Error("HTTP_" + res.status);
        if (res.status < 500) break;                 // don't retry client errors
      } catch (e) { lastErr = e; }
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 300 * Math.pow(2, i)));
    }
    throw lastErr || new Error("CALL_FAILED");
  }
  T.callFn = callFn;

  function lvl(n) {
    return onlineRun.perLevel[n] ||
      (onlineRun.perLevel[n] = { carabiners: 0, killPoints: 0, shoes: false, rope: false, helmet: false,
                                 completed: false, ids: {} });
  }

  /* ---- lifecycle ---- */
  T.startRun = async function () {
    const r = await callFn("start-run", { gameVersion: T.config.GAME_VERSION }, 3);
    onlineRun.runId = r.runId;
    onlineRun.startedAt = r.startedAt;
    onlineRun.onlineEligible = true;
    onlineRun.submitted = false;
    onlineRun.totalCarabiners = 0; onlineRun.totalGear = 0; onlineRun.totalScore = 0; onlineRun.perLevel = {};
    return r;
  };
  // Mark the start of a level so per-level time can be measured.
  T.levelStart = function () { onlineRun.currentLevelStartedAt = Date.now(); };

  /* ---- collectibles ---- */
  // A real collectible carabiner pickup (NOT starting ammo, NOT a thrown clip).
  // pickupId dedupes the same pickup if the handler fires twice.
  T.trackCarabiner = function (levelNumber, pickupId) {
    const L = lvl(levelNumber);
    if (pickupId != null) { if (L.ids[pickupId]) return; L.ids[pickupId] = true; }
    L.carabiners += 1; onlineRun.totalCarabiners += 1; onlineRun.totalScore += 1;   // carabiner = +1 to score
  };
  // Enemy stomped/knifed — add its points to the competitive score.
  T.trackKill = function (levelNumber, points) {
    const p = Number(points) || 0;
    if (p <= 0) return;
    lvl(levelNumber).killPoints += p; onlineRun.totalScore += p;
  };
  // Gear: shoes / rope / helmet — at most once per level per type.
  T.trackGear = function (levelNumber, type) {
    const L = lvl(levelNumber);
    if ((type === "shoes" || type === "rope" || type === "helmet") && !L[type]) {
      L[type] = true; onlineRun.totalGear += 1;
    }
  };

  /* ---- checkpoints / finalize ---- */
  // One idempotent checkpoint per level. Non-blocking: failures don't stop the
  // game; finalize recomputes from whatever checkpoints the server accepted.
  T.submitLevel = async function (levelNumber, completed) {
    if (!onlineRun.onlineEligible || !onlineRun.runId) return;
    const L = lvl(levelNumber);
    L.completed = !!completed;
    const timeMs = onlineRun.currentLevelStartedAt ? Date.now() - onlineRun.currentLevelStartedAt : null;
    try {
      await callFn("submit-checkpoint", {
        runId: onlineRun.runId, levelNumber,
        carabiners: L.carabiners, killPoints: L.killPoints,
        shoes: L.shoes, rope: L.rope, helmet: L.helmet,
        completed: !!completed, completionTimeMs: timeMs,
      }, 3);
    } catch (_e) { /* swallow — server is authoritative at finalize */ }
  };
  T.finalizeRun = async function (status, keepalive) {
    if (!onlineRun.onlineEligible || !onlineRun.runId || onlineRun.submitted) return null;
    onlineRun.submitted = true;
    try { return await callFn("finalize-run", { runId: onlineRun.runId, status }, 3, keepalive); }
    catch (_e) { onlineRun.submitted = false; return null; }
  };

  /* ---- page-close fallback (keepalive fetch can still send auth headers) ---- */
  function onLeave() {
    if (onlineRun.onlineEligible && onlineRun.runId && !onlineRun.submitted) {
      // Non-critical: marks an unfinished run as abandoned via a keepalive POST.
      T.finalizeRun("game_over", true);
    }
  }
  window.addEventListener("pagehide", onLeave);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") onLeave();
  });
})();
