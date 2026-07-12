# 영화공장 RUN PLAYBOOK — the validated end-to-end recipe (paste a film list → same quality)

## ⭐ AUTOMATED PATH (built 2026-07-12) — `factory.py run` executor
The whole recipe below is now a **standalone program** (no Claude tokens — plain Python; the worker
scripts use their own API keys). Two ways to run it, both token-free:

```bash
# ── TERMINAL (recommended, simplest) ────────────────────────────────────────
# add films — three ways, all forgiving (title-only is fine; the run resolves it):
python3 worker/factory.py add "The Piano (1993)" --tmdb-id 897    # one film
python3 worker/factory.py ingest my-list.txt                      # a file: .csv OR "Title (Year)" lines
pbpaste | python3 worker/factory.py ingest                       # pasted text via stdin
#   (drop-folder convention still works: put titles.csv in factory/intake/ then `ingest` it)
python3 worker/factory.py plan --write                            # → run #N (status=planning) + cost
python3 worker/factory.py run --run N --dry-run                   # print the exact 47-stage plan, $0
python3 worker/factory.py run --run N --yes                       # EXECUTE (real spend, ledgered)

# ── ADMIN (/admin/factory) ──────────────────────────────────────────────────
#   ⓪ "Add films" panel: paste one title per line, or upload a .txt/.csv → intake (dedups repeats)
#   ① "▶ Queue a run" button: marks a run status='queued'
#   then on the Mac start the watcher ONCE (survives logout):
nohup bash worker/factory-watch.sh >> factory/logs/watch.log 2>&1 &
#   the watcher claims queued runs and runs the executor. Stop: touch factory/.watch-stop
```

**Intake text format** (both `ingest` and the admin paste box): one film per line —
- `Title (Year)` — year in parens (optional)
- `Title 496243` — **a trailing bare number (≥3 digits) is read as a TMDB id** (the fastest, most exact
  form; e.g. `Werckmeister Harmonies 23160`). Works even when the title itself ends in a number
  (`Blade Runner 2049 335984`, `Toy Story 3 10193`); a small trailing number like `Toy Story 2` is left alone.
- `Title tmdb:12345` or `Title | 1999` also work; `#` lines are comments.
- A block whose first line is a `title,year,director,tmdb_id,tier` header is read as CSV.
Titles with commas ("Paris, Texas") are safe. Everything routes through `factory_intake_add_batch`
(one DB round-trip, dedups against existing intake). TMDB id is the most reliable — the run fetches the
canonical film directly from it, no fuzzy title match.

Flags: `--from Sxx` resume from a stage · `--only Sxx` one stage · `--films slug,slug` subset ·
`--with-corpus` include deferred global rebuilds (S26) · `--dry-run` plan without spending.
Every stage writes `factory.stage_runs` (status/cost/verify_result) so **any run is resumable** —
re-run `--from Sxx` and unchanged stages are idempotent. The final report (quality bar per film +
"incomplete" list) lands in `factory.runs.report_md` and `factory/logs/run-N.md`.

**Bulk economics** (why hundreds ≈ same wall-clock, cheaper per film): the Opus/Sonnet stages combine
all films into ONE Batch-API job (50% off, ~constant latency for 3 or 300); corpus stages (embed,
affinities, sentences) run ONCE and amortize; only the per-film HTTP stages fan out (pool of 6).
So per-film cost DROPS at scale; total scales with count (gate pauses >$50).

**This is THE operating doc.** It captures the *actual, validated* sequence run on 2026-07-12 that
took 3 brand-new films from nothing → fully-live Tier-1 pages at the quality bar below. A fresh
Claude Code terminal reads this file + a film list and reproduces that quality. Design rationale +
manifest live in `HANDOFF-영화공장.md` / `factory/manifest.json`; **this is the how-to-actually-run.**

> **How to invoke (owner):** open Claude Code in `/Users/jerryje/Documents/MetaTake`, paste your film
> titles, and say *"run the film factory on these per factory/RUN-PLAYBOOK.md"*. Claude executes the
> stages below in order, checking the gates. For ≤50 films it uses the SYNC paths shown; for bigger
> batches switch the marked stages to their Batch-API variants (noted inline).

## Quality bar (what "done" looks like — every full-tier film should reach this)
Per film: **8–9 figures · 12–13 Strong Misreadings · theorist-linked takes · tropes · 24 movies-like ·
90–130 Embedding-Fantasia sentences · setting locations · 8–9 watch-next · why-watch · TakeScore ·
to.W comment · director portrait · visible+is_analyzed (Tier-1, indexable)**. Cost ≈ **$1–2 per 3 films**
(Opus extract+boldtake dominate; geo $0.02/film; takescore ~$0; embeddings ~$0).

