"use client";
/** TakeEditor — the /room/takes writing surface (spec §3.13, the riskiest
 *  frontend piece of the v3 redesign — scope is deliberately frozen).
 *
 *  An ISOLATED Selection/Range-based command layer replacing the deprecated
 *  document.execCommand. STRICTLY the five ops the old composer had —
 *  bold / italic / h2 / quote / link — plus paste-as-plain-text. NO new ops,
 *  no scope growth. Every tag this layer can produce (strong, em, h2,
 *  blockquote, p, br, a[href^=http]) sits inside the server-side
 *  sanitize_user_html whitelist, which remains the safety net — the client
 *  is never trusted.
 *
 *  Contract: parent owns the html string; this component loads it into the
 *  contenteditable when the draft key changes (or when the value changes while
 *  the editor is not focused) and emits every DOM mutation via onChange. */
import { useCallback, useEffect, useRef } from "react";

const INLINE_ALIAS: Record<"bold" | "italic", string[]> = {
  bold: ["STRONG", "B"],
  italic: ["EM", "I"],
};
const INLINE_TAG: Record<"bold" | "italic", "strong" | "em"> = { bold: "strong", italic: "em" };
const BLOCK_TAGS = ["P", "DIV", "H2", "H3", "BLOCKQUOTE", "UL", "OL", "LI", "PRE"];

/** Current selection range, only if it lives inside the editor root. */
function getRange(root: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  return root.contains(r.commonAncestorContainer) ? r : null;
}

/** Nearest ancestor (inside root) whose tagName is in `tags`. */
function closestIn(root: HTMLElement, node: Node, tags: string[]): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n instanceof HTMLElement && tags.includes(n.tagName)) return n;
    n = n.parentNode;
  }
  return null;
}

/** Replace an element with its own children. */
function unwrap(el: Element) {
  const p = el.parentNode;
  if (!p) return;
  while (el.firstChild) p.insertBefore(el.firstChild, el);
  p.removeChild(el);
  if (p instanceof HTMLElement) p.normalize();
}

/** Strip every matching element inside a fragment (prevents nested wrappers). */
function unwrapAll(frag: DocumentFragment, selector: string) {
  frag.querySelectorAll(selector).forEach(unwrap);
}

function selectContents(node: Node, collapseToEnd = false) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(node);
  if (collapseToEnd) r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Top-level block containing `node`; a bare top-level inline run gets wrapped
 *  into a fresh <p> first (contenteditable roots often hold naked text nodes). */
function blockOf(root: HTMLElement, node: Node): HTMLElement | null {
  let n: Node = node;
  if (n === root) {
    // Caret directly on the root — use the child at the caret if any.
    const first = root.firstChild;
    if (!first) return null;
    n = first;
  }
  while (n.parentNode && n.parentNode !== root) n = n.parentNode;
  if (n instanceof HTMLElement && BLOCK_TAGS.includes(n.tagName)) return n;
  // Wrap the contiguous inline run (text/inline siblings) into a <p>.
  const p = document.createElement("p");
  root.insertBefore(p, n);
  let cur: Node | null = n;
  while (cur && !(cur instanceof HTMLElement && BLOCK_TAGS.includes(cur.tagName))) {
    const next: Node | null = cur.nextSibling;
    p.appendChild(cur);
    cur = next;
  }
  return p;
}

export type TakeEditorCmd = "bold" | "italic" | "h2" | "quote" | "link";

const BTNS: { cmd: TakeEditorCmd; icon: string; title: string }[] = [
  { cmd: "bold", icon: "ti-bold", title: "Bold" },
  { cmd: "italic", icon: "ti-italic", title: "Italic" },
  { cmd: "h2", icon: "ti-heading", title: "Heading" },
  { cmd: "quote", icon: "ti-blockquote", title: "Quote" },
  { cmd: "link", icon: "ti-link", title: "Link (http/https)" },
];

