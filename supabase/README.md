# AbuShakra Adventure — Online backend (Supabase)

This folder contains everything needed to run the player registration, run
tracking and leaderboard backend. The game works **offline** without it (runs
just won't be ranked); follow these steps to enable the online competition.

```
supabase/
  schema.sql        # tables, constraints, RLS, get_leaderboard() — run this once
  admin.sql         # ready-made queries for winners / suspicious runs / export
  functions/        # Edge Functions (Deno) — authoritative validated writes
    _shared/cors.ts
    start-run/
    submit-checkpoint/
    finalize-run/
    leaderboard/     # optional HTTP proxy of get_leaderboard()
```

Frontend files that talk to this backend live in `../js/`:
`supabase-config.js`, `run-tracker.js`, `player-registration.js`, `leaderboard.js`.

---

## 1. Create the Supabase project

1. Sign in at <https://supabase.com> and **New project**.
2. Note your **Project URL** (e.g. `https://abcd1234.supabase.co`) and the
   **anon public** key (Project Settings → API). You'll also see the
   **service_role** key — keep it secret; it is used only by Edge Functions.
3. **Authentication → Providers → Anonymous sign-ins: enable.** (Required — the
   game signs players in anonymously.)

## 2. Run the schema

Open **SQL Editor**, paste the contents of `schema.sql`, and **Run**. It creates
`players`, `runs`, `run_levels`, `run_events`, `level_config`, `blocked_words`,
the validation triggers, RLS policies, and the `get_leaderboard()` function.
Re-running it is safe (idempotent where reasonable).

## 3. Deploy the Edge Functions

Install the CLI (<https://supabase.com/docs/guides/cli>) and from the repo root:

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Function secrets (NEVER commit these). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
# are provided automatically to deployed functions; set ALLOWED_ORIGIN yourself:
supabase secrets set ALLOWED_ORIGIN="https://sohaibyass.github.io"

supabase functions deploy start-run
supabase functions deploy submit-checkpoint
supabase functions deploy finalize-run
supabase functions deploy leaderboard   # optional
```

> The functions call `Deno.env.get("SUPABASE_URL")` and
> `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`, which Supabase injects at runtime.
> Do not hard-code the service-role key anywhere.

## 4. Add the URL + anon key to the game

Edit **`../js/supabase-config.js`** and replace the placeholders:

```js
const SUPABASE_URL = "https://abcd1234.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";   // the PUBLIC anon key ONLY
```

Bump `GAME_VERSION` whenever you deploy (it's stored with every run).
Only the anon key belongs in the browser — never the service-role key.

## 5. Allowed origins

- **Edge Functions:** set `ALLOWED_ORIGIN` (step 3) to your production origin,
  e.g. `https://sohaibyass.github.io`. Use `*` only for local testing.
- **Auth → URL Configuration:** add your GitHub Pages URL to the allowed site
  URLs so anonymous auth works from the deployed game.

## 6. Test the RLS policies

In the SQL editor (which runs as a privileged role) you can read everything, so
test RLS from the **client** perspective instead:

- Register two different players in two browsers. Confirm each can read only its
  own `players` row (`select * from players` via the JS client returns one row).
- Confirm a player cannot `insert`/`update` `runs` or `run_levels` directly with
  the anon key (RLS denies it — all writes must go through the Edge Functions).
- Confirm `select * from players` through the anon client never returns another
  player's `birth_month` / `birth_year`.
- Confirm `rpc('get_leaderboard')` returns **no** birth fields, auth ids, or run
  ids — only display name + stats.

A quick check that the public query is clean:

```sql
select * from public.get_leaderboard(100);   -- columns: rank, player_id, display_name,
                                              -- total_carabiners, total_gear, levels_completed,
                                              -- completion_time_ms, status   (no birth/auth data)
```

## 7. Inspect & export winners

See `admin.sql` for copy-paste queries: top players, suspicious runs, a player's
per-level breakdown, disqualifying a run (`valid = false`), and a CSV export of
final results. Run them in the SQL editor or via `psql`. **Never** build a
browser admin page that ships the service-role key.

## 8. Update validation maximums after level changes

Per-level limits live in the `level_config` table. If you redesign a level
(e.g. add more carabiners), update its row so legitimate runs aren't rejected:

```sql
update public.level_config set max_carabiners = 75 where level_number = 1;
```

The client mirror in `../js/supabase-config.js` (`LEVEL_MAX_CARABINERS`) is only
for hints — the table above is authoritative.

## 9. Deploy the game to GitHub Pages

This game already deploys from the `main` branch of the
`AbuShakra-Game` repo. The online feature is being built on the
**`Player_Tracking`** branch:

```bash
# from C:\Files\AbuShakra Adv\AbuShakra-Game
git checkout Player_Tracking
# ...make sure js/supabase-config.js has your real keys (those are public-anon, safe to commit)...
git checkout main
git merge Player_Tracking
git push origin main          # GitHub Pages redeploys
```

Because the service worker serves `index.html` **network-first** and the cache
version was bumped, players get the registration update on their next load
(no stale `index.html` can hide it).

---

## Local testing

Open the game through a small HTTP server (the `js/` modules and relative paths
don't work from `file://`):

```bash
cd AbuShakra-Game
python -m http.server 8000
# then open http://localhost:8000/index.html
```

Add `http://localhost:8000` to `ALLOWED_ORIGIN` and the Supabase Auth site URLs
while testing locally.

See `../TESTING.md` for the manual test checklist and `../tests/` for automated
validation/ranking unit tests.
