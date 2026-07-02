import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import HomeV2 from "@/components/home2/HomeV2";
import { PLACEHOLDER, type HomeV2 as HomeV2Data } from "@/lib/home2";
import "@/app/home2.css";

// Same treatment as the live home ("/"): the home_v2_bundle_v2 RPC only changes
// ~nightly, so serve an edge-cached page (ISR) and cache the RPC result in the
// Data Cache. Shares the "home-v2" tag so both refresh together.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Metatake — new home (preview)",
  robots: { index: false, follow: false },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Pulls the real bundle from home_v2_bundle_v2(). Throws on total failure so a
// transient empty read isn't written into the Data Cache (unstable_cache does
// not cache thrown errors); the caller falls back to PLACEHOLDER instead.
async function fetchBundle(): Promise<HomeV2Data> {
  const { data } = await db().rpc("home_v2_bundle_v2");
  const b = data as HomeV2Data | null;
  if (b && Array.isArray(b.picks) && b.picks.length > 0 && b.stats?.films) return b;
  throw new Error("home_v2_bundle_v2 returned no usable data");
}

const getCachedBundle = unstable_cache(fetchBundle, ["home-v2-bundle-v2"], {
  revalidate: 3600,
  tags: ["home-v2"],
});

// Falls back to PLACEHOLDER so the preview never breaks while data is iterated on.
async function loadV2(): Promise<HomeV2Data> {
  try {
    return await getCachedBundle();
  } catch {
    return PLACEHOLDER;
  }
}

export default async function Home2AppPage() {
  const data = await loadV2();
  return <HomeV2 data={data} />;
}
