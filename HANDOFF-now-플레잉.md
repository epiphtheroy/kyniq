# HANDOFF — Now Playing (시간당 키워드 체이싱 뉴스 체계)

**이 문서가 정본(canonical)입니다.** Now Playing 관련 작업을 이어받는 에이전트는 코드를 만지기 전에 이 문서를 먼저 읽으세요. 중복·누락·회귀를 막기 위한 단일 진입점입니다. 최종 갱신: 2026-07-09.

관련 정본 문서(운영 세부):
- `hourly/README.md` — 편집 레시피(레터 포맷·규칙)
- `hourly/DESIGN.md` — 아키텍처·비용·결정
- `hourly/TREND-SOURCES.md` — 트렌드 신호 서비스 비교(2026-07-08 엔드포인트 검증)
- `hourly/DISTRIBUTION.md` — 발행 후 배포
- `hourly/FORECAST.md` — 유입 예측·사례 근거(이 장르는 2023–25 구글 업데이트로 붕괴한 이력이 있음. **반드시 읽을 것**)
- `hourly/poller/README.md` — 실행 명령·env 계약

> ⚠️ `hourly/README.md`는 헤더에 "v2"라고 쓰여 있지만 **실제 운영은 v3(에디터 레터)**입니다. 아래 §5가 v3 정본. README를 개정할 때 v3로 맞추세요.

---

## 1. 한 줄 정의와 현재 상태

metatake.net의 라이브 뉴스층. 전 세계에서 스파이크하는 **영화·문화 키워드**를 매시간 감지해, 우리 코퍼스에 앵커된 **에디터의 논증형 레터**를 1시간 내 발행한다. 목표는 어뷰징 데스크의 감지력으로 그 정반대(심층·데이터 기반·실명 저자)를 쓰는 것.

**하루 3종 뉴스 체제(2026-07-09 완비, 자율 가동 중):**
1. **The Daily** `/blog` — 아침 에디션(기존 substack 체계, 이 프로젝트 밖)
2. **Now Playing 라이브** `/now` — 스파이크당 레터, 시간당 감지·2~4편/일 발행
3. **일간 다이제스트** `/now/daily/[date]` — 하루 마감 에디터 노트(하루 1회)

**부속 표면:** `/now/wire`(검토했으나 미발행한 스파이크 전체 로그), 각 영화·감독 페이지의 "In the news" 탭.

가동: `hourly/now-playing-watch.sh` 워처가 매시 정각 `produce.py` 실행, 23시 UTC에 `digest.py`. 현재 pid는 `ps aux | grep now-playing-watch`로 확인.

---

## 2. 파일 맵 (전부)

### 파이프라인 (`hourly/`, 순수 파이썬 stdlib, pip 불필요)
| 파일 | 역할 |
| :-- | :-- |
| `pipeline/common.py` | HTTP·Supabase REST(sb_get/insert/update/rpc)·Anthropic 호출·**usage.jsonl 실비 로거**·slugify·ledger |
| `poller/poller.py` | 신호 폴링(Trends RSS+아울렛+Reddit)·엔티티 매칭(beat 게이트)·기계 점수 |
| `poller/sync_entities.py` | films/directors/theorists → `poller/entities.json`(일 1회, beat 게이트용) |
| `poller/config.json` | geo·아울렛 플릿·Reddit·임계값 |
| `pipeline/datapack.py` | 앵커 엔티티 → 데이터 모듈·archive_links·maps·internal_links(**결정론 SQL, LLM 0**) |
| `pipeline/produce.py` | **메인 시간당 런.** 선별→집필(Fable5+웹서치)→기계 게이트→발행→wire 기록 |
| `pipeline/stream.py` | wire 기록(검토 후보 + 배치 1회 Fable로 value_point) |
| `pipeline/digest.py` | 일간 다이제스트(하루 1회, Fable로 headline/dek/intro만) |
| `pipeline/rewrite_now.py` | 기존 기사를 현재 프롬프트로 같은 slug 재작성(SEO 연속) |
| `pipeline/backfill_now.py` | 구 발행분에 신규 필드(이미지·링크·모듈) 소급 |
| `pipeline/publish_draft.py` | --dry 초안을 수동 승인 발행 |
| `now-playing-watch.sh` | 상주 워처(매시 :00 produce, 23시 digest, pidfile 가드) |

