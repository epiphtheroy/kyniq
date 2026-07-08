#!/usr/bin/env python3
"""Entity cache for the beat gate — films, directors, theorists.

Pulls the corpus entity surface from Supabase REST (anon key, paged past the
1,000-row cap) into poller/entities.json. Run daily (cheap); the poller
matches trending keywords against this file offline.

Usage: python3 hourly/poller/sync_entities.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import load_env, log, sb_get  # noqa: E402

OUT = Path(__file__).resolve().parent / "entities.json"
PAGE = 1000


def paged(env: dict, base: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        batch = sb_get(env, f"{base}&limit={PAGE}&offset={offset}")
        if not isinstance(batch, list) or not batch:
            break
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    return rows


def main() -> None:
    env = load_env()

    # All films — Tier-2 pages are live too (noindex but linkable); the beat
    # gate scores analyzed films higher, it doesn't exclude the catalog.
    films = paged(env, "films?select=slug,title,year,director,director_slug,is_analyzed&order=slug")
    theorists = paged(env, "theorists?select=slug,name&order=slug")

    directors: dict[str, dict] = {}
    for f in films:
        d, ds = (f.get("director") or "").strip(), f.get("director_slug")
        if d and len(d.split()) >= 2:
            rec = directors.setdefault(d, {"name": d, "slug": ds, "films": 0})
            rec["films"] += 1
            if ds and not rec["slug"]:
                rec["slug"] = ds

    out = {
        "synced_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "films": [
            {"slug": f["slug"], "title": f["title"], "year": f.get("year"),
             "director": f.get("director"), "analyzed": bool(f.get("is_analyzed"))}
            for f in films if f.get("slug") and f.get("title")
        ],
        "directors": sorted(directors.values(), key=lambda r: -r["films"]),
        "theorists": [{"slug": t["slug"], "name": t["name"]} for t in theorists if t.get("name")],
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False))
    log(f"entities synced: films={len(out['films'])} directors={len(out['directors'])} theorists={len(out['theorists'])} -> {OUT}")


if __name__ == "__main__":
    main()
