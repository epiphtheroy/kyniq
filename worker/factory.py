#!/usr/bin/env python3
"""
The Film Factory — orchestrator CLI.  Canonical design: HANDOFF-영화공장.md §6.
stdlib-only.  Two DB channels:
  * Supabase Management API  (factory schema I/O + arbitrary SQL / verify_sql)
  * (public tables/RPCs are reached through the same Management API query endpoint)

Subcommands
  add "Title (Year)" [--director D] [--tmdb-id N] [--tier full|catalog]
  enqueue <titles.csv> [--tier ...]          # or drop the CSV in factory/intake/
  ingest [path|-] [--tier ...]               # bulk: .csv OR plain "Title (Year)" lines, file path or stdin
                                             #   e.g.  factory.py ingest list.txt   |   pbpaste | factory.py ingest
  plan [--run N] [--write]                    # queued intake -> run + stage plan + cost estimate (DRY)
  review [--approve-all-high]                 # R1 gate: list/approve intake in 'review'
  run  [--run N] [--from Sxx] [--only Sxx] [--films slug,slug] [--yes]
  status [--run N]
  verify [--run N] [--films ...]
  gaps [--days 30]
  garden-queue
  lint                                        # manifest structural lint (sentinel reuses)

LLM stages (external=anthropic_*) run the worker scripts on the Mac; the Cowork
sandbox blocks Anthropic egress, so those stages are executed by the owner via
`run-factory-run.command`.  Control-plane commands (add/enqueue/plan/review/
status/verify/gaps/lint) work anywhere with Supabase reachability.
"""
import sys, os, csv, json, re, argparse, subprocess, urllib.request, urllib.error, hashlib
import time, shlex, concurrent.futures

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_REF = "jvgarcqrtsmgfimdcwgo"
MANIFEST = os.path.join(ROOT, "factory", "manifest.json")
LOGDIR = os.path.join(ROOT, "factory", "logs")
RUNSDIR = os.path.join(ROOT, "factory", "runs")
NODE = os.path.expanduser("~/.local/node/bin/node")
PY = sys.executable or "python3"

# run-time tunables (env-overridable so the executor never hard-codes a magic wait)
BATCH_POLL = int(os.environ.get("FACTORY_BATCH_POLL", "60"))          # seconds between fetch attempts
BATCH_MAX_WAIT = int(os.environ.get("FACTORY_BATCH_MAX_WAIT", "10800"))  # 3h ceiling per batch stage
HTTP_FANOUT = int(os.environ.get("FACTORY_FANOUT", "6"))             # parallel per-film http workers
# corpus stages that are GLOBAL derived-swaps not required for a new film to render — deferred to the
# garden pass unless --with-corpus is passed (matches the observed run #3, which skipped S26).
DEFER_CORPUS = {"S26-counterpoints"}
# sql_file fn -> live RPC (factory/sql/assertions.sql was applied as these functions in mig 0082)
SQLFILE_RPC = {"assert_figure_slugs", "next_target_backfill", "detect_new_directors",
               "analyzed_flip", "run_audit", "bump_lastmod"}
SQLFILE_RPC_NOARG = {"next_target_backfill"}


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
def mgmt_query(sql):
    """Run SQL via the Supabase Management API; returns list[dict] (or raises)."""
    if not SBP:
        raise RuntimeError("SUPABASE_ACCESS_TOKEN missing in .env.local")
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Authorization": f"Bearer {SBP}",
                                          "Content-Type": "application/json",
                                          # Cloudflare (err 1010) bans the default python-urllib UA
                                          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                                                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                                                        "Chrome/125.0 Safari/537.36"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = r.read().decode()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"mgmt SQL error {e.code}: {e.read().decode()[:400]}")
    return json.loads(out) if out.strip() else []


def q1(sql):
    rows = mgmt_query(sql)
    return rows[0] if rows else None


def sql_lit(s):
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


# ----------------------------------------------------------------------- manifest
def load_manifest():
    with open(MANIFEST) as f:
        return json.load(f)


def stages_sorted(m):
    return sorted(m["stages"], key=lambda s: (s.get("order", 999), s["id"]))


def lint(m):
    """Structural lint: fields, depends cycles, runner files, scoping. Returns list[str] errors."""
    errs = []
    ids = {s["id"] for s in m["stages"]}
    for s in m["stages"]:
        for f in ("id", "wave", "order", "class", "runner", "depends_on"):
            if f not in s:
                errs.append(f"{s.get('id','?')}: missing field {f}")
        for d in s.get("depends_on", []):
            if d not in ids:
                errs.append(f"{s['id']}: depends_on unknown stage {d}")
        # runner file existence
        r = s.get("runner", {})
        for key in ("script",):
            script = r.get(key)
            if script and not script.startswith(("http",)):
                if not os.path.exists(os.path.join(ROOT, script)):
                    errs.append(f"{s['id']}: runner script not found: {script}")
        for st in r.get("steps", []) + r.get("scripts", []) if isinstance(r.get("steps", []), list) else []:
            pass
        # Ω43: per_film stage must be scope-safe
        if s.get("class") == "per_film":
            rr = s.get("runner", {})
            has_scope = (rr.get("per_film_arg") or s.get("scoped_by_eligibility")
                         or rr.get("type") in ("internal", "sql_file", "sql_ref", "rpc", "rpc_loop", "http"))
            needs_patch = rr.get("needs_scoping_patch") or s.get("blocked_by")
            if not has_scope and not needs_patch:
                errs.append(f"{s['id']}: per_film stage has no scoping (per_film_arg / scoped_by_eligibility)")
    # depends cycle (kahn)
    indeg = {s["id"]: 0 for s in m["stages"]}
    adj = {s["id"]: [] for s in m["stages"]}
    for s in m["stages"]:
        for d in s.get("depends_on", []):
            if d in adj:
                adj[d].append(s["id"]); indeg[s["id"]] += 1
    queue = [k for k, v in indeg.items() if v == 0]; seen = 0
    while queue:
        n = queue.pop(); seen += 1
        for c in adj[n]:
            indeg[c] -= 1
            if indeg[c] == 0:
                queue.append(c)
    if seen != len(m["stages"]):
        errs.append("depends_on graph has a cycle")
    return errs


