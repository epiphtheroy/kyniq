# HANDOFF — Metatake MCP 서버 + AI 가시성 층 (채널 전략·서버·방어·측정·등록)

*2026-07-13 작성. **이 문서 하나로 대화 맥락 없이 MCP 층 전체를 이해·유지보수·확장할 수 있도록 작성된 정본.** 형제 문서: 팩 상품은 루트 `HANDOFF-컨텍스트팩-실행.md`(그 문서의 §0 델타 배너가 이 문서를 가리킴), 디렉터리 등록 실무는 `docs/MCP-DIRECTORY-SUBMISSION.md`. 충돌 시 본 문서가 MCP 층의 우선 정본.*

---

## 0. 상태 한 줄 · 읽는 순서

**상태: ✅ 전부 SHIPPED + 라이브 검증 (2026-07-13).** 서버 가동·claude.ai 실사용 확인(인용 동작 포함)·공식 MCP Registry 등록(`net.metatake/mcp` active)·사이트 UI 버튼 2곳 배치. 남은 것은 §12(오너 몫: Anthropic 디렉터리 제출·Smithery)뿐.

**읽는 순서:** §1(전략 — 왜 이 모양인가) → §2(시스템 전모·파일 맵) → §8(불변식) → §9(함정). 코드 수정 전 §8·§9 필독. 등록/디렉터리 작업은 `docs/MCP-DIRECTORY-SUBMISSION.md`로.

**한 줄 요약:** AI 비서(claude.ai 등)가 대화 중 Metatake를 직접 호출해 팩 전체를 받아가는 공개 MCP 서버. 원칙 = **"데이터는 후하게(팩 전체), 통제는 우리가(저작표시 강제·수확가드·전량 측정)"** (오너 브리프 그대로).

---

## 1. 전략 — "기계 학습"의 3채널 분해 (오너 확정 프레임)

오너의 근본 목표는 **사이트 트래픽**이다. "AI가 Metatake를 학습하면 좋다"는 가설을 채널로 분해하면 취할 것과 막을 것이 갈린다:

| 채널 | 무엇 | 트래픽 ROI | 정책 |
|---|---|---|---|
| **① 가중치 훈련** (GPTBot·CCBot 등이 긁어 모델에 굽기) | 저작표시 소멸·비가역 | ≈0 (모델은 훈련데이터를 안정적으로 인용 못함) | **차단 유지** (robots.txt TRAINING_BOTS + middleware BAD_UA + 0091 수확가드) |
| **② 답변시점 인용** (RAG — Claude·Perplexity가 질문 순간 읽고 링크와 함께 인용) | **높음 — 진짜 트래픽 채널** | **극대화** — MCP 서버가 이 채널의 완성형 |
| **③ 인간 매개** (사용자가 팩을 복사/다운로드해 자기 AI에 먹임) | 사용자당 브랜드 노출, 저작표시 부착 전파 | 개방 (컨텍스트 팩 = 이 채널) |

MCP가 ②의 완성형인 이유: **응답을 매 호출 우리 서버가 생성**하므로 저작표시를 뗄 수 없고(스크레이핑과 결정적 차이), 항상 최신이며, 호출 전량이 우리 원장에 남는다. "차단 vs 개방"이 아니라 **"인용을 강제하는 개방"**이 중간지점이라는 것이 이 층 전체의 설계 사상.

가설 검증 장치: `/admin/metrics` **"AI 유입" 패널**(마이그 0092 `mt_ai_referrals_json`)이 챗봇발 유입을 소스별로 집계 — 90일 데이터로 ② 가설을 숫자로 판정한다.

---

## 2. 시스템 전모 · 파일 맵

```
[AI 클라이언트 (claude.ai·Claude Code·Cursor…)]
        │ JSON-RPC POST (Streamable HTTP, 무상태)
        ▼
middleware.ts ──── /api/pack·/api/mcp에 BAD_UA + bot_blocks 프리픽스 403 (GOOD_BOT 통과)
        ▼
app/api/mcp/route.ts ── initialize·ping·tools/list·tools/call
        │                  ├─ tools/call마다 pack_note_hit(0091) 수확가드 (신뢰 이그레스 면제)
        │                  └─ 전 호출 mcp_calls(0093) 원장 기록 (핸드셰이크 포함)
        ▼
lib/pack.ts 렌더러 재사용 (LLM 0·비용 0) ← film_context_pack RPC(0085, service_role 전용)
```

