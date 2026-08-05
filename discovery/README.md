# discovery/ — 신생 영화 사이트 스캐너 (P0)

> ⏸ **일시 중단 (오너, 2026-08-05).** 스캔 크론은 **설치돼 있지 않고**(설치했다가
> 같은 날 제거), `/discoveries`와 그 RSS는 **404**다 —
> `lib/discoveries/digests.ts`의 `DISCOVERIES_ENABLED = false`. 푸터 링크·사이트맵
> 항목도 뺐다. 코드·다이제스트·스캐너는 그대로 두었으니 재개는 두 동작이다:
> ①플래그를 `true`로 ②`./install-discovery-schedule.command` 실행(원하면).
> ⚠️ `--no-llm` 실행도 도메인을 seen 처리한다 — 점검용으로 돌리면 그 날짜는
> 분류 없이 소진되므로, 되살리려면 `state/seen.json`에서 해당 날짜를 지워야 한다.

정본 스펙: 루트 **`HANDOFF-발견피드.md`** (§6 파이프라인·§7 검토 플로우). 이 디렉토리는 `hourly/poller/` 레이아웃을 복제한 형제 프로젝트다 — **`hourly/`는 건드리지 않는다.**

## 무엇을 하나
매일 1회: WhoisDS 무료 NRD 리스트(전일-2일자, ~70k 도메인) → 사전 v2 필터(~150건) → 홈페이지 1회 fetch(robots 존중, `MetatakeBot/1.0` UA) → Haiku 분류 → 고득점만 `state/review-queue.md`에 append. 서버 0대, DB 쓰기 0, 비용 ~$1-3/월.

## 실행
```bash
cd /Users/jerryje/Documents/MetaTake/discovery
python3 scan.py                    # 기본: 오늘-2일자 리스트 1일치
python3 scan.py --date 2026-07-16  # 특정일
python3 scan.py --dates 2026-07-10,2026-07-11,2026-07-12   # 백필
python3 scan.py --no-llm           # 분류 생략(비용 0, 점검용)
```

크론(오너가 설치, hourly와 동일 환경 — Mac 깨어있어야 함):
```
30 9 * * * cd /Users/jerryje/Documents/MetaTake/discovery && /usr/bin/python3 scan.py >> state/cron.log 2>&1
```

킬스위치: `touch discovery/HOLD` (hourly 관례와 동일 — 삭제하면 재개).

## 오너 검토 (주 1회, ~15분)
`state/review-queue.md`를 열고 각 줄 `[ ]`에 **F**(Feature — 소개감)/**L**(List — 관측 로그행)/**R**(Reject) 표기. Watchlist 항목은 아직 빈 페이지인 유망 이름 — 다음 주에 다시 열어본다.

🚨 **큐는 "발행 승인"이 아니라 "트리아지"다. 리스트(L)에 넣기 전 각 사이트를 실제로 한 번 연다.** 2026-07-18 실검증에서 Haiku가 "극장"으로 통과시킨 것 중 **결제정보 가로채는 피싱 클론**과 **해적판**이 있었다(HANDOFF §14). 분류기는 극장으로 위장한 피싱을 못 가른다 — 사람 눈이 유일한 방어선이다. `state/rejected.log`에 스캐너가 걸러낸 위험 후보가 쌓이니 게이트가 뭘 잡는지 확인하는 용도로 볼 것.

⚠️ **후보 도메인은 일상 브라우저로 직접 열지 말 것** — 후보 풀에 해적판·피싱·악성이 실재한다(실측). 확인은 격리 프로필로.

## 파일
| 파일 | 커밋 | 내용 |
|---|---|---|
| `scan.py` / `config.json` | ✅ | 파이프라인·사전 v2·블록리스트 |
| `state/review-queue.md` | ✅ | 사람 검토 큐 (append-only 섹션) |
| `state/candidates.jsonl` | ❌(.gitignore) | 전 후보 원장 — 리포가 public이라 피어리스트(piracy 라벨 등)는 커밋 금지 |
| `state/seen.json` | ❌ | 중복 방지 상태 |
| `state/cache/` | ❌ | NRD zip 캐시 |
| `state/usage.jsonl` / `run.log` / `brand-alerts.log` | ❌ | 비용·실행·브랜드 감시 로그 |

## 사전 v2 요지 (근거 = 정본 §2 실측, 재논쟁 금지)
- 통과: `film|cinema|movie|kino|cinephile` 부분문자열 + `cine` 앞토큰 경계(`^cine`·`[-_]cine`)만
- `reel/screen/frame` 없음(오탐 47% 주범) · `cine$` 금지(medicine 매치)
- 블록: 브랜드 클러스터(lordfilm·filmyzilla·moviesflix…) + 토큰 단위 junk(hd/watch/free/123…)
- `metatake` 유사도메인 → `brand-alerts.log` 별도 경고
