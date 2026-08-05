import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { ipToPrefix } from "@/lib/ip-prefix";
import { isObservableCrawler } from "@/lib/bots/identify";

// ── Bot enforcement ─────────────────────────────────────────────────────────
// Search + citation bots we WANT (they index us / cite us / send traffic) —
// never block these, even if a blocked prefix happened to overlap.
const GOOD_BOT =
  /googlebot|bingbot|duckduckbot|yandex|baiduspider|applebot(?!-extended)|slurp|Yeti|Daum|NaverBot|Claude-SearchBot|Claude-User|ChatGPT-User|OAI-SearchBot|PerplexityBot|Amzn-SearchBot|vercel/i;
// Scrapers / AI-training / SEO-harvest bots — the same set our Vercel WAF rule
// and app/robots.ts disallow. Enforced here too so it holds even if the WAF
// rule is edited. (Citation bots above are matched first and exempted.)
//
// 2026-08-01: added the five heaviest crawlers that return nothing. Measured over
// mt_crawler_visits 07-11→07-31 (hits, and referred visitors over the last 11 days
// from mt_events): meta-webindexer 9,844/0 — the single largest crawler on the site,
// walking /credits/* — SleepBot 1,097/0, SERankingBacklinksBot 142/0, AwarioBot 112/0,
// AgenstryBot 39/0. Kept: bingbot (32 visitors), DuckDuckBot (46), Googlebot,
// OAI-SearchBot, PerplexityBot, Baiduspider, NaverBot, and facebookexternalhit —
// that last one is Meta's LINK-PREVIEW fetcher (69.171.x), a different UA from
// meta-webindexer, and blocking it would break shared-link cards.
const BAD_UA =
  /GPTBot|ClaudeBot|anthropic-ai|CCBot|Bytespider|Meta-ExternalAgent|meta-webindexer|FacebookBot|Amazonbot|Diffbot|Omgilibot|ImagesiftBot|PetalBot|cohere-ai|Timpibot|YouBot|MJ12bot|AhrefsBot|SemrushBot|DotBot|BLEXBot|DataForSeo|serpstatbot|SERanking|SleepBot|AwarioBot|AgenstryBot/i;

// Module-scoped blocklist cache.
//
// The docblock on /api/bots/blocklist says this is "hit at most ~once/minute/
// region". Measured 2026-08-03 it ran ~5x/minute — 2,167 bot_blocklist_json
// executions in 405 minutes, ~7,700 DB round-trips a day — for a table holding
// TWO rows, ONE of them live. That made it a bigger line on the bill than every
// AI surface combined, all of it self-inflicted. Three compounding causes:
//
//   1. No in-flight dedup. Every concurrent request on a cold or expired isolate
//      passed the staleness check before any of their fetches returned, so a
//      burst fired a fetch each. Now they share one promise, the same shape
//      cachedLocationsEligibility() uses after 566d712b.
//   2. A 60s TTL for a list that changes on the order of a day (newest entry:
//      2026-08-02). Five minutes is still far faster than the durable /24 blocks
//      this feeds are meant to react on, and cuts refresh attempts 5x.
//   3. Every warm isolate keeps its own copy, and production has been serving
//      several deployments at once, so per-isolate cost multiplies. Nothing here
//      fixes that; it is why the other two matter.
//
// Failures are never memoised as a result: the previous list is kept and
// re-stamped, so a broken endpoint degrades to "block nothing" rather than
// hammering, and never blocks a real visitor by accident.
const BL_TTL_MS = 300_000;
let blCache: { at: number; prefixes: Set<string> } | null = null;
let blInFlight: Promise<Set<string>> | null = null;

async function fetchBlocklist(origin: string): Promise<Set<string>> {
  // Hard 1.5s cap: a hanging blocklist fetch must never stall page renders
  // (Vercel kills middleware at 25s → sitewide sporadic 504s).
  const r = await fetch(`${origin}/api/bots/blocklist`, {
    headers: { "x-mw": "1" },
    signal: AbortSignal.timeout(1500),
  });
  const j = (await r.json()) as { prefixes?: string[] };
  return new Set(j.prefixes ?? []);
}

async function blockedPrefix(prefix: string, origin: string): Promise<boolean> {
  const now = Date.now();
  let prefixes = blCache && now - blCache.at <= BL_TTL_MS ? blCache.prefixes : null;
  if (!prefixes) {
    const inflight = (blInFlight ??= fetchBlocklist(origin)
      .then((p) => {
        blCache = { at: Date.now(), prefixes: p };
        return p;
      })
      .catch(() => {
        const kept = blCache?.prefixes ?? new Set<string>();
        blCache = { at: Date.now(), prefixes: kept }; // fail open, don't hammer
        return kept;
      })
      .finally(() => {
        blInFlight = null;
      }));
    prefixes = await inflight;
  }
  return prefixes.has(prefix);
}
const forbidden = () =>
  new NextResponse("Forbidden", {
    status: 403,
    headers: { "content-type": "text/plain", "x-mt-bot": "blocked" },
  });

