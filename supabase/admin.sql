-- ============================================================================
-- AbuShakra Adventure — admin queries. Run in the Supabase SQL editor / psql
-- (privileged role). DO NOT expose these or the service-role key in a browser.
-- ============================================================================

-- 1) Top players (the public ranking). Same logic as get_leaderboard().
select * from public.get_leaderboard(100);

-- 2) Suspicious runs flagged for review (do not auto-trust; inspect manually).
select r.id as run_id, p.display_name, r.status, r.total_carabiners, r.total_gear,
       r.levels_completed, r.completion_time_ms, r.suspicious_reason, r.valid,
       r.started_at, r.finished_at, r.game_version
from public.runs r
join public.players p on p.id = r.player_id
where r.suspicious_reason is not null or r.valid = false
order by r.created_at desc;

-- 3) A single player's per-level results (replace the display name).
select rl.level_number, rl.carabiners_collected,
       rl.shoes_collected, rl.rope_collected, rl.helmet_collected,
       rl.completed, rl.completion_time_ms, rl.submitted_at, r.id as run_id, r.status
from public.run_levels rl
join public.runs r    on r.id = rl.run_id
join public.players p on p.id = r.player_id
where p.display_name = 'REPLACE_WITH_DISPLAY_NAME'
order by r.started_at desc, rl.level_number;

-- 4) Disqualify a run (keeps the data, removes it from the leaderboard).
update public.runs
set valid = false, suspicious_reason = coalesce(suspicious_reason, 'admin_disqualified')
where id = 'REPLACE_WITH_RUN_UUID';

-- Re-validate (undo a disqualification):
-- update public.runs set valid = true where id = 'REPLACE_WITH_RUN_UUID';

-- 5) Export final competition results as CSV.
--    In psql:   \copy (<query below>) to 'winners.csv' with csv header
--    In Studio: run it and use the "Download CSV" button.
select rank, display_name, total_carabiners, total_gear,
       levels_completed, completion_time_ms, status
from public.get_leaderboard(1000)
order by rank;

-- 6) Quick integrity spot-check: a run's stored totals vs. its checkpoints.
select r.id,
       r.total_carabiners as stored_carabiners,
       coalesce(sum(rl.carabiners_collected), 0) as checkpoint_carabiners,
       r.total_gear as stored_gear,
       coalesce(sum( (rl.shoes_collected)::int + (rl.rope_collected)::int + (rl.helmet_collected)::int ), 0) as checkpoint_gear
from public.runs r
left join public.run_levels rl on rl.run_id = r.id
where r.status in ('completed','game_over')
group by r.id
having r.total_carabiners <> coalesce(sum(rl.carabiners_collected), 0);   -- rows here = mismatch to review
