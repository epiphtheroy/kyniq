/**
 * /api/navigator/lists — the "Where to?" picker's film→lists lookup.
 *
 * GET /api/navigator/lists?q=<film title>
 *   1. Search visible films by title (ilike, top ~6).
 *   2. film_lineage_for() the top match(es) → the lineages that film belongs to.
 *   3. Dedupe by list slug and attach each list's official size.
 *
 * Returns { films:[{slug,title,year}], lists:[{slug,label,facet,film_count}] }.
 * The picker links each list into the Navigator drive (?lineage=<slug>).
 *
 * Public + auth-optional: uses the service-role client (same as /api/search) to
 * read public data (films, film_lineage_for, lineage_lists) off any RLS path.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FilmRow = { id: string; slug: string; title: string; year: number | null };
type LinRow = { facet: string; list_slug: string; list_label: string };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ films: [], lists: [] });

  const db = createAdminClient();
  // Escape PostgREST ilike wildcards so a literal % / _ in the query can't widen it.
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

  const { data: filmRows } = await db
    .from("films")
    .select("id, slug, title, year")
    .ilike("title", like)
    .eq("visible", true)
    .order("year", { ascending: false, nullsFirst: false })
    .limit(6);
  const films = (filmRows ?? []) as FilmRow[];
  if (!films.length) return NextResponse.json({ films: [], lists: [] });

  // Lists of the top match(es), deduped by list slug (first label/facet wins).
  const top = films.slice(0, 2);
  const listMap = new Map<string, { slug: string; label: string; facet: string }>();
  await Promise.all(
    top.map(async (f) => {
      const { data } = await db.rpc("film_lineage_for", { p_film_id: f.id });
      for (const r of ((data ?? []) as LinRow[])) {
        if (r.list_slug && !listMap.has(r.list_slug)) {
          listMap.set(r.list_slug, { slug: r.list_slug, label: r.list_label, facet: r.facet });
        }
      }
    }),
  );

  // Attach each list's official size (lineage_lists.film_count).
  const slugs = [...listMap.keys()];
  const counts = new Map<string, number>();
  if (slugs.length) {
    const { data: ll } = await db.from("lineage_lists").select("slug, film_count").in("slug", slugs);
    for (const r of ((ll ?? []) as { slug: string; film_count: number | null }[])) {
      counts.set(r.slug, Number(r.film_count ?? 0));
    }
  }
  const lists = [...listMap.values()].map((l) => ({ ...l, film_count: counts.get(l.slug) ?? 0 }));

  return NextResponse.json(
    { films: films.map((f) => ({ slug: f.slug, title: f.title, year: f.year })), lists },
    { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
  );
}
