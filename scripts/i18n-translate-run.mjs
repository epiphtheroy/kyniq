#!/usr/bin/env node
/**
 * i18n-translate-run — drive Korean translation through the SUBSCRIPTION CLI (`claude -p`).
 * 정본: HANDOFF-한국어화-구독번역-실행.md
 *
 * NO API KEY. Every call is `claude -p --model claude-opus-5 --allowed-tools ""`,
 * which bills against the owner's subscription (owner directive 2026-08-03).
 *
 * Resumable: every completed batch is appended to the ledger, and keys already in
 * the ledger are skipped on the next run. Kill switch: touch data/i18n/.stop
 *
 *   node scripts/i18n-translate-run.mjs --corpus tow --chunk 60
 *   node scripts/i18n-translate-run.mjs --corpus tow --sample 10 --tag pilot
 *   node scripts/i18n-translate-run.mjs --corpus repolish_laconic --chunk 80
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const SRC = join(ROOT, "data/i18n/src2");
const OUT = join(ROOT, "data/i18n/out");
const PROMPTS = join(ROOT, "data/i18n/prompts");
const LEDGER = join(ROOT, "data/i18n/ko-run-ledger.jsonl");
const STOP = join(ROOT, "data/i18n/.stop");
const MODEL = "claude-opus-5";
const LANG = "ko";

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);

const CORPUS = arg("--corpus");
const CHUNK = Number(arg("--chunk", 40));
const SAMPLE = arg("--sample") ? Number(arg("--sample")) : null;
const LIMIT = arg("--limit") ? Number(arg("--limit")) : null;
const TAG = arg("--tag", "run");
const CONC = Number(arg("--concurrency", 3));
const DRY = has("--dry");
if (!CORPUS) { console.error("--corpus required"); process.exit(2); }

// ── corpus voice addenda ──────────────────────────────────────────────────
const VOICE = {
  tow_segments: `## 이 묶음의 성격 — to.W 조립 조각 (매우 중요)
이것들은 큐레이터 코멘트를 조립하는 **부품**이다. 한 조각이 수백~수천 편에 재사용되고, \` · \`로 이어 붙거나 문장으로 나란히 놓인다.
- **특정 영화를 가정하지 마라.** 조각 자체만 보고 옮긴다.
- **형태를 바꾸지 마라.** 원문이 문장이면 문장으로, 구(句)면 구로. 끝의 마침표 유무도 원문 그대로. 조립이 깨진다.
- 담백하고 짧게. 같은 문구가 수천 번 렌더되므로 화려한 표현은 금방 물린다. 여기서는 리듬 변주보다 **정확·간결·통일**이 우선이다.
- 용어 통일(엄수): canon=정전 · cinephile=시네필 · national canon=국가 정전 · movement=사조 ·
  required viewing=반드시 볼 것 · optional viewing=선택 관람 · deep cut=숨은 카드 · auteur=작가 · lineage=계보
- 숫자·코드·고유명(TakeScore, Value 63/100, US, GB, 수상명)은 그대로 둔다. 병기는 쓰지 않는다.`,
  tow: `## 이 묶음의 성격 — to.W 큐레이터 코멘트
사람이 한 편을 골라 놓고 "왜 이걸 보라고 하는지" 건네는 짧은 말이다. **가장 사람 냄새가 나야 하는 층**이다.
- 담백하게. 그러나 차갑지 않게. 과장·감탄사·홍보문구 금지, 대신 정확한 관찰 하나로 온기를 만든다.
- 짧다(대개 1~3문장). 짧은 만큼 리듬이 전부다. 병기는 대개 쓰지 마라.
- 평가어("걸작", "수작")는 원문에 있을 때만.`,
  portrait: `## 이 묶음의 성격 — 감독 포트레이트
한 감독의 작업 세계를 요약한 에세이 문단이다. 호흡이 길어도 좋으나 **관형절은 반드시 분할**한다.
- 첫 문장에서 감독을 규정하고, 이어서 근거를 편다. 영어의 "who~" 삽입 구조를 그대로 옮기지 마라.
- 이론·미학 용어는 병기가 유용한 층이다(최대 2회).`,
  dfacts_items: `## 이 묶음의 성격 — 감독 팩트 한 줄
사실 하나를 전달하는 독립된 짧은 글이다. 앞뒤 항목과 이어지지 않는다.
- 사실 정확도가 최우선. 연도·작품명·수치를 절대 바꾸지 마라.
- 항목마다 첫머리와 종결을 달리하라 — 나란히 렌더되므로 단조로움이 바로 보인다.`,
  dfacts_intro: `## 이 묶음의 성격 — 감독 소개 리드
감독 화면 상단의 짧은 소개다. 첫 문장이 인상을 결정한다. 간결하고 단단하게.`,
  dfacts_meaning: `## 이 묶음의 성격 — 이름의 유래
인명의 뜻·유래를 설명하는 짧은 글. **한자·원어 병기가 가장 자연스러운 층**이다(예: 侯孝賢).`,
  repolish_invitation: `## 이 묶음의 성격 — 인바이테이션(초대문) 재집필
한 편으로 독자를 초대하는 긴 산문이다. 사이트의 간판 글이다.
- **기존 한국어(prev)가 있다. 그것은 딱딱한 직역이라 폐기 대상이다.** 참고만 하고, 영어 원문을 보고 새로 써라.
- 특히 고칠 것: 130자짜리 선행 관형절, 대시 남용, 명사화 나열, 합쇼체 혼입.
- 호흡은 길되 문장은 끊어라. 한 단락 안에서 긴 문장과 짧은 문장을 번갈아.`,
  repolish_laconic: `## 이 묶음의 성격 — 라코닉(한 줄 정의) 재집필
트로프를 한 문장으로 정의하는 아포리즘이다. **리스트에 수십 개가 나란히 렌더된다.**
- **정의문이지 주장문이 아니다.** 트로프가 무엇인지 규정하는 말이다. 원문이 명사구면 명사구 종결을 우선하라.
- 짧고 칼같이. 명사 종결 허용·권장. 마침표로 끝나는 명사구도 좋다.
- **기존 한국어(prev)는 직역투라 폐기 대상.** 영어 원문에서 다시 써라.
- 나란히 놓였을 때 단조롭지 않도록 형태를 의도적으로 흩어라(명사 종결 / ~다 / 도치 / 대구).`,
  repolish_trope_title: `## 이 묶음의 성격 — 트로프 제목 재집필
목록에 표시되는 짧은 제목구다. 명사구로. 문장부호 최소화. 원문의 비유를 살리되 한국어로 자연스럽게.
- **기존 한국어(prev)는 참고만.** 제목다운 밀도를 우선한다.`,
};

// ── golden samples: bad-literal → good-prose, taught as *repairs* ─────────
const GOLDEN = `## 교정 예시 (무엇을 고치는지 배워라 — 이 문체를 흉내 내라는 뜻이 아니다)

원문: Cinema conjugated in the conditional — the unlived life filmed beside the lived one.
✗ 나쁨: 조건법으로 활용된 영화 — 살아진 삶 곁에 촬영된 살지 않은 삶.
   (억지 피동 "살아진", 영어 대시 구조 이식, 무슨 말인지 안 들어옴)
✓ 좋음: 가정법으로 찍은 영화. 살아온 삶 옆에 살아보지 못한 삶을 나란히 놓는다.

원문: A woman's continued existence is purchased through wealth, sacrifice, or expenditure.
✗ 나쁨: 한 여자의 존속이 부, 희생, 혹은 소비를 통해 매입된다.
   (피동 "매입된다", 명사화 "존속", 콤마 나열 그대로)
✓ 좋음: 여자가 살아남는 데는 값이 붙는다. 재산이든 희생이든, 탕진이든.

원문: Cultures that perfected themselves into obsolescence, deafness, or self-deception.
✗ 나쁨: 스스로를 완성해 낡음, 귀먹음, 자기기만에 이른 문화들.
   (명사화 3연발)
✓ 좋음: 스스로를 완벽하게 다듬다가 낡고, 귀가 멀고, 끝내 자신을 속이게 된 문화.

원문: Kobayashi Masaki (b. 1916), the unbending moralist of postwar Japanese cinema, who established himself as the conscience of the studio era with the nine-and-a-half-hour antiwar epic The Human Condition (1959–61), condenses here a lifelong quarrel with authority.
✗ 나쁨: 아홉 시간 반짜리 반전 서사시 《인간의 조건》(1959–61)으로 스튜디오 시대의 양심으로 자리매김한, 전후 일본 영화의 굽히지 않는 도덕가 고바야시 마사키(1916년생)는, 여기서 권위와의 평생의 다툼을 응축한다.
   (선행 관형절 90자 — 한국어가 견디지 못한다)
✓ 좋음: 고바야시 마사키(1916년생)는 전후 일본 영화의 굽히지 않는 도덕가였다. 아홉 시간 반짜리 반전 서사시 《인간의 조건》(1959–61)으로 그는 스튜디오 시대의 양심이 되었다. 그 평생의 싸움, 권위와의 다툼이 여기 한 편으로 응축된다.`;

// ── lint ──────────────────────────────────────────────────────────────────
const BRAND = ["TakeScore", "Metatake", "NAV", "Navigator", "Engine Room", "Strong Misreadings", "Embedding Fantasia", "to.W"];
const HANGUL = /[가-힣]/;
const RULES = [
  [/(습니다|합니다|입니다|됩니다|드립니다|세요)/, "합쇼체 혼입"],
  [/(되어진|되어졌|보여진|보여졌|읽혀진|불려진|쓰여진)/, "이중 피동"],
  [/에 의해/, "'에 의해' (by 직역)"],
  [/에 있어서/, "'에 있어서' (일본어투)"],
  [/에 다름 아니/, "'에 다름 아니다'"],
  [/```/, "코드펜스 잔류"],
];
function lint(en, ko, { longForm = false } = {}) {
  const errs = [];
  if (!en?.trim()) return errs;
  if (!ko?.trim()) return ["빈 출력"];
  if (!HANGUL.test(ko)) errs.push("한글 없음");
  for (const [re, msg] of RULES) if (re.test(ko)) errs.push(msg);
  const dashes = (ko.match(/—/g) || []).length;
  if (dashes > (longForm ? 2 : 1)) errs.push(`대시 ${dashes}개`);
  const glosses = (ko.match(/\([A-Za-z一-鿿][^)]{0,40}\)/g) || []).length;
  if (glosses > 2) errs.push(`병기 ${glosses}회 (최대 2)`);
  if (en.length > 40) {
    const r = ko.length / en.length;
    if (r < 0.22) errs.push(`너무 짧음 (${r.toFixed(2)})`);
    if (r > 1.7) errs.push(`너무 김 (${r.toFixed(2)})`);
  }
  for (const b of BRAND) if (en.includes(b) && !ko.includes(b)) errs.push(`브랜드어 소실: ${b}`);
  return errs;
}

// ── claude -p ─────────────────────────────────────────────────────────────
function callClaude(system, user) {
  return new Promise((resolve, reject) => {
    const p = spawn("claude", ["-p", "--model", MODEL, "--system-prompt", system,
      "--allowed-tools", "", "--output-format", "json"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`));
      try {
        const j = JSON.parse(out);
        resolve({ text: j.result ?? "", usage: j.usage ?? {} });
      } catch (e) { reject(new Error(`unparseable CLI json: ${out.slice(0, 200)}`)); }
    });
    p.stdin.end(user);
  });
}
const stripFence = (s) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
function parseItems(text) {
  const t = stripFence(text);
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON object in reply");
  const obj = JSON.parse(t.slice(start, end + 1));
  if (!Array.isArray(obj.items)) throw new Error("no items[]");
  return obj.items;
}

// ── ledger ────────────────────────────────────────────────────────────────
function doneKeys(corpus) {
  const set = new Set();
  if (!existsSync(LEDGER)) return set;
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      // pilot batches predate the final charter — never count them as done
      if (r.corpus === corpus && r.tag !== "pilot" && (r.status === "ok" || r.status === "ok_with_warnings"))
        for (const k of r.keys || []) set.add(k);
    } catch {}
  }
  return set;
}
const logLedger = (rec) => appendFileSync(LEDGER, JSON.stringify(rec) + "\n");

// ── sampling: structurally diverse, deterministic ─────────────────────────
function diverseSample(items, n) {
  const sorted = [...items].sort((a, b) => a.en.length - b.en.length);
  const picks = [], seen = new Set();
  for (let i = 0; i < n; i++) {
    const idx = Math.floor((i + 0.5) * sorted.length / n);
    let j = idx;
    while (seen.has(j) && j < sorted.length - 1) j++;
    seen.add(j);
    if (sorted[j]) picks.push(sorted[j]);
  }
  return picks;
}

// ── main ──────────────────────────────────────────────────────────────────
const charter = readFileSync(join(PROMPTS, "style-ko.md"), "utf8");
const system = [charter, GOLDEN, VOICE[CORPUS] || ""].join("\n\n---\n\n");

let items = JSON.parse(readFileSync(join(SRC, `${CORPUS}.json`), "utf8"));
const isRepolish = CORPUS.startsWith("repolish");
const longForm = /invitation|portrait/.test(CORPUS);

if (SAMPLE) items = diverseSample(items, SAMPLE);
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
console.log(`${CORPUS}: ${items.length} items in ${batches.length} batches (chunk ${CHUNK}, conc ${CONC})`);
if (DRY) process.exit(0);

const outDir = join(OUT, `${CORPUS}${SAMPLE ? "__" + TAG : ""}`);
mkdirSync(outDir, { recursive: true });

let okCount = 0, failCount = 0, outTok = 0, cacheR = 0, bi = 0;
const startedAt = Date.now();

async function runBatch(batch, idx) {
  let retryNote = "";
  const payload = {
    items: batch.map((i) => isRepolish
      ? { k: i.entity_key, en: i.en, prev: i.ko }
      : { k: i.entity_key, en: i.en }),
  };
  const ask = (extra = "") =>
    `${extra}다음 항목들을 헌장에 따라 한국어로 다시 써라. 출력은 {"items":[{"k":...,"ko":...}]} JSON 하나뿐이다.\n\n` +
    (isRepolish ? `각 항목의 "prev"는 폐기 대상인 기존 직역이다. 참고만 하고 "en"을 보고 새로 써라.\n\n` : "") +
    JSON.stringify(payload, null, 1);

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (existsSync(STOP)) throw new Error("STOP");
    try {
      const { text, usage } = await callClaude(system, attempt === 1 ? ask() : ask(retryNote));
      outTok += usage.output_tokens || 0;
      cacheR += usage.cache_read_input_tokens || 0;
      const got = parseItems(text);
      const byKey = new Map(got.map((g) => [g.k, g.ko]));
      const rows = [], problems = [];
      for (const it of batch) {
        const ko = byKey.get(it.entity_key);
        if (ko == null) { problems.push(`${it.entity_key}: 누락`); continue; }
        const errs = lint(it.en, ko, { longForm });
        if (errs.length) problems.push(`${it.entity_key}: ${errs.join(", ")}`);
        rows.push({ entity_type: it.entity_type, entity_key: it.entity_key, field: it.field,
          lang: LANG, text: ko, model: MODEL, source_sha256: it.sha256 });
      }
      if (problems.length && attempt < 3) {
        retryNote = `직전 시도에서 아래 문제가 검출됐다. 해당 항목을 고쳐 전체를 다시 출력하라:\n${problems.slice(0, 20).join("\n")}\n\n`;
        continue;
      }
      const file = join(outDir, `${String(idx).padStart(5, "0")}.json`);
      writeFileSync(file, JSON.stringify(rows, null, 1));
      logLedger({ ts: new Date().toISOString(), corpus: CORPUS, tag: TAG, batch: idx,
        status: problems.length ? "ok_with_warnings" : "ok", keys: rows.map((r) => r.entity_key),
        warnings: problems.slice(0, 20), file: file.replace(ROOT + "/", ""), model: MODEL });
      okCount += rows.length;
      return problems.length;
    } catch (e) {
      if (String(e.message) === "STOP") throw e;
      if (attempt === 3) {
        failCount += batch.length;
        logLedger({ ts: new Date().toISOString(), corpus: CORPUS, tag: TAG, batch: idx,
          status: "fail", keys: [], error: String(e.message).slice(0, 300) });
        console.error(`  batch ${idx} FAILED: ${String(e.message).slice(0, 160)}`);
        return -1;
      }
      retryNote = `직전 응답이 형식을 어겼다(${String(e.message).slice(0, 120)}). 반드시 JSON 하나만 출력하라.\n\n`;
    }
  }
}

const queue = batches.map((b, i) => ({ b, i }));
async function worker() {
  while (queue.length) {
    if (existsSync(STOP)) { console.log("STOP file present — halting"); return; }
    const { b, i } = queue.shift();
    const w = await runBatch(b, i).catch((e) => { if (String(e.message) === "STOP") return -2; throw e; });
    bi++;
    const pct = ((bi / batches.length) * 100).toFixed(0);
    const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.log(`[${bi}/${batches.length} ${pct}%] batch ${i} ${w === 0 ? "clean" : w > 0 ? `${w} warn` : "FAIL"} · ok=${okCount} · out=${(outTok / 1000).toFixed(0)}k tok · ${mins}m`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

console.log(`\n== ${CORPUS} done: ${okCount} translated, ${failCount} failed`);
console.log(`   output tokens ${outTok.toLocaleString()} · cache reads ${cacheR.toLocaleString()}`);
console.log(`   files: ${outDir}`);
