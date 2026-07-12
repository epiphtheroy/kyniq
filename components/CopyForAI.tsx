"use client";
/**
 * CopyForAI — free, no-login "Copy for AI" button on Tier-1 film pages.
 * Copies a structured trim context pack (Markdown) to the clipboard so the
 * visitor can paste it into Claude / ChatGPT / NotebookLM and write on top of it.
 *
 * Product: HANDOFF-컨텍스트팩-실행.md §6.4. Fetches /api/pack/{slug}?tier=trim.
 * Self-contained styles (like ShareDock) — no globals.css edit.
 */
import { useState } from "react";
import { mtEvent } from "@/components/mtTrack";

type State = "idle" | "copying" | "copied";

export default function CopyForAI({ slug }: { slug: string }) {
  const [state, setState] = useState<State>("idle");

  async function copy() {
    if (state === "copying") return;
    setState("copying");
    const url = `/api/pack/${encodeURIComponent(slug)}?tier=trim`;
    try {
      // Safari discards the user-gesture across an awaited fetch, so hand the
      // pending Blob to ClipboardItem instead of awaiting the text first.
      const blobP = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`pack ${r.status}`);
        return r.blob();
      });
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": blobP as unknown as Blob }),
        ]);
      } else {
        const text = await (await blobP).text();
        await navigator.clipboard.writeText(text);
      }
      mtEvent("copy_for_ai");
      setState("copied");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      // Last resort: open the raw pack so the visitor can copy it manually.
      try { window.open(url, "_blank", "noopener"); } catch {}
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      className="cfa-btn"
      onClick={copy}
      aria-label="Copy an AI context pack for this film"
      title="Copy a structured context pack (Markdown) for Claude, ChatGPT, or NotebookLM"
    >
      <span className="cfa-ico" aria-hidden>
        {state === "copied" ? "✓" : "✦"}
      </span>
      {state === "copied" ? "Copied for AI" : state === "copying" ? "Copying…" : "Copy for AI"}
      <style>{`
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
      `}</style>
    </button>
  );
}
