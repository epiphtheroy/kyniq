import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/surprise?kind=any|film|reading|trope|idea|director → one random card payload.
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") || "any";
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db.rpc("surprise", { p_kind: kind });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {}, { headers: { "cache-control": "no-store" } });
}
