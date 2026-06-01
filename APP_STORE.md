# AbuShakra Adventure — App Store & Monetization Notes

My honest assessment of whether (and how) this game could go on the Apple App
Store and be sold, plus the trade-offs.

---

## Short answer

**Yes, it can be done — but not by uploading the PWA as-is.** Apple does not
accept a raw website/PWA into the App Store. You have to ship a real native app
binary (an `.ipa`) that *contains* the game. The good news: the entire game is
already self-contained HTML/JS/Canvas, so wrapping it is straightforward.

---

## The realistic path

### 1. Wrap it in a native shell
Use **Capacitor** (modern, recommended) or Cordova. These embed your
`index.html` + assets inside a native WebView and produce an Xcode project you
can build and submit.

- Capacitor: `npm i @capacitor/core @capacitor/cli`, `npx cap init`,
  `npx cap add ios`, drop the game files in `www/`, `npx cap copy`,
  open in Xcode, build.
- The game keeps running exactly as it does now — no rewrite.

### 2. Clear Apple's "minimum functionality" bar (Guideline 4.2)
Apple rejects apps that are "just a repackaged website" with no native value.
A plain WebView wrapper risks rejection. To be safe, add genuine native value:

- **Game Center** — leaderboards (global high score) + achievements.
- **In-App Purchases** — remove ads, cosmetic skins, extra characters.
- **Haptics / native sound**, push notifications, offline-by-design.
- Polish: launch screen, proper icon set, no browser chrome.

### 3. What it costs / requires
- **Apple Developer Program: $99 / year** (mandatory to publish).
- **A Mac + Xcode** to build and upload (no way around this for iOS).
- Apple takes **30%** of sales (or **15%** under the Small Business Program if
  you earn under ~$1M/yr).
- App review can take a few days and may bounce a few times.

---

## Selling models that work

| Model | Notes |
|---|---|
| Paid up-front (e.g. $0.99–$2.99) | Simple, but hard to get downloads cold. |
| Free + IAP | Most common for casual games; sell skins/lives/no-ads. |
| Free + ads | Use a native ad SDK; pairs well with a "remove ads" IAP. |

For a game at this scope, **free + a couple of IAPs (remove ads, skins)** is the
most realistic earner.

---

## Cheaper / faster alternatives

- **Google Play** is far easier and cheaper: a **TWA** (Trusted Web Activity)
  via **Bubblewrap** can publish the PWA almost directly. One-time **$25** fee.
- **itch.io** — upload the web build, optional "pay what you want." Zero
  gatekeeping, instant.
- **Keep it a PWA** — "Add to Home Screen" already works on iOS and Android for
  free, no store, no cut. Just no store discovery or in-app billing.

---

## Honest expectations

- The tech side is easy; **discovery is the hard part.** Thousands of casual
  platformers ship monthly. Without marketing, downloads will be low.
- Budget realistically: ~$99/yr + a Mac just to *be listed*. Treat early
  revenue as a bonus, not a salary.
- Best first move if you're curious: **publish the PWA to itch.io and/or Google
  Play TWA** (cheap, fast), gauge interest, *then* invest in the Apple wrapper.

---

## Intellectual-property note

The background music in the game is an **original chiptune** I composed in the
8-bit style (an I–V–vi–IV progression) — it is **not** the Mario theme or any
copyrighted melody. That keeps it safe to sell. Make sure any sprite art
(`character.png`, `enemy.png`, etc.) is also yours or properly licensed before
charging money for the app.
