#!/usr/bin/env python3
"""Engine B backbone — RSS/Atom feed pool + local matching (§6.1-B).

Polls radar_sources(kind='feed'), conditional-GET (ETag / If-Modified-Since)
where supported, parses items tolerantly, matches title+body against ALL
keywords locally, and upserts only the matched items. Cost is independent of
keyword count. Substack sources are fetched via their compact archive JSON
(the /feed body is ~689KB and its ETag drifts across CDN nodes). Medium tags
are polled on a faster class.

  python3 radar/poll_feeds.py         # all feeds (hourly at :05)
  python3 radar/poll_feeds.py fast    # only meta.poll_class='fast' (Medium, 15-min)
"""
from __future__ import annotations

import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import (UA, build_matcher, clip, hours_ago_iso, load_env, log, ledger,  # noqa: E402
                    parse_date, record_run, sb_get, sb_patch, strip_html, upsert_items,
                    url_hash, within_hours)

ATOM = "{http://www.w3.org/2005/Atom}"
CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}"
DC = "{http://purl.org/dc/elements/1.1/}"
RECENCY_HOURS = 72          # store matched items up to 3 days old (dedup handles re-seen)
FAIL_DISABLE_AT = 12        # deactivate a feed after this many consecutive failures


def fetch(url: str, etag: str | None, last_modified: str | None, timeout: int = 20):
    """Conditional GET → (status, body_bytes, resp_headers)."""
    hdrs = {"User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/json, */*"}
    if etag:
        hdrs["If-None-Match"] = etag
    if last_modified:
        hdrs["If-Modified-Since"] = last_modified
    try:
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, b"", {k.lower(): v for k, v in (e.headers or {}).items()}
    except Exception:
        return 0, b"", {}


def parse_rss_atom(data: bytes) -> list[dict]:
    """Tolerant RSS/Atom → [{title,url,published,body,author}]."""
    items: list[dict] = []
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return items
    for it in root.iter("item"):  # RSS
        body = (it.findtext(f"{CONTENT_NS}encoded") or it.findtext("description") or "")
        items.append({
            "title": (it.findtext("title") or "").strip(),
            "url": (it.findtext("link") or "").strip(),
            "published": parse_date(it.findtext("pubDate") or ""),
            "body": body,
            "author": (it.findtext(f"{DC}creator") or it.findtext("author") or "").strip() or None,
        })
    for it in root.iter(f"{ATOM}entry"):  # Atom
        link = ""
        for ln in it.findall(f"{ATOM}link"):
            if ln.get("rel", "alternate") == "alternate" or not link:
                link = ln.get("href", "") or link
        author = it.find(f"{ATOM}author")
        items.append({
            "title": (it.findtext(f"{ATOM}title") or "").strip(),
            "url": link.strip(),
            "published": parse_date(it.findtext(f"{ATOM}published")
                                    or it.findtext(f"{ATOM}updated") or ""),
            "body": (it.findtext(f"{ATOM}content") or it.findtext(f"{ATOM}summary") or ""),
            "author": (author.findtext(f"{ATOM}name").strip()
                       if author is not None and author.findtext(f"{ATOM}name") else None),
        })
    return items


def parse_substack_archive(data: bytes) -> list[dict]:
    import json
    try:
        posts = json.loads(data)
    except Exception:
        return []
    out = []
    for p in posts if isinstance(posts, list) else []:
        bylines = p.get("publishedBylines") or []
        author = (bylines[0].get("name") if bylines and isinstance(bylines[0], dict) else None)
        out.append({
            "title": (p.get("title") or "").strip(),
            "url": (p.get("canonical_url") or "").strip(),
            "published": parse_date(p.get("post_date") or ""),
            "body": p.get("description") or p.get("subtitle") or "",
            "author": author,
        })
    return out


def source_fetch_url(src: dict) -> str:
    if src["platform"] == "substack" and src.get("url"):
        base = src["url"].rstrip("/")
        if base.endswith("/feed"):
            base = base[:-5]
        return base + "/api/v1/archive?sort=new&limit=12"
    return src["url"]


def main() -> None:
    fast_only = len(sys.argv) > 1 and sys.argv[1] == "fast"
    env = load_env()
    m = build_matcher(env)
    srcs = sb_get(env, "radar_sources?select=*&kind=eq.feed&active=is.true&order=id") or []
    if fast_only:
        srcs = [s for s in srcs if (s.get("meta") or {}).get("poll_class") == "fast"]

    items: list[dict] = []
    errors: list = []
    ok_feeds = 0
    for src in srcs:
        try:
            furl = source_fetch_url(src)
            status, body, hdrs = fetch(furl, src.get("etag"), src.get("last_modified"))
            if status == 304:
                sb_patch(env, "radar_sources", f"id=eq.{src['id']}",
                         {"last_ok_at": hours_ago_iso(0), "fail_count": 0})
                ok_feeds += 1
                continue
            if status != 200 or not body:
                fc = (src.get("fail_count") or 0) + 1
                patch = {"fail_count": fc}
                if fc >= FAIL_DISABLE_AT:
                    patch["active"] = False
                    errors.append(f"{src.get('label')} disabled after {fc} fails")
                sb_patch(env, "radar_sources", f"id=eq.{src['id']}", patch)
                continue
            parsed = (parse_substack_archive(body) if src["platform"] == "substack"
                      else parse_rss_atom(body))
            ok_feeds += 1
            for it in parsed:
                if not it["title"] or not it["url"]:
                    continue
                if not within_hours(it["published"], RECENCY_HOURS):
                    continue
                body_text = strip_html(it["body"])
                blob = f"{it['title']} {body_text}"
                kws = m.match(blob, source_beat=src.get("beat"))
                if not kws:
                    continue
                title_kws = m.match(it["title"], source_beat=src.get("beat"))
                items.append({
                    "url": it["url"], "url_hash": url_hash(it["url"]),
                    "platform": src["platform"], "author": it.get("author"),
                    "title": clip(it["title"], 500), "snippet": clip(body_text, 300),
                    "content_text": blob[:8000], "published_at": it["published"],
                    "source_id": src["id"],
                    "_kw": kws,
                    "_matched_on": {k: ("title" if k in title_kws else "text") for k in kws},
                })
            new_etag = hdrs.get("etag")
            new_lm = hdrs.get("last-modified")
            patch = {"last_ok_at": hours_ago_iso(0), "fail_count": 0}
            if new_etag:
                patch["etag"] = new_etag
            if new_lm:
                patch["last_modified"] = new_lm
            sb_patch(env, "radar_sources", f"id=eq.{src['id']}", patch)
        except Exception as e:  # never let one feed kill the run
            errors.append(f"{src.get('label')}: {type(e).__name__}")

    seen, new, hits = upsert_items(env, items)
    record_run(env, "feedpool", items_seen=seen, items_new=new, hits=hits, errors=errors)
    log(f"feedpool{'(fast)' if fast_only else ''}: {ok_feeds}/{len(srcs)} feeds ok, "
        f"{seen} matched items, {hits} hits, {len(errors)} errors")
    if not ok_feeds and srcs:
        ledger(f"feedpool: 0/{len(srcs)} feeds returned data this run")


if __name__ == "__main__":
    main()
