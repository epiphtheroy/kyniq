import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// What to Watch saved views — a signed-in user's named filter/sort presets.
// GET: list mine. POST {name, config}: upsert by (user, name). DELETE ?id=: remove mine.
// Mirrors /api/lens/* auth (cookie SSR client for identity, service_role for the row op,
// always scoped to user.id). Anonymous users keep their single current setting in
// localStorage client-side — this route is only the logged-in "several versions" layer.
export const revalidate = 0;

async function requireUser() {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  return auth?.user ?? null;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wtw_saved_views")
    .select("id, name, config, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  let body: { name?: unknown; config?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const config = body.config && typeof body.config === "object" ? body.config : {};

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wtw_saved_views")
    .upsert({ user_id: user.id, name, config }, { onConflict: "user_id,name" })
    .select("id, name, config, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("wtw_saved_views").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
