# HANDOFF — to.W 큐레이션 코멘트층 (정본)

**한 줄:** 카탈로그의 모든 영화에 "왜 이 영화가 인덱스에 있는가"를 설명하는 편지체 코멘트(수신 W.H. / 발신 W. Yoon)를 붙인 층. `curation` 스키마의 6차원 등급을 **규칙 기반(LLM 0)**으로 영어 문장으로 조립. 영화별(`/takescore/film`)·감독별(`/director`) 두 표면 라이브.

- **상태:** SHIPPED (2026-07-11). DB·RPC·프론트·라이브 검증 완료.
- **DB쪽 정본:** `curation.rule` 테이블(모든 규칙이 `comment.*`, `lineage.fix-*` 키로 문서화됨). 이 문서와 항상 동기.
- **상위 큐레이션 브레인:** `docs/PLAN-curation-integration.md`(authority×demand 사분면, hub, should_index). to.W는 그 코멘트 확장.
- **관련 auto-memory:** `to-w-curation-comment-layer.md`(상세), `takescore-film-pages-live`, `takescore-screener-plan`, `director-article-layer`.

---

## 1. 데이터 모델 (`curation` 스키마)

| 객체 | 내용 |
|---|---|
| `comment_dim` (21행) | 차원 사전. `dim`(authority/recognition/entry_path/verdict) × `grade` → `label`/`blurb`(한국어) + **`label_en`/`blurb_en`(영어, 2026-07-11 추가)**. 워딩 재사용의 원천. |
| `film_comment` (11,630행) | 영화별 6차원 등급 + 조립된 **영어** `rationale`. 키=`tmdb_id`. |
| `v_film_comment` (뷰) | 조회용. tmdb_id→제목·등급 라벨(KO+EN)·rationale. `*_label_en` 4컬럼 포함. |
| `film` | 큐레이션 마스터. `director`(백필됨), `manual_override`, `curator_note`, `national`, `country_code` 등. |
| `auteur_director` (337명) | 오퇴르 승격 자격 감독. `reason` ∈ {canon_portfolio, auteur_list, portfolio}. |
| `film_hub`/`hub` | 국가·지역 허브(Atlas 연동). |

**6차원:** authority(A~D) · recognition(1~4) · entry_path · national · movement · verdict.

**백업(롤백용):**
- `curation._bak_film_comment_20260711` — 대수술 직전 전체 스냅샷(한국어 rationale·구 등급 보존).
- `curation._bak_film_lineage_20260711` — lineage 오매칭 수정 8행 백업.

---

## 2. verdict 규칙 v2 (2026-07-11 대수술 — 1,885행/16.2% 변경)

verdict는 (authority × recognition)의 결정함수. **authority 정의가 핵심 수정점:**

- **A (→ essential, 993편)** = **canon 리스트만**: `tspdt-1000` · `sight-and-sound-critics` · `sight-and-sound-directors`.
  - ⚠️ **award 리스트는 A 자격 없음**(구버그: 오스카 BP·팔므도르·황금사자·황금곰이 A로 취급돼 Green Book·Crash가 "시네필 필수"였음).
- **B (→ r1·2 start_here 182 / r3·4 deep_cut 955)** = canon T2/T3 리스트 + 빅3 그랑프리(팔므도르·황금사자·황금곰) + auteur facet 리스트 + 오퇴르 승격.
  - ⚠️ **`nbr-top-ten`·`national-film-registry` 제외**(이 둘이 B로 새면 Home Alone·Jerry Maguire가 start_here 됨).
- **C (→ r1·2 popular_not_cinephile / r3·4 optional)** = 그 외 멤버십(오스카 BP·NBR·NFR·national-* 등).
- **D (→ 동일)** = 무소속.
- **오퇴르 승격:** `auteur_director`의 `canon_portfolio`·`auteur_list` 사유만, **C/D × recognition 3·4에만** 적용(딥컷 구제 전용). 유명작(r1·2)엔 미적용(Step Brothers·Hook이 start_here 되는 것 방지). 감독명은 `public.films`에서 백필(4,578건), `public.unaccent` 매칭.
- verdict 분포: optional 8,180 / popular_not_cinephile 1,320 / essential 993 / deep_cut 955 / start_here 182.

**manual_override:** `curation.film.manual_override=true`이면 재계산이 verdict를 덮지 않아야 함(현재 규칙상 재계산 UPDATE는 이 가드를 넣어 실행할 것). 현 오버라이드 1건:
- **Fahrenheit 9/11 (2004)** → `popular_not_cinephile` 잠금. 근거: 팔므도르+Guardian로 authority B라 규칙상 start_here가 나오지만, 당파적 폴레믹 다큐를 시네필 입문작으로 두지 않기로 함.

---

## 3. rationale 문구 규칙 (영어 단일본)

기본 구조: `{authority} , and {recognition}. It entered our catalog {entry}[· national canon: XX][· movement: …][· revalued through director …'s auteur lineage]. {verdict}`

**2종의 정직성 규칙(2026-07-11):**

1. **저점 정전작 canon 명명 회피** (`comment.lowscore`): authority A/B인데 **TakeScore(`cinecodex.scores.v_value − r_risk`) < 20**이면 headline에서 "canon" 금지.
   - recognition 1·2(유명): `"A much-seen and much-talked-about film"`
   - recognition 3·4(무명): `"A much-talked-about film"`
   - 유명 저점작이 `entry_path='canon'`이면 진입 문구도 `"as canon reinforcement"` → `"for how widely it has been seen and discussed"`. (무명 저점작은 진입 사유가 실제로 정전이라 유지.)
   - 예: Titanic·Avatar·Forrest Gump는 "much-seen and much-talked-about"; Parasite·Seven Samurai(고TS)는 "canon-core" 유지.

