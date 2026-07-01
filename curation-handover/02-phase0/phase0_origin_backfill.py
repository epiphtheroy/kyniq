#!/usr/bin/env python3
"""
Phase 0 FINALIZER — authoritative origin country from TMDB.

Why: the in-DB heuristic placed ~2,600 films cleanly, but list membership can't fully
separate "made in X" from "honored in X" (festival/critics lists), and atlas films have no
language to guard with. TMDB `production_countries` is the authoritative origin. This script
re-derives origin for every not-yet-API-verified film, then rebuilds the country hubs.

Run on your machine / worker (has TMDB token + network). The sandbox has no internet, so this
cannot run there.

Reads creds from the project's .env.local (MetaTake) or environment:
  TMDB_READ_TOKEN            TMDB v4 read access token (Bearer)
  SUPABASE_DB_URL            postgres conn string for kyniq
                             (Supabase > Settings > Database > Connection string > URI)

Deps:  pip install psycopg2-binary requests
Usage: python3 phase0_origin_backfill.py
Idempotent; respects manual_override; ~6.7k calls (~4 min at 30/s).
"""
import os, time, sys, pathlib
import requests, psycopg2

def load_env():
    for p in [".env.local", os.path.expanduser("~/Documents/MetaTake/.env.local")]:
        f = pathlib.Path(p)
        if f.exists():
            for line in f.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env()

TOKEN = os.environ["TMDB_READ_TOKEN"]
DB    = os.environ["SUPABASE_DB_URL"]
H = {"Authorization": f"Bearer {TOKEN}", "accept": "application/json"}
URL = "https://api.themoviedb.org/3/movie/{}"

def main():
    conn = psycopg2.connect(DB); conn.autocommit = False
    cur = conn.cursor()
    cur.execute("""
        select tmdb_id from curation.film
        where origin_confidence is distinct from 'api'
          and coalesce(manual_override,false)=false
        order by tmdb_id
    """)
    ids = [r[0] for r in cur.fetchall()]
    print(f"targets: {len(ids)}")
    ok = 0
    for i, tid in enumerate(ids, 1):
        try:
            r = requests.get(URL.format(tid), headers=H, timeout=15)
            if r.status_code == 429:
                time.sleep(2); r = requests.get(URL.format(tid), headers=H, timeout=15)
            r.raise_for_status()
            j = r.json()
            pcs = j.get("production_countries") or []
            cc  = pcs[0]["iso_3166_1"].lower() if pcs else None
            lang = j.get("original_language")
            if cc:
                cur.execute("""update curation.film
                    set country_code=%s, original_language=coalesce(%s,original_language),
                        origin_confidence='api', updated_at=now()
                    where tmdb_id=%s and coalesce(manual_override,false)=false""", (cc, lang, tid))
                ok += 1
        except Exception as e:
            print(f"  skip {tid}: {e}", file=sys.stderr)
        if i % 200 == 0:
            conn.commit(); print(f"  {i}/{len(ids)} (resolved {ok})")
        time.sleep(0.03)
    conn.commit()
    cur.execute("select curation.rebuild_country_hubs()")
    conn.commit()
    print(f"done. resolved {ok}/{len(ids)}; country hubs rebuilt from authoritative origin.")
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
