# HANDOFF — 컨텍스트 팩 실행 지침서 (Copy for AI → 팩 다운로드 → Creator Pass)

*2026-07-12 작성. **실행 에이전트용 정본 작업지시서** — 이 문서 하나로 대화 맥락 없이 W1을 구현할 수 있도록 작성됨. 배경·조사·전략은 `docs/HANDOFF-데이터사업-마스터.md`(최상위)와 `docs/PLAN-ai-context-packs.md`(상품 원안)에 있고, 본 문서는 그 둘을 **2026-07-12 오너 결정 + DB/코드 실측**으로 갱신한 실행 스펙이다. **원안과 충돌하는 내용은 본 문서가 우선한다** (§2에 충돌 목록 명시).*

---

## 0. 상태 한 줄 · 읽는 순서

**상태:** ✅ **W1 + Phase A(확장 비전) SHIPPED (2026-07-12, 라이브 검증 완료).** 다음 실행 대상은 Phase B(비-영화 엔티티로 Copy-for-AI 확장) 또는 결제(W2 Pass).

**Phase A(2026-07-12, 오너 확장 요구 반영) — SHIPPED:** 편재형 Copy-for-AI. ① 영화 탭바(FilmTabBar)의 팩-섹션 탭마다 "✦ AI" 소형 복사 버튼(그 섹션+영화신원 헤더, 무료·무로그인) ② 2중탭 하단 맨우측 "⭳ Download film" 컨트롤 → 섹션 선택 모달 → .md 파일(로그인+월10 신규영화, 재다운로드 무료) ③ `/room/packs` 라이브러리. **모델 재정의(오너 확정): 복사=전부 무료(공개 콘텐츠), 다운로드(파일)만 로그인+쿼터=편의 게이트.** 마이그 0086(pack_downloads+RLS)·0087(pack_download_claim 원자적 청구=경합안전+재다운로드 전기간 무료). 라이선스=CC BY-NC 4.0(무료 복사 정직 표기).

