# 인수인계 문서 — Metatake 영화 비평 파이프라인

작성 2026-06-24 · 작업 폴더: `/Users/jerryje/Documents/MetaTake/magazine research agent/`
대상: 이 작업을 이어받거나, 다른 AI에게 학습시킬 사람. 모든 경로는 위 폴더 기준 절대경로다.

이 문서는 두 가지를 인계한다. **(A) 영화 비평 매체 사전등록 DB(allowlist + 연락처)**, **(B) 영화 한 편을 넣으면 "주요 매체 코멘트" 박스를 만드는 파이프라인**. B는 A를 라우팅 테이블로 쓴다. "무엇을·왜·어떻게"를 순서대로 적었고, 마지막에 다른 AI에게 줄 요약 프롬프트를 넣었다.

---

## 0. 한 장 요약 (왜 이 구조인가)

핵심 제약은 **저작권**이다. 기사 본문을 긁어 저장하면 robots/TDM 옵트아웃·DB권·복제권 문제가 생긴다. 그래서 전 과정이 **"발행사가 스스로 공개한 필드"만** 만진다.

- **제목**(헤드라인·논문 제목) = 사실·서지정보 → 그대로 사용 OK.
- **dek / og:description**(링크 미리보기 요약) = 발행사가 재배포용으로 심어둔 필드 → 그대로 보여주는 게 의도된 용도.
- **논문 초록** = Crossref/OpenAlex가 재배포하는 메타데이터.
- 위 텍스트에서 **≤10단어 연속 축어** 한 토막만 평가(verdict)로 인용(출처표시+링크) → 인용 범위.
- **본문은 절대 수집·저장하지 않는다. robots 존중. 매체당 인용 1개(원문 재구성 방지).**

이 원칙이 코드(`comment_extractor.py`)와 데이터(모든 CSV의 `evidence_urls`/`source_url`/`dek_lead`)에 박혀 있다. (변호사 자문 아님. 다국적 매체 상용화 전 IP 변호사 검토 권장.)

---

## 1. 파일 인벤토리

| 파일 | 역할 | 종류 |
|---|---|---|
| `매거진-리서치-에이전트-브리프.md` | 발주 원본 요구사항(목표·스키마·가드레일) | 문서(입력) |
| `매거진-리서치-에이전트-설계.md` | 설계·운영절차(SOP)·전수 결과 요약·검증상태 | 문서 |
| `magazine-research-agent.skill` | 설치형 스킬(가드레일·스키마·루브릭·SOP·자기검증). 설정 > Capabilities에서 설치 | 스킬 패키지 |
| `magazine-allowlist-template.csv` / `magazine-contacts-template.csv` | 두 테이블의 **헤더 = 스키마 정의** | 템플릿 |
| `magazine-allowlist.csv` | **매체 150곳** 메타데이터(robots·sitemap·render·ingest 등) — B의 라우팅 테이블 | 데이터(산출) |
| `magazine-contacts.csv` | **공개 연락처 288건**(제휴 아웃리치용) | 데이터(산출) |
| `barbara_comments.csv` | Barbara 코멘트 **입력 원천 39행**(매체/논문별 제목·필자·연도·URL) | 데이터(입력) |
| `barbara_comments.md` | 사람이 읽는 그룹별 목록(링크 포함) | 문서 |
| `comment_extractor.py` | **실행파일①** — 입력 CSV → dek/초록에서 ≤10단어 verdict 추출 → enriched CSV | 코드 |
| `render_box.py` | **실행파일②** — enriched CSV → 박스 HTML(코멘트-우선, 언어제외 옵션) | 코드 |
| `barbara_comments_enriched.csv` | comment_extractor 산출. `title`+`comment`+`verdict_le10` 등 13열 | 데이터(산출) |
| `barbara_box.html` | render_box 산출. 최종 박스(한국어 제외 36행) | 산출 HTML |
| `인수인계-HANDOVER.md` | 이 문서 | 문서 |

데이터 흐름:
`(영화별 리뷰·논문 발굴)` → `barbara_comments.csv` → **comment_extractor.py** → `barbara_comments_enriched.csv` → **render_box.py** → `barbara_box.html`

