# 인수인계: 관람 기록 통합 임포트 기능 (/me/import)

> 이 문서 하나만 읽고 작업을 이어받아 **끝까지 완성·검증**할 수 있도록 작성됨.
> 작성일 2026-07-03. 코드는 이미 대부분 구현되어 있고, 남은 일은 로컬 설치 → 빌드 확인 → 실제 브라우저 E2E 테스트 → 발견되는 버그 수정이다.

---

## ⭐ 진행 상황 (2026-07-03 밤 갱신 — 여기부터 읽을 것)

**프로덕션 라이브 완료.** §6의 1~3, 5는 끝났고 §7의 서버사이드 부분도 전부 검증됨. **남은 것은 §7의 "로그인된 브라우저 UI 클릭스루" 하나뿐이다.**

완료·검증된 것:
- **배포**: 임포트 코드는 17:45~17:52 auto-deploy로 푸시됐으나 package.json(jszip/xlsx/papaparse)이 워처 범위 밖이라 미커밋 → **Vercel 빌드가 한동안 깨져 있었음**. deps 커밋(`492bad2`)으로 복구, 현재 metatake.net에 `/me/import` + 3개 API 라이브 (401 가드·리다이렉트 동작 확인).
- **§6.2 tsc**: 신규 파일 오류 0건 (기존 ~21건은 무관, `next.config`가 `ignoreBuildErrors:true`라 빌드 영향 없음). **§6.3 eslint**: 0건.
- **파서 셀프테스트 26/26 통과** — `scripts/import-selftest.ts` (실행: `PATH="$HOME/.local/node/bin:$PATH" npx -y tsx scripts/import-selftest.ts`). §7의 A(왓챠 텍스트)·B(IMDb CSV)·C(한국어 CSV)·D(Gemini 실호출)를 함수 레벨에서 검증 + Letterboxd ZIP(diary/ratings/watched/reviews/watchlist 병합, note·tags·rewatch·watchlist 보존)까지 커버.
- **TMDB 매칭 경로 실검증**: 실제 키(v3, 32자 → `api_key` 파라미터 경로)로 한국어 검색 "기생충"→496243, `/find/tt6751668`→496243 확인.
- **인증 가드**: parse/match/commit/track 4개 모두 익명 요청 401.
- **§4 track 버그 수정** (status→seen/watchlist) 유지 확인.
- **DB(§3)**: `user_watch_log`(15컬럼)·`user_import_jobs`(6컬럼) + RLS 활성 확인. 기준선(2026-07-03): 두 테이블 모두 0행, user_movies 26행.
- **로컬 `next build` 통과**, 라우트 테이블에 4개 신규 경로 포함.
- **추가**: `/me` 대시보드 상단에 📥 "관람 기록 가져오기" 버튼 추가(`99f5c12`).

남은 것 (이어받는 사람이 할 일):
1. `thinkartist1@gmail.com`으로 **로그인된 브라우저**에서 §7 A~F 클릭스루 (metatake.net/me/import 또는 localhost:3000/me/import). ⚠️ **세션 자동 생성(admin generate_link)은 Claude Code 권한 분류기가 거부함** — 사용자가 직접 로그인해야 한다.
2. 커밋 후 §7-E DB 검증 쿼리로 메모 무손실 확인.
3. 발견 버그 수정 (파서·매칭 로직은 검증됐으므로 버그는 위저드 UI 상호작용 쪽일 가능성이 높음).

이 머신에서 로컬 실행 시 (알아두면 좋은 함정):
- node는 PATH에 없고 **`~/.local/node/bin`에 있음** (`export PATH="$HOME/.local/node/bin:$PATH"`).
- **`next dev`/`next build` 전에 낡은 `.next`를 지울 것** — dev 잔재 위 빌드는 `/film` 프리렌더가 ChunkLoadError로 깨진다 (코드 문제 아님).
- auto-deploy 워처 일시정지 = 리포 루트에 `.autodeploy-off` 생성, 재개 = 삭제. package.json 등 루트 파일은 워처가 커밋하지 않으므로 **의존성 추가 시 수동 커밋 필수** (이번 빌드 장애의 원인).

