/** Korean UI dictionary — wave 1 of the locale projection.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §2.2)
 *
 *  CONTRACT
 *  - The key IS the English string as it appears in the code, byte for byte (P4).
 *    Change the English and the lookup misses: the page falls back to the new
 *    English and scripts/i18n-audit.mjs reports the string as untranslated. A
 *    stale translation can never outlive its source. Never "fix" a key to keep a
 *    translation alive.
 *  - A key ending in `<sep>context` (see ctxKey in ../index.ts) disambiguates a
 *    homograph — English collapses senses Korean splits.
 *  - This key set is the one every future language shares (dict/ja.ts, fr, es).
 *    i18n-audit reports parity gaps, so a key added here is a task there.
 *
 *  TONE — 평서형 간결체. Statements are plain and short; CTAs are noun-form
 *  ("보기", "더 보기"), never 합쇼체 sentences. Mirrors components/room/strings.ts
 *  (terse + honest) and the existing Korean essay surface
 *  (app/film/[slug]/[desk]/ko/page.tsx: "분 · 검증", "전체 보기").
 *
 *  NOT TRANSLATED (product vocabulary, work order §0 hard rule) — these never
 *  get an entry here, so t() falls through to English by design:
 *    Metatake · Metatake TV · TakeScore · Strong Misreadings · Embedding Fantasia
 *    Engine Room · Curious · The Daily · Now Playing · NAV · WWI · Tier · V/C/R/U
 */

