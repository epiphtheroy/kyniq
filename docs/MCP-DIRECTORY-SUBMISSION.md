# Metatake MCP — 디렉터리 등록 현황 + Anthropic 공식 디렉터리 제출 패키지

*작성 2026-07-13. 조사 3건(공식 디렉터리 정책·공식 레지스트리·커뮤니티 디렉터리) 라이브 검증 기반.*

## 0. 등록 현황 한눈에

| 채널 | 상태 | 비고 |
|---|---|---|
| **공식 MCP Registry** (registry.modelcontextprotocol.io) | ✅ **등록 완료 2026-07-13** | `net.metatake/mcp` v1.0.0, status=active. HTTP 도메인검증(`/.well-known/mcp-registry-auth`) |
| PulseMCP (pulsemcp.com) | ✅ 자동 (공식 레지스트리를 **매일 수집·주간 처리**) | 1주 후 미노출 시 hello@pulsemcp.com |
| GitHub MCP Registry (github.com/mcp) | ✅ 자동 ("once published … automatically appear") | 도메인-네임스페이스 원격 엔트리 노출 여부는 미확정 |
| Glama (glama.ai/mcp) | ⚠️ 간접 (공식 레지스트리의 "superset" 표방) | 직접 등록은 GitHub 리포 필요 |
| **Anthropic 공식 커넥터 디렉터리** (claude.ai) | 🔶 **제출 패키지 준비 완료 — 오너 액션 필요** | 아래 §2. **Team/Enterprise 조직 Owner만 제출 가능** |
| Smithery (smithery.ai) | 🔶 오너 1분 (계정 OAuth) | 아래 §3 |
| mcp.so | 선택 (효과 불확실) | 아래 §4 댓글 텍스트 |
| mcpmarket / cursor.directory / Cline | ❌ 스킵 | GitHub 리포 중심·로컬설치 청중이라 부적합 |

**서버 준비 상태**: authless 명시 허용 정책 확인됨("`none` — Supported"). 툴 4개 전부 `annotations {readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false}` 적용 완료(1위 반려사유 해소). Anthropic 이그레스(160.79.104.0/21, UA `Claude-User`)는 속도가드 차단 면제 적용 — 리뷰어 자동 기능검사가 429 맞을 일 없음. /terms·/privacy·/contact·/mcp(공개 문서+예시 프롬프트 3개) 전부 라이브.

## 1. 유지보수 런북 (레지스트리)

- **도메인 키**: `~/.config/metatake/mcp-registry-key.pem` (Ed25519, chmod 600). **영구 보관 — 분실 시 net.metatake 네임스페이스 재검증 불가**. 백업 권장.
- **well-known**: `public/.well-known/mcp-registry-auth` — 영구 유지(재로그인마다 레지스트리가 재검증). public/은 워처 미스테이징 → 수동 커밋.
- **메타데이터 수정/버전 업**: `server.json`(`~/.config/metatake/mcp-registry/`) 수정 → `version` 범프(불변, 재사용 불가) → 로그인+퍼블리시 연달아(토큰 5분·타임스탬프 ±15초):
  ```bash
  cd ~/.config/metatake/mcp-registry
  PRIVATE_KEY="$(openssl pkey -in ~/.config/metatake/mcp-registry-key.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
  mcp-publisher login http --domain metatake.net --private-key "$PRIVATE_KEY" && mcp-publisher publish
  ```
- 삭제 불가; 은퇴는 `mcp-publisher status`로 deprecated/deleted 마킹.

## 2. Anthropic 공식 디렉터리 — 제출 패키지 (오너 액션)

**게이트**: 제출 포털 `https://claude.ai/admin-settings/directory/submissions/new`은 **Claude Team/Enterprise 조직의 Owner**만 접근 가능(개인 Pro/Max 불가). Team은 최소 좌석 수가 사실상의 진입비. 등록 자체는 무료·포털 상시 오픈·자동 정책 스캔 통과 시 기본적으로 "Community" 라벨로 즉시 등재(인간 심사는 escalation 시에만).

