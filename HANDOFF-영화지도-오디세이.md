# HANDOFF — Odyssey / Journey / Board: 시네필 영화 지도·내비게이션·조감 (정본)

*작성·종합 2026-07-20. 이 문서가 세 표면(/odyssey · /journey · /board)의 정본. **다른 AI는 아래 §A 종합을 먼저 읽을 것.** §-1~§-6은 이터레이션 이력(참조용, 시간 역순).*

---

## §A ⭐ AS-BUILT 종합 — 이어서 작업할 AI는 여기부터 (2026-07-20 종합)

### A0. 오늘 만든 세 표면 (한 문장씩)
1. **`/odyssey` = 지도(아틀라스)** — 시네필 영화 1,959편을 **평면 t-SNE 유사도 캔버스**에 배치. 가로=연도(세대), 세로=취향 성향. 무브먼트·장르 **35개 노선(길)**이 지나가고, 영화 클릭→그 노선 점등, ⌘/Ctrl+드래그로 카메라 틸트. 세로 포스터 타일(줌인 시). `+` SSR 노선 페이지 35개(`/odyssey/line/[slug]`, SEO).
2. **`/journey` = 여정 제안(The Metatake Deck)** — "지도≠GPS 내비"라는 오너 통찰. 큰 **METATAKE 버튼**을 누르면 **안정·모험·전혀 새로운 세 축 × 3편 = 9카드**가 게임처럼 뒤집혀 안 본 영화를 제안. 왼쪽에 본 영화 썸네일 뭉치. 필터(서비스·연도·장르). 카드별 seen/watchlist/별점.
3. **`/board` = 전체 조감 바둑판** — Tier-1 1,958편(=우리가 다루는 "시네필 영화 전체")을 **30열 바둑판**으로. 색 토글(본 영화/볼 영화/내 서비스)로 색이 들어오고 필터로 좁힘. **정렬 토글 「바둑판/본 영화 중심」**(취향 나선 배치·구획선·「내 서비스 가까이」). hover 말풍선 + 우측 상세 드로어. 아래에 마이룸 정전·감독 커버리지.

### A1. ⚠️⚠️ 배포 상태 — 중복/누락 방지 최우선으로 반드시 확인
- **릴리즈 진행(2026-07-20 저녁): 오너가 staging(`00c4a5e`)을 `release.command`로 프로덕션 반영.** 반영 후 세 표면(`/odyssey`·`/journey`·`/board`)이 metatake.net 라이브.
  - **릴리즈 완료 확인법**: `git log origin/main`에 오늘 오디세이 커밋(또는 `release: staging → main 2026-07-20 (저녁)`)이 있으면 반영됨 / metatake.net/board 접속. **아직 안 보이면 오너 release 대기 중** — 이 줄을 "라이브"로 갱신할 것.
  - 릴리즈 안전성 사전검증 완료: **staging 전 커밋 Vercel 빌드 READY**(프로덕션 빌드 성공)·**CI 타입체크 통과**·staging↔main 병합 깨끗(마지막 릴리즈 889c828 이후 staging엔 아래 오디세이 8커밋만·타인 작업 없음).
- 오늘 작업 커밋 체인(staging): `7ebed04`(갤럭시 t-SNE 포스터/지형/노선) → `12110cd`(3D 틸트·클릭노선·확대) → `854be38`(평면 시대×성향) → `69f68d9`(Metatake Deck, /odyssey 임베드) → `8353486`(덱을 `/journey`로 분리·/odyssey 지도전용 복귀) → `6cef688`(`/board` 바둑판+커버리지) → `a33b481`(보드 30열+본영화중심 취향배치) → `00c4a5e`(이 §A 문서).
- **릴리즈 반영 전 production `main`(889c828) = 구 SVG 노선도 v1**(`OdysseyMap.tsx`). **에이전트는 main 직푸시·release 금지**(오너만, `HANDOFF-배포체계-P0.md`). staging 커밋은 자유.
- **구 `components/odyssey/OdysseyMap.tsx`(SVG 시간축 노선도)는 미사용 보존**(오너가 timeline 뷰 재요청 대비). `app/odyssey/page.tsx`는 `OdysseyGalaxy` import. **SVG 재구축·삭제 금지.**

