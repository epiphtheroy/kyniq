#!/usr/bin/env python3
"""director-picks-gen — "Where to Start": a curated viewing itinerary through a director's filmography.

One Opus call per director selects an ORDERED route through the films WE HAVE ON RECORD (so every pick
links to a real /film page). Each pick is one film from the provided list (slug copied verbatim) plus:
  • label  — a short itinerary tag ("Start here", "The peak", "Deep cut", "If you want more", ...)
  • reason — 1-2 sentences naming the film and saying SPECIFICALLY why it belongs at this point in the
             route (what it does, who it's for) — never generic praise.

Picks are capped at min(10, #films). Small filmographies still get Start/Peak/Deep-cut coverage.
Grounded ONLY in the director's DB filmography. DRY pilot → review → full via Batch.

Usage:
  python3 director-picks-gen.py                          # DRY pilot → director-picks-dry.md/.json
  python3 director-picks-gen.py --dirs bong-joon-ho,christopher-nolan --out director-picks-dry
  python3 director-picks-gen.py --emit-requests --all --min-films 3 --out worker/director-picks-all
Then: python3 director-picks-batch.py submit --out worker/director-picks-all
"""
import os, sys, json, re, time, urllib.request, urllib.error, urllib.parse
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
ANT = os.environ.get("ANTHROPIC_API_KEY")
args = sys.argv[1:]
MODEL = args[args.index("--model") + 1] if "--model" in args else "claude-opus-4-8"
OUT = args[args.index("--out") + 1] if "--out" in args else "director-picks-dry"
ALL = "--all" in args; EMIT = "--emit-requests" in args
MIN_FILMS = int(args[args.index("--min-films") + 1]) if "--min-films" in args else 3
DIRS_ARG = (args[args.index("--dirs") + 1].split(",")) if "--dirs" in args else None
MAX_PICKS = 10
MAXTOK = 2000
PRICE_IN, PRICE_OUT = 15.0, 75.0          # Opus USD / 1M (batch = 50%)
if not (URL and KEY and ANT): sys.exit("Missing env (SUPABASE URL/SERVICE_ROLE + ANTHROPIC_API_KEY)")

PILOT = ["bong-joon-ho", "park-chan-wook", "wong-kar-wai", "christopher-nolan", "hayao-miyazaki", "david-fincher"]

def http(method, url, headers=None, body=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data); req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:600]
def sb(path):
    st, tx = http("GET", f"{URL}/rest/v1/{path}", {"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    if st != 200: raise RuntimeError(f"sb {st}: {tx[:160]}")
    return json.loads(tx)
def call_llm(system, user, max_tokens=MAXTOK):
    body = {"model": MODEL, "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": user}]}
    for a in range(6):
        st, tx = http("POST", "https://api.anthropic.com/v1/messages",
                      {"x-api-key": ANT, "anthropic-version": "2023-06-01"}, body)
        if st == 200:
            o = json.loads(tx)
            text = "".join(p.get("text", "") for p in o.get("content", []) if p.get("type") == "text")
            u = o.get("usage", {}); return text, (u.get("input_tokens", 0), u.get("output_tokens", 0))
        if st in (429, 500, 502, 503, 520, 529) and a < 5: time.sleep(min(60, 5 * (a + 1))); continue
        raise RuntimeError(f"llm {st}: {tx[:200]}")
def parse_json(s):
    s = s.strip()
    if s.startswith("```"): s = re.sub(r"^```[a-z]*\n?", "", s); s = re.sub(r"\n?```$", "", s)
    start = s.find("{")
    if start < 0: return json.loads(s)
    depth = 0; instr = False; esc = False
    for k in range(start, len(s)):
        ch = s[k]
        if instr:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': instr = False
        elif ch == '"': instr = True
        elif ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: return json.loads(s[start:k + 1])
    return json.loads(s[start:])

SYS = (
 "You are a programmer for a repertory cinema designing a 'Where to Start' route through a film director's work — "
 "an itinerary a curious newcomer can follow from first film to last. You choose ONLY from the films explicitly "
 "listed for you (never invent or add a title), and you copy each chosen film's slug VERBATIM from the list.\n\n"
 "Choose an ORDERED route of picks (the order is the suggested viewing order, not chronology). Always cover, at "
 "minimum, three roles when the filmography allows: (a) a START HERE — the most welcoming, representative way in; "
 "(b) THE PEAK — the artistic summit, the one that shows why this director matters; (c) a DEEP CUT — the lesser-known "
 "reward for someone who's now hooked. For richer filmographies add more stops (e.g. 'If you loved that', 'The turn', "
 "'The wild card', 'Where it began') so the route has shape. Pick between 3 and " + str(MAX_PICKS) + " films total; if "
 "the director has fewer films than that, use what exists. Never repeat a film.\n\n"
 "For EACH pick write: a LABEL (<=4 words, the role it plays in the route) and a REASON (1-2 sentences, <=40 words) "
 "that names the film and says SPECIFICALLY why it sits here — what it does, what it reveals, who it's for. Concrete, "
 "declarative, no generic 'a masterpiece' praise, no spoilers of endings. Curate by craft and discovery, never by box "
 "office.\n\n"
 'Output ONLY JSON: {"picks":[{"slug":"<verbatim slug>","label":"...","reason":"..."}]} ordered as the route.'
)

