# 촬영지 파이프라인 — 신규 영화 증분 처리 (상시 운영 문서)

> **용도**: films 테이블에 새 영화가 추가될 때마다 이 문서 하나를 Claude Code에 주면 촬영지 데이터가 자동 보강됨.
> 사용법: 터미널에서 `claude` 실행 후 → `GEO_운영-신규영화-증분처리.md 읽고 그대로 실행해줘.`
> 최종 갱신 2026-07-03. 전체 이력·배경은 `HANDOFF-종합현황-지리촬영지.md` 참조.

## 시스템 개요 (30초)
- **DB**: Supabase `kyniq`(id `jvgarcqrtsmgfimdcwgo`) → `public.film_locations`
  (레이어: `layer='filmed'` 촬영지 / `'setting'` 서사무대. source: **agent-search=주력** · agent-filmed=보조 · figure=무대)
- **추출**: Anthropic Batch API + web_search (`worker/geo-batch-submit.py`, 모델 claude-sonnet-5, 언어균형 프롬프트 내장 —
  비영어권은 원어로도 검색, film_id로 동명영화 오귀속 차단, 탈락은 dropped 파일에만 기록·DB 미적재)
- **적재**: `worker/geo-batch-collect.py --finish` → `geo-load-results.py`(중복무시·보호DB격리) → `geo-code.py --apply`(Google 지오코딩)
- **증분 원리**: 새 영화는 어떤 체크포인트(done*)에도 없으므로 TODO에 자동 포함됨.
  `films_lang.csv`는 캐시라 신규 영화만 TMDB 호출됨(submit이 자동 보완).
- **비용 실측**: **$0.166/편** (2026-07, Sonnet 인트로가 — 2026-08-31 이후 ~1.3배). `.env.local`의 `ANTHROPIC_API_KEY` 유효해야 함.

## 실행 절차 (Claude Code — 순서대로, 자율 완주)
```bash
cd /Users/jerryje/Documents/MetaTake

# ① 신규 대상 확인 (제출 없음 — films_lang.csv 자동 보완 포함)
python3 worker/geo-batch-submit.py --seed-only --dry-run
```
**게이트**: 대상 수 × $0.17 계산해서 **$50 초과면 사용자에게 수치 보고 후 대기**, 이하면 자동 진행.
- 주의: `--seed-only`는 주요 영화 인덱스(`films.in_seed_catalog`)만. 신규 영화가 seed 밖이면 `--dry-run`(전체)으로
  확인하되, **not-done/lang-unknown 백로그(수천 편)가 섞여 나오므로** 전체 제출은 금지 — 신규만 골라내려면
  dry-run 출력과 DB의 최근 `films.created_at`을 대조해 사용자에게 보고.

```bash
# ② 제출 → 수집 → DB 적재 → 지오코딩 (자동)
python3 worker/geo-batch-submit.py --seed-only --yes
python3 worker/geo-batch-collect.py --wait --finish

# ③ 정산 + 검증
python3 worker/geo-batch-cost.py
```
③ 후 검증(필수): 아래 파이썬으로 적재 확인 — 실패 시 원인 해결 전 종료 금지.
```bash
python3 - <<'EOF'
import os,urllib.request
for ln in open('.env.local'):
    if '=' in ln and not ln.startswith('#'): k,v=ln.strip().split('=',1); os.environ.setdefault(k,v)
U=os.environ['NEXT_PUBLIC_SUPABASE_URL']; K=os.environ['SUPABASE_SERVICE_ROLE_KEY']
def q(p):
    r=urllib.request.Request(f"{U}/rest/v1/{p}",headers={"apikey":K,"Authorization":f"Bearer {K}","Prefer":"count=exact","Range":"0-0"})
    with urllib.request.urlopen(r) as x: return int(x.headers['Content-Range'].split('/')[1])
print("agent-search rows:",q("film_locations?source=eq.agent-search"),"· 좌표없음:",q("film_locations?source=eq.agent-search&lat=is.null"))
EOF
```
마지막으로 `HANDOFF-종합현황-지리촬영지.md` §12 끝에 한 줄(날짜·처리편수·비용) 추가하고 사용자에게 요약 보고.

## 규칙 (위반 금지)
- DB 수동 INSERT/DELETE 금지 — 반드시 `geo-load-results.py` 경유 (중복무시·보호DB 격리 내장).
- `geo-search/`의 results*/done* 파일 삭제·수정 금지(append만). `*.dropped.jsonl`은 절대 DB에 넣지 않음.
- collect 완료 전 submit 재실행 금지(이중 제출). 실패분은 collect 후 같은 submit 명령이 흡수.
- 전체 백로그(not-done 1,468 · lang-unknown 3,390) 제출은 사용자 명시 승인 필요 (~$820, 보류 중).

## 현재 상태 스냅샷 (2026-07-03 기준)
- agent-search **20,073행 / 4,334편** (좌표 누락 6) · seed 커버리지 94.3% (미커버는 대부분 애니/다큐 — 정당한 0)
- 한국영화 검증완료: Mother 6 · Oldboy 11 · Parasite 7 · 아가씨 7 · Poetry 3 (전부 좌표 있음)
- 누적 비용 ~$521 (V2 $283 + seed $238)

## 파일 맵
| 파일 | 역할 |
|---|---|
| `worker/geo-batch-submit.py` | 배치 제출 (TODO 자동선정 · --seed-only/--only/--pilot/--dry-run) |
| `worker/geo-batch-collect.py` | 수집 → 적재 → 지오코딩 (--wait --finish) |
| `worker/geo-batch-cost.py` | 실비 정산 (배치 usage 재집계) |
| `worker/geo-lang-list.py` | 원어 판별 (캐시, 신규만 TMDB 호출) |
| `worker/geo-load-results.py` | DB 적재 (on_conflict 중복무시 · dropped 제외 · film_id 매칭) |
| `worker/geo-code.py` | Google 지오코딩 (lat null만, geo_cache 캐시) |
| `geo-search/results*.jsonl · done*` | 결과·체크포인트 (append-only) |

## 후처리 — 아틀라스 SEO 읽는층 (2026-07-04 신설)

수집·적재·지오코딩이 끝나면 검색 표면은 대부분 자동 반영된다(필름/감독 locations 페이지·국가 허브·사이트맵 자격 — 전부 RPC+ISR 24h). 수동은 두 가지뿐:

1. **도시·지역 로스터 재빌드**: `python3 worker/atlas-cities-build.py` → `lib/atlas_cities.json` 갱신(워처가 자동 배포). 새 도시가 ≥3편이 되면 이때 페이지가 생긴다.
2. **IndexNow**: 신규 URL 배치 제출 (`scripts/indexnow-ping.mjs`).

코호트 캡·불변식·검증 절차 전체: **`HANDOFF-아틀라스-SEO-읽는층.md` §2~3** 참조.
