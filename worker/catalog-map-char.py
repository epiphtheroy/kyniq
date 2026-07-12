#!/usr/bin/env python3
"""Catalog mapping — CHARACTERS (multi-label) → figure_taxonomy.

Characters don't fit the object/location two-tier shape. Each character figure gets:
  • identities  (Axis1, char_identity)  — MULTIPLE roles (Mother, Doctor, Defector…)   1–5
  • complexes   (Axis3, char_complex)   — 0–3 internal complexes (The Mask-Wearer…)
  • archetype   (char_archetype, the 16 named Role×Complex, e.g. Femme Fatale) — 0–1, confident only
  • themes      (theme)                 — 0–3
  • abstention  — if the figure isn't really a person/character.
(Axis2 narrative function is deferred per the locked plan.)

kNN (catalog_char_candidates RPC) proposes identity/complex/theme candidates; the 16 archetypes
are enumerated in the cached prompt prefix. Model = Sonnet. Output validated against candidates
(no hallucinated labels) then written to figure_taxonomy (axis = node kind).

Usage:
  python3 catalog-map-char.py --dry --n 14          # real-time sample → markdown + cost (no DB)
  python3 catalog-map-char.py --no-write            # full batch, validate + cost, no DB write
  python3 catalog-map-char.py                       # full batch → figure_taxonomy
  python3 catalog-map-char.py --fresh               # ignore saved batch id, resubmit
"""
import os, sys, re, json, time, argparse, urllib.request, urllib.error, concurrent.futures as cf

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ELEM = os.path.join(ROOT, "Element")

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
ANTH = os.environ.get("ANTHROPIC_API_KEY")
MODEL = "claude-sonnet-4-6"
PRICE = {"in": 3.0, "out": 15.0, "cw": 3.75, "cr": 0.30}
N_CHAR = 3100
CAPS = {"identity": 5, "complex": 3, "theme": 3}

def http(method, url, headers=None, body=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    if body is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:1200]