# ------------------------------------------------------------------ intake / runs
def intake_add(source, title, year=None, director=None, tmdb_id=None, tier="full", by="cli"):
    eff_tier, eff_status = ("catalog", "review") if tier == "auto" else (tier, "queued")
    sql = (f"insert into factory.intake(source,raw_title,year_hint,director_hint,tmdb_id,tier,status,requested_by) "
           f"values({sql_lit(source)},{sql_lit(title)},{year or 'null'},{sql_lit(director)},"
           f"{tmdb_id or 'null'},{sql_lit(eff_tier)},{sql_lit(eff_status)},{sql_lit(by)}) returning id;")
    return q1(sql)["id"]


def cmd_add(a):
    m = re.match(r"^(.*?)(?:\s*\((\d{4})\))?$", a.title.strip())
    title = m.group(1).strip(); year = int(m.group(2)) if m.group(2) else a.year
    nid = intake_add("cli", title, year, a.director, a.tmdb_id, a.tier)
    print(f"intake #{nid}: {title} ({year or '?'}) tier={a.tier}")


def cmd_enqueue(a):
    path = a.csv
    n = 0
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            title = (row.get("title") or row.get("Film_Title") or "").strip()
            if not title:
                continue
            year = row.get("year") or None
            intake_add("csv", title, int(year) if year and year.isdigit() else None,
                       row.get("director") or None,
                       int(row["tmdb_id"]) if row.get("tmdb_id") else None,
                       (row.get("tier") or a.tier).strip())
            n += 1
    print(f"enqueued {n} rows from {path}")


def parse_film_lines(text):
    """Forgiving one-film-per-line parser (mirrors the admin parseFilmLines).
    CSV mode when the first meaningful line is a `title,...` header (cols title,year,director,tmdb_id,tier);
    else text mode: 'Title (Year)' (year optional) + optional `tmdb:12345` token and trailing `| 1999`.
    '#' and blank lines are skipped. Returns dict rows for factory_intake_add_batch."""
    lines = text.splitlines()
    first = next((l.strip() for l in lines if l.strip() and not l.strip().startswith("#")), "")
    if re.match(r"^(title|film_title)\s*,", first, re.I):
        body = [l for l in lines if l.strip() and not l.strip().startswith("#")]
        rows = []
        for r in csv.DictReader(body):
            title = (r.get("title") or r.get("Film_Title") or r.get("film_title") or "").strip()
            if not title:
                continue
            y = (r.get("year") or "").strip(); tm = (r.get("tmdb_id") or "").strip()
            rows.append({"title": title, "year": y if y.isdigit() else None,
                         "director": (r.get("director") or "").strip() or None,
                         "tmdb_id": tm if tm.isdigit() else None,
                         "tier": (r.get("tier") or "").strip() or None})
        return rows
    rows = []
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        s = line; tmdb = None; year = None
        # 1. explicit `tmdb:12345` / `tmdb=12345` token anywhere
        mt = re.search(r"\btmdb[:=](\d+)\b", s, re.I)
        if mt:
            tmdb = mt.group(1); s = (s[:mt.start()] + s[mt.end():]).strip()
        # 2. explicit year via a `|` or `,` delimiter at the end: "Title | 1999"
        md = re.match(r"^(.*\S)\s*[|,]\s*(\d{4})\s*$", s)
        if md and 1870 <= int(md.group(2)) <= 2035:
            s = md.group(1).strip(); year = md.group(2)
        # 3. bare trailing TMDB id — "Title 496243" (>=3 digits so sequels like "Toy Story 2" are safe)
        if tmdb is None:
            mb = re.match(r"^(.+?)\s+(\d{3,})$", s)
            if mb:
                s = mb.group(1).strip(); tmdb = mb.group(2)
        # 4. year in parens: "Title (2019)"
        mp = re.match(r"^(.*?)\s*\((\d{4})\)\s*$", s)
        if mp:
            s = mp.group(1).strip()
            if year is None:
                year = mp.group(2)
        title = s.strip()
        if not title:
            continue
        rows.append({"title": title, "year": year, "director": None, "tmdb_id": tmdb, "tier": None})
    return rows


def cmd_ingest(a):
    """Bulk intake from a file path, or stdin ('-'), or a pasted list. Accepts .csv or plain text.
    Uses factory_intake_add_batch (one round-trip, dedups repeats)."""
    src = a.path
    if not src or src == "-":
        text = sys.stdin.read(); source = "cli"
    else:
        text = open(src, encoding="utf-8").read()
        source = "csv" if src.lower().endswith(".csv") else "cli"
    rows = parse_film_lines(text)
    for r in rows:
        if not r.get("tier"):
            r["tier"] = a.tier
    if not rows:
        print("no films parsed (blank/comment-only input?)."); return
    n = q1(f"select public.factory_intake_add_batch({sql_lit(source)}, "
           f"{sql_lit(json.dumps(rows))}::jsonb, 'cli') as n")["n"]
    print(f"ingested {n} new film(s) into intake (parsed {len(rows)}; duplicates skipped).")
    print(f"next: python3 worker/factory.py queue   →   run --run <id> --yes   "
          f"(or /admin/factory: Add films / ▶ Queue a run)")


def cmd_review(a):
    rows = mgmt_query("select id,raw_title,year_hint,confidence,resolve_note,tier from factory.intake "
                      "where status='review' order by id;")
    if not rows:
        print("no intake in review."); return
    for r in rows:
        print(f"\n#{r['id']} {r['raw_title']} ({r['year_hint'] or '?'}) tier={r['tier']} "
              f"conf={r['confidence']}\n   note: {r['resolve_note']}")
        if a.approve_all_high and (r['confidence'] in ('high', 'given')):
            mgmt_query(f"select public.factory_intake_decide({r['id']},'approve');")
            print("   -> auto-approved (high)")
        else:
            print("   (approve: factory.py review --decide {id}:approve|reject, or use /admin/factory)")
    if a.decide:
        rid, act = a.decide.split(":")
        mgmt_query(f"select public.factory_intake_decide({int(rid)},'{act}');")
        print(f"#{rid} -> {act}")


