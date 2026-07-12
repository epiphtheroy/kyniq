#!/usr/bin/env python3
"""
sentence-refresh.py — The Film Factory stage S28 (Embedding Fantasia sentence layer).
Canonical design: HANDOFF-영화공장.md §7.3 · sentence-engine/MASS-PRODUCTION.md (ops runbook §"Ops runbook").

WHAT THIS DOES (per-film Embedding Fantasia refresh, LLM-0, idempotent):
  Runs the refresh order from MASS-PRODUCTION.md, scoped to the films passed on --films:
    ① sentence_node_stats     (catalog-wide film count per interpretation node — rarity)
    ② sentence_concept_stats  (film count + earliest holder per (theorist, concept) lens)
    ③ film_kinship            (kin index = cos·40 + tfidf·25 + shared-node rarity·35)
    ④ 13 pattern INSERTs      (A_affinity … N_question) into film_sentences

BRAND-CONTRACT / FACTUAL-SENTENCE SAFETY — WHY THIS IS FILE-GATED, NOT RECONSTRUCTED
  The exact fill SQL for these steps was NEVER committed to the repo. MASS-PRODUCTION.md
  states plainly: "The full fill SQL for all 12 patterns = this session's statements".
  Grep confirms there is no stored INSERT for sentence_node_stats / sentence_concept_stats /
  film_kinship / the pattern fills anywhere under sentence-engine/ or supabase/. The .md gives
  only prose (formulas, join intent) — NOT enough to reproduce the precise joins, the
  `takes.status='published'` gates, the possessive/label-cleaning fixes, or the kin cos/tfidf
  math exactly. Fabricating them would corrupt live, entity-linked, factual sentences and
  violate the brand contract (designer attribution + Not-AI disclaimer). So EVERY step is
  guarded behind a canonical .sql file. If a step's file is absent, this script prints a
  precise TODO and SKIPS that step (documented no-op) rather than guessing.

  Extract the canonical SQL from the 2026-07-11 MASS-PRODUCTION session into these files
  (each must be idempotent: `ON CONFLICT DO NOTHING`):
    factory/sql/sentence_node_stats.sql
    factory/sql/sentence_concept_stats.sql
    factory/sql/film_kinship.sql
    factory/sql/sentence_patterns.sql        (the 13 pattern INSERTs)

SQL FILE CONTRACT (filter injection)
  Each file may reference these placeholders; the script substitutes them before executing:
    {film_ids}        -> comma-separated quoted uuids for an IN-list:  '<uuid>','<uuid>'
    {film_ids_array}  -> array['<uuid>',...]::uuid[]                   (for = any(...))
    {slugs}           -> comma-separated quoted slugs for an IN-list:  'slug','slug'
  A file with none of these runs unscoped (corpus-wide) — allowed for the aggregate stats
  (①②③ are catalog-wide by nature) but DISCOURAGED for ④ (patterns must be film-scoped).
  Statement batching: if a file contains the line `-- @@split`, it is split on that marker
  and each chunk is sent as a separate Management-API call (use for the G/I hex-bucket
  self-joins per the runbook's server-load lessons); otherwise the whole file is one call.

CLI
  sentence-refresh.py --films slug,slug [--dry]
  --dry : resolve films + report exactly which steps are safe-live vs TODO; execute nothing.

stdlib-only. Env from .env.local. Management API SQL channel (mgmt_query) — identical to
worker/factory.py. Exit 0 on a clean run OR a documented no-op (missing files ≠ failure).
Exit 2 only on hard errors (no films resolved, SQL execution error).
"""
import sys, os, json, argparse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_REF = "jvgarcqrtsmgfimdcwgo"
SQLDIR = os.path.join(ROOT, "factory", "sql")

# Ordered pipeline: (short label, sql filename, safe-unscoped?) — order is load-bearing.
STEPS = [
    ("① sentence_node_stats",    "sentence_node_stats.sql",    True),
    ("② sentence_concept_stats", "sentence_concept_stats.sql", True),
    ("③ film_kinship",           "film_kinship.sql",           True),
    ("④ 13-pattern fill",        "sentence_patterns.sql",      False),
]


# ----------------------------------------------------------------------------- env
def load_env():
    p = os.path.join(ROOT, ".env.local")
    if os.path.exists(p):
        for ln in open(p):
            ln = ln.strip()
            if "=" in ln and not ln.startswith("#"):
                k, v = ln.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


load_env()
SBP = os.environ.get("SUPABASE_ACCESS_TOKEN", "")


# ------------------------------------------------------------------- Management API
def mgmt_query(sql, timeout=180):
    """Run SQL via the Supabase Management API; returns list[dict] (or raises)."""
    if not SBP:
        raise RuntimeError("SUPABASE_ACCESS_TOKEN missing in .env.local")
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Authorization": f"Bearer {SBP}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            out = r.read().decode()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"mgmt SQL error {e.code}: {e.read().decode()[:400]}")
    return json.loads(out) if out.strip() else []


def sql_lit(s):
    return "'" + str(s).replace("'", "''") + "'"


