import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const IMG = "https://image.tmdb.org/t/p/w185";

type Node = { id: string; type: string; label: string; sub?: string | null; href?: string | null; center?: boolean; img?: string | null; dim?: string | null };
type Graph = { nodes: Node[]; links: unknown[] };

// Attach poster (film) / profile photo (director) + faint inline year. Done here so
// every mode (films/directors/grouped) gets images without rewriting each RPC.
async function enrich(db: ReturnType<typeof createClient>, g: Graph): Promise<Graph> {
  const nodes = g.nodes || [];
  const filmSlugs = [...new Set(nodes.filter((n) => n.id.startsWith("film:")).map((n) => n.id.slice(5)))];
  const dirSlugs = [...new Set(nodes.filter((n) => n.id.startsWith("dir:")).map((n) => n.id.slice(4)))];

  const films = new Map<string, { poster: string | null; year: number | null }>();
  const dirs = new Map<string, { profile: string | null; byear: string | null }>();

  if (filmSlugs.length) {
    const { data } = await db.from("films").select("slug, poster_path, year").in("slug", filmSlugs);
    for (const f of (data ?? []) as { slug: string; poster_path: string | null; year: number | null }[]) {
      films.set(f.slug, { poster: f.poster_path, year: f.year });
    }
  }
  if (dirSlugs.length) {
    const { data } = await db.from("directors").select("slug, profile_path, birthday").in("slug", dirSlugs);
    for (const d of (data ?? []) as { slug: string; profile_path: string | null; birthday: string | null }[]) {
      dirs.set(d.slug, { profile: d.profile_path, byear: d.birthday ? String(d.birthday).slice(0, 4) : null });
    }
  }

  for (const n of nodes) {
    if (n.id.startsWith("film:")) {
      const f = films.get(n.id.slice(5));
      if (f) { if (f.poster) n.img = `${IMG}${f.poster}`; if (f.year) n.dim = String(f.year); n.sub = null; }
    } else if (n.id.startsWith("dir:")) {
      const d = dirs.get(n.id.slice(4));
      if (d) { if (d.profile) n.img = `${IMG}${d.profile}`; if (d.byear) n.dim = d.byear; n.sub = null; }
    }
  }
  return g;
}

// GET /api/map
//   mode=films      ?key=slug | filters yr,imdb,rt   → map_film_ego / map_film_overview
//   mode=directors  ?key=slug | filter yr            → map_director_ego / map_director_overview
//   (default)       ?type=&key=&key2=                → map_ego / map_overview (grouped)
export async function GET(req: Request) {
  const u = new URL(req.url);
  const mode = u.searchParams.get("mode") || "critical";
  const key = u.searchParams.get("key");
  const key2 = u.searchParams.get("key2");
  const type = u.searchParams.get("type");
  const yr = u.searchParams.get("yr");
  const imdb = u.searchParams.get("imdb");
  const rt = u.searchParams.get("rt");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  let res;
  if (mode === "films") {
    res = key
      ? await db.rpc("map_film_ego", { p_slug: key })
      : await db.rpc("map_film_overview", {
          p_min_year: yr ? Number(yr) : null,
          p_min_imdb: imdb ? Number(imdb) : null,
          p_min_rt: rt ? Number(rt) : null,
        });
  } else if (mode === "directors") {
    res = key
      ? await db.rpc("map_director_ego", { p_slug: key })
      : await db.rpc("map_director_overview", { p_min_year: yr ? Number(yr) : null });
  } else {
    res = type && key
      ? await db.rpc("map_ego", { p_type: type, p_key: key, p_key2: key2 })
      : await db.rpc("map_overview");
  }

  if (res.error) return NextResponse.json({ error: res.error.message, nodes: [], links: [] }, { status: 500 });
  const enriched = await enrich(db, (res.data as Graph) ?? { nodes: [], links: [] });
  // Same payload for every visitor (per URL) — let the CDN carry it. Was
  // "no-store", which made every home/map view pay the live 0.5–3s query
  // (the "map is slow" report, 2026-07-11).
  return NextResponse.json(enriched, {
    headers: { "cache-control": "public, max-age=120, s-maxage=600, stale-while-revalidate=3600" },
  });
}
