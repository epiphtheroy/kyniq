#!/usr/bin/env python3
"""Catalog mapping — PRODUCTION run (Sonnet + Batch API → figure_taxonomy).

For every figure of a kind (object | location):
  1. embedding kNN (catalog_candidates RPC) proposes archetype + theme candidates
     (coarse TIER lists — Object Type/Function, Place Category/Type — go in the prompt prefix)
  2. ONE Claude (Batch API) call per figure picks tier codes + a confident archetype + ≤3 themes,
     WITH ABSTENTION. Output is validated (codes must be in range — drops things like "XIII";
     archetype/theme slugs must be real candidates) then written to figure_taxonomy.

axis = the referenced node's kind (object_type | function | object | theme |
       location_category | location_group | location). confidence = archetype_conf for archetypes.

Resumable: the batch id is saved to Element/catalog-map-<kind>.batch; rerun resumes polling.

Usage:
  python3 catalog-map-run.py --kind object              # submit + poll + write all object figures
  python3 catalog-map-run.py --kind object --limit 50   # first 50 (smoke)
  python3 catalog-map-run.py --kind object --no-write    # everything except the DB insert
  python3 catalog-map-run.py --kind object --fresh       # ignore a saved batch id, submit anew
  python3 catalog-map-run.py --kind object --films a,b --out run6   # SCOPED (factory): only these
     films' untagged figures; --out namespaces the batch/results file so a scoped run never
     collides with (or resumes into) the corpus-wide batch.
"""
import os, sys, re, json, time, argparse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ELEM = os.path.join(ROOT, "Element")

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))

URL  = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
ANTH = os.environ.get("ANTHROPIC_API_KEY")

# Sonnet 4.6 USD per 1M tok. Batch = ×0.5 (applied in the cost print).
PRICE = {"in": 3.0, "out": 15.0, "cw": 3.75, "cr": 0.30}
MODEL_DEFAULT = "claude-sonnet-4-6"

KIND_SPEC = {
    "object": {
        "noun": "perceptible physical object — a prop you could touch or point at on screen",
        "not_examples": "a recurring motif/idea, an action or event, a person or creature, a place, or an abstraction",
        "arch_word": "OBJECT ARCHETYPE", "arch_kind": "object",
        "tiers": [("type", "object_type", "OBJECT TYPE", "the physical class of the prop"),
                  ("function", "function", "PRIMARY FUNCTION", "the dramatic work the object does in the story")],
    },
    "location": {
        "noun": "place or setting — a physical location in the world of the film",
        "not_examples": "a recurring motif/idea, a journey/action, a span of time, a person, an object, or an abstraction",
        "arch_word": "PLACE ARCHETYPE", "arch_kind": "location",
        "tiers": [("category", "location_category", "PLACE CATEGORY", "the broad realm the place belongs to"),
                  ("type", "location_group", "PLACE TYPE", "the kind of place")],
    },
}

# ---------- http ----------
def http(method, url, headers=None, body=None, timeout=300, raw_body=None):
    data = raw_body if raw_body is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, method=method, data=data)
    if body is not None and raw_body is None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:1200]

