# Metatake — Rollout + Site Cleanup (Master Plan v2: Trope 2.0 + Strong Misreadings)
_2026-06-22 · Concepts are canon in `CONCEPT-tropes-and-strong-misreadings.md`. This is the execution plan._

> **Model in one line.** Films break into **figures**; each figure carries **Strong Misreadings** (bold readings, 14 frameworks). Patterns that recur become **tropes** — *coded* devices/readings on a **maturity arc** (Noble → Fresh → Emerging → Established → Cliché), connected by **similar-trope** links. **No "meta-take" layer.** A trope is a *code* (strikingness), never a bare attribute.

---
## 0. 현재 상태 (실측)
- figures 14,194 (앵커). takes ~46,503 (**옛 서술형**, retired 리딩에 매달림 → bold take로 교체, 옛 take는 trope-묘사로 보존).
- meta_takes: `figure_type`(트로프) 1,421 · `reading` 935 **retired**(트로프로 접힘) + 4,883 candidate. figure_type_members 45,297.
- **렌즈 충돌**: 옛 10 register(편중: formal 7.8k…reception 0.9k) vs 새 14 framework. → register 폐기.
- **트로프 거대화**: 70+ figure 194개(최대 749). *정체 = 넓은 해석(옛 메타테이크)이지 코드 트로프가 아님.* → 비평가 게이트로 재형성 대상(§2c).
- UX 임시잔재: `/meta-takes`→`/tropes` 리다이렉트, 홈 도어/푸터 중복, `/concept` dormant, ScholarHeader·색맵 register 기반(파일 ~25/~9).

---
## 1. 목표 아키텍처 (v2)
- **Figure**(앵커) — 유지 + bold-take 패스에서 title/film figure 자동 생성.
- **Strong Misreading** = bold 해석(14 framework). 원자 단위 = *Misreading*(블룸 오마주, "도발이지 판결 아님"). figure별로 달림. 필드: framework·title·thesis·leap·strength·theorist·concept·real_person. (옛 take 보관+301)
- **Invitation** — 영화당 1, 스포일러-프리 소개 = 영화 소개 페이지 + 맨 위.
- **Trope (통합·코드)** = 반복되는 *약호화된* 패턴(현저성). **비평가 게이트로 생성**(임베딩은 후보 생성만; 맨 속성은 폐기). 속성:
  - **kind**: `convention`(장치/형상) · `misreading`(Strong Misreading 군집) — 표기 구분.
  - **maturity**: Noble(n=1) · Fresh(n=2–3·응집↑) · Emerging(4–8) · Established(9–25) · Cliché(>25/관습명). count+cohesion.
  - **이름**: 극적·궁금증·≤8단어, 코드를 말함("The Gentle Giant" O, "Tall Characters" X).
  - **similar tropes**: 여럿, *코드(이름·개념) 임베딩* 기준. ← 메타테이크 롤업을 대신함.
  - 멤버: figure/영화 인스턴스(+misreading 계열은 그 미스리딩). 최소 2(단독=Noble).
- **NO meta-take layer.** 미스리딩 군집이 곧 (misreading) 트로프.
- **Theory 층**: theorist/concept → theory_canon/families 정규화 → `/concept`·ScholarHeader(framework 기준) 부활.
- **Alias 층**: figure short_label(≤7단어) + category_tags(*문자적* 검색 종류, 트로프와 별개).

---
## 2. 사이트 구조 정리 (최우선)
### 2a. 렌즈 = 14 framework (Strong Misreading 분류) — register 폐기
- 5 패밀리: 내부해석(PHENOMENON→NOUMENON·NOUMENON·SIGNIFIER→SIGNIFIED·ENIGMA) · 형식·제작·맥락(PROCESS·LOCATION·CONTEXT·METACRITIC) · 정신·윤리·정치(PSYCHOANALYTIC·ETHICAL-PHILOSOPHICAL·ETHICO-POLITICAL) · 실존병치(PERSONA-PARALLEL·JUXTAPOSITION) · 제목·초대(TITLE·INVITATION).
- 공용 `lib/frameworks.ts` 하나로 정의(색·라벨·패밀리). ScholarHeader·facet·칩·RAG 전부 거기 참조(중복 색맵 ~9파일 제거).

### 2b. 네비게이션·IA
- **nav**: metatake · Films · Directors · **Tropes** · **Strong Misreadings** · Concepts · Latest · Trending · Chat · Blog. (*Meta-takes 항목 영구 삭제*; `/meta-takes`→`/tropes` 301.)
- **영화 페이지**: ① Invitation → ② Figures → ③ Strong Misreadings(framework 패밀리별 접기) → ④ Tropes(이 영화 figure들이 속한 코드들).
- **Trope 허브**: kind 배지 + maturity 배지 + 멤버(영화·figure, 구 take 묘사) + **유사 트로프(여럿)**.
- **Strong Misreadings 섹션**: 선언문 + framework 브라우즈 + **Noble 피드**.
- **Figure 페이지**: short_label 헤더, category_tags 칩(→/kind), 그 figure의 Strong Misreadings + 속한 트로프.
- 홈 도어/푸터 중복 정리.

