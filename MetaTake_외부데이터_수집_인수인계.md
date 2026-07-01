# MetaTake 외부 데이터 수집 — 인수인계 문서

작성일: 2026-06-25
작성 목적: 영화별 외부 정보 수집 방식을 정리하여, 데이터 적재를 담당할 DB 마스터 AI 및 후속 작업자에게 전달한다.

---

## 1. 우리가 하려는 것 (Goal)

보유 중인 **TMDB id**를 기준점으로, 영화마다 외부 정보를 자동으로 끌어와 MetaTake에서 활용한다. 최종적으로 아래 두 가지를 화면에 구현하는 것이 목표다.

1. **평점 배지**: IMDb 평점·투표수 + Metascore + Rotten Tomatoes 토마토미터를 영화 상세 페이지 **상단에 적당히 배치**한다.
2. **국가별 시청 채널**: TMDB에서 국가별 시청 가능 채널(넷플릭스·아마존 등)을 가져와, 사용자가 **국가를 설정하면 그 국가에서 볼 수 있는 채널**이 노출되도록 한다.

수집한 모든 데이터는 **향후 개인화(Personalization) 페이지에서 활용**할 예정이다. 따라서 단발성 표시가 아니라 재사용 가능한 형태로 저장되어야 한다(저장 방식은 §5 참고).

---

## 2. 데이터 소스와 수집 방법 (How)

수집은 두 개의 무료 API로 끝난다. **TMDB가 허브**이고, TMDB가 알려주는 **IMDb id로 OMDb를 연결**한다.

### 2.1 TMDB — 메인 허브 (보유한 TMDB id 사용)

한 번의 호출로 기본정보 + IMDb id + 전 국가 스트리밍 채널을 모두 받는다. `append_to_response`로 묶는 것이 핵심(호출 수 절감).

```
GET https://api.themoviedb.org/3/movie/{tmdb_id}?api_key=KEY&append_to_response=external_ids,watch/providers
```

가져오는 것:

- **기본정보**: 제목, 개봉일, 러닝타임, 장르, 줄거리(overview), 포스터/배경 경로 등
- **external_ids.imdb_id**: OMDb 연결에 사용하는 핵심 키 (예: `tt0137523`)
- **watch/providers**: 국가별 시청 채널 (아래 §2.2 상세)

### 2.2 TMDB watch/providers — 국가별 시청 채널

> **중요**: 이 엔드포인트는 국가를 골라서 호출하는 게 아니다. **한 번 호출하면 모든 국가가 한꺼번에** `results` 안에 ISO 3166-1 국가코드로 내려온다. 국가별로 쓰려면 한 번 받아 두고 원하는 국가코드만 필터한다.

응답 구조 예시:

```json
{
  "id": 550,
  "results": {
    "KR": {
      "link": "https://www.themoviedb.org/movie/550/watch?locale=KR",
      "flatrate": [
        { "provider_id": 8, "provider_name": "Netflix", "logo_path": "/xxx.jpg", "display_priority": 0 }
      ],
      "rent": [
        { "provider_id": 10, "provider_name": "Amazon Video", "logo_path": "/yyy.jpg", "display_priority": 3 }
      ],
      "buy": [ ... ]
    },
    "US": { "link": "...", "flatrate": [ ... ], "rent": [ ... ], "buy": [ ... ] },
    "GB": { ... }
  }
}
```

채널 유형 구분:

- `flatrate` = 구독으로 시청 (예: Netflix 구독자)
- `rent` = 대여
- `buy` = 구매
- 일부 국가/작품엔 `free`, `ads`도 등장

넷플릭스·아마존 등은 각 배열 안의 `provider_name`(및 `provider_id`)으로 식별한다.

> **딥링크 제약(반드시 인지)**: JustWatch 라이선스 때문에 넷플릭스/아마존 앱으로 **직접 가는 딥링크는 제공되지 않는다.** 국가별 `link`(TMDB watch 페이지)만 내려온다. 즉 "이 국가에서 어떤 채널로 볼 수 있다"까지는 정확하게 표시 가능하지만, 클릭 시 바로 해당 앱 재생 페이지로 보내는 직링크는 없다.

- 비용: 무료 (TMDB API key 필요)

### 2.3 OMDb — 평점 (TMDB가 준 IMDb id로 호출)

```
GET https://www.omdbapi.com/?i={imdb_id}&apikey=KEY
```

가져오는 것 (영화 상단 평점 배지용):

- **imdbRating** — IMDb 평점 (예: `8.8`)
- **imdbVotes** — IMDb 투표수 (예: `2,300,000`)
- **Metascore** — Metacritic 점수 (예: `66`)
- **Ratings[]** 배열 안의 **Rotten Tomatoes 토마토미터** (예: `{ "Source": "Rotten Tomatoes", "Value": "79%" }`)

