# HANDOFF — Metatake 데이터 사업 (API → 컨텍스트 팩) 마스터 인수인계

*2026-07-03 작성. 이 문서 하나로 다음 AI 세션이 대화 맥락 없이 사업 전체를 인수인계받을 수 있도록 작성됨. 세부 근거는 `docs/PLAN-api-service.md`(API 기획)와 `docs/PLAN-ai-context-packs.md`(파일 제공 기획)에 있고, 본 문서는 왜·무엇을·어떻게·다음 할 일을 통합한 최상위 문서다.*

---

## 1. 이 문서가 다루는 것 (현재 상태 한 줄)

**"metatake.net의 데이터 자산을 외부에 판매/제공하는 사업"의 타당성 검토가 완료되었고, 실행 방향이 확정되었으며(파일 제공형 '컨텍스트 팩' 선행 → 수요 입증 시 API 승격), 아직 코드 구현은 시작하지 않았다.** 다음 세션의 첫 작업은 §8의 W1이다.

---

## 2. 왜 시작했나 (동기와 원 질문)

소유자(원우)는 metatake.net이 **API를 제공하는 서비스가 될 수 있는지** 검토를 요청했다. 관심사: ① API화 가능한 분야·부분·이유, ② 제공 방법, ③ 경쟁 관계, ④ 영화계가 필요로 하는 것, ⑤ 개인 영화 사이트 빌더들에게 제공할 것, ⑥ 소유자가 얻을 것, ⑦ 관리 비용.

이후 소유자가 방향을 스스로 피벗: **API가 아니라, 영화마다 "복사하기"를 누르면 MD 파일/AI 친화 데이터가 다운되어 사용자가 자기 AI에 넣고 자기 글을 쓰게 하는 파일 제공 방식**(유료 또는 무료, "필요한 사람 가져가라")을 기획해 달라고 요청. 이것이 현재 확정된 1차 실행 방향이다.

**전사(前史):** `Metatake_자체LLM_타당성_전략검토.md`(2026-06-17)가 이미 "자체 모델 학습은 함정, RAG/데이터가 해자, 수익 표면 4개 중 ③ 데이터/API 라이선스" 결론을 내렸고, 이번 검토는 그 ③의 구체화다.

---

## 3. 무엇을 조사했나 (방법, 재현 가능하게)

2026-07-03에 4개 병렬 리서치 에이전트 + 직접 DB/코드 실측을 수행 (~400 웹 조회, 핵심 주장 적대적 검증 통과):

1. **코드베이스 감사** — `app/api/*` 전 라우트, 데이터 출처(ingestion 스크립트), RLS/키 구조, 재사용 가능한 RPC 인벤토리.
2. **경쟁 환경** — TMDb/OMDb/IMDb/Gracenote/JustWatch/Watchmode/Letterboxd 등 가격·약관 실측, 5개 자산군 갭 분석.
3. **수요 측** — 인디 개발자·AI 기업·영화 산업·관광 부문의 문서화된 수요와 지불 의사.
4. **수익화·비용·법률** — 마켓플레이스/게이트웨이/과금 옵션, 인프라 비용 모델, 재판매 법률 제약, AI 생성물 저작권.

라이브 DB `jvgarcqrtsmgfimdcwgo` 실측 병행 (테이블 크기, 코퍼스 총량, 출처 필드, 트래픽).

---

## 4. 확정된 사실 (이 위에서 모든 결정이 섬)

### 4.1 자산 인벤토리 (실측 2026-07-03)

**판매 가능 (100% 자체 생성, class A):**
| 자산 | 규모 |
|---|---|
| 해석 코퍼스 (takes) | 26,975 발행 / 73,478 총, 평균 472자, 발행분 12.7M자. `source='ai'` (Claude로 생성) |
| 트로프 허브 (meta_takes kind=figure_type) | 4,710 발행, 에세이 1.2M자 |
| figures | 18,168 (설명 2.9M자) |
| TakeScore (cinecodex.scores) | 6,701편 × 13차원 (V/C/R/U/S + cog/aff/form/moral 등) |
| 정전가 (film_scores) | 5,977편 (prestige/discovery) |
| 촬영지 (film_locations) | 22,655핀 · 2,613편 (filmed/setting 층, scene_role 산문 포함). 출처: agent-search/agent-filmed = LLM 리서치 산출물 |
| lineage (canon/award/festival) | film_lineage 10,551 · lineage_lists 398 |
| film_affinities | 38,800 엣지 |
| 이론 DB | theory_canon 2,587 · theorists 1,840 · sm_concepts 1,227 |
| 임베딩 | 1536-d, figures/takes/meta_takes 3축 |

