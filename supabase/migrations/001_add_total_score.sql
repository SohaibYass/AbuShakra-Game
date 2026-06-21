-- ============================================================================
-- Migration 001 — add the competitive total_score (carabiners + enemy kills).
-- Run this ONCE in the Supabase SQL editor on a database created with the
-- original schema.sql. Safe to re-run (idempotent).
-- After running it, redeploy the `submit-checkpoint` and `finalize-run`
-- Edge Functions so they populate the new columns.
-- ============================================================================

alter table public.runs
  add column if not exists total_score integer not null default 0
  check (total_score >= 0);

alter table public.run_levels
  add column if not exists kill_points integer not null default 0
  check (kill_points >= 0);

-- get_leaderboard() gains a total_score column. The RETURN signature changes, so
-- it must be dropped and recreated (matches schema.sql).
drop function if exists public.get_leaderboard(int);
create function public.get_leaderboard(p_limit int default 100)
returns table (
  rank             bigint,
  player_id        uuid,
  display_name     text,
  total_carabiners integer,
  total_gear       integer,
  total_score      integer,
  levels_completed integer,
  completion_time_ms bigint,
  status           text
)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (r.player_id)
      r.player_id, r.total_carabiners, r.total_gear, r.total_score, r.levels_completed,
      r.completion_time_ms, r.status, r.finished_at
    from public.runs r
    where r.valid = true and r.status in ('completed','game_over','abandoned')
    order by r.player_id,
      r.total_carabiners desc, r.total_gear desc, r.levels_completed desc,
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
    b.player_id, p.display_name,
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