### A2. 파일 맵 (표면별)
| 표면 | 페이지 | 주 컴포넌트 | 로직/스타일 |
|---|---|---|---|
| Odyssey 지도 | `app/odyssey/page.tsx` · `app/odyssey/line/[slug]/page.tsx` | `components/odyssey/OdysseyGalaxy.tsx`(캔버스, GalaxyView 포크) | `lib/odyssey/types.ts`(elbowPath·타입) · `lib/odyssey/modes.ts`(목적지 8모드) · `app/odyssey/odyssey.css` |
| Journey 덱 | `app/journey/page.tsx` | `components/odyssey/MetatakeDeck.tsx` | `lib/odyssey/deal.ts`(3축 딜) · `app/odyssey/deck.css` |
| Board 바둑판 | `app/board/page.tsx` | `components/odyssey/BoardGrid.tsx` · `components/odyssey/BoardCoverage.tsx`(서버, 커버리지) | `lib/odyssey/board.ts`(packBoard·tasteLayout) · `app/board/board.css` |
| 공통 데이터 | — | — | `public/odyssey/map.v1.json`(480KB) · `public/odyssey/avail.v1.json` · 빌드 `worker/odyssey-extract.py`·`worker/odyssey-build.py`·`worker/odyssey_overrides.json` |
| 미사용 보존 | — | `components/odyssey/OdysseyMap.tsx`(구 SVG) | — |

### A3. 공통 데이터 아티팩트 `public/odyssey/map.v1.json`
빌드 산출(런타임 DB/LLM 0). station당 필드:
`s`(slug) `t`(제목) `tk`(한국어 제목) `y`(연도) `d`(감독) `x`/`yy`(구 SVG 좌표) `b`(대역) `c`(고도 1–5=cinecodex C 5분위) `p`(poster_path) `pr`(prestige) `pk`(정전봉우리 top100) `ln`(노선 id[]) `tf`(환승) `tx`/`ty`(t-SNE 좌표) `cl`(취향 클러스터) `gi`(장르 인덱스[]) `v`(TakeScore value) `u`(TakeScore U). 최상위: `genres`(장르명[]) `lines`(35노선) `stations`(1,959). `avail.v1.json`={KR,US}→{slug→[provider]}.
- **재빌드 절차**: ① curation/cinecodex는 REST 미노출 → Supabase에 임시 public 뷰(`tmp_ody_*`) 생성 → `odyssey-extract.py` 실행 → 뷰 드롭(뷰 SQL은 extract.py 주석). ② `python3 worker/odyssey-build.py <data_dir>`. **주의: 추출은 반드시 order 지정**(과거 order 누락→431편 고도 오류, §-1).

### A4. 각 표면 의도(왜 만들었나) + 핵심 규칙
- **Odyssey 지도**: 오너가 "구글 t-SNE Map처럼, 단 길(노선)이 있는 것"을 원함. 시간축 노선도(v1)→자유 t-SNE 갤럭시→**평면 시대×성향**으로 진화(x=시대라 노선이 좁은 시대대역 줄기로 추적 가능). 지형(3D)은 폐기(2D 캔버스 한계, 평면 카메라 틸트로 대체). ⚠️노선 기본 매우 은은(35개=스파게티 방지)·hover/클릭 시 점등.
- **Journey 덱**: 오너 최상위 목표="지도 제시가 아니라 시네필이 되도록 돕는 실질적 여정 제안". 3축=`lib/odyssey/deal.ts`(씬≥3편이면 취향 centroid 거리밴드, 미만이면 고도 입문코스). ⚠️안 본 영화만.
- **Board 바둑판**: "가치 상위 ~2000편을 한눈에 조감". TakeScore 상위는 대중 카탈로그 혼입→**Tier-1 1,958편이 곧 시네필 코퍼스**. 「본 영화 중심」=취향 중력(본 영화 중앙+구획선). ⚠️보드 세로로 매우 김·이미지 1958장 lazy.
- 공통: **서버 HTML 개인화 금지**(본 영화/구독은 클라 오버레이, UserFilmsProvider `seenSlugs`+`toggleSeen`/`toggleWatch`/`rate`). 지도 좌표=고정 자산. 용어 헌장상 Atlas/Map/Network 점유(→ 새 이름 Odyssey/Journey/Board).

