import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import MetatakeNav from "@/components/MetatakeNav";
import IndexPattern, { type IdxFeature, type IdxItem } from "@/components/IndexPattern";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Meta takes — the readings that recur across cinema",
  description:
    "A meta take is a reading that recurs across films. Every film is built from figures; each figure carries a take; when a take recurs, it becomes a meta take. Browse them all.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function MetaTakesIndex() {
  const supabase = db();
  const [featuredRes, catRes] = await Promise.all([
    supabase.rpc("meta_takes_featured", { p_n: 12 }),
    supabase.rpc("meta_takes_catalogue"),
  ]);

  const featured = ((featuredRes.data as IdxFeature[] | null) ?? []).filter((f) => f && f.cases?.length);
  const catalogue = (catRes.data as IdxItem[] | null) ?? [];
  const total = catalogue.length;

  return (
    <div className="mt">
      <MetatakeNav active="takes" />
      <div className="mt-wrap idx">
        <h1 className="idx-h1">Meta takes</h1>

        <p className="idx-def">
          <b>What&apos;s a meta take?</b> Every film is built from <span className="term">figures</span> — a face,
          an object, a place, a scene. Each figure carries a <span className="term">take</span>: a reading of what it
          means. When the same reading recurs across many films, it becomes a <span className="term">meta take</span> —
          and below it gather, not lookalikes, but kin.
        </p>

        <p className="idx-intro">
          <strong>{total.toLocaleString()} of them so far.</strong> Not genres, not plots — the meanings films share.
          Each is a hub: pick one and a whole constellation of films gathers beneath it. This isn&apos;t a list to scroll
          past. It&apos;s <strong>{total.toLocaleString()} doors</strong>.
        </p>

        <IndexPattern featured={featured} catalogue={catalogue} rowBase="/take" unit="films" noun="meta takes" defaultSort="alpha" />
      </div>
    </div>
  );
}
