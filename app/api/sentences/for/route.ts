import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/sentences/for?slug=parasite-2019&limit=6&patterns=A_affinity,B_bridge
// Top-k rule-based sentences for one film (see sentence-engine/MASS-PRODUCTION.md),
// diverse + entity slugs for linking. Used by the map "why connected" caption strip.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const slug = (u.searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ rows: [] });
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 6, 1), 20);
  const patternsRaw = (u.searchParams.get("patterns") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const patterns = patternsRaw.length ? patternsRaw : null;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("film_sentences_for", { p_slug: slug, p_limit: limit, p_patterns: patterns });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] }, {
    headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
