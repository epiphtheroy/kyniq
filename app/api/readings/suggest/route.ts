import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fwBySlug } from "@/lib/frameworks";

// Typeahead suggestions (trigram on take_title) for the Strong Misreadings feed.
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
    if (!f) return NextResponse.json({ rows: [] });
    fwKey = f.key;
  }
  const q = searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ rows: [] });

  const { data, error } = await db().rpc("readings_suggest", { p_fw: fwKey, p_q: q, p_limit: 8 });
  if (error) return NextResponse.json({ rows: [] });
  return NextResponse.json({ rows: data ?? [] });
}