**판매 불가 (유료 상품에서 반드시 제외):**
- `film_watch_providers` — JustWatch(TMDB 경유), 이중 계약 위반. 가장 명백한 금지.
- `film_ratings` — OMDb 유래(CC BY-NC), 상업 재배포 불가.
- TMDB 메타데이터·포스터 경로 — TMDB 약관이 상업이용·파생물·AI/ML 이용을 명시 금지. (tmdb_id/imdb_id/wikidata_id 같은 크로스 ID 자체는 사실 정보라 저위험 — 포함 가능)
- `film_reception`의 verbatim 인용 2,557건 — AP v. Meltwater 판례(유료 재배포 서비스의 짧은 발췌 = fair use 부정). 사이트 표시용으로만.
- **지오 좌표 중 Google Geocoding 유래분** — Google ToS상 재배포 불가. `geo_cache.source='nominatim'`(OSM ODbL, 출처표기)만 상품에 포함. Google 유래분은 Nominatim 재지오코딩으로 세탁 가능(~1일 작업).

### 4.2 시장 (검증됨)

- **5개 자산군 전부 직접 경쟁자 0**: 장문 해석 API 없음(Gracenote 태그/RT 스니펫이 최대, 연 $60k+), canon 집계 상품 전무(TSPDT는 무료 엑셀), **촬영지 API 시장에 전무**(TMDb 8년 미방치 요청 스레드 존재, IMDb는 연 $150k 상품에서도 촬영지 제외), 다차원 스코어 없음(Parrot은 '수요' 측정, 월 ~$10k), 영화 임베딩 서비스 없음.
- 니치 데이터 API 상용 티어 시장 가격: **$200–350/월**에 수렴. 엔터프라이즈 앵커: IMDb $50k–400k/년.
- **Letterboxd는 데이터분석·추천·LLM 용도의 API 접근을 명시 거부** — 그 거부된 수요가 우리 잠재 고객.
- Gracenote가 2026-03 OpenAI 제소 → AI 기업들이 해석형 영화 데이터를 합법적으로 살 곳이 없는 상태.
- **경쟁자 부재 ≠ 수요 존재.** 문서화된 실수요는 촬영지·canon·트로프 3개 축뿐.

### 4.3 법률 (확정)

- **순수 AI 생성물은 저작권 없음** — 미국 확정(Thaler, 2026-03 대법원 상고기각), EU 동방향. → "복제 금지"로는 방어 불가. 방어선 = **키/로그인 게이팅 + 구독 계약(클릭랩 ToS)** (EU는 Ryanair v. PR Aviation이 계약 방식 뒷받침).
- **AI 학습데이터로 파는 길은 죽은 경로**: 라이선스할 권리가 약함 + 랩이 $3–15k면 유사 코퍼스 재생성 가능 + 시장 규범이 인간 저작 중심. 27k 코퍼스의 가치 = 팔 자산이 아니라 **제품 차별화 층 + RAG 검색 층**.

### 4.4 인프라·비용 (검증됨)

- 현 스택: Next.js(Vercel, hnd1 고정) + Supabase(도쿄, DB 3.5GB). 증분 비용: 컨텍스트 팩 ~$0, API여도 Cloudflare 무료 캐시 얹으면 10M req/월까지 ~$25–50/월.
- 결제: **RapidAPI 배제**(25% 수수료 + PayPal net-60 + 월례 장애). 권장: **Polar.sh**(MoR, 5%+50¢, VAT/JCT 대행 — 한국 사업자에 유리) 또는 Stripe(3.6%+30¢). 선불 중심.
- **주의 — 현 코드의 상용화 결격 사항**: ① API 키/미터링 인프라 전무, ② 레이트리밋은 인메모리(과금 불가), ③ **anon key + SECURITY DEFINER RPC 구조로 전 공개 콘텐츠가 DB 엣지에서 무료 접근 가능**(유료 경계 설계 필요), ④ `next.config.ts`의 `/tmp-sql` 와일드카드 CORS 잔존(제거 대상), ⑤ `/api/films/backfill`이 무인증, ⑥ middleware가 `/api/*`에도 auth 왕복 수행(분리 대상).

### 4.5 수요·수익 현실 (추정, 근거 있는)

