"use client";
/**
 * ConversionProvider — the root orchestrator of the membership-conversion system
 * (HANDOFF-회원가입-전환-설계.md §3.4). Mounted inside LensProvider so it can read the
 * personalization providers to REPLAY a pending action after sign-in. Provides:
 *   - useConversion(): { requireAuth, openAuth, toast, canShowNudge, dismissNudge }
 *   - a single site-wide <AuthSheet>
 *   - a global toast
 *   - reload-based intent replay (mt_intent from URL or sessionStorage)
 *   - env-gated Google One-Tap
 *   - frequency governance (one proactive modal/session; dismissals remembered)
 *
 * Anti-annoyance is a first-class concern: user-initiated gates (a save click) always
 * open; PROACTIVE nudges must pass canShowNudge(). Nothing fires on first paint.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUserFilms } from "@/components/UserFilmsProvider";
import { useUserSaves } from "@/components/UserSavesProvider";
import { mtEvent } from "@/components/mtTrack";
import { onAuthRequired } from "@/lib/conversion/bus";
import { type AuthIntent, type SaveIntentDecl, decodeIntent, intentKey, REPLAY_TOAST } from "@/lib/conversion/intent";
import AuthSheet from "./AuthSheet";
import GoogleOneTap from "./GoogleOneTap";

type ToastMsg = { text: string; href?: string; cta?: string } | null;
type Api = {
  /** logged-in → replay now (true); else open AuthSheet (false) */
  requireAuth: (intent: AuthIntent) => boolean;
  openAuth: (intent: AuthIntent) => void;
  toast: (text: string, opts?: { href?: string; cta?: string }) => void;
  /** proactive nudge allowed? (not dismissed, session cap not hit) */
  canShowNudge: (id: string, opts?: { modal?: boolean }) => boolean;
  markNudgeShown: (id: string, opts?: { modal?: boolean }) => void;
  dismissNudge: (id: string, days?: number) => void;
  signedIn: boolean;
};
const Ctx = createContext<Api | null>(null);
export function useConversion() {
  return useContext(Ctx);
}

const SESSION_MODAL_KEY = "mt_nudge_modals";

