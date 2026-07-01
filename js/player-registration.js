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

  // Country dialing codes (Vorwahl). DACH pinned first, then every country alphabetically.
  const DIAL_CODES = [
    ["ألمانيا","+49"],["النمسا","+43"],["سويسرا","+41"],
    ["أفغانستان","+93"],["ألبانيا","+355"],["الجزائر","+213"],["أندورا","+376"],["أنغولا","+244"],
    ["أنتيغوا وباربودا","+1"],["الأرجنتين","+54"],["أرمينيا","+374"],["أستراليا","+61"],["أذربيجان","+994"],
    ["الباهاما","+1"],["البحرين","+973"],["بنغلاديش","+880"],["بربادوس","+1"],["بيلاروسيا","+375"],["بلجيكا","+32"],
    ["بليز","+501"],["بنين","+229"],["بوتان","+975"],["بوليفيا","+591"],["البوسنة والهرسك","+387"],
    ["بوتسوانا","+267"],["البرازيل","+55"],["بروناي","+673"],["بلغاريا","+359"],["بوركينا فاسو","+226"],["بوروندي","+257"],
    ["الرأس الأخضر","+238"],["كمبوديا","+855"],["الكاميرون","+237"],["كندا","+1"],["جمهورية أفريقيا الوسطى","+236"],
    ["تشاد","+235"],["تشيلي","+56"],["الصين","+86"],["كولومبيا","+57"],["جزر القمر","+269"],["الكونغو","+242"],
    ["جمهورية الكونغو الديمقراطية","+243"],["كوستاريكا","+506"],["ساحل العاج","+225"],["كرواتيا","+385"],["كوبا","+53"],["قبرص","+357"],
    ["التشيك","+420"],["الدنمارك","+45"],["جيبوتي","+253"],["دومينيكا","+1"],["جمهورية الدومينيكان","+1"],["الإكوادور","+593"],
    ["مصر","+20"],["السلفادور","+503"],["غينيا الاستوائية","+240"],["إريتريا","+291"],["إستونيا","+372"],["إسواتيني","+268"],
    ["إثيوبيا","+251"],["فيجي","+679"],["فنلندا","+358"],["فرنسا","+33"],["الغابون","+241"],["غامبيا","+220"],["جورجيا","+995"],
    ["غانا","+233"],["اليونان","+30"],["غرينادا","+1"],["غواتيمالا","+502"],["غينيا","+224"],["غينيا بيساو","+245"],
    ["غيانا","+592"],["هايتي","+509"],["هندوراس","+504"],["المجر","+36"],["آيسلندا","+354"],["الهند","+91"],["إندونيسيا","+62"],
    ["إيران","+98"],["العراق","+964"],["أيرلندا","+353"],["إسرائيل","+972"],["إيطاليا","+39"],["جامايكا","+1"],["اليابان","+81"],
    ["الأردن","+962"],["كازاخستان","+7"],["كينيا","+254"],["كيريباتي","+686"],["كوسوفو","+383"],["الكويت","+965"],
    ["قيرغيزستان","+996"],["لاوس","+856"],["لاتفيا","+371"],["لبنان","+961"],["ليسوتو","+266"],["ليبيريا","+231"],["ليبيا","+218"],
    ["ليختنشتاين","+423"],["ليتوانيا","+370"],["لوكسمبورغ","+352"],["مدغشقر","+261"],["مالاوي","+265"],["ماليزيا","+60"],
    ["المالديف","+960"],["مالي","+223"],["مالطا","+356"],["جزر مارشال","+692"],["موريتانيا","+222"],["موريشيوس","+230"],
    ["المكسيك","+52"],["ميكرونيزيا","+691"],["مولدوفا","+373"],["موناكو","+377"],["منغوليا","+976"],["الجبل الأسود","+382"],
    ["المغرب","+212"],["موزمبيق","+258"],["ميانمار","+95"],["ناميبيا","+264"],["ناورو","+674"],["نيبال","+977"],
    ["هولندا","+31"],["نيوزيلندا","+64"],["نيكاراغوا","+505"],["النيجر","+227"],["نيجيريا","+234"],["كوريا الشمالية","+850"],
    ["مقدونيا الشمالية","+389"],["النرويج","+47"],["عُمان","+968"],["باكستان","+92"],["بالاو","+680"],["فلسطين","+970"],
    ["بنما","+507"],["بابوا غينيا الجديدة","+675"],["باراغواي","+595"],["بيرو","+51"],["الفلبين","+63"],["بولندا","+48"],
    ["البرتغال","+351"],["قطر","+974"],["رومانيا","+40"],["روسيا","+7"],["رواندا","+250"],["سانت كيتس ونيفيس","+1"],
    ["سانت لوسيا","+1"],["سانت فينسنت والغرينادين","+1"],["ساموا","+685"],["سان مارينو","+378"],
    ["ساو تومي وبرينسيبي","+239"],["السعودية","+966"],["السنغال","+221"],["صربيا","+381"],["سيشل","+248"],
    ["سيراليون","+232"],["سنغافورة","+65"],["سلوفاكيا","+421"],["سلوفينيا","+386"],["جزر سليمان","+677"],["الصومال","+252"],
    ["جنوب أفريقيا","+27"],["كوريا الجنوبية","+82"],["جنوب السودان","+211"],["إسبانيا","+34"],["سريلانكا","+94"],["السودان","+249"],
    ["سورينام","+597"],["السويد","+46"],["سوريا","+963"],["تايوان","+886"],["طاجيكستان","+992"],["تنزانيا","+255"],
    ["تايلاند","+66"],["تيمور الشرقية","+670"],["توغو","+228"],["تونغا","+676"],["ترينيداد وتوباغو","+1"],["تونس","+216"],
    ["تركيا","+90"],["تركمانستان","+993"],["توفالو","+688"],["أوغندا","+256"],["أوكرانيا","+380"],["الإمارات العربية المتحدة","+971"],
    ["المملكة المتحدة","+44"],["الولايات المتحدة","+1"],["أوروغواي","+598"],["أوزبكستان","+998"],["فانواتو","+678"],["الفاتيكان","+379"],
    ["فنزويلا","+58"],["فيتنام","+84"],["اليمن","+967"],["زامبيا","+260"],["زيمبابوي","+263"],
  ];

  /* ---- one-time styles for the registration modal + leaderboard overlay ---- */
  function injectStyles() {
    if (document.getElementById("abu-online-css")) return;
    const s = document.createElement("style");
    s.id = "abu-online-css";
    s.textContent = `
    .abu-modal,.abu-lb-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;
      justify-content:center;background:rgba(6,10,20,.86);font-family:"Segoe UI",Arial,sans-serif;padding:16px}
    .abu-card,.abu-lb-card{background:#0e1d3a;border:1px solid rgba(174,138,74,.5);border-radius:14px;
      box-shadow:0 12px 40px rgba(0,0,0,.6);color:#eaf2ff;width:min(440px,94vw);max-height:92vh;overflow:auto;padding:22px}
    .abu-lb-card{width:min(560px,96vw)}
    .abu-card h2,.abu-lb-title{margin:0 0 6px;color:#c9a75e;font-size:24px}
    .abu-sub{color:#9fb6c8;font-size:13px;margin:0 0 16px;line-height:1.4}
    .abu-logo{display:block;width:min(300px,82%);height:auto;margin:0 auto 16px;
      background:#fff;border-radius:10px;padding:8px 12px;box-sizing:border-box}
    .abu-field{margin:12px 0}
    .abu-field label{display:block;font-size:13px;color:#c7d6e6;margin-bottom:5px}
    .abu-field input,.abu-field select{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;
      border:1px solid rgba(174,138,74,.35);background:#0a1730;color:#fff;font-size:15px}
    .abu-row{display:flex;gap:10px}.abu-row>div{flex:1}
    .abu-consent{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:#c7d6e6;margin:14px 0}
    .abu-consent input{margin-top:2px}
    .abu-consent a{color:#c9a75e}
    .abu-err{color:#ff8a7a;font-size:13px;min-height:18px;margin:6px 0 2px}
    .abu-btn{width:100%;padding:12px;border:none;border-radius:9px;background:#b8945a;color:#0b1730;
      font-size:16px;font-weight:700;cursor:pointer;margin-top:6px}
    .abu-btn:disabled{opacity:.6;cursor:default}
    .abu-btn.alt{background:#1c3057;color:#eaf2ff;margin-top:8px}
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
      first_name: fields.first,
      last_name: fields.last,
      email: fields.email,
      phone_vorwahl: fields.vorwahl,
      phone_number: fields.phone,
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
    if (/UNDER_13/.test(m)) return "عذرًا — لا يمكنك التسجيل في المسابقة.";
    if (/BLOCKED_NAME/.test(m)) return "الرجاء اختيار اسم معروض مختلف.";
    if (/INVALID_NAME/.test(m)) return "يجب أن يكون الاسم من 3 إلى 20 حرفًا أو رقمًا أو مسافة أو _ أو -.";
    if (/INVALID_BIRTH/.test(m)) return "الرجاء إدخال شهر وسنة ميلاد صحيحين.";
    if (/NO_SESSION|NO_AUTH|Failed to fetch|NetworkError/i.test(m)) return "تعذّر الوصول إلى الخادم.";
    return "حدث خطأ ما. الرجاء المحاولة مرة أخرى.";
  }

  /* ---- the registration form ---- */
  function buildForm(resolve) {
    const card = el("div", "abu-card"); card.dir = "rtl"; card.lang = "ar";
    const logo = el("img", "abu-logo"); logo.src = "aiknowmads_logo.png"; logo.alt = "AiKnowmads";
    logo.onerror = function () { logo.remove(); };   // hide gracefully if the file isn't present yet
    card.appendChild(logo);
    card.appendChild(el("h2", null, "انضم إلى المسابقة"));
    card.appendChild(el("p", "abu-sub",
      "أدخل بياناتك للانضمام إلى المسابقة. يظهر اسمك المعروض فقط للعامة — وتبقى بقية البيانات خاصة."));

    const fName = el("div", "abu-field");
    fName.appendChild(el("label", null, "الاسم المعروض (علني)"));
    const inName = el("input"); inName.maxLength = 20; inName.placeholder = "مثال: AlpineFox";
    fName.appendChild(inName); card.appendChild(fName);

    // First + last name
    const rowN = el("div", "abu-row");
    const fFirst = el("div"); fFirst.appendChild(el("label", null, "الاسم الأول"));
    const inFirst = el("input"); inFirst.maxLength = 40; inFirst.placeholder = "الاسم الأول"; fFirst.appendChild(inFirst);
    const fLast = el("div"); fLast.appendChild(el("label", null, "اسم العائلة"));
    const inLast = el("input"); inLast.maxLength = 40; inLast.placeholder = "اسم العائلة"; fLast.appendChild(inLast);
    rowN.appendChild(fFirst); rowN.appendChild(fLast); card.appendChild(rowN);

    // Email
    const fEmail = el("div", "abu-field");
    fEmail.appendChild(el("label", null, "البريد الإلكتروني"));
    const inEmail = el("input"); inEmail.type = "email"; inEmail.maxLength = 100; inEmail.placeholder = "you@example.com";
    inEmail.dir = "ltr"; inEmail.style.textAlign = "left";
    fEmail.appendChild(inEmail); card.appendChild(fEmail);

    // Vorwahl (country dialing code) — a dropdown so users needn't know the code
    const fVor = el("div", "abu-field");
    fVor.appendChild(el("label", null, "رمز الاتصال الدولي (الدولة)"));
    const inVor = el("select");
    DIAL_CODES.forEach(function (cc) {
      const o = el("option", null, cc[0] + " (" + cc[1] + ")"); o.value = cc[1];
      if (cc[1] === "+49") o.selected = true; inVor.appendChild(o);
    });
    fVor.appendChild(inVor); card.appendChild(fVor);

    // Telephone number
    const fPhone = el("div", "abu-field");
    fPhone.appendChild(el("label", null, "رقم الهاتف"));
    const inPhone = el("input"); inPhone.type = "tel"; inPhone.maxLength = 20; inPhone.placeholder = "1512 3456789";
    inPhone.dir = "ltr"; inPhone.style.textAlign = "left";
    fPhone.appendChild(inPhone); card.appendChild(fPhone);

    const row = el("div", "abu-row");
    const fMon = el("div"); fMon.appendChild(el("label", null, "شهر الميلاد"));
    const selMon = el("select");
    selMon.appendChild(el("option", null, "الشهر")); selMon.firstChild.value = "";
    ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"].forEach((m, i) => {
      const o = el("option", null, m); o.value = String(i + 1); selMon.appendChild(o);
    });
    fMon.appendChild(selMon);
    const fYr = el("div"); fYr.appendChild(el("label", null, "سنة الميلاد"));
    const selYr = el("select");
    selYr.appendChild(el("option", null, "السنة")); selYr.firstChild.value = "";
    const nowY = new Date().getFullYear();
    for (let y = nowY; y >= nowY - 100; y--) { const o = el("option", null, String(y)); o.value = String(y); selYr.appendChild(o); }
    fYr.appendChild(selYr);
    row.appendChild(fMon); row.appendChild(fYr); card.appendChild(row);

    const consent = el("label", "abu-consent");
    const chk = el("input"); chk.type = "checkbox";
    consent.appendChild(chk);
    const ctxt = el("span");
    ctxt.appendChild(document.createTextNode("أوافق على "));
    const a1 = el("a", null, "سياسة الخصوصية"); a1.href = "privacy.html"; a1.target = "_blank";
    const a2 = el("a", null, "قواعد المسابقة"); a2.href = "competition-rules.html"; a2.target = "_blank";
    ctxt.appendChild(a1); ctxt.appendChild(document.createTextNode(" و")); ctxt.appendChild(a2); ctxt.appendChild(document.createTextNode("."));
    consent.appendChild(ctxt); card.appendChild(consent);

    const err = el("div", "abu-err");
    card.appendChild(err);

    const btn = el("button", "abu-btn", "ابدأ المغامرة");
    card.appendChild(btn);

    const offlineLink = el("span", "abu-link", "اللعب دون اتصال (لن يُحتسب في الترتيب)");
    offlineLink.addEventListener("click", () => { close(); resolve({ online: false }); });
    card.appendChild(offlineLink);

    let busy = false;
    btn.addEventListener("click", async () => {
      if (busy) return;                                   // prevent double-submit
      err.textContent = "";
      const name = inName.value.trim();
      const first = inFirst.value.trim(), last = inLast.value.trim();
      const email = inEmail.value.trim();
      const vorwahl = inVor.value.trim(), phone = inPhone.value.trim();
      const month = parseInt(selMon.value, 10), year = parseInt(selYr.value, 10);
      if (!NAME_RE.test(name)) { err.textContent = "الاسم: من 3 إلى 20 حرفًا أو رقمًا أو مسافة أو _ أو -."; return; }
      if (!first || !last) { err.textContent = "الرجاء إدخال الاسم الأول واسم العائلة."; return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = "الرجاء إدخال بريد إلكتروني صحيح."; return; }
      if (!vorwahl) { err.textContent = "الرجاء اختيار رمز الاتصال الدولي."; return; }
      if (!/^\d[\d\s\-]{3,}$/.test(phone)) { err.textContent = "الرجاء إدخال رقم هاتف صحيح."; return; }
      if (!month || !year) { err.textContent = "الرجاء اختيار شهر وسنة الميلاد."; return; }
      if (!chk.checked) { err.textContent = "الرجاء الموافقة على سياسة الخصوصية والقواعد."; return; }
      { const nw = new Date(); const yrs = nw.getFullYear() - year - ((nw.getMonth() + 1) < month ? 1 : 0);
        if (yrs < 1) { err.textContent = "يجب أن يكون عمر اللاعب سنة واحدة على الأقل."; return; } }   // rule: age 1+ can play

      busy = true; btn.disabled = true; btn.textContent = "جارٍ البدء…";
      try {
        const c = T.client();
        await c.auth.signInAnonymously();
        const profile = await ensureProfile(c, { name, first, last, email, vorwahl, phone, month, year });
        await T.startRun();
        T.run.playerId = profile.id;
        close(); resolve({ online: true, displayName: profile.display_name });
      } catch (e) {
        err.textContent = mapError(e);
        busy = false; btn.disabled = false; btn.textContent = "ابدأ المغامرة";
      }
    });
    return card;
  }

  /* ---- returning player ("Continue as …") ---- */
  function buildReturning(resolve, profile) {
    const card = el("div", "abu-card"); card.dir = "rtl"; card.lang = "ar";
    card.appendChild(el("h2", null, "مرحبًا بعودتك"));
    card.appendChild(el("p", "abu-sub", "تابع بملفك في المسابقة، أو استخدم لاعبًا آخر."));
    const cont = el("button", "abu-btn", "المتابعة باسم " + profile.display_name);
    cont.addEventListener("click", async () => {
      cont.disabled = true; cont.textContent = "جارٍ البدء…";
      try { await T.startRun(); T.run.playerId = profile.id; close(); resolve({ online: true, displayName: profile.display_name }); }
      catch (e) { cont.disabled = false; cont.textContent = "المتابعة باسم " + profile.display_name;
                  const er = card.querySelector(".abu-err") || card.appendChild(el("div","abu-err")); er.textContent = mapError(e); }
    });
    card.appendChild(cont);
    const other = el("button", "abu-btn alt", "استخدام لاعب آخر");
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