- 사이트 트래픽 **주 ~140뷰**(view_events 실측; 추적 부분적일 수 있음) → **최대 병목은 데이터가 아니라 배포/발견**.
- API 셀프서브 1년차: P50 $200–800 MRR, P90 $2–5k MRR. 컨텍스트 팩: 트래픽 월 1만뷰 도달 시 $50–300 MRR 시나리오.
- **최대 단일 기회는 관광/기관 맞춤 딜(연 $5–30k/건)**: set-jetting 제도화(Expedia 조사, VisitBritain £217M 캠페인), **KTO가 2026-06-17 스튜디오드래곤과 '한류 올레길' MOU 체결**(홈그라운드 활성 바이어). 동일 규모 경쟁자 SetJetters(~1만 핀)도 API가 아닌 관광청 파트너십으로 수익화. 단, 우리 코퍼스는 아트하우스 중심이라 K-콘텐츠 커버리지 보강이 피칭 선행 과제.

---

## 5. 전략 결정 (확정된 것)

1. **파일 제공형 '컨텍스트 팩'을 먼저 한다. API는 그 수요 데이터로 승격 여부를 판정한다.** (소유자 피벗 + 운영비용 0 + 비개발자 시장이 더 넓음)
2. 용어·설계 교정: 사용자는 파인튜닝하지 않는다 — **Claude Projects/Custom GPT/NotebookLM에 첨부하는 컨텍스트 팩**으로 설계. 파인튜닝 JSONL은 기관 티어 부속만.
3. **무료/유료 경계는 '깊이'가 아니라 '규모'**: 1편 복사는 무료(어차피 공개 콘텐츠, 출처 라인이 마케팅), 벌크만 로그인+결제+캡 뒤에. 봇 우려에 대한 답.
4. 유료 파일마다 **구매자별 지문(canary)** — 저작권 없어도 계약 위반 증거 확보.
5. AI 학습데이터 판매 기대는 접는다. 관광/기관 딜을 병행 트랙으로 유지한다.
6. "AI 생성물 판매" 비판에는 정면 돌파(팩 표지에 생성 방법·검수 체계 명시 — PLAN-고유가치의 프로비넌스 원칙과 동일 노선).

---

## 6. 우리가 노리는 것 (목표 계층 — 위가 진짜 목표)

1. **배포·브랜드**: Copy-for-AI 복사본마다 출처가 사용자의 AI 워크플로에 침투 → 백링크·인용·SEO (현 최대 약점인 트래픽 보완). AI 검색/MCP 시대에 "영화 해석·촬영지의 구조화 소스" 포지션 선점.
2. **수요 데이터**: 복사 버튼 클릭 로그 = 공짜 시장조사 → API/MCP 투자 판단 근거.
3. **소액 MRR**: Creator Pass·번들로 월 수십~수백 달러 (트래픽 성장에 비례).
4. **옵션 가치**: 관광청/교육/메타데이터 벤더 딜의 영업 자료(살아있는 데모 + 견적 단위), Gracenote-OpenAI 소송 이후 열릴 "합법 해석 데이터 공급자" 자리.

---

## 7. 상품 구조 (확정 설계 — 세부는 PLAN-ai-context-packs.md)

| 티어 | 내용 | 가격 |
|---|---|---|
| **L0** | 전 영화 페이지 "Copy for AI" 버튼 — 트림판 마크다운 8–15KB 클립보드 복사(대표 take 8–12개 프레임워크 다양성 샘플링 + 점수 요약 + 출처 라인) | 무료 (CC BY-NC + 출처표기) |
| **L1** | Film Pack 풀판(그 영화의 전체 class-A 자산, .md+.json, 30–150KB) — **Creator Pass**로 무제한 | $9/월 · $49/년 |
| **L2** | 번들: 감독 팩·프레임워크 팩·canon 100 팩·촬영지 팩 등 | $19–79/개 |
| **L3** | Corpus License: 분기 버전드 전체 덤프(Parquet+JSONL+MD) + 내부 RAG/제품 이용권 | $299(개인)–999+(기관)/년 |

팩 포맷: frontmatter(식별자·점수·라이선스·pack_id 지문) + 본문(프레임워크별 리딩 전문, "How to use this file" 섹션 내장). 스포일러 가드 태그 유지. **화이트리스트 RPC로 금지 필드(§4.1) 원천 차단.**

---

## 8. 실행 계획 (다음 세션이 바로 시작할 일)

