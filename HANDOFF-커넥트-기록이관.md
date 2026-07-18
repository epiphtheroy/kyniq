# HANDOFF — 커넥트(Connect): 내 영화 기록의 오픈뱅킹 · 기획 정본 **v1.0** (2026-07-18, 오너 방향 확정 · **구현 대기**)

> **한 문장 정의:** 사용자가 쓰는 서비스(Letterboxd·IMDb·Netflix·왓챠피디아·Trakt·TMDB·Simkl…)를 고르면, **금지선(자격증명 대리 취급) 안에서 가능한 가장 짧은 동선**으로 본인의 평점·본 영화 기록을 가져와 **전부 병렬로** Metatake 원장에 합치고, 그 순간 회고 판정(발굴/합치/실망)을 소급 계산해 보여준다.
> 관련 정본: `HANDOFF-모바일앱-프리워치.md`(v4.0 — 판단 상태 기계·Shelf·온보딩④) · 기존 웹 `/me/import` 파이프라인(user_watch_log 무손실 원장·parsers.ts·ImportWizard — **이 기획은 그 파이프라인의 일반화·앱 편입·자동화 승격이다. 재발명 금지.**)
> 오너 지침(2026-07-18): ① 금지선은 당연히 지킨다 ② 그 안에서 **사용자 편의성이 핵심** ③ 앱↔iOS 내부 동작의 연결을 정교하게 ④ 선택하면 가져올 수 있는 것을 **싹 다 병렬로** ⑤ 각 서비스의 실제 인터페이스에 정합하게.

---

## §0 원칙 3조 (이 문서의 헌법)

1. **금지선(불변식)**: 사용자 아이디/비밀번호를 받는 대리 로그인·스크래핑·서버 대리 페치 금지. (기술적으로도 봉쇄돼 있음 — letterboxd.com·imdb.com은 비브라우저 페처에 403. "우리 서버가 대신 받아올게요"는 애초에 성립 불가.) 로그인은 언제나 **그 서비스의 자기 페이지에서, 사용자 자신의 브라우저로만.**
2. **앱은 길을 깔고, 사용자는 자기 데이터만 만진다**: 앱이 정확한 내보내기 URL을 열어주고, 정확한 버튼 라벨을 보여주고, 돌아오면 파일이 바로 손에 잡히게 한다. 사용자가 하는 일은 "그 서비스에 로그인 → 버튼 하나 → 앱으로 복귀"뿐이어야 한다.
3. **가져온 뒤는 전부 병렬·한 화면**: 소스가 몇 개든 임포트는 동시에 돌고, 결과는 하나의 요약(총 N편·별점 M개·발굴 K편)으로 합쳐진다. 소스 하나의 실패가 다른 소스를 막지 않는다.

## §1 커넥터 카탈로그 — 서비스 인터페이스 실사 (2026-07-18, 웹 리서치 3레인)

