# Metatake — Design System v4 (mobile-first mastering)

Status: in progress (2026-06). Goal: one responsive codebase, editorial identity **kept**,
modernized foundation. No separate mobile site.

> **범위: 웹 전용.** 여기서 "mobile-first"는 폰 폭 CSS를 뜻하고, "No separate mobile site"는 별도 m. 도메인을 만들지 않는다는 뜻이다 —
> **네이티브 앱과는 무관하다.** 모바일 앱(Expo)은 2026-07-17부터 **디자인 시스템 v2 "Lava"**(`mobile/src/theme.ts`)를 쓰며,
> 이 문서의 v4 토큰(직각 모서리·헤어라인·플랫 레드 #E3120B)은 **앱에서 의도적으로 폐기**됐다. 웹=에디토리얼 아카이브 / 앱=결정 도구.
> 두 시스템이 공유하는 것은 브랜드 실 하나(PT Serif = 작품·감독 제목)뿐이다. **양방향 이식 금지** —
> 근거·규칙: `HANDOFF-모바일앱-프리워치.md` §3 및 불변식 §13-14.

## Why this exists (audit findings)

The codebase carries **two conflicting responsive paradigms**:

- **Foundation** (`:root`, `.brief`, `.sticky-layout`, `.home-grid`, masthead) is
  **mobile-first** — base = phone, `@media (min-width: …)` adds desktop. Even says so
  in the globals.css header comment.
- **Recent redesign** (`hm-`, `idx-`, `lt-`, `tg-`, `blg-`, and the six detail blocks
  `df-/fg-/dr-/tp-/mk-/ak-`) is **desktop-first** — base = wide multi-column grids,
  then `max-width` overrides squeeze them down for small screens.

Mobile breaks because the new pages were authored desktop-first and the phone case was
patched on afterward. Concrete symptoms:

1. **11 ad-hoc breakpoints**: 460·560·600·640·680·720·760·820·880·900·1000. No system.
2. **Home pair metaphor dies on mobile** — the horizontal line/knot joining Film A↔B
   (`.hm-tie .barwrap`) is `display:none` under 820px, so the core idea of the page
   vanishes on phones.
3. **Constellation** — fixed 430px canvas with drag; on touch it traps vertical scroll.
4. **Fixed px type everywhere**; no fluid scale → per-breakpoint font overrides multiply.
5. Wrap gutters hardcoded `26px` (ignores the foundation's `--pad-x`).

## The system (the contract every block follows)

### Canonical breakpoints — THREE only
Use these literal px in `@media`. Nothing else.

| name | px    | meaning                                  |
|------|-------|------------------------------------------|
| sm   | 600   | large phone / small tablet — grids gain a column |
| md   | 900   | tablet → desktop — full multi-column layout, `--pad-x` widens |
| lg   | 1180  | wide — max content width reached         |

Always **mobile-first**: base styles target the phone; add complexity with
`@media (min-width: …)`. Never author a new `max-width` query.

### Spacing scale (4px base) — `--sp-1 … --sp-9`
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`

### Fluid type ramp — `--fs-*` (clamp: phone min → desktop max)
| token      | range        | use                         |
|------------|--------------|-----------------------------|
| --fs-xs    | 10.5→11.5    | eyebrow chips, fine print   |
| --fs-sm    | 12.5→13.5    | UI labels, meta             |
| --fs-base  | 15→16.5      | body                        |
| --fs-md    | 16→18        | lead / intro                |
| --fs-lg    | 18.5→22      | card titles                 |
| --fs-xl    | 20→26        | sub-headlines               |
| --fs-2xl   | 24→30        | section headings            |
| --fs-3xl   | 30→46        | page hero h1                |
| --fs-4xl   | 33→50        | blog hero h1                |

### Container gutter — `--wrap-x: clamp(16px, 5vw, 26px)`
Replaces hardcoded `padding: 0 26px` in `.hm-wrap`/`.blg-wrap`/etc. Desktop still 26px;
phones get 16–20px so content isn't crushed.

### Conventions
- Touch targets ≥ ~40px; bump tiny dot controls.
- Any element that exists only for hover (hints, tooltips) is hidden on mobile, shown ≥ md.
- Multi-column card grids: prefer `grid-template-columns: repeat(auto-fit, minmax(…))`
  where the column count isn't semantically fixed — removes media queries entirely.
- Keep the editorial identity: PT Serif headlines, Inter chrome, single red `--accent`,
  teal `--trope`, hairlines, square corners, color images.

## Migration status (per block)
- [x] Token layer in `:root`
- [x] Home `hm-*` (pair metaphor now vertical on mobile)
- [x] Indexes `idx-*` (meta-takes / films / tropes / directors)
- [x] Latest `lt-*` · Trending `tg-*` · Blog `blg-*`
- [x] Detail `df-/fg-/dr-/tp-/mk-/ak-`
- [x] Every redesign block is mobile-first; ≥900px renders identically to before
- [ ] Optional polish: legacy/shared components still desktop-first (harmless, already
      mobile-functional): `.home-cols` (legacy), `.float-player`, `.sb--nav` (search),
      `.seqnav`, `.trl` (trailer), `.sch` (scholar float), `.ml-thumb`, old `.hm-2/.lp-*`.
- [ ] QA at 360 / 600 / 900 / 1180 on device

Each block converts the same way: flip the base to the phone layout, move the wide grid
into `@media (min-width: 900px)` (and a 2-col step at 600 where useful), swap fixed font
sizes for `--fs-*`, and the hardcoded `26px` gutters for `--wrap-x`.
