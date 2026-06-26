import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import HomeV2 from "@/components/home2/HomeV2";
import { PLACEHOLDER, type HomeV2 as HomeV2Data } from "@/lib/home2";
import "@/app/home2.css";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Metatake — a critical map of cinema",
  description:
    "Read films closely — a critical map of cinema that links films through the readings they share. Strong Misreadings, tropes, directors, concepts and the canon, all on one map.",
  alternates: { canonical: "/" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Real home bundle from home_v2_bundle() (same shape as the contract).
// Falls back to PLACEHOLDER so the home never renders empty under DB write-load.
async function loadV2(): Promise<HomeV2Data> {
  for (let i = 0; i < 3; i++) {
    try {
      const { data } = await db().rpc("home_v2_bundle");
      const b = data as HomeV2Data | null;
      if (b && Array.isArray(b.picks) && b.picks.length > 0 && b.stats?.films) return b;
    } catch {
      /* retry */
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 400));
  }
  return PLACEHOLDER;
}

export default async function Home() {
  const data = await loadV2();
  return <HomeV2 data={data} />;
}
