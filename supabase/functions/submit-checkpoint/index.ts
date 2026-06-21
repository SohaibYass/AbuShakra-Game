// submit-checkpoint — idempotently record one level's result for an active run.
// POST { runId, levelNumber, carabiners, shoes, rope, helmet, completed, completionTimeMs }
//   -> { ok: true }
// Validates ownership, run is active, value sanity, and per-level maxima. The
// upsert on (run_id, level_number) makes refresh/replay safe (no duplicates).
import { corsHeaders, json, requirePlayer } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405, origin);

  try {
    const { player, admin } = await requirePlayer(req, origin);
    const b = await req.json().catch(() => ({}));

    const runId = String(b.runId ?? "");
    const level = Number(b.levelNumber);
    const carabiners = Number(b.carabiners ?? 0);
    const shoes = !!b.shoes, rope = !!b.rope, helmet = !!b.helmet;
    const completed = !!b.completed;
    const timeMs = b.completionTimeMs == null ? null : Number(b.completionTimeMs);

    if (!runId || !Number.isInteger(level) || level < 1 || level > 50)
      return json({ error: "BAD_INPUT" }, 400, origin);
    if (!Number.isFinite(carabiners) || carabiners < 0)
      return json({ error: "NEGATIVE" }, 400, origin);
    if (timeMs != null && (!Number.isFinite(timeMs) || timeMs < 0))
      return json({ error: "BAD_TIME" }, 400, origin);

    // Run must exist, belong to caller, and be active.
    const { data: run } = await admin.from("runs")
      .select("id, player_id, status").eq("id", runId).maybeSingle();
    if (!run || run.player_id !== player.id) return json({ error: "NOT_OWNER" }, 403, origin);
    if (run.status !== "active") return json({ error: "RUN_NOT_ACTIVE" }, 409, origin);

    // Per-level maxima (configurable in level_config).
    const { data: cfg } = await admin.from("level_config")
      .select("max_carabiners, min_completion_time_ms").eq("level_number", level).maybeSingle();
    const maxCarabiners = cfg?.max_carabiners ?? 200;
    const minTime = cfg?.min_completion_time_ms ?? 0;

    let suspicious: string | null = null;
    if (carabiners > maxCarabiners) return json({ error: "TOO_MANY_CARABINERS" }, 422, origin);
    if (timeMs != null && completed && timeMs < minTime) suspicious = "fast_level";

    const { error } = await admin.from("run_levels").upsert({
      run_id: runId,
      level_number: level,
      carabiners_collected: carabiners,
      shoes_collected: shoes,
      rope_collected: rope,
      helmet_collected: helmet,
      completed,
      completion_time_ms: timeMs,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "run_id,level_number" });
    if (error) return json({ error: "DB_ERROR", detail: error.message }, 500, origin);

    if (suspicious) {
      await admin.from("runs").update({ suspicious_reason: suspicious }).eq("id", runId);
    }
    return json({ ok: true, suspicious }, 200, origin);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: "UNEXPECTED" }, 500, origin);
  }
});
