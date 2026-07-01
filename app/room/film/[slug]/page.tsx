import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EvalCard, { type CardData } from "@/components/room/EvalCard";

export const dynamic = "force-dynamic";

export default async function RoomFilmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("cinecodex_card", { p_slug: slug });
  const card = data as CardData | null;
  if (!card || card.v == null) notFound();
  return <EvalCard d={card} />;
}
