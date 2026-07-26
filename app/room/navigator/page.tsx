import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCollection } from "@/lib/room/loadCollection";
import { loadDirectorDestination, loadCanonDestination, loadDecadeDestination, loadSubscriptionDestination, type DriveLoad } from "@/lib/navigator/load";
import type { RoutePref } from "@/lib/navigator/route";
import NavigatorShell, { type RailProps } from "@/components/room/NavigatorShell";
import { type PickDest, type CatalogEntry } from "@/components/room/NavigatorPicker";
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
    .slice(0, 16));
  // The full My-Room coverage list (canon/critics/festival/award/national), every drivable
  // lineage not yet complete — in-progress first, then unstarted. The owner asked for all of
  // them listed, not just the in-progress few. (Rail scrolls; 300-row RPC, capped at 40 cards.)
  const canon: PickDest[] = (((covRes.data as { slug: string; label: string; facet: string; seen: number | string | null; total: number | string | null; pct: number | string | null }[] | null) ?? [])
    .map((c) => ({ kind: "lineage" as const, key: c.slug, label: c.label, facet: c.facet, seen: NUM(c.seen), total: NUM(c.total), pct: Math.round(NUM(c.pct)) }))
    .filter((d) => d.pct < 100 && d.total >= 8)
    .sort((a, b) => b.pct - a.pct || b.total - a.total)
    .slice(0, 40));

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

  // ── Full list catalog for the "All lists" browse-all — loaded only when the
  //    picker is on screen (no destination chosen), so a drive never pays for it.
  //    lineage_index is the whole vocabulary (national/award/canon/auteur/festival);
  //    movements are merged in only if the index doesn't already carry them. The
  //    viewer's me_coverage is overlaid by slug so browsed lists keep their ring. ──
  const wantPicker = !dir && !lineage && !(Number.isFinite(decade) && decade >= 1900 && decade <= 2100) && !sp.sub;
  const catalog: CatalogEntry[] = [];
  if (wantPicker) {
    const [idxRes, mvRes] = await Promise.all([
      supabase.rpc("lineage_index"),
      supabase.rpc("movements_index"),
    ]);
    const covBySlug = new Map<string, { seen: number; total: number; pct: number }>();
    for (const c of ((covRes.data as { slug: string; seen: number | string | null; total: number | string | null; pct: number | string | null }[] | null) ?? [])) {
      covBySlug.set(c.slug, { seen: NUM(c.seen), total: NUM(c.total), pct: Math.round(NUM(c.pct)) });
    }
    const seenListSlugs = new Set<string>();
    for (const r of ((idxRes.data as LineageIdxRow[] | null) ?? [])) {
      if (Number(r.film_count ?? 0) <= 0) continue;
      seenListSlugs.add(r.slug);
      catalog.push({ slug: r.slug, label: r.label, facet: r.facet, film_count: Number(r.film_count ?? 0), ...(covBySlug.get(r.slug) ?? {}) });
    }
    const mv = (mvRes.data as { movements?: MvHubRow[] } | null) ?? {};
    for (const h of (mv.movements ?? [])) {
      if (Number(h.film_count ?? 0) <= 0 || seenListSlugs.has(h.slug)) continue;
      catalog.push({ slug: h.slug, label: h.label, facet: "movement", film_count: Number(h.film_count ?? 0), ...(covBySlug.get(h.slug) ?? {}) });
    }
  }

  const rail: RailProps = { directors, canon, decades, sub, catalog };

  // ── RIGHT stage: the drive (when a destination is chosen) ──
  let drive: DriveLoad | null = null;
  let activeKey: string | undefined;
  let requested = false;
  let destKind: string | undefined, destKey: string | undefined, destLabel: string | undefined;

  if (dir) {
    requested = true;
    activeKey = `dir:${dir}`;
    const dirRow = await supabase.from("directors").select("name").eq("slug", dir).maybeSingle();
    const dName = (dirRow.data?.name as string) ?? dir;
    drive = await loadDirectorDestination(admin, { slug: dir, name: dName, country: "US", seenSlugs, pacePerWeek });
    [destKind, destKey, destLabel] = ["dir", dir, dName];
  } else if (lineage) {
    requested = true;
    activeKey = `lineage:${lineage}`;
    const lbl = label ?? lineage;
    drive = await loadCanonDestination(admin, { lineageSlug: lineage, label: lbl, country: "US", seenSlugs, pacePerWeek });
    [destKind, destKey, destLabel] = ["lineage", lineage, lbl];
  } else if (Number.isFinite(decade) && decade >= 1900 && decade <= 2100) {
    requested = true;
    const d0 = Math.floor(decade / 10) * 10;
    activeKey = `decade:${d0}`;
    drive = await loadDecadeDestination(admin, { decade, label, country: "US", seenSlugs, pacePerWeek });
    [destKind, destKey, destLabel] = ["decade", String(d0), label ?? `${d0}s essentials`];
  } else if (sp.sub) {
    requested = true;
    activeKey = "sub:mine";
    drive = await loadSubscriptionDestination(admin, { label, country: "US", seenSlugs, pacePerWeek });
    [destKind, destKey, destLabel] = ["sub", "mine", label ?? "Best on your subscriptions"];
  }

  // Persist the active drive so /room/navigator can offer "Resume". Position/progress stay
  // ledger-derived (§10-1) — we store only WHICH destination + pref. Arriving (no next film)
  // retires it. Never let a resume write break the drive page.
  if (drive && destKind && destKey) {
    const arrived = !drive.routes[pref]?.next;
    try {
      if (arrived) await supabase.rpc("me_nav_arrive", { p_dest_kind: destKind, p_dest_key: destKey });
      else await supabase.rpc("me_nav_start", { p_dest_kind: destKind, p_dest_key: destKey, p_dest_label: destLabel ?? destKey, p_route_pref: pref });
    } catch { /* resume is best-effort */ }
  }

  // The member's active drive → the rail's "Resume" card (unless it's the one already open).
  let resume: { label: string; href: string; kind: string } | null = null;
  try {
    const { data: activeData } = await supabase.rpc("me_nav_active");
    const row = (((activeData as ActiveDrive[] | null) ?? [])[0]) ?? null;
    if (row && `${row.dest_kind}:${row.dest_key}` !== activeKey) {
      resume = { kind: row.dest_kind, label: row.dest_label ?? row.dest_key, href: resumeHref(row) };
    }
  } catch { /* no resume is fine */ }

  return (
    <NavigatorShell
      rail={rail}
      drive={drive}
      pref={pref}
      activeKey={drive ? activeKey : undefined}
      notFound={requested && !drive}
      resume={resume}
    />
  );
}

interface ActiveDrive { dest_kind: string; dest_key: string; dest_label: string | null; route_pref: string | null; }

/** lineage_index row (public RPC — same one /lineage & /room/locations read). */
interface LineageIdxRow { facet: string; slug: string; label: string; country: string | null; film_count: number | string | null; }
/** movements_index().movements hub (public RPC — a movement that IS a lineage list). */
interface MvHubRow { slug: string; label: string; film_count: number | string | null; }

/** Build the drive URL for a stored active drive (the "Resume" link). */
function resumeHref(r: ActiveDrive): string {
  const p = new URLSearchParams();
  if (r.dest_kind === "dir") p.set("dir", r.dest_key);
  else if (r.dest_kind === "lineage") { p.set("lineage", r.dest_key); if (r.dest_label) p.set("label", r.dest_label); }
  else if (r.dest_kind === "decade") { p.set("decade", r.dest_key); if (r.dest_label) p.set("label", r.dest_label); }
  else { p.set("sub", "1"); if (r.dest_label) p.set("label", r.dest_label); }
  if (r.route_pref && r.route_pref !== "fewest") p.set("pref", r.route_pref);
  return `/room/navigator?${p.toString()}`;
}
