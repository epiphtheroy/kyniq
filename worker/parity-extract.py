#!/usr/bin/env python3
"""
parity-extract — build the source corpus for the app-parity lane.

정본: HANDOFF-앱패리티-공장.md

Reads (never writes) production through the Supabase Management API and emits
data/gen/src/<corpus>.json — the fact blocks the generator is allowed to write from.

    python3 worker/parity-extract.py --corpus leads
    python3 worker/parity-extract.py --corpus dfacts
    python3 worker/parity-extract.py --report          # counts only, no file

Gentleness is not optional here. On 2026-08-06 a crawl saturated this database and
a well-meaning verification pass added sixteen count queries to a box that was already
timing out. So: small pages, a sleep between them, and no COUNT(*) unless asked.
"""
import argparse, hashlib, json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = "jvgarcqrtsmgfimdcwgo"
PAGE = 300
SLEEP = 2.0


def token() -> str:
    t = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if t:
        return t
    for name in (".env.local", ".env"):
        p = ROOT / name
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_ACCESS_TOKEN not found (env or .env.local)")


def q(sql: str, tok: str, tries: int = 3):
    """Management API query. A browser UA is mandatory — Cloudflare error 1010
    bans python-urllib outright (same lesson as worker/factory.py)."""
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=body,
        headers={
            "Authorization": f"Bearer {tok}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        },
        method="POST",
    )
    last = None
    for attempt in range(1, tries + 1):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001 - surface whatever the API said
            last = e
            detail = ""
            if isinstance(e, urllib.error.HTTPError):
                detail = e.read().decode()[:300]
            print(f"  ! attempt {attempt}/{tries}: {e} {detail}", file=sys.stderr)
            if attempt < tries:
                time.sleep(10 * attempt)
    raise SystemExit(f"query failed after {tries} attempts: {last}")


# ── the cohort ────────────────────────────────────────────────────────────────
# Tier-2 (is_analyzed false) plus the handful of Tier-1 films that never got an
# invitation. Ordered by exposure probability: the deck ranks on curation score,
# so the films most likely to be seen tonight are written first. If the run is cut
# short, what is missing is the tail nobody was going to meet this week.
COHORT = """
  select f.id, f.slug
  from public.films f
  left join curation.film cf on cf.tmdb_id = f.tmdb_id
  where not coalesce(f.is_analyzed, false)
  order by coalesce(cf.total_score, -1) desc, coalesce(cf.imdb_votes, 0) desc, f.id
"""

# The analyzed films that never received an invitation. Kept as its own query:
# folded into the cohort as a NOT EXISTS it makes the planner walk takes×figures
# for all seven thousand films and the statement times out.
COHORT_T1_GAP = """
  select f.id, f.slug
  from public.films f
  where coalesce(f.is_analyzed, false)
    and not exists (
      select 1 from public.takes k
      join public.figures g on g.id = k.figure_id
      where g.film_id = f.id and k.is_invitation and k.status = 'published')
  order by f.id
"""

LEADS_SQL = """
select
  f.slug,
  f.id::text as film_id,
  jsonb_strip_nulls(jsonb_build_object(
    'title', f.title,
    'original_title', nullif(f.original_title, f.title),
    'year', f.year,
    'director', f.director,
    'runtime', nullif(f.runtime, 0),
    'genres', case when coalesce(array_length(f.genres,1),0) > 0
                   then to_jsonb(f.genres[1:4]) end,
    'country', cf.country_code,
    'language', cf.original_language,
    'synopsis', nullif(btrim(coalesce(f.overview,'')), ''),
    'curator_note', nullif(btrim(coalesce(v.rationale,'')), ''),
    'curator_verdict', v.verdict_label_en,
    'movement', nullif(btrim(coalesce(fc.movement,'')), ''),
    'national', nullif(btrim(coalesce(fc.national,'')), ''),
    'auteur_reason', nullif(btrim(coalesce(fc.auteur_reason,'')), ''),
    'canon_lists', (
      select jsonb_agg(x.lbl) from (
        select distinct ll.label as lbl
        from public.film_lineage fl
        join public.lineage_lists ll on ll.id = fl.list_id
        where fl.film_id = f.id and ll.label is not null
        limit 4) x),
    'honors', (
      select jsonb_agg(x.lbl) from (
        select distinct h.label as lbl
        from public.film_wd_honors h
        where h.film_id = f.id and h.label is not null
        limit 3) x),
    'critical_fragment', (
      select nullif(btrim(coalesce(r.headline, r.comment, '')), '')
      from public.film_reception r
      where r.film_id = f.id
        and nullif(btrim(coalesce(r.headline, r.comment, '')), '') is not null
      order by r.position nulls last, r.id
      limit 1),
    'imdb_rating', cf.imdb_rating,
    'imdb_votes', nullif(cf.imdb_votes, 0)
  )) as facts
from public.films f
left join curation.film cf on cf.tmdb_id = f.tmdb_id
left join curation.film_comment fc on fc.tmdb_id = f.tmdb_id
left join curation.v_film_comment v on v.tmdb_id = f.tmdb_id
where f.id = any(%s::uuid[])
"""

