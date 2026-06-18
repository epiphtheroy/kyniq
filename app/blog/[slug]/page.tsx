import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import SubscribeForm from "@/components/SubscribeForm";

export const revalidate = 120;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const W500 = "https://image.tmdb.org/t/p/w500";
type Entry = { rank: number; ehead: string; event: string; film_title: string; film_slug: string; film_year: number | null; stars: number; bd: string | null; news: string; read: string; deposit: string };
type Post = { slug: string; title: string; edition_date: string; dek: string | null; read_min: number; intro: string | null; entries: Entry[]; floor: { html: string }[] };

interface Props { params: Promise<{ slug: string }>; }

const full = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const mon = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function load(slug: string) {
  const supabase = db();
  const { data } = await supabase.from("posts").select("slug, title, edition_date, dek, read_min, intro, entries, floor").eq("slug", slug).eq("status", "published").maybeSingle();
  return (data as Post | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Edition not found — metatake blog" };
  const title = `Between Film and the World · ${mon(p.edition_date)} — metatake`;
  const description = p.dek ?? undefined;
  return { title, description, openGraph: { title, ...(description ? { description } : {}), type: "article" } };
}

function Stars({ n }: { n: number }) {
  const f = Math.max(0, Math.min(5, n));
  return <span className="stars">{"★".repeat(f)}{f < 5 ? <span className="o">{"★".repeat(5 - f)}</span> : null}</span>;
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  const entries = p.entries ?? [];

  return (
    <div className="mt">
      <MetatakeNav active="blog" />
      <div className="blg">
        <div className="blg-bar">
          <div className="blg-bar__row">
            <Link className="col" href="/blog">Between Film and the <span className="red">World</span></Link>
            <span className="tag">Metatake&apos;s daily</span>
            <span className="sp" />
            <Link className="sub-btn" href="/blog/subscribe">Subscribe</Link>
          </div>
        </div>

        <article className="blg-article">
          <p className="blg-eyebrow">Metatake&apos;s daily · The wire, read as a film</p>
          <h1 className="blg-title">Between Film and the World</h1>
          {p.dek && <p className="dek">{p.dek}</p>}
          <div className="blg-byline"><b>{full(p.edition_date)}</b><span className="dot" /><span>{p.read_min} min read</span><span className="dot" /><span>The Metatake desk</span></div>
          {p.intro && <p className="intro" dangerouslySetInnerHTML={{ __html: p.intro }} />}

          <div className="blg-entries">
            {entries.map((e, i) => (
              <div key={e.rank}>
                <div className="blg-entry">
                  <div className="erank">{e.rank}</div>
                  <div className="ebody">
                    <h2 className="ehead">{e.ehead}</h2>
                    <div className="blg-emap">
                      <span className="ev">{e.event}</span><span className="ar">→</span>
                      <Link className="film" href={`/film/${e.film_slug}`}>{e.film_title}</Link>
                      <Stars n={e.stars} /><span className="rl">rhyme</span>
                    </div>
                    <p className="blg-news" dangerouslySetInnerHTML={{ __html: e.news }} />
                    <p className="blg-read" dangerouslySetInnerHTML={{ __html: e.read }} />
                    <p className="blg-deposit"><span style={{ color: "var(--accent)", fontWeight: 700, marginRight: 4 }}>→</span><span dangerouslySetInnerHTML={{ __html: e.deposit }} /></p>
                  </div>
                  <div className="blg-ethumb">
                    <Link className="pic" href={`/film/${e.film_slug}`}>{e.bd && <img src={`${W500}${e.bd}`} alt={e.film_title} loading="lazy" />}</Link>
                    <div className="cap"><b>{e.film_title}</b>{e.film_year ? ` · ${e.film_year}` : ""}</div>
                  </div>
                </div>
                {i === 1 && (
                  <div className="blg-sub-inline">
                    <div className="t">Get this every morning.<small>Between Film and the World — the day&apos;s news, read as cinema. Free, almost daily.</small></div>
                    <SubscribeForm source="blog-inline" dark />
                  </div>
                )}
              </div>
            ))}
          </div>

          {p.floor?.length > 0 && (
            <div className="blg-floor">
              <div className="blg-floor__h"><b>On the cutting-room floor</b><span>Big news, weak rhyme — so we left them.</span></div>
              <ul>
                {p.floor.map((f, i) => (
                  <li key={i}><span dangerouslySetInnerHTML={{ __html: f.html }} /> <span className="cut">Cut</span></li>
                ))}
              </ul>
            </div>
          )}

          <p className="blg-method"><b>How this was made:</b> each event was reduced to a figure, then matched against the live Metatake corpus — every film and reading above was confirmed in the database before it was linked. Each rhyme becomes a permanent edge in the map. <span className="stamp">Retrieved, not remembered.</span></p>

          <div className="blg-sub-box" id="sub">
            <p className="k">Between Film and the World</p>
            <h3>The day&apos;s news, read as cinema.</h3>
            <p>One short edition, almost every morning — five events and the films that already knew. Free. No spam, unsubscribe anytime.</p>
            <SubscribeForm source="blog-post" />
            <p className="fine">Join the readers getting the wire through cinema.</p>
          </div>

          <div className="blg-endrow">
            <Link className="wander" href="/">Wander Metatake →</Link>
            <Link className="wander" href="/blog">All editions →</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
