"use client";

/**
 * SaveButton — personal save/follow for a non-film entity (director, lineage, trope, framework,
 * misreading/take) in user_saves. Reads the caller's own row (RLS), toggles optimistically.
 * Logged-out → /login. (migration: save_layer_user_films_and_saves)
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Variant = "heart" | "bookmark";
export default function SaveButton({
  entityType, entityRef, label = "Save", labelOn, variant = "bookmark",
}: { entityType: string; entityRef: string; label?: string; labelOn?: string; variant?: Variant }) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = sb();
      const { data: auth } = await c.auth.getUser();
      const user = auth?.user;
      if (alive && user) {
        setUid(user.id);
        const { data } = await c.from("user_saves").select("entity_ref")
          .eq("user_id", user.id).eq("entity_type", entityType).eq("entity_ref", entityRef).eq("kind", "save").maybeSingle();
        if (alive) setOn(!!data);
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, [entityType, entityRef]);

  const toggle = useCallback(async () => {
    if (!uid) { router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    const next = !on; setOn(next);
    const c = sb();
    if (next) await c.from("user_saves").insert({ user_id: uid, entity_type: entityType, entity_ref: entityRef, kind: "save" });
    else await c.from("user_saves").delete().eq("user_id", uid).eq("entity_type", entityType).eq("entity_ref", entityRef).eq("kind", "save");
  }, [uid, on, entityType, entityRef, router]);

  if (!ready) return <span className="svb svb--ph" aria-hidden="true" />;
  const icon = variant === "heart" ? (on ? "♥" : "♡") : (on ? "🔖" : "+");
  return (
    <button type="button" className={`svb svb--${variant}${on ? " on" : ""}`} onClick={toggle} aria-pressed={on}>
      <span className="svb-ic">{icon}</span>{on ? (labelOn ?? "Saved") : label}
    </button>
  );
}