# --------------------------------------------------------------------------- plan
def eligible_intake():
    return mgmt_query("select id,raw_title,year_hint,director_hint,tmdb_id,film_id,tier,status "
                      "from factory.intake where status in ('queued','approved') order by id;")


def estimate_cost(m, films_full, films_catalog):
    total = 0.0; breakdown = []
    for s in stages_sorted(m):
        tiers = s.get("tier", [])
        n = 0
        if "full" in tiers:
            n += films_full
        if "catalog" in tiers and "full" not in tiers:
            n += films_catalog
        elif "catalog" in tiers:
            n = films_full + films_catalog
        per = s.get("cost", {}).get("usd_per_film_est", 0) or 0
        if s.get("class") in ("corpus", "publication"):
            c = per  # once per run (est per-film already ~0 for these)
        else:
            c = per * n
        if c > 0:
            breakdown.append((s["id"], round(c, 3)))
        total += c
    return total, breakdown


def cmd_plan(a):
    m = load_manifest()
    errs = lint(m)
    if errs:
        print("MANIFEST LINT ERRORS (fix before running):")
        for e in errs:
            print("  -", e)
    intake = eligible_intake()
    if not intake:
        print("\nno queued/approved intake to plan."); return
    full = [r for r in intake if r["tier"] == "full"]
    catalog = [r for r in intake if r["tier"] == "catalog"]
    review = mgmt_query("select count(*) c from factory.intake where status='review';")[0]["c"]
    total, breakdown = estimate_cost(m, len(full), len(catalog))
    manifest_sha = hashlib.sha256(open(MANIFEST, "rb").read()).hexdigest()[:16]
    print(f"\n=== FACTORY PLAN (DRY) ===")
    print(f"intake: {len(intake)} eligible ({len(full)} full, {len(catalog)} catalog); "
          f"{review} awaiting R1 review")
    print(f"manifest: {len(m['stages'])} stages, sha {manifest_sha}")
    print(f"\nestimated cost: ${total:.2f}  (gate ${m.get('cost_gate_usd_default',50)})")
    for sid, c in breakdown:
        print(f"   {sid:22} ${c}")
    blocked = [s["id"] for s in m["stages"] if s.get("blocked_by")]
    if blocked:
        print(f"\n⚠️  {len(blocked)} stages BLOCKED pending worker-scoping-patch (§7.13):")
        print("   " + ", ".join(blocked))
        print("   -> these stages are lint-gated OFF until the patches ship; run will skip+park them.")
    if total > m.get("cost_gate_usd_default", 50):
        print(f"\n⚠️  COST GATE: ${total:.2f} > ${m['cost_gate_usd_default']} — run will pause for approval.")
    if a.write:
        run_id = create_run(intake, total, manifest_sha, "planning")
        print(f"\nrun #{run_id} written (status=planning, {len(intake)} intake linked).")
        print(f"Execute (terminal, token-free):  python3 worker/factory.py run --run {run_id} --yes")
        print(f"Dry-run the plan first:          python3 worker/factory.py run --run {run_id} --dry-run")


def create_run(intake, total, manifest_sha, status):
    """Insert a factory.runs row and link the intake rows to it (so run_load finds the films)."""
    run_id = q1(f"insert into factory.runs(mode,film_count,est_cost_usd,status,manifest_sha) "
                f"values('bulk',{len(intake)},{total:.2f},{sql_lit(status)},{sql_lit(manifest_sha)}) returning id;")["id"]
    ids = ",".join(str(r["id"]) for r in intake)
    if ids:
        mgmt_query(f"update factory.intake set run_id={run_id} where id in ({ids}) and run_id is null;")
    return run_id


def cmd_queue(a):
    """Create a run from eligible intake and mark it status='queued' so the Mac watcher executes it.
    Calls factory_queue_run() — the SAME RPC the /admin/factory 'Run' button uses (single source)."""
    m = load_manifest()
    intake = mgmt_query("select id,tier from factory.intake "
                        "where status in ('queued','approved') and run_id is null;")
    if not intake:
        print("no eligible intake (queued/approved, unlinked) to run."); return
    full = [r for r in intake if r["tier"] == "full"]; catalog = [r for r in intake if r["tier"] == "catalog"]
    total, _ = estimate_cost(m, len(full), len(catalog))
    manifest_sha = hashlib.sha256(open(MANIFEST, "rb").read()).hexdigest()[:16]
    run_id = q1("select public.factory_queue_run() as id")["id"]
    if not run_id:
        print("no eligible intake to queue."); return
    # stamp the run's estimate + manifest sha (RPC leaves them null; cheap advisory fields)
    mgmt_query(f"update factory.runs set est_cost_usd={total:.2f}, manifest_sha={sql_lit(manifest_sha)} where id={run_id};")
    print(f"run #{run_id} QUEUED — {len(intake)} films, est ${total:.2f}. "
          f"The Mac watcher (factory-watch.sh) will pick it up; or run now: "
          f"python3 worker/factory.py run --run {run_id} --yes")


# ------------------------------------------------------------------------- status
def cmd_status(a):
    data = q1(f"select public.factory_matrix_json({a.limit}) j;")["j"]
    runs = data.get("runs", []); intake = data.get("intake", []); stages = data.get("stages", [])
    print("=== RUNS ===")
    for r in runs[:10]:
        print(f"  #{r['id']} {r['mode']} films={r['film_count']} ${r.get('est_cost_usd')} {r['status']}")
    if not runs:
        print("  (none)")
    print("\n=== INTAKE (recent) ===")
    for i in intake[:20]:
        fid = (i.get('film_id') or '')[:8]
        print(f"  #{i['id']} {str(i['raw_title'])[:40]:40} {i['tier']:7} {i['status']:9} conf={i.get('confidence')} film={fid}")
    if stages:
        from collections import Counter
        c = Counter((s['stage_id'], s['status']) for s in stages)
        print("\n=== STAGE STATUS (recent) ===")
        seen = set()
        for (sid, st), n in sorted(c.items()):
            print(f"  {sid:22} {st:9} x{n}")


def cmd_gaps(a):
    data = q1(f"select public.factory_gaps_json({a.days}) j;")["j"]
    print(f"=== DATA-DRIFT GAPS (last {data['days']}d, {data['total_recent']} films) ===")
    for k, v in data["deficits"].items():
        flag = "  ⚠️" if v else ""
        print(f"  {k:22} {v}{flag}")
    print(f"\n  sample deficient films: {len(data['sample'])} (see --json for detail)")
    if a.json:
        print(json.dumps(data, indent=1, ensure_ascii=False))


