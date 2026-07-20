# HANDOFF — Odyssey: 시네필 영화 지도 + 내비게이션 (정본)

*작성 2026-07-20. 상태: **v1 릴리즈됨(36d3f99→main 80e2db5) · 리뷰 수정 라운드 staging 대기**. 이 문서가 /odyssey 체계의 정본.*

## §-1 리뷰 수정 라운드 (2026-07-20, 릴리즈 직후)

적대적 코드 리뷰(3렌즈 find→refute, 42.7만 토큰)가 치명1+주요2 확정. 릴리즈된 v1에 크래시/브릭은 없었으나 아래를 수정해 staging에 재푸시:
- **치명(데이터 정확성)**: codex 추출이 **order 없는 REST 페이지네이션으로 431편 누락** → 그 431편이 고도 3 기본값으로 몰림(band 3 = 1,959 중 724). 원인=films/prestige/avail은 order를 줬으나 codex 인라인 추출만 누락. 수정=`distinct on` 뷰로 영화당 최신 1행 정렬 추출. 고도 분포 정상화 {1:389,2:394,3:375,4:386,5:415}. **릴리즈된 v1의 고도 데이터는 부정확했음** — 이 수정이 반영돼야 정확.
- **주요**: 라인 path onClick에 드래그 가드 없음 → 라인 위에서 팬 시작 시 솔로+카메라 텔레포트. `moved>6` 가드 추가.
- **주요**: map/avail fetch 실패가 삼켜짐(영구 "Unfolding…"). 에러+Retry 노출.
- 기타: fly()가 pointerdown/휠/핀치에 취소(지터 제거)·runMode가 stale solo 정리·ascent/continue 근거·순서 교정·build 방어(빈 노선 max·codex 행 형태·country_override 우선)·/odyssey+35노선 코어 사이트맵 등재.
- **오탐**: next-seo "untracked map.v1.json import"는 오탐(커밋됨·Vercel 빌드 성공). JSON-LD 이스케이프 minor는 리포 전반 관례라 보류.

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
