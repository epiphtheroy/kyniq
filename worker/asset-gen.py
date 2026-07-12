#!/usr/bin/env python3
"""asset-gen — "Why watch" spoiler-free dossier. Per film, a curator writes what intellectual/
aesthetic ASSETS the film offers across 7 fixed lenses (2 points each), for a viewer who has NOT
seen it. Grounded in verified DB/TMDB facts to curb hallucination. Opus 4.8 + prompt caching.

Usage:
  python3 asset-gen.py                                  # DRY: 8-film pilot → asset-dry.md / .json
  python3 asset-gen.py --films a,b,c --out asset-dry
  python3 asset-gen.py --emit-requests --all --out asset-all   # FULL → asset-all.requests.jsonl
Then submit/fetch with asset-batch.py.
"""
import os, sys, json, re, time, urllib.request, urllib.error

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
OUT = args[args.index("--out") + 1] if "--out" in args else "asset-dry"
EMIT = "--emit-requests" in args; ALL = "--all" in args
FILMS_ARG = (args[args.index("--films") + 1].split(",")) if "--films" in args else None
MAXTOK = 2200
PRICE_IN, PRICE_OUT = 15.0, 75.0          # Opus 4.8 USD / 1M (batch = 50%)
if not (URL and KEY and ANT): sys.exit("Missing env")

PILOT = ["black-swan-2010", "drive-my-car-2021", "parasite-2019", "mad-max-fury-road-2015",
         "spirited-away-2001", "no-country-for-old-men-2007", "in-the-mood-for-love-2000", "the-terminator"]

LENSES = [
    ("auteur_vision", "AUTEUR_VISION — filmography coordinates and the director's vision: the filmmaker's project and where this film sits in their oeuvre and lineage."),
    ("aesthetic_innovation", "AESTHETIC_INNOVATION — style and aesthetic innovation: the distinctive visual language and what is formally new."),
    ("technical_mastery", "TECHNICAL_MASTERY — technical achievement in cinematography, editing, and sound/music (use the provided crew names)."),
    ("philosophical_inquiry", "PHILOSOPHICAL_INQUIRY — the central philosophical/thematic questions the film opens."),
    ("cinematic_lineage", "CINEMATIC_LINEAGE — the film's place in film history: what it draws on and what it shaped."),
    ("spatial_aesthetics", "SPATIAL_AESTHETICS — how location, landscape, architecture and spatial form carry meaning."),
    ("critical_reception", "CRITICAL_RECEPTION — objective standing and award record: festival selections, prizes, and canonical rankings."),
    ("context_discourse", "CONTEXT_&_DISCOURSE — the production/historical/cultural context and the critical conversation it provoked."),
]
LENS_KEYS = [k for k, _ in LENSES]

SYS = (
 "You are FilmCurio / Metatake's curator. Write a SPOILER-FREE \"Why watch\" dossier for a viewer who has "
 "NOT seen the film: convey the intellectual and aesthetic ASSETS it offers — what a viewer will GAIN — so a "
 "hesitant cinephile is persuaded to seek it out. Use these 7 fixed lenses, in this exact order and with these keys:\n"
 + "".join(f"{i+1}. {k} — {d}\n" for i, (k, d) in enumerate(LENSES)) +
 "\nFORMAT — each lens has EXACTLY 2 points; each point is an object with:\n"
 "  • label: a punchy ≤5-word teaser headline naming THIS point's specific message. Word it freshly for each film "
 "from the actual content of the text; do NOT reuse stock or template phrases across films.\n"
 "  • text: 1–2 sentences (~30–55 words) unpacking it — third person, fact-dense, concrete, authoritative, never generic.\n"
 "\nRULES:\n"
 "- ABSOLUTELY SPOILER-FREE: no plot points, arcs, twists, or endings. Speak only to craft, ideas, form, context, standing.\n"
 "- FACTS: verified facts about THIS film (director, year, genres, cast, writers, and KEY CREW — cinematographer, "
 "composer, editor) are provided in the user message; USE them and never contradict them.\n"
 "- CRITICAL_RECEPTION: you MAY cite specific awards, festival selections, and critics'-poll rankings (e.g., Academy "
 "Awards, Cannes/Venice/Berlin top prizes, the BFI Sight & Sound poll) — but ONLY when you are highly confident they "
 "are accurate. If unsure of a specific award, year, or ranking number, describe the film's critical standing "
 "qualitatively WITHOUT inventing a specific. Never fabricate an award, festival, place, name, or number.\n"
 "- For any other specific not provided, include it ONLY if certain; otherwise omit it. Never fabricate.\n"
 "- Be erudite and specific to THIS film, not to its genre in general.\n"
 "- JSON SAFETY: inside string values NEVER use the double-quote character; for any quoted title or term use single "
 "quotes ' ' (e.g., 'Transcendental Style'). Output must be strictly valid JSON.\n"
 "Output ONLY JSON: {\"lenses\":[{\"key\":\"auteur_vision\",\"points\":[{\"label\":\"\",\"text\":\"\"},"
 "{\"label\":\"\",\"text\":\"\"}]}, ... all 7 keys in the given order]}"
)
SYS_BLOCKS = [{"type": "text", "text": SYS, "cache_control": {"type": "ephemeral"}}]

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
def rpc(name, body=None):
    st, tx = http("POST", f"{URL}/rest/v1/rpc/{name}", {"apikey": KEY, "Authorization": f"Bearer {KEY}"}, body or {})
    if st >= 300: raise RuntimeError(f"rpc {name} {st}: {tx[:160]}")
    return json.loads(tx) if tx.strip() else None
