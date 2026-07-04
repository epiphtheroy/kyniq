# Metatake — DOC INDEX (start here)

*Map of the project's docs. Updated 2026-06-17 after the redesign sprint. Read the three "authoritative now" docs first; treat the rest as reference or history.*

## ★ Authoritative now (read these)
| Doc | What it is |
|---|---|
| `docs/STATE-2026-06-17.md` | **Where we are** — live counts, entity model, pages, homepage, graph, Ask, migrations, RPCs, known gaps. The single source of truth for current state. |
| `docs/RUNBOOK-bigbang.md` | **How to add +405 films without mistakes** — the 3 pre-start blockers, pre-flight, safety rules, the exact ordered pipeline with commands/params/models/gotchas/verification/rollback. Use this for the next big bang. |
| `MASTER.md` | Original consolidation of logic + design + the 567-seed runbook. Still useful for concepts; its §4 *sequence* is superseded by RUNBOOK §3 and figure-page-KEPT §L.3 where they differ. |
| `docs/REMEMBER-thin-content-gate.md` | **ACTIVE temporary state** — thin/figure-less films are hidden + noindexed until they have ≥3 figures (auto-reverses per film). Post-big-bang visibility check + full-revert recipe. Delete once resolved. |

## Reference — current & accurate
| Doc | Purpose |
|---|---|
| `docs/HANDOFF-SEO-마스터.md` | **SEO 운영 정본 (2026-07-04)** — sitemap 18분할·코호트·IndexNow·slug_aliases·Tier-2·CineCodex 노출층의 전 시스템 파일 위치 + 상황별 런북(새 영화/캡 증량/표면 개방/개명) + GSC 판독 로그. SEO 관련 변경 전 필독. |
| `GEO_운영-신규영화-증분처리.md` | **촬영지 파이프라인 상시 운영** — 새 영화 추가 시 이 문서 하나로 배치 추출→적재→지오코딩 자동 실행 (Claude Code에 붙이면 됨). |
| `HANDOFF-종합현황-지리촬영지.md` | 촬영지(film_locations) 파이프라인 이력·현황. §0 = 2026-07-03 완료 스냅샷(20,073행/4,334편), §12 = 수정·검증 로그. |
| `HANDOFF-아틀라스-SEO-읽는층.md` | 촬영지 데이터의 **SEO 읽는층**(2026-07-04 전 Phase 라이브: film/director locations 1,000+331 · 국가 73 · 도시 511) — 파일맵·DB RPC·불변식(게이트=mergeCells 동기 규칙)·신규영화 운영절차(§3). 설계·실행 로그는 `docs/PLAN-atlas-seo.md`. |
| `figure-page-KEPT.md` | Parking-lot + the most up-to-date pipeline notes: §G scale (1k-film), §H embeddings, §J tropes, §K scholar header, **§L the big-bang checklist**. |
| `meta-take-architecture.md` | The spine spec (entities, pipeline, decisions) — annotated with the 2026-06-14 figure-page reversal. |
| `figure-page-design.md` | Figure page + contribution spec; §6.6 output contract for figure-enrich. |
| `film-features-plan.md` | The 4 fixed film-hub sections (pitch/record/reception/experience) — peripheral to the figure→take pipeline. |
| `docs/metatake-about-v2.md` | The /about + manifesto copy (EN+KR), figure/take/meta-take/trope vocabulary. Source of truth for /about. |
| `docs/homepage-redesign-strategy.md` | Homepage design brief (3 concepts) — grounded in live RPCs. |
| `HANDOFF-home-v5-시안-가이드.md` | "Living Paper" home mockup handoff (the current homepage is its real-data adaptation). |
| `grounded-ask-design.md` | The Grounded Ask (RAG) design — implemented as /ask + /api/ask. |

## Legacy / historical (do NOT treat as current)
These describe the earlier **frames / single-call Q&A** product that the meta-take spine largely superseded. Keep for history; don't build from them.
- `SPEC.md`, `AGENTS.md`, `content-engine-overview.md`, `site-ia-plan.md` (frames IA), `figure-meaning-plan.md` (old terminology), `RUNBOOK-metatake.md` (first-build runbook), `prompt-featured-qa.md`, `frame-candidates.md`, `spoiler-guard-design.md`, the ~20 `mission-*.md` kickoffs, `redesign-*.md`, `prompt-design-changelog.md`.
- Strategy (non-pipeline, fine to keep): `Metatake_소개_매니페스토_제안.md`, `Metatake_아웃리치_운영설계.md`, `Metatake_자체LLM_타당성_전략검토.md`.

## Data / seed files
- `worker/theory_canon.csv` — Theories & Theorists canon (2,587 rows; loaded by `theory-import.py`).
- `data/seed/metatake_figures_takes_4662.csv` — original 567-film figures+takes seed (loaded by `mt-import.py`).
- `metatake_films_expansion_405.csv` — the +405 expansion list (**titles only, no tmdb_id**) → see RUNBOOK §0.A.

## Deploy/runner commands
`.command` files in repo root + `worker/` are double-click runners (sandbox can't push; the user runs them on their Mac). Deploy commands push to `main` → Vercel. Worker commands run the pipeline against the live DB. Naming: `deploy-*.command` (web), `run-*.command` (pipeline). The newest homepage deploy is `deploy-home-living2.command`.
