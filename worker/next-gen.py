#!/usr/bin/env python3
"""next-gen — "Watch next" recommendations. Per film, a cinephile curator proposes 9 real
films to watch after it, each with a ≤25-word reason naming the bridge. Grounded in Metatake
context (tropes, strong-misreading titles, figures). Sonnet via Messages (DRY) or Batch (full).

Usage:
  python3 next-gen.py                                   # DRY: 8-film pilot → next-dry.md / .json
  python3 next-gen.py --films a,b,c --out next-dry      # DRY on specific slugs
  python3 next-gen.py --emit-requests --all --out next-all   # FULL: → next-all.requests.jsonl
                                                              # (skips slugs already in next-all.jsonl)
Then submit/fetch with next-batch.py.
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
MODEL = args[args.index("--model") + 1] if "--model" in args else "claude-sonnet-4-6"
OUT = args[args.index("--out") + 1] if "--out" in args else "next-dry"
ALL = "--all" in args; EMIT = "--emit-requests" in args
FILMS_ARG = (args[args.index("--films") + 1].split(",")) if "--films" in args else None
N_RECS = 9
MAXTOK = 1600
PRICE_IN, PRICE_OUT = 3.0, 15.0           # Sonnet 4.6 USD / 1M (batch = 50%)
if not (URL and KEY and ANT): sys.exit("Missing env (SUPABASE URL/SERVICE_ROLE + ANTHROPIC_API_KEY)")

PILOT = ["black-swan-2010", "drive-my-car-2021", "parasite-2019", "mad-max-fury-road-2015",
         "spirited-away-2001", "no-country-for-old-men-2007", "in-the-mood-for-love-2000", "the-terminator"]

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
    depth = 0; instr = False; esc = False           # 첫 완결 JSON 객체만 추출(뒤 여분 텍스트 무시)
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
 "You are FilmCurio / Metatake's cinephile curator. A viewer has just finished a film and asks what to "
 "watch NEXT — films that continue THIS film's conversation. You recommend exactly 9 real, verifiable films "
 "(exact title, release year, director). Favour bridges of substance — a thematic echo, a formal/aesthetic "
 "kinship, a directorial or movement lineage, or a productive contrast — NOT merely same genre or same star. "
 "Mix accessible entry points with deeper cuts so the list rewards both newcomers and serious cinephiles. "
 "Never recommend the source film itself; avoid more than one film by the same director unless truly warranted. "
 "For each pick, give ONE reason of ≤25 words that names the SPECIFIC bridge from the source film, with no "
 "spoilers for the recommended film. Use only films you are confident exist; never invent a title, year, or director. "
 "Output ONLY JSON, no prose."
)

def build_user(c):
    def lst(x): return ", ".join(x) if isinstance(x, list) and x else "—"
    genres = lst(c.get("genres") or [])
    ov = (c.get("overview") or "").strip()
    if len(ov) > 600: ov = ov[:600] + "…"
    return (
        f"SOURCE FILM: {c.get('title')} ({c.get('year') or '?'}), dir. {c.get('director') or '?'}.\n"
        f"Genres: {genres}.\n"
        f"Synopsis: {ov or '—'}\n"
        f"Metatake reads it through these tropes/themes: {lst(c.get('tropes'))}.\n"
        f"Bold critical readings of it include: {lst(c.get('misreadings'))}.\n"
        f"Key figures (characters/objects/motifs): {lst(c.get('figures'))}.\n\n"
        f"Recommend {N_RECS} films to watch next. Return JSON exactly as:\n"
        '{"recs":[{"title":"","year":0,"director":"","reason":""}]}\n'
        f"Exactly {N_RECS} items, ranked best-first."
    )

def context(slug):
    rows = sb(f"films?slug=eq.{urllib.parse.quote(slug)}&select=id,title,year,director")
    if not rows: return None, None
    fid = rows[0]["id"]
    ctx = rpc("film_next_context", {"p_film_id": fid}) or {}
    return fid, ctx

import urllib.parse

def all_films():
    films, off, page = [], 0, 1000
    while True:
        batch = sb(f"films?select=id,slug&order=id&limit={page}&offset={off}")
        films += batch
        if len(batch) < page: break
        off += page
    return [f for f in films if f.get("slug")]

def emit_requests():
    done = set()
    full = f"{OUT}.jsonl"
    if os.path.exists(full):
        for l in open(full, encoding="utf-8"):
            try: done.add(json.loads(l).get("slug"))
            except Exception: pass
    films = all_films()
    todo = [f for f in films if f["slug"] not in done]
    print(f"[emit] {len(films)} films · {len(done)} done · {len(todo)} to request")
    n = 0
    with open(f"{OUT}.requests.jsonl", "w", encoding="utf-8") as w:
        for f in todo:
            ctx = rpc("film_next_context", {"p_film_id": f["id"]}) or {}
            if not ctx.get("title"): continue
            params = {"model": MODEL, "max_tokens": MAXTOK, "system": SYS,
                      "messages": [{"role": "user", "content": build_user(ctx)}]}
            w.write(json.dumps({"custom_id": f["slug"], "params": params}, ensure_ascii=False) + "\n")
            n += 1
            if n % 200 == 0: print(f"  built {n}")
    print(f"✅ wrote {n} requests → {OUT}.requests.jsonl\n   submit: python3 next-batch.py submit --out {OUT}")

def dry():
    slugs = FILMS_ARG or PILOT
    md = [f"# Watch next — DRY ({len(slugs)} films)\n"]
    out = []; tin = tout = 0
    for slug in slugs:
        try:
            fid, ctx = context(slug)
        except Exception as e:
            print(f"  ! {slug}: {e}"); continue
        if not fid or not ctx.get("title"):
            print(f"  ! {slug}: not found / no context"); continue
        text, (i, o) = call_llm(SYS, build_user(ctx))
        tin += i; tout += o
        try: recs = parse_json(text).get("recs", [])
        except Exception as e: print(f"  ! {slug}: parse {e}"); continue
        out.append({"slug": slug, "recs": recs})
        md.append(f"## {ctx['title']} ({ctx.get('year') or '?'}) — {ctx.get('director') or '?'}")
        for k, r in enumerate(recs, 1):
            md.append(f"{k}. **{r.get('title')}** ({r.get('year')}) · {r.get('director')}  \n   {r.get('reason')}")
        md.append("")
        print(f"  ✓ {slug}: {len(recs)} recs")
    open(f"{OUT}.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=2))
    open(f"{OUT}.md", "w", encoding="utf-8").write("\n".join(md))
    cost = tin / 1e6 * PRICE_IN + tout / 1e6 * PRICE_OUT
    full = cost / max(1, len(out)) * 1957
    print(f"\nDRY {len(out)} films · in {tin} out {tout} · ${cost:.3f}")
    print(f"→ extrapolated full (~1957, sync): ${full:.2f} · via Batch ≈ ${full*0.5:.2f}")
    print(f"→ {OUT}.md / {OUT}.json")

if __name__ == "__main__":
    if EMIT: emit_requests()
    else: dry()
