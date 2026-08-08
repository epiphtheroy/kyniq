# HANDOFF: 앱 패리티 공장 — 앱 노출 컨텐츠의 Tier1/Tier2 격차 해소

작성 2026-08-06 · 상태 **기획(오너 결정 대기)** · 정본 위치: 저장소 루트
전제 문서: `HANDOFF-영화공장.md` · `HANDOFF-티어2공장.md` · `HANDOFF-모바일앱-프리워치.md` · `HANDOFF-한국어화-구독번역-실행.md` · `HANDOFF-Tier2-메인통합.md`

---

## §0 한 줄 요약

앱은 tier를 모른다. 검색·Tonight 덱·딥링크 전부 Tier2를 그대로 노출하고, 데이터가 없는 섹션만 조용히 사라진다. 따라서 "앱에 나오는 컨텐츠를 전부 Tier1 수준으로"는 **풀 Tier1 승격(편당 ~$1.9, 5,177편 ≈ $10,000)이 아니라**, 앱이 네이티브로 그리는 섹션의 공백만 채우는 **앱 패리티 킷**으로 달성한다. 실측 결과 그 공백은 4개뿐이다:

| 공백 | 대상 | 생성 수단 |
|---|---|---|
| K1 Invitation(초대문) | 영화 5,200편 | 구독토큰 `claude -p` (Opus) |
| K2 TakeScore | 영화 454편 | 기존 S40 (API sonnet, ~$3) |
| K3 감독 The Life(intro+facts) | 감독 660명 | 구독토큰 `claude -p` + WebSearch |
| K4 For You 친연(affinities) | 영화 5,177편 | OpenAI 임베딩 ~$50 + SQL (선택) |

전부 **서버 사이드**다. 앱 바이너리/OTA 릴리즈 불필요 — 섹션은 presence-gated라 데이터가 생기면 그대로 나타난다. 웹 보강은 같은 데이터를 웹 Tier2 블록에서 렌더하는 코드 2곳 추가로 끝난다.

---

## §1 격차 실측 (2026-08-06, 프로덕션 DB)

영화 7,158편 = Tier1(`is_analyzed`) 1,981 + Tier2 5,177 (시드카탈로그 454 / noindex 코호트 3,810 / 롱테일).

앱 필름 브리프의 네이티브 섹션 × Tier2 커버리지:

| 앱 섹션 | 데이터 소스 | T2 보유 | T2 공백 | 판정 |
|---|---|---:|---:|---|
| TakeScore 도넛/rank/VCR/dims | cinecodex (`film_scores`·`cinecodex_confidence`) | 4,723 | **454** | K2로 채움 |
| An Invitation / Tonight 카드 리드 | `takes.is_invitation` (T1 전용) | **0** | **5,177** (+T1 결번 23) | **K1 — 최대 공백** |
| to.W 편지 | `curation.film_comment` (오너 원장 11,633편) | 4,856 | 321 | **채우지 않음** (오너 원장 종속, 재구축 금지) |
| For You kindred | `film_affinities` (takes 임베딩 기반, T2 구조적 0) | 0 | 5,177 | K4 (선택) |
| What to Expect dims | cinecodex | ≈4,723 | ≈454 | K2가 해결 |
| Where to watch | `film_watch_providers` | 4,997 | 180 | 무료 백필 |
| Lineage | `film_lineage` | 4,707 | 470 | 현상 유지 (자연 커버) |
| Locations 미니맵 | `film_geo` | 4,143 | 1,034 | W3 선택 (S19, Tavily 비용) |
| The Life (감독) | `director_facts` (211명뿐) + `films.director_slug` | 부분 | 큼 | **K3** |
| Metatake TV | `tv_*` (visible AND is_analyzed) | 0 | — | 채우지 않음 (기존 DO-NOT) |