def call_llm(system_blocks, user, max_tokens=MAXTOK):
    body = {"model": MODEL, "max_tokens": max_tokens, "system": system_blocks,
            "messages": [{"role": "user", "content": user}]}
    for a in range(6):
        st, tx = http("POST", "https://api.anthropic.com/v1/messages",
                      {"x-api-key": ANT, "anthropic-version": "2023-06-01"}, body)
        if st == 200:
            o = json.loads(tx)
            text = "".join(p.get("text", "") for p in o.get("content", []) if p.get("type") == "text")
            u = o.get("usage", {})
            return text, u
        if st in (429, 500, 502, 503, 520, 529) and a < 5: time.sleep(min(60, 5 * (a + 1))); continue
        raise RuntimeError(f"llm {st}: {tx[:200]}")
TMDB = os.environ.get("TMDB_READ_TOKEN")
def tmdb_crew(tid):
    """Verified key crew from TMDB to anchor TECHNICAL_MASTERY (no fabrication)."""
    if not (TMDB and tid): return {}
    if len(TMDB) > 40:                              # v4 read access token → Bearer
        u = f"https://api.themoviedb.org/3/movie/{tid}/credits"
        hdr = {"Authorization": f"Bearer {TMDB}", "accept": "application/json"}
    else:                                           # v3 api key → query param
        u = f"https://api.themoviedb.org/3/movie/{tid}/credits?api_key={TMDB}"
        hdr = {"accept": "application/json"}
    st, tx = http("GET", u, hdr)
    if st != 200: return {}
    crew = (json.loads(tx).get("crew") or [])
    def pick(jobs):
        return next((c.get("name") for c in crew if c.get("job") in jobs), None)
    return {k: v for k, v in {
        "cinematographer": pick(["Director of Photography", "Cinematography"]),
        "composer": pick(["Original Music Composer", "Music", "Composer"]),
        "editor": pick(["Editor"]),
    }.items() if v}

def with_crew(ctx):
    if ctx and ctx.get("tmdb_id"):
        ctx["crew"] = tmdb_crew(ctx["tmdb_id"])
    return ctx

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

def build_user(c):
    def lst(x, n=99):
        return ", ".join(str(i) for i in (x or [])[:n]) if isinstance(x, list) else (str(x) if x else "—")
    cast = c.get("cast") or []
    cast_s = ", ".join(f"{p.get('name')}" for p in cast[:6]) if cast else "—"
    ov = (c.get("overview") or "").strip()
    if len(ov) > 700: ov = ov[:700] + "…"
    rt = f"{c.get('runtime')} min" if c.get("runtime") else "—"
    crew = c.get("crew") or {}
    crew_bits = [f"Cinematographer {crew['cinematographer']}" if crew.get("cinematographer") else "",
                 f"Composer {crew['composer']}" if crew.get("composer") else "",
                 f"Editor {crew['editor']}" if crew.get("editor") else ""]
    crew_s = " · ".join(b for b in crew_bits if b) or "—"
    return (
        "VERIFIED FACTS (use these; do not contradict):\n"
        f"- Title: {c.get('title')}" + (f" (original: {c.get('original_title')})" if c.get('original_title') and c.get('original_title') != c.get('title') else "") + "\n"
        f"- Year: {c.get('year') or '?'} · Director: {c.get('director') or '?'} · Runtime: {rt}\n"
        f"- Genres: {lst(c.get('genres'))} · Country: {lst(c.get('country'))} · Language: {c.get('original_language') or '—'}\n"
        f"- Writers: {lst(c.get('writers'), 4)}\n"
        f"- Key crew (verified, TMDB): {crew_s}\n"
        f"- Principal cast: {cast_s}\n"
        + (f"- Series/collection: {c.get('collection')}\n" if c.get('collection') else "")
        + f"- Synopsis (may inform, but stay SPOILER-FREE): {ov or '—'}\n"
        f"- Metatake tropes/themes: {lst(c.get('tropes'))}\n"
        f"- Key figures: {lst(c.get('figures'))}\n\n"
        "Write the spoiler-free 7-lens 'Why watch' dossier as JSON (each lens: 2 points; each point = {label, text}; all 7 keys in order)."
    )

