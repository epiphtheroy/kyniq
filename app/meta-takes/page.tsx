import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import ListFilter from "@/components/ListFilter";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Meta takes — the readings that recur across cinema",
  description: "Every critical reading that recurs across films — grouped by the theory, the critical register, or the theorist behind it.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const REG: Record<string, string> = {
  formal: "Formal", semiotic: "Semiotic", psychoanalytic: "Psychoanalytic",
  ideological: "Ideological", politico_economic: "Politico-economic",
  philosophical: "Philosophical", existential: "Existential", mythic: "Mythic",
  genealogical: "Film-historical", reception: "Reception",
};

type Group = "family" | "register" | "theorist";
type Sort = "films" | "views" | "new";

const GROUP_LABEL: Record<Group, string> = { family: "By theory", register: "By register", theorist: "By theorist" };
const GROUP_HINT: Record<Group, string> = {
  family: "The school of thought each reading descends from.",
  register: "The critical route used to reach it — the lens, not the conclusion. Fills in as films are enriched.",
  theorist: "The thinker whose concept the reading draws on.",
};
const SORT_LABEL: Record<Sort, string> = { films: "Most films", views: "Most viewed", new: "Newest" };

interface Props { searchParams: Promise<{ group?: string; sort?: string }>; }

type MT = {
  id: string; slug: string; title: string; view: number; created: string | null;
  familyName: string | null; familySlug: string | null;
  theoristName: string | null; theoristSlug: string | null;
  films: number; register: string | null;
};

export default async function MetaTakesIndex({ searchParams }: Props) {
  const sp = await searchParams;
  const group: Group = (["family", "register", "theorist"].includes(sp.group ?? "") ? sp.group : "family") as Group;
  const sort: Sort = (["films", "views", "new"].includes(sp.sort ?? "") ? sp.sort : "films") as Sort;

  const supabase = db();
  const [{ data: mts }, { data: counts }, { data: regCounts }] = await Promise.all([
    supabase.from("meta_takes")
      .select("id, slug, title, view_count, created_at, theory_family:theory_families(name, slug), theorist:theorists(name, slug)")
      .eq("status", "published").eq("kind", "reading"),
    supabase.from("meta_take_film_counts").select("meta_take_id, film_count"),
    supabase.from("meta_take_register_counts").select("meta_take_id, register, take_count"),
  ]);

  const filmCount = new Map<string, number>((counts ?? []).map((c) => [c.meta_take_id as string, c.film_count as number]));
  const domReg = new Map<string, { register: string; n: number }>();
  for (const rc of (regCounts ?? []) as { meta_take_id: string; register: string; take_count: number }[]) {
    const cur = domReg.get(rc.meta_take_id);
    if (!cur || rc.take_count > cur.n) domReg.set(rc.meta_take_id, { register: rc.register, n: rc.take_count });
  }

  const items: MT[] = (mts ?? []).map((m) => {
    const fam = m.theory_family as unknown as { name: string; slug: string } | null;
    const th = m.theorist as unknown as { name: string; slug: string } | null;
    return {
      id: m.id as string, slug: m.slug as string, title: m.title as string,
      view: (m.view_count as number) ?? 0, created: (m.created_at as string) ?? null,
      familyName: fam?.name ?? null, familySlug: fam?.slug ?? null,
      theoristName: th?.name ?? null, theoristSlug: th?.slug ?? null,
      films: filmCount.get(m.id as string) ?? 0,
      register: domReg.get(m.id as string)?.register ?? null,
    };
  });
  const total = items.length;

  const keyOf = (m: MT): string =>
    group === "family" ? (m.familyName ?? "Uncategorised")
    : group === "theorist" ? (m.theoristName ?? "Unattributed")
    : (m.register ? (REG[m.register] ?? m.register) : "Unspecified");

  const cmp = (a: MT, b: MT): number =>
    sort === "views" ? b.view - a.view
    : sort === "new" ? (b.created ?? "").localeCompare(a.created ?? "")
    : b.films - a.films;

  const groups = new Map<string, MT[]>();
  for (const m of items) { const k = keyOf(m); const a = groups.get(k) ?? []; a.push(m); groups.set(k, a); }
  const ordered = [...groups.entries()]
    .map(([name, list]) => ({ name, list: list.sort(cmp), films: list.reduce((s, m) => s + m.films, 0) }))
    .sort((a, b) => Number(a.name === "Unspecified" || a.name === "Uncategorised" || a.name === "Unattributed") - Number(b.name === "Unspecified" || b.name === "Uncategorised" || b.name === "Unattributed") || b.films - a.films);

  const hrefGroup = (g: Group) => `/meta-takes?group=${g}&sort=${sort}`;
  const hrefSort = (s: Sort) => `/meta-takes?group=${group}&sort=${s}`;
  const metric = (m: MT) =>
    sort === "views" ? `${m.view.toLocaleString()} views`
    : sort === "new" ? (m.created ? String(new Date(m.created).getFullYear()) : "—")
    : `${m.films}`;

  return (
    <div className="mt">
      <MetatakeNav active="takes" />
      <div className="mt-wrap">
        <h1 className="mt-h1">Meta takes</h1>

        <div className="mt-tabs">
          {(["family", "register", "theorist"] as Group[]).map((g) => (
            group === g
              ? <span key={g} style={{ color: "var(--ink)" }}>{GROUP_LABEL[g]}</span>
              : <Link key={g} href={hrefGroup(g)}>{GROUP_LABEL[g]}</Link>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--subtle)" }}>{total} published</span>
        </div>

        <div className="mt-sortbar">
          <span className="mt-sortbar__lbl">Sort</span>
          {(["films", "views", "new"] as Sort[]).map((s) => (
            sort === s
              ? <span key={s} className="on">{SORT_LABEL[s]}</span>
              : <Link key={s} href={hrefSort(s)}>{SORT_LABEL[s]}</Link>
          ))}
        </div>

        <p className="mt-sortbar__hint">{GROUP_HINT[group]}</p>

        <ListFilter targetId="mt-list" total={total} placeholder="Filter meta takes…" />
        <div id="mt-list">
        {ordered.map((g) => (
          <div key={g.name} data-filter-group style={{ marginTop: 14 }}>
            <div className="mt-h2" style={{ fontSize: 13, marginBottom: 6 }}>{g.name} <span data-filter-count style={{ fontWeight: 350, color: "var(--subtle)" }}>{g.list.length}</span></div>
            <div className="mt-cols">
              {g.list.map((m) => (
                <div key={m.id} data-filter-item data-filter-text={m.title.toLowerCase()}>
                  <Link href={`/take/${m.slug}`}>{m.title}</Link>{" "}
                  <span style={{ color: "var(--subtle)" }}>{metric(m)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>

        {total === 0 && <p style={{ color: "var(--muted)" }}>The catalogue is being assembled.</p>}
      </div>
    </div>
  );
}
