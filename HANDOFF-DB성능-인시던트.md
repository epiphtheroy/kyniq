# HANDOFF — DB 성능 인시던트 2026-07-17 · 사후 조치 정본

> ## 상태: 인시던트 종결(같은 날) · 후속 체크리스트 §3~§5 잔존
>
> **이 문서가 2026-07-17 "사이트·검색 느려짐" 인시던트와 그 후속 작업의 정본이다.**
> 인프라(Supabase 컴퓨트·DB 유지보수·검색 성능) 작업은 여기서 시작. 재발 시 §6 진단 순서부터.
> 관련 메모리: `memory/perf-incident-db-saturation-playbook.md`.

---

## §0. 한 줄 요약

단일 버그가 아니라 **소형 Supabase 컴퓨트(Micro, 1GB RAM)가 부하 중첩으로 CPU 포화**:
①TMDB ko 백필이 `films` 43%를 하루에 재작성(대다수가 no-op PATCH) ②같은 날 프로덕션 배포 9회로
ISR 캐시 반복 초기화(콜드렌더 폭풍) ③films-ko 사이트맵·hreflang으로 /ko 신규 URL 수천 개 크롤 유입.
결과: 3s statement timeout 연쇄 → unstable_cache null-poison 증폭 → 07:02 UTC Postgres 재시작(OOM 의심)
→ 06:59 UTC Supabase 오리진 Cloudflare 520/521 → 24h 504 975건.
**당일 해소**: 백필 kill + `VACUUM (ANALYZE) films` + 검색 인덱스 신설(0108) + **컴퓨트 Small(2GB) 업그레이드**.

## §1. 실측 증거 (진단 워크플로 5-에이전트, 2026-07-17 07:30 UTC 전후)

| 표면 | 증상 실측 |
|---|---|
| 엣지 캐시 HIT | 65~300ms — **정상**. CDN/네트워크 무죄 |
| 콜드 ISR 렌더 | 1.6~3.3s TTFB (film/director/takescore) |
| `/api/search` 신규 쿼리 | 1.5~6.3s (60s 엣지캐시라 실사용자는 거의 매번 슬로우패스) |
| DB | 9,548s 창에서 쿼리실행 7,442s(≈단일코어 78%)·3s timeout 연쇄·temp spill 8.6GB |
| Vercel | 504 975건/24h("Task timed out after 300s")·풀 고갈·Auth 동시열화 |
| /ko 코드 | **무죄** — 콜드 /ko가 EN과 동속(0.7~1.9s)·content_i18n 로더 캐시 정상(65ms/call) |

검색이 구조적으로 무거운 이유(인시던트 이전부터): `/api/search`=3 RPC 병렬. `search_all` 0.8~0.9s,
`search_essays` 0.09s, **`search_semantic` 최대 6s** — 7개 테이블(takes·essays·meta_takes·
film_taste_vector·director_embedding·theory_canon·taxonomy_nodes)에 벡터 최근접 스캔 각 1회.
1GB RAM에 HNSW 인덱스들이 미상주 → 콜드 쿼리마다 디스크 수천 블록. taxonomy_nodes는 인덱스
자체가 없어 Seq Scan 830ms/검색.

## §2. 완료 조치 (재실행 금지 — 전부 이미 반영됨)

| # | 조치 | 실행자 | 증거/위치 |
|---|---|---|---|
| 1 | TMDB 백필 프로세스 kill (PID 75018) | 오너 `!` | 16:13~16:47 KST 실행분까지 기록됨 |
| 2 | `VACUUM (ANALYZE) public.films` | 에이전트(MCP) | 07:37:51 UTC, dead_tup 85로 정리 |
| 3 | **마이그 0108: taxonomy_nodes 부분 HNSW** | 에이전트(MCP apply_migration) | **프로덕션 적용 완료**(인덱스 22MB 생성 확인). 파일 `supabase/migrations/0108_taxonomy_semantic_hnsw.sql` |
| 4 | ReadPlates 버그 수정: `film_affinities.id`(없는 컬럼)→`film_id` — 07-13 fd1bc60부터 **매 필름렌더 400 쿼리** | 에이전트 | `components/read/ReadPlates.tsx` (워킹트리) |
| 5 | 백필 스크립트 개선: no-op PATCH 스킵 + 부분 업데이트(기존값 NULL 덮어쓰기 제거) + `skipped` 카운터 | 에이전트 | `worker/tmdb-i18n-backfill.py` (워킹트리, py_compile 통과) |
| 6 | **컴퓨트 Micro→Small(2GB) 업그레이드** (+$5/월, 총 ~$30/월) | 오너 | 08:27:50 UTC 재시작 확인: shared_buffers 256→**512MB**·effective_cache 768→**1536MB**·work_mem 3.5→**5MB**·max_conn 60→**90** |
| 7 | 스펜드캡 판단: 해제해도 현 사용량 초과 0 (DB 4.9GB/8GB·egress 여유) | 확인 완료 | 해제 권고(보험 성격) |

## §3. ⚠️ 미커밋 워킹트리 변경 — 잃어버리면 안 됨 (다음 배포에 포함)

브랜치 `feat/locale-projection` 워킹트리에만 존재. `.autodeploy-off` 켜져 있어 자동배포 안 됨:

1. `components/read/ReadPlates.tsx` — §2-4. 배포 필요(런타임 코드).
2. `worker/tmdb-i18n-backfill.py` — §2-5. 로컬 스크립트라 **배포 불필요**, 커밋만 하면 됨.
3. `supabase/migrations/0108_taxonomy_semantic_hnsw.sql` — **DB엔 이미 적용됨. 절대 재적용하지 말 것**(중복 적용 방지 — `if not exists`라 무해하지만 불필요). 커밋은 장부 일치용.

