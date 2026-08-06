#!/usr/bin/env node
/**
 * load-film-leads — upsert generated Invitations into public.film_leads.
 * 정본: HANDOFF-앱패리티-공장.md §3.4
 *
 * THIS IS THE ONLY SCRIPT IN THE LANE THAT WRITES TO THE DATABASE, and it is meant
 * to be run by the owner, deliberately, when the database is healthy — never by an
 * unattended job. Generation produces files; loading is a separate decision.
 *
 *   node scripts/load-film-leads.mjs --dry                 # validate files, no network
 *   node scripts/load-film-leads.mjs --gentle              # 250-row chunks, 1.5s apart
 *   node scripts/load-film-leads.mjs --gentle --limit 500
 *
 * Credentials come from the environment or .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Both may be overridden by exporting them first, so a different account can run
 * this without editing anything.
 *
 * Prerequisite: migration 0136_film_leads.sql applied.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const DRY = has("--dry");
const GENTLE = has("--gentle");
const LIMIT = arg("--limit") ? Number(arg("--limit")) : null;
const CHUNK = Number(arg("--chunk", 250));
const OUTDIR = join(ROOT, "data/gen/out", arg("--corpus", "leads"));

function env(k) {
  if (process.env[k]) return process.env[k];
  for (const f of [".env.local", ".env"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n"))
      if (line.startsWith(k + "=")) return line.slice(k.length + 1).trim();
  }
  return null;
}

// ── collect, collapsing duplicates in JS first ────────────────────────────────
// PostgREST rejects an entire upsert when the payload contains two rows with the
// same constrained value (SQLSTATE 21000), so the collapse cannot be left to the
// database. Files sort last-wins, which is what makes a requeue correction land.
const files = existsSync(OUTDIR) ? readdirSync(OUTDIR).filter((f) => f.endsWith(".json")).sort() : [];
if (!files.length) { console.error(`no output files in ${OUTDIR}`); process.exit(2); }

const byId = new Map();
let skippedNoId = 0, skippedEmpty = 0;
for (const f of files) {
  let rows;
  try { rows = JSON.parse(readFileSync(join(OUTDIR, f), "utf8")); }
  catch (e) { console.error(`  ! unreadable ${f}: ${e.message}`); continue; }
  for (const r of rows) {
    const lead = String(r.text ?? "").trim();
    if (!lead) { skippedEmpty++; continue; }
    if (!r.film_id) { skippedNoId++; continue; }
    if (lead.length < 200 || lead.length > 2000) { skippedEmpty++; continue; }  // matches the CHECK
    byId.set(r.film_id, { film_id: r.film_id, lead, model: r.model, source_sha256: r.source_sha256 });
  }
}
let payload = [...byId.values()];
if (LIMIT) payload = payload.slice(0, LIMIT);

console.log(`files ${files.length} · loadable ${payload.length} · skipped ${skippedEmpty} empty/out-of-band, ${skippedNoId} without film_id`);
if (DRY) { console.log("--dry: nothing sent"); process.exit(0); }

const URL = env("NEXT_PUBLIC_SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
if (!URL || !KEY) { console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found"); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let done = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const slice = payload.slice(i, i + CHUNK);
  const res = await fetch(`${URL}/rest/v1/film_leads?on_conflict=film_id`, {
    method: "POST",
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(slice.map((r) => ({ ...r, updated_at: new Date().toISOString() }))),
  });
  if (!res.ok) {
    console.error(`chunk ${i / CHUNK} failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  done += slice.length;
  console.log(`  ${done}/${payload.length}`);
  if (GENTLE && i + CHUNK < payload.length) await sleep(1500);
}
console.log(`\nloaded ${done} rows into film_leads.`);
console.log(`verification costs count queries — run it deliberately, not by reflex:`);
console.log(`  select count(*) from public.film_leads;`);
