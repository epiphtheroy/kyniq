import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import MovementsIndexClient from "@/components/MovementsIndexClient";

export const revalidate = 1800;

// Phase-0 origins finalized → indexable. (card links read `slug`; RPC returns hub_slug as slug)
export const metadata: Metadata = {
  title: "Movements — national cinemas & film movements · Metatake",
  description:
    "Browse cinema by where it comes from and the tradition it belongs to: national cinemas (Korean, Iranian, Japanese…) and the waves & movements (Neorealism, the Nouvelle Vague, Dogme 95…).",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export type MvHub = {
  slug: string; label: string; film_count: number; thumbs: string[];
  region?: string | null; tier?: string | null; hub_type?: string | null;
  status?: string | null; country_code?: string | null; description?: string | null;
};

export default async function MovementsIndex() {
  const supabase = db();
  const { data } = await supabase.rpc("movements_index");
  const idx = (data as { national: MvHub[]; movements: MvHub[] } | null) ?? { national: [], movements: [] };

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">Movements</h1>
        <p className="lh-def">
          Cinema by <span className="term">where it comes from</span> and the tradition it belongs to — the
          <strong> national cinemas</strong> of the world and the <strong>waves &amp; movements</strong> that cut across
          them. Open any one to read its canon, its auteurs, and where to start.
        </p>
        <MovementsIndexClient national={idx.national ?? []} movements={idx.movements ?? []} />
      </div>
    </div>
  );
}