### 2c. 트로프 형성 = 비평가 게이트(코드), *분할 아님*
- (a) 후보 생성(저렴): misreading 임베딩 근접 = 해석-트로프 후보 / figure 임베딩 근접 = 장치-트로프 후보.
- (b) **비평가(LLM) 게이트+명명**: 후보마다 *코드인가 맨 속성인가* 판정 → 코드면 ≤8단어 환기적 이름 + 대표 멤버만; 맨 속성·잡탕·거대우산은 폐기/코드 단위로 분해. (거대 "The Returning Image"→"The Returning Score" 등; 짝 없으면 Noble.)
- (c) maturity(count+cohesion) · (d) kind · (e) 유사 트로프(코드 임베딩).
- *이 단계가 옛 트로프 재형성 + 옛 "메타테이크 추출"을 모두 대체.*

### 2d. 분포 검증
- framework 분포, 트로프 maturity 분포(Noble/Fresh/…/Cliché), 인물(real_person) 과집중 점검(배치는 중복 회피 못 함).

---
## 3. 포스트-배치 순서 (mistake-proof)
> 각 단계 행동→검증→가역성. 파괴 전 스냅샷.
1. **JSONL 검증** — 1,934행? slug 중복0? invitation 존재? framework 분포·인물 과집중. 누락은 동기 러너 폴백.
2. **스냅샷 백업**(`_bak_*`).
3. **스키마** — takes에 framework·leap·strength·theorist·concept·real_person·is_invitation; figures에 short_label·category_tags·kind('title'|'film'); meta_takes(trope)에 trope_kind·maturity; invitation 저장(film_dossiers + lead).
4. **적재** — title/film figure 생성 → Strong Misreadings 삽입 → invitation 저장 → 옛 take 보관(retired)+301.
5. **figure-alias**(Sonnet) — short_label + category_tags.
6. **임베딩** — Strong Misreadings(+신규 figure).
7. **통합 트로프 형성(비평가 게이트)** — §2c: 후보→게이트→코드 명명→maturity→kind→유사링크. (옛 트로프 재형성 + 미스리딩 군집 동시; 거대우산 분해; 맨 속성 폐기.)
8. **Theory 층** — theorist/concept → canon/families → `/concept`·ScholarHeader(framework).
9. **랭크/추천/affinity** — 새 층 기준.
10. **앱 대개편** — `lib/frameworks.ts`(register→framework); 트로프 인터페이스 통합(kind+maturity+유사); Strong Misreadings 섹션+선언문+Noble 피드; Invitation 소개; nav 확정; /kind 브라우즈.
11. **SEO** — 옛 take URL 301, sitemap(트로프·Strong Misreadings·concept), JSON-LD, intro.
12. **배포 + 정합성 검증** — 깨진 링크0·고아0·라이브 스팟체크.

---
## 4. 결정
**확정**: maturity 밴드(n=1/2–3/4–8/9–25/>25, cohesion 보정) · Noble 노출(배지+피드, 별도페이지 X) · framework=유일 분류(14/5패밀리) · 옛 take 보관+301 · invitation=dossier+lead · bold-take 저장=기존 takes 재사용 · **메타테이크 층 없음**(미스리딩 군집=트로프) · **트로프=비평가 게이트 코드**(현저성, 맨 속성 배제).
**잔여(논의 중)**: ① 통합 트로프 1테이블(kind 태그) vs 2트랙(권장: 1테이블) ② nav의 "Strong Misreadings" 명칭/위치 ③ 유사-트로프를 *코드 임베딩*으로 할지(권장) vs 멤버 중첩 ④ 후보 생성 임계(파일럿 DRY에서 튜닝).

**나중에 별도 대화 (보류)**: (a) **홈/정체성** — 히어로 유지 vs *텍스트-우선 세련된 위키 스타일*(초기 모델처럼). 결정 후 홈·가치제안 재설계. (b) framework **위상 강등**(주분류→facet) UX. (c) **유사 트로프** 노출 UX. _이 셋은 콘텐츠(트로프/미스리딩) 형성 이후로 미룸._

---
## 5. 안전장치
- 가역성: 삭제 금지·status 보관·스냅샷·단일 컷오버·모든 URL 301.
- 배치 폴백: 동기 러너가 결과파일 누락분만 채움.
- 단계 DRY/검증 게이트(특히 4·7·10).
- 배치 한계: 인물 중복 회피 불가 → §2d에서 과집중만 사후 다양화.

---
## 6. 체크리스트
- [x] 1 검증 · [x] 2 백업(`_bak_boldtake_*`) · [x] 3 스키마 · [x] 4 적재(NEW 26,975 published · OLD 46,503 retired · figures +3,974) · [ ] 5 alias · [ ] 6 임베딩 · [ ] 7 **비평가-게이트 트로프 형성** · [ ] 8 theory/concept · [ ] 9 랭크/추천 · [ ] 10 앱(frameworks·트로프 인터페이스·Strong Misreadings·invitation·nav) · [ ] 11 SEO · [ ] 12 배포·검증
