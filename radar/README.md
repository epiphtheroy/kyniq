> 📍 **정본 인덱스: [`HANDOFF-키워드레이더.md`](../HANDOFF-키워드레이더.md)** — 설계·불변식·결정 로그·비용·검증 대장. 작업 전 먼저 읽으세요.

# Keyword Radar — worker fleet

키워드(Phase 0: 100개, 무료 전용)로 X제외 크리에이터 플랫폼에서 최근 1~6h 신작을 감지 → `radar_*`(마이그 0083) 적재 → `/admin/radar` 피드.

**아키텍처**: 이중 엔진. 엔진 B(벌크 스트림·피드풀 + 로컬 Aho-Corasick 매칭, $0, 키워드 수 무관)가 백본, 엔진 A(무료 검색: GDELT·WP.com·YouTube)는 발견 플라이휠. 자세한 건 HANDOFF.

## 구성

| 파일 | 역할 | 실행 |
|---|---|---|
| `0083_keyword_radar.sql` | 스키마 | `python3 worker/apply-sql.py radar/0083_keyword_radar.sql` |
| `common.py` | 공유 헬퍼(hourly common 재사용 + url/hash/upsert/matcher/run) | 임포트 전용 |
| `matcher.py` / `matcher.mjs` | Aho-Corasick + 문맥 게이트 | `python3 matcher.py` = 자가테스트 |
| `seed_keywords.py` | 키워드 100개 시드 | 1회 |
| `seed_feeds.py` | 피드풀 시드(fleet+큐레이션+Substack) | 1회 |
| `ingest_jetstream.mjs` | Bluesky 파이어호스(상주) | watcher |
| `ingest_fedibuzz.mjs` | Mastodon SSE(상주) | watcher |
| `poll_feeds.py [fast]` | RSS 피드풀(시간당 / Medium 15분) | watcher |
| `poll_gdelt.py` | 뉴스(시간당, 10s 간격) | watcher(bg) |
| `poll_hn.py` | HN 벌크 커서(15분) | watcher |
| `poll_wpcom.py` | WordPress.com 검색+발견(시간당) | watcher |
| `poll_youtube_search.py` | YouTube 발견(6h, 핫 25kw 로테이션) | watcher |
| `websub_renew.py` | YouTube 채널 WebSub 리스 갱신(일 1회) | watcher |
| `process_inbox.py` | WebSub 푸시(radar_inbox) 처리(15분) | watcher |
| `radar-watch.sh` | 상주 워처(스트리머 감시 + 폴러 스케줄) | `nohup` |

Vercel: `app/api/radar/websub/route.ts`(콜백), `app/admin/radar/page.tsx`(피드).

## 부트스트랩 (Mac 터미널에서)

```bash
cd /Users/jerryje/Documents/MetaTake
python3 worker/apply-sql.py radar/0083_keyword_radar.sql   # 1) 스키마
python3 radar/seed_keywords.py                             # 2) 키워드 100
python3 radar/seed_feeds.py                                # 3) 피드풀
python3 radar/matcher.py                                   # (선택) 매처 자가테스트
nohup radar/radar-watch.sh >/dev/null 2>&1 &               # 4) 상주 가동
```

`.env.local`에 `RADAR_WEBSUB_SECRET`(임의 문자열) 추가 → Vercel 프로젝트 env에도 동일 추가(WebSub 콜백 검증용). YouTube WebSub를 켜려면 `NEXT_PUBLIC_SITE_URL`이 공개 도메인이어야 함.

## 운영 규칙 (불변식은 HANDOFF §15)

- 모든 소스 fail-soft: 하나 죽어도 나머지 계속, 3연속 에러 → `ledger.md` 경고.
- dedup은 DB(`radar_items.url_hash` unique). 로컬 seen 파일 금지.
- 공손 소스만 정본 UA(MetatakeBot). Phase 0엔 ToS-회색 스크레이핑 없음.
- 재부팅 후 워처 수동 재기동(`nohup radar/radar-watch.sh &`) — launchd/cron은 TCC 차단.
- 정지: `touch radar/HOLD` (다음 틱부터 폴러 스킵; 스트리머는 별도 kill).
- radar는 hourly 폴러의 **형제** — `hourly/poller/*.py` 수정 금지, `common.py`만 임포트.
