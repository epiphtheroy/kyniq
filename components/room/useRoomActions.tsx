"use client";
/** v2 공용 쓰기 훅 — 담기/봤어요/관심없음/별점 mutation + 공용 토스트.
 *  연계 3원칙의 "같은 mutation": 홈·워치리스트·기록·공용 인스펙터가 전부 이 훅을 공유한다.
 *  전부 auth.uid() 스코프 SECURITY DEFINER RPC (me_set_watchlist / me_mark_seen / me_dismiss / rate_film). */
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type RateResult = { slug: string; rating: number; loved: boolean; seen: boolean } | null;

export function useRoomActions() {
  const supabase = useMemo(() => createClient(), []);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);

  const doKeep = useCallback(async (slug: string, title: string) => {
    const { error } = await supabase.rpc("me_set_watchlist", { p_slug: slug, p_on: true });
    say(error ? `저장 실패 — ${error.message}` : `「${title}」 볼 영화에 담김`);
    return !error;
  }, [supabase, say]);

  const doSeen = useCallback(async (slug: string, title: string) => {
    const { error } = await supabase.rpc("me_mark_seen", { p_slug: slug });
    say(error ? `기록 실패 — ${error.message}` : `「${title}」 관람 기록됨`);
    return !error;
  }, [supabase, say]);

  const doDismiss = useCallback(async (slug: string, title: string) => {
    const { error } = await supabase.rpc("me_dismiss", { p_slug: slug });
    say(error ? `저장 실패 — ${error.message}` : `「${title}」 다시 추천하지 않습니다`);
    return !error;
  }, [supabase, say]);

  const doRate = useCallback(async (slug: string, title: string, value: number): Promise<RateResult> => {
    const { data, error } = await supabase.rpc("rate_film", { p_slug: slug, p_rating: value });
    if (error) { say(`평가 실패 — ${error.message}`); return null; }
    const row = ((data as RateResult[] | null) ?? [])[0] ?? null;
    say(`「${title}」 ★${row?.rating ?? value} — 관람 기록됨`);
    return row;
  }, [supabase, say]);

  const toast: ReactNode = msg ? <div className="v2toast" role="status">{msg}</div> : null;

  return { supabase, say, doKeep, doSeen, doDismiss, doRate, toast };
}
