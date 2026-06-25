"use client";

/**
 * LineageActions — header controls for a /lineage/[slug] page:
 *  · Save the lineage list (user_saves, entity_type='lineage')
 *  · "Add all to watchlist" → lineage_add_watchlist RPC (every visible film in the list).
 */
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import SaveButton from "@/components/SaveButton";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function LineageActions({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const addAll = useCallback(async () => {
    const c = sb();
    const { data: auth } = await c.auth.getUser();
    if (!auth?.user) { router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setBusy(true);
    const { data, error } = await c.rpc("lineage_add_watchlist", { p_slug: slug });
    setBusy(false);
    if (!error) setAdded(typeof data === "number" ? data : 0);
  }, [slug, router]);

  return (
    <div className="lh-actions">
      <SaveButton entityType="lineage" entityRef={slug} label="Save this lineage" labelOn="Saved" variant="bookmark" />
      <button type="button" className="svb" onClick={addAll} disabled={busy}>
        <span className="svb-ic">＋</span>{busy ? "Adding…" : added != null ? `Added ${added} to watchlist` : "Add all to watchlist"}
      </button>
    </div>
  );
}
