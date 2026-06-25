# AbuShakra Adventure — Level 1 (Zugspitze) Development Log

A focused record of the Level 1 rebuild on the **`Level1_Development`** branch.
Branched off `main` (`26cdf86`) and built incrementally — the guiding rule the
whole way was **"not more, not less"**: one small, verified change at a time,
each followed by a review and (on request) a commit + push to the branch.

The game is a single self-contained `index.html` (HTML5 Canvas + vanilla JS,
no libraries, no build step), deployed as an installable PWA to GitHub Pages.

> The general/all-game history lives in `DEVELOPMENT_LOG.md`. This file is the
> Level-1-specific deep dive.

---

## Working method (this branch)

1. Edit `index.html` / `sw.js` directly in `AbuShakra-Game/`.
2. **Verify in a live browser preview** before claiming anything works — read
   the surface arrays / spawn state via `preview_eval`, capture canvas crops to
   confirm visuals, simulate input to test mechanics frame-by-frame.
3. **Bump the SW cache version** (`abushakra-vN`) whenever an asset changes, and
   keep the precache list in sync (a single missing file 404s the whole install).
4. **Branch pushes are OK without per-push approval** (the branch does not
   auto-deploy); pushing to `main` still needs review first.
5. Source art comes magenta-keyed (`r>150,g<110,b>150`) from the
   `Level1_Zugspitze/` asset folder; key it (magenta + purple fringe → alpha 0)
   before use. Never round-trip source through PowerShell (double-encodes UTF-8).

---

## The panorama foundation

### Six-part Zugspitze foreground panorama
- Level 1's terrain is a sequence of hand-painted foreground "sequences"
  (`fgList`), each drawn **undistorted** at `fgTileW: 1350` (decoupled from the
  collision tile width) with a render-only `fgYOffset: 32` that nudges the art
  down to clip the messy bottom fringe off-screen.
- Paintings: `Zugspitze_Foreground_1..4.png` (seq 1–4), keyed to transparent.
  The far mountains are a separate slow parallax layer (`Zugspitze_Back`).
- **Repeating world:** `fgSurfaceY` indexes `fgList[i % n]`, so the sequences
  loop infinitely. The level ends not at a fixed x but when the **gear gate** is
  met (collect shoes + rope + helmet + 20 carabiners → summit climb).

### Collision from hand-drawn green lines
- Each sequence has a matching `..._collisionlines_partN.png` with a green line
  (`RGB ≈ 83,215,105`) traced over the terrain top.
- A Python pass traces the **topmost green pixel per column** → a 271-sample
  height map per sequence (`ZUG_PANO_SURF1..4`), values = `src_y × 1350/srcW`
  (source→tile scale), with `fgYOffset` added at runtime.
- `fgSurf` maps each `fgList` key to its height map; `fgSurfaceY()` samples it;
  `surfaceY()` / `enemyFloorY()` route through it first (then bridges, platforms).
- **Lesson:** the painted art is drawn from the *clean* `Foreground_N` images;
  the green line is only for extraction (early attempts that painted over the
  line left smudges — keep them separate).

---

## Traversal mechanics

### Bridges (`bridges` config + `BRIDGE_META`)
- Wood bridge across the seq1→seq2 mesa tops, two small spire-to-spire bridges,
  a wood bridge seq2→seq3, and a **rope bridge** (`Zugspitze_Rope_Bridge`) over
  the seq3→seq4 gap. `surfaceY` returns the bridge `top` flat across its span.
- Bridges are placed **"top to top"** — ends snapped to the spire peaks.

### Floating stepping rocks (`stepRocks` + `STEP_ROCK_META`)
- `Waterfall_Stepping_Rock_1/3/4/5` drawn at `STEP_ROCK_SCALE 0.20`; per-sprite
  top-surface metadata; collision boxes injected into `platforms[]`.

### Collapsing rock ledges (`collapseLedges` → `collapsers[]`)
- `Zugspitze_Collapsing_Rock_Ledge_3frames`. State machine: stable → cracking
  (0.6s) → collapse (0.32s, collision removed) → gone → respawn (3.5s), triggered
  when Abu rides the box longer than its `linger` (default 5s; one ledge at 2s).