| 서비스 | 등급 | 사용자 동선(실측) | 얻는 것 | 매칭 키 | 핵심 함정 |
|---|---|---|---|---|---|
| **Trakt** | **A 자동** | 시스템 브라우저에서 trakt.tv 로그인→승인 (auth-code, 커스텀 스킴 리다이렉트 가능, 등록 무료·즉시) | `/sync/watched/movies`(전체 1콜)·`/sync/ratings/movies`(1–10점)·`/sync/history` | **tmdb id 내장** — 직결 | 액세스 토큰 ~24h → **refresh_token 필수**. authorize는 trakt.tv 호스트·토큰 교환은 api.trakt.tv. 상업 이용 무제한(공식 포럼 확인) |
| **TMDB** | **A 자동** | v4 3단계: request_token → themoviedb.org/auth/access 승인 → access token. **redirect_to 커스텀 스킴 공식 지원**(모바일에 최적) | rated movies(0.5–10, 0.5스텝)+watchlist+리스트. watched 개념 없음 | tmdb id 자체 | 토큰 무만료(해지형). 표기 의무 문구는 앱에 기존재(§13-8) |
| **Simkl** | **A 자동** | simkl.com 로그인→승인. **"WebView 금지, 시스템 브라우저만" 공식 명시**(우리 기본과 일치) | `/sync/all-items/movies` 1콜 = watched+rating(1–10) | tmdb id(문자열) | **`/sync/activities` 선확인+date_from 증분 필수 — 위반 시 client_id 정지**. 토큰 사실상 무만료. 빈 보관함이면 body가 `null` |
| **Letterboxd** | **B 파일** | `letterboxd.com/settings/data/` → **"Export your data"** → **즉시 ZIP**(무료 티어 OK, 모바일 사파리 동작·Files↓) | watched.csv·ratings.csv(0.5–5)·**diary.csv(실제 시청일·재관람)**·watchlist.csv | **id 없음** → 제목+연도(+boxd.it URI 보조) | iOS 앱엔 내보내기 없음(웹만). `deleted/` 폴더는 스킵. 별도: API는 신청제(오너 명의, §7-D4) |
| **IMDb** | **B 파일(2단)** | Your ratings → **⋮ → Export** → **비동기 큐** → `imdb.com/exports`(모바일 `m.imdb.com/exports`)서 다운로드 | ratings CSV: **Const(tt id!)**·Your Rating(1–10)·Title Type·Year | **tt id → TMDB /find 변환** = 정확 매칭 | **2단계 큐가 최대 UX 함정**(누르고 아무 일도 안 생김) → 전용 상태·수거 버튼·리마인드 필요. 인코딩 cp1252 이력. Title Type로 영화만 필터 |
| **Netflix** | **B 파일(프로필별)** | `netflix.com/settings/viewing-history` → 맨 아래 **"Download all"**(한국 UI **"전체 다운로드"**) → 즉시 CSV. 앱엔 이 화면 없음(사파리로) | Title·Date 2열, 최신순 | 제목+연도 없음! → 콜론 패턴으로 에피소드 걸러낸 뒤 제목 매칭 | **평점 자체가 없음**(넷플릭스는 평점 미반출) · 프로필마다 반복 · 재관람=중복행 |
| **왓챠피디아** | **B 클립보드** | 공식 내보내기 **없음**. 프로필 공개(전체 공개) 시 `pedia.watcha.com/users/{code}/…/ratings`가 로그인 없이 열림 → **끝까지 스크롤→전체 선택·복사** → 앱에 붙여넣기(기존 `watcha_text` 파서가 이 포맷 전용) | 제목+★0.5–5 | 제목+연도 | 무한스크롤이라 ~200편까지 현실적, 그 이상은 데스크톱 권장(정직하게 안내). 영화/TV 페이지 분리. 시청일 없음 |
| ~~KinoLights~~ | **제외** | 오너 결정(2026-07-18)으로 포기 — 앱 전용 SPA라 실사 비용 대비 효용 낮음 | — | — | 재검토 시 실기기 실사부터 |

## §2 UX 설계 — 편의성의 핵심 장치들

### 2.1 진입점 2곳
- **Shelf ▸ "내 기록 가져오기"** (기어 시트가 아니라 Shelf 본문 카드 — 빈 서재의 1번 CTA).
- **온보딩 ④ 취향 캘리브레이션 상단 카드**: "이미 Letterboxd/왓챠를 쓰세요? 통째로 가져오면 24편 탭보다 빠릅니다" → 허브로 점프. (수동 캘리브레이션은 그대로 폴백.)

### 2.2 허브 화면 — 서비스 타일 그리드
타일 = 로고·이름·상태 배지. **다중 선택 후 [가져오기 시작] 하나로 전부 병렬 개시.** 상태 배지는 §2.3 상태 기계를 그대로 노출: `연결됨 · 동기화 중` / `파일 기다리는 중` / `가져옴 · 812편 · 7/18` / `준비 중`(KinoLights).

### 2.3 커넥터별 상태 기계 (허브·배너·리마인드의 단일 원천)

```
not_connected → guiding(안내/브라우저 열림) → awaiting_file(파일형만) → importing → imported(n편, 날짜)
                                     └ OAuth형: authorized → syncing(일1회 diff)
   실패 어디서든 → error(사유 + 한 번에 재시도) · 언제든 disconnect(토큰 삭제)
```