감독 측 실측:
- `directors` 871명 중 기사층(facts/portrait/picks/next) 보유 **~211명** → 기존 감독 660명도 The Life 없음 (**T1 영화조차 The Life가 없는 경우가 다수** — 이 격차는 tier가 아니라 기사층 커버리지 문제)
- Tier2 영화 4,080편은 `director_slug` 자체가 없음(감독명 미매칭 2,721명, 그중 ≥2편 보유 694명). 앱에서는 감독명이 탭 불가 텍스트로 렌더됨.
- 앱 감독 페이지 필모그래피는 BFF가 `.eq("visible", true)` — Tier2 영화가 조용히 빠짐 (§7-6 결정 항목).

앱 검색은 이미 Tier2 포함(`search_all` 0.8 디스카운트, `is_catalog` 필드는 앱이 버림 — 뱃지 없음 = 이미 "차이 없음"). Tonight의 `cinecodex_ranked`는 visible 술어 없음 = 채점된 전 코퍼스 랭킹.

---

## §2 스코프 정의 — 앱 패리티 킷

### 포함 (생성 대상)
- **K1 Invitation**: 편당 1개, ~400–500자, 세리프 리드. 대상 5,200편(T2 5,177 + T1 결번 23). Tonight 카드 리드와 필름 브리프 Invitation 섹션, 웹 Tier2 블록 보강까지 겸함.
- **K2 TakeScore 454편**: 기존 S40 catalog 레인 그대로. **API 유지 권고** — 채점은 캘리브레이션된 모델(sonnet-4-6) 일관성이 토큰 절약보다 중요. 총 ~$3.
- **K3 감독 The Life**: 기존 감독 660명에 `director_facts`(intro + name_meaning + facts[] with source). 리서치 그라운딩 필수(facts는 출처 host가 렌더됨) → `claude -p` + WebSearch.
- **K5 무료 백필**: 프로바이더 180편(S03/S44), `director_slug` 백필(기존 RPC `factory_director_slug_backfill`, 마이그 0098 — 기존 871명 매칭분만).

### 제외 (명시적)
- to.W 결번 321편 — 오너 큐레이션 원장(11,633편) 밖의 영화. 원장 종속 레이어이므로 생성 금지(기존 불변식 "재구축 절대금지"의 연장).
- TV·리셉션·미스리딩·Q&A·figures — 앱에서 네이티브 렌더하지 않음(WebView 전용). 앱 패리티에 불요.
- **robots/sitemap/INDEX_COHORT 캡 일절 불변.** 이 레인은 SEO 레인이 아니다. `PLAN-tier2-almanac.md`의 "채워 보이게 하려고 Tier-2 전체 대량 산문 생성 금지(scaled content abuse)"는 **색인 노출 동기**에 대한 금지다. K1은 앱 제품 컨텐츠이며 색인 게이트를 건드리지 않는 것으로 그 방침과 양립시킨다(§9-1).

### 선택 (오너 결정, §8)
- K4 친연(임베딩), W3 로케이션 1,034편, W2d 감독 풀킷(portrait/picks/next), D3 신규 감독 694명 생성(기존 "생성 금지" 결정의 부분 해제 필요), W4 Invitation ko 코퍼스.

---

## §3 DB 설계 — 꼬임 방지가 최우선

### 3.1 K1 저장소: 새 테이블 `film_leads` (기존 레이어 오염 금지)

T1 모양 그대로(figure 1개 + invitation take 1개) 넣는 방안은 **기각**한다:
- `figures`는 `/film/[slug]/figure/[figureSlug]` 페이지를 낳는다 — 5,177 크롤 표면 신규 생성. **08-06 사이트다운의 진앙이 바로 이 라우트다.**
- figure ≥3 승인 시 `visible` 플립 트리거, 미스리딩/트로프/카탈로그가 figures/takes에서 파생 — 반쪽짜리 레코드가 T1 의미론을 오염시킨다.

대신 **가산적 신테이블** (마이그 **0136** — 번호는 적용 직전 `supabase/migrations/` + `worker/*.sql` 재확인):

