import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";

/**
 * The wire — the full, browsable log of what the Now Playing desk watched
 * hour by hour: every spike it reviewed and valued, whether or not it became
 * a piece. These entries also accrue under each film and director.
 * Shell = app/now/layout.tsx. Spec: hourly/pipeline/stream.py.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "The wire — everything the Now Playing desk watched",
  description:
    "The hourly log of the Metatake Now Playing desk: every film-and-culture spike it reviewed and judged worth a note, with the archive's read on each.",
  alternates: { canonical: "/now/wire" },
  robots: { index: false, follow: true }, // a log, not an indexable article set
};

type WireRow = {
  at: string; keyword: string; title: string | null; url: string | null;
  outlet: string | null; region: string | null; news_date: string | null;
  anchor_type: string | null; anchor_slug: string | null; anchor_label: string | null;
  film_slug: string | null; director_slug: string | null;
  value_point: string | null; published: boolean; piece_slug: string | null;
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

function anchorHref(r: WireRow): string | null {
  if (r.anchor_type === "film" && r.film_slug) return `/film/${r.film_slug}`;
  if ((r.anchor_type === "person" || r.anchor_type === "director") && r.director_slug) return `/director/${r.director_slug}`;
  if (r.anchor_type === "theorist" && r.anchor_slug) return `/theorist/${r.anchor_slug}`;
  if (r.film_slug) return `/film/${r.film_slug}`;
  if (r.director_slug) return `/director/${r.director_slug}`;
  return null;
}

export default async function WirePage() {
  let rows: WireRow[] = [];
  try {
    const { data } = await db()
      .from("now_stream")
      .select("at, keyword, title, url, outlet, region, news_date, anchor_type, anchor_slug, anchor_label, film_slug, director_slug, value_point, published, piece_slug")
      .order("at", { ascending: false })
      .limit(200)
      .abortSignal(AbortSignal.timeout(4500));
    rows = (data as WireRow[] | null) ?? [];
  } catch {
    rows = [];
  }

  const groups: { day: string; rows: WireRow[] }[] = [];
  for (const r of rows) {
    const day = dayOf(r.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(r);
    else groups.push({ day, rows: [r] });
  }

  return (
    <div className="cur-wrap" style={{ maxWidth: 900 }}>
      <header className="cur-head" style={{ paddingTop: 30 }}>
        <div className="now-live"><span className="dot" />The wire</div>
        <h1 style={{ marginTop: 10 }}>Everything the desk watched</h1>
        <p className="dek">
          Hour by hour, the Now Playing desk reads the wire for film and culture. This is the full log — every
          spike it reviewed and judged worth a note, with the archive&apos;s read on each. The ones it wrote up in
          full are marked. These also accrue under each film and filmmaker.
        </p>
        <p className="cur-edby">
          <Link href="/now">← Now Playing, live</Link>
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="cur-edby" style={{ padding: "30px 0 60px" }}>
          The wire is quiet so far. <Link href="/now">See the latest pieces</Link>.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.day}>
            <div className="now-wire-head" style={{ marginTop: 30 }}>{g.day}</div>
            <ul className="now-wire">
              {g.rows.map((r, i) => {
                const href = anchorHref(r);
                return (
                  <li key={i}>
                    <div className="w-meta">
                      {timeOf(r.at)} UTC
                      {[r.region, r.news_date, r.outlet].filter(Boolean).length ? " · " : ""}
                      {[r.region, r.news_date, r.outlet].filter(Boolean).join(" · ")}
                    </div>
                    <div className="w-t">
                      {r.published && r.piece_slug ? (
                        <Link href={`/now/${r.piece_slug}`}>{r.title || r.keyword}</Link>
                      ) : r.url ? (
                        <a href={r.url} target="_blank" rel="noopener nofollow">{r.title || r.keyword}</a>
                      ) : (
                        r.title || r.keyword
                      )}
                      {r.published ? <span className="w-badge">We wrote it</span> : null}
                    </div>
                    {r.value_point ? <div className="w-v">{r.value_point}</div> : null}
                    {href && r.anchor_label ? (
                      <div className="w-anchor">In the archive: <Link href={href}>{r.anchor_label}</Link></div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <div className="cur-foot" style={{ display: "flex", gap: 22, marginTop: 30 }}>
        <Link href="/now">← Now Playing, live</Link>
        <Link href="/blog">The Daily →</Link>
      </div>
    </div>
  );
}
