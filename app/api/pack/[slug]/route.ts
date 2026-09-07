import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { callerPrefix, harvestBlocked } from "@/lib/apiGuard";
import {
  renderPackMarkdown,
  renderPackSection,
  renderPackSelected,
  type FilmPack,
  type PackSectionKey,
  PACK_SECTION_LABEL,
} from "@/lib/pack";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/pack/{slug}?section=readings   → one section (mandatory film header)
//                     ?sections=a,b,c     → several sections in one doc
//                     (no scope)          → whole film, all sections
//                     &fmt=json           → the raw pack JSON
//
// COPY path (free, no login) per the confirmed model: everything here is public
// page content, so copying it is free. Only the *download* (a saved .md file) is
// login-gated — see ./download. To keep the paid edge (bulk scraping) closed, the
// full RPC is service_role-only and reached ONLY through this app route (via the
// admin client), which is rate-limited and noindex. There is no premium content
// gate here; the gate is on the download convenience.

const ALL_KEYS: PackSectionKey[] = Object.keys(PACK_SECTION_LABEL) as PackSectionKey[];

// Soft per-IP rate limit to blunt bulk harvesting through the route (the CDN
// serves cached hits without touching this). Per warm-isolate only.
const HITS = new Map<string, number[]>();
function rateLimited(ip: string, limit = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (HITS.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  HITS.set(ip, arr);
  if (HITS.size > 5000) for (const [k, v] of HITS) if (!v.some((t) => now - t < windowMs)) HITS.delete(k);
  return arr.length > limit;
}

const NOINDEX = { "x-robots-tag": "noindex" };

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = new URL(req.url);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: NOINDEX });

  const fmt = (u.searchParams.get("fmt") || "md") === "json" ? "json" : "md";
  const section = u.searchParams.get("section");
  const sectionsParam = u.searchParams.get("sections");

  const db = createAdminClient();

  // ── C: the raw machine-readable JSON payload (the cleanest bulk-harvest
  // surface — no UI uses it) is login-gated, same as the .md download. The
  // human-facing copy paths (whole-pack md, single section) stay free.
  if (fmt === "json") {
    const ssr = await createServerClient();
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in to fetch the raw JSON pack. Copying the page content stays free." },
        { status: 401, headers: NOINDEX }
      );
    }
  }

  // ── B: durable per-/24 harvest guard (survives across serverless isolates,
  // unlike the in-memory soft limit above). Only cache-MISSES reach here, which
  // is exactly the unique-slug enumeration pattern of a harvester. Fail-open:
  // any error here must never break the free copy path. When the prefix crosses
  // a threshold, pack_note_hit auto-adds it to bot_blocks and the edge middleware
  // then 403s it fleet-wide; we also 429 immediately.
  //
  // This route used to carry its own copy of the guard — its own Anthropic regex,
  // its own RPC call, and `const { data: hit }` with the error dropped, which is
  // the precise shape that hid the broken guard for 24 days. It now goes through
  // the shared helper, which reads `error` and reports a malfunction to Sentry.
  // Trusted AI-platform egress stays exempt: Claude-User fetching packs to CITE
  // us is the whole point — many users share few /24s.
  //
  // The slug is passed, so this route feeds the corpus meter (0147): whole-film
  // bodies are exactly what that ceiling exists to count.
  {
    const { prefix, trusted } = callerPrefix(req);
    if (await harvestBlocked(db, prefix, trusted, slug)) {
      return NextResponse.json(
        { error: "Automated bulk access detected. This is public content — please slow down or contact us for a data license." },
        { status: 429, headers: NOINDEX }
      );
    }
  }

  const { data, error } = await db.rpc("film_context_pack", { p_slug: slug, p_tier: "full" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NOINDEX });
  if (!data) return NextResponse.json({ error: "No context pack for this film." }, { status: 404, headers: NOINDEX });

  const pack = data as FilmPack;
  // Everything served here is free to copy (public page content). Label it as
  // such — the RPC's tier-derived "Creator License" is for a future paid tier.
  pack.license = "CC BY-NC 4.0 (attribution required)";
  const headers: Record<string, string> = {
    "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    ...NOINDEX,
  };

  // JSON is login-gated (see above), so it must not be shared via the public CDN
  // cache — serve it per-request and uncached.
  if (fmt === "json")
    return NextResponse.json(pack, { headers: { ...NOINDEX, "cache-control": "private, no-store" } });

  let md: string;
  if (section && ALL_KEYS.includes(section as PackSectionKey)) {
    md = renderPackSection(pack, section as PackSectionKey);
  } else if (sectionsParam) {
    const keys = sectionsParam.split(",").map((s) => s.trim()).filter((s) => ALL_KEYS.includes(s as PackSectionKey)) as PackSectionKey[];
    md = keys.length ? renderPackSelected(pack, keys) : renderPackMarkdown(pack);
  } else {
    md = renderPackMarkdown(pack);
  }
  return new NextResponse(md, { headers: { ...headers, "content-type": "text/markdown; charset=utf-8" } });
}
