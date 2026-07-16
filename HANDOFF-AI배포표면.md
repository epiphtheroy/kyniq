# HANDOFF — AI 배포 / 개방 접근 표면 (REST API · GPT · 임베드 · 확장 · 데이터셋 · 검색축)

*2026-07-13 작성. 오너의 6항 "발상 전환" 리스트를 한 세션에 구현한 층의 정본. 형제: MCP 서버는 루트 `HANDOFF-MCP-서버.md`, 팩 상품은 `HANDOFF-컨텍스트팩-실행.md`. 이 문서는 그 둘의 상위 "배포 채널" 우산.*

---

## 0. 한 줄 · 상태표

**전략:** 안 지은 유료 자산을 **배포·발견 채널**로 회수한다. "관대함이 무기 — 퍼주되 저작표시는 구조적으로 강제." 채널 ②(답변시점 인용)를 MCP 너머로 확장.

| # | 항목 | 코드 | 오너 액션(계정 필요) | 정본 |
|---|---|---|---|---|
| 1 | **REST API + Custom GPT** | ✅ `/api/v1/*` + `/api/v1/openapi.json` + `/api` 라이브 | GPT Store 게시 | `docs/GPT-STORE-PACKAGE.md` |
| 2 | **오픈 촬영지 데이터셋** | ✅ 생성기+파일+카드+Zenodo메타 | HF/Zenodo 업로드 + **라이선스 결정** | `datasets/filming-locations/PUBLISH.md` |
| 3 | **네이버·다음 검색축** | ✅ 봇 허용+검증 훅+robots | 네이버 서치어드바이저 등록 | `docs/SEARCH-naver-daum.md` |
| 4 | **MCP 발견(레지스트리·런칭)** | ✅ 공식 레지스트리 등록 | Smithery·런칭 포스트 | `docs/MCP-DIRECTORY-SUBMISSION.md`·`docs/LAUNCH-POSTS.md` |
| 5 | **임베드 TakeScore 위젯** | ✅ 스크립트+iframe+빌더 라이브 | (없음 — 사이트가 붙임) | 본 문서 §5 |
| 6 | **브라우저 확장** | ✅ MV3 빌드+라이브 검증 | Chrome 스토어 게시($5) | `extension/README.md` |

전부 라이브 검증(§9). **LLM 0**(전부 기존 RPC/렌더러 래핑). 마이그 0096까지 소진 — **다음 free = 0097.**

---

## 1. REST API v1 (backbone) — item 1

`/api/v1`는 GPT·임베드·확장의 공통 기반. 무인증·읽기전용·CORS 개방·CC BY-NC.
- `GET /api/v1/films?q=&year=&limit=` — `films_basic_search`+`takescore_for_slugs`
- `GET /api/v1/films/{slug}` — `film_context_pack`(full) → `lib/apiv1.ts shapeFilm` (readings 전문 포함)
- `GET /api/v1/takescore/{slug}` — 13차원 V/C/R
- `GET /api/v1/locations?film=|country=&limit=` — 마이그 0096 `api_locations_json` (**좌표 포함**)
- `GET /api/v1/openapi.json` — OpenAPI 3.1(GPT Action 임포트용). 오퍼레이션 4: searchFilms·getFilm·getTakeScore·getFilmingLocations.
- `GET /api` — 개발자 랜딩(REST+GPT+MCP, 백링크 타깃, robots `/api/`로 색인 허용)

공통: `lib/apiGuard.ts`(0091 속도가드+신뢰 이그레스 면제 160.79.104.0/21+CORS), 미들웨어 봇게이트가 `/api/v1`도 커버. 모든 payload에 `url`+`cite_as`+`license`.

