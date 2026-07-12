#!/usr/bin/env python3
"""Seed the radar_sources feed pool (정본: HANDOFF-키워드레이더.md §6.1-B).

Three layers, all $0:
  1. The 12-feed Now Playing fleet (beat-tagged) + curated film-crit blogs/mags.
  2. Broad Medium film tags (polled every 15 min by poll_feeds — 10-item window).
  3. Substack Culture-category crawl (unauthenticated /api/v1/category — best
     effort; runs on the Mac, skipped silently if the sandbox has no network).

Every new domain the engines discover later is auto-added by the pollers, so
this is just the starting pool. Idempotent (upsert on platform+url).

Usage: python3 radar/seed_feeds.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import http, load_env, log, sb_post  # noqa: E402

# ── layer 1: fleet + curated film-culture feeds ──
FLEET = [
    ("variety", "trade", "https://variety.com/feed/"),
    ("deadline", "trade", "https://deadline.com/feed/"),
    ("thr", "trade", "https://www.hollywoodreporter.com/feed/"),
    ("indiewire", "film", "https://www.indiewire.com/feed/"),
    ("guardian-film", "film", "https://www.theguardian.com/film/rss"),
    ("bbc-ents", "culture", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"),
    ("nyt-movies", "film", "https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml"),
]
CURATED_BLOGS = [
    # (label, beat, feed_url, platform)
    ("mubi-notebook", "film", "https://mubi.com/notebook.rss", "blog"),
    ("senses-of-cinema", "film", "https://www.sensesofcinema.com/feed/", "wordpress"),
    ("reverse-shot", "film", "https://www.reverseshot.org/rss", "blog"),
    ("film-comment", "film", "https://www.filmcomment.com/feed/", "wordpress"),
    ("bordwell", "film", "https://www.davidbordwell.net/blog/feed/", "wordpress"),
    ("cinema-scope", "film", "https://cinema-scope.com/feed/", "wordpress"),
    ("bright-wall-dark-room", "film", "https://www.brightwalldarkroom.com/feed/", "blog"),
    ("little-white-lies", "film", "https://lwlies.com/feed/", "wordpress"),
    ("the-film-stage", "film", "https://thefilmstage.com/feed/", "wordpress"),
    ("filmmaker-magazine", "film", "https://filmmakermagazine.com/feed/", "wordpress"),
    ("criterion-current", "film", "https://www.criterion.com/current/posts.rss", "blog"),
    ("screen-slate", "film", "https://www.screenslate.com/rss.xml", "blog"),
    ("kinolorber", "film", "https://www.kinolorber.com/rss", "blog"),
    ("los-angeles-review-books-film", "culture", "https://lareviewofbooks.org/feed/", "wordpress"),
    ("filmkrant", "film", "https://filmkrant.nl/feed/", "wordpress"),
]
# ── layer 2: broad Medium film tags (15-min poll class; label carries the tag) ──
MEDIUM_TAGS = ["film", "movies", "cinema", "film-criticism", "filmmaking",
               "screenwriting", "film-analysis", "cinephile", "korean-cinema", "arthouse"]

# ── layer 3: Substack discovery (network, best-effort) ──
SUBSTACK_CATEGORY = 96  # Culture


def substack_pubs(limit_pages: int = 3) -> list[tuple]:
    out: list[tuple] = []
    for page in range(limit_pages):
        status, data = http(
            f"https://substack.com/api/v1/category/public/{SUBSTACK_CATEGORY}/all?page={page}",
            timeout=15)
        if status != 200:
            log(f"substack category page {page} -> HTTP {status} (skipping crawl)")
            break
        try:
            payload = json.loads(data)
        except Exception:
            break
        pubs = payload.get("publications") or payload.get("results") or []
        if not pubs:
            break
        for p in pubs:
            base = p.get("base_url") or p.get("custom_domain")
            name = p.get("name") or p.get("subdomain") or "substack"
            if not base:
                sub = p.get("subdomain")
                if sub:
                    base = f"https://{sub}.substack.com"
            if base:
                feed = base.rstrip("/") + "/feed"
                out.append((name[:80], "culture", feed, "substack"))
    return out


def main() -> None:
    env = load_env()
    rows: list[dict] = []

    def add(platform, kind, url, label, beat, meta=None):
        rows.append({"platform": platform, "kind": kind, "url": url, "label": label,
                     "beat": beat, "active": True, "meta": meta or {}})

    for label, beat, url in FLEET:
        add("blog", "feed", url, label, beat)
    for label, beat, url, platform in CURATED_BLOGS:
        add(platform, "feed", url, label, beat)
    for tag in MEDIUM_TAGS:
        add("medium", "feed", f"https://medium.com/feed/tag/{tag}", f"medium:{tag}",
            "film", {"poll_class": "fast", "tag": tag})

    subs = substack_pubs()
    for name, beat, url, platform in subs:
        add(platform, "feed", url, name, beat)

    status, _ = sb_post(env, "radar_sources", rows, on_conflict="platform,url", ignore=True)
    log(f"seeded {len(rows)} feed sources (HTTP {status}): fleet={len(FLEET)} "
        f"curated={len(CURATED_BLOGS)} medium={len(MEDIUM_TAGS)} substack={len(subs)}")

    # Bluesky + fedibuzz stream singletons (sentinel url) + HN bulk source
    streams = [
        {"platform": "bluesky", "kind": "stream", "url": "jetstream", "label": "jetstream",
         "beat": "general", "active": True, "meta": {}},
        {"platform": "mastodon", "kind": "stream", "url": "fedibuzz", "label": "fedibuzz",
         "beat": "general", "active": True, "meta": {}},
        {"platform": "hn", "kind": "search", "url": "https://hn.algolia.com/api/v1/search_by_date",
         "label": "hn-bulk", "beat": "general", "active": True, "meta": {"hn_cursor": 0}},
    ]
    s2, _ = sb_post(env, "radar_sources", streams, on_conflict="platform,url", ignore=True)
    log(f"seeded {len(streams)} stream/bulk sources (HTTP {s2})")


if __name__ == "__main__":
    main()
