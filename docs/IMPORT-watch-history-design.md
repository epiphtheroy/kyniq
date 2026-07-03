# 관람 기록 통합 임포트 — 설계 문서

날짜: 2026-07-03 · 대상: metatake.net `/me` (개인 관리자 페이지)

## 1. 목표

사용자가 어디에 어떤 형태로 기록해 왔든 — 엑셀, Letterboxd 내보내기 ZIP, IMDb CSV, 왓챠피디아 페이지 복사-붙여넣기, 자유 텍스트 — 한 입력창에 던지면 시스템이 알아서 해독·TMDB 매칭·검수·저장까지 처리한다. 핵심 원칙 세 가지:

1. **사용자 편의 우선**: 포맷을 사용자가 고르지 않는다. 파일이든 텍스트든 넣으면 자동 감지.
2. **메모/리뷰 보존**: 원본에 리뷰·코멘트·태그가 있으면 반드시 가져온다.
3. **무손실(lossless)**: 현재 `user_movies`가 담지 못하는 것(재관람 기록, 태그, 원본 필드 전체)은 새 로그 테이블에 원본 그대로(jsonb) 보관한다. 나중에 스키마가 진화해도 재처리 가능.

## 2. 현재 구조 진단

- `user_movies(user_id, film_id) PK` — rating(0.5–5, 반개 단위 CHECK), watched_at(date), note, seen/watchlist(bool), visibility. **영화당 1행** → 재관람·태그·출처 표현 불가.
- `films` — tmdb_id 기반, `/api/track`이 미보유 영화를 Tier-2(visible=false)로 lazy 생성. 이 로직을 재사용한다.
- `/api/tmdb-search` — 단건 검색 존재. 대량 매칭용 배치 엔드포인트는 없음.
- **버그 발견**: `/api/track`이 존재하지 않는 `status` 컬럼으로 upsert함(에러 미확인으로 조용히 실패 가능). 실제 스키마는 `seen`/`watchlist` boolean. 이번 작업에서 수정.

## 3. 입력 포맷 매트릭스

| 소스 | 형태 | 식별 신호 | 필드 |
|---|---|---|---|
| Letterboxd 내보내기 | ZIP (diary/ratings/watched/reviews/watchlist.csv) | zip 내 파일명 | Name, Year, Rating(0.5–5), Watched Date, Rewatch, Tags, Review |
| Letterboxd 임포트 포맷 | CSV | 헤더 Title/Year/Rating/WatchedDate/tmdbID/imdbID | 동일 + tmdbID/imdbID 직접 매칭 |
| IMDb 평가 내보내기 | CSV | 헤더 Const/Your Rating/Date Rated | tt-ID(확정 매칭), 10점 척도 → /2 |
| 왓챠 백업(북마클릿 등) | XLSX/CSV | 한국어 헤더(제목/별점/본 날짜/리뷰…) | 한/영 제목, 년도, 감독, 별점(0.5–5), 리뷰 |
| 일반 엑셀/CSV | XLSX/CSV | 헤더 동의어 사전으로 컬럼 추론 | 제목·년도·별점·관람일·메모 등 |
| 자유 텍스트 붙여넣기 | text | 위 전부 실패 시 | 규칙(왓챠 프로필 패턴) → 실패분만 LLM(Gemini Flash, JSON mode) 구조화 |

별점 정규화: 값의 최대치로 척도 추정(>10→100점제 /20, >5→10점제 /2), 0.5 단위 반올림, [0.5, 5] 클램프 → CHECK 제약과 일치.

## 4. 파이프라인 (3단계, 상태 비저장)

```
[1 PARSE]  POST /api/import/parse   파일(멀티파트)·텍스트 → 포맷 감지 → NormalizedRow[]
[2 MATCH]  POST /api/import/match   25행씩 배치: films 로컬 매치 → TMDB(/find by imdb, /search by 제목+년도)
                                    → matched | ambiguous(후보 제시) | none
[3 COMMIT] POST /api/import/commit  50행씩 배치: films lazy-resolve → user_watch_log INSERT(무손실)
                                    → user_movies 집계 upsert
```

서버에 중간 상태를 저장하지 않고 클라이언트가 단계 사이 데이터를 들고 이동(수천 행까지 문제없음, Letterboxd 1MB 제한과 동급). 검수 UI에서 사용자가 확정한 뒤에만 쓰기 발생 — 실행 취소 불가 문제를 검수 단계로 방어.