### A5. 다음 단계(미완/후속) — 중복 착수 금지 위해 명시
- **릴리즈**: 오너가 staging(a33b481)을 검토 후 release.command로 반영해야 라이브 됨. (에이전트 대기)
- **Nav 진입점**: 세 표면이 상단 Nav에 없음(현재 상호 링크만). Nav 추가는 공유파일 수정→별도.
- **로그인 실측 미완**: Board 「본 영화 중심」의 seen-중앙+구획선, Deck의 취향맞춤은 로그인+본영화 표시 상태에서 오너 검증 필요(개발은 미로그인으로 검증됨).
- **틸트 강화**(Odyssey): 평면 원근 틸트는 subtle. 진짜 3D 릴리프는 WebGL급 후속.
- **성향축 개선**: Board/평면지도 세로축=t-SNE ty 1축. 전용 1D tendency projection은 후속.
- ko 프로젝션(노선명 desc_ko는 데이터 내장, UI 노출 후속)·사이트맵은 등재됨(/odyssey·35노선·/journey·/board).

### A6. 커밋/배포 메커닉 (에이전트용)
- 워킹트리에 무관 변경 다수 → **temp-index로 origin/staging 위에 원자 커밋**: `GIT_INDEX_FILE=<tmp> git read-tree origin/staging && git add <files> && TREE=$(git write-tree) && git commit-tree $TREE -p origin/staging -F msg.txt` → `git push origin <commit>:staging`. (bash의 `$(...)`가 커밋 메시지 등에서 bad substitution 나면 SHA를 변수로 받아 별도 push.)
- CI 타입체크 래칫(기준선 20). 로컬 tsc는 타 작업(Expo/Metro) 부하 시 느림→CI로 검증.
- dev 확인은 `npx next dev --webpack`(turbopack dev CSS 함정).

---

## §-1 리뷰 수정 라운드 (2026-07-20, 릴리즈 직후)

적대적 코드 리뷰(3렌즈 find→refute, 42.7만 토큰)가 치명1+주요2 확정. 릴리즈된 v1에 크래시/브릭은 없었으나 아래를 수정해 staging에 재푸시:
- **치명(데이터 정확성)**: codex 추출이 **order 없는 REST 페이지네이션으로 431편 누락** → 그 431편이 고도 3 기본값으로 몰림(band 3 = 1,959 중 724). 원인=films/prestige/avail은 order를 줬으나 codex 인라인 추출만 누락. 수정=`distinct on` 뷰로 영화당 최신 1행 정렬 추출. 고도 분포 정상화 {1:389,2:394,3:375,4:386,5:415}. **릴리즈된 v1의 고도 데이터는 부정확했음** — 이 수정이 반영돼야 정확.
- **주요**: 라인 path onClick에 드래그 가드 없음 → 라인 위에서 팬 시작 시 솔로+카메라 텔레포트. `moved>6` 가드 추가.
- **주요**: map/avail fetch 실패가 삼켜짐(영구 "Unfolding…"). 에러+Retry 노출.
- 기타: fly()가 pointerdown/휠/핀치에 취소(지터 제거)·runMode가 stale solo 정리·ascent/continue 근거·순서 교정·build 방어(빈 노선 max·codex 행 형태·country_override 우선)·/odyssey+35노선 코어 사이트맵 등재.
- **오탐**: next-seo "untracked map.v1.json import"는 오탐(커밋됨·Vercel 빌드 성공). JSON-LD 이스케이프 minor는 리포 전반 관례라 보류.

## §-6 The Board — 시네필 영화 전체 조감 바둑판 `/board` (2026-07-20, 오너 지시)