def sbh(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if extra: h.update(extra)
    return h

def sb_rpc(name, payload):
    st, body = http("POST", f"{URL}/rest/v1/rpc/{name}", sbh(), payload)
    if st not in (200, 201): raise SystemExit(f"RPC {name} {st}: {body}")
    return json.loads(body)

def sb_get(path):
    st, body = http("GET", f"{URL}/rest/v1/{path}", sbh())
    if st != 200: raise SystemExit(f"GET {path} {st}: {body}")
    return json.loads(body)

def anth(method, path, body=None, timeout=300):
    return http(method, f"https://api.anthropic.com{path}",
                {"x-api-key": ANTH, "anthropic-version": "2023-06-01"}, body, timeout=timeout)

def sort_nodes(lst):
    def k(x):
        c = (x.get("code") or "")
        return (0, int(c)) if c.isdigit() else (1, c or x.get("label", ""))
    return sorted(lst, key=k)

# ---------- prompt (identical to the DRY worker) ----------
def build_prefix(kind, tierdata):
    sp = KIND_SPEC[kind]; blocks = []; fields = []
    for field, nk, header, desc in sp["tiers"]:
        fields.append(field)
        rows = "\n".join(f"  {n['code']}  {n['label']}" for n in tierdata[nk])
        blocks.append(f"{header} — {desc} (choose one CODE → output field \"{field}\"):\n{rows}")
    schema_fields = ", ".join(f'"{f}": "code"|null' for f in fields)
    return f"""You classify a single FILM FIGURE (a thing named in a movie) against a controlled \
catalog. You are given the figure plus a short list of nearest-neighbour candidate \
{sp['arch_word'].title()}s and THEMES (already pre-selected by embedding similarity). Confirm or abstain.

CONTROLLED LISTS (choose by CODE):

{chr(10).join(blocks)}

RULES:
- ABSTENTION IS CORRECT AND EXPECTED. figure.kind is noisy. If the figure is NOT a \
{sp['noun']} — i.e. it is {sp['not_examples']} — set "is_match": false and leave the tier
  codes and archetype null. You may still attach themes.
- TWO TIERS. If it IS one: ALWAYS give the best tier CODE(s) above (coarse, near-universal),
  using ONLY codes from the lists. Give an "archetype" ONLY when a candidate genuinely names
  this figure's specific role; otherwise archetype=null. Never invent one not in the candidates.
- THEMES: attach 0–3 theme slugs from the candidate list, only those the figure is really about.
- Choose archetype and themes by their SLUG exactly as given. Tier values by CODE.

Respond with ONLY a JSON object, no prose, no fence:
{{"is_match": bool, {schema_fields}, "archetype": "slug"|null, "archetype_conf": 0.0-1.0,
  "themes": ["slug",...], "note": "<=12 words"}}"""

def build_user(kind, fig, cands):
    sp = KIND_SPEC[kind]
    arch = [c for c in cands if c["bucket"] == "archetype"]
    them = [c for c in cands if c["bucket"] == "theme"]
    def fmt(c):
        d = (c.get("definition") or "").strip().replace("\n", " ")
        d = (d[:110] + "…") if len(d) > 110 else d
        return f"  - {c['slug']}  «{c['label']}»  sim={c['sim']:.2f}" + (f"  — {d}" if d else "")
    meta = [x for x in [fig.get("film"), fig.get("director"), (str(fig["year"]) if fig.get("year") else None)] if x]
    desc = (fig.get("description") or "").strip()
    if len(desc) > 600: desc = desc[:600] + "…"
    return f"""FIGURE: {fig['label']}
FILM: {' · '.join(meta) if meta else '(unknown)'}
DESCRIPTION: {desc or '(none)'}

CANDIDATE {sp['arch_word']}S (pick at most one, by slug, or null):
{chr(10).join(fmt(c) for c in arch) or '  (none)'}

CANDIDATE THEMES (pick 0–3 by slug):
{chr(10).join(fmt(c) for c in them) or '  (none)'}

Return the JSON now."""

def parse_json(txt):
    t = (txt or "").strip()
    if t.startswith("```"): t = re.sub(r"^```[a-z]*\n?|\n?```$", "", t).strip()
    try: return json.loads(t)
    except Exception:
        m = re.search(r"\{.*\}", t, re.S)
        if m:
            try: return json.loads(m.group(0))
            except Exception: pass
    return None

# ---------- figures ----------
def fetch_figures(kind, limit, film_ids=None):
    """film_ids: when given (factory --films scoping), restrict to those films AND exclude
    figures that already have a figure_taxonomy row for this axis (additive/idempotent —
    the unscoped corpus-wide path already relies on the caller not re-running finished figures,
    but a scoped incremental run must self-exclude or every re-run re-charges the same figures)."""
    out, off, page = [], 0, 1000
    fid_filter = f"&film_id=in.({','.join(film_ids)})" if film_ids else ""
    while True:
        sel = "id,label,description,film:films(title,director,year)"
        rows = sb_get(f"figures?kind=eq.{kind}&embedding=not.is.null{fid_filter}&select={sel}&order=id&limit={page}&offset={off}")
        for r in rows:
            f = r.get("film") or {}
            out.append({"id": r["id"], "label": r["label"], "description": r.get("description"),
                        "film": (f or {}).get("title"), "director": (f or {}).get("director"),
                        "year": (f or {}).get("year")})
        if len(rows) < page: break
        off += page
        if limit and len(out) >= limit: break
    out = out[:limit] if limit else out
    if film_ids:
        fids = ",".join(r["id"] for r in out) or "00000000-0000-0000-0000-000000000000"
        tagged_rows = sb_get(f"figure_taxonomy?select=figure_id&figure_id=in.({fids})")
        tagged = {r["figure_id"] for r in tagged_rows}
        out = [r for r in out if r["id"] not in tagged]
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", default="object", choices=list(KIND_SPEC))
    ap.add_argument("--model", default=MODEL_DEFAULT)
    ap.add_argument("--arch", type=int, default=10)
    ap.add_argument("--theme", type=int, default=8)
    ap.add_argument("--max-tokens", type=int, default=400)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--poll-secs", type=int, default=20)
    ap.add_argument("--no-write", action="store_true")
    ap.add_argument("--fresh", action="store_true")
    ap.add_argument("--films", default=None, help="factory scoping: slug,slug — only these films' untagged figures")
    ap.add_argument("--out", default=None, help="namespace the batch/results file (required with --films)")
    a = ap.parse_args()

    for n, v in [("NEXT_PUBLIC_SUPABASE_URL", URL), ("SUPABASE_SERVICE_ROLE_KEY", KEY), ("ANTHROPIC_API_KEY", ANTH)]:
        if not v: raise SystemExit(f"Missing env: {n}")
    sp = KIND_SPEC[a.kind]
    film_ids = None
    if a.films:
        slugs = [s.strip() for s in a.films.split(",") if s.strip()]
        frows = sb_get(f"films?slug=in.({','.join(slugs)})&select=id")
        film_ids = [r["id"] for r in frows]
        if not film_ids: print("  no matching films for --films — nothing to do."); return
    tag = f"-{a.out}" if a.out else ("-scoped" if a.films else "")
    batch_file = os.path.join(ELEM, f"catalog-map-{a.kind}{tag}.batch")
    os.makedirs(ELEM, exist_ok=True)

    # ----- vocab maps -----
    print("▶ loading taxonomy maps …")
    tier_nodes = {nk: sort_nodes(sb_get(f"taxonomy_nodes?kind=eq.{nk}&select=id,code,label")) for _, nk, _, _ in sp["tiers"]}
    code2id = {nk: {n["code"]: n["id"] for n in nodes if n.get("code")} for nk, nodes in tier_nodes.items()}
    valid_codes = {nk: set(code2id[nk]) for nk in code2id}
    arch_nodes = sb_get(f"taxonomy_nodes?kind=eq.{sp['arch_kind']}&select=id,slug")
    arch_slug2id = {n["slug"]: n["id"] for n in arch_nodes}
    theme_nodes = sb_get("taxonomy_nodes?kind=eq.theme&select=id,slug")
    theme_slug2id = {n["slug"]: n["id"] for n in theme_nodes}
    prefix = build_prefix(a.kind, tier_nodes)

    # ===== submit (unless resuming) =====
    batch_id = None
    if os.path.exists(batch_file) and not a.fresh:
        batch_id = open(batch_file).read().strip()
        print(f"▶ resuming saved batch {batch_id} (use --fresh to resubmit)")

    candmap = {}   # figure_id -> {"arch":set,"theme":set}
    if not batch_id:
        print(f"▶ fetching {a.kind} figures …")
        figs = fetch_figures(a.kind, a.limit, film_ids)
        print(f"  {len(figs)} figures · building requests (kNN candidates each) …")
        requests = []
        for i, fig in enumerate(figs, 1):
            cands = sb_rpc("catalog_candidates", {"p_figure_id": fig["id"], "p_n_arch": a.arch,
                                                  "p_n_theme": a.theme, "p_arch_kind": sp["arch_kind"]})
            candmap[fig["id"]] = {"arch": sorted({c["slug"] for c in cands if c["bucket"] == "archetype"}),
                                  "theme": sorted({c["slug"] for c in cands if c["bucket"] == "theme"})}
            requests.append({"custom_id": fig["id"], "params": {
                "model": a.model, "max_tokens": a.max_tokens,
                "system": [{"type": "text", "text": prefix, "cache_control": {"type": "ephemeral"}}],
                "messages": [{"role": "user", "content": build_user(a.kind, fig, cands)}]}})
            if i % 200 == 0: print(f"    prepared {i}/{len(figs)}")
        json.dump(candmap, open(os.path.join(ELEM, f"catalog-map-{a.kind}{tag}.cands.json"), "w"))
        print(f"▶ submitting batch ({len(requests)} requests) …")
        st, body = anth("POST", "/v1/messages/batches", {"requests": requests})
        if st not in (200, 201): raise SystemExit(f"batch create {st}: {body}")
        batch_id = json.loads(body)["id"]
        open(batch_file, "w").write(batch_id)
        print(f"  batch id {batch_id}  (saved to {batch_file})")
    else:
        cf = os.path.join(ELEM, f"catalog-map-{a.kind}{tag}.cands.json")
        if os.path.exists(cf): candmap = json.load(open(cf))

    # ===== poll =====
    while True:
        st, body = anth("GET", f"/v1/messages/batches/{batch_id}")
        if st != 200: raise SystemExit(f"batch get {st}: {body}")
        b = json.loads(body); cnt = b.get("request_counts", {})
        print(f"  status={b['processing_status']}  {cnt}")
        if b["processing_status"] == "ended": break
        time.sleep(a.poll_secs)

    # ===== retrieve =====
    print("▶ retrieving results …")
    st, body = anth("GET", f"/v1/messages/batches/{batch_id}/results", timeout=600)
    if st != 200: raise SystemExit(f"results {st}: {body}")
    open(os.path.join(ELEM, f"catalog-map-{a.kind}{tag}-results.jsonl"), "w").write(body)

    # ===== validate + resolve =====
    rows, stat = [], {"ok": 0, "abstain": 0, "err": 0, "bad_code": 0, "bad_arch": 0, "themes": 0}
    usage = {"in": 0, "out": 0, "cw": 0, "cr": 0}
    tier_fields = [(f, nk) for f, nk, _, _ in sp["tiers"]]
    for line in body.splitlines():
        line = line.strip()
        if not line: continue
        rec = json.loads(line)
        fid = rec.get("custom_id")
        res = rec.get("result", {})
        if res.get("type") != "succeeded":
            stat["err"] += 1; continue
        msg = res.get("message", {})
        u = msg.get("usage", {})
        usage["in"] += u.get("input_tokens", 0); usage["out"] += u.get("output_tokens", 0)
        usage["cw"] += u.get("cache_creation_input_tokens", 0); usage["cr"] += u.get("cache_read_input_tokens", 0)
        txt = "".join(p.get("text", "") for p in msg.get("content", []) if p.get("type") == "text")
        obj = parse_json(txt)
        if not obj: stat["err"] += 1; continue
        cand = candmap.get(fid, {"arch": set(), "theme": set()})
        cand_arch = set(cand.get("arch") or []); cand_theme = set(cand.get("theme") or [])

        def add(node_id, axis, conf=None):
            if node_id: rows.append({"figure_id": fid, "node_id": node_id, "axis": axis,
                                     "confidence": conf, "source": "llm"})

        if obj.get("is_match"):
            stat["ok"] += 1
            for field, nk in tier_fields:
                code = obj.get(field)
                if code is None: continue
                code = str(code).strip()
                if code in valid_codes[nk]: add(code2id[nk][code], nk)
                else: stat["bad_code"] += 1
            aslug = obj.get("archetype")
            if aslug:
                if aslug in cand_arch and aslug in arch_slug2id:
                    conf = obj.get("archetype_conf")
                    try: conf = round(float(conf), 3)
                    except Exception: conf = None
                    add(arch_slug2id[aslug], sp["arch_kind"], conf)
                else: stat["bad_arch"] += 1
        else:
            stat["abstain"] += 1
        for tslug in (obj.get("themes") or [])[:3]:
            if tslug in theme_slug2id and (not cand_theme or tslug in cand_theme):
                add(theme_slug2id[tslug], "theme"); stat["themes"] += 1

    # dedup on PK (figure_id, node_id, axis) — duplicates in one upsert payload would error
    seen, deduped = set(), []
    for r in rows:
        k = (r["figure_id"], r["node_id"], r["axis"])
        if k in seen: continue
        seen.add(k); deduped.append(r)
    rows = deduped

    # ===== write =====
    print(f"\n  results: ok={stat['ok']} abstain={stat['abstain']} err={stat['err']} "
          f"| dropped: bad_code={stat['bad_code']} bad_arch={stat['bad_arch']} | theme_links={stat['themes']}")
    by_axis = {}
    for r in rows: by_axis[r["axis"]] = by_axis.get(r["axis"], 0) + 1
    print("  rows by axis:", by_axis, f"| total {len(rows)}")
    bi = (PRICE["in"]*usage["in"] + PRICE["out"]*usage["out"] + PRICE["cw"]*usage["cw"] + PRICE["cr"]*usage["cr"]) / 1e6
    print(f"  tokens in={usage['in']:,} out={usage['out']:,} cw={usage['cw']:,} cr={usage['cr']:,}"
          f"  → batch cost ≈ ${bi*0.5:.2f}")

    if a.no_write:
        print("\n(--no-write) nothing inserted.")
        return
    if not rows:
        print("\nno rows to write."); return
    print(f"\n▶ writing {len(rows)} rows to figure_taxonomy (upsert) …")
    ok = 0
    hdr = sbh({"Prefer": "resolution=merge-duplicates,return=minimal"})
    for i in range(0, len(rows), 500):
        chunk = rows[i:i+500]
        st, b = http("POST", f"{URL}/rest/v1/figure_taxonomy?on_conflict=figure_id,node_id,axis", hdr, chunk)
        if st not in (200, 201, 204): raise SystemExit(f"insert {st}: {b}")
        ok += len(chunk); print(f"    wrote {ok}/{len(rows)}")
    print(f"\n✅ {a.kind}: wrote {ok} figure_taxonomy rows from {stat['ok']} matched + {stat['abstain']} abstained figures.")
    print(f"   (batch {batch_id} done — delete {os.path.basename(batch_file)} before re-running this kind.)")

if __name__ == "__main__":
    main()