## 2. 오픈 촬영지 데이터셋 — item 2 ⚠️ 좌표 정책 반전
- **생성기** `worker/export-locations-dataset.py`(Management API 페이지네이션 `api_locations_export`) → CSV+JSONL. **17,341 위치·1,917편·130국·좌표 100%.** 데이터파일은 gitignore(재생성 가능).
- **⚠️ 의도된 반전:** 팩 상품의 "좌표 0" 불변식을 뒤집어 좌표를 **공개**(백링크·학술인용 자산). **팩 렌더러는 불변(좌표 없음 유지)** — 좌표는 `/api/v1/locations`+데이터셋으로만 나감. 두 채널 분리로 "유료 팩 엣지"와 "오픈 데이터"가 공존.
- **⚠️ 미결 라이선스:** 기본 CC BY-NC(생태계 일치), 오너는 CC BY 언급. **NC→BY 완화 가능·BY→NC 불가**라 NC가 안전 기본값. 업로드 전 오너 확정(PUBLISH.md §먼저 결정).

## 3. 네이버·다음 — item 3
- `GOOD_BOT`에 `Yeti|Daum|NaverBot` 추가(봇게이트 통과), robots `/api`→`/api/`(랜딩 색인), layout에 `NAVER_SITE_VERIFICATION` env 훅. 등록은 오너(`docs/SEARCH-naver-daum.md`). **주 140뷰 대비 최대 절대증분 후보** — 한국어권 부재 해소.

## 4. MCP 발견 — item 4
공식 레지스트리 등록 완료(net.metatake/mcp) → PulseMCP·GitHub 자동. Smithery/mcp.so/Anthropic 디렉터리 = 오너(`MCP-DIRECTORY-SUBMISSION.md`). 런칭 포스트(Show HN·r/LocalLLaMA) = `LAUNCH-POSTS.md`(전 표면 통합 발표).

## 5. 임베드 위젯 — item 5
- `/api/v1/embed.js` — 로더 스크립트. 호스트가 `<a class="metatake-takescore" data-film="slug" href="/film/slug">`를 정적 HTML에 두면 그게 곧 **do-follow 백링크**(JS off여도 존재), 스크립트는 점수 pill로 시각 보강.
- `/embed/takescore/{slug}` — 자족 iframe 배지(라우트 핸들러 → 루트레이아웃 탈출·`frame-ancestors *`·target=_top).
- `/embed` — 빌더(영화 검색→미리보기→스크립트/iframe 스니펫 복사). 푸터 "API & embeds" 링크.
- 철학: 사이트는 공짜 콘텐츠, Metatake는 자동 백링크+브랜드. CDN 캐시 재사용.

## 6. 브라우저 확장 — item 6
`extension/` MV3. `content.js`가 영화 감지(JSON-LD Movie**+CDATA 스트립**→사이트별→og:title)→`/api/v1/films` 조회→우하단 TakeScore 배지(dismiss·utm_source=extension). Letterboxd/IMDb/TMDB/RT/Wikipedia. 호스트권한 metatake.net만·추적 0. **라이브 검증: letterboxd.com/film/mulholland-drive에서 배지 렌더(TS 52).** 아이콘=틸 플레이스홀더(스토어 전 교체). 게시 오너($5).

---

