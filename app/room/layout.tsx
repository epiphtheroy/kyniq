import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import RoomShell, { type NavChip, type RailCounts } from "@/components/room/RoomShell";
import "./room.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Room — Metatake",
  description: "Your cinematic asset operating system.",
  robots: { index: false, follow: false },
};

function tierOf(nav: number | null): string {
  if (nav == null) return "형성 중";
  if (nav >= 90) return "APEX";
  if (nav >= 70) return "ESTABLISHED";
  if (nav >= 45) return "BUILDING";
  return "FORMING";
}

export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login?next=/room");

  /* v2: 티커·시스템카드 삭제(라이브피드 폐지) — 셸에 필요한 건 NAV chip + 레일 카운트뿐 */
  const [{ data: navRaw }, { data: pbRaw }] = await Promise.all([
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("portfolio_breakdown"),
  ]);
  const nav = (navRaw as { nav: number | null } | null) ?? null;
  const pb = (pbRaw as { watched?: number; watchlist?: number } | null) ?? null;

  const chip: NavChip = { nav: nav?.nav ?? null, tier: tierOf(nav?.nav ?? null) };
  const counts: RailCounts = { collection: pb?.watched ?? undefined, watchlist: pb?.watchlist ?? undefined };

  return <RoomShell chip={chip} counts={counts}>{children}</RoomShell>;
}
