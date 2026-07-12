#!/usr/bin/env python3
"""Now Playing — the daily digest.

One editor's note over the day: what spiked, what we watched, what we wrote.
Assembled mechanically from now_stream + now_articles; Opus 4.8 writes only the
headline, dek, and intro (no web search). Upserts into now_digests, then
revalidates + pings IndexNow + posts to Bluesky.

Usage: python3 pipeline/digest.py [YYYY-MM-DD]   (default: today UTC)
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import (anthropic_call, http, load_env, log, now_utc,  # noqa: E402
                             parse_json_block, sb_get, sb_insert, sb_update)
from pipeline.produce import INDEXNOW_KEY, _bluesky_post  # noqa: E402

MODEL = "claude-opus-4-8"


def _anchor_href(r: dict) -> str | None:
    """The link must match the anchor label: a person/theorist anchor points at
    the director/theorist page, NOT the film they happen to be tied to."""
    t = r.get("anchor_type")
    if t == "film" and r.get("film_slug"):
        return f"/film/{r['film_slug']}"
    if t in ("person", "director") and r.get("director_slug"):
        return f"/director/{r['director_slug']}"
    if t == "theorist" and r.get("anchor_slug"):
        return f"/theorist/{r['anchor_slug']}"
    if r.get("film_slug"):
        return f"/film/{r['film_slug']}"
    if r.get("director_slug"):
        return f"/director/{r['director_slug']}"
    return None


def _clock(iso: str) -> str:
    """'14:05 UTC (10:05 ET)' — UTC explicit + US Eastern (DST-aware)."""
    from datetime import datetime, timezone
    try:
        from zoneinfo import ZoneInfo
        d = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
        et = d.astimezone(ZoneInfo("America/New_York"))
        return f"{d.strftime('%H:%M')} UTC ({et.strftime('%H:%M')} ET)"
    except Exception:
        return (iso or "")[11:16] + " UTC"


def build_items(env: dict, day: str) -> list[dict]:
    rows = sb_get(env, f"now_stream?select=at,keyword,title,url,outlet,region,news_date,anchor_label,anchor_slug,anchor_type,film_slug,director_slug,value_point,published,piece_slug"
                       f"&at=gte.{day}T00:00:00Z&at=lte.{day}T23:59:59Z&order=at.asc", service=True) or []
    items = []
    for r in rows:
        items.append({
            "time": _clock(r.get("at") or ""), "keyword": r.get("keyword"),
            "title": r.get("title"), "url": r.get("url"), "outlet": r.get("outlet"),
            "region": r.get("region"), "news_date": r.get("news_date"),
            "anchor_label": r.get("anchor_label"), "anchor_href": _anchor_href(r),
            "film_slug": r.get("film_slug"),
            "value_point": r.get("value_point"),
            "piece_slug": r.get("piece_slug") if r.get("published") else None,
        })
    return items


def write_intro(env: dict, day: str, items: list[dict], pieces: list[dict]) -> dict | None:
    brief = {
        "date": day,
        "watched": [{"keyword": i["keyword"], "region": i["region"], "value_point": i["value_point"],
                     "became_piece": bool(i["piece_slug"])} for i in items],
        "pieces_published": [{"headline": p["headline"], "keyword": p.get("keyword")} for p in pieces],
    }
    user = (f"You are Wonwoo Yoon, editor of the Metatake archive, closing the day's Now Playing desk ({day}, UTC). "
            "Below is what the wire brought, what we watched, and what we wrote. Write the daily digest front matter:\n"
            "- headline: search-shaped, proper nouns forward, 40-100 chars, carries the day's strongest thread\n"
            "- dek: one sentence\n"
            "- intro_html: 2-4 short <p> paragraphs, the editor's letter voice (intelligent, humble, dry wit), "
            "naming the day's real dates and places, saying plainly what was worth the archive's attention and what we passed on and why. "
            "No em-dashes. Only <p>, <b>, <i> tags. No links.\n\n"
            f"THE DAY: {json.dumps(brief, ensure_ascii=False)}\n\n"
            'Reply JSON only: {"headline": "...", "dek": "...", "intro_html": "..."}')
    out = anthropic_call(env, model=MODEL, system="Reply with JSON only.", user=user, max_tokens=2500)
    parsed = parse_json_block(out or "")
    if parsed:
        for k in ("headline", "dek", "intro_html"):
            if parsed.get(k):
                parsed[k] = parsed[k].replace(" — ", ", ").replace("—", "-")
    return parsed


def main() -> None:
    env = load_env()
    day = sys.argv[1] if len(sys.argv) > 1 else datetime.now(timezone.utc).strftime("%Y-%m-%d")

    items = build_items(env, day)
    pieces = sb_get(env, f"now_articles?select=slug,headline,keyword&status=eq.published"
                         f"&published_at=gte.{day}T00:00:00Z&published_at=lte.{day}T23:59:59Z", service=True) or []

    if not items and not pieces:
        # (A) publish every day, no gaps (owner's rule 2026-07-10). On a fully
        # quiet day — nothing watched, nothing written — post a deterministic
        # note instead of skipping, so /now/daily/[date] is never missing. The
        # date keeps each quiet-day headline unique; no writer-model spend on empties.
        nice = datetime.strptime(day, "%Y-%m-%d").strftime("%B %-d, %Y")
        front = {
            "headline": f"The Now Playing Desk: A Quiet {nice}",
            "dek": "No film or culture story spiked hard enough to write today.",
            "intro_html": ("<p>A genuinely quiet day at the desk. The wire brought nothing the archive judged "
                           "worth an editor's letter, so we wrote none. We publish when a film or filmmaker truly "
                           "spikes in the world's attention, never to fill a slot, and today the quiet is simply "
                           "the standard holding.</p>"),
        }
        log(f"digest {day}: fully quiet day — deterministic note (no writer call)")
    else:
        front = write_intro(env, day, items, pieces)
        if not front or not front.get("headline") or not front.get("intro_html"):
            log(f"digest {day}: front matter generation failed")
            return

    row = {"digest_date": day, "headline": front["headline"][:200], "dek": front.get("dek"),
           "intro_html": front["intro_html"], "items": items, "updated_at": now_utc()}
    existing = sb_get(env, f"now_digests?select=id&digest_date=eq.{day}", service=True)
    if existing:
        ok, info = sb_update(env, "now_digests", f"digest_date=eq.{day}", row)
    else:
        ok, info = sb_insert(env, "now_digests", row)
    if not ok:
        log(f"digest {day}: upsert failed {info}")
        return

    # distribution
    site = env.get("NEXT_PUBLIC_SITE_URL", "https://metatake.net").rstrip("/")
    url = f"{site}/now/daily/{day}"
    secret = env.get("REVALIDATION_SECRET")
    if secret:
        for path in (f"/now/daily/{day}", "/now", "/"):
            http(f"{site}/api/revalidate?secret={quote(secret)}&path={quote(path)}", timeout=15, retries=0)
    host = urlparse(site).netloc
    http("https://api.indexnow.org/indexnow", method="POST",
         body=json.dumps({"host": host, "key": INDEXNOW_KEY, "keyLocation": f"{site}/{INDEXNOW_KEY}.txt",
                          "urlList": [url, f"{site}/now"]}).encode(),
         headers={"Content-Type": "application/json; charset=utf-8"}, retries=0)
    dist = ["revalidate" if secret else "no-revalidate", "indexnow"]
    if env.get("BLUESKY_HANDLE") and env.get("BLUESKY_APP_PASSWORD"):
        dist.append(f"bluesky:{_bluesky_post(env, front['headline'], url)}")
    log(f"DIGEST {day} published → /now/daily/{day} · items {len(items)} · dist {dist}")


if __name__ == "__main__":
    main()
