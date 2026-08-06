#!/usr/bin/env node
/**
 * gen-run — drive app-parity content generation through the SUBSCRIPTION CLI (`claude -p`).
 * 정본: HANDOFF-앱패리티-공장.md
 *
 * A sibling of scripts/i18n-translate-run.mjs, not a copy: same operating skeleton
 * (ledger, resume, requeue, circuit breaker, RUN_ID filenames), different cargo.
 * That runner translates rows that already exist; this one writes rows that do not.
 * So the lint is a fact-guard, not a style-guard, and an empty answer is legal.
 *
 * NO API KEY. Every call bills against the owner's subscription (owner directive
 * 2026-08-03). Model is Opus; Fable is banned for automation.
 *
 * Writes NOTHING to the database. Output is JSON batches on disk; loading is a
 * separate, owner-run step.
 *
 *   node scripts/gen-run.mjs --corpus leads --sample 12 --tag pilot
 *   node scripts/gen-run.mjs --corpus leads --chunk 12 --concurrency 3
 *   node scripts/gen-run.mjs --corpus leads --requeue
 *
 * Kill switch: touch data/gen/.stop
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const SRC = join(ROOT, "data/gen/src");
const OUT = join(ROOT, "data/gen/out");
const PROMPTS = join(ROOT, "data/gen/prompts");
const LEDGER = join(ROOT, "data/gen/ledger.jsonl");
const STOP = join(ROOT, "data/gen/.stop");
const RQDIR = join(ROOT, "data/gen/requeue");
const MODEL = "claude-opus-5";

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);

const CORPUS = arg("--corpus", "leads");
const CHUNK = Number(arg("--chunk", 12));
const SAMPLE = arg("--sample") ? Number(arg("--sample")) : null;
const LIMIT = arg("--limit") ? Number(arg("--limit")) : null;
const TAG = arg("--tag", "run");
const CONC = Number(arg("--concurrency", 3));
const DRY = has("--dry");
const REQUEUE = has("--requeue");
/** Batch indices restart at 0 on every resume. A filename of just the index made a
 *  second run overwrite the first one's output while the ledger still counted those
 *  keys as done — 580 invitations were sitting in that hole when this lane was built.
 *  The loader collapses by primary key, so extra files are free; collisions are not. */
const RUN_ID = new Date().toISOString().replace(/[-:T]/g, "").slice(2, 12);

// ── corpus specs ──────────────────────────────────────────────────────────────
const PROMO = /\b(masterpiece|must[- ]see|tour de force|unforgettable|timeless|gripping|stunning|breathtaking|hidden gem|underrated|essential viewing|a wild ride|ahead of its time|magnum opus|iconic)\b/i;
/** The two thousand Invitations we already hold share a template. Repeated five
 *  thousand more times it stops being prose and becomes a stamp, so the moves that
 *  make up that template are refused at the door. */
