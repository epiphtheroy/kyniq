# MetaTake — Movie 구조화 데이터(JSON-LD) 템플릿 & 가이드

> 목적: Film 페이지의 **Information 탭이 보여주는 내용**을 기계(구글 크롤러)도 읽을 수 있게 `schema.org/Movie` JSON-LD로 한 번 더 인코딩한다.
> 위치: 화면에 **안 보임**. 페이지 HTML 소스의 `<head>`(또는 본문 어디든)에 `<script type="application/ld+json">` 블록으로 1회 삽입.

---

## 1. 바로 쓰는 전체 템플릿 (예시: 기생충 / Parasite)

아래 블록을 그대로 복사해서 값만 자기 데이터로 바꾸면 된다. **이 JSON에는 주석을 넣지 말 것**(JSON-LD는 표준 JSON이라 `//` 주석이 들어가면 깨진다). 필드 설명은 3장에 따로 정리했다.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Movie",
  "@id": "https://metatake.com/film/parasite#movie",
  "url": "https://metatake.com/film/parasite",
  "name": "기생충",
  "alternateName": "Parasite",
  "image": "https://metatake.com/img/parasite-poster.jpg",
  "description": "전원백수로 살 길 막막하지만 사이는 좋은 기택 가족과 글로벌 IT기업 박사장 가족의 만남을 그린 블랙코미디.",
  "datePublished": "2019-05-30",
  "duration": "PT2H12M",
  "genre": ["Drama", "Thriller", "Comedy"],
  "contentRating": "KMRB:15",
  "inLanguage": "ko",
  "countryOfOrigin": {
    "@type": "Country",
    "name": "South Korea"
  },
  "director": {
    "@type": "Person",
    "name": "봉준호",
    "sameAs": "https://www.imdb.com/name/nm0094435/"
  },
  "author": [
    { "@type": "Person", "name": "봉준호" },
    { "@type": "Person", "name": "한진원" }
  ],
  "actor": [
    { "@type": "Person", "name": "송강호", "sameAs": "https://www.imdb.com/name/nm0826044/" },
    { "@type": "Person", "name": "이선균", "sameAs": "https://www.imdb.com/name/nm1715240/" },
    { "@type": "Person", "name": "조여정" },
    { "@type": "Person", "name": "최우식" },
    { "@type": "Person", "name": "박소담" },
    { "@type": "Person", "name": "이정은" },
    { "@type": "Person", "name": "장혜진" }
  ],
  "musicBy": {
    "@type": "Person",
    "name": "정재일"
  },
  "productionCompany": {
    "@type": "Organization",
    "name": "Barunson E&A"
  },
  "trailer": {
    "@type": "VideoObject",
    "name": "기생충 메인 예고편",
    "description": "기생충 공식 예고편",
    "thumbnailUrl": "https://metatake.com/img/parasite-trailer-thumb.jpg",
    "uploadDate": "2019-05-13",
    "contentUrl": "https://www.youtube.com/watch?v=5xH0HfJHsaY"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "8.5",
    "bestRating": "10",
    "ratingCount": "12345"
  },
  "sameAs": [
    "https://www.imdb.com/title/tt6751668/",
    "https://www.themoviedb.org/movie/496243",
    "https://en.wikipedia.org/wiki/Parasite_(2019_film)",
    "https://www.wikidata.org/wiki/Q61448040"
  ]
}
</script>
```

---

## 2. 최소 버전 (꼭 이것만이라도)

전부 채우기 부담되면 아래 핵심 필드만 있어도 구글이 엔티티를 인식한다.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Movie",
  "name": "기생충",
  "alternateName": "Parasite",
  "url": "https://metatake.com/film/parasite",
  "image": "https://metatake.com/img/parasite-poster.jpg",
  "datePublished": "2019-05-30",
  "director": { "@type": "Person", "name": "봉준호" },
  "sameAs": ["https://www.imdb.com/title/tt6751668/"]
}
</script>
```

---

## 3. 필드별 설명 + TMDB 매핑

