#!/usr/bin/env python3
"""Catalog mapping — figure → taxonomy node (DRY comparison + cost meter).

Hybrid pipeline, DRY pilot stage. Works for any "concrete" figure kind (object, location):
  1. embedding kNN (catalog_candidates RPC) proposes ARCHETYPE + THEME candidates.
     Coarse TIER lists (Object Type/Function; Place Category/Type) are small controlled
     vocabularies, enumerated in the cached prompt prefix — not kNN'd.
  2. an LLM picks the tier codes + a (confident) archetype + up to 3 themes, WITH ABSTENTION
     (figure.kind is noisy: motifs / actions / creatures / durations are NOT props/places).

This DRY runner classifies the SAME sample with BOTH Haiku 4.5 and Sonnet 4.6 so quality
("mechanical vs nuanced") can be eyeballed side by side, prints the EXACT measured token cost
(real-time) + a full-run projection (real-time + Batch 50% off). It NEVER writes to the DB.

Prompt caching: the fixed instruction + tier enumeration is sent with cache_control=ephemeral,
so after the first call each model reads the prefix from cache (~90% cheaper on that part).

Usage:
  python3 catalog-map.py --dry                          # 24 object figures, both models
  python3 catalog-map.py --dry --kind location --n 18
  python3 catalog-map.py --dry --models haiku
"""
import os, sys, re, json, time, argparse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)

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

# Model ids + USD pricing per 1M tokens (real-time). Batch = ×0.5. cw=cache write(5m), cr=cache read.
MODELS = {
    "haiku":  {"id": "claude-haiku-4-5",  "in": 1.0, "out": 5.0,  "cw": 1.25, "cr": 0.10},
    "sonnet": {"id": "claude-sonnet-4-6", "in": 3.0, "out": 15.0, "cw": 3.75, "cr": 0.30},
}

# Figure-kind population (for projection).
SCOPE = {"object": 1777, "character": 3100, "location": 1849, "film": 1934,
         "form": 3193, "title": 1930, "trope": 4385}

# Per-kind spec. tiers = (output_field, node_kind, header, one-line description).
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
def http(method, url, headers=None, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:800]

