# FilmCurio / Metatake — MASTER 총정리 (2026-06-14)

> **이 문서가 최상위 진입점이다.** 로직 · 디자인 · 링크구조 · 프롬프트/프로그램 · **배치 런북**을 한 곳에
> 모은다. 깊은 세부는 도메인 권위 문서를 가리킨다(§7 문서 지도). 배치는 잘못 돌리면 DB가 오염되어
> 복구가 어렵다 — **§4 런북의 안전 규칙을 반드시 지킬 것.**

---

## 0. 현재 상태 & 시작점 (혼동 금지)

- **1차 배치 = 567편**(`data/seed/metatake_films_567.csv`, 사용자가 제시한 ~500여 편). **"1,000편"은
  최종 목표**일 뿐, 지금 작업은 567편이다. 567편 너머는 *추출* 파이프라인(별도, 미구현).
- **이미 완료(라이브):** 567편 import → clean → consolidate(허브 ~116–150) → author → rank →
  recommend → 배포. 영화 페이지·take(메타테이크) 페이지 존재. **단, 형상은 아직 "목록 항목"이고 take는
  형상당 1개.**
- **이번 작업(미완):** ① migration 0014 ② **형상 보강 v2 배치**(형상당 ≥3 레지스터 take) ③ 통합/저작/
  랭킹 재실행 ④ **형상 독립 페이지 + 기여 UI** ⑤ 임베딩/인덱스 ⑥ 배포.

---

## 1. 로직 총정리 (데이터 모델 + 파이프라인)

**엔티티 4층:** `film → figure → take → meta-take`
- **figure(형상):** 작품에 고정된 구체적·관찰 가능한 요소(인물·사물·촬영지·트로프·형식 = kind 5종).
  묘사는 **영화적으로 구체적·건조**(화면에 실제 보이는 것만).
- **take(밝힘):** 한 형상에 다는 비평적 읽기 하나. **근거(화면) 필수.** 형상당 ≥3.
- **meta-take(허브):** take가 여러 영화의 형상을 끌어모으는 연결 개념 = 사이트의 주인공(고유 페이지).
  그레인 5~30편, ≥5 발행, >30 분리.

**비평 레지스터 2층 (핵심 — 다양성·반복편향 방지):**
- 상위 10 레지스터(인덱스·분산 강제): 형식 · 기호 · 정신분석 · 이데올로기 · 정치경제 · 철학 ·
  실존 · 신화 · 영화사계보 · 수용비평사. + 하위 자유 sub-angle(사용자의 30 prompt 흡수).
- **레지스터 = 들어가는 길(다양) / 메타테이크 = 도착지(수렴).** 길을 다양화해도 도착지가 공유되어
  그래프가 안 흩어진다. 형상당 take는 **레지스터 ≥3 distinct + 메타테이크 ≥3 distinct.**

**수렴(허브 생성)이 작동하는 이유:** ① 생성 시 **전체 허브 목록 주입 → ref 우선**(write-time 수렴)
② 임베딩 dedup(≥0.86) ③ ≥5편 게이트로 노이즈 제거 ④ 증분 match-first. → 567편이어도 허브는
**수백 개로 수렴**(시드 2,559 고아 → ~150 전례). 자세한 스케일/비용: `figure-page-KEPT.md §G`.

**임베딩 3축(미리 계산):** figure=`description`(표면) · take=`rationale`(의미) · meta=`essay+thesis`(개념).
용도: 랭킹(relevance/surprise) · 증분 매칭 · dedup · soft edges · 검색. 비용 ~$0.23 1회성. 세부: `KEPT §H`.

**모더레이션:** AI = "발행 후 감사"(content_events). 사용자 기여 = 선검수 권장(M1 미정).

---

## 2. 디자인 총정리 (페이지 + 링크구조)

**페이지 타입** (모두 `.mt-*` 디자인 시스템 공유):
- `/film/[slug]` — 영화. film_features 프리뷰 + **형상 목록**(유형별) + 추천.
- **`/film/[slug]/figure/[fig-slug]` — 형상 (NEW, 1급 페이지).** label(h1) + kind/영화 info +
  **영화적 묘사** + **Readings**(take 카드: 레지스터 배지 + 메타테이크 링크 + 해석문 전문) +
  **Kin**(같은 읽기의 다른 형상) + **기여 CTA**.
