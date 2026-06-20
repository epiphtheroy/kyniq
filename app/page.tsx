import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import MetatakeNav from "@/components/MetatakeNav";
import HomeClient, { type HomeBundle } from "@/components/HomeClient";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Metatake — the unconscious lines between films",
  description:
    "A large-scale AI project that uses embeddings to map the unconscious lines between films — two films you'd never shelve together, and the reading they secretly share. Not reviews. Not ratings. Readings.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function loadBundle(): Promise<HomeBundle> {
  const supabase = db();
  for (let i = 0; i < 3; i++) {
    const { data } = await supabase.rpc("home_bundle");
    const b = data as HomeBundle | null;
    if (b && Array.isArray(b.pairs) && b.pairs.length > 0) return b;
    if (i < 2) await new Promise((r) => setTimeout(r, 500));
  }
  // Persistent empty/timeout (e.g. DB under heavy write load): throw so Next keeps
  // serving the last good statically-generated page instead of caching an empty one
  // (no featured pair, zero stats). It recovers automatically on the next good render.
  throw new Error("home_bundle returned empty after retries");
}

export default async function Home() {
  const bundle = await loadBundle();
  return (
    <div className="mt">
      <MetatakeNav />
      <HomeClient bundle={bundle} />
    </div>
  );
}