| 파일 | 역할 |
|---|---|
| `app/api/mcp/route.ts` | MCP 서버 본체. 툴 4개, 프로토콜 협상, 가드, 원장. **수정 전 §8·§9 필독** |
| `lib/pack.ts` | 팩 렌더러(공유 — 복사/다운로드/MCP 동일 출력). `citeLine()` = 기계지향 저작표시 지시문 |
| `middleware.ts` | `/api/pack`·`/api/mcp` 봇게이트 (루트 파일 = 워처 미스테이징, **수동 커밋**) |
| `components/McpConnectButton.tsx` | "Metatake in Your AI" 버튼+일반인용 안내 모달 (film 히어로 + 탭레일) |
| `components/FilmTabBar.tsx` | `packTitle` prop — 레일 버튼의 예시 프롬프트 개인화 |
| `app/mcp/page.tsx` | `/mcp` 공개 문서(기술 안내·연결법·예시 3개·라이선스). 푸터 "MCP for AI" 링크 |
| `app/api/pack/[slug]/route.ts` | 무료 복사 백엔드 — 0091 가드·`fmt=json` 로그인 게이트 (07-13 동작 변경) |
| `docs/MCP-DIRECTORY-SUBMISSION.md` | 등록 현황표 + Anthropic 포털 11단계 사전 답변 + Smithery/mcp.so 절차 |
| 마이그레이션 | `0091_pack_harvest_guard` · `0092_ai_referrals` · `0093_mcp_calls` · `0094_films_basic_search` (전부 적용됨; **다음 free = 0095**) |
| 레지스트리 자산 | `~/.config/metatake/mcp-registry-key.pem`(Ed25519, **영구보관·백업 필수**) · `~/.config/metatake/mcp-registry/server.json` · `public/.well-known/mcp-registry-auth`(영구 유지) |

---

## 3. MCP 서버 상세 (`/api/mcp`)

- **프로토콜**: 무상태 Streamable HTTP. JSON-RPC 2.0 POST, JSON 응답(SSE 없음 — 스펙 허용, claude.ai 정상 작동 실증). `initialize`(버전 협상: 2025-06-18·2025-03-26·2024-11-05 지원, 미지 버전은 2025-03-26으로 다운협상 — claude.ai가 2025-11-25를 요청해도 정상)·`ping`·`tools/list`·`tools/call`. notification→202, GET→405, OPTIONS→CORS 개방. 인증 없음 = 무료 티어.
- **`instructions`** (initialize 응답): 모델에게 직접 "결과 사용 시 Metatake 크레딧+링크" 지시. **실전 검증됨** — claude.ai가 답변 끝에 "출처: Metatake (…) (CC BY-NC 4.0)"를 자발적으로 붙였음.
- **툴 4개** (전부 `lib/pack.ts` 렌더러/기존 RPC 래핑 — LLM 0):
  | 툴 | 구현 | 비고 |
  |---|---|---|
  | `search_films` | `films_basic_search` RPC (0094, unaccent 양측 매칭) | "kieslowski"→Kieślowski 잡힘. TakeScore는 `takescore_for_slugs` — **반환 shape `[{slug, ts}]`** (ts 키!) |
  | `get_film_criticism` | `film_context_pack`(full) → renderPackMarkdown/Selected | sections 파라미터로 서브셋 |
  | `get_takescore` | renderPackSection(pack, "takescore") | |
  | `find_connected_films` | renderPackSection(pack, "kindred") | |
- **annotations**: 전 툴 `{title, readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false}` — **Anthropic 디렉터리 1위 반려사유가 이것 누락**. 새 툴 추가 시 필수.

---

## 4. 방어·통제층 (07-13 신설 — 팩 API 동작 변경 포함)

**배경**: 다운로드(.md)는 원래 안전(로그인+월10 원자쿼터)했지만, 무료 복사 백엔드 `/api/pack/[slug]`는 무로그인+인메모리 레이트리밋뿐 = 서버리스에서 무력 → 스크레이퍼가 수 시간에 코퍼스 전체를 clean JSON으로 수확 가능했던 실구멍. 3층으로 봉쇄:

