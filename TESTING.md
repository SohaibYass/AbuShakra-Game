# AbuShakra Adventure — Player Tracking test plan

## Automated (pure logic)

```bash
cd AbuShakra-Game
node tests/validation.test.js      # name validation, age group, leaderboard tie-breaks
```

The SQL ranking is exercised by the same tie-break rules via `js/validation.js`
`compareRuns()`, which mirrors `get_leaderboard()`.

## Manual checklist

Run the game through an HTTP server (`python -m http.server 8000`), with real
Supabase keys in `js/supabase-config.js`, on a configured project.

| # | Case | Expected |
|---|------|----------|
| 1 | New adult registration | Name + month/year + consent → modal closes, a run is created, game starts. |
| 2 | Invalid / empty display name | Inline error; cannot start. |
| 3 | Under-13 registration | Neutral "you can't register" — never reveals the cutoff date. No account created. |
| 4 | Consent unchecked | "Please accept…" error; cannot start. |
| 5 | Returning player | Reload shows **Continue as {name}** / **Use another player**; Continue starts a new run on the same profile. |
| 6 | Double-click Start | Button disables; exactly **one** run is created (check `runs`). |
| 7 | Carabiner pickup | `run.totalCarabiners` increments once per clip; matches `run_levels.carabiners_collected`. |
| 8 | Throwable ammo / thrown knife | Starting knives and thrown projectiles do **not** change the collected count. |
| 9 | Gear per level | Each of shoes/rope/helmet counts at most once per level. |
| 10 | Level checkpoint | One `run_levels` row per completed level (unique `(run_id, level_number)`). |
| 11 | Refresh mid-run | Re-submitting a checkpoint does **not** create duplicates (idempotent upsert). |
| 12 | Game over | Run finalized `game_over`; totals computed server-side. |
| 13 | Win | Run finalized `completed`; `completion_time_ms` set. |
| 14 | Tampered values | Manually POSTing negative/huge carabiners is rejected (4xx) or flagged `suspicious_reason`. |
| 15 | Leaderboard order | Ranked carabiners → gear → peaks → completed-before-incomplete → time → finished_at. |
| 16 | Birth privacy | `rpc('get_leaderboard')` and the network tab show **no** birth fields / auth ids / run ids. |
| 17 | Backend down | Stop/blackhole Supabase → registration offers **Play offline**; run is non-qualifying with a clear notice. |
| 18 | Existing gameplay | Keyboard, touch, audio, all 5 levels, mantle/climb, power, and save still work. |
| 19 | Production build via HTTP | Served over `http://localhost:8000` (not `file://`); modules + Supabase load. |
| 20 | Deployed URL | On the GitHub Pages URL: registration, a full run, and the leaderboard all work. |

## Notes
- The game must stay playable if Supabase is unavailable (offline = non-qualifying).
- Verify RLS from a **client** (anon key) session, not the SQL editor — see
  `supabase/README.md` §6.
