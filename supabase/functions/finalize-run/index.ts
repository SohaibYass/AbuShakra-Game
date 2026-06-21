// finalize-run — finish a run with authoritative, server-computed totals.
// POST { runId, status } where status in ('game_over','completed') -> { ok, totals }
// Totals are recomputed from accepted run_levels checkpoints (client totals are
// NOT trusted). Idempotent: re-finalizing returns the stored result unchanged.
import { corsHeaders, json, requirePlayer } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405, origin);

  try {
    const { player, admin } = await requirePlayer(req, origin);
    const b = await req.json().catch(() => ({}));
    const runId = String(b.runId ?? "");
    const status = String(b.status ?? "");
    if (!runId || (status !== "game_over" && status !== "completed"))
      return json({ error: "BAD_INPUT" }, 400, origin);

    const { data: run } = await admin.from("runs")
      .select("id, player_id, status, started_at, total_carabiners, total_gear, levels_completed, completion_time_ms, valid, suspicious_reason")
      .eq("id", runId).maybeSingle();
    if (!run || run.player_id !== player.id) return json({ error: "NOT_OWNER" }, 403, origin);

    // Idempotent: already finalized -> return what we have.
    if (run.status !== "active") {
      return json({ ok: true, alreadyFinalized: true, totals: {
        total_carabiners: run.total_carabiners, total_gear: run.total_gear,
        levels_completed: run.levels_completed, completion_time_ms: run.completion_time_ms,
        status: run.status,
      } }, 200, origin);
    }

    // Authoritative totals from accepted checkpoints.
    const { data: levels } = await admin.from("run_levels")
      .select("carabiners_collected, shoes_collected, rope_collected, helmet_collected, completed")
      .eq("run_id", runId);
    let carabiners = 0, gear = 0, completedLevels = 0;
    for (const l of levels ?? []) {
      carabiners += l.carabiners_collected ?? 0;
      gear += (l.shoes_collected ? 1 : 0) + (l.rope_collected ? 1 : 0) + (l.helmet_collected ? 1 : 0);
      if (l.completed) completedLevels += 1;
    }

    const finishedAt = new Date();
    const wallMs = finishedAt.getTime() - new Date(run.started_at).getTime();
    const completionTime = status === "completed" ? Math.max(0, wallMs) : null;

    let valid = run.valid, suspicious = run.suspicious_reason;
    if (status === "completed" && completionTime != null && completionTime < 20000) {
      valid = false; suspicious = suspicious ?? "impossible_total_time";   // <20s for the whole game
    }

    const { error } = await admin.from("runs").update({
      status, finished_at: finishedAt.toISOString(),
      total_carabiners: carabiners, total_gear: gear, levels_completed: completedLevels,
      completion_time_ms: completionTime, valid, suspicious_reason: suspicious,
    }).eq("id", runId).eq("status", "active");   // guard against a concurrent finalize
    if (error) return json({ error: "DB_ERROR", detail: error.message }, 500, origin);

    return json({ ok: true, totals: {
      total_carabiners: carabiners, total_gear: gear, levels_completed: completedLevels,
      completion_time_ms: completionTime, status, valid,
    } }, 200, origin);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: "UNEXPECTED" }, 500, origin);
  }
});
