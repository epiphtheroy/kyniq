import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/home2/Nav";
import SiteFooter from "@/components/home2/SiteFooter";
import ConceptSubnav from "@/components/home2/ConceptSubnav";
import ConceptMap from "@/components/home2/ConceptMap";
import { posterUrl, hashTone, tone, initials } from "@/components/home2/helpers";
import { PLACEHOLDER } from "@/lib/home2";
import "@/app/home2.css";
import "@/app/concept-detail.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props { params: Promise<{ slug: string }> }

type Trope = { title: string; slug: string; film_count: number | null; takes_here: number };
type FilmRow = { title: string; year: number | null; director: string | null; slug: string; poster: string | null; via: string | null; figureSlug: string | null; takeTitle: string | null };
type Related = { name: string; native: string | null; slug: string; n: number };
type Detail = {
  slug: string; name: string; native: string | null;
  stats: { films: number; readings: number; tropes: number };
  theorist: { name: string; slug: string } | null;
  tropes: Trope[]; films: FilmRow[]; related: Related[];
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: (i: RequestInfo | URL, init?: RequestInit) => fetch(i, { ...init, cache: "no-store" }) },
  });
}

async function load(slug: string): Promise<Detail | null> {
  const { data } = await db().rpc("concept_detail", { p_slug: slug });
  return (data as Detail | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "Concept — Metatake" };
  return {
    title: `${d.name} in film — the concept, the tropes, the movies`,
    description: `${d.name}${d.native ? ` (${d.native})` : ""} in cinema: ${d.stats.films} films read through it, across ${d.stats.tropes} tropes${d.theorist ? `, after ${d.theorist.name}` : ""}.`,
    alternates: { canonical: `/idea/${d.slug}` },
  };
}