---

## 0. 한 줄 요약

metatake.net 사용자가 자신이 본 영화 기록을 **어떤 형태로든**(Letterboxd 내보내기 ZIP, IMDb CSV, 엑셀, 왓챠 백업, 아무 텍스트 붙여넣기) 던지면 자동으로 해독 → TMDB 매칭 → 검수 → DB 저장하는 기능. 페이지는 `/me/import`.

## 1. 프로젝트 기본 정보

- **리포 루트**: `~/Documents/MetaTake` (package.json의 name은 `filmcurio`)
- **스택**: Next.js 16 (App Router) + React 19 + Supabase + Vercel
- **Supabase 프로젝트**: `kyniq` — project ref `jvgarcqrtsmgfimdcwgo` (ap-northeast-1)
- **환경변수**: `.env.local`에 이미 전부 있음 — `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_READ_TOKEN`(v4 Bearer), `GEMINI_API_KEY` 등. **추가 설정 불필요.**
- **테스트 계정(사이트 소유자)**: `thinkartist1@gmail.com` — 이 계정으로 로그인해 테스트한다.
- **설계 문서**: `docs/IMPORT-watch-history-design.md` (배경·의도 상세판. 이 인수인계 문서와 충돌 시 이 문서가 우선)

## 2. 의도 — 반드시 지켜야 할 3원칙

1. **사용자 편의**: 사용자가 포맷을 고르지 않는다. 파일이든 텍스트든 넣으면 자동 감지.
2. **메모/리뷰 보존**: 원본에 리뷰·코멘트·태그가 있으면 반드시 가져와 `note`/`tags`로 저장.
3. **무손실(lossless)**: 스키마가 못 담는 것(재관람 각 회차, 원본 필드 전체)은 `user_watch_log.raw`(jsonb)에 원본 그대로 보관. 절대 버리지 않는다.

## 3. DB 상태 (⚠ 마이그레이션은 이미 원격에 적용됨 — 다시 실행하지 말 것)

기존 테이블:
- `films` — tmdb_id 기반. 미보유 영화는 lazy 생성(Tier-2: `visible=false, is_analyzed=false, slug='tmdb-{id}'`).
- `user_movies` — **PK (user_id, film_id)** = 영화당 1행("현재 상태"). 컬럼: `rating numeric`(CHECK: 0.5–5.0, 0.5 단위), `seen bool`, `watchlist bool`, `watched_at date`, `note text`, `visibility`('private'|'public').

2026-07-03에 추가 적용된 테이블 (마이그레이션명 `watch_history_import`):
- `user_import_jobs(id, user_id, source, filename, stats jsonb, created_at)` — 임포트 1회 = 1행, stats에 added/updated/logged/failed 누적.
- `user_watch_log(id, user_id, film_id FK films, tmdb_id, title_raw, year_raw, rating, watched_at, note, tags text[], rewatch, source, import_job_id FK, raw jsonb, created_at)` — 관람 1회 = 1행(재관람 포함), 무손실 로그.
- 둘 다 RLS 활성: 본인 행 select만 허용. **쓰기는 service role로만**(API 라우트가 담당).

## 4. 구현된 파일 (전부 신규, ✎표시는 기존 파일 수정)