---

## 2. 파트 A — 매거진 리서치 에이전트 (allowlist + 연락처)

### 무엇 / 왜
Metatake ASK(Grounded RAG)가 **어떤 비평지를** 신뢰 인용 소스로 쓸지, 각 매체를 **어떻게 수집해도 되는지**(robots/약관), 그리고 **제휴 협의는 누구에게** 할지를 사전 판단하기 위한 DB. 즉 B 파이프라인의 "신호등 + 주소록".

### 산출물
- `magazine-allowlist.csv` — 매체 150곳. 비영어 82곳(스·독·이·프·일·한·러 등), tier1 33/tier2 79/tier3 38.
- `magazine-contacts.csv` — 연락처 288건(전 행 `source_url`, 역할주소 우선).

### 스키마(중요 열) — 정의는 `magazine-allowlist-template.csv`
필수★: `id, name, homepage_url, sitemap_url, render_mode, robots_url, robots_ai_stance, trust_tier, ingest_recommendation, evidence_urls`.
판단 열 4개가 B의 라우팅에 직결:
- `robots_ai_stance` ∈ {allows, partial, disallows, unknown} — robots.txt를 **실제로 열어** AI/TDM 봇 차단·Content-Signal(`ai-train=no`)을 확인한 값.
- `ingest_recommendation` ∈ {API, RSS-incremental, permission-needed, avoid} — 수집 방식 권고.
- `rss_url`, `api_available` — B에서 코멘트 dek/스니펫을 어디서 가져올지.

### 방법 (왜 이렇게)
1. 후보를 지역·언어별 배치로 나눠 **병렬 서브에이전트**가 조사(대량 fetch를 서브에이전트로 격리 → 본 맥락 보호).
2. 각 매체의 **robots.txt를 직접 열어** AI 옵트아웃·crawl-delay·sitemap을 실측. 단순 fetch가 빈응답/차단하면 **Claude in Chrome**으로 브라우저 렌더링해 재검증(2차 경로). curl/캐시/미러 우회 금지.
3. 취합 시 도메인 중복 제거 → id·contact_id 재할당 → **스크립트 기계검증**(열 개수·필수필드·통제어휘·FK·source_url).
결과: robots 실측 확정 138/150. 미확인 12곳(인증서 오류·렌더러 멈춤·안전제한 등)은 `unknown`+사유로 정직 표기 — 자세한 사유는 `매거진-리서치-에이전트-설계.md` §7.

### 재실행/확장
같은 규칙으로 배치를 늘린다(목표 tier1 ≥ 20, 비영어 ≥ 15는 이미 충족). 절차는 `magazine-research-agent.skill` 내부 `SKILL.md` + `reference/{schema-and-vocab, rubrics, workflow-sop}.md`에 인코딩돼 있다(스킬 설치 후 재사용).

---

## 3. 파트 B — 영화별 "주요 매체 코멘트" 박스 파이프라인

### 무엇 / 왜
영화 한 편에 대해 **권위 매체·논문의 핵심 코멘트**를 모아, 짧은 평가 + 정확한 출처 링크로 박스에 싣는다. §0의 저작권 원칙 때문에 본문 대신 **제목·dek·초록**만 쓴다.

### 코멘트 사다리 (코드의 핵심 로직 = `comment_extractor.py`)
1. **제목**(`title`) — 항상 보존. verdict가 없으면 comment는 제목으로 폴백.
2. **dek/og:description**(비평) 또는 **초록**(학술)에서
3. **평가 단서가 든 ≤10단어 연속 축어**를 뽑아 `verdict_le10`로. 반드시 원문 부분문자열인지 검증(`verbatim_verified`). 패러프레이즈·생성 금지. 매체당 1개.

### 데이터 소스
- 비평: 각 리뷰 페이지의 `og:description`/`twitter:description`/`meta description`/JSON-LD(`reviewBody`/`description`). (allowlist의 `rss_url`도 동일 성격의 공개 채널.)
- 학술: **OpenAlex**(`abstract_inverted_index` 복원) → 실패 시 **Crossref**(`abstract`, JATS 태그 제거). 둘 다 재배포 메타데이터.

