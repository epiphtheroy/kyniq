import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import MetatakeNav from "@/components/MetatakeNav";
import HomeClient, { type HomeBundle } from "@/components/HomeClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Metatake — the unconscious lines between films",
  description:
    "A large-scale AI project that uses embeddings to map the unconscious lines between films — two films you'd never shelve together, and the reading they secretly share. Not reviews. Not ratings. Readings.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const EMPTY: HomeBundle = {
  pairs: [], stats: { films: 0, figures: 0, takes: 0, metas: 0, tropes: 0 },
  doors: { meta: [], trope: [], director: [], concept: [] }, ticker: [],
};

export default async function Home() {
  const supabase = db();
  const { data } = await supabase.rpc("home_bundle");
  const bundle = (data as HomeBundle | null) ?? EMPTY;

  return (
    <div className="mt">
      <MetatakeNav />
      <HomeClient bundle={bundle} />
    </div>
  );
}
