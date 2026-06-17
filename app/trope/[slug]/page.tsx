import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import EntityActions from "@/components/EntityActions";
import ListFilter from "@/components/ListFilter";
import Provenance from "@/components/Provenance";
import { pageRobots } from "@/lib/seo";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
interface Props { params: Promise<{ slug: string }> }

type Member = { figure: { id: string; label: string; slug: string | null; description: string | null; film: { title: string; slug: string; year: number | null } } };

async function load(slug: string) {
  const supabase = db();
  const { data: t } = await supabase
    .from("meta_takes")
    .select("id, slug, title, laconic, thesis, essay, created_at, updated_at")
    .eq("slug", slug).eq("kind", "figure_type").eq("status", "published").maybeSingle();
  if (!t) return null;
  const [{ data: mems }, { data: readings }] = await Promise.all([
    supabase.from("figure_type_members")
      .select("figure:figures!inner(id, label, slug, description, film:films!inner(title, slug, year))")
      .eq("meta_take_id", t.id),
    supabase.rpc("trope_readings", { p_slug: slug, p_limit: 8 }),
  ]);
  const members = (mems as unknown as Member[]) ?? [];

  // For the "curtain" — which readings (kind='reading') each member figure takes part in.
  const figIds = members.map((m) => m.figure.id);
  const readingsByFig = new Map<string, { slug: string; title: string }[]>();
  if (figIds.length) {
    const { data: tk } = await supabase.from("takes")
      .select("figure_id, meta_take:meta_takes(slug, title, status, kind)")
      .in("figure_id", figIds);
    for (const row of (tk ?? []) as unknown as { figure_id: string; meta_take: { slug: string; title: string; status: string; kind: string } | null }[]) {
      const mt = row.meta_take;
      if (!mt || mt.status !== "published" || mt.kind !== "reading") continue;
      const arr = readingsByFig.get(row.figure_id) ?? [];
      if (!arr.some((r) => r.slug === mt.slug)) { arr.push({ slug: mt.slug, title: mt.title }); readingsByFig.set(row.figure_id, arr); }
    }
  }

  const films = new Set(members.map((m) => m.figure.film.slug));
  return { t, members, readingsByFig, readings: (readings as { slug: string; title: string; n: number }[]) ?? [], filmCount: films.size };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Trope — Metatake" };
  return {
    title: `${data.t.title} — a figure-type across ${data.filmCount} films`,
    description: data.t.thesis ?? data.t.laconic ?? undefined,
    robots: pageRobots(true),
  };
}

export default async function TropePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { t, members, readingsByFig, readings, filmCount } = data;
  const sorted = [...members].sort((a, b) => a.figure.film.title.localeCompare(b.figure.film.title));

  return (
    <div className="mt">
      <MetatakeNav active="tropes" />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/tropes">Tropes</Link></div>
        <h1 className="mt-h1">{t.title}</h1>
        {t.laconic ? <p className="mt-laconic">{t.laconic}</p> : null}
        <EntityActions entityType="meta_take" entityId={t.id} />

        <div className="mt-info">
          <div className="hd">Trope · figure-type</div>
          <div className="bd">
            <div className="row"><span className="k">Figures</span><a href="#members" className="mt-jump">{members.length} ↓</a></div>
            <div className="row"><span className="k">Films</span><span>{filmCount}</span></div>
          </div>
        </div>

        {t.thesis ? <p>{t.thesis}</p> : null}

        {readings.length > 0 && (
          <div className="xbox xbox--readings">
            <div className="xbox-h"><span className="xbox-ic" aria-hidden="true">◆</span> Using this device? It tends to mean</div>
            <div className="xbox-list">
              {readings.map((r) => (
                <Link key={r.slug} href={`/take/${r.slug}`} className="xbox-row">
                  <span className="xbox-name">{r.title} <span className="xbox-arrow">→</span></span>
                  <span className="xbox-n">{r.n} {r.n === 1 ? "figure" : "figures"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <h2 className="mt-h2" id="members">Figures of this type <span className="mt-h2__n">— {members.length} across {filmCount} {filmCount === 1 ? "film" : "films"}</span></h2>
        {members.length === 0 ? (
          <p className="mt-see" style={{ fontStyle: "italic" }}>No figures yet.</p>
        ) : (
          <>
            <p className="mt-sortbar__hint">Click a row to read what the figure is; “Open →” goes to its full page.</p>
            <ListFilter targetId="trope-members" placeholder={`Search ${members.length} figures…`} />
            <ul className="trm-list" id="trope-members">
              {sorted.map((m) => {
                const reads = readingsByFig.get(m.figure.id) ?? [];
                const figHref = m.figure.slug ? `/film/${m.figure.film.slug}/figure/${m.figure.slug}` : `/film/${m.figure.film.slug}`;
                const desc = m.figure.description?.replace(/\s+/g, " ").trim();
                return (
                  <li key={m.figure.id} data-filter-item data-filter-text={`${m.figure.label} ${m.figure.film.title} ${desc ?? ""}`.toLowerCase()}>
                    <details className="trm">
                      <summary className="trm-sum">
                        <span className="trm-head">
                          <span className="mt-fig">{m.figure.label}</span>
                          <span className="trm-film"> · <Link href={`/film/${m.figure.film.slug}`}>{m.figure.film.title}</Link> <span className="yr">({m.figure.film.year ?? "?"})</span></span>
                        </span>
                        <Link href={figHref} className="trm-go">Open →</Link>
                      </summary>
                      <div className="trm-body">
                        {desc
                          ? <p className="trm-desc">{desc}</p>
                          : <p className="trm-desc trm-muted">No description yet — open the figure for its readings.</p>}
                        {reads.length > 0 && (
                          <div className="trm-reads">Reads as: {reads.map((r, i) => <span key={r.slug}>{i > 0 ? " · " : ""}<Link href={`/take/${r.slug}`}>{r.title}</Link></span>)}</div>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Provenance created={t.created_at} updated={t.updated_at} />
      </div>
    </div>
  );
}
