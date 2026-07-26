import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCollection } from "@/lib/room/loadCollection";
import { loadDirectorDestination, loadCanonDestination, loadDecadeDestination, loadSubscriptionDestination, type DriveLoad } from "@/lib/navigator/load";
import type { RoutePref } from "@/lib/navigator/route";
import NavigatorShell, { type RailProps } from "@/components/room/NavigatorShell";
import { type PickDest } from "@/components/room/NavigatorPicker";
import "./navigator.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Navigator",
  description: "Your cinephile journey, turn by turn.",
  robots: { index: false, follow: false },
};

const PREFS: RoutePref[] = ["fewest", "fastest", "no_tolls"];
const slugify = (v: string | undefined) => (v || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120);
const NUM = (v: number | string | null | undefined) => (v == null ? 0 : typeof v === "string" ? parseFloat(v) || 0 : v);

export default async function NavigatorPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string; lineage?: string; label?: string; pref?: string; decade?: string; sub?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/room/navigator");

  const pref: RoutePref = PREFS.includes(sp.pref as RoutePref) ? (sp.pref as RoutePref) : "fewest";
  const dir = slugify(sp.dir);
  const lineage = slugify(sp.lineage);
  const label = typeof sp.label === "string" ? sp.label.slice(0, 80) : undefined;
  const decade = sp.decade ? parseInt(sp.decade, 10) : NaN;

  // pace = films marked seen with a watch date in the last 12 weeks (ledger-derived; §4.3)
  const since = new Date(Date.now() - 84 * 864e5).toISOString();
  const [collection, paceRes] = await Promise.all([
    loadCollection().catch(() => []),
    supabase.from("user_movies").select("watched_at", { count: "exact", head: true }).eq("seen", true).gte("watched_at", since),
  ]);
  const seenSlugs = new Set(collection.map((r) => r.slug));
  const pacePerWeek = paceRes.count && paceRes.count > 0 ? Math.max(0.25, paceRes.count / 12) : null;

  const admin = createAdminClient();

  // ── LEFT rail: the destination list (always computed, so it persists while the
  //    stage on the right swaps between drives) ──
  const [covRes, autRes] = await Promise.all([
    supabase.rpc("me_coverage", { p_min_total: 5, p_limit: 300 }),
    supabase.rpc("me_auteur_conquest", { p_limit: 60 }),
  ]);
  const directors: PickDest[] = (((autRes.data as { slug: string; name: string | null; seen: number | string | null; total: number | string | null; pct: number | string | null }[] | null) ?? [])
    .map((a) => ({ kind: "dir" as const, key: a.slug, label: a.name ?? a.slug, seen: NUM(a.seen), total: NUM(a.total), pct: Math.round(NUM(a.pct)) }))
    .filter((d) => d.pct < 100 && d.seen > 0 && d.total >= 8)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 12));
  const canon: PickDest[] = (((covRes.data as { slug: string; label: string; facet: string; seen: number | string | null; total: number | string | null; pct: number | string | null }[] | null) ?? [])
    .map((c) => ({ kind: "lineage" as const, key: c.slug, label: c.label, facet: c.facet, seen: NUM(c.seen), total: NUM(c.total), pct: Math.round(NUM(c.pct)) }))
    .filter((d) => d.pct < 100 && d.seen > 0 && d.total >= 8 && d.total <= 60)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 12));

  // Decade essentials (fixed 1950s–2010s cards). Coverage of the top-20 list is only
  // known once the drive loads, so cards carry a cheap seen∩decade hint (no ring).
  const DECADES = [2010, 2000, 1990, 1980, 1970, 1960, 1950];
  const decadeSeen = new Map<number, number>();
  for (const r of collection) {
    if (r.year == null) continue;
    const d0 = Math.floor(r.year / 10) * 10;
    if (d0 >= 1950 && d0 <= 2010) decadeSeen.set(d0, (decadeSeen.get(d0) ?? 0) + 1);
  }
  const decadeCard = (d: number): PickDest => ({ kind: "decade", key: String(d), label: `${d}s essentials`, seen: decadeSeen.get(d) ?? 0, total: 0, pct: 0 });
  const partial = DECADES.filter((d) => (decadeSeen.get(d) ?? 0) > 0);
  const decades: PickDest[] = (partial.length ? partial.sort((a, b) => (decadeSeen.get(b) ?? 0) - (decadeSeen.get(a) ?? 0)) : DECADES)
    .slice(0, 6).map(decadeCard);
  const sub: PickDest = { kind: "sub", key: "mine", label: "Best on your subscriptions", seen: 0, total: 0, pct: 0 };

  const rail: RailProps = { directors, canon, decades, sub };

  // ── RIGHT stage: the drive (when a destination is chosen) ──
  let drive: DriveLoad | null = null;
  let activeKey: string | undefined;
  let requested = false;

  if (dir) {
    requested = true;
    activeKey = `dir:${dir}`;
    const dirRow = await supabase.from("directors").select("name").eq("slug", dir).maybeSingle();
    drive = await loadDirectorDestination(admin, { slug: dir, name: (dirRow.data?.name as string) ?? undefined, country: "US", seenSlugs, pacePerWeek });
  } else if (lineage) {
    requested = true;
    activeKey = `lineage:${lineage}`;
    drive = await loadCanonDestination(admin, { lineageSlug: lineage, label: label ?? lineage, country: "US", seenSlugs, pacePerWeek });
  } else if (Number.isFinite(decade) && decade >= 1900 && decade <= 2100) {
    requested = true;
    const d0 = Math.floor(decade / 10) * 10;
    activeKey = `decade:${d0}`;
    drive = await loadDecadeDestination(admin, { decade, label, country: "US", seenSlugs, pacePerWeek });
  } else if (sp.sub) {
    requested = true;
    activeKey = "sub:mine";
    drive = await loadSubscriptionDestination(admin, { label, country: "US", seenSlugs, pacePerWeek });
  }

  return (
    <NavigatorShell
      rail={rail}
      drive={drive}
      pref={pref}
      activeKey={drive ? activeKey : undefined}
      notFound={requested && !drive}
    />
  );
}
