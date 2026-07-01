import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import CodexExplorer, { type CodexRow } from "@/components/CodexExplorer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "The Metatake Score — films ranked by durable value, not popularity · Metatake",
  description:
    "The Metatake Score (MTS): our own estimate of the durable value a serious viewer gains from a film, the cost to unlock it, and the risk it disappoints. Search, filter by country/decade, dial your risk-aversion.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function ScorePage() {
  const [{ data: page }, { data: cc }] = await Promise.all([
    db().rpc("cinecodex_ranked", { p_sort: "u", p_lambda: 1.0, p_limit: 60, p_offset: 0 }),
    db().rpc("cinecodex_countries"),
  ]);
  const res = (page as { total: number; rows: CodexRow[] } | null) ?? { total: 0, rows: [] };
  const countries = (cc as { code: string; n: number }[] | null) ?? [];

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">The Metatake Score</h1>
        <p className="lh-def">
          Every film gets a <span className="term">Metatake Score</span> — our estimate of the durable value a serious
          viewer gains (V), the cost to unlock it (C) and the risk it disappoints (R). Ranked by net value, not
          popularity. Search, filter, dial your risk-aversion, and click any film to open its scores in place.{" "}
          <Link href="/score/about">How it works →</Link>
        </p>
        <CodexExplorer initialRows={res.rows} initialTotal={res.total} countries={countries} />
      </div>
    </div>
  );
}