| 경로 | 역할 |
|---|---|
| `lib/import/types.ts` | `NormalizedRow`, `ParseResult`, `MatchResult` 등 공용 타입 |
| `lib/import/normalize.ts` | 별점 척도 추론(5/10/100)→0.5–5 반올림·클램프, 날짜(`2023.1.2`, `2023년 1월 2일` 등)·년도 파싱, 제목 정규화 |
| `lib/import/sheet.ts` | CSV/XLSX 공용 매퍼. 한/영 헤더 동의어 사전(제목/별점/관람일/메모/감독/Const/tmdbID…), IMDb `Title Type` 필터(시리즈 제외), `Rating10` 처리 |
| `lib/import/parsers.ts` | 진입점 `parseFile(filename,buf)` / `parseText(text)`. ZIP(=Letterboxd 내보내기: diary+ratings+watched+reviews+watchlist 병합), XLSX(SheetJS), CSV(papaparse, 소스 자동판별), 왓챠식 텍스트 규칙 파서 `parseWatchaText` |
| `lib/import/llm.ts` | 규칙 파싱 실패분 LLM 폴백. 기존 `lib/providers/gemini.ts` 어댑터 재사용, `gemini-2.5-flash` JSON mode, 9천자 청크 |
| `lib/filmResolver.ts` | tmdb_id → films 행 resolve/lazy 생성(동시성 5). `/api/track`에서 추출한 공용 로직 |
| `app/api/import/parse/route.ts` | POST. multipart `file` 또는 JSON `{text}` → 포맷 감지 → rows. 텍스트 규칙 파싱 성과가 낮으면(유효 줄의 15% 미만) LLM 폴백 |
| `app/api/import/match/route.ts` | POST `{rows}`(≤25). ①tmdb_id 직결 ②imdb_id→TMDB `/find` ③로컬 films 제목+년도 선매치 ④TMDB `/search/movie`(한글이면 ko-KR). 결과: matched/ambiguous(후보 5)/none |
| `app/api/import/commit/route.ts` | POST `{job_id?, source, filename?, overwrite, rows}`(≤50). films resolve → `user_watch_log` insert(중복키 user+tmdb+watched_at+source는 스킵) → `user_movies` 집계 upsert → job stats 누적 |
| `components/ImportWizard.tsx` | 클라이언트 위저드: 입력(드롭존+텍스트영역) → 검수(매칭 테이블, 후보 select, 미매칭은 `/api/tmdb-search` 재활용 인라인 검색, 행 제외 체크, "덮어쓰기" 옵션) → 결과 요약. 배치 진행률 표시 |
| `app/me/import/page.tsx` | 서버 컴포넌트. 비로그인 → `/login?next=/me/import` 리다이렉트 |
| ✎ `app/me/page.tsx` | "＋ Add a film" 섹션에 `/me/import` 진입 링크 추가 |
| ✎ `app/api/track/route.ts` | **버그 수정**: 존재하지 않는 `status` 컬럼 upsert → `seen`/`watchlist` bool로 교체 + 에러 체크 추가. 이 수정을 되돌리지 말 것 |
| `package.json` | `jszip`, `xlsx`, `papaparse`, `@types/papaparse` 추가됨 |

## 5. 핵심 정책 (구현에 이미 반영 — 변경 시 신중히)

- **별점**: 항상 0.5–5.0, 0.5 단위로 정규화(DB CHECK가 강제). 척도는 배치의 최대값으로 추론(>10→100점제 /20, >5→10점제 /2). IMDb는 강제 10점제. `Rating10` 컬럼은 명시적 10점제.
- **재관람**: `user_movies`는 최신 관람일 기준으로 집계(최근 관람의 별점이 이김), 각 회차는 `user_watch_log`에 전부 남음.
- **기존 데이터 충돌**: 기본은 기존 값 보존(빈 곳만 채움). 검수 화면의 "덮어쓰기" 체크 시 가져온 값 우선. `seen=true`는 한 번 되면 유지.
- **왓치리스트**: Letterboxd watchlist.csv 행은 `to_watchlist=true` → `watchlist=true`로만 반영(seen 건드리지 않음).
- **인증**: 3개 API 모두 SSR 세션 필수(`lib/supabase/server`의 `createClient`), 쓰기는 본인 user_id로만.

## 6. 남은 작업 (이것을 순서대로 하라)

