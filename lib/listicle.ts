/**
 * Deterministic ScreenRant-style listicle headline — no LLM, built purely
 * from data: distinct film count + first theorist's surname + entity name.
 * e.g. "49 Films That Can Be Read Through Kant's Sublime"
 */
export function listicle(
  name: string,
  theorist: string | null,
  films: { film_slug: string; film_title: string }[],
) {
  const slugs = new Set<string>();
  const titles: string[] = [];
  for (const r of films) {
    if (!slugs.has(r.film_slug)) {
      slugs.add(r.film_slug);
      if (titles.length < 2) titles.push(r.film_title);
    }
  }
  const n = slugs.size;
  const first = (theorist ?? "").split(/,|&|\band\b/)[0]?.trim() ?? "";
  const surname = first && !/^N\/A/i.test(first)
    ? (first.replace(/\([^)]*\)/g, "").trim().split(/\s+/).pop() ?? "")
    : "";
  const bare = surname ? name.replace(/^The\s+/i, "") : name;
  const poss = surname ? `${surname}’s ${bare}` : name;
  return { n, poss, f1: titles[0], f2: titles[1] };
}
