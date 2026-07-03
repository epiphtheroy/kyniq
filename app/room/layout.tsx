import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import RoomShell, { type NavChip, type RailCounts, type SystemStatus } from "@/components/room/RoomShell";
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

type Sys = {
  scored_films?: number | null; model_version?: string | null; standing_last?: string | null;
  taste_vectors?: number | null; films_visible?: number | null; locations?: number | null;
  top_film?: { title: string; prestige: number } | null;
} | null;

export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login?next=/room");

  const [{ data: navRaw }, { data: pbRaw }, { data: sysRaw }] = await Promise.all([
    supabase.rpc("me_portfolio_nav"),
    supabase.rpc("portfolio_breakdown"),
    supabase.rpc("me_system_status"),
  ]);
  const nav = (navRaw as { nav: number | null; essentials?: number } | null) ?? null;
  const pb = (pbRaw as { watched?: number; watchlist?: number } | null) ?? null;
  const sys = (sysRaw as Sys) ?? null;

  const chip: NavChip = { nav: nav?.nav ?? null, tier: tierOf(nav?.nav ?? null) };
  const counts: RailCounts = { collection: pb?.watched ?? undefined, watchlist: pb?.watchlist ?? undefined };

  /* 티커 = me_system_status 실측만 (no-fake-data — 값이 없으면 그 줄은 아예 안 띄움) */
  const fmt = (n?: number | null) => (n != null ? n.toLocaleString("ko-KR") : null);
  const ticker = [
    sys?.scored_films != null
      ? { icon: "ti-diamond", text: `Cinecodex ${fmt(sys.scored_films)}편 채점 · 펀더멘털 등급 활성` }
      : null,
    sys?.model_version
      ? { icon: "ti-flame", text: `정전가 모델 ${sys.model_version} · 최근 재계산 ${sys.standing_last ?? "—"}${sys.top_film ? ` · 최고 ${sys.top_film.title} ${sys.top_film.prestige}` : ""}` }
      : null,
    sys?.taste_vectors != null
      ? { icon: "ti-target-arrow", text: `취향 벡터 ${fmt(sys.taste_vectors)}편 활성 · WWI 위험(R) 필터 가동` }
      : null,
    { icon: "ti-star", text: `내 자산 ${pb?.watched ?? 0}편 관람 · ${pb?.watchlist ?? 0}편 후보` },
  ].filter(Boolean) as { icon: string; text: string }[];

  const system: SystemStatus = {
    scored: sys?.scored_films ?? null,
    model: sys?.model_version ?? null,
    taste: sys?.taste_vectors ?? null,
  };

  return <RoomShell chip={chip} counts={counts} ticker={ticker} system={system}>{children}</RoomShell>;
}
