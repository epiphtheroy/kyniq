import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

/**
 * OAuth callback handler.
 * Google (and other providers) redirect here with `code`.
 * We exchange it for a session and set auth cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Same-site paths only: `next=@evil.com` would make `${origin}${next}` parse
  // as userinfo@host, and `//` is protocol-relative — both must fall back to "/".
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    let response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.redirect(`${origin}${next}`);
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }
  }

  // Auth error — redirect to error page
  return NextResponse.redirect(`${origin}/auth/error`);
}