export const KO: Record<string, string> = {
  // ──────────────────────────────────────────────────────────────────────────
  // CORE VOCABULARY — the site's axis (work order §2.2.1, owner-approval gate).
  // Every other string in this file is longtail and needs no sign-off; these ~50
  // are the nouns the whole projection is built on. Changing one later is a
  // one-line edit here — that is the entire cost, by design.
  // ──────────────────────────────────────────────────────────────────────────

  // Nav groups (components/home2/Nav.tsx buildGroups — companion IA, 전환마스터 §3).
  // Old group keys (Watch/Wander/Read/Theory/Patterns/You) removed 2026-07-24:
  // no t()/tr() call site uses those bare words (verified by grep).
  Tonight: "오늘 밤",
  "My Cinema": "마이 시네마",
  "Go Deeper": "더 깊이",
  News: "뉴스",

  // Nav group one-line descriptors (user-value language — never "the AI")
  "What to watch tonight — scored for cinephiles, filtered to your services.": "오늘 밤 볼 영화 — 시네필 기준 점수로, 내 서비스에 맞춰.",
  "Your watching life — mapped, scored, remembered.": "당신의 영화 생활 — 지도로, 점수로, 기록으로.",
  "Every film and director, in depth.": "모든 영화와 감독을, 깊이 있게.",
  "After you watch — meaning, places, patterns, theory.": "보고 난 뒤 — 의미·장소·패턴·이론.",
  "What's happening in film, right now.": "지금 영화계에서 일어나는 일.",
  "Get the app": "앱 받기",

  // Nav items — functional names get a Korean name; brand marks stay English.
  Films: "영화",
  Directors: "감독",
  Latest: "최신",
  Trending: "인기",
  "What to Watch": "뭘 볼까",
  Lineage: "계보",
  Locations: "촬영지",
  Movements: "사조",
  Connections: "연결",
  "Where to watch": "볼 수 있는 곳",
  Credits: "크레딧",
  Updates: "새소식",
  Newsletter: "뉴스레터",
  Concepts: "개념",
  Theorists: "이론가",
  Traditions: "학파", // 용어 헌장: Tradition = 학파 (a school), not 전통
  Methodology: "방법론",
  Tropes: "트로프",
  Archetypes: "원형",
  "My Room": "마이룸",
  "The Navigator": "내비게이터",
  "Import your films": "내 영화 가져오기",
  Settings: "설정",
  "Sign in": "로그인",
  "Create account": "회원가입",
  Menu: "메뉴",
  Room: "룸",

  // Film page sections / tabs
  Digest: "요약",
  Invitation: "초대",
  "Why watch": "볼 이유",
  Reception: "평단의 기록",
  "Recommended by": "추천한 사람",
  Afterlife: "그 이후",
  Gallery: "갤러리",
  Figures: "피겨",
  Archetype: "원형",
  "In the news": "뉴스 속에서",
  "Watch next": "다음에 볼 영화",
  "Films like": "비슷한 영화",
  Counterpoints: "반론",
  "Filming locations": "촬영지",
  "Standing & honors": "위상과 수상",
  "Strong misreadings": "강한 오독",
  "Kindred films": "닮은 영화",

  // Figure kinds (KIND_LABEL) — "Locations" here means places inside the film,
  // not the filming-locations corner, hence the context qualifier.
  Characters: "인물",
  "Objects & symbols": "사물과 상징",
  "Locations##figure-kind": "장소",
  "Form & technique": "형식과 기법",
  "Themes & motifs": "주제와 모티프",
  Title: "제목",
  "The film itself": "영화 자체",

  // ──────────────────────────────────────────────────────────────────────────
  // LONGTAIL — added as each surface is localized. No sign-off needed.
  // ──────────────────────────────────────────────────────────────────────────

  // Why-watch lens titles (WW_TITLE)
  "The auteur's vision": "작가의 비전",
  "Aesthetic innovation": "미학적 혁신",
  "Technical mastery": "기술적 완성도",
  "Philosophical inquiry": "철학적 탐구",
  "Cinematic lineage": "영화적 계보",
  "Space & place": "공간과 장소",
  "Critical reception": "비평적 수용",
  "Context & discourse": "맥락과 담론",

  // Film hero / crumb / synopsis
  "Plot overview (TMDB)": "줄거리 (TMDB)",
  "{title} — stills": "{title} — 스틸",
  "{title} backdrop": "{title} 배경 이미지",
  "{title} poster": "{title} 포스터",

  // Tier-2 digest chips
  "Prestige {n}": "위상 {n}",
  "Discovery {n}": "발견 {n}",
  "Prestige — the film's standing in the canon, on Metatake's scoring":
    "위상 — Metatake 채점 기준으로 이 영화가 정전에서 차지하는 자리",
  "Discovery — under-seen value relative to that standing":
    "발견 — 그 위상에 비해 덜 알려진 가치",

  // Credits section
  "Credits — who made {title}?": "크레딧 — {title}는 누가 만들었나",
  "One panel per craft — the face, the whole career, and which meeting with the director this film was. Every panel opens the person's own file.":
    "직군마다 한 칸 — 얼굴, 이력 전체, 그리고 이 영화가 감독과의 몇 번째 만남이었는지. 각 칸은 그 사람의 문서로 이어진다.",
  Director: "감독",

  // Explore-from-here (Tier-2)
  "Explore from here": "여기서 더 보기",
  "Director: {name}": "감독: {name}",
  "Full credits": "전체 크레딧",
  "Full credits — {name}": "전체 크레딧 — {name}",
  "Find similar: search “{title}” →": "비슷한 영화 찾기: “{title}” 검색 →",

  // Invitation (Tier-1)
  "An invitation to {title}": "{title}로의 초대",
  "Spoiler-free": "스포일러 없음",
  "The readings below do not hold back.": "아래 리딩부터는 스포일러가 있다.",
  Editor: "편집자",

  // Why watch (Tier-1)
  "Why watch {title}?": "{title}를 볼 이유",
  "The case in one read: Why should you watch {title}? →":
    "한 편으로 읽는 이유: {title}를 왜 봐야 하나 →",

  // Locations (Tier-1/Tier-2)
  "{title} — on the map": "{title} — 지도 위에서",
  "Where was {title} filmed? All {n} locations, with the scene each one carries →":
    "{title}는 어디서 찍었나? 촬영지 {n}곳 전부와 각 장소가 담은 장면 →",

  // Strong misreadings
  "Strong Misreadings of {title}": "{title}의 Strong Misreadings",
  "The leap": "도약",

  // Figures
  "The characters, objects, places, forms and motifs Metatake singled out in {title} — each the anchor for one or more strong misreadings.":
    "Metatake가 {title}에서 짚어낸 인물·사물·장소·형식·모티프 — 각각이 하나 이상의 강한 오독을 붙드는 닻이다.",
  "{n} reading": "리딩 {n}개",
  "{n} readings": "리딩 {n}개",
  "Open →": "열기 →",

  // Connection map
  "{title} — connection map": "{title} — 연결 지도",
  "Where {title} sits in Metatake's critical web of cinema — its figures, the tropes and ideas they carry, its director, and the films nearest by shared reading. Click any node to open it.":
    "{title}가 Metatake의 비평적 그물망에서 놓인 자리 — 이 영화의 피겨, 그것이 나르는 트로프와 관념, 감독, 그리고 리딩을 공유하는 가장 가까운 영화들. 아무 노드나 눌러 열면 된다.",

  // Tropes / Archetype
  "Cross-film types {title} instantiates — shared under Tropes. Via = the figure that carries it.":
    "{title}가 구현하는, 영화를 가로지르는 유형 — Tropes에서 공유된다. Via = 그것을 나르는 피겨.",
  "What {title}'s figures are — their catalog classification, each linking into the Archetype catalog. Via = the figure that carries it.":
    "{title}의 피겨가 무엇인지 — 카탈로그 분류이며, 각각 원형 카탈로그로 이어진다. Via = 그것을 나르는 피겨.",
  via: "via",
  reading: "리딩",

  // Curious
  "The questions viewers keep asking about {title} — answered in full on Curious, the Metatake question desk. Spoiler-heavy titles are masked.":
    "관객이 {title}에 대해 계속 묻는 질문들 — Metatake의 질문 데스크 Curious에서 전문으로 답한다. 결말을 건드리는 제목은 가려 둔다.",
  question: "질문",
  " · discusses the ending": " · 결말을 다룬다",
  "{label} · from the desks": "{label} · 데스크에서",

  // The Daily
  "When the news rhymed with {title} — editions of Between Film and the World, Metatake's daily, that filed this film against the day's events.":
    "뉴스가 {title}와 운을 맞춘 날 — 이 영화를 그날의 사건과 나란히 놓은 Metatake의 일간지 Between Film and the World의 판본들.",

  // Watch next
  "Where to go after {title} — nine films that continue its conversation, each chosen for a specific bridge. Argued by Metatake AI — a reason for each pick, not a distance score.":
    "{title} 다음에 갈 곳 — 그 대화를 이어가는 영화 아홉 편. 각각 뚜렷한 다리 하나를 보고 골랐다. Metatake AI가 픽마다 이유를 논증한다 — 거리 점수가 아니다.",
  "not yet on Metatake · TMDB ↗": "아직 Metatake에 없음 · TMDB ↗",

  // Connected / counterpoints
  "The 5 films most connected to {title}": "{title}와 가장 많이 연결된 영화 5편",
  "full ranking →": "전체 순위 →",
  "Nearest neighbours in meaning-space, ranked by shared tropes and taste-vector proximity.":
    "의미 공간에서 가장 가까운 이웃들. 공유하는 트로프와 취향 벡터의 거리로 매긴 순위.",
  "How connections are computed →": "연결을 계산하는 방법 →",
  "taste match {n}%": "취향 일치 {n}%",

  // English-original affordance (work order §1.1 decision ②) — the label that
  // marks a block left in English on purpose.
  "English original": "영어 원문",
  "This section is in English — your browser can translate it.":
    "이 대목은 영어다. 브라우저 번역으로 읽을 수 있다.",

  // Metadata (title/description templates — §6.4)
  "Cast, Where to Watch & Context": "출연·볼 곳·배경",
  "Analysis, Themes & Symbols": "분석·주제·상징",
  "directed by {name}": "{name} 감독",
  " Cast, context and where to watch on Metatake.":
    " 출연·배경·볼 수 있는 곳을 Metatake에서.",
  "{title} read closely: {figures} figures and {misreadings} strong misreadings across 14 critical frameworks.":
    "{title} 깊이 읽기: 피겨 {figures}개와 14개 비평 프레임워크를 가로지르는 강한 오독 {misreadings}편.",
  " {figures} figures · {misreadings} readings inside.":
    " 안에 피겨 {figures}개 · 리딩 {misreadings}편.",

  // Tier-2 catalog record — digest heading, footer, atlas intros
  "The Metatake record on {title}": "{title}에 대한 Metatake 기록",
  "Compiled from the Metatake database": "Metatake 데이터베이스에서 편찬",
  "Edited by": "편집",
  "Record updated {date}": "기록 갱신 {date}",
  "Real places {title} was filmed at or names — including {places}. Each pin opens what the place means in the film.":
    "{title}가 촬영했거나 언급하는 실제 장소 — {places} 등. 각 핀은 그 장소가 영화에서 뜻하는 바를 연다.",
  "The real places {title} is set in, was filmed at, or names — geolocated on Metatake's location map.":
    "{title}의 배경이거나, 촬영지이거나, 극 중 언급되는 실제 장소들 — Metatake 촬영지 지도에 좌표로 표시했다.",

  // Tier-1 render body — why-watch, misreadings, tropes, curious, connected, counterpoints
  "A spoiler-free brief on what {title} offers — the director's vision, its craft and ideas, its space and its place in film history. Written by Metatake AI, to a framework by":
    "{title}가 무엇을 주는지 스포일러 없이 정리한 브리핑 — 감독의 비전, 그 기법과 관념, 공간, 그리고 영화사에서의 자리. Metatake AI가 집필했다 — 프레임워크 설계:",
  " — not aggregated from reviews.": " · 리뷰를 모은 것이 아니다.",
  "Written by Metatake AI · to a framework by": "집필 Metatake AI · 프레임워크 설계",
  "{n} original critical readings of {title}, filed across 14":
    "{title}에 대한 독창적 비평 리딩 {n}편, 14개 프레임워크에 걸쳐",
  frameworks: "프레임워크",
  "— each one an argument with a thesis, a deliberate over-reading rather than a summary. Written by Metatake AI, to a framework by":
    "— 각각 논지를 가진 하나의 주장이며, 요약이 아니라 의도된 과잉 독해다. Metatake AI 집필 — 프레임워크 설계:",
  "Also readable as one piece:": "한 편으로도 읽을 수 있다:",
  "the full misreadings article →": "전체 오독 기사 →",
  are: "인가",
  "— their catalog classification, each linking into the": "— 그 카탈로그 분류이며, 각각",
  "catalog.": "원형 카탈로그로 이어진다.",
  "🎬 Movies like {title} →": "🎬 {title}와 비슷한 영화 →",
  "Computed by Metatake AI's connection engine · method designed by":
    "Metatake AI 연결 엔진이 계산 · 방법 설계:",
  "Updated {date}": "갱신 {date}",
  "{n} shared tropes": "공유 트로프 {n}개",
  "taste neighbour": "취향 이웃",
  "not yet on Metatake ·": "아직 Metatake에 없음 ·",
  "Counterpoints — same shape, opposite meaning": "반론 — 같은 형태, 반대의 의미",
  "Films that stage one of": "다음의 트로프를 무대에 올리되 결을 거슬러 읽는 영화들:",
  "'s own tropes but read it against the grain. Kinship maps can find lookalikes; only a reading-level graph can find arguments. Found by Metatake AI in the readings it wrote — same trope, opposite argument.":
    ". 유사성 지도는 닮은꼴을 찾지만, 리딩 수준의 그래프만이 논증을 찾아낸다. Metatake AI가 자신이 쓴 리딩들 속에서 찾아낸다 — 같은 트로프, 반대의 논지.",
  vs: "vs",
  "readings diverge {n}%": "리딩 격차 {n}%",
  "stages it straight": "곧이곧대로 무대에 올린다",
  "reads it against the grain": "결을 거슬러 읽는다",
  "readings diverge N% = distance between the two films' reading vectors on the shared trope (100% = opposite readings). Computed by Metatake AI's connection engine · method designed by":
    "리딩 격차 N% = 공유 트로프에서 두 영화의 리딩 벡터 사이 거리 (100% = 정반대 리딩). Metatake AI 연결 엔진이 계산 · 방법 설계:",
  "How it works →": "작동 방식 →",

  // Locale suggest banner (§7)
  "Read this page in {language} →": "이 페이지를 {language}로 보기 →",
  Dismiss: "닫기",

  // ── Footer ──
  "Read films closely — a critical map of cinema that links films through the meanings they share.":
    "영화를 깊이 읽는다 — 영화들이 공유하는 의미로 서로를 잇는 비평 지도.",
  Sections: "섹션",
  "For AI & developers": "AI·개발자용",
  "MCP for AI": "AI용 MCP",
  "API & embeds": "API·임베드",
  "Open data": "오픈 데이터",
  "Partner with us": "제휴 문의",
  About: "소개",
  Contact: "연락처",
  "Community guidelines": "커뮤니티 가이드라인",
  Legal: "법적 고지",
  Terms: "이용약관",
  Privacy: "개인정보",
  "This product uses the TMDB API but is not endorsed or certified by TMDB.":
    "이 제품은 TMDB API를 사용하지만 TMDB의 보증이나 인증을 받은 것은 아닙니다.",
  "Metatake's original writing — readings, TakeScores, and essays — is licensed":
    "Metatake의 독자적 글 — 리딩·TakeScore·에세이 — 은 다음 라이선스를 따릅니다:",
  ": quote and reuse it freely with attribution to Metatake and a link back; not for commercial use.":
    " — Metatake 출처 표기와 링크를 달면 자유롭게 인용·재사용할 수 있으나, 상업적 용도는 불가합니다.",
  "All rights reserved.": "모든 권리 보유.",
  "Seoul, Republic of Korea": "대한민국 서울",

  // ── Director page ──
  "Films, Style & Where to Start": "영화·스타일·어디서 시작할까",
  Readings: "리딩",
  "Add to favorites": "즐겨찾기 추가",
  Favorite: "즐겨찾기됨",
  "Born {date}": "출생 {date}",
  "The picks:": "고른 작품:",
  Filmography: "필모그래피",
  "Every {director} film on Metatake, oldest first — {n} read closely{more}.":
    "Metatake에 있는 {director} 영화 전부, 오래된 순 — {n}편을 깊이 읽었다{more}.",
  ", plus {n} more in the catalog": ", 카탈로그에 {n}편 더",
  "{n} carry a": "그중 {n}편에는",
  "— the boxed numbers are Value, Cost and Risk behind the headline score.":
    "TakeScore가 붙는다 — 상자 안 숫자는 대표 점수 뒤의 가치·비용·위험이다.",
  "{n} are streaming somewhere right now — each film's page lists where.":
    "그중 {n}편은 지금 어딘가에서 스트리밍 중이다 — 각 영화 페이지에 어디인지 나온다.",
  "Strong Misreadings {n}": "Strong Misreadings {n}편",
  "In the catalog": "카탈로그에 있음",
  "not yet scored": "아직 채점 안 됨",
  "Filmography & images via TMDB; readings & TakeScores computed from the Metatake corpus.":
    "필모그래피·이미지는 TMDB; 리딩·TakeScore는 Metatake 코퍼스에서 계산.",
  "{n} bold readings across {director}'s films — here are the strongest, at most two per film.":
    "{director}의 영화들을 가로지르는 대담한 리딩 {n}편 — 가장 강한 것들을, 영화당 최대 두 편.",
  "The complete set is": "전체 세트는",
  "on its own page": "별도 페이지에",
  "Open a film for its full set.": "전체를 보려면 영화를 열어라.",
  "Figure-types {director} returns to — computed across the filmography.":
    "{director}가 되풀이하는 피겨 유형 — 필모그래피 전반에서 계산.",
  "All tropes →": "모든 트로프 →",
  "The name": "이름",
  "Open the life": "생애 열기",
  "Each fact is written freely, then verified against a live web source (English & native-language). Source link per fact.":
    "각 사실은 자유롭게 서술한 뒤 실시간 웹 출처(영어·현지어)로 검증한다. 사실마다 출처 링크.",
  "Who's Next": "다음은 누구",
  "Pointed to from:": "여기서 가리킴:",
  "Open the kinships": "친연 열기",
  "The records — across the filmography": "기록 — 필모그래피 전반",
  "Open the ranking": "순위 열기",
  "Open the record": "기록 열기",
  "Open the reception": "평단의 기록 열기",
  "Open the lenses": "렌즈 열기",
  "Open all readings": "모든 리딩 열기",
  "Shot and set in:": "촬영·배경 장소:",
  "Open the locations article": "촬영지 기사 열기",
  "The Metatake selection": "Metatake 선정",
  "Director fingerprint computed from the live corpus — signatures recur across two or more films. The complete filmography, with TakeScores, is above.":
    "실시간 코퍼스에서 계산한 감독 지문 — 서명적 특징이 두 편 이상에서 되풀이된다. TakeScore가 붙은 전체 필모그래피는 위에 있다.",
  "Where to Start": "어디서 시작할까",
  "Open the route": "경로 열기",
  "See the crew page →": "크루 페이지 보기 →",
  "Loading the map…": "지도 불러오는 중…",
  "— a Metatake Portrait": "— Metatake 인물기",
  "on Metatake": "— Metatake",
  "A Metatake editorial summary, computed from the live corpus — the full portrait is being written.":
    "실시간 코퍼스에서 계산한 Metatake 편집 요약 — 전체 인물기는 집필 중이다.",

  // ── Where-to-watch (AccessSummary) ──
  "Where to watch — {title}": "볼 수 있는 곳 — {title}",
  "See the full where-to-watch guide →": "전체 시청 가이드 보기 →",
  // Tier words
  Free: "무료",
  Library: "도서관",
  Streaming: "스트리밍",
  Rent: "대여",
  Buy: "구매",
  "Not yet": "아직 없음",
  // Headlines (Korean puts the state after the platform/region)
  "Free on {platform} — available worldwide.": "{platform}에서 무료 — 전 세계 시청 가능.",
  "In {region}: free on {platforms}.": "{region}: {platforms}에서 무료.",
  "In {region}: free on {platforms}{ads}.": "{region}: {platforms}에서 무료{ads}.",
  " (with ads)": " (광고 포함)",
  "In {region}: free on {platforms} with a library card.": "{region}: 도서관 카드로 {platforms}에서 무료.",
  "In {region}: streaming on {platforms}{more}.": "{region}: {platforms}에서 스트리밍{more}.",
  "In {region}: available to rent on {platforms} — verified by MetaTake.":
    "{region}: {platforms}에서 대여 가능 — MetaTake 검증.",
  "In {region}: streaming on {platforms} — verified by MetaTake.":
    "{region}: {platforms}에서 스트리밍 — MetaTake 검증.",
  "In {region}: available to rent ({platforms}{more}).": "{region}: 대여 가능 ({platforms}{more}).",
  "In {region}: available to buy only ({platforms}).": "{region}: 구매만 가능 ({platforms}).",
  "and more": "외",
  // Fingerprint
  "free on {platform} ({region}){extra}": "{platform}에서 무료 ({region}){extra}",
  "free in {n}": "{n}개국 무료",
  "streaming in {n}": "{n}개국 스트리밍",
  "rent in {n}": "{n}개국 대여",
  "buy in {n}": "{n}개국 구매",
  "not yet in {n}": "{n}개국 아직 없음",
  "{breakdown} — across {n} regions.": "{breakdown} — {n}개 지역 기준.",

  // ── Reception (FilmReceptionSection) — chrome only; quotes stay English ──
  "Reception — what was written": "평단의 기록 — 무엇이 쓰였나",
  "What critics and scholars have written about {title} — each headline links to the source; quotes are verbatim from publishers' own link previews and paper abstracts.":
    "비평가와 학자들이 {title}에 대해 쓴 것 — 각 헤드라인은 출처로 이어지고, 인용은 발행처의 링크 미리보기와 논문 초록에서 그대로 가져왔다.",
  "{n} reviews": "리뷰 {n}편",
  "{n} outlets": "매체 {n}곳",
  "{n} papers": "논문 {n}편",
  "{n} venues": "학술지 {n}곳",
  Reviews: "리뷰",
  Scholarship: "학술",
  "Releases & revivals": "개봉·재개봉",
  Honors: "수상",
  "Years covered": "다룬 연도",
  "The full timeline": "전체 연대기",
  "What critics said about {title} — and everything since, year by year":
    "비평가들이 {title}에 대해 한 말 — 그리고 그 이후 전부, 해마다",
  "The scholarship on {title} — and everything since, year by year":
    "{title}에 관한 학술 — 그리고 그 이후 전부, 해마다",
  "Headlines & quotes from publishers' link previews (og:description) and paper abstracts (OpenAlex/Crossref). No article text is stored.":
    "발행처 링크 미리보기(og:description)와 논문 초록(OpenAlex/Crossref)에서 가져온 헤드라인·인용. 기사 본문은 저장하지 않는다.",

  // ── Film locations (/ko/film/locations/[slug]) — chrome; place names stay English ──
  "Where Was {title} Filmed?": "{title}는 어디서 찍었나?",
  "{n} Locations, Mapped": "촬영지 {n}곳, 지도로",
  "On Location": "촬영 현장",
  "fact-checked & mapped": "사실 검증·지도화",
  "{n} places": "{n}곳",
  "see the map ↓": "지도 보기 ↓",
  "data updated {date}": "데이터 갱신 {date}",
  "Where was {title} filmed?": "{title}는 어디서 찍었나?",
  "Filmed locations — {n} places": "촬영지 — {n}곳",
  "Where the cameras actually stood, from exact addresses down to city level.":
    "카메라가 실제로 놓였던 곳 — 정확한 주소부터 도시 단위까지.",
  "The world it pretends to be": "영화가 자처하는 세계",
  "Places the story claims as its world — distinct from where the cameras stood.":
    "이야기가 자신의 세계라 주장하는 장소들 — 카메라가 선 곳과는 별개다.",
  "{title} — every location on the map": "{title} — 모든 촬영지를 지도에",
  "The same {n} places, live. Click a pin to read what it means in the film.":
    "같은 {n}곳, 실시간. 핀을 눌러 영화에서 그곳이 뜻하는 바를 읽어라.",
  "Keep reading": "이어 읽기",
  "{title} — analysis, themes & symbols →": "{title} — 분석·주제·상징 →",
  "Where does {director} film? Every location across the filmography →":
    "{director}는 어디서 찍나? 필모그래피 전체 촬영지 →",
  "Movies filmed in {country} →": "{country}에서 촬영된 영화 →",
  "The world map of cinema — every country, one map →": "영화의 세계 지도 — 모든 나라, 하나의 지도 →",
  "Read the full methodology →": "전체 방법론 보기 →",
  "Search Metatake": "Metatake 검색",
  "Search all of Metatake…": "Metatake 전체 검색…",
  "Create account · what you get": "회원가입 · 혜택 보기",
  "Signed in · My Room →": "로그인됨 · 마이룸 →",

  // ── Section components (parallel-localized) ──
  "Sequential navigation": "순차 탐색",
  "‹ Prev": "‹ 이전",
  "Index": "목록",
  "Next ›": "다음 ›",
  "Films whose viewers Metatake points toward {title} — these {n} films name it among their nine “Watch next” picks.": "Metatake가 관객을 {title}로 이끄는 영화 — 이 {n}편이 자신의 아홉 편 “Watch next” 추천 목록에 이 작품을 올렸다.",
  "Share": "공유",
  "Share {title}": "{title} 공유",
  "Share on {channel}": "{channel}에 공유",
  "Copy link": "링크 복사",
  "Copied": "복사됨",
  "More share options": "공유 옵션 더보기",
  "Share and save": "공유 및 저장",
  "Close": "닫기",
  "Quick answers": "빠른 답변",
  "More →": "더 보기 →",
  "Why {title} is in the index": "{title}이(가) 인덱스에 오른 이유",
  "Read the full letter on the appraisal page →": "감정 페이지에서 편지 전문 읽기 →",
  "Recommended into the Metatake index · {date}": "Metatake 인덱스에 추천 등재 · {date}",
  // to.W sign row, second line. The sender line above it ("from. Metatake AI
  // Editorial") is brand vocabulary and stays English by design (§0 hard rule).
  // "감독" alone would collide with this site's own nav vocabulary — Directors:
  // Was "방법론 감독". Dropped 2026-08-03 with the English: on a film site "감독"
  // is already spoken for, and the page shows "{name} 감독" for the actual
  // director a few lines away. "설계" says what he did without the collision.
  "to a framework by W. Yoon": "프레임워크 설계 W. Yoon",
  "Wonwoo Yoon — Metatake editor": "Wonwoo Yoon — Metatake 편집자",
  "Wonwoo Yoon, Metatake editor — view profile": "Wonwoo Yoon, Metatake 편집자 — 프로필 보기",
  "A curator's note on {title}'s place in the Metatake index — drawn from the catalog's curation records, and kept separate from the TakeScore appraisal above.": "Metatake 인덱스에서 {title}의 위치에 관한 큐레이터의 노트 — 카탈로그의 큐레이션 기록에서 뽑았으며, 위의 TakeScore 감정과는 별개다.",
  "View larger — {cap}": "크게 보기 — {cap}",
  "Shown with {topic} — an illustrative still, not necessarily a scene about it.": "{topic}과(와) 함께 실린 예시 스틸로, 반드시 그 주제를 다룬 장면은 아니다.",
  "Previous": "이전",
  "Next": "다음",
  " — shown with {topic}, an illustrative still, not necessarily a scene about it": " — {topic}과(와) 함께 실린 예시 스틸로, 반드시 그 주제를 다룬 장면은 아니다",
  "Sections on this page": "이 페이지의 섹션",
  "before you watch": "보기 전",
  "Spoilers": "스포일러",
  "after you watch": "본 후",
  "Search this page…": "이 페이지 검색…",
  "Search this page": "이 페이지 검색",
  "What has {name} directed — and with whom?": "{name}은 무엇을 감독했나 — 그리고 누구와?",
  "The director of {title}: {count} directing credits since {year}": "{title}의 감독: {year}년 이후 감독작 {count}편",
  " — {title} was the {ord} of them": " — {title}은 그중 {ord}번째",
  "Open the file →": "파일 열기 →",
  "What has {name} {verbed} — and with whom?": "{name}은 무엇을 {verbed}했나 — 그리고 누구와?",
  "The {role} of {title} — {films} {verbed}": "{title}의 {role} — {films} {verbed}",
  "{count} films": "{count}편",
  " since {year}": " {year}년부터",
  "the {ord}": "{ord}번째",
  "one": "하나",
  "; the only one with {name}": "; {name}과 함께한 유일한 작품",
  "; {pos} of {count} with {name}": "; {name}과 함께한 {count}편 중 {pos}",
  "Who made {title}? — every meeting, counted →": "{title}을 만든 사람들 — 모든 만남을 헤아리다 →",
  "written": "집필",
  "shot": "촬영",
  "cut": "편집",
  "scored": "작곡",
  "designed": "디자인",
  "made": "제작",
  "writer": "각본가",
  "cinematographer": "촬영감독",
  "editor": "편집자",
  "composer": "음악감독",
  "production designer": "프로덕션 디자이너",
  "Generated by the ": "생성 방법: ",
  " editorial method": " 편집 방식",
  "created {c}": "{c} 작성",
  "updated {u}": "{u} 수정",
  "editorial desk led by ": "편집 데스크 총괄 ",
  "how this is made": "제작 방식 안내",
  "Drafted by": "작성:",
  "to a framework by": "프레임워크 설계:",
  ", who answers for it": " · 최종 책임",
  "updated": "업데이트",
  "{n} wins": "{n}회 수상",
  "{n} nominations": "{n}회 후보",
  "comes out of {origin}": "{origin}에서 나왔다",
  "carries {honors}": "{honors}을 기록했다",
  "is cited in {n} canons": "{n}개 정전에 이름을 올렸다",
  "extends its director's auteur line": "감독의 작가 계보를 잇는다",
  "extends {n} auteur lines": "{n}개의 작가 계보를 잇는다",
  "— a record spanning {y0}–{y1}": "— {y0}–{y1}에 걸친 기록",
  "of {max}": "/ {max}",
  "{type} work": "{type} 작품",
  "defining & recent": "대표작 & 최근작",
  "Lineage — the record": "계보 — 기록",
  "{n} canon appearances": "정전 {n}회 등재",
  "auteur line ×{n}": "작가 계보 ×{n}",
  "{n} lists": "{n}개 리스트",
  "National cinema & movements": "국가 영화 & 사조",
  "What critics said": "비평가들의 평",
  "Awards & honours": "수상 & 영예",
  "Canons & rankings": "정전 & 순위",
  "National canons": "국가 정전",
  "Auteur lineage": "작가 계보",
  "The complete record": "전체 기록",
  "Every award, canon and ranking {title} holds — sourced per entry": "{title}이 보유한 모든 수상·정전·순위 — 항목별 출처 표기",
  "Wins": "수상",
  "Nominations": "후보",
  "Canon appearances": "정전 등재",
  "Auteur line": "작가 계보",
  "Lists cited": "인용된 리스트",
  "Reviews & afterlife": "리뷰 & 이후",
  "Open the timeline": "타임라인 열기",
  "Sources for this record": "이 기록의 출처",
  "Origin": "출신",
  "public records and critics’ polls": "공개 기록과 비평가 투표",
  "Canon": "정전",
  "institutional & critics’ polls": "기관 & 비평가 투표",
  "Movements & auteur line": "사조 & 작가 계보",
  "auteur rosters": "작가 명부",
  "Cognitive": "인지",
  "Affective": "정서",
  "Formal": "형식",
  "Moral": "윤리",
  "Durability": "지속성",
  "Intertextual": "상호텍스트",
  "Formal radicalism": "형식적 급진성",
  "Extratextual": "텍스트 외적",
  "Auteur oeuvre": "작가 전작",
  // Same dimension as "Hollowness" below (registry key `bank`); CinecodexPanel
  // keeps "Bankruptcy" as its historical label. The identical Korean is correct.
  "Bankruptcy": "공허함",
  "Insincerity": "불성실",
  // NOT "비겁". The registry defines this dimension as "Which films pander —
  // commercial compromise, emotional exploitation?", scaling to "cynical,
  // manipulative, soulless" (lib/cinecodex_dims.ts, key `coward`). That is
  // pandering, not timidity; "비겁" read as a moral slur about the filmmakers.
  "Cowardice": "영합",
  "Polarization": "양극화",
  "Hollowness": "공허함",
  "Faint traces": "희미한 흔적",
  "Fair returns": "무난한 수확",
  "Solid, not peak": "견고하나 정점은 아님",
  "Strong, lasting": "강하고 오래감",
  "Exceptional — canon-grade": "탁월 — 정전급",
  "Walk right in": "바로 입장 가능",
  "Some homework": "약간의 사전학습",
  "Real preparation": "실질적 준비 필요",
  "Advanced viewing": "상급 관람",
  "Expert terrain": "전문가 영역",
  "Nearly riskless": "거의 무위험",
  "Low downside": "낮은 하방",
  "Some hazard": "약간의 위험",
  "High letdown risk": "높은 실망 위험",
  "Severe — a gamble": "심각 — 도박",
  "What is {label}? — full explanation and ranking": "{label}(이)란? — 전체 설명과 순위",
  "Hidden gem": "숨은 보석",
  "Consensus classic": "합의된 고전",
  "Popular, lighter harvest": "인기작, 가벼운 수확",
  "A quiet minor work": "조용한 소품",
  "Under-seen for its value": "가치에 비해 덜 알려짐",
  "Loved beyond its durable value": "지속가치 이상으로 사랑받음",
  "Value and reach aligned": "가치와 도달이 일치",
  "{title} holds durable value {val} well above its audience reach {pop} — a cinephile's find.": "{title}은(는) 지속가치 {val}로 관객 도달 {pop}을 크게 웃돈다 — 시네필의 발견.",
  "{title} is widely seen and it holds up — value {val}, reach {pop}.": "{title}은(는) 널리 관람되며 잘 버틴다 — 가치 {val}, 도달 {pop}.",
  "{title} is enjoyed widely (reach {pop}) but holds less durable value ({val}) to re-mine.": "{title}은(는) 널리 즐겨지지만(도달 {pop}) 다시 캘 지속가치는 적다({val}).",
  "{title} pairs modest reach ({pop}) with a modest durable payoff ({val}).": "{title}은(는) 수수한 도달({pop})과 수수한 지속 성과({val})를 짝짓는다.",
  "{title}'s durable value {val} outruns its audience reach {pop}.": "{title}의 지속가치 {val}가 관객 도달 {pop}을 앞선다.",
  "{title}'s audience reach {pop} outruns its durable value {val}.": "{title}의 관객 도달 {pop}이 지속가치 {val}를 앞선다.",
  "{title}'s durable value {val} and audience reach {pop} track closely.": "{title}의 지속가치 {val}와 관객 도달 {pop}이 근접하게 움직인다.",
  "Value × Popularity": "가치 × 인기",
  "Popular · lighter": "인기 · 가벼움",
  "Minor": "소품",
  "Popularity — audience reach →": "인기 — 관객 도달 →",
  "Durable value →": "지속가치 →",
  "our Value": "우리의 가치",
  "audience reach": "관객 도달",
  "The gap is the point — our durable Value versus the crowd’s attention. Never blended into the score.": "격차가 핵심 — 대중의 관심에 대비한 우리의 지속가치. 점수에 결코 섞이지 않음.",
  "grounded in {takes} critical takes we hold on this film": "우리가 이 영화에 대해 보유한 비평 테이크 {takes}건에 근거",
  "no written-criticism corpus yet on this film": "이 영화에 대한 비평 코퍼스는 아직 없음",
  "top {pct}%": "상위 {pct}%",
  "bottom {pct}%": "하위 {pct}%",
  // BLUF lead (lib/lead.ts) — whole sentences, because Korean is SOV and the
  // English clause order cannot be preserved. "…에 TakeScore를 매깁니다" is used
  // instead of an object particle so no 을/를 choice has to be faked at runtime.
  "Metatake rates {name}, directed by {director}, at a TakeScore of {score}: {clause}.":
    "Metatake는 {director} 감독의 {name}에 TakeScore {score}를 매깁니다: {clause}.",
  "Metatake rates {name} at a TakeScore of {score}: {clause}.":
    "Metatake는 {name}에 TakeScore {score}를 매깁니다: {clause}.",
  "Metatake reads {name}, directed by {director}, closely — its figures, canon standing, filming locations, and the films it connects to by meaning.":
    "Metatake는 {director} 감독의 {name}을(를) 깊이 읽습니다 — 피겨, 정전에서의 위치, 촬영지, 그리고 의미로 연결되는 영화들.",
  "Metatake reads {name} closely — its figures, canon standing, filming locations, and the films it connects to by meaning.":
    "Metatake는 {name}을(를) 깊이 읽습니다 — 피겨, 정전에서의 위치, 촬영지, 그리고 의미로 연결되는 영화들.",
  // verdictShort without a title — the clause the lead folds in. The titled
  // variants below are the same verdicts as full sentences.
  "High value · low risk — a safe masterpiece.": "높은 가치 · 낮은 위험 — 안전한 걸작.",
  "High value · high risk — ambitious but divisive.": "높은 가치 · 높은 위험 — 야심차지만 논쟁적.",
  "Solid but not peak — a stable choice.": "견고하나 정점은 아님 — 안정적 선택.",
  "Mid value, mid risk — approach with care.": "중간 가치, 중간 위험 — 신중히 접근.",
  "{title} sits at high value · low risk — a safe masterpiece.": "{title}은(는) 높은 가치 · 낮은 위험 — 안전한 걸작.",
  "{title} sits at high value · high risk — ambitious but divisive.": "{title}은(는) 높은 가치 · 높은 위험 — 야심차지만 논쟁적.",
  "{title} is solid but not peak — a stable choice.": "{title}은(는) 견고하나 정점은 아님 — 안정적 선택.",
  "{title} sits at mid value, mid risk — approach with care.": "{title}은(는) 중간 가치, 중간 위험 — 신중히 접근.",
  "how it works →": "작동 방식 →",
  "{title}’s strongest value is": "{title}의 가장 강한 가치는",
  "its sharpest risk is": "가장 큰 위험은",
  // ── Tier-2 Editor's Digest (app/film/[slug]/_shared.tsx) ──────────────────
  // Rule-assembled, LLM-free sentences. Whole sentences, never fragments: the
  // English clause order is not Korean's to keep. Counts carry no plural form
  // in Korean, so the "{n} x" / "{n} xs" pairs deliberately share one value.
  "{head} and {last}": "{head} 및 {last}",
  " and ##film list": " 및 ",
  "a {label} win": "{label} 수상",
  "a {label} nomination": "{label} 후보",
  "{label} #{rank}": "{label} {rank}위",
  // C1 — canon standing
  // {title} is deliberately unused: the section heading directly above already
  // names the film, and dropping it removes a 은/는 choice that cannot be made
  // correctly without knowing the title's final syllable.
  "In the canon, {title} holds {listings}{scope} tracked by Metatake — including {honors}.":
    "Metatake가 추적하는 정전 기록에 {listings}{scope} 올라 있습니다 — {honors} 포함.",
  "{n} listing": "{n}건", "{n} listings": "{n}건",
  "across {n} list": "({n}개 리스트에 걸쳐)", "across {n} lists": "({n}개 리스트에 걸쳐)",
  "See the full lineage record →": "전체 계보 기록 보기 →",
  "On the aggregators it holds {bits}.": "집계 사이트 기준: {bits}.",
  "an IMDb rating of {r} from {votes} votes": "IMDb 평점 {r}({votes}명 투표)",
  "an IMDb rating of {r}": "IMDb 평점 {r}",
  "a Metascore of {n}": "메타스코어 {n}",
  "{article} {n}% Tomatometer": "토마토미터 {n}%",
  // C2 — Wikidata award record
  "Wikidata’s award record holds {honors} for {title} — {breakdown}{including}.":
    "Wikidata 수상 기록 기준 {title}의 영예는 {honors} — {breakdown}{including}.",
  // Bare count: the sentence that carries it already says 영예, and "영예는 4건의
  // 영예" said it twice.
  "{n} honor": "{n}건", "{n} honors": "{n}건",
  // Plurals already live above (line ~516) with the same Korean — Korean has no
  // plural form, so only the singulars are new here.
  "{n} win": "{n}회 수상",
  "{n} nomination": "{n}회 후보",
  ", including the {labels}": ", 대표적으로 {labels}",
  "The year-by-year record →": "연도별 기록 →",
  "See the release timeline →": "개봉 타임라인 보기 →",
  // C2 — TMDB release ledger
  "TMDB’s ledger dates {events}{scope}, {from} to {to} in {year}.":
    "TMDB 기록 기준 {events}{scope}, {from}부터 {year}년 {to}까지 이어집니다.",
  "{n} release event": "{n}건의 개봉 이벤트", "{n} release events": "{n}건의 개봉 이벤트",
  "across {n} countries and territories": "({n}개 국가·지역에 걸쳐)",
  "in one country": "(1개국)",
  "from its {country} premiere ({date})": "{country} 프리미어({date})",
  "from its premiere ({date})": "프리미어({date})",
  "from its first release in {country} ({date})": "{country} 최초 개봉({date})",
  "from its first release ({date})": "최초 개봉({date})",
  "a {type} release": "{type} 개봉",
  "a festival premiere": "영화제 프리미어",
  "a limited theatrical opening": "제한 개봉",
  "a theatrical opening": "극장 개봉",
  "a digital release": "디지털 공개",
  "a home-video release": "홈비디오 출시",
  "a television broadcast": "TV 방영",
  // C4 — what this film follows
  "Within Metatake, it is the next step after {films}{more}.":
    "Metatake 안에서 이 영화는 {films}{more} 다음 단계입니다.",
  " and {n} more film": " 외 {n}편", " and {n} more films": " 외 {n}편",
  // C5 — geography + availability
  "Its geography is charted on {map} — {places}{where}.":
    "촬영지는 {map}에 표시돼 있습니다 — {places}{where}.",
  "{n} located place": "{n}곳", "{n} located places": "{n}곳",
  "in {country}": "({country})",
  "across {n} countries": "({n}개국에 걸쳐)",
  "the map below": "아래 지도",
  "Streaming availability is {tracked}.": "스트리밍 가용성은 {tracked}입니다.",
  "tracked in {n} region": "{n}개 지역에서 추적 중", "tracked in {n} regions": "{n}개 지역에서 추적 중",
  "What TakeScore measures": "TakeScore가 측정하는 것",
  // One sentence, one key. These were seven fragments concatenated in English
  // order, which Korean (SOV) cannot follow — see slot() in CinecodexPanel.
  "Our own estimate of the {value} a serious viewer gains from {title}, the {cost} to unlock it, and the {risk} it disappoints — not popularity.":
    "진지한 관람자가 {title}에서 얻는 {value}, 그것을 여는 데 드는 {cost}, 그리고 실망하게 될 {risk}에 대한 우리 자체의 추정입니다 — 인기가 아닙니다.",
  "Scored on the thirteen {dimensions} against a fixed anchor ruler.":
    "고정된 기준자에 맞춰 {dimensions} 13개로 채점합니다.",
  "durable value": "지속가치",
  "cost": "비용",
  "risk": "위험",
  "TakeScore dimensions": "TakeScore 차원",
  "How {title} scores": "{title}의 점수",
  "Value − Risk": "가치 − 위험",
  "Efficiency (value per risk)": "효율 (위험 대비 가치)",
  "The formula floors at zero for display here — Value minus weighted Risk lands below zero.": "여기 표시에서는 공식이 0에서 바닥을 친다 — 가치에서 가중 위험을 빼면 0 미만.",
  "Why →": "이유 →",
  "Value": "가치",
  "Cost": "비용",
  "Risk": "위험",
  "Where {title} ranks": "{title}의 순위",
  "#{rank} of {total} by TakeScore": "TakeScore 기준 {total}편 중 #{rank}",
  "How {title} scores on the thirteen dimensions": "{title}의 13개 차원별 점수",
  "What do these mean? →": "각 차원의 의미는? →",
  "Shown alongside — not part of the TakeScore:": "참고용 표시 — TakeScore의 일부 아님:",
  "AI-estimated (TakeScore rubric), designed and calibrated by Wonwoo Yoon. A rubric-anchored judgment, not an objective fact; popularity metrics above are for comparison only.": "AI 추정 (TakeScore 루브릭) · 설계·보정 Wonwoo Yoon. 객관적 사실이 아니라 루브릭 기반 판단; 위 인기 지표는 비교용일 뿐.",
  "Confidence": "신뢰도",
  "A measured reliability, not a claim of certainty.": "확실성의 주장이 아니라 측정된 신뢰도.",
  "View the full appraisal →": "전체 평가 보기 →",

  // ── audit fill (split fragments + lowercase stat labels) ──
  "figures": "피겨",
  "strong misreadings": "강한 오독",
  "tropes": "트로프",
  "Cross-film types {title} instantiates — shared under": "{title}가 구현하는, 영화를 가로지르는 유형 — 다음에서 공유된다:",
  "Via": "경유",
  "= the figure that carries it.": "= 그것을 나르는 피겨.",
  "What {title}'s figures": "{title}의 피겨가 무엇인지",
  "The questions viewers keep asking about {title} — answered in full on": "관객이 {title}에 대해 계속 묻는 질문들 — 전문으로 답하는 곳:",
  ", the Metatake question desk. Spoiler-heavy titles are masked.": ", Metatake의 질문 데스크. 결말을 건드리는 제목은 가려 둔다.",
  "When the news rhymed with {title} — editions of": "뉴스가 {title}와 운을 맞춘 날 — 다음의 판본들:",
  ", Metatake's daily, that filed this film against the day's events.": ", 이 영화를 그날의 사건과 나란히 놓은 Metatake의 일간지.",
};