1. `cd ~/Documents/MetaTake && npm install` — 새 의존성 설치 마무리(이전 설치는 `--ignore-scripts`로 했음).
2. `npx tsc --noEmit` — **신규 파일(§4 목록)에 오류가 없는지만 확인.** 기존 코드에 이번 작업과 무관한 오류 ~25건이 원래 있음(admin 페이지, opengraph-image, lib/frameworks.ts 등). 그것까지 고치려 들지 말 것.
3. `npx eslint lib/import lib/filmResolver.ts components/ImportWizard.tsx app/api/import app/me/import` — 경고 정리.
4. `npm run dev` → 아래 §7 E2E 테스트 수행, 발견되는 버그 수정.
5. (선택) `npm run build` 통과 확인 후 배포.

## 7. E2E 테스트 시나리오 (사용자가 직접 볼 수 있어야 함)

`thinkartist1@gmail.com`으로 로그인 → `http://localhost:3000/me/import` 접속.

**A. 텍스트 붙여넣기(규칙 파서)** — 텍스트영역에 붙여넣고 "해독하기":
```
기생충
봉준호 · 2019
평가함 ★ 5.0

헤어질 결심 (2022) ★4.5

올드보이
2003 · 평가함 ★ 4.5
```
기대: 3행 인식, 전부 TMDB 매칭(기생충=496243), 검수→가져오기→요약 표시.

**B. IMDb CSV** — 아래 내용의 `ratings.csv` 파일 업로드:
```
Const,Your Rating,Date Rated,Title,Title Type,Year,Directors
tt6751668,9,2020-02-20,Parasite,movie,2019,Bong Joon Ho
tt0903747,10,2021-01-01,Breaking Bad,tvSeries,2008,
```
기대: Breaking Bad는 "영화 아님" 경고와 함께 제외, Parasite는 ★4.5로 변환, imdb_id로 확정 매칭.

**C. 한국어 엑셀식 CSV** —
```
영화명,별점,관람일,메모
버닝,8,2018.05.20,이창동 최고작
아가씨,9,2016-06-10,
```
기대: 10점제 감지 경고, 버닝 ★4.0 + 메모 보존.

**D. 자유 텍스트(LLM 폴백)** — 문장형 텍스트("작년 겨울에 매그놀리아를 다시 봤는데 여전히 5점 만점…" 같은 서술)를 붙여넣어 `freeform_llm` 소스로 해석되는지. `GEMINI_API_KEY` 필요.

**E. DB 검증** — Supabase(kyniq)에서:
```sql
select title_raw, rating, watched_at, note, source from user_watch_log order by created_at desc limit 10;
select f.title, um.rating, um.watched_at, um.note, um.seen from user_movies um join films f on f.id=um.film_id order by um.added_at desc limit 10;
select source, stats from user_import_jobs order by created_at desc limit 5;
```
확인: log에 원본이 남고, user_movies에 집계가 반영되고, **메모가 유실되지 않았는지**.

**F. 회귀 테스트** — `/me`의 단건 추가(MovieSearchAdd)로 아무 영화나 "✓ Seen" 추가 → user_movies에 `seen=true` 행이 생기는지(track 버그 수정 검증).

## 8. 알려진 주의사항

- **Vercel 함수 시간**: parse/match/commit에 `maxDuration=60` 지정돼 있음. Hobby 플랜이면 60초 상한 확인.
- **TMDB 레이트리밋**: match는 동시성 5로 제한. 수천 행도 클라이언트가 25행씩 나눠 보내므로 안전.
- **파일 상한**: parse는 8MB 제한. Letterboxd ZIP은 보통 수백 KB.
- **match의 로컬 선매치**는 제목에서 쉼표/따옴표를 제거해 or() 쿼리를 만들므로 "Paris, Texas" 같은 제목은 로컬 매치를 건너뛰고 TMDB로 감 — 정상 동작이며 버그 아님.
- 이미 지웠거나 바꾼 파서 동작을 검증하고 싶으면: 파서는 순수 함수라 `tsx`로 단독 실행 테스트 가능(`parseText`/`parseFile`은 Supabase 불필요).
- 완성 후 남는 개선 아이디어(백로그): 임포트 이력 화면(user_import_jobs 목록), 실행 취소(job_id 단위 삭제), `/u/[username]` 공개 프로필 반영, 왓챠 CSV 공식 포맷 대응 강화.
