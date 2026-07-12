#!/usr/bin/env python3
"""Engine B — GDELT DOC 2.0 news/blog sweep (§6.1-C, free, no key).

Per-keyword quoted-phrase queries, timespan=90m, sort=datedesc, 10s apart
(the informal 1-req/5s ceiling stretches on shared IPs). Throttle responses are
PLAIN TEXT, not JSON — handled. seendate is CRAWL time, not publish time
(meta.ts_kind='seen'); author = domain. Runs hourly on the Mac.

Usage: python3 radar/poll_gdelt.py
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import (build_matcher, clip, http, load_env, log, ledger, record_run,  # noqa: E402
                    upsert_items, url_hash)

API = "https://api.gdeltproject.org/api/v2/doc/doc"
SPACING_S = 10
MAX_KEYWORDS = 400  # safety ceiling on a single sweep


def gdelt_date(s: str) -> str | None:
    try:
        return datetime.strptime(s, "%Y%m%dT%H%M%SZ").replace(
            tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None


def main() -> None:
    env = load_env()
    m = build_matcher(env)
    kws = [k for k in m.kw.values()][:MAX_KEYWORDS]
    items: list[dict] = []
    errors: list = []
    hit_kw = 0
    for k in kws:
        phrase = (k.get("match_text") or k.get("keyword") or "").strip()
        if not phrase:
            continue
        q = quote(f'"{phrase}"')
        url = (f"{API}?query={q}&mode=artlist&format=json&timespan=90m"
               "&maxrecords=50&sort=datedesc")
        status, data = http(url, timeout=20)
        if status != 200 or not data:
            errors.append(f"{phrase}: HTTP {status}")
            time.sleep(SPACING_S)
            continue
        try:
            payload = json.loads(data)  # throttle response is plain text → JSONDecodeError
        except Exception:
            errors.append("throttled (non-JSON) — backing off")
            time.sleep(SPACING_S * 3)
            continue
        arts = payload.get("articles") or []
        for a in arts:
            u = (a.get("url") or "").strip()
            title = (a.get("title") or "").strip()
            if not u or not title:
                continue
            # the query WAS this keyword, but GDELT full-text-matched the phrase
            # in the article BODY (we only have the title). Force-linking the
            # queried keyword is safe for distinctive names, but for a
            # require_context keyword ("Burning") a bare-word news title would be
            # a false positive — only link it if the title itself passes the gate.
            kw_ids = set(m.match(title))
            if not k.get("require_context"):
                kw_ids.add(k["id"])
            if not kw_ids:
                continue
            items.append({
                "url": u, "url_hash": url_hash(u), "platform": "news",
                "author": a.get("domain"), "title": clip(title, 500),
                "snippet": clip(title, 300), "content_text": title[:2000],
                "published_at": gdelt_date(a.get("seendate") or ""),
                "thumb_url": None,
                "meta": {"ts_kind": "seen", "domain": a.get("domain"),
                         "lang": a.get("language")},
                "_kw": kw_ids,
                "_matched_on": {kid: "search" for kid in kw_ids},
            })
        if arts:
            hit_kw += 1
        time.sleep(SPACING_S)

    seen, new, hits = upsert_items(env, items)
    record_run(env, "gdelt", items_seen=seen, items_new=new, hits=hits, errors=errors[:20])
    log(f"gdelt: {len(kws)} keywords swept, {hit_kw} with hits, "
        f"{seen} items, {hits} hits, {len(errors)} errors")
    if errors and len(errors) >= len(kws):
        ledger(f"gdelt: every keyword errored this sweep ({len(errors)})")


if __name__ == "__main__":
    main()
