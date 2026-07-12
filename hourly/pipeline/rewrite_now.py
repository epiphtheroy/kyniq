#!/usr/bin/env python3
"""Rewrite an existing /now piece in place with the CURRENT writer prompt.

Same slug, same URL (SEO continuity): Opus 4.8 rewrites the letter, the
deterministic gate checks structure, the row is PATCHed, dateModified bumps,
and distribution fires (revalidate + IndexNow + Bluesky/Telegram).

Usage: python3 pipeline/rewrite_now.py <slug> <draft-json-with-cand>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import load_env, log, now_utc, sb_get, sb_update  # noqa: E402
from pipeline.datapack import build_pack  # noqa: E402
from pipeline.produce import (after_publish, anti_repetition_digest,  # noqa: E402
                              assemble_modules, deterministic_gate, writer_pass)


def main() -> None:
    env = load_env()
    slug = sys.argv[1]
    cand = json.loads(Path(sys.argv[2]).read_text())["cand"]
    ent = cand["entity"]

    if not sb_get(env, f"now_articles?select=slug&slug=eq.{slug}", service=True):
        log(f"no such piece: {slug}")
        return

    pack = build_pack(env, {"type": ent["type"], "slug": ent.get("slug"), "label": ent["label"]})
    digest = anti_repetition_digest(env)

    piece, failure_report = None, None
    for attempt in (1, 2):
        draft = writer_pass(env, cand, pack, digest, "your call - find the letter's argument", failure_report)
        if not draft:
            failure_report = "previous attempt returned no parseable JSON"
            continue
        fails = deterministic_gate(env, draft, pack, keyword=cand.get("keyword", ""))
        if not fails:
            piece = draft
            break
        failure_report = "; ".join(fails)
        log(f"gate fail (attempt {attempt}): {failure_report[:300]}")
    if not piece:
        log(f"rewrite failed twice: {failure_report[:300]}")
        return

    piece.pop("_keyword", None)
    img = pack.get("image") or {}
    patch = {
        "headline": piece["headline"], "dek": piece.get("dek"), "summary": piece.get("summary"),
        "dateline": piece.get("dateline"),
        "facts_html": piece["facts_html"], "reading_html": piece["reading_html"],
        "bottom_html": piece.get("bottom_html"), "deposit": piece.get("deposit"),
        "modules": assemble_modules(piece, pack), "sources": piece["sources"],
        "image_path": img.get("path"), "image_alt": img.get("alt"),
        "archive_links": pack.get("archive_links") or [], "cut_floor": [],
        "update_note": "Rewritten as the editor's letter (format v3).",
        "updated_at": now_utc(),
    }
    ok, info = sb_update(env, "now_articles", f"slug=eq.{slug}", patch)
    if not ok:
        log(f"patch failed: {info}")
        return
    dist = after_publish(env, slug, piece["headline"], piece.get("dek"))
    log(f"REWRITTEN /now/{slug} · dist {dist}")


if __name__ == "__main__":
    main()