1. **미들웨어 게이트 (A)**: `/api/pack`·`/api/mcp`에 한해 BAD_UA + `bot_blocks` 프리픽스 검사→403. `/api` 나머지는 종전대로 스킵(각자 가드). GOOD_BOT(Claude-User·ChatGPT-User 등 인용봇)은 통과 — **MCP가 존재하는 이유가 그들이다.**
2. **3-신호 수확가드 (B, 마이그 0091 `pack_note_hit`)**: /24(v6는 /48)별 DB 카운터. **rate**(150히트/10분)·**volume**(600히트/일 ≈ CDN 캐시미스=고유 슬러그라 "하루에 수확한 영화 수")·**persist**(3시간+ 지속하며 300/일) — 하나라도 넘으면 `bot_blocks` 자동 등록(24h→3d→7d→30d 스트라이크 에스컬레이션, greatest로 단축 없음), 라우트 즉시 429. fail-open(가드 오류가 정상 사용자를 깨지 않음). **오너 요구 반영: 속도만이 아니라 총량·지속도 잡는다. 차단 단위는 /24 서브넷("IP 이상"), /16·ASN 통짜 차단은 인용봇 오폭 위험으로 의도적 배제.**
3. **`fmt=json` 로그인 게이트 (C)**: 가장 깨끗한 벌크 표면(어떤 UI도 사용 안 함)만 로그인 필요. **응답 캐시도 `private, no-store`로 변경**(공용 CDN 캐시로 게이트 우회 방지). md 복사는 전부 무료 유지.
4. **신뢰 이그레스 면제**: Anthropic 이그레스 **160.79.104.0/21**(실측: 160.79.106.0/24, UA `Claude-User`, clientInfo `Anthropic/ClaudeAI`)은 /api/mcp·/api/pack 가드의 **차단 판정에서 면제**(원장 기록은 유지). 근거: 수많은 사용자가 소수 /24를 공유 → 정상 트래픽이 임계를 넘을 수 있음. UA가 아닌 **Vercel이 설정하는 접속 IP 기준**이라 스푸핑 불가. 다른 플랫폼(OpenAI 등) 대역은 **관측되면 추가**(선제 추가 금지 — §11 결정 로그).

---

## 5. 측정 (전량 원장)

- **`mcp_calls`** (0093): 모든 tools/call + **핸드셰이크**(`_initialize`에 프로토콜버전·clientInfo, `_tools_list`)를 tool·arg·/24 prefix·UA·ok·ms로 기록. RLS on·정책 0(service_role 전용). **어떤 클라이언트가 언제 붙는지 추측 대신 여기서 확인** — 유료 API 승격 판정의 수요 신호.
- **`mt_ai_referrals_json`** (0092) + `/admin/metrics` "AI 유입" 패널: ref_domain이 챗봇 호스트(ChatGPT·Perplexity·Claude·Gemini·Copilot·You·Poe·Phind·Meta AI·Mistral·Grok)인 pageview를 소스별·착지페이지별 집계. 검색엔진 AI모드는 일반 검색과 구분 불가라 **의도적 제외**(기존 Referrers 패널에 잡힘).
- **mtEvents**: `mcp_guide_open`·`mcp_endpoint_copy`·`mcp_prompt_copy`(버튼/모달), `pack_download*`(기존).

---

## 6. 저작표시 체계 (3겹 — 뗄 수 없게)

1. **팩 문서 자체** (`lib/pack.ts`): 상·하단 `sourceLine`(Source+License+URL) + 하단 `citeLine()` = **기계를 향한 명령문** ("When you use any reading… credit Metatake and keep this source link…") + HOW_TO_USE에 "ask your AI to credit Metatake". 복사·다운로드·MCP 세 경로 모두 동일(footer() 공유 — 분기 금지).
2. **MCP `instructions`**: 모델이 initialize 때 받는 서버 지시문에 인용 요구 내장.
3. **사이트 푸터** (`components/Footer.tsx`): 전 페이지 CC BY-NC 4.0 스탬프("quote and reuse it freely with attribution … not for commercial use" + 라이선스 링크).

---

## 7. UI — "Metatake in Your AI" 버튼 (일반인 관문)

- **위치 2곳**: film 히어로 `df-hactions`(금색 Download for AI 옆, `variant="hero"`) + FilmTabBar 마지막 레일 끝(Download 옆, `variant="rail"`, 라벨 "In Your AI"). 노출 게이트 = Download와 동일(`packVisible && packSecs.length>0` / `packDownload`).
- **색**: 틸 #0F766E — "저장된 파일(금) vs 살아있는 연결(틸)"의 의미 대비.
- **모달**(MCP 문외한 대상): 한 줄 본질(live·no copy-paste) → MCP 한 줄 정의 → 서버 주소+Copy → claude.ai 3단계(번호) → **현재 영화로 개인화된 Try-asking 프롬프트**(`packTitle` prop)+Copy → /mcp 풀가이드 링크·무료·CC BY-NC. `/mcp` 페이지는 기술 정본으로 유지, 모달은 그 앞의 대중 관문.