# ------------------------------------------------------------------------- verify
def cmd_verify(a):
    m = load_manifest()
    run = a.run or q1("select max(id) id from factory.runs")["id"]
    if not run:
        print("no runs."); return
    films = mgmt_query(f"select i.film_id, f.slug from factory.intake i join public.films f on f.id=i.film_id "
                       f"where i.run_id={run} and i.film_id is not null;")
    if a.films:
        want = set(a.films.split(","))
        films = [x for x in films if x["slug"] in want]
    print(f"=== VERIFY run #{run} ({len(films)} films) ===")
    for s in stages_sorted(m):
        vs = s.get("verify_sql")
        if not vs or s.get("class") not in ("per_film",):
            continue
        ok = bad = 0
        for fr in films:
            sql = vs.replace("{film_id}", fr["film_id"]).replace("{slug}", fr["slug"])
            try:
                row = q1(f"select ({sql}) as v;")
                (ok if row and row["v"] else bad).__class__  # noqa
                if row and row.get("v"):
                    ok += 1
                else:
                    bad += 1
            except Exception as e:
                bad += 1
        mark = "✓" if bad == 0 else "✗"
        print(f"  {mark} {s['id']:22} ok={ok} bad={bad}")


# ------------------------------------------------------------------- garden queue
def cmd_garden(a):
    rows = q1("""select
      (select count(*) from takes tk join figures fg on fg.id=tk.figure_id
        where tk.status='published' and coalesce(tk.is_invitation,false)=false and tk.trope_id is null) as unassigned_takes,
      (select count(*) from films where coalesce(hold,false)) as held,
      (select count(*) from films f where not f.is_analyzed and f.visible=false
        and (select count(*) from figures g where g.film_id=f.id and g.status='approved') between 1 and 2) as under3_with_figs
    """)
    print("=== GARDEN QUEUE (feeds quarterly garden pass) ===")
    for k, v in rows.items():
        print(f"  {k:22} {v}")
    print("\n  (new-trope formation, recluster/dedupe, galaxy rebuild, film_scores, cohort raise = garden only)")


# ------------------------------------------------------------------------- run
# =============================================================================
# EXECUTOR  —  factory.py run  (standalone; NO Claude tokens; workers use their
# own API keys). Drives the manifest stage-by-stage with a ledger + verify gate.
# =============================================================================
DRY = False  # set by cmd_run when --dry-run


def uuid_array(ids):
    return "array[" + ",".join(sql_lit(i) for i in ids) + "]::uuid[]" if ids else "array[]::uuid[]"


def text_array(xs):
    return "array[" + ",".join(sql_lit(x) for x in xs) + "]::text[]" if xs else "array[]::text[]"


def sh(cmd, cwd=ROOT, quiet=False):
    """Run a subprocess (list-form; no shell). Returns (rc, stdout). Honors DRY."""
    printable = " ".join(shlex.quote(c) for c in cmd)
    if not quiet:
        print(f"      $ {printable}")
    if DRY:
        return 0, ""
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env=os.environ, timeout=BATCH_MAX_WAIT)
    except subprocess.TimeoutExpired:
        print("      ! TIMEOUT"); return 124, ""
    if r.returncode != 0:
        tail = (r.stderr or r.stdout or "")[-600:]
        print(f"      ! exit {r.returncode}: {tail}")
    return r.returncode, r.stdout or ""


def pyw(script, args):
    return [PY, os.path.join(ROOT, script)] + list(args)


def subst(v, ctx):
    if isinstance(v, str):
        for k, val in ctx.items():
            v = v.replace("{" + k + "}", val)
        return v
    if isinstance(v, list):
        return [subst(x, ctx) for x in v]
    if isinstance(v, dict):
        return {k: subst(x, ctx) for k, x in v.items()}
    return v


# ------------------------------------------------------------------- ledger
def ledger(run_id, stage_id, status, film_id=None, cost=0.0, batch_id=None, error=None, verify=None):
    if DRY:
        return
    fin = "now()" if status in ("done", "parked", "skipped", "failed", "partial") else "null"
    q = (f"insert into factory.stage_runs(run_id,stage_id,film_id,status,cost_usd,batch_id,error,verify_result,started_at,finished_at) "
         f"values({run_id},{sql_lit(stage_id)},{sql_lit(film_id)},{sql_lit(status)},{cost},"
         f"{sql_lit(batch_id)},{sql_lit(error)},{('%s::jsonb' % sql_lit(json.dumps(verify))) if verify is not None else 'null'},"
         f"now(),{fin}) "
         f"on conflict (run_id,stage_id,film_id) do update set status=excluded.status, cost_usd=excluded.cost_usd, "
         f"batch_id=coalesce(excluded.batch_id,factory.stage_runs.batch_id), error=excluded.error, "
         f"verify_result=coalesce(excluded.verify_result,factory.stage_runs.verify_result), finished_at=excluded.finished_at;")
    try:
        mgmt_query(q)
    except Exception as e:
        print(f"      (ledger write failed: {e})")


# ---------------------------------------------------------------- run loading
def run_load(run_id):
    run = q1(f"select * from factory.runs where id={run_id};")
    films = mgmt_query(
        f"select i.film_id, f.slug, i.tier, coalesce(f.tmdb_id,i.tmdb_id) tmdb_id, i.source, "
        f"coalesce(f.hold,false) hold, f.is_analyzed "
        f"from factory.intake i join public.films f on f.id=i.film_id "
        f"where i.run_id={run_id} and i.film_id is not null and i.status in ('approved','queued','done') "
        f"order by f.slug;")
    return run, films


def stage_films(stage, films):
    tiers = set(stage.get("tier", []))
    return [x for x in films if x["tier"] in tiers]


