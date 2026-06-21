-- ============================================================================
-- AbuShakra Adventure — Player Tracking & Leaderboard schema
-- ============================================================================
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- It is written to be re-runnable (idempotent) where reasonable.
--
-- Architecture (see supabase/README.md):
--   * Anonymous auth gives every player an auth.users row (auth.uid()).
--   * The browser (anon key) inserts/reads ONLY its own private `players` row,
--     validated by DB triggers + CHECK constraints.
--   * Authoritative writes (create run, submit level checkpoint, finalize run)
--     go through Edge Functions using the SERVICE ROLE key (server-side only).
--   * The public leaderboard is read via the SECURITY DEFINER function
--     `get_leaderboard()` which exposes display name + game stats ONLY.
--   * Birth month/year are private and never appear in any public query.
-- ============================================================================

create extension if not exists pgcrypto;          -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Configurable validation limits (per level). Adjust when level design changes.
-- ----------------------------------------------------------------------------
create table if not exists public.level_config (
  level_number          integer primary key,
  max_carabiners        integer not null check (max_carabiners >= 0),
  min_completion_time_ms bigint  not null default 3000 check (min_completion_time_ms >= 0),
  required_carabiners   integer not null default 0,   -- gate requirement (informational)
  required_gear         integer not null default 0
);

-- Seed sensible defaults. Level 1 gate = 20 carabiners + 3 gear; allow some
-- headroom over the gate for the max, since extra clips can spawn across loops.
insert into public.level_config (level_number, max_carabiners, min_completion_time_ms, required_carabiners, required_gear) values
  (1, 60, 5000, 20, 3),
  (2, 80, 5000, 0, 0),
  (3, 80, 5000, 0, 0),
  (4, 80, 5000, 0, 0),
  (5, 80, 5000, 0, 0)
on conflict (level_number) do nothing;

-- ----------------------------------------------------------------------------
-- Blocked words for display-name moderation (configurable; case-insensitive).
-- ----------------------------------------------------------------------------
create table if not exists public.blocked_words (
  word text primary key
);
insert into public.blocked_words (word) values
  ('admin'), ('moderator'), ('fuck'), ('shit'), ('bitch'), ('nazi'), ('hitler'),
  ('nigger'), ('faggot'), ('rape'), ('slut'), ('whore'), ('cunt')
on conflict (word) do nothing;

-- ----------------------------------------------------------------------------
-- players — one private profile per anonymous auth user.
-- ----------------------------------------------------------------------------
create table if not exists public.players (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique not null references auth.users(id) on delete cascade,
  display_name   text not null,
  birth_month    smallint not null check (birth_month between 1 and 12),
  birth_year     smallint not null check (birth_year between 1900 and 2100),
  age_group      text not null check (age_group in ('under_13','13_17','18_plus')),
  privacy_version text not null,
  created_at     timestamptz not null default now(),
  -- name rules: 3–20 chars, letters/numbers/space/_/- (validated after trim by trigger too)
  constraint players_display_name_len check (char_length(btrim(display_name)) between 3 and 20),
  constraint players_display_name_chars check (btrim(display_name) ~ '^[A-Za-z0-9 _-]+$')
);
create index if not exists players_display_name_lower_idx on public.players (lower(display_name));

-- Derive the age group from birth month/year as of "now" (server-authoritative).
create or replace function public.compute_age_group(p_month int, p_year int)
returns text language plpgsql immutable as $$
declare
  yrs int;
  now_y int := extract(year  from now())::int;
  now_m int := extract(month from now())::int;
begin
  yrs := now_y - p_year - (case when now_m < p_month then 1 else 0 end);
  if yrs < 13 then return 'under_13';
  elsif yrs < 18 then return '13_17';
  else return '18_plus'; end if;
end $$;

-- Validate + normalise a player row on insert/update: trim name, enforce the
-- blocked-word list, recompute age_group from birth fields, reject under_13.
create or replace function public.players_validate()
returns trigger language plpgsql as $$
declare
  w text;
  computed text;
