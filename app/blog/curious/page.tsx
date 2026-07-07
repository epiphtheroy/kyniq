import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import SubscribeForm from "@/components/SubscribeForm";
import { DESKS, DESK_KEYS, mdToPlain, type DeskKey } from "@/lib/desks";

/**
 * Curious — the blog's question desk. Index of every published featured Q&A,
 * newest first. Reading happens on the film-scoped Q&A page (the canonical
 * surface); this page is the browsable corner + the film↔blog bridge.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Curious — questions the films keep raising · the Metatake blog",
  description:
    "The Metatake question desk: what actually happens at the end, what the recurring image means, why a character does what they do — answered in full, film by film.",
  alternates: { canonical: "/blog/curious" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type QRow = {
  slug: string; title: string; display_title: string | null; title_spoiler: boolean | null;
  spoiler_level: string | null; question_type: string | null; published_at: string | null;
  film: { slug: string; title: string; year: number | null };
};

type ERow = {
  mode: string; title: string; spoiler_level: number | null; published_at: string | null; created_at: string;
  film: { slug: string; title: string; year: number | null };
};

const mon = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function CuriousIndex() {
  const supabase = db();
  let rows: QRow[] = [];
  try {
    const { data } = await supabase
      .from("questions")
      .select("slug, title, display_title, title_spoiler, spoiler_level, question_type, published_at, film:films!inner(slug, title, year, visible)")
      .eq("status", "published")
      .eq("film.visible", true)
      .order("published_at", { ascending: false })
      .limit(400)
      .abortSignal(AbortSignal.timeout(4500));
    rows = ((data ?? []) as unknown as QRow[]);
  } catch {
    rows = [];
  }

  // Latest desk essays (canonical pages live under /film/[slug]/[desk]).
  let essays: ERow[] = [];
  const deskCounts: Record<string, number> = {};
  try {
    const { data } = await supabase
      .from("essays")
      .select("mode, title, spoiler_level, published_at, created_at, film:films!inner(slug, title, year, visible)")
      .eq("lang", "en")
      .eq("status", "verified")
      .eq("film.visible", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(120)
      .abortSignal(AbortSignal.timeout(4500));
    essays = ((data ?? []) as unknown as ERow[]);
    await Promise.all(
      DESK_KEYS.map(async (k) => {
        const { count } = await supabase
          .from("essays")
          .select("id", { count: "exact", head: true })
          .eq("mode", DESKS[k].mode)
          .eq("lang", "en")
          .eq("status", "verified");
        deskCounts[k] = count ?? 0;
      })
    );
  } catch {
    essays = [];
  }
  const modeToKey: Record<string, DeskKey> = {};
  for (const k of DESK_KEYS) modeToKey[DESKS[k].mode] = k;

  // Group by film, films ordered by their newest question.
  const byFilm = new Map<string, { film: QRow["film"]; items: QRow[] }>();
  for (const r of rows) {
    const g = byFilm.get(r.film.slug) ?? { film: r.film, items: [] };
    g.items.push(r);
    byFilm.set(r.film.slug, g);
  }
  const groups = [...byFilm.values()];

  return (
    <div className="mt">
      <SiteNav />
      <div className="blg">
        <section className="blg-hero">
          <div className="blg-wrap blg-hero__grid">
            <div>
              <p className="blg-kick"><span className="dot" /> The metatake blog · question desk</p>
              <h1>Curious<span className="red">?</span></h1>
              <p className="dek">The questions viewers actually ask after the credits — answered in full.</p>
              <p className="intro">What really happens at the end. What the recurring image means. Why she leaves without a word. Each answer opens with the answer, earns it with the scene, and lands one real insight — grounded in the readings of the live corpus. Spoiler-heavy titles are masked until you click. And alongside the questions: the desk essays — fan theories fact-checked, films decoded, receptions retold — from <Link href="/engine-room">The Engine Room</Link>.</p>
              <p className="intro" style={{ marginTop: 8 }}><Link href="/blog">← Between Film and the World (the daily)</Link></p>
            </div>
            <aside className="blg-subcard">
              <p className="sk">Subscribe — it&apos;s free</p>
              <h2>New questions, new answers.</h2>
              <p>The daily edition plus the question desk&apos;s best, in your inbox.</p>
              <SubscribeForm source="curious-hero" />
              <p className="fine">No spam. Unsubscribe anytime.</p>
            </aside>
          </div>
        </section>

        <section className="blg-sec" style={{ paddingTop: 26 }}>
          <div className="blg-wrap">
            <div className="blg-sechd"><h3>From the desks</h3><span className="when">{Object.values(deskCounts).reduce((a, b) => a + b, 0).toLocaleString()} essays</span></div>
            <p style={{ margin: "10px 0 14px", fontSize: 14 }}>
              {DESK_KEYS.filter((k) => (deskCounts[k] ?? 0) > 0).map((k, i) => (
                <span key={k}>
                  {i > 0 && <span style={{ opacity: 0.4 }}> · </span>}
                  <Link href={`/blog/curious/${k}`}>{DESKS[k].label} ({(deskCounts[k] ?? 0).toLocaleString()})</Link>
                </span>
              ))}
            </p>
            {essays.map((e, i) => {
              const k = modeToKey[e.mode];
              if (!k) return null;
              const d = e.published_at ?? e.created_at;
              return (
                <Link className="blg-edrow" key={`${e.film.slug}-${e.mode}-${i}`} href={`/film/${e.film.slug}/${k}`}>
                  <div className="d"><b>{DESKS[k].label.toLowerCase()}</b>{d ? mon(d) : ""}</div>
                  <div>
                    <div className="lead">{mdToPlain(e.title)}</div>
                    {(e.spoiler_level ?? 0) >= 2 && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>discusses the ending</div>}
                  </div>
                  <span className="go">Read →</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="blg-sec" style={{ paddingTop: 26 }}>
          <div className="blg-wrap">
            <div className="blg-sechd"><h3>All questions</h3><span className="when">{rows.length} answered · {groups.length} films</span></div>
            {groups.map((g) => (
              <div key={g.film.slug} style={{ margin: "18px 0 26px" }}>
                <div className="blg-sechd" style={{ borderBottom: "none", marginBottom: 4 }}>
                  <h3 style={{ fontSize: 17 }}>
                    <Link href={`/film/${g.film.slug}`}>{g.film.title}{g.film.year ? ` (${g.film.year})` : ""}</Link>
                  </h3>
                </div>
                {g.items.map((q) => (
                  <Link className="blg-edrow" key={q.slug} href={`/film/${g.film.slug}/q/${q.slug}`}>
                    <div className="d"><b>{q.question_type ?? "question"}</b>{q.published_at ? mon(q.published_at) : ""}</div>
                    <div>
                      <div className="lead">{(q.title_spoiler && q.display_title) ? q.display_title : q.title}</div>
                      {q.spoiler_level === "major" && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>discusses the ending</div>}
                    </div>
                    <span className="go">Read →</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
