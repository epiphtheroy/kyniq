# Mission 1 — Data layer (Postgres / Supabase)

> Paste into the Antigravity Manager **after Mission 0 verifies green.** Run the migration and
> RLS in **approval mode** — review the SQL diff before applying it to the database.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §3 (domain model), §3.1 (user logic), §3.2 (content
lifecycle / provenance / AI pipeline), §4 (data model + RLS), and §7.1 (`sort_score`). This is
Mission 1 from SPEC §13. **Scope = schema, RLS, a profile-creation trigger, and seed data
only** — no UI, no auth screens, no TMDB fetch (Mission 2), and no scoring/reputation/badge-award
triggers (those ship with their feature missions, 4–7).

**Do:**
1. Write **one SQL migration** creating the v1 tables from §4. Every table gets
   `id uuid primary key default gen_random_uuid()` and `created_at timestamptz default now()`.
   Tables: `films`, `profiles`, `questions`, `canonical_answers`, `answer_revisions`,
   `contributions`, `comments`, `votes`, `flags`, `edit_suggestions`, `badges`, `user_badges`,
   `content_events`.
   Column specifics that matter:
   - **films** — `tmdb_id int unique`, `title`, `original_title`, `year int`, `director`,
     `director_slug text`, `poster_path`, `overview`, `slug text unique`, `genres text[]`,
     `keywords text[]`, `imdb_id text`, `wikidata_id text`.
   - **profiles** — `id uuid` references `auth.users(id)` on delete cascade, `username text
     unique`, `display_name`, `bio`, `avatar_url`, `reputation int default 0`,
     `is_public bool default true`, `role text default 'user'` (user / admin / system),
     `account_status text default 'active'` (active / suspended).
   - **questions** — `film_id` FK, `author_id` FK profiles, `title`, `body`, `slug text
     unique`, `view_count int default 0`, and the **lifecycle/provenance
     fields (§3.2):** `status text default 'published'` (draft / in_review / published /
     rejected / hidden), `source text default 'human'` (human / ai), `generated_by text`,
     `reviewed_by uuid` FK profiles, `published_at timestamptz`. **No `embedding` column yet**
     (pgvector is v2).
   - **canonical_answers** — `question_id` FK unique, `body`, `updated_by` FK profiles,
     `updated_at timestamptz`, `revision_count int default 0`, + the lifecycle/provenance fields
     (`status default 'published'`, `source`, `generated_by`, `reviewed_by`, `published_at`).
   - **answer_revisions** — `canonical_answer_id` FK, `body`, `editor_id` FK profiles,
     `edit_summary`.
   - **contributions** — `question_id` FK, `author_id` FK profiles, `body`,
     `upvotes int default 0`, `sort_score numeric default 0`,
     `merged_into_canonical bool default false`. **No downvote column.** + lifecycle/provenance
     (`status default 'published'`, `source`, `generated_by`, `published_at`).
   - **comments** — `contribution_id` FK, `author_id` FK profiles, `body`. One level only.
   - **votes** — one row = one upvote: `user_id` FK profiles, `contribution_id` FK, with a
     **UNIQUE (`user_id`, `contribution_id`)**. **No `value`/`-1` column — upvote-only.**
   - **content_events** *(audit, §3.2)* — `entity_type`, `entity_id uuid`, `event`
     (generated / verified / published / edited / rejected / hidden / flag_resolved),
     `actor_id uuid` FK profiles (null for system), `actor_kind text` (human / ai / system),
     `meta jsonb`.
   - **flags**, **edit_suggestions**, **badges**, **user_badges** — per §4.
   - **Do NOT create `people` or `mentions`** — those are Mission 12 (fast-follow).
2. Add foreign keys and helpful indexes: `questions(film_id)`,
   `contributions(question_id)`, `votes(contribution_id)`, `films(director_slug)`, plus the
   unique slug indexes.
3. **Enable RLS on every table** and add policies per §4:
   - **Public read gated on publication:** `anon` + `authenticated` `SELECT` on `films`, and on
     `questions` / `canonical_answers` / `contributions` / `comments` **only where
     `status = 'published'`**, plus `profiles WHERE is_public = true`. Draft/in_review/hidden/
     rejected rows must be invisible to the public (keeps unpublished AI drafts off crawlers).
   - `INSERT`/`UPDATE` on `questions`, `contributions`, `comments`, `votes`,
     `edit_suggestions`, `flags`: **authenticated only**, and only as self
     (`author_id`/`user_id = auth.uid()`). (Human posts are created `status='published'`.)
   - `canonical_answers` is **not** client-writable: add no anon/auth `UPDATE` policy. Canonical
     edits go through a server route / `SECURITY DEFINER` function gated on `reputation >= 250`
     or `admin` — built in Mission 5; for now keep the table locked.
   - **Admin & service:** `role='admin'` and the server-side **service role** may read/write all
     rows regardless of `status` (the §6.13 admin console and §3.2 pipeline use these). Public
     anon/auth clients never get elevated access.
4. **Profile bootstrap:** a trigger on `auth.users` insert (`handle_new_user`) that creates the
   matching `profiles` row.
5. **Seed:** insert the §11 **badge** rows, a `system`-role **"FilmCurio Editorial"** profile
   (authors AI-drafted content, §3.2), and **5 films manually** (real titles with `slug`,
   `year`, `director`, `director_slug`; `genres`/`keywords` may be minimal) so later missions
   have data to render.
6. Deliver reviewable files: `supabase/migrations/0001_init.sql` and `supabase/seed.sql`.

**Verify (all must pass before closing the mission):**
- Migration applies cleanly; every table exists with **RLS enabled**.
- With the **anon** key: `SELECT` returns only `status='published'` rows for questions /
  canonical_answers / contributions / comments (films + public profiles readable); a `draft`
  row is **invisible** to anon; `INSERT` into questions / contributions / votes / comments is
  **rejected**.
- With an authenticated test user: can insert a row as themselves; **cannot** insert with a
  different `author_id`; **cannot** `UPDATE` another user's row; **cannot** directly `UPDATE`
  `canonical_answers`.
- `grep -i downvote` over the migration returns nothing; `votes` has a UNIQUE
  (`user_id`,`contribution_id`) and **no** `value` column.
- Inserting a test `auth.users` row produces a matching `profiles` row (trigger works).
- The "FilmCurio Editorial" `system` profile and the 5 seed films exist; the films are SELECTable
  with the anon key.

**Do not:** build TMDB fetch, auth UI, scoring/reputation/badge-award triggers, the admin
console, the AI pipeline, `people` / `mentions`, or any page or component.

---

*Next:* **Mission 2 — TMDB + film pages** (cache `genres`/`keywords`/`imdb_id`/`wikidata_id`/
`director_slug`; `/film/[slug]` lists its questions).