```sql
create table public.film_leads (
  film_id      uuid primary key references public.films(id) on delete cascade,
  lead         text not null,
  model        text not null,            -- 'claude-opus-5'
  source_sha256 text not null,           -- 입력 컨텍스트 해시 (재생성 판정)
  created_at   timestamptz not null default now()
);
alter table public.film_leads enable row level security;
create policy film_leads_read on public.film_leads for select to anon, authenticated using (true);
-- 쓰기 정책 없음 = service_role 전용
```

**폴백 체인 계약** (BFF `app/api/v1/app/film/[slug]/route.ts` + `tonight/route.ts`):
`invitation take(T1) → film_leads(신규) → film_sentences(EN 한정) → 없음`
- 생성문은 기존 `invitation` 필드에 실어 보낸다 → **앱 코드 변경 0**.
- **승격 계약**: 영화가 풀 Tier1로 승격되면(영화공장 재투입) 진짜 invitation take가 생기고 film_leads 행은 자동으로 섀도잉된다. 삭제 불필요·충돌 없음. 롤백 = `drop table` 한 줄.
- i18n 키 설계: `content_i18n (entity_type='film_lead', entity_key=<film_slug>, field='lead')` — W4에서 ko 번역 시 그대로 사용.

### 3.2 K3: 기존 `director_facts` 그대로 (스키마 변경 없음)
기존 211명과 동일한 shape(intro, name_meaning, facts jsonb `[{n, text, source}]`). 새 테이블 불필요. 웹 `/director/[slug]/life`의 robots bar(≥4 facts)는 기존 그대로 두면 자연히 동작 — **게이트 코드 수정 금지**.

### 3.3 K4(선택): `film_affinities` 동일 테이블 + `method` 컬럼 추가
T1(takes 임베딩)과 T2(to.W/개요 임베딩)를 구분하는 `method text default 'takes'` 컬럼을 가산 마이그로. 웹 kindred 스트립의 기존 DO-NOT(affinities=0 근거)은 데이터가 생기면 재검토 대상이 되므로, **웹 렌더는 별도 결정 전까지 앱 전용**.

### 3.4 쓰기 경로 거버넌스 (i18n 체계 준용)
1. 생성기는 **DB에 직접 쓰지 않는다.** `data/gen/out/<corpus>/b-<RUN_ID>-<idx>.json` 아티팩트만 산출.
2. 적재는 **오너가 `!`로 실행**: `scripts/load-film-leads.mjs` — PK upsert, CHUNK 250, `--gentle` 1.5s (기존 `load-content-i18n.mjs` 패턴).
3. 검증 count 쿼리는 `--confirm` 없이 자동 실행 금지 (08-06 포화 DB 교훈).
4. 추출(컨텍스트 수집)은 Mgmt API 400행 페이지네이션 (`worker/i18n-extract.py` 패턴), 야간·오프피크.
5. 마이그레이션 먼저 배포 → 코드 머지 (기존 배포 순서 불변식).

---

## §4 생성 파이프라인 — 구독토큰 (`claude -p`)

**정본 패턴 = i18n 번역 러너** (`scripts/i18n-translate-run.mjs`). 검증된 요소를 전부 승계하고, 라이브 러너(invitation 1,082건 복구 중)를 건드리지 않기 위해 **포크**한다: `scripts/gen-run.mjs` + `data/gen/`.

