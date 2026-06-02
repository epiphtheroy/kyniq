import { NextResponse } from "next/server";
import { getAdminUser, logContentEvent } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.formData().catch(() => null);
  let id: string, type: string, action: string;

  if (body) {
    // Form submission (from review page buttons)
    id = body.get("id") as string;
    type = body.get("type") as string;
    action = body.get("action") as string;
  } else {
    // JSON API
    const json = await request.json();
    id = json.id;
    type = json.type;
    action = json.action;
  }

  if (!id || !type || !action) {
    return NextResponse.json(
      { error: "Missing id, type, or action" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const table =
    type === "question"
      ? "questions"
      : type === "canonical_answer"
        ? "canonical_answers"
        : "contributions";

  if (action === "publish") {
    const { error } = await supabase
      .from(table)
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        reviewed_by: admin.id,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logContentEvent({
      entityType: type,
      entityId: id,
      event: "published",
      actorId: admin.id,
      actorKind: "human",
      meta: { action: "approve_and_publish" },
    });
  } else if (action === "reject") {
    const { error } = await supabase
      .from(table)
      .update({
        status: "rejected",
        reviewed_by: admin.id,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logContentEvent({
      entityType: type,
      entityId: id,
      event: "rejected",
      actorId: admin.id,
      actorKind: "human",
      meta: { action: "reject" },
    });
  } else if (action === "hide") {
    const { error } = await supabase
      .from(table)
      .update({ status: "hidden" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logContentEvent({
      entityType: type,
      entityId: id,
      event: "hidden",
      actorId: admin.id,
      actorKind: "human",
      meta: { action: "unpublish" },
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Redirect back to admin (for form submissions)
  const referer = request.headers.get("referer");
  if (referer && body) {
    return NextResponse.redirect(referer, 303);
  }

  return NextResponse.json({ ok: true, action, id, type });
}
