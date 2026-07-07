import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";
import MineEntityIndex from "@/components/MineEntityIndex";
import { pageRobots } from "@/lib/seo";

/**
 * Concepts — the single canonical index of theoretical concepts.
 * Unified 2026-07-07 (terminology charter): primary list = the SM concept
 * registry (formerly /idea, noindex); the readings-corpus vocabulary that has
 * no registry entry yet is appended below, deduped by normalized name.
 */
export const revalidate = 1800;

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export const metadata: Metadata = {
  title: "Concepts — the ideas cinema is read through",
  description:
    "The concepts Metatake's readings turn on — ressentiment, the gaze, bare life, the uncanny and a thousand more — each linked to the films that stage it and the desk essays that put it to work.",
  alternates: { canonical: "/concept" },
  robots: pageRobots(true),
};

type SmRow = { slug: string; name: string; n: number };
type TakesRow = { slug: string; title: string; n: number };

const normName = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

export default async function ConceptIndex() {
  const supabase = db();
  const [{ data: smData }, { data: takesData }] = await Promise.all([
    supabase.rpc("sm_concept_index", { p_limit: 500 }),
    supabase.rpc("concept_index"),
  ]);
  const sm = (smData as SmRow[] | null) ?? [];
  const smNames = new Set(sm.map((r) => normName(r.name)));
  const extra = ((takesData as TakesRow[] | null) ?? []).filter((t) => !smNames.has(normName(t.title)));
  const total = sm.reduce((s, r) => s + r.n, 0);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="mt-crumb"><Link href="/theorist">Theory</Link> › <span>Concepts</span> · <Link href="/theorist">Theorists</Link> · <Link href="/tradition">Traditions</Link></div>
        <h1 className="lh-h1">Concepts</h1>
        <p className="lh-def">
          The ideas a reading turns on — the named concepts our Strong Misreadings and desk essays borrow to
          over-read a film. These {sm.length} concepts recur across {total.toLocaleString()} readings; open any to
          see every film that stages it. (Paired with the <Link href="/theorist">theorists</Link> who think them and
          the <Link href="/tradition">traditions</Link> they belong to.)
        </p>
        <LensQuickBar />
        <MineEntityIndex kind="concepts" hrefBase="/concept/" noun="concepts" />
        <div className="th-grid mtl-swap-out">
          {sm.map((r) => (
            <Link className="th-row" href={`/concept/${r.slug}`} key={r.slug}>
              <span className="th-name">{r.name}</span>
              <span className="th-n">{r.n}</span>
            </Link>
          ))}
        </div>
        {extra.length > 0 && (
          <section style={{ marginTop: 34 }}>
            <h2 className="cmap-h2">More critical vocabulary from the readings corpus</h2>
            <ul className="mt-cols" style={{ marginTop: 10 }}>
              {extra.map((c) => (
                <li key={c.slug}>
                  <Link href={`/concept/${c.slug}`}>{c.title}</Link> <span className="yr">({c.n})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
