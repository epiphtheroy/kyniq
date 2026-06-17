import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import ViewBeacon from "@/components/ViewBeacon";
import TakeExplorer from "@/components/TakeExplorer";
import NodeGraph from "@/components/NodeGraph";
import EntityActions from "@/components/EntityActions";
import SeqNav from "@/components/SeqNav";
import ScholarHeader from "@/components/ScholarHeader";
import Provenance from "@/components/Provenance";
import { pageRobots } from "@/lib/seo";

export const revalidate = 300;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// register → [label, color]  (kept in sync with the figure page)
const REG: Record<string, [string, string]> = {
  formal: ["Formal", "#5B8FB9"],
  semiotic: ["Semiotic", "#B8860B"],
  psychoanalytic: ["Psychoanalytic", "#A8434F"],
  ideological: ["Ideological", "#C0392B"],
  politico_economic: ["Politico-economic", "#2E7D5B"],
  philosophical: ["Philosophical", "#7E57C2"],
  existential: ["Existential", "#546E7A"],
  mythic: ["Mythic", "#A9743B"],
  genealogical: ["Film-historical", "#2E86C1"],
  reception: ["Reception", "#159A8A"],
};

interface Props { params: Promise<{ slug: string }>; }

type Film = { title: string; slug: string; year: number | null; director: string | null; genres: string[] | null };
type Row = { figure_id: string; label: string; figureSlug: string | null; rationale: string | null; register: string | null; film: Film };
type RowR = Row & { rel: number; surp: number };

async function load(slug: string) {
  const supabase = db();
  const { data: mt } = await supabase
    .from("meta_takes")
    .select(`id, slug, title, laconic, thesis, genres, created_at, updated_at, raw_concept,
      theory_family:theory_families(name, slug), theorist:theorists(name, slug)`)
    .eq("slug", slug).eq("status", "published").eq("kind", "reading").maybeSingle();
  if (!mt) return null;

  const [{ data: takeRows }, { data: ranks }, { data: edges }] = await Promise.all([
    supabase.from("takes")
      .select("figure_id, rationale, register, figure:figures!inner(id, label, slug, film:films!inner(title, slug, year, director, genres))")
      .eq("meta_take_id", mt.id),
    supabase.from("meta_take_rankings")
      .select("figure_id, rel_rank, surp_rank").eq("meta_take_id", mt.id),
    supabase.from("meta_take_edges")
      .select("a, b, relation").or(`a.eq.${mt.id},b.eq.${mt.id}`),
  ]);

  const byFig = new Map<string, Row>();
  for (const r of (takeRows ?? []) as unknown[]) {
    const t = r as { figure_id: string; rationale: string | null; register: string | null; figure: { id: string; label: string; slug: string | null; film: Film } };
    if (!byFig.has(t.figure_id)) byFig.set(t.figure_id, { figure_id: t.figure_id, label: t.figure.label, figureSlug: t.figure.slug ?? null, rationale: t.rationale, register: t.register, film: t.figure.film });
  }
  const rankMap = new Map<string, { rel_rank: number; surp_rank: number }>(
    (ranks ?? []).map((r) => [r.figure_id as string, { rel_rank: r.rel_rank as number, surp_rank: r.surp_rank as number }] as [string, { rel_rank: number; surp_rank: number }])
  );
  const rows = [...byFig.values()];
  const filmSet = new Map<string, { title: string }>();
  for (const r of rows) filmSet.set(r.film.slug, { title: r.film.title });

  const withRank: RowR[] = rows.map((r) => ({ ...r, rel: rankMap.get(r.figure_id)?.rel_rank ?? 999, surp: rankMap.get(r.figure_id)?.surp_rank ?? 999 }));
  const defining = [...withRank].sort((a, b) => a.rel - b.rel).slice(0, 5);
  const defIds = new Set(defining.map((d) => d.figure_id));
  const unexpected = [...withRank].sort((a, b) => a.surp - b.surp).filter((r) => !defIds.has(r.figure_id)).slice(0, 3);

  // related meta takes
  const otherIds = (edges ?? []).map((e) => (e.a === mt.id ? e.b : e.a)) as string[];
  let related: { slug: string; title: string }[] = [];
  if (otherIds.length) {
    const { data: rel } = await supabase.from("meta_takes")
      .select("slug, title").in("id", otherIds).eq("status", "published").eq("kind", "reading");
    related = (rel ?? []) as { slug: string; title: string }[];
  }

  const family = mt.theory_family as unknown as { name: string; slug: string } | null;
  const theorist = mt.theorist as unknown as { name: string; slug: string } | null;

  // lens map (which critical registers this concept is read through) + devices (cross-link)
  const regCount = new Map<string, number>();
  for (const r of withRank) if (r.register) regCount.set(r.register, (regCount.get(r.register) ?? 0) + 1);
  const registers = [...regCount.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, n }));
  const { data: devData } = await supabase.rpc("meta_take_tropes", { p_slug: slug, p_limit: 8 });
  const devices = (devData as { slug: string; title: string; n: number }[]) ?? [];

  return { mt, family, theorist, defining, unexpected, related, all: withRank, filmCount: filmSet.size, registers, devices };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  return {
    title: `${data.mt.title} — ${data.filmCount} films`,
    description: data.mt.thesis ?? data.mt.laconic ?? undefined,
    robots: pageRobots(true),
  };
}