// ── Expensive-route throttle ─────────────────────────────────────────────────
// Two routes cost far more than everything else, and both are swept URL-by-URL
// by crawlers, which is the one access pattern ISR cannot help with: every URL
// is a first visit, so every request is a cache MISS that pays full price.
// Measured 2026-08-03 over a 24h window:
//
//   /search           18,954 req/day, 17.5% of all function volume. Its two RPCs
//                     (search_all + search_semantic) burned 5,059s of database
//                     time in one 6h window — ~1,870× the entire MCP server, and
//                     ~11% of a 2-core instance running continuously.
//   /credits/[person] 27,895 req/day, 25.7% of function volume. Has NO local
//                     table: every uncached request calls the TMDB API live, and
//                     the slug's trailing id is the only input, so the URL space
//                     is effectively unbounded.
//
// Added 2026-08-06 after a saturation incident took the site down (34% error rate
// over 90 minutes):
//
//   /film/[s]/figure/[f]  421 of 997 gateway timeouts — 42%, the largest single
//                     source. It is the most expensive page we serve: eight to
//                     ten mostly-sequential round trips (films, figures, takes,
//                     sm_concepts, take_traditions, meta_takes, figure_type_members,
//                     figure_taxonomy, siblings, related). Its URL space is film ×
//                     figure over 18,381 figures, so a sweep never repeats a URL
//                     and ISR never gets a second visit to serve from cache.
//
// The ceiling is 10/min because reading a figure is a slow act — you open one and
// stay. Opening ten in a minute is already machine behaviour.
//
// KEYED ON THE /24, NOT THE IP. The previous per-IP key never fired once (zero
// 429s across 22,800 /search requests a day) because a crawler spread over a
// subnet looks like many distinct visitors. A /24 is the same unit the bot
// blocklist already works in, and with 13-33 real visitors a day the odds of two
// humans sharing one /24 inside a minute are negligible.
//
// Per-isolate and approximate by design: middleware has no shared store, and a
// coarse ceiling that costs nothing beats a precise one that needs a round trip.
// Note this means concurrent deployments each keep their own counters.
//
// 429 + Retry-After is deliberate. Every major crawler answers it by slowing
// down, and unlike a 404 or a noindex it never removes a URL from the index —
// the same principle as the fail-closed work in lib/filmGate.ts.
// /film/<slug>/figure/<slug> only — the film page itself is far cheaper and is
// the one people actually link to, so it must not be caught here.
const FIGURE_PATH = /^\/(?:[a-z]{2}\/)?film\/[^/]+\/figure\/[^/]+$/;

/** Auth round-trip ceiling. Also the abort deadline on the fetch itself — see
 *  the client below for why racing a promise is not enough. */
const AUTH_TIMEOUT_MS = 3000;

const hitLog = new Map<string, number[]>();
const THROTTLE_WINDOW_MS = 60_000;
const SEARCH_MAX_PER_MIN = 20; // a person types a handful of searches a minute
const CREDITS_MAX_PER_MIN = 30; // a person opens a few crew pages; a sweep opens hundreds
const FIGURE_MAX_PER_MIN = 10; // a reader opens one figure and stays; a sweep opens the catalogue
const BURST_MAX_PER_MIN = 60; // sitewide backstop — one page a second, sustained, is a machine
const THROTTLE_KEYS_MAX = 5000; // XFF is client-influencable — cap the key space

function throttled(bucket: string, key: string, max: number): boolean {
  const now = Date.now();
  const k = `${bucket}:${key}`;
  if (!hitLog.has(k) && hitLog.size >= THROTTLE_KEYS_MAX) {
    for (const [existing, arr] of hitLog) {
      if (!arr.length || now - arr[arr.length - 1] > THROTTLE_WINDOW_MS) hitLog.delete(existing);
      if (hitLog.size < THROTTLE_KEYS_MAX) break;
    }
    if (hitLog.size >= THROTTLE_KEYS_MAX) hitLog.clear(); // rotating IPs — reset
  }
  const arr = (hitLog.get(k) ?? []).filter((t) => now - t < THROTTLE_WINDOW_MS);
  arr.push(now);
  hitLog.set(k, arr);
  return arr.length > max;
}

