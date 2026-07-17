# 런칭 포스트 초안 — AI 개방 표면 (item 4/6) — 오너 발행

*MCP·REST API·GPT·임베드·확장·데이터셋을 한 번에 알리는 초안. HN/Reddit은 마케팅 문구를 싫어함 — 정직·구체·무료·"내가 만들었다" 톤 유지. ⚠️ 발송 전: 크로스포스트 도배 금지, 각 커뮤니티 규칙 확인, 하루 한 곳씩. Reddit 자동화 금지(오너 수동).*

## 이미 발견 채널에 오른 것
- ✅ **공식 MCP Registry** `net.metatake/mcp` (등록 완료). → **PulseMCP**(매일 수집)·**GitHub MCP Registry**(자동) 따라옴. 1주 후 미노출이면 hello@pulsemcp.com.
- 🔲 **Smithery**: 오너 1분 — `npx -y @smithery/cli auth login` 후 `npx -y @smithery/cli mcp publish "https://metatake.net/api/mcp" -n @metatake/metatake` (원격 URL 1급 등록, authless 자동 스캔). 상세 `MCP-DIRECTORY-SUBMISSION.md §3`.
- 🔲 **mcp.so**: GitHub 이슈 chatmcp/mcpso#1에 댓글(같은 문서 §4, 기대치 낮음).
- 🔲 **Anthropic 공식 커넥터 디렉터리**: Team 조직 Owner 전용(같은 문서 §2, 제출 패키지 완비).

---

## 1. Show HN
**제목:** `Show HN: Metatake – film criticism as a free API, MCP server, and open dataset`

**본문:**
```
I run Metatake (https://metatake.net), an independent film-criticism site — original
readings of ~6,900 films, written by our own AI to a method we publish in full, with
my name on the method and on what it produces. Plus a 13-dimension critical index we call
TakeScore (Value / Cost / Risk, kept deliberately separate from audience ratings).

I wanted the criticism to be *usable by machines that cite back*, not just scraped
into training sets, so I opened everything up this week:

- REST API (free, no key, CC BY-NC): https://metatake.net/api
  e.g. https://metatake.net/api/v1/takescore/mulholland-drive-2001
- MCP server for Claude & other MCP apps: https://metatake.net/api/mcp (on the
  official MCP registry as net.metatake/mcp)
- OpenAPI schema so you can drop it into a ChatGPT Action in one paste
- An embeddable TakeScore badge (one <script> line) for film blogs
- A browser extension that overlays the score on Letterboxd/IMDb/TMDB
- And the piece I'm most curious about: an open, geocoded FILMING-LOCATIONS
  dataset — 17k locations across 1.9k films, distinguishing where a film was
  *shot* from where it's *set*. CC BY-NC. I couldn't find this as open data
  anywhere, so I'm publishing it.

Every response carries a source link; the whole design is "give the data away,
but make attribution structural." Tech is boring on purpose: Next.js on Vercel,
Postgres/Supabase, the API reuses one pack renderer so copy / download / MCP /
REST can never drift.

Happy to talk about the TakeScore model, the location-extraction pass, or the
attribution-vs-scraping problem. What would you want an API like this to expose?
```
*HN 팁: 오전(미 동부) 발행, 제목에 이모지·과장 금지, 첫 댓글로 기술 뒷얘기 1개 자기첨부.*

---

## 2. r/LocalLLaMA
**제목:** `I published a film-criticism corpus as a free MCP server + REST API + open dataset (no key, CC BY-NC)`

**본문:**
```
  Built this for my own site (Metatake, film criticism) but it's all open now and
  this crowd seemed like the right place.

  - MCP server: https://metatake.net/api/mcp — 4 tools (search_films,
    get_film_criticism, get_takescore, find_connected_films). Stateless streamable
    HTTP, no auth. On the official registry as net.metatake/mcp.
    Add in Claude Code: `claude mcp add --transport http metatake https://metatake.net/api/mcp`
  - Plain REST if you're not on MCP: https://metatake.net/api
  - Open dataset: 17k geocoded filming locations (shot-vs-set), 1.9k films — the
    bit I think is genuinely novel.

  What's inside per film: multi-framework critical "readings" (interpretive
  positions, not summaries), a 13-dimension TakeScore (Value/Cost/Risk), kindred
  films, locations. LLM cost to serve it is zero — it's all precomputed and the
  tools just wrap the renderer.

  Design goal was "usable by answer-time retrieval, not just training scrapers":
  every tool result carries a cite-with-link instruction. Curious whether people
  here would use something like this in RAG / agent setups, and what other axes
  you'd want exposed.
```
*팁: r/LocalLLaMA는 MCP·무료·오픈데이터 좋아함. 셀프프로모 규칙 확인, 답글에 성실히.*

---

## 3. 짧은 변형 (r/ChatGPT, r/ClaudeAI, r/moviecritics 등 맞춤)
```
Opened up my film-criticism site as a free API + MCP server this week — search
6,900 films for critical readings, a 13-dimension TakeScore, kindred films, and
an open geocoded filming-locations dataset (17k locations). No key, CC BY-NC,
every response links back. https://metatake.net/api
```
*무비/시네필 서브레딧엔 TakeScore·촬영지 각도로, LLM 서브엔 MCP·RAG 각도로.*

---

## 발행 후 (내가 할 수 있음 — 지시 시)
- 유입은 `mt_ai_referrals`(챗봇)·Vercel 로그(API UA)·`/api/v1` 호출로 관측. HN/Reddit 리퍼러는 `/admin/metrics` Referrers.
- 반응 좋으면 `/api` 페이지에 "As seen on HN" 류는 지양(과장), 대신 데이터셋 DOI·GPT 링크만 담백히 추가.