### 입력 만들기 — `barbara_comments.csv` (영화별 원천)
열: `id,type,outlet,critic,year,language,comment_or_title,url,note`
- `type` = `criticism` | `academic`
- `comment_or_title` = 기사·논문 **원제목**(그대로)
- `url` = 정식 링크(학술은 `https://doi.org/...` 권장 → 초록 자동 취득)
이 파일은 **"이 영화를 어떤 매체·논문이 다뤘는가"를 발굴한 결과**다. 발굴은 (a) allowlist 매체별 사이트검색(`영화명 site:도메인`) + RSS, (b) 학술은 OpenAlex/Crossref/WebSearch로 한다. 검증된 항목만(날조 금지, 실제 링크·제목만).

### 실행파일① `comment_extractor.py`
```
python comment_extractor.py barbara_comments.csv barbara_comments_enriched.csv "Barbara"
```
- 입력: 위 원천 CSV. 셋째 인자: 영화 제목(verdict에서 제목 군더더기 제거용).
- 동작: 각 행에 대해 robots 확인 후 단일 페이지 fetch(비평) 또는 DOI로 초록 취득(학술) → `verdict_span()`이 ≤10단어 축어 추출 → 없으면 제목 폴백.
- 출력 스키마(= enriched): `id,type,outlet,critic,year,language,tier,title,comment,verdict_le10,verbatim_verified,dek_lead,url`
  - `tier` = `verdict`(축어 확보) | `title`(폴백). `comment` = verdict 있으면 그 값, 없으면 title.
- 가드레일이 코드에 내장: robots 존중(`fetch()`), 본문 미저장, 축어 검증(`pick in text`), 매체당 1개, rate-limit 1초.
- 주의: 이 스크립트는 **네트워크가 필요**하다(샌드박스 외부망 없을 때는 dek/초록을 브라우저로 수확해 수동 병합 — 이번 Barbara가 그 경우였다).

### 실행파일② `render_box.py`
```
python render_box.py barbara_comments_enriched.csv barbara_box.html \
       --title "Barbara — Christian Petzold, 2012" --exclude-lang ko
```
- enriched CSV → **독립 실행형 HTML 박스**(브라우저로 바로 열림).
- 표시 규칙: **코멘트가 상단(핵심), 원제목은 그 아래.** verdict는 앞에 파란 인용부호. 그룹 Reviews/Academic, 그룹 내 verdict 먼저. 상단 필터(All/Comment/Reviews/Papers). 전 항목 출처+링크.
- `--exclude-lang ko` = 박스에서 한국어 행 제외(데이터는 보존). UI는 전부 영어.

### Barbara 산출
- `barbara_comments_enriched.csv` — 39행. verdict 19(비평 12 + 학술 7), 평가성 제목 8, 제목 폴백 12. `verbatim_verified=true` 19건 전부 원문 축어 정합.
- `barbara_box.html` — 한국어 3행(KCI 논문) 제외 **36행**(Reviews 28 + Academic 8).

---

## 4. 의사결정·엣지케이스 로그 (왜 그렇게 처리했나)

- **한국어 제외**: 최종 박스 요구가 "한국어 미포함"이라 KCI 논문 3편(윤종욱·이노은·이주봉)을 박스에서 제외(`--exclude-lang ko`). **데이터(enriched CSV)에는 보존** → 영문 제목으로 다시 넣으면 39행 복원 가능. (Yun 행은 독일저널이나 초록이 한국어라 `language=ko`로 보정.)
- **제목 폴백 12건**: 해당 페이지에 og:description·초록이 없어 verdict 없음 → 제목만. 더 줄이려면 `CUES`(평가 단서 사전) 다국어 확장, 또는 robots가 `allows`인 매체에 한해 본문 첫 평가문장에서 ≤10단어를 뽑는 단계를 추가(현재는 미구현, 의도적 보수).
- **혹평도 그대로**: Reverse Shot "his ironies pat, his cleanliness sterile", Quinlan "tralascia… la profondità" 등 부정 평가도 축어로 보존(중립성).
- **학술 4편 제목만**: Hodgin·Bahrke·Lopate·Nord는 OpenAlex/Crossref에 초록이 없는 저서 챕터·인터뷰라 제목 유지(날조 금지).
- **fetch 차단 매체**: 일부 사이트는 단순 fetch에 빈응답 → 브라우저로 dek 수확. 그래도 안 되면 제목 폴백.

