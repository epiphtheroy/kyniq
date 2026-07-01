-- Cinecodex scoring DB schema (Postgres / Supabase)
-- Principle: external metrics are stored ALONGSIDE but NEVER blended into Cinecodex scores.
-- Raw samples are immutable; aggregates are derived; provenance is fully logged.

-- 1) FILM MASTER + EXTERNAL METRICS (kept separate from our score) -----------
create table films (
  film_id        bigserial primary key,
  tmdb_id        bigint unique,
  imdb_id        text unique,
  title          text not null,
  year           int,
  director       text,
  country        text,
  language       text,
  -- external reference numbers (DISPLAY/VALIDATION ONLY, never an input):
  imdb_rating    numeric,        -- 0-10
  rt_critic      int,            -- 0-100
  rt_audience    int,            -- 0-100
  metascore      int,            -- 0-100
  canon_score    numeric,        -- your proprietary canon DB summed score
  in_catalog     boolean default true,
  created_at     timestamptz default now()
);

-- 2) FROZEN PROMPT VERSIONS (pre-registration) -------------------------------
create table prompt_versions (
  prompt_version text primary key,      -- e.g. 'cinecodex-prod-v2'
  prompt_sha256  text not null,
  prompt_text    text not null,
  rubric_notes   text,
  frozen_at      timestamptz default now()
);

-- 3) RAW SCORING SAMPLES (immutable; one row per model x sample x film) -------
create table scoring_runs (
  run_id         bigserial primary key,
  film_id        bigint references films(film_id),
  prompt_version text references prompt_versions(prompt_version),
  vendor         text not null,         -- 'anthropic' | 'openai' | 'google'
  model_id       text not null,         -- exact snapshot, e.g. 'claude-sonnet-4-6'
  temperature    numeric not null,
  sample_index   int not null,          -- 1..N self-consistency
  batch_id       text,                  -- batch job id, for audit
  -- 13 raw sub-scores:
  cog int, aff int, form int, moral int, dur int,
  itx int, fr int, etx int, ctx int,
  bank int, insincere int, coward int, polar int,
  note           text,
  raw_json       jsonb,                 -- exact model output for this film
  input_tokens   int,                   -- cost logging
  output_tokens  int,
  cache_read_tokens int,
  cost_usd       numeric,
  parse_ok       boolean default true,
  retry_count    int default 0,
  created_at     timestamptz default now(),
  unique (film_id, prompt_version, model_id, sample_index)
);
create index on scoring_runs (film_id, prompt_version);

-- 4) AGGREGATED PUBLISHED SCORES (derived: median across samples/panel) ------
create table film_scores (
  film_id        bigint references films(film_id),
  prompt_version text references prompt_versions(prompt_version),
  panel          text not null,         -- e.g. 'sonnet-n3' | 'opus+sonnet'
  -- median sub-scores:
  cog int, aff int, form int, moral int, dur int,
  itx int, fr int, etx int, ctx int,
  bank int, insincere int, coward int, polar int,
  -- derived axes (fixed published formula):
  v_value   numeric,   -- mean(COG,AFF,FORM,MORAL,DUR)
  c_cost    numeric,   -- mean(ITX,FR,ETX,CTX)
  r_risk    numeric,   -- 0.6*mean(BANK,INSINCERE,COWARD) + 0.4*POLAR
  -- NOTE: U and S are NOT stored (they depend on the user-tunable lambda).
  -- Compute them at query time — see view film_scores_ranked below.
  -- reliability / honesty metadata:
  n_samples      int,
  sd_v           numeric,   -- inter-sample SD of V (run noise)
  sd_r           numeric,
  panel_disagree numeric,   -- cross-model SD of V (if panel)
  flagged        boolean default false,  -- needs review (high SD / near threshold)
  scored_at      timestamptz default now(),
  primary key (film_id, prompt_version, panel)
);

-- 5) ANCHOR DRIFT CONTROL SET (re-scored on schedule to detect model drift) --
create table anchor_controls (
  film_id        bigint references films(film_id),
  dimension      text not null,         -- e.g. 'POLAR'
  expected_band  int not null,          -- 0/25/50/75/100
  tolerance      int default 12,
  last_observed  numeric,
  last_checked   timestamptz,
  drift_flag     boolean default false,
  primary key (film_id, dimension)
);

-- 6) REVIEW QUEUE (human / Opus escalation) ----------------------------------
create table review_queue (
  film_id        bigint references films(film_id),
  reason         text,                  -- 'high_sd' | 'panel_disagree' | 'near_threshold' | 'parse_fail'
  status         text default 'open',   -- open | resolved
  resolution     text,
  created_at     timestamptz default now(),
  primary key (film_id, reason)
);

-- 7) BATCH JOB TRACKING (async Batch API; enables resume) --------------------
create table batch_jobs (
  batch_id       text primary key,      -- vendor batch id
  vendor         text, model_id text, prompt_version text,
  sample_index   int,
  film_ids       bigint[],              -- films in this batch (for custom_id mapping)
  n_requested    int, n_completed int, n_failed int,
  status         text default 'submitted', -- submitted|in_progress|ended|error
  submitted_at   timestamptz default now(),
  ended_at       timestamptz
);

-- 8) DRIFT GATE RUN LOG ------------------------------------------------------
create table drift_runs (
  drift_run_id   bigserial primary key,
  checked_at     timestamptz default now(),
  model_id       text, prompt_version text,
  n_controls     int, n_out_of_tolerance int,
  gate_passed    boolean,               -- false => pipeline pauses
  details        jsonb
);

-- 9) HUMAN AUDIT (for human-vs-AI validity; NOT an input) --------------------
create table human_audit (
  film_id        bigint references films(film_id),
  rater          text,
  cog int, aff int, form int, moral int, dur int,
  itx int, fr int, etx int, ctx int,
  bank int, insincere int, coward int, polar int,
  created_at     timestamptz default now(),
  primary key (film_id, rater)
);

-- VIEW: U/S computed at query time with default lambda=1.0 (parameterize in app)
create view film_scores_ranked as
  select *, (v_value - 1.0*r_risk) as u_net,
            (v_value - 50)/greatest(r_risk,1) as s_sharpe
  from film_scores;

-- Derivation reference (compute in the aggregation job — MEDIAN PER SUB-SCORE):
--   For each film: take the N samples, compute the MEDIAN of EACH of the 13 sub-scores
--   independently. Then compute axes FROM THOSE 13 MEDIANS:
--   V = (COG+AFF+FORM+MORAL+DUR)/5
--   C = (ITX+FR+ETX+CTX)/4
--   R = 0.6*((BANK+INSINCERE+COWARD)/3) + 0.4*POLAR
--   U = V - lambda*R   (NOT stored; view/app, lambda default 1.0, range -100..+100, higher=better, negatives normal)
--   S = (V-50)/GREATEST(R,1)
--   sd_v / sd_r = stdev of per-sample V / R across the N samples (reliability).
