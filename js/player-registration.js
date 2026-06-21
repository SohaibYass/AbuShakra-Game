/* ============================================================================
   AbuShakra — player registration (anonymous, privacy-aware).
   Public display name + birth MONTH/YEAR only. Under-13 is rejected neutrally.
   Flow: validate -> anon auth -> create/recover profile -> start server run.
   window.AbuTracking.begin() resolves { online: bool, displayName } when the
   player is ready to play (a real run, or an offline non-qualifying run).
   ============================================================================ */
(function () {
  const T = (window.AbuTracking = window.AbuTracking || {});
  const NAME_RE = /^[A-Za-z0-9 _-]{3,20}$/;

  /* ---- one-time styles for the registration modal + leaderboard overlay ---- */
  function injectStyles() {
    if (document.getElementById("abu-online-css")) return;
    const s = document.createElement("style");
    s.id = "abu-online-css";
    s.textContent = `
    .abu-modal,.abu-lb-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;
      justify-content:center;background:rgba(6,10,20,.86);font-family:"Segoe UI",Arial,sans-serif;padding:16px}
    .abu-card,.abu-lb-card{background:#141a2b;border:1px solid rgba(255,255,255,.18);border-radius:14px;
      box-shadow:0 12px 40px rgba(0,0,0,.6);color:#eaf2ff;width:min(440px,94vw);max-height:92vh;overflow:auto;padding:22px}
    .abu-lb-card{width:min(560px,96vw)}
    .abu-card h2,.abu-lb-title{margin:0 0 6px;color:#9fe6ff;font-size:24px}
    .abu-sub{color:#9fb6c8;font-size:13px;margin:0 0 16px;line-height:1.4}
    .abu-field{margin:12px 0}
    .abu-field label{display:block;font-size:13px;color:#c7d6e6;margin-bottom:5px}
    .abu-field input,.abu-field select{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;
      border:1px solid rgba(255,255,255,.22);background:#0e1424;color:#fff;font-size:15px}
    .abu-row{display:flex;gap:10px}.abu-row>div{flex:1}
    .abu-consent{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:#c7d6e6;margin:14px 0}
    .abu-consent input{margin-top:2px}
    .abu-consent a{color:#9fe6ff}
    .abu-err{color:#ff8a7a;font-size:13px;min-height:18px;margin:6px 0 2px}
    .abu-btn{width:100%;padding:12px;border:none;border-radius:9px;background:#2e8b57;color:#fff;
      font-size:16px;font-weight:700;cursor:pointer;margin-top:6px}
    .abu-btn:disabled{opacity:.6;cursor:default}
    .abu-btn.alt{background:#33405a;margin-top:8px}
    .abu-link{display:block;text-align:center;color:#9fb6c8;font-size:12.5px;margin-top:12px;cursor:pointer}
    .abu-lb-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .abu-lb-close,.abu-lb-btn{background:#33405a;color:#fff;border:none;border-radius:8px;cursor:pointer}
    .abu-lb-close{width:32px;height:32px;font-size:16px}
    .abu-lb-btn{padding:9px 16px;margin:10px auto 0;display:block}
    .abu-lb-msg{padding:24px;text-align:center;color:#c7d6e6}.abu-lb-err{color:#ff8a7a}
    .abu-lb-table{width:100%;border-collapse:collapse;font-size:14px}
    .abu-lb-table th{color:#9fb6c8;text-align:left;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.14);font-weight:600}
    .abu-lb-table td{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.06)}
    .abu-lb-name{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .abu-lb-me{background:rgba(159,230,255,.12)}.abu-lb-me td{color:#bfeaff;font-weight:600}`;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function ageGroup(month, year) {
    const now = new Date();
    const yrs = now.getFullYear() - year - ((now.getMonth() + 1) < month ? 1 : 0);
    return yrs < 13 ? "under_13" : yrs < 18 ? "13_17" : "18_plus";
  }

  let modal;
  function close() { if (modal) { modal.remove(); modal = null; } }

  /* ---- profile create / recover ---- */
  async function ensureProfile(c, fields) {
    const { data: { user } } = await c.auth.getUser();
    if (!user) throw new Error("NO_AUTH");
    // Recover an existing profile for this anon user, if any.
    const { data: existing } = await c.from("players")
      .select("id, display_name").eq("auth_user_id", user.id).maybeSingle();
    if (existing) return existing;
    const { data, error } = await c.from("players").insert({
      auth_user_id: user.id,
      display_name: fields.name,
      birth_month: fields.month,
      birth_year: fields.year,
      age_group: ageGroup(fields.month, fields.year),   // server re-computes + enforces
      privacy_version: T.config.PRIVACY_VERSION,
    }).select("id, display_name").single();
    if (error) throw error;
    return data;
  }

  function mapError(e) {
    const m = (e && e.message ? e.message : String(e)) || "";
    if (/UNDER_13/.test(m)) return "Sorry — you can't register for the competition.";
    if (/BLOCKED_NAME/.test(m)) return "Please choose a different display name.";
    if (/INVALID_NAME/.test(m)) return "Name must be 3–20 letters, numbers, spaces, _ or -.";
    if (/INVALID_BIRTH/.test(m)) return "Please enter a valid birth month and year.";
    if (/NO_SESSION|NO_AUTH|Failed to fetch|NetworkError/i.test(m)) return "Couldn't reach the server.";
    return "Something went wrong. Please try again.";
  }

  /* ---- the registration form ---- */
  function buildForm(resolve) {
    const card = el("div", "abu-card");
    card.appendChild(el("h2", null, "Join the Competition"));
    card.appendChild(el("p", "abu-sub",
      "Pick a public name and your birth month & year. We never show your birth info — it's only used to set an age group."));

    const fName = el("div", "abu-field");
    fName.appendChild(el("label", null, "Display name (public)"));
    const inName = el("input"); inName.maxLength = 20; inName.placeholder = "e.g. AlpineFox";
    fName.appendChild(inName); card.appendChild(fName);

    const row = el("div", "abu-row");
    const fMon = el("div"); fMon.appendChild(el("label", null, "Birth month"));
    const selMon = el("select");
    selMon.appendChild(el("option", null, "Month")); selMon.firstChild.value = "";
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].forEach((m, i) => {
      const o = el("option", null, m); o.value = String(i + 1); selMon.appendChild(o);
    });
    fMon.appendChild(selMon);
    const fYr = el("div"); fYr.appendChild(el("label", null, "Birth year"));
    const selYr = el("select");
    selYr.appendChild(el("option", null, "Year")); selYr.firstChild.value = "";
    const nowY = new Date().getFullYear();
    for (let y = nowY; y >= nowY - 100; y--) { const o = el("option", null, String(y)); o.value = String(y); selYr.appendChild(o); }
    fYr.appendChild(selYr);
    row.appendChild(fMon); row.appendChild(fYr); card.appendChild(row);

    const consent = el("label", "abu-consent");
    const chk = el("input"); chk.type = "checkbox";
    consent.appendChild(chk);
    const ctxt = el("span");
    ctxt.appendChild(document.createTextNode("I accept the "));
    const a1 = el("a", null, "privacy policy"); a1.href = "privacy.html"; a1.target = "_blank";
    const a2 = el("a", null, "competition rules"); a2.href = "competition-rules.html"; a2.target = "_blank";
    ctxt.appendChild(a1); ctxt.appendChild(document.createTextNode(" and ")); ctxt.appendChild(a2); ctxt.appendChild(document.createTextNode("."));
    consent.appendChild(ctxt); card.appendChild(consent);

    const err = el("div", "abu-err");
    card.appendChild(err);

    const btn = el("button", "abu-btn", "Start Adventure");
    card.appendChild(btn);

    const offlineLink = el("span", "abu-link", "Play offline (won't be ranked)");
    offlineLink.addEventListener("click", () => { close(); resolve({ online: false }); });
    card.appendChild(offlineLink);

    let busy = false;
    btn.addEventListener("click", async () => {
      if (busy) return;                                   // prevent double-submit
      err.textContent = "";
      const name = inName.value.trim();
      const month = parseInt(selMon.value, 10), year = parseInt(selYr.value, 10);
      if (!NAME_RE.test(name)) { err.textContent = "Name: 3–20 letters, numbers, spaces, _ or -."; return; }
      if (!month || !year) { err.textContent = "Please choose your birth month and year."; return; }
      if (!chk.checked) { err.textContent = "Please accept the privacy policy and rules."; return; }
      if (ageGroup(month, year) === "under_13") { err.textContent = "Sorry — you can't register for the competition."; return; }

      busy = true; btn.disabled = true; btn.textContent = "Starting…";
      try {
        const c = T.client();
        await c.auth.signInAnonymously();
        const profile = await ensureProfile(c, { name, month, year });
        await T.startRun();
        T.run.playerId = profile.id;
        close(); resolve({ online: true, displayName: profile.display_name });
      } catch (e) {
        err.textContent = mapError(e);
        busy = false; btn.disabled = false; btn.textContent = "Start Adventure";
      }
    });
    return card;
  }

  /* ---- returning player ("Continue as …") ---- */
  function buildReturning(resolve, profile) {
    const card = el("div", "abu-card");
    card.appendChild(el("h2", null, "Welcome back"));
    card.appendChild(el("p", "abu-sub", "Continue your competition profile, or use another player."));
    const cont = el("button", "abu-btn", "Continue as " + profile.display_name);
    cont.addEventListener("click", async () => {
      cont.disabled = true; cont.textContent = "Starting…";
      try { await T.startRun(); T.run.playerId = profile.id; close(); resolve({ online: true, displayName: profile.display_name }); }
      catch (e) { cont.disabled = false; cont.textContent = "Continue as " + profile.display_name;
                  const er = card.querySelector(".abu-err") || card.appendChild(el("div","abu-err")); er.textContent = mapError(e); }
    });
    card.appendChild(cont);
    const other = el("button", "abu-btn alt", "Use another player");
    other.addEventListener("click", async () => { try { await T.client().auth.signOut(); } catch (_e) {} close(); T.begin().then(resolve); });
    card.appendChild(other);
    card.appendChild(el("div", "abu-err"));
    return card;
  }

  function show(node) {
    injectStyles();
    close();
    modal = el("div", "abu-modal");
    modal.appendChild(node);
    document.body.appendChild(modal);
  }

  /* ---- entry point ---- */
  T.begin = function () {
    return new Promise((resolve) => {
      if (!T.configured() || !T.client()) {
        // Backend not configured — proceed offline (non-qualifying).
        resolve({ online: false, reason: "not_configured" });
        return;
      }
      const c = T.client();
      // Returning session? Show "Continue as …".
      c.auth.getSession().then(async ({ data }) => {
        if (data && data.session) {
          try {
            const { data: prof } = await c.from("players")
              .select("id, display_name").eq("auth_user_id", data.session.user.id).maybeSingle();
            if (prof) { show(buildReturning(resolve, prof)); return; }
          } catch (_e) {}
        }
        show(buildForm(resolve));
      }).catch(() => show(buildForm(resolve)));
    });
  };
})();
