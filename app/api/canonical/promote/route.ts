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

// POST /api/canonical/promote — merge contribution into canonical answer
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contribution_id } = await request.json();
  if (!contribution_id) return NextResponse.json({ error: "Missing contribution_id" }, { status: 400 });

  const admin = createAdminClient();

  // Check editor permission
  const { data: profile } = await admin.from("profiles").select("role, reputation").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && (profile.reputation ?? 0) < 250)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Get contribution + its question's canonical answer
  const { data: contribution } = await admin
    .from("contributions")
    .select("id, body, question_id, author_id")
    .eq("id", contribution_id)
    .single();

  if (!contribution) return NextResponse.json({ error: "Contribution not found" }, { status: 404 });

  const { data: canonical } = await admin
    .from("canonical_answers")
    .select("id, body, revision_count")
    .eq("question_id", contribution.question_id)
    .single();

  if (!canonical) return NextResponse.json({ error: "No canonical answer" }, { status: 404 });

  // Create revision with old body
  await admin.from("answer_revisions").insert({
    canonical_answer_id: canonical.id,
    body: canonical.body,
    editor_id: user.id,
    edit_summary: `Merged contribution ${contribution_id.slice(0, 8)}`,
  });

  // Append contribution to canonical answer
  const newBody = `${canonical.body}\n\n${contribution.body}`;
  await admin.from("canonical_answers").update({
    body: newBody,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
    revision_count: (canonical.revision_count || 0) + 1,
  }).eq("id", canonical.id);

  // Mark contribution as merged
  await admin.from("contributions").update({ merged_into_canonical: true }).eq("id", contribution_id);

  // Rep awards: +25 to contribution author
  const { data: authorProfile } = await admin.from("profiles").select("reputation").eq("id", contribution.author_id).single();
  if (authorProfile) {
    await admin.from("profiles").update({ reputation: (authorProfile.reputation ?? 0) + 25 }).eq("id", contribution.author_id);
  }

  // Log event
  await logContentEvent({
    entityType: "canonical_answer",
    entityId: canonical.id,
    event: "edited",
    actorId: user.id,
    actorKind: "human",
    meta: { action: "promote_merge", contribution_id },
  });

  return NextResponse.json({ ok: true });
}