- `/take/[slug]` — 메타테이크 허브(주인공). 제목+laconic+thesis+에세이 + Defining cases/Unexpected kin
  + Compare/Contrast.
- `/director/[slug]`, `/genre/[…]` — 인덱스.

**★ 링크 구조 (갱신 — 이제 형상이 하이퍼링크로 연결됨):**
- **이전:** 영화 페이지에서 형상은 *plain text*, 메타테이크 제목만 링크였다.
- **지금:** 영화 페이지의 **형상 label → 형상 페이지**(하이퍼링크). 형상 페이지의 **각 take 카드 →
  그 메타테이크 페이지**. 메타테이크 페이지의 **Examples 형상명 → 형상 페이지**(업그레이드, M6).
  형상 페이지 **Kin → 다른 형상 페이지**. = 영화↔형상↔메타테이크 **3자 양방향 그물**.
- **토큰 시스템(store IDs, resolve at render):** 본문 인라인 참조는 `{{film:slug}}` / `{{meta_take:slug}}`
  / `{{figure:…}}`. 현 `lib/mtTokens.tsx`는 film·meta_take만 지원 → **figure 토큰 추가 필요**(§3).
- **slug 안정성:** 메타테이크·영화·감독·**형상**(영화 내 유일) 슬러그. 개명/병합 시 `slug_history` → 301.
  형상 슬러그는 `(film_id, slug)` 유일.
- **redlink 0:** 존재하지 않는 ref는 워커가 new 후보로 전환(figure-enrich), 토큰은 미해소 시 plain text.

**기여(Contribution) 레이어** (로그인): 형상에 take 추가(**메타테이크 선택 필수** + 레지스터),
영화 아래 형상 추가, 새 메타테이크 제안(→ candidate). 세부·스키마·모더레이션: `figure-page-design.md §7`.

---

## 3. 프롬프트 & 프로그램 총정리

**worker 스크립트 (단계 → 모델/도구):**

| 스크립트 | 역할 | 모델/도구 | 상태 |
|---|---|---|---|
| `mt-import.py` | 시드 CSV → film/figure/take | — | ✅ 완료 |
| `mt-clean.py` | take 보이스 정리(시드) | Gemini 2.5-flash | ✅ 완료 |
| **`figure-enrich.py`** | **형상당 ≥3 레지스터 take 보강(영화당 1콜)** | **Gemini 3.1 Pro (`gemini-3.1-pro-preview`)** | ✅ v2 완성, 배치 대기 |
| `mt-consolidate.py` | 개념 클러스터 → 허브 후보 | OpenAI `text-embedding-3-small` + 로컬 | ⚠ v2 어댑테이션 필요(KEPT §G) |
| `mt-author.py` | 허브 title/laconic/thesis/essay | Gemini | ✅(재실행) |
| `mt-rank.py` | 이중 랭킹(relevance/surprise) | OpenAI 임베딩 | ✅(재실행) |
| `mt-recommend.py` | film_affinities 추천 | 로컬 TF-IDF | ✅(재실행) |

- **출력 계약(링치핀):** `figure-page-design.md §6.6` — `{film_intro, figures:[{figure_id, slug, description,
  register_fit, existing_take_register, new_takes:[{register, angle, evidence, rationale, metatake(ref|new),
  confidence}]}]}`. 추출·보강이 같은 모양을 뱉는다.
- **figure-enrich 안전장치:** 기본 DRY(번들 JSON, DB 미변경). `--persist` 시에만 적재. ref는 주입된
  허브 목록만 허용, 지어낸 ref는 new 후보로 자동 전환(take 안 버림). `need_enrich` 게이트로 이미 ≥3
  레지스터인 형상은 건너뜀(재실행 안전).
- **마이그레이션 0014** (`supabase/migrations/0014_figure_pages_contrib.sql`): figures.slug/author_id,
  takes.register/angle/author_id/status/source/upvotes, slug_history 'figure', take_votes, RLS, 뷰.

---

## 4. ★★★ 배치 런북 (567편) — 실수하면 망함. 순서대로, 게이트 통과 후 다음.

