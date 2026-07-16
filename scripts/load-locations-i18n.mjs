#!/usr/bin/env node
/**
 * load-locations-i18n — upsert film_locations.name_<loc> from a translated CSV.
 * 정본: HANDOFF-KO프로젝션-한국어사이트.md §3.3
 *
 * film_locations is large — ~28,412 rows / ~26,001 distinct names (verified on
 * prod 2026-07-16, ~10× the work order's original estimate). Translating them is
 * a batch job done incrementally into a CSV (id,name_ko), which this loader
 * applies in chunks. Idempotent (upsert by id), so re-running and appending are
 * both safe. Uncertain proper nouns stay English by rule (§3.3) — just omit them
 * from the CSV and the row falls back to its English name.
 *
 * Usage:
 *   node scripts/load-locations-i18n.mjs --locale ko --csv data/i18n/film-locations-ko.csv
 *   node scripts/load-locations-i18n.mjs --locale ko --csv <file> --dry
 *
 * CSV format: header `id,name_<loc>` then one row per translated location.
 * Needs SUPABASE_SERVICE_ROLE_KEY (film_locations has RLS with no anon policy).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes("--dry");
const LOCALE = arg("--locale");
const CSV = arg("--csv");
const CHUNK = 500;

const LIVE = ["ko", "ja", "fr", "es"];
if (!LOCALE || !LIVE.includes(LOCALE)) {
  console.error(`--locale is required, one of: ${LIVE.join(", ")}`);
  process.exit(2);
}
if (!CSV || !existsSync(CSV)) {
  console.error(`--csv <file> is required and must exist (got: ${CSV})`);
  process.exit(2);
}

// env (repo-root .env.local, no overwrite — mirrors the workers)
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

const COL = `name_${LOCALE}`;

// Minimal CSV parse (id,name) — names may contain commas/quotes.
function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const header = lines[0].split(",").map((h) => h.trim());
  const idIdx = header.indexOf("id");
  const nameIdx = header.findIndex((h) => h === COL || h === "name" || h.startsWith("name_"));
  if (idIdx < 0 || nameIdx < 0) throw new Error(`CSV header must have 'id' and '${COL}' (got: ${header.join(",")})`);
  for (let i = 1; i < lines.length; i++) {
    // Split on the FIRST comma only when there are exactly two columns; otherwise
    // handle a quoted name.
    const line = lines[i];
    let id, name;
    if (line.startsWith('"') || line.includes('","')) {
      const m = /^\s*"?([^",]+)"?\s*,\s*"?(.*?)"?\s*$/.exec(line);
      if (!m) continue;
      id = m[1]; name = m[2].replace(/""/g, '"');
    } else {
      const c = line.indexOf(",");
      id = line.slice(0, c).trim();
      name = line.slice(c + 1).trim();
    }
    if (id && name) rows.push({ id, [COL]: name });
  }
  return rows;
}

async function upsert(chunk) {
  const res = await fetch(`${URL}/rest/v1/film_locations?on_conflict=id`, {
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

async function main() {
  const rows = parseCsv(readFileSync(CSV, "utf8"));
  console.log(`[i18n:${LOCALE}] ${rows.length} rows from ${CSV}${DRY ? "  [DRY — parse only, no writes]" : ""}`);
  if (!rows.length) return;
  if (DRY) { console.log("  sample:", JSON.stringify(rows.slice(0, 3))); return; }
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await upsert(chunk);
    n += chunk.length;
    console.log(`  · upserted ${n}/${rows.length}`);
  }
  console.log(`[i18n:${LOCALE}] done: ${n} ${COL} values written.`);
}

main().catch((e) => { console.error("load failed:", e.message); process.exit(1); });
