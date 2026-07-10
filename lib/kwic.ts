import { DESKS, DESK_KEYS, mdToPlain } from "@/lib/desks";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * KWIC excerpts for essay previews on theory pages (2026-07-08): show MORE
 * text, and show the passage where the page's subject term actually appears
 * — not just the essay's opening. Deterministic string work only.
 */

/** Excerpt ±radius around the first occurrence of any term (word-boundary
 *  trimmed); falls back to the opening when no term matches. */
export function kwic(text: string, terms: string[], radius = 220): string {
  const clean = terms.map((t) => t.trim()).filter((t) => t.length >= 3);
  const lower = text.toLowerCase();
  let hit = -1;
  for (const t of clean) {
    const i = lower.indexOf(t.toLowerCase());
    if (i !== -1 && (hit === -1 || i < hit)) hit = i;
  }
  if (hit === -1) {
    const head = text.slice(0, radius * 2);
    return head.length < text.length ? head.replace(/\s+\S*$/, "") + "…" : head;
  }
  let start = Math.max(0, hit - radius);
  let end = Math.min(text.length, hit + radius);
  if (start > 0) start = lower.indexOf(" ", start) + 1 || start;
  if (end < text.length) end = lower.lastIndexOf(" ", end);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

const MODE_BY_KEY = new Map(DESK_KEYS.map((k) => [k as string, DESKS[k].mode]));

/**
 * Attach KWIC excerpts (built from the full essay bodies) to desk links.
 * One batched query; each pair matched on (film_slug, mode). Failures leave the
 * original excerpt untouched.
 */
export async function attachKwic<T extends { film_slug: string; desk_key: string; excerpt?: string | null }>(
  supabase: SupabaseClient,
  desks: T[],
  terms: string[],
  cap = 12,
): Promise<(T & { excerpt: string | null })[]> {
  const subset = desks.slice(0, cap);
  try {
    const slugs = [...new Set(subset.map((d) => d.film_slug))];
    if (!slugs.length) return desks.map((d) => ({ ...d, excerpt: d.excerpt ?? null }));
    // Fast path: essay_plain (0057) holds pre-stripped bodies keyed by
    // (film_slug, desk_key) — a tiny PK lookup instead of body_md + md-strip.
    const { data: plainRows } = await supabase
      .from("essay_plain").select("film_slug, desk_key, plain").in("film_slug", slugs);
    const plain = new Map<string, string>();
    for (const r of (plainRows ?? []) as { film_slug: string; desk_key: string; plain: string }[]) {
      plain.set(`${r.film_slug}/${r.desk_key}`, r.plain);
    }
    if (plain.size) {
      return desks.map((d) => {
        const p = plain.get(`${d.film_slug}/${d.desk_key}`);
        return { ...d, excerpt: p ? kwic(p, terms) : d.excerpt ?? null };
      });
    }
    // Fallback (essay_plain empty/unreachable): the original live body_md path.
    const modes = [...new Set(subset.map((d) => MODE_BY_KEY.get(d.desk_key)).filter(Boolean))] as string[];
    if (!modes.length) return desks.map((d) => ({ ...d, excerpt: d.excerpt ?? null }));
    const { data } = await supabase
      .from("essays")
      .select("mode, body_md, film:films!inner(slug)")
      .in("mode", modes)
      .eq("lang", "en")
      .eq("status", "verified")
      .in("film.slug", slugs);
    const bodies = new Map<string, string>();
    for (const row of (data ?? []) as unknown as { mode: string; body_md: string; film: { slug: string } }[]) {
      bodies.set(`${row.film.slug}/${row.mode}`, row.body_md);
    }
    return desks.map((d) => {
      const mode = MODE_BY_KEY.get(d.desk_key);
      const body = mode ? bodies.get(`${d.film_slug}/${mode}`) : undefined;
      return { ...d, excerpt: body ? kwic(mdToPlain(body), terms) : d.excerpt ?? null };
    });
  } catch {
    return desks.map((d) => ({ ...d, excerpt: d.excerpt ?? null }));
  }
}