이 상태는 서버(user_connections + user_import_jobs)에 있으므로 **앱을 껐다 켜도, 웹에서 이어서 해도** 그 자리부터 계속된다.

### 2.4 iOS 내비게이션 디테일 (오너 지침 ③ — 이 기획의 심장)

**OAuth형(원탭)**: `openAuthSessionAsync`(시스템 브라우저 시트 — Simkl 요구사항과도 일치) → 승인 → 커스텀 스킴 콜백 → 즉시 페치 시작. 사용자 체감 = "로그인 한 번".

**파일형 = "2왕복 설계"** (내려받기 왕복 + 집어넣기 왕복, 각 왕복을 최단화):
1. 타일 탭 → **3컷 안내 카드**(실제 버튼 라벨 그대로: "Export your data" / "⋮ → Export" / "전체 다운로드") → [내보내기 페이지 열기] = **진짜 Safari로 오픈**(`Linking.openURL`). ⚠️SFSafariViewController가 아닌 이유: 인앱 사파리 시트는 파일 다운로드를 제대로 처리하지 못한다 — ZIP/CSV는 실Safari의 다운로드 매니저를 타야 Files▸다운로드에 확실히 안착.
2. 사용자: 서비스 로그인 → 버튼 1개 → 다운로드(레터박스·넷플릭스는 즉시).
3. **앱 복귀 감지**(AppState foreground): awaiting_file 커넥터가 있으면 상단 배너 — "Letterboxd 파일을 받으셨나요? **[파일 선택]**" → `expo-document-picker`(최근 항목 최상단에 방금 그 파일) → 탭 한 번 → 임포트 시작. 왕복 사이 이탈을 배너가 회수한다.
4. **IMDb 전용 2단 처리**: guiding이 두 쪽 — (a) "내보내기 요청함" 확인 → (b) [수거하러 가기] 버튼 = `m.imdb.com/exports` 딥링크 + "보통 몇 분 걸려요" 문구 + **선택적 로컬 알림 리마인드**("20분 뒤 알려드릴까요?" — dev 빌드 단계, Expo Go에선 배너만).
5. **클립보드형(왓챠)**: 안내 카드에 공개 설정 경로(프로필▸설정▸공개범위▸전체 공개)까지 포함 → Safari로 본인 평가 페이지 → "맨 아래까지 스크롤 후 전체 선택·복사" → 앱 복귀 시 클립보드 감지(iOS 붙여넣기 허용 프롬프트는 시스템이 1회 표시) → "**왓챠 기록을 붙여넣을까요?**" 원탭 → 기존 watcha_text 파서. ~200편 초과 계정엔 "데스크톱이 더 빠릅니다"를 정직하게 표기.
6. **dev 빌드 승격(§6-I3)**: 공유시트 수신("Metatake로 공유")·Files 연결(CFBundleDocumentTypes: csv/zip → "Metatake로 열기") → 2왕복이 사실상 1왕복으로 단축. Expo Go 기간에는 문서 피커가 표준 경로.

### 2.5 병렬 임포트 극장 (오너 지침 ④)
선택한 모든 소스가 **한 화면에서 동시에** 진행된다:

```
Letterboxd   ████████░░  파싱 812/1,024 · 별점 623
IMDb         ██████████  완료 · 391편 (tt 직결 매칭 100%)
Netflix      ███░░░░░░░  에피소드 거르는 중…
왓챠피디아    대기 — 파일/붙여넣기 필요
─────────────────────────────────────────
합치면: 1,384편 · 별점 947개 · 중복 217 정리
→ 당신의 발굴 17편을 찾았습니다   [서재 보기]
```

- 잡은 소스별 독립(하나 실패해도 나머지 완료). 완료 요약에서 **회고 소급**(기존 별점 × Standing → 발굴/합치/실망)이 이 기획의 킬러 모먼트.
- **미매칭은 숨기지 않는다**: "제목으로 못 찾은 23편" 검토 리스트(제목+연도 표시, 탭하면 검색으로 수동 매칭·건너뛰기). no-fake 원칙의 임포트 버전.

