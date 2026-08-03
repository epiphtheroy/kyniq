// Published list sizes — the app's copy of lib/lineage.ts KNOWN_TRUE_SIZE.
//
// Some canons have a size that is a public fact, usually because it is in the
// name: "1001 Movies You Must See Before You Die" is 1,001 films whatever we
// hold. `lineage_lists.film_count` is our membership count, NOT that number —
// the website has never used it as the list's size, and neither should the app,
// because "1001 Movies · 159 films" reads as a broken list rather than as
// partial coverage of a real one.
//
// Only add entries whose size is a published fact. Keep this in step with
// lib/lineage.ts on the web (owner 08-03).
export const KNOWN_TRUE_SIZE: Record<string, number> = {
  "tspdt-1000": 1000,
  "1001-movies": 1001,
};

/** The published size of a list, when that size is a public fact. */
export function trueSizeOf(slug: string): number | null {
  return KNOWN_TRUE_SIZE[slug] ?? null;
}

const nf = (n: number) => n.toLocaleString();

/**
 * How many films to claim for a list. Where the published size is known and we
 * hold fewer, say both — never the bare membership count on its own.
 */
export function listSizeLabel(slug: string, held: number): { text: string; partial: boolean } {
  const all = trueSizeOf(slug);
  if (all && held < all) return { text: `${nf(held)} / ${nf(all)}`, partial: true };
  return { text: nf(held), partial: false };
}