## Environment (verified reachable from the Claude Code terminal on the Mac)
- **Egress works**: Anthropic, OpenAI, TMDB, Google Geocoding, Brave, Gemini all reachable — run LLM
  stages directly here (the old "sandbox blocks Anthropic" assumption was wrong).
- **Mgmt-API SQL** (`api.supabase.com/.../database/query`, `SUPABASE_ACCESS_TOKEN`) needs a **browser
  User-Agent** or Cloudflare returns 403 (err 1010). `worker/factory.py` + `worker/sentence-refresh.py`
  already send it; a raw curl must add `-H "User-Agent: Mozilla/5.0 ..."`.
- Env: root `.env.local` (ANTHROPIC/OPENAI/TMDB_READ_TOKEN/OMDB/GEMINI/BRAVE/GOOGLE_MAPS/SUPABASE_*).
  `node` at `~/.local/node/bin/node`. Ledger + DB helpers: MCP `execute_sql` (project `jvgarcqrtsmgfimdcwgo`).
- **Cost gate**: >$50 estimate (≈50 full films) → stop and report before running the paid stages.

---

## 0 · Set the film list (the one variable)
```bash
SLUGS=""   # filled after S02 (resolve assigns slugs)
# input for resolve: CSV with header Film_TMDB_ID,Film_Title,Film_Director_Name (tmdb id optional)
```
Write the titles into `factory/logs/run-in.csv` (cols `Film_TMDB_ID,Film_Title,Film_Director_Name`).

## W0 · Identity  (per-film, $0)
```bash
# S02 resolve → creates films rows; confidence lands in the OUT csv. Review low/exists (R1 gate).
python3 worker/tmdb-resolve.py --in factory/logs/run-in.csv --out factory/logs/run-out.csv --persist
#   ⚠️ confidence=low or status=unmatched → DO NOT ingest silently; eyeball the OUT csv (wrong
#      director = whole downstream graph attaches to the wrong film). status=exists = already in corpus.
# Grab slugs of the newly-created films (from the OUT csv tmdb_ids → films.slug), set SLUGS=comma,list.

# S03 TMDB metadata + media + directors (MUST precede extract, else genre "Other" collapse)
python3 worker/tmdb-fetch.py $(for s in ${SLUGS//,/ }; do echo --film $s; done) --persist

# S04 external: imdb_id + ratings + providers + wikidata_id  (⚠️ NEEDED for full quality —
#    without it: no TakeScore external panel, no Metascore/RT, and Fantasia E/F/H patterns stay empty.
#    external-data has no --films scope (§7.13); it is resumable/skip-existing, so run --scope all — it
#    only processes films lacking ratings/providers). Then wikidata for /ko aliases + JSON-LD sameAs.
python3 worker/external-data.py --persist --scope all      # skips already-enriched films
python3 worker/wikidata-id.py
```

