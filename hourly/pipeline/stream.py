#!/usr/bin/env python3
"""Now Playing — the wire we watched.

Records the hour's REVIEWED candidates (the ones that cleared the mechanical
bar) into now_stream, with one batched Fable 5 call writing the editor's
value-point line per item. Nothing here uses web search; cost per hour is a
few cents. These rows accumulate under films/directors ("In the news") and
feed the daily digest.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from .common import anthropic_call, log, parse_json_block, sb_get, sb_insert
from .datapack import build_pack

WRITER_MODEL = "claude-fable-5"

_GEO_LABEL = {"US": "United States", "GB": "United Kingdom", "world": "Worldwide", "-": "Worldwide"}


def _fmt_news_date(raw: str) -> str:
    if not raw:
        return ""
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(raw.replace("GMT", "+0000"), fmt).strftime("%b %-d, %Y")
        except Exception:
            continue
    return ""


def _best_source(cand: dict) -> tuple[str, str, str]:
    """(title, url, outlet) of the best source we saw for a candidate."""
    for src in (cand.get("news") or []) + (cand.get("fleet_hits") or []):
        if src.get("url", "").startswith("http"):
            return (src.get("title") or "", src["url"], src.get("source") or src.get("outlet") or "")
    return ("", "", "")


def _recent_keys(env: dict) -> set:
    cut = (datetime.now(timezone.utc) - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = sb_get(env, f"now_stream?select=keyword,anchor_slug&at=gte.{cut}", service=True) or []
    return {(r.get("keyword") or "").lower() + "|" + (r.get("anchor_slug") or "") for r in rows}


def _value_points(env: dict, entries: list[dict]) -> dict:
    """One batched call: the editor's one-line note per entry — why this spike
    was worth watching, through the archive's eyes. Voice matches the letters."""
    brief = [{"i": i,
              "keyword": e["keyword"],
              "news": e.get("title") or "(no headline captured)",
              "in_corpus": e.get("anchor_label") or "-",
              "became_piece": bool(e.get("published"))}
             for i, e in enumerate(entries)]
    user = ("You are Wonwoo Yoon, editor of the Metatake archive, annotating this hour's wire. "
            "For each item below, write ONE intelligent, dry sentence (<= 22 words) saying why this spike was worth watching "
            "from a film-and-culture archive's point of view - what the connection to the named corpus entity is, or what it might become. "
            "No em-dashes, no hype, no repetition of the keyword verbatim, fresh wording per item.\n\n"
            f"ITEMS: {json.dumps(brief, ensure_ascii=False)}\n\n"
            'Reply JSON only: {"notes": [{"i": 0, "v": "..."}, ...]}')
    out = anthropic_call(env, model=WRITER_MODEL, system="Reply with JSON only.", user=user, max_tokens=1200)
    parsed = parse_json_block(out or "") or {}
    return {n["i"]: str(n["v"]).replace(" — ", ", ").replace("—", "-")[:220]
            for n in parsed.get("notes", []) if "i" in n and "v" in n}


def record_stream(env: dict, cands: list[dict], published_keyword: str | None = None,
                  published_slug: str | None = None) -> int:
    """Write this hour's reviewed candidates into now_stream. Returns rows written."""
    if not cands:
        return 0
    seen = _recent_keys(env)
    entries = []
    for c in cands[:8]:
        ent = c.get("entity") or {}
        key = c["keyword"].lower() + "|" + (ent.get("slug") or "")
        if key in seen:
            continue
        seen.add(key)
        title, url, outlet = _best_source(c)

        pack = build_pack(env, {"type": ent.get("type"), "slug": ent.get("slug"), "label": ent.get("label") or ""})
        related = (pack.get("archive_links") or [])[:4]
        director_slug = None
        for l in related:
            if l["href"].startswith("/director/"):
                director_slug = l["href"].split("/director/")[1].split("/")[0]
        if ent.get("type") == "person":
            director_slug = ent.get("slug") or director_slug

        is_pub = published_keyword is not None and c["keyword"] == published_keyword
        entries.append({
            "keyword": c["keyword"], "title": title, "url": url, "outlet": outlet,
            "region": _GEO_LABEL.get(c.get("geo", "-"), c.get("geo") or "Worldwide"),
            "news_date": _fmt_news_date(c.get("pub", "")) or datetime.now(timezone.utc).strftime("%b %-d, %Y"),
            "anchor_type": ent.get("type"), "anchor_slug": ent.get("slug"),
            "anchor_label": pack["anchor"].get("label") or ent.get("label"),
            "film_slug": pack.get("film_slug"), "director_slug": director_slug,
            "scores": {"spike": c.get("spike"), "corroboration": c.get("corroboration"), "beat": c.get("beat")},
            "related_links": related,
            "published": is_pub, "piece_slug": published_slug if is_pub else None,
        })
    if not entries:
        return 0

    notes = _value_points(env, entries)
    written = 0
    for i, e in enumerate(entries):
        e["value_point"] = notes.get(i) or "Watched for the archive; the hour moved on."
        ok, info = sb_insert(env, "now_stream", e)
        if ok:
            written += 1
        else:
            log(f"stream insert failed: {info}")
    log(f"wire: {written} entries recorded" + (f" (1 became /now/{published_slug})" if published_slug else ""))
    return written
