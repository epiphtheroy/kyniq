# HANDOFF — 관측성: Sentry 에러추적 (정본)

*작성 2026-07-17. 상태: **코드 완료·비활성 대기** — DSN 미설정이라 현재 100% no-op. 활성화는 §4 오너 체크리스트 3단계.*

## §0 무엇을 왜

에러추적 0인 상태에서 /ko 500(Map 직렬화), reception TDZ 500, /admin 504가 전부 **사용자·GSC·오너가 먼저 발견**했다. 이 핸드오프는 그 갭을 닫는 errors-only Sentry 통합이다. 성능 트레이싱·세션 리플레이·로그는 의도적으로 전부 제외(비용·오버헤드 0 원칙).

- SDK: `@sentry/nextjs` **10.66.0 고정**(package.json exact). Next 16 공식 지원(peer `^16.0.0-0`), Turbopack 빌드 호환.
- 게이트: env `NEXT_PUBLIC_SENTRY_DSN` **하나**. 미설정이면 SDK가 공식 문서화된 no-op(전송 0·네트워크 0·throw 0). 코드 배포와 활성화가 분리되어 있어 이 코드는 언제 배포해도 안전하다.

## §1 파일 맵 (신규 5 + 수정 2)

| 파일 | 역할 |
|---|---|
| `instrumentation.ts` (루트, 신규) | Next가 직접 로드. `register()`가 런타임별 init을 임포트. `onRequestError = Sentry.captureRequestError` — **서버컴포넌트·라우트핸들러·서버액션·미들웨어 에러**를 잡는 유일한 훅 |
| `instrumentation-client.ts` (루트, 신규) | 브라우저 init + `onRouterTransitionStart` export. **Next 16 클라이언트 진입점은 이 파일뿐** (§3-1 함정) |
| `sentry.server.config.ts` (신규) | Node 런타임 init |
| `sentry.edge.config.ts` (신규) | Edge 런타임(middleware) init |
| `app/global-error.tsx` (신규) | 루트 레이아웃 붕괴 시 최후 바운더리 + `captureException`. 자체 `<html><body>` 렌더(globals.css 의존 불가라 인라인 스타일). **프로덕션 빌드에서만 동작**(dev는 오버레이가 가로챔) |
| `app/error.tsx` (수정) | 기존 바운더리에 `captureException` useEffect 추가 — 클라 렌더 에러는 서버 훅에 절대 안 잡히므로 여기서 직접 보고 |
| `package.json` (수정) | `@sentry/nextjs: 10.66.0` |

## §2 설계 결정 (변경 전 필독 — 적대적 리뷰 2렌즈 반영됨)

1. **`withSentryConfig` 없음 = 의도.** next.config 래퍼는 빌드타임 전용(소스맵 업로드·릴리즈 주입·tunnelRoute). 에러 캡처는 Next 네이티브 파일 규약만으로 완결된다. 소스맵은 후속(§5).
2. **env는 `NEXT_PUBLIC_SENTRY_DSN` 하나로 통일** (서버/엣지/클라 전부). DSN은 비밀 아님(공개 가능 값). 클라는 NEXT_PUBLIC 접두사가 필수(빌드타임 인라인)이고, 서버도 같은 var를 읽게 해 오너 체크리스트를 1변수로 줄였다.
3. **서버/엣지 init은 `if (env)` 가드로 감쌈** (`enabled:false`로는 부족 — 리뷰 발견). `Sentry.init`은 disabled여도 프로세스 전역 OpenTelemetry 등록·SIGTERM 핸들러·`NEXT_OTEL_FETCH_DISABLED` 설정을 수행한다. 가드 덕에 DSN 미설정 = 진짜 zero-effect. 서버/엣지는 이 env를 런타임에 읽으므로(빌드 산출물에서 검증) env 설정+재배포로 활성화된다. 미init 상태의 `captureRequestError`는 안전한 no-op(검증됨). 클라(`instrumentation-client.ts`)는 `enabled:` 게이트 유지 — Turbopack은 env를 런타임 객체 조회로 내보내 가드로도 번들 제거가 안 되고, disabled 클라 init은 fetch/DOM 패치 0으로 깨끗함(검증됨).
4. **서버 에러 이중보고 필터**: 서버발 에러는 클라 바운더리에 redacted 사본으로 다시 도착한다. `error.digest` 보유 = 서버가 이미 전체 내용으로 보고했음 → `app/error.tsx`·`app/global-error.tsx` 둘 다 `if (!error.digest)`일 때만 captureException. 바운더리는 순수 클라 렌더 에러만 보고한다.
5. **번들 무게 = 의식적 수용**: 클라 루트 청크 +약 20–25KB gzip(전 페이지)·엣지 미들웨어 +약 22KB gzip(콜드스타트 시 평가, 요청당 작업 0). DSN 미설정이어도 무게는 실림(Turbopack 특성상 제거 불가). 표준적 비용으로 수용하되, CWV 필드데이터 악화 시 dynamic-import 게이팅으로 재설계(복잡도↑라 v1 배제).
6. **errors-only는 "0으로 설정"이 아니라 "옵션 생략".** `tracesSampleRate: 0`도 트레이싱 배관을 초기화한다 — 옵션 자체를 빼는 것이 올바른 off. replayIntegration·enableLogs 추가 금지(비용·성능).
7. `sendDefaultPii: false` — IP·쿠키 미전송. `notFound()`/`redirect()`는 보고되지 않음(정상) — 이 사이트는 404가 설계상 대량이므로 중요.

## §3 함정 (Turbopack/Next 16)