**W1에서 실제로 나간 것:** `film_context_pack(slug,tier)`+`film_context_pack_trim` RPC(마이그 0085, full=service_role 전용·trim=anon 경계 라이브 검증), `lib/pack.ts` 렌더러, `GET /api/pack/[slug]?tier=&fmt=`(trim만·full은 403·null은 404·X-Robots noindex), `components/CopyForAI.tsx`(Tier-1 히어로 df-share, visible=true 게이트), 기술부채 3건(tmp-sql CORS 제거·middleware /api/* 분리·backfill 하드닝). 5-렌즈 적대적 리뷰 통과(§12).

**읽는 순서:** 본 문서 전체 → (배경이 궁금할 때만) `docs/HANDOFF-데이터사업-마스터.md` → `docs/PLAN-ai-context-packs.md`. 코드 착수 전 §2(실측 정정)·§5(화이트리스트)·§10(금지)을 반드시 숙지.

**한 줄 요약:** 영화 페이지마다 "Copy for AI" 버튼(무료·무로그인, 트림판 마크다운 클립보드) → 로그인 후 풀팩 다운로드(월 10편 무료, .md/.json, 섹션 토글) → Creator Pass $9/월 무제한. 모든 파일에 출처 라인. 90일 클릭 데이터로 API 승격 판정.

---

## 1. 오너 결정 (2026-07-12 — 변경 불가)

| # | 결정 | 근거 요약 |
|---|---|---|
| 1 | **편당 $1 과금 폐기 → Creator Pass $9/월·$49/년** (단품·크레딧 없음) | 결제 수수료가 소액 결제의 33~55% 잠식(Stripe 3.6%+30¢, Polar 5%+50¢) + 편당 과금은 사용량 자체를 죽임. 단품 수요는 무료 트림판이 흡수 |
| 2 | **L0 복사 버튼 = 무료·무로그인** | 현 트래픽 주 ~140뷰 → 최대 병목은 보호가 아니라 배포. 복사본마다 박히는 출처 라인 = 배포 플라이휠, 클릭 로그 = 공짜 시장조사 |
| 3 | **풀팩 다운로드 = 로그인 + 월 10팩 무료(월 리셋) → 초과는 Pass** | 계정 확보 + 활성화 + 전환 퍼널. 평생 10이 아니라 **월 10** (재방문 유인) |
| 4 | **마이룸은 무료 유지.** 다운로드한 팩은 마이룸 "팩 라이브러리"(`/room/packs`)에 쌓임 | 마이룸은 리텐션 엔진 — 유료 뒤로 보내면 퍼널 중간이 끊김. 라이브러리가 폴더 보기/재다운로드 요구를 해결 |
| 5 | **구글드라이브 연동 보류** (OAuth 심사 부담 > 효용). 추후 확장은 MCP 서버가 우선 | 복사+다운로드+라이브러리로 95% 해결 |
| 6 | 파일 품질 = 최우선 (오너: "사용자가 만족해야 합니다") — §4의 품질 스펙이 계약 | 팩은 코퍼스를 알몸으로 보여주는 상품 |

단계 매핑: **W1**(이번 실행: RPC+복사 버튼+로깅+기술부채) → **W1.5**(다운로드+쿼터+토글+라이브러리) → **W2**(Polar 결제+/data 스토어+지문) → **W3**(번들+런치). W1만으로도 수요 데이터가 쌓이기 시작한다.

---

## 2. 실측 정정 — 07-03 문서와 다른 점 (⚠️ 실행 전 필독)

2026-07-12 라이브 DB(`jvgarcqrtsmgfimdcwgo`)·코드 실측 결과. **아래 항목은 원안 문서의 해당 서술을 무효화한다.**

1. **좌표는 v1 팩에 전면 금지.** 원안은 "`geo_cache.source='nominatim'`만 포함"이었으나 **실측: geo_cache 19,549행 전부 `source='google'`, nominatim 0행.** Google ToS상 재배포 불가 → **팩에 lat/lng를 절대 넣지 않는다.** 촬영지는 지명·국가·layer·`scene_role`/`narrative_setting` 산문만(전부 자체 생성 class-A). Nominatim 재지오코딩 백필은 별도 태스크(§11 부록) — 완료 전까지 좌표 금지.
2. **클릭 로깅은 `mt_events`.** 원안의 "content_events 재사용"은 무효 — `content_events`는 관리자/파이프라인 감사 로그(RLS admin 전용)다. UI 클릭은 기존 비콘 `mtEvent()`(`components/mtTrack.ts:13-36`) → `POST /api/metrics` → `mt_events` 하나뿐이며 `/admin/metrics`에 자동 표출된다. 신규 인프라 0.
3. **코퍼스 규모:** 발행 takes **27,028** / 심층(Tier-1) 영화 **1,938편**(`is_analyzed=true AND visible=true`인 1,939편 중 takes 보유 1,938) / **편당 평균 14 takes**(최대 ~16, rationale 평균 472자). 원안의 "대표 8–12개 샘플링"은 사실상 전체의 70~85%다 — 트림판 가치는 충분하고, 풀판의 차별화는 takes 수가 아니라 **figures 설명·촬영지 산문·전체 계보·kindred·트로프 정의**에 있다.
4. **조인 경로:** 영화의 takes = `takes t JOIN figures g ON g.id=t.figure_id WHERE g.film_id=?`. 트로프 링크는 **`takes.trope_id`**(19,601행) — `takes.meta_take_id`는 0행(죽은 컬럼). `figures.status='approved'`(published 아님), `takes.status IN ('published','retired')` — **published만 사용**. `figures.spoiler_level`은 전부 null(스포일러 가드는 v1 무시 가능). `takes.strength`는 null 0행(정렬 키로 안전).
5. **슬러그 형식 = `title-year`** (예: `in-the-mood-for-love-2000`). 테스트 픽스처는 이 슬러그를 쓸 것 (takes 14·locations 8·lineage 5+·affinities 4+ 실측 확인됨).
6. **마이그레이션 번호는 0085.** 번호가 3개 디렉터리에 분산·충돌 중: `supabase/migrations/`(0001–0077, 0081–0084=factory), `worker/`(0074–0081, 0078=bot sentinel·0081=crawler handshake), `radar/`(0083–0084). **전 디렉터리 통틀어 최고 번호 0084 → 신규는 `supabase/migrations/0085_film_context_pack.sql`** (정본 디렉터리 = supabase/migrations/).
7. **DB 엣지가 곧 유료 경계다.** 이 사이트는 anon key + SECURITY DEFINER RPC 구조라, **anon에게 GRANT된 RPC는 사이트를 거치지 않고 PostgREST로 직접 호출 가능**하다. 풀팩 RPC를 anon/authenticated에 GRANT하면 유료 경계가 즉시 무력화된다. → §6.1의 GRANT 설계(트림=anon 허용 / 풀=service_role 전용 + PUBLIC 기본 EXECUTE **명시적 REVOKE**)를 정확히 따를 것.
8. **`/api/films/backfill`은 클라이언트가 직접 호출한다** (`app/ask-ai/new/page.tsx:79`의 브라우저 fetch). 따라서 시크릿 헤더 게이트는 **불가**(ask 기능이 부서짐) — §6.5의 오리진 체크+레이트리밋 설계로 갈 것.
9. **middleware의 admin 게이트는 `/api/admin/*`을 애초에 보호하지 않는다** (`pathname.startsWith("/admin")` 매치라 `/api/admin`은 불일치, `middleware.ts:141`). `/api/admin/*` 라우트 5종(films·flags·members·pipeline·review)은 자체 인증에 의존 중 — §6.5의 early-return에서 `/api/admin`을 제외하면 기존 동작이 1도 안 바뀐다.
10. **API 라우트 캐시 관례 = CDN 헤더** (`unstable_cache` 아님). 표본: `app/api/tv/reel/route.ts` — 인라인 anon 클라이언트 + `export const dynamic = "force-dynamic"` + 응답에 `cache-control: public, s-maxage=..., stale-while-revalidate=...`.
11. `film_scores`에 `track` 컬럼이 있다(영화당 복수 행 가능성) — 구현 시 `select track, count(*) from film_scores group by 1`로 정본 트랙을 확인하고 1행만 뽑을 것.

---

## 3. 상품 구조 (확정판)

| 티어 | 무엇 | 게이트 | 가격 | 단계 |
|---|---|---|---|---|
| **L0 Copy for AI** | 트림판 마크다운 클립보드 복사 (~8–15KB): 신원+TakeScore+정전/수상 상위+대표 리딩 10+피겨 라벨+kindred 8+열린 질문 | 없음 (무로그인) | 무료, CC BY-NC 4.0+출처 라인 | **W1** |
| **L1 Film Pack** | 풀판 .md+.json (30–100KB): 전체 리딩+figures 설명+촬영지 산문+전체 계보+kindred 24+트로프 정의. **섹션 토글**(넣고 빼기) | 로그인, **월 10팩 무료** | 무료 쿼터 초과 시 Pass | W1.5 |
| **Creator Pass** | 전 영화 풀팩 무제한(일 50팩 캡) + 상업 이용 허락(Creator License) | 로그인+결제 | **$9/월 · $49/년** (Polar.sh) | W2 |
| **L2 번들** | 감독 팩·프레임워크 팩·canon 팩·촬영지 팩 | 결제 | $19–79/개 | W3 |
| **L3 Corpus** | 분기 버전드 전체 덤프 + 내부 RAG/제품 이용권 | 계약 | $299–999+/년 | W3+ |

대상 영화: **Tier-1 1,938편만** (`is_analyzed=true AND visible=true` + published takes 존재). Tier-2(씬 카탈로그 4,743+274편)에는 버튼을 달지 않는다(넣을 해석이 없음).

---

## 4. 파일 품질 스펙 (제품의 심장 — 오너 최우선 요구)

### 4.0 품질 원칙 (계약)

1. **하나의 마크다운 파일이 사람이 읽어도 좋고 LLM이 먹어도 좋아야 한다.** frontmatter 없이 본문 헤더 구조만으로 성립(트림판). HTML 태그 0, 내부 전용 은어 0(figure kind 같은 어휘는 자체 설명 라인 제공).
2. **파일이 스스로를 설명한다** — "How to use this file" 섹션 내장, TakeScore 차원 글로서리 1줄, 프레임워크명은 그대로 노출(그게 상품의 개성).
3. **출처·라이선스 라인이 맨 앞과 맨 뒤에 반드시** 들어간다(복사 후 일부만 붙여넣어도 한쪽은 살아남게).
4. **프로비넌스 정면 돌파**: 맨 끝에 "AI-generated criticism, human-curated" + methodology 링크 1줄. 숨기면 스캔들, 밝히면 방법론.
5. **빈 섹션은 렌더하지 않는다** (데이터 없는 섹션 헤더만 남는 것 금지). 수치는 반올림 1자리, null은 표기 생략.
6. **LLM 호출 0** — 팩 조립은 순수 DB→템플릿. 사이트 불변식과 동일.

### 4.1 트림판(L0) 템플릿 — 이대로 구현

아래 `{...}`는 데이터 치환 변수. 실측 검증된 픽스처(`in-the-mood-for-love-2000`)로 그대로 생성해 볼 것.

```markdown
Source: Metatake — https://metatake.net/film/{slug} · License: CC BY-NC 4.0 (attribution required) · Full pack: https://metatake.net/data

# {Title} ({year}) — Metatake Context Pack

Directed by {director}{original_title가 title과 다르면 · "Original title: {original_title}"} · IDs: imdb {imdb_id} · wikidata {wikidata_id} · tmdb {tmdb_id} · metatake {slug}
Pack: trim · generated {YYYY-MM-DD} · {N} of {total} readings included — the full pack adds every reading plus figures, filming locations, complete honors, and kindred-film data.

## How to use this file
Attach this file to Claude Projects, a Custom GPT, NotebookLM, Gemini Gems, or any AI assistant, and write on top of it.
These readings are deliberate "strong misreadings": each one pushes a single critical framework (PSYCHOANALYTIC, SIGNIFIER→SIGNIFIED, ETHICO-POLITICAL, ...) as far as the film allows. They are interpretive positions, not plot summary and not consensus. Ask your AI to argue with them, combine them, or extend one into your own essay.

## TakeScore — Metatake's 13-dimension critical scoring
Value {v_value} · Cost {c_cost} · Risk {r_risk}
{13개 서브차원 — 차원당 "코드 라벨 — 짧은 영문 설명: 점수" 1줄. ⚠️ 라벨/설명 문안은 새로 짓지 말고 /takescore 표면 코드의 기존 글로서리를 재사용할 것 (app/takescore/ 하위 + lib에서 cog/aff/form/moral/dur/itx/fr/etx/ctx/bank/insincere/coward/polar 라벨 사전을 찾아 import). 스케일·해설 링크: https://metatake.net/methodology}

## Standing & honors
Prestige {prestige_score} · Discovery {discovery_score} (Metatake canon-standing model)
- {lineage_lists.label} — {result}{rank 있으면 " #"+rank}   ← 상위 8줄 (facet canon·award 우선, authority_weight desc)

## Readings ({N} of {total} — one per framework)
### {FRAMEWORK} — "{take_title}"
*Theorist: {theorist_name} · Concept: {concept} · On: {figure_label} ({figure_kind})*
{rationale 전문}

(...프레임워크당 1개, INVITATION 제외 최대 10개, strength desc 순...)

## Motifs & figures in this film
{kind별 그룹, 라벨만: "character: X · Y / object: Z / location: ..." — 설명문은 풀팩에}

## Kindred films
- {title} ({year}) — {shared_threads} shared interpretive threads
(...affinity score desc 상위 8...)

## An open question
{framework='INVITATION' take의 rationale — 이 코퍼스의 형식 서명인 "열린 질문 종지". 없으면 섹션 생략}

---
Source: Metatake — https://metatake.net/film/{slug} · CC BY-NC 4.0 · Full pack & bundles: https://metatake.net/data
This pack is AI-generated criticism with human curation. Method: https://metatake.net/methodology
```

크기 검산: 리딩 10×~550자 + 나머지 ≈ 8–13KB ✓ (목표 8–15KB).

### 4.2 풀판(L1, W1.5) 추가분

트림판 대비: ① Readings 전체(INVITATION 포함 ~14–16개, 트림과 같은 포맷) ② **Figures** 섹션 — 라벨+kind+`description` 전문(편당 ~9개) ③ **Filming locations & settings** — `name · [layer] · country` + `narrative_setting`/`scene_role` 산문, **좌표 없음**(§2-1) + 각주 1줄 "Coordinates are not included in packs; the interactive map lives at metatake.net/film/{slug}/locations" ④ Honors 전체(8줄 캡 해제) ⑤ Kindred 24 ⑥ **Tropes in play** — 이 영화 takes가 가리키는 트로프(`takes.trope_id`→`meta_takes` kind='figure_type' status='published')의 `title+laconic+thesis`(essay 전문은 제외 — L2 번들 상품) ⑦ frontmatter(YAML: ids·takescore·license·pack_id 지문·generated) ⑧ 동명 `.json` 동봉.

### 4.3 JSON 스키마 (fmt=json)

RPC가 반환하는 jsonb를 그대로 응답한다(이중 정의 금지 — MD는 이 JSON의 렌더링일 뿐):

```jsonc
{
  "pack_version": 1, "tier": "trim|full", "generated_at": "...", 
  "license": "CC BY-NC 4.0" /* full: "Metatake Creator License" */,
  "source_url": "https://metatake.net/film/{slug}",
  "film": { "slug","title","original_title","year","director","imdb_id","wikidata_id","tmdb_id" },
  "takescore": { "score","value","cost","risk","dims":{...13}, "low_confidence" } | null,
  /* ⚠️ 구현 시 변경(2026-07-12): 원안은 "flagged→null 제외"였으나 실측상 점수의 64%가 flagged
     이고 공개 film 페이지(cinecodex_for)는 flagged를 표시한다. 제외하면 Tier-1의 70%가 점수를 잃고
     팩이 원본 페이지와 모순 → flagged를 포함하되 low_confidence:true 마커로 정직 노출. score=value-risk
     (=film 페이지의 u). n_samples/panel_disagree는 전부 1/무의미라 제거. */
  "standing": { "prestige","discovery" } | null,
  "honors": [ { "list","facet","result","rank" } ],
  "readings": [ { "framework","title","theorist","concept","figure":{"label","kind"},"text" } ],
  "open_question": { "text" } | null,
  "figures": [ { "label","kind","description" } ] /* full만 */,
  "locations": [ { "name","layer","narrative_setting","scene_role","country" } ] /* full만, 좌표 없음 */,
  "tropes": [ { "title","laconic","thesis" } ] /* full만 */,
  "kindred": [ { "title","year","slug","shared_threads" } ],
  "counts": { "readings_total","included" }
}
```

### 4.4 파일명·버전

다운로드 파일명(W1.5): `metatake-pack_{slug}_{tier}.md|.json`. 버전은 파일명이 아니라 본문 `generated {date}`로(재다운로드가 자연 갱신). 팩 내용 구조가 바뀌면 `pack_version` 정수 증가.

---

## 5. 화이트리스트 (법적 게이트 — RPC에서 원천 강제)

**포함 가능(class-A 자체 생성 + 사실 정보):**

| 출처 테이블 | 포함 필드 |
|---|---|
| `films` | `slug, title, original_title, year, director, imdb_id, wikidata_id, tmdb_id` (크로스 ID는 사실 정보 — 저위험 확정) |
| `takes` (status='published') | `framework, take_title, theorist_name, concept, leap, rationale, strength, is_invitation` |
| `figures` (status='approved') | `label, kind, description` |
| `cinecodex.scores` (flagged=false) | `v_value, c_cost, r_risk, cog…polar 13차원, n_samples, panel_disagree` |
| `film_scores` | `prestige_score, discovery_score` |
| `film_lineage`+`lineage_lists` | `label, facet, result, rank` |
| `film_locations` | `name, layer, narrative_setting, scene_role, country` — **lat/lng 금지** |
| `meta_takes` (kind='figure_type', status='published') | `title, laconic, thesis` |
| `film_affinities`(+`films` 조인) | 상대 `title, year, slug`, `array_length(shared_meta_take_ids,1)` |

**절대 금지(유료·무료 불문 팩에 넣지 않는다):**
- `films`의 TMDB 유래 편집 필드: `overview, tagline, poster_path, backdrop_path, genres, keywords, runtime, release_date, certification, tmdb_extra` (TMDB ToS: 상업·파생·AI/ML 이용 금지)
- `film_ratings`(OMDb, CC BY-NC) · `film_watch_providers`(JustWatch 이중 계약)
- `film_reception`의 verbatim 인용 (AP v. Meltwater)
- **모든 좌표**(`lat/lng` — geo_cache 100% Google 유래, §2-1)
- `takes.rationale_guide, raw_concept, source_citation, source_url`(내부 파이프라인 필드), embedding 컬럼 일체, `retired` takes

집행 방식: RPC의 SELECT 목록 자체가 화이트리스트다(금지 필드는 아예 조회하지 않음). 프론트 필터링에 의존 금지.

---

## 6. W1 구현 지시 (이번 실행분 — 파일 단위)

### 6.0 선행 확인 (5분)

- [ ] `git log --oneline -3`으로 베이스 확인, 새 브랜치 불필요(main 직행이 관례)
- [ ] 픽스처 확인: `select film_context_pack_trim('in-the-mood-for-love-2000')` 실행 전이므로, 대신 `select count(*) from takes t join figures g on g.id=t.figure_id join films f on f.id=g.film_id where f.slug='in-the-mood-for-love-2000' and t.status='published'` = **14** 나오는지
- [ ] `film_scores`의 `track` 값 분포 확인(§2-11) 후 RPC의 standing CTE에 반영
- [ ] `INVITATION` 프레임워크와 `takes.is_invitation`의 관계 확인: `select framework, is_invitation, count(*) from takes where status='published' group by 1,2 order by 3 desc limit 20` — 열린 질문 추출 조건을 결과에 맞춰 확정

### 6.1 마이그레이션 — `supabase/migrations/0085_film_context_pack.sql`

패턴 표본: `supabase/migrations/0073_tv_user_lists.sql:47-72`의 `tv_watch_films`(`language sql stable security definer set search_path to 'public' set statement_timeout to '12s'` + 명시적 GRANT). 골격:

```sql
-- 0085_film_context_pack.sql — 컨텍스트 팩 화이트리스트 조립 RPC
-- 정본: HANDOFF-컨텍스트팩-실행.md §5(화이트리스트)·§6.1. 금지 필드는 SELECT 자체에서 배제.