2. **optional 겸손 문구** (`comment.optional`): verdict=optional도 **숨기지 않고 코멘트함**(구: 표면 숨김). 전용 겸손체 —
   `"Optional viewing (not a critics'-canon title, not a festival standout, not <rec4:widely seen | rec3:a household name>)."`
   구조화 문장 미사용.

**편지 형식(표면에서만, DB엔 미포함):** `To W.H. — {rationale} — W. Yoon`. 수신 W.H.=시네필 입문자(comment.verdict 규칙의 판정 대상), 발신 W. Yoon=제원우(에디터 필명). 영화·감독 to.W 양쪽 통일.

---

## 4. 표면 & RPC

`curation` 스키마는 PostgREST 비노출 → 모두 **security-definer public RPC** 경유 + 함수레벨 statement_timeout.

| 표면 | RPC | 위치 |
|---|---|---|
| 영화 to.W | `tow_comment(p_slug)` (4s) — verdict·라벨·rationale 반환. **optional 포함**(2026-07-11 제외 제거). | `app/takescore/film/[slug]/page.tsx` Verdict 섹션 아래 `.tsf-tow` 박스; CSS `takescore-film.css` |
| 감독 집계 to.W | `director_curation(p_slug)` (5s) — in_index·verdict별 카운트·is_auteur·대표작 3편. non-optional 0이면 null. | `app/director/[slug]/page.tsx` stat 스트립 아래 `.dr-tow` 카드; CSS `app/globals.css`; 프로즈 조립 `curationStanding()` |

- 프론트 캐시: 둘 다 `unstable_cache` 별도 키(`tow-comment1`/`director-curation1`), `revalidate:3600`, 태그 `takescore-film:{slug}`/`director:{slug}`.
- 감독 카드 프로즈는 `curationStanding()`가 조립(하우스 패턴 `editorialSummary()`와 동일, LLM 0), verdict별 칩 + 대표작 링크.

---

## 5. 불변식 · 함정

- **manual_override 존중**: 향후 verdict 재계산 UPDATE는 `where cf.manual_override is not true` 가드 필수(현재 Fahrenheit 9/11이 유일 케이스).
- **loadTow/loadCuration 캐시 1시간**: `revalidate:3600`이라 **이미 방문된 페이지는 DB 변경이 최대 1시간 지연** 반영(미방문·신규 방문은 즉시). 급하면 TTL 낮추거나 태그 무효화.
- **미채점 optional은 /takescore/film에 안 뜸**: 이 페이지는 `cinecodex_card`(TakeScore) 필수 → 점수 없는 Tier-2 optional은 404. optional 코멘트는 "채점된 optional"에만 노출.
- **rationale은 JSON-LD에 미포함**(템플릿 반복 텍스트 → reviewBody 오염 금지).
- **unaccent 매칭**: 감독명 대조는 `public.unaccent`(스키마는 `public`, `extensions` 아님).
- **CSS 레이스 무관**: 3파일 모두 `app/` 아래(globals.css·2 page·1 기존 css) → 워처가 한 묶음 커밋. 신규 css 파일 아님.
- **lineage 제목 퍼지매칭 오염**: film_lineage에 제목 오매칭 상존(Naruto OVA→S&S 등 8행 수정함, 백업 `_bak_film_lineage_20260711`). 잔여: 가짜 중복 film 행 `tmdb_id=1262519`(Sorrow and the Pity 1969) 정리 검토.

---

## 6. 미완 / 후속 (중복·누락 방지 체크리스트)

- [ ] **원우 편집 판단 대기** 2건: (a) 정전이지만 TakeScore 낮은 essential(Titanic·Avatar 등)의 verdict 유지 여부 — 현재 문구만 순화, verdict는 essential 유지. (b) Fahrenheit 9/11 오버라이드 적정성 재확인.
- [ ] **Screener verdict 프리셋**: `/takescore` The Screener(`HANDOFF-테이크스코어-스크리너.md`)에 verdict 5종을 프리셋 축으로("Start here"·"Essentials"·"Deep cuts"·"Hype check"). 최대 레버리지 후속.
- [ ] **/room · My Films 커버리지**: "ess 993편 중 N편 봤다" 커버리지 코멘트.
- [ ] **verdict 축 색인 표면**: /curious/start-here 등 CollectionPage(TV 플레이리스트 축 미러링 패턴).
- [ ] **미채점 optional 노출 경로**: 필요 시 `/film/[slug]` 본페이지에도 to.W 얹기(TakeScore 불필요).
- [ ] **lineage 잔여 정리**: tmdb 1262519 가짜 중복 film 행.
- [ ] **감독 카드 optional 반영 검토**: 현재 in_index=non-optional. optional-only 감독은 카드 없음(의도).

---

## 7. 진입점 (이 층 세션 시작 시)

1. 이 문서 → `curation.rule` 테이블(SQL 정본) → auto-memory `to-w-curation-comment-layer`.
2. 상위 브레인은 `docs/PLAN-curation-integration.md`.
3. 프론트: `app/takescore/film/[slug]/page.tsx`(loadTow·`.tsf-tow`), `app/director/[slug]/page.tsx`(loadCuration·curationStanding·`.dr-tow`).
4. methodology 공개 설명: `app/methodology/page.tsx` §`#index`.
