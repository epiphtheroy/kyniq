import { NextResponse } from "next/server";
import { getAdminUser, logContentEvent } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.formData().catch(() => null);
  let id: string, action: string, targetType: string | null, targetId: string | null;

  if (body) {
    id = body.get("id") as string;
    action = body.get("action") as string;
    targetType = body.get("target_type") as string | null;
    targetId = body.get("target_id") as string | null;
  } else {
    const json = await request.json();
    id = json.id;
    action = json.action;
    targetType = json.target_type;
    targetId = json.target_id;
  }

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (action === "resolve_hide") {
    // Resolve the flag and hide the target content
    await supabase.from("flags").update({ status: "resolved" }).eq("id", id);

    if (targetType && targetId) {
      const table =
        targetType === "question" ? "questions" : "contributions";

      await supabase.from(table).update({ status: "hidden" }).eq("id", targetId);

      await logContentEvent({
        entityType: targetType,
        entityId: targetId,
        event: "hidden",
        actorId: admin.id,
        actorKind: "human",
        meta: { action: "flag_resolve_hide", flag_id: id },
      });
    }

    await logContentEvent({
      entityType: "flag",
      entityId: id,
      event: "flag_resolved",
      actorId: admin.id,
      actorKind: "human",
      meta: { resolution: "hide_content" },
    });
  } else if (action === "dismiss") {
    await supabase.from("flags").update({ status: "dismissed" }).eq("id", id);

    await logContentEvent({
      entityType: "flag",
      entityId: id,
      event: "flag_resolved",
      actorId: admin.id,
      actorKind: "human",
      meta: { resolution: "dismissed" },
    });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const referer = request.headers.get("referer");
  if (referer && body) {
    return NextResponse.redirect(referer, 303);
  }

  return NextResponse.json({ ok: true, action, id });
}
