#!/usr/bin/env node
/**
 * i18n-audit-ko — corpus-level quality + mode-collapse audit over translated batches.
 * 정본: HANDOFF-한국어화-구독번역-실행.md §5.5 (반복 편향 방어 #3)
 *
 * Deterministic. Reports, per corpus:
 *   · translationese hits (should be 0 — the driver lints inline, this is the backstop)
 *   · ending-suffix distribution      → mode collapse in how sentences close
 *   · opening n-gram frequency        → mode collapse in how items start
 *   · sentence-length variance        → monotony
 *   · gloss usage, dash usage, length ratio outliers
 * Items breaching a threshold are written to data/i18n/requeue/<corpus>.json.
 *
 *   node scripts/i18n-audit-ko.mjs                 # all corpora in data/i18n/out
 *   node scripts/i18n-audit-ko.mjs --corpus portrait --verbose
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/i18n/out");
const SRC = join(ROOT, "data/i18n/src2");
const REQUEUE = join(ROOT, "data/i18n/requeue");

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = arg("--corpus");
const VERBOSE = args.includes("--verbose");

const RULES = [
  [/(습니다|합니다|입니다|됩니다|드립니다|세요)/, "합쇼체"],
  [/(되어진|되어졌|보여진|보여졌|읽혀진|불려진|쓰여진)/, "이중피동"],
  [/에 의해/, "에 의해"],
  [/에 있어서/, "에 있어서"],
  [/에 다름 아니/, "에 다름 아니"],
  [/```/, "코드펜스"],
  [/^\s*(?:번역|다음은|아래는)/, "메타발화"],
];

/** last 3 chars of each sentence — the ending signature */
function endings(text) {
  return text.split(/(?<=[.!?。])\s+/).map((s) => s.trim()).filter(Boolean)
    .map((s) => s.replace(/[.!?。]+$/, "").slice(-3));
}
const opening = (text) => text.trim().slice(0, 8);
function sentenceLens(text) {
  return text.split(/(?<=[.!?。])\s+/).map((s) => s.trim().length).filter((n) => n > 0);
}
const pct = (n, d) => (d ? (100 * n / d).toFixed(1) : "0.0");

function auditCorpus(name) {
  const dir = join(OUT, name);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const rows = files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  if (!rows.length) return null;

  const srcName = name === "tow_assembled" ? "tow" : name;
  const srcPath = join(SRC, `${srcName}.json`);
  const src = existsSync(srcPath)
    ? new Map(JSON.parse(readFileSync(srcPath, "utf8")).map((i) => [i.entity_key, i]))
    : new Map();

  const endCount = new Map(), openCount = new Map(), flagged = [];
  let allLens = [], glossTotal = 0, dashTotal = 0;

  for (const r of rows) {
    const t = r.text || "";
    const reasons = [];
    for (const [re, msg] of RULES) if (re.test(t)) reasons.push(msg);
    const dashes = (t.match(/—/g) || []).length;
    dashTotal += dashes;
    if (dashes > 2) reasons.push(`대시${dashes}`);
    const glosses = (t.match(/\([A-Za-z一-鿿][^)]{0,40}\)/g) || []).length;
    glossTotal += glosses;
    if (glosses > 2) reasons.push(`병기${glosses}`);
    const s = src.get(r.entity_key);
    if (s?.en && s.en.length > 40) {
      const ratio = t.length / s.en.length;
      if (ratio < 0.22 || ratio > 1.7) reasons.push(`길이비${ratio.toFixed(2)}`);
    }
    for (const e of endings(t)) endCount.set(e, (endCount.get(e) || 0) + 1);
    openCount.set(opening(t), (openCount.get(opening(t)) || 0) + 1);
    allLens = allLens.concat(sentenceLens(t));
    if (reasons.length) flagged.push({ entity_key: r.entity_key, reasons });
  }

  const totalEnd = [...endCount.values()].reduce((a, b) => a + b, 0);
  const topEnd = [...endCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topOpen = [...openCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mean = allLens.reduce((a, b) => a + b, 0) / (allLens.length || 1);
  const sd = Math.sqrt(allLens.reduce((a, b) => a + (b - mean) ** 2, 0) / (allLens.length || 1));

  // mode-collapse thresholds: one ending > 35% of sentences, or one opening > 3% of items
  const collapse = [];
  if (topEnd[0] && totalEnd && topEnd[0][1] / totalEnd > 0.35)
    collapse.push(`종결 '${topEnd[0][0]}' ${pct(topEnd[0][1], totalEnd)}% (>35%)`);
  // tow is template-assembled by design: repeated openings are the point, not collapse
  const TEMPLATE = name === "tow_assembled" || name === "tow_segments";
  if (!TEMPLATE && topOpen[0] && topOpen[0][1] / rows.length > 0.03 && rows.length > 100)
    collapse.push(`첫머리 '${topOpen[0][0]}' ${pct(topOpen[0][1], rows.length)}% (>3%)`);
  if (sd / (mean || 1) < 0.35 && allLens.length > 200)
    collapse.push(`문장길이 변동계수 ${(sd / mean).toFixed(2)} (<0.35, 단조)`);

  console.log(`\n── ${name} ── ${rows.length} rows, ${allLens.length} sentences`);
  console.log(`   번역투 위반: ${flagged.length} (${pct(flagged.length, rows.length)}%)`);
  console.log(`   문장길이 평균 ${mean.toFixed(0)}자 · 표준편차 ${sd.toFixed(0)} · 변동계수 ${(sd / (mean || 1)).toFixed(2)}`);
  console.log(`   병기 ${glossTotal}회 (${(glossTotal / rows.length).toFixed(2)}/항목) · 대시 ${dashTotal}회`);
  console.log(`   종결 상위: ${topEnd.map(([e, n]) => `${e}(${pct(n, totalEnd)}%)`).join(" ")}`);
  console.log(`   첫머리 상위: ${topOpen.map(([e, n]) => `"${e}"(${n})`).join(" ")}`);
  if (collapse.length) console.log(`   ⚠️  반복편향: ${collapse.join(" · ")}`);
  else console.log(`   ✓ 반복편향 임계 이내`);
  if (VERBOSE && flagged.length)
    for (const f of flagged.slice(0, 25)) console.log(`      · ${f.entity_key}: ${f.reasons.join(", ")}`);

  if (flagged.length) {
    mkdirSync(REQUEUE, { recursive: true });
    writeFileSync(join(REQUEUE, `${name}.json`), JSON.stringify(flagged, null, 1));
  }
  return { name, rows: rows.length, flagged: flagged.length, collapse };
}

const dirs = existsSync(OUT)
  ? readdirSync(OUT).filter((d) => !d.includes("__pilot") && (!ONLY || d === ONLY))
  : [];
const results = dirs.map(auditCorpus).filter(Boolean);
const totalRows = results.reduce((a, r) => a + r.rows, 0);
const totalFlag = results.reduce((a, r) => a + r.flagged, 0);
console.log(`\n═══ 합계: ${totalRows.toLocaleString()}행 · 위반 ${totalFlag} (${pct(totalFlag, totalRows)}%) ═══`);
if (totalFlag) console.log(`재작업 대상: data/i18n/requeue/`);
