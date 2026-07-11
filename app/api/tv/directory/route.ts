import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// GET /api/tv/directory?axis=&q=&offset=&limit= — a page of watch lists for the
// /tv/lists browse UI, plus the per-axis summary (counts) for the filter tabs.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const axis = u.searchParams.get("axis") || null;
  const q = (u.searchParams.get("q") || "").trim() || null;
  const offset = Math.max(0, Number(u.searchParams.get("offset")) || 0);
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit")) || 48, 1), 120);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [dir, sum] = await Promise.all([
    db.rpc("tv_directory", { p_axis: axis, p_q: q, p_limit: limit, p_offset: offset }),
    db.rpc("tv_directory_summary"),
  ]);
  if (dir.error) return NextResponse.json({ error: dir.error.message }, { status: 500 });
  const data = (dir.data as { total?: number; lists?: unknown[] } | null) ?? {};
  return NextResponse.json(
    { total: data.total ?? 0, lists: data.lists ?? [], summary: sum.data ?? [] },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=1800" } },
  );
}
