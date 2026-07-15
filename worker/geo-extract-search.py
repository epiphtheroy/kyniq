#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
geo-extract-search.py — 검색 기반 촬영지 추출기 (기존 geo-extract.py 드롭인 교체).

기존(geo-extract.py)의 한계: 모델 '기억'(Haiku)만 사용·"omit when unsure"·이름만 추출
 → 영화당 3~4개, 도시/랜드마크 수준의 거친 pin.
이 교체본: 영화당 **웹검색(Tavily)** 으로 장면별 실제 촬영지를 다수 수집 → 강한 모델로
 추출(주소 포함) → 다중출처 티어링 → film_locations에 '지오코딩 가능한 완전 문자열'로 기록.
 → 이후 geo-code.py(Google/Nominatim)가 정밀 pin을 채움.

품질/합법 규칙(우리가 합의한 것):
 - 여러 독립 출처 종합. 어떤 촬영지의 유일 출처가 보호DB(movie-locations.com/atlasofwonders)면
   격리(기록 안 함). 다른 독립출처와 함께면 게시.
 - 서사(set)와 실제 촬영지(filmed) 분리. 세트/CGI는 built_set로 표시.

I/O 계약(기존과 동일 테이블):
 - 읽기: films(id,slug,title,year,director,overview), figures(kind=location) 힌트로만 사용.
 - 쓰기: film_locations(film_id, layer='setting', name, narrative_setting, kind, source, confidence).
   name = "<상호>, <주소>, <도시>, <국가>" 형태(=Google이 정밀 지오코딩). lat/lng는 geo-code.py가 채움.

ENV: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, TAVILY_API_KEY
     GEO_MODEL(default claude-sonnet-4-6), GEO_WORKERS(default 4), GEO_MIN_SOURCES(default 2)
사용:
  python geo-extract-search.py --films parasite skyfall     # 특정 슬러그 파일럿(DRY)
  python geo-extract-search.py --films parasite --apply     # 기록
  python geo-extract-search.py --limit 8                    # 스코프 8편 DRY(파일럿)
  python geo-extract-search.py --apply                      # 전체 apply
