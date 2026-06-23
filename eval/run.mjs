#!/usr/bin/env node
// W1 — Metatake ASK evaluation harness (retrieval-first, generation optional).
//
// READ-ONLY against the DB: only calls the ask_retrieve RPC and never writes.
// Mirrors the live pipeline in app/api/ask/route.ts (same embed model, same RPC,
// same p_k=40 candidate width, same diversify() rerank-lite + per-film cap).
//
// Usage:
//   node eval/run.mjs --limit 5 --retrieval-only
//   node eval/run.mjs --type out-of-corpus --retrieval-only
//   node eval/run.mjs --limit 10                 (also runs generation scoring)
//   node eval/run.mjs --gold ./eval/gold-set.json --k 40 --keep 14 --out ./eval/report.json
//
// Flags:
//   --limit N            cap to first N gold items (after --type filter). SAFETY: keep small for live runs.
//   --retrieval-only     skip the generation model call (no gpt-4o-mini cost). Recommended for smoke tests.
//   --type <t>           filter to one type: broad-concept | specific-film | multilingual | out-of-corpus
//   --gold <path>        gold-set path (default eval/gold-set.json)
//   --k <int>            candidate width for ask_retrieve p_k (default 40, matches CANDIDATES in route.ts)
//   --keep <int>         diversify() KEEP target (default 14, matches route.ts)
//   --out <path>         report path (default eval/report.json)
//   --concurrency <int>  parallel questions (default 3)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ---------- args ----------
function parseArgs(argv) {
  const a = { retrievalOnly: false, type: null, limit: null, gold: "eval/gold-set.json", k: 40, keep: 14, out: "eval/report.json", concurrency: 3 };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--retrieval-only") a.retrievalOnly = true;
    else if (t === "--type") a.type = argv[++i];
    else if (t === "--limit") a.limit = parseInt(argv[++i], 10);
    else if (t === "--gold") a.gold = argv[++i];
    else if (t === "--k") a.k = parseInt(argv[++i], 10);
    else if (t === "--keep") a.keep = parseInt(argv[++i], 10);
    else if (t === "--out") a.out = argv[++i];
    else if (t === "--concurrency") a.concurrency = parseInt(argv[++i], 10);
    else if (t === "--help" || t === "-h") { printHelp(); process.exit(0); }
  }
  return a;
}
function printHelp() {
  console.log(`Metatake ASK eval harness (W1)
  node eval/run.mjs --limit 5 --retrieval-only
  node eval/run.mjs --type out-of-corpus --retrieval-only
  node eval/run.mjs --limit 10            (adds generation faithfulness scoring)
Flags: --limit N | --retrieval-only | --type <t> | --gold <path> | --k 40 | --keep 14 | --out <path> | --concurrency 3`);
}

// ---------- .env.local loader (no dependency on dotenv) ----------
function loadEnvLocal() {
  const path = resolve(REPO_ROOT, ".env.local");
  let raw;
  try { raw = readFileSync(path, "utf8"); }
  catch { throw new Error(`Could not read ${path}. Run from the repo and ensure .env.local exists.`); }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, key, val] = m;
    val = val.replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// ---------- constants mirroring app/api/ask/route.ts ----------
const OPENAI = "https://api.openai.com/v1";
const EMBED_MODEL = "text-embedding-3-small";
const ANSWER_MODEL = process.env.ASK_MODEL || "gpt-4o-mini";
const MAX_PER_FILM = 2;

// ---------- OpenAI embedding (same call shape as route.ts) ----------
async function embed(q) {
  const r = await fetch(`${OPENAI}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: q }),
  });
  if (!r.ok) throw new Error(`embedding ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return d.data[0].embedding;
}

// ---------- ask_retrieve via Supabase REST RPC (anon key, read-only) ----------
// Using REST directly avoids any ESM/CJS friction with @supabase/supabase-js.
async function askRetrieve(qvec, q, k) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/ask_retrieve`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_qvec: `[${qvec.join(",")}]`, p_q: q, p_k: k }),
  });
  if (!r.ok) throw new Error(`ask_retrieve ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return await r.json();
}

