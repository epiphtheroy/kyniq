import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import SearchBox from "@/components/SearchBox";
import Counters from "@/components/Counters";
import RandomWall, { type PoolItem } from "@/components/RandomWall";
import EntityGraphLoader from "@/components/EntityGraphLoader";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Metatake — the unconscious lines between films",
  description: "A large-scale AI project that uses embeddings to map the unconscious connections between films — and between film and the world. Wander our readings, figures, tropes and films at random.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Ex = { film: string; yr: number | null; figure: string; figslug: string; filmslug: string; takeid: string; snip: string };
type Latest = { figure: string; figslug: string; film: string; filmslug: string; takeid: string; snip: string; mt: string | null; mtslug: string | null };
type Payload = { featured: { slug: string; title: string; laconic: string | null; films: number; ex: Ex[] | null } | null; latest: Latest[] | null };
type Counts = { films: number; figures: number; takes: number; metatakes: number; tropes: number };

export default async function Home() {
  const supabase = db();
  const [{ data: p }, { data: counts }, { data: pool }] = await Promise.all([
    supabase.rpc("home_payload"),
    supabase.rpc("home_counts"),
    supabase.rpc("home_pool", { p_n: 42 }),
  ]);
  const payload = (p ?? {}) as Payload;
  const featured = payload.featured;
  const latest = payload.latest ?? [];
  const c = (counts ?? { films: 0, figures: 0, takes: 0, metatakes: 0, tropes: 0 }) as Counts;
  const items = (Array.isArray(pool) ? pool : []) as PoolItem[];

  return (
    <div className="mt">
      <MetatakeNav />
      <div className="mt-wrap">
        <h1 className="lp-h1">The unconscious lines <span className="lp-em">between films.</span></h1>
        <p className="mt-laconic" style={{ maxWidth: "66ch", margin: "8px 0 0" }}>
          A large-scale AI project that uses embeddings to map the unconscious connections between films — and between film and the world.
        </p>

        <Counters counts={c} />

        <div style={{ margin: "12px 0 4px" }}><SearchBox variant="hero" /></div>

        {featured && (
          <section className="hm-box hm-hero" style={{ marginTop: 14 }}>
            <div className="hm-kick">Reading of the moment · connects {featured.films} films</div>
            <h2 className="hm-htitle"><Link href={`/take/${featured.slug}`}>{featured.title}</Link></h2>
            {featured.laconic ? <p className="hm-lac">{featured.laconic}</p> : null}
            {featured.ex && featured.ex.length > 0 ? (
              <div className="hm-ex">
                {featured.ex.map((e) => (
                  <div key={e.takeid} className="hm-exi">
                    <div className="hm-exf"><Link href={`/film/${e.filmslug}`}>{e.film}</Link> <span className="yr">({e.yr ?? "?"})</span></div>
                    <Link className="hm-exfig" href={`/film/${e.filmslug}/figure/${e.figslug}#t-${e.takeid}`}>{e.figure}</Link>
                    <p className="hm-exs">{e.snip}…</p>
                  </div>
                ))}
              </div>
            ) : null}
            <EntityGraphLoader kind="metatake" slug={featured.slug} label={featured.title} height={420} />
          </section>
        )}

        <RandomWall initial={items} />

        {latest.length > 0 && (
          <section style={{ marginTop: 18 }}>
            <h2 className="mt-h2" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span>Just added</span>
              <Link href="/latest" style={{ fontSize: 13, fontWeight: 400 }}>more →</Link>
            </h2>
            <ul className="lt-list">
              {latest.map((t) => (
                <li key={t.takeid} className="lt-item">
                  <div className="lt-meta">
                    <Link href={`/film/${t.filmslug}/figure/${t.figslug}`} className="lt-fig">{t.figure}</Link>
                    <span className="lt-film"> · {t.film}</span>
                  </div>
                  <Link href={`/film/${t.filmslug}/figure/${t.figslug}#t-${t.takeid}`} className="lt-body">{t.snip}…</Link>
                  {t.mt && t.mtslug ? <div className="lt-hub">→ <Link href={`/take/${t.mtslug}`}>{t.mt}</Link></div> : null}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