### 프론트엔드
| 파일 | 역할 |
| :-- | :-- |
| `app/now/layout.tsx` | 마스트헤드(Latest→최신기사·All pieces·The wire 버튼) |
| `app/now/page.tsx` | 인덱스(썸네일 목록·다이제스트 스트립·"The wire we watched" 섹션) |
| `app/now/[slug]/page.tsx` | 기사(레터·데이터모듈·**연결/지리 지도 임베드**·Read together 슬롯) |
| `app/now/[slug]/opengraph-image.tsx` | 텍스트 OG 카드(영화 스틸 없음) |
| `app/now/daily/[date]/page.tsx` | 다이제스트(에디터 노트·wire 항목·리드 연결맵) |
| `app/now/wire/page.tsx` | wire 전용 코너(날짜별 전체, **noindex+follow**) |
| `app/now/feed.xml/route.ts` | RSS |
| `app/news-sitemap.xml/route.ts` | Google News 사이트맵(48h 창, 기사+다이제스트) |
| `app/sitemaps/now.xml/route.ts` | now 자식 사이트맵(전체 이력) |
| `components/NowModules.tsx` | "The record" 데이터 모듈 렌더(내부·외부 신뢰 링크 셀) |
| `components/EntityNews.tsx` | 영화·감독 "In the news" 모듈 |
| `components/home2/NowPlaying.tsx` | 홈 메인 모듈(2c, 다이제스트 링크 포함) |
| `lib/now.ts` | 타입·fmt·tmdbImg·provenanceHref·anchorHref |
| `app/now/now.css`, `app/entity-news.css` | 스타일 |
| `lib/sitemap-data.ts` → `nowEntries()` | now 사이트맵 데이터(다이제스트 포함) |
| `components/home2/Nav.tsx` | Read 메뉴에 Now Playing |
| `app/film/[slug]/page.tsx`, `app/director/[slug]/page.tsx` | EntityNews 삽입 + "In the news" 탭(newsCount 뱃지) |

### DB 마이그레이션 (프로덕션 적용 완료)
`0049_now_articles` · `0050_now_articles_enrich`(image/cut_floor/archive_links) · `0051_now_dateline` · `0052_now_stream_digest` · `0053_now_articles_director`

### 문서
`hourly/{README,DESIGN,TREND-SOURCES,DISTRIBUTION,FORECAST}.md` · `hourly/poller/README.md` · `hourly/ledger.md`(발행 로그) · `hourly/poller/dryrun.log.md`(후보 로그) · `hourly/poller/usage.jsonl`(실비)

---

## 3. DB 스키마

**`now_articles`** (발행된 레터): slug·headline·dek·summary·dateline·keyword·lane·anchor_type(film/person/theorist)·anchor_slug·anchor_label·film_slug·**director_slug**·image_path·image_alt·facts_html·reading_html·bottom_html·deposit·modules(jsonb)·sources(jsonb)·archive_links(jsonb)·cut_floor(**항상 [] — 규칙5**)·scores·status(published/pulled)·update_note·published_at·updated_at. RLS: published만 공개.

**`now_stream`** (wire, 검토했으나 대개 미발행): at·keyword·title·url·outlet·region·news_date·anchor_type·anchor_slug·anchor_label·film_slug·director_slug·scores·**value_point**(에디터 한 줄)·related_links·published·piece_slug. RLS: 전체 공개.

**`now_digests`** (일간): digest_date(unique)·headline·dek·intro_html·items(jsonb)·published_at·updated_at. RLS: 전체 공개.

---

## 4. 시간당 루프와 비용

