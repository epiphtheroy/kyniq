#!/usr/bin/env node
/**
 * i18n-qa — sample-grade finished Korean batches against the English source.
 * 정본: HANDOFF-한국어화-구독번역-실행.md §5.3 (QA 루브릭 v2)
 *
 * The deterministic lint in the driver catches translationese it can name.
 * This catches what only a reader can: a sentence that is accurate and still
 * dead on the page. Grading is done by `claude -p` on the SUBSCRIPTION (no API
 * key), same as the translation itself.
 *
 * Three axes, 1–5 each:
 *   accuracy    — facts, names, years, causality preserved; nothing invented
 *   terminology — glossary + brand terms + film-title policy
 *   prose       — would this pass as Korean film writing, not a translation
 *
 * Anything scoring ≤2 on any axis lands in data/i18n/requeue/<corpus>.qa.json,
 * which `i18n-translate-run.mjs --requeue` re-translates.
 *
 *   node scripts/i18n-qa.mjs --corpus portrait --rate 0.08
 *   node scripts/i18n-qa.mjs                      # every corpus, default 8%
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/i18n/out");
const SRC = join(ROOT, "data/i18n/src2");
const REQUEUE = join(ROOT, "data/i18n/requeue");
const MODEL = "claude-opus-5";

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = arg("--corpus");
const RATE = Number(arg("--rate", 0.08));
const CHUNK = Number(arg("--chunk", 10));

const SYSTEM = `당신은 한국어 영화비평 매체의 **원고 심사자**다. 번역가가 아니라 편집자의 눈으로 읽는다.

각 항목에 대해 영어 원문(en)과 한국어(ko)를 대조해 세 축을 1~5로 채점하라.

**accuracy** — 사실 보존. 인명·연도·작품명·수치·인과가 정확한가. **원문에 없는 정보를 보탰으면 감점**(사실이더라도).
  5=완전 · 3=사소한 누락 · 1=사실 왜곡

**terminology** — 브랜드 고유명(TakeScore·Metatake·NAV 등) 영문 유지, 영화 제목은 한국 개봉명 또는 영어 원제(직역 지어내기 금지),
  동아시아 인명 성-이름 순서, 병기는 핵심 용어에만 2회 이하.
  5=완전 준수 · 3=한 곳 흔들림 · 1=규칙 위반 다수

**prose** — **가장 중요한 축.** 한국어로 처음 쓰인 글처럼 읽히는가. 영어 통사가 비치는가(긴 선행 관형절·피동 과잉·명사화 나열·
  대시 이식). 종결과 문장 길이에 리듬이 있는가. 딱딱하거나 기계적이면 낮게.
  5=지면에 실려도 좋다 · 4=자연스럽다 · 3=읽히지만 번역 티 · 2=딱딱함 · 1=직역투

문제가 있으면 \`why\`에 **한 구절만** 인용해 짧게 지적하라(30자 이내).

출력은 오직 JSON 하나:
{"items":[{"k":"<키>","accuracy":N,"terminology":N,"prose":N,"why":"<없으면 빈 문자열>"}]}
코드펜스·설명·인사 금지. 첫 글자 { 마지막 글자 }. 항목 수와 키는 입력과 동일.`;

function callClaude(user) {
  return new Promise((resolve, reject) => {
    const p = spawn("claude", ["-p", "--model", MODEL, "--system-prompt", SYSTEM,
      "--allowed-tools", "", "--output-format", "json"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (c) => {
      if (c !== 0) return reject(new Error(`claude exit ${c}: ${err.slice(0, 200)}`));
      try { resolve(JSON.parse(out).result ?? ""); } catch { reject(new Error("bad CLI json")); }
    });
    p.stdin.end(user);
  });
}
function parse(text) {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const obj = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  return obj.items ?? [];
}

/** Deterministic spread across the corpus, short to long. */
function sample(rows, rate) {
  const n = Math.max(3, Math.round(rows.length * rate));
  const sorted = [...rows].sort((a, b) => (a.text?.length ?? 0) - (b.text?.length ?? 0));
  const out = [];
  for (let i = 0; i < n; i++) out.push(sorted[Math.floor((i + 0.5) * sorted.length / n)]);
  return out.filter(Boolean);
}

const dirs = readdirSync(OUT).filter((d) =>
  !d.includes("__pilot") && d !== "tow_segments" && (!ONLY || d === ONLY));

const summary = [];
for (const dir of dirs) {
  const rows = readdirSync(join(OUT, dir)).filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(readFileSync(join(OUT, dir, f), "utf8")));
  if (!rows.length) continue;
  const srcName = dir === "tow_assembled" ? "tow" : dir;
  const srcPath = join(SRC, `${srcName}.json`);
  if (!existsSync(srcPath)) { console.log(`· ${dir} — no source, skipped`); continue; }
  const src = new Map(JSON.parse(readFileSync(srcPath, "utf8")).map((i) => [i.entity_key, i]));

  const picked = sample(rows, RATE).filter((r) => src.get(r.entity_key)?.en);
  const graded = [];
  for (let i = 0; i < picked.length; i += CHUNK) {
    const batch = picked.slice(i, i + CHUNK);
    const payload = { items: batch.map((r) => ({ k: r.entity_key, en: src.get(r.entity_key).en, ko: r.text })) };
    try {
      const got = parse(await callClaude(JSON.stringify(payload, null, 1)));
      const byKey = new Map(got.map((g) => [g.k, g]));
      for (const r of batch) { const g = byKey.get(r.entity_key); if (g) graded.push({ ...g, corpus: dir }); }
    } catch (e) {
      console.error(`  ${dir} batch ${i / CHUNK} grading failed: ${String(e.message).slice(0, 120)}`);
    }
  }
  if (!graded.length) continue;

  const avg = (k) => (graded.reduce((a, g) => a + (g[k] || 0), 0) / graded.length);
  const failed = graded.filter((g) => Math.min(g.accuracy, g.terminology, g.prose) <= 2);
  console.log(`\n── ${dir} ── 표본 ${graded.length}/${rows.length}`);
  console.log(`   정확 ${avg("accuracy").toFixed(2)} · 용어 ${avg("terminology").toFixed(2)} · 산문 ${avg("prose").toFixed(2)}`);
  console.log(`   미달(어느 축이든 ≤2): ${failed.length} (${(100 * failed.length / graded.length).toFixed(0)}%)`);
  for (const f of failed.slice(0, 6)) console.log(`      · ${f.k}: a${f.accuracy}/t${f.terminology}/p${f.prose} — ${f.why || ""}`);
  if (failed.length) {
    mkdirSync(REQUEUE, { recursive: true });
    writeFileSync(join(REQUEUE, `${dir}.qa.json`), JSON.stringify(failed, null, 1));
  }
  summary.push({ dir, n: graded.length, prose: avg("prose"), failed: failed.length });
}

console.log("\n═══ QA 요약 ═══");
for (const s of summary)
  console.log(`${s.dir.padEnd(24)} 표본 ${String(s.n).padStart(4)} · 산문 ${s.prose.toFixed(2)} · 미달 ${s.failed}`);
const weak = summary.filter((s) => s.prose < 3.8);
console.log(weak.length
  ? `\n⚠️ 산문 3.8 미만: ${weak.map((s) => s.dir).join(", ")} — 재작업 검토`
  : "\n✓ 전 코퍼스 산문 3.8 이상");