승계 목록 (하나도 빼지 말 것):
- `claude -p --model claude-opus-5 --system-prompt <charter> --allowed-tools "" --output-format json` — **`--allowed-tools ""`가 호출당 캐시라이트 19k를 0으로 만든다.** K3만 예외적으로 `--allowed-tools WebSearch WebFetch` (hourly 패턴, 사전 승인으로 프롬프트 블로킹 방지).
- **모델 = Opus 고정. Fable 금지** (오너 자동화 지침). API 키·Batch API 금지.
- **RUN_ID 파일명** `b-<RUN_ID>-<idx5>.json` — 08-06 재개-덮어쓰기 사고(706건 유실)의 재발 방지. 첫날부터.
- 레저 `data/gen/ledger.jsonl` (keys[] 포함) + **완전성 검사는 레저가 아니라 디스크 파일 대조** (`i18n-completeness.mjs` 패턴) + requeue.
- 서킷브레이커: 프로세스 연속 실패 4회 → 글로벌 20분 정지. 킬스위치 `data/gen/.stop`.
- **nohup 필수** (셸 수명에 러너가 딸려 죽은 사고 기록 있음).
- 인라인 린트(생성판): 길이 밴드(300–600자), 금지 표현(스포일러 마커, "masterpiece" 류 상투어, 자기부정문 — "no awards recorded" 금지 원칙 준용), 브랜드 용어 보존.
- **에코 감사**: 대량 병렬 생성은 문형 수렴이 고질 (Poetics 교훈). `i18n-audit-ko.mjs`의 오프닝 n-gram/문장장 CV 검사를 EN 생성물에 이식, 코퍼스당 표본 200건. 오프닝 3-gram 최빈이 5%를 넘으면 해당 배치 requeue.

페이싱 (구독 게이지 공유 — hourly 파이프라인·오너 대화 세션과 같은 통장):
- 1회 런 ≈ 출력 40만 토큰 상한, 런 사이 오너 `/usage` 확인, **주간 게이지 80%에서 정지**.
- **extra usage OFF 확인 후 시작** (초과분 재과금 함정).
- 청크: K1 12–20편/호출(컨텍스트 무거움), K3 1명/호출(리서치). 동시성 3–4.

프롬프트 컨텍스트 (K1, 편당):
제목·연도·장르·감독 + TMDB 개요 + **to.W rationale(4,856편 보유 — 최상급 재료)** + lineage/honors 요약 1–2줄 + 하우스 스타일 차터(고정 프리픽스, 캐시 히트). to.W 없는 321편은 개요+리셉션으로 대체.

---

## §5 기존 공장들과의 관계

| 시스템 | 관계 | 불변 |
|---|---|---|
| **영화공장** (`worker/factory.py`, 48 스테이지) | **승격의 정본은 계속 공장이다.** 같은 영화를 `tier=full` 재투입하면 기존 데이터 멱등 스킵 + T1 전용 스테이지만 실행(티어2공장 §5 계약 — 코드에 살아 있음). 패리티 레인은 그 아래의 **얇은 중간층**: film_leads는 승격 시 자동 섀도잉(§3.1). 공장 manifest는 수정하지 않는다(주석/문서 링크만). | 포크 금지·단일 엔진 원칙 유지. S05/S06 blocked·S28 full-only 등 미출하 전제 3건은 이 레인의 블로커 아님. |
| **티어2공장** (catalog 레인, 미완) | T1~T8 중 이 기획이 실제 소비하는 것은 **T4(S40 catalog — 이미 DONE)**뿐. 나머지는 별개 트랙으로 대기 유지. | |
| **t2noindex 공장** (SEO 신호회수) | **완전 별개 레인.** 이 기획은 robots/sitemap/캡을 건드리지 않으므로 충돌 없음. 단 `factory_director_slug_backfill`(0098)은 공유 자산으로 재사용. | 색인요청 금지·플립플롭 금지 기존 방침 그대로. |
| **i18n 번역 러너** | **기술 정본.** 포크(`gen-run.mjs`)로 승계. 라이브 러너와 out/ 디렉토리·레저 분리(`data/i18n/` ↛ `data/gen/`). invitation 1,082건 번역 복구가 끝나기 전에는 게이지를 나눠 쓰므로 **동시 가동 금지**. | |
| **hourly 파이프라인** | `claude -p` 호출 시임(`anthropic_call()`)과 WebSearch 사전승인 패턴만 차용. hourly 폴러 자체는 수정 금지(기존 지침). | |
| **almanac Track C** (풀 승격 웨이브) | 패리티 레인이 깔린 뒤에도 유효한 **다음 단계**. Track C의 우선순위 큐(인바운드 추천 타깃 995편 등)는 W1 생성 순서에도 재사용(§6). | |

