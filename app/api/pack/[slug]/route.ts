import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  if (fmt === "json") return NextResponse.json(pack, { headers });

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
