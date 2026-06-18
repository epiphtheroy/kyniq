import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import MetatakeNav from "@/components/MetatakeNav";
import IndexPattern, { type IdxFeature, type IdxItem } from "@/components/IndexPattern";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Meta takes — the readings that recur across cinema",
  description:
    "A meta take is a critical reading that recurs across unrelated films, reached through a different figure each time. Browse every published meta take.",
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

  return (
    <div className="mt">
      <MetatakeNav active="takes" />
      <div className="mt-wrap idx">
        <h1 className="idx-h1">Meta takes</h1>

        <p className="idx-def">
          A <span className="term">meta take</span> is a critical reading that recurs across unrelated films —
          each time reached through a different <b>figure</b>: a character, an object, a place, a formal choice.
          Metatake gathers them so you can follow the <b>idea</b>, not just the instance.
        </p>

        <p className="idx-intro">
          {catalogue.length > 0 ? (
            <>
              <strong>{catalogue.length.toLocaleString()}</strong> readings published so far, each one assembled from
              the films where it surfaces. Below: a rotating sample, then the full catalogue.
            </>
          ) : (
            <>The catalogue is being assembled.</>
          )}
        </p>

        <IndexPattern featured={featured} catalogue={catalogue} rowBase="/take" unit="films" defaultSort="alpha" />
      </div>
    </div>
  );
}