한 문장 정리: **공장 = 승격(두꺼움, API 배치), 패리티 레인 = 동등화(얇음, 구독토큰), t2noindex = 색인(무LLM).** 세 레인은 같은 테이블을 두고 겹치지 않게 설계되어 있다.

---

## §6 웨이브 계획 · 분량 계산

생성 순서 원칙: **노출 확률 순.** `cinecodex_ranked` 상위(=Tonight에 실제로 뜨는 영화)부터. K2(채점 454편)는 K1보다 **뒤에** — 채점되는 순간 Tonight에 진입하므로 리드 없이 입장시키지 않는다.

| 웨이브 | 내용 | 규모 | 출력 토큰 | 호출 수 | 벽시계 | 달력 (페이싱 포함) |
|---|---|---:|---:|---:|---|---|
| W0 | 마이그 0136 + BFF 폴백체인 + 웹 T2 렌더 + 러너 포크 | 코드 | — | — | — | 1일 |
| **W1a** | K1 Invitation 5,200편 | 5,200 × ~180tok | ~1.0M | ~300–430 | 세션당 2–3h | **2–4일** (3–4런) |
| W1b | K2 TakeScore 454편 (API S40) | 454 | — (API ~$3) | — | 1–2h | W1a 직후 |
| W1c | K5 무료 백필 (프로바이더 180, dslug 매칭분) | SQL/무료 | — | — | 1h | 병행 |
| **W2a** | K3 The Life 660명 (리서치 그라운딩) | 660 × ~1.5k tok | ~1.0M | 660 | 6–10h | **~1주** (3–4런) |
| W2d(선택) | 감독 풀킷(portrait+picks+next) 660명 | 660 × ~2.5k | +1.7M | 660 | +8h | +1주 |
| W3(선택) | 로케이션 1,034편 (S19: sonnet레그를 CLI로, Tavily·지오코딩은 API) | 1,034 | ~0.2M | — | — | Tavily ~$40 |
| W4(선택) | Invitation ko (i18n 코퍼스 신설 `film_lead`) | 5,200 × ~500자 | ~1.3M | ~350 | — | 복구 완료 후 |

**합계 (코어 W0–W2a): 구독토큰 출력 ~2.0M 토큰, 호출 ~1,000회(호출당 프리픽스 ~15k는 대부분 캐시리드), API 현금 ~$3, 달력 약 2주.** 선택 웨이브 전부 포함 시 출력 ~5.2M 토큰, API ~$95, 달력 ~3–4주.

참고 비교: 같은 범위를 API 배치로 풀 T1 승격 시 5,177편 × $1.9 ≈ **$9,800**. 패리티 킷은 그 격차 중 앱에 보이는 부분만 구독 정액으로 흡수하는 설계다.

---

## §7 코드 변경 목록 (전부 서버 — 앱 릴리즈 불필요)

