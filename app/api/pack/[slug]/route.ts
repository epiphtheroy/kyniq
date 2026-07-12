import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { renderPackMarkdown, type FilmPack, type PackTier } from "@/lib/pack";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/pack/{slug}?tier=trim&fmt=md|json
//
// W1: only the free, no-login TRIM pack is served here (via the anon-safe
// `film_context_pack_trim` RPC). `tier=full` is intentionally gated — full packs
// open with sign-in + monthly quota in W1.5 (see HANDOFF-컨텍스트팩-실행.md §7),
// and the full RPC is service_role-only at the DB edge (§2-7), so it is never
// reachable with the anon key used here.
//
// Not indexed (X-Robots-Tag: noindex) and not in the sitemap — the pack text
// mirrors the film page and must not compete with it for search (§10-6).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const u = new URL(req.url);
  const tier = (u.searchParams.get("tier") || "trim") as PackTier;
  const fmt = (u.searchParams.get("fmt") || "md") === "json" ? "json" : "md";

  if (tier === "full") {
    return NextResponse.json(
      { error: "Full packs open with sign-in — coming soon. Copy or download the free trim pack for now." },
      { status: 403, headers: { "x-robots-tag": "noindex" } }
    );
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await db.rpc("film_context_pack_trim", { p_slug: slug });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { "x-robots-tag": "noindex" } });
  }
  // RPC returns NULL for non-Tier-1 / missing slugs → 404 (no empty packs, §10-7).
  if (!data) {
    return NextResponse.json({ error: "No context pack for this film." }, { status: 404, headers: { "x-robots-tag": "noindex" } });
  }

  const pack = data as FilmPack;
  const headers: Record<string, string> = {
    "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    "x-robots-tag": "noindex",
  };

  if (fmt === "json") {
    return NextResponse.json(pack, { headers });
  }
  return new NextResponse(renderPackMarkdown(pack), {
    headers: { ...headers, "content-type": "text/markdown; charset=utf-8" },
  });
}