begin
  new.display_name := btrim(new.display_name);
  if char_length(new.display_name) < 3 or char_length(new.display_name) > 20 then
    raise exception 'INVALID_NAME_LENGTH';
  end if;
  if new.display_name !~ '^[A-Za-z0-9 _-]+$' then
    raise exception 'INVALID_NAME_CHARS';
  end if;
  for w in select word from public.blocked_words loop
    if position(w in lower(new.display_name)) > 0 then
      raise exception 'BLOCKED_NAME';
    end if;
  end loop;
  if new.birth_month not between 1 and 12 then raise exception 'INVALID_BIRTH_MONTH'; end if;
  if new.birth_year  not between 1900 and (extract(year from now())::int) then raise exception 'INVALID_BIRTH_YEAR'; end if;

  computed := public.compute_age_group(new.birth_month, new.birth_year);
  new.age_group := computed;                    -- always trust the server's computation
  if computed = 'under_13' then
    raise exception 'UNDER_13';                 -- neutral message handled client-side
  end if;
  return new;
end $$;

drop trigger if exists players_validate_trg on public.players;
create trigger players_validate_trg before insert or update on public.players
  for each row execute function public.players_validate();

-- ----------------------------------------------------------------------------
-- runs — one gameplay run. Authoritative totals are written by Edge Functions.
-- ----------------------------------------------------------------------------
create table if not exists public.runs (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references public.players(id) on delete cascade,
  status           text not null default 'active'
                     check (status in ('active','game_over','completed','abandoned')),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  levels_completed integer not null default 0 check (levels_completed >= 0),
  total_carabiners integer not null default 0 check (total_carabiners >= 0),
  total_gear       integer not null default 0 check (total_gear >= 0),
  total_score      integer not null default 0 check (total_score >= 0),   -- carabiners + enemy-kill points (competitive comparison)
  completion_time_ms bigint check (completion_time_ms is null or completion_time_ms >= 0),
  game_version     text not null,
  valid            boolean not null default true,
  suspicious_reason text,
  created_at       timestamptz not null default now()
);
create index if not exists runs_player_idx on public.runs (player_id);
-- At most one active run per player (others must be abandoned/finalised first).
create unique index if not exists runs_one_active_per_player
  on public.runs (player_id) where status = 'active';

-- ----------------------------------------------------------------------------
-- run_levels — one idempotent checkpoint per (run, level).
-- ----------------------------------------------------------------------------
create table if not exists public.run_levels (
  id                  bigint generated always as identity primary key,
  run_id              uuid not null references public.runs(id) on delete cascade,
  level_number        integer not null check (level_number between 1 and 50),
  carabiners_collected integer not null default 0 check (carabiners_collected >= 0),
  kill_points         integer not null default 0 check (kill_points >= 0),   -- points from stomped/knifed enemies this level
  shoes_collected     boolean not null default false,
  rope_collected      boolean not null default false,
  helmet_collected    boolean not null default false,
  completed           boolean not null default false,
  completion_time_ms  bigint check (completion_time_ms is null or completion_time_ms >= 0),
  submitted_at        timestamptz not null default now(),
  unique (run_id, level_number)
);
create index if not exists run_levels_run_idx on public.run_levels (run_id);

