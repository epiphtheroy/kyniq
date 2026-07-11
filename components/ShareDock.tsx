"use client";
/**
 * ShareDock — one share/save control, four layouts (see HANDOFF-공유-저장-시스템.md).
 *   variant="bar"  horizontal row (article top/bottom, entity hero action row)
 *   variant="rail" desktop sticky left rail (icons only), appears past the hero
 *   variant="fab"  mobile floating button → native share sheet (or bottom sheet)
 * Native share sheet first on mobile (1-tap = max conversion); direct X/FB buttons
 * for muscle memory. No SDKs — URL schemes only. Counts share/save in mt_events.
 */
import { useEffect, useRef, useState } from "react";
import SaveButton from "@/components/SaveButton";
import { mtEvent } from "@/components/mtTrack";
import {
  channelIntent, shareHref, trimForX, CHANNEL_LABEL, PRIMARY_CHANNELS, MORE_CHANNELS,
  type ShareChannel,
} from "@/lib/share";

type Props = {
  /** site-relative path, e.g. "/film/parasite-2019" */
  path: string;
  /** page title (native sheet title, email subject) */
  title: string;
  /** the share hook (X/text channels) — falls back to title. Data-rich = more clicks. */
  hook?: string;
  variant?: "bar" | "rail" | "fab";
  /** optional Save — wires the existing user_saves button when provided */
  saveType?: string;
  saveRef?: string;
  /** hide the Save slot even if save props exist (film pages already have MovieListActions) */
  noSave?: boolean;
};

const I = {
  x: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M18.9 2H22l-7.4 8.5L23 22h-6.6l-5.2-6.8L5.3 22H2l7.9-9L1.5 2h6.8l4.7 6.2L18.9 2Zm-2.3 18h1.8L7.2 3.9H5.3L16.6 20Z" /></svg>,
  facebook: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.3.5-.3.4c-.1.1-.3.3-.1.5.1.3.7 1.1 1.4 1.8.9.8 1.7 1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.4Z" /></svg>,
  telegram: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.4 13 1.7 11.5c-1-.3-1-1 .2-1.5l18.6-7.2c.9-.3 1.6.2 1.4 1.5Z" /></svg>,
  reddit: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M22 11.8c0-1.1-.9-2-2-2-.5 0-1 .2-1.4.6-1.4-.9-3.1-1.5-5-1.6l.9-4 2.8.6a1.5 1.5 0 1 0 .2-1l-3.3-.7c-.2 0-.4.1-.4.3l-1 4.5c-2 .1-3.8.7-5.2 1.6-.4-.4-.9-.6-1.4-.6-1.4 0-2.4 1.4-1.8 2.7-.2.5-.3 1-.3 1.5 0 3 3.4 5.4 7.6 5.4s7.6-2.4 7.6-5.4c0-.5-.1-1-.3-1.5.5-.4.7-.9.7-1.4ZM8 13.5a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0Zm6.9 3.3c-.9.9-3.9.9-4.8 0-.2-.2-.5 0-.4.3.5 1.1 2 1.6 2.8 1.6s2.3-.5 2.8-1.6c.1-.3-.2-.5-.4-.3Zm-.3-2.1a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" /></svg>,
  linkedin: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21H9V9Z" /></svg>,
  email: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  copy: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>,
  more: <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  share: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>,
} as const;