def build_ctx(run_id, films, extra=None):
    slugs = [f["slug"] for f in films]
    fids = [f["film_id"] for f in films]
    ctx = {
        "run_id": str(run_id),
        "slugs": ",".join(slugs),
        "film_ids": uuid_array(fids),
        "film_ids_sql": uuid_array(fids),
        "run_csv": os.path.join(RUNSDIR, f"run-{run_id}.csv"),
        "run_csv_resolved": os.path.join(RUNSDIR, f"run-{run_id}-resolved.csv"),
        "REVALIDATION_SECRET": os.environ.get("REVALIDATION_SECRET", ""),
        "dir_slugs": ",".join((extra or {}).get("dir_slugs", [])),
        "new_urls": " ".join((extra or {}).get("new_urls", [])),
    }
    return ctx


# ------------------------------------------------------------- W0 resolve/tier
def stage_resolve(run_id, m):
    """S02: fill intake.film_id for rows lacking it (bulk CSV path). Idempotent."""
    unresolved = mgmt_query(f"select id,raw_title,year_hint,director_hint,tmdb_id from factory.intake "
                            f"where run_id={run_id} and film_id is null;")
    if not unresolved:
        print("      all intake rows already resolved (film_id set) — skip"); return 0, 0.0
    os.makedirs(RUNSDIR, exist_ok=True)
    csvp = os.path.join(RUNSDIR, f"run-{run_id}.csv")
    outp = os.path.join(RUNSDIR, f"run-{run_id}-resolved.csv")
    if not DRY:
        with open(csvp, "w", newline="") as fh:
            # tmdb-resolve.py reads Film_TMDB_ID / Film_Title / Film_Director_Name (a supplied
            # tmdb_id is trusted = confidence 'given' -> upserted as a new film by --persist).
            w = csv.writer(fh); w.writerow(["Film_TMDB_ID", "Film_Title", "Film_Director_Name"])
            for r in unresolved:
                w.writerow([r["tmdb_id"] or "", r["raw_title"], r["director_hint"] or ""])
    rc, _ = sh(pyw("worker/tmdb-resolve.py", ["--in", csvp, "--out", outp, "--persist"]))
    # Robust backfill: link intake -> films. When a tmdb_id was supplied it is AUTHORITATIVE —
    # match ONLY by tmdb_id (never fall back to title, which can hit a different film that merely
    # shares the title, e.g. Faust 1926 vs Faust 2011). Title-match only rows that have no tmdb_id.
    if not DRY:
        mgmt_query(f"""update factory.intake i set film_id=f.id from public.films f
                       where i.run_id={run_id} and i.film_id is null
                         and i.tmdb_id is not null and f.tmdb_id=i.tmdb_id;""")
        mgmt_query(f"""update factory.intake i set film_id=f.id from public.films f
                       where i.run_id={run_id} and i.film_id is null
                         and i.tmdb_id is null and lower(f.title)=lower(i.raw_title);""")
        # flag exists-stub promotions (film pre-existed held / un-analyzed)
        mgmt_query(f"""update factory.intake i set source='promotion'
                       from public.films f
                       where i.run_id={run_id} and i.film_id=f.id
                         and (coalesce(f.hold,false) or not coalesce(f.is_analyzed,false))
                         and i.source <> 'promotion';""")
        still = q1(f"select count(*) c from factory.intake where run_id={run_id} and film_id is null")["c"]
        if still:
            print(f"      ⚠️ {still} rows unresolved -> parked to intake.status='review' (R1)")
            mgmt_query(f"update factory.intake set status='review' where run_id={run_id} and film_id is null")
    return rc, 0.0


# ---------------------------------------------------------- runner dispatchers
def run_shell(stage, films, ctx):
    r = stage["runner"]; script = r["script"]; base = subst(r.get("submit_args", []), ctx)
    pfa = r.get("per_film_arg")
    if pfa and "{slug}" in pfa and "{slugs}" not in pfa:
        # per-film fan-out (thread pool) — e.g. tmdb-fetch --film {slug}
        def one(f):
            args = base + subst(pfa, {"slug": f["slug"]}).split()
            return sh(pyw(script, args), quiet=True)[0]
        rcs = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=HTTP_FANOUT) as ex:
            for rc in ex.map(one, films):
                rcs.append(rc)
        bad = sum(1 for x in rcs if x != 0)
        print(f"      fan-out {len(films)} films, {bad} nonzero")
        return 1 if bad else 0
    args = base + (subst(pfa, ctx).split() if pfa else [])
    return sh(pyw(script, args))[0]


def run_shell_seq(stage, films, ctx):
    for step in stage["runner"]["steps"]:
        rc, _ = sh(pyw(step["script"], subst(step.get("args", []), ctx)))
        if rc != 0:
            return rc
    return 0


# The batch-fetch workers exit 0 EVEN WHEN THE BATCH IS STILL RUNNING (they print
# "Not ready yet — re-run later" and return). So exit code alone is NOT a completion
# signal — we must poll on the worker's own status text until it actually persists.
_BATCH_PENDING = ("not ready", "still processing", "re-run this command later", "re-run fetch later",
                  "status=in_progress", "status=validating", "status=finalizing", "status=canceling")


def _batch_poll_fetch(script, fetch_args, ctx):
    waited = 0
    while True:
        rc, out = sh(pyw(script, subst(fetch_args, ctx)), quiet=(waited > 0))
        pending = any(s in out.lower() for s in _BATCH_PENDING)
        if rc == 0 and not pending:
            return 0                       # worker persisted (batch ended) — real completion
        if DRY or waited >= BATCH_MAX_WAIT:
            return rc if rc != 0 else 1     # gave up waiting -> let failure_policy park it
        if waited == 0:
            print(f"      batch pending — polling every {BATCH_POLL}s (max {BATCH_MAX_WAIT}s)…")
        time.sleep(BATCH_POLL); waited += BATCH_POLL


def run_worker_batch(stage, films, ctx):
    r = stage["runner"]; script = r["script"]
    pfa = subst(r.get("per_film_arg", ""), ctx).split() if r.get("per_film_arg") else []
    rc, _ = sh(pyw(script, subst(r["submit_args"], ctx) + pfa))
    if rc != 0:
        return rc
    return _batch_poll_fetch(script, r["fetch_args"] + (r.get("per_film_arg", "").split() if False else []), ctx) \
        if r.get("per_film_arg") is None else _batch_poll_fetch(script, r["fetch_args"] + pfa, ctx)