오너: 가치점수 상위 ~2000편을 바둑판 썸네일로 한눈에 조감. → 별도 페이지 `/board`.
- **선정**: TakeScore 상위는 대중 카탈로그 혼입(844/2000만 t-SNE)로 시네필 조감 부적합 → **Tier-1 분석 코퍼스 1,958편 = "메타테이크가 다루는 시네필 영화 전체"**를 사용(모두 포스터·연도·성향·장르·가치). 아티팩트에 `v`(TakeScore value)·`u`·`gi`(장르)·`genres` 신설.
- **배치**: `lib/odyssey/board.ts packBoard` — 40열(연도 등량 버킷) × ~50행(열 내 t-SNE 성향), 충돌은 최근접 빈 행. "연도순이지만 밀릴수" 반영.
- **컴포넌트**: `components/odyssey/BoardGrid.tsx`(DOM 그리드, 이벤트 위임 hover/click)+`app/board/board.css`. 색으로 보기 토글 **본 영화/볼 영화/내 서비스(+국가)** — 켜면 매칭 영화 링(빨강/금/청록)+나머지 dim(anyHl&&!lit). 거르기 **연도범위·장르** → dim(off)+카운트. hover 말풍선(제목·감독·가치·고도·seen). **자세히 보기 = 우측 드로어**(포스터·점수 3종·장르·노선·스트리밍·봤어요/볼래요/별점·전체페이지 링크, ESC/scrim 닫기, 페이지 이동 없음). 실측: Rocky 클릭→드로어 정상.
- **커버리지(그 아래)**: `components/odyssey/BoardCoverage.tsx`(서버, force-dynamic, auth) — **마이룸 me_coverage(정전 facet)·me_auteur_conquest** 가져와 정전 커버리지 바+감독 정복률 링. 미로그인=로그인 유도. room 프로바이더 없이 데이터만 재사용(경량).
- 사이트맵 등재. ⚠️보드 매우 높음(2:3×행)·dim .16(강함)·이미지 1958장 lazy.
- **v2(오너 지시): 30열 + 「본 영화 중심」 방사 배치**. 정렬 토글 [바둑판][본 영화 중심]. taste모드=`lib/odyssey/board.ts tasteLayout` — 본 영화 centroid로부터 취향거리 정렬→피보나치 나선(seen이 중앙 뭉침·유사 가까이·멀수록 jitter↑ 흐트러짐)·seen 코어에 빨간 점선 **구획선**(내가 본 영화). **「내 서비스 가까이」**=서비스 영화 거리*0.5로 안쪽 당김. 셀 절대위치+transform transition으로 격자↔나선 **모핑**. spacing은 폭에 맞게 clamp(한눈에). dim은 hasLit일 때만(무매칭 토글=빈판 방지). 실측: 나선 클러스터·모핑 정상(미로그인은 seen코어/구획선 없음).

## §-5 The Metatake Deck — 여정 제안(진짜 내비게이션) (2026-07-20, 오너 지시)

오너 핵심 재정의: **지도≠GPS 내비. 목표는 지도 제시가 아니라 시네필이 되도록 돕는 실질적 여정 제안.** → "메타테이크" 버튼을 누르면 **세 축 × 3편 = 9장의 카드가 게임처럼 화려하게 뒤집힘**.
- **세 축**: `lib/odyssey/deal.ts` — 안정(취향 한복판·실패없음)·모험(한 걸음 밖)·전혀새로운(완전히 다른 세계). 씬≥3편이면 **취향중심(seen tx/ty centroid) 거리밴드**(0-18%/40-62%/85-100%), 미만이면 **고도(C밴드) 입문코스 폴백**. 밴드 내 prestige 우선+시드 셔플(다시 펼치기 변주). **안 본 영화만**.
- **필터(누르기 전)**: 내 서비스만(avail·country)·연도범위·장르(아티팩트 `genres`+`gi` 신설, 빌드에 추가). 
- **컴포넌트**: `components/odyssey/MetatakeDeck.tsx`+`app/odyssey/deck.css`. 큰 METATAKE 버튼(글로우·sheen)=코너 제목. **왼쪽에 본 영화 썸네일 작게 뭉침(deck-pile)**. 카드=3D flip(rotateY, `--i` 스태거)·backface·다크 게임테이블(단일테마 의도). 카드별 seen✓·watchlist＋·★5 별점(uf 직접).
- **배치**: **별도 페이지 `/journey`**(오너 지시: 지도 유지·덱은 추가 페이지). `/odyssey`는 지도 전용 복귀+`/journey` 링크. `app/journey/page.tsx`(SSR 셸+deck.css). 사이트맵 coreEntries 등재. 실측: 미로그인=입문코스(American Beauty▲→Parasite▲▲▲→Tree of Life/Persona/Mirror▲▲▲▲▲) 고도 진행 정확·다시펼치기 변주 확인.
- ⚠️ 미로그인 hydration 경고는 브라우저 확장(data-sharkid) 소행·우리 버그 아님. 후속: 카드별 "왜 이 축" 근거·모바일 링크·seen 실적 반영 실시간.

