import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import LineageTabsClient, { type IdxRow } from "@/components/LineageTabsClient";
import type { MvHub } from "@/app/movements/page";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Lineage — national cinemas, movements, awards & canons · Metatake",
  description:
    "Where a film comes from and where it sits in cinema's record: national cinemas and movements, the awards it won and the canons it entered. Browse any tradition to see the films that belong to it.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function LineageIndex() {
  const supabase = db();
  const [{ data: idx }, { data: mv }] = await Promise.all([
    supabase.rpc("lineage_index"),
    supabase.rpc("movements_index"),
  ]);
  const lists = (idx as IdxRow[] | null) ?? [];
  const mvd = (mv as { national: MvHub[]; movements: MvHub[] } | null) ?? { national: [], movements: [] };

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">Lineage</h1>
        <p className="lh-def">
          Where a film comes from and where it sits in cinema&apos;s record — its <span className="term">national cinema</span> and
          <span className="term"> movement</span>, the awards it won and the canons it entered. Pick a tradition to see its films;
          open a film&apos;s <em>Lineage</em> tab to see everything it belongs to.
        </p>
        <LineageTabsClient national={mvd.national ?? []} movements={mvd.movements ?? []} lists={lists} />
      </div>
    </div>
  );
}
