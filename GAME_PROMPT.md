# Master Prompt — 2D Platformer (HTML5 Canvas, single file)

A reusable brief for building a polished, installable 2D platformer at the same
quality level as AbuShakra Adventure. Paste the section below as a starting
prompt, then iterate in layers. (Updated to reflect the painted-terrain /
parallax / mp3-music systems the game grew into.)

---

## The prompt

**Goal:** Build a complete, polished 2D side-scrolling platformer as a *single
self-contained `index.html`* — HTML5 Canvas + vanilla JavaScript, **no libraries,
no build step**. Must run by just opening the file or serving the folder.

**Assets:**
- Put all sprite/image links in one `ASSETS = {}` object at the top of the script
  so they're easy to swap. Use a `?v=N` query on each one and **bump it whenever
  the file's pixels change** (see the stale-image-cache gotcha below).
- Use the PNGs in this folder if present; if one is missing, generate a placeholder.
  *(Typical files: `character.png`, `character_walk.png`, `enemy.png`, a collectible
  (`carabiner.png`), per-level backgrounds, plus a title/cover image.)*
- If any sprite has a white background, remove it (transparent) and auto-crop to
  the content.
- Note which way the character art faces by default, and flip it (`ctx.scale(-1,1)`)
  so the sprite always faces its movement direction.
- For any **non-square** sprite (a tall pickup, a wide enemy), size its draw box
  *and its collision hitbox* from the cropped art's aspect ratio — don't reuse a
  square size, or collisions feel off (too generous/stingy).

**Core mechanics:**
- Walk-and-jump control (NOT an auto-scroller): A/D or arrows to move, Space/Up/W
  to jump. Add coyote-time + a short jump-buffer + variable jump height (cut upward
  velocity when the key is released) so the jump feels good.
- Follow-camera in world coordinates; looping/parallax background (see below).
- Ground + platforms (two models — pick per game, or per level):
  - **Procedural:** generated platforms (varied gaps/widths/heights) over a
    continuous ground so the player can't fall into an unwinnable spot.
  - **Painted natural terrain:** a per-tile **height-map** the player walks on
    (see "Natural terrain from painted art"). Far richer-looking; this is what the
    later levels use.
- Enemies spawn over time and move left; **stomp** them for points, touching them
  otherwise costs a life. Keep an `ENEMIES_ENABLED` flag — turning enemies off is
  invaluable while you tune terrain/collision.
- Collectibles (coins / carabiners) = points. Keep the point values as named
  constants and show them on the How-to screen so they stay in sync (e.g. clip
  **+1**, stomp **+2** — small, readable numbers beat big ones).
- HUD: Score + lives. Draw **lives as heart icons** (a small `drawHeart(cx,cy,s)`
  path — two arcs + a point), not "Lives: N" text; fall back to "♥ ×N" past ~6.
  Brief invulnerability after taking a hit.
- Title/cover splash ("press / tap to start"), an optional **"How to Play"** card
  held a few seconds before play, and a Game Over + restart flow.

**Background rendering (two options):**
- **Single image, mirror-tiled** (no seamless art needed): draw every other copy
  horizontally flipped (`ctx.scale(-1,1)`) so a flipped tile's left edge equals the
  previous tile's right edge. Key the flip parity to *world* position
  (`tileIndex = floor(scroll / tileW)`), not screen position, or tiles flicker; add
  a ~1px overlap so no dark hairline shows at a seam.
