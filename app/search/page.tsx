import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import OmniResults from "./OmniResults";
import "./omni.css";

/**
 * Metatake Search (/search) — the search-first face of the site, benchmarked on
 * Yandex: one box, an entity "object card", an image strip, mixed results with
 * breadcrumbs + keyword-in-context snippets, verticals, related searches.
 *
 * Engine: the unified hybrid runSearch (lexical v6 + essays-by-entity +
 * pgvector semantic, RRF-fused) — this page is presentation on top of it.
 *
 * 2026-08-04: the RESULTS moved to a browser fetch (OmniResults.tsx documents
 * why — 99.8% of this route's traffic was an unblockable sweep, and serving it
 * the live engine was 36% of all database time). What is left here renders with
 * no database work at all: the empty-state home still hits one small query for
 * its trending chips, and the results view is pure markup. The search box is a
 * plain GET form, so navigation itself still needs no JavaScript.
 */

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/* --------------------------------------------------------------- the page */

interface Props { searchParams: Promise<{ q?: string; v?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  return {
    title: { absolute: term ? `${term} — Metatake Search` : "Metatake Search — every film, reading, person, idea and place" },
    description: "One box over all of Metatake: 6,900 films, 27,000 readings, directors, theorists, ideas, places and the news — text or meaning, any language.",
    alternates: { canonical: "/search" },
    robots: term ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function OmniPage({ searchParams }: Props) {
  const { q, v } = await searchParams;
  const term = (q ?? "").trim().slice(0, 100);

  /* ---------- empty state: the Yandex-style home ---------- */
  if (term.length < 2) {
    let trending: string[] = [];
    try {
      const { data } = await db().from("now_articles").select("keyword").eq("status", "published")
        .order("published_at", { ascending: false }).limit(6);
      trending = [...new Set(((data ?? []) as { keyword: string | null }[]).map((r) => r.keyword).filter(Boolean) as string[])];
    } catch { /* chips are garnish */ }
    const examples = ["기생충", "hyperreality", "Tarkovsky", "a marriage dissolving in silence", "film noir", "Jean Baudrillard"];
    return (
      <div className="mt ox-home">
        <SiteNav />
        <main className="ox-home__main">
          <h1 className="ox-logo">Metatake <span>Search</span></h1>
          <p className="ox-tag">Every film, reading, person, idea and place on Metatake — one box. Text or meaning, any language.</p>
          <form action="/search" method="get" role="search" className="ox-box ox-box--big">
            <input name="q" type="search" placeholder="Search everything…" aria-label="Search everything on Metatake" autoComplete="off" />
            <button type="submit" aria-label="Search">⌕</button>
          </form>
          <div className="ox-chips">
            {trending.map((t) => <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="ox-chip ox-chip--hot">↗ {t}</Link>)}
            {examples.map((t) => <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="ox-chip">{t}</Link>)}
          </div>
          <p className="ox-foot">6,900 films · 27,000 readings · 4,700 tropes · 3,700 theorists · the locations · the news<br /></p>
        </main>
      </div>
    );
  }

  /* ---------- results: shell here, body fetched by the browser ---------- */
  return (
    <div className="mt ox">
      <SiteNav />
      <div className="ox-wrap">
        <header className="ox-head">
          <Link href="/search" className="ox-logo ox-logo--sm">Metatake <span>Search</span></Link>
          <form action="/search" method="get" role="search" className="ox-box">
            <input name="q" type="search" defaultValue={term} aria-label="Search everything on Metatake" autoComplete="off" />
            <button type="submit" aria-label="Search">⌕</button>
          </form>
        </header>
        <OmniResults term={term} verticalKey={v ?? "all"} />
      </div>
    </div>
  );
}
