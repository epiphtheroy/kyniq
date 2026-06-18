import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import SubscribeForm from "@/components/SubscribeForm";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Between Film and the World — the Metatake blog",
  description:
    "Metatake's daily: five things that happened, and the films that already knew. The day's events read for the figure underneath — every film and reading confirmed in the live corpus.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const W342 = "https://image.tmdb.org/t/p/w342";
type Entry = { rank: number; ehead: string; event: string; film_title: string; film_slug: string; film_year: number | null; stars: number; bd: string | null };
type Post = { slug: string; title: string; edition_date: string; dek: string | null; read_min: number; entries: Entry[]; floor: { html: string }[] };

const full = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const mon = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const wdyr = (d: string) => { const dt = new Date(d + "T00:00:00"); return dt.toLocaleDateString("en-US", { weekday: "long" }) + ", " + dt.getFullYear(); };

function Stars({ n }: { n: number }) {
  const f = Math.max(0, Math.min(5, n));
  return <span className="st">{"★".repeat(f)}{f < 5 ? <span className="o">{"★".repeat(5 - f)}</span> : null}</span>;
}

export default async function BlogIndex() {
  const supabase = db();
  const { data } = await supabase.from("posts").select("slug, title, edition_date, dek, read_min, entries, floor").eq("status", "published").order("edition_date", { ascending: false }).limit(20);
  const posts = (data as Post[] | null) ?? [];
  const today = posts[0];
  const recent = posts.slice(1);
  const proofFilms = today ? today.entries.slice(0, 3).map((e) => e.film_title) : [];

  return (
    <div className="mt">
      <MetatakeNav active="blog" />
      <div className="blg">
        <section className="blg-hero">
          <div className="blg-wrap blg-hero__grid">
            <div>
              <p className="blg-kick"><span className="dot" /> The metatake blog</p>
              <h1>Between Film<br />and the <span className="red">World</span></h1>
              <p className="dek">Metatake&apos;s daily — five things that happened, and the films that already knew.</p>
              <p className="intro">Every morning we read the wire the way we read a film: looking for the figure underneath. Each edition links the day&apos;s events to a film and a reading — and <b>every one is confirmed in the live corpus before we publish it.</b> Retrieved, not remembered.</p>
            </div>
            <aside className="blg-subcard">
              <p className="sk">Subscribe — it&apos;s free</p>
              <h2>The day&apos;s news, read as cinema.</h2>
              <p>One short edition, almost every morning. Five events, five films, in your inbox.</p>
              <SubscribeForm source="blog-hero" />
              <p className="fine">No spam. Unsubscribe anytime.</p>
              {proofFilms.length > 0 && <p className="proof">Today&apos;s edition links to {proofFilms.map((f, i) => <span key={i}>{i > 0 ? (i === proofFilms.length - 1 ? " and " : ", ") : ""}<b>{f}</b></span>)} and more — all live in the map.</p>}
            </aside>
          </div>
        </section>

        {today && (
          <section className="blg-sec">
            <div className="blg-wrap">
              <div className="blg-sechd"><h3>Today&apos;s edition</h3><span className="when">{full(today.edition_date)}</span></div>
              <div className="blg-feat">
                <div className="blg-feat__top"><span className="lbl">Between Film and the World</span><span className="ttl">Five rhymes</span><span className="date">{mon(today.edition_date)} · {today.read_min} min</span></div>
                <div className="blg-rhymes">
                  {today.entries.map((e) => (
                    <Link className="blg-rh" key={e.rank} href={`/blog/${today.slug}`}>
                      <span className="rk">{e.rank}</span>
                      <span className="th">{e.bd && <img src={`${W342}${e.bd}`} alt="" loading="lazy" />}</span>
                      <span><span className="ev">{e.ehead}</span><span className="mp">{e.event} → <span className="fm">{e.film_title}</span> <Stars n={e.stars} /></span></span>
                    </Link>
                  ))}
                  {today.floor?.length > 0 && (
                    <div className="blg-rh" style={{ opacity: 0.55 }}>
                      <span className="rk" style={{ color: "var(--hairline-2)" }}>—</span>
                      <span className="th" style={{ background: "repeating-linear-gradient(45deg,#eceae3,#eceae3 7px,#f6f5f0 7px,#f6f5f0 14px)", borderStyle: "dashed" }} />
                      <span><span className="ev" style={{ color: "var(--muted)" }}>On the cutting-room floor</span><span className="mp">{today.floor.length} stories · big news, weak rhyme — cut</span></span>
                    </div>
                  )}
                </div>
                <div className="blg-feat__cta"><Link href={`/blog/${today.slug}`}>Read today&apos;s edition →</Link><span className="note">Every film &amp; reading confirmed in the live database.</span></div>
              </div>
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section className="blg-sec">
            <div className="blg-wrap">
              <div className="blg-sechd"><h3>Recent editions</h3></div>
              {recent.map((p) => (
                <Link className="blg-edrow" key={p.slug} href={`/blog/${p.slug}`}>
                  <div className="d"><b>{mon(p.edition_date)}</b>{wdyr(p.edition_date)}</div>
                  <div>
                    <div className="strip">{p.entries.slice(0, 5).map((e, i) => <span key={i}>{e.bd && <img src={`${W342}${e.bd}`} alt="" loading="lazy" />}</span>)}</div>
                    {p.dek && <div className="lead">{p.dek}</div>}
                  </div>
                  <span className="go">Read →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="blg-band">
          <div className="blg-band__in">
            <p className="sk">Don&apos;t miss tomorrow&apos;s</p>
            <h3>One edition, almost every morning.</h3>
            <p>Free. Five events and the films that already knew them — retrieved from the live corpus, not remembered.</p>
            <SubscribeForm source="blog-band" />
            <p className="fine">No spam. Unsubscribe anytime.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
