"use client";

/**
 * UserSavesProvider — loads the signed-in user's whole user_saves set ONCE per session, keyed by
 * `${entity_type}:${entity_ref}` for kind='save', so any number of SaveChip cards (e.g. dozens of
 * Strong-Misreading cards) can read/toggle a personal save without a query per card. Writes
 * optimistically via RLS. Logged-out → /login. (migration: save_layer_user_films_and_saves)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { requireAuthEvent } from "@/lib/conversion/bus";

type Ctx = {
  ready: boolean;
  uid: string | null;
  has: (entityType: string, entityRef: string) => boolean;
  toggle: (entityType: string, entityRef: string) => void;
};
const UserSaves = createContext<Ctx | null>(null);
const keyOf = (t: string, r: string) => `${t}:${r}`;

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export function UserSavesProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [set, setSet] = useState<Record<string, true>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = sb();
      const { data: auth } = await c.auth.getUser();
      const user = auth?.user;
      if (alive && user) {
        setUid(user.id);
        const { data } = await c.from("user_saves").select("entity_type, entity_ref").eq("user_id", user.id).eq("kind", "save");
        if (alive && data) {
          const m: Record<string, true> = {};
          for (const r of data as Array<{ entity_type: string; entity_ref: string }>) m[keyOf(r.entity_type, r.entity_ref)] = true;
          setSet(m);
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  const toggle = useCallback((entityType: string, entityRef: string) => {
    if (!uid) { requireAuthEvent({ ctx: { kind: "save", verb: "save" }, decl: { v: "save", slug: entityRef, kind: entityType } }); return; }
    const k = keyOf(entityType, entityRef);
    setSet((prev) => {
      const next = { ...prev };
      const c = sb();
      if (prev[k]) {
        delete next[k];
        c.from("user_saves").delete().eq("user_id", uid).eq("entity_type", entityType).eq("entity_ref", entityRef).eq("kind", "save");
      } else {
        next[k] = true;
        c.from("user_saves").insert({ user_id: uid, entity_type: entityType, entity_ref: entityRef, kind: "save" });
      }
      return next;
    });
  }, [uid]);

  const value = useMemo<Ctx>(() => ({
    ready, uid,
    has: (t, r) => !!set[keyOf(t, r)],
    toggle,
  }), [ready, uid, set, toggle]);

  return <UserSaves.Provider value={value}>{children}</UserSaves.Provider>;
}

export function useUserSaves() { return useContext(UserSaves); }
