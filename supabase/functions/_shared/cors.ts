// Shared CORS + auth helpers for the AbuShakra Edge Functions (Deno runtime).
// ALLOWED_ORIGIN env var should be set to your GitHub Pages origin in production
// (e.g. https://sohaibyass.github.io). Defaults to "*" for local development.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

export function corsHeaders(origin: string | null) {
  const allow = ALLOWED_ORIGIN === "*" ? (origin ?? "*") : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// Service-role client (bypasses RLS) — for authoritative writes ONLY, server-side.
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

// Resolve the calling player's auth user id + player row from their JWT.
// Returns { authUserId, player } or throws a Response on failure.
export async function requirePlayer(req: Request, origin: string | null) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw json({ error: "NO_AUTH" }, 401, origin);

  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) throw json({ error: "BAD_AUTH" }, 401, origin);
  const authUserId = userData.user.id;

  const { data: player, error: pErr } = await admin
    .from("players").select("id, auth_user_id").eq("auth_user_id", authUserId).maybeSingle();
  if (pErr) throw json({ error: "DB_ERROR" }, 500, origin);
  if (!player) throw json({ error: "NO_PROFILE" }, 403, origin);
  return { authUserId, player, admin };
}