1. **`sentry.client.config.ts` 만들지 말 것** — 구 webpack 플러그인만 로드하던 파일. Turbopack(Next 16 기본)은 조용히 무시 → 클라 에러가 소리 없이 증발. 클라 진입점은 `instrumentation-client.ts`가 유일.
2. instrumentation 두 파일은 **루트 고정**(app/ 안 금지). `experimental.instrumentationHook` 플래그는 Next 16에서 제거됨 — 추가하면 에러.
3. 소스맵 후속 작업 시: Turbopack 업로드는 빌드 **후** 실행(runAfterProductionCompile) — "compiled successfully" 뒤에 업로드 로그가 나오는 게 정상.
4. ⚠️ **배포 원자성(워처 함정)**: 이 변경은 워처가 스테이징하는 경로(`app/error.tsx`·`app/global-error.tsx`)와 워처가 절대 못 보는 루트 파일(package.json·package-lock.json·instrumentation 2종·sentry.config 2종)에 걸쳐 있다. 워처가 코드 절반만 main에 밀면 `@sentry/nextjs` 임포트가 미해결 → **main 빌드 파탄**. 반드시 아래 8파일+문서를 **한 커밋**으로:
   ```
   git add instrumentation.ts instrumentation-client.ts sentry.server.config.ts sentry.edge.config.ts \
     app/global-error.tsx app/error.tsx package.json package-lock.json \
     HANDOFF-관측성-Sentry.md HANDOFF-DB백업-PITR.md 00-INDEX.md
   git commit -m "feat(observability): Sentry errors-only integration (inert until DSN)"
   ```
5. 검증 기록(2026-07-17): `tsc --noEmit` 신규 파일 오류 0(선재 오류 23은 별개·`ignoreBuildErrors` 사유), 로컬 프로덕션 빌드 통과(+리뷰 반영 후 재빌드), .next 산출물에서 서버 instrumentation.js·클라 청크 SDK·`_global-error.html` 확인, 2렌즈 적대적 리뷰(정확성·배포리스크) 7건 발견 → should-fix 전건 반영.

## §4 오너 활성화 체크리스트 (3단계, ~10분)

1. **sentry.io 계정/프로젝트 생성** — 플랫폼 "Next.js", 무료(Developer) 티어로 시작. 프로젝트 Settings → Client Keys에서 **DSN 복사**.
2. **Vercel → metatake 프로젝트 → Settings → Environment Variables**: `NEXT_PUBLIC_SENTRY_DSN` = 복사한 DSN, 환경은 Production(+원하면 Preview). 저장 후 **재배포 1회 필수**(클라 값은 빌드타임 인라인). 같은 화면에서 **"Automatically expose System Environment Variables" ON** 확인 — 꺼져 있으면 이벤트가 environment="development"로 태깅됨.
3. **확인**: 배포 후 존재하지 않는 페이지가 아니라 실제 에러를 유발(예: 임시로 `/api/v1/*`에 잘못된 파라미터) → sentry.io Issues에 수 분 내 표시. Sentry 기본 알림(새 이슈 → 이메일)은 자동 on.

## §4.5 인시던트 기록 (2026-08-05) — "DSN이 번들에 있는데 이벤트 0건"의 진짜 원인

- **증상**: DSN 인라인 확인·client key 활성·수집 파이프라인 정상(수동 envelope POST → 이슈 생성)인데 90일간 error·session 수신 0건. 08-05 프로덕션 removeChild 크래시도 미기록.
- **원인**: Vercel의 `NEXT_PUBLIC_SENTRY_DSN` 값 자체가 오염 — **잘린 DSN(`…/45117`) 3개 + 완전한 DSN 1개가 그대로 이어붙은 348자** (붙여넣기 사고). Sentry 프로덕션 빌드는 DSN 검증이 제거돼 있어 이 값을 통과시키고, 호스트 첫 `/` 이후 전부를 projectId로 삼아 기형 ingest URL로 전송 → 전 요청 실패. 세 런타임(클라·서버·엣지) 모두 같은 env를 쓰므로 전부 침묵.
- **진단법(재사용 가능)**: 헤드리스 크롬으로 페이지 로드 → `window.__SENTRY__`에서 `client.getOptions().dsn` 확인 + 합성 uncaught error 던지고 envelope POST의 **URL 모양**을 관찰. "번들에 있다"≠"실행된다"≠**"전송이 도달한다"** — 세 번째까지 봐야 한다.
- **수정(커밋 1f677224)**: `lib/sentry-dsn.ts` `resolveSentryDsn()` — 끝-앵커 정규식으로 마지막 완전한 DSN을 회수, 인식 불가면 undefined(=Sentry off). 세 init 전부 이걸 통과. **env 값이 오염된 채로도 다음 배포부터 정상 동작.** Vercel env 정리는 선택적 위생(오너, §4-2 참고).
- **부수 수정(같은 커밋)**: `instrumentation-client.ts`에 removeChild/insertBefore 가드 — 구글 번역의 텍스트 노드 치환이 React 커밋을 크래시시키던 것(08-05 실사용자 보고)을 흡수하고, 발생 시 warning 이벤트(htmlClass의 `translated-ltr` 마커 포함)로 URL과 함께 보고.

## §5 후속 (선택, 별도 세션)

- **소스맵**: `withSentryConfig` + `SENTRY_AUTH_TOKEN`(Vercel env) 추가 → 난독화 해제된 스택트레이스. 10.66.0은 요건(≥10.13.0) 충족. 빌드 파이프라인을 건드리므로 배포 한산기에.
- **tunnelRoute**: 애드블로커가 클라 이벤트를 막는 비율이 높으면 검토.
- 알림 라우팅(Slack 등), 릴리즈 태깅.
