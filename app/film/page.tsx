import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import MetatakeNav from "@/components/MetatakeNav";
import FilmsIndex, { type FilmFeat, type FilmCat } from "@/components/indexes/FilmsIndex";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Films — read closely through their figures",
  description:
    "Not a movie database. Every film on Metatake is broken into its figures and the readings & tropes they carry, then wired to every other film that shares them.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function FilmIndexPage() {
  const supabase = db();
  const [featuredRes, catRes] = await Promise.all([
    supabase.rpc("films_featured", { p_n: 12 }),
    supabase.rpc("films_catalogue"),
  ]);

  const featured = ((featuredRes.data as FilmFeat[] | null) ?? []).filter((f) => f && f.readingList?.length);
  const catalogue = (catRes.data as FilmCat[] | null) ?? [];

  return (
    <div className="mt">
      <MetatakeNav active="films" />
      <div className="mt-wrap idx">
        <h1 className="idx-h1">Films</h1>

        <p className="idx-def">
          <b>Not a movie database.</b> Metatake reads each film through its <span className="term">figures</span> — the
          faces, objects, places and gestures critics single out — and the <span className="term">readings</span> &amp;{" "}
          <span className="term">tropes</span> those figures carry. A film here isn&apos;t a rating; it&apos;s a bundle of
          meanings, wired by AI embeddings to every other film that shares them.
        </p>

        <p className="idx-intro">
          <strong>Pick one and follow the thread.</strong> Each film opens onto its kin — not lookalikes, not the same
          genre or director, but films that <em>rhyme</em> in meaning. Start with one at random, then browse the
          catalogue below.
        </p>

        <FilmsIndex featured={featured} catalogue={catalogue} />
      </div>
    </div>
  );
}