-- ----------------------------------------------------------------------------
-- run_events — optional, batched gameplay telemetry (non-authoritative).
-- ----------------------------------------------------------------------------
create table if not exists public.run_events (
  id               bigint generated always as identity primary key,
  run_id           uuid not null references public.runs(id) on delete cascade,
  sequence_number  integer not null,
  event_type       text not null check (event_type in
                     ('carabiner_collected','gear_collected','level_completed','player_died','game_completed')),
  level_number     integer,
  item_id          text,
  client_elapsed_ms bigint,
  created_at       timestamptz not null default now(),
  unique (run_id, sequence_number)
);
create index if not exists run_events_run_idx on public.run_events (run_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.players      enable row level security;
alter table public.runs         enable row level security;
alter table public.run_levels   enable row level security;
alter table public.run_events   enable row level security;
alter table public.level_config enable row level security;
alter table public.blocked_words enable row level security;

-- players: a user sees/creates ONLY their own private record. No public read.
drop policy if exists players_select_own on public.players;
create policy players_select_own on public.players for select
  using (auth_user_id = auth.uid());
drop policy if exists players_insert_own on public.players;
create policy players_insert_own on public.players for insert
  with check (auth_user_id = auth.uid());
drop policy if exists players_update_own on public.players;
create policy players_update_own on public.players for update
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- runs / run_levels / run_events: the player may READ only their own rows.
-- All writes happen through Edge Functions (service role) which bypass RLS,
-- so there are deliberately NO client insert/update policies here. This is how
-- "players must not directly update authoritative final totals" is enforced.
drop policy if exists runs_select_own on public.runs;
create policy runs_select_own on public.runs for select
  using (player_id in (select id from public.players where auth_user_id = auth.uid()));

drop policy if exists run_levels_select_own on public.run_levels;
create policy run_levels_select_own on public.run_levels for select
  using (run_id in (select r.id from public.runs r
                    join public.players p on p.id = r.player_id
                    where p.auth_user_id = auth.uid()));

drop policy if exists run_events_select_own on public.run_events;
create policy run_events_select_own on public.run_events for select
  using (run_id in (select r.id from public.runs r
                    join public.players p on p.id = r.player_id
                    where p.auth_user_id = auth.uid()));

-- level_config: readable by anyone (the client uses it for client-side hints);
-- contains no private data. No write policy (admin/service role only).
drop policy if exists level_config_read on public.level_config;
create policy level_config_read on public.level_config for select using (true);
-- blocked_words: no client access at all (only DB triggers + service role read).

-- ============================================================================
-- Public leaderboard — SECURITY DEFINER so anon can read PUBLIC columns ONLY.
-- Birth fields, auth ids and run ids are never selected/returned.
-- Ranking: carabiners desc, gear desc, levels desc, completed-before-incomplete,
--          time asc, finished_at asc.
-- ============================================================================
drop function if exists public.get_leaderboard(int);
create function public.get_leaderboard(p_limit int default 100)
returns table (
  rank             bigint,
  player_id        uuid,          -- the PLAYER's public row id (safe to highlight self); NOT the auth id
  display_name     text,
  total_carabiners integer,
  total_gear       integer,
  total_score      integer,       -- carabiners + enemy-kill points
  levels_completed integer,
  completion_time_ms bigint,
  status           text
)
language sql stable security definer set search_path = public as $$
  with best as (
    -- one best run per player (their highest-ranked finished/abandoned run)
    select distinct on (r.player_id)
      r.player_id, r.total_carabiners, r.total_gear, r.total_score, r.levels_completed,
      r.completion_time_ms, r.status, r.finished_at
    from public.runs r
    where r.valid = true and r.status in ('completed','game_over','abandoned')
    order by r.player_id,
      r.total_carabiners desc,
      r.total_gear desc,
      r.levels_completed desc,
      (r.status = 'completed') desc,
      coalesce(r.completion_time_ms, 9223372036854775807) asc,
      r.finished_at asc nulls last
  )
  select
    row_number() over (
      order by b.total_carabiners desc, b.total_gear desc, b.levels_completed desc,
               (b.status = 'completed') desc,
               coalesce(b.completion_time_ms, 9223372036854775807) asc,
               b.finished_at asc nulls last
    ) as rank,
    b.player_id,
    p.display_name,
    b.total_carabiners, b.total_gear, b.total_score, b.levels_completed,
    case when b.status = 'completed' then b.completion_time_ms else null end as completion_time_ms,
    b.status
  from best b
  join public.players p on p.id = b.player_id
  order by rank
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.get_leaderboard(int) from public;
grant execute on function public.get_leaderboard(int) to anon, authenticated;

-- ============================================================================
-- Done. Edge Functions (service role) live in supabase/functions/* and perform
-- the validated authoritative writes. See supabase/README.md.
-- ============================================================================