### 2.6 신뢰 시트 (동의 UX)
각 커넥터 시작 전 한 장: **우리가 보는 것**(그 서비스가 내보낸 파일/승인된 API 범위) · **절대 안 보는 것**(비밀번호·결제·시청 외 데이터) · **언제든 해제**(연결 해제=토큰 즉시 삭제, 가져온 기록은 사용자 원장이므로 남되 일괄 삭제 버튼 제공).

## §3 데이터·매칭 규칙 (기존 파이프라인 승계 + 소스별 특화)

| 소스 | 매칭 | 별점 정규화 | watched_at |
|---|---|---|---|
| Trakt/TMDB/Simkl | **tmdb id 직결** | 10점제→÷2(0.5 반올림) | Trakt last_watched_at·history |
| IMDb | **Const(tt)→TMDB `/find` 변환** | 1–10정수→÷2 | 없음(Date Rated는 평점일 — watched_at엔 넣지 않음) |
| Letterboxd | 제목+연도(diary/ratings/watched 3파일 병합, boxd.it URI로 동명이작 보조) | 0.5–5 그대로 | **diary.csv Watched Date만 신뢰**, watched.csv Date는 기록일 |
| Netflix | 콜론 패턴(`: Season N:`)으로 에피소드 제거 → 제목 매칭 | 평점 없음 | CSV Date |
| 왓챠 | 제목+연도(기존 파서) | 0.5–5 | 없음(null) |

- 공통: 중복 키 `tmdb_id|watched_at|source`(기존)·무손실 원장 user_watch_log·병합/덮어쓰기 정책은 /me/import 규칙 승계. IMDb CSV는 cp1252 폴백 디코딩. Letterboxd ZIP의 `deleted/` 스킵. 카탈로그 밖 영화는 `/api/track`의 lazy Tier-2 생성 선례.

## §4 아키텍처

- **마이그 1건**: `user_connections`(user_id·provider·**토큰 암호화 저장**·scope·last_sync_at·status·counters, own-row RLS·토큰 컬럼은 서비스롤 전용 뷰로 차폐). 파일형 잡은 기존 `user_import_jobs` 확장(source 값 추가)으로 충분.
- **웹 라우트**: `/api/connect/{provider}/start|callback|sync|disconnect` — 렌즈 패턴(세션 검증, 토큰은 서버만). 파일형은 기존 `/api/import/commit` 그대로 + `lib/import/parsers.ts`에 `netflix_csv` 파서 1개 추가(레터박스·IMDb·왓챠는 기존).
- **동기화 크론**: 일 1회(가용성 크론 선례). Trakt=last_activities 확인 후 증분, **Simkl=/sync/activities 선확인+date_from(정지 리스크 — 코드 주석으로 불변식화)**, TMDB=rated 페이지 diff.
- **앱**: 허브 화면 1개 + 배너/클립보드 감지 훅 + 문서 피커. 임포트 실행·파싱은 전부 서버(기존 경로) — 앱은 파일 업로드와 상태 표시만. LLM 0.

## §5 단계

| 단계 | 내용 | 전제 |
|---|---|---|
| **I1 파일형 완성** | 허브+상태기계+2왕복 동선+복귀 배너+왓챠 클립보드+Netflix 파서+IMDb 2단 큐 안내. **Expo Go에서 전부 동작** | 마이그 0 |
| **I2 OAuth 3종** | Trakt → TMDB → Simkl(같은 틀 복제)+user_connections 마이그+일1회 크론 | 마이그 1·개발자 등록 3건(전부 무료·즉시) |
| **I3 dev 빌드 승격** | 공유시트 수신·Files "Metatake로 열기"·IMDb 로컬알림 리마인드 | eas 빌드(§15.4 이후) |
| **I4 확장** | Letterboxd API 승인 시 B→A 승격(ZIP은 영구 폴백). 신청 자체는 단계와 무관하게 **지금**(§7-D4) | 오너 발신 |

## §6 불변식 (v1 — 위반 금지)