"""
import os, sys, json, time, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

def load_env(p):
    try:
        for ln in open(p, encoding="utf-8"):
            ln = ln.strip()
            if ln and not ln.startswith("#") and "=" in ln:
                k, v = ln.split("=", 1); os.environ.setdefault(k, v.strip())
    except FileNotFoundError:
        pass
for f in (".env.local", ".env"):
    load_env(os.path.join(os.path.dirname(__file__), "..", f))

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
AK  = os.environ.get("ANTHROPIC_API_KEY");        TK = os.environ.get("TAVILY_API_KEY")
MODEL   = os.environ.get("GEO_MODEL", "claude-sonnet-4-6")
WORKERS = int(os.environ.get("GEO_WORKERS", "4"))
MIN_SRC = int(os.environ.get("GEO_MIN_SOURCES", "2"))
args = sys.argv[1:]; APPLY = "--apply" in args
def argval(f, d=None): return args[args.index(f)+1] if f in args and args.index(f)+1 < len(args) else d
LIMIT = int(argval("--limit", "0") or 0)
FILMS = argval("--films"); FILMS = FILMS.split(",") if FILMS else None
if FILMS is None:  # allow space-separated after --films
    if "--films" in args:
        i = args.index("--films") + 1; FILMS = []
        while i < len(args) and not args[i].startswith("--"): FILMS.append(args[i]); i += 1

PROTECTED = {"movie-locations.com", "atlasofwonders.com"}
TIER_A = {"en.wikipedia.org","wikipedia.org","imdb.com","cnn.com","bbc.co.uk","bbc.com","npr.org",
          "variety.com","theguardian.com","nytimes.com","reuters.com","focusfeatures.com"}
TIER_CONF = {"verified": 0.9, "probable": 0.7}   # weak/quarantine → 기록 안 함

def http(method, url, headers=None, body=None, timeout=120, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, method=method, data=data)
    for k, v in (headers or {}).items(): req.add_header(k, v)
    if body is not None and "Content-Type" not in (headers or {}): req.add_header("Content-Type", "application/json")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e: return e.code, e.read().decode()
        except (urllib.error.URLError, OSError) as e:
            if attempt == 2: return 0, str(e)
            time.sleep(2)

def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)
def fetch_all(path, page=1000):
    out, off = [], 0
    while True:
        st, tx = sb("GET", f"{path}{'&' if '?' in path else '?'}limit={page}&offset={off}")
        if st >= 300: raise SystemExit(f"supabase {st}: {tx[:200]}")
        chunk = json.loads(tx); out += chunk
        if len(chunk) < page: return out
        off += page
def in_list(vals): return "(" + ",".join(f'"{v}"' for v in vals) + ")"

# ---------- search ----------
import threading as _threading
_TAV_LOCK = _threading.Lock(); _TAV_LAST = [0.0]
def _tav_pace(min_int=float(os.environ.get("TAVILY_PACE", "0.6"))):
    # global pace: gather() fires 3 searches/film and workers run concurrently — without this the
    # burst rate-limits Tavily (429 → tavily() silently returns [] → "no evidence" for whole chunks,
    # as happened 2026-07-15 after ~1,080 searches). Pacing keeps the run under Tavily's rate.
    with _TAV_LOCK:
        dt = time.time() - _TAV_LAST[0]
        if dt < min_int: time.sleep(min_int - dt)
        _TAV_LAST[0] = time.time()
def tavily(query, k=8):
    _tav_pace()
    st, tx = http("POST", "https://api.tavily.com/search",
                  {"Content-Type": "application/json"},
                  {"api_key": TK, "query": query, "max_results": k, "include_answer": False})
    if st != 200: return []
    return [{"url": x.get("url",""), "content": x.get("content","")} for x in json.loads(tx).get("results", [])]
def domain(u):
    try: return urllib.parse.urlparse(u).netloc.replace("www.","")
    except Exception: return ""
def gather(film):
    t = f"{film['title']} ({film.get('year')})" if film.get("year") else film["title"]
    qs = [f"{t} filming locations list real places addresses",
          f"{t} where was it filmed set vs actually filmed",
          f"{t} filming location street address venue"]
    ev, seen = [], set()
    for q in qs:
        for h in tavily(q):
            if h["url"] and h["url"] not in seen:
                seen.add(h["url"]); ev.append(h)
        time.sleep(0.3)
    return ev

# ---------- extract (strong model) ----------
SYS = (
 "You extract REAL-WORLD filming locations for a film from SEARCH EVIDENCE (url+snippet list). "
 "Return as MANY genuine, distinct filming spots as the evidence supports (scene-level, not just the city). "
 "For each: the real venue/place name, a street ADDRESS if stated, city, country, the in-film role "
 "(narrative_setting), kind(one of venue|landmark|area|city|region|country), built_set(true if a "
 "constructed set/CGI/backlot, not a real visitable place) and set_host if known, a short scene_role in "
 "YOUR OWN words (never copy source sentences), and 'sources' = the evidence URLs supporting it (>=1, or drop). "
 "Separate where the story is SET from where it was FILMED. Skip fictional/invented places and generic "
 "interiors with no real geography. Keep proper nouns (venue, address) accurate. "
 "Return STRICT JSON: {\"places\":[{\"real_name\":str,\"address\":str,\"city\":str,\"country\":str,"
 "\"narrative_setting\":str,\"kind\":str,\"built_set\":bool,\"set_host\":str,\"scene_role\":str,"
 "\"sources\":[url,...]}]}")
def extract_one(film):
    ev = gather(film)
    if not ev: return film["slug"], [], "no evidence"
    hints = ", ".join(g["label"] for g in film.get("figs", [])[:12])
    user = (f"FILM: {film['title']} ({film.get('year')}) dir. {film.get('director')}\n"
            f"OVERVIEW: {(film.get('overview') or '')[:400]}\n"
            f"IN-FILM LOCATION HINTS: {hints or '(none)'}\n\n"
            f"SEARCH EVIDENCE:\n{json.dumps(ev, ensure_ascii=False)[:15000]}\n\nReturn the JSON now.")
    body = {"model": MODEL, "max_tokens": 3000, "system": SYS,
            "messages": [{"role": "user", "content": user}]}
    st, tx = http("POST", "https://api.anthropic.com/v1/messages",
                  {"x-api-key": AK, "anthropic-version": "2023-06-01"}, body, timeout=180)
    if st != 200: return film["slug"], [], f"llm {st}: {tx[:120]}"
    try:
        txt = json.loads(tx)["content"][0]["text"]
        j = json.loads(txt[txt.index("{"):txt.rindex("}")+1])
        return film["slug"], j.get("places", []), None
    except Exception as e:
        return film["slug"], [], f"parse: {e}"

# ---------- tier ----------
def judge(place):
    doms = {domain(u) for u in place.get("sources", []) if u}
    indep = doms - PROTECTED
    if len(indep) >= MIN_SRC or (len(doms) >= 2 and len(indep) >= 1): conf = "verified"
    elif len(doms) == 1 and next(iter(doms)) in TIER_A: conf = "probable"
    elif len(doms) == 1 and next(iter(doms)) in PROTECTED: conf = "quarantined"
    elif len(doms) >= 1: conf = "weak"
    else: conf = "unverified"
    place["_tier"] = conf; place["_domains"] = sorted(doms)
    return conf

def geocode_string(p):
    parts = [p.get("real_name"), p.get("address"), p.get("city"), p.get("country")]
    return ", ".join(x.strip() for x in parts if x and x.strip())[:200]

def main():
    for need, nm in ((URL,"SUPABASE_URL"),(KEY,"SERVICE_ROLE_KEY"),(AK,"ANTHROPIC_API_KEY"),(TK,"TAVILY_API_KEY")):
        if not need: sys.exit(f"Missing env: {nm}")
    if FILMS:
        films = fetch_all("films?select=id,slug,title,year,director,overview&slug=in." + in_list(FILMS))
    else:
        films = fetch_all("films?select=id,slug,title,year,director,overview&visible=eq.true")
    done = set()
    if not FILMS:
        for r in fetch_all("film_locations?select=film_id&layer=eq.setting&source=eq.agent-search"): done.add(r["film_id"])
    todo = []
    for f in films:
        if not FILMS and f["id"] in done: continue
        f["figs"] = fetch_all(f"figures?select=label&kind=eq.location&status=eq.approved&film_id=eq.{f['id']}")
        todo.append(f)
        if LIMIT and len(todo) >= LIMIT: break
    print(f"films in scope: {len(todo)} · model={MODEL} · workers={WORKERS} · apply={APPLY}")
    if not todo: return

    results = {}
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(extract_one, f): f for f in todo}
        for i, fut in enumerate(as_completed(futs), 1):
            slug, places, err = fut.result()
            for p in places: judge(p)
            results[slug] = {"places": places, "err": err}
            kept = sum(1 for p in places if p["_tier"] in TIER_CONF)
            print(f"  [{i}/{len(todo)}] {slug}: {len(places)} cand / {kept} shippable" + (f" · ERR {err}" if err else ""))

    ship = lambda p: p["_tier"] in TIER_CONF
    total = sum(sum(1 for p in v["places"] if ship(p)) for v in results.values())
    perfilm = {s: sum(1 for p in v["places"] if ship(p)) for s, v in results.items()}
    addr = sum(1 for v in results.values() for p in v["places"] if ship(p) and (p.get("address") or "").strip())
    quar = sum(1 for v in results.values() for p in v["places"] if p["_tier"] == "quarantined")
    print(f"\nSHIPPABLE {total} across {len(results)} films · avg/film {total/max(1,len(results)):.1f}"
          f" · with address {addr} ({addr/max(1,total)*100:.0f}%) · quarantined(보호DB단독) {quar}")
    if perfilm: print("  per-film:", dict(sorted(perfilm.items(), key=lambda x:-x[1])[:10]))

    if not APPLY:
        out = os.path.join(os.path.dirname(__file__), "geo-extract-search-dry.json")
        json.dump(results, open(out, "w"), indent=1, ensure_ascii=False)
        print(f"DRY → {out} (검토 후 --apply)"); return

    fid = {f["slug"]: f["id"] for f in todo}
    rows = []
    for slug, v in results.items():
        for p in v["places"]:
            if not ship(p) or not p.get("real_name"): continue
            rows.append({"film_id": fid[slug], "layer": "setting",
                         "name": geocode_string(p),
                         "narrative_setting": (p.get("scene_role") or p.get("narrative_setting") or "")[:300] or None,
                         "kind": p.get("kind"), "source": "agent-search",
                         "confidence": TIER_CONF.get(p["_tier"], 0.6)})
    for i in range(0, len(rows), 200):
        st, tx = sb("POST", "film_locations", rows[i:i+200], prefer="resolution=ignore-duplicates")
        if st >= 300: print(f"  insert {st}: {tx[:160]}", file=sys.stderr)
    print(f"applied {len(rows)} film_locations rows (coords null → run geo-code.py next)")

if __name__ == "__main__": main()
