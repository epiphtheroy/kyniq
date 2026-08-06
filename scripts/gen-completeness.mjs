#!/usr/bin/env node
/**
 * gen-completeness — compare what is ON DISK against the source corpus.
 * 정본: HANDOFF-앱패리티-공장.md
 *
 * The ledger is a record of intent; the files are the record of fact. On 2026-08-06
 * a resumed run overwrote its predecessor's batches while the ledger went on
 * insisting those keys were done, and 580 finished items quietly ceased to exist.
 * So completeness is measured against the files, always, and the ledger is only
 * consulted to show the size of the discrepancy.
 *
 *   node scripts/gen-completeness.mjs --corpus leads
 *   node scripts/gen-completeness.mjs --corpus leads --write-requeue
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CORPUS = arg("--corpus", "leads");
const OUTDIR = join(ROOT, "data/gen/out", CORPUS);
const SRCFILE = join(ROOT, "data/gen/src", `${CORPUS}.json`);
const LEDGER = join(ROOT, "data/gen/ledger.jsonl");
const RQDIR = join(ROOT, "data/gen/requeue");

const src = JSON.parse(readFileSync(SRCFILE, "utf8"));
const srcKeys = new Set(src.map((r) => r.entity_key));

const disk = new Set();
let files = [];
if (existsSync(OUTDIR)) {
  files = readdirSync(OUTDIR).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    try {
      for (const r of JSON.parse(readFileSync(join(OUTDIR, f), "utf8"))) {
        const k = r.entity_key ?? r.director_slug;
        if (k) disk.add(k);
      }
    } catch (e) { console.error(`  ! unreadable ${f}: ${e.message}`); }
  }
}

// Keys the writer deliberately declined (an empty answer is a legal answer) are
// complete, not missing — they are logged in the ledger's `empties`.
const empties = new Set();
const ledgerDone = new Set();
if (existsSync(LEDGER)) {
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.corpus !== CORPUS || r.tag === "pilot") continue;
      if (String(r.status || "").startsWith("ok")) {
        for (const k of r.keys || []) ledgerDone.add(k);
        for (const k of r.empties || []) empties.add(k);
      }
    } catch {}
  }
}

const settled = new Set([...disk, ...empties]);
const missing = [...srcKeys].filter((k) => !settled.has(k));
const phantom = [...ledgerDone].filter((k) => !settled.has(k));

console.log(`\n== ${CORPUS} completeness`);
console.log(`  source        ${srcKeys.size}`);
console.log(`  files         ${files.length}`);
console.log(`  on disk       ${disk.size}`);
console.log(`  honest-empty  ${empties.size}`);
console.log(`  MISSING       ${missing.length}  (${((missing.length / srcKeys.size) * 100).toFixed(1)}%)`);
if (phantom.length)
  console.log(`  ⚠️  ledger says done but nothing on disk: ${phantom.length} — a run overwrote its predecessor`);

if (args.includes("--write-requeue") && missing.length) {
  mkdirSync(RQDIR, { recursive: true });
  const dest = join(RQDIR, `${CORPUS}.json`);
  writeFileSync(dest, JSON.stringify(missing.map((entity_key) => ({ entity_key })), null, 1));
  console.log(`  requeue → ${dest.replace(ROOT + "/", "")}`);
}