const tooMany = (what: string) =>
  new NextResponse(`Too many requests — try again in a minute.`, {
    status: 429,
    headers: { "content-type": "text/plain", "retry-after": "60", "x-mt-throttle": what },
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

  // Throttle the expensive route families before anything else pays for them.
  // Bare /search (no query) is left alone — it renders no search at all — and so
  // is the /credits index, which is one cached page rather than a per-person fetch.
  {
    // Next.js prefetches almost every <Link> in the viewport (1,188 of them in
    // this codebase, 3 opted out), so one person scrolling a grid fires dozens of
    // requests in seconds and would trip any of these ceilings. Crawlers never
    // send this header — it is the one signal that separates "a reader arrived"
    // from "something is sweeping us", and without it these limits would 429 real
    // people on the catalogue pages.
    const isPrefetch = request.headers.get("next-router-prefetch") === "1";
    const wantsSearch = !isPrefetch && pathname === "/search" && !!request.nextUrl.searchParams.get("q");
    const wantsPerson = !isPrefetch && pathname.startsWith("/credits/");
    const wantsFigure = !isPrefetch && FIGURE_PATH.test(pathname);
    if (wantsSearch || wantsPerson || wantsFigure) {
      const prefix =
        ipToPrefix(request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip")) ??
        "anon";

      if (wantsSearch && throttled("search", prefix, SEARCH_MAX_PER_MIN)) return tooMany("search");
      if (wantsPerson && throttled("credits", prefix, CREDITS_MAX_PER_MIN)) return tooMany("credits");
      if (wantsFigure && throttled("figure", prefix, FIGURE_MAX_PER_MIN)) return tooMany("figure");
    }
  }

  // Bot gate on content routes (not /api — the beacon self-filters bots, and
  // APIs have their own guards). Fail-open throughout: any doubt → allow.
  if (!pathname.startsWith("/api")) {
    const ua = request.headers.get("user-agent") ?? "";

    // Sitewide backstop — deliberately OUTSIDE the good-bot exemption.
    //
    // The crawl that took the site down on 2026-08-06 was Applebot (9,651 hits in
    // 12 hours) and YandexBot (4,699), both of which GOOD_BOT exempts. A ceiling
    // that skips the bots actually crawling us is not a ceiling. Googlebot, for
    // scale, managed 520 in the same window and will never come near this.
    //
    // Being on the good list means we never 403 you. It does not mean you may
    // take the site down: 429 + Retry-After asks a crawler to slow down and,
    // unlike a 404 or a noindex, never drops a URL from the index.
    if (request.headers.get("next-router-prefetch") !== "1") {
      const burstPrefix = ipToPrefix(
        request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip")
      );
      if (burstPrefix && throttled("burst", burstPrefix, BURST_MAX_PER_MIN)) {
        return tooMany("burst");
      }
    }

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
      /**
       * Abort the auth fetch, do not merely stop waiting for it.
       *
       * The Promise.race below caps how long WE wait, but the losing promise
       * keeps running: supabase-js retries a failing /auth/v1/user internally,
       * and on 2026-08-06 that meant 34 retries per request against an already
       * saturated auth server — 1,054 AuthRetryableFetchError in the middleware
       * alone. The guard meant to protect the site was quietly multiplying the
       * load on it. A signal ends the attempt for real.
       */
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) }),
      },
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

  // Refresh session on every request. Guard with a hard timeout: supabase-js
  // retries a failing /auth/v1/user fetch internally, so a degraded auth server
  // (observed 2026-07-16: 522 connection timeouts + multi-second /user latency)
  // can leave this await pending well past Vercel's 25s middleware limit → every
  // gated route 504s sitewide until auth recovers. Same fail-open contract as
  // blockedPrefix above: on timeout, treat the request as unauthenticated —
  // admin/CRM/auth-required routes redirect to login (never a 504), and public
  // authed navigation just skips the session refresh for this request.
  let user: Awaited<
    ReturnType<typeof supabase.auth.getUser>
  >["data"]["user"] = null;
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { user: null } }), AUTH_TIMEOUT_MS)
      ),
    ]);
    user = authResult.data.user;
  } catch {
    user = null;
  }

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

  // ── CRM gate ────────────────────────────────────────────────
  // Owner-only outreach CRM (HANDOFF-CRM-비즈니스접점엔진.md). Same profiles.role
  // = 'admin' gate as /admin, but a separate surface. No login page of its own —
  // unauth → the shared /admin/login; non-admin → stealth 404 (invisible).
  if (pathname.startsWith("/crm")) {
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
  // /settings is NOT here (2026-08-04): it now carries the watch setup and the
  // title language, which are local-first prefs that work without an account —
  // the same way they do in the app. Its profile/account/danger blocks render
  // only for a signed-in user, and every write behind them is RLS- or
  // server-checked, so the page has nothing to leak. Re-add "/settings" to this
  // list to put the wall back.
  const authRequired = ["/me", "/ask/new"];
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
