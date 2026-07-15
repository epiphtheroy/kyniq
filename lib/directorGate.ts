/**
 * Director-hub indexability gate (2026-07-15, HANDOFF-Tier2-메인통합.md §4 D6).
 *
 * Until now every director hub was indexed (no robots gate), including ~506
 * single-film hubs with an empty editorial layer (portrait/facts/picks/next = 0)
 * — exactly the thin/scaled pattern the consolidation work is fighting. This is
 * the SINGLE source of truth for "does a director hub carry enough substance to
 * index", shared by the hub page's generateMetadata (via pageRobots) and the
 * sitemap's directorEntries, so the two can never drift.
 *
 * ⚠️ Unlike the film gate, mirroring the *existence* condition is vacuous here:
 * a hub only exists when the director has ≥1 visible film (which is already
 * indexable), so the bar must measure the HUB'S OWN substance. The last clause
 * — (receptionN + honorsN) ≥ 6 — is only legitimate BECAUSE D2/D3 render that
 * press/honors record in the hub body; it must ship in the SAME deploy.
 *
 * The predicate is pure quality. The SITE_INDEXABLE master switch is applied by
 * pageRobots (page) and the `if (!SITE_INDEXABLE) return []` guard (sitemap), so
 * it is intentionally NOT repeated here.
 */

// Structural supertype of the hub's cached payload — accepts the real arrays
// (Pick[]/Next[]/Fact[]) the page holds AND the light {length} objects the
// sitemap builds, so directorIndexBar(data) type-checks in both callers.
export type DirectorIndexSignals = {
  total: number;
  portrait?: unknown;
  facts?: { facts?: { length: number } | null } | null;
  picks?: { length: number } | null;
  next?: { length: number } | null;
  receptionN?: number;
  honorsN?: number;
};

export function directorIndexBar(d: DirectorIndexSignals): boolean {
  const total = d.total ?? 0;
  const picks = d.picks?.length ?? 0;
  const next = d.next?.length ?? 0;
  const facts = d.facts?.facts?.length ?? 0;
  const reception = d.receptionN ?? 0;
  const honors = d.honorsN ?? 0;
  return (
    total >= 2 ||
    !!d.portrait ||
    facts >= 4 ||
    picks >= 3 ||
    next >= 3 ||
    reception + honors >= 6
  );
}
