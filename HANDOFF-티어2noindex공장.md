# HANDOFF — Tier-2 noindex 공장 (신호 회수 라인) 구축 지시서

> **한 줄**: noindex 상태의 Tier-2 영화 **3,892편**(2026-07-15 실측)을 대상으로, 무료 소스에서
> 색인 게이트 신호(가용성 인덱스·리셉션·수상)를 **회수·백필**해서 `filmIndexBar`를 넘는 영화를
> 최대화하는 공장. **신규 영화를 만들지 않는다** — 기존 행의 신호를 채우는 **수리(enrich) 라인**이다.
>
> **정직성 원칙(최상위)**: 게이트는 실체 신호(논문·수상·리스트·가용성)를 요구한다. 이 공장은
> **존재하는데 수집 안 된 신호를 회수**할 뿐, 신호를 만들어내거나 게이트를 우회하지 않는다.
> 논문도 수상도 리스트도 없는 영화가 noindex로 남는 것은 실패가 아니라 **게이트가 일하는 것**이다.
> 따라서 목표는 "3,892 전부 색인"이 아니라 "회수 가능한 전부를 회수 + 정확한 잔여 보고"다.
>
> **대원칙 — 포크 금지**: Tier-1·Tier-2 공장과 같은 엔진(`worker/factory.py`+`factory/manifest.json`)의
> **세 번째 라인**이다. `--adhoc`(수리 모드)·단일런 락·하트비트·원장·리포트 전부 그대로 쓴다.
> **선행 의존**: `HANDOFF-티어2공장.md`의 **T1(S06 wd-honors `--films` 스코핑)·T3(S17 reception
> `--films` 스코핑)**이 이 공장의 전제다 — 두 공장을 함께 구현하면 워커 패치는 한 번만 하면 된다.

## §0 대상 실측 (2026-07-15 프로덕션 — 이 표가 레버 우선순위다)

게이트(정본 `lib/seo.ts filmIndexBar`): `(n_reception≥3 OR n_lineage≥3 OR n_wd_honors≥3)
AND n_providers≥1 AND NOT 'tmdb-%'`. 원신호 = `film_index_signals_json()` RPC(0097).

**코호트: Tier-2 4,997 중 색인 1,105 / noindex 3,892. 미해결 스텁 0.**

| 실패 원인 분해 | 편수 |
|---|---|
| 신호 부족만 (providers는 OK) | 2,928 |
| providers=0 (신호는 강함 → **fpi 재계산 즉시 색인**) | **62** |
| 둘 다 부족 | 902 |

| 레버 | 실측 | 기대 효과 | 비용 |
|---|---|---|---|
| **A. fpi 재계산** | providers=0인 964편 **전원이 film_watch_providers 행 보유** — `film_provider_index`가 stale할 뿐. 진짜 무가용 0편 | 62편 즉시 색인 + 902편의 가용성 조건 해제 | $0, 분 단위 |
| **B. 리셉션(OpenAlex) 스윕** | 코호트 3,817편이 reception 0 = **스윕이 돈 적이 없음**. 코호트 감독=임권택(15)·존 포드(15)·홍상수(14)·고다르·샤브롤·르누아르 등 정전 작가의 심부 필모 — 학술 논문 존재 확률 높음 | 최대 레버(수율은 N7 파일럿 샘플로 실측) | $0, API 페이싱만 |
| **C. 수상(Wikidata) 재수집** | wikidata_id 보유+수상 0 = 2,261편·수상 1~2(근접) 1,417편·wikidata_id 자체 부재 154편(그중 imdb 보유 113편은 S04 재해결 가능) | 중간(재실행 누락분 회수; 진짜 무수상은 그대로) | $0 |
| **D. lineage 리스트** | 3,561편이 lineage 1~2행(근접!) — 리스트(film_lineage: list_id·edition_id) 에디션 추가 임포트가 대량 승격 레버 | **공장 범위 밖** — 신규 리스트 채택은 오너 콘텐츠 결정. §5에 보고만 | — |
| **E. director_slug 백필** | 3,231편이 director_slug null(이름은 3,213편 보유, 2,325명) — 알려진 백로그. 영화 게이트와 무관하나 감독 허브 실속·그래프·ReadPlates 입력 | 부수 레버(색인엔 직접 영향 없음) | $0 |

**감독 실측**: slug 보유 감독 302명은 전원 Tier-1 영화 보유(허브 존재). 코호트가 색인되면
기존 감독 허브(D-통합 배포됨)의 작품 목록·다이제스트가 두꺼워진다. slug-null 3,231편의 감독
2,325명은 대부분 미보유 인물 — **신규 감독 행 생성 금지**(thin 허브 양산 위험, directorGate가
막더라도 데이터 오염), 기존 감독과 **정확 일치 매칭만**.

