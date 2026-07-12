#!/usr/bin/env python3
"""Letterboxd — individual cinephile reviews (개인 창작자 발굴의 본진).

Letterboxd is where INDIVIDUALS write about film. There is no per-film RSS and
HTML scraping is bot-blocked, so this polls an OWNER-CURATED pool of member
diary RSS feeds (radar_sources platform='letterboxd'), which is also the right
shape for a relationship-building tool — you choose whose work to follow.

Each RSS item is STRUCTURED (letterboxd:filmTitle / filmYear / tmdb:movieId /
dc:creator), so we match the reviewed film against metatake's FULL ~7k-film
corpus precisely (no keyword automaton, no false positives) and capture the
metatake slug for the '→ metatake page' action link. Every item is an
individual (author_kind='individual').

Add reviewers with:  python3 radar/add_letterboxd.py <username> [<username> ...]
Run:                  python3 radar/poll_letterboxd.py
"""
from __future__ import annotations

import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import (UA, build_matcher, clip, load_env, load_film_corpus, log,  # noqa: E402
                    ledger, parse_date, record_run, sb_get, sb_patch, strip_html,
                    upsert_items, url_hash, within_hours)
from matcher import norm  # noqa: E402

LB = "{https://letterboxd.com}"
DC = "{http://purl.org/dc/elements/1.1/}"
TMDB = "{https://themoviedb.org}"
RECENCY_HOURS = 96          # a diary review logged in the last ~4 days
_USER_RX = re.compile(r"letterboxd\.com/([^/]+)/", re.I)


def fetch(url: str, etag: str | None, last_modified: str | None):
    hdrs = {"User-Agent": UA, "Accept": "application/rss+xml, */*"}
    if etag:
        hdrs["If-None-Match"] = etag
    if last_modified:
        hdrs["If-Modified-Since"] = last_modified
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=hdrs), timeout=20) as r:
            return r.status, r.read(), {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, b"", {k.lower(): v for k, v in (e.headers or {}).items()}
    except Exception:
        return 0, b"", {}


def parse_letterboxd(data: bytes) -> list[dict]:
    out: list[dict] = []
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return out
    for it in root.iter("item"):
        film = (it.findtext(f"{LB}filmTitle") or "").strip()
        if not film:
            continue  # non-review activity (lists etc.) — skip
        year = it.findtext(f"{LB}filmYear")
        try:
            year = int(year) if year else None
        except Exception:
            year = None
        out.append({
            "film": film, "year": year,
            "url": (it.findtext("link") or "").strip(),
            "creator": (it.findtext(f"{DC}creator") or "").strip() or None,
            "rating": it.findtext(f"{LB}memberRating"),
            "rewatch": (it.findtext(f"{LB}rewatch") or "").strip(),
            "tmdb": it.findtext(f"{TMDB}movieId"),
            "published": parse_date(it.findtext("pubDate") or ""),
            "review": strip_html(re.sub(r"<img[^>]*>", "", it.findtext("description") or "")),
        })
    return out


def main() -> None:
    env = load_env()
    srcs = sb_get(env, "radar_sources?select=*&platform=eq.letterboxd&kind=eq.feed"
                       "&active=is.true&order=id") or []
    if not srcs:
        log("letterboxd: no reviewers in the pool — add with add_letterboxd.py <user>")
        record_run(env, "letterboxd", items_seen=0)
        return
    corpus = load_film_corpus()
    m = build_matcher(env)
    items: list[dict] = []
    errors: list = []
    ok = 0
    for src in srcs:
        try:
            status, body, hdrs = fetch(src["url"], src.get("etag"), src.get("last_modified"))
            if status == 304:
                sb_patch(env, "radar_sources", f"id=eq.{src['id']}", {"fail_count": 0})
                ok += 1
                continue
            if status != 200 or not body:
                fc = (src.get("fail_count") or 0) + 1
                patch = {"fail_count": fc}
                if fc >= 8:
                    patch["active"] = False
                sb_patch(env, "radar_sources", f"id=eq.{src['id']}", patch)
                errors.append(f"{src.get('label')}: HTTP {status}")
                continue
            ok += 1
            um = _USER_RX.search(src["url"])
            user = um.group(1) if um else (src.get("label") or "")
            for r in parse_letterboxd(body):
                if not r["url"] or not within_hours(r["published"], RECENCY_HOURS):
                    continue
                nt = norm(r["film"])
                slug = None
                if r["year"]:
                    # exact year, then ±1 (Letterboxd vs metatake festival/release
                    # year discrepancies are common); NEVER title-only, which links
                    # a same-title different film to the wrong page (Obsession 2025
                    # → obsession-1976).
                    for yy in (r["year"], r["year"] - 1, r["year"] + 1):
                        slug = corpus["by_ty"].get((nt, yy))
                        if slug:
                            break
                else:
                    slug = corpus["by_t"].get(nt)  # only when the RSS gave no year
                if not slug:
                    continue  # not a film metatake covers → nothing to offer them
                stars = ""
                try:
                    stars = "★" * int(float(r["rating"])) + ("½" if float(r["rating"]) % 1 else "")
                except Exception:
                    pass
                yr = f" ({r['year']})" if r["year"] else ""
                title = f"{r['film']}{yr} {stars}".strip()
                review = r["review"]
                # secondary: keyword hits (so it also shows in keyword drilldowns)
                kws = m.match(f"{r['film']} {review}")
                items.append({
                    "url": r["url"], "url_hash": url_hash(r["url"]), "platform": "letterboxd",
                    "author": r["creator"] or user,
                    "author_url": f"https://letterboxd.com/{user}/",
                    "title": clip(title, 300),
                    "snippet": clip(review, 300) if review and not review.lower().startswith("watched on") else f"{stars} on Letterboxd",
                    "content_text": f"{r['film']} {review}"[:4000],
                    "published_at": r["published"], "source_id": src["id"],
                    "author_kind": "individual",
                    "meta": {"film_slug": slug, "film_title": r["film"], "film_year": r["year"],
                             "rating": r["rating"], "tmdb_id": r["tmdb"],
                             "lb_user": user, "is_rewatch": r["rewatch"] == "Yes"},
                    "_kw": kws, "_matched_on": {k: "text" for k in kws},
                })
            new_etag, new_lm = hdrs.get("etag"), hdrs.get("last-modified")
            patch = {"fail_count": 0}
            if new_etag:
                patch["etag"] = new_etag
            if new_lm:
                patch["last_modified"] = new_lm
            sb_patch(env, "radar_sources", f"id=eq.{src['id']}", patch)
        except Exception as e:
            errors.append(f"{src.get('label')}: {type(e).__name__}")

    seen, new, hits = upsert_items(env, items)
    record_run(env, "letterboxd", items_seen=seen, items_new=new, hits=hits, errors=errors)
    log(f"letterboxd: {ok}/{len(srcs)} reviewers ok, {seen} metatake-film reviews, "
        f"{new} new, {len(errors)} errors")
    if not ok and srcs:
        ledger(f"letterboxd: 0/{len(srcs)} reviewer feeds returned data")


if __name__ == "__main__":
    main()