---

## 5. 새 영화로 확장하는 절차 (end-to-end)

1. **발굴**: 영화 제목·연도·감독 확정(TMDb/Wikidata) → allowlist 매체별 `영화명 site:도메인` + RSS로 리뷰 URL·제목 수집, 학술은 OpenAlex/Crossref(`search=감독 영화명`). 검증된 것만 `<영화>_comments.csv`에 기록(스키마는 §3 입력).
2. **추출**: `python comment_extractor.py <영화>_comments.csv <영화>_enriched.csv "<영화제목>"`
3. **렌더**: `python render_box.py <영화>_enriched.csv <영화>_box.html --title "<표시제목>" [--exclude-lang ko]`
4. **검증**: 아래 §6.

(1의 발굴은 현재 반자동 — 에이전트가 allowlist+학술API로 수행. 2·3은 완전 자동.)

---

## 6. 검증 / 품질 체크

- 모든 `verdict_le10`이 `dek_lead`(또는 초록)의 **정확한 부분문자열**인지(축어 정합). 깨지면 대소문자·공백 확인.
- 모든 행에 `url`. 학술은 DOI가 실제 해당 논문으로 해석되는지(doi.org 열기). 이번 Barbara는 11개 DOI 전부 실측 확인(날조 0).
- 통제어휘: `tier ∈ {verdict, title-eval, title}`, `type ∈ {criticism, academic}`.
- 박스: `All = Reviews + Papers`, `Comment = verdict + title-eval` 수치 일치.
- 원칙 위반 0: 본문 텍스트 저장·표시 없음, 매체당 인용 1개, robots 존중.

---

## 7. 한계와 다음 단계

- **발굴 자동화**: 영화→리뷰/논문 매핑이 아직 반자동. allowlist RSS + 학술 API를 도는 발굴 스크립트를 추가하면 1단계도 자동화된다.
- **CUES 다국어 확장**: 폴백 12건은 대개 단서 사전 부족 탓 → 언어별 평가어 보강이 실효를 좌우.
- **본문 verdict(옵션)**: 정말 날카로운 비평가 한 줄이 필요하면, robots=`allows` 매체에 한해 본문 첫 평가문장에서 ≤10단어만 뽑는 단계를 `build_comment`에 추가(매체당 1개 유지). 본문을 보는 단계이므로 robots 게이트 필수.
- **상용화 전 IP 변호사 검토**(한국 저작권법·부정경쟁방지법·정보통신망법, EU TDM 옵트아웃 매체 취급).

---

## 8. 다른 AI에게 줄 요약 (학습용 프롬프트)

> 너는 영화별 "주요 매체 코멘트" 박스를 만든다. 절대 기사 본문을 수집·저장하지 마라. 코멘트는 사다리로만 만든다: ① 기사·논문 **제목**(그대로) ② 발행사 **dek/og:description** 또는 논문 **초록**(OpenAlex→Crossref) ③ 거기서 평가 단서가 든 **≤10단어 연속 축어** 한 토막(반드시 원문 부분문자열, 패러프레이즈 금지, 매체당 1개) + 출처표시 + 링크. verdict가 없으면 제목으로 폴백. robots를 존중하고, 막히면 제목 폴백. 입력은 `<영화>_comments.csv`(id,type,outlet,critic,year,language,comment_or_title,url,note), 추출은 `comment_extractor.py`, 렌더는 `render_box.py`(코멘트 위·제목 아래, `--exclude-lang`로 언어 제외). 어떤 매체를 쓸지·수집 가능 여부·제휴 연락처는 `magazine-allowlist.csv`/`magazine-contacts.csv`의 `robots_ai_stance`·`ingest_recommendation`·연락처 열을 라우팅 테이블로 참고하라. 날조 금지: 실제 링크·제목·축어만.
