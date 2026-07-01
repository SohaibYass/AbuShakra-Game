# Reducing the AbuShakra-Game repo size

Notes and options for shrinking the project. Written after diagnosing where the weight is.
Measurements below are from the `Level1_Development` branch.

---

## Where the size actually is

The **`AbuShakra Adv/` parent folder is ~1.2 GB**, but that is **not** a git repo — it's a
plain folder holding the repo plus a lot of source/scratch material next to it.

| Location | Size | In git? |
|---|---|---|
| **`AbuShakra-Game/` (the git repo, = what GitHub has)** | **~428 MB** | yes |
| ↳ `.git` history | ~203 MB | old + deleted binary versions accumulate here |
| ↳ working tree (incl. ~249 **untracked** source files) | ~226 MB | untracked = local only, never pushed |
| `Ideass/` | ~304 MB | ❌ no |
| `Level1_Zugspitze/`, `HowTo/`, `Level2/3_...` source folders | ~370 MB | ❌ no |

**Tracked media in the repo: ~117 MB across ~119 PNG/MP3/MP4 files.** That 117 MB is what a
first-time visitor downloads (see "Runtime / launch impact").

Key point: most of the 1.2 GB is **source folders sitting next to the repo**, not the repo
itself. Freeing local disk and shrinking the *published* repo are two different jobs.

---

## Options (smallest effort → biggest reduction)

### 1. Free local disk (0 risk, not a git change)
Move `Ideass/`, `Level1_Zugspitze/`, `HowTo/`, the `Level2/3/6_...` source folders, and the
~249 untracked files out to an archive drive. Frees **~700+ MB** locally and touches
git/GitHub not at all. Do this if the concern is just disk space on the machine.

### 2. Delete unused tracked images (done — small)
Cross-referenced every tracked media file against all code (index.html, sw.js, HTML, JS,
manifest). Only **5 files (~4.6 MB)** were unreferenced and were removed (commit on
`Level1_Development`):
`plane_with_abu_flag_2frames.png`, `abu_powered_walk.png`,
`Level1_Austria_1km_Arrow_Sign.png`, `enemy_baby_eagle_3frame.png`,
`Zugspitze_Foreground_Deep_Water_2frames.png`.
The codebase is otherwise clean — almost everything tracked is actually referenced, so this
lever is small.

### 3. Compress the committed assets (safe, reversible) — **recommended next**
The tracked PNGs/MP3s are unoptimized:
- 7 info cards @ ~3 MB (1024×1536) → pngquant ≈ 0.5–0.8 MB each (~15 MB saved)
- Zugspitze foregrounds + level backdrops → roughly halved
- 5 music tracks @ 3–4 MB → re-encode to a lower bitrate ≈ 1–1.5 MB each (~15 MB saved)

Expected: working-tree media **~117 MB → ~40–60 MB**. Also makes the game **load faster**.
Fully reversible: do it as **one dedicated commit**; if unhappy, `git revert` it and the
originals return bit-for-bit (they stay in history). Verify visually before committing.
Tools: `pngquant`/`oxipng`/`optipng` for PNGs, `ffmpeg` for MP3 (e.g. ~96–112 kbps).

### 4. Trim the service-worker pre-cache (safe) — pairs with #3
`sw.js` currently pre-caches the **entire** asset list on install (all 5 levels' art + all
music), so a first visit background-downloads everything. Since music already loads per-level
at runtime, stop pre-caching the level 2–5 backdrops + the non-current music and let them load
on demand. Cuts the first-visit download a lot. No gameplay change.

### 5. One-time git-history purge (biggest `.git` win, DESTRUCTIVE)
`.git` is ~203 MB, inflated by old/superseded PNG versions and deleted files still living in
history (level-2–5 assets, an old `Zugspitze_victory.mp4`, `Matterhorn_Front1`, repacked
sprites, every `?v` re-key, etc.). `git filter-repo` (or BFG) can strip these from **all**
history → likely `.git` **~203 MB → ~60–90 MB**.
**Cost:** rewrites history → **force-push** → the branch must be re-cloned and any open PRs
break. Do this deliberately as a one-off, ideally right before cutting a clean release branch,
and **after** #3 (so the new compressed blobs are the ones that survive).

---

## Runtime / launch impact (why size matters for 1000 players)

The game is **static and 100% client-side** — each visitor runs their own copy, so it will
**not "freeze" from many concurrent users** (no shared game server). The real risks at scale:

1. **Heavy first load (~117 MB).** `loadImages()` preloads every registered image and the SW
   pre-caches the whole asset list. On a phone/slow link this is a long wait that *feels* like
   a hang. Repeat visits are cached. → fixed by #3 + #4.
2. **GitHub Pages bandwidth.** 1000 first-time users × ~117 MB ≈ **117 GB** vs GitHub Pages'
   **~100 GB/month soft limit** → possible throttling/suspension (site goes *down*, not
   frozen). → fixed by #3, or by hosting on **Cloudflare Pages / Netlify** (effectively
   unmetered bandwidth, both free).
3. **Supabase leaderboard** (the one shared backend). The leaderboard/run-tracker code is
   wrapped in try/catch and **swallows failures**, so if it rate-limits the **game keeps
   playing** — only the leaderboard degrades. Low risk.

---

## Recommendation / order of operations

1. **#3 compress assets** (safe, reversible; fixes load time + bandwidth). ← do first
2. **#4 trim SW pre-cache** (pairs with #3 for the first-load win).
3. **#1 archive local source folders** whenever (pure disk cleanup).
4. **#5 history purge** only as a deliberate one-off *after* #3, when ready to force-push.
5. Consider **Cloudflare Pages / Netlify** hosting if expecting real traffic.

Everything except #5 is non-destructive and reversible. #5 is the only step that rewrites
history / requires a force-push.
