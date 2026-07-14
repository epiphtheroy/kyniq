import { ogCard, ogFallback, ogDb, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
import { displayTs } from "@/lib/cinecodex_dims";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "TakeScore on Metatake";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const card = (await ogDb().rpc("cinecodex_card", { p_slug: slug })).data as {
      title: string; year: number | null; director: string | null; poster_path: string | null;
      u: number; r: number; rank: number | null; rank_total: number | null; ext?: { imdb?: number | null; rt?: number | null };
    } | null;
    if (!card) return ogFallback();
    const { data: film } = await ogDb().from("films").select("backdrop_path").eq("slug", slug).maybeSingle();

    const badges = [
      { label: "TakeScore", value: String(displayTs(card.u)), tone: "score" as const },
      card.rank && card.rank_total ? { label: `of ${card.rank_total.toLocaleString()}`, value: `#${card.rank.toLocaleString()}`, tone: "plain" as const } : null,
      card.ext?.imdb != null ? { label: "IMDb", value: String(card.ext.imdb), tone: "plain" as const } : null,
      card.ext?.rt != null ? { label: "RT", value: `${card.ext.rt}%`, tone: "plain" as const } : null,
    ].filter(Boolean) as { label: string; value: string; tone: "score" | "plain" }[];

    return ogCard({
      eyebrow: "TakeScore",
      title: `${card.title}${card.year ? ` (${card.year})` : ""}`,
      subtitle: card.director ? `dir. ${card.director} — value minus risk, appraised` : "value minus risk, appraised",
      backdropPath: (film?.backdrop_path as string | null) ?? null,
      posterPath: card.poster_path,
      badges,
    });
  } catch { return ogFallback(); }
}