응답 예시(발췌):

```json
{
  "imdbRating": "8.8",
  "imdbVotes": "2,300,000",
  "Metascore": "66",
  "Ratings": [
    { "Source": "Internet Movie Database", "Value": "8.8/10" },
    { "Source": "Rotten Tomatoes", "Value": "79%" },
    { "Source": "Metacritic", "Value": "66/100" }
  ]
}
```

주의 사항:

- **Rotten Tomatoes는 OMDb를 통해 무료로 받는다.** RT 공식 API는 사용하지 않는다(연 $60,000 수준, 사실상 폐쇄).
- OMDb의 RT 값은 **평론가 토마토미터(%)만** 제공한다. **관객 점수(audience score)는 없다.**
- Metacritic 역시 공식 공개 API가 없어 OMDb의 Metascore로 대체한다.
- 데이터 신선도는 약간 지연될 수 있다(최신 개봉작은 일부 필드가 비어 있을 수 있음 → null 처리 필요).
- 비용: 무료, **1,000회/일** 제한 (OMDb API key 필요) → 캐싱/배치 권장.

---

## 3. 화면(UI) 요구사항

1. **평점 상단 배치**: §2.3의 세 평점(IMDb, Metascore, RT 토마토미터)을 영화 상세 상단에 적당히 배치. 값이 없는 항목은 숨김 처리.
2. **국가별 시청 채널**: 사용자가 국가를 선택하면 해당 국가코드(KR/US/…)의 `flatrate`/`rent`/`buy` 채널을 노출. 채널 로고는 `logo_path`로 표시.
3. **개인화 연동**: 위 평점/시청 데이터는 추후 개인화 페이지(취향 기반 추천, 내가 볼 수 있는 작품 필터 등)의 입력으로 재사용된다. 저장 시 이 활용을 전제로 설계.

---

## 4. 이번 범위에서 제외하는 것 (Out of Scope)

- **Rotten Tomatoes 공식 API**: 사용 안 함 → OMDb 토마토미터로 대체
- **Metacritic 공식 API**: 존재하지 않음 → OMDb Metascore로 대체
- **Google 영화 정보(지식 패널)**: 공식 API 부재로 사용 안 함
- **Wikipedia / Wikidata 연결**: 이번 범위 제외(향후 필요 시 IMDb id 기준으로 추가 가능)
- **Netflix / Amazon 공식 카탈로그 API**: 존재하지 않음 → TMDB watch/providers로 대체

---

## 5. 데이터 적재 (DB 마스터 AI 담당)

> 데이터 적재(스키마 설계, 저장소 선택, 적재 파이프라인, 정규화, 인덱싱, 갱신 주기, 캐싱 전략 등)는 **DB를 잘 아는 마스터 AI가 알아서 결정·구현할 일**이다. 본 문서는 "무엇을 어디서 어떻게 가져오는가"까지만 정의하고, 저장 구조는 위임한다.

참고용 힌트(강제 아님): TMDB id를 기본키로 두고, 평점 데이터와 국가별 시청 채널(국가 × 채널 다대다)을 분리해 저장하면 개인화 페이지에서 다루기 편하다. 단, 구체 설계는 마스터 AI 재량.

---

## 6. 빠른 참조 (Quick Reference)

| 항목 | 소스 | 엔드포인트 | 비용/제한 |
|---|---|---|---|
| 기본정보 + IMDb id + 시청채널 | TMDB | `GET /3/movie/{tmdb_id}?append_to_response=external_ids,watch/providers` | 무료, key 필요 |
| 국가별 시청 채널(단독 호출 시) | TMDB | `GET /3/movie/{tmdb_id}/watch/providers` | 무료, 응답에 전 국가 포함 |
| IMDb 평점·투표수 / Metascore / RT 토마토미터 | OMDb | `GET https://www.omdbapi.com/?i={imdb_id}&apikey=KEY` | 무료, 1,000회/일 |

필요한 API 키: **TMDB key 1개 + OMDb key 1개** (둘 다 무료 발급).

수집 흐름 요약:

```
TMDB id
  └─ TMDB /movie/{id}?append_to_response=external_ids,watch/providers
       ├─ 기본정보
       ├─ imdb_id  ──→ OMDb ?i={imdb_id}  ──→ IMDb평점/투표수, Metascore, RT토마토미터 (상단 배지)
       └─ watch/providers.results[국가코드]  ──→ 국가 선택 시 시청 채널 노출
```

---

## 7. 출처 (검증 근거)

- TMDB Watch Providers 레퍼런스: https://developer.themoviedb.org/reference/movie-watch-providers
- TMDB external_ids / append_to_response: https://developer.themoviedb.org/reference/movie-details
- OMDb API: https://www.omdbapi.com/
