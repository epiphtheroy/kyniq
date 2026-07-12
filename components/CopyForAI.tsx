"use client";
/**
 * CopyForAI — free, no-login "Copy for AI" button. Copies a structured Markdown
 * context pack to the clipboard for pasting into Claude / ChatGPT / NotebookLM.
 *
 * - variant "pill" (default): the hero button — copies the WHOLE film pack.
 * - variant "tab": a compact icon button next to a tab, copies ONE section
 *   (with a mandatory film-identity header). `section` = a PackSectionKey.
 *
 * Product: HANDOFF-컨텍스트팩-실행.md §6.4 / §2. Self-contained styles.
 */
import { useState } from "react";
import { mtEvent } from "@/components/mtTrack";

type State = "idle" | "copying" | "copied";

export default function CopyForAI({
  slug,
  section,
  variant = "pill",
  label,
}: {
  slug: string;
  section?: string;
  variant?: "pill" | "tab";
  label?: string;
}) {
  const [state, setState] = useState<State>("idle");

  async function copy(e?: React.MouseEvent) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (state === "copying") return;
    setState("copying");
    const url = section
      ? `/api/pack/${encodeURIComponent(slug)}?section=${encodeURIComponent(section)}`
      : `/api/pack/${encodeURIComponent(slug)}`;
    try {
      const blobP = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`pack ${r.status}`);
        return r.blob();
      });
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blobP as unknown as Blob })]);
      } else {
        const text = await (await blobP).text();
        await navigator.clipboard.writeText(text);
      }
      mtEvent(section ? `copy_for_ai:${section}` : "copy_for_ai");
      setState("copied");
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      try { window.open(url, "_blank", "noopener"); } catch {}
      setState("idle");
    }
  }

  if (variant === "tab") {
    const t = state === "copied" ? "Copied ✓" : state === "copying" ? "…" : "✦ AI";
    return (
      <button
        type="button"
        className="cfa-btn cfa-btn--tab"
        onClick={copy}
        aria-label={`Copy the ${section || "film"} section for AI`}
        title="Copy this section as Markdown for Claude, ChatGPT, or NotebookLM"
      >
        {t}
        <style>{CFA_CSS}</style>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="cfa-btn"
      onClick={copy}
      aria-label="Copy an AI context pack for this film"
      title="Copy a structured context pack (Markdown) for Claude, ChatGPT, or NotebookLM"
    >
      <span className="cfa-ico" aria-hidden>{state === "copied" ? "✓" : "✦"}</span>
      {state === "copied" ? "Copied for AI" : state === "copying" ? "Copying…" : label || "Copy for AI"}
      <style>{CFA_CSS}</style>
    </button>
  );
}

const CFA_CSS = `
  .cfa-btn{display:inline-flex;align-items:center;gap:.4em;
    font:inherit;font-size:.82rem;font-weight:600;line-height:1;
    padding:.5em .8em;border-radius:999px;cursor:pointer;
    color:#e9e6df;background:rgba(255,255,255,.08);
    border:1px solid rgba(255,255,255,.22);
    transition:background .15s ease,border-color .15s ease,transform .05s ease;
    white-space:nowrap;-webkit-appearance:none;appearance:none;}
  .cfa-btn:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.4);}
  .cfa-btn:active{transform:translateY(1px);}
  .cfa-ico{font-size:.9em;opacity:.9;}
  .cfa-btn--tab{font-size:.66rem;font-weight:700;letter-spacing:.02em;
    padding:.28em .5em;color:#5A6B86;background:rgba(90,107,134,.09);
    border-color:rgba(90,107,134,.28);}
  .cfa-btn--tab:hover{background:rgba(90,107,134,.18);border-color:rgba(90,107,134,.5);color:#3d4a60;}
`;
