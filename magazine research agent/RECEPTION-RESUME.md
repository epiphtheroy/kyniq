# Reception 탭 — 재개 체크리스트 (2026-06-24)

영화 페이지에 비평가·학술 "Reception" 섹션 + 탭을 붙이는 작업. 코드/DB는 끝났고, **데이터 수집 → 적재 → 배포**만 남음.

## 지금 상태
- 영화 페이지 UI(Reception 섹션 + 탭) + CSS = 완료(로컬, 아직 배포 전).
- DB 테이블 `film_reception` + RPC + RLS = 적용 완료.
- 발굴 워커 `run-reception-all.command` = **실행 중**(비평 Brave 수집 중).
- OpenAlex IP가 일시 차단됨 → 회로차단기가 학술을 멈추고 **비평만** 수집 중. 논문은 "보류(ap)"로 표시되어 나중에 채움.

## 확정된 설계 (다시 안 정해도 됨)
- 탭 이름: **Reception** · 인용 길이 **≤15단어** · 곡선따옴표 이탤릭.
- 매체: 아트하우스 allowlist 150 + 주류 평론매체 33(RogerEbert·Guardian·Variety·NYT·Slant·AV Club 등).
- 비평 글쓴이 캡처(robots 허용 시) · 학술 공저 "et al." · 본문 첫 평가문장 폴백(robots 허용, ≤15단어).
- 보일러플레이트(뉴스레터/쿠키) dek 제거 · 학술 오탐 게이트(영화단서/감독성).
- 저작권: 본문 미저장 · 매체당 1개 · 실존 URL/DOI만.

## 돌아오면 할 일 (순서대로, 전부 Finder 더블클릭)
1. **전체 실행이 끝났는지 확인** → 끝 요약에 `FILMS … reviews … academic-pending …` 가 보이면 OK.
2. **`run-reception-all.command` 한 번 더** — 이미 된 영화는 건너뛰고, 실패(ENOENT)한 몇 편만 재처리(~1분).
3. **`run-reception-load.command`** — DRY로 건수 확인 → `y` 입력 → `film_reception` 적재(리뷰 위주, 논문은 나중).
4. **`deploy-reception-ui.command`** — Reception 섹션+탭 배포(Vercel ~2분).
5. **확인**: 영화 페이지 열기 → 예 `https://metatake.net/film/the-tragedy-of-macbeth-2021` → 상단 탭에 **Reception**, 섹션에 리뷰 표시.

## 논문(Scholarship) 채우기 — OpenAlex 풀린 뒤 (몇 시간~다음날, 또는 거주지형 VPN exit)
6. **`run-reception-fill-academic.command`** — 보류(ap) 영화의 논문만 채움(Brave 재호출 없음).
7. **`run-reception-load.command`** 다시 — 논문 반영 → 영화 페이지에 ISR(최대 5분)로 노출.

## 파일 위치
- 워커/데이터: `magazine research agent/` (reception-discover.py, reception-run.py, reception-load.py, reception-all.jsonl, reception_data/)
- 커맨드: `MetaTake/` 루트 (run-reception-all / -load / -fill-academic, deploy-reception-ui)
- UI: `app/film/[slug]/page.tsx` (Reception 섹션), `app/globals.css` (.rcp-*)

## 비용
전부 ≈$0 (OpenAlex/Wikipedia/og 무료 + Brave 무료티어 ~1,935쿼리). LLM 0.
