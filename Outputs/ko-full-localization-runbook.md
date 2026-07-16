# 한국어 전면 로컬라이즈 — 아침 실행 런북 (오너용)

밤새 코드+번역을 브랜치 `feat/locale-projection`에 커밋해 뒀습니다. 아래 **`!` 명령 3개**를 순서대로 실행하시면
전부 라이브가 됩니다. (에이전트 샌드박스가 프로덕션 쓰기를 차단해 제가 직접 못 하는 부분입니다.)

> 🔒 **SEO 안전**: 모든 번역은 `locale==ko`에서만 읽습니다. 영어 페이지는 바이트 동일 — 영어 SEO 무영향.

---

## ① content_i18n 마이그레이션 적용 (DB 라벨 매칭 테이블 생성)
```
! python3 worker/apply-sql.py supabase/migrations/0107_content_i18n.sql
```
`HTTP 20x`가 나오면 성공. (또는 Supabase 대시보드 SQL 에디터에 `supabase/migrations/0107_content_i18n.sql` 붙여넣기.)

## ② 번역 적재 (인바이테이션·트로프·아크타입·이론가 … 한국어 → content_i18n)
```
! node scripts/load-content-i18n.mjs --locale ko
```
`[content_i18n:ko] done: ~20,178 rows.`가 나오면 완료. (먼저 확인만 하려면 `--dry` 붙여 실행.)
> 적재 내역: 인바이테이션 1,898 · 택소노미/아크타입 4,842 · 이론가 4,018 · 트로프 9,420.
> **figures(≈18k 인물·고유명 라벨)는 야간 워크플로우가 월 지출 한도에 걸려 보류** — `dbLabel`이 영어로
> 폴백하므로 깨지는 곳 없음(/ko에서 인물명만 영어). 한도 리셋/상향 후 이어서 실행 가능([[재개]] 아래).
※ 만약 세션 안에서 서비스롤 키가 막히면, **별도 터미널**에서 `cd /Users/jerryje/Documents/MetaTake && node scripts/load-content-i18n.mjs --locale ko`.

## ③ 배포 (main 병합 → Vercel 프로덕션)
```
! git push origin feat/locale-projection:main
```
clean fast-forward. 배포 완료 후 `/ko` 전면이 한국어로 보입니다.

---

## 검증 (배포 후)
```
! node scripts/i18n-audit.mjs --service
```
- `/ko` 페이지: 네비·푸터·필름 페이지 크롬 전부 한국어 + figures/트로프/아크타입/인바이테이션 한국어(번역된 것).
- `/film/*`(영어): 무변화 확인.

## 밤새 한 일 (요약)
- **코드 크롬**: Nav(전 페이지 메뉴)·Footer·필름 페이지 섹션 컴포넌트(점수 패널·리니지·리셉션·공유 등) → 한국어.
- **DB 매칭 구조**: `content_i18n` 중앙 테이블(다국어 재사용) + `dbLabel` 접근자 + 로더. 다음 언어(일본어·스페인어)는
  같은 구조에 언어 열만 추가.
- **번역**(content_i18n 배치, `data/i18n/content/ko/`, 로더 검증 **20,178행**): 인바이테이션 1,898·트로프 9,420·
  택소노미/아크타입 4,842·이론가 4,018 — 병렬 에이전트가 자연스러운 한국어로 번역(영화명·인명 표준 표기 포함).
  figures(≈18k 인물·고유명 라벨)는 월 지출 한도로 보류(아래 재개).
- **원칙**: 컨텐츠(비평 리딩 본문)는 영어 유지. 구조적 워딩·요소명·설명·인바이테이션만 번역.

## figures 재개 (월 지출 한도 리셋/상향 후, 선택)
figures만 미완입니다. 한도 리셋 뒤 아래 한 줄로 이어서 돌릴 수 있습니다(캐시된 완료분은 즉시 replay, 실패분만 재실행):
```
Workflow({scriptPath: '$CLAUDE_JOB_DIR/tmp/translate_wf.js', resumeFromRunId: 'wf_194a15fb-d04'})
```
끝나면 다시 `②`(로더)만 재실행하면 figures 라벨도 /ko에 반영됩니다. 지금은 dbLabel 영어 폴백이라 무영향.

## 미완/후속 (선택)
- concept one-liner(7,903) 번역은 /concept 페이지 ko화 이후.
- 아틀라스 국가/도시 허브 ko 셸·홈 ko·카탈로그 ko.
- film_locations 26k 지명(로더 `scripts/load-locations-i18n.mjs` 준비됨).

정본: `HANDOFF-다국어프로젝션.md` · 진행상태: `memory/ko-full-localization-overnight.md`
