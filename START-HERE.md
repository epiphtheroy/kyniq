# START HERE — FilmCurio

> Read this file first if you're new to the project.

## Quick Overview

**FilmCurio** (filmcurio.com) is a film Q&A platform with deep, essay-style interpretations. 
Content is AI-generated, editorially curated, and served via a Next.js app on Vercel.

## Reading Order

1. **`00-INDEX.md`** — Complete project map (structure, stack, schema, deployment)
2. **`SPEC.md`** — Full product specification (86KB — the single source of truth)
3. **`AGENTS.md`** — Rules for AI agents working on this codebase

## Key Files

| File | What It Does |
|---|---|
| `app/globals.css` | Design system (colors, typography, components) |
| `app/layout.tsx` | Root layout with Header/Footer |
| `app/page.tsx` | Homepage — infinite scroll feed |
| `components/InfiniteScrollFeed.tsx` | The main feed component |
| `lib/pipeline.ts` | Content generation logic |
| `worker/src/generator.ts` | Q&A generation worker |

## Content Engine Docs

- `content-engine-overview.md` — Architecture of the 3 worker loops
- `pipeline-prompts.md` — AI prompt templates
- `editorial-voices.md` — Writing voice definitions
- `prompt-design-changelog.md` — Prompt iteration history

## Missions (Build History)

`mission-00-kickoff.md` through `mission-10-kickoff.md` document the build phases.
Named tracks: `mission-home-redesign-kickoff.md`, `mission-media-embed-kickoff.md`, 
`mission-pipeline-worker-kickoff.md`, `mission-qa-kickoff.md`.

## Contact

- **Domain:** filmcurio.com
- **Email:** wonwoo@metatake.net
- **Git:** github.com/epiphtheroy/kyniq (repo name is legacy)
