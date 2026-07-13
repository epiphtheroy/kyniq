import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/stills?slugs=a,b,c&cap=3 — one still (backdrop preferred, poster
// fallback) per film, in the order given, for the image-first entity hero
// (StillHero). Replaces /api/tv/reel's trailer embeds on text pages so Google
// detects no video. Returns { stills: [{ slug, path, title }] }.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const slugs = (u.searchParams.get("slugs") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const cap = Math.min(Math.max(Number(u.searchParams.get("cap")) || 3, 1), 6);
  if (!slugs.length) return NextResponse.json({ stills: [] });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await db
    .from("films")
    .select("slug,title,year,backdrop_path,poster_path")
    .in("slug", slugs);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bySlug = new Map((data ?? []).map((r) => [r.slug, r] as const));
  const out: { slug: string; path: string; title: string | null; year: number | null }[] = [];
  for (const s of slugs) {
    const r = bySlug.get(s);
    const path = r?.backdrop_path || r?.poster_path;
    if (r && path) out.push({ slug: r.slug, path, title: r.title, year: r.year ?? null });
    if (out.length >= cap) break;
  }

  return NextResponse.json(
    { stills: out },
    { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
