// start-run — create a fresh active run for the authenticated player.
// POST { gameVersion } -> { runId, startedAt }
// Abandons any existing active run first (one active run per player).
import { corsHeaders, json, requirePlayer } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405, origin);

  try {
    const { player, admin } = await requirePlayer(req, origin);
    const body = await req.json().catch(() => ({}));
    const gameVersion = String(body.gameVersion ?? "unknown").slice(0, 40);

    // Abandon any lingering active run so the unique-active index stays clean.
    await admin.from("runs")
      .update({ status: "abandoned", finished_at: new Date().toISOString() })
      .eq("player_id", player.id).eq("status", "active");

    const { data: run, error } = await admin.from("runs")
      .insert({ player_id: player.id, status: "active", game_version: gameVersion })
      .select("id, started_at").single();
    if (error) return json({ error: "DB_ERROR", detail: error.message }, 500, origin);

    return json({ runId: run.id, startedAt: run.started_at }, 200, origin);
  } catch (e) {
    if (e instanceof Response) return e;     // requirePlayer threw a ready response
    return json({ error: "UNEXPECTED" }, 500, origin);
  }
});
