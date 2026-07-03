/* Standalone parser self-test for the /me/import pipeline (HANDOFF §7 A–D).
 * Run: npx tsx scripts/import-selftest.ts   (pure functions — no Supabase needed;
 * scenario D calls Gemini and needs GEMINI_API_KEY in the environment). */

import JSZip from "jszip";
import { parseText, parseFile } from "../lib/import/parsers";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
}

async function scenarioA() {
  console.log("\nA. 왓챠식 텍스트(규칙 파서)");
  const r = await parseText(`기생충
봉준호 · 2019
평가함 ★ 5.0

헤어질 결심 (2022) ★4.5

올드보이
2003 · 평가함 ★ 4.5`);
  check("source=watcha_text", r.source === "watcha_text", r.source);
  check("3행 인식", r.rows.length === 3, r.rows.map((x) => x.title));
  const [a, b, c] = r.rows;
  check("기생충 2019 ★5", a?.title === "기생충" && a?.year === 2019 && a?.rating === 5, a);
  check("헤어질 결심 2022 ★4.5", b?.title === "헤어질 결심" && b?.year === 2022 && b?.rating === 4.5, b);
  check("올드보이 2003 ★4.5", c?.title === "올드보이" && c?.year === 2003 && c?.rating === 4.5, c);
}

async function scenarioB() {
  console.log("\nB. IMDb ratings.csv");
  const csv = `Const,Your Rating,Date Rated,Title,Title Type,Year,Directors
tt6751668,9,2020-02-20,Parasite,movie,2019,Bong Joon Ho
tt0903747,10,2021-01-01,Breaking Bad,tvSeries,2008,`;
  const r = await parseFile("ratings.csv", Buffer.from(csv));
  check("source=imdb_csv", r.source === "imdb_csv", r.source);
  check("시리즈 제외 → 1행", r.rows.length === 1, r.rows.map((x) => x.title));
  check("시리즈 제외 경고", r.warnings.some((w) => w.includes("건너뛰")), r.warnings);
  const p = r.rows[0];
  check("Parasite ★4.5 (9/10)", p?.title === "Parasite" && p?.rating === 4.5, p);
  check("imdb_id 전달", p?.imdb_id === "tt6751668", p?.imdb_id);
  check("관람일 2020-02-20", p?.watched_at === "2020-02-20", p?.watched_at);
}

async function scenarioC() {
  console.log("\nC. 한국어 엑셀식 CSV");
  const csv = `영화명,별점,관람일,메모
버닝,8,2018.05.20,이창동 최고작
아가씨,9,2016-06-10,`;
  const r = await parseFile("watch.csv", Buffer.from(csv));
  check("source=sheet", r.source === "sheet", r.source);
  check("10점제 감지 경고", r.warnings.some((w) => w.includes("10점")), r.warnings);
  const [b, a] = r.rows;
  check("버닝 ★4.0 + 메모", b?.title === "버닝" && b?.rating === 4 && b?.note === "이창동 최고작", b);
  check("버닝 관람일 2018-05-20", b?.watched_at === "2018-05-20", b?.watched_at);
  check("아가씨 ★4.5", a?.title === "아가씨" && a?.rating === 4.5, a);
}

async function scenarioZip() {
  console.log("\nZ. Letterboxd 내보내기 ZIP");
  const zip = new JSZip();
  zip.file("diary.csv", `Date,Name,Year,Rating,Rewatch,Tags,Watched Date
2024-01-05,Parasite,2019,5,No,"korean, thriller",2024-01-04
2024-02-01,Oldboy,2003,4.5,Yes,,2024-01-31`);
  zip.file("ratings.csv", `Date,Name,Year,Rating
2024-01-05,Parasite,2019,5`);
  zip.file("watched.csv", `Date,Name,Year
2023-12-01,Burning,2018`);
  zip.file("reviews.csv", `Date,Name,Year,Rating,Review,Watched Date
2024-01-05,Parasite,2019,5,계단의 영화,2024-01-04`);
  zip.file("watchlist.csv", `Date,Name,Year
2024-03-01,Decision to Leave,2022`);
  const buf = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
  const r = await parseFile("letterboxd-export.zip", buf);
  check("source=letterboxd_zip", r.source === "letterboxd_zip", r.source);
  check("4행(diary2+watched1+watchlist1)", r.rows.length === 4, r.rows.map((x) => x.title));
  const par = r.rows.find((x) => x.title === "Parasite");
  check("리뷰 → note 보존", par?.note === "계단의 영화", par?.note);
  check("태그 보존", JSON.stringify(par?.tags) === JSON.stringify(["korean", "thriller"]), par?.tags);
  const old = r.rows.find((x) => x.title === "Oldboy");
  check("재관람 플래그", old?.rewatch === true, old);
  const dtl = r.rows.find((x) => x.title === "Decision to Leave");
  check("왓치리스트 플래그", dtl?.to_watchlist === true, dtl);
  const burn = r.rows.find((x) => x.title === "Burning");
  check("watched-only 포함", !!burn, r.rows.map((x) => x.title));
}

async function scenarioD() {
  if (!process.env.GEMINI_API_KEY) { console.log("\nD. LLM 폴백 — GEMINI_API_KEY 없음, 건너뜀"); return; }
  console.log("\nD. 자유 텍스트(LLM 폴백)");
  const { parseWithLlm } = await import("../lib/import/llm");
  const r = await parseWithLlm(
    "작년 겨울에 매그놀리아를 다시 봤는데 여전히 5점 만점이었다. 그리고 2023년 3월쯤 라라랜드는 3.5점 정도. 헤어질 결심은 두 번 봤는데 처음엔 4점, 다시 보니 4.5점."
  );
  check("source=freeform_llm", r.source === "freeform_llm", r.source);
  check("2행 이상 추출", r.rows.length >= 2, r.rows.map((x) => `${x.title}:${x.rating}`));
  const mag = r.rows.find((x) => /매그놀리아|magnolia/i.test(x.title));
  check("매그놀리아 ★5", mag?.rating === 5, mag);
}

(async () => {
  await scenarioA();
  await scenarioB();
  await scenarioC();
  await scenarioZip();
  await scenarioD();
  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
