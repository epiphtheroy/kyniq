import { createClient } from "@supabase/supabase-js";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import ViewBeacon from "@/components/ViewBeacon";
import TakeExplorer from "@/components/TakeExplorer";
import ScholarHeader from "@/components/ScholarHeader";
import EntityActions from "@/components/EntityActions";
import SeqNav from "@/components/SeqNav";
import Provenance from "@/components/Provenance";
import Byline from "@/components/Byline";
import { pageRobots } from "@/lib/seo";
import EntityGraphLoader from "@/components/EntityGraphLoader";
import { MetatakeStats } from "@/components/detail/MetatakeDetailBits";

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
    .select(`id, slug, title, laconic, thesis, seo_phrase, genres, created_at, updated_at, raw_concept,
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

  // register counts (for ScholarHeader "read through" + the Registers stat)
  const regCount = new Map<string, number>();
  for (const r of rows) { if (r.register && REG[r.register]) regCount.set(r.register, (regCount.get(r.register) ?? 0) + 1); }
  const registers = [...regCount.entries()]
    .map(([k, n]) => ({ label: REG[k][0], color: REG[k][1], n }))
    .sort((a, b) => b.n - a.n);

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

  return { mt, family, theorist, defining, unexpected, related, all: withRank, filmCount: filmSet.size, registers };
}

// Extracts the first 1–2 sentences of a prose field as a plain-text meta
// description: strips markdown/newlines, then truncates to <=155 chars on a
// word boundary with an ellipsis. Falls back to the raw text if no sentence
// boundary is found within the limit.
function descriptionFromThesis(thesis: string | null | undefined): string | null {
  if (!thesis) return null;
  const plain = thesis.replace(/[*_`#>[\]]/g, "").replace(/\s+/g, " ").trim();
  if (!plain) return null;
  const sentences = plain.match(/[^.!?]+[.!?]+/g) ?? [plain];
  let out = sentences[0].trim();
  if (sentences[1] && (out + " " + sentences[1]).length <= 155) {
    out = (out + " " + sentences[1]).trim();
  }
  if (out.length <= 155) return out;
  const truncated = out.slice(0, 155);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim() + "…";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const phrase = (data.mt as { seo_phrase?: string | null }).seo_phrase;
  const title = phrase ? `${phrase} — ${data.filmCount} films` : `${data.mt.title} — ${data.filmCount} films`;
  const fallbackDescription = data.mt.thesis ?? data.mt.laconic ?? undefined;
  const description = descriptionFromThesis(data.mt.thesis) ?? fallbackDescription;
  return {
    title,
    description,
    openGraph: { title, ...(description ? { description } : {}) },
    twitter: { card: "summary_large_image", title, ...(description ? { description } : {}) },
    alternates: { canonical: `/take/${slug}` },
    robots: pageRobots(true),
  };
}

