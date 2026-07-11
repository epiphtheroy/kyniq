import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/sentences/ticker?n=40 — a diverse, hourly-deterministic slice of the
// film_sentences layer for the site-wide connection ticker. The RPC seeds its
// shuffle on the current UTC hour, so the body is stable within the hour (matches
// the s-maxage below) and the client rotator never re-fires the edge cache.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const n = Math.min(Math.max(Number(u.searchParams.get("n")) || 40, 1), 80);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("sentences_ticker", { p_n: n });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] }, {
    headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
