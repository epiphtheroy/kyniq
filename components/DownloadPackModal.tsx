"use client";
/**
 * DownloadPackModal — the whole-film ".md download" control (points 3 & 4).
 * Renders its own trigger (placed at the bottom-right of the film tab bar) and,
 * on click, a modal to pick sections and download one Markdown file.
 *
 * The DOWNLOAD is login-gated + 10 distinct films / month (copy stays free).
 * Enforced server-side at /api/pack/[slug]/download; this UI mirrors that state.
 */
import { useCallback, useState } from "react";
import { mtEvent } from "@/components/mtTrack";

type Sec = { key: string; label: string };
type Status = { authed: boolean; limit: number; remaining: number; already: boolean } | null;

export default function DownloadPackModal({ slug, sections }: { slug: string; sections: Sec[] }) {
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
    setBusy(true);
    setMsg("");
    const keys = sections.filter((s) => sel.has(s.key)).map((s) => s.key);
    try {
      const res = await fetch(
        `/api/pack/${encodeURIComponent(slug)}/download?dl=1&sections=${encodeURIComponent(keys.join(","))}`,
        { cache: "no-store" }
      );
      if (res.status === 401) { setMsg("Please sign in to download."); await load(); return; }
      if (res.status === 402) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error || "Monthly download limit reached. Copying stays free.");
        await load();
        return;
      }
      if (!res.ok) { setMsg("Download failed. Please try again."); return; }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const fname = /filename="([^"]+)"/.exec(cd)?.[1] || `metatake-pack_${slug}.md`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname; document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      mtEvent("pack_download");
      setMsg("Saved. It's in your library at /room/packs.");
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
      <button type="button" className="dpm-trigger" onClick={openModal} aria-label="Download this film as a Markdown file for AI">
        ⭳ Download film
      </button>

      {open ? (
        <div className="dpm-ov" role="dialog" aria-modal="true" aria-label="Download film pack" onClick={() => setOpen(false)}>
          <div className="dpm-box" onClick={(e) => e.stopPropagation()}>
            <div className="dpm-h">
              <span>Download this film for AI</span>
              <button type="button" className="dpm-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <p className="dpm-sub">One structured Markdown file with the sections you choose. Copying any tab is always free — a saved file needs a free account (10 films/month).</p>

            <div className="dpm-secs">
              {sections.map((s) => (
                <label key={s.key} className="dpm-sec">
                  <input type="checkbox" checked={sel.has(s.key)} onChange={() => toggle(s.key)} />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>

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
                    ? "You already downloaded this film this month — re-downloading is free."
                    : `${status.remaining} of ${status.limit} film downloads left this month.`}
                </p>
                <button
                  type="button"
                  className="dpm-go"
                  disabled={busy || sel.size === 0 || (!status.already && status.remaining <= 0)}
                  onClick={download}
                >
                  {busy ? "Preparing…" : `Download .md (${sel.size})`}
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

const DPM_TRIGGER_CSS = `
  .dpm-trigger{flex:0 0 auto;align-self:center;margin-left:8px;
    font:inherit;font-size:.72rem;font-weight:700;line-height:1;white-space:nowrap;
    padding:.42em .7em;border-radius:8px;cursor:pointer;
    color:#3d4a60;background:rgba(90,107,134,.1);border:1px solid rgba(90,107,134,.3);
    transition:background .15s ease,border-color .15s ease;-webkit-appearance:none;appearance:none;}
  .dpm-trigger:hover{background:rgba(90,107,134,.2);border-color:rgba(90,107,134,.55);}
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
  .dpm-sec input{width:15px;height:15px;accent-color:#5A6B86;}
  .dpm-gate{border-top:1px solid rgba(0,0,0,.08);padding-top:12px;}
  .dpm-note{font-size:.8rem;color:#4b5563;margin:0 0 10px;}
  .dpm-go{display:inline-block;font:inherit;font-weight:700;font-size:.88rem;cursor:pointer;
    padding:.6em 1.1em;border-radius:9px;border:0;background:#2b3446;color:#fff;text-decoration:none;}
  .dpm-go:hover{background:#1c2431;}
  .dpm-go:disabled{opacity:.45;cursor:not-allowed;}
  .dpm-msg{font-size:.8rem;color:#2b3446;margin:10px 0 0;font-weight:600;}
  @media (max-width:420px){ .dpm-secs{grid-template-columns:1fr;} }
`;