- **Two-layer parallax** (what the polished levels use): a far **`*_Back.png`**
  (opaque, fills the frame, mirror-tiled, slow parallax ~0.4) **plus** a transparent
  near **`*_Front.png`** drawn **1:1** (no mirror) that holds the painted ground +
  any floating platforms; the background shows through its alpha. The foreground
  must be left-right seamless on its own (it isn't mirrored) and must fill solidly
  to the bottom edge (see the floating-foreground patch).

**Natural terrain from painted art (the heightmap system):**
- Collision is a dense `surf[]` height array sampled across one tile width; a
  `surfaceY(worldX)` interpolates it (and mirror-flips the sample on odd tiles when
  the background is mirror-tiled, but **not** in parallax mode where the foreground
  is 1:1).
- Get the heightmap one of two ways:
  - **Hand-drawn collision line:** the artist draws a thin **bright-red line** along
    the walkable surface on a copy of the foreground; a small Python extractor
    (`overlay_to_ledges.py`) reads the pure-red pixels (strict `r>165,g<90,b<90`),
    takes the top-most stroke per column, median-filters, and emits the array.
  - **Derived from the PNG alpha** (when there's no collision line): per column the
    top-most opaque pixel in the lower band = the ground top; for a **floating
    platform deck** use *horizontal coverage* (first row where ≥~78% of the
    platform's width is opaque) so a tree/boulder on the platform doesn't pull the
    collision up into the foliage.
- **Climb-rate cap:** clamp how fast `surf` may *rise* per sample (forward-only) so
  any cliff taller than the jump becomes an auto-walkable steep slope instead of an
  invisible wall that traps the player (the tile repeats forever).
- **Floating platforms** are invisible AABB boxes (`{x0,x1,top}` in game coords)
  painted into the foreground art and rebuilt per tile; one-way landable. Keep their
  `top` within one jump height of the ground beneath them, or chain them (ground →
  P1 → P2). Jump height = `JUMP_VELOCITY² / (2·GRAVITY)`.
- **Floating-foreground patch (recurring):** image generators love to leave the
  painted terrain hovering above the canvas bottom with a drop-shadow gap, so the
  parallax background shows through underneath. Fix it in a quick PIL pass: per
  column, copy/reflect the existing rock band **downward to the bottom edge**,
  darkening with depth so it reads as deep earth (leave floating platforms alone).
  Tell the generator to "fill solid to the bottom, no shadow/empty band" too, but
  keep the patch as the reliable backstop. Keep the untouched original as `*_ORIG`.
- **Collectible placement:** scatter pickups deterministically *per tile* (place
  once as the world-gen pointer steps a whole tile, so `collected` state is stable
  and never respawns). Put them on platform decks and in the ground gaps **between**
  platforms (never stacked), at chest height so the ground ones are grabbed by just
  walking. A sparse, alternating-by-tile pattern keeps a low score target from being
  cleared instantly.

**Engine quality requirements (important):**
- Delta-time `requestAnimationFrame` loop (frame-rate independent).
- Reliable AABB collision with **no tunneling** — check previous vs. new position
  for landings.
- Fixed internal resolution (e.g. 800x450) scaled to fit the screen,
  `imageSmoothingEnabled = false` for crisp pixels.
- Procedural / sprite-sheet walk animation — don't just slide the sprite. Make sure
  lean/flip use the facing direction consistently.
- Clean, organized code with section headers and tunable constants grouped at the top.

**Game feel / "juice":**
- Lightweight particle system (array of `{x,y,vx,vy,grav,life,size,color}`): dust on
  hard landings, sparkle on pickup, a poof when an enemy is stomped. Gate landing
  dust on impact speed so it doesn't spam while walking.
- Screen-shake: a magnitude that decays each frame; shake hard on a hit, a little on
  a stomp. Apply as a small random `ctx.translate` around the whole draw, inside
  save/restore.
- Run particles + shake every frame regardless of game state (cosmetic), so they
  settle cleanly even on the game-over screen.

**Multiple levels (data-driven):**
- Put levels in one `LEVELS = [...]` config at the top: name, country, background
  key(s), score target, per-level difficulty (enemy speed / spawn / mix), terrain
  data (`surf`, `tileW`, `platforms`), optional `music` and `cutscene`. Drive
  everything from the current level entry, not scattered globals.
- Progression model: **cumulative score milestones** (one continuous run; the world
  swaps as total score passes each target — suits an endless/painted scroll) **or**
  per-level reset. Don't mix them by accident. Keep targets *small* if points are
  small (clip +1 / stomp +2 → targets like 20/40/60…).
- Flow states: cover → (how-to) → playing → an **interstitial** between levels →
  next level → **"You Win!"** after the last target → restart. Carry score/lives
  across levels (a small bonus per level feels good); reset only what should reset.
  Reuse one generic "advance the non-play screen" handler for every non-play screen
  so input stays consistent.
- A nice interstitial: a **progress map / dashboard** — a row of level nodes
  (completed ✓ / current highlighted), an animated character marker travelling to
  the next node, country flags, carabiners-collected, total score, lives. **Draw
  flags procedurally with `fillRect` stripes / shapes, NOT emoji** — Windows renders
  flag emoji as plain letters.
- Optional per-level **victory cutscene:** an off-canvas hidden `<video>` drawn onto
  the canvas via `ctx.drawImage(video,…)`; a `cutscene` state short-circuits the
  draw; tap/press skips; auto-advance to the interstitial on `ended`. Try unmuted →
  fall back to muted if autoplay-with-sound is blocked.

**Music & sound:**
- **Background music: looped `<audio>` mp3, per level.** Give each level a `music`
  field and a `Music.setTrack(src)` that swaps the source only when it changes
  (keeps playing across the swap if music is already on, otherwise just arms it so
  the cover stays silent until the first tap). Wire it into reset / level-advance.
  *(An original synthesized 8-bit chiptune via the Web Audio API is a fine no-files
  alternative — compose an original tune, never a copyrighted melody.)*
- **Sound effects stay synthesized** with the Web Audio API (oscillators + a short
  gain envelope per note): jump, pickup, stomp, hurt, level, win. They share one
  unlocked `AudioContext`. Add a mute toggle that gates both music and SFX.
- **iOS audio rules:** audio can only begin inside a user gesture. Unlock on the
  first tap/key (resume the context + play a 1-sample silent buffer), resume again
  on `visibilitychange` when returning from background/lock, and call `audio.play()`
  inside a gesture (catch the rejected promise). Heads-up: the iPhone hardware
  ring/silent switch mutes Web Audio — that's iOS, not a bug.

**Mobile / phone support:**
- Responsive canvas that fits any screen.
- On-screen touch buttons (left, right, jump) shown only on touch devices;
  multi-touch safe; clear visuals with pressed-state feedback. Use `touchstart`/
  `touchend` with `preventDefault`.
- **iOS Safari zoom fixes** (it ignores `user-scalable=no`): `preventDefault` on
  `gesturestart/change/end` to block pinch, and a `touchend` double-tap guard
  (~320ms) to block double-tap zoom. Add `touch-action: none` on the play area.
- Watch CSS specificity on the buttons: a selector like `#wrap .btn` (0,1,1,0)
  outranks a plain `#btn-jump` (0,1,0,0), so per-button overrides silently fail —
  scope the ID rules to match.

**Make it installable (PWA):**
- Web manifest + service worker, with iOS "Add to Home Screen" meta tags +
  apple-touch-icon; app icons (192/512/maskable).
- **Service worker strategy:** serve the HTML document **network-first** (fresh
  when online, cached copy only as an offline fallback) and static assets
  cache-first. A fully cache-first shell makes phones keep a stale page for an
  extra load, so fixes look like they "didn't apply."
- **Auto-reload on update:** in the page, listen for `controllerchange` and
  `location.reload()` once (guard against loops), and call `reg.update()` on load.
  With `skipWaiting()` + `clients.claim()` in the worker, a freshly deployed
  version then applies within a single launch instead of the next one.
- **Always bump the service-worker cache version when any file changes**, or
  installed clients keep serving the old version offline.
- **Never list a file in the precache (`cache.addAll`) unless it actually exists
  on disk.** `addAll` rejects the *entire* install on a single 404, silently
  breaking offline mode. When you rename/remove an asset, update the precache list
  in the same change — and prune dead assets, they're downloaded on every install.
- **One-time stale-SW caveat:** the auto-reload only helps *after* a worker that
  contains it is installed. Going from an older cache-first worker to this setup
  still needs one manual clear on the device (delete + re-add the home-screen app,
  or clear the site's website data).

**Gotchas worth pre-empting:**
- **Stale image cache:** swapping a file's *contents* while keeping the same
  `?v=` (or no query) makes the browser/SW serve the **old cached image** — you'll
  chase a "ghost" that isn't in the file. Bump the `?v=N` on any same-named image
  whose pixels change, in addition to the SW cache version.
- **PowerShell double-encoding:** never round-trip the source through PS 5.1
  `Get-Content`/`Set-Content` — it reads as Windows-1252 and writes UTF-8, mangling
  non-ASCII (`·`, `—`, `★`) into mojibake plus a BOM. Use UTF-8-safe edit tools.
- **"Works on desktop, not on phone"** → suspect the service-worker cache first:
  bump the cache version, confirm HTML is network-first, and verify the live server
  with `curl` (check the `sw.js` version) before assuming a deploy failure.

**Dev conveniences:**
- A small **"Test Level N" button**, shown only on the cover, that jumps straight
  into a chosen level (skips cover + how-to + earlier levels; sets score to that
  level's entry milestone so its progress bar/target stay correct). Saves enormous
  time iterating on a late level.

**Deployment (optional):**
- Set it up to deploy to GitHub Pages via a GitHub Actions workflow
  (configure-pages / upload-pages-artifact / deploy-pages). Enable Pages with
  Source = "GitHub Actions" in repo settings. To temporarily take it offline use
  **Settings → Pages → Unpublish site**; re-publish by re-running the deploy
  workflow (Actions tab) or pushing any commit.

**Process I want you to follow:**
- Edit, then **verify in a browser preview** (load the page, check the console for
  errors, test the actual feature — buttons, collisions, facing, audio) before
  telling me it's done.
- After verifying, copy the files into my git repo subfolder and commit/push with
  a clear message. **Show me the change and get approval before pushing** (push
  auto-deploys live).
- Tell me explicitly if something can't be tested (e.g. real on-device iOS
  behavior or the hardware silent switch).

---

## Tips for getting this level out of it

- Lead with the single-file/no-libraries constraint and the engine-quality bullets
  — those are what separate a toy from something that feels good to play.
- Give the asset folder up front and say "create placeholders if missing" so it
  never stalls.
- Add features in *layers* across messages (basic game → fix feel → terrain →
  mobile → music → installable → deploy) rather than asking for everything perfect
  in one shot — each layer is easier to verify and correct.
- For painted terrain, hand the model a **collision-line overlay** (a red line on
  the walkable surface) when you can — it's far more reliable than deriving collision
  from the art, especially around trees/boulders on platforms.
- When something's wrong on a real device, describe the symptom concretely
  ("zooms after ~5s of tapping jump", "character floats above the grass on
  platform 2") — that's what lets the fix target the real cause instead of guessing.
- If a change "works on desktop but not phone," suspect the **service worker cache**
  (bump the version) or a **stale image `?v=`** first.