## §-4 평면 시대×성향 전환 (2026-07-20, 오너 지시)

오너 재정의: **지형(3D 산맥) 폐기·평면화**, **최초의 구획 복귀 = 가로 세대(시대)·세로 영화성향**, t-SNE는 성향축으로 채택(평면), 포스터 세로 유지, 지도 크게 유지, **평면이지만 카메라 수직틸트 가능**(길 가독성 목적).
- **레이아웃**: x = 연도(세대, `wx=(year-mid)*3.4`), y = 취향성향(t-SNE y, `wy=ty*1.15`). 클라이언트 재배치(아티팩트 재빌드 불필요 — year·tx·ty 이미 내장). 지형/heightField 전부 제거.
- **효과 확인**: x=시대라 각 운동이 좁은 시대대역에 모여 **road가 추적 가능한 줄기로**(누벨바그=1959-68 수직줄기·패럴렐시네마=Ray 수평줄기 실측). 오너 핵심 목표 달성.
- **틸트**: 평면 원근 pitch(고도 lift 없음, y가 수평선으로 압축). 평면이라 시각적으로 subtle — 시대축만으로 이미 road 가독↑라 틸트는 보조. ⚠️더 강한 틸트 원하면 후속(원근 스케일 추가).
- 데카드 그리드라인+라벨(시대축)·축 라벨(취향·성향/과거·현재). Terrain 토글 제거.
- click→line·목적지 8모드·seen/avail·크게 유지. 구 갤럭시(자유 t-SNE+지형)는 이 버전으로 대체.

## §-3 갤럭시 v2 — 틸트·클릭노선·확대 (2026-07-20, 오너 지시)

- **⌘/Ctrl+드래그 3D 틸트**: pitch 도입. 지형이 수평선으로 원근 압축되고 각 영화가 고도(높이필드)만큼 화면상 위로 떠올라 "갤럭시를 비스듬히 내려다보는" 뷰. `LIFT=300·sin(pitch)` px, `PROJ()` 헬퍼가 노드·노선·라벨·pick 전부에 적용. Terrain은 압축 hillshade 이미지(고정 이미지라 2D캔버스로 진짜 3D 산맥은 미구현 — 능선렌더 시도했으나 muddy→압축 이미지+포스터 lift로 절충). ⚠️완전 3D 릴리프는 후속(WebGL 급).
- **영화 클릭 → 노선 활성화**: onUp이 `setSolo(p.ln[0])` — 클릭한 영화의 노선이 빨갛게 켜지고 그 노선 영화들이 도드라짐. 다노선 영화는 카드에서 전환. 실측: Psycho 클릭→고전할리우드+호러선 점등.
- **확대**: odg-root max-width 1280→1480, stageH=`min(vh-168, 1040)` 반응형(전엔 640 고정).
- ⚠️pick도 PROJ 투영 적용(틸트 시 클릭 정확). 커밋 후속(7ebed04 위).

## §-2 갤럭시 전환 (2026-07-20, 오너 지시)

오너가 Google Arts&Culture t-SNE Map을 참조로 지도 재편 지시: "각 영화=세로 포스터, 유사도 배치(구글과 같이), **단 길(노선)이 있는 것**, 부드러운 줌아웃, 높낮이(지형)". → 시간×전통 SVG 노선도를 **t-SNE 유사도 갤럭시**로 전환.

