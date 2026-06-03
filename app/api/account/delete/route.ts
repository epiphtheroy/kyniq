import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Anonymize profile
  await admin.from("profiles").update({
    username: `deleted-${user.id.slice(0, 8)}`,
    display_name: "[deleted]",
    bio: null,
    avatar_url: null,
    is_public: false,
    account_status: "suspended",
  }).eq("id", user.id);

  // Anonymize questions and contributions authored by this user
  // We keep the rows intact (others built on them) but clear authorship display
  // The profile now shows "[deleted]" which is what viewers see

  // Delete the auth user
  await admin.auth.admin.deleteUser(user.id);

  return NextResponse.json({ ok: true });
}