1. `supabase/migrations/0136_film_leads.sql` — §3.1 (+ 선택 시 affinities.method).
2. `worker/parity-extract.py` — 편별 컨텍스트 수집 → `data/gen/src/leads.json` (Mgmt API, 400행 페이지, 오프피크).
3. `scripts/gen-run.mjs` — i18n 러너 포크 (§4 승계 목록 전부).
4. `scripts/gen-audit.mjs` — 에코 감사 (오프닝 n-gram·길이 분포).
5. `scripts/load-film-leads.mjs` / `load-director-facts.mjs` — 오너 `!` 적재, gentle.
6. BFF 2곳: `app/api/v1/app/film/[slug]/route.ts` 폴백체인(§3.1), `tonight/route.ts` 카드 리드 동일 체인. **캐시 키 범프 필수** (payload 소스 변경 — Tier2 무료확장 때의 캐시 함정 재발 금지).
7. 웹 보강: `app/film/[slug]/_shared.tsx` Tier2 블록에 Invitation 섹션 (T1의 `df-invitation`과 동일 크롬, **바이라인 "Metatake AI Editorial"** — AI 크레딧 규칙상 '인간검토' 표기 금지). 로더 캐시 키 `film-load8` → `film-load9`.
8. (결정 D4 채택 시) 감독 BFF 필모그래피 `.eq("visible", true)` 완화 — 앱 BFF만, 웹 허브는 불변.
9. 배포: 워처 범위(app/components/lib)는 스테이징 자동, **마이그·worker·scripts는 수동 커밋** (기존 워처 범위 규칙).

---

## §8 오너 결정 대기

| # | 질문 | 기본안 |
|---|---|---|
| D1 | K1 문체·표기: 웹 Tier2 페이지에도 Invitation을 렌더할지(앱 전용 vs 앱+웹). scaled-content 방침과의 조화는 §9-1 | 앱+웹 렌더, 색인 게이트 불변 |
| D2 | K4 친연 임베딩 — OpenAI API ~$50 지출 승인 여부 (거부 시 For You는 T2에서 계속 숨김 = 현상 유지) | 보류 (저노출 섹션) |
| D3 | 신규 감독 생성 — 기존 "미매칭 감독 생성 금지" 결정을 ≥2편 보유 694명에 한해 해제할지 | 보류 (기존 결정 존중) |
| D4 | 앱 필모그래피에 Tier2 영화 포함 여부 (§7-8) | 포함 (앱만) |
| D5 | 페이싱 상한 — 주간 게이지 몇 %까지 이 레인에 허용할지 (i18n 복구·hourly와 공유) | 80% 정지선, i18n 복구 우선 |

---

## §9 리스크 · 함정

1. **Scaled content abuse 방침과의 조화**: almanac의 금지는 "색인을 위해 채워 보이게 하는 산문"이다. 본 레인은 ① 색인 게이트·사이트맵·캡 일절 불변 ② 생성물은 사용자 제품 표면(앱 우선) ③ 자기부정문 금지 원칙 유지 — 로 구분선을 지킨다. 그래도 웹 렌더(D1)는 오너 판단 사항.
2. **구독 게이지 공유**: hourly(시간당 ~15k 프리픽스) + i18n 복구 + 오너 대화와 같은 통장. extra usage ON이면 조용히 재과금 — **매 런 전 OFF 확인.**
3. **DB 부하**: 추출·적재 모두 게이트(§3.4). 08-06 포화 직후이므로 첫 주는 야간만.
4. **품질 수렴**: 5,200편 일괄 생성은 문형이 닮는다 — 에코 감사 불통과 배치는 requeue (§4).
5. **figures/takes 오염 금지**: K1을 takes에 넣고 싶은 유혹 금지 — §3.1의 기각 사유(크롤 표면·트리거·파생층) 참조.
6. **캐시 함정**: BFF·웹 로더 캐시 키 범프 없이는 "생성했는데 안 보임" 오진. 라이브 감사는 캐시버스터로.
7. **경로 부패**: factory-watch.sh 등엔 아직 `Documents/MetaTake` 스테일 경로가 남아 있다. 새 스크립트는 전부 `Developer/MetaTake` 기준 + 상대경로 금지.

---

## §9.5 실행 상태 (2026-08-06 오전, 무인 운전 개시)

**지어진 것** — 전부 신규 파일이며 `app/`·`components/`·`lib/`는 한 글자도 건드리지 않았다
(워처가 그 경로를 자동 배포하므로 오너 부재 중 편집은 곧 배포다):

