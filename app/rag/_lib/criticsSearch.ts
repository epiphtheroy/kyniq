/**
 * Critic sourcing via QUERY-TIME, domain-restricted web search.
 *
 * Instead of crawling + storing outlets (shallow, recency-biased, policy-fraught),
 * we search ONLY the allow-listed critic domains at ask-time and surface a SHORT
 * snippet + link — the search-engine posture (nothing of theirs is stored). This
 * gives full-archive coverage and results that are always relevant to the actual
 * question. Returns passages in the same shape the route already quotes from, so
 * the quotation guardrails + "only-cited" display are unchanged.
 *
 * Provider: Tavily (free tier, native `include_domains`). Gated by TAVILY_API_KEY;
 * returns [] when the key is absent so the route falls back to the stored snippets
 * (or to no critics) without breaking.
 */
import { createClient } from "@supabase/supabase-js";
import type { MagazinePassage } from "./quotation";

const SNIPPET_WORDS = 60;

// Curated fallback so live search works even if the magazines table can't be read.
// Merged with the allow-list domains pulled from the DB (the real source of truth).
const FALLBACK_DOMAINS = [
  "sensesofcinema.com", "reverseshot.org", "filmcomment.com", "inreviewonline.com",
  "cinema-scope.com", "lwlies.com", "filmint.nu", "defilmkrant.nl", "filmdienst.de",
  "bfi.org.uk", "criterion.com", "mubi.com", "notebook.mubi.com", "filmquarterly.org",
  "4columns.org", "screenslate.com", "slantmagazine.com", "rogerebert.com",
];

function domainOf(url: string): string {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

function shorten(text: string): string {
  const w = (text || "").replace(/\s+/g, " ").trim().split(" ");
  return w.slice(0, SNIPPET_WORDS).join(" ") + (w.length > SNIPPET_WORDS ? "…" : "");
}

let cache: { at: number; map: Map<string, string>; list: string[] } | null = null;
const TTL = 30 * 60 * 1000;

async function allowedDomains(): Promise<{ map: Map<string, string>; list: string[] }> {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const map = new Map<string, string>();
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.from("magazines").select("name,homepage_url");
    for (const m of (data ?? []) as { name: string; homepage_url: string | null }[]) {
      const d = domainOf(m.homepage_url ?? "");
      if (d) map.set(d, m.name);
    }
  } catch { /* fall back to the curated list below */ }
  for (const d of FALLBACK_DOMAINS) if (!map.has(d)) map.set(d, d.replace(/\.[a-z.]+$/, ""));
  const list = [...map.keys()].slice(0, 60); // keep the search request well-bounded
  cache = { at: Date.now(), map, list };
  return cache;
}

/** Domain-restricted critic search. Returns short, attributed, linkable passages. */
export async function searchCritics(query: string, k = 6): Promise<MagazinePassage[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const { map, list } = await allowedDomains();
  if (list.length === 0) return [];
  // Short / bare-name queries (e.g. just a director) search weakly inside a domain
  // filter; add light film context so a name reliably surfaces critic essays.
  const q = query.trim();
  const searchQ =
    q.split(/\s+/).length <= 3 && !/\b(film|films|cinema|movie|movies|director)\b/i.test(q)
      ? `${q} film`
      : q;
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: searchQ,
        include_domains: list,
        max_results: k,
        search_depth: "basic",
      }),
    });
    if (!r.ok) return [];
    const d = (await r.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
    };
    const out: MagazinePassage[] = [];
    for (const x of d.results ?? []) {
      const url = x.url ?? "";
      const snippet = shorten(x.content ?? "");
      if (!url || !snippet) continue;
      const yr = x.published_date ? Number(String(x.published_date).slice(0, 4)) : NaN;
      out.push({
        id: url,
        outlet: map.get(domainOf(url)) || domainOf(url) || "source",
        title: x.title ?? null,
        author: null,
        year: Number.isFinite(yr) ? yr : null,
        url,
        snippet,
      });
    }
    return out;
  } catch {
    return [];
  }
}
