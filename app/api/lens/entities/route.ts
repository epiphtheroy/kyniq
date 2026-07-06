import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// My Films lens: entity indexes (tropes / concepts / theorists / traditions /
// directors) ranked by how many of the signed-in user's seen films each entity
// touches. Only-mode swaps the index pages' lists to this route. The *_mine
// RPCs are service-role-only in the DB — the uid comes from the session here
// and can never be spoofed from the client.
export const revalidate = 0;

const KINDS: Record<string, string> = {
  tropes: "tropes_mine",
  concepts: "concepts_mine",
  theorists: "theorists_mine",
  traditions: "traditions_mine",
  directors: "directors_mine",
};

export async function GET(request: Request) {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fn = KINDS[searchParams.get("kind") ?? ""];
  if (!fn) return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "500", 10) || 500, 1), 500);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(fn, { p_user: user.id, p_limit: limit, p_offset: offset });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { total: 0, rows: [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