# Directors that the app renders a Life panel for but which have no facts row.
# `films.visible` is the app's own filmography predicate, so a director with no
# visible film has no hub to fill.
DFACTS_SQL = """
select
  d.slug,
  jsonb_strip_nulls(jsonb_build_object(
    'name', d.name,
    'birthday', d.birthday,
    'place_of_birth', d.place_of_birth,
    'tmdb_bio', nullif(btrim(coalesce(d.bio,'')), ''),
    'films', (
      select jsonb_agg(jsonb_build_object('title', x.title, 'year', x.year) order by x.year)
      from (select f2.title, f2.year from public.films f2
            where f2.director_slug = d.slug and f2.visible
            order by f2.year limit 12) x),
    'film_count', (select count(*) from public.films f3 where f3.director_slug = d.slug and f3.visible)
  )) as facts
from public.directors d
where d.slug = any(%s::text[])
"""

DIRECTOR_COHORT = """
  select d.slug, d.slug as id
  from public.directors d
  where exists (select 1 from public.films f where f.director_slug = d.slug and f.visible)
    and not exists (select 1 from public.director_facts df where df.director_slug = d.slug)
  order by (select count(*) from public.films f where f.director_slug = d.slug and f.visible) desc, d.slug
"""


def sha(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def fetch_cohort(tok, sql):
    rows = q(sql, tok)
    if not isinstance(rows, list):
        raise SystemExit(f"unexpected cohort payload: {str(rows)[:300]}")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", choices=["leads", "dfacts"], default="leads")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()
    tok = token()

    if a.corpus == "leads":
        cohort = fetch_cohort(tok, COHORT)
        print(f"  tier-2: {len(cohort)}")
        time.sleep(SLEEP)
        gap = fetch_cohort(tok, COHORT_T1_GAP)
        print(f"  tier-1 without an invitation: {len(gap)}")
        cohort = cohort + gap
        entity_type, field, key_col, detail_sql = "film_lead", "lead", "slug", LEADS_SQL
        keys = [r["id"] for r in cohort]
    else:
        cohort = fetch_cohort(tok, DIRECTOR_COHORT)
        keys = [r["slug"] for r in cohort]
        entity_type, field, key_col, detail_sql = "director_life", "facts", "slug", DFACTS_SQL

    print(f"cohort: {len(keys)} {a.corpus}")
    if a.report:
        return
    if a.limit:
        keys = keys[: a.limit]

    out, pages = [], (len(keys) + PAGE - 1) // PAGE
    for p in range(pages):
        chunk = keys[p * PAGE:(p + 1) * PAGE]
        arr = "ARRAY[" + ",".join("'" + str(k).replace("'", "''") + "'" for k in chunk) + "]"
        rows = q(detail_sql.replace("%s", arr), tok)
        if not isinstance(rows, list):
            raise SystemExit(f"unexpected detail payload: {str(rows)[:300]}")
        for r in rows:
            rec = {
                "entity_type": entity_type,
                "entity_key": r[key_col],
                "field": field,
                "facts": r["facts"],
                "sha256": sha(r["facts"]),
            }
            # carried through generation so the loader never has to resolve
            # slug → uuid against a database that may be busy
            if r.get("film_id"):
                rec["film_id"] = r["film_id"]
            out.append(rec)
        print(f"  page {p+1}/{pages}  +{len(rows)}  total {len(out)}")
        if p + 1 < pages:
            time.sleep(SLEEP)

    # The detail query does not sort, so restore the cohort's exposure order:
    # whatever the deck would show first gets written first.
    rank = {r["slug"]: i for i, r in enumerate(cohort)}
    out.sort(key=lambda r: rank.get(r["entity_key"], 10**9))

    dest = ROOT / "data/gen/src" / f"{a.corpus}.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"\nwrote {len(out)} → {dest.relative_to(ROOT)}")

    # a quick shape census so the operator knows what the writer will be working with
    if a.corpus == "leads":
        n = len(out)
        def pct(f):
            return f"{sum(1 for r in out if r['facts'].get(f)) * 100 // max(n,1)}%"
        print(f"  synopsis {pct('synopsis')} · curator_note {pct('curator_note')} · "
              f"canon {pct('canon_lists')} · honors {pct('honors')} · "
              f"fragment {pct('critical_fragment')} · movement {pct('movement')}")


if __name__ == "__main__":
    main()
