import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import ListFilter from "@/components/ListFilter";
import { pageRobots } from "@/lib/seo";
import { kindBySeg, sectionByKey, axisLabel, nodeHref, sectionHref } from "@/lib/catalog";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
const img = (p: string | null) => (p ? `https://image.tmdb.org/t/p/w185${p}` : null);

interface Props { params: Promise<{ seg: string; slug: string }> }
type Detail = { id: string; slug: string; label: string; code: string | null; definition: string | null; kind: string;
  parent_slug: string | null; parent_label: string | null; parent_kind: string | null; member_count: number };
type Member = { figure_label: string; figure_slug: string | null; film_title: string; film_slug: string;
  yr: number | null; poster: string | null; backdrop: string | null; confidence: number | null };
type Kin = { slug: string; label: string; sim: number; n: number };
type Theme = { slug: string; label: string; n: number };

function maturity(n: number): [string, string] | null {
  if (n >= 26) return ["cliche", "Cliché"];
  if (n >= 9) return ["established", "Established"];
  if (n >= 4) return ["emerging", "Emerging"];
  if (n >= 2) return ["fresh", "Fresh"];
  if (n === 1) return ["noble", "Noble"];
  return null;
}

async function load(seg: string, slug: string) {
  const km = kindBySeg(seg);
  if (!km) return null;
  const supabase = db();
  const { data: d } = await supabase.rpc("catalog_node_detail", { p_kind: km.kind, p_slug: slug });
  const detail = ((d as Detail[]) ?? [])[0];
  if (!detail) return null;
  const [mem, kin, thm] = await Promise.all([
    supabase.rpc("catalog_node_members", { p_kind: km.kind, p_slug: slug, p_limit: 120, p_offset: 0 }),
    supabase.rpc("catalog_node_kindred", { p_kind: km.kind, p_slug: slug, p_n: 8 }),
    supabase.rpc("catalog_node_themes", { p_kind: km.kind, p_slug: slug, p_n: 10 }),
  ]);
  return {
    km, detail,
    members: (mem.data as Member[]) ?? [],
    kindred: (kin.data as Kin[]) ?? [],
    themes: ((thm.data as Theme[]) ?? []).filter((t) => !(km.kind === "theme" && t.slug === slug)),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seg, slug } = await params;
  const data = await load(seg, slug);
  if (!data) return { title: "Catalog — Metatake" };
  const { km, detail } = data;
  const title = `${detail.label} — ${km.label} | Metatake`;
  const description = detail.definition ?? `${detail.member_count} figures classified as ${detail.label}.`;
  return { title, description, openGraph: { title, description }, robots: pageRobots(detail.member_count >= 1) };
}

export default async function CatalogNode({ params }: Props) {
  const { seg, slug } = await params;
  const data = await load(seg, slug);
  if (!data) notFound();
  const { km, detail, members, kindred, themes } = data;
  const section = sectionByKey(km.section);
  const mat = maturity(detail.member_count);
  const n = detail.member_count;
  const figLabel = n === 1 ? "figure" : "figures";

  return (
    <div className="mt">
      <SiteNav />
      <div className="cat-wrap cat-node">
        <div className="cat-crumb">
          <Link href="/catalog">Archetype</Link> <span>›</span>{" "}
          {section ? <Link href={sectionHref(section.key)}>{section.label}</Link> : null} <span>›</span>{" "}
          {km.label}
        </div>

        <header className="cat-nhead">
          <div className="cat-nrole">
            {km.label}
            {mat ? <> · <span className={`tp-mat tp-mat--${mat[0]}`}>{mat[1]}</span></> : null}
          </div>
          <h1 className="cat-h1">{detail.label}</h1>
          {detail.parent_slug && detail.parent_kind ? (
            <div className="cat-parent">
              {axisLabel(detail.parent_kind)}:{" "}
              <Link href={nodeHref(detail.parent_kind, detail.parent_slug)}>{detail.parent_label}</Link>
            </div>
          ) : null}
          {detail.definition ? <p className="cat-ndef">{detail.definition}</p> : null}
        </header>

        <section className="cat-sec" id="members">
          <h2 className="cat-h2">
            {n.toLocaleString()} {figLabel} classified as this
          </h2>
          {members.length === 0 ? (
            <p className="cat-empty">No figures yet.</p>
          ) : (
            <>
              {members.length > 8 ? (
                <ListFilter targetId="cat-members" placeholder={`Filter these ${figLabel}…`} total={members.length} />
              ) : null}
              <div className="cat-mlist" id="cat-members">
              {members.map((m, i) => {
                const href = m.figure_slug
                  ? `/film/${m.film_slug}/figure/${m.figure_slug}`
                  : `/film/${m.film_slug}`;
                const src = img(m.backdrop) || img(m.poster);
                return (
                  <Link key={`${m.film_slug}-${i}`} href={href} className="cat-mrow"
                    data-filter-item data-filter-text={`${m.figure_label} ${m.film_title}`.toLowerCase()}>
                    <div className="cat-mrthumb">
                      {src ? <img src={src} alt="" loading="lazy" /> : <i className="ti ti-movie" aria-hidden="true" />}
                    </div>
                    <div className="cat-mrtext">
                      <div className="cat-mrfig">{m.figure_label}</div>
                      <div className="cat-mrfilm">{m.film_title}{m.yr ? ` · ${m.yr}` : ""}</div>
                    </div>
                  </Link>
                );
              })}
              {n > members.length ? (
                <div className="cat-mrow cat-mrow--more"><span>+{(n - members.length).toLocaleString()} more</span></div>
              ) : null}
              </div>
            </>
          )}
        </section>

        <div className="cat-rels">
          {kindred.length > 0 ? (
            <section className="cat-relblock">
              <h2 className="cat-h3">Kindred {axisLabel(km.kind).toLowerCase()}s <span className="cat-h2__n">by embedding</span></h2>
              <div className="cat-pills">
                {kindred.map((k) => (
                  <Link key={k.slug} href={nodeHref(km.kind, k.slug)} className="cat-pill">
                    {k.label}<span className="cat-pill__n">{k.n}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {themes.length > 0 ? (
            <section className="cat-relblock">
              <h2 className="cat-h3">Recurring themes</h2>
              <div className="cat-pills">
                {themes.map((t) => (
                  <Link key={t.slug} href={nodeHref("theme", t.slug)} className="cat-pill">
                    {t.label}<span className="cat-pill__n">{t.n}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
