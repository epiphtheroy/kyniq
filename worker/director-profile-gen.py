#!/usr/bin/env python3
"""director-profile-gen — Portrait + Who's Next for a director (batch group 1, Opus).

One Opus call per director produces BOTH:
  • Portrait — a ≤200-word Sight & Sound-editor introduction: birth year + country, the director's
    single most unique aesthetic signature, its place/meaning in film lineage (and why), and a
    "why now" note. Hot, journalistic, specific.
  • Who's Next — exactly 5 real directors to explore next; each reason is ONE sentence that names
    BOTH this director and the recommended director by name, and states a specific kinship/contrast
    (lineage, aesthetic, method) — not vague vibes.

Grounded in the director's filmography (from our DB) + TMDB bio. DRY pilot → review → full via Batch.

Usage:
  python3 director-profile-gen.py                          # DRY pilot → director-profile-dry.md/.json
  python3 director-profile-gen.py --dirs bong-joon-ho,park-chan-wook --out director-profile-dry
  python3 director-profile-gen.py --emit-requests --all --min-films 3 --out director-profile-all
Then: python3 next-batch.py submit --out director-profile-all   (generic batch runner)
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
OUT = args[args.index("--out") + 1] if "--out" in args else "director-profile-dry"
ALL = "--all" in args; EMIT = "--emit-requests" in args
MIN_FILMS = int(args[args.index("--min-films") + 1]) if "--min-films" in args else 3
DIRS_ARG = (args[args.index("--dirs") + 1].split(",")) if "--dirs" in args else None
N_NEXT = 5
MAXTOK = 2200
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
 "You are the editor of Sight & Sound introducing a film director to serious readers. You write TWO things, "
 "grounded ONLY in verifiable fact (never invent films, dates, or collaborators).\n\n"
 "1) PORTRAIT — at most 200 words, hot and specific, in this exact arc: (a) open with birth year + country; "
 "(b) name the SINGLE most unique thing about this director's aesthetic — the signature no one else has, in concrete "
 "terms (a formal habit, a recurring obsession, a way of using space/time/sound), not generic praise; (c) place it in "
 "FILM-HISTORICAL lineage — what tradition it extends or breaks, and why that matters; (d) close by letting the work's "
 "present-day charge surface naturally — why it still cuts today — woven INTO the prose. CRITICAL: never use the literal "
 "words \"why now\" (or \"Why now:\") anywhere, and use no section labels; express that idea in ordinary language. "
 "Journalistic, declarative, no hedging, no list — flowing prose.\n\n"
 "2) WHO'S NEXT — exactly 5 real, verifiable directors a viewer should explore after this one. For EACH, write ONE "
 "sentence (<=30 words) that (i) names BOTH this director and the recommended director by surname, and (ii) states a "
 "SPECIFIC kinship or productive contrast — shared lineage, a formal echo, a thematic obsession, or an instructive "
 "opposition. No vague 'both are great' reasons. Do not recommend the director themselves; avoid trivial 'same country' "
 "links unless the bond is real. Recommend ONLY real people with an established FEATURE-FILM DIRECTING career — never "
 "someone known primarily as a cinematographer, composer, writer, or actor, and never this director's own key "
 "collaborator (their regular DP or composer) unless that person is themselves an established director. "
 "Favour SURPRISING-BUT-APT choices — the pleasure is recognition, not predictability: the reader should think "
 "'I wouldn't have guessed that, but yes.' Do NOT reflexively reach for the most over-cited canonical names "
 "(avoid Hitchcock, Kubrick, Spielberg, Scorsese and the like) unless the kinship is singular and precise rather than "
 "generic mastery; include AT MOST ONE universally famous name, and make the other four genuinely less-expected "
 "directors — span different eras, countries, and modes (world cinema, documentary, the avant-garde, the overlooked). "
 "Never pick a director merely because they are famous.\n\n"
 'Output ONLY JSON: {"portrait":"...","next":[{"name":"Full Name","reason":"..."}]} with exactly 5 next items.'
)

def build_user(ctx):
    films = "; ".join(f"{f['title']} ({f['year'] or '?'})" for f in ctx["films"][:30])
    born = []
    if ctx.get("year"): born.append(str(ctx["year"]))
    if ctx.get("place"): born.append(ctx["place"])
    bornline = ", ".join(born) if born else "—"
    bio = (ctx.get("bio") or "").strip()
    if len(bio) > 900: bio = bio[:900] + "…"
    return (
        f"DIRECTOR: {ctx['name']}\n"
        f"Born: {bornline}\n"
        f"Filmography on record ({len(ctx['films'])} films): {films}\n"
        f"Reference bio (TMDB/Wikipedia, may be incomplete): {bio or '—'}\n\n"
        f"Write the Portrait (<=200 words) and exactly {N_NEXT} Who's-Next directors per the system spec. "
        f"Every Who's-Next reason MUST mention both {ctx['name']} and the recommended director by name."
    )

def context(slug):
    drow = sb(f"directors?slug=eq.{urllib.parse.quote(slug)}&select=name,bio,birthday,place_of_birth")
    films = sb(f"films?director_slug=eq.{urllib.parse.quote(slug)}&visible=eq.true&select=title,year,slug&order=year")
    if not films: return None
    name = (drow[0]["name"] if drow else None) or films[0].get("title") and slug.replace("-", " ").title()
    d = drow[0] if drow else {}
    year = None
    if d.get("birthday"):
        m = re.match(r"(\d{4})", str(d["birthday"]))
        if m: year = int(m.group(1))
    return {"slug": slug, "name": (d.get("name") or slug.replace("-", " ").title()),
            "bio": d.get("bio"), "year": year, "place": d.get("place_of_birth"), "films": films}

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
    todo = [s for s in all_directors() if s not in done]
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
    print(f"✅ wrote {n} requests → {OUT}.requests.jsonl\n   submit: python3 next-batch.py submit --out {OUT}")

def dry():
    slugs = DIRS_ARG or PILOT
    md = [f"# Director Portrait + Who's Next — DRY ({len(slugs)})\n"]
    out = []; tin = tout = 0
    for slug in slugs:
        try: ctx = context(slug)
        except Exception as e: print(f"  ! {slug}: {e}"); continue
        if not ctx: print(f"  ! {slug}: no films/director"); continue
        text, (i, o) = call_llm(SYS, build_user(ctx)); tin += i; tout += o
        try: data = parse_json(text)
        except Exception as e: print(f"  ! {slug}: parse {e}"); continue
        out.append({"slug": slug, "portrait": data.get("portrait", ""), "next": data.get("next", [])})
        md.append(f"## {ctx['name']}  ·  {ctx.get('year') or '?'} · {len(ctx['films'])} films")
        md.append(f"\n**Portrait** ({len((data.get('portrait') or '').split())} words)\n\n{data.get('portrait','')}\n")
        md.append("**Who's Next**")
        for k, r in enumerate(data.get("next", []), 1):
            md.append(f"{k}. **{r.get('name')}** — {r.get('reason')}")
        md.append("")
        print(f"  ✓ {slug}: portrait {len((data.get('portrait') or '').split())}w · next {len(data.get('next',[]))}")
    open(f"{OUT}.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=2))
    open(f"{OUT}.md", "w", encoding="utf-8").write("\n".join(md))
    cost = tin / 1e6 * PRICE_IN + tout / 1e6 * PRICE_OUT
    full = cost / max(1, len(out)) * 208  # ~208 directors with >=3 films
    print(f"\nDRY {len(out)} · in {tin} out {tout} · ${cost:.3f}")
    print(f"→ extrapolated (~208 dirs >=3 films, sync): ${full:.2f} · via Batch ≈ ${full*0.5:.2f}")
    print(f"→ {OUT}.md / {OUT}.json")

if __name__ == "__main__":
    if EMIT: emit_requests()
    else: dry()