create or replace function public.film_context_pack(p_slug text, p_tier text default 'trim')
returns jsonb
language sql stable security definer set search_path to 'public'
set statement_timeout to '12s' as $$
with f as (
  select id, slug, title, original_title, year, director, imdb_id, wikidata_id, tmdb_id
  from films where slug = p_slug and is_analyzed = true and visible = true
),
sc as (  -- TakeScore (flagged 제외)
  select v_value, c_cost, r_risk, cog, aff, form, moral, dur, itx, fr, etx, ctx,
         bank, insincere, coward, polar, n_samples, panel_disagree
  from cinecodex.scores s join f on f.id = s.film_id
  where coalesce(s.flagged,false) = false limit 1
),
st as (  -- ⚠️ track 정본 확인 후 조건 확정(§6.0)
  select prestige_score, discovery_score from film_scores fs join f on f.id = fs.film_id limit 1
),
honors as (
  select ll.label, fl.facet, fl.result, fl.rank,
         row_number() over (order by (fl.facet in ('canon','award')) desc,
                            coalesce(ll.authority_weight,0) desc, fl.rank asc nulls last) rn
  from film_lineage fl join f on f.id = fl.film_id
  join lineage_lists ll on ll.id = fl.list_id
),
rd as (  -- 프레임워크당 대표 1개 (strength → confidence 순 결정론)
  select distinct on (t.framework)
    t.framework, t.take_title, t.theorist_name, t.concept, t.rationale,
    t.strength, t.is_invitation, g.label as figure_label, g.kind as figure_kind
  from takes t join figures g on g.id = t.figure_id join f on f.id = g.film_id
  where t.status = 'published'
  order by t.framework, t.strength desc nulls last, t.confidence desc nulls last, t.created_at
),
kin as (
  select f2.title, f2.year, f2.slug,
         coalesce(array_length(a.shared_meta_take_ids,1),0) as shared_threads,
         a.score, row_number() over (order by a.score desc) rn
  from film_affinities a join f on f.id = a.film_id join films f2 on f2.id = a.related_film_id
),
figs as (select g.label, g.kind, g.description from figures g join f on f.id=g.film_id where g.status='approved'),
locs as (
  select name, layer, narrative_setting, scene_role, country,
         row_number() over (order by confidence desc nulls last) rn
  from film_locations l join f on f.id = l.film_id
),
tropes as (
  select distinct mt.title, mt.laconic, mt.thesis
  from takes t join figures g on g.id=t.figure_id join f on f.id=g.film_id
  join meta_takes mt on mt.id = t.trope_id
  where t.status='published' and mt.status='published' and mt.kind='figure_type'
)
select case when not exists (select 1 from f) then null else jsonb_build_object(
  'pack_version', 1, 'tier', p_tier, 'generated_at', now(),
  'license', case when p_tier='full' then 'Metatake Creator License' else 'CC BY-NC 4.0' end,
  'source_url', 'https://metatake.net/film/' || (select slug from f),
  'film', (select to_jsonb(f) - 'id' from f),
  'takescore', (select to_jsonb(sc) from sc),
  'standing', (select to_jsonb(st) from st),
  'honors', (select coalesce(jsonb_agg(jsonb_build_object('list',label,'facet',facet,'result',result,'rank',rank) order by rn), '[]'::jsonb)
             from honors where p_tier='full' or rn <= 8),
  'readings', (select coalesce(jsonb_agg(jsonb_build_object('framework',framework,'title',take_title,
               'theorist',theorist_name,'concept',concept,'text',rationale,
               'figure',jsonb_build_object('label',figure_label,'kind',figure_kind)) order by strength desc), '[]'::jsonb)
               from (select * from rd where not coalesce(is_invitation,false)
                     order by strength desc limit case when p_tier='full' then 100 else 10 end) r),
  'open_question', (select jsonb_build_object('text', rationale) from rd where coalesce(is_invitation,false) limit 1),
  'figures', case when p_tier='full' then (select coalesce(jsonb_agg(to_jsonb(figs)), '[]'::jsonb) from figs) else null end,
  'locations', case when p_tier='full' then (select coalesce(jsonb_agg(to_jsonb(locs) - 'rn' order by rn), '[]'::jsonb) from locs where rn <= 40) else null end,
  'tropes', case when p_tier='full' then (select coalesce(jsonb_agg(to_jsonb(tropes)), '[]'::jsonb) from tropes) else null end,
  'kindred', (select coalesce(jsonb_agg(jsonb_build_object('title',title,'year',year,'slug',slug,'shared_threads',shared_threads) order by rn), '[]'::jsonb)
              from kin where rn <= case when p_tier='full' then 24 else 8 end),
  'counts', jsonb_build_object('readings_total', (select count(*) from rd where not coalesce(is_invitation,false)),
                               'included', least((select count(*) from rd where not coalesce(is_invitation,false)),
                                                 case when p_tier='full' then 100 else 10 end))
) end
$$;

