#!/usr/bin/env node
/**
 * i18n-seed-ui-strings — put the app's UI dictionaries into content_i18n.
 *
 * Owner directive 2026-08-06: corner names and other chrome should live in the
 * database, so every language can be corrected in one place instead of four
 * TypeScript files and an app release.
 *
 * The bundle keeps its dictionaries — they are the instant, offline layer, and a
 * button that waits on a network round-trip is worse than a button in English.
 * The database becomes the OVERRIDE: whatever it holds wins at render, so a bad
 * string can be fixed for every language at once, live, with no release.
 *
 *   entity_type = 'ui'
 *   entity_key  = the dictionary key ("you.appLanguage")
 *   field       = 'text'
 *   lang        = en | ko | es | ja
 *
 * Emits JSON batches; loading is the usual scripts/load-content-i18n.mjs.
 *
 *   node scripts/i18n-seed-ui-strings.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const DICTS = join(ROOT, "mobile/src/i18n/dict");
const OUT = join(ROOT, "data/i18n/out/ui_strings");
const LOCALES = ["en", "ko", "es", "ja"];

/** The dicts are `export const ko: Record<DictKey, string> = { … }` — parse the
 *  literal rather than importing, so this stays a plain script with no bundler. */
function parseDict(loc) {
  const src = readFileSync(join(DICTS, `${loc}.ts`), "utf8");
  const out = new Map();
  // "key": "value" — values may contain escaped quotes
  const re = /^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.set(m[1], m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return out;
}

const dicts = Object.fromEntries(LOCALES.map((l) => [l, parseDict(l)]));
const enKeys = [...dicts.en.keys()];

// Key parity is the invariant the audit script already checks; report drift here
// too, because a key missing in one language is a silent English fallback.
for (const loc of LOCALES) {
  const missing = enKeys.filter((k) => !dicts[loc].has(k));
  const extra = [...dicts[loc].keys()].filter((k) => !dicts.en.has(k));
  console.log(
    `${loc}: ${dicts[loc].size} keys` +
      (missing.length ? ` · ⚠️ ${missing.length} missing` : "") +
      (extra.length ? ` · ⚠️ ${extra.length} not in en` : ""),
  );
}

const rows = [];
for (const loc of LOCALES) {
  for (const [key, text] of dicts[loc]) {
    if (!text) continue;
    rows.push({
      entity_type: "ui",
      entity_key: key,
      field: "text",
      lang: loc,
      text,
      model: "seed-from-bundle",
      // The English string is the source of truth for staleness: when the English
      // copy changes, every other language's row is stale by definition.
      source_sha256: createHash("sha256").update(dicts.en.get(key) ?? "").digest("hex"),
    });
  }
}

mkdirSync(OUT, { recursive: true });
for (let i = 0; i < rows.length; i += 500) {
  writeFileSync(
    join(OUT, `${String(i / 500).padStart(5, "0")}.json`),
    JSON.stringify(rows.slice(i, i + 500), null, 1),
  );
}
console.log(`\n${rows.length} rows → ${OUT}`);
console.log("load: node scripts/load-content-i18n.mjs --locale ko --dir data/i18n/out/ui_strings --gentle");
console.log("(the loader takes lang from each row, so one pass covers all four)");
