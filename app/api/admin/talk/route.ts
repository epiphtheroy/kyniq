/**
 * POST /api/admin/talk — moderation actions for talk_posts (admin only).
 * Form fields: id (uuid), status (published | hidden | deleted).
 * Status changes go through the service-role client: the RLS/trigger contract
 * says authors may only soft-delete; every other transition is the site's.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["published", "hidden", "deleted"]);

export async function POST(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!id || !ALLOWED.has(status)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const c = createAdminClient();
  const { error } = await c.from("talk_posts").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.redirect(new URL("/admin/talk", req.url), 303);
}
