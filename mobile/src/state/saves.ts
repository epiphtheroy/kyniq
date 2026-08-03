// Saved entities — the "★ keep this list" ledger (owner 08-03).
//
// One row per saved thing in public.user_saves(user_id, entity_type, entity_ref,
// kind='save'), RLS owner-only, exactly the table the website's SaveButton has
// written to since the save layer shipped. Saving a curated list therefore costs
// no new table and no migration, and a list saved on metatake.net is already
// saved in the app.
//
// Deliberately NOT a React provider: four screens read it, the payload is a few
// dozen short strings, and a module-scope store with a subscribe hook keeps
// _layout.tsx (which mounts the auth/ledger/rating providers) untouched.
//
// Invariant: saving a list saves the LIST. It must never write user_movies —
// that is what "Add all to watchlist" is for, and the difference is the whole
// point (owner: you may tap a list only to look at it).
import { useEffect, useReducer } from "react";
import { supabase } from "../lib/supabase";

export type SaveType = "lineage";

const keyOf = (type: SaveType, ref: string) => `${type}:${ref}`;

let saved = new Set<string>();
let uid: string | null = null;
let ready = false;
let inflight: Promise<void> | null = null;
// Bumped on every change so callers can memoize against it — `refs()` is a
// stable function, so without this a useMemo would never see a new star.
let rev = 0;

const listeners = new Set<() => void>();
function emit() {
  rev += 1;
  for (const l of [...listeners]) l();
}

/** Load (once) the signed-in user's saves. Signed out → empty and ready. */
export async function loadSaves(force = false): Promise<void> {
  if (inflight) return inflight;
  if (ready && !force) return;
  inflight = (async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const id = auth.session?.user.id ?? null;
      uid = id;
      if (!id) {
        saved = new Set();
      } else {
        const { data, error } = await supabase
          .from("user_saves")
          .select("entity_type, entity_ref")
          .eq("kind", "save")
          .limit(1000);
        if (error) throw error;
        const next = new Set<string>();
        for (const r of (data ?? []) as { entity_type: string; entity_ref: string }[]) {
          next.add(`${r.entity_type}:${r.entity_ref}`);
        }
        saved = next;
      }
    } catch {
      // Leave whatever we had; a failed read must not look like "nothing saved".
    }
    ready = true;
    inflight = null;
    emit();
  })();
  return inflight;
}

// A sign-in/out swaps whose saves these are — never show account A's stars to B.
supabase.auth.onAuthStateChange(() => {
  ready = false;
  saved = new Set();
  uid = null;
  emit();
  void loadSaves(true);
});

export function isSaved(type: SaveType, ref: string): boolean {
  return saved.has(keyOf(type, ref));
}

/** Optimistic toggle; rolls back if the write fails. Returns the new state. */
export async function toggleSave(type: SaveType, ref: string): Promise<boolean> {
  if (!uid) {
    await loadSaves(true);
    if (!uid) return isSaved(type, ref); // signed out — the caller sends them to auth
  }
  const k = keyOf(type, ref);
  const was = saved.has(k);
  const next = new Set(saved);
  if (was) next.delete(k);
  else next.add(k);
  saved = next;
  emit();
  try {
    if (was) {
      const { error } = await supabase
        .from("user_saves")
        .delete()
        .eq("user_id", uid)
        .eq("entity_type", type)
        .eq("entity_ref", ref)
        .eq("kind", "save");
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("user_saves")
        .insert({ user_id: uid, entity_type: type, entity_ref: ref, kind: "save" });
      if (error) throw error;
    }
  } catch {
    const back = new Set(saved);
    if (was) back.add(k);
    else back.delete(k);
    saved = back;
    emit();
    return was;
  }
  return !was;
}

/** Every saved ref of one type, in no particular order. */
export function savedRefs(type: SaveType): string[] {
  const pre = `${type}:`;
  return [...saved].filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length));
}

/** Subscribe a component to the store. */
export function useSaves(): {
  ready: boolean;
  signedIn: boolean;
  /** Changes on every save/unsave — use it as a memo dependency. */
  rev: number;
  has: (type: SaveType, ref: string) => boolean;
  refs: (type: SaveType) => string[];
} {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(bump);
    void loadSaves();
    return () => {
      listeners.delete(bump);
    };
  }, []);
  return { ready, signedIn: !!uid, rev, has: isSaved, refs: savedRefs };
}
