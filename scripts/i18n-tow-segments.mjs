#!/usr/bin/env node
/**
 * i18n-tow-segments — split / reassemble the to.W comment corpus.
 *
 * to.W comments are TEMPLATE-ASSEMBLED, not free prose: 6,837 rows collapse to
 * ~1,500 distinct segments. Translating per row would (a) burn 10x the tokens and
 * (b) render the SAME English sentence differently on different films. So we
 * translate each distinct segment once and reassemble deterministically —
 * master doc Layer B, "generator i18n".
 *
 *   node scripts/i18n-tow-segments.mjs split      # tow.json -> tow_segments.json + assembly map
 *   node scripts/i18n-tow-segments.mjs assemble   # translated segments -> content_i18n rows
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const SRC = join(ROOT, "data/i18n/src2");
const OUT = join(ROOT, "data/i18n/out");
const ASSEMBLY = join(SRC, "tow_assembly.json");
const sha = (s) => createHash("sha256").update(s).digest("hex");

/** Lossless tokenizer: alternating segment / separator, concat === original. */
function tokenize(text) {
  const parts = [];
  // separators we keep verbatim: " · " and the space between sentences
  const re = /( · |(?<=\.)\s+(?=[A-Z(]))/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: "seg", v: text.slice(last, m.index) });
    parts.push({ t: "sep", v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: "seg", v: text.slice(last) });
  return parts;
}

function split() {
  const rows = JSON.parse(readFileSync(join(SRC, "tow.json"), "utf8"));
  const segs = new Map(); // en -> {key, count}
  const assembly = [];
  let lossless = true;
  for (const r of rows) {
    const parts = tokenize(r.en);
    if (parts.map((p) => p.v).join("") !== r.en) { lossless = false; console.error("LOSSY:", r.entity_key); }
    for (const p of parts) {
      if (p.t !== "seg") continue;
      const k = sha(p.v).slice(0, 16);
      if (!segs.has(p.v)) segs.set(p.v, { key: k, count: 0 });
      segs.get(p.v).count++;
    }
    assembly.push({
      entity_key: r.entity_key, sha256: r.sha256,
      parts: parts.map((p) => (p.t === "sep" ? { s: p.v } : { k: segs.get(p.v).key })),
    });
  }
  if (!lossless) { console.error("tokenizer is lossy — aborting"); process.exit(1); }

  const items = [...segs.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([en, m]) => ({
      entity_type: "tow_segment", entity_key: m.key, field: "text",
      en, sha256: sha(en), meta: { uses: m.count },
    }));
  writeFileSync(join(SRC, "tow_segments.json"), JSON.stringify(items, null, 1));
  writeFileSync(ASSEMBLY, JSON.stringify(assembly, null, 1));
  const chars = items.reduce((a, i) => a + i.en.length, 0);
  const full = rows.reduce((a, r) => a + r.en.length, 0);
  console.log(`rows ${rows.length} -> ${items.length} distinct segments`);
  console.log(`chars ${full.toLocaleString()} -> ${chars.toLocaleString()} (${(100 - 100 * chars / full).toFixed(0)}% saved)`);
  console.log(`lossless: yes`);
}

function assemble() {
  const assembly = JSON.parse(readFileSync(ASSEMBLY, "utf8"));
  const dir = join(OUT, "tow_segments");
  if (!existsSync(dir)) { console.error(`no translations at ${dir}`); process.exit(2); }
  const ko = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")))
    for (const r of JSON.parse(readFileSync(join(dir, f), "utf8"))) ko.set(r.entity_key, r.text);
  console.log(`loaded ${ko.size} translated segments`);

  const rows = [], missing = new Set();
  for (const a of assembly) {
    let text = "", ok = true;
    for (const p of a.parts) {
      if (p.s != null) { text += p.s; continue; }
      const t = ko.get(p.k);
      if (t == null) { missing.add(p.k); ok = false; break; }
      text += t;
    }
    if (ok) rows.push({ entity_type: "tow_comment", entity_key: a.entity_key, field: "rationale",
      lang: "ko", text, model: "claude-opus-5", source_sha256: a.sha256 });
  }
  const dest = join(OUT, "tow_assembled");
  mkdirSync(dest, { recursive: true });
  for (let i = 0; i < rows.length; i += 500)
    writeFileSync(join(dest, `${String(i / 500).padStart(5, "0")}.json`),
      JSON.stringify(rows.slice(i, i + 500), null, 1));
  console.log(`assembled ${rows.length}/${assembly.length} rows -> ${dest}`);
  if (missing.size) console.log(`missing ${missing.size} segment translations — rerun the segment corpus`);
}

const cmd = process.argv[2];
if (cmd === "split") split();
else if (cmd === "assemble") assemble();
else { console.error("usage: split | assemble"); process.exit(2); }
