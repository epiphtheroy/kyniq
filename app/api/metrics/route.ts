/**
 * /api/metrics — first-party analytics collector (see components/Metrics.tsx).
 *
 * POST { t, path, ref?, utm_*?, sw?, lang?, sid?, props? }  →  mt_events row.
 *
 * The visitor id is a daily-rotating hash of (day, ip, ua, salt): good enough
 * to count uniques within a day, useless for tracking anyone across days —
 * the Plausible model, no cookies, no consent banner needed.
 * Geo comes free from Vercel's x-vercel-ip-* headers.
 */
import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipToPrefix } from "@/lib/ip-prefix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["pageview", "leave", "click", "vital"]);
const BOT =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|pingdom|uptime|monitor|scrap|python-requests|python-httpx|curl\/|wget\/|facebookexternalhit|bingpreview|vercel-screenshot/i;

// same in-memory rate-limit shape as /api/search
const hits = new Map<string, number[]>();
const RATE_KEYS_MAX = 5000;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (!hits.has(ip) && hits.size >= RATE_KEYS_MAX) {
    for (const [k, arr] of hits) {
      if (!arr.length || now - arr[arr.length - 1] > 60_000) hits.delete(k);
      if (hits.size < RATE_KEYS_MAX) break;
    }
    if (hits.size >= RATE_KEYS_MAX) hits.clear();
  }
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 120; // a human browsing fast is ~10 events/min
}

const ok = () => new Response(null, { status: 204 });

function refDomain(ref: string): string | null {
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    return h === "metatake.net" ? null : h;
  } catch {
    return null;
  }
}

function deviceOf(ua: string): string {
  if (/ipad|tablet|kindle|silk/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

function browserOf(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/samsungbrowser/i.test(ua)) return "Samsung";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/chrome\/|crios\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua)) return "Safari";
  return "other";
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (!ua || BOT.test(ua)) return ok();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    if (rateLimited(ip)) return ok();

    const raw = await req.text();
    if (!raw || raw.length > 2048) return ok();
    const b = JSON.parse(raw) as Record<string, unknown>;

    const t = String(b.t ?? "");
    if (!TYPES.has(t)) return ok();
    const path = String(b.path ?? "");
    if (!path.startsWith("/") || path.length > 300) return ok();

    const salt = process.env.METRICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16) || "mt";
    const day = new Date().toISOString().slice(0, 10);
    const visitor = createHash("sha256").update(`${day}|${ip}|${ua}|${salt}`).digest("hex").slice(0, 24);

    const ref = typeof b.ref === "string" ? b.ref.slice(0, 500) : "";
    const city = req.headers.get("x-vercel-ip-city");

    const row = {
      type: t,
      path,
      referrer: ref || null,
      ref_domain: ref ? refDomain(ref) : null,
      utm_source: typeof b.utm_source === "string" ? b.utm_source.slice(0, 80) : null,
      utm_medium: typeof b.utm_medium === "string" ? b.utm_medium.slice(0, 80) : null,
      utm_campaign: typeof b.utm_campaign === "string" ? b.utm_campaign.slice(0, 120) : null,
      visitor,
      session: typeof b.sid === "string" ? b.sid.slice(0, 24) : null,
      country: req.headers.get("x-vercel-ip-country"),
      region: req.headers.get("x-vercel-ip-country-region"),
      city: city ? decodeURIComponent(city) : null,
      device: deviceOf(ua),
      browser: browserOf(ua),
      lang: typeof b.lang === "string" ? b.lang.slice(0, 12) : null,
      screen_w: typeof b.sw === "number" && b.sw > 0 && b.sw < 20000 ? Math.round(b.sw) : null,
      props: b.props && typeof b.props === "object" ? b.props : null,
    };

    const sb = createAdminClient();
    await sb.from("mt_events").insert(row);

    // Record the visitor→/24 map the bot detector needs (mt_events omits IP by
    // design). One upsert per visitor/day, pageviews only. Best-effort: a
    // failure here must never surface to the beacon.
    if (t === "pageview") {
      const prefix = ipToPrefix(ip);
      if (prefix) {
        await sb
          .from("mt_visitor_ip")
          .upsert(
            { day, visitor, prefix, country: row.country },
            { onConflict: "day,visitor", ignoreDuplicates: true }
          );
      }
    }
    return ok();
  } catch {
    return ok(); // the beacon must never surface errors to the page
  }
}
