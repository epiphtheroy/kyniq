# MetaTake DB Protocol — Anthony Lane Stylist (SOP)
**Short name:** DB Protocol (디비프로토콜)
**Lineage:** This is the DB-driven sibling of `Master_Protocol.md`. Where the Master Protocol reads a single `source.md` as its analytical foundation, the DB Protocol mines the **live MetaTake database** (strong misreadings, director material, and the connection graph) as its foundation. Everything downstream — design, chunked drafting with supervisor checks, title engineering, narrative basting, English compile, Korean translation — is **identical** to the Master Protocol.
**Usage:** This protocol MUST be initiated whenever the user provides a **film title** (instead of a source file).

## Core Directives
1.  **Mode:** `Always Proceed` (Do not wait for user confirmation between steps, but notify progressively).
2.  **Logic:** `Chunked Loop` (Process 6-8 sentences per tool call, but calculate Intent/Draft for *each* sentence individually).
3.  **Persistence:** All logic MUST be logged to a dedicated `Generation_Log.md` in the project folder.
4.  **Foundation Source:** The **MetaTake DB is the new `source.md`.** The mined DB dossier is your *internal* analytical foundation — exactly as `source.md` was. It must never be visible in the final output (see Authorial Voice in Phase 2).

---

## Phase 0: DB Connection (CRITICAL — replaces "Detect Source File")
**Trigger:** User provides a film title (e.g., "Drive My Car", "북촌방향", a TMDB id, or "감독: 홍상수").

1.  **Connect to the live DB:**
    *   **Primary path:** the **Supabase MCP connector** (`execute_sql` + schema introspection). The MetaTake project is the Supabase project `jvgarcqrtsmgfimdcwgo`. If the connector is not yet connected, suggest it and stop until connected.
    *   **Why not the shell:** the sandbox shell and web-fetch are firewalled from `*.supabase.co` and `filmcurio.com` (`blocked-by-allowlist`). Do NOT attempt raw `curl`/`web_fetch` against the DB or the live site — use the MCP.
    *   **Fallback (read-only, partial):** if no live connection is available, use the local seed exports in `data/seed/` (`metatake_films_567.csv`, `metatake_figures_takes_4662.csv`, `metatake_ucn_533.csv`) and `handoff/` lineage CSVs. These lack live affinities, ratings, and scores — note the degradation in the log.
2.  **Introspect before querying:** the schema evolves. Run a quick `information_schema` check on the live DB rather than trusting this document's column names verbatim. This protocol's **DB Map** (Appendix A) is a guide, not gospel.
3.  **Resolve the film node:** `SELECT id, tmdb_id, title, original_title, year, director, director_slug, slug, genres, keywords, overview FROM films WHERE title ILIKE ... (or tmdb_id =)`. If multiple matches, disambiguate by director/year. Lock the `film_id`.

## Phase 1: Setup, DB Mining & Blueprint
**Triggers:** Film node resolved in Phase 0.

1.  **Context Isolation (CRITICAL):**
    *   **Rule:** Treat this resolved film as the *only* film that exists in the universe. The DB's **relations** (neighbors, shared concepts, director lineage) ARE in-scope material — that is the whole point — but do NOT import unrelated previous projects, prior conversation, or films the DB does not connect to this one.
    *   **Reset:** Assume a "Fresh State" for every new Phase 1.