export default function ShareDock({ path, title, hook, variant = "bar", saveType, saveRef, noSave }: Props) {
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [showRail, setShowRail] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const text = trimForX(hook || title);

  // rail appears only once the reader scrolls past ~one viewport (past the hero).
  useEffect(() => {
    if (variant !== "rail") return;
    const onScroll = () => setShowRail(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  // Channel buttons are real <a> links (hover preview, right/middle-click, no-JS),
  // so this just records the share; the browser follows the href.
  const intentOf = (c: ShareChannel) => channelIntent(c, { path, text, title }) ?? "#";
  const track = (c: ShareChannel) => () => mtEvent(`share:${c}`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareHref(path, "copy"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the visible buttons still work */ }
    mtEvent("share:copy");
  };

  const native = async () => {
    try {
      if (navigator.share) { await navigator.share({ title, text, url: shareHref(path, "native") }); mtEvent("share:native"); return; }
    } catch { return; /* user dismissed */ }
    setSheet(true); // no native sheet → our bottom sheet
  };

  const Save = saveType && saveRef && !noSave
    ? <span className="shd-save"><SaveButton entityType={saveType} entityRef={saveRef} variant="bookmark" /></span>
    : null;

  /* ---------- fab (mobile) ---------- */
  if (variant === "fab") {
    return (
      <>
        <button className="shd-fab" onClick={native} aria-label={`Share ${title}`}>{I.share}</button>
        {sheet ? <BottomSheet onClose={() => setSheet(false)} title={title}
          intentOf={intentOf} track={track} copy={copy} copied={copied} Save={Save} /> : null}
        <style>{FAB_CSS}</style>
      </>
    );
  }

  /* ---------- rail (desktop sticky) ---------- */
  if (variant === "rail") {
    return (
      <div ref={railRef} className={`shd-rail${showRail ? " shd-rail--on" : ""}`} aria-label="Share">
        {PRIMARY_CHANNELS.map((c) => (
          <a key={c} className="shd-ib" href={intentOf(c)} target="_blank" rel="noopener" onClick={track(c)} aria-label={`Share on ${CHANNEL_LABEL[c]}`}>{I[c as keyof typeof I]}</a>
        ))}
        <button className="shd-ib" onClick={copy} aria-label="Copy link">{copied ? <span className="shd-ok">✓</span> : I.copy}</button>
        <button className="shd-ib" onClick={native} aria-label="More share options">{I.more}</button>
        {Save}
        <style>{`${BAR_CSS}${RAIL_CSS}`}</style>
      </div>
    );
  }

  /* ---------- bar (default) ---------- */
  return (
    <div className="shd-bar" role="group" aria-label="Share and save">
      <span className="shd-lbl">Share</span>
      {PRIMARY_CHANNELS.map((c) => (
        <a key={c} className="shd-b" href={intentOf(c)} target="_blank" rel="noopener" onClick={track(c)} aria-label={`Share on ${CHANNEL_LABEL[c]}`}>{I[c as keyof typeof I]}<span className="shd-t">{CHANNEL_LABEL[c]}</span></a>
      ))}
      <button className="shd-b" onClick={copy} aria-label="Copy link">{copied ? <span className="shd-ok">✓</span> : I.copy}<span className="shd-t">{copied ? "Copied" : "Copy link"}</span></button>
      <button className="shd-b shd-b--icon" onClick={native} aria-label="More share options">{I.more}</button>
      {Save ? <><span className="shd-div" aria-hidden />{Save}</> : null}
      {sheet ? <BottomSheet onClose={() => setSheet(false)} title={title}
        intentOf={intentOf} track={track} copy={copy} copied={copied} Save={Save} /> : null}
      <style>{BAR_CSS}</style>
    </div>
  );
}

function BottomSheet({ onClose, title, intentOf, track, copy, copied, Save }: {
  onClose: () => void; title: string; intentOf: (c: ShareChannel) => string; track: (c: ShareChannel) => () => void; copy: () => void; copied: boolean; Save: React.ReactNode;
}) {
  const all: ShareChannel[] = [...PRIMARY_CHANNELS, ...MORE_CHANNELS];
  return (
    <div className="shd-ov" role="dialog" aria-modal="true" aria-label={`Share ${title}`} onClick={onClose}>
      <div className="shd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="shd-sheet__h">Share</div>
        <div className="shd-grid">
          {all.map((c) => (
            <a key={c} className="shd-g" href={intentOf(c)} target="_blank" rel="noopener" onClick={() => { track(c)(); onClose(); }}>
              <span className="shd-g__i">{I[c as keyof typeof I] ?? I.more}</span>{CHANNEL_LABEL[c]}
            </a>
          ))}
          <button className="shd-g" onClick={() => { copy(); }}>
            <span className="shd-g__i">{copied ? <span className="shd-ok">✓</span> : I.copy}</span>{copied ? "Copied" : "Copy link"}
          </button>
        </div>
        {Save ? <div className="shd-sheet__save">{Save}</div> : null}
        <button className="shd-sheet__close" onClick={onClose}>Close</button>
        <style>{SHEET_CSS}</style>
      </div>
    </div>
  );
}

/* ---------- styles (scoped, token-driven, dark-safe) ---------- */
const BAR_CSS = `
.shd-bar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-family:var(--font-ui)}
.shd-lbl{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--subtle,#8f8f8f);margin-right:2px}
.shd-b{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border:1px solid var(--hairline,#ddd);border-radius:16px;background:var(--bg,#fff);color:var(--ink,#111);font-size:13px;font-family:inherit;cursor:pointer;transition:border-color .12s,color .12s}
.shd-b:hover{border-color:var(--accent,#e3120b);color:var(--accent,#e3120b)}
.shd-b--icon{padding:0 9px}
.shd-t{line-height:1}
.shd-ok{color:#0f8a4f;font-weight:700}
.shd-div{width:1px;height:20px;background:var(--hairline,#ddd);margin:0 3px}
.shd-save :is(button,a){height:32px}
@media(max-width:560px){.shd-b .shd-t{display:none}.shd-b{padding:0 9px;width:32px;justify-content:center}.shd-lbl{display:none}}
`;
const RAIL_CSS = `
.shd-rail{position:sticky;top:120px;display:none;flex-direction:column;gap:6px;opacity:0;transition:opacity .25s}
@media(min-width:1080px){.shd-rail{display:flex}}
.shd-rail--on{opacity:1}
.shd-ib{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid var(--hairline,#ddd);border-radius:50%;background:var(--bg,#fff);color:var(--ink,#111);cursor:pointer}
.shd-ib:hover{border-color:var(--accent,#e3120b);color:var(--accent,#e3120b)}
`;
const FAB_CSS = `
.shd-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:80;width:52px;height:52px;border-radius:50%;border:0;background:var(--accent,#e3120b);color:#fff;box-shadow:0 8px 24px -6px rgba(227,18,11,.5);display:flex;align-items:center;justify-content:center;cursor:pointer}
@media(min-width:900px){.shd-fab{display:none}}
`;
const SHEET_CSS = `
.shd-ov{position:fixed;inset:0;z-index:1200;background:rgba(13,13,13,.4);display:flex;align-items:flex-end;justify-content:center}
.shd-sheet{width:100%;max-width:520px;background:var(--bg,#fff);border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));font-family:var(--font-ui)}
.shd-sheet__h{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--subtle,#8f8f8f);margin-bottom:12px}
.shd-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
@media(max-width:400px){.shd-grid{grid-template-columns:repeat(3,1fr)}}
.shd-g{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px;border:0;background:transparent;color:var(--ink,#111);font-size:11.5px;cursor:pointer;border-radius:10px}
.shd-g:hover{background:var(--surface-2,#f2f2f2)}
.shd-g__i{width:40px;height:40px;border-radius:50%;background:var(--surface-2,#f2f2f2);display:flex;align-items:center;justify-content:center;color:var(--ink,#111)}
.shd-sheet__save{margin-top:14px;display:flex;justify-content:center}
.shd-sheet__close{margin-top:14px;width:100%;height:44px;border:1px solid var(--hairline,#ddd);border-radius:12px;background:transparent;color:var(--muted,#666);font-family:inherit;font-size:14px;cursor:pointer}
`;
