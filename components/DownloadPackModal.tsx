"use client";
/**
 * DownloadPackModal — "Download for AI": pick sections → save ONE Markdown file.
 * Renders its own colored trigger (hero variant = big pill in the film hero;
 * rail variant = compact, lives at the end of the tab row). Opening it shows a
 * section selector; downloading saves a real file — via the browser's folder /
 * filename picker where supported (Chrome/Edge), else a normal download. It never
 * navigates to a raw-Markdown page.
 *
 * DOWNLOAD is login-gated + 10 new films/month (copy stays free); the quota is
 * claimed atomically server-side (/api/pack/[slug]/download).
 */
import { useCallback, useState } from "react";
import { mtEvent } from "@/components/mtTrack";

type Sec = { key: string; label: string };
type Status = { authed: boolean; limit: number; remaining: number; already: boolean } | null;

export default function DownloadPackModal({
  slug,
  sections,
  variant = "rail",
}: {
  slug: string;
  sections: Sec[];
  variant?: "rail" | "hero" | "section";
}) {
  const single = sections.length === 1;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [sel, setSel] = useState<Set<string>>(() => new Set(sections.map((s) => s.key)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(async () => {
    setStatus(null);
    try {
      const r = await fetch(`/api/pack/${encodeURIComponent(slug)}/download`, { cache: "no-store" });
      setStatus(await r.json());
    } catch {
      setStatus({ authed: false, limit: 10, remaining: 0, already: false });
    }
  }, [slug]);

  function openModal() {
    setMsg("");
    setSel(new Set(sections.map((s) => s.key)));
    setOpen(true);
    mtEvent("pack_download_open");
    load();
  }

  function toggle(k: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  async function download() {
    if (busy || sel.size === 0) return;
    const keys = sections.filter((s) => sel.has(s.key)).map((s) => s.key);
    const scope = keys.length < sections.length ? "custom" : "full";
    const fname = `metatake-pack_${slug}_${scope}.md`;

    // 1) If the File System Access API exists, let the user pick a folder/name FIRST
    //    (during the click gesture). Cancelling here means no fetch and no quota spent.
    let handle: FileSystemFileHandle | null = null;
    const picker = (window as unknown as {
      showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker;
    if (picker) {
      try {
        handle = await picker({
          suggestedName: fname,
          types: [{ description: "Markdown file", accept: { "text/markdown": [".md"] } }],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // user cancelled
        handle = null; // any other error → fall back to a normal download
      }
    }

    setBusy(true);
    setMsg("");
    try {
      // 2) Fetch the gated endpoint (this atomically claims the quota slot).
      const res = await fetch(
        `/api/pack/${encodeURIComponent(slug)}/download?dl=1&sections=${encodeURIComponent(keys.join(","))}`,
        { cache: "no-store" }
      );
      if (res.status === 401) { setMsg("Please sign in to download."); await load(); return; }
      if (res.status === 402) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        setMsg(j.error || "Monthly download limit reached. Copying stays free.");
        await load();
        return;
      }
      if (!res.ok) { setMsg("Download failed. Please try again."); return; }
      const md = await res.text();
      const cd = res.headers.get("content-disposition") || "";
      const serverName = /filename="([^"]+)"/.exec(cd)?.[1] || fname;

      // 3) Write the file — to the chosen location, or a normal browser download.
      if (handle) {
        const ws = await handle.createWritable();
        await ws.write(md);
        await ws.close();
      } else {
        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = serverName; document.body.appendChild(a); a.click();
        a.remove(); URL.revokeObjectURL(url);
      }
      mtEvent("pack_download");
      setMsg("Saved. It's also in your library at /room/packs.");
      await load();
    } catch {
      setMsg("Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const loginHref = typeof window !== "undefined"
    ? `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
    : "/login";

  return (
    <>
      <button
        type="button"
        className={`dpm-trigger dpm-trigger--${variant}`}
        onClick={openModal}
        aria-label={single ? `Download the ${sections[0].label} section for AI` : "Download this film as a Markdown file for AI"}
      >
        <span aria-hidden>⬇</span> {variant === "hero" ? "Download for AI" : "Download"}
      </button>

      {open ? (
        <div className="dpm-ov" role="dialog" aria-modal="true" aria-label="Download film pack" onClick={() => setOpen(false)}>
          <div className="dpm-box" onClick={(e) => e.stopPropagation()}>
            <div className="dpm-h">
              <span>{single ? `Download: ${sections[0].label}` : "Download this film for AI"}</span>
              <button type="button" className="dpm-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <p className="dpm-sub">
              {single
                ? `Saves the ${sections[0].label} section as a Markdown file (with the film's basics on top) — attach it to Claude, ChatGPT, or NotebookLM. Saving a file needs a free account (10 films/month); the section stays free to read here.`
                : "One structured Markdown file with the sections you choose — attach it to Claude, ChatGPT, or NotebookLM. Saving a file needs a free account (10 films/month)."}
            </p>

            {single ? null : (
              <div className="dpm-secs">
                {sections.map((s) => (
                  <label key={s.key} className="dpm-sec">
                    <input type="checkbox" checked={sel.has(s.key)} onChange={() => toggle(s.key)} />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            )}

            {status == null ? (
              <p className="dpm-note">Checking your account…</p>
            ) : !status.authed ? (
              <div className="dpm-gate">
                <p>Sign in to save the file. Your downloads collect in your library.</p>
                <a className="dpm-go" href={loginHref}>Sign in to download</a>
              </div>
            ) : (
              <div className="dpm-gate">
                <p className="dpm-note">
                  {status.already
                    ? "You already downloaded this film — re-downloading is free."
                    : `${status.remaining} of ${status.limit} new-film downloads left this month.`}
                </p>
                <button
                  type="button"
                  className="dpm-go"
                  disabled={busy || sel.size === 0 || (!status.already && status.remaining <= 0)}
                  onClick={download}
                >
                  {busy ? "Saving…" : `Save .md (${sel.size} section${sel.size === 1 ? "" : "s"})`}
                </button>
              </div>
            )}

            {msg ? <p className="dpm-msg">{msg}</p> : null}
          </div>
          <style>{DPM_CSS}</style>
        </div>
      ) : null}
      <style>{DPM_TRIGGER_CSS}</style>
    </>
  );
}

// Colored, high-contrast trigger (gold with dark ink). Hero = prominent pill;
// rail = compact so it fits at the end of the scrolling tab row.
const DPM_TRIGGER_CSS = `
  .dpm-trigger{display:inline-flex;align-items:center;gap:.4em;flex:0 0 auto;
    font:inherit;font-weight:800;line-height:1;white-space:nowrap;cursor:pointer;
    color:#241a06;background:#E4B23C;border:1px solid #B98A22;border-radius:999px;
    box-shadow:0 1px 2px rgba(0,0,0,.15);
    transition:background .15s ease,transform .05s ease,box-shadow .15s ease;-webkit-appearance:none;appearance:none;}
  .dpm-trigger:hover{background:#F0C255;box-shadow:0 2px 6px rgba(0,0,0,.2);}
  .dpm-trigger:active{transform:translateY(1px);}
  .dpm-trigger--hero{font-size:.86rem;padding:.62em 1.05em;}
  .dpm-trigger--rail{font-size:.74rem;font-weight:700;padding:.42em .8em;align-self:center;margin-left:6px;}
  .dpm-trigger--section{font-size:.72rem;font-weight:700;padding:.34em .72em;margin:8px 0 4px;vertical-align:middle;}
`;

const DPM_CSS = `
  .dpm-ov{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;
    background:rgba(20,22,28,.55);padding:16px;}
  .dpm-box{width:100%;max-width:440px;max-height:86vh;overflow:auto;background:#FCFBF7;color:#1c2029;
    border-radius:14px;border:1px solid rgba(0,0,0,.1);box-shadow:0 20px 60px rgba(0,0,0,.3);padding:18px 18px 16px;}
  .dpm-h{display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:1.02rem;margin-bottom:4px;}
  .dpm-x{border:0;background:none;cursor:pointer;font-size:1rem;color:#6b7280;padding:4px;}
  .dpm-sub{font-size:.82rem;color:#4b5563;margin:2px 0 12px;line-height:1.45;}
  .dpm-secs{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-bottom:12px;}
  .dpm-sec{display:flex;align-items:center;gap:7px;font-size:.86rem;cursor:pointer;}
  .dpm-sec input{width:15px;height:15px;accent-color:#B98A22;}
  .dpm-gate{border-top:1px solid rgba(0,0,0,.08);padding-top:12px;}
  .dpm-note{font-size:.8rem;color:#4b5563;margin:0 0 10px;}
  .dpm-go{display:inline-block;font:inherit;font-weight:700;font-size:.88rem;cursor:pointer;
    padding:.6em 1.1em;border-radius:9px;border:0;background:#2b3446;color:#fff;text-decoration:none;}
  .dpm-go:hover{background:#1c2431;}
  .dpm-go:disabled{opacity:.45;cursor:not-allowed;}
  .dpm-msg{font-size:.8rem;color:#2b3446;margin:10px 0 0;font-weight:600;}
  @media (max-width:420px){ .dpm-secs{grid-template-columns:1fr;} }
`;
