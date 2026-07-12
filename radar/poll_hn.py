#!/usr/bin/env python3
"""Engine B — Hacker News bulk cursor + local matching (§6.1-F, free).

HN totals only ~8-12k items/day, so instead of per-keyword search we pull the
whole firehose since the last cursor (search_by_date with created_at_i>cursor)
and match all keywords locally. Cost is keyword-count-independent. The cursor
lives in the hn-bulk radar_sources row's meta.

Usage: python3 radar/poll_hn.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import (build_matcher, clip, http, load_env, log, record_run,  # noqa: E402
                    sb_get, sb_patch, strip_html, upsert_items, url_hash)

API = "https://hn.algolia.com/api/v1/search_by_date"


def main() -> None:
    env = load_env()
    m = build_matcher(env)
    src = (sb_get(env, "radar_sources?select=id,meta&platform=eq.hn&kind=eq.search&limit=1") or [{}])
    src = src[0] if src else {}
    src_id = src.get("id")
    cursor = int((src.get("meta") or {}).get("hn_cursor") or 0)
    if not cursor:  # first run: last 6h only
        cursor = int(datetime.now(timezone.utc).timestamp()) - 6 * 3600

    items: list[dict] = []
    errors: list = []
    max_ts = cursor
    for tag in ("story", "comment"):
        # Paginate older until a short page: a missed-run backlog can exceed the
        # 1000/page cap, and advancing straight to the newest would silently skip
        # everything between the cursor and the 1000th-newest item.
        upper: int | None = None
        for _page in range(25):  # safety cap (25k items/tag/run)
            nf = f"created_at_i%3E{cursor}"
            if upper is not None:
                nf += f",created_at_i%3C{upper}"
            status, data = http(f"{API}?tags={tag}&numericFilters={nf}&hitsPerPage=1000", timeout=25)
            if status != 200 or not data:
                errors.append(f"{tag}: HTTP {status}")
                break
            try:
                hits_json = json.loads(data).get("hits", [])
            except Exception:
                errors.append(f"{tag}: parse error")
                break
            if not hits_json:
                break
            page_min = None
            for h in hits_json:
                ts = h.get("created_at_i") or 0
                max_ts = max(max_ts, ts)
                page_min = ts if page_min is None else min(page_min, ts)
                title = h.get("title") or h.get("story_title") or ""
                comment = strip_html(h.get("comment_text") or "")
                blob = f"{title} {comment}".strip()
                if not blob:
                    continue
                kws = m.match(blob)
                if not kws:
                    continue
                oid = h.get("objectID")
                ext = h.get("url") or h.get("story_url")
                permalink = f"https://news.ycombinator.com/item?id={oid}"
                url_out = ext or permalink
                published = (datetime.fromtimestamp(ts, tz=timezone.utc)
                             .strftime("%Y-%m-%dT%H:%M:%SZ") if ts else None)
                title_kws = m.match(title) if title else set()
                items.append({
                    "url": url_out, "url_hash": url_hash(url_out), "platform": "hn",
                    "author": h.get("author"), "author_url": None,
                    "title": clip(title or comment[:80], 500),
                    "snippet": clip(comment or title, 300),
                    "content_text": blob[:8000], "published_at": published,
                    "source_id": src_id,
                    "meta": {"hn_id": oid, "permalink": permalink, "tag": tag},
                    "_kw": kws,
                    "_matched_on": {k: ("title" if k in title_kws else "text") for k in kws},
                })
            if len(hits_json) < 1000 or page_min is None:
                break            # short page → tag drained
            upper = page_min     # next page: strictly older than this page's oldest

    seen, new, hits = upsert_items(env, items)
    if src_id and max_ts > cursor:
        meta = dict(src.get("meta") or {})
        meta["hn_cursor"] = max_ts
        sb_patch(env, "radar_sources", f"id=eq.{src_id}", {"meta": meta})
    record_run(env, "hn", items_seen=seen, items_new=new, hits=hits, errors=errors)
    log(f"hn: cursor {cursor}->{max_ts}, {seen} matched items, {hits} hits, {len(errors)} errors")


if __name__ == "__main__":
    main()
