import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/sentences/entity?type=theorist&key=karl-marx[&key2=][&limit=18]
// Sentences MENTIONING one entity (film · director · theorist · trope/take · figure),
// anchor film included per row so the SentenceLexicon panel can recenter anywhere.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const type = (u.searchParams.get("type") || "").trim();
  const key = (u.searchParams.get("key") || "").trim();
  if (!type || !key) return NextResponse.json({ rows: [] });
  const key2 = (u.searchParams.get("key2") || "").trim() || null;
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 18, 1), 30);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("sentences_for_entity", { p_type: type, p_key: key, p_key2: key2, p_limit: limit });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] }, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