1. 자격증명 대리 취급·스크래핑·서버 대리 페치 금지. 로그인은 사용자 자신의 브라우저에서만.
2. OAuth는 시스템 브라우저만(WebView 금지 — Simkl 명문 요구이자 우리 표준).
3. 토큰은 서버 전용(앱·클라이언트에 원본 토큰 노출 금지), 연결 해제 = 즉시 삭제.
4. 가져온 기록도 원장은 `user_movies`+`user_watch_log` 단일 — 커넥터 전용 그림자 원장 금지.
5. 미매칭·불완전(넷플릭스 무평점, 왓챠 무시청일)은 숨기지 말고 그대로 보여준다.
6. Simkl 증분 규약(activities 선확인+date_from) 준수 — 위반=client 정지.
7. 안내 카드의 버튼 라벨은 실제 서비스 문구를 그대로 인용하고, 서비스 개편 시 이 문서 §1 표를 갱신한 뒤 카드 문구를 고친다(문구의 SSOT는 이 표).

## §7 오너 결정 포인트 (2026-07-18 확정 반영)

- **D1 ✅확정** 왓챠 공개 전환 안내 **포함** — 안내 카드에 ①공개 전환 경로 ②가져오기 ③**다시 비공개로 되돌리는 경로**까지 3단 세트로. 기본 문구는 권유가 아닌 선택 안내 톤.
- **D2** IMDb 리마인드 로컬 알림(옵트인) — 권고: I3에서. (미결)
- **D3 ✅확정** KinoLights **포기** — §1 표에서 제외.
- **D4 ✅방침 확정** Letterboxd API — **앱 출시 전 신청 가능·지금 신청 권장.** 근거: ①신청에 라이브 앱 요건 없음(용도 설명 기반 심사) ②신뢰 앵커는 이미 라이브인 metatake.net(콘텐츠 실체가 있는 제품이라 "개인 프로젝트 불허" 조항에 안 걸림) ③응답이 느리거나 없을 수 있어 리드타임을 지금 확보하는 게 이득 ④승인 여부와 무관하게 ZIP 폴백이 있어 실패 비용 0. 프레임 주의: 우리 앱에 추천 기능이 있으므로 신청서엔 **"사용자 본인 데이터의 본인 계정 이관(마이그레이션·동반 앱)"**으로 한정 서술 — Letterboxd 데이터를 추천·분석·LLM에 쓰지 않는다는 사실을 명시(실제로도 안 씀: 가져온 기록은 사용자 원장 user_movies로만 감). 발신=오너 명의(가공 페르소나 금지). 문안 초안 §7.1.

### 7.1 Letterboxd API 신청 — 최종판 (리스크 진단 · 방지 설계 · 절차 · 문안) — v1.2 확정

#### (a) 심사자가 metatake.net을 봤을 때의 거절 리스크 진단

| # | 불허 조항 | 심사자 눈에 보이는 것 | 방지 설계 |
|---|---|---|---|
| 1 | 추천 프로젝트 | TakeScore 랭킹·What to Watch·kindred — "추천 제품"으로 분류될 소지 **(최대 리스크)** | 신청 용도를 **이관(migration) 하나로 한정** + "레터박스 데이터는 추천에 불사용" 서면 약속. 실제로도 참: 가져온 기록은 user_movies(비공개 원장)로만 감 |
| 2 | LLM/GPT 관련 사용 | 사이트가 AI 집필을 투명 표기(크레딧 개편) → "AI 프로젝트"로 뭉뚱그려질 소지 | **숨기지 않고 선제 분리**: "편집 콘텐츠는 자체 AI-assisted 시스템 산출이며 사이트에 투명 표기; 회원 데이터는 그 파이프라인에 절대 불입" 한 줄. 은폐 시도는 사이트 방문 즉시 들통나므로 역효과 |
| 3 | Pro 기능 재현 | Pro 핵심 = 왓치리스트×가용성인데 우리 앱에도 가용성 화면 존재 | "가용성은 자체 라이선스 데이터(JustWatch/TMDB)로 구동, 레터박스 데이터 불사용" 명시 |
| 4 | 개인·사적 프로젝트 | — | 라이브 제품(7천 편 규모)·양대 스토어 출시 일정 제시로 해소 |
| 5 | (조항 아님) 무응답 | 개별 회신 없음 공지 | 실패 비용 0(ZIP 폴백 영구) · 4~6주 무응답 시 TestFlight 빌드 링크 첨부 재신청 |