def run_worker_batch_chain(stage, films, ctx):
    for step in stage["runner"]["steps"]:
        script = step["script"]
        if "submit_args" in step:  # the batch leg: submit then poll-fetch
            rc, _ = sh(pyw(script, subst(step["submit_args"], ctx)))
            if rc != 0:
                return rc
            rc = _batch_poll_fetch(script, step["fetch_args"], ctx)
        else:                       # emit / resolve / load legs
            rc, _ = sh(pyw(script, subst(step.get("args", []), ctx)))
        if rc != 0:
            return rc
    return 0


def run_sql_file(stage, films, ctx):
    r = stage["runner"]; fn = r.get("fn")
    if fn in SQLFILE_RPC:
        arg = "" if fn in SQLFILE_RPC_NOARG else ctx["film_ids"]
        if DRY:
            print(f"      select public.factory_{fn}({arg});"); return 0
        mgmt_query(f"select public.factory_{fn}({arg});"); return 0
    # no matching RPC (e.g. curation_upsert_new) -> execute the SQL file body directly (idempotent upserts)
    path = os.path.join(ROOT, r["script"])
    body = subst(open(path).read(), ctx)
    if DRY:
        print(f"      exec {r['script']} ({len(body)} chars)"); return 0
    mgmt_query(body); return 0


def run_sql_ref(stage, films, ctx):
    r = stage["runner"]; path = os.path.join(ROOT, r["canonical"])
    if not os.path.exists(path):
        print(f"      canonical SQL not found: {r['canonical']} -> park"); return 1
    body = open(path).read()
    if DRY:
        print(f"      exec {r['canonical']} (first {r.get('header_blocks','all')} blocks)"); return 0
    mgmt_query(body); return 0


def run_rpc(stage, films, ctx):
    r = stage["runner"]; fn = r["fn"]; a = r.get("args", [])
    if a == "{film_ids}":
        call = f"public.{fn}({ctx['film_ids']})"
    elif a == "{dir_slugs}":
        call = f"public.{fn}({text_array(ctx['dir_slugs'].split(',') if ctx['dir_slugs'] else [])})"
    elif isinstance(a, list) and not a:
        call = f"public.{fn}()"
    else:
        call = f"public.{fn}({', '.join(str(x) for x in a)})"
    if DRY:
        print(f"      select {call};"); return 0
    mgmt_query(f"select {call};"); return 0


def run_rpc_loop(stage, films, ctx):
    r = stage["runner"]; fn = r["fn"]; a = r.get("args", [])
    call = f"public.{fn}({', '.join(str(x) for x in a)})"
    if DRY:
        print(f"      loop select {call}; until remaining=0"); return 0
    for _ in range(200):
        row = q1(f"select {call} as r;")
        rem = None
        if isinstance(row, dict):
            v = row.get("r")
            if isinstance(v, dict):
                rem = v.get("remaining")
            elif isinstance(v, int):
                rem = v
        if rem in (0, None):
            break
    return 0


def run_http(stage, films, ctx):
    r = stage["runner"]; url = subst(r["url"], ctx)
    # chunk films so paths+tags <= 20 per call
    chunk = []
    for i in range(0, len(films), 6):
        chunk.append(films[i:i + 6])
    for grp in chunk or [[]]:
        paths, tags = [], []
        for f in grp:
            fctx = {"slug": f["slug"]}
            for p in r["body"].get("paths", []):
                paths.append(subst(p, fctx))
            for t in r["body"].get("tags", []):
                tags.append(subst(t, fctx))
        body = {"secret": ctx["REVALIDATION_SECRET"], "paths": paths, "tags": tags}
        if DRY:
            print(f"      POST {url} paths={len(paths)} tags={len(tags)}"); continue
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                         headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:
            print(f"      ! revalidate error: {e}")
    return 0


def run_internal(stage, films, ctx):
    sid = stage["id"]
    if sid == "S56-warm":
        for f in films:
            u = f"https://metatake.net/film/{f['slug']}?__f={int(time.time()) if not DRY else 0}"
            if DRY:
                print(f"      GET {u}"); continue
            try:
                urllib.request.urlopen(urllib.request.Request(
                    u, headers={"User-Agent": "MetatakeBot/1.0 (+https://metatake.net/bot)"}), timeout=45).read()
            except Exception:
                pass
    # S01/S18/S58/S59 are report-only (S59 handled by cmd_run finalizer)
    return 0


DISPATCH = {
    "internal": run_internal, "shell": run_shell, "shell_seq": run_shell_seq,
    "shell_node": lambda s, f, c: sh([NODE, os.path.join(ROOT, s["runner"]["script"])] +
                                     subst(s["runner"].get("args", []) if isinstance(s["runner"].get("args"), list)
                                           else [s["runner"].get("args", "")], c))[0],
    "worker_batch": run_worker_batch, "worker_batch_chain": run_worker_batch_chain,
    "worker_batch_multi": run_worker_batch_chain, "sql_file": run_sql_file, "sql_ref": run_sql_ref,
    "rpc": run_rpc, "rpc_loop": run_rpc_loop, "http": run_http,
    "shell_then_rpc": lambda s, f, c: run_rpc({"runner": {"fn": s["runner"]["small"]["fn"], "args": []}}, f, c)
        if len(f) < 50 else sh(pyw(s["runner"]["big"]["script"], []))[0],
    "shell_conditional": lambda s, f, c: run_shell_seq(
        {"runner": {"steps": [st for st in s["runner"]["steps"] if st.get("when") == "always"]}}, f, c),
}


def verify_stage(stage, films):
    vs = stage.get("verify_sql")
    if not vs:
        return {"checked": 0, "ok": 0, "bad": 0, "bad_slugs": []}
    ok = bad = 0; bad_slugs = []
    for f in films:
        sql = vs.replace("{film_id}", f["film_id"]).replace("{slug}", f["slug"])
        try:
            row = q1(f"select ({sql}) as v;")
            if row and row.get("v"):
                ok += 1
            else:
                bad += 1; bad_slugs.append(f["slug"])
        except Exception:
            bad += 1; bad_slugs.append(f["slug"])
    return {"checked": ok + bad, "ok": ok, "bad": bad, "bad_slugs": bad_slugs[:20]}


