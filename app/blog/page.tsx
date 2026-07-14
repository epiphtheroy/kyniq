import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import EditionBody, { type EditionPost } from "@/components/EditionBody";
import MethodologyBadge from "@/components/MethodologyBadge";
import { SectionHead } from "@/components/curious/ui";

/**
 * The Daily front page — ScreenRant grain (2026-07-07 redesign, shell in
 * app/blog/layout.tsx). Today's edition leads with ITS OWN headline
 * (posts.title, recipe lever 5) over the lead item's backdrop; the date is
 * the kicker everywhere. Past editions are date-block rows. The edition
 * body itself keeps the print look on a paper sheet.
 */
export const revalidate = 120;

export const metadata: Metadata = {
  title: { absolute: "Between Film and the World — Metatake's daily" },
  description:
    "Metatake's daily: five things that happened, and the films that already knew. The day's events read for the figure underneath — every film and reading confirmed in the live corpus.",
  alternates: { canonical: "/blog" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const W780 = "https://image.tmdb.org/t/p/w780";
const W342 = "https://image.tmdb.org/t/p/w342";
type Post = EditionPost & { title: string; edition_date: string; dek: string | null; read_min: number };

const full = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const wk = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
const mon = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const yr = (d: string) => new Date(d + "T00:00:00").getFullYear();
const headlineOf = (p: Post) =>
  p.title && p.title.toLowerCase() !== "between film and the world" ? p.title : `Between Film and the World · ${mon(p.edition_date)}`;

export default async function BlogIndex() {
  const supabase = db();
  // Resilient fetch: never let a slow/overloaded DB hang the build (this page is
  // statically generated; a >60s data fetch fails the whole deployment). Cap it and
  // fall back to empty — ISR refills it on the next revalidation.
  let posts: Post[] = [];
  try {
    const { data } = await supabase
      .from("posts")
      .select("slug, title, edition_date, dek, read_min, intro, entries, floor")
      .eq("status", "published")
      .order("edition_date", { ascending: false })
      .limit(20)
      .abortSignal(AbortSignal.timeout(4500));
    posts = (data as Post[] | null) ?? [];
  } catch {
    posts = [];
  }
  const today = posts[0];
  const recent = posts.slice(1);
  const heroBd = today?.entries.find((e) => e.bd)?.bd ?? null;

  return (
    <>
    <div className="cur-wrap">
      {today ? (
        <>
          <div className="cur-herogrid" style={{ marginTop: 24 }}>
            <Link className="cur-feat" href={`/blog/${today.slug}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {heroBd ? <img src={`${W780}${heroBd}`} alt="" width={780} height={439} /> : null}
              <div className="ov">
                <span className="tag">{full(today.edition_date)} · Today&apos;s edition</span>
                <h2>{headlineOf(today)}</h2>
                <span className="by">
                  {today.dek ?? "The day's news, read as cinema."} · {today.read_min} min read
                </span>
              </div>
            </Link>
            <aside className="cur-subpanel">
              <p className="k">Subscribe — it&apos;s free</p>
              <h3>The day&apos;s news, read as cinema.</h3>
              <p>One short edition, almost every morning — five events and the films that already knew them. Every film and reading confirmed in the live corpus before we send it.</p>
              <SubscribeForm source="blog-hero" />
              <p className="fine">No spam. Unsubscribe anytime.</p>
            </aside>
          </div>

          <section id="today">
            <SectionHead title="Today's edition" count={full(today.edition_date)} moreHref={`/blog/${today.slug}`} moreLabel="Permalink" />
            <article className="cur-paper blg">
              <div className="blg-byline">
                <b>{full(today.edition_date)}</b><span className="dot" /><span>{today.read_min} min read</span><span className="dot" /><span>The Metatake desk</span><span className="dot" /><Link href="/methodology/the-daily" style={{ textDecoration: "none" }}>how The Daily is made</Link><MethodologyBadge href="/methodology/the-daily" label="How The Daily is made — methodology" />
              </div>
              <EditionBody post={today} />
            </article>
          </section>
        </>
      ) : null}

      {recent.length > 0 ? (
        <section>
          <SectionHead title="Past editions" count={`${recent.length} editions`} />
          {recent.map((p) => (
            <Link className="cur-edrow" key={p.slug} href={`/blog/${p.slug}`}>
              <span className="db">
                <span className="m">{mon(p.edition_date)}</span>
                <span className="y">{wk(p.edition_date)} · {yr(p.edition_date)}</span>
              </span>
              <span>
                <h3>{headlineOf(p)}</h3>
                {p.dek ? <div className="dk">{p.dek}</div> : null}
                <span className="strip">
                  {p.entries.slice(0, 5).map((e, i) => (
                    <span key={i}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {e.bd ? <img src={`${W342}${e.bd}`} alt="" loading="lazy" /> : null}
                    </span>
                  ))}
                </span>
              </span>
              <span className="go">Read →</span>
            </Link>
          ))}
        </section>
      ) : null}

      <div className="cur-foot">
        <Link href="/curious">Curious — the question desk →</Link>
      </div>
    </div>

    <div className="cur-band">
      <div className="cur-band__in">
        <p className="k">Don&apos;t miss tomorrow&apos;s</p>
        <h3>One edition, almost every morning.</h3>
        <p>Free. Five events and the films that already knew them — retrieved from the live corpus, not remembered.</p>
        <SubscribeForm source="blog-band" />
        <p className="fine">No spam. Unsubscribe anytime.</p>
      </div>
    </div>
    </>
  );
}
