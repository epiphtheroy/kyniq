import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import EntityActions from "@/components/EntityActions";
import ListFilter from "@/components/ListFilter";
import Provenance from "@/components/Provenance";
import { pageRobots } from "@/lib/seo";
import EntityGraphLoader from "@/components/EntityGraphLoader";

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
    .select("id, slug, title, laconic, thesis, seo_phrase, created_at, updated_at")
    .eq("slug", slug).eq("kind", "figure_type").eq("status", "published").maybeSingle();
  if (!t) return null;
  const { data: mems } = await supabase.from("figure_type_members")
    .select("figure:figures!inner(id, label, slug, description, film:films!inner(title, slug, year))")
    .eq("meta_take_id", t.id);
  const members = (mems as unknown as Member[]) ?? [];
  const films = new Set(members.map((m) => m.figure.film.slug));
  return { t, members, filmCount: films.size };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Trope — Metatake" };
  const phrase = (data.t as { seo_phrase?: string | null }).seo_phrase;
  const title = phrase ? `${phrase} — ${data.filmCount} films` : `${data.t.title} — a figure-type across ${data.filmCount} films`;
  const description = data.t.thesis ?? data.t.laconic ?? undefined;
  return {
    title,
    description,
    openGraph: { title, ...(description ? { description } : {}) },
    robots: pageRobots(true),
  };
}

export default async function TropePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { t, members, filmCount } = data;
  const sorted = [...members].sort((a, b) => a.figure.film.title.localeCompare(b.figure.film.title));
  const filmLabel = filmCount === 1 ? "film" : "films";
  const figLabel = members.length === 1 ? "figure" : "figures";

  return (
    <div className="mt">
      <MetatakeNav active="tropes" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Tropes", item: "https://metatake.net/tropes" },
          { "@type": "ListItem", position: 2, name: t.title, item: `https://metatake.net/trope/${t.slug}` },
        ] },
        { "@context": "https://schema.org", "@type": "Article", headline: t.title,
          ...(t.thesis || t.laconic ? { description: t.thesis ?? t.laconic } : {}),
          author: { "@type": "Organization", name: "Metatake" },
          publisher: { "@type": "Organization", name: "Metatake" } },
      ]) }} />

      <div className="tp-wrap">
        <div className="tp-crumb"><Link href="/tropes">Tropes</Link></div>

        <header className="tp-head">
          <div className="tp-role">Trope · figure-type</div>
          <h1 className="tp-h1">{t.title}</h1>
          {t.laconic ? <p className="tp-laconic">{t.laconic}</p> : null}
          <div className="tp-actions">
            <EntityActions entityType="meta_take" entityId={t.id} />
          </div>
        </header>

        <div className="tp-stats">
          <a className="tp-stat" href="#members">
            <div className="tp-stat__n">{members.length}</div>
            <div className="tp-stat__k">{figLabel}</div>
          </a>
          <a className="tp-stat" href="#members">
            <div className="tp-stat__n">{filmCount}</div>
            <div className="tp-stat__k">{filmLabel}</div>
          </a>
        </div>

        {t.thesis ? <p className="tp-thesis">{t.thesis}</p> : null}

        <div className="tp-map">
          <EntityGraphLoader kind="trope" slug={t.slug} label={t.title} height={420} />
        </div>

        <section className="tp-sec" id="members">
          <h2 className="tp-h2">
            Figures of {t.title}{" "}
            <span className="tp-h2__n">— {members.length} across {filmCount} {filmLabel}</span>
          </h2>
          <p className="tp-gloss">
            Every figure across cinema that instantiates this trope — the concrete way each film carries the device. The shared trope is <strong>why</strong> they connect.
          </p>

          {members.length === 0 ? (
            <p className="tp-empty">No figures yet.</p>
          ) : (
            <>
              <ListFilter targetId="trope-members" placeholder={`Search ${members.length} ${figLabel}…`} total={members.length} />
              <ul className="tp-mlist" id="trope-members">
                {sorted.map((m) => {
                  const figHref = m.figure.slug ? `/film/${m.figure.film.slug}/figure/${m.figure.slug}` : `/film/${m.figure.film.slug}`;
                  const desc = m.figure.description?.replace(/\s+/g, " ").trim();
                  return (
                    <li
                      key={m.figure.id}
                      className="tp-member"
                      data-filter-item
                      data-filter-text={`${m.figure.film.title} ${m.figure.label} ${desc ?? ""}`.toLowerCase()}
                    >
                      <div className="tp-mhead">
                        <Link href={`/film/${m.figure.film.slug}`} className="tp-fl">{m.figure.film.title}</Link>{" "}
                        {m.figure.film.year != null ? <span className="tp-yr">({m.figure.film.year})</span> : null}{" "}
                        <span className="tp-dash">—</span>{" "}
                        <Link href={figHref} className="tp-fig">{m.figure.label}<span className="tp-arrow"> →</span></Link>
                      </div>
                      {desc ? <p className="tp-mdesc">{desc}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <Provenance created={t.created_at} updated={t.updated_at} />
      </div>
    </div>
  );
}