| 파일 | 역할 |
|---|---|
| `supabase/migrations/0136_film_leads.sql` | 가산 테이블 (**미적용**) |
| `worker/parity-extract.py` | 코호트·팩트블록 추출 (읽기 전용, 300행 페이지, 2초 간격) |
| `worker/db-health.py` | `select 1` 한 발로 DB 생사 판정 — 무인 작업이 아픈 DB를 재촉하지 않게 |
| `data/gen/prompts/lead-en.md` | 초대문 헌장 |
| `data/gen/prompts/life-en.md` | 감독 The Life 헌장 (출처 URL 필수) |
| `scripts/gen-run.mjs` | 구독토큰 생성 러너 (RUN_ID 파일명·서킷브레이커·재큐) |
| `scripts/gen-audit.mjs` | 코퍼스 단위 품질 계기판 (에코·첫머리 쏠림·문장장 CV·연도 근거) |
| `scripts/gen-completeness.mjs` | **디스크** 기준 진도 (레저는 참고만) |
| `scripts/load-film-leads.mjs` | 유일한 DB 쓰기 — 오너 수동 실행 |
| `worker/parity-supervise.sh` | 무인 감독관 (기동 완료, 대기 중) |
| `.claude/agents/parity-qc.md` | 품질 관리 에이전트 |
| `docs/PATCH-app-parity-surfaces.md` | BFF·웹 패치 (적용 가능 상태로 보류) |
| `docs/RUNBOOK-app-parity.md` | 복귀 브리핑·계정 교체 실행법 |

**연기 시험 (3편, 실제 `claude -p`)**: 2편 집필 + 1편 **정직한 거부**(재료가 제목·연도뿐).
첫 문장 103·104자로 덱 카드에 홀로 서고, 근거 밖 사실 없음, 템플릿 상투 0. 출력 8,124토큰.
발견된 결함 1건 — **고유명 발음 부호 탈락**(Sembène→Sembene). 헌장 + 린트 양쪽에 규칙 추가.

**헌장 개정 (오너 지적 반영)**: 금지 문구를 글자 그대로 나열하면 그 문구를 심어주는 역효과가
난다. §4를 "수법의 순서를 거부하라"는 구조적 지시로 바꾸고, 문자열 단속은 린트가 조용히
맡도록 분리했다. §5의 소재 목록도 "차례가 아니라 숨은 자리"임을 명시 — 목록 자체가 새 공식이
되는 것을 막기 위해.

**차단 요인**: 08-06 08:02 관리자 명령에 의한 DB 재기동, 09:49~ statement timeout 폭주.
연결 슬롯 고갈로 추출 불가. 계정 문제 아님(비-DB Management 엔드포인트 정상, MCP·서비스롤
PostgREST 동일 실패). 상세는 `docs/RUNBOOK-app-parity.md` §3. 10:09 기준 8초 응답으로 회복
조짐. 감독관이 2회 연속 건강 확인 후 자동 착수한다.

## §10 수용 기준 · 검증

- W1a 완료 판정: `select count(*) from film_leads` = 5,200 ± 결측 로그, 디스크 파일 대조(레저 아님) 통과, 에코 감사 통과.
- 앱 실물 확인: Tonight 덱에서 Tier2 카드에 세리프 리드 노출, 필름 브리프 Invitation 섹션 렌더 (스테이징 → 실기기).
- 웹: Tier2 영화 페이지에 Invitation 섹션 + 바이라인, robots 메타 **이전과 동일함을 diff로 확인**.
- W2a: The Life 섹션이 임의 표본 20편의 T2 필름 브리프에 노출, facts 출처 URL curl 200.
- 회귀 금지: `filmIndexBar`·`directorIndexBar`·사이트맵 카운트 변동 0 (스냅샷 대조).

검증 쿼리 묶음은 본 문서 작성 시점의 실측 쿼리를 `worker/parity-extract.py --report`로 이식해 재실행 가능하게 한다 (프로덕션 count는 `--confirm` 필수).
