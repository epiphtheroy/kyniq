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

// register → [label, color]  (figure-page-design.md §6.1)
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
const KIND: Record<string, string> = {
  character: "Character", object: "Object / symbol", location: "Location",
  form: "Form / technique", trope: "Trope",
};

interface Props { params: Promise<{ slug: string; figureSlug: string }>; }

type MetaTake = { slug: string; title: string; status: string } | null;
type Take = {
  id: string; rationale: string | null; register: string | null;
  angle: string | null; confidence: number | null; meta_take: MetaTake;
};

async function load(slug: string, figureSlug: string) {
  const supabase = db();
  const { data: film } = await supabase
    .from("films").select("id, title, slug, year, director, director_slug")
    .eq("slug", slug).maybeSingle();
  if (!film) return null;
  const { data: figure } = await supabase
    .from("figures").select("id, label, kind, description")
    .eq("film_id", film.id).eq("slug", figureSlug).maybeSingle();
  if (!figure) return null;
  const { data: takeRows } = await supabase
    .from("takes")
    .select("id, rationale, register, angle, confidence, meta_take:meta_takes(slug, title, status)")
    .eq("figure_id", figure.id).eq("status", "published");
  const takes = ((takeRows ?? []) as unknown as Take[])
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return { film, figure, takes };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, figureSlug } = await params;
  const data = await load(slug, figureSlug);
  if (!data) return { title: "Not found" };
  return {
    title: `${data.figure.label} — ${data.film.title}`,
    description: data.figure.description ?? undefined,
  };
}

export default async function FigurePage({ params }: Props) {
  const { slug, figureSlug } = await params;
  const data = await load(slug, figureSlug);
  if (!data) notFound();
  const { film, figure, takes } = data;
  const resolver = { film: { [film.slug]: { title: film.title } } };

  return (
    <div className="mt">
      <MetatakeNav active="films" />
      <div className="mt-wrap">
        <div className="mt-crumb">
          <Link href="/film">Films</Link>
          {film.director_slug ? <> &nbsp;›&nbsp; <Link href={`/director/${film.director_slug}`}>{film.director}</Link></> : null}
          &nbsp;›&nbsp; <Link href={`/film/${film.slug}`}>{film.title}</Link>
        </div>

        <h1 className="mt-h1">{figure.label}</h1>

        <div className="mt-info">
          <div className="hd">Figure</div>
          <div className="bd">
            <div className="row"><span className="k">Film</span><Link href={`/film/${film.slug}`}>{film.title}{film.year ? ` (${film.year})` : ""}</Link></div>
            {figure.kind ? <div className="row"><span className="k">Kind</span><span>{KIND[figure.kind] ?? figure.kind}</span></div> : null}
            <div className="row"><span className="k">Readings</span><span>{takes.length}</span></div>
          </div>
        </div>

        {figure.description ? (
          <p className="fig-desc">{renderTokens(figure.description, resolver)}</p>
        ) : null}

        <h2 className="mt-h2">Readings</h2>
        <div className="fig-takes">
          {takes.map((t) => {
            const reg = t.register ? REG[t.register] : undefined;
            const color = reg ? reg[1] : "#8F8F8F";
            const mt = t.meta_take;
            return (
              <div key={t.id} className="fig-take" style={{ borderLeftColor: color }}>
                <div className="fig-take__top">
                  {reg ? <span className="fig-badge" style={{ background: color }}>{reg[0]}</span> : null}
                  {mt ? (
                    <span className="fig-hub">
                      →{" "}
                      {mt.status === "published"
                        ? <Link href={`/take/${mt.slug}`}>{mt.title}</Link>
                        : <span className="emerging">{mt.title} <em>(emerging)</em></span>}
                    </span>
                  ) : null}
                </div>
                {t.rationale ? <p className="fig-take__rat">{renderTokens(t.rationale, resolver)}</p> : null}
              </div>
            );
          })}
          {takes.length === 0 ? <p className="mt-see">No readings yet.</p> : null}
        </div>

        <div className="fig-cta">
          Have a reading of this figure? Logged-in contributions are coming soon — you’ll be able to
          add your own take and link it to a meta take.
        </div>
      </div>
    </div>
  );
}
