import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation handler (PKCE flow).
 *
 * Supabase SSR uses PKCE, so email confirmation links arrive with
 * `token_hash` + `type` (not `code`). This route calls `verifyOtp`
 * to exchange the token for a session and set auth cookies.
 *
 * Email templates must point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *   (for password reset: type=recovery&next=/settings)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // Successful verification — redirect to the intended page
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Verification failed — redirect to error page
  return NextResponse.redirect(new URL("/auth/error", request.url));
}
