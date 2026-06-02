import { NextResponse } from "next/server";
import { getAdminUser, logContentEvent } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.formData().catch(() => null);
  let id: string, action: string;

  if (body) {
    id = body.get("id") as string;
    action = body.get("action") as string;
  } else {
    const json = await request.json();
    id = json.id;
    action = json.action;
  }

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (action === "suspend") {
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "suspended" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logContentEvent({
      entityType: "profile",
      entityId: id,
      event: "edited",
      actorId: admin.id,
      actorKind: "human",
      meta: { action: "suspend_member" },
    });
  } else if (action === "reactivate") {
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "active" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logContentEvent({
      entityType: "profile",
      entityId: id,
      event: "edited",
      actorId: admin.id,
      actorKind: "human",
      meta: { action: "reactivate_member" },
    });
  } else if (action === "anonymize") {
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: "[deleted]",
        username: null,
        bio: null,
        avatar_url: null,
        is_public: false,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Anonymize authored content body
    await supabase
      .from("contributions")
      .update({ body: "[content removed]" })
      .eq("author_id", id);

    await logContentEvent({
      entityType: "profile",
      entityId: id,
      event: "edited",
      actorId: admin.id,
      actorKind: "human",
      meta: { action: "anonymize_member" },
    });
  } else if (action === "set_role") {
    const role = body?.get("role") as string;
    if (!role || !["user", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logContentEvent({
      entityType: "profile",
      entityId: id,
      event: "edited",
      actorId: admin.id,
      actorKind: "human",
      meta: { action: "set_role", role },
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
