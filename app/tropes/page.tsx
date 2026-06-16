import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import ListFilter from "@/components/ListFilter";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Tropes — Metatake",
  description: "Recurring figure-types in cinema — the dramatic devices, situations and objects that return across films. A working catalogue for readers and writers.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Row = { slug: string; title: string; laconic: string | null; figures: number; films: number };

export default async function TropesIndex() {
  const supabase = db();
  const { data } = await supabase.from("trope_counts").select("slug, title, laconic, figures, films");
  const rows = ((data as Row[]) ?? []).sort((a, b) => b.films - a.films || b.figures - a.figures);

  return (
    <div className="mt">
      <MetatakeNav active="tropes" />
      <div className="mt-wrap">
        <h1 className="mt-h1" style={{ borderBottom: "none" }}>Tropes</h1>
        <p className="mt-laconic" style={{ margin: "0 0 6px", maxWidth: "64ch" }}>
          Recurring <strong>figure-types</strong> — the dramatic devices, situations and objects that return across films.
          Where a <Link href="/meta-takes" className="mt-link">meta take</Link> is a recurring <em>reading</em> (what something means),
          a trope is a recurring <em>kind of thing</em> (what it is). A working catalogue for readers — and for writers.
        </p>

        {rows.length === 0 ? (
          <p className="mt-see" style={{ fontStyle: "italic" }}>The trope catalogue is being assembled — types appear here as they are named.</p>
        ) : (
          <>
            <ListFilter targetId="trope-list" placeholder={`Search ${rows.length} tropes…`} />
            <ol className="tr-list" id="trope-list">
              {rows.map((r, i) => (
                <li key={r.slug} className="tr-item" data-filter-item data-filter-text={`${r.title} ${r.laconic ?? ""}`.toLowerCase()}>
                  <span className="tr-rank">{i + 1}</span>
                  <span className="tr-body">
                    <Link href={`/trope/${r.slug}`} className="tr-ttl">{r.title}</Link>
                    {r.laconic ? <span className="tr-lac">{r.laconic}</span> : null}
                    <span className="tr-stats">{r.figures} figures · {r.films} films</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
