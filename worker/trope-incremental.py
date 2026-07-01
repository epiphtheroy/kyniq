#!/usr/bin/env python3
"""trope-incremental — ADDITIVE trope assignment for new films (no reset, no rename).

The full trope layer (4,710 hubs) was formed by a supervised, corpus-wide pipeline
(trope-form → gate → consolidate → harmonize → persist). Re-running that on new films
RENAMES/RE-LINKS the whole live graph (breaks URLs). This worker is the safe, automatic
alternative for incremental ingestion:

  For each NEW take (published, non-invitation, trope_id IS NULL), find the nearest
  EXISTING published trope by embedding cosine (centroid = meta_takes.embedding). If the
  similarity >= threshold, assign it: set takes.trope_id + add figure_type_members.
  Takes with no close trope are left UNASSIGNED (candidates for the periodic, supervised
  "gardening" full-recluster — never force a weak match).

It NEVER deletes, renames, re-slugs, or re-links any existing trope/member. Purely additive.

Brain = RPC trope_match_takes(p_take_ids uuid[], p_threshold float). Writes via the
existing RPCs trope_set_take_tropeid + trope_insert_members.

DRY by default: prints the similarity histogram + how many would assign at --thresh + samples.
  python3 trope-incremental.py --films parasite-2019,oldboy-2003        # scope to films
  python3 trope-incremental.py --all-null                                # every unassigned take
  python3 trope-incremental.py --films <slugs> --thresh 0.72 --persist   # write

Run AFTER the new films have figures + takes + embeddings (mt-embed / sm-embed).
"""
import os, sys, json, time, urllib.request, urllib.error
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): sys.exit("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)")

args = sys.argv[1:]
PERSIST = "--persist" in args
ALL_NULL = "--all-null" in args
def argval(f, d=None): return args[args.index(f)+1] if f in args and args.index(f)+1 < len(args) else d
THRESH = float(argval("--thresh", "0.72"))
LIMIT = int(argval("--limit", "0"))  # 0 = no cap
FILMS = [s.strip() for s in (argval("--films", "") or "").split(",") if s.strip()]

def http(method, url, headers=None, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(5):
        req = urllib.request.Request(url, method=method, data=data); req.add_header("Content-Type", "application/json")
        for k, v in (headers or {}).items(): req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            code = e.code; tx = e.read().decode()[:300]
            if code in (500,502,503,504,520,521,522,523,524,529) and attempt < 4: time.sleep(2*(attempt+1)); continue
            return code, tx
        except (urllib.error.URLError, OSError):
            if attempt == 4: raise
            time.sleep(2*(attempt+1))
def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)
def rpc(name, body):
    st, tx = sb("POST", f"rpc/{name}", body)
    if st >= 300: raise RuntimeError(f"rpc {name} {st}: {tx[:200]}")
    return json.loads(tx) if tx.strip() else []
def fetch_all(path, page=1000):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}&limit={page}&offset={off}")
        if st != 200: raise RuntimeError(f"fetch {st}: {tx[:160]}")
        b = json.loads(tx); rows += b
        if len(b) < page: break
        off += page
    return rows
def chunks(lst, n):
    for i in range(0, len(lst), n): yield lst[i:i+n]

def in_list(vals):
    return "(" + ",".join(f'"{v}"' for v in vals) + ")"

def target_takes():
    """Return [{id, figure_id}] for published, non-invitation, trope_id-null takes in scope."""
    base = "takes?select=id,figure_id&status=eq.published&is_invitation=eq.false&trope_id=is.null"
    if FILMS:
        films = fetch_all("films?select=id,slug&slug=in." + in_list(FILMS))
        if not films: sys.exit(f"No films matched: {FILMS}")
        fids = [f["id"] for f in films]
        print(f"  scope: {len(films)} film(s) → resolving figures…")
        figs = []
        for c in chunks(fids, 50):
            figs += fetch_all("figures?select=id&status=eq.approved&film_id=in." + in_list(c))
        figset = [f["id"] for f in figs]
        if not figset: return []
        out = []
        for c in chunks(figset, 80):
            out += fetch_all(base + "&figure_id=in." + in_list(c))
        return out
    if ALL_NULL:
        return fetch_all(base)
    sys.exit("Scope required: pass --films <slug,slug> or --all-null")

def main():
    print(f"[trope-incremental] thresh={THRESH} {'PERSIST' if PERSIST else 'DRY'} scope={'films='+','.join(FILMS) if FILMS else ('all-null' if ALL_NULL else '?')}")
    takes = target_takes()
    if LIMIT and len(takes) > LIMIT: takes = takes[:LIMIT]
    figof = {t["id"]: t["figure_id"] for t in takes}
    ids = list(figof)
    print(f"  target unassigned takes: {len(ids)}")
    if not ids: print("  nothing to assign."); return

    # nearest existing trope for every target take (threshold 0 → get all, bucket client-side)
    matches = []
    for i, c in enumerate(chunks(ids, 400)):
        matches += rpc("trope_match_takes", {"p_take_ids": c, "p_threshold": 0.0})
        print(f"    matched {min((i+1)*400, len(ids))}/{len(ids)}")
    by_take = {m["take_id"]: m for m in matches}

    # histogram (0.05-wide buckets)
    buckets = Counter()
    for m in matches:
        b = int(m["sim"]*20)/20.0
        buckets[b] += 1
    print("  nearest-trope similarity histogram (0.05 buckets):")
    for b in sorted(buckets):
        bar = "#" * min(60, buckets[b])
        print(f"    {b:.2f}-{b+0.05:.2f}: {buckets[b]:4d} {bar}")
    no_match = len(ids) - len(matches)
    assignable = [m for m in matches if m["sim"] >= THRESH]
    print(f"  would ASSIGN at thresh {THRESH}: {len(assignable)}/{len(ids)}  "
          f"(leave unassigned: {len(ids)-len(assignable)}; no centroid match at all: {no_match})")
    print("  — sample assignments (highest sim) —")
    for m in sorted(assignable, key=lambda x:-x["sim"])[:12]:
        print(f"    {m['sim']:.3f}  {m['trope_title']}")

    if not PERSIST:
        print("[trope-incremental] DRY — no writes. Tune --thresh from the histogram, then add --persist.")
        return

    take_trope = [{"take_id": m["take_id"], "trope_id": m["trope_id"]} for m in assignable]
    seen = set(); members = []
    for m in assignable:
        fg = figof.get(m["take_id"])
        if fg and (m["trope_id"], fg) not in seen:
            seen.add((m["trope_id"], fg)); members.append({"meta_take_id": m["trope_id"], "figure_id": fg, "sim": m["sim"]})
    nt = 0
    for c in chunks(take_trope, 2000):
        nt += int(rpc("trope_set_take_tropeid", {"p_rows": c})); print(f"  take→trope {nt}/{len(take_trope)}")
    nm = 0
    for c in chunks(members, 2000):
        nm += int(rpc("trope_insert_members", {"p_rows": c})); print(f"  members {nm}/{len(members)}")
    print(f"[trope-incremental] ✅ assigned {nt} takes to existing tropes (+{nm} figure members). "
          f"Existing tropes untouched. Unassigned takes await the gardening pass.")

if __name__ == "__main__": main()
