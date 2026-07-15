# PLAN — SEO 표면 전면 개방 + URL 영속성 아키텍처

*작성 2026-07-04. 전제: sitemap 인덱스 11분할 라이브, IndexNow 가동, www 308, GSC 색인 초기 단계(3페이지).*
*자매 문서: PLAN-atlas-seo.md (지도/위치 페이지 — 본 문서는 참조만 하고 중복 기획하지 않음).*

---

## 0. 결론 — "한꺼번에"의 올바른 형태

**모든 섹션을 동시에 개방하되, 게이트는 페이지 단위, 계기판은 섹션 단위, 철회는 스위치 한 개.**

- 새 표면(whereto/theorist/genre/허브)은 **DB 퍼블리싱**(엔티티·유틸리티·분류) 계열이다. LLM 에세이 코퍼스(readings/tropes)와 위험 등급이 다르다 — 구글이 경계하는 것은 "대량 생성 산문"이지 IMDb형 데이터 페이지가 아니다. 따라서 섹션 동시 개방은 정당하다.
- 단 **에세이 코퍼스의 기존 코호트 캡은 그대로 유지**한다. 이번 개방과 별개 트랙. *([UPDATE 2026-07-14] "7/16 리뷰" 앵커는 지난 프레이밍 — Tier-2 필름 색인은 별도로 2026-07-14 개방됨, → `HANDOFF-SEO-스타터가이드-작업지시서.md §2`.)*
- 각 섹션 = sitemap 인덱스의 자식 1개 = GSC 계기판 1개. 특정 섹션에서 "크롤링됨-미색인"이 쌓이면 **그 자식만 인덱스에서 제거**(1줄 수정)하면 된다. 페이지는 계속 살아있고 noindex도 안 붙이므로 불이익 없이 후퇴 가능.
- "누구나 만들 수 없는 데이터"의 증명은 선언이 아니라 **페이지당 데이터 밀도 게이트**가 한다: 게이트를 통과 못 하는 페이지는 광고하지 않는다.

## 1. URL 영속성 아키텍처 (링크가 변해도 유의미하게)

### 원칙 1 — 날짜의 사중 기록 (현재 결손: JSON-LD에 날짜 없음)
같은 날짜가 네 곳에서 일치해야 구글이 신뢰한다:
DB(created_at/updated_at) → **JSON-LD datePublished/dateModified** → sitemap lastmod → 페이지 가시 표기("Updated Jul 2026").
- [ ] Article(trope/take)에 datePublished/dateModified 추가. 데이터는 이미 있음(updated_at) — 템플릿 몇 줄. **[UPDATE 2026-07-15] QAPage(q)→Article로 전환·figure FAQPage 제거**(Tier-2 메인 통합, commit 5e8f507) — 이 두 항목은 무의미해짐. → 정본: `HANDOFF-Tier2-메인통합.md §3`.
- [ ] 페이지 하단 가시 날짜는 선택이지만 권장(사람+AI 엔진 둘 다 읽음).

### 원칙 2 — slug_aliases 전역 리다이렉트 원장 (신규 테이블)
```sql
create table slug_aliases (
  old_path text primary key,       -- '/theorist/deleuze-guattari'
  new_path text not null,          -- '/theorist/gilles-deleuze'
  reason text,                     -- 'canonical merge' | 'rename' | ...
  created_at timestamptz default now()
);
```
- 모든 동적 라우트의 miss 경로: DB 조회 실패 → aliases 조회 → 있으면 `permanentRedirect(new_path)`, 없으면 `notFound()`. 공용 헬퍼 `resolveAlias(path)` 하나로 통일.
- 효과: **이후 어떤 개명·병합도 INSERT 1줄**로 옛 링크가 영구 생존. 링크 자산이 308로 이전. meta_takes.merged_into는 기존대로 두고, 새 표면부터 이 원장을 쓴다.
- sitemap은 alias를 절대 싣지 않는다(정본만).

### 원칙 3 — 불변 ID 접미사
- 이미 준수: credits(`-12453` tmdb id), q(`-mq4c2moe`), film(`-1999` 연도).
- theorist는 정본화 과정에서 병합이 예정돼 있으므로 **인명 slug 유지 + 병합 시 aliases 원장 기록**으로 대응(id 접미사보다 검색구문 가치가 큼).