2.  **Create Project Folder & Artifacts:**
    *   Create `Outputs/[Film_Slug]/` inside the MetaTake project folder.
    *   `Workflow_Status.md`: A checklist specific to this project. The checklist MUST include:
        *   DB Mining → `[Film]_DB_Discoveries.md` (Phase 1)
        *   Paragraph Design (Phase 1.5)
        *   Sentence Design (Phase 1.5)
        *   Drafting Chunks (A–D)
        *   **Narrative Basting (Chekhov's Gun):** connecting the Intro Bait to the Outro Hook.
        *   Title Generation (Post-Draft).
    *   `Generation_Log.md`: The empty log file for writing the output.
    *   `Project_Controller.md`: The "Visa Stamp" for every step. Initialize with "Project Started: [Date]".
3.  **DB Mining (this replaces reading `source.md`):** query the live DB and assemble the film's dossier. Read **everything the film is connected to**, in this order:
    *   **A. Strong Misreadings (the core "글들"):** every published reading attached to this film.
        *   `figures` for this `film_id` (kind, label = Target Object, description, spoiler_level, character_names) → their `takes` (rationale = the bold reading, rationale_guide = simplified, framework, confidence, raw_concept, theorist, source_citation/source_url/source_year).
        *   Group by the **14 Strong-Misreading frameworks** (Appendix B). Note which framework each reading sits in.
        *   Resolve each take's `meta_take` (title, laconic, thesis, essay, theory_family, theorist) — the consolidated concept node the reading belongs to.
        *   **Flag the strongest readings:** the highest-`confidence` / highest-strength takes are the spine of the essay (in examples, "strength 5" readings).
    *   **B. Director material (the "감독관련 글들"):** `directors` row for `director_slug` (name, bio, birthday, place_of_birth, tmdb_extra). The director's other films in the DB. Any director "next to watch" lineage / picks and director-level cards present in the live DB.
    *   **C. Connections (the "연결들 — 다 읽고"):**
        *   `film_affinities` for this film: top related films by `score` (친연도) + `shared_meta_take_ids` (the exact shared readings that bind them). Translate each shared id to its meta_take title — these are the bridges (e.g., "The Disembodied Confidant").
        *   `meta_take_edges` for the film's key concepts: compare / contrast / broader / narrower links to other concepts.
        *   `film_features` (kind: reception / record / experience / pitch) for reception essays, ratings, and the spoiler-free invitation.
        *   Lineage / awards / canon records and any `prestige_score` / `discovery_score` if present.
    *   **D. Numbers (각종 수치):** capture affinity scores, IMDb/Metascore/RT, vote counts, prestige/discovery scores, award counts. **You will not necessarily quote these verbatim in the essay, but they sharpen judgment** — e.g., a high prestige + zero discovery score tells you the film is fully canonized; a strong critical score against a tiny vote count tells you it is loved but unseen. Let the numbers shape the *argument*, not litter the prose.
4.  **Write the Discoveries Dossier:**
    *   Compile the mined material into `[Film]_DB_Discoveries.md` — **10+ independent, single-data-point findings** (see the existing `Drive_My_Car_DB_Discoveries.md` / `Bukchon_Direction_DB_Discoveries.md` as the model). Each finding = one concrete connection or number, standalone.
    *   **This dossier is the internal foundation — the exact equivalent of `source.md`.** It is the raw ore. The polished essay must never read like a tour of it.
5.  **Translate to a Blueprint:**
    *   Read the dossier. Create an **8-Paragraph Blueprint** in `Generation_Log.md`.
    *   Translate DB/academic terms (framework keys, theorist names, "affinity", "meta-take") into Lane-isms (Wit, cynicism). The reader meets a critic, never a query.
6.  **Initialize Project Controller:** log "Project Started: [Date]" and "DB Mining Complete".

## Phase 1.5: Design Phase (CRITICAL — DO NOT SKIP)
**Objective:** Sequential design of structure BEFORE any drafting begins.
**Constraint:** This phase must be completed and logged before Phase 2 execution.

### Step 1: Paragraph Design
*   **Action:** Design each of the 8 paragraphs with:
    *   **Paragraph Number & Role:** (e.g., P1: Opening Hook, P2: Context/Background…)
    *   **Core Idea:** The central point this paragraph must convey.
    *   **DB Reference:** Which mined finding(s) from `[Film]_DB_Discoveries.md` feed this paragraph.
    *   **Transition Logic:** How this paragraph connects to the next.
*   **Logging:** Record all 8 paragraph designs in `Generation_Log.md`.

### Step 2: Sentence Design (Per Paragraph)
*   **Action:** For each designed paragraph, plan the individual sentences:
    *   **Sentence Count:** typically 4–6.
    *   **Sentence Roles:** (e.g., S1: Topic sentence, S2: Evidence, S3: Lane-ism/Wit, S4: Transition)
    *   **Key Vocabulary:** Specific Lane-style words or phrases to use.
*   **Logging:** Record sentence designs under each paragraph in `Generation_Log.md`.

### Step 3: Design Approval
*   **Checkpoint:** Log "Design Phase Complete" in `Project_Controller.md`.
*   **Proceed:** Only after this checkpoint may Phase 2 begin.

## Phase 2: The Execution Loop (Autopilot with Supervisor Audit)
**Essay Specifications:**
*   **Word Count:** Approximately **1600 words** (English essay).
*   **Independence:** The essay MUST function as a **complete, standalone piece**. It should make sense on its own, to a reader who has never heard of MetaTake or any database.
*   **Structure:** 8 paragraphs as designed in Phase 1.5.
*   **Authorial Voice (CRITICAL):** The generated essay must read as if **Anthony Lane himself wrote it**. You MUST NOT include any phrase that references or acknowledges the database, the data, or its machinery. Forbidden formulations include (in any language): "the DB shows," "the data connects," "the affinity score," "친연도 18.34," "연결망이," "데이터베이스는," "takes 테이블," "the system classifies," "meta-take," "shared readings," "according to the dataset," or any equivalent. The DB is your *internal* analytical foundation; it must never be visible in the final output. Every insight — every neighbor film, every shared concept, every number — must be presented as the **critic's own observation and judgment**, exactly as the Master Protocol forbade citing `source.md`.
    *   *Example:* The DB fact "film_affinities links Drive My Car to Aftersun with score 18.34 via 'The Disembodied Confidant'" becomes, in the essay, a critic's own claim: *"Place this film beside Charlotte Wells's* Aftersun *and the same object surfaces — a voice with no body, trusted more than any living person in the room."* No score, no table, no seam.
**Directives:** execute in chunks of 2 Paragraphs.

**CRITICAL RULE: The Supervisor Check (Self-Approval)**
Before executing ANY Chunk (A, B, C, D), you MUST perform a "Virtual Supervisor Check":
1.  **Read:** Read the local `Project_Controller.md`.
2.  **Evaluate:** Assess the previous step's quality (e.g., "Did Chunk A capture the blueprint intent?").
3.  **DB-Reference Scan (CRITICAL):** Check the previous chunk for any phrase that references the database or its machinery (see the forbidden list above — "the DB," "affinity," "연결망," "테이블," a raw affinity/prestige score presented as data, etc.). If ANY such phrase is found, **rewrite those sentences** to present the insight as the critic's own observation before proceeding.
4.  **Approve:** Write a new entry to `Project_Controller.md`:
    *   `Step Verified: [Previous Step Name]`
    *   `Quality Status: Approved`
    *   `DB-Reference Scan: Clean / [number] violations corrected`
    *   `Next Action: Authorized to Proceed with [Next Step]`
5.  **Execute:** ONLY after writing this approval may you proceed to generate the next chunk.
*This replaces the need to ask the user for permission. You are giving YOURSELF permission based on evidence.*
*CRITICAL: DO NOT call `notify_user` after these checks. Proceed IMMEDIATELY to the next step. Silence is speed.*

**Mandatory References (For Every Sentence):**
1.  **DB Dossier Segment:** (Refer to the specific finding/number in `[Film]_DB_Discoveries.md`; re-query the live DB if a detail needs verifying.)
2.  **Current Context:** (Refer to the immediately preceding generated sentences.)
3.  **Style Corpus:** (Refer to `Style Anthony lane.md` in the Anthony Lane project for specific vocabulary/tone matching.)

**For EACH Sentence, you must calculate:**
*   **Role:** (The structural purpose of the sentence)
*   **Context:** (The previous sentence text)
*   **Intent:** (The specific witty point being made)
*   **Style Check:** (Verify alignment with `Style Anthony lane.md`)
*   **Draft:** (The actual high-register English text)

**Loop Sequence (With Mandatory Supervisor Checks — SILENT MODE):**
1.  **Chunk A:** [Supervisor Check: Blueprint] -> Generate -> Log -> Update Workflow -> **IMMEDIATELY PROCEED**.
2.  **Chunk B:** [Supervisor Check: Chunk A] -> Generate -> Log -> Update Workflow -> **IMMEDIATELY PROCEED**.
3.  **Chunk C:** [Supervisor Check: Chunk B] -> Generate -> Log -> Update Workflow -> **IMMEDIATELY PROCEED**.
4.  **Chunk D:** [Supervisor Check: Chunk C] -> Generate -> Log -> Update Workflow -> **IMMEDIATELY PROCEED**.

## Phase 3: Finalization
1.  **Title Engineering (Lane Mode) - POST-DRAFT ONLY:**
    *   **Trigger:** Only start this AFTER the final chunk of Phase 2 is logged.
    *   **Generation:** Read the *entire* generated draft in the log. Then generate 3 Witty/Literary title options based on the essay's central metaphor.
    *   **Selection:** Choose the single best understated title that Anthony Lane would actually use.
    *   **Formatting:** Prepend `# [Selected Title]` to the final file.
2.  **The Narrative Basting (Chekhov's Gun) - POST-DRAFT ONLY:**
    *   **Objective:** To cure "fragmentation" caused by chunked generation. The essay must feel like a single cohesive thread, not 8 blocks.
    *   **Logic (Bait & Hook):**
        *   **Scan:** Look at your **Conclusion (Hook)**. What is the final image/metaphor?
        *   **Action:** Go back to the **Introduction (Bait)**. Insert or refine a specific subtle detail/metaphor that explicitly predicts that ending.
        *   **Constraint:** Do NOT rewrite the middle. Just "sew" the ends together so the reader feels the destination was inevitable.
        *   *Example:* If the ending is about "Civilization as a stolen bicycle," the intro must mention "the fragility of ownership."
    *   **Logging:** Record the "Bait" insertion and "Hook" connection in `Generation_Log.md`.
3.  **Compile English Essay:**
    *   Extract clean text from Log to `[Title]_Essay.md`.
4.  **Translate to Korean (Strict Stylistic Enforcement):**
    *   **Mandatory Reference:** For *every single sentence*, you must read and apply the patterns from `Sytle 신형철 번역.md` (in the Anthony Lane project).
    *   **Execution Logic:**
        *   Read the English target sentence.
        *   Refer to the *immediately preceding* Korean translated sentence (for flow).
        *   Apply the Sin Hyung-cheol tone (lyrical, logical, precise).
    *   **Logging:** You MUST log the translation progress **Paragraph by Paragraph** in the `Generation_Log.md`.
    *   **Output:** Save the final result to `[Title]_Essay_KO.md`.
    *   Notify user with full paths to all files.

---

## Appendix A: MetaTake DB Map (guide — introspect live to confirm)
Core relation: **`films` ──< `figures` ──< `takes` ──> `meta_takes`**, with films linked to each other by **`film_affinities`** and concepts linked by **`meta_take_edges`**.

*   **`films`** — `id, tmdb_id, title, original_title, year, director, director_slug, slug, genres[], keywords[], overview, imdb_id, wikidata_id`.
*   **`directors`** — `slug (= films.director_slug), name, bio, birthday, place_of_birth, tmdb_person_id, tmdb_extra (jsonb)`.
*   **`figures`** — `film_id, kind (character|object|location|trope|form), label (= Target Object), description, spoiler_level (none|mild|major), character_names`. *What in the film is being read.*
*   **`takes`** — `figure_id, meta_take_id, rationale (the bold reading), rationale_guide (simplified), confidence, framework (the misreading lens), raw_concept, source_citation, source_url, source_year, theorist_id`. *The strong misreadings. ≈18,000 published.*
*   **`meta_takes`** — `slug, title (noun phrase), laconic (one line), thesis (2–3 sentences), essay, theory_family_id, theorist_id, genres[], status, raw_concept`. *Consolidated concept nodes that takes map to.*
*   **`theorists`** — `slug, name, blurb`. **`theory_families`** — the 5 families.
*   **`meta_take_edges`** — `a, b, relation (compare|contrast|broader|narrower), similarity`. *Concept-to-concept connections.*
*   **`film_affinities`** — `film_id, related_film_id, score (친연도), shared_meta_take_ids[]`. *Film-to-film connections by shared readings — the backbone of the "neighbors" findings.*
*   **`film_features`** — `film_id, kind (pitch|record|reception|experience), body, payload (jsonb)`. *Reception essays, ratings, the spoiler-free invitation lead.*
*   **`film_dossiers`, `meta_take_rankings`, `frame_rankings`, `media`, `frames`** — supporting tables; ratings/scores (IMDb, Metascore, RT, vote count, prestige_score, discovery_score) and lineage/awards live in the live DB (often in `film_features.payload` / dossiers / dedicated columns). **Confirm by introspection at runtime.**

## Appendix B: The 14 Strong-Misreading Frameworks (5 families)
Source of truth: `lib/frameworks.ts`. Group a film's readings by these when mining.

*   **Reading from within (interpretation):** Subtext (`PHENOMENON→NOUMENON`) · Ontology (`NOUMENON`) · Semiotics (`SIGNIFIER→SIGNIFIED`) · Enigma (`ENIGMA`).
*   **Form, making & context (form):** Production (`PROCESS`) · Location (`LOCATION`) · Context (`CONTEXT`) · Reception (`METACRITIC`).
*   **Mind, ethics & politics (mind):** Psychoanalysis (`PSYCHOANALYTIC`) · Ethics (`ETHICAL-PHILOSOPHICAL`) · Politics (`ETHICO-POLITICAL`).
*   **Existential parallels (parallel):** Counterpart (`PERSONA-PARALLEL`) · Parallel (`JUXTAPOSITION`).
*   **Title & invitation (title):** Title (`TITLE`) + `INVITATION` (the spoiler-free lead — an entry point, not a reading).

---
**Agent Instruction:** When a film title is presented, strictly follow this sequence. Do not ask *how* to proceed; assume this protocol is active. The DB is the foundation; the critic is the only voice the reader hears.
