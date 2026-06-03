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

// POST /api/canonical/edit — direct edit (rep≥250 or admin)
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { canonical_answer_id, body, edit_summary } = await request.json();
  if (!canonical_answer_id || !body?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check user's role/reputation
  const { data: profile } = await admin
    .from("profiles")
    .select("role, reputation")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const canEdit = profile.role === "admin" || (profile.reputation ?? 0) >= 250;
  if (!canEdit) {
    return NextResponse.json({ error: "Insufficient reputation (need 250+). Submit a suggestion instead." }, { status: 403 });
  }

  // Get current canonical answer
  const { data: current } = await admin
    .from("canonical_answers")
    .select("id, body, revision_count")
    .eq("id", canonical_answer_id)
    .single();

  if (!current) return NextResponse.json({ error: "Answer not found" }, { status: 404 });

  // Create revision for old body
  await admin.from("answer_revisions").insert({
    canonical_answer_id,
    body: current.body,
    editor_id: user.id,
    edit_summary: edit_summary || "Direct edit",
  });

  // Update canonical answer
  await admin.from("canonical_answers").update({
    body: body.trim(),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
    revision_count: (current.revision_count || 0) + 1,
  }).eq("id", canonical_answer_id);

  // Log event
  await logContentEvent({
    entityType: "canonical_answer",
    entityId: canonical_answer_id,
    event: "edited",
    actorId: user.id,
    actorKind: "human",
    meta: { edit_summary },
  });

  // Award rep: +15 for editing
  await admin.from("profiles").update({ reputation: (profile.reputation ?? 0) + 15 }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
