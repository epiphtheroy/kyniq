/**
 * Talk — server-side helpers. The room opens with its opening comment: a film
 * page mounts TalkSection when the film is on the static focus list OR when
 * seeded/organic posts already exist for it (seeding worker posts daily, ISR
 * picks it up within its 300s window).
 */
import { createClient } from "@supabase/supabase-js";
import { talkEnabledForFilm } from "./config";

export async function talkOpenForFilm(slug: string): Promise<boolean> {
  if (talkEnabledForFilm(slug)) return true;
  try {
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await c
      .from("talk_posts")
      .select("id")
      .eq("film_key", slug)
      .eq("status", "published")
      .limit(1);
    return !!(data && data.length);
  } catch {
    return false;
  }
}
