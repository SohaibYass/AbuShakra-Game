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

### 9. Carabiners + three Dolomites levels
- **Reskin (coins → carabiners):** new `carabiner.png` sprite, renamed all
  `coin*` → `carabiner*`, sized the draw box + collision hitbox from the art's
  aspect ratio (taller than wide), switched the pickup particle gold → silver.
- **Data-driven levels:** a `LEVELS = [...]` config (name, background, score
  target, per-level enemy speed / spawn rate) drives the active world.
- **Cumulative milestones:** one continuous run; the world swaps as total score
  passes 500 → 1000 → 1500.
- **Flow:** title → Level 1 → "Level Complete" interstitial (+1 life) → Level 2
  → interstitial (+1 life) → Level 3 → "You Win!" → restart. Score and lives
  carry over. A single `advanceFromScreen()` handler drives every non-play
  screen so input stays consistent.
- **HUD:** current level name + a progress bar toward the level's target.
- **Backgrounds:** three real pixel-art Dolomites scenes (Lavaredo / Odle /
  Latemar) supplied by the user, replacing the generated placeholders.
- New `sfxLevel` / `sfxWin` chiptune cues.

### 10. Seamless mirror-tiling backgrounds
- **Problem:** the wide mountain backgrounds showed an ugly hard seam where the
  image repeated.
- **Fix:** mirror-tile the background — draw every other copy horizontally
  flipped (`ctx.scale(-1,1)`) so a flipped tile's left edge equals the previous
  tile's right edge, forming a seamless loop. Flip parity is keyed to *world*
  position (not screen) so tiles don't flicker while scrolling, with a 1px
  "bleed" overlap so no dark hairline shows at a boundary. Works with any image.

### 11. Enemy variety (hopper, flyer, tank)
- **Data-driven enemy types:** an `ENEMY_TYPES` table (size, speed, HP, points,
  colour, air/ground) plus a per-level `enemyMix` array that the spawner samples,
  so each level introduces tougher foes (L1 walker-heavy + a hopper → L2 adds
  flyers → L3 adds tanks).
- **The four types:**
  - **Walker** — the original ground patroller, 1 HP, 50 pts.
  - **Hopper** — gravity + a periodic hop; squashes/stretches with its vertical
    speed; green glow, 70 pts.
  - **Flyer** — floats at jump-reachable height, bobs up/down, flapping wings;
    purple glow, 80 pts.
  - **Tank** — big and slow, **2 stomps to kill** (white flash + armour plate +
    HP pips after the first hit); grey glow, 120 pts.
- **Multi-hit stomp:** `handleEnemies` decrements per-enemy `hp`; an enemy only
  dies (and pays out) at 0, otherwise it flashes and keeps coming.
- Since all types share one `enemy.png`, a soft **type-coloured radial glow** is
  drawn behind each so the variety reads at a glance.

### 12. Real pixel-art assets (carabiner + character)
- Swapped the placeholder **carabiner** for the user's pixel-art version and the
  **character** for an updated Abu sprite (now carrying a rope coil + belt
  carabiner).
- **Asset processing pipeline** (done in Pillow before wiring in):
  - **Carabiner:** simple near-white → transparent + auto-crop (the art's only
    light areas are the background).
  - **Character:** the sprite has *interior* white details (headband checks,
    jacket logo, eyes), so a blanket "near-white → transparent" would punch holes
    in it. Used a **flood-fill from the image borders** instead, clearing only the
    *connected* background, then auto-cropped.
  - Re-derived each sprite's draw box / hitbox from the cropped aspect ratio
    (carabiner `CARABINER_W` 22→23; character box unchanged — new aspect 0.469 ≈
    old 0.484).
- **Lesson:** auto-crop + a tight hitbox keep collisions honest when art is
  re-exported at a different size; and prefer border flood-fill over a global
  white-key threshold whenever a sprite legitimately contains white.

### 13. Hazards — empty holes + moving/elevator platforms
- **Empty holes:** gaps carved into the otherwise-continuous ground. A
  `groundSolidAt(x)` check makes the floor non-solid over a hole, so you fall in;
  dropping past the rim costs a life and rescues you back onto the near solid
  edge. Holes are width-capped (≤150px) and centred in a gap with ground on both
  sides, so every one stays clearable with a single jump.
