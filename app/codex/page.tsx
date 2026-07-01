import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import CodexExplorer, { type CodexRow } from "@/components/CodexExplorer";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "The Codex — films ranked by durable value, not popularity · Metatake",
  description:
    "Metatake's own estimate of the durable value a serious viewer gains from a film, the cost to unlock it, and the risk it disappoints. Sort by net value, dial your risk-aversion, and find the films least likely to waste your time.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function CodexPage() {
  const { data } = await db().rpc("cinecodex_ranked", { p_sort: "v", p_lambda: 1.0, p_max_cost: 100, p_limit: 3000, p_offset: 0 });
  const rows = (data as CodexRow[] | null) ?? [];
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">The Codex</h1>
        <p className="lh-def">
          Films ranked by the <span className="term">durable value</span> a serious viewer gains — not popularity. Every
          film carries a value (V), an entry cost (C) and a risk it disappoints (R). Dial your risk-aversion and sort to
          find what&apos;s least likely to waste your time. <em>AI-estimated; shown as a rubric-anchored judgment, not fact.</em>
        </p>
        <CodexExplorer rows={rows} />
      </div>
    </div>
  );
}
