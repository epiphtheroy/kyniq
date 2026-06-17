import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import SearchBox from "@/components/SearchBox";
import RandomShowcase from "@/components/RandomShowcase";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Metatake — the unconscious lines between films",
  description: "A large-scale AI project that uses embeddings to map the unconscious connections between films — and between film and the world. Read films closely, then follow the thread.",
};

const REG: Record<string, [string, string]> = {
  formal: ["Formal", "#5B8FB9"], semiotic: ["Semiotic", "#B8860B"],
  psychoanalytic: ["Psychoanalytic", "#A8434F"], ideological: ["Ideological", "#C0392B"],
  politico_economic: ["Politico-economic", "#2E7D5B"], philosophical: ["Philosophical", "#7E57C2"],
  existential: ["Existential", "#546E7A"], mythic: ["Mythic", "#A9743B"],
  genealogical: ["Film-historical", "#2E86C1"], reception: ["Reception", "#159A8A"],
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function Home() {
  const supabase = db();
  const [{ data: mts }, { data: counts }, { data: figs }, { data: recentRaw }, { data: tropesRaw }] = await Promise.all([
    supabase.from("meta_takes").select("id, slug, title, laconic").eq("status", "published").eq("kind", "reading"),
    supabase.from("meta_take_film_counts").select("meta_take_id, film_count"),
    supabase.from("figures").select("slug, label, film:films!inner(slug, title)")
      .not("slug", "is", null).eq("status", "approved").limit(8),
    supabase.from("takes")
      .select("id, rationale, register, figure:figures!inner(label, slug, film:films!inner(title, slug)), meta_take:meta_takes(title, slug, status)")
      .eq("status", "published").order("created_at", { ascending: false }).limit(5),
    supabase.from("trope_counts").select("slug, title, laconic, figures, films"),
  ]);
  const enriched = (figs ?? []) as unknown as { slug: string; label: string; film: { slug: string; title: string } }[];
  const recent = (recentRaw as unknown as {
    id: string; rationale: string; register: string | null;
    figure: { label: string; slug: string; film: { title: string; slug: string } };
    meta_take: { title: string; slug: string; status: string } | null;
  }[]) ?? [];
  const countMap = new Map((counts ?? []).map((c) => [c.meta_take_id as string, c.film_count as number]));
  const featured = (mts ?? [])
    .map((m) => ({ ...m, n: countMap.get(m.id) ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
  const tropes = ((tropesRaw as { slug: string; title: string; laconic: string | null; figures: number; films: number }[]) ?? [])
    .sort((a, b) => b.films - a.films || b.figures - a.figures)
    .slice(0, 10);

  return (
    <div className="mt">
      <MetatakeNav />
      <div className="mt-wrap">
        <h1 className="mt-h1" style={{ borderBottom: "none", fontSize: 22 }}>The unconscious lines between films</h1>
        <p className="mt-laconic" style={{ margin: "6px 0 0", maxWidth: "64ch" }}>
          A large-scale AI project that uses <b style={{ fontWeight: 400 }}>embeddings</b> to map the unconscious
          connections between films — and between film and the world.
        </p>
        <p style={{ marginTop: 8 }}>
          Every film is built from <b style={{ fontWeight: 400 }}>figures</b> — a face, an object, a place, a scene.
          Each figure carries a <b style={{ fontWeight: 400 }}>take</b>: a reading of what it means. When a reading
          recurs across films it becomes a <b style={{ fontWeight: 400 }}>meta take</b>; the recurring <em>kind of thing</em>
          beneath it is a <b style={{ fontWeight: 400 }}>trope</b>. Start anywhere; fall down the rabbit hole.
        </p>
        <div className="mt-tabs" style={{ marginTop: 4 }}>
          <Link href="/tropes">Tropes</Link>
          <Link href="/meta-takes">Meta takes</Link>
          <Link href="/film">Films</Link>
          <Link href="/director">Directors</Link>
        </div>

        <div style={{ margin: "14px 0 8px" }}>
          <SearchBox variant="hero" />
        </div>

        <RandomShowcase />

        {recent.length > 0 && (
          <>
            <h2 className="mt-h2" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span>Latest readings</span>
              <Link href="/latest" style={{ fontSize: 13, fontWeight: 400 }}>See all →</Link>
            </h2>
            <ul className="lt-list">
              {recent.map((t) => {
                const reg = t.register ? REG[t.register] : undefined;
                return (
                  <li key={t.id} className="lt-item">
                    <div className="lt-meta">
                      {reg ? <span className="lt-reg" style={{ background: reg[1] }}>{reg[0]}</span> : null}
                      <Link href={`/film/${t.figure.film.slug}/figure/${t.figure.slug}`} className="lt-fig">{t.figure.label}</Link>
                      <span className="lt-film"> · {t.figure.film.title}</span>
                    </div>
                    <Link href={`/film/${t.figure.film.slug}/figure/${t.figure.slug}#t-${t.id}`} className="lt-body">
                      {t.rationale.length > 240 ? t.rationale.slice(0, 240).trim() + "…" : t.rationale}
                    </Link>
                    {t.meta_take && t.meta_take.status === "published" ? (
                      <div className="lt-hub">→ <Link href={`/take/${t.meta_take.slug}`}>{t.meta_take.title}</Link></div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tropes.length > 0 && (
          <>
            <h2 className="mt-h2" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span>Tropes — the kinds of thing that recur</span>
              <Link href="/tropes" style={{ fontSize: 13, fontWeight: 400 }}>See all →</Link>
            </h2>
            <p className="mt-laconic" style={{ margin: "0 0 6px", maxWidth: "64ch" }}>
              Screenwriting figure-types — the devices, situations and objects films return to. A working catalogue for readers and writers.
            </p>
            <ol className="trl">
              {tropes.map((t, i) => (
                <li key={t.slug} className="trl-item">
                  <span className="trl-rank">{i + 1}</span>
                  <Link href={`/trope/${t.slug}`} className="trl-ttl">{t.title}</Link>
                  {t.laconic ? <span className="trl-lac">{t.laconic}</span> : null}
                  <span className="trl-stats">{t.figures} figures · {t.films} films</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {featured.length > 0 && (
          <>
            <h2 className="mt-h2">Most-connected readings</h2>
            <div className="mt-cols">
              {featured.map((m) => (
                <div key={m.id} style={{ marginBottom: 6 }}>
                  <Link href={`/take/${m.slug}`}>{m.title}</Link>{" "}
                  <span style={{ color: "var(--subtle)" }}>{m.n}</span>
                  {m.laconic ? <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{m.laconic}</div> : null}
                </div>
              ))}
            </div>
          </>
        )}

        {enriched.length > 0 && (
          <>
            <h2 className="mt-h2">New — figure pages</h2>
            <div className="mt-cols">
              {enriched.map((f) => (
                <div key={`${f.film.slug}-${f.slug}`} style={{ marginBottom: 6 }}>
                  <Link href={`/film/${f.film.slug}/figure/${f.slug}`}>{f.label}</Link>{" "}
                  <Link href={`/film/${f.film.slug}`} style={{ color: "var(--subtle)" }}>{f.film.title}</Link>
                </div>
              ))}
            </div>
          </>
        )}

        {featured.length === 0 && (
          <p style={{ color: "var(--muted)", marginTop: 20 }}>
            The archive is being assembled — meta takes appear here as they are published.
          </p>
        )}
      </div>
    </div>
  );
}