### W1 — 위생 + L0 (여기부터 시작) ★
1. RPC `film_context_pack(slug, tier)` 신규 — class-A 필드 화이트리스트로만 조립, 트림판/풀판 분기. 기존 SECURITY DEFINER 패턴. (⚠️ 마이그레이션 파일로도 커밋할 것 — 스키마-in-VCS 갭이 이미 구조 리스크임, STATE.md §4 참조)
2. 지오 필터: 팩·향후 상품의 좌표는 `geo_cache.source='nominatim'`만. (여유 되면 Google 유래분 Nominatim 재지오코딩 백필)
3. 영화 페이지에 `Copy for AI` 버튼(무인증, 클립보드) + 클릭 로깅(`content_events` 재사용, event='copy_for_ai').
4. 기술 부채: `/tmp-sql` CORS 제거 · `/api/films/backfill` 인증 추가 · middleware에서 `/api/*` auth 왕복 분리.
5. Vercel Spend Management 알림 활성화.

### W2 — 스토어 + 결제
6. `/data` 스토어 페이지(상품·라이선스 문구) + `/data/license`(Creator License 전문: 허용 = 자기 콘텐츠 제작·소규모 상업 / 금지 = 재배포·재판매·경쟁 데이터셋·대량 LLM 학습).
7. Polar.sh 연동(또는 Stripe payment link) + `pack_entitlements` 테이블 + webhook + 다운로드 캡(예: 일 50팩) + 서명 URL.
8. 풀팩에 구매자별 pack_id 지문 삽입.

### W3–4 — 번들 + 런치
9. 번들 5종 생성(감독 2, 프레임워크 1, canon 1, 촬영지 1).
10. HF gated dataset에 무료 샘플 20편(발견 채널) + llms.txt 갱신 + Cloudflare pay-per-crawl/TollBit 등록 검토.
11. 런치: Substack/아웃리치 리스트, r/TrueFilm, 영화 유튜버 커뮤니티, TMDb 포럼의 촬영지 미해결 스레드(직접 링크는 PLAN-api-service 소스 참조).

### 병행 트랙 — 관광 딜 (영업, 소유자 주도)
12. 한국 로케이션 커버리지 증분 생성(기존 geo 파이프라인 재사용) → KTO/서울관광재단/부산영상위 피칭 덱(라이브 Atlas 데모 중심). '한류 올레길' 일정 내.

### 판정 (W1 배포 + 90일)
- 복사 버튼 사용률·Pass 전환으로 결정: ① 라인 지속 ② **API 승격**(그때 `docs/PLAN-api-service.md`의 Phase 1 — Locations API부터) ③ 무료 SEO 기능으로 강등(매몰 없음).

---

## 9. 실무 제약 (이 리포에서 작업할 때 반드시)

- **로컬에 node/npm 없음** — 타입체크는 Vercel 빌드 상태(MCP)로, 스크립트는 python3.
- **auto-deploy 워처는 app/components/lib만 스테이징** — middleware, next.config.ts 등 루트 파일은 수동 커밋 필요.
- ISR 캐시 관례: dynamic [slug]는 `generateStaticParams(){return[]}` + `unstable_cache` 병용.
- PostgREST 응답 1000행 캡 — 대량 반환은 jsonb_agg 단일행 RPC 패턴(기존 `/api/geo`가 예시).
- Supabase 도쿄 / Vercel hnd1 고정(vercel.json).
- 대량 LLM 생성은 구독 세션이 아니라 Anthropic Message Batches API.

---

## 10. 문서 지도

| 문서 | 역할 |
|---|---|
| **본 문서** | 최상위 인수인계 (왜·무엇·결정·다음 할 일) |
| `docs/PLAN-ai-context-packs.md` | 1차 실행 상품의 상세 설계 (포맷·가격·봇 대응·구현·리스크) |
| `docs/PLAN-api-service.md` | API 사업 전체 기획 + **조사 결과 원본**(경쟁·수요·법률·비용 수치와 출처) — 승격 시 실행서 |
| `Metatake_자체LLM_타당성_전략검토.md` | 전사(前史): RAG-not-finetuning 결론, 수익 표면 4개 |
| `PLAN-고유가치-어필-기획서.md` | 커플링 필수인 SEO/프로비넌스 플랜 (트래픽 병목 해소) |
| `docs/STATE.md` | 사이트·DB 현황 (라이브 카운트, 라우트, 데이터 모델) |

## 11. 다음 세션 시작 프롬프트 (복붙용)

> `docs/HANDOFF-데이터사업-마스터.md`를 읽고 W1부터 실행해줘. 컨텍스트 팩 §8의 1–5번: film_context_pack RPC(화이트리스트), Copy for AI 버튼 + 클릭 로깅, 기술 부채 3건, 스펜드 알림.
