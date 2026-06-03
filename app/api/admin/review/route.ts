import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    const updateData: Record<string, unknown> = {
      status: "published",
      published_at: new Date().toISOString(),
    };
    if (table !== "contributions") {
      updateData.reviewed_by = admin.id;
    }
    const { error } = await supabase
      .from(table)
      .update(updateData)
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
    const rejectData: Record<string, unknown> = { status: "rejected" };
    if (table !== "contributions") {
      rejectData.reviewed_by = admin.id;
    }
    const { error } = await supabase
      .from(table)
      .update(rejectData)
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

  // Revalidate film page so updated content shows immediately
  try {
    const questionId = type === "question" ? id : null;
    const contribQuestionId = type === "contribution" || type === "canonical_answer" ? id : null;

    let filmSlug: string | null = null;
    if (questionId) {
      const { data: q } = await supabase
        .from("questions")
        .select("films!inner(slug)")
        .eq("id", questionId)
        .single();
      filmSlug = (q?.films as unknown as { slug: string })?.slug ?? null;
    } else if (contribQuestionId) {
      // For answers/contributions, get question_id first
      const tbl = type === "canonical_answer" ? "canonical_answers" : "contributions";
      const { data: row } = await supabase
        .from(tbl)
        .select("question_id")
        .eq("id", id)
        .single();
      if (row?.question_id) {
        const { data: q } = await supabase
          .from("questions")
          .select("films!inner(slug)")
          .eq("id", row.question_id)
          .single();
        filmSlug = (q?.films as unknown as { slug: string })?.slug ?? null;
      }
    }
    if (filmSlug) {
      revalidatePath(`/film/${filmSlug}`);
    }
  } catch { /* best effort */ }

  // Redirect back to admin (for form submissions)
  const referer = request.headers.get("referer");
  if (referer && body) {
    return NextResponse.redirect(referer, 303);
  }

  return NextResponse.json({ ok: true, action, id, type });
}
