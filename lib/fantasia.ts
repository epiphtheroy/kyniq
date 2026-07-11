// Embedding Fantasia — server-side loader for entity pages (director, theorist,
// trope, take, figure). Wraps the sentences_for_entity RPC (migration 0064) in
// unstable_cache per entity. Rows include the anchor film per sentence so the
// module can link everything (see components/EntityFantasia.tsx).
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { FantasiaRow } from "@/components/EntityFantasia";

export function loadFantasia(type: string, key: string, key2?: string | null, tag?: string) {
  return unstable_cache(
    async () => {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data, error } = await db.rpc("sentences_for_entity", {
        p_type: type, p_key: key, p_key2: key2 ?? null, p_limit: 24,
      });
      if (error) throw error; // null-poison guard: never cache an error as empty
      return (data ?? []) as FantasiaRow[];
    },
    ["entity-fantasia-v1", type, key, key2 ?? ""],
    { revalidate: 300, tags: tag ? [tag] : undefined },
  )();
}