## 7. 불변식
1. **모든 공개 API 툴 = 기존 RPC/렌더러 래핑, LLM 0.** 즉석 생성 금지.
2. **팩 렌더러는 좌표 0 유지.** 좌표는 `/api/v1/locations`+데이터셋 전용 채널로만.
3. **모든 /api/v1·/api/pack·/api/mcp = 미들웨어 봇게이트 + 0091 가드 + 신뢰 이그레스 면제** 상속(`lib/apiGuard`).
4. **모든 payload/배지/툴 결과에 저작표시**(url+cite_as / 배지 앵커 / instructions).
5. **OpenAPI operationId 고정**(searchFilms·getFilm·getTakeScore·getFilmingLocations) — GPT Action이 이걸로 바인딩.
6. **미들웨어·robots·layout·supabase/*.sql = 워처 미스테이징 → 수동 커밋.**
7. **CC BY 미출판 원칙**(라이선스 완화는 출판 후 불가역 — 오너 확정 전 NC 유지).

## 8. 함정
- **GPT Actions 임포터**가 응답 스키마(3.1 nullable union) 경고 가능 — 경로/파라미터만 정확하면 동작. 정 문제시 openapi.json `components.schemas` 제거(경로 불변).
- **Letterboxd JSON-LD는 `/* <![CDATA[ */` 래핑** — JSON.parse 전 스트립 필수(content.js 반영). 안 하면 주 타깃에서 감지 실패, og:title 폴백만 동작.
- **iframe 배지는 page.tsx로 만들면 루트 레이아웃(Footer+html) 상속** → 라우트 핸들러로 HTML 직접 반환해야 함.
- **api_locations_export 커서는 uuid** — `max(uuid)` 없음, `order by id desc limit 1`로 next_after. Management API는 UA 헤더 없으면 403.
- **robots `/api` vs `/api/`**: 슬래시 하나가 랜딩 색인/데이터 차단을 가른다.
- **film_locations.id·film_id = uuid**(bigint 아님).

## 9. 검증 (전부 라이브 통과 2026-07-13)
```bash
curl -s "https://metatake.net/api/v1/films?q=mulholland"          # count 1, TS 52
curl -s "https://metatake.net/api/v1/takescore/mulholland-drive-2001"  # 13 dims, cite_as
curl -s "https://metatake.net/api/v1/locations?film=mulholland-drive-2001"  # 10, lat/lng
curl -s "https://metatake.net/api/v1/openapi.json" | grep operationId   # 4 ops
curl -s "https://metatake.net/api/v1/embed.js" | grep mtk-badge        # 스크립트
curl -s "https://metatake.net/embed/takescore/three-colors-red-1994" | grep 77  # iframe 배지
# 확장: letterboxd.com/film/mulholland-drive에서 content.js 로직 → 배지 TS52 (스크린샷 검증)
python3 worker/export-locations-dataset.py   # 17,341 rows
```

## 10. 남은 일 (오너 액션 — 전부 계정 게이트, 패키지 완비)
- [ ] 데이터셋 **라이선스 결정**(CC BY vs NC) → HF + Zenodo 업로드(DOI)
- [ ] 네이버 서치어드바이저 등록(+`NAVER_SITE_VERIFICATION` env)
- [ ] GPT Store 게시(openapi.json 임포트)
- [ ] Chrome 웹스토어 게시(아이콘 교체+$5)
- [ ] Smithery 등록·런칭 포스트(HN/Reddit)·Anthropic 디렉터리(Team 조직)

**관찰:** `/api/v1` 호출·`mcp_calls`·AI유입 패널·HF 다운로드·DOI 인용 = 이 전체가 트래픽/수요로 회수되는지의 지표.

**확장 후보(지시 대기·자동착수 금지):** 비영화 엔티티 API·GPT 링크를 /api에 배선·데이터셋 논문·확장 Firefox판·유료 티어(mcp_calls/API 로그 데이터 축적 후).


## 11. `/api/v1/app/*` — 모바일 BFF 네임스페이스 (2026-07-17, 이 문서의 공개 API 계약 밖)

`/api/v1/app/{film,director,tonight,services,handoff,account-delete,tmdb-search}`는 **모바일 앱 전용 내부 BFF**다(정본: `HANDOFF-모바일앱-프리워치.md` §7·§16). 공개 REST(§1)와 같은 가드(`guardAndLog`+API_CORS)를 쓰지만: **openapi.json에 넣지 않는다**(외부 계약 아님 — 페이로드는 앱 `PAYLOAD_V`로 버전), attribution 블록 없음, robots는 기존 `/api/` noindex로 커버. handoff·account-delete는 Bearer 인증 POST — **CORS allow-headers/methods를 이 라우트들 때문에 넓히지 말 것**(2026-07-16 결정: 네이티브 앱은 CORS 무관, 브라우저 개방은 불필요한 표면).
