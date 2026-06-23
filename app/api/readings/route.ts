import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fwBySlug } from "@/lib/frameworks";

// Paginated / searchable / faceted feed of Strong Misreadings for a framework.
// fw = framework slug (e.g. "psychoanalytic") or "all". Resolves slug → key server-side
// so the framework key's special characters never travel in the URL.
export const revalidate = 0;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fwParam = searchParams.get("fw");
  let fwKey: string | null = null;
  if (fwParam && fwParam !== "all") {
    const f = fwBySlug(fwParam);
    if (!f) return NextResponse.json({ error: "unknown framework" }, { status: 400 });
    fwKey = f.key;
  }

  const q = searchParams.get("q")?.trim() || null;
  const sort = searchParams.get("sort") || "film";
  const trope = searchParams.get("trope") || null;
  const decadeRaw = parseInt(searchParams.get("decade") || "", 10);
  const decade = Number.isFinite(decadeRaw) ? decadeRaw : null;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "24", 10) || 24, 1), 48);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const { data, error } = await db().rpc("readings_by_framework", {
    p_fw: fwKey, p_q: q, p_sort: sort, p_trope: trope, p_decade: decade,
    p_limit: limit, p_offset: offset,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { total: 0, rows: [] });
}
