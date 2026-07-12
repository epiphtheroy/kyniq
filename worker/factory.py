#!/usr/bin/env python3
"""
The Film Factory — orchestrator CLI.  Canonical design: HANDOFF-영화공장.md §6.
stdlib-only.  Two DB channels:
  * Supabase Management API  (factory schema I/O + arbitrary SQL / verify_sql)
  * (public tables/RPCs are reached through the same Management API query endpoint)

Subcommands
  add "Title (Year)" [--director D] [--tmdb-id N] [--tier full|catalog]
  enqueue <titles.csv> [--tier ...]          # or drop the CSV in factory/intake/
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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_REF = "jvgarcqrtsmgfimdcwgo"
MANIFEST = os.path.join(ROOT, "factory", "manifest.json")
LOGDIR = os.path.join(ROOT, "factory", "logs")
NODE = os.path.expanduser("~/.local/node/bin/node")


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
        run_id = q1(f"insert into factory.runs(mode,film_count,est_cost_usd,status,manifest_sha) "
                    f"values('bulk',{len(intake)},{total:.2f},'planning','{manifest_sha}') returning id;")["id"]
        print(f"\nrun #{run_id} written (status=planning). Execute on the Mac: run-factory-run.command {run_id}")


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
def cmd_run(a):
    print("factory.py run — executes the manifest on the Mac.")
    print("LLM stages (external=anthropic_*) require Anthropic egress + real spend;")
    print("the sandbox blocks egress, so run is invoked by the owner via run-factory-run.command.")
    print("\nControl-plane is live now — use: status, gaps, plan, verify, review, garden-queue, lint.")
    print("See HANDOFF-영화공장.md §6 for the run algorithm the Mac executes.")


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
    pp = sub.add_parser("plan"); pp.add_argument("--run", type=int); pp.add_argument("--write", action="store_true"); pp.set_defaults(fn=cmd_plan)
    pr = sub.add_parser("review"); pr.add_argument("--approve-all-high", action="store_true", dest="approve_all_high"); pr.add_argument("--decide"); pr.set_defaults(fn=cmd_review)
    prun = sub.add_parser("run"); prun.add_argument("--run", type=int); prun.add_argument("--from", dest="from_"); prun.add_argument("--only"); prun.add_argument("--films"); prun.add_argument("--yes", action="store_true"); prun.set_defaults(fn=cmd_run)
    ps = sub.add_parser("status"); ps.add_argument("--run", type=int); ps.add_argument("--limit", type=int, default=50); ps.set_defaults(fn=cmd_status)
    pv = sub.add_parser("verify"); pv.add_argument("--run", type=int); pv.add_argument("--films"); pv.set_defaults(fn=cmd_verify)
    pg = sub.add_parser("gaps"); pg.add_argument("--days", type=int, default=30); pg.add_argument("--json", action="store_true"); pg.set_defaults(fn=cmd_gaps)
    pgq = sub.add_parser("garden-queue"); pgq.set_defaults(fn=cmd_garden)
    pl = sub.add_parser("lint"); pl.set_defaults(fn=cmd_lint)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