#### (b) 신청 절차 — 어디서, 어떻게

1. **신청 창구는 웹 폼이 아니라 이메일입니다**: `api@letterboxd.com` (공식 안내 페이지 https://letterboxd.com/api-beta/ 참조 — 여기에 신청 방법·불허 용도가 명시돼 있으니 발송 전 한 번 훑어볼 것).
2. **발신 주소**: 오너가 실제 통제하는 주소. 가능하면 도메인 주소(예: wonwoo@metatake.net — **실존·수신 가능 여부 먼저 확인**), 없으면 channel.wonwoo@gmail.com. 도메인 주소가 신뢰도에 유리.
3. **제목에 앱/프로젝트명 필수**(그들의 명시 요구): 아래 문안의 Subject 그대로.
4. 본문 = (c) 문안. 첨부 불요(링크로 충분).
5. **기대 관리**: "모든 신청을 읽지만 개별 회신·승인 보장은 없다"가 공식 입장. 회신 오면 client id/secret 수령 → Connect I2에서 OAuth 연동(B→A 승격). 무응답이어도 ZIP 커넥터는 그대로.
6. 발송 후 이 문서에 발송일 기록(§8).

#### (c) 최종 이메일 문안 (발신=오너 명의)

> **Subject:** API access request — Metatake (member-initiated import of their own data)
>
> Hello,
>
> I'm Wonwoo Yoon, founder of Metatake (https://metatake.net), a film criticism and appraisal site covering ~7,000 films, now launching a companion iOS/Android app that helps people decide what to watch.
>
> We're requesting API access for exactly one use case: a Letterboxd member signs in through the Authorization Code flow and imports *their own* watched films and ratings into their own private Metatake ledger, so they don't have to rebuild their film history by hand. We already support this migration through your official export ZIP; API access would only make the same member-initiated import smoother on mobile.
>
> Our commitments, in writing:
> - Letterboxd data is never displayed publicly, aggregated, analyzed, or visualized.
> - It never feeds our recommendation features, editorial systems, or any AI/LLM processing. Imported entries exist solely in the member's own private account and are deleted on disconnect or account deletion.
> - We do not recreate Pro features: streaming-availability features in our product run entirely on our own independently licensed data (JustWatch/TMDB).
> - Scope-minimal, read-only access to the authenticated member's own data — nothing else.
>
> For transparency: Metatake's editorial content is produced by our in-house AI-assisted editorial system and is credited as such on-site. Member data — from Letterboxd or anywhere else — plays no part in that pipeline.
>
> The website is live today; the app enters TestFlight shortly (US and Korean storefronts). I'm happy to provide a build or any further detail.
>
> Thank you for considering this.
>
> Wonwoo Yoon — Metatake · https://metatake.net · [발신 이메일]

## §8 개정 이력
- **v1.2 (2026-07-18)**: §7.1 최종판 — 거절 리스크 진단표(추천 조항=최대 리스크·AI 표기=선제 분리·Pro=독립 데이터 방어)·신청 절차(이메일 창구·발신 주소·제목 규칙)·강화된 최종 문안(서면 약속 4항+투명성 문단). 발송일 기록 예정: ____
- **v1.1 (2026-07-18)**: 오너 결정 반영 — D1 왓챠 3단 안내 확정 · D3 KinoLights 포기 · D4 "출시 전 신청 OK, 지금 권장" 방침 + 신청 이메일 초안(§7.1).
- **v1.0 (2026-07-18)**: 최초 기획 확정 — 서비스 인터페이스 실사(웹 리서치 3레인: Letterboxd/IMDb·Netflix/왓챠/KinoLights·Trakt/TMDB/Simkl, 신뢰도 태그 포함), 원칙 3조, 커넥터 등급제(A자동/B파일/보류), 2왕복 iOS 동선·복귀 배너·클립보드 감지·IMDb 2단 큐, 병렬 임포트 극장+회고 소급, 상태 기계, 매칭·정규화 규칙, user_connections 아키텍처, I1~I4. 기존 /me/import 파이프라인(파서 4종·무손실 원장) 위의 증분임을 명시.
