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

### 15. Level 1 reworked to natural Zugspitze terrain
- **Goal:** Level 1 ("Zugspitze") should feel like climbing the painted mountain,
  not jumping arcade blocks on a flat line.
- **Scene drawn 1:1:** the whole `Zugspitze.png` is drawn mirror-tiled at 1:1
  (no parallax) by `ZUG_TILE_W = 900`, so the painted foreground stays locked to
  the collision as the world scrolls. (Trade-off: the distant peaks lost their
  parallax depth — acceptable for exact alignment.) Levels 2–3 are untouched
  (still block platforms / flat ground), gated by a per-level `terrain:"natural"`.
- **Collision from the painting:** the playable surface is a heightmap, not
  blocks. `surfaceY(x)` drives player + enemy collision; the player **auto-steps**
  small rises (≤20px), **jumps** to climb taller ones, and walks off edges to
  drop. Carabiners spawn just above the painted surface.
- **Iterations to get the surface right:**
  1. First tried *random terraces* — uneven, but didn't match the painted art.
  2. Auto-detecting grass/rock tops (`analyze_terrain.py`) was noisy (caught
     distant forest & tree tops); cleaned to *quantised flat ledges*.
  3. **Source of truth = a hand-drawable red line on `terrain_overlay.png`.**
     `overlay_to_ledges.py` reads that red stroke per column (topmost solid run,
     so high cliffs survive and steps resolve cleanly) into a **dense surface
     heightmap** (`ZUG_SURF`, 226 samples/tile). `surfaceY` linear-interpolates
     it, so collision follows the drawn line **exactly** (slopes + steps), and
     `ledges_check.png` overlays the result for verification.
- **Workflow:** edit the red line in `terrain_overlay.png` → `python
  overlay_to_ledges.py` → paste the printed `ZUG_SURF` into `index.html`.
- **Lesson:** auto-extracting a walkable line from a painted scene is fragile
  (distant greenery / trees fool colour heuristics); letting a human draw the
  collision line on an overlay and tracing *that* is far more reliable — and the
  surface must be a single-valued heightmap, so resolve vertical cliffs to one
  side rather than averaging (averaging spikes).

### 16. All three levels = natural peaks (Grossglockner, Grande)
- **Generalised the terrain system** so any level can be natural: each natural
  `LEVELS` entry carries its own `surf` heightmap + `tileW` (and now a `country`
  field, shown in the HUD). `surfaceY` and `drawNaturalScene` read the *current*
  level's data, so adding a natural level is pure data — no engine changes.
- **The peaks:** L1 **Zugspitze** (Germany) → L2 **Grossglockner** (Austria) →
  L3 **Grande** (Italy). Each background + collision comes from a paired
  `<Name>.png` / `<Name>_terrain_overlay.png`. `advanceLevel` snaps the player
  onto the new painted surface so transitions don't start embedded/floating.
- **`overlay_to_ledges.py` is now reusable:** `python overlay_to_ledges.py
  <overlay.png> <VAR_NAME> <check.png>`.
- **Tracer hardening (driven by the new art):**
  - *Grossglockner* has steep stacked cliffs — the tracer takes the **top-most
    stroke** per column and **median-filters** the sampled surface to kill the
    thin spikes that steep cliff overlaps produce.
  - *Grande* is a **sunset** scene; warm orange-brown rock was matching the red
    detector. Fixed with a **strict pure-red test** (`g<90, b<90, r-g>95`), which
    also let us **scan higher up the image** to capture tall ledges — that's what
    made the Grande right cliff follow the line up to the top grassy ledge.
- **Playability check:** each level is auto-walked end-to-end in a test — the
  player must stay exactly on the surface (0 frames off) and never get stuck;
  big step-ups stay within jump height.
- **TEMP test flag:** `ENEMIES_ENABLED` gates snake spawning — set `false` while
  proving out the terrain, flip back to `true` to ship enemies.

### 17. Five peaks + Mont Blanc + the "impassable cliff" guard
- Grew the run to **5 Alpine peaks**: Zugspitze (DE) → Grossglockner (AT) →
  **Cime Grande** (IT) → **Matterhorn** (CH) → **Mont Blanc** (FR), each natural
  terrain traced from its overlay. Win screen counts `LEVELS` dynamically.
