"use client";

/**
 * EntityActions — Follow (pin) + Like (heart) for an entity, shown near its title.
 * Follow = add to your personal list (private). Like = public ♥ count.
 * Reads the user's own pins (RLS) + the public like count; toggles optimistically.
 * Logged-out clicks route to /login. (migration 0020: user_pins, like_counts)
 */

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { requireAuthEvent } from "@/lib/conversion/bus";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Kind = "follow" | "like";
export default function EntityActions({ entityType, entityId }: { entityType: "film" | "figure" | "meta_take"; entityId: string }) {
  const [uid, setUid] = useState<string | null>(null);
  const [followed, setFollowed] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const c = sb();
    (async () => {
      const [{ data: lc }, { data: auth }] = await Promise.all([
        c.from("like_counts").select("likes").eq("entity_type", entityType).eq("entity_id", entityId).maybeSingle(),
        c.auth.getUser(),
      ]);
      if (!alive) return;
      setLikes((lc?.likes as number) ?? 0);
      const user = auth?.user;
      if (user) {
        setUid(user.id);
        const { data: pins } = await c.from("user_pins").select("kind")
          .eq("entity_type", entityType).eq("entity_id", entityId).eq("user_id", user.id);
        if (alive && pins) {
          setFollowed(pins.some((p: { kind: string }) => p.kind === "follow"));
          setLiked(pins.some((p: { kind: string }) => p.kind === "like"));
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [entityType, entityId]);

  const toggle = useCallback(async (kind: Kind) => {
    // Anon → in-context sheet (no replay: entities key on UUID, not a slug — user re-taps signed in).
    if (!uid) { requireAuthEvent({ ctx: { kind: "save", verb: "follow" } }); return; }
    const on = kind === "follow" ? followed : liked;
    if (kind === "follow") setFollowed(!on);
    else { setLiked(!on); setLikes((n) => Math.max(0, n + (on ? -1 : 1))); }
    const c = sb();
    if (on) {
      await c.from("user_pins").delete().eq("user_id", uid).eq("entity_type", entityType).eq("entity_id", entityId).eq("kind", kind);
    } else {
      await c.from("user_pins").insert({ user_id: uid, entity_type: entityType, entity_id: entityId, kind });
    }
  }, [uid, followed, liked, entityType, entityId]);

  if (!ready) return <div className="ea ea--ph" aria-hidden="true" />;

  return (
    <div className="ea">
      <button type="button" className={`ea-btn${followed ? " on" : ""}`} onClick={() => toggle("follow")} aria-pressed={followed}>
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="ea-ic">
          <path d="M9 3h6l-1 6 4 3v2h-5v7l-1 2-1-2v-7H6v-2l4-3z" fill="currentColor" />
        </svg>
        {followed ? "Following" : "Follow"}
      </button>
      <button type="button" className={`ea-btn ea-like${liked ? " on" : ""}`} onClick={() => toggle("like")} aria-pressed={liked} title="Like">
        <span className="ea-heart">{liked ? "♥" : "♡"}</span>
        {likes > 0 ? likes : "Like"}
      </button>
    </div>
  );
}