```ts
type NormalizedRow = {
  title: string; year?: number; director?: string;
  rating?: number;            // 0.5–5 정규화 후
  watched_at?: string;        // YYYY-MM-DD
  note?: string; tags?: string[]; rewatch?: boolean;
  tmdb_id?: number; imdb_id?: string;
  to_watchlist?: boolean;     // 왓치리스트 파일에서 온 행
  raw: Record<string, unknown>;  // 원본 행 — 무손실 보관용
};
```

## 5. TMDB 매칭 전략

1. `tmdb_id` 있으면 확정.
2. `imdb_id` 있으면 `/find/{tt}?external_source=imdb_id` — 사실상 확정.
3. 로컬 `films` 테이블에서 정규화 제목+년도 정확 일치 → TMDB 호출 절약(6,700편 보유).
4. `/search/movie?query&year` (한글 제목이면 `language=ko-KR®ion=KR`). 정규화 제목이 title/original_title과 일치 + 년도 ±1 → high, 단일 결과 → medium, 그 외 → ambiguous(상위 5 후보 반환).
5. ambiguous/none은 검수 화면에서 후보 선택 또는 기존 `/api/tmdb-search` 재활용 수동 검색.

## 6. DB 변경 (마이그레이션)

```sql
create table user_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source text not null,      -- letterboxd_zip | letterboxd_csv | imdb_csv | sheet | watcha_text | freeform_llm
  filename text, stats jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table user_watch_log (   -- 무손실 관람 이력: 재관람 1건 = 1행
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  film_id uuid references films(id) on delete set null,
  tmdb_id integer, title_raw text not null, year_raw integer,
  rating numeric, watched_at date, note text, tags text[], rewatch boolean,
  source text not null, import_job_id uuid references user_import_jobs(id) on delete set null,
  raw jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- RLS: 본인 행 select만 허용, 쓰기는 service role 경유
```

`user_movies`는 그대로 "현재 상태" 뷰로 유지하고 커밋 시 집계 upsert: `seen=true`, `watched_at`은 최신 관람일, `rating`은 가장 최근 기록의 별점, `note`는 비어 있으면 채우고 있으면 보존(커밋 옵션으로 "가져온 값 우선" 선택 가능). 재관람 등 세부는 전부 `user_watch_log`에 남는다.

## 7. UI — `/me/import` 위저드

1. **입력**: 큰 붙여넣기 텍스트영역 + 드래그앤드롭/파일선택(zip·csv·xlsx). 하나의 화면.
2. **검수**: 감지된 포맷 표시, 행 테이블(제목·년도·별점·관람일·메모·매칭상태). ambiguous 행은 포스터 포함 후보 선택. 행 제외 체크. 옵션: 기존 별점 덮어쓰기 여부.
3. **커밋**: 배치 진행률 → 결과 요약(추가 n, 갱신 n, 로그 n, 실패 목록).

`/me`의 MovieSearchAdd 옆에 "Bulk import" 진입 링크 추가.

## 8. 구현 파일

- `lib/import/types.ts`, `lib/import/normalize.ts` (척도·날짜·제목 정규화)
- `lib/import/detect.ts` + `parsers/` (zip=jszip, xlsx=SheetJS, csv=papaparse, 헤더 동의어 사전, 왓챠 텍스트 규칙)
- `lib/import/llm.ts` — 기존 `lib/providers/gemini.ts` 어댑터 재사용(gemini-2.5-flash, jsonMode)
- `lib/filmResolver.ts` — `/api/track`의 lazy 영화 생성 로직 추출·공유(track 버그 수정 포함)
- `app/api/import/{parse,match,commit}/route.ts`
- `app/me/import/page.tsx` + `components/ImportWizard.tsx`
- 의존성 추가: `jszip`, `xlsx`, `papaparse`

## 9. 리스크·정책

- TMDB 레이트리밋: 배치당 동시성 5, 로컬 films 선매치로 호출 최소화.
- 중복 임포트: 같은 (film, watched_at, source) 로그가 이미 있으면 스킵.
- LLM 비용: 자유 텍스트에서 규칙 실패분만 호출, 행당 수백 토큰(수천 행이어도 $0.1 미만).
- 인증: 모든 엔드포인트 SSR 세션 필수, 쓰기는 본인 user_id로만.

## 10. 참고 자료

- [Letterboxd 임포트 포맷 명세](https://letterboxd.com/about/importing-data/)
- [Letterboxd 내보내기 파일 구조 분석](https://www.feadin.eu/en/posts/letterboxd_i_love_you_but_we_need_to_talk_about_your_exports/)
- [IMDb CSV 내보내기 컬럼](https://github.com/dresa/imdb-list-analyzer)
- [왓챠 → 엑셀 백업 커뮤니티 방법(북마클릿)](https://extmovie.com/movietalk/37623288)