def sb_headers(): return {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

def sb_rpc(name, payload):
    st, body = http("POST", f"{URL}/rest/v1/rpc/{name}", sb_headers(), payload)
    if st not in (200, 201): raise SystemExit(f"RPC {name} {st}: {body}")
    return json.loads(body)

def sb_get(path):
    st, body = http("GET", f"{URL}/rest/v1/{path}", sb_headers())
    if st != 200: raise SystemExit(f"GET {path} {st}: {body}")
    return json.loads(body)

def sort_nodes(lst):
    def k(x):
        c = (x.get("code") or "")
        return (0, int(c)) if c.isdigit() else (1, c or x.get("label", ""))
    return sorted(lst, key=k)

# ---------- prompt ----------
def build_prefix(kind, tierdata):
    sp = KIND_SPEC[kind]
    blocks = []
    fields = []
    for field, node_kind, header, desc in sp["tiers"]:
        fields.append(field)
        rows = "\n".join(f"  {n['code']}  {n['label']}" for n in tierdata[node_kind])
        blocks.append(f"{header} — {desc} (choose one CODE → output field \"{field}\"):\n{rows}")
    tiers_txt = "\n\n".join(blocks)
    schema_fields = ", ".join(f'"{f}": "code"|null' for f in fields)
    return f"""You classify a single FILM FIGURE (a thing named in a movie) against a controlled \
catalog. You are given the figure plus a short list of nearest-neighbour candidate \
{sp['arch_word'].title()}s and THEMES (already pre-selected by embedding similarity). \
Confirm or abstain.

CONTROLLED LISTS (choose by CODE):

{tiers_txt}

RULES:
- ABSTENTION IS CORRECT AND EXPECTED. figure.kind is noisy. If the figure is NOT a \
{sp['noun']} — i.e. it is {sp['not_examples']} — set "is_match": false and leave the tier
  codes and archetype null. You may still attach themes.
- TWO TIERS. If it IS one: ALWAYS give the best tier CODE(s) above (coarse, near-universal).
  Give an "archetype" ONLY when a candidate genuinely names this figure's specific role;
  otherwise archetype=null. Never invent an archetype not in the candidate list.
- THEMES: attach 0–3 theme slugs from the candidate list, only those the figure is really
  about. Fewer precise themes beat many loose ones. [] is fine.
- Choose archetype and themes by their SLUG exactly as given. Tier values by CODE.

Respond with ONLY a JSON object, no prose, no markdown fence:
{{"is_match": bool, {schema_fields}, "archetype": "slug"|null, "archetype_conf": 0.0-1.0,
  "themes": ["slug",...], "note": "<=12 words: why / why abstain"}}"""

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

# ---------- anthropic ----------
def call_model(mkey, prefix, user, max_tokens):
    m = MODELS[mkey]
    body = {"model": m["id"], "max_tokens": max_tokens,
            "system": [{"type": "text", "text": prefix, "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": "user", "content": user}]}
    st, raw = http("POST", "https://api.anthropic.com/v1/messages",
                   {"x-api-key": ANTH, "anthropic-version": "2023-06-01"}, body)
    if st != 200:
        return {"error": f"{st}: {raw}"}, {"in": 0, "out": 0, "cw": 0, "cr": 0}
    r = json.loads(raw)
    txt = "".join(b.get("text", "") for b in r.get("content", []) if b.get("type") == "text")
    u = r.get("usage", {})
    usage = {"in": u.get("input_tokens", 0), "out": u.get("output_tokens", 0),
             "cw": u.get("cache_creation_input_tokens", 0), "cr": u.get("cache_read_input_tokens", 0)}
    return parse_json(txt), usage

def parse_json(txt):
    t = txt.strip()
    if t.startswith("```"): t = re.sub(r"^```[a-z]*\n?|\n?```$", "", t).strip()
    try: return json.loads(t)
    except Exception:
        m = re.search(r"\{.*\}", t, re.S)
        if m:
            try: return json.loads(m.group(0))
            except Exception: pass
    return {"error": "unparseable", "raw": txt[:200]}

def cost(usage, m):
    return (usage["in"]*m["in"] + usage["out"]*m["out"] + usage["cw"]*m["cw"] + usage["cr"]*m["cr"]) / 1e6

# ---------- render ----------
def cell(kind, res):
    if not res or "error" in res:
        return f"⚠️ {res.get('error','?')[:40]}" if res else "⚠️"
    if not res.get("is_match"):
        th = ", ".join(res.get("themes") or []) or "—"
        return f"**abstain**<br>themes: {th}<br>_{res.get('note','')}_"
    tiers = " · ".join(f"{f} **{res.get(f) or '?'}**" for f, *_ in KIND_SPEC[kind]["tiers"])
    arch = res.get("archetype")
    al = f"{arch} ({res.get('archetype_conf',0):.2f})" if arch else "_(tiers only)_"
    th = ", ".join(res.get("themes") or []) or "—"
    return f"{tiers}<br>archetype: {al}<br>themes: {th}<br>_{res.get('note','')}_"

def diverged(a, b):
    if not a or not b or "error" in a or "error" in b: return True
    if bool(a.get("is_match")) != bool(b.get("is_match")): return True
    return (a.get("archetype") or None) != (b.get("archetype") or None)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--kind", default="object", choices=list(KIND_SPEC))
    ap.add_argument("--n", type=int, default=24)
    ap.add_argument("--salt", default="metatake-v1")
    ap.add_argument("--models", default="haiku,sonnet")
    ap.add_argument("--arch", type=int, default=8)
    ap.add_argument("--theme", type=int, default=6)
    ap.add_argument("--max-tokens", type=int, default=400)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    out = a.out or os.path.join(ROOT, "Element", f"catalog-map-DRY-{a.kind}.md")

    miss = [n for n, v in [("NEXT_PUBLIC_SUPABASE_URL", URL), ("SUPABASE_SERVICE_ROLE_KEY", KEY),
                           ("ANTHROPIC_API_KEY", ANTH)] if not v]
    if miss: raise SystemExit("Missing env in .env.local: " + ", ".join(miss))
    mkeys = [m.strip() for m in a.models.split(",") if m.strip() in MODELS]
    if not mkeys: raise SystemExit("no valid --models")

    sp = KIND_SPEC[a.kind]
    print(f"▶ loading tier lists + sample ({a.kind}, n={a.n}) …")
    tierdata = {nk: sort_nodes(sb_get(f"taxonomy_nodes?kind=eq.{nk}&select=code,label"))
                for _, nk, _, _ in sp["tiers"]}
    prefix = build_prefix(a.kind, tierdata)
    sample = sb_rpc("catalog_dry_sample", {"p_kind": a.kind, "p_n": a.n, "p_salt": a.salt})
    tiersz = " + ".join(f"{len(v)} {k}" for k, v in tierdata.items())
    print(f"  tiers: {tiersz} · {len(sample)} figures · models: {', '.join(mkeys)}")

    rows, tot, steady = [], {mk: {"in":0,"out":0,"cw":0,"cr":0} for mk in mkeys}, {mk: [] for mk in mkeys}
    for i, fig in enumerate(sample, 1):
        cands = sb_rpc("catalog_candidates", {"p_figure_id": fig["id"], "p_n_arch": a.arch,
                                              "p_n_theme": a.theme, "p_arch_kind": sp["arch_kind"]})
        user = build_user(a.kind, fig, cands)
        res = {}
        for mk in mkeys:
            r, u = call_model(mk, prefix, user, a.max_tokens)
            res[mk] = r
            for k in tot[mk]: tot[mk][k] += u[k]
            if u["cr"] > 0: steady[mk].append(u)
        rows.append((fig, cands, res))
        flag = "  ★" if (len(mkeys) == 2 and diverged(res[mkeys[0]], res[mkeys[1]])) else ""
        print(f"  [{i:>2}/{len(sample)}] {fig['label'][:50]:50}{flag}")
        time.sleep(0.12)

    n = len(sample)
    L = ["# Catalog mapping — DRY comparison", "",
         f"Sample: **{n}** `{a.kind}` figures · candidates {a.arch} archetypes + {a.theme} themes · "
         f"models {', '.join(MODELS[mk]['id'] for mk in mkeys)}", "",
         "## Cost (measured on this sample, real-time)", "",
         "| Model | uncached in | cache write | cache read | output | sample $ | $/figure |",
         "|---|--:|--:|--:|--:|--:|--:|"]
    perfig = {}
    for mk in mkeys:
        m = MODELS[mk]; t = tot[mk]; c = cost(t, m)
        ss = steady[mk] or [{"in": t["in"]//max(n,1), "out": t["out"]//max(n,1), "cr": t["cr"]//max(n,1)}]
        ai = sum(x["in"] for x in ss)/len(ss); ao = sum(x["out"] for x in ss)/len(ss); acr = sum(x["cr"] for x in ss)/len(ss)
        pf = (ai*m["in"] + ao*m["out"] + acr*m["cr"]) / 1e6; perfig[mk] = pf
        L.append(f"| {m['id']} | {t['in']:,} | {t['cw']:,} | {t['cr']:,} | {t['out']:,} | ${c:.4f} | ${pf:.5f} |")
    L += ["", "_$/figure = steady-state (cached prefix + variable input + output), the cost that scales._", "",
          "## Full-run projection (steady-state $/figure × population)", "",
          "Batch API = 50% off. Caching already folded into $/figure.", "",
          "| Scope | figures | " + " | ".join(f"{mk} real-time" for mk in mkeys) +
          " | " + " | ".join(f"{mk} batch" for mk in mkeys) + " |",
          "|---|--:|" + "--:|"*(2*len(mkeys))]
    scopes = [("Objects", SCOPE["object"]), ("Characters", SCOPE["character"]),
              ("Locations", SCOPE["location"]),
              ("Objects+Characters+Locations", SCOPE["object"]+SCOPE["character"]+SCOPE["location"]),
              ("+ Film themes", SCOPE["object"]+SCOPE["character"]+SCOPE["location"]+SCOPE["film"]),
              ("Everything (all kinds)", sum(SCOPE.values()))]
    for name, cnt in scopes:
        rt = [f"${perfig[mk]*cnt:.2f}" for mk in mkeys]; bt = [f"${perfig[mk]*cnt*0.5:.2f}" for mk in mkeys]
        L.append(f"| {name} | {cnt:,} | " + " | ".join(rt) + " | " + " | ".join(bt) + " |")
    L.append("")

    ndiv = sum(1 for _, _, r in rows if len(mkeys) == 2 and diverged(r[mkeys[0]], r[mkeys[1]]))
    L += [f"## Results — {ndiv}/{n} divergent (★)" if len(mkeys) == 2 else "## Results", ""]
    for fig, cands, res in rows:
        arch = [c for c in cands if c["bucket"] == "archetype"][:5]
        them = [c for c in cands if c["bucket"] == "theme"][:4]
        star = " ★" if (len(mkeys) == 2 and diverged(res[mkeys[0]], res[mkeys[1]])) else ""
        meta = " · ".join(x for x in [fig.get("film"), str(fig.get("year") or "")] if x)
        L += [f"### {fig['label']}{star}", f"*{meta}*  ", ""]
        d = (fig.get("description") or "").strip()
        if d: L.append(f"> {d[:240]}{'…' if len(d)>240 else ''}\n")
        L.append("kNN archetypes — " + (", ".join(f"{c['label']}({c['sim']:.2f})" for c in arch) or "—"))
        L.append("  · themes — " + (", ".join(f"{c['label']}({c['sim']:.2f})" for c in them) or "—") + "\n")
        L.append("| " + " | ".join(MODELS[mk]["id"].replace("claude-","") for mk in mkeys) + " |")
        L.append("|" + "---|"*len(mkeys))
        L.append("| " + " | ".join(cell(a.kind, res[mk]) for mk in mkeys) + " |")
        L.append("")

    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write("\n".join(L))
    print("\n" + "="*64)
    for mk in mkeys:
        print(f"  {MODELS[mk]['id']:24}  sample ${cost(tot[mk],MODELS[mk]):.4f}   ${perfig[mk]:.5f}/figure")
    if len(mkeys) == 2: print(f"  divergent: {ndiv}/{n}")
    print(f"  → {out}\n" + "="*64)

if __name__ == "__main__":
    main()