배포 시점: 인시던트 교훈대로 **단독 배포 말고 다음 작업 배포에 합류**(배포=ISR 캐시 전체 초기화).

## §4. TMDB ko 백필 재개 런북 (누락 방지)

- **현황**: title_ko NULL **3,629편**(6,978 중; 오늘 --refill 부분 실행으로 5,035→3,629). d0bb8ab의
  `/translations` 해석 경로가 실제로 제목을 찾아냄(화양연화·기생충 등) — **다국어프로젝션.md §상태2의
  "재백필 무효(0추가)" 문구는 /translations 이전 버전 기준으로 대체됨**(해당 문서에 정정 주석 있음).
- **재개 명령**(수정된 스크립트 기준, 멱등): `python3 worker/tmdb-i18n-backfill.py --locale ko --refill --persist`
- **에티켓(§6 규칙)**: 심야(KST 02~07시)·배포일 회피. 수정판은 "찾은 게 없고 이미 fetched 마크 있는" 행을
  스킵하므로 이전처럼 3,600건 무의미 쓰기는 재발 안 함. 종료 로그의 `no-op skips` 수치로 확인.
- 남는 NULL(TMDB에 ko 없음)은 LLM 번역 필요(오너 스킵 상태) 또는 영어 폴백 — 다국어프로젝션.md 참조.

## §5. 남은 백로그 (중복 착수 방지용 — 착수 시 이 표를 갱신할 것)

| 우선순위 | 항목 | 내용/기대효과 | 상태 |
|---|---|---|---|
| P1 | Small 효과 재측정 | 워밍업(수시간) 후 `/api/search` 신규쿼리·콜드렌더 벤치. 목표: 검색 <1.5s·콜드 <1.5s. 미달 시 Medium(+$50/월) 검토 | **대기** |
| P2 | 워킹트리 3파일 커밋+배포 | §3 | **대기** |
| P3 | 검색 회복탄력성 | `lib/search.ts` RPC 3종에 타임아웃(현재 임베딩 레그만 1.2s 캡) + `/api/search` 캐시 60s→s-maxage 연장+SWR | 미착수 |
| P3 | film_lineage 전량 스윕 제거 | 캐시미스 렌더마다 1000행×10페이지 풀스캔(2.65h에 1,500회 실측). jsonb_agg 단일행 RPC로([[postgrest-1000-row-cap]] 패턴) | 미착수 |
| P4 | nav_counts·atlas_eligibility_json 캐시 | 사이트 단위 값인데 렌더마다 호출(nav_counts 33회/분). 장TTL 캐시/전역화 | 미착수 |
| P4 | takes(1.8GB) 인덱스 정리 | trgm 중복쌍(idx_takes_take_title_trgm=idx_takes_title_trgm) + 구형 ivfflat(부분 HNSW와 중복) 드랍 → 캐시 압박·쓰기 증폭 감소. **DDL·오너 결재** | 미착수 |
| P4 | `_bak_*` 테이블 ~520MB 정리 | 소형 인스턴스 캐시 잠식. **삭제라 오너 결재** | 미착수 |
| P5 | cinecodex_card 등 대형 RPC work_mem | 스필 24MB/call vs work_mem 5MB. 함수 내 `SET LOCAL work_mem` | 미착수 |
| P5 | loadLabels 캐시키 충돌(정합성) | `lib/i18n/dbLabel.ts:72` 키가 길이+앞3슬러그만 사용 — filmTitles.ts처럼 전체 정렬 리스트로 | 미착수 |
| P5 | 미들웨어 getUser 공개라우트 스킵 | 3s race는 라이브(762c20a)나 Auth 열화 시 로그인 사용자 +3s/페이지. user 소비처는 /admin·/crm·/settings·/me·/ask/new뿐 | 미착수 |

## §6. 재발 방지 규칙 (운영 캐논)

1. **대량 백필(--persist)은 심야 + 배포일 회피.** 배포 폭주일에 쓰기 배치를 겹치지 말 것.
2. **배포는 몰아서.** 배포 1회 = ISR/unstable_cache 전체 초기화 = DB 콜드렌더 폭풍. i18n류 연쇄 커밋은 배칭.
3. **no-op 쓰기 금지.** 값이 없으면 PATCH 자체를 스킵(2026-07-17 수정판 스크립트 준수).
4. **재발 감지 시그널**: ①`pg_postmaster_start_time()` 최근값 = 재시작(OOM) ②postgres 로그 "canceling
   statement due to statement timeout" 연쇄 ③Vercel 504 클러스터("Task timed out after 300 seconds")
   ④Supabase 응답이 Cloudflare 520/521 HTML.
5. **진단 순서**: curl로 HIT/MISS 분리(x-vercel-cache) → HIT 빠르면 DB 문제 → pg_stat_statements 상위 +
   pg_stat_activity → Vercel get_runtime_errors → 로컬 배치 프로세스(ps + films.ko_fetched_at 최근 카운트).
6. **캐시 함정 연동**: statement timeout은 unstable_cache에 null을 심을 수 있음([[live-html-grep-and-cache-traps]]) —
   DB 회복 후에도 404/빈값이 지속되면 revalidateTag/revalidatePath.

## §7. 요금 참고 (2026-07-17 결정 기록)

- Pro $25/월 + Small 컴퓨트 $15/월 − 포함크레딧 $10 = **총 ~$30/월**.
- 스펜드캡: 컴퓨트는 캡 대상 아님(고정 애드온). 캡 해제 시 현 사용량 기준 추가 0원(DB 4.9GB/8GB 포함,
  egress 250GB 여유). 다음 단계 Medium(4GB)=+$50/월 — P1 재측정 미달 시에만.
