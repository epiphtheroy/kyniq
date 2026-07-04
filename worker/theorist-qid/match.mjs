/**
 * Theorist → Wikidata QID matcher (Phase 2, PLAN-seo-surface-expansion).
 *
 * No LLM: a candidate is accepted ONLY when machine-verifiable —
 *   1. wbsearchentities (en) hit for the theorist name, AND
 *   2. entity is a human (P31 contains Q5), AND
 *   3. entity's en label or an en alias equals the theorist name after
 *      normalization (case / diacritics / punctuation-insensitive), AND
 *   4. at least one P106 occupation is in the theorist-family allowlist
 *      (occupation labels resolved live from Wikidata, not hard-coded QIDs).
 * Exactly ONE candidate may pass; zero or 2+ verified candidates → review CSV.
 * Composite-notation rows ("X & Y", "X and Y") are NEVER auto-matched — they
 * stay single entities per owner decision and go straight to the review CSV.
 *
 * Run:  ~/.local/node/bin/node worker/theorist-qid/match.mjs
 * Out:  lib/theorist_qid.json   { "<slug>": "Q…" }  (verified only)
 *       $REVIEW_CSV (or scratchpad default)          everything else
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REVIEW_CSV =
  process.env.REVIEW_CSV ||
  "/private/tmp/claude-501/-Users-jerryje-Documents-MetaTake/579d6499-8531-4eb0-becb-e00652a6a76b/scratchpad/theorist_qid_review.csv";
const OUT_JSON = join(ROOT, "lib", "theorist_qid.json");
const UA = "MetatakeTheoristQIDMatcher/1.0 (https://metatake.net; contact: channel.wonwoo@gmail.com)";
const API = "https://www.wikidata.org/w/api.php";
const GAP_MS = 120; // be polite: serial requests with a gap

// Same non-thin bar as the theorists.xml sitemap section.
const MIN_READINGS = 3;

// P106 occupation-label allowlist (substring match on the en label).
// The theorist-family per the plan: philosopher / sociologist / psychoanalyst /
// film theorist / literary critic / historian / political scientist /
// economist / theologian / anthropologist / writer-theorist family.
const OCC_PATTERNS = [
  "philosoph", // philosopher, political philosopher …
  "sociolog",
  "psychoanaly",
  "psycholog",
  "psychiatr",
  "film theor",
  "film critic",
  "film scholar",
  "media theor",
  "media scholar",
  "literary", // literary critic / theorist / scholar
  "historian", // incl. art historian
  "political scien",
  "political theor",
  "economist",
  "theolog",
  "anthropolog",
  "writer",
  "essayist",
  "novelist",
  "linguist",
  "semioti",
  "cultural critic",
  "cultural theor",
  "art critic",
  "musicolog",
  "ethnolog",
  "ethnograph",
  "geographer",
  "classicist",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function env(key) {
  const line = readFileSync(join(ROOT, ".env.local"), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`missing ${key} in .env.local`);
  return line.slice(key.length + 1).trim();
}

async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1000 * (i + 1) ** 2); // 1s, 4s, 9s backoff
    }
  }
}

async function wiki(params) {
  const qs = new URLSearchParams({ format: "json", origin: "*", ...params });
  const json = await getJSON(`${API}?${qs}`);
  await sleep(GAP_MS);
  return json;
}

// Case / diacritics / punctuation-insensitive comparison key.
const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,'’"()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isComposite = (name) => /[&/]/.test(name) || /\band\b/i.test(name);

// ---------------------------------------------------------------------------

const SUPA_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SUPA_KEY = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const idxRes = await fetch(`${SUPA_URL}/rest/v1/rpc/theorist_index`, {
  method: "POST",
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
  body: "{}",
});
if (!idxRes.ok) throw new Error(`theorist_index RPC failed: HTTP ${idxRes.status}`);
const allRows = await idxRes.json();
const gated = allRows
  .filter((r) => r.slug && (r.n ?? 0) >= MIN_READINGS)
  .sort((a, b) => a.slug.localeCompare(b.slug));
console.log(`theorist_index rows: ${allRows.length}; passing gate (n>=${MIN_READINGS} + slug): ${gated.length}`);

const occLabelCache = new Map(); // occupation QID -> en label ("" when none)

async function occupationLabels(qids) {
  const unknown = qids.filter((q) => !occLabelCache.has(q));
  for (let i = 0; i < unknown.length; i += 50) {
    const batch = unknown.slice(i, i + 50);
    const json = await wiki({ action: "wbgetentities", ids: batch.join("|"), props: "labels", languages: "en" });
    for (const q of batch) occLabelCache.set(q, json.entities?.[q]?.labels?.en?.value ?? "");
  }
  return qids.map((q) => occLabelCache.get(q) || "");
}

const claimIds = (entity, prop) =>
  (entity.claims?.[prop] ?? [])
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);

const verified = {}; // slug -> QID
const review = []; // { name, slug, candidates, reason }

let done = 0;
for (const t of gated) {
  done++;
  if (done % 25 === 0) console.log(`… ${done}/${gated.length} (verified so far: ${Object.keys(verified).length})`);
  try {
    if (isComposite(t.name)) {
      review.push({ name: t.name, slug: t.slug, candidates: "", reason: "composite notation — skipped by policy (stays a single entity)" });
      continue;
    }
    const search = await wiki({
      action: "wbsearchentities", search: t.name, language: "en", uselang: "en", type: "item", limit: "7",
    });
    const candidateIds = (search.search ?? []).map((s) => s.id);
    if (!candidateIds.length) {
      review.push({ name: t.name, slug: t.slug, candidates: "", reason: "no wbsearchentities results" });
      continue;
    }
    const got = await wiki({
      action: "wbgetentities", ids: candidateIds.join("|"), props: "labels|aliases|claims", languages: "en",
    });
    const want = norm(t.name);
    const passing = [];
    const notes = [];
    for (const qid of candidateIds) {
      const ent = got.entities?.[qid];
      if (!ent || ent.missing !== undefined) continue;
      if (!claimIds(ent, "P31").includes("Q5")) { notes.push(`${qid}:not-human`); continue; }
      const names = [ent.labels?.en?.value, ...(ent.aliases?.en ?? []).map((a) => a.value)].filter(Boolean);
      if (!names.some((nm) => norm(nm) === want)) { notes.push(`${qid}:label-mismatch`); continue; }
      const occIds = claimIds(ent, "P106");
      const labels = await occupationLabels(occIds);
      const ok = labels.some((l) => { const low = l.toLowerCase(); return OCC_PATTERNS.some((p) => low.includes(p)); });
      if (!ok) { notes.push(`${qid}:occupation[${labels.filter(Boolean).join("; ") || "none"}]`); continue; }
      passing.push(qid);
    }
    if (passing.length === 1) {
      verified[t.slug] = passing[0];
    } else if (passing.length > 1) {
      review.push({ name: t.name, slug: t.slug, candidates: passing.join(" "), reason: "ambiguous — multiple candidates pass label+occupation verification" });
    } else {
      review.push({ name: t.name, slug: t.slug, candidates: candidateIds.join(" "), reason: `no candidate verified (${notes.join(", ") || "none"})` });
    }
  } catch (e) {
    review.push({ name: t.name, slug: t.slug, candidates: "", reason: `error: ${e.message}` });
  }
}

// Deterministic output: sorted by slug.
const sorted = Object.fromEntries(Object.entries(verified).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT_JSON, JSON.stringify(sorted, null, 2) + "\n");

const csvEsc = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
mkdirSync(dirname(REVIEW_CSV), { recursive: true });
writeFileSync(
  REVIEW_CSV,
  ["name,slug,candidate_qids,reason", ...review.map((r) => [r.name, r.slug, r.candidates, r.reason].map(csvEsc).join(","))].join("\n") + "\n"
);

console.log(`VERIFIED: ${Object.keys(sorted).length} -> ${OUT_JSON}`);
console.log(`REVIEW:   ${review.length} -> ${REVIEW_CSV}`);
