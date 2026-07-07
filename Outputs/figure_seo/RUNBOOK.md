# figure SEO 질문 레이어 — 실행 런북 (2026-07-06, 07-07 갱신)

## 갱신 (07-07): 2계층 전략으로 전환
배치 큐 적체(1차 배치 24h 0건 만료, 2차도 정체)로 규칙 계층을 신설:
- **1단계(적용됨)**: `lib/figureSeo.ts` `ruleFigureQuestion()` — 깨끗한 라벨(≤50자·마침표 없음·영화명 미포함·절 구조 없음, 전체의 57%=10,306건)은 렌더 타임에 질문형 title/H1 생성. DB·DDL·LLM 불요. 파일럿에서 깨끗한 라벨은 LLM 출력==템플릿 출력임을 확인.
- **2단계(대기)**: 지저분한 43%(7,862건)만 LLM 필요. 무료 배치가 완료되면 그 결과 사용(추가비용 0), 급하면 동기 ~$39. DB 반영은 DDL(0035) 적용 후. DB의 seo_question은 규칙보다 우선(폴백 체인: seo_question ?? ruleFigureQuestion ?? 기존).

목적: figure 18,168页의 title/H1을 내부 서술자(label)에서 검색 문형 질문으로 교체.
본문 콘텐츠 불변 — 생성물은 `seo_question`(질문)·`seo_short_label`(축약 표시명) 두 필드뿐.

## 파이프라인
1. `fetch_input.py` → figures_input.jsonl (approved 18,168 + film 제목/연도 + take 제목≤3)
2. `pilot_run.py` → 30건 동기(Opus 4.8). 결과: 30/30 QA 통과, 전량 비용 추정 $45
3. `batch_submit.py` → Message Batches (msgbatch_01Po5pu4uASY2CaNphc8TB4L). 가드: 추정 $80 초과 시 중단
4. `batch_poll.py` (백그라운드) → results.jsonl
5. `qa_and_write.py qa|retry|write|verify` → 기계 검수(물음표·길이 20–95·영화명 포함·스포일러 정규식·영화 내 중복) → 불합격분 동기 재생성 1회 → 합격분만 per-row PATCH(신규 컬럼만, 기존 데이터 무접촉) → 카운트 검증
6. 마이그레이션 `supabase/migrations/0035_figures_seo_fields.sql` — 적용 후에야 템플릿 배포 가능

## 순서 제약 (중요)
템플릿이 `seo_question`을 select하므로 **DDL 전에 app/ 수정 금지** (auto-deploy 워처가 즉시 배포 → 컬럼 부재로 figure 페이지 전체 오류).
순서: DDL → write → 템플릿 수정(auto-deploy) → 캐시버스터로 라이브 검증.

## DDL 적용 경로
- 1순위: claude.ai Supabase MCP `apply_migration` (과거 0001–0034 적용 경로). 현재 세션에서 연결 끊김 — 주기 재시도 중
- 차선: SUPABASE_DB_URL(psycopg2) — 사용자 제공 필요
- 검증: PostgREST로 `figures?select=seo_question&limit=1` 이 에러 없이 반환되면 적용된 것

## 설계 원칙 (07-07 확정, 원우 지시): 엔티티 불변, 질문은 부제
figure는 사이트 전역에서 호출되는 엔티티 → **시각적 제목(H1)·모든 상호참조·JSON-LD headline은 label(명사구) 유지**.
질문은 두 곳에만: ① HTML `<title>` 태그(SERP 전용, 페이지에 안 보임) ② 리드 부제 H2(fg-qh, FAQ 마크업과 일치).
LLM 생성 seo_question(2단계)도 같은 원칙으로 부제 위치에만 들어간다.

## 템플릿 수정 설계 (app/film/[slug]/figure/[figureSlug]/page.tsx)
- load(): figures select에 `seo_question, seo_short_label` 추가
- generateMetadata: title = seo_question ?? 기존 패턴 (루트 레이아웃이 "· Metatake" 접미)
- H1 = seo_question ?? label; 질문이 H1일 때 label을 서브라인으로 유지
- leadQuestion(FAQ + fg-qh H2) = seo_question ?? 기존 생성식; 질문이 H1이면 fg-qh H2 생략(중복 방지)
- 반복 헤딩(connection map·nearest)·breadcrumb 4번째 = seo_short_label ?? label
- film 페이지: figures select에 seo_question 추가, "Open →" 앵커를 질문 텍스트로 교체(있을 때만)
- 전부 NULL-안전 폴백 → 미생성 figure는 기존과 동일 렌더

## 비용
파일럿 실측 평균 in 770 / out 45 토큰 → 전량 배치 ~$45 (Opus 4.8 배치 단가 $2.5/$12.5 per MTok). 재생성 소량 추가. 상한 $100.