```
매시 :00  poller: 신호 폴링(무료 RSS/API) → 엔티티 매칭 → 기계 점수
         ↓ (HOLD 파일 있으면 중단, 파일락으로 동시실행 방지)
         엔티티 매칭된 스파이크(beat>=4)를 wire_cands로
         ↓
         일일 캡(4) 도달? → wire만 기록하고 종료(검토는 계속)
         ↓ 아니면
         발행 후보(beat>=4 AND corr>=2 AND mech>=9) 각각:
           datapack(결정론 SQL) → internal_links >=4 확인
           → Fable5 집필(웹서치 2회 이상) → 기계 게이트(구조·링크·명예훼손 없음)
           → 발행(insert + revalidate + IndexNow + Bluesky)
         ↓ 항상
         record_stream: 그 시간 wire_cands를 배치 1회 Fable로 value_point 붙여 기록
매시 23   digest.py: 그날 wire+발행분 → 다이제스트 1편
```

**cadence:** 감지=매시간, 발행=2~4편/일(임계값), wire value_point=매시간(엔티티 매칭 있을 때), 다이제스트=1회/일.

**실비(usage.jsonl 실측, Fable5 $10/$50 per MTok, 웹서치 $0.01/회):**
- 집필 1편(웹서치 포함): ~$0.4–0.7 → 2~4편/일 = $0.8–2.8/일
- value_point 배치: ~$0.009/시간 · 다이제스트: ~$0.03/일
- **합계 ≈ 월 $60–110** (집필 지배, 스트림+다이제스트 추가분은 ~$15/mo)
- **선별·데이터팩·링크·지도는 전부 $0**(순수 파이썬/SQL/기존 컴포넌트). sonnet 셀렉터/게이트는 **전면 제거됨**(원우 규칙: 문체 불가침, Fable가 쓰면 발행).

---

## 5. 편집 원칙 v3 — 에디터 레터 (원우 확정 브리프)

**한 편 = 스파이크 뉴스 + 코퍼스 앵커 1 + 논증.** 지적·겸손·논증적인 편집장 레터. 데이터 나열 아님, 정치 판정 아님.

프롬프트 위치: `pipeline/produce.py` → `WRITER_SYSTEM`. 6대 규칙:
1. **속도 가시화** — dateline 선두(사건 지역 대문자+뉴스 날짜, 발행시각 아님). "한 시간 전 읽었고 그래서 쓴다" 프레임.
2. **검색어=제목** — 사람들이 칠 쿼리 + 답의 약속. 고유명사 선두.
3. **실명·지역·날짜 최대** — 매 사실에 매체+보도날짜.
4. **본문에 이너링크 4–10개** — datapack `internal_links` 인벤토리에서만(게이트 검증). 링크 스터핑 금지.
5. **논증·겸손** — 표면반응→심층질문→내 입장. 최강 반론 상대. 구조·작품 비판, 사적 인물 인격 금지.
6. **폼** — 700–1200단어, 짧은 문단, em-dash 금지, 리스티클 금지.

기계 게이트(`deterministic_gate`)가 검증: dateline에 월+연도, 제목에 키워드/앵커명, 프로즈 500–1500단어, 이너링크 >=3(전부 인벤토리), 소스 >=2 아울렛, HTML 태그 화이트리스트, 링크 200. 2회 실패 시 KILLED. **sonnet 콘텐츠 게이트 없음.**

**기각 뉴스는 지면에 안 실림(규칙5, cut_floor=[] 고정)** — 대신 wire(`/now/wire`)와 각 영화 밑으로 감.

기타 프롬프트: `stream.py` `_value_points`(wire 한 줄), `digest.py` `write_intro`(다이제스트 front matter).

---

## 6. 신호 스택 (감지)

`hourly/TREND-SOURCES.md` 정본. 요약: Google Trends "Trending Now" RSS(주 감지, 10분 갱신) + 아울렛 RSS 플릿(BBC·Guardian·Variety·Deadline 등, 1–5분 최속, ≥3피드 규칙) + Reddit rising(조기경보). 전부 무료. 함정: Google News RSS는 `when:` 없으면 중앙값 6.6일 스테일(수확 전용). beat 게이트 = 트렌딩 키워드를 `entities.json`(films/directors/theorists)에 매칭; beat<4는 우리 이야기 아님 → wire에도 안 감.

