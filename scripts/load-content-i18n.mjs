#!/usr/bin/env node
/**
 * load-content-i18n — upsert content_i18n translations from JSON batch files.
 * 정본: HANDOFF-다국어프로젝션.md (structural-wording layer)
 *
 * The overnight translation agents write JSON batches to data/i18n/content/<loc>/
 * as arrays of { entity_type, entity_key, field, lang, text, model }. This loads
 * them into content_i18n (migration 0107) in chunks. Idempotent (upsert by PK),
 * so re-running and appending are both safe.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY (content_i18n write). Run by the OWNER — the
 * agent sandbox blocks production writes.
 *
 * Usage:
 *   node scripts/load-content-i18n.mjs --locale ko                 # all data/i18n/content/ko/*.json
 *   node scripts/load-content-i18n.mjs --locale ko --dir <path>    # a specific dir
 *   node scripts/load-content-i18n.mjs --locale ko --dry           # parse + count only
 *   node scripts/load-content-i18n.mjs --locale ko --gentle        # pace the write (recovering DB)
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes("--dry");
const LOCALE = arg("--locale");
const DIR = arg("--dir") || (LOCALE ? join("data/i18n/content", LOCALE) : null);
const CHUNK = Number(arg("--chunk") || 250);
// Pacing between chunks. Default 0 (as before), but a recovering database wants
// the write spread out — see the 2026-08-06 saturation incident. --gentle is the
// preset for "the site just fell over; do not be the second wave".
const SLEEP_MS = args.includes("--gentle") ? 1500 : Number(arg("--sleep-ms") || 0);

if (!LOCALE) { console.error("--locale is required"); process.exit(2); }
if (!DIR || !existsSync(DIR)) { console.error(`dir not found: ${DIR}`); process.exit(2); }

for (const line of (existsSync(join(ROOT, ".env.local")) ? readFileSync(join(ROOT, ".env.local"), "utf8").split("\n") : [])) {
  const s = line.trim();
  if (!s || s.startsWith("#") || !s.includes("=")) continue;
  const i = s.indexOf("=");
  const k = s.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Missing SUPABASE url / service role key"); process.exit(1); }

// Gather rows from every JSON batch in DIR, keyed by PK. Overlapping slug
// assignments across batch files mean the same PK can appear twice; Postgres
// rejects a whole upsert if one command carries duplicate constrained values
// (SQLSTATE 21000), so collapse to one row per PK here. Last file wins, which
// is what chunked merge-duplicates upserts already do across chunk boundaries.
const byPk = new Map();
let seen = 0;
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const arr = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  for (const r of arr) {
    if (!r.entity_type || !r.entity_key || !r.field || !r.text) continue;
    seen++;
    const row = {
      entity_type: r.entity_type,
      entity_key: String(r.entity_key),
      field: r.field,
      lang: r.lang || LOCALE,
      text: r.text,
      model: r.model || "claude-fable-5",
      // Staleness anchor: the hash of the English the translation was made from.
      // The 2026-07-17 corpus shipped without it, which is why nothing could tell
      // that an English edit had orphaned its Korean. Carry it whenever present.
      ...(r.source_sha256 ? { source_sha256: r.source_sha256 } : {}),
    };
    byPk.set([row.entity_type, row.entity_key, row.field, row.lang].join("\u0000"), row);
  }
}
const rows = [...byPk.values()];
const collapsed = seen - rows.length;
console.log(`[content_i18n:${LOCALE}] ${rows.length} rows from ${DIR}${DRY ? "  [DRY]" : ""}`);
if (collapsed) console.log(`  · collapsed ${collapsed} duplicate-key row(s) of ${seen} parsed (last file wins)`);
if (DRY || !rows.length) {
  const byType = {};
  for (const r of rows) byType[r.entity_type] = (byType[r.entity_type] || 0) + 1;
  console.log("  by entity_type:", JSON.stringify(byType));
  process.exit(0);
}

async function upsert(chunk) {
  const res = await fetch(`${URL}/rest/v1/content_i18n?on_conflict=entity_type,entity_key,field,lang`, {
    method: "POST",
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(chunk),
  });
  if (!res.ok) throw new Error(`upsert ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

let n = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  await upsert(chunk);
  n += chunk.length;
  console.log(`  · upserted ${n}/${rows.length}`);
  if (SLEEP_MS && n < rows.length) await new Promise((r) => setTimeout(r, SLEEP_MS));
}
console.log(`[content_i18n:${LOCALE}] done: ${n} rows.`);