const FORMULA = [
  [/\bconverg(e|es|ing|ed)\b/i, "'converge' (템플릿 상투)"],
  [/\bHwadu\b/i, "'Hwadu' (템플릿 상투)"],
  [/\bcrucible\b/i, "'crucible'"],
  [/\bmeditation on\b/i, "'meditation on'"],
  [/at its (center|centre) is not a person but/i, "'at its center is not a person but'"],
  [/advances the [^.]{0,40}lineage/i, "'advances the … lineage'"],
  [/\ba landmark of\b/i, "'a landmark of'"],
  [/cast in the (mold|mould) of/i, "'cast in the mold of'"],
  [/^[A-Z][^,]{2,40} \(b\. \d{4}\)/, "'Director (b. YEAR)' 정형 도입"],
];
const NEGATIVE = /\b(no (awards|record|reception|information|documentation)|little is known|not much is known|remains obscure|may not be for everyone)\b/i;
/** "Sembène" folded to ASCII is "Sembene" — used to tell a dropped accent apart from
 *  a name the writer simply never mentioned. */
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const SPECS = {
  leads: {
    prompt: "lead-en.md",
    outField: "lead",
    tools: "",
    ask: (payload) =>
      `Write the Invitation for each film below, following the charter. Output exactly one JSON object: {"items":[{"k":"…","lead":"…"}]}.\n\n` +
      `Each item's "facts" block is the whole of your evidence. Do not add facts to it.\n\n` +
      JSON.stringify(payload, null, 1),
    lint(item, text) {
      const errs = [];
      if (text == null) return ["누락"];
      const s = String(text).trim();
      if (!s) return [];                       // an honest refusal; counted separately
      if (/[\r\n]/.test(s)) errs.push("줄바꿈 포함");
      if (/```|^\s*[#*\-]\s/.test(s)) errs.push("마크다운 잔류");
      if (s.length < 450) errs.push(`짧음 ${s.length}자`);
      if (s.length > 1150) errs.push(`김 ${s.length}자`);
      const first = (s.match(/^.*?[.!?](?=\s|$)/) || [s])[0].trim();
      if (first.length < 40) errs.push(`첫 문장 짧음 ${first.length}자`);
      if (first.length > 260) errs.push(`첫 문장 김 ${first.length}자 (카드 리드로 못 씀)`);
      const promo = s.match(PROMO);
      if (promo) errs.push(`홍보어 '${promo[0]}'`);
      for (const [re, msg] of FORMULA) if (re.test(s)) errs.push(msg);
      const neg = s.match(NEGATIVE);
      if (neg) errs.push(`부재 서술 '${neg[0]}'`);
      if (/\byou\b|\byour\b/i.test(s)) errs.push("2인칭");
      // Fact guard: every year the writer names must appear in the evidence block.
      // This is the cheapest hallucination check we have and it catches the
      // expensive kind — invented premieres, invented prizes, invented careers.
      const blob = JSON.stringify(item.facts);
      for (const y of new Set(s.match(/\b(1[89]\d{2}|20[0-3]\d)\b/g) || []))
        if (!blob.includes(y)) errs.push(`근거 없는 연도 ${y}`);
      // Diacritics survive the trip or the name is simply wrong. Measured on the
      // first smoke batch: Sembène came back as Sembene, Hänsel as Hansel.
      for (const name of [item.facts?.director, item.facts?.title].filter(Boolean)) {
        if (name === fold(name)) continue;          // nothing to lose
        if (s.includes(name)) continue;
        if (s.includes(fold(name))) errs.push(`발음 부호 탈락: ${fold(name)} → ${name}`);
      }
      return errs;
    },
    row: (item, text) => ({
      entity_type: item.entity_type, entity_key: item.entity_key, field: item.field,
      film_id: item.film_id ?? null, lang: "en", text: String(text).trim(),
      model: MODEL, source_sha256: item.sha256,
    }),
  },
  dfacts: {
    prompt: "life-en.md",
    outField: "life",
    tools: "WebSearch,WebFetch",
    ask: (payload) =>
      `Research and write The Life panel for each director below, following the charter. ` +
      `Use WebSearch to ground every fact; every fact must carry a source URL. ` +
      `Output exactly one JSON object: {"items":[{"k":"…","life":{"intro":"…","name_meaning":"…","facts":[{"n":1,"text":"…","source":"https://…"}]}}]}.\n\n` +
      JSON.stringify(payload, null, 1),
    lint(item, life) {
      const errs = [];
      if (!life || typeof life !== "object") return ["누락"];
      if (!life.intro || String(life.intro).trim().length < 80) errs.push("intro 부실");
      const facts = Array.isArray(life.facts) ? life.facts : [];
      if (facts.length < 4) errs.push(`facts ${facts.length}개 (최소 4)`);
      facts.forEach((f, i) => {
        if (!f?.text || String(f.text).trim().length < 40) errs.push(`fact ${i + 1} 부실`);
        if (!/^https?:\/\/\S+$/.test(String(f?.source || ""))) errs.push(`fact ${i + 1} 출처 없음`);
      });
      const blob = JSON.stringify(life);
      if (PROMO.test(blob)) errs.push("홍보어");
      if (NEGATIVE.test(blob)) errs.push("부재 서술");
      return errs;
    },
    row: (item, life) => ({
      director_slug: item.entity_key, intro: life.intro ?? null,
      name_meaning: life.name_meaning ?? null, facts: life.facts ?? [],
      model: MODEL, source_sha256: item.sha256,
    }),
  },
};

// A smoke corpus that exercises the whole path — prompt, parse, lint, ledger,
// filenames — against a handful of hand-written fact blocks, without touching the
// real corpus or its ledger. Proving the plumbing costs three calls; discovering a
// bug at 3am costs the night.
SPECS.smoke = SPECS.leads;

const spec = SPECS[CORPUS];
if (!spec) { console.error(`unknown corpus: ${CORPUS}`); process.exit(2); }

// ── claude -p ─────────────────────────────────────────────────────────────────
/** `--allowed-tools ""` is not cosmetic. Measured 2026-08-06: with tool schemas in
 *  the prompt every call writes ~19k cache tokens; without them, zero — the fixed
 *  prefix is served from cache instead. Corpora that genuinely need the web pay
 *  that toll knowingly and pre-approve the tools so an unattended run never blocks
 *  on a permission prompt. */
/** Hard ceiling on a single call. The circuit breaker below counts failures, and a
 *  failure is a process that EXITS — so it is blind to one that simply stops
 *  answering. Measured 2026-08-06: four workers sat on hung children for five and a
 *  half hours, nine seconds of CPU each, while the breaker saw a perfectly quiet run
 *  and the log showed nothing wrong. Silence has to be converted into a failure or
 *  nothing downstream can react to it. A full batch took three to five minutes in the
 *  pilot, so twelve is generous and still catches a hang the same shift it happens. */
const CALL_TIMEOUT_MS = Number(arg("--call-timeout", 12 * 60_000));

function callClaude(system, user, tools) {
  return new Promise((resolve, reject) => {
    const p = spawn("claude", ["-p", "--model", MODEL, "--system-prompt", system,
      "--allowed-tools", tools, "--output-format", "json"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "", timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      p.kill("SIGKILL");
    }, CALL_TIMEOUT_MS);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        const e = new Error(`claude hung — killed after ${Math.round(CALL_TIMEOUT_MS / 60000)}m`);
        e.processFailure = true;
        return reject(e);
      }
      if (code !== 0) {
        const e = new Error(`claude exit ${code}: ${(err || out || "").trim().slice(0, 400) || "(no output)"}`);
        e.processFailure = true;
        return reject(e);
      }
      try {
        const j = JSON.parse(out);
        resolve({ text: j.result ?? "", usage: j.usage ?? {} });
      } catch { reject(new Error(`unparseable CLI json: ${out.slice(0, 200)}`)); }
    });
    p.stdin.end(user);
  });
}
const stripFence = (s) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
function parseItems(text) {
  const t = stripFence(text);
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("no JSON object in reply");
  const obj = JSON.parse(t.slice(a, b + 1));
  if (!Array.isArray(obj.items)) throw new Error("no items[]");
  return obj.items;
}

// ── ledger ────────────────────────────────────────────────────────────────────
function doneKeys(corpus) {
  const set = new Set();
  if (!existsSync(LEDGER)) return set;
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      // Only the untagged production run counts as done. Pilots and smoke tests
      // predate whatever the charter finally says, so their keys must be rewritten.
      if (r.corpus === corpus && (r.tag ?? "run") === "run" && String(r.status || "").startsWith("ok"))
        for (const k of r.keys || []) set.add(k);
    } catch {}
  }
  return set;
}
const logLedger = (rec) => appendFileSync(LEDGER, JSON.stringify(rec) + "\n");

/** Deterministic, structurally spread sample — a pilot that only reads the fattest
 *  fact blocks tells you nothing about the thin tail, which is most of the corpus. */
function diverseSample(items, n) {
  const sorted = [...items].sort((a, b) => JSON.stringify(a.facts).length - JSON.stringify(b.facts).length);
  const picks = [], seen = new Set();
  for (let i = 0; i < n; i++) {
    let j = Math.floor((i + 0.5) * sorted.length / n);
    while (seen.has(j) && j < sorted.length - 1) j++;
    seen.add(j);
    if (sorted[j]) picks.push(sorted[j]);
  }
  return picks;
}

// ── main ──────────────────────────────────────────────────────────────────────
const system = readFileSync(join(PROMPTS, spec.prompt), "utf8");
let items = JSON.parse(readFileSync(join(SRC, `${CORPUS}.json`), "utf8"));

if (REQUEUE) {
  const files = [join(RQDIR, `${CORPUS}.json`), join(RQDIR, `${CORPUS}.qa.json`)].filter(existsSync);
  if (!files.length) { console.log(`nothing queued for ${CORPUS}`); process.exit(0); }
  const keys = new Set(files.flatMap((f) =>
    JSON.parse(readFileSync(f, "utf8")).map((r) => r.entity_key || r.k)).filter(Boolean));
  items = items.filter((i) => keys.has(i.entity_key));
  console.log(`requeue: ${items.length} items flagged by audit`);
} else if (SAMPLE) items = diverseSample(items, SAMPLE);
else {
  const done = doneKeys(CORPUS);
  const before = items.length;
  items = items.filter((i) => !done.has(i.entity_key));
  if (before !== items.length) console.log(`resume: ${before - items.length} already done, ${items.length} left`);
}
if (LIMIT) items = items.slice(0, LIMIT);
if (!items.length) { console.log("nothing to do"); process.exit(0); }

const batches = [];
for (let i = 0; i < items.length; i += CHUNK) batches.push(items.slice(i, i + CHUNK));
console.log(`${CORPUS}: ${items.length} items in ${batches.length} batches (chunk ${CHUNK}, conc ${CONC}, run ${RUN_ID})`);
if (DRY) process.exit(0);

const outDir = join(OUT, `${CORPUS}${SAMPLE ? "__" + TAG : ""}`);
mkdirSync(outDir, { recursive: true });
mkdirSync(RQDIR, { recursive: true });

let okCount = 0, emptyCount = 0, failCount = 0, outTok = 0, cacheR = 0, cacheW = 0, bi = 0;
let procFailStreak = 0, pausedUntil = 0;
/** A usage limit is not a per-batch problem: every worker hits it at once, and a
 *  short per-batch wait burns the whole retry budget in seconds. Consecutive
 *  process failures trip one long global pause instead — an unattended run should
 *  lose an hour to a limit that clears in an hour, not the rest of the corpus. */
async function breaker() {
  while (Date.now() < pausedUntil) {
    if (existsSync(STOP)) throw new Error("STOP");
    await new Promise((r) => setTimeout(r, 5_000));
  }
}
const startedAt = Date.now();

async function runBatch(batch, idx) {
  let retryNote = "";
  const payload = { items: batch.map((i) => ({ k: i.entity_key, facts: i.facts })) };

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (existsSync(STOP)) throw new Error("STOP");
    try {
      const { text, usage } = await callClaude(system, retryNote + spec.ask(payload), spec.tools);
      outTok += usage.output_tokens || 0;
      cacheR += usage.cache_read_input_tokens || 0;
      cacheW += usage.cache_creation_input_tokens || 0;
      const got = parseItems(text);
      const byKey = new Map(got.map((g) => [g.k, g[spec.outField]]));

      const rows = [], problems = [], empties = [];
      for (const it of batch) {
        const val = byKey.get(it.entity_key);
        if (val === undefined) { problems.push(`${it.entity_key}: 누락`); continue; }
        const errs = spec.lint(it, val);
        if (errs.length) { problems.push(`${it.entity_key}: ${errs.join(", ")}`); continue; }
        if (typeof val === "string" && !val.trim()) { empties.push(it.entity_key); continue; }
        rows.push(spec.row(it, val));
      }
      // Openings are checked across the batch, not within an item: any single
      // opening can be fine and the column still read as one voice repeating.
      if (CORPUS === "leads") {
        const heads = rows.map((r) => r.text.split(/\s+/).slice(0, 3).join(" ").toLowerCase());
        const dup = heads.filter((h, i) => heads.indexOf(h) !== i);
        if (dup.length) problems.push(`같은 첫머리 반복: ${[...new Set(dup)].join(" / ")}`);
      }

      if (problems.length && attempt < 3) {
        retryNote = `Your previous attempt had these problems. Fix those items and re-emit the complete JSON:\n${problems.slice(0, 20).join("\n")}\n\n`;
        continue;
      }
      const file = join(outDir, `${REQUEUE ? "rq-" : "b-"}${RUN_ID}-${String(idx).padStart(5, "0")}.json`);
      writeFileSync(file, JSON.stringify(rows, null, 1));
      logLedger({ ts: new Date().toISOString(), corpus: CORPUS, tag: TAG, batch: idx,
        status: problems.length ? "ok_with_warnings" : "ok",
        keys: [...rows.map((r) => r.entity_key ?? r.director_slug), ...empties],
        empties, warnings: problems.slice(0, 20),
        file: file.replace(ROOT + "/", ""), model: MODEL });
      okCount += rows.length; emptyCount += empties.length;
      procFailStreak = 0;
      return problems.length;
    } catch (e) {
      if (String(e.message) === "STOP") throw e;
      if (e.processFailure) {
        procFailStreak++;
        if (procFailStreak >= 4 && Date.now() >= pausedUntil) {
          pausedUntil = Date.now() + 20 * 60_000;
          console.error(`\n⚠️  ${procFailStreak} consecutive process failures — pausing 20m (likely a usage limit)`);
          console.error(`   ${String(e.message).slice(0, 200)}\n`);
        }
        await breaker();
        await new Promise((r) => setTimeout(r, attempt === 1 ? 30_000 : 120_000));
        continue;                       // process failures do not consume the attempt budget
      }
      if (attempt === 3) {
        failCount += batch.length;
        logLedger({ ts: new Date().toISOString(), corpus: CORPUS, tag: TAG, batch: idx,
          status: "fail", keys: [], error: String(e.message).slice(0, 300) });
        console.error(`  batch ${idx} FAILED: ${String(e.message).slice(0, 160)}`);
        return -1;
      }
      retryNote = `Your previous reply broke the output contract (${String(e.message).slice(0, 120)}). Emit exactly one JSON object and nothing else.\n\n`;
    }
  }
}

const queue = batches.map((b, i) => ({ b, i }));
async function worker() {
  while (queue.length) {
    if (existsSync(STOP)) { console.log("STOP file present — halting"); return; }
    await breaker();
    const { b, i } = queue.shift();
    const w = await runBatch(b, i).catch((e) => { if (String(e.message) === "STOP") return -2; throw e; });
    bi++;
    const pct = ((bi / batches.length) * 100).toFixed(0);
    const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.log(`[${bi}/${batches.length} ${pct}%] batch ${i} ${w === 0 ? "clean" : w > 0 ? `${w} warn` : "FAIL"} · ok=${okCount} empty=${emptyCount} · out=${(outTok / 1000).toFixed(0)}k tok · ${mins}m`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

console.log(`\n== ${CORPUS} done: ${okCount} written, ${emptyCount} honest-empty, ${failCount} failed`);
console.log(`   output ${outTok.toLocaleString()} tok · cache read ${cacheR.toLocaleString()} · cache write ${cacheW.toLocaleString()}`);
console.log(`   files: ${outDir}`);