**데이터팩 모듈**(datapack): honors(Wikidata qid 링크)·canon(내부 lineage 링크)·takescore(**cinecodex_card RPC의 V/C/R+13차원**, film_scores 아님)·reception(실제 리뷰 URL)·locations(RLS라 서비스키)·misreadings·essays·filmography. **archive_links**(최대 16: curious 질문·트로프·movies-like·계보·아틀라스·감독). **maps**(연결 갤럭시 EntityMap `/api/map` + 지리 FilmMap `/api/geo`).

---

## 7. 운영

**시작(재부팅 후):** `nohup ~/Documents/MetaTake/hourly/now-playing-watch.sh >/dev/null 2>&1 &` (pidfile 가드로 이중 기동 안전, 몇 번 실행해도 됨).

**정지:** `touch ~/Documents/MetaTake/hourly/HOLD` (삭제로 재개).

**⚠️ launchd/cron 불가:** macOS TCC가 launchd에서 뜬 프로세스의 ~/Documents 접근을 차단("Operation not permitted"). **반드시 터미널 컨텍스트 상주 워처**(auto-deploy-watch.sh와 동일 패턴)로만 가동. launchd plist는 bootout됨.

**Mac 잠자면** 그 시간 건너뜀(다음 정각 재개). 24/7 원하면 소형 VPS 이전(스크립트는 레포+`.env.local`만 필요).

**관측:** `ledger.md`(시간별 PUBLISHED/PASS/KILLED) · `poller/cron.log`(상세) · `poller/usage.jsonl`(실비) · Supabase now_* 테이블.

**env 계약(`.env.local`):** NEXT_PUBLIC_SUPABASE_URL/ANON_KEY·SUPABASE_SERVICE_ROLE_KEY·ANTHROPIC_API_KEY·NEXT_PUBLIC_SITE_URL·REVALIDATION_SECRET·BLUESKY_HANDLE·BLUESKY_APP_PASSWORD. 없어도 발행은 됨(revalidate/bluesky만 스킵).

**빌드/배포:** 코드 변경은 auto-deploy 워처가 app/components/lib를 자동 커밋·푸시. 루트 파일(migrations 등)은 수동 커밋. 클린 빌드는 `PATH="$HOME/.local/node/bin:$PATH" npm run build`(샌드박스 밖).

---

## 8. 배포 (발행 후)

`DISTRIBUTION.md` 정본. 티어1=색인 경주(news-sitemap 48h·IndexNow·NewsArticle JSON-LD·OG 카드). 티어2=자기채널 자동포스팅(**Bluesky만 활성**, Telegram/Mastodon 미설정, **X 영구 제외**). 티어3=Reddit·HN 수동 전용(자동화=도메인 블랙리스트). 티어4=댓글·DM 금지.

**Bluesky 함정(해결됨):** 핸들은 `channel-wonwooo.bsky.social`(o 세 개). 코드가 앞 `@` 자동 제거(`@handle`은 이메일로 오인돼 400). 실포스팅 200 확인.

**사이트맵/GSC:** 뉴스 사이트맵은 루트 `/news-sitemap.xml`(❌`/sitemaps/news-sitemap.xml` 아님). GSC엔 `sitemap.xml`+`news-sitemap.xml` 2줄만 제출하면 인덱스가 now.xml 포함 37자식 자동 포함. GSC 제출은 서비스계정 없어 **원우 수동**. IndexNow는 코드가 자동.

---

## 9. 불변식 / 회귀 함정 (깨지면 안 되는 것들)

