/**
 * The Method Docs — deterministic markdown → HTML.
 *
 * A superset of lib/desks.ts essayMdToHtml: same escape-first, no-dependency
 * discipline, plus the block grammar the docs need — anchored H2/H3 headings,
 * "In numbers" stat tiles (from 3-line blockquote blocks), tables (scrollable),
 * plain notes, lists, rules and paragraphs. Input is escaped first; only the
 * transforms below introduce tags. No external markdown library.
 *
 * Grammar the doc bodies (lib/docs/content/*.ts) are written against:
 *   # H1            → dropped (the page renders its own H1 from the registry)
 *   ## Section      → <h2 id="slug"> + red tick
 *   ### Sub         → <h3 id="slug">
 *   > **N** / label / desc            (a 3-line quote block) → one stat tile
 *   > a single sentence               → a muted note (blockquote)
 *   - / 1.          → lists
 *   | a | b |       → table (with a |---| separator row)
 *   ---             → <hr class="rule">
 *   inline: **bold**, *em*, [text](/internal or https://external)
 *
 * Bodies must NOT use backtick code spans or ${...} (they break the TS template
 * literal the body is stored in) — use bold or plain prose instead.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function slugifyHeading(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

/** Inline: links → bold → italic. (No code spans by contract.) */
function inline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>')
    .replace(/\[([^\]]+)\]\((\/[^)\s]*|#[^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

type Block =
  | { t: "para"; lines: string[] }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "quote"; lines: string[] }
  | { t: "table"; rows: string[] };

function renderTable(rows: string[]): string {
  // rows include the header and the |---| separator; split each on unescaped |
  const cells = (row: string) =>
    row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  const isSep = (row: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(row) && row.includes("-");
  const header = cells(rows[0]);
  const bodyRows = rows.slice(1).filter((r) => !isSep(r)).map(cells);
  const thead = `<thead><tr>${header.map((c) => `<th>${inline(esc(c))}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${bodyRows
    .map((r) => `<tr>${r.map((c) => `<td>${inline(esc(c))}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<div class="md-tablewrap"><table class="md-table">${thead}${tbody}</table></div>`;
}

/** A 3-line-ish quote block whose first line is **bold** → a stat tile. */
function isStatQuote(lines: string[]): boolean {
  return lines.length >= 2 && /^\*\*.+\*\*$/.test(lines[0].trim());
}

function renderQuote(lines: string[]): string {
  if (isStatQuote(lines)) {
    const n = lines[0].replace(/^\*\*(.+)\*\*$/, "$1").trim();
    const label = lines[1]?.trim() ?? "";
    const detail = lines.slice(2).join(" ").trim();
    return (
      `<div class="md-tile">` +
      `<div class="md-tile-n">${inline(esc(n))}</div>` +
      (label ? `<div class="md-tile-l">${inline(esc(label))}</div>` : "") +
      (detail ? `<div class="md-tile-d">${inline(esc(detail))}</div>` : "") +
      `</div>`
    );
  }
  return `<blockquote class="md-note"><p>${inline(esc(lines.join(" ")))}</p></blockquote>`;
}

export function renderDocMarkdown(md: string): string {
  const src = md.replace(/\r\n/g, "\n").trim();
  const lines = src.split("\n");
  const out: string[] = [];
  let block: Block | null = null;
  let firstH1Dropped = false;
  let tileBuf: string[] = [];

  const flushTiles = () => {
    if (tileBuf.length) {
      out.push(`<div class="md-tiles">${tileBuf.join("")}</div>`);
      tileBuf = [];
    }
  };
  const flush = () => {
    if (!block) return;
    if (block.t === "para") out.push(`<p class="body reading">${inline(esc(block.lines.join(" ")))}</p>`);
    else if (block.t === "ul" || block.t === "ol")
      out.push(`<${block.t}>${block.items.map((i) => `<li>${inline(esc(i))}</li>`).join("")}</${block.t}>`);
    else if (block.t === "table") out.push(renderTable(block.rows));
    else if (block.t === "quote") {
      const html = renderQuote(block.lines);
      if (html.startsWith("<div class=\"md-tile\">")) tileBuf.push(html);
      else {
        flushTiles();
        out.push(html);
      }
    }
    // paragraphs/lists/tables end any pending tile run
    if (block.t !== "quote") flushTiles();
    block = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const t = line.trim();

    if (!t) {
      flush();
      continue;
    }

    // headings
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      flush();
      flushTiles();
      if (h[1].length === 1 && !firstH1Dropped) {
        firstH1Dropped = true; // page supplies its own H1 from the registry
        continue;
      }
      const lvl = Math.max(2, Math.min(4, h[1].length));
      const id = slugifyHeading(h[2]);
      out.push(`<h${lvl} id="${id}" class="md-h${lvl}">${inline(esc(h[2]))}</h${lvl}>`);
      if (lvl === 2) out.push(`<div class="tick"></div>`);
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flush();
      flushTiles();
      out.push(`<hr class="rule" />`);
      continue;
    }

    // table row
    if (/^\|.*\|/.test(t)) {
      if (!block || block.t !== "table") {
        flush();
        block = { t: "table", rows: [] };
      }
      (block as { t: "table"; rows: string[] }).rows.push(t);
      continue;
    }

    // blockquote
    if (t.startsWith(">")) {
      if (!block || block.t !== "quote") {
        flush();
        block = { t: "quote", lines: [] };
      }
      (block as { t: "quote"; lines: string[] }).lines.push(t.replace(/^>\s?/, ""));
      continue;
    }

    // unordered list
    const ul = /^[-*]\s+(.*)$/.exec(t);
    if (ul) {
      if (!block || block.t !== "ul") {
        flush();
        block = { t: "ul", items: [] };
      }
      (block as { t: "ul"; items: string[] }).items.push(ul[1]);
      continue;
    }

    // ordered list
    const ol = /^\d+\.\s+(.*)$/.exec(t);
    if (ol) {
      if (!block || block.t !== "ol") {
        flush();
        block = { t: "ol", items: [] };
      }
      (block as { t: "ol"; items: string[] }).items.push(ol[1]);
      continue;
    }

    // paragraph
    if (!block || block.t !== "para") {
      flush();
      block = { t: "para", lines: [] };
    }
    (block as { t: "para"; lines: string[] }).lines.push(t);
  }
  flush();
  flushTiles();
  return out.join("\n");
}

/** Plain-text reduction for meta descriptions / word counts. */
export function docToPlain(md: string): string {
  return md
    .replace(/^#.*$/gm, "")
    .replace(/^[>\-*|].*$/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
