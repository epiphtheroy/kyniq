"use client";
/**
 * McpConnectButton — "Metatake in Your AI": the live sibling of "Download for AI".
 * Where Download saves a one-time file, this connects the user's AI app to our
 * MCP server so it can read Metatake live, mid-conversation. The button opens a
 * plain-language guide written for people who have never heard of MCP: what this
 * is, the server address (copyable), the three claude.ai steps, and a try-it
 * prompt personalized to the current film. Full technical guide stays at /mcp.
 *
 * Variants mirror DownloadPackModal: hero (film hero pill, next to the gold
 * Download) and rail (compact, end of the tab row). Teal against Download's
 * gold — connected/live vs. saved/file.
 */
import { useState } from "react";
import { mtEvent } from "@/components/mtTrack";

const ENDPOINT = "https://metatake.net/api/mcp";

export default function McpConnectButton({
  title,
  variant = "rail",
}: {
  title?: string;
  variant?: "hero" | "rail";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"addr" | "prompt" | "">("");

  const tryPrompt = `Search Metatake for ${title || "Mulholland Drive"} and give me its strongest reading, its TakeScore, and three kindred films.`;

  function openModal() {
    setCopied("");
    setOpen(true);
    mtEvent("mcp_guide_open");
  }

  async function copy(what: "addr" | "prompt") {
    try {
      await navigator.clipboard.writeText(what === "addr" ? ENDPOINT : tryPrompt);
      setCopied(what);
      mtEvent(what === "addr" ? "mcp_endpoint_copy" : "mcp_prompt_copy");
      setTimeout(() => setCopied(""), 1800);
    } catch { /* clipboard blocked — the text is visible and selectable anyway */ }
  }

  return (
    <>
      <button
        type="button"
        className={`mcb-trigger mcb-trigger--${variant}`}
        onClick={openModal}
        aria-label="Connect Metatake to your AI assistant — how it works"
      >
        <span aria-hidden>✦</span> {variant === "hero" ? "Metatake in Your AI" : "In Your AI"}
      </button>

      {open ? (
        <div className="mcb-ov" role="dialog" aria-modal="true" aria-label="Metatake in your AI" onClick={() => setOpen(false)}>
          <div className="mcb-box" onClick={(e) => e.stopPropagation()}>
            <div className="mcb-h">
              <span>Metatake in your AI</span>
              <button type="button" className="mcb-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <p className="mcb-lead">
              Your AI can read Metatake <b>directly — live, no copy-paste</b>. Connect once, and
              Claude (or any compatible AI app) can search 6,900+ films and pull this site&rsquo;s
              full criticism — TakeScore, readings, kindred films — whenever you ask. Always
              current, with source links built in.
            </p>
            <p className="mcb-what">
              This works over <b>MCP</b> (Model Context Protocol), an open standard that lets AI
              apps plug into websites like this one. No account, no key — free.
            </p>

            <div className="mcb-addr">
              <span className="mcb-addr__lab">Server address</span>
              <code className="mcb-addr__code">{ENDPOINT}</code>
              <button type="button" className="mcb-copy" onClick={() => copy("addr")}>
                {copied === "addr" ? "Copied ✓" : "Copy"}
              </button>
            </div>

            <ol className="mcb-steps">
              <li>Open <b>claude.ai</b> → Settings → <b>Connectors</b> → <i>Add custom connector</i>.</li>
              <li>Paste the address above and save — <b>Metatake</b> appears as a connector.</li>
              <li>In a chat, switch Metatake on in the tools menu — then just ask.</li>
            </ol>

            <div className="mcb-try">
              <span className="mcb-try__lab">Try asking</span>
              <p className="mcb-try__q">&ldquo;{tryPrompt}&rdquo;</p>
              <button type="button" className="mcb-copy" onClick={() => copy("prompt")}>
                {copied === "prompt" ? "Copied ✓" : "Copy prompt"}
              </button>
            </div>

            <p className="mcb-foot">
              Also works in Claude Code, Cursor, and other MCP-enabled apps —{" "}
              <a href="/mcp">full guide</a>. Free for conversational use · CC BY-NC 4.0,
              attribution travels with every answer.
            </p>
          </div>
          <style>{MCB_CSS}</style>
        </div>
      ) : null}
      <style>{MCB_TRIGGER_CSS}</style>
    </>
  );
}

// Teal trigger — the "live" counterpart to the gold Download pill.
const MCB_TRIGGER_CSS = `
  .mcb-trigger{display:inline-flex;align-items:center;gap:.4em;flex:0 0 auto;
    font:inherit;font-weight:800;line-height:1;white-space:nowrap;cursor:pointer;
    color:#F0FDFA;background:#0F766E;border:1px solid #0B5E58;border-radius:999px;
    box-shadow:0 1px 2px rgba(0,0,0,.15);
    transition:background .15s ease,transform .05s ease,box-shadow .15s ease;-webkit-appearance:none;appearance:none;}
  .mcb-trigger:hover{background:#0D8A80;box-shadow:0 2px 6px rgba(0,0,0,.2);}
  .mcb-trigger:active{transform:translateY(1px);}
  .mcb-trigger--hero{font-size:.86rem;padding:.62em 1.05em;}
  .mcb-trigger--rail{font-size:.74rem;font-weight:700;padding:.42em .8em;align-self:center;margin-left:6px;}
`;

const MCB_CSS = `
  .mcb-ov{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;
    background:rgba(20,22,28,.55);padding:16px;}
  .mcb-box{width:100%;max-width:480px;max-height:86vh;overflow:auto;background:#FCFBF7;color:#1c2029;
    border-radius:14px;border:1px solid rgba(0,0,0,.1);box-shadow:0 20px 60px rgba(0,0,0,.3);padding:18px 18px 16px;}
  .mcb-h{display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:1.02rem;margin-bottom:6px;}
  .mcb-x{border:0;background:none;cursor:pointer;font-size:1rem;color:#6b7280;padding:4px;}
  .mcb-lead{font-size:.85rem;color:#374151;margin:0 0 8px;line-height:1.5;}
  .mcb-what{font-size:.78rem;color:#6b7280;margin:0 0 12px;line-height:1.45;}
  .mcb-addr{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#0f172a;color:#e2e8f0;
    border-radius:10px;padding:10px 12px;margin-bottom:12px;}
  .mcb-addr__lab{flex:0 0 100%;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7dd3c8;}
  .mcb-addr__code{font-size:.8rem;word-break:break-all;flex:1 1 auto;}
  .mcb-copy{flex:0 0 auto;font:inherit;font-weight:700;font-size:.72rem;cursor:pointer;
    padding:.4em .8em;border-radius:7px;border:1px solid #0B5E58;background:#0F766E;color:#F0FDFA;}
  .mcb-copy:hover{background:#0D8A80;}
  .mcb-steps{margin:0 0 12px;padding-left:1.35em;font-size:.85rem;line-height:1.55;color:#1f2937;
    list-style:decimal outside;}
  .mcb-steps li{margin-bottom:4px;display:list-item;}
  .mcb-steps li::marker{font-weight:800;color:#0F766E;}
  .mcb-try{border:1px solid rgba(15,118,110,.3);background:rgba(15,118,110,.06);border-radius:10px;
    padding:10px 12px;margin-bottom:12px;}
  .mcb-try__lab{display:block;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0F766E;margin-bottom:4px;}
  .mcb-try__q{font-size:.83rem;color:#134e4a;margin:0 0 8px;line-height:1.5;font-style:italic;}
  .mcb-foot{font-size:.74rem;color:#6b7280;margin:0;line-height:1.5;border-top:1px solid rgba(0,0,0,.08);padding-top:10px;}
  .mcb-foot a{color:#0F766E;font-weight:700;}
`;