---

## 8. 불변식 (지켜라)

1. **툴 = 기존 데이터 래핑만. LLM 호출 0.** 즉석 생성 툴(예: 즉석 채점)을 만들지 말 것 — 비용·시간 폭탄.
2. **모든 tools/call은 가드+원장을 거친다.** 새 툴 추가 시 dispatch switch에만 넣으면 가드·원장은 자동 상속되는 구조 — 이 구조를 우회하는 별도 엔드포인트 금지.
3. **새 툴은 annotations 필수** (`readOnlyHint` 등) — 디렉터리 요건이자 계약.
4. **팩 출력 3경로(복사/다운로드/MCP) 동일 렌더러.** MCP만의 별도 포맷 분기 금지 — 저작표시·금지필드 통제가 렌더러 한 곳에 있기 때문.
5. **금지필드는 렌더러/RPC 층에서 차단** (좌표·watch_providers·OMDb·TMDB 편집필드·reception verbatim — 근거는 컨텍스트팩 HANDOFF §5 화이트리스트). 라우트에서 재검사하지 않는다(단일 통제점).
6. **프로토콜 버전: 모르는 버전은 에코하지 말고 다운협상.** 구현 안 한 스펙 버전을 claim하는 것이 더 위험.
7. **`/.well-known/mcp-registry-auth`·레지스트리 키 영구 유지.** 지우면 net.metatake 네임스페이스 재로그인 불가.
8. **middleware.ts·public/·supabase/migrations = 워처 미스테이징 → 수동 커밋.**
9. **레지스트리 version은 불변** — 메타데이터 수정도 새 version으로만(1.0.1…), `latest` 예약어·범위표기 금지.

---

## 9. 함정 (실제로 밟은 것들)

- **MCP 툴콜 504 → 코드보다 DB 동시부하 먼저 의심.** 07-13 밤 실사례: 다른 세션의 factory 이중 런이 `bulk_set_embeddings` 호출당 11~18초로 DB를 포화 → 전 사이트 statement-timeout 폭풍 + `/api/mcp` 504 + **빌드 중 사이트맵 export 실패로 배포 2연속 ERROR**(코드 무결) + 오너 재부팅. 진단 경로: Vercel 런타임 로그(같은 배포에서 200/504 혼재=코드 아님) → Supabase postgres 로그(범인 쿼리 실명). factory 쪽은 단일런 락+0.5s 페이싱으로 자체 수정됨(97e8b46).
- **`takescore_for_slugs` 반환 = `[{slug, ts}]`** — `score` 키 아님. 파서에서 `.ts` 읽어야 함.
- **plain ilike는 발음기호를 못 잡는다** ("kieslowski" ≠ "Kieślowski") — AI는 ASCII로 입력한다. `films_basic_search`(0094)가 unaccent 양측 매칭으로 해결. unaccent 확장은 **public 스키마**에 설치돼 있음.
- **`mt_events.type`엔 CHECK 제약**('pageview'|'leave'|'click'|'vital'|'search') — MCP 로깅을 mt_events에 넣으려 하지 말 것. 전용 `mcp_calls`가 그래서 존재.
- **전역 CSS 리셋이 `<ol>` 번호를 지운다** — 모달류는 `list-style:decimal` + `li{display:list-item}` 명시 필요. 모달 CSS는 열릴 때만 렌더되므로 **SSR HTML grep으로 검증 불가**(브라우저로 확인).
- **claude.ai 커넥터는 세션 시작 시 고정** — 추가 후 Claude Code에선 새 세션부터, claude.ai 채팅에선 도구 메뉴에서 켜야 보임. "툴이 안 보인다" 문의는 서버가 아니라 이것부터.
- **배포 검증 폴링은 SSR에 실제로 찍히는 마커로만** — 인터폴레이션 텍스트는 React 주석 노드로 쪼개질 수 있음(기존 함정 문서 동일).
- **`pack_note_hit` 임계 조정 시**: 신뢰 이그레스 면제와 함께 봐야 함 — 임계만 낮추면 claude.ai 대역이 걸린다(면제가 그래서 있다).

