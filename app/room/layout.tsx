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

  const [{ data: navRaw }, { data: pbRaw }] = await Promise.all([
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("portfolio_breakdown"),
  ]);
  const nav = (navRaw as { nav: number | null; essentials?: number } | null) ?? null;
  const pb = (pbRaw as { watched?: number; watchlist?: number } | null) ?? null;

  const chip: NavChip = { nav: nav?.nav ?? null, tier: tierOf(nav?.nav ?? null) };
  const counts: RailCounts = { collection: pb?.watched ?? undefined, watchlist: pb?.watchlist ?? undefined };
  const ticker = [
    { icon: "ti-diamond", text: "Cinecodex 6,701편 채점 완료 · 펀더멘털 등급 활성" },
    { icon: "ti-flame", text: "정전가 v2-fixA 재계산 · Vertigo 84.5" },
    { icon: "ti-target-arrow", text: "WWI 추천 갱신 · 위험(R) 필터 가동" },
    { icon: "ti-star", text: `내 자산 ${pb?.watched ?? 0}편 관람 · ${pb?.watchlist ?? 0}편 후보` },
  ];

  return <RoomShell chip={chip} counts={counts} ticker={ticker}>{children}</RoomShell>;
}