1. **PostgREST 타임스탬프는 Z 포맷** — `+00:00`의 `+`가 쿼리스트링에서 공백 해석 → 400 → 노벨티 무력화(같은 기사 중복 발행). `strftime("%Y-%m-%dT%H:%M:%SZ")` 사용.
2. **Fable 라이터 max_tokens 16000 + "최종 답변 JSON만"** — 6000이면 장문 레터 JSON 잘려 파싱 실패. 실패 원문은 `drafts/failed-*.txt`.
3. **인물 앵커 링크는 감독 페이지** — film_slug(그 인물의 최근작)로 가면 안 됨. `_anchor_href`가 anchor_type 기준.
4. **TakeScore는 cinecodex_card RPC(V/C/R+subs)** — film_scores(prestige/discovery)는 다른 오래된 테이블.
5. **표 셀 외부 링크는 DB 출처만**(reception url, wikidata qid) — 본문 프로즈는 내부 전용. provenanceHref가 분리.
6. **cut_floor(기각뉴스)는 지면에 절대 안 실림** — 규칙5, publish에서 [] 고정.
7. **이중 기동/동시실행 방지** — 워처 pidfile + produce 파일락. 없으면 일일 캡 경합해 중복 발행.
8. **ISR 캐시** — 발행 후 인덱스/사이트맵은 REVALIDATION_SECRET 있으면 즉시, 없으면 2–5분 지연. 라이브 감사 시 캐시버스터 필수.
9. **film_locations는 RLS** — anon 안 됨, datapack이 서비스키로 읽음.
10. **now/[slug]은 다크 셸(.mt.cur #181818)** — .cur-paper.blg만 흰 시트. 헤더/인덱스=밝은 글자, 페이퍼 내부=어두운 글자.
11. **Hidden Chrome 탭에서 MapLibre 안 뜸**(rAF 정지) — 지도 디버깅 전 visibilityState 확인.
12. **sonnet 재도입 금지** — 원우 규칙: 기계 선별 후 Fable가 쓰면 발행, 제2모델 문체 게이트 없음.
13. **wire 기록은 모든 종료 경로에서** — produce.py의 `not cands`(발행후보 없음=가장 흔한 경우) 조기 종료가 record_stream을 건너뛰면 wire가 안 쌓임(2026-07-09 버그). 발행/일일캡/후보실패/후보없음 4경로 모두에서 record_stream 호출 필수.
14. **wire 오매칭은 value_point 패스에서 drop** — 매처가 짧은/일반 제목을 잘못 매칭(cs2 update→Mirage 1965). `_value_points`가 Fable에게 real 판정 시켜 spurious면 drop. 발행된 기사는 항상 유지.

---

## 10. 결정 로그 (진화)

- v1(폐기): substack figure-anchor + AVAULT 판정 결합.
- v2(폐기): beat-first 데이터 심층, 정치판정 제거. → "데이터 너무 많아 재미없다" 피드백.
- **v3(현재)**: 에디터 레터. 논증·겸손·검색어 제목·이너링크·지도. sonnet 제거.
- 홀드룰(FORECAST §4): 일일 캡 4 유지, 비구글 30%·GSC 우위 전까지 증량 금지, 12주 선행지표 판정.
- 자동발행+비동기검수(AVAULT 사람게이트 이탈), 아웃리치만 100% 사람게이트, 데일리 이메일은 큐레이션.
- X 영구 제외(1K 미만 계정 링크글 참여 0%, $0.20/URL). 기각뉴스 지면 미게재. 발행 표면=metatake.net(신규 도메인 아님).

---

## 11. 원우 몫 (미완)

- **GSC 사이트맵 제출**: `sitemap.xml` + `news-sitemap.xml` (§8). 신규 기사 색인요청은 GSC URL 검사.
- (선택) Telegram/Mastodon 토큰 → 다중 채널 포스팅.
- (선택) 24/7 위해 VPS 이전.

## 12. 이어서 작업할 때 — 어디를 고치나

- **문체·규칙 바꾸기** → `produce.py` `WRITER_SYSTEM` + `hourly/README.md`.
- **감지 신호·임계값** → `poller/config.json` + `produce.py`(MIN_MECH/MIN_CORR/DAILY_CAP) + `poller/poller.py`.
- **데이터 모듈·링크·지도** → `datapack.py`.
- **발행 표면 디자인** → `app/now/*` + `now.css`(다크셸 규칙 §9-10).
- **엔티티 페이지 노출** → `EntityNews.tsx` + film/director page의 탭·newsCount.
- **비용 확인** → `poller/usage.jsonl`.

> 이 문서를 갱신하세요. 새 표면·마이그레이션·불변식을 추가하면 여기 반영해야 다음 에이전트가 안 헤맵니다.
