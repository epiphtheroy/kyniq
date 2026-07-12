#!/usr/bin/env python3
"""Engine A(free) — WordPress.com Reader search + discovery flywheel (§6.1-E).

Per-keyword GET read/search?q="kw"&sort=date (unauthenticated, 20/page cap),
covers all public wp.com + paid-Jetpack self-hosted blogs. Every hit's site
feed is auto-added to the radar_sources pool (the flywheel). Runs hourly.

Usage: python3 radar/poll_wpcom.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import (build_matcher, clip, http, load_env, log, parse_date,  # noqa: E402
                    record_run, sb_post, strip_html, upsert_items, url_hash, within_hours)

API = "https://public-api.wordpress.com/rest/v1.2/read/search"
RECENCY_HOURS = 48


def main() -> None:
    env = load_env()
    m = build_matcher(env)
    kws = list(m.kw.values())
    items: list[dict] = []
    discovered: dict[str, dict] = {}
    errors: list = []
    for k in kws:
        phrase = (k.get("match_text") or k.get("keyword") or "").strip()
        if not phrase:
            continue
        url = f'{API}?q={quote(chr(34) + phrase + chr(34))}&sort=date&number=20'
        status, data = http(url, timeout=20)
        if status != 200 or not data:
            errors.append(f"{phrase}: HTTP {status}")
            continue
        try:
            posts = json.loads(data).get("posts", [])
        except Exception:
            errors.append(f"{phrase}: parse error")
            continue
        for p in posts:
            u = (p.get("URL") or "").strip()
            title = (p.get("title") or "").strip()
            if not u or not title:
                continue
            published = parse_date(p.get("date") or "")
            if not within_hours(published, RECENCY_HOURS):
                continue
            body = strip_html(p.get("excerpt") or p.get("content") or "")
            blob = f"{strip_html(title)} {body}"
            # WP.com full-text-matched the phrase; force-link the queried keyword
            # unless it's context-gated, in which case require in-text confirmation.
            kw_ids = set(m.match(blob))
            if not k.get("require_context"):
                kw_ids.add(k["id"])
            if not kw_ids:
                continue
            author = ((p.get("author") or {}).get("name")
                      if isinstance(p.get("author"), dict) else None)
            items.append({
                "url": u, "url_hash": url_hash(u), "platform": "wordpress",
                "author": author, "title": clip(strip_html(title), 500),
                "snippet": clip(body, 300), "content_text": blob[:8000],
                "published_at": published,
                "_kw": kw_ids, "_matched_on": {kid: "search" for kid in kw_ids},
            })
            site = (p.get("site_URL") or "").strip().rstrip("/")
            if site:
                feed = site + "/feed/"
                discovered[feed] = {"platform": "wordpress", "kind": "feed", "url": feed,
                                    "label": site.split("//")[-1][:80], "beat": "general",
                                    "active": True, "meta": {"via": "wpcom-discovery"}}

    seen, new, hits = upsert_items(env, items)
    if discovered:  # flywheel: add newly-seen blogs to the feed pool
        sb_post(env, "radar_sources", list(discovered.values()),
                on_conflict="platform,url", ignore=True)
    record_run(env, "wpcom", items_seen=seen, items_new=new, hits=hits, errors=errors[:20])
    log(f"wpcom: {len(kws)} keywords, {seen} items, {hits} hits, "
        f"{len(discovered)} feeds discovered, {len(errors)} errors")


if __name__ == "__main__":
    main()
