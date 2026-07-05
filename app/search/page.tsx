import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import SearchBox from "@/components/SearchBox";
import { pageRobots } from "@/lib/seo";

export const revalidate = 60;
export const metadata: Metadata = {
  alternates: { canonical: "/search" },
  title: "Search — Metatake",
  description: "Search films, figures, meta takes, and directors on Metatake.",
  robots: pageRobots(false), // search results — never index
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Kind = "film" | "meta_take" | "figure" | "director" | "trope";
// is_catalog: optional — set (true) on Tier-2 catalog film rows once the RPC ships it; absent today.
interface Row { kind: Kind; slug: string; film_slug: string | null; title: string; sub: string; score: number; is_catalog?: boolean | null }

const GROUPS: { kind: Kind; label: string }[] = [
  { kind: "meta_take", label: "Meta takes" },
  { kind: "trope", label: "Tropes" },
  { kind: "film", label: "Films" },
  { kind: "figure", label: "Figures" },
  { kind: "director", label: "Directors" },
];
function hrefOf(r: Row): string {
  if (r.kind === "film") return `/film/${r.slug}`;
  if (r.kind === "meta_take") return `/take/${r.slug}`;
  if (r.kind === "trope") return `/trope/${r.slug}`;
  if (r.kind === "figure") return `/film/${r.film_slug}/figure/${r.slug}`;
  return `/director/${r.slug}`;
}

interface Props { searchParams: Promise<{ q?: string }>; }

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  let rows: Row[] = [];
  if (term.length >= 2) {
    const { data } = await db().rpc("search_site", { p_q: term, p_limit: 50 });
    rows = (data as Row[]) ?? [];
  }
  const byKind = (k: Kind) => rows.filter((r) => r.kind === k);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <h1 className="mt-h1">Search</h1>
        <div style={{ margin: "6px 0 14px" }}>
          <SearchBox variant="hero" />
        </div>

        {term.length < 2 ? (
          <p style={{ color: "var(--muted)" }}>Type at least two characters — films, figures, meta takes, directors.</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No results for “{term}”. Try a film title, a figure, a concept, or a director.</p>
        ) : (
          <>
            <p className="mt-sortbar__hint">{rows.length} result{rows.length === 1 ? "" : "s"} for “{term}”.</p>
            {GROUPS.map(({ kind, label }) => {
              const items = byKind(kind);
              if (items.length === 0) return null;
              return (
                <div key={kind} style={{ marginTop: 14 }}>
                  <div className="mt-h2" style={{ fontSize: 13, marginBottom: 6 }}>{label} <span style={{ fontWeight: 350, color: "var(--subtle)" }}>{items.length}</span></div>
                  <ul className="mt-list">
                    {items.map((r, i) => (
                      <li key={`${r.slug}:${i}`}>
                        <Link href={hrefOf(r)} className={kind === "meta_take" ? undefined : kind === "figure" ? "mt-fig" : undefined}>{r.title}</Link>
                        {r.is_catalog === true ? <span className="t2-chip">catalog</span> : null}
                        {r.sub ? <span className="meta"> — {r.sub}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
