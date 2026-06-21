/* ============================================================================
   AbuShakra — leaderboard overlay. Reads the public leaderboard via the
   SECURITY DEFINER RPC get_leaderboard() (anon key). Shows only display name +
   game stats; never birth data / auth ids / run ids. Names are inserted with
   textContent (no innerHTML) so they can't inject markup.
   ============================================================================ */
(function () {
  const T = (window.AbuTracking = window.AbuTracking || {});

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;          // safe — never innerHTML
    return e;
  }
  function fmtTime(ms) {
    if (ms == null) return "—";
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  let overlay;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = el("div", "abu-lb-overlay");
    overlay.innerHTML = "";
    const card = el("div", "abu-lb-card");
    const head = el("div", "abu-lb-head");
    head.appendChild(el("h2", "abu-lb-title", "🏔  Leaderboard"));
    const close = el("button", "abu-lb-close", "✕");
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", T.closeLeaderboard);
    head.appendChild(close);
    card.appendChild(head);
    const body = el("div", "abu-lb-body");
    body.id = "abu-lb-body";
    card.appendChild(body);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) T.closeLeaderboard(); });
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderLoading(body) { body.replaceChildren(el("div", "abu-lb-msg", "Loading leaderboard…")); }
  function renderError(body) {
    body.replaceChildren();
    body.appendChild(el("div", "abu-lb-msg abu-lb-err", "Couldn't load the leaderboard."));
    const retry = el("button", "abu-lb-btn", "Retry");
    retry.addEventListener("click", load);
    body.appendChild(retry);
  }
  function renderRows(body, rows) {
    body.replaceChildren();
    if (!rows.length) { body.appendChild(el("div", "abu-lb-msg", "No runs yet — be the first!")); return; }
    const table = el("table", "abu-lb-table");
    const thead = el("tr");
    ["#", "Player", "Carabiners", "Gear", "Score", "Peaks", "Time"].forEach((h) => thead.appendChild(el("th", null, h)));
    table.appendChild(thead);
    const myId = T.run && T.run.playerId;
    rows.forEach((r) => {
      const tr = el("tr", r.player_id && r.player_id === myId ? "abu-lb-me" : null);
      tr.appendChild(el("td", null, String(r.rank)));
      tr.appendChild(el("td", "abu-lb-name", r.display_name));      // textContent — escaped
      tr.appendChild(el("td", null, String(r.total_carabiners)));
      tr.appendChild(el("td", null, String(r.total_gear)));
      tr.appendChild(el("td", null, String(r.total_score == null ? 0 : r.total_score)));
      tr.appendChild(el("td", null, String(r.levels_completed)));
      tr.appendChild(el("td", null, fmtTime(r.completion_time_ms)));
      table.appendChild(tr);
    });
    body.appendChild(table);
  }

  async function load() {
    const body = document.getElementById("abu-lb-body");
    if (!body) return;
    renderLoading(body);
    const c = T.client();
    if (!c) { renderError(body); return; }
    try {
      const { data, error } = await c.rpc("get_leaderboard", { p_limit: 100 });
      if (error) throw error;
      renderRows(body, data || []);
    } catch (_e) { renderError(body); }
  }

  T.openLeaderboard = function () {
    ensureOverlay().style.display = "flex";
    load();
  };
  T.closeLeaderboard = function () { if (overlay) overlay.style.display = "none"; };
})();
