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

type Member = { figure: { label: string; slug: string | null; film: { title: string; slug: string; year: number | null } } };

async function load(slug: string) {
  const supabase = db();
  const { data: t } = await supabase
    .from("meta_takes")
    .select("id, slug, title, laconic, thesis, essay, created_at, updated_at")
    .eq("slug", slug).eq("kind", "figure_type").eq("status", "published").maybeSingle();
  if (!t) return null;
  const [{ data: mems }, { data: readings }] = await Promise.all([
    supabase.from("figure_type_members")
      .select("figure:figures!inner(label, slug, film:films!inner(title, slug, year))")
      .eq("meta_take_id", t.id),
    supabase.rpc("trope_readings", { p_slug: slug, p_limit: 8 }),
  ]);
  const members = (mems as unknown as Member[]) ?? [];
  const films = new Set(members.map((m) => m.figure.film.slug));
  return { t, members, readings: (readings as { slug: string; title: string; n: number }[]) ?? [], filmCount: films.size };
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
  const { t, members, readings, filmCount } = data;
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
          <p className="mt-see">
            <span style={{ color: "var(--subtle)" }}>These figures are most often read as</span>&nbsp;&nbsp;
            {readings.map((r, i) => <span key={r.slug}>{i > 0 ? " · " : ""}<Link href={`/take/${r.slug}`} className="mt-link">{r.title}</Link></span>)}
          </p>
        )}

        <h2 className="mt-h2" id="members">Figures of this type <span className="mt-h2__n">— {members.length} across {filmCount} {filmCount === 1 ? "film" : "films"}</span></h2>
        {members.length === 0 ? (
          <p className="mt-see" style={{ fontStyle: "italic" }}>No figures yet.</p>
        ) : (
          <>
            <ListFilter targetId="trope-members" placeholder={`Search ${members.length} figures…`} />
            <ul className="mt-list" id="trope-members">
              {sorted.map((m, i) => (
                <li key={i} data-filter-item data-filter-text={`${m.figure.label} ${m.figure.film.title}`.toLowerCase()}>
                  <Link href={`/film/${m.figure.film.slug}`}>{m.figure.film.title}</Link>{" "}
                  <span className="yr">({m.figure.film.year ?? "?"})</span> —{" "}
                  {m.figure.slug
                    ? <Link href={`/film/${m.figure.film.slug}/figure/${m.figure.slug}`} className="mt-fig">{m.figure.label}</Link>
                    : <span className="mt-fig">{m.figure.label}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        <Provenance created={t.created_at} updated={t.updated_at} />
      </div>
    </div>
  );
}
