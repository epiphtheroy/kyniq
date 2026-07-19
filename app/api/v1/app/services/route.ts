import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAndLog, API_CORS, TOO_MANY } from "@/lib/apiGuard";

/** Mobile BFF — provider list for the onboarding services grid (wtw_services). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: API_CORS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = (url.searchParams.get("country") || "US").toUpperCase().slice(0, 2);

  const db = createAdminClient();
  if (await guardAndLog(db, req, "app_services", country)) {
    return NextResponse.json(TOO_MANY, { status: 429, headers: API_CORS });
  }

  try {
    const { data, error } = await db.rpc("wtw_services", { p_country: country });
    if (error) throw error;
    return NextResponse.json(
      { v: 1, country, services: data ?? [] },
      { headers: { ...API_CORS, "cache-control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "app_services_failed" },
      { status: 500, headers: API_CORS },
    );
  }
}