- **Bug fixed:** the ledges never appeared in real play — `initCollapsers()` was
  only called from the test-button path, not `resetGame()` (the cover→play
  path). Added the call to `resetGame()`.

### Camera lift + look-down, deep-squat pose
- `camLift` re-enables vertical camera pan when Abu's feet rise above
  `UPPER_CAM_ENGAGE`; holding **Down** on a lifted platform pans the camera down
  to look ahead. Holding Down while standing still plays a 2-frame deep-squat
  pose (`Abu_Stand_To_Deep_Squat_2frames`).

### Horizontal traverse rope (seq3 gap)
- `Zugspitze_Horizontal_Anchor_Rope` strung between two rock anchors; Abu hangs
  **below** and shimmies hand-over-hand with the 4-frame `abu_climbshill` sprite.
- `climbRopes` config `{x0, x1, y, carabiners, guard}`; `updateTraverse()`
  handles grab (step onto / reach Up), Left/Right shimmy, Down/Jump release, and
  dismount onto the ledge at each anchor. Raised to `y: 120` (a high reward line)
  with **5 carabiners** strung along it and an **eagle guard** that dives at Abu
  while he's on the rope.

---

## Enemies

### Green patrol snakes (`patrolSnakes` + `spawnPatrolSnakes`)
- Distinct 3-frame side-on snake (`enemy_snake_distinct_3frames`, keyed) placed
  on flat surfaces and bridges; paces back and forth, turning at the edges.