export default function ConversionProvider({ children }: { children: ReactNode }) {
  const uf = useUserFilms();
  const saves = useUserSaves();
  const [sheet, setSheet] = useState<{ open: boolean; intent: AuthIntent }>({ open: false, intent: { ctx: { kind: "generic" } } });
  const [toastMsg, setToastMsg] = useState<ToastMsg>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [engaged, setEngaged] = useState(false); // earned-moment gate for One-Tap
  const replayed = useRef(false);
  const pendingRef = useRef<SaveIntentDecl | null>(null);

  const toast = useCallback((text: string, opts?: { href?: string; cta?: string }) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg({ text, href: opts?.href, cta: opts?.cta });
    toastTimer.current = setTimeout(() => setToastMsg(null), 4200);
  }, []);

  const openAuth = useCallback((intent: AuthIntent) => {
    setSheet({ open: true, intent });
  }, []);

  const execDecl = useCallback((d: SaveIntentDecl) => {
    if (!uf || !uf.uid || !d.slug) return;
    const key = { slug: d.slug };
    let ok = false;
    if (d.v === "seen") { if (!uf.get(key).seen) uf.toggleSeen(key); ok = true; }
    else if (d.v === "watchlist") { if (!uf.get(key).watchlist) uf.toggleWatch(key); ok = true; }
    else if (d.v === "rate" && d.rating) { uf.rate(key, d.rating); ok = true; }
    else if (d.v === "save" && saves?.uid) { const t = d.kind || "film"; if (!saves.has(t, d.slug)) saves.toggle(t, d.slug); ok = true; }
    // "follow" lives in EntityActions (not these providers) → land signed-in, no false toast.
    if (ok) { toast(REPLAY_TOAST[d.v], { href: "/room", cta: "Your room →" }); mtEvent(`gate_replay:${d.v}`); }
  }, [uf, saves, toast]);

  const requireAuth = useCallback((intent: AuthIntent): boolean => {
    if (uf?.uid) {
      if (intent.decl) execDecl(intent.decl);
      else intent.replay?.();
      return true;
    }
    mtEvent(`gate_open:${intentKey(intent.ctx)}`);
    openAuth(intent);
    return false;
  }, [uf, execDecl, openAuth]);

  // Parent providers (UserFilmsProvider) raise the sheet through the event bus.
  useEffect(() => onAuthRequired((req) => {
    mtEvent(`gate_open:${intentKey(req.ctx)}`);
    openAuth({ ctx: req.ctx, decl: req.decl });
  }), [openAuth]);

  // Reload-based replay: after OAuth/magic-link/One-Tap, the pending declarative
  // intent (mt_intent in the URL, or sessionStorage) executes once the session loads.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get("mt_intent");
      const fromStore = sessionStorage.getItem("mt_intent");
      pendingRef.current = decodeIntent(fromUrl || fromStore);
      if (fromUrl) { url.searchParams.delete("mt_intent"); window.history.replaceState({}, "", url.toString()); }
      sessionStorage.removeItem("mt_intent");
    } catch {}
  }, []);
  useEffect(() => {
    if (replayed.current || !pendingRef.current || !uf?.ready) return;
    replayed.current = true;
    const d = pendingRef.current; pendingRef.current = null;
    if (uf.uid && d) execDecl(d); // signed in → replay; signed out → silently drop
  }, [uf?.ready, uf?.uid, execDecl]);

  // Earned-moment signal for One-Tap: fire after 18s of presence on a non-auth page.
  useEffect(() => {
    if (uf?.uid) return;
    const t = setTimeout(() => setEngaged(true), 18000);
    return () => clearTimeout(t);
  }, [uf?.uid]);

  // ── governance ──────────────────────────────────────────────────────────
  const canShowNudge = useCallback((id: string, opts?: { modal?: boolean }) => {
    if (uf?.uid) return false; // signed-in users never see join nudges
    try {
      const until = Number(localStorage.getItem(`mt_nd_${id}`) || 0);
      if (until && Date.now() < until) return false;
      if (opts?.modal) {
        const n = Number(sessionStorage.getItem(SESSION_MODAL_KEY) || 0);
        if (n >= 1) return false;
      }
    } catch {}
    return true;
  }, [uf?.uid]);
  const markNudgeShown = useCallback((id: string, opts?: { modal?: boolean }) => {
    mtEvent(`nudge_shown:${id}`);
    if (opts?.modal) { try { sessionStorage.setItem(SESSION_MODAL_KEY, String(Number(sessionStorage.getItem(SESSION_MODAL_KEY) || 0) + 1)); } catch {} }
  }, []);
  const dismissNudge = useCallback((id: string, days = 7) => {
    mtEvent(`nudge_dismiss:${id}`);
    try { localStorage.setItem(`mt_nd_${id}`, String(Date.now() + days * 864e5)); } catch {}
  }, []);

  const value = useMemo<Api>(() => ({
    requireAuth, openAuth, toast, canShowNudge, markNudgeShown, dismissNudge, signedIn: !!uf?.uid,
  }), [requireAuth, openAuth, toast, canShowNudge, markNudgeShown, dismissNudge, uf?.uid]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <AuthSheet open={sheet.open} intent={sheet.intent} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
      <GoogleOneTap enabled={engaged && !uf?.uid} />
      {toastMsg ? (
        <div className="mtc-toast" role="status">
          <span>{toastMsg.text}</span>
          {toastMsg.href ? <a href={toastMsg.href}>{toastMsg.cta ?? "Open →"}</a> : null}
          <style>{`
            .mtc-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:1250;display:flex;align-items:center;gap:14px;
              max-width:calc(100vw - 28px);background:#0D0D0D;color:#fff;font-family:var(--font-ui,Inter,sans-serif);font-size:13.5px;
              padding:11px 16px;border-radius:10px;box-shadow:0 14px 34px -12px rgba(0,0,0,.6);animation:mtc-rise .2s ease}
            @keyframes mtc-rise{from{transform:translate(-50%,10px);opacity:0}}
            .mtc-toast a{color:#ff8b85;font-weight:700;text-decoration:none;white-space:nowrap}
            @media (prefers-reduced-motion:reduce){.mtc-toast{animation:none}}
          `}</style>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
