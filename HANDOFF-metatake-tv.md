# HANDOFF — Metatake TV (페이스리스 영상 채널)

**이 문서가 정본(canonical)입니다.** Metatake TV 관련 작업을 이어받는 에이전트는 코드/디자인을 만지기 전에 이 문서를 먼저 읽으세요. 중복·누락·회귀를 막기 위한 단일 진입점입니다. 최종 갱신: 2026-07-09.

형제 체계: `HANDOFF-now-플레잉.md`(정본) — 이 채널이 영상으로 만드는 **텍스트 소스**(에디터 레터). 전략/포맷/크래프트 세부는 `hourly/tv/STRATEGY.md`.

---

## 1. 한 줄 정의와 현재 상태

metatake.net의 `/now` 에디터 레터(뉴스 스파이크 + 코퍼스 영화 1편 + 데이터 모듈)를 **페이스리스 영상**으로 만들어 유튜브 채널 "Metatake TV"에 자동 배포하는 체계. **드라마의 원천은 얼굴이 아니라 데이터의 반전** — 아카이브의 TakeScore·랭킹·13차원·리셉션 곡선·연결 그래프가 곧 반슬롭 해자다.

**현재 상태 (2026-07-09):**
- ✅ 전략 확정(컨셉·포맷·파이프라인·기술스택·플랫폼 리스크) — `hourly/tv/STRATEGY.md`
- ✅ **프로토타입 제작·배포·검수 완료** — 시네마틱 9:16 Short(마리 앙투아네트), 실제 영화 스틸 5컷·Didot·필름그레인. 라이브: **https://metatake.net/tv/marie-antoinette.html** (= `public/tv/marie-antoinette.html`). 이 HTML이 곧 **렌더 템플릿**.
- ⏳ **렌더+업로드 루프 미구현** — ffmpeg 설치 + TTS 선택 + 유튜브 OAuth 대기(오너 몫).
- ⏳ 유튜브 채널 미개설(오너 몫).

---

## 2. 파일 맵 (전부)

| 경로 | 역할 |
| :-- | :-- |
| `HANDOFF-metatake-tv.md` (루트) | **이 문서 — 정본 진입점** |
| `hourly/tv/STRATEGY.md` | 전략·포맷·크래프트 정본(2026 벤치마크·Short↔롱폼 결정 루브릭·SEO·반슬롭 표·파이프라인 다이어그램) |
| `hourly/tv/prototype-marie-antoinette.html` | 프로토타입/렌더 템플릿 소스(base64 스틸 임베드, ~924KB) |
| `public/tv/marie-antoinette.html` | **배포본**(위와 동일 내용, 정적 서빙). metatake.net/tv/…에서 라이브 |
| `hourly/tv/renders/` | (예정) 렌더 산출물 폴더 |
| `hourly/tv/script.py` · `voice.py` · `render.py` · `mux.py` · `upload.py` | **(미구현)** 렌더+업로드 파이프라인 — §5 |

프로토타입은 `_template.html`(토큰 `__IMG_*__`) + `/tmp/emb_*.jpg` 5컷을 파이썬 인젝터로 base64 치환해 생성했다. 이미지 재확보 방법은 §6-트랩 참조.

---

## 3. 확정된 결정 (decision log)

1. **원 퍼널, 두 포맷** — Short(20~45s, 세로) = 키워드 선점·발견 그물망; 롱폼(3~8분, 가로) = 논증형 테이크 + 수익화(8분↑ 미드롤). 롱폼 1편이 Short 3~5편을 파생. 100k 구독 전 믹스 3~5 Short/롱폼.
2. **데이터 반전 = 드라마 = 반슬롭 해자.** 소리치는 얼굴·리액션·"ending explained" 리캡 금지. 아카이브 고유 수치가 이야기.
3. **한 번에 숫자 하나** — 다이얼 카운트업·차트 드로우·막대 성장. 13차원 표 통째 노출 금지(2~3개만, 나머지는 링크).
4. **뮤트 우선 번인 가라오케 자막.** 60%+ 무음 시청.
5. **일관된 단일 뉴럴 보이스**(Kokoro). 플랫 TTS는 슬롭 신호.
6. **케이던스 <10/일, 큐레이트** — /now 1편당 자동 1영상 금지.
7. **Reddit 자동포스팅 금지**(프로젝트 상시 규칙).
8. **하드컷 전환**(크로스페이드 아님) — 몽타주 느낌 + 장면 겹침 버그 원천 차단.
9. **디스플레이 타이포 = Didot**(macOS 디도네; 맥 브라우저·렌더에서 실제 렌더).