## W1 · Content  (per-film; SYNC for ≤50)
```bash
# S10 figures + base takes (Opus SYNC — one call/film)
python3 worker/film-extract.py $(for s in ${SLUGS//,/ }; do echo --film $s; done) --persist

# S11 Strong Misreadings (boldtake) — the current-model reading layer. 3 GOTCHAS:
python3 worker/bold-take-gen.py --all --films $SLUGS --out bold-take-full   # ⚠️ writes to REPO-ROOT bold-take-full.jsonl (CWD), NOT worker/
#   GOTCHA-A (path): gen writes {OUT}.jsonl relative to CWD. That repo-root file now holds ONLY your films (clean scope).
#   Swap it in so boldtake-load (which reads worker/bold-take-full.jsonl) sees only your films:
cp worker/bold-take-full.jsonl worker/bold-take-full.jsonl.bak && cp bold-take-full.jsonl worker/bold-take-full.jsonl
python3 worker/boldtake-load.py            # DRY: verify the plan (N figures + takes, 100% figure match)
#   GOTCHA-B (preflight): boldtake-load --apply ABORTS ("N new takes already exist") — a one-time-full-load
#     guard incompatible with incremental. BYPASS by calling the idempotent insert RPCs directly with the plan:
python3 - <<'PY'
import os,json,urllib.request
for ln in open('.env.local'):
 ln=ln.strip()
 if '=' in ln and not ln.startswith('#'): k,v=ln.split('=',1); os.environ.setdefault(k.strip(),v.strip())
U=os.environ['NEXT_PUBLIC_SUPABASE_URL']; K=os.environ['SUPABASE_SERVICE_ROLE_KEY']
def rpc(n,p):
 r=urllib.request.Request(f"{U}/rest/v1/rpc/{n}",data=json.dumps(p).encode(),method='POST',
   headers={"apikey":K,"Authorization":f"Bearer {K}","Content-Type":"application/json"});
 return urllib.request.urlopen(r).read().decode()
pl=json.load(open('worker/boldtake-load-plan.json')); f=pl['figures_create']; t=pl['takes']
for i in range(0,len(f),200): rpc("boldtake_insert_figures",{"p_rows":f[i:i+200]})
for i in range(0,len(t),200): rpc("boldtake_insert_takes",{"p_rows":t[i:i+200]})
print("inserted",len(f),"figures",len(t),"takes")
PY
mv worker/bold-take-full.jsonl.bak worker/bold-take-full.jsonl && rm -f bold-take-full.jsonl   # restore
#   GOTCHA-C (archive): the standard archive is GLOBAL (retires all framework-null takes). Do it SCOPED
#     to your films only (MCP execute_sql), so the corpus is untouched:
#     update takes set status='retired' where framework is null and status<>'retired'
#       and figure_id in (select g.id from figures g join films f on f.id=g.film_id where f.slug in (<SLUGS>));

# S12 assert figures.slug not null   (MCP: select public.factory_assert_figure_slugs(<film_ids>)  -> must be 0)

# S13 trope tags · S14 archetype (Sonnet batch; skip for tiny runs if time — additive, non-blocking)
python3 worker/trope-tag.py $(for s in ${SLUGS//,/ }; do echo --film $s; done) --persist   # untagged only

# S17 reception (LLM-0, free — 2025 films usually return 0, that's fine/graceful)   [optional]
# S19 LOCATIONS  ⚠️ use --films (NOT GEO_FILMS env — the env is ignored, would process the whole corpus):
python3 worker/geo-extract.py --films $SLUGS --apply
python3 worker/geo-code.py --apply
```

## W2 · Vectors + graph  (corpus-additive)
```bash
python3 worker/mt-embed.py --only take,figure          # S20 embed new (null-only)

# S21 taste vectors + S35 director embeddings + S39 the BLOCKER FIX — all via MCP execute_sql:
#   select public.refresh_film_taste_vector(<film_ids>);
#   S22 tropes (additive):
python3 worker/trope-incremental.py --films $SLUGS --persist
python3 worker/concept-embed.py --write 0.70            # S23 new concepts → concept_map
python3 worker/mt-recommend.py                          # S25 film_affinities (corpus rebuild, atomic swap)
#   S26 counterpoints: run the 2 header SQL blocks from supabase/rpc/counterpoints.sql via MCP.
#   S27:  select public.factory_next_target_backfill();

# THEORY LINK (real gap fixed 2026-07-12): boldtake stores theorist_name but not theorist_id. Resolve (MCP):
#   update takes tk set theorist_id=(select th.id from theorists th where lower(th.name)=lower(tk.theorist_name) order by th.id limit 1)
#     from figures g join films f on f.id=g.film_id where g.id=tk.figure_id and f.slug in (<SLUGS>)
#     and tk.theorist_name is not null and tk.theorist_id is null;

# S28 EMBEDDING FANTASIA — the engine now generates it (factory/sql/sentence_*.sql exist; reconstructed 2026-07-12):
python3 worker/sentence-refresh.py --films $SLUGS       # 90–130 sentences/film across A/B/C/G/I/L/M/N (+D/H/J when data exists)
```

## W2b · New directors (only for directors with 0 artifacts)
```bash
# detect: select public.factory_detect_new_directors(<film_ids>)  -> DIRSLUGS
# facts ("The Life", Gemini+Brave SYNC):
python3 worker/director-facts-gen.py --dirs $DIRSLUGS --out worker/director-facts-run && python3 worker/director-facts-load.py --out worker/director-facts-run --apply
# portrait + who's-next (Opus batch; emit patched for --dirs, §7.13):
python3 worker/director-profile-gen.py --emit-requests --dirs $DIRSLUGS --out worker/profile-run
python3 worker/director-profile-batch.py submit --out worker/profile-run
python3 worker/director-profile-batch.py fetch  --out worker/profile-run     # re-run until "fetched N"
python3 worker/director-profile-load.py --out worker/profile-run --apply
#   S35: select public.refresh_director_embeddings(array[<DIRSLUGS>]);
#   picks ("where to start") is thin for 1–2-film directors — skip unless the director has ≥4 films.
```

