import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import { renderTokens } from "@/lib/mtTokens";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ slug: string }>; }

type Film = { title: string; slug: string; year: number | null; director: string | null };
type Row = { figure_id: string; label: string; rationale: string | null; film: Film };

async function load(slug: string) {
  const supabase = db();
  const { data: mt } = await supabase
    .from("meta_takes")
    .select(`id, slug, title, laconic, thesis, essay, genres,
      theory_family:theory_families(name, slug), theorist:theorists(name, slug)`)
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (!mt) return null;

  const [{ data: takeRows }, { data: ranks }, { data: edges }] = await Promise.all([
    supabase.from("takes")
      .select("figure_id, rationale, figure:figures!inner(id, label, film:films!inner(title, slug, year, director))")
      .eq("meta_take_id", mt.id),
    supabase.from("meta_take_rankings")
      .select("figure_id, rel_rank, surp_rank").eq("meta_take_id", mt.id),
    supabase.from("meta_take_edges")
      .select("a, b, relation").or(`a.eq.${mt.id},b.eq.${mt.id}`),
  ]);

  const byFig = new Map<string, Row>();
  for (const r of (takeRows ?? []) as unknown[]) {
    const t = r as { figure_id: string; rationale: string | null; figure: { id: string; label: string; film: Film } };
    if (!byFig.has(t.figure_id)) byFig.set(t.figure_id, { figure_id: t.figure_id, label: t.figure.label, rationale: t.rationale, film: t.figure.film });
  }
  const rankMap = new Map<string, { rel_rank: number; surp_rank: number }>(
    (ranks ?? []).map((r) => [r.figure_id as string, { rel_rank: r.rel_rank as number, surp_rank: r.surp_rank as number }] as [string, { rel_rank: number; surp_rank: number }])
  );
  const rows = [...byFig.values()];
  const filmSet = new Map<string, { title: string }>();
  for (const r of rows) filmSet.set(r.film.slug, { title: r.film.title });

  const withRank = rows.map((r) => ({ ...r, rel: rankMap.get(r.figure_id)?.rel_rank ?? 999, surp: rankMap.get(r.figure_id)?.surp_rank ?? 999 }));
  const defining = [...withRank].sort((a, b) => a.rel - b.rel).slice(0, 5);
  const defIds = new Set(defining.map((d) => d.figure_id));
  const unexpected = [...withRank].sort((a, b) => a.surp - b.surp).filter((r) => !defIds.has(r.figure_id)).slice(0, 3);

  // related meta takes
  const otherIds = (edges ?? []).map((e) => (e.a === mt.id ? e.b : e.a)) as string[];
  let related: { slug: string; title: string }[] = [];
  if (otherIds.length) {
    const { data: rel } = await supabase.from("meta_takes")
      .select("slug, title").in("id", otherIds).eq("status", "published");
    related = (rel ?? []) as { slug: string; title: string }[];
  }

  const family = mt.theory_family as unknown as { name: string; slug: string } | null;
  const theorist = mt.theorist as unknown as { name: string; slug: string } | null;
  return { mt, family, theorist, defining, unexpected, related, filmCount: filmSet.size, filmMap: Object.fromEntries(filmSet) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  return {
    title: `${data.mt.title} — ${data.filmCount} films`,
    description: data.mt.thesis ?? data.mt.laconic ?? undefined,
  };
}

export default async function TakePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { mt, family, theorist, defining, unexpected, related, filmCount, filmMap } = data;
  const resolver = { film: filmMap };

  const Example = ({ r }: { r: { label: string; rationale: string | null; film: Film } }) => (
    <li>
      <Link href={`/film/${r.film.slug}`}>{r.film.title}</Link>{" "}
      <span className="yr">({r.film.year ?? "?"})</span> — <span className="mt-fig">{r.label}</span>
      {r.rationale ? (
        <div className="mt-rat">{r.rationale.replace(/\s+/g, " ").trim()}</div>
      ) : null}
    </li>
  );

  return (
    <div className="mt">
      <MetatakeNav active="takes" />
      <div className="mt-wrap">
        <div className="mt-crumb">
          <Link href="/meta-takes">Meta takes</Link>
          {family ? <> &nbsp;›&nbsp; <Link href={`/meta-takes?family=${family.slug}`}>{family.name}</Link></> : null}
        </div>
        <h1 className="mt-h1">{mt.title}</h1>
        {mt.laconic ? <p className="mt-laconic">{mt.laconic}</p> : null}

        <div className="mt-info">
          <div className="hd">Meta take</div>
          <div className="bd">
            {theorist ? <div className="row"><span className="k">Theorist</span><Link href={`/theorist/${theorist.slug}`}>{theorist.name}</Link></div> : null}
            {family ? <div className="row"><span className="k">Theory</span><Link href={`/meta-takes?family=${family.slug}`}>{family.name}</Link></div> : null}
            <div className="row"><span className="k">Films</span><span>{filmCount}</span></div>
          </div>
        </div>

        {mt.thesis ? <p>{mt.thesis}</p> : null}
        {mt.essay ? <p>{renderTokens(mt.essay, resolver)}</p> : null}

        <h2 className="mt-h2">Examples</h2>

        {defining.length > 0 && (
          <>
            <div className="mt-label">Defining cases</div>
            <ul className="mt-list">{defining.map((r) => <Example key={r.figure_id} r={r} />)}</ul>
          </>
        )}
        {unexpected.length > 0 && (
          <>
            <div className="mt-label">Unexpected kin <span style={{ textTransform: "none", letterSpacing: 0 }}>— far apart on the surface, family underneath</span></div>
            <ul className="mt-list">{unexpected.map((r) => <Example key={r.figure_id} r={r} />)}</ul>
          </>
        )}

        {related.length > 0 && (
          <p className="mt-see">
            <span style={{ color: "var(--subtle)" }}>Compare</span>&nbsp;&nbsp;
            {related.map((r, i) => <span key={r.slug}>{i > 0 ? " · " : ""}<Link href={`/take/${r.slug}`}>{r.title}</Link></span>)}
          </p>
        )}
      </div>
    </div>
  );
}
