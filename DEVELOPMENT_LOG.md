# AbuShakra Adventure — Development Log

A chronological record of how the game reached its current state: the features
built, the bugs found and fixed, and the workflow used throughout.

The game is a single self-contained `index.html` (HTML5 Canvas + vanilla JS,
no libraries, no build step), deployed as an installable PWA to GitHub Pages.

---

## Working method (used for every change)

1. Edit `index.html` / `sw.js` in the working dir (`C:\Files\AbuShakra Adv`).
2. **Verify in a live browser preview** — load the page, check the console for
   errors, test the actual feature.
3. Before each verification, clear the service worker + caches and hard-reload
   so the preview never serves a stale page.
4. **Bump the service-worker cache version** (`abushakra-vN`) whenever any file
   changes, so installed clients don't keep the old version offline.
5. Copy the files into the git repo subfolder, commit with a clear message.
6. **Always ask before pushing** (standing instruction).

---

## Feature & fix timeline

### 1. iOS Safari zoom fix + better touch buttons
- **Problem:** the page zoomed after ~5s of tapping on iPhone, and the on-screen
  buttons looked plain.
- **Fixes:**
  - `preventDefault` on `gesturestart/gesturechange/gestureend` to block pinch.
  - A `touchend` double-tap guard (~320 ms) to block double-tap zoom.
  - Viewport meta with `maximum-scale=1.0, user-scalable=no, viewport-fit=cover`.
  - Redesigned buttons: 88px translucent circles with blur + pressed-state
    scale; a larger green 104px jump button; fixed top-right mute button.
- **Bug found:** the jump-button size/color overrides were silently ignored
  because `#touch-controls .btn` (specificity 0,1,1,0) outranked `#btn-jump`
  (0,1,0,0). **Fix:** scope ID rules as `#touch-controls #btn-jump`. Verified
  via computed styles (104px after the fix).

### 2. Reusable master prompt (`GAME_PROMPT.md`)
- Wrote a detailed "paste-this-to-get-this-quality" brief covering engine
  quality, game feel, mobile, audio, PWA, and deploy. Saved as a `.md` file.
- Updated it twice afterward with new lessons learned (see below).

### 3. Background music (original chiptune)
- Added a Web Audio API music module — **an original tune**, not the copyrighted
  Mario theme. I–V–vi–IV progression in C, 32-step melody + bass, lookahead
  scheduler, per-note gain envelope, mute toggle.
- **iOS audio hardening:** unlock the `AudioContext` inside the first user
  gesture (play a 1-sample silent buffer + resume), resume again on
  `visibilitychange` when returning from lock/background, and clamp the
  scheduler so it never queues notes "in the past" after a suspend.
- Noted the iPhone hardware ring/silent switch mutes Web Audio (iOS behavior,
  not a bug).

### 4. Sound effects
- Added synthesized SFX driven off the same audio context: jump (rising slide),
  coin (two blips), stomp (falling slide), hurt (sawtooth drop), game-over
  (descending arpeggio). All gated behind `enabled && audioContext exists`.

### 5. Sprite facing fix
- **Problem:** character faced left when moving right and vice-versa.
- **Cause:** the art faces left by default; the flip condition was inverted.
- **Fix:** `if (player.facing > 0) ctx.scale(-1, 1)` — flip only when going right.

### 6. Game juice — particles + screen-shake
- Lightweight particle system: tan dust on hard landings (gated on impact
  speed), gold sparkle on coin pickup, green poof on enemy stomp.
- Screen-shake magnitude that decays each frame — shake hard on a hit, a little
  on a stomp. Applied as a small random `ctx.translate` around the whole draw.
- Effects run every frame regardless of game state so they settle cleanly.

### 7. High score + difficulty ramp
- Persist the best score in `localStorage` (`abushakra_best`); show "Best" in the
  HUD and a "★ NEW BEST! ★" banner on the game-over screen.
- `difficulty()` ramps from 1.0 → ~2.8 with distance, scaling enemy speed and
  spawn rate.

### 8. Better controls feel
- **Coyote time** (0.10s): can still jump shortly after leaving a ledge.
- **Jump buffering** (0.12s): a jump pressed just before landing still fires.
- **Variable jump height:** releasing jump early cuts upward velocity (×0.45).

---

## Service-worker / "didn't update on phone" saga

- **Symptom:** changes worked on desktop but the phone kept showing the old
  version.
- **Root cause:** the old **cache-first** service worker served a stale
  `index.html`, and the running page never reloaded when the new worker
  activated in the background.
- **Verification:** confirmed the server was actually live with
  `curl` (checked `sw.js` version and that `index.html` contained the new code)
  — proving it was a device cache issue, not a deploy failure.
- **Fixes shipped:**
  - Service worker now serves the **HTML document network-first** (fresh when
    online, cached copy only as offline fallback); static assets stay
    cache-first for speed.
  - `skipWaiting()` + `clients.claim()` in the worker.
  - In the page: listen for `controllerchange` → `location.reload()` once
    (guarded against loops), and call `reg.update()` on load + hourly.
  - Bump the cache version on every change (now at **`abushakra-v9`**).
- **One-time caveat (explained to user):** the auto-reload only helps *after* a
  worker containing it is installed. Going from the old cache-first worker to
  this one still needs **one manual clear** on the device (delete + re-add the
  home-screen app, or clear Safari website data). After that, updates auto-apply.

---

## Deployment

- Hosted on **GitHub Pages** via a GitHub Actions workflow
  (`configure-pages` / `upload-pages-artifact` / `deploy-pages`).
- Repo owner account: **SohaibYass** (one push hit a 403 from a credential
  mismatch; resolved once the correct account credentials were in place).

---

## Current state

- Latest deploy: service worker cache **`abushakra-v9`**.
- Commit history (recent): iOS zoom/buttons → music iOS hardening → facing fix →
  network-first SW → prompt update → juice → SW auto-reload → prompt lessons →
  SFX + high score + difficulty → jump feel.

## Possible next features (not yet built)

- Power-ups: shield, double-jump, speed boost, coin magnet.
- Enemy variety: hopper, flyer, tank.
- Moving platforms + hazards (spikes, pits with visual telegraph).
