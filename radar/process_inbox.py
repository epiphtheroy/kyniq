#!/usr/bin/env python3
"""Drain radar_inbox — WebSub push payloads parked by the Vercel callback (§7).

The /api/radar/websub route must answer the hub fast, so it only stores the raw
Atom XML in radar_inbox. This worker parses YouTube push notifications, matches
titles/descriptions against all keywords locally, upserts items, and marks the
rows processed. Runs every 15 min on the Mac.

Usage: python3 radar/process_inbox.py
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import (build_matcher, clip, load_env, log, parse_date, record_run,  # noqa: E402
                    sb_get, sb_patch, upsert_items, url_hash)

ATOM = "{http://www.w3.org/2005/Atom}"
YT = "{http://www.youtube.com/xml/schemas/2015}"
MEDIA = "{http://search.yahoo.com/mrss/}"


def parse_youtube_push(xml: str, m) -> list[dict]:
    items: list[dict] = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return items
    for e in root.iter(f"{ATOM}entry"):
        vid = e.findtext(f"{YT}videoId")
        cid = e.findtext(f"{YT}channelId")
        title = (e.findtext(f"{ATOM}title") or "").strip()
        if not vid or not title:
            continue
        author_el = e.find(f"{ATOM}author")
        author = author_el.findtext(f"{ATOM}name") if author_el is not None else None
        group = e.find(f"{MEDIA}group")
        desc = (group.findtext(f"{MEDIA}description") if group is not None else "") or ""
        blob = f"{title} {desc}"
        kws = m.match(blob)
        if not kws:
            continue
        u = f"https://www.youtube.com/watch?v={vid}"
        title_kws = m.match(title)
        items.append({
            "url": u, "url_hash": url_hash(u), "platform": "youtube",
            "author": author,
            "author_url": f"https://www.youtube.com/channel/{cid}" if cid else None,
            "title": clip(title, 500), "snippet": clip(desc, 300),
            "content_text": blob[:4000],
            "published_at": parse_date(e.findtext(f"{ATOM}published") or ""),
            "meta": {"video_id": vid, "channel_id": cid, "via": "websub"},
            "_kw": kws,
            "_matched_on": {k: ("title" if k in title_kws else "text") for k in kws},
        })
    return items


def main() -> None:
    env = load_env()
    rows = sb_get(env, "radar_inbox?select=id,channel,payload"
                       "&processed=is.false&order=id&limit=500") or []
    m = build_matcher(env) if rows else None
    items: list[dict] = []
    ids: list[int] = []
    errors: list = []
    for row in rows:
        ids.append(row["id"])
        try:
            if row["channel"] == "websub-youtube":
                xml = (row.get("payload") or {}).get("xml") or ""
                items.extend(parse_youtube_push(xml, m))
        except Exception as e:
            errors.append(f"inbox {row['id']}: {type(e).__name__}")

    seen, new, hits = upsert_items(env, items)
    # radar_inbox rows are ONE-SHOT WebSub pushes — there is no source to re-fetch,
    # so we must not mark them processed if the items write failed, or those videos
    # are lost forever. seen==0 from a NON-empty batch = a hard DB write failure;
    # leave the rows for the next run (reprocessing is idempotent via url_hash).
    write_ok = (not items) or seen > 0
    if write_ok:
        for i in range(0, len(ids), 100):  # mark processed in chunks
            chunk = ids[i:i + 100]
            sb_patch(env, "radar_inbox", "id=in.(" + ",".join(map(str, chunk)) + ")",
                     {"processed": True})
    else:
        errors.append(f"items write failed — {len(ids)} inbox rows left for retry")
    record_run(env, "inbox", items_seen=seen, items_new=new, hits=hits, errors=errors)
    log(f"inbox: {len(rows)} payloads{'' if write_ok else ' (WRITE FAILED — not consumed)'}, "
        f"{seen} items, {hits} hits, {len(errors)} errors")


if __name__ == "__main__":
    main()