- **좌표계 = t-SNE**(`film_map_xy`, film_taste_vector 임베딩, 1,935/1,959편). 시간축 폐기. 유사 영화가 성운으로 뭉침(호러·서크풍 멜로드라마 등 실측 확인).
- **렌더 = 캔버스**(`components/odyssey/OdysseyGalaxy.tsx`, GalaxyView 포크). 줌인 시 세로 포스터 타일(w92, LOD), 라벨 그리드 충돌 회피.
- **지형(높낮이)** = hillshade 높이 필드. 각 영화가 `1+prestige+altitude` 가중 가우시안 splat → 밀집+정전+고도 지역이 봉우리(밝은 능선), 나머지 계곡(청회색). "정전 봉우리" 기획이 시각화됨. Terrain 토글.
- **노선(길)** = 역들의 t-SNE 좌표를 연대순 곡선으로. **기본 매우 은은(스파게티 방지), hover/solo 시 그 노선만 빨간 길로 강조**. 이게 구글에 없는 차별점.
- **부드러운 관성 줌** = view→target lerp(EASE 0.22). 목적지 모드가 target 설정으로 fly.
- 목적지 8모드·본 영화/구독 오버레이·역 카드 유지(SVG판에서 이식). SSR 노선 페이지 35개도 유지(map.v1.json 재사용).
- ⚠️구 `OdysseyMap.tsx`(SVG 시간축)는 미사용 보존(오너가 timeline 뷰 재요청 대비). page는 Galaxy import.
- 데이터: `map.v1.json` station에 tx/ty/cl 추가(422KB). 재빌드는 extract(mapxy.json)+build.

## §0 한 장 요약

기존 피처들(Next Movie·Canon·Connections·TakeScore·What to Watch)은 내비게이션의 부품(나침반·계기판·도로·교통정보)이었고, 본체 세 가지 — **지도 원판 · 현위치 · 목적지→경로** — 가 없었다. Odyssey가 그 본체다.

- **지도**: Tier-1 `visible=true` 1,959편 = 역(station). 가로축 = 시간(연도, 코퍼스 밀도 비례 스케일), 세로 대역 = 제작 전통 4개(할리우드·영어권 / 유럽 / 동아시아 / 글로벌 사우스).
- **노선 35개** = 여정 단위: 무브먼트 간선 26(curation.hub 라이브 멤버십) + 워크플로 큐레이션 4(고전 할리우드 54·필름 누아르 32·슬로우 시네마 31·뮤지컬 19) + 장르 테마선 5(SF·호러·다큐·애니·웨스턴, prestige 상위 캡) + 정전 특급(prestige 상위 110). **환승역 106**.
- **고도(altitude) 1~5** = cinecodex `c_cost` 코퍼스 5분위. "실패 없이"의 핵심 계기.
- **현위치** = 본 영화(UserFilmsProvider.seenSlugs) 클라이언트 오버레이. **서버 HTML 개인화 금지 원칙 그대로**.
- **목적지는 입력이 아니라 제안**: 8모드(Continue the line / Transfer / New continent / Bold ascent / Summit attempt / Tonight no-fail / Back to the roots / Mystery train).

## §1 파일맵

| 파일 | 역할 |
|---|---|
| `worker/odyssey-extract.py` | Supabase → 로컬 JSON 추출(공개 테이블은 REST+service key; curation/cinecodex는 임시 public 뷰 생성→추출→드롭) |
| `worker/odyssey-build.py` | **카토그래피 컴파일러**: 멤버십+점수+오버라이드 → `public/odyssey/map.v1.json`(386KB)·`avail.v1.json`(KR 1,097/US 1,562편) |
| `worker/odyssey_overrides.json` | **편집층**: 무국적 36편 국가 배정 + 큐레이션 노선 멤버십/설명문 |
| `lib/odyssey/types.ts` | 아티팩트 타입 + `elbowPath`(수평 직선 + 레인 전환 S-커브) |
| `lib/odyssey/modes.ts` | 목적지 제안 엔진 8모드(순수 클라이언트 함수, 런타임 LLM/DB 0) |
| `components/odyssey/OdysseyMap.tsx` | 지도 본체: SVG + 팬/줌(휠·드래그·핀치) + 줌 3단 LOD(z0/z1/z2 라벨) + 노선 hover/솔로 + 역 카드 + 본영화/구독 오버레이 + 목적지 레일 |
| `app/odyssey/page.tsx` | 서버 셸(SEO 텍스트 + SSR 노선 색인) + 클라이언트 지도 |
| `app/odyssey/line/[slug]/page.tsx` | **SSR 노선 페이지 35개**(generateStaticParams 전량 프리렌더, ItemList JSON-LD, 환승 표기) — SEO 표면 |
| `app/odyssey/odyssey.css` | 전 스타일(`.ody-*` 스코프) |