**총비용: 사실상 $0** (OpenAlex·Wikidata·TMDB 전부 무료, LLM 스테이지 없음). 병목은 API
레이트리밋(OpenAlex 429 백오프 필수·Wikidata SPARQL·TMDB) — 전량 처리 수 시간~1일.

## §1 공장 구조 — 신규 스테이지가 아니라 "코호트 인테이크 + 기존 스테이지 재실행"

새 매니페스트 스테이지를 만들지 마라. 이 공장 = **N0 코호트 선별(신규)** + 기존 스테이지 4개의
스코프 재실행 + **N6 재측정 리포트(신규)**.

### N0. 코호트 인테이크 — `factory.py cohort` 서브커맨드 (신규, 유일한 실질 코딩)
`--adhoc`은 슬러그 목록 수동 입력인데 이 공장의 대상은 **질의 결과 3,892편**이다. 추가:
```
python3 worker/factory.py cohort t2noindex [--limit N] [--chunk 500] [--dry-run]
```
- 코호트 SELECT(아래)를 실행 → 슬러그 목록 → 내부적으로 `--adhoc`과 동일한 repair 런 생성
  (`factory.runs.mode='repair'`, intake source='cohort:t2noindex').
- **`--chunk 500`**: 500편 단위로 **순차** 런 분할(단일런 락 준수 — 락은 절대 우회 금지.
  2026-07-13 DB IO 장애 교훈: 대량 쓰기 페이싱). 청크 사이 60s 휴지.
- 코호트 SELECT (검증 완료 — 그대로 사용):
```sql
select f.slug from public.films f
left join (select film_id, count(*)::int n from film_reception group by film_id) r on r.film_id=f.id
left join (select film_id, count(*)::int n from film_lineage  group by film_id) l on l.film_id=f.id
left join (select film_id, count(*)::int n from film_wd_honors group by film_id) w on w.film_id=f.id
left join (select film_id, count(*)::int n from film_provider_index group by film_id) p on p.film_id=f.id
where coalesce(f.is_analyzed,false)=false
  and not ((coalesce(r.n,0)>=3 or coalesce(l.n,0)>=3 or coalesce(w.n,0)>=3) and coalesce(p.n,0)>=1)
order by f.id;
```

### N1. 가용성 인덱스 회수 = 기존 **S44 `fpi_rebuild()`** (전역·idempotent)
가장 먼저, 코호트와 무관하게 1회 실행. 964편의 stale이 해소되고 62편이 즉시 게이트를 넘는다.
파일럿의 첫 검증 항목(§4-ⓐ): 실행 전후 `film_index_signals_json` 기준 IDX 통과 수가 1,105→1,167±.

### N2. 리셉션 스윕 = 기존 **S17** (티어2공장 T3의 `--films` 스코핑 전제)
코호트 스코프로 실행. OpenAlex 429 백오프 필수(기존 파이프라인에 있음 — 제거 금지).
Tier-2 리셉션은 100% academic → 페이지에서 scholarship 프레이밍(레이아웃 계약, 렌더 쪽 책임).

### N3. 수상 재수집 = 기존 **S06 wd-honors** (티어2공장 T1의 `--films` 스코핑 전제)
우선순위 스코프: ①수상 0+wikidata_id 보유 2,261편 ②근접 1,417편. 그 전에 wikidata_id 부재
113편(imdb 보유)에 **S04의 wikidata-id 재해결**을 먼저 돌려라(worker/wikidata-id.py).

### N4. director_slug 백필 (신규 SQL 1개 — RPC `factory_director_slug_backfill(uuid[])`)
`films.director` 이름을 **기존 `directors` 행과 대소문자 무시 정확 일치**로만 매칭해 slug 채움.
퍼지 매칭·신규 감독 생성 **금지**(theorists 오염 사례의 감독판 방지). 매칭 실패는 그대로 null
유지 + 리포트에 잔여 수만. `lib/slug.ts`가 유일 슬러그 생성기 원칙과 충돌하지 않게 — 생성이
아니라 참조 매칭이므로 무관하나, 주석으로 명기.