- **Multi-scene levels (engine generalisation):** a natural level can carry a
  `tiles: [{bg, surf, tileW}, …]` array — scenes play in sequence and repeat
  (no mirror). (Built for a two-scene Mont Blanc, then reverted to single-scene
  at the user's request; the `tiles` path remains for future use.)
- **Climb-rate cap (key fix):** Matterhorn's right cliff was a ~158px wall —
  taller than the jump (~144px) — which would trap the player (and the tile
  repeats). The extractor now caps how fast the surface may *rise* per sample so
  a too-steep cliff becomes an **auto-walkable steep slope**. Made it
  **forward-only** (a backward pass had ramped up *before* the cliff, creating a
  false triangular peak that didn't match the drawn line).
- **`overlay_to_ledges.py` lessons:** strict pure-red + high scan + median +
  forward climb-cap. Edit the red line, re-run, paste the printed surf.

### 18. Mountain Progress dashboard (between levels)
- After each level (the `levelcomplete` state) a **dashboard** replaces the plain
  interstitial: "Level Complete", the mountain + country just finished,
  **carabiners this level** (new per-level counter), total score, lives.
- A horizontal **5-node journey map** (mountain icon + name + country + a
  procedurally-drawn **national flag** per node). Completed nodes are green with
  a check and a green route line; the next node is highlighted; future nodes are
  dimmed. An **AbuShakra marker animates** in an arc from the completed node to
  the next (`dashboard.animTime`, smoothstep), with "AbuShakra travels from X to
  Y" and a blinking "Press / Tap to continue".
- **Flags are drawn on the canvas, not emoji** — flag emoji don't render as
  flags on many platforms (Windows shows "DE"/"CH" letters), so each flag is a
  few `fillRect`s (stripes / Swiss cross).
- Wiring: `checkLevelProgress` builds the `dashboard` object; the loop advances
  its `animTime` (since `update` only runs while playing); `advanceFromScreen` →
  `advanceLevel` continues and resets the per-level carabiner counter. Last level
  still goes straight to the Win screen.

### 19. Full-screen cover + "How to Play" intro
- Title cover swapped a few times; final art is **`AbuVsSnake_4.png`** at **16:9
  (1672×941)** so cover-fit fills the 800×450 screen **exactly — no crop, no
  bars** (the earlier 3:2 covers either cropped the flags/title or left side
  bars; a 16:9 source is the clean fix). The cover carries the title + 5 country
  flags, so the controls text was removed from it.
- New **`instructions` state**: after you start, the game explanation (controls,
  scoring, "climb all 5 peaks") shows for **5 seconds** with a countdown +
  progress bar, then auto-starts. Taps are ignored during the hold. Win/Game-over
  return to the cover.
- **Encoding gotcha (again):** a PowerShell `Set-Content` round-trip double-
  encoded the HUD's `·`/`—` into `Â·`/`â€"` and added a BOM. Fixed by reversing
  the bytes (UTF-8 → 1252) and stripping the BOM; **only ever edit these files
  with the UTF-8-safe Edit/Write tools.**

### 20. Level 1 reworked into two parallax layers
- **Problem:** Level 1 was one image (mountains + foreground) mirror-tiled, so the
  **Zugspitze peak duplicated/flipped** as it scrolled. Slicing that one image
  into bg/fg bands left a visible horizontal **tear** (the layers scroll at
  different speeds). The real fix is purpose-built separate layers.
- **Two layers (user-supplied art):**
  - **Far background** `Zugspitze_Back.png` (16:9): fills the height, **slow
    parallax (0.4)**, **mirror-tiled** so the distant range/clouds loop with **no
    seam** and no duplicated peak (the image isn't seamless on its own; flipping
    every other copy makes the edges match — invisible on a hazy range).
  - **Near foreground** `Zugspitze_Front.png` (transparent PNG): drawn **1:1**,
    tile width 675, painted rock ledges + **3 floating platforms**; the
    background shows through the alpha.
- **Collision** traced from `Zugspitze_Front..._collisionline_1.png`: a **ground
  heightmap** (`surfaceY`, and parallax levels tile it **without** the mirror flip
  so it matches the 1:1 foreground) **plus 3 floating-platform boxes** generated
  per tile — one-way landable, **invisible** (they're painted into the fg art, so
  `drawPlatforms` skips natural levels).
- **Jump raised 144 → 168px** (`JUMP_VELOCITY` −760 → −820) so all three floating
  platforms are reachable; verified all 5 levels still traverse end-to-end.
- **Per-level `bgMode: "parallax"`** gates all of this — Levels 2–5 keep their
  single-image mirror-tile. (`drawParallaxScene` draws bg then fg.)
- **Reusable plan for the other peaks:** same recipe — a far `*_Back.png`, a
  transparent `*_Front.png` (with platforms), and a `*_collisionline.png` to
  trace, then point the level at them with `bgMode:"parallax"`.

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

- Latest deploy: service worker cache **`abushakra-v47`**.
- Commit history (recent): … → hazards → 10-frame walk animation → Level 1
  natural Zugspitze terrain (heightmap traced from `terrain_overlay.png`) → all
  5 natural peaks: Zugspitze/Grossglockner/Cime Grande/Matterhorn/Mont Blanc
  (per-level `surf`; climb-cap for unjumpable cliffs) → Mountain Progress
  dashboard (journey map + national flags) → 16:9 cover + 5s "How to Play"
  intro → Level 1 two-layer parallax (far `Zugspitze_Back` + transparent
  `Zugspitze_Front` with 3 platforms; jump raised to 168px).
- **NOTE:** enemies are currently **disabled** (`ENEMIES_ENABLED = false`) for
  terrain testing — re-enable before treating this as a player-facing build.
- **Encoding gotcha (learned the hard way):** never round-trip the source files
  through PowerShell `Get-Content`/`Set-Content` — PS 5.1 reads as Windows-1252
  and writes UTF-8, **double-encoding** non-ASCII (`·`, `—`, `★`) into mojibake
  (`Â·`, `â€"`) plus a stray BOM. Use the Edit/Write tools (UTF-8 safe). To undo
  a double-encoded file: read bytes → `UTF8.GetString` → `Encoding(1252).GetBytes`
  → write bytes.
- **SW precache gotcha (learned here):** never list a file in `cache.addAll`
  unless it exists — one 404 rejects the whole install and silently breaks
  offline mode. Caught when `background.png` was renamed to per-level
  backgrounds; the precache list must be updated in the same change.

## Possible next features (not yet built)

- Power-ups: shield, double-jump, speed boost, carabiner magnet.
- (Moving platforms + holes shipped in §13. Spikes / crumbling blocks / lava /
  carnivorous plants were prototyped there and cut — revisit only if wanted.)