def cmd_run(a):
    global DRY
    DRY = bool(getattr(a, "dry_run", False))
    m = load_manifest()
    errs = lint(m)
    if errs:
        print("⚠️ manifest lint errors (fix first):")
        for e in errs:
            print("  -", e)
        if not DRY:
            sys.exit(1)
    run_id = a.run or (q1("select max(id) id from factory.runs where status in ('planning','queued','running')") or {}).get("id")
    if not run_id:
        print("no run to execute. `factory.py plan --write` first."); return
    run, films = run_load(run_id)
    if not run:
        print(f"run #{run_id} not found."); return

    # --films filter + --from / --only
    if a.films:
        want = set(a.films.split(","))
        films = [f for f in films if f["slug"] in want]
    stages = stages_sorted(m)
    order_of = {s["id"]: i for i, s in enumerate(stages)}
    if a.only:
        stages = [s for s in stages if s["id"] == a.only or s["id"].split("-")[0] == a.only]
    elif a.from_:
        start = order_of.get(a.from_)
        if start is None:
            start = next((i for i, s in enumerate(stages) if s["id"].split("-")[0] == a.from_), 0)
        stages = stages[start:]

    full = [f for f in films if f["tier"] == "full"]; cat = [f for f in films if f["tier"] == "catalog"]
    est, _ = estimate_cost(m, len(full), len(cat))
    gate = m.get("cost_gate_usd_default", 50)
    print(f"\n=== FACTORY RUN #{run_id} {'(DRY)' if DRY else ''} ===")
    print(f"films: {len(films)} ({len(full)} full, {len(cat)} catalog) | stages: {len(stages)} | est ${est:.2f} (gate ${gate})")
    if not films:
        print("no resolved films in this run — run S02-resolve or check intake.");
    if est > gate and not a.yes and not DRY:
        print(f"\n⚠️ COST GATE ${est:.2f} > ${gate}. Re-run with --yes to authorize the spend."); return
    if not DRY:
        mgmt_query(f"update factory.runs set status='running', started_at=coalesce(started_at,now()), "
                   f"film_count={len(films)} where id={run_id};")

    extra = {"dir_slugs": [], "new_urls": [f"https://metatake.net/film/{f['slug']}" for f in films]}
    total_cost = 0.0; parked = []
    for s in stages:
        sid = s["id"]; rtype = s["runner"].get("type")
        sfilms = stage_films(s, films)
        # skip conditions
        if s.get("enabled") is False:
            print(f"\n[{sid}] disabled — skip"); ledger(run_id, sid, "skipped"); continue
        if s.get("blocked_by") or s["runner"].get("needs_scoping_patch") and rtype in ("worker_batch_multi",):
            if s.get("blocked_by"):
                print(f"\n[{sid}] BLOCKED ({s['blocked_by'][:50]}) — skip+park"); ledger(run_id, sid, "skipped", error=s["blocked_by"]); continue
        if sid in DEFER_CORPUS and not getattr(a, "with_corpus", False):
            print(f"\n[{sid}] deferred corpus (use --with-corpus) — skip"); ledger(run_id, sid, "skipped"); continue
        if s.get("class") == "per_director" and sid != "S30-dir-detect" and not extra["dir_slugs"]:
            print(f"\n[{sid}] no new directors — skip"); ledger(run_id, sid, "skipped"); continue
        if s.get("class") in ("per_film", "per_director") and not sfilms and sid != "S02-resolve":
            print(f"\n[{sid}] no applicable films for tier {s.get('tier')} — skip"); continue

        print(f"\n[{sid}] {s['title']}  ({rtype}, {len(sfilms)} films)")
        ledger(run_id, sid, "running")
        # W0 resolve is special (fills intake.film_id, may change `films`)
        if sid == "S02-resolve":
            rc, cost = stage_resolve(run_id, m)
            if not DRY:
                run, films = run_load(run_id)  # reload after resolve
                if a.films:
                    films = [f for f in films if f["slug"] in set(a.films.split(","))]
                extra["new_urls"] = [f"https://metatake.net/film/{f['slug']}" for f in films]
        else:
            ctx = build_ctx(run_id, sfilms, extra)
            fn = DISPATCH.get(rtype)
            if not fn:
                print(f"      (unknown runner type {rtype}) — park"); ledger(run_id, sid, "parked", error=f"unknown runner {rtype}"); parked.append(sid); continue
            try:
                rc = fn(s, sfilms, ctx)
            except Exception as e:
                rc = 1; print(f"      ! exception: {e}")
            cost = (s.get("cost", {}).get("usd_per_film_est", 0) or 0) * (len(sfilms) if s.get("class") not in ("corpus", "publication") else 1)
        # capture new directors after detect stage, for downstream {dir_slugs}
        if sid == "S30-dir-detect" and not DRY:
            nd = mgmt_query("select slug from factory._new_directors_scratch;") if False else []
            # detect_new_directors returns the list; re-query director artifacts gap
            rows = mgmt_query(f"""select distinct d.slug from public.directors d
                join public.films f on f.director_slug=d.slug
                where f.id = any({build_ctx(run_id, sfilms)['film_ids']})
                  and not exists(select 1 from public.director_portrait p where p.director_slug=d.slug);""") if sfilms else []
            extra["dir_slugs"] = [r["slug"] for r in rows]
            print(f"      new directors: {extra['dir_slugs'] or 'none'}")

        # verify gate (per applicable film)
        v = verify_stage(s, sfilms) if not DRY else {"checked": 0, "ok": 0, "bad": 0, "bad_slugs": []}
        status = "done" if rc == 0 else "failed"
        if rc == 0 and v["bad"]:
            status = "partial"
        if rc != 0:
            pol = s.get("failure_policy", "park")
            if pol == "abort_run":
                ledger(run_id, sid, "failed", cost=cost, verify=v)
                print(f"      ✗ ABORT (failure_policy=abort_run). Fix and resume: factory.py run --run {run_id} --from {sid}")
                mgmt_query(f"update factory.runs set status='failed' where id={run_id};") if not DRY else None
                return
            status = "parked"; parked.append(sid)
        total_cost += cost
        ledger(run_id, sid, status, cost=cost, verify=v)
        mark = {"done": "✓", "partial": "◐", "parked": "▲", "failed": "✗"}.get(status, "·")
        vtxt = f" verify ok={v['ok']} bad={v['bad']}" + (f" {v['bad_slugs']}" if v["bad"] else "") if v["checked"] else ""
        print(f"      {mark} {status} ${cost:.3f}{vtxt}")

    # ---- finalize (S59) ----
    run2, films2 = run_load(run_id)
    bar = run_quality_report(films2)
    report = report_md(run_id, films2, bar, total_cost, parked)
    if not DRY:
        os.makedirs(LOGDIR, exist_ok=True)
        open(os.path.join(LOGDIR, f"run-{run_id}.md"), "w").write(report)
        mgmt_query(f"update factory.runs set status='done', finished_at=now(), "
                   f"actual_cost_usd={total_cost:.2f}, report_md={sql_lit(report)} where id={run_id};")
        mgmt_query(f"update factory.intake set status='done' where run_id={run_id} and film_id is not null;")
    print(f"\n=== RUN #{run_id} {'DRY-COMPLETE' if DRY else 'DONE'} — est/actual ${total_cost:.2f}"
          f"{(' | parked: ' + ','.join(parked)) if parked else ''} ===")
    print(report)


