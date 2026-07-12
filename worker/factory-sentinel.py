#!/usr/bin/env python3
"""
The Film Factory — Sentinel.  Canonical design: HANDOFF-영화공장.md §11.

"사이트가 변하면 공장 설계도가 낡는다" 를 자동 감지하고 수정안을 만들어 정책에 따라
적용/보류한다.  Three probes, run once/day (+ on-demand):

  1. CODE DRIFT   — git log --name-only since factory/.sentinel-checkpoint (a commit
                    hash) → changed paths matched against factory/coupling-map.json →
                    kind='code_drift' change orders.  New-surface heuristic (new
                    app/*/[slug] page dir, or a new file referencing films/film_* tables)
                    → kind='new_surface', risk='review'.
  2. DATA DRIFT   — public.factory_gaps_json(N); if deficits>0, auto-register
                    out-of-factory films into factory.intake (source='sentinel',
                    tier='catalog', per 원우 №1) + emit kind='data_drift' CO.
  3. SCHEMA/LINT  — reuse worker/factory.py lint() (fields / depends cycles / runner
                    file existence / scoping) + verify the manifest's referenced RPCs
                    still exist in pg_proc.  Missing RPC → kind='stage_broken',
                    risk='blocked'.

CO lifecycle (§11.3): open → proposed → approved → applied.
  * risk='auto_ok'  (whitelist: runner-file path move, coupling-map add, non-behavior
                     manifest notes/title, pure doc prose) → applied/approved
                     immediately.  This script's ONE concrete auto-apply is appending a
                     coupling-map rule for a newly-added runner it does not yet index
                     (whitelist #2 — coupling-map.json is the sentinel's own artifact).
  * risk='review'   → headless `claude -p ... --output-format json` proposes a
                     manifest diff + doc note attached to the CO (status='proposed');
                     owner (원우) approves.  Manifest edits are always a manual git
                     commit (outside the deploy watcher's scope).
  * risk='blocked'  → stays open for owner.

Every emitted CO also writes factory/change-orders/CO-<id>.md.

stdlib only.  Reuses helpers from worker/factory.py (mgmt_query / q1 / sql_lit /
load_manifest / lint / stages_sorted).  Reads/writes the factory schema via the
Supabase Management API (same channel as factory.py).

CLI:  factory-sentinel.py [--once] [--dry] [--live] [--days N]
  Default is DRY (report only, no CO writes, no intake inserts, no checkpoint move).
  Pass --live to actually emit change orders / register intake / advance the checkpoint.
  --once is accepted for symmetry with the loop wrapper; a single invocation is always
  one pass regardless.
"""
import sys, os, re, json, glob as _glob, shutil, subprocess, argparse, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import factory as F  # reuse mgmt_query / q1 / sql_lit / load_manifest / lint / stages_sorted

COUPLING_MAP = os.path.join(ROOT, "factory", "coupling-map.json")
CHECKPOINT = os.path.join(ROOT, "factory", ".sentinel-checkpoint")
CO_DIR = os.path.join(ROOT, "factory", "change-orders")
LOGDIR = os.path.join(ROOT, "factory", "logs")
SENTINEL_LOG = os.path.join(LOGDIR, "sentinel.log")
CANONICAL_DOC = "HANDOFF-영화공장.md"

DRY = True  # set in main()


