import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import LineageIndexClient from "@/components/LineageIndexClient";

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

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">Lineage</h1>
        <p className="lh-def">
          Every film carries a <span className="term">lineage</span> — the awards it won, the canons it entered, the
          auteur line it extends. This is the map of those lists. Pick any one to see the films that belong to it; open a
          film&apos;s <em>Lineage</em> tab to see everything it belongs to.
        </p>

        <LineageIndexClient rows={rows} groups={GROUPS} />
      </div>
    </div>
  );
}
