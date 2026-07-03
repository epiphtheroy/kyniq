import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** /u/me → 로그인 사용자의 실제 공개 프로필(/u/{username})로 302.
 *  username 미설정이면 /settings로 유도. (ROOM-HANDOVER-MASTER §8 P1-9 — /u/me 404 수정) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.redirect(new URL("/login?next=/u/me", url.origin));

  const { data: prof } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const username = (prof as { username?: string | null } | null)?.username;
  if (!username) return NextResponse.redirect(new URL("/settings", url.origin));
  return NextResponse.redirect(new URL(`/u/${encodeURIComponent(username)}`, url.origin));
}
