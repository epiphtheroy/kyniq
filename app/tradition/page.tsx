import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";
import MineEntityIndex from "@/components/MineEntityIndex";

export const revalidate = 1800;

export const metadata: Metadata = {
  alternates: { canonical: "/tradition" },
  title: "Traditions — the canon a reading leans on",
  description:
    "The scholarly traditions Metatake's Strong Misreadings lean on — the uncanny, the gaze, commodity fetishism, the state of exception and hundreds more — each linked to the films and the thinkers that carry it.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Row = { slug: string; title: string; sub_category: string | null; part: string | null; theorist: string | null; n: number };

// Drop the trailing "(Domain)" tag for a cleaner display name; keep it as a muted hint.
function clean(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim() || title;
}

export default async function TraditionIndex() {
  const { data } = await db().rpc("canon_index", { p_limit: 600 });
  const rows = (data as Row[] | null) ?? [];
  const total = rows.reduce((s, r) => s + r.n, 0);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="mt-crumb">
          <Link href="/theorist">Theory</Link> › <Link href="/idea">Concepts</Link> · <Link href="/theorist">Theorists</Link>
        </div>
        <h1 className="lh-h1">Traditions</h1>
        <p className="lh-def">
          The canonical theory a Strong Misreading leans on — the recognised tradition behind the lens. These {rows.length}{" "}
          traditions anchor {total.toLocaleString()} readings; open any to see every film that leans on it, and the{" "}
          <Link href="/theorist">thinkers</Link> who carry it. (Paired with the looser <Link href="/idea">concepts</Link>{" "}
          critics actually name.)
        </p>
        <LensQuickBar />
        <MineEntityIndex kind="traditions" hrefBase="/tradition/" noun="traditions" />
        <div className="th-grid mtl-swap-out">
          {rows.map((r) => (
            <Link className="th-row" href={`/tradition/${r.slug}`} key={r.slug}>
              <span className="th-name">
                {clean(r.title)}
                {r.theorist ? <span className="th-by"> — {r.theorist}</span> : null}
              </span>
              <span className="th-n">{r.n}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
