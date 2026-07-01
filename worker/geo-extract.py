#!/usr/bin/env python3
"""
geo-extract.py — Geographic Atlas, stage 1 of 2 (place-name extraction).

For each film, an LLM reads the film's in-world locations (figures.kind='location'
+ overview + take rationale/leap) and returns the REAL, mappable places the film
is set in or names — skipping fictional/invented places and generic interiors.
Writes `film_locations` rows (layer='setting', lat/lng NULL — geo-code.py fills
coordinates). Parallel (thread pool), DRY by default, idempotent, resumable.

Design goals (per handoff): well-designed agent · parallel to save time · quality
reviewable (DRY JSON) so prompts can be fixed and re-run · re-runnable for NEW films.

ENV: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
     GEO_MODEL (default claude-haiku-4-5), GEO_WORKERS (default 6)

USAGE:
  python geo-extract.py                      # DRY: all films missing setting pins → geo-extract-dry.json
  python geo-extract.py --films a-slug,b-slug   # scope to specific films
  python geo-extract.py --apply              # write film_locations rows
  python geo-extract.py --apply --films x    # apply for one film (new-film ingest)
"""
import os, sys, json, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

def load_env(p):
    try:
        for line in open(p):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except FileNotFoundError: pass
for f in (".env.local", ".env"): load_env(os.path.join(os.path.dirname(__file__), "..", f))

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
AK = os.environ.get("ANTHROPIC_API_KEY")
MODEL = os.environ.get("GEO_MODEL", "claude-haiku-4-5")
WORKERS = int(os.environ.get("GEO_WORKERS", "6"))
if not (URL and KEY): sys.exit("Missing Supabase env")
args = sys.argv[1:]
APPLY = "--apply" in args
def argval(f, d=None): return args[args.index(f)+1] if f in args and args.index(f)+1 < len(args) else d
FILMS = [s.strip() for s in (argval("--films", "") or "").split(",") if s.strip()]
LIMIT = int(argval("--limit", "0"))

def http(method, url, headers=None, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(5):
        req = urllib.request.Request(url, method=method, data=data); req.add_header("Content-Type", "application/json")
        for k, v in (headers or {}).items(): req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            code = e.code; tx = e.read().decode()[:400]
            if code in (429,500,502,503,504,529) and attempt < 4: time.sleep(2*(attempt+1)); continue
            return code, tx
        except (urllib.error.URLError, OSError):
            if attempt == 4: raise
            time.sleep(2*(attempt+1))
def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)
def fetch_all(path, page=1000):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}&limit={page}&offset={off}")
        if st != 200: raise RuntimeError(f"fetch {st}: {tx[:160]}")
        b = json.loads(tx); rows += b
        if len(b) < page: break
        off += page
    return rows
def in_list(vals): return "(" + ",".join(f'"{v}"' for v in vals) + ")"

SYS = (
 "You map films onto the real world. Given a film's in-world LOCATIONS (label + description), its "
 "overview, and a few critical takes, return ONLY the places that correspond to a REAL, locatable "
 "spot on Earth — a real city, region, country, landmark, natural feature or neighborhood. "
 "SKIP fictional/invented places (planets, realms, invented towns), generic interiors with no real "
 "geography (a kitchen, a courtroom set, an office), and anything you cannot confidently place. "
 "The real place is often named in the description even when the label is descriptive. "
 "Return STRICT JSON: {\"places\":[{\"figure_id\":\"<uuid or null>\",\"narrative\":\"<the in-film label/role>\","
 "\"name\":\"<the real place>\",\"kind\":\"city|region|country|landmark|venue|area\"}]}. "
 "Accuracy over coverage; when unsure, omit."
)

