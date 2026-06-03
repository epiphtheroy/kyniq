import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logContentEvent } from "@/lib/admin";

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST /api/canonical/rollback — restore a prior revision
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { revision_id } = await request.json();
  if (!revision_id) return NextResponse.json({ error: "Missing revision_id" }, { status: 400 });

  const admin = createAdminClient();

  // Check permissions
  const { data: profile } = await admin.from("profiles").select("role, reputation").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && (profile.reputation ?? 0) < 250)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Get the revision to restore
  const { data: revision } = await admin
    .from("answer_revisions")
    .select("id, body, canonical_answer_id")
    .eq("id", revision_id)
    .single();

  if (!revision) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

  // Get current canonical
  const { data: canonical } = await admin
    .from("canonical_answers")
    .select("id, body, revision_count")
    .eq("id", revision.canonical_answer_id)
    .single();

  if (!canonical) return NextResponse.json({ error: "Answer not found" }, { status: 404 });

  // Save current body as new revision (never destroy history)
  await admin.from("answer_revisions").insert({
    canonical_answer_id: canonical.id,
    body: canonical.body,
    editor_id: user.id,
    edit_summary: `Rollback to revision ${revision_id.slice(0, 8)}`,
  });

  // Restore the old body
  await admin.from("canonical_answers").update({
    body: revision.body,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
    revision_count: (canonical.revision_count || 0) + 1,
  }).eq("id", canonical.id);

  await logContentEvent({
    entityType: "canonical_answer",
    entityId: canonical.id,
    event: "edited",
    actorId: user.id,
    actorKind: "human",
    meta: { action: "rollback", revision_id },
  });

  return NextResponse.json({ ok: true });
}