export default async function TakePage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { mt, family, theorist, defining, unexpected, related, all, filmCount, registers, devices } = data;
  const regForHeader = registers.map((r) => ({ label: REG[r.key]?.[0] ?? r.key, color: REG[r.key]?.[1] ?? "#8F8F8F", n: r.n }));

  const Example = ({ r }: { r: RowR }) => (
    <li
      data-take-item
      data-take-text={`${r.film.title} ${r.film.year ?? ""} ${r.label} ${r.register ? (REG[r.register]?.[0] ?? r.register) : ""} ${r.rationale ?? ""}`.toLowerCase()}
    >
      <Link href={`/film/${r.film.slug}`}>{r.film.title}</Link>{" "}
      <span className="yr">({r.film.year ?? "?"})</span> —{" "}
      {r.figureSlug
        ? <Link href={`/film/${r.film.slug}/figure/${r.figureSlug}`} className="mt-fig">{r.label}</Link>
        : <span className="mt-fig">{r.label}</span>}
      {r.rationale ? (
        <div className="mt-rat">{r.rationale.replace(/\s+/g, " ").trim()}</div>
      ) : null}
    </li>
  );

  // folder groupings for the exhaustive "all takes" listing
  const byGenre = new Map<string, RowR[]>();
  for (const r of all) {
    const gs = r.film.genres && r.film.genres.length ? r.film.genres : ["Other"];
    for (const g of gs) { const a = byGenre.get(g) ?? []; a.push(r); byGenre.set(g, a); }
  }
  const genreGroups = [...byGenre.entries()]
    .map(([name, rows]) => ({ name, color: undefined as string | undefined, rows: [...rows].sort((a, b) => a.rel - b.rel) }))
    .sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name));

  const byReg = new Map<string, RowR[]>();
  for (const r of all) { const k = r.register ?? "__none"; const a = byReg.get(k) ?? []; a.push(r); byReg.set(k, a); }
  const regGroups = [...byReg.entries()]
    .map(([k, rows]) => ({
      name: k === "__none" ? "Unspecified" : (REG[k]?.[0] ?? k),
      color: k === "__none" ? undefined : REG[k]?.[1],
      rows: [...rows].sort((a, b) => a.rel - b.rel),
      _none: k === "__none",
    }))
    .sort((a, b) => Number(a._none) - Number(b._none) || b.rows.length - a.rows.length);

  const FolderIcon = (
    <svg className="mt-folder__ico" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11z" fill="currentColor" />
    </svg>
  );
  const renderFolders = (groups: { name: string; color?: string; rows: RowR[] }[]) => (
    <div className="mt-folders">
      {groups.map((g) => (
        <details key={g.name} className="mt-folder">
          <summary>
            {FolderIcon}
            <span className="mt-folder__name" style={g.color ? { color: g.color } : undefined}>{g.name}</span>
            <span className="mt-folder__n">{g.rows.length}</span>
          </summary>
          <ul className="mt-list">{g.rows.map((r) => <Example key={r.figure_id} r={r} />)}</ul>
        </details>
      ))}
    </div>
  );

  return (
    <div className="mt">
      <MetatakeNav active="takes" />
      <ViewBeacon slug={mt.slug} />
      <div className="mt-wrap">
        <div className="mt-crumb">
          <Link href="/meta-takes">Meta takes</Link>
          {family ? <> &nbsp;›&nbsp; <Link href={`/meta-takes?family=${family.slug}`}>{family.name}</Link></> : null}
        </div>
        <h1 className="mt-h1">{mt.title}</h1>
        {mt.laconic ? <p className="mt-laconic">{mt.laconic}</p> : null}
        <EntityActions entityType="meta_take" entityId={mt.id} />

        <ScholarHeader term={mt.raw_concept ?? mt.title} theorist={theorist?.name ?? null} family={family} registers={regForHeader} filmCount={filmCount} takeCount={all.length} />

        {mt.thesis ? <p>{mt.thesis}</p> : null}

        {devices.length > 0 && (
          <div className="xbox">
            <div className="xbox-h"><span className="xbox-ic" aria-hidden="true">⚙</span> The tropes that build this meaning</div>
            <div className="xbox-sub">Screenwriting figure-types films use to construct this reading — open a trope to see its figures.</div>
            <div className="xbox-list">
              {devices.map((d) => (
                <Link key={d.slug} href={`/trope/${d.slug}`} className="xbox-row">
                  <span className="xbox-name">{d.title} <span className="xbox-arrow">→ trope</span></span>
                  <span className="xbox-n">{d.n} {d.n === 1 ? "figure" : "figures"}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <h2 className="mt-h2">Representative takes</h2>
        <p className="mt-sortbar__hint">A few standouts. For every take, open a category under <a href="#all-takes">All takes</a> below.</p>

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

        {all.length > 0 && (
          <>
            <h2 className="mt-h2" id="all-takes">All takes of “{mt.title}” <span className="mt-h2__n">— {all.length} across {filmCount} {filmCount === 1 ? "film" : "films"}</span></h2>
            <p className="mt-sortbar__hint">Search within these takes, jump to a random one, or open a folder. Group by film genre or by critical register.</p>
            <TakeExplorer total={all.length} genre={renderFolders(genreGroups)} register={renderFolders(regGroups)} />
          </>
        )}

        {related.length > 0 && (
          <p className="mt-see">
            <span style={{ color: "var(--subtle)" }}>Compare</span>&nbsp;&nbsp;
            {related.map((r, i) => <span key={r.slug}>{i > 0 ? " · " : ""}<Link href={`/take/${r.slug}`}>{r.title}</Link></span>)}
          </p>
        )}

        <SeqNav kind="meta_take" id={mt.id} />
        <NodeGraph kind="meta_take" mtSlug={mt.slug} label={mt.title} />

        <Provenance created={mt.created_at} updated={mt.updated_at} />
      </div>
    </div>
  );
}