- **Hug the ground:** `followSurf` samples `surfaceY` under the belly each frame
  (terrain isn't flat), with a small `footPad` so the belly rests on the line.
- **No "hopping":** the patrol span auto-clamps to the **contiguous run** around
  its centre — walking out until a sharp step (a *cliff*, >18px per 4px) so the
  snake walks gentle slopes smoothly but never paces off an edge where
  `surfaceY` jumps. Per-snake `w` (one narrow ledge needed a small 35-px snake).

### Eagle guard (`spawnGuardEagle`, `spawnClimbRopeGuards`)
- 3-frame baby eagle (`enemy_baby_eagle_3frame`) hovers around an anchor and
  swoops at Abu (cruise → dive → recover). Used to guard the seq2 rope gear and
  the seq3 traverse rope. Roaming snakes/eagles were ultimately **disabled** —
  Level 1 keeps only the placed **guards** (rope eagle + shoes red-snake) plus
  the green patrol snakes.

### Enemy audio + music ducking
- Synthesised, no audio files: a sibilant two-layer **snake hiss** (band-passed
  noise) and a raptor **eagle screech** (up-chirp → descending sawtooth → raspy
  noise), on a dedicated **louder voice bus** so they cut over the music.
- Within `ENEMY_SND_DIST` (230px) an enemy voices on a per-enemy cooldown,
  volume fading with distance. Within `ENEMY_DUCK_DIST` (300px) the **level
  music ducks fully to zero** (fast attack, slower release) and the voice swells.

---

## Gear, pickups & stamina

- **Gear gate:** shoes / rope / helmet on fixed ledges (`gearSpots`), each
  guarded; collect all + 20 carabiners → summit climb.
- **Knives** start at **0** on Level 1 (`startKnives: 0` override); collected
  from `knifeSpots` ledges. **Stamina shelter** (`shelterSpots`) on the seq3
  arch refills power.
- **Energy bottles** (`Abu_Energy_Bottle_384`, keyed): a **HUD inventory item**
  (counter next to the knife count), not auto-consumed. Press **E** (`DRINK_KEYS`)
  to drink one → +50 stamina + a drink→surge→flex transformation
  (`Abu_Energy_Powerup_3frames`). The count carries across levels within a run.
  - A muscular walk (`character_walk_muscles`) was prototyped for the buffed
    state and then **removed** at the user's request — the buff is the
    transformation + stamina only; Abu keeps the original walk.
  - **Iteration note:** the transformation originally *froze* Abu in a held flex
    pose (and the muscle "idle" used a mid-step walk frame, which read as stuck).
    Fixed by playing the 3 frames through and using the normal idle when standing.

---

## Scenery & ambience (seq-by-seq dressing)

- **Planted flags-on-a-stick** (`Abu_Rectangular_Flag_With_Stick_512`, keyed):
  `flags` config, foot planted on the surface; 5 across the spire/mesa tops.
- **"Austria 1 km" signpost** (`Level1_Austria_1km_Arrow_Sign`, keyed) at the
  level start (`signs` config, post foot on the ground).
- **Roaming banner plane** (`plane_with_abu_flag_2frames`) — keyed by **border
  flood-fill** (it shipped with a baked-in transparency checkerboard, not
  magenta). Sine-roams over the seq1 valley, banner waving, art flips to face
  its heading, drawn behind the foreground terrain so spires occlude it.
- **Animated seq4 waterfalls** (`waterfalls` config): three cascades overlaid on
  the painted falls — downward-scrolling foam bands + strand glints + a pulsing
  splash pool. A continuous band-limited-noise **water rush** swells with
  proximity (brighter up close) and **ducks the music** like enemies do
  (the music duck is `max(enemyDuck, waterDuck)`).

---

## Seq 5 — continuous-vs-gapped collision

- Added a 5th sequence: painting `Zugspitze_Foreground_51.png` (keyed),
  collision `..._collisionlines_part5.png` → `ZUG_PANO_SURF5`.
- **New rule:** where the green line is **continuous, Abu walks**; where it
  **breaks, he must jump**. The extractor marks gap columns with a sentinel
  `9999`; `sampleSurf` returns the `SURF_GAP` sentinel (no ground) instead of
  interpolating across a gap.
- **Void death + respawn:** falling past `VOID_DEATH_Y` (600) costs a life and
  respawns Abu on the **last safe footing** — tracked continuously while grounded
  and only recorded where ground also continues ~36px ahead *and* behind, so the
  respawn point is never right at a gap edge (an earlier version respawned at the
  edge and looped, losing 2 lives at once).
- **Open item:** the layout has a **~250px chasm** (world ≈ 5815–6065) that is
  too wide to jump — a blue marker is painted in it, implying a planned crossing
  (bridge / stepping rocks / rope). Small gaps (7–35px) are jumpable.
- Aside: a collision-line image (`part6`) used a **blue X = climb-down /
  black X = climb-up** legend for rope + mantle markers; that variant was
  reverted in favour of the gap-based part5 collision above.

---

## Service-worker / mobile-cache fix (revisited)

- Phone kept showing an **old commit** while desktop was fine. Root cause: the
  last commits changed only `index.html`, so the installed worker never saw a new
  `sw.js` and kept serving its cached shell; mobile Safari's HTTP cache also held
  a stale `index.html`.
- **Fix:** fetch the document with `cache: "no-store"` (network-first can't be
  handed a stale HTML), and bump the cache version so the worker reinstalls,
  `clients.claim()`s, and reloads with the fresh shell.

---

## Asset-keying playbook (used throughout this branch)

- **Magenta source:** core `r>150 & g<110 & b>150` + purple fringe
  `r>110 & b>110 & g<r−25 & g<b−25` → alpha 0.
- **Black-background source** (e.g. the muscles walk): **flood-fill from the
  borders** so an enclosed white icon isn't punched out.
- **Baked-in transparency checker** (the plane): same border flood-fill keyed on
  light-grey, sparing the interior.
- **Sprite sizing:** scale by the *content* bbox (not the padded cell) and anchor
  feet at the draw origin, or sprites land squished / floating.

---

## State at end of this log

- Branch: `Level1_Development`. Latest committed SW cache: **`abushakra-v142`**
  (the seq 5 work raises it to **v143**, uncommitted at time of writing).
- Level 1 is the most feature-dense level: looping 5-sequence panorama with
  green-line collision (incl. jump gaps in seq 5), bridges / stepping rocks /
  collapsing ledges / traverse rope, gear gate + summit climb, patrol snakes +
  guard eagles with proximity audio + music ducking, energy-drink consumable,
  animated waterfalls, and a layer of planted scenery (flags, signpost, banner
  plane).
