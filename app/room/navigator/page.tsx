import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCollection } from "@/lib/room/loadCollection";
import { loadDirectorDestination } from "@/lib/navigator/load";
import type { RoutePref } from "@/lib/navigator/route";
import NavigatorDrive from "@/components/room/NavigatorDrive";
import "./navigator.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Navigator",
  description: "당신의 시네필 여정을 턴바이턴으로.",
  robots: { index: false, follow: false },
};

const DEFAULT_DIR = "stanley-kubrick";
const PREFS: RoutePref[] = ["fewest", "fastest", "no_tolls"];

export default async function NavigatorPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string; pref?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/room/navigator");

  const dirSlug = (sp.dir || DEFAULT_DIR).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120) || DEFAULT_DIR;
  const pref: RoutePref = PREFS.includes(sp.pref as RoutePref) ? (sp.pref as RoutePref) : "fewest";

  const [collection, dirRow] = await Promise.all([
    loadCollection().catch(() => []),
    supabase.from("directors").select("name").eq("slug", dirSlug).maybeSingle(),
  ]);
  const seenSlugs = new Set(collection.map((r) => r.slug));
  const name = (dirRow.data?.name as string | undefined) ?? undefined;

  const admin = createAdminClient();
  const load = await loadDirectorDestination(admin, {
    slug: dirSlug,
    name,
    country: "US",
    seenSlugs,
    pacePerWeek: null, // ETA hidden until pace is wired (§4.3 honest default)
  });

  // The room layout (app/room/layout.tsx) already provides SiteNav + the room
  // bar + RoomShell's main; this page renders only the drive view inside it.
  return load ? (
    <NavigatorDrive load={load} pref={pref} />
  ) : (
    <div className="navd"><div className="arrived">
      <div className="big">이 목적지의 경로를 만들 수 없습니다.</div>
      <div style={{ color: "var(--sub)", fontSize: 13 }}>감독 슬러그를 확인해 주세요 (예: <code>?dir=akira-kurosawa</code>).</div>
    </div></div>
  );
}
