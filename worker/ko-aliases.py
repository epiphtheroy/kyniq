#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ko-aliases.py — search-only name index → search_aliases. Free, LLM 0.

Films   : films.wikidata_id (P-QID, ~6.8k) → rdfs:label@<lang> + skos:altLabel@<lang>.
Directors: directors.tmdb_person_id → Wikidata P4985 reverse → label + altLabel.
          …plus TMDB also_known_as (--tmdb-aka), which is language-UNTAGGED.

Feeds search_all v4 / film_search_i18n (0120): "기생충" → Parasite, "하네케" →
Michael Haneke. Idempotent (unique (kind,slug,alias), upsert-ignore).

⚠️ THE INVARIANT THIS FILE EXISTS TO KEEP: everything written here is a SEARCH
KEY, never a display name. That is what makes TMDB's also_known_as usable at
all. Its entries are market transliterations of uneven quality with no language
tag — picking one to SHOW would be a claim ("the Korean name for Wong Kar-Wai is
왕 가위"), and it would sometimes be wrong. Indexing all of them makes no claim:
whether the viewer types 왕가위, Kar Wai Wong or 王家衞, they reach the same
director, and nobody ever asks which spelling was official. Search wants recall;
display wants correctness. Display stays with lib/nativeName.ts's strict rule
(a native alias only when the birthplace names that script) — the two paths must
never be crossed.

Usage
  python3 worker/ko-aliases.py                 # Wikidata ko (films + directors) — the original job
  python3 worker/ko-aliases.py --lang ja       # Wikidata ja
  python3 worker/ko-aliases.py --tmdb-aka      # TMDB also_known_as for directors (lang='und')
  python3 worker/ko-aliases.py --dry           # resolve first batches, print, no writes
  python3 worker/ko-aliases.py --limit 300     # cap films this run
"""
from __future__ import annotations
import json, os, re, sys, time, unicodedata
from urllib import parse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

BASE = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
UA = "Mozilla/5.0 (compatible; MetatakeBot/1.0; +https://metatake.net/bot)"
DRY = "--dry" in sys.argv
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
# Wikidata language to harvest. 'ko' keeps the original job byte-identical.
LANG = sys.argv[sys.argv.index("--lang") + 1] if "--lang" in sys.argv else "ko"
TMDB_AKA = "--tmdb-aka" in sys.argv
# --only directors|films. Wave 2 (0120) filled films.title_<loc> from TMDB's own
# release titles, so Wikidata FILM labels in those languages are now duplicate
# work — the useful remainder is people, whose names TMDB does not localise.
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
ZH_HANT = "--zh-hant" in sys.argv
JOBS = max(1, int(sys.argv[sys.argv.index("--jobs") + 1])) if "--jobs" in sys.argv else 1
TMDB_TOKEN = os.environ.get("TMDB_READ_TOKEN", "")


def rest(path: str, method: str = "GET", body=None, prefer=None):
    h = dict(H)
    if prefer:
        h["Prefer"] = prefer
    req = Request(f"{BASE}/rest/v1/{path}", method=method,
                  data=json.dumps(body).encode() if body is not None else None, headers=h)
    with urlopen(req, timeout=90) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else None


def fetch_all(path: str):
    rows, off = [], 0
    while True:
        page = rest(f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        rows += page
        if len(page) < 1000:
            break
        off += 1000
    return rows


def sparql(q: str, tries: int = 4):
    url = "https://query.wikidata.org/sparql?format=json&query=" + parse.quote(q)
    for a in range(tries):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode())
        except HTTPError as e:
            if e.code in (429, 500, 502, 503) and a < tries - 1:
                time.sleep(8 * (a + 1))
                continue
            raise


def insert_aliases(rows):
    """Upsert-ignore into search_aliases. rows: list of dicts."""
    if not rows or DRY:
        return len(rows)
    for i in range(0, len(rows), 500):
        rest("search_aliases?on_conflict=kind,slug,alias", "POST", rows[i:i + 500],
             prefer="resolution=ignore-duplicates,return=minimal")
    return len(rows)


LATIN_ONLY = re.compile(r"^[\x00-\x7f\u00c0-\u024f\s]+$")


def fold(s: str) -> str:
    """Case/accent/punctuation-insensitive key. 'Wong Kar-Wai' == 'Wong Kar Wai'."""
    n = unicodedata.normalize("NFKD", s or "").lower()
    n = "".join(c for c in n if not unicodedata.combining(c))
    return re.sub(r"[^0-9a-z\u0080-\uffff]+", "", n)


def clean(alias: str, own_title: str | None) -> str | None:
    a = (alias or "").strip()
    if not a or len(a) > 120:
        return None
    # An alias that folds to the canonical name adds nothing: trigram search
    # already reaches "Wong Kar Wai" from "Wong Kar-Wai". Keeping it would just
    # grow the table (and every scan over it).
    if own_title and fold(a) == fold(own_title):
        return None
    # Too short to be a name is too short to be a search key: "李" alone would
    # match a large slice of the catalogue and drown the real hits. Non-Latin
    # scripts are denser, so two characters there is already specific (王家衞,
    # 홍상수) while Latin needs three.
    if len(a) < (3 if LATIN_ONLY.match(a) else 2):
        return None
    return a


def films():
    films = fetch_all("films?select=slug,title,wikidata_id&wikidata_id=not.is.null&order=slug")
    if LIMIT:
        films = films[:LIMIT]
    by_qid = {f["wikidata_id"]: f for f in films if f.get("wikidata_id", "").startswith("Q")}
    qids = list(by_qid.keys())
    print(f"[films:{LANG}] {len(qids)} films with QID{'  [DRY]' if DRY else ''}")
    total = 0
    for i in range(0, len(qids), 150):
        batch = qids[i:i + 150]
        vals = " ".join(f"wd:{q}" for q in batch)
        q = f'''SELECT ?f ?label ?alt WHERE {{
  VALUES ?f {{ {vals} }}
  OPTIONAL {{ ?f rdfs:label ?label FILTER(lang(?label)="{LANG}") }}
  OPTIONAL {{ ?f skos:altLabel ?alt FILTER(lang(?alt)="{LANG}") }}
}}'''
        try:
            res = sparql(q)
        except Exception as e:
            print(f"  ! films batch @{i}: {str(e)[:120]}")
            continue
        rows, seen = [], set()
        for b in res.get("results", {}).get("bindings", []):
            qid = b["f"]["value"].rsplit("/", 1)[-1]
            f = by_qid.get(qid)
            if not f:
                continue
            for key, src in (("label", "wikidata-label"), ("alt", "wikidata-alt")):
                a = clean(b.get(key, {}).get("value"), f["title"])
                if a and (f["slug"], a) not in seen:
                    seen.add((f["slug"], a))
                    rows.append({"kind": "film", "slug": f["slug"], "alias": a,
                                 "lang": LANG, "source": src})
        total += insert_aliases(rows)
        if DRY and rows:
            for r in rows[:8]:
                print(f"   · {r['slug']} ← {r['alias']}")
            print(f"  [DRY] first batch only → stopping films")
            break
        print(f"  [{min(i + 150, len(qids))}/{len(qids)}] aliases so far {total}")
        time.sleep(1)
    print(f"[films:{LANG}] {'DRY ' if DRY else ''}done: {total} alias rows")


def directors():
    ds = fetch_all("directors?select=slug,name,tmdb_person_id&tmdb_person_id=not.is.null&order=slug")
    by_tmdb = {str(d["tmdb_person_id"]): d for d in ds}
    ids = list(by_tmdb.keys())
    print(f"[directors:{LANG}] {len(ids)} directors with tmdb_person_id{'  [DRY]' if DRY else ''}")
    total = 0
    for i in range(0, len(ids), 150):
        batch = ids[i:i + 150]
        vals = " ".join(f'"{t}"' for t in batch)
        q = f'''SELECT ?tmdb ?label ?alt WHERE {{
  VALUES ?tmdb {{ {vals} }}
  ?p wdt:P4985 ?tmdb .
  OPTIONAL {{ ?p rdfs:label ?label FILTER(lang(?label)="{LANG}") }}
  OPTIONAL {{ ?p skos:altLabel ?alt FILTER(lang(?alt)="{LANG}") }}
}}'''
        try:
            res = sparql(q)
        except Exception as e:
            print(f"  ! directors batch @{i}: {str(e)[:120]}")
            continue
        rows, seen = [], set()
        for b in res.get("results", {}).get("bindings", []):
            d = by_tmdb.get(b["tmdb"]["value"])
            if not d:
                continue
            for key, src in (("label", "wikidata-label"), ("alt", "wikidata-alt")):
                a = clean(b.get(key, {}).get("value"), d["name"])
                if a and (d["slug"], a) not in seen:
                    seen.add((d["slug"], a))
                    rows.append({"kind": "director", "slug": d["slug"], "alias": a,
                                 "lang": LANG, "source": src})
        total += insert_aliases(rows)
        if DRY and rows:
            for r in rows[:8]:
                print(f"   · {r['slug']} ← {r['alias']}")
            print(f"  [DRY] first batch only → stopping directors")
            break
        print(f"  [{min(i + 150, len(ids))}/{len(ids)}] aliases so far {total}")
        time.sleep(1)
    print(f"[directors:{LANG}] {'DRY ' if DRY else ''}done: {total} alias rows")


def tmdb_person(pid: str):
    """TMDB /person. The token is a v3 api key here (<=40 chars) — v4 bearer
    tokens are longer; every worker in this repo branches on that same length."""
    if len(TMDB_TOKEN) > 40:
        req = Request(f"https://api.themoviedb.org/3/person/{pid}",
                      headers={"Authorization": f"Bearer {TMDB_TOKEN}", "accept": "application/json"})
    else:
        req = Request(f"https://api.themoviedb.org/3/person/{pid}?api_key={TMDB_TOKEN}",
                      headers={"accept": "application/json"})
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def tmdb_aka():
    """TMDB also_known_as → search_aliases (source 'tmdb-aka', lang 'und').

    Complements the Wikidata pass rather than replacing it. Wikidata gives few,
    high-quality, LANGUAGE-TAGGED labels; TMDB gives many untagged ones —
    native script, foreign-market transliterations, and romanisation variants:

        Wong Kar-Wai → Wong Kar Wai · Kar Wai Wong · Kar-wai Wong ·
                       왕 가위 · ウォン・カーワァイ · Vương Gia Vệ · 王家衞

    Every one of those is a string somebody might type. lang is written as 'und'
    (ISO 639-2 "undetermined") because TMDB genuinely does not say, and pretending
    otherwise would put a wrong language tag in the ledger. Search does not need
    it: matching is by string, not by language.
    """
    if not TMDB_TOKEN:
        print("TMDB_READ_TOKEN missing in .env.local"); return
    ds = fetch_all("directors?select=slug,name,tmdb_person_id&tmdb_person_id=not.is.null&order=slug")
    if LIMIT:
        ds = ds[:LIMIT]
    print(f"[tmdb-aka] {len(ds)} directors{'  [DRY]' if DRY else ''}")
    total = miss = 0
    for i, d in enumerate(ds):
        try:
            p = tmdb_person(str(d["tmdb_person_id"]))
        except Exception as e:
            miss += 1
            print(f"  ! {d['slug']}: {str(e)[:80]}")
            time.sleep(0.05)
            continue
        rows, seen = [], set()
        for a in (p.get("also_known_as") or []):
            c = clean(a, d["name"])
            if c and c not in seen:
                seen.add(c)
                rows.append({"kind": "director", "slug": d["slug"], "alias": c,
                             "lang": "und", "source": "tmdb-aka"})
        total += insert_aliases(rows)
        if DRY and rows:
            print(f"   · {d['slug']} ← {' | '.join(r['alias'] for r in rows)}")
        if (i + 1) % 100 == 0:
            print(f"  [{i + 1}/{len(ds)}] aliases so far {total}", flush=True)
        time.sleep(0.05)
    print(f"[tmdb-aka] {'DRY ' if DRY else ''}done: {total} alias rows · {miss} TMDB misses")


def zh_hant():
    """Traditional Chinese film titles → search_aliases (source 'tmdb-zh-hant').

    films.title_zh holds the SIMPLIFIED title (the worker asks TMDB for zh-CN),
    and Traditional is a different string: 花樣年華 vs 花样年华. A viewer in Taipei
    or Hong Kong types the Traditional form and matches nothing — which matters
    more for this catalogue than most, because a large part of the Chinese-
    language cinema in it (Wong Kar-wai, Hou Hsiao-hsien, Edward Yang) is
    Taiwanese or Hong Kong work whose ORIGINAL titles are Traditional.

    Traditional does not get its own title_<loc> column: there is nothing to
    display differently — zh readers get the Simplified title either way — and a
    column would imply a display decision this doesn't need. It is purely a way
    IN, which is exactly what search_aliases is for.

    Many films are spelled identically in both scripts (悲情城市, 一一); clean()
    drops those against title_zh so only the genuinely different forms are stored.
    """
    if not TMDB_TOKEN:
        print("TMDB_READ_TOKEN missing in .env.local"); return
    fs = fetch_all("films?select=slug,title,title_zh,tmdb_id&tmdb_id=not.is.null&order=slug")
    if LIMIT:
        fs = fs[:LIMIT]
    print(f"[zh-hant] {len(fs)} films (jobs={JOBS}){'  [DRY]' if DRY else ''}", flush=True)

    def one(f):
        try:
            if len(TMDB_TOKEN) > 40:
                req = Request(f"https://api.themoviedb.org/3/movie/{f['tmdb_id']}/translations",
                              headers={"Authorization": f"Bearer {TMDB_TOKEN}", "accept": "application/json"})
            else:
                req = Request(f"https://api.themoviedb.org/3/movie/{f['tmdb_id']}/translations?api_key={TMDB_TOKEN}",
                              headers={"accept": "application/json"})
            with urlopen(req, timeout=30) as r:
                d = json.loads(r.read().decode())
        except Exception:
            return 0
        rows, seen = [], set()
        for tr in (d.get("translations") or []):
            if tr.get("iso_639_1") != "zh" or tr.get("iso_3166_1") not in ("TW", "HK"):
                continue
            cand = ((tr.get("data") or {}).get("title") or "").strip()
            a = clean(cand, f["title"])
            # Identical to the Simplified title we already store => no new way in.
            if not a or (f.get("title_zh") and fold(a) == fold(f["title_zh"])):
                continue
            if a in seen:
                continue
            seen.add(a)
            rows.append({"kind": "film", "slug": f["slug"], "alias": a,
                         "lang": "zh-Hant", "source": "tmdb-zh-hant"})
        if DRY and rows:
            print(f"   · {f['slug']}: {f.get('title_zh') or '-'} ← {' | '.join(r['alias'] for r in rows)}")
        return insert_aliases(rows)

    total = 0
    if JOBS == 1:
        for f in fs: total += one(f)
    else:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=JOBS) as ex:
            for i, n in enumerate(ex.map(one, fs)):
                total += n
                if (i + 1) % 1000 == 0: print(f"  … {i + 1}/{len(fs)}  aliases {total}", flush=True)
    print(f"[zh-hant] {'DRY ' if DRY else ''}done: {total} alias rows")


if __name__ == "__main__":
    if ZH_HANT:
        zh_hant()
        print("✅ zh-hant complete")
    elif TMDB_AKA:
        tmdb_aka()
        print("✅ tmdb-aka complete")
    else:
        if ONLY in (None, "directors"):
            directors()
        if ONLY in (None, "films"):
            films()
        print(f"✅ aliases complete ({LANG}{'' if not ONLY else ' · ' + ONLY})")