export default async function ConceptDetail({ params }: Props) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();

  const { name, native, stats, theorist, tropes, films, related } = d;
  const navStats = PLACEHOLDER.stats;

  return (
    <div className="mthome">
      <Nav data={{ ...PLACEHOLDER, stats: navStats }} />

      {/* MASTHEAD */}
      <div className="masthead">
        <div className="mast-bg" />
        <div className="wrap">
          <div className="crumb"><Link href="/idea">Concepts</Link></div>
          <div className="clabel">Concept · The theory</div>
          <h1 className="ctitle">{name}</h1>
          {native ? <div className="cnative">{native}</div> : null}
          <div className="cgloss">
            A critical idea borrowed from theory and over-read onto cinema — the vocabulary critics actually use, mapped onto the movies that show it.
          </div>
          <div className="statstrip">
            <div className="s"><div className="v">{stats.films.toLocaleString()}</div><div className="k">Films</div></div>
            <div className="s"><div className="v">{stats.readings.toLocaleString()}</div><div className="k">Readings</div></div>
            <div className="s"><div className="v">{stats.tropes.toLocaleString()}</div><div className="k">Tropes</div></div>
          </div>
          {theorist ? (
            <div className="theorline">After <Link href={`/theorist/${theorist.slug}`}>{theorist.name}</Link></div>
          ) : null}
          <div className="mcta">
            <a className="b ghost" href="#map">⌖ Open the map</a>
            <Link className="b primary" href="#films">Browse the films →</Link>
          </div>
        </div>
      </div>

      <ConceptSubnav />

      {/* DEFINITION */}
      <section className="band" id="definition"><div className="wrap">
        <div className="shead"><div><span className="kicker">The idea</span><h2 style={{ marginTop: 8 }}>What &ldquo;{name}&rdquo; means</h2></div></div>
        <div className="essay">
          <p className="drop">
            <em>{name}</em>{native ? <> (<em>{native}</em>)</> : null} is a critical concept — an idea borrowed from theory and pressed, on purpose, onto cinema.
            metatake gathers the films where a critic has read exactly this movement and maps them onto the figures, tropes and theorists that carry it.
          </p>
          <p>
            Across <strong>{stats.films.toLocaleString()} films</strong> and <strong>{stats.tropes.toLocaleString()} recurring tropes</strong>, {name} keeps returning to the screen
            {theorist ? <> — a lens metatake traces back to <Link href={`/theorist/${theorist.slug}`}>{theorist.name}</Link></> : null}.
            {" "}<em>The vocabulary critics actually use, mapped onto the movies that show it.</em>
          </p>
          <p className="note">○ A critical concept — a tool for reading, not a verdict. The readings below over-read on purpose.</p>
        </div>
      </div></section>

      {/* TROPES */}
      {tropes.length ? (
        <section className="band p2" id="tropes"><div className="wrap">
          <div className="shead"><div><h2>Tropes built on it</h2><div className="sub">The recurring figure-types that instantiate this concept — count = films sharing the trope across metatake</div></div><Link className="seeall" href="/tropes">All tropes →</Link></div>
          <div className="tropelist">
            {tropes.map((t, i) => (
              <Link className={`troperow${i === 0 ? " primary" : ""}`} href={t.slug ? `/trope/${t.slug}` : "/tropes"} key={t.slug || i}>
                <div><div className="tn">{t.title}</div>{i === 0 ? <div className="tv">the keystone trope of this concept</div> : null}</div>
                <span className="cnt">{t.film_count ?? t.takes_here}</span>
              </Link>
            ))}
          </div>
        </div></section>
      ) : null}

      {/* FILMS */}
      <section className="band" id="films"><div className="wrap">
        <div className="shead"><div><h2>Films that embody it</h2><div className="sub">Where a critic read this concept — via = the figure that carries it · → opens that reading</div></div><Link className="seeall" href={`/search?q=${encodeURIComponent(name)}`}>See all {stats.films.toLocaleString()} films →</Link></div>
        <div className="filmgrid">
          {films.map((f) => {
            const url = posterUrl(f.poster);
            const href = f.figureSlug ? `/film/${f.slug}/figure/${f.figureSlug}` : `/film/${f.slug}`;
            return (
              <Link className="fcard" href={href} key={f.slug}>
                <div className="pp" style={{ background: tone(hashTone(f.slug)) }}>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                  <span className="add">＋</span>
                </div>
                <div className="ft">{f.title} <span className="yr">{f.year ?? ""}</span></div>
                <div className="fd">{f.director ?? ""}</div>
                {f.via ? <div className="via">via {f.via}</div> : null}
                <div className="read">→ reading</div>
              </Link>
            );
          })}
        </div>
      </div></section>

      {/* THEORIST */}
      {theorist ? (
        <section className="band p2" id="theorist"><div className="wrap">
          <div className="shead"><div><h2>The theorist</h2><div className="sub">Whose idea this is — the figure metatake credits as the concept&apos;s source</div></div></div>
          <div className="theorist">
            <div className="av"><div className="ti">{initials(theorist.name)}</div></div>
            <div>
              <div className="tk">Theorist</div>
              <div className="tn">{theorist.name}</div>
              <div className="tb">The thinker metatake reads this concept <em>through</em>. Open the theorist to see every film read in their light — and the other ideas they think.</div>
              <Link className="topen" href={`/theorist/${theorist.slug}`}>Open {theorist.name} →</Link>
            </div>
          </div>
        </div></section>
      ) : null}

      {/* CONNECTION MAP */}
      <section className="band dark" id="map"><div className="wrap">
        <div className="shead"><div><h2>The map of {name}</h2><div className="sub">The concept at the centre, the films and tropes that reach it around the ring</div></div></div>
        <div className="graphbox" style={{ height: "auto", minHeight: 420, paddingTop: 44 }}>
          <div className="gcap">Connection map · live</div>
          <div className="gsub">Built from shared readings — drag a node, click to travel in</div>
          <ConceptMap name={name} films={films.map((f) => ({ title: f.title, slug: f.slug }))} tropes={tropes.map((t) => ({ title: t.title, slug: t.slug }))} />
        </div>
      </div></section>

      {/* RELATED */}
      {related.length ? (
        <section className="band" id="related"><div className="wrap">
          <div className="shead"><div><h2>Related concepts</h2><div className="sub">Neighbouring critical ideas — by the films they share with this one · count = shared films</div></div><Link className="seeall" href="/idea">All concepts →</Link></div>
          <div className="archchips">
            {related.map((r) => (
              <Link className="c" href={`/idea/${r.slug}`} key={r.slug}>
                {r.name}{r.native ? <span className="nat">({r.native})</span> : null} <span className="b">{r.n}</span>
              </Link>
            ))}
          </div>
          <div className="prov">Concept page assembled by the metatake editorial method · concept <b>{d.slug}</b> · readings are AI-found, criticism by design.</div>
        </div></section>
      ) : null}

      <SiteFooter />
    </div>
  );
}