### 원칙 4 — 엔티티 @id + 외부 앵커 (URL이 변해도 정체성 불변)
- 모든 엔티티 JSON-LD에 `@id`(정본 URL) 부여.
- **sameAs 외부 앵커**: 인물(credits/director) → TMDB person URL(+가능하면 Wikidata), theorist → **Wikidata QID**(Agamben=Q76819 등), film → 이미 wikidata_id 컬럼 보유 → Movie sameAs로 출력.
- 동일 인물 이중 URL(credits ↔ director): 상단 상호링크 + 서로를 sameAs로 지목. 지식그래프에서 하나의 실체로 봉합.

### 원칙 5 — URL 생성 단일화 (lib/urls.ts 신규)
- `filmUrl(slug)`, `theoristUrl(slug)`, `creditsUrl(name,id)`… 엔티티당 함수 1개. 신규 코드는 전부 이걸 쓰고, 기존 코드는 만질 때마다 점진 이행.
- 라우트 개명 = 헬퍼 1줄 + aliases 벌크 INSERT + (필요시) next.config redirect. 개명 비용이 상수가 된다.

## 2. 섹션별 개방 스펙

| 섹션 | 자식 sitemap | 규모 | 페이지 게이트(광고 조건) | 스키마 | LLM 필요 |
|---|---|---|---|---|---|
| 허브 7종(genre·tradition·lineage·frames·trending·where-to-watch·map) | core.xml 추가 | 7 | 없음 | 기존 | 없음 |
| genre/[slug] | genres.xml | ~수십 | 영화 ≥5편 | ItemList+Breadcrumb | 없음 |
| whereto/[slug] | whereto.xml | ≤1,935 | provider 데이터 존재 + film visible + **편집 산문 동반**(기존 why-watch/figures 재사용) | Movie+offers | 없음 |
| theorist/[slug] | theorists.xml | 1,840→정본화 후 축소 | **정본 행 + linked readings ≥3 + Wikidata QID 매칭** | Person(sameAs QID)+ItemList | **Haiku 2건**(아래) |
| credits↔director 통합 | (sitemap 변화 없음) | — | — | @id/sameAs 봉합 | 없음 |
| locations | PLAN-atlas-seo.md | — | 그 문서의 게이트 | — | 그 문서 참조 |

**버그 동시 수정**: /map·/lineage 제목의 "· Metatake" 중복 접미사.

**A–Z 인덱스**: /credits와 /theorist에 알파벳 브라우즈 페이지(크롤 경로 + 이용자 탐색). 템플릿 1개 재사용.

## 3. Haiku 투입 지점 (딱 두 건, 소규모=동기 원칙)

1. **theorist 정본화 제안**: 1,840행 → {정본명, 병합대상(복합표기 행), 확신도} CSV. 복합표기("Deleuze & Guattari")는 분해 제안. **원우 검토·승인 후** 반영, 병합은 전부 aliases 원장에 기록. ~1,840건 실시간 병렬 호출, 비용 수 달러.
2. **theorist → Wikidata QID 매칭**: 후보 QID 제안 + wikidata API로 기계 검증(생몰년·직업 교차확인). 검증 실패분만 수동. 비용 수 달러.

그 외는 전부 SQL·템플릿. whereto의 산문은 기존 why-watch 자산 재사용이므로 신규 생성 없음.

## 4. "복제 불가 데이터" 증명 신호 (검색엔진에게 알리는 법)

선언으로 알릴 수 없다. 기계가 읽는 증거로 알린다:
1. **밀도**: 게이트 통과 페이지만 광고 → 모든 광고 페이지에 고유 해석 그래프 링크 다수(readings·figures·tropes 상호 참조).
2. **정합성**: 엔티티 @id + Wikidata/TMDB 앵커 → 지식그래프 교차검증 가능.
3. **날짜 규율**: 사중 일치(원칙 1) → 콘텐츠 이력 신뢰.
4. **책임 주체**: E-E-A-T 체인(완료: editor 페이지·sameAs 프로필·byline).
5. **외부 인용 축적**: Substack 이슈마다 딥링크 2–3개(운영 루틴), 프로필 역링크(완료).

## 5. 실행 순서 · 검증 · 롤백

- **Phase 0 (즉시, 코드만)**: 제목 버그, 허브 7종 core.xml, 날짜 JSON-LD 전면 추가, slug_aliases 테이블+resolveAlias, lib/urls.ts 뼈대, film Movie에 wikidata sameAs.
- **Phase 1 (Phase 0 배포 직후)**: whereto.xml + genres.xml + credits↔director 봉합 + A–Z 인덱스. → GSC 재제출.
- **Phase 2 (원우 승인 후)**: Haiku 정본화 → 원우 검토 → 병합+aliases → theorists.xml 개방.
- **Phase 3**: locations (PLAN-atlas-seo.md, 지도 데이터 완성 신호 대기).
- **검증**: 주간 GSC 섹션별 색인률·노출·크롤링됨-미색인 비율. 특정 섹션 악화 시 해당 자식만 인덱스에서 제거(후퇴), 2주 후 재시도.
## 7. Tier-2 (비공개 5,040편) 전략 — 3층 구조 실행 (2026-07-04 저녁, 1·2층 완료)

