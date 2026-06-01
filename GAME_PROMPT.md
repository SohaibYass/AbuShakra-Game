# Master Prompt — 2D Platformer (HTML5 Canvas, single file)

A reusable brief for building a polished, installable 2D platformer at the same
quality level as AbuShakra Adventure. Paste the section below as a starting
prompt, then iterate in layers.

---

## The prompt

**Goal:** Build a complete, polished 2D side-scrolling platformer as a *single
self-contained `index.html`* — HTML5 Canvas + vanilla JavaScript, **no libraries,
no build step**. Must run by just opening the file or serving the folder.

**Assets:**
- Put all sprite/image links in one `ASSETS = {}` object at the top of the script
  so they're easy to swap.
- Use the PNGs in this folder if present; if one is missing, generate a placeholder.
  *(Typical files: `character.png`, `enemy.png`, `background.png`, `platform.png`,
  plus a title image.)*
- If any sprite has a white background, remove it (transparent) and auto-crop to
  the content.
- Note which way the character art faces by default, and flip it (`ctx.scale(-1,1)`)
  so the sprite always faces its movement direction.

**Core mechanics:**
- Walk-and-jump control (NOT an auto-scroller): A/D or arrows to move, Space/Up/W
  to jump.
- Follow-camera in world coordinates; looping/parallax background.
- Procedurally generated platforms (varied gaps, widths, heights) over continuous
  ground so the player can't fall into an unwinnable spot.
- Enemies spawn over time and move left; **stomp** them for points, touching them
  otherwise costs a life.
- Collectible coins = points.
- HUD: Score + Lives (3 lives), brief invulnerability after taking a hit.
- Title splash screen ("press / tap to start") and a Game Over + restart flow.

**Engine quality requirements (important):**
- Delta-time `requestAnimationFrame` loop (frame-rate independent).
- Reliable AABB collision with **no tunneling** — check previous vs. new position
  for landings.
- Fixed internal resolution (e.g. 800x450) scaled to fit the screen,
  `imageSmoothingEnabled = false` for crisp pixels.
- Procedural walk animation via canvas transforms (bob/lean/squash) — don't just
  slide the sprite. Make sure lean/flip use the facing direction consistently.
- Clean, organized code with section headers and tunable constants grouped at the top.

**Game feel / "juice":**
- Add a lightweight particle system (array of {x,y,vx,vy,grav,life,size,color}):
  dust on hard landings, gold sparkle on coin pickup, a poof when an enemy is
  stomped. Gate landing dust on impact speed so it doesn't spam while walking.
- Add screen-shake: a magnitude that decays each frame; on a hit shake hard, on a
  stomp shake a little. Apply it as a small random `ctx.translate` around the whole
  draw, inside save/restore.
- Run particles + shake every frame regardless of game state (cosmetic), so they
  settle cleanly even on the game-over screen.

**Music & sound (Web Audio API, no files):**
- Synthesize an **original** cheerful 8-bit chiptune loop with the Web Audio API
  (oscillators + a small gain envelope per note, driven by a lookahead scheduler).
  Do **not** use copyrighted melodies (e.g. the actual Mario theme) — compose an
  original tune in that style (a I-V-vi-IV progression in C major works well).
- Music starts when play begins and stops on game over. Add a mute toggle button.
- **iOS audio rules:** audio can only begin inside a user gesture. Create + resume
  the `AudioContext` on the first tap/key (play a 1-sample silent buffer to unlock
  it), resume it again when returning from background/lock (`visibilitychange`),
  and clamp the scheduler so it never queues notes "in the past" after a suspend.
- Heads-up the user that the iPhone hardware ring/silent switch mutes Web Audio —
  that's iOS behavior, not a bug.

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
- **One-time stale-SW caveat:** the auto-reload only helps *after* a worker that
  contains it is installed. Going from an older cache-first worker to this setup
  still needs one manual clear on the device (delete + re-add the home-screen app,
  or clear the site's website data). Tell the user this so a live update that
  "didn't show up on phone" isn't mistaken for a deploy failure — verify the
  server with `curl` first, then it's almost always the device cache.

**Deployment (optional):**
- Set it up to deploy to GitHub Pages via a GitHub Actions workflow
  (configure-pages / upload-pages-artifact / deploy-pages). Enable Pages with
  Source = "GitHub Actions" in repo settings.

**Process I want you to follow:**
- Edit, then **verify in a browser preview** (load the page, check the console for
  errors, test the actual feature — buttons, collisions, facing, audio) before
  telling me it's done.
- After verifying, copy the files into my git repo subfolder and commit/push with
  a clear message.
- Tell me explicitly if something can't be tested (e.g. real on-device iOS
  behavior or the hardware silent switch).

---

## Tips for getting this level out of it

- Lead with the single-file/no-libraries constraint and the engine-quality bullets
  — those are what separate a toy from something that feels good to play.
- Give the asset folder up front and say "create placeholders if missing" so it
  never stalls.
- Add features in *layers* across messages (basic game -> fix feel -> mobile ->
  music -> installable -> deploy) rather than asking for everything perfect in one
  shot — each layer is easier to verify and correct.
- When something's wrong on a real device, describe the symptom concretely
  ("zooms after ~5s of tapping jump", "faces wrong way only on phone") — that's
  what lets the fix target the real cause instead of guessing.
- If a change "works on desktop but not phone," suspect the **service worker cache**
  first: bump the cache version and make sure HTML is served network-first.