### 이행·공존 원칙 (old→new, 시드 한 톨도 안 버림)
현 라이브(형상=목록·take 1개·페이지 링크 없음)에서 신버전으로 가는 방식. **컷오버가 아니라 덧붙이기.**
- **시드 take 보존이 1순위.** 형상당 1 seed take는 *이론가·출처(Chicago/DOI) 메타데이터를 가진
  인용 기반 읽기* — 우리가 부족하다던 `reception`(근거 있는 비평) 자산이다. **삭제·대체 절대 안 함.**
  enrichment는 그 위에 *덧붙인다*(seed take 레지스터 분류 후 2개+ 추가). → "버리기 아깝다" 해결.
- **모든 형상에 페이지를 준다(링크 안 끊김).** take가 1개여도 페이지 존재(그 1개 + "첫 읽기를
  더하세요" CTA). → "figure 페이지 없이 갈까?" = 아니오, *추가*가 정답.
- **≥3은 목표지 강제 아님.** 얇은 형상은 억지 채우기보다 1~2개로 두고 **색인만 보류(noindex)**.
  AI enrichment + 사용자 기여로 자라면 색인. → "1개인 채로 둘까?" = 페이지는 주되 노출만 보류.
- **색인은 substance로 게이트:** ≥3 take → index. <3 → 페이지 존재하되 noindex(thin-content 회피).
- **빅뱅 컷오버 없음(additive·무중단):** 0014=컬럼 추가(기존 안 깨짐), enrichment=take 추가,
  figure 페이지=신규 라우트, 영화 페이지 label만 링크화. 라이브가 *부드럽게* 신버전이 됨.
- **보너스:** seed take 출처를 추후 Crossref 검증 → 인용 붙은 `reception` 앵커로 발행(차별점 완성).

### 안전 규칙 (절대 준수)
1. **항상 DRY 먼저.** `--persist`는 DRY 번들을 눈으로 검수한 뒤에만.
2. **스테이징(소량) 먼저.** 전체 적재 전 5~10편만 `--persist` → DB 확인 → 그다음 전체.
3. **롤백 가능하게.** 배치 직전 타임스탬프 기록. 보강 take = `source='ai'` + `register IS NOT NULL`.
   잘못되면 `DELETE FROM takes WHERE source='ai' AND register IS NOT NULL AND created_at > '<배치시작>'`.
4. **배치 전 DB 백업/스냅샷** (Supabase 대시보드 또는 `pg_dump`).
5. **멱등성 신뢰하되 검증.** 재실행은 이미 보강된 형상을 건너뛴다. 그래도 각 단계 후 카운트 확인.
6. **한 번에 한 단계.** 실패하면 그 단계만 재실행(전부 멱등).

### 시퀀스

**Phase 0 — 전제 점검.** `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`·
`GEMINI_API_KEY`·`OPENAI_API_KEY` 존재 확인. DB 백업. 현 카운트 기록(figures, takes, meta_takes).

**Phase 1 — migration 0014 적용.** Supabase SQL 에디터에서 `0014_figure_pages_contrib.sql` 실행.
검증: `figures.slug`, `takes.register/status/source`, `take_votes`, `slug_history` figure CHECK 존재.
실패 시: 멈춤(이후 전부 막힘).

**Phase 2 — 형상 보강 DRY (전 567편).** `run-figure-enrich.command`를 영화 필터 없이(또는 배치로
나눠) 돌리되 **--persist 없이**. 번들 JSON 검수 게이트:
- 형상당 레지스터 ≥3 distinct + 메타테이크 ≥3 distinct
- 모든 take 화면 근거 있음 / 본문 금지어 0
- ref 무결성(없는 ref → new 전환 카운트 확인)
- 레지스터 분산(특정 레지스터 쏠림 없음), 사실 오류 스폿체크
**게이트 불통과면 프롬프트 수정 후 재-DRY.** (지금까지 Forrest Gump·Power of the Dog 2편 통과.)

**Phase 3 — 보강 PERSIST 스테이징.** 먼저 `--film <한 편> --persist` (또는 `--limit 5 --persist`) →
DB에서 그 영화의 takes(register/source='ai')·figures.slug·시드 take register 채워졌는지 확인 →
롤백 쿼리 동작 확인 → **그다음 전체 567편 `--persist`**(배치, 야간 권장). 진행 로그 보관.
*주의: figure-enrich persist가 slug·seed-take register도 함께 백필한다(별도 단계 불필요).*

**Phase 4 — 통합(consolidate v2).** ⚠ 먼저 KEPT §G의 v2 어댑테이션(new 후보 dedup + ≥5 게이트) 적용.
`--dry`로 클러스터 분포 확인 → 실행 → 새 허브 후보 생성 + dedup. 검증: 허브 수가 폭증(수천)하지 않고
수백대로 수렴하는지.

**Phase 5 — 저작(author).** `mt-author.py` — 새 candidate 허브에 title/laconic/thesis/essay.
status candidate→published. 검증: 에세이 토큰 링크 정상, redlink 0.

**Phase 6 — 랭킹·추천.** `mt-rank.py`(이중 랭킹) → `mt-recommend.py`(film_affinities). 재실행.

**Phase 7 — 임베딩 & 인덱스.** take·meta 임베딩(rank가 처리) + **figure description 임베딩(신규 스텝)**.
**pgvector ANN 인덱스 생성**(없으면 유사도 쿼리 느림). 검증: 인덱스 존재.

**Phase 8 — 프런트엔드.** `lib/mtTokens.tsx` figure 토큰 추가 → `app/film/[slug]/figure/[figureSlug]/page.tsx`
구현 → 영화 페이지 형상 label 링크화 → 기여 UI(서버 액션 + 폼) → 검수 큐(`/admin/review` 복제).

**Phase 9 — 검증·색인·배포.** 형상 페이지 스폿체크, 단계적 색인(take<3 형상 noindex), Vercel 배포(ISR).

---

## 5. 정합성 점검 결과 (2026-06-14)

- **권위 문서:** 척추 = `meta-take-architecture.md`. 형상·기여·계약·런북 = 이 MASTER + `figure-page-design.md`
  (형상 관련 충돌 시 figure-page-design 최신 우선). 미해결·배치·스케일 = `figure-page-KEPT.md`.
- **해소된 충돌:** ① 형상 독립 페이지 아님 → **독립 페이지로 뒤집음**(arch §5.5/§13/백로그#2 취소선).
  ② 고정 5렌즈 → **레지스터 2층 모델**(기여 폼 포함 전부 통일). ③ ref 무결성(없는 ref → new).
  ④ Q&A UI 부활 아님 → 기여 메커니즘만 흡수.
- **시드 편수:** **567편(1차)**. 문서 곳곳의 "1,000편"은 최종 목표(레거시/장기). 혼동 주의.
- **모델:** 보강=Gemini 3.1 Pro(`gemini-3.1-pro-preview`); 임베딩=OpenAI text-embedding-3-small;
  저작=Gemini; 클러스터·추천=로컬.
- **남은 어댑테이션(블로커 아님, KEPT):** mt-consolidate v2화, components() numpy, figure 임베딩 스텝,
  figure 토큰 렌더러, reception 출처(Crossref), Verifier, 모더레이션 강도(M1).

---

## 6. KEPT 요약 (→ `figure-page-KEPT.md` 전체)
A 후속작업(통합·저작·랭킹·추천·Crossref) · B 셋업갭(slug·시드레지스터·linkify) · C 지금튜닝(reception) ·
D 약점(Verifier) · E 미해결결정(M1–M7) · F 인프라 · G 스케일/통합(번들 비용·numpy·16K·인덱스) ·
H 임베딩 전략.

## 7. 문서 지도
- **MASTER.md** (이 문서) — 진입점·총정리·런북.
- `meta-take-architecture.md` — 척추(엔티티·격상·파이프라인·결정 기록).
- `figure-page-design.md` — 형상 페이지·링크·기여·스키마·출력 계약(§6.6).
- `figure-page-KEPT.md` — 미해결·배치·스케일·임베딩 (최종 작업 체크리스트).
- `figure-meaning-plan.md` — 기저 메커니즘(레지스터·놀라움 점수). 용어 일부 구버전(의미=메타테이크).
- `00-INDEX.md` — 프로젝트 일반 인덱스/스택.
- 워커: `worker/figure-enrich.py`(+`run-figure-enrich.command`), `mt-*.py`, `supabase/migrations/0014_*.sql`.
