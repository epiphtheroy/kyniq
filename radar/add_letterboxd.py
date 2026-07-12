#!/usr/bin/env python3
"""Add Letterboxd reviewers to the radar pool (개인 창작자 큐레이션).

Validates each username's member-diary RSS (must be live + have review items)
before adding it as a radar_sources row, so the pool never fills with dead
handles. This is how the owner curates WHOSE work to follow — the reviewers you
want to build relationships with.

Usage: python3 radar/add_letterboxd.py <username> [<username> ...]
       python3 radar/add_letterboxd.py --list      # show current pool
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import http, load_env, log, sb_get, sb_post  # noqa: E402


def validate(user: str) -> tuple[bool, int]:
    url = f"https://letterboxd.com/{user}/rss/"
    status, body = http(url, timeout=12)
    if status != 200 or not body:
        return False, status
    items = body.count(b"<item>")
    return items > 0, items


def main() -> None:
    env = load_env()
    args = sys.argv[1:]
    if not args or args[0] == "--list":
        pool = sb_get(env, "radar_sources?select=label,url,active,fail_count"
                          "&platform=eq.letterboxd&order=label") or []
        log(f"letterboxd pool: {len(pool)} reviewers")
        for p in pool:
            print(f"  {'✓' if p['active'] else '✗'} {p['label']}  (fails={p['fail_count']})")
        return

    rows = []
    for raw in args:
        user = re.sub(r"^@|/$", "", raw.strip().rstrip("/").split("/")[-1]).lower()
        if not user:
            continue
        ok, info = validate(user)
        if not ok:
            log(f"  skip {user}: no live review RSS (HTTP/items={info})")
            continue
        log(f"  ✓ {user}: {info} items")
        rows.append({"platform": "letterboxd", "kind": "feed",
                     "url": f"https://letterboxd.com/{user}/rss/", "label": user,
                     "beat": "film", "active": True, "meta": {"via": "add_letterboxd"}})
    if rows:
        status, _ = sb_post(env, "radar_sources", rows, on_conflict="platform,url", ignore=True)
        log(f"added {len(rows)} reviewers to the pool (HTTP {status})")
    else:
        log("nothing added")


if __name__ == "__main__":
    main()