# --------------------------------------------------------------------------- helpers
def resolve_films(slugs):
    """slug list -> [{slug, film_id}]; warns on any slug that does not resolve."""
    want = [s.strip() for s in slugs if s.strip()]
    if not want:
        return []
    inlist = ",".join(sql_lit(s) for s in want)
    rows = mgmt_query(f"select slug, id::text as film_id from public.films where slug in ({inlist});")
    found = {r["slug"] for r in rows}
    for s in want:
        if s not in found:
            print(f"  ⚠️  slug not found in public.films (skipped): {s}", file=sys.stderr)
    return rows


def inject_sql(sql_text, film_ids, slugs):
    """Substitute the filter placeholders documented in the header."""
    inlist = ",".join(sql_lit(fid) for fid in film_ids)
    arraylit = "array[" + ",".join(sql_lit(fid) for fid in film_ids) + "]::uuid[]"
    sluglist = ",".join(sql_lit(s) for s in slugs)
    return (sql_text
            .replace("{film_ids_array}", arraylit)
            .replace("{film_ids}", inlist)
            .replace("{slugs}", sluglist))


def run_sql_file(path, film_ids, slugs, dry):
    """Execute a canonical SQL file (split on -- @@split). Returns statements run."""
    raw = open(path, encoding="utf-8").read()
    has_placeholder = any(p in raw for p in ("{film_ids}", "{film_ids_array}", "{slugs}"))
    sql = inject_sql(raw, film_ids, slugs)
    chunks = [c.strip() for c in sql.split("-- @@split") if c.strip()]
    if dry:
        note = "" if has_placeholder else "  (UNSCOPED — no {film_ids}/{slugs} placeholder)"
        print(f"     DRY: would execute {len(chunks)} statement-group(s){note}")
        return 0
    for i, chunk in enumerate(chunks, 1):
        try:
            mgmt_query(chunk)
        except RuntimeError as e:
            # Runbook lesson: a timed-out *response* may still have committed. Surface loudly.
            raise RuntimeError(f"[group {i}/{len(chunks)}] {e}\n"
                               f"     ⚠️  If this was a TIMEOUT, VERIFY row counts before re-running "
                               f"(the write may have committed).")
    return len(chunks)


# ------------------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(prog="sentence-refresh.py",
                                 description="S28 Embedding Fantasia per-film refresh (LLM-0).")
    ap.add_argument("--films", required=True, help="comma-separated film slugs")
    ap.add_argument("--dry", action="store_true", help="resolve + report; execute nothing")
    a = ap.parse_args()

    films = resolve_films(a.films.split(","))
    if not films:
        print("ERROR: no films resolved from --films; nothing to do.", file=sys.stderr)
        sys.exit(2)
    film_ids = [f["film_id"] for f in films]
    slugs = [f["slug"] for f in films]

    print(f"=== S28 sentence-refresh ({'DRY' if a.dry else 'LIVE'}) — {len(films)} film(s) ===")
    for f in films:
        print(f"  · {f['slug']}  {f['film_id']}")

    safe_live, todos = [], []
    for label, fname, safe_unscoped in STEPS:
        path = os.path.join(SQLDIR, fname)
        if os.path.exists(path):
            print(f"\n{label}: canonical SQL found -> {os.path.relpath(path, ROOT)}")
            try:
                n = run_sql_file(path, film_ids, slugs, a.dry)
            except RuntimeError as e:
                print(f"  ✗ EXECUTION ERROR in {fname}:\n     {e}", file=sys.stderr)
                sys.exit(2)
            print(f"  ✓ {'planned' if a.dry else 'executed'} ({n} statement-group(s), ON CONFLICT DO NOTHING assumed)")
            safe_live.append(label)
        else:
            print(f"\n{label}: NO-OP — canonical SQL missing: {os.path.relpath(path, ROOT)}")
            print(f"  TODO: extract the canonical {label.split(' ',1)[1]} SQL from the "
                  f"2026-07-11 MASS-PRODUCTION session into that file. Until then this step is a "
                  f"documented no-op (never fabricated — would corrupt live factual sentences).")
            todos.append((label, os.path.relpath(path, ROOT)))

    # ANALYZE only if the pattern fill actually ran live (runbook: ANALYZE film_sentences after bulk load).
    patterns_ran = STEPS[3][0] in safe_live and not a.dry
    if patterns_ran:
        try:
            mgmt_query("analyze public.film_sentences;")
            print("\n  ✓ ANALYZE public.film_sentences")
        except RuntimeError as e:
            print(f"\n  ⚠️  ANALYZE skipped: {e}", file=sys.stderr)

    print("\n=== SUMMARY ===")
    print(f"  safe-live steps : {len(safe_live)}/{len(STEPS)} -> "
          f"{', '.join(s.split(' ',1)[1] for s in safe_live) or '(none)'}")
    if todos:
        print(f"  TODO (missing canonical SQL, no-op): {len(todos)}")
        for label, rel in todos:
            print(f"     - {label.split(' ',1)[1]}  ->  {rel}")
        print("  NOTE: stage S28 completed as a partial/documented no-op, NOT a corruption. "
              "Provide the missing files to make it fully live.")
    # Missing files are an intentional, safe outcome — do not fail the stage on them.
    sys.exit(0)


if __name__ == "__main__":
    main()