## §2 카토그래피 규칙 (재빌드 시 필독)

1. **지도는 고정 자산**: 좌표는 빌드 시 확정, git 버전 관리. 같은 입력 = 같은 좌표.
2. 국가→대역: `curation.film_hub`의 country/region 허브 기준(1,923편) + 오버라이드 36편. 미배정은 유럽 폴백.
3. **역의 홈 레인** = 소속 노선 중 LINE_META 순서상 첫 밴드-로컬 노선의 레인. 레인 배정은 **편집 순서**(연대순 정렬 금지 — classical→noir→musical이 인접 레인에 앉아야 공유역 브레이드가 좁게 유지됨).
4. **크로스 밴드 구간은 고스트**(opacity 0.07): 밴드-로컬 노선의 대륙 밖 원정 구간과 크로스 노선(장르선·정전특급) 전체는 hover/솔로 시에만 완전 표시. 이게 없으면 수직 스파게티로 지도가 죽는다(실측).
5. 노선 없는 역 = 로컬 정거장(작은 점, 밴드 하부 주거 행에 해시 배치).
6. c_cost 없는 65편 → 고도 3 기본값.

## §3 큐레이션 노선의 출처와 교훈

- 멀티에이전트 워크플로(큐레이터 5 + 적대 검증 10, 78.7만 토큰)로 초안→검증. **큐레이터는 풀 제약을 넘어 지식으로 뽑는다 → 최종 제약은 코퍼스 ∩ 멤버십**(기계 필터). 오리지널 블레이드 러너·아파트먼트·오즈의 마법사조차 Tier-1에 없다 — 코퍼스가 정전의 전부가 아님을 지도가 드러냄.
- 브리티시 뉴웨이브선: 코퍼스 지지 0으로 탈락(키친싱크 고전이 Tier-1에 없음). 소비에트 몽타주·체코 뉴웨이브 동일. **코퍼스가 자라면 오버라이드에 멤버 추가로 노선 부활 가능**.
- 검증자 제거 5건(채플린 2·카잔 2·로튼 1) 수용됨 — 사유는 워크플로 저널 참조.

## §4 배포·운영

- 정적 아티팩트라 런타임 DB/LLM 부하 0. 재빌드 = extract → build → 커밋(코퍼스 변경·허브 큐레이션 변경 시).
- staging 커밋 36d3f99는 **origin/main 기반 임시 인덱스**로 생성(로컬 브랜치의 타 프로젝트 커밋 미포함). 릴리즈는 오너 22:00 release.command.
- dev 확인은 `--webpack` 필수(turbopack dev CSS 함정).

## §5 다음 단계(오너 결정 대기 포함)

1. **Nav 진입점**: 현재 /odyssey 직링크만. Nav(Wander 그룹?) 추가는 공유 파일 수정이라 별도 커밋.
2. 사이트맵 등재(lib/sitemap 계열 수정) + ko 프로젝션(name/desc_ko 데이터는 이미 내장).
3. P2: 경로 하이라이트 고도화(현재 출발→목적 단일 구간), kinship 골목길 레이어, fog-of-war 지역 답사율.
4. 모바일 앱 연동(v4 판단 내비게이터의 지도 탭).
5. 코퍼스 갭 백필(뮤지컬·BNW 고전 등)은 영화공장 인제스트 결정 사항.
