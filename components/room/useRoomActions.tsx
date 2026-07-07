"use client";
/** My Room v3 — the shared mutation hook. Same-mutation principle: every screen
 *  and every inspector writes through here (all auth.uid()-scoped SECURITY
 *  DEFINER RPCs: me_set_watchlist / me_mark_seen / me_dismiss / rate_film).
 *  v3 changes: English toasts via the single Toast provider, every mutation is
 *  recorded into SessionStore (optimistic state that survives route changes),
 *  dismiss toasts carry an Undo action, and doRestore encapsulates the
 *  documented two-call restore sequence. */
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "./Toast";
import { useSessionStore } from "./SessionStore";
import { STR } from "./strings";

export type RateResult = { slug: string; rating: number; loved: boolean; seen: boolean } | null;

export function useRoomActions() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const session = useSessionStore();

  /** Keep → slate (watchlist on). */
  const doKeep = useCallback(async (slug: string, title: string) => {
    const { error } = await supabase.rpc("me_set_watchlist", { p_slug: slug, p_on: true });
    if (error) { toast(STR.toast.saveFail(error.message)); return false; }
    session.recordKeep(slug);
    toast(STR.toast.kept(title));
    return true;
  }, [supabase, toast, session]);

  /** Release from the slate (watchlist off). */
  const doRelease = useCallback(async (slug: string, title: string) => {
    const { error } = await supabase.rpc("me_set_watchlist", { p_slug: slug, p_on: false });
    if (error) { toast(STR.toast.saveFail(error.message)); return false; }
    session.recordRelease(slug);
    toast(STR.toast.released(title));
    return true;
  }, [supabase, toast, session]);

  /** Mark seen (a position opens in Holdings). */
  const doSeen = useCallback(async (slug: string, title: string) => {
    const { error } = await supabase.rpc("me_mark_seen", { p_slug: slug });
    if (error) { toast(STR.toast.logFail(error.message)); return false; }
    session.recordSeen(slug);
    toast(STR.toast.seen(title));
    return true;
  }, [supabase, toast, session]);

  /** Restore a film dismissed this session (Undo / the "Passed on" strip).
   *  TWO-CALL SEQUENCE, documented per spec §1: there is no me_undismiss RPC yet,
   *  so we lean on me_set_watchlist's server behavior —
   *    1) me_set_watchlist(slug, true)  → keeping clears `dismissed`
   *    2) me_set_watchlist(slug, false) → return the keep flag to off
   *  Net server state: dismissed=false, kept=false. Replace with me_undismiss
   *  (§8-R2) when it ships. Full dismiss-history restore waits on §8-R1. */
  const doRestore = useCallback(async (slug: string, title: string) => {
    const on = await supabase.rpc("me_set_watchlist", { p_slug: slug, p_on: true });
    if (on.error) { toast(STR.toast.saveFail(on.error.message)); return false; }
    const off = await supabase.rpc("me_set_watchlist", { p_slug: slug, p_on: false });
    if (off.error) { toast(STR.toast.saveFail(off.error.message)); return false; }
    session.recordRestore(slug);
    toast(STR.toast.restored(title));
    return true;
  }, [supabase, toast, session]);

  /** Dismiss (never recommend again). Toast carries Undo → doRestore. */
  const doDismiss = useCallback(async (slug: string, title: string) => {
    const { error } = await supabase.rpc("me_dismiss", { p_slug: slug });
    if (error) { toast(STR.toast.saveFail(error.message)); return false; }
    session.recordDismiss(slug, title);
    toast(STR.toast.dismissed(title), { action: { label: STR.toast.undo, run: () => { void doRestore(slug, title); } } });
    return true;
  }, [supabase, toast, session, doRestore]);

  /** Rate on the 0.5–5 half-star grid. Rating implies seen (server clamps). */
  const doRate = useCallback(async (slug: string, title: string, value: number): Promise<RateResult> => {
    const { data, error } = await supabase.rpc("rate_film", { p_slug: slug, p_rating: value });
    if (error) { toast(STR.toast.rateFail(error.message)); return null; }
    const row = ((data as RateResult[] | null) ?? [])[0] ?? null;
    const r = row?.rating ?? value;
    session.recordRate(slug, r);
    toast(STR.toast.rated(title, r));
    return row;
  }, [supabase, toast, session]);

  return { supabase, session, say: toast, doKeep, doRelease, doSeen, doDismiss, doRestore, doRate };
}