-- ⚠️ 유료 경계 = DB 엣지 (§2-7). Postgres는 함수에 PUBLIC EXECUTE를 기본 부여하므로 반드시 명시 회수:
revoke execute on function public.film_context_pack(text, text) from public, anon, authenticated;
grant execute on function public.film_context_pack(text, text) to service_role;

-- 트림 전용 무인증 래퍼(anon 허용은 이것뿐):
create or replace function public.film_context_pack_trim(p_slug text)
returns jsonb language sql stable security definer set search_path to 'public'
set statement_timeout to '12s' as $$
  select public.film_context_pack(p_slug, 'trim')
$$;
revoke execute on function public.film_context_pack_trim(text) from public;
grant execute on function public.film_context_pack_trim(text) to anon, authenticated;
```

적용: `cd worker && python3 apply-sql.py ../supabase/migrations/0085_film_context_pack.sql` (`.env.local`의 `SUPABASE_ACCESS_TOKEN`=sbp_ Management API 토큰 사용, 프로젝트 하드코딩됨). 적용 후 검증 쿼리: `select jsonb_object_keys(film_context_pack_trim('in-the-mood-for-love-2000'));` + `select length(film_context_pack_trim('in-the-mood-for-love-2000')::text);`(기대 ~10–20KB) + **anon 경계 검증**: anon key로 PostgREST에서 `film_context_pack('x','full')` 호출이 permission denied인지 확인.

### 6.2 렌더러 — `lib/pack.ts` (신규)

- `type FilmPack = {...}` (§4.3 스키마), `renderPackMarkdown(pack: FilmPack): string` — §4.1/4.2 템플릿의 결정론 구현(라이브러리 0, LLM 0).
- 고정 문안(출처 라인·How to use·프로비넌스 라인)은 이 파일의 상수로. TakeScore 13차원 라벨은 **기존 /takescore 표면의 글로서리를 찾아 import**(중복 사전 금지·발명 금지 — `grep -rn "insincere" app/takescore lib | head`로 위치 파악).
- 빈 섹션 생략 규칙(§4.0-5) 구현.

### 6.3 API — `app/api/pack/[slug]/route.ts` (신규)

관례 표본 `app/api/tv/reel/route.ts` 준수: 인라인 anon 클라이언트 + `export const dynamic = "force-dynamic"`.

- `GET /api/pack/{slug}?tier=trim&fmt=md|json` — **v1은 tier=trim만 수용**, `tier=full`은 `403 { error: "full packs open with sign-in — coming soon" }`(W1.5에서 교체). RPC는 `film_context_pack_trim` 호출.
- RPC null(비적격 슬러그) → 404. `fmt=json` → `application/json`, 기본 md → `renderPackMarkdown` 후 `content-type: text/markdown; charset=utf-8`.
- 응답 헤더: `cache-control: public, s-maxage=86400, stale-while-revalidate=604800` + **`X-Robots-Tag: noindex`** (팩 원문이 영화 페이지와 중복 콘텐츠로 색인되는 것 방지 — SEO 가드, 사이트맵에도 넣지 않는다).

### 6.4 버튼 — `components/CopyForAI.tsx` (신규) + 필름 페이지 장착

- 클라이언트 컴포넌트. props `{ slug: string }`. 클릭 시:

```ts
// ⚠️ Safari 함정: fetch 후 clipboard.writeText는 사용자 제스처 체인이 끊겨 거부됨.
// ClipboardItem에 Promise를 넘기는 패턴이 정석:
const blobP = fetch(`/api/pack/${slug}?tier=trim`).then(r => { if (!r.ok) throw new Error(); return r.blob(); });
if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
  await navigator.clipboard.write([new ClipboardItem({ "text/plain": blobP })]);
} else {
  const t = await (await blobP).text();            // 구형 폴백
  await navigator.clipboard.writeText(t);
}
mtEvent("copy_for_ai");                             // components/mtTrack.ts 재사용
```

- 성공 시 1.8s "Copied for AI ✓" 상태(ShareDock의 `copied` 패턴 재사용, `components/ShareDock.tsx:67-74` 참조). 실패 폴백: `window.open('/api/pack/'+slug+'?tier=trim')`로 원문 열기.
- 라벨 `Copy for AI`, title 속성 `"Copy a structured context pack (Markdown) for Claude, ChatGPT, or NotebookLM"`. 스타일은 df-share 안 ShareDock 버튼들과 동일 언어(기존 클래스 재사용, 신규 CSS 최소화 — **신규 CSS와 page 수정은 반드시 한 커밋**: 워처 파일별 커밋 레이스 함정).
- 장착: `app/film/[slug]/page.tsx` **Tier-1 히어로의 `df-share` 블록**(현재 ~1151–1154행, `<ShareDock variant="bar" ...>` 옆). Tier-2 분기(~783행)에는 넣지 않는다. import 1줄 + JSX 1줄이 전부여야 한다.

### 6.5 기술부채 3건 (데이터사업 선행 위생 — 원안 W1-4)

**(a) `next.config.ts` — /tmp-sql CORS 제거.** 8–17행의 `headers()` 블록 전체 삭제(2026-07-02 TEMP 주석 명시 잔존물). ⚠️ 루트 파일 = 워처 스테이징 밖 → **수동 커밋 필수**.

**(b) `middleware.ts` — `/api/*` auth 왕복 분리.** 현재 `supabase.auth.getUser()`(135–138행)가 `/api/*` 전부에 실행됨(§2-9). 크롤러 관찰 호출(97행) 직후·홈 early-return(104–106행) 앞에 추가:

```ts
// API routes handle their own auth; skip the session round-trip (except /api/admin/* for safety).
if (pathname.startsWith("/api") && !pathname.startsWith("/api/admin")) {
  return NextResponse.next();   // ← 파일 내 기존 응답 생성 방식과 동일하게 맞출 것
}
```

⚠️ **이 파일에는 Bot Sentinel(9–43행)·크롤러 핸드셰이크(45–70, 97행)가 산다** — 그 로직은 1글자도 건드리지 않는다. 편집 전 `HANDOFF-크롤러-핸드셰이크-리퍼러.md` + `HANDOFF-사이트분석-퍼스트파티.md`의 §Bot Sentinel 필독. 봇 게이트가 `/api`를 건너뛰는 기존 동작(83행)도 유지. 루트 파일 = **수동 커밋**.

**(c) `app/api/films/backfill/route.ts` — 무인증 보강.** 호출자가 브라우저(`app/ask-ai/new/page.tsx:79`)라 시크릿 불가(§2-8). 적용: ① Origin/Referer가 자기 도메인(metatake.net·*.vercel.app 프리뷰·localhost)이 아니면 403 ② `tmdb_id` 정수·양수·상한(< 10^9) 검증 ③ 이미 존재하는 film이면 upsert 건너뛰고 기존 행 반환(쓰기 표면 축소) ④ 인메모리 레이트리밋(IP당 분당 5회; per-isolate 한계는 주석으로 명시). 근본 수정(서버 액션으로 이동)은 범위 밖 — 주석으로 남길 것.

### 6.6 스펜드 알림 (코드 아님 — 오너 액션)

Vercel Spend Management 알림 활성화는 대시보드 설정이라 에이전트가 못 한다. 완료 보고에 "오너 몫: Vercel 대시보드 → Spend Management 알림 켜기($23k DDoS 청구 사례 예방)"를 명시할 것.

---

## 7. W1.5 지시 (다운로드·쿼터·토글·라이브러리 — W1 배포·검증 후)

1. **마이그레이션 `0086_pack_downloads.sql`**: `pack_downloads(id bigint identity pk, user_id uuid not null, film_id uuid not null, tier text, fmt text, sections text[], created_at timestamptz default now())` + 인덱스 `(user_id, created_at)`. RLS: 본인 select만(`auth.uid() = user_id`), insert 정책 없음(service-role 경유 기록).
2. **다운로드 라우트** `app/api/pack/[slug]/download/route.ts`: `@supabase/ssr` 서버 클라이언트로 세션 확인(비로그인 401 → 프론트가 기존 로그인 플로우로 유도, Nav.tsx가 계정 UI 정본) → 이달 다운로드 수 조회(`created_at >= date_trunc('month', now())`) → **10 미만이거나 Pass 보유(W2 전엔 전자만)**면 admin 클라이언트로 `film_context_pack(slug,'full')` 호출 + `pack_downloads` 기록 → `content-disposition: attachment; filename="metatake-pack_{slug}_{tier}.{md|json}"`. 쿼터 초과 → 402 + 잔여일 안내.
3. **섹션 토글**: RPC에 `p_sections text[] default null` 파라미터 추가(0086에서 `create or replace`; null=티어 기본 전체). 모달 컴포넌트 `components/DownloadPack.tsx` — 체크박스(Readings/TakeScore/Standing&Honors/Figures/Locations/Tropes/Kindred) + 포맷(md/json) + 남은 쿼터 표시. 필름 페이지 df-share의 CopyForAI 옆 `Pack ↓` 버튼으로 오픈. mtEvent `pack_download`.
4. **팩 라이브러리** `/room/packs`: `pack_downloads` 본인 행 목록(영화·티어·날짜) + 재다운로드 링크(쿼터 미차감: 같은 film_id 재다운로드는 이달 카운트에서 제외하는 편이 후하고 단순 — `count(distinct film_id)`로 쿼터 계산). 내비 등록: `lib/room/nav.ts`의 RESEARCH 그룹에 `{ label: "Packs", href: "/room/packs" }` + `components/room/DeskWorkspace.tsx` "Open jobs" 도어 그리드(366–395행)에 타일 1개. ⚠️ `/room/library`는 `/room/shelf`로 가는 기존 리다이렉트 스텁 — 건드리지 말고 `/room/packs`를 새로 판다.

---

## 8. W2 지시 (결제 — 개요만, 착수 시 상세 기획 먼저)

Polar.sh(MoR — VAT/JCT 대행, 한국 사업자 유리) 제품 2개: Pass Monthly $9 / Pass Yearly $49. `0087_pack_entitlements.sql`(`user_id, product, status, current_period_end, provider_customer_id`) + `/api/polar/webhook`(서명 검증) → 다운로드 라우트의 쿼터 검사에 Pass 분기 추가. `/data` 스토어 페이지(상품·FAQ·라이선스 링크) + `/data/license`(Creator License 전문: 허용=자기 콘텐츠 제작·소규모 상업 / 금지=재배포·재판매·경쟁 데이터셋 구축·대량 LLM 학습). 풀팩 frontmatter에 구매자별 `pack_id`(sha256(user_id·slug·월) 앞 12자) 지문 + `pack_downloads` 원장 대조로 유출 추적. 일 50팩 캡. llms.txt에 /data 등재.

---

## 9. 검증 프로토콜 (실행 에이전트 필수 절차)

1. **타입체크**: 로컬 node는 PATH 밖에 있음 — `export PATH="$HOME/.local/node/bin:$PATH" && ./node_modules/.bin/tsc --noEmit` (리포에 tsc 존재 확인됨). dev 서버 검증은 불필요(globals.css @import는 turbopack dev만 깨지는 기존 이슈 — prod는 정상).
2. **RPC 검증**(§6.1 말미 쿼리 3종) → 트림 jsonb의 키 목록·크기·anon 경계까지 확인 후에만 프론트 착수.
3. **커밋 규칙**: `app/`·`components/`·`lib/`는 auto-deploy 워처가 스테이징(신규 CSS+page는 한 커밋). `supabase/migrations/*.sql`·`middleware.ts`·`next.config.ts`·문서는 **수동 `git add <파일> && git commit && git push`**. 워처와 경합 시 index.lock을 지우지 말고 타임아웃 후 `git log`로 실제 커밋 여부 확인(워처-세션 경합 전례 있음).
4. **라이브 검증**: 배포 직후 HTML은 구 ISR 캐시일 수 있음 — 반드시 캐시버스터(`?v=타임스탬프`)로 접속, 코드 배포 여부는 Vercel 최신 배포 상태로 먼저 확인. `curl -s "https://metatake.net/api/pack/in-the-mood-for-love-2000?tier=trim" | head -40`으로 §4.1 템플릿 형태·출처 라인·(빈 섹션 생략) 확인 + `?fmt=json` 파싱. React는 주석 노드로 텍스트를 쪼개므로 페이지 HTML에서 버튼을 정확 문자열 grep으로 찾지 말 것(class·aria로 확인).
5. **이벤트 검증**: 프로덕션에서 버튼 1회 클릭 후 `select ts, path, props from mt_events where type='click' and props->>'name'='copy_for_ai' order by ts desc limit 3` (또는 다음날 `/admin/metrics` 클릭 표).
6. **회귀 확인**: middleware 수정 후 — 로그인 유지되는지(아무 페이지), `/admin` 게이트 동작, `/api/metrics` 비콘 200, 봇 403 로직 무손상(배포 후 `/admin/crawlers` 정상). backfill 수정 후 — ask-ai 새 영화 선택 플로우 1회 통과.
7. **완료 보고에 포함**: 배포 커밋 해시, 검증 쿼리 결과, 스펜드 알림 오너 액션(§6.6), 90일 판정 기준(§11) 리마인드.

---

## 10. 하지 말 것 (금지 목록)

1. **§5 금지 필드를 어떤 티어·어떤 포맷에도 넣지 않는다** (특히 좌표·overview·평점·시청처·인용).
2. **LLM 호출 금지** — 팩 파이프라인 전체가 DB→템플릿 결정론이어야 한다.
3. `hourly/` 폴러·워처 일체 수정 금지(형제 시스템).
4. middleware의 봇 게이트·핸드셰이크·admin 게이트 로직 수정 금지(§6.5-b의 early-return 삽입만).
5. 마이그레이션 번호 0078–0084 재사용 금지(디렉터리 간 충돌 중, §2-6) — 0085·0086·0087만.
6. `/api/pack`을 사이트맵·내부 링크로 노출 금지, `X-Robots-Tag: noindex` 생략 금지(중복 콘텐츠 리스크).
7. Tier-2 영화에 버튼 노출 금지(빈 팩 = 품질 사고).
8. 트림 팩을 로그인 뒤로 옮기지 말 것(오너 결정 §1-2), 풀팩 RPC를 anon에 GRANT하지 말 것(§2-7).
9. `content_events`에 쓰지 말 것(관리자 감사 로그 — §2-2).
10. 기존 `df-share`·ShareDock·`mtEvent` 동작 변경 금지(재사용만).
11. 팩 문안에 "vibe coding"류 빌드 뒷이야기 금지 — 프로비넌스 라인(§4.0-4)의 확정 문구만(개발자 독스 보류 결정과 동일 원칙).

---

## 11. 판정 기준·후속

- **판정(W1 배포 + 90일)**: `copy_for_ai` 클릭 수·페이지뷰 대비 CTR·(W1.5 후) 다운로드/가입 전환으로 ① 라인 지속 ② API 승격(`docs/PLAN-api-service.md` Phase 1 — Locations API부터) ③ 무료 SEO 기능으로 강등을 결정. 측정은 전부 `mt_events`/`/admin/metrics`에 이미 있음.
- **부록 태스크(별도 세션, 선택)**: 촬영지 좌표를 팩에 넣고 싶으면 **Nominatim 재지오코딩 백필**(geo_cache 19,549행 → `source='nominatim'` 재구축, OSM ODbL 출처표기)이 선행 조건. 완료 전 좌표 금지 유지.
- **관광 딜 병행 트랙**(오너 주도)은 `docs/HANDOFF-데이터사업-마스터.md` §8-12 참조 — 본 지침서 범위 밖.

## 12. 결정 로그

- 2026-07-03: 파일형 컨텍스트 팩 선행 확정(API는 90일 데이터로 판정). 4티어 상품 구조·화이트리스트·법률 검토 완료.
- 2026-07-12: 오너 결정 §1 — Pass 채택($1 단품 폐기)·무로그인 복사·월 10팩 무료 쿼터·마이룸 무료+팩 라이브러리·드라이브 보류(MCP 우선). 실행은 별도 에이전트, 본 지침서 작성.
- 2026-07-12 실측: 좌표 전면 금지(nominatim 0행)·mt_events 로깅·0085 번호·DB 엣지 GRANT 경계·backfill 클라이언트 호출자·Safari ClipboardItem 패턴 확정.
- **2026-07-12 W1 구현·배포 (commit d80e016, 다른 세션이 아니라 본 에이전트가 실행):**
  - **TakeScore flagged 처리 변경(위 §4.3 참조):** flagged 제외→포함+low_confidence 마커. 근거: flagged 64%·공개 페이지 일관성·Tier-1 70% 점수 소실 방지. 라이브 GRANT 검증: full→service_role only, trim→anon+authenticated.
  - **5-렌즈 적대적 리뷰(13 에이전트) 결과:** 8건 제기 → 6 반박 → **2 확정·수정 완료**: ① `rd`(readings) CTE에 `figures.status='approved'` 조인 누락(비승인 피겨 label/kind가 무료 트림에 샐 수 있었음, 사이트 readings 전부 이 게이트 있음 — 추가·재적용; 현재 전역 위반 0건이라 출력 불변, 드리프트 방어) ② CopyForAI 마운트에 visible=true 게이트 누락(is_analyzed=true·visible=false 22편에서 버튼이 클릭 시 404 — `(film as {visible?}).visible!==false` 게이트 추가).
  - **라이브 검증 전항 통과:** 트림 MD 품질(11KB, 출처·라이선스 상하단·13차원 정순), full→403·missing→404·json content-type·X-Robots noindex, 버튼 Tier-1 존재/Tier-2 부재, 좌표·금지필드 키 0(정밀 검사), 1,939 Tier-1 전편 TakeScore.
  - **⚠️ 발견된 선존 데이터 결함(팩 무관·W1 범위 밖):** 발행 takes 2편의 rationale에 중국어 이중인코딩 모지바케(예 ITMFL TITLE/INVITATION의 `鏌愯姳鏍峰勾鍗`=원래 `花樣年華`). DB 원본 손상이라 film 페이지에도 동일 노출. 팩 파이프라인은 충실 통과(내 버그 아님). 데이터 품질 트랙에서 2건 수정 권고(발행 콘텐츠라 임의 재작성 보류).
  - **오너 몫(코드 아님):** Vercel 대시보드 → Spend Management 알림 켜기.
- **2026-07-12 Phase A 구현·배포 (오너 확장 요구 4항: 편재 복사·탭별 복사·전체 다운로드·로그인+월10):**
  - **모델 재정의(오너 AskUserQuestion 확정):** 복사(탭별·전체)=무료·무로그인(공개 페이지 콘텐츠), .md 다운로드만 로그인+월10 신규영화=편의 게이트. 구축=영화 페이지 먼저→이후 비-영화 엔티티(Phase B).
  - **아키텍처:** `film_context_pack`은 여전히 service_role only(=DB엣지 스크레이핑 차단). 앱 라우트가 admin 클라이언트로 full 조회 후 섹션/전체 렌더(무료·레이트리밋·noindex). 섹션↔탭 매핑 정본=`lib/pack.ts PACK_SECTIONS`(금지콘텐츠 탭=reception verbatim·where-to-watch providers·news는 맵 부재→버튼 없음=UI층 화이트리스트).
  - **파일:** lib/pack.ts(PACK_SECTIONS+renderPackSection/Selected), /api/pack/[slug](section/sections/whole), /api/pack/[slug]/download(로그인+claim), CopyForAI(pill/tab), DownloadPackModal, FilmTabBar(packSlug/packDownload), app/film 마운트, /room/packs, nav.
  - **5-렌즈 적대적 리뷰(10에이전트) 확정 2건 수정:** ①TOCTOU 쿼터 경합(동시요청 10초과)→pack_download_claim 원자함수(advisory lock) ②라이브러리 재다운로드 월-스코프 버그(전월 영화 재다운로드가 쿼터 소진+402 raw JSON)→ever(전기간) 무료+min기반 신규영화 카운트. **+자가발견 1건:** 쿼터 RPC가 Supabase 기본권한으로 anon EXECUTE 노출→전 함수 service_role only 명시 revoke(0087). CTE 합성테스트로 카운트 로직 검증(전월 재다운로드 미차감).
  - **라이브 검증:** 섹션 엔드포인트(13 readings+헤더)·다운로드 status JSON(authed/remaining/eligible)·전체 복사·필름페이지 UI(팩탭 8버튼·다운로드 컨트롤 1·히어로 1)·라이선스 CC BY-NC.
  - **⚠️ 동시 세션 위험 실현:** 다른 세션이 `.autodeploy-off`를 지워 워처가 내 staged 인덱스(마이그 포함)를 auto-deploy 커밋으로 푸시. 결과적으로 최종본이 정상 커밋·푸시됨(HEAD==origin 확인). 교훈=[[autodeploy-watcher-race]] 재확인, 커밋은 pathspec(`git commit <files>`)로.
  - **미착수:** 실제 로그인 브라우저 E2E(다운로드 파일 저장·쿼터 차감·라이브러리 표출)는 오너 검증 몫. Phase B(비-영화 엔티티 팩: concept/director/trope/catalog 등 ~20종, 각 팩 생성기 필요).

## 13. 다음 세션 시작 프롬프트 (복붙용)

> `HANDOFF-컨텍스트팩-실행.md`를 읽고 §6(W1)을 구현해줘. 순서: §6.0 선행 확인 → 0085 마이그레이션 적용·검증 → lib/pack.ts 렌더러 → /api/pack 라우트 → CopyForAI 버튼+film 페이지 장착 → 기술부채 3건(§6.5, middleware·next.config는 수동 커밋) → §9 검증 프로토콜 전 항목 수행 후 결과 보고. §5 화이트리스트와 §10 금지 목록을 벗어나지 말 것.