def context_for(slug):
    rows = sb(f"films?slug=eq.{urllib.parse.quote(slug)}&select=id,title,year")
    if not rows: return None, None
    fid = rows[0]["id"]
    return fid, with_crew(rpc("film_asset_context", {"p_film_id": fid}) or {})

import urllib.parse

def all_films():
    films, off = [], 0
    while True:
        b = sb(f"films?select=id,slug&order=id&limit=1000&offset={off}")
        films += b
        if len(b) < 1000: break
        off += 1000
    return [f for f in films if f.get("slug")]

def emit_requests():
    done = set(); full = f"{OUT}.jsonl"
    if os.path.exists(full):
        for l in open(full, encoding="utf-8"):
            try: done.add(json.loads(l).get("slug"))
            except Exception: pass
    films = all_films(); todo = [f for f in films if f["slug"] not in done and (not FILMS_ARG or f["slug"] in FILMS_ARG)]  # §7.13: honor --films
    print(f"[emit] {len(films)} films · {len(done)} done · {len(todo)} to request")
    n = 0
    with open(f"{OUT}.requests.jsonl", "w", encoding="utf-8") as w:
        for f in todo:
            ctx = with_crew(rpc("film_asset_context", {"p_film_id": f["id"]}) or {})
            if not ctx.get("title"): continue
            params = {"model": MODEL, "max_tokens": MAXTOK, "system": SYS_BLOCKS,
                      "messages": [{"role": "user", "content": build_user(ctx)}]}
            w.write(json.dumps({"custom_id": f["slug"], "params": params}, ensure_ascii=False) + "\n")
            n += 1
            if n % 200 == 0: print(f"  built {n}")
    print(f"✅ wrote {n} requests → {OUT}.requests.jsonl\n   submit: python3 asset-batch.py submit --out {OUT}")

LENS_TITLE = {k: k.upper().replace("CONTEXT_DISCOURSE", "CONTEXT_&_DISCOURSE") for k in LENS_KEYS}

def dry():
    slugs = FILMS_ARG or PILOT
    md = [f"# Why watch — DRY ({len(slugs)} films)\n"]
    out = []; tin = tout = tcache = 0
    for slug in slugs:
        try: fid, ctx = context_for(slug)
        except Exception as e: print(f"  ! {slug}: {e}"); continue
        if not fid or not ctx.get("title"): print(f"  ! {slug}: no context"); continue
        text, u = call_llm(SYS_BLOCKS, build_user(ctx))
        tin += u.get("input_tokens", 0); tout += u.get("output_tokens", 0)
        tcache += u.get("cache_read_input_tokens", 0)
        try: lenses = parse_json(text).get("lenses", [])
        except Exception as e: print(f"  ! {slug}: parse {e}"); continue
        out.append({"slug": slug, "lenses": lenses})
        md.append(f"## {ctx['title']} ({ctx.get('year') or '?'})")
        for L in lenses:
            md.append(f"### {LENS_TITLE.get(L.get('key'), L.get('key'))}")
            for p in L.get("points", []):
                if isinstance(p, dict): md.append(f"- **{p.get('label', '')}** — {p.get('text', '')}")
                else: md.append(f"- {p}")
        md.append("")
        print(f"  ✓ {slug}: {len(lenses)} lenses")
    open(f"{OUT}.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=2))
    open(f"{OUT}.md", "w", encoding="utf-8").write("\n".join(md))
    cost = tin / 1e6 * PRICE_IN + tout / 1e6 * PRICE_OUT
    full = cost / max(1, len(out)) * 1957
    print(f"\nDRY {len(out)} films · in {tin} (cache-read {tcache}) out {tout} · ${cost:.3f}")
    print(f"→ full ~1957 sync ≈ ${full:.0f} · via Batch ≈ ${full*0.5:.0f} (caching may reduce input further)")
    print(f"→ {OUT}.md / {OUT}.json")

if __name__ == "__main__":
    if EMIT: emit_requests()
    else: dry()