// ---------- diversify(): faithful port of route.ts ----------
function diversify(cand, keep) {
  const picked = [];
  const figSeen = new Set();
  const filmCount = new Map();
  for (const r of cand) {
    const figKey = r.figure_slug || r.take_id;
    if (figSeen.has(figKey)) continue;
    if ((filmCount.get(r.film_slug) ?? 0) >= MAX_PER_FILM) continue;
    figSeen.add(figKey);
    filmCount.set(r.film_slug, (filmCount.get(r.film_slug) ?? 0) + 1);
    picked.push(r);
    if (picked.length >= keep) break;
  }
  if (picked.length < 8) {
    for (const r of cand) {
      if (picked.includes(r)) continue;
      picked.push(r);
      if (picked.length >= 12) break;
    }
  }
  return picked.map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---------- generation (optional), mirrors route.ts SYS prompt contract ----------
const SYS = `You are Metatake's reading assistant. You answer questions about cinema using ONLY the numbered close-readings provided.

How to answer:
- Open with the through-line your evidence reveals — the shared idea, not a restatement of the question.
- Then develop it, grouping observations by critical register or by motif. Compare and set readings in tension; don't just list them.
- Ground EVERY claim in the readings with a citation like [3] right after it. Quote a vivid phrase when it earns its place.
- Never introduce a film, fact, director, or quotation not in the list. If the readings don't cover the question, say so plainly instead of inventing.
- Keep it concise and literary — Metatake's voice (think New Yorker close reading): no hype, no headings, no bullet lists.
- Finish with a line beginning "Unexpected kin:" naming one or two surprising pairings drawn only from the list.
- On the very last line output exactly: USED: <comma-separated citation numbers you used>.`;

async function generate(query, cites) {
  const ctx = cites
    .map((r) => {
      const head = `[${r.rank}] (${r.film_title}${r.register ? ` · ${r.register}` : ""}${r.theorist ? ` · after ${r.theorist}` : ""})`;
      const tail = r.meta_title ? `  [reading: ${r.meta_title}]` : "";
      return `${head} ${(r.rationale ?? "").replace(/\s+/g, " ").trim()}${tail}`;
    })
    .join("\n");
  const r = await fetch(`${OPENAI}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: ANSWER_MODEL,
      temperature: 0.2,
      max_tokens: 750,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: `Question: ${query}\n\nReadings:\n${ctx}` },
      ],
    }),
  });
  if (!r.ok) throw new Error(`generation ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return {
    text: d.choices?.[0]?.message?.content ?? "",
    inTokens: d.usage?.prompt_tokens ?? null,
    outTokens: d.usage?.completion_tokens ?? null,
  };
}

// ---------- metric helpers ----------
const norm = (s) => (s ?? "").toString().toLowerCase().normalize("NFKC");

// retrieval hit proxy: did any expected film/theme appear (case-insensitive substring)
// in the top-K film_title / rationale / meta_title? Returns {hit, hitsFilms, hitsThemes}.
function retrievalHit(cites, expected) {
  const hay = cites
    .map((c) => `${norm(c.film_title)} ${norm(c.rationale)} ${norm(c.meta_title)}`)
    .join("\n");
  const films = expected.films ?? [];
  const themes = expected.themes ?? [];
  const hitsFilms = films.filter((f) => hay.includes(norm(f)));
  const hitsThemes = themes.filter((t) => hay.includes(norm(t)));
  const anyExpected = films.length + themes.length;
  const hit = anyExpected === 0 ? null : (hitsFilms.length + hitsThemes.length) > 0;
  return { hit, hitsFilms, hitsThemes, nFilmsExpected: films.length, nThemesExpected: themes.length };
}

function filmDiversity(cites) {
  const films = new Set(cites.map((c) => c.film_slug || c.film_title));
  return { uniqueFilms: films.size, ofK: cites.length };
}

// generation citation basics: count [n] markers, presence of a USED: line, in-range marker check.
function citationBasics(answerText, keepN) {
  const text = answerText ?? "";
  const usedMatch = text.match(/USED:\s*([\d,\s]+)/i);
  const hasUsedLine = !!usedMatch;
  const markers = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const distinct = [...new Set(markers)];
  const inRange = distinct.filter((n) => n >= 1 && n <= keepN);
  const outOfRange = distinct.filter((n) => n < 1 || n > keepN);
  return {
    nCitations: markers.length,
    distinctCitations: distinct.length,
    hasUsedLine,
    outOfRangeCitations: outOfRange.length, // proxy for citation accuracy (mis-attribution)
    refusedInText: /not (in|covered)|nothing in the corpus|don'?t cover|outside (the|our) corpus|no readings/i.test(text),
  };
}

// ---------- run one question ----------
async function runOne(item, args) {
  const t0 = Date.now();
  const out = { id: item.id, type: item.type, lang: item.lang, question: item.question, should_refuse: item.should_refuse };
  try {
    const vec = await embed(item.question);
    const raw = (await askRetrieve(vec, item.question, args.k)) ?? [];
    const cites = diversify(raw, args.keep);

    out.nCandidates = raw.length;
    out.nKept = cites.length;
    const div = filmDiversity(cites);
    out.uniqueFilms = div.uniqueFilms;
    out.topFilms = cites.slice(0, 5).map((c) => c.film_title);

    if (item.should_refuse) {
      // For out-of-corpus, "correct" retrieval is empty or weak. route.ts returns the refusal
      // string when cites.length === 0. We score refusal-correctness on that signal.
      out.refusalCorrect = cites.length === 0;
      out.hit = null;
      out.hitsFilms = [];
      out.hitsThemes = [];
    } else {
      const h = retrievalHit(cites, item.expected ?? {});
      out.hit = h.hit;
      out.hitsFilms = h.hitsFilms;
      out.hitsThemes = h.hitsThemes;
      out.refusalCorrect = null;
    }

    if (!args.retrievalOnly && cites.length > 0) {
      const g = await generate(item.question, cites);
      const cb = citationBasics(g.text, cites.length);
      out.gen = {
        nCitations: cb.nCitations,
        distinctCitations: cb.distinctCitations,
        hasUsedLine: cb.hasUsedLine,
        outOfRangeCitations: cb.outOfRangeCitations,
        refusedInText: cb.refusedInText,
        inTokens: g.inTokens,
        outTokens: g.outTokens,
        answerPreview: (g.text || "").replace(/\s+/g, " ").slice(0, 180),
      };
      // For should_refuse items, a model refusal in text is also "correct" behavior.
      if (item.should_refuse && cb.refusedInText) out.refusalCorrect = true;
    } else if (!args.retrievalOnly && item.should_refuse && cites.length === 0) {
      // route.ts would short-circuit to the canned refusal — that is correct, no gen call.
      out.gen = { refusedShortCircuit: true };
    }
  } catch (e) {
    out.error = String(e.message || e);
  }
  out.latencyMs = Date.now() - t0;
  return out;
}

// ---------- bounded concurrency ----------
async function mapPool(items, n, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

// ---------- aggregate + scorecard ----------
function aggregate(rows, args) {
  const byType = {};
  for (const r of rows) {
    (byType[r.type] ??= []).push(r);
  }
  const summaryByType = {};
  for (const [type, rs] of Object.entries(byType)) {
    const withHit = rs.filter((r) => r.hit !== null && r.hit !== undefined && !r.error);
    const hits = withHit.filter((r) => r.hit === true).length;
    const refusable = rs.filter((r) => r.should_refuse && !r.error);
    const refusalCorrect = refusable.filter((r) => r.refusalCorrect === true).length;
    const lats = rs.filter((r) => !r.error).map((r) => r.latencyMs);
    const divs = rs.filter((r) => !r.error && r.uniqueFilms != null).map((r) => r.uniqueFilms);
    const genRows = rs.filter((r) => r.gen && r.gen.nCitations != null);
    summaryByType[type] = {
      n: rs.length,
      errors: rs.filter((r) => r.error).length,
      retrievalHitRate: withHit.length ? +(hits / withHit.length).toFixed(3) : null,
      hitDenominator: withHit.length,
      refusalCorrectRate: refusable.length ? +(refusalCorrect / refusable.length).toFixed(3) : null,
      refusalDenominator: refusable.length,
      avgUniqueFilms: divs.length ? +(divs.reduce((a, b) => a + b, 0) / divs.length).toFixed(2) : null,
      p50LatencyMs: median(lats),
      p95LatencyMs: percentile(lats, 95),
      avgCitations: genRows.length ? +(genRows.reduce((a, r) => a + r.gen.nCitations, 0) / genRows.length).toFixed(2) : null,
      usedLineRate: genRows.length ? +(genRows.filter((r) => r.gen.hasUsedLine).length / genRows.length).toFixed(3) : null,
      outOfRangeCiteTotal: genRows.reduce((a, r) => a + (r.gen.outOfRangeCitations || 0), 0),
    };
  }
  const ok = rows.filter((r) => !r.error);
  const overall = {
    totalQuestions: rows.length,
    errors: rows.filter((r) => r.error).length,
    p50LatencyMs: median(ok.map((r) => r.latencyMs)),
    p95LatencyMs: percentile(ok.map((r) => r.latencyMs), 95),
    retrievalOnly: args.retrievalOnly,
    embedModel: EMBED_MODEL,
    answerModel: args.retrievalOnly ? null : ANSWER_MODEL,
    k: args.k,
    keep: args.keep,
  };
  return { overall, byType: summaryByType };
}
function median(a) { return percentile(a, 50); }
function percentile(a, p) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

function printScorecard(agg, rows) {
  const line = "-".repeat(96);
  console.log("\n" + line);
  console.log("METATAKE ASK — EVAL SCORECARD (W1)" + (agg.overall.retrievalOnly ? "  [retrieval-only]" : "  [retrieval + generation]"));
  console.log(line);
  console.log(`questions=${agg.overall.totalQuestions}  errors=${agg.overall.errors}  embed=${agg.overall.embedModel}  answer=${agg.overall.answerModel ?? "(skipped)"}  k=${agg.overall.k}  keep=${agg.overall.keep}`);
  console.log(`latency  p50=${agg.overall.p50LatencyMs}ms  p95=${agg.overall.p95LatencyMs}ms`);
  console.log(line);
  const hdr = ["type", "n", "hit@K", "hitDen", "refusalOK", "refDen", "avgFilms", "p50ms", "avgCite", "USEDok", "OOR"];
  const widths = [16, 4, 7, 7, 10, 7, 9, 7, 8, 7, 4];
  console.log(hdr.map((h, i) => h.padEnd(widths[i])).join(""));
  for (const [type, s] of Object.entries(agg.byType)) {
    const row = [
      type,
      s.n,
      s.retrievalHitRate ?? "-",
      s.hitDenominator,
      s.refusalCorrectRate ?? "-",
      s.refusalDenominator,
      s.avgUniqueFilms ?? "-",
      s.p50LatencyMs ?? "-",
      s.avgCitations ?? "-",
      s.usedLineRate ?? "-",
      s.outOfRangeCiteTotal ?? "-",
    ];
    console.log(row.map((v, i) => String(v).padEnd(widths[i])).join(""));
  }
  console.log(line);
  // per-question detail (compact)
  console.log("PER-QUESTION:");
  for (const r of rows) {
    if (r.error) { console.log(`  [ERR ] ${r.id.padEnd(12)} ${r.question.slice(0, 50)}  -> ${r.error.slice(0, 60)}`); continue; }
    let tag;
    if (r.should_refuse) tag = r.refusalCorrect ? "REFUSE✓" : "REFUSE✗";
    else tag = r.hit === true ? "HIT    " : r.hit === false ? "MISS   " : "n/a    ";
    const films = (r.topFilms || []).slice(0, 3).join(", ");
    console.log(`  [${tag}] ${r.id.padEnd(12)} films=${String(r.uniqueFilms ?? "-").padStart(2)} ${String(r.latencyMs).padStart(5)}ms  ${r.question.slice(0, 42).padEnd(42)} | ${films.slice(0, 40)}`);
  }
  console.log(line + "\n");
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnvLocal();

  for (const k of ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    if (!process.env[k]) { console.error(`Missing env ${k} (check .env.local).`); process.exit(1); }
  }

  const goldPath = resolve(REPO_ROOT, args.gold);
  const gold = JSON.parse(readFileSync(goldPath, "utf8"));
  let items = gold.items ?? gold;
  if (args.type) items = items.filter((i) => i.type === args.type);
  if (args.limit != null) items = items.slice(0, args.limit);

  if (!items.length) { console.error("No gold items to run (after filters)."); process.exit(1); }

  console.log(`Running ${items.length} question(s)  mode=${args.retrievalOnly ? "retrieval-only" : "retrieval+generation"}  k=${args.k} keep=${args.keep} concurrency=${args.concurrency}`);
  if (!args.retrievalOnly) console.log(`(generation enabled — calling ${ANSWER_MODEL}; this costs tokens)`);

  const rows = await mapPool(items, args.concurrency, (it) => runOne(it, args));
  const agg = aggregate(rows, args);
  printScorecard(agg, rows);

  const report = {
    generatedAt: new Date().toISOString(),
    args,
    note: "PROVISIONAL — baseline must not be frozen until the 1500-film import + embedding stabilizes. expected.films/themes are approximate hints, not strict relevance judgments.",
    summary: agg,
    results: rows,
  };
  const outPath = resolve(REPO_ROOT, args.out);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Report written: ${outPath}`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