def run_quality_report(films):
    if not films:
        return []
    ids = uuid_array([f["film_id"] for f in films])
    rows = mgmt_query(f"""select f.slug,
        (select count(*) from figures g where g.film_id=f.id and g.status='approved') figures,
        (select count(*) from takes tk join figures g on g.id=tk.figure_id where g.film_id=f.id and tk.framework is not null and tk.status='published') misreadings,
        (select count(*) from takes tk join figures g on g.id=tk.figure_id where g.film_id=f.id and tk.theorist_name is not null and tk.theorist_id is null and tk.status='published') theorist_unlinked,
        (select count(*) from film_affinities a where a.film_id=f.id) movies_like,
        (select count(*) from film_sentences s where s.film_id=f.id) fantasia,
        exists(select 1 from film_asset a where a.film_id=f.id) why_watch,
        (select count(*) from film_next n where n.source_film_id=f.id) watch_next,
        exists(select 1 from cinecodex.scores s where s.film_id=f.id) takescore,
        (f.visible and f.is_analyzed and not coalesce(f.hold,false)) live
        from public.films f where f.id = any({ids}) order by f.slug;""")
    return rows


def report_md(run_id, films, bar, cost, parked):
    L = [f"# Factory run #{run_id}", "", f"films: {len(films)} · actual ${cost:.2f}"]
    if parked:
        L.append(f"parked stages: {', '.join(parked)}")
    L += ["", "| slug | figs | misr | thUnlinked | ml | fant | why | next | TS | LIVE |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for r in bar:
        L.append(f"| {r['slug']} | {r['figures']} | {r['misreadings']} | {r['theorist_unlinked']} | "
                 f"{r['movies_like']} | {r['fantasia']} | {'✓' if r['why_watch'] else '·'} | {r['watch_next']} | "
                 f"{'✓' if r['takescore'] else '·'} | {'✓' if r['live'] else '✗'} |")
    incomplete = [r["slug"] for r in bar if not (r["live"] and r["figures"] >= 3 and r["fantasia"] > 0
                  and r["why_watch"] and r["watch_next"] > 0 and r["theorist_unlinked"] == 0)]
    L += ["", ("⚠️ incomplete (re-run): " + ", ".join(incomplete)) if incomplete else "✅ all films pass the quality bar."]
    return "\n".join(L)


def cmd_lint(a):
    m = load_manifest()
    errs = lint(m)
    if errs:
        print("LINT ERRORS:")
        for e in errs:
            print("  -", e)
        sys.exit(1)
    print(f"lint OK — {len(m['stages'])} stages, no structural errors.")


# --------------------------------------------------------------------------- main
def main():
    p = argparse.ArgumentParser(prog="factory.py")
    sub = p.add_subparsers(dest="cmd", required=True)
    pa = sub.add_parser("add"); pa.add_argument("title"); pa.add_argument("--director"); pa.add_argument("--year", type=int)
    pa.add_argument("--tmdb-id", type=int, dest="tmdb_id"); pa.add_argument("--tier", default="full"); pa.set_defaults(fn=cmd_add)
    pe = sub.add_parser("enqueue"); pe.add_argument("csv"); pe.add_argument("--tier", default="full"); pe.set_defaults(fn=cmd_enqueue)
    pin = sub.add_parser("ingest"); pin.add_argument("path", nargs="?", default="-"); pin.add_argument("--tier", default="full"); pin.set_defaults(fn=cmd_ingest)
    pp = sub.add_parser("plan"); pp.add_argument("--run", type=int); pp.add_argument("--write", action="store_true"); pp.set_defaults(fn=cmd_plan)
    pr = sub.add_parser("review"); pr.add_argument("--approve-all-high", action="store_true", dest="approve_all_high"); pr.add_argument("--decide"); pr.set_defaults(fn=cmd_review)
    prun = sub.add_parser("run"); prun.add_argument("--run", type=int); prun.add_argument("--from", dest="from_"); prun.add_argument("--only"); prun.add_argument("--films"); prun.add_argument("--yes", action="store_true"); prun.add_argument("--dry-run", action="store_true", dest="dry_run"); prun.add_argument("--with-corpus", action="store_true", dest="with_corpus"); prun.set_defaults(fn=cmd_run)
    ps = sub.add_parser("status"); ps.add_argument("--run", type=int); ps.add_argument("--limit", type=int, default=50); ps.set_defaults(fn=cmd_status)
    pv = sub.add_parser("verify"); pv.add_argument("--run", type=int); pv.add_argument("--films"); pv.set_defaults(fn=cmd_verify)
    pg = sub.add_parser("gaps"); pg.add_argument("--days", type=int, default=30); pg.add_argument("--json", action="store_true"); pg.set_defaults(fn=cmd_gaps)
    pq = sub.add_parser("queue"); pq.set_defaults(fn=cmd_queue)
    pgq = sub.add_parser("garden-queue"); pgq.set_defaults(fn=cmd_garden)
    pl = sub.add_parser("lint"); pl.set_defaults(fn=cmd_lint)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
