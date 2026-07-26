import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { num, tierOf, type NavHistRow } from "@/lib/room/format";
import RoomShell, { type NavChip, type RailCounts } from "@/components/room/RoomShell";
import SiteNav from "@/components/home2/SiteNav";
import "./room.css";
import "./room-v4.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Room",
  description: "Your cinematic asset operating system.",
  robots: { index: false, follow: false },
};

export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login?next=/room");

  /* Shell needs three things, fetched once here: NAV chip (+ its 30-day micro
     sparkline — spec §4) and the rail count badges (Slate/Holdings). */
  const [{ data: navRaw }, { data: pbRaw }, { data: histRaw }] = await Promise.all([
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("portfolio_breakdown"),
    supabase.rpc("me_nav_history", { p_days: 30 }),
  ]);
  const nav = (navRaw as {
    nav: number | string | null; n_watched?: number | string | null; n_scored?: number | string | null;
    essentials?: number | string | null; avg_standing?: number | string | null; lines?: number | string | null;
  } | null) ?? null;
  const pb = (pbRaw as { watched?: number; watchlist?: number } | null) ?? null;
  const hist = (histRaw as NavHistRow[] | null) ?? [];

  const navV = num(nav?.nav);
  const avgS = num(nav?.avg_standing);
  const chip: NavChip = {
    nav: navV,
    tier: tierOf(navV),
    spark: hist.map((h) => num(h.nav)).filter((v): v is number => v != null),
    watched: num(nav?.n_watched),
    scored: num(nav?.n_scored),
    essentials: num(nav?.essentials),
    avgStanding: avgS == null ? null : Math.round(avgS),
    lines: num(nav?.lines),
  };
  const counts: RailCounts = { collection: pb?.watched ?? undefined, watchlist: pb?.watchlist ?? undefined };

  // v4: the room lives under the global site nav (노헤드 종료 — 마이룸-v4 §1-2).
  return (
    <>
      <SiteNav />
      <RoomShell chip={chip} counts={counts}>{children}</RoomShell>
    </>
  );
}
