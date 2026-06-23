import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fwBySlug } from "@/lib/frameworks";

// Random featured Strong Misreadings (with backdrop) for the rotating cards.
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
  const n = Math.min(Math.max(parseInt(searchParams.get("n") || "12", 10) || 12, 1), 24);

  const { data, error } = await db().rpc("readings_featured", { p_fw: fwKey, p_n: n });
  if (error) return NextResponse.json({ rows: [] });
  return NextResponse.json({ rows: data ?? [] });
}