- **1층(완료)**: Tier-2 film 템플릿 재구축 — noindex,follow 유지, Movie JSON-LD(@id·alternateName·sameAs), 자국어 원제 헤더, 크루 링크, 모듈 4종(감독 포스터[Tier-1 우선]·같은 전통 정독작·장르·시청처). Tier-1 경로 불변 검증.
- **데이터 기반(완료)**: worker/tier2-backfill/backfill.mjs — TMDB fill-only 백필 3라운드: 원제 2,531 / overview 273 / genres 4,962 / runtime 4,989 / release_date 5,012 / tagline 2,273 / 감독명 5,021. 멱등, visible=true 불가침. director_slug는 파이프라인 소관(불기록).
- **2층(완료)**: 컬렉션 4종에 "not yet read closely" 멤버 섹션(포스터+원제+연도, +N more): lineage(RPC가 원래 전체 멤버 반환 — 분리 표기), genre(.overlaps, 1000행 캡 버그 동시 수정), director(slug-or-name 매칭), movements(신규 RPC public.movement_hidden_films — curation.film_hub 조인, SECURITY DEFINER, anon grant).
- **3층 — ✅ SHIPPED 2026-07-14**: 개별 Tier-2 선별 색인 개방은 `lib/seo.ts filmIndexBar`(film_reception≥3 OR film_lineage≥3 OR film_wd_honors≥3 AND film_provider_index≥1)로 실행 — figures≥3 승급제가 **아니고** films2.xml도 **아님**(메인 films.xml 편입, **1,105편** 개방·색인 필름 메인 1,959→~3,064). 수요 기반 우선순위 루프는 GSC 관찰 후. → 실측·정본: `HANDOFF-SEO-스타터가이드-작업지시서.md §2` / `lib/seo.ts filmIndexBar`.

## 6. 포털 9종 감사·업그레이드 (2026-07-04 오후, 원우 지시로 실행)

감사 결과: 9개 허브 전부 JSON-LD 전무가 유일한 공통 결손(제목·크롤 링크는 대체로 양호). 적용 표준: CollectionPage + BreadcrumbList + ItemList(@graph). 개별 수리: /takescore 제목 중복접미사 + 랭킹 롱테일 서버렌더(상위 60만 크롤 가능했음 → 500), /catalog 제목 중복접미사 + canonical 부재, /credits h1 부재, sitemap core에 /takescore·/catalog·/theorist 추가.

**미결(원우 결정 필요)**:
- **/idea ↔ /concept 중복 표면**: 같은 개념 우주를 다른 slug 체계로 이중 서빙(/idea/death-drive vs /concept/death-drive-todestrieb). 현재 /idea 전체 noindex,follow(2026-07-04) — 안전한 임시 상태. 궁극 해법은 slug 매핑표 작성 후 /idea/* → /concept/* 308(slug_aliases) 통합. 매핑은 콘텐츠 판단이라 보류.
- **/catalog/[seg] 아키타입 트리** (2026-07-04 오후 전수조사 완료): 전체 2,928노드 / ≥3멤버 1,665 / 쿼리형 named(object·place·character·theme) 917. 노드 페이지는 정의+멤버 목록(≤120)+kindred 필로 non-thin, on-page robots는 ≥1멤버. **Phase A(실행)**: named ≥3멤버, INDEX_COHORT_CATALOG=500, 섹션 4페이지 포함 → catalog.xml. **Phase B(보류)**: tier류(identity/complex/types/categories) ≥5멤버 +~590 URL — Phase A가 GSC에서 버티면. 노드·섹션 페이지 JSON-LD(DefinedTerm/CollectionPage) 선행 완료(2026-07-04). char_function·theme_cluster는 전부 0멤버(빈 kind).

- **원우 결정(2026-07-04 확정)**: ① theorist 복합표기는 **분해하지 않는다** — 현재 같은 행이면 같은 엔티티로 유지; Phase 2 정본화는 중복 행 정리·QID 매칭만 수행. ② whereto는 **전면 개방** — 게이트 대신 합성 설계(코퍼스 블록 동반)로 thin을 구조적으로 제거; 광고 조건은 시청 데이터(film_watch_providers 행 또는 access_enrichment 레코드) 보유. ③ Phase 0/1 착수 승인됨(2026-07-04 실행).
