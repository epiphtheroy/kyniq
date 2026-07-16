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

  // Nav groups (components/home2/Nav.tsx buildGroups)
  Watch: "감상",
  Wander: "탐색",
  Read: "읽기",
  Theory: "이론",
  Patterns: "패턴",
  You: "나",

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
  "Where to go after {title} — nine films that continue its conversation, each chosen for a specific bridge. Curated, not algorithmic.":
    "{title} 다음에 갈 곳 — 그 대화를 이어가는 영화 아홉 편. 각각 뚜렷한 다리 하나를 보고 골랐다. 알고리즘이 아니라 큐레이션.",
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
};