- **Moving / elevator platforms:** a new platform `kind: "mover"` that oscillates
  on one axis (vertical elevator or horizontal slider) via a sine phase. The
  player is *carried* — `updatePlatforms` runs before `updatePlayer`, detects a
  rider with `playerRidingOn`, and applies the platform's per-frame delta to the
  player. Telegraphed with a cyan outline + directional chevrons. Vertical
  elevators keep their low point a jump above the ground so they're reachable.
- **Data-driven & escalating:** each `LEVELS` entry has a `haz: { mover, pit }`
  probability block; `makePlatform` rolls for movers and `maybeGroundHazard`
  rolls for holes, ramping up L1 → L3.
- **Order matters:** movers update first (so the player's landing test sees their
  new position), rider-carry uses *last* frame's `onGround`, and the landing loop
  skips any platform flagged `solid === false`.
- **Scope note:** spikes, deadly carnivorous plants, lava pits, and crumbling
  platforms were each prototyped during this feature and then removed at the
  user's request — the shipped set is deliberately just holes + moving platforms.
  (Lava became a plain dark "empty hole"; crumbling blocks were cut entirely.)

### 14. Walk animation — "walk, not slide"
- **Problem:** Abu glided across the ground (a single static sprite just
  translating), so it read as sliding/skating.
- **Step 1 — procedural gait:** added a real walk-cycle bob/rock/squash plus a
  **dust puff on every footstep** (footfall = each time `walkPhase` crosses a
  multiple of π). Stance resets to neutral when standing still.
- **Step 2 — segmented legs (tried & learned):** cut the sprite at the hips and
  animated the leg halves. Lesson: the art is a **front view**, so rotating the
  legs fore/aft just splays them sideways (a jumping-jack), never a side-on
  stride. Switched to **alternating leg lifts** (a march) which reads correctly
  from the front.
- **Step 3 — baked sprite sheet (shipped):** a Python/Pillow tool
  (`gen_walk.py`) builds a tiny skeleton from `character.png` — torso + per-leg
  **thigh & shin** with a knee joint — and poses a **10-frame** walk cycle
  (`character_walk.png`). The game plays it as a real frame loop: frame =
  `floor(walkPhase / (2π / WALK_FRAMES))`. Idle/airborne still use the standing
  sprite, so there's no pop on start/stop.
- **Body moves with the legs:** the torso is also animated per frame — vertical
  **bob**, **shoulder rock** (rotated about the pelvis), and a **weight-shift
  sway** toward the planted leg.
- **Padding gotcha:** the source art has the head flush at the top edge, so any
  upward bob/rock clipped the head. Fixed by baking each frame on a **padded
  cell** (headroom + side room) and teaching the game (`WALK_PAD_X/Y`) to draw
  the padded cell at the standing-sprite scale with the feet anchored.
- **Honest limit:** frames are *derived from the one front-view photo* by
  puppeting limbs — a clean looping march, not hand-drawn side-view art. Tunable
  in `gen_walk.py` (frame count, lift/knee, bob/rock/sway).

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

- Latest deploy: service worker cache **`abushakra-v24`**.
- Commit history (recent): juice → SW auto-reload → prompt lessons → SFX + high
  score + difficulty → jump feel → App Store/dev-log docs → carabiners + 3
  Dolomites levels + seamless backgrounds → prompt lessons (levels/tiling/SW) →
  enemy variety (hopper/flyer/tank) → real pixel-art carabiner → updated Abu
  character sprite → new title cover (Abu vs the snake) → title cache-bust
  (`?v=`) → hazards (empty holes + moving/elevator platforms) → 10-frame walk
  animation (legs + body) baked via `gen_walk.py`.
- **SW precache gotcha (learned here):** never list a file in `cache.addAll`
  unless it exists — one 404 rejects the whole install and silently breaks
  offline mode. Caught when `background.png` was renamed to per-level
  backgrounds; the precache list must be updated in the same change.

## Possible next features (not yet built)

- Power-ups: shield, double-jump, speed boost, carabiner magnet.
- (Moving platforms + holes shipped in §13. Spikes / crumbling blocks / lava /
  carnivorous plants were prototyped there and cut — revisit only if wanted.)
