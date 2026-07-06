import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// My Films lens: the TakeScore ranking restricted to the signed-in user's seen
// films. CodexExplorer swaps its paged cinecodex_ranked calls to this route in
// only-mode; every filter (sort, lambda, search, year, country, dimension
// ranges) passes straight through to the service-role-only mirror RPC.
export const revalidate = 0;

export async function GET(request: Request) {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const num = (k: string) => { const v = parseFloat(searchParams.get(k) ?? ""); return Number.isFinite(v) ? v : null; };
  let sub: unknown = {};
  try { sub = JSON.parse(searchParams.get("sub") || "{}"); } catch { sub = {}; }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cinecodex_ranked_mine", {
    p_user: user.id,
    p_sort: searchParams.get("sort") || "u",
    p_lambda: num("lambda") ?? 1.0,
    p_q: searchParams.get("q") || null,
    p_year_min: num("year_min"),
    p_year_max: num("year_max"),
    p_country: searchParams.get("country") || null,
    p_max_cost: num("max_cost") ?? 100,
    p_sub: sub,
    p_limit: Math.min(Math.max(Math.trunc(num("limit") ?? 60), 1), 120),
    p_offset: Math.max(Math.trunc(num("offset") ?? 0), 0),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { total: 0, rows: [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