### N5. 퍼블리케이션 = 기존 S51(lastmod)·S52(revalidate)
**게이트를 새로 넘은 영화만** 스코프(전 코호트 revalidate 금지 — 캐시 스탬피드). 넘은 영화는
filmIndexBar가 렌더타임에 자동 인식하므로 noindex 메타 제거는 자동. 사이트맵 광고는
`INDEX_COHORT_FILMS_T2` 캡(현 300)이 통제 — **공장이 캡을 만지는 것 금지**(주간 GSC-증거 룰,
오너 레버). 크로싱 수가 커지면 리포트에 "코호트 캡 상향 검토" 라인만 남겨라.

### N6. 재측정 리포트 (S59 확장)
런 종료 시 코호트 전체를 `film_index_signals_json()`으로 재측정:
`IDX 통과: 1,105 → N (+Δ) | 잔여 분해: 논문·수상·리스트 모두 0인 진성 noindex M편 /
lineage 근접 K편(리스트 레버, 오너) / providers만 부족 J편`. 감독 부수 효과도 한 줄:
`director_slug 백필 n편, 허브 영향 감독 m명`. 이 표가 오너의 다음 결정(리스트 임포트·코호트
캡 상향) 입력이다.

## §2 어드민 — 세 번째 레인
`/admin/factory`에 "Tier-2 noindex 공장" 카드 추가: 현재 코호트 크기(코호트 SELECT count)·
최근 런의 IDX Δ·"▶ 회수 런 큐잉" 버튼(= `factory_queue_run` + cohort 모드 — 기존 큐/워처 재사용).
레인 명칭: **Tier-1 공장 / Tier-2 공장 / Tier-2 noindex 공장(신호 회수)**.

## §3 실행 순서 (권장 캠페인)
1. N1 fpi_rebuild 단독 (즉시 62편 — 레버 검증)
2. N3 전처리: wikidata-id 재해결 113편 → S06 스코프 런(2,261+1,417, 청크)
3. N2 리셉션 스윕(3,817, 청크 — 가장 오래 걸림, OpenAlex 페이싱)
4. N4 director_slug 백필 (1회)
5. N6 재측정 → 리포트 → 오너 보고(잔여 분해 + lineage 레버 제안)

## §4 파일럿·수용 기준
ⓐ N1 실행 전후 IDX 통과 수 실측(기대 +62±) ⓑ N2/N3를 **샘플 100편**으로 먼저 → 회수율 실측
(논문 보유율·수상 회수율)을 이 문서 §0 표에 기록 → 전량 진행 ⓒ 새로 넘은 영화 5편 라이브 검증:
메인 200·noindex 메타 없음·C1/C2 다이제스트 렌더 ⓓ 게이트를 못 넘은 영화의 페이지가 **변하지
않았음**(수리 라인이 레이아웃 안 건드림) ⓔ 단일런 락·청크 페이싱 준수(DB IO 모니터)
ⓕ `factory.py lint` 클린 + Tier-1/Tier-2 레인 회귀 무손상.

## §5 오너 결정 대기 항목 (공장 범위 밖 — 리포트로만 올릴 것)
- **lineage 리스트 임포트**(레버 D, 근접 3,561편): 어떤 리스트/에디션을 정본으로 추가할지는
  콘텐츠·큐레이션 결정. 공장은 "리스트 1개 추가 시 승격 기대 편수" 표만 산출.
- **코호트 캡 상향**: 크로싱이 300 캡을 크게 넘으면 주간 GSC 룰로 오너가 상향.
- **미보유 감독 2,325명**: 신규 감독 행 생성 여부(현 지침: 금지·정확 일치만).

## §6 함정 (전 라인 공통 불변식 + 이 라인 고유)
- visible/is_analyzed/hold 조작 금지 · 단일런 락(다른 라인과 동시 실행 금지) · mgmt UA ·
  PostgREST 1000행(코호트 질의는 mgmt API로) · compute_film_scores 금지.
- **OpenAlex 429**: 스윕 최대 레버이자 최대 리스크 — 기존 백오프 보존, 청크 간 휴지.
- 수리 라인은 **콘텐츠를 만들지 않는다**: figures/takes/why/next/문장층 생성 금지(그건 Tier-1/
  Tier-2 공장 소관). 이 라인의 쓰기는 신호 테이블 4개 + director_slug + lastmod뿐.

## §7 참고
`HANDOFF-티어2공장.md`(T1·T3 선행 의존, 두 공장 동시 구현 권장) · `HANDOFF-영화공장.md` ·
`factory/RUN-PLAYBOOK.md` · `factory/EXECUTOR-CODING-NOTES.md` · `lib/seo.ts filmIndexBar`(SSOT) ·
`HANDOFF-Tier2-메인통합.md`(레이아웃 계약) · `docs/REMEMBER-thin-content-gate.md`.
