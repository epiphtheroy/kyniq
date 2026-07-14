import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import SearchTypeahead from "@/components/SearchTypeahead";
import WhereToWatchLanding, { type WtwFilm } from "@/components/WhereToWatchLanding";
import accessEnrichment from "@/lib/access_enrichment.json";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/where-to-watch" },
  title: "Where to watch — find any film's streaming, rental, disc & subtitles",
  description:
    "Search any film and see where to watch it — streaming, rent and buy by country (via JustWatch & TMDB), plus MetaTake-verified free archives, MUBI country differences, disc editions and subtitle links.",
};

type Rec = {
  title: string; year: number | null;
  free_sources?: { platform: string; scope: string }[];
};

function teaser(rec: Rec): string {
  const fs = rec.free_sources ?? [];
  const ww = fs.find((s) => s.scope === "worldwide");
  if (ww) return `Free worldwide · ${ww.platform.split(" (")[0]}`;
  if (fs.length) return `Free · ${fs[0].platform.split(" (")[0]}`;
  return "Streaming, rent, disc & subtitles";
}

async function wellFilledFilms(): Promise<WtwFilm[]> {
  const films = (accessEnrichment as unknown as { films: Record<string, Rec> }).films;
  const ids = Object.keys(films).map(Number).filter(Boolean);
  if (!ids.length) return [];
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await db.from("films").select("tmdb_id,slug,title,year,poster_path,director").in("tmdb_id", ids);
    const rows = (data as { tmdb_id: number; slug: string; title: string; year: number | null; poster_path: string | null; director: string | null }[] | null) ?? [];
    return rows
      .filter((r) => r.slug)
      .map((r) => ({
        slug: r.slug, title: r.title, year: r.year, director: r.director, poster_path: r.poster_path,
        teaser: teaser(films[String(r.tmdb_id)]),
      }));
  } catch {
    return [];
  }
}

export default async function WhereToWatchPage() {
  const films = await wellFilledFilms();
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">Where to watch</h1>
        <p className="lh-def">
          Search any film to see where you can watch it — streaming, rent and buy by country
          (via JustWatch &amp; TMDB), plus MetaTake-verified free archives, MUBI country
          differences, disc editions and subtitle links. Start typing a title or director.
        </p>
        <div style={{ maxWidth: "560px", margin: "18px 0 6px" }}>
          <SearchTypeahead autoFocus filmPath="/whereto/{slug}" />
        </div>

        <WhereToWatchLanding films={films} />

        <p className="df-src">
          Every film page ends with a <b>Where&nbsp;to&nbsp;watch</b> tab. Streaming availability
          provided by JustWatch · TMDB; free-archive, disc and subtitle sources are verified by MetaTake.
        </p>
      </div>
    </div>
  );
}
