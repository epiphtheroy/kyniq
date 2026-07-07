import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/room/format";
import EvalCard, { type CardData, type MyPosition } from "@/components/room/EvalCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Appraisal — Metatake" };

/** /room/film/[slug] — Appraisal (spec §3.15): the full Cinecodex card plus the
 *  personal layer (My position bar). The position row is read once here from
 *  user_movies (owner-scoped RLS, same pattern as MovieListActions). */
export default async function RoomFilmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("cinecodex_card", { p_slug: slug });
  const card = data as CardData | null;
  if (!card || card.v == null) notFound();

  let pos: MyPosition = { rating: null, kept: false, seen: false };
  const { data: auth } = await supabase.auth.getUser();
  if (auth?.user) {
    const { data: um } = await supabase
      .from("user_movies")
      .select("rating, seen, watchlist, films!inner(slug)")
      .eq("user_id", auth.user.id)
      .eq("films.slug", slug)
      .maybeSingle();
    if (um) pos = { rating: num(um.rating), kept: !!um.watchlist, seen: !!um.seen };
  }

  return <EvalCard d={card} pos={pos} />;
}
