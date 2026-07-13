import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { ipToPrefix } from "@/lib/ip-prefix";
import { isObservableCrawler } from "@/lib/bots/identify";

// ── Bot enforcement ─────────────────────────────────────────────────────────
// Search + citation bots we WANT (they index us / cite us / send traffic) —
// never block these, even if a blocked prefix happened to overlap.
const GOOD_BOT =
  /googlebot|bingbot|duckduckbot|yandex|baiduspider|applebot(?!-extended)|slurp|Claude-SearchBot|Claude-User|ChatGPT-User|OAI-SearchBot|PerplexityBot|Amzn-SearchBot|vercel/i;
// Scrapers / AI-training / SEO-harvest bots — the same set our Vercel WAF rule
// and app/robots.ts disallow. Enforced here too so it holds even if the WAF
// rule is edited. (Citation bots above are matched first and exempted.)
const BAD_UA =
  /GPTBot|ClaudeBot|anthropic-ai|CCBot|Bytespider|Meta-ExternalAgent|FacebookBot|Amazonbot|Diffbot|Omgilibot|ImagesiftBot|PetalBot|cohere-ai|Timpibot|YouBot|MJ12bot|AhrefsBot|SemrushBot|DotBot|BLEXBot|DataForSeo|serpstatbot/i;

// Module-scoped blocklist cache — refreshed at most once/60s per warm isolate.
let blCache: { at: number; prefixes: Set<string> } | null = null;
async function blockedPrefix(prefix: string, origin: string): Promise<boolean> {
  const now = Date.now();
  if (!blCache || now - blCache.at > 60_000) {
    try {
      // Hard 1.5s cap: a hanging blocklist fetch must never stall page renders
      // (Vercel kills middleware at 25s → sitewide sporadic 504s). Abort → the
      // catch below fails open with the prior list, honoring the design intent.
      const r = await fetch(`${origin}/api/bots/blocklist`, {
        headers: { "x-mw": "1" },
        signal: AbortSignal.timeout(1500),
      });
      const j = (await r.json()) as { prefixes?: string[] };
      blCache = { at: now, prefixes: new Set(j.prefixes ?? []) };
    } catch {
      // fail-open: keep any prior list, don't hammer on error
      blCache = { at: now, prefixes: blCache?.prefixes ?? new Set() };
    }
  }
  return blCache.prefixes.has(prefix);
}
const forbidden = () =>
  new NextResponse("Forbidden", {
    status: 403,
    headers: { "content-type": "text/plain", "x-mt-bot": "blocked" },
  });

// ── Crawler observation (visit-back handshake) ───────────────────────────────
// Record identifiable crawlers that visit us, with their UA + self-declared URL,
// so the visit-back worker (lib/bots/handshake) can leave metatake.net in their
// logs. Fire-and-forget via event.waitUntil so it never delays a response.
// Isolate-scoped dedup: a given UA is beaconed at most once / 10 min per isolate.
const OBSERVE_TTL = 10 * 60 * 1000;
const seenUA = new Map<string, number>();
function observeCrawler(event: NextFetchEvent, request: NextRequest, ua: string) {
  const now = Date.now();
  const last = seenUA.get(ua);
  if (last && now - last < OBSERVE_TTL) return;
  seenUA.set(ua, now);
  if (seenUA.size > 2000) {
    for (const [k, t] of seenUA) if (now - t > OBSERVE_TTL) seenUA.delete(k);
  }
  const ip =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  event.waitUntil(
    fetch(`${request.nextUrl.origin}/api/bots/observe`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mt-observe": "1" },
      body: JSON.stringify({ ua, ip, path: request.nextUrl.pathname }),
      signal: AbortSignal.timeout(2500),
    }).catch(() => {})
  );
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // The blocklist endpoint must stay reachable from within middleware (else the
  // cache refresh recurses) — let it through untouched.
  if (pathname.startsWith("/api/bots/blocklist")) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  // Bot enforcement DOES cover the free bulk-content APIs: /api/pack/* (copy
  // backend) and /api/mcp (the MCP server) — the two /api surfaces that serve
  // bulk page content with no auth, i.e. the natural harvest targets. Apply the
  // same UA + blocklist gate we use on content routes (the durable per-/24
  // velocity guard in those routes feeds bot_blocks, so a harvester that trips
  // it gets 403'd here fleet-wide). Everything else under /api keeps skipping
  // this gate (each has its own auth/route guards). NB: GOOD_BOT (Claude-User,
  // ChatGPT-User, …) passes — those are exactly the AI callers MCP exists for.
  if (pathname.startsWith("/api/pack") || pathname.startsWith("/api/mcp") || pathname.startsWith("/api/v1")) {
    const ua = request.headers.get("user-agent") ?? "";
    if (ua && !GOOD_BOT.test(ua)) {
      if (BAD_UA.test(ua)) return forbidden();
      const prefix = ipToPrefix(
        request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip")
      );
      if (prefix && (await blockedPrefix(prefix, request.nextUrl.origin))) {
        return forbidden();
      }
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  // Bot gate on content routes (not /api — the beacon self-filters bots, and
  // APIs have their own guards). Fail-open throughout: any doubt → allow.
  if (!pathname.startsWith("/api")) {
    const ua = request.headers.get("user-agent") ?? "";
    if (ua && !GOOD_BOT.test(ua)) {
      if (BAD_UA.test(ua)) return forbidden();
      const prefix = ipToPrefix(
        request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip")
      );
      if (prefix && (await blockedPrefix(prefix, request.nextUrl.origin))) {
        return forbidden();
      }
    }
    // After the block decision (so we never record a request we 403'd): note
    // identifiable crawlers for the visit-back handshake.
    if (ua && isObservableCrawler(ua)) observeCrawler(event, request, ua);
  }

  // API routes do their own auth (each creates its own Supabase client) — skip
  // the supabase.auth.getUser() round-trip here so every /api/* call doesn't pay
  // an auth-server hop. /api/admin/* is excluded out of caution (though the admin
  // gate below matches "/admin", not "/api/admin", so those rely on route guards).
  if (pathname.startsWith("/api") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  // The home page ("/") is fully public and client-driven — it has no
  // server-side auth gating. Skip the supabase.auth.getUser() round-trip here so
  // logged-in visitors don't pay an auth-server hop on the most-visited, now
  // edge-cached page. Session cookies still refresh on any authed navigation.
  if (pathname === "/") {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

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
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session on every request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Admin gate ──────────────────────────────────────────────
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      const notFoundUrl = request.nextUrl.clone();
      notFoundUrl.pathname = "/_not-found";
      return NextResponse.rewrite(notFoundUrl);
    }
  }

  // ── Auth-required pages ─────────────────────────────────────
  // Segment-exact match so /meta-takes is NOT caught by /me, and /ask (public
  // grounded Q&A) stays open — only /ask/new (posting a question) needs login.
  const authRequired = ["/settings", "/me", "/ask/new"];
  const needsAuth = authRequired.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (needsAuth && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*|apple-touch-icon|filmcurio-.*|my_room|home2|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