| JSON-LD 필드 | 의미 | TMDB API 소스 | 비고 |
|---|---|---|---|
| `name` | 표시 제목 | `title` | 한국 사이트면 한국어 제목 권장 |
| `alternateName` | 다른 제목(영문/원제) | `original_title` | 영문 검색 노출에 도움 |
| `url` | 이 영화 페이지 URL | (직접) | canonical과 일치시킬 것 |
| `@id` | 엔티티 고유 식별자 | (직접) | `URL#movie` 형태 권장. 여러 스키마 연결 시 유용 |
| `image` | 포스터 이미지 URL | `poster_path` | TMDB 이미지 베이스 URL 붙여 절대경로로 |
| `description` | 줄거리 요약 | `overview` | **페이지에 실제로 보이는 줄거리와 일치** |
| `datePublished` | 개봉일 | `release_date` | `YYYY-MM-DD` 형식 |
| `duration` | 상영시간 | `runtime`(분) | **ISO 8601**로 변환: 132분 → `PT2H12M` |
| `genre` | 장르 | `genres[].name` | 배열 가능 |
| `contentRating` | 관람등급 | `release_dates` | "KMRB:15", "MPAA:R" 식 |
| `inLanguage` | 언어 | `original_language` | BCP-47 코드(`ko`, `en`) |
| `countryOfOrigin` | 제작 국가 | `production_countries` | `Country` 객체 |
| `director` | 감독 | `credits.crew` (job=Director) | `Person` 객체 |
| `author` | 각본/극본 | `credits.crew` (department=Writing) | Movie엔 별도 `writer` 속성이 없어 `author`/`creator` 사용 |
| `actor` | 출연진 | `credits.cast` | **주연 위주로 제한**(아래 주의 참고) |
| `musicBy` | 음악 | `credits.crew` (job=Original Music Composer) | |
| `productionCompany` | 제작사 | `production_companies` | `Organization` 객체 |
| `trailer` | 예고편 | `videos` (YouTube) | `VideoObject`, `uploadDate` 권장 |
| `aggregateRating` | 평점 | `vote_average` / `vote_count` | **조건부 사용**(아래 주의 참고) |
| `sameAs` | 동일 엔티티 외부 링크 | `imdb_id`, `external_ids` | **엔티티 식별에 매우 유용** |

### runtime → ISO 8601 변환
```
분 → "PT{시}H{분}M"
132분 = 2시간 12분 → "PT2H12M"
95분  = 1시간 35분 → "PT1H35M"
```

### sameAs가 의외로 중요한 이유
구글이 "이 페이지의 영화 = IMDb tt6751668 = Wikidata Q61448040"임을 확신하게 해준다. 즉 도배가 아니라 **링크로** 엔티티를 명확히 묶는 게 SEO에 실효성이 있다. TMDB `external_ids`에서 imdb·wikidata id를 뽑아 URL로 만들면 된다. 인물(`actor`, `director`)에도 각자 `sameAs`(IMDb/Wikidata)를 달면 더 강하다.

---

## 4. 꼭 지킬 주의사항 (안 지키면 역효과)

1. **보이는 내용과 일치시킬 것.** JSON-LD에 적은 정보는 페이지에 실제로 표시되는 정보여야 한다. 화면엔 없는데 구조화 데이터에만 잔뜩 넣으면 구글의 spammy structured data 정책 위반이 된다.

2. **`actor`는 주연 위주로.** 출연진 수백 명을 다 넣지 말 것. 앞 대화의 결론과 같은 맥락 — 양이 많을수록 좋은 게 아니다. 화면 Information 탭에 보여주는 주요 캐스트(대략 5~15명) 정도만.

3. **`aggregateRating`은 조건부.** 페이지에 평점을 **실제로 표시할 때만** 넣는다. TMDB vote만 몰래 박으면 안 된다. 또한 자기 사이트 자체 평점이 아니라 TMDB 평점을 쓰는 거라면 출처가 분명해야 하고, 가장 깔끔한 건 MetaTake 자체 평점/리뷰가 있을 때 그것을 마크업하는 것이다. 애매하면 이 필드는 빼도 된다(스키마 검증엔 문제없음).

4. **현 시점 구글의 Movie 리치 결과 현실.** 단일 영화 페이지는 별도의 화려한 리치 스니펫이 잘 안 붙는다(구글의 Movie 전용 리치 결과는 캐러셀/ItemList 형식 중심). **그래도** 구조화 데이터는 엔티티 이해·지식그래프 연결·노출 맥락에 기여하므로 넣는 게 정석이다. "리치 스니펫 당장 뜬다"보다 "구글이 정확히 이해한다"가 핵심 효과.

5. **검증은 필수.** 배포 전 두 곳에서 점검:
   - Google Rich Results Test: https://search.google.com/test/rich-results
   - Schema Markup Validator: https://validator.schema.org/

---

## 5. 적용 위치 메모

- 정적 HTML이면 `<head>` 안에 `<script type="application/ld+json">` 직접 삽입.
- Next.js 등 프레임워크면 페이지 컴포넌트에서 `dangerouslySetInnerHTML`로 같은 script 태그를 렌더하거나, App Router의 메타데이터/스크립트 슬롯을 사용. 어느 쪽이든 **최종 HTML 소스에 위 JSON 블록이 그대로 찍히면** 된다.
- 영화 1편당 1개 블록. 목록/캐러셀을 만들고 싶으면 별도로 `ItemList`로 감싼다(이번 템플릿 범위 밖).