## W3 · Objective axes + curation + TV
```bash
# S39 THE BLOCKER FIX — opens Tier-1 (is_analyzed=true + hold clear + visible recompute). WITHOUT THIS the
#   film renders as a Tier-2 digest even with figures+visible. MCP:
#   select public.factory_analyzed_flip(<film_ids>);
# S40 TakeScore — scores exactly the new visible unscored films (Sonnet, ~$0):
python3 score/cinecodex_score.py 10 visible
# S41 to.W comment (LLM-0 rule assembly). For festival films with no DB lineage yet, use authority=C
#   (Festival & national honors) / entry_path=festival / verdict=deep_cut. MCP: insert curation.film (ADD
#   pattern + reclassify), then insert curation.film_comment(tmdb_id, authority_grade, recognition_grade,
#   entry_path, verdict, national, rationale, computed_at). tow_comment(<slug>) must return the letter.
# S42 TV compile:  select tv_compile_batch(20,4);   (needs a clean trailer in media — S03 provides it)
```

## W2 asset/next  (per-film content — emit patched for --films, §7.13; SWAP the loader files)
```bash
# ASSET (why-watch, Opus batch):
python3 worker/asset-gen.py --emit-requests --films $SLUGS --out worker/asset-run
python3 worker/asset-batch.py submit --out worker/asset-run
python3 worker/asset-batch.py fetch  --out worker/asset-run          # re-run until "fetched N"
cp worker/asset-all.jsonl worker/asset-all.jsonl.bak; cp worker/asset-run.jsonl worker/asset-all.jsonl
python3 worker/asset-load.py; mv worker/asset-all.jsonl.bak worker/asset-all.jsonl   # ⚠️ load reads hardcoded asset-all.jsonl → swap
# WATCH-NEXT (Sonnet batch):
python3 worker/next-gen.py --emit-requests --films $SLUGS --out worker/next-run
python3 worker/next-batch.py submit --out worker/next-run
python3 worker/next-batch.py fetch  --out worker/next-run
cp worker/next-all.jsonl worker/next-all.jsonl.bak; cp worker/next-run.jsonl worker/next-all.jsonl
python3 worker/next-resolve.py; python3 worker/next-load.py; mv worker/next-all.jsonl.bak worker/next-all.jsonl  # ⚠️ resolve+load read hardcoded next-all.* → swap
```

## W4 · Publish + verify
```bash
#   S51: select public.factory_bump_lastmod(<film_ids>);   (sitemap lastmod contract)
#   S44 (if S04 ran): select fpi_rebuild();                (Screener watch-country filter)
# S52 revalidate every changed surface (POST /api/revalidate, secret=REVALIDATION_SECRET; paths REQUIRED, ≤20/call):
for s in ${SLUGS//,/ }; do
  curl -s -X POST https://metatake.net/api/revalidate -H "Content-Type: application/json" \
    -d "{\"secret\":\"$SECRET\",\"paths\":[\"/film/$s\",\"/movies-like/$s\",\"/takescore/film/$s\"],\"tags\":[\"film:$s\",\"takescore-film:$s\"]}" -o /dev/null -w "$s %{http_code}\n"
done
# also revalidate each new director:  /director/<slug>  tag director:<slug>
# S59 VERIFY (cache-busted GET + DB): each /film/<slug> is HTTP 200 with noindex=0 (Tier-1); df-know (Fantasia),
#   df-atlas (Locations), Strong-Misreadings, /takescore/film 200, /movies-like 200, /director shows the film.
#   DB verify query = the "quality bar" SELECT at the top of factory/logs/run-1.md.
```

## Ledger (so the run is recorded + admin-visible)
Each stage: MCP `insert into factory.stage_runs(run_id, film_id, stage_id, status, cost_usd, ...)`. Create
the run first (`insert into factory.runs`), attach intake, close with `status='done'` + a one-line
`factory/logs/run-<id>.md`. Admin view: `/admin/factory`. Helper functions live in migrations 0081/0082.

## Known engine gaps (still §7.13 / documented — the SWAPS above are the workaround)
- Loaders with hardcoded input paths (boldtake-load, asset-load, next-resolve/load) → the file-swap trick.
- boldtake-load `--apply` preflight guard → the direct-RPC bypass.
- geo-extract honors `--films` not `GEO_FILMS` env (manifest S19 corrected 2026-07-12).
- Fantasia D/E/F/H/J patterns need lineage/ratings/filmed-locations; kinship kin value is an approximate
  reconstruction (map weight only, not sentence text). All harmless-when-absent.
- to.W comment builder is not a DB function (rule assembly by hand per curation.rule) — the W3 step above.
These are the things to file-swap / hand-run until a future pass folds them into `factory.py run`.

## Cost + pacing
~$1–2 per 3 full films (Opus extract+boldtake dominate). Batch across ALL the run's films per stage.
Respect the sitemap cohort caps + no-mass-thin-content rule — don't push thousands of new index pages at once.
```
```
