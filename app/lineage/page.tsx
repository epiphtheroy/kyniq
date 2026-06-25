import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Lineage — awards, canons & auteur lines of cinema",
  description:
    "Where films sit in cinema's record: festival and academy awards, the critics' and institutional canons, national honours, and auteur lines. Browse any list to see the films that belong to it.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type IdxRow = { facet: string; slug: string; label: string; parent_label: string | null; country: string | null; tier: string | null; film_count: number };

const GROUPS: { key: string; title: string; blurb: string }[] = [
  { key: "award", title: "Awards", blurb: "Festival top prizes, the Academy, the guilds and critics' circles." },
  { key: "canon", title: "Canons & lists", blurb: "The critics' and institutional polls — Sight & Sound, TSPDT, AFI, the registries." },
  { key: "national", title: "National honours & canons", blurb: "Country awards and national best-of lists across world cinema." },
  { key: "festival", title: "Festivals", blurb: "Festival sections and selections." },
  { key: "auteur", title: "Auteur lines", blurb: "A director's representative works — the spine of an auteur's filmography." },
];

export default async function LineageIndex() {
  const supabase = db();
  const { data } = await supabase.rpc("lineage_index");
  const rows = (data as IdxRow[] | null) ?? [];
  const byFacet = new Map<string, IdxRow[]>();
  for (const r of rows) { const a = byFacet.get(r.facet) ?? []; a.push(r); byFacet.set(r.facet, a); }

  return (
    <div className="mt">
      <MetatakeNav active="lineage" />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">Lineage</h1>
        <p className="lh-def">
          Every film carries a <span className="term">lineage</span> — the awards it won, the canons it entered, the
          auteur line it extends. This is the map of those lists. Pick any one to see the films that belong to it; open a
          film&apos;s <em>Lineage</em> tab to see everything it belongs to.
        </p>

        {GROUPS.map((g) => {
          const items = (byFacet.get(g.key) ?? []).filter((r) => r.film_count > 0);
          if (!items.length) return null;
          return (
            <section className="lh-grp" key={g.key}>
              <h2 className="lh-h2">{g.title} <span className="lh-cnt">{items.length}</span></h2>
              <p className="lh-blurb">{g.blurb}</p>
              <div className="lh-list">
                {items.map((r) => (
                  <Link className="lh-row" href={`/lineage/${r.slug}`} key={r.slug}>
                    <span className="lh-name">{r.label}</span>
                    {r.parent_label && r.parent_label !== r.label ? <span className="lh-meta"> · {r.parent_label}</span> : null}
                    {r.country ? <span className="lh-meta"> · {r.country.toUpperCase()}</span> : null}
                    <span className="lh-n">{r.film_count}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
