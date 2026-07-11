"use client";

// Personal METATAKE TV lists (tv_user_lists / tv_user_list_items, RLS
// owner-only) — the browser client talks to the tables directly, same pattern
// as SaveButton/user_saves. All functions no-op (return null/false) when the
// visitor is signed out; callers route to /login.
import { createBrowserClient } from "@supabase/ssr";

export type TVUserList = { id: string; title: string; slugs: string[] };

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

async function uid(): Promise<string | null> {
  const { data } = await sb().auth.getUser();
  return data?.user?.id ?? null;
}

type ListRow = { id: string; title: string; tv_user_list_items: { program_slug: string; pos: number }[] | null };

/** null = signed out; [] = signed in, no lists yet. */
export async function fetchMyLists(): Promise<TVUserList[] | null> {
  if (!(await uid())) return null;
  const { data } = await sb()
    .from("tv_user_lists")
    .select("id,title,tv_user_list_items(program_slug,pos)")
    .order("created_at", { ascending: false });
  return ((data as ListRow[] | null) ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    slugs: [...(l.tv_user_list_items ?? [])].sort((a, b) => a.pos - b.pos).map((i) => i.program_slug),
  }));
}

export async function createList(title: string, slugs: string[] = []): Promise<TVUserList | null> {
  const user = await uid();
  if (!user) return null;
  const c = sb();
  const { data, error } = await c.from("tv_user_lists").insert({ user_id: user, title }).select("id,title").single();
  if (error || !data) return null;
  const id = (data as { id: string }).id;
  if (slugs.length) {
    await c.from("tv_user_list_items").insert(slugs.map((s, i) => ({ list_id: id, program_slug: s, pos: i })));
  }
  return { id, title, slugs };
}

export async function renameList(id: string, title: string): Promise<boolean> {
  const { error } = await sb().from("tv_user_lists").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

export async function deleteList(id: string): Promise<boolean> {
  const { error } = await sb().from("tv_user_lists").delete().eq("id", id);
  return !error;
}

export async function addToList(id: string, slugs: string[]): Promise<boolean> {
  if (!slugs.length) return true;
  const c = sb();
  const { data } = await c.from("tv_user_list_items").select("pos").eq("list_id", id).order("pos", { ascending: false }).limit(1);
  const base = ((data as { pos: number }[] | null)?.[0]?.pos ?? -1) + 1;
  const { error } = await c.from("tv_user_list_items")
    .upsert(slugs.map((s, i) => ({ list_id: id, program_slug: s, pos: base + i })), { onConflict: "list_id,program_slug" });
  return !error;
}

export async function removeFromList(id: string, slugs: string[]): Promise<boolean> {
  const { error } = await sb().from("tv_user_list_items").delete().eq("list_id", id).in("program_slug", slugs);
  return !error;
}
