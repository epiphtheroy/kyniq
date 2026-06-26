import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import MetatakeNav from "@/components/MetatakeNav";
import DirectorsIndex, { type DirFeat, type DirCat } from "@/components/indexes/DirectorsIndex";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Directors — the recurring obsessions of a filmography",
  description:
    "Not a filmography list. On Metatake a director is the sum of their obsessions — the signature readings and tropes that recur across a whole body of work.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function DirectorIndexPage() {
  const supabase = db();
  const [featuredRes, catRes] = await Promise.all([
    supabase.rpc("directors_featured", { p_n: 12 }),
    supabase.rpc("directors_catalogue"),
  ]);

  const featured = ((featuredRes.data as DirFeat[] | null) ?? []).filter((d) => d && d.tropesList?.length);
  const catalogue = (catRes.data as DirCat[] | null) ?? [];

  return (
    <div className="mt">
      <MetatakeNav active="directors" />
      <div className="mt-wrap idx">
        <h1 className="idx-h1">Directors</h1>

        <p className="idx-def">
          <b>Not a filmography list.</b> On Metatake a director is the sum of their obsessions. We break every film into
          its <span className="term">figures</span>, then compute what recurs across a whole body of work — the{" "}
          <span className="term">signature readings</span> and <span className="term t">signature tropes</span> that make
          a film unmistakably theirs.
        </p>

        <p className="idx-intro">
          <strong>{catalogue.length.toLocaleString()} directors.</strong> Each signature is shown with the{" "}
          <em>figure</em> that carries it — the concrete thing on screen, traced through one of the director&apos;s films.
          Start with one at random, then browse the catalogue below.
        </p>

        <DirectorsIndex featured={featured} catalogue={catalogue} />
      </div>
    </div>
  );
}