export default function TakeEditor({ draftKey, html, placeholder, onChange }: {
  /** Identity of the draft being edited — content reloads when this changes. */
  draftKey: string;
  /** Body HTML owned by the parent. */
  html: string;
  placeholder: string;
  onChange: (html: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  /* Load content on draft switch; also adopt external restores (e.g. the
     localStorage overlay landing after mount) — but never clobber live typing. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (html || "")) el.innerHTML = html || "";
  }, [draftKey, html]);

  const emit = useCallback(() => {
    if (rootRef.current) onChange(rootRef.current.innerHTML);
  }, [onChange]);

  const toggleInline = useCallback((kind: "bold" | "italic") => {
    const root = rootRef.current;
    if (!root) return;
    const range = getRange(root);
    if (!range || range.collapsed) return; // no typing-state toggle in the minimal layer
    const alias = INLINE_ALIAS[kind];
    const hitStart = closestIn(root, range.startContainer, alias);
    const hitEnd = closestIn(root, range.endContainer, alias);
    if (hitStart && hitStart === hitEnd) {
      unwrap(hitStart); // whole selection inside one wrapper → toggle off
      return;
    }
    const frag = range.extractContents();
    unwrapAll(frag, alias.map((t) => t.toLowerCase()).join(","));
    const el = document.createElement(INLINE_TAG[kind]);
    el.appendChild(frag);
    range.insertNode(el);
    selectContents(el);
  }, []);

  const toggleBlock = useCallback((tag: "H2" | "BLOCKQUOTE") => {
    const root = rootRef.current;
    if (!root) return;
    const range = getRange(root);
    if (!range) return;
    const blk = blockOf(root, range.startContainer);
    if (!blk) {
      // Empty editor — open the block so typing continues inside it.
      const el = document.createElement(tag.toLowerCase());
      el.appendChild(document.createElement("br"));
      root.appendChild(el);
      selectContents(el, true);
      return;
    }
    const target = blk.tagName === tag ? "p" : tag.toLowerCase();
    const el = document.createElement(target);
    while (blk.firstChild) el.appendChild(blk.firstChild);
    blk.replaceWith(el);
    selectContents(el, true);
  }, []);

  const applyLink = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const range = getRange(root);
    if (!range) return;
    const existing = closestIn(root, range.startContainer, ["A"]);
    const url = window.prompt("Link URL (http/https only)", existing?.getAttribute("href") ?? "https://");
    if (url == null) return; // cancelled
    const clean = url.trim();
    if (existing) {
      if (!clean) { unwrap(existing); return; } // empty URL → unlink
      if (/^https?:\/\//i.test(clean)) existing.setAttribute("href", clean);
      return;
    }
    if (range.collapsed || !/^https?:\/\//i.test(clean)) return;
    const frag = range.extractContents();
    unwrapAll(frag, "a");
    const a = document.createElement("a");
    a.setAttribute("href", clean);
    a.appendChild(frag);
    range.insertNode(a);
    selectContents(a);
  }, []);

  const exec = useCallback((cmd: TakeEditorCmd) => {
    rootRef.current?.focus();
    if (cmd === "bold" || cmd === "italic") toggleInline(cmd);
    else if (cmd === "h2") toggleBlock("H2");
    else if (cmd === "quote") toggleBlock("BLOCKQUOTE");
    else if (cmd === "link") applyLink();
    emit();
  }, [toggleInline, toggleBlock, applyLink, emit]);

  /* Paste as plain text — always. Rich clipboard markup never enters the DOM;
     newlines become <br> (both inside the sanitizer whitelist). */
  const onPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const root = rootRef.current;
    if (!root) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const range = getRange(root);
    if (!range) return;
    range.deleteContents();
    const frag = document.createDocumentFragment();
    text.split(/\r?\n/).forEach((line, i) => {
      if (i > 0) frag.appendChild(document.createElement("br"));
      if (line) frag.appendChild(document.createTextNode(line));
    });
    const last = frag.lastChild;
    range.insertNode(frag);
    if (last) {
      const sel = window.getSelection();
      if (sel) {
        const nr = document.createRange();
        nr.setStartAfter(last);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    }
    emit();
  }, [emit]);

  return (
    <>
      <div className="fmtbar">
        {BTNS.map((b) => (
          <button
            key={b.cmd}
            type="button"
            title={b.title}
            onMouseDown={(e) => { e.preventDefault(); exec(b.cmd); }}
          >
            <i className={`ti ${b.icon}`} />
          </button>
        ))}
      </div>
      <div
        className="bodyed"
        ref={rootRef}
        contentEditable
        suppressContentEditableWarning
        data-ph={placeholder}
        onInput={emit}
        onPaste={onPaste}
      />
    </>
  );
}
