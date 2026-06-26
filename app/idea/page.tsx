import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Concepts — the ideas cinema is read through",
  description:
    "The concepts Metatake's Strong Misreadings turn on — ressentiment, the gaze, bare life, the uncanny and a thousand more — each linked to the films that stage them.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Row = { slug: string; name: string; n: number };

export default async function IdeaIndex() {
  const { data } = await db().rpc("sm_concept_index", { p_limit: 500 });
  const rows = (data as Row[] | null) ?? [];
  const total = rows.reduce((s, r) => s + r.n, 0);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <Link href="/theorist">Theorists</Link> · <Link href="/tradition">Traditions</Link></div>
        <h1 className="lh-h1">Concepts</h1>
        <p className="lh-def">
          The ideas a Strong Misreading turns on — the lens it borrows to over-read a film. These {rows.length} concepts
          recur across {total.toLocaleString()} readings; open any to see every film that stages it. (Paired with the{" "}
          <Link href="/theorist">theorists</Link> who think them and the <Link href="/tradition">traditions</Link> they belong to.)
        </p>
        <div className="th-grid">
          {rows.map((r) => (
            <Link className="th-row" href={`/idea/${r.slug}`} key={r.slug}>
              <span className="th-name">{r.name}</span>
              <span className="th-n">{r.n}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
