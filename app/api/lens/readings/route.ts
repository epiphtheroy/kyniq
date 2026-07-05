import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fwBySlug } from "@/lib/frameworks";

// My Films lens: the Strong Misreadings feed filtered to the signed-in user's
// seen films (only-mode swaps ReadingFeed's data source to this route). Session
// is validated here; readings_mine is service-role-only in the DB, so the uid
// can never be spoofed from the client. Always private + uncached.
export const revalidate = 0;

export async function GET(request: Request) {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fwParam = searchParams.get("fw");
  let fwKey: string | null = null;
  if (fwParam && fwParam !== "all") {
    const f = fwBySlug(fwParam);
    if (!f) return NextResponse.json({ error: "unknown framework" }, { status: 400 });
    fwKey = f.key;
  }
  const sort = searchParams.get("sort") || "film";
  const decadeRaw = parseInt(searchParams.get("decade") || "", 10);
  const decade = Number.isFinite(decadeRaw) ? decadeRaw : null;
  const trope = searchParams.get("trope") || null;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "24", 10) || 24, 1), 48);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("readings_mine", {
    p_user: user.id, p_fw: fwKey, p_sort: sort, p_trope: trope, p_decade: decade, p_limit: limit, p_offset: offset,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { total: 0, rows: [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
