# MetaTake 계보 데이터 — 최종 개요 (2026-06-25)

## 총량
| 항목 | 수치 |
|---|---|
| **film_lineage 멤버십 행** | **10,238** |
| ↳ 수상(won) | 4,998 |
| ↳ 등재(listed) | 5,240 |
| **films_master 고유 영화** | **6,733** (시작 986편 → 6,733편) |
| 멤버십에 등장하는 고유 영화 | 6,530 |
| **멤버 채워진 라인** | **115 / 239** |
| 감독 레지스트리(`auteurs.csv`) | 160명 (QID 검증) |
| 감독 대표작(`film_auteur.csv`) | 407행 |

## 라인 종류별(facet)
| facet | 채워진 라인 | 멤버십 행 |
|---|---|---|
| award (수상) | 55 | 3,540 |
| canon (정전) | 15 | 4,068 |
| national (국가) | 45 | 2,630 |

## 가장 많이 호명된 영화 (= 별자리 중심부, N개 라인 등장)
| N | 영화 |
|---|---|
| 19 | Parasite (2019) · Brokeback Mountain (2005) · Schindler's List (1993) |
| 18 | No Country for Old Men (2007) |
| 15 | Roma (2018) · Nomadland (2020) · On the Waterfront (1954) · Annie Hall (1977) · The Silence of the Lambs (1991) · American Beauty (1999) · Moonlight (2016) · The Social Network (2010) |
| 14 | The Bridge on the River Kwai (1957) · Forrest Gump (1994) · Slumdog Millionaire (2008) |

## 국가 라인 커버리지 (national 멤버십 행 기준, 상위)
kr 292 · jp 274 · de 174 · mx 165 · it 156 · es 141 · in 141 · br 126 · dk 115 · ar 101 · us 101 · gb 100 · pl 89 · se 88 · au 81 · ca 76 · tw 62 · ru 58 · fr 51

## films_master 연대 분포
1890s 11 · 1900s 18 · 1910s 59 · 1920s 187 · 1930s 348 · 1940s 370 · 1950s 582 · 1960s 744 · 1970s 743 · 1980s 769 · 1990s 758 · 2000s 858 · 2010s 894 · 2020s 392

## 완전 열거된 대표 라인 (예시)
- **TSPDT 1000** (1–1000 완전) · **NFR 925** (1989–2025 전 induction) · **NBR Top Ten** 874 (1930–2024)
- 칸 황금종려/베니스 황금사자/베를린 황금곰 전 수상 + 서브상(그랑프리·감독·각본·연기·카메라도르·볼피·은곰)
- 오스카 작품·감독·국제·연기·각본 / BAFTA / 골든글로브 / WGA / DGA·PGA·SAG·크리틱스초이스·고섬
- 비평가: NYFCC·LAFCA·NSFC·NBR · 정전: S&S2022·AFI100·BBC×3·NYT·TIME·Guardian·Cahiers100·BFI100
- 국가 작품상 20+개국 (한·일·중·대만·홍콩·인도·이란·프·스페인·이탈리아·독일·북유럽·폴란드·러시아·멕시코·아르헨·브라질·호주·캐나다)

## 잔여 (저가치·선택 — 마스터 보강 가능)
- **대형 벌크**: Criterion 컬렉션(~1,500) · MUBI 1000(커뮤니티) · Cahiers 연도별 Top10
- **영화제 섹션**(경쟁부문·주목할만한시선·오리종티 등, weight 0.30 "선정") — 연간 수십편×수십년, 변별력 낮음
- **무출처(미작성)**: Caimán 21세기 50선(존재 불확실) · 덴마크 올타임 정전(신뢰 폴 없음)

## 데이터 품질 노트
- 모든 행: title + year (+ list_slug, result, rank) 안정 키. 마스터가 `10_master_ingestion_runbook.md`로 TMDb 해소(P4947 영화) → `films.tmdb_id`.
- web_fetch 한도/표누락은 listchallenges·r.jina.ai 프록시·`?action=raw`로 우회. 추측 금지 — 부분/무출처는 명시.
- edition_year(시상연도) vs film_year(개봉연도) 구분 유지. 동점은 note=shared.
