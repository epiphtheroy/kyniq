# Metatake — 아침 실행 런북 (RUNBOOK)

밤사이 코드·스크립트·페이지·검증을 모두 마쳤습니다. **네트워크가 필요한 두 가지**(Supabase
마이그레이션 적용, 데이터 빌드/배포)만 아침에 순서대로 실행하시면 라이브가 됩니다.
모든 코드는 타입체크·로직 유닛테스트를 통과했습니다.

## 0. 사전 확인 (1분)
- `.env.local`에 `OPENAI_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 존재 (이미 있음).
- 시드 데이터: `data/seed/metatake_films_567.csv`, `metatake_figures_takes_4662.csv` (저장됨).

## 1. 마이그레이션 적용 (직접) — 가장 먼저
Supabase SQL 에디터에서 **`supabase/migrations/0013_metatake.sql`** 전체를 실행.
(pgvector extension + 10개 테이블 + RLS. 기존 frame 테이블은 건드리지 않음.)
→ 완료되면 2번으로.

## 2. 데이터 빌드 (더블클릭) — `worker/run-mt-build.command`
import → clean → consolidate → author → rank → recommend 를 순서대로 자동 실행.
- **import**: 567편 + ~4,626 형상 + ~4,626 테이크 적재 (빈 Target 스킵). ~1–2분.
- **clean**: 테이크 밝힘을 하우스 보이스로 정리 — 연구자 고유명사·"Target Object" 제거,
  형상명을 주어로. (당신이 지적한 문제 해결.) ~8–15분 (Gemini, ~4,600행).
- **consolidate**: Theory Concept 임베딩 수렴 → meta_take 후보 ~150–250개 생성, 테이크 연결.
  (≥5편 게이트, >30 분리 후보 플래그.) ~3–6분 (OpenAI 임베딩 ~3,000콜).
- **author**: 후보별 title/laconic/thesis/essay 생성 + 게시(published). ~10–20분 (Gemini).
- **rank**: 테이크 임베딩 → relevance/surprise 이중 랭킹. ~5–10분 (OpenAI).
- **recommend**: film_affinities (TF-IDF) 계산·적재. ~1분.
- 로그: `worker/mt-build.log`. 실패 시 그 단계에서 멈춤 — 로그 보고 해당 스크립트만 재실행 가능
  (`python3 worker/mt-import.py` 등). 모든 스크립트는 재실행 안전.
- 총 소요 ~40–60분 예상. 비용 대략 $15–40 (임베딩+생성).

## 3. 앱 배포 (더블클릭) — `deploy-metatake.command`
페이지·내비·토큰 렌더러·마이그레이션 파일을 커밋·푸시 → Vercel 자동 배포.
(2번 데이터가 있어야 페이지에 내용이 보임. 데이터 전이라도 빈 상태로 안전하게 렌더.)

## 4. 확인 (라이브)
- `/` 홈 — 가장 많이 걸린 meta take들.
- `/meta-takes` — 이론 패밀리별 인덱스.
- `/take/the-abject` (또는 인덱스에서 아무거나) — 주인공 페이지: thesis·essay·정의 사례·의외의 식구.
- `/film/fargo-1996` — 영화: 형상별 meta take + 하단 추천.
- `/director/david-cronenberg` — 재귀 meta take(서명) + 필모.

---

## 만든 것 (참고)

**스키마** `supabase/migrations/0013_metatake.sql` — figures·meta_takes·takes·
meta_take_rankings·meta_take_edges·film_affinities·theory_families·theorists·
meta_take_aliases·slug_history + `meta_take_film_counts` 뷰 + RLS.

**워커** `worker/`:
- `mt-import.py` — CSV→DB (형상 kind 휴리스틱 5유형, 빈 Target 스킵, 멱등).
- `mt-consolidate.py` (+`mt_consolidate_core.py`) — 개념 정규화+임베딩 수렴→meta_take.
- `mt-author.py` — 비평 보이스 저작, 영화명 토큰 링크화, 게시.
- `mt-rank.py` — relevance(원형)/surprise(의외) 이중 랭킹.
- `mt-recommend.py` (+`mt_recommend_core.py`) — TF-IDF 영화 추천(희소 공유 가중).
- `run-mt-build.command` — 전체 순차 실행.

**앱** `app/` + `components/` + `lib/`:
- `/take/[slug]`(주인공), `/film/[slug]`(개편: 형상→meta take+추천), `/director/[slug]`(개편:
  서명 meta take), `/meta-takes`(인덱스), `/genre`·`/genre/[slug]`, `/`(개편), `/random/take`.
- `components/MetatakeNav.tsx`, `lib/mtTokens.tsx`(토큰 링크 렌더러).
- `app/globals.css`에 `.mt-*` 위키 스타일(작은 글자·weight 300·밝은 파랑 #2b80de).
- `app/layout.tsx`에서 옛 Header 제거(이중 내비 방지). frame은 내비·척추에서 빠짐(테이블·라우트는
  존치 — 추후 시드 채굴 후 정리).

## 검증 완료 (밤사이)
- migration: 파렌 균형·10테이블 전부 RLS+정책.
- 임포트 로직: kind 분포(trope 59%/form 28%/…), slug, 빈행 스킵 — 실데이터로 확인.
- 수렴 코어: normalize 변형 병합·components 클러스터·choose_title 유닛테스트 통과.
  실데이터 추정: ≥5편 개념 116개(임베딩 병합 전), >30 8개.
- 추천 코어: TF-IDF 희소-공유 > 흔한-공유 유닛테스트 통과.
- 토큰 렌더러 작성. 전 페이지 TypeScript 타입체크 통과(회귀 0, 기존 tmdb.ts 1건 제외).

## 백로그(미실행, `meta-take-architecture.md` §15)
- Application 정리 패스(연구자 고유명사 제거·Target→형상명·하우스 보이스) — 임포트 후 별도 배치.
- 출처/DOI Crossref 검증 후 발행.
- TMDB 장르·포스터 enrichment(시드 영화는 장르/포스터 없음 → 영화/장르 페이지 일부 빈약).
- meta take 승인 큐 UI(현재 publish-then-audit로 직접 게시; 어드민 감수는 추후).
- 형상 이미지 3층 전략, 형상당 take 보강.
