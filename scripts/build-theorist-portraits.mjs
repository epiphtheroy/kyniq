/**
 * build-theorist-portraits.mjs — one-time backfill: for every theorist slug in
 * lib/theorist_qid.json, fetch the Wikidata P18 (image) claim once and write a
 * static slug → Commons thumbnail URL map to lib/theorist_portrait.json.
 *
 * The theorist/concept index pages then read this static map (no per-render
 * Wikidata fetches). Re-run when theorist_qid.json changes.
 *
 *   node scripts/build-theorist-portraits.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const qids = JSON.parse(readFileSync(join(ROOT, "lib/theorist_qid.json"), "utf8"));
const entries = Object.entries(qids);

const UA = "MetatakePortraitBuild/1.0 (https://metatake.net; portraits index)";
const out = {};
let done = 0, hit = 0;

async function fetchP18(qid) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
        headers: { accept: "application/json", "user-agent": UA },
      });
      if (r.status === 429 || r.status >= 500) throw new Error(`http ${r.status}`);
      if (!r.ok) return null;
      const j = await r.json();
      const e = j.entities?.[qid];
      const file = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      return typeof file === "string" ? file : null;
    } catch {
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
    }
  }
  return null;
}

// small concurrency pool
const CONCURRENCY = 6;
let idx = 0;
async function worker() {
  while (idx < entries.length) {
    const i = idx++;
    const [slug, qid] = entries[i];
    const file = await fetchP18(qid);
    if (file) {
      out[slug] = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=200`;
      hit++;
    }
    done++;
    if (done % 25 === 0) console.error(`  ${done}/${entries.length} (${hit} portraits)`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// stable key order for clean diffs
const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
writeFileSync(join(ROOT, "lib/theorist_portrait.json"), JSON.stringify(sorted, null, 0) + "\n");
console.error(`\ndone: ${hit}/${entries.length} portraits → lib/theorist_portrait.json`);
