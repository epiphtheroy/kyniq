import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCollection } from "@/lib/room/loadCollection";
import { loadDirectorDestination, loadCanonDestination } from "@/lib/navigator/load";
import type { RoutePref } from "@/lib/navigator/route";
import NavigatorDrive from "@/components/room/NavigatorDrive";
import NavigatorPicker, { type PickDest } from "@/components/room/NavigatorPicker";
import "./navigator.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Navigator",
  description: "당신의 시네필 여정을 턴바이턴으로.",
  robots: { index: false, follow: false },
};

const PREFS: RoutePref[] = ["fewest", "fastest", "no_tolls"];
const slugify = (v: string | undefined) => (v || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120);
const NUM = (v: number | string | null | undefined) => (v == null ? 0 : typeof v === "string" ? parseFloat(v) || 0 : v);

export default async function NavigatorPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string; lineage?: string; label?: string; pref?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/room/navigator");

  const pref: RoutePref = PREFS.includes(sp.pref as RoutePref) ? (sp.pref as RoutePref) : "fewest";
  const dir = slugify(sp.dir);
  const lineage = slugify(sp.lineage);

  // pace = films marked seen with a watch date in the last 12 weeks (ledger-derived; §4.3)
  const since = new Date(Date.now() - 84 * 864e5).toISOString();
  const [collection, paceRes] = await Promise.all([
    loadCollection().catch(() => []),
    supabase.from("user_movies").select("watched_at", { count: "exact", head: true }).eq("seen", true).gte("watched_at", since),
  ]);
  const seenSlugs = new Set(collection.map((r) => r.slug));
  const pacePerWeek = paceRes.count && paceRes.count > 0 ? Math.max(0.25, paceRes.count / 12) : null;

  const admin = createAdminClient();

  const missing = (
    <div className="navd"><div className="arrived">
      <div className="big">이 목적지의 경로를 만들 수 없습니다.</div>
      <div style={{ color: "var(--sub)", fontSize: 13 }}>목록에서 다시 골라주세요.</div>
    </div></div>
  );

  if (dir) {
    const dirRow = await supabase.from("directors").select("name").eq("slug", dir).maybeSingle();
    const load = await loadDirectorDestination(admin, { slug: dir, name: (dirRow.data?.name as string) ?? undefined, country: "US", seenSlugs, pacePerWeek });
    return load ? <NavigatorDrive load={load} pref={pref} /> : missing;
  }
  if (lineage) {
    const label = typeof sp.label === "string" ? sp.label.slice(0, 80) : lineage;
    const load = await loadCanonDestination(admin, { lineageSlug: lineage, label, country: "US", seenSlugs, pacePerWeek });
    return load ? <NavigatorDrive load={load} pref={pref} /> : missing;
  }

  // no destination chosen → the "Where to?" picker
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

  return <NavigatorPicker directors={directors} canon={canon} />;
}
