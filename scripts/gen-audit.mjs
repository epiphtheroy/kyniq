#!/usr/bin/env node
/**
 * gen-audit — read the app-parity output on disk and judge it as a body of writing.
 * 정본: HANDOFF-앱패리티-공장.md
 *
 * The per-batch lint inside gen-run.mjs asks "is this item acceptable?". That is not
 * the question that matters at five thousand items. The question that matters is
 * "do these read as five thousand pieces, or as one piece five thousand times?" —
 * and it can only be asked of the corpus, never of a batch.
 *
 * Touches no network and no database. Reads files, prints a report, and optionally
 * writes a requeue list for `gen-run.mjs --requeue`.
 *
 *   node scripts/gen-audit.mjs --corpus leads
 *   node scripts/gen-audit.mjs --corpus leads --write-requeue
 *   node scripts/gen-audit.mjs --corpus leads --samples 8
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const CORPUS = arg("--corpus", "leads");
const SAMPLES = Number(arg("--samples", 6));
const OUTDIR = join(ROOT, "data/gen/out", CORPUS);
// A pilot writes to leads__pilot but is drawn from the leads corpus; without this the
// fact-grounding check silently switches off exactly where it is most needed.
const SRCFILE = join(ROOT, "data/gen/src", `${arg("--src", CORPUS.split("__")[0])}.json`);
const RQDIR = join(ROOT, "data/gen/requeue");

if (!existsSync(OUTDIR)) { console.log(`no output yet: ${OUTDIR}`); process.exit(0); }

// ── load ──────────────────────────────────────────────────────────────────────
// Later files win on duplicate keys, exactly as the loader will collapse them.
const rows = new Map();
const files = readdirSync(OUTDIR).filter((f) => f.endsWith(".json")).sort();
for (const f of files) {
  try {
    for (const r of JSON.parse(readFileSync(join(OUTDIR, f), "utf8"))) {
      const k = r.entity_key ?? r.director_slug;
      if (k) rows.set(k, r);
    }
  } catch (e) { console.error(`  ! unreadable ${f}: ${e.message}`); }
}
const src = existsSync(SRCFILE)
  ? new Map(JSON.parse(readFileSync(SRCFILE, "utf8")).map((r) => [r.entity_key, r]))
  : new Map();

const items = [...rows.values()];
if (!items.length) { console.log("no rows on disk"); process.exit(0); }
const textOf = (r) => String(r.text ?? r.intro ?? "");

// ── measures ──────────────────────────────────────────────────────────────────
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const pctl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)] ?? 0; };
const firstSentence = (s) => (s.match(/^.*?[.!?](?=\s|$)/) || [s])[0].trim();
const words = (s) => s.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter(Boolean);

const PROMO = /\b(masterpiece|must[- ]see|tour de force|unforgettable|timeless|gripping|stunning|breathtaking|hidden gem|underrated|essential viewing|iconic|visionary|legendary)\b/i;
const FORMULA = [
  [/\bconverg(e|es|ing|ed)\b/i, "converge"],
  [/\bHwadu\b/i, "Hwadu"],
  [/\bcrucible\b/i, "crucible"],
  [/\bmeditation on\b/i, "meditation on"],
  [/at its (center|centre) is not a person but/i, "at-its-center"],
  [/advances the [^.]{0,40}lineage/i, "advances-the-lineage"],
  [/\ba landmark of\b/i, "a landmark of"],
  [/cast in the (mold|mould) of/i, "cast in the mold of"],
  [/^[A-Z][^,]{2,40} \(b\. \d{4}\)/, "(b. YEAR) 도입"],
];
const NEGATIVE = /\b(no (awards|record|reception|information)|little is known|not much is known|may not be for everyone)\b/i;

const lens = [], firsts = [], openings = new Map(), sixgrams = new Map(), cvs = [];
const flagged = new Map();                       // key -> reasons[]
const flag = (k, why) => flagged.set(k, [...(flagged.get(k) || []), why]);

for (const r of items) {
  const k = r.entity_key ?? r.director_slug;
  const t = textOf(r);
  if (!t.trim()) { flag(k, "빈 출력"); continue; }
  lens.push(t.length);

  const fs = firstSentence(t);
  firsts.push(fs.length);
  if (fs.length > 260) flag(k, `첫 문장 ${fs.length}자 — 덱 카드로 못 씀`);
  if (fs.length < 40) flag(k, `첫 문장 ${fs.length}자`);
  if (CORPUS === "leads" && (t.length < 450 || t.length > 1150)) flag(k, `길이 ${t.length}자`);

  const w = words(t);
  const head = w.slice(0, 3).join(" ");
  openings.set(head, (openings.get(head) || 0) + 1);
  for (let i = 0; i + 6 <= w.length; i++) {
    const g = w.slice(i, i + 6).join(" ");
    sixgrams.set(g, (sixgrams.get(g) || 0) + 1);
  }

  // Sentence-length variation. A low coefficient of variation is the signature of
  // machine prose: every sentence the same size, forever.
  const sents = t.split(/(?<=[.!?])\s+/).map((s) => s.trim().length).filter((n) => n > 5);
  if (sents.length > 2) {
    const m = sents.reduce((a, b) => a + b, 0) / sents.length;
    const sd = Math.sqrt(sents.reduce((a, b) => a + (b - m) ** 2, 0) / sents.length);
    cvs.push(sd / m);
    if (sd / m < 0.22) flag(k, `문장장 단조 (CV ${(sd / m).toFixed(2)})`);
  }

  const promo = t.match(PROMO); if (promo) flag(k, `홍보어 '${promo[0]}'`);
  for (const [re, name] of FORMULA) if (re.test(t)) flag(k, `템플릿 '${name}'`);
  const neg = t.match(NEGATIVE); if (neg) flag(k, `부재 서술 '${neg[0]}'`);

  const s = src.get(k);
  if (s) {
    const blob = JSON.stringify(s.facts);
    for (const y of new Set(t.match(/\b(1[89]\d{2}|20[0-3]\d)\b/g) || []))
      if (!blob.includes(y)) flag(k, `근거 없는 연도 ${y}`);
  }
}

// ── report ────────────────────────────────────────────────────────────────────
const N = items.length, written = lens.length, empty = N - written;
const share = (n) => `${((n / Math.max(written, 1)) * 100).toFixed(1)}%`;
console.log(`\n== ${CORPUS} audit — ${files.length} files, ${N} keys, ${written} written, ${empty} empty (${share(empty)})`);
if (src.size) console.log(`   source corpus ${src.size} · coverage ${((N / src.size) * 100).toFixed(1)}%`);

console.log(`\n길이(자)      p10 ${pctl(lens, .1)} · 중앙 ${median(lens)} · p90 ${pctl(lens, .9)}`);
console.log(`첫 문장(자)   p10 ${pctl(firsts, .1)} · 중앙 ${median(firsts)} · p90 ${pctl(firsts, .9)}`);
console.log(`문장장 변이   중앙 CV ${median(cvs).toFixed(2)}  (0.22 미만이면 기계 문장)`);

const topOpen = [...openings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`\n첫머리 3어 상위`);
// A share alone is meaningless on a small sample: in a 23-item pilot a perfectly
// unique opening is 4.3% of the corpus. Repetition means a phrase recurring, so
// nothing is called a concentration until it has actually happened three times.
const REPEAT_MIN = 3;
for (const [g, n] of topOpen) {
  const pc = (n / written) * 100;
  const hot = n >= REPEAT_MIN && pc >= 2.5;
  console.log(`  ${hot ? "⚠️ " : "   "}${String(n).padStart(4)}  ${pc.toFixed(1).padStart(4)}%  "${g}"`);
}
const worstOpen = topOpen[0] && topOpen[0][1] >= REPEAT_MIN ? (topOpen[0][1] / written) * 100 : 0;

const topGram = [...sixgrams.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
if (topGram.length) {
  console.log(`\n반복 6어구 (에코)`);
  for (const [g, n] of topGram) {
    const pc = (n / written) * 100;
    console.log(`  ${pc >= 1.5 ? "⚠️ " : "   "}${String(n).padStart(4)}  ${pc.toFixed(1).padStart(4)}%  "${g}"`);
  }
}

const reasons = new Map();
for (const rs of flagged.values()) for (const r of rs) {
  const key = r.replace(/'[^']*'/, "'…'").replace(/\d+/g, "N");
  reasons.set(key, (reasons.get(key) || 0) + 1);
}
console.log(`\n지적 ${flagged.size}건 (${share(flagged.size)})`);
for (const [r, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`  ${String(n).padStart(4)}  ${r}`);

if (SAMPLES > 0) {
  console.log(`\n표본 ${SAMPLES}편 (길이 분포 전역에서)`);
  const sorted = [...items].filter((r) => textOf(r).trim()).sort((a, b) => textOf(a).length - textOf(b).length);
  for (let i = 0; i < SAMPLES; i++) {
    const r = sorted[Math.floor((i + 0.5) * sorted.length / SAMPLES)];
    if (!r) continue;
    const k = r.entity_key ?? r.director_slug;
    console.log(`\n  ── ${k} (${textOf(r).length}자)${flagged.has(k) ? "  ⚠️ " + flagged.get(k).join(", ") : ""}`);
    console.log(`  ${textOf(r)}`);
  }
}

// ── verdict ───────────────────────────────────────────────────────────────────
// Deliberately blunt so an unattended supervisor can branch on the exit code.
const flagRate = flagged.size / Math.max(N, 1);
const problems = [];
if (worstOpen >= 3.0) problems.push(`첫머리 쏠림 ${worstOpen.toFixed(1)}%`);
if (flagRate >= 0.12) problems.push(`지적률 ${(flagRate * 100).toFixed(1)}%`);
if (median(cvs) < 0.22) problems.push(`문장장 단조 CV ${median(cvs).toFixed(2)}`);
if (written && empty / N > 0.25) problems.push(`빈 출력 ${share(empty)}`);

console.log(`\n판정: ${problems.length ? "⚠️  " + problems.join(" · ") : "✅ 통과"}`);

if (has("--write-requeue") && flagged.size) {
  mkdirSync(RQDIR, { recursive: true });
  const dest = join(RQDIR, `${CORPUS}.qa.json`);
  writeFileSync(dest, JSON.stringify([...flagged.entries()].map(([entity_key, why]) => ({ entity_key, why })), null, 1));
  console.log(`requeue → ${dest.replace(ROOT + "/", "")} (${flagged.size})`);
}
process.exit(problems.length ? 1 : 0);
