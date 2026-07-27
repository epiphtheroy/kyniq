"use client";
/**
 * AuthSheet — the single, site-wide sign-in surface (HANDOFF-회원가입-전환-설계.md §3.1).
 * No password: "Continue with Google" + an email magic-link (signInWithOtp). Its
 * headline/subcopy change by `intent` so one component says "Keep it on your shelf"
 * or "Claim your board" as needed. On sign-in the caller replays the pending action.
 *
 * Self-contained styles (brand tokens) like ShareDock, so it needs no CSS file and
 * can render over any surface. Centered card on desktop, bottom sheet on phones.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { mtEvent } from "@/components/mtTrack";
import { type AuthIntent, copyFor, encodeIntent, intentKey } from "@/lib/conversion/intent";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** current path+search, with the declarative intent appended so it survives the round-trip */
function buildNext(intent: AuthIntent): string {
  const here = window.location.pathname + window.location.search;
  if (!intent.decl) return here;
  const sep = here.includes("?") ? "&" : "?";
  return `${here}${sep}mt_intent=${encodeIntent(intent.decl)}`;
}

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flex: "0 0 auto" }}>
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

export default function AuthSheet({ open, onClose, intent }: { open: boolean; onClose: () => void; intent: AuthIntent }) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"idle" | "google" | "sending" | "sent" | "err">("idle");
  const cardRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const { h, sub } = copyFor(intent.ctx);
  const key = intentKey(intent.ctx);

  // reset per open + impression event + focus management
  useEffect(() => {
    if (!open) return;
    setPhase("idle"); setEmail("");
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    mtEvent(`gate_shown:${key}`);
    const t = setTimeout(() => cardRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, key]);

  // Esc + focus trap + restore
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const nodes = cardRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])');
      if (!nodes || !nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; restoreRef.current?.focus?.(); };
  }, [open, onClose]);

  const google = useCallback(async () => {
    setPhase("google");
    mtEvent(`gate_method:google:${key}`);
    try {
      await sb().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(buildNext(intent))}` },
      });
    } catch { setPhase("err"); }
  }, [intent, key]);

  const magiclink = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (phase === "sending") return;
    setPhase("sending");
    mtEvent(`gate_method:magiclink:${key}`);
    try {
      const { error } = await sb().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(buildNext(intent))}` },
      });
      setPhase(error ? "err" : "sent");
    } catch { setPhase("err"); }
  }, [email, phase, intent, key]);

  if (!open) return null;

  return (
    <div className="mtauth-ov" role="dialog" aria-modal="true" aria-labelledby="mtauth-h" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mtauth-card" ref={cardRef}>
        <button type="button" className="mtauth-x" aria-label="Close" onClick={onClose}>✕</button>

        {phase === "sent" ? (
          <div className="mtauth-sent">
            <div className="mtauth-tick" aria-hidden="true">✓</div>
            <h2 id="mtauth-h" className="mtauth-hd">Check your inbox</h2>
            <p className="mtauth-sub">A one-tap sign-in link is on its way to <b>{email}</b>. Open it and you&apos;re in — right back here.</p>
            <button type="button" className="mtauth-alt" onClick={() => setPhase("idle")}>Use a different email</button>
          </div>
        ) : (
          <>
            <div className="mtauth-kick">Metatake</div>
            <h2 id="mtauth-h" className="mtauth-hd">{h}</h2>
            <p className="mtauth-sub">{sub}</p>

            <button type="button" className="mtauth-google" data-autofocus onClick={google} disabled={phase === "google"}>
              <GoogleG />{phase === "google" ? "Opening Google…" : "Continue with Google"}
            </button>

            <div className="mtauth-or"><span>or</span></div>

            <form onSubmit={magiclink} className="mtauth-mlform">
              <input type="email" required inputMode="email" autoComplete="email" placeholder="you@example.com"
                aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="mtauth-input" />
              <button type="submit" className="mtauth-ml" disabled={phase === "sending"}>{phase === "sending" ? "…" : "Email me a link"}</button>
            </form>
            {phase === "err" && <p className="mtauth-err">Something went off. Try again, or use Google.</p>}

            <p className="mtauth-fine">No password, ever. One tap and you&apos;re in.</p>
            <p className="mtauth-legal">By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
          </>
        )}
      </div>

      <style>{`
        .mtauth-ov{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;
          background:rgba(13,13,13,.52);backdrop-filter:saturate(120%) blur(2px);animation:mtauth-fade .16s ease;padding:16px}
        @keyframes mtauth-fade{from{opacity:0}}
        .mtauth-card{position:relative;width:100%;max-width:400px;background:#fff;color:#0D0D0D;border:1px solid #D8D8D8;
          border-radius:14px;padding:28px 26px 22px;box-shadow:0 30px 70px -24px rgba(0,0,0,.55);animation:mtauth-rise .22s cubic-bezier(.2,.7,.2,1)}
        @keyframes mtauth-rise{from{transform:translateY(14px);opacity:.4}}
        .mtauth-x{position:absolute;top:12px;right:14px;border:0;background:none;font-size:19px;line-height:1;color:#8F8F8F;cursor:pointer}
        .mtauth-x:hover{color:#0D0D0D}
        .mtauth-kick{font-family:var(--font-display,Georgia,serif);font-size:15px;color:#E3120B;font-weight:700;letter-spacing:.01em}
        .mtauth-hd{font-family:var(--font-display,Georgia,serif);font-size:23px;line-height:1.18;margin:8px 0 6px;color:#0D0D0D;text-wrap:balance}
        .mtauth-sub{font-family:var(--font-ui,Inter,sans-serif);font-size:13.5px;line-height:1.5;color:#6B6B6B;margin:0 0 18px}
        .mtauth-google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;box-sizing:border-box;
          padding:12px 14px;border:1px solid #B9B9B9;border-radius:9px;background:#fff;color:#0D0D0D;font-family:var(--font-ui,Inter,sans-serif);
          font-size:14.5px;font-weight:600;cursor:pointer;transition:border-color .15s,box-shadow .15s}
        .mtauth-google:hover{border-color:#0D0D0D;box-shadow:0 2px 0 rgba(0,0,0,.04)}
        .mtauth-google:disabled{opacity:.6;cursor:default}
        .mtauth-or{display:flex;align-items:center;gap:10px;margin:15px 0;color:#8F8F8F;font-size:11.5px;font-family:var(--font-ui,Inter,sans-serif)}
        .mtauth-or::before,.mtauth-or::after{content:"";flex:1;height:1px;background:#E4E0D6}
        .mtauth-mlform{display:flex;gap:8px}
        .mtauth-input{flex:1;min-width:0;box-sizing:border-box;padding:11px 12px;border:1px solid #B9B9B9;border-radius:9px;
          font-family:var(--font-ui,Inter,sans-serif);font-size:14px;color:#0D0D0D;background:#fff;outline:none}
        .mtauth-input:focus{border-color:#0D0D0D}
        .mtauth-ml{flex:0 0 auto;padding:11px 14px;border:1px solid #E3120B;border-radius:9px;background:#E3120B;color:#fff;
          font-family:var(--font-ui,Inter,sans-serif);font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}
        .mtauth-ml:hover{background:#B80D05;border-color:#B80D05}
        .mtauth-ml:disabled{opacity:.6;cursor:default}
        .mtauth-err{color:#B80D05;font-size:12.5px;font-family:var(--font-ui,Inter,sans-serif);margin:10px 0 0}
        .mtauth-fine{font-family:var(--font-ui,Inter,sans-serif);font-size:12px;color:#6B6B6B;text-align:center;margin:16px 0 0}
        .mtauth-legal{font-family:var(--font-ui,Inter,sans-serif);font-size:11px;color:#8F8F8F;text-align:center;margin:6px 0 0}
        .mtauth-legal a{color:#6B6B6B;text-decoration:underline}
        .mtauth-sent{text-align:center;padding:8px 0 4px}
        .mtauth-tick{width:44px;height:44px;margin:0 auto 12px;border-radius:50%;background:#F0F7F2;color:#2E7D4F;
          display:grid;place-items:center;font-size:22px;font-weight:800}
        .mtauth-alt{margin-top:14px;border:0;background:none;color:#E3120B;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-ui,Inter,sans-serif)}
        @media (max-width:520px){
          .mtauth-ov{align-items:flex-end;padding:0}
          .mtauth-card{max-width:none;border-radius:16px 16px 0 0;border-bottom:0;padding-bottom:30px;animation:mtauth-up .24s cubic-bezier(.2,.7,.2,1)}
          @keyframes mtauth-up{from{transform:translateY(100%)}}
          .mtauth-mlform{flex-direction:column}
          .mtauth-ml{width:100%}
        }
        @media (prefers-reduced-motion:reduce){.mtauth-ov,.mtauth-card{animation:none}}
      `}</style>
    </div>
  );
}
