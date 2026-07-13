import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

// Existence gates for the bottom BroadcastCard on entity pages. A card must only
// render when there is something playable behind it, so its "▶ Open on METATAKE
// TV" link never 404s and the facade never opens to an empty player.

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** True when a compiled, playable METATAKE TV playlist exists for this slug
 *  (e.g. `director-lars-von-trier`, `genre-thriller`). Cached an hour. */
export const playlistExists = (slug: string) =>
  unstable_cache(
    async (): Promise<boolean> => {
      const { data } = await db()
        .from("tv_playlists")
        .select("slug, n_segments")
        .eq("slug", slug)
        .maybeSingle<{ slug: string; n_segments: number | null }>();
      return !!data && (data.n_segments ?? 0) > 0;
    },
    ["tv-playlist-exists-1", slug],
    { revalidate: 3600 },
  )();