포털 11단계에 그대로 붙여넣을 답변:

1. **Connection**
   - Server URL: `https://metatake.net/api/mcp` (Streamable HTTP)
2. **Tools** (자동 동기화 — annotation 검사 통과 상태)
   - search_films / get_film_criticism / get_takescore / find_connected_films — 전부 read-only
3. **Listing**
   - Name: `Metatake`
   - Tagline (≤55자): `Original film criticism for your AI` (35자)
   - Description (≤2,000자): `Metatake is an independent film-criticism platform (7,000+ films). This connector gives Claude live access to its original criticism — AI-written to a published method, with a named editor who answers for it: multi-framework critical readings ("strong misreadings" that each push one interpretive framework as far as the film allows), the 13-dimension TakeScore assessment (Value / Cost / Risk), canon standing and honors, motifs and figures, filming locations, tropes, and kindred-film connections that answer "what should I watch after X". All content is Metatake's own writing, licensed CC BY-NC 4.0 with attribution, and every tool result carries its source link back to metatake.net.`
   - Categories: Education / Research / Entertainment 중 1–5개 (권장: Entertainment, Research)
   - Privacy policy URL: `https://metatake.net/privacy`
   - Support contact: `wonwoo@metatake.net`
   - Public documentation: `https://metatake.net/mcp`
   - Icon: 사이트 로고박스 아트워크 (오너 업로드)
4. **Use cases** (3개 이상 요건 — /mcp 페이지와 동일)
   1. `Search Metatake for Mulholland Drive, then give me its strongest reading and three kindred films.`
   2. `Compare the TakeScores of the Three Colors trilogy on Metatake — which has the highest Value, and what does the Cost axis say about each?`
   3. `I loved In the Mood for Love. Use Metatake to find connected films and explain the interpretive threads they share.`
5. **Company**: Metatake, Seoul, Republic of Korea · metatake.net · 오너 정보
6. **Authentication**: **No authentication** (authless — 정책상 "Supported")
7. **Data handling**: 계정·대화 데이터 수집 없음. 서버는 요청된 영화 슬러그/검색어만 처리, 사용량 원장은 도구명+인자+IP /24 프리픽스만(no PII, Plausible 모델). 응답은 전부 공개 콘텐츠(CC BY-NC 4.0).
8. **Test & launch**: authless라 테스트 계정 불요 → 접근 안내만: "No sign-up required. Connect and call search_films with query 'mulholland' then get_film_criticism with the returned slug." (MCP Inspector + claude.ai 커스텀 커넥터로 전 툴 실사용 검증 완료 2026-07-13)
9. **Compliance** 7개 승인: 해당사항 전부 클린(금융거래 없음·AI 미디어 생성 없음·대화데이터 수집 없음·1st-party API·주입패턴 없음·공개문서 있음·가이드라인 준수)

문의 에스컬레이션: mcp-review@anthropic.com · 상태 추적: claude.ai/admin-settings/directory/submissions

## 3. Smithery (오너 1분 + 이후 자동)

```bash
npx -y @smithery/cli auth login   # 브라우저 OAuth 1회
npx -y @smithery/cli mcp publish "https://metatake.net/api/mcp" -n @metatake/metatake
```
원격 URL이 1급 등록 유형("Bring your own hosting"), authless 공개 서버는 스캔 자동 통과.

## 4. mcp.so (선택 — 붙여넣기용)

https://github.com/chatmcp/mcpso/issues/1 에 댓글:

> **Metatake** — Original film criticism for AI (remote, authless, Streamable HTTP)
> Server: `https://metatake.net/api/mcp` · Docs: https://metatake.net/mcp
> Tools: search_films, get_film_criticism (full critical pack), get_takescore (13-dimension assessment), find_connected_films. 7,000+ films, AI-written readings under a published method, CC BY-NC 4.0 with attribution. Also on the official registry as `net.metatake/mcp`.

*(983개 댓글 큐 — 등재 보장 없음, 기대치 낮게)*
