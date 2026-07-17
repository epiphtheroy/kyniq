# HANDOFF — 배포체계 P0: staging → 일괄 릴리즈 (정본)

*작성 2026-07-17. 오너 결정: P0 승인 · 릴리즈 창 매일 22:00 · 병합은 오너 확인 후 직접. 상태: **구축 완료** — 이 문서가 새 배포 체계의 정본.*

## §0 한 장 요약

**"저장 = 20초 뒤 프로덕션" 체제 종료.** 이제 모든 작업은 `staging` 브랜치 → Vercel이 자동으로 만드는 **개발 URL**에서 확인 → 오너가 매일 22:00 `release.command` 더블클릭 → 그때만 metatake.net 반영.

```
[작업/지시] → 워처가 staging 푸시 (또는 에이전트가 직접 push origin +HEAD:staging)
   → GitHub Actions CI(타입 래칫) + Vercel staging 빌드(개발 URL, ~2-3분)
   → 오너: 개발 URL에서 시시각각 확인 (어드민 포함 사이트 전체)
   → 22:00 release.command 더블클릭 = staging→main 병합 = 프로덕션 배포 1회
```

## §1 구성요소 파일맵

| 파일 | 역할 |
|---|---|
| `auto-deploy-watch.sh` (개조) | app/components/lib 감시 → **`push origin +HEAD:staging`** (main 푸시 제거). index.lock은 2분 이상 묵은 것만 제거(에이전트 경합 보호) |
| `.github/workflows/ci.yml` (신규) | staging 푸시·main행 PR마다: `npm ci` + **tsc 래칫**(오류 수가 `ci/tsc-baseline.txt` 초과 시 실패). Vercel 빌드가 제2 게이트 |
| `ci/tsc-baseline.txt` (신규) | 선재 tsc 오류 기준선 = **20**. 내리는 것만 허용, 올리기 금지 |
| `release.command` (신규) | **오너의 릴리즈 버튼**(더블클릭): fetch → staging 커밋 목록 표시 → 'release' 타이핑 확인 → 임시 worktree에서 no-ff 병합 → main 푸시. 로컬 작업트리 무접촉 |

## §2 운영 규칙

1. **main 직푸시 금지** — 유일 경로는 release.command. 예외=핫픽스(사이트 장애): 수동 `git push origin <fix>:main` 허용, 사후 staging 동기화 필수.
2. 릴리즈는 **매일 22:00** (심야 백필 02:00~와 비겹침, 캐시 재생성 부하 1회/일).
3. **release가 반영하는 것 = 개발 URL에서 본 것 그대로**(origin/staging tip). 확인 안 한 것은 반영하지 말 것.
4. 에이전트 규칙: staging까지는 자유(가역), **main 병합은 오너만**.
5. 워처의 staging 푸시는 force(`+HEAD:staging`) — 여러 세션이 병행하면 마지막 푸시가 이김. 병행 작업 시 워처 끄고 수동 푸시.

## §3 개발(스테이징) URL

Vercel Git 연동이 staging 브랜치 푸시마다 자동 빌드. **브랜치 고정 URL**은 `<프로젝트>-git-staging-<계정>.vercel.app` 형식(첫 푸시 후 Vercel 대시보드 → Deployments에서 확인, 본 문서에 기록해 둘 것). Preview 배포는 Vercel 로그인(오너)만 접근 가능한 보호가 기본이며 색인되지 않음. 예쁜 주소를 원하면 Vercel → Settings → Domains에서 `staging.metatake.net`을 staging 브랜치에 연결(오너, 2분).

⚠️ **DB는 프로덕션 공유**: 개발 URL = 새 코드 + 운영 DB. 마이그레이션·대량 적재는 여전히 운영 직행이므로 기존 규칙(심야·오너 게이트) 유지. 완전 분리는 미결 ②(제2 Supabase 프로젝트).

## §4 후속 (선택)

- **브랜치 보호(기계적 강제)**: 현재 워처 개조+release.command로 행동적 차단만 된 상태(SSH 키가 하나라 누구든 기술적으론 main 푸시 가능). GitHub API 인증이 필요해 오너 1회 작업: `gh auth login -w` 실행 후 Claude 세션에 "브랜치 보호 설정" 요청 → PR 필수+CI 필수 체크로 격상, release.command도 PR 방식으로 업그레이드.
- **eslint 수리**: `npm run lint`가 현재 크래시(글롭 스캔 실패, 거대 비코드 디렉터리 추정) — 수리 후 CI에 편입.
- tsc 백로그 20건 상환 → 기준선 0까지 래칫 다운.
- 스테이징 DB(미결②)·릴리즈 자동 알림.

## §5 구축 검증 기록 (2026-07-17)

staging 브랜치 = origin/main + Sentry 커밋 + P0 커밋으로 생성·푸시. CI 첫 실행·Vercel staging 빌드 결과는 §3에 URL과 함께 추기.
