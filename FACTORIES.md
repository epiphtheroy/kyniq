# Metatake 공장 3계 — 통합 인덱스

영화를 사이트에 넣고 표면에 녹여내는 **자동화 공장이 총 3개**다. 전부 같은 엔진
(`worker/factory.py` + `factory/manifest.json`)의 조립 라인이거나 그 위성이며, tier로 갈린다.

| 공장 | 대상 | 산출물 (핵심) | 편당 비용 | 정본 문서 |
|---|---|---|---|---|
| **① Tier-1 공장 (영화공장)** | 신규 정전작 (소량 유입) | **figures + Strong Misreadings + 에세이** + 전 카탈로그층 | ~$1.5–2 | `HANDOFF-영화공장.md`·`factory/RUN-PLAYBOOK.md`·`factory/EXECUTOR-CODING-NOTES.md` |
| **② Tier-2 공장 (카탈로그 라인)** | 대량 신규 영화 | 카탈로그+신호층 (TakeScore·수상·개봉·촬영지·리셉션·문장) — **분석 없음** | ~$0.04–0.06 | `HANDOFF-티어2공장.md` (기획 완료·구현 대기) |
| **③ Tier-2 noindex 공장 (신호 회수)** | 기존 noindex Tier-2 (~3,800편) | 색인 게이트 신호 회수 + 콘텐츠 완비 (리셉션·수상·촬영지·TakeScore) | ~$0 (무료 API) | `HANDOFF-티어2noindex공장.md`·`worker/tier2noindex.py` |

## 계층 모델 (2026-07-15 실측)
- **Tier-1: 1,981편** — 분석 완비(figures 평균 9.3·미스리딩 13.8·에세이). `is_analyzed=true`.
- **Tier-2 색인: 1,189편** — 카탈로그층 + 강신호(리셉션/수상/lineage ≥3)로 게이트 통과.
- **Tier-2 noindex: 3,808편** — 같은 카탈로그층이나 강신호 미달. 승격 시 색인 편입.
- 합계 6,978편. (미해결 스텁 0.) 게이트 정본 = `lib/seo.ts filmIndexBar`.

## 실행

**① Tier-1 (신규 정전작)** — 어드민 `/admin/factory` "Add films" 또는 CLI:
```
python3 worker/factory.py ingest my-list.txt      # 또는  add "The Piano (1993)" --tmdb-id 897
python3 worker/factory.py run --run N --sync --yes # ≤5편 자동 실시간, 벌크는 배치
```
품질바: figures 8~9·미스리딩 12~13·이론가·트로프·movies-like 24·Fantasia·촬영지·TakeScore·to.W·감독포트레이트.

**② Tier-2 (카탈로그, 대량)** — 같은 엔진에 `tier=catalog`로 투입(어드민 라디오/CLI `--tier catalog`).
구현 대기 — T1(S06/S17 스코핑)이 유일 실질 블로커. 어드민 두-레인 리브랜딩 예정.

**③ Tier-2 noindex (신호 회수 + 콘텐츠 완비)** — 오케스트레이터:
```
python3 worker/tier2noindex.py enrich          # 수상+TakeScore+촬영지+revalidate 1회 완주
python3 worker/tier2noindex.py reception-wave  # 리셉션 1회 웨이브(색인 교차의 핵심 레버)
python3 worker/tier2noindex.py measure         # IDX 현황 스냅샷
```
**일일 웨이브**(리셉션은 OpenAlex 일일예산 제약 → 다일 회수): `worker/tier2noindex-daily.sh`를
`nohup bash worker/tier2noindex-daily.sh &`로 상시 가동. 정지: `touch worker/.t2noindex-stop`.
⚠️ **launchd(로그아웃 생존)는 TCC 차단** — `~/Documents/` 보호로 LaunchAgent가 워커 실행 불가
(filmclips launchd 사망과 동일 원인). 전체 로그아웃 생존을 원하면 `/bin/bash`+`/usr/bin/python3`에
Full Disk Access 부여(System Settings) 후 `worker/net.metatake.t2noindex.plist` 로드, 또는 저장소를
비보호 경로로 이전. 웨이브는 **멱등·resumable**이라 끊겨도 재실행(위 명령)하면 이어서 완주한다.

## 공통 불변식 (3개 공장 전부)
- **단일런 락**: 3 공장 런 동시 실행 금지(엔진 하나·2026-07-13 DB IO 장애 교훈). 하트비트+30분 stale 자동해제.
- **visible/is_analyzed/hold 조작 금지** — 색인=filmIndexBar(렌더타임)·visible=figures≥3 트리거.
- **compute_film_scores 금지**(전역 delete). Mgmt API=브라우저 UA. PostgREST 1000행 절단.
- **테스트=실시간(`--sync`)·벌크만 배치**. LLM 저술물(에세이·감독 큐레이션)은 신작마다 재생성 안 함(garden pass).
- **페이지 포맷은 page.tsx 공유** — Tier-1/Tier-2 렌더 블록 크롬 패리티 유지(정보량만 차이).

## 세션 산출물 (2026-07-15)
- Tier-1 공장 EXECUTOR 완성·실측 벌크 검증(run#6 20편 $20.12, 19/20 Tier-1)·실패패턴 6종 엔진화.
- Tier-2 noindex: 게이트 완화(+62)·파일럿 리셉션(+20)·콘텐츠 완비(촬영지 45→79% 등)·enrich 명령·일일 웨이브.
- Tier-2 페이지 크롬 패리티(EntityActions·SeqNav·Provenance) + Download-for-AI·MCP 붙임(마이그 0103).
