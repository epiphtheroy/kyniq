#!/usr/bin/env python3
"""Engine A(free) — YouTube discovery loop (§6.1-D).

The default search.list bucket is only 100 calls/day, so we rotate the 25
hottest keywords per 6h cycle (25×4=100/day). Every result seeds the WebSub
channel pool (the free, keyword-count-independent backbone) AND becomes an item.
Rotation offset is stored in a youtube-rotor radar_sources row.

⚠️ YouTube broke date-SORT in early 2026 (yt-dlp dropped ytsearchdate). We use
order=date + publishedAfter and accept some lossiness; the WebSub pool is the
real freshness layer. Run the last-hour filter probe (HANDOFF §6.1-D) first.

Usage: python3 radar/poll_youtube_search.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import (build_matcher, clip, http, load_env, log, parse_date,  # noqa: E402
                    record_run, sb_get, sb_patch, sb_post, upsert_items, url_hash, hours_ago_iso)

SEARCH = "https://www.googleapis.com/youtube/v3/search"
BATCH = 25  # keywords per 6h cycle (25×4/day = 100/day free bucket)


def rotor(env: dict) -> dict:
    row = sb_get(env, "radar_sources?select=id,meta&platform=eq.youtube&kind=eq.search&limit=1")
    if row:
        return row[0]
    sb_post(env, "radar_sources", {"platform": "youtube", "kind": "search",
            "url": "youtube-rotor", "label": "yt-rotor", "beat": "general",
            "active": True, "meta": {"offset": 0}}, on_conflict="platform,url", ignore=True)
    row = sb_get(env, "radar_sources?select=id,meta&platform=eq.youtube&kind=eq.search&limit=1")
    return row[0] if row else {"id": None, "meta": {"offset": 0}}


def main() -> None:
    env = load_env()
    key = env.get("YOUTUBE_API_KEY") or env.get("YOUTUBE_DATA_API_KEY")
    if not key:
        log("youtube: no YOUTUBE_API_KEY in .env.local — skipping (free but keyed)")
        return
    m = build_matcher(env)
    kws = sorted(m.kw.values(), key=lambda k: (k.get("tier") != "hot", k["id"]))
    r = rotor(env)
    offset = int((r.get("meta") or {}).get("offset") or 0)
    window = kws[offset:offset + BATCH] or kws[:BATCH]
    next_offset = (offset + BATCH) % max(1, len(kws))

    published_after = hours_ago_iso(6)
    items: list[dict] = []
    channels: dict[str, dict] = {}
    errors: list = []
    calls = 0
    for k in window:
        phrase = (k.get("match_text") or k.get("keyword") or "").strip()
        if not phrase:
            continue
        url = (f"{SEARCH}?part=snippet&type=video&order=date&maxResults=25"
               f"&q={quote(chr(34) + phrase + chr(34))}&publishedAfter={published_after}&key={key}")
        status, data = http(url, timeout=20)
        calls += 1
        if status != 200 or not data:
            errors.append(f"{phrase}: HTTP {status}")
            continue
        try:
            results = json.loads(data).get("items", [])
        except Exception:
            errors.append(f"{phrase}: parse error")
            continue
        for v in results:
            vid = (v.get("id") or {}).get("videoId")
            sn = v.get("snippet") or {}
            if not vid:
                continue
            u = f"https://www.youtube.com/watch?v={vid}"
            title = sn.get("title") or ""
            desc = sn.get("description") or ""
            blob = f"{title} {desc}"
            # force-link the queried keyword unless it's context-gated (then it
            # must survive the gate on title+description) — skips false positives
            # and their channel enrollment for generic-word titles.
            kw_ids = set(m.match(blob))
            if not k.get("require_context"):
                kw_ids.add(k["id"])
            if not kw_ids:
                continue
            items.append({
                "url": u, "url_hash": url_hash(u), "platform": "youtube",
                "author": sn.get("channelTitle"),
                "author_url": (f"https://www.youtube.com/channel/{sn.get('channelId')}"
                               if sn.get("channelId") else None),
                "title": clip(title, 500), "snippet": clip(desc, 300),
                "content_text": blob[:4000], "published_at": parse_date(sn.get("publishedAt") or ""),
                "thumb_url": ((sn.get("thumbnails") or {}).get("medium") or {}).get("url"),
                "meta": {"video_id": vid, "channel_id": sn.get("channelId")},
                "_kw": kw_ids, "_matched_on": {kid: "search" for kid in kw_ids},
            })
            cid = sn.get("channelId")
            if cid:  # flywheel: enroll the channel for free WebSub tracking
                feed = f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}"
                channels[feed] = {"platform": "youtube", "kind": "websub", "url": feed,
                                  "label": (sn.get("channelTitle") or cid)[:80],
                                  "beat": "film", "active": True,
                                  "meta": {"channel_id": cid, "via": "yt-search"}}

    seen, new, hits = upsert_items(env, items)
    if channels:
        sb_post(env, "radar_sources", list(channels.values()),
                on_conflict="platform,url", ignore=True)
    if r.get("id"):
        meta = dict(r.get("meta") or {})
        meta["offset"] = next_offset
        sb_patch(env, "radar_sources", f"id=eq.{r['id']}", {"meta": meta})
    record_run(env, "youtube", items_seen=seen, items_new=new, hits=hits, errors=errors)
    log(f"youtube: {calls} searches (offset {offset}->{next_offset}), {seen} items, "
        f"{hits} hits, {len(channels)} channels enrolled, {len(errors)} errors")


if __name__ == "__main__":
    main()
