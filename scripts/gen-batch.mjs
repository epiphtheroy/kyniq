#!/usr/bin/env node
/**
 * gen-batch — write the app-parity corpus through the Anthropic Batch API.
 * 정본: HANDOFF-앱패리티-공장.md · 런북: docs/RUNBOOK-app-parity.md
 *
 * The credit-mode sibling of scripts/gen-run.mjs. Same charter, same lint (both
 * import scripts/gen-spec.mjs, so the two backends cannot drift), same ledger and
 * output-file conventions — so a corpus written half on the subscription CLI and
 * half here is one corpus, and gen-completeness/gen-audit read it without knowing
 * which backend produced which file.
 *
 * Batch rather than realtime because batch is half price and nothing here is
 * latency-sensitive: measured 3,523 output tokens per item, so ~$12.5/1M against
 * ~$25/1M. The tradeoff is that a batch cannot retry an item mid-flight — the
 * per-attempt lint loop that gen-run.mjs runs inline becomes a requeue pass here,
 * which the audit already drives.
 *
 * Writes NOTHING to the database. Output is JSON batches on disk.
 *
 *   node scripts/gen-batch.mjs --corpus leads --limit 28     # small proof
 *   node scripts/gen-batch.mjs --corpus leads                # everything missing
 *   node scripts/gen-batch.mjs --corpus leads --collect      # resume a submitted batch
 *   node scripts/gen-batch.mjs --corpus leads --requeue      # rewrite what the audit flagged
 *
 * Credentials: ANTHROPIC_API_KEY from the environment, else .env.local. Export a
 * different key in front of the command to bill a different account.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { SPECS, openingClashes, parseItems } from "./gen-spec.mjs";

const ROOT = process.cwd();
const SRC = join(ROOT, "data/gen/src");
const OUT = join(ROOT, "data/gen/out");
const PROMPTS = join(ROOT, "data/gen/prompts");
const LEDGER = join(ROOT, "data/gen/ledger.jsonl");
const STOP = join(ROOT, "data/gen/.stop");
const RQDIR = join(ROOT, "data/gen/requeue");
const MODEL = "claude-opus-5";
const API = "https://api.anthropic.com/v1";

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);

const CORPUS = arg("--corpus", "leads");
const CHUNK = Number(arg("--chunk", 14));
const LIMIT = arg("--limit") ? Number(arg("--limit")) : null;
const REQUEUE = has("--requeue");
const COLLECT_ONLY = has("--collect");
/** Measured: a 14-item batch produces ~49k output tokens once adaptive thinking is
 *  counted. `max_tokens` caps thinking AND text together on Opus 5, so a limit sized
 *  for the prose alone truncates the answer mid-sentence. */
const MAX_TOKENS = Number(arg("--max-tokens", 64000));
const RUN_ID = new Date().toISOString().replace(/[-:T]/g, "").slice(2, 12);

const spec = SPECS[CORPUS];
if (!spec) { console.error(`unknown corpus: ${CORPUS}`); process.exit(2); }

function apiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  for (const f of [".env.local", ".env"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n"))
      if (line.startsWith("ANTHROPIC_API_KEY=")) return line.slice(18).trim();
  }
  console.error("ANTHROPIC_API_KEY not found (env or .env.local)");
  process.exit(2);
}
const KEY = apiKey();

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${(await res.text()).slice(0, 400)}`);
  return res;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ledger ────────────────────────────────────────────────────────────────────
function doneKeys(corpus) {
  const set = new Set();
  if (!existsSync(LEDGER)) return set;
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.corpus === corpus && (r.tag ?? "run") === "run" && String(r.status || "").startsWith("ok"))
        for (const k of r.keys || []) set.add(k);
    } catch {}
  }
  return set;
}
const logLedger = (rec) => appendFileSync(LEDGER, JSON.stringify(rec) + "\n");

// ── build the work list ───────────────────────────────────────────────────────
const STATE = join(ROOT, `data/gen/.batch-${CORPUS}.json`);
const charter = readFileSync(join(PROMPTS, spec.prompt), "utf8");
const source = JSON.parse(readFileSync(join(SRC, `${CORPUS}.json`), "utf8"));

function selectItems() {
  let items = source;
  if (REQUEUE) {
    const files = [join(RQDIR, `${CORPUS}.json`), join(RQDIR, `${CORPUS}.qa.json`)].filter(existsSync);
    if (!files.length) { console.log(`nothing queued for ${CORPUS}`); process.exit(0); }
    const keys = new Set(files.flatMap((f) =>
      JSON.parse(readFileSync(f, "utf8")).map((r) => r.entity_key || r.k)).filter(Boolean));
    items = items.filter((i) => keys.has(i.entity_key));
    console.log(`requeue: ${items.length} items flagged`);
  } else {
    const done = doneKeys(CORPUS);
    const before = items.length;
    items = items.filter((i) => !done.has(i.entity_key));
    if (before !== items.length) console.log(`resume: ${before - items.length} already done, ${items.length} left`);
  }
  return LIMIT ? items.slice(0, LIMIT) : items;
}

// ── submit ────────────────────────────────────────────────────────────────────
async function submit() {
  if (existsSync(STOP)) { console.log("stop file present — refusing to submit"); process.exit(0); }
  const items = selectItems();
  if (!items.length) { console.log("nothing to do"); process.exit(0); }

  const chunks = [];
  for (let i = 0; i < items.length; i += CHUNK) chunks.push(items.slice(i, i + CHUNK));

  const requests = chunks.map((batch, idx) => ({
    custom_id: `c${String(idx).padStart(5, "0")}`,
    params: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // The charter is byte-identical on every request, so it is the cache prefix.
      // Opus 5 caches from 512 tokens up; this is ~2.5k.
      system: [{ type: "text", text: charter, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: spec.ask({ items: batch.map((i) => ({ k: i.entity_key, facts: i.facts })) }) }],
    },
  }));

  // Measured on the 28-item proof: 1,497 output tokens per item at the API's default
  // effort — well under the 3,523 the CLI produced, which runs at a higher effort.
  const estOut = items.length * 1497;
  console.log(`${CORPUS}: ${items.length} items · ${requests.length} requests (chunk ${CHUNK})`);
  console.log(`  추정 출력 ${(estOut / 1e6).toFixed(1)}M tok → 배치 단가 $12.5/M ≈ $${(estOut / 1e6 * 12.5).toFixed(0)}`);
  if (has("--dry")) { console.log("--dry: nothing submitted"); process.exit(0); }

  const res = await api("/messages/batches", { method: "POST", body: JSON.stringify({ requests }) });
  const batch = await res.json();
  const state = {
    id: batch.id, corpus: CORPUS, run_id: RUN_ID, submitted_at: new Date().toISOString(),
    chunks: chunks.map((c) => c.map((i) => i.entity_key)),
  };
  mkdirSync(join(ROOT, "data/gen"), { recursive: true });
  writeFileSync(STATE, JSON.stringify(state, null, 1));
  console.log(`submitted ${batch.id} · state → ${STATE.replace(ROOT + "/", "")}`);
  return state;
}

// ── poll ──────────────────────────────────────────────────────────────────────
async function poll(id) {
  for (let n = 0; ; n++) {
    if (existsSync(STOP)) {
      console.log("stop file present — cancelling batch");
      await api(`/messages/batches/${id}/cancel`, { method: "POST" }).catch(() => {});
      process.exit(0);
    }
    const b = await (await api(`/messages/batches/${id}`)).json();
    const c = b.request_counts || {};
    console.log(`  [${new Date().toLocaleTimeString()}] ${b.processing_status} · ` +
      `처리중 ${c.processing ?? "?"} · 성공 ${c.succeeded ?? 0} · 실패 ${c.errored ?? 0} · 만료 ${c.expired ?? 0}`);
    if (b.processing_status === "ended") return b;
    await sleep(60_000);
  }
}

// ── collect ───────────────────────────────────────────────────────────────────
async function collect(state) {
  const byKey = new Map(source.map((i) => [i.entity_key, i]));
  const outDir = join(OUT, CORPUS);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(RQDIR, { recursive: true });

  const res = await api(`/messages/batches/${state.id}/results`);
  const text = await res.text();
  let ok = 0, empty = 0, failed = 0, warned = 0, outTok = 0, inTok = 0, cacheR = 0, cacheW = 0;

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    const idx = Number(String(r.custom_id).replace(/^c/, ""));
    const keys = state.chunks[idx] || [];
    const batch = keys.map((k) => byKey.get(k)).filter(Boolean);

    if (r.result?.type !== "succeeded") {
      failed += batch.length;
      logLedger({ ts: new Date().toISOString(), corpus: CORPUS, tag: "run", batch: idx,
        status: "fail", keys: [], error: `${r.result?.type}: ${JSON.stringify(r.result?.error ?? {}).slice(0, 200)}` });
      continue;
    }
    const msg = r.result.message;
    const u = msg.usage || {};
    outTok += u.output_tokens || 0; inTok += u.input_tokens || 0;
    cacheR += u.cache_read_input_tokens || 0; cacheW += u.cache_creation_input_tokens || 0;

    // A refusal or a truncated answer is a failed item, not a silent empty one.
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") {
      failed += batch.length;
      logLedger({ ts: new Date().toISOString(), corpus: CORPUS, tag: "run", batch: idx,
        status: "fail", keys: [], error: `stop_reason=${msg.stop_reason}` });
      continue;
    }

    let got;
    try {
      got = parseItems(msg.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
    } catch (e) {
      failed += batch.length;
      logLedger({ ts: new Date().toISOString(), corpus: CORPUS, tag: "run", batch: idx,
        status: "fail", keys: [], error: `parse: ${String(e.message).slice(0, 200)}` });
      continue;
    }

    const map = new Map(got.map((g) => [g.k, g[spec.outField]]));
    const rows = [], problems = [], empties = [];
    for (const it of batch) {
      const val = map.get(it.entity_key);
      if (val === undefined) { problems.push(`${it.entity_key}: 누락`); continue; }
      const errs = spec.lint(it, val);
      if (errs.length) { problems.push(`${it.entity_key}: ${errs.join(", ")}`); continue; }
      if (typeof val === "string" && !val.trim()) { empties.push(it.entity_key); continue; }
      rows.push(spec.row(it, val, MODEL));
    }
    const clash = openingClashes(rows.map((r) => r.text));
    if (clash.length) problems.push(`같은 첫머리 반복: ${clash.join(" / ")}`);

    if (rows.length) {
      writeFileSync(join(outDir, `b-${state.run_id}-${String(idx).padStart(5, "0")}.json`),
        JSON.stringify(rows, null, 1));
    }
    logLedger({ ts: new Date().toISOString(), corpus: CORPUS, tag: "run", batch: idx,
      status: problems.length ? "ok_with_warnings" : "ok",
      keys: [...rows.map((x) => x.entity_key), ...empties], empties,
      warnings: problems.slice(0, 20),
      file: `data/gen/out/${CORPUS}/b-${state.run_id}-${String(idx).padStart(5, "0")}.json`,
      model: MODEL, backend: "batch" });
    ok += rows.length; empty += empties.length; if (problems.length) warned++;
  }

  const cost = (outTok / 1e6) * 12.5 + (inTok / 1e6) * 2.5 + (cacheW / 1e6) * 3.125 + (cacheR / 1e6) * 0.25;
  console.log(`\n== ${CORPUS} batch done: ${ok} written, ${empty} honest-empty, ${failed} failed, ${warned} batches with warnings`);
  console.log(`   출력 ${outTok.toLocaleString()} · 입력 ${inTok.toLocaleString()} · 캐시 읽기 ${cacheR.toLocaleString()} · 캐시 쓰기 ${cacheW.toLocaleString()}`);
  console.log(`   실비 추정 $${cost.toFixed(2)} (배치 50% 반영)`);
  console.log(`   files: ${outDir}`);
}

// ── main ──────────────────────────────────────────────────────────────────────
let state;
if (COLLECT_ONLY) {
  if (!existsSync(STATE)) { console.error(`no batch state at ${STATE}`); process.exit(2); }
  state = JSON.parse(readFileSync(STATE, "utf8"));
  console.log(`resuming batch ${state.id} (submitted ${state.submitted_at})`);
} else {
  state = await submit();
}
await poll(state.id);
await collect(state);