def sbh(extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if extra: h.update(extra)
    return h
def sb_rpc(name, payload):
    st, b = http("POST", f"{URL}/rest/v1/rpc/{name}", sbh(), payload)
    if st not in (200, 201): raise SystemExit(f"RPC {name} {st}: {b}")
    return json.loads(b)
def sb_get(path):
    st, b = http("GET", f"{URL}/rest/v1/{path}", sbh())
    if st != 200: raise SystemExit(f"GET {path} {st}: {b}")
    return json.loads(b)
def anth(method, path, body=None, timeout=300):
    return http(method, f"https://api.anthropic.com{path}",
                {"x-api-key": ANTH, "anthropic-version": "2023-06-01"}, body, timeout=timeout)
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

def build_prefix(archetypes):
    arch = "\n".join(f"  {a['slug']}  «{a['label']}»" + (f" — {a['def']}" if a.get('def') else "") for a in archetypes)
    return f"""You classify a single FILM CHARACTER against a controlled catalog, on three axes. \
You are given the character plus nearest-neighbour candidate IDENTITIES, COMPLEXES and THEMES \
(pre-selected by embedding similarity). Confirm or abstain.

THE THREE AXES:
- IDENTITY (Axis1): the character's objective social/relational ROLES — e.g. Mother, Doctor, Widow,
  Soldier, Adopted Child. A character usually has SEVERAL. Pick 1–5 from the candidates.
- COMPLEX (Axis3): the character's internal psychological conflict — e.g. "The Mask-Wearer"
  (authenticity vs persona). Pick 0–3 from the candidates, only if clearly present.
- ARCHETYPE: a single named Role×Complex type (the famous figures below). These 16 are SPECIFIC;
  MOST characters match NONE, so null is the common and correct answer. Assign one ONLY if the
  character is unmistakably that exact type — never a merely adjacent one (do not stretch a
  category to fit). Choose from THIS fixed list (by slug):
{arch}

RULES:
- ABSTENTION: if the figure is NOT an individual person/character (a group, an object, a place,
  an abstraction), set "is_match": false and leave identities/complexes/archetype empty. You may
  still attach themes.
- Pick identities/complexes/themes ONLY by the SLUGS given in the candidates. Archetype slug ONLY
  from the fixed list above. Never invent a label not offered.
- Prefer precision: a few correct identities/complexes beat many loose ones.

Respond with ONLY a JSON object, no prose, no fence:
{{"is_match": bool, "identities": ["slug",...], "complexes": ["slug",...],
  "archetype": "slug"|null, "archetype_conf": 0.0-1.0, "themes": ["slug",...], "note": "<=12 words"}}"""

def build_user(fig, cands):
    def grp(b): return [c for c in cands if c["bucket"] == b]
    def fmt(c):
        d = (c.get("definition") or "").strip().replace("\n", " ")
        d = (d[:90] + "…") if len(d) > 90 else d
        return f"  - {c['slug']}  «{c['label']}»  sim={c['sim']:.2f}" + (f"  — {d}" if d else "")
    meta = [x for x in [fig.get("film"), fig.get("director"), (str(fig["year"]) if fig.get("year") else None)] if x]
    desc = (fig.get("description") or "").strip()
    if len(desc) > 700: desc = desc[:700] + "…"
    return f"""CHARACTER: {fig['label']}
FILM: {' · '.join(meta) if meta else '(unknown)'}
DESCRIPTION: {desc or '(none)'}

CANDIDATE IDENTITIES (pick 1–5 by slug):
{chr(10).join(fmt(c) for c in grp('identity')) or '  (none)'}

CANDIDATE COMPLEXES (pick 0–3 by slug):
{chr(10).join(fmt(c) for c in grp('complex')) or '  (none)'}

CANDIDATE THEMES (pick 0–3 by slug):
{chr(10).join(fmt(c) for c in grp('theme')) or '  (none)'}

Return the JSON now."""

def call_realtime(prefix, user, max_tokens):
    body = {"model": MODEL, "max_tokens": max_tokens,
            "system": [{"type": "text", "text": prefix, "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": "user", "content": user}]}
    raw = ""
    for attempt in range(6):
        st, raw = anth("POST", "/v1/messages", body)
        if st == 200:
            r = json.loads(raw); u = r.get("usage", {})
            txt = "".join(p.get("text", "") for p in r.get("content", []) if p.get("type") == "text")
            return parse_json(txt), {"in": u.get("input_tokens", 0), "out": u.get("output_tokens", 0),
                                     "cw": u.get("cache_creation_input_tokens", 0), "cr": u.get("cache_read_input_tokens", 0)}
        if st in (429, 500, 502, 503, 529):  # rate limit / overloaded → backoff + retry
            time.sleep(min(2 ** attempt, 30)); continue
        break
    return {"error": f"{st}: {raw}"}, {"in": 0, "out": 0, "cw": 0, "cr": 0}

def cost(u, batch=False):
    c = (u["in"]*PRICE["in"] + u["out"]*PRICE["out"] + u["cw"]*PRICE["cw"] + u["cr"]*PRICE["cr"]) / 1e6
    return c*0.5 if batch else c

def fetch_figures(limit, film_ids=None):
    """film_ids: factory --films scoping — restrict to those films AND exclude figures that
    already have a figure_taxonomy row (additive/idempotent for scoped incremental runs)."""
    out, off, page = [], 0, 1000
    fid_filter = f"&film_id=in.({','.join(film_ids)})" if film_ids else ""
    while True:
        rows = sb_get(f"figures?kind=eq.character&embedding=not.is.null{fid_filter}&select=id,label,description,film:films(title,director,year)&order=id&limit={page}&offset={off}")
        for r in rows:
            f = r.get("film") or {}
            out.append({"id": r["id"], "label": r["label"], "description": r.get("description"),
                        "film": f.get("title"), "director": f.get("director"), "year": f.get("year")})
        if len(rows) < page: break
        off += page
        if limit and len(out) >= limit: break
    out = out[:limit] if limit else out
    if film_ids:
        fids = ",".join(r["id"] for r in out) or "00000000-0000-0000-0000-000000000000"
        tagged = {r["figure_id"] for r in sb_get(f"figure_taxonomy?select=figure_id&figure_id=in.({fids})")}
        out = [r for r in out if r["id"] not in tagged]
    return out

# ---------- shared resolve ----------
def load_maps():
    arche = sb_get("taxonomy_nodes?kind=eq.char_archetype&select=id,slug,label,definition")
    for a in arche: a["def"] = (a.get("definition") or "")[:70]
    return {
        "arche": arche,
        "ident": {n["slug"]: n["id"] for n in sb_get("taxonomy_nodes?kind=eq.char_identity&select=id,slug")},
        "complex": {n["slug"]: n["id"] for n in sb_get("taxonomy_nodes?kind=eq.char_complex&select=id,slug")},
        "archmap": {a["slug"]: a["id"] for a in arche},
        "theme": {n["slug"]: n["id"] for n in sb_get("taxonomy_nodes?kind=eq.theme&select=id,slug")},
    }

def resolve(fid, obj, cand, maps, stat):
    """Return list of figure_taxonomy rows; mutate stat counters."""
    rows = []
    def add(nid, axis, conf=None):
        if nid: rows.append({"figure_id": fid, "node_id": nid, "axis": axis, "confidence": conf, "source": "llm"})
    cand_i = set(cand.get("identity") or []); cand_c = set(cand.get("complex") or []); cand_t = set(cand.get("theme") or [])
    if obj.get("is_match"):
        stat["ok"] += 1
        for s in (obj.get("identities") or [])[:CAPS["identity"]]:
            if s in cand_i and s in maps["ident"]: add(maps["ident"][s], "char_identity")
            else: stat["bad_ident"] += 1
        for s in (obj.get("complexes") or [])[:CAPS["complex"]]:
            if s in cand_c and s in maps["complex"]: add(maps["complex"][s], "char_complex")
            else: stat["bad_complex"] += 1
        a = obj.get("archetype")
        if a:
            if a in maps["archmap"]:
                conf = obj.get("archetype_conf")
                try: conf = round(float(conf), 3)
                except Exception: conf = None
                add(maps["archmap"][a], "char_archetype", conf)
            else: stat["bad_arch"] += 1
    else:
        stat["abstain"] += 1
    for s in (obj.get("themes") or [])[:CAPS["theme"]]:
        if s in maps["theme"] and (not cand_t or s in cand_t): add(maps["theme"][s], "theme")
    return rows

# ---------- DRY ----------
def run_dry(a, maps, prefix):
    sample = sb_rpc("catalog_dry_sample", {"p_kind": "character", "p_n": a.n, "p_salt": a.salt})
    print(f"  {len(sample)} characters · model {MODEL}")
    tot = {"in": 0, "out": 0, "cw": 0, "cr": 0}; L = []
    L += ["# Catalog mapping — CHARACTERS DRY", "", f"Sample: **{len(sample)}** characters · model {MODEL}", ""]
    for i, fig in enumerate(sample, 1):
        cands = sb_rpc("catalog_char_candidates", {"p_figure_id": fig["id"], "p_n_ident": a.ident,
                                                   "p_n_complex": a.complex, "p_n_theme": a.theme})
        obj, u = call_realtime(prefix, build_user(fig, cands), a.max_tokens)
        for k in tot: tot[k] += u[k]
        print(f"  [{i:>2}/{len(sample)}] {fig['label'][:48]}")
        meta = " · ".join(x for x in [fig.get("film"), str(fig.get("year") or "")] if x)
        L += [f"### {fig['label']}", f"*{meta}*  ", ""]
        d = (fig.get("description") or "").strip()
        if d: L.append(f"> {d[:220]}{'…' if len(d) > 220 else ''}\n")
        if not obj or "error" in (obj or {}):
            L.append(f"⚠️ {obj.get('error','parse fail') if obj else 'no output'}\n"); continue
        if not obj.get("is_match"):
            L.append(f"**abstain** — _{obj.get('note','')}_ · themes: {', '.join(obj.get('themes') or []) or '—'}\n"); continue
        L.append(f"- **identities**: {', '.join(obj.get('identities') or []) or '—'}")
        L.append(f"- **complexes**: {', '.join(obj.get('complexes') or []) or '—'}")
        ar = obj.get("archetype")
        L.append(f"- **archetype**: {ar+(' (%.2f)'%obj.get('archetype_conf',0)) if ar else '—'}")
        L.append(f"- **themes**: {', '.join(obj.get('themes') or []) or '—'}")
        L.append(f"- _{obj.get('note','')}_\n")
    pf = cost(tot) / max(len(sample), 1)
    L[3] += f"  · sample ${cost(tot):.4f} · ${pf:.5f}/char · proj: {N_CHAR:,} chars ≈ ${pf*N_CHAR:.2f} real-time / ${pf*N_CHAR*0.5:.2f} batch"
    out = os.path.join(ELEM, "catalog-map-DRY-character.md")
    open(out, "w").write("\n".join(L))
    print(f"\n  sample ${cost(tot):.4f} · ${pf:.5f}/char · 3,100 ≈ ${pf*N_CHAR*0.5:.2f} batch\n  → {out}")

# ---------- CANCEL ----------
def do_cancel():
    bf = os.path.join(ELEM, "catalog-map-character.batch")
    if not os.path.exists(bf):
        print("  no saved character batch to cancel."); return
    bid = open(bf).read().strip()
    st, b = anth("POST", f"/v1/messages/batches/{bid}/cancel", None)
    print(f"  cancel {bid}: HTTP {st}")
    for f in (bf, os.path.join(ELEM, "catalog-map-character.cands.json")):
        try: os.remove(f)
        except OSError: pass
    print("  removed local batch/cands files.")

# ---------- SYNC (real-time, concurrent) ----------
def run_sync(a, maps, prefix):
    figs = fetch_figures(a.limit)
    print(f"▶ {len(figs)} characters · real-time × {a.workers} workers (Sonnet, ~a few min) …")
    def work(fig):
        c = sb_rpc("catalog_char_candidates", {"p_figure_id": fig["id"], "p_n_ident": a.ident,
                                               "p_n_complex": a.complex, "p_n_theme": a.theme})
        cand = {"identity": [x["slug"] for x in c if x["bucket"] == "identity"],
                "complex": [x["slug"] for x in c if x["bucket"] == "complex"],
                "theme": [x["slug"] for x in c if x["bucket"] == "theme"]}
        obj, u = call_realtime(prefix, build_user(fig, c), a.max_tokens)
        return fig["id"], obj, cand, u

    results, usage, done = {}, {"in": 0, "out": 0, "cw": 0, "cr": 0}, 0
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        for fut in cf.as_completed([ex.submit(work, f) for f in figs]):
            fid, obj, cand, u = fut.result()
            results[fid] = (obj, cand)
            for k in usage: usage[k] += u[k]
            done += 1
            if done % 100 == 0 or done == len(figs): print(f"  {done}/{len(figs)}")

    rows, stat = [], {"ok": 0, "abstain": 0, "err": 0, "bad_ident": 0, "bad_complex": 0, "bad_arch": 0}
    for fid, (obj, cand) in results.items():
        if not obj or "error" in obj: stat["err"] += 1; continue
        rows += resolve(fid, obj, cand, maps, stat)
    seen, dd = set(), []
    for r in rows:
        k = (r["figure_id"], r["node_id"], r["axis"])
        if k not in seen: seen.add(k); dd.append(r)
    rows = dd
    by = {}
    for r in rows: by[r["axis"]] = by.get(r["axis"], 0) + 1
    print(f"\n  results: ok={stat['ok']} abstain={stat['abstain']} err={stat['err']} | "
          f"dropped ident={stat['bad_ident']} complex={stat['bad_complex']} arch={stat['bad_arch']}")
    print("  rows by axis:", by, f"| total {len(rows)}")
    print(f"  tokens in={usage['in']:,} out={usage['out']:,} → real-time cost ≈ ${cost(usage):.2f}")
    if a.no_write: print("\n(--no-write) nothing inserted."); return
    if not rows: print("\nno rows."); return
    print(f"\n▶ writing {len(rows)} rows …")
    ok = 0; hdr = sbh({"Prefer": "resolution=merge-duplicates,return=minimal"})
    for i in range(0, len(rows), 500):
        ch = rows[i:i+500]
        st, b = http("POST", f"{URL}/rest/v1/figure_taxonomy?on_conflict=figure_id,node_id,axis", hdr, ch)
        if st not in (200, 201, 204): raise SystemExit(f"insert {st}: {b}")
        ok += len(ch); print(f"    wrote {ok}/{len(rows)}")
    print(f"\n✅ characters (sync): wrote {ok} rows from {stat['ok']} matched + {stat['abstain']} abstained.")

# ---------- BATCH ----------
def run_batch(a, maps, prefix, film_ids=None, tag=""):
    bf = os.path.join(ELEM, f"catalog-map-character{tag}.batch")
    cf = os.path.join(ELEM, f"catalog-map-character{tag}.cands.json")
    batch_id = None
    if os.path.exists(bf) and not a.fresh:
        batch_id = open(bf).read().strip(); print(f"▶ resuming batch {batch_id}")
    candmap = {}
    if not batch_id:
        figs = fetch_figures(a.limit, film_ids)
        if film_ids and not figs:
            print("  no untagged figures for --films — nothing to do."); return
        print(f"▶ {len(figs)} characters · building requests …")
        reqs = []
        for i, fig in enumerate(figs, 1):
            c = sb_rpc("catalog_char_candidates", {"p_figure_id": fig["id"], "p_n_ident": a.ident,
                                                   "p_n_complex": a.complex, "p_n_theme": a.theme})
            candmap[fig["id"]] = {"identity": sorted({x["slug"] for x in c if x["bucket"] == "identity"}),
                                  "complex": sorted({x["slug"] for x in c if x["bucket"] == "complex"}),
                                  "theme": sorted({x["slug"] for x in c if x["bucket"] == "theme"})}
            reqs.append({"custom_id": fig["id"], "params": {
                "model": MODEL, "max_tokens": a.max_tokens,
                "system": [{"type": "text", "text": prefix, "cache_control": {"type": "ephemeral"}}],
                "messages": [{"role": "user", "content": build_user(fig, c)}]}})
            if i % 200 == 0: print(f"    prepared {i}/{len(figs)}")
        json.dump(candmap, open(cf, "w"))
        print(f"▶ submitting batch ({len(reqs)}) …")
        st, b = anth("POST", "/v1/messages/batches", {"requests": reqs})
        if st not in (200, 201): raise SystemExit(f"batch create {st}: {b}")
        batch_id = json.loads(b)["id"]; open(bf, "w").write(batch_id)
        print(f"  batch id {batch_id}")
    elif os.path.exists(cf):
        candmap = json.load(open(cf))

    while True:
        st, b = anth("GET", f"/v1/messages/batches/{batch_id}")
        if st != 200: raise SystemExit(f"get {st}: {b}")
        j = json.loads(b); print(f"  status={j['processing_status']}  {j.get('request_counts',{})}")
        if j["processing_status"] == "ended": break
        time.sleep(a.poll_secs)

    print("▶ retrieving …")
    st, body = anth("GET", f"/v1/messages/batches/{batch_id}/results", timeout=600)
    if st != 200: raise SystemExit(f"results {st}: {body}")
    open(os.path.join(ELEM, f"catalog-map-character{tag}-results.jsonl"), "w").write(body)

    rows, u = [], {"in": 0, "out": 0, "cw": 0, "cr": 0}
    stat = {"ok": 0, "abstain": 0, "err": 0, "bad_ident": 0, "bad_complex": 0, "bad_arch": 0}
    for line in body.splitlines():
        if not line.strip(): continue
        rec = json.loads(line); res = rec.get("result", {})
        if res.get("type") != "succeeded": stat["err"] += 1; continue
        msg = res["message"]; us = msg.get("usage", {})
        for k, kk in [("in", "input_tokens"), ("out", "output_tokens"), ("cw", "cache_creation_input_tokens"), ("cr", "cache_read_input_tokens")]:
            u[k] += us.get(kk, 0)
        txt = "".join(p.get("text", "") for p in msg.get("content", []) if p.get("type") == "text")
        obj = parse_json(txt)
        if not obj: stat["err"] += 1; continue
        rows += resolve(rec["custom_id"], obj, candmap.get(rec["custom_id"], {}), maps, stat)

    seen, dd = set(), []
    for r in rows:
        k = (r["figure_id"], r["node_id"], r["axis"])
        if k not in seen: seen.add(k); dd.append(r)
    rows = dd
    by = {}
    for r in rows: by[r["axis"]] = by.get(r["axis"], 0) + 1
    print(f"\n  results: ok={stat['ok']} abstain={stat['abstain']} err={stat['err']} | "
          f"dropped ident={stat['bad_ident']} complex={stat['bad_complex']} arch={stat['bad_arch']}")
    print("  rows by axis:", by, f"| total {len(rows)}")
    print(f"  tokens in={u['in']:,} out={u['out']:,} cw={u['cw']:,} cr={u['cr']:,} → batch ≈ ${cost(u, True):.2f}")

    if a.no_write: print("\n(--no-write) nothing inserted."); return
    if not rows: print("\nno rows."); return
    print(f"\n▶ writing {len(rows)} rows …")
    ok = 0; hdr = sbh({"Prefer": "resolution=merge-duplicates,return=minimal"})
    for i in range(0, len(rows), 500):
        ch = rows[i:i+500]
        st, b = http("POST", f"{URL}/rest/v1/figure_taxonomy?on_conflict=figure_id,node_id,axis", hdr, ch)
        if st not in (200, 201, 204): raise SystemExit(f"insert {st}: {b}")
        ok += len(ch); print(f"    wrote {ok}/{len(rows)}")
    print(f"\n✅ characters: wrote {ok} rows from {stat['ok']} matched + {stat['abstain']} abstained.")
    print(f"   (delete catalog-map-character.batch before re-running.)")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--sync", action="store_true")
    ap.add_argument("--cancel", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--n", type=int, default=14)
    ap.add_argument("--salt", default="metatake-v1")
    ap.add_argument("--ident", type=int, default=14)
    ap.add_argument("--complex", type=int, default=10)
    ap.add_argument("--theme", type=int, default=8)
    ap.add_argument("--max-tokens", type=int, default=450)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--poll-secs", type=int, default=20)
    ap.add_argument("--no-write", action="store_true")
    ap.add_argument("--fresh", action="store_true")
    ap.add_argument("--films", default=None, help="factory scoping: slug,slug — only these films' untagged figures")
    ap.add_argument("--out", default=None, help="namespace the batch/results file (required with --films)")
    a = ap.parse_args()
    for n, v in [("NEXT_PUBLIC_SUPABASE_URL", URL), ("SUPABASE_SERVICE_ROLE_KEY", KEY), ("ANTHROPIC_API_KEY", ANTH)]:
        if not v: raise SystemExit(f"Missing env: {n}")
    os.makedirs(ELEM, exist_ok=True)
    if a.cancel: do_cancel(); return
    film_ids = None
    if a.films:
        slugs = [s.strip() for s in a.films.split(",") if s.strip()]
        film_ids = [r["id"] for r in sb_get(f"films?slug=in.({','.join(slugs)})&select=id")]
        if not film_ids: print("  no matching films for --films — nothing to do."); return
    tag = f"-{a.out}" if a.out else ("-scoped" if a.films else "")
    print("▶ loading taxonomy maps …")
    maps = load_maps()
    prefix = build_prefix(maps["arche"])
    print(f"  {len(maps['ident'])} identities · {len(maps['complex'])} complexes · {len(maps['arche'])} archetypes · {len(maps['theme'])} themes")
    if a.dry: run_dry(a, maps, prefix)
    elif a.sync: run_sync(a, maps, prefix)
    else: run_batch(a, maps, prefix, film_ids, tag)

if __name__ == "__main__":
    main()
