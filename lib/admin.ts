/* Admin-only server helpers — never import from client components */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ── Role check ──────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  role: string;
  display_name: string | null;
}

/**
 * Verify the current request is from an authenticated admin.
 * Returns the admin profile or null if not admin.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;

  return profile as AdminUser;
}

/**
 * Defense-in-depth guard for admin pages/server components. Middleware already
 * gates every /admin route, but pages here load data with the service-role
 * client (which bypasses RLS), so each must re-verify server-side rather than
 * trust middleware alone. Redirects non-admins to the login page and never
 * returns for them; returns the admin profile otherwise.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");
  return admin;
}

// ── Audit logging ───────────────────────────────────────────────

interface ContentEventParams {
  entityType: string; // 'question' | 'canonical_answer' | 'contribution' | 'profile' | 'flag'
  entityId: string;
  event: string; // 'published' | 'hidden' | 'rejected' | 'edited' | 'flag_resolved' | etc
  actorId: string | null;
  actorKind?: "human" | "ai" | "system";
  meta?: Record<string, unknown>;
}

/**
 * Write a row to content_events. Called on every admin action.
 */
export async function logContentEvent(params: ContentEventParams) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("content_events").insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    event: params.event,
    actor_id: params.actorId,
    actor_kind: params.actorKind ?? "human",
    meta: params.meta ?? {},
  });

  if (error) {
    console.error("Failed to log content_event:", error.message);
  }
}
