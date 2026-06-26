import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Theorists — the thinkers cinema is read through",
  description:
    "Every theorist Metatake reads films through — Freud, Lacan, Foucault, Arendt and hundreds more — each linked to the Strong Misreadings that invoke them.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Row = { slug: string; name: string; blurb: string | null; n: number };

export default async function TheoristIndex() {
  const { data } = await db().rpc("theorist_index");
  const rows = (data as Row[] | null) ?? [];
  const total = rows.reduce((s, r) => s + r.n, 0);

  return (
    <div className="mt">
      <MetatakeNav active="theory" />
      <div className="mt-wrap lh">
        <div className="mt-crumb"><Link href="/concept">Theory</Link></div>
        <h1 className="lh-h1">Theorists</h1>
        <p className="lh-def">
          The thinkers Metatake reads films <em>through</em>. Each Strong Misreading borrows a lens — a theorist and a
          concept — and this is the roll of those minds, {rows.length} of them across {total.toLocaleString()} readings.
          Open any one to see every film read in their light.
        </p>
        <div className="th-grid">
          {rows.map((r) => (
            <Link className="th-row" href={`/theorist/${r.slug}`} key={r.slug}>
              <span className="th-name">{r.name}</span>
              <span className="th-n">{r.n}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
