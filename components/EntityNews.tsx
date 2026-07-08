import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import "@/app/entity-news.css";

/**
 * "In the news" — the Now Playing layer accumulating under an entity page.
 * Shows (a) published Now Playing pieces anchored on this film/director and
 * (b) wire entries we reviewed and valued but did not write (now_stream).
 * Renders nothing when the entity has no news history. Server component;
 * variant maps to the host page's design system (film df-* / director dr-*).
 */

type StreamRow = {
  at: string; keyword: string; title: string | null; url: string | null;
  outlet: string | null; region: string | null; news_date: string | null;
  value_point: string | null; published: boolean; piece_slug: string | null;
};
type PieceRow = { slug: string; headline: string; dek: string | null; published_at: string };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function EntityNews({
  filmSlug,
  directorSlug,
  variant,
}: {
  filmSlug?: string;
  directorSlug?: string;
  variant: "df" | "dr";
}) {
  const supabase = db();
  const col = filmSlug ? "film_slug" : "director_slug";
  const val = filmSlug ?? directorSlug;
  if (!val) return null;

  let stream: StreamRow[] = [];
  let pieces: PieceRow[] = [];
  try {
    const [s, p] = await Promise.all([
      supabase
        .from("now_stream")
        .select("at, keyword, title, url, outlet, region, news_date, value_point, published, piece_slug")
        .eq(col, val)
        .order("at", { ascending: false })
        .limit(8)
        .abortSignal(AbortSignal.timeout(3500)),
      supabase
        .from("now_articles")
        .select("slug, headline, dek, published_at")
        .eq("status", "published")
        .eq(filmSlug ? "film_slug" : "anchor_slug", val)
        .order("published_at", { ascending: false })
        .limit(4)
        .abortSignal(AbortSignal.timeout(3500)),
    ]);
    stream = (s.data as StreamRow[] | null) ?? [];
    pieces = (p.data as PieceRow[] | null) ?? [];
  } catch {
    return null;
  }

  // wire entries that BECAME pieces are already shown as pieces — don't repeat
  const wire = stream.filter((r) => !r.published);
  if (!wire.length && !pieces.length) return null;

  const h2Class = variant === "df" ? "df-h2" : "dr-h2";
  const secClass = variant === "df" ? "df-sec enw" : "dr-sec enw";

  return (
    <section className={secClass} id={`${variant}-in-the-news`}>
      <h2 className={h2Class}>In the news</h2>
      <p className="enw-lede">
        The <Link href="/now">Now Playing</Link> desk watches the wire hourly. What touched this{" "}
        {filmSlug ? "film" : "director"}, newest first — timestamps are the news dates, not ours.
      </p>

      {pieces.map((p) => (
        <Link className="enw-row enw-row--piece" href={`/now/${p.slug}`} key={p.slug}>
          <div className="enw-meta">
            <span className="enw-badge">Our piece</span> {day(p.published_at)}
          </div>
          <div className="enw-t">{p.headline}</div>
          {p.dek ? <div className="enw-d">{p.dek}</div> : null}
        </Link>
      ))}

      {wire.map((r, i) => (
        <div className="enw-row" key={i}>
          <div className="enw-meta">
            {[r.region, r.news_date, r.outlet].filter(Boolean).join(" · ")}
          </div>
          <div className="enw-t">
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener nofollow">{r.title || r.keyword}</a>
            ) : (
              r.title || r.keyword
            )}
          </div>
          {r.value_point ? <div className="enw-d">{r.value_point}</div> : null}
        </div>
      ))}
    </section>
  );
}
