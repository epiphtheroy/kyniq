import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import HomeV2 from "@/components/home2/HomeV2";
import { PLACEHOLDER, type HomeV2 as HomeV2Data } from "@/lib/home2";
import "@/app/home2.css";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Metatake — new home (preview)",
  robots: { index: false, follow: false },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Pulls the real bundle from home_v2_bundle() (same shape as the contract).
// Falls back to PLACEHOLDER so the preview never breaks while data is iterated on.
async function loadV2(): Promise<HomeV2Data> {
  try {
    const { data } = await db().rpc("home_v2_bundle");
    const b = data as HomeV2Data | null;
    if (b && Array.isArray(b.picks) && b.picks.length > 0 && b.stats?.films) return b;
  } catch {
    /* fall through to placeholder */
  }
  return PLACEHOLDER;
}

export default async function Home2AppPage() {
  const data = await loadV2();
  return <HomeV2 data={data} />;
}