export default async function TakePage({ params }: Props) {
  const { slug } = await params;
  // The reading layer has folded into tropes — resolve any /take/* URL to its trope
  // (permanent). Published readings (none now; restored later by bold-takes) still render.
  {
    const sup = db();
    const { data: row } = await sup
      .from("meta_takes").select("kind, status, merged_into").eq("slug", slug).maybeSingle();
    if (row) {
      if (row.kind === "figure_type" && row.status === "published") permanentRedirect(`/trope/${slug}`);
      if (row.merged_into) {
        const { data: tgt } = await sup.from("meta_takes").select("slug, kind").eq("id", row.merged_into).maybeSingle();
        if (tgt?.slug) permanentRedirect(`/${tgt.kind === "figure_type" ? "trope" : "take"}/${tgt.slug}`);
      }
    }
  }
  const data = await load(slug);
  if (!data) notFound();
  const { mt, family, theorist, defining, unexpected, related, all, filmCount, registers } = data;

  const familyName = family?.name ?? null;

  // ── Representative case card (Defining cases + Unexpected kin) ────────────────
  const Case = ({ r, rank, kin }: { r: RowR; rank?: number; kin?: boolean }) => {
    const reg = r.register ? REG[r.register] : undefined;
    const color = reg ? reg[1] : undefined;
    return (
      <div className={`mk-case${kin ? " mk-case--kin" : ""}`} style={color ? { borderLeftColor: color } : undefined}>
        <div className="mk-case__top">
          {rank ? <span className="mk-case__rk">{rank}</span> : null}
          <Link href={`/film/${r.film.slug}`} className="mk-case__film">{r.film.title}</Link>{" "}
          <span className="mk-case__yr">({r.film.year ?? "?"})</span>
          <span className="mk-dash">—</span>{" "}
          {r.figureSlug
            ? <Link href={`/film/${r.film.slug}/figure/${r.figureSlug}`} className="mk-case__fig">{r.label}</Link>
            : <span className="mk-case__fig">{r.label}</span>}
          {reg
            ? <span className="mk-badge" style={{ background: reg[1] }}>{reg[0]}</span>
            : <span className="mk-badge mk-badge--none">Unspecified</span>}
        </div>
        {r.rationale ? <p className="mk-case__rat">{r.rationale.replace(/\s+/g, " ").trim()}</p> : null}
      </div>
    );
  };

  // ── "All takes" folder rows (reuse the existing TakeExplorer hooks) ───────────
  const TakeRow = ({ r }: { r: RowR }) => (
    <li
      className="mk-tk"
      data-take-item
      data-take-text={`${r.film.title} ${r.film.year ?? ""} ${r.label} ${r.register ? (REG[r.register]?.[0] ?? r.register) : ""} ${r.rationale ?? ""}`.toLowerCase()}
    >
      <Link href={`/film/${r.film.slug}`} className="mk-tk__f">{r.film.title}</Link>{" "}
      <span className="mk-tk__y">({r.film.year ?? "?"})</span>{" "}
      <span className="mk-dash">—</span>{" "}
      {r.figureSlug
        ? <Link href={`/film/${r.film.slug}/figure/${r.figureSlug}`} className="mk-tk__fg">{r.label}</Link>
        : <span className="mk-tk__fg">{r.label}</span>}
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

  // NOTE: details.mt-folder + data-take-item are the hooks the existing
  // TakeExplorer client relies on (search / random / flash). mk- classes carry
  // the v6 styling on top of them.
  const renderFolders = (groups: { name: string; color?: string; rows: RowR[] }[]) => (
    <div className="mk-folders">
      {groups.map((g) => (
        <details key={g.name} className="mt-folder mk-fold">
          <summary className="mk-fold__sum">
            <span className="mk-fold__name" style={g.color ? { color: g.color } : undefined}>{g.name}</span>
            <span className="mk-fold__n"><b>{g.rows.length}</b> {g.rows.length === 1 ? "take" : "takes"}</span>
          </summary>
          <ul className="mt-list mk-fold__body">{g.rows.map((r) => <TakeRow key={r.figure_id} r={r} />)}</ul>
        </details>
      ))}
    </div>
  );

  const registerCount = registers.length;

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Meta takes", item: "https://metatake.net/meta-takes" },
          { "@type": "ListItem", position: 2, name: mt.title, item: `https://metatake.net/take/${mt.slug}` },
        ] },
        { "@context": "https://schema.org", "@type": "Article", headline: mt.title,
          ...(mt.thesis || mt.laconic ? { description: mt.thesis ?? mt.laconic } : {}),
          author: { "@type": "Organization", name: "Metatake" },
          publisher: { "@type": "Organization", name: "Metatake" } },
      ]) }} />
      <ViewBeacon slug={mt.slug} />

      <div className="mk-wrap">
        <div className="mk-crumb">
          <Link href="/meta-takes">Meta takes</Link>
          {family ? <> &nbsp;›&nbsp; <Link href={`/meta-takes?family=${family.slug}`}>{family.name}</Link></> : null}
        </div>

        <header className="mk-head">
          <div className="mk-role">Meta take · the hub</div>
          <h1 className="mk-h1">{mt.title}</h1>
          {mt.laconic ? <p className="mk-laconic">{mt.laconic}</p> : null}
          <Byline created={mt.created_at} updated={mt.updated_at} />
          {(theorist || familyName) ? (
            <p className="mk-after">
              {familyName ? <>{familyName}</> : <>Theory</>}
              {theorist ? <> · after <b>{theorist.name}</b></> : null}
            </p>
          ) : null}
          <div className="mk-actions">
            <EntityActions entityType="meta_take" entityId={mt.id} />
          </div>

          <MetatakeStats films={filmCount} takes={all.length} registers={registerCount} />
        </header>

        <ScholarHeader
          term={mt.title}
          theorist={theorist?.name ?? null}
          family={family}
          registers={registers}
          filmCount={filmCount}
          takeCount={all.length}
        />

        {mt.thesis ? <p className="mk-thesis">{mt.thesis}</p> : null}

        {/* THE LIVING MAP */}
        <section className="mk-sec mk-mapsec">
          <EntityGraphLoader kind="metatake" slug={mt.slug} label={mt.title} height={460} />
          <p className="mk-maplegend">
            <span className="mk-leg"><i className="mk-leg__dot mk-leg__dot--hub" />this meta take</span>
            <span className="mk-leg"><i className="mk-leg__dot mk-leg__dot--def" />defining film</span>
            <span className="mk-leg"><i className="mk-leg__dot mk-leg__dot--kin" />unexpected kin</span>
          </p>
        </section>

        {/* REPRESENTATIVE TAKES */}
        <section className="mk-sec" id="rep">
          <h2 className="mk-h2">Representative takes</h2>
          <p className="mk-gloss">A few standouts — the clearest cases, and the surprising ones. For every take, open a folder under <a href="#all-takes">All takes</a> below.</p>

          {defining.length > 0 && (
            <>
              <div className="mk-label">Defining cases</div>
              {defining.map((r, i) => <Case key={r.figure_id} r={r} rank={i + 1} />)}
            </>
          )}

          {unexpected.length > 0 && (
            <>
              <div className="mk-label">Unexpected kin <span className="mk-label__sm">— far apart on the surface, family underneath</span></div>
              {unexpected.map((r) => <Case key={r.figure_id} r={r} kin />)}
            </>
          )}
        </section>

        {/* ALL TAKES */}
        {all.length > 0 && (
          <section className="mk-sec" id="all-takes">
            <h2 className="mk-h2">All takes of &ldquo;{mt.title}&rdquo; <span className="mk-h2__n">— {all.length} across {filmCount} {filmCount === 1 ? "film" : "films"}</span></h2>
            <p className="mk-gloss">Every reading of this idea across cinema. Search within them, jump to a random one, or open a folder &mdash; grouped by film genre or by critical register.</p>
            <TakeExplorer total={all.length} genre={renderFolders(genreGroups)} register={renderFolders(regGroups)} />
          </section>
        )}

        <p className="mk-compare">
          <span className="mk-compare__k">Compare</span>&nbsp;&nbsp;
          {related.length > 0
            ? related.map((r, i) => <span key={r.slug}>{i > 0 ? " · " : ""}<Link href={`/take/${r.slug}`}>{r.title}</Link></span>)
            : <span className="mk-compare__none">no linked meta takes yet — this hub stands alone for now.</span>}
        </p>

        <SeqNav kind="meta_take" id={mt.id} />

        <Provenance created={mt.created_at} updated={mt.updated_at} />
      </div>
    </div>
  );
}