# ------------------------------------------------------------------------- util
def now_iso():
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def log(msg):
    os.makedirs(LOGDIR, exist_ok=True)
    line = f"[{now_iso()}] {msg}"
    print(line)
    try:
        with open(SENTINEL_LOG, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def git(*args):
    """Run a git command in ROOT; return (rc, stdout)."""
    try:
        p = subprocess.run(["git", "-C", ROOT, *args],
                           capture_output=True, text=True, timeout=120)
        return p.returncode, p.stdout
    except (OSError, subprocess.SubprocessError) as e:
        return 1, f"(git error: {e})"


# ----------------------------------------------------------------- glob matching
def _part_to_regex(g):
    """Translate a single glob (no `|`) to an anchored regex.
    `**`=across segments, `*`=within a segment, `?`=one non-slash char.
    Everything else (incl. literal `[slug]` bracket dirs) is escaped literally."""
    out = []
    i, n = 0, len(g)
    while i < n:
        c = g[i]
        if c == "*":
            if i + 1 < n and g[i + 1] == "*":
                out.append(".*"); i += 2; continue
            out.append("[^/]*"); i += 1; continue
        if c == "?":
            out.append("[^/]"); i += 1; continue
        out.append(re.escape(c)); i += 1
    return "^" + "".join(out) + "$"


def glob_match(glob_expr, path):
    for part in glob_expr.split("|"):
        if re.match(_part_to_regex(part.strip()), path):
            return True
    return False


def load_coupling():
    with open(COUPLING_MAP) as f:
        data = json.load(f)
    rules = list(data.get("rules", [])) + list(data.get("stage_rules", []))
    return data, rules


def resolve_stage_tokens(tokens, manifest):
    """Expand seed stage-globs (`*`, `W1*`, `runner-map`) to concrete ids where cheap;
    otherwise keep the raw token (change_orders.affected_stages is free-form text[])."""
    out = []
    ids = [s["id"] for s in manifest["stages"]]
    for t in tokens:
        if t == "*":
            out.append("*ALL*")
        elif t.endswith("*"):
            pfx = t[:-1]
            hit = [s["id"] for s in manifest["stages"]
                   if s["id"].startswith(pfx) or str(s.get("wave", "")).startswith(pfx)]
            out.extend(hit or [t])
        elif t in ids:
            out.append(t)
        else:
            out.append(t)
    # de-dup, preserve order
    seen, uniq = set(), []
    for x in out:
        if x not in seen:
            seen.add(x); uniq.append(x)
    return uniq


# ------------------------------------------------------------- change-order emit
def _stages_sql(stages):
    if not stages:
        return "'{}'::text[]"
    return "array[" + ",".join(F.sql_lit(s) for s in stages) + "]::text[]"


def write_co_md(co_id, kind, title, evidence, stages, risk, status, proposal_md):
    os.makedirs(CO_DIR, exist_ok=True)
    path = os.path.join(CO_DIR, f"CO-{co_id}.md")
    lines = [
        f"# CO-{co_id} — {title}",
        "",
        f"- **kind**: `{kind}`",
        f"- **risk**: `{risk}`",
        f"- **status**: `{status}`",
        f"- **created**: {now_iso()}",
        f"- **affected stages**: {', '.join(stages) if stages else '(none)'}",
        "",
        "## Evidence",
        "",
        "```json",
        json.dumps(evidence, indent=2, ensure_ascii=False),
        "```",
        "",
    ]
    if proposal_md:
        lines += ["## Proposed change (headless agent)", "", proposal_md, ""]
    else:
        lines += ["## Proposed change", "",
                  "_No headless proposal attached "
                  "(auto_ok, or `claude` unavailable, or dry run)._", ""]
    lines += ["---",
              f"_Emitted by worker/factory-sentinel.py per HANDOFF-영화공장.md §11. "
              f"Apply policy: only `risk='auto_ok'` self-applies; `review`/`blocked` "
              f"await 원우. Manifest edits are a manual git commit._"]
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    return path


def propose_via_claude(title, evidence, stages, manifest):
    """Headless proposal (§11.3). Returns proposal markdown or None."""
    claude = shutil.which("claude")
    if not claude:
        log("claude binary not found (shutil.which) — CO left 'open', no proposal.")
        return None
    concrete = [s for s in stages if s in {st["id"] for st in manifest["stages"]}]
    excerpt = [st for st in manifest["stages"] if st["id"] in concrete]
    prompt = (
        "You are the Film Factory Sentinel's headless proposer (HANDOFF-영화공장.md §11.3).\n"
        f"A change order has been raised.\n\nTITLE: {title}\n"
        f"EVIDENCE: {json.dumps(evidence, ensure_ascii=False)}\n"
        f"AFFECTED STAGES: {', '.join(stages) if stages else '(none)'}\n\n"
        "MANIFEST EXCERPT (the affected stages, from factory/manifest.json):\n"
        f"{json.dumps(excerpt, ensure_ascii=False, indent=2)}\n\n"
        "Propose the MINIMAL edit: (a) a factory/manifest.json diff (or 'no manifest "
        "change needed'), and (b) one sentence of doc-note text for HANDOFF-영화공장.md. "
        "Do NOT invent new stages unless the evidence clearly shows a new surface. "
        "Be concise; behavior-changing edits must be flagged for owner review."
    )
    try:
        p = subprocess.run([claude, "-p", prompt, "--output-format", "json"],
                           capture_output=True, text=True, timeout=240, cwd=ROOT)
        if p.returncode != 0:
            log(f"claude -p exited {p.returncode}: {p.stderr[:200]}")
            return None
        out = p.stdout.strip()
        try:
            j = json.loads(out)
            # claude -p --output-format json → {"result": "...", ...}
            return j.get("result") or j.get("text") or json.dumps(j, ensure_ascii=False)
        except json.JSONDecodeError:
            return out or None
    except (OSError, subprocess.SubprocessError) as e:
        log(f"claude -p failed: {e}")
        return None


def apply_auto_ok(kind, evidence):
    """The one concrete auto-apply (whitelist #2): append a coupling-map rule for a
    newly-added runner the map does not yet index. Returns True if a file edit was made.
    All other auto_ok cases (rename / doc prose / non-behavior notes) need no sentinel-side
    file mutation and land at status='approved'."""
    if evidence.get("action") != "add_coupling_rule" or not evidence.get("new_runner"):
        return False
    path = evidence["new_runner"]
    try:
        with open(COUPLING_MAP) as f:
            data = json.load(f)
        data.setdefault("stage_rules", []).append(
            {"glob": path, "stages": ["runner-map"], "kind": "runner", "source": "sentinel-auto"})
        with open(COUPLING_MAP, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        log(f"auto_ok applied: appended coupling-map rule for new runner {path} "
            f"(commit factory/coupling-map.json manually).")
        return True
    except (OSError, json.JSONDecodeError) as e:
        log(f"auto_ok apply failed for {path}: {e}")
        return False


def emit_co(kind, title, evidence, stages, risk, manifest, proposal_md=None):
    """Emit a change order per policy. Returns co_id (or None in dry mode)."""
    if DRY:
        print(f"  [DRY] CO {kind:12} risk={risk:8} {title}")
        if stages:
            print(f"         stages: {', '.join(stages)}")
        return None

    ev = F.sql_lit(json.dumps(evidence, ensure_ascii=False))
    row = F.q1(
        "insert into factory.change_orders(kind,title,evidence,affected_stages,risk,status) "
        f"values({F.sql_lit(kind)},{F.sql_lit(title)},{ev}::jsonb,{_stages_sql(stages)},"
        f"{F.sql_lit(risk)},'open') returning id;")
    co_id = row["id"]

    status = "open"
    if risk == "auto_ok":
        status = "applied" if apply_auto_ok(kind, evidence) else "approved"
    elif risk == "review":
        if proposal_md is None:
            proposal_md = propose_via_claude(title, evidence, stages, manifest)
        if proposal_md:
            status = "proposed"
    # risk == 'blocked' stays 'open'

    if status != "open" or proposal_md:
        upd = f"update factory.change_orders set status={F.sql_lit(status)}"
        if proposal_md:
            upd += f", proposal_md={F.sql_lit(proposal_md)}"
        if status in ("applied", "approved", "proposed"):
            upd += ", decided_at=now()" if status in ("applied", "approved") else ""
        upd += f" where id={co_id};"
        F.mgmt_query(upd)

    md = write_co_md(co_id, kind, title, evidence, stages, risk, status, proposal_md)
    log(f"CO-{co_id} {kind} risk={risk} status={status}: {title}  ({md})")
    return co_id


# ============================================================= PROBE 1: code drift
FILM_REF_RE = re.compile(r"\bfilms\b|film_[a-z_]+")
NEW_SURFACE_SLUG_RE = re.compile(r"^app/[^/]+/\[[^/]+\]/")


def probe_code_drift(rules, manifest):
    print("\n=== PROBE 1: CODE DRIFT ===")
    cp = None
    if os.path.exists(CHECKPOINT):
        cp = open(CHECKPOINT).read().strip() or None
    rc, head = git("rev-parse", "HEAD")
    head = head.strip()
    if not cp:
        print("  no checkpoint — establishing baseline at HEAD; nothing to diff on first run.")
        if not DRY and head:
            with open(CHECKPOINT, "w") as f:
                f.write(head + "\n")
            log(f"checkpoint initialized at {head[:12]}")
        return
    if cp == head:
        print(f"  checkpoint == HEAD ({head[:12]}) — no new commits.")
        return

    rng = f"{cp}..HEAD"
    rc, out = git("log", "--name-status", "--pretty=format:", rng)
    if rc != 0:
        log(f"git log {rng} failed ({out[:120]}) — checkpoint stale? skipping code drift.")
        return

    changed, added, renamed = set(), set(), set()
    for ln in out.splitlines():
        ln = ln.rstrip()
        if not ln:
            continue
        cols = ln.split("\t")
        st = cols[0]
        if st.startswith("R") and len(cols) >= 3:
            new = cols[2]
            changed.add(new); renamed.add(new)
        elif len(cols) >= 2:
            p = cols[1]
            changed.add(p)
            if st.startswith("A"):
                added.add(p)

    if not changed:
        print(f"  {rng}: no file changes.")
        return
    print(f"  {rng}: {len(changed)} changed path(s).")

    # (a) coupling matches
    matched = {}   # path -> {"stages": set, "kinds": set}
    for path in sorted(changed):
        for r in rules:
            if r.get("kind") == "new_surface_heuristic":
                continue  # handled separately below
            if glob_match(r["glob"], path):
                m = matched.setdefault(path, {"stages": set(), "kinds": set()})
                m["stages"].update(r.get("stages", []))
                m["kinds"].add(r.get("kind", "?"))

    if matched:
        all_stages, all_kinds = set(), set()
        risk = "auto_ok"
        for path, m in matched.items():
            all_stages.update(m["stages"]); all_kinds.update(m["kinds"])
            # auto_ok whitelist: coupling-map edit (#2), pure doc prose (#4),
            # a runner file that is a *pure rename* (#1). Everything else = review.
            if path == "factory/coupling-map.json":
                continue
            if path == CANONICAL_DOC or path.endswith(".md"):
                continue
            if ("runner" in m["kinds"]) and path in renamed:
                continue
            risk = "review"
        stages = resolve_stage_tokens(sorted(all_stages), manifest)
        title = f"Code drift: {len(matched)} coupled path(s) changed since {cp[:8]}"
        evidence = {
            "range": rng, "checkpoint": cp, "head": head,
            "matched": {p: {"stages": sorted(m["stages"]), "kinds": sorted(m["kinds"])}
                        for p, m in matched.items()},
            "kinds": sorted(all_kinds),
        }
        emit_co("code_drift", title, evidence, stages, risk, manifest)

    # (b) new-surface heuristic
    surfaces = []
    for path in sorted(added):
        reason = None
        if NEW_SURFACE_SLUG_RE.match(path) and path.endswith((".tsx", ".ts")):
            reason = "new app/*/[slug] route"
        else:
            fp = os.path.join(ROOT, path)
            if path.endswith((".ts", ".tsx", ".py", ".sql")) and os.path.exists(fp):
                try:
                    with open(fp, "r", errors="ignore") as f:
                        if FILM_REF_RE.search(f.read(200_000)):
                            reason = "new file references films/film_* tables"
                except OSError:
                    pass
        if reason:
            surfaces.append({"path": path, "reason": reason})
    if surfaces:
        title = f"New surface heuristic: {len(surfaces)} new film-touching path(s)"
        emit_co("new_surface", title,
                {"range": rng, "surfaces": surfaces}, ["*ALL*"], "review", manifest)

    # (c) newly-added runners not yet in the coupling map → auto_ok add-rule proposal
    for path in sorted(added):
        if not (path.startswith("worker/") and path.endswith(".py")):
            continue
        if any(glob_match(r["glob"], path) for r in rules if r.get("kind") != "new_surface_heuristic"):
            continue  # already indexed (e.g. by worker/*.py seed rule)
        emit_co("code_drift",
                f"New runner not in coupling map: {path}",
                {"new_runner": path, "action": "add_coupling_rule"},
                ["runner-map"], "auto_ok", manifest)


# ============================================================= PROBE 2: data drift
DEFICIT_STAGE = {
    "full_under_3_figs": "S10-extract",
    "figs_ok_not_analyzed": "S39-analyzed-flip",
    "held": "S39-analyzed-flip",
    "unscored": "S40-takescore",
    "no_taste": "S21-taste-vector",
    "no_affinities": "S25-affinities",
    "no_sentences": "S28-sentences",
    "no_providers": "S44-fpi",
    "no_next": "S16-next",
}


def register_out_of_factory(days):
    """Auto-register films that skipped the factory into intake (source='sentinel',
    tier='catalog' per 원우 №1). Films entering out-of-band: recent thin films, plus
    tmdb-% lineage-resolve stubs (any age). Returns count registered."""
    where_common = ("not exists (select 1 from factory.intake i where i.film_id = f.id)")
    thin = (
        "select 'sentinel','sentinel', f.title, f.tmdb_id, f.id, 'catalog', 'queued'\n"
        "from public.films f\n"
        f"where f.created_at > now() - make_interval(days => {int(days)})\n"
        "  and (select count(*) from public.figures g where g.film_id=f.id and g.status='approved') < 3\n"
        f"  and {where_common}")
    stubs = (
        "select 'sentinel','sentinel', f.title, f.tmdb_id, f.id, 'catalog', 'queued'\n"
        "from public.films f\n"
        "where f.slug like 'tmdb-%'\n"
        f"  and {where_common}")
    if DRY:
        n1 = F.q1(f"select count(*) c from ({thin}) t;")["c"]
        n2 = F.q1(f"select count(*) c from ({stubs}) t;")["c"]
        print(f"  [DRY] would register {n1} thin recent + {n2} tmdb-* stub film(s) into intake")
        return n1 + n2
    cols = "source, requested_by, raw_title, tmdb_id, film_id, tier, status"
    r1 = F.mgmt_query(f"insert into factory.intake({cols})\n{thin}\nreturning id;")
    r2 = F.mgmt_query(f"insert into factory.intake({cols})\n{stubs}\nreturning id;")
    n = len(r1) + len(r2)
    if n:
        log(f"data drift: auto-registered {n} film(s) into intake (sentinel/catalog).")
    return n


def probe_data_drift(days, manifest):
    print(f"\n=== PROBE 2: DATA DRIFT (last {days}d) ===")
    try:
        data = F.q1(f"select public.factory_gaps_json({int(days)}) j;")["j"]
    except Exception as e:
        log(f"factory_gaps_json failed: {e} — skipping data drift.")
        return
    deficits = {k: v for k, v in data.get("deficits", {}).items() if v}
    print(f"  {data.get('total_recent', 0)} recent films; "
          f"{len(deficits)} nonzero deficit bucket(s).")
    for k, v in deficits.items():
        print(f"    {k:22} {v}")
    registered = register_out_of_factory(days)
    if not deficits and not registered:
        print("  no deficits, nothing out-of-factory.")
        return
    stages = sorted({DEFICIT_STAGE[k] for k in deficits if k in DEFICIT_STAGE})
    title = (f"Data drift: {len(deficits)} deficit bucket(s), "
             f"{registered} film(s) auto-registered")
    evidence = {"days": days, "deficits": deficits,
                "auto_registered": registered,
                "sample": data.get("sample", [])[:20]}
    emit_co("data_drift", title, evidence, stages, "review", manifest)


# =========================================================== PROBE 3: schema/lint
def collect_manifest_rpcs(manifest):
    fns = set()
    for s in manifest["stages"]:
        r = s.get("runner", {})
        t = r.get("type")
        if t in ("rpc", "rpc_loop") and r.get("fn"):
            fns.add(r["fn"])
        if t == "shell_then_rpc":
            small = r.get("small", {})
            if small.get("fn"):
                fns.add(small["fn"])
    return sorted(fns)


def probe_schema_lint(manifest):
    print("\n=== PROBE 3: SCHEMA / LINT ===")
    # (a) structural lint (fields / depends cycles / runner file existence / scoping)
    errs = F.lint(manifest)
    missing_runner = [e for e in errs if "runner script not found" in e]
    if errs:
        print(f"  lint: {len(errs)} issue(s):")
        for e in errs:
            print(f"    - {e}")
    else:
        print("  lint: clean.")
    if missing_runner:
        emit_co("stage_broken",
                f"Manifest lint: {len(missing_runner)} runner file(s) missing",
                {"lint_errors": missing_runner}, [], "blocked", manifest)

    # (b) RPC signatures still present in pg_proc
    fns = collect_manifest_rpcs(manifest)
    if fns:
        arr = "array[" + ",".join(F.sql_lit(f) for f in fns) + "]"
        try:
            rows = F.mgmt_query(
                f"select proname from pg_proc where proname = any({arr}::text[]) group by proname;")
            present = {r["proname"] for r in rows}
        except Exception as e:
            log(f"pg_proc check failed: {e}")
            present = set(fns)  # fail-open: don't cry wolf on a query error
        missing = [f for f in fns if f not in present]
        print(f"  manifest RPCs: {len(present)}/{len(fns)} present.")
        for f in missing:
            print(f"    MISSING rpc: {f}")
        if missing:
            stages = [s["id"] for s in manifest["stages"]
                      if (s.get("runner", {}).get("fn") in missing
                          or s.get("runner", {}).get("small", {}).get("fn") in missing)]
            emit_co("stage_broken",
                    f"Manifest RPC(s) missing from pg_proc: {', '.join(missing)}",
                    {"missing_rpcs": missing}, stages, "blocked", manifest)


# ------------------------------------------------------------------------- driver
def update_checkpoint():
    rc, head = git("rev-parse", "HEAD")
    head = head.strip()
    if head:
        with open(CHECKPOINT, "w") as f:
            f.write(head + "\n")
        log(f"checkpoint advanced to {head[:12]}")


def run_pass(days):
    manifest = F.load_manifest()
    _data, rules = load_coupling()
    log(f"sentinel pass start (dry={DRY}, days={days}, "
        f"{len(manifest['stages'])} stages, {len(rules)} coupling rules)")
    probe_code_drift(rules, manifest)
    probe_data_drift(days, manifest)
    probe_schema_lint(manifest)
    if not DRY:
        update_checkpoint()
    log("sentinel pass complete.")


def main():
    global DRY
    ap = argparse.ArgumentParser(prog="factory-sentinel.py")
    ap.add_argument("--once", action="store_true",
                    help="single pass (accepted for symmetry; one invocation is always one pass)")
    ap.add_argument("--dry", action="store_true",
                    help="report only (this is the default)")
    ap.add_argument("--live", action="store_true",
                    help="actually emit change orders / register intake / advance checkpoint")
    ap.add_argument("--days", type=int, default=30, help="data-drift lookback window")
    a = ap.parse_args()
    DRY = not a.live  # dry unless --live; --dry is the (redundant) explicit default
    mode = "LIVE" if not DRY else "DRY (report only)"
    print(f"=== FACTORY SENTINEL — {mode} ===")
    run_pass(a.days)


if __name__ == "__main__":
    main()