def build_user(ctx):
    lines = "\n".join(f"  {f['slug']} | {f['title']} ({f['year'] or '?'})" for f in ctx["films"])
    n = min(MAX_PICKS, len(ctx["films"]))
    return (
        f"DIRECTOR: {ctx['name']}\n"
        f"Films on record ({len(ctx['films'])}) — choose ONLY from these, copy the slug exactly:\n{lines}\n\n"
        f"Design the Where-to-Start route: pick up to {n} films (at least Start here / The peak / Deep cut when "
        f"possible), ordered as a viewing itinerary. Every reason must name the film and be specific to it."
    )

def context(slug):
    drow = sb(f"directors?slug=eq.{urllib.parse.quote(slug)}&select=name")
    films = sb(f"films?director_slug=eq.{urllib.parse.quote(slug)}&visible=eq.true&select=title,year,slug&order=year")
    if not films: return None
    d = drow[0] if drow else {}
    return {"slug": slug, "name": (d.get("name") or slug.replace("-", " ").title()), "films": films}

def all_directors():
    films, off, page = [], 0, 1000
    while True:
        b = sb(f"films?select=director_slug,visible&order=director_slug&limit={page}&offset={off}")
        films += b
        if len(b) < page: break
        off += page
    cnt = defaultdict(int)
    for f in films:
        if f.get("director_slug") and f.get("visible"): cnt[f["director_slug"]] += 1
    return sorted([s for s, n in cnt.items() if n >= MIN_FILMS])

def emit_requests():
    done = set(); full = f"{OUT}.jsonl"
    if os.path.exists(full):
        for l in open(full, encoding="utf-8"):
            try: done.add(json.loads(l).get("slug"))
            except Exception: pass
    todo = [s for s in (DIRS_ARG or all_directors()) if s not in done]  # §7.13: honor --dirs scope (unscoped = corpus-wide mis-fire)
    print(f"[emit] directors >= {MIN_FILMS} films: {len(todo)+len(done)} · done {len(done)} · to request {len(todo)}")
    n = 0
    with open(f"{OUT}.requests.jsonl", "w", encoding="utf-8") as w:
        for slug in todo:
            try: ctx = context(slug)
            except Exception as e: print(f"  ! {slug}: {e}"); continue
            if not ctx: continue
            params = {"model": MODEL, "max_tokens": MAXTOK, "system": SYS,
                      "messages": [{"role": "user", "content": build_user(ctx)}]}
            w.write(json.dumps({"custom_id": slug, "params": params}, ensure_ascii=False) + "\n")
            n += 1
            if n % 100 == 0: print(f"  built {n}")
    print(f"✅ wrote {n} requests → {OUT}.requests.jsonl\n   submit: python3 director-picks-batch.py submit --out {OUT}")

def dry():
    slugs = DIRS_ARG or PILOT
    print(f"[director-picks] model={MODEL} · Where to Start (<= {MAX_PICKS} picks, DB filmography only)")
    md = [f"# Where to Start — DRY ({len(slugs)}) · {MODEL}\n"]
    out = []; tin = tout = 0
    for slug in slugs:
        try: ctx = context(slug)
        except Exception as e: print(f"  ! {slug}: {e}"); continue
        if not ctx: print(f"  ! {slug}: no films/director"); continue
        valid = {f["slug"]: f for f in ctx["films"]}
        text, (i, o) = call_llm(SYS, build_user(ctx)); tin += i; tout += o
        try: data = parse_json(text)
        except Exception as e: print(f"  ! {slug}: parse {e}"); continue
        picks = []
        for p in data.get("picks", []):
            fs = (p.get("slug") or "").strip()
            if fs not in valid:  # hallucinated/garbled slug → drop
                print(f"    · {slug}: dropped non-DB slug «{fs}»"); continue
            f = valid[fs]
            picks.append({"film_slug": fs, "film_title": f["title"], "film_year": f["year"],
                          "label": (p.get("label") or "").strip(), "reason": (p.get("reason") or "").strip()})
        out.append({"slug": slug, "picks": picks})
        md.append(f"## {ctx['name']}  ·  {len(picks)}/{len(ctx['films'])} films routed")
        for k, p in enumerate(picks, 1):
            md.append(f"{k}. **{p['label']}** — *{p['film_title']}* ({p['film_year'] or '?'})\n   {p['reason']}")
        md.append("")
        print(f"  ✓ {slug}: {len(picks)} picks from {len(ctx['films'])} films")
    open(f"{OUT}.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=2))
    open(f"{OUT}.md", "w", encoding="utf-8").write("\n".join(md))
    cost = tin / 1e6 * PRICE_IN + tout / 1e6 * PRICE_OUT
    full = cost / max(1, len(out)) * 208
    print(f"\nDRY {len(out)} · in {tin} out {tout} · ${cost:.3f}")
    print(f"→ extrapolated (~208 dirs >=3 films, sync): ${full:.2f} · via Batch ≈ ${full*0.5:.2f}")
    print(f"→ {OUT}.md / {OUT}.json")

if __name__ == "__main__":
    if EMIT: emit_requests()
    else: dry()
