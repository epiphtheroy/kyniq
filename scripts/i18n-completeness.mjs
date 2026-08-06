#!/usr/bin/env node
/**
 * i18n-completeness — what is actually on disk, per corpus, against the source.
 *
 * The ledger says which batches finished; this says which KEYS exist in the
 * output files. They differ when a batch fails (its keys were never written) or
 * when a requeue rewrote some, so this is the number to trust before loading.
 *
 *   node scripts/i18n-completeness.mjs
 *   node scripts/i18n-completeness.mjs --write-requeue   # emit the gap as work
 *
 * --write-requeue is how lost keys come back: a plain resume will not retry them,
 * because the ledger still lists them as done. It writes the missing keys to
 * data/i18n/requeue/<corpus>.json, which `i18n-translate-run.mjs --requeue` reads.
 *
 * ⚠️ Only run it when nothing is translating that corpus. The list is a snapshot,
 * and a run in flight makes it stale the moment it is written. It also shares the
 * filename the audit uses for lint rejects, so whichever ran last wins.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "data/i18n/src2");
const OUT = join(ROOT, "data/i18n/out");
const REQUEUE = join(ROOT, "data/i18n/requeue");
const WRITE = process.argv.includes("--write-requeue");

const CORPORA = [
  ["tow_segments", "tow_segments"],
  ["repolish_laconic", "repolish_laconic"],
  ["repolish_trope_title", "repolish_trope_title"],
  ["dfacts_items", "dfacts_items"],
  ["dfacts_intro", "dfacts_intro"],
  ["dfacts_meaning", "dfacts_meaning"],
  ["portrait", "portrait"],
  ["repolish_invitation", "repolish_invitation"],
];

let anyMissing = false;
console.log("corpus".padEnd(24) + "source".padStart(8) + "done".padStart(8) + "missing".padStart(9) + "  status");
for (const [name, srcName] of CORPORA) {
  const srcPath = join(SRC, `${srcName}.json`);
  const outDir = join(OUT, name);
  if (!existsSync(srcPath)) { console.log(`${name.padEnd(24)} (no source)`); continue; }
  const src = JSON.parse(readFileSync(srcPath, "utf8"));
  const want = new Set(src.map((i) => i.entity_key));
  const have = new Set();
  if (existsSync(outDir)) {
    for (const f of readdirSync(outDir).filter((f) => f.endsWith(".json")))
      for (const r of JSON.parse(readFileSync(join(outDir, f), "utf8")))
        if (r.text) have.add(r.entity_key);
  }
  const missing = [...want].filter((k) => !have.has(k));
  if (missing.length) {
    anyMissing = true;
    if (WRITE) {
      mkdirSync(REQUEUE, { recursive: true });
      writeFileSync(join(REQUEUE, `${name}.json`),
        JSON.stringify(missing.map((k) => ({ entity_key: k })), null, 1));
    }
  }
  console.log(
    name.padEnd(24) + String(want.size).padStart(8) + String(have.size).padStart(8) +
    String(missing.length).padStart(9) +
    (missing.length ? `  ⚠️ 예: ${missing.slice(0, 2).join(", ")}` : "  ✓"),
  );
}

// The reader-facing to.W rows are the assembled ones, not the segments.
const asmDir = join(OUT, "tow_assembled");
if (existsSync(asmDir)) {
  const rows = readdirSync(asmDir).filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(readFileSync(join(asmDir, f), "utf8")));
  const src = JSON.parse(readFileSync(join(SRC, "tow.json"), "utf8"));
  console.log(`${"tow_assembled".padEnd(24)}${String(src.length).padStart(8)}${String(rows.length).padStart(8)}` +
    `${String(src.length - rows.length).padStart(9)}  ${rows.length === src.length ? "✓" : "⚠️ 재조립 필요"}`);
}

console.log(anyMissing
  ? (WRITE
      ? "\n누락 키를 data/i18n/requeue/ 에 기록했다. 복구: node scripts/i18n-translate-run.mjs --corpus <이름> --requeue"
      : "\n미완 키가 있다. --write-requeue 로 다시 돌리면 복구용 작업목록을 만든다.")
  : "\n모든 코퍼스 완결.");
