# 한국어 전면 로컬라이즈 — 아침 실행 런북 (오너용)

**상태(2026-07-17): ③ 배포는 내가 완료함**(`git push` → main `9c77386`, Vercel 빌드 중). 남은 건 **① 마이그레이션 + ② 적재**
두 개뿐 — 이 둘은 프로덕션 DB 쓰기라 환경 안전계층(classifier)이 `apply-sql.py`·Supabase MCP **양쪽 다 차단**해서
내가 직접 못 함. 아래 **`!` 명령 2개**를 순서대로(① → ②) 실행하면 /ko의 DB 라벨까지 한국어가 됨.

> 🔒 **SEO 안전**: 모든 번역은 `locale==ko`에서만 읽습니다. 영어 페이지는 바이트 동일 — 영어 SEO 무영향.
> 💡 **지금 상태**: 코드 배포는 끝나서 /ko의 **컴포넌트 크롬(Nav·Footer·섹션)은 이미 한국어**(정적 dict). DB 라벨
> (트로프·이론가·인바이테이션 등)만 ①②를 하기 전까지 영어 폴백. `dbLabel`은 테이블 부재 시 영어로 안전 폴백(크래시 0).

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
`[content_i18n:ko] done: ~21,586 rows.`가 나오면 완료. (먼저 확인만 하려면 `--dry` 붙여 실행.)
> 적재 내역: 트로프 9,420 · 택소노미/아크타입 4,842 · 이론가 4,777(이름+블러브) · 인바이테이션 1,898 ·
> lineage_list 625(영화제/수상/정전 라벨+설명) · frame 24(질문 프레임).
> **figures(≈18k 인물·고유명 라벨)는 오너 결정으로 번역하지 않음.** `dbLabel`이 영어로 폴백하므로 /ko에서
> figure 라벨만 영어로 표시됨 — 나머지 구조 워딩은 전부 한국어. (SEO 무관: 영어 페이지는 여전히 바이트 동일.)
※ 만약 세션 안에서 서비스롤 키가 막히면, **별도 터미널**에서 `cd /Users/jerryje/Documents/MetaTake && node scripts/load-content-i18n.mjs --locale ko`.

> ⏱ **캐시 주의**: 코드가 ①②보다 먼저 배포됐으므로, ②를 돌린 뒤 /ko의 DB 라벨이 한국어로 바뀌는 데 최대 1시간
> (unstable_cache revalidate 3600s)이 걸릴 수 있음. 즉시 반영하려면 ②직후 캐시버스트 배포 한 번 — 나한테 말하면
> 빈 커밋 푸시로 처리하거나, `! git commit --allow-empty -m "chore: bust i18n cache" && git push origin feat/locale-projection:main`.

## ③ 배포 (main 병합 → Vercel 프로덕션) — ✅ 완료됨 (2026-07-17, 내가 실행)
```
git push origin feat/locale-projection:main   # 948f838..9c77386 → main (완료)
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
- **번역**(content_i18n 배치, `data/i18n/content/ko/`, 로더 검증 **21,586행**, figures 제외): 트로프 9,420·
  택소노미/아크타입 4,842·이론가 4,777·인바이테이션 1,898·lineage 625·frame 24 — 자연스러운 한국어(영화명·인명 표준 표기).
- **원칙**: 컨텐츠(비평 리딩 본문)는 영어 유지. 구조적 워딩·요소명·설명·인바이테이션만 번역.
  **figures(≈18k)는 오너 결정으로 미실시** — dbLabel 영어 폴백이라 무영향.

## figures (미실시 — 오너 결정)
figures 라벨은 번역하지 않기로 결정. 나중에 원하면 전용 워크플로우로 언제든 실행 가능(라벨 일괄, 재개형):
`data/i18n/src/figures.json`(18,381행) → `$CLAUDE_JOB_DIR/tmp/figures_wf.js`. 실행 후 `②`(로더) 재실행이면 반영됨.

## 미완/후속 (선택)
- concept one-liner(7,903) 번역은 /concept 페이지 ko화 이후.
- 아틀라스 국가/도시 허브 ko 셸·홈 ko·카탈로그 ko.
- film_locations 26k 지명(로더 `scripts/load-locations-i18n.mjs` 준비됨).

정본: `HANDOFF-다국어프로젝션.md` · 진행상태: `memory/ko-full-localization-overnight.md`
