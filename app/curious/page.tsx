import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import { DESKS, DESK_KEYS, mdToPlain, type DeskKey } from "@/lib/desks";
import { Card, SectionHead, monDate, thumbUrl, type FilmArt } from "@/components/curious/ui";

/**
 * Curious — the Metatake question desk, a standalone section (split out of
 * /blog 2026-07-07; /blog/curious 308s here). ScreenRant-style front page
 * (2026-07-07 redesign): featured hero + latest rail, one card-row section
 * per desk, and the full by-film question index for crawlability. Reading
 * happens on the film-scoped pages (/film/[slug]/q/[qslug],
 * /film/[slug]/[desk] — the canonical surfaces).
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Curious — questions the films keep raising · Metatake",
  description:
    "The Metatake question desk: what actually happens at the end, what the recurring image means, why a character does what they do — answered in full, film by film.",
  alternates: { canonical: "/curious" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type QRow = {
  slug: string; title: string; display_title: string | null; title_spoiler: boolean | null;
  spoiler_level: string | null; question_type: string | null; published_at: string | null;
  film: FilmArt;
};

type ERow = {
  mode: string; title: string; spoiler_level: number | null; published_at: string | null; created_at: string;
  film: FilmArt;
};

const FILM_ART = "film:films!inner(slug, title, year, poster_path, backdrop_path, visible)";
const qTitle = (q: QRow) => ((q.title_spoiler && q.display_title) ? q.display_title : q.title);

export default async function CuriousIndex() {
  const supabase = db();

  let questions: QRow[] = [];
  const deskRows: Partial<Record<DeskKey, ERow[]>> = {};
  const deskCounts: Record<string, number> = {};
  try {
    const [qRes, ...deskRes] = await Promise.all([
      supabase
        .from("questions")
        .select(`slug, title, display_title, title_spoiler, spoiler_level, question_type, published_at, ${FILM_ART}`)
        .eq("status", "published")
        .eq("film.visible", true)
        .order("published_at", { ascending: false })
        .limit(400)
        .abortSignal(AbortSignal.timeout(4500)),
      ...DESK_KEYS.map((k) =>
        supabase
          .from("essays")
          .select(`mode, title, spoiler_level, published_at, created_at, ${FILM_ART}`, { count: "exact" })
          .eq("mode", DESKS[k].mode)
          .eq("lang", "en")
          .eq("status", "verified")
          .eq("film.visible", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(5)
          .abortSignal(AbortSignal.timeout(4500))
      ),
    ]);
    questions = (qRes.data ?? []) as unknown as QRow[];
    DESK_KEYS.forEach((k, i) => {
      deskRows[k] = (deskRes[i].data ?? []) as unknown as ERow[];
      deskCounts[k] = deskRes[i].count ?? 0;
    });
  } catch {
    /* every block below degrades to empty */
  }

  // Featured hero: newest question with real art; the rail takes the next six.
  const heroIdx = questions.findIndex((q) => q.film.backdrop_path || q.film.poster_path);
  const hero = heroIdx >= 0 ? questions[heroIdx] : questions[0] ?? null;
  const rail = questions.filter((q) => q !== hero).slice(0, 6);
  const essayTotal = Object.values(deskCounts).reduce((a, b) => a + b, 0);

  // Full question index, grouped by film (films ordered by newest question).
  const byFilm = new Map<string, { film: QRow["film"]; items: QRow[] }>();
  for (const r of questions) {
    const g = byFilm.get(r.film.slug) ?? { film: r.film, items: [] };
    g.items.push(r);
    byFilm.set(r.film.slug, g);
  }
  const groups = [...byFilm.values()];

  return (
    <>
    <div className="cur-wrap">
      <header className="cur-head">
        <h1>Curious<span className="q">?</span></h1>
        <p className="dek">
          The questions viewers actually ask after the credits — answered in full, then fact-checked.
          Alongside them: the desk essays from <Link href="/engine-room">The Engine Room</Link>.
          Spoiler-heavy titles are masked until you click.
        </p>
      </header>

      {hero ? (
        <div className="cur-herogrid">
          <Link className="cur-feat" href={`/film/${hero.film.slug}/q/${hero.slug}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumbUrl(hero.film, "w780") ? <img src={thumbUrl(hero.film, "w780")!} alt="" width={780} height={439} /> : null}
            <div className="ov">
              <span className="tag">{hero.question_type ?? "question"}</span>
              <h2>{qTitle(hero)}</h2>
              <span className="by">
                {hero.film.title}{hero.film.year ? ` (${hero.film.year})` : ""}
                {hero.published_at ? ` · ${monDate(hero.published_at)}` : ""}
              </span>
            </div>
          </Link>
          <aside className="cur-latest">
            <div className="cur-latest__hd"><span>Latest</span></div>
            {rail.map((q) => (
              <Link className="cur-latest__item" key={q.slug} href={`/film/${q.film.slug}/q/${q.slug}`}>
                <div className="dt">{q.published_at ? monDate(q.published_at) : q.question_type ?? "question"}</div>
                <h3>{qTitle(q)}</h3>
                <div className="fm">{q.film.title}{q.film.year ? ` (${q.film.year})` : ""}</div>
              </Link>
            ))}
          </aside>
        </div>
      ) : null}

      {DESK_KEYS.filter((k) => (deskRows[k]?.length ?? 0) > 0).map((k) => (
        <section key={k}>
          <SectionHead
            title={k === "reception-story" ? "Reception Stories" : DESKS[k].label}
            count={`${(deskCounts[k] ?? 0).toLocaleString()} films`}
            moreHref={`/curious/${k}`}
          />
          <div className="cur-grid">
            {deskRows[k]!.map((e, i) => (
              <Card
                key={`${e.film.slug}-${i}`}
                href={`/film/${e.film.slug}/${k}`}
                film={e.film}
                title={mdToPlain(e.title)}
                tag={DESKS[k].label}
                date={e.published_at ?? e.created_at}
                spoilerNote={(e.spoiler_level ?? 0) >= 2}
              />
            ))}
          </div>
        </section>
      ))}

      <section>
        <SectionHead title="All Questions" count={`${questions.length} answered · ${groups.length} films`} />
        <div className="cur-qindex">
          {groups.map((g) => (
            <div className="cur-qindex__film" key={g.film.slug}>
              <Link href={`/film/${g.film.slug}`}>
                {g.film.title}
                {g.film.year ? <span className="yr">({g.film.year})</span> : null}
              </Link>
              <ul>
                {g.items.map((q) => (
                  <li key={q.slug}>
                    <Link href={`/film/${g.film.slug}/q/${q.slug}`}>
                      {qTitle(q)}
                      <span className="m">
                        {" "}· {q.question_type ?? "question"}
                        {q.spoiler_level === "major" ? " · discusses the ending" : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="cur-foot">
        <Link href="/blog">← Between Film and the World — Metatake&apos;s daily</Link>
        {essayTotal > 0 ? (
          <span style={{ color: "#8f8d8e", fontSize: 13 }}>
            {" "}· {essayTotal.toLocaleString()} desk essays, every one fact-checked at{" "}
            <Link href="/engine-room" style={{ display: "inline" }}>The Engine Room</Link>
          </span>
        ) : null}
      </div>

    </div>

    <div className="cur-band">
      <div className="cur-band__in">
        <p className="k">Subscribe — it&apos;s free</p>
        <h3>New questions, new answers.</h3>
        <p>The daily edition plus the question desk&apos;s best, in your inbox. No spam, unsubscribe anytime.</p>
        <SubscribeForm source="curious-hero" />
        <p className="fine">We&apos;ll only ever email you the edition.</p>
      </div>
    </div>
    </>
  );
}
