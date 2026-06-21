// leaderboard — optional HTTP endpoint that returns the public leaderboard.
// GET/POST { limit } -> [{ rank, player_id, display_name, total_carabiners,
//   total_gear, levels_completed, completion_time_ms, status }]
//
// NOTE: the frontend reads the leaderboard directly via the SECURITY DEFINER
// RPC `get_leaderboard()` with the anon key (no Edge Function needed). This
// function is provided as an alternative HTTP endpoint and simply proxies the
// same RPC; it never exposes birth data, auth ids or internal run ids.
import { corsHeaders, json, adminClient } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

  try {
    let limit = 100;
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      limit = Number(b.limit ?? 100);
    } else {
      const u = new URL(req.url);
      limit = Number(u.searchParams.get("limit") ?? 100);
    }
    const admin = adminClient();
    const { data, error } = await admin.rpc("get_leaderboard", { p_limit: limit });
    if (error) return json({ error: "DB_ERROR", detail: error.message }, 500, origin);
    return json({ leaderboard: data ?? [] }, 200, origin);
  } catch (_e) {
    return json({ error: "UNEXPECTED" }, 500, origin);
  }
});
