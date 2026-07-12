import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// What to Watch ("The Marquee") — Hide-seen mirror. Same shape as
// /api/lens/takescore, plus the two Marquee-only args: watch_countries (VPN
// multi-country) and us_lib (fold in Kanopy/Hoopla). service_role calls the
// _mine RPC in 'exclude' mode so the signed-in user's seen films drop out.
export const revalidate = 0;

export async function GET(request: Request) {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const num = (k: string) => { const v = parseFloat(searchParams.get(k) ?? ""); return Number.isFinite(v) ? v : null; };
  const intArr = (k: string) => (searchParams.get(k) || "").split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
  const strArr = (k: string) => (searchParams.get(k) || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const prov = intArr("prov");
  const countries = strArr("watch_countries");
  const mode = searchParams.get("mode") === "exclude" ? "exclude" : "only";

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cinecodex_ranked_mine", {
    p_user: user.id,
    p_sort: searchParams.get("sort") || "u",
    p_lambda: num("lambda") ?? 1.0,
    p_q: searchParams.get("q") || null,
    p_year_min: num("year_min"),
    p_year_max: num("year_max"),
    p_country: null,
    p_max_cost: 100,
    p_sub: {},
    p_ts_min: num("ts_min"),
    p_ts_max: num("ts_max"),
    p_providers: prov.length ? prov : null,
    p_watch_country: searchParams.get("watch") || null,
    p_max_votes: null,
    p_mode: mode,
    p_genre: null,
    p_limit: Math.min(Math.max(Math.trunc(num("limit") ?? 60), 1), 120),
    p_offset: Math.max(Math.trunc(num("offset") ?? 0), 0),
    p_watch_countries: countries.length ? countries : null,
    p_include_us_library: searchParams.get("us_lib") === "1",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { total: 0, rows: [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