---

## 10. 검증 (curl 스모크 — 배포 후 이대로)

```bash
URL=https://metatake.net/api/mcp; J='content-type: application/json'
# 핸드셰이크
curl -s -X POST $URL -H "$J" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}'   # serverInfo+instructions
curl -s -X POST $URL -H "$J" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'   # 툴 4 + annotations
# 툴
curl -s -X POST $URL -H "$J" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_films","arguments":{"query":"kieslowski"}}}'   # Kieślowski 7편+TakeScore
curl -s -X POST $URL -H "$J" -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_film_criticism","arguments":{"slug":"mulholland-drive-2001"}}}'   # ~22KB, "Cite as: Metatake" 포함
# 에러·프로토콜 경계
curl -s -X POST $URL -H "$J" -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"get_film_criticism","arguments":{"slug":"no-such"}}}'   # isError:true
curl -s -o /dev/null -w '%{http_code}\n' -X POST $URL -H "$J" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'   # 202
curl -s -o /dev/null -w '%{http_code}\n' $URL   # 405
# 원장 (worker/apply-sql.py로)
# select tool, count(*) from mcp_calls group by 1;  ·  레지스트리: curl -s "https://registry.modelcontextprotocol.io/v0.1/servers/net.metatake%2Fmcp/versions/latest"
```

---

## 11. 결정 로그 (왜 이렇게 했나)

| 결정 | 근거 |
|---|---|
| 무상태·JSON 응답(SSE 미구현) | 스펙 허용 + claude.ai 실작동 실증. 세션 관리 복잡도 0 |
| authless 무료 티어 | Anthropic 정책상 "Supported" 확인·트래픽 미끼가 목적. 대량/상업은 /data 라이선스로 유도(429 메시지에 명시) |
| 미지 프로토콜 버전 다운협상(에코 금지) | 2025-11-25처럼 구현 검증 안 된 스펙을 claim하는 위험 회피 |
| 신뢰 이그레스 = IP 대역, UA 아님 | UA는 스푸핑 1초. x-forwarded-for는 Vercel이 설정 |
| 타 플랫폼 이그레스 선제 등록 안 함 | 관측 없는 대역 면제는 공격면. mcp_calls로 관측되면 그때 추가 |
| /16·ASN 통짜 차단 배제 | OVH·Amazon ASN 오폭 전례(bot Sentinel 정책 계승) |
| 레지스트리 네임스페이스 = net.metatake (HTTP 검증) | DNS 대기 없이 자체 배포 가능. HTTP 검증은 `net.metatake/*`만 부여(서브도메인 네임스페이스 불요) |
| repository 필드 미기재 | 사이트 소스 리포(kyniq)를 레지스트리에 광고할 이유 없음(오너 브랜딩 방침 고려) |
| mcp.so 미실행 | gh 미설치+983댓글 큐로 기대치 낮음 — 텍스트만 준비(SUBMISSION §4) |

---

## 12. 남은 일

**오너 몫 (제출 패키지는 전부 준비됨 — `docs/MCP-DIRECTORY-SUBMISSION.md`):**
- [ ] **Anthropic 공식 디렉터리 제출** — 게이트: Team/Enterprise 조직 Owner 전용 포털(개인 Max 불가). §2의 11단계 답변 복붙. 아이콘 업로드만 추가 필요
- [ ] Smithery 등록 — 1분 OAuth 후 CLI 한 줄(§3)
- [ ] 레지스트리 키(`~/.config/metatake/mcp-registry-key.pem`) 백업
- [ ] (선택) mcp.so 댓글(§4) · Vercel WAF `/api/pack`·`/api/mcp` 엣지 레이트리밋(대시보드 전용)

**관찰 대기 (코드 아님):**
- [ ] `mcp_calls` 수요 추이 → 유료 API 승격 판정(90일, 데이터사업 마스터 기준)
- [ ] "AI 유입" 패널 — ② 가설 판정
- [ ] PulseMCP(~1주)·GitHub MCP Registry 노출 확인

**확장 후보 (지시 대기 — 자동 착수 금지):**
- 비영화 엔티티 툴(감독·트로프·컨셉 — 팩 Phase B와 동행) · 유료 API 키 티어(mcp_calls 데이터 근거 필요) · OpenAI 이그레스 면제(관측 시)