def extract_one(film):
    figs = film["figs"]
    figtxt = "\n".join(f"- [{f['id']}] {f['label']}: {(f.get('description') or '')[:240]}" for f in figs)
    takes = "\n".join(f"- {t}" for t in film["takes"][:6])
    user = (f"FILM: {film['title']} ({film.get('year')}) dir. {film.get('director')}\n"
            f"OVERVIEW: {(film.get('overview') or '')[:600]}\n\nIN-WORLD LOCATIONS:\n{figtxt or '(none)'}\n\n"
            f"CRITICAL NOTES:\n{takes or '(none)'}\n\nReturn the real, mappable places as JSON.")
    body = {"model": MODEL, "max_tokens": 1500, "system": SYS, "messages": [{"role": "user", "content": user}]}
    st, tx = http("POST", "https://api.anthropic.com/v1/messages",
                  {"x-api-key": AK, "anthropic-version": "2023-06-01"}, body, timeout=120)
    if st != 200: return film["slug"], [], f"llm {st}: {tx[:120]}"
    try:
        txt = json.loads(tx)["content"][0]["text"]
        j = json.loads(txt[txt.index("{"):txt.rindex("}")+1])
        return film["slug"], j.get("places", []), None
    except Exception as e:
        return film["slug"], [], f"parse: {e}"

def main():
    if not (APPLY or True):
        pass
    if not AK and not (FILMS and not APPLY):
        if not AK: print("WARN: ANTHROPIC_API_KEY missing — extraction will fail. Set it to run.", file=sys.stderr)
    # films in scope = have ≥1 location figure, lack setting pins (unless --films)
    if FILMS:
        films = fetch_all("films?select=id,slug,title,year,director,overview&slug=in." + in_list(FILMS))
    else:
        films = fetch_all("films?select=id,slug,title,year,director,overview&visible=eq.true")
    # existing pins per film (skip done)
    done = set()
    if not FILMS:
        for r in fetch_all("film_locations?select=film_id&layer=eq.setting"): done.add(r["film_id"])
    todo = []
    for f in films:
        if not FILMS and f["id"] in done: continue
        figs = fetch_all(f"figures?select=id,label,description&kind=eq.location&status=eq.approved&film_id=eq.{f['id']}")
        if not figs: continue
        tk = fetch_all(f"takes?select=take_title,leap&status=eq.published&figure_id=in." + in_list([g['id'] for g in figs]) + "&limit=6") if figs else []
        f["figs"] = figs; f["takes"] = [t.get("take_title") or t.get("leap") or "" for t in tk]
        todo.append(f)
        if LIMIT and len(todo) >= LIMIT: break
    print(f"films in scope: {len(todo)} (workers={WORKERS}, model={MODEL}, apply={APPLY})")
    if not todo: return

    results = {}
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(extract_one, f): f for f in todo}
        for i, fut in enumerate(as_completed(futs), 1):
            slug, places, err = fut.result()
            results[slug] = {"places": places, "err": err}
            if i % 20 == 0: print(f"  {i}/{len(todo)}")

    total = sum(len(v["places"]) for v in results.values()); errs = [s for s, v in results.items() if v["err"]]
    print(f"extracted {total} places across {len(results)} films · errors: {len(errs)}")
    if not APPLY:
        out = os.path.join(os.path.dirname(__file__), "geo-extract-dry.json")
        json.dump(results, open(out, "w"), indent=1, ensure_ascii=False)
        print(f"DRY → {out} (review, then re-run with --apply)")
        return
    # APPLY → insert rows (lat/lng null; geo-code.py fills them)
    fid = {f["slug"]: f["id"] for f in todo}
    rows = []
    for slug, v in results.items():
        for p in v["places"]:
            if not p.get("name"): continue
            rows.append({"film_id": fid[slug], "layer": "setting", "name": p["name"][:200],
                         "narrative_setting": (p.get("narrative") or "")[:300] or None,
                         "kind": p.get("kind"), "figure_id": p.get("figure_id") or None,
                         "source": "agent", "confidence": 0.6})
    for i in range(0, len(rows), 200):
        st, tx = sb("POST", "film_locations", rows[i:i+200], prefer="resolution=ignore-duplicates")
        if st >= 300: print(f"  insert {st}: {tx[:160]}", file=sys.stderr)
    print(f"applied {len(rows)} film_locations rows (coords null → run geo-code.py next)")

if __name__ == "__main__": main()
