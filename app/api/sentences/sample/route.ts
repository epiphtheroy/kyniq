import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/sentences/sample?patterns=A_affinity,B_bridge&n=18
// View-flavored catalog sampler for the /network lexicon rail (hour-seeded,
// deterministic within the hour → the s-maxage below matches the seed).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const patternsRaw = (u.searchParams.get("patterns") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const patterns = patternsRaw.length ? patternsRaw : null;
  const n = Math.min(Math.max(Number(u.searchParams.get("n")) || 18, 1), 30);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("sentences_sample", { p_patterns: patterns, p_n: n });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] }, {
    headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