## 3b. 프로토타입 장면 구성 (Episode 001 — Marie Antoinette 2006)

실제 아카이브 수치(2026-07-09 검증): TakeScore **53/100, 랭크 5,882/6,701**, form 65 / polarizing 62, 리셉션 2006(cold, NYT)→2013(landmark, Vulture), **Academy Award 의상상 2007**. 감독 Sofia Coppola. ⚠️ 칸에서 야유받았으나 **황금종려상 수상 아님**(리서치 예시의 "Palme d'Or"는 오류) — 진짜 아크는 야유→오스카→재평가.

| 장면 | 실제 스틸 | 데이터 |
| :-- | :-- | :-- |
| 1 훅(0–2.8s) | 부채 너머 눈 클로즈업 | "Booed at Cannes / Then it won an Oscar" (레터박스·훅) |
| 2 확립(2.8–8.5) | 파스텔 케이크(상징) | 로어서드 "Marie Antoinette · Sofia Coppola · 2006" |
| 3 TakeScore(8.5–17.5) | 베르사유 궁정(블루, 4K) | 다이얼 0→53 + 랭크 5,882/6,701 |
| 4 차원(17.5–25.5) | 촛불 파티(코이) | 막대 craft 65 / polarizing 62 + 고스트 차원 |
| 5 반전(25.5–33.5) | 호숫가 새벽 | 리셉션 곡선 2006(cold)→2013(landmark) 드로우 |
| 6 엔드카드(33.5–39) | 궁정(암전) | ✦ Academy Award 2007 / "The full record" / metatake.net |

## 4. 기술 스택 (~$0/영상)

| 단계 | 선택 | 비용 |
| :-- | :-- | :-- |
| 스크립트 | Fable 5가 /now 레터 → VO + 스토리보드 JSON | ~1–2¢ |
| 보이스 | **Kokoro-82M** 로컬 뉴럴 TTS(Apache-2.0), 단일 목소리 | $0(1회 설치) |
| 자막 | **우리 스크립트 타이밍에서** 생성 → whisper 불필요 | $0 |
| 비주얼 | **이 HTML 컴포지션**을 헤드리스 캡처(또는 Remotion) | $0 |
| 먹스 | ffmpeg: 프레임 + VO + 베드 → MP4 | $0 |
| 업로드 | YouTube Data API v3 `videos.insert`(1,600 유닛; 10k/일≈6업로드/일) | $0 |

## 5. 파이프라인 (구현 대상)

```
now_articles 행  ──►  tv/script.py   (Fable 5 → {vo_lines[], timings[], on_screen[], title, desc, tags})
                                          │
                       tv/voice.py    (Kokoro → voiceover.wav, 라인별 길이를 timings로 피드백)
                                          │
        tv/compose(=prototype html) + tv/render.py  (헤드리스 Chrome이 시간 지정으로 DOM을 N fps 캡처 → frames/)
                                          │
                        tv/mux.py     (ffmpeg: frames + voiceover.wav + bed.mp3 → out.mp4)
                                          │
                       tv/upload.py   (YouTube Data API v3 videos.insert, title/desc/tags)
                                          │
                   now_articles에 youtube_url 역기록 → /now/[slug] + film/director "In the news" 임베드
```

⚠️ **렌더는 시간을 명시적으로 구동**해야 한다(rAF에 의존 금지 — §6 트랩). `render.py`는 각 프레임에서 `__seek(t)` 같은 훅을 호출해 컴포지션을 t로 세팅 후 스크린샷. 프로토타입 JS에 이 훅을 노출하도록 소폭 개조 필요(현재는 rAF 자율 루프).

## 6. 불변식 & 트랩 (반드시 지킬 것)

- **불변식: 데이터는 아카이브 실측만.** 수치 날조 금지(예: 마리 앙투아네트 황금종려상 오류). Fable은 스크립트만, 채점/수치는 기존 DB(cinecodex_card RPC 등).
- **불변식: 장면 전환은 하드컷 + `visibility:hidden`.** opacity 크로스페이드는 겹침 버그 유발.
- **불변식: 데이터 위 텍스트는 강한 스크림 + text-shadow + 밝은 라벨.** 밝은 이미지 위 저대비 = 판독 실패(장면 4·6에서 실제 발생, 수정함).
- **트랩(외부 이미지 CSP):** 아티팩트/샌드박스는 외부 이미지(TMDB) 차단. **실제 스틸을 base64 data URI로 임베드**해 우회. TMDB 이미지 목록은 `TMDB_READ_TOKEN`(실은 **v3 api_key 32자** — `?api_key=`로 사용, Bearer 아님) → `/3/movie/{tmdb_id}/images`. `iso_639_1` 없는 clean 컷을 vote_count로 정렬해 선별. 배포본 크기 ~924KB 허용.
- **트랩(rAF 스로틀링):** 숨겨진/백그라운드 Chrome 탭은 `requestAnimationFrame`을 멈춤 → 프리뷰가 얼거나 장면이 점프. MCP로 검수할 땐 `window.requestAnimationFrame=()=>0`로 루프 정지 후 **강제 상태 주입(inline)**해 스크린샷(프리즌 탭은 CSS 트랜지션도 멈추므로 최종값을 inline으로 세팅). 참고 auto-memory: `hidden-tab-maplibre-testing`.
- **트랩(폰트):** Didot는 macOS 전용 — 비-맥 뷰어에선 폴백(Bodoni 72/Playfair/Georgia). 렌더는 맥에서 돌리므로 무관.
- **배포:** `public/tv/*.html`은 정적 서빙. **자동배포 워처(`auto-deploy-watch.sh`)는 app/components/lib만 스테이징** → `public/`은 수동 커밋+푸시 필요. 절차: `.autodeploy-off` 생성 → `git commit -- <경로>`(pathspec로 격리) → `git push origin main`(Vercel 배포 트리거) → `.autodeploy-off` 삭제. 같은 URL 갱신 = 같은 경로 재푸시. 참고 auto-memory: `autodeploy-watcher-scope`, `autodeploy-watcher-race`.

## 7. 플랫폼 리스크

유튜브 **2025-07-15 "inauthentic content"** 정책: 템플릿·로봇내레이션 슬롭은 수익화 불가, **채널 전체** 적용. 단 AI 금지 아님, 논평/변형 저작물은 보호. 우리 방어 = 명시 저자 + 논증형 테이크 + 아카이브 고유 데이터 + 합성 미디어 고지. 상세 반슬롭 표는 `hourly/tv/STRATEGY.md §7`.

## 8. 남은 일 / 오너 몫

- [ ] (오너) `brew install ffmpeg` — MP4 렌더 필수. ffmpeg·Pillow 미설치, node는 `~/.local/node/bin`.
- [ ] (오너) Metatake TV 유튜브 채널 개설 + Google Cloud 프로젝트 → OAuth 클라이언트(Data API v3). 에이전트 불가.
- [ ] (오너) 런칭 영화·케이던스·에피소드001 Short단독/Short+롱폼 확정.
- [ ] (에이전트, ffmpeg 후) `script.py→voice.py→render.py→mux.py→upload.py` 구현 + 프로토타입 JS에 `__seek(t)` 훅 노출.
- [ ] (에이전트) 비주얼 방향 오너 승인 대기 — 현재 프로토타입 룩 피드백 반영 지점.
